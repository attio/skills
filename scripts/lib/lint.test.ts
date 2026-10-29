import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { baseFiles, fixtureRepo, skillFile, testConfig } from "./fixtures.ts";
import { lintRepo } from "./lint.ts";
import { loadSkills } from "./skills.ts";

async function errors(files: Record<string, string>, setup?: (root: string) => Promise<void>) {
  const root = await fixtureRepo({ ...baseFiles(), ...files });
  await setup?.(root);
  const skills = await loadSkills(root, ["crm", "crm-dev"]);
  return (await lintRepo(root, testConfig(), skills)).map((d) => `${d.file}: ${d.message}`).join("\n");
}

const SETUP = "plugins/crm/skills/setup/SKILL.md";

describe("lintRepo", () => {
  it("passes a valid repo", async () => {
    assert.equal(await errors({}), "");
  });

  it("checks the name against the folder and the reserved words", async () => {
    assert.match(await errors({ [SETUP]: skillFile("set-up") }), /match its folder name/);
    assert.match(await errors({ "plugins/crm/skills/claude-setup/SKILL.md": skillFile("claude-setup") }), /can't contain/);
  });

  it("allows only keys every host accepts", async () => {
    assert.match(await errors({ [SETUP]: skillFile("setup", "compatibility: Node 22\n") }), /compatibility/);
    assert.match(await errors({ [SETUP]: skillFile("setup", "when_to_use: always\n") }), /unknown frontmatter key/);
  });

  it("requires string metadata values", async () => {
    assert.match(await errors({ [SETUP]: skillFile("setup", "metadata:\n  version: 1.0\n") }), /must be a string/);
  });

  it("rejects descriptions that hosts refuse", async () => {
    assert.match(await errors({ [SETUP]: `---\nname: setup\ndescription: ${"x".repeat(1025)}\n---\n` }), /limit is 1024/);
    assert.match(await errors({ [SETUP]: "---\nname: setup\ndescription: Use <b>this</b>\n---\n" }), /`<` or `>`/);
    assert.match(await errors({ [SETUP]: '---\nname: setup\ndescription: ""\n---\n' }), /non-empty string/);
  });

  it("rejects MCP tools in a plugin without an MCP server", async () => {
    const file = skillFile("build-apps", 'metadata:\n  mcp-tools: "search"\n');
    assert.match(await errors({ "plugins/crm-dev/skills/build-apps/SKILL.md": file }), /has no MCP server/);
  });

  it("finds a missing onboarding skill, empty plugins and stray files", async () => {
    const found = await errors({}, async (root) => {
      await rm(join(root, "plugins/crm/skills/setup"), { recursive: true });
      await writeFile(join(root, "plugins/crm/skills/notes.md"), "");
    });
    assert.match(found, /onboarding skill `setup`/);
    assert.match(found, /plugin has no skills/);
    assert.match(found, /only skill folders/);
  });

  it("allows only skills, assets, a README and manifests in a plugin", async () => {
    const found = await errors({ "plugins/crm/hooks/hooks.json": "{}", "plugins/crm/.claude-plugin/extra.json": "{}" });
    assert.match(found, /plugins\/crm\/hooks: plugins hold only/);
    assert.match(found, /\.claude-plugin\/extra\.json: only plugin\.json/);
  });

  it("rejects the same skill name in two plugins", async () => {
    assert.match(await errors({ "plugins/crm-dev/skills/setup/SKILL.md": skillFile("setup") }), /also used by/);
  });
});
