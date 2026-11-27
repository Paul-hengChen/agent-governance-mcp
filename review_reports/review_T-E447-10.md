# Review — T-E447-10 (round 2, batched)

covers: T-E447-01, T-E447-02, T-E447-03, T-E447-04, T-E447-05, T-E447-06, T-E447-07, T-E447-08, T-E447-09, T-E447-10

## Round 2 — APPROVED — by code-reviewer

Feature `e447-local-knowledge-files`, lane e447, branch `feat/e447-local-knowledge-files`, lane base `07a6d47`. This round covers the whole feature diff `07a6d47..HEAD` and, in detail, the changes since round 1 (`1b33af3..HEAD`): amendment A1 (43eefbe, f3ad05b), the human's approval of A1 with O4 (a) (spec line 22, recorded at b85461c), the coordinator's whitespace-only join of the Tasks table (4d3750f), qa T-E447-08 (2ff2b54, 1c431e1: 19 tests), and sr T-E447-09 (9b468e3: `bin/agc-init.mjs` +27/−6, `docs/install.md` one line). Inputs read: `specs/e447-local-knowledge-files.md`, `qa_reports/tests_e447-local-knowledge-files.md`, `qa_reports/expected-red_e447-local-knowledge-files.txt`, `test/e447-*.test.mjs`, the diff, and my round-1 reports. There is no ticket file (spec line 3 cites a backlog row), so AC1–AC20 are the scenarios.

This APPROVED verdict covers all ten task ids. It supersedes the round-1 CHANGES_REQUESTED verdict in `review_reports/review_T-E447-01.md` for T-E447-01..07.

## Summary

- Since round 1, A1 adds 13 Copy rows (12 kept verbatim as built, plus the new mode-on `e447.finish-pending-malformed`), the reused `e447.finish-backlog-missing` row, the `e447.reseed-not-knowledge` placeholder fix, AC13–AC20, D11, the amended AC10 wording and O4 (a). The human approved all of it on 2026-11-27 ("同意 A1，O4 照 (a)").
- T-E447-08 adds 19 CLI-level tests on scratch repos: AC13, AC14 ×2, AC15, AC16 (i)–(iv), AC17 (i)–(vi), AC18, AC19 (a)/(b), AC20, and AC10 (amended).
- T-E447-09 builds D11 (the final backlog is composed in planning and written to the lane copy first, then to the primary copy, with no second primary write), the mode-on pending-malformed wording (the mode-off text is byte-identical), and the R3 one-line docs fix.
- R1–R4 are all resolved. AC1–AC20 are implemented and green. Full suite: 4834 pass / 0 fail / 2 skipped of 4836. No `dist/` diff after the build. Scope is clean.
- Verdict: **APPROVED**. The remaining notes are optional and do not block.

## Round-1 findings (R1–R4)

- **R1 — resolved.** The spec's Copy table now carries all 12 strings as `[A1]` rows: `e447.init-ticketdir-unsafe`, `e447.init-config-malformed`, `e447.usage-feature-finish`, `e447.start-seed-not-ignored`, `e447.start-copy-failed`, `e447.start-seed-failed`, `e447.reseed-no-operand`, `e447.reseed-seed-unreadable`, `e447.reseed-not-ignored`, `e447.reseed-not-primary-file`, `e447.finish-seed-unreadable` and `e447.finish-harvest-failed`. The human consented on 2026-11-27. Copy audit (5a): each row matches the code byte for byte (`bin/agc-init.mjs:486`, `:615` + the `agc init — warning: ` prefix at `:796`, `:1322–1327`, `:2056`, `:2091`, `:2103`, and the reseed and finish sites). The one new wording, `e447.finish-pending-malformed`, matches `:3097–3103` (mode-off branch `:3100`). `e447.reseed-not-knowledge` now names `<operand>`, which is what the code prints, so the round-1 optional note is closed.
- **R2 — resolved.** AC13–AC19 cover (a)–(f) one for one, and each has a test that fails on a wrong outcome (see Correctness).
- **R3 — resolved.** `docs/install.md:235` now says "in this mode it does not go to `specs/archive/<ticket-id>/`" (9b468e3). AC20 is green.
- **R4 — resolved.** D11 is built as specified. AC15 is green, and my two judge probes of partial failures (AC Execution Log) also re-run to completion.

## AC Completeness

- AC1 — implemented — runInit knowledge block (`bin/agc-init.mjs` ~L469–L491, L676–L705), seed, harvest and numbering; test `AC1` green.
- AC2 — implemented — tests `AC2 (a)`…`(f)` green.
- AC3 — implemented — `seedLaneKnowledge` (`bin/agc-init.mjs:2046`); test `AC3` green.
- AC4 — implemented — test `AC4` green.
- AC5 — implemented — `planKnowledgeHarvest` (`:2371`), `planEvidenceHarvestOutsideKnowledge` (`:2356`); test `AC5` green.
- AC6 — implemented — overwrite branch and e180 refusal (`:2411–2424`); tests `AC6 overwrite` and `AC6 both changed` green.
- AC7 — implemented — `planKnowledgeNumbering` (`:2466`) / `applyKnowledgeNumbering` (`:2490`); test `AC7` green.
- AC8 — implemented — `--abandoned` destination (`:2401`); test `AC8` green.
- AC9 — implemented — `manifestChangedFailure` (`tools/fanout-manifest.ts`) and `runFeatureReseed`; the AC9 tests are green.
- AC10 (as amended) — implemented — mode off is unchanged. Outside a linked worktree there is no git call (the round-1 `AC10 … check --cut` test, which uses a PATH shim). Inside a mode-off lane, stdout, stderr and the exit code equal those of a plain directory (new test `AC10 (amended)`, key absent and `"repo"`, both an in-bounds and an out-of-bounds cut). The full suite has no reds off the manifest. The pending-malformed mode-off text is byte-identical (`:3100`).
- AC11 — implemented — `content/**` is unchanged since round 1; test `AC11` green.
- AC12 — implemented — test `AC12` green. Judge diff: the only removed line in the three docs is the (iii) eject row, whose old cell is an exact prefix of the new one (DOC-INST-5, consented). The R3 line was added by this lane, so it is not a pre-existing line.
- AC13 — implemented — `readKnowledgeSeedFiles` returns `{}` when the record is absent (`:2031`), so with `recorded` undefined the overwrite branch never applies (`:2412`); test `AC13` green.
- AC14 — implemented — `laneBacklog` is the harvest copy whose `dstAbs` is the primary backlog (`:2469`); numbering reads its bytes (`:2474`); tests `AC14 numbered` and `AC14 both changed` green.
- AC15 — implemented — D11: `:2477–2480` (compose, set `laneAbs`), `:2437` (lane write first), `:2438` (then primary), `:2494` (no second primary write); test `AC15` green.
- AC16 — implemented — (i) `:2376–2381`; (ii) `blockingAncestor` (`:2403`); (iii) the reused backlog-missing template with base "the primary checkout"; (iv) `knowledgeLocal: true` (`:2475`) selects the mode-on wording (`:3097`). Tests `AC16 (i)`…`(iv)` green.
- AC17 — implemented — `runFeatureReseed` refusals plus the all-or-nothing loop (`runFeatureReseed`, `:2272`; `:2340` throws before any write); tests `AC17 (i)`…`(vi)` green.
- AC18 — implemented — `:484–486`; test `AC18` green.
- AC19 — implemented — tests `AC19 (a)` and `(b)` green (O4 (a): `tools/fanout-manifest.ts` unchanged since round 1).
- AC20 — implemented — `docs/install.md:235`; test `AC20` green.

## Correctness

No required findings.

Tests (SOP 4/4a). Each round-2 test drives the public CLI on scratch repos. Its assertions fail when the scenario's outcome is wrong:
- The "nothing removed" cases snapshot both trees, HEAD, `log --all`, the worktree and the branch.
- AC14 pins the next id above the lane backlog's max (E16) and its provenance.
- AC15 pins the re-run's exit 0, the absence of a numbered line, the backlog bytes and the worktree removal.
- AC16 (iv) pins the whole mode-on header and asserts that the mode-off text is absent.
- AC17 (v) runs both operand orders.
- AC19 first proves the comparison fires, then shows it does not.
- AC20 freezes the section's four other bullets.

Every test title that `qa_reports/tests_e447-local-knowledge-files.md` names exists verbatim in its file. The open interface details contradict no scenario. Expected reds: the manifest's three round-2 entries (AC15, AC16 (iv), AC20) are now green, and there are no reds off the manifest. The two `check-md-tables` reds that qa noted (not manifest entries) are green after 4d3750f. 4d3750f only rejoins the table: `git show 4d3750f` removes one blank line.

D11 (sr T-E447-09):
- The composed backlog replaces the harvest copy's bytes only when `allocated.length > 0`. With nothing allocated, as on a re-run whose provenance rows already exist, the harvest copy keeps the lane bytes, and `backlogViaHarvest` correctly suppresses a primary write that has nothing new.
- `--abandoned` never matches `laneBacklog`, because its destination is `docs/abandoned/<lane>/backlog.md`, not the primary backlog path. So the abandoned path still writes the primary backlog through `applyKnowledgeNumbering`, as before.
- The harvest is applied before numbering on both verbs (`:4387–4388`, `:4480–4481`), so the lane-first order holds.

Judge probes beyond AC15 (scratch repos; see the judge report):
- (1) The primary write fails after the lane write succeeds (primary `docs/` made read-only). The first run exits 1 with `e447.finish-harvest-failed`. The re-run exits 0: it overwrites the still-seeded primary copy with the final bytes and prints `e9/L1 already applied, skipping (backlog row E16)`, with no second allocation.
- (2) The lane write itself fails (lane `docs/` made read-only). The first run exits 1 and changes neither copy. The re-run exits 0 and numbers E16 once.

**The `e447.finish-harvest-failed` text on a lane-copy failure is acceptable, not a required change.** The row is human-approved verbatim text (A1). Its claim "re-running finish is safe" holds; probe (2) proves it. The harvest of `<rel>` into the primary checkout did fail. And `(<error>)` names the actual failing path, which is the lane's `docs/.agc-seed-*.tmp` in probe (2). A different text would be a new user-facing string, which needs a Copy row and the human's consent (SOP 5a), so leaving it unchanged was correct. The wording point is listed as optional under Quality.

## Quality

- The diff since round 1 is small and in the file's style. `planPendingApply` gains a defaulted `knowledgeLocal` flag, and the other two callers (`:3244`, `:4155`) are untouched, so the mode-off text is unchanged. 5d: the diff adds three comments, of 1–2 lines each (`:2435–2436`, `:3085`, `:3096`), and an amended 6-line block above `planKnowledgeNumbering` that states the D11 contract. All of them are kept.
- optional: `e447.finish-harvest-failed` says "into the primary checkout" even when the lane-copy write fails. A later Copy amendment could drop that phrase or name the lane copy. This is not a defect (see Correctness).
- optional: `writeViaRename` (`:2013`) leaves its `.agc-seed-*.tmp` behind when `writeFileSync` succeeds but `renameSync` fails. A temp file left in the lane's `docs/` would be untracked and not ignored, so it would block `git worktree remove` until it is deleted. This dates from round 1 and is only reachable on a rename failure. In both probes the failure came at the open, and no temp file was left.

## Architecture

There is no architecture spec. D10 still holds: no new `tools/*.ts`, `CLAUDE.md` untouched. D11 is built exactly as decided (compose in planning; lane first, primary second; temp file + rename each), so sr did not substitute a different mechanism. O4 (a): `tools/fanout-manifest.ts` and its `dist/` are unchanged since round 1.

## Security

No new trust boundary. The lane write-back path is `lanePath` joined with the harvest copy's repo-relative `rel`, which comes from `readdir` under fixed knowledge roots. It goes through temp file + rename, the same as the primary write. No new git invocation. No secrets.

## Performance

D11 adds at most one extra file write per finish (the lane copy, only when the backlog is both harvested and numbered) and removes one primary write in that case. No regression.

## Verdict

APPROVED: R1–R4 are resolved, AC1–AC20 (AC10 as amended) are implemented and pass in the judge's full-suite run, scope and docs constraints hold, and only optional notes remain.
