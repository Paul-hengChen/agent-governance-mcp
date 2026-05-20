# QA Review: T42 — README docs for `/teamwork-lite`

> @qa-engineer · 2026-05-20

## AC Verification

| AC | Status | Evidence |
|---|---|---|
| AC6: README introduces `/teamwork-lite` (when to use, what it skips, install unchanged), ≤ 10 lines, adjacent to existing prompts docs | ✅ PASS | [README.md L411](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L411) slash-command bullet; [L420](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L420) lite-vs-full paragraph; [L422](file:///Users/paul.ph.chen/agent-governance-mcp/README.md#L422) stable-name list updated. Single paragraph + 1 list entry — well under 10 lines |

## Correctness Review

- **Placement**: inside "Step 5: Invoke Roles Manually" — directly adjacent to existing prompt listing. Discoverable in the same section a new user would scan when learning about slash commands.
- **Content coverage** (spec requirements):
  - *When to use*: ✅ "solo daily work (1-file edits, doc tweaks, Q&A, one-liner fixes)".
  - *What it skips*: ✅ "drift checks, role switching, multi-role chain".
  - *Install unchanged*: ✅ "Install command and config are unchanged — same `npx` tag covers both".
- **Bonus correctness**: paragraph explicitly states the read-only-from-server constraint and enumerates blocked state-writers (`tw_update_state` / `tw_complete_task`) — matches the actual server contract documented in `tools/transitions.ts`. Prevents users from being surprised by `AGENT_ID_REQUIRED` rejections.
- **Stable-names list updated** (L422): `teamwork-lite` added to the cross-client name list — maintains the doc invariant that this enumerates all stable prompt names.
- **No regression**: the existing 6-entry slash-command list is preserved exactly; the new entry is inserted in logical position (immediately after `teamwork`). Existing alias docs (L418) still apply.

## Phase 3 — Tests

N/A — documentation-only change. No executable surface modified. The integration tests for T41 (`test/teamwork-lite.test.mjs`, 6 tests) continue to cover the underlying prompt-loading behavior. Manual verification of README rendering performed via grep + read.

## Phase 4 — Run

- `npm run build`: ZERO TypeScript errors (no source touched).
- `npm test`: **235/235 pass, 0 skipped.** No regression from doc edit.

## Verdict

**PASS** — AC6 satisfied; T42 closes the spec. Feature `lite-mode-coordinator` is complete (T41 + T42 both PASS, all 6 ACs met).
## 2026-05-20T07:28:51.137Z — PASS — by qa-engineer

T42 PASS — AC6 met. README Step 5 documents /teamwork-lite with when-to-use, what-it-skips, install unchanged, and read-only-server contract. 235/235 tests still pass. Feature lite-mode-coordinator complete: 6/6 ACs met across T41+T42.

