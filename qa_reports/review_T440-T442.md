# QA Review: T440 / T441 / T442 — subagent-watermark-haiku-compliance (v3.21.2)

**Reviewer**: qa-engineer  
**Date**: 2026-06-01  
**Feature**: subagent-watermark-haiku-compliance  
**Spec**: specs/subagent-watermark-haiku-compliance.md  
**Round**: 0 (first-pass PASS — no discussion rounds required)

---

## Phase 0 — Pre-flight

- `tw_get_state`: active_feature=subagent-watermark-haiku-compliance, status=In_Progress, last_agent=qa-engineer
- `tw_detect_drift`: accumulated prior-session drift (T01–T432 in task list not in handoff) — benign, pre-existing. T440/T441/T442 shown as incomplete in task list (correct — that's what QA will flip).
- Spec read: specs/subagent-watermark-haiku-compliance.md
- Code-reviewer approval confirmed in pending_notes: "review: APPROVED"

---

## Phase 1 — Review

### Copy Audit Gate (spec §Copy / Strings)

| string id | spec text | file:line | result |
|---|---|---|---|
| watermark.reminder.critical | `CRITICAL: End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).` | All 12 templates line 7 | PASS — name+tier substituted verbatim per frontmatter |
| watermark.example.lite | `Example reply suffix: … — @lite (haiku)` | lite.md line 11 | PASS |
| watermark.example.doc-writer | `Example reply suffix: … — @doc-writer (haiku)` | doc-writer.md line 11 | PASS |
| watermark.example.release-engineer | `Example reply suffix: … — @release-engineer (haiku)` | release-engineer.md line 11 | PASS |

No user-facing strings found in implementation that are absent from spec Copy/Strings table. Copy Audit Gate: PASS.

### Visual Tokens Gate

Spec §Visual Tokens: `N/A — feature has no visual literals`. Gate: skipped (N/A).

### Phase 1.5 — Visual Compare

No `design/subagent-watermark-haiku-compliance.md` exists. No Visual Baselines declared. Phase 1.5: skipped (no Visual Baselines declared).

### AC Verification

**AC1** — First non-blank body line of every template is the CRITICAL: watermark reminder with correct name+tier substitution.

Verified by shell inspection of all 12 templates:
```
architect:        CRITICAL: End every reply with `— @architect (opus)` per Constitution §1 (watermark).
code-reviewer:    CRITICAL: End every reply with `— @code-reviewer (opus)` per Constitution §1 (watermark).
design-auditor:   CRITICAL: End every reply with `— @design-auditor (opus)` per Constitution §1 (watermark).
doc-writer:       CRITICAL: End every reply with `— @doc-writer (haiku)` per Constitution §1 (watermark).
lite:             CRITICAL: End every reply with `— @lite (haiku)` per Constitution §1 (watermark).
pm:               CRITICAL: End every reply with `— @pm (sonnet)` per Constitution §1 (watermark).
qa-engineer:      CRITICAL: End every reply with `— @qa-engineer (sonnet)` per Constitution §1 (watermark).
qa-visual:        CRITICAL: End every reply with `— @qa-visual (sonnet)` per Constitution §1 (watermark).
release-engineer: CRITICAL: End every reply with `— @release-engineer (haiku)` per Constitution §1 (watermark).
researcher:       CRITICAL: End every reply with `— @researcher (opus)` per Constitution §1 (watermark).
sr-engineer:      CRITICAL: End every reply with `— @sr-engineer (opus)` per Constitution §1 (watermark).
teamwork:         CRITICAL: End every reply with `— @teamwork (sonnet)` per Constitution §1 (watermark).
```
Result: PASS

**AC2** — Haiku-tier templates (lite, doc-writer, release-engineer) each contain `Example reply suffix: … — @<name> (haiku)` preceded by a blank line at file end.

Verified:
- lite.md line 10 (blank), line 11 `Example reply suffix: … — @lite (haiku)` — PASS
- doc-writer.md line 10 (blank), line 11 `Example reply suffix: … — @doc-writer (haiku)` — PASS
- release-engineer.md line 10 (blank), line 11 `Example reply suffix: … — @release-engineer (haiku)` — PASS

Result: PASS

**AC3** — `npm test` runs test/subagent-templates.test.mjs with assertions for AC1 (CRITICAL: first body line) and AC2 (haiku example suffix). Suite fails if either condition missing.

New tests added in this QA round (see Phase 3 below). All 464 tests pass. Result: PASS

**AC4** — Version pin update: prior test `v3.21.1 AC4: package.json + index.ts both at 3.21.1` rewritten to `v3.21.2 AC4: package.json + index.ts both at 3.21.2`. Both versions confirmed at 3.21.2. Result: PASS

**AC5** — package.json: `"version": "3.21.2"`, index.ts: `name: "agent-governance-mcp", version: "3.21.2"`. Result: PASS (verified by prior QA round, confirmed unchanged).

**AC6** — Live @lite dispatch. Templates deployed to `~/.claude/agents/` via `cp` before testing. Three invocations using the installed system prompt body with `claude --system-prompt`:

| # | prompt | last line of reply | watermark present |
|---|---|---|---|
| 1 | `hi` | `— @lite (haiku)` | YES |
| 2 | `what is 2+2` | `— @lite (haiku)` | YES |
| 3 | `list three colors` | `— @lite (haiku)` | YES |

3/3 invocations carry `— @lite (haiku)` as last line. Result: PASS

---

## Phase 2 — Discussion

No issues found in Phase 1. Phase 2 skipped.

---

## Phase 3 — Tests

### Test file modified

`/Users/paul.ph.chen/agent-governance-mcp/test/subagent-templates.test.mjs`

### AC → Test mapping

| AC | Test name | Contract |
|---|---|---|
| AC1 (v3.21.2) | `v3.21.2 AC1: every template body's FIRST non-blank line is the CRITICAL: watermark reminder` | First non-blank body line must equal the CRITICAL: string with substituted name+tier |
| AC2 (v3.21.2) | `v3.21.2 AC2: haiku templates each contain an example reply suffix line preceded by a blank line` | Example line present and preceded by blank line in lite/doc-writer/release-engineer |
| AC2 scope guard | `v3.21.2 AC2: non-haiku templates do NOT contain an example reply suffix line` | Out-of-scope guard — non-haiku templates must not drift toward adding example block |
| AC4 (v3.21.2) | `v3.21.2 AC4: package.json + index.ts both at 3.21.2` | Both version pins at 3.21.2 (rewritten from 3.21.1) |

### Run result

```
# tests 464
# pass  464
# fail  0
```

Zero errors. Build clean (tsc, check:version). Coverage gate: test file has direct line coverage of the body-parsing and frontmatter-extraction paths exercised by every new assertion.

---

## Phase 4 — Verdict

**PASS**

All 6 ACs verified. 464/464 tests green. AC6 live dispatch 3/3 watermark-present. No copy drift, no visual tokens, no schema_version bump required.
