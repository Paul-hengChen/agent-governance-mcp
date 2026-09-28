# Review — T-E123B3-03

covers: T-E123B3-01, T-E123B3-02, T-E123B3-03

## Round 1 — PASS — by qa-engineer

## Summary
QA verification of E123 F1 L3 (`e123b3-prompts-hooks`): routes the lane
handoff path in `prompts/build.ts`, `bin/agent-governance-context.mjs`, and
`bin/agent-governance-usage-hook.mjs` through `resolveCurrentLanePaths`
(frozen S0 interface, `tools/lane-paths.ts`, unchanged here). Code review
(`review_reports/review_T-E123B3-02.md`) APPROVED. This report independently
re-verifies AC1-AC8 per the cut (`.current/feature-split.md` row 1.3) and the
human's AC5 amendment (option B, 2026-09-23).

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e123b3-prompts-hooks.txt` manifest
declared — non-red feature, zero-behaviour-change cut).

## Phase 1.5 — Visual Compare
Skipped (no `design/e123b3-prompts-hooks.md`, no `## Visual Baselines` H2 —
no design/ dir exists in this workspace).

## Phase 3.5 — AC Execution Log
Skipped (no `specs/e123b3-prompts-hooks.md` — this is a MINI-CHAIN per
`scope_decision_why`: the cut row + the human's constraints in the dispatch
brief ARE the spec; no `proof:`-annotated ACs exist to execute).

## AC Verification

**AC1** — quoted-literal path grep, 0 hits required:
```
grep -nE "[\"'\`](handoff\.md|telemetry\.jsonl|metrics\.jsonl|usage\.jsonl|dispatch\.jsonl)[\"'\`]" \
  prompts/build.ts bin/agent-governance-context.mjs bin/agent-governance-usage-hook.mjs bin/agc-init.mjs
```
Exit 1 (no match) — **0 hits. PASS.** (A looser, unquoted grep does hit
comments and the S01a/S01b footer prose ("No handoff.md found at ...",
build.ts:471/473/480) — per the code-reviewer's note and the dispatch brief,
these are not path-construction literals, and rewriting them would break
AC6's golden-freeze. Read AC1 as written: the quoted-literal form. PASS.)

**AC2** — every site resolves via the frozen seam, absolute workspace:
```
prompts/build.ts:448:   resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath
bin/agent-governance-context.mjs:160:  mod.resolveCurrentLanePaths(path.resolve(workspace)).handoffPath
bin/agent-governance-usage-hook.mjs:156: lanePaths.resolveCurrentLanePaths(path.resolve(workspace)).handoffPath
```
All three call `resolveCurrentLanePaths(path.resolve(<ws>))`. **PASS.**

**AC3** — non-lane paths untouched. Confirmed by diff (below) and by grep:
`.config.json` (usage-hook:141, context:105), `.current` override/marker
paths (context:33,53,113,235), `.current`/`tasks.md` existence checks
(build.ts, context.mjs, usage-hook.mjs) are unchanged lines — the diff shows
only the handoff-path construction changing. **PASS.**

**AC4** — non-lane files untouched:
```
git diff --exit-code main -- tools/lane-paths.ts content test bin/agc-init.mjs
=> exit 0
```
**PASS.**

**AC5 (AMENDED, option B, 2026-09-23)** — full suite green except the 4 named
exemptions.

e123b3 worktree, `npm test`: **2311 pass / 4 fail** — the red set is
*exactly*:
- `#155` `check-md-tables` AC7
- `#156` `check-md-tables` CQ-9
- `#1306` `test/lane-paths.test.mjs` CALLERS2
- `#1329` `test/lane-paths.test.mjs` CALLERS3

No other failures. No test files were edited (constraint honored — CALLERS2/
CALLERS3 left untouched per instruction).

Control run — a detached `git worktree add --detach <tmp> $(git rev-parse main)`
(commit `88bbf3f`) under `$TMPDIR`, `npm ci` + `npm test`: **2315 pass / 0
fail.** Worktree removed after the run (`git worktree remove --force`).

**Discrepancy worth flagging, not a FAIL**: main's tip is *fully green*,
including `check-md-tables` AC7/CQ-9 — main already carries commit `88bbf3f`
("fix(governance): escape the regex pipe in feature-split row 1.9"), which
fixes exactly the `.current/feature-split.md:23` row-1.9 formatting bug
L3-NEW-3 describes. This e123b3 worktree is pinned to an earlier base
(`8f30aba`, pre-dating `88bbf3f`), so its copy of `feature-split.md` still
has the unescaped-pipe row and still trips `check-md-tables`. Confirmed this
file is untouched by this lane's own diff: `git diff main -- .current/feature-split.md`
shows only the row-1.9 escaping delta, and it is absent from `git status`
(not modified in the working tree) — L3 never edited it, consistent with the
"L3 is barred from editing feature-split.md" constraint. So:
- CALLERS2/CALLERS3 red is *caused by* this lane's own diff (L3 legitimately
  adds new callers of the frozen `lane-paths` interface) — exactly the
  deferred-to-J case the human's decision describes.
- check-md-tables AC7/CQ-9 red is *not* caused by this lane's diff at all —
  it is inherited, unmodified, from a base commit that predates an unrelated
  fix now on main's tip. Rebasing/merging this lane onto current main will
  make these 2 pass with zero code change here.

Both are consistent with the human's AC5 amendment in substance (neither is
a regression introduced by T-E123B3-01's code), even though the "already red
on main" premise for AC7/CQ-9 is now stale relative to main's current tip.
Flagging for J/the integrator so the still-red status on this branch isn't
mistaken for a live defect once merged.

Isolated re-run, `node --test test/usage-accounting.test.mjs`: **32/32 pass**,
no timeout, duration 3.2s. No usage-accounting hook flake observed.

**PASS** (red set is exactly the 4 authorized exemptions; no unauthorized
failures; no test-infra defects; no timeout).

**AC6** — golden fixtures untouched:
```
git diff --exit-code main -- test/fixtures/compose-golden/
=> exit 0
```
**PASS.**

**AC7** — hook stdout and `usage.jsonl` byte-identical to main's hooks
against a `$TMPDIR` workspace (built at
`$TMPDIR/agc-qa-e123b3-ac7`, never under the repo; removed after the run).
Ran main's hook copies (`git show main:bin/...`) and this diff's copies
against the same `AGC_SERVER_ROOT` (this worktree, so `dist/tools/lane-paths.js`
is present) and the same fixture workspace:
- Context hook stdout: **byte-identical**, both with a handoff present and
  with no handoff (`.current`-absent, `tasks.md`-only marker).
- Usage hook `usage.jsonl` record: **byte-identical** once `ts` is masked
  (`feature`, `dispatch`, `usage` all match exactly); both exit 0.
- Fail-closed, context hook: built a fake `SERVER_ROOT` with `content/` and
  `dist/prompts/` and `dist/tools/` present but `dist/tools/lane-paths.js`
  deleted. Result: prints the misconfigured-hint JSON, exits 0, writes no
  `.agc-hook-marker.json`.
- Fail-closed, usage hook: same fake root — exits 0, writes no `usage.jsonl`.

**PASS.**

**AC8** — `npm audit --audit-level=high`: exit 0 (6 findings, all low/moderate
— none at or above `high`). **PASS.**

## Phase 3 — Tests
No test authoring required this round (per dispatch brief). No existing test
file was edited (verified via `git status`/`git diff` — `test/` shows no
changes). The pre-authorized new-file path
(`test/e123b3-prompts-hooks.test.mjs`) was not exercised: the manual AC1-AC8
verification above (grep, diffs, full-suite run + control run, hook
byte-comparison, audit) fully covers this cut's acceptance criteria, and the
cut is explicitly zero-behaviour-change with an existing regression suite
(`test/lane-paths.test.mjs`, `check-md-tables`, `usage-accounting.test.mjs`)
already exercising the changed code paths. Documenting per Constitution §2
conditional test writing.

## Phase 4 — Run
- Build: `npm run build` — zero errors (`tsc` clean;
  `check:version`/`check:transitions-sync` OK).
- `dist/prompts/build.*` rebuild produced no additional diff beyond the 3
  files already present (`git status --porcelain -- dist/` unchanged
  post-build).
- CI runnability: `npm test` runs headlessly, zero human interaction.
- Full suite (this worktree): 2311/2315 pass, red set = exactly the 4
  authorized exemptions (see AC5 above).
- Control suite (main @ 88bbf3f, temp worktree, removed after use): 2315/2315
  pass.

## Verdict
**PASS.** AC1-AC8 hold. All 4 remaining reds are the human-authorized AC5
exemptions and neither is a regression introduced by T-E123B3-01/02's diff —
2 are a direct, anticipated consequence of this lane legitimately adding
callers to the frozen interface (deferred to J), and 2 are inherited,
untouched staleness from a base commit that predates an unrelated fix now on
main's tip (self-resolves on merge). No unauthorized failures, no test-infra
defects, no hook drift, no golden drift, no audit findings at `high`+.
## 2026-09-23T09:10:35.004Z — PASS — by qa-engineer

PASS. AC1-AC8 verified independently (grep, diffs, full-suite run on this worktree + a control run on main @88bbf3f in a temp worktree, hook byte-comparison in a $TMPDIR fixture, npm audit). Red set is exactly the 4 human-authorized AC5 exemptions (check-md-tables AC7/CQ-9, lane-paths CALLERS2/CALLERS3); neither is a regression from T-E123B3-01/02's diff. See qa_reports/review_T-E123B3-03.md for the full AC-by-AC record, including a flagged (non-blocking) note: main's tip already fixes the feature-split.md row-1.9 bug this lane's stale base still carries, so AC7/CQ-9 self-resolve on merge/rebase.

