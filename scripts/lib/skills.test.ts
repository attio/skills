import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSkillFile, summary } from "./skills.ts";

const messages = (text: string) => parseSkillFile(text).issues.map((i) => i.message);

describe("parseSkillFile", () => {
  it("parses frontmatter and finds the body", () => {
    const parsed = parseSkillFile("---\nname: a\ndescription: >-\n  one\n  two\n---\n\n# Body\n");
    assert.deepEqual(parsed.data, { name: "a", description: "one two" });
    assert.equal(parsed.bodyLine, 7);
    assert.deepEqual(parsed.issues, []);
  });

  it("requires frontmatter on the first line", () => {
    assert.match(messages("\n---\nname: a\n---\n")[0] ?? "", /must start with/);
    assert.match(messages("﻿---\nname: a\n---\n")[0] ?? "", /byte order mark/);
    assert.match(messages("---\nname: a\n")[0] ?? "", /no closing/);
  });

  it("rejects YAML that hosts read differently", () => {
    assert.match(messages("---\nname: a\ndescription: Use when: x\n---\n")[0] ?? "", /invalid YAML/);
    assert.match(messages("---\nname: a\nname: b\n---\n")[0] ?? "", /unique/);
    assert.match(messages("---\nname: a\nmetadata: {a: b}\n---\n")[0] ?? "", /block style/);
    assert.match(messages("---\nname: !!str a\n---\n")[0] ?? "", /tags/);
    assert.deepEqual(messages("---\nname: &x a\ndescription: *x\n---\n"), [
      "YAML anchors aren't allowed",
      "YAML aliases aren't allowed",
    ]);
  });

  it("reads CRLF files", () => {
    assert.deepEqual(parseSkillFile("---\r\nname: a\r\ndescription: b\r\n---\r\nbody\r\n").data, { name: "a", description: "b" });
  });

  it("flags an indented `---`, which ends the frontmatter in some clients", () => {
    assert.match(messages("---\nname: a\ndescription: |\n  x\n  ---\n---\n")[0] ?? "", /indented `---`/);
  });

  it("reports the line of the problem", () => {
    assert.equal(parseSkillFile("---\nname: a\nmetadata: {a: b}\n---\n").issues[0]?.line, 3);
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
