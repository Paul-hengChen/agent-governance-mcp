# QA Review — T-E123B1-01, T-E123B1-02

covers: T-E123B1-01, T-E123B1-02

Feature: e123b1-core-write-path (E123 F1 L1). Spec = `.current/feature-split.md` row 1.1 + the
human's constraints in `scope_decision_why` (PM/ARCH skipped — mini-chain). code-reviewer
APPROVED both tasks in `review_reports/review_T-E123B1-01.md`.

## Expected-Red Diff

(Phase 0.5.)

`qa_reports/expected-red_e123b1-core-write-path.txt` is present (4 entries, 2 blocks). Ran the
full suite BEFORE any re-baseline edit (none made — file-mode QA, no test files touched):

```
cd <lanes-root>/e123b1 && npm test
...
# tests 2315
# pass 2311
# fail 4
```

Actual reds (`grep -E "^not ok"` on the run output):

```
not ok 155 - AC7 (real corpus, informational count NOT pinned here): `node scripts/check-md-tables.mjs` against this actual repository's docs/backlog.md still exits 0 — the E88 advisory must never turn a pre-existing row fatal
not ok 156 - CQ-9 (real corpus, non-regression, T-E145-02 required case 9): the real docs/backlog.md still exits 0, still advises on the E39/E40/E58/E59 rows, and does NOT advise on the E145 row — identified by TICKET ID via a live line-number lookup, never a hardcoded line number or a fixed advisory count (docs/backlog.md is edited by concurrent lanes)
not ok 1306 - CALLERS2 (disclosed substitution): AC5's LITERAL proof (grep -rln "lane-paths") is a spec-proof defect, not an implementation defect — it always lists 3 files because AC15 mandates the imports
not ok 1329 - CALLERS3: grep -rn resolveCurrentLane tools/ gates/ guards/ prompts/ bin/ index.ts names only tools/lane-paths.ts (zero production callers)
```

**Phase 0.5: clean (4/4 manifest entries confirmed red, 0 unexplained reds).** 1:1 match against
the manifest's Block 1 (CALLERS2, CALLERS3 — L1 adds production callers by design, J retires the
pins at row 1.9) and Block 2 (AC7, CQ-9 — pre-existing at base commit 8f30aba, `.current/feature-split.md`
row 1.9 unescaped `|`, out of this lane's touch set). No disposition needed beyond the manifest's
own annotations; no genuine regression.

## Phase 1 — Review (AC1–AC4)

Dispatch brief `Test-file placement: none` — no spec `Copy / Strings` or `Visual Tokens` H2 exists
(PM/ARCH skipped, no `specs/e123b1-*.md`), so Phase 3a/3b Copy/Visual Audit Gates are N/A: this is
a backend path-resolution refactor with zero user-facing strings or visual literals. Logged, not
skipped silently.

### AC1 — grep of the 6 files for quoted lane filenames = 0 matches

Lane filenames are the 5 `LANE_FILES` entries (`tools/lane-paths.ts:34-39`): `handoff.md`,
`telemetry.jsonl`, `metrics.jsonl`, `usage.jsonl`, `dispatch.jsonl` (`.config.json`,
`feature-split.md`, `exemptions.json`, `tasks.md` are explicitly NOT lane files per that file's own
comment). Ran against all 6 candidate files (the 4 touched + the 2 the human confirmed had zero
code-level lane-file sites):

```
$ grep -nE "['\"](handoff\.md|telemetry\.jsonl|metrics\.jsonl|usage\.jsonl|dispatch\.jsonl)['\"]" \
    tools/handoff-write.ts tools/handoff-parse.ts guards/session.ts tools/drift.ts \
    tools/registry.ts tools/role.ts
(no output, exit 1)
```

**PASS — 0 matches.**

### AC2 — every `resolveCurrentLanePaths(` call passes `path.resolve(...)`

```
$ grep -rn "resolveCurrentLanePaths(" --include="*.ts" . | grep -v '^./dist\|lane-paths.ts:182'
tools/handoff-parse.ts:75:  return resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath;
tools/drift.ts:248:      const p = resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath;
tools/handoff-write.ts:52:  return resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath;
guards/session.ts:46:    ? resolveCurrentLanePaths(path.resolve(workspacePath)).handoffPath
```

**PASS — all 4 production call sites wrap the argument in `path.resolve(...)`.**

### AC3 — remaining `.current` joins limited to lock/archive/.config.json/feature-split.md/role overrides

```
$ grep -n '\.current' tools/handoff-write.ts tools/handoff-parse.ts guards/session.ts \
    tools/drift.ts tools/registry.ts tools/role.ts
```
Non-comment code hits:
- `handoff-write.ts:266` — `path.join(workspacePath, ".current", ".handoff.lock")` (lock)
- `handoff-write.ts:483` — `path.join(workspacePath, ".current", "archive")` (archive)
- `drift.ts:117` — `.current/feature-split.md` (feature-split.md)
- `drift.ts:266` — `.current/.config.json` (.config.json)
- `role.ts:61,63` — `path.join(workspacePath, ".current", f)` (role SOP override files)

`registry.ts`'s hits are all comments/description strings/a `.refine()` basename check, not path
joins into a lane file. **PASS — no residual join outside the sanctioned set.**

### AC4 — diff vs main limited to the 4 src files + dist + NEW-TICKETS.md; lane-paths.ts, content/, test/ untouched

```
$ git diff --stat main -- .
 .current/feature-split.md         |  2 +-
 .current/handoff.md               | 26 +++++++++++++++-----------
 NEW-TICKETS.md                    | 11 +++++++++++
 dist/guards/session.d.ts.map      |  2 +-
 dist/guards/session.js            |  6 +++++-
 dist/guards/session.js.map        |  2 +-
 dist/tools/drift.d.ts.map         |  2 +-
 dist/tools/drift.js               |  4 +++-
 dist/tools/drift.js.map           |  2 +-
 dist/tools/handoff-parse.d.ts.map |  2 +-
 dist/tools/handoff-parse.js       |  4 +++-
 dist/tools/handoff-parse.js.map   |  2 +-
 dist/tools/handoff-write.d.ts.map |  2 +-
 dist/tools/handoff-write.js       | 15 +++++++++++----
 dist/tools/handoff-write.js.map   |  2 +-
 guards/session.ts                 |  6 +++++-
 tasks.md                          |  2 ++
 tools/drift.ts                    |  4 +++-
 tools/handoff-parse.ts            |  4 +++-
 tools/handoff-write.ts            | 15 +++++++++++----
 20 files changed, 81 insertions(+), 34 deletions(-)

$ git diff main -- tools/lane-paths.ts | wc -l   # 0
$ git diff main -- content/ | wc -l              # 0
$ git diff main -- test/ | wc -l                 # 0
```

Source diff = the 4 sanctioned files (`guards/session.ts`, `tools/drift.ts`,
`tools/handoff-parse.ts`, `tools/handoff-write.ts`) + `dist/` (recompiled output of the same 4) +
`NEW-TICKETS.md`. `lane-paths.ts`, `content/`, `test/` all diff empty against main. Remaining
entries are sanctioned protocol artifacts per L1-NEW-6 and inherent tw_* bookkeeping, not source:
`.current/handoff.md` (every `tw_update_state` write), `.current/feature-split.md` (2-line row 1.9
bookkeeping edit — pre-existing unescaped `|`, see Phase 0.5 Block 2; not this lane's touch set),
`tasks.md` (the 2 `T-E123B1-01/02` rows added via `tw_add_task`, sanctioned). **PASS.**

Spot-checked the 4 source diffs directly (`git diff main -- tools/handoff-write.ts
tools/handoff-parse.ts guards/session.ts tools/drift.ts`): `getHandoffPath` in both
handoff-write.ts and handoff-parse.ts now returns `resolveCurrentLanePaths(path.resolve(ws)).handoffPath`;
`ensureDir` was re-signatured to take the resolved `handoffPath` and `mkdir`s `path.dirname(...)`
(single call site, `handoff-write.ts:265`, correctly updated); `guards/session.ts:46` and
`tools/drift.ts:248` route the same way. Lock path (`handoff-write.ts:266`) is byte-unchanged and
still built from `workspacePath` directly, matching AC3. This matches code-reviewer's independent
analysis in `review_reports/review_T-E123B1-01.md` (APPROVED, zero behaviour change apart from the
accepted absolute-path delta for relative `workspacePath`).

### AC5 — build clean + full suite + `npm audit --audit-level=high` exit 0

**Build**: `npm run build` — `tsc` clean, `check:version` OK (3.116.0), `check:transitions-sync` OK
(21 keys). Zero errors.

**Full suite**: `npm test` → 2315 tests, 2311 pass, 4 fail — the exact 4 manifest entries (Phase
0.5 above), 0 unexplained reds.

**`npm audit --audit-level=high`**: exit code 0. 6 vulnerabilities reported (2 low, 4 moderate: `@hono/node-server`,
`body-parser`, `esbuild`, `hono`, `protobufjs`, `qs` — all dev/transitive, none high/critical), all
below the `--audit-level=high` threshold.

**AC5 human decision (option A, 2026-09-23)**: recorded — AC5 passes when the full suite has no
reds beyond the 4 listed in the expected-red manifest. Verified above: the actual red set is
exactly those 4, nothing more, nothing less. **PASS.**

## Phase 1.5 — Visual Compare

No `design/e123b1-*.md` exists and no `## Visual Baselines` H2 anywhere in scope. **Phase 1.5:
skipped (no Visual Baselines declared).**

## Phase 3 — Tests

Dispatch brief: `Test-file placement: none` — do not create or edit any test file; the
human-approved cut requires `test/` unchanged vs `main` (verified AC4 above, `git diff main --
test/` empty) and the existing suite is the proof. **Phase 3: skipped (dispatch brief specifies no
test-file placement — existing suite is the proof, per Constitution §2 Conditional test writing).**

## Phase 3.5 — AC Execution

No `specs/e123b1-*.md` exists (PM/ARCH skipped, mini-chain per `scope_decision_why`) and therefore
no `proof:`-annotated ACs to scan. **Phase 3.5: skipped (no spec file / no proof:-annotated ACs).**

## Verdict

**PASS.** AC1–AC5 independently verified with evidence above; all green. code-reviewer's
independent APPROVED verdict (correctness/architecture/security/performance) stands unchallenged —
nothing in QA's scope (test coverage, expected-red hygiene, AC verification) contradicts it.
## 2026-09-23T09:05:34.992Z — PASS — by qa-engineer

PASS. AC1-AC4 independently verified with grep/diff evidence (qa_reports/review_T-E123B1-01.md): AC1 0 quoted-lane-filename matches across the 6 files; AC2 all 4 resolveCurrentLanePaths( call sites wrap path.resolve(...); AC3 residual .current joins limited to lock/archive/.config.json/feature-split.md/role overrides; AC4 diff vs main = 4 src files (guards/session.ts, tools/drift.ts, tools/handoff-parse.ts, tools/handoff-write.ts) + dist + NEW-TICKETS.md, plus sanctioned protocol artifacts (.current/handoff.md, .current/feature-split.md pre-existing row-1.9 bookkeeping, tasks.md task rows); lane-paths.ts/content//test/ diff empty vs main. AC5 option-A disposition (human decision 2026-09-23) applied and RECORDED HERE: build clean (tsc + check:version + check:transitions-sync all OK), full npm test = 2315 tests / 2311 pass / 4 fail, and the 4 reds are EXACTLY the expected-red manifest (CALLERS2, CALLERS3 in test/lane-paths.test.mjs; AC7, CQ-9 in test/check-md-tables.test.mjs, pre-existing at base commit 8f30aba) with 0 unexplained reds -> AC5 PASSES under option A. npm audit --audit-level=high exit 0 (6 moderate/low vulns, all below threshold). Phase 0.5 Expected-Red Diff: clean, 4/4 manifest entries confirmed red. Phase 1.5 Visual Compare: skipped, no Visual Baselines. Phase 3 Tests: skipped per dispatch brief Test-file placement=none (test/ verified unchanged vs main). Phase 3.5 AC Execution: skipped, no specs/e123b1-*.md / no proof:-annotated ACs (PM/ARCH skipped, mini-chain). code-reviewer's APPROVED verdict (review_reports/review_T-E123B1-01.md) unchallenged; full evidence in qa_reports/review_T-E123B1-01.md.

## 2026-09-23T09:05:56.080Z — PASS — by qa-engineer

PASS. AC1-AC4 independently verified with grep/diff evidence (qa_reports/review_T-E123B1-01.md): AC1 0 quoted-lane-filename matches across the 6 files; AC2 all 4 resolveCurrentLanePaths( call sites wrap path.resolve(...); AC3 residual .current joins limited to lock/archive/.config.json/feature-split.md/role overrides; AC4 diff vs main = 4 src files (guards/session.ts, tools/drift.ts, tools/handoff-parse.ts, tools/handoff-write.ts) + dist + NEW-TICKETS.md, plus sanctioned protocol artifacts (.current/handoff.md, .current/feature-split.md pre-existing row-1.9 bookkeeping, tasks.md task rows); lane-paths.ts/content//test/ diff empty vs main. AC5 option-A disposition (human decision 2026-09-23) applied and RECORDED HERE: build clean (tsc + check:version + check:transitions-sync all OK), full npm test = 2315 tests / 2311 pass / 4 fail, and the 4 reds are EXACTLY the expected-red manifest (CALLERS2, CALLERS3 in test/lane-paths.test.mjs; AC7, CQ-9 in test/check-md-tables.test.mjs, pre-existing at base commit 8f30aba) with 0 unexplained reds -> AC5 PASSES under option A. npm audit --audit-level=high exit 0 (6 moderate/low vulns, all below threshold). Phase 0.5 Expected-Red Diff: clean, 4/4 manifest entries confirmed red. Phase 1.5 Visual Compare: skipped, no Visual Baselines. Phase 3 Tests: skipped per dispatch brief Test-file placement=none (test/ verified unchanged vs main). Phase 3.5 AC Execution: skipped, no specs/e123b1-*.md / no proof:-annotated ACs (PM/ARCH skipped, mini-chain). code-reviewer's APPROVED verdict (review_reports/review_T-E123B1-01.md) unchallenged; full evidence in qa_reports/review_T-E123B1-01.md.

