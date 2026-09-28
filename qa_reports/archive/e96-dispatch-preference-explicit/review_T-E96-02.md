# QA review — T-E96-02

covers: T-E96-01, T-E96-02

Feature: `e96-dispatch-preference-explicit` (E96, backlog order 0b). Spec = the
E96 backlog row (`docs/backlog.md`) + handoff `scope_decision_why` — no
`specs/e96-*.md` (content-only, non-design cut; PM/ARCH skipped by cut design).
T-E96-01 (sr-engineer, content-only, 2 files) is code-reviewer APPROVED at
round 2 (`review_reports/review_T-E96-01.md`, both rounds preserved).

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared for `e96-dispatch-preference-explicit`
— `qa_reports/expected-red_e96-dispatch-preference-explicit.txt` does not exist).
Non-red-manifest features pay zero overhead here.

## Phase 1 — Review

No `specs/e96-*.md` exists (the backlog row is the spec, per cut design) —
Copy Audit Gate and Visual Audit Gate are both N/A: there is no *Copy/Strings*
or *Visual Tokens* H2 to audit against. Content-correctness review is
code-reviewer's job and is APPROVED at round 2 (`review_reports/review_T-E96-01.md`)
— both the compose-axis defect (C1) and the dangling cross-fragment reference
(C2) found in round 1 are closed and re-verified through the real render path
in round 2. QA's own scope (test coverage / test-infra defects) picks up from
there.

## Phase 1.5 — Visual Compare

Skipped (no `design/e96-dispatch-preference-explicit.md`, no Visual Baselines
declared — non-UI, prompt-prose-only feature).

## Phase 3 — Tests

**T-E96-02 item (1) — golden re-baseline.** Ran
`node scripts/capture-constitution-golden.mjs`. Diff against the prior
committed fixture set (`git diff --stat -- test/fixtures/compose-golden/`)
shows exactly ONE file touched: `test/fixtures/compose-golden/skill-coordinator-monolith.txt`,
`1 file changed, 2 insertions(+), 2 deletions(-)`. The other 11 golden
fixtures are byte-identical (zero diff) — confirmed via `git status --short
test/fixtures/compose-golden/` showing only the one path. Line-level diff
confirms the two changed lines are **exactly line 81** (the coord-02 Subagent
Dispatch paragraph) and **line 114** (the coord-03 Fallback paragraph) — the
two spans T-E96-01 edited, nothing else. This matches the code-reviewer's
round-2 hypothesis (composing all seven fragments against the frozen golden
"yields exactly two changed lines (81 and 114) and nothing else") — confirmed
independently by regeneration + diff, not copied from the review doc.
MINIMALITY holds (E43/E90 precedent). `t-golden-byte-identity`
(`test/skill-manifest.test.mjs`) re-run in isolation: green.

**T-E96-02 item (2) — context-budget cap re-measure.** Independently
re-measured `AC8/AC-P2-7` (`test/context-budget.test.mjs:1096`) through the
real render path — `composeSkill("skill-coordinator.md",
hostCapabilitiesFor("claude-code"), readContent)` → `stripOriginTags` →
`stripRationale`, concatenated with the equivalently-stripped `composeConstitution({chain:true,
design:true})` bundle via the test's own `SEP`, matching `buildPromptForRole`'s
own order. Script run standalone against `dist/` (not trusted from
sr-engineer's or the reviewer's handoff notes, per instruction — those figures
concern a *different* measurement, the raw fragment-pair delta, not this
bundle's absolute floor): **17984 ~tok exactly** (71934 chars / 4, ceil). This
matches the failing test's own reported `actual: 17984` before any edit —
independent confirmation, not inheritance. Cap bumped 17844 → 17984 (+140) in
the established qa-owned-bump comment style, citing E96, with the byte
attribution (coord-02's anti-nudge + WHEN/DO clause, coord-03's re-conditioned
fallback line) and the note that no other AC8 floor in this file moves — the
teamwork-coordinator-bundle test is the *only* one that composes
`skill-coordinator.md` (host:claude-code) together with the constitution; the
other AC8 floors (9374 design-arm-constitution-only, 7276 non-design) measure
`CONSTITUTION` alone, which coord-02/coord-03 are never part of. Verified no
other cap in `test/context-budget.test.mjs` regressed (full file green below).
Test name string updated to match (`≤ 17984 ~tok`).

**T-E96-02 item (3) — class assertions.** New file
`test/e96-dispatch-preference.test.mjs` (creation pre-authorized, const-05
branch 1), 7 tests, all green in isolation and in the full run:

- `t-anti-nudge-request` — coord-02 states an explicit `/teamwork` (or
  equivalent explicit coordinator entry) invocation IS the user's subagent-
  dispatch request, and that the host-prompt nudge is not grounds for the
  fallback once that request has been made.
- `t-when-do-compose-axis-absent-lean` / `t-when-do-compose-axis-present-cc` —
  the compose-axis property that is the sharpest regression to pin (round-1
  defect, `review_reports/review_T-E96-01.md` C1): the WHEN/DO §3.2 surfacing
  rule composes ONLY under `hostCapabilitiesFor("claude-code")` and is ABSENT
  under the lean/`undefined`-host default. A single-file prose grep cannot
  catch this class — it is a property of `composeSkill`'s per-fragment host
  tag, so the test composes both profiles through the real render path
  (`composeSkill` + `hostCapabilitiesFor`) and asserts 0 vs 1 occurrences.
- `t-when-do-same-fragment-as-dispatch-mechanic` — pins the fix itself (not
  just its compose outcome): the rule must live in coord-02 (`host:claude-code`),
  never in coord-03 (`core`), so it can never again land on the wrong side of
  the D6 axis.
- `t-fallback-genuine-unavailability` — coord-03's fallback is conditioned on
  genuine tool unavailability (host advertises no `Task`, or a `Task` call
  errors / returns unknown-subagent-type).
- `t-fallback-self-contained` — scoped to the Fallback paragraph itself (coord-03
  legitimately keeps two OTHER, same-file "...above" self-references elsewhere
  — the Claim-vs-state "row above", the Cut-approval "writer obligation
  above" — both pre-existing and explicitly not flagged by round-1 C2): no
  cross-fragment pointer into coord-02 remains, and `unknown-subagent-type` is
  independently restated rather than deferred.
- `t-fallback-silent-framing-retired` — the bare, unqualified "graceful and
  silent" framing is gone (the word "graceful" alone survives, correctly,
  describing that the chain keeps working for genuinely-fallback hosts; only
  the unqualified pairing with "silent" — the E96 defect itself — is retired).

Class-over-instance per E66 option (ii) / E69 precedent: every assertion greps
for the SHAPE of the guarantee (host-tag placement, self-containment, absence
of the retired phrase), not the literal sentence, so a future rewording that
preserves the guarantee keeps passing and one that regresses it fails.

No AC→test map beyond the above — no `specs/e96-*.md` exists to enumerate
ACs against; the backlog row's ACCEPTANCE bullets are the map, addressed 1:1
by the golden re-baseline (byte-identical goldens), the class assertions
(coord-02/coord-03 claims), and Phase 4 below (build/audit/suite/agc check).

Coverage gate: N/A — this ticket edits test fixtures and adds test files, no
new/modified src files to line-cover.

Security smoke tests: N/A — prompt-prose-only change, no trust boundary, no
input parsing, no executable path (unchanged from code-reviewer's Security
section, both rounds: no findings).

## Phase 3.5 — AC Execution Log

Skipped (no `specs/e96-dispatch-preference-explicit.md` — no `proof:`-annotated
ACs to execute; the backlog row is the spec and carries no `proof:` lines).

## Phase 4 — Run

- `npm run build`: clean (tsc + check:version + check:transitions-sync all OK,
  3.104.5).
- `npm audit --audit-level=high`: exit 0. 5 findings total (2 low, 3 moderate —
  body-parser, esbuild, hono, protobufjs), none at/above `high`; pre-existing,
  unrelated to this content-only feature.
- `npm test`: **1781/1781 green** (1774 prior + 7 new in
  `test/e96-dispatch-preference.test.mjs`). Both prior reds
  (`t-golden-byte-identity`, `AC8/AC-P2-7` context-budget floor) now pass.
- `node bin/agc-init.mjs check`: `agc check — OK (3.104.5) — all adapters
  current`.

## Verdict

PASS. Both T-E96-01 (content edit, code-reviewer APPROVED round 2) and
T-E96-02 (golden re-baseline, cap re-measure, class assertions, full green
suite) meet the backlog row's ACCEPTANCE bullets: coord-02 names `/teamwork`
as the dispatch request; coord-03's fallback line is conditioned on genuine
unavailability and requires surfacing (via coord-02's co-located WHEN/DO,
verified compose-axis-correct); 12 goldens regenerate with exactly the 2
intended lines moved; build clean; audit clean at `high`; suite green
(1781 ≥ 1765 + new); `agc check` 0. No release bookkeeping performed here
(version bump / CHANGELOG / backlog done-mark are release-engineer's job,
per SOP — a human decision, not auto-hopped to).
## 2026-08-27T11:54:47.251Z — PASS — by qa-engineer

PASS — golden fixture re-baselined (only skill-coordinator-monolith.txt moved, exactly lines 81/114, minimality confirmed); AC8/AC-P2-7 context-budget cap independently re-measured through the real render path and bumped 17844->17984 (+140); 7 new class assertions (test/e96-dispatch-preference.test.mjs) pin the compose-axis property (WHEN/DO rule host:claude-code-only, absent from lean), the anti-nudge /teamwork claim, and the self-contained genuine-unavailability fallback conditioning. Build clean, npm audit --audit-level=high exit 0, suite 1781/1781 green, agc check OK. See qa_reports/review_T-E96-02.md (covers T-E96-01, T-E96-02).

