// Behaviour-neutral proof for lane e268 (comment-only test edits), E260 precedent.
// Run from the lane worktree root:  node .current/e268/proof.mjs [--e272-code]
// --e272-code: E272 changed the expected-reference table (code), so test/subagent-templates.test.mjs
// is excluded from the byte-identical emit check (its diff is reviewed by hand instead).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");

const base = fs.readFileSync(".current/e268/base-sha", "utf8").trim();
const e272Code = process.argv.includes("--e272-code");
const COMMENT_ONLY = [
  "test/drift-skew.test.mjs",
  "test/agc-adapters.test.mjs",
  "test/e22-stale-notify.test.mjs",
  "test/gates-expected-red.test.mjs",
  "test/e92-e86-handoff-write-boundary.test.mjs",
  "test/lane-ticket-allocation.test.mjs",
  "test/pixel-gate-attestation.test.mjs",
  "test/qa-flow.test.mjs",
  ...(e272Code ? [] : ["test/subagent-templates.test.mjs"]),
];
const OWNED = new RegExp(
  "^(test/(drift-skew|agc-adapters|e22-stale-notify|gates-expected-red|e92-e86-handoff-write-boundary|" +
    "lane-ticket-allocation|pixel-gate-attestation|qa-flow|subagent-templates)\\.test\\.mjs" +
    "|specs/(e260[egh]-comment-rationale|e268-[^/]+)\\.md" +
    "|qa_reports/[^/]*E268[^/]*|review_reports/[^/]*E268[^/]*|\\.current/e268/.*)$",
);
const git = (...a) => execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 26 });
const emit = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { removeComments: true, target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
  }).outputText;

let fail = false;
let differ = 0;
for (const f of COMMENT_ONLY) {
  if (emit(git("show", `${base}:${f}`)) !== emit(fs.readFileSync(f, "utf8"))) {
    differ++;
    console.log(`DIFFERS: ${f}`);
  }
}
console.log(`emit: ${COMMENT_ONLY.length} files, ${differ} differ`);
if (differ) fail = true;

const changed = git("diff", "--name-status", `${base}`, "HEAD").split("\n").filter(Boolean)
  .concat(git("status", "--porcelain").split("\n").filter(Boolean).map((l) => `?\t${l.slice(3)}`));
const bad = changed.filter((l) => {
  const [st, p] = l.split("\t");
  return !OWNED.test(p) || (p.startsWith("test/") && st !== "M");
});
console.log(bad.length ? `scope: VIOLATION ${bad.join(" | ")}` : "scope: ok");
if (bad.length) fail = true;

const added = git("diff", "-U0", base, "--", ...COMMENT_ONLY, "specs/e260e-comment-rationale.md",
  "specs/e260g-comment-rationale.md", "specs/e260h-comment-rationale.md")
  .split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
const hyg = added.filter((l) => /\/Users\/|\/home\/|git show |git log|\b[0-9a-f]{40}\b/.test(l));
console.log(hyg.length ? `hygiene: VIOLATION\n${hyg.join("\n")}` : "hygiene: ok");
if (hyg.length) fail = true;
process.exit(fail ? 1 : 0);
