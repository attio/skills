// Checks that a release tag matches the version in plugin.config.ts.
//
//   pnpm check:release --tag vX.Y.Z
import { parseArgs } from "node:util";
import { loadConfig, releaseTag } from "./lib/config.ts";
import { ROOT } from "./lib/report.ts";

const { values } = parseArgs({ options: { tag: { type: "string" } } });
const config = await loadConfig(ROOT);
const expected = releaseTag(config);

if (values.tag !== expected) {
  console.error(`Tag ${values.tag ?? "(none)"} doesn't match version ${config.version}. Expected ${expected}.`);
  process.exit(1);
}
console.log(`Ready to release ${expected}.`);
