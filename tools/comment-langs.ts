// Coded by @sr-engineer
// Language registry for the comment-length scan: extension -> lexer + tag rule.
// Design: specs/e259-comment-scan-languages-architecture.md.

import type { LangSpec } from "./comment-types.js";
import { jsTags, lexJs } from "./comment-lang-js.js";

export const jsLang: LangSpec = Object.freeze({
  id: "js",
  exts: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
  lex: lexJs,
  tags: jsTags,
});

export const langRegistry: readonly LangSpec[] = Object.freeze([jsLang]);

const byExt = new Map<string, LangSpec>(langRegistry.flatMap((l) => l.exts.map((e) => [e, l] as const)));

export function langForPath(rel: string): LangSpec | null {
  const segs = rel.split("/");
  if (segs.some((seg) => seg === "dist" || seg === "node_modules")) return null;
  const base = segs[segs.length - 1];
  if (/\.d\.[cm]?ts$/.test(base)) return null;
  const ext = /\.[^./]+$/.exec(base);
  return ext === null ? null : byExt.get(ext[0]) ?? null;
}

export function scannedExtensions(): string[] {
  return langRegistry.flatMap((l) => l.exts).sort();
}
