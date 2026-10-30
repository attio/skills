import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface Diagnostic {
  /** Repo-relative path. */
  file: string;
  message: string;
}

export const error = (file: string, message: string): Diagnostic => ({ file, message });

/** Prints diagnostics (as annotations on GitHub Actions) and returns the exit code. */
export function report(diagnostics: readonly Diagnostic[], ok: string): number {
  const github = process.env["GITHUB_ACTIONS"] === "true";
  for (const d of [...diagnostics].sort((a, b) => a.file.localeCompare(b.file))) {
    console.log(github ? `::error file=${d.file}::${d.message.replace(/\n/g, "%0A")}` : `${d.file}: error: ${d.message}`);
  }
  if (diagnostics.length > 0) {
    console.log(`\n${diagnostics.length} error(s)`);
    return 1;
  }
  console.log(ok);
  return 0;
}
