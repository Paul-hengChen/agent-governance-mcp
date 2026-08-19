# QA Review — T-E75-02 (covers: T-E75-01, T-E75-02)

Feature: `e75-rationale-fence-relocation` (docs/backlog.md row `8i`, order row 232) — mini-chain (sr-engineer → code-reviewer → qa-engineer; PM/architect skipped, the backlog row is the spec).

Round 1. Verdict: **PASS**.

## Scope recap

T-E75-01 (sr-engineer) relocated the 4 asymmetric `<!-- rationale:start -->` fences the E69 ratchet in `test/render-structure.test.mjs` pinned as tracked debt: `content/skill-pm.md:25`, `:26`; `content/skill-architect.md:30`; `content/skill-qa-engineer.md:36`. Newline/whitespace only — code-reviewer independently verified prose byte-identity (`review_reports/review_T-E75-01.md`, APPROVED round 1, zero findings).

T-E75-02 (this task, qa-owned per Constitution §2) pays down the ratchet in `test/render-structure.test.mjs` that T-E75-01 deliberately left red.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e75-rationale-fence-relocation.txt`, 3 entries, all in `test/render-structure.test.mjs`:

1. `structural sweep: every content/{skill-,const-,coord-}*.md fragment has zero UNTRACKED asymmetric rationale spans`
2. `cross-SOP render sweep (tw_switch_role): glue-finding counts match the tracked debt list exactly, for every role`
3. `cross-SOP render sweep (buildPromptForRole): glue-finding counts match the tracked debt list exactly, for every role`

Ran the full suite BEFORE any re-baseline edit: 1742 tests, 1739 pass, 3 fail — the exact 3 above (confirmed by name, not just count), no fourth red.

**Phase 0.5: clean (3/3 manifest entries confirmed red, 0 unexplained reds).**

## Phase 1 — Review

No `specs/e75-rationale-fence-relocation.md` and no `design/e75-rationale-fence-relocation.md` exist — mini-chain, the backlog row (docs/backlog.md:198, order row 232) is the spec, matching precedent (E69, E71, E76, E78). Copy Audit Gate and Visual Audit Gate: N/A — this is a test-infra/prose-relocation fix with no user-facing copy or visual tokens; the backlog row carries no *Copy/Strings* or *Visual Tokens* H2 to audit against. Phase 1.5 (Visual Compare): skipped — no `## Visual Baselines` H2 anywhere for this feature.

Reviewed the content/ diff (T-E75-01, already code-reviewer-APPROVED — not re-litigated) and the ratchet mechanics in `test/render-structure.test.mjs`. Confirmed via `git diff --stat -- content/ prompts/text-transforms.ts`: only the 3 content/ files sr-engineer touched (skill-pm.md, skill-architect.md, skill-qa-engineer.md); `prompts/text-transforms.ts` untouched — the fix under test was not re-repaired by me, per task constraint.

### Spec-to-Test map (backlog row 198 is the spec)

| Backlog AC | Test |
|---|---|
| 4 fences relocated, prose byte-identical | `review_T-E75-01.md` (code-reviewer, positional signature check) — not re-tested here, out of QA's scope per SOP (correctness/architecture owned by code-reviewer) |
| Ratchet decremented to reflect zero remaining tracked debt | `structural sweep: ... zero UNTRACKED asymmetric rationale spans` (`KNOWN_ASYMMETRIC_SPAN_COUNTS = {}`) |
| Class-wide render sweep reflects the same zero, both render paths, all 9 roles | `cross-SOP render sweep (tw_switch_role)` / `(buildPromptForRole)` (`EXPECTED_RENDER_GLUE_COUNTS` pm/qa-engineer/architect → 0) |
| Comment accuracy (no stale "live debt" claims) | manual read of the rewritten header note (`test/render-structure.test.mjs:55-66`) and the "KNOWN, TRACKED debt" block (`test/render-structure.test.mjs:242-258`) |

## Test edit performed (T-E75-02 deliverable)

All in `test/render-structure.test.mjs`, no other file touched (verified: `git diff --stat` shows only this one file under `test/`, plus the pre-existing untouched `content/` diff from T-E75-01):

1. `KNOWN_ASYMMETRIC_SPAN_COUNTS` → `{}` (was `{"skill-pm.md":2,"skill-qa-engineer.md":1,"skill-architect.md":1}`).
2. `EXPECTED_RENDER_GLUE_COUNTS` → `pm`, `qa-engineer`, `architect` all set to `0` (every role now `0`).
3. Rewrote the file-header note (was lines ~55-66) and the "KNOWN, TRACKED debt" comment block (was lines ~242-252) to read as closed history: both now say the 4 sites were tracked debt, name the escalation (`qa_reports/review_T-E69-02.md`), state that E75/T-E75-01 paid it down to zero (citing `review_reports/review_T-E75-01.md` and this review), and describe the emptied ratchet as a *strictly stronger* zero-tolerance guard rather than a removed one. No sentence in either block still asserts live/current debt.
4. **Ratchet judgment (task item 4)**: the emptied ratchet still earns its keep, and is now a *stronger* assertion than before. Pre-fix, `KNOWN_ASYMMETRIC_SPAN_COUNTS` was an allowlist tolerating exactly 4 named sites — a 5th site anywhere would red it, but the 4 named ones were licensed debt. Post-fix, `{}` tolerates zero: any asymmetric span appearing anywhere in `content/{skill-,const-,coord-}*.md`, in any file, old or new, reds the suite immediately. This is a case where "emptying" a ratchet does not neuter it — the assertion shape (`assert.deepEqual(actual, ALLOWLIST)`) is identical whether the allowlist has 4 entries or 0; going to 0 only removes tolerance, it doesn't remove the check. Recommend keeping it exactly as-is (no removal, no downgrade to a `>= 0` sanity check).
5. **Fail-fast concern (carried forward from code-reviewer)**: verified directly — before my edit, `cross-SOP render sweep (tw_switch_role)` failed on `switchRole("pm")` (first key in `ROLE_TO_SKILLFILE`) with `0 !== 2`, throwing before the loop reached `architect` or `qa-engineer` in that run (code-reviewer had verified those two by hand, separately, for exactly this reason — noted in their pending_notes). Rather than leave the fail-fast shape in place now that the debt is paid, I converted both `cross-SOP render sweep` tests (`tw_switch_role` and `buildPromptForRole`) from a per-iteration `assert.equal` inside the loop to **collect-then-assert**: build the full `{role: count}` map across all 9 roles first, then a single `assert.deepEqual` against `EXPECTED_RENDER_GLUE_COUNTS` at the end. This mirrors the pattern the structural sweep test already uses one section above it in the same file (`actual` object built in a loop, one `assert.deepEqual` at the end) — so it's consistent with existing style, not a new pattern. Judgment: this is a **genuine improvement, not churn** — it's a ~10-line, mechanical, low-risk change (no new dependencies, no new detector logic) that directly closes the diagnostic gap code-reviewer flagged: a future regression in any role now reports ALL roles' actual vs. expected in one `assert.deepEqual` diff, rather than only the alphabetically/insertion-order-first mismatching role while masking the rest. Re-ran after the edit: both tests pass, 9/9 roles asserted in a single collected pass (confirmed by reading the code path — `actual` is fully populated across all `Object.keys(ROLE_TO_SKILLFILE)` before the one assertion runs, so a partial run can no longer hide a later role).

## Phase 3 — Tests

No new test file created (task constraint: only qa-engineer edits `test/`; this modifies the existing `test/render-structure.test.mjs`, which needs no separate permission per Constitution §2's "modifies an existing test file" carve-out). No genuinely new test file was warranted — the existing ratchet + render-sweep tests are the correct, already-designed mechanism for this class of regression; nothing about T-E75-02 calls for new test infrastructure.

Security smoke tests / boundary inputs: N/A — this task is a test-fixture edit (a set of pinned expectation maps and comments), not new production logic; there is no new input surface to fuzz.

Phase 3.5 (AC Execution Log): skipped — no `specs/e75-rationale-fence-relocation.md` exists, so no `proof:`-annotated ACs to execute.

## Phase 4 — Run

- **Build**: `npm run build` — clean. `check:version` OK (3.102.3, note: HEAD past tag, expected pre-release-engineer). `tsc` clean. `check:transitions-sync` OK (21 keys).
- **`npm audit --audit-level=high`**: 5 findings (`@hono/node-server`, `body-parser`, `esbuild`, `hono`, `protobufjs`), all moderate/low, **zero HIGH/CRITICAL** — identical finding set to sr-engineer's T-E75-01 report, no new advisory, no `docs/dependency-advisories.md` entry owed per §6.
- **`npm test` (full suite, headless, zero interaction)**: `node --test test/*.test.mjs` → **1742 tests, 1742 pass, 0 fail, 0 skipped.** (Pre-edit baseline was 1739 pass / 3 fail, matching the expected-red manifest exactly; post-edit the 3 manifest entries are green and nothing else moved.)

Real numbers, unfiltered run — full glob, no `--test-name-pattern`, no skip.

## Verdict

**PASS.** Ratchet paid down, comments closed out, fail-fast diagnostic gap fixed with a consistent, low-risk pattern already used elsewhere in the same file, build gate clean, audit clean of HIGH/CRITICAL, full suite green at 1742/1742.

## Notes for the record (not blockers)

- `docs/backlog.md`'s working-tree diff (E58/E59 status-cell correction) is a separate coordinator-direct edit, not part of this QA action, and E75's own row is marked done by release-engineer post-PASS, not by qa-engineer.
- No genuinely new test FILE was warranted (see Phase 3 above) — surfaced per SOP even though the answer is "no", so the coordinator doesn't have to ask.
## 2026-08-18T11:28:50.923Z — PASS — by qa-engineer

PASS. Expected-red manifest clean (3/3 confirmed red, exact match, 0 unexplained). Ratchet decremented: KNOWN_ASYMMETRIC_SPAN_COUNTS -> {} (empty allowlist, now a zero-tolerance class assertion, strictly stronger than the 4-site exemption it replaces); EXPECTED_RENDER_GLUE_COUNTS pm/qa-engineer/architect -> 0 (every role 0). Header note and KNOWN,TRACKED debt comment block rewritten as closed history, no stale live-debt claims left. Fail-fast gap (carried from code-reviewer) fixed: converted both cross-SOP render sweep tests from per-iteration assert.equal to collect-then-assert (mirrors the existing structural-sweep pattern in the same file) so all 9 roles are asserted together, not short-circuited on the first mismatch. Build clean (tsc + check:version 3.102.3 + check:transitions-sync 21 keys). npm audit --audit-level=high: 5 findings, all moderate/low, zero HIGH/CRITICAL. Full npm test: 1742/1742 pass, 0 fail (pre-edit baseline was 1739/3 matching manifest exactly). Only test/render-structure.test.mjs touched under test/; content/ and prompts/text-transforms.ts untouched. review: qa_reports/review_T-E75-02.md (covers T-E75-01, T-E75-02).

## 2026-08-18T11:29:12.524Z — PASS — by qa-engineer

PASS. Expected-red manifest clean (3/3 confirmed red, exact match, 0 unexplained). Ratchet decremented: KNOWN_ASYMMETRIC_SPAN_COUNTS -> {} (empty allowlist, now a zero-tolerance class assertion, strictly stronger than the 4-site exemption it replaces); EXPECTED_RENDER_GLUE_COUNTS pm/qa-engineer/architect -> 0 (every role 0). Header note and KNOWN,TRACKED debt comment block rewritten as closed history, no stale live-debt claims left. Fail-fast gap (carried from code-reviewer) fixed: converted both cross-SOP render sweep tests from per-iteration assert.equal to collect-then-assert (mirrors the existing structural-sweep pattern in the same file) so all 9 roles are asserted together, not short-circuited on the first mismatch. Build clean (tsc + check:version 3.102.3 + check:transitions-sync 21 keys). npm audit --audit-level=high: 5 findings, all moderate/low, zero HIGH/CRITICAL. Full npm test: 1742/1742 pass, 0 fail (pre-edit baseline was 1739/3 matching manifest exactly). Only test/render-structure.test.mjs touched under test/; content/ and prompts/text-transforms.ts untouched. review: qa_reports/review_T-E75-02.md (covers T-E75-01, T-E75-02).

