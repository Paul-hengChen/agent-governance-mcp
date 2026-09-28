# QA review — T-E232-01

covers: T-E232-01, T-E232-02, T-E232-03, T-E232-04, T-E232-05, T-E232-06, T-E232-07, T-E232-08, T-E232-09, T-E232-10

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e232-leak-cleanup.txt` manifest declared). This is a
feature-mode mechanical cleanup ticket, not a bugfix-mode ticket; no expected-red set was
declared by sr-engineer.

## Phase 1 — Review (spec/AC verification of code-reviewer-APPROVED T-E232-01..08)

Code-reviewer APPROVED T-E232-01..08 (one report each, `review_reports/review_T-E232-01..08.md`,
committed at `bae5283`; zero required findings, two optional non-blocking notes — carried-over
dead relative links and one renamed-but-nonexistent recommendations-file mention — neither
touches an Acceptance Criterion, so both stay out of QA's FAIL scope per this role's SOP).

QA independently re-ran every AC's proof command against the on-disk tree (not trusted from the
review docs alone) before accepting the round. All three leak-class patterns were read from
`$TMPDIR/e232-leak-patterns.txt` (not reproduced here, per constitution §6 and this ticket's own
subject matter) and the owned-set file list was rebuilt from `specs/e232-leak-cleanup.md`'s
"Owned set" section (1208 existing files, `content/**`, `test/fixtures/compose-golden/**`,
`research/**`, `specs/**` excl. `fanout-*`, `qa_reports/**`, `review_reports/**`, the named
`tools/`/`gates/` files + matching `dist/`, the named `docs/*`, `CHANGELOG.md`, `NEW-TICKETS.md`,
`multi-agent-scripts/**`, the six qa-owned test files, `test/e232-*.test.mjs`, `.current/e232/**`).

- **AC1** (class1 internal work-item link): `grep -rlE <class1> <owned-set>` → zero hits before
  and after T-E232-09. Clean.
- **AC2** (class2 client codename, `-w -i`): before T-E232-09, the only 5 hits in the entire
  owned set were exactly the 5 (of 6) qa-owned test files this task targets (T-E232-09's own
  scope) — confirms sr-engineer's T-E232-01..08 slices are already fully clean. Zero hits
  anywhere after T-E232-09 (see below).
  - **T-E232-03/T-E232-04 field-integrity addendum**: re-ran the exact diff-based proof from the
    spec (`git diff --unified=0 <commit>~1 <commit> -- qa_reports/` / `review_reports/` | grep
    verdict/covers/APPROVED/CHANGES_REQUESTED tokens) over each task's own commit
    (`f154b30` T-E232-03, `2fea819` T-E232-04) in isolation. Both print non-empty output, but
    every matched line pair is a **keyword collision inside pre-existing prose** (the word
    "APPROVED" occurring inside a body sentence like "code-reviewer APPROVED at round 3", or
    "approved" inside "human-approved cut"), never a verdict heading, `## Verdict` line, or
    `covers:` line. Confirmed by identifying the exact files
    (`qa_reports/archive/e117-void-task/review_T-E117-0{1,2}.md`,
    `review_reports/archive/e166-e165-reltool-wave45/review_T-E166-01.md`) and reading the
    actual verdict/covers lines in each — byte-identical before/after. Matches the
    code-reviewer's own T-E232-03/04 characterization verbatim; independently reproduced, not
    taken on faith.
  - **Paired-context addendum**: `docs/postmortem-visual-fidelity-gate.md` retains exactly 1 of
    its original 3 "oobe" mentions (the generic 8-screen-name list line) — the origin line and
    the client design-doc-slug line were scrubbed per ruling (i). `content/skill-design-auditor.md`
    and `test/visual-gate-e2e.test.mjs` are untouched by any e232 commit (`git log` on both shows
    only the repo-history-reset commit) — confirms the "stays unchanged, no golden/budget refresh"
    disposition held.
- **AC3** (renamed research file): `test -f research/oobe-visual-fidelity-retrospective-2026-06-05.md`
  exits 0; `grep -rl <class2>-oobe-visual-fidelity-retrospective-2026-06-05 <owned-set>` (old
  filename) is zero hits — all 7 referrers repointed.
- **AC4** (class3 local path w/ username): before T-E232-09, the only hit in the entire owned set
  was `test/e123b9-lane-flip.test.mjs` (T-E232-09's own scope, correctly qa-owned per Constitution
  §2 and per the task's own note). Zero hits anywhere after T-E232-09.
- **AC5** (`pending_notes` rationale exemption): `content/constitution-rationale.md:209` now reads
  "...governance-internal artifacts (qa/review reports, `pending_notes`, handoff)..." — names both
  artifacts the `content/const-15-core-tail.md` bullet exempts. Confirmed this file is not composed
  into any prompt (grep across `prompts/constitution-manifest.ts` / `skill-manifest.ts` /
  `partials-manifest.ts` — no reference), so no golden/budget refresh is owed.

## Phase 1.5 — Visual Compare

Skipped (no `design/e232-leak-cleanup.md`, and the spec's own Visual Tokens/Visual Widgets
sections are explicitly N/A — "feature has no visual literals" / "feature has no non-primitive
widgets"). Non-UI ticket, zero overhead.

## Phase 3 — Tests (T-E232-09)

**Test File Discovery**: per this dispatch's `Test-file placement` line, T-E232-09 edits exactly
the 6 named existing test files (comment/prose only): `test/e117-void-task.test.mjs`,
`test/e123b9-lane-flip.test.mjs`, `test/visual-evidence-gate.test.mjs`,
`test/visual-report-schema-validation.test.mjs`, `test/widget-shape-spec.test.mjs`,
`test/context-budget.test.mjs`. All 9 occurrences found across these 6 files (8 class2 + 1 class3)
were in comments or non-matched assertion-message strings — none was load-bearing in an
assertion or expected value, so no stop-and-report was triggered. Replacement wording follows
the `specs/decodename-cleanup.md` precedent table ("the scope-creep finding", "the false-PASS
class/hole/incident/contract", "the divergence") rather than inventing new phrasing. No new test
file was authored — the pre-authorized `test/e232-*.test.mjs` creation path was not needed.

No new production logic was introduced by this ticket (pure text substitution + one file rename),
so the Coverage Gate (≥80% line coverage on new/modified files) and Security Smoke Tests
(boundary inputs, auth/permission tests) are not applicable — there is no new/modified
executable code path to cover. Noted explicitly per SOP §6c.

## Phase 3.5 — AC Execution Log

All 6 ACs carry `proof:` annotations. Commands re-run over the full owned-set file list
(1208 files) after T-E232-09 landed, immediately before this PASS:

| AC | proof command | result |
|---|---|---|
| AC1 | `grep -rlE <class1_internal_url> <owned-set>` | prints nothing — PASS |
| AC2 | `grep -rlwiE <class2_client_codename> <owned-set>` | prints nothing — PASS |
| AC2 (T-03/T-04 field-integrity) | `git diff --unified=0 <commit>~1 <commit> -- qa_reports/\|review_reports/` piped through the verdict/covers/APPROVED grep | non-empty but all keyword collisions in prose, zero verdict/covers/gate-field lines touched — PASS (see Phase 1 addendum above) |
| AC3 | `grep -rl <class2>-oobe-visual-fidelity-retrospective-2026-06-05 <owned-set>` + `test -f research/oobe-visual-fidelity-retrospective-2026-06-05.md` | zero hits + exit 0 — PASS |
| AC4 | `grep -rlE <class3_local_path> <owned-set>` | prints nothing — PASS |
| AC5 | `grep -n "pending_notes" content/constitution-rationale.md` | matches inside §6 rationale section — PASS |
| AC6 | the AC1/AC2/AC4 proof commands re-run over the complete owned set post-T-E232-09, plus `npm run build && npm test` | all three greps print nothing; build clean; full suite green (see Phase 4) — PASS |

No proof was un-runnable; none skipped.

## Phase 4 — Run

- `npm run build`: clean (tsc, check:version, check:transitions-sync all OK).
- `npm test`: see PASS record below for exact counts.
- Commit `0ff3a66` (T-E232-09, 6 test files, no untracked files in worktree at commit time) landed
  before the full suite run, per lane protocol §3.
## 2026-09-27T20:35:42.538Z — PASS — by qa-engineer

PASS T-E232-01..10 (full report: qa_reports/review_T-E232-01.md, covers all 10 ids). Code-reviewer APPROVED T-E232-01..08 (review_reports/review_T-E232-01..08.md, bae5283); QA independently re-ran every AC1-AC6 proof command against the on-disk tree rather than trusting the review docs. AC1 (internal work-item link) and AC4 (local path w/ username) were already zero-hit across the owned set for every sr-engineer-owned file before T-E232-09; the only pre-existing hits anywhere in the owned set were exactly the 6 qa-owned test files T-E232-09 targets (5 for class2, 1 for class3), confirming sr-engineer's slices were clean. AC3 rename + all 7 referrers verified. AC5 rationale paraphrase now names both pending_notes and handoff, confirmed uncomposed into any prompt. AC2's T-E232-03/T-E232-04 field-integrity addendum independently reproduced: the diff-based proof's non-empty output is keyword collisions inside prose (APPROVED/approved appearing mid-sentence), never an actual verdict/covers/gate-field line, verified by reading the exact before/after lines in each matched file. Paired-context addendum for docs/postmortem-visual-fidelity-gate.md confirmed (1 of 3 oobe lines remains, the other two scrubbed); content/skill-design-auditor.md and test/visual-gate-e2e.test.mjs confirmed untouched by any e232 commit. T-E232-09: scrubbed 9 occurrences (8 class2 + 1 class3) across the 6 named qa-owned test files, all comment/prose or non-matched assertion-message text -- zero assertion or expected-value changes, wording follows the specs/decodename-cleanup.md precedent table. Committed 0ff3a66 before running the full suite, no untracked files in worktree. T-E232-10 (AC6): all 3 leak-class greps re-run over the complete 1208-file owned set post-T-E232-09 -- zero hits on all three. npm run build clean (tsc, check:version, check:transitions-sync). npm test: 2838 pass / 0 fail / 3 pre-existing skip / 2841 total -- matches the pre-T-E232-09 baseline exactly, confirming no assertion depended on the removed literals. No coverage/security-smoke gate applicable -- pure text substitution + one file rename, no new/modified executable logic.

