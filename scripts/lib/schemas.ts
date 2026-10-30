import { Ajv2020, type AnySchema } from "ajv/dist/2020.js";
import { AGENT_PLUGIN_MCP_SCHEMA, AGENT_PLUGIN_SCHEMA } from "./manifests.ts";

type SchemaErrors = (kind: "plugin" | "mcp", value: unknown) => string[];

/**
 * Downloads the Agent Plugins 1.0.0 schemas, the format OpenAI reads, and returns a function that lists the
 * schema errors for a generated `plugin.json` or `mcp.json`.
 */
export async function loadAgentPluginSchemas(): Promise<SchemaErrors> {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const load = async (url: string) => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return ajv.compile((await response.json()) as AnySchema);
    } catch (e) {
      throw new Error(`Couldn't download ${url}: ${(e as Error).message}`);
    }
  };
  const validators = { plugin: await load(AGENT_PLUGIN_SCHEMA), mcp: await load(AGENT_PLUGIN_MCP_SCHEMA) };
  return (kind, value) => {
    const validate = validators[kind];
    if (validate(value)) return [];
    return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
  };
}
