covers: T-RELW5-01, T-RELW5-02, T-RELW5-03, T-RELW5-04, T-RELW5-05

# QA review — release-post-v4-w5 (evidence-only gate, main @ 475ae06, version 4.7.0)

Phase 0.5: skipped (no expected-red manifest declared). Phase 1.5: skipped (no Visual Baselines declared). Phase 3: skipped (evidence-only gate; no test files created or modified, per dispatch brief). Copy/Visual audits: N/A (spec declares none).

## AC Execution Log
- AC1 PASS. `git log --oneline v4.7.0..HEAD` = 56 commits. Forbidden-path diff: empty. `bin/` only agc-init.mjs; `content/` only skill-integrator/pm/qa-engineer; `dist/` only tools/{drift,fanout-manifest,lane-ticket-allocation,registry}.*. Every other changed path falls in a spec class. No out-of-class path.
- AC2 PASS. Review verdicts: E283 APPROVED, E288 APPROVED, E287 CHANGES_REQUESTED then APPROVED (later governs). All 15 qa_reports (E283/287/288/316/322/323/324/325/326) carry a PASS stamp. Lane handoffs e283/e287/e288: status PASS, last_agent qa-engineer. All lane ledger rows [x]. Backlog rows for all nine tickets DONE naming merges 1f0535e/95ec767/b9d9eab; all three are ancestors of HEAD (exit=0).
- AC3 PASS. `node scripts/test-lock.mjs -- npm test` exit 0: tests 3321, pass 3319, fail 0, skipped 2. No reruns needed.
- AC4 PASS. `npm run build` then `git status --porcelain dist/` empty (also empty after suite); check-version OK (4.7.0, exit 0; note HEAD past tag is expected); check:bookkeeping exit 0 (379 ticket rows); check:md-tables exit 0 (575 files).
- AC5 PASS. `npm audit --audit-level=high` exit 0 (8 vulnerabilities: 2 low, 6 moderate, 0 high/critical). package.json/package-lock.json diff vs v4.7.0 empty.
- AC6 PASS. `agc check` exit 0 ("OK (4.7.0) — all adapters current"); check-transitions-sync OK (21 keys).
- AC7 PASS. (a) closed w5 manifest: `fanout: ok — 3 dispatchable lane(s), 0 provisional, 10 decision(s)` exit 0; truncated copy: HANDOFF_SECTION_ABSENT exit 2. (b) sweep of 22 manifests: only fanout-wave5.1.md and fanout-wave6.md exit 2, each exactly {DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}, no HANDOFF_*. (c) owners --range v4.7.0...HEAD exit 1; HIT lines: tools/fanout-manifest.ts->e283, bin/agc-init.mjs->e287, content/skill-pm.md->e288; summary `fanout owners: 80 path(s), 60 hit(s), 3 dispatchable lane(s)`; git status unchanged. (d) setext named at tools/fanout-manifest.ts:1390. (e) 9 test files: 104/104 pass.
- AC8 PASS. (a) usage text: "finish warns, lists its findings…" and "target_repo: <repo> belongs to another repo: it gets no id here…". (b) 19 files: 334/334 pass, 0 skipped. (c) handoff-parse.ts diff empty. (d) only one removed line in verify-release.test.mjs (the VR-15 runVerifyWithPath call); no VR-22/VR-23 in diff.
- AC9 PASS. (a) bundle probe `true true true true`. (b) const/coord/fixtures diff empty. (c) no BASE_SHA/3c72a83/"diff" in e178a; no "archive"/"rev-parse"/BASE_CODE in e296. (d) 11 files: 185/185 pass; e178a/e296 skipped 0.
- AC10 PASS. v4.7.0^{commit} = 7dbb4fc40ddd5a0eb2cd3e336a34f58844345aa5; CHANGELOG [4.7.0] at line 19; `const HOP_CAP = 14` at transitions.ts:326; GATE_REGISTRY = 34; 15 v4.7.0 behaviour test files: 299/299 pass.

## Findings
None blocking. Worktree after run: only the pre-existing uncommitted .current/_primary/* and specs/release-post-v4-w5.md; dist/ clean; nothing committed.
## 2026-10-17T10:00:53.058Z — PASS — by qa-engineer

AC1-AC10 all PASS on main @ 475ae06 at version 4.7.0. Suite 3321 tests / 3319 pass / 0 fail / 2 skipped under test lock. dist byte-identical after build; check-version, check:bookkeeping, check:md-tables, npm audit (0 high), agc check, transitions-sync all exit 0. Evidence in qa_reports/review_T-RELW5-01.md (covers all five). No findings.

