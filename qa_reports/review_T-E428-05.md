# Review — T-E428-05

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-26T09:02:31.504Z — FAIL — by code-reviewer

suite-result: 4789/4791 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

code-reviewer Round 1 — CHANGES_REQUESTED (scenario defect → pm). Implementation matches the spec Copy byte for byte; every AC1–AC13 proof: command exits 0; full suite 4789/4791 pass, 0 fail, 2 unrelated history skips; bounds diff empty; GATE_REGISTRY 33, pipeline 17; golden hunk = C-CO1 only; caps 1663/19699 = measured; four re-pins value-only; negative control turns AC6/AC8/AC12 red; all 17 expected-red entries green, no red off the manifest. REQUIRED F1 (Copy): private repo, ticket E900 cut from item 1234 → ticket file `source: [1234 rev 7]`, no map row (C-TF1 bullet 3: only 'every other number' and public-repo source items go in the map; C-SW2 records only created items). Human sets `write-back: on`. Integrator (C-IN1 intro, content/skill-integrator.md:222) sees no E900 row → 'No row, no write' → item 1234 never updated, though C-TF1 bullet 5 (docs/ticket-format.md:171) and C-SW2 say the switch enables source writes; ticket addendum requires write-back 'enabled per workspace' and spec cut decision 4 names no repo type. C-CO1 already resolves via 'the file's `source` field ... or the tracker map', so the integrator asymmetry is an oversight. Fix options for pm: (a) C-IN1 also treats items in the ticket file's `source` field as source items; or (b) C-TF1/C-SW2 record source items in the map in every repository when a mirror is asked for. Add an AC8 private-repo case; re-measure the copy-bearing pins, golden and caps. Optional: ticket-format.md:164-165 'one child item under that item' is ambiguous when `source` lists several items. Reports: review_reports/review_T-E428-01.md, qa_reports/review_T-E428-01.md (covers T-E428-01..05).

