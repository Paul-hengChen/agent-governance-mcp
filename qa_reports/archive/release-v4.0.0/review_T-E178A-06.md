# Review — T-E178A-06, T-E178A-07 (+ Phase 4 verdict: T-E178A-01..07)

covers: T-E178A-01, T-E178A-02, T-E178A-03, T-E178A-04, T-E178A-05, T-E178A-06, T-E178A-07

Spec: `specs/e178a-integrator-role.md` (AC1–AC17). Code review (T-E178A-01..05):
`review_reports/review_T-E178A-01.md`, Round 2 **APPROVED** (commit f059694, delta
`c682e8c..87ad706`). No architect hop (spec-justified: no new data model, no
cross-cutting API). Reviewer model: opus; sr-engineer ran on fable (dispatch pin
`{"sr-engineer": "fable"}`); qa ran on sonnet (this review).

## Expected-Red Diff

`qa_reports/expected-red_e178a-integrator-role.txt` exists (16 intentional reds:
compose-equivalence ×11, context-budget ×4, skill-frontmatter ×1). Ran the full
suite on HEAD (3495794, pre-fix) via `node scripts/test-lock.mjs -- npm test`:
**2795 tests, 2779 pass, 16 fail.**

Diffed the 16 actual failing test names against the manifest's 16 entries:

- not ok 250–260 (11): `compose-equivalence: buildPromptForRole(...)` × 8 +
  SessionStart hook × 2 + `cat(15 manifest fragments...)` × 1 — all 11 match
  the manifest's compose-equivalence group verbatim.
- not ok 293, 316, 317, 329 (4): `context-budget.test.mjs` AC2 lean, AC8
  design-arm, teamwork bundle, AC8 non-design — all 4 match the manifest's
  context-budget group verbatim.
- not ok 2321 (1): `every content/skill-*.md carries a valid recommended_model
  frontmatter` — matches the manifest's skill-frontmatter group verbatim.

**Disposition: clean (16/16 manifest entries confirmed red, 0 unexplained
reds).** No entry required disposition beyond "matches the manifest as
written" — every one is the direct, expected consequence of the §6
const-15-core-tail.md amendment (T-E178A-03, already code-reviewer APPROVED)
shifting every composed bundle's byte content and token count, plus the new
`content/skill-integrator.md` shifting the skill-file count. No stray red
outside the 16 — no regression, proceeded to Phase 1/3.

## Phase 1 — Review (T-06/T-07 scope; T-01–05 already code-reviewer APPROVED)

T-01–05 (SOP content, §6 amendment, prompt registration, docs/lane-protocol.md,
`.claude/` retirement) are code-reviewer APPROVED (Round 2, both required
findings R1/R2 closed, no open findings) — not re-litigated here. QA's own read
of `content/skill-integrator.md`, `content/const-15-core-tail.md`,
`docs/lane-protocol.md`, `tools/fanout-manifest.ts`, `CLAUDE.md`/`AGENTS.md`,
`prompts/integrator.ts` and `tools/registry.ts` (during T-07 test authoring,
below) independently confirms every AC1–AC16 anchor cited in the code
review is present verbatim at HEAD — no drift between the approved review and
the committed content.

**Copy Audit Gate**: spec's Copy/Strings table (4 entries: `prompt.integrator.name`,
`prompt.integrator.description`, `sop.watermark`, `protocol.task-id`) — all four
verified verbatim in `tools/registry.ts` (description), `content/skill-integrator.md`
(watermark), `docs/lane-protocol.md` (task-id rule). No drift, no coverage gap.

**Visual Audit Gate**: spec's Visual Tokens/Widgets tables are both `N/A —
feature has no visual literals / no non-visual widgets`. Skipped, zero overhead.

**Phase 1.5 — Visual Compare**: `design/e178a-integrator-role.md` does not exist
(spec confirms: "no `design/<feature>.md`, mode = no-design"). Skipped
(`Phase 1.5: skipped (no Visual Baselines declared)`).

## T-E178A-06 — qa re-baseline (own work this hop)

**Golden regeneration** (`node scripts/capture-constitution-golden.mjs`, one pass,
12 fixtures captured): 11 of 12 fixtures changed (`skill-coordinator-monolith.txt`
unchanged — this feature touches no `coord-*.md` fragment, only
`const-15-core-tail.md`, which composes into the constitution-side fixtures only).
Every changed fixture (`build-{lite,full}-{design,nondesign}{,-fd}.txt`,
`hook-{lite,full}.txt`, `constitution-monolith.txt`) carries the **identical
single hunk**: the §6 addition landing verbatim —

```
+  as is `git fetch` (updates only remote-tracking refs, never a local branch or the working tree). Reason (D10, generalized): ...
+  - `git commit --amend` is FORBIDDEN for all roles: ...
+  - **Integrator-only grant**: only the `integrator` role may also run `git merge --no-ff`, ...
+  - **Tool-internal ops** of `agc feature start` / `agc feature finish` ...
```

confirmed identical across all 11 changed files (`git diff --stat` shows
`5 ++++-` on every one; verified the `+` line count is 5 on each). This is
**exactly** the T-E178A-03 §6 amendment already code-reviewer APPROVED — no
new/unexplained hunk anywhere in the 11 diffs.

**Context-budget floors** — raised ONLY the 4 red ones (per plan §2.2; no other
floor touched):

| test | old cap | new cap | delta | measured (real render path) |
|---|---|---|---|---|
| AC2 lean always-on | 4912 | 5157 | +245 | 5157 ~tok exact |
| AC8 design-arm stripped constitution | 9421 | 9666 | +245 | 9666 ~tok exact |
| AC8/AC-P2-7 teamwork coordinator bundle | 19799 | 20044 | +245 | 20044 ~tok exact |
| AC8 non-design constitution | 7323 | 7569 | +246 | 7569 ~tok exact |

All four deltas are ~245/246 tok — `const-15-core-tail.md` is core (untagged
chain/design), so the identical addition lands on every measured bundle once;
the 1-tok wobble on the non-design row is ordinary `Math.ceil` rounding drift,
not a design-only-fence regression (design-arm − non-design saving stays
9666 − 7569 = 2097, within 1 of the prior 2098 invariant). Values independently
re-measured by qa via the real `composeConstitution`/`stripRationale`/
`stripOriginTags`/`buildPromptForRole` pipeline (not trusted from sr-engineer's
or code-reviewer's handoff notes) — and match the exact figures code-reviewer
independently reported in `review_reports/review_T-E178A-01.md` Round 2
Performance section (lean 5157, design-arm 9666), corroborating cross-check.
Cap set to the exact measured value each time, no headroom, per the
established Phase-2 convention. Comments added at each site cite E178a.

**`test/release-staging.test.mjs`**: removed `.claude/` from `NON_SOURCE_DIRS`
(AC16 qa half) — `git ls-files .claude` returns empty (interim
`.claude/commands/integrator.md` deleted by T-05). The Partition test does not
require the entry (it only checks *tracked* top-level dirs are covered, never
flags an over-classified stale entry), but the spec's own AC16 proof + T-06's
task text call for its removal, so it is removed with a comment explaining why
and what would re-arm it (a new tracked path under `.claude/`).

**`test/skill-frontmatter.test.mjs`**: skill-file count 11 → 12 (Q6 grant —
qa-only, mechanical count edit). `content/skill-integrator.md` is a genuinely
new skill file (not a reversion of the T-D6-04 `skill-coordinator.md` split);
comment updated to explain both historical deltas (12→11 at T-D6-04, 11→12
here).

**Contingency check** (per dispatch brief): `test/skill-evolution-v3.11.test.mjs`,
`test/render-structure.test.mjs`, `test/skill-manifest.test.mjs` — all three ran
green with zero edits (50/50, part of the full suite; independently re-run
standalone: 50/50 pass). No fix needed; the manifest's "if red" contingency
did not trigger.

**No test beyond the manifest's 16 was red at any point** — the STOP condition
(`test/e92-e86-handoff-write-boundary.test.mjs`, `test/e43-*` corpus sweeps, or
any other content/*.md sweep) never fired; not consulting the integrator before
regenerating was therefore correct per the dispatch brief.

## T-E178A-07 — test/e178a-integrator-role.test.mjs (own work this hop)

Authored `test/e178a-integrator-role.test.mjs`: 17 tests, one per AC, named
`AC1`…`AC17` (prefix convention per dispatch brief so the spec's own
`--test-name-pattern "AC<n>"` proof commands select them). Content-assertion
style (reads the shipped SOP/const-15/lane-protocol/fanout-manifest/CLAUDE.md/
registry directly), matching the `test/e130-lane-default.test.mjs` precedent —
independent of the sr-engineer/code-reviewer claims already on record.

**D11 coverage**: `AC4` asserts `git diff 3c72a83 -- tools/role.ts
tools/transitions.ts` is byte-empty AND neither file's raw text contains the
substring `integrator` — the enums / `ROLE_SKILL_MAP` were never touched, and
the SOP's own governance-state clause (never `tw_update_state`, never write
lane `.current/<lane>/`, read-only tools only) is asserted verbatim.

Spec-to-Test map: AC1→`AC1` … AC17→`AC17` (1:1, no ACs pinned elsewhere by the
spec's own proof: lines for this feature — unlike e130, every AC here has its
own `proof:` annotation).

## AC Execution Log

Every spec AC carries a `proof:` annotation (AC1–AC17). Executed each verbatim
against the committed branch (bb151d7), full output below.

| AC | command | result |
|---|---|---|
| AC1 | `node --test --test-name-pattern "AC1" test/e178a-integrator-role.test.mjs` | 9 tests, 9 pass, 0 fail (AC1 + AC10–17 regex-overlap, all pass) |
| AC2 | `node --test --test-name-pattern "AC2" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC3 | `node --input-type=module -e 'import {PROMPT_REGISTRY as R} from "./dist/tools/registry.js"; console.log(R.length, JSON.stringify(R.at(-1)))'` | printed `12 {"name":"integrator","description":"Integrator — plan parallel lanes, pre-review cuts, verify lane reports, merge, tear down. Cross-lane; writes no handoff state.","arguments":[...],"skillFile":"skill-integrator.md"}` — matches spec exactly |
| AC4 | `git diff --quiet 3c72a83 -- tools/role.ts tools/transitions.ts && ! grep -n integrator tools/role.ts tools/transitions.ts; echo exit=$?` | printed `exit=0` — matches spec exactly |
| AC5 | `grep -c "12 registered role prompts\|Twelve prompts are registered" CLAUDE.md` | printed `2` — matches spec exactly |
| AC6 | `node --test --test-name-pattern "AC6" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC7 | `node --test --test-name-pattern "AC7" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC8 | `node --test --test-name-pattern "AC8" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC9 | `node --test --test-name-pattern "AC9" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC10 | `node --test --test-name-pattern "AC10" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC11 | `node --test --test-name-pattern "AC11" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC12 | `node --test --test-name-pattern "AC12" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC13 | `node --test --test-name-pattern "AC13" test/e178a-integrator-role.test.mjs` | 1/1 pass |
| AC14 | `grep -n 'T-<票號>-NN\|T-<ticket>-NN' docs/lane-protocol.md` | printed `36:- **lane 的 task id 一律是 \`T-<ticket>-NN\`**（票號大寫、兩位數序號，例如 \`T-E178A-01\`）。理由：...` — ≥1 line in §3, matches spec |
| AC15 | `! grep -n "commands/integrator" docs/lane-protocol.md tools/fanout-manifest.ts && git diff 3c72a83 -- tools/fanout-manifest.ts \| grep '^[-+][^-+]' \| grep -v '^\s*[-+]\s*\*\|^[-+]\s*//' ; echo exit=$?` | grep found no `commands/integrator` hits (both files); the final `grep -v` printed nothing (all changed lines are comment-only) so it exits 1, giving `exit=1` — this IS "shows comment-only changes" (zero non-comment lines survive the filter); independently confirmed via the `AC15` unit test's `nonCommentLines` array, which is empty |
| AC16 | `git ls-files .claude` then `node --test --test-name-pattern "Partition" test/release-staging.test.mjs` | `git ls-files .claude` printed nothing (empty); Partition test 1/1 pass |
| AC17 | `npm test` on the committed branch, clean tree | **2812/2812 pass, 0 fail** (see Phase 4 below) |

No proof command failed or produced an outcome contradicting its AC text —
no Phase 4 FAIL triggered by this log.

## Phase 4 — Run

- **Build**: `npm run build` — zero errors; `check:version` and
  `check:transitions-sync` both OK; no `dist/` drift (git status clean after
  build, both before and after committing).
- **CI runnability**: `npm test` (`node scripts/test-lock.mjs -- node --test
  test/*.test.mjs`) runs headlessly, zero human interaction, zero flags needed.
- **Commits** (follow-up only, no amends): `d38c698` (T-E178A-06),
  `bb151d7` (T-E178A-07), both on `feat/e178a-integrator-role`, HEAD `bb151d7`.
- **Final full-suite run on the committed branch, clean tree**
  (`git status --porcelain` empty, confirmed before and after the run):
  **2812 tests, 2812 pass, 0 fail, 0 cancelled, 0 skipped.**
  (2795 base + 17 new AC tests in `test/e178a-integrator-role.test.mjs` = 2812;
  the 16 manifest-listed reds are now green — the fixes above account for all
  16, and no new red appeared anywhere else in the suite.)

## Verdict

**PASS** — T-E178A-01 through T-E178A-07. AC1–AC17 all hold (code-reviewer
APPROVED T-01–05 on the SOP/§6/registry/docs content; this review's own
AC-by-AC execution log independently re-confirms every one against the
committed branch). T-06's re-baseline is fully explained (single-hunk golden
diff, 4-floor budget bump, both mechanically justified) and T-07's test suite
proves every AC via its own `--test-name-pattern` command with output matching
the spec exactly. Full regression: 2812/2812, clean tree, no scope creep.

## 2026-09-27T10:32:29.545Z — PASS — by qa-engineer

PASS — T-E178A-01..07 (AC1-AC17). Phase 0.5 expected-red diff clean (16/16 manifest entries confirmed red pre-fix, 0 unexplained). T-01-05 code-reviewer APPROVED (review_reports/review_T-E178A-01.md Round 2); independently re-confirmed. T-06: goldens re-baselined in one pass (11 fixtures, identical single hunk = the §6 const-15 addition); 4 context-budget floors raised by exact measured delta (+245/+246 tok), no other floor touched; .claude/ removed from NON_SOURCE_DIRS; skill-frontmatter count 11->12. T-07: test/e178a-integrator-role.test.mjs, 17 tests (AC1-AC17), each executed via the spec's own --test-name-pattern proof command with output matching exactly. Full detail: qa_reports/review_T-E178A-06.md (covers all 7 ids). Full suite on committed branch (cb6741e), clean tree: 2812/2812 pass, 0 fail.

