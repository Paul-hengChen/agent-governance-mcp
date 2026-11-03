covers: T-E392-01, T-E392-02, T-E392-03, T-E392-04, T-E392-05, T-E392-06, T-E392-07, T-E392-08

# QA review — e392-subagent-templates (T-E392-01..08)

Verdict: PASS. Suite ran on HEAD cd1ebf65862c29b1ea9ceefdd74fdeb4023456c0 (test commits only on top of sr commits 616223b, cde349b, 93e901b, 7b5f920; code review APPROVED, review_reports/review_T-E392-01.md).

## Expected-Red Diff

Phase 0.5: manifest qa_reports/expected-red_e392-subagent-templates.txt (4 entries). All 4 were red pre-fix and are now green on the final HEAD (full suite 0 failures), so no unexplained reds:

- feature-lease E9A-S5 (regression guard) — now green: the stale `(haiku)` assertion block deleted (T-E392-08).
- feature-lease E17-S4 (regression guard) — now green: same, second block deleted (T-E392-08).
- subagent-templates "v3.21.2 AC2: haiku templates each contain an example reply suffix line…" — now green: `HAIKU_ROLES` is `["lite","doc-writer"]` (T-E392-05); release-engineer is covered by the non-haiku reverse test.
- skill-manifest t-golden-byte-identity — now green: monolith golden recaptured (T-E392-07).

0 actual reds outside the manifest.

## Phase 1 audit

Copy audit (spec Copy / Strings): teamwork.load verified byte-for-byte by the AC7 test; coord02.alias by the AC12 tests (exactly once, after `preferred when available. `); coord04.haiku by the AC9 test; adapter.dispatch identical in `templates/agent-adapters/claude.md:12` and `CLAUDE.md:233` (and equals the spec string; AC-B11 / E101 tests green). No unsourced user-facing string. Visual: N/A. Phase 1.5: skipped (no Visual Baselines declared). Phase 3a: placement acted on per the brief's `Test-file placement` line (new `test/e392-subagent-templates.test.mjs` pre-authorized; `test/subagent-templates.test.mjs`, `test/skill-manifest.test.mjs` comments only, `test/feature-lease.test.mjs` the two blocks only, goldens).

## AC to test map

| AC | verified by |
|---|---|
| AC1, AC2, AC3 | e392 tests 1-4 (claude-code and no-config; recommended_model read from coord-01 frontmatter; byte parity with the compose pipeline) |
| AC4 | e392 test 5 (inputSchema enum has 10 values incl. `coordinator`; every enum value accepted via `run()`; unknown role rejected) |
| AC5 | e392 test 6 (not in ALLOWED_TRANSITIONS keys/targets, `next_role` enum, `dispatch_pins` properties) ; `git diff --stat 89e01c6 -- tools/transitions.ts gates/ schema/` empty |
| AC6 | see AC Execution Log |
| AC7 | e392 tests 7-8 (line 9 byte-exact; tightened regex matches new, rejects pre-E392 fixture); `test/subagent-templates.test.mjs` green |
| AC8 | e392 test 9; non-haiku reverse test now covers release-engineer |
| AC9 | e392 test 10 |
| AC10 | `test/subagent-templates.test.mjs` green with `HAIKU_ROLES = ["lite","doc-writer"]` |
| AC11 | `test/feature-lease.test.mjs` green; diff shows only the two deletions |
| AC12 | e392 tests 11-12 |
| AC13 | `test/e393-builder-judge-core.test.mjs`, `test/agc-adapters.test.mjs` green in full suite; `CLAUDE.md` differs from base on one line |
| AC14 | see golden hunks |
| AC15 | see budget table |
| AC16 | full suite below |

## AC Execution Log

- AC6: `git diff --stat 89e01c6 -- dist/` lists only dist/tools/registry.{js,js.map,d.ts,d.ts.map} and dist/tools/role.{js,js.map,d.ts,d.ts.map} (8 files, 10 insertions, 6 deletions). `npm run build` run fresh, then `git status --porcelain` listed only the golden recapture (no dist change). PASS.
- AC5 reviewer check: `git diff --stat 89e01c6 -- content/const-* tools/transitions.ts gates/ schema/` prints nothing for those paths (content diff is coord-02 and coord-04 only). PASS.
- AC11: `git diff 89e01c6 -- test/feature-lease.test.mjs` = two 8-line deletions at the E9A-S5 and E17-S4 blocks, nothing else. PASS.
- AC13: `CLAUDE.md` line 233 == `templates/agent-adapters/claude.md` line 12 (compared by eye and by tests); `git diff --stat` shows `CLAUDE.md | 2 +-`. PASS.
- `node bin/agc-init.mjs check`: exit 0, "OK (4.17.0) — all adapters current"; stamps unchanged (advisory comment-discipline warnings only; the one on my test header was fixed).
- `node --test test/e392-subagent-templates.test.mjs test/subagent-templates.test.mjs test/feature-lease.test.mjs`: 97/97 pass (one earlier combined run showed 1 failure while a file edit ran concurrently; not reproducible in 3 reruns and absent from the full suite).

## Golden hunks (AC14)

`node scripts/capture-constitution-golden.mjs` after `npm run build`: only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` differs; 2 hunks:
1. @@ -78: coord-02 line 1 gains the sentence "`Task(...)` throughout this SOP is shorthand for Claude Code's subagent-dispatch tool, named `Agent`; Task-dispatched and Task-spawned mean dispatched through it." (T-E392-04 alias).
2. @@ -223: coord-04 haiku list loses `@release-engineer` ("`@doc-writer`, `@release-engineer`)" becomes "`@doc-writer`)") (T-E392-03).
The other 11 goldens are unchanged.

## Context budget (AC15; test formula, ~tok, chars/4)

| figure | base 89e01c6 | after | cap |
|---|---|---|---|
| lean (bundle, measure-context-cost) | 5711 | 5711 | 5723 |
| non-design constitution | 8476 | 8476 | 8501 |
| design-arm constitution | 10475 | 10475 | 10598 |
| teamwork stripped bundle | 21479 | 21515 (+36) | 21715 |

No cap changed; `test/context-budget.test.mjs` green.

## Run

`node scripts/test-lock.mjs -- npm test` on HEAD cd1ebf6: tests 3871, pass 3869, fail 0, cancelled 0, skipped 2 (exit 0). `npm audit --audit-level=high`: exit clean, 7 moderate/low only, 0 high. Only `.current/e392/*` tracked state files were dirty during the run (from the qa claim write).
## 2026-11-03T05:54:41.631Z — PASS — by qa-engineer

suite-result: 3869/3871 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

All 16 ACs verified for T-E392-01..08 on HEAD cd1ebf6; expected-red 4/4 now green, 0 unexplained reds; golden differs only in skill-coordinator-monolith (2 hunks explained); teamwork bundle 21479 -> 21515 (cap 21715 unchanged), other figures unchanged; dist diff limited to role.* and registry.*; agc check exit 0. Detail in qa_reports/review_T-E392-01.md.

