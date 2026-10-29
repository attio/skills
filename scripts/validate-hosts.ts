// Installs the plugins in temporary Claude Code and Codex config directories,
// then checks that both clients load every skill and MCP server.
//
//   pnpm validate:hosts [--require]
//
// With --require, a missing CLI is an error instead of a skip.
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./lib/config.ts";
import { ROOT } from "./lib/report.ts";
import { loadSkills } from "./lib/skills.ts";

const requireAll = process.argv.includes("--require");
const config = await loadConfig(ROOT);
const skills = await loadSkills(
  ROOT,
  config.plugins.map((p) => p.name),
);
const marketplace = config.marketplace.name;
const failures: string[] = [];

function run(command: string, args: string[], env: Record<string, string>): string {
  return execFileSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
  });
}

function has(command: string): boolean {
  try {
    execFileSync(command, ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function step(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`ok    ${name}`);
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    failures.push(name);
    console.log(`FAIL  ${name}\n${[err.stdout, err.stderr].filter(Boolean).join("\n") || err.message}`);
  }
}

/**
 * Copies the marketplace and points its entries at local plugins so the checks use this checkout.
 */
async function localMarketplace(work: string, file: string): Promise<string> {
  const dir = join(work, "marketplace");
  await mkdir(join(dir, file, ".."), { recursive: true });
  await cp(join(ROOT, "plugins"), join(dir, "plugins"), { recursive: true });
  const manifest = JSON.parse(await readFile(join(ROOT, file), "utf8")) as { plugins: Array<Record<string, unknown>> };
  for (const entry of manifest.plugins) entry["source"] = `./plugins/${String(entry["name"])}`;
  await writeFile(join(dir, file), JSON.stringify(manifest, null, 2));
  return dir;
}

/** Finds skills missing from the client's output, using qualified names when required. */
function missingSkills(output: string, plugin: string, qualified: boolean): string[] {
  return skills
    .filter((s) => s.plugin === plugin)
    .map((s) => (qualified ? `${plugin}:${s.name}` : s.name))
    .filter((name) => !new RegExp(`(^|[^\\w:-])${name}([^\\w-]|$)`, "m").test(output));
}

async function claude(): Promise<void> {
  const work = await mkdtemp(join(tmpdir(), "attio-claude-"));
  const env = { CLAUDE_CONFIG_DIR: join(work, "home") };
  try {
    for (const dir of [".", ...config.plugins.map((p) => `plugins/${p.name}`)]) {
      step(`claude plugin validate ${dir} --strict`, () => run("claude", ["plugin", "validate", dir, "--strict"], env));
    }
    const dir = await localMarketplace(work, ".claude-plugin/marketplace.json");
    step("claude plugin marketplace add", () => run("claude", ["plugin", "marketplace", "add", dir], env));
    for (const plugin of config.plugins) {
      step(`claude plugin install ${plugin.name}@${marketplace}`, () =>
        run("claude", ["plugin", "install", `${plugin.name}@${marketplace}`], env),
      );
    }
    step("claude mcp list has every MCP server", () => {
      const out = run("claude", ["mcp", "list"], env);
      for (const plugin of config.plugins) {
        for (const [name, server] of Object.entries(plugin.mcpServers)) {
          if (!out.includes(`plugin:${plugin.name}:${name}: ${server.url}`)) {
            throw new Error(`MCP server ${name} (${server.url}) didn't load:\n${out}`);
          }
        }
      }
    });
    for (const plugin of config.plugins) {
      step(`claude loads the ${plugin.name} skills`, () => {
        const details = run("claude", ["plugin", "details", `${plugin.name}@${marketplace}`], env);
        const listed = /^\s*Skills \(\d+\)(.*)$/m.exec(details)?.[1] ?? "";
        const missing = missingSkills(listed, plugin.name, false);
        if (missing.length > 0) throw new Error(`missing: ${missing.join(", ")}\n${details}`);
      });
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

async function codex(): Promise<void> {
  const work = await mkdtemp(join(tmpdir(), "attio-codex-"));
  const env = { CODEX_HOME: join(work, "home") };
  await mkdir(env.CODEX_HOME, { recursive: true });
  try {
    const dir = await localMarketplace(work, ".agents/plugins/marketplace.json");
    step("codex plugin marketplace add", () => run("codex", ["plugin", "marketplace", "add", dir], env));
    for (const plugin of config.plugins) {
      step(`codex plugin add ${plugin.name}@${marketplace}`, () => {
        const out = JSON.parse(run("codex", ["plugin", "add", `${plugin.name}@${marketplace}`, "--json"], env)) as {
          version?: string;
        };
        if (out.version !== config.version)
          throw new Error(`installed version ${out.version}, expected ${config.version}`);
      });
    }
    // Codex drops an MCP server with an invalid entry instead of failing the install, so check the list.
    step("codex mcp list has every MCP server", () => {
      const servers = JSON.parse(run("codex", ["mcp", "list", "--json"], env)) as Array<{
        name: string;
        transport?: { url?: string };
      }>;
      for (const plugin of config.plugins) {
        for (const [name, server] of Object.entries(plugin.mcpServers)) {
          if (!servers.some((s) => s.name === name && s.transport?.url === server.url)) {
            throw new Error(`MCP server ${name} (${server.url}) didn't load`);
          }
        }
      }
    });
    // Codex lists skills in the model's prompt as `- <plugin>:<skill>: <description>`.
    step("codex loads every skill", () => {
      const prompt = run("codex", ["debug", "prompt-input"], env);
      const missing = config.plugins.flatMap((p) => missingSkills(prompt, p.name, true));
      if (missing.length > 0) throw new Error(`missing: ${missing.join(", ")}`);
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

for (const [cli, check] of [
  ["claude", claude],
  ["codex", codex],
] as const) {
  if (has(cli)) {
    console.log(`\n${cli} ${run(cli, ["--version"], {}).trim()}`);
    await check();
  } else if (requireAll) {
    failures.push(`${cli} isn't installed`);
    console.log(`FAIL  ${cli} isn't installed`);
  } else {
    console.log(`\nskip  ${cli} isn't installed`);
  }
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nBoth clients load the plugins.");
