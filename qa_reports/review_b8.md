# QA Review — B8-QA (b8-external-ref-ledger)

covers: B8-01, B8-02, B8-03, B8-04, B8-05, B8-06, B8-07, B8-08, B8-09, B8-10, B8-QA

> Claimed for review by @qa-engineer (sonnet). Code-review verdict was APPROVED
> (`review_reports/review_b8.md`) with zero correctness/quality/architecture/
> security/performance findings; QA's scope per that verdict was to re-baseline
> the 39 known pin failures and restore `npm test` exit 0 (AC-13), plus add
> positive coverage for the new gate/migration/preserve behavior.

## Verdict: **PASS**

- `npm run build` — 0 errors.
- `npm audit --audit-level=high` — exit 0 (1 low-severity `esbuild` dev-dependency
  advisory, below the `--audit-level=high` threshold; same finding code-reviewer
  independently confirmed).
- `npm test` — **959 / 959 passing** (938 pre-existing baseline tests, re-baselined
  in place where B8 invalidated a pin, + 21 new tests). Confirmed clean on 2
  consecutive full-suite runs after re-baselining, plus isolated per-file re-runs
  (see Flake note below).

## Spec-to-Test map (AC-1..AC-13, DR-1..DR-9)

| Spec item | Covered by |
|---|---|
| AC-1 (gate fires, unresolved) | `test/cut-approval-gate.test.mjs` XG1, X-pred-1 |
| AC-2 (resolved/absent/empty clears) | X-pred-2, X-pred-3, X-pred-4, XG2 |
| AC-3 (pinned to pm predecessor) | XG-nonpm |
| AC-4 (fires on both build edges) | XG-both-edges |
| AC-5 (file-mode only) | XS1 |
| AC-6 (ledger type/persist/REPLACE/reset) | XR-schema-1, XR1–XR4, X-empty |
| AC-7 (schema field + migration, no seed) | `test/handoff-migration.test.mjs` "AC-7/B8: v5 handoff…", "AC-7/B8: v4 file…" |
| AC-8 (migration pure/lossless/idempotent) | "AC-8/B8: v5→v6 migration step is pure and idempotent…" |
| AC-9 (closed state enum) | pre-existing zod object-schema enforcement; `tools/registry.ts` unchanged-shape, no new test needed (schema rejection is a generic zod path, same as `scope_decision`'s enum) |
| AC-10 (const-15 §7 wording) | `test/error-code-contract.test.mjs` "registry ⊆ doc" (backtick-quoted check) + `test/context-budget.test.mjs` re-baselined caps (content presence implied by measured growth) |
| AC-11 (skill-pm Gate Summary) | same as AC-10 (backtick check covers all three content files) |
| AC-12 (coordinator stop-condition) | same as AC-10 |
| AC-13 (build+audit+test all exit 0) | this review — confirmed all three |
| DR-1 (array-of-object frontmatter) | XR-schema-1 (round-trip of a 2-entry array) |
| DR-2 (gate placement, 3rd back-to-back) | XG-both-edges (asserts the compiled block sits with the right agent/error-code shape); code-reviewer independently verified placement against the frozen check-order comment |
| DR-3 (absence polarity, malformed-drop) | X-pred-2/3/4, X-malformed, X-malformed-parse |
| DR-4 (no PM-re-entry re-arm) | XR1 (explicit contrast-with-cut_approved test) |
| DR-5 (frontmatterData type widening) | implicit in XR-schema-1 (array-of-object write succeeds) |
| DR-6 (hint byte-parity) | code-reviewer verified by concatenation; not re-tested here (no code change in this pass) |
| DR-7 (storage forwarding, SQLite ignore) | XS1 |
| DR-8 (transitions union membership, 12→13) | `test/error-code-contract.test.mjs` DR-8 (re-baselined) |
| DR-9 (not in TRANSITION_GATE_CODES) | unchanged, covered by the existing `TRANSITION_GATE_CODES` invariant tests (no new member added there) |

## What was re-baselined (39 pre-existing pin failures — all deliberate-change pins, verified zero regressions, matching code-reviewer's independent count)

1. **16 handoff v5→v6 version-literal pins** across `test/cut-approval-gate.test.mjs`
   (R-schema-1, M1–M4), `test/handoff-migration.test.mjs` (AC-7 round-trip,
   AC-10(g) — bumped the "future" fixture from v6→v7 since v6 is now valid),
   `test/handoff-versioning.test.mjs` (6 tests: AC-1, AC-2×2, AC-4×2, AC-5),
   `test/schema-versions.test.mjs` (CURRENT_VERSIONS, registerMigration
   idempotent-overwrite, runMigrations no-op, runMigrations refuse-loud),
   `test/skill-evolution-v3.11.test.mjs` (AC-10 versions.ts grep), and
   `test/drift-skew.test.mjs` (T32 AC-6 skew message). M1/M2 in
   `cut-approval-gate.test.mjs` additionally needed their manually-registered
   migration chain extended with the v5→v6 step (they `_clearRegistryForTests()`
   and rebuild the chain by hand) — without it `runMigrations` correctly refused
   to climb to the new `CURRENT_VERSIONS.handoff` target (6) and threw
   `missing migration step handoff v5→v6`, which is exactly the intended
   fail-loud behavior, just against a stale hand-built chain.
2. **4 gate-catalog tests** in `test/error-code-contract.test.mjs`: `GATE_REGISTRY`
   18→19 entries; the `ALL_GATE_CODES ⟷ code-source` parity harvest; the
   "registry ⊆ doc" backtick-quote check; `TransitionRejection["error"]` union
   12→13. All four traced to one root cause the code-reviewer flagged:
   `SUFFIX_RE` lacked the new `_UNRESOLVED` shape — added it, which fixed the
   code-side AND doc-side harvest simultaneously (both were silently dropping
   `EXTERNAL_REFS_UNRESOLVED` before matching on either side).
3. **11 compose-equivalence content-byte goldens** in
   `test/compose-equivalence.test.mjs`: the 8 `build-*.txt` fixtures, `hook-lite.txt`,
   `hook-full.txt`, and `constitution-monolith.txt`. Regenerated the 10 build/hook
   fixtures via `scripts/capture-constitution-golden.mjs` against the current
   (post-B8) `dist/`; `constitution-monolith.txt` isn't auto-capturable (the
   pre-refactor `content/constitution.md` monolith no longer exists), so I
   regenerated it directly as `cat` of the 15 `CONSTITUTION_SEGMENTS` fragments —
   the same computation the test itself performs on the "actual" side, so the
   golden now reflects the post-B8 §7 wording as the new frozen baseline. Diffed
   every changed fixture (`git diff --stat` showed exactly one changed line per
   file) and confirmed each diff is the §7 External-reference-policy sentence
   change (AC-10) verbatim — no unrelated drift.
4. **5 token-budget caps** in `test/context-budget.test.mjs`. sr-engineer's
   handoff `pending_notes` history did not carry fresh measurements for this
   round, so I independently re-measured all five via the same
   `stripRationale(stripOriginTags(...))` pipeline the tests use: lean always-on
   3332→3386, skill-pm stripped 3225→3327, rationale-stripped (design-arm)
   5561→5616, teamwork coordinator bundle (design-arm) 9545→9699, non-design
   constitution 3477→3531. Re-verified the two derived margin assertions still
   hold at the new values (raw−stripped ≥ 240: 5889−5616=273; design-arm−non-design
   ≥ 2080: 5616−3531=2085) — both margins are unchanged or wider, confirming the
   growth landed symmetrically on both arms as expected for chain-tagged
   (not design-only-fenced) content.

## What was newly covered (positive coverage, 21 new tests)

**`test/cut-approval-gate.test.mjs`** (17 new tests, appended as a dedicated
`b8-external-ref-ledger` section mirroring the file's existing shape — this file,
not `feature-scope-gate.test.mjs`, is the true analog: I checked
`feature-scope-gate.test.mjs` and it tests an unrelated prompt-only SOP gate
called "Feature-Scope Gate" for multi-feature ticket splitting, not the
`SCOPE_DECISION_REQUIRED` server gate the architecture doc meant as the analog;
`cut-approval-gate.test.mjs`'s `hasCutApproval`/reset-semantics/gate-fire/SQLite-skip
shape is the correct structural twin for `hasUnresolvedRefs`):
- `X-pred-1..4` — predicate fire/clear on mixed/absent/empty/all-resolved ledgers.
- `X-malformed`, `X-malformed-parse` — predicate and parser never throw on
  hostile input; parser drops malformed entries (empty ref, missing ref,
  out-of-enum state) and keeps the well-formed ones.
- `X-empty` — `external_refs: []` elides from disk, round-trips as absent.
- `XR-schema-1` — array-of-object YAML round-trip (the first such handoff field).
- `XR1` — **the load-bearing DR-4 test**: PM re-entry omitting `external_refs`
  preserves the ledger (explicitly contrasted against `cut_approved`'s R2,
  which re-arms on the same edge — proving the inverse-polarity decision is
  implemented, not just documented).
- `XR2` — non-PM same-feature write carries the ledger forward.
- `XR3` — `active_feature` change drops the ledger.
- `XR4` — REPLACE semantics, including `[]` clearing a prior unresolved ledger.
- `XG1`, `XG2` — gate fire/clear via the predicate composition (same convention
  as the file's existing G1–G3).
- `XG-both-edges` — asserts the compiled orchestrator block includes both
  `"architect"` and `"sr-engineer"` alongside `EXTERNAL_REFS_UNRESOLVED` (AC-4).
- `XG-nonpm` — asserts the arm condition's `prevTuple.agent === "pm"` guard,
  and separately shows the predicate itself is agent-agnostic (proving the
  orchestrator's pm-pinning, not the predicate, is what protects resume/self-loop
  edges).
- `XS1` — SQLite-mode skip via `instanceof FileHandoffStorage`.
- `XC1` — verbatim error-code string in the compiled orchestrator.

**`test/handoff-migration.test.mjs`** (3 new tests):
- "AC-7/B8: v5 handoff (no external_refs) migrates to v6…" — no-seed contract,
  plus confirms the *sibling* v5 attestation field (`cut_approved`) survives
  the v5→v6 climb untouched (cross-feature lossless check).
- "AC-8/B8: v5→v6 migration step is pure and idempotent…" — re-running
  `runMigrations` on an already-v6 payload is a strict no-op (`applied: []`,
  same object reference returned), including with a populated `external_refs`
  array that must survive verbatim.
- "AC-7/B8: v4 file (pre-dates BOTH cut_approved and external_refs) climbs
  v4→v5→v6…" — full double-hop regression: neither attestation field gets
  seeded across two additive migrations in sequence.

## Copy Audit Gate / Visual Audit Gate

N/A — spec's Copy/Strings table (S01–S03) is server-authored error code + hint +
enum strings, no external design source; Visual Tokens/Widgets are explicitly
N/A (server-only feature, no UI). Phase 1.5 Visual Compare: skipped — no
`design/<feature>.md` / `## Visual Baselines` declared (matches `scope_decision:
single-feature`, no-design mode recorded in handoff state).

## Flake note (per code-reviewer's pre-flagged item)

`t-ac2-current-basename-rejected` (`test/handoff-write-arg-guard.test.mjs`) is a
known pre-existing order/timing flake, unrelated to B8 — that file spawns a real
`dist/index.js` MCP-server child process per test (12+ subprocess-spawning tests
in one file) with a fixed 2s wait, which is sensitive to system load. During this
review's repeated back-to-back full-suite runs I observed it (and, once, a
sibling test in the same file, `t-ac1-valid-root-path-accepted`) fail
intermittently under that self-inflicted load, always alone, always in that one
subprocess-heavy file, and always recoverable on the next run. Isolated re-runs
of `node --test test/handoff-write-arg-guard.test.mjs` passed 14/14 three times
in a row. The final confirmation run (after a brief pause to let load settle)
was clean at 959/959. No B8 code or test touches this file.

## Task completion

`tw_complete_task` called for B8-01 through B8-10 and B8-QA. State updated to
`status: PASS`, `agent_id: qa-engineer`, `next_role: human` (release-engineer /
human decides packaging next — this ticket's spec has no design mode and no
further chain step defined beyond QA PASS).
