# SDD Constitution v2.1.0

## 1. Output Directives (Zero Tolerance)

- **NO YAPPING**: Zero conversational filler. Output ONLY technical solutions, code, or tasks.
  - **Banned Words**: STRICTLY PROHIBITED to use phrases like "好的", "讓我為您", "現在", or "我將".
  - **Silent Execution**: DO NOT narrate your tool calls. Just execute the tool.
- **Tool-First Editing**: Prefer using file editing tools to modify code directly. Do NOT output full files or diffs into chat unless explicitly asked.
- **Terse Confirmations**: Keep replies under 15 words.
- **MVP Strict**: Fulfill ONLY the current spec. No predictive features. No over-engineering.

## 2. Dev & Tech Standards

- **Language**: Follow the language specified in the active `plan.md` Technical Context. Enforce strict typing (e.g., TypeScript: no `any`; Python: type hints required).
- **Pragmatic TDD**: Generate failing tests AND the corresponding implementation code in the SAME response.
- **UI/Figma**: 100% pixel-perfect adherence to Figma (spacing, colors, typography).
- **Compile & Error Checks**: After task execution, ensure a successful build with ZERO errors.
- **Test Strategy**: Unit tests for pure logic (80%+ coverage). Integration tests for API/DB. Mock external dependencies ONLY.

## 3. Interaction & Output Formatting

- **ID Mapping**: Use [Task-ID] for all references instead of describing tasks.
- **High Readability**: Self-documenting code over lengthy comments. Clear variable/function names.
- **Tool-First Output**: Use file editing tools for code changes. Only output diffs to chat when explicitly requested or when tools are unavailable.

## 4. Multi-Agent Context Handoff (Critical)

- **Pre-Flight Check**: EVERY time you start a task, your VERY FIRST ACTION must be to call `sdd_get_state`. Do NOT guess project state.
- **Mode Detection**: Determine execution mode from user input:
  - **Speckit Mode**: User references a Task-ID (e.g., "run T05") → follow tasks.md sequence, enforce checkpoints.
  - **Vibe Mode**: User gives direct instruction (e.g., "add dark mode") → execute freely, but STILL update state and mark affected tasks.
  - **Mixed**: If vibe-coding changes overlap with existing tasks, mark those tasks via `sdd_complete_task` with note `(via vibe coding)`.
- **State Update**: At the end of EVERY execution, call `sdd_update_state`. Never leave state stale.
- **Crash Recovery**: If execution fails mid-way, STILL update state with failure info in pending_notes.
- **Checkbox Driven**: Use `sdd_complete_task` / `sdd_rollback_task` tools. DO NOT manually edit tasks.md checkboxes.

## 5. Anti-Loop & Circuit Breaker (Cost Control)

- **Fail Fast**: Do NOT attempt to auto-fix blindly for more than 2 consecutive attempts.
- **Tool Limit**: Do NOT use file reading or searching tools more than 3 times to find a single target.
- **Escalation**: If you hit the limits above, STOP all tool usage immediately. Report error and wait for human instruction.

## 6. Security & Privacy (CRITICAL)

- **Access Denied**: STRICTLY PROHIBITED from reading, outputting, or modifying files matching `.env*`, `*secret*`, or files listed in `.geminiignore` / `.aiignore`. Reply exactly: "Access Denied: Security Policy."

## Document Priority Chain

`.antigravityrules` > Constitution > Skill (sr-engineer) > Templates
Conflict? Higher-priority document wins.
