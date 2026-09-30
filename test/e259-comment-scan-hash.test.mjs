// Coded by @qa-engineer
// Tests for specs/e259-comment-scan-languages.md AC5 (# families), AC16-AC24
// and AC26: Python, shell and Ruby lexing, docstrings, shebang, doc-tag rules
// and robustness. Samples are test/fixtures/e259/*.fixture.txt.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { PREFIX, check, cleanup, fixture, analyze, kinds, counted, join, run } from "./e259-lib.mjs";

after(cleanup);

const hashExts = [".py", ".sh", ".bash", ".zsh", ".rb"];
const silent = (r) => assert.deepEqual(r.lines, [], r.lines.join(" | "));
const hits = (rel, text) => check({ [rel]: text }).blocks[rel];

// Contract: Python docstring lines are comment lines; a bare """ line is a delimiter, not counted.
function pyDoc(header, body, indent = "    ") {
  return join([...header, `${indent}"""`, ...body.map((t) => indent + t), `${indent}"""`, `${indent}return 1`]);
}

test("AC5: a 7-line # block is silent and an 8-line one is reported in py, sh, bash, zsh and rb", () => {
  const src = join([...run(7, "#", "seven"), "x = 1", ...run(8, "#", "eight"), "y = 2"]);
  const r = check(Object.fromEntries(hashExts.map((e) => [`f${e}`, src])));
  for (const e of hashExts) assert.deepEqual(r.blocks[`f${e}`], [{ line: 9, count: 8 }], e);
  assert.equal(Object.keys(r.blocks).length, hashExts.length);
});

test("AC16: Python triple-quoted strings outside docstring position hide their # lines", () => {
  const src = fixture("python-strings");
  const a = analyze("a.py", src);
  assert.equal(a.commentLines, 1);
  assert.deepEqual(a.blocks.map((b) => b.counted), [1]);
  silent(check({ "a.py": src }));
});

test("AC17: Python docstrings (module, class, def, async def, multi-line signature, r-prefix) count as comments", () => {
  const eight = run(8, "", "text").map((t) => t.trim());
  const seven = eight.slice(0, 7);
  const headers = {
    def: ["def f():"],
    async: ["async def f():"],
    cls: ["class C:"],
    multi: ["def f(a,", "      b=(1, 2)) -> int:"],
  };
  for (const [id, h] of Object.entries(headers)) {
    assert.deepEqual(counted("a.py", pyDoc(h, eight)), [8], `${id}: 8 lines`);
    assert.deepEqual(counted("a.py", pyDoc(h, seven)), [7], `${id}: 7 lines plus delimiters`);
    assert.deepEqual(hits("a.py", pyDoc(h, eight)), [{ line: h.length + 1, count: 8 }], id);
    assert.equal(hits("a.py", pyDoc(h, seven)), undefined, `${id}: silent at 7`);
  }
  const module = join(['r"""', ...eight, '"""', "x = 1"]);
  assert.deepEqual(counted("m.py", module), [8]);
  assert.deepEqual(hits("m.py", module), [{ line: 1, count: 8 }]);
  assert.equal(hits("m.py", join(['"""', ...seven, '"""', "x = 1"])), undefined);
  assert.equal(analyze("a.py", 'def f():\n    """x"""\n').commentLines, 1, "one-line docstring is one comment line");
  const ratio = join(Array.from({ length: 20 }, (_, i) => [`def f${i}():`, '    """doc"""', "    pass"]).flat());
  assert.equal(analyze("a.py", ratio).commentLines, 20);
  const lines = check({ "r.py": ratio }).lines;
  assert.equal(lines.filter((l) => / high-ratio /.test(l)).length, 1, "docstring lines raise the file ratio");
  assert.equal(lines.filter((l) => / long-block /.test(l)).length, 0);
});

test("AC17: a string that is not the first statement is code, and a single-quoted doc is code", () => {
  assert.equal(analyze("a.py", 'def f():\n    x = 1\n    """not doc\n    # inside\n    """\n').commentLines, 0);
  assert.deepEqual(kinds("a.py", 'def f():\n    "doc"\n'), ["code", "code", "blank"]);
});

test("AC18: a shebang on line 1 is code in sh, py and rb; a #! on line 2 is an ordinary comment", () => {
  for (const ext of [".sh", ".py", ".rb"]) {
    const rel = `f${ext}`;
    assert.equal(hits(rel, join(["#!/usr/bin/env x", ...run(7, "#"), "x = 1"])), undefined, `${ext}: 7 after shebang`);
    assert.deepEqual(hits(rel, join(["#!/usr/bin/env x", ...run(8, "#"), "x = 1"])), [{ line: 2, count: 8 }], ext);
    const second = join(["x = 1", "#! ordinary", ...run(7, "#"), "y = 2"]);
    assert.deepEqual(hits(rel, second), [{ line: 2, count: 8 }], `${ext}: #! on line 2`);
    assert.equal(kinds(rel, "#!/usr/bin/env x\n# c\n")[0], "code");
  }
});

test("AC19: shell # is a comment only at word start ($#, ${#a}, a#b, quoted # are code)", () => {
  // Contract: each trap opens a quote after the tricky token, so a misread # would expose 8 comment lines.
  const src = fixture("shell-word");
  for (const ext of [".sh", ".bash", ".zsh"]) {
    assert.deepEqual(counted(`a${ext}`, src), [8], ext);
    assert.deepEqual(hits(`a${ext}`, src), [{ line: 52, count: 8 }], ext);
  }
  assert.deepEqual(kinds("a.sh", "# note\nls # note\n"), ["comment", "code", "blank"]);
});

test("AC20: Ruby =begin/=end is one block counting its 9 body lines; indented/mid-line =begin and # in strings are code", () => {
  const src = fixture("ruby-begin");
  const a = analyze("a.rb", src);
  assert.deepEqual(a.blocks.map((b) => b.counted), [9]);
  assert.equal(a.commentLines, 11);
  assert.deepEqual(hits("a.rb", src), [{ line: 1, count: 9 }]);
  assert.deepEqual(a.lines.slice(11, 17).map((l) => l.kind), ["code", "code", "code", "code", "code", "code"]);
});

const body = (leader, lines) => lines.map((t) => (leader ? `${leader} ${t}` : t));
const slashDoc = (lines) => join(["/**", ...body(" *", lines), " */", "int x = 1;"]);
const prose = (n, tag = "prose") => run(n, "", tag).map((t) => t.trim());

test("AC21: @param/@return/@throws/@exception/@example bodies are excluded from the block count in java, kt, cpp, rb", () => {
  const tagged = [...prose(5), "@param a first", "continued one", "@return r", "@throws t", "continued two", "@exception e", "@example", "sample code"];
  for (const ext of [".java", ".kt", ".cpp"]) {
    assert.equal(hits(`a${ext}`, slashDoc(tagged)), undefined, `${ext}: silent`);
    assert.deepEqual(counted(`a${ext}`, slashDoc(tagged)), [5], ext);
    assert.deepEqual(counted(`a${ext}`, slashDoc(prose(8))), [8], `${ext}: 8 prose lines`);
    const see = ["@param a first", "@see elsewhere", ...prose(6)];
    assert.deepEqual(counted(`a${ext}`, slashDoc(see)), [7], `${ext}: @see is prose`);
    assert.deepEqual(counted(`a${ext}`, slashDoc(["@param a", "@see b", ...prose(7)])), [8], `${ext}: @see ends the exclusion`);
  }
  assert.equal(hits("a.rb", join(body("#", tagged))), undefined, "rb: silent");
  assert.deepEqual(counted("a.rb", join(body("#", prose(8)))), [8]);
  const back = [...prose(5), "\\param a first", "continued", "\\return r", "continued", "\\throws t"];
  assert.deepEqual(counted("a.c", slashDoc(back)), [5], ".c excludes backslash tags");
  assert.equal(hits("a.c", slashDoc(back)), undefined);
  assert.deepEqual(counted("a.java", slashDoc(back)), [10], ".java treats backslash tags as prose");
  assert.deepEqual(hits("a.java", slashDoc(back)), [{ line: 1, count: 10 }]);
});

test("AC22: Swift markup and C# XML tags are excluded; a - Note: line and eight <summary> lines are prose", () => {
  const swift = (lines) => join([...body("///", lines), "func f() {}"]);
  const marked = [...prose(5), "- Parameters:", "  - a: first", "  - b: second", "- Returns: r", "- Throws: t"];
  assert.deepEqual(counted("a.swift", swift(marked)), [5]);
  assert.equal(hits("a.swift", swift(marked)), undefined);
  const note = ["- Parameters:", "  - a: first", "- Note: n", ...prose(7)];
  assert.deepEqual(counted("a.swift", swift(note)), [8]);
  assert.deepEqual(hits("a.swift", swift(note)), [{ line: 1, count: 8 }]);
  const cs = (lines) => join([...body("///", lines), "void F() {}"]);
  const xml = ["<summary>", ...prose(3), "</summary>", '<param name="a">first</param>', '<param name="b">second</param>', "<returns>r</returns>", '<exception cref="E">e</exception>'];
  assert.deepEqual(counted("a.cs", cs(xml)), [5]);
  assert.equal(hits("a.cs", cs(xml)), undefined);
  const long = ["<summary>", ...prose(6), "</summary>"];
  assert.deepEqual(counted("a.cs", cs(long)), [8]);
  assert.deepEqual(hits("a.cs", cs(long)), [{ line: 1, count: 8 }]);
});

test("AC23: Python docstring Args/Returns/Raises sections and Sphinx fields are excluded; Note: and See Also: are prose", () => {
  const sections = [...prose(5), "Args:", "    a: x", "Returns:", "    r", "Raises:", "    E: e", ":param x: y", ":rtype: z"];
  assert.deepEqual(counted("a.py", pyDoc(["def f():"], sections)), [5]);
  assert.equal(hits("a.py", pyDoc(["def f():"], sections)), undefined);
  assert.deepEqual(counted("a.py", pyDoc(["def f():"], prose(8))), [8]);
  const heads = ["Args:", "    a: x", "Note:", ...prose(4), "See Also:", "    s1", "    s2"];
  assert.deepEqual(counted("a.py", pyDoc(["def f():"], heads)), [8]);
  assert.deepEqual(hits("a.py", pyDoc(["def f():"], heads)), [{ line: 2, count: 8 }]);
});

test("AC24: rustdoc headings, Go doc prose and shell prose are not excluded; tag lines still raise the file ratio", () => {
  const rs = join([...body("///", [...prose(5), "# Errors", ...prose(2, "err"), "# Examples", ...prose(2, "ex")]), "fn f() {}"]);
  assert.deepEqual(counted("a.rs", rs), [11]);
  assert.deepEqual(hits("a.rs", rs), [{ line: 1, count: 11 }]);
  assert.deepEqual(hits("a.go", join([...body("//", prose(8)), "func F() {}"])), [{ line: 1, count: 8 }]);
  assert.deepEqual(hits("a.sh", join([...body("#", prose(8)), "x=1"])), [{ line: 1, count: 8 }]);
  const tagRatio = (leader, tag, code) => join(Array.from({ length: 10 }, (_, i) => [`${leader} ${tag} a${i}`, `${leader} ${tag} b${i}`, ...code(i)]).flat().concat(Array.from({ length: 12 }, (_, i) => code(100 + i)).flat()));
  const javaSrc = tagRatio("//", "@param", (i) => [`int a${i} = 1;`, `int b${i} = 2;`]);
  const swiftSrc = tagRatio("///", "- Returns:", (i) => [`let a${i} = 1`, `let b${i} = 2`]);
  for (const [rel, src] of [["r.java", javaSrc], ["r.swift", swiftSrc]]) {
    const out = check({ [rel]: src }).lines;
    assert.equal(out.filter((l) => / high-ratio /.test(l)).length, 1, `${rel}: ratio counts excluded tag lines`);
    assert.equal(out.filter((l) => / long-block /.test(l)).length, 0, rel);
  }
});

test("AC26: unterminated strings, raw strings, block comments, docstrings and a 5000-line file never crash the scan or change the exit code", () => {
  const tail = {
    "a.rs": ['let a = r#"', "// x"], "b.cpp": ['const char* a = R"x(', "// x"], "c.cs": ['var a = @"', "// x"],
    "d.cs": ['var a = """', "// x"], "e.go": ["var a = `", "// x"], "f.kt": ['val a = """', "// x"],
    "g.swift": ['let a = #"""', "// x"], "h.java": ["int a; /*", "x"], "i.py": ['"""', "# x"],
    "j.sh": ["echo '", "# x"], "k.rb": ["=begin", "x"], "l.rb": ['x = "', "# x"], "m.rs": ["/* /* open", "x"],
    "n.py": ["x = 'a", "# y"], "o.ts": ["const t = `", "// x"],
  };
  const files = Object.fromEntries(Object.entries(tail).map(([k, v]) => [k, join(v)]));
  files["big.rs"] = join(Array.from({ length: 5000 }, (_, i) => (i % 9 === 0 ? `// c ${i}` : `let v${i} = 'a'; // t`)));
  files["big.py"] = join(Array.from({ length: 5000 }, (_, i) => (i % 2 ? `x${i} = "a" # t` : `y${i} = 1`)));
  const control = check({ "ok.ts": "const a = 1;\n" });
  const t0 = Date.now();
  const r = check(files);
  assert.ok(Date.now() - t0 < 30000, "completes");
  assert.equal(r.status, control.status, "exit code unchanged");
  assert.ok(r.lines.every((l) => l.startsWith(PREFIX)));
  assert.ok(!/TypeError|RangeError|at \S+ \(/.test(r.stderr), r.stderr);
  for (const [k, v] of Object.entries(files)) assert.ok(Array.isArray(analyze(k, v).lines), k);
});
