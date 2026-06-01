# QA Review T410–T414 — Claude Code Subagent Dispatch

## Phase 1 — Spec audit

### Copy / Strings audit (3a)

| string id | spec text | impl site | verdict |
| --- | --- | --- | --- |
| S01 | `name: <role>` | YAML key in every `templates/claude-code-agents/<role>.md` | ✓ verified by `every template carries name / model / description frontmatter` regression test (AC1) |
| S02 | `model: <tier>` | YAML key in every template | ✓ verified; enum `(opus|sonnet|haiku)` enforced by test |
| S03 | `description: <one-line>` | YAML key in every template | ✓ verified |
| S04 | "This subagent runs the agc <role> SOP under a pinned model tier. On invocation, call `tw_get_state` then `tw_switch_role(\"<role>\")` and follow the returned SOP exclusively." | each template body (with lite-exempt deviation, see below) | ✓ verified with exemption — see *Spec edge case* |
| S05 | `### Claude Code subagent install (auto model-routing)` | `README.md` heading | ✓ verified by regression test (verbatim match) |
| S06 | `Subagent Dispatch (Claude Code)` | `content/skill-coordinator.md` §Auto-Routing sub-bullet label | ✓ verified by regression test |

**Spec edge case surfaced (not a FAIL — escalation note to PM)**: spec AC1 declares S04 as the universal template body, but `coordinator-lite` cannot delegate via `tw_switch_role` because `tools/transitions.ts` rejects lite mode's `tw_*` writes (Constitution §3 + skill-coordinator-lite hard rules). Sr-engineer correctly authored a lite-specific body that references `content/skill-coordinator-lite.md` directly. This is architecturally correct but spec wording does not call out the exemption explicitly. QA accepted by adding a `LITE_EXEMPT` carve-out to `test/subagent-templates.test.mjs:88-101` with an explanatory comment. **Suggested follow-up**: PM amends spec to acknowledge the lite-mode S04 deviation. Not blocking — sr-engineer's deviation is the right call.

No drift, no coverage gap (no user-facing rendered strings — all six are internal contract strings).

### Visual Tokens audit (3b)

Spec declares `N/A` — feature is server/template/docs only. Pass-through.

### Visual Widgets

Spec declares `N/A | — | feature has no non-primitive widgets`. Pass-through.

## Phase 1.5 — Visual Compare

`design/subagent-dispatch.md` does NOT exist. Phase 1.5: skipped (no Visual Baselines declared).

## Phase 2 — Discussion

No correctness, copy, or token issues that warrant a discussion round. The spec edge case is surfaced as a follow-up note to PM (above), not a FAIL.

## Phase 3 — Tests

### Test File Discovery

No existing test file covered the subagent templates dir or the new §Auto-Routing sub-bullets. Created `test/subagent-templates.test.mjs` with 10 cases.

### AC → Test mapping

| AC | Test name in `test/subagent-templates.test.mjs` |
| --- | --- |
| AC1 (11 templates exist, named correctly) | `AC1: templates/claude-code-agents/ contains the expected 11 subagent files` |
| AC1 (frontmatter keys S01-S03) | `AC1: every template carries name / model / description frontmatter (S01-S03)` |
| AC1 (S04 body delegation) | `AC1: every template body delegates to tw_get_state + tw_switch_role (S04 contract)` (with `LITE_EXEMPT` for coordinator-lite) |
| AC1 (tier mirrors skill recommended_model — regression guard) | `AC1 contract: each template tier mirrors content/skill-*.md recommended_model` |
| AC2 (coordinator full absent) | `AC2: full coordinator template is NOT shipped (recursive-spawn avoidance)` |
| AC3 (Subagent Dispatch sub-bullet + ALLOWED_TRANSITIONS preservation) | `AC3: skill-coordinator.md §Auto-Routing has Subagent Dispatch sub-bullet (S06)` |
| AC4 (Fallback paragraph + backwards-compat note) | `AC4: skill-coordinator.md §Auto-Routing documents tw_switch_role fallback` |
| AC5 (README sub-section heading + content) | `AC5: README adds ### Claude Code subagent install (auto model-routing) sub-section (S05)` |
| AC6 (package.json + index.ts at 3.20.0) | `AC6: package.json + index.ts both at 3.20.0` |
| AC6 (no schema_version bump) | `AC6: no persisted-state schema_version bumped (content-only feature)` |
| AC7 (build + suite green) | covered by `npm test` headless run + Phase 4 below |
| AC8 (npm audit clean) | covered by Phase 4 |

### Coverage gate

10 new tests cover all enumerated ACs; the tier-consistency regression guard (`AC1 contract`) is the critical lock — any future change to `content/skill-<role>.md` recommended_model will fail this test until the corresponding template is updated. No code-coverage tooling configured at the repo level (matches prior conventions); test-by-AC coverage is complete.

### Security smoke

- Templates are static markdown files — no execution surface, no user input, no secrets / API keys / credentials. Static-content security smoke pass-through.
- Subagent body delegates to existing tools (`tw_get_state`, `tw_switch_role`) — both already zod-validated in `index.ts`. No new attack surface.

## Phase 4 — Run

### Build

```
> npm run build
check:version — OK (3.20.0)
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
```

**Flake characterisation** (transparency note — pre-existing, not a Track 1+1.b regression):
`test/teamwork-lite.test.mjs:55` "AC3: ListPromptsRequestSchema response includes 'teamwork-lite'" spawns a child node process and waits a fixed 1200 ms before reading the JSON-RPC response. Under concurrent test-runner load the MCP server boot occasionally exceeds the window. Observed flake rate during T414 QA: ~20 % (1 fail / 5 runs). The failure mode is "no prompts/list response received within timeout", not a logic error. **This flake existed before v3.20.0** — the test file landed with v3.6.0 (`teamwork-lite` introduction) and its `setTimeout(r, 1200)` pattern hasn't changed. T410–T413 introduce no new subprocess spawns and cannot cause this flake. **Recommendation**: file a follow-up to switch the test from fixed `setTimeout` to a deterministic "read until JSON-RPC id 2 lands" loop. Out of scope for this PASS — surfacing here as a known infra issue.

Clean re-runs (≥ 4 of 5) show 459/459 pass. The new 10 subagent-template tests pass on **every** run (no contribution to the flake).

### Dependency audit (AC8)

```
> npm audit --audit-level=high
found 0 vulnerabilities
```

### CI runnability

`npm test` is headless (no human interaction). Confirmed.

## Verdict

**PASS** — T410, T411, T412, T413, T414 complete. AC1–AC8 satisfied; 459/459 tests passing (10 new subagent-template tests); 0 high/critical vulnerabilities; build zero-error.

**Follow-up notes for PM (non-blocking)**:
1. Spec wording for S04 should explicitly acknowledge the coordinator-lite exemption (lite mode is server-read-only → can't call `tw_switch_role` → body delegates by file path instead). Sr-engineer's deviation was correct; spec just needs to catch up.
2. `test/teamwork-lite.test.mjs:55` fixed-`setTimeout` pattern is pre-existing flake; worth a small qa-engineer task in a future cycle to convert to deterministic message-read loop.
## 2026-06-01T08:08:35.424Z — PASS — by qa-engineer

PASS — v3.20.0 subagent-dispatch. 11 templates (coordinator full deliberately absent), tier mirrors content/skill-*.md (regression-guard test locks it), skill-coordinator §Auto-Routing gains Subagent Dispatch + Fallback sub-bullets preserving ALLOWED_TRANSITIONS semantics, README sub-section, version 3.19.1→3.20.0. AC1–AC8 satisfied. Suite 459/459 (10 new), npm audit 0 vulns, build zero-error. Pre-existing teamwork-lite.test.mjs:55 fixed-timeout flake noted (~20% rate, not introduced by this feature). Spec follow-up: amend S04 to acknowledge coordinator-lite lite-mode exemption. Evidence: qa_reports/review_T410-T414.md.

