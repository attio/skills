import { rmSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseConfig, type Config } from "./config.ts";

/** A config with one MCP plugin and one plain plugin, for tests. */
export function testConfig(): Config {
  return parseConfig({
    version: "1.2.3",
    repository: "example/plugins",
    author: { name: "Example", url: "https://example.com" },
    links: { website: "https://example.com" },
    marketplace: { name: "example", displayName: "Example", description: "Example plugins." },
    plugins: [
      {
        name: "crm",
        displayName: "CRM",
        description: "Work with the CRM.",
        category: "Business & Operations",
        claudeCategory: "sales",
        mcpServers: { crm: { url: "https://mcp.example.com/mcp" } },
        listed: true,
        openai: {
          shortDescription: "Work with the CRM",
          longDescription: "Work with the CRM.",
          onboardingSkill: "setup",
        },
      },
      {
        name: "crm-dev",
        displayName: "CRM for developers",
        description: "Build CRM apps.",
        category: "Developer Tools",
        listed: false,
        termsOfService: "https://example.com/developer-terms",
        openai: { shortDescription: "Build CRM apps", longDescription: "Build CRM apps." },
      },
    ],
  });
}

export function skillFile(name: string): string {
  return `---\nname: ${name}\ndescription: Does the thing. Use when the user asks for the thing.\n---\n\n# Skill\n\nDo the thing.\n`;
}

const roots: string[] = [];
process.on("exit", () => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/** Creates a temporary file tree and removes it when the test process exits. */
export async function fixtureRepo(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "attio-plugins-test-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}
