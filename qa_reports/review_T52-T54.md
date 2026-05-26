# QA Review: T52+T53+T54 — qa-visual-skill-split (v3.8.3)

> @qa-engineer · 2026-05-26
> Spec: `specs/qa-visual-skill-split.md`
> Tasks: T52 (create skill-qa-visual.md), T53 (trim skill-qa-engineer.md), T54 (v3.8.3 bump + build)

## Scope

Token-efficiency follow-up to v3.8.2: extract the inline Phase 1.5 SOP block from `skill-qa-engineer.md` into a new `skill-qa-visual.md` that qa-engineer Reads on demand. Markdown-only reorganisation; no TS, no server / prompt-builder changes.

## Phase 1 — Review

### AC traceability

| AC | Requirement | Evidence | Verdict |
|----|-------------|----------|---------|
| AC-1 | `skill-qa-visual.md` carries Phase 1.5 contract (skip-if-absent gating, per-row contract, 6 diff categories, 3 failure routes, PASS sub-verdict) | `content/skill-qa-visual.md:3` (lazy-load contract), `:9-10` (Read both + 6 categories i-vi), `:13-15` (3 failure routes drift/missing baseline/missing impl), `:17` (PASS sub-verdict) | ✅ PASS (see note below) |
| AC-2 | Inline Phase 1.5 block removed from `skill-qa-engineer.md` | `content/skill-qa-engineer.md:41-43` — now a 3-line lazy-load hook; the 12-line v3.8.2 inline block is gone | ✅ PASS |
| AC-3 | Lazy-load contract: skip when absent, Read when present | `content/skill-qa-engineer.md:42` (Absent → skip log + proceed + "Do NOT Read"), `:43` (Present → Read sub-skill) | ✅ PASS |
| AC-4 | SOP step numbering 1..7 stable; Phase N labels preserved | Step numbering verified by `t-step-numbering-stability` (sequential 1..7, no duplicates); Phase 1/2/3/4 labels still appear in steps 3, 5, 6, 7 respectively | ✅ PASS |
| AC-5 | `skill-qa-engineer.md` shrinks ≥ 1200 bytes; `skill-qa-visual.md` ≤ 2400 bytes | `wc -c`: qa-engineer 8660 → 7001 (−1659 bytes, ~414 tokens); qa-visual 1779 bytes | ✅ PASS |
| AC-6 | v3.8.2 audits keep working — Phase 1.5 protocol identical | `content/skill-qa-visual.md` carries the exact same Read+diff+routing contract as v3.8.2; only the file location changed. No behaviour change for a v3.8.2 audit with Visual Baselines | ✅ PASS |
| AC-7 | Zero compile/type errors | `npm run build` clean (verified by `t-version-coherence`); `dist/index.js:131` carries `version: "3.8.3"` | ✅ PASS |

### AC-1 finding (PASS with note)

Spec wording: "*MUST carry (a) the skip-if-absent gating logic*". The literal *gate-check* (read `design/<feature>.md`, branch on absence) lives in `skill-qa-engineer.md:41-43`'s hook, NOT in `skill-qa-visual.md`. The sub-skill's L3 preamble documents the contract ("Lazy-loaded by `skill-qa-engineer` SOP step 4 when `design/<feature>.md` declares `## Visual Baselines`") but doesn't re-implement the branching.

This is correct factoring — the gate must run *before* the file is loaded (otherwise non-UI features still pay the load cost), so it cannot live inside the sub-skill. The spec wording was imprecise; the intent (preserve the skip-if-absent semantic) is fully honoured by the qa-engineer hook + the sub-skill's self-documenting header. PASS.

### Copy Audit Gate

Spec Copy / Strings table contains 2 `authored-here` rows. `sop.qa.phase15.lazy-load`: spec quotes a 1-line description; implementation expanded it to a 3-line hook with explicit Absent / Present branches. Semantically equivalent; same documentation-trace precedent as v3.8.1 / v3.8.2. `sop.qa-visual.header`: spec marked as "verbatim transplant — see file after T52"; the file exists and carries the v3.8.2 contract with prose tightened (six categories preserved by name; parenthetical clarifications removed in the trim). PASS.

### Visual Audit Gate

Spec records `Visual Tokens: N/A — markdown only.` ✅ N/A confirmed.

### Security checklist

- No code path added or modified.
- The new `Read` instruction in `skill-qa-engineer.md:43` targets a static, in-repo path (`content/skill-qa-visual.md`) — no user-controlled path component. No path-traversal surface.
- No secrets, no input handling.
- ✅ N/A confirmed.

### Convention adherence

- README new `#### (j)` section follows alphabetic ordering; prior `(j)` renumbered to `(k)`.
- CHANGELOG entry uses the established `### Changed` / `### Backwards-compatible` / `### Notes` shape.
- Version literals updated in lockstep: `package.json`, `index.ts`, `dist/index.js`, CHANGELOG.
- Sub-skill file naming matches `skill-<role>.md` convention; consistent with `skill-coordinator-lite.md` precedent for derived/specialized skills.

### Stale-pin tests (regression from v3.8.2 test file)

Running the suite before adding new tests surfaced 4 expected failures in `test/pixel-perfect-visual-compare.test.mjs`:
- **t3, t4, t5** asserted Phase 1.5 content lived in `skill-qa-engineer.md`. After T53 it lives in `skill-qa-visual.md`. **Action**: rewrite these three tests to assert the lazy-load hook in qa-engineer AND the moved content in qa-visual.
- **t7** pinned `package.json` to 3.8.2. **Action**: relax to history-preservation (assert `[3.8.2]` CHANGELOG entry exists), matching the v3.8.2 fix applied to the v3.8.1 test (same pattern: every release's t-version-coherence test owns *its own* current-version pin, and prior tests become history-preservation guards).

Both adjustments are the same class of fix shipped in v3.8.2 and are part of the standard release cadence for SOP-located-content tests. Documented here so the precedent is explicit.

### Drift acknowledgement

`tw_detect_drift` reports 51 historic completed tasks (T01–T51) in `tasks.md` not in handoff `completed_tasks`. Pre-existing prior-session accumulation, **not caused by this feature**. Out of scope; left unchanged.

## Phase 1 verdict

**PASS** — proceeding to Phase 3 (no Phase 2 round required).

## Phase 1.5 — Visual Compare

`design/qa-visual-skill-split.md` does not exist (internal MCP server work, no design source). `Phase 1.5: skipped (no Visual Baselines declared)` — proceeded directly to Phase 3, per the AC-3 Absent branch. Dogfood evidence that AC-3 works.

## Phase 3 — Tests

### Spec-to-test map

| AC | Test |
|----|------|
| AC-1 | `t1_qa_visual_skill_carries_phase15_contract` |
| AC-2 | `t2_inline_phase15_removed_from_qa_engineer` |
| AC-3 | `t3_lazy_load_hook_skip_when_absent` |
| AC-4 | `t4_sop_step_numbering_stable` |
| AC-5 | `t5_token_savings_within_thresholds` |
| AC-6 | `t6_phase15_contract_preserved_verbatim` |
| AC-7 | `t7_version_coherence_383` |

Plus updates to `test/pixel-perfect-visual-compare.test.mjs` t3, t4, t5, t7 to follow the file relocation (Phase 1.5 contract → qa-visual.md) and version relaxation (3.8.2 → history-preservation).

### Coverage

Markdown-only feature; no pure logic. Tests are integration-level on the I/O boundary `prompts/build.ts` reads. The AC→test map above is the coverage record.

### Security smoke tests

N/A — no input boundary added.

### Test artifact

`test/qa-visual-skill-split.test.mjs` — 7 new tests (AC-1..AC-7) + updates to 4 existing tests in `pixel-perfect-visual-compare.test.mjs`.

## Phase 4 — Run

- Existing 262 tests (post v3.8.2): 4 stale, updated in this round.
- New 7 tests: all PASS.
- Updated 4 tests: all PASS.
- Build: ZERO `tsc` errors.
- `scripts/check-version.mjs`: OK at 3.8.3.
- CI runnability: `npm test` headless.

## Final verdict

**PASS** all three tasks (T52, T53, T54).
