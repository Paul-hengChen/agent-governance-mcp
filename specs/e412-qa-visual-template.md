# e412-qa-visual-template

Ticket E412 (lane `e412`, fan-out manifest `specs/fanout-prompt-audit-w7.md`, branch
`feat/e412-qa-visual-template`, lane base `6e1a9d4`). Sources: `docs/backlog.md` row E412; the
manifest's E412 bullet, its "待人類裁定" item 3, "所有 lane 共通的範圍", Lanes row `e412` and
Decisions table. Human ruling fixed in the manifest Decisions table (2026-11-05, "approve, 全照建議"),
not re-asked: E412 takes option (a) — keep `templates/claude-code-agents/qa-visual.md` as the named
independent visual judge, fix its description, and make the coordinator SOP say when to pick it.
Reference only (not modified): `content/skill-qa-engineer.md` Phase 1.5 (the `## Visual Baselines`
trigger) and `content/const-11-design-chain-32.md` lines 10–12 (visual verdict is qa-visual-owned).
Mini-chain: pm → sr-engineer → code-reviewer → qa-engineer, no architect (two prose sites in two
files; no module, data model or API).

Line numbers were re-verified against the lane base for this cut: template description on line 4,
delegation line on line 9, the coord-05 dispatch sentence starting on line 5.

## Problem Statement

`templates/claude-code-agents/qa-visual.md` describes itself as a "lazy-loaded sub-skill of
qa-engineer" and its body says it "runs the agc qa-visual SOP", but there is no qa-visual SOP entry
(it calls `tw_switch_role("qa-engineer")`). Nothing tells a coordinator why this separate subagent
name exists or when to dispatch it instead of `qa-engineer`, although
`content/coord-05-core-visual-drift.md` line 5 already says "When dispatching `qa-visual`" and
Constitution §3.2 makes qa-visual the visual verdict owner. The separate name is what gives the
visual verdict its own judge context (builder ≠ judge, §3), so both the template and the coordinator
SOP must say what it is and when to pick it.

## User Stories

- As a coordinator on a design-armed feature, I want coord-05 to say when to dispatch `qa-visual`
  rather than `qa-engineer`, so that the visual verdict is judged in its own context.
- As an adopter reading the installed subagent list, I want the `qa-visual` description to say it is
  qa-engineer's visual sub-dispatch and an independent judge context, so that I know why both
  templates exist.

## Acceptance Criteria

- **AC1** — Given `templates/claude-code-agents/qa-visual.md`, when its frontmatter is read, then
  line 4 is exactly string `tpl.desc`, and lines 1–3 and 5 (`---`, `name: qa-visual`,
  `model: sonnet`, `---`) are byte-identical to the lane base.
  proof: `sed -n 1,5p templates/claude-code-agents/qa-visual.md` prints the fence, `name: qa-visual`, `model: sonnet`, line 4 = `tpl.desc`, fence; `git diff --unified=0 6e1a9d4 -- templates/claude-code-agents/qa-visual.md` shows hunks at lines 4 and 9 only.
- **AC2** — Given the same template, when its body is read, then line 7 (the `CRITICAL:` watermark
  line) is byte-identical to the lane base, and line 9 is exactly string `tpl.body`, which still
  calls `tw_get_state` then `tw_switch_role("qa-engineer")` and says the subagent is qa-engineer's
  visual sub-dispatch, an independent judge context, used in place of `qa-engineer` when the feature
  is design-armed and `design/<feature>.md` has `## Visual Baselines`.
  proof: `node --test test/subagent-templates.test.mjs` passes (frontmatter keys, tier mirror, `CRITICAL:` first body line, `tw_switch_role("…")` delegation) and `sed -n 9p templates/claude-code-agents/qa-visual.md` prints `tpl.body`.
- **AC3** — Given `content/coord-05-core-visual-drift.md`, when the Visual Verdict Boundary is read,
  then line 5 is exactly string `coord05.5` (it says `qa-visual` is picked over `qa-engineer` for
  the QA hop when the feature is design-armed and `design/<feature>.md` has `## Visual Baselines`),
  it still contains the substring `` (subagent-dispatch tool or `tw_switch_role`) ``, and every
  other line of the file is byte-identical to the lane base.
  proof: `git diff --unified=0 6e1a9d4 -- content/coord-05-core-visual-drift.md` shows one hunk, at line 5; `node --test test/e408-core-task-alias-tail.test.mjs` passes.
- **AC4** — Given AC1–AC3 are applied, when `npm run build && node scripts/capture-constitution-golden.mjs`
  runs, then exactly one golden changes, `test/fixtures/compose-golden/skill-coordinator-monolith.txt`,
  and its diff is exactly the coord-05 line 5 change (one changed line); the other 11 goldens are
  byte-identical.
  proof: `git status --porcelain test/fixtures/compose-golden/` after the capture lists only `skill-coordinator-monolith.txt`; `git diff --stat 6e1a9d4 -- test/fixtures/compose-golden/` shows `1 insertion(+), 1 deletion(-)`.
- **AC5** — Given AC1–AC4, when the teamwork coordinator bundle is measured (the
  `test/context-budget.test.mjs` method: stripped design-arm constitution + separator + stripped
  claude-code coordinator body, chars/4), then it is ≤ 21715 with the cap unchanged (trial
  measurement: 21430, from 21398) and `test/context-budget.test.mjs` is not modified.
  proof: `node --test test/context-budget.test.mjs` passes and `git diff 6e1a9d4 -- test/context-budget.test.mjs` is empty.
- **AC6** — Given AC1–AC4, when the site-pinning tests run, then
  `test/subagent-templates.test.mjs`, `test/e403-lean-dispatch-alias.test.mjs` and
  `test/e408-core-task-alias-tail.test.mjs` pass without edits (re-pin only if one is red, with the
  reason in the review doc).
  proof: `node --test test/subagent-templates.test.mjs test/e403-lean-dispatch-alias.test.mjs test/e408-core-task-alias-tail.test.mjs` exits 0.
- **AC7** — Given the lane HEAD, when the change set and release hygiene are checked, then
  `git diff --name-only 6e1a9d4...HEAD` lists only paths in the Lanes row `e412` 擁有 cell, `dist/`
  has no diff after `npm run build`, `npm run check:bookkeeping` and
  `npm audit --audit-level=high` exit 0, and the full suite passes.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 on the last HEAD; `git status --porcelain dist/` is empty after the build.

## Site map

| file | line | site | string | AC | task |
|---|---|---|---|---|---|
| `templates/claude-code-agents/qa-visual.md` | 4 | `description:` value | `tpl.desc` | AC1 | T-E412-01 |
| `templates/claude-code-agents/qa-visual.md` | 9 | delegation line, text before `On invocation,` replaced; the `On invocation, …` clause unchanged | `tpl.body` | AC2 | T-E412-01 |
| `content/coord-05-core-visual-drift.md` | 5 | dispatch sentence: insert the when-to-pick clause after `` (subagent-dispatch tool or `tw_switch_role`) ``; lines 6–21 unchanged | `coord05.5` | AC3 | T-E412-02 |
| `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | 260 | re-captured (carries coord-05 line 5) | — | AC4 | T-E412-03 |
| `test/e412-qa-visual-template.test.mjs` (new, qa names it inside the owned glob) | — | pins `tpl.desc`, `tpl.body`, `coord05.5` and the unchanged neighbours (AC1–AC3) | — | AC1–AC3 | T-E412-03 |
| `test/subagent-templates.test.mjs` | — | expected unchanged; re-pin only if red | — | AC2, AC6 | T-E412-03 |
| `test/e403-lean-dispatch-alias.test.mjs` | — | expected unchanged; re-pin only if red | — | AC6 | T-E412-03 |
| `test/e408-core-task-alias-tail.test.mjs` | 35 | pins `` (subagent-dispatch tool or `tw_switch_role`) `` in coord-05; expected unchanged | — | AC3, AC6 | T-E412-03 |

Trial run (PM, on a scratch copy of the lane base with the three strings applied; no worktree file
edited): teamwork bundle 21398 → 21430 ~tok (cap 21715, 285 headroom); golden re-capture moved only
`skill-coordinator-monolith.txt`, one line (line 260); `subagent-templates`, `e403`, `e408`,
`skill-manifest`, `e393-builder-judge-core`, `e407-restatement-citations`, `compose-equivalence`,
`e90-golden-capture-completeness`, `context-budget` and `render-structure` suites: 154/154 pass
(with the re-captured golden). Full `node --test test/*.test.mjs` on the same scratch copy: 4032/4042;
all 8 reds fail on `git ls-files` / `git archive` with "not a git repository" (the scratch copy has
no `.git`), none reads a file this cut changes; QA's AC7 run in the worktree is the binding one. The uncapped no-host lean coordinator composition (coord-05 is
`core`-tagged) moves 8094 → 8127 ~tok; no test caps it. The lean always-on bundle (cap 5723) does
not include coord-05.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| tpl.desc | `description: qa-engineer's visual sub-dispatch — independent judge context for the visual verdict on a design-armed feature with Visual Baselines (Phase 1.5).` | authored-here — backlog E412 option (a) asks for "qa-engineer's visual sub-dispatch"; `## ` and `: ` kept out of the YAML plain scalar |
| tpl.body | ``This subagent is qa-engineer's visual sub-dispatch under a pinned model tier: an independent judge context, separate from the builder's and the coordinator's, that owns the visual verdict (Constitution §3.2). Use it in place of `qa-engineer` for the QA hop when the feature is design-armed and `design/<feature>.md` has a `## Visual Baselines` section. On invocation, call `tw_get_state` then `tw_switch_role("qa-engineer")` and follow the returned SOP, lazy-loading qa-visual when Visual Baselines are present.`` | authored-here — trigger quoted from `content/skill-qa-engineer.md` Phase 1.5 (`## Visual Baselines` in `design/<feature>.md`); verdict owner from `content/const-11-design-chain-32.md` line 10; the `On invocation, …` clause is the lane-base text unchanged |
| coord05.5 | ``- **No accept-policy injection.** When dispatching `qa-visual` (subagent-dispatch tool or `tw_switch_role`) — picked over `qa-engineer` for the QA hop when the feature is design-armed and `design/<feature>.md` has `## Visual Baselines` — the brief MAY`` | authored-here — backlog E412 option (a) and manifest E412 bullet ("design-armed、Visual Baselines 存在時的視覺 verdict"); the parenthetical pinned by `test/e408-core-task-alias-tail.test.mjs` line 35 is kept |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Retiring the template (option b), changing `EXPECTED_ROLES` or the SKILL_MAP in
  `test/subagent-templates.test.mjs`.
- `content/skill-qa-visual.md`, `content/skill-qa-engineer.md`, `content/const-11-design-chain-32.md`
  (the verdict-owner name stays), README line 105, any other template, any other content file or
  coord-05 line, any other golden.
- Raising any budget cap or editing `test/context-budget.test.mjs` (E397).
- Release bookkeeping (version, CHANGELOG, backlog done-mark): integrator 5c / release-engineer.

## Dependencies / Prerequisites

(Visual Structural Assertions omitted: no `design/e412-qa-visual-template.md`, mode = no-design.)
Lane base `6e1a9d4`; `.current/.config.json` has `cutApprovalAutoTier: {}`, so the cut goes to the
integrator mailbox pre-review first and is then approved by the human in the lane session.

Rulings applied (not re-asked): E412 = option (a) and pins `pm=opus`, `sr-engineer=opus`,
`code-reviewer=opus`, `qa-engineer=sonnet`, per the manifest Decisions table (2026-11-05).

Resource audit: the sources are in-repo documents; no URL, design file or external ticket system is
referenced. `external_refs` omitted.

## Gate Summary

| gate | result |
|---|---|
| Visual State-Count Split | not triggered — no visual surface |
| Geometric-Density Split Gate | not triggered — non-design |
| Parallel-Lane Cut | not applicable — this spec is one lane of an approved fan-out |
| Scope Decision Gate | not gated (no design file) |
| Resource Audit Gate | zero external hits; `external_refs` omitted |
| Source-Credibility Gate | not applicable — no design source |
| Question Batch Gate | zero questions — the option was ruled in the manifest Decisions table |
| Ambiguity Gate | clear |
| Cut-Approval Gate | cut below; subagent-dispatched PM — `cut_approved` not set; integrator mailbox pre-review, then human approval in the lane session |
| Manifest-Tier Self-Attestation | `node scripts/fanout.mjs check --cut specs/fanout-prompt-audit-w7.md e412 specs/e412-qa-visual-template.md`; not eligible — `cutApprovalAutoTier.manifest` not set |
| Integrator Stage 0 cut | not applicable |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E412-01 | sr-engineer: qa-visual template — line 4 → `tpl.desc`, line 9 → `tpl.body`; lines 1–3, 5–8 and the `On invocation, …` clause unchanged (AC1, AC2) | none | 1 | `templates/claude-code-agents/qa-visual.md` | — |
| T-E412-02 | sr-engineer: coord-05 line 5 → `coord05.5`; the `` (subagent-dispatch tool or `tw_switch_role`) `` parenthetical and lines 1–4, 6–21 unchanged (AC3) | none | 1 | `content/coord-05-core-visual-drift.md` | — |
| T-E412-03 | qa-engineer: new `test/e412-*` test pinning AC1–AC3; `npm run build && node scripts/capture-constitution-golden.mjs` — only `skill-coordinator-monolith.txt` moves, one line, commit only that golden (AC4); re-measure the teamwork bundle, no cap edit (AC5); run `subagent-templates`, `e403-lean-dispatch-alias`, `e408-core-task-alias-tail`, re-pin only if red (AC6); final `node scripts/test-lock.mjs -- npm test`, `git status --porcelain dist/` empty, `npm run check:bookkeeping`, `npm audit --audit-level=high` on the last HEAD (AC7) | T-E412-01, T-E412-02 | 2–5 | `test/e412-*.test.mjs` `test/fixtures/compose-golden/skill-coordinator-monolith.txt` `test/subagent-templates.test.mjs` `test/e403-lean-dispatch-alias.test.mjs` `test/e408-core-task-alias-tail.test.mjs` | — |
