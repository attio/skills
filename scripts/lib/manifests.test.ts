import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { testConfig } from "./fixtures.ts";
import { buildOutputs, renderSections } from "./manifests.ts";

const out = buildOutputs(
  testConfig(),
  [
    {
      plugin: "crm",
      name: "setup",
      frontmatter: { description: "Does the thing. Use when the user asks for the thing." },
    },
    {
      plugin: "crm-dev",
      name: "build-apps",
      frontmatter: { description: "Builds CRM apps." },
    },
  ],
  `# Plugins

<!-- BEGIN GENERATED: plugins -->
<!-- END GENERATED: plugins -->

<!-- BEGIN GENERATED: skills -->
<!-- END GENERATED: skills -->

<!-- BEGIN GENERATED: install -->
<!-- END GENERATED: install -->
`,
);

function read(path: string): Record<string, any> {
  const content = out.get(path);
  assert.ok(content, `Missing generated file: ${path}`);
  return JSON.parse(content);
}

describe("buildOutputs", () => {
  it("installs each plugin from its folder in the repo", () => {
    const entry = read(".claude-plugin/marketplace.json")["plugins"][0];
    assert.deepEqual(entry.source, {
      source: "git-subdir",
      url: "https://github.com/example/plugins.git",
      path: "plugins/crm",
    });
  });

  it("writes MCP configs only for plugins with an MCP server", () => {
    assert.deepEqual(read("plugins/crm/.mcp.json"), {
      mcpServers: { crm: { type: "http", url: "https://mcp.example.com/mcp" } },
    });
    assert.equal(read("plugins/crm/mcp.json")["mcpServers"].crm.type, "streamable-http");
    assert.equal(out.has("plugins/crm-dev/mcp.json"), false);
    assert.equal(out.has("plugins/crm-dev/.mcp.json"), false);
  });

  it("points the OpenAI onboarding skill at its SKILL.md", () => {
    const manifest = read("plugins/crm/plugin.json");
    assert.equal(manifest["extensions"]["com.openai"].onboardingSkill, "./skills/setup/SKILL.md");
  });

  it("keeps OpenAI fields out of the Claude manifest", () => {
    const manifest = read("plugins/crm/.claude-plugin/plugin.json");
    assert.equal("extensions" in manifest, false);
    assert.equal(manifest["version"], "1.2.3");
    assert.equal(
      read("plugins/crm-dev/.claude-plugin/plugin.json")["termsOfServiceUrl"],
      "https://example.com/developer-terms",
    );
  });

  it("lists each plugin under its Claude category", () => {
    const entries = read(".claude-plugin/marketplace.json")["plugins"];
    assert.deepEqual(
      entries.map((e: { category: string }) => e.category),
      ["sales", "development"],
    );
  });

  it("fills the README sections", () => {
    const readme = out.get("README.md") ?? "";
    assert.match(readme, /\| `crm` \| \[`setup`\]\(plugins\/crm\/skills\/setup\/SKILL\.md\) \| Does the thing\. \|/);
    assert.match(readme, /\/plugin install crm-dev --marketplace example\/plugins/);
    assert.match(readme, /codex plugin add crm@example/);
  });
});

describe("renderSections", () => {
  it("replaces only the marked section", () => {
    const text = "a\n<!-- BEGIN GENERATED: x -->\nold\n<!-- END GENERATED: x -->\nb\n";
    assert.equal(
      renderSections(text, { x: "new" }, "R.md"),
      "a\n<!-- BEGIN GENERATED: x -->\nnew\n<!-- END GENERATED: x -->\nb\n",
    );
  });

  it("fails without markers", () => {
    assert.throws(() => renderSections("text", { x: "new" }, "R.md"), /R\.md needs/);
  });
});
