# release-v4.6.0

## Problem Statement
`main` @ `0573db5` (clean, in sync with origin) is 164 commits past the `v4.5.0` tag (`5ac2b0d`, `package.json` 4.5.0). The change set is three fan-out waves, merged by pull requests #1-#10: post-v4-w1 (lanes e297, e298, e299, e300; plan `specs/fanout-post-v4-w1.md`), post-v4-w2 (lane e295; `specs/fanout-post-v4-w2.md`) and post-v4-w3 (lanes e296, e308; `specs/fanout-post-v4-w3.md`), plus bookkeeping. The human listed E297-E301, E303, E308 and E296/E309. Two scope notes. (1) Lane **e295** (`feat/e295-hop-cap-and-sop-halves`, PR #8, E295 hop cap 14 plus the SOP halves of E298/E299/E300 and E301) is in `git log v4.5.0..HEAD` but was not in the human's list; it is IN scope here, since it is the carrier for E301. (2) E301 and E309 are not lanes of their own: E301 landed in lane e295 as T-E301-01 (backlog row E301, commit `337bcb2`, merge `6985b3a`), and E309 was folded into lane e296 as T-E296-02 (commit `e4847c1`, merge `8847b80`). E303 landed in lane e308 as T-E303-01.

Unlike the v4.5.0 gate this is a substantive MINOR release: it changes code and shipped governance content. Code: `HOP_CAP` 10 to 14 with the `ROUND_CAP`-shaped `(pm, In_Progress)` landing (E295/E41); a closed `dispatch_pins` tier enum at the tool boundary with `DISPATCH_PIN_TIER_REJECTED` (a new gate-registry entry, E300) single-sourced from `MODEL_TIERS` (E308) and zod-boundary telemetry (E303); `MODEL_TIERS` gains `fable` (E297); `scripts/check-bookkeeping.mjs` and the `check:bookkeeping` npm script (E299); `agc feature finish --shipped` deleting the remote lane branch (E298 code half); the manifest tier of cut approval (`cutApprovalAutoTier.manifest` in `tools/config.ts`, optional 9th `approval` column in `tools/fanout-manifest.ts`, `scripts/fanout.mjs`, E296); `scripts/check-md-tables.mjs` E88 advisory promoted to a failure; `.github/workflows/ci.yml` push triggers widened (E298). Content: `const-01` (hop cap 14), `const-08` (manifest tier), `const-15` (`git pull --ff-only` on `main`, E297), `coord-02`, `coord-03`, `skill-integrator`, `skill-pm`, `skill-release-engineer` (main is protected; releases land via a `release/v4.6.0` PR, E297), the context-budget ceilings and 12 `test/fixtures` goldens. `package.json` gains only the `check:bookkeeping` script (no dependency change). Evidence supports MINOR; the final bump is release-engineer's call.

No one has yet verified that all eight lanes' evidence still stands on the committed main tree as a whole. This is an evidence-only release gate: no new code is written here.

## User Stories
- As release-engineer, I want a QA PASS confirming each lane's evidence is present and green on main, the suite, build, audit and version checks are green, and the rule/bundle changes are composed into the role bundles, so that I can execute the release (version bump, CHANGELOG, adapter stamps, `agc check`, `release/v4.6.0` PR, tag/release) without re-litigating closed lane work.

## Acceptance Criteria

- **AC1** — Given the commits since `v4.5.0`, when the diff is classified, then every changed path belongs to one of the lane/bookkeeping classes below, `package.json` differs from `v4.5.0` by exactly the `check:bookkeeping` script line, `package-lock.json`, `tsconfig*` are untouched and `schema/`, `guards/`, `transport/`, `lib/`, `prompts/`, `templates/` and `index.ts` do not appear. Classes: E295 (`tools/transitions.ts`, `content/const-01-core-head.md`, `content/coord-03-core-fallback.md`, `docs/lane-protocol.md`, `specs/e295-*`, `specs/d2-server-brake-accounting*.md`, `specs/fanout-post-v4-w2.md`); E297 (`tools/skill-frontmatter.ts`, `content/skill-integrator.md`, `content/skill-release-engineer.md`, `content/const-15-core-tail.md`, `specs/e297-*`, `docs/integrator-*.md`, `specs/fanout-post-v4-w1.md`); E298 (`.github/workflows/ci.yml`, `bin/agc-init.mjs`, `content/skill-integrator.md`); E299 (`scripts/check-bookkeeping.mjs`, `scripts/check-md-tables.mjs`, `package.json`, `specs/e299-*`); E300 (`tools/registry.ts`, `tools/handoff-parse.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts`, `content/coord-02-host-dispatch.md`, `docs/config.md`); E301 (check-bookkeeping basename resolution, the Evidence-Citation Convention text in `content/coord-03-core-fallback.md`, `content/skill-release-engineer.md`); E296/E309 (`content/const-08-chain-31-mid.md`, `content/skill-pm.md`, `content/skill-integrator.md`, `tools/config.ts`, `tools/fanout-manifest.ts`, `scripts/fanout.mjs`, `docs/lane-protocol.md`, `specs/e296-*`, `specs/fanout-post-v4-w3.md`); E308/E303 (`tools/registry.ts`, `tools/skill-frontmatter.ts`, `tools/handoff-parse.ts`, `specs/e308-*`); tests and `test/fixtures/compose-golden/**` (qa-owned, per lane); `dist/**` rebuilt outputs; bookkeeping (`docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `tasks.md`, `.current/**`, `qa_reports/`, `review_reports/`). A path that fits no class is a finding to report.
  proof: `git diff --name-only v4.5.0..HEAD`; `git log --oneline v4.5.0..HEAD`; `git diff --name-only v4.5.0..HEAD -- package-lock.json 'tsconfig*' schema guards transport lib prompts templates index.ts` (expect empty); `git diff v4.5.0..HEAD -- package.json` (expect exactly the one `check:bookkeeping` script line).

- **AC2** — Given the eight lane features, when each lane's evidence is inspected on the committed main tree, then each has the code-reviewer APPROVED and qa PASS records named below (the latest verdict on each file governs; earlier CHANGES_REQUESTED rounds closed by a later APPROVED are not failures) and `.current/history/2026-10/<lane>/handoff.md` reads `status: "PASS"` and `last_agent: "qa-engineer"`. Lanes and features: e297 `e297-main-protected-sop` (T-E297-01..06; `qa_reports/review_T-E297-01..06.md`, `review_reports/review_T-E297-05.md`); e298 `e298-ci-triggers-finish-remote-delete` (T-E298-01, 02; `qa_reports/review_T-E298-01..02.md`, `review_reports/review_T-E298-01..02.md`); e299 `e299-check-bookkeeping` (T-E299-01..05; `qa_reports/review_T-E299-01..05.md`, `expected-red_e299-check-bookkeeping.txt`, `review_reports/review_T-E299-01.md`); e300 `e300-dispatch-pins-enum` (T-E300-01..04; `qa_reports/review_T-E300-01..04.md`, `expected-red_e300-dispatch-pins-enum.txt`, `review_reports/review_T-E300-01.md`); e295 `e295-hop-cap-and-sop-halves` (T-E295-01, 02, T-E298-01, T-E300-01, T-E301-01; batched `qa_reports/review_E295_T-E295-01-05.md`, `review_reports/review_T-E295-01.md`); e296 `e296-ci-render-hash-fix` (T-E296-01..07, plus T-E296-08 if present in its ledger; E309 is T-E296-02; `qa_reports/review_T-E296-01..08.md`, `review_reports/review_T-E296-01.md`); e308 `e308-tier-enum-and-zod-telemetry` (T-E308-01, T-E303-01, T-E308-02; `qa_reports/review_T-E308-0{1,2}.md`, `review_T-E303-01.md`, `review_reports/review_T-E308-01.md`, `review_T-E303-01.md`). Known quirk, not a failure: task ids T-E298-01 and T-E300-01 were reused by wave 2 (backlog E310), so those basenames hold wave-1 and wave-2 evidence; QA reads both. Each backlog done-mark for E295-E301, E303, E308, E309, E41 must name an evidence path that exists in the tree.
  proof: `grep -n -i -E 'verdict|round' review_reports/*E{295,296,297,298,299,300,303,308}*`; `grep -n -i -E 'PASS|FAIL' qa_reports/review_T-E{295,296,297,298,299,300,303,308}-*.md qa_reports/review_E295_*.md`; `grep -E '^(active_feature|status|last_agent):' .current/history/2026-10/e{295,296,297,298,299,300,308}/handoff.md`; `grep -n -E '^\| (E295|E296|E297|E298|E299|E300|E301|E303|E308|E309|E41) ' docs/backlog.md` (each reads DONE).

- **AC3** — Given the committed HEAD tree, when the full test suite runs under the test lock, then it exits 0 with zero failures and the tally (total/pass/skipped) is reported. A red in a test already listed as load-sensitive in the backlog (E238/E254/E278 family) is rerun once (single file, then full suite) and is not a gate failure; any other red is. The suite includes `check:bookkeeping` (E299) and the md-table check.
  proof: `node scripts/test-lock.mjs -- npm test` (exit 0; report the tally).

- **AC4** — Given the committed HEAD tree, when the project is rebuilt, then committed `dist/` is byte-identical to a fresh build, `scripts/check-version.mjs` passes against the CURRENT version (4.5.0; the bump is release-engineer's), and `npm run check:bookkeeping` and `npm run check:md-tables` exit 0.
  proof: `npm run build && git status --porcelain dist/` (expect empty); `node scripts/check-version.mjs` (exit 0); `npm run check:bookkeeping; echo exit=$?`; `npm run check:md-tables; echo exit=$?`.

- **AC5** — Given the dependency set, when audited, then `npm audit --audit-level=high` exits 0 (counts reported) and `package.json` `dependencies`/`devDependencies` and `package-lock.json` are unchanged since `v4.5.0`.
  proof: `npm audit --audit-level=high; echo exit=$?`; `git diff --stat v4.5.0..HEAD -- package-lock.json` (expect empty); `git diff v4.5.0..HEAD -- package.json` (scripts line only).

- **AC6** — Given the `agc check`-class checks, when run on HEAD, then they pass: `agc check` compares the three adapter stamps (`CLAUDE.md`, `AGENTS.md`, `.antigravityrules`) against the installed version and exits 0 at the CURRENT 4.5.0 stamps (the bump to 4.6.0 and the three stamps are release-engineer's); `node scripts/check-transitions-sync.mjs` passes.
  proof: `node bin/agc-init.mjs check; echo exit=$?`; `node scripts/check-transitions-sync.mjs; echo exit=$?`.

- **AC7** — Given the rule and bundle changes, when the built role bundles are inspected, then: (a) `buildPromptForRole` output (from `dist/prompts/build.js`) for `sr-engineer`, `pm` and `qa-engineer` contains the `hop` cap row with `14` and not `| 10 |`, the `git pull --ff-only` base-list sentence (E297), and for `pm` the `Manifest-Tier Self-Attestation` row and `## Cut` schema section (E296/E309); (b) the `teamwork` bundle contains the E295 same-lane continuation conditions and the E300 `DISPATCH_PIN_TIER_REJECTED` / `dispatch_pins_advisory` sentence; (c) the `integrator` bundle carries the E298 CI-first Stage 5a/5b/6-4 wording (no local full suite before push) and the E299 `check:bookkeeping` 5c line; (d) `release-engineer` carries the no-push-to-main rule, and the E301 rule that 7a does not rewrite citations; (e) the 12 `test/fixtures/compose-golden/*` files and the context-budget ceilings and the `skill-pm` cap in `test/context-budget.test.mjs` are consistent with the built bundles (measured values at or under the ceilings; titles match numbers) and the compose-golden, context-budget and `e269-budget-title-sync` tests pass.
  proof: `node --input-type=module -e` importing `dist/prompts/build.js` `buildPromptForRole` for the roles above and grepping each marker; `git diff --stat v4.5.0..HEAD -- test/fixtures`; `node --test test/context-budget.test.mjs test/e269-budget-title-sync.test.mjs test/compose-equivalence.test.mjs test/e178a-integrator-role.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e297-main-protected-sop.test.mjs`.

- **AC8** — Given the E295/E300/E308 code changes, when the compiled server is exercised, then the behaviours hold: `validateTransition` from `code-reviewer:In_Progress` and `qa-engineer:In_Progress` at `hop_count >= 14` allows the `(pm, In_Progress)` edge and rejects other edges; a `tw_update_state` with a `dispatch_pins` value outside `opus|sonnet|haiku|fable` is rejected with `DISPATCH_PIN_TIER_REJECTED` naming role and value; the tool input-schema enums deep-equal `MODEL_TIERS`; `GATE_REGISTRY` has 34 entries.
  proof: `node --test test/hop-count-transitions.test.mjs test/dispatch-pins.test.mjs test/e308-single-source-tier-enum.test.mjs test/e303-zod-boundary-telemetry.test.mjs test/error-code-contract.test.mjs test/e35-pipeline-order.test.mjs test/e298-finish-remote-delete.test.mjs test/e299-check-bookkeeping.test.mjs`.

- **AC9** — Given the `v4.5.0` shipped behaviour, when the current tree is checked, then it is unregressed: the `release-v4.5.0` record is intact.
  proof: `git rev-parse v4.5.0^{commit}` (expect `5ac2b0d`); `grep -n '\[4.5.0\]' CHANGELOG.md`; `node --test test/e246-mailbox-teardown.test.mjs test/e178a-integrator-role.test.mjs test/e258b-comment-scan.test.mjs`.

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
- **Version bump** (4.5.0 to 4.6.0, MINOR, final call release-engineer's), **CHANGELOG entry**, **three adapter stamps**, **`agc check` at the new version**, the **`release/v4.6.0` branch, PR (main is protected, E297), tag and GitHub release**, and **evidence archiving** (including the E310 archive-folder basename collision for T-E298-01 / T-E300-01) are release-engineer's SOP.
- **Leak rule (carries forward)**: release commit email from `.git/config` (noreply); CHANGELOG, release notes and tag message contain no local paths, usernames, or adopter/customer names. This spec contains none.
- Open follow-ups filed by the lanes (E310, E312-E321 and others) are not verified or fixed here.

## Dependencies / Prerequisites
- `release-v4.5.0` is released (tag `v4.5.0`, `5ac2b0d`); its feature lease is stale. New `active_feature` `release-v4.6.0` on the primary workspace, no lane.
- QA PASS of T-REL460-01..04 is release-engineer's precondition. Dispatch: PM to qa-engineer via the evidence-only single-role judge-dispatch edge, as v4.5.0 did.
- No `design/release-v4.6.0.md`; `## Mode` not armed, non-visual feature.
- No external references: Resource Audit Gate hits are internal spec/doc pointers only; `external_refs` field omitted.
- Known advisory: `T-REL4-02` drift note ignored per the human's standing instruction; do not `tw_sync`.
- QA runs the suite under the test lock.

## Task Format
- [ ] T-REL460-01 [P0] qa-engineer: verify AC1 + AC2 (diff-path classification since v4.5.0; per-lane review/qa evidence and PASS handoffs for e295, e296, e297, e298, e299, e300, e308; backlog done-marks cite existing paths) | depends_on: none
- [ ] T-REL460-02 [P0] qa-engineer: verify AC3 + AC4 + AC5 + AC6 (full suite under test lock, clean build, check-version, check:bookkeeping, check:md-tables, npm audit, agc check, transitions-sync) | depends_on: none
- [ ] T-REL460-03 [P0] qa-engineer: verify AC7 (rule/SOP changes composed into the built role bundles; goldens and budget ceilings consistent) | depends_on: none
- [ ] T-REL460-04 [P0] qa-engineer: verify AC8 + AC9 (hop-cap, dispatch-pin enum, single-source tier, gate-count behaviours on compiled output; v4.5.0 non-regression) | depends_on: none
