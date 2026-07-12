# Review — T-E3-CR (e3-outcome-shaped-acceptance, T-E3-01..03)

covers: T-E3-01, T-E3-02, T-E3-03

## Summary
- Reviewed the uncommitted working-tree diff over base `cd1982b` for the three sr-engineer legs: PM AC schema (`content/skill-pm.md`, T-E3-01), QA runtime-evidence phase (`content/skill-qa-engineer.md`, T-E3-02), and the new `AC_EXECUTION_LOG_MISSING` evidence gate (`gates/ac-execution.ts` NEW + `gates/registry.ts` + `tools/handoff-orchestrator.ts`, T-E3-03), plus the C15 expected-red manifest and `dist/` rebuild.
- The new gate is a faithful structural twin of `gates/expected-red.ts`; arm regex, per-feature `covers:` disposition, never-throw posture, and existence-only trust boundary all match the architecture Interface Contracts verbatim.
- The 28-gate co-landing interlock (union member + 28th registry entry + doc-mapping comment line + sole backtick-quote in `skill-qa-engineer.md`) is present and mutually consistent.
- `npm run build` green; full suite is 1318 pass / 5 fail / 1323 total, and the 5 reds are byte-exact matches of the 5 C15 manifest entries — all legitimate qa-owned re-baselines (T-E3-QA), no 6th unlisted red, no listed-but-green entry. No crash-seam inconsistency found: source ↔ dist are in sync (rebuild reproduced sr's dist identically) and no test files were touched.
- Verdict: APPROVED.

## Correctness
No blocking findings.

- `gates/ac-execution.ts:52` — arm regex `/^[^\S\n]*proof[^\S\n]*:/im` matches the architecture Interface Contract exactly. Verified behavior: line-leading `proof:` arms; mid-line prose (`- **AC1** … proof:`) and backtick-prefixed prose (`` `proof: pixel-diff` ``) never arm because `[^\S\n]*` consumes only intra-line whitespace before requiring the literal `proof`. No `g` flag, so the module-level const is not subject to stateful `lastIndex` bugs across repeated `.test()` calls. Live check: `grep -cE '^[[:space:]]*proof[[:space:]]*:'` on the E3 spec returns 8 → gate arms on E3's own PASS (dogfood self-arm intact; nothing in the diff exempts it).
- `gates/ac-execution.ts:80-93` — `hasProofAnnotatedAC` computes `specPath` before the `!activeFeature` guard and wraps `readFileSync` in try/catch → `armed:false` on empty feature or fs error. Faithful to `hasExpectedRedManifest`'s absence-is-non-blocking polarity (AC5 dormant for pre-E3 specs).
- `gates/ac-execution.ts:106-137` — `hasAcExecutionLogDisposition` is a verbatim clone of `hasExpectedRedDisposition`: direct `review_<id>.md` → lazy `buildCoverageIndex` fallback on first miss, `checked` de-dup set, per-candidate try/catch (never throws), returns present on first `## AC Execution Log` H2 found. Per-feature (at-least-one-across-ids) shape matches Decision (c).
- `tools/handoff-orchestrator.ts:767-790` — PASS-block placed immediately AFTER the Expected-Red block and INSIDE the `if (parsed.status === "PASS" && parsed.completed_tasks.length > 0)` guard opened at line 532 (closes at 791). File-mode-only (`storage instanceof FileHandoffStorage`), correct edge, append-only — the frozen check-order of every earlier gate is untouched. The separate code-reviewer evidence gate at 793+ is outside the PASS block and unchanged.
- C15 manifest (`qa_reports/expected-red_e3-outcome-shaped-acceptance.txt`): SOP 4a sampling — all 5 structured `file | test name` entries resolve to real, locatable tests (`error-code-contract.test.mjs` L177/612/706, `context-budget.test.mjs` L638, `qa-visual-skill-split.test.mjs` L109). Actual suite run yielded exactly those 5 failures (not ok 124/288/307/308/765) — a byte-exact 1:1 with the manifest. Each is a content-growth / registry-parity re-baseline owned by T-E3-QA per the architecture Test Specification §3, not a behavior-test regression.

## Quality
No blocking findings.

- Non-blocking nitpick — the manifest's human-readable prose (`qa_reports/expected-red_e3-outcome-shaped-acceptance.txt:16`) captions the skill-pm cap as "vs 3922 cap", but the actual asserting test (`context-budget.test.mjs:638`) pins `≤ 3775`. The load-bearing structured entry (line 18) names the test verbatim and is correct/locatable, so SOP 4a sampling is unaffected; only the free-text caption number drifts. Cosmetic — flagging for QA's awareness when it re-baselines, not a rejection.
- Comments in `gates/ac-execution.ts` and the registry entry cite the exact architecture Decision Records (b/c) and the sibling gate they mirror — consistent with the surrounding gate-module convention. `// Coded by @sr-engineer` header present.

## Architecture
Conforms to `specs/e3-outcome-shaped-acceptance-architecture.md` with zero deviations found.

- Decision (a) new `gates/ac-execution.ts` module: honored. Decision (b) parse-spec arm, no schema bump: honored — no `schema/versions.ts` / `schema/migrations-*.ts` churn (confirmed untouched). Decision (c) per-feature disposition: honored. Trust boundary existence-only: honored (no command execution / stdout parsing in the server). Storage-mode file-only: honored. Registry classification plain-text orchestrator (NOT in `TransitionRejection["error"]` / `TRANSITION_GATE_CODES`): honored — only `GATE_REGISTRY.length` and doc-mapping counts moved 27→28.
- AC7 scope guard: the diff touches exactly the three named legs plus the mandated registry/orchestrator wiring, the C15 manifest, and the `dist/` rebuild. Confirmed NOT touched: `schema/`, `tools/transitions.ts`, `gates/qa-review.ts`, `content/skill-sr-engineer.md`, `content/skill-qa-visual.md`, any `const-*.md`. No scope violation.
- Content edits conform: `skill-pm.md` proof convention is CONDITIONAL ("where feasible", per-AC judgment, AC1/AC2) and does NOT backtick-quote the gate code (doc-mapping parity kept clean). `skill-qa-engineer.md` uses the exact heading `**Phase 3.5 — AC Execution**`, the `## AC Execution Log` H2, cross-references the EXISTING *Escalation Routes: Phase 4 FAIL* row with NO new escalation row (AC6), and is the ONLY content file backtick-quoting `AC_EXECUTION_LOG_MISSING` (grep across `content/`: 1 file, 1 quote).

## Security
No findings.

- Filename sanitiser in `specFilePath` / `reviewPath` replaces non-`[A-Za-z0-9._-]` and collapses `..` runs to `_`, matching the v3.14.1 traversal-hardening precedent — a hostile `active_feature` / task id cannot produce a traversal-shaped path. No new input crosses a trust boundary; the gate reads files by presence only and never executes logged proof commands (the explicit trust boundary). No secrets introduced.

## Performance
No findings.

- One small spec read per armed PASS attempt (same posture as `hasVisualBaselinesInDesign` / `hasExpectedRedManifest`); dormant path for pre-E3 specs short-circuits on the arm read. `buildCoverageIndex` is built lazily only on a direct-file miss and reused across ids within the call. No hot-path loop, no unbatched I/O, no complexity-class regression vs base.

## Verdict
APPROVED — all three legs match the spec's 8 ACs and the architecture's pinned Interface Contracts; the co-landing interlock is consistent, build is green, and the 5 test reds are a byte-exact, fully-attributed qa-owned re-baseline set with no unexplained failures.

## Content-budget note (context-frugality, §1)
The added prose was assessed for gratuitous verbosity per the review brief. `skill-pm.md` adds one schema clause + a minimal 4-line worked example (~206 tokens: 3922→4128); every clause is load-bearing (feasibility criterion, placement rule, verbatim-execution note, conditional-not-mandatory carve-out). `skill-qa-engineer.md` adds Phase 3.5 as 5 non-redundant sub-bullets (~1379 bytes: 12950→14329: scan, none-branch, present-branch, fail-branch, pass-gate). Both are tight for what they encode; the cap bumps (skill-pm token cap and qa-engineer byte cap, owned by T-E3-QA) are justified. Not CHANGES_REQUESTED material.
