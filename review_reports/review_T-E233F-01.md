# Review — T-E233F-01

covers: T-E233F-01, T-E233F-02, T-E233F-03

## Round 1 — APPROVED — by code-reviewer

Diff reviewed: `58dfd33..c4a5283` on `feat/e233f-content-ids`, `content/*.md` (11 files, 48 lines changed, 48 added / 48 removed per file pair) plus the lane's expected-red manifest. Contract: `specs/e233f-content-ids.md` AC1–AC12 and the Information hygiene / Generic citation bullets of `content/const-15-core-tail.md`. No architecture spec exists for this feature.

## Summary
- This round rewords sole-explanation ticket-id references in `content/` into plain words. The id is kept as a trailing pointer. Files touched: skill-release-engineer (35 spans), const-08, coord-03/04/06, skill-pm, skill-sr-engineer, skill-architect, skill-integrator, skill-qa-engineer, and constitution-rationale.
- The mechanical constraints all check out, independently re-run. The results are AC6 `uneven=0`, AC7 `0`, AC8 `skeleton-mismatch=0`, all five AC4 pinned strings `ok`, and an AC12 scope grep that prints nothing.
- Full suite at c4a5283, test-lock wrapped and re-run by this reviewer: 2958 tests, 2948 pass, 7 fail, 3 skipped. The 7 failures match `qa_reports/expected-red_e233f-content-ids.txt` exactly. `test/context-budget.test.mjs` is green.
- No rule meaning changed. Each reworded span was read in context against the backlog row it points to.
- Verdict: APPROVED. There are no required findings. Four optional notes follow.

## AC Completeness
AC1 — implemented. Every edited span was read in context (word-diff over `58dfd33..c4a5283`). This reviewer also listed every visible id at HEAD, outside origin/rationale tags, fences and code spans: 232 tokens across `content/*.md`, 147 of them in skill-release-engineer. The survivors are trailing or parenthetical pointers beside plain words, such as `(E50)`, `(E14/E78/E80)`, `(v3.58.0, C18)` and `(C4, C14, A10, A11)`. Some are labels followed by their own explanation, such as `**AC4 opt-back-in**:`, `**AC6 escape**:`, `**F1**:` and `Reason (D10, generalized): …`. The rest are the file's own step labels (skill-qa-visual B0/B1/B2) or an example id (coord-01 `F0`). No remaining line was found where an id is the only explanation. Borderline pointers were judged acceptable: skill-release-engineer:47 `(E64 judgment call, …)`, :229 `E163's first half (…)`, :236 `post-E141` and :286 `as of E84 (SOP step 13a)`.
AC2 — implemented. Origin tags are pure `(vX, Eyy)` pointers and were left alone. The prose rationale blocks (skill-release-engineer E82 (ii) maintenance note, pre-E49, E104 note, E95 check, E84; constitution-rationale B6 / A0) were rewritten under AC1.
AC3 — implemented. The skeleton check confirms fences and the code-span multiset are byte-identical. No key, enum or error code was touched.
AC4 — implemented. All five proof strings print `ok`. This reviewer grepped `test/` for every removed phrase (48 probes). The matches (`E1/E1A/E13`, `header lineage`, `pre-D2`, `N4 hazard`, `F2's`, `E71(b)`, `E71b's`, `pre-E49`, `D10 Hard rule`, `E1 feature lease`) are all test names, assertion messages, comments, or historical `ffa4082` excerpt literals in render-structure. None is an `includes()` or regex assertion against live `content/` text. The one live pin in that set, feature-lease:1789-1790 `**CRITICAL — STOP on push rejection / concurrent-release collision** (D10)`, sits on an untouched line; the edited `D10 Hard rule` occurrence is at skill-release-engineer:262. The full suite has no red outside the manifest, which confirms this.
AC5 — implemented. Byte deltas after stripping origin/rationale: const-08 0, coord-03 -1, coord-04 0, coord-06 -4, skill-pm -5, skill-sr-engineer -6, skill-architect -2. The files that grew (skill-release-engineer +554, constitution-rationale +60, skill-qa-engineer +28, skill-integrator +11) are not under a size ceiling. `test/context-budget.test.mjs` passes and is untouched.
AC6 — implemented — `uneven=0`.
AC7 — implemented — every removed line contains an id token (count `0`).
AC8 — implemented — `skeleton-mismatch=0`.
AC9 — implemented (not in this round's scope). T-E233F-04 owns it. No `test/` file is in this diff.
AC10 — implemented (not in this round's scope). T-E233F-04 owns the golden regen. The 7 expected reds are recorded.
AC11 — implemented (not in this round's scope). The verifier runs it on the final HEAD. It is currently red only on the 7 manifest entries.
AC12 — implemented. The scope grep over `58528d5...HEAD` prints nothing.

## Correctness
No required findings. Each rewording was checked against its source:
- coord-03 `the mismatch signal (E99)`, coord-04 `explicit model dispatch (E103)` and coord-06 `old hand-sum (B9)`: the meaning is preserved.
- skill-integrator:133 `five verifier constraints (E192)`: matches backlog E192, "a fresh-context generic read-only verifier … five constraints".
- skill-release-engineer:225 `the workspace-anchoring decision … E109`: matches E109, the workspace/feature Anchoring rule.
- :231 `this CI gate (E163)`: 8b is the CI gate E163 introduced.
- :218 `CHANGELOG citation (E95)`: matches E95.
- constitution-rationale:87 `late-armed gate (B6)`: matches :71 B6 "gate armed late".
- constitution-rationale:223 `never-fired oversized-task gate (A0)`: matches :90.
- skill-qa-engineer:79 `Specs without proof annotations (pre-E3)`: E3 introduced executable ACs. The new wording describes the branch condition more accurately than before.
- skill-architect:75 `the visual gate (R1) cannot pass`: sits inside the Visual Harness Gate step, so it is consistent.

Expected-red sampling (step 4a): the manifest exists with 7 entries. All 7 were located as real test names. Each also appears verbatim as a `not ok` line in this reviewer's own suite run (compose-equivalence 255–258, 260, 261; skill-manifest 2490).

- optional (O1) — `content/skill-release-engineer.md:26` (`inside a note about another ticket (E104)`, in the pinned-held `Reason (E17 forensics)` line — reword only the unpinned span): true but carries little meaning. Backlog E104 now names an unrelated repo-reset row, so the pointer alone will mislead a tracer. Something like `a v3.107.0 context note (E104)` would say more.
- optional (O2) — `content/skill-release-engineer.md:196` (`the wording before the rescoping (pre-E49)`): E49 was the multi-ticket evidence-archival fix to step 7a. "the rescoping" is a loose gloss. `before the multi-ticket archival fix (pre-E49)` would be exact.

## Quality
- optional (O3) — `content/skill-release-engineer.md:55`: `a once hand-run rebase, D5, promoted to SOP` reads awkwardly (the comma-wrapped id sits mid-clause). It is equally clear either way. This is a style note only.
- optional (O4, pre-existing, not introduced here) — `content/skill-release-engineer.md:249` cites `the E76/E71b zsh-NOMATCH rule at :143 and the E71a existence-pre-filter at :196`. Those rules now sit at :145 and :207. Line counts are unchanged by this lane (AC6), so these references were already stale at base. Per the spec's Out of Scope, file this in `.current/e233f/pending-tickets.md`. Do not fix it in place.

Out-of-task file (brief item e): `content/skill-architect.md` appears in no task line, but it is in scope. AC1 covers "any … sentence in `content/*.md`". AC12 permits every path under `content/`. skill-architect is a size-measured partial-adopting skill (context-budget PARTIAL_ADOPTING_SKILLS), and its net delta is -2 bytes. Folding it into T-E233F-03 is a ledger-wording gap, not a scope breach.

Same-model note: sr-engineer ran on the fable tier and this review ran on opus, so the models differ. No same-model bias is suspected.

## Architecture
No architecture spec exists for this feature. The change is content-only. The compose pipeline, manifests and strip passes are unchanged.

## Security
No findings. The Information hygiene check (const-15) finds no internal URLs, client codenames, absolute paths or credentials in any added span. The expected-red manifest uses only relative test paths.

## Performance
No findings. The change is prose-only. The composed prompt bytes for capped roles are equal or smaller. The uncapped release-engineer SOP grows by 554 bytes (about 0.6%).

## Verdict
APPROVED — all hard constraints (AC4–AC8, AC12) verify independently, no sole-explanation id remains, rule meaning is unchanged, and the only reds are the 7 manifest-listed golden tests that T-E233F-04 regenerates.
