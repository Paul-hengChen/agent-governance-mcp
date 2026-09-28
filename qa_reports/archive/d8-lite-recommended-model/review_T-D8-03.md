# Review — T-D8-03 (d8-lite-recommended-model, Round-1 reconciliation)

covers: T-D8-01, T-D8-02, T-D8-03

## Summary

Resumed via Amend-Resume after my own Round-1 QA-FAIL
(`qa_reports/review_T-D8-02.md`). PM amended
`specs/d8-lite-recommended-model.md` with option (b): keep the deliberate
tier divergence between `content/skill-coordinator-lite.md`'s
`recommended_model` (now `sonnet`) and `templates/claude-code-agents/lite.md`'s
`model:` pin (stays `haiku`, has a validating parent — the full coordinator's
`validateWatermark` step), and teach the pre-existing
`test/subagent-templates.test.mjs` tier-mirror test a narrow, dated exemption
for the `lite` row only (new AC8).

This report re-verifies AC1–AC7 independently (not trusting T-D8-01/T-D8-02's
prior results, per repo convention) and implements + verifies AC8.

**Verdict: PASS.** Full suite 1107/1107, build clean, audit clean at
high/critical.

## Phase 0.5 — Expected-Red Diff

No `qa_reports/expected-red_d8-lite-recommended-model.txt` manifest found —
Phase 0.5: skipped (no expected-red manifest declared).

## T-D8-03 implementation (AC8)

Added to `test/subagent-templates.test.mjs` (purely additive — 23 insertions,
0 deletions, confirmed via `git diff --stat`):

- A `MIRROR_EXEMPT_ROLES` map (`{ "lite": "<dated rationale string>" }`)
  immediately above the `"AC1 contract: each template tier mirrors
  content/skill-*.md recommended_model"` test (~line 147), following the
  file's existing `HAIKU_ROLES` / `FILE_PATH_DELEGATES` per-role-exception
  convention. Inline block comment above the map records the dated rationale
  and points back to `specs/d8-lite-recommended-model.md`'s Amendment
  subsection, per AC8(a).
- A `continue` skip inside the existing test's loop when `role in
  MIRROR_EXEMPT_ROLES` — the assertion body (and its per-role failure
  message) is otherwise untouched. This satisfies AC8(b): the loop still
  executes the strict equality assertion for the other 11 roles.

**First attempt (self-caught, not shipped):** I initially also added a
second, new test asserting the exemption's shape and liveness. On reviewing
AC8(c) ("`npm test` (full suite) passes **1107/1107**") I recognized a new
test would push the total to 1108, contradicting AC8's own explicit count
and AC6's "no other line in that file changes" fence beyond the one
exemption edit. Reverted before running the suite — the shipped diff is the
minimal map + skip-continue only.

**Exemption liveness check** (ad hoc, not committed as a test — would have
violated the 1107 constraint above): confirmed out-of-band that
`templates/claude-code-agents/lite.md`'s `model: haiku` and
`content/skill-coordinator-lite.md`'s `recommended_model: sonnet` do
currently differ, so the exemption is load-bearing, not dead code:

```
template model: haiku | skill recommended_model: sonnet | would mismatch without exemption: true
```

## AC-by-AC verification (independent re-verify, all ACs)

- **AC1** (`content/skill-coordinator-lite.md` frontmatter `recommended_model:
  sonnet`, no other line changed) — PASS. `git diff` shows exactly one line
  changed (`haiku` → `sonnet`).
- **AC2** (`docs/skills/coordinator-lite.md` mirror line reads `sonnet`) —
  PASS. `git diff` shows exactly the "**Recommended model (frontmatter):**"
  line changed to `` `sonnet` ``.
- **AC3** (lean-bundle cap `<= 4027` unaffected) — PASS. Isolated
  `node --test test/context-budget.test.mjs`: 54/54 pass, including the
  `AC2: lean always-on bundle ... <= 4027` assertion and the `AC-9`
  `omitConstitution` floor test.
- **AC4** (`test/skill-frontmatter.test.mjs` regression guard) — PASS.
  Isolated run: 10/10 pass.
- **AC5** (full suite + build + audit clean) — PASS this round (was the
  Round-1 FAIL). See Evidence below.
- **AC6** (diff scope fence) — PASS. `git diff --name-only -- \
  templates/claude-code-agents/lite.md content/skill-coordinator.md \
  docs/architecture.md test/eval/scenarios.mjs test/context-budget.test.mjs`
  returns empty — all five confirmed byte-identical to pre-change state.
  `templates/claude-code-agents/lite.md` confirmed still `model: haiku`
  (line 3). `test/subagent-templates.test.mjs` is the one additional
  in-scope file per the amendment, and its diff is purely additive
  (23 insertions / 0 deletions) — the single narrowly-targeted exemption
  edit, nothing else in the file changed.
- **AC7** (`node scripts/measure-context-cost.mjs` runs cleanly) — PASS.
  Output captured below; `skill-coordinator-lite.md` bundle: lean
  (post-strip) 4027 ~tokens, matching AC3's cap exactly.
- **AC8** (exemption contract) — PASS. See T-D8-03 implementation above:
  (a) `MIRROR_EXEMPT_ROLES` map with inline dated rationale comment; (b)
  assertion still runs/fails for the other 11 roles (verified: the loop body
  is unchanged for non-exempt roles, and the map contains only `lite`); (c)
  `npm test` 1107/1107, zero other regressions (see Evidence); (d) `npm run
  build` and `npm audit --audit-level=high` both clean.

## Evidence

- `npm run build`: 0 errors (tsc clean; `check:version` OK at 3.67.1; note
  printed that HEAD is past tag v3.67.1 — release-engineer's concern at
  T-D8-REL, not a QA gate).
- `npm test` (full suite): **1107/1107 pass, 0 fail** — regression from
  Round 1 (`test/subagent-templates.test.mjs:147`) resolved by the
  `MIRROR_EXEMPT_ROLES` exemption; no other test affected.
- `npm audit --audit-level=high`: 0 findings at high/critical (1
  pre-existing low-severity esbuild advisory, non-gating, unchanged from
  Round 1).
- `node --test test/context-budget.test.mjs` (isolated): 54/54 pass.
- `node --test test/skill-frontmatter.test.mjs` (isolated): 10/10 pass.
- `node --test test/subagent-templates.test.mjs` (isolated): 17/17 pass
  (same count as pre-change — confirms the AC8 edit added 0 net tests, only
  extended the existing tier-mirror test's loop body).
- `node scripts/measure-context-cost.mjs` (AC7, full output):
  ```
  ==================================================
  TOTAL always-on (constitution + default skill)
    constitution (raw, composed):   6672 ~tokens
    constitution (rat-strip)    :   6600 ~tokens  (chain-role AC8 floor; −72)
    constitution (non-design)   :  4363 ~tokens  (rat-strip + design-only strip; −2237 vs rat-strip)
    constitution (lite-lean)    :   3096 ~tokens
    skill-coordinator-lite.md  :    929 ~tokens
    bundle raw  (pre-strip)    :   7603 ~tokens
    bundle lean (post-strip)   :   4027 ~tokens
    saved per session          :   3576 ~tokens (47%)
  ==================================================
  ```
- `git diff --name-only` (feature-relevant files):
  `content/skill-coordinator-lite.md`, `docs/skills/coordinator-lite.md`,
  `test/subagent-templates.test.mjs` (plus pre-existing unrelated dirty
  files: `.current/handoff.md`, `tasks.md`, and several `qa_reports/*.md`
  bookkeeping entries from prior/other features — none touched by this
  task).

## Verdict

**PASS.** AC1–AC8 all independently verified. Full suite 1107/1107, build
clean, audit clean at high/critical. T-D8-01, T-D8-02, and T-D8-03 all
complete. Release (T-D8-REL) and backlog done-mark (T-D8-DONE) are the next
steps, owned by release-engineer/pm — no release bookkeeping performed here
per qa-engineer's scope rule.
## 2026-07-11T08:30:19.921Z — PASS — by qa-engineer

PASS — qa_reports/review_T-D8-03.md (covers T-D8-01, T-D8-02, T-D8-03). Round-1 Amend-Resume: PM amended spec (option b, AC8) to add a narrow, dated MIRROR_EXEMPT_ROLES exemption for `lite` in test/subagent-templates.test.mjs's tier-mirror test, reconciling the intentional divergence between skill-coordinator-lite.md's recommended_model=sonnet and templates/claude-code-agents/lite.md's model=haiku. Implemented as a purely-additive edit (23 ins/0 del) — map + skip-continue only, following the file's existing HAIKU_ROLES/FILE_PATH_DELEGATES convention; assertion still runs/fails for the other 11 roles (confirmed exemption is load-bearing, not dead code). AC1-AC8 all independently re-verified. npm run build clean, npm test 1107/1107 (0 fail, regression from Round 1 resolved), npm audit --audit-level=high clean (1 pre-existing low-severity esbuild advisory, unrelated). Ready for release-engineer (T-D8-REL) and pm/coordinator backlog done-mark (T-D8-DONE) — human decision on release timing, no release bookkeeping performed by QA.

