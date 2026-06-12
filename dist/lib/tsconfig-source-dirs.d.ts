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
export declare function getTsConfigSourceDirs(tsconfigPath: string): string[];
//# sourceMappingURL=tsconfig-source-dirs.d.ts.map