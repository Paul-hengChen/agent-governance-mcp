# Review — T-E142-05

covers: T-E142-01, T-E142-02, T-E142-03, T-E142-04, T-E142-05

## Round 1 — PASS — by qa-engineer

## Summary

Verified T-E142-01 (E147, `scripts/verify-release.mjs`), T-E142-02 (E142+E143+E144+E149-N3,
`content/skill-release-engineer.md`), and T-E142-03 (E149 N1+N2, `content/coord-03-core-fallback.md`)
by EXECUTING every check myself against the live tree and a real, disposable git fixture — not by
reading `review_reports/review_T-E142-04.md`'s conclusions, which was consulted only as an index of
what to re-derive independently. code-reviewer's round-1/round-2 APPROVED verdict is accepted as the
correctness/architecture judgment (out of QA's scope per the SOP); this round supplies independent
execution evidence for every AC, plus the qa-owned AC10/AC12 re-baseline.

**A genuinely new test was authored** (AC1/AC2, `test/verify-release.test.mjs` VR-33/VR-34) reproducing
the original defect's exact shape: a release tag at commit A, a governance-bookkeeping-only commit B
on top (HEAD), and a completed CI run recorded against A's sha only (plus a deliberately-red run
recorded against B's sha, to prove Check 6 never matches or FAILs off it). VR-33 fails against the
pre-fix `git rev-parse HEAD` logic (degrades to WARN, never sees A's run) and passes against the
shipped fix; this is not merely "does not crash" coverage.

**Three collateral test regressions were found and fixed during Phase 4** (`npm test`), none flagged
in the dispatch brief's two named re-baseline targets, all mechanical fallout of T-E142-02's
approved, code-review-APPROVED prose changes landing in files these tests assert against
byte-for-byte. None are defects in the implementation — every one is a stale test assertion
superseded by a ratified decision (E143's `tasks.md` ownership, E142(b)'s range-corrected/four-branch
AC4 check, E142(a)'s renamed E95 bullet). Re-baselined per Constitution §2 (qa-engineer owns every
`test/` edit; sr-engineer was barred from `test/` and never touched it):
- `test/verify-release.test.mjs` VR-9c — asserted step 13a's `git add` still names `tasks.md`; E143
  (AC7, code-review APPROVED) explicitly removed it from that line. Updated the regex + added a
  `doesNotMatch` guard so a regression the other way (tasks.md creeping back into 13a) is now caught.
- `test/release-staging.test.mjs` — AC4's title test + `simulatePostCommitCheck` + Fixtures C/D/H
  hardcoded the pre-E142(b) three-branch, `HEAD~1`-based check. Re-baselined to the shipped
  four-branch (REQUIRE/MULTI-FEATURE/SKIP/UNCLASSIFIABLE), `<prev-tag>..HEAD`-based check; added
  Fixtures I/J/K exercising the new MULTI-FEATURE branch against this repo's own real v3.113.0
  `pending_notes` shape, and widened the exhaustiveness test from 4 to 8 (S×M×W) combinations.
- `test/render-structure.test.mjs` — two E95-bullet-presence assertions matched the literal
  `"CHANGELOG citation check (E95)"` substring; E142(a)'s fix renamed the label to
  `"CHANGELOG citation check (E95, range-corrected — E142(a))"`, which no longer contains that exact
  substring (comma, not a closing paren, after `E95`). Widened the match to `"CHANGELOG citation
  check (E95"`.

AC10/AC12 (mine alone, qa-owned): coordinator-bundle floor re-baselined 18722 -> 18747 (+25), compose-golden
fixture re-baselined, both independently re-measured through the real render path — not trusted from
sr-engineer's or code-reviewer's handoff notes, though both independently reported the same shape.

Full suite: **2119/2119 green** (`npm test`). `npm run build` clean. `npm audit --audit-level=high`
exit 0 (6 findings, all low/moderate, below threshold — unchanged from the last release's own note).
`npm run check:md-tables` — same 4 pre-existing advisories (`docs/backlog.md:165/166/180/181`), zero
new. `git diff --stat -- docs/backlog.md` — empty (zero edits, as required).

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e142-release-tooling-wave25.txt` manifest declared). Confirmed
absent: `ls qa_reports/expected-red_e142-release-tooling-wave25.txt` -> `No such file or directory`.
The ~20 pre-existing root-level `expected-red_*.txt` orphans (present since v3.113.0, per
code-reviewer's note) are untouched by this feature and are not this ticket's manifest.

## Copy Audit Gate / Visual Audit Gate (Phase 3a/3b)

Spec's Visual Tokens / Visual Widgets tables are `N/A` ("feature has no visual literals" /
"feature has no non-primitive widgets") — trivially satisfied, nothing to audit.

Copy/Strings table has four entries, three marked "paraphrase — exact prose is sr-engineer's to
draft" and one (`e149.n1-keying-vs-resolution`) requiring the verbatim quote. Verified against the
actual diffs:
- `e143.tasks-md-ownership` — paraphrase permitted; implementation reads "`tasks.md` is staged and
  committed by SOP step 8, alongside the release's other root metadata paths — never by step 13a
  ...", a faithful paraphrase of the spec's string. PASS.
- `e144.push-u-remedy` — paraphrase permitted; implementation's step 13b remedy names
  `git push -u <remote> <branch>` for the no-upstream FAIL and plain `git push` for the
  ahead-of-upstream FAIL, matching the spec's intent. PASS.
- `e149.n1-keying-vs-resolution` — verbatim required. Implementation's clause: "anchored to
  `workspace_path` for keying — where those paths resolve is a separate concern, see the Worktree
  bootstrap obligation below" — byte-match against the spec's Copy/Strings row (which itself quotes
  code-review's N1 recommendation, `review_reports/archive/e109-workspace-feature-anchoring/review_T-E109-01.md:46`,
  minus the review doc's own markdown italics on "resolve", which the spec's own copy row also
  drops). PASS, verbatim.
- `e149.n3-note-suffix` — the ` (<tagSha12>..<headSha12>)` suffix is present, appended to the
  existing NOTE quote at `content/skill-release-engineer.md:229`. PASS.

No coverage-gap findings: no new user-facing string was introduced outside these four.

## Phase 1.5 — Visual Compare

Skipped (no `design/e142-release-tooling-wave25.md`, no Visual Baselines declared).

## Correctness — AC-by-AC (independently re-derived, not inherited from review_T-E142-04.md)

**AC1/AC2 — PASS.** Read `scripts/verify-release.mjs`'s Check 6 directly: `releaseSha` now resolves
via `git rev-parse --verify --quiet refs/tags/v${version}` + `git rev-list -n 1 v${version}` (the
same two-call pattern Check 1 uses), falling back to `git rev-parse HEAD` in the `catch` only. Wrote
and ran a new fixture (`test/verify-release.test.mjs` VR-33) reproducing the exact defect shape — tag
at commit A, bookkeeping-only commit B on top (HEAD), a CI run recorded against A's sha only plus a
deliberately-red run against B's sha — asserting Check 6 resolves/matches A and never surfaces B's
red run. VR-34 pins AC2's unchanged pre-tag fallback with a real gh shim matching HEAD's own sha (not
just "does not crash", which VR-1/VR-8 already covered). Both green against the shipped code.

**AC3 — read, not proof-annotated (per spec).** Read SOP step 8's CHANGELOG citation check directly:
now derives `PREV_TAG=$(git describe --tags --abbrev=0)` and checks the UNION of
`git diff $PREV_TAG..HEAD --name-only` and `git diff --cached --name-only`, never `--cached` alone.
Sanity-checked against the cited historical v3.111.0 shape: `git show 3ef72c2:.current/handoff.md`'s
FINDING 2 note states, in this repo's own history, "35 of 41 cited paths ... flagged [under --cached
alone] ... Verified against the correct denominator instead (git diff --name-only v3.110.0..HEAD, 91
files): 39 of 41 citations are genuine release changes" — an exact match to the spec's cited 35/41
vs. 39/41 figures. Structural check: `git diff --name-only $PREV_TAG..HEAD` is, by construction, a
superset of `git diff --cached --name-only` at the release commit (the release commit is itself one
element of that range), so the union-based fix can only ever find MORE citations than `--cached`
alone, never fewer — consistent with 39 >= 35. PASS (read).

**AC4 — PASS.** `sed -n '221,225p' content/skill-release-engineer.md | grep -c "HEAD~1"` -> `0`
(scoped to the AC4 branch block; the one whole-file `HEAD~1` hit, at the D10 push-rejection incident
narrative, is unrelated prose about `git reset HEAD~1`, not this check). Read all four branches
(REQUIRE/MULTI-FEATURE/SKIP/UNCLASSIFIABLE) directly against `git diff <prev-tag>..HEAD --name-only`.
Re-baselined `test/release-staging.test.mjs`'s AC4 title test + `simulatePostCommitCheck` + Fixtures
C/D/H/exhaustiveness (see Summary) and added Fixtures I/J/K for the new MULTI-FEATURE branch — all
green (80/80 in that file).

**AC5 — read, not proof-annotated (per spec).** Read the MULTI-FEATURE branch: for each named feature
in `pending_notes`'s `"Multi-feature release: ..."` shape (stripping trailing parentheticals), checks
`specs/<feature-N>.md` against the range if it exists in the tree, logs-and-skips if it doesn't
(E142(b) Decision). Sanity-checked against BOTH cited historical shapes: (a) v3.113.0's own real
`pending_notes` (`git log -p -S "Multi-feature release:" -- .current/handoff.md`) —
`"Multi-feature release: e109-workspace-feature-anchoring (E109+E146), e145-md-tables-cited-donemark,
e148-stamp-provenance-test-flake."` — confirmed the branch's parenthetical-stripping example
(`e109-workspace-feature-anchoring (E109+E146)` -> `e109-workspace-feature-anchoring`) is this exact
literal string, not invented; confirmed `specs/e109-workspace-feature-anchoring.md` exists while
`specs/e145*.md`/`specs/e148*.md` do not (`ls specs/ | grep -iE "e109-workspace|e145|e148"`), i.e. the
real tree already exercises the "spec exists" and "no spec, logged-and-skipped" sub-cases side by
side. (b) v3.111.0's own real closing note (`git show 3ef72c2:.current/handoff.md` FINDING 3) —
"active_feature names only the last of ~9 features... Fired SKIP with a logged justification" —
confirms the spec's characterization of the old ad hoc SKIP-fallthrough behavior. New Fixtures I/J/K
in `test/release-staging.test.mjs` encode this exact v3.113.0 shape behaviorally. PASS (read + behavioral fixture).

**AC6 — PASS.** `grep -c "expected-red_<active_feature>" content/skill-release-engineer.md` -> `0`.
Read the generalized sweep: iterates every `qa_reports/expected-red_*.txt`, diffs each against
`$PREV_TAG`'s tree (same membership-baseline technique as the `<CODES>`/`covers:` sweeps), and moves
new-since-`$PREV_TAG` files into their OWN feature's archive dir derived from the filename's
`<feature>` token — never hardcoded to `<active_feature>` alone.

**AC7 — PASS.** `grep -n "tasks.md" content/skill-release-engineer.md` shows `tasks.md` in step 8's
`git add`/pathspec lines (:203, :208) and the new Artifact-ownership bullet (:42); confirmed absent
from step 13a's block via `sed -n '242,253p' content/skill-release-engineer.md | grep -c "tasks\.md"`
-> `0`. Line :265's "Expected vs unrelated scope rule" now reads "explicit non-STOP exclusions from
THIS STOP-on-unrelated-uncommitted-changes rule only (E71c)" with an explicit "says nothing about
which commit stages or owns either path (E143)" disclaimer — all three sites (:41/:232/:265)
disambiguated consistently, not just :232. Found and fixed the one collateral test regression this
decision produced: `test/verify-release.test.mjs` VR-9c hardcoded the pre-fix `git add` line
(see Summary).

**AC8 — PASS.** `grep -n "push -u" content/skill-release-engineer.md` -> one match inside step 13b's
remedy (:254), distinguishing the no-upstream-configured FAIL (needs `-u`) from the
already-configured-but-behind FAIL (plain `git push` still correct).

**AC9 — read, not proof-annotated (per spec).** `git diff` on `content/coord-03-core-fallback.md`
shows the N1 clause is a subordinate addition to the existing sentence — it does not delete or
contradict the AC1(a) mechanism list from the e109-workspace-feature-anchoring spec, and it is not a
restatement of the very next paragraph's E111 Worktree bootstrap obligation. Cross-checked verbatim
against `review_reports/archive/e109-workspace-feature-anchoring/review_T-E109-01.md:46`'s N1
recommendation ("anchored to `workspace_path` for keying — where those paths *resolve* is a separate
concern, see the Worktree bootstrap obligation below") — the shipped clause matches exactly, modulo
the review doc's own markdown italics on "resolve" (which the spec's Copy/Strings table, the AC's own
authoritative wording source, also does not carry). PASS (read).

**AC10 — PASS (mine, see AC Execution Log).** `(E109)` unwrapped -> now wrapped in
`<!-- origin:start -->`/`<!-- origin:end -->`, matching 5 of 6 same-shape provenance codes in the
file (the pre-convention `(E1)` untouched, per spec). Independently re-derived the composed, stripped
bundle (`composeConstitution` -> `stripOriginTags` -> `stripRationale` for the constitution side;
`composeSkill("skill-coordinator.md", ...)` -> `stripOriginTags` -> `stripRationale` for the skill
side, matching `buildPromptForRole`'s own order) and confirmed the literal substring `(E109)` is
absent from it.

**AC11 — PASS.** `grep -n "tolerated N governance-bookkeeping" content/skill-release-engineer.md` ->
the matched line (:229) now also contains the literal `(<tagSha12>..<headSha12>)`, matching
`scripts/verify-release.mjs`'s actual Check 1 success-path `console.log`.

**AC12 — PASS (mine, see AC Execution Log and dedicated section below).**

## Spec-to-Test map

| AC | test(s) |
|---|---|
| AC1/AC2 | `test/verify-release.test.mjs` VR-33 (new), VR-34 (new); VR-1/VR-8 (existing, tag-missing regression) |
| AC3 | read (no proof: per spec) |
| AC4 | `test/release-staging.test.mjs` AC4 title test, Fixtures C/D/H, exhaustiveness (re-baselined); Fixtures I/J/K (new, MULTI-FEATURE) |
| AC5 | read (no proof: per spec) + `test/release-staging.test.mjs` Fixtures I/J/K (new, behavioral) |
| AC6 | grep (`content/skill-release-engineer.md`) |
| AC7 | grep + `test/verify-release.test.mjs` VR-9c (re-baselined) |
| AC8 | grep (`content/skill-release-engineer.md`) |
| AC9 | read (no proof: per spec) |
| AC10 | grep/node-eval against the composed, stripped bundle; `test/skill-manifest.test.mjs` golden fixture (re-baselined) |
| AC11 | grep (`content/skill-release-engineer.md`) |
| AC12 | `test/context-budget.test.mjs` (re-baselined) |

## AC Execution Log (Phase 3.5 — proof:-annotated ACs)

| AC | proof command | output | verdict |
|---|---|---|---|
| AC1 | `node --test test/verify-release.test.mjs` (new fixture VR-33: tag at A, bookkeeping commit B at HEAD, CI run recorded against A only + a red run against B) | `ok - VR-33 ...`; exit 0 | PASS |
| AC2 | `node --test test/verify-release.test.mjs` (existing tag-missing fixtures VR-1/VR-8 unmodified; new fixture VR-34: no tag yet, gh shim matches HEAD) | `ok - VR-34 ...`; all 46/46 pass | PASS |
| AC10 | `node --input-type=module -e '...compose+strip via dist/prompts/build.js + dist/prompts/skill-manifest.js...'` | `contains literal (E109): false` | PASS |
| AC12 | `node --test test/context-budget.test.mjs` (floor updated 18722 -> 18747) | `54/54 pass` | PASS |

Not proof-annotated but executed regardless as part of Phase 4: full suite (`npm test`) 2119/2119;
`npm run build` clean; `npm audit --audit-level=high` exit 0; `npm run check:md-tables` ->
`OK (250 file(s) scanned, 0 malformed tables)` with the same 4 pre-existing advisories at
`docs/backlog.md:165/166/180/181`; `git diff --stat -- docs/backlog.md` empty.

## AC10/AC12 — Compose-golden + context-budget re-baseline (qa-owned)

Before any of my own edits, `node --test test/*.test.mjs` reported exactly one collateral red on top
of the two named targets (see Summary for the third, VR-9c, found in the same run):
- `test/context-budget.test.mjs` subtest — measured **18747** ~tok vs the pre-feature floor **18722**
  (+25 net). N1 (subordinate clause) adds prose; N2 (wrapping `(E109)`) simultaneously removes bytes
  the strip pass now eats — net delta is smaller than N1 alone, as the brief warned, and had to be
  derived, not assumed.
- `test/skill-manifest.test.mjs` subtest 4 (`t-golden-byte-identity`) — the frozen golden fixture
  predates N1/N2.

Independently re-measured through the real render path (not trusted from sr-engineer's or
code-reviewer's handoff notes, though both independently reported the same shape):
- Composed, stripped coordinator bundle: `composeConstitution({chain:true,design:true})` ->
  `stripOriginTags` -> `stripRationale` (constitution side) + `composeSkill("skill-coordinator.md",
  hostCapabilitiesFor("claude-code"))` -> `stripOriginTags` -> `stripRationale` (skill side), joined
  by the same `SEP` the test uses -> **74987 chars = 18747 ~tok** (exact). Cap raised 18722 -> 18747
  (+25) in `test/context-budget.test.mjs`, set to the exact measured value (no headroom), per the
  file's own established Phase-2 convention.
- Confirmed on the same measurement, both required properties simultaneously (spec AC12's own
  requirement, echoing code-reviewer's independent 69,706-char composition): the bundle's
  skill-coordinator.md body no longer contains the literal substring `(E109)` (AC10), while N1's
  qualifying clause ("anchored to `workspace_path` for keying — where those paths resolve is a
  separate concern, see the Worktree bootstrap obligation below") verbatim survives the strip pass
  (AC9) — i.e. the rationale-fence route was correctly NOT used (it would have deleted N1's clause
  from this exact stripped bundle, per the e109-workspace-feature-anchoring lane's own review notes,
  cited in the brief and independently re-confirmed here: the clause carries no `rationale:`/`origin:`
  fence of its own, only the `(E109)` provenance code is origin-fenced).
- Golden fixture (`test/fixtures/compose-golden/skill-coordinator-monolith.txt`, the UNSTRIPPED
  full-capability monolith): re-generated via the exact same `composeSkill("skill-coordinator.md",
  hostCapabilitiesFor("claude-code"), readContent)` call the test uses; `diff` against the prior
  fixture showed exactly the one expected line changed (the Anchoring-rule sentence, gaining both the
  origin-tag wrap and the N1 clause) — 38579 -> 38726 chars (+147, the raw/unstripped delta; this
  fixture is never stripped, so it still contains the literal `(E109)` inside the origin-tag markers
  by design). `node --test test/skill-manifest.test.mjs` -> 28/28 pass.

## Collateral test regressions (found + fixed, Phase 4)

None are implementation defects — every one is a stale assertion superseded by a code-review-APPROVED,
spec-ratified decision. Per Constitution §2, qa-engineer owns every `test/` edit; none of these
required a round with sr-engineer.

1. **`test/verify-release.test.mjs` VR-9c** — asserted `git add -- .current/handoff.md tasks.md
   $JSONL` (step 13a). E143/AC7 (code-review APPROVED, rounds 1+2) removed `tasks.md` from that line
   by ratified decision (step 8 owns it). Updated the regex to `git add -- .current/handoff.md
   $JSONL` and added a `doesNotMatch` guard against the old form re-appearing.
2. **`test/release-staging.test.mjs`** — AC4's title test, `simulatePostCommitCheck`, and Fixtures
   C/D/H hardcoded the pre-E142(b) three-branch check keyed on `git diff HEAD~1 --name-only` and the
   old STOP-string wording. E142(b)/AC4-AC5 (code-review APPROVED) replaced this with a four-branch
   check (REQUIRE/MULTI-FEATURE/SKIP/UNCLASSIFIABLE) keyed on `git diff <prev-tag>..HEAD
   --name-only`. Re-baselined the constants/function/fixtures to the new shape; added Fixtures I/J/K
   exercising MULTI-FEATURE against this repo's own real v3.113.0 `pending_notes`; widened the
   branch-exhaustiveness test from 4 to all 8 (specExistsInTree × recordsMultiFeature ×
   recordsMiniChain) combinations, matching code-reviewer round 2 F1's re-derivation
   (REQUIRE=S∧¬M, MULTI-FEATURE=M, SKIP=¬S∧¬M∧W, UNCLASSIFIABLE=¬S∧¬M∧¬W).
3. **`test/render-structure.test.mjs`** — two assertions matched the literal substring
   `"CHANGELOG citation check (E95)"`. E142(a)/AC3 (code-review APPROVED) renamed the label to
   `"CHANGELOG citation check (E95, range-corrected — E142(a))"` — a comma, not `)`, follows `E95`
   now, so the old substring no longer matches. Widened both assertions to `"CHANGELOG citation check
   (E95"`.

All three confirmed green individually and as part of the full suite (`npm test` 2119/2119).

## Trap check (per dispatch brief)

`npm run check:md-tables` -> `OK (250 file(s) scanned, 0 malformed tables)`, with exactly the same 4
advisory findings at `docs/backlog.md:165/166/180/181` as before this feature — zero new, zero
resolved. `git diff --stat -- docs/backlog.md` — empty; zero edits to `docs/backlog.md` in this
feature, including its E145 row.

## Scope boundaries — confirmed untouched

`git status --short` / `git diff --stat` show no changes under `schema/`, `tools/`, `index.ts`,
`docs/schema-versions.md`, or `docs/backlog.md` in this feature's working tree. This feature's own
`test/` edits are all mine (qa-engineer), per Constitution §2 and the dispatch brief's pre-authorization.

## Verdict

**PASS** — T-E142-01, T-E142-02, T-E142-03, T-E142-04, T-E142-05. Full suite 2119/2119 green,
`npm run build` clean, `npm audit --audit-level=high` exit 0, `check:md-tables` unchanged, zero
`docs/backlog.md` edits.
## 2026-09-18T09:48:50.939Z — PASS — by qa-engineer

PASS. Verified T-E142-01/02/03 by executing, not reading diffs. AC1/AC2: new fixture (test/verify-release.test.mjs VR-33/VR-34) reproduces the original defect shape (tag at A, bookkeeping commit B at HEAD, CI recorded against A only + a red run against B) and proves Check 6 resolves/matches A, never B; pre-tag fallback pinned too. AC3/AC5/AC9 read against cited historical shapes (v3.111.0/v3.113.0 real handoff history) and recorded. AC4/AC6-AC8/AC11 grep-verified exactly per the spec's commands. AC10/AC12 (mine): coordinator-bundle floor re-baselined 18722->18747 (+25), compose-golden fixture re-baselined, both independently re-measured through the real render path; confirmed (E109) literal gone AND N1's clause survives the strip pass simultaneously. Found+fixed 3 collateral test regressions (not defects, all superseded-by-ratified-decision fallout): verify-release.test.mjs VR-9c (tasks.md dropped from 13a's git add per E143), release-staging.test.mjs's AC4 fixtures/exhaustiveness (four-branch/<prev-tag>..HEAD per E142(b), added MULTI-FEATURE fixtures I/J/K), render-structure.test.mjs's E95-bullet substring match (renamed label per E142(a)). Full suite 2119/2119 green, npm run build clean, npm audit --audit-level=high exit 0, check:md-tables unchanged (same 4 advisories, docs/backlog.md zero edits). Evidence: qa_reports/review_T-E142-05.md (covers T-E142-01..05).

