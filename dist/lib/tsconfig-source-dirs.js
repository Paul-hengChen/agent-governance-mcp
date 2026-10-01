// TS source-root extraction from tsconfig `include` (backlog-b6, v3.35.0).
// Pure helper for the release-staging guard test: it reads the source dirs that
// `tsconfig.json` `include` already declares, instead of a hand-kept exclusion
// list that once let `transport/` slip out of release staging. Reads only the
// direct `include` array (no `extends` chain, no path aliases); bare-file globs
// are skipped. Rationale and scope: specs/backlog-b6.md.
import { readFileSync } from "node:fs";
/**
 * Return the unique top-level directory names a `tsconfig.json` `include`
 * array references: the segment before the first `/` of each glob, with no
 * trailing slash (the guard appends its own). Bare-file entries such as
 * "index.ts", non-string entries and a missing or non-array `include`
 * contribute nothing.
 *
 * @param tsconfigPath Absolute path to a `tsconfig.json` file.
 * @returns Deduplicated directory names, in first-seen order.
 */
export function getTsConfigSourceDirs(tsconfigPath) {
    const raw = readFileSync(tsconfigPath, "utf8");
    const parsed = JSON.parse(raw);
    const include = parsed.include;
    if (!Array.isArray(include)) {
        return [];
    }
    const dirs = [];
    const seen = new Set();
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
//# sourceMappingURL=tsconfig-source-dirs.js.map