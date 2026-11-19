covers: T-E419-01, T-E419-02, T-E419-03, T-E419-04, T-E419-05, T-E419-06, T-E419-07

# QA review — E419 retire Bookkeeping-Write and Stamp-Provenance

Verdict: PASS. Code review APPROVED T-E419-01..04 (`review_reports/review_T-E419-01..04.md`); qa verified the source against every AC and authored T-E419-05..07.

## Expected-Red Diff

Phase 0.5: the manifest `qa_reports/expected-red_e419-retire-bookkeeping-stamp.txt` lists 42 reds in 14 files. The code-reviewer's full run on HEAD (test-lock) recorded 4310 tests, 42 failed, failing names equal to the 42 manifest entries exactly (0 unexpected, 0 expected-but-green). qa's own first full run was interrupted and discarded because test edits began while it ran; the post-edit full run below is the authoritative result.

Disposition of every entry (each re-pinned to the new intended behaviour, none weakened):
- `compose-equivalence` (6): six goldens re-captured once; see Goldens.
- `drift-stamp-advisory` (7): dedicated suite for the removed `stampAdvisory`; file deleted. New `test/e419-retired-write-mechanisms.test.mjs` asserts the key is absent.
- `e148-stamp-provenance-seed` (1, whole file): dedicated suite for the deleted gate module; file deleted.
- `e18-write-provenance` (whole file): stamp-provenance import and STAMP-*/CONTENT-1/1b tests removed; every QAEV test and CONTENT-2/3 kept (CONTENT-3 now asserts the retired code is not cited).
- `e20-e21-crash-resilience` (5): QA/SR-E21-2 assert no `bookkeeping_write` argument; QA/SR-E21-4 assert "an ordinary write that refreshes the lease" and no administrative/untouched/file-mode-only wording; CROSS-1 asserts the same on both SOP lines.
- `e26-gate-stats` (6), `e308-single-source-tier-enum` (1), `error-code-contract` (3): 36 -> 34; two retired allowlist rows dropped.
- `e35-pipeline-order` (3): 19 -> 17, the two retired steps dropped, all other steps in the same order.
- `e394-release-sop` (1): STAMP assertion replaced by assertions that the relay rule still forbids hand-editing, says no dispatch brief overrides it, and no longer cites the retired code.
- `e410-task-alias-content-tail` (1): `const-08-chain-31-mid.md` line count 13 -> 11.
- `e437-repo-only-paths` (1): site 2 retired (its anchor sentence is deleted); `gates/stamp-provenance.ts` dropped from the bundle banned list (module gone).
- `e441-tool-description-contracts` (1): `tw_detect_drift` pinned to the sr-implemented description `... tasksIncomplete, fanoutAdvisory, evidenceBackedIds }; details has one line per finding, and fanoutAdvisory is null or a note that never sets driftDetected.` (singular; ruled by code-reviewer deviation (a)).
- `feature-lease` (5): E10-AC5a/5b/6a/6b, SQLite AC9b and E10-AC8b removed; `AC4 (e10)` keeps its name and first assertion (heal preserves `last_updated`) plus a plain different-feature write accepted against the stale age; E9A-S1 asserts "No dispatch brief overrides this rule" instead of the code.

No unexplained red; no regression.

## Spec-to-Test Map

- AC1: `e419-retired-write-mechanisms` "AC1" (inputSchema has no key).
- AC2: "AC2" tests (both codes absent from registry and pipeline; 34 / 17); `e35`, `error-code-contract`.
- AC3: two "AC3" tests (stale key dropped and write accepted with a fresh stamp; different feature gets FEATURE_LEASE_HELD, no bookkeeping error).
- AC4: `feature-lease` `AC4 (e10)`.
- AC5: `e20-e21-crash-resilience`.
- AC6: AC proof (below) plus `e437`/orchestrator import checks.
- AC7: two "AC7" tests (`:00.000Z` stamp accepted; `stamp-remediation:` kept as an ordinary note).
- AC8: "AC8" tests (no `stampAdvisory` key; description does not name it); `e441`.
- AC9: `e394-release-sop`, `feature-lease` E9A-S1.
- AC10: `e35`, `error-code-contract`, `e26`, `e308`.
- AC13: `e437`, `e410`.
- AC14: suite below. AC16/AC17: Goldens and Budget.
Coverage: removal-only change; the new suite exercises the changed boundary (tool-boundary parse, orchestrator write, drift report). Security smoke: an invalid payload carrying the stale key is still rejected (boundary test).

## Phase 1 audits

Copy Audit (3a): the two new strings match Copy / Strings verbatim (sr: "an ordinary write that refreshes the lease (the feature is alive)."; qa: "an ordinary write that refreshes the lease;"); grep of content found no other new user-facing string. Visual (3b) / Phase 1.5: N/A (no visual tokens, no design file). Phase 3.5: proofs present, executed below. Phase 3: placement per the dispatch brief (re-pinned existing files; new file `test/e419-retired-write-mechanisms.test.mjs`).

## AC Execution Log

- AC1: `node --input-type=module -e "...console.log('bookkeeping_write' in t.inputSchema.properties)"` printed `false`; `grep -c bookkeeping_write tools/registry.ts` printed `0`. PASS.
- AC2: `test/e419-retired-write-mechanisms.test.mjs` passes (10/10). PASS.
- AC3: same file, two AC3 tests pass. PASS.
- AC4: `test/feature-lease.test.mjs` passes including `AC4 (e10): migration heal-write preserves pre-heal last_updated verbatim`. PASS.
- AC5: `test/e20-e21-crash-resilience.test.mjs` 13/13; `grep -c bookkeeping_write` on both SOPs printed `0` and `0`. PASS.
- AC6: `ls gates/stamp-provenance.ts dist/gates/stamp-provenance.js 2>&1 | grep -c "No such file"` printed `2`; `git grep -n "stamp-provenance" -- tools gates lib prompts bin scripts index.ts` printed nothing. PASS.
- AC7, AC8: same new file, AC7 and AC8 tests pass; `e441` passes. PASS.
- AC9: `test/e394-release-sop.test.mjs` 29/29 and `feature-lease` E9A-S1 pass; `grep -c STAMP_PROVENANCE content/skill-release-engineer.md` printed `0`. PASS.
- AC10: `e35`, `error-code-contract`, `e26`, `e308` pass (counts 34 / 17). PASS.
- AC11: the live-tree `git grep -n -E "<retired names>" -- . ':!dist' ...` printed nothing. PASS.
- AC12: `git grep -n -E "19-step|19 steps|36 entries|33 gate" -- README.md CLAUDE.md docs/architecture.md CONTRIBUTING.md` printed nothing; `git diff c29f100 -- CLAUDE.md | grep -c agc-version` printed `0`. PASS.
- AC13: `test/e437-repo-only-paths.test.mjs` passes; code-reviewer read every content hunk. PASS.
- AC14: `node scripts/test-lock.mjs -- npm test` after commit, `git status --porcelain` empty: exit 0, `# tests 4312`, `# pass 4310`, `# fail 0`, `# skipped 2`. Both dedicated suites deleted; `e148-seed-stamp.mjs` exports `SAFE_SEED_STAMP`, `forceSeedStamp`, `forceSeedStampIfExists`, `freshNonSuspectStamp`, `nonSuspectStampAt` unchanged, `SUSPECT_SEED_STAMP` dropped (its only importer was the deleted suite; grep confirms no other user). PASS.
- AC15: `git diff c29f100 -- schema/` printed nothing. No handoff schema bump: `schema/` untouched, versions unchanged (`bookkeeping_write` was never persisted, `stampAdvisory` lived only in the drift report). PASS.
- AC16: `npm run build && node scripts/capture-constitution-golden.mjs`, run once: `git status --porcelain test/fixtures/compose-golden/` lists exactly the six expected files; the six lite and coordinator-monolith goldens are byte-identical. See Goldens. PASS.
- AC17: caps lowered to measured values, `node --test test/context-budget.test.mjs test/compose-equivalence.test.mjs` 68/68. No floor changed. PASS.
- AC18: `git diff --stat c29f100 -- dist/ | grep -v -E "dist/gates/|dist/tools/(handoff-orchestrator|handoff-parse|handoff-write|registry|drift)\." | grep -c "|"` printed `0`; `git status --porcelain dist/` empty after build. PASS.
- `npm audit --audit-level=high` after the build: exit 0 (moderate advisories in `@hono/node-server` and `esbuild` only, unrelated to this change).

## Goldens

Each of the six changed files is a removal of exactly two lines (12 deletions total, 0 insertions), the Bookkeeping-Write and Stamp-Provenance bullets of `const-08-chain-31-mid.md`:
- `build-full-design.txt`, `build-full-design-fd.txt`, `build-full-nondesign.txt`, `build-full-nondesign-fd.txt`: the dispatched constitution (origin tags stripped; `-fd` keeps rationale) loses the two bullets.
- `constitution-monolith.txt`: the concatenated constitution loses the two bullets.
- `hook-full.txt`: the SessionStart full-mode output (origin-tagged) loses the two bullets, with their `<!-- origin -->` fences.
The checkpoint-line wording lives in the role SOPs, which these goldens do not include, so it does not appear in any hunk.

## Budget (measured, chars/4, zero headroom)

- non-design constitution cap: 7484 -> 6937 (measured 6937)
- design-arm stripped constitution cap: 9387 -> 8840 (measured 8840)
- teamwork stripped bundle cap: 19012 -> 18465 (measured 18465)
- skill-sr stripped body cap: 2816 -> 2805 (measured 2805)
All four equal the PM probe numbers; no difference. No floor changed.

## Task verification

T-E419-01..04 (code-reviewer APPROVED): deleted module and its four `dist/` files absent; registry 34, pipeline 17 in the old order minus steps 2 and 4; writer option `preserveLastUpdated` set only by the migration heal; E21 checkpoint lines are ordinary writes; docs say 17 / 34; no repo-only path in `content/**` hunks. All ACs above hold. T-E419-05..07 delivered by qa as described.
## 2026-11-19T10:53:19.102Z — PASS — by qa-engineer

suite-result: 4310/4312 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

PASS: all ACs AC1-AC18 hold. 42 manifest reds each re-pinned (none weakened); 2 dedicated suites deleted; new test/e419-retired-write-mechanisms.test.mjs; 6 goldens re-captured (removal of the two const-08 bullets only); 4 budget caps lowered to measured 6937/8840/18465/2805; schema/ untouched; dist scope clean; full suite after commit green. Details: qa_reports/review_T-E419-05.md (covers T-E419-01..07).

