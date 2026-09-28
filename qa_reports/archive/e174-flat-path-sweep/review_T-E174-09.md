# QA Review — T-E174-09 (and close-out of T-E174-01/02/03/05/06/07/08)

covers: T-E174-01, T-E174-02, T-E174-03, T-E174-05, T-E174-06, T-E174-07, T-E174-08, T-E174-09

Reviewer: qa-engineer (sonnet). Code-reviewer verdict: APPROVED (`review_reports/review_T-E174-01.md`).

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e174-flat-path-sweep.txt`, 2 entries:
- `test/context-budget.test.mjs | AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 18990 ~tok)`
- `test/skill-manifest.test.mjs | t-golden-byte-identity (AC1/AC5): composeSkill("skill-coordinator.md", {taskTool:true}) === frozen golden monolith, byte-for-byte`

Pre-edit confirmation (inherited from code-reviewer's own full-suite run, documented in `review_reports/review_T-E174-01.md` §Performance/Expected-red sampling): `npm test` on the un-rebaselined tree gave 2417 tests, 2415 pass, 2 fail — exactly the two manifest entries (`not ok 245`, `not ok 1951`), zero unexplained reds. I did not re-run the suite a third time on the pre-edit tree myself (the code-reviewer's run is a fresh, independent measurement, not a copied figure); instead I independently re-derived the SAME numbers that make each entry disposition-able before touching anything:
- Re-measured the coordinator bundle myself via a standalone script that replicates `buildPromptForRole`'s exact composition (`composeConstitution({chain:true,design:true})` → `stripOriginTags` → `stripRationale` for the constitution side, `composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"))` → `stripOriginTags` → `stripRationale` for the skill side, joined with `SEP = "\n\n---\n\n"`): **19284 ~tok**, matching the manifest's cited figure exactly.
- Regenerated the goldens (`node scripts/capture-constitution-golden.mjs`, confirmed it resolves `ROOT` from its own `__dirname` so it writes into this worktree, not primary) and confirmed via `git status --short test/fixtures/compose-golden/` that ONLY `skill-coordinator-monolith.txt` changed — every constitution-only golden (`constitution-monolith.txt`, `build-full-*`, `build-lite-*`, `hook-full.txt`, `hook-lite.txt`) is byte-identical. This is the expected shape for a coord-only change (AC5/const-01 is dropped; no `content/const-*.md` file is touched by this cut) and disposes the golden-identity red as "fixed by re-baseline, not a regression."

**Disposition**: both manifest entries are the manifest's own predicted, qa-owned re-baselines — no unexplained/unclassified red. Both are now resolved by my qa-owned edits (see AC Execution Log below).

## Phase 1 — Review

Implementation is `content/coord-02-host-dispatch.md`, `content/coord-03-core-fallback.md`, `content/coord-06-host-token.md`, `docs/architecture.md`, `docs/arming.md`, `docs/gate-retro-procedure.md`, `docs/http-mode.md` — a prose-only sweep, already adversarially reviewed by code-reviewer (APPROVED, one non-blocking wording nit at `coord-03-core-fallback.md:4`, out of QA's FAIL scope per SOP — style/correctness is code-reviewer's domain). `git status --short` on this worktree matches the review report's claimed changed-file set exactly (`NEW-TICKETS.md`, the 7 content/docs files, `tasks.md`; plus untracked `.current/e174/`, `qa_reports/expected-red_*.txt`, `review_reports/review_T-E174-01.md`, `specs/e174-flat-path-sweep.md`). No additional drift.

### Copy Audit Gate (3a)
Spec's Copy/Strings table: `N/A — prose/doc-only ticket, no product-facing strings`. Skipped — nothing to audit.

### Visual Audit Gate (3b)
Spec's Visual Tokens / Visual Widgets tables: both `N/A — feature has no visual literals / no non-primitive widgets`. Skipped — nothing to audit.

## Phase 1.5 — Visual Compare
Skipped (no Visual Baselines declared — no `design/e174-flat-path-sweep.md` exists, and the spec's Visual Tokens/Widgets tables are both N/A).

## AC Execution Log

All proofs re-run directly against the working tree (not trusted from the review report):

- **AC1** — `grep -c '\.current/handoff\.md\|\.current/usage\.jsonl' content/coord-03-core-fallback.md` → `0`. PASS.
- **AC2** — `grep -n 'dispatch_mechanism' content/coord-03-core-fallback.md` → line 2, `"switch_role"` line sets tier to "the model tier you are actually running as, self-identified — never the `dispatch_pins` entry or `recommended_model`"; states "A differing pin IS the E99 mismatch signal: never correct your tier to match it." Names neither `dispatch_pins` nor `recommended_model` as a tier source; states the no-correct-to-pin rule. PASS.
- **AC2b** — same grep → line 3, distinct `"inline"` line, same self-identified-tier / never-`dispatch_pins` / never-corrected-to-pin wording, covering the three named cases (initial session agent, coordinator/coordinator-lite writing directly, role continuing under held context). PASS.
- **AC3** — `grep -c '\.current/usage\.jsonl' content/coord-06-host-token.md` → `0` (lines 21, 30 both retargeted to `.current/<lane>/usage.jsonl`). PASS.
- **AC4** — `grep -n 'dispatch_mechanism' content/coord-02-host-dispatch.md` → line 12, inside the fenced Dispatch Brief Template, directly after the Watermark line (line 11): `"task"` + `dispatch_mechanism_tier` = "the SAME `<tier>` as the Watermark line above — never a different value." Fencing intact (opens ```` ````markdown ```` at line 5, closes ```` ```` ```` at line 15). PASS.
- **AC5** — dropped (human decision, option B). Verified `content/const-01-core-head.md` untouched: `git diff HEAD --quiet -- content/const-01-core-head.md` → exit 0 (no diff). T-E174-04 confirmed voided in `tasks.md` (`[-] T-E174-04 ... (voided: human chose coordinator-side placement (option B))`). No `tw_void_task` action needed — already recorded.
- **AC6** — `grep -c '\.current/handoff\.md[^/]' docs/architecture.md` → `0`. Line 60 reads `O_EXCL .current/<lane>/.handoff.lock + stale-PID detection`, matching `HANDOFF_LOCK_FILENAME` / `resolveLaneLockPath` in `tools/lane-paths.ts`. Diagram box alignment re-verified by byte-length: lines 11-20 all 66 bytes; lines 56-63 all 71 bytes (line 57's pre-existing emoji line is 77, unchanged). PASS.
- **AC7** — `grep -n '\.current/telemetry\.jsonl\|\.current/metrics\.jsonl' docs/gate-retro-procedure.md` → every hit is either current-lane-scoped (`.current/<lane>/...`, lines 4, 24, 44, 50, 82) or the one preserved `scripts/summarize-metrics.mjs` default-arg comment (line 101, kept verbatim per AC7(d), with the explicit-lane-path clause added directly after it). The one glob present (`.current/*/telemetry.jsonl`, inside the "Do NOT glob ... does NOT de-duplicate" caveat) is never framed as a totals command. `grep -c 'tw_gate_stats' docs/gate-retro-procedure.md` → `6` (≥ 3). PASS.
- **AC8** — `grep -n 'commit.*\.current' docs/http-mode.md` → line 53, "commit your lane's `.current/<lane>/` directory to Git" (directory, not the flat file). PASS.
- **AC9** — `grep -c '\.current/usage\.jsonl' docs/arming.md` → `0` (lines 26, 31 both retargeted). PASS.
- **AC10** — `grep -rn '\.current/handoff\.md\|\.current/telemetry\.jsonl\|\.current/metrics\.jsonl\|\.current/usage\.jsonl\|\.current/dispatch\.jsonl' content/ docs/ | grep -v 'docs/install.md\|docs/backlog.md\|docs/v4.0.0-\|docs/schema-versions.md:57\|docs/agc-feedback-2026-09-08.md\|docs/dependency-advisories.md\|# default: \.current/metrics\.jsonl'` → empty (exit 1). PASS. Independently re-swept beyond the literal proof pattern (glob/brace forms, `path.join(".current", ...)` forms) — no additional hit outside the spec's Leave-as-is rows.

### T-E174-09 (qa-owned re-baseline)
- Regenerated all 12 golden fixtures (`node scripts/capture-constitution-golden.mjs`). Only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` changed. Justification: T-E174-01/03 edit `content/coord-02-host-dispatch.md` + `content/coord-03-core-fallback.md`, both composed into `skill-coordinator.md` only — never into `CONSTITUTION` (no `content/const-*.md` edit this cut; AC5 dropped). So `constitution-monolith.txt`, all 4 `build-full-*`/`build-lite-*` pairs, and both `hook-*` fixtures are correctly byte-identical; only the coordinator-composed monolith moves.
- Re-measured `test/context-budget.test.mjs`'s coordinator bundle floor (line ~1118-1544) myself via the render path described above: **19284 ~tok** (exact), matching the qa_reports manifest's own measured figure. Raised ONLY that one assertion, from `<= 18990` to `<= 19284`, with a comment in the file's established style (`e174-flat-path-sweep (qa-owned bump, T-E174-09)`, attributing the growth to coord-02's new `dispatch_mechanism: "task"` line and coord-03's flat-path retargets + two new attestation lines, noting the constitution-only floors are untouched since AC5/const-01 is dropped).
- Confirmed no other floor in `test/context-budget.test.mjs` moved or failed (plan §2.2 compliance) — full suite run below is the proof.

## Phase 4 — Run

- `npm run build`: clean (tsc, check:version, check:transitions-sync all OK).
- Full suite, single clean run (after killing an earlier accidental overlapping `npm test` invocation to avoid file-lock/telemetry-sidecar cross-talk between concurrent runs): **`npm test` → 2417/2417 pass, 0 fail**, duration ~254.7s. Both manifest-listed reds are now green (floor raised to the measured value; golden regenerated). No other test regressed.
- `node scripts/check-md-tables.mjs`: not re-run (no `.md` table touched by my own edit — I only edited `test/context-budget.test.mjs`, a comment block, not a table); code-reviewer already confirmed 0 malformed tables project-wide in `review_reports/review_T-E174-01.md`.

## Verdict

**PASS** — T-E174-01, T-E174-02, T-E174-03, T-E174-05, T-E174-06, T-E174-07, T-E174-08, T-E174-09. (T-E174-04 remains voided, no QA action.)

All non-dropped ACs (AC1-AC4, AC6-AC10) independently re-verified against the working tree, not trusted from the review report. Expected-red diff clean (both entries were the manifest's own predicted qa-owned re-baselines, now resolved). Goldens regenerated with only the justified file changing. Full suite 2417/2417. No other floor moved. Not committing (per assignment — release-engineer's job).
## 2026-09-24T08:49:13.903Z — PASS — by qa-engineer

PASS. All non-dropped ACs (AC1-AC4, AC6-AC10) independently re-verified against the working tree via spec proof commands. Expected-red diff clean: both manifest entries (context-budget coordinator floor, skill-manifest golden byte-identity) were the manifest's own predicted qa-owned re-baselines, not unexplained regressions. Re-measured the coordinator bundle myself via the real render path (composeConstitution+stripOriginTags+stripRationale for constitution side, composeSkill+strips for skill side): 19284 ~tok exactly, matching the manifest figure; raised test/context-budget.test.mjs's floor from 18990 to 19284 (qa-owned bump, comment in established style). Regenerated all 12 goldens (node scripts/capture-constitution-golden.mjs, confirmed it writes into this worktree); only test/fixtures/compose-golden/skill-coordinator-monolith.txt changed, as expected for a coord-only change (constitution-only goldens untouched, AC5/const-01 dropped). No other floor moved. Full npm test: 2417/2417 pass, 0 fail. T-E174-04 remains voided (option B, no QA action). Details: qa_reports/review_T-E174-09.md.

## 2026-09-24T08:49:36.065Z — PASS — by qa-engineer

PASS. All non-dropped ACs (AC1-AC4, AC6-AC10) independently re-verified against the working tree via spec proof commands. Expected-red diff clean: both manifest entries (context-budget coordinator floor, skill-manifest golden byte-identity) were the manifest's own predicted qa-owned re-baselines, not unexplained regressions. Re-measured the coordinator bundle myself via the real render path (composeConstitution+stripOriginTags+stripRationale for constitution side, composeSkill+strips for skill side): 19284 ~tok exactly, matching the manifest figure; raised test/context-budget.test.mjs's floor from 18990 to 19284 (qa-owned bump, comment in established style). Regenerated all 12 goldens (node scripts/capture-constitution-golden.mjs, confirmed it writes into this worktree); only test/fixtures/compose-golden/skill-coordinator-monolith.txt changed, as expected for a coord-only change (constitution-only goldens untouched, AC5/const-01 dropped). No other floor moved. Full npm test: 2417/2417 pass, 0 fail. T-E174-04 remains voided (option B, no QA action). Details: qa_reports/review_T-E174-09.md.

## Re-verification on committed tree (HEAD 19ba906) — 2026-09-24

**Context**: the PASS above was issued against an uncommitted working tree. On the committed branch (`feat/e174-flat-path-sweep`, HEAD `19ba906`), `npm test` came back 2415/2417 — `check:md-tables` was among the failures because it scans `git ls-files` only, and `specs/e174-flat-path-sweep.md` was still untracked (never `git add`ed) at the time of the original run, so its two malformed-table lines (`:43` an unescaped raw `|` inside the `docs/architecture.md:286` inventory quote-cell, `:231` a Visual Tokens N/A row padded to fewer than 4 cells) were invisible to the checker. The PM fixed both lines; the coordinator committed the fix as `19ba906` (`fix(spec): E174 — repair two malformed spec tables (check-md-tables)`). This section re-verifies the now-committed tree from scratch.

**Pre-check**: `git status --short` → ` M NEW-TICKETS.md` only (intentionally uncommitted per PM/coordinator convention — not part of this feature's tracked deliverable). `git rev-parse HEAD` → `19ba90660a0a2442ff2034bb9338a030db8d06f1`, matching the assignment's expected HEAD. Confirmed I am verifying the committed tree, not a stray local edit.

**`node scripts/check-md-tables.mjs`**: `check:md-tables — OK (267 file(s) scanned, 0 malformed tables)`, exit 0. 4 pre-existing non-blocking advisory notes on `docs/backlog.md` (done-mark placement, E88 convention — unrelated to E174, not new). `specs/e174-flat-path-sweep.md` is now tracked (part of commit `19ba906`) and scans clean at both previously-flagged lines.

**`npm test`** (single run, no overlap with any other invocation): **2417/2417 pass, 0 fail**, `# suites 1`, `# cancelled 0`, `# skipped 0`, `# todo 0`, duration ~100.2s.

**Root cause confirmed**: the original 2415/2417 was not a code or test regression — it was `check-md-tables.mjs`'s `git ls-files`-only scan legitimately missing an untracked file that itself contained the two malformed tables the PM then fixed. Now that the fix is committed and the spec file is tracked, the full suite is clean on the committed tree.

**Verdict**: PASS confirmed on the committed tree (HEAD `19ba906`). No new issues found. No code, test, or additional spec changes needed.

## 2026-09-24T15:29:38.237Z — PASS — by qa-engineer

Re-verification on committed tree (HEAD 19ba906). git status --short showed only ` M NEW-TICKETS.md` (intentionally uncommitted); HEAD confirmed at 19ba906. node scripts/check-md-tables.mjs: OK, 267 files scanned, 0 malformed tables (exit 0). npm test (single clean run): 2417/2417 pass, 0 fail. Root cause of the earlier 2415/2417 confirmed: check-md-tables.mjs scans git ls-files only, so the untracked specs/e174-flat-path-sweep.md (containing the two malformed-table lines PM fixed at :43 and :231) was invisible to the checker during the uncommitted-tree run — not a code/test regression. Full details appended to qa_reports/review_T-E174-09.md under "Re-verification on committed tree (HEAD 19ba906)".

