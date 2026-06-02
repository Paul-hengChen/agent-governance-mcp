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
