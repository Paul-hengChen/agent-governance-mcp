# Review — T-E7-05 (QA PASS round)

covers: T-E7-01, T-E7-02, T-E7-03, T-E7-04

## Summary

- QA round for `e7-governed-git-surface`. Code review (T-E7-04) is APPROVED
  (`review_reports/review_T-E7-04.md`), covering the T-E7-01..03 implementation
  diff. This round (T-E7-05) authors the pinning tests the spec's own ACs
  require, executes every `proof:`-annotated AC, and re-runs full verification.
- **New pinning tests authored** in `test/release-staging.test.mjs` (the
  existing home for D10's skill-release-engineer.md pins — same file, new
  "Phase 6 — E7" section), following the E10-AC8a/AC8b precedent
  (`test/feature-lease.test.mjs:1401-1436`, grep-based, load-bearing
  substrings not full prose):
  - **E7-AC1** — pins `content/const-15-core-tail.md` §6's new "Sanctioned git
    operations (ALL roles)" bullet: sanctioned verbs (`git add`, `git commit`,
    `git tag`, fast-forward `git push`), forbidden verbs (`git reset`,
    `git rebase`, `git clean`, force-push, `git checkout --force`), and the
    STOP → `status: Blocked` (branch/SHA/trigger in `pending_notes`) →
    hand-back-to-coordinator/human phrase — all asserted against the SAME
    matched bullet substring, not scattered across the file.
  - **E7-AC3** — pins the `const-15-core-tail.md` manifest entry's
    `tag: "core"` in `prompts/constitution-manifest.ts` (raw-config pin), PLUS
    a second test that calls `composeConstitution({chain,design})` directly
    (imported from `dist/prompts/build.js`, same pattern as
    `test/compose-equivalence.test.mjs`) and asserts the bullet reaches the
    COMPOSED text on both the lite/non-design (tightest) and full-chain/
    design-armed (broadest) arms — closing the gap the AC3 proof text calls
    out explicitly ("the new AC1 pinning test itself running against the
    composed, not raw, constitution text").
  - **E7-AC2** — pins the cross-reference sentence appended to
    `content/skill-release-engineer.md`'s existing D10 bullet ("one source of
    truth is the general git-ops whitelist in Constitution §6 (Security &
    Privacy), binding ALL roles" / "this bullet retains only the
    release-engineer recovery mechanics").
  - **AC5 non-regression** — already covered by the pre-existing D10-AC1
    through D10-AC4 tests in the same file (lines ~495-600), which pin the
    STOP clause, the `status=Blocked`+SHA+`pending_notes` instruction, the
    worked example, the incident-reason clause, the Escalation Routes row, and
    the haiku shim hint verbatim. All five continued to pass unmodified
    against the post-E7 file, proving the D10 mechanics survived the AC2
    cross-reference addition byte-for-byte. No new test added for this
    (redundant with what already had to hold).
  - **Sanity-checked the pins are load-bearing**: manually stripped a forbidden
    verb (`` `git reset`, ``) from an in-memory copy of the bullet and
    confirmed the E7-AC1 assertion throws — the tests catch real regressions,
    not just decorative greps.
  - **Rationale-fence judgment call**: the D10 incident rationale in the new
    §6 bullet ("Reason (D10, generalized): ...") is unfenced, same as every
    other `Reason (...)` clause already in `const-15-core-tail.md` and
    `skill-release-engineer.md`. This is spec-compliant (AC1/AC2 don't require
    fencing) and consistent with the surrounding file's convention — did not
    churn it into a rationale-fenced form.

## AC Execution Log

Spec `specs/e7-governed-git-surface.md` carries `proof:` annotations on AC1-AC6. All six executed below, before PASS.

### AC1 — sanctioned/forbidden verbs + STOP/Blocked/hand-back phrase, same bullet
Command: `node --test test/release-staging.test.mjs`
```
ok 22 - E7-AC1: content/const-15-core-tail.md §6 carries the sanctioned-git-ops whitelist bullet — sanctioned verbs, forbidden verbs, and the STOP/Blocked/hand-back phrase, all in the same bullet (spec AC1)
```
Verdict: **PASS**.

### AC2 — skill-release-engineer.md cross-reference to general §6 rule
Command: `node --test test/release-staging.test.mjs`
```
ok 25 - E7-AC2: content/skill-release-engineer.md's D10 bullet cross-references the new general §6 sanctioned-git-ops whitelist by name/section, pointer-only (spec AC2)
```
Verdict: **PASS**.

### AC3 — core-tag reachability on every dispatch arm (composed text)
Command 1: `node --test test/compose-equivalence.test.mjs` (existing golden-fixture assertions, unmodified)
```
# tests 14
# pass 14
# fail 0
```
Command 2: `node --test test/release-staging.test.mjs` (new AC1 pinning test running against composed, not raw, text)
```
ok 24 - E7-AC1/AC3: the sanctioned-git-ops bullet reaches the COMPOSED (not raw) constitution text on both the tightest (lite, non-design) and broadest (full-chain, design-armed) dispatch arms (spec AC1's composed-text requirement, AC3)
```
Also confirmed directly: `prompts/constitution-manifest.ts:51` — `{ file: "const-15-core-tail.md", tag: "core" }`, and `includeSegment()` returns `true` unconditionally for tag `"core"` (`prompts/constitution-manifest.ts:64-65`).
Verdict: **PASS**.

### AC4 — context-budget.test.mjs cap bump
Command: `node --test test/context-budget.test.mjs`
```
# tests 54
# pass 54
# fail 0
```
Cap-bump comments confirmed present, citing `e7-governed-git-surface` / T-E7-03 / AC4 (verified by code-reviewer in T-E7-04, re-confirmed here by the passing suite).
Verdict: **PASS**.

### AC5 — release-engineer D10 mechanics unchanged verbatim except the cross-reference addition
Command: `git diff content/skill-release-engineer.md`
```
@@ -18,7 +18,7 @@ ...
-- **CRITICAL — STOP on push rejection / concurrent-release collision** (D10): ... only the reflog made recovery possible.
+- **CRITICAL — STOP on push rejection / concurrent-release collision** (D10): ... only the reflog made recovery possible. Why these verbs are forbidden is no longer release-engineer-specific: one source of truth is the general git-ops whitelist in Constitution §6 (Security & Privacy), binding ALL roles — this bullet retains only the release-engineer recovery mechanics.
```
Single-line diff; entire original STOP / `status=Blocked` / `pending_notes` SHA example / coordinator-recovery text preserved byte-for-byte, with only the pointer sentence appended at the end. Step-3a re-baseline text elsewhere in the file untouched. Cross-verified against the pre-existing D10-AC1..AC4 pinning tests (`test/release-staging.test.mjs`), all still green post-change.
Verdict: **PASS**.

### AC6 — no new server-side gate; diff scope limited
Command: `git diff --stat HEAD -- gates/ tools/handoff-orchestrator.ts index.ts`
```
(empty)
```
Zero changes under `gates/`, `tools/handoff-orchestrator.ts`, or `index.ts`. Full `git diff --stat HEAD` confirms source changes limited to `content/const-15-core-tail.md` (+1), `content/skill-release-engineer.md` (+1/-1), `test/context-budget.test.mjs` (cap bump), `test/release-staging.test.mjs` (new/extended pinning tests, this round), plus the 11 regenerated compose-golden fixtures (each +1 identical bullet line, verified by code-reviewer in T-E7-04) and expected bookkeeping (`.current/handoff.md`, `tasks.md`).
Verdict: **PASS**.

## Copy / Visual Audit Gates

Spec's Copy/Strings and Visual Tokens tables are both `N/A` (internal governance-content fix, no user-facing strings or visual literals). Gates not armed — 3a/3b skipped per SOP, consistent with the code-reviewer's T-E7-04 finding.

## Phase 0.5 — Expected-Red Diff
Skipped: no `qa_reports/expected-red_e7-governed-git-surface.txt` manifest exists. Feature-mode ticket, no intentionally-red tests declared.

## Phase 1.5 — Visual Compare
Skipped: no `design/e7-governed-git-surface.md` file (non-design feature per `scope_decision`), no `## Visual Baselines` H2 to check.

## Full Verification

- `npm run build` — clean, zero TypeScript errors. `check:version` OK (3.80.0).
- `npm audit --audit-level=high` — exit 0. One LOW-severity finding (`esbuild` 0.27.3-0.28.0, dev-server arbitrary file read on Windows, GHSA-g7r4-m6w7-qqqr) — below the `high` threshold, not a build failure per the audit gate rule.
- `npm test` — **1394/1394 pass, 0 fail, 0 cancelled, 0 skipped.** (Baseline at code-review time was 1390/1390; this round added exactly 4 new tests — E7-AC1, E7-AC3 raw-config, E7-AC1/AC3 composed, E7-AC2 — all passing, zero unexplained reds, zero regressions elsewhere.)

## Verdict

**PASS.** All six spec ACs (AC1-AC6) independently re-verified via their `proof:` annotations, now backed by durable grep/composed-text pinning tests (not just this-session inspection). D10 recovery mechanics confirmed byte-identical except the sanctioned AC2 pointer sentence. No server-side gate added. Build clean, audit clean at the `high` threshold, full suite green at 1394/1394.
## 2026-07-13T03:13:16.520Z — PASS — by qa-engineer

QA PASS. Authored E7-AC1/AC2/AC3(raw+composed) pinning tests in test/release-staging.test.mjs (mirroring the E10-AC8a/AC8b precedent); AC5 non-regression already covered by pre-existing D10-AC1..AC4 pins, all still green post-change. Executed all six proof-annotated ACs (AC1-AC6) — see qa_reports/review_T-E7-05.md ## AC Execution Log. Full verification: npm run build clean, npm audit --audit-level=high exit 0 (1 unrelated LOW finding only), npm test 1394/1394 pass (baseline 1390 + 4 new tests this round), zero unexplained reds. D10 recovery mechanics confirmed byte-identical except the sanctioned AC2 pointer sentence (git diff, single line). Zero changes under gates/, tools/handoff-orchestrator.ts, index.ts (AC6). Covers T-E7-01..05.

