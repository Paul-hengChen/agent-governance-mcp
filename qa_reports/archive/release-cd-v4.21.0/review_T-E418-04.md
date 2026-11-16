covers: T-E418-01, T-E418-02, T-E418-03, T-E418-04

# QA review — E418 gate-retro prose trim

Reviewed at 523e2ff (tests/goldens) on top of 7a654e5 (content). Builder: sr-engineer; judge: code-reviewer APPROVED round 2; this is the independent QA pass.

## Expected-Red Diff

Phase 0.5. Manifest: qa_reports/expected-red_e418-gate-retro-prose-trim.txt (10 entries). Full suite run at 7a654e5 before any re-baseline edit.

- Goldens (7 entries, all red in my run): compose-equivalence build-full x4, hook-full, constitution monolith; skill-manifest t-golden-byte-identity. Each embeds trimmed const-08 / coord-03 / coord-04 / coord-06 text; diff of the re-captured fixtures shows only those four fragments moved. Disposition: caused only by the prose trim.
- e295 AC4, e392 AC9, feature-lease E10-AC8a (3 entries): my first full run was contaminated because I edited these three files while it ran (they passed, 7 reds). Re-ran the committed pre-edit versions (`git show HEAD:test/<file>`) in isolation: exactly these 3 red. Disposition: each pins a sentence the trim removed (AC4 hop-cap conditions in the row, AC9 the haiku list, AC8a the repo-only path `gates/feature-lease.ts` that must not be in adopter-served content).
- Unexplained reds: 0. Phase 0.5: clean (10/10 manifest entries confirmed red, 0 unexplained reds). All 10 are now resolved (green after re-capture / re-pin).

## Re-baseline record

- Goldens re-captured with `node scripts/capture-constitution-golden.mjs` (no hand edits): build-full-nondesign, build-full-design, build-full-nondesign-fd, build-full-design-fd (each -3961 bytes), hook-full (-3961), constitution-monolith (-3961), skill-coordinator-monolith (-5581). The four build-lite fixtures plus hook-lite stayed byte-identical (git status shows them unmodified). dist unchanged after build.
- context-budget caps (zero-headroom convention): design-arm stripped constitution 10598 -> 9533; teamwork stripped bundle 21715 -> 19225; non-design constitution 8518 -> 7533. Lean 5731, pm 4849, sr 2852 are unmoved (measured 5731 / 4847 / 2851). Savings floors left as is (design-only saving 2000 >= 1999).
- Pins re-pinned: e295 AC4 (row keeps HOP_CAP_EXCEEDED, the pointer to `docs/lane-protocol.md` section 3 and the human next_role; conditions (a)-(f) are now pinned in lane-protocol itself); e392 AC9 (no haiku list pairs release-engineer in coord-04 or the composition; coord-04 states the tier rule); feature-lease E10-AC8a (predicate stated in words, repo-only path asserted absent).

## Hint sufficiency (precondition)

| code | hint + remaining prose enough? | test |
|---|---|---|
| SCOPE_DECISION_REQUIRED | yes: hint names both clearing artifacts | already verbatim-asserted (visual-evidence-gate AC-4) |
| CUT_APPROVAL_REQUIRED | yes with residual: hint names only the PM path; const-08 and coord-03 still name the coordinator-attested writer | added prose pin in cut-approval-gate.test.mjs; hint verbatim already asserted (C2) |
| LEASE_OVERRIDE_AUDIT_MISSING | yes | hint asserted in feature-lease E10-AC2a (new) |
| QA_COMPLETION_EVIDENCE_MISSING | yes: evidence paths, covers:, review_task_ids route | hint asserted in e32-e33 R4 (new) |
| NON_QA_COMPLETED_TASKS_REJECTED | yes | hint asserted in reviewer-completed-tasks-gate FM6-FM11 (new) |
| REVIEWER_COMPLETED_TASKS_REJECTED | yes | hint asserted in FM1 (new) |
| amend-resume edge (TRANSITION_REJECTED + resume_of) | yes | already byte-asserted (e151 AC10-12) |
| HOP_CAP_EXCEEDED | yes with residual: hint says re-scope or override but does not list the continuation conditions; those are only behind the coord-03 pointer into docs/lane-protocol.md (Chinese-only) | hint asserted in hop-count-transitions (new); conditions pinned in e295 AC4 |
| token brake / manifest tier | no error code exists (observe/halt and pre-approval mechanisms), nothing to hint | n/a |

No hint text changed (tools/** and gates/** untouched).

## Normative spot check

Sampled against `git show main:`: Scope decision, QA Completion-Evidence, Non-QA Completed-Tasks, Cut-Approval (plus Auto-Tier allow flags). No lost condition: arming edge, predecessor pin, clearing artifacts, file-mode scope, newly-added-ids-only, review_task_ids route, strict predicate and both codes all survive. The coord-04 rule (last non-empty trimmed line, U+2014, hyphen/en dash counts as absent, name/tier case-insensitive, append if absent / replace if wrong, exactly one line) agrees with lib/watermark-check.ts and test/watermark-check.test.mjs.

Hygiene: the only path newly added to content/** is agc's `docs/lane-protocol.md` in coord-03, qualified as agc's (a generic doc that ships to adopters, same convention as skill-integrator). No local paths, usernames or internal names in files I wrote.

## AC Execution Log

No specs/e418-gate-retro-prose-trim.md (backlog-row-as-spec). Phase 3.5: skipped (no proof:-annotated ACs). Backlog-row checks run instead:

| check | command | result |
|---|---|---|
| build | `npm run build` | exit 0, dist unchanged (git status clean) |
| suite Node 22 | `npm test` | 4192 tests, 4190 pass, 0 fail, 2 skipped, exit 0 |
| suite Node 20 | `fnm exec --using=20 npm test` | 4121 pass, 69 fail, 2 skipped; all 69 are SQLite tests failing with a better-sqlite3 NODE_MODULE_VERSION 127 ABI mismatch (symlinked node_modules built for Node 22): environment, not product; zero non-SQLite failures |
| agc check | `node bin/agc-init.mjs check` | exit 0 (advisory only: context-budget.test.mjs comment ratio 39.2%) |
| audit | `npm audit --audit-level=high` | exit 0 (moderate findings only) |

Suite count is 4192 (baseline 4191 plus 1 new cut-approval prose pin).

## Verdict

PASS. No test-infra defects; hints are sufficient with two disclosed residual weaknesses (CUT_APPROVAL PM-only hint, HOP_CAP hint without the condition list).
## 2026-11-16T05:47:45.591Z — PASS — by qa-engineer

suite-result: 4190/4192 passed (server-recorded from qa_suite_result; command: npm test)

E418 PASS. Phase 0.5 clean (10/10 expected-red confirmed prose-trim only). 7 goldens re-captured by tool (lite fixtures byte-identical); 3 prose pins re-pinned; 3 context-budget caps lowered (10598->9533, 21715->19225, 8518->7533); hint-sufficiency verified with new hint assertions (residuals: CUT_APPROVAL PM-only hint, HOP_CAP hint without condition list, both covered by remaining prose). Node 22 green; Node 20 only better-sqlite3 ABI env failures. See qa_reports/review_T-E418-04.md.

