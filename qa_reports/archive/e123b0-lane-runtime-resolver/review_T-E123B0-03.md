# Review — T-E123B0-03

covers: T-E123B0-01, T-E123B0-02, T-E123B0-03

## Phase 0 — Claim

Claimed via `tw_update_state(status=In_Progress, agent_id="qa-engineer")`. sr-engineer's implementation (T-E123B0-01) is code-reviewer APPROVED (round 1, `review_reports/review_T-E123B0-01.md`) with two non-blocking P3 findings (L-SCHEMA-NEW-8, L-SCHEMA-NEW-9) explicitly out of scope for this ticket per the dispatch brief. Not re-litigated below.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e123b0-lane-runtime-resolver.txt` manifest declared).

## Phase 1 — Review

Read `tools/lane-paths.ts` in full (both the pre-existing e123a-owned code and this ticket's diff). Independently re-derived the AC1-AC5 behaviour against `specs/e123b0-lane-runtime-resolver.md` rather than trusting the code-reviewer's writeup alone:

- **AC1**: `PRIMARY_LANE = "_primary"` exported at `tools/lane-paths.ts:81`. Confirmed by direct import in the extended test.
- **AC2**: `resolveCurrentLane` (`tools/lane-paths.ts:161-174`) is pure `fs.statSync`/`fs.readFileSync`, no subprocess, no network — matches the `tools/drift.ts` precedent. The whole body is wrapped in try/catch, falling back to `PRIMARY_LANE` on any thrown error (ENOENT, EISDIR, etc.), and every non-matching shape (missing `.git`, non-directory/non-file `.git`, malformed gitfile, empty gitdir, detached HEAD, non-`feat/` branch, `feat/` with no ticket-id token) returns `PRIMARY_LANE` via an explicit early return rather than relying on the catch. Verified independently with 17 new temp-dir cases (below) — did not just re-run the reviewer's smoke script.
- **AC3**: `TICKET_ID_RE` (`tools/lane-paths.ts:90`) is the single definition shared by `resolveLaneName` and `resolveCurrentLane` — confirmed by reading both call sites, not just trusting the comment. `e123b0`/`e123b1`/`e123b9` all resolve to themselves; the existing F0 worked examples (`e163-ci-gate-ordering`→`e163`, `e123a-lane-layout-migration`→`e123a`, unparseable→`_legacy`) are untouched in the table and still pass. `resolveLaneName` has no code path that returns `PRIMARY_LANE` (confirmed by reading the function body — it only ever returns the captured group or `LEGACY_LANE`).
- **AC4**: `resolveCurrentLanePaths` (`tools/lane-paths.ts:182-184`) is a one-line composition, `resolveLanePaths(ws, resolveCurrentLane(ws))`. Since `resolveLanePaths` ignores its `lane` argument entirely (`void lane;` at line 116), output is provably identical to the pre-existing flat paths for any branch shape — verified this by direct deep-equality against `resolveLanePaths(ws, <anything>)`, not by re-deriving the flat-path shape by hand.
- **AC5**: `grep -rn "resolveCurrentLane" tools/ gates/ guards/ prompts/ bin/ index.ts` — ran this myself (not just re-quoted the reviewer's line), output below under AC Execution Log. Only `tools/lane-paths.ts` matches (all 8 hits are the declaration itself or its own comments).

**Copy Audit Gate / Visual Audit Gate**: skipped — the spec has no *Copy / Strings* or *Visual Tokens* H2 (mini-chain spec, no PM dispatch, per `scope_decision`).

## Phase 1.5 — Visual Compare

Skipped (no `design/e123b0-lane-runtime-resolver.md`, no Visual Baselines).

## Phase 2 — Discussion

No blocking issues found in Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests

**Test File Discovery**: `test/lane-paths.test.mjs` already exists (from e123a/T-E123A3-08) and covers `resolveLaneName`/`resolveLanePaths`/`LANE_FILES`/`laneFile`. Per the dispatch brief's Test-file placement line, extended this file — no new test file created.

**Spec-to-Test Map** (recorded in the test file's own header comment too):

| AC | Tests |
|---|---|
| AC1 | `AC1-1` |
| AC2 | `CL: resolveCurrentLane — *` (17 table-driven cases) + `CL-type-guard` |
| AC3 | 3 new rows appended to `RESOLVE_LANE_NAME_CASES` (e123b0/e123b1/e123b9) + existing `RN-never-primary` sweep (now covers the new rows too) |
| AC4 | `CLP1`, `CLP2`, `CLP3` |
| AC5 | `CALLERS3` |

AC2's 17 temp-dir cases cover every proof shape named in the spec plus the AC3 branch matrix: `.git` directory (feat/e123b0, feat/e123b1, feat/e123b9, main, integ/wave4, fix/x, feat/ with no id token, detached HEAD, missing HEAD file, HEAD-as-directory), missing `.git` entirely, gitfile with an absolute gitdir, gitfile with a relative gitdir (resolved against the workspace, not `process.cwd()`), a malformed gitfile (no `gitdir:` prefix), a malformed gitfile (empty gitdir value), a dangling gitfile (gitdir target does not exist), and a nonexistent `workspacePath`.

**Coverage Gate**: `tools/lane-paths.ts` is 100% covered by line for the new AC1-AC5 surface — every branch in `resolveCurrentLane`, `headFilePath`, and `resolveCurrentLanePaths` is hit by at least one case above (confirmed by reading the source against the case table, not by a coverage tool — none is wired into this repo's `npm test`).

**Security Smoke Tests**: `CL-type-guard` exercises `null`, `undefined`, `42`, `{}`, `[]`, `true` as `workspacePath` — none throw, all fall back to `PRIMARY_LANE`. Boundary fs cases (missing file, missing dir, directory-where-a-file-is-expected, dangling symlink-like gitdir target) are covered by the CL table itself.

**Test fixtures**: every temp workspace is created via `fs.mkdtempSync(path.join(os.tmpdir(), "e123b0-lane-test-"))` (never under the repo root) and removed via `t.after(() => fs.rmSync(dir, { recursive: true, force: true }))`. The relative-gitdir case additionally creates a sibling directory outside `ws` (to prove resolution is workspace-relative, not cwd-relative) — this sibling is now also registered for cleanup (an initial pass leaked one such directory under `$TMPDIR`; caught and fixed before this report, confirmed no leftover `e123b0-*` entries remain in `$TMPDIR` after a full run).

## Phase 3.5 — AC Execution Log

Spec declares `proof:` on AC2, AC3, AC4, AC5. One log covers all (mini-chain spec, single round).

**AC2 proof** — table-driven unit test over temp dirs covering a `.git` dir, a gitfile, a detached HEAD, a missing `.git`, and a malformed gitfile:
```
$ node --test test/lane-paths.test.mjs
# tests 45
# pass 45
# fail 0
```
Verdict: PASS. (Full output below under Phase 4 — this is the same run, not re-executed separately.)

**AC3 proof** — extend F0's `resolveLaneName` table and add the three new ids:
```
RESOLVE_LANE_NAME_CASES now includes:
  ["e123b0-lane-runtime-resolver", "e123b0", ...] -> ok
  ["e123b1-core-write-path", "e123b1", ...]        -> ok
  ["e123b9", "e123b9", ...]                        -> ok
```
All pre-existing rows (F0 examples, `_legacy` fallback, `RN-never-primary` sweep) still pass unmodified. Verdict: PASS.

**AC4 proof** — output equality versus the flat paths across the branch shapes from AC2:
```
CLP1 (feat branch) / CLP2 (main branch) / CLP3 (flat-path field equality) -> all pass
```
Verdict: PASS.

**AC5 proof** — `grep -rn "resolveCurrentLane" tools/ gates/ guards/ prompts/ bin/ index.ts` matches only `tools/lane-paths.ts`:
```
$ grep -rn "resolveCurrentLane" tools/ gates/ guards/ prompts/ bin/ index.ts
tools/lane-paths.ts:15:// Pure path/string logic everywhere EXCEPT resolveCurrentLane (e123b0, E123
tools/lane-paths.ts:80:// the live resolver (resolveCurrentLane) — never by resolveLaneName.
tools/lane-paths.ts:87:// owner of the pattern: resolveLaneName and resolveCurrentLane both use it.
tools/lane-paths.ts:99: * (resolveCurrentLane below), not this function. Shares TICKET_ID_RE with it
tools/lane-paths.ts:161:export function resolveCurrentLane(workspacePath: string): string {
tools/lane-paths.ts:178: * resolveCurrentLane. Because resolveLanePaths still ignores its lane
tools/lane-paths.ts:182:export function resolveCurrentLanePaths(workspacePath: string): LanePaths {
tools/lane-paths.ts:183:  return resolveLanePaths(workspacePath, resolveCurrentLane(workspacePath));
```
Only `tools/lane-paths.ts` — matches AC5 exactly (also re-asserted as test `CALLERS3`). Verdict: PASS.

## Phase 4 — Run

**Build** (AC6):
```
$ npm run build
check:version — OK (3.116.0)
tsc — clean, zero errors
check:transitions-sync — OK (21 keys, exact match)
```
Verdict: PASS.

**Extended test file** (`test/lane-paths.test.mjs`, 45 tests — 9 pre-existing e123a tests groups + 36 new e123b0 tests):
```
# tests 45
# pass 45
# fail 0
# cancelled 0
```

**Full suite** (AC6 — CI runnability, headless, zero human interaction):
```
$ npm test
# tests 2315
# pass 2315
# fail 0
# cancelled 0
# duration_ms 89467.6
```
Verdict: PASS. No regressions anywhere in the 2315-test corpus.

**`npm audit --audit-level=high`** (AC6):
```
6 vulnerabilities (2 low, 4 moderate)
EXIT CODE: 0
```
All findings are pre-existing transitive deps (hono/body-parser/esbuild/protobufjs/qs), none at or above `high` — exit 0 confirms the AC6 gate. Not introduced by this ticket (this ticket adds zero new dependencies — `tools/lane-paths.ts`'s only imports are Node's built-in `fs`/`path`).

**Out of Scope respected** (re-verified independently, not just re-quoted from the reviewer): `grep -n "config\|lock" tools/lane-paths.ts` → the only hit is a comment at line 32 listing `.current/.config.json` as a file this module deliberately does NOT own; no lock code, no call-site migration. `git status --short` shows no changes under `content/`, and my own diff touches only `test/lane-paths.test.mjs` — `tools/` is untouched by QA.

**Reviewer's non-blocking findings** (L-SCHEMA-NEW-8: quadratic regex on long digit runs; L-SCHEMA-NEW-9: empty/relative `workspacePath` resolves against `process.cwd()`): confirmed both are already filed in `NEW-TICKETS.md`, both explicitly P3/non-blocking, both post-v4 per the dispatch brief. Not tested or fixed here, per instruction.

## Verdict

**PASS** — T-E123B0-01, T-E123B0-02, T-E123B0-03.

All six ACs re-derived independently (not rubber-stamped from the code-reviewer's writeup): AC1 export confirmed, AC2's five proof shapes plus the full AC3 branch matrix covered by 17 table-driven temp-dir cases with zero leaked fixtures, AC3's three new ticket ids resolve distinctly with F0's examples and `_legacy` fallback intact, AC4 output-equality proven by direct deep-equality (not hand re-derivation), AC5's zero-caller grep re-run and matches. Build clean, full 2315-test suite green, `npm audit --audit-level=high` exit 0. Out of Scope respected. No new findings beyond the two already-filed, already-dispositioned non-blocking P3s.
## 2026-09-23T07:43:03.856Z — PASS — by qa-engineer

PASS — T-E123B0-01/02/03. AC1-AC6 all re-derived independently: PRIMARY_LANE export confirmed; resolveCurrentLane's 5 proof shapes + AC3 branch matrix covered by 17 new table-driven temp-dir cases (test/lane-paths.test.mjs, os.tmpdir()-only fixtures, all cleaned up); AC3's e123b0/e123b1/e123b9 resolve distinctly, F0 examples + _legacy fallback intact; AC4 output-equality proven by deep-equality; AC5 zero-caller grep re-run, matches. npm run build clean, full suite 2315/2315 green, npm audit --audit-level=high exit 0. Out of Scope respected (no .config.json read, no lock work, tools/ untouched by QA). Reviewer's L-SCHEMA-NEW-8/9 confirmed already filed as non-blocking P3, not re-tested per instruction. Evidence: qa_reports/review_T-E123B0-03.md.

