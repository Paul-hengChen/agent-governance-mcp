// Coded by @sr-engineer
// Language registry for the comment-length scan: extension -> lexer + tag rule.
// Design: specs/e259-comment-scan-languages-architecture.md.
import { jsTags, lexJs } from "./comment-lang-js.js";
export const jsLang = Object.freeze({
    id: "js",
    exts: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    lex: lexJs,
    tags: jsTags,
});
export const langRegistry = Object.freeze([jsLang]);
const byExt = new Map(langRegistry.flatMap((l) => l.exts.map((e) => [e, l])));
export function langForPath(rel) {
    const segs = rel.split("/");
    if (segs.some((seg) => seg === "dist" || seg === "node_modules"))
        return null;
    const base = segs[segs.length - 1];
    if (/\.d\.[cm]?ts$/.test(base))
        return null;
    const ext = /\.[^./]+$/.exec(base);
    return ext === null ? null : byExt.get(ext[0]) ?? null;
}
export function scannedExtensions() {
    return langRegistry.flatMap((l) => l.exts).sort();
}
//# sourceMappingURL=comment-langs.js.map