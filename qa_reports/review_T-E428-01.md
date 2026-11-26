# Judge report — T-E428-01

covers: T-E428-01, T-E428-02, T-E428-03, T-E428-04, T-E428-05

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Expected-Red Diff

Manifest `qa_reports/expected-red_e428-tracker-mirror.txt`, 17 entries. Actual reds in the full suite
(`node scripts/test-lock.mjs -- npm test`, exit 0, 4791 tests, 4789 pass, 0 fail, 2 skipped): none.
- All 17 manifest entries (12 in `test/e428-tracker-mirror.test.mjs`, 5 re-pins in e445/e462/e410 ×2/e430): green.
  They are scenario tests and re-pins, green now that the Copy is built.
- Actual reds off the manifest: none.
- The 2 skips are `HISTORY-DEPENDENT AC SKIPPED` (commit 121ddc8 not resolvable). They come from an older
  feature's history check and are unrelated to this lane.

## AC Execution Log

- AC1 — `node --test --test-name-pattern "^AC1" test/e428-tracker-mirror.test.mjs` — exit 0 (4/4 pass) — pass
- AC2 — `node --test --test-name-pattern "^AC2" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass
- AC3 — `node --test --test-name-pattern "^AC3" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass
- AC4 — `node --test --test-name-pattern "^AC4" test/e428-tracker-mirror.test.mjs test/e423-spec-workshop.test.mjs` — exit 0 (2/2) — pass
- AC5 — `node --test --test-name-pattern "^AC5" test/e428-tracker-mirror.test.mjs` — exit 0 (2/2) — pass
- AC6 — `node --test --test-name-pattern "^AC6" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass
- AC7 — `node --test --test-name-pattern "^AC7" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass
- AC8 — `node --test --test-name-pattern "^AC8" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass (the proof passes; the scenario has a Copy gap for private repositories, review F1)
- AC9 — `node --test --test-name-pattern "^AC9" test/e428-tracker-mirror.test.mjs test/e433-test-first-rules.test.mjs` — exit 0 (2/2) — pass
- AC10 — `node --test --test-name-pattern "^AC10" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass
- AC11 — `node --test --test-name-pattern "^AC11" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1) — pass
- AC12 — `node --test --test-name-pattern "^AC12" test/e428-tracker-mirror.test.mjs` — exit 0 (1/1); `node --test test/e437-repo-only-paths.test.mjs test/error-code-contract.test.mjs` — exit 0 (41/41) — pass
- AC13 — `node scripts/test-lock.mjs -- npm test` — exit 0 (4789/4791 pass, 0 fail, 2 skipped); `git diff --name-only 32e7f7e -- '*.ts' dist templates tools .current/.config.json docs/config.md docs/lane-protocol.md` — empty; `GATE_REGISTRY` 33, `UPDATE_STATE_GATE_PIPELINE` 17 (dist import) — pass

Negative control: a copy of the tree in the scratch directory, outside the worktree, with C-IN1 bullet 2 changed
to "It is on by default." → `test/e428-tracker-mirror.test.mjs` AC6, AC8, AC12 fail (3 fail, 10 pass).
## 2026-11-26T09:02:31.504Z — FAIL — by code-reviewer

suite-result: 4789/4791 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

code-reviewer Round 1 — CHANGES_REQUESTED (scenario defect → pm). Implementation matches the spec Copy byte for byte; every AC1–AC13 proof: command exits 0; full suite 4789/4791 pass, 0 fail, 2 unrelated history skips; bounds diff empty; GATE_REGISTRY 33, pipeline 17; golden hunk = C-CO1 only; caps 1663/19699 = measured; four re-pins value-only; negative control turns AC6/AC8/AC12 red; all 17 expected-red entries green, no red off the manifest. REQUIRED F1 (Copy): private repo, ticket E900 cut from item 1234 → ticket file `source: [1234 rev 7]`, no map row (C-TF1 bullet 3: only 'every other number' and public-repo source items go in the map; C-SW2 records only created items). Human sets `write-back: on`. Integrator (C-IN1 intro, content/skill-integrator.md:222) sees no E900 row → 'No row, no write' → item 1234 never updated, though C-TF1 bullet 5 (docs/ticket-format.md:171) and C-SW2 say the switch enables source writes; ticket addendum requires write-back 'enabled per workspace' and spec cut decision 4 names no repo type. C-CO1 already resolves via 'the file's `source` field ... or the tracker map', so the integrator asymmetry is an oversight. Fix options for pm: (a) C-IN1 also treats items in the ticket file's `source` field as source items; or (b) C-TF1/C-SW2 record source items in the map in every repository when a mirror is asked for. Add an AC8 private-repo case; re-measure the copy-bearing pins, golden and caps. Optional: ticket-format.md:164-165 'one child item under that item' is ambiguous when `source` lists several items. Reports: review_reports/review_T-E428-01.md, qa_reports/review_T-E428-01.md (covers T-E428-01..05).


## Round 2 — APPROVED — by code-reviewer

covers: T-E428-01, T-E428-02, T-E428-03, T-E428-04, T-E428-05, T-E428-06, T-E428-07

Reviewed HEAD `a8345df` (plus the reviewer's own checkpoint commit `cd373f9`, `.current/e428/` only), base `32e7f7e`,
clean tree before the suite.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e428-tracker-mirror.txt` (pass 2, T-E428-06), 7 entries, all in
`test/e428-tracker-mirror.test.mjs`: AC2, AC3, AC5 (format text), AC6, AC7, AC8, AC12. Actual reds in the full suite
(`node scripts/test-lock.mjs -- npm test`, exit 0, 4791 tests, 4789 pass, 0 fail, 2 skipped): none.
- All 7 manifest entries: green. They are the amended-Copy scenario tests, green now that T-E428-07 applied the
  amended `C-IN1` and `C-TF1` bullet 2.
- Actual reds off the manifest: none.
- The 2 skips are the same `HISTORY-DEPENDENT AC SKIPPED` pair as round 1 (an older feature's history check), unrelated.

## AC Execution Log

- AC1 — `node --test --test-name-pattern "^AC1" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC2 — `node --test --test-name-pattern "^AC2" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC3 — `node --test --test-name-pattern "^AC3" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC4 — `node --test --test-name-pattern "^AC4" test/e428-tracker-mirror.test.mjs test/e423-spec-workshop.test.mjs` — exit 0 — pass
- AC5 — `node --test --test-name-pattern "^AC5" test/e428-tracker-mirror.test.mjs` — exit 0 (2 tests) — pass
- AC6 — `node --test --test-name-pattern "^AC6" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC7 — `node --test --test-name-pattern "^AC7" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC8 — `node --test --test-name-pattern "^AC8" test/e428-tracker-mirror.test.mjs` — exit 0 (private-repository case: `source: [1234 rev 7]`, `write-back: on`, no map row → 1234; off / missing line / other value / no file → none; raw and served integrator text) — pass
- AC9 — `node --test --test-name-pattern "^AC9" test/e428-tracker-mirror.test.mjs test/e433-test-first-rules.test.mjs` — exit 0 — pass
- AC10 — `node --test --test-name-pattern "^AC10" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC11 — `node --test --test-name-pattern "^AC11" test/e428-tracker-mirror.test.mjs` — exit 0 — pass
- AC12 — `node --test --test-name-pattern "^AC12" test/e428-tracker-mirror.test.mjs` — exit 0; `node --test test/e437-repo-only-paths.test.mjs test/error-code-contract.test.mjs` — exit 0 — pass
- AC13 — `node scripts/test-lock.mjs -- npm test` — exit 0 (4789/4791 pass, 0 fail, 2 skipped); `git diff --name-only 32e7f7e -- '*.ts' dist templates tools .current/.config.json docs/config.md docs/lane-protocol.md` — empty; `GATE_REGISTRY` 33, `UPDATE_STATE_GATE_PIPELINE` 17 (dist import); `content/skill-integrator.md` 269 lines — pass

Each `--test-name-pattern "^ACn[: (]"` was also run alone to confirm it matches at least one test (12 patterns, 13
tests, 0 fail), so no proof passes on an empty match.

Negative controls (a copy of the tree in the scratch directory, outside the worktree):
- `content/skill-integrator.md` replaced by the round-1 text (`697bef8`) → AC8 fails on its first worked case
  (`raw integrator text, write-back: on, no map row: writes to ["1234"]`).
- Amended text with only `, whether or not the map has a row for the ticket` removed → AC8 fails on the same case.
- Restored to HEAD text → AC8 passes. The private-repository case is driven by the shipped wording, not a tautology.
## 2026-11-26T09:45:02.305Z — PASS — by code-reviewer

suite-result: 4789/4791 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

code-reviewer Round 2 — APPROVED (covers T-E428-01..07). F1 closed: amended C-IN1 (content/skill-integrator.md:222 intro counts an item the ticket file's `source` field lists; :225 **Source item** gets the updates when write-back reads `on`, whether or not the map has a row) and C-TF1 bullet 2 (docs/ticket-format.md:164-166) applied byte-exact, 3 lines each, integrator SOP still 269 lines. Private-repo trace (E900, source [1234 rev 7], map = write-back: on only) is consistent across C-IN1, C-TF1 (bullets 3/5, map bullet), C-CO1 (read-only resolve from source field or map, compare before work and before each code-reviewer dispatch) and C-SW2 (switch lets the integrator update source items). Every AC1–AC13 proof exits 0 (each pattern confirmed to match ≥1 test); full suite 4789/4791 pass, 0 fail, 2 unrelated history skips; bounds diff empty; GATE_REGISTRY 33, pipeline 17; all changed files in the owned set; round-2 delta touches only the two shipped files, the e428 test, spec and qa_reports. All 7 expected-red (pass 2) entries green, no red off the manifest. Negative controls outside the worktree: round-1 integrator text → AC8 red on the private case; dropping 'whether or not the map has a row for the ticket' → AC8 red; restored → green. Optional (non-blocking): C-SW2 and the map bullet still say 'under that/its source item' (deliberately left per spec amendment, for the closing report); C-TF1 bullet 6 does not say that turning write-back on counts as the request for source-item writes. Reports: review_reports/review_T-E428-01.md, qa_reports/review_T-E428-01.md.

