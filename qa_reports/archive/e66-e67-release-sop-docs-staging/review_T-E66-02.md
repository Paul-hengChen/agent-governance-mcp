# QA Review — T-E66-02

covers: T-E66-01, T-E66-02, T-E67-01, T-E67-02

Feature: `e66-e67-release-sop-docs-staging`. Mini-chain (backlog rows ARE the
spec, PM/architect skipped) — `docs/backlog.md:189` (E66) / `:190` (E67).
Code-reviewer APPROVED after 3 rounds; full detail in
`review_reports/review_T-E66-01.md`. This review covers (a) T-E66-02's own
test-surface work and (b) Phase 4 re-verification of T-E66-01/T-E67-01/T-E67-02
against live artifacts rather than the review report's prose.

## Phase 0.5 — Expected-Red Diff
Skipped (no expected-red manifest declared — no `qa_reports/expected-red_e66-e67-release-sop-docs-staging.txt`, and the diff is content/test only, no intentional red).

## Phase 1 — Review

Read the full round-1/2/3 code-review (`review_reports/review_T-E66-01.md`) and
the live diff. Concur with the APPROVED verdict. Independently re-verified
(not re-read) every E67 factual claim and the render-structure fix — see
"Phase 4 — Re-verification against live artifacts" below; all reproduced.

No Copy/Visual Tokens H2 applies (no `specs/<feature>.md` exists — backlog-row
mini-chain). Phase 1.5 Visual Compare: skipped, no `design/<feature>.md`.

### T-E66-02 scope — what I implemented in `test/release-staging.test.mjs`

Per this round's dispatch (superseding the stale `tasks.md` T-E66-02 description,
which predates the round-1 review finding that surfaced `.github/`):

1. **`FEATURE_DIRS` (line ~71-83)**: appended `docs/`, `research/`,
   `multi-agent-scripts/`, `.github/` after `review_reports/`, matching the
   SOP's own list order (19 entries total, matching all three SOP sites'
   element-wise-verified 19-entry sets per the round-3 review).
2. **New `NON_SOURCE_DIRS`** beside it: `dist/` (already in `METADATA_PATHS`,
   staged via `npm run build` only), `node_modules/` (repo `.gitignore`,
   never tracked), `.current/` (only `.current/.config.json` ships — one of
   the five `E65_METADATA_PATHS`; rest is session bookkeeping per
   `skill-release-engineer.md:173`, commits `cc3e0df`/`53a6392`). Each reason
   recorded in the constant's own comment, per instruction — the partition is
   hand-maintained by design (no meta-guard can derive it; `AC-B5.5`'s
   tsconfig-`include` derivation is the closest analog and it structurally
   cannot see any of docs/research/multi-agent-scripts/.github, none being
   TypeScript source roots).
3. **Partition test** (`"Partition (E66, T-E66-02): every top-level repo
   directory is classified in exactly one of FEATURE_DIRS / NON_SOURCE_DIRS"`):
   enumerates real top-level directories via `git ls-files` (deterministic,
   reproducible in CI and on every clone, and — unlike `ls -d */`, the tool
   whose blind spot produced this ticket per round-1 N1 — DOES enumerate
   dot-directories) plus `node_modules/` added explicitly when present on disk
   (it's real, load-bearing, but deliberately untracked so `git ls-files`
   alone can never surface it). Asserts (a) `FEATURE_DIRS`/`NON_SOURCE_DIRS`
   are disjoint, (b) every enumerated directory lands in their union.
   **Self-verified the test actually reds**: temporarily removed `docs/` from
   a copy of `FEATURE_DIRS` and re-ran — the partition test failed as
   expected; restored and confirmed the working file is byte-identical to
   before the experiment (diff clean).
4. **AC2 and AC3 directory-set pins**: per the reviewer's item 2 (AC2's test
   at old `:224` and AC3's test at old `:245` asserted only literal/framing
   strings — either directory list could be emptied entirely with a green
   suite). Extended both existing tests to extract each list from the SOP
   text (AC2's `` every directory in `{...}` `` cross-reference set; AC3's
   "Expected vs unrelated scope rule" backtick-quoted list) and assert exact
   set-equality against `FEATURE_DIRS` (sorted-array `deepEqual`, so element
   order in the SOP text doesn't have to match the test array's order). All
   three SOP lists (git-add capture group / AC1, AC2's cross-reference set,
   AC3's scope-rule list) are now pinned to the identical `FEATURE_DIRS` set.

**Deliberately NOT added** (per this round's explicit instruction, not an
oversight): the render-structure regression test the code-reviewer suggested
in N-R3-2 (`prompts/text-transforms.ts`'s block-vs-inline rationale-fence
contract has no test). That test would red against two genuinely pre-existing
violations at HEAD — `content/skill-release-engineer.md:119` and `:126-128`,
both confirmed byte-identical to HEAD by the round-3 review and confirmed
again independently below, and both out of this cut. Landing the test now
would drag their fix into this ticket. It ships with the coordinator's planned
follow-up ticket that fixes both sites together — filed as one ticket per the
round-3 review's explicit recommendation ("Both are the same root cause and
should be one ticket").

## Phase 2 — Discussion
None needed — Phase 1 found no issues requiring a round with sr-engineer.

## Phase 3 — Tests

### Test File Discovery
`test/release-staging.test.mjs` already exists and is the established home for
this SOP's content pins (E44/E49/E50/E64/E65/E55 precedent).

### Spec-to-Test Map (backlog rows are the spec)
| Row | AC / claim | Test(s) |
|---|---|---|
| E66 (ii) | `FEATURE_DIRS` gains 4 dirs, matches all 3 SOP sites | `AC1` (existing, extended set), new AC2/AC3 directory-set pins, `Expected vs unrelated scope rule (E64...)` (existing, extended set), `AC-B5.5` (existing, one-directional, unaffected) |
| E66 (ii) | `NON_SOURCE_DIRS` + partition closure | new `Partition (E66, T-E66-02)` test |
| E67 (a)-(f) | text-accuracy fixes | re-verified directly against live artifacts (README grep, package.json scripts, `agc check` real output, `git log` trailer history, filesystem `ls`, `GATE_REGISTRY.length`) — no new test needed; these are prose-accuracy claims already exercised by the existing SOP-text pins, confirmed true against ground truth below |
| CLAUDE.md 33-gate count | `CLAUDE.md:49`/`:87` both read 33 | re-verified against `GATE_REGISTRY.length` at runtime (below); no dedicated test file covers `CLAUDE.md` prose (consistent with existing project convention — this doc is not test-pinned elsewhere either) |

### Coverage Gate
New/modified surface is test-file content-assertion code (regex extraction +
`deepEqual`), not application logic requiring a coverage tool; every new
assertion is exercised by the single new/extended test running in the suite.

### Security Smoke Tests
N/A — prose/test-file changes only, no input-handling code, no auth surface.

## Phase 3.5 — AC Execution Log
Skipped (no `proof:`-annotated ACs — no `specs/e66-e67-release-sop-docs-staging.md` exists; backlog-row-as-spec mini-chain).

## Phase 4 — Run

### Build / suite
```
npm run build   → clean (tsc + check-version + check:transitions-sync all OK)
node --test test/release-staging.test.mjs → 67/67 pass (was 66/66; +1 new Partition test)
npm test        → 1720/1720 pass, 0 fail (was 1719/1719; +1 new Partition test)
```
CI-runnable: `npm test` runs headlessly, zero human interaction required.

### Phase 4 — Re-verification against live artifacts (not the review report's prose)

All six E67 claims and the CLAUDE.md count re-run independently, fourth pass
overall (rounds 1/2/3 each did this once; this is QA's own):

| claim | live check run | result |
|---|---|---|
| (a) README has no `####`, exactly 3 `#v` pins | `grep -c '^####' README.md` → `0`; `grep -n '#v[0-9]' README.md` → lines 30, 34, 182 (3 hits) | true |
| (b) `npx tsc` bypasses `postbuild` | `node -e "require('./package.json').scripts"` → `build: "tsc"`, `postbuild: "npm run check:transitions-sync"` (npm lifecycle hooks never fire on a bare `npx tsc`) | true |
| (c) `agc check` output has no leading `v` | `node bin/agc-init.mjs check` → `agc check — OK (3.101.0) — all adapters current`, exit 0 | true, byte-for-byte |
| (d) trailer defers to harness, not hardcoded | `git log --format='%(trailers:key=Co-Authored-By,valueonly)' -12` → all `Claude Opus 5 (1M context)`; SOP `:139` reads "the `Co-Authored-By:` trailer your OWN harness's git-commit instructions prescribe... do NOT hardcode" | true |
| (f) `content/constitution.md` absent, 15 `const-*.md` | `ls content/constitution.md` → No such file; `ls content/const-*.md \| wc -l` → 15 | true |
| (e) `{E645}` batch-prefix caveat | `T-E645-*` ids real (`review_reports/archive/.../review_T-E645-02.md` exists); no `E645` row in `docs/backlog.md` | true, correctly framed as caveat |
| `CLAUDE.md` gate count | `GATE_REGISTRY.length` (loaded from `dist/gates/registry.js`) → `33`; `CLAUDE.md:49` and `:87` both read "33" | true, both sites agree with the runtime value |

### Render check (the class rounds 2 and 3 were spent on)

Ran the REAL dispatch pass, `stripRationale(stripOriginTags(...))` from
`dist/prompts/text-transforms.js`, against the working-tree
`content/skill-release-engineer.md` (untouched by this ticket's diff — T-E66-02
only edits the test file):

```
step 4.  → own line 49
step 5.  → own line 54
step 6.  → own line 55
step 6a. → own line 56
- **Post-commit sanity check (AC4)** → own line 136
```

Matches the round-3 review's rendered-line-for-line claim exactly. Confirmed
the fence inventory is unchanged from what round 3 approved: 4
`rationale:start`/`end` spans at `:41`, `:119`, `:126-128`, `:131`, plus one
`origin:start`/`end` pair at `:126` and one at `:130` — identical set/location
to the APPROVED round-3 diff. `:119` and `:126-128` are the two confirmed
pre-existing glue sites (verified in round 3 against `git show HEAD`); I did
not re-derive that HEAD comparison myself (this ticket's diff never touches
`content/skill-release-engineer.md`, so there is no new regression risk to
check there), but did confirm those two spans are present, unmodified, and
correctly out of this cut's scope.

## Verdict: PASS

All four task ids (T-E66-01, T-E66-02, T-E67-01, T-E67-02) verified. QA scope
(T-E66-02) implemented and self-tested (including a deliberate red/restore
cycle proving the new Partition test actually catches regressions). Phase 4
re-verification independently reproduces every E67/CLAUDE.md factual claim and
the render-structure fix against live artifacts, not the handoff or review
report text. The render-structure regression test suggested in review N-R3-2
is deliberately deferred to the coordinator's planned follow-up ticket
(fixing `content/skill-release-engineer.md:119` and `:126-128` together), per
this round's explicit scope instruction — not an omission.
## 2026-08-17T04:09:59.643Z — PASS — by qa-engineer

PASS. T-E66-02: FEATURE_DIRS extended 15->19 (docs/, research/, multi-agent-scripts/, .github/ appended after review_reports/); new NON_SOURCE_DIRS (dist/, node_modules/, .current/) with reasons recorded in-comment; new Partition test enumerates real top-level dirs via `git ls-files` (+node_modules/ if present) and asserts full coverage in exactly one list -- self-verified it reds by removing docs/ and restoring. AC2 and AC3 SOP directory lists now extracted from source text and pinned to exact FEATURE_DIRS set equality (previously unpinned per code-reviewer round-1 finding). Phase 4: re-verified all 6 E67 claims + CLAUDE.md 33-gate count directly against live artifacts (README grep, package.json scripts, real `agc check` output, git log trailers, filesystem, GATE_REGISTRY.length at runtime) -- all true. Re-ran the render check stripRationale(stripOriginTags(...)) against working-tree skill-release-engineer.md: steps 4/5/6/6a and the AC4 bullet each render on their own line (49/54/55/56/136), matching round-3's claim; fence inventory (4 rationale + 2 origin spans) unchanged from the APPROVED diff. Deliberately did NOT add the render-structure regression test code-reviewer suggested (N-R3-2) -- it would red against two pre-existing violations at HEAD (:119, :126-128), out of this cut; ships with the coordinator's planned follow-up ticket per round-3's own recommendation. npm run build clean; test/release-staging.test.mjs 67/67 (was 66/66); npm test 1720/1720 (was 1719/1719). Evidence: qa_reports/review_T-E66-02.md (covers T-E66-01, T-E66-02, T-E67-01, T-E67-02).

