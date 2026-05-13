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

The server exposes 6 MCP tools. **AI cannot edit `handoff.md` or tasks directly; it MUST use these tools:**

| Tool | Function | Why this design? |
|---|---|---|
| `sdd_get_state` | Reads current project progress | **Mandatory first step**, otherwise write tools are blocked (pre-flight check) |
| `sdd_update_state` | Updates handoff | Server enforces valid YAML; impossible for AI to break formatting |
| `sdd_get_next_task` | Fetches next incomplete task | Returns structured data |
| `sdd_complete_task` | Changes `[ ]` to `[x]` | Safely edits markdown checkboxes atomically |
| `sdd_rollback_task` | `[x]` → `[ ] (reverted: reason)` | Used when implementations fail later |
| `sdd_detect_drift` | Compares handoff vs tasks | Catches synchronization issues |

**In short**: AI works in a cleanroom. It can only report progress by pressing pre-defined buttons.

### Layer 3: Guards — Server-Side Interception

Two lines of defense enforced at the **code level**:

#### (a) Pre-Flight Check
If the AI tries to `update_state` without ever calling `sdd_get_state`, it receives a `⛔ BLOCKED` error. This forces a "read-before-write" discipline.

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
            "command": "node /path/to/teamwork-mcp-server/bin/sr-engineer-context.mjs",
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
`/sr-engineer workspace_path:/absolute/path/to/project`

**Method C: Tools Only**
You can simply use the 6 MCP tools (`sdd_get_state`, etc.) without the constitution prompt.

---

## Daily Usage Flow

### Scenario: Working on Ticket #42
1. You open Claude Code in the workspace. The SessionStart hook automatically injects the constitution and state. The AI knows: *"I am on Ticket #42, tasks 1-3 are done, task 4 is pending."*
2. You say "continue". AI calls `sdd_get_next_task` and starts working.
3. AI finishes and calls `sdd_complete_task("auth-04")`. Checkbox flips to `[x]`.
4. AI calls `sdd_update_state`. `handoff.md` is updated atomically.
5. You close the session.
6. The next day, you open **Cursor**. Cursor connects, calls `sdd_get_state`, gets the latest state, and seamlessly continues with task 5.

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
A: It supports cold starts. `sdd_get_state` returns `{exists: false}`, prompting the AI to initialize it via `sdd_update_state`.

**Q: How about cross-machine team collaboration?**
A: Not supported natively yet (locks are local). You must commit `.current/handoff.md` to Git, or wait for the Phase 3 cloud version.

**Q: Does this conflict with `.cursorrules` or `CLAUDE.md`?**
A: No, they are complementary. The MCP Server acts as the source of truth, while your IDE rules act as a fallback.

---

## Multi-Agent Ecosystem (Planned)

The current version focuses on the `sr-engineer` role for execution. To build a complete autonomous development team, we plan to introduce the following roles to assist the `sr-engineer`:

- **Product Manager (`pm`)**: Focuses on analyzing user requests, writing specs, splitting features into granular tasks (`tasks.md`), and prioritizing work.
- **Researcher (`researcher`)**: Focuses on reading documentation, researching libraries, validating technical feasibility, and gathering context before execution.
- **QA Engineer (`qa-engineer`)**: Focuses on writing tests, running verifications, detecting regressions, and signing off on completed tasks.

---

## Future Roadmap

| Phase | Content | Status |
|---|---|---|
| 1 | 3-layer architecture, 6 tools, `sr-engineer` prompt | ✅ Done |
| 2 | Zod validation, safe YAML, file locks, SessionStart hook | ✅ Done |
| 2.5 | Configurable task paths/patterns, workspace overrides | ✅ Done |
| 3 | Schema versioning | Backlog |
| 4 | Test suite + GitHub Actions CI | Backlog |
| 5 | SSE / HTTP transport, DB integration, remote team sync | Planning |
| 6 | `skill-qa-engineer` (Automated QA closed loop) | Planning |
| 7 | CI/CD hook — auto-update handoff on PR merge | Planning |

---

## Project Structure

```
teamwork-mcp-server/
├── index.ts                       # MCP server entry point
├── tools/                         # MCP Tool implementations (handoff, tasks, drift)
├── guards/                        # Session state, pre-flight checks, file locks
├── prompts/                       # Prompt assembly (sr-engineer)
├── content/                       # Default constitutions and skills
├── bin/                           # Helper scripts (SessionStart hook)
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
