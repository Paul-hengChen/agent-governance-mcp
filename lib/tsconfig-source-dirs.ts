// TS source-root extraction from tsconfig `include` (backlog-b6, v3.35.0).
//
// Pure helper consumed by the AC-B5.5 release-staging guard test
// (`test/release-staging.test.mjs`, owned by qa via T-B6-02). It replaces the
// hand-maintained `EXCLUDED_DIRS` heuristic — the exact drift source that let
// `transport/` slip out of release staging in v3.24.0 — with the authoritative
// list already declared in `tsconfig.json` `include`.
//
// MVP scope (see specs/backlog-b6.md → Out of Scope): reads only the direct
// `include` array of the given file. No `extends`-chain resolution, no path
// aliases. Bare-file globs (e.g. "index.ts") are skipped; only dir-level globs
// of the form "<dir>/**/*.ts" or "<dir>/*.ts" produce output.

import { readFileSync } from "node:fs";

interface TsConfigShape {
  include?: unknown;
}

/**
 * Parse a `tsconfig.json` `include` array and return the unique top-level
 * source directory names it references.
 *
 * For each glob entry containing a `/`, the leading segment before the first
 * `/` is taken as the directory name (no trailing slash — the guard appends
 * its own). Bare-file entries with no `/` (e.g. "index.ts") are skipped.
 * Non-string entries and a missing/non-array `include` yield an empty result.
 *
 * @param tsconfigPath Absolute path to a `tsconfig.json` file.
 * @returns Deduplicated directory names, in first-seen order.
 */
export function getTsConfigSourceDirs(tsconfigPath: string): string[] {
  const raw = readFileSync(tsconfigPath, "utf8");
  const parsed = JSON.parse(raw) as TsConfigShape;
  const include = parsed.include;

  if (!Array.isArray(include)) {
    return [];
  }

  const dirs: string[] = [];
  const seen = new Set<string>();

  for (const entry of include) {
    if (typeof entry !== "string") {
      continue;
    }
    const slashIndex = entry.indexOf("/");
    if (slashIndex <= 0) {
      // No "/" (bare file like "index.ts") or a leading "/" (no dir segment).
      continue;
    }
    const dir = entry.slice(0, slashIndex);
    if (!seen.has(dir)) {
      seen.add(dir);
      dirs.push(dir);
    }
  }

  return dirs;
}
