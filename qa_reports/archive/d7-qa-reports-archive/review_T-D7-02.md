# Review — T-D7-02 (final feature QA: d7-qa-reports-archive)

## Summary
- Final feature QA for `d7-qa-reports-archive`. T-D7-01 (content-only SOP change
  to `content/skill-release-engineer.md`) was already code-reviewer APPROVED
  (`review_reports/review_T-D7-01.md`), which independently confirmed AC1–AC8
  by direct code read. T-D7-02's job (per `specs/d7-qa-reports-archive.md`
  AC8 and `tasks.md:227`) is to *independently* verify AC8 — empirically, not
  just by re-reading the source — and to decide whether a regression test is
  warranted.
- **AC8 verified empirically** (Phase 1, below): behavior of
  `buildCoverageIndex` / `hasEvidenceInFile` is bit-for-bit identical with and
  without a `qa_reports/archive/<feature>/` subdirectory present, across two
  temp-fixture workspace runs against the compiled production code
  (`dist/tools/evidence-file.js`, `dist/gates/qa-review.js`).
- **Regression test added**: `test/covering-evidence.test.mjs` already exists
  and already covers `buildCoverageIndex` scanning behavior directly (it is
  the exact file the ticket names as the natural home for this test). Per
  Constitution §2 / SOP step 6a ("extend an existing relevant test file"),
  extended it with one new test pinning the AC8-b invariant, rather than
  creating a new file.
- Verdict: **PASS**.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_d7-qa-reports-archive.txt` manifest
declared).

## Phase 1 — Review

### Drift/task-list state
`tw_detect_drift` at claim time showed `T-D7-01` completed in the handoff
ledger but unchecked in `tasks.md` (handoff-ahead drift, exactly as flagged in
the dispatch brief — the reviewer's APPROVED write records completion in the
handoff, but `tasks.md`'s checkbox is a separate artifact). Ran `tw_sync`,
which reconciled `T-D7-01`'s checkbox from the handoff ledger (one-way,
handoff → tasks, per its contract) and correctly *refused* to promote the
large pre-existing `refusedVibeDrift` list (unrelated historical drift,
per the dispatch brief's explicit "known drift, ignore" instruction) — no
action taken on those ids, consistent with instructions.

### AC1–AC7 (T-D7-01 scope)
Not re-litigated here — code-reviewer's `review_reports/review_T-D7-01.md`
already covers these against the actual diff to
`content/skill-release-engineer.md` and reached APPROVED with no blocking
findings. T-D7-02's scope (per its own `tasks.md` line and spec §Dependencies)
is AC8 specifically — the code-path safety property that holds independent of
whether any release has actually run the new SOP step yet.

### AC8 — independent empirical verification

**(a) `tools/drift.ts` has zero `qa_reports/`/`review_reports/` references.**
Confirmed independently via direct grep (not just trusting the prior review):

```
$ grep -n "qa_reports\|review_reports" tools/drift.ts
(no output)
```

**(b)/(c) `buildCoverageIndex` is the only readdirSync-based directory scan
over an evidence dir in `tools/`/`schema/`/`guards/`, and archived
subdirectories cannot collide with any evidence lookup.** Confirmed by:

1. Grep sweep for all `readdirSync` / `hasEvidenceInFile` /
   `VISUAL_EVIDENCE_MISSING` / `EXPECTED_RED_DIFF_MISSING` call sites across
   `tools/`, `schema/`, `guards/`:
   - `tools/evidence-file.ts:60` — the sole `readdirSync` (inside
     `buildCoverageIndex`).
   - `tools/storage.ts:189`, `tools/handoff-orchestrator.ts:377,380,535,556,559`
     — all construct/consume exact per-id evidence paths or gate names; none
     scan a directory.
2. **Empirical probe** (not just code reading): built two isolated temp
   workspaces via `fs.mkdtempSync` (same pattern the existing test suite
   uses) against the compiled production modules
   (`dist/tools/evidence-file.js`'s `buildCoverageIndex`,
   `dist/gates/qa-review.js`'s `hasEvidenceInFile`):
   - **Run A (baseline)**: `qa_reports/review_T-D7-02.md` (covers `T-D7-02`)
     + `qa_reports/review_T-OTHER-01.md` (plain per-id, no `covers:`).
   - **Run B (identical baseline PLUS archive)**: same two files, plus
     `qa_reports/archive/_probe/review_T-PROBE-99.md` (`covers: T-PROBE-99`) —
     mirroring exactly the shape the new release-engineer SOP step produces.
   - Asserted: `buildCoverageIndex` output identical between A and B; `T-PROBE-99`
     (which exists ONLY under `archive/`) does **not** appear in either index
     (proves the subdirectory is never descended into, not merely that it's
     filtered at the top level); `hasEvidenceInFile` result identical between
     A and B for the same id set (`T-D7-02` / `T-OTHER-01` present,
     `T-PROBE-99` / `T-MISSING` missing in both); no exception thrown in
     either run.
   - Result: **PASS** — "index identical A vs B: true", "evidence identical
     A vs B: true", "archived-only id leaked into index: false", "threw: false".
   - Script: `/private/tmp/claude-501/-Users-paulchen-paul-agent-governance-mcp/9b92c3c9-f115-431e-9a9f-b19b41e3c221/scratchpad/ac8_probe.mjs`
     (scratch fixture, not committed; temp workspaces cleaned up via
     `fs.rmSync` at end of script — nothing left in the real repo tree).

This satisfies the dispatch brief's requirement to verify AC8 "empirically,
not just by code reading" — the probe exercises the actual compiled
production code path with a realistic archive/ shape, in addition to the
source-read confirmation in (a) and the grep sweep in (b)/(c).

### Spec-to-AC mapping (T-D7-02's own scope)
| AC | Verified by |
|---|---|
| AC8-a | grep sweep of `tools/drift.ts` (this doc) — 0 hits, confirms prior review |
| AC8-b | grep sweep (sole readdirSync + `.md`-suffix filter at `evidence-file.ts:65`, this doc) + empirical probe + new regression test |
| AC8-c | grep sweep of exact-path-only evidence lookups (this doc) + empirical probe (`hasEvidenceInFile` identical A/B) |

### Copy Audit Gate / Visual Audit Gate
Not applicable — spec's Copy/Strings and Visual Tokens tables are both `N/A`
(internal release-process SOP text only, no user-facing strings or visual
literals). Confirmed by reading `specs/d7-qa-reports-archive.md` §Copy /
Strings and §Visual Tokens directly.

### Phase 1.5 — Visual Compare
Skipped (no `design/d7-qa-reports-archive.md`, no `## Visual Baselines` H2 —
non-design feature per the spec's own closing note).

## Phase 2 — Discussion
No issues found in Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests

### Test File Discovery (SOP step 6a)
`test/covering-evidence.test.mjs` already exists and already directly tests
`buildCoverageIndex` (imported from `dist/tools/evidence-file.js`) — including
an existing "non-.md files are ignored" case that is adjacent to but distinct
from the AC8-b directory case (a *file* without `.md` suffix vs a bare
*subdirectory* name). Since a relevant test file exists, extended it rather
than creating a new one or asking the human (per the dispatch brief: "If NO
relevant test file exists, do NOT create one" — inapplicable here since one
does exist and directly covers this exact function).

### Change made
Added one test to `test/covering-evidence.test.mjs`:
`"buildCoverageIndex: tolerates an archive/ subdirectory alongside real .md
files (AC8-b)"` — creates a root-level `.md` file plus a nested
`qa_reports/archive/<feature>/review_<id>.md` (same shape a real release
produces), asserts `buildCoverageIndex` never throws, indexes only the
root-level id, and never surfaces the archived id. This pins the exact
AC8-b invariant as a permanent regression guard (previously only verified via
code read + this session's scratch probe, neither of which persists).

### AC → Test map
| AC | Test |
|---|---|
| AC8-b | `test/covering-evidence.test.mjs`: "buildCoverageIndex: tolerates an archive/ subdirectory alongside real .md files (AC8-b)" |
| AC8-a/c | No new test — `tools/drift.ts` has no qa_reports-related code path to test, and the exact-path evidence lookups already have full existing coverage (`AC-4` backward-compat tests etc. in the same file) that this change does not affect |

### Coverage Gate
`tools/evidence-file.ts` and `gates/qa-review.ts` (the two files implicated by
AC8) are both pre-existing, already heavily covered by
`test/covering-evidence.test.mjs`'s 20+ pre-existing tests; the one line of
new production-relevant behavior asserted (subdirectory tolerance in the
`readdirSync` loop) is now directly exercised. No production code changed in
this task — T-D7-02 is verification-only per spec's Out-of-Scope section
("Any change to `tools/evidence-file.ts`, `tools/drift.ts` ... this ticket
does not modify them").

### Security Smoke Tests
N/A — no new input surface, no auth/permission surface. `buildCoverageIndex`'s
existing boundary-input tests (empty dir, unreadable dir, non-.md files,
empty/malformed `covers:` values) already cover the relevant boundary cases;
the new test adds a subdirectory-shaped boundary input on top.

## Phase 4 — Run

- **Build**: `npm run build` — clean, zero errors (`tsc` via `prebuild` +
  `check:version`, version 3.67.0).
- **Tests**: `npm test` — **1107/1107 pass** (1106 baseline + 1 new test
  added this session), 0 fail, 0 cancelled. CI-runnable headlessly
  (`node --test test/*.test.mjs`, no human interaction).
- **Audit**: `npm audit --audit-level=high` — **0 high**, 1 low
  (`esbuild` 0.27.3–0.28.0 dev-server arbitrary-file-read advisory,
  `GHSA-g7r4-m6w7-qqqr`, dev-dependency only) — matches code-reviewer's
  independently-reproduced T-D7-01 finding exactly (0 high / 1 low).

**PASS.**

## Verdict
PASS — AC8 independently and empirically verified (temp-fixture probe against
compiled production code, plus grep-sweep source confirmation); one
regression test added to the existing, directly-relevant
`test/covering-evidence.test.mjs` per Constitution §2; full build/test/audit
gates green. T-D7-01's AC1–AC7 scope remains code-reviewer's APPROVED verdict
(`review_reports/review_T-D7-01.md`), not re-litigated here. This is the
feature-final QA pass for `d7-qa-reports-archive` — no further tasks remain
in the cut (T-D7 has no REL/DONE tasks; release packaging is a separate
human/release-engineer decision, out of scope for this write).
## 2026-07-10T14:41:11.512Z — PASS — by qa-engineer

Final feature QA PASS for d7-qa-reports-archive. T-D7-01 (release-engineer SOP step 7a + allowlist, content/skill-release-engineer.md) was already code-reviewer APPROVED (review_reports/review_T-D7-01.md). T-D7-02 independently and empirically verified AC8: (a) tools/drift.ts has zero qa_reports/review_reports references (grep-confirmed); (b)/(c) buildCoverageIndex is the sole readdirSync over an evidence dir, .md-suffix-filtered before any read, non-recursive — confirmed both by source read and by a temp-fixture probe running the actual compiled production code (dist/tools/evidence-file.js, dist/gates/qa-review.js) with/without a qa_reports/archive/<feature>/ subdirectory present: buildCoverageIndex and hasEvidenceInFile outputs were bit-for-bit identical across both runs, no exception thrown, and the archived-only id never leaked into the index. Added one regression test to the existing test/covering-evidence.test.mjs (already the direct home for buildCoverageIndex tests) pinning this AC8-b invariant permanently. Gates: npm run build clean; npm test 1107/1107 pass (1106 baseline + 1 new); npm audit --audit-level=high 0 high / 1 low (matches T-D7-01's independently-reproduced finding). Evidence: qa_reports/review_T-D7-02.md. Feature-final PASS — T-D7 has no REL/DONE tasks in this cut; release packaging is a separate human decision.

