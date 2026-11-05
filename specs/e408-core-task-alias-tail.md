# e408-core-task-alias-tail

Ticket E408, with the prompt-audit items G2-19 and G2-23 folded in (lane `e408`, fan-out manifest
`specs/fanout-prompt-audit-w5.md`, branch `feat/e408-core-task-alias-tail`, lane base `c337d5b`).
Sources: `docs/backlog.md` row E408 including its 2026-11-05 scope extension;
`docs/prompt-audit-2026-11-02.md` §3.1 G2-16 and §3.3 G2-19, G2-23 (report only, not modified);
`specs/d8-lite-recommended-model.md` Amendment and AC8; `specs/e403-lean-dispatch-alias.md` (the
previous wave's same-class change, whose shape this spec follows). Human rulings are fixed in the
manifest Decisions table (2026-11-05, "approve"): ruling 1 = fold G2-19 and G2-23 into E408;
ruling 2 = option (a), per-site host-neutral wording that reuses coord-02's nouns, no alias
definition moved into core; ruling 3 = one sentence in the lite template, `model: haiku`
untouched; ruling 4 = `tools/role.ts` lines 36–40 comment only, plus the rebuilt
`dist/tools/role.js` and `dist/tools/role.js.map`; ruling 5 = pins `pm=opus`, `sr-engineer=opus`,
`code-reviewer=opus`, `qa-engineer=sonnet`. Budget ceilings are not raised (E397).
Mini-chain: pm → sr-engineer → code-reviewer → qa-engineer, no architect (eight single-line text
edits and one five-line comment, no module, no data model, no API).

Line numbers are at the lane base and were re-verified for this cut. `grep -n Task` over
`content/coord-0*.md`, after dropping `tasks.md` / `_task` / `completed_tasks` hits, finds the six
E408 sites in the four core fragments and nothing else in them; every other hit sits in coord-02,
coord-04 or coord-06, which are tagged `host:claude-code` in `prompts/skill-manifest.ts`
`SKILL_SEGMENTS`. The core fragments composed for every host are coord-01, coord-03, coord-05 and
coord-07; coord-01 has no `Task` mention.

## Problem Statement

(E408) E392 defines `Task(...)` once, in `content/coord-02-host-dispatch.md` line 1, as shorthand
for Claude Code's subagent-dispatch tool. coord-02 is tagged `host:claude-code`, so the coordinator
composition for no host or any other host drops it. E403 made coord-03 line 1 host-neutral, but
six more `Task` mentions remain in the core fragments, which load on every host: coord-03 lines 31,
77, 88 and 95, coord-05 line 5, coord-07 line 14. On those hosts they name a tool nothing defines.
(G2-19) `templates/claude-code-agents/lite.md` pins `model: haiku` while
`content/skill-coordinator-lite.md` declares `recommended_model: sonnet`. The split is deliberate
(D8 Amendment, AC8), but the template never says so, so every reader reports it again. The same
template line says the "server rejects lite-mode writes", which overstates what the server does
(see *Decision: lite.md write-tool wording*). (G2-23) The `tools/role.ts` comment above the
`doc-writer` / `release-engineer` entries says both are absent from `tools/transitions.ts`
`AgentName` and `ALLOWED_TRANSITIONS` and points at a "Side-channel constraint" clause in both
skills. `release-engineer` has been in `AgentName` with its own opening edge since v3.49.0 (C13),
and only `content/skill-doc-writer.md` still has that clause.

## User Stories

- As a coordinator on a host without Claude Code's subagent tool, I want every core SOP sentence
  to name a tool kind I can check, so that I never look for an undefined `Task` tool.
- As a coordinator on Claude Code, I want those sentences to mean what they meant before, so that
  dispatch behaviour does not change.
- As a reader of the lite subagent template, I want the tier split explained where I see it, so
  that I do not report it as a defect.
- As a maintainer reading `tools/role.ts`, I want the comment to match `tools/transitions.ts`, so
  that I do not route release-engineer through a workaround that no longer exists.

## Acceptance Criteria

All `node --test` proofs run on a built tree (`npm run build` first). The new test file is
qa-authored; suggested name `test/e408-core-task-alias-tail.test.mjs` (qa may rename inside the
`test/e408-*.test.mjs` glob). Per-site mapping: *Site map* below. "Task-free" means: after removing
every `tasks.md`, `_task` and `completed_tasks` substring, the text contains no `Task`.

- **AC1 (no-host composition is Task-free)** — Given
  `composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), load)` (the profile every
  non-`claude-code` host gets), when it is scanned line by line, then every line is Task-free; and
  each of `content/coord-01-core-head.md`, `coord-03-core-fallback.md`, `coord-05-core-visual-drift.md`,
  `coord-07-core-sop.md` read on its own is Task-free. (PM dry run: 6 offending lines → 0.)
  proof: `node --test test/e408-core-task-alias-tail.test.mjs` (AC1 test green).
- **AC2 (per-site text)** — Given the four core fragments, when lines coord-03:31, coord-03:77,
  coord-03:88, coord-03:95, coord-05:5 and coord-07:14 are read, then each contains its Copy /
  Strings replacement verbatim (`c03.31` … `c07.14`) where the old span stood, every other byte of
  each line is unchanged, and each file keeps its line count.
  proof: `node --test test/e408-core-task-alias-tail.test.mjs` (AC2 test green).
- **AC3 (claude-code semantics unchanged)** — Given the `claude-code` profile composition, when it
  is read, then coord-02's alias sentence (`` `Task(...)` throughout this SOP is shorthand for Claude
  Code's subagent-dispatch tool, named `Agent` ``) occurs exactly once and precedes every E408 site;
  the only remaining Task-bearing lines are in coord-02, coord-04 and coord-06 (PM dry run: 18 → 12
  lines); and coord-01, coord-02, coord-04 and coord-06 are byte-identical to the lane base.
  proof: `node --test test/e408-core-task-alias-tail.test.mjs test/e403-lean-dispatch-alias.test.mjs` (green) and `git diff --exit-code c337d5b -- content/coord-01-core-head.md content/coord-02-host-dispatch.md content/coord-04-host-watermark.md content/coord-06-host-token.md` exits 0 (review-time).
- **AC4 (content scope)** — Given the lane diff against `c337d5b`, when `content/` is read, then
  exactly three files change: coord-03 (4 lines: 31, 77, 88, 95), coord-05 (line 5), coord-07
  (line 14); no `const-*`, no `skill-*` file and no other line changes.
  proof: `git diff --numstat c337d5b -- content/` prints exactly `4 4 content/coord-03-core-fallback.md`, `1 1 content/coord-05-core-visual-drift.md`, `1 1 content/coord-07-core-sop.md` (review-time).
- **AC5 (G2-19, lite template)** — Given `templates/claude-code-agents/lite.md`, when it is read,
  then line 9 ends with strings `lite.forbid` and `lite.tier` (in that order, one space between
  them), replacing only `(server rejects lite-mode writes).`; the file has 11 lines; lines 1–8,
  10 and 11 are byte-identical to the base (so `model: haiku`, the `CRITICAL:` line, the blank line
  10 and the final `Example reply suffix: … — @lite (haiku)` line stay); the text
  `content/skill-coordinator-lite.md` is still on line 9; the file contains no `server rejects`
  and no `Task`; and `content/skill-coordinator-lite.md` is byte-identical to the base.
  proof: `node --test test/subagent-templates.test.mjs test/e408-core-task-alias-tail.test.mjs` (green; subagent-templates unchanged).
- **AC6 (G2-23, role.ts comment)** — Given `tools/role.ts`, when lines 36–40 are read, then they
  are exactly the five lines of string `role.comment`; the diff against the base touches only
  lines 36–40 and every added or removed line starts with optional spaces then `//`; the file
  still has no `integrator` (e178a AC4) and still maps `"doc-writer"` and `"release-engineer"`
  (skill-evolution AC-10).
  proof: `node --test test/e178a-integrator-role.test.mjs test/skill-evolution-v3.11.test.mjs test/e408-core-task-alias-tail.test.mjs` (green) and `git diff -U0 c337d5b -- tools/role.ts` shows one hunk `@@ -36,5 +36,5 @@` of comment lines only (review-time).
- **AC7 (dist)** — Given AC6, when `npm run build` runs on the lane HEAD, then `git status
  --porcelain dist/` is empty, and `git diff --stat c337d5b -- dist/` lists exactly
  `dist/tools/role.js` and `dist/tools/role.js.map`; the `role.js` diff is the comment block at its
  lines 27–31 only; `dist/tools/role.d.ts` and `dist/tools/role.d.ts.map` are unchanged (the
  comment keeps its five-line height, so no line mapping shifts).
  proof: `npm run build && git status --porcelain dist/` prints nothing, then `git diff --stat c337d5b -- dist/` names the two files (review-time).
- **AC8 (goldens)** — Given the edits, when `npm run build && node scripts/capture-constitution-golden.mjs`
  runs, then only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` changes (six
  one-line hunks; PM dry run 45762 → 45783 bytes) and the other 11 goldens are byte-identical
  (`CHAIN_SKILL` is `skill-sr-engineer.md`, and `hook-full.txt` carries no coordinator fragment).
  proof: `git diff --stat -- test/fixtures/compose-golden/` after capture names one file; `node --test test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs` green.
- **AC9 (budgets, no ceiling raised)** — Given the edits, when `test/context-budget.test.mjs` runs,
  then AC8 teamwork bundle ≤ 21715 ~tok (PM dry run 21401 → 21408) and AC2 lean always-on ≤ 5723
  ~tok (PM dry run 5682 → 5682: neither coord-* nor the template is in the lean bundle); no cap
  literal in the file changes; before/after values are recorded in the qa review evidence.
  proof: `node --test test/context-budget.test.mjs` (green) and `git diff --exit-code c337d5b -- test/context-budget.test.mjs` exits 0 (review-time).
- **AC10 (full suite and repo checks)** — Given the final lane HEAD with a clean tree, when
  `node scripts/test-lock.mjs -- npm test` runs, then it exits 0; `npm run check:bookkeeping` exits
  0; `npm audit --audit-level=high` exits 0.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 on the last HEAD (plus the two commands above).

## Site map

| site | change | AC | task |
|---|---|---|---|
| `content/coord-03-core-fallback.md:31` | Crash detection row: `` a dispatched `Task(subagent_type=<role>, …)` call returns `` → string `c03.31` | AC1–AC4 | T-E408-01 |
| `content/coord-03-core-fallback.md:77` | Crash-Resume step 0: `` the `Task(...)` fail this session `` → string `c03.77` | AC1–AC4 | T-E408-01 |
| `content/coord-03-core-fallback.md:88` | Crash-Resume step 2: `` `Task(subagent_type=<role>, …)` or the `tw_switch_role` fallback) `` → string `c03.88` | AC1–AC4 | T-E408-01 |
| `content/coord-03-core-fallback.md:95` | Crash-Resume step 3: `` on the resume `Task(...)` call — `` → string `c03.95` | AC1–AC4 | T-E408-01 |
| `content/coord-05-core-visual-drift.md:5` | Visual Verdict Boundary: `` (Task or `tw_switch_role`) `` → string `c05.5` | AC1–AC4 | T-E408-01 |
| `content/coord-07-core-sop.md:14` | SOP step 5: `(Task-tool subagent if available,` → string `c07.14` | AC1–AC4 | T-E408-01 |
| `templates/claude-code-agents/lite.md:9` | `(server rejects lite-mode writes).` → strings `lite.forbid` + `lite.tier` | AC5 | T-E408-02 |
| `tools/role.ts:36-40` | five comment lines → string `role.comment` (five lines) | AC6 | T-E408-03 |
| `dist/tools/role.js`, `dist/tools/role.js.map` | rebuilt by `npm run build`, committed with T-E408-03 | AC7 | T-E408-03 |
| `test/e408-core-task-alias-tail.test.mjs` (new) | AC1, AC2, AC3 (resident half), AC5 (Task-free / no `server rejects` / line shape), AC6 (comment text) | AC1–AC3, AC5, AC6 | T-E408-04 |
| `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | re-capture | AC8 | T-E408-04 |
| `test/context-budget.test.mjs` | re-measure and record; no edit expected | AC9 | T-E408-04 |

### Test files: pin audit (grep at lane base + PM dry run)

PM dry run: all nine edits (Copy / Strings below) applied to a scratch copy of the lane base,
`npm run build`, then 40 test files run on the unpatched and the patched copy (every test that
reads a coord fragment, a subagent template or `tools/role.ts`, plus the golden, budget and
version tests). The unpatched copy had 1 failure (`e299-check-bookkeeping` AC12, which needs git
metadata the scratch copy lacks; same in both copies, out of scope). The patched copy added
exactly 1 failure, `skill-manifest` `t-golden-byte-identity`; after re-capturing the golden,
`skill-manifest`, `compose-equivalence` and `e90-golden-capture-completeness` were 45/45 green.
None of the six site sentences, the lite line-9 tail or the role.ts comment is pinned verbatim by
any test.

| test file | expected | why | action |
|---|---|---|---|
| `test/skill-manifest.test.mjs` | `t-golden-byte-identity` red until re-capture | the coordinator monolith golden carries coord-03/05/07 | golden re-capture only, no test edit (T-E408-04) |
| `test/compose-equivalence.test.mjs` | green, unchanged | its 11 constitution/hook goldens are byte-identical (no `const-*` change) | none |
| `test/render-structure.test.mjs` | green, unchanged | in-line span swaps; no fence, origin tag or glue touched | none |
| `test/context-budget.test.mjs` | green, unchanged | AC8 21408 ≤ 21715; AC2 5682 ≤ 5723 | re-measure and record (T-E408-04) |
| `test/e403-lean-dispatch-alias.test.mjs` | green, unchanged | reads only the coord-03 line-1 Fallback paragraph and the coord-02 alias | none |
| `test/e96-dispatch-preference.test.mjs` | green, unchanged | pins coord-03 line 1 and coord-02, not the six sites | none |
| `test/teamwork-lite.test.mjs` | green, unchanged | no pin on the lite template or the sites | none |
| `test/subagent-templates.test.mjs` | green, unchanged | line 1 frontmatter, `model: haiku`, the `content/skill-coordinator-lite.md` regex, the `MIRROR_EXEMPT_ROLES` lite row and the haiku example-suffix line with its blank predecessor all stay | none |
| `test/e392-subagent-templates.test.mjs` | green, unchanged | pins coord-04 line 5 and the teamwork template, not lite | none |
| `test/e178a-integrator-role.test.mjs` | green, unchanged | AC4: the new comment has no `integrator` | none |
| `test/skill-evolution-v3.11.test.mjs` | green, unchanged | AC-10 reads the map keys and `transitions.ts`, not the comment | none |
| `test/e393-builder-judge-core.test.mjs`, `test/e407-restatement-citations.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e5-intake-tiering.test.mjs`, `test/e16-judge-dispatch-charter.test.mjs` | green, unchanged (not lane-owned) | they read coord-05 / coord-07 / lite skill text outside the six spans | none; a red here is a scope signal, mail the integrator |

### Budget (PM dry run, chars/4 estimator as in `test/context-budget.test.mjs`)

| measure | base | after | delta | cap (unchanged) | headroom after |
|---|---|---|---|---|---|
| AC8 teamwork bundle (claude-code profile, both strips) | 21401 ~tok | 21408 ~tok | +7 ~tok | 21715 | 307 |
| AC2 lean always-on (lite constitution + raw `skill-coordinator-lite.md`) | 5682 ~tok | 5682 ~tok | 0 | 5723 | 41 |
| no-host coordinator bundle (both strips) | 18237 ~tok | 18244 ~tok | +7 ~tok | — | — |
| coordinator monolith golden | 45762 bytes | 45783 bytes | +21 bytes | — | — |
| `measure-context-cost.mjs` teamwork row (raw) | 88783 chars / 22196 ~tok | 88808 chars / 22202 ~tok | +25 chars | — | — |

Per site (raw bytes, `…` is 3 bytes): c03.31 −25, c03.77 +13, c03.88 −7, c03.95 +18,
c05.5 +18, c07.14 +4 (total +21). The lite template sentence and the role.ts comment are in no
bundle.

## Decision: lite.md write-tool wording

The manifest leaves to this cut whether the lite template's "(server rejects lite-mode writes)"
is corrected to E391 G2-11's wording ("the server rejects the four write tools"). Decision: correct
it, but not to the G2-11 wording; replace the server claim with the SOP's own prohibition (string
`lite.forbid`). Reason: the code does not support either server claim. `tools/tasks.ts`
`handleAddTask` and `handleRollbackTask` run only `enforcePreFlight`, which a lite session passes
once it has called `tw_get_state` (the template tells it to). Only `tw_update_state`
(`AGENT_ID_REQUIRED`) and `tw_complete_task` (`requireQaEngineer`) reject a write without an
`agent_id`. "Server rejects" is therefore false for two of the four tools, and copying G2-11's
wording would carry the same overstatement into a second file. A template should point at the SOP
rule, not restate it (the E407 principle). The overstatement at its source,
`content/skill-coordinator-lite.md` line 16, is outside this lane's files; it is filed as
`E408-NEW-1` in `.current/e408/pending-tickets.md` for the integrator.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| c03.31 | ``a dispatched subagent call returns`` (replaces ``a dispatched `Task(subagent_type=<role>, …)` call returns``) | authored-here — ruling 2 (a); coord-02's noun "dispatched … call", host-neutral |
| c03.77 | ``the dispatched subagent call fail this session`` (replaces ``the `Task(...)` fail this session``; the sentence reads "If you saw the dispatched subagent call fail this session, …") | authored-here — ruling 2 (a) |
| c03.88 | ``the subagent-dispatch tool or the `tw_switch_role` fallback)`` (replaces ``` `Task(subagent_type=<role>, …)` or the `tw_switch_role` fallback) ```; line 87 ends "(via", so the clause reads "via the subagent-dispatch tool or the `tw_switch_role` fallback") | authored-here — ruling 2 (a); coord-02's noun `subagent-dispatch tool` |
| c03.95 | ``on the resume call to the subagent-dispatch tool —`` (replaces ``on the resume `Task(...)` call —``) | authored-here — ruling 2 (a) |
| c05.5 | ``(subagent-dispatch tool or `tw_switch_role`)`` (replaces ``(Task or `tw_switch_role`)``) | authored-here — ruling 2 (a) |
| c07.14 | ``(subagent-dispatch tool if available,`` (replaces ``(Task-tool subagent if available,``) | authored-here — ruling 2 (a) |
| lite.forbid | ``(that SOP's Hard rules forbid them).`` (replaces ``(server rejects lite-mode writes).``; the sentence reads "Do NOT call any tw_* write tools (that SOP's Hard rules forbid them).") | authored-here — *Decision: lite.md write-tool wording* |
| lite.tier | ``The `model: haiku` pin deliberately differs from the skill's `recommended_model: sonnet`: when a coordinator dispatches this subagent it validates the reply watermark, while a direct session has no such check (`specs/d8-lite-recommended-model.md` Amendment, AC8).`` (appended after `lite.forbid`, one space between) | authored-here — ruling 3; rationale per `specs/d8-lite-recommended-model.md` Amendment option (b) and AC8; no `Task` word, matching the other templates |
| role.comment | five lines, two-space indent, replacing lines 36–40 exactly: ``  // Post-chain roles. doc-writer is intentionally absent from tools/transitions.ts`` / ``  // AgentName + ALLOWED_TRANSITIONS: callers set agent_id to the upstream chain role`` / ``  // when invoking tw_update_state on its behalf (skill-doc-writer.md "Side-channel`` / ``  // constraint" clause). release-engineer is in AgentName and opens on the`` / ``  // qa-engineer:PASS -> release-engineer:In_Progress edge there (v3.49.0, C13).`` | authored-here — ruling 4; facts from `tools/transitions.ts` (`AgentName`, the `qa-engineer:PASS` edge list) and `content/skill-doc-writer.md` line 15 |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Raising any budget ceiling (E397); lowering a cap literal is also not done here.
- The constitution header bump (G2-14); any `const-*` edit.
- `content/coord-02-host-dispatch.md`, coord-04, coord-06 (ruling 2 = option (a); their `Task`
  mentions are inside the Claude Code fragments that define the alias).
- `content/skill-coordinator-lite.md` (including its line-16 overstatement, filed as `E408-NEW-1`)
  and every other `content/**` line.
- `Task` mentions outside the coordinator fragments (`const-*`, `skill-coordinator-lite.md`,
  `skill-integrator.md`, adapters, `CLAUDE.md`): G2-16's remaining sites are not E408.
- The other 11 subagent templates and `templates/agent-adapters/**`.
- Any executable line of `tools/role.ts`; any other `tools/**` or `dist/**` file.
- qa-visual template retirement (G4-01), pm `AskUserQuestion` (G2-20), G1-*.
- Release bookkeeping (version bump, CHANGELOG — "comment only" note for role.ts, backlog
  done-marks): release-engineer / integrator.

## Dependencies / Prerequisites

(Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.) Lane base
`c337d5b`; `.current/.config.json` has `host: "claude-code"` and no `cutApprovalAutoTier.manifest`,
so the cut is human-approved in this lane's session after integrator mailbox pre-review.

Rulings applied (not re-asked): 1–5 per the manifest Decisions table.

Build note for T-E408-03: `tsconfig.json` has no `removeComments`, so the comment is copied into
`dist/tools/role.js` (lines 27–31) and `role.js.map` changes with it. Keeping the comment at
exactly five lines keeps `dist/tools/role.d.ts` and `role.d.ts.map` byte-identical; both are
outside the lane's files, so a five-line comment is a hard constraint, not a style choice.

Resource audit: the sources are in-repo documents; no URL, design file or external ticket system
is referenced. `external_refs` omitted.

## Gate Summary

| gate | result |
|---|---|
| Visual State-Count Split | not triggered — no visual surface |
| Geometric-Density Split Gate | not triggered — non-design |
| Parallel-Lane Cut | not applicable — this spec is the single lane of an approved fan-out; inside it the tasks touch disjoint files |
| Scope Decision Gate | not gated (no design file); `scope_decision: single-feature` recorded — why: ruling 1 binds E408 + G2-19 + G2-23 into one ticket; three text/comment tails reviewed and QA'd in one round, sharing the golden and budget re-measure |
| Resource Audit Gate | zero external hits; `external_refs` omitted |
| Source-Credibility Gate | not applicable — no design source |
| Question Batch Gate | zero questions — rulings 1–5 fixed; the one open item (lite.md wording) decided above |
| Ambiguity Gate | clear |
| Cut-Approval Gate | cut below; Task-dispatched PM — `cut_approved` not set; integrator mailbox pre-review, then human approval in the lane session |
| Manifest-Tier Self-Attestation | `node scripts/fanout.mjs check --cut specs/fanout-prompt-audit-w5.md e408 specs/e408-core-task-alias-tail.md` run; not eligible — the workspace has no `cutApprovalAutoTier.manifest` |
| Integrator Stage 0 cut | not applicable |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E408-01 | sr-engineer: replace the six core-fragment `Task` spans with strings `c03.31`, `c03.77`, `c03.88`, `c03.95`, `c05.5`, `c07.14`, rest of each line unchanged (AC1–AC4; sites coord-03:31/77/88/95, coord-05:5, coord-07:14) | none | 3 | `content/coord-03-core-fallback.md` `content/coord-05-core-visual-drift.md` `content/coord-07-core-sop.md` | — |
| T-E408-02 | sr-engineer: lite template line 9, replace `(server rejects lite-mode writes).` with strings `lite.forbid` + `lite.tier`; lines 1–8, 10, 11 unchanged (AC5; G2-19) | none | 1 | `templates/claude-code-agents/lite.md` | — |
| T-E408-03 | sr-engineer: `tools/role.ts` lines 36–40 → string `role.comment` (exactly five comment lines), then `npm run build` and commit `dist/tools/role.js` + `dist/tools/role.js.map`; `role.d.ts(.map)` must stay unchanged (AC6, AC7; G2-23) | none | 3 | `tools/role.ts` `dist/tools/role.js` `dist/tools/role.js.map` | — |
| T-E408-04 | qa-engineer: new test file for AC1, AC2, AC3 (resident half), AC5, AC6; `npm run build && node scripts/capture-constitution-golden.mjs` — only the coordinator monolith may differ, six hunks explained; re-measure budgets and record before/after, no cap raised; review-time checks AC3/AC4/AC6/AC7; final `node scripts/test-lock.mjs -- npm test`, `check:bookkeeping`, `npm audit` on the last HEAD (AC8–AC10) | T-E408-01, T-E408-02, T-E408-03 | 2 | `test/e408-*.test.mjs` `test/fixtures/compose-golden/**` | — |
