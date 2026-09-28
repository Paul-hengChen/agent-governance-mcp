# Review — T-E114-01 + T-E114-02 + T-E114-03

covers: T-E114-01, T-E114-02, T-E114-03

Ticket: e114-cut-approval-inheritance. Both prior tasks (T-E114-01 L-SCHEMA
half, T-E114-02 L-STATE half) already carry code-reviewer's two-round
verdict in `review_reports/review_T-E114-01.md` (Round 1 CHANGES_REQUESTED,
Round 2 APPROVED — F1/F2 both closed). This QA pass verifies by EXECUTING
against the real, rebuilt `dist/`, then performs T-E114-03's own deliverable:
a new spec test file (AC1-AC9 + F1/F2 pinned) and the 12-file mechanical
schema-constant re-baseline (AC8).

## Phase 0 — Claim

`tw_get_state` → `tw_detect_drift` (clean, no drift). Claimed via
`tw_update_state(agent_id="qa-engineer", status=In_Progress)` per SOP before
starting Phase 1.

## Phase 0.5 — Expected-Red Diff

Skipped: no `qa_reports/expected-red_e114-cut-approval-inheritance.txt`
manifest exists, and `dispatch_mode` is absent from handoff state
(feature-mode). Matches code-reviewer's own out-of-scope note in
`review_reports/review_T-E114-01.md` ("SOP step 4a — not armed").

## Phase 1 — Review (source verification against the real diff)

Read the actual diff (not the review report alone) for all five L-STATE
files plus the two L-SCHEMA files, and independently confirmed:

- `schema/versions.ts:8` — `CURRENT_VERSIONS.handoff: 14`.
- `schema/migrations-handoff.ts:191-196` — the v13→v14 step is
  `up: (input) => ({ ...input, schema_version: 14 })`, byte-shaped like the
  v12→v13 block immediately above it (lines 175-180). No other
  `registerMigration` call touched.
- `docs/schema-versions.md` — both the v13 row (evidence_schema, retroactively
  owed) and the v14 row (cut_approved_source, this ticket) are present in the
  Handoff version history table, same format as v2-v12.
- `tools/handoff-types.ts:132` — `cut_approved_source?: string;` on
  `HandoffState`.
- `tools/handoff-parse.ts:166-183` — `parseCutApprovedSource` (exported):
  `typeof raw !== "string"` guard, `inherited:` prefix check, F2's `.trim()`
  before the length test, returns `raw` UNCHANGED (verbatim) on success.
- `tools/handoff-write.ts:211-224` — F1's fix: `parseCutApprovedSource` is
  applied to `opts.cutApprovedSource` at the write trust edge (not just the
  read path), so a malformed value collapses to `undefined` before it can
  reach YAML.
- `tools/handoff-write.ts:359-425` — the carry-forward algorithm is a clean,
  clause-for-clause structural clone of `dispatch_mode`'s (verbatim / carry /
  drop-on-feature-change), with NO `isPmReentry` reference anywhere in the
  new code — confirmed by direct grep, not just reading the comment.
- `tools/handoff-write.ts:490` — emit-only-when-set:
  `if (effectiveCutApprovedSource) frontmatterData.cut_approved_source = ...`.
- `tools/registry.ts:305` — `cut_approved_source: z.string().max(200).optional()`
  — a plain client-settable string, no regex, no enum (AC4/AC6).
- `tools/registry.ts:665-669` — the hand-written JSON-Schema description is
  the spec's Copy/Strings `registry.cut_approved_source-description` string
  verbatim.
- `tools/handoff-orchestrator.ts:1586` — `cutApprovedSource: parsed.cut_approved_source`,
  a bare pass-through (client-settable, not server-computed — contrast the
  `evidenceSchema` stamp two lines above it).
- `grep -rn "cut_approved_source" gates/` → **zero matches** (AC9, re-verified
  independently below under AC Execution Log).
- `grep -rn "cut_approved_source" content/` → zero matches (hard boundary
  respected — no coordinator-SOP prose was added in this lane).
- No touch to `scripts/verify-release.mjs`, no `docs/backlog.md` done-mark,
  no part of E112/E113/E115/E116.

No new findings beyond the two the reviewer already closed. Correctness,
architecture, and security review are code-reviewer's remit per SOP scope —
recorded here only to confirm nothing regressed between Round 2 APPROVED and
this QA pass (source is unchanged since Round 2; only `test/` files were
touched by this task).

### Copy / Visual Audit Gates

Spec's Copy/Strings table has two prose entries (schema-versions.md row text)
and one JSON-Schema description string — all three verified verbatim against
source above (no drift). Visual Tokens / Visual Widgets tables are both
`N/A` (server-side schema/field work, no UI) — gate is a no-op by the spec's
own declaration.

## Phase 1.5 — Visual Compare

Skipped: no `## Visual Baselines` H2 in `design/e114-cut-approval-inheritance.md`
(no such file exists — feature has no visual literals per spec).

## Phase 2 — Discussion

No open issues from Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests

**Test-file placement**: per the dispatch brief, `test/e114-cut-approval-inheritance.test.mjs`
is pre-authorized as a new file; the re-baseline edits land in the twelve
existing files named in the brief (superseding `tasks.md`'s stale nine-file
list — see **Pending notes** below). These thirteen files are the only
`test/` files touched.

### Spec-to-Test map

| AC | Test(s) in `test/e114-cut-approval-inheritance.test.mjs` |
|---|---|
| AC1 | `AC1: v13->v14 migration is stamp-only …` (isolated `runMigrations` on a v13 payload, deep-equal against input+schema_version:14 only); `AC1: a real v13 handoff file migrates to v14 on disk via readHandoffState's fire-and-forget heal …` |
| AC2 | `AC2: a handoff with no cut_approved_source reads back undefined …` — its own dedicated case (per dispatch instruction), covering BOTH a pre-E114 legacy v13 fixture and a fresh write that never sets it |
| AC3 | `AC3: a tw_update_state write of cut_approved_source: inherited:<feature> round-trips verbatim` — checked at three layers: raw YAML, `parseHandoff`, and `readHandoffState` (the `tw_get_state` equivalent) |
| AC4 | `AC4-1` (no prefix), `AC4-2` (empty suffix `inherited:`), `AC4-3` (non-string hostile values: `42`, `null`, `true`, array, object, `""`) — all accepted at the zod boundary, all drop to `undefined` at parse, none throw |
| AC5 | `AC5-1` (same-feature omitting write carries forward), `AC5-2` (active_feature change drops it even though omitted), `AC5-3` (PM re-entry omitting it does NOT re-arm/drop — contrast `cut_approved`) — mirrors `test/dispatch-pins.test.mjs` W3/W4/W5 |
| AC6 | `AC6: tw_update_state's zod arg surface DOES accept cut_approved_source …` — positive-declaration mirror of `test/e23-evidence-schema.test.mjs` AC6-1's absence check |
| AC7 | `AC7: docs/schema-versions.md's Handoff version history table has exactly one v13 row and exactly one v14 row` |
| AC9 | `AC9: no gate predicate in gates/ reads cut_approved_source` (reads every `gates/*.ts` file, asserts none contain the string) |
| F1 | `F1-1` (malformed write on the SAME feature leaves a valid record intact), `F1-2` (malformed write on a DIFFERENT feature yields an absent key — proves the preserve branch is feature-scoped, not a blind keep; the reviewer's own discriminating probe) |
| F2 | `F2: 'inherited:' and 'inherited:   ' … both read back undefined` (plus a `\t\n ` case) |

AC8 has no test of its own in the new file — it IS the 12-file mechanical
re-baseline documented below.

### Coverage Gate

New/modified logic under test is exclusively `parseCutApprovedSource` and the
`cut_approved_source` carry-forward/emit branches in `handoff-write.ts` — no
production line added by T-E114-01/02 is unreached: every branch (verbatim
set, malformed-drop, same-feature carry, feature-change drop, emit-guard) has
a dedicated case above. Tooling-measured coverage is not wired into this
repo's `npm test`; noted per SOP c.

### Security Smoke Tests

Boundary inputs exercised: empty string, whitespace-only suffix, tab/newline
padding, oversized-shape values are covered by the existing `z.string().max(200)`
zod bound (unchanged, not re-tested here — no new boundary introduced), and
hostile non-string YAML types (`42`, `null`, `true`, array, object). No
auth/permission surface — the field carries no gate authority (AC9).

## Phase 3.5 — AC Execution Log

Spec's ACs carry `proof:` annotations. Each is executed below, BEFORE the
regression run.

- **AC1** — `node --test --test-name-pattern="^AC1" test/e114-cut-approval-inheritance.test.mjs`
  → both AC1 cases pass (see full run below). PASS.
- **AC2** — same run, `AC2: a handoff with no cut_approved_source reads back undefined …` → pass. PASS.
- **AC3** — same run, `AC3: a tw_update_state write of cut_approved_source: inherited:<feature> round-trips verbatim` → pass. PASS.
- **AC4** — same run, `AC4-1`/`AC4-2`/`AC4-3` → all pass. PASS.
- **AC5** — same run, `AC5-1`/`AC5-2`/`AC5-3` → all pass. PASS.
- **AC6** — same run, `AC6: …` → pass. PASS.
- **AC7** — `grep -c '^| v13 ' docs/schema-versions.md` → `1`; `grep -c '^| v14 ' docs/schema-versions.md` → `1`. PASS.
- **AC8** — `npm test` full suite green at the corrected baseline (2130/2130, 0 fail — see Phase 4). PASS. Exact lines changed per file are named in the **Mechanical re-baseline** table below.
- **AC9** — `grep -rn "cut_approved_source" gates/` → no output, exit code 1 (grep's "no match" convention). PASS.

Combined AC1-AC6 run (`node --test --test-name-pattern="^AC[1-6]" test/e114-cut-approval-inheritance.test.mjs`):

```
1..11
# tests 11
# suites 0
# pass 11
# fail 0
```

## Pending notes — the 12-file correction (read this before trusting `tasks.md`)

`tasks.md`'s T-E114-03 row names only NINE re-baseline files (missed because
the original trace grepped for hard-coded `13`, which cannot match a test
that hardcodes `14` as its own hypothetical *future* version). The dispatch
brief supplied the corrected, self-measured count — **I re-measured
independently** (per-file `node --test <file>` before any edit) and it
reconciles exactly:

| file | failures (measured) |
|---|---|
| `test/dispatch-pins.test.mjs` | 10 |
| `test/cut-approval-gate.test.mjs` | 6 |
| `test/handoff-versioning.test.mjs` | 6 |
| `test/success-metrics.test.mjs` | 5 |
| `test/schema-versions.test.mjs` | 4 |
| `test/handoff-migration.test.mjs` | 4 |
| `test/e23-evidence-schema.test.mjs` | 3 |
| `test/stale-dispatch-detection.test.mjs` | 3 |
| `test/repro-first-gate.test.mjs` | 1 |
| `test/e22-stale-notify.test.mjs` | 1 |
| `test/skill-evolution-v3.11.test.mjs` | 1 |
| `test/drift-skew.test.mjs` | 1 |
| **Total** | **45** — matches `npm test`'s pre-fix 2069/45 exactly |

A future reader of `tasks.md` should treat this 12-file table (and this
report) as authoritative over the stale nine-file list in the task row.

**One deviation from "all 45 are version-constant failures" worth recording
honestly**: `test/e23-evidence-schema.test.mjs`'s `AC6-1` failure was NOT a
`13`→`14` constant mismatch — it was a collateral false-positive caused by
`tools/registry.ts`'s new `cut_approved_source` comment legitimately
*contrasting itself against* `evidence_schema` ("Contrast evidence_schema:
server-stamped, deliberately NO zod arg here."), which the old test's blunt
`registrySrc.includes("evidence_schema")` substring check could not
distinguish from an actual declaration. This is a test-infra defect (in
scope for QA per SOP — "test-infra defects" are a stated FAIL/fix ground,
distinct from correctness/architecture which is code-reviewer's remit), not
a correctness regression in the shipped code: the underlying AC6 invariant
("evidence_schema is never a client-settable arg") still holds. Fixed by
tightening the assertion to check for an actual zod-key declaration
(`/\bevidence_schema:\s*z\./`) and an actual JSON-Schema property declaration
(`/\bevidence_schema:\s*\{/`) instead of a whole-file substring search — the
invariant tested is unchanged, only the over-broad detection mechanism is.
This is called out explicitly so nobody mistakes "45/45 fixed" for "45/45
were pure constants" — 44 were; one was a real (if narrow) test-infra
false-positive this ticket's own approved code exposed.

## Mechanical re-baseline (AC8) — exact lines changed per file

All edits are `13`→`14` / `v13`→`v14` constant substitutions and their
accompanying prose (ticket attribution, chain-length comments), **zero
semantic change** to any other ticket's assertion, except the four
coupled-bump files called out separately below. Line numbers are pre-edit
(the `@@ -N` side of `git diff`).

| file | lines touched | nature |
|---|---|---|
| `test/dispatch-pins.test.mjs` | 112-116, 138, 145-176 (coupled, see below), 184-187, 203-223, 827-830 | mechanical + 1 coupled |
| `test/cut-approval-gate.test.mjs` | 131-135, 414-449, 455-505 | mechanical (extends 2 isolated migration-chain fixtures by one step) |
| `test/handoff-versioning.test.mjs` | 58-60, 77, 109-110, 163, 189-191, 218, 243, 280-281 | mechanical |
| `test/success-metrics.test.mjs` | 99-133, 155-161, 164-188 (coupled, see below), 221-231 | mechanical + 1 coupled |
| `test/schema-versions.test.mjs` | 24-49, 116-136, 195-215, 241-246 | mechanical (extends 2 isolated migration-chain fixtures by one step) |
| `test/handoff-migration.test.mjs` | 346-366, 465-497 (coupled, see below), 554-588, 596-606 | mechanical + 1 coupled |
| `test/e23-evidence-schema.test.mjs` | 256-283 (extends isolated chain by one step, mirrors dispatch-pins M1/M3 hazard), 290-316, 541-559 (test-infra fix, see above) | mechanical + 1 test-infra fix |
| `test/stale-dispatch-detection.test.mjs` | 499-515, 518-542 (coupled, see below), 788-789 | mechanical + 1 coupled |
| `test/repro-first-gate.test.mjs` | 298-302 | mechanical |
| `test/e22-stale-notify.test.mjs` | 524 | mechanical |
| `test/skill-evolution-v3.11.test.mjs` | 73, 83-94 | mechanical |
| `test/drift-skew.test.mjs` | 74 | mechanical |

### Coupled-bump sites (the 4 named in the dispatch brief)

All four assert "a future vN handoff refuses-loud against a v(N-1) server"
while holding BOTH numbers literally — a bare `13`→`14` substitution would
produce the incoherent `14 > server max 14`. Each was reworked to
`15`→`14`/`server max 14` (payload bumped one further, assertion regex and
test name both updated, stale `v12→v13`/`e23` comment references retargeted
to `e114`/`v13→v14`):

- `test/handoff-migration.test.mjs:465` (AC-10(g)) — now "future v15 … against a v14 server", regex `/on-disk version 15 > server max 14/`.
- `test/dispatch-pins.test.mjs:145` (M2) — same shape.
- `test/success-metrics.test.mjs:164` (E8-M3) — same shape.
- `test/stale-dispatch-detection.test.mjs:518` (T8b) — same shape.

**Chose the literal form, not the `CURRENT_VERSIONS.handoff`-derived form.**
The reviewer flagged the derived form as "optional and strictly better" and
said they would not block on the choice. I kept the literal numbers because
(a) these four tests exist specifically to pin the *exact* refuse-loud
message text a human/operator would see, and deriving both sides from the
same constant risks a tautological test that can no longer catch a
mismatched error-message format (e.g. if the message wording ever drifted,
`server max ${CURRENT_VERSIONS.handoff}` would still "pass" trivially); (b)
this file set already carries 5+ prior tickets' worth of literal
version-history comments in the same style, and switching just these four
sites to a derived form would make the pattern inconsistent across the
suite for no forward-looking benefit (a future bump still has to touch these
four files regardless — only the payload numbers change, not which files).

## Phase 4 — Run

- **Build**: `npm run build` → exit 0. `check:version` OK (3.113.0),
  `check:transitions-sync` OK (21 keys, exact match).
- **CI Runnability**: `node --test test/*.test.mjs` runs headlessly, zero
  human interaction.
- **Full regression**: `node --test test/*.test.mjs` → **2130 pass / 0 fail**
  (2069 pre-existing pass + 45 re-baselined to pass + 16 new AC1-AC9/F1/F2
  cases = 2130; reconciles exactly).
- **`npm audit --audit-level=high`** → exit 0 (6 findings, all moderate/low
  — `@hono/node-server`, `body-parser`, `esbuild`, `hono`, `protobufjs`,
  `qs` — none at or above `high`; unrelated to this ticket's files).

## Verdict

**PASS** — T-E114-01, T-E114-02, T-E114-03 all verified by execution, not by
reading the diff. AC1-AC9 hold (new test file, 16/16 green); the review's F1
and F2 findings are pinned against regression; the 12-file mechanical
re-baseline (AC8) is complete with zero semantic change outside the four
named coupled-bump sites; full suite green (2130/2130); build clean; audit
clean at the `high` threshold.
## 2026-09-18T09:42:57.567Z — PASS — by qa-engineer

PASS. Verified T-E114-01/02 by execution against rebuilt dist/ (not diff-reading): migration, carry-forward, emit-guard, zod arg, AC9 gate-grep all confirmed. New test/e114-cut-approval-inheritance.test.mjs covers AC1-AC9 + review F1/F2 (16/16 green). 12-file mechanical re-baseline (AC8) done — see qa_reports/review_T-E114-03.md for exact lines/file and the 4 coupled-bump sites (14->15/server-max-14, not a bare constant swap). Full suite 2130/2130 green, build clean, npm audit --audit-level=high exit 0 (only moderate/low findings, unrelated deps).

