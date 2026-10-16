# Review — T-E286-01, T-E286-02

covers: T-E286-01, T-E286-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff: `c46ab01..c42316b`. Contract: `specs/e286-integrator-trust-and-git.md` (AC1–AC10, R1–R5), checked against its source `docs/integrator-revision-2026-10-08.md` §3.1 Q5/Q7, §3.2, §4 (O4, O5, O8, O10).

## Summary
- T-E286-01: `content/skill-integrator.md` gains Stage 4 `### Mid-wave base fix` (five conditions, stop rule), the O10 sub-bullet, O5 own-manifest watch (Stage 3 check 3 and the Watch bullet), a Decision-rights row, the `裁決者` sentence, and the base-fix merge plus the read-only `merge-tree` sentence under *Git operations*.
- T-E286-02: `docs/lane-protocol.md` gains `## 7.` with the pause, ack and resume rules and the E282 merge-base sentence.
- All AC1–AC9 proof commands pass. The AC10 owned tests pass: 98 pass, 0 fail, 1 skipped. AC4: const-15, rationale, goldens and budget are untouched. The diff touches no file outside its scope.
- Every git operation named is on the base list, in the integrator grant, or read-only. No `merge --abort`, and no `merge --ff-only` or ``fast-forward `main` `` appears in the SOP.
- Three required correctness findings: the O10 wording inverts one row of the revision table, `merge-invariants` would check the wrong repo, and the E282 diff ref can be a stale local branch. Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — implemented — content/skill-integrator.md:108-118 (heading at line 108, between Stage 4 at line 92 and Stage 5 at line 120)
AC2 — implemented — content/skill-integrator.md:118 (stop rule), :200 (Decision-rights row); AC12 test green
AC3 — implemented — content/skill-integrator.md:188 (base-fix use of `merge --no-ff`), :190 (`merge-tree --write-tree` is read-only)
AC4 — implemented — `git diff --quiet <base-sha>...HEAD -- …` prints exit=0
AC5 — implemented — docs/lane-protocol.md:119-125
AC6 — partial — docs/lane-protocol.md:126 passes the proof, but the diff ref can be stale. See required finding C3.
AC7 — partial — content/skill-integrator.md:100 passes the proof, but the parenthetical sorts a revision §4 O10 row into the wrong branch. See required finding C1.
AC8 — implemented — content/skill-integrator.md:205
AC9 — implemented — content/skill-integrator.md:88, :96; `_mailbox/*/` count is 0
AC10 — implemented — the 6 owned test files pass (98/0/1 skipped); the pinned sentences are unchanged

## Correctness
- **C1 `required`** — content/skill-integrator.md:100 (O10). The text reads "Otherwise — not written in the spec (or written back by the lane and approved by the human there), or affecting another lane or the whole wave — ask in this session." That puts the write-back-then-approved-in-lane case on the "ask" side. Revision §4 O10 table row 2 says "仍要問；或請 lane 寫回 spec，人類在 lane 上核准那份更新": the write-back is the alternative to asking, and once written back and approved it is not re-asked. The sentence also contradicts its own test, because a write-back the human approved in the lane is written in an approved cut and visible on the branch, so it meets (a)–(c). Spec AC7 has the same ambiguous parenthetical; follow the source it cites. Suggested wording: "Otherwise — a decision not written in the spec, or one affecting another lane or the whole wave — ask in this session; for the first, the lane may instead write it back into its spec and have the human approve that update in the lane, after which (a)–(c) apply." The AC7 proof strings are unaffected.
- **C2 `required`** — content/skill-integrator.md:116 (condition 5). Bare `node scripts/merge-invariants.mjs` checks the HEAD of `process.cwd()` (tools/merge-invariants.ts:521, :582). The integrator's cwd is primary, not the lane worktree where `git -C <worktree> merge` just landed. The result is either `NOT_A_MERGE_COMMIT`, or a PASS on an unrelated merge, which is false assurance. Fix: name the worktree, e.g. `node scripts/merge-invariants.mjs HEAD <worktree>` (the CLI takes an absolute repo root). The same applies to "the lane's `npm run build` and `npm audit`": say they run in the worktree (`cd <worktree> && …`).
- **C3 `required`** — docs/lane-protocol.md:126 (E282). `git diff <目標分支>...HEAD` invites a lane to type the local `main`. The integrator merges `origin/<target>` (SOP condition 5), and condition 1 only fetches, so nothing fast-forwards local `main`. Worktrees share local refs, so `main` is typically stale. Then merge-base(`main`, HEAD) is the old `main`, and the diff again includes the files the merge brought in: exactly the false scope violation E282 is meant to remove. Fix: name the merged ref, e.g. `` `git diff origin/<目標分支>...HEAD` `` ("the ref the integrator merged"). The AC6 proof strings still match.
- **C4 `recommended`** — content/skill-integrator.md:116-118. Nothing says what happens when a condition-5 check fails after the merge (merge-invariants non-zero, build or audit red). Mirror 5b-3 ("Non-zero exit → stop"): send no resume notice; stop and hand the case to the human, marked "needs human ruling".
- **C5 `recommended`** — docs/lane-protocol.md:125. "先確認 `git rev-parse HEAD` 等於它（通知點名要重建的 `dist/` 就先 commit），再繼續" can be read as commit first, and then HEAD no longer equals the merge sha. Make the order explicit: first confirm HEAD equals the merge sha, then commit the named `dist/`, then continue.
- Checked and fine: the condition-2 direction (`<lane>...origin/<target>` is what the merge brings in); the condition-4 exit-code semantics; the stop rule naming conditions 2 and 4 and "never merge". Lane §7 matches the integrator side: pause = `proposal` on a `base-fix` topic, ack = HEAD sha, resume = `close` with the merge sha. The lane never merges, and the §3 line `不要 push、不要 merge…` is untouched. §5 rule-3 and rule-6 references resolve (lane-protocol.md:88, :98).

## Quality
- `optional` — content/skill-integrator.md:200. "with all five *Mid-wave base fix* conditions holding" counts condition 5, which is the merge and its follow-ups, as a precondition. The wording comes from the spec; acceptable.
- `optional` — Brevity: about 3.3k characters added to the SOP against the spec's "≤ about 3000" target. Within tolerance; no trim required.
- Comment check (4b): the diff is Markdown only and adds no code comments.

## Architecture
No architecture spec (under the architect threshold, per the cut). R1 (merge-tree stays out of §6) and R5 (new last `## 7.`, §1–§6 numbering unchanged) are followed. The lane-protocol stays the single copy of the lane-side rules, and the SOP points to it.

## Security
No findings. Every git operation is within Constitution §6 (content/const-15-core-tail.md:12, :15) or read-only. No `merge --abort` or `reset` path is introduced. "approved" in a mailbox message stays void.

## Performance
No findings. The change is documentation only, with no runtime path.

## Verdict
CHANGES_REQUESTED — three required correctness defects. The O10 parenthetical contradicts revision §4 O10 (C1), condition-5 `merge-invariants` checks primary instead of the lane worktree (C2), and the E282 diff ref can be a stale local branch that reproduces the false scope violation (C3).

Note: the reviewer and the sr both ran on opus (same-model bias possible).
