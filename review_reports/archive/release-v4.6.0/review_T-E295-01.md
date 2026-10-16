# Review — T-E295-01 (batched round, feature e295-hop-cap-and-sop-halves)

covers: T-E295-01, T-E295-02, T-E298-01, T-E300-01, T-E301-01

## Round 1 — APPROVED — by code-reviewer

Diff reviewed: `git diff 25bc84c...5772bd1` minus the PM commits (59bab40, 14c0162, b751b6c). Task commits: 85f54f4 (T-E295-01), aa05105 (T-E295-02), 8b904c8 (T-E298-01 + the E299 sentence), fc21b54 (T-E300-01), 337bcb2 (T-E301-01), e78057d (HOP_CAP_EXCEEDED registry literals), 5772bd1 (handoff). Contract: `specs/e295-hop-cap-and-sop-halves.md` AC1–AC12 (AC13 is qa-owned). No architecture spec (no architect hop, by cut).

One batched report is written here instead of one file per id on purpose: `review_reports/review_T-E298-01.md` and `review_reports/review_T-E300-01.md` already exist at the tree root as wave-1 evidence for different features that reused the same task ids, and a per-id file would overwrite them (see Correctness R2).

## Summary
- `tools/transitions.ts`: `HOP_CAP` 10 → 14; the step-2.5 hop-cap override now takes the round-cap shape (unconditional `(pm, In_Progress)` → `return null` before the self-loop fast path and the table lookup), closing E41. `computeNewRound` untouched; `dist/` rebuilt and byte-identical to a fresh `npm run build` (tree clean after rebuild).
- `scripts/check-bookkeeping.mjs` check (2): root-at-root citations emit nothing; a moved root citation resolves by basename in its tree (unique → silent, >1 → note with candidates, none → violation); archive-form rules unchanged; checks (1)(3)(4)(5) untouched. Exit 0 on HEAD.
- `gates/registry.ts`: DISPATCH_PIN_TIER_REJECTED row/mapping/two comments (E300) and the HOP_CAP_EXCEEDED `triggerEdge` / `hintStatic` literals 10 → 14 (e78057d). Both correct; `dist/gates/registry.*` matches.
- Content: const-01 Limits row; coord-03 hop-cap row with the same-lane continuation (a)–(f) and the write-time Evidence-Citation Convention; coord-02 tier sentence; skill-integrator CI-first lane/integration layers, fallback + flake rule, verifier brief, E299 5c sentence; skill-release-engineer 7a sentence; lane-protocol §3 bullet + `7/14`; d2 append-only amendments.
- Every AC1–AC12 proof command passes as written. `fanout check` against the wave manifest: 22 files, 0 out of bounds.
- Verdict: APPROVED — zero required findings; three recommended items routed to qa / integrator.

## AC Completeness
AC1 — implemented — content/const-01-core-head.md:16 (`| `hop` cap | 14 |`); tools/transitions.ts:318-326 (comment keeps DR-6 feature-scoped reset); `HOP_CAP_EXPORTED` prints 14 from dist.
AC2 — implemented — tools/transitions.ts:424-452; proof prints `null null HOP_CAP_EXCEEDED`; rejection carries `allowed=[(pm, In_Progress)]` and hint `hop_count=14 reaches hop cap (14)…`; same-agent at cap → null; `feature_changed: true` at cap → null; `computeNewRound` unchanged (landing from hop 14 → hop_count 15, no reset).
AC3 — implemented — specs/d2-server-brake-accounting.md and specs/d2-server-brake-accounting-architecture.md: numstat 13/0 each, one `## Amendment (2026-10-15, E295)` heading each, content states 14, the unconditional landing (E41) and that the text above is kept as the design record.
AC4 — implemented — content/coord-03-core-fallback.md:29 (still one row → human, `HOP_CAP_EXCEEDED` backticked, (a)–(f) all required, "at most ONE continuation per feature", E175(d) roll-up caveat). Row growth 821 chars (≤ 1,100); see Quality R1 on whole-file growth.
AC5 — implemented — docs/lane-protocol.md:42 (§3 bullet, Chinese, escalate first, (a)–(f), once per feature) and :78 (`例如 7/14`); `7/10` count 0; `不要 push、不要 merge、不要發版、不要刪 worktree` count 1; other §3 bullets unchanged (pure insertion).
AC6 — implemented — content/skill-integrator.md:111 (intro: CI run on the pushed lane branch; fallback still the serial `test-lock` full suite; "lanes never push") and :119 (test-claim row: push + `--ci-check --sha <reported sha>`, parallel push note, "red → send back, exactly as a local red").
AC7 — implemented — content/skill-integrator.md:147 (5b-6 build → commit dist → push → `--ci-check --sha <HEAD>`, "Each lane green on its own does not count" kept), :164-165 (6-2 push + ci-check; 6-3 opens the PR on the pushed head), :166 (`cannot reach `main`` verbatim, count 1), :171 ("Your own commits" verified the same way; "Docs only" not an exemption). `--ci-check --sha` count 5.
AC8 — implemented — content/skill-integrator.md:127-135 (verifier returns run id + verdict, "never suite output"; porcelain after a local `npm run build`; (2) re-anchors against `git rev-parse <branch>` and the run's sha; (3) scoped to the fallback suite; (1)(4)(5) unchanged).
AC9 — implemented — content/skill-integrator.md:125 (shared *CI fallback and flake rule* paragraph; `CI was not consulted for <lane> @ <sha> — <reason>`; `gh run rerun --failed <run id>` only for the E238 / E254 / E278 family).
AC10 — implemented — content/skill-integrator.md:155 (5c item 3: `npm run check:bookkeeping`, exit 0, before the bookkeeping commit; count within 5c = 1).
AC11 — implemented — content/coord-02-host-dispatch.md:34-38; gates/registry.ts:66-69, :107, :112-114, :635; `(none)` count 0; mapping row byte-matches the spec string.
AC12 — implemented — content/coord-03-core-fallback.md:64-65 (write-time path, `check:bookkeeping` as resolver, rationale fence kept and extended); content/skill-release-engineer.md:69 (one sentence, `check:bookkeeping` named); scripts/check-bookkeeping.mjs:23-33 (header), :406-430 (branch). Exit 0 on HEAD; behaviour re-verified on a scratch overlay (moved-unique → silent; two archive dirs → note naming both; deleted → violation, exit 1).

## Correctness
- No required findings.
- tools/transitions.ts:437-452 — new accepted-edge set at the cap is exactly `{any prev with prev.agent ≠ pm} → (pm, In_Progress)`; that is the spec's "accepted from every state" and is the identical shape of the three round-cap overrides at :383-421. No other edge opens: every other role transition is still rejected `HOP_CAP_EXCEEDED`, same-agent writes (incl. `pm:In_Progress → pm:Blocked` at hop 15) still bypass, `feature_changed` still bypasses, `pm:In_Progress → sr-engineer` at hop 15 still rejected, and under the cap `code-reviewer:In_Progress → pm` is still `TRANSITION_REJECTED` (the override is cap-gated only). `prev.agent === null` behaves as before.
- tools/transitions.ts:560-566 — hop increments on the landing (14 → 15) and resets only on feature change; DR-6 holds.
- scripts/check-bookkeeping.mjs:409-430 — the `existsAsCited` early `continue` now covers both root-at-root (AC12 a) and archive-exists; the archive-form "still at root" note precedes the root branch and is guarded by `c.dir !== null`, so archive-form behaviour is byte-equivalent to base. Measured: base emits 27 notes on this tree (8 root + 19 predicted-archive), HEAD emits the same 19 predicted-archive notes and drops the 8 root notes; no new violations.
- gates/registry.ts:174-181 (e78057d) — the `hintStatic` literal is concatenated after `hop_count=<n>` in the live rejection, so leaving it at `(10)` would have printed a wrong cap; the change is required for correctness of the AC2 hint. `triggerEdge` now describes the new shape accurately.
- **recommended R2 (bookkeeping hazard, not a code defect — for qa and integrator)**: task ids T-E298-01 and T-E300-01 collide with wave-1 ids whose evidence still sits at the tree roots: `review_reports/review_T-E298-01.md`, `review_reports/review_T-E300-01.md`, `qa_reports/review_T-E298-01.md`, `qa_reports/review_T-E300-01.md`. (i) `MISSING_REVIEW_EVIDENCE` for those two ids is satisfied by the wave-1 files independently of this round (this report's `covers:` line is the real evidence). (ii) qa's `qa_review` auto-record targets `qa_reports/review_<id>.md` — before the PASS write, qa must confirm it does not clobber the wave-1 qa files (cited by backlog rows, e.g. E170's row), or record evidence under a batched `covers:` file instead. (iii) At the next release's 7a move both waves' files land under one archive folder by basename — a same-name collision for whichever moves second; integrator should decide at 5c.

## Quality
- **recommended R1**: content/coord-03-core-fallback.md whole-file growth is 1,289 chars (base 21,158 → 22,447). AC4's ≤ 1,100 budget is met by the AC4 row itself (821, measured at aa05105); the remaining 468 is AC12's mandated convention rewrite, which carries no budget of its own. Read AC4 as row-scoped; qa should report the coordinator-bundle ceiling measurement (R2, zero headroom) with this split so the human approves the real number.
- **recommended R3**: content/skill-integrator.md:166 (Stage 6-4 `BEHIND` remedy) still lists "the full suite, and a push of the integration branch" — a local suite before the push. Not in AC7's scope (6-4 was to be kept), and it adds a check rather than skipping one, so it is not a defect, but it is the one remaining local-suite step outside the *CI fallback*. Candidate follow-up ticket for the integrator.
- content/skill-integrator.md:155 — the sr-engineer also replaced "citing archive evidence paths" with "citing each evidence path as it exists at write time". **Required for consistency, not scope creep**: under the E301 ruling (ii) the old wording instructs the integrator to do exactly what the new coord-03 convention forbids (cite a predicted archive folder). Same owned file, one phrase.
- optional: content/skill-integrator.md:58 (Lifecycle row 5, "integration branch → full suite green") is still true (CI runs the full suite) — no change needed.
- optional: gates/registry.ts:112-114 attributes the flip to "E295" (the lane) while :66-68 names E300 and E295 together; accurate either way.
- optional (outside the owned set, no action this lane): tools/handoff-orchestrator.ts:153-156 comment still says the override fires on a transition "that is not the (pm, In_Progress) landing" — loosely still true in effect (the landing is accepted), wording predates the reshape.
- Comment check (step 4b): every added comment in tools/transitions.ts, gates/registry.ts and scripts/check-bookkeeping.mjs is generic, cites ticket ids only, no paths/hosts/names — kept.

## Architecture
No architecture spec exists for this feature (no new module, data model or API). Layering unchanged: the hop override stays inside `validateTransition` precedence step 2.5, after the round-cap overrides and before the self-loop fast path, as AC2 requires; `next_role` lookahead (`effectiveAllowedSuccessors`) derives from `validateTransition` and needs no change. `npm run build` + `check:transitions-sync` OK (21 keys).

## Security
No findings. No new input crosses a trust boundary; check-bookkeeping reads only repo-local paths built from regex-constrained tokens (unchanged extractor). Constitution §6 information hygiene: no absolute local path, host, account or personal name in any added line of the diff (grep over added lines, spec excluded) — clean.

## Performance
No findings. The new check-bookkeeping branch reuses the prebuilt basename index (O(1) map lookup per citation); `existsSync` calls per citation are fewer than base (the root-at-root case now returns immediately). Transition validation adds one constant-time comparison.

## Verdict
APPROVED — all twelve ACs implemented and their proofs pass on HEAD 5772bd1; findings are recommended / optional only (R1 budget accounting, R2 task-id evidence collision, R3 Stage 6-4 wording).

Expected reds for qa (AC13 re-pins, all explained by this diff; `node --test` on the nine named files, 206/216): context-budget coordinator ceiling 20749; e178a "AC13: SOP verification stage" (old porcelain-after-suite bullet text); e299 CITE-ROOT-ARCHIVED, CITE-AMBIGUOUS, CITE-ROOT-TOLERATED, EXIT-0-WITH-NOTES (AC12 behaviour change); error-code-contract E300 `documentedInProse:false` pin; hop-count-transitions t-const (`=== 10`) and t-gate-fires-at-cap. feature-rollup, e297, e246 pass unchanged.
