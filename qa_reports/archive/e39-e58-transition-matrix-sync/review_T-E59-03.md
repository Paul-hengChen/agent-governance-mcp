# Review — T-E59-03

covers: T-E59-01, T-E59-02, T-E59-03

## Summary

- E59 closed Constitution §6's dependency-audit waiver escape ("unless waived in the PR description with rationale") for every build-running role, replacing it with a pre-dated dependency-advisory-record disposition requirement. sr-engineer's 3-file cut (`content/const-15-core-tail.md`, `docs/skills/release-engineer.md`, `docs/skills/sr-engineer.md`) went through two code-review rounds (F1/F2/N1 all fixed) and is **APPROVED** (`review_reports/review_T-E59-01.md`). This review owns the test surface: expected-red disposition, golden/cap re-baseline, and the new regression pin.
- **Expected-Red Diff: clean, verified independently before any re-baseline edit.** `qa_reports/expected-red_e59-const6-waiver-clause.txt` declares 15 reds (11 compose-equivalence goldens + 4 context-budget ceilings). I ran `test/compose-equivalence.test.mjs` and `test/context-budget.test.mjs` **before touching any golden or cap**: exactly 11 and 4 failures respectively, set-identical to the manifest, with measured values matching the manifest digit-for-digit (lean 4667, design-arm 8804, teamwork 16898, non-design 6706; adjacent ~1830 delta assertion green). Zero unexplained reds, zero claimed-but-green entries.
- **Re-baselined only what the edit legitimately moved.** 11 compose-golden fixtures re-captured via `scripts/capture-constitution-golden.mjs` (10 files) + one manual sync of `constitution-monolith.txt` (the script explicitly does not regenerate it — `content/constitution.md` was deleted post-AC8 — so I applied the identical one-line bullet edit by hand to keep the "cat(15 fragments) === monolith" invariant true). `git diff --stat -- test/fixtures/compose-golden/` shows exactly 11 files changed, each with a 1-line replace (2 diff lines: -old/+new) — no other line moved in any fixture. The 4 context-budget ceilings were moved individually (4544→4667, 8685→8804, 16779→16898, 6587→6706), each with an in-file comment naming E59, the measured delta, and the re-verified saving-margin invariants (raw−stripped ≥ 240, design-arm−non-design ≥ 2080) — no cap was blanket-raised, and the adjacent "~1830 lighter" delta test required no change.
- **New regression pin, structural per the task brief.** Two new tests in `test/release-staging.test.mjs` (chosen over a new file: `test/release-staging.test.mjs` already hosts the E7-AC1 §6 constitution-bullet pin at what was line 973, and the file already reads `content/const-15-core-tail.md` into `CONST15` — no new test-file infrastructure needed):
  1. A repo-tree sweep asserting the literal word `waived` does not appear anywhere under `content/` or `docs/skills/` — the exact verb form every historical escape phrasing used (verified against git history), distinct from the retained `waive` (present tense, "Toolchains lacking...") and the new `waiver` (noun, "...is NOT a waiver...") which both survive intentionally. This catches the escape reappearing at **any** site, not just the 9 known ones — including a future 10th mirror nobody has enumerated yet.
  2. A per-site enumeration of all 9 live normative sites named in `review_T-E59-01.md` Round 2 (`content/const-15-core-tail.md:11`; `docs/skills/release-engineer.md:51,92,121,165-167`; `docs/skills/sr-engineer.md:82,112,132,206-208`), asserting each still carries the disposition-channel replacement text. This catches a mirror being silently truncated/deleted without the word "waived" reappearing — the failure mode (a) can't see.
  - Both are content-anchored, not line-number-anchored, so they survive reformatting; I verified this with negative controls (see Correctness) before trusting them.
- **Verification, this working tree:** `npm run build` clean (tsc, 0 errors). `npm audit --audit-level=high` → exit 0, 6 findings (2 low, 4 moderate), zero HIGH/CRITICAL — §6 not triggered for this session's own build. Full suite: **1694 tests, 1694 pass, 0 fail** (1692 baseline + 2 new E59 tests, all green after re-baseline).
- Verdict: **PASS**.

## Expected-Red Diff

Phase 0.5: manifest present (`qa_reports/expected-red_e59-const6-waiver-clause.txt`, 15 entries).

Ran BEFORE any re-baseline edit:
- `node --test test/compose-equivalence.test.mjs` → 14 tests, 3 pass, **11 fail** — the exact 11 manifest entries (10 named goldens + the `cat(15 fragments) === monolith` invariant), zero extra.
- `node --test test/context-budget.test.mjs` → 54 tests, 50 pass, **4 fail** — the exact 4 manifest entries (AC2 lean, AC8 design-arm floor, AC8 teamwork bundle, AC8 non-design floor). Measured values reproduced the manifest's digit-for-digit: 4667/4544, 8804/8685, 16898/16779, 6706/6587. The adjacent "chain-role non-design bundle is ~1830 ~tok lighter" assertion was already green (unaffected — the bullet is core-tagged, not design-fenced, so it doesn't touch the design-only delta).

**Disposition: 15/15 manifest entries confirmed red, 0 unexplained reds, 0 claimed-but-green entries.** Diff empty in both directions, matching sr-engineer's and code-reviewer's independent re-runs. No entry required disposition beyond "expected, per the core-tagged const-15 edit" — proceeded to re-baseline.

Post-re-baseline confirmation: `node --test test/compose-equivalence.test.mjs` → 14/14 pass. `node --test test/context-budget.test.mjs` → 54/54 pass. Full suite: 1694/1694 pass (see Run below).

## Correctness

**(a) Golden re-baseline is exactly the sanctioned single-line change, everywhere.** `git diff -- test/fixtures/compose-golden/build-full-nondesign.txt` (and all 10 others) shows only the §6 bullet line replaced — same before/after text as `content/const-15-core-tail.md`'s own diff, byte-for-byte. No whitespace drift, no other fragment's text moved. This matches code-reviewer's finding that the composed bundle diff against the prior golden was exactly one line.

**(b) `constitution-monolith.txt` required a manual sync the capture script does not perform.** `scripts/capture-constitution-golden.mjs` prints `content/constitution.md absent (post-AC8 delete) — monolith baseline not re-captured; committed fixture remains authoritative` and only emits 10 of the 11 fixtures. The `cat(15 manifest fragments) === monolith` test (AC8, DR-1 Option R invariant) concatenates the *live* fragments — which now include the fixed const-15 text — against the *frozen* monolith fixture, so leaving it untouched would have left this test permanently red (a real regression, not expected-red). I located the bullet at `constitution-monolith.txt:180` and applied the identical replacement text used in `content/const-15-core-tail.md:11`, verified via `assert.equal` in the test itself (byte equality, no normalization) — confirmed green.

**(c) Structural pin design — verified with negative controls before trusting it.** Rather than assert the test passes against the current (already-fixed) tree, I constructed two mutations in isolation (not applied to the real files) and confirmed the assertions would catch them:
  - Reintroducing `waived` into a copy of the const-15 bullet text (e.g. `"waived if noted in the PR description, at any role"`) → sweep regex `/\bwaived\b/i` flips to `true` (confirmed via `node -e`).
  - Truncating a mirror site's excerpt to drop everything after "build failure" (simulating a silent deletion of the disposition clause without reintroducing the word "waived") → the per-site `/dependency-advisory record/.test(excerpt) || /disposition/.test(excerpt)/` check flips to `false` (confirmed via `node -e`).
  - Both controls ran against the actual site-extraction regexes used in the shipped test, not hand-simplified versions, so the negative control is meaningful.

**(d) Site count is asserted, not just used.** The per-site test opens with `assert.equal(sites.length, 9, ...)` so the enumeration itself can't silently shrink or grow without a deliberate test edit — directly answering the task brief's point that three independent passes each re-derived a different count (5, 6, 7) before landing on 9.

**(e) E7-AC1 (§6 sanctioned-git-ops bullet pin) confirmed green, unmodified.** I did not touch this test; `node --test test/release-staging.test.mjs` shows it passing (`ok 32`/`ok 34`) alongside the two new E59 tests (`ok 36`/`ok 37`). It pins a *different* bullet in the same file (`**Sanctioned git operations (ALL roles)**`, line 12), which E59 never touched — confirmed by the earlier code-review diff showing only the dependency-audit bullet (line 11) changed.

**(f) I relied on code-reviewer's Round 2 APPROVED for the content correctness of the 3-file cut itself** (F1/F2/N1 verification, mermaid topology check, transition-matrix legality of `sr-engineer:Blocked → pm`) rather than re-deriving it — that is code-reviewer's owned surface per the qa-engineer SOP's scope boundary (QA rejects only for failing tests / missing coverage / test-infra defects, not correctness/architecture already reviewed). My own read of the diff (Correctness a, e above) is a sanity check, not a re-review.

**Non-blocking observation, out of my review surface:** an untracked `undefined/` directory (`undefined/actual.txt`, `undefined/ws/.current/handoff.md`) exists in the working tree, timestamped before this session started. Not part of the E59 cut (not under `content/`, `docs/`, or `test/`), does not affect any test result — flagging for the record only, not fixing or deleting since its origin is unknown and out of this ticket's scope.

## Test File Discovery / Spec-to-Test Map

No `specs/e59*.md` or `design/e59*.md` exists — per `scope_decision_why`, the backlog E59 row + `review_T-E57-01` F7 finding serve as the spec (mini-chain, PM/architect skipped). Phase 3a (Copy Audit), 3b (Visual Audit), 1.5 (Visual Compare), and 3.5 (AC Execution Log) all gate on a `specs/<feature>.md` or `design/<feature>.md` that does not exist here — logging skip for each, mirroring the SOP's own "absent → skip" branches:
- Phase 1.5: skipped (no Visual Baselines declared / no design file).
- Phase 3a/3b: skipped (no spec file to audit copy/visual tokens against).
- Phase 3.5: skipped (no `proof:`-annotated ACs / no spec file).

Test target was pre-named (T-E59-03 deliverable 3: "the existing `test/compose-equivalence.test.mjs` / `test/context-budget.test.mjs` for the re-baseline, plus a new pin"). I used `test/release-staging.test.mjs` for the new pin per the task's explicit instruction (already hosts the E7-AC1 §6 pin and the `CONST15` fixture read) — no new test file created.

Task→test map:
1. Re-baseline compose-golden — `test/fixtures/compose-golden/*.txt` (11 files) + `scripts/capture-constitution-golden.mjs` re-run.
2. Re-baseline context-budget ceilings — `test/context-budget.test.mjs` (4 caps + 4 test titles, individually, with in-file comments).
3. New regression pin — `test/release-staging.test.mjs`, two new tests ("the abolished 'waived' ... does not reappear ..." and "all 9 live §6 ... sites carry the disposition-channel replacement text ...").
4. E7-AC1 non-regression — confirmed green, unmodified.

## Run

- `npm run build` — clean, 0 errors.
- `npm audit --audit-level=high` — exit 0, 6 findings (2 low, 4 moderate), zero HIGH/CRITICAL. §6 gate not triggered for this session.
- `node --test test/*.test.mjs` — **1694 tests, 1694 pass, 0 fail, 0 cancelled** (baseline 1692 + 2 new E59 tests in `test/release-staging.test.mjs`).
- CI runnability: all of the above run headlessly, zero human interaction required.

## Verdict

**PASS** — T-E59-01, T-E59-02, T-E59-03 all complete. The §6 waiver-escape closure is correct and code-review-approved; the expected-red set was verified exact before any re-baseline edit; all 11 goldens and 4 context-budget ceilings were re-baselined to exactly what the edit legitimately moved (including the capture-script's uncaptured `constitution-monolith.txt`, synced by hand); the new regression pin is structural (tree-wide sweep + 9-site enumeration with an asserted site count), verified against negative controls before being trusted; and E7-AC1 stays green, unmodified. Full suite 1694/1694, build clean, audit clean.
## 2026-08-12T03:47:03.823Z — PASS — by qa-engineer

Expected-red verified exact (15/15, both directions empty) before any re-baseline edit. Re-baselined 11 compose-golden fixtures (10 via scripts/capture-constitution-golden.mjs + manual sync of constitution-monolith.txt, which the script does not regenerate) and 4 context-budget ceilings (4544->4667, 8685->8804, 16779->16898, 6587->6706), each individually with an in-file E59 comment and re-verified saving-margin invariants -- no blanket raise. Added a structural regression pin in test/release-staging.test.mjs: (1) a tree-wide sweep for the literal word "waived" across content/ and docs/skills/ (fails on the escape reappearing at ANY site, not just the 9 known ones), (2) a per-site enumeration of all 9 live normative sites from review_T-E59-01.md Round 2 asserting each still carries the disposition-channel replacement text, with assert.equal(sites.length, 9) so the enumeration can't silently drift. Verified both branches with negative controls (simulated waived-reintroduction and site-truncation) before trusting them. E7-AC1 (sanctioned-git-ops bullet pin) confirmed green, unmodified. npm run build clean; npm audit --audit-level=high exit 0 (6 low/moderate, zero HIGH/CRITICAL). Full suite 1694/1694 pass, 0 fail. Evidence: qa_reports/review_T-E59-03.md.

