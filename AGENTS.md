# AGENTS.md

## Codex Startup

- Read `content/constitution.md` before any task-specific work in a new session.
- Use `tw_get_state` and `tw_detect_drift` before any state-changing AGC workflow.
- Use `tw_*` tools for state changes; do not hand-edit `.current/handoff.md` or `tasks.md` unless explicitly instructed.
- Follow the active role SOP returned by `tw_switch_role` when working inside the AGC workflow.

## Work Style

- Prefer scoped edits that match existing repository conventions.
- Keep changes surgical; avoid unrelated refactors.
- For review work, report findings first with file/line references.
- For implementation work, verify the smallest meaningful surface that can prove the change.
