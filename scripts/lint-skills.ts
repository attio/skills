// Checks every skill against the Agent Skills specification and the stricter rules of the hosts we ship to.
import { loadConfig } from "./lib/config.ts";
import { lintRepo } from "./lib/lint.ts";
import { report, ROOT } from "./lib/report.ts";
import { loadSkills } from "./lib/skills.ts";

const config = await loadConfig(ROOT);
const skills = await loadSkills(
  ROOT,
  config.plugins.map((p) => p.name),
);
process.exit(report(await lintRepo(ROOT, config, skills), `${skills.length} skill(s) passed.`));
