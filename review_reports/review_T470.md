# Review — T470 (drift.ts archived-task exclusion) + T471 (version bump)

Spec: `specs/drift-archived-task-exclusion.md` (v3.23.1)
Reviewer: code-reviewer (opus) — clean-context, diff vs HEAD only.

## Round 1 — APPROVED — by code-reviewer

## Summary

- `tools/drift.ts`: adds `isArchivedSection(section)` = `section.trim().toLowerCase() === "completed"`; adds a backward-compat gate `usesActiveCompletedConvention` (true iff some task carries an `Active` or `Completed` section); filters `## Completed` tasks out of the drift comparison only when the gate is true; passes `activeScopeTasks` to `partitionTasks()` so `tasksCompleted`/`tasksIncomplete` are active-scope.
- `index.ts` + `package.json` + `CHANGELOG.md`: 3.23.0 → 3.23.1 patch bump. No schema bump.
- All 9 ACs verified empirically against the freshly-built `dist/tools/drift.js` via 12 synthetic workspaces (AC-1..AC-7, AC-9 handoff-ahead, AC-9 FAIL-status, plus three boundary cases). Existing `test/*drift*.test.mjs` 7/7 pass.
- Headline verdict: **APPROVED**. Implementation matches the spec's preferred Approach A exactly; no correctness, security, or performance issues found.

## Correctness

- `tools/drift.ts:222-228` — gate logic is correct. `usesActiveCompletedConvention` is true iff at least one task's section folds to `"active"` or `"completed"`. When false, `activeScopeTasks === tasks` (identity), so legacy files are untouched. **AC-3 verified** (no sections → T01 still drifts) and **AC-4 verified** (`## Active` only → T01 still drifts). The gate cannot misfire: a section named e.g. `## Sprint-3` alone does not enable the convention, so no archived filtering occurs and behaviour stays full-file.
- `tools/drift.ts:227` — filter excludes only `isArchivedSection` (=`completed`). **AC-1 verified**: archived `## Completed` tasks dropped, clean repo → "No drift detected". **AC-2 verified**: `[x]` under `## Active` not in handoff still emits the vibe-coding drift line — the load-bearing non-regression. Confirmed the filter does NOT over-eagerly swallow active drift.
- `tools/drift.ts:27-29` — `isArchivedSection` uses `.trim().toLowerCase()`, matching `tasks-file.ts:87` (`sectionMatch[1].trim()`) plus a fold. **AC-6 verified**: `##  active  `, `##  COMPLETED  ` both matched correctly.
- **AC-7 verified**: `## Sprint-3` / `## Misc` tasks are treated as active (not archived) because `isArchivedSection` returns false for any non-"completed" name; their `[x]` tasks still surface as drift. Conservative-by-default is preserved — no active drift silently dropped on an unknown section.
- **AC-5 verified**: with `## Active` (`[ ] T10`, `[x] T11`) + `## Completed` (`[x] T01`), `tasksIncomplete=["T10"]`, `tasksCompleted=["T11"]` — archived T01 absent from both. Returned JSON reflects active scope only.
- **AC-9 verified — unaffected.** Version-skew (`checkVersionSkew`, lines 147-178) runs before the filter and is untouched. FAIL/Blocked-status drift (lines 259-265) reads `incompleteTasks`, now active-scope, which is the correct semantic (archived tasks should not count as "remaining incomplete") — verified a FAIL handoff with one active `[ ]` still drifts. For handoff-ahead drift: I confirmed via the base (HEAD) `dist/tools/drift.js` that the legacy no-convention path produces byte-identical output to the new path for the handoff-says-done/list-says-incomplete scenario — i.e. this diff introduces **zero** change to handoff-ahead behaviour. (Any quirk in that matching path is pre-existing and out of scope.)
- `section` field is always populated: `tasks-file.ts:82` defaults `currentSection = "Unknown"` (never undefined); `storage-sqlite.ts:69` column is `NOT NULL DEFAULT 'Active'` and mapped at line 504. So `t.section.trim()` cannot throw in either storage mode.
- Boundary cases verified: multiple `## Completed` sections → both archived correctly (no drift); `## Active` followed by an unnamed/other H2 with `[x]` → treated active (drifts); empty/no-task and missing-handoff early returns are upstream of the change and untouched.

## Quality

- `tools/drift.ts:21-29` — helper carries a precise comment citing AC-6/AC-7. Naming (`isArchivedSection`, `usesActiveCompletedConvention`, `activeScopeTasks`) is clear and reads at the call site.
- The gate inlines its own `.trim().toLowerCase()` (line 223-224) rather than reusing `isArchivedSection`, because it tests for two names (`active` OR `completed`); acceptable — extracting a second helper would not improve clarity. Minor, non-blocking.
- No dead code, no duplication, consistent with surrounding `drift.ts` style. Comment block at 214-221 accurately maps each clause to its AC.

## Architecture

- Matches the spec's **Approach A** (filter at `drift.ts`, minimal blast radius) verbatim. `tasks-file.ts` untouched — correct, since `section` was already populated. No SQLite-specific change needed; the filter operates on `TaskRecord[]` regardless of source, as the spec's SQLite-mode note requires. No layering violation. No `specs/<feature>-architecture.md` present; the spec's Implementation Notes serve as the design constraint and are honored exactly.

## Security

- No new external input, no injection surface. Filter is a pure in-memory predicate over already-parsed records. No secrets, no filesystem/boundary changes. `tasksCompleted`/`tasksIncomplete` already came from `tasks.md`; scoping them down cannot leak anything new.

## Performance

- Adds one `Array.some` (O(n)) + one `Array.filter` (O(n)) over the task list, both linear and run once per `detectDrift` call. Net effect is a **reduction** in downstream work: `partitionTasks`, the regex-vocab build (lines 236-240), and the comparison loops now operate on the smaller active-scope set, so on a repo with 161 archived tasks this is a strict performance improvement, not a regression. No new I/O, no retained references, no complexity-class change.

## Verdict

**APPROVED** — implementation matches Approach A exactly; all 9 ACs verified empirically against rebuilt dist; no correctness, security, architecture, or performance issues. Version bump consistent (`check:version` OK), CHANGELOG entry present, no schema bump (AC-8). Same-model bias note: reviewer model tier was pinned independently for this role; findings stand on empirical AC verification, not on trusting the writer's reasoning.
