# Judge report — T-E462-01 (e462-stale-comments-wording)

covers: T-E462-01, T-E462-02, T-E462-03, T-E462-09, T-E462-04, T-E462-05, T-E462-06, T-E462-07, T-E462-08

## Round 1 — APPROVED — by code-reviewer

Review report: `review_reports/review_T-E462-01.md`. Full suite: `node scripts/test-lock.mjs -- npm test` on a clean tree at a471ac8 (this round's claim/checkpoint state commit on top of 175953b), Node 22: 4697 tests, 4695 pass, 0 fail, 0 cancelled, 2 skipped, exit 0. The two skips are the history-dependent `test/e130-lane-default.test.mjs` AC4 / AC14 checks (commit 121ddc8 not resolvable), loud `t.skip`, not this feature's tests and not manifest rows; e108 AC2 green in this run. `npm test`'s prebuild left `dist/` unchanged; a separate `npm run build` before the suite also left `git status` clean apart from this round's state write.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e462-stale-comments-wording.txt`: 22 entry rows (16 in `test/e462-stale-comments-wording.test.mjs`, 6 re-pins in e161 / e236 / qa-flow / e423 / e445). Actual reds in the full suite: 0.

- Every manifest entry is green in this run — scenario test, now green — built (T-E462-03..08). Per entry:
  - `test/e462-stale-comments-wording.test.mjs` | AC1 ×2, AC2 ×1, AC3 ×2, AC4 ×4, AC5 ×1, AC6 ×3, AC7 ×2 — green (AC1–AC7 proofs below, 29/29).
  - `test/e161-qa-suite-result.test.mjs` | AC-E161-2 — green (heading re-pin satisfied by `gates/qa-review.ts:169`).
  - `test/e236-rejected-write-evidence.test.mjs` | AC-E236-6 — green (same).
  - `test/qa-flow.test.mjs` | recordReviewInFile creates qa_reports/review_<id>.md per task — green (same).
  - `test/e423-spec-workshop.test.mjs` | AC10 — green (sw.done).
  - `test/e445-spec-workshop-questioning.test.mjs` | AC5, AC6, AC9 — green (sw.reopen / sw.done).
- Actual reds not on the manifest: none.

## AC Execution Log

One entry per spec AC (no ticket file; the spec's ACs are the scenarios). Run in the worktree at a471ac8.

| AC | command | raw outcome | result |
|---|---|---|---|
| AC1 (resident) | `node --test --test-name-pattern "^AC1 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 4, fail 0 | pass |
| AC1 (judge-run) | scratch script: `ts.transpileModule` (`removeComments: true`, target/module ESNext, TypeScript 6.0.3) of `tools/transitions.ts`, `tools/registry.ts`, `tools/handoff-types.ts`, `schema/migrations-handoff.ts`, `gates/expected-red.ts`, `gates/registry.ts` at `83ca8c0` (via `git show`, in memory) and HEAD | `SAME` ×6, `diffs: 0`, exit 0 (every file's source differs; output byte-identical). No added/changed line in the diff contains `chain_path`; HOP_CAP head + both phrases, transitions.ts line-158 hint, the visual-cap comment and the gates/registry.ts mapping comment byte-identical (resident AC1 tests + diff read) | pass |
| AC2 | `node --test --test-name-pattern "^AC2 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 4, fail 0 (direct `handleUpdateState`: `qa-engineer` / `sr-engineer` / `""` rejected with `received resume_of: absent.`; stale value on the sr self-loop lands with no `resume_of` key; `code-reviewer` accepted and persisted) | pass |
| AC3 | `node --test --test-name-pattern "^AC3 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 4, fail 0; `EVIDENCE_SCHEMA_CURRENT` = 3 (also printed directly from `dist/gates/evidence-schema.js`) | pass |
| AC4 | `node --test --test-name-pattern "^AC4 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 7, fail 0; `GATE_REGISTRY.length` 33, `UPDATE_STATE_GATE_PIPELINE.length` 17 (printed from `dist/`) | pass |
| AC5 | `node --test --test-name-pattern "^AC5 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 4, fail 0 | pass |
| AC5 (mutations) | scratch copy of the worktree (outside it, `node_modules` symlinked), `gates/visual.ts` edited, `npx tsc`, then the AC5 proof | (a) `prototype` removed from `KNOWN_MODES`: tests 1–2 red (`prototype-v2` / `figma` instead of `prototype`), 3–4 green. (b) `if (firstUnknown === null)` → `if (true)` (last unknown wins): tests 3–4 red (`N/A` / `mockup`), 1–2 green. Restore + rebuild: whole file 29/29 green. Extra negative controls: normalisation disabled → AC2 behaviour tests 2–3 red; `unknownDesignModeNote` always `""` → AC4 message tests red; restored green. Never applied to the worktree | pass |
| AC6 | `node --test --test-name-pattern "^AC6 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 3, fail 0; `test/context-budget.test.mjs` green in the full suite | pass |
| AC7 | `node --test --test-name-pattern "^AC7 " test/e462-stale-comments-wording.test.mjs` | exit 0; pass 3, fail 0 | pass |
| AC8 | `node scripts/test-lock.mjs -- npm test` | exit 0; `# tests 4697`, `# pass 4695`, `# fail 0`, `# cancelled 0`, `# skipped 2` (e130 AC4 / AC14 history skips); every re-pinned test green; goldens and `test/context-budget.test.mjs` unchanged and green | pass |

Other checks: `node scripts/fanout.mjs check --cut specs/fanout-pre-v5-w2.md e462 specs/e462-stale-comments-wording.md` exit 0 (0 out of bounds); `node scripts/fanout.mjs check specs/fanout-pre-v5-w2.md e462 --base 83ca8c0` exit 0 (44 files, 0 out of bounds); `npm run build` then `git status --porcelain` showed only this round's `.current/e462/` state write; `npm audit --audit-level=high` exit 0; `node bin/agc-init.mjs check` exit 0 (OK, adapters current; one new advisory comment warning on `gates/expected-red.ts:1`, see the review report).
## 2026-11-25T11:01:11.728Z — PASS — by code-reviewer

suite-result: 4695/4697 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

APPROVED (round 1). AC1-AC8 all pass: AC1 transpileModule(removeComments, ESNext) invariance SAME for all six comment-only files vs 83ca8c0, kept lines intact, no chain_path in changed lines; AC2 direct no-zod resume_of behaviour unchanged (absent hint, not persisted, code-reviewer persisted); AC3 judge-report dir in message, new reports start '# Review — <id>', old-heading reports still credited, EVIDENCE_SCHEMA_CURRENT 3; AC4 unknown mode reported as written with the no-design note, arming unchanged, gates 33 / pipeline 17; AC5 both E461 (3) mutations re-run on this build (prototype removed from KNOWN_MODES -> AC5 tests 1-2 red; last-unknown-wins -> tests 3-4 red; green on restore); AC6/AC7 only the named sentences changed, no error code gained/lost, guide only gained text. Expected-red: all 22 manifest entries green, 0 reds off manifest. Scope: fanout check 44 files 0 out of bounds; dist equals npm run build. npm audit high exit 0. Non-blocking: recommended — gates/expected-red.ts header re-wrap 7->8 lines adds one advisory comment long-block warning; optional — stale wording left at tools/handoff-orchestrator.ts:737-739 and gates/visual.ts:862 (outside spec lines); 40-char cut may split a surrogate pair. Review report: review_reports/review_T-E462-01.md (covers all nine ids).

