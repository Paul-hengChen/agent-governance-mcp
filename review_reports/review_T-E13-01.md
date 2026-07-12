# Review — T-E13-01..04 (e13-terminal-marker-advisory)

covers: T-E13-01, T-E13-02, T-E13-03, T-E13-04

## Round 1 — APPROVED — by code-reviewer

## Summary
- Broadens the feature-lease terminal marker's third conjunct from `next_role === "pm"` to `next_role === "pm" || /^Released v/.test(pending_notes?.[0] ?? "")`, adds optional `pending_notes?: string[]` to `FeatureLeaseFields`, scopes the new disjunct file-mode-only at the orchestrator call site, adds a resilience note to the release-engineer skill, and lands one repro-first test (E13-R1) for the AC2 heal-drop class. 5 files, +285/-64 (dist included).
- Scope matches the spec Decision section and T-E13-01..04 exactly: predicate + type (T-E13-02), call-site scoping (T-E13-03), skill note (T-E13-04), repro test (T-E13-01). The remaining AC coverage (AC1/AC3/AC4/AC5/AC6 tests) is explicitly deferred to T-E13-06 (qa), consistent with the test file's own Spec-to-Test map.
- Strict-superset property verified: every pre-E13 terminal case (`next_role === "pm"`) still satisfies the broadened disjunct via the first operand. Zero regression to opening-write (AC3/D9-D10) and escalation-write (AC5) gating.
- SQLite scoping is genuinely inert; zero schema bump; `next_role` transient (AC-3) semantics untouched elsewhere; dist matches a fresh build.
- Verdict: APPROVED. One non-blocking out-of-scope observation recorded under Quality (a stray `docs/backlog.md` E9 done-marking in the working tree — not an E13 file, not in review scope).

## Correctness
No blocking findings.

- **Strict-superset / non-regression (gates/feature-lease.ts:119-128).** The terminal condition is `last_agent === "release-engineer" && status === "In_Progress" && (next_role === "pm" || /^Released v/.test(pending_notes?.[0] ?? ""))`. The first two conjuncts are unchanged; the third is a disjunction whose first operand is the entire old predicate. Any state terminal pre-E13 stays terminal. Confirmed.
- **AC1 (first occurrence — next_role omitted at write time).** Closing write `last_agent="release-engineer"`, `status="In_Progress"`, `next_role` undefined, `pending_notes=["Released vX.Y.Z", ...]`: first operand false, second operand `/^Released v/.test("Released vX.Y.Z")` true → terminal → lease released. Correct.
- **AC2 (heal-drop — next_role dropped later, pending_notes preserved).** Same shape post-heal; covered by the E13-R1 repro test (test/feature-lease.test.mjs). Correct.
- **AC3 (opening write must STILL hold — D9/D10 race).** Opening write has no `next_role` and `pending_notes=["release-engineer: starting release for <feature>"]`. First operand false; `/^Released v/` is start-anchored and does not match "release-engineer: starting…" → second operand false → terminal condition false → falls through to the TTL freshness check → returns `true` (held). The in-flight release window stays protected. Correct.
- **AC5 (escalation writes must hold).** `status="Blocked"` fails the `status === "In_Progress"` conjunct. `status="In_Progress"` with `next_role="qa-engineer"`/other: first operand false, and escalation `pending_notes` never start with "Released v" → second operand false → held. Correct.
- **Regex spoofing surface.** `/^Released v/` is reachable only after `last_agent === "release-engineer"` and `status === "In_Progress"` already hold, so no non-release-engineer write can trip it regardless of its notes. The only release-engineer writes with `status="In_Progress"` are the opening write ("starting release…" — no match) and the closing write ("Released vX.Y.Z" — intended match). Not spoofable in practice. Correct.
- **Null/empty safety (gates/feature-lease.ts:127).** `pending_notes?.[0] ?? ""` handles undefined `pending_notes`, empty array, and undefined element — all collapse to `""`, regex false, no throw. Correct.

## Quality
- **Non-blocking, out of review scope — stray working-tree edit in docs/backlog.md.** The working tree carries a `docs/backlog.md` change marking the **E9** epic as "DONE v3.78.0 (2026-07-12)". This is not one of the five E13 files under review, no E13 task (T-E13-01..04) instructs touching the E9 row, it references an unreleased version (HEAD is v3.77.0), and it contradicts `tasks.md` (T-E9-REL/T-E9-DONE still open). Almost certainly pre-existing bookkeeping drift rather than sr-engineer E13 work. Not blocking the E13 verdict, but the coordinator should reconcile the working tree before any commit so the release-engineer's later E13 backlog done-marking is not conflated with a premature E9 one.
- Comment quality is high: the header rewrite (gates/feature-lease.ts:22-62) documents both incident classes, the strict-superset guarantee, and the call-site scoping rationale accurately. No dead code, no convention drift.

## Architecture
- Fits the design constraint precisely. The pure predicate stays storage-agnostic and fs-free (zero import edges preserved); the file-mode-only decision is enforced at the orchestrator call site (tools/handoff-orchestrator.ts:181-197) via an explicit `leaseFields` object that passes `prevState.pending_notes` only under `storage instanceof FileHandoffStorage` (undefined otherwise). This is exactly the spec's "scope at the call site, not the predicate" mandate (AC4) and mirrors the existing SCOPE_DECISION_REQUIRED / cut-approval call-site-guard convention.
- `isFeatureLeaseHeld` reads only fields declared on `FeatureLeaseFields` (active_feature, status, last_updated, last_agent, next_role, pending_notes); the `leaseFields` subset object supplies every one of them, so narrowing prevState to a subset introduces no missing-field hazard.
- No schema_version bump (confirmed: no schema/* file touched, no schema_version token in the predicate/orchestrator diffs), consistent with the spec's zero-schema-bump commitment.

## Security
No findings. No new trust boundary. The regex is a fixed, start-anchored literal applied to server-controlled pending_notes; no user-supplied injection path, no ReDoS surface (`/^Released v/` is linear). No secrets.

## Performance
No findings. The added work is one `instanceof` check and one anchored regex test per lease evaluation — O(1), off any hot path. No new I/O, no loops, no allocation of note. No regression vs base.

## SQLite non-regression (AC4) — explicit confirmation
In SQLite/HTTP mode `next_role` is never persisted (undefined → first operand false) and the call site forces `pending_notes: undefined` (second operand `"" ` → false), so the terminal disjunct can never fire; lease behavior stays TTL-bounded only, byte-for-byte identical to pre-E13. The rejection envelope now reads from `leaseFields`, whose values are copied verbatim from `prevState`, so envelope output is unchanged.

## Repro-first discipline (bugfix mode, AC7)
- `qa_reports/expected-red_e13-terminal-marker-advisory.txt` exists and is in C15 `file | test name` format. It names one entry (E13-R1). Per SOP step 4a I sampled all entries (fewer than 3): the named test string is locatable in `test/feature-lease.test.mjs` (grep count = 1) and is a real test. The manifest records the pre-fix red (38 pass/1 fail @ 753bbc7).
- Test diff is a pure addition: 78 insertions, 0 deletions. No existing test logic or assertions were modified — the change does not exceed the repro-test addition. The E13-R1 test simulates the heal-drop faithfully (writes the full triple, then a heal-style re-persist that preserves pending_notes and omits next_role) with sanity assertions plus the load-bearing lease-released assertion.
- Full suite green post-fix: `npm test` → 1371 pass / 0 fail.

## Verdict
APPROVED — the broadened predicate is a proven strict superset with zero regression to the opening-write (D9/D10, AC3) and escalation-write (AC5) gates, SQLite scoping is correctly enforced at the call site (AC4), the skill note reinforces rather than relaxes the exact-triple contract (AC6), and no schema bump or `next_role` semantic change leaks elsewhere. The only observation (a stray docs/backlog.md E9 done-marking) is outside the E13 review scope and non-blocking, flagged for coordinator reconciliation before commit.
