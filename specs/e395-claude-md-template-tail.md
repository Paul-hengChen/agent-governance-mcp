# e395-claude-md-template-tail

Lane `e395` of fan-out wave `prompt-audit-w4` (`specs/fanout-prompt-audit-w4.md`). Tickets **E395** (CLAUDE.md literals, Layout rows, F1 wording) and **E404** (slim `templates/claude-code-agents/release-engineer.md`). Mini-chain: pm → sr-engineer → code-reviewer → qa-engineer, no architect. Base `1000517`. Non-design. No schema change. No `.ts` change.

## Decisions

| date | by | decision | why |
|---|---|---|---|
| 2026-11-04 | human (manifest ruling 5) | E395 changes only the ticket-named literals: CLAUDE.md "229 test files" in Layout and in Testing changes, "(35 entries)" in What this repo is, "35 gate definitions" in Layout. Plus the Layout additions and the F1 wording. Unchanged: "thirteen `tw_*` tools", "18-step" (both sites), "12 model-pinned", "(15 fragments)", the four `test/e178a-integrator-role.test.mjs` AC5 sentences ("12 registered role prompts", "Twelve prompts are registered", "the other ten", "the other 11 role SOPs"), the "## Agent Governance" and "## Execution Profile" adapter blocks, and the `agc-version` stamp. | Manifest Decisions row "approve", ruling 5 |
| 2026-11-04 | human (manifest ruling 3) | E404 keep-list: frontmatter; the CRITICAL watermark line (still the first non-blank body line, verbatim); the SOP load sentence plus one sentence saying the Hard rules and steps live in the SOP and are not restated here; the RELAY paragraph (old line 19) verbatim; one re-baseline hint sentence that points at the new SOP step 5; the example reply suffix `… — @release-engineer (opus)`. Old lines 11, 13, 15, 17, 21 and 23 are deleted. | Manifest Decisions row "approve", ruling 3 |
| 2026-11-04 | human (manifest ruling 4) | The skill half of G2-17d is already closed by E394. `content/**` is forbidden for this lane: E404 reads `content/skill-release-engineer.md` for step numbers only. | Manifest ruling 4 |
| 2026-11-04 | human (manifest ruling 6) | Pins: `pm=opus`, `sr-engineer=opus`, `code-reviewer=opus`, `qa-engineer=sonnet`. | Manifest ruling 6 |
| 2026-11-04 | integrator (to-lane#1) | The template assertions in three more files go to this lane: `test/e392-subagent-templates.test.mjs` AC8; `test/release-staging.test.mjs` AC5 and C13-AC6/AC7; `test/feature-lease.test.mjs` S4, E17-S3, E17-S4. Their skill assertions stay as they are. | Manifest 所有權重劃 + Decisions row of the same date |
| 2026-11-04 | pm | **The example suffix line is added, not kept.** E392 (`93e901b`) removed the `(haiku)` suffix line, so the file at base has none. Ruling 3 asks for an `(opus)` suffix, so sr adds it as the last line after a blank line. Two pins in owned files then go red and qa re-pins them: `test/subagent-templates.test.mjs` "v3.21.2 AC2: non-haiku templates do NOT contain an example reply suffix line" and `test/e392-subagent-templates.test.mjs` AC8. | The ruling sets the target shape. Both files are in the lane's owned set |
| 2026-11-04 | pm | **The report's G2-17d hunk is not applied as written.** Its load-sentence suffix names "steps 3a, 7b and 8a", which E394 removed. The hint names only SOP step 5, which is the step that exists now (`content/skill-release-engineer.md` step 5: `git fetch origin`, `git -c pull.rebase=false pull --ff-only`, version derived from HEAD). | Re-checked against the current SOP |

## Verified facts (base `1000517`)

| fact | value | source |
|---|---|---|
| CLAUDE.md literal sites | 4 hits | `CLAUDE.md:50` "(35 entries)", `:91` "35 gate definitions", `:126` "229 test files", `:158` "229 test files" |
| F1 site | 1 | `CLAUDE.md:163` "…the suite-result: line in the latest qa_reports/archive/release-*/review_*.md)" |
| Owned CLAUDE.md sections | 3 | `## What this repo is` (`:16`), `## Layout` (`:56`), `## Testing changes` (`:156`). The adapter stamp is at `:223` and the adapter blocks at `:226`/`:231`, outside them |
| `tools/*.ts` missing from Layout | 22 files | `comment-*.ts` (10 files), `dispatch-log.ts`, `evidence-lookup.ts`, `feature-rollup.ts`, `hygiene-scan.ts`, `join-precondition.ts`, `lane-migrate.ts`, `lane-registry.ts`, `lane-ticket-allocation.ts`, `merge-invariants.ts`, `tasks-lane-migrate.ts`, plus `fanout-handoff.ts` / `fanout-manifest.ts`, which the existing `tools/fanout-*.ts` row already covers. So 11 rows are added (1 glob + 10 files) |
| Template at base | 23 lines | `templates/claude-code-agents/release-engineer.md`: frontmatter 1–5, watermark 7, load sentence 9, staging (old 8a) 11, re-baseline (old 3a) 13, STOP-on-⛔ 15, push-rejection 17, RELAY 19, record integrity 21, `driftBaselineIds` 23. No example suffix line (E392 removed it) |
| New SOP re-baseline step | step 5 | `content/skill-release-engineer.md:41` "5. On `main`: `git fetch origin`, `git -c pull.rebase=false pull --ff-only`, then derive `X.Y.Z` from the version at HEAD plus the step 3 bump kind." |
| Approval tier | human, in chat | `.current/.config.json` `cutApprovalAutoTier` is `{}` |

## Problem Statement

Some CLAUDE.md body text will go stale. Two sentences give a test-file count, and two give the gate-registry size. Those numbers are true only until the next test file or gate is added. The Layout section also leaves out 20 `tools/` modules from the 4.x releases, and the Testing changes comment sends readers to "the latest" `qa_reports/archive/release-*/` folder. Sorted by name, the last folder can lack a `suite-result:` line (E391 reviewer F1). Separately, `templates/claude-code-agents/release-engineer.md` still repeats the old SOP: step 8a staging, step 3a re-baseline, the §3/§6 STOP bullets, record integrity and `driftBaselineIds`. After E394, those live in the rewritten SOP and in `scripts/release.mjs prepare`. The repeated copy names step numbers that no longer exist, and it is shaped unlike the other 11 templates.

## User Stories

- As an agent reading CLAUDE.md, I want the Layout to list every `tools/` module and the body to give no counts that will go stale, so that I can find a module and am not misled by an old number.
- As a maintainer, I want the release-engineer subagent template shaped like the other 11, so that the SOP is the only normative source and the template cannot drift from it.
- As a coordinator dispatching release-engineer, I want the template to keep the relay rule, the watermark and the step 5 re-baseline hint, so that the dispatch context still carries what a no-MCP session and a stale base need.

## Acceptance Criteria

### E395 — CLAUDE.md

- **AC-E395-1 (no stale literals)** — Given `CLAUDE.md` at lane HEAD, when the four ticket-named sites are read, then none gives a test-file count or a gate-definition / registry-entry count: no `\b\d+ test files\b`, no `\b\d+ gate definitions\b`, no `\(\d+ entries\)`.
  proof: `grep -cE '[0-9]+ test files|[0-9]+ gate definitions|\([0-9]+ entries\)' CLAUDE.md` → `0`.
- **AC-E395-2 (replacement text)** — Given the four sites, when they are rewritten, then each matches its Copy / Strings row (`c395.what-50`, `c395.layout-91`, `c395.layout-126`, `c395.testing-158`) verbatim.
  proof: `grep -cF` of each Copy / Strings `new text` in `CLAUDE.md` → `1` each.
- **AC-E395-3 (out-of-ruling text untouched)** — Given ruling 5, when the diff is read, then these each still occur in `CLAUDE.md` with their base count: "thirteen `tw_*` tools" (1), "18-step" (2), "12 model-pinned" (1), "(15 fragments)" (1), "12 registered role prompts" (1), "Twelve prompts are registered" (1), "the other ten" (2), "the other 11 role SOPs" (1). Every changed line of `CLAUDE.md` is inside What this repo is, Layout or Testing changes. The `<!-- agc-version: … -->` line and everything after it are byte-identical to base.
  proof: `git diff 1000517 -- CLAUDE.md` changes lines only in the ranges of those three headings; `git diff 1000517 -- CLAUDE.md | grep -c 'agc-version'` → `0`; `npm test` green for `test/e178a-integrator-role.test.mjs` with the file unmodified.
- **AC-E395-4 (Layout rows added, in order)** — Given the Layout code block, when the 11 rows in Copy / Strings `c395.layout-rows` are added, then each appears exactly once at column 0, as one contiguous block directly after the `tools/fanout-*.ts` row and directly before `gates/registry.ts`, in the listed order. No existing row is moved or edited (other than `c395.layout-91` / `c395.layout-126`). `test/e391-prompt-audit-stale-facts.test.mjs` AC-G2-24 stays green unmodified: the four rows `lib/render-boundary.ts`, `tools/lane-paths.ts`, `tools/fanout-*.ts`, `tools/lane-status.ts` still count 4, and the anchors `tools/registry.ts` < `tools/handoff-orchestrator.ts` < `tools/rag-coalesce.ts` < `tools/lane-paths.ts` < `gates/registry.ts` keep their order.
  proof: `node --test --test-name-pattern="AC-G2-24" test/e391-prompt-audit-stale-facts.test.mjs` passes; the new `test/e395-*.test.mjs` asserts each row once and in order.
- **AC-E395-5 (every module listed)** — Given `tools/*.ts`, when each basename is looked up in the Layout block, then every file is covered by a `tools/<name>.ts` row or by a `tools/<prefix>-*.ts` glob row. The only globs are `tools/fanout-*.ts` and `tools/comment-*.ts`.
  proof: the new `test/e395-*.test.mjs` case that lists `tools/*.ts` and finds zero uncovered.
- **AC-E395-6 (F1)** — Given Testing changes, when the `npm test` comment names where the pass count lives, then it reads as in Copy / Strings `c395.testing-163`: "most recent release", by release date and not by folder name. "the latest qa_reports" is gone, and `suite-result:` occurs exactly once in the section (AC-G2-03).
  proof: `node --test --test-name-pattern="AC-G2-03" test/e391-prompt-audit-stale-facts.test.mjs` passes; `grep -cF "the latest qa_reports" CLAUDE.md` → `0`; `grep -cF "most recent release" CLAUDE.md` → `1`.
- **AC-E395-7 (e391 guard)** — Given `test/e391-prompt-audit-stale-facts.test.mjs`, when the suite runs, then all its CLAUDE.md cases pass unmodified, including "changed CLAUDE.md sections add no literal gate-definition or pass counts". If one needs a re-pin, it is limited to that file's CLAUDE.md assertions and reported in `qa_reports/`.
  proof: `node --test test/e391-prompt-audit-stale-facts.test.mjs` → `fail 0`.

### E404 — release-engineer template

- **AC-E404-1 (shape)** — Given `templates/claude-code-agents/release-engineer.md` at lane HEAD, when its body (after the frontmatter) is split into non-blank lines, then there are exactly 5, in this order: watermark, load line, re-baseline hint, RELAY paragraph, example suffix. Blank lines separate them. The file ends with one `\n` and has no trailing blank line. The frontmatter (lines 1–5) is byte-identical to base.
  proof: new `test/e404-*.test.mjs` shape case.
- **AC-E404-2 (watermark)** — Given the body, when its first non-blank line is read, then it is exactly `` CRITICAL: End every reply with `— @release-engineer (<the model tier you were actually invoked with>)` per Constitution §1 (watermark). ``
  proof: `test/subagent-templates.test.mjs` "v3.21.2 AC1" passes unmodified.
- **AC-E404-3 (load line)** — Given the load line, then it is Copy / Strings `c404.load` verbatim: base line 9 unchanged, followed by one added sentence saying the Hard rules and steps are normative in the SOP and not restated here. The substring `` call `tw_get_state` then `tw_switch_role("release-engineer")` `` is kept (pinned by `test/release-staging.test.mjs` C13-AC6 and D10-AC4 watermark/invocation cases).
  proof: `grep -cF` of `c404.load` → `1`.
- **AC-E404-4 (RELAY byte-identical)** — Given the RELAY paragraph, then it is byte-identical to base line 19.
  proof: `diff <(git show 1000517:templates/claude-code-agents/release-engineer.md | sed -n 19p) <(grep '^CRITICAL: If this session has no MCP' templates/claude-code-agents/release-engineer.md)` → no output; `test/subagent-templates.test.mjs` "e9a AC2" and `test/feature-lease.test.mjs` "E9A-S4" pass unmodified.
- **AC-E404-5 (one re-baseline hint)** — Given the template, then exactly one line names `SOP step 5`. That line is Copy / Strings `c404.rebaseline` verbatim, is ≤ 2 sentences (counted as `/[.!?](?:\s|$)/`), and names `git fetch origin` and `` `git -c pull.rebase=false pull --ff-only` ``.
  proof: re-pinned `test/feature-lease.test.mjs` S4.
- **AC-E404-6 (suffix)** — Given the template, then its last line is `Example reply suffix: … — @release-engineer (opus)`, the line before it is blank, and the file has no `(haiku)`.
  proof: re-pinned `test/e392-subagent-templates.test.mjs` AC8.
- **AC-E404-7 (nothing restated)** — Given the template, then none of these occur: `step 3a`, `step 7b`, `step 8a`, `3a)`, `driftBaselineIds`, `Staging scope`, `Stage explicitly`, `Pre-commit verify`, `ALL uncommitted upstream work`, `Record integrity`, `git diff --stat`, `non-fast-forward`, `⛔`, `git reset`, `git rebase`, `git checkout --force`, `git clean`, `origin/<branch>`. The §3 STOP-on-⛔ bullet, the §6 push-rejection bullet and the record-integrity bullet are gone.
  proof: new `test/e404-*.test.mjs` "no restated SOP" case; `test/e166-template-defers-staging.test.mjs` T-E166-01a passes unmodified.
- **AC-E404-8 (other templates untouched)** — Given the other 11 files in `templates/claude-code-agents/`, then they are byte-identical to base.
  proof: `git diff --stat 1000517 -- templates/claude-code-agents/ ':!templates/claude-code-agents/release-engineer.md'` → empty.

### Lane-wide

- **AC-DIST** — Given lane HEAD, when `npm run build` runs, then `git diff --stat dist/` is empty (no `.ts` changes).
  proof: `npm run build && git diff --stat dist/` → empty.
- **AC-BOOK** — Given lane HEAD, then `npm run check:bookkeeping` exits 0.
  proof: `npm run check:bookkeeping; echo "exit=$?"` → `exit=0`.
- **AC-STAMP** — Given lane HEAD, then `node bin/agc-init.mjs check` exits 0 (adapter blocks and stamp untouched).
  proof: `node bin/agc-init.mjs check; echo "exit=$?"` → `exit=0`.
- **AC-SCOPE** — Given lane HEAD, then `git diff --name-only 1000517...HEAD` lists only the paths in **Cut**, plus governance bookkeeping (`.current/e395/**`, `qa_reports/**`, `review_reports/**`) and this spec.
  proof: `git diff --name-only 1000517...HEAD`.
- **AC-GEN (shared generated artifacts untouched)** — Given lane HEAD, then `test/fixtures/**` and `test/context-budget.test.mjs` are unchanged and green. If either goes red, qa stops and reports to the integrator (mailbox `type: escalate`). It is not re-pinned here.
  proof: `git diff --stat 1000517...HEAD -- test/fixtures test/context-budget.test.mjs` → empty.
- **AC-SUITE** — Given the final committed lane HEAD with a clean tree (`git status --porcelain` empty), when `node scripts/test-lock.mjs -- npm test` runs, then it is green, and qa records `qa_suite_result` on the PASS write.
  proof: `node scripts/test-lock.mjs -- npm test` → `fail 0`.

## Copy / Strings

Agent-facing text the lane writes. sr applies each row verbatim. For the Layout rows, sr may tighten a description after re-reading that module's header comment. Each row stays one line, starts with the path at column 0, and gives no count that will go stale. The reviewer checks any change against the module header.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| c395.what-50 | `` metadata is declared once per gate in `gates/registry.ts`. `` (replaces `` metadata is declared once per gate in `gates/registry.ts` (35 entries). ``) | authored-here: E395 drops the count; the sentence already says "once per gate" |
| c395.layout-91 | `gates/registry.ts         GATE_REGISTRY — one definition per gate (code, owner, exemptions)` | authored-here: E395, count replaced by its rule |
| c395.layout-126 | `test/                     node --test suites (test/*.test.mjs); test/eval/ = behavioural eval harness` | authored-here: E395, count replaced by the glob `npm test` runs |
| c395.testing-158 | `` `test/` holds the `node --test` suites covering guards, transitions and round caps, every `` (replaces `` `test/` holds 229 test files covering guards, transitions and round caps, every ``) | authored-here: E395 |
| c395.testing-163 | ``npm test          # prebuild + node --test test/*.test.mjs  (pass count: the suite-result: line in the most recent release's qa_reports/archive/release-*/review_*.md, by release date, not folder name)`` | E391 reviewer F1 (backlog E395 row): "the most recent release" |
| c395.layout-rows | the 11 lines below, in this order, inserted directly after the `tools/fanout-*.ts` row | each description is taken from the module's header comment (authored-here) |
| | `` tools/comment-*.ts        comment-length scan, the sixth `agc check` advisory: scanner, per-language lexers, doc-tag rules, shared types `` | `tools/comment-scan.ts` header and the `comment-lang-*` / `comment-tags` / `comment-types` headers |
| | `tools/dispatch-log.ts     append-only per-hop dispatch-mechanism sidecar (one JSON line per write carrying dispatch_mechanism)` | `tools/dispatch-log.ts` header |
| | `tools/evidence-lookup.ts  archive-aware QA-evidence lookup for tools/drift.ts (qa_reports/ root + qa_reports/archive/<feature>/)` | `tools/evidence-lookup.ts` header |
| | `tools/feature-rollup.ts   feature-level cost roll-up across lane worktrees; reporting only, fires no gate` | `tools/feature-rollup.ts` header |
| | `` tools/hygiene-scan.ts     information-hygiene scan, the fifth `agc check` advisory; never changes the exit code `` | `tools/hygiene-scan.ts` header |
| | `tools/join-precondition.ts  join-ticket build-entry self-check (depends_on lane branches are ancestors of HEAD); not a pipeline gate` | `tools/join-precondition.ts` header |
| | `tools/lane-migrate.ts     flat <-> lane-scoped .current/ layout migration runners` | `tools/lane-migrate.ts` header |
| | `` tools/lane-registry.ts    read-only lane registry derived from `git worktree list` (tw_get_state lane_registry, feature roll-up) `` | `tools/lane-registry.ts` header |
| | `tools/lane-ticket-allocation.ts  collision-free backlog ids for lane findings (<LANE>-NEW-n in .current/<lane>/pending-tickets.md)` | `tools/lane-ticket-allocation.ts` header |
| | `tools/merge-invariants.ts post-merge ledger/sidecar preservation check (scripts/merge-invariants.mjs); fires no gate, writes nothing` | `tools/merge-invariants.ts` header |
| | `tools/tasks-lane-migrate.ts  legacy tasks.md -> lane-local .current/<lane>/tasks.md migration` | `tools/tasks-lane-migrate.ts` header |
| c404.load | `` This subagent runs the agc release-engineer SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role("release-engineer")` and follow the returned SOP exclusively. Its Hard rules and numbered steps are normative there and are not restated here. `` | base line 9 verbatim + manifest ruling 3 ("one sentence saying the Hard rules and steps live in the SOP") |
| c404.rebaseline | `` Before the version bump, re-baseline per SOP step 5: on `main`, `git fetch origin` then `git -c pull.rebase=false pull --ff-only`, and derive the target version from the version at HEAD, never from the baseline read at PASS time. `` | manifest ruling 3 (one sentence, points at step 5); wording follows `content/skill-release-engineer.md` step 5 |
| c404.relay | base line 19, byte-identical (starts `` CRITICAL: If this session has no MCP tool-invocation path at all ``) | manifest ruling 3; pinned by `test/subagent-templates.test.mjs` e9a AC2 |
| c404.suffix | `Example reply suffix: … — @release-engineer (opus)` | manifest ruling 3 |

Target file `templates/claude-code-agents/release-engineer.md` (15 lines): lines 1–5 the base frontmatter, 6 blank, 7 watermark, 8 blank, 9 `c404.load`, 10 blank, 11 `c404.rebaseline`, 12 blank, 13 `c404.relay`, 14 blank, 15 `c404.suffix`, then a newline.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- CLAUDE.md counts that are not named in the ticket: "thirteen `tw_*` tools", "18-step", "12 prompts" / "12 model-pinned", "(15 fragments)", the header paragraph above `## What this repo is` (ruling 5).
- The four `test/e178a-integrator-role.test.mjs` AC5 sentences, the adapter blocks, the `agc-version` stamp.
- `content/**`, including `content/skill-release-engineer.md` (read only), and the skill half of G2-17d (ruling 4).
- The other 11 templates, `templates/agent-adapters/**`, `test/fixtures/**`, `test/context-budget.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e96-dispatch-preference.test.mjs`, `test/render-structure.test.mjs`, and the manifest's common-forbidden list.
- Skill-side assertions in `test/feature-lease.test.mjs`, `test/release-staging.test.mjs` and `test/e166-template-defers-staging.test.mjs` (T-E166-01c).
- Release bookkeeping (version, CHANGELOG, backlog done-marks): the integrator / release-engineer handles these after the wave.

## Dependencies / Prerequisites

- Mode: no-design (no `design/<feature>.md`). Visual Structural Assertions are omitted. No external refs: the only references are repo files.
- Approval: `cutApprovalAutoTier` is `{}`, so the manifest tier is not armed. The cut goes to the integrator's mailbox pre-review (`type: proposal`) and then to the human in the coordinator's chat. pm does not write `next_role=sr-engineer` before the pre-review closes.
- **Open item for integrator pre-review (ownership, not an option choice)** — a dry run of the target template on a scratch copy turned red two more template assertions that are not in the `to-lane#1` reassignment. Both pin a paragraph ruling 3 deletes (old line 17, push-rejection):
  1. `test/release-staging.test.mjs` "D10-AC4: release-engineer.md shim contains the verbatim D10 reinforcement hint (<=2 sentences)". Its sibling "D10-AC4: shim watermark and tw_get_state/tw_switch_role invocation lines are unaltered" stays green.
  2. `test/feature-lease.test.mjs` "E9A-S5 (regression guard): the pre-existing pinned template blocks survive alongside the new E9A paragraph". Its push-rejection `tpl.includes` goes red, and its watermark half stays green.
  
  The pm recommendation is to add both to this lane's template-assertion ownership, in the same files, with the same "skill assertions untouched" limit. They sit in files the lane already partly owns, and e403 owns neither file. T-E404-03 lists them as **conditional on that ruling**. If they are not reassigned, ruling 3's delete of line 17 cannot land green, and the lane escalates.
- Dry-run red set (scratch copy of base with the target CLAUDE.md and template; 10 test files): 12 failures. 9 are the expected re-pins listed in **Re-pin survey**, and 2 are the open item above. The twelfth, `release-staging.test.mjs` "Partition (E66, T-E66-02)", failed only in the scratch copy (a layout difference) and passes in the worktree. The change adds no top-level directory. All `test/e391-prompt-audit-stale-facts.test.mjs` and `test/e178a-integrator-role.test.mjs` cases passed.

## Re-pin survey

Searched `test/` (fixtures excluded) for every test file that reads `templates/claude-code-agents/release-engineer.md` or the `CLAUDE.md` body. Confirmed by the dry run above.

| test file | case | red after the change? | owner / action |
|---|---|---|---|
| `test/subagent-templates.test.mjs` | "v3.21.2 AC2: non-haiku templates do NOT contain an example reply suffix line" | **yes** (the `(opus)` suffix is added) | owned; re-pin: exempt `release-engineer` and assert its suffix is the `(opus)` line (T-E404-02) |
| `test/subagent-templates.test.mjs` | v3.21.2 AC1 watermark first line; e9a AC2 RELAY; `HAIKU_ROLES` | no | owned; stays unmodified |
| `test/e392-subagent-templates.test.mjs` | AC8 (no suffix, 23 lines, last line `driftBaselineIds`) | **yes** | owned (AC8 only); re-pin to: no `(haiku)`, last line the `(opus)` suffix, 15 lines (T-E404-02) |
| `test/e166-template-defers-staging.test.mjs` | T-E166-01b (staging line names step 8a / "Stage explicitly" / "Pre-commit verify") | **yes** (line deleted) | owned; re-pin to the inverse: the template names no staging step and no "Stage explicitly" / "Pre-commit verify" anchor, and defers to the SOP (T-E404-02). T-E166-01a / 01c stay unmodified |
| `test/release-staging.test.mjs` | AC5 (staging reinforcement hint) | **yes** | owned; re-pin: no staging hint in the template; keep its watermark / invocation asserts (T-E404-03) |
| `test/release-staging.test.mjs` | C13-AC6/AC7 STOP-on-⛔ hint; C13-AC6/AC7 `driftBaselineIds` hint | **yes** ×2 | owned; re-pin to absence; the "C13-AC6: shim watermark … unaltered" case stays green unmodified (T-E404-03) |
| `test/release-staging.test.mjs` | D10-AC4 verbatim D10 hint | **yes** | **not yet owned**: open item 1 (T-E404-03, conditional) |
| `test/feature-lease.test.mjs` | S4 (needs `origin/<branch>` + "SOP step 3a") | **yes** | owned; re-pin to `c404.rebaseline`: `SOP step 5`, `git fetch origin`, `git -c pull.rebase=false pull --ff-only`, ≤ 2 sentences (T-E404-03) |
| `test/feature-lease.test.mjs` | E17-S3 (record-integrity paragraph in the template) | **yes** | owned; re-pin to absence (the SOP Hard rule holds it; E17-S1 stays) (T-E404-03) |
| `test/feature-lease.test.mjs` | E17-S4 template half (push-rejection, `driftBaselineIds`) | **yes** | owned (template half); re-pin to watermark first + RELAY present + push-rejection / `driftBaselineIds` absent; skill half unmodified (T-E404-03) |
| `test/feature-lease.test.mjs` | E9A-S5 (push-rejection paragraph present) | **yes** | **not yet owned**: open item 2 (T-E404-03, conditional) |
| `test/feature-lease.test.mjs` | E9A-S4 (RELAY) | no | stays unmodified |
| `test/e391-prompt-audit-stale-facts.test.mjs` | AC-G2-03 / 13 / 15 / 24, "no literal gate-definition or pass counts" | no (dry run green) | owned (CLAUDE.md asserts); expected unmodified (T-E395-03) |
| `test/e178a-integrator-role.test.mjs` | AC5 four sentences | no | e403's; must stay green unmodified |
| `test/e108-eject.test.mjs`, `test/e250-eject-path-escape.test.mjs`, `test/e336-portable-pull.test.mjs` | read the templates dir / pull form | no (dry run green) | not edited |
| `test/e234-hygiene-scan.test.mjs`, `test/e258b-comment-scan.test.mjs` | scan `git archive HEAD` | to be confirmed on committed HEAD (T-E395-04) | not edited; the new text has no absolute path or user name |

## Site index

Total: 2 sr files (`CLAUDE.md`, the template) + 7 test files (5 re-pinned, 2 new). No schema change, no `.ts`, `dist/` unchanged, non-design. Every row's `touches` sits inside the e395 row's `擁有` cell in the manifest. The two conditional sites in T-E404-03 also need the open-item ruling.

Site → AC → task:

| file | site | AC | task |
|---|---|---|---|
| `CLAUDE.md` | `:50` "(35 entries)" | AC-E395-1, AC-E395-2 | T-E395-01 |
| `CLAUDE.md` | `:91` "35 gate definitions" | AC-E395-1, AC-E395-2 | T-E395-01 |
| `CLAUDE.md` | `:126` "229 test files" | AC-E395-1, AC-E395-2 | T-E395-01 |
| `CLAUDE.md` | `:158` "229 test files" | AC-E395-1, AC-E395-2 | T-E395-01 |
| `CLAUDE.md` | `:163` F1 | AC-E395-6 | T-E395-01 |
| `CLAUDE.md` | Layout, after `:90` (11 rows) | AC-E395-4, AC-E395-5 | T-E395-02 |
| `CLAUDE.md` | everything else | AC-E395-3 | T-E395-01/02 (no change), T-E395-04 (verify) |
| `templates/claude-code-agents/release-engineer.md` | `:1-5`, `:7`, `:19` kept | AC-E404-1, AC-E404-2, AC-E404-4 | T-E404-01 |
| `templates/claude-code-agents/release-engineer.md` | `:9` → `c404.load` | AC-E404-3 | T-E404-01 |
| `templates/claude-code-agents/release-engineer.md` | `:13` → `c404.rebaseline` | AC-E404-5 | T-E404-01 |
| `templates/claude-code-agents/release-engineer.md` | `:11`, `:15`, `:17`, `:21`, `:23` deleted | AC-E404-7 | T-E404-01 |
| `templates/claude-code-agents/release-engineer.md` | new last line `c404.suffix` | AC-E404-6 | T-E404-01 |
| `test/subagent-templates.test.mjs` | v3.21.2 AC2 non-haiku suffix case | AC-E404-6 | T-E404-02 |
| `test/e392-subagent-templates.test.mjs` | AC8 | AC-E404-1, AC-E404-6 | T-E404-02 |
| `test/e166-template-defers-staging.test.mjs` | T-E166-01b | AC-E404-7 | T-E404-02 |
| `test/e404-release-engineer-template.test.mjs` (new) | — | AC-E404-1, 3, 4, 5, 7 | T-E404-02 |
| `test/release-staging.test.mjs` | AC5; C13-AC6/AC7 ×2; D10-AC4 (conditional) | AC-E404-7 | T-E404-03 |
| `test/feature-lease.test.mjs` | S4; E17-S3; E17-S4 template half; E9A-S5 (conditional) | AC-E404-5, AC-E404-7 | T-E404-03 |
| `test/e395-claude-md-tail.test.mjs` (new) | — | AC-E395-1, 2, 4, 5, 6 | T-E395-03 |
| `test/e391-prompt-audit-stale-facts.test.mjs` | CLAUDE.md asserts (expected unmodified) | AC-E395-7 | T-E395-03 |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E395-01 | sr (E395 literals + F1): in `CLAUDE.md`, apply `c395.what-50` (What this repo is `:50` → AC-E395-1/2), `c395.layout-91` (`:91` → AC-E395-1/2), `c395.layout-126` (`:126` → AC-E395-1/2), `c395.testing-158` (`:158` → AC-E395-1/2) and `c395.testing-163` (`:163` → AC-E395-6), verbatim. No other line changes (AC-E395-3). About 5 lines | none | 1 | `CLAUDE.md` | — |
| T-E395-02 | sr (E395 Layout): insert the 11 `c395.layout-rows` lines as one block directly after the `tools/fanout-*.ts` row, in the listed order. Re-read each module header and tighten the wording only if it is wrong. Add rows; never move or edit one (AC-E395-4, AC-E395-5). About 11 lines | T-E395-01 | 1 | `CLAUDE.md` | — |
| T-E404-01 | sr (E404 slim): rewrite the template to the 15-line target in Copy / Strings: keep the frontmatter, the watermark (`:7` → AC-E404-2) and the RELAY paragraph (`:19` → AC-E404-4) byte-identical. Replace `:9` with `c404.load` (AC-E404-3) and `:13` with `c404.rebaseline` (AC-E404-5). Delete `:11`, `:15`, `:17`, `:21`, `:23` (AC-E404-7). Append a blank line + `c404.suffix` (AC-E404-6). Result: AC-E404-1. Touch no other template (AC-E404-8) | none | 1 | `templates/claude-code-agents/release-engineer.md` | — |
| T-E395-03 | qa (E395 tests): write `test/e395-claude-md-tail.test.mjs` for AC-E395-1, AC-E395-2, AC-E395-4 (11 rows once, contiguous, in order, between `tools/fanout-*.ts` and `gates/registry.ts`), AC-E395-5 (every `tools/*.ts` covered by a row or a glob row) and AC-E395-6. Read only `CLAUDE.md` and the `tools/` directory listing. No fanout manifest, no fixed base sha, no line numbers. Confirm `test/e391-prompt-audit-stale-facts.test.mjs` (AC-E395-7) and `test/e178a-integrator-role.test.mjs` (AC-E395-3) pass unmodified. If an e391 CLAUDE.md assertion needs a re-pin, re-pin that one only and report it | T-E395-02 | 1 (+1 if re-pin) | `test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs` | — |
| T-E404-02 | qa (E404 template-file re-pins + new test): re-pin `test/subagent-templates.test.mjs` "v3.21.2 AC2: non-haiku … no example reply suffix" (exempt release-engineer; assert its `(opus)` suffix line + preceding blank → AC-E404-6). Re-pin `test/e392-subagent-templates.test.mjs` AC8 only (no `(haiku)`; last line `c404.suffix`; 15 lines; no trailing blank → AC-E404-1/6). Re-pin `test/e166-template-defers-staging.test.mjs` T-E166-01b to the inverse (no staging line, no step 8a / "Stage explicitly" / "Pre-commit verify" in the template → AC-E404-7); keep 01a / 01c unmodified. Write `test/e404-release-engineer-template.test.mjs` for AC-E404-1 (5 non-blank body lines in order, frontmatter keys), AC-E404-3, AC-E404-4 (RELAY equals the pinned text, held as a literal in the test, not a git read), AC-E404-5 (exactly one `SOP step 5` line, ≤ 2 sentences) and AC-E404-7 (the absence list) | T-E404-01 | 4 | `test/subagent-templates.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/e166-template-defers-staging.test.mjs`、`test/e404-release-engineer-template.test.mjs` | — |
| T-E404-03 | qa (E404 cross-file template re-pins; template assertions only, skill assertions untouched): `test/release-staging.test.mjs` AC5 (no staging hint; keep watermark / invocation asserts), C13-AC6/AC7 STOP-on-⛔ and C13-AC6/AC7 `driftBaselineIds` (both to absence) → AC-E404-7. `test/feature-lease.test.mjs` S4 (→ `c404.rebaseline`, AC-E404-5), E17-S3 (to absence), E17-S4 template half (watermark first, RELAY present, push-rejection / `driftBaselineIds` absent). **Conditional on the open-item ruling**: `release-staging` D10-AC4 verbatim-hint case and `feature-lease` E9A-S5 push-rejection assert, both to absence | T-E404-01 | 2 | `test/release-staging.test.mjs`、`test/feature-lease.test.mjs` | — |
| T-E395-04 | qa (lane verification): on the final committed HEAD with a clean tree, run AC-SCOPE, AC-E395-3 (diff ranges + stamp), AC-E404-8, AC-DIST, AC-BOOK, AC-STAMP, AC-GEN and AC-SUITE (`node scripts/test-lock.mjs -- npm test`, `qa_suite_result` recorded). `test/e234-hygiene-scan.test.mjs` / `test/e258b-comment-scan.test.mjs` must be green on committed HEAD. A red in `test/fixtures/**` or `test/context-budget.test.mjs` → stop and escalate (AC-GEN), do not re-pin | T-E395-03, T-E404-02, T-E404-03 | 0 | — | — |
