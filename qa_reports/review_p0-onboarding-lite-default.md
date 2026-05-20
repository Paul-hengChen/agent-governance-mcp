# QA Review — p0-onboarding-lite-default (T43 / T44 / T45)

> @qa-engineer · 2026-05-20
> Spec: `specs/p0-onboarding-lite-default.md`

## Phase 1 — Code Review

### T43 — `bin/agc-init.mjs`
- Subcommand gate (`sub !== "init"`) routes to a usage banner on stderr; exit codes 1 (no arg) / 2 (wrong arg). Good.
- Idempotency is implemented per-file (`fs.existsSync`), so partial scaffolds (e.g. user already has `tasks.md` but not `.current/`) heal correctly. Confirmed in smoke test.
- `fs.mkdirSync(..., { recursive: true })` handles missing `.current/`. No race window of concern for single-user `init`.
- Templates match the AC spec verbatim (frontmatter fields, section headings, sentinel comments).
- No shell, no eval, no untrusted I/O — security checklist clear.

### T44 — `package.json` bin + README
- `bin.agc` → `./bin/agc-init.mjs`. Three bins now declared; non-conflicting names.
- README quickstart step 2 documents `npx --package=... agc init`. The `--package=` form is necessary because the default bin name is `agent-governance-mcp`; without it, `npx <github>#tag agc init` would invoke the MCP server with `agc init` as args. Correct.

### T45 — Hook lite default + opt-in
- Variant selection: `process.env.AGC_DEFAULT_SKILL === "full" ? full : lite`. Strict equality is fine (any other value, including unset/empty/typo, falls through to lite). Documented in the prose itself.
- Intro prose branches: lite mode states the escalation path (`/teamwork`) and the env var; full mode keeps the previous wording verbatim. No regression for `AGC_DEFAULT_SKILL=full` users.
- `loadContent(skillVariant)` reuses the existing workspace-override-vs-server lookup, so a workspace can still ship its own `.current/skill-coordinator-lite.md` to override the default.

### Risk / Notes
- AC3 specifies `status: "Not_Started"` in the scaffold template, which is **not** in the `tw_update_state` status enum (`In_Progress | PASS | FAIL | Blocked`). This is intentional: the scaffold is read-only state and the first `tw_update_state` write will replace it with a valid value. Verified `parseHandoff` accepts arbitrary string for `status`.
- No `--force` / overwrite flag, per spec Out-of-Scope. Re-init = manual delete.

**Phase 1 verdict: PASS, no Round 1 issues. Proceeding to Phase 3.**

## Phase 3 — Spec-to-Test Map

| AC | Test |
|---|---|
| AC1 happy path | `agc init creates handoff/.config/tasks with expected templates` |
| AC2 idempotent / non-destructive | `agc init leaves existing files byte-for-byte unchanged on re-run` |
| AC3 valid initial state | `agc init scaffold parses via parseHandoff with Not_Started + pm + empty arrays` |
| AC4 npm bin exposure | `package.json bin.agc maps to bin/agc-init.mjs and the file is executable` |
| AC5 lite default | `SessionStart hook without AGC_DEFAULT_SKILL injects skill-coordinator-lite + Coordinator-Lite prose` |
| AC6 full opt-in | `SessionStart hook with AGC_DEFAULT_SKILL=full injects skill-coordinator + Coordinator-mode prose` |
| security smoke (CLI) | `agc with no subcommand exits non-zero and prints usage to stderr` |
| security smoke (hook) | `SessionStart hook in a non-managed workspace exits 0 silently` |

Tests in `test/p0-onboarding-lite-default.test.mjs`. Coverage tooling not configured; each AC has ≥ 1 dedicated test.

## Phase 4 — Run

- `npm run build` → green.
- `npm test` → 235 prior + 8 new = 243 passing, headless.

**Phase 4 verdict: PASS. T43 / T44 / T45 complete.**
