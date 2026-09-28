# Review — b8-external-ref-ledger

covers: B8-02, B8-03, B8-04, B8-05, B8-06, B8-07, B8-08, B8-09, B8-10

> Round 1 — APPROVED — by code-reviewer (sonnet). Clean-context judge: read the
> working-tree diff, `specs/b8-external-ref-ledger.md` (AC-1..AC-13), and
> `specs/b8-external-ref-ledger-architecture.md` (DR-1..DR-9). Model note: this
> review ran on sonnet; sr-engineer implemented on a fable-pinned tier per session
> prefs — different model, so no same-model blind-spot concern.

## Summary
- Adds a server-enforced external-reference ledger (`external_refs`) + a third
  build-entry gate `EXTERNAL_REFS_UNRESOLVED`, mirroring the `scope_decision` /
  `cut_approved` precedent. 9 source files + 1 new module (`gates/external-refs.ts`),
  handoff schema bumped 5→6, `dist/` rebuilt.
- Scope matches the architecture blueprint's Affected-Files table exactly; every
  AC (AC-1..AC-12) is realized in code, and every DR (DR-1..DR-9) is honored,
  including the load-bearing inverse-polarity decision (DR-3/DR-4).
- `npm run build` 0 errors; `npm audit --audit-level=high` exit 0 (1 low-sev
  esbuild dev dep, below threshold). `npm test` = 899/938 (39 fails).
- I independently verified the 39 failures: **every one is a baseline pin
  invalidated by B8's deliberate version bump / gate-count / content edits — not
  a functional regression.** Category breakdown + evidence in §Correctness.
- Verdict: APPROVED. The 39 test re-baselines are B8-QA's scope (spec Dependencies
  §Test coverage), not an sr defect.

## Correctness

**Gate logic (`tools/handoff-orchestrator.ts:180-228`)** — no findings.
- Placement is exactly 3rd, after the cut-approval `if` block (ends :178) and
  before the QA-evidence record — matches DR-2 / the frozen check-order comment
  (extended, not reordered, at :9-13). All referenced symbols (`prevState`,
  `prevTuple`, `nextTuple`, `ALLOWED_TRANSITIONS`, `FileHandoffStorage`,
  `getActiveStorage`, `gate`) are in scope.
- Arm condition `FileHandoffStorage instanceof && (architect|sr-engineer) &&
  In_Progress && prev pm && prev In_Progress` satisfies AC-3 (prev pinned to pm →
  resume/re-entry on architect→sr and sr self-loop is never re-blocked), AC-4
  (both build edges), AC-5 (file-mode only).
- Envelope is byte-shape-identical to the cut-approval envelope: `{error,
  attempted, allowed, hint}` with the same `ALLOWED_TRANSITIONS.get("pm:In_Progress")`
  derivation (AC-1).
- **S02 hint byte-parity verified by concatenation**: emit-site prefix
  `` `External reference(s) unresolved: ${refs}.` `` + registry `hintStatic`
  (leading-space `" Each entry in external_refs must be fetched, indexed, or
  user-confirmed-ignorable before routing to build. See content/skill-pm.md
  §Resource Audit Gate and specs/b8-external-ref-ledger.md."`) reconstructs S02
  exactly, single-spaced at every seam (DR-6). No double-space defects.

**Predicates (`gates/external-refs.ts`)** — no findings. Pure, fs-free, loose
param type (`state: string`), guards `Array.isArray` before `.some`/`.filter`,
uses optional-chaining on entries — never throws on a hand-edited handoff.
Absence / empty / all-resolved → `false` / `[]` (AC-2 / DR-3). `listUnresolvedRefs`
preserves input order for deterministic hint enumeration.

**Parse/serialize/preserve (`tools/handoff.ts`)** — no findings.
- `parseExternalRefs` (:139-163) drops malformed entries, requires non-empty
  string `ref` + in-enum `state`, collapses empty/all-malformed → `undefined`;
  never throws. Round-trip is consistent with the write-side emit guard.
- Empty-array elision: write emits only when `effectiveExternalRefs.length > 0`
  (:588-591); parse returns `undefined` for empty → the empty and absent states
  are behaviorally identical and non-blocking (AC-2). Verified the clear path:
  passing `external_refs: []` REPLACES a prior non-empty ledger and drops it from
  disk (AC-6 "REPLACE, incl. empty []").
- Preserve/reset (:537-570): feature-scoped carry-forward when omitted, drop on
  `active_feature` change, verbatim REPLACE when provided — and crucially **no
  PM-re-entry re-arm** (DR-4). The inverse-polarity rationale is correct: re-arming
  an absence-clears field would silently un-block the gate. `externalRefsNeedsExisting`
  folds into the single existing-state read (DR-8) — no second `parseHandoff`.
- Orchestrator passes `externalRefs: parsed.external_refs` (input) to `writeState`
  while the gate reads `prevState` (existing) — correct separation.

**Schema (`schema/versions.ts`, `schema/migrations-handoff.ts`)** — no findings.
`CURRENT_VERSIONS.handoff` 5→6; v5→v6 step is stamp-only (`{...input,
schema_version: 6}`) — pure, lossless, seeds nothing (AC-7/AC-8). Grep-anchor
preserved.

**Zod / JSON descriptor (`tools/registry.ts`)** — no findings. Closed 4-state
enum, `ref` `min(1).max(1000)`, array `.max(200)`, `.optional()` (AC-9). The tool
JSON descriptor's `enum` + `required: ["ref","state"]` matches the zod shape —
no descriptor drift.

**Transitions (`tools/transitions.ts`)** — no findings. `EXTERNAL_REFS_UNRESOLVED`
added to the `TransitionRejection["error"]` union with doc-comment after
`CUT_APPROVAL_REQUIRED`; correctly NOT added to `TRANSITION_GATE_CODES` (DR-9).

### The 39 `npm test` failures — all verified baseline pins, zero regressions
I ran the suite twice and inspected the failure text of every non-obvious case.
A clean run is exactly 39 (matching sr's claim); a first run showed 40 — the
extra was `t-ac2-current-basename-rejected` (test #320, ~2s duration), which
**passed on re-run**: a pre-existing order/timing flake in
`handoff-write-arg-guard.test.mjs` (passes 14/14 in isolation), unrelated to B8.

| # | category | why it fails (verified) | owner |
|---|---|---|---|
| 16 | handoff v5→v6 bump | migration/versioning/drift/round-trip tests literal-pinned to `5`; behavior still fires (heal, refuse-loud, migrate, stamp) — only the version literal moved. e.g. #311/#312/#677 refuse-loud still triggers, message now says "server max 6"; #219 drift-skew still detects, regex hardcodes `v5` while actual output correctly says `v6`; R-schema-1 asserts emitted `schema_version: 5`. | B8-QA |
| 4 | gate catalog | GATE_REGISTRY 18→19, union 12→13, and the two `error-code-contract` harvest tests — the code emits the literal `"EXTERNAL_REFS_UNRESOLVED"` and content files DO backtick-quote it, but the test's `SUFFIX_RE` (`/_(REQUIRED\|MISSING\|INCOMPLETE\|EXCEEDED\|UNVERIFIED\|REJECTED)$/`) lacks `UNRESOLVED`, so `isGateErrorCode` filters it out of both code-side and doc-side harvests. Test-harness vocabulary is stale. | B8-QA |
| 11 | content-byte goldens | `compose-equivalence` (lite×4, full×4, hook×2, monolith×1) — const-15 §7 + skill-pm + skill-coordinator changed the composed bytes (AC-10/11/12). | B8-QA |
| 5 | token-budget caps | new content pushes bundle token counts above pinned `≤` caps (skill-pm, lean, non-design, design-arm, teamwork). | B8-QA |

**Conclusion**: no failing test is a real regression. Each maps to a deliberate
B8 change and is invalidated exactly as the spec/architecture predicted.

## Quality
No findings. Naming, comment density, and structure match the surrounding
scope_decision / cut_approved code precisely. The gate block, predicate module,
migration step, and zod schema are all near-verbatim to their proven analogs.
Comments accurately cite the governing AC/DR at each site.

Observation (non-blocking, B8-QA already scoped it): the error code
`EXTERNAL_REFS_UNRESOLVED` introduces a novel `_UNRESOLVED` suffix outside the
established shape-rule vocabulary. sr had no latitude here — spec S01 mandates the
string verbatim — so the fix is the QA-side `SUFFIX_RE` extension, not a rename.

## Architecture
No findings. The diff is a faithful realization of
`specs/b8-external-ref-ledger-architecture.md`: Affected-Files table matches
file-for-file; DR-1 (array-of-object frontmatter via existing js-yaml), DR-2
(3rd back-to-back gate), DR-3 (absence-clears inverse polarity), DR-4 (no
PM-re-entry re-arm), DR-5 (`frontmatterData` widened to admit `ExternalRef[]`),
DR-6 (hint split byte-parity), DR-7 (storage forwards opts wholesale, SQLite
accepts-and-ignores), DR-8 (single existing-state read), DR-9 (union membership,
not in TRANSITION_GATE_CODES) are each honored. No contradiction of the blueprint.

## Security
No findings. `ref` is free text bounded by zod `min(1).max(1000)`, array
`.max(200)` — DoS surface bounded. No injection vector (the value is
YAML-serialized via the existing quoted-dump path and only ever string-compared /
comma-joined into a hint). No secret handling. `parseExternalRefs` is defensive
against hostile/hand-edited handoff frontmatter (never throws, drops malformed).
The gate is a deny-by-blocking control; its file-mode-only scope is an
acknowledged, documented limitation (AC-5, same as cut_approved).

## Performance
No findings. Predicates are single O(n) passes over a ≤200-entry array on the
cold `tw_update_state` path (not a hot loop). No new I/O: the gate reuses the
already-read `prevState`, and the preserve logic folds into the existing single
`parseHandoff` read (DR-8) — no additional filesystem hit. No unbounded
growth (array capped at 200; empty arrays elided from disk).

## Verdict
APPROVED — the diff matches the spec (AC-1..AC-12) and architecture (DR-1..DR-9)
with zero correctness/quality/architecture/security/performance findings. The 39
`npm test` failures are all independently-verified baseline pins owned by B8-QA
(re-baseline the v5→v6 fixtures, the 18→19/12→13 counts, the `SUFFIX_RE` harvest
vocabulary, the compose-equivalence goldens, and the token caps); AC-13's
"`npm test` exit 0" is therefore NOT yet met and is B8-QA's responsibility to
restore. Routing to qa-engineer.
