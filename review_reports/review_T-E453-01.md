# Review — T-E453-01 (e453-served-text-v5)

covers: T-E453-01, T-E453-02, T-E453-03, T-E453-04, T-E453-05, T-E453-06, T-E453-07, T-E453-08, T-E453-09, T-E453-10, T-E453-11

## Round 1 — APPROVED — by code-reviewer

Diff judged: `git diff 934a0d2...HEAD` (integrator base-fix merge of `main`; spec base `70d34c6`). Implementation commits 8c35743, f02bcb3, 424b467, 4f7bfce, 2506216; qa commits 94b3111, 14a29a2, 9332246, 9800f59; sr 1c21ee7. SOP followed: `content/skill-code-reviewer.md` as it stands in this worktree (the lane's own rewritten step 1 and rejection row); step 1 held on the old text too (previous tuple `(sr-engineer, In_Progress)`).

## Summary
- Text-only change: served `content/**` (13 files), `docs/migration-v5.md`, `docs/architecture.md`, `docs/config.md` (lines 245, 277 only), `docs/lane-protocol.md` (lines 52, 123 only), `CONTRIBUTING.md`, three `tw_update_state` description strings in `tools/registry.ts`, one comment line in `tools/transitions.ts`, plus the rebuilt `dist/` for those two files.
- Tests: two new files (`test/e453-served-text-v5.test.mjs`, 23 tests; `test/e457-doc-numbers.test.mjs`, 3 tests), re-pins in e433 / e393 / e408 / e412 / e434 (line 61 only), 12 compose goldens re-captured, 5 context-budget caps re-measured.
- Scope stays inside the e453 owned set and its line limits (fan-out manifest e453 row plus the human Q7 amendment). No file under `gates/`, `schema/`, `prompts/`, `bin/` changed; `tools/transitions.ts` changes one comment line; `tools/registry.ts` changes three description literals (AC27 test confirms names, keys and enums equal base).
- Every Copy / Strings line is present verbatim, and every factual claim in it was checked against the code (below).
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — content/skill-code-reviewer.md:104 (`cr.reject_head` + `cr.reject_rollback`, codes kept)
AC2 — implemented — content/skill-code-reviewer.md:69 (`cr.step1`)
AC3 — implemented — content/skill-reviewer-visual.md:92,93,95 (no `tw_rollback_task` in file; `VISUAL_WIDGETS_UNVERIFIED` kept)
AC4 — implemented — test/e433-test-first-rules.test.mjs:346–354 (re-pinned + negative "per rejected id, then")
AC5 — implemented — docs/migration-v5.md:80–86 (`mig.restamp`); test runs `agc init` / `check` in a temp workspace
AC6 — implemented — docs/migration-v5.md:46–47 (`mig.row_sr_ip`, `mig.row_sr_blocked`); `validateTransition` agrees (tools/transitions.ts:238–253)
AC7 — implemented — docs/migration-v5.md:93–97 (`mig.sqlite_checks`)
AC8 — implemented — docs/migration-v5.md:14–22 (`mig.schema`, `mig.mixed_servers`, outside the SQLite section)
AC9 — implemented — content/const-01-core-head.md:13; docs/architecture.md:245; tools/transitions.ts:394; check-only sites unchanged
AC10 — implemented — content/const-01-core-head.md:15; content/const-15-core-tail.md:6; docs/architecture.md:141
AC11 — implemented — const-01:14, const-06:8, const-12:18, skill-sr-engineer.md:33, docs/migration-v5.md:24–27
AC12 — implemented — const-01:14; content/skill-sr-engineer.md:33 (`sr.read_count`)
AC13 — implemented — CONTRIBUTING.md:38,64,98,140,252; docs/architecture.md:113; docs/config.md:245
AC14 — implemented — docs/architecture.md:73,77 (box width 67 kept)
AC15 — implemented — test/e457-doc-numbers.test.mjs (checker + mutation cases + five-doc scan)
AC16 — implemented — content/coord-01-core-head.md:21–23
AC17 — implemented — content/skill-integrator.md:49
AC18 — implemented — content/coord-05-core-visual-drift.md:5,10; three out-of-set pins re-pinned (e408:35, e412:58, e434:61)
AC19 — implemented — content/skill-sr-engineer.md:29
AC20 — implemented — tools/registry.ts:770,786,835 + dist/tools/registry.js
AC21 — implemented — docs/config.md:277
AC22 — implemented — docs/lane-protocol.md:52,123
AC23 — implemented — const-05:21, coord-03:39, constitution-rationale.md:158; e433 AC2 (c) and e393:24 re-pinned
AC24 — implemented — content/skill-design-auditor.md:56
AC25 — implemented — no backtick gate code added/removed in any content/*.md (frozen-set test green; error-code-contract green)
AC26 — implemented — changed content lines carry no repo-only path and no `E\d+` (test green; e437 green)
AC27 — implemented — transitions.ts diff comment-only, registry shape equal to base, no gates/schema/prompts/bin change
AC28 — implemented — 12 goldens re-captured, 5 caps re-measured with one note each, per-hunk table in qa_reports/tests_e453-served-text-v5.md; full suite 0 fail (see judge report)

## Correctness

Copy / Strings audit (step 5a): all 51 string ids grepped in their target files and found verbatim (cell text for table rows, whitespace-normalised for wrapped docs). No unlisted user-facing string was added. Truth of each factual claim against the code:

- `review_round` cap 4 / "after the 4th CHANGES_REQUESTED only pm": tools/transitions.ts:474 rejects every non-pm write while `prev_review_round >= REVIEW_ROUND_CAP` (4); computeNewRound increments on each `(code-reviewer, FAIL)` (tools/transitions.ts:652). Four FAILs → 4 → pm only. True.
- `sr_return`: tools/transitions.ts:536–551 checks only the `sr-engineer:In_Progress → qa-engineer:In_Progress` edge; computeSrReturnCount (tools/transitions.ts:704–718) resets on `(pm, In_Progress)`. SQLite never persists `sr_return_count` (handoff-orchestrator passes `prevState?.sr_return_count ?? 0`). "Only that return is rejected", "until pm re-enters", "file mode only" — true.
- `hop` cap per feature, reset only on `active_feature` change: computeNewRound `hopBase = feature_changed ? 0 : prev_hop_count` (tools/transitions.ts:680); the pm landing increments, does not reset. True. Architecture box line `hop_count ≥ 14 (HOP_CAP_EXCEEDED): role change → pm` matches the step 2.5 override inside validateTransition (step 1 of the pipeline).
- `mig.sqlite_checks`: CUT_APPROVAL_REQUIRED and EXTERNAL_REFS_UNRESOLVED are guarded by `getActiveStorage() instanceof FileHandoffStorage` (tools/handoff-orchestrator.ts:401, 446); SCOPE_DECISION_REQUIRED and SOURCE_CREDIBILITY_UNVERIFIED have no storage guard (354–390, 482–520); REPRO_MANIFEST_MISSING's qa → sr hand-off branch is under `storage instanceof FileHandoffStorage` (556). True.
- `mig.schema` / `mig.mixed_servers`: `git show v4.23.0:schema/versions.ts` has `handoff: 15`; current is 17; schema/versions.ts:79 refuses an artifact "written by a newer server". True.
- `mig.restamp`: the AC5 test runs `bin/agc-init.mjs init` (prints `Skipped (already exists): AGENTS.md, .antigravityrules`, check exit 1) and the hand bump (check exit 0). True.
- `mig.row_sr_blocked`: `sr-engineer:Blocked` successors are sr-engineer:In_Progress / pm / design-auditor (tools/transitions.ts:246–253), no code-reviewer edge. True.
- `cr.step1`: `code-reviewer:Blocked → code-reviewer:In_Progress` is an edge (tools/transitions.ts:266–268); the own In_Progress claim/checkpoint is the self-loop fast path. Executable. True.
- `coord05.dispatch`: `tw_switch_role`'s role enum has no `reviewer-visual`; code-reviewer SOP step 6a reads `skill-reviewer-visual.md`. True. `coord05.void`: no server gate reads coordinator prose. True.
- `config.caveat_skill`: PASS_MISSING_EVIDENCE (`MISSING_EVIDENCE`, tools/handoff-orchestrator.ts:814) rejects a PASS with neither `qa_review` nor a pre-written review file. True.
- `arch.autoroute`: matches coord-01:84 and the coord-03 stop rows (Blocked, PASS, absent `next_role`, hop cap) and `AGC_AUTO_ROUTE=0` opt-out. True.
- `coord01.row_*`: the mini-chain and single-role judge dispatch are defined at coord-07:9 and const-08:8. True.

Tests (step 4): every AC has a test whose title starts with its AC id, on the public surfaces (served content after origin strip, docs, `TOOL_REGISTRY`, `validateTransition`, the `agc` CLI). Negative control in a copy of HEAD outside the worktree (`git archive`, scratchpad), 19 mutations, each caught by the AC it targets (17 distinct below; two more variants of the AC26 path / ticket-id cases): review_round value 4→3 (AC9); step 1 drops `(code-reviewer, Blocked)` (AC2); step 1 loses the STOP (AC2); rollback-first restored (AC1); reviewer-visual drift row regains the rollback (AC3); `33 entries`→`35 entries` (AC13, AC15); README gains `18-step` (AC15); sr_return row "routing locks to pm" (AC11, AC12); sr 4c drops the SQLite clause (AC12); restamp text (AC5); sqlite_checks text (AC7); coord-05 void sentence reverted (AC18); backtick code added to skill-integrator (AC25); bare `E456` appended to an unchanged-copy line (AC26); repo-only path appended (AC26); box line width 66 (AC14); lane-protocol `code-reviewer／qa-engineer` back (AC22). No loose assertion found. Coverage tooling: not configured for this repo (text-only change; no executable code added outside tests).

No correctness findings.

## Quality
- `optional` — test/e433-test-first-rules.test.mjs:84: the comment above `BUILDER_NE_JUDGE` still reads "exactly as at base (frozen in-test fixture; unchanged by E433, AC2 (c))", but the literal is now the post-E453 text, not base. Stale comment.
- `optional` — `limits.sr_return.meaning` ("between two `(pm, In_Progress)` writes") omits that an `active_feature` change also resets the count (tools/transitions.ts:710). Approved Copy text; not misleading in practice.
- `optional` — `cr.reject_rollback` opens "A task is marked `[x]` only after PASS", while spec D1 records the judge can `tw_complete_task` before PASS; the sentence's "normally" and the `[x]` condition cover it. Approved Copy text.
- Comment discipline (step 5d), `agc check — comments` warnings touching the diff: `test/e453-served-text-v5.test.mjs:1` (11-line header) and `test/e457-doc-numbers.test.mjs:1` (8-line header) — kept: each is the file's WHY block (which defect, how base values are frozen); `recommended` to trim to ≤ 7 lines on next touch. `test/context-budget.test.mjs:594/623/955` long-block and its high-ratio warning — kept: pre-existing re-baseline history blocks; the diff adds one note line per cap, the convention the file already uses. `tools/transitions.ts` high-ratio — kept: the diff rewrites one existing comment line, adds none.

## Architecture
No `specs/e453-served-text-v5-architecture.md` (the lane does not route through architect, per the fan-out manifest). Layering unchanged; no server behaviour change. Ownership: every changed path is in the e453 owned set; `docs/config.md` touches 245 and 277 (inside 240–290), `docs/lane-protocol.md` 52 and 123, `test/e434-reviewer-visual.test.mjs` line 61 only (human Q7 amendment). `dist/` committed with its source change, per the spec's amended Out of Scope note.

## Security
No findings. Text and test changes only; the AC5 test writes only under `os.tmpdir()` and cleans up in `after`; no secrets; no new input crosses a trust boundary.

## Performance
No findings. No runtime code path changed. Context-budget effect measured and capped: lean always-on +34 ~tok, skill-sr +23, design-arm constitution +49, teamwork bundle +158, non-design constitution +49 (each explained per hunk in the qa report).

## Verdict
APPROVED — all 28 ACs are implemented with verbatim Copy text whose claims hold against the server, the tests bind each AC (19 mutations caught), scope stays inside the owned set, and the clean-tree suite has zero failures.
