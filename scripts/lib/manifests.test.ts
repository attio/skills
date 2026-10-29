import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { baseFiles, fixtureRepo, testConfig } from "./fixtures.ts";
import { buildOutputs, renderSections } from "./manifests.ts";
import { loadSkills } from "./skills.ts";

async function outputs() {
  const files = baseFiles();
  const root = await fixtureRepo(files);
  const config = testConfig();
  const skills = await loadSkills(root, ["crm", "crm-dev"]);
  return buildOutputs(config, skills, files["README.md"] ?? "");
}

const read = (out: Map<string, string>, path: string) => JSON.parse(out.get(path) ?? "null") as Record<string, any>;

describe("buildOutputs", () => {
  it("installs each plugin from its folder in the repo", async () => {
    const out = await outputs();
    const entry = read(out, ".claude-plugin/marketplace.json")["plugins"][0];
    assert.deepEqual(entry.source, { source: "git-subdir", url: "https://github.com/example/plugins.git", path: "plugins/crm" });
  });

  it("writes MCP configs only for plugins with an MCP server", async () => {
    const out = await outputs();
    assert.deepEqual(read(out, "plugins/crm/.mcp.json"), {
      mcpServers: { crm: { type: "http", url: "https://mcp.example.com/mcp" } },
    });
    assert.equal(read(out, "plugins/crm/mcp.json")["mcpServers"].crm.type, "streamable-http");
    assert.equal(out.has("plugins/crm-dev/mcp.json"), false);
    assert.equal(out.has("plugins/crm-dev/.mcp.json"), false);
  });

  it("points the OpenAI onboarding skill at its SKILL.md", async () => {
    const manifest = read(await outputs(), "plugins/crm/plugin.json");
    assert.equal(manifest["extensions"]["com.openai"].onboardingSkill, "./skills/setup/SKILL.md");
  });

  it("keeps OpenAI fields out of the Claude manifest", async () => {
    const manifest = read(await outputs(), "plugins/crm/.claude-plugin/plugin.json");
    assert.equal("extensions" in manifest, false);
    assert.equal(manifest["version"], "1.2.3");
    assert.equal(read(await outputs(), "plugins/crm-dev/.claude-plugin/plugin.json")["termsOfServiceUrl"], "https://example.com/developer-terms");
  });

  it("lists each plugin under its Claude category", async () => {
    const entries = read(await outputs(), ".claude-plugin/marketplace.json")["plugins"];
    assert.deepEqual(entries.map((e: { category: string }) => e.category), ["sales", "development"]);
  });

  it("fills the README sections", async () => {
    const readme = (await outputs()).get("README.md") ?? "";
    assert.match(readme, /\| `crm` \| \[`setup`\]\(plugins\/crm\/skills\/setup\/SKILL\.md\) \| Does the thing\. \|/);
    assert.match(readme, /\/plugin install crm-dev --marketplace example\/plugins/);
    assert.match(readme, /codex plugin add crm@example/);
  });
});

describe("renderSections", () => {
  it("replaces only the marked section", () => {
    const text = "a\n<!-- BEGIN GENERATED: x -->\nold\n<!-- END GENERATED: x -->\nb\n";
    assert.equal(renderSections(text, { x: "new" }, "R.md"), "a\n<!-- BEGIN GENERATED: x -->\nnew\n<!-- END GENERATED: x -->\nb\n");
  });

  it("fails without markers", () => {
    assert.throws(() => renderSections("text", { x: "new" }, "R.md"), /R\.md needs/);
  });
});
