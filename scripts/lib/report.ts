import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export interface Diagnostic {
  level: "error" | "warning";
  /** Repo-relative path. */
  file: string;
  line?: number;
  message: string;
}

export const error = (file: string, message: string, line?: number): Diagnostic => ({
  level: "error",
  file,
  line,
  message,
});

export const warning = (file: string, message: string, line?: number): Diagnostic => ({
  level: "warning",
  file,
  line,
  message,
});

/** Prints diagnostics (as annotations on GitHub Actions) and returns the exit code. */
export function report(diagnostics: readonly Diagnostic[], ok: string): number {
  const github = process.env["GITHUB_ACTIONS"] === "true";
  const sorted = [...diagnostics].sort(
    (a, b) => a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0),
  );
  for (const d of sorted) {
    if (github) {
      const line = d.line === undefined ? "" : `,line=${d.line}`;
      console.log(`::${d.level} file=${d.file}${line}::${d.message.replace(/\n/g, "%0A")}`);
    } else {
      console.log(`${d.file}${d.line === undefined ? "" : `:${d.line}`}: ${d.level}: ${d.message}`);
    }
  }
  const errors = diagnostics.filter((d) => d.level === "error").length;
  const warnings = diagnostics.length - errors;
  if (errors > 0) {
    console.log(`\n${errors} error(s), ${warnings} warning(s)`);
    return 1;
  }
  console.log(warnings > 0 ? `${ok} (${warnings} warning(s))` : ok);
  return 0;
}
