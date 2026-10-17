# release-post-v4-w5

## Problem Statement
`main` @ `475ae06` (clean, equal to `origin/main`) is 56 commits past the `v4.7.0` tag (`7dbb4fc`, `package.json` 4.7.0). The change set is fan-out wave 5 (plan `specs/fanout-post-v4-w5.md`, closed 2026-10-17, wave PR #18), plus the v4.7.0 post-release bookkeeping (PR #16) and the wave-5 manifest PR (#17). There are three lanes, merged `--no-ff` into `integ/post-v4-w5`:
- **e283** (E283, E322, E316; merge `1f0535e`). `tools/fanout-manifest.ts` and `scripts/fanout.mjs` change. E283: `fanout.mjs validate` requires a `## 接手步驟` section when the manifest status text starts with `已結案`. The section needs four mandatory sub-items, `進行中的背景工作` must read `無`, and no machine-local absolute path may appear. There are seven new `HANDOFF_*` codes, and they are reported by validate only. E322: a new read-only `owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)` subcommand. E316: `parseCutSection` counts every `## Cut` heading variant toward `CUT_SECTION_DUPLICATE`.
- **e287** (E287, E324, E325, E326; merge `95ec767`; went through an architect hop). E287: `agc feature finish` in `bin/agc-init.mjs` and `tools/lane-ticket-allocation.ts` warns, instead of staying silent, when `pending-tickets.md` is in the lane worktree but missing from the revision it reads. Findings that carry `target_repo` are never numbered locally and are listed for a human ruling. E324: `emitZodGateTelemetry` in `tools/registry.ts` skips any `workspace_path` that has a `.current` segment. E325: `readArtifactVersion` in `tools/drift.ts` re-reads the other handoff layout once after a pick-then-read miss. E326: `scripts/verify-release.mjs` now polls an empty branch-scoped run list within the wait budget, for both `--ci-check` and Check 6 of the full run (human ruling O-E326 = A).
- **e288** (E288, E323; merge `b9d9eab`). Content and test changes only. E288: `content/skill-integrator.md` gains an optional Stage 0 ticket cut, and `content/skill-pm.md` gains the matching *Integrator Stage 0 cut* Gate Summary row. The PM cap in `test/context-budget.test.mjs` moves from 4708 to 4823 (approved ceiling 4860). E323: `test/e178a-integrator-role.test.mjs` and `test/e296-manifest-tier.test.mjs` AC10 no longer diff against a fixed base commit. `content/skill-qa-engineer.md` gains the resident-test hygiene line. The qa SOP byte cap in `test/qa-visual-skill-split.test.mjs` moves from 17900 to 18500 (human decision D1, the lane's one approved out-of-row path).

These paths are untouched: `package.json`, `package-lock.json`, `index.ts`, `gates/`, `schema/`, `prompts/`, `templates/`, `content/const-*.md`, `content/coord-*.md`, `content/constitution-rationale.md`, `docs/lane-protocol.md` and `test/fixtures/**` (compose goldens). `GATE_REGISTRY` stays at 34 entries, and no schema version changes.

Nobody has yet confirmed that the three lanes' evidence still holds on the committed `main` tree as a whole. This is an evidence-only release gate, and no code is written here.

**Version: not fixed by this spec.** The human said release-engineer decides from the changes. The options:
- **v4.8.0 MINOR** (integrator's recommendation): E283 adds a new `validate` rule with seven new error codes, which can newly fail a closed manifest. E322 adds a new `owners` subcommand to `scripts/fanout.mjs`. E287 adds a new optional `target_repo` field to `pending-ticket` blocks and a new finish warning. These are new user-visible capabilities.
- **v4.7.1 PATCH** (alternative): only if release-engineer judges the fanout and finish changes to be internal tooling refinements, not features. PM does not recommend this. `owners` is a new command surface, and the E283 rule changes `validate` outcomes for closed manifests.

QA verifies against the CURRENT version 4.7.0, and the result does not depend on which option is chosen. Release-engineer owns the bump, the CHANGELOG entry, the three `agc-version` stamps, `agc check` at the new version, the `release/*` PR (main is protected), the tag and GitHub release, and evidence archiving.

## User Stories
- As release-engineer, I want a QA PASS confirming each wave-5 lane's evidence is present and green on main, that the suite, build, audit and version checks are green, that the new and changed surfaces (E283 validate rule, E322 `owners`, E316 Cut variants, E287 finish warning and `target_repo`, E324/E325/E326 fixes, E288 Stage 0 and PM row, E323 test hygiene) behave as specified on the compiled output, and that v4.7.0 behaviour is unregressed, so that I can choose the semver and run the release without re-checking closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.7.0`, when the diff is classified, then every changed path belongs to one of the classes below. These paths must not appear: `package.json`, `package-lock.json`, `tsconfig*`, `index.ts`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `schema/`, `guards/`, `gates/`, `transport/`, `lib/`, `prompts/`, `templates/`, `.github/`, `content/const-*.md`, `content/coord-*.md`, `content/constitution-rationale.md`, `docs/lane-protocol.md` and `test/fixtures/**`. Under `bin/`, only `bin/agc-init.mjs` may change. Under `content/`, only `skill-integrator.md`, `skill-pm.md` and `skill-qa-engineer.md` may change. The classes:
  - **e283** (E283/E322/E316): `tools/fanout-manifest.ts`, `scripts/fanout.mjs`, `test/e283-validate-handoff.test.mjs`, `test/e322-owners.test.mjs`, `test/e316-cut-heading-variants.test.mjs`, `specs/e283-*`.
  - **e287** (E287/E324/E325/E326): `bin/agc-init.mjs`, `tools/lane-ticket-allocation.ts`, `tools/registry.ts`, `tools/drift.ts`, `scripts/verify-release.mjs`, `test/e287-finish-findings.test.mjs`, `test/e324-zod-telemetry-under-current.test.mjs`, `test/e325-drift-version-peek-race.test.mjs`, `test/e326-empty-branch-run-poll.test.mjs`, `test/verify-release.test.mjs`, `specs/e287-*`.
  - **e288** (E288/E323): `content/skill-integrator.md`, `content/skill-pm.md`, `content/skill-qa-engineer.md`, `test/context-budget.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/e288-integrator-stage0.test.mjs`, `test/qa-visual-skill-split.test.mjs` (human decision D1), `specs/e288-*`.
  - **`dist/**`**: rebuilt outputs of `tools/drift`, `tools/fanout-manifest`, `tools/lane-ticket-allocation` and `tools/registry` only.
  - **Bookkeeping**: `specs/fanout-post-v4-w5.md`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `tasks.md`, `.current/**`, `qa_reports/`, `review_reports/`.

  Any path outside these classes is a finding to report.
  proof: `git diff --name-only v4.7.0..HEAD`; `git log --oneline v4.7.0..HEAD`; `git diff --name-only v4.7.0..HEAD -- package.json package-lock.json 'tsconfig*' index.ts CHANGELOG.md CLAUDE.md AGENTS.md .antigravityrules schema guards gates transport lib prompts templates .github 'content/const-*' 'content/coord-*' content/constitution-rationale.md docs/lane-protocol.md test/fixtures` (expect empty); `git diff --name-only v4.7.0..HEAD -- bin content dist` (expect only `bin/agc-init.mjs`, the three `content/skill-*.md` above, and `dist/tools/{drift,fanout-manifest,lane-ticket-allocation,registry}.*`).

- **AC2** — Given the three lane features, when each lane's evidence is checked on the committed main tree, then each lane has the code-reviewer APPROVED and qa PASS records named below. Each `.current/history/2026-10/<lane>/handoff.md` reads `status: "PASS"` and `last_agent: "qa-engineer"`. The latest verdict in each file governs: an earlier CHANGES_REQUESTED round closed by a later APPROVED is not a failure. Lanes and features:
  - **e283** `e283-fanout-handoff-and-ref-check` (T-E316-01, T-E283-01, T-E322-01). QA: `qa_reports/review_T-E283-01.md`, `review_T-E316-01.md`, `review_T-E322-01.md`. Review: `review_reports/review_T-E283-01.md` (batched, `covers: T-E316-01, T-E283-01, T-E322-01`; round 1 APPROVED).
  - **e287** `e287-finish-findings-and-small-fixes` (T-E287-01/02, T-E324-01/02, T-E325-01/02, T-E326-01/02). QA: `qa_reports/review_T-E287-0{1,2}.md`, `review_T-E324-0{1,2}.md`, `review_T-E325-0{1,2}.md`, `review_T-E326-0{1,2}.md`. Review: `review_reports/review_T-E287-01.md` (round 1 CHANGES_REQUESTED, then round 2 APPROVED).
  - **e288** `e288-integrator-stage0-and-test-hygiene` (T-E288-01/02, T-E323-01/02). QA: `qa_reports/review_T-E288-0{1,2}.md`, `review_T-E323-0{1,2}.md`. Review: `review_reports/review_T-E288-01.md` (APPROVED, optional findings only).

  Each lane ledger `.current/history/2026-10/<lane>/tasks.md` shows every row `[x]`. Each backlog row for E283, E322, E316, E287, E324, E325, E326, E288 and E323 reads DONE and names its lane merge sha, and that sha is an ancestor of HEAD.
  proof: `grep -n -i -E 'verdict' review_reports/review_T-E{283,287,288}-01.md`; `grep -n -E '^## .*— (PASS|FAIL) —' qa_reports/review_T-E{283,287,288,316,322,323,324,325,326}-0*.md`; `grep -E '^(active_feature|status|last_agent):' .current/history/2026-10/e{283,287,288}/handoff.md`; `grep -E '^- \[' .current/history/2026-10/e{283,287,288}/tasks.md`; `grep -n -E '^\| (E283|E322|E316|E287|E324|E325|E326|E288|E323) ' docs/backlog.md`; `git merge-base --is-ancestor 1f0535e HEAD && git merge-base --is-ancestor 95ec767 HEAD && git merge-base --is-ancestor b9d9eab HEAD; echo exit=$?`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs under the test lock, then it exits 0 with zero failures, and the tally (total/pass/skipped) is reported. For reference, the e287 lane recorded 3281/3284 on `9f9f9ca`. A red in a test already listed as load-sensitive in the backlog (E238/E254/E278 family, or the timing flakes e288 recorded under host load) is rerun once (single file, then full suite) and is not a gate failure. Any other red is a failure.
  proof: `node scripts/test-lock.mjs -- npm test` (exit 0; report the tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt, then committed `dist/` is byte-identical to a fresh build. `scripts/check-version.mjs` passes against the CURRENT version (4.7.0; the bump belongs to release-engineer). `npm run check:bookkeeping` and `npm run check:md-tables` exit 0.
  proof: `npm run build && git status --porcelain dist/` (expect empty); `node scripts/check-version.mjs; echo exit=$?`; `npm run check:bookkeeping; echo exit=$?`; `npm run check:md-tables; echo exit=$?`.

- **AC5** — Given the dependency set, when audited, then `npm audit --audit-level=high` exits 0 (counts reported), and `package.json` and `package-lock.json` are byte-identical to `v4.7.0`.
  proof: `npm audit --audit-level=high; echo exit=$?`; `git diff --stat v4.7.0..HEAD -- package.json package-lock.json` (expect empty).

- **AC6** — Given the `agc check`-class checks, when run on HEAD, then they pass. `agc check` exits 0 at the CURRENT 4.7.0 stamps in `CLAUDE.md`, `AGENTS.md` and `.antigravityrules` (the new version and stamps belong to release-engineer). `node scripts/check-transitions-sync.mjs` passes. The comment-discipline advisories that the e287 QA noted in `tools/lane-ticket-allocation.ts` are advisory, not a failure.
  proof: `node bin/agc-init.mjs check; echo exit=$?`; `node scripts/check-transitions-sync.mjs; echo exit=$?`.

- **AC7** — Given the e283 changes (E283 validate rule, E322 `owners`, E316 Cut variants), when the compiled output is exercised, then:
  - (a) The closed wave-5 manifest `specs/fanout-post-v4-w5.md` validates (exit 0, `fanout: ok — …`). A copy truncated before its `## 接手步驟` section exits 2 with `HANDOFF_SECTION_ABSENT`.
  - (b) Hard condition: across every `specs/fanout-*.md`, validate exits 0 except `fanout-wave5.1.md` and `fanout-wave6.md`. Those two exit 2 with exactly `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`, the same set as before E283, and no `HANDOFF_*` code appears.
  - (c) `owners specs/fanout-post-v4-w5.md --range v4.7.0...HEAD` exits 1. It prints HIT lines attributing `tools/fanout-manifest.ts` to e283, `bin/agc-init.mjs` to e287 and `content/skill-pm.md` to e288, and a `fanout owners: … 3 dispatchable lane(s)` summary. It writes nothing (`git status --porcelain` unchanged).
  - (d) The `parseCutSection` doc comment names the setext limit.
  - (e) The e283 behaviour tests and the unowned hard-condition tests pass.
  proof: `node scripts/fanout.mjs validate specs/fanout-post-v4-w5.md; echo exit=$?` (expect `exit=0`); `awk '/^## 接手步驟/{exit} {print}' specs/fanout-post-v4-w5.md > "$TMPDIR/w5-nohandoff.md"; node scripts/fanout.mjs validate "$TMPDIR/w5-nohandoff.md"; echo exit=$?` (expect `HANDOFF_SECTION_ABSENT`, `exit=2`); `for f in specs/fanout-*.md; do node scripts/fanout.mjs validate "$f" >/dev/null 2>"$TMPDIR/v.err"; e=$?; [ $e -ne 0 ] && echo "$f exit=$e $(grep -o -E 'error: [A-Z_]+' "$TMPDIR/v.err" | sort -u | tr '\n' ' ')"; done` (expect only the two lines for wave5.1 and wave6); `node scripts/fanout.mjs owners specs/fanout-post-v4-w5.md --range v4.7.0...HEAD; echo exit=$?` then `git status --porcelain` (expect `exit=1`, the three HIT lines, and a clean tree); `grep -n -i 'setext' tools/fanout-manifest.ts`; `node --test test/e283-validate-handoff.test.mjs test/e322-owners.test.mjs test/e316-cut-heading-variants.test.mjs test/e296-manifest-tier.test.mjs test/e235b-relative-worktree.test.mjs test/e177a-manifest.test.mjs test/e177a-check-cli.test.mjs test/e178b-fanout-unmatched.test.mjs test/e248-relative-mailbox-header.test.mjs`.

- **AC8** — Given the e287 changes (E287 finish warning and `target_repo`, E324, E325, E326), when the compiled output is exercised, then:
  - (a) The `agc feature` usage text states that findings missing from the revision are warned about, not numbered, and that `target_repo` findings are listed, not numbered.
  - (b) The E287, E324, E325 and E326 behaviour tests pass, as do the finish regression tests (lifecycle, finish-history, e213, e298, e180, e246, lane-ticket-allocation), the E303/E317 telemetry tests, the drift tests, the E312 read-path test and the E320 `--sha` test.
  - (c) `tools/handoff-parse.ts` has an empty diff since `v4.7.0` (E325 stays local to drift).
  - (d) `test/verify-release.test.mjs` changes only by the one-line replacement in VR-15 (the added `AGC_VERIFY_CI_WAIT_SECONDS: "0"` env pin) plus appended E326 tests. VR-22 and VR-23 (E238 timing) are unedited.
  proof: `node bin/agc-init.mjs feature 2>&1 | grep -n -E 'target_repo|warns'`; `node --test test/e287-finish-findings.test.mjs test/lane-ticket-allocation.test.mjs test/agc-feature-lifecycle.test.mjs test/agc-feature-finish-history.test.mjs test/e213-shipped-ignored-shape.test.mjs test/e298-finish-remote-delete.test.mjs test/e180-abandoned-harvest.test.mjs test/e246-mailbox-teardown.test.mjs test/e324-zod-telemetry-under-current.test.mjs test/e303-zod-boundary-telemetry.test.mjs test/e325-drift-version-peek-race.test.mjs test/drift-archived-tasks.test.mjs test/drift-baseline.test.mjs test/drift-skew.test.mjs test/drift-stamp-advisory.test.mjs test/e312-read-path-race.test.mjs test/e326-empty-branch-run-poll.test.mjs test/verify-release.test.mjs test/e320-ci-check-sha.test.mjs`; `git diff --stat v4.7.0..HEAD -- tools/handoff-parse.ts` (expect empty); `git diff v4.7.0..HEAD -- test/verify-release.test.mjs | grep -E '^-[^-]'` (expect exactly one line, the VR-15 `runVerifyWithPath(root, …, ["v10.0.4"]);` call), and `git diff v4.7.0..HEAD -- test/verify-release.test.mjs | grep -n -E 'VR-2[23]'` (expect empty).

- **AC9** — Given the e288 changes (E288 Stage 0 and PM row, E323 test hygiene), when the built role bundles and tests are inspected, then:
  - (a) `buildPromptForRole` output (from `dist/prompts/build.js`) for `skill-integrator.md` contains `## Stage 0 — Ticket cut (optional)` and `specs/ticket-cut-<feature>.md`. The output for `skill-pm.md` contains `**Integrator Stage 0 cut**`. The output for `skill-qa-engineer.md` contains `never diff against a fixed lane base sha`.
  - (b) The constitution and coordinator segments are unchanged, so the compose goldens are untouched: `content/const-*`, `content/coord-*` and `test/fixtures/` have empty diffs since `v4.7.0`, and the compose-equivalence, context-budget and e269 budget-title tests pass.
  - (c) `test/e178a-integrator-role.test.mjs` and `test/e296-manifest-tier.test.mjs` contain no fixed-base-sha diff machinery.
  - (d) The E288, E323, D1 cap and integrator content-pin tests pass with no skipped test in e178a/e296.
  proof: `node --input-type=module -e "import * as b from './dist/prompts/build.js'; const i = JSON.stringify(b.buildPromptForRole('skill-integrator.md','x', process.cwd())); const p = JSON.stringify(b.buildPromptForRole('skill-pm.md','x', process.cwd())); const q = JSON.stringify(b.buildPromptForRole('skill-qa-engineer.md','x', process.cwd())); console.log(i.includes('## Stage 0 — Ticket cut (optional)'), i.includes('specs/ticket-cut-<feature>.md'), p.includes('**Integrator Stage 0 cut**'), q.includes('never diff against a fixed lane base sha'))"` (expect `true true true true`); `git diff --stat v4.7.0..HEAD -- 'content/const-*' 'content/coord-*' test/fixtures` (expect empty); `grep -nE 'BASE_SHA|3c72a83|"diff"' test/e178a-integrator-role.test.mjs; grep -nE '"archive"|"rev-parse"|BASE_CODE' test/e296-manifest-tier.test.mjs` (expect no output); `node --test test/e288-integrator-stage0.test.mjs test/context-budget.test.mjs test/qa-visual-skill-split.test.mjs test/e178a-integrator-role.test.mjs test/e296-manifest-tier.test.mjs test/e246-mailbox-teardown.test.mjs test/e297-main-protected-sop.test.mjs test/e286-integrator-trust-and-git.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/compose-equivalence.test.mjs test/e269-budget-title-sync.test.mjs`.

- **AC10** — Given the `v4.7.0` shipped behaviour, when the current tree is checked, then it is unregressed. The `v4.7.0` tag resolves to `7dbb4fc`, `CHANGELOG.md` has the `[4.7.0]` entry, `HOP_CAP` is 14, `GATE_REGISTRY` has 34 entries, and the v4.7.0 behaviour tests pass (E320 `--sha`, E319 design mode, E317 telemetry, E312 read path, E286 integrator content, plus the governance-core tests).
  proof: `git rev-parse v4.7.0^{commit}` (expect `7dbb4fc40ddd5a0eb2cd3e336a34f58844345aa5`); `grep -n '\[4.7.0\]' CHANGELOG.md`; `grep -n 'const HOP_CAP = 14' tools/transitions.ts`; `node --input-type=module -e "import {GATE_REGISTRY} from './dist/gates/registry.js'; console.log(Object.keys(GATE_REGISTRY).length)"` (expect 34); `node --test test/e320-ci-check-sha.test.mjs test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs test/e303-zod-boundary-telemetry.test.mjs test/e312-read-path-race.test.mjs test/e123b9-lane-flip.test.mjs test/e286-integrator-trust-and-git.test.mjs test/hop-count-transitions.test.mjs test/dispatch-pins.test.mjs test/e308-single-source-tier-enum.test.mjs test/error-code-contract.test.mjs test/e35-pipeline-order.test.mjs test/e297-main-protected-sop.test.mjs test/e298-finish-remote-delete.test.mjs test/e299-check-bookkeeping.test.mjs`.

QA writes PASS only if all of AC1-AC10 hold.

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
- These all belong to release-engineer's SOP: **choosing the semver** (v4.8.0 MINOR or v4.7.1 PATCH, see Problem Statement), the **version bump** (`package.json`, the `index.ts` Server literal), the **CHANGELOG entry**, the **three `agc-version` stamps**, **`agc check` at the new version**, the **`release/*` branch and PR** (main is protected, E297), the **tag and GitHub release**, and **evidence archiving**. With E326 on main, release step 8b's branch-scoped `--ci-check --strict` should now poll a fresh `release/*` branch instead of failing at once. That is release-engineer's to observe, not this gate's.
- **Leak rule (carries forward)**: the release commit uses the noreply email from `.git/config`. The CHANGELOG, release notes and tag message contain no local paths, usernames, or adopter/customer names. This spec contains none.
- Follow-ups filed by the wave-5 lanes (E327–E335, E287-NEW-2, E288-NEW-1) and the deferred SOP rewording for E322 (Stage 4 condition 2 using `owners`) are not verified or fixed here.
- No code, test or content edits. A red found by QA routes back to the coordinator and is not fixed inside this feature.

## Dependencies / Prerequisites
- `release-post-v4-w4` is released (tag `v4.7.0`, `7dbb4fc`). Its lease (last write 2026-10-16T09:02Z) is superseded by the new `active_feature` `release-post-v4-w5` on the primary workspace, with no lane.
- QA PASS of T-RELW5-01..05 is release-engineer's precondition. Dispatch: PM to qa-engineer via the evidence-only single-role judge-dispatch edge, the same edge v4.5.0, v4.6.0 and v4.7.0 used.
- No `design/release-post-v4-w5.md`. `## Mode` is not armed, and the feature is non-visual.
- No external references. The Resource Audit Gate hits are internal spec and doc pointers only, so the `external_refs` field is omitted.
- Known advisory: the `T-REL4-02` drift note is ignored per the human's standing instruction. Do not `tw_sync`.
- QA runs the suite under the test lock. AC7's ad-hoc probes write only under `$TMPDIR`.
- Bookkeeping: this spec and the T-RELW5 rows in `.current/_primary/tasks.md` are left uncommitted on local main for release-engineer to carry onto its `release/*` or `docs/*` branch (main is protected).

## Task Format
- [ ] T-RELW5-01 [P0] qa-engineer: verify AC1 + AC2 (diff-path classification since v4.7.0; per-lane review/qa evidence, closed PASS handoffs and ledgers for e283, e287, e288; backlog done-marks and merge shas) | depends_on: none
- [ ] T-RELW5-02 [P0] qa-engineer: verify AC3 + AC4 + AC5 + AC6 (full suite under test lock, clean build, check-version at 4.7.0, check:bookkeeping, check:md-tables, npm audit, agc check, transitions-sync) | depends_on: none
- [ ] T-RELW5-03 [P0] qa-engineer: verify AC7 (E283 validate rule on the real closed manifest + all-manifest hard-condition sweep, E322 owners range probe read-only, E316 Cut variants, e283 tests) | depends_on: none
- [ ] T-RELW5-04 [P0] qa-engineer: verify AC8 (E287 finish warning/target_repo, E324, E325, E326 behaviours; finish regression tests; handoff-parse untouched; verify-release.test.mjs diff limited to VR-15 pin + E326 tests) | depends_on: none
- [ ] T-RELW5-05 [P0] qa-engineer: verify AC9 + AC10 (E288 Stage 0 / PM row / E323 line composed into bundles; goldens and const/coord untouched; E323 no fixed-base diffs; v4.7.0 non-regression) | depends_on: none
