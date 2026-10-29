import { lstat, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, type Zippable } from "fflate";

// Limits from the OpenAI plugin upload.
const MAX_ENTRIES = 5000;
const MAX_SEGMENTS = 20;
const MAX_ENTRY_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;

/** What an OpenAI upload contains: the portable manifest, its MCP config, skills and assets. */
const INCLUDE = ["plugin.json", "mcp.json", "skills", "assets"];
const JUNK_FILES = new Set([".DS_Store", "Thumbs.db", "desktop.ini", "__MACOSX"]);

export interface ZipFile {
  /** Path inside the archive, with forward slashes. */
  path: string;
  data: Uint8Array;
}

async function collect(dir: string, prefix: string, out: ZipFile[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (JUNK_FILES.has(entry.name)) continue;
    const path = `${prefix}${entry.name}`;
    const abs = join(dir, entry.name);
    const info = await lstat(abs);
    if (info.isSymbolicLink()) throw new Error(`${path} is a symlink; the upload only accepts regular files`);
    if (entry.name.startsWith(".")) throw new Error(`${path} is hidden; remove it from the plugin`);
    if (info.isDirectory()) await collect(abs, `${path}/`, out);
    else out.push({ path, data: await readFile(abs) });
  }
}

/** Files for a plugin's OpenAI upload, sorted, with the plugin folder as the archive root. */
export async function collectUploadFiles(pluginDir: string): Promise<ZipFile[]> {
  const files: ZipFile[] = [];
  for (const name of INCLUDE) {
    const abs = join(pluginDir, name);
    const info = await lstat(abs).catch(() => undefined);
    if (!info) continue;
    if (info.isSymbolicLink()) throw new Error(`${name} is a symlink; the upload only accepts regular files`);
    if (info.isDirectory()) await collect(abs, `${name}/`, files);
    else files.push({ path: name, data: await readFile(abs) });
  }

  if (!files.some((f) => f.path === "plugin.json")) throw new Error("plugin.json is missing; run `pnpm generate`");
  if (!files.some((f) => /^skills\/[^/]+\/SKILL\.md$/.test(f.path))) throw new Error("the upload needs at least one skill");
  if (files.length > MAX_ENTRIES) throw new Error(`${files.length} files; the upload allows ${MAX_ENTRIES}`);
  let total = 0;
  for (const file of files) {
    if (file.path.split("/").length > MAX_SEGMENTS) throw new Error(`${file.path} is nested too deeply`);
    if (file.data.byteLength > MAX_ENTRY_BYTES) throw new Error(`${file.path} is over 100 MiB`);
    total += file.data.byteLength;
  }
  if (total > MAX_TOTAL_BYTES) throw new Error("the plugin is over 512 MiB uncompressed");
  return files;
}

/** A byte-for-byte reproducible ZIP: sorted entries and a fixed timestamp. */
export function buildZip(files: readonly ZipFile[]): Uint8Array {
  // ZIP timestamps are local time; 1980-01-01 is the earliest the format stores.
  const offsetMs = new Date(1980, 0, 1).getTimezoneOffset() * 60_000;
  const mtime = new Date(Date.UTC(1980, 0, 1) + offsetMs);
  const zippable: Zippable = {};
  for (const file of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    zippable[file.path] = [file.data, { mtime, level: 9 }];
  }
  return zipSync(zippable);
}
