// Checks that every MCP tool a skill uses exists on the Attio MCP server, using the tool list in mcp-tools.json.
import { loadConfig } from "./lib/config.ts";
import { checkMcpTools, loadToolsFile } from "./lib/mcp-tools.ts";
import { report, ROOT } from "./lib/report.ts";
import { loadSkills } from "./lib/skills.ts";

const config = await loadConfig(ROOT);
const skills = await loadSkills(
  ROOT,
  config.plugins.map((p) => p.name),
);
const tools = await loadToolsFile(ROOT);
process.exit(report(await checkMcpTools(ROOT, config, skills, tools), "Every MCP tool the skills use exists."));
