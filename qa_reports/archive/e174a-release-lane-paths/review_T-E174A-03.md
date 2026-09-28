# Review — T-E174A-03 (qa-engineer)

covers: T-E174A-01, T-E174A-02, T-E174A-03

## Round 1 — PASS — by qa-engineer

## Phase 0.5 — Expected-Red Diff
Phase 0.5: skipped (no `qa_reports/expected-red_e174a-release-lane-paths.txt` manifest declared — this is a feature-mode mini-chain, no `dispatch_mode: "bugfix"`).

## Summary
Spec is the E174a row in `docs/backlog.md:297` (mini-chain sr-engineer → code-reviewer → qa-engineer, backlog row as spec — no `specs/e174a-release-lane-paths.md`). code-reviewer APPROVED T-E174A-01/T-E174A-02 in `review_reports/review_T-E174A-02.md`, with one `recommended` (non-blocking) finding R1 left for QA: `scripts/verify-release.mjs:249-250`'s comment claims "a drift-guard test pins the mirror" between `LANE_SEGMENT_RE_SRC` and the real `isSafeLaneName`/`NON_LANE_DIRS`, but no such test existed yet. This round adds it (VR-47 below), makes the comment's claim true, retargets the 4 tests that pinned pre-E174a flat-text literals, adds the E141 lane-path tolerance cases + the human-mandated A1 negative cases, and re-measures the skill-release-engineer context-budget floor.

Scope note: per skill-qa-engineer SOP, correctness/architecture review of `content/skill-release-engineer.md` / `scripts/verify-release.mjs` is code-reviewer's, not mine to re-litigate — already APPROVED. This round's own new code is test-only (test/*.test.mjs), which I authored and am reviewing as the test author (no second reviewer per the mini-chain's cut — QA owns test authorship + PASS per the dispatch brief).

## Copy Audit Gate / Visual Audit Gate
SKIP — no `specs/e174a-release-lane-paths.md` (backlog-row-as-spec mini-chain, same posture as code-reviewer's AC-Completeness SKIP in `review_reports/review_T-E174A-02.md`). No Copy/Strings or Visual Tokens H2 to audit against.

## Phase 1.5 — Visual Compare
Phase 1.5: skipped (no `design/e174a-release-lane-paths.md` — not a UI feature).

## Phase 3 — Tests

### Test File Discovery
Per the dispatch brief's `Test-file placement` line: `test/verify-release.test.mjs` (VR-9c + E141 tolerance cases, new lane-path/A1/A2 cases), `test/feature-lease.test.mjs` (S8, E9A-S1), `test/release-staging.test.mjs` (C13-AC5). All three files already existed with the 4 reds named in the brief; no new test file was needed (the pre-authorization to create one was not exercised).

### 1. Retargeted the 4 reds that pinned pre-E174a flat-text literals (keeping each test's intent, only updating the pinned text to lane-scoped wording):
- `test/feature-lease.test.mjs` **S8** (`content/skill-release-engineer.md:15912` area, step 11b): now pins `.current/<lane>/metrics.jsonl` instead of the old flat `.current/metrics.jsonl`.
- `test/feature-lease.test.mjs` **E9A-S1**: now pins `.current/<lane>/handoff.md` in the no-MCP-path relay Hard rule.
- `test/release-staging.test.mjs` **C13-AC5**: the verbatim hand-edit-ban regex now pins `.current/<lane>/handoff.md`.
- `test/verify-release.test.mjs` **VR-9c (N11)**: the step-13a block assertions now pin the lane-derivation line (`LANE=$(node --input-type=module -e "import {resolveCurrentLane} ...")`), the STOP-on-missing-lane-dir message, the `find ".current/$LANE" ...` enumeration, and the `git add -- ".current/$LANE/handoff.md" $JSONL` stage line — the N11 property itself (non-empty-stage catches only a total staging failure, not partial under-staging) is unchanged, only the pinned literal shape.

All 4 confirmed green individually and as part of their full files (206/206 across the 3 files together).

### 2. E141 tolerance additions (`test/verify-release.test.mjs`)
Added 4 new `mkFixtureRepo` `tag` shapes + 4 new tests (VR-39..VR-42, renumbered once to VR-39..VR-42 after discovering VR-34..VR-37 were already taken by the pre-existing E147/E165 Check-6 test block further down the file):
- **VR-39**: one post-tag commit touching only `.current/_primary/{handoff.md,telemetry.jsonl}` + `.current/e174a/{dispatch.jsonl,usage.jsonl}` (two lanes, all 4 sidecar kinds incl. `dispatch.jsonl`/`usage.jsonl`) → tolerated (Check 1 OK + NOTE).
- **VR-40**: a lane literally named `archived` (distinct from the excluded `archive` directory — `NON_LANE_DIRS` only excludes the exact segment `archive`) → tolerated.
- **VR-41**: `.current/archive/...` → NOT tolerated (Check 1 FAIL naming the path).
- **VR-42**: `.current/history/...` → NOT tolerated (Check 1 FAIL naming the path).
- Flat forms still tolerated: already covered pre-existing (VR-27/VR-31); re-confirmed unaffected by this round's `BOOKKEEPING_PATH_RES` addition (both flat regexes are untouched entries in the array).

### 3. A1 human-mandated negative cases (`test/verify-release.test.mjs`, VR-43..VR-46)
Each fixture's post-tag commit touches exactly one negative-case path; Check 1 must FAIL:
- **VR-43**: `.current/a/b/handoff.md` (two-segment path — `LANE_SEGMENT_RE_SRC`/`isSafeLaneName` only ever match one path segment).
- **VR-44**: `.current/.x/handoff.md` (dot-prefixed lane name — not a safe path segment, first-char class excludes `.`).
- **VR-45**: `.current/.config.json` (explicitly not a lane file per the backlog E174a scope note — must stay top-level/out of the allowlist).
- **VR-46**: `.current/_primary/feature-split.md` (not a `LANE_FILES` entry — only `handoff.md` + the `*.jsonl` sidecars are, even though it sits directly under a valid lane dir).

### 4. A2 drift-guard test (VR-47) — closes code-reviewer R1
`scripts/verify-release.mjs:249-250`'s comment claimed a drift-guard test exists; VR-47 is that test, making the claim true. It:
- Extracts `LANE_SEGMENT_RE_SRC`'s **actual runtime value** out of the real committed script text via `new Function(...)` (the real JS engine interpreting the string literal's escaping — not a hand-rolled unescaper that could itself drift from what node actually parses), never a re-typed copy.
- Parses the archive/history exclusion names out of that extracted value (never hand-typed) and asserts **set equality** against the real `NON_LANE_DIRS` import from `dist/tools/lane-paths.js`.
- Builds the full `.current/<candidate>/handoff.md` pattern (matching exactly how `BOOKKEEPING_PATH_RES` embeds `LANE_SEGMENT_RE_SRC` in production — I initially tested the bare segment in isolation and hit a false mismatch on `"archive"`, because the exclusion lookahead is context-dependent on a following `/`; fixed to embed the same way the real regex does) and compares acceptance over a 23-entry probe set against `isSafeLaneName(candidate) && !NON_LANE_DIRS.has(candidate)` — the real dist exports, not a re-derivation of the unexported `SAFE_LANE_RE`.
- **Verified drift-sensitivity empirically** (both directions, scratch script, not shipped as a test): mutating a copy of `NON_LANE_DIRS` to add an unknown-to-the-script entry (`"quarantine"`) produces a mismatch; mutating a copy of the script's lookahead to drop the archive/history exclusion produces a mismatch on `"archive"`. Confirms either side changing alone turns VR-47 red, per the A2 requirement.

### AC/Spec-to-Test map
No `specs/e174a-release-lane-paths.md` exists; the backlog E174a row + dispatch brief's 6 numbered `Required` items ARE the spec for this task:
| brief item | test(s) |
|---|---|
| 1. retarget 4 reds | S8, E9A-S1 (feature-lease.test.mjs); C13-AC5 (release-staging.test.mjs); VR-9c (verify-release.test.mjs) |
| 2. E141 tolerance additions | VR-39..VR-42 (verify-release.test.mjs) |
| 3. A1 negative cases | VR-43..VR-46 (verify-release.test.mjs) |
| 4. A2 drift-guard test | VR-47 (verify-release.test.mjs) |
| 5. context-budget floor | see below |
| 6. full suite + check-md-tables + build + audit | see Phase 4 |

## Phase 3.5 — AC Execution
Phase 3.5: skipped (no `specs/e174a-release-lane-paths.md`, so no `proof:`-annotated ACs to execute).

## Context-budget floor re-measurement (brief item 5)
Searched every test file for an existing floor pinning `content/skill-release-engineer.md`'s own composed/stripped token count (the pattern `skill-pm.md` (≤4401 ~tok) and `skill-sr-engineer.md` (≤2852 ~tok) have in `test/context-budget.test.mjs`). **None exists for `skill-release-engineer.md`** — it is dispatched via its own standalone `release-engineer` prompt, never folded into the coordinator (`skill-coordinator.md`/`coord-*.md`) or constitution (`const-*.md`) bundles those 12 `test/fixtures/compose-golden/*.txt` goldens and the 4 pinned `context-budget.test.mjs` bundle floors (lean-always-on ≤4868, teamwork-stripped ≤18990, design-arm-constitution ≤9374, non-design-constitution ≤7276) measure. Confirmed by full-repo grep across `test/*.test.mjs` for `skill-release-engineer` combined with `approxTokens`/`stripRationale`/numeric caps — zero hits beyond the two per-role floors named above, neither of which is this file.

Independently measured the raw body anyway (`stripRationale(stripOriginTags(expandSkill(body)))`, the same convention the two existing per-role floors use) for the record: **old (HEAD, pre-T-E174A-01) 20691 ~tok → new (this diff) 20854 ~tok, +163**. Since no existing floor pins this file, **no floor moved** and this measurement is informational only — nothing in the brief's "move ONLY a floor this change pushed up" applies here because there is no such floor to move.

Verified zero impact on the actually-pinned floors: full `test/context-budget.test.mjs` run 54/54 green (unchanged), plus the golden-consuming suites `test/e90-golden-capture-completeness.test.mjs` + `test/compose-equivalence.test.mjs` + `test/skill-manifest.test.mjs` 45/45 green — confirms none of the 12 `compose-golden` fixtures were touched by this diff and **no golden rebuild is needed**.

## Phase 4 — Run
- Build: `npm run build` — `tsc` clean, `check:version` OK (3.116.0), `check:transitions-sync` OK (21 keys). Zero errors.
- `node scripts/check-md-tables.mjs` — OK (264 files scanned, 0 malformed tables; 4 pre-existing non-blocking advisory notes on `docs/backlog.md` done-mark placement, unrelated to this diff).
- `npm audit --audit-level=high` — exit 0. 6 vulnerabilities found (2 low, 4 moderate: `hono`, `protobufjs`, `qs` transitive deps), all below the `--audit-level=high` threshold and pre-existing (not introduced by this diff, which touches no `package.json` dependency). No high/critical findings.
- `npm test` (prebuild + full `node --test test/*.test.mjs`): **2417/2417 pass, 0 fail.**
- Targeted re-run of the 3 edited test files together: **206/206 pass, 0 fail** (`test/feature-lease.test.mjs` + `test/release-staging.test.mjs` + `test/verify-release.test.mjs`).

## Verdict
PASS — T-E174A-01, T-E174A-02, T-E174A-03. All 6 brief-required items delivered: 4 reds retargeted (intent preserved, only pinned text updated), E141 lane-path tolerance cases added (incl. `dispatch.jsonl`/`usage.jsonl`, `archived` lane tolerated, `archive`/`history` dirs rejected, flat forms still tolerated), the 4 A1 human-mandated negative cases added, the A2 drift-guard test (VR-47) added and empirically confirmed sensitive to drift on either side (closes code-reviewer R1 — the `verify-release.mjs:249-250` comment's claim is now true), context-budget floor re-measured (none exists to move; zero impact confirmed on the 4 floors that do exist plus all 12 goldens), full suite green (2417/2417), `check-md-tables` green, build green, `npm audit --audit-level=high` clean of high/critical findings. No defect surfaced against sr-owned files (`content/`, `scripts/`) — none of this round's changes touch them.
## 2026-09-24T07:06:25.713Z — PASS — by qa-engineer

PASS. Full detail in qa_reports/review_T-E174A-03.md (covers T-E174A-01..03). Retargeted the 4 pre-E174a flat-text reds (S8, E9A-S1 in feature-lease.test.mjs; C13-AC5 in release-staging.test.mjs; VR-9c in verify-release.test.mjs) to lane-scoped wording, intent unchanged. Added E141 lane-path tolerance cases (VR-39..VR-42: two-lane multi-sidecar incl. dispatch.jsonl/usage.jsonl tolerated, 'archived' lane tolerated, .current/archive|history/... rejected). Added the 4 A1 human-mandated negative cases (VR-43..VR-46: nested path, dot-lane, .config.json, feature-split.md all correctly NOT tolerated). Added VR-47, the A2 drift-guard test comparing verify-release.mjs's LANE_SEGMENT_RE_SRC + archive/history exclusion (extracted from the real committed script via new Function, never hand-retyped) against dist/tools/lane-paths.js's real isSafeLaneName/NON_LANE_DIRS exports over a 23-entry probe set plus NON_LANE_DIRS set-equality; empirically confirmed red under drift on either side. This makes verify-release.mjs:249-250's comment claim true (code-reviewer R1 closed). Context-budget floor: no existing test pins content/skill-release-engineer.md's own token count (unlike skill-pm/skill-sr-engineer) so none moved; raw measurement 20691->20854 ~tok (+163) reported for the record; zero impact confirmed on the 4 floors + 12 goldens that do exist (context-budget.test.mjs 54/54, golden-consumer suites 45/45). npm test 2417/2417, check-md-tables OK, build clean, npm audit --audit-level=high exit 0 (only pre-existing moderate/low). No defect found in sr-owned content/scripts/.

