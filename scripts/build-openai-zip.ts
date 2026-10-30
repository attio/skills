// Builds the OpenAI upload ZIP for each listed plugin into dist/.
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "./lib/config.ts";
import { ROOT } from "./lib/report.ts";
import { buildZip, collectUploadFiles } from "./lib/zip.ts";

const config = await loadConfig(ROOT);
const outDir = join(ROOT, "dist");
await mkdir(outDir, { recursive: true });

for (const plugin of config.plugins.filter((p) => p.listed)) {
  const files = await collectUploadFiles(join(ROOT, "plugins", plugin.name));
  const zip = buildZip(files);
  const name = `${plugin.name}-${config.version}.zip`;
  await writeFile(join(outDir, name), zip);
  const sha256 = createHash("sha256").update(zip).digest("hex");
  console.log(`dist/${name}  ${files.length} files  ${zip.byteLength} bytes  sha256 ${sha256}`);
}
