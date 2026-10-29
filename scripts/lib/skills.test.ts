import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSkillFile, summary } from "./skills.ts";

describe("parseSkillFile", () => {
  it("parses frontmatter", () => {
    const parsed = parseSkillFile("---\nname: a\ndescription: >-\n  one\n  two\n---\n\n# Body\n");
    assert.deepEqual(parsed.data, { name: "a", description: "one two" });
  });

  it("reads CRLF files", () => {
    assert.deepEqual(parseSkillFile("---\r\nname: a\r\ndescription: b\r\n---\r\nbody\r\n").data, { name: "a", description: "b" });
  });

  it("returns no data without valid frontmatter", () => {
    for (const text of ["# Skill\n", "---\nname: a\n", "---\ndescription: Use when: x\n---\n", "---\n- a\n---\n"]) {
      assert.equal(parseSkillFile(text).data, undefined);
    }
  });
});

describe("summary", () => {
  it("takes the first sentence", () => {
    assert.equal(summary("Does a thing. Use when asked."), "Does a thing.");
    assert.equal(summary("Uses `attio.com` links. Then more."), "Uses `attio.com` links.");
    assert.equal(summary("No full stop"), "No full stop");
    assert.equal(summary("Builds widgets, e.g. tabs. Then more."), "Builds widgets, e.g. tabs.");
  });
});
