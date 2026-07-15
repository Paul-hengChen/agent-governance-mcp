# QA review — T-E23-01 / T-E23-02 / T-E23-03

covers: T-E23-01, T-E23-02, T-E23-03

Feature: e23-evidence-schema-versioning. Spec = specs/e23-evidence-schema-versioning.md
(D1 evidence_schema pin + handoff v12→v13, D2 normalized-contains heading
match, D3 rejection-envelope detail). Code review: APPROVED
(2026-07-15T05:56:55Z, `review_verdict` on the handoff) — zero blocking
findings; the 41-failure fixture-drift classification was adversarially
spot-checked by code-reviewer and independently re-verified by QA below
(Phase 0.5), not merely trusted from the handoff notes.

Shipped diff (uncommitted, code-reviewer-approved): `gates/evidence-schema.ts`
(new — `EVIDENCE_SCHEMA_CURRENT = 2`), `tools/evidence-file.ts`
(`normalizeHeadingText`, `sliceH2SectionAt`, `findH2LineAt` — schema-keyed
siblings of the exact-anchored `sliceH2Section`), `gates/ac-execution.ts` +
`gates/visual.ts` (both gate predicates now thread an `evidenceSchema`
parameter through to heading lookups; `visualEvidencePath` exported for D3),
`gates/registry.ts` (hint-text updates), `tools/handoff-orchestrator.ts`
(evidence-schema pin resolution + stamping at the feature-change write, D3
envelope detail at all three emit sites), `tools/handoff.ts` (`evidence_schema`
field: parse with defensive sanitisation, write with feature-scoped
carry/drop), `schema/versions.ts` + `schema/migrations-handoff.ts`
(`CURRENT_VERSIONS.handoff` 12→13, stamp-only v12→v13 step).

## Expected-Red Diff

Present: `qa_reports/expected-red_e23-evidence-schema-versioning.txt` (41
entries, groups A/B/C, sr-engineer). Ran the FULL suite BEFORE any re-baseline
edit and diffed the actual red set against the manifest by exact test name
(not file-location, since the manifest's own file attribution for one entry
was wrong — see below):

- **Diff empty**: 41/41 manifest entries confirmed red, 0 unexplained reds.
  `sort`-compared the manifest's 41 `<test file> | <test name>` entries
  (name-only) against the actual `not ok` test names from a real `npm test`
  run — identical sets.
- **Manifest file-attribution correction** (verified, not blocking — the
  manifest's own preamble only promises test **names**, not locations): the
  manifest lists `test/handoff-versioning.test.mjs | AC-10(g): future v13
  handoff refuses-loud against a v12 server (no silent downgrade)`; that test
  actually lives in `test/handoff-migration.test.mjs`, and `test/repro-first-gate.test.mjs`'s
  "M1: a hand-written v10 handoff file migrates to v11 on read..." test is not
  named in the manifest as belonging there at all under my independent grep —
  I built my own file:line worklist via `grep -rn -F -- "<name>" test/*.test.mjs`
  for all 41 entries rather than trusting the manifest's file column, per the
  coordinator's explicit instruction to verify against the actual failure, not
  the manifest's claim.
- No dispositions needed (no entry required an "innocent explanation" write-up
  — every one of the 41 is a literal `CURRENT_VERSIONS.handoff`-derived
  assertion or an isolated migration-chain registration one step short of the
  new CURRENT; all three are pure version-arithmetic, none touch
  business-logic assertions).

## Phase 1 — Review

Read `specs/e23-evidence-schema-versioning.md` in full (D1/D2/D3, AC1-AC6) and
the complete diff of every touched source file (`git diff` per file, not just
the summary). Verified against the spec:

- **D1** (`tools/handoff.ts`, `tools/handoff-orchestrator.ts`): pin is
  server-stamped only — `parsed` (the zod-validated `tw_update_state` input)
  carries no `evidence_schema` field; the orchestrator resolves
  `feature_changed ? EVIDENCE_SCHEMA_CURRENT : prevState?.evidence_schema`
  and passes that to `writeHandoffState`'s `evidenceSchema` option, which
  itself only emits the field to frontmatter `!== undefined` and otherwise
  carries the existing value forward within the same `active_feature`
  (mirrors the `dispatch_mode` scalar algorithm exactly, confirmed by reading
  both option-resolution blocks side by side).
- **Migration purity** (`schema/migrations-handoff.ts` v12→v13): `up: (input)
  => ({ ...input, schema_version: 13 })` — stamps the version only, seeds no
  default. Confirmed no historical payload ever gains a fabricated pin.
- **D2** (`tools/evidence-file.ts` `sliceH2SectionAt`/`findH2LineAt`,
  `gates/visual.ts`, `gates/ac-execution.ts`): pin `1` replays the legacy
  exact-anchored `^##\s+<heading>\b` match byte-for-byte (verified the
  `findH2At` branch delegates to the identical regex shape `sliceH2Section`
  uses); pin `>=2` or absent scans every H2 line and matches on
  `normalize(h2Text).includes(normalize(target))` with
  `normalize = lowercase, collapse non-alphanumeric runs to one space, trim`.
  Confirmed `## Phase 3.5 — AC Execution Log` normalizes to `phase 3 5 ac
  execution log`, which contains `ac execution log` — the exact 104447-F0
  incident heading, exactly reproduced in AC3 below. Confirmed the verdict
  VALUE parse (`verdictIsPass`) keeps exact-token semantics — normalization
  only ever relocates the heading, never touches the parsed PASS/FAIL value.
- **D3** (`tools/handoff-orchestrator.ts` 3 emit sites): `VISUAL_EVIDENCE_MISSING`
  now names the expected `qa_reports/visual_<id>.md` path(s) via the newly-exported
  `visualEvidencePath`; `VISUAL_REPORT_INCOMPLETE` names each missing `## <Section>`
  heading plus the report path per failing task; `AC_EXECUTION_LOG_MISSING` names
  the literal `"## AC Execution Log"` heading plus every review-file path
  `hasAcExecutionLogDisposition`'s traversal inspected (new `checkedPaths`
  field on `AcDispositionResult`, populated even when nothing was on disk so
  the envelope can say where the server looked). All three additionally state
  `Evidence schema: v<N>` or `Evidence schema: absent pin (v2
  normalized-contains default)` — confirmed both branches render correctly
  (AC5 below covers the stamped-v2 case end-to-end).
- **AC6**: `tw_update_state`'s zod schema (`tools/registry.ts`) and its
  hand-written JSON Schema carry no `evidence_schema` key; `grep -c
  evidence_schema tools/registry.ts index.ts` = 0/0 confirmed directly.

No Copy/Strings or Visual Tokens spec H2s exist for this ticket (pure
server-internal gate/schema change, no UI surface) — Copy Audit Gate (3a) and
Visual Audit Gate (3b) are both vacuously satisfied.

## Phase 1.5 — Visual Compare

Skipped (no `design/e23-evidence-schema-versioning.md`, no Visual Baselines).

## Phase 2 — Discussion

No blocking issues found in Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests

**3a. Fixture re-baseline** (docs/schema-versions.md §Test fixtures): all 41
manifest entries re-baselined, verified against the ACTUAL failure at each
site (not the manifest's claim alone — see the file-attribution correction in
Phase 0.5), across 8 files:

- **Group A** (hardcoded `12`→`13`, 12 entries across `test/cut-approval-gate.test.mjs`,
  `test/handoff-versioning.test.mjs`, `test/success-metrics.test.mjs`,
  `test/handoff-migration.test.mjs`, `test/schema-versions.test.mjs`,
  `test/stale-dispatch-detection.test.mjs`, `test/repro-first-gate.test.mjs`,
  `test/skill-evolution-v3.11.test.mjs`, `test/dispatch-pins.test.mjs`): bumped
  the literal assertion AND, where the test's own title embeds the version
  number (e.g. "stamps schema_version: 12"), renamed the title too — matching
  this repo's own established convention (this exact test's title already
  shows one prior rename, 11→12/e2-bugfix-repro-gate→e8-success-telemetry).
- **Group B** (future-sentinel `v13`→`v14`, 8 entries): bumped the "impossible
  future version" sentinel one step past the new CURRENT and renamed each
  test title accordingly (e.g. "future v13 handoff refuses-loud against a v12
  server" → "future v14 handoff refuses-loud against a v13 server").
- **Group C** (isolation-test inline migration sub-chains one step short, 21
  entries): extended each test's own manually-registered
  `_clearRegistryForTests()` + `registerMigration(...)` chain by exactly one
  step (`{ kind: "handoff", from: 12, to: 13, up: (i) => ({ ...i,
  schema_version: 13 }) }`), per each test's own convention — some (e.g.
  `cut-approval-gate.test.mjs` M1/M2) also gained a new
  `evidence_schema === undefined` assertion mirroring the file's existing
  per-field no-seed-contract pattern. Several Group-C entries (`M3`/`M4`/
  `X-malformed-parse` in `cut-approval-gate.test.mjs`; `P1`-`P5`/`M4/AC-8` in
  `dispatch-pins.test.mjs`; `E8-H3` in `success-metrics.test.mjs`) required NO
  direct edit — they were collateral failures of a SHARED module-level
  migration registry left one step short by an earlier test in the same file
  (`_clearRegistryForTests` wipes the real registry for every later test in
  that file/process); fixing the earlier test's chain fixed these
  transitively, confirmed by re-running each file in isolation after the fix
  and observing them turn green with no edit of their own.
- **Never weakened**: every re-baseline only bumped the version-number literal
  the fixture exists to pin (12→13 or 13→14) or extended a migration chain by
  the one genuinely-new step; no assertion's strictness was reduced.

**3b. AC1-AC6 proof tests** — new file `test/e23-evidence-schema.test.mjs` (18
tests), spec-to-test map:

| AC | proof (spec) | tests |
|---|---|---|
| AC1 | unit test over the orchestrator write path (file mode) | AC1-1 (stamp), AC1-2 (same-feature carry), AC1-3 (feature-change drop+re-stamp), AC1-4 (no client-arg leak), AC1-5 (malformed-pin sanitisation), AC1-6 (legal pin round-trip) |
| AC2 | migration unit test with a v12 fixture | AC2-1 (isolated chain), AC2-2 (real registry via parseHandoff) |
| AC3 | gate predicate unit test, exact replay of the 104447-F0 incident heading | AC3-1 (pin 2 clears), AC3-2 (absent pin clears), AC3-3 (pin 1 still fails) |
| AC4 | validateVisualReport unit test | AC4-1 (suffixed/prefixed headings pass under pin 2, fail under pin 1), AC4-2 (genuinely missing section still rejects under pin 2) |
| AC5 | emit-site unit tests asserting envelope substrings | AC5-1 (VISUAL_EVIDENCE_MISSING), AC5-2 (VISUAL_REPORT_INCOMPLETE), AC5-3 (AC_EXECUTION_LOG_MISSING) |
| AC6 | npm test run log in the QA evidence | AC6-1 (zod/JSON-Schema grep), AC6-2 (registry sanity anchor); full run log in Phase 4 below |

Coverage: every AC maps to >=1 test (table above); all 6 touched gate/tool
modules (`gates/evidence-schema.ts`, `tools/evidence-file.ts`,
`gates/ac-execution.ts`, `gates/visual.ts`, `tools/handoff-orchestrator.ts`,
`tools/handoff.ts`) are exercised directly by at least one AC test.

**3c/3d. Security/boundary smoke**: AC1-5 covers negative/zero/NaN/non-numeric
hand-edited `evidence_schema` (defensive sanitisation to `undefined` — a
schema version can never legally be < 1); AC1-4 covers a hostile/wrong-key
write-options payload never leaking a client-supplied pin onto disk. No
auth/permission surface exists on this feature (server-internal gate logic
only).

## AC Execution Log

Spec `specs/e23-evidence-schema-versioning.md` declares `proof:` on all 6 ACs
— Phase 3.5 is ARMED. Per-AC execution below (`test/e23-evidence-schema.test.mjs`
run with `--test-name-pattern` scoped to each AC group; full-file exit code
and combined pass/fail counts also captured):

- **AC1** — `node --test --test-name-pattern="^AC1-" test/e23-evidence-schema.test.mjs`
  → exit 0. Output: `ok 1..6` (AC1-1..AC1-6), `# tests 6`, `# pass 6`, `# fail 0`.
  **Verdict: PASS.**
- **AC2** — `node --test --test-name-pattern="^AC2-" test/e23-evidence-schema.test.mjs`
  → exit 0. Output: `ok 1..2` (AC2-1, AC2-2), `# tests 2`, `# pass 2`, `# fail 0`.
  **Verdict: PASS.**
- **AC3** — `node --test --test-name-pattern="^AC3-" test/e23-evidence-schema.test.mjs`
  → exit 0. Output: `ok 1..3` (AC3-1, AC3-2, AC3-3), `# tests 3`, `# pass 3`,
  `# fail 0`. AC3-3 specifically reproduces the exact 104447-F0 incident
  heading (`## Phase 3.5 — AC Execution Log`) under pin 1 and confirms it
  still fails — the fix is forward-only, it does not silently re-accept old
  behavior. **Verdict: PASS.**
- **AC4** — `node --test --test-name-pattern="^AC4-" test/e23-evidence-schema.test.mjs`
  → exit 0. Output: `ok 1..2` (AC4-1, AC4-2), `# tests 2`, `# pass 2`,
  `# fail 0`. **Verdict: PASS.**
- **AC5** — `node --test --test-name-pattern="^AC5-" test/e23-evidence-schema.test.mjs`
  → exit 0. Output: `ok 1..3` (AC5-1, AC5-2, AC5-3), `# tests 3`, `# pass 3`,
  `# fail 0`. Each test asserts the actual rejection-envelope TEXT contains:
  the expected section heading / file path / `Evidence schema: v2` — verified
  by direct string inspection of `res.content[0].text` returned by
  `handleUpdateState`, not by re-deriving the expected string from the source
  (an independent consumer-side check). **Verdict: PASS.**
- **AC6** — `node --test --test-name-pattern="^AC6-" test/e23-evidence-schema.test.mjs`
  → exit 0. Output: `ok 1..2` (AC6-1, AC6-2), `# tests 2`, `# pass 2`,
  `# fail 0`. Full-suite `npm test` log (Phase 4 below) is the AC6 "run log"
  proof itself. **Verdict: PASS.**

## Phase 4 — Run

`npm run build`: zero TypeScript errors (tsc clean).

`npm test` (full suite, run synchronously to completion in this turn per the
E20 hard line): **1503/1503 pass, 0 fail** — 1444 pre-existing pass + 41
re-baselined (now green) + 18 new `test/e23-evidence-schema.test.mjs` tests =
1503. Before this round: 1444 pass / 41 fail / 1485 total (the 41 confirmed
by Phase 0.5 above). CI-runnable: `node --test test/*.test.mjs`, zero human
interaction required.

**PASS.**
## 2026-07-15T06:24:17.705Z — PASS — by qa-engineer

PASS. Phase 0.5 expected-red diff clean: 41/41 manifest entries confirmed red pre-edit, 0 unexplained reds (built an independent file:line worklist via grep rather than trusting the manifest's file column, which had at least one wrong attribution). Re-baselined all 41 fixtures across 8 test files (groups A/B/C per docs/schema-versions.md), never weakening an assertion beyond the version bump it exists to pin. Authored test/e23-evidence-schema.test.mjs (18 new tests) covering AC1-AC6 with real proof-run evidence recorded under the AC Execution Log H2. Full regression run synchronously to completion this turn: 1503/1503 pass, 0 fail (1444 pre-existing + 41 re-baselined + 18 new). No real defects found; code-reviewer's zero-blocking-findings verdict holds. Full detail in qa_reports/review_T-E23-01.md (covers: T-E23-01, T-E23-02, T-E23-03).

## 2026-07-15T06:25:03.093Z — PASS — by qa-engineer

PASS. Phase 0.5 expected-red diff clean: 41/41 manifest entries confirmed red pre-edit, 0 unexplained reds (built an independent file:line worklist via grep rather than trusting the manifest's file column, which had at least one wrong attribution). Re-baselined all 41 fixtures across 8 test files (groups A/B/C per docs/schema-versions.md), never weakening an assertion beyond the version bump it exists to pin. Authored test/e23-evidence-schema.test.mjs (18 new tests) covering AC1-AC6 with real proof-run evidence recorded under the AC Execution Log H2. Full regression run synchronously to completion this turn: 1503/1503 pass, 0 fail (1444 pre-existing + 41 re-baselined + 18 new). No real defects found; code-reviewer's zero-blocking-findings verdict holds. Full detail in qa_reports/review_T-E23-01.md (covers: T-E23-01, T-E23-02, T-E23-03).

## 2026-07-15T06:26:19.576Z — PASS — by qa-engineer

PASS. Phase 0.5 expected-red diff clean: 41/41 manifest entries confirmed red pre-edit, 0 unexplained reds (built an independent file:line worklist via grep rather than trusting the manifest's file column, which had at least one wrong attribution). Re-baselined all 41 fixtures across 8 test files (groups A/B/C per docs/schema-versions.md), never weakening an assertion beyond the version bump it exists to pin. Authored test/e23-evidence-schema.test.mjs (18 new tests) covering AC1-AC6 with real proof-run evidence recorded under the AC Execution Log H2. Full regression run synchronously to completion this turn: 1503/1503 pass, 0 fail (1444 pre-existing + 41 re-baselined + 18 new). No real defects found; code-reviewer's zero-blocking-findings verdict holds. NOTE: this MCP server process appears to be running a stale dist/ build (live handoff.md is still schema_version 12 despite dist/schema/versions.js on disk declaring 13, and a prefixed AC-execution heading was rejected under exact-match semantics) — flagging for coordinator, did not work around by weakening evidence, only by conforming to the literal (unprefixed) heading text the SOP already specifies. Full detail in qa_reports/review_T-E23-01.md (covers: T-E23-01, T-E23-02, T-E23-03).

