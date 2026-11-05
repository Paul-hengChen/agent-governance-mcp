# e410-task-alias-content-tail

Tickets E410 and E413 (lane `e410`, fan-out manifest `specs/fanout-prompt-audit-w6.md`, branch
`feat/e410-task-alias-content-tail`, lane base `cd24f34`). Sources: `docs/backlog.md` rows E410
and E413; `docs/prompt-audit-2026-11-02.md` G2-16 (residual) and G2-20 (report only, not
modified); the manifest's 12-site list and Decisions table; `specs/e408-core-task-alias-tail.md`
(the previous wave's same-class change, whose shape this spec follows). Human rulings fixed in the
manifest Decisions table (2026-11-05, "approve"), not re-asked: ruling 1 = the 12-site set is
E410; ruling 2 = option (a), per-site host-neutral nouns, the alias definition stays in
`content/coord-02-host-dispatch.md`; ruling 3 = E413 becomes one inline-present sentence no longer
than the original; ruling 4 = pins `pm=opus`, `sr-engineer=opus`, `code-reviewer=opus`,
`qa-engineer=sonnet`. Budget ceilings are not raised (E397).
Mini-chain: pm → sr-engineer → code-reviewer → qa-engineer, no architect (thirteen in-line span
swaps across seven content files; no module, no data model, no API).

Line numbers were re-verified against the lane base for this cut; all 13 sites are where the
manifest says. A re-run of the planning grep (`Task` over `content/const-*.md` and
`content/skill-*.md`, non-alias uses dropped) finds three more alias sites the manifest does not
list: `content/skill-integrator.md` lines 41, 78 and 81. They are outside this lane's owned lines;
see *Needs ruling R1*.

## Problem Statement

(E410) E392 defines `Task(...)` once, in `content/coord-02-host-dispatch.md` line 1, as shorthand
for Claude Code's subagent-dispatch tool (named `Agent`). coord-02 is tagged `host:claude-code`, and
E403/E408 made every core coordinator fragment host-neutral. The alias is still used where that
definition never loads: four constitution fragments composed for every host (const-01 line 33,
const-05 line 9, const-08 lines 2 and 5, const-12 line 2) and three skills (lite lines 43 and 49,
integrator lines 40, 177, 181 and 248, pm line 111). On a non-Claude-Code host these name a tool
nothing defines. (E413) `content/skill-pm.md` line 109, the Question Batch Gate, tells PM to ask
its batched clarifications through the `AskUserQuestion` tool. Inside `/teamwork` the operator
answers inline, and a subagent-dispatched PM has no interactive ask channel at all.

## User Stories

- As an agent on a host without Claude Code's subagent tool, I want the constitution and the lite,
  integrator and pm skills to name a kind of dispatch I can recognise, so that I never look for an
  undefined `Task` tool.
- As an agent on Claude Code, I want each rewritten sentence to mean what it meant before, so that
  dispatch, watermark and cut-approval behaviour do not change.
- As the human operator, I want PM's clarification batch shown inline with a recommended answer per
  question, so that I can answer in chat and a subagent PM's questions reach me through the
  coordinator.

## Acceptance Criteria

All `node --test` proofs run on a built tree (`npm run build` first; no `.ts` changes, so `dist/`
must not move). New test files are qa-authored; suggested names `test/e410-task-alias-content-tail.test.mjs`
and `test/e413-pm-question-batch-inline.test.mjs` (qa may rename inside the `test/e410-*.test.mjs` /
`test/e413-*.test.mjs` globs; creation pre-authorized). Per-site mapping: *Site map* below. New
tests read `content/**` and the goldens only; none asserts content of `specs/fanout-*.md` or diffs
against a fixed base sha (review-time `git diff` proofs below are run by the reviewer / qa by hand,
not encoded in a test).

- **AC1 (sites alias-free)** — Given the 13 site lines (const-01:33, const-05:9, const-08:2,
  const-08:5, const-12:2, skill-coordinator-lite:43, :49, skill-integrator:40, :177, :181, :248,
  skill-pm:109, :111), when each is read, then it contains no case-sensitive `Task` substring.
  (PM dry run: 13 lines with `Task` → 0.)
  proof: `node --test test/e410-task-alias-content-tail.test.mjs` (AC1 test green).
- **AC2 (per-site text)** — Given the same lines, when each is read, then it contains its Copy /
  Strings replacement verbatim where the old span stood, the old span is gone, every other byte of
  the line is unchanged, and each of the seven files keeps its line count (const-01 37, const-05 23,
  const-08 13, const-12 22, skill-coordinator-lite 53, skill-integrator 249, skill-pm 120 — `split("\n").length`).
  proof: `node --test test/e410-task-alias-content-tail.test.mjs test/e413-pm-question-batch-inline.test.mjs` (AC2 tests green).
- **AC3 (no span grows)** — Given each Copy / Strings row, when old and new spans are compared by
  JS string length, then new ≤ old for every row (PM dry run: total −62 chars over the 13 rows; no
  row positive).
  proof: `node --test test/e410-task-alias-content-tail.test.mjs` (AC3 test green; the test holds the old/new pairs as literals).
- **AC4 (content scope)** — Given the lane diff against the lane base, when `content/` is read,
  then exactly seven files change, with these line counts: const-01 1, const-05 1, const-08 2,
  const-12 1, skill-coordinator-lite 2, skill-integrator 4, skill-pm 2; no `coord-*` file and no
  other line changes. (If R1 is ruled "fold in", skill-integrator becomes 7.)
  proof: `git diff --numstat cd24f34 -- content/` prints exactly those seven files with `N N` equal to the counts above (review-time).
- **AC5 (Claude Code semantics unchanged)** — Given the edits, when the claude-code composition is
  read, then coord-02's alias sentence (`` `Task(...)` throughout this SOP is shorthand for Claude
  Code's subagent-dispatch tool, named `Agent` ``) is still present exactly once and every
  `content/coord-*.md` file is byte-identical to the lane base; const-01's watermark table keeps two
  data rows, the first now starting `` | Subagent-dispatched with `model:` pinned by the parent | ``
  and still mapping to `` `— @<role> (<tier>)` ``; const-05 branch (c) still starts with `otherwise`
  (e43 tests green).
  proof: `node --test test/e410-task-alias-content-tail.test.mjs test/e43-test-file-ask-at-dispatch.test.mjs test/e403-lean-dispatch-alias.test.mjs test/e408-core-task-alias-tail.test.mjs` (green) and `git diff --exit-code cd24f34 -- 'content/coord-*.md'` exits 0 (review-time).
- **AC6 (E413 Question Batch Gate)** — Given `content/skill-pm.md` line 109, when it is read, then
  the trigger cell and the rationale block are byte-identical to the base; the Action cell's
  non-rationale text is exactly string `pm.109.new`; it contains no `AskUserQuestion`; it contains
  `inline`, `numbered`, `≤ 4`, `2 batches if more`, `recommended answer`, `end the turn`,
  `coordinator` and `**Dependencies / Prerequisites**`; its length (193) is ≤ the original's (194).
  Line 111 still contains `do NOT use \`AskUserQuestion\`` (only its `Task-subagent dispatch`
  span changes) and `content/skill-coordinator-lite.md` line 21 is byte-identical to the base.
  proof: `node --test test/e413-pm-question-batch-inline.test.mjs` (green).
- **AC7 (pins re-pinned)** — Given the integrator edits, when `test/e178a-integrator-role.test.mjs`
  lines 89, 287, 292 and `test/e285-integrator-session-handoff.test.mjs` line 81 are read, then
  they assert the new strings `int.248`, `int.177`, `int.181` (and the new watermark tail
  `(no tier: an MCP-prompt invocation is not a subagent, Constitution §1).`), and both files are
  green. No other assertion in either file changes (the e178a line-93 failure message may drop its
  `Task-spawned` wording; optional).
  proof: `node --test test/e178a-integrator-role.test.mjs test/e285-integrator-session-handoff.test.mjs` (green).
- **AC8 (goldens)** — Given the edits, when `npm run build && node scripts/capture-constitution-golden.mjs`
  runs, then exactly 11 goldens change and `skill-coordinator-monolith.txt` is byte-identical; the
  full/hook-full/monolith goldens each carry 5 one-line hunks (const-01:33, const-05:9, const-08:2,
  const-08:5, const-12:2) and the four `build-lite-*` plus `hook-lite.txt` carry 2 (const-01:33,
  const-05:9). Sizes per *Golden changes*.
  proof: `git diff --stat -- test/fixtures/compose-golden/` after capture names the 11 files; `node --test test/skill-manifest.test.mjs test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/render-structure.test.mjs` green.
- **AC9 (budgets, no ceiling raised)** — Given the edits, when `test/context-budget.test.mjs` runs,
  then all five measures are ≤ their caps per *Budget* (lean 5675 ≤ 5723, stripped constitution
  10466 ≤ 10598, non-design 8466 ≤ 8501, teamwork 21398 ≤ 21715, skill-pm stripped body 4847 ≤
  4849); no cap literal changes; before/after values are recorded in the qa review evidence.
  proof: `node --test test/context-budget.test.mjs` (green) and `git diff --exit-code cd24f34 -- test/context-budget.test.mjs` exits 0 (review-time).
- **AC10 (full suite and repo checks)** — Given the final lane HEAD with a clean tree, when
  `node scripts/test-lock.mjs -- npm test` runs, then it exits 0; `git status --porcelain dist/` is
  empty after the build; `npm run check:bookkeeping` exits 0; `npm audit --audit-level=high` exits 0.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 on the last HEAD (plus the three checks above).

## Site map

| site | change | AC | task |
|---|---|---|---|
| `content/const-01-core-head.md:33` | watermark table row: string `c01.33` | AC1–AC5, AC8 | T-E410-01 |
| `content/const-05-core-standards.md:9` | Conditional test writing (c): string `c05.9` | AC1–AC5, AC8 | T-E410-01 |
| `content/const-08-chain-31-mid.md:2` | Cut-Approval Gate witness clause: string `c08.2` | AC1–AC4, AC8 | T-E410-01 |
| `content/const-08-chain-31-mid.md:5` | Lease-Override witness clause: string `c08.5` | AC1–AC4, AC8 | T-E410-01 |
| `content/const-12-chain-r10-s4.md:2` | R10 sequential-context clause: string `c12.2` | AC1–AC4, AC8 | T-E410-01 |
| `content/skill-coordinator-lite.md:43` | watermark validation trigger: string `lite.43` | AC1–AC4 | T-E410-02 |
| `content/skill-coordinator-lite.md:49` | watermark validation scope: string `lite.49` | AC1–AC4 | T-E410-02 |
| `content/skill-integrator.md:40` | permission table row: string `int.40` | AC1–AC4 | T-E410-02 |
| `content/skill-integrator.md:177` | merge-conflict re-review: string `int.177` | AC1–AC4, AC7 | T-E410-02 |
| `content/skill-integrator.md:181` | shared-artifact regeneration: string `int.181` | AC1–AC4, AC7 | T-E410-02 |
| `content/skill-integrator.md:248` | watermark bullet: string `int.248` | AC1–AC4, AC7 | T-E410-02 |
| `content/skill-pm.md:111` | Cut-Approval Gate dispatch branch: string `pm.111` | AC1–AC4, AC6 | T-E410-03 |
| `content/skill-pm.md:109` | Question Batch Gate Action cell: string `pm.109.new` | AC1–AC4, AC6 | T-E413-01 |
| `test/e410-task-alias-content-tail.test.mjs` (new) | AC1, AC2 (E410 sites), AC3, AC5 (resident half) | AC1–AC3, AC5 | T-E410-04 |
| `test/e413-pm-question-batch-inline.test.mjs` (new) | AC2 (pm.109), AC6 | AC2, AC6 | T-E410-04 |
| `test/e178a-integrator-role.test.mjs` lines 89, 287, 292 | re-pin to `int.248` tail, `int.177`, `int.181` | AC7 | T-E410-04 |
| `test/e285-integrator-session-handoff.test.mjs` line 81 | re-pin to the `int.248` tail | AC7 | T-E410-04 |
| `test/fixtures/compose-golden/**` | re-capture (11 files) | AC8 | T-E410-04 |
| `test/context-budget.test.mjs` | re-measure and record; no edit expected | AC9 | T-E410-04 |

### Test files: pin audit (grep at lane base + PM dry run)

PM dry run: the 13 strings below were applied in the lane worktree (no build needed: no `.ts`
change), the five budgets measured with the `test/context-budget.test.mjs` formulas, the goldens
captured into a scratch directory, and the whole suite run (`node scripts/test-lock.mjs -- node
--test test/*.test.mjs`); then every content file was restored by reverse-applying the same
strings, and `git diff --stat -- content/ test/` was empty before this spec was committed.
Suite result on the patched tree: see *Dry-run suite result*.

| test file | expected after the cut | why | action |
|---|---|---|---|
| `test/e178a-integrator-role.test.mjs` | red at lines 89, 287, 292 until re-pinned | verbatim pins on int.248 / int.177 / int.181 | re-pin (T-E410-04) |
| `test/e285-integrator-session-handoff.test.mjs` | red at line 81 until re-pinned | verbatim pin on the int.248 tail | re-pin (T-E410-04) |
| `test/skill-manifest.test.mjs` | green, unchanged | its golden is the coordinator monolith, which does not move | none |
| `test/compose-equivalence.test.mjs` | 11 tests red until re-capture | the 11 constitution/hook goldens carry const-01/05/08/12 | golden re-capture only, no test edit (T-E410-04) |
| `test/e90-golden-capture-completeness.test.mjs` | green, unchanged | checks capture coverage, not bytes | none |
| `test/render-structure.test.mjs` | green, unchanged | in-line span swaps; no fence, origin tag or table pipe touched | none |
| `test/context-budget.test.mjs` | green, unchanged | all five measures drop (see *Budget*) | re-measure and record (T-E410-04) |
| `test/e43-test-file-ask-at-dispatch.test.mjs` | green, unchanged | const-05 (c) still starts `otherwise`, keeps `create`, `no new test is warranted`, `pending_notes`, `qa_review` | none |
| `test/e403-lean-dispatch-alias.test.mjs`, `test/e408-core-task-alias-tail.test.mjs` | green, unchanged | read coord-* only | none |
| `test/teamwork-lite.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs` | green, unchanged | lite line 16/21 and the skill-pm rows they read are untouched | none |
| `test/e288-integrator-stage0.test.mjs`, `test/e329-integrator-sop-followups.test.mjs` | green, unchanged under this cut | they pin integrator lines 41, 78, 81, which this cut does not touch | none; under R1 "fold in" they need re-pins (not lane-owned today) |

### Dry-run suite result

Whole suite on the patched tree (13 strings applied, goldens not yet re-captured, tests not yet
re-pinned): exactly 14 failures, all expected and all owned by T-E410-04 — the 11
`compose-equivalence` golden byte-identity tests (8 `build-*`, 2 `hook-*`, the constitution
monolith), `e178a` AC1 (line 89, watermark tail) and AC9 (line 287; line 292 is in the same test
and would fail next), and `e285` AC-E285-5 (line 81). Everything else green, including
`context-budget`, `skill-manifest`, `e90-golden-capture-completeness`, `render-structure`, `e43`,
`e403`, `e408`, `teamwork-lite`, `e391`, `e288` and `e329`.

### Budget (PM dry run, chars/4 estimator as in `test/context-budget.test.mjs`)

| measure | base | after | delta | cap (unchanged) | headroom after |
|---|---|---|---|---|---|
| AC2 lean always-on (lite constitution + raw `skill-coordinator-lite.md`) | 5682 ~tok (22728 chars) | 5675 ~tok (22700 chars) | −7 ~tok | 5723 | 48 |
| AC8 stripped constitution (design arm, both strips) | 10475 ~tok (41900 chars) | 10466 ~tok (41861 chars) | −9 ~tok | 10598 | 132 |
| AC8 non-design constitution (both strips) | 8476 ~tok (33902 chars) | 8466 ~tok (33863 chars) | −10 ~tok | 8501 | 35 |
| AC8 teamwork bundle (claude-code profile, both strips) | 21408 ~tok (85629 chars) | 21398 ~tok (85590 chars) | −10 ~tok | 21715 | 317 |
| AC1/AC2 skill-pm stripped body | 4849 ~tok (19393 chars) | 4847 ~tok (19387 chars) | −2 ~tok | 4849 | 2 |

Integrator skill text is in no bundle and no golden; the R1 extension (if ruled in) changes none of
the five numbers (re-measured with the three extra strings applied: identical).

### Golden changes (PM dry-run capture, bytes)

| golden | base | after | hunks |
|---|---|---|---|
| `build-lite-nondesign.txt` | 16911 | 16885 | 2 |
| `build-lite-design.txt` | 18529 | 18503 | 2 |
| `build-lite-nondesign-fd.txt` | 17010 | 16984 | 2 |
| `build-lite-design-fd.txt` | 18819 | 18793 | 2 |
| `build-full-nondesign.txt` | 34178 | 34137 | 5 |
| `build-full-design.txt` | 42233 | 42192 | 5 |
| `build-full-nondesign-fd.txt` | 34277 | 34236 | 5 |
| `build-full-design-fd.txt` | 42523 | 42482 | 5 |
| `hook-lite.txt` | 19025 | 18999 | 2 |
| `hook-full.txt` | 43857 | 43816 | 5 |
| `constitution-monolith.txt` | 43857 | 43816 | 5 |
| `skill-coordinator-monolith.txt` | 45783 | 45783 | 0 (unchanged) |

The lite skill sites (lines 43, 49) land in no golden: every build/hook golden is the constitution
slice only, and the coordinator monolith carries coord-* only.

## Copy / Strings

Old → new spans; lengths are JS string length (`…` and `≤` count 1). Each new span keeps the
sentence's meaning under Claude Code (where the dispatch is the `Agent` tool) and names a dispatch
kind every host has.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| c01.33 | ``Subagent-dispatched with `model:` pinned by the parent`` (replaces ``Task-spawned with `model:` pinned by the parent (`Task(subagent_type=…)`)``; 73 → 54) | authored-here — ruling 2 (a); noun "subagent-dispatched" |
| c05.9 | ``dispatched with a silent brief`` (replaces ``Task-dispatched with a silent brief``; 35 → 30; branch (c) reads "otherwise — dispatched with a silent brief, or any context with no reachable human"; (b) already holds the in-context `tw_switch_role` case, and the next sentence names "a dispatched subagent") | authored-here — ruling 2 (a); "subagent-dispatched" would be +4 chars, over the no-growth rule |
| c08.2 | ``under subagent dispatch — where`` (replaces ``under Task-subagent dispatch — where``; 36 → 31) | authored-here — ruling 2 (a); noun "subagent dispatch" |
| c08.5 | ``under subagent dispatch it is`` (replaces ``under Task-subagent dispatch it is``; 34 → 29) | authored-here — ruling 2 (a) |
| c12.2 | ``Background/parallel subagents`` (replaces ``Background/parallel `Task` fan-out``; 34 → 29) | authored-here — ruling 2 (a); "subagent fan-out" would be +2 chars |
| lite.43 | ``After a subagent dispatch,`` (replaces ``After `Task(subagent_type=…)`,``; 30 → 26) | authored-here — ruling 2 (a) |
| lite.49 | ``ONLY after subagents;`` (replaces ``ONLY after `Task(…)`;``; 21 → 21; reads "Out-of-scope: ONLY after subagents; skip after `tw_*`/bash/file.") | authored-here — ruling 2 (a); "a subagent dispatch" would be +10 chars |
| int.40 | ``Dispatch code-reviewer / qa-engineer for`` (replaces ``Dispatch code-reviewer / qa-engineer (Task) for``; 47 → 40; the parenthetical is dropped, the verb "Dispatch" stays, as in the row's own "dispatch a read-only verifier") | authored-here — ruling 2 (a); "(subagent)" would be +4 chars |
| int.177 | ``subagent-dispatch `code-reviewer` on`` (replaces ``dispatch `code-reviewer` via Task on``; 36 → 36) | authored-here — ruling 2 (a); noun "subagent-dispatch" |
| int.181 | ``subagent-dispatch `qa-engineer` to`` (replaces ``dispatch `qa-engineer` via Task to``; 34 → 34) | authored-here — ruling 2 (a) |
| int.248 | ``is not a subagent,`` (replaces ``is not Task-spawned,``; 20 → 18; the bullet reads "(no tier: an MCP-prompt invocation is not a subagent, Constitution §1).") | authored-here — ruling 2 (a); matches the new const-01 row's subject |
| pm.111 | ``Subagent dispatch: if your turn ends`` (replaces ``Task-subagent dispatch: if your turn ends``; 41 → 36) | authored-here — ruling 2 (a); noun "subagent dispatch" |
| pm.109.new | ``Batch them upfront, inline, numbered, ≤ 4 (2 batches if more), each with a recommended answer; end the turn (as a subagent: via the coordinator). Answers go in **Dependencies / Prerequisites**.`` (replaces ``Consolidate them into ONE upfront `AskUserQuestion` call covering ≤ 4 questions (split into 2 batches if more). Record every answer inline in the spec's **Dependencies / Prerequisites** section.``; 194 → 193; the trailing space and the rationale block after it are unchanged) | `docs/backlog.md` E413 fix wording, compressed per ruling 3 (≤ original length); "as a subagent: via the coordinator" = a subagent-dispatched PM presents the batch to the coordinator, which relays it to the human |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Raising (or lowering) any budget cap literal (E397).
- The constitution header (E411), the qa-visual template (E412), G1-* items (E414), lite line 16
  (E409); lite line 21 and the rest of skill-pm line 111 stay as they are.
- `content/coord-*.md` (the alias definition stays in coord-02; ruling 2) and every other
  `content/**` line, including `content/skill-integrator.md` lines 41, 78, 81 unless R1 is ruled
  "fold in"; `TaskStop` at integrator line 196 is a real tool name, not the alias.
- `templates/**`, `CLAUDE.md` and the adapter files (Claude-Code-only surfaces that define the
  alias inline; E392).
- `dist/**`, `tools/**`, `prompts/**`, `scripts/**` (no code change).
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks, queue DONE): release-engineer /
  integrator.

## Dependencies / Prerequisites

(Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.) Lane base
`cd24f34`; `.current/.config.json` has `cutApprovalAutoTier: {}`, so the cut is human-approved in
the lane session after integrator mailbox pre-review.

Rulings applied (not re-asked): 1–4 per the manifest Decisions table.

Resource audit: the sources are in-repo documents; no URL, design file or external ticket system
is referenced. `external_refs` omitted.

### Needs ruling R1 (integrator; human if the integrator forwards it)

The manifest's site list came from a planning grep that missed three alias sites in
`content/skill-integrator.md`, all of which the audit lists under G2-16 (`skill-integrator.md:40-41,78`)
or share its pattern: line 41 `` dispatch PM (Task) to write ``, line 78 `` **Dispatch PM via Task** ``,
line 81 `` re-dispatch PM via Task to revise ``. They are outside this lane's owned lines, and they
are pinned verbatim by `test/e288-integrator-stage0.test.mjs` (line 31 `PERM_ROW`, line 64
`"Dispatch PM via Task"`) and `test/e329-integrator-sop-followups.test.mjs` (line 46 `REVISE`),
which are not lane-owned either (dry run with the three strings applied: e288 4 tests and e329 1
test red, no other change). Line 24 of the same file already says "dispatch PM to write the
ticket-cut file" with no alias, the precedent for `int.40`/`int.41` dropping the parenthetical.
The manifest's done-definition row "`Task` alias count 0 in
`content/const-*.md` and `content/skill-*.md`" cannot hold without them.

- **Option (a), recommended — fold into E410**: extend the lane's ownership to
  `content/skill-integrator.md` lines 41, 78, 81 and to the two test files; add sr task
  `T-E410-05` (strings `int.41` ``dispatch PM to write`` replacing ``dispatch PM (Task) to write``,
  27 → 20; `int.78` ``**Subagent-dispatch PM**`` replacing ``**Dispatch PM via Task**``, 24 → 24;
  `int.81` ``re-dispatch PM to revise`` replacing ``re-dispatch PM via Task to revise``, 33 → 24)
  and extend T-E410-04 with the three re-pins. Budgets and goldens: unchanged (measured).
- **Option (b) — leave them**: the integrator files them as a follow-up (`E410-NEW-1` in
  `.current/e410/pending-tickets.md`), and the done-definition row is narrowed to the 12 listed
  sites.

The cut below is option (b)'s shape (it lists only owned paths); option (a) adds the row given in
the option text, after the ownership change is recorded in the manifest.

## Gate Summary

| gate | result |
|---|---|
| Visual State-Count Split | not triggered — no visual surface |
| Geometric-Density Split Gate | not triggered — non-design |
| Parallel-Lane Cut | not applicable — this spec is the single lane of an approved fan-out |
| Scope Decision Gate | not gated (no design file); `scope_decision: single-feature` recorded |
| Resource Audit Gate | zero external hits; `external_refs` omitted |
| Source-Credibility Gate | not applicable — no design source |
| Question Batch Gate | zero questions to the human beyond R1 (an ownership question for the integrator, raised in pre-review) |
| Ambiguity Gate | clear |
| Cut-Approval Gate | cut below; subagent-dispatched PM — `cut_approved` not set; integrator mailbox pre-review, then human approval in the lane session |
| Manifest-Tier Self-Attestation | `node scripts/fanout.mjs check --cut specs/fanout-prompt-audit-w6.md e410 specs/e410-task-alias-content-tail.md` run; not eligible — `cutApprovalAutoTier.manifest` not set |
| Integrator Stage 0 cut | not applicable |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E410-01 | sr-engineer: constitution sites — strings `c01.33`, `c05.9`, `c08.2`, `c08.5`, `c12.2`, rest of each line unchanged (AC1–AC5; const-01:33, const-05:9, const-08:2/5, const-12:2) | none | 4 | `content/const-01-core-head.md` `content/const-05-core-standards.md` `content/const-08-chain-31-mid.md` `content/const-12-chain-r10-s4.md` | — |
| T-E410-02 | sr-engineer: lite and integrator sites — strings `lite.43`, `lite.49`, `int.40`, `int.177`, `int.181`, `int.248`, rest of each line unchanged (AC1–AC4) | none | 2 | `content/skill-coordinator-lite.md` `content/skill-integrator.md` | — |
| T-E410-03 | sr-engineer: skill-pm line 111 — string `pm.111` only; the `AskUserQuestion` prohibition and the rest of the line unchanged (AC1–AC4, AC6) | none | 1 | `content/skill-pm.md` | — |
| T-E413-01 | sr-engineer: skill-pm line 109 Question Batch Gate Action cell — string `pm.109.new`; trigger cell and rationale block unchanged (AC2, AC4, AC6) | none | 1 | `content/skill-pm.md` | — |
| T-E410-04 | qa-engineer: new `test/e410-*` (AC1, AC2, AC3, AC5) and `test/e413-*` (AC2 pm.109, AC6) files; re-pin e178a lines 89/287/292 and e285 line 81 (AC7); `npm run build && node scripts/capture-constitution-golden.mjs` — exactly 11 goldens move, coordinator monolith unchanged, every hunk explained (AC8); re-measure the five budgets and record before/after, no cap edit (AC9); review-time AC4/AC5 diffs; final `node scripts/test-lock.mjs -- npm test`, `git status --porcelain dist/` empty, `npm run check:bookkeeping`, `npm audit --audit-level=high` on the last HEAD (AC10) | T-E410-01, T-E410-02, T-E410-03, T-E413-01 | 15 | `test/e410-*.test.mjs` `test/e413-*.test.mjs` `test/e178a-integrator-role.test.mjs` `test/e285-integrator-session-handoff.test.mjs` `test/fixtures/compose-golden/**` | — |
