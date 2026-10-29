import { pathToFileURL } from "node:url";
import { join } from "node:path";
import { z } from "zod";

/** Plugin, marketplace and skill names: lowercase letters, digits and single hyphens. */
export const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** Listing categories accepted by the OpenAI plugin directory. */
export const OPENAI_CATEGORIES = [
  "Productivity",
  "Creativity",
  "Developer Tools",
  "Business & Operations",
  "Data & Analytics",
  "Communication",
  "Education & Research",
  "Security",
  "Finance",
  "Healthcare",
  "Travel",
  "Entertainment",
  "Other",
] as const;

const name = z.string().max(64).regex(NAME_PATTERN, "use lowercase letters, digits and single hyphens");
const httpsUrl = z.url({ protocol: /^https$/, error: "must be an https:// URL" });
const assetPath = z
  .string()
  .regex(/^\.\/assets\/[^/]+$/, "must be a file directly under ./assets/");
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
  category: z.enum(OPENAI_CATEGORIES),
  /** Remote MCP servers the plugin connects to. Hosts handle sign-in. */
  mcpServers: z.record(name, z.strictObject({ url: httpsUrl })).default({}),
  /** Listed plugins get an OpenAI upload ZIP and are submitted to the plugin directories. */
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

export const configSchema = z
  .strictObject({
    /** The version on main, shared by every plugin. Releasing it means tagging `v<version>`. */
    version: z.string().regex(SEMVER_PATTERN, "must be MAJOR.MINOR.PATCH"),
    /**
     * The released version the marketplaces point at. Set it only after its tag exists. Until the first
     * release it's unset, and the marketplaces install from the default branch.
     */
    published: z.string().regex(SEMVER_PATTERN, "must be MAJOR.MINOR.PATCH").optional(),
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
    if (config.published !== undefined && compareVersions(config.published, config.version) > 0) {
      ctx.addIssue({ code: "custom", path: ["published"], message: "can't be later than `version`" });
    }
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

export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) {
    const diff = (x?.[i] ?? 0) - (y?.[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

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

export function releaseTag(config: Config): string {
  return `v${config.version}`;
}

export function publishedTag(config: Config): string | undefined {
  return config.published === undefined ? undefined : `v${config.published}`;
}

export function repositoryUrl(config: Config): string {
  return `https://github.com/${config.repository}`;
}
