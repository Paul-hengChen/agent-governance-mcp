# Review — T-E178A-01

covers: T-E178A-01, T-E178A-02, T-E178A-03, T-E178A-04, T-E178A-05

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff: `git diff 5911943..e64bc11` (0dc3ab4, ebf9086, 30cc71d, e64bc11). Spec: `specs/e178a-integrator-role.md` AC1–AC16 (AC17 is qa's T-06/07). No architecture spec (no architect hop by design). Reviewer model: opus; sr-engineer ran on fable, so different models.

## Summary
- Adds `content/skill-integrator.md` (191 lines), carried over faithfully from the interim `.claude/commands/integrator.md` (deleted). Adds `prompts/integrator.ts` and PROMPT_REGISTRY entry #12. Syncs the CLAUDE.md counts 11→12. Adds three §6 sub-bullets in `content/const-15-core-tail.md` (amend FORBIDDEN, integrator-only grant, tool-internal ops). Formalises the `T-<ticket>-NN` ids and the §5 mailbox rules in `docs/lane-protocol.md`, and changes the comment on `tools/fanout-manifest.ts` (comment only).
- File bounds: `node scripts/fanout.mjs check specs/fanout-wave7.2b.md e178a --base 3c72a83` gives 22 files and 0 out of bounds. D11 holds: `tools/role.ts` and `tools/transitions.ts` are unchanged. `dist/` is in sync (a rebuild produces no diff).
- Every command and flag the SOP cites exists at HEAD: `fanout.mjs validate|render|check` (`--summary --reading --mailbox-root --base`), `lane-status.mjs --watch/--mailbox-root/--rollup/--lanes/--all`, `mailbox-watch.mjs` (watch `--baseline k=N`, keys are the parent dir, that is the lane; `--send --from --type --re --body`; `armed:` and `expiring — re-arm` output), `merge-invariants.mjs`, `test-lock.mjs -- <cmd>`, and `bin/agc-init.mjs feature finish … --shipped` (allocates ids, moves to history, removes the worktree and branch).
- Verdict: CHANGES_REQUESTED on one blocking process finding. The expected-red manifest is missing. The content itself is sound.

## AC Completeness
AC1 — implemented — `content/skill-integrator.md:1-3` frontmatter `recommended_model: sonnet`; purpose section :6-16 (the three needs, why no existing role can do it, the one-sentence summary; checked against the interim's 為什麼有這個角色 section, faithful per Q7); work overview :18-30 (stages 1–6 plus "any time", 👤 marks); can / cannot table :32-39; "You are not" list :45-49; ends with the `— @integrator` no-tier rule :191
AC2 — implemented — references: fanout validate/render/check :77,:90,:116; mailbox-watch :88,:94,:96; lane-status --watch/--mailbox-root :96, --rollup :154; test-lock :111; merge-invariants :139; `agc feature finish --shipped` :151,:161. `開始做 <計劃` is absent (grep has no output). There is no manifest skeleton, and the report format is pointed to lane-protocol §5/§6 at :94
AC3 — implemented — `tools/registry.ts:1038-1043`; dist import prints `12` plus the exact entry; the diff only appends, so the first 11 are byte-identical; `prompts/integrator.ts` matches the `prompts/pm.ts` shape
AC4 — implemented — proof prints `exit=0`; SOP :64-66
AC5 — implemented — proof prints `2`; CLAUDE.md :7,:10,:33,:37-42,:107,:115
AC6 — implemented — `content/const-15-core-tail.md:14`. Base list and existing FORBIDDEN are unchanged. The grant is integrator-only, names all six ops with the `--force` / `-D` exclusions, says "every other role stays on the base list", and points at `skill-integrator`
AC7 — implemented — const-15:13. FORBIDDEN for all roles, with the reason and "make a follow-up commit instead". It names no incident
AC8 — implemented — const-15:15. Start is the lane's role and finish the integrator's, and "never typed by hand as a substitute when the tool refuses"
AC9 — implemented — SOP :141-147 (a) substantive definition with the dist/golden carve-out, (b) Task code-reviewer plus `git show --remerge-diff`, (c) `review_reports/review_merge-<short-sha>.md` with no tw_update_state (E222), (d) no ff before APPROVED, (e) qa via Task for regeneration :146, (f) never fix feature code :147
AC10 — implemented — SOP :94-105 (pre-review before the human approves, once per lane, the mailbox never carries approval; every AC has an implementing task; architect twice; `hop:`/batching; close/reopen; 3-exchange cap leads to escalate; re-arm from the printed baseline; `lane-status --watch` plus `--mailbox-root`; the format is referenced, not copied)
AC11 — implemented — `docs/lane-protocol.md:82-83` (b)(c) Q3 default; :85 (a) the wait stays armed across every human-approval pause
AC12 — implemented — SOP :171-181. The table rows match the spec (and the interim's permission row), and the "needs human ruling" rule is present
AC13 — implemented — SOP :125-133. Generic read-only (D10), the six result items including post-suite porcelain and log-to-scratch, and the five constraints by number with names (Q4)
AC14 — implemented — `docs/lane-protocol.md:36` (§3), with the collision reason
AC15 — implemented — lane-protocol:5 repointed; fanout-manifest comment-only (AC15 proof: no non-comment lines); template bytes unchanged
AC16 — implemented (lane half) — `.claude/commands/integrator.md` deleted, `git ls-files .claude` is empty. The `NON_SOURCE_DIRS` edit is qa's (T-06/07). Partition is still green now (release-staging 80/80)

## Correctness
- **[required] R1 — expected-red manifest missing.** 16 intentional reds exist; I reproduced all 16: compose-equivalence ×11, context-budget ×4 (tests 11/34/35/47), skill-frontmatter ×1 (test 8 "every content/skill-*.md carries a valid recommended_model frontmatter"). But `qa_reports/expected-red_e178a-integrator-role.txt` does not exist. `content/skill-sr-engineer.md` step 7a (C15) makes this mandatory whenever a handoff leaves ≥1 test red, and states that a prose catalogue in handoff notes does NOT substitute. QA Phase 0.5 diffs this manifest against the suite run. The path is inside the lane's bounds: fanout check treats `qa_reports/*e178a*` as case-insensitive implicit lane bookkeeping, and there is precedent in `expected-red_e130-lane-default.txt` and `expected-red_e177b-lane-status-tooling.txt`. Fix: write the file with 16 `<file> | <exact test name>` lines under grouped `#` rationale, then commit it. No content change is needed.
- **[recommended] R2 — SOP-mandated git ops that sit outside §6.** SOP 5b-1 `git fetch` (:137) and 6-1 `git switch main` (:159) appear in neither the §6 base list nor the new integrator grant (const-15:12,:14). The SOP's own decision-rights row "any git operation outside this role's §6 grant → always the human" (:179) therefore makes two routine steps human-gated if read literally. That undercuts user story 2 ("stop needing a per-invocation authorisation"). The problem predates this change: the interim had both, and `skill-release-engineer.md:55` already uses `git fetch origin` unlisted. Still, this lane is where the contradiction becomes explicit. Resolving it widens the approved AC6 list, so it **needs a human ruling**: either add `git fetch` / `git switch <existing-branch>` to the grant (or base list), or classify them in §6 as non-destructive. File it as a pending ticket if it isn't fixed in this round.

## Quality
- [optional] Q1 — SOP :161 writes `agc feature finish <lane>`, while the tool's usage string says `<ticket-id>` (`bin/agc-init.mjs:942`). In practice the lane name is what gets passed (the `close lane e223` commits), so this is harmless. A parenthetical "(the lane name)" would remove the ambiguity.
- The `prompts/integrator.ts` wrapper is not imported by `index.ts` (it dispatches via `entry.skillFile`). This matches every other `prompts/<role>.ts`, and AC3 requires it, so it is not a finding.

## Architecture
No architecture spec exists (no architect hop, as the spec justifies). Layering fits the existing pattern: a registry entry plus a thin wrapper plus a skill file. D11 is honoured (prompt only; no enum, transition or ROLE_SKILL_MAP change). There are no contradictions between the SOP, lane-protocol §5/§6 and §6 of the constitution. The integrator's 20-minute nudge (:104) and the lane's 30-minute nudge (lane-protocol §5 rule 6) apply to different sides, as in the interim. The integrator's "Stop and report" (:169) correctly replaces §6's `status: Blocked` write for a role that never calls tw_update_state.

## Security
No findings. There is no new input boundary, and no secrets or `.env` paths appear. The §6 grant keeps the destructive variants excluded (`--force`, `-D`) and makes `update-ref -d` compare-and-delete only. It does not loosen any FORBIDDEN entry, and it adds one (`commit --amend`).

## Performance
Budget growth is +217 ~tok on every measured bundle: lean always-on 4912→5129 (+4.4%), design-arm 9421→9638, teamwork 19799→20016, non-design 7323→7541. This is justified. The spec puts the grant in §6 (AC6–AC8), and const-15 is a core fragment, so every role pays for it. The three bullets stay within AC6's "≤ ~4 lines". [optional] P1 — the tool-internal bullet (const-15:15) repeats the op names already listed in the grant bullet (`update-ref -d <ref> <expected-sha>`, `worktree remove`, `branch -d`). Writing "incl. start's rollback and finish's teardown ops" would save roughly 20–30 tokens without losing meaning. There are no runtime or code-path changes.

## Verdict
CHANGES_REQUESTED — the implementation meets AC1–AC16, but the 16 intentional reds have no `qa_reports/expected-red_e178a-integrator-role.txt` manifest, which sr SOP 7a / C15 requires (R1). R2 is recommended and needs a human ruling.

### sr-engineer reply — Round 1
- R1: done in 48e0a05. `qa_reports/expected-red_e178a-integrator-role.txt` has 16 lines in three `#`-rationale groups. Names are copied verbatim from a full `npm test` on 75b7240 (2795 tests, 2779 pass, 16 fail; compose-equivalence ×11, context-budget ×4, skill-frontmatter ×1). The set of failing names is the same as in Round 1. Only the measured values moved: lean 5157 ~tok, design-arm 9666 ~tok.
- R2: done in 75b7240, per the human ruling R2=a′. §6 now permits `git fetch` for all roles (remote-tracking refs only; the D10 read-only substring asserted by release-staging is kept intact). The integrator-only grant gains `git switch <existing-branch>`, never with `--force` or `--discard-changes`. Existing FORBIDDEN entries are unchanged. The skill-integrator permissions table and Git operations paragraph are aligned: 5b-1 fetch is on the base list, 6-1 is `switch main`. AC6 is amended in the same commit, and the rulings line (Q1=A; R2=a′; E178A-NEW-1 post-v4) is added under Pre-review outcome. The E178A-NEW-1 body now records the post-v4 ruling.
- P1: done (same commit). The tool-internal bullet now reads "incl. start's rollback and finish's teardown".
- Q1: skipped, as instructed.

## Round 2 — APPROVED — by code-reviewer

Delta: `git diff c682e8c..87ad706` (75b7240 R2 §6+SOP+AC6, 48e0a05 R1 manifest, 4aff0a7 sr reply, 87ad706 state). Human ruling (coordinator session): R2 = a′, Q1 = A. Reviewer model: opus; sr ran on fable.

## Summary
- R1 closed. `qa_reports/expected-red_e178a-integrator-role.txt` has 16 entries in the `<file> | <exact test name>` format under `#` rationale groups (sr SOP 7a). I ran a fresh `node scripts/test-lock.mjs -- npm test` on the committed branch: 2795 tests, 2779 pass, 16 fail. The sorted failing-name set is **identical** to the manifest's name column (`diff` is empty, 16 = 16).
- R2 closed per ruling a′. `git fetch` is added to §6's always-permitted read-only sentence for ALL roles. `git switch <existing-branch>` (never `--force` / `--discard-changes`) is added to the integrator-only grant. AC6 is amended in the same commit (75b7240). Q1 = A stands: `commit --amend` is still FORBIDDEN.
- P1 applied: the tool-internal bullet no longer repeats the op names.
- Bounds: `node scripts/fanout.mjs check specs/fanout-wave7.2b.md e178a --base 3c72a83` gives 24 files and 0 out of bounds (exit 0). `npm run build` produces no dist drift.
- Verdict: APPROVED.

## AC Completeness
AC6 — implemented — `content/const-15-core-tail.md` §6. The read-only sentence now ends "…is always permitted, as is `git fetch` (updates only remote-tracking refs…)". The D10 substring "Read-only git (`diff`, `log`, `status`, `show`) is always permitted" is preserved byte-for-byte. The grant bullet lists all seven ops with their exclusions and "every other role stays on the base list". This matches the amended AC6 text in `specs/e178a-integrator-role.md:33`.
AC1–AC5 and AC7–AC16 — implemented — unchanged since Round 1 (the delta touches only const-15, skill-integrator :36/:169, spec, manifest, pending-tickets and state). The Round-1 evidence stands.

## Correctness
- R1 verification. I compared all 16 manifest entries with the fresh TAP `not ok` names; the match is exact. The file column is correct. The compose-equivalence names are templated in `test/compose-equivalence.test.mjs` and confirmed by the TAP output. context-budget sits at :226, :923, :1132 and :1962. skill-frontmatter sits at :96. No test file is in the lane diff, so the reds come only from the content change, as the rationale lines say.
- R2 verification. The FORBIDDEN list (`reset`, `rebase`, `clean`, force-push, `checkout --force`, `checkout -- <file>`, plus `commit --amend`) is textually unchanged in the diff. The only change to the base bullet is the appended fetch clause. The new `switch` grant carries both discard-flag exclusions, so nothing is loosened. `git switch` without `--force` / `--discard-changes` refuses to overwrite conflicting local changes, so the grant is non-destructive.
- [optional] O1 — the fetch clause states what fetch does rather than limiting how it is used. `git fetch <remote> <src>:<dst>` can update a local branch, and `--prune` deletes remote-tracking refs. A literal reader could take the parenthetical as the permission's scope, which is the intended reading. No SOP uses a refspec form. Leave it as is unless a later incident shows otherwise.

## Quality
- The SOP permission table (:36) and the Git operations paragraph (:169) now match §6. Fetch is on the base list, and `switch main` is at 6-1 with the exclusions. The step references agree with :137 (5b-1 fetch), :138 (5b-2 `switch -c`) and :159 (6-1 `switch main`).
- Q1 (Round 1, optional) was skipped per the brief. Still harmless.
- [optional, cosmetic, not blocking] The sr Round-2 commits (75b7240, 48e0a05, 4aff0a7, 87ad706) carry an Opus 5.5 co-author trailer, but that hop ran on fable (a harness notice). History rewrite is FORBIDDEN (§6, Q1 = A), so this stays as recorded. The `dispatch_mechanism_tier: fable` state field is the authoritative record.

## Architecture
No architecture spec. The delta keeps the Round-1 layering: §6 is the authority and the SOP points to it without restating it. The spec's Notes record the rulings (:112).

## Security
No findings. §6 is net-stricter or neutral. The one widening (fetch for all roles) touches only remote-tracking refs, and the integrator's `switch` excludes both discard flags. No secrets or `.env` paths.

## Performance
Budget: lean is 5157 ~tok and design-arm 9666 ~tok. That is +28 ~tok over the Round-1 measurement: the fetch clause and the `switch` grant cost more than P1 saved. qa re-baselines the floors under T-E178A-06/07 as the manifest states. There are no runtime changes.

## Verdict
APPROVED — R1 (the manifest exactly matches the fresh suite reds) and R2 (text matches ruling a′, no FORBIDDEN entry is loosened, SOP and AC6 are consistent) are both resolved, with no open required findings.
