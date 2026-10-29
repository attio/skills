import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseFiles, fixtureRepo, skillFile, testConfig } from "./fixtures.ts";
import { checkMcpTools } from "./mcp-tools.ts";
import { loadSkills } from "./skills.ts";

const TOOLS = { server: "https://mcp.example.com/mcp", tools: ["search-records", "create-note"] };
const SETUP = "plugins/crm/skills/setup/SKILL.md";

async function check(skill: string, tools = TOOLS) {
  const root = await fixtureRepo({ ...baseFiles(), [SETUP]: skill });
  const skills = await loadSkills(root, ["crm", "crm-dev"]);
  return checkMcpTools(root, testConfig(), skills, tools);
}

const text = (diagnostics: Awaited<ReturnType<typeof check>>) =>
  diagnostics.map((d) => `${d.level}: ${d.message}`).join("\n");

describe("checkMcpTools", () => {
  it("passes when every tool used is declared and exists", async () => {
    const skill = skillFile("setup", 'metadata:\n  mcp-tools: "search-records"\n', "Call `search-records`.\n");
    assert.deepEqual(await check(skill), []);
  });

  it("fails on a declared tool the server doesn't have", async () => {
    const skill = skillFile("setup", 'metadata:\n  mcp-tools: "delete-everything"\n');
    assert.match(text(await check(skill)), /error: MCP tool `delete-everything` isn't on the MCP server/);
  });

  it("fails on a tool the skill uses but doesn't declare", async () => {
    const skill = skillFile("setup", "", "Call `create-note`.\n");
    assert.match(text(await check(skill)), /error: `create-note` is an MCP tool/);
  });

  it("finds tool names outside backticks, such as in code blocks", async () => {
    const skill = skillFile("setup", "", '```json\n{ "tool": "create-note" }\n```\n');
    assert.match(text(await check(skill)), /error: `create-note` is an MCP tool/);
  });

  it("matches whole tool names only", async () => {
    assert.deepEqual(await check(skillFile("setup", "", "Use create-notes-fast and search-records-v2.\n")), []);
  });

  it("fails on a tool named in a plugin without an MCP server", async () => {
    const root = await fixtureRepo({ ...baseFiles(), "plugins/crm-dev/skills/build-apps/SKILL.md": skillFile("build-apps", "", "Call `search-records`.\n") });
    const found = await checkMcpTools(root, testConfig(), await loadSkills(root, ["crm", "crm-dev"]), TOOLS);
    assert.match(text(found), /error: `search-records` is an MCP tool, but plugin `crm-dev` has no MCP server/);
  });

  it("warns on a declared tool the skill never mentions", async () => {
    const skill = skillFile("setup", 'metadata:\n  mcp-tools: "create-note"\n');
    assert.match(text(await check(skill)), /warning: .*never mentions/);
  });

  it("checks the tool list belongs to a configured server", async () => {
    const found = await check(skillFile("setup"), { server: "https://elsewhere.example.com", tools: [] });
    assert.match(text(found), /isn't an MCP server in plugin\.config\.ts/);
  });
});
