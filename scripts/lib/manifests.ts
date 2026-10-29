import type { Config, PluginConfig } from "./config.ts";
import { repositoryUrl } from "./config.ts";
import type { Skill } from "./skills.ts";
import { summary } from "./skills.ts";

export const AGENT_PLUGIN_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
export const AGENT_PLUGIN_MCP_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json";

/** Files the generator owns, relative to the repo root. */
export const MARKETPLACE_FILES = [".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json"] as const;

export function pluginFiles(plugin: PluginConfig): string[] {
  const dir = `plugins/${plugin.name}`;
  const files = [`${dir}/plugin.json`, `${dir}/.claude-plugin/plugin.json`];
  if (hasMcp(plugin)) files.push(`${dir}/mcp.json`, `${dir}/.mcp.json`);
  return files;
}

/** MCP config files the generator removes when a plugin has no MCP server. */
export function mcpFiles(plugin: PluginConfig): string[] {
  return [`plugins/${plugin.name}/mcp.json`, `plugins/${plugin.name}/.mcp.json`];
}

export const ROOT_README = "README.md";

export function pluginReadme(plugin: PluginConfig): string {
  return `plugins/${plugin.name}/README.md`;
}

function hasMcp(plugin: PluginConfig): boolean {
  return Object.keys(plugin.mcpServers).length > 0;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Claude plugin categories are free-form; use lowercase names that match the Claude directory. */
function claudeCategory(plugin: PluginConfig): string {
  return plugin.category === "Developer Tools" ? "development" : plugin.category.toLowerCase().replace(/\W+/g, "-");
}

/** The published release, as its tag and the commit the tag points at. */
export interface Published {
  tag: string;
  commit: string;
}

/**
 * Each plugin installs from its folder at the published release. Pinning the commit as well as the tag
 * means a moved tag, or a branch with the same name, can't change what users install.
 */
function gitSource(plugin: PluginConfig, url: string, published: Published | undefined) {
  return {
    source: "git-subdir",
    url,
    path: `plugins/${plugin.name}`,
    ref: published?.tag,
    sha: published?.commit,
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
        tools_triggered: c.toolsTriggered.join(" "),
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

function codexMarketplace(config: Config, published: Published | undefined) {
  return {
    name: config.marketplace.name,
    interface: { displayName: config.marketplace.displayName },
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      // Codex only reads the plugin's own manifest after install, so the browser shows these fields.
      description: plugin.description,
      interface: { displayName: plugin.displayName },
      category: plugin.category,
      source: gitSource(plugin, `${repositoryUrl(config)}.git`, published),
      policy: {
        installation: "AVAILABLE",
        authentication: hasMcp(plugin) ? "ON_INSTALL" : "ON_USE",
      },
    })),
  };
}

function claudeMarketplace(config: Config, published: Published | undefined) {
  return {
    name: config.marketplace.name,
    owner: { name: config.author.name, url: config.author.url },
    description: config.marketplace.description,
    plugins: config.plugins.map((plugin) => ({
      name: plugin.name,
      // Claude Code only reads plugin.json for relative sources, so the listing shows these fields.
      displayName: plugin.displayName,
      description: plugin.description,
      author: config.author,
      homepage: config.links.website,
      repository: repositoryUrl(config),
      license: config.license,
      category: claudeCategory(plugin),
      keywords: plugin.keywords,
      source: gitSource(plugin, `${repositoryUrl(config)}.git`, published),
    })),
  };
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function skillsTable(skills: readonly Skill[]): string {
  if (skills.length === 0) return "No skills yet.";
  const rows = skills.map((skill) => {
    const description = skill.parsed.data?.["description"];
    const text = typeof description === "string" ? summary(description) : "";
    return `| [\`${skill.name}\`](skills/${skill.name}/SKILL.md) | ${escapeCell(text)} |`;
  });
  return ["| Skill | Description |", "| --- | --- |", ...rows].join("\n");
}

function pluginsTable(config: Config): string {
  const rows = config.plugins.map(
    (p) => `| [\`${p.name}\`](plugins/${p.name}) | ${escapeCell(p.description)} |`,
  );
  return ["| Plugin | Description |", "| --- | --- |", ...rows].join("\n");
}

function installBlock(config: Config, plugins: readonly PluginConfig[]): string {
  const marketplace = config.marketplace.name;
  const claude = plugins.map((p) => `/plugin install ${p.name} --marketplace ${config.repository}`);
  const codex = [
    `codex plugin marketplace add ${config.repository}`,
    ...plugins.map((p) => `codex plugin add ${p.name}@${marketplace}`),
  ];
  return [
    "In Claude Code:",
    "",
    "```",
    ...claude,
    "```",
    "",
    "In Codex:",
    "",
    "```",
    ...codex,
    "```",
  ].join("\n");
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
 * Every generated file, keyed by repo-relative path. `readmes` holds the current README text,
 * because only the marked sections of each README are generated. `published` is the release the
 * marketplaces point at, or undefined before the first release.
 */
export function buildOutputs(
  config: Config,
  skills: readonly Skill[],
  readmes: ReadonlyMap<string, string>,
  published: Published | undefined,
): Map<string, string> {
  const outputs = new Map<string, string>();
  for (const plugin of config.plugins) {
    const dir = `plugins/${plugin.name}`;
    outputs.set(`${dir}/plugin.json`, json(openaiManifest(config, plugin)));
    outputs.set(`${dir}/.claude-plugin/plugin.json`, json(claudeManifest(config, plugin)));
    if (hasMcp(plugin)) {
      outputs.set(`${dir}/mcp.json`, json(openaiMcpConfig(plugin)));
      outputs.set(`${dir}/.mcp.json`, json(claudeMcpConfig(plugin)));
    }
    const readmePath = pluginReadme(plugin);
    const readme = readmes.get(readmePath);
    if (readme === undefined) throw new Error(`${readmePath} is missing`);
    const sections = {
      skills: skillsTable(skills.filter((s) => s.plugin === plugin.name)),
      install: installBlock(config, [plugin]),
    };
    outputs.set(readmePath, renderSections(readme, sections, readmePath));
  }
  const rootReadme = readmes.get(ROOT_README);
  if (rootReadme === undefined) throw new Error(`${ROOT_README} is missing`);
  outputs.set(
    ROOT_README,
    renderSections(rootReadme, { plugins: pluginsTable(config), install: installBlock(config, config.plugins) }, ROOT_README),
  );
  outputs.set(".agents/plugins/marketplace.json", json(codexMarketplace(config, published)));
  outputs.set(".claude-plugin/marketplace.json", json(claudeMarketplace(config, published)));
  return outputs;
}
