# Code Review — T322 (context-budget-reduction)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Implements the architecture's single-source section-strip: `content/constitution.md` §3.1+§4 wrapped in one `<!-- chain-only:start/end -->` fence; `stripChainOnly()` removes it for lite contexts only.
- Three touch points: `prompts/build.ts` (exported `stripChainOnly`, applied when `skillFile === "skill-coordinator-lite.md"`), `bin/agent-governance-context.mjs` (duplicated stripper, applied for the lite SessionStart variant), `scripts/measure-context-cost.mjs` (3rd copy, for reporting).
- Verified lite routing: `prompts/coordinator-lite.ts:7` passes `"skill-coordinator-lite.md"` → stripped; `coordinator.ts` + worker roles keep the full constitution.
- Headline verdict: **APPROVED**. Implementation matches `specs/context-budget-reduction-architecture.md` exactly; one Quality follow-up handed to qa (regex-equivalence test is now mandatory, not optional).
- Same-model-bias caveat: reviewer ran on the same model as the writer — flagging per role guidance; findings below are diff-vs-spec, not reasoning-derived.

## Correctness

- `prompts/build.ts:48` regex `/<!-- chain-only:start -->[\s\S]*?<!-- chain-only:end -->\n?/g` + `\n{3,}→\n\n` — non-greedy, multi-block-safe, idempotent. Traced against the fenced constitution: leaves `…races.\n\n## 5.` cleanly. No off-by-one on blank-line collapse.
- No-marker passthrough is the correct safety default: a workspace `.current/constitution.md` override without fences is returned unchanged (no rule loss). Confirmed `loadContent(..., workspacePath)` override path still flows through `stripChainOnly`.
- Strip scope is correct: only the two provably chain-only sections (§3.1 server-enforced chain, §4 routing chain) are fenced; §1/§2/§5/§6/§7 remain always-on. A lite agent cannot transition the state machine, so the removed content is unreachable for it — no behavioral loss (AC3/AC4 preserved). Chain bundles unchanged.

## Quality

- **`stripChainOnly` now has 3 copies** (`build.ts` exported, `bin` hook, `measure` script). The build.ts↔hook split is justified (TS→dist vs npx-standalone `.mjs` module boundary, per DR-3). The measure-script copy is a dev-only convenience and could import the dist export, but dependency-free intent makes the local copy defensible. **Finding (non-blocking):** DR-3's regex-equivalence test is now **required**, covering all 3 copies — without it the copies can drift silently. Handed to qa T323.
- Comments are accurate and cross-reference the architecture DR. Naming (`rawConstitution`/`LITE_SKILL_FILE`) is clear and matches surrounding style.
- No dead code, no convention drift.

## Architecture

- Conforms 1:1 to `specs/context-budget-reduction-architecture.md` (Affected Files, Interface Contracts, strip-lite-only decision). No contradiction. Stable-prefix ordering (constitution+skill prefix, volatile state suffix) is preserved in both paths — the #1-aiding property the architecture noted is intact.

## Security

- Regex operates on trusted first-party content (`constitution.md`). No user-input boundary, no injection vector, no secrets. `[\s\S]*?` is non-greedy with literal anchors → no ReDoS / catastrophic-backtracking risk.

## Performance

- Runs once per prompt build / session start; two linear regex passes over ~10 KB. Negligible; no regression vs base (base did a plain file read — this adds a bounded transform).

## Verdict

**APPROVED** — implementation is correct, secure, and matches the architecture; the only follow-up (regex-equivalence test across the 3 stripper copies) is qa-scope, not a code defect.
