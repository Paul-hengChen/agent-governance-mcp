// Coded by @qa-engineer
// Tests for specs/e259-comment-scan-languages.md AC1-AC15 and AC25: the
// comment scan on brace-family languages, the JS identity proof and the
// extension set. Samples are test/fixtures/e259/*.fixture.txt, written into
// temp repos under their real names at run time.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { analyzeText, isScannablePath } from "../dist/tools/comment-scan.js";
import { langRegistry, langForPath, scannedExtensions } from "../dist/tools/comment-langs.js";
import { PREFIX, check, cleanup, fixture, analyze, kinds, counted, join, run } from "./e259-lib.mjs";

after(cleanup);

const d8 = ".bash/.c/.cc/.cjs/.cpp/.cs/.cts/.cxx/.go/.h/.hpp/.java/.js/.jsx/.kt/.kts/.mjs/.mts/.py/.rb/.rs/.sh/.swift/.ts/.tsx/.zsh";
const slashExts = [".c", ".h", ".cc", ".cpp", ".cxx", ".hpp", ".java", ".cs", ".go", ".kt", ".kts", ".swift", ".rs", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"];
const silent = (r) => assert.deepEqual(r.lines, [], r.lines.join(" | "));

// Contract: a string form's body is code, so only the one real comment line is a comment and nothing is long.
function onlyRealComment(rel, text, comments = 1) {
  const a = analyze(rel, text);
  assert.equal(a.commentLines, comments, `${rel}: comment lines`);
  assert.deepEqual(a.blocks.map((b) => b.counted), comments === 1 ? [1] : a.blocks.map((b) => b.counted), rel);
  assert.ok(a.blocks.every((b) => b.counted <= 7), rel);
}

test("AC1: isScannablePath accepts every D2 extension (also in subdirectories) and rejects the rest", () => {
  const yes = d8.split("/");
  for (const e of yes) {
    assert.equal(isScannablePath(`f${e}`), true, e);
    assert.equal(isScannablePath(`src/deep/f${e}`), true, e);
  }
  for (const no of ["x.d.ts", "x.d.mts", "x.d.cts", "dist/a.ts", "a/dist/b.py", "node_modules/a.js", "a/node_modules/b/c.rs", "A.PY", "a.Ts",
    "a.yaml", "a.yml", "a.toml", "a.json", "a.md", "a.txt", "Makefile", ".bashrc", "noext"]) {
    assert.equal(isScannablePath(no), false, no);
  }
});

test("AC2: the summary lists exactly D8, equal to the sorted registry extensions", () => {
  const r = check({ "a.ts": join([...run(8, "//"), "x = 1"]) });
  const summary = r.lines.find((l) => l.includes("warning(s) in"));
  const m = /\(only (\S+) are scanned\) — advisory; /.exec(summary);
  assert.ok(m, summary);
  assert.equal(m[1], d8);
  assert.equal(m[1], langRegistry.flatMap((l) => l.exts).sort().join("/"));
  assert.equal(m[1], scannedExtensions().join("/"));
});

test("AC4: .cjs/.mts/.cts reuse the JS lexer — regex and template contents are not comments, only the 8-line block is reported", () => {
  const src = join([
    "const re = /a\\/\\/b/g; const t = `/* open`;",
    "const u = `still // code`;",
    ...run(8, "//", "eight"),
    "x = 1",
    ...run(7, "//", "seven"),
    "y = 2",
  ]);
  const files = Object.fromEntries([".cjs", ".mts", ".cts"].map((e) => [`a${e}`, src]));
  const r = check(files);
  for (const name of Object.keys(files)) assert.deepEqual(r.blocks[name], [{ line: 3, count: 8 }], name);
  assert.equal(Object.keys(r.blocks).length, 3);
});

test("AC4: the JS path reproduces the frozen base-commit lexer output on the JS corpus (differential baseline)", () => {
  // Contract: E259 moved lexJs verbatim; the baseline was generated once from the base commit's dist, never looked up at test time.
  const baseline = JSON.parse(fixture("js-baseline"));
  const corpora = { "js-corpus": fixture("js-corpus"), "lexer-mix": fixture("lexer-mix-copy"), "jsdoc-tags": fixture("jsdoc-tags-copy") };
  for (const [id, text] of Object.entries(corpora)) {
    const want = baseline[id];
    for (const rel of ["c.ts", "c.cjs", "c.mts", "c.cts", "c.jsx"]) {
      const a = analyze(rel, text);
      const got = a.lines.map((l) => ({ blank: "b", code: "c", comment: "m" })[l.kind] + (l.delimiterOnly ? "d" : "")).join(",");
      assert.equal(got, want.kinds, `${id} ${rel} kinds`);
      assert.deepEqual(a.blocks.map((b) => [b.start, b.end, b.counted]), want.blocks, `${id} ${rel} blocks`);
      assert.equal(a.nonBlank, want.nonBlank);
      assert.equal(a.commentLines, want.commentLines);
    }
    assert.deepEqual(analyzeText(text).lines, analyze("z.ts", text).lines, `${id}: default argument is the JS table`);
  }
});

test("AC5: a 7-line // block is silent and an 8-line one is reported in every // family", () => {
  const src = join([...run(7, "//", "seven"), "x = 1", ...run(8, "//", "eight"), "y = 2"]);
  const files = Object.fromEntries(slashExts.map((e) => [`f${e}`, src]));
  const r = check(files);
  for (const name of Object.keys(files)) assert.deepEqual(r.blocks[name], [{ line: 9, count: 8 }], name);
  assert.equal(Object.keys(r.blocks).length, slashExts.length);
});

test("AC6: a /* */ span is one block, a trailing // is a code line, a blank line splits // runs (java, go, cs)", () => {
  const span = ["int a = 1;", "/*", ...run(9, " *", "span"), " */"];
  const trailing = ["int b = 2; // trailing note", ...run(7, "//", "after"), "int z = 0;"];
  const split = [...run(5, "//", "top"), "", ...run(5, "//", "bottom"), "int c = 3;"];
  const src = join([...span, ...trailing, ...split]);
  const files = Object.fromEntries([".java", ".go", ".cs"].map((e) => [`f${e}`, src]));
  const r = check(files);
  for (const name of Object.keys(files)) assert.deepEqual(r.blocks[name], [{ line: 2, count: 9 }], name);
  const k = kinds("f.java", src);
  assert.equal(k[12], "code", "trailing comment makes its line code");
  assert.equal(k[26], "blank");
});

test("AC7: Rust r#\"..\"#, r##\"..\"##, b\"..\" and multi-line strings hide their // text", () => {
  const src = fixture("rust-strings");
  onlyRealComment("a.rs", src);
  silent(check({ "a.rs": src }));
});

test("AC8: Rust lifetimes and char literals are not strings; the trailing // is a comment and nothing after is swallowed", () => {
  // Contract (architecture Decision Records: char literals are complete-match forms): the closing 8-line block stays visible.
  const src = fixture("rust-lifetimes");
  assert.deepEqual(counted("a.rs", src), [8]);
  assert.deepEqual(check({ "a.rs": src }).blocks["a.rs"], [{ line: 4, count: 8 }]);
});

test("AC9: nested block comments in rs/swift/kt, first */ closes in java/go/c/cs/ts", () => {
  const span = ["/* a /* b */", "still comment", "*/ code"];
  const unclosed = ["/* a /* b */", ...run(8, "text", "line")];
  const oneLine = ["/* a /* b */ code"];
  for (const ext of [".rs", ".swift", ".kt"]) {
    assert.deepEqual(kinds(`a${ext}`, span.join("\n")), ["comment", "comment", "code"], ext);
    assert.deepEqual(kinds(`a${ext}`, unclosed.join("\n")), Array(9).fill("comment"), ext);
    assert.deepEqual(kinds(`a${ext}`, oneLine.join("\n")), ["comment"], ext);
  }
  for (const ext of [".java", ".go", ".c", ".cs", ".ts"]) {
    assert.deepEqual(kinds(`a${ext}`, span.join("\n")), ["comment", "code", "code"], ext);
    assert.deepEqual(kinds(`a${ext}`, unclosed.join("\n")), ["comment", ...Array(8).fill("code")], ext);
    assert.deepEqual(kinds(`a${ext}`, oneLine.join("\n")), ["code"], ext);
  }
});

test("AC10: C++ raw strings (plain, delimiter, u8 prefix) hide // and /* text in .cpp, .h, .cc", () => {
  const src = fixture("cpp-raw");
  for (const rel of ["a.cpp", "a.h", "a.cc"]) onlyRealComment(rel, src);
  silent(check({ "a.cpp": src, "a.h": src, "a.cc": src }));
});

test("AC11: C# verbatim, interpolated-verbatim and raw strings (3 and 4 quotes) hide their // text", () => {
  const src = fixture("csharp-strings");
  onlyRealComment("a.cs", src);
  silent(check({ "a.cs": src }));
});

test("AC12: Go backtick strings hide // and /*; a // after the closing backtick is a comment", () => {
  const src = fixture("go-backtick");
  assert.deepEqual(counted("a.go", src), [8]);
  assert.deepEqual(check({ "a.go": src }).blocks["a.go"], [{ line: 13, count: 8 }]);
});

test("AC13: Kotlin triple-quoted strings with ${} templates hide their // text (.kt and .kts)", () => {
  const src = fixture("kotlin-strings");
  for (const rel of ["a.kt", "a.kts"]) onlyRealComment(rel, src);
  silent(check({ "a.kt": src, "a.kts": src }));
});

test("AC14: Swift triple-quoted and extended-delimiter strings hide their // text", () => {
  const src = fixture("swift-strings");
  onlyRealComment("a.swift", src);
  silent(check({ "a.swift": src }));
});

test("AC15: Java text blocks hide their // text", () => {
  const src = fixture("java-textblock");
  onlyRealComment("a.java", src);
  silent(check({ "a.java": src }));
});

test("AC25: unknown extensions, .d.mts, dist/ and wrong-case names print no hit", () => {
  const blk = join([...run(8, "#", "note"), "x = 1"]);
  const names = ["a.yaml", "b.toml", "c.md", "d.json", "e.txt", "Makefile", "f.PY", "g.d.mts", "dist/h.py"];
  const r = check(Object.fromEntries(names.map((n) => [n, blk])));
  assert.deepEqual(r.lines.filter((l) => l.startsWith(PREFIX)), []);
  for (const n of names) assert.equal(langForPath(n), null, n);
});
