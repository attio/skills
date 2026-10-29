import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseDocument } from "yaml";

export interface ParsedSkillFile {
  /** Parsed frontmatter, or undefined when it is missing or doesn't parse. */
  data: Record<string, unknown> | undefined;
}

/** Parses the YAML frontmatter at the top of SKILL.md. */
export function parseSkillFile(source: string): ParsedSkillFile {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const end = frontmatterEnd(lines);
  if (lines[0]?.trimEnd() !== "---" || end === -1) return { data: undefined };
  const doc = parseDocument(lines.slice(1, end).join("\n"));
  const data = doc.errors.length > 0 ? undefined : (doc.toJS() as unknown);
  if (data === null || typeof data !== "object" || Array.isArray(data)) return { data: undefined };
  return { data: data as Record<string, unknown> };
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

/** Every `plugins/<plugin>/skills/<skill>/SKILL.md`. Folders without a SKILL.md are skipped. */
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
