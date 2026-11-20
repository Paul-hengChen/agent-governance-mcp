# e432-judge-report-checks — architecture

Spec: `specs/e432-judge-report-checks.md` (cut approved 2026-11-20; D2 ruled (a)). Plan row: `specs/fanout-v5-w3.md` lane e432 (owned / forbidden files binding). Builds on `specs/e431-test-first-server-path-architecture.md` (`judgeFor`, `resolveChainPath`, marker semantics). Line numbers are at base `5f50af1` (the two lane commits after it touch only `specs/` and `.current/`).

Design in one paragraph: **D1 — the judge report stays where qa-engineer's report is today: `qa_reports/review_<encodeEvidenceId(id)>.md`, same two section names, same `covers:` rule, on both chain paths.** Only the judge identity differs by chain path. One resolver, `resolveJudgeReport(workspacePath, chainPath?)` in `tools/evidence-file.ts`, returns `{ judge, dir }`: the judge comes from E431's `judgeFor`, the directory is one private constant. Every existence predicate already reads that directory regardless of who wrote the file, so the predicates change only where they take the directory from (the resolver instead of their own `path.join(workspacePath, "qa_reports")`). The orchestrator changes three steps: `QA_REVIEW_RECORD` and `QA_COMPLETION_EVIDENCE_MISSING` arm on the resolver's judge instead of the literal `"qa-engineer"`, and `REPRO_MANIFEST_MISSING` gains a second arm (marked qa → sr hand-off, skipped when `qa_reports/no-new-test_<feature>.txt` exists) inside its existing guard. lane-status accepts a PASS header by either judge identity; `scripts/release.mjs` takes `(code-reviewer, PASS)` when the handoff carries `chain_path: test-first`. No new module, no new code, no new pipeline step, no schema change. On an unmarked feature `resolveJudgeReport` returns `qa-engineer` and today's directory, so every unmarked branch computes today's values.

## Affected Files

| file | task | change |
|---|---|---|
| `tools/evidence-file.ts` | T-E432-01 | add `resolveJudgeReport`, `JudgeReport`, `JudgeIdentity`, `JUDGE_IDENTITIES`; import `judgeFor` (runtime) and `ChainPath` (type); header comment amended |
| `gates/expected-red.ts` | T-E432-01 | `noNewTestRecordPath`, `hasNoNewTestRecord` (D2); shared private feature-name sanitiser; review-file directory from the resolver (manifest directory unchanged) |
| `gates/ac-execution.ts` | T-E432-01 | review-file directory from the resolver |
| `gates/qa-review.ts` | T-E432-01 | `evidenceDir` body from the resolver (its name, `evidencePath`, `hasEvidenceInFile` and the export order untouched) |
| `tools/handoff-orchestrator.ts` | T-E432-02 | steps 7 (`REPRO_MANIFEST_MISSING`), 10 (`QA_REVIEW_RECORD`), 11 (`QA_COMPLETION_EVIDENCE_MISSING`); two import lines |
| `gates/registry.ts` | T-E432-02 | doc text (`triggerEdge` / `armCondition` / `clearingArtifact` and block comment) of `REPRO_MANIFEST_MISSING`, `QA_COMPLETION_EVIDENCE_MISSING`, `QA_REVIEW_TARGET_REQUIRED`; no `hintStatic`, no count change |
| `tools/registry.ts` | T-E432-02 (**amended in**) | `qa_review` and `qa_suite_result` property descriptions + the two zod comments above them (Copy desc.*) |
| `tools/evidence-lookup.ts` | T-E432-03 | root and archive directories from the resolver |
| `tools/lane-status.ts` | T-E432-03 | PASS-header regex accepts every judge identity; `qaDir` from the resolver |
| `CLAUDE.md` | T-E432-03 | line 80 only, in place (net 0 lines) |
| `scripts/release.mjs` | T-E432-04 | `releaseJudge`; s1 precondition, `--state` pre-input, release-gate line |
| `qa_reports/expected-red_e432-judge-report-checks.txt` | T-E432-04 | expected-red manifest (governance artifact, not counted) |
| `dist/**` | every sr task | `npm run build`; the diff holds only `dist/gates/{expected-red,ac-execution,qa-review,registry}.*` and `dist/tools/{evidence-file,evidence-lookup,handoff-orchestrator,lane-status,registry}.*` |
| `test/e432-*.test.mjs` + re-pins | T-E432-05..07 | qa-engineer only |

**Not touched** (amends the cut's touches list; all were conditional there): `gates/code-review.ts` (D1 does not pick `review_reports/`), `tools/storage.ts` (`FileHandoffStorage.hasEvidence` already reaches the resolver through `hasEvidenceInFile`), `tools/drift.ts` (reaches it through `hasEvidenceAnywhere`), `tools/storage-sqlite.ts`, `schema/**`, `gates/evidence-schema.ts`, `tools/transitions.ts`, `tools/handoff-{types,parse,write}.ts`, `gates/pipeline.ts`, `gates/visual.ts`, `tools/tasks.ts`, `index.ts`, every `content/**`, `README.md`, `CONTRIBUTING.md`, `docs/**`. No new `tools/*.ts` / `gates/*.ts` file, so no CLAUDE.md Layout row.

## Data Structures

### Judge report (D1)

| item | value (both chain paths unless stated) |
|---|---|
| judge | `qa-engineer` (unmarked) / `code-reviewer` (`chain_path: test-first`) = `judgeFor(chainPath)` |
| directory | `<workspace>/qa_reports` |
| per-id file | `review_<encodeEvidenceId(id)>.md` (unchanged; the stem stays with E136's encoder in each predicate) |
| `covers:` fallback | unchanged (`buildCoverageIndex` over the same directory) |
| archive | `qa_reports/archive/<feature>/` (release step 7a, unchanged) |
| expected-red disposition section | `## Expected-Red Diff` (unchanged, `gates/expected-red.ts` `DISPOSITION_HEADING`) |
| AC execution record section | `## AC Execution Log` (unchanged, `gates/ac-execution.ts`, matched with `sliceH2SectionAt` under the feature's evidence-schema pin) |
| server-recorded verdict header | `## <ISO ts> — PASS — by <judge>` / `## <ISO ts> — FAIL — by <judge>`; i.e. `— PASS — by code-reviewer` on a marked feature |
| new-file header written by the recorder | `# QA review — <id>` + `<!-- Auto-appended by tw_update_state(qa_review=...). -->` (unchanged, Open Question 5) |

### No-new-test record (D2, ruled (a))

`qa_reports/no-new-test_<safe feature>.txt`, `<safe feature>` = the manifest's sanitiser (`replace(/[^A-Za-z0-9._-]/g, "_")` then `replace(/\.\.+/g, "_")`). Existence only, content never read, file mode only. Not archived by release step 7a (spec Out of Scope).

### `tools/evidence-file.ts` additions (T-E432-01)

```ts
import type { ChainPath } from "./handoff-types.js";
import { judgeFor } from "./transitions.js";

// ---------- judge report (E432) ----------
// The per-task report a feature's judge writes and the PASS-time checks read:
// qa_reports/review_<encodeEvidenceId(id)>.md on both chain paths, with the same
// sections and covers: rule. Only the judge differs: qa-engineer, or
// code-reviewer on a test-first feature (chain_path: test-first). Every evidence
// check and reader takes the judge and the directory from resolveJudgeReport;
// the per-id stem stays with encodeEvidenceId.
export type JudgeIdentity = ReturnType<typeof judgeFor>;

export interface JudgeReport {
  readonly judge: JudgeIdentity;
  readonly dir: string; // absolute: <workspacePath>/qa_reports
}

const JUDGE_REPORT_DIRNAME = "qa_reports";

// Pure, no I/O, never throws. chainPath undefined (unmarked, SQLite, or a
// reader that sees several features) -> qa-engineer.
export function resolveJudgeReport(workspacePath: string, chainPath?: ChainPath): JudgeReport {
  return { judge: judgeFor(chainPath), dir: path.join(workspacePath, JUDGE_REPORT_DIRNAME) };
}

// Every identity that can judge a feature. For readers that see reports of
// several features (lane-status), which cannot pick one by a single marker (D8).
export const JUDGE_IDENTITIES: readonly JudgeIdentity[] = [judgeFor(undefined), judgeFor("test-first")];
```

Header comment: replace "This module imports nothing from gates/, keeping the import graph acyclic." with "It imports nothing from gates/ directly; its one runtime tools/ import, transitions.js (for judgeFor), depends only on gates/registry.ts, which imports nothing, so the import graph stays acyclic." Do **not** mention the lane-layout module's file name anywhere in this file (`test/lane-paths.test.mjs` CALLERS2 greps the literal across `tools/`).

## Interface Contracts

### `gates/expected-red.ts` (T-E432-01)

```ts
import { sliceH2Section, buildCoverageIndex, encodeEvidenceId, resolveJudgeReport } from "../tools/evidence-file.js";

// Manifest + record directory: qa's own artifacts, not the judge report, so it
// keeps its literal (the only "qa_reports" literal left in this file).
function qaReportsDir(workspacePath: string): string { return path.join(workspacePath, "qa_reports"); } // unchanged

// Private, shared by both artifact paths (same output as today's inline chain).
function safeFeatureName(activeFeature: string): string {
  return activeFeature.replace(/[^A-Za-z0-9._-]/g, "_").replace(/\.\.+/g, "_");
}
export function expectedRedManifestPath(workspacePath: string, activeFeature: string): string; // body uses safeFeatureName; output byte-identical

// D2 (ruling 10): qa records "this ticket needs no new test".
export function noNewTestRecordPath(workspacePath: string, activeFeature: string): string;
// = path.join(qaReportsDir(workspacePath), `no-new-test_${safeFeatureName(activeFeature)}.txt`)

// Same shape as hasExpectedRedManifest: existence only, empty feature -> not present, never throws.
export function hasNoNewTestRecord(
  workspacePath: string,
  activeFeature: string,
): { present: boolean; recordPath: string };

// Judge-report path: directory from the resolver, stem from encodeEvidenceId.
function reviewPath(workspacePath: string, taskId: string): string {
  return path.join(resolveJudgeReport(workspacePath).dir, `review_${encodeEvidenceId(taskId)}.md`);
}
// hasExpectedRedDisposition: `const dir = resolveJudgeReport(workspacePath).dir;` (was qaReportsDir). Signature unchanged.
```

### `gates/ac-execution.ts` (T-E432-01)

Rename the private `qaReportsDir` to `judgeReportDir` with body `return resolveJudgeReport(workspacePath).dir;`; `reviewPath` and `hasAcExecutionLogDisposition` call it. `specFilePath`, `hasProofAnnotatedAC`, `DISPOSITION_HEADING`, every export signature and `checkedPaths` semantics unchanged. Import adds `resolveJudgeReport`.

### `gates/qa-review.ts` (T-E432-01)

Only `evidenceDir`'s body: `return resolveJudgeReport(workspacePath).dir;`. Import adds `resolveJudgeReport`. `evidencePath`, `qaEvidencePath`, `recordReviewInFile*` and `hasEvidenceInFile` (still the last export, body untouched) unchanged. `recordReviewInFileUndoable` already takes `reviewer` as a parameter, so it writes `— by code-reviewer` when the orchestrator passes it.

### `tools/handoff-orchestrator.ts` (T-E432-02)

Imports: line 42 → `import { hasExpectedRedManifest, hasExpectedRedDisposition, hasNoNewTestRecord } from "../gates/expected-red.js";`; add `import { resolveJudgeReport } from "./evidence-file.js";`. Leave the `../gates/visual.js` import alone (`test/context-budget.test.mjs:977-990`).

**Step 7 `REPRO_MANIFEST_MISSING`** — body becomes (existing comment kept, one paragraph added):

```ts
      const { parsed, storage, prevState, prevTuple, nextTuple } = ctx;
        // ...existing repro-first comment...
        // Test-first hand-off (E432): on a marked feature the same manifest is
        // also required when qa-engineer hands the tests to sr-engineer, unless
        // qa recorded qa_reports/no-new-test_<feature>.txt (ruling 10). Existence
        // only. Bug tickets share the manifest (ruling 4): the bugfix check
        // below still runs on sr -> code-reviewer and never asks who wrote it.
        const bugfixHandOff =
          prevState?.dispatch_mode === "bugfix" &&
          prevTuple.agent === "sr-engineer" &&
          prevTuple.status === "In_Progress" &&
          nextTuple.agent === "code-reviewer" &&
          nextTuple.status === "In_Progress";
        const testFirstHandOff =
          resolveChainPath(ctx) === "test-first" &&
          prevTuple.agent === "qa-engineer" &&
          (prevTuple.status === "In_Progress" || prevTuple.status === "Blocked") &&
          nextTuple.agent === "sr-engineer" &&
          nextTuple.status === "In_Progress";
        const noNewTest = testFirstHandOff
          ? hasNoNewTestRecord(parsed.workspace_path, parsed.active_feature)
          : null;
        if (
          storage instanceof FileHandoffStorage &&
          (bugfixHandOff || (noNewTest !== null && !noNewTest.present))
        ) {
          const manifest = hasExpectedRedManifest(parsed.workspace_path, parsed.active_feature);
          if (!manifest.present) {
            if (noNewTest !== null) {
              return { content: [{ type: "text" as const, text: /* Copy msg.qa_to_sr_manifest */ }], isError: true };
            }
            return { /* today's object, byte-identical: `⛔ REPRO_MANIFEST_MISSING: ${feature}. Expected repro manifest at ${path}. ` + hintStatic */ };
          }
        }
      return null;
```

- `resolveChainPath(ctx) === "test-first"` implies `FileHandoffStorage`, so `hasNoNewTestRecord` (the only new fs call) never runs in SQLite or on an unmarked feature.
- `testFirstHandOff` and `bugfixHandOff` are disjoint (different `prevTuple.agent`), so a marked bugfix feature gets the qa → sr check and then the unchanged bugfix check on sr → code-reviewer (AC7).
- The `if (` line keeps the exact text `if (\n          storage instanceof FileHandoffStorage &&`, and the first `hasExpectedRedManifest(parsed.workspace_path` call stays directly inside it (I5b; the condition holds no `\n        }\n`).

**Step 10 `QA_REVIEW_RECORD`** — first statement after the destructure:

```ts
        const judge = resolveJudgeReport(parsed.workspace_path, resolveChainPath(ctx)).judge;
```

Arm condition `parsed.agent_id === "qa-engineer"` → `parsed.agent_id === judge`; the three record calls pass `judge` instead of the literal `"qa-engineer"`. Ids, `QA_REVIEW_TARGET_REQUIRED` text, `composeQaReviewNotes`, the undo registration: unchanged. Comment: "Fires only on a PASS/FAIL write by the feature's judge (qa-engineer; code-reviewer on a test-first feature, E432) with qa_review."

**Step 11 `QA_COMPLETION_EVIDENCE_MISSING`** — first statement after the destructure:

```ts
        const chainPath = resolveChainPath(ctx);
        const judge = resolveJudgeReport(parsed.workspace_path, chainPath).judge;
```

Arm `parsed.agent_id === "qa-engineer"` → `parsed.agent_id === judge`. Inside the rejection, keep the `expectedPaths` computation and the first two text pieces; the tail is `gate("QA_COMPLETION_EVIDENCE_MISSING").hintStatic` when `chainPath !== "test-first"` (today's text), else the Copy suffix `msg.completion_evidence_marked`. Comment: "A write by the feature's judge (qa-engineer; code-reviewer on a test-first feature, E432) whose completed_tasks adds ids ..."

**Steps not edited** (they already read the judge report wherever the resolver puts it): 13 `PASS_MISSING_EVIDENCE` (`storage.hasEvidence` → `hasEvidenceInFile` → resolver), 15 `PASS_EXPECTED_RED_DIFF`, 16 `PASS_AC_EXECUTION_LOG` (dispositions → resolver), 17 `MISSING_REVIEW_EVIDENCE` (unchanged; marked features never take its edge). Steps 1–6, 8, 9, 12, 14 unchanged.

### `gates/registry.ts` (T-E432-02)

Doc fields only; `hintStatic`, `errorCode`, `producer`, `envelope`, `documentedInProse`, order, the mapping comment and the `(none)` row are untouched.

| entry | field | new text |
|---|---|---|
| `REPRO_MANIFEST_MISSING` | block comment | add: `// E432: also arms on qa-engineer:In_Progress|Blocked -> sr-engineer:In_Progress on a test-first feature (chain_path: test-first) unless qa_reports/no-new-test_<feature>.txt exists (hasNoNewTestRecord); marker-specific message, no hintStatic.` |
| | `triggerEdge` | `"sr-engineer:In_Progress -> code-reviewer:In_Progress (bugfix), or qa-engineer:In_Progress|Blocked -> sr-engineer:In_Progress on a test-first feature (chain_path: test-first) (file-mode only)"` |
| | `armCondition` | `"prevState.dispatch_mode === bugfix on the sr -> code-reviewer edge, or resolveChainPath() === test-first on the qa -> sr edge without a no-new-test record (hasNoNewTestRecord); FileHandoffStorage only"` |
| | `clearingArtifact` | `"qa_reports/expected-red_<feature>.txt present (hasExpectedRedManifest); on the test-first qa -> sr edge, qa_reports/no-new-test_<feature>.txt present also clears (hasNoNewTestRecord)"` |
| `QA_COMPLETION_EVIDENCE_MISSING` | block comment | first sentence gains `(E432: the feature's judge — code-reviewer on a test-first feature — is armed the same way)` |
| | `triggerEdge` | `"any write by the feature's judge (qa-engineer; code-reviewer on a test-first feature, chain_path: test-first) whose completed_tasks adds ids not in the on-disk completed set — no edge/status/verdict exemption (file-mode only)"` |
| | `armCondition` | `"agent_id === resolveJudgeReport().judge && newly-added completed ids non-empty && hasEvidenceInFile(newIds).missing non-empty; FileHandoffStorage only"` |
| `QA_REVIEW_TARGET_REQUIRED` | `triggerEdge` | `"PASS/FAIL write by the feature's judge (qa-engineer; code-reviewer on a test-first feature) carrying qa_review with review_task_ids and completed_tasks both empty"` |
| | `armCondition` | `"qa_review present && agent_id=judge (qa-engineer; code-reviewer on a test-first feature) && status in {PASS, FAIL}"` — must stay free of camelCase identifiers (it is in `FREE_TEXT_ALLOWLIST`) |

Every camelCase identifier in the two checked `armCondition`s (`prevState`, `resolveChainPath`, `hasNoNewTestRecord`, `resolveJudgeReport`, `hasEvidenceInFile`, `newIds`) appears literally in the orchestrator source after T-E432-02 (`test/error-code-contract.test.mjs:400-416`).

### `tools/registry.ts` (T-E432-02, amended in)

Description strings of the `tw_update_state` properties `qa_review` and `qa_suite_result` (Copy desc.*) and the zod comments at lines 307-309, 311-315 (`(agent_id === "qa-engineer")` → `(agent_id is the feature's judge: qa-engineer; code-reviewer on a test-first feature)`; `qa's structured suite figures` → `the judge's structured suite figures`). Tool-level descriptions (pinned by `test/e441-tool-description-contracts.test.mjs`), the `completed_tasks` description (`test/e150-completed-tasks-carry-forward.test.mjs:492-500`), zod shapes and refines are untouched. No test pins either property description (grep 2026-11-20).

### `tools/evidence-lookup.ts` (T-E432-03)

Import adds `resolveJudgeReport`. `archivedFeatureDirs`: `const archiveRoot = path.join(resolveJudgeReport(workspacePath).dir, "archive");`. `hasEvidenceAnywhere`: `const qaReportsDir = resolveJudgeReport(workspacePath).dir;`. `VERDICT_HEADING_RE` (`— PASS|FAIL — by .+`) is already author-agnostic, so a judge report whose last header is `— PASS — by code-reviewer` qualifies and a FAIL-last one does not (AC8). Header comment: "Archive-aware lookup of the judge report (resolveJudgeReport, tools/evidence-file.ts)". `sanitizeTaskId` keeps calling `encodeEvidenceId`.

### `tools/lane-status.ts` (T-E432-03)

```ts
import { decodeEvidenceId, parseCoversIds, resolveJudgeReport, JUDGE_IDENTITIES } from "./evidence-file.js";
// The section header gates/qa-review.ts recordReviewInFile writes for a PASS
// round by the feature's judge: `## <iso-ts> — PASS — by qa-engineer`, or
// `— by code-reviewer` on a test-first feature (AC5b; E432, ruling 6).
const JUDGE_PASS_HEADER_RE = new RegExp(`^##\\s.*\\s—\\sPASS\\s—\\sby (?:${JUDGE_IDENTITIES.join("|")})\\b`, "m");
```

`passEvidenceIdsIn` tests `JUDGE_PASS_HEADER_RE`; `checkLaneEvidence`: `const qaDir = resolveJudgeReport(workspacePath).dir;`. The `scope` / `archiveNote` output strings, the decode line `decodeEvidenceId(m[1]) ?? m[1]`, and everything after `// Watch mode (E178b` are unchanged. The JSDoc above `passEvidenceIdsIn` says "a `— PASS — by <judge>` section header (qa-engineer or code-reviewer)". Not gated on the lane's marker (D8, Open Question 2).

### `scripts/release.mjs` (T-E432-04)

```js
// The release gate's judge (E432, 16.1 ruling 6): code-reviewer on a test-first
// feature (chain_path: test-first), else qa-engineer. Mirrors judgeFor in
// tools/transitions.ts; kept local because each dist module this script loads
// is an injected dependency in the release tests.
const releaseJudge = (state) => (state?.chain_path === "test-first" ? "code-reviewer" : "qa-engineer");
```

- `preInputs` (line 304-305): `const judge = releaseJudge(state);` `pass = state?.last_agent === judge && ...`; message `` `--state must be a (${judge}, PASS) snapshot with an active_feature (got ${state?.last_agent}, ${state?.status})` ``.
- `stepPrecondition` (1225-1238): `notPass = (why, judge = "qa-engineer") => new ReleaseStop("PRECONDITION_NOT_PASS", `${handoff} ${why} — commit the release gate's (${judge}, PASS) write to main first`)`. The "does not exist" / "cannot be parsed" stops keep the default. After parse: `const judge = releaseJudge(state);` `if (state.last_agent !== judge || state.status !== "PASS") throw notPass(`is (${...}, ${...}), expected (${judge}, PASS)`, judge);`. Comment line 1225 → `// s1: the release gate is the checkout's own lane handoff at (judge, PASS): (qa-engineer, PASS), or (code-reviewer, PASS) on a test-first feature.`
- `commitMessage({ ..., judge = "qa-engineer" })`: `` `Release gate: ${activeFeature} (${judge} PASS committed to main).` ``; `stepMessage` passes `judge: releaseJudge(ctx.state)`.
- Unmarked, every string is today's: `(qa-engineer, PASS)` and `qa-engineer PASS`.

### Copy (architect-authored; spec rows used verbatim)

| id | text |
|---|---|
| msg.qa_to_sr_manifest | spec row verbatim: `` `⛔ REPRO_MANIFEST_MISSING: ${parsed.active_feature}. Test-first hand-off qa-engineer → sr-engineer needs the red-test manifest at ${manifest.manifestPath}, or the no-new-test record at ${noNewTest.recordPath} when the ticket needs no new test. Write one of them, then hand off again.` `` — no `hintStatic` |
| msg.completion_evidence_marked | the unchanged prefix `` `⛔ QA_COMPLETION_EVIDENCE_MISSING: ${ev.missing.join(", ")}. Expected evidence file(s): ${expectedPaths} (or an existing qa_reports/ report covering the id via a covers: line). ` `` followed by `On a test-first feature (chain_path: test-first) code-reviewer is the judge: write its report for each newly added id first (qa_review with review_task_ids on a PASS/FAIL write, or the report file), or drop the unevidenced ids from completed_tasks.` — no `hintStatic` (it names qa-engineer and the APPROVED handoff) |
| msg.release_judge | spec row; produced as `(${judge}, PASS)` in the two stops and `${judge} PASS` in the release-gate line |
| desc.qa_review | `Review notes. Recorded as evidence when agent_id is the feature's judge ("qa-engineer"; "code-reviewer" on a test-first feature, chain_path: "test-first") and status in {PASS, FAIL}.` |
| desc.qa_suite_result | today's text with `Optional structured suite result for a qa-engineer PASS/FAIL write` → `Optional structured suite result for a PASS/FAIL write by the feature's judge (qa-engineer; code-reviewer on a test-first feature)` and `(agent_id "qa-engineer", status PASS or FAIL, qa_review set)` → `(agent_id the feature's judge, status PASS or FAIL, qa_review set)`; the rest byte-identical |

## Sequence Diagram

```mermaid
sequenceDiagram
  participant QA as qa-engineer
  participant SR as sr-engineer
  participant CR as code-reviewer (judge)
  participant S as server (tw_update_state)
  participant R as readers (drift, lane-status, release.mjs)
  Note over QA: writes tests + qa_reports/expected-red_F.txt,<br/>or qa_reports/no-new-test_F.txt
  QA->>S: sr-engineer:In_Progress (marked F)
  Note over S: step 7: testFirstHandOff → manifest OR record must exist,<br/>else REPRO_MANIFEST_MISSING (msg.qa_to_sr_manifest)
  SR->>S: code-reviewer:In_Progress
  Note over S: step 7: bugfix arm only if dispatch_mode=bugfix (manifest by qa or sr)
  Note over CR: writes qa_reports/review_T1.md with<br/>## Expected-Red Diff + ## AC Execution Log
  CR->>S: code-reviewer:PASS, completed_tasks=[T1], qa_review
  Note over S: step 10: judge = resolveJudgeReport(ws, test-first).judge = code-reviewer<br/>→ appends "## ts — PASS — by code-reviewer" (undoable)
  Note over S: step 11: arms on judge; newIds [T1] need review_T1.md
  Note over S: steps 13/15/16: hasEvidence / dispositions read resolveJudgeReport(ws).dir
  S-->>CR: accepted (status PASS, last_agent code-reviewer)
  R->>S: (reads disk / handoff)
  Note over R: drift: last header PASS → T1 evidence-backed<br/>lane-status: "— PASS — by code-reviewer" counts<br/>release.mjs: (code-reviewer, PASS) + chain_path → s1 ok
```

## Old-Path Byte-Identity (per step and reader)

An *unmarked write*: no `chain_path` persisted for the same feature and none on a set point, or any SQLite write. `resolveChainPath(ctx)` is `undefined` for all of them (E431), so `resolveJudgeReport(ws, undefined)` = `{ judge: "qa-engineer", dir: path.join(ws, "qa_reports") }`.

| step / reader | why the unmarked outcome is identical |
|---|---|
| 1–6, 8, 9, 12, 14, 17 | source not edited |
| 7 `REPRO_MANIFEST_MISSING` | `testFirstHandOff` is false, so `noNewTest` is null and the condition reduces to `storage instanceof FileHandoffStorage && bugfixHandOff`, today's six conjuncts (moved into a const, all side-effect-free); same manifest call, same `noNewTest === null` branch → today's text + `hintStatic`. No new fs call. |
| 10 `QA_REVIEW_RECORD` | `judge === "qa-engineer"`: same arm, same `reviewer` value to the same three record calls → same bytes (file) and rows (SQLite) |
| 11 `QA_COMPLETION_EVIDENCE_MISSING` | same arm; `chainPath !== "test-first"` picks today's `hintStatic` tail; paths from `qaEvidencePath`, whose directory value is unchanged |
| 13 `PASS_MISSING_EVIDENCE` | code unchanged; `hasEvidenceInFile` checks the same paths (`evidenceDir` returns the same string); SQLite `hasEvidence` untouched |
| 15, 16 | code unchanged; `hasExpectedRedDisposition` / `hasAcExecutionLogDisposition` read the same files and fill `checkedPaths` with the same strings in the same order |
| `expectedRedManifestPath` | same sanitiser output (refactored into `safeFeatureName`) |
| drift / `hasEvidenceAnywhere` | same directories; verdict rule untouched |
| lane-status | same directory and strings; the regex additionally accepts `— PASS — by code-reviewer`, a header no server path writes on an unmarked feature (`QA_REVIEW_RECORD` passes `qa-engineer` there); `review_reports/` is never read (AC9) |
| `scripts/release.mjs` | `releaseJudge` = `qa-engineer` without the marker: every condition and string is today's (AC10) |
| telemetry | no new rejection on an unmarked write, so no new line |
| SQLite | `tools/storage-sqlite.ts`, `schema/migrations-sqlite.ts` untouched; `CURRENT_VERSIONS.sqlite` 2 (D3) |

The one deliberate behaviour change on any path: a marked feature (E431 already marks only on the new path) now gets the evidence checks E431 deferred.

## Source-Text Pin Compliance

| pin | how this design keeps it |
|---|---|
| `test/gates-expected-red.test.mjs:304-340` I5b | still exactly two `hasExpectedRedManifest(parsed.workspace_path` sites; site 1 directly under `if (\n          storage instanceof FileHandoffStorage &&` (consts are declared above the `if`, the condition contains no `\n        }\n`); site 2 (step 15) untouched. The record check uses a different name (D5). |
| `test/ac-execution.test.mjs:361-370` I5b | step 16 untouched |
| `test/e247-pass-tasks-incomplete.test.mjs:188-189` | step 12 untouched |
| `test/qa-flow.test.mjs:599-603` | rollback messages untouched |
| `test/error-code-contract.test.mjs:227-236,400-416` | no new code; every camelCase name in the edited `armCondition`s is in the orchestrator source; `QA_REVIEW_TARGET_REQUIRED.armCondition` stays camelCase-free (allowlisted); `triggerEdge`s edited are all allowlisted free text |
| `test/error-code-contract.test.mjs:118-125,476-501,638-683` | 35 entries, mapping comment and `documentedInProse` unchanged |
| `test/visual-evidence-gate.test.mjs:573-640` | build-entry steps untouched |
| `test/context-budget.test.mjs:977-990` | the `../gates/visual.js` import line untouched |
| `test/e308-single-source-tier-enum.test.mjs:14-30,92-94` | no tier array added; 35 entries |
| `test/covering-evidence.test.mjs:290-310,372-395` | `hasEvidenceInFile` / `hasCodeReviewEvidenceInFile` stay last exports with bodies untouched; only `evidenceDir`'s body changes (`buildCoverageIndex(evidenceDir(workspacePath))` text kept); `gates/code-review.ts` untouched |
| `test/e136-evidence-path-injective.test.mjs:146-156` | each of the six files keeps calling `encodeEvidenceId` for the stem; no `taskId.replace(` |
| `test/e295-hop-cap-and-sop-halves.test.mjs:122-128`, `test/e431-test-first-server-path.test.mjs:686-715` | no new code; pipeline 17 steps, names and order unchanged |
| `test/e177b-lane-status.test.mjs:133-140`, `test/e235b-relative-worktree.test.mjs:273-278` | no `fanout` text added to lane-status code lines |
| `test/e178b-lane-watch.test.mjs:541-548` | edits are above `// Watch mode (E178b` (lines 19, 211-213, 264-298, 339) |
| `test/e367-lane-status-decode.test.mjs:111-116` | `decodeEvidenceId` stays inside the `{...} from "./evidence-file.js"` import; `decodeEvidenceId(m[1]) ?? m[1]` kept; no `ids.add(m[1])` |
| `test/lane-paths.test.mjs:305-330,347-353,600-620` | the resolver touches no lane-layout API and no edited file names the lane-paths module or `resolveCurrentLane`; lane-status's existing import is unchanged |
| `test/e150-completed-tasks-carry-forward.test.mjs:478-500` | `tools/drift.ts` and the `completed_tasks` description untouched |
| `test/writestate-options-object.test.mjs:150-155` | `tools/storage.ts` untouched |
| release pins (`release-staging:38-45`, `e164-e167:25`, `e166:67`, `e297:51-70`, `e336:53`, `verify-release:1139-1141`, `e405:280-305,561,799-834`, `e394`) | function names, pull flags, PR flow and `RELEASE_STOP PRECONDITION_NOT_PASS:` prefix unchanged; unmarked strings unchanged (`e405:257,561` assert `(qa-engineer PASS committed to main)` via the default `judge`) |
| `test/skill-evolution-v3.11.test.mjs:74-82`, `test/subagent-templates.test.mjs:505-511`, `test/e23-evidence-schema.test.mjs:102,552-570`, `test/e114:384-391`, `test/e26:585-590` | `schema/versions.ts`, `gates/evidence-schema.ts` and the pinned `tools/registry.ts` parts untouched |
| `test/e436-stale-handoff-paths.test.mjs`, `test/e395-claude-md-tail.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs:132-142` | CLAUDE.md: only line 80's description text changes; 250 lines; lines 13/44/64/195/220/221, the e395 block (91–101) and the stamp untouched |

## Task Budget Map (per-task file map)

`dist/` is regenerated by `npm run build` after each task and not counted. Execution order T-01, T-02, T-03, T-04 (ledger order).

| task | files (count) | est. lines | depends | notes |
|---|---|---|---|---|
| T-E432-01 | `tools/evidence-file.ts`, `gates/expected-red.ts`, `gates/ac-execution.ts`, `gates/qa-review.ts` (4) | ~80 | none | `gates/code-review.ts` dropped (D1) |
| T-E432-02 | `tools/handoff-orchestrator.ts`, `gates/registry.ts`, `tools/registry.ts` (3) | ~95 | T-01 | **amended**: `tools/storage.ts` slot (not needed) replaced by `tools/registry.ts` descriptions (inside the plan's lane row: "`tw_update_state` input schema, refine and descriptions") |
| T-E432-03 | `tools/evidence-lookup.ts`, `tools/lane-status.ts`, `CLAUDE.md` (3) | ~25 | T-01 | **amended**: `tools/drift.ts` dropped (reaches the resolver through `hasEvidenceAnywhere`); CLAUDE.md line 80 → `tools/evidence-file.ts    file-mode QA evidence write/check (v3.2.0) + judge-report resolver (E432)`; line 93 stays (its locations do not change) |
| T-E432-04 | `scripts/release.mjs` (1 + manifest) | ~20 | T-02, T-03 | `npm run build`; write `qa_reports/expected-red_e432-judge-report-checks.txt` from the actual reds of the full suite (predictions below) |
| T-E432-05..07 | qa-engineer | — | — | unchanged |

The ledger rows keep their text; this file map governs where it is narrower. The cut's touches list loses `gates/code-review.ts`, `tools/storage.ts`, `tools/drift.ts`, `dist/gates/{code-review,evidence-schema}.*`, `dist/tools/{drift,storage,storage-sqlite,transitions,handoff-types,handoff-parse,handoff-write}.*` and gains `tools/registry.ts` (already `dist/tools/registry.*` there).

## Test Impact

**New (qa, T-E432-05)** — guidance per AC where the blueprint fixes the observable:
- Locate paths only through exports: `resolveJudgeReport(ws, chainPath).dir`, `expectedRedManifestPath`, `noNewTestRecordPath`, `qaEvidencePath`.
- AC3 last sentence is vacuous under D1: assert `resolveJudgeReport(ws).dir === resolveJudgeReport(ws, "test-first").dir`.
- AC5: also cover `qa-engineer:Blocked → sr-engineer:In_Progress` on a marked feature (Open Question 1).
- AC13 static part: each of `gates/qa-review.ts`, `gates/expected-red.ts`, `gates/ac-execution.ts`, `tools/evidence-lookup.ts`, `tools/lane-status.ts`, `tools/handoff-orchestrator.ts` matches `/import\s*\{[^}]*\bresolveJudgeReport\b[^}]*\}\s*from\s*"(\.\.\/tools|\.)\/evidence-file\.js"/`; the double-quoted literal `"qa_reports"` is absent from `gates/qa-review.ts`, `gates/ac-execution.ts`, `tools/evidence-lookup.ts`, `tools/lane-status.ts`, appears exactly once in `gates/expected-red.ts` (`qaReportsDir`, the manifest / record directory) and is present in `tools/evidence-file.ts`. Behavioural part: `resolveJudgeReport(ws)` → `{ judge: "qa-engineer", dir: <ws>/qa_reports }`, `(ws, "test-first")` → `code-reviewer`, same dir; `JUDGE_IDENTITIES` deep-equals `["qa-engineer", "code-reviewer"]`.
- AC11 base build: `git archive 5f50af1 dist package.json | tar -x -C "$TMPDIR/e432-base"` + `ln -s <worktree>/node_modules "$TMPDIR/e432-base/node_modules"`; import both `dist/` trees.

**Expected red after the sr run (prediction; the manifest lists what actually runs red)** — all in `test/e431-test-first-server-path.test.mjs` (lane-owned), each hands a marked feature qa → sr with neither file in a fresh workspace, which AC5 now rejects: `AC1: marked pm -> qa-engineer ...` (line 107), `AC5: after code-reviewer FAIL -> qa ...` (184), `AC6: third sr -> qa return ...` (209), `AC7: code-reviewer rejections to qa and to sr ...` (245), `AC10: marker survives omitting writes ...` (359). Re-pin (T-E432-06): write `qa_reports/no-new-test_<F>.txt` in each fixture before the qa → sr write; assertions unchanged. This corrects the spec's "none expected" for T-E432-06.

**Expected green, checked against the source**: `e431` AC3 (line 155; `completed_tasks` empty, the new record of `review_T-1.md` is harmless), AC15 marked (604: the code-reviewer `FAIL` with `completed_tasks: ["T-1"]` now fails `QA_COMPLETION_EVIDENCE_MISSING`, and the test asserts only the absence of `REVIEWER_COMPLETED_TASKS_REJECTED`), AC12 old-chain tests; `e161-qa-suite-result` (unmarked recorder bytes); `repro-first-gate`; the drift, archive-lookup, lane-status (no test asserts a `— by code-reviewer` header is ignored) and release groups; every pin in the table above.

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| D1 judge-report location | Keep `qa_reports/review_<id>.md`, same sections, judge recorded as `— by code-reviewer`; `QA_REVIEW_RECORD` extended to the judge | Every existence predicate, the `covers:` rule, release step 7a archiving and drift already handle it; no `review_reports/` change, no new recorder, no new header in a tree of APPROVED/CHANGES_REQUESTED notes; AC3's old-location sentence becomes vacuous |
| Alternative: `review_reports/review_<id>.md` | Rejected | Needs an undoable code-review recorder, a PASS header in `review_reports/`, `gates/code-review.ts` edits under the covering-evidence pins, and drift / lane-status filters that must not count today's code-review notes |
| Resolver shape | `{ judge, dir }`; the per-id stem stays with `encodeEvidenceId` in each predicate | E136's pin (each file uses `encodeEvidenceId`) stays honest; the two things that could vary by path (judge, directory) are single-sourced |
| Where `judge` comes from | `resolveJudgeReport` calls E431's `judgeFor` (runtime import of `./transitions.js` into `tools/evidence-file.ts`) | One judge rule; evidence-file now loads `gates/registry.ts` transitively (no cycle: registry imports nothing); header comment updated |
| Resolver module (D6) | `tools/evidence-file.ts`, no new module | No CLAUDE.md row, no e395/e391 reflow; line 80 gains a description suffix |
| Manifest / record directory | Keeps its own `qa_reports` literal in `gates/expected-red.ts`, not the resolver's | The judge-report location can move later without moving qa's artifacts; AC13 checks that exactly one literal remains there |
| qa → sr check placement (D4/D5) | Second arm inside the existing `REPRO_MANIFEST_MISSING` guard; booleans precomputed above the `if` | Registry 35, pipeline 17, I5b green; bugfix arm reordered into a const, value-identical |
| Prev status of the qa → sr arm | `In_Progress` or `Blocked` | Closes the marked `qa-engineer:Blocked → sr-engineer` bypass (Open Question 1) |
| Marked `QA_COMPLETION_EVIDENCE_MISSING` text | Shared prefix + marker suffix, no `hintStatic` | `hintStatic` names qa-engineer and the APPROVED handoff; E431 OQ4 precedent |
| lane-status identity filter | Accept a PASS header by any judge identity, not gated on the lane's marker (D8) | Evidence of an archived or earlier marked feature still counts; unmarked lanes read the same (Open Question 2) |
| release.mjs judge rule | Local `releaseJudge` reading `state.chain_path` | No new dist import or injected dependency in the release tests; one restated rule (Open Question 3) |
| Field descriptions | Reword `qa_review` / `qa_suite_result` in `tools/registry.ts` | The tool contract tells a test-first judge its `qa_review` is recorded; unpinned strings; task T-E432-02 amended |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites records zero external references (`external_refs: []`); nothing was marked ignore or defer._

Deferred by scope (not external resources): SOP / constitution prose telling qa to write the manifest or the no-new-test record and the judge to write its report, and rewording the qa-named hints (E433); visual evidence on the marked path (E434); SQLite support for the marked path and removing the old path (E435); archiving `no-new-test_*.txt` (spec Out of Scope).

## Open Questions

All items are `architect default`; none needs a human ruling. They go to the integrator's second pre-review, which can overturn any of them before sr-engineer starts.

1. **The qa → sr manifest check also arms on `qa-engineer:Blocked → sr-engineer:In_Progress`** — `architect default`. E431 left that edge open on both paths. Example: marked feature e450-readme-typo; qa-engineer writes `qa-engineer:Blocked` ("spec ambiguity"), pm clarifies in chat, qa then hands straight to `sr-engineer:In_Progress` without writing the manifest or the record. With the default: rejected `REPRO_MANIFEST_MISSING` (msg.qa_to_sr_manifest) until one file exists — the same rule as from `In_Progress`. With AC5's literal edge only: accepted, and sr builds against tests nobody declared, which is what user story 3 forbids. Unmarked features are unaffected either way (the marker guards the arm).
2. **lane-status counts a `— PASS — by code-reviewer` header in any lane, marked or not** — `architect default` (D8). Example: lane e451 ran marked e451-drift-crash to PASS, its report stays in `qa_reports/`, and the lane then starts unmarked e451b with ids carrying the same ticket token. With the default the earlier judge PASS still counts as evidence; gating on the current marker would drop it. Delta on an unmarked lane: only a hand-written `— PASS — by code-reviewer` header in `qa_reports/`, which no server path writes there.
3. **`scripts/release.mjs` restates the judge rule (`chain_path === "test-first"` → code-reviewer)** instead of importing `judgeFor` from `dist/` — `architect default`. The release tests inject every `dist/` module the script loads; another import would add a dependency hook to `test/e405-release-runner.test.mjs` fixtures. E435 removes the rule with the old path.
4. **`MISSING_EVIDENCE`, `EXPECTED_RED_DIFF_MISSING` and `AC_EXECUTION_LOG_MISSING` keep one text on both paths** — `architect default`. Their `hintStatic`s name skill-qa-engineer phases; on a marked feature code-reviewer reads "Run Phase 0.5 (skill-qa-engineer)". The codes and paths are right; E433 writes the judge's SOP steps and is the place to reword. Only `QA_COMPLETION_EVIDENCE_MISSING` gets a marked variant, because its hint gives an instruction that is wrong there (carry scope on the APPROVED handoff).
5. **A judge report first created by the server still starts `# QA review — <id>`** — `architect default`. Changing it for code-reviewer would fork the recorder's bytes for a cosmetic heading; no check reads it.
6. **`tools/registry.ts` field descriptions reworded (task T-E432-02 amended)** — `architect default`. No test pins the two strings; leaving them would tell a test-first judge its `qa_review` is ignored.
