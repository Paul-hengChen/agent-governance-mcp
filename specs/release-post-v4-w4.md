# release-post-v4-w4

## Problem Statement
`main` @ `c9708a1` (clean) is 43 commits past the `v4.6.0` tag (`807828a`, `package.json` 4.6.0). The change set is fan-out wave 4 (plan `specs/fanout-post-v4-w4.md`, wave PR #14), plus the v4.6.0 post-release bookkeeping (PR #12) and the wave-4 manifest PR (#13). Three lanes: **e320** (E320, E319, E317, E321; merge `5e58198`), **e286** (E286 with E282 folded in by human ruling 2026-10-15; merge `4468cac`) and **e312** (E312; merge `9196592`). Code changes are four targeted fixes: `scripts/verify-release.mjs --ci-check --sha` queries CI runs by commit and FAILs when no completed run exists for the sha (E320); `parseDesignMode` in `gates/visual.ts` picks the leftmost known mode on the Mode line (E319); `emitZodGateTelemetry` in `tools/registry.ts` skips emission when `workspace_path` is a `.current` dir (E317); the read path in `tools/handoff-parse.ts` tolerates an in-flight flat-to-lane migration (E312). The content change is `content/skill-integrator.md` (new Stage 4 *Mid-wave base fix* step, O10/O4/O5, the `git merge-tree --write-tree` read-only note) and `docs/lane-protocol.md` (new §7, lane-side pause, E282 merge-base sentence) (E286). E321 is a test audit only. `package.json`, `package-lock.json`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `content/const-*.md` and `content/constitution-rationale.md` are untouched; `GATE_REGISTRY` stays at 34 entries; no schema version changes.

No one has yet confirmed that the three lanes' evidence still holds on the committed `main` tree as a whole. This is an evidence-only release gate: no code is written here.

**Version: not fixed by this spec.** The human said release-engineer decides from the changes. The two options:
- **v4.6.1 PATCH** (integrator's recommendation): the four code changes are bug fixes with no new tool, gate, schema or public option. E286 refines an existing role SOP.
- **v4.7.0 MINOR**: if release-engineer judges E286's new SOP step (Stage 4 *Mid-wave base fix* in `content/skill-integrator.md`, which the integrator now runs, plus the matching lane-side §7 in `docs/lane-protocol.md`) to be a new feature.

QA verifies against the CURRENT version 4.6.0 and does not depend on which option is chosen. Release-engineer owns the bump, the CHANGELOG entry, the three `agc-version` stamps, `agc check` at the new version, the `release/*` PR (main is protected), the tag and GitHub release, and evidence archiving.

## User Stories
- As release-engineer, I want a QA PASS confirming each wave-4 lane's evidence is present and green on main, that the suite, build, audit and version checks are green, that the E286 SOP change is composed into the integrator bundle, and that v4.6.0 behaviour is unregressed, so that I can choose the semver and execute the release without re-checking closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.6.0`, when the diff is classified, then every changed path belongs to one of the classes below. `package.json`, `package-lock.json`, `tsconfig*`, `index.ts`, `CHANGELOG.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `schema/`, `guards/`, `transport/`, `lib/`, `prompts/`, `templates/`, `bin/`, `.github/`, `content/const-*.md`, `content/constitution-rationale.md`, `test/fixtures/**` and `test/context-budget.test.mjs` must not appear. Classes: E320 (`scripts/verify-release.mjs`, `test/e320-ci-check-sha.test.mjs`, `specs/e320-*`); E319 (`gates/visual.ts`, `test/source-credibility-gate.test.mjs`, `test/visual-evidence-gate.test.mjs`); E317 (`tools/registry.ts`, `test/e303-zod-boundary-telemetry.test.mjs`); E321 (evidence only, no source path); E286/E282 (`content/skill-integrator.md`, `docs/lane-protocol.md`, `test/e286-integrator-trust-and-git.test.mjs`, `specs/e286-*`); E312 (`tools/handoff-parse.ts`, `test/e312-read-path-race.test.mjs`, `specs/e312-*`); `dist/**` rebuilt outputs of `gates/visual`, `tools/registry` and `tools/handoff-parse` only; bookkeeping (`specs/fanout-post-v4-w4.md`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `tasks.md`, `.current/**`, `qa_reports/`, `review_reports/`). Any path outside these classes is a finding to report.
  proof: `git diff --name-only v4.6.0..HEAD`; `git log --oneline v4.6.0..HEAD`; `git diff --name-only v4.6.0..HEAD -- package.json package-lock.json 'tsconfig*' index.ts CHANGELOG.md CLAUDE.md AGENTS.md .antigravityrules schema guards transport lib prompts templates bin .github 'content/const-*' content/constitution-rationale.md test/fixtures test/context-budget.test.mjs` (expect empty); `git diff --name-only v4.6.0..HEAD -- dist` (expect only `dist/gates/visual.*`, `dist/tools/registry.*`, `dist/tools/handoff-parse.*`).

- **AC2** — Given the three lane features, when each lane's evidence is checked on the committed main tree, then each has the code-reviewer APPROVED and qa PASS records named below, and `.current/history/2026-10/<lane>/handoff.md` reads `status: "PASS"` and `last_agent: "qa-engineer"`. The latest verdict in each file governs: an earlier CHANGES_REQUESTED round closed by a later APPROVED, or an AC table with `FAIL` strings inside quoted stderr, is not a failure. Lanes and features: e320 `e320-ci-check-sha-and-small-fixes` (T-E320-01, T-E319-01, T-E317-01, T-E320-02, T-E321-01; `qa_reports/review_T-E320-0{1,2}.md`, `review_T-E319-01.md`, `review_T-E317-01.md`, `review_T-E321-01.md`; `review_reports/review_T-E320-01.md`, `review_T-E319-01.md`, `review_T-E317-01.md`); e286 `e286-integrator-trust-and-git` (T-E286-01..03; `qa_reports/review_T-E286-01..03.md`; `review_reports/review_T-E286-01.md`, which has round 1 CHANGES_REQUESTED followed by round 2 APPROVED); e312 `e312-read-path-migration-race` (T-E312-01, 02; `qa_reports/review_T-E312-0{1,2}.md`; `review_reports/review_T-E312-01.md`). Each lane ledger `.current/history/2026-10/<lane>/tasks.md` shows every row `[x]`. Each backlog row for E282, E286, E312, E317, E319, E320 and E321 reads DONE and names its lane merge sha, and that sha is an ancestor of HEAD.
  proof: `grep -n -i -E 'verdict' review_reports/review_T-E{286,312,317,319,320}-01.md`; `grep -n -E '^## .*— (PASS|FAIL) —' qa_reports/review_T-E{286,312,317,319,320,321}-0*.md`; `grep -E '^(active_feature|status|last_agent):' .current/history/2026-10/e{286,320,312}/handoff.md`; `grep -E '^- \[' .current/history/2026-10/e{286,320,312}/tasks.md`; `grep -n -E '^\| (E282|E286|E312|E317|E319|E320|E321) ' docs/backlog.md`; `git merge-base --is-ancestor 5e58198 HEAD && git merge-base --is-ancestor 4468cac HEAD && git merge-base --is-ancestor 9196592 HEAD; echo exit=$?`.

- **AC3** — Given the committed HEAD tree, when the full test suite runs under the test lock, then it exits 0 with zero failures and the tally (total/pass/skipped) is reported. For reference, the e320 lane recorded 3213 tests, 3210 pass, 0 fail, 3 skipped. A red in a test already listed as load-sensitive in the backlog (E238/E254/E278 family) is rerun once (single file, then full suite) and is not a gate failure. Any other red is a failure.
  proof: `node scripts/test-lock.mjs -- npm test` (exit 0; report the tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt, then committed `dist/` is byte-identical to a fresh build, `scripts/check-version.mjs` passes against the CURRENT version (4.6.0; the bump belongs to release-engineer), and `npm run check:bookkeeping` and `npm run check:md-tables` exit 0.
  proof: `npm run build && git status --porcelain dist/` (expect empty); `node scripts/check-version.mjs; echo exit=$?`; `npm run check:bookkeeping; echo exit=$?`; `npm run check:md-tables; echo exit=$?`.

- **AC5** — Given the dependency set, when audited, then `npm audit --audit-level=high` exits 0 (counts reported), and `package.json` and `package-lock.json` are byte-identical to `v4.6.0`.
  proof: `npm audit --audit-level=high; echo exit=$?`; `git diff --stat v4.6.0..HEAD -- package.json package-lock.json` (expect empty).

- **AC6** — Given the `agc check`-class checks, when run on HEAD, then they pass: `agc check` exits 0 at the CURRENT 4.6.0 stamps in `CLAUDE.md`, `AGENTS.md` and `.antigravityrules` (the new version and stamps belong to release-engineer), and `node scripts/check-transitions-sync.mjs` passes.
  proof: `node bin/agc-init.mjs check; echo exit=$?`; `node scripts/check-transitions-sync.mjs; echo exit=$?`.

- **AC7** — Given the E286 content change, when the built `integrator` bundle is inspected, then: (a) `buildPromptForRole` output for `integrator` (from `dist/prompts/build.js`) contains the `### Mid-wave base fix` heading, the `git merge-tree --write-tree` read-only sentence under Constitution §6, and the Decision rights row for a base-fix merge; (b) the constitution segment is unchanged, so no other role bundle changes: `content/const-15-core-tail.md` has an empty diff since `v4.6.0`, and the compose-golden, context-budget and `e269-budget-title-sync` tests pass with the goldens and ceilings untouched; (c) `docs/lane-protocol.md` has the `## 7.` lane-side base-fix section with the E282 merge-base (`<target>...HEAD`) sentence, and the E286 / E178a / E296 / E177a content-pin tests pass.
  proof: `node --input-type=module -e "import * as b from './dist/prompts/build.js'; const s = JSON.stringify(b.buildPromptForRole('skill-integrator.md','x', process.cwd())); console.log(s.includes('### Mid-wave base fix'), s.includes('merge-tree --write-tree'), s.includes('base-fix merge'))"` (expect `true true true`); `grep -n -E '^## 7\.|\.\.\.HEAD' docs/lane-protocol.md`; `node --test test/e286-integrator-trust-and-git.test.mjs test/e178a-integrator-role.test.mjs test/e296-manifest-tier.test.mjs test/e177a-manifest.test.mjs test/context-budget.test.mjs test/e269-budget-title-sync.test.mjs test/compose-equivalence.test.mjs`.

- **AC8** — Given the E320/E319/E317/E312 code changes, when the compiled output is exercised, then the fixed behaviours hold. `verify-release.mjs --ci-check --sha` queries by commit and FAILs when no completed run exists, while the no-`--sha` and `--strict` paths are unchanged and `test/verify-release.test.mjs` (E238 timing) has an empty diff since `v4.6.0`. `parseDesignMode` returns `image` for `image (no Figma)` and `no-design` for `no-design (no Figma)`. No `.current/.current/` telemetry file is written for a `.current` `workspace_path`. The handoff read path tolerates an in-flight flat-to-lane migration.
  proof: `node --test test/e320-ci-check-sha.test.mjs test/verify-release.test.mjs test/source-credibility-gate.test.mjs test/visual-evidence-gate.test.mjs test/e303-zod-boundary-telemetry.test.mjs test/e312-read-path-race.test.mjs test/e123b9-lane-flip.test.mjs`; `git diff --stat v4.6.0..HEAD -- test/verify-release.test.mjs` (expect empty).

- **AC9** — Given the `v4.6.0` shipped behaviour, when the current tree is checked, then it is unregressed. The `v4.6.0` tag resolves to `807828a`, `CHANGELOG.md` has the `[4.6.0]` entry, `HOP_CAP` is 14, `GATE_REGISTRY` has 34 entries, and the v4.6.0 behaviour tests pass.
  proof: `git rev-parse v4.6.0^{commit}` (expect `807828a16f86d092cd649fde2675c191a7ff4f49`); `grep -n '\[4.6.0\]' CHANGELOG.md`; `node --input-type=module -e "import {GATE_REGISTRY} from './dist/gates/registry.js'; console.log(Object.keys(GATE_REGISTRY).length)"` (expect 34); `node --test test/hop-count-transitions.test.mjs test/dispatch-pins.test.mjs test/e308-single-source-tier-enum.test.mjs test/error-code-contract.test.mjs test/e35-pipeline-order.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e297-main-protected-sop.test.mjs test/e298-finish-remote-delete.test.mjs test/e299-check-bookkeeping.test.mjs`.

QA writes PASS only if all of AC1-AC9 hold.

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
- **Choosing the semver** (v4.6.1 PATCH or v4.7.0 MINOR, see Problem Statement), the **version bump** (`package.json`, the `index.ts` Server literal), the **CHANGELOG entry**, the **three `agc-version` stamps**, **`agc check` at the new version**, the **`release/*` branch and PR** (main is protected, E297), the **tag and GitHub release**, and **evidence archiving** all belong to release-engineer's SOP.
- **Leak rule (carries forward)**: the release commit uses the noreply email from `.git/config`. The CHANGELOG, release notes and tag message contain no local paths, usernames, or adopter/customer names. This spec contains none.
- Follow-ups filed by the wave-4 lanes (E317-NEW-1, E321-NEW-1, E312-NEW-1, and E322-E325) are not verified or fixed here.
- No code, test or content edits. A red found by QA routes back to the coordinator and is not fixed inside this feature.

## Dependencies / Prerequisites
- `release-v4.6.0` is released (tag `v4.6.0`, `807828a`). New `active_feature` `release-post-v4-w4` on the primary workspace, no lane.
- QA PASS of T-RELW4-01..04 is release-engineer's precondition. Dispatch: PM to qa-engineer via the evidence-only single-role judge-dispatch edge, the same edge v4.5.0 and v4.6.0 used.
- No `design/release-post-v4-w4.md`; `## Mode` is not armed and the feature is non-visual.
- No external references: the Resource Audit Gate hits are internal spec and doc pointers only, so the `external_refs` field is omitted.
- Known advisory: the `T-REL4-02` drift note is ignored per the human's standing instruction; do not `tw_sync`.
- QA runs the suite under the test lock.

## Task Format
- [ ] T-RELW4-01 [P0] qa-engineer: verify AC1 + AC2 (diff-path classification since v4.6.0; per-lane review/qa evidence, closed PASS handoffs and ledgers for e320, e286, e312; backlog done-marks and merge shas) | depends_on: none
- [ ] T-RELW4-02 [P0] qa-engineer: verify AC3 + AC4 + AC5 + AC6 (full suite under test lock, clean build, check-version at 4.6.0, check:bookkeeping, check:md-tables, npm audit, agc check, transitions-sync) | depends_on: none
- [ ] T-RELW4-03 [P0] qa-engineer: verify AC7 (E286 Mid-wave base fix composed into the integrator bundle; const-15, goldens and budget untouched; lane-protocol §7 and content-pin tests) | depends_on: none
- [ ] T-RELW4-04 [P0] qa-engineer: verify AC8 + AC9 (E320/E319/E317/E312 fixed behaviours on compiled output; v4.6.0 non-regression) | depends_on: none
