# Review — T-E421-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Builder diff: `docs/lane-protocol-addendum.md` line 38, the load-sensitive bullet in §5, replaced with spec NEW_BULLET (1 insertion, 1 deletion); plus `qa_reports/expected-red_e421-e108-load-sensitive-list.txt`.
- Coordinator bookkeeping on the same branch: E421 row in `docs/backlog.md`, queue row 234 in `docs/v4.0.0-new-tickets.md`. Both match the ticket and the human ruling (a).
- Scope matches the ruling: no `content/**`, `dist/` or `test/` edits.
- The spec got one prediction wrong: AC-E355-4 goes red on sr's edit alone. The manifest records it correctly, and T-E421-02 (AC4) already covers the re-pin. No spec amendment is required (see Correctness).
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `docs/lane-protocol-addendum.md:38`. Exactly one line contains `負載敏感測試清單`. That line equals NEW_BULLET byte-for-byte (Python comparison against the spec's `text` block). It is still the last §5 bullet, right before `## §7 中途修 base`. `git diff --numstat main -- docs/lane-protocol-addendum.md` = `1	1`. The e349 test can only pass after the T-E421-02 re-pin, which is qa's task.
AC2 — implemented — the proof loop prints `AC1: 1`, `AC15: 1`, `AC19: 1`, `AC20: 1`, `AC7 2`. I listed every `test(` title in `test/e108-eject.test.mjs`. The `AC1:` match is line 168 only: `AC10:`–`AC18:` don't match because the colon blocks them. `AC7` matches lines 380 and 568 (`AC7 (E243)`). No other title starts with any of these prefixes. The `(see AC5/AC6)` title at line 976 starts with `git rm`, so it doesn't match.
AC3 — qa-owned (T-E421-02). Not in this task's scope.
AC4 — qa-owned (T-E421-02). Not in this task's scope. NEW_BULLET makes it satisfiable: the `AC7` phrase and the four-test span each occur exactly once in the addendum, and the backticked test paths are still `["test/e108-eject.test.mjs","test/verify-release.test.mjs"]`.
AC5 — implemented — `git diff --name-only main -- content dist test` prints nothing.
AC6 — qa-owned. Full suite runs after T-E421-02. On this edit alone, e295 AC9 stays green (checked).

## Correctness
No required findings.

- Expected-red manifest (step 4a; all 3 entries sampled): each entry is a real test that can be found, and the run matches it exactly. `node --test` on e349 + e355 + e295 gives 15 pass / 3 fail: `AC-E349-2` (e349:58), `AC-E355-3` (e355:55) and `AC-E355-4` (e355:67). The manifest's test names match those titles byte-for-byte.
- The third red is a real effect of the diff, not a builder defect. `test/e355-integrator-generic-wording.test.mjs:68` counts `` `test/e108-eject.test.mjs` 名稱以 `AC7` 開頭的兩個測試 ``, which includes the file-path prefix. NEW_BULLET deliberately puts `的六個測試（…` between that path and the `AC7` phrase. The spec's Dependencies sentence "(AC-E355-4 stays green on sr's edit alone, because the `AC7` phrase is preserved …)" is therefore wrong: the phrase survives, but the path-prefixed string that line 68 pins does not.
- Spec amendment: **recommended, not required.** AC4 already makes qa re-pin AC-E355-4 ("still asserts the `AC7` phrase … additionally asserts the four-test span …"). Line 68 is in that test body, so T-E421-02 covers the fix without any change to its scope. If the PM amends anything, it should be the one sentence in the Dependencies section, so the spec's red set says 3. qa should re-pin line 68 to the bare phrase `名稱以 \`AC7\` 開頭的兩個測試` (count 1 in the current addendum, checked), or to a longer substring of NEW_BULLET, and should not loosen it to a bare `AC7`.

## Quality
No findings. The new wording follows the bullet's existing Traditional Chinese style. Every new prefix keeps its colon, which the spec requires (user story 2). The manifest's comment lines are short and factual.

- `recommended`: e355 test title "names exactly the two candidates" is now stale. AC4 already lets qa update it.

## Architecture
No architecture spec (doc-only mini-chain). The addendum is still the single home for the repo-specific list. `content/skill-integrator.md:156` still points at "the repo's load-sensitive test list (the addendum names it)" and names no tests, so no content or golden change is needed. This matches the spec's Out of Scope.

## Security
No findings. Information hygiene: the new bullet, the E421 backlog row and queue row 234 contain no credentials, personal data, home paths or external identifiers. They name only repo-relative test files and internal ticket ids. `agc check` exits OK. Its hygiene line only reports skipping pre-existing placeholder home-path hits, none of them in this diff.

## Performance
No findings. Documentation-only change; no code path touched.

## Bookkeeping accuracy (coordinator rows, reviewed at request)
- `docs/backlog.md` E421: matches the ruling, option (a) list-only. It names the six tests with colon prefixes, keeps `VR-20 (E80)` and the E238 sentence, lists the test impact (e349 verbatim pin; e355 `W9_LOAD` + AC-E355-4 count), and lists what stays untouched (`content/**`, `dist/`, `test/e108-eject.test.mjs`). Priority P3, est. 3 files. It agrees with the spec cut.
- `docs/v4.0.0-new-tickets.md` row 234: P3, the same four prefixes plus the two `AC7` tests (six in total), list-only, no release. It matches the backlog row and continues the table's numbering (233 → 234).

## Verdict
APPROVED. sr's change matches NEW_BULLET byte-for-byte, the colon prefixes match the test titles without ambiguity, scope is clean, and the expected-red manifest is accurate. The one miss is a spec prediction (AC-E355-4 also goes red), and T-E421-02's AC4 already covers it.
