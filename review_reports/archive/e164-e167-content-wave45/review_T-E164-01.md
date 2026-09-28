# Review — T-E164-01

covers: T-E164-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff (uncommitted, vs HEAD) touches `content/skill-release-engineer.md` (8a push bullet, 8b, 8c, 9a, Escalation 8b row), `content/skill-coordinator-lite.md:21` (NEW-1 option B), `content/skill-pm.md:116` (NEW-3), and `NEW-TICKETS.md` (new L-CONTENT-NEW-5). Bookkeeping: `tasks.md`, `.current/`, `qa_reports/expected-red_e164-e167-content-wave45.txt`. AC11 holds.
- AC3, AC4, AC5, AC6, AC7 and AC11 are met. AC1 and AC2 are met as literally written, but see C1.
- Three correctness findings. All three are cheap prose fixes in the same file, and two of them are regressions this diff introduces. C2 is the one sr filed as L-CONTENT-NEW-5. I judge it a regression introduced by E167, so it should be fixed in this cut, not filed.
- Verdict: CHANGES_REQUESTED.

## Correctness

**C1 (blocking): the E164 advice, stated unconditionally, turns every green release into a human escalation on exactly the hosts it targets.** `content/skill-release-engineer.md:230`. The new sentence says that when the host timeout cannot be raised above `AGC_VERIFY_CI_WAIT_SECONDS`, the operator should set the budget below the host timeout. Under `--strict`, the budget running out is a printed `FAIL:` (`scripts/verify-release.mjs:466-496`), and the STOP fires on it. The same paragraph measures CI at 139–184s (median ~165s) and names ~120s as the common host timeout. Take a host capped at 120s. The budget becomes something like 110s, so every ordinary green run (~165s) runs out of budget first, prints a strict FAIL, and routes Blocked/human. Before this diff, that host converged: the first attempt was killed at 120s, and the re-run found the run finished at ~165s. So the fix trades a livelock in the rare *hung* case for a guaranteed escalation in the common *green* case. That is the "a gate that blocks every good release is a gate someone eventually relaxes" hazard the paragraph itself warns about. The approved decision ("budget below host timeout → printed strict FAIL") can be kept if it is sequenced correctly. Suggested fix: make the first attempt with the normal budget. After the first host kill, re-run with `AGC_VERIFY_CI_WAIT_SECONDS` set below the host timeout. CI completes at a fixed wall-clock time set by 8a's push, so by the re-run a run that finishes normally is already resolved and returns PASS immediately. A hung run then ends in the printed strict FAIL instead of another kill. An alternative is to limit the advice to hosts whose timeout still exceeds the CI run's duration, and rely on the `fix_try`-capped re-runs otherwise. Either way, the green path must not regress. If sr reads this as contradicting the approved cut, route it to the coordinator. I do not believe it does.

**C2 (blocking; this is the regression sr filed as L-CONTENT-NEW-5): a pre-8b local tag plus a red 8b leaves a stale tag that dead-ends the fix-forward retry.** `content/skill-release-engineer.md:232` together with `:277` and Hard rule `:15`. Before this diff, the tag could only be created in 8c after `CI-CHECK PASSED`, so a red 8b never left one behind. E167 now allows the tag before 8b. A red 8b then leaves a local `vX.Y.Z` pointing at the rejected commit. On the fix-forward retry (same version, new commit), the agent cannot re-point the tag, because `git tag -f` is forbidden. The row at `:277` ("tag already exists locally OR on origin") fires and forbids deleting the tag ("never delete it yourself per Hard rules"). Meanwhile 8c now calls `git tag -d` a legitimate undo. The escalation path is newly reachable and exists only because of this diff, so it is a regression and not a follow-on. The fix is one clause inside the approved E167 seam and needs no relabeling. Take sr's option (a) in 8c's tag bullet or in 8b's STOP sentence: if 8b STOPs, `git tag -d vX.Y.Z` any unpushed local tag before the Blocked write. Then mark L-CONTENT-NEW-5 in `NEW-TICKETS.md` as resolved in this cut, or remove it. Narrowing the `:277` row (sr's option (b)) is optional and not required.

**C3 (blocking, small): "any time after 8a's commit" includes a window in which 8a's own post-commit check misreads the new tag.** `content/skill-release-engineer.md:232` against `:222`. 8a's post-commit sanity check (AC4) runs *after* the commit and derives `PREV_TAG=$(git describe --tags --abbrev=0)`. Suppose the tag is created immediately after `git commit`, as 8c now explicitly allows. `git describe` then returns the new tag at HEAD, `git diff $PREV_TAG..HEAD` is empty, and the REQUIRE and MULTI-FEATURE branches STOP falsely because the spec is "absent from the range". This fails safe, but it is a new false STOP that the diff introduces. Fix: permit the local tag "any time after step 8a completes (after its post-commit sanity check), including before 8b". This still satisfies the approved "incl. before 8b". The 8a push-bullet parenthetical at `:227` sits after the sanity check, so it is fine as is.

Expected-red (step 4a): the manifest `qa_reports/expected-red_e164-e167-content-wave45.txt` exists. Its one entry, `test/context-budget.test.mjs | AC1/AC2: skill-pm stripped token count meets ≤ 4376 cap`, is a real test (`test/context-budget.test.mjs:692`). I ran `node --test` on context-budget, release-staging and verify-release: 183 pass, 1 fail, and the failure is exactly that entry.

## Quality
- **sr note (a), the 8a change from "Do NOT tag or push a tag here" to "Do NOT push a tag here … (a local `git tag -a` is permitted per 8c)"** (`:227`): this is required for consistency, not scope creep. If 8a had kept the old text, it would forbid in 8a exactly what 8c now permits after 8a's commit.
- **sr note (b), "currently 480s"** (`:230`): this text predates the diff. AC3 pins only 9a, and 9a is clean (the only `480` occurrences are `:230` and the rationale at `:237`). It does go against the E82 maintenance note at `:237`, which says to cite `DEFAULT_WAIT_SECONDS` by name and not restate the figure. This diff rewrites that same paragraph, and no test pins the literal (the VR tests avoid it deliberately), so dropping ", currently 480s" while fixing C1 is recommended but not blocking.
- The Escalation 8b row (`:274`) matches the new prose: it still starts with `| CI gate failure (step 8b:` and names the `fix_try` cap. After C1, re-check that its wording "set the budget below the host timeout and re-run" matches the sequencing you choose.
- The lite pointer (`skill-coordinator-lite.md:21`) resolves to a real anchor: the **Cut-Approval Gate** row at `skill-pm.md:110` and the exact header quoted at `:114`. No `id | desc |` list remains in lite.

## Architecture
No architecture spec (mini-chain, backlog-row-as-spec). Step labels 8a/8b/8c/9/9a are unchanged (AC4). The E167 change sits inside 8c as the approved decision requires, and all release-engineer edits are in one file (AC5).

## Security
No findings. Prose-only change to content files. The irreversible act (tag push) stays gated by `CI-CHECK PASSED`.

## Performance
No findings. The lean always-on bundle shrank (lite −12 chars). The only floor that moves is skill-pm (+100 chars, expected red, qa re-baselines).

## Verdict
CHANGES_REQUESTED: three small prose fixes in `content/skill-release-engineer.md`. C1 is the green-path regression from applying the budget-below-host-timeout advice unconditionally. C2 is the stale pre-8b tag deadlocking the retry, which is L-CONTENT-NEW-5, introduced by this diff and to be fixed here. C3 is the post-commit `git describe` window.

### sr-engineer reply to Round 1 — by sr-engineer (fable)

- **C1 fixed** (`content/skill-release-engineer.md` 8b paragraph). The advice is now sequenced. The first attempt runs with the normal budget and the longest host timeout available, and the text now warns against lowering the budget pre-emptively (the green-path hazard you described). The budget goes below the host's command timeout only for the re-run after the first host-level silent kill. A run that completes normally is resolved by then and returns `CI-CHECK PASSED` immediately; a hung run ends in the printed strict `FAIL:`. The `fix_try` cap on consecutive silent-kill re-runs, leading to Blocked/human, is unchanged. The Escalation 8b row and the 9a note now use the same sequenced wording.
- **C2 fixed** (option (a)). 8b now says that on every 8b STOP, whether a printed non-PASS result or the `fix_try` cap, any unpushed local tag is deleted with `git tag -d vX.Y.Z` before the Blocked write. The cap-STOP sentence and 8c's tag bullet both point back to this rule. The No force pushes Hard rule is untouched. The `:277` row was not narrowed. L-CONTENT-NEW-5 in `NEW-TICKETS.md` is marked **RESOLVED in-cut**; its entry is kept and a resolution note is added.
- **C3 fixed.** 8c now reads "any time after step 8a completes", i.e. after 8a's post-commit `git describe` sanity check, "including before 8b". The 8a push-bullet parenthetical now reads "permitted per 8c, once step 8a completes".
- **Recommended item done.** ", currently 480s" is replaced by "(default `DEFAULT_WAIT_SECONDS` in `scripts/verify-release.mjs`)". The only `480` left in the file is the pre-existing E82 rationale line.
- Verification: `npm run build` exit 0; `npx tsc --noEmit` exit 0; `npm test` 2317/2318, and the single failure is the manifested expected red (`test/context-budget.test.mjs | AC1/AC2: skill-pm stripped token count meets ≤ 4376 cap`); `check:md-tables` OK.

## Round 2 — APPROVED — by code-reviewer

## Summary
- Re-reviewed the uncommitted diff vs HEAD: `content/skill-release-engineer.md` (8a push bullet, 8b and its host-kill paragraph, 8c, 9a, Escalation 8b row), `content/skill-coordinator-lite.md:21`, `content/skill-pm.md:116`, `NEW-TICKETS.md` (L-CONTENT-NEW-5 marked RESOLVED in-cut), plus bookkeeping.
- C1, C2 and C3 are all fixed as requested, and the recommended "currently 480s" removal is done. The fixes introduce no new contradictions.
- AC1–AC7 and AC11 still hold (re-checked below).
- Verdict: APPROVED.

## Correctness
**C1 fixed.** `skill-release-engineer.md:230`. The paragraph now makes the first attempt with the normal budget and the longest host timeout, and it forbids lowering the budget pre-emptively, stating the green-path hazard. The budget goes below the host timeout only for the re-run after the first silent kill. The consecutive silent-kill re-runs are capped by `fix_try`, and the cap leads to Blocked/human. I traced a 120s-capped host: the first attempt is killed at about 120s. The re-run uses a budget of about 110s, so it polls until about 230s. An ordinary green run (139–184s) resolves inside that window and returns PASS, and a hung run ends in a printed strict `FAIL:`. The green path converges. The Escalation 8b row at `:274` matches: it covers a printed non-PASS result OR the `fix_try` cap, and it uses the same sequenced re-run wording. The 9a note matches too: it gives the same sequencing, and non-strict budget expiry stays WARN, which is consistent with Check 6's lenient posture.

**C2 fixed.** `:228`. On every 8b STOP, whether a printed result or the cap-STOP (`:230`, "deleting any unpushed local tag first, as above"), the run's own pre-8b local tag is deleted with `git tag -d` before the Blocked write. The 8c tag bullet at `:232` points back to this. I checked it for contradictions:
- *vs the Hard rule `:15` (No force pushes)*: that rule forbids `git push --force`, `git tag -f`, and deleting a remote tag, and it says "Tags are immutable once published". A `git tag -d` on a never-pushed local tag is none of these, and the 8b sentence says so explicitly. No conflict.
- *vs the row `:277`* ("tag already exists … never delete it yourself per Hard rules"): the 8b deletion is scoped to "any local tag created ahead of this gate per 8c", meaning the tag this session just made, inside the only window where it can exist (8a done → 8b; no other STOP sits in that window). Row 277 covers a tag the agent finds already present, typically from another session or published. Those are different objects. The rules do not overlap, and the row's fail-safe still applies to a stale tag left by a crashed session. No conflict.
- NEW-TICKETS.md: L-CONTENT-NEW-5 has a RESOLVED in-cut header and a resolution note. The original body keeps "not fixed here", and the appended resolution overrides it. Acceptable for an append-style ledger.

**C3 fixed.** `:232` now reads "any time after step 8a completes — i.e. after 8a's post-commit sanity check … including before 8b", and it gives the `git describe` reason. The 8a push bullet at `:227` reads "permitted per 8c, once step 8a completes". The window no longer overlaps 8a's `PREV_TAG` derivation. The 7a/8a CHANGELOG-citation `git describe` also runs before 8a completes, so it is unaffected.

**Recommended item done.** `:230` now cites "`DEFAULT_WAIT_SECONDS` in `scripts/verify-release.mjs`". The only `480` left is the pre-existing E82 rationale at `:237`, which is historical ("changed to 480s") and correctly left alone.

**AC re-check.** AC1/AC2: the E164 budget-below-host-timeout advice (now sequenced) and the `fix_try`-capped silent-kill re-runs are both present in 8b. AC3: the 9a note cites `DEFAULT_WAIT_SECONDS` by name, with no literal figure. AC4: step labels 8a/8b/8c/9/9a are unchanged, and the Escalation row still starts with `| CI gate failure (step 8b:`. AC5: the E167 seam sits inside 8c. The tag is local and reversible and may be created after 8a completes, incl. before 8b. Only the push is gated by `CI-CHECK PASSED`. All release-engineer edits are in one file. AC6: the lite pointer resolves to the skill-pm *Cut-Approval Gate* header, and no inline `id | desc |` list remains. AC7: skill-pm `touches` excludes `tasks.md`, `.current/**`, `qa_reports/**`, `review_reports/**`. AC11: no files outside the approved set, apart from governance bookkeeping.

**Verification (independent).** `npm run build` exit 0. `npm test` gives 2318 tests: 2317 pass and 1 fail. The one failure is `test/context-budget.test.mjs` "AC1/AC2: skill-pm stripped token count meets ≤ 4376 cap", which is exactly the single manifested entry in `qa_reports/expected-red_e164-e167-content-wave45.txt` (step 4a: the manifest exists, and its entry is a real, locatable test). `node scripts/check-md-tables.mjs` returns OK (0 malformed). No test pins the removed wordings ("Simply re-run", "Do **NOT** tag or push", "currently 480s").

## Quality
Non-blocking nits, none required:
- `:230` says a normally completing run "returns `CI-CHECK PASSED` immediately" on the re-run. On a 120s host the re-run may still poll for about 45s before the run resolves. "within the lowered budget" would be more exact. Similarly, "below the host's command timeout" could say "comfortably below" to leave margin for `gh` call overhead.
- Pre-existing and not from this round: row `:277` does not explicitly exempt the agent's own pre-8b tag when it reaches 8c. The 8c bullet makes clear that the tag may already exist by then, so a careful reader will not re-run `git tag -a`. If a future lane touches this file, narrowing the row to "a tag this session did not create" would remove the last ambiguity.

## Architecture
No architecture spec (mini-chain). The fixes stay within the approved E164/E167 decisions: the E164 advice is sequenced, not dropped, and the E167 seam stays inside 8c. No step renumbering.

## Security
No findings. The only irreversible act, the tag push, remains gated by `CI-CHECK PASSED`. The new `git tag -d` is confined to unpushed local tags.

## Performance
No findings. Prose-only. The lean bundle is unchanged from round 1. Only the skill-pm floor moves (expected red; qa re-baselines).

## Verdict
APPROVED: C1–C3 and the recommended item are resolved without new contradictions, AC1–AC7 and AC11 hold, and the only red is the manifested skill-pm floor.
