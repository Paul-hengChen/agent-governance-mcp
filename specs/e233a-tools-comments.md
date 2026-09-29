# e233a-tools-comments

Lane e233a, slice 1 of the E233 fan-out. Base commit 6c61864.

## Problem Statement
Roughly 315 comment lines across 32 files under `tools/` explain themselves only by a bare backlog ticket id (for example `// E31 (e31-config-nonfatal): ...`). Anyone without this repo's backlog cannot tell what the code does or why. This slice rewrites those comments in plain language (behaviour plus reason), keeping the id only as a trailing pointer. Comments only; program behaviour must not change.

## User Stories
- As a contributor who has never seen the backlog, I want each comment under `tools/` to state the behaviour and the reason in words, so that I can read the code without looking up ticket ids.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a 300-line rewrite without reading every hunk for logic.

## Acceptance Criteria
- **AC1 (behaviour invariance)** — Given every `tools/*.ts` file changed by this lane, when each file is transpiled with `removeComments: true` at base commit 6c61864 and at HEAD, then the two outputs are byte-identical for every file.
  proof: `node <scratch>/check-invariance.mjs` (run from the lane root) (script body in "Verification scripts" below; the sr-engineer writes it to `$TMPDIR` or the scratchpad, never into a tracked path) prints `invariance OK: <n> files` and exits 0.
- **AC2 (no bare-id explanation)** — Given the comment lines under `tools/*.ts` that mention a ticket id, when each is stripped of the id, its slug in parentheses, and punctuation, then no comment block is left whose remaining explanation is empty or a single filler word; the id, where kept, is a trailing pointer such as `... (E31)`.
  proof: `node <scratch>/check-bare-ids.mjs` prints `bare-id OK` and exits 0 (heuristic below; reviewer additionally samples 20 rewritten comments by eye).
- **AC3 (pinned watch-block prefix)** — Given `test/e178b-lane-watch.test.mjs` locates the watch block by source text, when `tools/lane-status.ts` is edited, then a line starting with `// Watch mode (E178b` still exists verbatim.
  proof: `grep -c '^ *// Watch mode (E178b' tools/lane-status.ts` prints at least 1.
- **AC4 (line comments stay line comments in lane-status)** — Given two tests filter `tools/lane-status.ts` by `//`-prefixed lines, when the file is edited, then no `//` comment is converted to a `/* */` block and no new block comment is introduced.
  proof: `git diff 6c61864 -- tools/lane-status.ts | grep -E '^\+.*/\*' | wc -l` prints `0`.
- **AC5 (no non-comment text touched)** — Given string literals, error messages, tool descriptions in `tools/registry.ts`, and identifiers are behaviour, when the diff is inspected, then no added or removed line is anything other than a comment line or a blank line adjacent to one.
  proof: AC1 passes, and `git diff -U0 6c61864 -- tools | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*)'` prints nothing except lines that are the tail of a trailing comment (each listed and justified in the review).
- **AC6 (generated output rebuilt)** — Given `tsconfig.json` does not set `removeComments`, when the sources change, then `dist/tools/**` is rebuilt and committed, and no file outside the owned set changes.
  proof: `npm run build && git status --porcelain` shows nothing uncommitted after the commit, and `git diff --name-only 6c61864 | grep -vE '^(tools/|dist/tools/|specs/e233a-|qa_reports/.*E233A|review_reports/.*E233A|\.current/e233a/)'` prints nothing.
- **AC7 (suite unchanged)** — Given the change is comment-only, when the full suite runs after commit with a clean tree, then it passes with the same count as base.
  proof: `npm test` (run by qa after commit; clean tree) reports 0 failures.
- **AC8 (hygiene)** — Given the readability and information-hygiene rules, when the rewritten comments are read, then none adds an absolute path, username, employer-internal link, or codename, and none introduces governance-process jargon (round, gate, PASS/FAIL, tool-call names) where plain words describe the behaviour. Names of real functions, files, and config keys stay.
  proof: `git diff 6c61864 -- tools | grep -E '^\+' | grep -E '/Users/|/home/|https?://'` prints nothing; the rest is a reviewer judgment.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature adds no user-facing strings (string literals are out of scope and must not change) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- String literals, error messages, tool `description` strings in `tools/registry.ts`, test names.
- Every directory other than `tools/` and `dist/tools/` (`gates/`, `bin/`, `scripts/`, `prompts/`, `content/`, `test/`, and the rest belong to sibling lanes).
- Any test change. If one is needed, the coordinator mails the integrator first.
- Release bookkeeping (version, CHANGELOG, backlog done-marking): release-engineer, post-PASS.

## Dependencies / Prerequisites
E231 (readability rule, `specs/e231-info-hygiene-rule.md`) shipped. No design file (mode = no-design; Visual Structural Assertions omitted). No external references found (Resource Audit: zero hits).

Cut shape: serial, one lane, disjoint files per task (no parallel cut inside the lane; tasks below partition files by owner module and comment count so each stays within the 5 files / 300 lines budget).

Chain: sr-engineer (fable) then one code-reviewer round and one QA round over the whole batch of tasks.

## Rewrite rule (for sr-engineer)
For every comment that cites a ticket id, state what the code does and why in ordinary words. Keep the id only as a trailing pointer, for example `// Missing config file is not fatal: fall back to defaults so a fresh workspace still boots. (E31)`. If a multi-line block spends most words on history ("originally", "after the bug in ..."), keep the current-behaviour reason and drop the narrative. Leave already-plain comments alone. Do not reflow code or change blank-line structure beyond the comment itself.

## Verification scripts
`check-invariance.mjs` (run from the lane root; uses the repo's own `typescript`):
```js
import ts from "typescript";
import { execSync } from "node:child_process";
import fs from "node:fs";
const files = execSync("git diff --name-only 6c61864 -- tools", { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".ts"));
const out = (src) => ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;
let bad = 0;
for (const f of files) {
  const before = execSync(`git show 6c61864:${f}`, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (out(before) !== out(fs.readFileSync(f, "utf8"))) { console.log("DIFF", f); bad++; }
}
if (bad) process.exit(1);
console.log(`invariance OK: ${files.length} files`);
```
`check-bare-ids.mjs`: for each `tools/*.ts`, join consecutive comment lines into blocks; for each block matching `/\b[Ee]\d+[a-z]?\b/`, remove ids, `(slug-like-tokens)`, and punctuation; fail when fewer than 3 words remain, or when the block is only an id plus a slug. Print offending `file:line`.

## Task cut
Partition by file; comment-line counts are from a regex scan and approximate. Each task rewrites comments only and stays under 300 changed lines.

| id | scope | est. files |
|---|---|---|
| T-E233A-01 | `tools/handoff-orchestrator.ts` (largest, about 66) | 1 |
| T-E233A-02 | `tools/handoff-parse.ts`, `handoff-write.ts`, `handoff-types.ts`, `handoff.ts` (about 74) | 4 |
| T-E233A-03 | `tools/tasks-file.ts`, `tasks-lane-migrate.ts`, `storage-sqlite.ts`, `storage.ts`, `config.ts` (about 69) | 5 |
| T-E233A-04 | `tools/fanout-manifest.ts`, `lane-paths.ts`, `lane-registry.ts` (about 67) | 3 |
| T-E233A-05 | `tools/lane-status.ts` (keep the pinned prefix, `//` only), `lane-ticket-allocation.ts`, `lane-migrate.ts` (about 64) | 3 |
| T-E233A-06 | `tools/transitions.ts`, `feature-rollup.ts`, `drift.ts`, `registry.ts` (comments only, no description strings), `gate-stats.ts` (about 83) | 5 |
| T-E233A-07 | `tools/join-precondition.ts`, `metrics.ts`, `stale-notify.ts`, `merge-invariants.ts` (about 27) | 4 |
| T-E233A-08 | `tools/usage-accounting.ts`, `evidence-lookup.ts`, `dispatch-log.ts`, `hygiene-scan.ts`, `evidence-file.ts` (about 13) | 5 |
| T-E233A-09 | `tools/role.ts`, `telemetry.ts`, `exemptions.ts` (about 6), any remaining `tools/*.ts` hit by the bare-id check, then run AC1 to AC6, rebuild and commit `dist/tools/**` | 3 |
