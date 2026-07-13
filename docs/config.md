# Workspace Configuration

The server defaults to a generic markdown-checkbox task format and the bundled constitution. Override per-workspace via files under `.current/`.

## `.current/.config.json` — task format override

Customize where and how the server reads task lists:

```json
{
  "taskPattern": "^- \\[(?<state>[ x])\\] (?<id>T\\d+) (?<title>.+)$",
  "taskPaths": ["tasks.md", "docs/backlog.md"]
}
```

| Field | Purpose |
|---|---|
| `taskPattern` | Regex with named groups `state`, `id`, `title`. Matches one task per line. |
| `taskPaths` | Ordered list of files the server scans for tasks. First-match wins for a given task id. |

Both fields are optional. Omit `taskPattern` to use the default `- [ ] T\d+ …` shape; omit `taskPaths` to use the default `tasks.md` at the workspace root.

**Schema-versioned**: `.config.json` carries `schema_version` and is lazily migrated on first read. See [docs/schema-versions.md](schema-versions.md).

### `cutApprovalAutoTier` — cut-approval auto-tier threshold (opt-in)

Arms the Constitution §3.1 **Cut-Approval Auto-Tier**: a ticket cut meeting ALL threshold conditions may be auto-approved — the sanctioned writer sets `cut_approved: true` without halting for the human, recording `cut-approved: auto-tier` + the threshold facts in `pending_notes` of the same write.

```json
{
  "cutApprovalAutoTier": {
    "maxFiles": 2,
    "maxPriority": "P3",
    "allowSchemaChange": false,
    "allowDesignArmed": false
  }
}
```

| Field | Default | Meaning |
|---|---|---|
| `maxFiles` | `2` | Cut may touch at most this many files. |
| `maxPriority` | `"P3"` | Least-urgent bound: the ticket's priority must be this or lower-urgency (numerically ≥). At the default, P2/P1/P0 tickets never auto-approve. |
| `allowSchemaChange` | `false` | `true` lets cuts containing a schema change auto-approve. Never by default. |
| `allowDesignArmed` | `false` | `true` lets design-armed cuts (design source detected) auto-approve. Never by default. |

Semantics:

- **Absent key = tier disabled.** Every cut halts for human approval, exactly the pre-v3.85.0 behavior. Cut review is the highest-leverage human checkpoint (E5 risk note: remove it last, only once retro data shows the tier is safe) — so removing it is an explicit per-workspace opt-in, never a default.
- **Present key (even `{}`) = tier armed.** Omitted or invalid fields fall back to the conservative defaults above; a non-object value is treated as absent (tier disabled).
- **Advisory, not enforced.** The server parses and surfaces the key (`loadConfig`) but never checks the threshold or gates a write on it. The coordinator/PM reads the config and applies the tier — the same attestation trust model as `cut_approved` itself.

---

## `.current/constitution.md` — constitution override

Drop a `constitution.md` next to `handoff.md` to **fully replace** the bundled constitution for this workspace. The server reads the workspace copy first, falls back to `content/constitution.md` (the bundled one) if absent.

Use cases:
- Stricter rules for a regulated codebase (e.g. additional security gates).
- Looser rules for a sandbox / experiment workspace.
- Custom roles or alternate routing chains (advanced).

**Caveat**: a hand-written constitution must keep the server-enforced contracts (`§3.1 server-enforced chain`, `§4 routing chain`). The state machine in `tools/transitions.ts` is code, not text — drift between your custom constitution and the code yields confusing rejections.

---

## `.current/skill-<role>.md` — per-role skill override

The same fallback applies to **every** role SOP. Drop any of these in `.current/` to replace just that role for this workspace:

```
.current/skill-coordinator.md
.current/skill-coordinator-lite.md
.current/skill-pm.md
.current/skill-architect.md
.current/skill-researcher.md
.current/skill-design-auditor.md
.current/skill-sr-engineer.md
.current/skill-code-reviewer.md
.current/skill-qa-engineer.md
.current/skill-qa-visual.md
.current/skill-doc-writer.md
.current/skill-release-engineer.md
```

The server's `loadContent()` (`prompts/build.ts`) checks `<workspace>/.current/<filename>` first, falls back to the bundled `content/<filename>`. Per-file granularity — overriding `skill-pm.md` leaves every other role on the shipped default.

Use cases:
- Tighter PM gate for a regulated codebase (extra ambiguity checks).
- Domain-specific QA checklist (e.g. accessibility-mandatory project).
- Custom researcher heuristics (preferred T1 sources for your domain).

**Caveat (same as constitution override)**: skill files cannot soften server-enforced behaviours. e.g. removing the qa-engineer's evidence-of-PASS requirement from `skill-qa-engineer.md` does NOT lift the gate — the server still rejects PASS without `qa_reports/review_<id>.md`. Text-layer overrides are guidance to the agent; the gates are code.

> Since **v3.1.0** (commit `ef65eb2`, 2026-05-12). Same mechanism that introduced `.current/constitution.md` override and `.config.json`.

---

## "Vibe coding" mode (no task list)

If neither `tasks.md` nor `taskPaths` resolves to a real file, the task tools (`tw_add_task`, `tw_complete_task`, `tw_rollback_task`) fail gracefully — they return a structured error, not a crash. **Prompt injection and handoff state still function perfectly.**

Useful when:
- You want the constitution and `handoff.md` discipline, but no formal task tracking yet.
- A workspace's "tasks" live in an external tool (Linear, Jira, GitHub Issues) and you're not ready to mirror them locally.

---

## SessionStart hook gating

The bundled `bin/agent-governance-context.mjs` is a **silent no-op** unless the workspace contains **any of** `.current/`, `tasks.md`, or `TODO.md`. By design — keeps unrelated projects clean.

To opt-in: `mkdir -p .current` (the simplest path). To opt-out: rename `.current/` away.

---

## Env-var overrides

| Var | Purpose |
|---|---|
| `TEAMWORK_SERVER_ROOT` | Override the checkout location used by the SessionStart hook helper. Legacy `SDD_SERVER_ROOT` still honored as fallback. |
| `AGC_DEFAULT_SKILL` | Set to `full` to make `/teamwork` (full coordinator) the default skill in the SessionStart hook. Default: `lite`. |
| `AGC_AUTO_ROUTE` | Set to `0` to disable auto-routing in `/teamwork` (restore the pre-v3.13 manual-routing behaviour where the coordinator surfaces the next role and waits). Default: on. |
| `TW_AUTH_TOKEN` | HTTP mode only — see [docs/http-mode.md](http-mode.md). |
| `TW_ALLOWED_ORIGINS` | HTTP mode only — see [docs/http-mode.md](http-mode.md). |
