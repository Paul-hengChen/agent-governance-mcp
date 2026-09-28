# e178a-integrator-role

Ticket: **E178a** (E178 items (1)–(8), folding E192). Lane `e178a`, branch `feat/e178a-integrator-role`, base `3c72a83`.
Binding scope line: `specs/fanout-wave7.2b.md` row `e178a` (DO / DON'T, owned / forbidden lists). Human decisions in force: D8 (`sr-engineer=fable`), D9 (E223 is its own lane), D10 (E192 verifier = generic read-only agent, no dedicated template), D11 (`integrator` is a prompt only, not in the `tw_switch_role` / `agent_id` enums).

## Problem Statement

Cross-lane integration has no formal role. The integrator today is an interim, repo-local draft (`.claude/commands/integrator.md`) that only this checkout can invoke. Its git operations (`merge`, `switch -c`, `worktree remove`, `branch -d`, and the `update-ref -d` that `agc feature start` rollback uses) sit outside Constitution §6's sanctioned list and are authorised per invocation. A merge-time conflict resolution is new code that no lane's PASS covers, so it can reach `main` without review. The mailbox / cut pre-review protocol and the line between what the integrator decides and what the human decides were drawn case by case across Waves 5–7. Its manual steps also duplicate mechanisms that have since shipped (E124 / E125 / E126 / E177a / E177b / E178b). E192's context-bloat problem (full-suite output and diffs piling up in the one session that must hold the cross-lane picture) needs a sanctioned verifier-dispatch path. Lane task ids that are not ticket-prefixed can collide across lanes in evidence file names (`review_<task id>.md`).

## User Stories

- As the human running N parallel lanes, I want an `integrator` MCP prompt that any workspace wired to agent-governance-mcp can invoke, so that I don't depend on a repo-local slash command.
- As the integrator, I want §6 to grant me, and only me, the git operations that merging and teardown need, so that I stop needing a per-invocation authorisation and other roles stay on the base list.
- As a reviewer of `main`, I want every substantive merge-conflict resolution reviewed by `code-reviewer` before it reaches `main`, so that no unreviewed code merges.
- As a lane session, I want one mailbox protocol that says when I send a cut, when I may stop watching, and what `close` / `reopen` mean, so that no integrator message goes undelivered.
- As the integrator, I want to hand lane-layer and integration-layer re-verification to a fresh read-only subagent and get back a structured result, so that my context holds coordination rather than test output.
- As release-engineer archiving evidence, I want lane task ids to carry the ticket (`T-<ticket>-NN`), so that evidence files never collide across lanes.

## Acceptance Criteria

Test file for new proofs: `test/e178a-integrator-role.test.mjs` (qa-owned, created by T-E178A-07). "SOP" = `content/skill-integrator.md`.

- **AC1 — SOP exists, carries the interim's intent.** Given the branch, when `content/skill-integrator.md` is read, then it (a) opens with YAML frontmatter carrying `recommended_model: sonnet` (must be one of `MODEL_TIERS` = opus|sonnet|haiku, `tools/skill-frontmatter.ts:8`); (b) has a purpose section that carries over the interim's "why this role exists" content (the three human needs: close-out ownership, fan-out ownership, the human is not the mail carrier; why existing roles can't do it; the one-sentence summary); (c) has a work-overview table (stages 1–6 + "any time", human-gated stages marked); (d) has a can / cannot permission table; (e) has a "you are not" list (not a builder, not a judge substitute, not any lane's session (§3.2), not release-engineer); (f) ends with the watermark rule `— @integrator` with NO tier (an MCP-prompt invocation is not Task-spawned, Constitution §1; D11 rules out a Task dispatch).
  proof: `node --test --test-name-pattern "AC1" test/e178a-integrator-role.test.mjs`
- **AC2 — Reference, don't restate.** Given the SOP, when its manual steps are compared to shipped mechanisms, then each is replaced by a reference to the mechanism, cited by command: E177a `scripts/fanout.mjs render|check` (manifest format + dispatch prompt), E177b `scripts/lane-status.mjs`, `scripts/mailbox-watch.mjs`, `scripts/test-lock.mjs` (serial suites), E178b `lane-status --watch` / `--mailbox-root`, E126 `scripts/merge-invariants.mjs` after every merge, E124 + E125 `agc feature finish <lane> --shipped` (ticket allocation as the single writer, `.current/<lane>/` → history move, worktree/branch teardown). And the SOP does NOT contain a second copy of the §3b dispatch-prompt template (the string `開始做 <計劃或 feature>` is absent), of the lane manifest table skeleton, or of the lane report format (it points to `docs/lane-protocol.md` §6).
  proof: `node --test --test-name-pattern "AC2" test/e178a-integrator-role.test.mjs`
- **AC3 — `integrator` MCP prompt registered.** Given `dist/` is built, when `PROMPT_REGISTRY` is imported, then it has 12 entries, the last is `{ name: "integrator", skillFile: "skill-integrator.md", arguments: [PROMPT_WORKSPACE_ARG] }` with the description from Copy `prompt.integrator.description`, and the first 11 entries (names, descriptions, order) are byte-identical to base. `prompts/integrator.ts` exports `buildIntegratorPrompt(workspacePath)`, a thin `buildPromptForRole("skill-integrator.md", …)` wrapper matching `prompts/pm.ts`.
  proof: `node --input-type=module -e 'import {PROMPT_REGISTRY as R} from "./dist/tools/registry.js"; console.log(R.length, JSON.stringify(R.at(-1)))'` prints `12` and the integrator entry.
- **AC4 — D11 holds: prompt only.** Given the branch, when `tools/role.ts` `ROLE_SKILL_MAP`, the `tw_switch_role` `role` enum, and `tools/transitions.ts` agent names are inspected, then none contains `integrator` (all three files unchanged vs base). The SOP states the integrator never calls `tw_update_state` and never writes any lane's `.current/<lane>/`; read-only `tw_get_state` / `tw_detect_drift` / `tw_gate_stats` and `tw_sync` on primary are allowed.
  proof: `git diff --quiet 3c72a83 -- tools/role.ts tools/transitions.ts && ! grep -n integrator tools/role.ts tools/transitions.ts; echo exit=$?` prints `exit=0`.
- **AC5 — Prompt count 11 → 12 in the adapter docs.** Given `CLAUDE.md`, then its count sentences read 12 / Twelve and the prompt list includes `integrator`; the per-role sentence ("the other nine …") and the layout lines (`prompts/{…}` list, `content/skill-*.md … the other N role SOPs`) include integrator. `AGENTS.md` carries no prompt count at base, so it is unchanged unless the implementer finds one (then it is synced the same way).
  proof: `grep -c "12 registered role prompts\|Twelve prompts are registered" CLAUDE.md` prints `2`.
- **AC6 — §6 amendment: integrator-only grant.** Given `content/const-15-core-tail.md` §6, then the "Sanctioned git operations (ALL roles)" base list and the existing FORBIDDEN entries stay unchanged (AC7 appends exactly one entry, `commit --amend`; R2=a′ adds `git fetch` — remote-tracking refs only — to the always-permitted read-only sentence for all roles), and an added clause sanctions **for the integrator role only**: `git merge --no-ff`, `git merge --ff-only`, `git switch -c`, `git switch <existing-branch>` (never `--force` / `--discard-changes`), `git worktree remove` (never `--force`), `git branch -d` (never `-D`), `git update-ref -d <ref> <expected-sha>` (compare-and-delete). It says every other role stays on the base list, and it points to the SOP for when each is used. The clause does not duplicate SOP procedure (stays ≤ ~4 lines so the core-fragment budget growth stays small).
  proof: `node --test --test-name-pattern "AC6" test/e178a-integrator-role.test.mjs`
- **AC7 — `commit --amend` disposition written.** Given §6, then `git commit --amend` has an explicit disposition for all roles (proposed default, Q1: FORBIDDEN, because it rewrites a sha that evidence files, mailbox reports and review reports may already cite; make a follow-up commit instead). The text names the rule, not the Wave 7.2 incident.
  proof: `node --test --test-name-pattern "AC7" test/e178a-integrator-role.test.mjs`
- **AC8 — Tool-internal git ops are covered.** Given §6, then it states that git operations `agc feature start` / `agc feature finish` perform internally (including start's rollback `update-ref -d <ref> <expected-sha>`, finish's `worktree remove` / `branch -d`) are sanctioned by invoking the tool in the role `docs/lane-protocol.md` assigns it (start: the lane; finish: the integrator). The agent never types those operations by hand as a substitute when the tool refuses (proposed default, Q2).
  proof: `node --test --test-name-pattern "AC8" test/e178a-integrator-role.test.mjs`
- **AC9 — Merge-resolution review duty.** Given the SOP's merge stage, then it (a) defines a *substantive* resolution as any conflict hunk whose result is not simply both sides kept verbatim (and not a `dist/` or golden regeneration); (b) requires dispatching `code-reviewer` via Task on that merge commit, with the resolution shown by `git show --remerge-diff <merge-sha>`; (c) routes the verdict through an evidence file committed on the integration branch (`review_reports/review_merge-<short-sha>.md`) with no `tw_update_state` on the integration branch, the E222 precedent; (d) forbids fast-forwarding `main` before that verdict is APPROVED; (e) routes shared-artifact regeneration (goldens / budget) to `qa-engineer` via Task; (f) says the integrator never fixes feature code on the integration branch.
  proof: `node --test --test-name-pattern "AC9" test/e178a-integrator-role.test.mjs`
- **AC10 — Mailbox + cut pre-review formalized (integrator side).** Given the SOP's execution stage, then it states: the lane's PM cut goes to the mailbox and converges with the integrator before the human approves (once per lane, typed in the lane's own session; the mailbox never carries approval); before sending `close` on a cut, the integrator checks that **every AC has an implementing task, not only a qa task**; for architect-hop tickets, pre-review happens twice (PM cut, then the architect's Open Questions), and both must converge before the lane presents to the human; the integrator reads `hop:` before asking for changes and batches its requests when hops run low; `close` ends one topic, and writing on a closed topic needs `type: reopen` first; the 3-exchange cap leads to `escalate`; the integrator's own watch runs through `mailbox-watch.mjs`, with re-arm always from the printed baseline, plus `lane-status --watch` (state transitions without mail) and the `--mailbox-root` cut pre-review fan-in check. Mailbox message format and lane-side rules are referenced to `docs/lane-protocol.md` §5, not copied.
  proof: `node --test --test-name-pattern "AC10" test/e178a-integrator-role.test.mjs`
- **AC11 — Lane-side mailbox rules formalized in `docs/lane-protocol.md` §5.** Given §5, then (a) rule 3 says explicitly that the lane's wait stays armed across **every human-approval pause** (cut approval, policy ruling, lease override), not only between role hops; (b) architect-hop lanes send the architect's Open Questions to the mailbox (a second pre-review) before presenting to the human; (c) it states whether a single-role qa lane sends a cut. Proposed default, Q3: a lane whose PM hop writes `specs/<feature>.md` sends that cut for pre-review even when PM routes to a single-role judge dispatch, which matches E178b's `--mailbox-root` check keying on the spec file. A lane with no PM hop (qa-direct mini-chain, no spec) sends no cut; it sends a `type: report` only.
  proof: `node --test --test-name-pattern "AC11" test/e178a-integrator-role.test.mjs`
- **AC12 — Decision-rights table.** Given the SOP, then a two-column table lists **integrator decides alone**: accepting a mechanical out-of-bounds edit; post-milestone queue placement of a new ticket; folding a finding into an existing row; sending a lane back. And **always the human**: cut approval; policy rulings; whether a new ticket enters the current milestone; relaxing a definition of done; any git operation outside the role's §6 grant. It also carries the rule that the integrator gives only a recommendation, marked "needs human ruling", which the lane presents.
  proof: `node --test --test-name-pattern "AC12" test/e178a-integrator-role.test.mjs`
- **AC13 — E192 verifier (D10).** Given the SOP's verification stage, then it says the integrator MAY dispatch a fresh-context **generic read-only** subagent (no dedicated template, D10) per lane report for the lane-layer checks, and for the integration-layer full suite. It lists the structured result to return: branch sha + `main..<branch>` commit list; `diff --stat` vs the manifest's owned list with out-of-bounds files named (`fanout check`); each cited evidence file's verdict line + task id; worktree `status --porcelain` *after* the suite ran (a non-empty result after `npm test`'s prebuild is itself a finding: `dist/` not rebuilt at commit); full-suite pass/total with the log saved to a scratch file, not returned; the `pending-tickets.md` / `## Applied` / root `NEW-TICKETS.md` check. It cites the five constraints of backlog E192 by number with a one-line name each (Q4): read-only; the report is a claim the integrator re-anchors (`git rev-parse`, log summary grep) before `close`; serial runs (E182, `test-lock`); never a lane's session (§3.2); not code-reviewer / qa-engineer.
  proof: `node --test --test-name-pattern "AC13" test/e178a-integrator-role.test.mjs`
- **AC14 — Ticket-prefixed task ids.** Given `docs/lane-protocol.md`, then §3 requires lane task ids of the form `T-<ticket>-NN` (ticket uppercased, two-digit sequence, e.g. `T-E178A-01`), with the reason: evidence file names `review_<task id>.md` must not collide across lanes before release 7a archives them.
  proof: `grep -n 'T-<票號>-NN\|T-<ticket>-NN' docs/lane-protocol.md` prints ≥1 line in §3.
- **AC15 — Provenance repointed; one template copy.** Given the branch, then `docs/lane-protocol.md:5` names `content/skill-integrator.md` (the `integrator` MCP prompt) as the integrator's SOP and no longer names `.claude/commands/integrator.md`. The `tools/fanout-manifest.ts` comment above `PROMPT_TEMPLATE_3B` states that this constant is the single canonical copy of the dispatch-prompt template and that the SOP references it via `scripts/fanout.mjs render`, and it no longer cites `.claude/commands/integrator.md`. The template string bytes are unchanged (the E177a render golden stays green).
  proof: `! grep -n "commands/integrator" docs/lane-protocol.md tools/fanout-manifest.ts && git diff 3c72a83 -- tools/fanout-manifest.ts | grep '^[-+][^-+]' | grep -v '^\s*[-+]\s*\*\|^[-+]\s*//' ; echo exit=$?` shows comment-only changes.
- **AC16 — Interim retired; `.claude/` classification adjusted.** Given the branch, then `.claude/commands/integrator.md` is deleted (proposed default, Q5; the alternative is a pointer-only stub). If deleted and nothing else under `.claude/` is tracked, `".claude/"` is removed from `NON_SOURCE_DIRS` in `test/release-staging.test.mjs`. If kept as a pointer, its comment is rewritten to "pointer to the formal integrator prompt". The E66 Partition test stays green either way.
  proof: `git ls-files .claude; node --test --test-name-pattern "Partition" test/release-staging.test.mjs`
- **AC17 — Rendered prompt is well-formed and budgets re-baselined once.** Given `dist/` is built, when `buildPromptForRole("skill-integrator.md", …)` renders, then it contains the SOP body and the render-structure glue detector reports zero findings. All compose goldens (`test/fixtures/compose-golden/**`) and the context-budget floor are regenerated **in one qa pass** after the §6 edit and SOP land, and every diff hunk is explained in the qa evidence file. The skill-file count assertion (`test/skill-frontmatter.test.mjs`, 11 → 12) is updated, subject to the ownership grant in Q6.
  proof: `npm test` on the committed branch, clean tree: 0 failures.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| prompt.integrator.name | `integrator` | backlog E178 PACKAGING (register "as the server's `integrator` MCP prompt") |
| prompt.integrator.description | `Integrator — plan parallel lanes, pre-review cuts, verify lane reports, merge, tear down. Cross-lane; writes no handoff state.` | authored-here: matches the terse one-line style of the other `PROMPT_REGISTRY` descriptions; "writes no handoff state" surfaces D11 in `prompts/list` |
| sop.watermark | `— @integrator` | Constitution §1 watermark table, non-Task row (no tier) |
| protocol.task-id | `T-<ticket>-NN` | backlog E178 row ("lane task ids of the form `T-<ticket>-NN`") |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `integrator` in the `tw_switch_role` / `agent_id` enums or `ROLE_SKILL_MAP` (D11).
- A dedicated verifier template under `templates/claude-code-agents/` (D10).
- E223 (lane e223), E205, E133, E209, E224.
- `prompts/build.ts` `RAG_SKIP_ROLES` (whether `integrator` should skip Spec-Context injection in SQLite mode). `prompts/build.ts` is forbidden to this lane; candidate pending ticket.
- Adopter portability of the SOP's tool references (`scripts/*.mjs` and `docs/lane-protocol.md` exist only in this repo's checkout, not in an adopter workspace). The prompt becomes invocable everywhere (the DoD row), but running its tools from an adopter cwd is a follow-up; candidate pending ticket.
- `README.md`, `docs/install.md`, `docs/architecture.md` "11 / eleven prompts" sentences: not in the owned list. doc-writer handles them post-PASS, or the integrator after merge; flagged in the lane report.
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks E178 / E192): release-engineer / integrator post-merge.
- Rewriting the historical `specs/fanout-*.md` manifests that cite the interim path (historical artifacts, per the manifest).

## Dependencies / Prerequisites

- e130 `5f9a21c`, e178b `fcfef80` merged at base (verified by the manifest's pre-dispatch check). E222 pinned `test/e130-lane-default.test.mjs` AC4/AC14 to `121ddc8..5896bdd`, so editing `.claude/commands/integrator.md` / `CLAUDE.md` here cannot red it.
- Shared generated artifacts (`content/**`, compose goldens, `test/context-budget.test.mjs`) belong to this lane alone in Wave 7.2b.
- No architect hop: one new prose SOP, one thin prompt wrapper plus a registry entry that follows an existing pattern, prose edits in two fragments / docs. There is no new data model, no cross-cutting API, and one code module. The two design-ish questions (Q1, Q2) are policy calls for the human, not architecture.
- **Open questions** (proposed defaults in the ACs; the human confirms at cut approval):
  - **Q1 (AC7)** — `commit --amend`: FORBIDDEN for all roles (follow-up commit instead)? Alternative: sanctioned only on an unpushed commit that no artifact cites yet.
  - **Q2 (AC8)** — tool-internal git ops of `agc feature start` / `finish` are sanctioned by invoking the tool in its protocol-assigned role, while the manifest's "update-ref ONLY for integrator" covers hand-typed use. OK?
  - **Q3 (AC11)** — single-role qa lane: sends a cut iff its PM hop wrote a spec (matches E178b's check); a no-PM qa-direct lane sends none. OK?
  - **Q4 (AC13)** — the five E192 constraints are cited by number **plus a one-line name each**, not a bare "see E192": the prompt ships to adopter workspaces where `docs/backlog.md` doesn't exist (the E103 / §8b failure class). OK?
  - **Q5 (AC16)** — delete `.claude/commands/integrator.md` (so `/integrator` in this repo becomes the `integrator` MCP prompt after the post-merge server restart) rather than leave a pointer stub?
  - **Q6 (AC17), GRANTED by integrator (to-lane#1; mechanical, qa-only edit, count 11→12 only)** — `test/skill-frontmatter.test.mjs:106` asserts exactly 11 `content/skill-*.md` files and will red when the SOP lands. That file is not in the lane's owned list. Proposal: grant it to e178a (qa-only), the same class as the four existing tests the manifest already reassigned.
  - **Q7** — SOP language: English (consistent with every other `content/` fragment and the adopter-facing bundle), with the human's original-intent section translated faithfully?
- Resource audit: all references are in-repo and were read (`docs/lane-protocol.md`, `specs/fanout-wave7.2b.md`, `docs/backlog.md` E178 / E192, `docs/v4.0.0-execution-plan.md` Wave 7 card, `.claude/commands/integrator.md`). No URLs, no design files. (Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.)

## Pre-review outcome (integrator, to-lane#1)
- Scope, file bounds and AC→task coverage match `specs/fanout-wave7.2b.md` row e178a.
- Fixes applied: AC1(a) names `recommended_model: sonnet`; AC1(f) watermark is `— @integrator` (no tier); AC6/AC7 wording — existing FORBIDDEN entries unchanged, AC7 appends one.
- Q2, Q3, Q4, Q5, Q7: integrator agrees with the defaults. Q6: granted (`test/skill-frontmatter.test.mjs` joins the owned list, qa-only, count 11→12 only).
- Q1: human ruling required (integrator recommends the default, FORBIDDEN for all roles).
- qa heads-up: `test/e92-e86-handoff-write-boundary.test.mjs`, `test/e43-*`, `test/render-structure.test.mjs` sweep all `content/*.md`; red there → mailbox the integrator before editing.
- Out-of-scope candidates filed in `.current/e178a/pending-tickets.md`; adopter-portability placement (v4 vs post-v4) is a human ruling.
- Human rulings (coordinator session): Q1=A; R2=a′; E178A-NEW-1 post-v4.
