# Review — T-E417B-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff: `git diff main...HEAD`, one commit 601b642, two spec files only (`specs/e126-merge-invariants.md`, `specs/e417-merge-invariants-lost-row-architecture.md`), +36/−17. No source, test or dist change.
- Edit 2 (guard ownership) and Edit 3 (git-version probe) are correct and consistent with the code, the tests and commit history.
- Edit 1 (the S1 family paragraph) is mostly right. Every named test exists and pins what the spec says. The N03 description matches its fixture. But two of its general sentences do not match the code: the family definition is **narrower** than the code, and the "what makes it pass" sentence is **false** for some members of the family as the paragraph itself defines it.
- Verdict: CHANGES_REQUESTED. Two `required` findings, both one-clause wording fixes inside the same paragraph.

## AC Completeness
AC Completeness: SKIP — no specs/e417b-spec-text.md (backlog-row-as-spec mini-chain)

Brief items checked instead:
- Edit 1 (S1 family, step 7) — partial — specs/e126-merge-invariants.md:405-425. See Correctness F-1 and F-2.
- Edit 2 (guard ownership: AC12, the Task → AC table, the architecture file) — implemented — e126:654-655, :680-681, :768; architecture:15, :153-155.
- Edit 3 (p3 git-version failure detail) — implemented — e126:243-245.
- One-word consistency edits ("the S1 family") — implemented — e126:471, architecture:113.

## Correctness

Method: I built scratch repos outside the lane tree (commit-tree fixtures, same shape as `test/e417-merge-invariants-history.test.mjs`) and ran `runMergeInvariants` from the lane's built `dist/tools/merge-invariants.js` on 31 merges. "hist" below means the history-check suffix appeared, so the snapshot check held and the verdict was PASS before E417.

| case | result |
|---|---|
| S1 M(3) / M(4) / M(2) | FAIL hist A01,A02 / PASS / FAIL snapshot (no suffix) |
| N03 (edited A03 + D01) M(3) / M(4) | FAIL hist A01,A02 / PASS |
| N04 (A03 kept under `## Other`) M(3) / M(4) | FAIL hist / PASS |
| A03 kept in `.current/lane-a/tasks.md`, M(3) | FAIL hist (covered by "wherever") |
| A03 kept with new text, P1 = base, M(3) | FAIL hist |
| A03 kept open at the merge, P1 closed, M(3) | FAIL hist (state at the merge is irrelevant) |
| P1 reopened A03, merge keeps it open / `[x]`, M(3) | PASS / PASS (no slot; matches the G7 clause) |
| P1 moved A03 to `## Other` / to a lane file, merge keeps it there, M(3) | PASS / PASS (no slot; matches "closed under S") |
| two kept rows A02, A03: M(3) / M(2) / M(4) | FAIL hist A01 / FAIL snapshot / PASS |
| no history-only row (P2 M(3)), merge keeps A03: M(2) / M(3) | FAIL snapshot / PASS |
| P1 voided A03, merge keeps it: M(3,0) / M(2,1) / M(3,1) / M(4,0) | FAIL snapshot / **FAIL hist** / PASS / **FAIL snapshot** |
| base A03 `[-]`, P2 adds A04 and compacts M(3,1), P1 completes A03, merge keeps A03 `[x]`: M(3,0) / M(3,1) / M(4,0) / M(4,1) | FAIL hist / **FAIL hist** / PASS / PASS |
| A03 **open at base**, both sides close it, P2 adds A04 and compacts M(4), merge keeps A03: M(3) / M(4) | **FAIL hist** A01,A02 / PASS |
| trigger t3 absent (base A01 only, P2 adds A04, M(2); merge keeps A01, M(1)) | PASS, no walk |
| S1 plus P1 adds D01, merge drops D01 and writes M(4) | FAIL hist A01,A02,D01 (the M(4) advice cannot hide a real loss) |

### F-1 — required — specs/e126-merge-invariants.md:405-407

Sentence: "A kept row holds a slot in both checks when it is a **closed base row of S** that P_c summarized and P_o **still** has closed under S".

What is true: rule (i) in `unionReconciliationFailures` (tools/merge-invariants.ts:696) only needs the merge-base to have a row of that id under F/S. The row can be in **any state** at the base. `sectionHistory` puts it in H if P_c closes it and then compacts. Run: A03 `[ ]` at base, both sides close it, P2 adds A04 and compacts M(4), the merge keeps A03 and writes M(3). Result: FAIL with the history suffix, MISSING A01, A02. That is PASS before E417 and FAIL after, so it is a member of the family, but this definition leaves it out. Step 8 (e126:471-472) says "the S1 family is the one shape where that premise turns a PASS into a FAIL". If the family is defined too narrowly, step 8 is not true.

Fix: "when it is a base row of S (in any state at the base) that P_c summarized and P_o has closed under S". Drop "closed" before "base row" and drop "still".

### F-2 — required — specs/e126-merge-invariants.md:421-422

Sentence: "A merge that hits this passes by keeping P2's count, M(4), alongside the kept row."

What is true: the kept row holds its slot in the state **P_o** gives it, because U_snap states are kept (`historyCheckIds`, tools/merge-invariants.ts:663). The manifest has to cover U_hist in each column. P_c's count does that only when P_o kept the row in the same closed state P_c summarized. The paragraph's own definition ("P_o ... has closed", meaning `[x]` or `[-]`) includes members where P_c's count does not pass:
- P1 voids A03 and the merge keeps it with M(2,1): FAIL hist. This is a family member (PASS before E417). With P2's count M(4,0) it still FAILs (voided 1 > 0). It passes only at M(3,1).
- Base A03 `[-]`, P1 completes A03, the merge keeps A03 `[x]` with M(3,0): FAIL hist, a family member. With P2's count M(3,1) it still FAILs (done 4 > 3). It passes at M(4,0) or M(4,1).

The advice is **safe**: following it never makes a real loss pass. U_hist still counts every row a merge must count, and S1 plus a dropped D01 with M(4) still FAILs with D01 MISSING. But as a general claim it is incomplete. A reader who follows it in the two shapes above gets a FAIL they cannot explain.

Fix, for example: "passes by counting the kept row in the manifest, in the state P_o gives it, next to every other row: in S1, N03 and N04 that is P2's count, M(4)." Or limit the sentence to the named examples: "S1, N03 and N04 pass by keeping P2's count, M(4)".

### Confirmed (no finding)
- **N03 description vs fixture** (e126:411-413): the fixture (`test/e417-merge-invariants-history.test.mjs:223-233`) writes M(3), which is P2's M(4) minus A03. "P2's count minus A03" is correct. The brief's "writes the higher count" and the test comment at line 224 ("writes the higher count M(3)") are wrong. The spec is right not to copy them.
- **Named tests**: `E417 S1` (line 211), `E417 N03` (line 223), `E417 N02` (line 235) and `E417 G7` (line 167) all exist in `test/e417-merge-invariants-history.test.mjs`. G7 pins "a kept row P_o reopened holds none": with A03 holding a slot, U_hist would be 4 > 3. N02 asserts the snapshot check fails on its own (no history suffix), which supports "already FAILs before E417". N04 has no test: no test in that file keeps T-A-03 under `## Other`. The only `## Other` fixtures are the case-2 shape, which moves T-A-04. The spec says this correctly.
- "whatever its text" and "wherever the merge keeps it": confirmed for another section, another ledger file and edited text. The state at the merge does not matter either, since a merge that keeps A03 open still FAILs. See optional O-1.
- "So a merge FAILs whenever ... its count leaves no slot for both" (e126:409-410): matches every history-mode run. See optional O-2 for the no-walk corner.
- "FAIL is chosen because ... identical to one that kept A03 AND its count and erased A04's" and "extends an existing rule ... N02 ... already FAILs before E417": consistent with the code and with N02's assertion.
- **Edit 3** (e126:243-245): `probeHistoryReadable` (tools/merge-invariants.ts:456-461) returns `{ reason: "unreadable", detail: historyErrorDetail(err, "version") }`. I ran it with a wrapper `git` that fails only on `version`, in a scratch repo with `extensions.partialclone` set. The result was `{"reason":"unreadable","detail":"fatal: simulated version failure"}`. The reference to step 5's `<detail>` rule correctly covers the `git version failed` fallback when stderr and message are empty.
- **Edit 2**: every place the two files say who writes the guards now agrees: e126 AC12 header (:654-655), the guard group (:680-681), the Task → AC row T-E417-03 (:768), architecture Affected Files (:15) and Code deltas item 5 (:153-155). The T-E417-02 row (:767, "AC12 (repro first ...)") does not claim the guards. Commit 0a1aa93 (the QA commit, "E417 AC12 guards FP1-FN3c") added the seven guards to `test/e203-merge-invariants-union.test.mjs`. No contradiction remains.

## Quality
- O-1 — optional — e126:407: "whatever its text" could read "whatever its text or its state at the merge". A merge that keeps A03 `[ ]` still holds the slot, because the state that counts is P_o's. Without this, a reader may confuse it with "a kept row P_o reopened holds none".
- O-2 — optional — e126:409: "a merge FAILs whenever..." is true only when the walk runs (trigger t1–t3). When every closed P_o row under S is kept, no walk runs and the merge PASSes. Example: base A01 only, P2 adds A04 and compacts M(2), the merge keeps A01 and writes M(1). `H_add` is defined only in history mode, so the sentence is defensible as written. Adding "(history mode, step 4)" would make it exact.
- The "S1" → "the S1 family" edits (e126:471, architecture:113) are consistent. Step 8's line 472 is now longer than the lines around it. That is cosmetic.
- No comments were added (spec text only), so 4b does not apply.

## Architecture
The edits to the architecture file are ownership text and one wording edit. The design is unchanged. Affected Files and Code deltas item 5 now agree with each other and with e126 AC12.

## Security
No findings. Spec text only. No absolute local paths, usernames, internal URLs or codenames were added (checked the full diff). `agc check` hygiene is OK.

## Performance
No findings. No code change.

## Gates
- `node bin/agc-init.mjs check` exits 0 ("OK (4.20.0) — all adapters current").
- `npm test`, run once: 4228 tests, 4226 pass, 0 fail, 0 cancelled, 2 skipped (exit 0).
- No test reads either spec file's text (the only references are path citations in header comments), so no pin moves. Step numbering, the p1–p3 list, the AC12/AC13 headers and the table rows are intact.
- No expected reds: the diff touches no test file, so step 4a is not armed.

## Verdict
CHANGES_REQUESTED. The S1 family paragraph's general definition is narrower than the code (F-1: the base row may be in any state at the base), and its "keep P2's count" pass rule is false for family members where P_o changed the kept row's closed state (F-2). Both are one-clause fixes in e126:405-422. Everything else in the commit is accurate.


## Round 2 — APPROVED — by code-reviewer

## Summary
- Diff: `git diff 601b642..29b08e2`, one commit, `specs/e126-merge-invariants.md` only, +10/−6, all inside the step-7 S1 family paragraph (lines 405-426). Step 8 (lines 466-474) and the round-1 Edit 2 and Edit 3 are unchanged. The branch total is still the two spec files (+40/−17).
- F-1, F-2, O-1 and O-2 are all fixed. Every sentence of the paragraph now matches `unionReconciliationFailures` and `historyCheckIds` (tools/merge-invariants.ts:655-736). I checked them against 43 scratch-repo runs of the built tool.
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/e417b-spec-text.md (backlog-row-as-spec mini-chain)

Brief items: Edit 1 — implemented — e126:405-429 (was partial in round 1, now fixed). Edit 2 and Edit 3 — implemented (unchanged since round 1).

## Correctness

I re-ran the round-1 script (all 31 cases, identical results) and added 12 probes for the new wording.

**F-1 / O-1 wording (e126:405-410).** I derived it from the code. A kept id holds a slot in the history check exactly when it is in `U_snap` and in H (line 663). Being in `U_snap` while kept needs three things:
- a parent occurrence that passes (a), (b) and (d) under F/S, meaning a closed row in a parent whose F does not name S. By t2 that parent is P_o.
- a merge-base row under F/S in **any** state (line 696).
- no S-manifest parent holding the id. P_c does not hold it, because it is in H (rule r2), and P_o's F does not name S.

Being kept is `isKeptAt`, which means anywhere at the merge, in any file, section, text or state. So the new definition is exactly as broad as the code. Probes:
- "whatever its state at the merge": the merge keeps A03 `[ ]` or `[-]` while P1 has it `[x]`, at M(3) → FAIL with the history suffix, MISSING A01, A02. The slot is held.
- "another section included": A03 kept `[ ]` or `[-]` under `## Other` at M(3) → FAIL hist. A03 kept `[ ]` in `.current/lane-a/tasks.md` at M(3) → FAIL hist. Both are covered by "wherever".
- "in any state at the base": A03 open at the base, P2 closes it, adds A04 and compacts M(4), and P1 voids A03. The merge keeps it: M(2,1) FAIL hist, M(3,1) PASS, M(4,0) FAIL. The slot is held in the voided column, which is P_o's state.
- Boundaries still outside the family give no slot: P1 reopens A03 (G7 shape) → PASS. P1 moves A03 to `## Other` or to a lane file → PASS.

**O-2 wording (e126:409-412).** In history mode, t3 holds by construction (step 1). So at least one id has a P_o occurrence under F/S and is not found at the merge, and it is reported MISSING whenever (c) fails for F/S. In every history-mode run, the verdict FAILed exactly when the count was below `U_hist` in some column. The no-walk corner from round 1 (base A01 only, the merge keeps A01, M(1) → PASS, no walk) is now outside the sentence's scope.

**F-2 wording (e126:423-426).** "satisfies (c) once ..." gives a sufficient condition for (c) to hold. It is true:
- S1, N03 and N04 at M(4) → PASS.
- P1 voids A03 → M(3,1) PASS.
- Base `[-]`, P1 completes A03 → M(4,0) PASS.
- Open at the base, P1 voids A03 → M(3,1) PASS.

The author's reason for saying "(c)" rather than "passes" checks out. The merge keeps A03 `[ ]` (or `[-]`, or `[ ]` under `## Other`) while P1 has it `[x]`, at M(4). The result is FAIL with no MISSING row and `lostCompletions` = [T-A-03]: (c) holds, but the separate check that done rows are preserved fails. So "passes" would have been wrong.

It cannot be read as advice that hides a loss. The sentence requires the manifest to cover "every other row (c) must cover", and the kept row is never removed from `U_hist`. S1 plus a dropped D01 at M(4) still FAILs with T-D-01 MISSING.

**Step 8 (e126:466-474).** Under the corrected definition, the claim "the S1 family is the one shape where that premise turns a PASS into a FAIL" holds. The rows the history check counts on top of rows a legitimate merge must count are exactly the kept `U_snap` ids in H. The derivation above shows those are exactly the corrected family. The other PASS → FAIL rows (the repros) come from `H_add` plus a dropped row, not from a kept summarized row.

No findings.

## Quality
No findings. The wording is precise and matches how the surrounding steps write. The line breaks in step 8 are unchanged since round 1 (cosmetic only, not reopened).

## Architecture
No change to the architecture file in this round. Round 1's consistency of ownership and design text stands.

## Security
No findings. Spec text only. The round-2 diff adds no paths, usernames, URLs or codenames.

## Performance
No findings. No code change.

## Gates
- `node bin/agc-init.mjs check` exits 0 ("OK (4.20.0) — all adapters current").
- `npm test` was not re-run: wording only, no test reads either spec file's text. The last full run on 601b642 (round 1): 4228 tests, 4226 pass, 0 fail, 2 skipped. 29b08e2 changes no source, test or dist file.

## Verdict
APPROVED — the S1 family paragraph now states exactly the code's rule (any base state, P_o's closed state under S, any location, text or state at the merge, history mode only, and a (c)-only pass condition), and the round-1 findings F-1, F-2, O-1 and O-2 are all fixed.
