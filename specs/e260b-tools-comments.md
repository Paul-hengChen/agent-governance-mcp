# e260b-tools-comments

Lane e260b of the E260 fan-out (backlog E260). Base commit b37178a. Owns `tools/{i..z}*` (23 files) and the matching `dist/tools/{i..z}*`. Sibling lane e260a owns `tools/{a..h}*`.

## Problem Statement
The 23 files `tools/{i..z}*` carry 23 comment blocks longer than 20 lines (longest 68) and 60 blocks of 8-20 lines, counted by `analyzeText` from `dist/tools/comment-scan.js` (the same counter `agc check` uses). The repo's comment rule caps a block at 7 lines. This lane trims those blocks without changing behaviour, moves any rationale still worth keeping into this lane's tracked spec files, and fixes the bare-ticket-id comments (Generic citations) that remain in the same files.

## User Stories
- As a contributor reading `tools/`, I want comments short enough to read in passing, so that the code stays the main thing on screen.
- As a maintainer, I want rationale that was worth keeping to live in a tracked spec with a one-line pointer in the code, so that nothing of value is lost by trimming.
- As a reviewer, I want a mechanical proof that only comments changed, so that I can approve a large trim without reading every hunk for logic.

## Acceptance Criteria
- **AC1 (behaviour invariance)** — Given every `tools/*.ts` file this lane changes, when each is transpiled with TypeScript `transpileModule` (`removeComments: true`, target and module ESNext) at the base commit and at HEAD, then the two outputs are byte-identical for every file.
  proof: `node .current/e260b/check-invariance.mjs` (run from the lane root) prints `invariance OK: <n> files` and exits 0. Design in "Proof scripts" below.
- **AC2 (no long blocks)** — Given the 23 files `tools/{i..z}*.ts`, when each is scanned with `analyzeText`, then no comment block counts more than 20 lines.
  proof: `node .current/e260b/measure-comments.mjs` prints `over20: 0` and exits 0.
- **AC3 (8-20 line blocks)** — Given the same scan, when a block still counts 8-20 lines, then it has a one-line keep-reason in the "Kept 8-20 line blocks" table of `specs/e260b-rationale.md`, keyed by `file:start-end` as scanned at HEAD.
  proof: `node .current/e260b/measure-comments.mjs` prints `mid-unjustified: 0` and exits 0 (it cross-checks the table against the scan). The code-reviewer COPIES one line per kept block (key + reason) into the review report; a citation of the table alone does not satisfy AC3 (integrator pre-review, to-lane#1).
- **AC4 (pinned watch-block prefix)** — Given `test/e178b-lane-watch.test.mjs` locates the watch block by source text, when `tools/lane-status.ts` is edited, then a line starting with `// Watch mode (E178b` still exists verbatim.
  proof: `grep -c '^ *// Watch mode (E178b' tools/lane-status.ts` prints at least `1`.
- **AC5 (comment style kept)** — Given two tests filter `tools/lane-status.ts` by `//`-prefixed lines, when the lane edits any file, then no `//` comment becomes a `/* */` block, no JSDoc becomes `//`, and no new block comment is introduced in `tools/lane-status.ts`.
  proof: `git diff b37178a -- tools | grep -E '^\+' | grep -E '^\+\s*/\*' | grep -vE '^\+\s*/\*\*'` prints nothing, and `git diff b37178a -- tools/lane-status.ts | grep -cE '^\+.*/\*'` prints `0`.
- **AC6 (`// Coded by` markers kept)** — Given each file may start with a `// Coded by @<role>` marker, when the lane finishes, then every marker line present at base is still present.
  proof: `for f in $(git diff --name-only b37178a -- 'tools/*.ts'); do a=$(git show b37178a:$f | grep -c '^// Coded by @'); b=$(grep -c '^// Coded by @' $f); [ "$a" = "$b" ] || echo "MARKER $f $a $b"; done` prints nothing.
- **AC7 (no non-comment text touched)** — Given string literals, error messages and tool descriptions are behaviour, when the diff is inspected, then no added or removed line is anything other than a comment line or a blank line next to one.
  proof: AC1 passes, and `git diff -U0 b37178a -- tools | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*)'` prints nothing except code lines whose only change is in their trailing comment (each listed in the review). Such lines are allowed as long as AC1 passes (integrator pre-review, to-lane#1).
- **AC8 (Generic citations fixed)** — Given a comment whose only explanation is a ticket id or slug, when it sits in the 23 files, then it states behaviour and reason in words, with the id at most a trailing pointer.
  proof: `git diff b37178a -- tools | grep -E '^\+' | grep -E '\b[Ee][0-9]+[a-z]?\b'` is listed in the review report and each hit has words besides the id (reviewer judgment; no single-command truth).
- **AC9 (rationale preserved)** — Given a trimmed block held rationale worth keeping, when the lane finishes, then that rationale is recorded in `specs/e260b-rationale.md` (per file) and the comment keeps at most one pointer line to it.
  proof: `test -s specs/e260b-rationale.md && grep -c '^## tools/' specs/e260b-rationale.md` prints a number at least equal to the number of files that had a block over 20 lines (reviewer spot-checks 5 pointers).
- **AC10 (hygiene)** — Given the information-hygiene rule, when comments and spec/evidence files are read, then none holds an absolute local path, username or internal link.
  proof: `git diff b37178a -- tools specs/e260b-rationale.md .current/e260b | grep -E '^\+' | grep -E '/U[s]ers/|/h[o]me/|https?://'` prints nothing.
- **AC11 (generated output rebuilt, nothing else touched)** — Given `tsconfig.json` does not set `removeComments`, when sources change, then `dist/tools/{i..z}*` is rebuilt and committed, and no file outside the owned set changes.
  proof: `npm run build && git status --porcelain` prints nothing after the commit, and `git diff --name-only b37178a | grep -vE '^(tools/[i-z]|dist/tools/[i-z]|specs/e260b-|qa_reports/.*E260B|review_reports/.*E260B|\.current/e260b/)'` prints nothing (`.current/` handoff and ledger files are the allowed exception only if untracked at the top level).
- **AC12 (transitions mirror intact)** — Given `scripts/check-transitions-sync.mjs` reads `dist/tools/transitions.js` data and a markdown table, never comments, when `tools/transitions.ts` is trimmed, then the sync check still passes.
  proof: `npm run build` exits 0 (its `postbuild` runs the sync check).
- **AC14 (comment-text pins kept)** — Given three tests read comment text in this lane's files, when the lane finishes, then: `tools/lane-status.ts` keeps a line starting `// Watch mode (E178b` (test/e178b-lane-watch AC7 tick); `tools/join-precondition.ts` contains the substring `HOOK POINT FOR E126` exactly once (test/e115-join-precondition AC6; never repeat the phrase in a pointer); `tools/storage.ts` keeps `@deprecated v3.15.0:` exactly as many times as at base (2; test/writestate-options-object AC-9 on the HandoffStorage overloads). And for each grep-pinned token — `lane-paths`, `resolveLanePaths`, `resolveCurrentLane` (test/lane-paths.test.mjs CALLERS1–3), `migrateFlatToLaneLocked`, `migrateFlatToLane(`, `migrateLaneToFlat(` (test/lane-migrate.test.mjs CALLERS1, CALLERS-LOCKED) — the per-file occurrence count across `tools/*` is unchanged from base. These tests grep source text as exact allow-lists, so adding or removing a token in a comment fails them (token list extended after T-E260B-04, sr finding).
  proof: `node .current/e260b/check-invariance.mjs` checks all four pins (see "Proof scripts") and exits 1 with `PIN <file> <pin>` on any miss.
- **AC13 (suite green)** — Given the change is comment-only, when the full suite runs on the final committed HEAD with a clean tree, then it passes with no failures.
  proof: `node scripts/test-lock.mjs -- npm test` reports 0 failures (run by qa after the last commit; `git status --porcelain` empty first).

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
- String literals, error messages, tool `description` strings, identifiers, test names.
- Any file outside `tools/{i..z}*`, `dist/tools/{i..z}*` and this lane's spec, evidence and `.current/e260b/` files. In particular `tools/{a..h}*` (lane e260a), `test/**`, `content/**`, `docs/backlog.md`, `specs/fanout-*.md`.
- Any test change. If one proves necessary, the coordinator mails the integrator first.
- Release bookkeeping (version, CHANGELOG, backlog done-marking): integrator or release-engineer.
- `/*!` banners and `/// <reference` lines stay untouched.

## Dependencies / Prerequisites
E258 (comment discipline rule) shipped. No design file (mode = no-design; Visual Structural Assertions omitted). Resource Audit: zero external references.

Cut shape: serial, one lane, disjoint files per task; no parallel cut inside the lane. Chain: sr-engineer (pinned fable) then code-reviewer then qa-engineer, one pass over the batch.

Dispatch pin: `sr-engineer = fable` (human, lane-wide).

Checked at cut time: `scripts/check-transitions-sync.mjs` imports `dist/tools/transitions.js` and parses a spec table; it does not read comments, so trimming `tools/transitions.ts` cannot trip it. The pinned-text tests are `test/e178b-lane-watch.test.mjs:572` (watch prefix) and the `//`-line filters on `tools/lane-status.ts` (`test/e177b-lane-status.test.mjs:165`, `test/e235b-relative-worktree.test.mjs:296`); AC4 and AC5 guard them.

## Trim rule (for sr-engineer)
- Block over 20 lines: always cut. Block of 8-20 lines: cut to 7 lines or fewer, or keep and record a one-line reason in `specs/e260b-rationale.md`. Count with `analyzeText` (`measure-comments.mjs` does it); JSDoc marker lines and separator-only lines do not count.
- Keep what the next reader needs: what the code does and the one non-obvious reason. Drop history ("originally", "after the bug in"), restated code, and ticket narrative.
- Rationale worth keeping goes to `specs/e260b-rationale.md` under a `## tools/<file>` heading before the comment is cut; the comment keeps at most one line such as `// Why: specs/e260b-rationale.md (tools/<file>)`. Only add a pointer where real rationale was moved.
- Comment-text pins (AC14): keep `// Watch mode (E178b` at line start in `tools/lane-status.ts`; keep `HOOK POINT FOR E126` exactly once in `tools/join-precondition.ts`; keep both `@deprecated v3.15.0:` JSDoc tags in `tools/storage.ts`; never add or remove any AC14 grep-pinned token (`lane-paths`, `resolveLanePaths`, `resolveCurrentLane`, `migrateFlatToLaneLocked`, `migrateFlatToLane(`, `migrateLaneToFlat(`) in any comment, pointer comments included.
- Keep `// Coded by @<role>` lines. Keep style: `//` stays `//`, JSDoc stays JSDoc. In `tools/lane-status.ts` keep the line beginning `// Watch mode (E178b` verbatim (rest of the line may change).
- Fix remaining Generic citations in the same file in the same pass (state behaviour and reason; id only as a trailing pointer).
- Do not reflow code or change blank-line structure beyond the comment itself. No local absolute paths anywhere.
- Do not edit `tools/{a..h}*` or `test/**`.

## Proof scripts (live in `.current/e260b/`, committed with the lane; written in T-E260B-01)
Both use the repo's own `typescript` and `dist/tools/comment-scan.js`; both run from the lane root.

`check-invariance.mjs`
- Base: first CLI argument, else the single line of `.current/e260b/base-sha`, else the literal `b37178a`. It must resolve with `git rev-parse --verify <base>^{commit}`; failure exits 2.
- Files iterated: the union of `git diff --name-only <base> -- tools` (covers committed and uncommitted changes) filtered to `.ts`, excluding deleted files. Zero files exits 2 (a vacuous pass is a failure). Any changed `tools/*.ts` whose basename does not start with `i`-`z` exits 1 with `SCOPE <file>`.
- Before: `git show <base>:<path>` (`maxBuffer` 64 MB). After: the working-tree file. Both go through `ts.transpileModule(src, { fileName: <path>, compilerOptions: { target: ESNext, module: ESNext, removeComments: true } }).outputText`; compare strings with `===`.
- Pins (AC14): after the diff loop, asserts the four comment-text pins against the working tree: `^\s*// Watch mode \(E178b` present in `tools/lane-status.ts`; `HOOK POINT FOR E126` count === 1 in `tools/join-precondition.ts`; `@deprecated v3.15.0:` count in `tools/storage.ts` equals its count at base; for each grep-pinned token listed in AC14, the per-file occurrence count across `tools/*` (working tree) equals that at base. Each miss prints `PIN <file> <pin>`.
- Output and exit: prints `DIFF <path>` per mismatch; exit 1 if any DIFF, SCOPE or PIN; otherwise prints `invariance OK: <n> files` and exits 0. A `--self-test` flag transpiles a sample with and without an appended statement and exits 0 only if they differ and a comment-only edit does not (guards against a script that cannot fail).

`measure-comments.mjs`
- Reads `tools/{i..z}*.ts` (`git ls-files` filtered; expects 23), runs `analyzeText(text)` from `dist/tools/comment-scan.js` (so run after `npm run build`), and collects blocks by `counted`: 8-20 and over 20.
- Prints per-file `start-end:counted` lists like the baseline, then `over20: <n>`, `mid: <n>`, `mid-unjustified: <n>`. `mid-unjustified` counts 8-20 line blocks whose `file:start-end` key is missing from the "Kept 8-20 line blocks" table in `specs/e260b-rationale.md` (table absent counts every mid block as unjustified).
- Exit 0 only when `over20` and `mid-unjustified` are both 0; exit 1 otherwise; exit 2 if `dist/tools/comment-scan.js` is missing or the file count is not 23.

## Task cut
Budget: at most 5 files and 300 changed lines per task. Baseline long-block lines (sum of counted lines in blocks over 7) are the size estimate: they are mostly deletions, so each task sits well under 300 changed lines. Tasks 02-08 each append their files' rationale to `specs/e260b-rationale.md` and run `check-invariance.mjs` and `npm run build` before handing on. Evidence of invariance output goes in the task's review notes.

| id | scope | est. files | est. changed lines |
|---|---|---|---|
| T-E260B-01 | Write `.current/e260b/check-invariance.mjs` and `measure-comments.mjs` per "Proof scripts"; create `specs/e260b-rationale.md` skeleton (including the empty "Kept 8-20 line blocks" table); run `--self-test`; no `tools/` edits | 0 source (3 new files) | about 120 |
| T-E260B-02 | `tools/lane-migrate.ts` (blocks 168 lines), `tools/join-precondition.ts` (73) | 2 | about 241 |
| T-E260B-03 | `tools/lane-paths.ts` (116), `tools/lane-registry.ts` (112) | 2 | about 228 |
| T-E260B-04 | `tools/lane-status.ts` (106; keep `// Watch mode (E178b` line and `//` style), `tools/stale-notify.ts` (39), `tools/merge-invariants.ts` (14), `tools/metrics.ts` (36) | 4 | about 195 |
| T-E260B-05 | `tools/lane-ticket-allocation.ts` (156), `tools/tasks-lane-migrate.ts` (56) | 2 | about 212 |
| T-E260B-06 | `tools/tasks-file.ts` (167), `tools/tasks.ts` (Generic-citation sweep only), `tools/storage.ts` (12), `tools/storage-sqlite.ts` (27) | 4 | about 206 |
| T-E260B-07 | `tools/registry.ts` (135; comments only, no description strings), `tools/role.ts` (9), `tools/sync.ts` (18), `tools/telemetry.ts` (14) | 4 | about 176 |
| T-E260B-08 | `tools/transitions.ts` (137), `tools/usage-accounting.ts` (20), `tools/rag-coalesce.ts` (14), `tools/rag.ts` and `tools/skill-frontmatter.ts` (Generic-citation sweep only) | 5 | about 171 |
| T-E260B-09 | Close-out: run `npm run build`, commit rebuilt `dist/tools/{i..z}*`, fill the "Kept 8-20 line blocks" table (every remaining 8-20 block, `file:start-end` at final HEAD, one-line reason), run `measure-comments.mjs` and `check-invariance.mjs` (both exit 0), run AC5-AC7, AC10, AC11 greps, confirm `git status --porcelain` empty | 0 source (dist and spec only) | dist regenerated; spec about 60 |

The final full-suite run (AC13) is qa's, on the final committed HEAD.

## Amendment 1 (after PASS, integrator close-out to-lane#3)
- **T-E260B-10**: fix review finding R1 (review_reports/review_T-E260B-01.md). The trimmed JSDoc on `enumerateLaneSidecarSources` in `tools/lane-paths.ts` says any copy that is a byte prefix of a counted copy is skipped. The code is narrower: empty files are never skipped, and a history copy is compared only against its own lane's live copy. Reword the comment to match the code (the reviewer's wording or equivalent), comment-only, at most 7 counted lines. AC1–AC14 still apply; in particular AC14 token counts must not change. Rebuild `dist/tools/lane-paths.*`. Remove R1 from the E260B-NEW-1 block in `.current/e260b/pending-tickets.md`; O1 and O3 stay.
- Chain: sr-engineer (fable) → code-reviewer → qa-engineer on the new HEAD; final full suite on the final HEAD including the evidence commit.
