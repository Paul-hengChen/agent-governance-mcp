# e297-main-protected-sop

Lane e297 of the post-v4 wave 1 fan-out (`specs/fanout-post-v4-w1.md`). Ticket E297 (P1), items (1)–(6) in full, plus the SOP-text half of E228. Scope is the lane row in the manifest; it is not widened or narrowed here.

## Problem Statement

The repository's default branch is now protected by a host ruleset (verified at cut time with the host CLI: pull request required, required status checks `test (20)` and `test (22)` with the branch-up-to-date policy, merge-commit only, no force-push, no deletion, no bypass actors; repository settings: auto-merge on, squash and rebase merges off, delete-branch-on-merge on). Three SOP texts still assume a direct fast-forward push of `main`: the integrator's Stage 6 (and every sentence that restates it), the release-engineer's steps 8a–8c and 13a–13b, and Constitution section 6's git grant, which names neither `gh pr create` nor `gh pr merge`. The coordinator SOP says nothing about where bookkeeping commits land. Until these are rewritten, no role can land anything on `main` without stepping outside its grant. Separately, the integrator SOP recommends `sonnet` although the human decided the role runs on the strongest tier, and the frontmatter parser's `MODEL_TIERS` has no `fable` entry, so `recommended_model: fable` would be silently dropped.

## User Stories

- As the integrator, I want Stage 6 to land the integration branch through a pull request with auto-merge, so that a wave reaches `main` without a direct push the host now rejects.
- As the release-engineer, I want the version bump, CHANGELOG, `dist/` and adapter stamps to ride a `release/vX.Y.Z` pull request and the tag to sit on the resulting `main` merge commit, so that the release self-check and close-out still pass under branch protection.
- As any role reading Constitution section 6, I want the grant to name the pull-request operations and `git pull --ff-only` on `main`, so that the integrator and release-engineer act inside their grant and every other role stays on the base list.
- As the coordinator, I want one sentence that says where bookkeeping commits land, so that ticket filing and done-marks never accumulate on local `main`.
- As the human opening an integrator session, I want the SOP frontmatter to recommend `fable` (with `opus` as the fallback), so that the hardest judgment in the flow (Stage 1 file ownership) runs on the strongest tier.

## Acceptance Criteria

- **AC1 (E297-1, Stage 6)** — Given `content/skill-integrator.md`, when Stage 6 is read, then its ordered steps are: (1) on `integ/<feature>`, per lane, one after another, `agc feature finish <lane> --shipped --base integ/<feature>` (this repo: `node bin/agc-init.mjs feature finish <lane> --shipped --base integ/<feature>`), newly allocated ids queued per 5c-1, the mailbox-watch and mailbox-removal sentences kept verbatim; (2) full `npm test` on the integration branch HEAD; (3) `git push -u origin integ/<feature>`, `gh pr create` (base `main`, head `integ/<feature>`, title carrying the feature id, body free of absolute paths and internal links), `gh pr merge --auto --merge` (never `--squash`, `--rebase`, `--admin`); (4) wait for the merge by polling `gh pr view <n> --json state,mergeCommit` until `state` is `MERGED`, or `git fetch` until `origin/main` contains the pull request head; a red check means stop and report, the fix is a commit on the integration branch by the owning lane or a new ticket, never by hand on `main`; a `BEHIND` merge state (`main` moved after the pull request opened, the branch-up-to-date rule) is the integrator's own remedy, not a STOP: `git merge --no-ff main` into `integ/<feature>` (inside the grant), then `node scripts/merge-invariants.mjs`, the full suite, and a push — a conflict in that merge is resolved hunk by hunk under 5b-4 and 5b-5 like any other; (5) `git switch main` then `git pull --ff-only` (a failure means stop); (6) `git branch -d integ/<feature>` (the remote branch is deleted by the repository setting) and `git worktree list` shows only primary; (7) final report naming the merge commit sha and the pull request number.
  proof: `grep -nE 'finish <lane> --shipped --base integ/<feature>|git push -u origin integ/<feature>|gh pr merge --auto --merge|gh pr view <n> --json state,mergeCommit|git pull --ff-only|git branch -d integ/<feature>' content/skill-integrator.md` prints at least one hit for each of the six patterns, all inside the `## Stage 6` section.
- **AC2 (E297-1, every other fast-forward sentence)** — Given the same file, when the Work overview stage 6 row, the Permissions table, the Lifecycle stage 6 row, 5b-1, 5b-5, the 5c heading, the Git operations paragraph and the "Your own commits" paragraph are read, then none of them says `main` is fast-forwarded or pushed by the integrator; 5b-5 says the pull request is never opened before the merge-resolution verdict is APPROVED; the 5c heading says bookkeeping is committed on the integration branch before the pull request opens; the Git operations paragraph names when `switch main`, `pull --ff-only`, `gh pr create`, `gh pr merge --auto --merge` and `branch -d` are used; the "Your own commits" paragraph says the integrator's own bookkeeping rides the open wave's integration branch or a `docs/<date>-<slug>` branch pull request, never local `main`; the Work overview label `6. Bookkeeping, main, teardown` and the Stage 3 / Stage 6 mailbox sentences pinned by `test/e246-mailbox-teardown.test.mjs` are unchanged.
  proof: `grep -nE 'fast-forward \`main\`|\`main\` fast-forwarded|merge --ff-only|\`git push\` \(fast-forward only\)' content/skill-integrator.md` prints nothing, and `grep -c '6. Bookkeeping, main, teardown' content/skill-integrator.md` prints `1`.
- **AC3 (E297-2, release branch and pull request)** — Given `content/skill-release-engineer.md`, when the Hard rules, step 3a and steps 8a–8c are read, then: the "No force pushes" rule also says `main` is never pushed directly and local `main` moves only by `git pull --ff-only`; step 3a re-baselines by `git fetch origin` plus `git pull --ff-only` on `main` and is followed by a new step 3b that opens `release/vX.Y.Z` with `git switch -c`; step 8a commits on `release/vX.Y.Z`, pushes it with `git push -u origin release/vX.Y.Z` and opens the pull request with `gh pr create` (base `main`), and still contains the "Pre-commit verify" anchor and precedes 8b; step 8c (heading `8c. **Tag + push**` kept) runs `gh pr merge <n> --auto --merge` only after 8b printed `CI-CHECK PASSED`, waits for `MERGED` via `gh pr view <n> --json state,mergeCommit`, runs `git switch main` then `git pull --ff-only`, asserts `git rev-parse HEAD` equals the reported merge commit, creates `git tag -a vX.Y.Z` on that HEAD and then pushes the tag, which remains the one irreversible act; the early-tag allowance (a local tag any time after 8a, before 8b) is retired because the tag target does not exist before the merge.
  proof: `grep -nE 'git switch -c release/vX\.Y\.Z|git push -u origin release/vX\.Y\.Z|gh pr merge <n> --auto --merge|gh pr view <n> --json state,mergeCommit' content/skill-release-engineer.md` prints at least one hit per pattern, and `grep -n 'any time after step 8a completes' content/skill-release-engineer.md` prints nothing.
- **AC4 (ruling 8b)** — Given step 8b, when it is read, then it still runs `node scripts/verify-release.mjs --ci-check --strict` against the pushed `release/vX.Y.Z` head (the pull request head; the script derives the branch from the upstream the push set and matches the pull-request run by head sha), still STOPs on red or unknown, and no longer tells the engineer to delete a local tag (none exists at that point); its heading `8b. **CI gate**` and the sentences pinned by `test/e164-e167-content.test.mjs` on budget sequencing (`make the FIRST attempt with the normal budget`, `Only after that first host-level silent kill`, the `fix_try` cap sentence) are kept.
  proof: `grep -c 'delete any local tag created ahead of this gate' content/skill-release-engineer.md` prints `0`, and `grep -c 'make the FIRST attempt with the normal budget' content/skill-release-engineer.md` prints at least `1`.
- **AC5 (ruling 13a / 13b / `--close-out` / step 12)** — Given steps 12, 13a and 13b, when they are read, then: step 12 (closing write) and step 13 (read-back) keep their content and sit after the pull request merge, tag, `gh release` and 9a, as today; step 13a stages the same bookkeeping paths with the same non-empty-stage script, then commits them on a new branch `release/vX.Y.Z-bookkeeping` opened with `git switch -c` from `main`, pushes it with `git push -u`, opens a pull request, requests `gh pr merge --auto --merge`, waits for `MERGED`, and returns with `git switch main` then `git pull --ff-only`; step 13b runs `node scripts/verify-release.mjs --close-out` on `main` after that pull and requires `CLOSE-OUT PASSED`; its remedy text says that `HEAD is <n> commit(s) ahead of upstream` on `main` means the bookkeeping pull request has not merged or the pull was skipped — wait or pull and re-run, never push `main` — and that `no upstream tracking branch configured` means the session is not on `main`, which is a STOP; the Escalation Routes table gains one row for a pull request that cannot merge (red required check, `BEHIND`, `CONFLICTING`) routing to `Blocked` / human, and the D10 row stays byte-identical.
  proof: `grep -nE 'release/vX\.Y\.Z-bookkeeping|CLOSE-OUT PASSED' content/skill-release-engineer.md` prints at least one hit per pattern, and `node --test test/release-staging.test.mjs` passes with the D10 assertions unmodified.
- **AC6 (Check 1 / Check 6 / `--close-out` not broken)** — Given `scripts/verify-release.mjs`, when the release flow in AC3–AC5 is executed, then Check 1 (`tag-at-HEAD`) passes on the exact path (tag and HEAD are both the `main` merge commit at 9a) and tolerates the later bookkeeping merge commit (its `diff-tree -m` per-parent listing shows only allowlisted paths), Check 2 passes (HEAD equals `origin/main` after the pull), Check 6 resolves the sha from the tag and polls the `main` push-triggered run for the merge commit, `--ci-check --strict` at 8b matches the pull-request run on `release/vX.Y.Z` by head sha, and `--close-out` at 13b passes on `main` with zero commits ahead; therefore the script is unchanged by this ticket. If sr-engineer finds a concrete break while writing AC3–AC5, it stops and reports instead of editing the script silently (conditional ownership, manifest).
  proof: `git diff --quiet main...HEAD -- scripts/verify-release.mjs` exits 0.
- **AC7 (E297-3, Constitution section 6)** — Given `content/const-15-core-tail.md`, when the *Sanctioned git operations* bullet is read, then the pinned first sentence (`the only sanctioned git mutations are ...`) and the FORBIDDEN list are byte-identical; the bullet additionally says `git pull --ff-only` on `main` is on the base list as a fetch plus a fast-forward of the tracking branch (read-plus-ff, never a merge commit) and that a protected default branch moves only by pull request merge; the Integrator-only grant sub-bullet keeps every existing operation and additionally grants `gh pr create` and `gh pr merge --auto --merge` (never `--squash` / `--rebase` / `--admin`), and states two further namespaces (option A of the Rulings, pending the human's ruling): `release-engineer` limited to `release/*` and the coordinator limited to `docs/*`, each sharing `git switch -c`, `git switch main`, `git branch -d` (its own merged branches only), `gh pr create` and `gh pr merge --auto --merge` when the owning SOP says; no rationale moves to `content/constitution-rationale.md` (the additions are rules, not rationale), so that file is untouched. Total growth of the file stays within 800 characters.
  proof: `grep -nE 'gh pr create|gh pr merge --auto --merge|git pull --ff-only' content/const-15-core-tail.md` prints hits on the section 6 bullet, `grep -c 'the only sanctioned git mutations are `git add`, `git commit`, `git tag`, fast-forward `git push`, and `git stash` / `git stash pop`' content/const-15-core-tail.md` prints `1`, and `git diff --quiet main...HEAD -- content/constitution-rationale.md` exits 0.
- **AC8 (E297-4, coordinator bookkeeping)** — Given `content/coord-03-core-fallback.md`, when the `## Backlog Intake Loop` section is read, then it carries one short paragraph (placed after the "Lane findings are numbered at finish time" paragraph, before "Bounds") stating that coordinator bookkeeping (ticket filing, queue edits, done-marks) is committed on the open wave's `integ/<feature>` branch or, when no wave is open, on a `docs/<date>-<slug>` branch landed by pull request the same way, never on local `main`; that on an open wave the coordinator commits on the integration branch (HEAD already there) and with no wave open it opens the `docs/<date>-<slug>` branch and the pull request itself under its section 6 `docs/*` namespace (option A; under option B the sentence says the human opens the branch and the coordinator only commits); and the section's existing headings and the sentences pinned by `test/e5-intake-tiering.test.mjs` are unchanged. Growth stays within 700 characters.
  proof: `grep -nE 'docs/<date>-<slug>' content/coord-03-core-fallback.md` prints one hit inside `## Backlog Intake Loop`, and `node --test test/e5-intake-tiering.test.mjs` passes unmodified.
- **AC9 (E297-6, tier)** — Given `tools/skill-frontmatter.ts` and `content/skill-integrator.md`, when they are read, then `MODEL_TIERS` is `["opus", "sonnet", "haiku", "fable"]`, the compiled `dist/tools/skill-frontmatter.js` (and its `.d.ts` / `.map` files) carry the same array, the integrator SOP frontmatter is exactly `recommended_model: fable`, and the Invocation paragraph adds one sentence that the field is advice to the human opening the session (not a dispatch pin) with `opus` as the fallback when `fable` is unavailable.
  proof: `node --input-type=module -e "import {MODEL_TIERS, parseSkillFile} from './dist/tools/skill-frontmatter.js'; import fs from 'node:fs'; console.log(JSON.stringify(MODEL_TIERS), parseSkillFile(fs.readFileSync('content/skill-integrator.md','utf8')).frontmatter.recommended_model)"` prints `["opus","sonnet","haiku","fable"] fable`.
- **AC10 (E228 SOP-text half)** — Given Stage 6 step (4) of the integrator SOP, when it is read, then it states that waiting for the merge is the CI check for that wave (a red sha cannot reach `main` under the ruleset), which is the only SOP-text obligation E228 still carries; E228's done-mark is the integrator's at 5c, citing this spec.
  proof: `grep -nE 'cannot reach `main`' content/skill-integrator.md` prints one hit inside `## Stage 6`.
- **AC11 (tests, goldens, ceilings; qa-owned)** — Given the content edits above, when qa regenerates `test/fixtures/compose-golden/**` and re-measures the four ceilings in `test/context-budget.test.mjs` (5567 / 10076 / 20453 / 7978), then every changed golden hunk is the section 6 or coord-03 text and nothing else; each ceiling is set to the exact re-measured value (zero headroom), the numbers approved by the human with this cut (expected direction: all four rise; section 6 lands in all four, coord-03 only in the coordinator bundle); the pinned assertions in `test/e178a-integrator-role.test.mjs` (frontmatter `sonnet`, the grant clause, the 5b-5 sentence), `test/skill-frontmatter.test.mjs:88` (the tiers array) and `test/e164-e167-content.test.mjs` (8c tag-timing clauses) are re-pinned to the new text; a new `test/e297-main-protected-sop.test.mjs` pins AC1–AC5 and AC7–AC10 by their proof patterns; and the full suite is green on the final HEAD.
  proof: `node scripts/test-lock.mjs -- npm test` passes at the final HEAD with a clean tree.

## Rulings (the items the ticket omits; the integrator asks at pre-review)

### Where `main` moves
`main` moves only by pull request merge (host-enforced). Local `main` moves only by `git pull --ff-only` after a merge. No role pushes `main`. The pinned base-list phrase "fast-forward `git push`" stays true for non-protected branches (`integ/*`, `release/*`, `docs/*`, lane branches) and is rejected by the host on `main` regardless of the SOP text.

### Release steps 8a / 8b / 8c
- 8a: the release commit lands on `release/vX.Y.Z` (opened at new step 3b from a freshly pulled `main`), pushed with `-u`, and the pull request is opened immediately. Still reversible: nothing immutable exists.
- 8b: unchanged in mechanism. `--ci-check --strict` runs against the release-branch head, which is the pull request head; `scripts/verify-release.mjs` derives the branch from the upstream (`release/vX.Y.Z`) and the CI workflow already runs on `pull_request` events, whose runs carry that head branch and head sha. The ruleset's required checks are the same runs; 8b stays as the SOP's own strict verdict (and as the gate for adopters without a ruleset). The "delete a local tag" clause is dropped: no tag can exist before the merge.
- 8c: `gh pr merge <n> --auto --merge` is requested only after `CI-CHECK PASSED`, so the merge is immediate (checks already green) and `--auto` only covers a check still finishing. Wait for `MERGED`, `git switch main`, `git pull --ff-only`, assert HEAD equals `mergeCommit.oid`, tag, push the tag (irreversible). A `BEHIND` pull request (main moved after 3a) is the existing D10 collision shape for the release-engineer, which has no merge authorization: STOP, Blocked, coordinator recovery (re-baseline at 3a on a new branch). `gh pr update-branch` is not granted this wave (filed as a lane finding, release-engineer side only).

### Stale pull request, integrator side (pre-review amendment 1)
When `integ/<feature>`'s pull request is stuck `BEHIND` because `main` moved after it opened, the integrator does not STOP: `git merge --no-ff main` into `integ/<feature>` is already inside the grant, followed by `node scripts/merge-invariants.mjs`, the full suite and a push of the integration branch; the pull request picks up the new head and auto-merge proceeds once the checks are green. A conflict in that merge follows 5b-4 (hunk by hunk) and, if substantive, 5b-5 (code-reviewer on the merge commit before the pull request may merge). Only the release-engineer keeps the STOP, because it holds no merge authorization.

### Release step 12 relative to the merge
Unchanged position: after the merge, the tag, `gh release` and 9a. Moving it before the merge is not possible — its `tag: <sha>` note names the `main` merge commit, which does not exist until the merge, and 9a (self-check) must precede it (E9). Consequence: the closing write's handoff snapshot cannot ride the release pull request, so 13a needs a second, tiny pull request.

### Release steps 13a / 13b / `--close-out`
- 13a: same paths, same non-empty-stage script, then `git switch -c release/vX.Y.Z-bookkeeping` from `main` (the uncommitted handoff and sidecars carry over), commit, `git push -u origin release/vX.Y.Z-bookkeeping`, `gh pr create`, `gh pr merge --auto --merge`, wait for `MERGED`, `git switch main`, `git pull --ff-only`. The branch name keeps the `release/` namespace so one `git log -i --grep vX.Y.Z` finds both commits.
- 13b: `--close-out` runs on `main` after that pull; `CLOSE-OUT PASSED` means zero commits ahead of `origin/main`. Remedies rewritten: ahead-of-upstream on `main` means the bookkeeping pull request has not merged yet or the pull was skipped (wait / pull / re-run, never push); no-upstream means the session is not on `main` (STOP). The script itself is not changed: its assertion ("HEAD is not ahead of upstream") is exactly the post-merge state.
- Alternative considered and rejected: leaving the bookkeeping commit local until the next wave's integration branch carries it — it leaves primary `main` ahead of upstream for days, fails 13b by construction, and splits a release's record across two waves.

### Grant additions beyond the ticket's literal list — **needs human ruling** (pre-review amendment 2)
Neither item (2) nor item (4) is executable with only `gh pr create` / `gh pr merge` shared: opening `release/vX.Y.Z` or `docs/<date>-<slug>` needs `git switch -c`, returning needs `git switch main`, pruning the merged local branch needs `git branch -d`, and landing it needs the two `gh pr` operations. Two options:

- **Option A (integrator recommends; pull requests #1–#4 were done this way)**: section 6 grants two namespaces beside the integrator's — `release-engineer` limited to `release/*` and the coordinator (`teamwork`) limited to `docs/*` — each sharing `git switch -c`, `git switch main`, `git branch -d` (merged branches of its own namespace only), `gh pr create` and `gh pr merge --auto --merge` (never `--squash` / `--rebase` / `--admin`), when the owning SOP says. The coord-03 paragraph then references that grant: with no wave open the coordinator opens `docs/<date>-<slug>` itself and lands it by pull request.
- **Option B**: the human opens the `docs/<date>-<slug>` branch and the pull request; the coordinator only commits (base-list `git add` / `git commit`) when HEAD is already an integration or docs branch and otherwise hands the files over. The release-engineer namespace is still required under B (item (2) has no human-opens alternative inside one release session).

The spec, T-E297-04 and AC7/AC8 are written for option A; if the human picks B, sr-engineer drops the `docs/*` namespace from section 6 and the coord-03 paragraph says "hand over" instead of "open" — a wording change inside the same task, no re-cut.

### `git merge --ff-only`
Stays in the grant (the change is additive and the clause is pinned verbatim); after this ticket no SOP step uses it. Filed as a lane finding for a later constitution pass.

### Check 1 / Check 6 assessment
Neither breaks (AC6). Check 1: at 9a the tag and HEAD are the same `main` merge commit (exact path); a later re-run after 13a sees one bookkeeping merge commit in range and `diff-tree -m` lists only allowlisted paths against each parent (tolerated path, prints the NOTE line). Check 6: the released sha resolves from the tag; the checkout is `main` with upstream `origin/main`; the merge triggers a `push` run on `main` whose head sha is the merge commit; the bounded poll finds it. `--ci-check --strict` at 8b: branch derived as `release/vX.Y.Z`; `gh run list --branch release/vX.Y.Z --workflow CI` lists the pull-request-event runs for that head branch; head sha matches. `--close-out`: zero ahead on `main` after the pull.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| integ.finish | `agc feature finish <lane> --shipped --base integ/<feature>` | docs/backlog.md row E297 item (1) |
| integ.push | `git push -u origin integ/<feature>` | docs/backlog.md row E297 item (1) |
| pr.create | `gh pr create` (base `main`) | docs/backlog.md row E297 items (1)–(3) |
| pr.merge | `gh pr merge --auto --merge` (never `--squash` / `--rebase` / `--admin`) | docs/backlog.md row E297 items (1)–(3) |
| pr.wait | `gh pr view <n> --json state,mergeCommit` until `state` is `MERGED`, or `git fetch` until `origin/main` contains the pull request head | docs/backlog.md row E297 item (1) |
| main.pull | `git switch main` then `git pull --ff-only` | docs/backlog.md row E297 item (1); written as two commands (compound git commands are refused by the lane guard) |
| integ.prune | `git branch -d integ/<feature>` | docs/backlog.md row E297 item (1) |
| release.branch | `release/vX.Y.Z` | docs/backlog.md row E297 item (2) |
| release.bookkeeping-branch | `release/vX.Y.Z-bookkeeping` | authored-here — the 13a ruling above; keeps the `release/` namespace for `git log -i --grep` |
| const6.pull | `git pull --ff-only` on `main` enters the base list as read-plus-ff | docs/backlog.md row E297 item (3) |
| const6.grant | grant gains `gh pr create` and `gh pr merge --auto --merge`; two namespaces beside the integrator — `release-engineer` limited to `release/*`, coordinator limited to `docs/*` — each sharing `git switch -c` / `git switch main` / `git branch -d` and the two `gh pr` operations | docs/backlog.md row E297 item (3); the namespaces and the three git shares are authored-here per the Rulings (option A, needs human ruling) |
| coord.bookkeeping | bookkeeping committed on the open wave's `integ/<feature>` branch or, with no wave open, on a `docs/<date>-<slug>` branch the coordinator opens and lands by pull request under its `docs/*` namespace, never on local `main` | docs/backlog.md row E297 item (4); the `docs/*` namespace is authored-here (option A) |
| integ.stale-pr | a `BEHIND` pull request is remedied by `git merge --no-ff main` into `integ/<feature>`, `node scripts/merge-invariants.mjs`, the full suite and a push — not a STOP | authored-here — integrator pre-review amendment 1 |
| integ.frontmatter | `recommended_model: fable` | docs/backlog.md row E297 item (6) |
| e228.sentence | a red sha cannot reach `main`; waiting for the merge is the wave's CI check | docs/backlog.md row E228 direction, rescoped by E297 item (5) |

Final sentence wording inside each SOP is sr-engineer's, within the AC constraints and the growth budgets.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- E298's integrator 5a `--ci-check` / 5b read-CI / verifier-brief text; E299's 5c sentence; E300's coord-02 sentence (all wave 2).
- `templates/**`, `docs/**` (including `docs/lane-protocol.md`, unchanged: lanes never push), `coord-02-host-dispatch.md`, `tools/registry.ts`, `tools/handoff-*.ts`, `gates/**`, `bin/**`, `scripts/check-*.mjs`, other `scripts/**`, `.github/**`, and every item on the manifest's shared forbidden list.
- `scripts/verify-release.mjs` edits (conditional ownership; AC6 finds no break).
- A non-pull-request fallback path for workspaces whose default branch accepts direct pushes: the SOPs carry one path. Flagged for the human at cut approval.
- `gh pr update-branch` or any other stale-pull-request recovery for the release-engineer (lane finding); the integrator's remedy is in scope (Rulings, amendment 1).
- The `specs/model-routing*.md` and `specs/d8-lite-recommended-model.md` three-tier tables (lane finding; `specs/` outside `specs/e297-*` is not owned).
- Release bookkeeping for this ticket (version bump, CHANGELOG, backlog done-marks for E297 and E228): the integrator's 5c and the release-engineer, post-PASS.

## Dependencies / Prerequisites

- Workspace facts verified at cut time with the host CLI (ruleset and repository settings as in the Problem Statement). The ruleset is a workspace fact, not an external artifact: nothing to fetch or index, so the `external_refs` ledger is empty (Resource Audit Gate: the ticket row's only references are in-repo backlog ids E228 / E178 / E298 and tracked paths).
- `agc feature finish --base <branch>` exists at the dispatch base (`bin/agc-init.mjs` usage text); `.github/workflows/ci.yml` runs on `pull_request` targeting `main` at the dispatch base, so pull-request runs exist for 8b and for the ruleset's required checks.
- No design file; visual arm inactive; Visual Structural Assertions omitted (mode = no-design).
- Question Batch Gate: zero clarifications — the ticket's open points are PM rulings by the manifest's own instruction and are decided above.
- Dispatch pin in effect: `sr-engineer=fable`.

### Ceiling measurement (human decides with the cut approval)

Measured inputs at the lane base: `content/const-15-core-tail.md` 7376 characters, `content/coord-03-core-fallback.md` 20788 characters. Section 6 composes into every constitution golden (11 of 12) and all four ceilings; coord-03 composes into `skill-coordinator-monolith.txt` and the coordinator bundle ceiling only.

| ceiling (test/context-budget.test.mjs) | current | expected direction | estimate if sr-engineer stays within budget |
|---|---|---|---|
| lean always-on bundle | 5567 | up (section 6 only) | about +200 ~tok |
| stripped constitution, design-armed | 10076 | up (section 6 only) | about +200 ~tok |
| teamwork coordinator bundle, design-armed | 20453 | up (section 6 + coord-03) | about +375 ~tok |
| non-design constitution | 7978 | up (section 6 only) | about +200 ~tok |

Budget for sr-engineer: at most 800 characters added to `const-15-core-tail.md` (two namespaces, amendment 2), at most 700 characters added to `coord-03-core-fallback.md`. qa measures the exact values after the final wording and sets each ceiling to the measured size (zero headroom, the repo's cap rule); the integrator's pre-review position: ceilings are qa's exact measured values.

## Task breakdown

| task | role | files | AC |
|---|---|---|---|
| T-E297-01 | sr-engineer | `tools/skill-frontmatter.ts`, `dist/tools/skill-frontmatter.js`, `.d.ts`, `.js.map`, `.d.ts.map` (via `npm run build`) | AC9 (tiers) |
| T-E297-02 | sr-engineer | `content/skill-integrator.md` | AC1, AC2, AC9 (frontmatter + Invocation sentence), AC10 |
| T-E297-03 | sr-engineer | `content/skill-release-engineer.md` | AC3, AC4, AC5, AC6 (read-only confirmation) |
| T-E297-04 | sr-engineer | `content/const-15-core-tail.md`, `content/coord-03-core-fallback.md` | AC7, AC8 |
| T-E297-05 | code-reviewer | review of T-E297-01..04 (`review_reports/*E297*`) | AC1–AC10 |
| T-E297-06 | qa-engineer | `test/e178a-integrator-role.test.mjs`, `test/skill-frontmatter.test.mjs`, `test/e164-e167-content.test.mjs`, `test/release-staging.test.mjs` / `test/e166-template-defers-staging.test.mjs` / `test/render-structure.test.mjs` (only if hit), `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**`, `test/e297-main-protected-sop.test.mjs` (new) | AC11, verdict on AC1–AC10 |

Chain: sr-engineer (T-01..T-04, one session) → code-reviewer (T-05) → qa-engineer (T-06); no architect hop (one module touched in code, the rest is SOP text).

## Cut table

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E297-01 | `MODEL_TIERS` gains `fable`; rebuild and commit the compiled module | none | 5 | `tools/skill-frontmatter.ts`, `dist/tools/skill-frontmatter.*` | — |
| T-E297-02 | integrator SOP: frontmatter `fable` + Invocation sentence; Stage 6 rewritten to finish-on-integ + push + PR + auto-merge + wait (BEHIND → `merge --no-ff main` into integ, merge-invariants, full suite, push; red → stop) + pull + prune; Work overview / Permissions / Lifecycle / 5b-1 / 5b-5 / 5c heading / Git operations / own-commits sentences; E228 sentence | T-E297-01 | 1 | `content/skill-integrator.md` | — |
| T-E297-03 | release SOP: no-push-main hard rule; 3a pull + new 3b branch; 8a branch + PR; 8b without the tag clause; 8c merge + wait + pull + tag on merge commit; 13a bookkeeping branch + PR; 13b remedies; one Escalation Routes row; Output rule wording | none | 1 | `content/skill-release-engineer.md` | — |
| T-E297-04 | Constitution section 6: `git pull --ff-only` on `main` in the base list; grant gains the two `gh pr` operations; two namespaces (option A, needs human ruling) — release-engineer `release/*`, coordinator `docs/*` — each sharing `switch -c` / `switch main` / `branch -d` + the two `gh pr` operations (≤800 chars); coord-03 bookkeeping paragraph referencing the `docs/*` namespace (≤700 chars) | none | 2 | `content/const-15-core-tail.md`, `content/coord-03-core-fallback.md` | — |
| T-E297-05 | code review of T-01..T-04 | T-E297-01..04 | 1 | `review_reports/*E297*` | — |
| T-E297-06 | re-pin e178a / skill-frontmatter / e164-e167 (+ others only if hit); regenerate goldens; measure and set the four ceilings; new e297 test; full suite; verdict | T-E297-05 | about 18 | `test/e178a-integrator-role.test.mjs`, `test/skill-frontmatter.test.mjs`, `test/e164-e167-content.test.mjs`, `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**`, `test/e297-main-protected-sop.test.mjs`, `qa_reports/*E297*` | — |

## Gate Summary

| gate | result |
|---|---|
| Visual State-Count Split | not triggered (no design) |
| Geometric-Density Split | not triggered (no design) |
| Parallel-Lane Cut | serial inside this lane; the wave-level fan-out is the integrator's manifest |
| Scope Decision | `scope_decision: single-feature` — one SOP rewrite with one enabling code change; splitting would leave the grant and the SOPs inconsistent across pull requests |
| Resource Audit | zero external references (workspace fact verified by command; in-repo ids only); `external_refs` omitted |
| Source-Credibility | not applicable (no design file) |
| Question Batch | no-op (zero clarifications) |
| Ambiguity | cleared by the rulings above |
| Cut-Approval | presented inline; Task-dispatched PM does not set `cut_approved` |
