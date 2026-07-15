# QA review — T-E20-01 / T-E21-01

covers: T-E20-01, T-E21-01

Feature: e20-e21-crash-resilience-sop. Spec = docs/backlog.md E20 + E21 table
rows (no separate `specs/<feature>.md` — content-only, mini-chain sr ->
code-reviewer -> qa per the handoff's `scope_decision_why`). Code review:
APPROVED (2026-07-15T03:45:44Z, `review_verdict` on the handoff).

Shipped diff (uncommitted, code-reviewer-approved): +2 lines in
`content/skill-sr-engineer.md` (4a E21 crash checkpoint, 4b E20 hard line) and
+2 lines in `content/skill-qa-engineer.md` (E20 hard line in Hard rules, E21
crash-checkpoint bullet in Phase 4). Templates (`templates/claude-code-agents/
{qa-engineer,sr-engineer}.md`) re-confirmed as thin dispatch pointers with no
SOP-content mirror — no template edit required (E17 precedent).

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e20-e21-crash-resilience-sop.txt` —
sr-engineer's handoff declared no intentional reds).

## Phase 1 — Review

Read both diffs against the two backlog rows.

- **E20** (`P1`, "long runs end in-turn"): both skill files gained a `HARD`
  bullet stating that long suites/builds must run synchronously to completion
  OR be backgrounded and poll-harvested within the same turn — matches the
  backlog row's tier-(i) content-only fix verbatim (tier-(ii), the
  `waiting_on` field, is explicitly deferred and out of scope for this
  ticket).
- **E21** ("crash checkpoint via bookkeeping_write"): both skill files gained
  a step (qa-engineer Phase 4, sr-engineer step 4a) directing a
  `bookkeeping_write=true` checkpoint BEFORE any long build/suite, verified
  independently against the actual server contract (not trusted from the
  sr-engineer/code-reviewer handoff notes):
  - `tools/registry.ts` zod schema: `bookkeeping_write` — "Non-substantive-write
    attestation (file-mode only, e10-lease-override) ... the server PRESERVES
    the existing on-disk `last_updated` verbatim instead of stamping now() ...
    Ignored in SQLite/HTTP mode."
  - `tools/handoff-orchestrator.ts` L323-357: a `bookkeeping_write=true` write
    against a DIFFERENT `active_feature` is rejected with
    `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` (guarded to file-mode via
    `storage instanceof FileHandoffStorage`); L1147-1153 confirms the
    attribute is transient (never persisted to frontmatter) and passed through
    to `writeHandoffState`'s same-feature-guarded preserve branch, which is
    where the "lease timestamp untouched" behavior actually lives.
  - Both SOP lines describe this correctly: "administrative write, lease
    timestamp untouched" (qa-engineer) / "administrative write ... does NOT
    refresh the lease timestamp" (sr-engineer). Both checkpoint calls correctly
    keep `active_feature=<unchanged>` and `status=In_Progress`, matching the
    same-feature precondition the gate enforces.
  - **Accuracy gap found** (code-reviewer left this as a non-blocking
    advisory): neither line caveated that `bookkeeping_write` is **file-mode
    only** — a crash-checkpoint dispatched under SQLite/HTTP mode would
    silently get a normal (lease-refreshing) write instead of the described
    no-refresh checkpoint. Fixed in this round: appended a short
    `(file-mode only)` parenthetical to both lines (18/17 bytes added
    respectively) — cheap enough not to warrant a sr-engineer round trip.
    Re-verified post-edit against the same two code sites above; the caveat is
    now accurate and matches production behavior exactly.

No copy/visual spec H2s exist for this ticket (no UI surface, no
`design/<feature>.md`) — Copy Audit Gate (3a) and Visual Audit Gate (3b) are
both vacuously satisfied (nothing to check).

## Phase 1.5 — Visual Compare

Skipped (no `design/e20-e21-crash-resilience-sop.md`, no Visual Baselines).

## Phase 2 — Discussion

No blocking issues found in Phase 1 (the file-mode-only gap was fixed
in-round, not escalated back to sr-engineer, per the "cheap enough" judgment
above and the ticket's own tier-(i)/content-only framing). Proceeding directly
to Phase 3.

## Phase 3 — Tests

Test File Discovery: no existing test file targets E20/E21 content
specifically. Authored a new pin suite,
`test/e20-e21-crash-resilience.test.mjs` (13 tests, QA-E20-1/2, SR-E20-1/2,
QA-E21-1..4, SR-E21-1..4, CROSS-1), pinning:

- the E20 hard line's presence + origin tag + synchronous/poll-harvest
  contract in both skill files;
- the E21 crash-checkpoint bullet's presence + origin tag + "BEFORE the long
  step" ordering (both by string search and by index-position relative to the
  surrounding SOP steps) + `bookkeeping_write=true` + correct `agent_id` in
  both skill files;
- the qa-added `(file-mode only)` accuracy caveat in both copies;
- cross-file consistency: both copies describe the same
  administrative/no-lease-refresh contract in their own words (CROSS-1).

Spec-to-Test map: E20 row -> QA-E20-1/2, SR-E20-1/2. E21 row -> QA-E21-1..4,
SR-E21-1..4, CROSS-1. Coverage gate: this is a pure content-pin suite (no
`.ts` source changed), so line-coverage % is not applicable — every asserted
line of the diff has a dedicated pin test instead.

Re-baselined two existing byte/token-budget pins that the new content
legitimately trips (reviewer confirmed the bytes are justified):

- `test/context-budget.test.mjs` ("skill-sr-engineer stripped token count"):
  cap raised 2642 -> 2852 (exact re-measure via
  `stripRationale(stripOriginTags(expandSkill(body)))`, no headroom, per the
  test's own established convention). The +2 SOP lines plus the file-mode-only
  caveat added 210 ~tok.
- `test/qa-visual-skill-split.test.mjs` (AC-5 byte budget): cap raised
  14729 -> 15500 (~379-byte headroom, per the test's own ~300-550-byte
  convention). Actual file size after the caveat addition: 15121 bytes
  (independently re-measured with `wc -c content/skill-qa-engineer.md`).

## Phase 3.5 — AC Execution

Skipped (no `specs/e20-e21-crash-resilience-sop.md`, no `proof:`-annotated
ACs — the backlog table rows are the spec for this content-only ticket).

## Phase 4 — Run

`npm run build`: zero TypeScript errors. `npm test`: full suite run
synchronously to completion in this turn (per the very E20 rule under
verification) — **1485/1485 pass, 0 fail** (1472 pre-existing + 13 new pins in
`test/e20-e21-crash-resilience.test.mjs`; no other file's test count changed).
CI-runnable: `node --test test/*.test.mjs`, zero human interaction required.

**PASS.**
## 2026-07-15T03:52:21.381Z — PASS — by qa-engineer

PASS. Both E20 (long-run-ends-in-turn hard line) and E21 (crash checkpoint via bookkeeping_write) content-only lines verified in skill-qa-engineer.md + skill-sr-engineer.md against the actual backlog rows AND independently against the server's bookkeeping_write implementation (tools/registry.ts zod description + tools/handoff-orchestrator.ts L323-357/L1147-1153: file-mode only, preserves on-disk last_updated verbatim, rejects cross-feature use). Found + fixed one accuracy gap the code-reviewer flagged as non-blocking: neither E21 line caveated file-mode-only — added a short "(file-mode only)" parenthetical to both (cheap, in-round, no sr bounce). Templates re-confirmed as thin pointers, no mirror needed. Re-baselined 2 byte/token budget pins the +bytes legitimately tripped: test/context-budget.test.mjs skill-sr cap 2642->2852 (exact re-measure, no headroom); test/qa-visual-skill-split.test.mjs AC-5 skill-qa-engineer.md cap 14729->15500 (~379-byte headroom). Authored test/e20-e21-crash-resilience.test.mjs (13 new pins: origin tags, ordering, bookkeeping_write=true + agent_id, the file-mode-only caveat, cross-file contract consistency). npm run build clean; npm test run synchronously to completion this turn: 1485/1485 pass (1472 + 13 new), 0 fail. Full detail in qa_reports/review_T-E20-01.md (covers: T-E20-01, T-E21-01).

