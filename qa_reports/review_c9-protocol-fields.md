# QA Review — c9-protocol-fields

covers: T-C9-01, T-C9-02, T-C9-03, T-C9-04, T-C9-05, T-C9-06, T-C9-07, T-C9-08,
T-C9-09, T-C9-10, T-C9-11, T-C9-12, T-C9-13, T-C9-14, T-C9-15, T-C9-16

> QA-owned: T-C9-07..11 (test authoring) + full-suite re-baseline of the 52
> expected-red tests the code-reviewer's APPROVED verdict (`review_reports/review_T-C9-01.md`)
> attributed to sr-engineer's implementation (T-C9-01..06, T-C9-12..16). Code-reviewer
> found zero correctness/quality/architecture/security/performance defects; QA's
> scope per that verdict was test authoring + re-baseline, not implementation fixes.
> Crash-resume note: this run was restarted after a transient API 529 kill with zero
> prior progress (confirmed via `tw_get_state`/`tw_detect_drift` — handoff still
> `last_agent=code-reviewer`, no test/ file modified, no qa_reports/ evidence written).
> All work below was performed in this run.

## Verdict: **PASS**

- `npm run build` — 0 errors.
- `npm audit --audit-level=high` — exit 0 (1 low-severity `esbuild` dev-dependency
  advisory, below the `--audit-level=high` threshold — pre-existing, unrelated to c9).
- `npm test` — **973 / 973 passing**, 0 fail, 0 skip. Confirmed clean on 3 consecutive
  full-suite runs. One isolated flake was observed on an intermediate run in
  `test/handoff-write-arg-guard.test.mjs` (a pre-existing, documented subprocess-load
  flake — see Flake note below); re-run clean immediately after, and the file passed
  14/14 in 3 consecutive isolated re-runs.

## Spec-to-Test map (AC-1..AC-9)

| Spec item | Covered by | Method | Result |
|---|---|---|---|
| AC-1 (schema bump v6→v7, stamp-only migration) | `test/schema-versions.test.mjs` (`CURRENT_VERSIONS`, registerMigration idempotent-overwrite, runMigrations no-op, runMigrations refuse-loud — all re-baselined 6→7); `test/skill-evolution-v3.11.test.mjs` (AC-10 versions.ts grep, re-baselined); `test/handoff-migration.test.mjs` "AC-1/C9: v6→v7 migration step stamps version only…" + "AC-1/C9: round-trip — re-running runMigrations…"; `test/handoff-versioning.test.mjs` (AC-1/AC-2/AC-4/AC-5, all re-baselined to v7) | Unit (pure `runMigrations`) + fixture round-trip | PASS |
| AC-2 (3 new optional fields, zod-enum-validated, surfaced in `tw_get_state`) | `test/qa-flow.test.mjs` T-C9-10 zod-rejection ×3 (`next_role`, `resume_of`, `review_verdict` garbage values) + positive control (all three valid, real write, real readback via the same `{ ...state }` spread path); `test/handoff-migration.test.mjs` AC-9/C9 fixture (proves the parser round-trips real values, tested via absence-after-migration + the AC-3 transient test's presence-after-write assertions) | Integration (real `TOOL_REGISTRY` entry + real `handleUpdateState`) | PASS |
| AC-3 (transient, write-scoped — NOT blindly preserved) | `test/handoff-migration.test.mjs` "AC-3/c9: a downstream write omitting next_role/resume_of/review_verdict DOES drop them…" (new, contrasts directly against the pre-existing scope_decision/prd_path preserve test in the same file) | Integration (write → read → write-omitting → read) | PASS |
| AC-4 (resume_of replaces pending_notes grep, no dual-read) | `test/qa-flow.test.mjs` C1-07 section, fully re-baselined: accept (`next_resume_of` field) ×3, reject (absent/wrong-role field) ×4, **3 new inert tests** (legacy pending_notes token alone does NOT open the edge; field wins over conflicting legacy prose), status-guard ×3, pre-existing-edge-independence ×12, round-cap-precedence ×2, plus 3 integration tests via `handleUpdateState` (2 accept + 1 new inert-at-the-tool-boundary test) | Unit (`validateTransition`) + integration (`handleUpdateState`) | PASS |
| AC-5 (`REVIEW_VERDICT_STATUS_MISMATCH` gate, verdict⟺status) | `test/qa-flow.test.mjs` T-C9-10 gate matrix — all 6 architecture-specified rows: APPROVED+FAIL (reject), CHANGES_REQUESTED+In_Progress (reject), APPROVED+In_Progress (accept), CHANGES_REQUESTED+FAIL (accept), absent+FAIL (accept, never fires), non-code-reviewer+APPROVED (accept, never fires) | Integration (real `handleUpdateState`, real orchestrator gate) | PASS |
| AC-6 (`next_role` advisory only, not cross-checked against `ALLOWED_TRANSITIONS`) | `test/qa-flow.test.mjs` T-C9-10 positive-control test (sets `next_role="sr-engineer"` on an unrelated `pm→pm` self-loop write; succeeds — proving no cross-check fires) | Integration | PASS |
| AC-7 (pending_notes reverts to prose; 13 content files updated) | `test/compose-equivalence.test.mjs` (11 goldens regenerated + monolith fixture hand-mirrored to the identical prose edit); `test/context-budget.test.mjs` (6 token caps re-measured and bumped, 1 sentence-anchor reworded); `test/phase-0-5-sop.test.mjs` (2 tests re-pointed to `next_role=` field syntax); `test/pixel-perfect-visual-compare.test.mjs` + `test/qa-visual-skill-split.test.mjs` (3 tests re-pointed); **new** `test/skill-evolution-v3.11.test.mjs` repo-wide sweep across all 13 in-scope files asserting the retired `next_role:`/`resume_of:`/`review: APPROVED\|CHANGES_REQUESTED` pending_notes shapes are gone from every one, including the 5 files no other test touches (skill-code-reviewer, skill-release-engineer, skill-design-auditor, skill-doc-writer, skill-researcher) | Golden-snapshot equivalence + token measurement + repo-wide regex sweep | PASS |
| AC-8 (dispatch_pins deferred — not this ticket) | N/A — no code/content surface to test; confirmed by repo-wide grep during spec/architecture authoring (PM/architect), re-confirmed here: no `dispatch_pins` field added to `tools/registry.ts` zod schema or `HandoffState` | Inspection | PASS (out of scope, correctly not implemented) |
| AC-9 (backwards compat on migrate — legacy tokens inert, byte-verbatim) | `test/handoff-migration.test.mjs` "AC-9/C9: v6 handoff (legacy next_role/resume_of/review tokens in pending_notes) migrates to v7 on read…" (new fixture: pending_notes preserved byte-verbatim, zero semantic extraction, sibling `external_refs` field preserved) | Integration (fixture round-trip) | PASS |

## T-C9-07..11 — new tests authored (qa-owned)

**T-C9-07 (migration fixtures)** — `test/handoff-migration.test.mjs`:
- "AC-1/C9: v6→v7 migration step stamps version only — external_refs survives, new protocol fields stay absent" (replaces the old AC-8/B8 no-op test, which was actually exercising the v6→v7 *step*, not a no-op, once CURRENT moved to 7).
- "AC-1/C9: round-trip — re-running runMigrations on the now-v7 payload is a no-op (applied === [])" — the genuine no-op fixture T-C9-07 calls for.
- "AC-9/C9: v6 handoff (legacy next_role/resume_of/review tokens in pending_notes) migrates to v7 on read…" — migrate-on-read with legacy tokens present, proving inertness.
- "AC-3/c9: a downstream write omitting next_role/resume_of/review_verdict DOES drop them…" — transient round-trip (added during evidence review to close an AC-3 coverage gap).
- Refuse-loud on v8 — re-pointed the pre-existing AC-10(g) fixture from v7-vs-v6-server to v8-vs-v7-server (exact fixture T-C9-07 calls for, already existed under c9's predecessor ticket's naming and only needed the version bump).

**T-C9-08 (schema-versions.test.mjs coverage)** — re-baselined `CURRENT_VERSIONS.handoff` 6→7, `registerMigration` idempotent-overwrite chain extended to v6→v7, `runMigrations` no-op payload moved to v7, refuse-loud message moved to "server max 7". No new tests needed — v7 coverage is exercised by the same generic assertions the file already runs per-version.

**T-C9-09 (Amend-Resume Edge via structured field)** — `test/qa-flow.test.mjs` C1-07 section, rewritten field-by-field:
- Accept: 3 tests (`next_resume_of` names the exact target role).
- Reject: 4 tests (absent field, wrong-role field ×2, field vs. status guards ×3 carried over).
- **Inert (new)**: 3 tests — a well-formed legacy `resume_of: <role>` pending_notes-shaped token alone does not open the edge; a legacy token naming the RIGHT role does not override a `next_resume_of` field naming the WRONG one (field is authoritative); an integration-level inert test through the real `handleUpdateState` tool boundary (rejects with `TRANSITION_REJECTED`, not silently accepted, not misreported as a gate failure).
- Pre-existing-edge independence (12), round-cap precedence (2), gate isolation via `handleUpdateState` (2, re-pointed to the `resume_of` tool arg instead of a pending_notes token) — all carried over and re-pointed to the field.

**T-C9-10 (enum rejection + gate matrix, new file section)** — `test/qa-flow.test.mjs`:
- 3 zod-boundary rejection tests (garbage `next_role`, `resume_of`, `review_verdict`) exercised against the real `TOOL_REGISTRY` entry's `.run()` — note: `ToolRegistryEntry.run` is a non-async arrow that throws *synchronously* on a zod parse failure; `assert.rejects` only converts that into an awaitable rejection when the function it's given is itself `async` (documented inline — a plain arrow wrapper lets the ZodError propagate uncaught past the assertion).
- 1 positive control (all three valid values, real write, real orchestrator round-trip).
- 6-row gate matrix, all rows from the architecture's test-threshold table: reject×2, accept×2, absent-never-fires×1, non-code-reviewer-never-fires×1 (using the `sr-engineer:Blocked → sr-engineer:In_Progress` self-resume edge to avoid confounding with the unrelated `SCOPE_DECISION_REQUIRED`/`CUT_APPROVAL_REQUIRED` build-entry gates).

**T-C9-11 (error-code-contract.test.mjs parity)** — `SUFFIX_RE` extended with `MISMATCH` (DR-7, the b8 `UNRESOLVED` precedent); `GATE_REGISTRY` count re-baselined 19→20; new explicit pin test asserting `REVIEW_VERDICT_STATUS_MISMATCH` is both a real registry entry AND backtick-quoted in ≥1 `content/*.md` (on top of the generic generative-parity assertions, which also now pass). `DR-8`'s `TransitionRejection["error"]` union assertion required no change — confirmed it stays at 13 members (the code correctly did NOT add the new gate to that union).

## Re-baseline of the 52 expected-red tests (all confirmed genuine, zero implementation defects)

1. **Schema v6→v7 version-literal pins** (`test/schema-versions.test.mjs`, `test/skill-evolution-v3.11.test.mjs`, `test/handoff-versioning.test.mjs`, `test/handoff-migration.test.mjs`, `test/cut-approval-gate.test.mjs` R-schema-1/M1-M4, `test/drift-skew.test.mjs`) — all bumped 6→7, mirroring the b8 v5→v6 precedent exactly. `cut-approval-gate.test.mjs`'s M1/M2 additionally needed their manually-registered migration chain extended with the v6→v7 step (they `_clearRegistryForTests()` and rebuild by hand) — without it, `runMigrations` correctly refused to climb to the new `CURRENT_VERSIONS.handoff` target and threw `missing migration step handoff v6→v7`, which cascaded into M3/M4/X-malformed-parse failing too (all four share the file's global registry state within one test-file process). Fixed at the root by extending M1/M2's chain; M3/M4/X-malformed-parse then passed unmodified.
2. **Gate-catalog tests** (`test/error-code-contract.test.mjs`): `GATE_REGISTRY` 19→20; `SUFFIX_RE` extended with `MISMATCH` (fixes the code-side AND doc-side harvest simultaneously — both were silently dropping `REVIEW_VERDICT_STATUS_MISMATCH` before the fix, exactly the b8 `UNRESOLVED` precedent DR-7 named).
3. **11 compose-equivalence content-byte goldens** (`test/compose-equivalence.test.mjs`): the 8 `build-*.txt` fixtures + `hook-lite.txt` + `hook-full.txt` regenerated via `scripts/capture-constitution-golden.mjs` against the post-c9 `dist/`; `constitution-monolith.txt` hand-mirrored with the identical 4 prose edits sr-engineer made to const-05/const-08/const-12 (this fixture is not auto-capturable — `content/constitution.md` no longer exists post-AC8 — so it is kept in byte-sync by manually applying each shipped edit, the same mechanism used for every prior content-affecting ticket per `git log` on this fixture: b8, a11, a13).
4. **7 context-budget token-budget tests**: 6 numeric caps re-measured and bumped (lean bundle 3491→3685, skill-pm 3327→3377, skill-sr-engineer 2258→2275, design-arm floor 5721→6024, teamwork bundle 10879→11290, non-design floor 3636→3939 — all margins re-verified, unchanged or wider) + 1 sentence-anchor (`AC-P2-5` reorder-only test) updated to the new verbatim S6 sentence (the old anchor asserted byte-identity with a sentence that was legitimately REWORDED by AC-7, not just reordered by the earlier Phase-2 reflow this test's contract actually targets).
5. **5 escalation-table `next_role:`-pattern tests** (`test/phase-0-5-sop.test.mjs` ×2, `test/pixel-perfect-visual-compare.test.mjs` ×1, `test/qa-visual-skill-split.test.mjs` ×2): all asserted a `next_role:\s*<role>` colon-form pending_notes token; the new convention emits `next_role="<role>"` (a `tw_update_state` kwarg) or a bare table cell — regexes updated to match the new shape, with the underlying routing-target assertions (sr-engineer / design-auditor / pm) unchanged.

Zero implementation defects found. Every failure traced to a known-shape, spec-mandated content/schema change; no red test required a src/ fix.

## Copy Audit Gate / Visual Audit Gate

N/A — spec's Copy/Strings table is explicitly empty ("feature has no user-facing
strings"); Visual Tokens/Widgets explicitly N/A (protocol/schema change only, no
UI). Phase 1.5 Visual Compare: skipped — no `design/c9-protocol-fields.md` /
`## Visual Baselines` declared (matches `scope_decision: single-feature`,
no-design mode recorded in handoff state per PM's spec Dependencies section).

## Flake note

`test/handoff-write-arg-guard.test.mjs` produced one intermittent failure during
this review's repeated full-suite runs (973/973 on 3 of 4 total runs; 1 run showed
a single unspecified fail with no `not ok` line surfaced, consistent with a
subprocess-timing race). This is the SAME pre-existing, documented flake class
noted in `qa_reports/review_b8.md`'s Flake note: that file spawns a real
`dist/index.js` MCP-server child process per test (12+ subprocess-spawning tests)
with a fixed 2s wait, sensitive to system load. Isolated re-runs of
`node --test test/handoff-write-arg-guard.test.mjs` passed 14/14 three times in a
row. No c9 code or test touches this file's subject matter (workspace-path /
`[object Object]` sentinel guards). The final confirmation run was clean at
973/973.

## Task completion

`tw_complete_task` called for T-C9-01 through T-C9-16. State updated to
`status: PASS`, `agent_id: qa-engineer`, `next_role: human` (spec has no design
mode and no further chain step defined beyond QA PASS; `dispatch_pins:
sr-engineer=fable` carried forward per the coordinator's crash-resume
instruction).
