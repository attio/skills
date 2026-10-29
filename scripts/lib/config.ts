import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { z } from "zod";

const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const name = z.string().max(64).regex(NAME_PATTERN, "use lowercase letters, digits and single hyphens");
const httpsUrl = z.url({ protocol: /^https$/, error: "must be an https:// URL" });
const assetPath = z.string().regex(/^\.\/assets\/[^/]+$/, "must be a file directly under ./assets/");
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "must be #RRGGBB");

const positiveTestCase = z.strictObject({
  description: z.string().min(1),
  prompt: z.string().min(1),
  /** MCP tools the prompt is expected to call. */
  toolsTriggered: z.array(z.string().min(1)).min(1),
  expectedBehavior: z.string().min(1),
});

const negativeTestCase = z.strictObject({
  description: z.string().min(1),
  prompt: z.string().min(1),
});

/**
 * OpenAI listing fields, written to `extensions["com.openai"]`.
 * @see https://developers.openai.com/plugins/deploy/submission#prepare-metadata-in-pluginjson for the requirements.
 */
const openai = z.strictObject({
  /** Directory listing subtitle. */
  shortDescription: z.string().min(1).max(30),
  longDescription: z.string().min(1).max(4000),
  capabilities: z.array(z.string().min(1).max(120)).max(20).default([]),
  defaultPrompts: z.array(z.string().min(1).max(128)).max(3).default([]),
  brandColor: hexColor.optional(),
  logo: assetPath.optional(),
  composerIcon: assetPath.optional(),
  /** Name of the skill that runs when a user sets the plugin up. */
  onboardingSkill: name.optional(),
  review: z
    .strictObject({
      positive: z.array(positiveTestCase).default([]),
      negative: z.array(negativeTestCase).default([]),
      demoRecordingUrl: httpsUrl.optional(),
      commerce: z.boolean().default(false),
      commerceDescription: z.string().min(1).optional(),
    })
    .optional(),
});

const plugin = z.strictObject({
  name,
  displayName: z.string().min(1).max(30),
  description: z.string().min(1).max(1024),
  keywords: z.array(z.string().min(1)).default([]),
  /**
   * Listing category, such as "Productivity".
   * @see https://developers.openai.com/plugins/deploy/submission-errors for the categories OpenAI accepts.
   */
  category: z.string().min(1),
  /**
   * Claude Code marketplace category, which is free-form. Defaults to `category` in lowercase with hyphens, or
   * `development` for Developer Tools.
   */
  claudeCategory: z
    .string()
    .regex(/^[a-z]+(-[a-z]+)*$/, "use lowercase words and hyphens")
    .optional(),
  /** Remote MCP servers the plugin connects to. Hosts handle sign-in. */
  mcpServers: z.record(name, z.strictObject({ url: httpsUrl })).default({}),
  /** Listed plugins get an OpenAI upload ZIP. */
  listed: z.boolean(),
  /** Overrides `links.termsOfService` for this plugin. */
  termsOfService: httpsUrl.optional(),
  /** Claude directory listing icon: a square PNG or JPEG, 512 to 2048 px. */
  icon: z
    .string()
    .regex(/^\.\/assets\/[^/]+\.(png|jpe?g)$/i, "must be a PNG or JPEG directly under ./assets/")
    .optional(),
  openai,
});

const configSchema = z
  .strictObject({
    /** The version of every plugin. */
    version: z.string().regex(SEMVER_PATTERN, "must be MAJOR.MINOR.PATCH"),
    /** GitHub repository that hosts the marketplace, as `owner/name`. */
    repository: z.string().regex(/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/),
    author: z.strictObject({ name: z.string().min(1), url: httpsUrl }),
    license: z.string().min(1).optional(),
    links: z.strictObject({
      website: httpsUrl,
      documentation: httpsUrl.optional(),
      support: httpsUrl.optional(),
      privacyPolicy: httpsUrl.optional(),
      termsOfService: httpsUrl.optional(),
    }),
    marketplace: z.strictObject({
      name,
      displayName: z.string().min(1),
      description: z.string().min(1),
    }),
    plugins: z.array(plugin).min(1),
  })
  .superRefine((config, ctx) => {
    const seen = new Set<string>();
    config.plugins.forEach((p, i) => {
      if (seen.has(p.name)) {
        ctx.addIssue({ code: "custom", path: ["plugins", i, "name"], message: `duplicate plugin "${p.name}"` });
      }
      seen.add(p.name);
      if (Object.keys(p.mcpServers).length > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["plugins", i, "mcpServers"],
          message: "a plugin can connect to one MCP server",
        });
      }
    });
  });

export type ConfigInput = z.input<typeof configSchema>;
export type Config = z.output<typeof configSchema>;
export type PluginConfig = Config["plugins"][number];

/** Typed helper for `plugin.config.ts`. */
export function defineConfig(config: ConfigInput): ConfigInput {
  return config;
}

export function parseConfig(input: unknown): Config {
  const result = configSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`plugin.config.ts is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export async function loadConfig(root: string): Promise<Config> {
  const mod = (await import(pathToFileURL(join(root, "plugin.config.ts")).href)) as { default: unknown };
  return parseConfig(mod.default);
}

export function repositoryUrl(config: Config): string {
  return `https://github.com/${config.repository}`;
}
