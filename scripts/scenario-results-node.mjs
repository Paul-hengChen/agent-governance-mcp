// Coded by @sr-engineer
// Node test-runner adapter for scripts/check-scenario-tests.mjs (E427).
//
// Node's built-in JUnit reporter writes classname="test" on every test case,
// so a ticket's `test <file> — <title>` could not be matched by file. The
// default export is a test reporter that hands every event to Node's own
// `junit` reporter unchanged, except that a test:pass / test:fail event that
// carries data.file gets data.classname = that file relative to the working
// directory, with `/` separators. The output stays ordinary JUnit XML.
//
// readResults(resultsPath) reads that XML back (no third-party dependency)
// into one { file, title, status } entry per <testcase> and per <testsuite>:
// title is the full nested title (enclosing suite names joined by " > "),
// status is "failed" / "skipped" / "passed" per spec D5. It is the one
// function another project supplies for its own runner (--adapter).

import * as fs from "node:fs";
import * as path from "node:path";
import { junit } from "node:test/reporters";

async function* withFileClassname(source) {
  for await (const event of source) {
    if ((event.type === "test:pass" || event.type === "test:fail") && typeof event.data?.file === "string") {
      event.data.classname = path.relative(process.cwd(), event.data.file).split(path.sep).join("/");
    }
    yield event;
  }
}

export default async function* scenarioResultsReporter(source) {
  yield* junit(withFileClassname(source));
}

const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };

function decode(text) {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, ref) => {
    if (ref[0] === "#") {
      const code = ref[1] === "x" ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ref] ?? whole;
  });
}

const ATTR = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const OPEN_TAG = /^<([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/;
const CLOSE_TAG = /^<\/([A-Za-z_][\w:.-]*)\s*>/;

/** Parses XML text into a tree of { name, attrs, children } elements. */
function parseXml(text) {
  const root = { name: "#document", attrs: {}, children: [] };
  const stack = [root];
  let i = 0;
  while (i < text.length) {
    const lt = text.indexOf("<", i);
    if (lt < 0) break;
    const rest = text.slice(lt);
    if (rest.startsWith("<!--")) {
      const end = text.indexOf("-->", lt + 4);
      if (end < 0) throw new Error("unterminated comment");
      i = end + 3;
    } else if (rest.startsWith("<?")) {
      const end = text.indexOf("?>", lt + 2);
      if (end < 0) throw new Error("unterminated processing instruction");
      i = end + 2;
    } else if (rest.startsWith("<![CDATA[")) {
      const end = text.indexOf("]]>", lt + 9);
      if (end < 0) throw new Error("unterminated CDATA section");
      i = end + 3;
    } else if (rest.startsWith("<!")) {
      const end = text.indexOf(">", lt + 2);
      if (end < 0) throw new Error("unterminated declaration");
      i = end + 1;
    } else if (rest.startsWith("</")) {
      const m = CLOSE_TAG.exec(rest);
      const open = stack[stack.length - 1];
      if (!m || stack.length === 1 || open.name !== m[1]) {
        throw new Error(`unexpected closing tag at offset ${lt}`);
      }
      stack.pop();
      i = lt + m[0].length;
    } else {
      const m = OPEN_TAG.exec(rest);
      if (!m) throw new Error(`malformed tag at offset ${lt}`);
      const attrs = {};
      for (const a of m[2].matchAll(ATTR)) attrs[a[1]] = decode(a[2] ?? a[3]);
      const element = { name: m[1], attrs, children: [] };
      stack[stack.length - 1].children.push(element);
      if (m[3] !== "/") stack.push(element);
      i = lt + m[0].length;
    }
  }
  if (stack.length !== 1) throw new Error(`unclosed element <${stack[stack.length - 1].name}>`);
  return root;
}

const RANK = { passed: 0, skipped: 1, failed: 2 };

/** Collects entries under `element`; returns the summary of its test cases. */
function collect(element, titles, entries) {
  let status = "passed";
  let file = null;
  let cases = 0;
  for (const child of element.children) {
    if (child.name === "testcase") {
      const names = new Set(child.children.map((c) => c.name));
      const own = names.has("failure") ? "failed" : names.has("skipped") ? "skipped" : "passed";
      const ownFile = child.attrs.classname ?? null;
      entries.push({ file: ownFile, title: [...titles, child.attrs.name ?? ""].join(" > "), status: own });
      if (RANK[own] > RANK[status]) status = own;
      if (cases === 0) file = ownFile;
      cases += 1;
    } else if (child.name === "testsuite") {
      const title = [...titles, child.attrs.name ?? ""];
      const at = entries.length;
      const sub = collect(child, title, entries);
      entries.splice(at, 0, { file: sub.file, title: title.join(" > "), status: sub.status });
      if (RANK[sub.status] > RANK[status]) status = sub.status;
      if (cases === 0 && sub.cases > 0) file = sub.file;
      cases += sub.cases;
    }
  }
  return { status, file, cases };
}

/**
 * Reads a JUnit XML results file into { file, title, status } entries.
 * Throws the fs error when the file cannot be read, and a plain Error when
 * it is not JUnit XML (no <testsuites> or <testsuite> root element).
 */
export function readResults(resultsPath) {
  const text = fs.readFileSync(resultsPath, "utf8");
  const doc = parseXml(text);
  const roots = doc.children;
  if (roots.length !== 1 || (roots[0].name !== "testsuites" && roots[0].name !== "testsuite")) {
    throw new Error("not JUnit XML: no <testsuites> or <testsuite> root element");
  }
  const entries = [];
  if (roots[0].name === "testsuites") collect(roots[0], [], entries);
  else collect({ children: roots }, [], entries);
  return entries;
}
