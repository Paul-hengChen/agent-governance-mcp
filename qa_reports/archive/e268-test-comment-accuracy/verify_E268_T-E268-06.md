# QA independent verification — e268-test-comment-accuracy (T-E268-01..06)

covers: T-E268-01, T-E268-02, T-E268-03, T-E268-04, T-E268-05, T-E268-06

Verifier: fresh qa-engineer (sonnet), distinct from the authoring context. Did not rely on proof_E268_authoring.md or the review; every check re-run.
Lane edit commit 0433ce0 on base f1e6eb1; main merged in (6a087bc). Suite ran on HEAD dbbcb6d (clean tree).

## Per-AC
| AC | result | evidence |
|---|---|---|
| AC1 | PASS | no "no flat fallback" phrasing remains (grep empty); tools/drift.ts readArtifactVersion reads lane path, falls back to flat when absent; new text matches; stale readOnDiskVersion/:248/NEW-TICKETS ref removed at :35-40 |
| AC2 | PASS | archive manifest file exists; spec cites archive path once |
| AC3 | PASS | review_T-TESTS grep empty; cited spec exists |
| AC4 | PASS | header names tools/handoff-parse.ts (import :15, call :734) |
| AC5 | PASS | no tools/handoff.ts left in e22 test; config_error spread :583/:745, Crash-Resume message :718-727 in handoff-parse.ts |
| AC6 | PASS | header U1-U13; U13 test exists at :153 |
| AC7 | PASS | fifth phrase present once; five const-08 tests confirmed |
| AC8 | PASS | rulers :363/:366 same width |
| AC9 | PASS | lines 1-6 all <=118; words unchanged |
| AC10 | PASS | :5 and E1-E5 header name handoff-orchestrator.js / gates/registry.js (test reads both, :629/:635); string literals untouched |
| AC11 | PASS | exactly one e260h-comment-rationale pointer; spec section exists |
| AC12 | PASS | option 1 holds: ROLE_TO_SKILL / FILE_PATH_DELEGATES entries unchanged (emit byte-identical); only comments changed; content/skill-coordinator.md absent on disk, SKILL_SEGMENTS key present in prompts/skill-manifest.ts |
| AC13 | PASS | `node .current/e268/proof.mjs` -> `emit: 9 files, 0 differ` |
| AC14 | PASS | `git diff main...HEAD --name-status`: 19 paths, all owned, all test/ entries M. NOTE: proof.mjs `scope:` prints VIOLATION only because it diffs against BASE f1e6eb1 and so sees the main-merge files (E275 advisory upgrades), not lane edits; against main the scope is clean |
| AC15 | PASS | proof.mjs `hygiene: ok` |
| AC16 | PASS | clean tree; suite below; no test added/removed/renamed (emit identical, names unchanged) |
| AC17 | PASS | negative control on a copy outside the worktree (temp dir): one test-name literal in a copy of test/qa-flow.test.mjs changed -> `DIFFERS`; a comment-only change to another copy -> `same` |

## Build / audit / suite (HEAD dbbcb6d)
- `npm run build`: exit 0
- `npm audit --audit-level=high`: exit 0
- `node scripts/test-lock.mjs -- npm test`: exit 0; tests 3043, pass 3040, fail 0, cancelled 0, skipped 3

## Findings
No new blocking findings. Known non-blocking (E268-NEW-2): pixel-gate-attestation :622 is 133 columns; drift-skew :202 explains with bare id J2-NEW-9.
Candidate new pending ticket: E268-NEW-3 — proof.mjs scope check diffs against the fixed BASE sha, so it false-fails after main is merged into the lane; it should diff against the merge-base with main.
