# release-v4.2.1

## Problem Statement
`main` @ `87c37b2` contains one code-bearing change set since the `v4.2.0`
tag: E233 (plain-language comments and content text, merged as six lanes
e233a-e233f) plus E241 (merged in lane e233b), which also rewrote one
CHANGELOG 3.27.1 citation and the `research/visual-fidelity.md` header. The
change is comment-only and wording-only: ticket ids in comments and content
text were rewritten into plain words, compose goldens were regenerated, and
`dist/` was rebuilt from the edited `.ts` comments. Each lane carries its own
qa PASS + code-review APPROVED evidence and a closed lane handoff under
`.current/history/2026-09/`, but no one has verified that evidence still
stands on the committed main tree as a whole. This is an evidence-only PATCH
release gate, the same shape as `release-v4.2.0`: no new code is written here.

## User Stories
- As release-engineer, I want a QA PASS confirming the E233/E241 lane evidence
  is present and green on main and that the change is behavior-neutral, so
  that I can execute the PATCH release (version bump, CHANGELOG, adapter
  stamps, `agc check`, tag/release) without re-litigating closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.2.0`, when
  `git diff --name-only v4.2.0..HEAD` is inspected, then it touches no
  `package.json`, `tsconfig*`, or `.github/` file; every commit that is not
  comment-only, content-wording-only or bookkeeping (backlog, queue, lane
  close) maps to E233 or E241; and the `index.ts` diff is the single comment
  line.
  proof: `git diff --name-only v4.2.0..HEAD`, `git log --oneline v4.2.0..HEAD`,
  `git diff v4.2.0..HEAD -- index.ts`.

- **AC2** — Given the six lanes e233a-e233f, when each lane's evidence is
  inspected on the committed main tree (including archive subdirectories),
  then for each lane a code-reviewer APPROVED file exists in
  `review_reports/` and a qa PASS record exists in `qa_reports/`, and
  `.current/history/2026-09/e233<lane>/handoff.md` reads `status: "PASS"` and
  `last_agent: "qa-engineer"`.
  proof: `grep -n -i verdict` on each evidence file; `grep -E
  '^(status|last_agent):' .current/history/2026-09/e233<lane>/handoff.md`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs,
  then it exits 0 with zero failures (expect about 2958 total / 2955 pass / 3
  skipped). `test/teamwork-lite.test.mjs` AC3b is flaky on the live-hook
  marker (backlog E257): a red there with a fresh session marker is rerun
  after the marker ages and is not a failure of this gate.
  proof: `npm test` (exit 0; report the printed pass/fail tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt from
  clean, then the committed `dist/` is byte-identical to a fresh build and
  `scripts/check-version.mjs` passes.
  proof: `npm run build && git status --porcelain dist/` (expect empty
  output) and `node scripts/check-version.mjs` (exit 0).

- **AC5** — Given at least three source files from different directories
  (for example `tools/`, `gates/`, `bin/` or `scripts/`), when v4.2.0 and HEAD
  are each transpiled with comments removed, then the output is
  byte-identical; the budget caps in `test/context-budget.test.mjs` are
  unchanged versus v4.2.0; and the `content/` diffs are wording-only (no
  rule, tag or table change).
  proof: per-file transpile comparison with `removeComments`; `git diff
  v4.2.0..HEAD -- test/context-budget.test.mjs`; `git diff v4.2.0..HEAD --
  content/` reviewed for wording-only changes.

- **AC6** — Given the `v4.2.0` shipped behavior, when the current tree is
  checked, then it is unregressed: the E234 information-hygiene scan in
  `agc check` and the E250/E251 `agc eject` path-display tests pass, and the
  `release-v4.2.0` closure record (tag `v4.2.0`) is intact.
  proof: run the E234 and E250/E251 tests; `git tag -l v4.2.0`;
  `grep -n '\[4.2.0\]' CHANGELOG.md`.

QA writes PASS only if all of AC1-AC6 hold.

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
- **Version bump** (4.2.0 to 4.2.1, PATCH), **CHANGELOG entry**, **three
  adapter stamps**, **`agc check`**, **push, tag and release** are
  release-engineer's SOP and are not verified or executed here.
- **Leak rule (carries forward)**: the commit email used for release commits
  and the tag must come from `.git/config` and be a noreply address; the
  CHANGELOG entry, release notes and tag message must contain no local paths,
  no usernames, and no adopter or customer names. This spec likewise contains
  none.
- No doc-writer follow-up is cut here.

## Dependencies / Prerequisites
- `release-v4.2.0` is released (tag `v4.2.0`); its feature lease is stale.
  This ticket starts a new `active_feature` (`release-v4.2.1`).
- The QA PASS of T-REL421-01..03 is release-engineer's precondition for the
  PATCH release.
- No `design/release-v4.2.1.md` exists; `## Mode` is not armed, non-visual
  feature.
- No external references: Resource Audit Gate found zero hits, field omitted.
- Dispatch shape: single-feature evidence-only gate (see `scope_decision_why`
  in the handoff state). This spec was authored after the release commit
  (as a follow-up commit, never an amend) to give release-engineer's
  post-commit sanity check a spec to classify against.

## Task Format
- [x] T-REL421-01 [P0] qa-engineer: verify AC1 + AC2 (diff scope and per-lane evidence) | depends_on: none
- [x] T-REL421-02 [P0] qa-engineer: verify AC3 + AC4 (full suite, clean build, version check) | depends_on: none
- [x] T-REL421-03 [P0] qa-engineer: verify AC5 + AC6 (behavior-neutral check, v4.2.0 non-regression) | depends_on: none
