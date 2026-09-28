# QA Review: T-E229-04

Spec: `specs/e229-history-independent-scope-tests.md` — AC8.
Task: add a short guard note to `docs/lane-protocol.md` against pinning
commit SHAs in permanent tests unless inherently historical, with the
guard-and-loud-skip requirement.

Documentation-only — no `proof:` command applies per the spec itself;
qa-engineer confirms by reading the added sentence (spec's own words).

## Phase 1 — Review

Added to `docs/lane-protocol.md` §3 (執行與驗證), immediately after the
existing "qa 的全套測試必須在 commit 之後…" bullet, as its own bullet:

> 常駐測試不要釘死歷史 commit SHA，除非斷言本質上就是在測一個歷史 diff（例如某條已收工
> lane 自己的 scope-containment 檢查）——這種情況下，SHA 查找必須用 `git rev-parse
> --verify <sha>^{commit}` 之類的 guard 包住，SHA 不存在時要大聲跳過（`t.skip(...)` +
> 明顯的警告訊息），絕不能靜默通過。範例見 `test/e130-lane-default.test.mjs`（E229）。

Checked against AC8's contract:
- States a permanent test must not assert on a specific historical commit SHA
  — present ("常駐測試不要釘死歷史 commit SHA").
- ...unless the assertion is inherently about a historical diff (e.g. a
  specific past lane's own scope-containment check) — present ("除非斷言本質上
  就是在測一個歷史 diff（例如某條已收工 lane 自己的 scope-containment 檢查）").
- ...in which case it MUST guard the SHA lookup and skip loudly (never
  silently) when the SHA is absent — present ("SHA 查找必須用 `git rev-parse
  --verify <sha>^{commit}` 之類的 guard 包住，SHA 不存在時要大聲跳過（`t.skip(...)` +
  明顯的警告訊息），絕不能靜默通過").
- ...per this ticket's own two examples in `test/e130-lane-default.test.mjs`
  — cited by name and by ticket (E229).

Placement: within §3 (執行與驗證), the section covering test-running /
scope-containment discipline for lane qa-engineers — no pre-existing "fanout
check" / scope-containment guidance paragraph exists in this file to sit
directly beside, so it stands as its own short bullet in the closest-fitting
section, per the AC's "or in its own short paragraph" alternative.

Copy Audit Gate / Visual Audit Gate: N/A (spec's Copy/Visual tables don't
apply to this AC; the guard sentence's own wording is not a spec-declared
Copy/Strings entry).

Phase 0.5 / Phase 1.5: skipped (no expected-red manifest, no Visual
Baselines declared).

## AC Execution Log

AC8 carries no `proof:` line (documentation-only, spec's own text: "This is
documentation-only — no `proof:` command applies; qa-engineer confirms by
reading the added sentence."). No command executed for this AC; confirmed by
direct read of `docs/lane-protocol.md` (quoted above) against the AC's own
required contract points, all four present.

## Phase 3 — Test File Discovery

N/A — this task edits `docs/lane-protocol.md` only (an owned file per the
dispatch brief), not a test file.

## Phase 4 — Run

Full lane suite (post-commit `7d84201`, clean tree): `2818/2818` pass, 0
fail, 0 skipped — confirms the doc-only edit introduced no regression (no
test file references `docs/lane-protocol.md`'s prose by byte content in a
way this edit could break; `test/e178a-integrator-role.test.mjs`'s
`LANE_PROTOCOL`-reading tests (AC11, AC14, AC15) assert on specific other
substrings, none of which this addition touches or duplicates).

## Verdict

**PASS.**
## 2026-09-27T15:06:44.925Z — PASS — by qa-engineer

All 4 tasks PASS. T-E229-01/02: test/e130-lane-default.test.mjs AC4/AC14 and test/e178a-integrator-role.test.mjs AC3/AC4/AC6(split)/AC15 made history-independent per spec AC1-AC6, guarded via git rev-parse --verify + t.skip + loud HISTORY-DEPENDENT AC SKIPPED notice; verified both the pass path (SHAs present, 121ddc8/5896bdd/3c72a83 all resolve here) and the skip path (temporary fake-sha substitution, reverted before commit). T-E229-03: AC7 — lane npm test 2818/2818 pass/0 fail/0 skipped; git-archive HEAD single-commit snapshot in $TMPDIR (never repo root, node_modules symlinked) reports 2815 pass/0 fail/3 skipped, exactly the 3 historical-only checks (e130 AC4, e130 AC14, e178a AC6-historical), each carrying the HISTORY-DEPENDENT AC SKIPPED notice (grepped, 6 occurrences = 2 per skip x 3). T-E229-04: AC8 guard sentence added to docs/lane-protocol.md §3. Commit 7d84201. Per-id evidence in qa_reports/review_T-E229-0{1,2,3,4}.md.

