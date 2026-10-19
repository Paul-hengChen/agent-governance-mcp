covers: T-RELW8-01, T-RELW8-02, T-RELW8-03, T-RELW8-04, T-RELW8-05

# QA review: release-post-v4-w8 (v4.11.0 gate, verified at 4.10.0, main @ 2cf0fff, Node v22.22.3)

Phase 0.5: skipped (no expected-red manifest declared)
Phase 1.5: skipped (no Visual Baselines declared)
Phase 3: skipped (evidence-only release gate; no test files created or modified; probes under scratch dir only)
Copy Audit / Visual Audit: N/A (spec declares none)

## AC Execution Log

- AC1: `git log --oneline v4.10.0..HEAD` = 46 commits. Forbidden-path diff empty. `git diff --name-only v4.10.0..HEAD -- content dist` = `content/skill-integrator.md` + `dist/tools/{config,fanout-handoff,fanout-manifest}.{d.ts,d.ts.map,js,js.map}` only. Every changed path classified into e292 / e290 / lane-evidence / dist / human-ruled / bookkeeping; zero unclassified. PASS.
- AC2: both review_reports APPROVED; qa_reports PASS blocks present (T-E290 round 1 FAIL, round 2 PASS governs; T-E292-01 covers line names all seven ids); both lane handoffs `status: "PASS"`, `last_agent: "qa-engineer"`; ledgers 7/7 and 2/2 `[x]`; backlog E290/E292/E342/E343/E344 DONE with merge shas, E345-E353 rows present; dfd585b, 7af69ca, 936be52 ancestors (exit=0). PASS.
- AC3: `node scripts/test-lock.mjs -- npm test` exit=0; tests 3557, pass 3555, fail 0, cancelled 0, skipped 2 (Node v22.22.3). PASS.
- AC4: `npm run build` exit 0; `git status --porcelain dist/` empty; check-version OK (4.10.0) exit 0; check:bookkeeping exit 0 (397/185/252 rows); check:md-tables exit 0. PASS.
- AC5: `npm audit --audit-level=high` exit 0 (8 vulnerabilities: 2 low, 6 moderate, 0 high); package.json/package-lock.json diff vs v4.10.0 empty. PASS.
- AC6: `agc check` exit 0 (4.10.0, all adapters current); check-transitions-sync OK (21 keys). PASS.
- AC7: HEAD = 2cf0fff7b9bb...; runs 39223420591 (2cf0fff), 39222661780 (1ca86bc), 39219943832 (dfd585b) each `success`, `test (20) success`, `test (22) success`. PASS.
- AC8: (a) only wave5.1 and wave6 exit 2 with {DECISIONS_SECTION_ABSENT, PINS_SECTION_ABSENT}; no tracked manifest has `## 外部依賴`; w8 validates `fanout: ok - 2 dispatchable lane(s)`. (b) well-formed copy exit 0; bad-header copy exit 2 `EXTERNAL_DEPS_HEADER_DIFFERS`. (c) `handoff --check --repo .` exit 2 `SISTER_REPO_UNKNOWN`; 4 EXTERNAL_DEPS codes + TEMPLATE_POINTER_ABSENT in dist manifest; SISTER_REPO_UNKNOWN/NOT_GIT in dist handoff. (d) `true 1 function`; usage lines = 5, exit 2. (e) `--closing` exit 0 with `## 接手步驟` and four `###` items; `handoff --check` exit 1, "5 fact(s) checked, 2 differ, 2 moved", DIFF lines only `git status` and `lane-status`, explained by this feature's own bookkeeping; `owners` exit 1, all 8 required HIT attributions to the named lanes, summary `63 path(s), 46 hit(s), 2 dispatchable lane(s)`; the 17 non-HIT paths are all bookkeeping-class or `docs/existing-test-allowlist-drift-2026-10-19.md`; `git status --porcelain` unchanged across probes; no stack traces. (f) 23 test files: 294/294 pass; the five named tests unedited since v4.10.0. PASS.
- AC9: CURRENT_VERSIONS `{"handoff":15,"tasks":2,"sqlite":2,"config":2}`; schema diffs empty; config schema_version 2; config diff exactly one `+` line, zero `-`; docs/config.md has 1 sisterRepos and 1 laneProtocolAddendum section, each "schema_version stays 2", sisterRepos section names both SISTER_REPO codes, `first segment is` present, `a path that starts with ..` count 0, `Run render from primary` present; loadConfig prints `docs/lane-protocol-addendum.md true`; 11 config test files 245/245 pass. PASS.
- AC10: headings byte-identical (8, last `## 7. 中途修 base...`); numstat `14 14`; generic file counts all 0 (fourteen); addendum counts all >=1; path has no `approval`; commit 7c01795 adds both addendum and config line; render exit 0, line 3 starts `先完整讀 docs/lane-protocol.md` and names the addendum, line 4 starts `` `feature start` 建好 worktree 之後 `` ; leak check no LEAK lines; 9 test files 116/116 pass. PASS.
- AC11: bundle phrase counts `1 1 1 1 1 1 1 1 0 0`; only `content/skill-integrator.md` changed under content/fixtures/context-budget; numstat e178a `1 1`, e285 `29 0`; 13 SOP/content test files 195 pass, 0 fail, 2 skipped; v4.10.0 resolves to bad688f6..., ancestor (exit 0), CHANGELOG `[4.10.0]` line 19, `HOP_CAP = 14`, GATE_REGISTRY 34; 14 governance-core test files 335/335 pass. PASS.

## Verdict
PASS for T-RELW8-01..05 (AC1-AC11 all hold). No code, test, dist or doc file changed by QA.
## 2026-10-19T08:59:39.984Z — PASS — by qa-engineer

AC1-AC11 verified at 4.10.0, main 2cf0fff, Node 22.22.3. Suite 3557 total / 3555 pass / 0 fail / 2 skipped under test lock; build clean, dist byte-identical; check-version, bookkeeping, md-tables, agc check, transitions-sync, audit (0 high) all exit 0; CI runs 39223420591/39222661780/39219943832 success on Node 20+22; AC8-AC11 probes and targeted test groups all green. Evidence: qa_reports/review_T-RELW8-01.md (AC Execution Log).

