# e233d-test-comments-b

Lane e233d, test batch 2 of the E233 fan-out (`specs/fanout-e233.md`). Base commit 6c61864. Worktree `../agent-governance-mcp-lanes/e233d`, branch `feat/e233d-test-comments-b`.

## Problem Statement
Many comments in this lane's test files explain themselves only by a ticket or task id, for example `// ---------- T-QA-E128-01: Blocked→Blocked self-loop fast path (E128) ----------` next to `// WHY: E86 recorded a single qa-engineer:PASS->PASS rejection`, or `// E148 (docs/backlog.md row E148): force the seed's last_updated off the wall clock`. A reader without this repo's backlog cannot tell what a test protects or why. This slice rewrites those comments so each states the protected behaviour and the reason in plain words, keeping an id only as a trailing pointer (for example `… (E128)`). Comments only: no test may change what it runs or asserts.

Measured at base 6c61864 with a TypeScript comment-range scan (`ts.createSourceFile` plus `getLeading/TrailingCommentRanges`, matching `[ECDR]<n>` and `T-…` ids): 576 id-bearing comment lines in 46 of the 50 owned files. Top: `qa-flow` 85, `feature-lease` 63, `e32-e33-gate-hardening` 32, `e235b-relative-worktree` 25, `e22-stale-notify` 22, `error-code-contract` 21. Adding lower-case slug citations such as `(e31-config-nonfatal)` gives 757 lines in 48 files, but most of the extra hits are tracked `specs/<slug>.md` paths, which are allowed. The coordinator's narrower count (255 lines in 43 files) matches comments where the id is the *only* explanation. That narrower set is the must-fix set. The larger count is the review surface.

## User Stories
- As a contributor who has never seen the backlog, I want each test comment to say what behaviour the test pins and why, so that I can maintain the test without looking up ids.
- As a reviewer, I want mechanical proof that only comments changed, so that I can approve a large comment rewrite without reading every hunk for logic.
- As the maintainer of a sibling test file, I want the labels my comments point at (for example `test/qa-flow.test.mjs T-QA-E128-01(a)`) to still be found by grep after this rewrite.

## Acceptance Criteria
- **AC1 (behaviour invariance)** — Given every owned test file changed by this lane, when each is transpiled with `removeComments: true` at 6c61864 and at HEAD, then the two outputs are byte-identical for every file.
  proof: `node <scratch>/check-invariance.mjs` (run from the lane root; body in "Verification scripts"; kept in `$TMPDIR` or the scratchpad, never in a tracked path) prints `invariance OK: <n> files` and exits 0.
- **AC2 (no bare-id explanation)** — Given the comments in the owned files that mention an id, when the id, any parenthesised slug and punctuation are removed, then no comment block is left with an empty explanation or a single filler word. Where an id is kept, it is a trailing pointer such as `… (E31)`, not a leading label.
  proof: `node <scratch>/check-bare-ids.mjs` prints `bare-id OK` and exits 0. The code reviewer also reads 25 rewritten blocks chosen across at least 8 files. The script's id detection is case-insensitive and also matches ids followed by extra letter or digit segments (for example lowercase lane forms like `e178a` or `e123b9`, and suffixed forms like `E233B-NEW-1`), not only `E` plus digits; the reviewer's sample includes at least five blocks of these shapes (integrator cross-lane note, 2026-09-29).
- **AC3 (cross-file label references still resolve)** — Given comments in other files point at labels inside owned files (for example `test/qa-flow.test.mjs T-QA-E128-01(a)`, `test/feature-lease.test.mjs FM2`, `test/gates-expected-red.test.mjs I1-I4`, `test/e239-init-subdir-exclude.test.mjs AC15`), when an owned file is rewritten, then every id or label token that some *other* tracked file cites next to this file's path is still present in this file.
  proof: `node <scratch>/check-xrefs.mjs` prints `xrefs OK` and exits 0.
- **AC4 (no non-comment text touched)** — Given string literals, assertion messages, test names, identifiers and fixtures are behaviour or pinned output, when the diff is inspected, then no added or removed line is anything other than a comment line, a blank line, or a code line whose only change is its trailing comment.
  proof: AC1 passes, and `git diff -U0 6c61864 -- test | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*|$)'` prints only trailing-comment lines, each listed and justified in the author's report.
- **AC5 (scope containment)** — Given the integrator's ownership table, when the lane's diff is listed, then only owned test files and this lane's bookkeeping paths change.
  proof: `git diff --name-only 6c61864 | grep -vE '^(test/(e[2-9][^/]*|er[^/]*|[f-q][^/]*)\.test\.mjs|specs/e233d-[^/]*|qa_reports/[^/]*E233D[^/]*|review_reports/[^/]*E233D[^/]*|\.current/e233d/.*)$'` prints nothing, and `git diff --name-only 6c61864 -- test/render-structure.test.mjs test/fixtures` prints nothing.
- **AC6 (suite unchanged)** — Given the change is comment-only, when the full suite runs after commit on a clean tree (no untracked files), then its pass/fail/skip counts equal the baseline the author recorded at 6c61864 before editing.
  proof: `node scripts/test-lock.mjs -- npm test` after commit, `git status --porcelain` empty. Counts compared with the baseline line in the author's report. The verifier's run must be on the lane's final HEAD: if any evidence file (qa/review report, spec, handoff) is committed after that run, commit it and run the suite again; the last run is the one reported, with its HEAD sha. Evidence files name the check scripts by file name only, never a temp-directory or other full local path (integrator cross-lane note, 2026-09-29).
- **AC7 (hygiene and plain wording)** — Given the readability and information-hygiene rules (`content/const-15-core-tail.md`, Information hygiene and Generic citation), when the rewritten comments are read, then none adds an absolute path, username, employer-internal link or codename, and none uses workflow jargon (round, gate, PASS/FAIL verdict, `tw_*` call names) where plain words describe the behaviour. Real function, file, config-key and error-code names stay, because they are what the test exercises.
  proof: the added lines of `git diff 6c61864 -- test` contain no absolute home-directory path (macOS or Linux user-home form) and no URL. Run the check from a script kept in `$TMPDIR`, building the path pattern by string concatenation so this spec and the reports never hold the literal prefix. The wording is a reviewer judgment.

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
- String literals, assertion messages, `test(...)`/`describe(...)` names, filenames, fixtures (`test/fixtures/**`).
- `test/render-structure.test.mjs` and `test/context-budget.test.mjs` (lane e233f), every other `test/**` file (lanes e233c, e233e), all source directories, `dist/**`, `docs/**`, `content/**`.
- Comments that already state their behaviour in plain words with an id only as a pointer: leave them alone.
- Spec-to-test map blocks where every row already has a plain-language description (for example `AC-E1A-1 (closing write releases the lease) -> E1A-1`): conforming as-is.
- Release bookkeeping (version, CHANGELOG, backlog done-marking) belongs to release-engineer after the final verification.

## Rewrite rule (for the authoring qa-engineer)
- For every comment that relies on an id, state what the test pins and why in ordinary words, then keep the id only as a trailing pointer, e.g. `// A Blocked role may re-write Blocked (self-loop) without a routing-table row. (E128, T-QA-E128-01)`.
- Section-header labels that are also the test-name prefix or are cited from another file (see AC3), such as `T-MATRIX-A5(a)`, `FM2`, `R11`, `I4`: keep the token, move it after the plain description.
- Test-local labels (`R11`, `E1A-3a`, `AC6`) that match the `test(...)` name on the next line are not backlog ids. They are fine when the comment also says what is checked.
- References to review or QA report files (`review_T-E128-02.md C3`) become plain words ("an earlier code review confirmed this by running it"). Keep the path only if it is tracked, and only as a trailing pointer.
- Tracked spec paths (`specs/e235a-relative-prd-path.md`) are allowed as pointers.
- When a block is mostly history ("originally…", "after the bug in…"), keep the reason for today's behaviour and drop the story.
- Do not reflow code, do not move a comment across a statement, and do not turn a line comment into a block comment or back.

## Verification scripts
All three run from the lane root, use the repo's own `typescript`, and live in `$TMPDIR` or the scratchpad.

`check-invariance.mjs`:
```js
import ts from "typescript";
import { execSync } from "node:child_process";
import fs from "node:fs";
const files = execSync("git diff --name-only 6c61864 -- test", { encoding: "utf8" }).split("\n").filter((f) => f.endsWith(".mjs"));
const out = (src, f) => ts.transpileModule(src, { fileName: f, compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, allowJs: true, removeComments: true } }).outputText;
let bad = 0;
for (const f of files) {
  const before = execSync(`git show 6c61864:${f}`, { encoding: "utf8", maxBuffer: 1 << 26 });
  if (out(before, f) !== out(fs.readFileSync(f, "utf8"), f)) { console.log("DIFF", f); bad++; }
}
if (bad) process.exit(1);
console.log(`invariance OK: ${files.length} files`);
```
`check-bare-ids.mjs`: for each owned file, collect comment ranges with `ts.createSourceFile` plus `getLeadingCommentRanges`/`getTrailingCommentRanges`, and join adjacent line comments into blocks. For each block that matches `/\b(?:[ECDR]\d+[a-z]?\d*|T-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/` or a parenthesised lower-case slug, remove the ids, the slugs, `docs/backlog.md row …` phrases and punctuation. Fail when fewer than 3 words remain. Print each offender as `file:line`.

`check-xrefs.mjs`: for each owned file `F`, grep every tracked file except `F` for `F`'s path followed on the same line by id or label tokens (`[A-Z][A-Z0-9-]*\d[\w()-]*`). Fail if any such token appears in `F` at 6c61864 but not at HEAD. Print `file: token (cited from <file>)`.

## Dependencies / Prerequisites
- The readability rule from E231 has shipped (`specs/e231-info-hygiene-rule.md`). No design file (mode no-design; Visual Structural Assertions omitted). Resource Audit: the only external-style strings in scope are pre-existing comment text, and none is load-bearing for this spec, so `external_refs` is omitted.
- Integrator guidance (`to-lane#1`): every full-suite run goes through `node scripts/test-lock.mjs -- npm test`.
- Scope: `single-feature`. The fan-out already split E233 by directory; inside this lane the work is serial with disjoint files per task.
- Dispatch pins: `sr-engineer=fable`, which the coordinator will persist. **The pin is inert for this lane**: the chain has no sr-engineer hop, because only qa-engineer may write `test/` (Constitution §2).

## Chain (ALLOWED_TRANSITIONS edges, `tools/transitions.ts`)
Builder ≠ judge (§3.2) holds through three separate contexts: qa-engineer **A** authors, code-reviewer **B** judges the diff, and a fresh qa-engineer **C** verifies and writes the final verdict. sr-engineer cannot write `test/`, and `pm:In_Progress → qa-engineer:In_Progress` is closed unless `resume_of` is set, so the chain enters through the single-role judge-dispatch door (§3.1, `resume_of`-gated). A qa-engineer context has no direct edge to code-reviewer, so the authoring context hands back through Blocked:

| # | edge | writer | notes |
|---|---|---|---|
| 1 | `null:null → pm:In_Progress` | pm (this hop) | cut, tasks, `scope_decision`; `next_role=qa-engineer` |
| 2 | `pm:In_Progress → qa-engineer:In_Progress` | qa **A** (routing write carries `resume_of: "qa-engineer"`) | Before editing: record the baseline suite counts at 6c61864. Then T-E233D-01..13, commit, run the three check scripts, write an author report to `qa_reports/author_E233D.md`. No verdict. |
| 3 | `qa-engineer:In_Progress → qa-engineer:Blocked` | qa **A** | `blocking_reason` and `pending_notes` in the escalation-call format: `qa-engineer: authoring done, not a failure — the approved cut needs an independent review`. `next_role=pm`. This is a handoff, not a defect. |
| 4 | `qa-engineer:Blocked → pm:In_Progress` | pm relay | `next_role=code-reviewer` |
| 5 | `pm:In_Progress → code-reviewer:In_Progress` | code-reviewer **B** (`resume_of: "code-reviewer"`) | Judges the diff against AC1–AC5 and AC7, and samples 25 blocks. Writes `review_verdict=APPROVED` with `review_task_ids=[T-E233D-01..13]`, which records `review_reports/review_T-E233D-NN.md`. |
| 6 | `code-reviewer:In_Progress → qa-engineer:In_Progress` | qa **C** (fresh context, never **A**) | Re-runs every `proof:` line verbatim, including AC6 after commit on a clean tree. Writes no `test/` file. |
| 7 | `qa-engineer:In_Progress → qa-engineer:PASS` | qa **C** | `tw_complete_task` for T-E233D-01..13 |

Failure loops: `code-reviewer:FAIL → pm:In_Progress → qa-engineer:In_Progress` (`resume_of`, context **A** or another authoring context, never **C**), then back through steps 3–5. `qa-engineer:FAIL` (from **C**) → `pm:In_Progress` → same loop. The happy path costs about 6 counted hops, and each fix loop adds about 4, so one fix loop fits under the hop cap of 10. A second loop means going back to the integrator. Expected stop: when qa **A** writes Blocked in step 3, the lane coordinator stops once and asks the human, as it does for any Blocked write; the human replies "continue" in the lane session and the relay resumes at step 4. This stop is part of the approved plan, not a failure. The same handoff path is shared by all three test-comment lanes (integrator pre-review, 2026-09-29). The cut-approval gate does not arm on the `resume_of` edges. The human's approval of this cut is still required before step 2, and the coordinator relays it.

## Task cut
Partitioned by file. Line counts are id-bearing comment lines from the scan above (the upper bound). Each task only rewrites comments.

| id | files | id-lines |
|---|---|---|
| T-E233D-01 | `qa-flow` | 85 |
| T-E233D-02 | `feature-lease` | 63 |
| T-E233D-03 | `e32-e33-gate-hardening`, `e235b-relative-worktree`, `e213-shipped-ignored-shape` | 68 |
| T-E233D-04 | `e22-stale-notify`, `error-code-contract`, `e90-golden-capture-completeness` | 62 |
| T-E233D-05 | `feature-rollup`, `lane-paths`, `e239-init-subdir-exclude`, `lane-paths-history` | 56 |
| T-E233D-06 | `e26-gate-stats`, `e38-next-role-lookahead`, `e28-shrink-warning`, `e234-hygiene-scan` | 61 |
| T-E233D-07 | `lane-migrate`, `prompt-state-footer`, `qa-visual-skill-split`, `e23-evidence-schema`, `e31-config-nonfatal` | 61 |
| T-E233D-08 | `qa-review-scoped-append`, `e20-e21-crash-resilience`, `e43-test-file-ask-at-dispatch`, `e96-dispatch-preference`, `e92-e86-handoff-write-boundary` | 50 |
| T-E233D-09 | `e24-exemptions`, `p0-onboarding-lite-default`, `e35-pipeline-order`, `e250-eject-path-escape`, `e5-intake-tiering` | 35 |
| T-E233D-10 | `gates-expected-red`, `hop-count-transitions`, `lane-ticket-allocation`, `e248-relative-mailbox-header`, `handoff-migration` | 21 |
| T-E233D-11 | `e223-watch-rearm-gone`, `e92-e86-handoff-write-boundary-repro`, `phase-0-5-sop`, `pixel-gate-attestation`, `e231-info-hygiene-rule` | 9 |
| T-E233D-12 | `feature-scope-gate`, `feature-split-lifecycle`, `handoff-write-arg-guard`, `pixel-perfect-design-coverage`, `pixel-perfect-visual-compare` | 5 |
| T-E233D-13 | `handoff-versioning`, `e235a-relative-prd-path` (slug-only citations); a file still flagged by `check-bare-ids.mjs` goes back to the task that owns it | 14 |

All names above are `test/<name>.test.mjs`. `test/file-lock.test.mjs` and `test/handoff.test.mjs` have no hits, so no task touches them.
