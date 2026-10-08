# release-v4.5.0

## Problem Statement
`main` @ `16b2718` (working tree clean except the human's untracked
`docs/integrator-session-per-wave-2026-10-07.md`, which is not part of this
release) is 71 commits past the `v4.4.1` tag (`76b9c11`, `package.json`
4.4.1). The change set is the fan-out wave in `specs/fanout-e260-followups.md`
(lanes e275, e269, e264, e268; plan, merge shas and measurements in its Decisions and
close sections) plus bookkeeping. Unlike the v4.4.x PATCH gates it is not
comment-only. It carries (1) a dependency upgrade (E275): `package.json`
`@modelcontextprotocol/sdk` `^1.29.0` to `^1.32.1` and `sharp` `^0.35.4` to
`^0.35.5`, with `package-lock.json` also moving the transitive `proxy-addr`
2.0.7 to 2.0.8 (critical advisory), closing three HIGH/CRITICAL `npm audit`
findings (disposition in `docs/dependency-advisories.md`); and (2) a rule
change in the shipped governance content (E269): `content/const-15-core-tail.md`
(constitution §6) now lists `git stash drop` and `git stash clear` as FORBIDDEN;
`content/skill-code-reviewer.md` and `content/skill-qa-engineer.md` each gain a
negative-control line (use a copy outside the worktree, never `git stash`);
`content/skill-release-engineer.md` swaps line-number references for step/flag
names (E256, E265); the four context-budget ceilings in
`test/context-budget.test.mjs` each rise 19 ~tok (5548 to 5567, 10057 to 10076,
20434 to 20453, 7959 to 7978; human-approved 2026-10-08) and 11
`test/fixtures/compose-golden/*` files are regenerated. The rest is
comment, test-title or expectation-table text (E264 four `tools/` comments with
rebuilt `dist/tools/{lane-migrate,lane-paths,merge-invariants,telemetry}`;
E268/E270-E274 test files; E267 a dated correction paragraph in
`specs/d6-host-capability-compose-axis-architecture.md`). Evidence supports a
MINOR bump (dependency upgrades plus constitution/SOP rule changes that change
what agents receive in every bundle), final bump is release-engineer's call.
No one has yet verified that the four lanes' evidence still stands on the
committed main tree as a whole. This is an evidence-only release gate: no new
code is written here.

## User Stories
- As release-engineer, I want a QA PASS confirming the lane evidence is present
  and green on main, the advisories are closed, and the stash rule is composed
  into the role bundles, so that I can execute the release (version bump,
  CHANGELOG, adapter stamps, `agc check`, tag/release) without re-litigating
  closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.4.1`, when
  `git diff --name-only v4.4.1..HEAD` is inspected, then `package.json` and
  `package-lock.json` are touched (E275 only: sdk, sharp in `package.json`;
  lockfile covers sdk, proxy-addr, sharp and their transitive moves),
  `tsconfig*` and `.github/` are not touched, and every path falls in one of:
  E275 (`package*.json`, `docs/dependency-advisories.md`, `specs/e275-*`),
  E269 (`content/const-15-core-tail.md`, `content/skill-{code-reviewer,qa-engineer,release-engineer}.md`,
  `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**`,
  `test/e269-budget-title-sync.test.mjs`, `specs/e269-*`), E264 (`tools/{lane-migrate,lane-paths,merge-invariants,telemetry}.ts`
  with their `dist/tools/**` outputs, `specs/e264-*`), E268 (test files
  `drift-skew`, `agc-adapters`, `e22-stale-notify`, `gates-expected-red`,
  `e92-e86-handoff-write-boundary`, `lane-ticket-allocation`,
  `pixel-gate-attestation`, `qa-flow`, `subagent-templates`; `specs/e268-*`,
  `specs/e260e-*`, `specs/e260g-*`), E267 (`specs/d6-host-capability-compose-axis-architecture.md`),
  or bookkeeping (`docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `tasks.md`,
  `.current/**`, `qa_reports/`, `review_reports/`, `specs/fanout-e260-followups.md`).
  No `bin/`, `scripts/`, `gates/`, `prompts/`, `schema/`, `guards/`,
  `transport/`, `lib/`, `index.ts` path appears.
  proof: `git diff --name-only v4.4.1..HEAD`; `git log --oneline v4.4.1..HEAD`;
  `git diff --name-only v4.4.1..HEAD -- tsconfig.json .github bin scripts gates prompts schema guards transport lib index.ts` (expect empty);
  `git diff v4.4.1..HEAD -- package.json` (expect exactly the sdk and sharp lines).

- **AC2** — Given the four lanes e275, e269, e264, e268, when each lane's
  evidence is inspected on the committed main tree, then each has a
  code-reviewer APPROVED file in `review_reports/`, a qa PASS record in
  `qa_reports/` for every task, and
  `.current/history/2026-10/<lane>/handoff.md` reads `status: "PASS"` and
  `last_agent: "qa-engineer"`. Features: e275 `e275-advisory-upgrades`
  (T-E275-01, 02), e269 `e269-rule-text-budget` (T-E269-01..07), e264
  `e264-tools-comment-accuracy` (T-E264-01, 02), e268
  `e268-test-comment-accuracy` (T-E268-01..06). Review files:
  `review_reports/review_T-E275-01.md`, `review_T-E269-01.md`,
  `review_T-E269-06.md`, `review_T-E264-01.md`, `review_T-E268-01.md`; QA
  files `qa_reports/review_T-<id>.md` per task (plus
  `qa_reports/proof_E268_authoring.md`, `verify_E268_T-E268-06.md`,
  `authoring_T-E269-05.md`, `expected-red_e269-rule-text-budget.txt`). Known
  quirk, not a failure: `review_T-E269-01.md` records Round 1
  CHANGES_REQUESTED (missing expected-red list) closed by a later APPROVED;
  the latest verdict on each file governs. Lane close counts per
  `specs/fanout-e260-followups.md`: e275 hop 4, e269 hop 9, e264 hop 4, e268 hop 5.
  proof: `grep -n -i -E 'verdict|round' review_reports/*E{275,269,264,268}*`;
  `grep -n -i -E 'PASS|FAIL' qa_reports/review_T-E{275,269,264,268}-*.md`;
  `grep -E '^(status|last_agent):' .current/history/2026-10/e{275,269,264,268}/handoff.md`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs under
  the test lock, then it exits 0 with zero failures (expect about 3045 total /
  3042 pass / 3 skipped per the followups close box). A red in
  `test/e132-lane-registry.test.mjs` gap-6 (backlog E254) or
  `test/teamwork-lite.test.mjs` AC3b (E257) is rerun (single file, then full
  suite) and is not a gate failure; any other red is.
  proof: `node scripts/test-lock.mjs -- npm test` (exit 0; report the tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt from
  clean, then committed `dist/` is byte-identical to a fresh build and
  `scripts/check-version.mjs` passes (it checks the CURRENT version, 4.4.1;
  the bump is release-engineer's).
  proof: `npm run build && git status --porcelain dist/` (expect empty) and
  `node scripts/check-version.mjs` (exit 0).

- **AC5** — Given E275, when the tree is audited, then
  `npm audit --audit-level=high` exits 0 (only low/moderate remain, count
  reported), installed versions satisfy the new floors
  (`@modelcontextprotocol/sdk` >= 1.32.1, `proxy-addr` >= 2.0.8, `sharp` >=
  0.35.5, via `npm ls`), and `docs/dependency-advisories.md` carries a
  disposition for each of the three advisories (id, decision `upgrade`,
  re-review trigger), recorded in the E275 commits that precede this gate.
  proof: `npm audit --audit-level=high; echo exit=$?`;
  `npm ls @modelcontextprotocol/sdk proxy-addr sharp`;
  `git diff v4.4.1..HEAD -- docs/dependency-advisories.md`.

- **AC6** — Given E269, when the rule change is checked, then: (a)
  `content/const-15-core-tail.md` names `git stash drop` and `git stash clear`
  as FORBIDDEN while keeping the pinned first sentence
  (`the only sanctioned git mutations are ... git stash / git stash pop`)
  that `test/e178a-integrator-role.test.mjs` asserts; (b) the stash rule text
  and the negative-control line appear in the built role bundles:
  `buildPromptForRole` output for `qa-engineer` and `code-reviewer` contains
  the negative-control line, and the composed constitution in a role bundle
  (for example `sr-engineer` and `pm`) contains `git stash drop`; (c) the 11
  `test/fixtures/compose-golden/*` files each differ from `v4.4.1` by the
  one §6 line only and the compose-golden tests pass; (d) the four ceilings
  in `test/context-budget.test.mjs` read 5567 / 10076 / 20453 / 7978 (and the
  `skill-pm` 4401 and `skill-sr-engineer` 2852 caps with matching titles), the
  tests' measured values sit at or under them, and
  `test/e269-budget-title-sync.test.mjs` passes; (e) the E256/E265 edits to
  `content/skill-release-engineer.md` leave no `:<line>` or `<file>:<n>-<n>`
  line-number reference to the same file or `scripts/verify-release.mjs`.
  proof: `git diff v4.4.1..HEAD -- content`; `node --input-type=module -e`
  importing `dist/prompts/build.js` `buildPromptForRole` for the four roles and
  grepping for `git stash drop` / `Negative control`; `git diff --stat
  v4.4.1..HEAD -- test/fixtures`; `node --test test/context-budget.test.mjs
  test/e269-budget-title-sync.test.mjs test/e178a-integrator-role.test.mjs
  test/compose-equivalence.test.mjs`; `grep -nE 'skill-release-engineer.*:[0-9]+|verify-release.mjs:[0-9]+' content/skill-release-engineer.md`
  (expect no reference to the same file or verify-release.mjs by line number; a grep hit in historical CHANGELOG-quoting prose, such as the v3.104.2 sentence near line 220, is read in context and is not a failure).

- **AC7** — Given the comment-only lanes (E264, E268 comments), when
  spot-checked, then for the four `tools/` files of E264 and at least two
  E268 test files whose diff is comment-only, `v4.4.1` and HEAD each
  transpiled with `removeComments: true` are byte-identical (E268 test
  files with title or expectation-table changes, `subagent-templates` and
  `context-budget`, are excluded and instead reviewed by diff to confirm only
  titles/tables/numbers named in AC6 and the spec changed).
  proof: per-file `git show v4.4.1:<path>` vs `<path>` through TypeScript
  `transpileModule` (`removeComments: true`); `git diff v4.4.1..HEAD --
  test/subagent-templates.test.mjs` reviewed.

- **AC8** — Given the `v4.4.1` shipped behaviour, when the current tree is
  checked, then it is unregressed: the v4.4.0/v4.4.1 regression set passes
  and the `release-v4.4.1` record is intact.
  proof: `node --test test/e246-mailbox-teardown.test.mjs
  test/e178a-integrator-role.test.mjs test/e259-comment-scan-brace.test.mjs
  test/e259-comment-scan-hash.test.mjs test/e259-comment-scan-limits.test.mjs
  test/e258b-comment-scan.test.mjs`; `git rev-parse v4.4.1^{commit}` (expect
  `76b9c11`); `grep -n '\[4.4.1\]' CHANGELOG.md`.

QA writes PASS only if all of AC1-AC8 hold.

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
- **Version bump** (4.4.1 to 4.5.0, MINOR, final call release-engineer's),
  **CHANGELOG entry**, **three adapter stamps**, **`agc check`**, **push, tag
  and release**, and **evidence archiving** are release-engineer's SOP.
- **Leak rule (carries forward)**: release commit email from `.git/config`
  (noreply); CHANGELOG, release notes and tag message contain no local paths,
  usernames, or adopter/customer names. This spec contains none.
- Backlog E263, E266, E276 and other follow-ups filed by the lanes are not
  verified or fixed here. The human's untracked
  `docs/integrator-session-per-wave-2026-10-07.md` is not part of the release
  and must stay out of every commit.

## Dependencies / Prerequisites
- `release-v4.4.1` is released (tag `v4.4.1`, `76b9c11`); its feature lease is
  stale. New `active_feature` `release-v4.5.0` on the primary workspace, no lane.
- QA PASS of T-REL450-01..04 is release-engineer's precondition.
- No `design/release-v4.5.0.md`; `## Mode` not armed, non-visual feature.
- No external references: Resource Audit Gate hits are internal spec/doc
  pointers only; field omitted.
- Known advisory: `T-REL4-02` drift note ignored per the human's standing
  instruction; do not `tw_sync`.
- QA runs the suite under the test lock; an untracked human file in the tree
  is expected and not a failure.

## Task Format
- [ ] T-REL450-01 [P0] qa-engineer: verify AC1 + AC2 (diff scope since v4.4.1, per-lane review/qa evidence for e275/e269/e264/e268) | depends_on: none
- [ ] T-REL450-02 [P0] qa-engineer: verify AC3 + AC4 + AC5 (full suite under test lock, clean build, version check, audit exit 0, advisory disposition) | depends_on: none
- [ ] T-REL450-03 [P0] qa-engineer: verify AC6 (stash rule composed into role bundles, goldens and budget ceilings consistent, release-engineer SOP line refs gone) | depends_on: none
- [ ] T-REL450-04 [P0] qa-engineer: verify AC7 + AC8 (behaviour-neutral spot check, v4.4.1 non-regression) | depends_on: none
