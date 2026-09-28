# release-v4.1.0

## Problem Statement
`main` @ `11084c8` contains two lane features merged since the `v4.0.0` tag
(`0bca302`): E243 (local mode refuses backslash/control-char workspace path
segments) and E248 (a relative `mailbox:` fan-out header now resolves against
primary). Both lanes carry their own qa PASS + code-review APPROVED evidence
and a closed `status:"PASS"` lane handoff under `.current/history/2026-09/`,
but no one has verified that evidence still stands on the *committed main
tree as a whole* — a single missing file, a stale verdict, or a red
full-suite run would silently invalidate the MINOR cut. This is an
evidence-only release gate, the same shape as `release-v4.0.0`'s original
AC1-AC4 (the evidence-verification ACs, not that ticket's later CI
`fetch-depth` amendment, AC5, which was a separate code-bearing fix): no new
code is written here.

## User Stories
- As release-engineer, I want a QA PASS confirming both lanes' evidence is
  present and green on main, so that I can execute the MINOR release
  (version bump, CHANGELOG `[Unreleased]` entry, adapter stamps, `agc check`,
  tag/release) without re-litigating already-closed lane work.

## Acceptance Criteria

- **AC1** — Given the two lanes merged to main since `v4.0.0` (E243
  `b58d649`, E248 `e4a0ef2`), when each lane's declared evidence files are
  inspected on the committed main tree, then every task id below resolves to
  a `qa_reports/` file whose verdict reads `PASS` and a `review_reports/`
  file whose verdict reads `APPROVED`.

  | lane | merge commit | task ids | qa evidence (verdict) | code-review evidence (verdict) |
  |---|---|---|---|---|
  | e243 | `b58d649` | T-E243-03, T-E243-04 | `qa_reports/review_T-E243-03.md` (PASS), `qa_reports/review_T-E243-04.md` (PASS) | `review_reports/review_T-E243-03.md` (APPROVED) |
  | e248 | `e4a0ef2` | T-E248-01, T-E248-02 | `qa_reports/review_T-E248-01.md` (PASS), `qa_reports/review_T-E248-02.md` (PASS) | `review_reports/review_T-E248-01.md` (APPROVED) |

  Also confirm each lane's `.current/history/2026-09/<lane>/handoff.md`
  records `status: "PASS"` / `last_agent: "qa-engineer"`.

  proof: for each row above, `grep -n -i verdict <qa_reports path>` shows
  `PASS` and `grep -n -i verdict <review_reports path>` shows `APPROVED` in
  its last `## Verdict` section; and `grep -E '^(status|last_agent):'
  .current/history/2026-09/<lane>/handoff.md` shows `status: "PASS"` /
  `last_agent: "qa-engineer"`.

- **AC2** — Given the committed main tree at HEAD, when the full test suite
  runs, then it exits 0 with zero failures.
  proof: `npm test` (exit 0; report the printed pass/fail tally).

- **AC3** — Given the committed main tree at HEAD, when the project is
  rebuilt, then the committed `dist/` is byte-identical to a fresh build.
  proof: `npm run build && git status --porcelain dist/` (expect empty
  output, exit 0).

- **AC4** — Given that `release-v4.0.0` shipped two deferred/follow-up items
  alongside its own evidence-verification ACs — the doc-writer task
  (T-REL4-02, `docs/schema-versions.md`) and the CI-red fix (T-REL4-03/05,
  `.github/workflows/ci.yml` `fetch-depth: 0`) — when the current tree is
  checked, then both are still present and unregressed, and `v4.0.0`'s own
  release-closure record still reads closed:
  (a) `docs/schema-versions.md` still carries the E125a lane-ledger
  narrative (the `tasks_role` index notice, the `_primary` forward
  migration, the `tasks-index-receipt.json` receipt file, the
  git-ignored-lane exception) — not reverted.
  (b) `.github/workflows/ci.yml`'s `actions/checkout@v4` step still carries
  `fetch-depth: 0` — the CI-red fix has not regressed.
  (c) `docs/v4.0.0-execution-plan.md` §9's final checklist item ("全套測試
  綠、`agc check` OK、`verify-release` 六項全過") reads `[x]`, confirming
  `v4.0.0` closed cleanly — the baseline this ticket's scope assumes.
  proof: `grep -n -i 'tasks_role\|_primary\|tasks-index-receipt' docs/schema-versions.md`
  (non-empty); `grep -n -A2 'checkout@v4' .github/workflows/ci.yml` shows
  `fetch-depth: 0`; `sed -n '1269p' docs/v4.0.0-execution-plan.md` shows a
  `[x]` line.

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
  `#v` pin — 4.0.0 → 4.1.0, MINOR), **CHANGELOG.md `[Unreleased]` entry**
  (must name the two lanes' user-visible behavior — the local-mode path
  refusal and the relative `mailbox:` header — per the Wave/dispatch-card
  convention `release-v4.0.0` used), **three adapter stamps**, **`agc
  check`**, and **tag/release** (the three-timepoint `verify-release` SOP
  per `content/skill-release-engineer.md`) — all release-engineer's SOP,
  dispatched only after this ticket's QA PASS. Not verified or executed
  here.
  - **Leak rule (human decision, carries forward from E231/E232/E235)**:
    the commit `user.email` used for the release commit(s) and tag must come
    from `.git/config` and be a noreply address; the CHANGELOG entry, any
    release notes, and the tag message must contain no local paths, no
    usernames, and no adopter/customer names.
- No `docs/schema-versions.md` or other doc-writer follow-up is cut here —
  AC4 only verifies the *prior* release's follow-up items are unregressed;
  it does not open new doc-writer scope for E243/E248 (neither lane's spec
  left an equivalent deferred doc item).

## Dependencies / Prerequisites
- `release-v4.0.0` is released (tag `v4.0.0`, commit `0bca302`); its feature
  lease is stale. This ticket starts a new `active_feature`
  (`release-v4.1.0`) superseding it.
- This ticket's QA PASS is release-engineer's precondition for the MINOR
  release, same dependency shape as `release-v4.0.0`.
- No `design/release-v4.1.0.md` exists; `## Mode` is not armed — non-visual
  feature, Visual Structural Assertions section omitted per the Spec Schema.
- No external references (URLs, Figma, tickets) appear in this assignment
  beyond in-repo evidence already cited above — Resource Audit Gate: zero
  hits, field omitted.

## Task Format
- [ ] T-REL41-01 [P0] qa-engineer: verify AC1 evidence table + AC4 follow-up-regression checks on the committed main tree (evidence-only gate, no code changes) | depends_on: none
- [ ] T-REL41-02 [P0] qa-engineer: verify AC2 (full suite green) + AC3 (clean build, no `dist/` diff) | depends_on: none
