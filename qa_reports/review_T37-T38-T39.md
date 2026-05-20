# QA Review: T37, T38, T39 — Constitution v3.5.1 Rule Completeness

> @qa-engineer · 2026-05-20

## AC Verification

| AC | Status | Evidence |
|---|---|---|
| AC1: R3 Surgical changes bullet in §1 | ✅ PASS | [constitution.md L16](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L16) — "Surgical changes: Touch only what the task requires. Don't 'improve' adjacent code, comments, or formatting. Clean up only your own mess." |
| AC2: R12 tests sub-clause merged into §7 Fail loud | ✅ PASS | [constitution.md L71](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L71) — `"Tests pass" is wrong if any were skipped.` appended in-line within existing Fail loud bullet |
| AC3: R11 conformance>taste extends §2 Match conventions | ✅ PASS | [constitution.md L24](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L24) — "Conformance > personal taste; if a convention is genuinely harmful, surface it — don't fork silently." appended |
| AC4: Header bumped to v3.5.1 | ✅ PASS | [constitution.md L1](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L1) — `# Constitution v3.5.1` |
| AC5: Net constitution additions ≤ 80 tokens | ✅ PASS | L16 ~32 tok + L24 ext ~26 tok + L71 ext ~14 tok = ~72 tokens |

## Correctness Review

- All 3 gaps traced to original 12-rule source: R3 (Rule 3 Surgical Changes), R11 (Rule 11 Match conventions), R12 (Rule 12 Fail loud tests clause).
- Placement decisions sound:
  - R3 as a new bullet immediately after MVP strict in §1 — keeps "what to do / what not to touch" co-located.
  - R11 extension appended to existing Match conventions bullet — preserves single source of truth for code-style rules.
  - R12 tests clause merged inline into existing Fail loud bullet — avoids §7 bullet bloat.
- No conflict with existing rules; "Surgical changes" complements "MVP strict" (one limits scope of additions, the other limits scope of edits) — distinct enough to justify separate bullets.
- No skill-file changes — consistent with spec's "Out of Scope" decision.
- No package.json / index.ts / CHANGELOG / README touched — consistent with spec's content-only scope.

## Phase 3 — Tests

N/A — content-only markdown changes. No executable code modified. Automated tests not applicable.

## Verdict

**PASS** — 5/5 ACs met, zero conflicts, 72-token footprint within budget.
