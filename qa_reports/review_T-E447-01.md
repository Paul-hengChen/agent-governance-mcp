# Judge report — T-E447-01 (round 1, batched)

covers: T-E447-01, T-E447-02, T-E447-03, T-E447-04, T-E447-05, T-E447-06, T-E447-07

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Full suite on HEAD db6e693 (clean tree apart from the code-reviewer's own `.current/e447/` claim write): `node scripts/test-lock.mjs -- npm test` → tests 4817, pass 4815, fail 0, skipped 2, exit 0 (duration 449 s). `npm run build` → 0 errors, `git status --porcelain` shows no `dist/` change. `npm audit --audit-level=high` → exit 0 (1 low + 6 moderate, pre-existing, no dependency change).

## Expected-Red Diff

Manifest `qa_reports/expected-red_e447-local-knowledge-files.txt`: 39 entries (24 e447 scenario tests from T-E447-01, 15 re-pin reds from T-E447-05). Actual reds in the full suite: 0.

- 24 entries `test/e447-*.test.mjs | AC1 … AC12, Copy …`: scenario tests, now green, built by T-E447-02/03/06/04/07.
- 1 entry `test/lane-paths.test.mjs | REG1 …`: re-pinned (9 entries), now green.
- 6 entries `test/compose-equivalence.test.mjs | …` and 1 entry `test/skill-manifest.test.mjs | t-golden-byte-identity …`: goldens re-captured; each of the 7 golden hunks is the C-C08K line (+1) or the C-CO3K append (1 changed line whose old text is its prefix). Now green.
- 3 entries `test/context-budget.test.mjs | AC8/AC-P2-7 …`: caps re-baselined to 9541 / 19905 / 7629 (+134 / +206 / +134, which matches C-C08K at 536 chars and C-CO3K at 289 chars). Now green.
- 2 entries `test/e410-task-alias-content-tail.test.mjs | AC2 …`: const-08 row 6 → 7, count 12 → 13. Now green.
- 2 entries `test/e428-tracker-mirror.test.mjs | AC6 / AC12 …`: frozen hash value only. Now green.
- Actual reds not on the manifest: none.

## AC Execution Log

- AC1 — test/e447-init-knowledge.test.mjs `AC1: init --knowledge=local -> clean status …` (full suite) — ok — pass
- AC2 — test/e447-init-knowledge.test.mjs `AC2 (a)`…`AC2 (f)` (6 tests) — ok — pass
- AC3 — test/e447-lane-seed-finish.test.mjs `AC3: start seeds all five …` — ok — pass
- AC4 — test/e447-lane-seed-finish.test.mjs `AC4: a tracked knowledge path …` — ok — pass
- AC5 — test/e447-lane-seed-finish.test.mjs `AC5: finish --shipped copies …` — ok — pass
- AC6 — test/e447-lane-seed-finish.test.mjs `AC6 overwrite`, `AC6 both changed` — ok — pass
- AC7 — test/e447-lane-seed-finish.test.mjs `AC7: finish --shipped numbers …` — ok — pass
- AC8 — test/e447-lane-seed-finish.test.mjs `AC8: finish --abandoned …` — ok — pass
- AC9 — test/e447-cut-reseed.test.mjs `AC9 match` / `AC9 changed` / `AC9 reseed` / `AC9 reseed refuses` / `AC9 reseed boundaries` — ok — pass
- AC10 — `node scripts/test-lock.mjs -- npm test` on db6e693: 4815 pass / 0 fail / 2 skipped of 4817 (base 4789/0/2 of 4791 + 26 e447 tests; re-pins limited to the Test-impact list); plus test/e447-mode-off.test.mjs (3 tests) — exit 0 — pass
- AC11 — test/e447-served-text.test.mjs `AC11: C-C08K served once …` — ok — pass
- AC12 — test/e447-served-text.test.mjs `AC12: …` — ok — pass; judge run `git diff 07a6d47..HEAD -- docs/config.md docs/install.md docs/lane-protocol.md`: only `+` lines, apart from the one (iii) eject row, whose old cell is an exact prefix of the new and whose appended tail equals the amended DOC-INST-5 (`. With …`, human consent 2026-11-27) — pass
- Cut check — `node scripts/fanout.mjs check --cut specs/fanout-post-v5-w6.md e447 specs/e447-local-knowledge-files.md` — exit 1: `FAIL APPROVAL_HUMAN` (the lane's approval cell is `human`, as expected) plus 14 OUT tokens, exactly the 12 `dist/tools/{config,lane-paths,fanout-manifest}.*` outputs and the integrator-assigned `test/lane-paths.test.mjs` and `test/e410-task-alias-content-tail.test.mjs`; no `MANIFEST_CHANGED` (primary mode off) — pass (as expected)
- Judge probe (no spec AC; R4) — scratch repo: the lane appends to its seeded `docs/backlog.md` and has 1 pending block, and an untracked `blocker.txt` forces a late failure; first `finish --shipped` exits 1 at worktree remove after harvesting and numbering E13; after `blocker.txt` is removed, the re-run exits 1 with `harvest destination already exists in the primary checkout and differs (nothing moved): …/docs/backlog.md` — fail
- Judge probe (R2 c) — malformed `knowledge-seed.json` → `finish --shipped` exits 1 `cannot read … — nothing removed`, worktree kept; blocking file `design` in primary → exits 1 with the e180 line naming it; `reseed specs/new.md` (not in primary) → exits 1 `is not a file in the primary checkout` — behaviour as intended, but unlisted in Copy and untested (R1/R2)
## 2026-11-27T02:16:50.130Z — FAIL — by code-reviewer

suite-result: 4815/4817 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

CHANGES_REQUESTED (round 1). AC1-AC12 are implemented and green. Full suite: 4815 pass / 0 fail / 2 skipped of 4817. All 39 expected-red entries are green and there are no reds off the manifest. Build: no dist diff. npm audit high: exit 0. AC12 docs diff is additions only, apart from the (iii) row, which carries the human-consented DOC-INST-5 period (2026-11-27) as an exact-prefix append. check --cut: APPROVAL_HUMAN plus 14 OUT tokens (12 dist/tools outputs, test/lane-paths, test/e410), as expected. Scope is clean; GATE_REGISTRY 33; pipeline 17.
Required: R1 (scenario, SOP 5a) — 12 user-facing strings that no Copy row lists: bin/agc-init.mjs:486, :615, :1322 (finish usage paragraph), :2056, :2091, :2103, :2274, :2314, :2326, :2328, :2378, :2438. pm sources each as a Copy row, adopting or rewording it, with the human's consent as for DOC-INST-5.
R2 (scenario, then test) — scenarios and tests for the sr-added behaviours: (a) finish with no seed record; (b) --shipped with a lane-changed backlog and findings to number; (c) finish refusals: malformed seed record, blocking ancestor, absent backlog with blocks, malformed pending blocks; (d) reseed refusals: tracked or not-ignored path, not a file in primary, unreadable record, no operand (exit 2), lane-absent unrecorded file seeded fresh; (e) init ticketDir unsafe refusal; (f) check --cut: malformed primary config = off, manifest outside the lane not compared.
R3 (sr) — docs/install.md:235 says specs/abandoned/; it should say specs/archive/<ticket-id>/.
R4 (sr, test by qa) — a lane-changed backlog plus numbering plus a late worktree-remove failure leaves the re-run refusing docs/backlog.md as both-changed (probed); the re-run must complete with nothing newly allocated.
Judgement item (2), D9 git call in a mode-off linked worktree: accepted; the observable output is unchanged.
Item (3): the T-E447-02 amend incident is noted once in the report.
Report: review_reports/review_T-E447-01.md (covers T-E447-01..07).

