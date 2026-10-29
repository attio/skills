import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { isAlias, isCollection, isScalar, parseDocument, visit } from "yaml";

export interface FrontmatterIssue {
  line: number;
  message: string;
}

export interface ParsedSkillFile {
  /** Parsed frontmatter, or undefined when it is missing or doesn't parse. */
  data: Record<string, unknown> | undefined;
  body: string;
  /** 1-based line of the first body line in the file. */
  bodyLine: number;
  issues: FrontmatterIssue[];
}

/**
 * Splits and parses SKILL.md frontmatter. Stricter than most hosts on purpose: some hosts load a skill
 * with no fields when its YAML is invalid, so every construct that a host might read differently is an issue.
 */
export function parseSkillFile(source: string): ParsedSkillFile {
  const issues: FrontmatterIssue[] = [];
  const text = source.replace(/\r\n?/g, "\n");
  if (text.startsWith("﻿")) {
    return { data: undefined, body: text, bodyLine: 1, issues: [{ line: 1, message: "remove the byte order mark" }] };
  }
  const lines = text.split("\n");
  if (lines[0]?.trimEnd() !== "---") {
    return {
      data: undefined,
      body: text,
      bodyLine: 1,
      issues: [{ line: 1, message: "SKILL.md must start with a `---` frontmatter line" }],
    };
  }
  const end = frontmatterEnd(lines);
  if (end === -1) {
    return { data: undefined, body: text, bodyLine: 1, issues: [{ line: 1, message: "frontmatter has no closing `---`" }] };
  }
  if (lines[end] !== lines[end]?.trimStart()) {
    issues.push({ line: end + 1, message: "an indented `---` ends the frontmatter in some clients; remove it from the value" });
  }

  const yamlText = lines.slice(1, end).join("\n");
  const body = lines.slice(end + 1).join("\n");
  const bodyLine = end + 2;
  const lineOf = (offset: number | undefined) =>
    offset === undefined ? 1 : yamlText.slice(0, offset).split("\n").length + 1;

  const doc = parseDocument(yamlText, { uniqueKeys: true, prettyErrors: false, version: "1.2" });
  for (const error of [...doc.errors, ...doc.warnings]) {
    issues.push({ line: lineOf(error.pos[0]), message: `invalid YAML: ${error.message.split("\n")[0]}` });
  }
  if (doc.errors.length > 0) return { data: undefined, body, bodyLine, issues };

  visit(doc, (_key, node) => {
    if (isAlias(node)) {
      issues.push({ line: lineOf(node.range?.[0]), message: "YAML aliases aren't allowed" });
    } else if (isCollection(node) || isScalar(node)) {
      if (node.anchor) issues.push({ line: lineOf(node.range?.[0]), message: "YAML anchors aren't allowed" });
      // Parsed nodes only carry a tag when the source sets one explicitly.
      if (node.tag) issues.push({ line: lineOf(node.range?.[0]), message: "YAML tags aren't allowed" });
      if (isCollection(node) && node.flow) {
        issues.push({ line: lineOf(node.range?.[0]), message: "use block style instead of `[...]` or `{...}`" });
      }
    }
  });

  const data = doc.toJS() as unknown;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    issues.push({ line: 2, message: "frontmatter must be a mapping" });
    return { data: undefined, body, bodyLine, issues };
  }
  return { data: data as Record<string, unknown>, body, bodyLine, issues };
}

/** Index of the closing `---`. Clients end the frontmatter at the first `---` line, even an indented one. */
function frontmatterEnd(lines: readonly string[]): number {
  return lines.findIndex((line, i) => i > 0 && line.trim() === "---");
}

export interface Skill {
  plugin: string;
  name: string;
  /** Absolute path of the skill folder. */
  dir: string;
  /** Repo-relative path of SKILL.md. */
  path: string;
  text: string;
  parsed: ParsedSkillFile;
}

export function skillsDir(root: string, plugin: string): string {
  return join(root, "plugins", plugin, "skills");
}

/** Every `plugins/<plugin>/skills/<skill>/SKILL.md`. Folders without a SKILL.md are left to the lint. */
export async function loadSkills(root: string, plugins: readonly string[]): Promise<Skill[]> {
  const skills: Skill[] = [];
  for (const plugin of plugins) {
    const base = skillsDir(root, plugin);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const dir = join(base, entry.name);
      const file = join(dir, "SKILL.md");
      let text;
      try {
        text = await readFile(file, "utf8");
      } catch {
        continue;
      }
      skills.push({ plugin, name: entry.name, dir, path: relative(root, file), text, parsed: parseSkillFile(text) });
    }
  }
  return skills;
}

/** First sentence of a skill description, for tables. */
export function summary(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  const match = /^(.+?(?<!\b(?:e\.g|i\.e|vs|cf|incl))[.!?])(?=\s+[A-Z`"'(\[]|$)/.exec(text);
  return match?.[1] ?? text;
}
