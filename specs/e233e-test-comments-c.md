# e233e-test-comments-c

## Problem Statement
Roughly 26 test files in the owned set (`test/r{a,el,ep,es,ev}*.test.mjs`, `test/{s,t,u,v,w}*.test.mjs`, `test/eval/*.mjs`, fixtures excluded) carry comments whose only explanation is a ticket, AC, or task id (for example `// AC-3 bullet 1 -> FM1`, `// (T-C16-05)`). A reader outside this repo's tracker cannot tell what behaviour a test pins or why. This slice rewrites those comments into plain language (behaviour plus reason), leaving the id only as a trailing pointer, and changes nothing else. Measured on the base commit: about 386 comment lines mention an id; the heaviest files are `release-staging` (~155-200), `verify-release` (~109-155), `reviewer-completed-tasks-gate`, `stale-dispatch-detection`, `success-metrics`, `skill-manifest`. Many of those lines are already plain and only need the id kept as a pointer, so the true rewrite count is lower than the grep count.

## User Stories
- As a contributor reading a test, I want its comments to say what is being verified and why, so that I do not need the issue tracker to understand it.
- As a maintainer, I want proof that the rewrite changed no executable code, so that the slice is safe to merge without re-reviewing every test.

## Acceptance Criteria
- **AC1** - Given the owned test files, when the rewrite is complete, then no comment line in them relies on a bare ticket/AC/task id as its only explanation; an id, if kept, is a trailing parenthetical pointer next to plain language on the same line.
  proof: reviewer inspects `git diff 6c61864 -- test/` and records a per-file verdict; plus `node .current/e233e/check-id-only.mjs` (lists comment lines whose text after stripping ids has fewer than 3 words) is run as an advisory list that the reviewer triages (it never gates).
- **AC2** - Given the base commit and the working tree, when comments are stripped with TypeScript `transpileModule` (`removeComments: true`, allowJs semantics), then every touched file's output is identical before and after, and no untouched file is modified.
  proof: `node .current/e233e/check-comments-only.mjs 6c61864` exits 0 and prints `comments-only OK: N files`.
- **AC3** - Given the diff against base, when file names are listed, then every changed path is inside the owned set and none is in the forbidden set (fixtures, `test/eval/fixtures/**`, other `test/**`, source dirs, `dist/**`, `docs/**`, `content/**`, goldens, budget files).
  proof: `node .current/e233e/check-comments-only.mjs 6c61864` (the same script, path-containment step) exits 0.
- **AC4** - Given the rewritten comments, when scanned for sensitive classes, then none contains an employer-internal URL, third-party codename, design-tool file key, credential, or absolute local path or username (Information hygiene).
  proof: a scan of the lines added under `test/` since 6c61864 finds no URL and no absolute path in user-home form (the scan pattern is built at run time from parts, or kept in `$TMPDIR`, so no tracked file carries the literal prefix).
- **AC5** - Given a clean committed tree, when the full suite runs, then it passes with the same pass count as base.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 after commit, with no untracked files (`git status --porcelain` empty).
- **AC6** - Given the constraint that string literals, assertion messages, test names, and file names are pinned behaviour, when the diff is reviewed, then none of them changed.
  proof: covered mechanically by AC2 (string literals are part of the stripped output); reviewer spot-checks test names.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | - | slice edits comments only; no user-facing string is introduced or changed |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | - | - | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | - | feature has no non-primitive widgets |

## Evidence rules
- Evidence files (qa and review reports, this spec) name check scripts by file name only; they never record a temp directory or any full local path.
- The final full suite (T-E233E-24) runs on a clean tree after the LAST commit. If evidence is committed after that run, the suite runs again after that commit, and the report cites the final HEAD it ran on.

## Out of Scope
- Any non-comment change: string literals, assertion or error messages, test names, file names, logic, imports.
- `test/eval/fixtures/**`, `test/fixtures/**`, and every test file outside the owned prefix set (other lanes own them).
- `test/context-budget.test.mjs` and `test/render-structure.test.mjs` (content lane).
- Source dirs, `dist/**`, `content/**`, `docs/**`, `CHANGELOG.md`, `package.json`.
- Release bookkeeping (version, CHANGELOG, backlog done-mark): release-engineer, post-PASS.

## Dependencies / Prerequisites
- E231 (information hygiene rule) shipped.
- No design file: mode = no-design; Visual Structural Assertions omitted.
- No external references found (Resource Audit: zero hits; the spec cites only tracked paths).
- Cross-lane: no owned test reads source-file comments of another lane's files in a way this slice can break; the pinned-comment couplings in the fan-out plan belong to the tools lane. Full suite confirms.

## Cut (chain and tasks)

### Chain and builder != judge
Only qa-engineer may write `test/**`, so qa-engineer is the builder and sr-engineer is not used (the sr-engineer=fable pin is moot for this ticket). To keep builder != judge:
1. qa-engineer (author) rewrites comments, task by task, touching only owned files.
2. code-reviewer (independent, Task-dispatched, clean context) judges the diff: reads every changed comment for plain-language quality and hygiene, runs both scripts, and does not edit.
3. Final PASS is written by a NEW Task-dispatched qa-engineer context. It is never a continued conversation with the author context. The author's and the verifier's `qa_reports` filenames must be distinguishable (author work is not a PASS record; the verifier's report file name carries a `verify` marker).

### Mechanical check (authored in T-E233E-13)
- `.current/e233e/check-comments-only.mjs <base>`: for each file changed against `<base>`, loads the base and working versions, runs `ts.transpileModule(src, {compilerOptions:{target:"ESNext", module:"ESNext", allowJs:true, removeComments:true}})`, and fails on any output difference. It also fails if a changed path is outside the owned prefix set or inside the forbidden set.
- `.current/e233e/check-id-only.mjs`: lists comment lines with fewer than 3 words after ids are removed. Advisory for the reviewer only; it never gates. Its id matcher must be case-insensitive and cover every id shape used in this repo: a letter prefix (E, D, C, R and so on, upper or lower case), digits, optional trailing letter or digit segments, and optional suffixes such as `-NEW-1` or task ids like `T-D4-01`. The reviewer's sampling covers the same shapes (a sibling lane under-matched on lowercase ids with letter segments).
- Probe rule: the fail-on-code-change proof runs on copies of files under `$TMPDIR`. The working tree must never contain a non-comment change, not even temporarily.
- Both scripts are lane tooling only. They are NOT referenced by `npm test`, any test file, `package.json`, or any shipped path, and they are not shipped.

### Task sizing
task_size budget: at most 5 files AND at most 300 comment lines per rewrite task. Line counts below are id-mentioning comment lines on the base commit (upper bound for what needs touching): release-staging ~202, verify-release ~155, every group under ~165. Voided rows T-E233E-01..12 were superseded by this cut (voided ids cannot be reused, so the live rows are T-E233E-13..24).

### Tasks
| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E233E-13 | qa-engineer: author the two check scripts; prove pass on an empty diff and fail on a code-changing probe run on copies under `$TMPDIR` only | none | 2 | `.current/e233e/**` | - |
| T-E233E-14 | qa-engineer: rewrite comments in release-staging (alone) | T-E233E-13 | 1 | `test/release-staging.test.mjs` | - |
| T-E233E-15 | qa-engineer: rewrite comments in verify-release (alone) | T-E233E-13 | 1 | `test/verify-release.test.mjs` | - |
| T-E233E-16 | qa-engineer: stale-dispatch-detection, success-metrics, skill-manifest, source-credibility-gate, reviewer-completed-tasks-gate | T-E233E-13 | 5 | those five `test/*.test.mjs` | - |
| T-E233E-17 | qa-engineer: repro-first-gate, subagent-templates, schema-versions, skill-evolution-v3.11, token-budget-config | T-E233E-13 | 5 | those five `test/*.test.mjs` | - |
| T-E233E-18 | qa-engineer: usage-accounting, watermark-check, visual-evidence-gate, skill-frontmatter, telemetry | T-E233E-13 | 5 | those five `test/*.test.mjs` | - |
| T-E233E-19 | qa-engineer: tasks-versioning, rag-lifecycle, writestate-options-object, token-efficiency, `test/eval/lib/bundle.mjs` | T-E233E-13 | 5 | those four `test/*.test.mjs` plus `test/eval/lib/bundle.mjs` | - |
| T-E233E-20 | qa-engineer: teamwork-lite, tasks, visual-gate-e2e, widget-shape-spec, `test/eval/lib/assertions.mjs` | T-E233E-13 | 5 | those four `test/*.test.mjs` plus `test/eval/lib/assertions.mjs` | - |
| T-E233E-21 | qa-engineer: visual-widgets-unverified-gate, tw-sync-reconcile, `test/eval/scenarios.mjs`, `test/eval/run-eval.mjs` | T-E233E-13 | 4 | those four files | - |
| T-E233E-22 | qa-engineer: visual-round-transitions, researcher-deep-research, sqlite-versioning, session | T-E233E-13 | 4 | those four `test/*.test.mjs` | - |
| T-E233E-23 | code-reviewer (independent Task context): judge the full diff against AC1-AC4 and AC6, run both scripts, sweep the owned set for any missed id-only comment, review report | T-E233E-14..22 | 0 | `review_reports/*E233E*` | - |
| T-E233E-24 | qa-engineer verifier in a NEW Task-dispatched context: after commit on a clean tree run `node scripts/test-lock.mjs -- npm test` and the mechanical script; PASS/FAIL | T-E233E-23 | 0 | `qa_reports/*E233E*` | - |

Rewrite tasks 14-22 are pairwise disjoint in `touches` (33 files: 2 alone + 5+5+5+5+5+4+4). One commit per task, subject carrying the ticket id. The tree must be clean before T-E233E-24.

### AC to task map
| AC | implementing / proving task(s) |
|---|---|
| AC1 (no id-only comments) | T-E233E-14..22 implement; T-E233E-23 judges; `check-id-only.mjs` from T-E233E-13 |
| AC2 (comment-stripped output identical) | T-E233E-13 builds the check; T-E233E-14..22 must satisfy it; T-E233E-23 and T-E233E-24 run it |
| AC3 (path containment) | same script (T-E233E-13); run by T-E233E-23 and T-E233E-24 |
| AC4 (no sensitive detail) | T-E233E-14..22 implement; T-E233E-23 runs the grep |
| AC5 (full suite green, clean tree) | T-E233E-24 |
| AC6 (literals, test names unchanged) | T-E233E-14..22 implement; AC2 script proves; T-E233E-23 spot-checks |

## State path
Cost up front: when author A writes `qa-engineer:Blocked` (step 2), the lane coordinator stops once per its SOP and asks the human; the human replies "繼續" in that session to proceed.

Handoff edge each step takes (common path for all three test lanes):
1. pm (cut approved) to qa author A via `resume_of=qa-engineer`: A records a baseline, rewrites comments (T-E233E-13..22), commits, and runs the checks.
2. A writes `qa-engineer:Blocked` using the const-05 Escalation call format, with `pending_notes: "qa-engineer: 撰寫完成，不是失敗 — 依核准的 cut 需要獨立審查"` and `next_role=pm`. Why: const-05 requires a `tw_update_state` at the end of any state-changing run (A commits, so it must leave its own record and dispatch attestation), and in `tools/transitions.ts` `qa-engineer:In_Progress` can only go to PASS, FAIL or Blocked; Blocked to pm is the only honest legal handoff edge.
3. pm relays to code-reviewer via `resume_of=code-reviewer` (T-E233E-23), which returns APPROVED.
4. On APPROVED, a brand-new Task-dispatched qa verifier (not A) reruns every proof and writes PASS (T-E233E-24).

## Decisions (former open questions, resolved)
1. Final PASS is written by a fresh, non-authoring qa-engineer context (new Task dispatch), not the author context.
2. The id-only "fewer than 3 words" check stays advisory for the reviewer; plain-language quality remains a reviewer judgment.
