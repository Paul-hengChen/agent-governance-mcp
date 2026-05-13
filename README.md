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

When an MCP-compatible client calls the `sr-engineer` prompt, the server dynamically assembles:

```
content/constitution.md         ← Your "Constitution" (rules of conduct)
+ content/skill-sr-engineer.md   ← SOP (standard operating procedures)
+ Current handoff.md JSON state  ← Where the project is currently at
```

This is injected into the AI's context.
**In short**: The moment AI starts working, it automatically memorizes the employee handbook, workflow, and handover notes.

### Layer 2: Tools — Structured APIs (Revoking Free-Text Privileges)

The server exposes 7 MCP tools. **AI cannot edit `handoff.md` or tasks directly; it MUST use these tools:**

| Tool | Function | Why this design? |
|---|---|---|
| `tw_get_state` | Reads current project progress | **Mandatory first step**, otherwise write tools are blocked (pre-flight check) |
| `tw_update_state` | Updates handoff | Server enforces valid YAML; impossible for AI to break formatting |
| `tw_get_next_task` | Fetches next incomplete task | Returns structured data |
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

### Communication
- **Stdio transport**: Communicates via standard input/output. Zero network ports, zero config, highly secure.

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

Requirements: Node.js 18+ (includes `npx`)

### 1. Configure your MCP Client

#### Claude Desktop / Anti-Gravity / Gemini Code
Edit your specific MCP settings JSON file:
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

#### Cursor IDE
Settings → Features → MCP → `+ Add new MCP server`:
- Name: `teamwork-mcp-server`
- Type: `command`
- Command: `npx -y github:Paul-hengChen/teamwork-mcp-server`

#### Claude Code (CLI)
In `~/.claude/settings.json`:
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

### 2. (Recommended) Configure SessionStart Hook
To automatically inject rules into Claude Code at startup without manually typing `/sr-engineer`:
```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /path/to/teamwork-mcp-server/bin/teamwork-context.mjs",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

### 3. Enable Teamwork in a New Project (⚠️ Critical)

> **Important**: The SessionStart hook only activates if the workspace contains `.current/`, `tasks.md`, or `TODO.md`. 

**Method A: Automatic (Recommended)**
Run this in your project root:
```bash
mkdir -p .current
```
Next time you open a session, the hook will detect `.current/` and auto-inject the constitution.
*Optional:* Create a `tasks.md` with markdown checkboxes (`- [ ] T01 ...`).

**Method B: Manual**
In Claude Code, type:
`/sr-engineer`
(`workspace_path` is optional — defaults to the current project directory.)

**Method C: Multi-Agent Switching**
Once the session starts, you default to the **Coordinator** role (`/teamwork`). The Coordinator auto-routes complex tasks to the right specialist via `tw_switch_role` — no manual switching required. You can also invoke roles directly:
- `/pm`: To analyze requests and split tasks into `tasks.md`.
- `/researcher`: To do deep tech research and write reports.
- `/qa-engineer`: To run tests, verify work, and rollback bugs.
- `/sr-engineer`: To implement features, fix bugs, and refactor code.

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
A: Not supported natively yet (locks are local). You must commit `.current/handoff.md` to Git, or wait for the Phase 3 cloud version.

**Q: Does this conflict with `.cursorrules` or `CLAUDE.md`?**
A: No, they are complementary. The MCP Server acts as the source of truth, while your IDE rules act as a fallback.

---

## Multi-Agent Ecosystem

The system now supports a complete autonomous development team with specialized roles:

- **Coordinator (`teamwork`)**: The default role on session start. Classifies incoming requests and auto-routes them to the right specialist via `tw_switch_role` — no manual role switching required for most workflows. Watermark: `// Touched by @coordinator` / `<!-- Touched by @coordinator -->`.
- **Sr. Engineer (`sr-engineer`)**: Implements features, fixes bugs, refactors code. Enforces TDD and type safety. Watermark: `// Coded by @sr-engineer` / `<!-- Authored by @sr-engineer -->`.
- **Product Manager (`pm`)**: Analyzes user requests, writes specs, splits features into granular tasks (`tasks.md`), and prioritizes work. Watermark: `// Authored by @pm` / `<!-- Authored by @pm -->`.
- **Researcher (`researcher`)**: Reads documentation, researches libraries, validates technical feasibility, and gathers context before execution. Watermark: `<!-- Researched by @researcher -->`.
- **QA Engineer (`qa-engineer`)**: Writes tests, runs verifications, detects regressions, and signs off on completed tasks. Watermark: `// Tested by @qa-engineer` / `<!-- QA by @qa-engineer -->`.

---

## Future Roadmap

| Phase | Content | Status |
|---|---|---|
| 1 | 3-layer architecture, 6 tools, `sr-engineer` prompt | ✅ Done |
| 2 | Zod validation, safe YAML, file locks, SessionStart hook | ✅ Done |
| 2.5 | Configurable task paths/patterns, workspace overrides | ✅ Done |
| 3 | Multi-Agent Ecosystem (Researcher, PM, QA) | ✅ Done |
| 3.5 | Per-role watermark on created/modified files | ✅ Done |
| 4 | Schema versioning | Backlog |
| 5a | Unit + integration test suite | ✅ Done |
| 5b | GitHub Actions CI | Backlog |
| 6 | SSE / HTTP transport, DB integration, remote team sync | Planning |
| 7 | CI/CD hook — auto-update handoff on PR merge | Planning |

---

## Project Structure

```
teamwork-mcp-server/
├── index.ts                       # MCP server entry point
├── tools/                         # MCP Tool implementations (handoff, tasks, drift)
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
