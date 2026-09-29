# e233c-test-comments-a

Lane e233c of E233 (fan-out plan: `specs/fanout-e233.md`). First of three `test/` batches.

## Problem Statement

Many comments in the test suite explain themselves only by citing a backlog or task id
(`// E31 (e31-config-nonfatal): …`, `// T-E123B9-08 (AC21) addendum`), so a reader without this
repo's backlog cannot tell what the test protects or why. The constitution's Generic-citation rule
(Information hygiene + Generic citation, `content/const-15-core-tail.md`) and the readability
rule in `specs/e231-info-hygiene-rule.md` say a bare id must not be the only explanation. This
lane rewrites those comments, in the 60 owned test files only, so each states the behaviour or
the reason in plain words, keeping an id only as a trailing pointer such as `… (E31)`. Nothing
but comments may change.

Measured at base 6c61864 with `^\s*(//|\*|/\*).*\bE[0-9]{1,3}` over the owned set: 353 comment
lines in 53 of the 60 files (the coordinator's earlier measurement was 315 lines in 47 files;
the difference is regex scope, so the ACs below are defined by the regex and the mechanical
checks, never by a line count). Many of those lines already explain in plain words and merely
carry an id; those need no change.

## User Stories

- As an agent or contributor who does not use this repo's backlog, I want each test comment to say
  what behaviour it protects and why, so that I can judge whether a test is still needed.
- As the integrator, I want proof that the pass changed comments only, so that I can merge it
  without re-reviewing 60 files line by line.

## Acceptance Criteria

Owned set (60 tracked files): `test/{a,b,d}*.test.mjs`, `test/{ch,com,conf,cons,cov,cu}*.test.mjs`,
`test/e1*.mjs` (includes the non-`.test` file `test/e148-seed-stamp.mjs`).

- **AC1 (behaviour unchanged, mechanical)** — Given the base commit 6c61864 and the lane HEAD,
  when every changed owned file is compared with all comments removed (TypeScript
  `transpileModule` with `removeComments: true`, target/module ESNext, applied to the base blob
  and to the working file), then the two outputs are byte-identical for every changed file. This
  also proves no string literal, test name, assertion message, or assertion changed.
  proof: nothing new is added to the repo for this check; from the worktree run
  `node --input-type=module -e "import ts from 'typescript';import {execSync as x} from 'node:child_process';import fs from 'node:fs';const o={compilerOptions:{removeComments:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext}};let bad=0;for(const f of x('git diff --name-only 6c61864 -- test',{encoding:'utf8'}).split('\n').filter(l=>l.endsWith('.mjs'))){const a=ts.transpileModule(x('git show 6c61864:'+f,{encoding:'utf8',maxBuffer:1e8}),o).outputText;const b=ts.transpileModule(fs.readFileSync(f,'utf8'),o).outputText;if(a!==b){bad++;console.log('DIFF',f)}}console.log('bad='+bad);process.exit(bad?1:0)"`
  prints `bad=0` and exits 0. (The `git show` here is a verification command run by qa, not a
  test file, so it does not violate the no-history-fixture meta-test.)
- **AC2 (file scope)** — Given the lane branch, when `git diff --name-only 6c61864..HEAD` is
  listed, then every path is inside the owned set, or is one of `specs/e233c-*`,
  `qa_reports/*E233C*`, `review_reports/*E233C*`, `.current/e233c/**`. No other test, `content/**`,
  golden, `test/context-budget.test.mjs`, `test/render-structure.test.mjs`, fixture, source
  directory, `dist/**`, `docs/**`, `CHANGELOG.md` or `package.json` change.
  proof: `git diff --name-only 6c61864..HEAD | grep -vE '^test/([abd][^/]*\.test\.mjs|(ch|com|conf|cons|cov|cu)[^/]*\.test\.mjs|e1[^/]*\.mjs)$|^(specs/e233c-|qa_reports/.*E233C|review_reports/.*E233C|\.current/e233c/)'` prints nothing.
- **AC3 (readability, judged)** — Given each comment in the owned set that cites an id, when it
  is read alone, then either it already states the behaviour or reason in plain words (left
  unchanged), or it was rewritten so that removing the id would still leave a complete
  explanation, with the id only as a trailing pointer. Judged per comment by code-reviewer
  against the diff; subjective by nature, so no single-command proof.
- **AC4 (residual bare-id check, advisory heuristic)** — Given the changed files at HEAD, when
  each comment line or contiguous comment block that cites an id is stripped of id tokens
  (`T-E[0-9A-Z]+(-\d+)?`, `E\d+[a-z0-9]*(-NEW-\d+)?`, `AC\d+`) and of punctuation, then no block
  is left with fewer than 4 words. Blocks the heuristic flags are listed in the qa evidence and
  each is dispositioned (rewritten, or justified as already plain). The heuristic aids the
  reviewer; it does not replace AC3.
  proof: `git diff -U0 6c61864..HEAD -- test | grep -E '^\+\s*(//|\*|/\*)' | sed -E 's/T-E[0-9A-Z]+(-[0-9]+)?//g; s/E[0-9]+[a-z0-9]*(-NEW-[0-9]+)?//g; s/AC[0-9]+//g; s/^\+\s*(\/\/|\*|\/\*)//; s/[^A-Za-z ]//g' | awk 'NF>0 && NF<4'` output is empty or fully dispositioned in the evidence.
- **AC5 (new-text hygiene)** — Given the added comment lines, when scanned, then none contains an
  absolute local path, a username, an employer-internal URL or a design-tool file key, and none
  introduces text the history-fixture meta-test (`test/render-structure.test.mjs`) flags
  (a pinned commit sha, `git show <rev>:<path>`, or `git log`). Existing comment mentions of
  `qa_reports/`/`review_reports/` files stay as they are (see Open Questions).
  proof: `git diff -U0 6c61864..HEAD -- test | grep -E '^\+' | grep -nE '/Users/|/home/|https?://|git show|git log'` prints nothing.
- **AC6 (full suite, post-commit)** — Given the author's rewrite is committed and the worktree has
  no untracked files, when `node scripts/test-lock.mjs -- npm test` runs from the worktree, then
  it exits 0 with the same pass count as base (no test added, removed or renamed), and
  `git status --porcelain` is empty before and after the run.
  proof: `git status --porcelain` (empty) then `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` ends with `exit=0`.
- **AC7 (cross-test coupling)** — Given some tests read other test files as text, when the suite
  runs (AC6), then those tests still pass. Coupling found by grepping `test/` for reads of
  `test/*.mjs` paths: `test/e90-golden-capture-completeness.test.mjs` reads the owned
  `test/compose-equivalence.test.mjs` (it extracts build-mode filenames from code, not
  comments); `test/render-structure.test.mjs` scans every `test/**/*.mjs` for history-fixture
  reads (AC5 covers the risk); `test/error-code-contract.test.mjs` reads itself and is not owned.
  `test/e122-state-render-injection.test.mjs` (owned) reads `test/render-structure.test.mjs`
  (not owned) and `test/e178a-integrator-role.test.mjs` (owned) reads
  `test/skill-frontmatter.test.mjs` (not owned); neither reads an owned file as text. No owned
  file is read as text by another test in a way comment edits could break, except the
  compose-equivalence read above, which matches code.
  proof: `grep -nE 'readFileSync\(.*test.*\.mjs' test/*.mjs` lists no read of an owned file
  other than `compose-equivalence.test.mjs`, and AC6 exits 0.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no user-facing strings; only code comments change |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any change to assertions, test names, assertion messages, string literals, filenames, or
  `.mjs` behaviour; any new or removed test.
- All non-owned paths (see AC2), including the other test batches (e233d, e233e), the two shared
  files owned by e233f, and `test/fixtures/**`.
- Comments that cite only a path under `qa_reports/` or `review_reports/`; rewording them is not
  required unless the comment is otherwise a bare-id explanation.
- Renaming the `T-E…` ids inside test names or messages (those are pinned output).

## Dependencies / Prerequisites

- E231 (the hygiene rule) is shipped. No other lane's output is needed; e233c touches only its
  owned files.
- Chain design (PM decision, amended after integrator pre-review; same handoff path in all three
  test lanes): only qa-engineer may write `test/` (Constitution §2) and builder must not judge
  (§3.2), so two distinct qa-engineer contexts are used with an independent code-reviewer
  between them. Every run that commits ends with its own state write (const-05).
  1. After cut approval (`cut_approved` set by the coordinator on the `pm:In_Progress` tuple),
     author hop A: a qa-engineer subagent writes `qa-engineer:In_Progress` with
     `resume_of: qa-engineer`, rewrites the comments, commits
     (`test(e233c): E233 T-E233C-01 — …`) and runs AC1/AC2/AC4/AC5 plus the per-file tests.
  2. A then writes `qa-engineer:Blocked`, `next_role: pm`, with the Escalation call format note
     "qa-engineer: authoring complete, not a failure — the approved cut requires independent
     review". This is the only honest legal hand-off edge out of `qa-engineer:In_Progress`. The
     lane coordinator stops once here per SOP and the human replies "continue" in the lane session.
  3. PM routes `pm:In_Progress` → `code-reviewer:In_Progress` with `resume_of: code-reviewer`. An
     independent code-reviewer judges the diff (AC1–AC5, AC7) and writes `APPROVED` or
     `CHANGES_REQUESTED`. On CHANGES_REQUESTED the fix goes back to a fresh author dispatch via PM;
     the review round cap applies.
  4. Verify hop: on APPROVED, a FRESH qa-engineer Task dispatch (never the author A context)
     re-runs AC1–AC7, records evidence under `qa_reports/*E233C*`, and writes PASS (T-E233C-02).
     No architect, researcher, sr-engineer or design-auditor hop: comment-only pass, no design or
     production-code change (`sr-engineer=fable` pin is unused here). No qa-visual.
- External references: none. `docs/backlog.md` row E233 and `specs/fanout-e233.md` are tracked
  in-repo. No `external_refs` entry.
- Scope decision: `single-feature`. One mechanical pass over one file class with a single
  mechanical verifier; splitting further would multiply review overhead without reducing risk,
  and `.current/feature-split.md` is not needed (the three test batches are already separate
  lanes).

## Resolved Questions (integrator pre-review, 2026-09-29)

1. Same-role independence: satisfied. The builder != judge test is an independent qa-engineer
   context, not a different role name. Conditions: T-E233C-02 MUST be a new Task dispatch, never a
   continuation of the author context; the author context writes no state and no verdict; the
   author's and the verifier's `qa_reports/*E233C*` file names must tell the two apart (e.g.
   `…E233C-01-author…` vs `…E233C-02-verify…`).
2. Evidence-path citations: the `qa_reports/` / `review_reports/` paths themselves stay as they
   are. But a comment whose only explanation is a ticket id plus an evidence path still gets one
   plain-language sentence saying what it tests, with the path kept as a trailing pointer (already
   covered by AC3).
3. Count mismatch: accepted. The ACs are defined by the regex; the line counts are estimates that
   differ only in scan width.
