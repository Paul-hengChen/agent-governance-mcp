# release-v4.4.0

## Problem Statement
`main` @ `80073bf` contains two code-bearing change sets since the `v4.3.0`
tag (`71afb53`, tag object `5d5424d`): E246 (lane e246) and E259 (lane e259),
merged through `integ/e246-e259`. E246 made `agc feature finish` remove the
lane's default-location integrator mailbox (`bin/agc-init.mjs`,
`content/skill-integrator.md`, `docs/lane-protocol.md`, `test/e246-*`). E259
extended the advisory `agc check` comment-length scan from five extensions to
26 via per-language lexer tables (`tools/comment-*.ts` and
`dist/tools/comment-*`, `docs/install.md`, `docs/config.md`, `test/e259-*`,
`test/fixtures/e259/**`, plus two reassigned assertions in
`test/e258b-comment-scan.test.mjs`). The rest of the range is bookkeeping
(backlog, queue, manifest, lane close, E260/E261 filings, and the integrator's
`docs/install.md` mailbox sentence in commit `327c8f9`). The release is MINOR
because `agc check` now covers new languages (user-visible) and
`agc feature finish` gained new behaviour. Each lane carries its own review
and QA evidence, but no one has verified that evidence still stands on the
committed main tree as a whole. This is an evidence-only MINOR release gate,
the same shape as `release-v4.3.0`: no new code is written here. Plan and
close box: `specs/fanout-e246-e259.md`.

## User Stories
- As release-engineer, I want a QA PASS confirming the E246 and E259 lane
  evidence is present and green on main and that v4.3.0 shipped behavior is
  unregressed, so that I can execute the MINOR release (version bump,
  CHANGELOG, adapter stamps, `agc check`, tag/release) without re-litigating
  closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.3.0`, when
  `git diff --name-only v4.3.0..HEAD` is inspected, then it touches no
  `package.json`, `tsconfig*`, or `.github/` file; the non-bookkeeping paths
  are exactly the E246 set (`bin/agc-init.mjs`, `content/skill-integrator.md`,
  `docs/lane-protocol.md`, `test/e246-*`, `specs/e246-*`) and the E259 set
  (`tools/comment-*.ts`, `dist/tools/comment-*`, `docs/install.md`,
  `docs/config.md`, `test/e259-*`, `test/fixtures/e259/**`,
  `test/e258b-comment-scan.test.mjs` with only the two reassigned assertions,
  `specs/e259-*`); `specs/fanout-e246-e259.md` is the plan; and every commit
  not in those sets is bookkeeping (backlog, queue, manifest, lane close,
  evidence, E260/E261 filings, the `327c8f9` install.md mailbox sentence).
  No file under `content/` other than `content/skill-integrator.md` changed.
  proof: `git diff --name-only v4.3.0..HEAD`, `git log --oneline v4.3.0..HEAD`,
  `git diff --stat v4.3.0..HEAD -- . ':!.current' ':!qa_reports' ':!review_reports'`,
  `git diff --name-only v4.3.0..HEAD -- package.json 'tsconfig*' .github content`.

- **AC2** — Given the two lanes e246 and e259, when their evidence is
  inspected on the committed main tree (including archive subdirectories),
  then: `review_reports/review_T-E246-01.md`, `review_T-E246-02.md` and
  `review_T-E259-01.md` read APPROVED; `qa_reports/review_T-E246-01..02.md`
  and `qa_reports/review_T-E259-01..09.md` exist and record PASS; and
  `.current/history/2026-09/e246/handoff.md` and
  `.current/history/2026-09/e259/handoff.md` read `status: "PASS"` and
  `last_agent: "qa-engineer"`. Known quirk, noted and not a failure: the e246
  lane handoff `completed_tasks` is empty although T-E246-01 and T-E246-02
  have PASS evidence on disk (E150 class, recorded in the `specs/fanout-e246-e259.md`
  close box). The one integrator send-back on e246 (24-line test header,
  closed by T-E246-02, commits `24e332f` and `dd6c119`) is noted.
  proof: `grep -n -i verdict` on each evidence file; `grep -E
  '^(status|last_agent):' .current/history/2026-09/e246/handoff.md
  .current/history/2026-09/e259/handoff.md`; `ls qa_reports | grep -E 'E246|E259'`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs,
  then it exits 0 with zero failures (expect about 3043 total / 3040 pass / 3
  skipped per the fan-out close box). `test/teamwork-lite.test.mjs` AC3b is
  flaky on the live-hook marker (backlog E257): a red there with a fresh
  session marker is rerun after the marker ages and is not a failure of this
  gate.
  proof: `npm test` (exit 0; report the printed pass/fail tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt from
  clean, then the committed `dist/` (including `dist/tools/comment-*`) is
  byte-identical to a fresh build and `scripts/check-version.mjs` passes.
  proof: `npm run build && git status --porcelain dist/` (expect empty
  output) and `node scripts/check-version.mjs` (exit 0).

- **AC5** — Given the extended comment scan, when it is spot-checked in the
  primary workspace, then: (a) a temporary uncommitted 8-line comment block in
  each of a `.py` file and a `.rs` file makes `agc check` print one line
  starting `agc check — comments` per file, with the exit code unchanged
  versus the clean tree; (b) a block of 7 lines or fewer does not warn, and a
  `.yml` or `.json` file with a long `#`-style block is skipped; (c) the clean
  tree prints no `agc check — comments` line; (d) the summary line names the
  scanned extensions; (e) the temporary files are removed and
  `git status --porcelain` is empty afterwards.
  proof: temporary files plus `node bin/agc-init.mjs check; echo "exit=$?"` on
  clean and edited trees; `node --test test/e259-comment-scan-brace.test.mjs
  test/e259-comment-scan-hash.test.mjs test/e259-comment-scan-limits.test.mjs
  test/e258b-comment-scan.test.mjs`.

- **AC6** — Given the E246 behaviour, when the tests and a scratch check are
  run, then `agc feature finish` (both `--shipped` and `--abandoned`) removes
  `<worktree parent>/_mailbox/<lane>/` when it holds only `to-integrator.md`,
  `to-lane.md` and dead-watch lock files; keeps it with one warning line
  otherwise (exit code unchanged); prints nothing when no mailbox exists; and
  `content/skill-integrator.md` and `docs/install.md` describe it.
  proof: `node --test test/e246-mailbox-teardown.test.mjs
  test/e178a-integrator-role.test.mjs`; `grep -n 'mailbox'
  content/skill-integrator.md docs/install.md`.

- **AC7** — Given the `v4.3.0` shipped behavior, when the current tree is
  checked, then it is unregressed: the E258 comment rule is intact (the
  compose goldens still contain `Comment discipline` and the budget test
  passes); the E234 hygiene scan and the E250/E251 `agc eject` tests pass;
  and the `release-v4.3.0` closure record (tag `v4.3.0`) is intact.
  proof: `grep -c 'Comment discipline' test/fixtures/compose-golden/*.txt`;
  `node --test test/context-budget.test.mjs test/e258a-comment-rule.test.mjs`;
  run the E234 and E250/E251 tests; `git tag -l v4.3.0`;
  `git rev-parse v4.3.0^{commit}` (expect `71afb53`); `grep -n '\[4.3.0\]'
  CHANGELOG.md`.

QA writes PASS only if all of AC1-AC7 hold.

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
- **Version bump** (4.3.0 to 4.4.0, MINOR), **CHANGELOG entry**, **three
  adapter stamps**, **`agc check` stamp comparison**, **push, tag and
  release** are release-engineer's SOP and are not verified or executed here.
- **Leak rule (carries forward)**: the commit email used for release commits
  and the tag must come from `.git/config` and be a noreply address; the
  CHANGELOG entry, release notes and tag message must contain no local paths,
  no usernames, and no adopter or customer names. This spec likewise contains
  none.
- No doc-writer follow-up is cut here. E260 (trim existing long comments) and
  E261 (shell backslash-escaped quote under-flag) are filed backlog items, not
  verified or fixed by this gate.

## Dependencies / Prerequisites
- `release-v4.3.0` is released (tag `v4.3.0`); its feature lease is stale.
  This ticket starts a new `active_feature` (`release-v4.4.0`).
- The QA PASS of T-REL440-01..03 is release-engineer's precondition for the
  MINOR release.
- No `design/release-v4.4.0.md` exists; `## Mode` is not armed, non-visual
  feature.
- No external references: Resource Audit Gate found zero hits, field omitted.
- Known advisory: `T-REL4-02` drift note is ignored per the human's standing
  instruction.

## Task Format
- [ ] T-REL440-01 [P0] qa-engineer: verify AC1 + AC2 (diff scope and per-lane evidence, e246 empty-ledger quirk noted) | depends_on: none
- [ ] T-REL440-02 [P0] qa-engineer: verify AC3 + AC4 (full suite, clean build, version check) | depends_on: none
- [ ] T-REL440-03 [P0] qa-engineer: verify AC5 + AC6 + AC7 (extended-scan spot-check, finish mailbox teardown, v4.3.0 non-regression) | depends_on: none
