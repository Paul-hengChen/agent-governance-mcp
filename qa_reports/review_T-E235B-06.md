# Review — T-E235B-06 (batched qa pass, round 1)

covers: T-E235B-02, T-E235B-03, T-E235B-04, T-E235B-05, T-E235B-06, T-E235B-07, T-E235B-08, T-E235B-09, T-E235B-10, T-E235B-11, T-E235B-12, T-E235B-13, T-E235B-14, T-E235B-15, T-E235B-16

## <2026-09-28T07:30:00Z> — PASS — by qa-engineer

Reviewer/executor model: sonnet, dispatched via Task. sr-engineer was pinned to fable; code-reviewer (round 1, `review_reports/review_T-E235B-02.md`) ran on opus and returned APPROVED with zero required findings for T-E235B-02..05, 09..14. This is the single qa pass over that approved sr work plus the qa-owned tasks T-E235B-06, 07, 08, 15, 16, judged against `specs/e235b-relative-manifest-worktree.md` (AC1-13) and `specs/e235b-relative-manifest-worktree-architecture.md` (regression cases R1-R11).

## Phase 0.5 — Expected-Red Diff

`qa_reports/expected-red_e235b-relative-manifest-worktree.txt` exists (2 entries): `test/e177a-check-cli.test.mjs | AC15 CLI contract` and `test/e177a-manifest.test.mjs | AC2 validate wave7 exit 0`. Both assert an exact-string `runValidate` stdout against the (pre-rewrite) `test/fixtures/e177a/fanout-wave7.md` fixture, which still carried absolute worktree cells at code-review time — the new absolute-cell WARN line (T-E235B-02) broke the exact-string match until T-E235B-06 rewrote the fixture.

Round-1 code review (`review_reports/review_T-E235B-02.md`, "Expected-red sampling") ran the full suite before any qa-owned fixture edit and recorded exactly these 2 failures and no others: 2891 tests, 2886 pass, 2 fail, 3 skip — the 2 failures being precisely the 2 manifest entries, sampled and confirmed real. That is the pre-edit baseline: 0 unexplained reds at that point.

After this round's T-E235B-06 fixture rewrite (`test/fixtures/e177a/**`, `test/fixtures/e178b/**` worktree cells rewritten to the primary-relative form; `render-e177a.golden.txt` regenerated), both manifest entries were re-run individually and are green (`node --test test/e177a-manifest.test.mjs test/e177a-check-cli.test.mjs` → 15/15 and 5/5 pass, "AC2 validate wave7 exit 0" and "AC15 CLI contract" both `ok`). The post-edit full suite (`npm test`) is 2899/2902 pass, 0 fail, 3 skip (the +11 net tests are the new `test/e235b-relative-worktree.test.mjs` regression file).

**Phase 0.5: clean (2/2 manifest entries confirmed red pre-edit by the round-1 review, both now confirmed green post-edit, 0 unexplained reds).**

## Phase 1 — Review

Read `tools/fanout-manifest.ts` (`resolveWorktree`, `isAbsoluteWorktree`, `renderPrompt`'s worktree resolution step, `runValidate`'s WARN line), `docs/lane-protocol.md`'s new bullet, and the full diff of `specs/fanout-*.md` (9 files) against the architecture's Interface Contracts §5 rewrite rule. No new correctness findings beyond round 1's APPROVED verdict — this pass is qa-owned test/fixture work plus a re-scan, not a second code review of the same diff.

**Copy Audit Gate / Visual Audit Gate: N/A.** `specs/e235b-relative-manifest-worktree.md` has no `## Copy / Strings` or `## Visual Tokens` H2 — this is a tooling/CLI-format ticket with no user-facing UI copy or visual tokens (consistent with the sibling `specs/e177a-fanout-manifest.md` / `specs/e177b-lane-status-tooling.md` tickets in this codebase, which are also CLI/tooling specs without those sections).

## Phase 1.5 — Visual Compare

**Phase 1.5: skipped (no `design/e235b-*.md` file, no Visual Baselines declared).** Non-UI feature.

## Phase 3 — Tests

### Spec-to-Test map (this round's qa-owned scope)

| AC | Test(s) |
|---|---|
| AC1 | R1 relative resolves; R8 parse unaffected; R11 repo sweep (`test/e235b-relative-worktree.test.mjs`) |
| AC2 | R1, R2 absolute passes through byte-verbatim, R3 AC2 golden, R4 empty cell, R5 tilde cell, R6 primary absent; `AC6 render e177a` (`test/e177a-manifest.test.mjs`, golden regenerated) |
| AC3 | R7 check unaffected, R9 lane-status unaffected (`test/e235b-relative-worktree.test.mjs`) |
| AC5 | N/A — vacuous. `content/**` is untouched by this ticket (confirmed: `git diff --stat main...HEAD -- content/` is empty). T-E235B-08 recorded as not applicable, matching the architecture's own call. |
| AC6 | Fixture rewrite (T-E235B-06): `test/fixtures/e177a/{fanout-wave5.1,fanout-wave6,fanout-wave7}.md`, `test/fixtures/e178b/fanout-wave7-e177a.md` worktree cells rewritten to `../<lanes-dir>/<lane>`; `render-e177a.golden.txt` regenerated (`worktree: /agm-lanes/e177a` with `--primary /p`, matching `path.resolve("/p", "../agm-lanes/e177a")`); `test/e177a-manifest.test.mjs`'s AC6 spot-check regex updated to match. R11 repo sweep pins zero absolute cells across all 9 `specs/fanout-*.md` + all owned fixtures. |
| AC7 | Not this round's scope (T-E235B-05, sr, already APPROVED round 1). Re-verified as part of the AC8/AC16 re-scan below (0 hits in the 5 named files). |
| AC8 / AC16 | T-E235B-16: final re-scan (see below). |
| AC9-11, AC13 | sr tasks, APPROVED round 1. Spot-checked as part of the re-scan; no findings. |
| AC12 | T-E235B-15: leaked-class scrub, prose only, in `test/fixtures/e177a/fanout-wave7.md`, `test/e180-abandoned-harvest.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/p0-onboarding-lite-default.test.mjs`, `test/qa-flow.test.mjs` (including the dangling old research-doc filename reference at `test/qa-flow.test.mjs:2186`, per the dispatch note, and one additional adopter-name occurrence at `test/qa-flow.test.mjs:2099` found during the re-scan). |

### R1-R11 (architecture's regression cases, `test/e235b-relative-worktree.test.mjs`, new)

All 11 written and green:
- R1 relative resolves
- R2 absolute passes through byte-verbatim (trailing slash kept)
- R3 AC2 golden (an absolute-cell variant of `fanout-wave7.md` renders byte-identical to the golden except the one worktree line, which equals the absolute cell verbatim)
- R4 empty cell (`WORKTREE_EMPTY`, scope `row`, `lanes: ["e1"]`; `validateManifest` unaffected; `checkLane` on a real branch unaffected)
- R5 tilde cell (`WORKTREE_TILDE` for `~/lanes/e1`, `~`, `~user/lanes/e1`; never shell-expanded — message never contains `os.homedir()`; `./~x` resolves as an ordinary relative path)
- R6 primary absent (non-git `manifestDir` → only `PRIMARY_NOT_FOUND`, no worktree error; a real isolated git repo as `manifestDir` resolves the cell against that repo's root via `resolvePrimary`)
- R7 check unaffected (AC3) — `checkLane` output and exit code byte-identical between a relative-cell and absolute-cell manifest
- R8 parse unaffected — `dispatchable[0].worktree` stays raw; `errors` deep-equal between relative/absolute variants
- R9 lane-status unaffected (AC3) — static check that `tools/lane-status.ts`'s non-comment source contains no "fanout" reference; `runLaneStatusCli` listing (activeFeature/status/lastAgent fields) identical between an isolated repo with and without a relative-cell manifest under `specs/`
- R10 validate warning (CLI) — absolute-cell manifest: exit 0, unchanged first line, second line matches `^WARN  lane e1 \(line \d+\): worktree cell is an absolute path`, absolute value never echoed in stdout; relative-cell manifest: single ok line only; format-error manifest: exit 2, empty stdout, no warnings
- R11 repo sweep — every `specs/fanout-*.md` (9 files) and every fixture under `test/fixtures/e177a/**` + `test/fixtures/e178b/**` (13 files total) validates with zero WARN lines and zero absolute dispatchable worktree cells (`isAbsoluteWorktree` false for all)

### T-E235B-07 — the 9 listed test files

Per `specs/fanout-e235.md`'s e235b row, the 9 files are: `test/e177a-manifest.test.mjs`, `test/e177a-check-cli.test.mjs`, `test/e177b-lane-status.test.mjs`, `test/e178b-cut-prereview.test.mjs`, `test/e178b-fanout-unmatched.test.mjs`, `test/e178b-lane-watch.test.mjs`, `test/e223-watch-rearm-gone.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e130-lane-default.test.mjs`. Only the first two contain a literal worktree-path string (the AC6 spot-check regex, updated). The other 7 were grepped for `worktree|agm-lanes|` plus the home-directory prefix pattern and carry no worktree-cell literals to update — confirmed no-op, all 108 of their tests still pass (`test/e177b-lane-status.test.mjs`, `test/e177b-mailbox-watch.test.mjs`, `test/e177b-test-lock.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e178b-*.test.mjs`, `test/e223-watch-rearm-gone.test.mjs` run together: 108/108 pass). The R1-R11 regression file plus the AC3 pin (R7-R9) supersede a literal "AC3 provisional lane refused"-style addition to an existing file, since the architecture names `test/e235b-relative-worktree.test.mjs` as the home for all R-numbered cases.

### T-E235B-08 — N/A

`content/**` untouched by this ticket (`git diff --stat main...HEAD -- content/` empty). `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs` need no regeneration. Recorded as not applicable, matching the architecture's own call ("AC5 is therefore vacuous, and T-E235B-08 is a recorded no-op").

### T-E235B-15 — leaked-class scrub (AC12, prose only)

- `test/fixtures/e177a/fanout-wave7.md`: 3 occurrences of the adopter project's full name scrubbed to a class description (`D3=` bullet, the 7.0 row's `repo:` cell, and the D3 Decisions row) — in addition to the 4 worktree-cell rewrites (AC6), which are a separate, format-level edit on the same file.
- `test/e180-abandoned-harvest.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`: adopter name scrubbed from a spec-to-test-map comment line, a test name string, and a fixture-shape comment, in each file.
- `test/p0-onboarding-lite-default.test.mjs`: adopter name scrubbed from 2 prose comment lines.
- `test/qa-flow.test.mjs`: the dangling old research-doc filename at `:2186` (dispatch-flagged) updated to the renamed file; one further adopter-name occurrence at `:2099` (a provenance comment) found during this round's re-scan and scrubbed.

All edits are string-literal changes only (comments and one test-name string per file) — no logic, no assertion, no control flow touched. Verified by full re-run of every touched file: `test/e180-abandoned-harvest.test.mjs` 13/13, `test/e213-shipped-ignored-shape.test.mjs` 17/17, `test/p0-onboarding-lite-default.test.mjs` 10/10, `test/qa-flow.test.mjs` 152/152, all unchanged pass counts from before the scrub.

### T-E235B-16 — final re-scan (AC8/AC16)

Owned-scope file list built as `git diff --name-only main...HEAD` (committed sr + qa work) ∪ `git status --porcelain` (this round's uncommitted-then-committed qa work), 70 files, all confirmed to exist in the working tree. Grepped case-insensitively for the six leaked forms named in the dispatch. Counts only, per the dispatch's own instruction never to record the literal values:

| Form | Hits |
|---|---|
| Plain local absolute path | 1 (see below — the one allowed exception) |
| Hyphen-encoded session-directory form | 0 |
| Temp-directory form | 0 |
| Adopter project full name | 0 |
| Adopter project short form | 0 |
| Personal config-directory name form | 0 |

The single plain-absolute-path hit is `.current/e235b/handoff.md`'s `prd_path` field — the one AC8-stated exception ("This lane's own handoff (`.current/e235b/handoff.md`) keeps the absolute `prd_path` the server requires today; the integrator rewrites it in the closing bookkeeping commit"). No other hit of any of the six forms in any of the 70 owned-scope files.

Scope caveat stated by the spec itself (not a finding): "The AC8 re-scan covers only this lane's owned files (core + E240 add-on). The integrator scans the whole tree after merge" — this re-scan is scoped accordingly.

## Phase 3.5 — AC Execution Log

**Phase 3.5: skipped (no `proof:`-annotated ACs in `specs/e235b-relative-manifest-worktree.md`).**

## Phase 4 — Run

- Build: `npm run build` clean (tsc, `check:version`, `check:transitions-sync` all OK). No source changes this round (qa touched only `test/**`), so this reconfirms round 1's clean build.
- Full suite (`npm test`, run to completion synchronously in this hop): **2902 tests, 2899 pass, 0 fail, 3 skip.** The 3 skips are pre-existing and unrelated to this ticket (unchanged from round 1's report).
- CI runnability: `npm test` runs headlessly, zero human interaction, deterministic exit code.
- Working tree: clean before the run (test/fixture/`.current/e235b/**` changes committed in `75e7256` per `docs/lane-protocol.md` §3, `git status --porcelain` empty immediately before `npm test`).

## Verdict

**PASS.** All ACs in this round's qa-owned scope (AC1-3, AC6, AC8, AC12, R1-R11) are met with test coverage; AC5/T-E235B-08 is N/A and recorded as such; the round-1 code-reviewer APPROVED verdict for T-E235B-02..05, 09..14 stands and this pass adds no correctness findings against that diff. Full suite is green, expected-red manifest fully dispositioned (both entries now green), final leak re-scan is clean except the one sanctioned `prd_path` exception.
## 2026-09-28T07:34:22.146Z — PASS — by qa-engineer

PASS — batched qa round covering T-E235B-02..16 (T-01 architect not in this round's dispatch). Code-reviewer round 1 APPROVED T-02-05,09-14 (0 required findings) stands. QA-owned: T-06 fixture worktree-cell rewrite (test/fixtures/e177a/**, test/fixtures/e178b/**) + render-e177a.golden.txt regen; T-07 the 9 listed test files synced (only e177a-manifest/e177a-check-cli had literal cells to update) plus new test/e235b-relative-worktree.test.mjs pinning architecture regression cases R1-R11 (checkLane/lane-status AC3 non-coupling, resolveWorktree edge cases, validate WARN CLI contract, full repo sweep); T-08 N/A (content/** untouched); T-15 AC12 leaked-class scrub prose-only in 5 files incl. the dispatch-flagged qa-flow.test.mjs:2186 dangling research filename plus one more instance found this round; T-16 final AC8 re-scan of 70 owned-scope files for all 6 leaked forms — 0 hits except the 1 sanctioned prd_path exception. Expected-red manifest's 2 entries both confirmed now green. Full suite 2899/2902 pass, 0 fail, 3 skip. Detail: qa_reports/review_T-E235B-06.md.

## 2026-09-28T07:35:27.779Z — PASS — by qa-engineer

PASS (retry — Phase 0.5 disposition added to each per-id evidence file after the first attempt's auto-record created empty stubs lacking the H2). Batched qa round covering T-E235B-02..16 (T-01 architect not in this round's dispatch). Full detail in qa_reports/review_T-E235B-06.md. Full suite 2899/2902 pass, 0 fail, 3 skip.

