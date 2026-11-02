# e391-prompt-audit-stale-facts — E391

Lane `e391`, prompt-audit wave 1 (`specs/fanout-e391-prompt-audit.md`). Branch `feat/e391-prompt-audit-stale-facts`, worktree `../agent-governance-mcp-lanes/e391`, dispatch base `664e147`. Mini-chain: pm → sr-engineer → code-reviewer → qa-engineer, no architect. Wording only: 14 findings from `docs/prompt-audit-2026-11-02.md` §3 (ten in `content/`, four in `CLAUDE.md`). Spec sources: the backlog row E391 and report §3. The report's §5 hunks are proposals; sr-engineer re-checks each one against the current file before applying it, and this spec's **Copy / Strings** table overrides a §5 hunk wherever they differ (the reasons are in Decisions).

## Decisions

| date | who | decision | rationale |
|---|---|---|---|
| 2026-11-02 | pm | **G2-05 uses the manifest default.** The design-auditor "Hard limits" line points to the `fix_try` and `read` caps by name. No new Limits row, no `needs human ruling` item. | The line already says its limits come from "constitution §5 Anti-Loop", so the §5 caps are the limits it meant. Its numbers (3, 5) disagree with the Limits table (`fix_try` 2, `read` 3), and `const-01` says skills must not restate a cap's number. Effect on behaviour, stated so the reviewer is not surprised: the auditor's per-surface ceilings become 2 consecutive extraction attempts and 3 file reads, the values the Limits table already gives every role. The human approved this default in the manifest Decisions (2026-11-02). |
| 2026-11-02 | pm | **G2-15: the report hunk's "Its tools never run git" is false and is not applied.** The new wording says the `tw_*` tools never **write** to git, and that some **read** it. | Checked at base: `tools/feature-rollup.ts` (via `tools/lane-registry.ts`, which feeds `tw_get_state`'s `lane_registry`) runs `git worktree list`, and `tools/tasks-lane-migrate.ts` (via `tools/tasks-file.ts`) runs `git check-ignore`. No `tools/*.ts` module reached from a `tw_*` handler runs a git command that changes state. |
| 2026-11-02 | pm | **G2-03 / G2-13: no number at all.** The test line points at the server-recorded `suite-result:` line in the release's QA evidence, and the hook line points at the command that measures its size. The report's "~27 KB at v4.16.0" is not used. | Any number goes stale. The hook size also depends on the workspace: `node bin/agent-governance-context.mjs \| wc -c` gives 25,536 bytes in this worktree today, while the report measured 27,194. |
| 2026-11-02 | pm | **Budget-driven wording for the three files in the lean/chain compositions** (`const-08`, `const-15`, `skill-coordinator-lite`). These sites use shorter text than the report's §5 hunks: const-08 line 2 is `coordinator: \`skill-coordinator\` *Cut-approval gate writer obligation*`; const-08 line 4 only drops `.md`; const-15 line 6 is `Stop conditions: \`skill-coordinator\` §Escalation Routes.`; lite line 16 uses the colon form; lite line 49 drops the report's added `(content/coord-04-host-watermark.md)` parenthetical. | Measured at base, the ceilings in `test/context-budget.test.mjs` have 3 / 0 / 3 chars of slack (lean / design-arm stripped / non-design). The report's const-08 and lite hunks grow by +15 and +80 chars and would fail them. The dropped parenthetical is also a workspace-relative `content/` path, the exact problem G2-12 fixes. A dry run of the Copy / Strings set gives the after-values under AC-BUDGET. |
| 2026-11-02 | pm | **The `test/context-budget.test.mjs` caps are not lowered** to the new, smaller measurements. The file is not edited. | The manifest says E393 depends on the headroom E391 frees ("E393 依賴 E391 的字數餘裕"). Lowering the caps to zero headroom would take that headroom back. The integrator may overrule this at pre-review. |
| 2026-11-02 | pm | **qa-engineer adds `test/e391-prompt-audit-stale-facts.test.mjs`** (pre-authorized by the manifest's `test/e391-*.test.mjs` token). It checks the AC proofs below: each stale string is gone, and each new pointer leads to a heading or paragraph that exists. | Without a test, the dangling references this ticket fixes can come back without anyone noticing. The test reads only `content/**` and `CLAUDE.md`. It asserts nothing about the real `specs/fanout-*.md` and does not diff against a fixed base sha. |

## Verified facts (base `664e147`)

| fact | value | how checked |
|---|---|---|
| `GATE_REGISTRY` entries | 35 | `grep -c 'errorCode: "' gates/registry.ts` → 35 (the `GateErrorCode` union also has 35 members). `gates/` holds 12 predicate modules plus `registry.ts` and `pipeline.ts` (14 files). `guards/` holds 2 files. |
| `HOP_CAP` | 14 | `tools/transitions.ts:326` `const HOP_CAP = 14;` and `content/const-01-core-head.md:16` (`hop` cap 14) |
| `fix_try` / `read` caps | 2 / 3 | `content/const-01-core-head.md:17-18` |
| `tools/role.ts` lite check | none | `ROLE_SKILL_MAP` has 9 roles and no `lite` branch. Only the four write tools reject a lite caller (no `agent_id`). |
| `coord-03` anchors | present | `content/coord-03-core-fallback.md:5` "Stop conditions: see `## Escalation Routes`"; `:19` `## Escalation Routes`; `:43` **Cut-approval gate writer obligation**; `:45` **Auto-tier writer action**. The **Manifest-tier writer action** paragraph is also in coord-03. |
| `skill-pm` "2a-bis" | absent | `grep -c 2a-bis content/skill-pm.md` → 0. The Gate Summary row **Geometric-Density Split Gate** is at `content/skill-pm.md:104`. |
| `<agc install>/…` convention | present | `content/skill-integrator.md:68` ("`<agc install>` is the directory agc is in…") and `content/skill-pm.md:112` ("`<agc install>` = agc's install directory") |
| hook size (G2-13) | 25,536 B | `node bin/agent-governance-context.mjs \| wc -c` in this worktree (the report measured 27,194 B in primary). The size depends on the workspace. |
| test files | 221 | `ls test/*.test.mjs \| wc -l`. The CLAUDE.md "221" is correct today. See Findings filed. |
| `check-version.mjs` checks | 5 | index.ts Server() literal = package.json; `dist/index.js` literal parity; `package-lock.json` root + `packages[""]` version parity (E60); highest CHANGELOG `## [x.y.z]` heading; git tag (advisory only). Read from `scripts/check-version.mjs`. |
| Layout omissions (G2-24) | 4 entries exist | `lib/render-boundary.ts` (`renderDataBlock`, the reported-data fence; imported by `prompts/build.ts`), `tools/lane-paths.ts` (lane-layout seam, the only owner of the lane-scoped `.current/` filenames), `tools/fanout-manifest.ts` + `tools/fanout-handoff.ts` (manifest parse/render/check plus the wave handoff section, used by `scripts/fanout.mjs`), `tools/lane-status.ts` (integrator lane observability and roll-up, used by `scripts/lane-status.mjs`) |
| `tw_*` tools and git | read-only | See Decisions G2-15 |
| composition tags | — | `prompts/constitution-manifest.ts`: `const-08` is `chain` (not in lean), `const-15` is `core` (in every composition). The lean bundle in `test/context-budget.test.mjs:190-200` is `composeConstitution({chain:false, design:true})` + the raw `content/skill-coordinator-lite.md`. `prompts/skill-manifest.ts` does not compose `skill-coordinator-lite.md`; it is read whole. `constitution-rationale.md`, `skill-design-auditor.md`, `skill-doc-writer.md`, `skill-qa-*.md` and `skill-release-engineer.md` are in no budgeted composition. `skill-qa-engineer.md` has a byte cap of 18,500 (`test/qa-visual-skill-split.test.mjs` AC-5), currently 18,253 B. |
| budget ceilings at base | lean 5723 (char slack 3); design-arm stripped 10598 (slack 0); teamwork bundle 21593 of cap 21715; non-design 8501 (slack 3) | `node scripts/measure-context-cost.mjs` → "bundle lean (post-strip): 5723 ~tokens"; per-ceiling slack measured with the same formulas as `test/context-budget.test.mjs` |

Current site lines (re-verified; the manifest's line numbers hold for `content/`; the `CLAUDE.md` lines differ from the report's):

| finding | file:line at base |
|---|---|
| G2-02 | `content/skill-release-engineer.md:292` |
| G2-04 | `content/constitution-rationale.md:173-174` |
| G2-08 | `content/constitution-rationale.md:3,10,15`; `content/skill-doc-writer.md:13` |
| G2-05 | `content/skill-design-auditor.md:71` |
| G2-07 | `content/skill-design-auditor.md:89` |
| G2-06 + G2-18 | `content/const-08-chain-31-mid.md:2` |
| G2-18 | `content/const-08-chain-31-mid.md:4`; `content/skill-coordinator-lite.md:49` |
| G2-11 | `content/skill-coordinator-lite.md:16` |
| G2-12 | `content/skill-qa-engineer.md:60,95,101`; `content/skill-qa-visual.md:24` |
| G2-26 | `content/const-15-core-tail.md:6` |
| G2-03 | `CLAUDE.md:159` |
| G2-13 | `CLAUDE.md:191` |
| G2-15 | `CLAUDE.md:180` |
| G2-24 | `CLAUDE.md:99` (lib/), after `:87` (last `tools/` row), `:121` (check-version) |

## Problem Statement

The prompts this server injects, and this repo's own `CLAUDE.md`, contain stale facts and references that point nowhere. Two examples: a gate count of 33 (the registry has 35), and a hop cap of 10 (it is 14). Others name things that no longer exist: `content/constitution.md`, `skill-coordinator.md` stop-condition 6, `skill-pm` step 2a-bis, a `skill-coordinator` §Auto-Routing stop list. One claims the server rejects something it does not reject (lite `tw_switch_role`). Some give paths relative to the wrong root (`content/skill-qa-visual.md` from an adopter workspace). `CLAUDE.md` pins numbers that have already gone stale (1633 tests, ~18.7KB), says the server is out of the git workflow when the constitution governs that workflow, and leaves out four 4.x modules. An agent that follows these instructions reads files that do not exist, applies the wrong limits, or trusts a server check that is not there. The fix is wording only: no gate, routing, schema or error-code semantics change.

## User Stories

- As a role agent loaded with an agc SOP, I want every cap, count, file, section and path the SOP cites to exist and match the code, so that I never act on a limit or a reference that is not there.
- As a maintainer reading `CLAUDE.md`, I want facts that either point at their source of truth or describe it accurately, so that the file does not go stale with every release.
- As the E393 lane, I want E391 to leave the lean and chain context budgets net-negative, so that the §3.2 lift has headroom.

## Acceptance Criteria

All proofs run in the worktree on the final committed HEAD. "Stale string gone" proofs use fixed-string `grep -cF` (0 = absent). Each AC is pinned again in `test/e391-prompt-audit-stale-facts.test.mjs` (T-E391-06).

### content/ findings

- **AC-G2-02** — Given `content/skill-release-engineer.md` line 292, when the "Expected vs unrelated scope rule" paragraph names `gates/registry.ts`, then it names the registry symbol `GATE_REGISTRY` and no gate count. No other line of the file changes (the `:130-137` narrative belongs to E394).
  proof: `grep -cF "33 gate definitions" content/skill-release-engineer.md` → `0`; `grep -cF '`gates/registry.ts` (`GATE_REGISTRY`)' content/skill-release-engineer.md` → `1`; `git diff -U0 664e147 -- content/skill-release-engineer.md | grep -c '^@@'` → `1`.
- **AC-G2-04** — Given `content/constitution-rationale.md` §5, when it lists the anti-loop caps, then it names the `fix_try`, `read` and `hop` caps and gives no number for them.
  proof: `grep -cE "max 10 role transitions|max 2 consecutive auto-fix|max 3 reads per target" content/constitution-rationale.md` → `0`; `grep -cF 'the `fix_try`, `read`, and `hop` caps' content/constitution-rationale.md` → `1`.
- **AC-G2-05** — Given `content/skill-design-auditor.md` step 3, when it states the per-surface hard limits, then it bounds extraction attempts by the `fix_try` cap and file reads by the `read` cap, with no numbers, and adds no Limits row (`content/const-01-core-head.md` unchanged).
  proof: `grep -cE "max 3 extraction attempts|max 5 files read" content/skill-design-auditor.md` → `0`; `grep -cF 'bounded by the `fix_try` cap and file reads per surface by the `read` cap' content/skill-design-auditor.md` → `1`; `git diff --quiet 664e147 -- content/const-01-core-head.md; echo $?` → `0`.
- **AC-G2-06** — Given `content/const-08-chain-31-mid.md` line 2 (Cut-Approval Gate), when it points at the coordinator's writer obligation, then it names `skill-coordinator` *Cut-approval gate writer obligation*, which is a bold paragraph label in `content/coord-03-core-fallback.md`. "stop-condition 6" is gone.
  proof: `grep -cF "stop-condition 6" content/const-08-chain-31-mid.md` → `0`; `grep -cF '`skill-coordinator` *Cut-approval gate writer obligation*' content/const-08-chain-31-mid.md` → `1`; `grep -cF "**Cut-approval gate writer obligation**" content/coord-03-core-fallback.md` → `1`.
- **AC-G2-07** — Given `content/skill-design-auditor.md` line 89 (Geometric-density flag), when it points at PM's split gate, then it cites `skill-pm` Gate Summary and not a step number. The **Geometric-Density Split Gate** row it names exists there.
  proof: `grep -cF "2a-bis" content/skill-design-auditor.md` → `0`; `grep -cF '(`skill-pm` Gate Summary)' content/skill-design-auditor.md` → `1`; `grep -cF "| **Geometric-Density Split Gate** |" content/skill-pm.md` → `1`.
- **AC-G2-08** — Given `content/constitution-rationale.md` (lines 3, 10, 15) and `content/skill-doc-writer.md` (line 13), when they name the constitution's files, then they name `content/const-*.md`, and doc-writer's do-not-edit list also names `content/coord-*.md`. `content/constitution.md`, `(v3.27.0)` on line 3 and `Rationale target: v3.32.0` are gone. Lines 39 and 77 of the rationale (rule-origin version tags) are unchanged.
  proof: `grep -cF "content/constitution.md" content/constitution-rationale.md content/skill-doc-writer.md` → `…:0` for both; `grep -cF "Rationale target" content/constitution-rationale.md` → `0`; `grep -cF '`content/const-*.md`, `content/coord-*.md`' content/skill-doc-writer.md` → `1`.
- **AC-G2-11** — Given `content/skill-coordinator-lite.md` line 16, when it lists the tools lite must not call, then it says the four write tools are rejected by the server and `tw_switch_role` is forbidden by this SOP. It no longer says the server rejects `tw_switch_role`.
  proof: `grep -cF "will be rejected" content/skill-coordinator-lite.md` → `0`; `grep -cF '`tw_rollback_task`: server-rejected; `tw_switch_role`: SOP-forbidden.' content/skill-coordinator-lite.md` → `1`.
- **AC-G2-12** — Given `content/skill-qa-engineer.md` lines 60, 95, 101 and `content/skill-qa-visual.md` line 24, when they reference the other QA skill file, then the path is `<agc install>/content/…`, and line 60 defines `<agc install>` once ("agc's install directory, not the workspace"). Lines 13, 59, 66, 92 and 113 of `skill-qa-engineer.md`, and line 65 of `skill-qa-visual.md`, are unchanged.
  proof: `grep -cF '`<agc install>/content/skill-qa-visual.md`' content/skill-qa-engineer.md` → `3`; `grep -cF '`<agc install>/content/skill-qa-engineer.md`' content/skill-qa-visual.md` → `1`; `wc -c < content/skill-qa-engineer.md` ≤ `18500`.
- **AC-G2-18** — Given `content/const-08-chain-31-mid.md` lines 2 and 4 and `content/skill-coordinator-lite.md` line 49, when they cite another skill, then they use the bare name (`skill-coordinator`, `skill-pm`) that the rest of the constitution uses, never a `.md` file name. `const-08` line 12 ("Round 4 of `review_round`", E393) is unchanged.
  proof: `grep -cE '`skill-(coordinator|pm)\.md`' content/const-08-chain-31-mid.md` → `0`; `grep -cF '`skill-coordinator.md`' content/skill-coordinator-lite.md` → `0`; `grep -cF "(Round 4 of \`review_round\`)" content/const-08-chain-31-mid.md` → `1`.
- **AC-G2-26** — Given `content/const-15-core-tail.md` line 6 (Auto-routing hop cap), when it points at the stop-condition list, then it names `skill-coordinator` §Escalation Routes, which is an H2 in `content/coord-03-core-fallback.md`. §Auto-Routing is gone.
  proof: `grep -cF "§Auto-Routing" content/const-15-core-tail.md` → `0`; `grep -cF 'Stop conditions: `skill-coordinator` §Escalation Routes.' content/const-15-core-tail.md` → `1`; `grep -c "^## Escalation Routes$" content/coord-03-core-fallback.md` → `1`.

### CLAUDE.md findings

- **AC-G2-03** — Given `CLAUDE.md` § Testing changes, when it shows how to run `npm test`, then the comment gives no pass count or version. It points at the server-recorded `suite-result:` line in the release's QA evidence under `qa_reports/archive/release-*/`.
  proof: `grep -cE "1633|at v3\.94\.0" CLAUDE.md` → `0`; `grep -cF "suite-result:" CLAUDE.md` → `1`.
- **AC-G2-13** — Given `CLAUDE.md` § Governance context loading, when it describes what the SessionStart hook injects, then it gives no size literal. It names the command that measures the size.
  proof: `grep -cE "18\.7 ?KB|27 ?KB" CLAUDE.md` → `0`; `grep -cF 'node bin/agent-governance-context.mjs | wc -c' CLAUDE.md` → `1`.
- **AC-G2-15** — Given `CLAUDE.md` § What this server does NOT do, when it describes git, then it says the `tw_*` tools never write to git (and that some read it), and that Constitution §6 plus the `skill-release-engineer` / `skill-integrator` SOPs govern the commit / pull-request workflow. The bullet is rewritten, not deleted.
  proof: `grep -cF "Commit/PR workflow is out of scope" CLAUDE.md` → `0`; `grep -cF "never write to git" CLAUDE.md` → `1`; `grep -cF "Constitution §6" CLAUDE.md` ≥ `1`.
- **AC-G2-24** — Given `CLAUDE.md` § Layout, when it lists `lib/` and `tools/`, then it has one row each for `lib/render-boundary.ts`, `tools/lane-paths.ts`, `tools/fanout-*.ts` and `tools/lane-status.ts`. The `scripts/check-version.mjs` row names all five checks the script runs. Every pre-existing Layout row keeps its relative order (rows are added, never moved).
  proof: `grep -cE "^(lib/render-boundary\.ts|tools/lane-paths\.ts|tools/fanout-\*\.ts|tools/lane-status\.ts) " CLAUDE.md` → `4`; `grep "^scripts/check-version.mjs" CLAUDE.md` names `dist/index.js`, `package-lock.json`, `CHANGELOG` and the advisory git tag; `git diff 664e147 -- CLAUDE.md | grep -c "^-[a-z]"` counts only the rewritten rows (`lib/ `, `scripts/check-version.mjs`, `npm test`), with no removed-and-re-added row elsewhere.

### Hard conditions (whole lane)

- **AC-SCOPE** — Given the lane's final HEAD, when it is compared with base `664e147`, then every changed path is in the lane row's owned set, every `content/` file changes only on the lines this spec names, and in `CLAUDE.md` only the four sections Layout / Testing changes / What this server does NOT do / Governance context loading change. The `## Agent Governance` and `## Execution Profile` adapter blocks and the `agc-version:` stamp are byte-identical. No `coord-*.md`, `const-01`, `const-06`, `const-12`, `skill-integrator.md`, `skill-pm.md`, `templates/**`, `tools/**`, `gates/**`, `prompts/**`, `schema/**`, `lib/**`, `bin/**` or `scripts/**` change.
  proof: `node scripts/fanout.mjs check specs/fanout-e391-prompt-audit.md e391 --base 664e147` exit 0, plus `git diff -U0 664e147 -- content/` hunk headers listing only the lines in the site table above.
- **AC-DIST** — Given the final HEAD, when `npm run build` runs, then `dist/` has no diff.
  proof: `npm run build && git status --short dist/` → empty.
- **AC-STAMP** — `node bin/agc-init.mjs check` exits 0.
  proof: `node bin/agc-init.mjs check; echo "exit=$?"` → `exit=0`.
- **AC-BUDGET** — Given `test/context-budget.test.mjs` unchanged, when the suite runs, then every ceiling passes, and each composition's measurement is ≤ its base value. Dry-run expectation for the Copy / Strings set: lean 5723 → 5722 ~tok, design-arm stripped 10598 → 10593, teamwork bundle 21593 → 21588, non-design 8501 → 8495. `measure-context-cost` "bundle lean" 5723 → 5722.
  proof: `node scripts/measure-context-cost.mjs` before/after values recorded in the T-E391-05 QA report; `node --test test/context-budget.test.mjs` green.
- **AC-GOLDEN** — Given the content edits, when `npm run build && node scripts/capture-constitution-golden.mjs` runs, then `git diff --stat test/fixtures/compose-golden/` moves only the const-08 strings (lines 2 and 4) and the const-15 line-6 string. The const-08 strings appear in `constitution-monolith.txt`, `build-full-*.txt` ×4 and `hook-full.txt`; the const-15 string appears in those six plus `build-lite-*.txt` ×4 and `hook-lite.txt`. `skill-coordinator-monolith.txt` is unchanged. QA explains each hunk.
  proof: `node --test test/compose-equivalence.test.mjs` green after re-capture, and the per-hunk explanation in the QA report.
- **AC-SUITE** — Given the final committed HEAD with a clean worktree, when the full suite runs, then it is all green.
  proof: `node scripts/test-lock.mjs -- npm test` on a clean tree (`git status --porcelain` empty); `qa_suite_result` recorded.

## Copy / Strings

The exact replacement text for each site. "report §5" means the text is the report's proposed hunk unchanged. Everything else is `authored-here`, with the reason given. `old` text is quoted only as far as needed to locate the site uniquely.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| g2-02.release-engineer-292 | `` `gates/registry.ts` (`GATE_REGISTRY`) `` (replaces `` `gates/registry.ts` (33 gate definitions) ``) | report §5 (`@@ -289` hunk only) |
| g2-08.rationale-3 | `> Companion to the constitution (`content/const-*.md`, composed per `prompts/constitution-manifest.ts`). This document is **non-normative**:` | report §5 |
| g2-08.rationale-10 | `> Scope: §1, §3.1, §3.2, §5, §6, §7.` | report §5 |
| g2-08.rationale-15 | `` > `content/const-*.md` and the skill files. `` | report §5 |
| g2-04.rationale-173 | `The caps (the `fix_try`, `read`, and `hop` caps — values live in the Constitution's Limits` / `table, not here) exist because an agent's natural response` (two lines, replacing 173-174; line 175 onward unchanged) | report §5 |
| g2-05.design-auditor-71 | `Hard limits: consecutive extraction attempts per surface are bounded by the `fix_try` cap and file reads per surface by the `read` cap (Constitution Limits / §5 Anti-Loop — values live there, not here). On limit, stop and surface what you have so far.` | report §5 |
| g2-07.design-auditor-89 | `` (`skill-pm` Gate Summary) `` (replaces `` (`skill-pm` step 2a-bis) ``; rest of the line unchanged) | authored-here: the bold label just before it already names the Geometric-Density Split Gate. One char longer than the old text, against +40 for the report's form. |
| g2-06.const08-2 | `` (PM inline-present rules: `skill-pm` Gate Summary; coordinator: `skill-coordinator` *Cut-approval gate writer obligation*) `` | authored-here: −3 chars against +15 for the report's form (budget, see Decisions). The italic label matches the coord-03 bold paragraph label. |
| g2-18.const08-4 | `` (`skill-coordinator` auto-tier and manifest-tier writer actions) `` | authored-here: bare name only (−3 chars). The phrase already matches the coord-03 labels **Auto-tier writer action** / **Manifest-tier writer action**. |
| g2-08.doc-writer-13 | `` `content/skill-*.md`, `content/const-*.md`, `content/coord-*.md`, `package.json` `` (replaces `` `content/skill-*.md`, `content/constitution.md`, `package.json` ``) | report §5 |
| g2-11.lite-16 | `` - **Server-read-only.** Lite has no `agent_id` in the routing chain (`tools/transitions.ts`); `tw_update_state` / `tw_add_task` / `tw_complete_task` / `tw_rollback_task`: server-rejected; `tw_switch_role`: SOP-forbidden. Do NOT call them. `` | authored-here: +14 chars against +80 for the report's form (lean budget). The meaning is the report's. |
| g2-18.lite-49 | `` Out-of-scope: ONLY after `Task(…)`; skip after `tw_*`/bash/file. Full rules: `skill-coordinator` §Subagent Reply Watermark Validation. `` | authored-here: the report's `(content/coord-04-host-watermark.md)` parenthetical is dropped. It costs lean budget and is a workspace-relative `content/` path (G2-12). |
| g2-12.qa-engineer-60 | `` - **Present** → Read `<agc install>/content/skill-qa-visual.md` (via the Read tool; `<agc install>` = agc's install directory, not the workspace) and follow its SOP for each baseline row. `` (rest of line unchanged) | authored-here: the report §5 meaning, in the shorter `skill-pm.md:112` definition form (qa-engineer.md has a byte cap) |
| g2-12.qa-engineer-95 | `` (`<agc install>/content/skill-qa-visual.md` Step C) `` | authored-here: the manifest asks for the same convention on line 95 (the report has no hunk for it) |
| g2-12.qa-engineer-101 | `` (`<agc install>/content/skill-qa-visual.md` *Allowed Differences*) `` | authored-here: the manifest asks for the same convention on line 101 (the report has no hunk for it) |
| g2-12.qa-visual-24 | `` (`<agc install>/content/skill-qa-engineer.md` § *Contract Defect vs Implementation Failure*) `` | authored-here: the manifest asks for the same convention on qa-visual line 24 (the report has no hunk for it). `<agc install>` is defined in qa-engineer line 60, which always loads this sub-skill. |
| g2-26.const15-6 | `` Stop conditions: `skill-coordinator` §Escalation Routes. `` (replaces `` See `skill-coordinator` §Auto-Routing for the full stop-condition list. ``) | authored-here: −15 chars against +5 for the report's form (budget). Same wording as coord-03:5 ("Stop conditions: see `## Escalation Routes`"). |
| g2-03.claude-159 | `npm test          # prebuild + node --test test/*.test.mjs  (pass count: the suite-result: line in the latest qa_reports/archive/release-*/review_*.md)` | authored-here: the server records `suite-result: <passed>/<total>` from `qa_suite_result`. Checked: `qa_reports/archive/release-post-v4-w13/review_T-RELW13-*.md`. |
| g2-13.claude-191 | `` auto-injects the constitution + coordinator-lite skill (size: `node bin/agent-governance-context.mjs \| wc -c`) into every `` (sr-engineer may rewrap lines 189-197 of that paragraph) | authored-here: no literal size (Decisions) |
| g2-15.claude-180 | `` - Its `tw_*` tools never write to git (no commit, branch, push or pull request); `` / `` some read it, e.g. `git worktree list` for the lane registry. The commit / `` / `` pull-request workflow is governed by Constitution §6 and the `` / `` `skill-release-engineer` / `skill-integrator` SOPs, not by tool code. `` (four lines) | authored-here: rewrite of the report §5 hunk, which says the tools never run git. That is false; see Decisions G2-15. |
| g2-24.claude-lib | `lib/                      small shared helpers (watermark check, tsconfig source dirs, render boundary)` + new row `lib/render-boundary.ts    renderDataBlock(): the one labelled, fenced path for reported data (handoff state, PRD chunks) into prompt text` | authored-here: from the `lib/render-boundary.ts` header |
| g2-24.claude-tools | three new rows after `tools/rag-coalesce.ts`: `tools/lane-paths.ts       lane-layout seam: sole owner of the lane-scoped .current/ filenames` · `tools/lane-status.ts      integrator lane observability + roll-up (scripts/lane-status.mjs); read-only, fires no gate` · `tools/fanout-*.ts         fan-out manifest parse / render / ownership + cut checks and the wave handoff section (scripts/fanout.mjs)` | authored-here: from each module's header comment |
| g2-24.claude-check-version | `scripts/check-version.mjs verify package.json version matches the index.ts Server() literal, dist/index.js, package-lock.json and the latest CHANGELOG heading (git tag: advisory)` | authored-here: read from `scripts/check-version.mjs` |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Every report-diff hunk that belongs to E392, E393 or E394: the `skill-release-engineer.md` `@@ -130` narrative (E394), the `CLAUDE.md` `@@ -223` adapter hunk (E392), the `const-08` line-12 "Round 4" hunk (E393), the lite line-20 Hop cap-exempt hunk (G2-17b), the `skill-qa-engineer.md` line-13 hunk (G2-17c), every `coord-*.md`, `const-06`, `const-12`, `templates/**` and `skill-integrator.md` hunk.
- Merging any G2-17 restatement. Every flag-only item (G1-*, G2-14, G2-19, G2-20, G2-23, G4-01).
- A new Limits row for the design-auditor (G2-05).
- Lowering the `test/context-budget.test.mjs` caps (Decisions).
- Same-class sites outside the manifest's named lines: `content/skill-qa-engineer.md:59` ("Do NOT Read `content/skill-qa-visual.md`") and `content/skill-qa-visual.md:65` (`content/skill-qa-engineer.md`). Filed as findings, not fixed (see Findings filed).
- Other `CLAUDE.md` literals that are correct today but will go stale ("221 test files" at `:122` and `:154`, "35 gate definitions" at `:88`, "35 entries" at `:50`), and the other `tools/*.ts` modules the Layout does not list. Filed as a finding.
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark): release-engineer / integrator after PASS.

## Dependencies / Prerequisites

- The cut goes to the integrator's mailbox pre-review (`type: proposal`) with this spec's commit sha. Only after the integrator's `close` does the lane present it to the human. The human approves in the lane coordinator's session (`cutApprovalAutoTier` is `{}`, so the manifest tier is not armed).
- Order inside the lane: all `content/` edits (T-E391-01..03) land before the golden re-capture (T-E391-05). T-E391-01 is the only budget-sensitive task; if the after-measure exceeds a base value, that task is reworked. The cap is never raised.
- No `design/<feature>.md` (mode = no-design), so Visual Structural Assertions are omitted. Resource Audit: every reference is an in-repo file or backlog row. The grep for URL/Figma/ticket hits only the report's own citations, which are in-repo. So `external_refs` is empty. No clarification questions: the manifest Decisions (human, 2026-11-02) fix the scope and the G2-05 default.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E391-01 | sr (G2-06, G2-18, G2-11, G2-26, budget-sensitive): apply the Copy / Strings rows `g2-06.const08-2`, `g2-18.const08-4`, `g2-26.const15-6`, `g2-11.lite-16`, `g2-18.lite-49` verbatim, only on `const-08` lines 2 and 4, `const-15` line 6, lite lines 16 and 49. Then run `npm run build` and `node scripts/measure-context-cost.mjs`; "bundle lean" must be ≤ 5722. About 5 lines | none | 3 | `content/const-08-chain-31-mid.md`、`content/const-15-core-tail.md`、`content/skill-coordinator-lite.md` | — |
| T-E391-02 | sr (G2-02, G2-04, G2-05, G2-07, G2-08): apply `g2-02.release-engineer-292`, `g2-08.rationale-3/10/15`, `g2-04.rationale-173`, `g2-05.design-auditor-71`, `g2-07.design-auditor-89`, `g2-08.doc-writer-13`, each re-checked against the current line first. Only the named lines: release-engineer line 292 only, design-auditor lines 71 and 89 only, doc-writer line 13 only. The rationale file is owned whole, but only lines 3, 10, 15 and 173-174 change. About 10 lines | none | 4 | `content/skill-release-engineer.md`、`content/constitution-rationale.md`、`content/skill-design-auditor.md`、`content/skill-doc-writer.md` | — |
| T-E391-03 | sr (G2-12): apply `g2-12.qa-engineer-60/95/101` and `g2-12.qa-visual-24`, only on those four lines. Check that `wc -c content/skill-qa-engineer.md` ≤ 18500. About 4 lines | none | 2 | `content/skill-qa-engineer.md`、`content/skill-qa-visual.md` | — |
| T-E391-04 | sr (G2-03, G2-13, G2-15, G2-24): apply `g2-03.claude-159`, `g2-13.claude-191`, `g2-15.claude-180`, `g2-24.claude-lib`, `g2-24.claude-tools`, `g2-24.claude-check-version`, only inside Layout / Testing changes / What this server does NOT do / Governance context loading. Add rows and never move one. The adapter blocks and the `agc-version:` stamp are untouched. About 12 lines | none | 1 | `CLAUDE.md` | — |
| T-E391-05 | qa (golden + budget): run `npm run build && node scripts/capture-constitution-golden.mjs`, then explain each `test/fixtures/compose-golden/` hunk in `qa_reports/` (expected: const-08 lines 2/4 in `constitution-monolith.txt`, `build-full-*.txt` ×4 and `hook-full.txt`; const-15 line 6 in those plus `build-lite-*.txt` ×4 and `hook-lite.txt`; `skill-coordinator-monolith.txt` unchanged; any other move is a finding). Record `node scripts/measure-context-cost.mjs` before (base: bundle lean 5723) and after, plus the four ceiling values from AC-BUDGET. `test/context-budget.test.mjs` is not edited (Decisions) | T-E391-01, T-E391-02, T-E391-03 | ~11 | `test/fixtures/compose-golden/**` | — |
| T-E391-06 | qa (re-pins + AC test): re-pin `test/qa-visual-skill-split.test.mjs` AC-3 (`:87` regex `Read\s+`?content\/skill-qa-visual\.md` no longer matches `Read `<agc install>/content/skill-qa-visual.md``; widen it to allow the `<agc install>/` prefix, keep the Read-tool clause). Optionally refresh the stale comment at `test/compose-equivalence.test.mjs:175` (quotes "Rationale target: v3.32.0"; comment only, no assertion). Write `test/e391-prompt-audit-stale-facts.test.mjs` pinning AC-G2-02..AC-G2-26 (stale strings gone; new pointers resolve: coord-03 has `## Escalation Routes` and the **Cut-approval gate writer obligation** label, skill-pm has the Geometric-Density Split Gate row, const-01 still has the `fix_try` / `read` / `hop` rows). Read only `content/**` and `CLAUDE.md`. No fanout manifest, no fixed base sha | T-E391-04, T-E391-05 | 3 | `test/qa-visual-skill-split.test.mjs`、`test/compose-equivalence.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs` | — |
| T-E391-07 | qa (lane verification): on the final committed HEAD with a clean tree (`git status --porcelain` empty), run AC-SCOPE, AC-DIST (`npm run build` then `git diff --stat dist/` empty), AC-STAMP (`node bin/agc-init.mjs check` exit 0), AC-BUDGET and the full suite under `node scripts/test-lock.mjs -- npm test`, with `qa_suite_result` recorded. These must stay unmodified and green: `test/context-budget.test.mjs`, `test/constitution-deliverable-guard.test.mjs`, `test/teamwork-lite.test.mjs`, `test/design-auditor-volume-guard.test.mjs`, `test/agc-adapters.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e164-e167-content.test.mjs`, `test/e234-hygiene-scan.test.mjs`, `test/e258b-comment-scan.test.mjs`, `test/subagent-templates.test.mjs`. If one needs a re-pin, report it as a finding; do not edit it silently | T-E391-06 | 0 | — | — |

## Re-pin survey

Searched `test/` at base `664e147` (fixtures excluded) for each string this ticket removes or changes: "stop-condition 6", "§Auto-Routing", "33 gate", "max 5 files", "max 3 extraction", "2a-bis", "content/constitution.md", "Rationale target", "v3.27.0", "will be rejected", "18.7KB", "1633", "touch git", "Commit/PR", "skill-coordinator.md", "skill-pm.md", "content/skill-qa-visual.md", "content/skill-qa-engineer.md", "max 10 role", "Watermark Validation", "full stop-condition list", "Auto-routing hop cap", "Server-read-only", "Hard limits", "No API / spec changes". The size and budget caps on the touched files were checked too.

| test file | pins a changed string? | action |
|---|---|---|
| `test/qa-visual-skill-split.test.mjs` | **yes**: `:87` AC-3 regex `Present[^\n]*Read\s+`?content\/skill-qa-visual\.md`?…Read tool` breaks under `<agc install>/`. `:84` `Do NOT Read.*skill-qa-visual\.md` still matches (line 59 unchanged). `:120`/`:115` byte caps (qa-engineer 18500, qa-visual 20700): dry run 18,357 B / 17,021 B, both pass | **re-pin `:87`** (T-E391-06) |
| `test/fixtures/compose-golden/**` | **yes**: "stop-condition 6", `` `skill-pm.md` Gate Summary ``, `` `skill-coordinator.md` auto-tier `` (6 fixtures) and "§Auto-Routing for the full" (11 fixtures) | **re-capture** (T-E391-05) |
| `test/compose-equivalence.test.mjs` | no assertion. `:175` is a comment quoting "Rationale target: v3.32.0". `:139-180` check `see Constitution §X` refs and section headings in the rationale, and are unaffected (no `see Constitution §` line changes). Golden equality follows the re-capture | optional comment refresh (T-E391-06) |
| `test/context-budget.test.mjs` | no string pin. Ceilings `:200` 5723, `:566` 10598, `:591` 21715, `:912` 8501: all pass with lower values (dry run in AC-BUDGET). `:476`/`:492` skill-pm / skill-sr caps: files untouched | none (not edited; Decisions) |
| `test/constitution-deliverable-guard.test.mjs` | no: `:17` and `:55` mention `content/constitution.md` / `v3.27.0` only in comments and describe-labels about the constitution header, which this ticket does not change | none |
| `test/teamwork-lite.test.mjs` | no: `:76` `/tw_switch_role/` still matches the new lite line 16 | none |
| `test/design-auditor-volume-guard.test.mjs` | no: pins Volume Gate / Node-scoped fetch / step 2c, not lines 71 or 89 | none |
| `test/agc-adapters.test.mjs` | no: reads the adapter template and temp workspaces, never this repo's `CLAUDE.md` body sections. `:275` is a comment | none |
| `test/e178a-integrator-role.test.mjs` | reads `CLAUDE.md`: pins "Twelve prompts are registered", "the other ten" and "the other 11 role SOPs" (Layout row `:115`). That row is kept unchanged (rows added, not moved) | none; must stay green |
| `test/e164-e167-content.test.mjs` | reads lite: pins "header per skill-pm *Cut-Approval Gate*" (lite line 21, untouched) | none |
| `test/e234-hygiene-scan.test.mjs`, `test/e258b-comment-scan.test.mjs` | no string pin. They run `git archive HEAD` of this repo through the scans, so the new wording must stay free of hygiene hits (no absolute path or user name; nothing in Copy / Strings has one). Run on committed HEAD | none |
| `test/subagent-templates.test.mjs` | no: its "§Auto-Routing" hits are test names and messages about the composed coordinator (coord-*.md, untouched) | none |
| `test/cut-approval-gate.test.mjs`, `test/source-credibility-gate.test.mjs` | no: their "Auto-Routing" / `skill-coordinator.md` hits read the composed coord-* SOP, not const-08 or const-15 | none |
| `test/e296-manifest-tier.test.mjs` | no: pins coord-03 and skill-pm literals, not const-08 line 4 | none |
| `test/skill-manifest.test.mjs` | no: pins the coord-04 heading `## Subagent Reply Watermark Validation`, which lite line 49 still names | none |
| `test/release-staging.test.mjs`, `test/e130-lane-default.test.mjs`, `test/e18-write-provenance.test.mjs`, `test/e166-template-defers-staging.test.mjs`, `test/e297-main-protected-sop.test.mjs` | no: none pins the gate count on release-engineer line 292 or const-15 line 6 | none |

Files that need a re-pin: **`test/qa-visual-skill-split.test.mjs`** and **`test/fixtures/compose-golden/**`**, both in the lane's owned set. New: **`test/e391-prompt-audit-stale-facts.test.mjs`** (owned via `test/e391-*.test.mjs`). Every sr-engineer task stays within the `task_size` budget (≤ 3–4 files, ≤ 12 changed lines each).

## Findings filed

Recorded in `.current/e391/pending-tickets.md` for the integrator (lane-protocol §4):

- `E391-NEW-1`: two same-class workspace-relative `content/` paths fall outside this lane's named lines: `content/skill-qa-engineer.md:59` ("Do NOT Read `content/skill-qa-visual.md`") and `content/skill-qa-visual.md:65` (`content/skill-qa-engineer.md`). They should get the same `<agc install>/content/…` form. Line 59 is pinned loosely by `test/qa-visual-skill-split.test.mjs:84`, which tolerates the prefix.
- `E391-NEW-2`: other `CLAUDE.md` literals are correct today but will go stale: "221 test files" (`:122`, `:154`), "35 gate definitions" (`:88`) and "35 entries" (`:50`). The Layout also omits other 4.x `tools/` modules (for example `comment-*.ts`, `dispatch-log.ts`, `hygiene-scan.ts`, `merge-invariants.ts`, `lane-registry.ts`, `feature-rollup.ts`, `join-precondition.ts`, `lane-migrate.ts`, `tasks-lane-migrate.ts`, `lane-ticket-allocation.ts`, `evidence-lookup.ts`). `test/e178a-integrator-role.test.mjs` pins some CLAUDE.md counts, so that test needs a re-pin if they change.
- `E391-NEW-3`: the report's §5 G2-15 hunk ("Its tools never run git") is factually wrong. `tw_get_state` (lane registry → `git worktree list`) and the task-ledger path (`git check-ignore`) read git. Anyone who later applies the report's diff should use this spec's wording instead.
