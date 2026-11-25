# e448-judge-evidence-checks — architecture

> Blueprint for `specs/e448-judge-evidence-checks.md` (cut human-approved 2026-11-25). Authored by @architect.
> Types, signatures and placement contracts only — no implementation bodies. Line numbers are base `70d34c6`.
> Answers the cut's architect questions: (1) where the one PASS-evidence predicate lives and who calls it;
> (2) how `EVIDENCE_SCHEMA_CURRENT = 3` arms the Allowed Differences check; (3) the E448 arming point for
> pipeline step 17 and its registry metadata; plus the expected-red pin threading, lane-status anchoring,
> the E451 header anchors and the E460 `isError` flag.

Integrator pre-review rulings applied (authoritative over the branch copy of `specs/fanout-pre-v5-w1.md`):
the 15 previously unowned red test files are owned by this lane; `test/e433-test-first-rules.test.mjs` AC9
(base ~:462) is re-pinned by T-E448-10; drift keeps crediting verdict-less reports (`test/e112` pin kept);
E458 (8) covers 18 hints including `CUT_APPROVAL_REQUIRED`; the review-evidence check is file-mode only; no
`chain_path` field.

Hard constraints honoured throughout: `GATE_REGISTRY.length` stays 33; `UPDATE_STATE_GATE_PIPELINE` keeps its
17 step names in order (`test/e35-pipeline-order.test.mjs`); no `content/**`, `schema/**`, `tools/registry.ts`,
`tools/transitions.ts`, `tools/storage*.ts` or other `tools/handoff-*.ts` edits; no new `tools/*.ts` file; the
`hasDesignModeRequiringVisual` import line in `tools/handoff-orchestrator.ts` is untouched.

## Affected Files

| file | action | task | what changes |
|---|---|---|---|
| `tools/evidence-file.ts` | modify | T-12, T-14 | T-12: one exported Region Diff row parser with the anchored header skip; anchored Structural Assertions header skip. T-14: **the shared report-standing predicate** (`judgeReportStanding`, `isPassStanding`, `ReportStanding`). |
| `gates/qa-review.ts` | modify | T-14 | new `hasPassEvidenceInFile` (file-mode PASS rule), placed **above** `hasEvidenceInFile`; `hasEvidenceInFile` byte-unchanged; header comment updated. |
| `gates/expected-red.ts` | modify | T-15 | `hasExpectedRedDisposition` takes an optional `evidenceSchema` and slices with `sliceH2SectionAt`; drops the `sliceH2Section` import. |
| `gates/evidence-schema.ts` | modify | T-13 | `EVIDENCE_SCHEMA_CURRENT = 3`; new `EVIDENCE_SCHEMA_ACCEPTED_LISTING = 3`; header comment documents v3. |
| `gates/visual.ts` | modify | T-13 | `VisualReportValidation.unlistedAcceptedDiffs`; `validateVisualReport` applies the listing rule under pin ≥ 3. |
| `gates/registry.ts` | modify | T-11, T-13, T-14, T-17 | `MISSING_REVIEW_EVIDENCE` triggerEdge / armCondition / hintStatic; `VISUAL_REPORT_INCOMPLETE` hintStatic; `MISSING_EVIDENCE` armCondition / clearingArtifact / hintStatic; the 18 E458 (8) hints. No entry added or removed; the doc-file mapping comment (base :75 onward) unchanged. |
| `tools/handoff-orchestrator.ts` | modify | T-11, T-13, T-14, T-15 | step 17 arming; step 13 file-mode branch + `msg.missing_evidence_file`; step 14 listing reason `msg.allowed_differences_unlisted`; step 15 passes the pin. Imports: add `hasPassEvidenceInFile` to the existing `../gates/qa-review.js` import line. The `hasDesignModeRequiringVisual` import is not touched. |
| `tools/lane-status.ts` | modify | T-15 | `passEvidenceIdsIn` credits by standing through the predicate; `JUDGE_PASS_HEADER_RE` deleted. |
| `tools/evidence-lookup.ts` | modify | T-15 | `VERDICT_HEADING_RE` / `lastVerdict` deleted; `evidenceQualifies` reads the predicate; header comment updated. |
| `tools/tasks.ts` | modify | T-16 | `isError: true` on the judge refusal of `tw_complete_task` and on every `tw_rollback_task` error result. |
| `dist/**` | rebuild | T-18 | `npm run build` output of the files above only. |
| `test/e448-*`, `test/e451-*`, `test/e452-*`, `test/e459-*`, `test/e460-*` | create | T-01..T-04 | qa-owned. |
| 24 existing test files (the cut's red table + `e433` AC9) | re-pin | T-04..T-10 | qa-owned; see *Per-task guidance*. |

Not touched (checked): `tools/drift.ts` (its call `hasEvidenceAnywhere(...)` and `buildEvidenceBackedLine` text stay accurate), `gates/code-review.ts`, `tools/storage.ts` (`FileHandoffStorage.hasEvidence` keeps delegating to the unchanged `hasEvidenceInFile`; the orchestrator no longer calls it in file mode on the PASS path).

## Data Structures

### Report standing (tools/evidence-file.ts, T-14)

```ts
export type ReportVerdict = "PASS" | "FAIL";

// The standing of one judge report's text: the LAST server-recorded verdict
// section in document order, or all-null when the text has none.
export interface ReportStanding {
  readonly verdict: ReportVerdict | null;
  readonly signer: string | null;     // the "by <signer>" token of that last section
  readonly recordedAt: string | null; // its ISO timestamp, as written
}
```

The server-recorded verdict section shape (non-exported constant, the only place in the codebase that spells it):

```ts
// Exactly what recordReviewInFileUndoable writes:
//   `## ${new Date().toISOString()} — ${status} — by ${reviewer}`
// Single spaces, em dashes, ISO-8601 UTC with milliseconds and Z. A trailing
// \r is tolerated (CRLF-edited reports; test/e112 "C1 regression" pins it).
const SERVER_VERDICT_HEADING_RE =
  /^## (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) — (PASS|FAIL) — by (\S+)[ \t]*\r?$/gm;
```

Anything else — `## Round 1 — PASS — by code-reviewer`, a timestamp without milliseconds, `## PASS`, prose — is not a verdict. (All existing test fixtures that intend a server verdict already use `toISOString()` or the literal `2026-…T00:00:00.000Z` shape; grep at base found no other form.)

### Visual validation (gates/visual.ts, T-13)

```ts
export interface VisualReportValidation {
  ok: boolean;
  missingSections: string[];
  failedCanonicalStates: string[];
  failedStructuralAssertions: string[];
  failedRegionDiffs: string[];
  unlistedAcceptedDiffs: string[]; // NEW — always present; [] unless pin >= 3 and the rule fails
  verdictPass: boolean;
}
```

Additive field. Consumers outside the lane: none in `tools/`/`gates/`/`bin/`/`scripts/`; the two test readers (`test/visual-report-schema-validation.test.mjs`, `test/e23-evidence-schema.test.mjs`) assert individual fields, never the whole object, so they are unaffected.

### Region Diff rows (tools/evidence-file.ts, T-12)

```ts
export interface RegionDiffRow { readonly id: string; readonly result: string } // result lower-cased, trimmed
```

### Evidence-schema constants (gates/evidence-schema.ts, T-13)

```ts
export const EVIDENCE_SCHEMA_CURRENT = 3;
// First pin under which an accepted Region Diff surface must be named in
// ## Allowed Differences. Pins below it (and an absent pin) skip the rule.
export const EVIDENCE_SCHEMA_ACCEPTED_LISTING = 3;
```

No persisted shape changes: `evidence_schema` is already a positive integer in `handoff.md` (`tools/handoff-parse.ts` accepts any integer ≥ 1), so `3` round-trips with no `schema/**` change and no migration.

## Interface Contracts

### (1) The one PASS-evidence predicate — `tools/evidence-file.ts`

```ts
// Pure, no I/O, never throws.
export function judgeReportStanding(content: string): ReportStanding;

// Convenience used by the readers that need standing PASS. When `signers` is
// given, the last section's signer must be one of them.
export function isPassStanding(standing: ReportStanding, signers?: readonly string[]): boolean;
```

**Placement rationale.** `tools/evidence-file.ts` already owns the judge-report section (`resolveJudgeReport`, `REPORT_SIGNERS`, `encodeEvidenceId`, `covers:` parsing) and is imported by all three readers today (`gates/qa-review.ts`, `tools/lane-status.ts`, `tools/evidence-lookup.ts`). It imports nothing from `gates/`, so placing the predicate here keeps the import graph acyclic and needs no new file. `tools/storage.ts` is not owned, so the file-mode PASS branch reaches the predicate through the orchestrator calling the owned gate module directly (below), not through `storage.hasEvidence`.

**Last-verdict rule.** Within one report, standing = the last server-recorded verdict section in document order (append order, which is how the server writes). Across reports, an id has PASS evidence when *any* of its candidate reports — its direct `review_<encodeEvidenceId(id)>.md`, or any `*.md` whose `covers:` line names it — has standing PASS. This is the same per-file union lane-status already uses (`passEvidenceIdsIn`), so the three readers agree by construction. Timestamps are never compared across files (see *Decision Records* DR-2).

How each reader uses it:

| reader | file | rule | signer filter | verdict-less (standing none) |
|---|---|---|---|---|
| file-mode PASS gate (`MISSING_EVIDENCE`) | `gates/qa-review.ts` `hasPassEvidenceInFile` | some candidate has `isPassStanding(s)` | none | not evidence |
| lane-status | `tools/lane-status.ts` `passEvidenceIdsIn` | file contributes its ids iff `isPassStanding(s, REPORT_SIGNERS)` | `REPORT_SIGNERS` (code-reviewer, pre-v5 qa-engineer) — unchanged behaviour | not credited (unchanged) |
| drift | `tools/evidence-lookup.ts` `evidenceQualifies` | `judgeReportStanding(content).verdict !== "FAIL"` | none | credited (kept; out of scope, `test/e112` pin) |

AC16's four fixtures (a) standing FAIL, (b) server FAIL then hand-written PASS heading, (c) server PASS then server FAIL, (d) standing PASS, all signed `code-reviewer`: (a)(b)(c) have `verdict === "FAIL"` → none of the three credits them; (d) `verdict === "PASS"` → all three credit it.

### File-mode PASS rule — `gates/qa-review.ts` (T-14)

```ts
// File-mode PASS evidence: each id needs a candidate report with standing PASS
// (direct review_<id>.md, else any qa_reports/*.md whose covers: names it).
// Never throws: unreadable files read as no evidence.
export function hasPassEvidenceInFile(
  workspacePath: string,
  taskIds: string[],
): { present: string[]; missing: string[] };
```

Contract:
- Per id: read the direct file (`evidencePath(workspacePath, id)`); if `isPassStanding(judgeReportStanding(content))` → present.
- Otherwise consult a lazily built (at most once per call, only on the first direct miss) **set** of ids covered by PASS-standing reports: scan `evidenceDir(workspacePath)` sorted, for every `*.md` whose standing is PASS add every `parseCoversIds(content)` id. Do **not** use `buildCoverageIndex` (its first-seen-wins map would hide a later PASS covering file behind an earlier FAIL one — the same reason lane-status avoids it).
- Place the function **above** `hasEvidenceInFile`: `test/covering-evidence.test.mjs` slices `hasEvidenceInFile` "to EOF" (it is pinned as the last export) and pins `fs.existsSync(evidencePath(workspacePath, id))` inside it.
- `hasEvidenceInFile` is byte-unchanged and keeps existence semantics for `QA_COMPLETION_EVIDENCE_MISSING` (any write by the judge adding ids, whatever the status). Answer to the cut's question: yes, existence stays there; only the PASS gate tightens.

### Orchestrator step 13 `PASS_MISSING_EVIDENCE` (T-14)

```ts
// status === "PASS" && completed_tasks non-empty:
const ev = storage instanceof FileHandoffStorage
  ? hasPassEvidenceInFile(parsed.workspace_path, parsed.completed_tasks)
  : await storage.hasEvidence(parsed.workspace_path, parsed.completed_tasks);
```

Rejection text:
- File mode (`msg.missing_evidence_file`): `` `⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. The last server-recorded verdict for each listed id is not PASS (checked: ${ev.missing.map((id) => qaEvidencePath(parsed.workspace_path, id)).join(", ")}, plus any report whose covers: line names the id). ${gate("MISSING_EVIDENCE").hintStatic}` ``
- SQLite: unchanged shape, `` `⛔ MISSING_EVIDENCE: ${ev.missing.join(", ")}. ${gate("MISSING_EVIDENCE").hintStatic}` `` (new hint text only).

Runs after `QA_REVIEW_RECORD` (step 10), so the same write's auto-recorded PASS section makes the standing PASS (AC13). The rule covers every id in the write's `completed_tasks`, under every pin (D-B: defect fix).

### (2) evidence_schema 3 — the Allowed Differences listing (T-13)

**Arming.** Unchanged pin plumbing: `evidenceSchemaPin = feature_changed ? EVIDENCE_SCHEMA_CURRENT : prevState?.evidence_schema` (base :1256) and the stamp at :1442. Bumping the constant to 3 means:
- A feature whose first accepted write happens after this change is stamped `evidence_schema: 3`; its envelopes cite `Evidence schema: v3` via the existing `evidenceSchemaLabel`.
- A feature already pinned 1 or 2, or with no pin, keeps its persisted value (the write path preserves the pin across same-feature writes) → the listing rule never applies to it. Pin 1 keeps the exact heading anchor (`findH2At` branches on `=== 1` only, so pin 3 automatically gets the v2 normalized-contains heading rules).
- Archived reports are never re-judged: the visual validator reads only `qa_reports/visual_<id>.md` for the ids on the current PASS write (`validateVisualReports`); drift and lane-status never read visual reports.
- This lane's own feature is pinned 2 (its handoff), so its own PASS runs under v2 rules.

```ts
// gates/visual.ts
export function validateVisualReport(content: string, evidenceSchema?: number): VisualReportValidation;
```

Added behaviour, only when `evidenceSchema !== undefined && evidenceSchema >= EVIDENCE_SCHEMA_ACCEPTED_LISTING`:
1. `region = sliceH2SectionAt(content, "Region Diff", evidenceSchema)`; accepted ids = `parseRegionDiffRows(region).filter((r) => r.result === "accepted").map((r) => r.id)`.
2. `allowed = sliceH2SectionAt(content, "Allowed Differences", evidenceSchema)`. If `allowed === null` the section is already reported in `missingSections`; the listing rule is **skipped** (no duplicate reason). An empty body (`""`) or `None.` is present-but-unlisting.
3. `unlistedAcceptedDiffs` = accepted ids whose lower-cased text does not occur in the lower-cased `allowed` text (lenient substring: list item, table cell or prose all count; no shape imposed).
4. `ok` additionally requires `unlistedAcceptedDiffs.length === 0`.

Orchestrator step 14 listing (base :939–947): one more reason, pushed **after** the `region-diff fail` reason and **before** `verdict != PASS`:

```ts
if (v.unlistedAcceptedDiffs.length) reasons.push(`accepted but not in ## Allowed Differences: ${v.unlistedAcceptedDiffs.join("/")}`);
```

`validateVisualReports` signature unchanged. Hint: `VISUAL_REPORT_INCOMPLETE` `hintStatic` = Copy row `hint.visual_report_incomplete`.

`gates/evidence-schema.ts` header comment for v3 (replace the v1/v2 sentence block, keep the "not in schema/versions.ts" rationale):

```
// v1 = exact-anchored H2 match; v2 = normalized-contains; v3 = v2 plus: every
// Region Diff surface whose result is `accepted` must be named somewhere in the
// ## Allowed Differences section (gates/visual.ts). A feature's first accepted
// write pins it: pin 1 reads headings exact, pin >= 2 or absent reads them
// normalized, and only pin >= 3 applies the v3 listing rule, so a feature or
// report judged under an older pin is never re-judged. Defect fixes to what
// counts as a verdict (tools/evidence-file.ts judgeReportStanding) apply under
// every pin.
```

### (3) E448 — step 17 `MISSING_REVIEW_EVIDENCE` (T-11)

Arms on the incoming judge PASS write in file mode, whatever the previous state:

```ts
run: async (ctx) => {
  const { parsed, storage } = ctx;           // prevTuple / nextTuple no longer read here
  const reviewScopeIds = parsed.review_task_ids && parsed.review_task_ids.length > 0
    ? parsed.review_task_ids
    : parsed.completed_tasks;
  if (
    storage instanceof FileHandoffStorage &&
    parsed.agent_id === resolveJudgeReport(parsed.workspace_path).judge &&
    parsed.status === "PASS" &&
    reviewScopeIds.length > 0
  ) {
    const ev = await storage.hasCodeReviewEvidence(parsed.workspace_path, reviewScopeIds);
    // reject `⛔ MISSING_REVIEW_EVIDENCE: ${ev.missing.join(", ")}. ` + hintStatic (text shape unchanged)
  }
  return null;
}
```

- Still step 17 (last), same name, same `codes`. The rejection undo of the same write's qa_review auto-record is the existing pipeline behaviour (`evidenceUndoByCtx` / `undoRecordedEvidence`), no new code.
- SQLite/HTTP: the `FileHandoffStorage` guard keeps it dormant (nothing writes code-review rows there) — AC3.
- Comment block above the step (base :1117–1121) rewritten to: code-reviewer evidence gate on the judge's PASS write (file mode only); every id in review scope (review_task_ids if non-empty, else completed_tasks) needs `review_reports/review_<id>.md` or a `covers:` file. It must not name a code-reviewer → qa-engineer hand-off (AC4).

Registry entry (`gates/registry.ts` base :325–337), exact values:

```ts
triggerEdge:
  "status=PASS write by code-reviewer (the judge), whatever the previous state, with review scope (review_task_ids if non-empty, else completed_tasks); file-mode only",
armCondition:
  "agent_id === resolveJudgeReport().judge && status === PASS && hasCodeReviewEvidence(reviewScopeIds).missing non-empty; FileHandoffStorage only",
clearingArtifact: "review_reports/review_<id>.md (or a covers: file) for every id in review scope",
hintStatic: /* Copy row hint.missing_review_evidence, verbatim */
```

Effect on `test/error-code-contract.test.mjs`:
- AC2 (c12) armCondition: its camelCase names `resolveJudgeReport`, `hasCodeReviewEvidence`, `reviewScopeIds` all appear literally in `tools/handoff-orchestrator.ts` → passes; the code stays in `armConditionCheckable` (it already is), so it must stay out of the allowlist (it is).
- AC3 closure: the new triggerEdge has no `role:Status` pair and the code is not in `triggerEdgeCheckable`, so the existing `MISSING_REVIEW_EVIDENCE / triggerEdge` allowlist row still satisfies the closure — **no red**. Its `reason` string quotes the removed edge, though; T-E448-06 rewrites that reason (free text, behaviour-neutral) to: `"free English (\"status=PASS write by code-reviewer ... file-mode only\"), no role:Status edge pair or CAP_BY_CODE literal"`.
- Mapping-comment tests: no code added or removed, `documentedInProse` unchanged → green.

### MISSING_EVIDENCE registry entry (T-14)

```ts
armCondition: "hasPassEvidenceInFile(completed_tasks).missing non-empty (file mode) / hasEvidence(completed_tasks).missing non-empty (SQLite)",
clearingArtifact: "qa_review on the PASS write, or qa_reports/review_<id>.md (or a covers: report) ending with a server-recorded PASS verdict / a PASS reports row (SQLite)",
hintStatic: /* Copy row hint.missing_evidence, verbatim */
```

`hasPassEvidenceInFile` and `hasEvidence` both appear literally in the orchestrator → AC2 (c12) passes. triggerEdge unchanged (its allowlist row stays).

### Expected-red under the pin — `gates/expected-red.ts` (T-15)

```ts
export function hasExpectedRedDisposition(
  workspacePath: string,
  taskIds: string[],
  evidenceSchema?: number, // NEW, optional: existing 2-arg callers (test/e136) keep v2 behaviour
): { present: boolean };
```

`hasHeading` uses `sliceH2SectionAt(content, DISPOSITION_HEADING, evidenceSchema) !== null`. Pin 1 → exact anchor (`## Step 7 — Expected-Red Diff` rejected); pin 2 / 3 / absent → normalized-contains (it clears). Orchestrator step 15 destructures `evidenceSchemaPin` and passes it as the third argument; the rejection text is unchanged (no schema label added — keeps `test/gates-expected-red` text pins). The single-line `if (storage instanceof FileHandoffStorage)` guard and the `hasExpectedRedManifest(parsed.workspace_path` call line stay byte-identical (pinned at `test/gates-expected-red.test.mjs` :320–350).

### Lane-status anchoring — `tools/lane-status.ts` (T-15)

- Delete `JUDGE_PASS_HEADER_RE` (base :209–215) and its comment.
- `passEvidenceIdsIn`: replace `if (!JUDGE_PASS_HEADER_RE.test(content)) continue;` with `if (!isPassStanding(judgeReportStanding(content), REPORT_SIGNERS)) continue;`. Everything else (decode fallback `decodeEvidenceId(m[1]) ?? m[1]`, covers ids, sorted scan) stays — `test/e367` pins the decode line and the import regex `import { ... decodeEvidenceId ... } from "./evidence-file.js"`, so add the two names to that same import statement.
- Update the function doc comment: "whose last server-recorded verdict section is PASS by a REPORT_SIGNERS signer".
- Timestamp anchoring comes from the predicate's regex: a hand-written `## Round 1 — PASS — by code-reviewer` after a server FAIL no longer credits (AC15); a server PASS followed by a server FAIL no longer credits.

### Drift lookup — `tools/evidence-lookup.ts` (T-15)

- Delete `VERDICT_HEADING_RE` and `lastVerdict`; `evidenceQualifies(content)` becomes `judgeReportStanding(content).verdict !== "FAIL"`.
- Header comment: "A file counts when its last server-recorded verdict section (tools/evidence-file.ts judgeReportStanding) is PASS, or it has none at all." The verdict-less trust class is kept.
- Known consequence (accepted): a hand-written heading that the old loose regex treated as a FAIL verdict (e.g. `## Round1 — FAIL — by x`) now reads as verdict-less and is credited by drift. This is the out-of-scope trust class, not a new hole; lane-status and the PASS gate still refuse it.

### E451 header anchors — `tools/evidence-file.ts` (T-12)

```ts
// One Region Diff table parser; the header skip lives only here.
export function parseRegionDiffRows(section: string): RegionDiffRow[];
export function parseRegionDiffFailures(section: string): string[]; // = rows with result not in {pass, accepted}
export function parseAssertionFailures(section: string): string[];  // signature unchanged
```

- Region Diff header skip: `id === "" || /^surface(\s*id)?$/i.test(id)` (skips `surface`, `Surface ID`, `surface id`; `card-surface`, `Surfaces.list` are data rows).
- Structural Assertions header skip: `id === "" || /^assertion(\s*id)?$/i.test(id)` (skips `assertion id`, `Assertion ID`; `assertionIdle` is a data row).
- `parseRegionDiffFailures` is re-expressed over `parseRegionDiffRows`; its output is unchanged for every non-header row. `gates/visual.ts` callers (`validateVisualReport`, provenance at base :508) keep calling `parseRegionDiffFailures`.

### E460 — `tools/tasks.ts` (T-16)

```ts
// Local, non-exported: true when a storage result is the JSON error envelope
// both backends return ({"error": "..."}). Never throws.
function isErrorEnvelope(text: string): boolean;

export async function handleCompleteTask(parsed: CompleteTaskInput): Promise<ToolResult>;
// judge refusal: { content: [{ type: "text", text: gate.message ?? "blocked" }], isError: true }
// a completion result: unchanged (no isError)

export async function handleRollbackTask(parsed: RollbackTaskInput): Promise<ToolResult>;
// { content: [{ type: "text", text: result }], ...(isErrorEnvelope(result) && { isError: true }) }
```

The refusal texts are untouched (same `text`, AC17/AC18); file mode (`tools/tasks-file.ts`) and SQLite (`tools/storage-sqlite.ts`) already return `JSON.stringify({ error })` for every rollback refusal, so detection in the handler covers both modes without touching either backend. `tw_complete_task` storage results (e.g. "already completed") and `tw_void_task` / `tw_add_task` are out of scope and unchanged.

### E458 (8) hints — `gates/registry.ts` (T-17)

Replace each `hintStatic` with its Copy / Strings text verbatim (leading space kept where the Copy text has one; emit-site dynamic prefixes unchanged). The 18 codes at base: `TRANSITION_REJECTED`, `SCOPE_DECISION_REQUIRED`, `CUT_APPROVAL_REQUIRED`, `EXTERNAL_REFS_UNRESOLVED`, `SOURCE_CREDIBILITY_UNVERIFIED`, `FEATURE_LEASE_HELD`, `LEASE_OVERRIDE_AUDIT_MISSING`, `QA_COMPLETION_EVIDENCE_MISSING`, `REPRO_MANIFEST_MISSING`, `VISUAL_PROVENANCE_MISSING`, `BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`, `PIXEL_GATE_ATTESTATION_MISSING`, `REVIEW_VERDICT_STATUS_MISMATCH`, `NON_JUDGE_COMPLETED_TASKS_REJECTED`, `NON_REVIEWER_VERDICT_REJECTED`, `AC_EXECUTION_LOG_MISSING`, `PASS_TASKS_INCOMPLETE` — exactly the set a base-tree scan of `GATE_REGISTRY` flags for a repo path under `specs|docs|content|gates|tools|test|research|scripts/` (placeholder `specs/<feature>.md` excluded) or `/\bE\d{1,4}\b/`. After T-11, T-13, T-14 and T-17 that scan returns zero codes (AC20). Only `hintStatic` changes on these 18; their other fields stay.

## Sequence Diagram

```mermaid
sequenceDiagram
    participant J as code-reviewer (judge)
    participant O as handoff-orchestrator (pipeline)
    participant Q as gates/qa-review.ts
    participant EF as tools/evidence-file.ts
    participant V as gates/visual.ts
    participant LS as lane-status / drift
    J->>O: tw_update_state(PASS, completed_tasks, qa_review?, review_task_ids?)
    O->>Q: step 10 recordReviewInFileUndoable (if qa_review) — appends "## <iso> — PASS — by code-reviewer"
    O->>Q: step 11 hasEvidenceInFile(newIds) — existence (unchanged)
    O->>Q: step 13 hasPassEvidenceInFile(completed_tasks) [file mode]
    Q->>EF: judgeReportStanding(direct / covering report text)
    EF-->>Q: { verdict, signer, recordedAt }
    Q-->>O: { present, missing } — missing → MISSING_EVIDENCE (undo step-10 append)
    O->>V: step 14 validateVisualReports(ids, pin) — pin>=3 adds unlistedAcceptedDiffs
    O->>O: step 15 hasExpectedRedDisposition(ids, pin)
    O->>O: step 17 hasCodeReviewEvidence(reviewScope) [file mode, judge PASS]
    O-->>J: accepted, or ⛔ <code> (evidence undo)
    LS->>EF: judgeReportStanding(report text) — lane-status: PASS + REPORT_SIGNERS; drift: not FAIL
```

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| DR-1 Predicate home (D-C) | `judgeReportStanding` / `isPassStanding` in `tools/evidence-file.ts`; the file-mode PASS rule `hasPassEvidenceInFile` in `gates/qa-review.ts`, called directly by the orchestrator under `storage instanceof FileHandoffStorage` | No new file, no `tools/storage.ts` edit; acyclic imports kept; `FileHandoffStorage.hasEvidence` becomes unused on the PASS path but stays (unowned, harmless) |
| DR-2 Across-report rule | An id has PASS evidence when any candidate report (direct, or `covers:`) has standing PASS; no cross-file timestamp comparison | Matches lane-status's existing per-file union, so all three readers agree; a stale covering PASS could outvote a newer direct FAIL — accepted, since standing PASS requires a server-written judge verdict and the writer is the judge itself |
| DR-3 Signer filter | Predicate exposes the signer; only lane-status filters by `REPORT_SIGNERS`; the PASS gate and drift are signer-agnostic | Preserves lane-status AC5b behaviour and the spec's signer-free definition of standing; the server only ever records the judge (or pre-v5 qa-engineer) as signer, so the difference is theoretical |
| DR-4 Exact heading shape | Strict `toISOString()` shape with single spaces; trailing `\r` tolerated | Hand-written look-alikes never count (AC12/AC15); drift's old loose `\S+` timestamp match is narrowed — a few hand-written pseudo-verdicts move into drift's verdict-less class (out of scope, accepted) |
| DR-5 `hasEvidenceInFile` | Kept byte-identical, existence semantics, for `QA_COMPLETION_EVIDENCE_MISSING` and `FileHandoffStorage.hasEvidence`; the new function goes above it | `test/covering-evidence` source pins stay green; non-PASS writes unchanged |
| DR-6 v3 listing when `## Allowed Differences` is absent | Skip the listing rule (section already in `missingSections`) | No duplicate reason; v2-era envelopes for a missing section stay identical on pin-3 features |
| DR-7 Listing match | Case-insensitive substring of the surface id anywhere in the section body | Lenient as AC9 requires; an id that is a substring of another listed id would clear — accepted (ids are reviewer-chosen, and the judge still reads the report) |
| DR-8 Unlisted ids surfaced via a new `VisualReportValidation` field | Additive `unlistedAcceptedDiffs: string[]`, always present | No consumer outside the lane changes; orchestrator adds one reason string |
| DR-9 Step-17 triggerEdge wording | Free English without a `role:Status` pair | Stays in the free-text allowlist; closure test unchanged; only the allowlist `reason` text is refreshed (T-06) |
| DR-10 Expected-red envelope | Pin threaded into the predicate only; rejection text unchanged | Existing text pins hold; envelope does not cite the schema version (it never did) |
| DR-11 `isError` detection | Handler-side JSON-envelope sniff in `tools/tasks.ts` (rollback), explicit flag on the judge refusal (complete) | Both storage modes covered without touching `tools/tasks-file.ts` / `tools/storage-sqlite.ts`; success JSON never carries an `error` key, so no false positive |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites records zero external references (Resource Audit: no URL, design source or outside ticket)._

## Per-task guidance

### qa (T-E448-01 … T-E448-10) — what the tests should target

- Freeze the Copy texts and the exact `triggerEdge` / `armCondition` strings above in the test files; never compare against `dist/` text read by the same test.
- **T-01** (`test/e448-judge-evidence-checks.test.mjs`): AC1/AC2 drive the compiled `tw_update_state` handler in a temp workspace with a FAIL-free `qa_reports/review_T1.md` and the PASS write's own `qa_review`; AC4 reads `GATE_REGISTRY` and the orchestrator source slice between `name: "MISSING_REVIEW_EVIDENCE"` and the end of the pipeline array (must not contain `qa-engineer`). AC20 scan regex as in *E458 (8) hints* above.
- **T-02**: E451 via `validateVisualReport` / the PASS write; E452 AC7 asserts `EVIDENCE_SCHEMA_CURRENT === 3` and the stamped pin; AC8–AC10 seed `evidence_schema` in the fixture handoff (pin 2 / absent) for AC10. AC11 rewrites E434 AC7 (base :596–598) to server behaviour.
- **T-03** (`test/e459-*`): AC16 imports `judgeReportStanding` from `dist/tools/evidence-file.js` and calls `checkLaneEvidence` (lane-status), `hasEvidenceAnywhere` (drift) and the PASS write without `qa_review` on the same four fixtures; also a source check that `tools/lane-status.ts` and `tools/evidence-lookup.ts` contain no `— PASS — by` / `(PASS|FAIL)` regex literal of their own.
- **T-04**: AC17 `isError === true` on the two refusals, absent on the code-reviewer completion; AC18 both modes.
- **T-05 … T-10** re-pins: E448 fixtures gain a `review_reports/review_<id>.md` (or one `covers:` file); E459 fixtures that PASS without `qa_review` over a hand-written report either add `qa_review` on the PASS write or write a server-shaped PASS section; E452 pin-3 fixtures with an accepted row list the id under `## Allowed Differences`; hint assertions move to the Copy text. T-06 also refreshes the `MISSING_REVIEW_EVIDENCE` allowlist `reason` in `test/error-code-contract.test.mjs` (:570) per DR-9. T-10 takes the `test/e433-test-first-rules.test.mjs` AC9 assertion (base ~:462) only — re-pin it to `hint.ac_execution_log_missing`; leave the rest of that file alone (lane e453).

### sr (T-E448-11 … T-E448-18) — id order, one red-manifest append per task

| task | files | functions / sites | est. lines | AC |
|---|---|---|---|---|
| T-11 | `tools/handoff-orchestrator.ts`, `gates/registry.ts` | step 17 `run` (condition per (3), destructure `{ parsed, storage }`), its comment block; registry `MISSING_REVIEW_EVIDENCE` triggerEdge / armCondition / clearingArtifact / hintStatic | ~35 | AC1–AC4 |
| T-12 | `tools/evidence-file.ts` | `RegionDiffRow`, `parseRegionDiffRows` (anchored header), `parseRegionDiffFailures` over it, `parseAssertionFailures` anchored header | ~25 (the shared row parser is why it exceeds the cut's ~10; it saves T-13 a 5th file) | AC5, AC6 |
| T-13 | `gates/evidence-schema.ts`, `gates/visual.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts` | constants + header comment; `VisualReportValidation.unlistedAcceptedDiffs`, `validateVisualReport` listing rule (import `EVIDENCE_SCHEMA_ACCEPTED_LISTING`, `parseRegionDiffRows`); step-14 listing reason; `VISUAL_REPORT_INCOMPLETE` hintStatic | ~60 | AC7–AC11 |
| T-14 | `tools/evidence-file.ts`, `gates/qa-review.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts` | `ReportVerdict`, `ReportStanding`, `SERVER_VERDICT_HEADING_RE`, `judgeReportStanding`, `isPassStanding`; `hasPassEvidenceInFile` above `hasEvidenceInFile` + qa-review header comment; step-13 file branch + `msg.missing_evidence_file`; `MISSING_EVIDENCE` armCondition / clearingArtifact / hintStatic | ~110 | AC12, AC13, AC16 |
| T-15 | `gates/expected-red.ts`, `tools/handoff-orchestrator.ts`, `tools/lane-status.ts`, `tools/evidence-lookup.ts` | `hasExpectedRedDisposition(…, evidenceSchema?)` via `sliceH2SectionAt`; step-15 passes `evidenceSchemaPin`; lane-status `passEvidenceIdsIn` + delete `JUDGE_PASS_HEADER_RE`; evidence-lookup `evidenceQualifies` + delete `VERDICT_HEADING_RE`/`lastVerdict`, header comment | ~60 | AC14–AC16 |
| T-16 | `tools/tasks.ts` | `isErrorEnvelope`; `handleCompleteTask` refusal flag; `handleRollbackTask` flag | ~20 | AC17, AC18 |
| T-17 | `gates/registry.ts` | the 18 `hintStatic` values per Copy | ~60 | AC19, AC20 |
| T-18 | `dist/` | `npm run build`; `git status` shows `dist/` changes only for the ten sources above; full suite under `node scripts/test-lock.mjs -- npm test`; final expected-red manifest; `wc -l CLAUDE.md` = 250; `npm audit --audit-level=high` | — | AC21 |

Comment hygiene for new code comments: describe behaviour; no ticket ids, no repo-only spec paths in new comments (existing `Spec:` lines may stay).

## Open Questions

All resolved by the architect; **none needs a human ruling**.

1. **Direct FAIL report vs a covering PASS report for the same id** — resolved (DR-2): any candidate report with standing PASS qualifies; no cross-file timestamp ordering. Rationale: identical to lane-status's existing union, so AC16 agreement holds in multi-file cases too; standing PASS can only come from a server-recorded judge verdict.
2. **Does the PASS gate / drift filter by signer?** — resolved (DR-3): no; lane-status keeps its `REPORT_SIGNERS` filter. Rationale: the spec defines standing without a signer; lane-status's filter is existing, pinned behaviour.
3. **v3 listing when `## Allowed Differences` is absent** — resolved (DR-6): rule skipped, the missing section alone rejects. Rationale: no duplicate reason, unchanged envelopes for that case.
4. **Case sensitivity of the listing match** — resolved (DR-7): case-insensitive substring. Rationale: AC9 asks for lenient; false accepts need a near-identical id and the judge still reads the report.
5. **`hasEvidenceInFile` semantics for `QA_COMPLETION_EVIDENCE_MISSING`** — resolved (DR-5): unchanged existence check; the source pins in `test/covering-evidence.test.mjs` stay green because the new function sits above it.
6. **Does the new `MISSING_REVIEW_EVIDENCE` triggerEdge redden `test/error-code-contract.test.mjs`?** — resolved (DR-9): no; the allowlist row stays valid, T-06 refreshes its stale `reason` text only.
7. **Should `EXPECTED_RED_DIFF_MISSING` cite the evidence schema?** — resolved (DR-10): no; keeps existing text pins, not required by any AC.
8. **Drift regex narrowing** — resolved (DR-4): hand-written pseudo-verdict headings fall into drift's verdict-less class (credited), which is the out-of-scope trust class kept by ruling; the PASS gate and lane-status refuse them.
9. **`isError` on other `tw_complete_task` storage errors** — resolved: out of scope (AC17 names only the judge refusal); unchanged.
