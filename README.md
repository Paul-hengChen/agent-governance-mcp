# 🛡️ Teamwork MCP Server

> A "governance layer" + "automated secretary" via the Model Context Protocol.
> Enables any AI agent (Cursor, Claude, Anti-Gravity, Gemini, etc.) to share state, obey team rules, and prevent file overwriting across multiple IDEs and sessions.

---

## 📑 Table of Contents

- [One-Line Summary](#one-line-summary)
- [Quick Guide for Non-Engineers](#quick-guide-for-non-engineers)
- [Motivation: What Problem Does It Solve?](#motivation-what-problem-does-it-solve)
- [Core Architecture: Three Layers of Defense](#core-architecture-three-layers-of-defense)
- [Technical Details](#technical-details)
- [Pros and Cons](#pros-and-cons)
- [Installation & Startup](#installation--startup)
- [Multi-Agent Workflow](#multi-agent-workflow)
- [Daily Usage Flow](#daily-usage-flow)
- [Safety Mechanisms](#safety-mechanisms)
- [FAQ](#faq)
- [Future Roadmap](#future-roadmap)
- [Project Structure](#project-structure)
- [Glossary](#glossary)

---

## One-Line Summary

**Teamwork MCP Server** is an infrastructure layer that allows multiple AI agents/IDEs to work on the same project while **sharing state, adhering to a single source of truth for rules, and avoiding mutual overwrites.**

It is **not a code-generation tool**, but a "governance layer" for collaboration.

> Analogy: It acts as the team's PM + QA + Employee Handbook—built specifically for AI, running 24/7.

---

## Quick Guide for Non-Engineers

Imagine three scenarios:

- **Scenario A**: You ask Claude to write a login feature today. Tomorrow, you open Cursor to continue, but Cursor has no idea what was done or how it was implemented. It guesses, resulting in inconsistencies.
- **Scenario B**: You establish a rule: "Never read `.env` directly." But every tool (Cursor, Claude, Anti-Gravity) requires different config files. You must update rules in four places, which is error-prone.
- **Scenario C**: You have Cursor and VS Code open simultaneously. Both AIs update the project status file. **The later write silently overwrites the earlier one.** A whole task's progress is lost.

**This server solves all three scenarios with code.** It runs locally, and AIs talk to it instead of directly editing progress files. It will:
1. Memorize project progress. Regardless of which AI you use, they read the same state.
2. Centralize rules. All AIs fetch instructions from one place.
3. Prevent collisions. If two AIs write simultaneously, it queues them and prevents overwriting.

---

## Motivation: What Problem Does It Solve?

AI coding assistants have four fatal flaws when handling long-term projects:

### Pain Point 1: The Goldfish Memory — State Decoupling
- With every new session or IDE switch, the AI forgets its progress.
- What Claude modified yesterday is unknown to Cursor today.
- Result: Duplicated work, missed steps, or inconsistent implementations.

### Pain Point 2: Rule Drift
- Your rules ("No yapping", "TDD first", "Never touch .env") live in disparate config files (`.cursorrules`, `CLAUDE.md`, etc.).
- Modifying a single rule requires updating multiple files.

### Pain Point 3: Format Drift
- When AI maintains a progress file manually (`handoff.md` or `tasks.md`), it often breaks YAML syntax, messes up checkboxes, or drops fields.
- The next time you parse it, it fails, rendering the progress tracker useless.

### Pain Point 4 (The Silent Killer): Write Conflicts / Lost Updates
- Parallel sessions or multiple IDEs running concurrently.
- Both AIs read State X. They perform work and attempt to write State Y and State Z.
- **The later write overwrites the earlier write. State is silently lost.**

**Teamwork MCP Server solves all four pain points via server-side hard constraints.**

---

## Core Architecture: Three Layers of Defense

This isn't just "soft prompt engineering." It employs **server-side hard constraints** that AI cannot bypass.

### Layer 1: Prompts — Auto-Injected Rules

When an MCP-compatible client calls any role prompt (`teamwork`, `sr-engineer`, `pm`, `researcher`, `qa-engineer`), the server dynamically assembles:

```
content/constitution.md         ← Your "Constitution" (rules of conduct)
+ content/skill-<role>.md        ← Role-specific SOP (standard operating procedures)
+ Current handoff.md JSON state  ← Where the project is currently at
```

This is injected into the AI's context.
**In short**: The moment AI starts working, it automatically memorizes the employee handbook, workflow, and handover notes.

### Layer 2: Tools — Structured APIs (Revoking Free-Text Privileges)

The server exposes 8 MCP tools. **AI cannot edit `handoff.md` or tasks directly; it MUST use these tools:**

| Tool | Function | Why this design? |
|---|---|---|
| `tw_get_state` | Reads current project progress | **Mandatory first step**, otherwise write tools are blocked (pre-flight check) |
| `tw_update_state` | Updates handoff | Server enforces valid YAML; impossible for AI to break formatting |
| `tw_get_next_task` | Fetches next incomplete task | Returns structured data |
| `tw_add_task` | Appends a new task | Works in stdio (markdown) and HTTP/SQLite modes — no workspace filesystem needed |
| `tw_complete_task` | Changes `[ ]` to `[x]` | Safely edits markdown checkboxes atomically |
| `tw_rollback_task` | `[x]` → `[ ] (reverted: reason)` | Used when implementations fail later |
| `tw_detect_drift` | Compares handoff vs tasks | Catches synchronization issues |
| `tw_switch_role` | Loads a role's SOP into context | Coordinator calls this to auto-route complex tasks without a full prompt reload |

**In short**: AI works in a cleanroom. It can only report progress by pressing pre-defined buttons.

### Layer 3: Guards — Server-Side Interception

Two lines of defense enforced at the **code level**:

#### (a) Pre-Flight Check
If the AI tries to `update_state` without ever calling `tw_get_state`, it receives a `⛔ BLOCKED` error. This forces a "read-before-write" discipline.

#### (b) Cross-Process File Lock + Mtime Freshness Check
- **File Lock**: If two AIs write simultaneously, an `O_EXCL` lockfile serializes them. No torn writes.
- **Freshness Check**: If the file was modified by someone else after you read it, the server throws a `STATE DRIFT` error and demands a re-read.
- **Atomic Writes**: Writes to a `*.tmp` file, then uses POSIX `rename`. Readers only see the complete old or new version.

---

## Technical Details

### Language / Runtime
- **TypeScript** compiled to ES2022, strict typing.
- **Node.js** ESM modules.
- Output lives in `dist/` and is committed for immediate remote execution via `npx`.

### Dependencies
- `@modelcontextprotocol/sdk`: MCP server framework
- `zod` v4: Runtime validation
- `js-yaml`: Safe YAML frontmatter read/write
- `better-sqlite3`: SQLite storage adapter for HTTP/remote mode

### Communication
- **Stdio transport** (default): Communicates via standard input/output. Zero network ports, zero config, highly secure.
- **HTTP transport** (`--port <n> [--db <path>]`): Streamable HTTP at `/mcp`, SQLite-backed state, `GET /healthz` for liveness probes.
  - `TW_AUTH_TOKEN` — required Bearer token (set this whenever the port is reachable beyond localhost; a loud warning is logged if unset).
  - `TW_ALLOWED_ORIGINS` — comma-separated Origin allowlist (DNS-rebinding defense). Empty list = allow any.

### Methodology-Agnostic
The server defaults to a generic markdown checkbox format, but handles customization via workspace overrides:
- **Task format override**: Place `<workspace>/.current/.config.json` with `taskPattern` (regex) and `taskPaths`.
- **Constitution/Skill override**: Place `<workspace>/.current/constitution.md` to override the default rules.
- **Vibe coding mode**: If no task lists exist, the tools fail gracefully, but the prompt injection and handoff state still function perfectly.

### State Format Example (`handoff.md`)
The progress state is stored as a human-readable file with YAML frontmatter. This allows AI to easily parse it, and humans to easily read it.
```markdown
---
active_feature: Implement user login page
status: In_Progress
completed_tasks:
  - 'T01 src/auth.ts: Setup JWT validation'
pending_notes:
  - 'T02 blocked: Waiting for UI team to provide login button SVGs'
---

# Project State
Do not edit this file manually. Use the provided tools.
```

---

## Pros and Cons

### ✅ Pros
1. **Zero-Config Startup**: Run directly via `npx github:...`. No clone or `npm install` needed.
2. **Single Source of Truth**: Change rules in one place; all AI clients obey instantly.
3. **True Cross-Tool Consistency**: Works with Claude, Cursor, Anti-Gravity, Gemini, Cline, etc.
4. **Data Integrity**: Cross-process file locks + mtime checks genuinely prevent write conflicts.
5. **Human Readable**: State is saved as plain text markdown, not a black-box DB.
6. **Fails Loudly**: Clean Zod errors, explicit STATE DRIFT warnings.
7. **Ultra-lightweight Context (Caveman-style)**: Tool descriptions are heavily compressed to save LLM prompt tokens and reduce context window bloat, maximizing the tokens available for your actual code.

### ❌ Limitations
- **Cannot Force AI Rule Compliance**: The constitution is injected, but AI can still hallucinate or ignore it (inherent LLM limitation).
- **Cannot Force Tool Usage**: AI *could* technically bypass MCP and use `fs.write`. However, `detect_drift` catches this later.
- **No Cross-Machine Sync**: File locks are local. Remote team sync requires Git or a future cloud version.

---

## Installation & Startup

Requirements: Node.js 18+ (includes `npx`). Stdio mode has zero native dependencies; HTTP mode optionally pulls in `better-sqlite3` (needs Python + a C++ toolchain on first install).

### 1. Configure your MCP Client

Every client below points at the same command: `npx -y github:Paul-hengChen/teamwork-mcp-server`. Pick the section that matches your tool.

#### Claude Code (CLI)
> ⚠️ **Do NOT add `mcpServers` to `~/.claude/settings.json`** — Claude Code CLI ignores that key (that's Claude Desktop's format). Use the CLI command:

```bash
claude mcp add -s user teamwork-mcp-server -- npx -y github:Paul-hengChen/teamwork-mcp-server
claude mcp list
# teamwork-mcp-server: npx -y github:Paul-hengChen/teamwork-mcp-server - ✓ Connected
```

This writes to `~/.claude.json` (the file the CLI actually reads).

#### Claude Desktop
Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):
```json
{
  "mcpServers": {
    "teamwork-mcp-server": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
    }
  }
}
```
Restart Claude Desktop. Note: Claude Desktop does **not** support the SessionStart hook (Step 2 below); invoke roles via the prompt picker instead.

#### Cursor
Create or edit `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json` (per-project):
```json
{
  "mcpServers": {
    "teamwork-mcp-server": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
    }
  }
}
```
Restart Cursor. Verify via Settings → Features → MCP (the server should show ✓).

#### Windsurf
Edit `~/.codeium/windsurf/mcp_config.json`:
```json
{
  "mcpServers": {
    "teamwork-mcp-server": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
    }
  }
}
```

#### Continue (VS Code / JetBrains)
Edit `~/.continue/config.yaml`:
```yaml
mcpServers:
  - name: teamwork-mcp-server
    command: npx
    args:
      - "-y"
      - "github:Paul-hengChen/teamwork-mcp-server"
```

#### Cline (VS Code extension)
VS Code → `Cline: Open MCP Settings` → add to `cline_mcp_settings.json`:
```json
{
  "mcpServers": {
    "teamwork-mcp-server": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
    }
  }
}
```

#### Zed
Edit `~/.config/zed/settings.json`:
```json
{
  "context_servers": {
    "teamwork-mcp-server": {
      "command": {
        "path": "npx",
        "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
      }
    }
  }
}
```

#### Gemini CLI / Code Assist
Edit `~/.gemini/settings.json`:
```json
{
  "mcpServers": {
    "teamwork-mcp-server": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/teamwork-mcp-server"]
    }
  }
}
```

#### Google Antigravity
Open the in-app MCP Server settings UI and add a new entry: command `npx`, args `-y github:Paul-hengChen/teamwork-mcp-server`. (The underlying config file is platform-dependent.)

### 2. (Claude Code only) Configure SessionStart Hook
Auto-injects the constitution + Coordinator SOP + handoff state into every Claude Code session.

The hook helper is exposed as a `bin` entry, so use `npx` directly — no fragile `~/.npm/_npx/<hash>/…` paths required.

Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y -p github:Paul-hengChen/teamwork-mcp-server teamwork-context",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

> Other MCP clients (Claude Desktop, Cursor, Continue, etc.) don't have a SessionStart hook concept. For them, the constitution is loaded when you invoke a role prompt (Step 4) — that's expected.

### 3. Enable Teamwork in a New Project (⚠️ Critical)

The SessionStart hook only activates if the workspace contains **any of**: `.current/`, `tasks.md`, or `TODO.md`. Without a marker, the hook is a silent no-op (by design — keeps unrelated projects clean).

**Method A: Automatic (Recommended)**
```bash
mkdir -p .current
```
Next session, the hook detects `.current/` and auto-injects everything.
*Optional:* Create a `tasks.md` with markdown checkboxes (`- [ ] T01 …`).

**Troubleshooting**: hook silently doing nothing? Make sure (a) one of the three markers exists at workspace root, (b) the `npx` command in step 2 runs to completion (test by pasting it into a terminal — it should emit a JSON blob on stdout), (c) you restarted the Claude Code session after editing `settings.json`.

### 4. Invoke Roles Manually

In **Claude Code**, MCP prompts are exposed as namespaced slash commands:
- `/mcp__teamwork-mcp-server__teamwork` — Coordinator (auto-routes to specialists)
- `/mcp__teamwork-mcp-server__pm` — write specs, break down tasks
- `/mcp__teamwork-mcp-server__architect` — system design, interface contracts
- `/mcp__teamwork-mcp-server__researcher` — deep tech research
- `/mcp__teamwork-mcp-server__sr-engineer` — implement / fix / refactor
- `/mcp__teamwork-mcp-server__qa-engineer` — review, write tests, rollback

> Want shorter aliases like `/teamwork`? Create `~/.claude/commands/teamwork.md` (or per-project `.claude/commands/teamwork.md`) containing a single line that invokes the namespaced command. Claude Code's own slash commands take precedence over MCP prompts of the same name.

In **other clients**, use the in-app prompt picker (Claude Desktop), `@`-mention syntax (Cursor's MCP prompt menu), or your client's documented MCP-prompt invocation. The prompt names themselves (`teamwork`, `pm`, `architect`, `researcher`, `sr-engineer`, `qa-engineer`) are stable across clients.

### 5. (Optional) HTTP / Remote Mode

Stdio mode is the default and recommended for solo / single-machine use. For shared remote state (e.g. a team server), run HTTP mode:

```bash
# Local
npx -y github:Paul-hengChen/teamwork-mcp-server --port 3000 --db ./teamwork.db
# Liveness probe
curl http://localhost:3000/healthz
```

**Required env vars** (whenever the port is reachable beyond `localhost`):
- `TW_AUTH_TOKEN` — Bearer token clients must send (server logs a loud warning if unset).
- `TW_ALLOWED_ORIGINS` — comma-separated `Origin` allowlist (DNS-rebinding defense; empty = allow any).

```bash
TW_AUTH_TOKEN=hunter2 TW_ALLOWED_ORIGINS=https://app.example.com \
  npx -y github:Paul-hengChen/teamwork-mcp-server --port 3000
```

**Docker**:
```bash
docker build -t teamwork-mcp-server .
docker run --rm -p 3000:3000 \
  -e TW_AUTH_TOKEN=hunter2 \
  -e TW_ALLOWED_ORIGINS=https://app.example.com \
  -v $(pwd)/data:/app/data \
  teamwork-mcp-server --db /app/data/teamwork.db
```

> HTTP mode requires `better-sqlite3` (a native module needing Python + C++ toolchain on first install). It's an `optionalDependency` — stdio users on machines without build tools are unaffected.

---

## Multi-Agent Workflow

Every user message goes through the same routing pipeline. The diagram below shows both the session boot sequence and per-message decision flow.

### Full Routing Flowchart

```mermaid
flowchart TD
    USER([👤 User types a message]) --> HOOK

    subgraph BOOT ["🚀 Session Start — fires once per session"]
        HOOK[SessionStart hook detected\n.current/ or tasks.md present?] -- Yes --> INJECT[Inject into context:\nconstitution + coordinator SOP\n+ current handoff.md state]
        HOOK -- No --> NOOP[Silent no-op\nnormal Claude session]
    end

    INJECT --> COORD
    NOOP --> COORD

    subgraph ROUTING ["🎯 Coordinator — every message"]
        COORD{Classify intent\nfrom message}
    end

    COORD -- "research · investigate\ncompare · feasibility" --> RES
    COORD -- "plan · spec · create tasks\nbreak down" --> PM
    COORD -- "design · architecture\ninterface contract" --> ARCH
    COORD -- "implement · fix\nrefactor · add feature" --> ENG
    COORD -- "test · verify\nvalidate · rollback" --> QA
    COORD -- "Q&A · single-file edit\nstatus check" --> DIRECT["Execute directly\n≤ 15 words reply\nno state sync needed"]

    subgraph PIPELINE ["🔄 Specialist Roles — each follows its own SOP"]
        RES["🔍 researcher\n① tw_get_state → tw_detect_drift\n② web search / file reads\n③ distil → write research/＊.md\n④ tw_update_state"]

        PM["📋 pm\n① tw_get_state → tw_detect_drift\n② ambiguity gate — stop if unclear\n③ write specs/＊.md  ← enforced schema\n④ append tasks.md  ← priority + depends_on\n⑤ tw_update_state"]

        ARCH["🏗️ architect  (optional — complex features)\n① tw_get_state → tw_detect_drift\n② read specs/＊.md\n③ write specs/＊-architecture.md\n   file list · data structs · interface contracts\n④ tw_update_state"]

        ENG["⚙️ sr-engineer\n① tw_get_state → tw_detect_drift\n② clarification gate — block if ambiguous\n③ task-size check — block if > 5 files / 300 lines\n④ modify files\n⑤ tsc / mypy / cargo check — ZERO errors\n⑥ security checklist  ← OWASP basics\n⑦ tw_complete_task → tw_update_state"]

        QA["🧪 qa-engineer\n① tw_get_state → tw_detect_drift\n② Phase 1 — review code\n③ Phase 2 — 3-round discussion  ← time-boxed\n④ Phase 3 — write tests\n   · spec-to-AC mapping\n   · ≥ 80% coverage gate\n   · security smoke tests\n⑤ Phase 4 — run + CI runnability check\n⑥ tw_complete_task / tw_rollback_task\n   tw_update_state"]
    end

    PM --> ARCH
    ARCH --> ENG
    ENG --> QA

    QA -- "✅ PASS" --> DONE(["handoff.md\nstatus = PASS"])
    QA -- "❌ FAIL" --> ROLL["tw_rollback_task\ntask checkbox reverted"]
    ROLL --> ENG

    style BOOT fill:#e3f2fd,stroke:#1976D2,color:#000
    style ROUTING fill:#fff8e1,stroke:#F57F17,color:#000
    style PIPELINE fill:#f3e5f5,stroke:#7B1FA2,color:#000
```

### Routing Decision Table

| User says... | Routes to | Artifact produced |
|---|---|---|
| "research X", "compare A vs B" | `researcher` | `research/<topic>.md` |
| "plan this", "create tasks for..." | `pm` | `specs/<feature>.md` + `tasks.md` |
| "design the architecture" | `architect` | `specs/<feature>-architecture.md` |
| "implement", "fix", "refactor" | `sr-engineer` | modified source files |
| "test", "verify", "rollback" | `qa-engineer` | `qa_reports/review_<task-id>.md` + test files |
| quick question, single-file edit | Coordinator (direct) | inline reply |

### Typical Multi-Phase Feature Flow

```
User: "add dark mode"
  └─▶ pm        → specs/dark-mode.md + tasks.md (T01–T04)
       └─▶ architect  → specs/dark-mode-architecture.md
            └─▶ sr-engineer  → implements T01–T04, build PASS
                 └─▶ qa-engineer → reviews, writes tests, PASS
                      └─▶ handoff.md: status = PASS ✅
```

---

## Daily Usage Flow

### Scenario: Working on Ticket #42
1. You open Claude Code in the workspace. The SessionStart hook automatically injects the constitution and state. The AI knows: *"I am on Ticket #42, tasks 1-3 are done, task 4 is pending."*
2. You say "continue". AI calls `tw_get_next_task` and starts working.
3. AI finishes and calls `tw_complete_task("auth-04")`. Checkbox flips to `[x]`.
4. AI calls `tw_update_state`. `handoff.md` is updated atomically.
5. You close the session.
6. The next day, you open **Cursor**. Cursor connects, calls `tw_get_state`, gets the latest state, and seamlessly continues with task 5.

---

## Safety Mechanisms

| Level | Mechanism | Prevents |
|---|---|---|
| 0 | **Zod Schema Validation** | Bad types/missing fields from AI |
| 1 | **Pre-Flight Check** | Blind writes without reading state |
| 2 | **Cross-Process File Lock** | Concurrent writes via `O_EXCL` |
| 3 | **Mtime Freshness Check** | Lost updates (State Drift) |
| 4 | **Atomic Write** | Torn writes / Half-written files |
| 5 | **YAML Serialization** | Corrupted YAML formatting via `js-yaml` |
| 6 | **Fail Loud** | Silent failures on `server.connect()` |

---

## FAQ

**Q: Why use `npx github:...` instead of `npm install`?**
A: Zero config. Your team doesn't need to clone or install anything. They always pull the latest version automatically.

**Q: I modified `content/constitution.md` but the client didn't update?**
A: Start a new session. Also, clear npx cache: `rm -rf ~/.npm/_npx`.

**Q: Why does it work even if `.current/handoff.md` doesn't exist?**
A: It supports cold starts. `tw_get_state` returns `{exists: false}`, prompting the AI to initialize it via `tw_update_state`.

**Q: How about cross-machine team collaboration?**
A: Stdio mode locks are local-only. For remote collaboration, use **HTTP mode** (`--port <n>`) with SQLite storage (Phase 6+). Alternatively, commit `.current/handoff.md` to Git for async sync.

**Q: Does this conflict with `.cursorrules` or `CLAUDE.md`?**
A: No, they are complementary. The MCP Server acts as the source of truth, while your IDE rules act as a fallback.

---

## Multi-Agent Ecosystem

The system now supports a complete autonomous development team with specialized roles:

- **Coordinator (`teamwork`)**: The default role on session start. Classifies incoming requests and auto-routes them to the right specialist via `tw_switch_role` — no manual role switching required for most workflows. Signs off chat responses with `— @coordinator`.
- **Product Manager (`pm`)**: Analyzes user requests, writes structured specs (`specs/<feature>.md` with User Stories + BDD Acceptance Criteria), splits features into prioritized tasks (`tasks.md`), and halts on ambiguous requirements. Signs off chat responses with `— @pm`.
- **Architect (`architect`)**: Translates PM specs into system design artifacts (`specs/<feature>-architecture.md`) covering affected file list, data structures, interface contracts, and sequence diagrams. Runs between PM and sr-engineer for non-trivial features. Signs off chat responses with `— @architect`.
- **Sr. Engineer (`sr-engineer`)**: Implements features, fixes bugs, refactors code. Enforces strict typing, build integrity, and OWASP security checklist before QA handoff. Does NOT write tests. Signs off chat responses with `— @sr-engineer`.
- **Researcher (`researcher`)**: Reads documentation, researches libraries, validates technical feasibility, and gathers context before execution. Signs off chat responses with `— @researcher`.
- **QA Engineer (`qa-engineer`)**: Reviews sr-engineer's code, maps tests to PM acceptance criteria (≥80% coverage gate), runs verifications, and signs off on completed tasks. Signs off chat responses with `— @qa-engineer`.

---

## Future Roadmap

| Phase | Content | Status |
|---|---|---|
| 1 | 3-layer architecture, 6 tools, `sr-engineer` prompt | ✅ Done |
| 2 | Zod validation, safe YAML, file locks, SessionStart hook | ✅ Done |
| 2.5 | Configurable task paths/patterns, workspace overrides | ✅ Done |
| 3 | Multi-Agent Ecosystem (Researcher, PM, QA) | ✅ Done |
| 3.5 | Per-role watermark as chat sign-off line | ✅ Done |
| 3.6 | Architect role + skill enhancements (spec schema, BDD AC, security checklist, coverage gate, persona backstory) | ✅ Done |
| 4 | Schema versioning | Backlog |
| 5a | Unit + integration test suite | ✅ Done |
| 5b | GitHub Actions CI | ✅ Done |
| 6 | SSE / HTTP transport, SQLite storage, Docker deployment | ✅ Done |
| 6.1 | HTTP-mode Bearer auth + Origin allowlist + `/healthz` | ✅ Done |
| 7 | Task ops lifted into storage adapter — HTTP/SQLite mode no longer needs a mounted workspace; new `tw_add_task` tool | ✅ Done |
| 8 | CI/CD hook — auto-update handoff on PR merge | Planning |

---

## Project Structure

```
teamwork-mcp-server/
├── index.ts                       # MCP server entry point
├── tools/                         # MCP Tool implementations (handoff, tasks, drift)
├── transport/                     # HTTP transport (Streamable HTTP + SQLite + auth)
├── guards/                        # Session state, pre-flight checks, file locks
├── prompts/                       # Prompt assembly (teamwork, sr-engineer, pm, researcher, qa-engineer)
├── content/                       # Default constitutions and skills
├── bin/                           # Helper scripts (SessionStart hook)
├── test/                          # Unit & integration tests (session, file-lock, handoff, tasks)
├── dist/                          # Compiled JS (committed for npx execution)
├── CLAUDE.md                      # Guide for Claude Code
└── .antigravityrules              # Guide for Anti-Gravity
```

---

## Glossary

| Term | Definition |
|---|---|
| **MCP (Model Context Protocol)** | Open standard by Anthropic enabling AI agents to interact with external tools and data. |
| **MCP Server** | An application (like this one) implementing the MCP protocol. |
| **MCP Client** | The AI tool (Cursor, Claude, Anti-Gravity) connecting to the server. |
| **Tool / Prompt** | Interfaces exposed by the server. Tools are callable functions; Prompts are context templates. |
| **Stdio transport** | Communication via standard input/output (no network ports). |
| **handoff.md** | The "handover" file detailing project state and blockers. |
| **Race condition** | Timing issue when multiple processes access the same resource simultaneously. |

---

## License & Author

- Author: Paul Chen ([@Paul-hengChen](https://github.com/Paul-hengChen))
- License: ISC
- Repo: <https://github.com/Paul-hengChen/teamwork-mcp-server>
