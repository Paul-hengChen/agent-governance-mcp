# Review — T-E381-02

Round 1 — APPROVED — by code-reviewer (opus). Range `2425e04...7e2700c`. Contract: `specs/e381-fanout-and-ledger-fixes.md` D-E390, AC-E390-1..7. Lane-wide checks (scope, `dist/`, expected-red) are in `review_reports/review_T-E381-01.md`.

## Summary
- `runCheck` resolves a default base when `--base` is absent: it uses the target branch recorded under `## 接手步驟` / `- 目標分支：<branch> @ <sha>`, otherwise `main` (`tools/fanout-manifest.ts:2429-2437`, resolver `recordedTargetBranch` at `:1703-1713`).
- `CheckOptions.baseSource` (`:1602-1606`) selects one of three base `REF_NOT_FOUND` messages (`baseNotFoundMessage`, `:1683-1691`). `checkLane` keeps `opts.base ?? "main"` and sets the source to `flag` when `base` is given and to `default` otherwise (`:1736`).
- The `check` line in `USAGE` (`:228`) and the `scripts/fanout.mjs` header comment (`:8`) now read `[--base <ref>]`. Nothing else in `scripts/fanout.mjs` changed.
- Verdict: APPROVED.

## AC Completeness
AC-E390-1 — implemented — `:2430-2433`. Probe (repo with only `develop`, recorded `develop @ <sha7>`, no `--base`): the diff ran over `develop...feat/…`, the E158 note names `develop`, exit 1 by the diff, no REF_NOT_FOUND.
AC-E390-2 — implemented — `:1704-1712` returns undefined when the section is missing, when the fact line is missing or duplicated, or when the value does not parse. Probe in a `main` repo: stdout, stderr and exit with no `--base` were byte-identical to `--base main`. The duplicate-line and `<待填：x>` cases fell back to the default.
AC-E390-3 — implemented — `:1688-1689`. Probe stderr matches copy `err.base-default` verbatim.
AC-E390-4 — implemented — `:1685-1686`. Probe with `gone-branch` gave exit 2 and stderr matching copy `err.base-recorded` verbatim.
AC-E390-5 — implemented — `--base develop` overrides the recorded value; `--base nope` prints `base ref "nope" does not resolve (git rev-parse --verify) in <repo>`, byte-identical to the pre-change text (`:1690`, and the old template at the base commit). A recorded `-x` still yields `REF_INVALID`. `checkLane` without `base` keeps `main`/`default` (`:1735-1736`). `test/e177a-check-cli.test.mjs` passes unedited.
AC-E390-6 — implemented — on the same manifest and repo, `handoff --check` with no `--target` printed no REF_NOT_FOUND. The parity analysis is under Correctness.
AC-E390-7 — implemented — both greps print `1`; `test/e296-manifest-tier.test.mjs` passes unedited; the usage still has five continuation lines.

## Correctness
No required findings.

Parity with E386 (`tools/fanout-handoff.ts` `readHandoffFacts` + `runHandoff`), checked line by line:
- Both use the same section finder (`findHandoffSections`) and require exactly one section.
- Both use the same fact-line regex `^- ([^：]+)：(.*)$`, trim the key, and trim the value.
- Both use the same value regex `^(.+) @ ([0-9a-f]{7,40})$`, group 1 (the local `RECORDED_TARGET_RE` is textually identical to the module-private `TARGET_FACT_RE`).
- `readHandoffFacts` skips `### ` lines, but such a line can never match `^- `. Its `背景 … 無` rule deletes only `HANDOFF_BACKGROUND_KEYS`, and `目標分支` is a primary key. So the recorded branch is the same in every case where `handoff --check` resolves one.
- The two commands diverge only where `handoff --check` errors out instead of resolving: duplicate sections, or a duplicated `目標分支` (or any other duplicated fact). There `check` falls back to `main`. AC-E390-2 sanctions this, and it fails loud with a message that names `--base`.

- optional — When the `目標分支` line appears twice, the default-case message says "the manifest records no target branch". Strictly it records two. The wording is the spec's approved copy and the case is rare, so no change is asked.
- The usage line was changed only in the two sanctioned places. A grep for the old `[--base main]` text in `tools/`, `scripts/`, `docs/*.md` and `README.md` finds no stale copy.

## Quality
No findings. The duplicated resolver is about 11 lines and its doc comment says why it is kept local (no handoff-module load from `check`). The three message templates are kept together in one function. The `runCheck` comment is a single line with no local paths.

## Architecture
No architecture spec. Duplicating the resolver instead of importing it follows the D-E390 ruling: a static import would create a module cycle, `runCheck` is synchronous, and `scripts/fanout.mjs` loads the handoff module only for `handoff`. Parity is checked above and will be pinned by AC-E390-6.

## Security
No findings. The recorded branch comes from manifest text and passes the existing `REF_INVALID` screen (leading `-` or whitespace) before it reaches `git rev-parse` via `execFileSync`, which uses argv and no shell. Probe: a recorded `-x` gives `REF_INVALID`.

## Performance
No findings. One extra section scan per `check` run, and only when `--base` is absent.

## Verdict
APPROVED — the default-base resolution matches E386 in every resolvable case, the three REF_NOT_FOUND messages are the spec's copy verbatim, and explicit `--base` text, codes and exit codes are unchanged.
