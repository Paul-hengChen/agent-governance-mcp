# Review — constitution-conditional-load

Task id: `constitution-conditional-load` (feature tracked by handoff `active_feature`; no per-task T-id in tasks.md). Base: working-tree diff vs HEAD `2a63256`. Reviewer ran clean-context against `specs/constitution-conditional-load.md` + the diff; sr-engineer pending_notes were NOT used to form the verdict.

## Round 1 — APPROVED — by code-reviewer

## Summary

- Adds a third, **feature-conditional** strip axis (`stripDesignOnly`) to `prompts/build.ts`, siblings to the static `stripChainOnly` / `stripRationale`. Strips the visual-governance span on non-design dispatches; loads it unchanged on design-armed features.
- Inserts exactly **3 marker-comment fence pairs** (6 lines) into `content/constitution.md` — zero rule-text edits, R10 not relocated.
- Reuses the SAME server-gate arm helper (`hasDesignModeRequiringVisual`) so the gate and the constitution text cannot diverge by construction (HC1/HC3).
- Reporting-only mirror added to `scripts/measure-context-cost.mjs`; dist rebuilt.
- Scope: 3 source files + dist only. No test edits, no package.json/index.ts bump. Verdict: **APPROVED**.

## Correctness

- **HC1 / arm-signal agreement (the load-bearing check) — PASS.** `prompts/build.ts:297` computes `isDesignFeature = state?.active_feature ? hasDesignModeRequiringVisual(workspacePath, state.active_feature).required : false`. The imported helper at `tools/evidence-file.ts:155` is the EXACT same symbol the server PASS gates call at `index.ts:747` (scope-decision gate, keys off `arm.required`) and `index.ts:816,820` (`VISUAL_BASELINES_REQUIRED` gate, keys off `armCheck.required`). Same `(workspacePath, activeFeature)` signature, same `.required` field, same `designFilePath()` path derivation. The probe therefore fires on exactly the condition the server gates fire on; the design-only text is present iff the gates can fire. Cannot drift out of sync.
- **AC3 safe-default — PASS.** No state / no `active_feature` → `false` → strip. Design file present but mode unparseable → `parseDesignMode` returns `null` → `required = (null !== null && …)` = `false` → strip. `tools/evidence-file.ts:160-172` returns `{required:false}` on absent file and on any fs throw (`catch`), so the new I/O never throws into `buildPromptForRole`. Matches AC3 verbatim.
- **HC2 byte-unchanged — PASS.** `git diff content/constitution.md` shows ONLY 6 inserted `<!-- design-only:start/end -->` lines; no surviving rule reworded; R10 not moved.
- **Empirical composition (AC5/HC5) — PASS.** Ran all 6 permutations of {chainOnly, rationale, designOnly} over the live constitution: output byte-identical across all orders, zero orphan markers in every permutation. Regex `[\s\S]*?` is non-greedy; the `design-only` marker is distinct from `chain-only`/`rationale`; design-only fences nest cleanly inside chain-only and are disjoint from rationale fences (§1/§7).
- **Test suite — 606 pass / 2 fail, as expected.** The two failures are ONLY `test/context-budget.test.mjs:328` (AC8 rationale-stripped ≤4161) and `:350` (AC8 teamwork bundle ≤7626). They are the qa-owned floor assertions the +6 marker lines (~+39 tok, 4161→~4200) legitimately bump. Markers are load-bearing fence delimiters, not rule text. NOT a code-review blocker — this is qa's rebaseline step. Nothing else regressed.

## Quality

- `stripDesignOnly` (`prompts/build.ts:88-91`) is a faithful sibling of the existing two strip helpers — same shape, non-greedy regex, blank-line collapse, idempotent. No `any`. Comment block accurately states HC3/HC5 rationale.
- State read reorder (`prompts/build.ts:280-289`) moves the `getActiveStorage().parse()` + try/catch above constitution resolution and **removes** the old duplicate block (the deleted `let state` at the former position is gone — verified in diff). The end-of-function `stateBlock` consumes the same `state`; return shape, lite path, and fullDetail path are all preserved. Try/catch degrades a parse failure to "no state" → non-design strip default, consistent with AC3.
- `scripts/measure-context-cost.mjs` change is reporting-only (a `stripDesignOnly` mirror + one non-design row); regex byte-identical to build.ts; feeds no live prompt path.

## Architecture

- Conforms to the spec's Gatable-span definition and the build-mechanism sketch (§Proposed build.ts Mechanism): new fence (a), reordered state read (b), net-new design-arm probe via the existing server helper (c), new strip branch composed order-independently (d). Three fences exactly as the spec's "cleanly-fenceable spans": Fence1 (L47–L50) wraps §3.1 visual-evidence + report-schema bullets; Fence2 (L54–L57) wraps visual_round + split-escalation; Fence3 (L62–L91) wraps §3.2 header through "No global-frame metric", ending **before** R10 (L92). G3 satisfied via fence-end-before-R10 (no relocation needed).
- **HC4 anti-sweep — PASS (empirically confirmed).** Design-stripped constitution still contains: §3.1 scope-decision gate (v3.30.0), code-reviewer-approval bullet, 3-code-reviewer-FAIL breaker, the generic "On rejection the server returns…" guidance, §3.2 R10 (sequential-context/reconcile), the §4 routing diagram, and §4 qa/review-round + visual prose. No fence swallows L51 (scope-decision) or R10.
- **§4 visual prose + §1 L16/L17/L19 correctly DEFERRED** (Gap G2 / Out-of-Scope) — still present on both arms, not fenced. Matches the spec's "safe default: gate only cleanly-fenceable spans."

## Security

- No new injection vector, no secret, no unvalidated boundary. The net-new read is a single sync `fs` read of `design/<active_feature>.md` via the hardened, never-throwing server helper. `active_feature` is governance-internal state, not user-tainted input. No path traversal introduced (path derived by the existing `designFilePath`).

## Performance

- One added cheap sync `fs.existsSync` + `readFileSync` per dispatch (same shape as `loadContent`); `buildPromptForRole` stays synchronous. State parse was moved earlier but NOT duplicated — same number of parses as before (the old block was deleted). No O(n²), no unbatched loop, no new allocation in a hot path. No regression vs base. The new axis trims ~1187 ~tok off non-design chain dispatches (constitution 4200→3013 rationale+design-stripped, by the script's own figure) — a budget win, zero cost on design features.

## Verdict

**APPROVED** — HC1/HC2/HC3/HC4/HC5 all verified (arm-signal agreement is identity-by-construction with the server gates; rule text byte-unchanged; anti-sweep carve-outs survive both arms; 6-permutation composition is order-independent with zero orphan markers). The only test failures are the two qa-owned AC8 floor assertions, which are this feature's expected rebaseline, not defects.
