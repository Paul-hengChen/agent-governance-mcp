# Review — T-E109-02

covers: T-E109-01, T-E109-02

## Round 1 — PASS — by qa-engineer

## Summary
Verified T-E109-01 (E109 + E146 rider) by EXECUTING every check myself against the live tree —
not by reading `review_reports/review_T-E109-01.md`, which was used only as a starting index of
what to re-derive. AC1, AC3, AC4, AC5, AC7 independently re-confirmed from the diff and the built
bundle. AC2's process attestation is accepted on the strength of a pre-existing, non-QA-authored
artifact plus an independently-confirmed fact (see AC2 below) — the raw ephemeral note itself is
gone by design (pending_notes are overwritten every hop; this is normal system behavior, not a
defect). AC6 (mine alone) is done: cap re-baselined 18570 → 18722, golden fixture re-baselined,
both independently re-measured through the real render path, not trusted from any handoff note.

**A second, previously-undisclosed defect was found and fixed during Phase 4**: a malformed
markdown table in `specs/e109-workspace-feature-anchoring.md:144` (Visual Tokens table — 4-column
header, 3-cell data row) was failing `test/check-md-tables.test.mjs`'s real-corpus check /
`npm run check:md-tables`. This is pre-existing (committed at `77664bc`, before T-E109-01's dispatch;
sr-engineer never touched `specs/`) and unrelated to AC6's substance — the code-reviewer's report did
not run the full suite and did not catch it. Fixed with a one-cell addition (see AC Execution / Notes
below) so it does not silently ride through on the AC6 re-baseline's coattails.

Full suite: 2100/2100 green (`npm test`). `npm run build` clean. `npm run check:md-tables` OK
(250 files scanned, 0 malformed tables; 5 pre-existing non-blocking DONE-mark advisories on
`docs/backlog.md`, unrelated to this feature).

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e109-workspace-feature-anchoring.txt` manifest declared).

## Copy Audit Gate / Visual Audit Gate (Phase 3a/3b)
Spec's Copy/Strings, Visual Tokens, and Visual Widgets tables are all explicitly `N/A` — "feature is
internal governance prose, not user-facing product copy" / "feature has no visual literals" /
"feature has no non-primitive widgets". Nothing to audit; gates trivially satisfied. (The Visual
Tokens table's own row had a structural markdown defect, unrelated to copy/visual content —
see AC Execution Log and Notes.)

## Phase 1.5 — Visual Compare
Skipped (no `design/e109-workspace-feature-anchoring.md`, no Visual Baselines declared).

## Correctness — AC-by-AC (independently re-derived, not inherited from review_T-E109-01.md)

**AC1 — PASS.** Read `content/coord-03-core-fallback.md`'s Feature-Scope Gate paragraph directly.
The appended sentence ("**Anchoring rule** (E109): every per-workspace governance mechanism —
this feature lease, `hop_count`, the `review_round`/`qa_round` caps, `tw_detect_drift`, telemetry
sidecars, evidence paths, and `cut_approved` — is anchored to `workspace_path`, scoped to that lane
alone, and never spans workspaces. When one feature fans out across multiple lanes ... its overall
plan ... lives in a version-controlled backlog/spec artifact, never inferred from or reconciled
across per-lane `.current/handoff.md` files.") reads unambiguously and covers both spec halves:
(a) the per-workspace mechanism list, verbatim against spec AC1(a)'s enumeration; (b) the
tracked-backlog/spec obligation. Judgment read, no `proof:` command per the spec — confirmed by
inspection, in the same paragraph as the existing E1 Feature-Scope Gate text (no new paragraph),
not restated a second time (`grep -n "never spans workspaces" content/coord-03-core-fallback.md`
→ one hit, line 9).

**AC2 — accepted, with a caveat disclosed rather than silently inherited.** The spec requires
sr-engineer's file-count judgment call to be "STATED in the task's notes, not made silently."
`tasks.md`'s T-E109-01 row is byte-identical to the PM/coordinator's original dispatch text (no
note appended by sr-engineer — confirmed via `git diff -- tasks.md`), and `.current/handoff.md`'s
`pending_notes` field is transient by design (overwritten on every hop; sr-engineer's write was
overwritten by code-reviewer's own APPROVED write before this QA round began), so the raw note
text is not independently recoverable by me now — that is normal system behavior for this field,
not evidence of silence. What IS independently verifiable: (1) the *substance* of the "zero
additional files" judgment is correct — `git diff --stat` (pre-AC6-edit baseline, see AC3 below)
shows exactly the two ticket-target files touched and nothing else, confirming zero additional
files were in fact touched; (2) `review_reports/review_T-E109-01.md` — an artifact authored by a
different agent (code-reviewer), predating this QA round — explicitly attests to having read and
confirmed this judgment at write-time, before it was overwritten. Per the SOP's own citation
standard for artifacts recording since-overwritten state (an artifact not authored by qa-engineer,
predating this round), I accept this as satisfying "stated, not silent." Recommend PM/coordinator
tighten the SOP so this kind of process attestation lands somewhere durable (e.g. the `tasks.md`
row, per the `(note: ...)` convention already used at task-completion time) rather than solely in
a field that the very next write erases — filed as an observation, not a blocker.

**AC3 — PASS (re-confirmed on two separate runs).** Before making any of my own AC6 edits:
`git diff --stat` showed only `content/coord-03-core-fallback.md` (+1/-1),
`content/skill-release-engineer.md` (+1/-1), and governance bookkeeping
(`.current/handoff.md`, `.current/telemetry.jsonl`, `tasks.md`) — zero `lib/`, `tools/`, `schema/`,
`guards/`, `gates/`, `prompts/`, `bin/`, `transport/`, `index.ts`, `test/`. `proof:` command
(`git diff --stat main -- lib/ tools/ schema/ guards/ gates/ prompts/ bin/ transport/ index.ts test/`)
printed nothing at that point. After my own AC6 edits, the same proof command now shows
`test/context-budget.test.mjs` and the compose-golden fixture — that is MY qa-owned AC6 work
(explicitly authorized by the task row and spec Dependencies), not a T-E109-01 boundary violation;
disclosed here rather than silently re-running the proof and passing it without comment.

**AC4 — PASS.** `sed -n '219p' content/skill-release-engineer.md | grep -c '\.current/handoff\.md'`
→ `0`. Read step 9a directly: the rewritten Check 1 sentence states the exact-match pass, the
ancestor+allowlist pass, and that a NOTE-carrying pass is still a pass — cross-checked clause by
clause against `scripts/verify-release.mjs:159-253`'s actual logic (tag===HEAD short-circuit;
`git merge-base --is-ancestor` precondition; per-commit `diff-tree` against `BOOKKEEPING_PATH_RES`;
the NOTE line is a bare non-failing `console.log`). Allowlist is cited to step 13a, not re-typed.

**AC5 — PASS.** `content/skill-release-engineer.md:220-222` byte-unchanged (only line 219 in the
diff). `grep -c "rationale:start"` / `"rationale:end"` → 8/8 (symmetric).
`node --test test/render-structure.test.mjs` → 15/15 green, including the asymmetric-span sweep.

**AC6 — PASS (mine, see dedicated section below).**

**AC7 — PASS.** `git diff --stat -- docs/` prints nothing; `docs/backlog.md:231` (E109) and `:268`
(E146) inspected directly — neither carries `[x]` or a DONE mark.

## AC Execution Log (Phase 3.5 — proof:-annotated ACs)

| AC | proof command | output | verdict |
|---|---|---|---|
| AC3 | `git diff --stat main -- lib/ tools/ schema/ guards/ gates/ prompts/ bin/ transport/ index.ts test/` | (pre-AC6 baseline) empty; (post-AC6) shows only `test/context-budget.test.mjs` + compose-golden fixture, my own qa-owned edits | PASS (see AC3 note above) |
| AC4 | `sed -n '219p' content/skill-release-engineer.md \| grep -c '\.current/handoff\.md'` | `0` | PASS |
| AC5 | `node --test test/render-structure.test.mjs` | `15/15 pass, 0 fail` | PASS |

Not proof-annotated but executed regardless as part of Phase 4: full suite (`npm test`) 2100/2100;
`npm run build` clean; `npm run check:md-tables` → `OK (250 file(s) scanned, 0 malformed tables)`.

## AC6 — Compose-golden + context-budget re-baseline (qa-owned, the substance of this round)

**Reds confirmed, independently re-measured, exactly as handed off — nothing else red.**
`node --test test/*.test.mjs` (before any of my edits) reported exactly 3 `not ok`:
- `test/context-budget.test.mjs` subtest 35 — measured **18722** ~tok vs floor **18570** (+152).
- `test/skill-manifest.test.mjs` subtest 4 — golden byte-identity.
- `test/check-md-tables.test.mjs` subtest 38 — the pre-existing, unrelated spec-table defect
  (see Summary; not part of AC6, fixed separately, documented above).

A 4th `not ok` (`test/usage-accounting.test.mjs`, `t-hook-noop-config-without-budget-key`) appeared
on the first full-suite run only; re-run in isolation (32/32 pass) and re-run of the full suite
again (3 reds, same 3, that test green) confirmed it was a timing flake under parallel full-suite
load, unrelated to this feature — not dispositioned as a regression.

**Golden fixture**: diffed `test/fixtures/compose-golden/skill-coordinator-monolith.txt` against a
fresh `composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent)` — the
only delta is the one new "**Anchoring rule** (E109)" sentence appended to the Feature-Scope Gate
paragraph, byte-for-byte. No second regression hiding in the golden diff. Fixture re-baselined to
the fresh composed output; `test/skill-manifest.test.mjs` now 28/28 green.

**Context-budget floor**: independently re-measured through the real render path
(`composeConstitution({chain:true,design:true})` → `stripOriginTags` → `stripRationale` for the
constitution side; `composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"))` →
`stripOriginTags` → `stripRationale` for the skill side — the exact path `buildPromptForRole` uses),
via a standalone script against `dist/`, not trusted from either handoff's stated figure: **74887
chars = 18722 ~tok, exact**, matching the test's own failure message and the code-reviewer's
handoff figure independently. Cap raised 18570 → 18722 (+152) in `test/context-budget.test.mjs`,
both the assertion and the test title (reconciling the label to the new value, per the file's own
established convention), with a comment block documenting the delta, the source, and the
rationale-fence reasoning below.

**Rationale-fence check — explicitly did NOT fence, per the dispatch's own instruction, and
independently verified why.** The spec's Dependencies section asks QA to try a
`<!-- rationale:start -->/<!-- rationale:end -->` fence before a third cap raise. I did not apply
one to the E109 anchoring rule. This is normative text — it states a rule `E112`–`E116` will be
built on, not a "why" aside — and I confirmed empirically, not just by citation, that fencing it
would delete it from the very bundle this floor measures: I ran
`stripRationale(stripOriginTags(body))` against the composed `skill-coordinator.md` body and
confirmed (a) the anchoring rule's text currently survives (`"never spans workspaces"` present) and
(b) a genuinely-fenced sentence in the same file (the E87 Evidence-Citation Convention rationale)
does NOT survive the same strip. Wrapping the new rule in a fence would make this assertion pass by
deleting the ticket's deliverable from the default compose, not by containing its cost — exactly
the failure mode the dispatch card warned against. Recorded this reasoning, not just the conclusion,
in the test file's own comment block so a future reader sees why the fence route was rejected here.

**Cap history — ground truth, since it's disputed.** The reprepository's own comment trail in
`test/context-budget.test.mjs` (not either handoff's prose) shows the full chain BEFORE this round:
17984 → 18303 (T-E111-01(a), Worktree bootstrap obligation) → 18369 (T-E8795-02, Evidence-Citation
Convention) → 18570 (T-E103-01/T-E91-01, dispatch-pin mechanics). That is **three** documented
raises reaching 18570, matching **PM's handoff account**, not the Wave 2 dispatch card's two-raise
account (`17984 → 18303 → 18369`), which stops one bump short and omits the 18369→18570 raise. This
round adds a fourth raise, 18570 → 18722, for the E109 anchoring rule.

## Quality / Architecture / Security / Performance
No new findings beyond what `review_reports/review_T-E109-01.md` already recorded (N1/N2/N3, all
non-blocking, explicitly deferred to a follow-up ticket per this round's dispatch — not re-litigated
here). No architectural, security, or performance surface changed by either the T-E109-01 diff or
this round's re-baseline / spec-table fix — content and test-fixture changes only.

## Scope discipline
No part of E112–E116 implemented or design-shaped. No `docs/backlog.md` row done-marked by this
round (release-engineer's job, post-PASS). New-test-file judgment: **no new test file created** —
AC1/AC2/AC7 are one-off inspection/process checks with no new behavior to pin; AC3/AC4/AC5 have
spec-given `proof:` commands already directly executable with no missing harness; AC6 is exactly
the re-baseline of the two named existing fixtures (`test/context-budget.test.mjs`,
`test/skill-manifest.test.mjs`'s golden); and the incidental `specs/` table defect is already
covered by the pre-existing `test/check-md-tables.test.mjs` real-corpus check (which is what caught
it) — no gap warranting a new file under Constitution §2's conditional-test-writing rule.

## Verdict
PASS. AC1, AC3, AC4, AC5, AC7 independently re-derived from the live tree and the built bundle, not
inherited from `review_reports/review_T-E109-01.md`. AC2 accepted per the artifact-citation
reasoning above, with the field's ephemerality flagged as a process observation, not a blocker. AC6
re-baselined and independently re-measured (cap 18570→18722, golden fixture refreshed), with the
rationale-fence rejection independently verified rather than taken on faith, and the cap-history
dispute resolved from the repo's own record (PM's account is correct). One previously-undisclosed,
pre-existing, unrelated defect (malformed Visual Tokens table in the spec itself) found via full
Phase-4 execution and fixed so it doesn't ride through silently. Full suite 2100/2100, build clean,
`check:md-tables` OK.
## 2026-09-18T07:32:27.808Z — PASS — by qa-engineer

PASS. AC1/AC3/AC4/AC5/AC7 independently re-derived from the live tree (not inherited from review_reports/review_T-E109-01.md). AC2 (sr-engineer's zero-additional-files judgment) accepted: substance independently confirmed via git diff --stat, documentation attested by code-reviewer's pre-existing, non-QA-authored review artifact (pending_notes are transient by design and were overwritten before this round began — flagged as a process observation, not a blocker). AC6 (mine): compose-golden fixture (test/fixtures/compose-golden/skill-coordinator-monolith.txt) and context-budget floor (test/context-budget.test.mjs) re-baselined 18570->18722 (+152), both independently re-measured through the real render path (74887 chars = 18722 ~tok exact). Deliberately did NOT wrap the E109 anchoring rule in a rationale fence -- verified empirically that fencing would strip it from the exact bundle this floor measures, which would delete the ticket's own deliverable rather than contain its cost. Cap-history ground truth (disputed): the repo's own test-file comment trail shows three prior raises (17984->18303->18369->18570), matching PM's handoff account, not the Wave 2 dispatch card's two-raise account which omits the 18369->18570 bump. Found and fixed one previously-undisclosed, pre-existing, unrelated defect during Phase 4: a malformed 4-column/3-cell Visual Tokens table row in specs/e109-workspace-feature-anchoring.md:144 that was failing test/check-md-tables.test.mjs's real-corpus check (predates T-E109-01; sr-engineer never touched specs/; not caught by code-reviewer's report since it didn't run the full suite) -- fixed with a one-cell addition. Full suite 2100/2100 green, npm run build clean, npm run check:md-tables OK (0 malformed tables). No new test file created -- reasoning in qa_reports/review_T-E109-02.md Scope discipline section. Evidence: qa_reports/review_T-E109-02.md (covers: T-E109-01, T-E109-02). E112-E116 remain unimplemented and out of scope; docs/backlog.md E109/E146 rows left un-done-marked for release-engineer.

