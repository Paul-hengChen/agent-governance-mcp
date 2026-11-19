# QA review — T-E441-01

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-11-18T06:25:47.921Z — PASS — by qa-engineer

suite-result: 4236/4238 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS. AC1: new test/e436-stale-handoff-paths.test.mjs pins no flat .current/handoff.md in CLAUDE.md, lines 13/220-221 primary path, lines 44/64/195 lane path, agc-version stamp present and equal to package version. AC2: template 13 lines, one trailing newline, lines 7/11 unchanged, line 9 exact new text, line 13 lane path with CRITICAL opening and NEVER kept. AC3/AC5/AC6: test/e441-tool-description-contracts.test.mjs checks the six descriptions equal the spec strings via dist/tools/registry.js TOOL_REGISTRY; tw_get_state blocked list equals the set of enforcePreFlight call-site tool names derived by scanning tools/ source (six); no specs/, MANDATORY, (E<digit>, uniform not-found, structurally reusable. AC7: dist diff vs 41c301e is only registry.js, registry.js.map, registry.d.ts.map; build clean; npm audit 0 high/critical (1 low, 6 moderate). AC8: full suite 4236/4238 pass, 2 skipped, 0 fail, run after the re-pin commit 2bbfe93 on a clean tree. check:bookkeeping exit 0. Review R1 (tw_get_state omits 1h idle-session eviction), O1-O3 noted, not blocking, not QA tasks. No out-of-lane reds.

## Expected-Red Diff
Phase 0.5: the 5 manifest entries were confirmed red against the sr build (owned files ran 91 tests, 86 pass / 5 fail, matching the manifest) and were dispositioned by re-pin to the new template text before the full-suite run; the full suite after the re-pin has 0 reds (0 unexplained reds, 0 strays).
- test/e404-release-engineer-template.test.mjs | AC-E404-1: now green, LOAD and RELAY constants re-pinned to new line 9 / line 13 text.
- test/e404-release-engineer-template.test.mjs | AC-E404-3: now green, LOAD re-pinned; retitled to "two-repeats sentence".
- test/e404-release-engineer-template.test.mjs | AC-E404-4: now green, RELAY re-pinned to the lane path.
- test/feature-lease.test.mjs | E9A-S4: now green, path regex re-pinned to .current/<lane>/handoff.md.
- test/subagent-templates.test.mjs | e9a AC2: now green, path regex re-pinned to .current/<lane>/handoff.md.

