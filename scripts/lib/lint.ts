import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Config, PluginConfig } from "./config.ts";
import { NAME_PATTERN } from "./config.ts";
import { error, type Diagnostic } from "./report.ts";
import { frontmatterKeyLine, skillsDir, type Skill } from "./skills.ts";

// The Agent Skills fields that every host accepts. `compatibility` is in the spec but OpenAI's validator rejects it.
const ALLOWED_KEYS = new Set(["name", "description", "license", "metadata", "allowed-tools"]);
const MAX_NAME = 64;
const MAX_DESCRIPTION = 1024;

// Clients load hooks, commands, agents and executables from other folders without a manifest entry, so a
// plugin holds only these.
const PLUGIN_ENTRIES = new Set(["README.md", "LICENSE", "plugin.json", "mcp.json", ".mcp.json", ".claude-plugin", "skills", "assets"]);
const IGNORED = new Set([".DS_Store", "Thumbs.db", "desktop.ini", "__MACOSX"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

/** The frontmatter rules every client agrees on. Some clients drop a skill silently when these fail. */
function lintFrontmatter(skill: Skill, config: Config): Diagnostic[] {
  const out: Diagnostic[] = [];
  const { path, parsed } = skill;
  for (const issue of parsed.issues) out.push(error(path, issue.message, issue.line));
  const data = parsed.data;
  if (!data) return out;
  const at = (key: string) => frontmatterKeyLine(skill.text, key);

  for (const key of Object.keys(data)) {
    if (key === "compatibility") {
      out.push(error(path, "`compatibility` isn't accepted by every host. Describe requirements in the body.", at(key)));
    } else if (!ALLOWED_KEYS.has(key)) {
      out.push(error(path, `unknown frontmatter key \`${key}\`. Allowed: ${[...ALLOWED_KEYS].join(", ")}`, at(key)));
    }
  }

  const name = data["name"];
  if (typeof name !== "string" || name.length === 0) {
    out.push(error(path, "`name` is required", at("name")));
  } else {
    if (!NAME_PATTERN.test(name)) {
      out.push(error(path, "`name` must be lowercase letters, digits and single hyphens", at("name")));
    }
    if (name.length > MAX_NAME) out.push(error(path, `\`name\` must be ${MAX_NAME} characters or fewer`, at("name")));
    if (name !== skill.name) {
      out.push(error(path, `\`name\` must match its folder name \`${skill.name}\``, at("name")));
    }
    if (/anthropic|claude/.test(name)) out.push(error(path, "`name` can't contain `anthropic` or `claude`", at("name")));
    const identity = `${skill.plugin}:${name}`;
    if (identity.length > MAX_NAME) {
      out.push(error(path, `\`${identity}\` must be ${MAX_NAME} characters or fewer`, at("name")));
    }
  }

  const description = data["description"];
  if (typeof description !== "string" || description.trim().length === 0) {
    out.push(error(path, "`description` must be a non-empty string", at("description")));
  } else {
    const length = [...description].length;
    if (length > MAX_DESCRIPTION) {
      out.push(error(path, `\`description\` is ${length} characters; the limit is ${MAX_DESCRIPTION}`, at("description")));
    }
    if (/[<>]/.test(description)) out.push(error(path, "`description` can't contain `<` or `>`", at("description")));
  }

  if ("license" in data && typeof data["license"] !== "string") {
    out.push(error(path, "`license` must be a string", at("license")));
  }
  if ("allowed-tools" in data && typeof data["allowed-tools"] !== "string") {
    out.push(error(path, "`allowed-tools` must be a space-separated string", at("allowed-tools")));
  }
  if ("metadata" in data) {
    const metadata = data["metadata"];
    if (!isRecord(metadata) || Object.keys(metadata).length === 0) {
      out.push(error(path, "`metadata` must be a non-empty mapping", at("metadata")));
    } else {
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value !== "string") {
          out.push(error(path, `\`metadata.${key}\` must be a string. Quote numbers and booleans.`, at("metadata")));
        }
      }
    }
  }

  const plugin = config.plugins.find((p) => p.name === skill.plugin);
  const tools = isRecord(data["metadata"]) ? data["metadata"]["mcp-tools"] : undefined;
  if (tools !== undefined && plugin && Object.keys(plugin.mcpServers).length === 0) {
    out.push(error(path, `\`metadata.mcp-tools\` is set, but plugin \`${plugin.name}\` has no MCP server`, at("metadata")));
  }
  return out;
}

/** The skills folder holds only skill folders, each with a SKILL.md. */
async function lintSkillsFolder(root: string, plugin: PluginConfig, skills: readonly Skill[]): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  const base = skillsDir(root, plugin.name);
  const rel = relative(root, base);
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return [error(rel, "plugin has no skills folder")];
  }
  for (const entry of entries) {
    const path = `${rel}/${entry.name}`;
    if (IGNORED.has(entry.name)) continue;
    if (entry.name.startsWith(".")) out.push(error(path, "skill folders can't be hidden"));
    else if (!entry.isDirectory()) out.push(error(path, "only skill folders belong in skills/"));
    else if (!skills.some((s) => s.plugin === plugin.name && s.name === entry.name)) {
      const lower = await exists(join(base, entry.name, "skill.md"));
      out.push(error(path, lower ? "rename skill.md to SKILL.md" : "skill folder has no SKILL.md"));
    }
  }
  if (!skills.some((s) => s.plugin === plugin.name)) out.push(error(rel, "plugin has no skills"));
  return out;
}

/** A plugin holds only skills, assets, a README and generated manifests. */
async function lintPluginEntries(root: string, plugin: PluginConfig): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  const dir = join(root, "plugins", plugin.name);
  for (const entry of await readdir(dir)) {
    if (!PLUGIN_ENTRIES.has(entry) && !IGNORED.has(entry)) {
      out.push(error(`plugins/${plugin.name}/${entry}`, "plugins hold only skills, assets, a README and generated manifests"));
    }
  }
  for (const entry of await readdir(join(dir, ".claude-plugin")).catch(() => [])) {
    if (entry !== "plugin.json") out.push(error(`plugins/${plugin.name}/.claude-plugin/${entry}`, "only plugin.json belongs here"));
  }
  return out;
}

export async function lintRepo(root: string, config: Config, skills: readonly Skill[]): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  for (const skill of skills) out.push(...lintFrontmatter(skill, config));

  const byName = new Map<string, Skill>();
  for (const skill of skills) {
    const other = byName.get(skill.name);
    if (other) out.push(error(skill.path, `skill name \`${skill.name}\` is also used by ${other.path}`));
    byName.set(skill.name, skill);
  }

  for (const plugin of config.plugins) {
    out.push(...(await lintSkillsFolder(root, plugin, skills)), ...(await lintPluginEntries(root, plugin)));
    const onboarding = plugin.openai.onboardingSkill;
    if (onboarding && !skills.some((s) => s.plugin === plugin.name && s.name === onboarding)) {
      out.push(error("plugin.config.ts", `onboarding skill \`${onboarding}\` isn't in plugins/${plugin.name}/skills`));
    }
    const assets = { "openai.logo": plugin.openai.logo, "openai.composerIcon": plugin.openai.composerIcon, icon: plugin.icon };
    for (const [field, path] of Object.entries(assets)) {
      if (path && !(await exists(join(root, "plugins", plugin.name, path)))) {
        out.push(error("plugin.config.ts", `${plugin.name}: \`${field}\` ${path} doesn't exist in plugins/${plugin.name}`));
      }
    }
  }
  return out;
}
