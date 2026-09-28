# e142-release-tooling-wave25

Wave 2.5 of `docs/v4.0.0-execution-plan.md` (§ "Wave 2.5 — 發版工具鏈補課"). Five backlog
tickets — E142 (lead, has absorbed the AC4 range defect), E143, E144, E147, E149 —
cut as ONE feature, ONE review round, ONE QA round, because their combined edit
surface is exactly three files and the plan's 完成定義 forbids opening any one of
them more than once.

## Problem Statement

The release tooling (`scripts/verify-release.mjs`'s automated checks, plus the
manual checks `content/skill-release-engineer.md` walks release-engineer
through by hand) was written and first exercised against single-feature,
single-commit releases. v3.111.0–v3.113.0 are the first three releases to
actually run this tooling in anger, and each shipped a *wave* — many features,
merged across lane worktrees, landing across many commits before the release
commit itself. Every defect this ticket batch fixes is the same root cause
wearing five different hats: **a check that was written against a single
commit (`HEAD~1`, `--cached`, `rev-parse HEAD`) is asked to answer a question
about a range** (`<prev-tag>..HEAD`), or a piece of release-SOP prose is
describing that single-commit shape as if it still holds. E143 and E144 are
along for the ride only because their one-line fixes sit inside a file E142
already has to reopen.

## Ground-truth correction to the dispatch card (read before the cut table)

The Wave 2.5 dispatch card and the backlog's `est. files` column both name
**E142 and E144 as touching `scripts/verify-release.mjs`**. Grounding against
the actual files in this repo shows that is wrong for both:

- **E142's three sub-fixes are 100% prose in `content/skill-release-engineer.md`.**
  - (a) The E95 "CHANGELOG citation check" is a *manual* SOP step 8 bullet
    (`content/skill-release-engineer.md:207`) instructing release-engineer to
    run `git diff --cached --name-only` by hand — it is not implemented in
    `scripts/verify-release.mjs` (Check 4 there only confirms a CHANGELOG
    entry exists for the version; it never cross-checks citations).
  - (b) The "Post-commit sanity check (AC4)" is likewise pure SOP prose
    (`content/skill-release-engineer.md:212-215`), instructing release-engineer
    to run `git diff HEAD~1 --name-only` by hand.
  - (c) SOP step 7a's orphan-leaving line (`content/skill-release-engineer.md:159`)
    is also prose, one hardcoded `mv` of `qa_reports/expected-red_<active_feature>.txt`.
  - None of (a)/(b)/(c) has a line in `scripts/verify-release.mjs`.
- **E144's wrong remedy prose is also 100% in `content/skill-release-engineer.md`**
  (step 13b, line 244: *"On FAIL (...), push again (step 13a) and re-run."*).
  `scripts/verify-release.mjs`'s close-out mode itself (lines ~102-135) prints
  only the bare `FAIL: no upstream tracking branch configured` / `FAIL: HEAD is
  <n> commit(s) ahead...` lines — it carries no remedy text of its own to fix.

Net effect on the cut: **`scripts/verify-release.mjs` gets exactly one
ticket's worth of change (E147)**; `content/skill-release-engineer.md` absorbs
E142 + E143 + E144 + E149's N3 rider. This does not violate the plan's
one-pass-per-file rule — it satisfies it more precisely than the dispatch
card assumed. Flagged here for the human/coordinator to ratify or overturn
before the cut is approved.

## User Stories

- As a release-engineer running the self-check tooling on a multi-feature wave
  release, I want Check 6's CI ground-truth to be keyed to the actual release
  tag's commit, so that a post-13a re-run doesn't silently report a green
  verdict about a different (bookkeeping) commit.
- As a release-engineer following the SOP's CHANGELOG-citation and
  post-commit-sanity checks on a wave release, I want both checks measured
  against the release's true range, so that neither one falsely flags/SKIPs
  real changes or false-STOPs on a lane-worktree merge shape.
- As a release-engineer running step 7a on a release that ships several
  features, I want every shipped feature's `expected-red_*.txt` swept into
  its own archive dir, so that no sibling feature's file is silently orphaned
  at `qa_reports/` root.
- As a release-engineer hitting a first-push `--close-out` FAIL, I want the
  SOP's remedy prose to name `git push -u`, so I don't lose twenty minutes
  re-running a plain `git push` that can't fix the actual cause.
- As the next reader of `content/skill-release-engineer.md`, I want exactly
  one place asserting which step owns committing `tasks.md`, so step 8 and
  step 13a don't each carry a separate, partially-false claim to it.
- As the next reader of `content/coord-03-core-fallback.md`'s E109 anchoring
  sentence, I want it to distinguish *what a mechanism is keyed to*
  (workspace_path) from *where a path resolves* (E111's worktree symlinks),
  so a future ticket can't cite the anchoring rule to argue E111's symlink
  obligation is a violation of it.

## Acceptance Criteria

**E147 — `scripts/verify-release.mjs` Check 6 sha resolution**

- **AC1** — Given a normal (non-`--close-out`) run of `scripts/verify-release.mjs vX.Y.Z` where tag `vX.Y.Z` already exists, when Check 6 computes `releaseSha`, then it resolves from the tag (`git rev-parse --verify --quiet refs/tags/vX.Y.Z` + `git rev-list -n 1 vX.Y.Z` — the same two-call pattern Check 1 already uses at `scripts/verify-release.mjs:179-181`), not from `git rev-parse HEAD` (current line 374).
  proof: `test/verify-release.test.mjs` — new fixture: tag at commit A, a bookkeeping-only commit B on top of it (HEAD), a completed CI run recorded against A's sha only. Check 6 must report `OK`/match against A, never poll or match against B.
- **AC2** — Given no tag `vX.Y.Z` exists yet at the time Check 6 runs, when `releaseSha` is resolved, then it falls back to `git rev-parse HEAD` (today's behavior), unchanged.
  proof: existing VR-suite fixtures where the tag doesn't yet exist stay green unmodified.

**E142(a) — CHANGELOG citation check (E95) range**

- **AC3** — Given SOP step 8's "CHANGELOG citation check" bullet (`content/skill-release-engineer.md:207`), when it names the diff release-engineer must derive citations from, then it names the union of `git diff <prev-tag>..HEAD --name-only` (already-committed work in this release's range, `<prev-tag>` resolved the same way step 7a's `PREV_TAG=$(git describe --tags --abbrev=0)` already does) **and** `git diff --cached --name-only` (this commit's staged changes) — never `--cached` alone.
  proof: none (SOP prose consumed by a human role, not an executable check) — qa-engineer sanity-checks the corrected wording against the historical v3.111.0 case (35/41 under `--cached` vs. 39/41 under the honest `v3.110.0..HEAD` range, per the E142 backlog row).

**E142(b) — Post-commit sanity check (AC4) range + multi-feature classification**

- **AC4** — Given SOP step 8's "Post-commit sanity check (AC4)" REQUIRE branch (`content/skill-release-engineer.md:212-215`), when it verifies a spec file is part of the release commit, then it checks `git diff <prev-tag>..HEAD --name-only` (same `PREV_TAG` derivation as AC3) instead of `git diff HEAD~1 --name-only`, so a lane-worktree `--no-ff` merge (where `HEAD~1` is the merge commit, measured on v3.112.0 and on v3.113.0's own release) no longer produces a false STOP.
  proof: `grep -c "HEAD~1" content/skill-release-engineer.md` between lines 212-215 is `0` after the fix (was `1` before).
- **AC5** — Given a release whose session `pending_notes` records the multi-feature convention already used in practice (`"Multi-feature release: <feature-1>, <feature-2>, ..."` — verbatim the shape v3.113.0's own closing write used), when the REQUIRE/SKIP/UNCLASSIFIABLE branches are evaluated, then a fourth, explicitly-named **MULTI-FEATURE branch** checks EACH named feature's `specs/<feature>.md` against the release range (AC4's range), rather than checking only `specs/<active_feature>.md` (today's REQUIRE branch, which structurally cannot see any feature but the wave's last one) or silently falling through to the SKIP branch's backlog-row-as-spec justification (v3.111.0's actual, ad hoc, historical behavior).
  proof: none (prose describing behavior on a hypothetical future wave — no single command asserts it); qa-engineer sanity-checks the new branch's wording against the concrete v3.111.0 and v3.113.0 multi-feature `pending_notes` shapes already on file in this repo's git history.

**E142(c) — SOP 7a expected-red orphan sweep**

- **AC6** — Given step 7a's `expected-red_<active_feature>.txt` move line (`content/skill-release-engineer.md:159`), when a release ships multiple features, then the move is generalized to the same membership-baseline technique step 7a already uses for its `covers:` sweep (diff `qa_reports/expected-red_*.txt` against `$PREV_TAG`'s tree; anything new since `$PREV_TAG` is moved into its OWN feature's archive dir, derived from the filename's `<feature>` token) — not hardcoded to `<active_feature>` alone.
  proof: `grep -c "expected-red_<active_feature>" content/skill-release-engineer.md` is `0` after the fix (was `1` before, the hardcoded single-feature line).

**E143 — `tasks.md` ownership decision**

- **AC7 (Decision, see Decisions section below)** — Given step 8 already stages `tasks.md` explicitly (`content/skill-release-engineer.md:194`/`:199`) and git ground truth on the last four releases shows the 13a bookkeeping commit has carried `tasks.md` on zero of four, when the decision is recorded, then it states **step 8 owns `tasks.md`** in exactly one place, and:
  - `content/skill-release-engineer.md:232` (step 13a) no longer lists `tasks.md` among the paths it commits, and no longer calls it "the E71c exclusion from step 8's release commit" (false premise) — 13a's script (line 236, `git add -- .current/handoff.md tasks.md $JSONL`) drops `tasks.md` from the `git add` invocation too.
  - `content/skill-release-engineer.md:41` (Artifact ownership list) no longer bundles `tasks.md` with `.current/handoff.md`/`.current/*.jsonl` under "SOP step 13a" — a separate bullet states `tasks.md` is staged-and-committed by step 8 (content written elsewhere via task mechanics, release-engineer never hand-edits it), consistent with every other root metadata path step 8 already owns (`docs/backlog.md`, `CLAUDE.md`, etc.).
  - `content/skill-release-engineer.md:265` (the "Expected vs unrelated scope rule", where the confusion originates) disambiguates that `tasks.md`'s mention there is an exclusion from **this STOP-on-unrelated-uncommitted-changes rule only** — it does not say or imply anything about which commit stages/owns `tasks.md`.
  proof: `grep -n "tasks.md" content/skill-release-engineer.md` after the fix shows `tasks.md` in step 8's `git add`/pathspec lines and the new Artifact-ownership bullet, and does NOT appear inside step 13a's prose or script block.

**E144 — `--close-out` first-push remedy**

- **AC8** — Given step 13b's remedy prose (`content/skill-release-engineer.md:244`), when the close-out check FAILs with `no upstream tracking branch configured` (a branch that has never been pushed), then the remedy names `git push -u <remote> <branch>`, distinct from the remedy for the `HEAD is <n> commit(s) ahead of upstream <ref> — not pushed` FAIL (a plain `git push` remains correct there, since upstream is already configured in that case).
  proof: `grep -n "push -u" content/skill-release-engineer.md` returns at least one match inside step 13b's remedy text after the fix (zero before).

**E149 — N1/N2 in `content/coord-03-core-fallback.md`, N3 in `content/skill-release-engineer.md`**

- **AC9 (N1)** — Given the `**Anchoring rule** (E109)` sentence at `content/coord-03-core-fallback.md:9` lists "evidence paths" among the mechanisms "anchored to `workspace_path` ... never spans workspaces", and the very next paragraph (`:11`, the E111 Worktree bootstrap obligation) mandates symlinking evidence dirs back to primary in a worktree lane, when the distinction is written, then it takes the exact form code-review's N1 recommended follow-up proposed (`review_reports/archive/e109-workspace-feature-anchoring/review_T-E109-01.md` line 46): qualify the evidence-path clause to read that anchoring is about **keying** ("anchored to `workspace_path` for keying") while E111 governs **resolution** ("where those paths resolve is a separate concern, see the Worktree bootstrap obligation below") — a subordinate clause on the existing sentence, not a new rule, and not a restatement of E111.
  proof: none (a readability/precision judgment on normative prose) — qa-engineer confirms the edit is additive to the existing sentence (does not delete or contradict the AC1(a) mechanism list from e109-workspace-feature-anchoring's own spec) via `git diff` inspection.
- **AC10 (N2)** — Given `(E109)` at `content/coord-03-core-fallback.md:9` ships unwrapped while its sibling `(E111)` at line 11 is wrapped in `<!-- origin:start -->`/`<!-- origin:end -->`, when the fix lands, then `(E109)` is wrapped the same way (matching 5 of the file's 6 same-shape provenance codes; the sole pre-convention exception, `(E1)`, is untouched).
  proof: `node --input-type=module -e "import { buildCoordinatorPrompt } from './dist/prompts/coordinator.js'; ..."` (or the equivalent `test/skill-manifest.test.mjs` golden re-derive) — the composed, stripped bundle no longer contains the literal substring `(E109)`.
- **AC11 (N3)** — Given `content/skill-release-engineer.md:219` quotes the Check 1 tolerance NOTE line as `` NOTE: tag-at-HEAD — tolerated N governance-bookkeeping commit(s) ahead of tag vX.Y.Z `` while the script's actual line (`scripts/verify-release.mjs`, Check 1 success path) appends a trailing `` (<tagSha12>..<headSha12>) ``, when the quote is corrected, then it includes that trailing span so the SOP quotes the real literal, not a stable-but-partial prefix of it.
  proof: `grep -n "tolerated N governance-bookkeeping" content/skill-release-engineer.md` — the matched line now also contains the literal substring `(<tagSha12>..<headSha12>)` or an equivalent placeholder naming both shas.
- **AC12 (context-budget re-baseline, qa-owned)** — Given `content/coord-03-core-fallback.md` is inside the measured coordinator bundle (`test/context-budget.test.mjs`, referenced 12×, current floor 18722 ~tok) and N1 adds prose while N2 removes ~7 bytes of previously-shipped `(E109)` text, when qa-engineer re-derives the bundle size post-fix, then it re-baselines whichever floor(s) actually regress (never sr-engineer's task) and records the before/after byte counts in its evidence file — and does NOT wrap the new N1 clause in a `<!-- rationale:start -->/<!-- rationale:end -->` fence to dodge the floor (that route is measured DEAD per the e109-workspace-feature-anchoring lane's own review notes: a fence is stripped by the default compose pass, deleting the normative deliverable from the shipped bundle).
  proof: `node --test test/context-budget.test.mjs` green post-re-baseline; the qa evidence file states the new floor value and the delta from 18722.

## Decisions

**E143 — `tasks.md` ownership: step 8 owns it.** Ratifying the coordinator's
recommended position from the dispatch card, on this evidence:
- Step 8's `git add` pathspec (`content/skill-release-engineer.md:194`,`:199`)
  already explicitly includes `tasks.md` — it is not, and has never been,
  excluded from step 8's staging list.
- Step 13a's claim that it commits `tasks.md` as "the E71c exclusion from
  step 8's release commit" is false: that premise requires `tasks.md` to be
  *absent* from step 8's commit, and it is not.
- Git ground truth, last four releases: v3.110.0 and v3.111.0's release
  commits (step 8) carry `tasks.md`; v3.112.0 and v3.113.0 carry it in
  neither commit (unchanged at release time, not excluded). The 13a
  bookkeeping commit has carried it on zero of four.
- The root of the confusion is `content/skill-release-engineer.md:265`'s
  "Expected vs unrelated scope rule", which lumps `tasks.md` in with
  `.current/**` as an "explicit non-STOP exclusion (E71c)" — that exclusion
  is scoped to the STOP-on-unrelated-uncommitted-changes check in that same
  paragraph, never to step 8's staging list. AC7 above disambiguates all
  three sites (`:41`, `:232`, `:265`) consistently with this decision.

**E142/E144 file-surface correction** — see "Ground-truth correction to the
dispatch card" above; recorded here as the decision input for the cut table.

**E142(b) — a named feature with no spec file is logged-and-skipped by design.**
Ruled by the coordinator during `review_round` 1 (finding F2), after code-reviewer
found that the MULTI-FEATURE branch pointed at a per-feature
SKIP/UNCLASSIFIABLE judgment that does not exist. Both of those branches key on
`scope_decision_why` and `specs/<active_feature>.md`, and both are session-scoped
to `active_feature` alone — `tw_get_state` exposes no per-feature
`scope_decision_why` — so demanding a per-feature justification would require
information the handoff does not carry. An unexecutable rule is not a rule (the
reasoning E109 settled on). The MULTI-FEATURE branch therefore logs each
spec-less named feature and skips it, and STOPs only when a named feature's spec
*does* exist but is absent from the release range. Implemented at
`content/skill-release-engineer.md:223`; verified in
`review_reports/review_T-E142-04.md` round 2. Recorded here after the cut, so it
adds no AC — AC5 already covers the branch's behaviour.

## Copy / Strings

User-facing here means: the exact SOP-prose sentences and CLI message
strings this feature introduces or changes.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e143.tasks-md-ownership | "`tasks.md` is staged and committed by step 8; step 13a stages only `.current/handoff.md` and `.current/*.jsonl`." (paraphrase — exact prose is sr-engineer's to draft to fit each of the three edit sites' surrounding register) | authored-here — E143's decision, recorded above |
| e144.push-u-remedy | "push `git push -u <remote> <branch>` (first push of this branch) or `git push` (upstream already configured), then re-run" (paraphrase — exact wording is sr-engineer's to fit step 13b's sentence) | authored-here — E144 backlog row's stated fix |
| e149.n1-keying-vs-resolution | "anchored to `workspace_path` for keying — where those paths resolve is a separate concern, see the Worktree bootstrap obligation below" | `review_reports/archive/e109-workspace-feature-anchoring/review_T-E109-01.md:46` (code-review's N1 recommended follow-up, quoted verbatim) |
| e149.n3-note-suffix | `` (<tagSha12>..<headSha12>) `` appended to the existing NOTE quote | `scripts/verify-release.mjs` Check 1 success-path `console.log` (existing runtime literal, not new copy — the SOP quote is being corrected to match it) |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (SOP/CLI prose only) |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any change to `test/` files (qa-engineer owns every `test/` edit per
  Constitution §2; sr-engineer's tasks below implement prose/script only).
- `docs/backlog.md` done-marking of any of the five rows — release-engineer's
  job, post-PASS. Do NOT touch `docs/backlog.md`'s E145 row or any other row.
- Any part of E112/E113/E115/E116 (Wave 3 — waits on this and other PASSes).
- `schema/`, `tools/`, `index.ts`, `docs/schema-versions.md` — forbidden in
  this lane; another session runs E114 there in a separate worktree.
- Migrating the E95 citation check or the AC4 post-commit sanity check from
  manual SOP prose into automated `scripts/verify-release.mjs` logic. Both
  tickets fix the *range* the existing manual procedure uses; converting them
  into script-enforced checks is a larger, unrequested scope change and is
  explicitly not part of this batch.
- E147's fallback path (no tag exists yet) — unchanged behavior, not a fix
  target, only asserted as a non-regression (AC2).
- Any rewording of `content/coord-03-core-fallback.md` beyond N1's qualifying
  clause and N2's origin-tag wrap — no new rules, no restatement of E111.

## Dependencies / Prerequisites

- **Precondition**: Wave 2 (E109 + E146) already merged (per the dispatch
  card; `tw_get_state` confirms `active_feature: e109-workspace-feature-anchoring`,
  `status: In_Progress`, `next_role: pm`, `cut_approved: true`, released as
  v3.113.0 per `pending_notes`).
- **Feature-lease timing**: the incumbent E109 lease (In_Progress,
  `last_updated` 2026-09-18T08:25:25Z, 30-min TTL, expires
  2026-09-18T08:55:25Z) may still be held when this feature's own
  `tw_update_state` write is attempted. A `FEATURE_LEASE_HELD` rejection at
  that point is expected, not a defect — wait past the expiry and retry the
  identical write once. Do not hand-edit state, set `lease_override`, or
  invent a different `active_feature` to route around it.
- **Dispatch pin carry-forward**: `dispatch_pins: {"sr-engineer": "fable"}` is
  dropped by the server on `active_feature` change and MUST be re-included
  explicitly on this feature's routing `tw_update_state` write, or the pin is
  lost.
- **No design file** exists for this feature (`design/e142-release-tooling-wave25.md`
  is absent) — Scope Decision Gate and Visual State-Count/Geometric-Density
  Split gates are non-design, not gated. `scope_decision: single-feature` is
  recorded on the routing write per the dispatch card's own reasoning: five
  tickets collapse onto three files, and the plan's 完成定義 forbids opening
  any one of them twice.
- **Resource Audit Gate**: scanned all five backlog rows (E142/E143/E144/E147/E149)
  and this spec's own source material for `http(s)://`, `figma`, ticket/URL
  refs — zero external hits. Every reference is either an in-repo file path
  (already read directly above) or a backlog ticket ID. Field omitted (zero
  hits = non-blocking).
- **No AskUserQuestion needed**: the two decisions this batch required
  (E143's `tasks.md` ownership, E142/E144's actual file surface) were both
  resolvable from measured ground truth in this repo, not from ambiguous
  user intent — recorded above as Decisions rather than escalated.
