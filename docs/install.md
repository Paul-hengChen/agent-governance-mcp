# Install

> 90% of users only need [Claude Code (CLI)](#claude-code-cli). Skip to your client; ignore the rest.

**Requirements**: Node.js 18+ (`node --version`). Stdio mode has zero native deps. HTTP mode optionally pulls in `better-sqlite3` (needs Python + C++ toolchain on first install).

> ⏱️ First `npx` pull is **~30–60s**. Not a hang — subsequent runs are instant from the npx cache. If your hook `timeout` is < 60s, it appears broken on first install. This is the #1 install pitfall.

---

## Pick your client

| Client | Section |
|---|---|
| Claude Code (CLI) | [↓ here](#claude-code-cli) |
| Claude Desktop | [↓ here](#claude-desktop) |
| Cursor | [↓ here](#cursor) |
| Windsurf | [↓ here](#windsurf) |
| Cline (VS Code) | [↓ here](#cline-vs-code) |
| Continue (VS Code / JetBrains) | [↓ here](#continue) |
| Zed | [↓ here](#zed) |
| Gemini CLI / Code Assist | [↓ here](#gemini-cli--code-assist) |
| Google Anti-Gravity | [↓ here](#google-anti-gravity) |

All clients point at the same command: `npx -y github:Paul-hengChen/agent-governance-mcp#v3.30.0`.

---

## Claude Code (CLI)

Writes to `~/.claude.json`. Uses the CLI's own command:

```bash
claude mcp add -s user agent-governance-mcp -- npx -y github:Paul-hengChen/agent-governance-mcp#v3.30.0
claude mcp list
# agent-governance-mcp: ... - ✓ Connected
```

> ⚠️ Do **NOT** put `mcpServers` in `~/.claude/settings.json`. Claude Code CLI ignores that key (it's Claude Desktop's format).

Then add the [SessionStart hook](#sessionstart-hook-claude-code-only) and [mark the workspace](#mark-the-workspace).

---

## Claude Desktop

Edit `claude_desktop_config.json`:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "agent-governance-mcp": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/agent-governance-mcp#v3.30.0"]
    }
  }
}
```

Restart Claude Desktop. Claude Desktop does **not** support the SessionStart hook — invoke roles via the prompt picker instead.

---

## Cursor

Edit `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json` (per-project). Same JSON block as Claude Desktop. Verify via Settings → Features → MCP (should show ✓).

## Windsurf

Edit `~/.codeium/windsurf/mcp_config.json`. Same JSON block.

## Cline (VS Code)

Edit `cline_mcp_settings.json` (open via command palette → `Cline: Open MCP Settings`). Same JSON block.

## Continue

Edit `~/.continue/config.yaml` (YAML, not JSON):

```yaml
mcpServers:
  - name: agent-governance-mcp
    command: npx
    args:
      - "-y"
      - "github:Paul-hengChen/agent-governance-mcp#v3.30.0"
```

## Zed

Edit `~/.config/zed/settings.json` (uses `context_servers`, not `mcpServers`):

```json
{
  "context_servers": {
    "agent-governance-mcp": {
      "command": {
        "path": "npx",
        "args": ["-y", "github:Paul-hengChen/agent-governance-mcp#v3.30.0"]
      }
    }
  }
}
```

## Gemini CLI / Code Assist

Edit `~/.gemini/settings.json`. Same JSON block as Claude Desktop.

## Google Anti-Gravity

Open the in-app MCP Server settings UI → add entry: command `npx`, args `-y github:Paul-hengChen/agent-governance-mcp#v3.30.0`.

---

## Mark the workspace

The SessionStart hook (Claude Code) and tool calls are no-ops unless the workspace contains **any of** `.current/`, `tasks.md`, or `TODO.md`. By design — keeps unrelated projects clean.

```bash
mkdir -p .current
# optional:
# touch tasks.md  # then add markdown checkboxes like - [ ] T01 …
```

Or use the bundled scaffolder:
```bash
npx -y --package=github:Paul-hengChen/agent-governance-mcp#v3.30.0 agc init
```

---

## SessionStart hook (Claude Code only)

Auto-injects the constitution + Coordinator SOP + handoff state every session. Edit `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "npx -y -p github:Paul-hengChen/agent-governance-mcp#v3.30.0 agent-governance-context",
        "timeout": 60
      }]
    }]
  }
}
```

`timeout` is **seconds**. 60 leaves headroom for the first cold-start npx install; setting < 30 is the #1 cause of "hook silently does nothing."

Other clients (Claude Desktop, Cursor, …) don't have a SessionStart hook concept. For them, the constitution loads when you invoke a role prompt — that's expected.

---

## Verify

```bash
# 1. MCP server registered + reachable
claude mcp list
# → agent-governance-mcp: ... - ✓ Connected

# 2. SessionStart hook helper works (cd into a managed workspace first)
cd <your-project-with-.current>
npx -y -p github:Paul-hengChen/agent-governance-mcp#v3.30.0 agent-governance-context
# → JSON blob containing "additionalContext" with the constitution
```

If (2) produces no output:
1. One of `.current/`, `tasks.md`, `TODO.md` exists at workspace root? ([Mark the workspace](#mark-the-workspace))
2. `timeout` in `settings.json` is ≥ 60?
3. Restarted Claude Code after editing `settings.json`?
4. `claude mcp list` shows ✓ Connected?
5. `node --version` ≥ 18, network reachable, `npx clear-npx-cache` then retry.

---

## Invoke roles

In Claude Code, MCP prompts are namespaced slash commands:

- `/mcp__agent-governance-mcp__teamwork` — Coordinator (auto-routes to specialists)
- `/mcp__agent-governance-mcp__teamwork-lite` — Coordinator (lite): solo-dev direct execution
- `/mcp__agent-governance-mcp__pm`
- `/mcp__agent-governance-mcp__architect`
- `/mcp__agent-governance-mcp__researcher`
- `/mcp__agent-governance-mcp__sr-engineer`
- `/mcp__agent-governance-mcp__qa-engineer`

Want shorter aliases like `/teamwork`? Create `~/.claude/commands/teamwork.md` (or per-project `.claude/commands/teamwork.md`) with one line invoking the namespaced command.

In other clients: in-app prompt picker (Claude Desktop), `@`-mention (Cursor's MCP prompt menu), or your client's MCP-prompt invocation. Prompt names are stable across clients.

---

## Upgrade / pin a version

Replace `#v3.30.0` in the install command with another tag (or `#main` for bleeding edge). Then clear the npx cache:

```bash
npx clear-npx-cache
# or on older npm 9-:
rm -rf ~/.npm/_npx
```

[CHANGELOG.md](../CHANGELOG.md) records breaking changes per version.
