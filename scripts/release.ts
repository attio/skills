// Release commands for maintainers. Each one checks the repo is in the right state, does one release step and
// prints the next one. They use your own git and GitHub CLI credentials, and run from an up-to-date `main`.
//
//   pnpm release bump X.Y.Z   open a pull request that sets `version`
//   pnpm release tag          tag `main` as v<version> and push the tag, which starts the Release workflow
//   pnpm release publish      open a pull request that points the marketplaces at that release
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compareVersions, loadConfig, releaseTag, repositoryUrl } from "./lib/config.ts";
import { ROOT } from "./lib/report.ts";
import { setReleaseField } from "./lib/release.ts";

const MAIN = "main";
const CONFIG_FILE = join(ROOT, "plugin.config.ts");

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function tagExists(tag: string): boolean {
  return run("git", ["ls-remote", "--tags", "origin", `refs/tags/${tag}`]) !== "";
}

/** Fails unless this is a clean checkout of `main` that matches origin. */
function requireCleanMain(): void {
  run("git", ["fetch", "--quiet", "--tags", "origin", MAIN]);
  if (run("git", ["status", "--porcelain"]) !== "") fail("Commit or discard your changes first.");
  if (run("git", ["rev-parse", "--abbrev-ref", "HEAD"]) !== MAIN) fail(`Switch to ${MAIN} first.`);
  if (run("git", ["rev-parse", "HEAD"]) !== run("git", ["rev-parse", `origin/${MAIN}`])) {
    fail(`Your ${MAIN} doesn't match origin. Run \`git pull\` first.`);
  }
}

/** Edits plugin.config.ts on a new branch, regenerates, and opens a pull request. */
function openPullRequest(
  branch: string,
  field: "version" | "published",
  value: string,
  title: string,
  body: string,
): void {
  run("git", ["switch", "--quiet", "-c", branch]);
  writeFileSync(CONFIG_FILE, setReleaseField(readFileSync(CONFIG_FILE, "utf8"), field, value));
  run(process.execPath, [join(ROOT, "scripts", "generate.ts")]);
  run("git", ["add", "--all"]);
  run("git", ["commit", "--quiet", "-m", title]);
  run("git", ["push", "--quiet", "--set-upstream", "origin", branch]);
  const url = run("gh", ["pr", "create", "--base", MAIN, "--head", branch, "--title", title, "--body", body]);
  run("git", ["switch", "--quiet", MAIN]);
  console.log(`Opened ${url}`);
}

const [command, argument] = process.argv.slice(2);
const config = await loadConfig(ROOT);
const tag = releaseTag(config);
const unreleased = compareVersions(config.version, config.published ?? "0.0.0") > 0;

if (command === "bump") {
  if (!argument || !/^\d+\.\d+\.\d+$/.test(argument)) fail("Usage: pnpm release bump X.Y.Z");
  if (compareVersions(argument, config.version) <= 0) fail(`${argument} must be higher than ${config.version}.`);
  requireCleanMain();
  openPullRequest(
    `release/v${argument}-bump`,
    "version",
    argument,
    `Bump version to ${argument}`,
    `Sets \`version\` to ${argument}. Users aren't affected until the release is published.`,
  );
  console.log("Next: merge it, then run `pnpm release tag` from an up-to-date main.");
} else if (command === "tag") {
  requireCleanMain();
  if (!unreleased) fail(`Nothing to release: run \`pnpm release bump X.Y.Z\` first.`);
  if (tagExists(tag)) fail(`${tag} already exists. Next: QA it, then run \`pnpm release publish\`.`);
  run("git", ["tag", "--annotate", tag, "--message", tag]);
  run("git", ["push", "--quiet", "origin", tag]);
  console.log(`Pushed ${tag}. The Release workflow is building it: ${repositoryUrl(config)}/actions`);
  console.log(
    "Next: QA the build (`pnpm validate:hosts`, and upload the ZIP as an OpenAI draft), then run `pnpm release publish`.",
  );
} else if (command === "publish") {
  requireCleanMain();
  if (!unreleased) fail(`Nothing to publish: run \`pnpm release bump X.Y.Z\` first.`);
  if (!tagExists(tag)) fail(`${tag} doesn't exist yet. Run \`pnpm release tag\` first.`);
  const assets = run("gh", [
    "release",
    "view",
    tag,
    "--repo",
    config.repository,
    "--json",
    "assets",
    "--jq",
    ".assets[].name",
  ]);
  for (const plugin of config.plugins.filter((p) => p.listed)) {
    const zip = `${plugin.name}-${config.version}.zip`;
    if (!assets.split("\n").includes(zip)) fail(`The ${tag} release has no ${zip}. Check the Release workflow.`);
  }
  openPullRequest(
    `release/v${config.version}-publish`,
    "published",
    config.version,
    `Publish ${tag}`,
    `Points the marketplaces at ${tag}. Users get this release when it merges.`,
  );
  console.log("Next: merge it, then submit the ZIP from the GitHub release in the OpenAI portal.");
} else {
  fail("Usage: pnpm release bump X.Y.Z | pnpm release tag | pnpm release publish");
}
