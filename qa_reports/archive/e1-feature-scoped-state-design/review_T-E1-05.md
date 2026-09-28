# QA Review — T-E1-05 / T-E1-06 (e1-feature-scoped-state-design)

covers: T-E1-01, T-E1-02, T-E1-03, T-E1-04, T-E1-05, T-E1-06

Feature: e1-feature-scoped-state-design. Spec: specs/e1-feature-scoped-state-design.md
(design-deliverable-first; no separate `-architecture.md`). Code-reviewer APPROVED
T-E1-01/02/03 in review_reports/review_T-E1-04.md (batched, covers: T-E1-02, T-E1-03).
Ratified calibrations honored throughout: `LEASE_TTL_MIN = 30`; `Blocked` counts as
lease-held = YES.

## Expected-Red Diff

`qa_reports/expected-red_e1-feature-scoped-state-design.txt` is present (9 entries).
Ran the FULL suite BEFORE any re-baseline edit; actual red set:

```
not ok 125 - AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 9545 ~tok)
not ok 284 - AC-1/AC-5: GATE_REGISTRY has exactly 24 entries (23 in, 24 out — d9-qa-review-scoped-append added QA_REVIEW_TARGET_REQUIRED)
not ok 285 - AC-5: ALL_GATE_CODES === code-side shape-rule harvest (registry <-> code source parity)
not ok 287 - registry ⊆ doc: every documentedInProse:true entry is backtick-quoted in >=1 content/*.md
not ok 291 - DR-8: TransitionRejection["error"] union stays byte-identical at 14 members, all ⊆ ALL_GATE_CODES
not ok 303 - doc-file mapping (c12): gates/registry.ts's errorCode→doc-file mapping comment matches the actual backtick-quote sites
not ok 304 - AC3 (c12): every (errorCode, field) pair for triggerEdge/armCondition is either mechanically checked above or explicitly allowlisted as free-text — no silent exemptions
not ok 469 - t-e2e-feature-reset: an active_feature change resets hop_count to a fresh count, un-freezing dispatch (AC-3)
not ok 881 - t-golden-byte-identity (AC1/AC5): composeSkill("skill-coordinator.md", {taskTool:true}) === frozen golden monolith, byte-for-byte
```

**Diff vs manifest: EMPTY — 9/9 manifest entries confirmed red, 0 unexplained reds.**
Every actual red is exactly one of the 9 declared entries; no extra failing test and no
manifest entry that stayed green. Disposition per entry:

| manifest entry | disposition |
|---|---|
| `AC-1/AC-5: GATE_REGISTRY has exactly 24 entries` | catalog 24→25 (`FEATURE_LEASE_HELD` added) — count re-baseline, genuine |
| `AC-5: ALL_GATE_CODES === code-side shape-rule harvest` | `FEATURE_LEASE_HELD`'s `_HELD` suffix was outside `SUFFIX_RE` — invisible to both harvests until widened, genuine |
| `registry ⊆ doc` | same `SUFFIX_RE` cause — genuine |
| `DR-8: TransitionRejection["error"] union … 14 members` | union grew 14→15 (spec-mandated handler-side extension, T-E1-01 scope) — genuine |
| `doc-file mapping (c12)` | mapping comment count (24→25) — genuine. Also found (beyond the manifest's stated cause) that `FEATURE_LEASE_HELD` is backtick-quoted in **two** content files (`coord-03-core-fallback.md` AND `skill-release-engineer.md`, the latter's incidental citation in the T-E1-02 re-baseline prose), while the mapping comment only listed the first — a genuine gap in code-reviewer's T-E1-04 approval, not a regression. Fixed by listing both files in the mapping comment (comment-only, no logic change). |
| `AC3 (c12): free-text-allowlist closure` | `FEATURE_LEASE_HELD`'s `triggerEdge` needed an allowlist entry once visible (its `armCondition` was already mechanically checkable via the live `isFeatureLeaseHeld(...)` predicate literal — no allowlist entry needed there) — genuine |
| `t-e2e-feature-reset (AC-3)` | pre-E1 fixture wrote a NEW `active_feature` over a fresh `In_Progress` incumbent — exactly the clobber `FEATURE_LEASE_HELD` now rejects by design; fixture ages the incumbent past `LEASE_TTL_MIN` before the cross-feature write — genuine, hop-count assertion itself unchanged |
| `AC8/AC-P2-7: teamwork coordinator bundle ≤ 9545 ~tok` (live cap 13298) | `coord-03-core-fallback.md` grew (Feature-Scope Gate note + `FEATURE_LEASE_HELD` Escalation Routes row, T-E1-03) — cap re-measured and raised 13298→13537, genuine |
| `t-golden-byte-identity` | same `coord-03-core-fallback.md` growth — frozen monolith fixture regenerated via `composeSkill(...)`, diff confirmed to be exactly the two T-E1-03 additions (3 lines, +956 bytes) — genuine |

No entry required a disposition of "unrelated flake" or "already fixed" — all nine trace
directly to the T-E1-01/02/03 diff. No regression found among them.

## Phase 1 — Review

Code-reviewer APPROVED the implementation (review_reports/review_T-E1-04.md): predicate
purity/fs-freedom, orchestrator placement, `Blocked`-counts-as-held, zero changes to
`tools/handoff.ts`/`tools/storage*.ts`/`schema/*`, both storage modes, skill-text fidelity.
QA scope here is test coverage per the SOP boundary (style/architecture/correctness stay
code-reviewer's) — re-derived the same invariants independently while authoring tests
(read `gates/feature-lease.ts`, the orchestrator gate block, `gates/registry.ts`'s
`FEATURE_LEASE_HELD` entry) and found them consistent with the spec's ratified predicate.

**Copy Audit Gate / Visual Audit Gate**: specs/e1-feature-scoped-state-design.md is a
design-deliverable document (no PM spec precedes it per its own header), and carries no
`## Copy / Strings` or `## Visual Tokens` H2 — N/A, logged per SOP absent-branch.

**Phase 1.5 — Visual Compare**: no `design/e1-feature-scoped-state-design.md` file exists
for this feature (server-mechanism work, no UI surface) — skipped (no Visual Baselines
declared).

## Phase 3 — Tests (AC → test map)

| AC / contract | test(s) |
|---|---|
| `isFeatureLeaseHeld` same-feature short-circuit | `test/feature-lease.test.mjs` P1 |
| `isFeatureLeaseHeld` PASS releases the lease | P2 |
| `isFeatureLeaseHeld` Blocked counts as held (+ FAIL, same non-terminal class) | P3, P3b |
| `isFeatureLeaseHeld` strict-`<` TTL boundary (29m59s / exactly 30m / 30m01s) | P4a, P4b, P4c |
| `isFeatureLeaseHeld` NaN/corrupt `last_updated` fails open | P5a, P5b |
| `isFeatureLeaseHeld` null/undefined prevState never gates | P6 |
| Orchestrator `FEATURE_LEASE_HELD` gate — cross-feature reject while fresh+non-terminal | FM1 (file), SQ1 (SQLite) |
| Orchestrator gate — Blocked incumbent still rejects | FM2 (file), SQ3 (SQLite) |
| Orchestrator gate — PASS incumbent releases | FM3 (file), SQ2 (SQLite) |
| Orchestrator gate — TTL auto-expiry releases | FM4 (file) |
| Orchestrator gate — same-feature write never gated | FM5 (file) |
| T-E1-02 release re-baseline SOP prose (skill + template mirror) | `test/feature-lease.test.mjs` S1–S4 |
| T-E1-03 coordinator Feature-Scope Gate note + Escalation Routes row | S5, S6 |
| Expected-red re-baselines (catalog/union/mapping/allowlist/hop-fixture/budget-cap/golden-fixture) | `test/error-code-contract.test.mjs`, `test/hop-count-transitions.test.mjs`, `test/context-budget.test.mjs`, `test/skill-manifest.test.mjs` (existing files, edited) |

**Coverage Gate**: `gates/feature-lease.ts` is a 13-line pure function with zero branches
untested — every predicate clause (same-feature, PASS, Blocked/FAIL, TTL boundary ×3,
NaN/empty fail-open, null prevState) has a dedicated unit test. 100% line coverage on the
new file (no tooling gap to note).

**Security smoke**: boundary inputs covered — empty-string `last_updated` (P5b), null/
undefined `prevState` (P6), and the orchestrator-level tests exercise the real zod-validated
`tw_update_state` entry point (via `handleUpdateState`), not a hand-rolled shortcut.

## Phase 4 — Run

- `npm run build`: 0 errors (tsc clean).
- `npm audit --audit-level=high`: 0 high/critical advisories.
- `npm test`: **1235/1235 pass, 0 fail** (full suite, both storage modes exercised;
  `better-sqlite3` present in this environment so SQLite-mode tests ran, not skipped).

Files touched this round:
- `test/feature-lease.test.mjs` (new — 24 tests: unit predicate ×11, orchestrator gate
  file-mode ×5, SQLite-mode ×3, skill-text pinning ×6, minus 1 counting overlap = 24 total).
- `test/error-code-contract.test.mjs` (modified — `SUFFIX_RE` widened with `HELD`; catalog
  count 24→25; DR-8 union count 14→15; `FEATURE_LEASE_HELD:triggerEdge` added to
  `FREE_TEXT_ALLOWLIST`).
- `test/hop-count-transitions.test.mjs` (modified — `backdateLastUpdated` helper added;
  `t-e2e-feature-reset` ages the incumbent past `LEASE_TTL_MIN` before the cross-feature
  write it was already testing).
- `test/context-budget.test.mjs` (modified — coordinator design-arm bundle cap raised
  13298→13537 with dated comment).
- `test/fixtures/compose-golden/skill-coordinator-monolith.txt` (regenerated via
  `composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent)` —
  diff confirmed to be exactly the two T-E1-03 additions).
- `gates/registry.ts` (comment-only — doc-file mapping line for `FEATURE_LEASE_HELD` now
  lists both `coord-03-core-fallback.md` and `skill-release-engineer.md`; no logic/behavior
  change, flagged above for code-reviewer visibility).

## Verdict

**PASS** — T-E1-01 through T-E1-06. All 9 expected reds accounted for and re-baselined
(genuine, non-regression in every case); 24 new tests added covering the predicate, both
storage modes, and the skill-text prose; full suite green; build/audit clean.

**Non-blocking flag carried forward (PM spec amendment recommended)**: the spec's sequence
diagram (L255-256) and prose (L220-221) illustrate the lease releasing immediately at the
post-release `release-engineer:In_Progress → pm:In_Progress` handback, but `pm:In_Progress`
is non-terminal (`status !== "PASS"`), so the ratified predicate correctly keeps the lease
held for up to `LEASE_TTL_MIN` (30 min) after a release, until either PASS or TTL expiry.
Code-reviewer already adjudicated this ACCEPTABLE-AS-BOUNDED (bounded, self-healing, loud,
worktree escape available) — recommend PM correct the diagram/prose or scope a follow-on
terminal-marker mechanism on release handback, so the illustration matches the shipped
(and correct) behavior.
## 2026-07-11T17:12:32.203Z — PASS — by qa-engineer

PASS — e1-feature-scoped-state-design. Phase 0.5 Expected-Red Diff: 9/9 manifest entries confirmed red pre-edit, 0 unexplained reds, all genuine qa-owned re-baselines (SUFFIX_RE +HELD, gate catalog 24->25, DR-8 union 14->15, doc-file mapping incl. skill-release-engineer.md's incidental FEATURE_LEASE_HELD citation, AC3 allowlist entry, hop-count fixture aged past LEASE_TTL_MIN, coordinator bundle cap 13298->13537, golden monolith fixture regenerated). New test/feature-lease.test.mjs (24 tests): isFeatureLeaseHeld unit coverage (same-feature short-circuit, PASS release, Blocked+FAIL held, TTL boundary under/at/over, NaN/empty fail-open, null prevState), orchestrator FEATURE_LEASE_HELD gate integration in BOTH file and SQLite storage modes, skill-text pinning for T-E1-02 release re-baseline SOP + template hint + T-E1-03 coord-03 gate note/escalation row. npm run build: 0 errors. npm audit --audit-level=high: 0 high/critical. npm test: 1235/1235 pass, 0 fail. Evidence: qa_reports/review_T-E1-05.md.

## 2026-07-11T17:12:56.923Z — PASS — by qa-engineer

PASS — e1-feature-scoped-state-design. Phase 0.5 Expected-Red Diff: 9/9 manifest entries confirmed red pre-edit, 0 unexplained reds, all genuine qa-owned re-baselines (SUFFIX_RE +HELD, gate catalog 24->25, DR-8 union 14->15, doc-file mapping incl. skill-release-engineer.md's incidental FEATURE_LEASE_HELD citation, AC3 allowlist entry, hop-count fixture aged past LEASE_TTL_MIN, coordinator bundle cap 13298->13537, golden monolith fixture regenerated). New test/feature-lease.test.mjs (24 tests): isFeatureLeaseHeld unit coverage (same-feature short-circuit, PASS release, Blocked+FAIL held, TTL boundary under/at/over, NaN/empty fail-open, null prevState), orchestrator FEATURE_LEASE_HELD gate integration in BOTH file and SQLite storage modes, skill-text pinning for T-E1-02 release re-baseline SOP + template hint + T-E1-03 coord-03 gate note/escalation row. npm run build: 0 errors. npm audit --audit-level=high: 0 high/critical. npm test: 1235/1235 pass, 0 fail. Evidence: qa_reports/review_T-E1-05.md.

