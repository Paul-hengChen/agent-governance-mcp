covers: T-E275-01, T-E275-02

# QA review — E275 advisory upgrades (T-E275-01, T-E275-02)

Branch feat/e275-advisory-upgrades, HEAD 8b24cae, diff base f636029. Dispatch: qa-engineer (sonnet), Task-spawned.

Phase 0.5: skipped (no expected-red manifest declared for e275-advisory-upgrades).
Phase 1: reviewed package.json, lockfile resolution, docs/dependency-advisories.md diff. No correctness/scope concerns. Code-reviewer Q1 (residual-note trigger wording) and Q2 are non-blocking, out of QA scope.
Phase 1 3a/3b: N/A (no copy / visual tokens). Phase 1.5: skipped (no Visual Baselines). Phase 3: skipped — no test files in lane scope; no new tests warranted (dependency chore; AC proofs are commands). No pending-ticket filed.

## AC Execution Log

- AC1: `npm audit --audit-level=high; echo exit=$?` -> "8 vulnerabilities (2 low, 6 moderate)", exit=0. PASS.
- AC2: `npm ls @modelcontextprotocol/sdk proxy-addr sharp` -> sdk@1.32.1, proxy-addr@2.0.8 (via express@5.2.1), sharp@0.35.5 overridden; exit 0, no invalid/UNMET. PASS.
- AC3: `git diff f636029 -- package.json` -> exactly sdk `^1.29.0`->`^1.32.1` and overrides.sharp `^0.35.4`->`^0.35.5`; no proxy-addr override (lockfile refresh case, recorded in section 7). PASS.
- AC4: `node scripts/test-lock.mjs -- npm test` -> exit=0; tests 3043, pass 3040, fail 0, cancelled 0, skipped 3 (equals base baseline 3040/3043; no count change). PASS.
- AC5: `npm run build; echo exit=$?; git status --porcelain dist` -> exit=0, check:transitions-sync OK, porcelain dist empty. PASS.
- AC6: grep shows `### 6.`, `### 7.`, `#### Third round`, and all three GHSA ids present; section 5 has added 2026-10-07 line. Each new section has GHSA link, path, reachability, decision upgrade, re-review trigger. PASS.
- AC7: heading updated to 7 packages with re-dispositions; one appended dated 2026-10-07 note in residual section with measured totals (2 low, 6 moderate); no table rows changed (diff hunks show additions only). PASS.
- AC8: `git diff --name-only f636029` -> .current/e275/**, docs/dependency-advisories.md, package-lock.json, package.json, review_reports/review_T-E275-01.md, specs/e275-advisory-upgrades.md; plus this qa_reports file. All within allowed set. PASS.
- AC9: stop-rule not triggered (suite green, 0 failing). PASS (N/A).

## Verdict
PASS for T-E275-01 and T-E275-02.
## 2026-10-08T03:27:37.290Z — PASS — by qa-engineer

AC1-AC9 verified: audit high exit 0 (2 low/6 mod); npm ls sdk 1.32.1, proxy-addr 2.0.8, sharp 0.35.5; package.json diff exactly 2 lines; build exit 0, dist clean; full suite 3040/3043, 0 fail (equals baseline); advisories doc sections 6/7/Third round/5 line/heading/residual note present; scope within allowed paths. Phase 3 skipped (no tests in lane scope, none warranted; no pending-ticket filed). Code-reviewer Q1/Q2 non-blocking, untouched. Evidence qa_reports/review_T-E275-01.md.

