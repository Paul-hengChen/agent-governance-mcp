# c15-expected-red-manifest

Source: `docs/backlog.md` §C15 — "Expected-red test handoff is unverifiable
prose" (P1, observed 2026-07-09).

## Problem Statement

In the live C9 run, sr-engineer correctly left 52 tests red (an intentional
schema-bump re-baseline) and handed QA a **prose catalogue** describing them.
Code-reviewer spot-checked 2 of 52. Nothing machine-compared "the tests
actually red right now" against "the tests sr-engineer claims are
intentionally red" before QA started re-baselining — a genuine regression
hiding among the 50 unchecked entries would have been indistinguishable from
an expected cap update, and QA could have re-baselined it straight into the
suite as if it were sanctioned drift.

Mass re-baselines are not rare: they recur every schema bump (this
repo has shipped several — v3→v8 handoff alone). Each one is a live
opportunity to launder a real regression into "cap update" unless the
red-set claim is checked against reality, not read as prose.

This ticket replaces the prose catalogue with a machine-comparable manifest
(file + test name, one per line) that sr-engineer emits, QA diffs against
the actual suite run before touching any baseline, and code-reviewer samples
from directly — plus a cheap existence/disposition gate so the manifest and
its diff disposition cannot be silently skipped at PASS.

## User Stories

- As a QA engineer, I want a machine-readable list of exactly which tests
  sr-engineer expects to be red, so I can diff it against the actual suite
  run instead of trusting a prose summary I'd have to spot-check by hand.
- As a code-reviewer, I want to sample specific `file :: test name` entries
  from a manifest, so my spot-check targets real, greppable identifiers
  instead of paraphrased prose that may not match the actual test names.
- As a human operator, I want a real regression hiding among expected reds
  to surface as an explicit, on-the-record disposition (or a FAIL), not a
  silent re-baseline, so mass schema-bump re-baselines stay auditable.
- As the server, I want a cheap existence check that a manifest's diff was
  actually recorded before PASS, so "I diffed it, trust me" can't substitute
  for the recorded disposition — without requiring the server itself to run
  the test suite, which is out of scope for file-mode.

## Acceptance Criteria

**AC-1 — Manifest artifact and format (skill-sr-engineer)**
- Given sr-engineer hands off a task that intentionally leaves one or more
  tests red (e.g. a schema-bump re-baseline, a deliberately deferred
  implementation), when it completes the handoff, then it MUST write
  `qa_reports/expected-red_<active_feature>.txt` — one line per expected-red
  test, format `<relative test file path> | <exact test name/description
  string>`. Blank lines and lines starting with `#` are comments (ignored by
  the diff step) so sr-engineer can group entries with a one-line rationale
  above a block.
- Given sr-engineer's task leaves NO test intentionally red, when it
  completes the handoff, then it emits no manifest — absence means "no
  expected reds," identical polarity to `external_refs`/`dispatch_pins`
  absence-is-non-blocking precedent (c9/c14).
- The manifest is feature-scoped, not task-scoped (one file per feature,
  appended to — not overwritten — by every task in the feature that adds
  expected reds), because QA's diff (AC-3) runs against the whole suite, not
  a single task's slice.

**AC-2 — QA Phase 0.5: Expected-Red Diff (skill-qa-engineer)**
- Given `qa_reports/expected-red_<active_feature>.txt` exists, when QA
  reaches the new Phase 0.5 (after Phase 0 claim, before Phase 1 review),
  then QA MUST run the full suite, collect the actual set of red
  (failing/erroring) tests, and diff it against the manifest's entries.
- Given the diff, when the difference set (manifest entries not actually
  red, PLUS actual reds not on the manifest) is empty, then QA logs
  `Phase 0.5: clean (N/N manifest entries confirmed red, 0 unexplained
  reds)` in the review doc and proceeds to Phase 1.
- Given the difference set is non-empty, when QA proceeds, then EVERY extra
  or missing entry MUST be explicitly dispositioned under a `## Expected-Red
  Diff` H2 in `qa_reports/review_<task-id>.md` (one line per entry: entry +
  one-line disposition, e.g. "now green — fixed earlier in the same PR,
  safe to drop" or "pre-existing unrelated flake, confirmed via git log")
  BEFORE any re-baseline edit (test file change, `.snap` update, expected-
  value edit) is made. This is the manifest's whole purpose: unexplained
  reds are exactly the launder vector this ticket closes.
- Given a diff entry looks like a genuine, unexplained regression (an actual
  red not on the manifest, with no plausible innocent disposition), when QA
  reaches this point, then QA MUST NOT disposition it away — escalate per
  *Escalation Routes: expected-red diff regression* (FAIL to sr-engineer),
  same posture as any other Phase 4 FAIL.
- Given `qa_reports/expected-red_<active_feature>.txt` does NOT exist, when
  QA reaches Phase 0.5, then it logs `Phase 0.5: skipped (no expected-red
  manifest declared)` and proceeds — non-UI-shaped features and features
  with zero intentional reds pay zero overhead, mirroring the Phase 1.5
  Visual Compare absent-branch precedent.

**AC-3 — code-reviewer samples from the manifest, not from prose**
- Given a diff under review touches test files, or the associated task's
  handoff notes reference expected reds, when code-reviewer reviews it,
  then it MUST check whether `qa_reports/expected-red_<active_feature>.txt`
  exists at the expected path, and — if so — sample at least 3 entries (or
  all entries if fewer than 3) by grepping the named test file for the named
  test string, confirming the entry is a real, locatable test. Sampling
  from the manifest's structured `file | test name` pairs replaces the prior
  practice of spot-checking free-text prose summaries.
- Given the manifest is declared missing when the review context indicates
  intentional reds exist (e.g. `npx tsc --noEmit` / test run shows red tests
  the diff doesn't explain), when code-reviewer reviews it, then it is a
  `CHANGES_REQUESTED` finding under **Correctness** — cite the missing path.

**AC-4 — Machine gate: `EXPECTED_RED_DIFF_MISSING` (new, mirrors
`VISUAL_EVIDENCE_MISSING`)**
- Given `qa_reports/expected-red_<active_feature>.txt` exists in the
  workspace at the moment of a `qa-engineer` PASS write (file-mode only),
  when the PASS write is evaluated, then the server requires that AT LEAST
  ONE of the `qa_reports/review_<id>.md` files for the ids being PASS'd (or
  a file covering one of those ids via the existing `covers:` label-line
  convention, c3-covering-evidence) contains a `## Expected-Red Diff` H2
  section — mirroring `hasEvidenceInFile`'s per-id existence check, reusing
  the same `qa_reports/` directory and `covers:` plumbing
  (`tools/evidence-file.ts`) rather than inventing a second index.
- Given that section is absent across every candidate file, when the PASS
  write is evaluated, then the server rejects it with a new error code
  `EXPECTED_RED_DIFF_MISSING` (registered in `gates/registry.ts` alongside
  `VISUAL_EVIDENCE_MISSING`/`MISSING_EVIDENCE`, with a `hintStatic` pointing
  back at skill-qa-engineer Phase 0.5), the same envelope shape as the
  existing evidence gates (`⛔ EXPECTED_RED_DIFF_MISSING: <ids>. <hint>`).
- Given the manifest does NOT exist, when the PASS write is evaluated, then
  this gate is not armed at all — zero cost for features with no expected
  reds, same arming polarity as the Visual gate's `## Visual Baselines`
  check.
- **Scope of the machine check**: existence of the H2 section only, NOT
  correctness of its content (same trust boundary as `MISSING_EVIDENCE`,
  which checks a review file exists but not that the review is good). The
  server does not run the test suite and cannot verify the diff itself —
  only that QA recorded ONE. Content correctness remains QA's/code-
  reviewer's job (AC-2/AC-3), same division of labor as every other
  agent-executed gate in this codebase (Copy Audit Gate, Visual Audit Gate).

**AC-5 — File-mode only, no schema bump**
- This feature adds a new plain-text artifact convention and a new gate
  predicate/error code — it does NOT add or change any `tw_update_state`
  field, does NOT touch `schema/versions.ts` or any
  `schema/migrations-*.ts` file, and does NOT touch
  `tools/storage-sqlite.ts` (SQLite/HTTP mode has no file-based manifest
  concept and is explicitly out of scope — see Out of Scope). No
  `docs/schema-versions.md` row is added.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature has no user-facing strings (test-process/gate change only) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- **Server-executed test runs.** The server never shells out to run a test
  suite in file mode — AC-2's diff is QA-agent-executed, exactly like every
  other "run the suite" step already in `skill-qa-engineer.md` (Phase 4).
  The new gate (AC-4) checks only that a disposition record exists, not
  that the diff itself was computed correctly. A server-side test-runner
  integration is a materially larger, separate feature — not cut here.
- **SQLite/HTTP-mode manifest support.** File-mode only, mirrors the
  `dispatch_pins`/`external_refs` DR-5 precedent (c14 Out of Scope). SQLite
  mode has no `qa_reports/*.md` file convention to hang a manifest or gate
  off of; a SQLite-native equivalent (e.g. a `expected_red_tests` table) is
  a separate ticket if HTTP-mode adopters need it.
- **Per-task manifests.** AC-1 makes the manifest feature-scoped
  (`expected-red_<feature>.txt`), not one file per task — QA's diff runs
  against the whole suite regardless of which task triggered Phase 0.5, so
  splitting by task id would just force QA to re-merge them.
- **A canonical manifest schema/parser shared with `tw_*` tooling.** The
  manifest is read by QA (a human-directed agent) and sampled by
  code-reviewer, both via plain `Read`/grep — no `tools/` module parses its
  rows. Only the disposition **section**'s presence is machine-checked
  (AC-4), not the manifest's own rows. Building a typed manifest
  reader/writer is unwarranted for a `grep`-shaped artifact.
- **Retroactively re-auditing the 52-test C9 catalogue.** Historical; the
  prose catalogue from the live C9 run is left as-is (same
  don't-rewrite-shipped-history precedent as c14 Out of Scope).
- **C16/C17.** Adjacent backlog items (code-reviewer ledger-write scope,
  coordinator brief boilerplate) are separate tickets, not addressed here.

## Dependencies / Prerequisites

- **Resource Audit Gate (Constitution §7):** scanned `docs/backlog.md`'s C15
  entry, `content/skill-sr-engineer.md`, `content/skill-qa-engineer.md`,
  `content/skill-code-reviewer.md`, `tools/evidence-file.ts`,
  `gates/qa-review.ts`, `gates/visual.ts`, `gates/registry.ts`,
  `tools/handoff-orchestrator.ts` for `http(s)://`, `figma`, `sketch`,
  `mockup`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, `JIRA`. **Zero
  hits** — every reference in scope is an in-repo file path.
  `external_refs` is omitted from this ticket's `tw_update_state` write
  (absence = zero external refs found = non-blocking).
- **No `design/c15-expected-red-manifest.md`** exists; mode = no-design.
  The Scope Decision Gate and Visual gates are not armed for this feature.
- Depends conceptually on the C9 live run (the incident this ticket fixes)
  and reuses the `covers:` label-line plumbing shipped for c3 covering-
  evidence (`tools/evidence-file.ts`) and the `VISUAL_EVIDENCE_MISSING`
  gate shape shipped for the visual-fidelity work — both already in
  production; this ticket adds a third gate of the same family, it does not
  invent a new mechanism class.
- Sequencing note for sr-engineer: land the three skill-file content edits
  (T-C15-01..03) independent of and before the gate code (T-C15-04..08) —
  the content edits are immediately useful on their own (QA/code-reviewer
  can follow the new prose SOP by hand even before the machine gate exists)
  and de-risk the smaller, mechanical gate-code slice by proving the
  manifest shape first.
