<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E238-01 [P1] qa-engineer: AC1 — test/verify-release.test.mjs VR-22 (:958): drop the elapsedMs < 5000 bound (and start/elapsedMs), keep the gh-call counter === "1"; name unchanged (specs/e238-load-sensitive-tests.md) | depends_on: none
- [x] T-E238-02 [P1] qa-engineer: AC2a+AC2b — test/e132-lane-registry.test.mjs gap-6 (:330-378) explicit generous timeoutMs + per-lane active_feature count instead of minLarge > minSmall; gap-7 (:284-305) bounded timing-discriminated retry vs the fixed 200 ms ceiling; names unchanged | depends_on: none
- [x] T-E238-03 [P1] qa-engineer: AC3 — test/teamwork-lite.test.mjs AC3b (:129-143): pass an isolated mkdtemp workspace (with .current/, no hook marker, removed in t.after) as workspace_path instead of PROJECT_ROOT; name unchanged | depends_on: none
- [x] T-E238-04 [P1] qa-engineer: AC4 — test/feature-lease.test.mjs: seedFileState (:154) and E10-AC3 re-stamp (:1088) use nonSuspectStampAt(-60_000) instead of freshNonSuspectStamp(); E10-AC2b (:1042-1061) gains an isFeatureLeaseHeld precondition assertion; whole file green; names unchanged | depends_on: none
- [x] T-E238-05 [P1] qa-engineer: AC5 — test/e177b-mailbox-watch.test.mjs AC19/AC15 multi-file case (:163-174): drive main() with an injected fake clock (now/date/sleep as AC16), append fileA inside the first sleep, --deadline 1 with several intervals; drop the real setTimeout and 0.006 deadline; name unchanged | depends_on: none
- [x] T-E238-06 [P2] qa-engineer: AC6 — confirm test/usage-accounting.test.mjs keeps the 20 s HOOK_TIMEOUT_MS unchanged (run + record, no edit; stop and mail integrator if it fails); record the final-HEAD full suite via node scripts/test-lock.mjs -- npm test | depends_on: T-E238-01, T-E238-02, T-E238-03, T-E238-04, T-E238-05
