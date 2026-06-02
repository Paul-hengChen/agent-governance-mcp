# Review: T463–T468 — watermark-hide-model-tier (v3.23.0)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Two-format watermark regime: subagent context → `— @<role> (<tier>)`; non-subagent context (coordinator main loop / coordinator-lite / same-context `tw_switch_role`) → `— @<role>` (no tier). Source-of-truth rule in `content/constitution.md` §1 (lines 14–18).
- Scope is content/SOP-only: 3 markdown SOP files + `package.json` + `index.ts` + `dist/index.js` + `CHANGELOG.md`. No TypeScript logic, no schema, no transitions, no templates, no tests touched.
- Zero-change manifest verified empty via `git diff --name-only` (see Architecture).
- `check-version` OK at 3.23.0; `tsc` build clean and reproducible (no dist drift on rebuild).
- Headline verdict: APPROVED. One non-blocking wording observation noted under Quality; it does not produce an executable contradiction because the load-bearing self-detection rule resolves it.

## Correctness

- `content/constitution.md:14–18` — Two-format rule is internally consistent. Subagent vs non-subagent branches are mutually exclusive and jointly exhaustive given the self-detection predicate. The self-detection rule is stated as an iff on `model:` frontmatter being set by the dispatching parent at Task creation, with a practical heuristic. This is executable: an agent can determine whether it was spawned via `Task(subagent_type=…)` (system prompt built from `~/.claude/agents/<role>.md`) vs running as the initial session agent or an in-context `tw_switch_role` swap. Matches spec AC1 verbatim including the load-bearing self-detection string.
- `content/skill-coordinator.md:98` — new lead correctly scopes `validateWatermark` to Task-dispatched subagent relays only; states coordinator's own main-loop replies are `— @coordinator` (no tier) and excluded. Satisfies AC2 + AC7.
- `content/skill-coordinator.md:120` — out-of-scope guard reinforced with the no-tier statement. Detection regex `/^—\s@[\w-]+\s\([\w-]+\)$/i` (line referenced in §Detection regex) is unchanged — correct, since dispatched subagents still emit tier. Satisfies AC2.
- `content/skill-coordinator-lite.md:48` — note added that lite's own replies end `— @lite` (no tier); subagent-relay cross-ref unchanged. Satisfies AC3.
- Edge-case audit — `@teamwork`/`@lite` dispatched *as Task subagents* (their templates carry pinned `model:` frontmatter) correctly fall under subagent context per the self-detection iff, so the unchanged `— @teamwork (sonnet)` / `— @lite (haiku)` template reminders remain consistent. No regression in the dispatched path.

## Quality

- Naming/format consistent with surrounding SOP prose; em-dash (U+2014) used correctly throughout the new lines; no convention drift.
- CHANGELOG `[3.23.0]` entry (`CHANGELOG.md:19`) is well-structured with Changed + "Unchanged (intentional)" sections matching the zero-change manifest. Dated 2026-06-02, consistent with current date. Satisfies AC10.
- Non-blocking observation (no change required): `content/constitution.md:16` and `content/skill-coordinator-lite.md:48` phrase coordinator-lite as running in non-subagent context without the "main loop" qualifier that the coordinator bullet carries. Since `lite.md`/`teamwork.md` are themselves pinned-model Task-dispatch templates, a reader could perceive tension with the still-mandated `— @lite (haiku)` template reminder. The load-bearing self-detection iff (`model:` frontmatter pinned by dispatcher) authoritatively resolves this: dispatched `@lite` is subagent context (keeps tier); `/lite` as the session loop is non-subagent (drops tier). AC5 mandates templates stay verbatim, so this is correctly left as-is. Flagging for documentation awareness only — not a defect.

## Architecture

- Layering respected: change lives entirely in the content/SOP layer (the constitution as source of truth, skill files referencing it). No leakage into tools/, guards/, schema/, or lib/.
- Zero-change list verified against the spec's Out-of-Scope + Decision 4: `git diff --name-only HEAD --` for `lib/watermark-check.ts`, `test/watermark-check.test.mjs`, `templates/claude-code-agents/*.md`, `test/subagent-templates.test.mjs`, `tools/transitions.ts`, `schema/versions.ts` returned EMPTY — all untouched. Satisfies AC5, AC6, AC9 and Decision 4 backward-compat clauses.
- AC4 confirmed: `grep -rln "— @" content/skill-*.md` matches only the two coordinator files; no other role skill file contains a watermark example, so the "skip if none" branch correctly yields zero edits.
- Backward compatibility intact: all 12 `templates/claude-code-agents/*.md` retain `CRITICAL: End every reply with — @<name> (<tier>)` with literal tier tokens (haiku/sonnet/opus); the subagent tier-display capability is fully preserved.

## Security

- No injection vectors, secrets, or boundary changes. Documentation/prose-only diff. No code paths altered. N/A beyond confirming no `lib/` logic was touched (verified empty diff).

## Performance

- No code execution paths changed. `validateWatermark` logic and regex unchanged, so no algorithmic regression. The correction strategy remains a single string concatenation per miss (unchanged). No hot-path, I/O, or memory concerns introduced.

## Verdict

APPROVED — two-format rule is logically self-consistent and executable via the load-bearing self-detection iff; zero-change manifest verified empty, version/CHANGELOG consistent, build reproducible, and subagent tier-display backward compatibility is preserved.

## Round 2 — APPROVED — by code-reviewer

## Summary

- Scope of this round: sr-engineer's QA-Round-1 Failure-1 fix. To bring the lean always-on bundle under the 2100-token cap, sr-engineer compressed `content/constitution.md` §1 (Watermark) AND ran "terse passes" on §2 (Conditional test writing), §3 (Pre-flight / State update), §6 (Dependency audit), §7 (External-reference policy), plus `content/skill-coordinator-lite.md`. Claim: "rule meaning unchanged in every case."
- Primary review object this round (per coordinator mandate): whether the §2/§3/§6/§7 compressions — governance source-of-truth edits beyond the original spec scope — introduce ANY semantic drift in meaning, constraint strength, or boundary conditions.
- Independently re-measured budget: lean = 2098 ~tok, raw = 2974, cap = 2100, **margin = 2 tokens**. `node --test test/context-budget.test.mjs` → 11/11 pass.
- Headline verdict: **APPROVED.** All four extra-scope sections preserve their load-bearing clauses verbatim or as exact-meaning paraphrases. Two non-blocking modal-softening observations and one verbatim-string observation noted below; none changes an executable obligation.

## Correctness

Section-by-section old→new semantic diff (binding clauses in **bold**):

- **§2 Conditional test writing** (`constitution.md:25`) — OLD "If existing test files already cover the task's scope, write or modify tests accordingly" → NEW "If existing test files cover the scope, modify them." The OLD "write or modify" collapses to "modify" in the existing-files-cover-scope branch; this is semantically harmless because that branch is by definition modification of existing files. The load-bearing constraint — **"If NO relevant test file exists, qa-engineer MUST ask the user before creating any — do not assume"** — is preserved with MUST intact and "do not assume" intact. NO drift in the binding rule.
- **§3 Pre-flight read** (`constitution.md:30`) — OLD "The server enforces this; skipping it returns a `⛔ BLOCKED` error" → NEW "Server-enforced; skipping returns `⛔ BLOCKED`." Identical meaning. **"you MUST first call `tw_get_state`"** preserved. The exemption **"Q&A / doc edits that don't touch state may skip both"** preserved verbatim. NO drift.
- **§3 State update** (`constitution.md:32`) — OLD "At the end of any execution that modified state" → NEW "At the end of any state-modifying execution." Identical. The load-bearing failure clause **"On crash/failure, still call it with the failure summary in `pending_notes`"** preserved verbatim. NO drift.
- **§6 Dependency audit** (`constitution.md:88`) — OLD "treat any HIGH or CRITICAL finding as a build failure unless explicitly waived in the PR description with rationale. The audit runs after build, before `tw_update_state`" → NEW "after build, before `tw_update_state`, and treat any HIGH/CRITICAL finding as a build failure unless waived in the PR description with rationale." "HIGH or CRITICAL"="HIGH/CRITICAL"; **"build failure"** retained; waiver still requires **"in the PR description with rationale"**; timing "after build, before `tw_update_state`" retained (reordered, not changed); **MUST** retained; toolchain-waiver clause retained. The only deletion is the adverb "explicitly" before "waived" — a waiver still demands an in-PR rationale, so the gate strength is unchanged. NO drift in the binding rule.
- **§7 External-reference policy** (`constitution.md:97`) — All three escape options preserved: **(a) fetched**, **(b) indexed via `tw_index_prd` / equivalent**, **(c) user-confirmed ignorable**. The core constraint **"No role may unilaterally treat them as out-of-scope"** preserved verbatim. "presumed **incomplete**" preserved (bold intact). PM-owns-audit + architect-Deferred-Resources ownership preserved. Example trims ("design files like Figma/Sketch"→"design files"; "see XYZ for details"→"see XYZ"; "fetched into the workspace"→"fetched") drop illustrative examples only — the semantic categories are unchanged. NO drift in the binding rule.

- **§1 two-format watermark self-consistency** (`constitution.md:14`) — The compressed rule defines: subagent → `— @<role> (<tier>)`; coordinator / coordinator-lite / same-context `tw_switch_role` → `— @<role>` (no tier). Self-detection predicate: "you are a subagent iff a `Task(subagent_type=…)` spawned you with `model:` pinned by the parent; the initial session agent and in-context `tw_switch_role` are not." The two branches are mutually exclusive and jointly exhaustive over the iff predicate, and "Show tier only where pinned" restates the invariant. The rule remains self-consistent and the criterion remains agent-executable (an agent can determine whether its turn was constructed from a dispatched `~/.claude/agents/<role>.md` template vs the session loop / `tw_switch_role`). SELF-CONSISTENT and EXECUTABLE.
- `content/skill-coordinator-lite.md` terse pass (`:18-19`) — OLD "the reviewer gate is a multi-context separation tool; lite is solo-dev same-context work where it is structurally meaningless" → NEW "solo-dev same-context work; the reviewer gate is a multi-context tool." Same meaning (reviewer gate excluded because lite is solo-dev same-context). OLD "No auto-routing. Auto-routing is NOT applied in lite mode. Lite is single-shot; the auto-hop loop lives in `/teamwork` only" → NEW "Lite is single-shot; the auto-hop loop lives in `/teamwork` only." Redundant first sentence removed; the operative constraint (single-shot, no auto-hop, loop is teamwork-only) preserved. NO drift.

## Quality

- Em-dash (U+2014) and bold markers (`**incomplete**`) preserved correctly through the terse passes; no convention drift.
- **Non-blocking observation A — §1 self-detection is a paraphrase, not the AC1 "verbatim" string.** Spec AC1 / `wm.selfdetect.rule` quotes a specific load-bearing sentence ("An agent is in subagent context if and only if its `model:` frontmatter was set by the dispatching parent at Task creation time — i.e., the agent file `~/.claude/agents/<role>.md` ..."). The shipped §1 conveys the identical predicate (iff on parent-pinned `model:` via Task dispatch; session-agent and `tw_switch_role` excluded) in compressed wording. Executable semantics are equivalent; the literal-string match the spec labels "verbatim" is not met. Because the budget cap (a test-enforced guardrail) made the full verbatim string infeasible and the *meaning* is fully preserved, this is recorded as an observation, not a CHANGES_REQUESTED — but flagging it so qa-engineer can decide whether spec AC1's "verbatim" wording should be relaxed to "load-bearing semantics preserved." Not a defect in the rule's executability.
- **Non-blocking observation B — mild modal softening in §6 and §7.** §6 dropped the adverb "explicitly" (before "waived"); §7 changed "architect must surface" → "architect surfaces". Both remain in the binding/declarative register of their surrounding rules ("No role may unilaterally..."), so the obligations are not weakened in effect, but the explicit MUST-tone in §7's architect clause is now implicit. No change required; flagged for governance-prose awareness.

## Architecture

- Change stays entirely in the content/SOP layer. Zero-change manifest re-verified this round: `git diff --name-only HEAD --` for `lib/`, `test/`, `templates/`, `tools/transitions.ts`, `schema/versions.ts` returned EMPTY. AC5/AC6/AC9 and Decision-4 backward-compat clauses still hold. `lib/watermark-check.ts`, `test/*`, and `templates/claude-code-agents/*.md` are untouched as required.
- The extra-scope edits (§2/§3/§6/§7 + lite skill) are governance source-of-truth changes beyond the original spec, justified solely as the mechanism to satisfy the §1-driven budget cap. They are content-only and semantics-preserving, so they do not contradict the architecture or the spec's intent.

## Security

- Prose/SOP-only diff. No code paths, no boundaries, no secrets touched. N/A.

## Performance

- **Budget margin = 2 tokens (lean 2098 / cap 2100).** Independently reproduced via `approxTokens(stripChainOnly(CONSTITUTION) + SEP + liteSkill)`. This is extremely tight: any future ~8-character addition to the always-on bundle (constitution or skill-coordinator-lite.md) will breach the cap and fail `test/context-budget.test.mjs`. Per coordinator mandate this is a **non-blocking observation, not a gate** — the cap is currently satisfied with passing tests. Recommend a future ticket to either (i) raise the cap with rationale (qa-scope, as it lives in a test file) or (ii) reclaim headroom, so the next routine edit to these two files does not unexpectedly break the build. No algorithmic/runtime regression (no executable code changed).

## Verdict

APPROVED — every §1-external compression (§2/§3/§6/§7 and skill-coordinator-lite.md) preserves its load-bearing clause, MUST-strength, and boundary conditions with zero semantic drift; §1's two-format rule is self-consistent and executable; zero-change manifest re-verified empty; budget cap met (2098/2100) with passing tests. Two non-blocking observations (AC1 "verbatim" string is now a semantics-equivalent paraphrase; 2-token margin is fragile) are flagged for qa awareness, not as blockers.
