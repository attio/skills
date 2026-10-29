import assert from "node:assert/strict";
import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { unzipSync } from "fflate";
import { fixtureRepo, skillFile } from "./fixtures.ts";
import { buildZip, collectUploadFiles } from "./zip.ts";

const PLUGIN = {
  "plugin.json": "{}",
  "mcp.json": "{}",
  ".mcp.json": "{}",
  ".claude-plugin/plugin.json": "{}",
  "README.md": "# Plugin\n",
  "skills/setup/SKILL.md": skillFile("setup"),
  "skills/setup/references/guide.md": "# Guide\n",
  "skills/setup/.DS_Store": "",
  "assets/logo.png": "png",
};

describe("collectUploadFiles", () => {
  it("includes only the OpenAI manifest, MCP config, skills and assets", async () => {
    const dir = await fixtureRepo(PLUGIN);
    const paths = (await collectUploadFiles(dir)).map((f) => f.path);
    assert.deepEqual(paths, [
      "plugin.json",
      "mcp.json",
      "skills/setup/references/guide.md",
      "skills/setup/SKILL.md",
      "assets/logo.png",
    ]);
  });

  it("rejects symlinks and hidden files", async () => {
    const dir = await fixtureRepo(PLUGIN);
    await symlink(join(dir, "README.md"), join(dir, "skills/setup/link.md"));
    await assert.rejects(collectUploadFiles(dir), /symlink/);
    const hidden = await fixtureRepo({ ...PLUGIN, "skills/.hidden/SKILL.md": "x" });
    await assert.rejects(collectUploadFiles(hidden), /hidden/);
  });

  it("needs a skill", async () => {
    const dir = await fixtureRepo({ "plugin.json": "{}" });
    await assert.rejects(collectUploadFiles(dir), /at least one skill/);
  });
});

describe("buildZip", () => {
  it("is reproducible and puts the plugin at the archive root", async () => {
    const files = await collectUploadFiles(await fixtureRepo(PLUGIN));
    const a = buildZip(files);
    const b = buildZip([...files].reverse());
    assert.deepEqual(a, b);
    assert.deepEqual(Object.keys(unzipSync(a)).sort(), files.map((f) => f.path).sort());
  });
});
