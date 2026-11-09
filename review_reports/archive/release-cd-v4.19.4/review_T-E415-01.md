# Review — T-E415-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff `2f88f14..0e8467b` rewords two sites in `content/coord-03-core-fallback.md`: the Escalation Routes row *last write is `status: PASS`* (line 26) and the *Backlog Intake Loop* Bounds paragraph (line 60). Both now say the release is a deliberate human decision, carried out by the `Release` workflow (`docs/release-cd.md`), with release-engineer as its manual fallback.
- Other changes: the expected-red manifest `qa_reports/expected-red_e415-coord03-release-wording.txt` and the lane's `.current/e415/` state files. No code, gate, transition, schema or test change.
- Scope matches backlog row E415 (the spec, mini-chain) exactly. Nothing extra.
- Verdict: APPROVED.

## AC Completeness
AC Completeness: SKIP — no specs/<feature>.md (backlog-row-as-spec mini-chain)

Checked against backlog row E415 (`docs/backlog.md:538`):
- Reword PASS row to name the `Release` workflow (`docs/release-cd.md`) and release-engineer as manual fallback: done, `content/coord-03-core-fallback.md:26`.
- Reword Bounds paragraph the same way: done, `content/coord-03-core-fallback.md:60`.
- No-auto-hop bound stays: done at both sites (see Correctness).
- Wording only, no routing, gate, transition or schema change: confirmed. The diff touches no `.ts` file. The PASS row's `status` (PASS terminal) and `next_role` (`human`) columns are unchanged.
- Known pin and regex grep: `test/e5-intake-tiering.test.mjs:330,338,347` still match and pass (see Performance/verification below). A `git grep` of `test/` for regex forms of the old phrases ("release-engineer (is|remains) a deliberate human decision", "not an auto-hop") found no other pin.

## Correctness
Each factual claim checked against the repo:
- "the release is ... carried out by dispatching the `Release` workflow": `.github/workflows/release.yml:23` `name: Release`, `:26` `workflow_dispatch`. `docs/release-cd.md:3` says "A human makes the decisions beforehand ... and then dispatches the workflow". True.
- "release-engineer is its manual fallback": `docs/release-cd.md:3` "the release-engineer SOP is the manual fallback", `docs/release-cd.md:109-111` *Manual fallback*, `content/skill-release-engineer.md:34` "this SOP is its manual fallback". True.
- No-auto-hop bound, site 2 (line 60): unchanged and verbatim, "this loop NEVER auto-hops to release-engineer". It also keeps "PASS stays terminal for the CURRENT feature".
- No-auto-hop bound, site 1 (line 26): the words "not an auto-hop" were dropped. I judge that the meaning holds, for three reasons. (a) "deliberate human decision" says the release is not started by an agent on its own. (b) The row's `next_role` column is still `human`, and that column is what routes the hop. (c) The parenthetical "(the loop never auto-hops to release-engineer)" is kept, and it covers the only automatic follow-on the row starts. The bound is still fully stated. See Quality Q1 for an optional tightening.
- Expected red (SOP 4a): the diff edits a core-tagged coord fragment, so the coordinator monolith golden is expected to break. The manifest exists with 1 entry, so I sampled all 1. `test/skill-manifest.test.mjs:101` has `t-golden-byte-identity (AC1/AC5): composeSkill("skill-coordinator.md", {taskTool:true}) === frozen golden monolith, byte-for-byte`, which is real and locatable. My run fails exactly this one test (see verification). Re-capturing it is T-E415-02.

No findings.

## Quality
- Q1 `optional` — `content/coord-03-core-fallback.md:26`: the PASS row no longer says in so many words that the coordinator never starts the release itself. Now that the release is a workflow anyone can dispatch with `gh workflow run`, a reader could take "carried out by dispatching the `Release` workflow" as something the coordinator does right after PASS. "Deliberate human decision" plus `next_role: human` already rules this out, so this does not block. A future touch could add "never auto-dispatched" for symmetry with line 60.
- Q2 `optional` — `specs/auto-routing-v3.13-architecture.md:66` still quotes the old row wording. That file is a historical architecture record and E415 does not cover it, so leaving it unchanged is right.
- The wording at the two sites matches in substance and fits the terse, row-collapsed style of the surrounding table and paragraph.

## Architecture
No architecture spec exists for this feature. Layering is unchanged. The edit stays in the coordinator SOP fragment and changes no composition manifest entry, tag or fragment order.

## Security
No findings. Constitution §6 hygiene: the added text holds no secrets, tokens, personal names, ticket ids or version-specific incident references. It uses generic citations only: the `Release` workflow name and the `docs/release-cd.md` path.
- `optional` note: `docs/release-cd.md` and `.github/workflows/release.yml` belong to this repo, while coord-03 is served to every `/teamwork` workspace. In a consumer workspace the citation points at files that do not exist there. The spec requires this citation, and `content/skill-release-engineer.md:34` already set the precedent, so no action is needed for this ticket. Whether release-CD wording should be gated to this repo is a separate product question.

## Performance
No runtime change. Context budget: `test/context-budget.test.mjs` passes on the committed branch. The extra wording stays under the teamwork cap.

Verification (independent, lane worktree at `0e8467b`): `npm run build` exit 0. `node --test test/context-budget.test.mjs test/e5-intake-tiering.test.mjs test/skill-manifest.test.mjs` gave 113 tests, 112 pass, 1 fail. The 1 fail is the manifest-listed `t-golden-byte-identity (AC1/AC5)`, which is expected red and belongs to T-E415-02. I did not run the full suite; that is T-E415-02's scope.

Reviewer note: code-reviewer and sr-engineer are both pinned to opus for this feature (same model), so same-model bias is possible. The review was anchored on the backlog row and the cited repo files, not on the writer's reasoning.

## Verdict
APPROVED — both sites match backlog row E415, every claim checks out against `docs/release-cd.md`, `.github/workflows/release.yml` and `content/skill-release-engineer.md`, the no-auto-hop bound is still stated at both sites, and the only red is the manifest-listed golden owned by T-E415-02.
