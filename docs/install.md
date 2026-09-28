# Install

> 90% of users only need [Claude Code (CLI)](#claude-code-cli). Skip to your client; ignore the rest.

**Requirements**: Node.js 20+ (`node --version`) — enforced by `package.json` `engines`. Stdio mode has zero native deps. HTTP mode optionally pulls in `better-sqlite3` (needs Python + C++ toolchain on first install).

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

All clients point at the same command: `npx -y github:Paul-hengChen/agent-governance-mcp#v4.0.0`.

---

## Claude Code (CLI)

Writes to `~/.claude.json`. Uses the CLI's own command:

```bash
claude mcp add -s user agent-governance-mcp -- npx -y github:Paul-hengChen/agent-governance-mcp#v4.0.0
claude mcp list
# agent-governance-mcp: ... - ✓ Connected
```

> ⚠️ Do **NOT** put `mcpServers` in `~/.claude/settings.json`. Claude Code CLI ignores that key (it's Claude Desktop's format).

Then [mark the workspace](#mark-the-workspace). (The [SessionStart hook](#sessionstart-hook-claude-code-only--opt-in-not-recommended-as-default) is optional — see its section before adding it.)

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
      "args": ["-y", "github:Paul-hengChen/agent-governance-mcp#v4.0.0"]
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
      - "github:Paul-hengChen/agent-governance-mcp#v4.0.0"
```

## Zed

Edit `~/.config/zed/settings.json` (uses `context_servers`, not `mcpServers`):

```json
{
  "context_servers": {
    "agent-governance-mcp": {
      "command": {
        "path": "npx",
        "args": ["-y", "github:Paul-hengChen/agent-governance-mcp#v4.0.0"]
      }
    }
  }
}
```

## Gemini CLI / Code Assist

Edit `~/.gemini/settings.json`. Same JSON block as Claude Desktop.

## Google Anti-Gravity

Open the in-app MCP Server settings UI → add entry: command `npx`, args `-y github:Paul-hengChen/agent-governance-mcp#v4.0.0`.

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
npx -y --package=github:Paul-hengChen/agent-governance-mcp#v4.0.0 agc init
```

### Keeping governance artifacts out of git: `agc init --artifacts=local|repo`

`agc init` also records whether the governance runtime artifacts — `.current/`, `tasks.md`, `qa_reports/`, `review_reports/` — should stay out of git or be tracked with the repo. The choice is stored as `"artifacts"` in `.current/.config.json` ([docs/config.md](config.md#artifacts--git-posture-for-governance-runtime-artifacts)). The flag is non-interactive (safe inside an agent session).

```bash
agc init                      # same as --artifacts=local on a fresh repo
agc init --artifacts=local    # keep them out of git
agc init --artifacts=repo     # track them like any other file
```

- **`local` (the default)** adds `/.current/`, `/tasks.md`, `/qa_reports/`, `/review_reports/` to the repo's shared `.git/info/exclude` (`git rev-parse --git-common-dir`), never to the tracked `.gitignore` — teammates who don't use agc see no change. The flip side: the exclude does not travel with a clone, so each checkout runs `agc init` once. Going from `local` to `repo` later is a single `git add`; going the other way leaves the files in git history, which is why `local` is the default.
- **`repo`** writes only the config key. It does not touch `.git/info/exclude` (and does not remove rules an earlier `local` run added — they have no effect on tracked files).
- **Already-tracked paths.** An exclude rule does nothing for a file git already tracks. With an explicit `--artifacts=local` on such a repo, `agc init` still writes the rules and the key, then prints the tracked paths, the exact `git rm -r --cached …` command that would untrack them, and a note that history still contains the files. It never runs that command for you.
- **Flag omitted on an already-tracked repo.** The `local` default is *not* applied: no exclude rules and no `"artifacts"` key are written; `agc init` lists the tracked paths and asks you to re-run with `--artifacts=local` or `--artifacts=repo`.
- **Re-running** without the flag keeps whatever is already declared; pass the flag again to switch.
- **Outside a git repository**, `local` is still recorded; the exclude write is skipped with a one-line note.
- An invalid value (`--artifacts=foo`) exits 2 with a usage error and writes nothing.
- When a directory name below the repo root in the workspace path contains a character unsafe for a gitignore exclude rule — a wildcard (`*`, `?`, `[`, `]`), a backslash (`\`), or a control character (including CR and LF) — `local` refuses to run (exit 2, nothing written) because the written rule could match unintended files or be split across lines, while `--artifacts=repo` works there as usual.

`agc check` reports (advisory, exit code unaffected) when the key is undeclared, or when the declared choice disagrees with the repo: `local` with exclude rules missing or an artifact path tracked, `repo` with an artifact exclude rule present.

`agc check` also runs an **information-hygiene scan** (advisory, exit code unaffected) for the classes of detail the constitution's Information hygiene rule bans from durable output. It checks the contents and the file names of every tracked file and every untracked file that is not ignored (outside a git repo: a walk of the directory that skips `.git` and `node_modules`, capped at 10,000 files). Two layers run:

- **Built-in shape patterns**, which name nothing concrete: `home-path` (an absolute home-directory path), `encoded-home-path` (a home path flattened into one hyphenated directory name), `temp-path` (a per-user or system temp directory with a segment below its root; the bare `/tmp/` root is not flagged), `design-file-key` (a design-tool file URL that carries a file key), `credential` (vendor-prefixed secret shapes such as a private-key header or a cloud, forge, chat or model-API token), `work-item-link` (a hosted tracker's work-item or org link) and `internal-host` (an http(s) URL on an internal-only domain suffix). A home path whose username segment is a generic placeholder or a template token is not listed; one line reports how many were skipped.
- **Your keyword list** (people, company, client codenames, adopter names), category `keyword`. It is read from the file named by `AGC_HYGIENE_KEYWORDS`, or else from a file named `agc-hygiene-keywords` directly in the directory `git rev-parse --git-common-dir` prints (never tracked, and shared by every linked worktree). The format is UTF-8 text with one literal keyword per line; blank lines and `#` comment lines are ignored, and keywords shorter than 2 characters are dropped. Matching is case-insensitive and needs a word boundary on both sides. A list under the workspace's `.current/` is refused. With no list, only the shape layer runs and one line says so.

Each hit is reported as file, line (or "file name") and category only. **The matched text is never echoed**: any part of a printed path that matches is shown as `***`. At most 50 hits are listed, followed by a count of the rest and a one-line summary.

---

## Feature lanes: `agc feature start` / `agc feature finish`

Optional plumbing for running one ticket per linked git worktree ("lane"). Both commands must be run from the **primary checkout** — each refuses to run from inside a linked worktree (you cannot remove the directory you are standing in).

### `agc feature start <ticket-slug> [--base <branch>] [--path <dir>]`

```bash
agc feature start e73-agc-feature-lifecycle            # forks from main
agc feature start e73-agc-feature-lifecycle --base develop --path ~/lanes/e73
```

- `<ticket-slug>` must start with a ticket id (`e73-…` → lane `e73`); a slug without one is rejected before git runs. It creates branch `feat/<ticket-slug>` from `--base` (default `main`) and a linked worktree at `--path`.
- Default `--path`: `<parent-of-repo>/<repo-name>-lanes/<ticket-id>` — e.g. a repo at `/x/agent-governance-mcp` gets `/x/agent-governance-mcp-lanes/e73`. Missing parent directories are created. If the branch or the path already exists, the command fails and creates nothing.
- The lane id is printed as the last stdout line (`lane: <id>`). It is derived from the branch name by the same function the MCP server uses to find the lane's `.current/<lane>/` state. It is never written to a tracked file.
- Env bootstrap:
  - `node_modules` in the lane is a **symlink** to the primary checkout's `node_modules` (no `npm install` needed in the lane). If the primary checkout has no `node_modules`, the lane is still created, with a warning to run `npm install` in primary first.
  - **Shared `node_modules` warning:** never run `npm ci` / `npm install` inside the lane. `npm ci` deletes the directory first, which would delete primary's real `node_modules` through the link. For an independent install, `rm node_modules` in the lane (this removes only the link), then run `npm ci` there.
  - If the primary checkout has a `.env`, it is byte-copied into the lane.
  - `.env` and `/node_modules` are added to the repo's shared `info/exclude` (`git rev-parse --git-common-dir`), not to the tracked `.gitignore`, so a fresh lane's `git status` is clean. The upsert is idempotent.
- `agc feature start` does not run `agc init` in the lane. The lane's tracked files (including `CLAUDE.md`) are exactly what `git worktree add` checks out.

### `agc feature finish <ticket-id> (--shipped|--abandoned) [--base <branch>]`

Pass the bare ticket id (`e73`, not the slug). Exactly one of `--shipped` / `--abandoned` is required. The lane is found by exact lane-id match (`e73` never matches an `e730` lane).

- `--shipped` — for a lane whose branch is merged. Guard: the branch must be an ancestor of `--base` (default `main`, which is not remembered from `start`: a lane started with a non-default `--base` must pass the same `--base` here). If it is not merged, the command fails with "merge first, or use `--abandoned`" and touches nothing. When the guard passes, the command runs `git worktree remove` (never `--force`) and then `git branch -d` (safe delete, never `-D`). A worktree with uncommitted changes makes git refuse with its own "contains modified or untracked files" error, and nothing is removed.
- `--abandoned` — for a lane you are dropping. There is no merge guard, and the branch is **kept**.
  1. **Precondition:** if the lane has any uncommitted change other than the evidence files about to be moved, the command lists those paths and stops. Nothing is moved or committed.
  2. Evidence files directly under `qa_reports/` and `review_reports/` whose name contains the ticket id as a delimited token (`_`, `-`, `.` or name edge; case-insensitive) move into `qa_reports/abandoned/<ticket-id>/` and `review_reports/abandoned/<ticket-id>/`. `specs/` is never touched, and neither is any pending-ticket file.
  3. Tracked evidence moves with `git mv`, then gets one commit on the lane branch: `chore(lane): abandon <ticket-id> — evidence to abandoned/`. If no tracked evidence matched, no commit is made.
  4. `git worktree remove` runs (never `--force`).
  - **Rough edge — untracked evidence:** an untracked evidence file is moved with a plain rename and stays untracked, so step 4 fails with git's own "use --force" error. `agc` never retries with `--force`. Either `git add` + commit the file in the lane and re-run `finish --abandoned` (nothing is left to move, so the re-run only removes the worktree), or remove the worktree by hand once the evidence is dealt with.
- Removing a lane leaves the primary checkout's `node_modules` intact: git removes the lane's symlink and does not follow it.
- **Calling `git worktree remove` directly on a lane, bypassing `agc feature finish`, is undefined behaviour.** No evidence disposition runs, and neither the shipped nor the abandoned guard applies.

**Secrets:** `agc feature` copies `.env` with a kernel-level byte copy (`fs.copyFileSync`). Its contents are never read into a JavaScript string, logged, or printed by any `agc feature` command.

---

## Leaving agc: `agc eject [--yes] [--purge-knowledge]`

`agc eject` takes agc back out of the current workspace. Run it from the workspace directory in the primary checkout.

```bash
agc eject                            # dry-run: print the plan, change nothing
agc eject --yes                      # apply the plan
agc eject --purge-knowledge          # dry-run, also plan design/, specs/, docs/backlog.md
agc eject --yes --purge-knowledge    # apply, including those
```

- **Dry-run by default.** Without `--yes` it prints the plan and changes nothing. There is no confirmation prompt, and it never reads stdin, so it is safe inside an agent session.
- **`--yes`** applies the plan and prints each line as it is applied.
- **`--purge-knowledge`** adds the domain-knowledge class to the plan. It is never the default. On its own it is still a dry-run.
- **Tracked paths are never deleted.** The disposition is decided per path from the git index, not from the declared `"artifacts"` mode. An untracked path is deleted from disk, and it has no git recovery. A tracked path is left alone and listed in one printed `git rm -r <paths>` command. That command removes the paths from the index and the working tree. `agc` never runs it and never runs any other git command that changes the repository. The plan header shows the declared `artifacts` mode.
- **Idempotent.** When nothing is left, it prints `agc eject — nothing to eject.` and exits 0.
- **Refusals.** It exits 1 inside a linked worktree. `--yes` also exits 1 while any linked worktree exists, and names each one. Finish those lanes first (`agc feature finish`). A dry-run prints the same list as a warning. An unknown flag exits 2.
- **Subdirectory workspaces.** Paths and exclude lines are computed for the current workspace's own prefix (`sub/.current/`, `/sub/tasks.md`, …). A sibling workspace elsewhere in the repo is never touched.

| class | paths | disposition |
|---|---|---|
| (i) machine state | `.current/` | Removed: deleted if untracked, else listed in the `git rm -r` line |
| (ii-b) process evidence | `tasks.md`, `qa_reports/`, `review_reports/` | Removed, same per-path rule |
| (ii-a) domain knowledge | `design/`, `specs/`, `docs/backlog.md` | KEPT by default. These are the project's own rationale, and `docs/backlog.md` may be its plan. With `--purge-knowledge`, the same per-path rule applies |
| (iii) host traces | `CLAUDE.md` adapter block, `AGENTS.md`, `.antigravityrules`, this workspace's artifact lines in `.git/info/exclude` | `CLAUDE.md`: only the `<!-- BEGIN/END agc-adapter -->` block is removed and all other content is kept. The file is deleted if the block was its only content. `AGENTS.md` / `.antigravityrules`: deleted only when the file equals the installed template (version stamp aside). Otherwise it is KEPT with an advisory to review it by hand. `.git/info/exclude`: only this workspace's artifact rules are removed. Lane rules and unrelated lines stay. Outside a git repository this step is skipped with a note |

**What `agc eject` cannot do.** Every run prints these four items. Act on them yourself:

1. **Rewrite git history.** Anything that was ever tracked stays in history.
2. **Edit code comments.** Citations to `specs/`, `qa_reports/`, `review_reports/` or ticket/AC ids in source comments are not machine-decidable, so they are left as-is.
3. **Edit your host's MCP/settings registration.** For Claude Code the command is printed: `claude mcp remove -s user agent-governance-mcp`. For other hosts, remove this server's entry from their MCP config file by hand.
4. **Remove the machine-wide subagent templates in `~/.claude/agents/`.** Other projects on this machine may use them. The installed agc templates are listed with a manual `rm` command.

---

## SessionStart hook (Claude Code only — OPT-IN, not recommended as default)

> **Default since 2026-07-15: skip this section.** Governance context loads when you invoke a role prompt (`/teamwork` for the full coordinator, `teamwork-lite` for solo mode) — you pay the context cost only when you opt into a mode. The hook instead injects the full constitution + lite SOP (~19KB) into *every* session in a managed workspace, including sessions that never touch governed state, and a later `/teamwork` then adds a second, contradictory mode declaration. Register it only if you want auto-arming and accept that cost — and register it in exactly ONE settings file (a global + project-local double registration injects the block twice per session).

Auto-injects the constitution + Coordinator SOP + handoff state every session. The hook injects the parsed handoff state as a fenced JSON data block (the same renderer the role prompts use), not the raw handoff.md file. Edit `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "npx -y -p github:Paul-hengChen/agent-governance-mcp#v4.0.0 agent-governance-context",
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
npx -y -p github:Paul-hengChen/agent-governance-mcp#v4.0.0 agent-governance-context
# → JSON blob containing "additionalContext" with the constitution
```

If (2) produces no output:
1. One of `.current/`, `tasks.md`, `TODO.md` exists at workspace root? ([Mark the workspace](#mark-the-workspace))
2. `timeout` in `settings.json` is ≥ 60?
3. Restarted Claude Code after editing `settings.json`?
4. `claude mcp list` shows ✓ Connected?
5. `node --version` ≥ 20, network reachable, `npx clear-npx-cache` then retry.

---

## Invoke roles

In Claude Code, MCP prompts are namespaced slash commands:

All 12 registered prompts (`tools/registry.ts` → `PROMPT_REGISTRY`):

- `/mcp__agent-governance-mcp__teamwork` — Coordinator (auto-routes to specialists)
- `/mcp__agent-governance-mcp__teamwork-lite` — Coordinator (lite): solo-dev direct execution
- `/mcp__agent-governance-mcp__pm`
- `/mcp__agent-governance-mcp__architect`
- `/mcp__agent-governance-mcp__researcher`
- `/mcp__agent-governance-mcp__design-auditor`
- `/mcp__agent-governance-mcp__sr-engineer`
- `/mcp__agent-governance-mcp__code-reviewer`
- `/mcp__agent-governance-mcp__qa-engineer`
- `/mcp__agent-governance-mcp__doc-writer`
- `/mcp__agent-governance-mcp__release-engineer`
- `/mcp__agent-governance-mcp__integrator` — cross-lane fan-out planning + fan-in integration (prompt-only)

Want shorter aliases like `/teamwork`? Create `~/.claude/commands/teamwork.md` (or per-project `.claude/commands/teamwork.md`) with one line invoking the namespaced command.

In other clients: in-app prompt picker (Claude Desktop), `@`-mention (Cursor's MCP prompt menu), or your client's MCP-prompt invocation. Prompt names are stable across clients.

---

## Upgrade / pin a version

Replace `#v4.0.0` in the install command with another tag (or `#main` for bleeding edge). Then clear the npx cache:

```bash
npx clear-npx-cache
# or on older npm 9-:
rm -rf ~/.npm/_npx
```

[CHANGELOG.md](../CHANGELOG.md) records breaking changes per version.
