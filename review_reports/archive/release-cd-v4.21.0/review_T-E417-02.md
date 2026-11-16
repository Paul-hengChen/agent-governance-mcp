# Review — T-E417-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff `main...HEAD`: the spec amendment (01e1406), the R1–R5 repro tests (1368ea4) and the fix (b32e363: `tools/merge-invariants.ts` plus the rebuilt `dist/`). Scope stays inside the allowed files.
- The code follows the amended spec closely. R1–R5 fail against the unfixed code for the right reason and pass now. The fallback paths behave as specified: shallow, missing blob, over cap, unreconciled history and partial clones (no lazy fetch). Build, tests and `agc check` are clean.
- **The rule itself lets through new false positives.** I built scratch repos for six legitimate merges that PASS before this change and FAIL after it, with rows reported MISSING that were never lost (FP1–FP5 below). It also creates one new false negative, FN3c: a merge that FAILed before and PASSes now. In every case the merge's manifest count for S is lower than P_c's own count in some component, or the two sides disagree on a row's state. Spec step 8 says "no new false positive" and "the new FAILs are exactly the rows above marked FAIL". These cases show that claim is wrong.
- Verdict: CHANGES_REQUESTED, routed to **architect**. The defect is in the rule (spec steps 4 and 8), not in how the code implements it.

## AC Completeness
- AC12 — implemented — R1–R5 at `test/e203-merge-invariants-union.test.mjs:115-189`. The names match `qa_reports/expected-red_e417-merge-invariants-lost-row.txt` exactly (all 5 entries sampled). Negative control: run against the unfixed dist from `main`, all five fail with `expected 'FAIL', actual 'PASS'`. The five existing E203 cases stay green.
- AC13 — not in this task (qa-owned, T-E417-03). I ran its fallback shapes ad hoc (see Correctness).
- AC1–AC11 — unchanged by this diff. `test/e126-merge-invariants.test.mjs` is untouched, and the E203 file only has new tests appended.

## Correctness

### R-1 (required, rule-level) — history mode creates false positives when the merge's count for S is below P_c's
`tools/merge-invariants.ts:617-628` adds all of H to `U`. Lines 603-604 put a kept id into `U` only through H. Spec step 4 says to do exactly this. Step 8 argues it is safe only under the premise "the merge's count for S is at least P_c's". The rule never checks that premise, and legitimate merges break it. Every case below was built with `commitTree` exactly as in the E203 fixtures, with base `ROWS3` (T-A-01..03 `[x]` under `## Wave`) unless stated, and run through both the unfixed dist and this branch's dist.

| id | shape | old (main) | new (this branch) |
|---|---|---|---|
| FP1 | parent2 compacts `Wave: 3 done`. parent1 reopens T-A-03 (`[ ]`). The merge keeps T-A-03 open under Wave and lowers the count to `Wave: 2 done`. | PASS | **FAIL**, MISSING T-A-01, T-A-02 |
| FP2 | E417 case-2 shape (base T-A-01..04; parent2 `Wave: 4`; parent1 moves T-A-04 to `## Other` and adds T-D-01). The merge keeps T-D-01 under Wave and T-A-04 under Other, and sets `Wave: 3` because T-A-04 is still a visible row. | PASS | **FAIL**, MISSING T-A-01..03 |
| FP3 | Base T-A-03 is `[-]`. parent2 compacts `Wave: 2 done, 1 voided`. parent1 un-voids it to `[x]`. The merge counts it done: `Wave: 3 done, 0 voided`. | PASS | **FAIL**, MISSING T-A-01..03 |
| FP3b | Base all `[x]`. parent2 compacts `Wave: 3 done`. parent1 voids T-A-03. The merge counts `Wave: 2 done, 1 voided`. | PASS | **FAIL**, MISSING T-A-01..03 |
| FP5 | parent2 compacts `Wave: 3`. parent1 moves T-A-03 into `.current/lane-a/tasks.md` § Wave. The merge keeps it there and sets root `Wave: 2`. | PASS | **FAIL**, MISSING T-A-01, T-A-02 |

In each case every row is accounted for, but the tool reports rows that were never lost as MISSING (exit 1). The status quo did not do this. The cause is the same each time:
- FP1, FP2, FP5: a kept row that H recovered still takes a manifest slot after the merge un-summarized it.
- FP3, FP3b: line 624 (`ids.set(id, state)`, "H state wins") overrides the parent occurrence's state, so the component-wise check fails when the merge resolves the state the other way.

Suggested direction (the architect decides):
- **(a)** Apply history mode for F/S only when `entry_merge(S) >= entry_{P_c}(S)` in both components. Otherwise use the snapshot-only rule. This premise is exactly what step 8 relies on. FP1, FP2, FP3, FP3b and FP5 all break it, and so return to their old PASS. R1–R5 all carry P_c's manifest verbatim, so they are unaffected.
- **(b)** For an id that also has a contributing parent occurrence, keep the existing "`[x]` in any contributing occurrence" state. Use H's state only for ids that are in `U` only through H. This keeps the old verdict for those ids and fixes FN3c (R-2).
- The architect also decides whether a case that falls back under (a) gets a WARN line or stays silent.

### R-2 (required, rule-level) — new false negative: H's state hides an `[x]` folded into a voided count
FN3c: base T-A-03 is `[-]`. parent2 compacts `Wave: 2 done, 1 voided`. parent1 completes T-A-03 (`[x]`). The merge keeps parent2's `2 done, 1 voided` and drops the row.
- Old: FAIL. MISSING T-A-01..03, because the `[x]` cannot fit a 2-done count.
- New: PASS, because `tools/merge-invariants.ts:624` replaces T-A-03's state with H's `-`.

A completion recorded on one side is silently counted as voided. History mode was meant only to close false negatives, and here it opens one. Fix (b) above addresses it.

### Noted, not blocking — ambiguous by construction (the spec should say so)
FP4 is FP1 where parent1 also adds T-D-01, and the merge keeps T-A-03 open with `Wave: 3`.
- New: FAIL, MISSING T-A-01, T-A-02, T-D-01. Old: PASS.
- These snapshots are byte-identical to a merge that kept P_c's count verbatim and dropped T-D-01. So FAIL is a defensible reading, and E417 case 2 has the same shape.

This is still a PASS→FAIL change outside the step-7 table. Step 9 should record it as an accepted, intended strictness, not as "no new false positive".

### Cases tried with no regression (old verdict = new verdict unless noted)
- G1: the compaction commit also adds an unrelated kept closed row under S.
- G2: the compaction commit also moves a row to another ledger file (excluded by r2).
- G3: duplicate id in two sections. Falls back as unreconciled with WARN; PASS.
- G4: compaction split across two commits. Unreconciled with WARN; PASS.
- G5: criss-cross merges on both sides.
- G6: section renamed before compaction (FAIL both, same ids).
- G7: the merge also summarizes T-D-01 (`Wave: 5`).
- G8 / G8d: a side compaction discarded by a merge on P_c's path, then re-compacted. "count fell" with WARN; snapshot verdict kept.
- G9: compaction, revert, re-compaction. "count fell" with WARN.
- G11: empty manifest on P_c.
- G13: P_o deletes a base row and keeps T-D-01.
- G14: two sections compacted, only one requested.
- FP1k: reopen, with the merge keeping P_c's count.
- G10 (lane-path ledger) and G12 (parent1 is the compactor): the R1 shape now FAILs correctly.

### Fallback (all behave as specified)
- **Shallow** (`.git/shallow` = base): PASS, exit 0, exactly one `... — shallow repository; snapshot-only (c) used for this section` line. A second run gives a byte-identical report.
- **Missing blob** of `<c1>:tasks.md`: PASS, one `history unreadable: fatal: git cat-file <sha>: bad file` line.
- **Cap**: cap = 1 gives PASS with one `history over cap: more than 1 commits touch tasks.md between the merge-base and parent2` line. cap = 2 runs the walk and FAILs.
- **Partial clone** (`--filter=blob:none` from a `file://` origin): c1's blob is absent before the run and still absent after it. One unreadable WARN, PASS, so no lazy fetch happened.
- **Missing commit object c1**: `NO_MERGE_BASE` (exit 3) from the pre-existing `git merge-base` step, before any history read. Not caused by this diff.

### Gates
`npm run build` leaves the tree clean (dist in sync); `npm test` 4195 pass / 0 fail / 2 skipped of 4197; `node bin/agc-init.mjs check` exit 0.

## Quality
- O-1 (optional) `tools/merge-invariants.ts:895`: if the shallow probe fails with empty stderr, `firstStderrLine` falls back to `e.message`'s first line. With truly empty output, the WARN reads `history unreadable: ; snapshot-only ...`. Cosmetic.
- O-2 (recommended, qa-owned) the header comment of `test/e203-merge-invariants-union.test.mjs:6` still calls the cherry-pick false negative an accepted limit. That is stale after E417; QA should refresh it in T-E417-03.
- Comment discipline: all added doc blocks are 7 body lines or fewer. `agc check` raises no comment warning.

## Architecture
- The implementation matches `specs/e417-merge-invariants-lost-row-architecture.md`:
  - `compactionHistoryRequests` is pure.
  - The walk is only reached when requests are non-empty (`:882`), and the shallow probe runs once per run.
  - `git log --full-history --topo-order --reverse --max-count=cap+1 --format=%H %P` reads real parents.
  - The blob cache is shared, and `historyFallbacks` is always present.
  - `runMergeInvariantsCli` (`:936`) never passes `historyCommitCap`.
- The builder's five stated deviations:
  - `taskRegex` option and exported `historyFallbackAll`: plumbing only, fine.
  - Empty `detail` for shallow: matches the WARN format, fine.
  - `:(top,literal)` pathspec plus `ls-tree --full-tree`: a strict improvement for a subdirectory `repoRoot`. Note that the four pre-existing snapshot reads (`ls-tree -r` without `--full-tree`, `:204`) still read relative to cwd, so in a subdirectory nothing is checked at all. That is pre-existing and out of scope.
  - **Shallow-probe failure → every walk unreadable (`:886-896`)**: a behaviour decision the spec does not cover. It is safe (the old verdict plus a WARN). The architect should record it in step 5 while amending R-1.

## Security
- Every git call uses `execFileSync` with an argv array, so no shell is involved. Refs come from `rev-parse` output (hex SHAs).
- File paths come from `isLedgerPath`, which allows only safe lane names. They are passed after `--`, with `:(top,literal)` on `git log`.
- The tool writes nothing. `GIT_NO_LAZY_FETCH=1` was verified to block the fetch on git 2.50.
- R-3 (recommended): `GIT_NO_LAZY_FETCH` exists only in git 2.44 and later. On older git a partial clone could still lazy-fetch during the walk. Either record a minimum git version in the spec, or treat older git as unreadable history.

## Performance
- No extra git process runs when no verdict depends on history. `compactionHistoryRequests` is pure, and `:882` skips both the probe and the walks when it returns nothing.
- Per walk: one `ls-tree` per distinct commit or parent, plus a cached `cat-file`, bounded by the 256-commit cap. This is within spec step 6. No complexity regression on the ordinary path.

## Verdict
CHANGES_REQUESTED — the code faithfully implements the amended rule, but the rule produces new false positives (FP1, FP2, FP3, FP3b, FP5: legitimate merges where the merge's count for S is below P_c's) and a new false negative (FN3c). Both contradict spec step 8. Route to architect: add the `merge >= P_c` precondition and keep parent-occurrence states over H's states, then add these shapes to the step-7 table and AC13.

---

## Round 2 — APPROVED — by code-reviewer

Reviewed `git diff main...HEAD` (final state) and `git diff b32e363..HEAD` (round-2 delta: spec 509ab05, repro e20d893, fix 3cbd3d9), against the re-derived *Condition (c) history rule (E417)* steps 1–9, AC12/AC13 and the architecture file's "Code deltas against b32e363".

## Summary
- Condition (c) is now two checks. The pre-E417 snapshot check runs unchanged, with unchanged states. A history check `U_hist = (U_snap − K_out) ∪ H_add` runs only when the snapshot check holds, and (c) fails if either check fails (`tools/merge-invariants.ts:682-750`, `historyCheckIds` at `:655-677`).
- Run probes p1–p3 were added (`probeHistoryReadable`, `:431-462`). WARN details are now never empty (`historyErrorDetail`, `:375`).
- The construction is sound. FAIL→PASS is impossible because the snapshot check is unchanged. When `H_add` is empty, `U_hist ⊆ U_snap` with the same states, so the verdict is exactly the pre-E417 one. I checked this by reading the code and by re-running every round-1 fixture.
- I found no false positive outside the S1 family. S1 is defensible: the pre-E417 tool already FAILs its `H_add`-free twin (N02 below). R8 is a genuine loss that suggestion (a) would have passed, so the architect was right to reject (a).
- Verdict: **APPROVED**. One recommended spec clarification (the S1 family). One process item: QA must write the seven AC12 guard tests, which were reassigned from sr to QA.

## AC Completeness
- AC12 repro (R1, R4–R8) — implemented — `test/e203-merge-invariants-union.test.mjs:136-234`. Negative control against main's dist: R1, R4, R5, R6, R7 and R8 all fail with `expected 'FAIL', actual 'PASS'`, which is the right reason. All are green on this branch.
- `qa_reports/expected-red_e417-merge-invariants-lost-row.txt` lists exactly R1, R4, R5, R6, R7 and R8 (6 entries, all sampled). These are exactly the tests that were red before. R2 and R3 were removed.
- AC12 accepted-limit pins R2 and R3 — implemented, renamed and flipped to `assertE417Pass`. The names state "stays an accepted limit and passes". They pass on both the old and the new dist, so the pins are honest.
- AC12 review-round-1 guards (FP1, FP2, FP3, FP3b, FP4, FP5, FN3c) — **partial**. The spec and the architecture file assign them to sr in this file, but the coordinator reassigned them to QA (handoff note), so they are not in the diff. I am not blocking on this because the reassignment was explicit. QA MUST add all seven with the exact AC12 names in T-E417-03, and the Task→AC coverage table should name QA as their owner (see Q-2).
- AC13 — qa-owned (T-E417-03), not in this diff. I ran its shapes ad hoc (see Correctness).
- Pre-existing tests: the diff of the E203 file against main is additions only, and `test/e126-merge-invariants.test.mjs` is untouched. Both suites pass 29/29.

## Correctness

### Harness re-run (old = main's dist, new = this branch's dist)
- **Round-1 cases:**
  - FP1, FP1k, FP2, FP3, FP3b, FP4 and FP5: PASS/PASS.
  - FN3c: FAIL/FAIL with the same ids (T-A-01..03).
- **Round-1 G-set:**
  - G1, G2, G5, G7, G11, G13, G14: PASS/PASS.
  - G6: FAIL/FAIL with the same ids.
  - G3, G4, G8, G8d, G9: PASS/PASS plus one WARN (unreconciled or count fell), keeping the old verdict.
  - G10 (lane ledger) and G12 (parent1 compacts) are R1 drops and move PASS → FAIL. These are intended true positives.
- **Nothing anywhere goes FAIL → PASS.**
- **Fallbacks:**
  - shallow: one WARN, PASS, and a byte-identical second run;
  - missing blob: one WARN with the stderr detail;
  - cap = 1: WARN; cap = 2: walks and FAILs;
  - partial clone (`--filter=blob:none`) on git 2.50: one unreadable WARN, and c1's blob is still absent after the run, so nothing was fetched;
  - missing commit object: NO_MERGE_BASE (exit 3), from the merge-base step that existed before this change.

### New false-positive attacks (old → new)
| id | shape (base Wave T-A-01..03 `[x]`; P2 compacts) | result |
|---|---|---|
| N05 | P2 adds A04, M(4); P1 voids A03; merge M(3,1) | PASS → PASS |
| N06 | base A03 `[-]`; P2 adds A04, M(3,1); P1 un-voids A03; merge M(4,0) | PASS → PASS |
| N07 | P2 adds A04, M(4); P1 moves A03 to `## Other`; merge keeps it there, M(3) | PASS → PASS |
| N08 | P2 adds A04, M(4); P1 reopens A03; merge keeps it open, M(3) | PASS → PASS |
| N09 / N10 | merge re-adds the history-only A04 in a lane ledger, or under `## Other`, and writes M(3) | PASS → PASS (excluded by h2) |
| N11 | P2 later re-adds A04 as an open row under `## Active` | PASS → PASS + WARN (unreconciled; excluded by r2) |
| N12 | duplicate id: A04 also present at P1's tip under `## Other` | PASS → PASS (excluded by h4) |
| N13 | voided history-only A04 counted voided; merge keeps D01 | PASS → PASS |
| N14 | voided history-only A04; merge relabels the count to M(4,0) | PASS → FAIL. Not a legitimate merge: neither side ever marked A04 done, so the merge erased a void with no source. |
| N15 | history-only rows in two sections; merge keeps D01 | PASS → PASS |
| N16 | merge also summarizes T-D-01 and T-D-02: M(6) | PASS → PASS |
| N17 | criss-cross; A04 in the other merge-base, deleted by P1; merge M(3) | PASS → PASS (git picked the base that holds A04, so h3 excludes it) |
| N01 | S1 as written | PASS → FAIL (intended) |
| N03 | S1 family: P1 edits A03's text and adds D01 (a modify/delete conflict); merge keeps the edited A03 and D01, M(3) | PASS → FAIL |
| N04 | S1 family: merge keeps A03 under `## Other`, M(3) | PASS → FAIL |
| N02 | N03 without A04 (P2 M(3), merge keeps the edited A03, M(2)) | **FAIL → FAIL**: the pre-E417 tool already rejects this |

Q-1 (recommended, spec): N03 and N04 are S1 by mechanism but not by fixture. Step 7 describes S1 as "merge keeps A03 `[x]` literally". The rule it applies is more general: a closed base row that P_c summarized, kept anywhere at the merge with any text, still holds a slot. N03 is the realistic way to reach this: a modify/delete conflict resolved by keeping the edited row and lowering the count. The strictness is defensible because N02 shows the pre-E417 tool already FAILs the same resolution without a post-base row (AC-E203-6 premise). E417 extends that premise; it does not create a new one. Step 7 should describe S1 as a family ("kept anywhere, in any section or text, count lowered for it, while P_c also summarized a post-base row") so that adopters are not surprised by N03.

### Suggestion (a) rejected — agreed
R8: P2 adds A04 and compacts M(4). P1 reopens A03 and adds D01. The merge keeps A03 open, writes M(3) and drops D01.
- Every count that could be correct must include A01, A02, A04 (the merge has no row for A04, so P2's count is its only record) and D01 (gone with no row). That is 4, but the merge wrote 3, so this is a genuine loss.
- Under (a), the merge's 3 is below P2's 4, so the rule would fall back to the snapshot check: {A01, A02, D01} = 3 ≤ 3, PASS. So (a) would pass a real loss.
- (a) was also unnecessary. Every round-1 false positive had an empty `H_add`, which the new construction neutralizes on its own.

### Case 2 as an accepted limit — reasoning holds
Two merges produce byte-identical snapshots and history:
- Case-2 drop: merge M(4) + Other A04, D01 dropped.
- A legitimate merge that keeps the moved A04 visibly, takes it out of the count, and summarizes D01 instead (the merge may compact S itself, AC11).

Closing case 2 would bring back FP2. The cherry-pick shape (h4) and "other side deleted a base row" (h3) have the same ambiguity. The step-9 list is complete for the shapes I tried.

### Probes (git shim on PATH, plus real git 2.50)
- **Not a partial clone, fake git 2.43:** the walk runs, R1 FAILs, and p3 is not consulted.
- **Partial clone with:**
  - fake 2.43 or unparsable `git version`: one WARN carrying the fixed spec detail;
  - failing `git version`: WARN `Command failed: git version` (stated deviation, never empty);
  - fake 3.0 or real 2.50: the walk runs with `GIT_NO_LAZY_FETCH=1` and hits the unreadable missing-blob path, with no fetch.
- **Promisor settings:** `remote.origin.promisor=false` alone counts as not partial (walk runs). `promisor=true` without the extension counts as partial.
- **p1 output:** odd output `maybe` gives `history unreadable: git rev-parse failed`; `true` gives `shallow repository`.
- **Helpers:**
  - `gitVersionAllowsNoLazyFetch`: 2.44.0 true, 2.43.9 false, `2.50.1 (Apple Git-155)` true, `10.1` true, garbage false.
  - `historyErrorDetail`: empty stderr and empty message give `git log failed`; null gives `git x failed`; a message with a leading blank line gives its first non-empty line.

### Builder deviations
- The single `probeHistoryReadable` helper is plumbing only.
- The `git rev-parse failed` detail for odd p1 output is consistent with step 5's "else `git <subcommand> failed`".
- `historyErrorDetail` for a failing `git version` call is a case step 2 does not cover. It is safe (unreadable, never empty). Q-3 (optional): step 2/p3 could say so in one clause.

### Gates
- `npm run build` leaves the tree clean (dist in sync).
- `node bin/agc-init.mjs check`: OK.
- Merge suites: 29/29.
- `npm test`: 4198 pass / 0 fail / 2 skipped of 4200.

## Quality
- `historyCheckIds` (`:655-677`) and the shared `reason` helper keep one reason text, so there is no duplication. All doc blocks are 7 lines or fewer, and `agc check` raises no comment warning.
- Q-2 (recommended, process): the architecture file's Affected Files and AC12 still say sr writes the FP1–FN3c guards in the E203 file, but they were reassigned to QA. Align the text, or have QA add them under the AC12 names.
- Round-1 O-2 still stands for QA: the stale header comment at `test/e203-merge-invariants-union.test.mjs:6`. After this round the cherry-pick shape really is an accepted limit again, so the header now only needs wording about the history check.

## Architecture
- Matches the "Code deltas against b32e363":
  - the history `continue` was removed, so `U_snap` is the pre-E417 union for every key;
  - each key gets the snapshot check, then the history check only for keys with a non-null `summarized` (`:722-750`);
  - P_o is resolved by label;
  - h = |`H_add`| and the suffix appears only on the history-check reason;
  - p1–p3 order is respected, and any unreadable probe outcome falls back for every request (`:970-985`).
- The decision records for (a), (b), `K_out` and case 2 match the code.

## Security
- Every new git call (`rev-parse`, `config --get-regexp`, `version`) uses an argv array with no shell, and carries `GIT_NO_LAZY_FETCH=1` through `gitWalk`.
- The partial-clone gate closes round 1's R-3 for git older than 2.44.
- Nothing is written to the repo or the object store; verified on a real partial clone.
- No `any` types. `historyErrorDetail` narrows `unknown` safely.

## Performance
- An ordinary merge makes no extra git call: the probes sit inside `if (requests.length > 0)` (`:970`).
- A run makes at most 3 probe calls, and `git version` only for a partial clone.
- The history check is linear in |`U_snap`| + |H|. No regression.

## Verdict
APPROVED — the two-check rule is sound by construction and verified empirically: no FAIL→PASS anywhere, every round-1 false positive and FN3c back to the old verdict, and the only new FAILs outside the provable-loss repro rows are the S1 family, which extends a strictness the pre-E417 tool already applies. Q-1 and Q-2 are recommended spec/process clarifications that do not block.
