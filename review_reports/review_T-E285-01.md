# Review — T-E285-01 (batched: T-E336-01, T-E294-01, T-E285-01)

covers: T-E336-01, T-E294-01, T-E285-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Range reviewed: `fb7aae5..85ccb26` (commits 8a40995 T-E336-01, 76f742e T-E294-01, 85ccb26 T-E285-01); dispatch base 93ed15c (the base-to-fb7aae5 commits touch only the cut and lane bookkeeping). Inputs: the diff, `specs/e285-integrator-session-handoff.md`, `scripts/fanout.mjs` usage and `tools/fanout-handoff.ts` at this base. No architecture spec exists for this feature.

## Summary
- T-E336-01: 12 command sites move to `git -c pull.rebase=false pull --ff-only` (const-15 1, coord-03 1, skill-integrator 4, skill-release-engineer 6). The three borrowed files differ from the base only by that substitution. The integrator's *Git operations* gains one reason clause, and the two bare grant-name mentions are unchanged.
- T-E294-01: lane-protocol §1 gains the `EnterWorktree` switch, the `pwd` / `git branch --show-current` confirmation, the git-guard finding and the fallback tied to the tool by name. Everything above `## 1.` and from `## 2.` on is byte-identical to the base. No §1 line is a substring of `PROMPT_TEMPLATE_3B` or of the frozen E289 candidate line.
- T-E285-01: adds the close-handoff sub-bullet, the Stage 6 step 7 rewrite, the fourth mode `接手 <manifest>` with its own section, the two-hour idle stop, the MUST-verifier rule for full suites, the differences bullet and the advisory to open a new session.
- Every AC string proof passes, ownership checks exit 0, and the targeted tests are green.
- One required finding blocks approval. The new close-handoff step does not say when to run `handoff --closing` relative to the other uncommitted bookkeeping edits. In the order the SOP is read, the handoff records those edits in its `git status` / `lane-status` facts, so every later `handoff --check` (step 7 "continue", Take-over) reports `DIFF` and stops.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC-E285-1 — implemented — content/skill-integrator.md:197 (new *Write the handoff* sub-bullet directly after the unchanged *Close the manifest* line 196; `need '## Stage 6' … 'handoff <manifest> --closing' '待人類決定' 'not overridable'` prints nothing). The wording meets the AC, but see the Correctness finding R1 on when the command runs.
AC-E285-2 — implemented — content/skill-integrator.md:203 (`grep -c 'next-step recommendation'` = 0; `new session`, `handoff --check <manifest>`, `never proposes the next wave`, `continue` all present in Stage 6).
AC-E285-3 — implemented — content/skill-integrator.md:66 (Invocation names four modes), :31 (Work overview row), :228-235 (`## Take-over` directly before `## Status (any time)` at :237, no heading between); `` `接手 <manifest>` `` count = 4.
AC-E285-4 — implemented — content/skill-integrator.md:112 (sub-bullet under Stage 4 *Watch*; all six strings present; `re-arm from the printed baseline, always` count = 1).
AC-E285-5 — implemented — content/skill-integrator.md:166 (5a MUST paragraph incl. `pre-push`, `never in your own context`), :205 (*Your own commits* sentence), :245 (Output differences bullet above the watermark); the last line is unchanged.
AC-E285-6 — implemented — content/skill-integrator.md:66 (`another role's work`, `new session`, `advisory`).
AC-E285-7 — implemented — `grep -o 'fanout.mjs handoff[^`]*'` yields only `handoff <manifest>`, `handoff <manifest> --closing`, `handoff --check <manifest>`; `node scripts/fanout.mjs` usage line `handoff [--check] <manifest> [--target <branch>] [--repo <dir>] [--mailbox-root <dir>] [--closing]` matches once; `--closing` never appears with `--check` (the tool rejects that combination, tools/fanout-handoff.ts:577).
AC-E294-1 — implemented — docs/lane-protocol.md:20-21.
AC-E294-2 — implemented — docs/lane-protocol.md:25-26 (the fallback line names `EnterWorktree` and carries `cd <worktree> &&`; `$TMPDIR` kept).
AC-E294-3 — implemented — docs/lane-protocol.md:22.
AC-E294-4 — implemented — the head-to-`## 1.` and `## 2.`-to-end diffs against base 93ed15c are both empty.
AC-E294-5 — implemented — no added trimmed line is 21-59 bytes long and no code-fence line was added. A substring check of every trimmed §1 line over 20 characters against `PROMPT_TEMPLATE_3B` (dist) and the frozen E289 candidate finds 0 hits. Every §1 line naming `EnterWorktree` is at least 60 characters. `test/e177a-manifest.test.mjs` passes unchanged.
AC-E336-1 — implemented — old form 0 in all four files; new form 1 / 1 / 4 / 6 (equal to the base's old-form counts); bare grant-name mentions at content/skill-integrator.md:38 and in *Git operations* ("followed by `pull --ff-only` (6-5)") unchanged.
AC-E336-2 — implemented — for each of the three borrowed files, `diff <(base | sed s/old/new/g) file` is empty.
AC-E336-3 — implemented — content/skill-integrator.md *Git operations* (`pull.rebase`, `.current/` present); no reason clause added to the borrowed files.
AC-E336-4 — qa-owned (T-E336-02), not in this round's scope. The expected reds were sampled and are real (see Correctness).
AC-HC-1 — implemented (wording side) — e296 / e177a unchanged and green; `cannot reach \`main\`` once; step 5 starts `` 5. `git switch main` ``.
AC-HC-2 — implemented (wording side) — e178a, e246, e288, e329, e286, e295 green; the *Close the manifest* literal is byte-identical.
AC-HC-3 — implemented — `node scripts/fanout.mjs check specs/fanout-post-v4-w7.md e285 --base main` reports "9 file(s) changed, 0 out of bounds", exit 0; `check --cut … e285 specs/e285-integrator-session-handoff.md` exit 0.
AC-HC-4 — qa-owned (T-E285-02), not in this round's scope.

## Correctness
- **R1 [required] — the closing handoff is generated without a cleanliness precondition, so the checks that depend on it fail by default.** content/skill-integrator.md:197 tells the integrator to run `node scripts/fanout.mjs handoff <manifest> --closing` on the integration branch, write the section and "commit it in the bookkeeping commit". The tool snapshots primary's `git status --porcelain` and leaves out only the manifest file (tools/fanout-handoff.ts:277-287). The primary `lane-status` row's clean/dirty value follows that same fact (:311-315). The bookkeeping commit also carries the 5c edits: done-marks and new rows in `docs/backlog.md`, the queue file and the plan document's close box (5c-1, 5c-3, 5c-5; "the bookkeeping commit", :186). In the order the SOP reads, those edits are still uncommitted when the sub-bullet runs: step 1 runs finish, then *Close the manifest*, then *Write the handoff*. The written handoff therefore records `git status：<n> 項：…` and a `dirty` primary row. Once the bookkeeping commit lands and the pull request merges, primary is clean. `handoff --check` then reports `DIFF` for `git status`, and also for `lane-status`, because `movedReason` (:494-500) accepts the closing annotation only when the rest of the line is unchanged. The new step 7 "continue" rule (:203) and the new Take-over step 3 (:234) both stop on any `DIFF`, and Take-over forbids editing the handoff to make it match. The default path of a wave close therefore leads to a forced stop in the very session handoff this feature adds. The step is also "not overridable". The w6 release spec already hit this: specs/release-post-v4-w6.md AC (c) had to explain `git status` / `lane-status` DIFFs "by this release feature's own uncommitted bookkeeping". Fix (one clause, no AC change): say when to generate. For example: "run it when the manifest is primary's only uncommitted change, so the `git status` fact reads `乾淨` and a later `--check` matches. Generate it before making the other bookkeeping edits, or commit those first." Either ordering keeps the closing annotation verifiable, because the annotated sha stays an ancestor of the merge.
- Command shapes: every cited form (`handoff <manifest>`, `handoff <manifest> --closing`, `handoff --check <manifest>`) parses under `parseHandoffArgs` (tools/fanout-handoff.ts:545-578). The exit semantics cited in Take-over and step 7 match `runHandoff` (:586-626): `MOVED` exits 0, any `DIFF` exits 1, and exit 2 covers usage, input, manifest, git and section errors. The claim that the manifest is left out of the `git status` fact matches :277. `watch baseline` is a real fact key (:37, :356). Both watches print `expiring — re-arm` (scripts/mailbox-watch.mjs:398, tools/lane-status.ts:1529). `--closing` on the integration branch is the case the annotation targets (:254-258).
- Watch-stop handoff left uncommitted on primary (R1 of the spec, G2): this is consistent with 5b-1 (`pull --ff-only` keeps a dirty, untouched file), with 5b-2 (`switch -c` carries it) and with the close handoff replacing it. `validate` checks the section only on a closed manifest (tools/fanout-manifest.ts:843-857). No finding.
- Expected reds (SOP 4a): `qa_reports/expected-red_e285-integrator-session-handoff.txt` does not exist. The reds are enumerated in the spec (AC-E336-4 and the owned-tests table) and assigned to qa task T-E336-02, and the coordinator flagged them as known. I sampled 3 and all are real and locatable: test/e297-main-protected-sop.test.mjs:30 "AC1: integrator Stage 6 …" and :73 "AC7: Constitution section 6 …", and test/skill-manifest.test.mjs "t-golden-byte-identity (AC1/AC5)". All three fail now only on the command-form substitution. **[recommended]**: sr adds the manifest when reworking, so QA's Phase 0.5 has machine data instead of prose. This does not block, because the reds are spec-planned regenerations rather than unexplained reds.

## Quality
- **[recommended]** docs/lane-protocol.md:26 — 「以下兩條都照舊」 presents the mailbox-by-absolute-path rule as pre-existing. At base 93ed15c no lane-protocol sentence says that, and `PROMPT_TEMPLATE_3B` only gives the mailbox path. The spec (AC-E294-2) framed the rule the same way, so this follows the spec. Consider 「以下兩條不論有沒有切換都適用」 so a reader does not hunt for an earlier copy.
- **[optional]** content/skill-integrator.md:112 — "Resuming … re-arms from that section's `watch baseline` line". That only covers the mailbox watch; `lane-status.mjs --watch` (also stopped) has no baseline in the handoff and is simply restarted. Saying so would make "both watches" symmetric on resume.
- **[optional]** content/skill-integrator.md:66 — two consecutive sentences start "Before any stage, …". Merging them would read more cleanly. Pinned prefixes (e288) do not reach this far.
- §1 list structure: the new trailing line at docs/lane-protocol.md:26 is a 3-space-indented continuation of item 4, the same style as the base's continuation lines at :16-17. It renders as part of item 4, which is sensible. No finding.
- Comment check (4b): the diff adds no code comments (content/docs only). No finding.
- The new SOP text does not restate constitution mechanisms. It cites §6 for grants, and the P4 MUST names only the 5a verifier. No finding.

## Architecture
No `specs/e285-integrator-session-handoff-architecture.md` exists. Layering is unchanged. E336's reason is stated once, in the integrator SOP, and the borrowed files change only the command form (AC-E336-2). Mid-wave handoffs stay limited to the watch stop (E293 out of scope). No finding.

## Security
No local absolute path in any added line of either file (grep for `/Users/`, `/home/`, `/private/` is empty). Citations are generic (`<manifest>`, `<worktree>`, `<primary>`). The git-guard text describes a refusal and does not weaken it. No secrets. No finding.

## Performance
Content-only change. The added characters move the zero-headroom context-budget caps (spec-acknowledged; qa re-baselines them in T-E336-02). No runtime path is touched. No finding.

## Verdict
CHANGES_REQUESTED — every AC string proof and the targeted tests pass. But R1 makes the new close handoff, as worded, produce `DIFF`s in the default wave-close order, and that stops the very "continue" and Take-over checks this feature introduces. A one-clause timing precondition in content/skill-integrator.md:197 fixes it.

Tests run (targeted only): `node --test test/e296-manifest-tier.test.mjs test/e177a-manifest.test.mjs test/e178a-integrator-role.test.mjs test/e246-mailbox-teardown.test.mjs` 78/78 pass; `node --test test/e288-integrator-stage0.test.mjs test/e329-integrator-sop-followups.test.mjs test/e286-integrator-trust-and-git.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs` 39/39 pass. Same-model note: the sr pin is opus and this review also ran on opus, so the "different model" recommendation was not met.
