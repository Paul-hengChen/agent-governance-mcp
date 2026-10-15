# QA review — T-E296-07 (e296-ci-render-hash-fix, AC1)

Verdict: PASS. Single-role judge (test-only). Changed file: `test/e296-manifest-tier.test.mjs` (plus this evidence).

## Option chosen: (b) HEAD-vs-base comparison in the same run

Test "AC10: render output is byte-identical to base" no longer pins sha256 values. It:
1. guards with `git rev-parse --verify c392cc3^{commit}`; if absent (shallow clone) it `t.skip`s with a loud message naming the commit, never silently passes. CI checks out with `fetch-depth: 0` (`.github/workflows/ci.yml`), so the guard does not fire there.
2. extracts the base commit's own code (`package.json`, `scripts/fanout.mjs`, `dist/tools/fanout-manifest.js` at `c392cc3`, the merge-base of the lane = fork point) via `git archive | tar -x` into a fresh dir under `os.tmpdir()` (the file's existing `TMP`, never the repo).
3. renders w3/e296 (`--base c392cc3`) and the w2/e295 control (`--base 25bc84c`) with BOTH the HEAD script and the base script under identical args, including fixed `--primary ROOT --mailbox-root TMP`, and asserts the sha256 and the stdout are equal. The assertion fails if HEAD's render differs from base.

Why (b): no pinned values to re-measure or drift with the environment; the base output is produced from base code, so the proof "HEAD render == base render" is real rather than a stored constant. Path independence: both runs share identical `--primary`/`--mailbox-root`/cwd, so the checkout path cancels out. The base code is self-contained (the dist module imports only node builtins), so no node_modules coupling.

## Proof

- Lane worktree: `node --test test/e296-manifest-tier.test.mjs` -> 35 tests, 35 pass, 0 fail, 0 skipped (AC10 render test ok).
- Second copy of the same HEAD at a different absolute path (`git worktree add --detach <scratchpad>/e296-copy HEAD`, node_modules symlinked to the lane's, no build needed): same file -> 35/35 pass, 0 fail, 0 skipped. Copy removed with plain `git worktree remove` (not refused); `git worktree list` afterwards shows only the primary, e296 and e308 worktrees.
- Final HEAD, clean tree (`git status --short` empty before the run), `node scripts/test-lock.mjs -- npm test`: exit 0; tests 3163, pass 3160, fail 0, cancelled 0, skipped 3 (the 3 skips are pre-existing history-dependent ACs for unresolvable commits 121ddc8 / 3c72a83, unrelated to this change).
- `npm audit --audit-level=high`: only moderate advisories (`@hono/node-server`, `body-parser`); no high/critical.
- E312 (`test/e123b9-lane-flip.test.mjs` AC-MIG-3): did not fire in this run; file untouched.

## Not done / notes

- No deliberate-mutation run was made to demonstrate the test failing on a differing render; the failure path is the equality assertions above (sha256 and byte equality), both exercised only on the passing side.
- No code, content, dist, golden, ceiling or other test changes.
## 2026-10-15T10:40:53.586Z — PASS — by qa-engineer

T-E296-07 PASS (AC1). Option (b): test/e296-manifest-tier.test.mjs AC10 render test now compares HEAD fanout render vs the base commit c392cc3's own code (git archive of scripts/fanout.mjs + dist/tools/fanout-manifest.js into TMP) in the same run, identical args incl. fixed --primary/--mailbox-root, for w3/e296 and the w2/e295 control; pinned hashes dropped; loud t.skip if base commit absent (CI fetch-depth 0). Proof: e296 test file 35/35 in lane worktree and in a second copy of the same HEAD at a different absolute path (copy removed without --force); full suite on clean final HEAD via test-lock: 3163 tests, 3160 pass, 0 fail, 3 skipped (pre-existing history-dependent skips); npm audit high: none. E312 AC-MIG-3 did not fire. Only the one test file changed. Detail in the evidence below.


## AC Execution Log

### AC1 — PASS

Proof 1: `node --test test/e296-manifest-tier.test.mjs` in the lane worktree.
- Result: exit 0; `# tests 35`, `# pass 35`, `# fail 0`, `# skipped 0`; `ok 16 - AC10: render output is byte-identical to base (HEAD vs base code, ...)`.

Proof 1b: same command in a second copy of HEAD d3e5fe9 at a different absolute path (detached worktree under the session scratchpad, node_modules symlinked).
- Result: exit 0; `# tests 35`, `# pass 35`, `# fail 0`, `# skipped 0`. Copy removed with plain `git worktree remove` (accepted).

Proof 2: `node scripts/test-lock.mjs -- npm test` on the final HEAD with a clean tree.
- Result: exit 0; `# tests 3163`, `# pass 3160`, `# fail 0`, `# cancelled 0`, `# skipped 3` (pre-existing history-dependent skips, commits 121ddc8 / 3c72a83). E312 AC-MIG-3 did not fire.

Verdict: AC1 PASS.
## 2026-10-15T10:41:02.000Z — PASS — by qa-engineer

T-E296-07 PASS (AC1), option (b): AC10 render test compares HEAD vs base-commit code render in-run; e296 test file 35/35 in lane and at a second absolute path; full suite 3160/3163 pass, 0 fail, 3 pre-existing skips; E312 did not fire. See AC Execution Log above.

