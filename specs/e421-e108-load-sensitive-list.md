# e421-e108-load-sensitive-list

## Problem Statement
The integrator's flake rule lets a CI-red test be re-run once (`gh run rerun --failed`) only when it is on this repo's load-sensitive list, which lives in one bullet of `docs/lane-protocol-addendum.md` §5. That bullet names only the two `test/e108-eject.test.mjs` tests whose names start with `AC7` (plus `VR-20 (E80)` in `test/verify-release.test.mjs`). During the backlog wave B multi-lane runs the eject tests named `AC1:`, `AC15:`, `AC19:` and `AC20:` also each timed out under load at least once, while all are green alone and on CI. Because they are off the list, a load timeout in one of them reads as a regression and is bounced back to a lane. Human ruling 2026-11-10, option (a): change the list only; the tests' own code is not touched.

## User Stories
- As the integrator, I want every eject test known to time out under load on the load-sensitive list, so that a load timeout gets one re-run instead of being bounced to a lane as a regression.
- As a lane reviewer, I want each listed test named unambiguously (with the colon), so that "starts with AC1" is never read as also covering `AC15` / `AC19` / `AC10`-`AC18`.

## Acceptance Criteria
The new bullet (NEW_BULLET) is exactly this one line, which replaces the current load-sensitive bullet in `docs/lane-protocol-addendum.md` §5 in place (same position: last bullet of §5, ninth after the fanout line):

```text
- 整合者 flake rule 的負載敏感測試清單（只有清單上的測試在 CI 紅時可以 `gh run rerun --failed` 一次）：`test/e108-eject.test.mjs` 的六個測試（名稱以 `AC1:`、`AC15:`、`AC19:`、`AC20:` 開頭的四個測試，加上名稱以 `AC7` 開頭的兩個測試）、`test/verify-release.test.mjs` 的 `VR-20 (E80)`。E238 處理過的六個站點（五個已去耦，usage-accounting 的 20 s 上限確認不動）不在清單上：再紅代表退化，照一般紅燈送回 lane。
```

Change against the current bullet: exactly one span. `` `test/e108-eject.test.mjs` 名稱以 `AC7` 開頭的兩個測試 `` becomes `` `test/e108-eject.test.mjs` 的六個測試（名稱以 `AC1:`、`AC15:`、`AC19:`、`AC20:` 開頭的四個測試，加上名稱以 `AC7` 開頭的兩個測試） ``. Everything before it (the lead-in and its parenthetical) and everything after it (`、`test/verify-release.test.mjs` 的 `VR-20 (E80)`。` and the E238 sentence) is byte-identical. The substring `名稱以 \`AC7\` 開頭的兩個測試` survives unchanged.

- **AC1** — Given the edit, when `docs/lane-protocol-addendum.md` is read, then exactly one line contains `負載敏感測試清單`, that line equals NEW_BULLET byte-for-byte, it is still the last bullet of §5, and no other line of the file changed.
  proof: `git diff --numstat main -- docs/lane-protocol-addendum.md` prints `1	1	docs/lane-protocol-addendum.md`, and `node --test test/e349-integrator-repo-facts.test.mjs` passes after the T-E421-02 re-pin (it pins the nine §5 bullets in order, then `## §7`).
- **AC2** — Given the list names tests by title prefix, when the prefixes are matched against `test/e108-eject.test.mjs` test titles, then `AC1:`, `AC15:`, `AC19:`, `AC20:` each match exactly one title and `AC7` matches exactly two.
  proof: `for p in 'AC1:' 'AC15:' 'AC19:' 'AC20:' 'AC7'; do printf '%s %s\n' "$p" "$(grep -c "^test(\"$p" test/e108-eject.test.mjs)"; done` prints `AC1: 1`, `AC15: 1`, `AC19: 1`, `AC20: 1`, `AC7 2`.
- **AC3** — Given `test/e349-integrator-repo-facts.test.mjs` pins the bullet verbatim, when it is re-pinned, then the fifth `W9` entry in AC-E349-2 equals NEW_BULLET and the file passes.
  proof: `node --test test/e349-integrator-repo-facts.test.mjs` exits 0.
- **AC4** — Given `test/e355-integrator-generic-wording.test.mjs`, when it is re-pinned, then `W9_LOAD` equals NEW_BULLET; AC-E355-4 still asserts the `AC7` phrase and the `VR-20 (E80)` phrase once each, and additionally asserts the four-test span `名稱以 \`AC1:\`、\`AC15:\`、\`AC19:\`、\`AC20:\` 開頭的四個測試` exactly once; the `named` array stays `["test/e108-eject.test.mjs","test/verify-release.test.mjs"]`; the file passes. (Test title wording that says "two candidates" may be updated by QA to match.)
  proof: `node --test test/e355-integrator-generic-wording.test.mjs` exits 0.
- **AC5** — Given the scope ruling, when the branch diff is listed, then nothing under `content/`, `dist/`, or `test/e108-eject.test.mjs` changed.
  proof: `git diff --name-only main -- content dist test/e108-eject.test.mjs` prints nothing.
- **AC6** — Given the whole change, when the full suite runs serially under the repo lock, then it has 0 failures (`test/e295-hop-cap-and-sop-halves.test.mjs` AC9 included: it only requires one list bullet naming both test files, which NEW_BULLET still does).
  proof: `node scripts/test-lock.mjs -- npm test` reports `fail 0`.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| addendum.load-sensitive-list | NEW_BULLET (the `text` block under Acceptance Criteria, verbatim) | `docs/backlog.md` E421 row + human ruling 2026-11-10 option (a); wording authored-here in the bullet's existing Traditional Chinese style, colon kept in each `AC1:`/`AC15:`/`AC19:`/`AC20:` prefix so no prefix also matches a longer AC number |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Any change to `test/e108-eject.test.mjs` (timeouts, decoupling, skips): human ruling option (a).
- `content/**` (the integrator SOP's flake rule is already generic and points at the addendum), so no compose golden or `test/context-budget.test.mjs` cap moves; `dist/` untouched.
- The E238 sites and `VR-20 (E80)`: unchanged.
- Release, version bump, CHANGELOG: none (mini-chain, no release). Backlog / queue done-marks after PASS belong to the coordinator.

## Dependencies / Prerequisites
- No design source (mode = no-design; Visual Structural Assertions omitted). No external references in the E421 row (Resource Audit: zero hits).
- Ownership split (Constitution §2 test ownership): sr-engineer edits only `docs/lane-protocol-addendum.md`; the two pinning tests are qa-owned. sr's edit therefore leaves two intentional reds, which sr records in `qa_reports/expected-red_e421-e108-load-sensitive-list.txt` (format `<file> | <exact test name>`):
  - `test/e349-integrator-repo-facts.test.mjs | AC-E349-2: addendum heading list unchanged; the nine §5 bullets follow the fanout line in order; §7 unchanged; every called tool has its repo-relative call`
  - `test/e355-integrator-generic-wording.test.mjs | AC-E355-3: addendum §5 gains the five W9 bullets after the existing four, §7 follows`
  (AC-E355-4 stays green on sr's edit alone, because the `AC7` phrase is preserved and `W9_LOAD` is the test's own constant; QA strengthens it per AC4.)
- Other readers of the addendum checked: `test/e295-hop-cap-and-sop-halves.test.mjs` AC9 (one list bullet, both file names; still green), `test/e286`, `test/e290`, `test/e289` (fixture content only or other sections; unaffected).
- Full suite always as `node scripts/test-lock.mjs -- npm test`.
- Previous feature `release-cd-v4.20.0` shipped (v4.20.0 tagged); its lease expired, no lease override needed.

## Cut
| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E421-01 | sr-engineer: replace the load-sensitive bullet in addendum §5 with NEW_BULLET (one span changed); write the expected-red manifest naming e349 AC-E349-2 and e355 AC-E355-3 | none | 1 | `docs/lane-protocol-addendum.md` | — |
| T-E421-02 | qa-engineer: re-pin `W9` (e349) and `W9_LOAD` + AC-E355-4 four-test count (e355) to NEW_BULLET, `named` unchanged; run AC1-AC6 proofs incl. `node scripts/test-lock.mjs -- npm test` | T-E421-01 | 2 | `test/e349-integrator-repo-facts.test.mjs`, `test/e355-integrator-generic-wording.test.mjs` | — |
