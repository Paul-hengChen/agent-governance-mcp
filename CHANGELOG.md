# Changelog

All notable changes to `teamwork-mcp-server` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

- **Install via tagged ref**: `npx -y github:Paul-hengChen/teamwork-mcp-server#v<version>`.
- `main` is the development branch; pinning to a tag is the supported way to use this server.
- **MAJOR** bumps signal breaking changes to the MCP tool surface, prompt schema, or
  handoff/state file format. Re-read this changelog before upgrading across a MAJOR.
- **MINOR** bumps add backwards-compatible tools, role skills, or storage features.
- **PATCH** bumps are bug fixes, doc clarifications, and internal refactors with no
  observable behavior change.

## [Unreleased]

## [3.1.1] - 2026-05-16

### Fixed
- SessionStart hook hint now lists `/architect` alongside the other four roles
  (`bin/teamwork-context.mjs`). Previously, users were never told the architect
  role existed via the auto-injected coordinator briefing, even though
  constitution §4 and the coordinator routing table both include it.
- `markStateRead()` (`guards/session.ts`) no longer scans the workspace
  filesystem when the workspace path doesn't exist on the host. In SQLite/HTTP
  mode the server may handle workspace paths it can't see locally; previously
  every `tw_get_state` call there did wasted `stat()` syscalls (and risked
  EACCES noise on hostile mounts). Freshness in that mode still rides on the
  `extra` snapshot map.
- `CLAUDE.md` no longer claims the SessionStart hook is a silent no-op in this
  repo. The repo dogfoods its own server (`.current/`, `tasks.md` are present);
  the hook fires here exactly as in any managed workspace.
- `skill-sr-engineer.md` "Hard rules" no longer restates constitution §2 and §3
  verbatim — both bullets now point at the relevant constitution section. This
  honors constitution §1's "skills MUST NOT restate these rules".

## [3.1.0] - 2026-05-15

### Added
- `tw_add_task` MCP tool — append tasks to the active list. Works in stdio (markdown)
  and HTTP/SQLite modes. Required for seeding tasks remotely without filesystem access.
- SQLite storage adapter for HTTP mode (`SqliteHandoffStorage`) implements the same
  `HandoffStorage` interface as the markdown file storage — no workspace files needed
  on the server host.

### Changed
- Constitution and skills slimmed (v3.1.0): removed redundancy, fixed role gaps,
  consolidated repeated prompts. Net token budget per role ≈ 1.4k.
- `tools/tasks.ts` is now a thin delegator through `getActiveStorage()`. File-system
  task ops live in `tools/tasks-file.ts`; SQLite task ops live in `tools/storage-sqlite.ts`.
- `tools/drift.ts` rewritten to use `storage.listTasks()` — no direct fs access, so
  drift detection works identically in stdio and HTTP modes.
- README clarifies first-time install timing, hook ordering, and the `Step 4: Verify`
  pass.

### Fixed
- Architect role prompt registered in `index.ts` (previously missing from the
  `ListPrompts` handler).
- Stable hook bin path: `bin/teamwork-context.mjs` exposed as a `bin` entry so users
  no longer have to dig into `~/.npm/_npx/<hash>/…`.
- `better-sqlite3` is loaded lazily — stdio users without a C++ toolchain are no
  longer blocked at install time. HTTP mode still requires it.
- Per-IDE install docs (Claude Code, Claude Desktop, Cursor, Continue, Zed, Windsurf,
  Cline, Gemini, Antigravity) reconciled to a single canonical install command.
- Token policy + tool schema synced across all role prompts.

## [3.0.x and earlier]

This is the first release under a version-pinned distribution policy. Prior history is
preserved in `git log` and the GitHub commit graph; future entries will live in this file.
