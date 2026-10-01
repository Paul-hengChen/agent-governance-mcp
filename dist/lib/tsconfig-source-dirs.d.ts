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
export declare function getTsConfigSourceDirs(tsconfigPath: string): string[];
//# sourceMappingURL=tsconfig-source-dirs.d.ts.map