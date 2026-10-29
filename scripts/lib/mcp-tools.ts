import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import type { Config } from "./config.ts";
import { error, warning, type Diagnostic } from "./report.ts";
import { declaredMcpTools, frontmatterKeyLine, type Skill } from "./skills.ts";

export const MCP_TOOLS_FILE = "mcp-tools.json";

const toolsFileSchema = z.strictObject({
  server: z.url(),
  tools: z.array(z.string().min(1)),
});

export type ToolsFile = z.infer<typeof toolsFileSchema>;

export async function loadToolsFile(root: string): Promise<ToolsFile> {
  const text = await readFile(join(root, MCP_TOOLS_FILE), "utf8");
  const result = toolsFileSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error(`${MCP_TOOLS_FILE} is invalid:\n${z.prettifyError(result.error)}`);
  return result.data;
}

async function markdownFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await markdownFiles(path)));
    else if (entry.name.endsWith(".md")) out.push(path);
  }
  return out.sort();
}

/**
 * Skills call MCP tools by name. Each skill lists the tools it uses in `metadata.mcp-tools`; every listed
 * tool must exist on the server, and every tool the skill's text names must be listed.
 */
export async function checkMcpTools(
  root: string,
  config: Config,
  skills: readonly Skill[],
  toolsFile: ToolsFile,
): Promise<Diagnostic[]> {
  const out: Diagnostic[] = [];
  const known = new Set(toolsFile.tools);
  // Whole tool names anywhere in the text, including code blocks and JSON examples.
  const names = [...known].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const toolPattern = new RegExp(`(?<![\\w-])(${names.join("|") || "(?!)"})(?![\\w-])`, "g");
  const servers = config.plugins.flatMap((p) => Object.values(p.mcpServers).map((s) => s.url));
  if (!servers.includes(toolsFile.server)) {
    out.push(error(MCP_TOOLS_FILE, `\`server\` ${toolsFile.server} isn't an MCP server in plugin.config.ts`));
  }

  for (const skill of skills) {
    const declared = declaredMcpTools(skill);
    const line = frontmatterKeyLine(skill.text, "metadata");
    for (const tool of declared) {
      if (!known.has(tool)) out.push(error(skill.path, `MCP tool \`${tool}\` isn't on the MCP server`, line));
    }
    const plugin = config.plugins.find((p) => p.name === skill.plugin);
    const hasServer = plugin !== undefined && Object.keys(plugin.mcpServers).length > 0;

    const mentioned = new Map<string, { file: string; line: number }>();
    for (const file of await markdownFiles(skill.dir)) {
      const isSkill = file === join(skill.dir, "SKILL.md");
      const text = isSkill ? skill.parsed.body : (await readFile(file, "utf8")).replace(/\r\n?/g, "\n");
      const first = isSkill ? skill.parsed.bodyLine : 1;
      text.split("\n").forEach((content, i) => {
        for (const match of content.matchAll(toolPattern)) {
          const tool = match[1] ?? "";
          if (!mentioned.has(tool)) mentioned.set(tool, { file: relative(root, file), line: first + i });
        }
      });
    }
    for (const [tool, where] of mentioned) {
      if (!hasServer) {
        out.push(error(where.file, `\`${tool}\` is an MCP tool, but plugin \`${skill.plugin}\` has no MCP server`, where.line));
      } else if (!declared.includes(tool)) {
        out.push(error(where.file, `\`${tool}\` is an MCP tool. Add it to \`metadata.mcp-tools\` in SKILL.md.`, where.line));
      }
    }
    for (const tool of declared) {
      if (known.has(tool) && !mentioned.has(tool)) {
        out.push(warning(skill.path, `\`metadata.mcp-tools\` lists \`${tool}\`, but the skill never mentions it`, line));
      }
    }
  }

  for (const plugin of config.plugins) {
    for (const [i, testCase] of (plugin.openai.review?.positive ?? []).entries()) {
      for (const tool of testCase.toolsTriggered) {
        if (!known.has(tool)) {
          out.push(error("plugin.config.ts", `${plugin.name} review case ${i + 1}: \`${tool}\` isn't on the MCP server`));
        }
      }
    }
  }
  return out;
}
