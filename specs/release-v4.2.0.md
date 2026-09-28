# release-v4.2.0

## Problem Statement
`main` @ `c5c7c30` contains two lane features merged since the `v4.1.0` tag
(`f37a04c`): E234 (`agc check` gains an advisory information-hygiene scan;
exit code unchanged) and E250+E251 (`agc eject` path display uses visible
escaping; `docs/config.md`'s env-var table gains a row). Both lanes carry
their own qa PASS + code-review APPROVED evidence and a closed
`status:"PASS"` lane handoff under `.current/history/2026-09/`, but no one
has verified that evidence still stands on the *committed main tree as a
whole* — a single missing file, a stale verdict, or a red full-suite run
would silently invalidate the MINOR cut. This is an evidence-only release
gate, the same shape as `release-v4.1.0`'s AC1-AC4: no new code is written
here.

## User Stories
- As release-engineer, I want a QA PASS confirming both lanes' evidence is
  present and green on main, so that I can execute the MINOR release
  (version bump, CHANGELOG `[Unreleased]` entry, adapter stamps, `agc check`,
  tag/release) without re-litigating already-closed lane work.

## Acceptance Criteria

- **AC1** — Given the two lanes merged to main since `v4.1.0` (E234
  `433552a`, E250+E251 `9040860`), when each lane's declared evidence files
  are inspected on the committed main tree, then every task id below
  resolves to a `qa_reports/` file whose verdict reads `PASS` and a
  `review_reports/` file whose verdict reads `APPROVED`.

  | lane | merge commit | task ids | qa evidence (verdict) | code-review evidence (verdict) |
  |---|---|---|---|---|
  | e234 | `433552a` | T-E234-01, T-E234-02, T-E234-03, T-E234-04, T-E234-05 | `qa_reports/review_T-E234-05.md` (PASS, covers T-E234-01..05) | `review_reports/review_T-E234-01.md` (round 3 APPROVED, covers T-E234-01..04) |
  | e250 | `9040860` | T-E250-01, T-E250-02, T-E250-03, T-E250-04, T-E250-05, T-E250-06 | `qa_reports/review_T-E250-06.md` (PASS, covers T-E250-01..06) | `review_reports/review_T-E250-01.md` (round 1 APPROVED, covers T-E250-01..05) |

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

- **AC4** — Given that `release-v4.1.0` shipped no deferred/follow-up items
  of its own (its spec's Out of Scope explicitly declined to open new
  doc-writer scope), when the current tree is checked, then the two
  behaviors it shipped are still present and unregressed, and `v4.1.0`'s own
  release-closure record still reads closed:
  (a) `docs/install.md` still describes the wider unsafe-path character
  class refusal (backslash / control character, including the visible-escape
  display for `agc eject` paths) — not reverted.
  (b) `specs/e177a-fanout-manifest.md` still records the primary-relative
  `mailbox:` header semantics and the `MAILBOX_TILDE` error code — not
  reverted.
  (c) `CHANGELOG.md` still carries the `[4.1.0]` entry, and the evidence
  archived at release time is still present at
  `qa_reports/archive/release-v4.1.0/` and
  `review_reports/archive/release-v4.1.0/`.
  proof: `grep -n -i 'backslash\|control character' docs/install.md`
  (non-empty); `grep -n -i 'MAILBOX_TILDE' specs/e177a-fanout-manifest.md`
  (non-empty); `grep -n '\[4.1.0\]' CHANGELOG.md` (non-empty) and `ls
  qa_reports/archive/release-v4.1.0/ review_reports/archive/release-v4.1.0/`
  (both non-empty).

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
  `#v` pin — 4.1.0 → 4.2.0, MINOR), **CHANGELOG.md `[Unreleased]` entry**
  (must name the two lanes' user-visible behavior — the `agc check`
  information-hygiene advisory scan and the `agc eject` visible-escaping
  path display — per the Wave/dispatch-card convention prior releases
  used), **three adapter stamps**, **`agc check`**, and **tag/release** (the
  three-timepoint `verify-release` SOP per `content/skill-release-engineer.md`)
  — all release-engineer's SOP, dispatched only after this ticket's QA PASS.
  Not verified or executed here.
  - **Leak rule (human decision, carries forward from E231/E232/E235)**:
    the commit `user.email` used for the release commit(s) and tag must come
    from `.git/config` and be a noreply address; the CHANGELOG entry, any
    release notes, and the tag message must contain no local paths, no
    usernames, and no adopter/customer names.
  - **Information-hygiene rule (new, this release's own subject matter)**:
    this spec's own text must not contain concrete local paths, usernames,
    or the E234 scan's keyword-list contents beyond what the repo already
    documents publicly (`docs/install.md`, `docs/config.md`) — the release
    gate for a feature that scans for exactly this class of leak must not
    itself leak it.
- No `docs/schema-versions.md` or other doc-writer follow-up is cut here —
  AC4 only verifies the *prior* release's shipped behavior is unregressed;
  it does not open new doc-writer scope for E234/E250/E251 (neither lane's
  spec left a deferred doc item).

## Dependencies / Prerequisites
- `release-v4.1.0` is released (tag `v4.1.0`, commit `f37a04c`); its feature
  lease is stale. This ticket starts a new `active_feature`
  (`release-v4.2.0`) superseding it.
- This ticket's QA PASS is release-engineer's precondition for the MINOR
  release, same dependency shape as `release-v4.1.0`.
- No `design/release-v4.2.0.md` exists; `## Mode` is not armed — non-visual
  feature, Visual Structural Assertions section omitted per the Spec Schema.
- No external references (URLs, Figma, tickets) appear in this assignment
  beyond in-repo evidence already cited above — Resource Audit Gate: zero
  hits, field omitted.
- All other commits in `v4.1.0..HEAD` (`docs(queue)`, `chore(lanes)`,
  `chore(backlog)`, `chore(integ)`, `docs(fanout)`, `chore(governance)`) were
  independently checked via `git show --stat` against the committed tree and
  confirmed non-code-bearing (docs/backlog/queue/manifest/lane-state files
  only) — no other code-bearing commits exist in range.

## Task Format
- [ ] T-REL42-01 [P0] qa-engineer: verify AC1 evidence table + AC4 follow-up-regression checks on the committed main tree (evidence-only gate, no code changes) | depends_on: none
- [ ] T-REL42-02 [P0] qa-engineer: verify AC2 (full suite green) + AC3 (clean build, no `dist/` diff) | depends_on: none
