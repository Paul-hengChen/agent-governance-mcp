covers: T-E178B-01, T-E178B-02, T-E178B-03, T-E178B-04, T-E178B-05

# QA review — T-E178B-01..05 (e178b-lane-watch-tooling)

Spec: `specs/e178b-lane-watch-tooling.md` (AC1–AC21). Code under test: commits c3f3fcb, f2c399b, f671c75, cd9dcfd (round-1 fix), approved by code-reviewer round 2 at 81ec269 (`review_reports/review_T-E178B-01.md`). QA re-verified every AC itself against live fixtures, not from the review report. QA authored T-E178B-04 (lane-status tests) and T-E178B-05 (fanout E208 tests + whole-ticket gate). The whole-ticket gate (AC20/AC21) is recorded in `qa_reports/review_T-E178B-05.md`.

## Phase 0.5 — Expected-Red Diff
Phase 0.5: skipped (no expected-red manifest declared). `qa_reports/expected-red_e178b-lane-watch-tooling.txt` does not exist, and the handoff has no `dispatch_mode: bugfix`.

## Phase 1 — Review

### 3a. Copy Audit Gate
I grepped every `Copy / Strings` row against `tools/lane-status.ts` / `tools/fanout-manifest.ts`. The tests also pin each rendered string byte-for-byte.
- `watch.armed` — `armed: watching ${keys.length} lane(s) — interval ${intervalSeconds}s, deadline ${deadlineMinutes} min` (watchLoop). Verbatim.
- `watch.baseline` / `watch.changed` / `watch.changed-since` / `watch.appeared` / `watch.gone` — watchLoop `io.out` literals. Verbatim. `watch.changed` prints `— Δ <keys>` whenever the Δ list is non-empty. When a lane comes back from `unreadable`, it prints `[<lane>] changed: <state>` with no Δ, because nothing readable exists to diff against. That is a sensible reading of the row and is not drift.
- `watch.unreadable` — `unreadable (${reason})` (formatWatchState). Verbatim.
- `watch.state` — keys `feature status last_agent next_role hop review_round qa_round [cut_prereview]` (WATCH_STATE_KEYS + WATCH_PREREVIEW_KEY). Verbatim. The round-1 fix is in place: the watch value is folded to `sent_(to-integrator#<seq>)`, and the one-shot text stays `sent (to-integrator#<seq>)`. Both are pinned: AC15 checks the watch value, AC10 checks the one-shot text.
- `watch.expiring` — `expiring — re-arm`. Verbatim.
- `watch.rearm` — `node scripts/lane-status.mjs --watch [...] --baseline <lane>=<fp>,...` (formatWatchRearmCommand). Verbatim.
- `prereview.line` — `  cut pre-review: ${text}` (renderLaneStatus). `prereview.missing`, `prereview.no-mailbox` and `prereview.states` (checkCutPrereview) are verbatim.
- `fanout.warn` — `UNMATCHED_OWNED_WARN`. Verbatim, with the two-space separators.
- `usage.watch` — seven new `LANE_STATUS_USAGE` lines (the row delegates the wording to sr-engineer). Existing lines are unchanged: the diff against 121ddc8 shows only additions, and the `--bogus` usage output differs from base only by those appended lines.
- **Coverage-gap judgement.** Diagnostic strings on stderr and on error paths are not listed in Copy/Strings: `lane-status: <message>` usage errors, the `duplicate lane key` warning, `lane list unavailable this tick`, `cannot start watch`, and fanout's degrade-path `note: 擁有 token existence check skipped — git ls-tree <base> failed: <err>`. They follow the pre-existing `lane-status: <message>` / `note:` diagnostic conventions of E177a/E177b, and the E177a/E177b QA passes did not treat such strings as copy either. I judge them diagnostics outside the rendered-text contract, so this is **not a FAIL**. Surfaced to PM/integrator: E178a's format section may want to source the fanout `note: … skipped` line, because it can appear on `fanout check` stdout.

### 3b. Visual Audit Gate
N/A. The spec's Visual Tokens and Visual Widgets tables are both `N/A` (CLI tooling, no visual literals).

### Correctness / scope notes (non-blocking; for code-reviewer or integrator, not QA FAIL grounds)
- Code-reviewer's `[recommended]` stands: `readWatchTick` reads every listed lane's handoff (and mailbox) even under `--lanes`. This is extra I/O only.
- `--mailbox-root` combined with `--rollup` / `--lanes` / `--all` is a usage error (64). This matches the usage text and decision (j). It is pinned in the AC12 test.
- E178B-NEW-1 (a lane closed between two watches makes the printed re-arm command exit 64) is confirmed as spec-conformant AC5 behaviour. It is already filed.

## Phase 1.5 — Visual Compare
Phase 1.5: skipped (no Visual Baselines declared; no `design/e178b-lane-watch-tooling.md`, mode no-design).

## Phase 2 — Discussion
Phase 1 found no issues, so I went straight to Phase 3.

## Phase 3 — Tests

### Test File Discovery
No existing file covers the new watch, cut pre-review or E208 code. I followed the dispatch brief's `Test-file placement` line (creation pre-authorized) and added three new files:
- `test/e178b-lane-watch.test.mjs`
- `test/e178b-cut-prereview.test.mjs`
- `test/e178b-fanout-unmatched.test.mjs`

New fixtures:
- `test/fixtures/e178b/mailbox/**`: nine lane mailboxes covering every decision (g) `re:` variant, non-proposal cut mentions, a dir with no file, and a parser parity-edge file with CRLF, duplicate keys, `--- msg <words>`, `---msg`, `key:value` and a capitalised key.
- `test/fixtures/e178b/fanout-wave7-e177a.md`: a verbatim copy of `specs/fanout-wave7.md`'s title and base lines plus the `## Lanes (7.1)` header and the e177a row. The row was confirmed identical with `diff`.

I did not edit `specs/fanout-*.md`. `test/e177a-*` / `test/e177b-*` are unchanged: no pinned usage line changed, and those suites are green.

### Spec-to-Test Map
| AC | test file | test name |
|---|---|---|
| AC1 | e178b-lane-watch | `AC1 baseline on start` |
| AC2 | e178b-lane-watch | `AC2 transition line`, `AC2 non-watched field silent` |
| AC3 | e178b-lane-watch | `AC3 degrade honestly`, `AC3 degrade honestly: degraded-empty list and duplicate basenames` |
| AC4 | e178b-lane-watch | `AC4 expiry and re-arm command` |
| AC5 | e178b-lane-watch | `AC5 re-arm round trip` |
| AC6 | e178b-lane-watch | `AC6 argument rules` |
| AC7 | e178b-lane-watch | `AC7 tick reads only list + handoff` |
| AC8 | e178b-lane-watch | `AC8 constants parity` |
| AC9 | e178b-lane-watch | `AC9 script end to end` |
| AC10 | e178b-cut-prereview | `AC10 sent` |
| AC11 | e178b-cut-prereview | `AC11 missing explicit`, `AC11 non-proposal ignored` |
| AC12 | e178b-cut-prereview | `AC12 other states` |
| AC13 | e178b-cut-prereview | `AC13 exit code unchanged` |
| AC14 | e178b-cut-prereview | `AC14 header parser parity` |
| AC15 | e178b-lane-watch | `AC15 prereview transition` |
| AC16 | e178b-fanout-unmatched | `AC16 unmatched exact token warns` |
| AC17 | e178b-fanout-unmatched | `AC17 no false warnings` |
| AC18 | e178b-fanout-unmatched | `AC18 exit codes and line order` |
| AC19 | e178b-fanout-unmatched | `AC19 E208 regression` |
| AC20 | whole-ticket run | see `qa_reports/review_T-E178B-05.md` |
| AC21 | whole-ticket run | see `qa_reports/review_T-E178B-05.md` |

Notes on how the key tests bite:
- AC4's "no fresh read at expiry" changes a lane on the very sleep that reaches the deadline. It then asserts that the reader call count did not move and that the re-arm fingerprint is the sha256 of the pre-change line, computed independently of the tool.
- AC5 feeds the printed re-arm command back and asserts zero `changed since last watch` lines. A change made between the two watches then fires on start.
- AC7 runs a child watch whose PATH holds only a logging fake `git`, and asserts nothing was logged. A positive control (`computeLaneStatus`) proves the trap catches git. A structural check confirms the watch section never calls `runGit` / `execFileSync` / `checkLaneEvidence` / `computeLaneStatus`.
- AC9 spawns the real script against a real temp repo plus a worktree. It sees `armed:` and both baseline lines, writes a real handoff transition, sees the `changed:` line with `Δ status`, and asserts the process is still alive before killing it.
- AC19 includes a CLI run with the DEFAULT `--repo` (the manifest's `specs/` subdirectory), which pins the `--full-tree` fix.

### Mutation checks (tests bite)
Each mutation was applied to `dist/`, the suite was run, and `dist/` was then restored. `git status --short dist` was empty afterwards.
- Removing the `watchValue()` fold on `cut_prereview` makes `AC15 prereview transition` FAIL.
- A recognizer that accepts any `type:` makes AC10, AC11 (×2), AC13 and the oversized-mailbox smoke FAIL.
- A Δ list in reverse key order makes AC2 and AC4 FAIL (and AC15).
- Dropping `--full-tree` from `git ls-tree` makes AC19 FAIL.
- Dropping the added-file exemption makes AC17, AC18 and AC19 FAIL.

### Coverage Gate
Measured with `node --test --experimental-test-coverage test/e178b-*.test.mjs test/e177a-*.test.mjs test/e177b-lane-status.test.mjs`:
- `dist/tools/lane-status.js`: 94.94% line, 86.49% branch, 95.35% funcs.
- `dist/tools/fanout-manifest.js`: 93.35% line, 85.55% branch, 96.70% funcs.

Both are ≥ 80%. After the first measurement I added tests for the degraded-empty list, duplicate basenames and the `runLaneWatch`-without-`--watch` path, which the first pass had left uncovered.

### Security smoke
- Path-shaped `active_feature` / lane names (`../etc/passwd`, `a/b`, `..`, a NUL byte) come back `not-checked` and are never joined into a path.
- An oversized mailbox (20 000 blocks, about 5 MB) reads fine, and the first match still wins.
- Empty or header-only mailbox text keeps parity with the script's parser.
- Shell-unsafe `--repo` paths are quoted in the re-arm command.
- Boundary argv (`0`, `-5`, `1.5`, `abc`, a missing value, an unknown flag) exits 64.
- The watch has no access-control surface: it is read-only local tooling.

## Phase 3.5 — AC Execution Log
Round 1, which covers T-E178B-01..05. Every `proof:` in the spec was executed. I ran the targeted proofs at HEAD a7cc7cf plus the uncommitted tests, before committing. AC20/AC21 run after the commit and are logged in `qa_reports/review_T-E178B-05.md`.

- **AC1–AC9, AC15.** Command: `node --test test/e178b-lane-watch.test.mjs`. Exit 0, 12/12 pass: `AC1 baseline on start`, `AC2 transition line`, `AC2 non-watched field silent`, `AC3 degrade honestly`, `AC3 degrade honestly: degraded-empty list and duplicate basenames`, `AC4 expiry and re-arm command`, `AC5 re-arm round trip`, `AC6 argument rules`, `AC7 tick reads only list + handoff`, `AC8 constants parity`, `AC9 script end to end` (about 1.6 s), `AC15 prereview transition`. Verdict: PASS.
- **AC10–AC14.** Command: `node --test test/e178b-cut-prereview.test.mjs`. Exit 0, 8/8 pass: `AC10 sent`, `AC11 missing explicit`, `AC11 non-proposal ignored`, `AC12 other states`, `AC13 exit code unchanged`, `AC14 header parser parity`, plus 2 security smokes. Verdict: PASS.
- **AC16–AC19.** Command: `node --test test/e178b-fanout-unmatched.test.mjs`. Exit 0, 4/4 pass: `AC16 unmatched exact token warns`, `AC17 no false warnings`, `AC18 exit codes and line order`, `AC19 E208 regression`. Verdict: PASS.
- **Adjacent suites** (decision (j) and the AC20 sub-claims, pre-commit). Command: `node --test test/e177a-*.test.mjs test/e177b-*.test.mjs test/lane-paths*.test.mjs test/error-code-contract.test.mjs test/e178b-*.test.mjs`. 210/210 pass, exit 0.
- **Decision (j) byte-identity vs base.** I extracted `git archive 121ddc8 dist scripts/lane-status.mjs scripts/fanout.mjs package.json` into `$TMPDIR/e178b-base` (with a `node_modules` symlink) and ran the base and the lane scripts back to back against the live lane set:
  - `lane-status` (no args), `--json`, `--all`, `--lanes e130,e178b`, `--lanes e130,e178b --json`, `--rollup e178b-lane-watch-tooling` and `--rollup … --json` are all **byte-identical**, exit 0/0.
  - `--bogus` exits 64/64. Its output differs only by the seven appended `usage.watch` lines, as expected.
  - `fanout check specs/fanout-wave7.2.md e178b --base 121ddc8` is byte-identical between base and lane, exit 0/0. It shows 0 WARN, because every e178b 擁有 token is a glob, exists at base, or was added.
  - Verdict: PASS.
## 2026-09-27T08:03:35.441Z — PASS — by qa-engineer

PASS — AC1-AC21 all satisfied. New test/e178b-lane-watch.test.mjs (AC1-AC9, AC15; 12 tests), test/e178b-cut-prereview.test.mjs (AC10-AC14 + 2 security smokes), test/e178b-fanout-unmatched.test.mjs (AC16-AC19), fixtures under test/fixtures/e178b/ (mailbox corpus copies + verbatim copy of wave7's e177a row); 24/24, mutation-checked (fold removal, recognizer widening, delta order, --full-tree removal, added-file exemption removal all turn tests red). Copy Audit: every Copy/Strings row verbatim incl. round-1 fold (watch cut_prereview=sent_(to-integrator#<seq>), one-shot 'cut pre-review: sent (to-integrator#<seq>)'); stderr/error-path diagnostics judged outside the rendered-text contract (fanout degrade-path 'note: ... existence check skipped' surfaced for E178a). Visual N/A. Phase 0.5/1.5 skipped (no manifest/baselines). Coverage lane-status.js 94.9% / fanout-manifest.js 93.4% line. Decision (j) byte-identity vs 121ddc8 dist confirmed for every non-watch one-shot/rollup/json mode and fanout check. AC20: clean tree at abeb4e9, npm run build exit 0, dist porcelain empty, npm test 2778/2778 exit 0 (run 1; e130 test run waited out before start, no flake observed). AC21: fanout check e178b --base 121ddc8 -> 0 out of bounds, 0 WARN, exit 0. Evidence: qa_reports/review_T-E178B-04.md (covers 01-05, AC Execution Log), qa_reports/review_T-E178B-05.md (AC20/AC21).

