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

