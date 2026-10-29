// Writes every manifest and marketplace file from plugin.config.ts.
// With --check, writes nothing and fails if any generated file is out of date.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { format, resolveConfig } from "prettier";
import { loadConfig } from "./lib/config.ts";
import { buildOutputs, mcpFiles, ROOT_README } from "./lib/manifests.ts";
import { error, report, ROOT, type Diagnostic } from "./lib/report.ts";
import { loadAgentPluginSchemas } from "./lib/schemas.ts";
import { loadSkills } from "./lib/skills.ts";

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(join(ROOT, path), "utf8");
  } catch {
    return undefined;
  }
}

const check = process.argv.includes("--check");
const config = await loadConfig(ROOT);
const skills = await loadSkills(
  ROOT,
  config.plugins.map((p) => p.name),
);

const readme = await readFile(join(ROOT, ROOT_README), "utf8");

const diagnostics: Diagnostic[] = [];
let outputs: Map<string, string>;
try {
  outputs = buildOutputs(config, skills, readme);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

// Generated files follow the repo's Prettier style, so `pnpm format:check` agrees with `pnpm generate --check`.
for (const [path, content] of outputs) {
  outputs.set(path, await format(content, { ...(await resolveConfig(join(ROOT, path))), filepath: path }));
}

// Check the OpenAI manifests against the Agent Plugins schema.
const agentPluginSchemaErrors = await loadAgentPluginSchemas().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
for (const plugin of config.plugins) {
  for (const kind of ["plugin", "mcp"] as const) {
    const path = `plugins/${plugin.name}/${kind}.json`;
    const content = outputs.get(path);
    if (content === undefined) continue;
    for (const message of agentPluginSchemaErrors(kind, JSON.parse(content))) {
      diagnostics.push(error(path, `doesn't match the Agent Plugins 1.0.0 schema: ${message}`));
    }
  }
}

// Plugin folders and MCP configs that no longer match the config.
const configured = new Set(config.plugins.map((p) => p.name));
for (const entry of await readdir(join(ROOT, "plugins"), { withFileTypes: true }).catch(() => [])) {
  if (entry.isDirectory() && !configured.has(entry.name)) {
    diagnostics.push(error(`plugins/${entry.name}`, "plugin folder isn't in plugin.config.ts"));
  }
}
const stale = config.plugins.flatMap((p) => mcpFiles(p)).filter((path) => !outputs.has(path));

if (check) {
  for (const [path, content] of outputs) {
    if ((await readOptional(path)) !== content) {
      diagnostics.push(error(path, "out of date. Run `pnpm generate` and commit the result."));
    }
  }
  for (const path of stale) {
    if ((await readOptional(path)) !== undefined) {
      diagnostics.push(error(path, "no MCP server is configured for this plugin. Run `pnpm generate`."));
    }
  }
  process.exit(report(diagnostics, "Generated files are up to date."));
}

for (const [path, content] of outputs) {
  if ((await readOptional(path)) === content) continue;
  await mkdir(dirname(join(ROOT, path)), { recursive: true });
  await writeFile(join(ROOT, path), content);
  console.log(`wrote ${path}`);
}
for (const path of stale) {
  if ((await readOptional(path)) === undefined) continue;
  await rm(join(ROOT, path));
  console.log(`removed ${path}`);
}
process.exit(report(diagnostics, "Generated files are up to date."));
