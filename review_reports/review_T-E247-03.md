# Review — T-E247-03 (batched: sr hop 1 of lane e247)

covers: T-E247-03, T-E247-04, T-E247-09

## Round 1 — APPROVED — by code-reviewer

Base `2425e04`, range `2425e04..HEAD` (commits 4fc86d2, 57d40c4, e61ee72; bookkeeping 544afd1). Contract: `specs/e247-qa-pass-unticked-gate.md` (no architecture spec for this feature).

## Summary
- T-E247-03 adds `gates/open-tasks.ts` (`featureLaneLedger`, `listOpenFeatureTasks`), one `GATE_REGISTRY` entry `PASS_TASKS_INCOMPLETE` (36 entries, placed after `AC_EXECUTION_LOG_MISSING`, `DISPATCH_PIN_TIER_REJECTED` still last), and one pipeline step at index 13 (19 steps). `dist/` is rebuilt for those three sources only.
- T-E247-04 replaces `content/skill-qa-engineer.md` line 90 with `qa.pass-write`. It matches byte for byte, the file is 18476 bytes, and the only hunk is `@@ -90 +90 @@`.
- T-E247-09 updates the step-count and entry-count prose in `CLAUDE.md`, `README.md` and `docs/architecture.md`, and adds `open-tasks` to the `CLAUDE.md` gate list.
- R1 = b holds: `gates/expected-red.ts`, `gates/ac-execution.ts` and their `dist/` outputs have zero diff against the base.
- Verdict: APPROVED. No required findings. Two recommended items and three optional items are below, all report-only.

## AC Completeness
AC1 — implemented — `tools/handoff-orchestrator.ts:852-887` (step at :853, guard at :862): the envelope lists the ids in ledger order, once each. A rejection takes the generic pipeline-rejection path, which runs `undoRecordedEvidence` (`tools/handoff-orchestrator.ts:1385`; a thrown parse error is undone at `:1381`). Behavioural proof is qa's T-E247-10.
AC2 — implemented — completed set = `parsed.completed_tasks` ∪ on-disk `prevState.completed_tasks` when `!feature_changed` (`:866-869`). Ticked rows are skipped by `t.completed`. Voided `- [-]` rows never match `DEFAULT_TASK_REGEX` `[ x]`, so `listTasks` does not return them.
AC3 — implemented — `gates/open-tasks.ts:20`, the regex taken verbatim from Terms. Smoke run on `dist/`: `release-engineer bump`, `[P2] doc-writer: x`, `[P1] release-engineer (CHANGELOG)` and a bare `release-engineer` are exempt. `qa-engineer: verify release-engineer notes`, `doc-writers: x` and `release-engineering x` are listed.
AC4 — implemented — `FileHandoffStorage` + `status === "PASS"` guard (`:862`). `featureLaneLedger` is dormant for: no ledger, the root legacy `tasks.md` (`rel` starts `..`), flat `.current/tasks.md` (1 segment), `_`-prefixed lanes, and a token mismatch (smoke: ledger `e900` with `e9001-x` and `e901-x` both dormant, `e900` / `e900-x` / `E900-X` armed). `listTasks` null is skipped by `if (tasks)`. There is no try/catch, so a parse error propagates (D8).
AC5 — implemented — `gates/registry.ts:651-671` (errorCode at :656). `hintStatic`, `triggerEdge`, `armCondition` and `clearingArtifact` were checked by script to be byte-equal to Copy/Strings. Producer is `orchestrator`, envelope `plain-text`, `documentedInProse: true`. The mapping-comment row is at `:113`. 36 entries, index 34, `DISPATCH_PIN_TIER_REJECTED` last. The proof file is red only on the pins qa re-pins (see the Expected-Red section).
AC6 — implemented — `dist` pipeline dump: 19 steps, index 12 `QA_COMPLETION_EVIDENCE_MISSING`, 13 `PASS_TASKS_INCOMPLETE`, 14 `PASS_MISSING_EVIDENCE`, everything else in base order. The neighbouring step bodies are untouched. The new step uses the same body indentation as its siblings.
AC7 — implemented — placement after `QA_COMPLETION_EVIDENCE_MISSING`. The envelope starts with `⛔ PASS_TASKS_INCOMPLETE:`, so `extractGateCodeFromText` and `emitGateTelemetry` record one line for it. Behavioural proof is qa's T-E247-10.
AC8 — implemented — `grep -cE "lane-paths|resolveCurrentLane|resolveLanePaths"` prints `:0` for both files. No new upper-snake gate-suffix token beyond the code itself. `test/lane-paths.test.mjs` is green.
AC9 — implemented — line 90 equals `qa.pass-write` and line 52 is untouched (single hunk at 90).
AC10 — implemented — `grep -c "18-step\|18 steps\|35 entries"` prints `:0` for all three files. `docs/architecture.md`: line 37 reads `15 modules` / `19-step` (15 `gates/*.ts` files present), lines 47 and 67, the new row 14 equals `e247.arch-row`, rows 15-19 are renumbered and every row is 67 columns, and line 113 reads `36 entries`.
AC10b — implemented — `CLAUDE.md:107` equals `e247.claude-gates`, lines 104-106 are unchanged, and `sed -n 104,107p | grep -c open-tasks` prints `1`.
AC11 — not in this hop (qa T-E247-01, first qa hop).
AC12 — not in this hop (conditional sr T-E247-02). Precondition verified: `gates/expected-red.ts` and its dist have zero diff against the base.
AC13 — implemented — line 90 carries `Fill \`qa_suite_result\` from the full suite (FAIL too).`
AC14 — implemented — `wc -c` prints 18476, which is ≤ 18500.
AC15 — partial for this hop by design (the final-HEAD suite is qa's T-E247-08). `npm run build` is clean and leaves the tree clean apart from this hop's own handoff/dispatch writes. `dist/` changes only `open-tasks.*`, `registry.*` and `tools/handoff-orchestrator.*`. Not a required finding: the 0-fail suite is defined on the final HEAD, not on this hop.
AC16 — not in this hop (qa T-E247-11 / sr T-E247-12, conditional). Precondition verified: `gates/ac-execution.ts` and its dist have zero diff against the base.

## Correctness
No required findings.
- The ledger `featureLaneLedger` arms on is the same file `listTasks` reads. When armed, `findTasksFile` has returned the lane path and that path exists, so `resolveTasksLedgerPath` returns the same lane path and `migrateForRead` returns early (`tools/tasks-file.ts:156`). The reads have no side effects.
- `feature_changed` is `true` when there is no `prevState`, so on a first write only this write's ids count, as D3 specifies.
- Only qa PASS writes reach this step: `status=PASS` is reserved for `qa-engineer` by transition validation at step 0.
- Duplicate-id edge (not blocking): if a ledger has the same id twice, one row `[x]` and one `[ ]`, the open row is listed. That matches the Terms definition ("a row ... with `completed: false`").
- **Expected-Red Sampling (4a)**: `qa_reports/expected-red_e247-qa-pass-unticked-gate.txt` exists and has 14 entries. I ran all four files (plus e128, lane-paths and e114 as controls): 154 tests, 140 pass, 14 fail. The 14 `not ok` titles are exactly the manifest's 14 entries: e35 ×3, error-code-contract ×4, e26-gate-stats ×6, e308 ×1. Every failure is a hard-coded 18/35 count or order pin (`expected: 35, actual: 36`), except `error-code-contract` AC3 (c12). That one fails with `PASS_TASKS_INCOMPLETE:triggerEdge: NEITHER mechanically checked NOR allowlisted`, which is the normal consequence of a new gate whose spec-mandated `triggerEdge` (`e247.trigger`) is free English.
- **recommended (R1)** — the spec's Blast radius names only the count re-pins for `test/error-code-contract.test.mjs`, and only R1/R2 for `test/e26-gate-stats.test.mjs`. In practice T-E247-10 also needs (a) one `FREE_TEXT_ALLOWLIST` row `{ code: "PASS_TASKS_INCOMPLETE", field: "triggerEdge", ... }`, matching the sibling `QA_COMPLETION_EVIDENCE_MISSING` / `REPRO_MANIFEST_MISSING` rows, and (b) the U1/D1/D2/T3b 35 -> 36 pins in e26. Both files are qa-owned in T-E247-10 and the manifest records all of them, so this is a heads-up for qa, not an sr defect. `armCondition` needs no allowlist row: it names `featureLaneLedger()` / `listOpenFeatureTasks()`, both literal in the orchestrator, so error-code-contract AC2 checks it mechanically and is green.

## Quality
- **4b comment check** (`agc check — comments`, 3 warnings touching the diff):
  - **recommended (R2)** — `gates/open-tasks.ts` high-ratio: 38.6% comments (limit 30%). The header (`:2-6`) and the `featureLaneLedger` JSDoc (`:24-30`) state the arming rule twice. Merging them, or cutting the header to a one-line purpose plus the spec pointer, would bring the ratio under the limit. The content is WHAT/WHY with no rationale essay, so this does not block.
  - `gates/registry.ts:78` long-block (mapping comment, 37 lines): kept. The block was over the limit before this diff, and the one added row is spec-mandated (AC5).
  - `gates/registry.ts:116` long-block (catalog history, 12 lines): kept. It follows the established pattern of appending each gate's addition (E40/E300/E139).
- **optional (O1)** — `gates/registry.ts:125`: the appended clause was not re-wrapped, so that line runs about 160 characters while its neighbours wrap at about 95. In "placed before the tool-boundary entry so it stays last", "it" is ambiguous; "so that entry stays last" would read clearer.
- sr note (1), `README.md:69` "an **18-step" -> "a **19-step": accepted. The article must follow the number, the change is on the same AC10 line, and no other line changed.
- sr note (2), the stale `plain-text (codes 11-25 ...)` section comment (`gates/registry.ts:338`): accepted as left untouched. It predates the lane and is outside the cut, so leaving it is the surgical choice. The `tool-boundary (code 35 -> 36)` section comment was correctly updated because the new entry shifts it.
- Naming, `readonly` interface fields, a `ReadonlySet` / `readonly TaskRecord[]` input, a frozen `DORMANT` sentinel shape and a type-only `TaskRecord` import all match the surrounding `gates/*` style. The `// Coded by @sr-engineer` header matches its siblings.

## Architecture
No architecture spec for this feature. Layering fits D4: the predicates live in `gates/`, and the orchestrator step only wires them. `gates/` importing from `tools/` already happens (`tools/evidence-file.js` in four sibling gates). The `tools/config.js` import keeps the new module free of any `lane-paths` substring (AC8 / D1). The registry stays doc-order-only and evaluation order stays in `UPDATE_STATE_GATE_PIPELINE`.
- sr note (4), the lane's own `.current/e247/tasks.md` arms the gate for `e247-*` once the server runs this build: confirmed, and intended (spec "Task ledger and order"). On the current ledger, voided T-E247-05 / -06 are not returned. The final PASS must list every non-voided T-E247 id, or void the conditional ones first.

## Security
No findings. There is no new trust boundary. The ledger path comes from `findTasksFile`, which derives it from the workspace and git HEAD, not from caller input. `activeFeature` is only lowercased and compared as a string; no path is built from it.
- sr note (3), the absolute ledger path in the envelope: acceptable. It is a runtime tool-result message, not durable output: `emitGateTelemetry` persists only `{ts, gate, error_code, agent_id, feature}`, and a rejected write writes no handoff. It follows the sibling `QA_COMPLETION_EVIDENCE_MISSING`, whose envelope carries absolute `qaEvidencePath` paths. The spec's `e247.envelope` leaves `<ledger path>` unspecified.
- **optional (O2)** — a workspace-relative path (`.current/<L>/tasks.md`) would make the message portable when it is pasted into durable notes. Not required: the precedent is the sibling's absolute path.

## Performance
No findings. The step does work only on a file-mode PASS write: at most one `findTasksFile` stat plus one ledger read, and an O(n) scan with Set lookups. No hot-path change on non-PASS writes (one `instanceof` and one string compare).
- **optional (O3)** — same-model note: sr-engineer and code-reviewer both ran on opus this lane (dispatch pins), so blind spots may be shared. To compensate, the review ran the mechanical checks independently (script byte-compare against the spec, a predicate smoke run on `dist/`, a rebuild and a run of the red set).

## Verdict
APPROVED — every AC in this hop's scope is implemented and verified (R1 zero-diff, a dist scope that rebuilds clean, the exact 14-entry red set), with no required findings. R1 is a note for qa T-E247-10 and R2 is a comment trim that does not block.
