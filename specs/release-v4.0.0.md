# release-v4.0.0

## Problem Statement
`main` @ `aea0f07` already contains the full v4.0.0 scope: `.current/<lane>/`
layout, lane-driven dispatch/boundary checks, the integrator role, and
merge-invariant enforcement, closing 15 of the 16 items in
`docs/v4.0.0-execution-plan.md` §9. Ten lane features shipped since the last
tag (`v3.119.0`) each carry their own qa PASS / code-review APPROVED evidence
and a closed lane handoff, but no one has verified that evidence still stands
on the *committed main tree as a whole* — a single missing file, a stale
verdict, or a red full-suite run would silently invalidate the MAJOR cut. This
is an evidence-only release gate, the same shape as the prior
`release-v4-wave6` feature (see its `scope_decision_why` in
`.current/history/2026-09/.../handoff.md` for precedent — QA verifies
committed evidence + runs the suite, then release-engineer proceeds under
that PASS): no new code is written here.

**Problem note (added at re-entry, 2026-09-27)** — release-engineer's step 2a
pre-flight found `main` red at HEAD `1dd4288`: CI run `36317013000` reports
2809/2817 passing, with the same 6 tests failing on every matrix job —
`test/e130-lane-default.test.mjs` AC4/AC14 (diffing `121ddc8..5896bdd`) and
`test/e178a-integrator-role.test.mjs` AC3/AC4/AC6/AC15 (diffing against
`3c72a83`) — each erroring `fatal: bad revision` because `.github/workflows/ci.yml`
checks out with `actions/checkout@v4` and no `fetch-depth`, so the CI runner
only has the tip commit and cannot resolve those historical lane-base SHAs;
locally the suite is 2817/2817 because a full clone has the history these
tests diff against. The human decided on **route A**: change only the
checkout step's `fetch-depth` to `0` in `.github/workflows/ci.yml` — the
sha-pinned tests themselves are not touched in this release (a post-v4
ticket will make them history-independent). This is a code-bearing change
(one line, one file), so it is cut as new tasks below and routed through the
normal build chain (sr-engineer → code-reviewer → qa-engineer), not folded
into the evidence-only verification AC1-AC4 already PASSed.

## User Stories
- As release-engineer, I want a QA PASS confirming all ten Wave 7/7.2b lanes'
  evidence is present and green on main, so that I can execute Wave 8
  (version bump, CHANGELOG, adapter stamps, `agc check`, `verify-release`)
  without re-litigating already-closed lane work.
- As a maintainer, I want `docs/schema-versions.md` to describe the
  lane-local ledger model (E125a) that already shipped, so that the next
  person authoring a schema migration isn't working from a doc that still
  describes the pre-E125a world.

## Acceptance Criteria

- **AC1** — Given the ten lanes merged to main since `v3.119.0` (e204
  `75cdfd6`, e180 `18c625f`, e177a `9425ea6`, e177b `acfdc09`, e212
  `663d50d`, e213 `96c4123`, e130 `5f9a21c`, e178b `fcfef80` incl. E222 fix
  `aafa0d2`, e223 `749f68f`, e178a `81056a6`+`7a2625a`), when each lane's
  declared evidence files are inspected on the committed main tree, then
  every task id below resolves to a `qa_reports/` file whose verdict reads
  `PASS` and — for every task id that went through a code-review hop — a
  `review_reports/` file whose verdict reads `APPROVED` (a `CHANGES_REQUESTED`
  round is acceptable ONLY if a later round in the same file resolves to
  `APPROVED`, e.g. e178b's Round 2).

  | lane | merge commit(s) | task ids | qa evidence (verdict) | code-review evidence (verdict) |
  |---|---|---|---|---|
  | e204 | `75cdfd6` | T-E204-01 | `qa_reports/review_T-E204-01.md` (PASS) | — (single-role qa dispatch, no code hop) |
  | e180 | `18c625f` | T-E180-01..05 | `qa_reports/review_T-E180-01..05.md` (PASS) | `review_reports/review_T-E180-01.md` (APPROVED, covers 01-05) |
  | e177a | `9425ea6` | T-E177A-01..07 | `qa_reports/review_T-E177A-01..07.md` (PASS) | `review_reports/review_T-E177A-01.md` (APPROVED, covers 01-07) |
  | e177b | `acfdc09` | T-E177B-04..06 | `qa_reports/review_T-E177B-04..06.md` (PASS) | `review_reports/review_T-E177B-05.md` (APPROVED) |
  | e212 | `663d50d` | T-E212-01 | `qa_reports/review_T-E212-01.md` (PASS) | — (single-role qa dispatch, no code hop) |
  | e213 | `96c4123` | T01, T02, T04, T08, T09, T10 (pre-`T-<TICKET>-NN`-convention bare ids) | `qa_reports/review_T10.md` (PASS, `covers: T01,T02,T04,T08,T09,T10`) | `review_reports/review_T01.md` (APPROVED, `covers: T01,T02,T04,T08`) |
  | e130 | `5f9a21c` | T-E130-02..09 | `qa_reports/review_T-E130-02..09.md` (PASS) | `review_reports/review_T-E130-09.md` (APPROVED) |
  | e178b | `fcfef80` (+ E222 fix `aafa0d2`) | T-E178B-01..05 | `qa_reports/review_T-E178B-01..05.md` (PASS) | `review_reports/review_T-E178B-01.md` (Round 1 CHANGES_REQUESTED → Round 2 APPROVED) |
  | e223 | `749f68f` | T-E223-01, T-E223-02 | `qa_reports/review_T-E223-01.md` + `review_T-E223-02.md` (PASS) | `review_reports/review_T-E223-01.md` (APPROVED) |
  | e178a | `81056a6` + `7a2625a` | T-E178A-01..07 | `qa_reports/review_T-E178A-01..07.md` (PASS) | `review_reports/review_T-E178A-01.md` (APPROVED) |

  Also confirm each lane's `.current/history/2026-09/<lane>/handoff.md`
  records `status: "PASS"` / `last_agent: "qa-engineer"` (already true as of
  this spec's authoring — re-verify, don't assume it's still true at review
  time).

  proof: for each row above, `grep -n -i verdict <qa_reports path>` shows
  `PASS` and (where a code-review column is not `—`) `grep -n -i verdict
  <review_reports path>` shows `APPROVED` in its last `## Verdict` section;
  and `grep -E '^(status|last_agent):' .current/history/2026-09/<lane>/handoff.md`
  shows `status: "PASS"` / `last_agent: "qa-engineer"`.

- **AC2** — Given the committed main tree at HEAD, when the full test suite
  runs, then it exits 0 with zero failures.
  proof: `npm test` (exit 0; report the printed pass/fail tally).

- **AC3** — Given the committed main tree at HEAD, when the project is
  rebuilt, then the committed `dist/` is byte-identical to a fresh build —
  no MAJOR release ships on a stale or drifted `dist/`.
  proof: `npm run build && git status --porcelain dist/` (expect empty
  output, exit 0).

- **AC4** — Given `docs/v4.0.0-execution-plan.md` §9 ("v4.0.0 的完成定義"),
  when its 16 checklist items are read, then all 15 non-final items are
  checked `[x]` and only the final item — "全套測試綠、`agc check` — OK
  (4.0.0) exit 0、`verify-release` 六項全過" — remains unchecked `[ ]` (that
  item is release-engineer's, closed by Wave 8, not by this ticket).
  proof: `sed -n '1249,1268p' docs/v4.0.0-execution-plan.md` — count 15
  `[x]` lines followed by exactly 1 `[ ]` line (the last).

- **AC5** — Given the CI-red condition described in the Problem note above
  (main red at `1dd4288`, 6 tests failing on every matrix job with `fatal:
  bad revision` because `actions/checkout@v4` runs with the default shallow
  depth), when `.github/workflows/ci.yml`'s checkout step is changed to
  `fetch-depth: 0` (route A — no other line in the workflow, and no test
  file, changes) and that fix commit lands on main, then (i) the full local
  suite is green (`npm test` exits 0, all previously-failing tests now
  passing, zero unexplained reds) AND (ii) the GitHub Actions CI run for
  that exact fix commit concludes `success` on every matrix job (node 20 and
  node 22) — this is precisely what release step 2a checks, so a green run
  here is what unblocks re-dispatching release-engineer from step 1.
  proof: `npm test` (exit 0, full tally) plus `gh run list --workflow
  ci.yml --branch main -L 1` then `gh run view <run-id>` showing
  `conclusion: success` for both `test (20)` and `test (22)` on the fix
  commit's SHA.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | feature introduces no user-facing strings (evidence-verification only) |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- **Version bump** (`package.json`, `index.ts` `Server()` literal, README
  `#v` pin), **CHANGELOG.md MAJOR entry** (must name the upgrade path and
  migration behavior per the Wave 8 dispatch card), **three adapter stamps**,
  **`agc check`**, and **`verify-release`** (the three-timepoint SOP per
  `content/skill-release-engineer.md`, not the stale "push-after" line in the
  old dispatch-card text) — all release-engineer's SOP, dispatched only
  after this ticket's QA PASS. Not verified or executed here.
- **`docs/schema-versions.md` update** — this is a real Wave 8 DoD item
  (§9's bullet list, "發版" section) but it is NOT a qa-verified AC on this
  ticket: it's tracked as a separate later task for doc-writer (T-REL4-02,
  see Task Format below), dispatched after this ticket's QA PASS, not before.
  Concrete gaps verified against the current doc and the E125a source
  (`tools/tasks-lane-migrate.ts`, `schema/versions.ts`) as of this spec:
  1. The "What gets versioned" Location table's `tasks` row still reads
     `tasks.md (or configured path)` — it does not say that the live `tw_*`
     ledger is `.current/<lane>/tasks.md` (a `LANE_FILES` entry, same as
     `handoff.md`), and that root `tasks.md` is now demoted to a v2 **index**
     that `tw_*` tools never write.
  2. There is no "Tasks version history" table at all (unlike the detailed
     "Handoff version history" table) — `CURRENT_VERSIONS.tasks` jumped 1→2
     for E125a with zero narrative of what changed or why.
  3. No description of the v2 index shape: the `<!-- schema_version: 2 -->`
     sentinel, the `TASKS_INDEX_NOTICE` comment (`tasks_role: index — the
     tw_* ledger for lane _primary is .current/_primary/tasks.md (E125a);
     tw_* never writes this file`), or the reverse-run receipt file
     `.current/tasks-index-receipt.json`.
  4. No description of the `_primary` **forward** migration: on first read,
     a `_primary`-lane workspace COPIES the legacy root `tasks.md` body into
     `.current/_primary/tasks.md` (stamped v1 — the ledger) and re-stamps the
     legacy root file as v2 (index + notice); a feature lane instead MOVEs
     only its own `## `-headed sections into its lane ledger, leaving a
     `tasks_moved: lane=<id> run=<n> of=<m> sections=<k> -> .current/<lane>/tasks.md`
     marker per contiguous run, and leaves the legacy sentinel untouched.
  5. No mention of the git-ignored-lane exception (option A): a lane whose
     `.current/<lane>/` path is git-ignored in that workspace skips the
     migration entirely and keeps the legacy root file as the ledger.

## Dependencies / Prerequisites
- Precondition (Wave 8 dispatch card, `docs/v4.0.0-execution-plan.md` §9):
  Wave 7 merged and all 16 completion-definition items resolved except the
  final release item — verified true as of this spec (AC4).
- This ticket's QA PASS is release-engineer's precondition for Wave 8 (same
  dependency shape as `release-v4-wave6`).
- No `design/release-v4.0.0.md` exists; `## Mode` is not armed — non-visual
  feature, Visual Structural Assertions section omitted per the Spec Schema.
- No external references (URLs, Figma, tickets) appear in this assignment
  beyond the in-repo `docs/v4.0.0-execution-plan.md` and prior lane evidence
  already cited above — Resource Audit Gate: zero hits, field omitted.

## Task Format
- [ ] T-REL4-01 [P0] qa-engineer: verify AC1-AC4 on the committed main tree (evidence-only gate, no code changes) — PASS unlocks release-engineer's Wave 8 dispatch | depends_on: none
- [ ] T-REL4-02 [P2] doc-writer: update `docs/schema-versions.md` per the Out-of-Scope gap list above (tasks Location row, Tasks version history table, v2 index shape, `_primary` forward migration, git-ignored-lane exception) — dispatch only after T-REL4-01 PASS | depends_on: T-REL4-01
- [ ] T-REL4-03 [P0] sr-engineer: fix CI red per AC5 — in `.github/workflows/ci.yml`, add `fetch-depth: 0` to the `actions/checkout@v4` step (the checkout step only; no other line, and no `test/` file, changes) so the CI runner has full history for the SHA-diffing tests | depends_on: none
- [ ] T-REL4-04 [P0] code-reviewer: adversarial review of T-REL4-03's diff against AC5 — confirm the change is exactly the one-line `fetch-depth: 0` addition, nothing else in `ci.yml` moved, and no `test/` file was touched | depends_on: T-REL4-03
- [ ] T-REL4-05 [P0] qa-engineer: re-verify AC5 — full local suite green (`npm test` exit 0) AND the GitHub Actions CI run for the T-REL4-03 fix commit concludes `success` on every matrix job (`gh run list --workflow ci.yml --branch main` / `gh run view`); PASS restores the (qa-engineer, PASS) precondition so release-engineer can re-enter at step 1 | depends_on: T-REL4-04
