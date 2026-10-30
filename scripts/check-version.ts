// Fails when a pull request changes a plugin without raising `version`, compared with a base branch.
// Usage: node scripts/check-version.ts [base], where base defaults to origin/main.
import { execFileSync } from "node:child_process";
import { compareVersions, loadConfig } from "./lib/config.ts";
import { ROOT } from "./lib/report.ts";

const base = process.argv[2] ?? "origin/main";
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const config = await loadConfig(ROOT);

if (git("diff", "--name-only", `${base}...HEAD`, "--", "plugins") === "") {
  console.log(`No plugin changes since ${base}.`);
  process.exit(0);
}

/** The version on the base branch, or undefined before the first release. */
function baseVersion(): string | undefined {
  for (const plugin of config.plugins) {
    try {
      const manifest = git("show", `${base}:plugins/${plugin.name}/.claude-plugin/plugin.json`);
      return (JSON.parse(manifest) as { version?: string }).version;
    } catch {
      continue;
    }
  }
  return undefined;
}

const previous = baseVersion();
if (previous !== undefined && compareVersions(config.version, previous) <= 0) {
  console.error(
    `Plugins changed, but \`version\` is ${config.version} and ${base} has ${previous}. Raise \`version\` in plugin.config.ts and run \`pnpm generate\`.`,
  );
  process.exit(1);
}
console.log(`Version ${config.version} is ahead of ${base} (${previous ?? "no release yet"}).`);
