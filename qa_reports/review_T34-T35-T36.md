# QA Review: T34, T35, T36 — Constitution v3.5.0 Cognitive Discipline

> @qa-engineer · 2026-05-20

## AC Verification

| AC | Status | Evidence |
|---|---|---|
| AC1: §7 Cognitive Discipline exists | ✅ PASS | [constitution.md L64-70](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L64-L70) — 5 bullets present: Think first, Goal-driven, Surface conflicts, Read before write, Fail loud |
| AC2: Version bump to v3.5.0 | ✅ PASS | [constitution.md L1](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L1) — `# Constitution v3.5.0` |
| AC3: R9 in qa-engineer skill | ✅ PASS | [skill-qa-engineer.md L14](file:///Users/paul.ph.chen/agent-governance-mcp/content/skill-qa-engineer.md#L14) — "Tests verify intent" bullet in Hard rules |
| AC4: R11 Match conventions in §2 | ✅ PASS | [constitution.md L23](file:///Users/paul.ph.chen/agent-governance-mcp/content/constitution.md#L23) — "Match conventions" bullet |
| AC5: Token budget ≤ 150 (constitution) / ≤ 30 (skill) | ✅ PASS | §7 = 5 bullets ~95 tokens; §2 addition ~20 tokens; skill addition ~25 tokens |

## Correctness Review

- §7 placed correctly between §6 (Security) and Document Priority — no section numbering conflicts.
- All 5 rules trace directly to research source ([claude-md-12-rule-fusion.md](file:///Users/paul.ph.chen/agent-governance-mcp/research/claude-md-12-rule-fusion.md) recommendation): R1→Think first, R4→Goal-driven, R7→Surface conflicts, R8→Read before write, R12→Fail loud.
- R11 (Match conventions) correctly placed in §2 Dev & Tech Standards as a natural extension of existing style rules.
- R9 (Tests verify intent) correctly placed in qa-engineer Hard rules, not in constitution — appropriate scoping per research open question #3.
- No existing rules contradicted or duplicated. MVP strict (§1) and "Think first" (§7) are complementary, not conflicting.
- No source code changes — content-only, no build/test phase applicable.

## Phase 3 — Tests

N/A — content-only markdown changes. No executable code modified. Automated tests not applicable.

## Verdict

**PASS** — all 5 ACs met, zero conflicts, minimal token footprint.
