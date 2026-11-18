# e437-prompt-content-hygiene

Lane e437 of the prompt-audit-fixes fan-out (`specs/fanout-prompt-audit-fixes.md`, approved 2026-11-18; Stage 2 rulings 1 = a, 2 = a, 3 = a). One cut, four tickets, run in order: **E437 → E438 → E439 → E440** (audit items M6, M3, M5, M4 of `docs/prompt-audit-2026-11-18.md`). Base: `41c301e`. `content/**` and `templates/` are byte-identical between the audit's check commit `a68704b` and this base, so every line number below is the base line number and every audit hunk applies cleanly.

Source of each change: the hunks for these sites in `docs/prompt-audit-2026-11-18.diff`, minus every E442 hunk (`content/const-01-core-head.md`, line 7 `CRITICAL:` of every template, kept as is — that includes `templates/claude-code-agents/lite.md` line 7), minus the E436 / E441 hunks (`CLAUDE.md`, `templates/claude-code-agents/release-engineer.md`, `tools/registry.ts`), plus the cut-time additions and adjustments marked **(cut)** below.

## Problem Statement

Text in `content/**` and the subagent templates ships to every adopter and is read by every dispatched agent. Four kinds of text in it do not belong there: citations of paths that exist only in this repo (E437), bare ticket and version labels that sit outside the origin fence the build already strips (E438), incident stories next to the rule they produced, outside the rationale fence (E439), and sentences that describe a change from an earlier prompt version rather than the current rule (E440). The fix uses the mechanisms the repo already has: drop or prefix the path, wrap the label in `<!-- origin:start/end -->`, wrap the story in `<!-- rationale:start/end -->`, restate the sentence as the current rule. No behaviour, tool, gate or schema changes.

## User Stories

- As an adopter's dispatched agent, I want every path the prompt tells me to open to resolve from my workspace (or name the agc install), so that I never chase a file that is not there.
- As a dispatched agent, I want the rule text without ticket ids, version tags and incident stories, so that my context holds only instructions I can act on.
- As a maintainer reading a full-detail bundle or the source, I want the labels and stories kept inside their fences, so that the history behind each rule is still there.

## Site tables (base `41c301e`)

### E437 — repo-only path citations (13 sites, as listed in the backlog row; all re-verified)

| # | file:line | current text (excerpt) | planned change |
|---|---|---|---|
| 1 | `content/const-10-chain-31-tail.md:3` | `read it and self-correct. Full matrix: \`specs/qa-flow-enforcement-architecture.md\`.` | delete the `Full matrix:` sentence |
| 2 | `content/const-08-chain-31-mid.md:7` | `…millisecond entropy; the exact predicate lives in \`gates/stamp-provenance.ts\`, shared with the read-side drift advisory, not restated here),` | delete the `; the exact predicate lives in …` clause |
| 3 | `content/coord-02-host-dispatch.md:1` | `— copy from \`templates/claude-code-agents/\`)` | prefix: `` `<agc install>/templates/claude-code-agents/` `` (the coordinator must really open these files) |
| 4 | `content/coord-02-host-dispatch.md:1` | `` `ALLOWED_TRANSITIONS` matrix in `tools/transitions.ts` still gates `` | delete `in \`tools/transitions.ts\` ` |
| 5 | `content/skill-pm.md:108` | `…then retry the build handoff. See \`specs/e4-design-source-credibility-gate.md\`.` | delete the `See …` sentence |
| 6 | `content/skill-design-auditor.md:54` | `…no \`## Source\` section at all (no backfill). See \`specs/e4-design-source-credibility-gate.md\`.` | delete the `See …` sentence |
| 7 | `content/skill-qa-visual.md:12` | `(§3 builder ≠ judge provenance; method: \`research/figma-baselines.md\`.)` | delete `; method: …` → `(§3 builder ≠ judge provenance.)` |
| 8 | `content/skill-qa-visual.md:24` | FAIL note `"context-dependent property requires per-context baseline — see §四#7 in \`research/mode-feature-process-retrospective.md\`"` | delete the ` — see …` tail; the note the agent writes becomes `"context-dependent property requires per-context baseline"` |
| 9 | `content/skill-doc-writer.md:15` | `doc-writer is NOT in \`ALLOWED_TRANSITIONS\` (\`tools/transitions.ts\`)` | delete ` (\`tools/transitions.ts\`)` |
| 10 | `content/skill-coordinator-lite.md:16` | `Lite has no \`agent_id\` in the routing chain (\`tools/transitions.ts\`);` | delete ` (\`tools/transitions.ts\`)` |
| 11 | `content/skill-coordinator-lite.md:43` | `call \`validateWatermark\` from \`dist/lib/watermark-check.js\`` | prefix: `` `<agc install>/dist/lib/watermark-check.js` `` plus **(cut)** the inline definition `` (`<agc install>` = agc's install directory, not the workspace) `` — the lite bundle carries no other definition of the prefix |
| 12 | `templates/claude-code-agents/lite.md:9` | `follow the coordinator-lite SOP from \`content/skill-coordinator-lite.md\`` | prefix + inline definition: `` from `<agc install>/content/skill-coordinator-lite.md` (`<agc install>` = agc's install directory, not the workspace) `` |
| 13 | `templates/claude-code-agents/lite.md:9` | `…has no such check (\`specs/d8-lite-recommended-model.md\` Amendment, AC8).` | delete the parenthetical, sentence ends `…has no such check.` |

Not touched by E437: line 7 of `lite.md` (`CRITICAL:` — E442, ruled keep); adopter paths such as `specs/<feature>.md`; the `research/` citations at `content/const-11-design-chain-32.md:5` and `content/skill-design-auditor.md:27,53,59`, which E439 moves into rationale fences; the `research/` / `docs/dependency-advisories.md` mentions that are already explicitly framed as this repo's own instance.

### E438 — bare ticket / version labels (recount at base: 41 sites from the diff + 4 found at cut = 45)

Recount method: every label site in the diff hunks, then a scan of every `content/*.md` (except `constitution-rationale.md`) after `stripOriginTags` + `stripRationale` for `E\d+`, `v\d+.\d+.\d+`, `[A-Z]\d+`-style labels, with the four E437–E440 changes applied. The scan left four labels the diff did not list (marked **(cut)**); placeholders (`F0` in coord-01 examples, `<E1[,E2…]>` in the forbidden `skill-release-engineer.md`) are not labels. The audit's "about 43" counted `v3.26.0, R3/R-VIS` as two and coord-03's `pre-v3.20.0` (E440) as one of six.

Wrap = enclose the label (with its leading space / separator) in `<!-- origin:start -->…<!-- origin:end -->`, exactly as the neighbouring fenced labels are written.

| # | file:line | label | change |
|---|---|---|---|
| 1 | `content/const-02-design-mvp.md:2` | `Visual Widgets exception (v3.14.0)` | wrap ` (v3.14.0)` — the heading's name becomes *Visual Widgets exception* |
| 2 | `content/const-13-design-chain-s4.md:6` | `(the v3.16.0\nself-arming signal)` | wrap ` v3.16.0` |
| 3 | `content/const-15-core-tail.md:12` | `isolation/set-aside tool; E25)` | wrap `; E25` |
| 4 | `content/coord-02-host-dispatch.md:38` | `rejected on read (E300).` | wrap ` (E300)` |
| 5 | `content/coord-03-core-fallback.md:2` | `the mismatch signal (E99):` | wrap ` (E99)` |
| 6 | `content/coord-03-core-fallback.md:11` | `**Feature-Scope Gate** (E1):` | wrap ` (E1)` |
| 7 | `content/coord-03-core-fallback.md:58` | `**Lane findings are numbered at finish time** (E179):` | wrap ` (E179)` |
| 8 | `content/coord-03-core-fallback.md:60` | `**Bookkeeping never lands on local \`main\`** (E297):` | wrap ` (E297)` |
| 9 | `content/coord-03-core-fallback.md:66` | `inside its own tree (E301).` | wrap ` (E301)` |
| 10 | `content/coord-05-core-visual-drift.md:18` | `*Sequential-context assumption + reconcile* (R10): you` | wrap ` (R10)` |
| 11 | `content/skill-design-auditor.md:17` | `(Constitution §1, v3.27.0)` | wrap `, v3.27.0` |
| 12 | `content/skill-design-auditor.md:24` | `**\`credibility\` column (E4)` | wrap ` (E4)` |
| 13 | `content/skill-design-auditor.md:27` | `**Visual Widgets** (v3.14.0)` | wrap ` (v3.14.0)` |
| 14 | `content/skill-design-auditor.md:29` | `*(MANDATORY when mode ≠ no-design; v3.26.0, R3/R-VIS)*` | wrap `; v3.26.0, R3/R-VIS` |
| 15 | `content/skill-design-auditor.md:54` | `**Record the attestation (E4)` | wrap ` (E4)` |
| 16 | `content/skill-design-auditor.md:55` | `**Mechanical baseline selection (v3.39.0)` | wrap ` (v3.39.0)` |
| 17 | `content/skill-design-auditor.md:87` | `source-don't-redraw (Constitution §1 v3.28.0)` | **rename** → `(Constitution §1 *Design-sourced assets*)` |
| 18–32 | `content/skill-integrator.md:70, 94, 105, 107, 113, 142, 156, 158, 166 (×2), 174, 178, 186, 196 (×2)` | `## Governance state (D11)`, `(E177a)`, `(E177b)`, `(E177a)`, `(E178b)`, `, E298`, `(E298)`, `(E192, D10)`, `(E192)`, `E182, …`, `(E126)`, `(the E222 precedent)`, `(E124)`, `(E124)`, `(E125)` | wrap each, as in the diff (15 sites) |
| 33 | `content/skill-pm.md:31` | `**Visual Widgets** (v3.14.0)` | wrap ` (v3.14.0)` |
| 34 | `content/skill-pm.md:108` | `**Source-Credibility Gate** (E4)` | wrap ` (E4)` |
| 35 | `content/skill-qa-engineer.md:58` | `**Phase 1.5 — Visual Compare** (v3.14.0: lazy-load …)` | wrap `v3.14.0: ` (keeps `(lazy-load + PASS-gated when Visual Baselines present)`) |
| 36 | `content/skill-qa-engineer.md:60` | `AND the v3.14.0 Visual Widgets shape checklist` | delete `v3.14.0 ` |
| 37 | `content/skill-qa-visual.md:10` | `### Step A.0 — Baseline Source-of-Truth (v3.39.0)` | wrap ` (v3.39.0)` |
| 38 | `content/skill-qa-visual.md:26` | `### Actual-Capture Output Convention (E30)` | wrap ` (E30)` |
| 39 | `content/skill-sr-engineer.md:27` | `(Constitution §1 Design-sourced assets v3.28.0.)` | **rename** → delete ` v3.28.0` (`(Constitution §1 Design-sourced assets.)`) |
| 40 | `content/skill-sr-engineer.md:28` | `(Constitution §1 v3.14.0 exception)` | **rename** → `(Constitution §1 Visual Widgets exception)` |
| 41 | `content/skill-sr-engineer.md:29` | `the step 7a format (C15)` | wrap ` (C15)` |
| 42 | `content/skill-architect.md:24` **(cut)** | `(skill-sr-engineer R5)` — `R5` is the fenced label of sr-engineer's *Scoped Render Self-Check*, so after the strip the reference names nothing | **rename** → `(skill-sr-engineer *Scoped Render Self-Check*)` |
| 43 | `content/skill-architect.md:75` **(cut)** | `the visual gate (R1) cannot pass` | wrap ` (R1)` |
| 44 | `content/skill-pm.md:80` **(cut)** | `blurs role ownership (A10).` | wrap ` (A10)` |
| 45 | `content/skill-qa-engineer.md:80` **(cut)** | `Specs without proof annotations (pre-E3) pay zero overhead` | delete ` (pre-E3)` (a version-relative label, nothing to keep in a fence) |

**Renames and their reference sites** (the backlog's "three places where an id is used as a name", plus one found at cut):
- `Constitution §1 v3.14.0 exception` (`skill-sr-engineer.md:28`) → `Constitution §1 Visual Widgets exception`; the target heading is `const-02-design-mvp.md:2` *Visual Widgets exception* (site 1). No other reference to the old name in `content/**`, `templates/**`, `test/**`.
- `Constitution §1 v3.28.0` (`skill-design-auditor.md:87`) → `Constitution §1 *Design-sourced assets*`; target heading `const-02-design-mvp.md:4` *Design-sourced assets* (already fenced). No other reference.
- `Constitution §1 Design-sourced assets v3.28.0` (`skill-sr-engineer.md:27`) → `Constitution §1 Design-sourced assets`; same target.
- **(cut)** `skill-sr-engineer R5` (`skill-architect.md:24`) → `skill-sr-engineer *Scoped Render Self-Check*`; target `skill-sr-engineer.md:23` (`5. **Scoped Render Self-Check (v3.26.0, R5)**`, label already fenced). No other reference to `sr-engineer R5`.
- `coord-03`'s `pre-v3.20.0` sentence is E440 (below), not E438.
- `content/constitution-rationale.md:180` (`§1 v3.31.0`) is in the non-normative rationale file, composed into no bundle: out of scope.

### E439 — incident stories into the rationale fence (11 sites)

Fence = `<!-- rationale:start -->…<!-- rationale:end -->` around the story only. "Rule left outside" is the text a dispatched agent reads after `stripRationale` and must stand alone as a complete instruction. The full-detail bundle changes by the fence markers only — one exception, site 5, where the story ends in `;` and the next clause begins lowercase: the `;` becomes `.` and `design-auditor` becomes `Design-auditor` (as in the audit hunk).

| # | file:line | story (goes inside the fence) | rule left outside the fence |
|---|---|---|---|
| 1 | `content/const-11-design-chain-32.md:4–8` | the whole §3.2 preamble paragraph `Hard governance rules that emerged from a visual false-PASS retrospective (see \`content/constitution-rationale.md\` / \`research/\`). … so these are also server-enforced (§3.1 visual evidence gate + report-schema validation).` | the §3.2 heading followed directly by its bullets (`**Visual verdict is qa-visual-owned.** ONLY qa-visual may define …`); each bullet is itself a complete rule, and §3.1's visual evidence gate already states the server enforcement. **Needs human ruling R1** (§3.x rationale-free zone, below). |
| 2 | `content/skill-pm.md:31` | `This section closes the gap where a column-scroller widget was never enumerated → primitive \`<input type="date">\` shipped → no role had grounds to reject.` | `**Cross-reference to Constitution §1**: when a widget is listed here, sr-engineer substituting an HTML primitive constitutes scope violation, not MVP compliance.` then `If \`design/<feature>.md\` exists …` |
| 3 | `content/skill-architect.md:27` | `Closes the gap where \`design/<feature>.md\` carried Visual Baselines but no role owned building the comparator.` | `The architect's job here is to make sure PM did this — if the spec's task list omits the harness task, block back to PM.` |
| 4 | `content/skill-design-auditor.md:16` | ` (a prior audit "resolved" baselines to the wrong frames by name)` | `Name- or number-matching alone is INSUFFICIENT.` |
| 5 | `content/skill-design-auditor.md:27` (a) | `Closes the gap where PM-only widget enumeration relied on free-form judgement.` (`;` → `.`) | `Design-auditor is the upstream owner because the design source carries the component names.` |
| 6 | `content/skill-design-auditor.md:27` (b) | ` (\`research/mode-feature-process-retrospective.md\` §四#7: toggle ON had two Figma variants but was compressed into one, producing an incorrect implementation)` | `Collapsing a context-dependent property into one answer bakes a wrong spec.` |
| 7 | `content/skill-design-auditor.md:53` | `P2 was saved by this behaviour; P1 was reopened for lack of it (see \`research/mode-feature-process-retrospective.md\` §四#2).` | `Do NOT transcribe values from the wrong node type; the guardrail fires BEFORE any values are written to the audit artifact.` then `` `image`/`pdf`/`paper`/`no-design` modes skip this gate `` |
| 8 | `content/skill-design-auditor.md:59` | `(Method and rationale: \`research/figma-baselines.md\`.)` | `Empty-shell guard from step 4 still applies to every selected node.` |
| 9 | `content/skill-sr-engineer.md:24` | ` (a prior rollout invented boxed-chips + copy)` | `**Inventing a layout/row style is a scope violation, not a default**.` |
| 10 | `content/skill-sr-engineer.md:25` | ` (a prior rollout shipped grey \`#333\` primary buttons while accent \`#3C5AAA\` sat unused)` | `A declared focus/selected/accent token that renders nowhere is a **build-gate failure** — fix before handoff.` |
| 11 | `content/skill-qa-visual.md:28` | ` (this once cost a full pixelmatch forensics round to clear a false alarm)` | `Actuals written next to committed baselines dirty git status on every run, making a real visual regression indistinguishable from routine overwrite at a glance.` |

(Site 5 is the exception noted above; numbering follows the backlog's count: const-11 1, skill-pm 1, skill-architect 1, skill-design-auditor 5, skill-sr-engineer 2, skill-qa-visual 1 = 11.)

**Fence placement constraint (cut, from the trial run).** The audit hunks for sites 3 (`skill-architect.md:27`) and 8 (`skill-design-auditor.md:59`) put an inline `<!-- rationale:start -->` after prose and the `<!-- rationale:end -->` directly before the line's newline. That is the asymmetric-span shape `test/render-structure.test.mjs` detects: after the strip, the next line (a bullet / numbered step) is fused onto this one. In the trial both render sweeps and the structural sweep went red (3 failures: `skill-architect.md` 1, `skill-design-auditor.md` 1). sr-engineer places every E439 fence so that neither detector finds a new span — e.g. keep a non-newline character after `<!-- rationale:end -->` (end the fence before the line's last character, as sites 4, 6, 9, 10, 11 already do with the closing `.`), or make the fence block-style (start marker alone on its own line, as the E87 fence in `coord-03`). The render-structure tracked-debt list is NOT extended; this is a content fix, not a re-pin.

### E440 — version-relative sentences rewritten as the current rule (6 sites)

| # | file:line | current text | rewritten text |
|---|---|---|---|
| 1 | `content/skill-qa-engineer.md:60` | `The escape clause "Phase 1.5 deferred" in \`pending_notes\` is REMOVED — no PASS without diff evidence when baselines exist.` | `No \`pending_notes\` deferral substitutes for it: no PASS without diff evidence when baselines exist.` |
| 2 | `content/coord-03-core-fallback.md:1` | `This is the pre-v3.20.0 behavior — degradation stays graceful for those hosts; no tw_* tool surface has changed.` | delete (the preceding sentence already states the fallback rule) |
| 3 | `content/coord-03-core-fallback.md:9` | `do NOT compute, cache, or write it yourself — the old in-memory counter is retired.` | `do NOT compute, cache, or write it yourself.` |
| 4 | `content/coord-03-core-fallback.md:58` | `The root \`NEW-TICKETS.md\` convention is retired for lane ticket candidates.` | `A root \`NEW-TICKETS.md\` is not a channel for lane ticket candidates.` |
| 5 | `content/coord-02-host-dispatch.md:17` | `quoting the first-class \`dispatch_pins\` field directly (the \`pending_notes\` pin convention is retired, C14).` | `quoting the first-class \`dispatch_pins\` field directly.` |
| 6 | `content/const-05-core-standards.md:19` | `\`pending_notes\` is free text for humans (situation description, rationale), with no remaining routing convention.` | `\`pending_notes\` is free text for humans (situation description, rationale) and carries no routing.` |

Kept byte-identical (legacy-inert sentences, still guide reading old state files): `content/const-08-chain-31-mid.md` Amend-Resume Edge (`a legacy \`resume_of: <role>\` line in \`pending_notes\` is inert`); `content/skill-pm.md` *Amend-Resume declaration* (`a legacy \`resume_of:\` line inside \`pending_notes\` is inert`); every other `legacy … inert` sentence in `content/**`.

## Acceptance Criteria

Notation: "dispatch bundle" = any `buildPromptForRole` output with `fullDetail` false, and every non-`-fd` compose golden; "full-detail bundle" = the `-fd` goldens plus `constitution-monolith.txt`, `skill-coordinator-monolith.txt`, `hook-full.txt`, `hook-lite.txt`. Tests are authored by qa-engineer (Constitution §2); the `proof:` lines name what qa runs.

### E437
- **AC-E437-1** — Given the 13 sites in the E437 table, when the edits land, then none of the 11 changed `content/**` lines and neither `lite.md` site cites `specs/qa-flow-enforcement-architecture.md`, `gates/stamp-provenance.ts`, `tools/transitions.ts`, `specs/e4-design-source-credibility-gate.md`, `research/figma-baselines.md`, `research/mode-feature-process-retrospective.md`, `specs/d8-lite-recommended-model.md`, or a bare `dist/lib/` / `content/` / `templates/` path; the three paths an agent must open (`templates/claude-code-agents/`, `dist/lib/watermark-check.js`, `content/skill-coordinator-lite.md`) carry the `<agc install>/` prefix.
  proof: new `test/e437-*.test.mjs` (qa names it) asserting each of the 13 sites by file + anchor string.
- **AC-E437-2** — Given `templates/claude-code-agents/lite.md`, when an adopter installs it, then the SOP path it gives is `<agc install>/content/skill-coordinator-lite.md` with the inline definition `` (`<agc install>` = agc's install directory, not the workspace) ``, and line 7 is byte-identical to base.
  proof: the same e437 test, plus the re-pinned lite assertions in `test/subagent-templates.test.mjs`, `test/e408-core-task-alias-tail.test.mjs`, `test/e409-lite-write-tool-facts.test.mjs`, `test/teamwork-lite.test.mjs`.
- **AC-E437-3** — Given `content/skill-qa-visual.md` Step C multi-value guard, when the agent writes its FAIL note, then the quoted note text is exactly `context-dependent property requires per-context baseline` (no repo path).
  proof: e437 test anchor on the quoted note.

### E438
- **AC-E438-1** — Given every dispatch bundle, then none of the 45 labels in the E438 table appears in it (the recount scan returns no label from these sites).
  proof: new `test/e438-*.test.mjs` asserting each site's stripped line contains no `E\d+` / `v\d+.\d+.\d+` / `R\d+` / `C\d+` / `A\d+` / `D\d+` label.
- **AC-E438-2** — Given the source files, then each wrapped label is still present inside an `<!-- origin:start -->…<!-- origin:end -->` fence (sites 36 and 45 are deletions, sites 17, 39, 40, 42 are renames).
  proof: the e438 test checks the fenced spans in source.
- **AC-E438-3** — Given the four renamed references, then each new name matches a heading that exists in the dispatch bundle (`Visual Widgets exception`, `Design-sourced assets` ×2, `Scoped Render Self-Check`), and `grep -rn "§1 v3.14.0 exception\|§1 v3.28.0\|sr-engineer R5" content templates` returns nothing.
  proof: the e438 test, plus the grep above.

### E439
- **AC-E439-1** — Given every dispatch bundle, then none of the 11 stories in the E439 table is in it, and each "rule left outside" sentence is present verbatim.
  proof: new `test/e439-*.test.mjs`, one assertion per site (story absent, rule present).
- **AC-E439-2** — Given every full-detail golden, when compared with base, then the only differences attributable to E439 are the added `<!-- rationale:start -->` / `<!-- rationale:end -->` markers, plus the site-5 `;` → `.` / `design-auditor` → `Design-auditor` change.
  proof: qa's hunk-by-hunk golden note (Golden re-capture, below).
- **AC-E439-3** — Given the E439 fences, then `test/render-structure.test.mjs` passes with its tracked debt list unchanged (no new asymmetric span, no new glue finding in either render path).
  proof: `node --test test/render-structure.test.mjs` exits 0 and `git diff 41c301e -- test/render-structure.test.mjs` shows no change to the tracked debt expectations.

### E440
- **AC-E440-1** — Given the six sites, then each reads exactly as the "rewritten text" column (site 2 deleted), and `grep -n "pre-v3.20.0\|is REMOVED\|is retired\|no remaining routing convention" content/*.md` returns nothing.
  proof: new `test/e440-*.test.mjs`, plus the grep above.
- **AC-E440-2** — Given the legacy-inert sentences listed under E440, then each is byte-identical to base.
  proof: the e440 test anchors both sentences.

### Whole cut
- **AC-ALL-1** — Given the final tree, when `npm run build` runs, then `dist/` has zero diff (no `tools/`, `prompts/` or other TypeScript change in this lane).
  proof: `npm run build` then `git status --porcelain dist/` prints nothing.
- **AC-ALL-2** — Given the final tree, when `node scripts/capture-constitution-golden.mjs` runs, then all 12 goldens are byte-identical to the committed ones (qa re-captured once at the end).
  proof: `npm run build && node scripts/capture-constitution-golden.mjs` then `git status --porcelain test/fixtures/compose-golden/` prints nothing.
- **AC-ALL-3** — Given `test/context-budget.test.mjs`, then every cap and floor passes, each re-baselined value carries a one-line `E437-E440 re-baseline` comment with the measured delta (E336/E365 convention).
  proof: `node --test test/context-budget.test.mjs` exits 0.
- **AC-ALL-4** — Given the committed lane branch with a clean tree, when the full suite runs, then it passes except the known environment-only tests (listed under Red-test list), and `npm audit --audit-level=high` and `npm run check:bookkeeping` exit 0.
  proof: `node scripts/test-lock.mjs -- npm test`; `npm audit --audit-level=high`; `npm run check:bookkeeping`.
- **AC-ALL-5** — Given `git diff 41c301e...HEAD --name-only`, then every path is in the lane's owned set (`node scripts/fanout.mjs check --cut …` exits 0) and none of `CLAUDE.md`, `content/skill-release-engineer.md`, `content/const-01-core-head.md`, `templates/claude-code-agents/` other than `lite.md`, `tools/**`, `dist/**`, `guards/**`, `docs/backlog.md` appears.
  proof: `git diff 41c301e...HEAD --name-only`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e437.lite-sop-path | `` follow the coordinator-lite SOP from `<agc install>/content/skill-coordinator-lite.md` (`<agc install>` = agc's install directory, not the workspace) `` | `docs/prompt-audit-2026-11-18.diff` lite.md hunk (E437 row) |
| e437.lite-watermark-path | `` call `validateWatermark` from `<agc install>/dist/lib/watermark-check.js` (`<agc install>` = agc's install directory, not the workspace) `` | audit diff + authored-here — the inline definition copies `content/skill-qa-engineer.md:60`'s, because the lite bundle has no other definition |
| e437.qa-visual-fail-note | `context-dependent property requires per-context baseline` | audit diff, skill-qa-visual hunk (E437 row) |
| e438.rename-widgets | `Constitution §1 Visual Widgets exception` | audit diff (E438 row) |
| e438.rename-assets | `Constitution §1 *Design-sourced assets*` / `Constitution §1 Design-sourced assets` | audit diff (E438 row) |
| e438.rename-r5 | `skill-sr-engineer *Scoped Render Self-Check*` | authored-here — name of the target heading at `content/skill-sr-engineer.md:23` |
| e440.* | the six "rewritten text" cells of the E440 table | audit diff (E440 row) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Budget (ruling 2 = a; trial-applied, all four tickets together)

Measured in a throwaway copy of base `41c301e` with the audit hunks for these four tickets applied (no E442 / E436 / E441 hunk), built, and measured with the exact computations of `test/context-budget.test.mjs` (chars/4). The cut-time additions (E437 site 11 inline definition ≈ +14 tok on `lean`; E438 sites 42–45 ≈ ±5 tok) were not in the trial; qa re-measures the final tree once at the end.

| test (cap / floor) | current value in test | base measured | combined post-change | headroom | action |
|---|---|---|---|---|---|
| AC2 lean always-on (cap) | ≤ 5731 | 5731 | 5745 | **−14 (over)** | re-baseline to the final measured value (~5759 with the site-11 definition), zero headroom — ruling 2 |
| skill-pm stripped (cap) | ≤ 4849 | 4847 | 4792 | 57 | tighten to measured, zero headroom (file's cap rule) |
| skill-sr-engineer stripped (cap) | ≤ 2852 | 2851 | 2816 | 36 | tighten to measured, zero headroom |
| stripped constitution, design arm (cap) | ≤ 9533 | 9533 | 9387 | 146 | tighten to measured, zero headroom |
| teamwork bundle (cap) | ≤ 19225 | 19225 | 19012 | 213 | tighten to measured, zero headroom |
| non-design constitution (cap) | ≤ 7533 | 7533 | 7484 | 49 | tighten to measured, zero headroom |
| design-only strip saving (floor) | ≥ 1999 | 2000 | 1903 | **−96 (under)** | re-baseline floor to measured (~1903) — **needs human ruling R2** (ruling 2 names caps only) |
| constitution rationale+origin saving (floor) | ≥ 240 | 406 | 545 | 305 | none |
| design − non-design sr bundle (floor) | ≥ 1830 | 2138 | 2066 | 236 | none |
| dual-injection saving (floor) | ≥ 1200 | 4176 | 4171 | 2971 | none |

Why `lean` rises while everything else shrinks: the lean test measures the lite constitution **raw** (`composeConstitution({ chain: false, design: true })`, no `stripOriginTags`), so the new origin-fence markers in universal / design fragments (const-15 `E25`, const-02 `v3.14.0`) count as bytes there, while they vanish from every real bundle. Why the design-only floor falls: E439 site 1 (const-11) and E438 sites 1–2 (const-02, const-13) shrink the design-only fragments, so the design arm's saving over the non-design arm shrinks by the same amount.

Tightening the five caps with headroom is the file's standing cap rule ("a qa-owned re-measure sets the cap to the exact measured size, zero headroom"); if the integrator prefers to leave them, they stay as is and pass.

## Red-test list (authoritative, trial copy, all four tickets applied, goldens NOT re-captured)

Run: `node scripts/test-lock.mjs -- npm test` (shared repo lock) in two throwaway copies of base `41c301e` (`git archive` extract, no git history, `node_modules` symlinked): one unmodified, one with the four tickets' audit hunks applied. Both: 4228 tests, 2 skipped. Base copy: 8 failed. Post copy: 46 failed = the same 8 + **38 new**. No test passed in base and failed for any other reason; no test owned by e436 went red.

**Environment-only (red in BOTH copies; not caused by this lane; unassigned per the fanout)** — 8:
`test/agc-adapters.test.mjs` (E104(ii) tracked binaries), `test/check-md-tables.test.mjs` (AC7 real corpus, CQ-9 real corpus), `test/e234-hygiene-scan.test.mjs` (AC16), `test/e258b-comment-scan.test.mjs` (AC14), `test/e295-hop-cap-and-sop-halves.test.mjs` (AC12), `test/e299-check-bookkeeping.test.mjs` (REAL-CORPUS), `test/release-staging.test.mjs` (Partition E66). All need git history / tracked files; the copy has none. If any of them is red in the real worktree after commit, the lane mails the integrator.

**New reds, owned (listed in the fanout e437 row)** — 27 tests in 16 files:

| test file | failing test(s) | caused by | fix |
|---|---|---|---|
| `test/context-budget.test.mjs` | AC2 lean (≤ 5731); AC8 non-design floor `design-only saving ≥ 1999`; AC7 exclusion zone byte-identical; AC7 exactly two fences; AC2/AC4 design-arm §3.2 span byte-equal; AC-P2-2 (pins `the v3.16.0\nself-arming signal`); AC-P2-3 (pins `**Visual Widgets exception (v3.14.0)**`) | E437 / E438 bytes (lean), E438 const-02 / const-13 + E439 const-11 (floor, AC7, AC2/AC4, AC-P2-2/3) | qa re-baselines per the Budget table and R2; re-pins AC7 + AC2/AC4 per R1; re-pins AC-P2-2 / AC-P2-3 to the stripped text |
| `test/render-structure.test.mjs` | structural sweep; render sweep (buildPromptForRole); render sweep (tw_switch_role) | E439 sites 3, 8 fence placement | **content fix by sr** (Fence placement constraint), no test edit |
| `test/subagent-templates.test.mjs` | AC4 (`no tw_* tool surface has changed`) | E440 site 2 | qa re-pins AC4 to the remaining Fallback paragraph (not `e9a AC2`) |
| `test/e130-lane-default.test.mjs` | AC7 (`pre-v3.20.0` sentence placement) | E440 site 2 | qa re-pins to the Fallback paragraph without the sentence |
| `test/e408-core-task-alias-tail.test.mjs` | AC5 (`line 9 still points at the lite SOP`) | E437 site 12 | qa re-pins to the `<agc install>/content/skill-coordinator-lite.md` form |
| `test/feature-lease.test.mjs` | S5 (`**Feature-Scope Gate** (E1)` regex) | E438 site 6 | qa re-pins S5 only; `S4 [E404 re-pin]`, `E9A-S4`, `E9A-S5`, `E17-S3`, `E17-S4` are e436's (integrator `to-lane#2`), untouched |
| `test/widget-shape-spec.test.mjs` | AC-1 (skill-pm), AC-2 (skill-design-auditor), R5 (Constitution §1) — all pin `(v3.14.0)` | E438 sites 1, 13, 33 | qa re-pins to the fenced form / stripped heading |
| `test/phase-0-5-sop.test.mjs` | AC-4 (`Constitution §1 … exception` name) | E438 site 40 | qa re-pins to `Constitution §1 Visual Widgets exception` |
| `test/qa-visual-skill-split.test.mjs` | AC-2 (Step A.0 heading / method line), AC-3 (`v3.14.0 PASS-gated`) | E437 site 7, E438 sites 35, 37 | qa re-pins |
| `test/design-auditor-volume-guard.test.mjs` | AC-1 (`step 2c must be present` — heading pinned with `(v3.39.0)`) | E438 site 16 | qa re-pins |
| `test/e178a-integrator-role.test.mjs` | AC9 (`(the E222 precedent)`) | E438 site 29 | qa re-pins |
| `test/e226-integrator-sop-portable.test.mjs` | AC-E226-2 (`Governance state heading directly after`, pins `(D11)`) | E438 site 18 | qa re-pins |
| `test/e288-integrator-stage0.test.mjs` | AC-E288-1 (`Governance state (D11)` anchor) | E438 site 18 | qa re-pins |
| `test/e355-integrator-generic-wording.test.mjs` | AC-E355-2 (W3 phrase carries a now-fenced label) | E438 sites 18–32 | qa re-pins |
| `test/e407-restatement-citations.test.mjs` | AC4 (coord-05 `(R10)` paragraph form) | E438 site 10 | qa re-pins |

Listed in the fanout row but NOT red in the trial (no edit expected): `test/e409-lite-write-tool-facts.test.mjs`, `test/teamwork-lite.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`. If the final text (with the cut-time additions) turns one red, qa re-pins it under the owning ticket.

**New reds, owned-new (red only because of `content/**` wording, not in e436's set; integrator to confirm at pre-review)** — 12 tests in 2 files, all golden byte-identity checks; they go green when qa re-captures the goldens, and the test files themselves are NOT edited:

| test file | failing test(s) |
|---|---|
| `test/compose-equivalence.test.mjs` | the 10 `buildPromptForRole(…)` / SessionStart-hook golden byte-identity tests (`build-{lite,full}-{nondesign,design}[-fd].txt`, `hook-full.txt`, `hook-lite.txt`) + `cat(15 manifest fragments) === constitution-monolith` (11 tests) |
| `test/skill-manifest.test.mjs` | `t-golden-byte-identity (AC1/AC5): composeSkill("skill-coordinator.md", …) === frozen golden monolith` (1 test) |

**e436-owned reds** — none (including the five release-engineer-template tests in `test/feature-lease.test.mjs` that the integrator assigned to e436 in `to-lane#2`: `S4 [E404 re-pin]`, `E9A-S4`, `E9A-S5`, `E17-S3`, `E17-S4` — all green in the trial). **Unclassified** — none.

## Golden re-capture (qa, once, at the end)

After every sr-engineer task (T-E437-01 … T-E440-01) is code-review APPROVED, as qa's last task (T-E440-03) before the final PASS, qa runs `npm run build && node scripts/capture-constitution-golden.mjs` exactly once and commits all 12 `test/fixtures/compose-golden/*.txt` together. The QA report carries a hunk-by-hunk note: each golden hunk is attributed to a ticket and a site number from the tables above (E437 path deletions/prefixes, E438 label removals, E439 story removals in dispatch goldens and marker-only additions in full-detail goldens, E440 rewrites). Any hunk that maps to no site is a defect, sent back to sr-engineer. No earlier task re-captures goldens; intermediate golden reds are expected and are not FAIL causes for T-E437..T-E440 reviews.

## Out of Scope

- Every E442 site: `content/const-01-core-head.md` lines 20–32, line 7 `CRITICAL:` of all 12 templates (including `lite.md`).
- `tools/registry.ts` (E441), `CLAUDE.md` and `templates/claude-code-agents/release-engineer.md` (E436), all in lane e436.
- `content/skill-release-engineer.md` (forbidden; the audit's F3 note).
- Adopter-workspace paths (`specs/<feature>.md`, `design/<feature>.md`, `qa_reports/…`), which are correct.
- `content/constitution-rationale.md` (non-normative, composed into no bundle).
- The audit's flag-only items F1–F5.
- Other "Reason:" prose not listed by the audit (e.g. `content/skill-architect.md:75` `Reason: without an owned harness …`) — E439 is the 11 listed sites.
- Version bump, CHANGELOG, `docs/backlog.md` done-marks (release-engineer / integrator 5c; this wave has no release).

## Dependencies / Prerequisites

- Human rulings (Stage 2, 2026-11-18, binding, not re-asked): 1 = a (this lane: E437→E438→E439→E440 in one cut, golden re-captured once by qa at the end), 2 = a (budget: measured together, caps still over re-baselined to the measured value with zero headroom per E336/E365), 3 = a (e436's business).
- **Needs human ruling R1 — const-11 §3.2 preamble vs the §3.x rationale-free zone.** `test/context-budget.test.mjs` pins §3.1–§3.2 as a zone no rationale fence may touch (`AC7: §3.1–§3.2 exclusion zone is byte-identical after stripRationale`, `AC7: exactly two balanced rationale fences, both outside §3.x`; origin: `specs/governance-text-load-architecture.md`), and `AC2/AC4: the gated spans on the DESIGN arm are byte-equal to the constitution source` compares the §3.2 span without a rationale strip. E439 site 1 puts a fence inside that zone. Options: **(a, recommended)** fence the preamble as E439 says; qa re-pins the two AC7 tests to "the only rationale fence inside §3.x is the §3.2 preamble story, which contains no rule" (fence count 2 → 3) and routes AC2/AC4's source span through `stripRationale`; the zone's purpose — no normative byte fenced — holds because the paragraph is history and the bullets below it are untouched. (b) keep §3.x fence-free: delete the preamble from `const-11` (the same story is already in `content/constitution-rationale.md` § "§3.2 — Visual-verdict authority …: the false-PASS war-story"), which keeps the AC7 tests as they are but makes the full-detail bundle lose the paragraph, contrary to E439's full-detail AC.
- **Needs human ruling R2 — design-only saving floor.** Ruling 2 covers caps that end over; the `≥ 1999` design-only saving floor ends under (1903) because the design-only fragments shrink. Options: **(a, recommended)** treat it as ruling 2's mirror: re-baseline the floor to the final measured value with a re-baseline comment; (b) keep `≥ 1999` and compensate by not fencing const-02 / const-13 / const-11 labels and story (contradicts E438 / E439 scope).
- Integrator pre-review items (not human rulings): the 4 cut-time additions to E438 (sites 42–45) and the inline `<agc install>` definition at E437 site 11; the tightening of the five caps with headroom; the owned-new test list below.
- e436 coordination: see the section below.
- `cutApprovalAutoTier` is `{}`, so the cut is presented to the human in the coordinator's session after the integrator's pre-review; manifest tier does not apply.

## e436 coordination

1. **No e436-owned test went red** in the trial (`test/e404-release-engineer-template.test.mjs`, `test/release-staging.test.mjs` apart from its env-only Partition test, `test/e392-subagent-templates.test.mjs`, `test/subagent-templates.test.mjs` `e9a AC2`, `test/feature-lease.test.mjs` `S4 [E404 re-pin]` / `E9A-S4` / `E9A-S5` / `E17-S3` / `E17-S4`, `test/agc-adapters.test.mjs` apart from its env-only E104(ii), `test/agc-feature-lifecycle.test.mjs`, `test/e132-lane-registry.test.mjs`, `test/e395-claude-md-tail.test.mjs`). Nothing to mail e436 about from the content side.
2. **Shared test files, split by test** (fanout 所有權重劃): `test/subagent-templates.test.mjs` — e437 edits AC4 (line 206, body to ~line 218); e436 owns `e9a AC2` (line 472). Far apart, git should auto-merge. `test/feature-lease.test.mjs` — e437 edits S5 (lines 456–465, the regex at line 458); e436 owns S4 (lines 439–454) plus `E9A-S4`, `E9A-S5`, `E17-S3`, `E17-S4` (all near line 1548 and after). Only lines 455–457 separate the two bodies: if e436 changes S4's last lines and e437 changes line 458, the merge still has unchanged lines between them, but the integrator should look at this file first if `--no-ff` reports a conflict.
3. **Ownership change (integrator, mailbox `to-lane#2`, binding)**: in `test/feature-lease.test.mjs` the five tests that read `templates/claude-code-agents/release-engineer.md` — `S4 [E404 re-pin]`, `E9A-S4`, `E9A-S5`, `E17-S3`, `E17-S4` — belong to e436; e437 owns the rest of the file, including coord-03's S5. None of the five is red in the trial and e437 does not touch that template; if any of them goes red in this lane, it is classified e436-owned and mailed to the integrator, never edited here.
4. **`dist/`**: e437 changes no TypeScript; `npm run build` must leave `dist/` byte-identical (AC-ALL-1). Only e436's `dist/tools/registry.*` changes in this wave.
5. **Goldens / budget**: only e437 writes `test/fixtures/compose-golden/**` and `test/context-budget.test.mjs`. e436's files are in no compose bundle, so merging e436 after e437 must leave the goldens byte-identical (fanout merge step 4).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E437 | Drop or `<agc install>/`-prefix the 13 repo-only path citations; lite template SOP path resolves from an adopter workspace; qa-visual FAIL note carries no path | none | 9 + tests | `content/const-10-chain-31-tail.md`、`content/const-08-chain-31-mid.md`、`content/coord-02-host-dispatch.md`、`content/skill-pm.md`、`content/skill-design-auditor.md`、`content/skill-qa-visual.md`、`content/skill-doc-writer.md`、`content/skill-coordinator-lite.md`、`templates/claude-code-agents/lite.md`、`test/e408-core-task-alias-tail.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/e437-*.test.mjs` | — |
| E438 | Wrap 45 bare ticket/version labels in the origin fence (41 from the audit + 4 found at cut), four id-as-name renames with references synced | E437 | 14 + tests | `content/const-02-design-mvp.md`、`content/const-13-design-chain-s4.md`、`content/const-15-core-tail.md`、`content/coord-02-host-dispatch.md`、`content/coord-03-core-fallback.md`、`content/coord-05-core-visual-drift.md`、`content/skill-design-auditor.md`、`content/skill-integrator.md`、`content/skill-pm.md`、`content/skill-qa-engineer.md`、`content/skill-qa-visual.md`、`content/skill-sr-engineer.md`、`content/skill-architect.md`、`test/widget-shape-spec.test.mjs`、`test/phase-0-5-sop.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/feature-lease.test.mjs`、`test/e226-integrator-sop-portable.test.mjs`、`test/e288-integrator-stage0.test.mjs`、`test/e355-integrator-generic-wording.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e407-restatement-citations.test.mjs`、`test/design-auditor-volume-guard.test.mjs`、`test/e438-*.test.mjs` | — |
| E439 | Move the 11 incident stories into rationale fences; each rule outside still complete; full-detail gains markers only | E438 | 6 + tests | `content/const-11-design-chain-32.md`、`content/skill-pm.md`、`content/skill-architect.md`、`content/skill-design-auditor.md`、`content/skill-sr-engineer.md`、`content/skill-qa-visual.md`、`test/context-budget.test.mjs`、`test/e439-*.test.mjs` | — |
| E440 | Rewrite six version-relative sentences as the current rule (or delete); keep legacy-inert sentences; then qa re-captures all goldens once and re-measures the budget | E439 | 4 + goldens + budget + tests | `content/skill-qa-engineer.md`、`content/coord-03-core-fallback.md`、`content/coord-02-host-dispatch.md`、`content/const-05-core-standards.md`、`test/e130-lane-default.test.mjs`、`test/subagent-templates.test.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e440-*.test.mjs` | — |

## Tasks

Ledger: `.current/e437/tasks.md` (written with `tw_add_task`). One chain: sr-engineer runs the eight build tasks in order, code-reviewer reviews them, qa-engineer runs the five qa tasks in order (tests per ticket, then the one golden re-capture and budget close).

| id | role | P | summary | depends_on |
|---|---|---|---|---|
| T-E437-01 | sr-engineer | P1 | E437 sites 1–11 (content path drops / prefixes) | none |
| T-E437-02 | sr-engineer | P1 | E437 sites 12–13 (`lite.md` line 9 only) | T-E437-01 |
| T-E438-01 | sr-engineer | P2 | E438 sites 1–17 (const-02/13/15, coord-02/03/05, skill-design-auditor incl. rename 17) | T-E437-02 |
| T-E438-02 | sr-engineer | P2 | E438 sites 18–32 (skill-integrator, 15) | T-E438-01 |
| T-E438-03 | sr-engineer | P2 | E438 sites 33–45 (skill-pm, qa-engineer, qa-visual, sr-engineer, architect; renames 39, 40, 42) | T-E438-02 |
| T-E439-01 | sr-engineer | P2 | E439 site 1 (const-11 §3.2 preamble) per ruling R1 | T-E438-03 |
| T-E439-02 | sr-engineer | P2 | E439 sites 2–11, honouring the fence placement constraint | T-E439-01 |
| T-E440-01 | sr-engineer | P2 | E440 sites 1–6; `npm run build` (dist zero diff) + `npm audit` | T-E439-02 |
| T-E437-03 | qa-engineer | P1 | E437 tests + re-pins (e408 AC5, qa-visual-skill-split AC-2) | T-E440-01 |
| T-E438-04 | qa-engineer | P2 | E438 tests + re-pins (widget-shape-spec ×3, phase-0-5-sop, qa-visual-skill-split AC-3, design-auditor-volume-guard, feature-lease S5 only, e226, e288, e355, e178a, e407) | T-E437-03 |
| T-E439-03 | qa-engineer | P2 | E439 tests; context-budget AC7 ×2 + AC2/AC4 per R1; render-structure green without re-pin | T-E438-04 |
| T-E440-02 | qa-engineer | P2 | E440 tests; re-pin e130 AC7, subagent-templates AC4 | T-E439-03 |
| T-E440-03 | qa-engineer | P1 | golden re-capture once (hunk-by-hunk note); budget re-measure / re-baseline (ruling 2, R2); AC-ALL-1..5 | T-E440-02 |
