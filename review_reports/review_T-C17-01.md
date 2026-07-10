# Review — T-C17-01, T-C17-02 (c17-dispatch-brief-template)

covers: T-C17-01, T-C17-02

## Summary
- Adds a `**Dispatch Brief Template**` subsection to `content/skill-coordinator.md` §Auto-Routing, inserted after the "Subagent Dispatch (Claude Code)" paragraph and before "Dispatch-time overrides (`dispatch_pins`)" — exactly the spec/task-mandated location.
- The fenced template carries the 5 body invariant lines verbatim (preflight, known-drift, pins, cut-approved, watermark) plus the `**Dispatch Brief Template**` heading label (6 Copy/Strings strings total) and an `Assignment:` per-hop delta placeholder.
- T-C17-02 repoints the "Subagent Dispatch" paragraph's `prompt=` phrasing from the ad-hoc `<one-paragraph brief summarising the upstream pending_notes>` to `<brief composed per the **Dispatch Brief Template** below>`.
- Change is purely additive and scope-confined to `content/skill-coordinator.md` — no `tools/*.ts`, schema, or test-file edits (matches spec Out-of-Scope).
- Verdict: APPROVED.

## Correctness
No findings.
- All six Copy/Strings entries verified byte-for-byte against `specs/c17-dispatch-brief-template.md` lines 79–84: `**Dispatch Brief Template**` (heading label), and the fenced lines `First action: ...`, `Known drift, ignore (do not reconcile): ...`, `Dispatch pins in effect: ...`, `Do NOT set \`cut_approved\` ...`, `Watermark your reply per Constitution §1 ...` — all verbatim, in Copy/Strings order.
- AC2 satisfied (`content/skill-coordinator.md`): framing prose directs quoting the first-class `dispatch_pins` field via `tw_get_state`, and states the `pending_notes` pin convention is retired (C14).
- AC3 satisfied: prose mandates the known-drift line is ALWAYS present, rendering the literal `"none — drift clean"` on a clean check rather than omitting the line.
- AC4 satisfied: prose scopes the `cut_approved` line to inclusion ONLY when the dispatch target's `next_role` is `pm`, omitted for every other role. The line appears in the canonical fenced copy source and is gated by the following prose — an acceptable "full template + conditional note" pattern consistent with AC1 (open with the six lines verbatim) + AC4.
- AC6 anchor phrases all present verbatim and unmoved (`**Subagent Dispatch (Claude Code)**`, `` **Fallback (`tw_switch_role`)**``, `ALLOWED_TRANSITIONS`, `` **Dispatch-time overrides (`dispatch_pins`)**`` — grep count 1 each).
- Retired-token sweep (`test/skill-evolution-v3.11.test.mjs:135`, regex `/next_role:\s*[a-z-]/`, `skill-coordinator.md` in AC7_FILES): NO MATCH against the new content — the added prose uses backtick-wrapped `` `next_role` `` with no trailing colon, so it does not trip the sweep. `resume_of:` / `review:` retired shapes likewise absent.

## Quality
No findings. The subsection label style matches the sibling `**Subagent Dispatch (Claude Code)**` / `` **Fallback (`tw_switch_role`)**`` bullets; the 4-backtick `markdown` fence safely wraps the inline-backtick content and mirrors the existing inline-fenced-template precedent (feature-split template) the spec cites. No dead prose, no duplication, no convention drift.

## Architecture
No architecture spec exists for this feature (content-only, sr-engineer-routed, no architect hop — spec §Dependencies). The change introduces no new handoff field, migration, or `ALLOWED_TRANSITIONS` edge, consistent with spec Out-of-Scope. Single-source-of-truth intent (one canonical brief template) is upheld.

## Security
No findings. No new trust boundary, input parsing, secret, or executable surface — the change is skill-guidance prose only.

## Performance
No findings. Skill-prose addition only; no hot path. The sole runtime cost is the teamwork-bundle token growth (measured ~11815 vs the current `<= 11445` design-arm floor cap in `test/context-budget.test.mjs:847`), which is the qa-owned re-baseline mandated by AC5 (T-C17-03) — recorded in `qa_reports/expected-red_c17-dispatch-brief-template.txt`, not a defect. Expected-red sampling (SOP 4a): the manifest's single entry names test `AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 9545 ~tok)`, located verbatim at `test/context-budget.test.mjs:738` — a real, locatable test. Sr-engineer correctly left the test file unmodified (Constitution §2 Test ownership).

## Verdict
APPROVED — T-C17-01/02 land the six invariant lines verbatim in the mandated location with correct AC2/AC3/AC4 framing prose and the repointed `prompt=` phrase; zero findings in any category, retired-token sweep clean, AC6 anchors intact, and the only red is the legitimate qa-owned token-cap re-baseline (T-C17-03).
