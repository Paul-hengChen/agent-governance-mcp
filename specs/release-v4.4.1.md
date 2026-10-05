# release-v4.4.1

## Problem Statement
`main` @ `d64a126` (= `origin/main`) contains one code-bearing change set since
the `v4.4.0` tag (`71d3af0`; `package.json` version `4.4.0`): E260, which
trimmed this repo's existing long comments to the Comment discipline rule. It
is comment-only and was merged in three fan-out waves: lanes e260a-e260d via
`integ/e260`, e260e-e260h via `integ/e260-w2`, and e260i via `integ/e260i`
(plan and per-wave merge shas and measurements: `specs/fanout-e260.md`, its
結案 sections). Everything else since `v4.4.0` is bookkeeping (backlog rows
E263-E274, the queue file, lane-close commits, evidence). `dist/` changed only
because TypeScript carries comments into the emitted `.js`, `.d.ts` and `.map`
files (`tsconfig` has no `removeComments`); that is why this is a PATCH and not
a no-op. `git diff --name-only v4.4.0..HEAD -- package.json tsconfig.json
.github` is empty. Each of the nine lanes carries its own review and QA
evidence plus a closed lane handoff under `.current/history/2026-10/`, but no
one has verified that evidence still stands on the committed main tree as a
whole. This is an evidence-only PATCH release gate, the same shape as
`release-v4.2.1`: no new code is written here.

## User Stories
- As release-engineer, I want a QA PASS confirming the E260 lane evidence is
  present and green on main and that the change is behaviour-neutral, so that
  I can execute the PATCH release (version bump, CHANGELOG, adapter stamps,
  `agc check`, tag/release) without re-litigating closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.4.0`, when
  `git diff --name-only v4.4.0..HEAD` is inspected, then it touches no
  `package.json`, `tsconfig*`, or `.github/` file; the non-bookkeeping paths
  are the E260 comment-only trim of source (`tools/`, `gates/`, `prompts/`,
  `lib/`, `schema/`, `guards/`, `transport/`, `bin/`, `scripts/`, `index.ts`),
  tests (`test/**` excluding `test/fixtures/`), the E260 lane specs
  (`specs/e260*`, `specs/fanout-e260.md`) and the rebuilt `dist/`; and every
  other commit is bookkeeping (`docs/backlog.md`,
  `docs/v4.0.0-new-tickets.md`, `tasks.md`, `.current/**`, `qa_reports/`,
  `review_reports/`, lane close, queue placement, E262-E274 filings).
  proof: `git diff --name-only v4.4.0..HEAD`, `git log --oneline v4.4.0..HEAD`,
  `git diff --name-only v4.4.0..HEAD -- package.json tsconfig.json .github`
  (expect empty).

- **AC2** — Given the nine lanes e260a-e260i, when each lane's evidence is
  inspected on the committed main tree (including archive subdirectories),
  then for each lane a code-reviewer APPROVED file exists in `review_reports/`
  and a qa PASS record exists in `qa_reports/`, and
  `.current/history/2026-10/e260<x>/handoff.md` reads `status: "PASS"` and
  `last_agent: "qa-engineer"`. Lane features: e260a `e260a-tools-a-h`, e260b
  `e260b-tools-i-z`, e260c `e260c-bin-scripts`, e260d
  `e260d-core-dirs-comment-trim`, e260e `E260E`, e260f `e260f`, e260g
  `e260g-r3-fix` (and `e260g-test-e3-l-comment-trim`), e260h
  `e260h-test-m-z-eval`, e260i `e260i-r3-fix` (and
  `e260i-budget-render-comment-trim`). Review reports are
  `review_reports/review_T-E260<X>-*.md` (X = A..I). QA records are
  `qa_reports/review_T-E260<X>-*.md`, but some lanes recorded them under
  other names (`qa_reports/E260I_author_T-E260I-01-11.md`,
  `qa_reports/author_E260H_T-E260H-11-25.md`,
  `qa_reports/qa_E260F_author.md`, `qa_reports/verify_E260H_T-E260H-26.md`);
  accept those as the lane's qa record when they record PASS. Known quirk,
  noted and not a failure: e260g left one qa file whose name holds nine task
  ids separated by spaces (`qa_reports/review_T-E260G-09 T-E260G-10 …
  T-E260G-17.md`); it is not renamed here and is for release-engineer's
  archive step. Review rounds above one (e260b, e260e, e260f, e260g, e260i
  had send-backs) are closed by a later APPROVED; the latest verdict on each
  file governs.
  proof: `grep -n -i verdict` on each evidence file; `grep -E
  '^(status|last_agent):' .current/history/2026-10/e260{a,b,c,d,e,f,g,h,i}/handoff.md`;
  `ls qa_reports review_reports | grep -i e260`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs under
  the test lock, then it exits 0 with zero failures (expect about 3043 total /
  3040 pass / 3 skipped per the `specs/fanout-e260.md` close box).
  `test/e132-lane-registry.test.mjs` gap-6 is flaky under full-suite load
  (backlog E254, now two symptoms) and `test/teamwork-lite.test.mjs` AC3b is
  flaky on the live-hook marker (backlog E257): a red in either is rerun
  (the single file, then the full suite) and is not a failure of this gate;
  any other red is a failure.
  proof: `node scripts/test-lock.mjs -- npm test` (exit 0; report the printed
  pass/fail tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt from
  clean, then the committed `dist/` is byte-identical to a fresh build and
  `scripts/check-version.mjs` passes.
  proof: `npm run build && git status --porcelain dist/` (expect empty
  output) and `node scripts/check-version.mjs` (exit 0).

- **AC5** — Given the change is comment-only, when it is spot-checked, then:
  (a) for at least three source files from different directories (for
  example `tools/`, `gates/`, `bin/` or `scripts/`) and at least two test
  files, `v4.4.0` and HEAD each transpiled with `removeComments` are
  byte-identical; (b) the budget numbers and ceilings in
  `test/context-budget.test.mjs` are unchanged versus `v4.4.0` (only comment
  lines and test titles' comment text may differ; the numeric ceilings and
  assertions are identical); (c) `git diff v4.4.0..HEAD -- test/fixtures
  content` is empty.
  proof: per-file `git show v4.4.0:<path>` and `<path>` transpiled with
  TypeScript `transpileModule` (`removeComments: true`) and compared; `git
  diff v4.4.0..HEAD -- test/context-budget.test.mjs` reviewed for numeric
  changes; `git diff --name-only v4.4.0..HEAD -- test/fixtures content`
  (expect empty).

- **AC6** — Given the `v4.4.0` shipped behaviour, when the current tree is
  checked, then it is unregressed: the E246 mailbox-teardown tests and the
  E259 comment-scan tests pass, and the `release-v4.4.0` closure record (tag
  `v4.4.0`) is intact.
  proof: `node --test test/e246-mailbox-teardown.test.mjs
  test/e178a-integrator-role.test.mjs test/e259-comment-scan-brace.test.mjs
  test/e259-comment-scan-hash.test.mjs test/e259-comment-scan-limits.test.mjs
  test/e258b-comment-scan.test.mjs`; `git tag -l v4.4.0`; `git rev-parse
  v4.4.0^{commit}` (expect `71d3af0`); `grep -n '\[4.4.0\]' CHANGELOG.md`.

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
- **Version bump** (4.4.0 to 4.4.1, PATCH), **CHANGELOG entry**, **three
  adapter stamps**, **`agc check` stamp comparison**, **push, tag and
  release**, and **evidence archiving** (including the e260g qa file with
  spaces in its name) are release-engineer's SOP and are not verified or
  executed here.
- **Leak rule (carries forward)**: the commit email used for release commits
  and the tag must come from `.git/config` and be a noreply address; the
  CHANGELOG entry, release notes and tag message must contain no local paths,
  no usernames, and no adopter or customer names. This spec likewise contains
  none.
- No doc-writer follow-up is cut here. The follow-up tickets filed from the
  lanes (E263-E274, including E254 and E257 flakes) are backlog items, not
  verified or fixed by this gate.

## Dependencies / Prerequisites
- `release-v4.4.0` is released (tag `v4.4.0`, commit `71d3af0`); its feature
  lease is stale. This ticket starts a new `active_feature`
  (`release-v4.4.1`) on the primary workspace, no lane.
- The QA PASS of T-REL441-01..03 is release-engineer's precondition for the
  PATCH release.
- No `design/release-v4.4.1.md` exists; `## Mode` is not armed, non-visual
  feature.
- No external references: Resource Audit Gate found zero hits, field omitted.
- Known advisory: `T-REL4-02` drift note is ignored per the human's standing
  instruction; do not `tw_sync`.

## Task Format
- [ ] T-REL441-01 [P0] qa-engineer: verify AC1 + AC2 (diff scope since v4.4.0 and per-lane evidence for e260a-e260i) | depends_on: none
- [ ] T-REL441-02 [P0] qa-engineer: verify AC3 + AC4 (full suite under test lock, clean build, version check) | depends_on: none
- [ ] T-REL441-03 [P0] qa-engineer: verify AC5 + AC6 (behaviour-neutral spot check, v4.4.0 non-regression) | depends_on: none
