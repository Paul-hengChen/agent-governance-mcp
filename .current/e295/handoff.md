---
schema_version: 15
active_feature: "e295-hop-cap-and-sop-halves"
status: "In_Progress"
last_updated: "2026-10-15T03:25:41.952Z"
last_agent: "sr-engineer"
prd_path: "docs/backlog.md"
scope_decision: "single-feature"
scope_decision_why: "Five tickets (E295 (1)(2), E298 SOP half, E299 5c sentence, E300 content half, E301) all land in content/** plus two ts files; the shared-artifact rule allows one content lane per wave, so they are one feature with five tasks and one sr-engineer session (manifest specs/fanout-post-v4-w2.md, hop-risk mitigation). Non-design feature."
cut_approved: true
dispatch_pins:
  sr-engineer: "fable"
dispatch_mode: "feature"
evidence_schema: 2
next_role: "code-reviewer"
dispatched_at: "2026-10-15T03:25:41.952Z"
dispatch_mechanism: "task"
dispatch_mechanism_tier: "fable"
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 2
qa_rounds_total: 0
review_rounds_total: 0
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- sr-engineer: T-E295-01, T-E295-02, T-E298-01, T-E300-01, T-E301-01 ready for code review (one session, five task commits + one flagged fix commit e78057d; final HEAD = the handoff commit on top of e78057d). Build clean (npm run build, check:transitions-sync OK), npm audit --audit-level=high clean (8 low/moderate only), node scripts/check-bookkeeping.mjs exit 0, tree clean.
- T-E295-01 @ 85f54f4 — tools/transitions.ts (HOP_CAP 14; step-2.5 override takes the ROUND_CAP shape: unconditional (pm, In_Progress) -> return null before the self-loop fast path and the table lookup; comment rewritten citing E41; computeNewRound untouched), dist/tools/transitions.{js,js.map,d.ts,d.ts.map}, content/const-01-core-head.md (Limits hop cap 14), specs/d2-server-brake-accounting{,-architecture}.md (append-only '## Amendment (2026-10-15, E295)', 13 added / 0 deleted lines each). AC1/AC2/AC3 proof commands pass as written in the spec.
- T-E295-02 @ aa05105 — content/coord-03-core-fallback.md (HOP_CAP_EXCEEDED Escalation Routes row: still one row -> human, code backtick-quoted, conditions (a)-(f) all required + 'at most ONE continuation per feature'; growth 821 chars), docs/lane-protocol.md (one Chinese §3 bullet inserted directly above the unchanged '不要 push…' line; §5 example 7/14). AC4/AC5 proofs pass.
- T-E298-01 @ 8b904c8 (1/2) — content/skill-integrator.md only: 5a intro + test-claim row (git push -u origin <branch> then verify-release.mjs --ci-check --sha <reported sha>; lanes pushed at once; red -> send back); new shared paragraph 'CI fallback and flake rule (E298)' after the 5a table (Decisions row 'CI was not consulted for <lane> @ <sha> — <reason>'; one gh run rerun --failed only for the E238 / E254 / E278 family); verifier brief (run id + verdict, never suite output; porcelain after a local npm run build; constraint (2) re-anchors against the run's sha; (3) scoped to the fallback suite).
- T-E298-01 @ 8b904c8 (2/2) — 5b-6 (build -> commit dist -> push integ -> --ci-check); Stage 6-2 (push + --ci-check; 6-3 no longer repeats the push; 6-4 'cannot reach `main`' verbatim); 'Your own commits' verified the same way; overview-table stage-5 row reworded to match. 5c item 3 = the E299 sentence (npm run check:bookkeeping, exit 0, before the bookkeeping commit) and 'citing archive evidence paths' reworded to 'as it exists at write time' for E301 consistency (reviewer: that rewording goes beyond the literal E299 sentence). AC6-AC10 proofs pass.
- T-E300-01 @ fc21b54 — content/coord-02-host-dispatch.md (one sentence at the end of the Dispatch-time overrides paragraph), gates/registry.ts (DISPATCH_PIN_TIER_REJECTED row documentedInProse true; mapping row -> coord-02-host-dispatch.md; field comment + catalog comment reworded), dist/gates/registry.{js,js.map,d.ts.map}. AC11 proofs pass ((none) count 0).
- T-E301-01 @ 337bcb2 (option ii) — content/coord-03-core-fallback.md Evidence-Citation Convention (path as it exists at write time; check:bookkeeping named as resolver; rationale fence kept, updated), content/skill-release-engineer.md 7a (one sentence before the fragment list), scripts/check-bookkeeping.mjs check (2) (root-at-root note dropped; moved-root resolves by basename: unique -> silent, >1 -> note naming candidates, none -> violation; archive-form unchanged; header updated). Verified by a throwaway move of qa_reports/review_T-E235A-07.md into one / two / zero archive dirs (silent / note with both candidates / violation exit 1); fixture restored. On this HEAD the 8 root citations emit nothing; 19 predicted-archive citations still note 'not yet archived' (integrator 5c rewrites them).
- FLAG for reviewer + integrator (mechanical out-of-row edit, own commit e78057d): gates/registry.ts HOP_CAP_EXCEEDED row literals — triggerEdge '>= 10 … and next != (pm,In_Progress)' -> '>= 14 …; the (pm,In_Progress) landing is accepted unconditionally (E295, E41)'; hintStatic 'reaches hop cap (10)' -> '(14)'. Not in the task text (which names only the DISPATCH_PIN_TIER_REJECTED row), but test/error-code-contract.test.mjs 'AC2 (c12)' pins the triggerEdge literal to the live HOP_CAP and the hint is the user-facing error text, so AC13 cannot go green without it. Revert that one commit if declined (AC2 (c12) then stays red).
- Tests on the final tree — GREEN: feature-rollup 20/20, e178b-lane-watch 12/12 (its hop_count: 10 + n still passes at cap 14; qa may re-pin to the constant anyway), e297-main-protected-sop 9/9, e246-mailbox-teardown 15/15, e5-intake-tiering 31/31. RED, all qa re-pins per AC13 (no code change expected): hop-count-transitions 25/27 — 't-const: HOP_CAP_EXPORTED === 10' and 't-gate-fires-at-cap' (prev_hop_count: 10 literal, now under cap; needs 14 / HOP_CAP_EXPORTED plus the new AC2 landing case); error-code-contract 23/24 — 'E300: … documentedInProse:false … NO content/*.md this wave' (expected flip; AC2 (c12) green after e78057d).
- RED (cont.): e178a-integrator-role 16/17 — 'AC13: E192 verifier' pins the old bullet "status --porcelain taken **after** the suite ran" (now 'after a local npm run build' per AC8); the 5a command list also needs --ci-check added; context-budget 53/54 — coordinator bundle measured 21138 ~tok vs ceiling 20749 (R2: only this ceiling moves, set to the exact measured value; 5717/10226/8129 green); e299-check-bookkeeping 33/37 — CITE-ROOT-ARCHIVED (unique moved root now silently ok), CITE-AMBIGUOUS (now a note, exit 0), CITE-ROOT-TOLERATED (note dropped), EXIT-0-WITH-NOTES (fixture relied on the dropped root-at-root note). Compose goldens not regenerated (qa-owned; const-01 / coord-02 / coord-03 hunks expected).
- No expected-red manifest: every red above is a qa-owned test pin, not a deferred implementation. No pending-tickets.md blocks (no out-of-scope findings beyond the flagged registry literals). dispatch_pins sr-engineer=fable carried forward.

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
