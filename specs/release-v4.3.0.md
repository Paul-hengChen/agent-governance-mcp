# release-v4.3.0

## Problem Statement
`main` @ `7839cd8` contains one code-bearing change set since the `v4.2.1`
tag (`c76470b`): E258 (comment discipline), merged as two lanes through
`integ/e258`. Lane e258a added the constitution section 6 *Comment discipline*
bullet in `content/const-15-core-tail.md`, code-reviewer SOP step 4b in
`content/skill-code-reviewer.md`, regenerated the compose goldens and raised
four context-budget ceilings in `test/context-budget.test.mjs` to measured
values. Lane e258b added the advisory, diff-scoped `agc check` comment scan
(`tools/comment-scan.ts` and its `dist/` output, wiring in `bin/agc-init.mjs`,
notes in `docs/install.md` and `docs/config.md`). The rest of the range is
bookkeeping (backlog, queue, fan-out manifest, lane close, E257/E258/E259
filings, post-release notes). The release is MINOR because the constitution
gained a normative rule and `agc check` gained a new user-visible advisory
check. Each lane carries its own qa PASS and code-review evidence, but no one
has verified that evidence still stands on the committed main tree as a whole.
This is an evidence-only MINOR release gate, the same shape as
`release-v4.2.1` and `release-v4.2.0`: no new code is written here. Plan and
close box: `specs/fanout-e258.md`.

## User Stories
- As release-engineer, I want a QA PASS confirming the E258 lane evidence is
  present and green on main and that v4.2.1 shipped behavior is unregressed,
  so that I can execute the MINOR release (version bump, CHANGELOG, adapter
  stamps, `agc check`, tag/release) without re-litigating closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.2.1`, when
  `git diff --name-only v4.2.1..HEAD` is inspected, then it touches no
  `package.json`, `tsconfig*`, or `.github/` file; the non-bookkeeping paths
  are exactly the E258 set (`bin/agc-init.mjs`, `content/const-15-core-tail.md`,
  `content/skill-code-reviewer.md`, `tools/comment-scan.ts`,
  `dist/tools/comment-scan.*`, `docs/install.md`, `docs/config.md`,
  `test/context-budget.test.mjs`, `test/e258*`, `test/fixtures/**`, `specs/e258*`,
  `specs/fanout-e258.md`); and every commit not in that set is bookkeeping
  (backlog, queue, manifest, lane close, evidence, post-release notes).
  proof: `git diff --name-only v4.2.1..HEAD`, `git log --oneline v4.2.1..HEAD`,
  `git diff --stat v4.2.1..HEAD -- . ':!.current' ':!qa_reports' ':!review_reports'`.

- **AC2** — Given the two lanes e258a and e258b, when their evidence is
  inspected on the committed main tree (including archive subdirectories),
  then: `review_reports/review_T-E258A-01.md` and
  `review_reports/review_T-E258B-01.md` read APPROVED;
  `qa_reports/review_T-E258A-01..03.md` and `qa_reports/review_T-E258B-01..05.md`
  exist and record PASS; `review_reports/review_integ-e258-comments.md` records
  CHANGES_REQUESTED with one send-back (e258a test header) and that send-back
  is closed by T-E258A-03 (commit `a00926a`, test header trimmed in `bd233e8`);
  and `.current/history/2026-09/e258a/handoff.md` and
  `.current/history/2026-09/e258b/handoff.md` read `status: "PASS"` and
  `last_agent: "qa-engineer"`. The recorded `git commit --amend` exception
  (`specs/fanout-e258.md` Decisions) is noted, not a failure.
  proof: `grep -n -i verdict` on each evidence file; `grep -E
  '^(status|last_agent):' .current/history/2026-09/e258{a,b}/handoff.md`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs,
  then it exits 0 with zero failures (expect about 2998 total / 2995 pass / 3
  skipped per the fan-out close box). `test/teamwork-lite.test.mjs` AC3b is
  flaky on the live-hook marker (backlog E257): a red there with a fresh
  session marker is rerun after the marker ages and is not a failure of this
  gate.
  proof: `npm test` (exit 0; report the printed pass/fail tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt from
  clean, then the committed `dist/` (including `dist/tools/comment-scan.*`) is
  byte-identical to a fresh build and `scripts/check-version.mjs` passes.
  proof: `npm run build && git status --porcelain dist/` (expect empty
  output) and `node scripts/check-version.mjs` (exit 0).

- **AC5** — Given the new comment scan, when it is spot-checked in the primary
  workspace, then: (a) a temporary uncommitted change adding an 8-line comment
  block to a tracked `.ts` file makes `agc check` print at least one line
  starting `agc check — comments` and the exit code is unchanged versus the
  clean tree; (b) a block of 7 lines or fewer, and JSDoc tag lines
  (`@param`, `@returns`), do not warn; (c) the clean tree prints no
  `agc check — comments` line; (d) the line prefix in
  `content/skill-code-reviewer.md` matches the scan's output prefix; (e) the
  temporary change is reverted and `git status --porcelain` is empty
  afterwards. Also, the constitution bullet is present in the composed output
  of every dispatch mode (the compose goldens contain it), and the four raised
  ceilings in `test/context-budget.test.mjs` equal the measured values (the
  budget test passes).
  proof: temporary edit plus `node bin/agc-init.mjs check; echo "exit=$?"` on
  clean and edited trees; `grep -n 'agc check — comments'
  content/skill-code-reviewer.md tools/comment-scan.ts`; `grep -c
  'Comment discipline' test/fixtures/compose-golden/*.txt`; `node --test
  test/context-budget.test.mjs test/e258a-comment-rule.test.mjs
  test/e258b-comment-scan.test.mjs`.

- **AC6** — Given the `v4.2.1` shipped behavior, when the current tree is
  checked, then it is unregressed: the E234 information-hygiene scan in
  `agc check` (existing `agc check — hygiene` output) and the E250/E251
  `agc eject` path-display tests pass; the E233 comment-only rewrite is intact
  (no ticket ids reintroduced by E258 in changed comments); and the
  `release-v4.2.1` closure record (tag `v4.2.1` at `c76470b`) is intact.
  proof: run the E234 and E250/E251 tests; `git tag -l v4.2.1`;
  `git rev-parse v4.2.1^{commit}` (expect `c76470b`); `grep -n '\[4.2.1\]'
  CHANGELOG.md`.

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
- **Version bump** (4.2.1 to 4.3.0, MINOR), **CHANGELOG entry**, **three
  adapter stamps**, **`agc check` stamp comparison**, **push, tag and
  release** are release-engineer's SOP and are not verified or executed here.
- **Leak rule (carries forward)**: the commit email used for release commits
  and the tag must come from `.git/config` and be a noreply address; the
  CHANGELOG entry, release notes and tag message must contain no local paths,
  no usernames, and no adopter or customer names. This spec likewise contains
  none.
- No doc-writer follow-up is cut here. Function-interior comment detection and
  non-JS/TS languages for the scan are separate later tickets, not verified.

## Dependencies / Prerequisites
- `release-v4.2.1` is released (tag `v4.2.1`); its feature lease is stale.
  This ticket starts a new `active_feature` (`release-v4.3.0`).
- The QA PASS of T-REL430-01..03 is release-engineer's precondition for the
  MINOR release.
- No `design/release-v4.3.0.md` exists; `## Mode` is not armed, non-visual
  feature.
- No external references: Resource Audit Gate found zero hits, field omitted.
- Known advisory: `T-REL4-02` drift note is ignored per the human's standing
  instruction.

## Task Format
- [ ] T-REL430-01 [P0] qa-engineer: verify AC1 + AC2 (diff scope and per-lane evidence) | depends_on: none
- [ ] T-REL430-02 [P0] qa-engineer: verify AC3 + AC4 (full suite, clean build, version check) | depends_on: none
- [ ] T-REL430-03 [P0] qa-engineer: verify AC5 + AC6 (comment-scan spot-check, v4.2.1 non-regression) | depends_on: none
