# QA review — release-post-v4-w13 (v4.16.0 evidence-only release gate)

covers: T-RELW13-01, T-RELW13-02, T-RELW13-03, T-RELW13-04, T-RELW13-05

Verified on committed `main` @ `6e3002f` (PR #55 merge), local Node v22.22.3, against CURRENT version 4.15.0. Working tree carried only expected uncommitted bookkeeping (`.current/_primary/{dispatch.jsonl,handoff.md,tasks.md}`, `specs/release-post-v4-w13.md`, this report) plus the untracked, out-of-release `docs/agc-ticket-draft-wc32.md` (left alone). No code, test, package, CHANGELOG, CLAUDE.md or stamp edits. Phase 0.5 skipped (no expected-red manifest for this feature). Phase 1.5 skipped (no Visual Baselines). Phase 3 skipped (evidence-only gate; dispatch brief: no test file created or edited).

## AC Execution Log

### AC1 (T-RELW13-01)
- commits since v4.15.0 -> 33; changed paths -> 56; dist -> 11; test -> 8. PASS
- first-parent merges: exactly `6e3002f` #55, `35f20e2` #54, `1530622` #53, `7209e1a` #52. PASS
- non-.current paths per lane merge: 5e0b8b1=23, 029f94d=17. PASS
- bookkeeping merges: #52 = three `.current/_primary/*` files; #53 = `docs/backlog.md`; #54 = `docs/v4.0.0-new-tickets.md`, `specs/fanout-post-v4-w13.md`. `.current/history` = 9. PASS
- untouched-set diff -> empty. content -> 1. module-class diff -> exactly the 8 expected lines. `docs/agc-ticket-draft-wc32.md` tracked=1 (untracked). PASS

### AC2 (T-RELW13-01)
- Review reports: e383 Round 1 APPROVED (covers T-E383-01, T-E385-01..03); e384/e386/e346 each Round 1 APPROVED. PASS
- QA files: 8, each `pass=1 fail=0`; covers lines as specified. PASS
- Lane handoffs e383/e384: `status: "PASS"`, `last_agent: "qa-engineer"`, hop_count 4. Ledgers 7 x / 0 void / 0 open each. PASS
- Backlog: E383, E385 -> `5e0b8b1`; E384, E386, E346 -> `029f94d`; E345, E387-E390 present, none DONE/VOID. Queue #162, #198-#201 DONE; #202-#205 not. PASS
- Ancestry: no NOT line; second parents f9a1a96, fef36cc, 71af285, d3926a0, c103f89, 8eb32bd. PASS

### AC3 (T-RELW13-02)
- `node scripts/test-lock.mjs -- npm test`, Node v22.22.3 -> exit 0; tests 3838, pass 3836, fail 0, skipped 2 (the two loud HISTORY-DEPENDENT skips in e130-lane-default, commit 121ddc8 unresolvable). First run green: no rerun needed, no e132 gap-4 / E224 / E370 / E378 recurrence data. PASS

### AC4 (T-RELW13-02)
- `npm run build` exit 0; `git status --porcelain dist/` empty. check-version `OK (4.15.0)` exit 0. check:bookkeeping OK (434 ticket, 222 queue, 337 decision rows) exit 0. check:md-tables OK (676 files, 0 malformed) exit 0. PASS

### AC5 (T-RELW13-02)
- `git diff --stat v4.15.0..HEAD -- package.json package-lock.json docs/dependency-advisories.md` empty. `npm audit --audit-level=high` exit 0; 7 vulnerabilities (1 low, 6 moderate). `npm ls`: zod@4.6.7, body-parser@2.4.0, no invalid/UNMET/extraneous. PASS

### AC6 (T-RELW13-02)
- `agc check` -> `agc check — OK (4.15.0) — all adapters current`, exit 0, no worktree warning. check-transitions-sync OK (21 keys). PASS

### AC7 (T-RELW13-02)
- HEAD = `6e3002f…`. Nine CI runs all `success` with `test (20)=success` and `test (22)=success`; head shas 6e3002f, 8eb32bd, 8eb32bd, 029f94d, d3926a0, c103f89, 7209e1a, 1530622, 35f20e2 as specified. PASS

### AC8 (T-RELW13-03)
- (a) fanout diff = `tools/fanout-handoff.ts` + 4 `dist/tools/fanout-handoff.*` only; 30 manifests; only wave5.1 and wave6 exit 2 with `{DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}`; w13 `fanout: ok — 2 dispatchable lane(s), 0 provisional, 13 decision(s)` exit 0. PASS
- (b) owners exit 1; `56 path(s), 40 hit(s), 2 dispatchable lane(s)`; 23 e383, 17 e384; 0 multi-lane HIT lines; 6 source/prose attributions as specified; the 16 non-HIT paths are exactly the Bookkeeping set. PASS
- (c) `handoff --closing` exit 0, `## 接手步驟` with four `###` sub-items. PASS
- (d) `handoff --check` -> `5 fact(s) checked, 2 differ, 2 moved`, exit 1. MOVED: target branch, worktree. DIFF: `git status` and `lane-status` only, explained by this feature's own bookkeeping, the untracked draft file and the new active_feature. PASS
- (e) usage lines = 5; exit 2. `git status --porcelain` unchanged across the runs; no stack traces. PASS
- (f) 21 fanout regression test files: 235 tests, 235 pass, 0 fail. PASS

### AC9 (T-RELW13-04)
- Dist probe output matched the spec expectation exactly on all six lines (old: h2-code and inline-prose armed as figma; new: null/unarmed; ledger old `.current/tasks.md`, new `.current/e900/tasks.md`; unchanged cases identical). PASS
- Registry/pipeline/versions: `35 18 {"handoff":15,"tasks":2,"sqlite":2,"config":2}`. Signature-line grep count 0. Ten named tests: 248/248 pass. PASS

### AC10 (T-RELW13-04)
- Scripts probe output matched the spec expectation exactly on all 13 lines (agc-check old 2 warnings vs new 1 outside-symlink warning, exit 0; E386 matrix old/new incl. `err.target-recorded`, `err.target-default`, `--target trunk` 5 facts, `--target nope`). Scratch dirs removed; `git status` unchanged. PASS
- `isRepoRoot` + `"--show-toplevel"` present in `tools/fanout-handoff.ts` and `dist/tools/fanout-handoff.js`; only new error-code literal `"REF_NOT_FOUND"`. Eight named tests: 117/117 pass. PASS

### AC11 (T-RELW13-05)
- Content line grep: 1 in content and 1 in golden. numstat `1 1`, `3 1`, `1 1` as specified. lane-protocol grep = 3. PASS
- `bin/agc-init.mjs` seven hunks at new-file lines 625, 645, 663, 696, 709, 714, 716 (all < 1755 `function evidenceAtRisk`); old helper names match once, a comment at line 1750 (E389, open); `--help` byte-identical (`help-same`); only `bin/agc-init.mjs` changed among bin/package.json/fanout-manifest/tasks-file. `gates/visual.ts` hunks only in the parseDesignMode comment block and body. PASS
- Eleven named tests: 182 tests, 180 pass, 0 fail, 2 skipped (loud HISTORY-DEPENDENT skips, commit 121ddc8 unresolvable; same two as AC3). PASS

### AC12 (T-RELW13-03)
- v4.15.0 -> `f016252da3bfa7ca07bf22f0bb586a064ed21341`, ancestor exit 0; CHANGELOG `[4.15.0]` at line 19; `HOP_CAP = 14`; `{"handoff":15,"tasks":2,"sqlite":2,"config":2} 35 13 12`; schema diff empty. PASS
- Test-file counts: 221 at HEAD, 216 at v4.15.0. PASS
- CLAUDE.md baseline recorded (not a finding): `216 test files` at lines 122 and 154 (release-engineer corrects to 221); `1633/1633 at v3.94.0` at line 159 stays per human ruling. Other counts correct: 35 entries/definitions, thirteen tools, 18-step, 12 role prompts, 15 const, 7 coord, 12 skill files (11 other), 12 templates, index.ts 311 lines. PASS
- Governance-core tests: 287/287 and 415/415 pass. PASS

## Verdict
All of AC1-AC12 hold. PASS.
## 2026-10-30T05:47:15.743Z — PASS — by qa-engineer

suite-result: 3836/3838 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

AC1-AC12 of specs/release-post-v4-w13.md all hold on main @ 6e3002f, Node v22.22.3, version 4.15.0. Full suite under test lock: 3838 tests, 3836 pass, 0 fail, 2 skipped (loud history-dependent skips in e130), exit 0 on the first run, so no rerun and no load-sensitive recurrence data. Build clean, dist byte-identical; check-version, check:bookkeeping, check:md-tables, agc check, transitions-sync OK; npm audit high exit 0 (7: 1 low, 6 moderate); nine CI runs success on Node 20 and 22. Dist and scripts old-vs-new probes matched expected output exactly. Full evidence in qa_reports/review_T-RELW13-01.md (covers all five ids). CLAUDE.md baseline recorded: 216 test files x2 (to 221 by release-engineer); 1633/1633 line stays per human ruling.

