# QA Review: T-E123BI-01 — retarget CALLERS2/CALLERS3 to allow-lists

feature: e123b-callers-retarget
role: qa-engineer (single-role judge dispatch, PM-sanctioned per Constitution §3.1;
handoff carries `resume_of: qa-engineer`)
scope: test-only, `test/lane-paths.test.mjs` only — no source files touched

## Context

Primary checkout `integ/f1-lanes` merges e123b1 (L1) + e123b2 (L2) + e123b3 (L3)
onto main per `.current/feature-split.md` rows 1.1–1.3. L1–L3's whole job was
adding production callers of `resolveCurrentLane(Paths)` / `tools/lane-paths.ts`
— this is exactly what S0 (e123b0)'s own spec AC5 anticipates ("L1–L3 add
them", `specs/e123b0-lane-runtime-resolver.md`). The two zero-caller tests
authored at S0/e123a time (`CALLERS2`, `CALLERS3` in `test/lane-paths.test.mjs`)
therefore fail on this branch BY DESIGN, not by regression.

## Phase 0.5 — Expected-Red Diff

`Phase 0.5: skipped (no expected-red manifest declared)` — no
`qa_reports/expected-red_e123b-callers-retarget.txt` exists (checked directly;
`dispatch_mode` is absent from handoff state, i.e. feature mode, not bugfix).

## Phase 1 — Review

Read `test/lane-paths.test.mjs` in full. The task is narrowly scoped (test-only,
two named tests) so the review is the derivation below rather than a
spec/copy/visual audit — no `specs/e123b-callers-retarget.md` or
`design/e123b-callers-retarget.md` exists for this micro-ticket (it rides on
`specs/e123b0-lane-runtime-resolver.md` AC5 and `.current/feature-split.md`).

### 3a/3b Copy/Visual Audit Gates

N/A — no spec Copy/Strings or Visual Tokens H2 for this ticket; test-only,
no user-facing surface touched.

### Phase 1.5 — Visual Compare

`Phase 1.5: skipped (no Visual Baselines declared)` — no `design/<feature>.md`.

## Derivation of the allow-lists (the actual review work)

Ran, on `integ/f1-lanes`, HEAD `19dc6be` (Merge e123b3 lane):

```
grep -rln "lane-paths" tools gates guards prompts bin index.ts
```
→ 12 files: `bin/agent-governance-context.mjs`,
`bin/agent-governance-usage-hook.mjs`, `guards/session.ts`,
`prompts/build.ts`, `tools/dispatch-log.ts`, `tools/drift.ts`,
`tools/handoff-parse.ts`, `tools/handoff-write.ts`, `tools/lane-migrate.ts`,
`tools/lane-paths.ts`, `tools/metrics.ts`, `tools/telemetry.ts`.

```
grep -rn "resolveCurrentLane" tools gates guards prompts bin index.ts | cut -d: -f1 | sort -u
```
→ 10 files: the 12 above minus `tools/dispatch-log.ts` and
`tools/lane-migrate.ts` (those two import `laneFile`/`LANE_FILES`/
`resolveLaneName`, never `resolveCurrentLane`, confirmed by grepping each
file individually for the narrower symbol set).

### Cross-check against sanctioned sources

Every file in both lists was verified against `.current/feature-split.md`:

| file | sanctioned by |
|---|---|
| `tools/lane-paths.ts` | row 1.0 (e123b0, done) — the module itself |
| `tools/dispatch-log.ts` | row 1.0/F0, AC15-mandated (`import { laneFile } from "./lane-paths.js"`) |
| `tools/lane-migrate.ts` | row 1.0/F0, AC15-mandated (`import { LANE_FILES, resolveLaneName, ... }`) |
| `guards/session.ts`, `tools/drift.ts`, `tools/handoff-parse.ts`, `tools/handoff-write.ts` | row 1.1 (e123b1-core-write-path, L1) |
| `tools/metrics.ts`, `tools/telemetry.ts` | row 1.2 (e123b2-sidecars-lane-tools, L2) |
| `bin/agent-governance-context.mjs`, `bin/agent-governance-usage-hook.mjs`, `prompts/build.ts` | row 1.3 (e123b3-prompts-hooks, L3) |

No unsanctioned caller found — every hit in both grep outputs maps to a row
1.0–1.3 file. (Files each row *lists as touched* but that don't appear in
either grep output — e.g. `tools/role.ts`, `tools/registry.ts` from row 1.1;
`tools/lane-registry.ts`, `tools/join-precondition.ts`, `index.ts` from row
1.2; `bin/agc-init.mjs` from row 1.3 — are simply files that didn't need a
lane-paths import; their absence is not a defect.)

Per the task's instruction ("if you find a caller that is NOT sanctioned,
stop and report it instead of allow-listing it") — nothing to report; both
sets are fully sanctioned.

## Phase 3 — Tests (the change itself)

Test-file placement: dispatch brief specifies modifying the existing
`CALLERS2` and `CALLERS3` tests in `test/lane-paths.test.mjs` only, no new test
file. Followed exactly — no other test in the file touched.

Changes made to `test/lane-paths.test.mjs`:
- `CALLERS2`: retargeted from asserting the literal 3-file AC15 set to
  asserting the 12-file `SANCTIONED_LANE_PATHS_IMPORTERS` allow-list above.
  Renamed from "(disclosed substitution)" to "(allow-list)"; body comment
  rewritten to explain the F0→F1 growth instead of framing it as a
  proof-defect workaround.
- `CALLERS3`: retargeted from asserting `["tools/lane-paths.ts"]` (zero
  callers) to asserting the 10-file `SANCTIONED_RESOLVE_CURRENT_LANE_CALLERS`
  allow-list above. Renamed from "zero production callers" to "(allow-list)";
  body comment rewritten to state plainly that "zero callers" was a
  serialization gate for e123b0's own merge, not a permanent invariant, and
  that L1–L3 populating it is the designed outcome per spec AC5's own text.
- File header (spec-to-test map comment, lines ~1–29) updated so the AC5
  rows for both e123a and e123b0 no longer claim "zero production callers"
  as the CALLERS2/CALLERS3 outcome; they now point at the allow-list framing.
- `CALLERS1` (asserts the `resolveLanePaths` FUNCTION itself, as opposed to
  the module, still has zero callers outside its own file) was left
  untouched — that invariant is still true and still real: L1–L3 all call
  `resolveCurrentLanePaths`, never `resolveLanePaths` directly. Confirmed by
  re-running `grep -rn "resolveLanePaths" tools gates guards prompts bin
  index.ts`, which still hits only `tools/lane-paths.ts`.
- No other test in the file, and no source file, was touched.

Both allow-lists are hardcoded arrays with per-row provenance comments citing
the `.current/feature-split.md` row that sanctions each entry, so a NEW,
unlisted future importer of either symbol still fails the corresponding test
until a human/PM extends the allow-list with its own sanctioning citation.

### AC Execution Log

`Phase 3.5: skipped (no proof:-annotated ACs in a spec named
specs/e123b-callers-retarget.md — this micro-ticket has no spec file; it
retargets an existing test pair per PM/coordinator instruction, not a new
spec AC)`.

## Phase 4 — Run

- `npm run build` → clean (`tsc` + `check:version` + `check:transitions-sync`
  all OK, version 3.116.0).
- `node --test test/lane-paths.test.mjs` → 45/45 pass, including the
  retargeted `CALLERS2` and `CALLERS3`.
- `npm test` (full suite, prebuild + `node --test test/*.test.mjs`) →
  **2318/2318 pass**, 0 fail, 0 cancelled.
- `npm audit --audit-level=high` → exit 0 (6 pre-existing vulnerabilities, all
  low/moderate severity, none high/critical — unrelated to this change,
  transitive deps of `@hono/node-server`/`hono`/`esbuild`/`protobufjs`/`qs`/
  `body-parser`).

All three PASS gates from the dispatch brief are green.

## Verdict

**PASS** — `test/lane-paths.test.mjs`'s `CALLERS2`/`CALLERS3` retargeted to
allow-lists derived from and verified against the actual sanctioned L1–L3 (+
F0) caller set on `integ/f1-lanes`; no unsanctioned caller found; no source
file touched; full suite green; build clean; audit clean at `--audit-level=high`.
## 2026-09-23T09:20:23.824Z — PASS — by qa-engineer

Retargeted CALLERS2/CALLERS3 in test/lane-paths.test.mjs to allow-lists derived from and verified against the sanctioned F0+L1-L3 caller set of resolveCurrentLane(Paths)/lane-paths on integ/f1-lanes (feature-split.md rows 1.0-1.3). No unsanctioned caller found; no source touched. npm test 2318/2318, npm run build clean, npm audit --audit-level=high exit 0. See qa_reports/review_T-E123BI-01.md.

