# QA Review T420–T424 — Subagent Short Names (`@lite` + `@teamwork`)

## Phase 1 — Spec audit

### Copy / Strings audit (3a)

| string id | spec text | impl site | verdict |
| --- | --- | --- | --- |
| S01 | `name: lite` | `templates/claude-code-agents/lite.md:2` | ✓ verified by frontmatter regression test |
| S02 | `name: teamwork` | `templates/claude-code-agents/teamwork.md:2` | ✓ verified |
| S03 | `model: sonnet` | `templates/claude-code-agents/teamwork.md:3` + matches `content/skill-coordinator.md` recommended_model via tier-mirror test | ✓ verified |
| S04 | `Sonnet-pinned coordinator subagent — runs the agc /teamwork chain orchestrator in a fresh context.` | `templates/claude-code-agents/teamwork.md:4` description | ✓ verbatim |
| S05 | Body of `teamwork.md` instructing Read of `content/skill-coordinator.md` and NOT tw_switch_role | `templates/claude-code-agents/teamwork.md:7` | ✓ verbatim |
| S06 | Migration note: `If you previously installed v3.20.0 templates, run \`rm ~/.claude/agents/coordinator-lite.md\` …` | `README.md` Upgrade note paragraph | ✓ verbatim — locked by new test `v3.21.0 AC4: README surfaces @teamwork and @lite primaries + migration note` |

No drift, no coverage gap.

### Visual Tokens audit (3b)

Spec declares `N/A` — feature is template + docs only. Pass-through.

### Visual Widgets

`N/A | — | feature has no non-primitive widgets`. Pass-through.

## Phase 1.5 — Visual Compare

`design/subagent-short-names.md` does NOT exist. Phase 1.5: skipped (no Visual Baselines declared).

## Phase 2 — Discussion

No correctness, copy, or token issues. No discussion round needed.

## Phase 3 — Tests

### Test File Discovery

`test/subagent-templates.test.mjs` from v3.20.0 was the existing file scoped to subagent templates. Per PM spec AC5 + T424, qa-engineer is the role authorised to update it (Constitution §2). Modified the file in-place:

- `EXPECTED_ROLES`: removed `coordinator-lite`, added `lite` and `teamwork` (now 12 entries).
- `FORBIDDEN_ROLES` constant deleted; the v3.20.0 AC2 "full coordinator template is NOT shipped" test block removed in full (v3.20.0 AC2 reversed per v3.21.0 AC3).
- `ROLE_TO_SKILL` map updated: `lite → skill-coordinator-lite.md`, `teamwork → skill-coordinator.md`.
- `LITE_EXEMPT` Set generalised into a `FILE_PATH_DELEGATES` object mapping `{ lite, teamwork }` to their expected file-path regexes; the body-delegate test enforces each template references the correct skill file.
- New test added: `v3.21.0 AC4: README surfaces @teamwork and @lite primaries + migration note (S06)` — asserts `@teamwork`, `@lite`, and the `rm ~/.claude/agents/coordinator-lite.md` migration command are all present in README.
- Version check renamed from `AC6: package.json + index.ts both at 3.20.0` → `v3.21.0 AC7: package.json + index.ts both at 3.21.0`.

### AC → Test mapping

| AC | Test name(s) in `test/subagent-templates.test.mjs` |
| --- | --- |
| AC1 (rename `coordinator-lite.md` → `lite.md` + frontmatter) | `AC1: templates/claude-code-agents/ contains the expected 12 subagent files` + `AC1: every template carries name / model / description frontmatter` |
| AC2 (NEW `teamwork.md` with name/model/description S01–S04 + body S05) | `AC1: templates/claude-code-agents/ contains the expected 12 subagent files` (membership) + `AC1 contract: each template tier mirrors content/skill-*.md recommended_model` (tier check) + `AC1: every template body delegates …` (body check, with `teamwork` covered by `FILE_PATH_DELEGATES`) |
| AC3 (v3.20.0 AC2 reversal) | Implicit — the FORBIDDEN_ROLES test was removed; `teamwork` is now in EXPECTED_ROLES |
| AC4 (README primary-entry-points + S06 migration note) | `v3.21.0 AC4: README surfaces @teamwork and @lite primaries + migration note (S06)` |
| AC5 (test-suite refresh — this update itself) | Self-referential: the changes above ARE the refresh |
| AC6 (server-side identifiers unchanged) | Negative-coverage via `AC3: skill-coordinator.md §Auto-Routing has Subagent Dispatch sub-bullet` + `AC4: skill-coordinator.md §Auto-Routing documents tw_switch_role fallback` — both files remain readable with the v3.20.0 sub-bullet structure intact, proving `content/skill-coordinator.md` wasn't rewritten. Server-side identifier names verified by direct grep of `content/skill-coordinator-lite.md`, `prompts/coordinator-lite.ts`, `prompts/coordinator.ts` existence in repo — all present (rename was templates-only). |
| AC7 (version 3.20.0 → 3.21.0) | `v3.21.0 AC7: package.json + index.ts both at 3.21.0` |
| AC8 (build + audit clean) | Phase 4 below |

### Coverage gate

10 tests cover all enumerated v3.21.0 ACs. The tier-mirror contract (`AC1 contract: each template tier mirrors content/skill-*.md recommended_model`) is the critical regression guard — any future change to `content/skill-coordinator.md` recommended_model or to `templates/.../teamwork.md` model will fail this test until both are updated in lock-step.

### Security smoke

Templates are static markdown — no execution surface, no user input, no secrets. No new attack surface introduced.

## Phase 4 — Run

### Build

```
> npm run build
check:version — OK (3.21.0)
> tsc            # zero TypeScript errors
```

### Full suite

```
> npm test
1..459
# tests 459
# pass 459
# fail 0
# skipped 0
# todo 0
```

Note: pre-existing `test/teamwork-lite.test.mjs:55` fixed-`setTimeout` flake (documented in v3.20.0 QA review) still exists but did not trigger this run. Not introduced by v3.21.0.

### Dependency audit (AC8)

```
> npm audit --audit-level=high
found 0 vulnerabilities
```

### CI runnability

`npm test` is headless. Confirmed.

## Verdict

**PASS** — T420, T421, T422, T423, T424 complete. AC1–AC8 satisfied; 459/459 tests passing; 0 high/critical vulnerabilities; build zero-error. Server-side identifiers (`coordinator-lite` / `coordinator` skill files, prompts, MCP prompt names, transition tables) verified unchanged; rename is template-layer-only, backwards-compatible at the wire contract.
## 2026-06-01T09:18:27.712Z — PASS — by qa-engineer

PASS v3.21.0 subagent-short-names. lite.md (renamed), teamwork.md (NEW, model:sonnet matches skill), README @teamwork/@lite primaries + S06 migration note, 3.21.0 bump, v3.20.0 AC2 reversed (Dynamic Workflows). Test suite refreshed: 12 templates, FILE_PATH_DELEGATES covers lite+teamwork, FORBIDDEN_ROLES test removed. Suite 459/459, audit 0 vulns, build zero-error. Server-side identifiers untouched. Evidence: qa_reports/review_T420-T424.md.

