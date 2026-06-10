# Code Review — governance-text-load (F-B)

Tasks reviewed: T-GTL-02, T-GTL-03, T-GTL-04 (descoped skill-only final state).
Reviewer: code-reviewer (opus). Base: working tree vs HEAD (99a0c41).
Co-resident feature F-A (`visual-selfconverge`) excluded from scope per directive.

## Round 1 — APPROVED — by code-reviewer

## Summary

- F-B ships skill-file rationale fencing only. `prompts/build.ts` gains a single
  `stripRationale()` (L70) + a `fullDetail = false` param on `buildPromptForRole`;
  applied to the **skill body only** (L271: `const skill = fullDetail ? rawBody : stripRationale(rawBody)`).
- `content/skill-pm.md` (4 fences) and `content/skill-sr-engineer.md` (3 fences) wrap
  only war-story / "Reason:"/"Rationale:" prose. `scripts/measure-context-cost.mjs`
  gains a reporting-only mirror + a "rationale-stripped" table.
- T-GTL-06/07 (constitution fencing + constitution-strip call-site) are **genuinely
  absent** — the descope is clean, no half-built path remains.
- The `content/constitution.md` diff present in the tree is F-A's single v3.31.0 §1
  "Self-converge relaxation" clause — out of F-B scope, correctly left untouched. AC7 PASS.
- dist/prompts/build.js is in sync with a fresh `tsc`. Version stays 3.30.0 (not bumped);
  new markers tagged v3.31.0. Full suite 595 pass / 0 fail.

Headline verdict: **APPROVED**.

## Correctness

- **stripRationale regex (build.ts:70-75)** — `<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?`
  non-greedy + distinct literal markers → idempotent and no-marker passthrough.
  Verified empirically: `stripRationale(stripRationale(body)) === stripRationale(body)` (true),
  and an un-fenced skill (`skill-architect.md`) passes through byte-identical (true).
- **Composition with stripChainOnly (DR-9)** — order-independent confirmed on the actual
  fenced `constitution.md` and on a synthetic nested chain∘rationale string:
  `stripRationale(stripChainOnly(x)) === stripChainOnly(stripRationale(x))` (true both). In F-B
  the two never co-occur on the same text (constitution is not rationale-fenced; skills carry no
  chain-only fences), so this is a documented-safe capability, not an exercised path.
- **Call-site scope (build.ts:262-271)** — the constitution variable is ONLY
  `LITE_SKILL_FILE ? stripChainOnly(raw) : raw`. There is **no** `chainResolved` intermediate and
  **no** `fullDetail ? ... : stripRationale(constitution)` branch. T-GTL-07 is absent (descope intact).
- **AC9 / lossless** — built a real default-mode prompt for both roles and asserted every rule
  heading/gate survives: pm (Copy / Strings, Visual Tokens, Ambiguity Gate, Resource Audit Gate,
  Question Batch Gate, Scope Decision Gate, Geometric-Density Split Gate) and sr (Scoped Render
  Self-Check, Whole-surface self-converge loop, Security Checklist, "Substituting an HTML primitive"
  scope-violation clause). Clauses immediately adjacent to each removed fence survive intact
  (pm "This gate is **additive**…", sr "Attach/leave the `impl path`…", sr "QA still independently
  verifies every VSA row…"). No word-merge, no dropped characters.
- **AC6 — fence content audit** — all 7 fences are single-line and contain zero
  MUST/STOP/tool-call/numbered-step/table-row/`next_role:` tokens (scanned). Each holds only "why"
  prose. No rule, gate name, or SOP step falls inside any fence.
- **AC3 — full-detail path** — `buildPromptForRole("skill-pm.md", …, true)` retains the rationale
  verbatim ("Select your language", "OobeTheme.kt"); default mode strips it. Confirmed.

## Quality

- Comments on `stripRationale` and the call-site are accurate (DR-2/DR-5, v3.31.0) and match the
  measure-script mirror's DR-2/DR-6 reporting-only note. Good cross-reference hygiene.
- **Minor (non-blocking): double-space seam after inline mid-line strips.** Where a fence sat
  mid-line bounded by a space on each side (pm 2a-bis `…before routing — the same artifact as 2a.
  <fence> This gate…` and sr `…not the whole app**. <fence> Attach/leave…`), removing the fence
  leaves TWO spaces (`…as 2a.  This gate…`). The `[ \t]+\n` cleanup only fixes end-of-line trailing
  space, not a mid-line double space, so these survive. This is purely cosmetic — markdown collapses
  runs of spaces on render and an LLM consuming the prompt is unaffected; no rule text is corrupted
  and no governance is dropped. The architecture note (T-GTL-06 guidance) suggested fencing one
  adjacent space to land on a single space; not done here, but immaterial to correctness. Optional
  tidy for a future pass — not a change request.

## Architecture

- Matches the Round-1 architecture (single `stripRationale`, `fullDetail` trailing param, skill-body
  application, dist rebuild) AND honors Amendment v3's descope: the Round-2 architecture section
  (T-GTL-06/07 constitution stripping) is explicitly NOT implemented, consistent with spec
  Out-of-Scope. The implementation correctly follows the SPEC (the contract) over the stale R2
  architecture design.
- DR-2 single-copy honored: exactly one load-bearing `stripRationale` (build.ts); the measure-script
  copy is reporting-only; bin/ (SessionStart hook) is clean (DR-4/DR-11 hold). AC5 satisfied.
- AC4 lite path untouched: hook never calls `stripRationale`; the 2,600 lite cap is unchanged
  (it pre-dates F-B as F-A's qa-owned bump) and `t-lean-under-target` passes.

## Security

- No new I/O, no user-controlled input, no injection surface. `stripRationale` is a pure string
  transform over repo-owned content files. The fence markers are HTML comments — a renderer that
  ignores them shows full text (safe degradation). No secrets, no boundary changes.

## Performance

- Three linear `String.replace` passes over already-small skill bodies on prompt assembly — same
  complexity class as the pre-existing `stripChainOnly`. No new loops, no I/O, no regression.
  Measured savings: skill-pm −253 ~tok, skill-sr −146 ~tok per dispatch (a net reduction).

## Verdict

**APPROVED** — F-B's skill-only slice is lossless (no rule/gate/SOP-step inside any fence),
dist is in sync, T-GTL-06/07 are cleanly descoped with no residual constitution-strip path, AC7
holds (constitution diff is F-A's, untouched by F-B), AC1/AC2 caps met, version not bumped; the only
finding is a benign cosmetic double-space that drops no governance.
