# Review — T-E177A-06

covers: T-E177A-01, T-E177A-02, T-E177A-03, T-E177A-04, T-E177A-05, T-E177A-06, T-E177A-07

QA of T-E177A-01..07 (e177a-fanout-manifest). Diff judged: HEAD a646a93 (code-reviewer round 2 APPROVED at d23a384; a646a93 adds only the review-evidence + lane-bookkeeping commit on top, no code change). Test commit: ed823b7 (`test(e177a): E177a T-E177A-06..07 — manifest parse/validate/render + check-CLI tests (AC1-AC16)`). Contract: `specs/e177a-fanout-manifest.md` AC1-AC16.

## Phase 0.5 — Expected-Red Diff
Phase 0.5: skipped (no expected-red manifest declared — no `qa_reports/expected-red_e177a-fanout-manifest.txt`).

## Phase 1 — Review

Read `tools/fanout-manifest.ts` (1077 lines) and `scripts/fanout.mjs` (24 lines) in full. Independently re-derived, by running the built `dist/` against `test/fixtures/e177a/fanout-wave7.md` (a byte copy of the real wave-7 manifest at base 98052c6), every field the spec's ACs assert: title/base, dispatchable-vs-provisional lane ordering, owned-token extraction (including the prose-exclusion cases `closedLanePointerLine` and `:1727`), the AC6 render golden, all AC4/AC8 field-source fallbacks, and the AC9-AC12 checkLane behaviour against real throwaway git repos. Agree with code-reviewer's round-2 verdict: AC1-AC15 implemented as specified, no functional defect found in this pass either.

### 3a. Copy Audit Gate
Every `Copy / Strings` row grepped against `tools/fanout-manifest.ts`, verbatim:
- `err.format` (`fanout: error: <CODE>: <message>`) — `tools/fanout-manifest.ts:972`.
- `validate.ok` — `:1032`.
- `check.summary` — `:945`.
- `check.out` / `禁止:` suffix — `:944`.
- `check.owned` — `:942`.
- `check.implicit` — `:943`.
- `check.note.e158` — `:122` (E158_NOTE).
- `check.note.prose` — `:123` (PROSE_NOTE).
- `err.LANE_PROVISIONAL` — `:681`.
- `err.DECISIONS_SECTION_ABSENT.hint` — `:590`.
- `usage` — `USAGE` const, `:113-117`, matches the spec's three usage lines exactly (verified via `runCli([])` in AC15).
- `prompt.template` (the §3b block) — `PROMPT_TEMPLATE_3B` (`:65-71`) diffed against `git show 98052c6:.claude/commands/integrator.md` lines 171-186: byte-identical (independently re-verified in this QA pass with a fresh `git show`, not just trusted from the review doc).
- `prompt.pins.none` (`無`) — `PINS_NONE` const, rendered as `dispatch pins: 無` for e204 (asserted in `test/e177a-manifest.test.mjs` "AC6 render e177a").

No drift found. **No coverage gap**: every user-facing string in the CLI's output paths (`runValidate`/`runRender`/`runCheck`/`usageResult`/`formatError`) traces to a Copy/Strings row or to an `authored-here` error message whose wording is delegated to the sr-engineer by the spec's own text ("The remaining error codes ... use authored-here messages that name the offending section, lane, row number or cell"). Each authored-here message I sampled (`ROW_CELL_COUNT`, `OWNED_UNQUOTED_PATH`, `BRANCH_NOT_FEAT`, `REF_NOT_FOUND`, `REPO_NOT_GIT`, `LANE_NOT_FOUND`) does name the offending thing, per that delegation.

### 3b. Visual Audit Gate
N/A — spec's `Visual Tokens` and `Visual Widgets` tables both say "feature has no visual literals / no non-primitive widgets". No stylistic literal in this module (reporting-only CLI, no rendering surface beyond the plain-text prompt already covered by the Copy Audit Gate above).

## Phase 1.5 — Visual Compare
Phase 1.5: skipped (no Visual Baselines declared — no `design/e177a-fanout-manifest.md`).

## Phase 2 — Discussion
No issues found in Phase 1. Proceeding directly to Phase 3.

## Phase 3 — Tests

### Test File Discovery
No existing test file covers `tools/fanout-manifest.ts` (new module, first QA pass). Per the dispatch brief's Test-file placement line: NEW `test/e177a-manifest.test.mjs` (T-E177A-06: AC1-AC8, AC13, AC14) and NEW `test/e177a-check-cli.test.mjs` (T-E177A-07: AC9-AC12, AC15), fixtures under NEW `test/fixtures/e177a/**` (creation pre-authorized).

### Spec-to-Test Map
| AC | Test |
|---|---|
| AC1 | `test/e177a-manifest.test.mjs` "AC1 wave7 parses" |
| AC2 | "AC2 validate wave7 exit 0" |
| AC3 | "AC3 provisional lane refused" |
| AC4 | "AC4 legacy manifests fail loudly" |
| AC5 | "AC5 malformed manifests" |
| AC6 | "AC6 render e177a" (exact-string golden `test/fixtures/e177a/render-e177a.golden.txt`) |
| AC7 | "AC7 no lane-protocol text in prompt" |
| AC8 | "AC8 render field sources" |
| AC9 | `test/e177a-check-cli.test.mjs` "AC9 check in bounds" |
| AC10 | "AC10 check out of bounds" |
| AC11 | "AC11 E158 disclaimer" |
| AC12 | "AC12 check base and refs" |
| AC13 | `test/e177a-manifest.test.mjs` "AC13 decisions validation" |
| AC14 | "AC14 pins validation" |
| AC15 | `test/e177a-check-cli.test.mjs` "AC15 CLI contract" |
| AC16 | this file's Phase 4 run, below |

### Coverage Gate
Both new files exercise every exported function of `tools/fanout-manifest.ts` (`parseManifest`, `validateManifest`, `renderPrompt`, `checkLane`, `resolvePrimary`, `runValidate`, `runRender`, plus `scripts/fanout.mjs` end-to-end via `execFileSync`). Tooling cannot measure per-file coverage in this repo (no nyc/c8 wired into `npm test`), so this is a manual line-sweep: every branch in `parseLanes`/`parsePins`/`parseDecisions`/`renderPrompt`/`checkLane` that produces one of the `FANOUT_CODES` or an authored-here code is hit by at least one assertion above — cross-checked against every `code: "..."` / `FANOUT_CODES.*` literal in `tools/fanout-manifest.ts`. The only codes not directly asserted are `USAGE` (asserted indirectly via the no-subcommand/unknown-subcommand exit-2 checks) and `MANIFEST_UNREADABLE` (not spec-listed, an authored-here I/O-error path with no fixture value — accepted as an edge case that would need destructive fixture deletion to hit, out of proportion to its risk).

### Security Smoke Tests
- Boundary inputs: AC5's OWNED_EMPTY/ROW_CELL_COUNT cases are empty/malformed-cell boundaries; AC12's `does-not-exist` ref and non-git `--repo` dir are invalid-input boundaries; AC15's no-subcommand/unknown-subcommand are empty/unrecognized-argv boundaries.
- Auth/permission: N/A — this module has no access control surface (read-only CLI over local files + `git`, no network, no writes — confirmed again in this pass, matching code-reviewer's Security section).

## Phase 3.5 — AC Execution Log

Every AC in `specs/e177a-fanout-manifest.md` carries a `proof:` annotation (AC1-AC16). Executed against HEAD ed823b7 (test commit, clean tree) on this worktree.

- **AC1-AC14**: `node --test test/e177a-manifest.test.mjs test/e177a-check-cli.test.mjs` (matches the AC1 proof's `node --test test/e177a-*.test.mjs` glob). Output: `# tests 15`, `# pass 15`, `# fail 0`, exit 0. Every named test in the spec's proof lines ("AC1 wave7 parses" through "AC14 pins validation") appears in the `ok N - <name>` lines, 1:1.
- **AC15**: same run covers the named test "AC15 CLI contract" (passed). The proof's second half, `grep -c "from \"../dist/tools/fanout-manifest.js\"" scripts/fanout.mjs`, run directly: prints `1` (also asserted inside the test itself).
- **AC16**: `npm test` (full suite, includes `pretest`'s `npm run build`) run after the test commit (ed823b7), on a clean tree (`git status --porcelain` empty before the run). Result: **2663/2663 pass, 0 fail** (`# tests 2663`, `# pass 2663`, `# fail 0`, `# cancelled 0`), exit 0. No unrelated flakes observed — full suite green on first run, no rerun needed.

All proofs ran to completion with a PASS verdict; none contradicted its AC text. No FAIL under this section.

## Phase 4 — Run

- `npm run build`: 0 errors (part of `npm test`'s `pretest`, confirmed in the AC16 run above).
- CI runnability: `node --test test/*.test.mjs` runs headlessly, zero human interaction.
- Full suite: **2663/2663 pass** (see AC16 above).

**Verdict: PASS** for T-E177A-01..07 (AC1-AC16 all satisfied; code-review already APPROVED the implementation at round 2, d23a384; this QA pass independently re-verified every AC live rather than trusting the review doc, and authored the two test files T-E177A-06/07 that make AC1-AC16 machine-checked going forward). Completing all 7 tasks (T-E177A-01..07) via `tw_complete_task` per the qa-engineer SOP hard rule (QA owns completion for sr-engineer's tasks too).

## 2026-09-26T19:40:08.043Z — PASS — by qa-engineer

PASS — AC1-AC16 all satisfied. New test/e177a-manifest.test.mjs (T-E177A-06, AC1-AC8/AC13/AC14) + test/e177a-check-cli.test.mjs (T-E177A-07, AC9-AC12/AC15) authored and committed at ed823b7, 15/15 pass. Full npm test after commit on clean tree: 2663/2663 pass, 0 fail, exit 0 (AC16). Copy Audit Gate: every Copy/Strings row verbatim-matched in source, no drift, no coverage gap. No Visual Tokens/Widgets/Baselines (N/A). Phase 3.5 AC Execution Log recorded in qa_reports/review_T-E177A-06.md (covers T-E177A-01..07). code-reviewer round 2 APPROVED at d23a384 stands for T-E177A-01..05; this QA pass independently re-verified every AC live against real fixtures/temp git repos rather than trusting the review doc.

