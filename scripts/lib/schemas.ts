import { Ajv2020 } from "ajv/dist/2020.js";
import pluginSchema from "../schemas/agent-plugins-1.0.0/plugin.schema.json" with { type: "json" };
import mcpSchema from "../schemas/agent-plugins-1.0.0/mcp.schema.json" with { type: "json" };

// Copies of https://agent-plugins.org/schemas/1.0.0/{plugin,mcp}.schema.json, the format OpenAI reads.
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = {
  plugin: ajv.compile(pluginSchema),
  mcp: ajv.compile(mcpSchema),
};

/** Schema errors for a generated Agent Plugins `plugin.json` or `mcp.json`, or an empty list. */
export function agentPluginSchemaErrors(kind: keyof typeof validators, value: unknown): string[] {
  const validate = validators[kind];
  if (validate(value)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`);
}
