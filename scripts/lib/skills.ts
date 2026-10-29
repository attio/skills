import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseDocument } from "yaml";

/** Returns the YAML frontmatter, or undefined if it is missing or invalid. */
export function parseSkillFile(source: string): Record<string, unknown> | undefined {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const end = frontmatterEnd(lines);
  if (lines[0]?.trimEnd() !== "---" || end === -1) return undefined;
  const doc = parseDocument(lines.slice(1, end).join("\n"));
  const data = doc.errors.length > 0 ? undefined : (doc.toJS() as unknown);
  if (data === null || typeof data !== "object" || Array.isArray(data)) return undefined;
  return data as Record<string, unknown>;
}

// Clients treat the first `---` line as the end of frontmatter, even if it is indented.
function frontmatterEnd(lines: readonly string[]): number {
  return lines.findIndex((line, i) => i > 0 && line.trim() === "---");
}

/** 1-based line in SKILL.md where a top-level frontmatter key is defined, or 1 if it isn't. */
export function frontmatterKeyLine(text: string, key: string): number {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const end = frontmatterEnd(lines);
  const i = lines.slice(0, end === -1 ? 1 : end).findIndex((line) => line.startsWith(`${key}:`));
  return i === -1 ? 1 : i + 1;
}

export interface Skill {
  plugin: string;
  name: string;
  frontmatter: Record<string, unknown> | undefined;
}

/** Loads skills from each plugin's skills directory, skipping folders without SKILL.md. */
export async function loadSkills(root: string, plugins: readonly string[]): Promise<Skill[]> {
  const skills: Skill[] = [];
  for (const plugin of plugins) {
    const base = join(root, "plugins", plugin, "skills");
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory()) continue;
      const file = join(base, entry.name, "SKILL.md");
      let text;
      try {
        text = await readFile(file, "utf8");
      } catch {
        continue;
      }
      skills.push({ plugin, name: entry.name, frontmatter: parseSkillFile(text) });
    }
  }
  return skills;
}

/** Text of a string-valued `metadata` key, or undefined. */
export function skillMetadata(skill: Skill, key: string): string | undefined {
  const metadata = skill.parsed.data?.["metadata"];
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/** MCP tools a skill declares in `metadata.mcp-tools`, a space-separated list. */
export function declaredMcpTools(skill: Skill): string[] {
  return (skillMetadata(skill, "mcp-tools") ?? "").split(/\s+/).filter(Boolean);
}

/** First sentence of a skill description, for tables. */
export function summary(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  const match = /^(.+?(?<!\b(?:e\.g|i\.e|vs|cf|incl))[.!?])(?=\s+[A-Z`"'(\[]|$)/.exec(text);
  return match?.[1] ?? text;
}
