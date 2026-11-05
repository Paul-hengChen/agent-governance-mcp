# Review — T-E412-01

covers: T-E412-01, T-E412-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Range `6e1a9d4..9e9e173`. Two product files change: `templates/claude-code-agents/qa-visual.md` (frontmatter line 4 `description:` and body line 9) and `content/coord-05-core-visual-drift.md` (line 5 only). The other files in the range are the spec and `.current/e412/**`, all inside the e412 Lanes row's owned set in `specs/fanout-prompt-audit-w7.md` line 50.
- All three Copy/Strings entries (`tpl.desc`, `tpl.body`, `coord05.5`) match the spec byte for byte. I checked this by script, comparing the extracted spec table cells with file lines 4/9 and coord-05 line 5.
- Nothing was changed outside scope: no edits to `skill-qa-visual.md`, `skill-qa-engineer.md`, `const-11`, README, other templates, other coord-05 lines, or `dist/`.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `templates/claude-code-agents/qa-visual.md:4` = `tpl.desc`; lines 1–3 and 5 (`---`, `name: qa-visual`, `model: sonnet`, `---`) are unchanged. The template has two diff hunks, at line 4 and line 9 only.
AC2 — implemented — `templates/claude-code-agents/qa-visual.md:9` = `tpl.body`; the `CRITICAL:` watermark line (line 7) is unchanged; `tw_get_state` then `tw_switch_role("qa-engineer")` is still present and the `On invocation, …` clause is byte-unchanged. `test/subagent-templates.test.mjs` passes.
AC3 — implemented — `content/coord-05-core-visual-drift.md:5` = `coord05.5`; the `` (subagent-dispatch tool or `tw_switch_role`) `` parenthetical is kept; the file has one hunk, at line 5. `test/e408-core-task-alias-tail.test.mjs` passes.
AC4 — out of scope for this round. It belongs to T-E412-03 (qa re-captures `skill-coordinator-monolith.txt`). The golden is red until then, which is planned and is not a finding.
AC5 — out of scope for this round (T-E412-03). As an extra check, `test/context-budget.test.mjs` already passes on 9e9e173 and is not modified.
AC6 — out of scope for this round (T-E412-03). As an extra check, `subagent-templates`, `e403-lean-dispatch-alias` and `e408-core-task-alias-tail` all pass with no edits: 83/83 together with context-budget.
AC7 — out of scope for this round (T-E412-03). Partial check: `git diff --name-only 6e1a9d4 9e9e173` lists only owned paths (`.current/e412/**`, `specs/e412-*.md`, the template, coord-05).

## Correctness
No findings.
- YAML: the frontmatter parses with js-yaml (FAILSAFE schema) to exactly three keys, `name`, `model` and `description`. `description` is a plain scalar. It starts with `q`, so the apostrophe in `qa-engineer's` is not a quote indicator. It has no `: ` and no ` #`, and the em dash and parentheses are safe in plain style. Claude Code subagent frontmatter will read the full string.
- Fact check, "Constitution §3.2": `content/const-11-design-chain-32.md` §3.2 "Visual Verdict Authority & Separation of Duties" opens with "**Visual verdict is qa-visual-owned.**", so the claim that the subagent "owns the visual verdict" is accurate.
- Fact check, "Phase 1.5" and "`## Visual Baselines` in `design/<feature>.md`": `content/skill-qa-engineer.md:58` says "Phase 1.5 — Visual Compare … Check `design/<feature>.md` for a `## Visual Baselines` H2". Both the trigger and the phase name are accurate.
- Fact check, "design-armed": §3.2 is inside a `design-only` fragment, so it only applies to design-armed features. Adding "design-armed" to the when-to-pick condition matches that and does not contradict the Phase 1.5 trigger. A Visual Baselines section lives in the design file, which only exists on the design chain.
- The template body still delegates to `tw_switch_role("qa-engineer")`. That SOP lazy-loads the qa-visual sub-skill at Phase 1.5, so "use it in place of `qa-engineer`" runs the same SOP in a separately named judge context. The two files agree and nothing contradicts the coord-05 line 12+ "Unavailable judge → Blocked" row.

## Quality
- `optional`: `templates/claude-code-agents/qa-visual.md:9` now states the Visual Baselines condition twice: once in the new when-to-use sentence and again in the unchanged `…lazy-loading qa-visual when Visual Baselines are present.` clause. The spec deliberately keeps that tail unchanged (Site map row 2), so the overlap is intended. Not actionable this round.
- I found no stale copies of the old wording ("lazy-loaded sub-skill", "Visual-baseline comparator", "runs the agc qa-visual SOP") in README, docs, content, templates, tests, tools, prompts or bin.

## Architecture
There is no `specs/e412-qa-visual-template-architecture.md` (this is a mini-chain with no architect). Layering is unchanged: template frontmatter keys, the `model: sonnet` tier mirror, the `CRITICAL:` first body line and the delegation target are all preserved. The coord-05 change is an inline clause and does not move the Visual Verdict Boundary structure.

## Security
No findings. The change is prose only, with no code paths, inputs or secrets. Constitution §6 information hygiene: the added text names only public repo concepts (roles, file paths, section headings, a constitution section). It contains no personal, account, host or internal-ticket detail, and a non-agc reader can follow it.

## Performance
No findings in code. Prompt-size effect: the teamwork bundle grows by a few dozen tokens (spec trial measurement 21398 → 21430, cap 21715), and `test/context-budget.test.mjs` passes unmodified on 9e9e173. qa re-measures this in T-E412-03 (AC5).

## Verdict
APPROVED — all three strings are byte-exact, the edits stay within the e412 owned lines, the frontmatter is valid YAML with unchanged keys and tier, and every factual claim checks out against const-11 §3.2 and skill-qa-engineer Phase 1.5.

Same-model note: sr-engineer and code-reviewer are both pinned to opus for this lane (human ruling in the fan-out Decisions table). I mitigated this by checking strings mechanically and verifying the claims against source files rather than relying on reading alone.
