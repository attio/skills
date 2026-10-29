import type { Config, PluginConfig } from "./config.ts";
import { repositoryUrl } from "./config.ts";
import type { Skill } from "./skills.ts";
import { summary } from "./skills.ts";

export const AGENT_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const AGENT_PLUGIN_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

/** MCP config files the generator removes when a plugin has no MCP server. */
export function mcpFiles(plugin: PluginConfig): string[] {
  return [`plugins/${plugin.name}/mcp.json`, `plugins/${plugin.name}/.mcp.json`];
}

export const ROOT_README = "README.md";

function hasMcp(plugin: PluginConfig): boolean {
  return Object.keys(plugin.mcpServers).length > 0;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function claudeCategory(plugin: PluginConfig): string {
  if (plugin.claudeCategory !== undefined) return plugin.claudeCategory;
  return plugin.category === "Developer Tools" ? "development" : plugin.category.toLowerCase().replace(/\W+/g, "-");
}

/** Each plugin installs from its folder in this repo. */
function gitSource(plugin: PluginConfig, url: string) {
  return {
    source: "git-subdir",
    url,
    path: `plugins/${plugin.name}`,
  };
}

/** OpenAI and Codex manifest, in the portable Agent Plugins format. */
function openaiManifest(config: Config, plugin: PluginConfig) {
  const { openai } = plugin;
  const interfaceFields = {
    displayName: plugin.displayName,
    shortDescription: openai.shortDescription,
    longDescription: openai.longDescription,
    developerName: config.author.name,
    category: plugin.category,
    capabilities: openai.capabilities,
    websiteURL: config.links.website,
    supportURL: config.links.support,
    privacyPolicyURL: config.links.privacyPolicy,
    termsOfServiceURL: plugin.termsOfService ?? config.links.termsOfService,
    defaultPrompt: openai.defaultPrompts.length > 0 ? openai.defaultPrompts : undefined,
    brandColor: openai.brandColor,
    composerIcon: openai.composerIcon,
    logo: openai.logo,
  };
  const review = openai.review && {
    test_cases: {
      positive: openai.review.positive.map((c) => ({
        description: c.description,
        prompt: c.prompt,
        tools_triggered: c.toolsTriggered.join(", "),
        expected_behavior: c.expectedBehavior,
      })),
      negative: openai.review.negative.map((c) => ({ description: c.description, prompt: c.prompt })),
    },
    demo_recording_url: openai.review.demoRecordingUrl,
    commerce: openai.review.commerce,
    commerce_description: openai.review.commerceDescription,
  };
  return {
    $schema: AGENT_PLUGIN_SCHEMA,
    name: plugin.name,
    version: config.version,
    description: plugin.description,
    author: config.author,
    homepage: config.links.website,
    repository: repositoryUrl(config),
    license: config.license,
    keywords: plugin.keywords,
    extensions: {
      "com.openai": {
        interface: interfaceFields,
        onboardingSkill: openai.onboardingSkill && `./skills/${openai.onboardingSkill}/SKILL.md`,
        review,
      },
    },
  };
}

function claudeManifest(config: Config, plugin: PluginConfig) {
  return {
    name: plugin.name,
    displayName: plugin.displayName,
    version: config.version,
    description: plugin.description,
    author: config.author,
    homepage: config.links.website,
    repository: repositoryUrl(config),
    license: config.license,
    keywords: plugin.keywords,
    documentationUrl: config.links.documentation,
    supportUrl: config.links.support,
    privacyPolicyUrl: config.links.privacyPolicy,
    termsOfServiceUrl: plugin.termsOfService ?? config.links.termsOfService,
    icon: plugin.icon,
  };
}

function openaiMcpConfig(plugin: PluginConfig) {
  const servers = Object.fromEntries(
    Object.entries(plugin.mcpServers).map(([name, server]) => [name, { type: "streamable-http", url: server.url }]),
  );
  return { $schema: AGENT_PLUGIN_MCP_SCHEMA, mcpServers: servers };
}

function claudeMcpConfig(plugin: PluginConfig) {
  const servers = Object.fromEntries(
    Object.entries(plugin.mcpServers).map(([name, server]) => [name, { type: "http", url: server.url }]),
  );
  return { mcpServers: servers };
}

function codexMarketplace(config: Config) {
  return {
    name: config.marketplace.name,
    interface: { displayName: config.marketplace.displayName },
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      // Codex needs these fields to display the listing before the plugin is installed.
      description: plugin.description,
      interface: { displayName: plugin.displayName },
      category: plugin.category,
      source: gitSource(plugin, `${repositoryUrl(config)}.git`),
      policy: {
        installation: "AVAILABLE",
        authentication: hasMcp(plugin) ? "ON_INSTALL" : "ON_USE",
      },
    })),
  };
}

function claudeMarketplace(config: Config) {
  return {
    name: config.marketplace.name,
    owner: { name: config.author.name, url: config.author.url },
    description: config.marketplace.description,
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      // Claude Code reads plugin.json for relative sources; Git sources need these fields in the listing.
      displayName: plugin.displayName,
      description: plugin.description,
      author: config.author,
      homepage: config.links.website,
      repository: repositoryUrl(config),
      license: config.license,
      category: claudeCategory(plugin),
      keywords: plugin.keywords,
      source: gitSource(plugin, `${repositoryUrl(config)}.git`),
    })),
  };
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function skillsTable(skills: readonly Skill[]): string {
  if (skills.length === 0) return "No skills yet.";
  const rows = skills.map((skill) => {
    const description = skill.frontmatter?.["description"];
    const text = typeof description === "string" ? summary(description) : "";
    return `| \`${skill.plugin}\` | [\`${skill.name}\`](plugins/${skill.plugin}/skills/${skill.name}/SKILL.md) | ${escapeCell(text)} |`;
  });
  return ["| Plugin | Skill | Description |", "| --- | --- | --- |", ...rows].join("\n");
}

function pluginsTable(config: Config): string {
  const rows = config.plugins.map((p) => `| [\`${p.name}\`](plugins/${p.name}) | ${escapeCell(p.description)} |`);
  return ["| Plugin | Description |", "| --- | --- |", ...rows].join("\n");
}

function installBlock(config: Config): string {
  const marketplace = config.marketplace.name;
  const claude = config.plugins.map((p) => `/plugin install ${p.name} --marketplace ${config.repository}`);
  const codex = [
    `codex plugin marketplace add ${config.repository}`,
    ...config.plugins.map((p) => `codex plugin add ${p.name}@${marketplace}`),
  ];
  return ["In Claude Code:", "", "```", ...claude, "```", "", "In Codex:", "", "```", ...codex, "```"].join("\n");
}

/** Replaces each `<!-- BEGIN GENERATED: name -->` ... `<!-- END GENERATED: name -->` section. */
export function renderSections(current: string, sections: Record<string, string>, path: string): string {
  let text = current;
  for (const [name, content] of Object.entries(sections)) {
    const begin = `<!-- BEGIN GENERATED: ${name} -->`;
    const end = `<!-- END GENERATED: ${name} -->`;
    const start = text.indexOf(begin);
    const stop = text.indexOf(end);
    if (start === -1 || stop === -1 || stop < start) {
      throw new Error(`${path} needs a "${begin}" line followed by a "${end}" line`);
    }
    text = `${text.slice(0, start + begin.length)}\n${content}\n${text.slice(stop)}`;
  }
  return text;
}

/**
 * Every generated file, keyed by repo-relative path. `readme` is the current README text, because only its
 * marked sections are generated.
 */
export function buildOutputs(config: Config, skills: readonly Skill[], readme: string): Map<string, string> {
  const outputs = new Map<string, string>();
  for (const plugin of config.plugins) {
    const dir = `plugins/${plugin.name}`;
    outputs.set(`${dir}/plugin.json`, json(openaiManifest(config, plugin)));
    outputs.set(`${dir}/.claude-plugin/plugin.json`, json(claudeManifest(config, plugin)));
    if (hasMcp(plugin)) {
      outputs.set(`${dir}/mcp.json`, json(openaiMcpConfig(plugin)));
      outputs.set(`${dir}/.mcp.json`, json(claudeMcpConfig(plugin)));
    }
  }
  const sections = { plugins: pluginsTable(config), skills: skillsTable(skills), install: installBlock(config) };
  outputs.set(ROOT_README, renderSections(readme, sections, ROOT_README));
  outputs.set(".agents/plugins/marketplace.json", json(codexMarketplace(config)));
  outputs.set(".claude-plugin/marketplace.json", json(claudeMarketplace(config)));
  return outputs;
}
