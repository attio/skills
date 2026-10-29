/** Sets `version` or `published` in the text of plugin.config.ts, adding `published` under `version` if it's missing. */
export function setReleaseField(text: string, field: "version" | "published", value: string): string {
  const line = new RegExp(`^(\\s*)${field}: "[^"]*",$`, "m");
  if (line.test(text)) return text.replace(line, `$1${field}: "${value}",`);
  const version = /^(\s*)version: "[^"]*",$/m;
  if (field === "published" && version.test(text)) {
    return text.replace(version, (match, indent: string) => `${match}\n${indent}published: "${value}",`);
  }
  throw new Error(`plugin.config.ts has no \`${field}: "…",\` line to update`);
}
