# e419-retire-bookkeeping-stamp

Backlog row E419 (gate-retro wave 2), as amended by the 2026-11-19 audit (`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` section 16.1, ruling 1). Fan-out lane e419 of `specs/fanout-v5-w1.md`. Milestone v5.0.0: merges to `main`, not released on its own (ruling 18).

## Problem Statement

Two write-path mechanisms carry server code, served prompt text, a tool parameter, two registry error codes and dedicated test suites, but neither has ever rejected a write in any measured workspace. Bookkeeping-Write (`bookkeeping_write`) lets a same-feature write keep the old `last_updated` so it does not extend the feature lease. Its one real user is the E21 crash checkpoint in the sr-engineer and qa-engineer SOPs. A checkpoint is written by a role that is actively working, so the feature is alive and the lease should be extended. Stamp-Provenance (`STAMP_PROVENANCE_SUSPECT`) rejects any write while the on-disk `last_updated` has the hand-written shape (`:00.000Z`) unless the write carries a `stamp-remediation:` note, and `tw_detect_drift` reports the same shape in `stampAdvisory`. Both mechanisms add served context to every full-chain dispatch and add steps to the 19-step write pipeline. Ruling 1 retires both. The E21 checkpoint stays, written as an ordinary write that extends the lease. The migration heal keeps its internal don't-restamp writer option.

## User Stories

- As an agent reading the constitution, I want rules only for mechanisms that exist, so that the served context is smaller and every rule I read can actually affect a write.
- As an sr-engineer or qa-engineer about to start a long build or suite, I want my crash checkpoint to be an ordinary write, so that it records progress and keeps my feature's lease fresh.
- As a maintainer, I want `GATE_REGISTRY`, the write pipeline and the docs to list the same gates, so that the gate count and pipeline order I read are the ones the server runs.
- As an adopter upgrading to v5.0.0, I want an old SOP that still sends `bookkeeping_write: true` to keep working, so that my in-flight features are not rejected by the upgrade.

## Acceptance Criteria

Proof commands run from the lane worktree root after `npm run build`. "Live tree" means every tracked path except `dist/`, `specs/`, `CHANGELOG.md`, `docs/backlog.md`, `docs/v4.0.0-new-tickets.md`, `docs/discussion-*.md`, `docs/retro-*`, `docs/prompt-audit-*`, `research/`, `qa_reports/`, `review_reports/`, `.current/` and `test/`. Those paths are historical records or queues, and test files are covered by AC14.

### Bookkeeping-Write retired

- **AC1** — Given the server source, when `tw_update_state`'s zod schema and its MCP `inputSchema` are read, then neither has a `bookkeeping_write` key.
  proof: `node --input-type=module -e "import { TOOL_REGISTRY } from './dist/tools/registry.js'; const t = TOOL_REGISTRY.find(x => x.name === 'tw_update_state'); console.log('bookkeeping_write' in t.inputSchema.properties)"` prints `false` (it prints `true` at base `c29f100`), and `grep -c bookkeeping_write tools/registry.ts` prints `0`.
- **AC2** — Given `GATE_REGISTRY` and `UPDATE_STATE_GATE_PIPELINE`, when listed, then neither contains `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`, and the `GateErrorCode` union no longer has it.
  proof: qa test `test/e419-*.test.mjs` asserts `GATE_REGISTRY.map(g => g.errorCode)` and `UPDATE_STATE_GATE_PIPELINE.flatMap(s => s.codes)` both exclude the code.
- **AC3** — Given an existing file-mode handoff for feature `F`, when a client still sends `tw_update_state({active_feature: "F", ..., bookkeeping_write: true})` (an adopter on an old SOP), then the write is accepted (not rejected), the unknown key is dropped at the tool boundary, and the new `last_updated` is a fresh server stamp (not the old one). The same call with a different `active_feature` gets the normal feature-lease result, not a bookkeeping-specific error.
  proof: qa test in `test/e419-*.test.mjs` (seed F, force an old stamp with `forceSeedStamp`, write with `bookkeeping_write: true`, assert `!isError` and `last_updated !== seed`).
- **AC4** — Given the migration heal in `readHandoffState`, when a v0-shaped handoff is read, then the heal write still keeps the pre-heal `last_updated` exactly (behaviour unchanged). It now uses the renamed internal writer option `preserveLastUpdated` (see Decisions D3), and the writer still applies it only when `active_feature` is unchanged.
  proof: `test/feature-lease.test.mjs` test `AC4 (e10): migration heal-write preserves pre-heal last_updated verbatim` passes (its stamp-provenance block removed by qa, its first assertion untouched).
- **AC5** — Given the sr-engineer and qa-engineer SOPs, when the E21 crash checkpoint line is read, then its `tw_update_state(...)` call has no `bookkeeping_write` argument and the line says the checkpoint is an ordinary write that extends the lease. It no longer says administrative, lease timestamp untouched, or file-mode only. Everything else on the line stays: the `(E21)` origin tag, BEFORE the long step, `agent_id`, the `checkpoint:` note, and the Crash-Resume sentence.
  proof: `test/e20-e21-crash-resilience.test.mjs` (re-pinned by qa) passes, and `grep -c "bookkeeping_write" content/skill-sr-engineer.md content/skill-qa-engineer.md` prints `0` for both.

### Stamp-Provenance retired

- **AC6** — Given the source tree, when listed, then `gates/stamp-provenance.ts` and `dist/gates/stamp-provenance.{js,d.ts,js.map,d.ts.map}` are absent, and no source file imports it.
  proof: `ls gates/stamp-provenance.ts dist/gates/stamp-provenance.js 2>&1 | grep -c "No such file"` prints `2`, and `git grep -n "stamp-provenance" -- tools gates lib prompts bin scripts index.ts` prints nothing.
- **AC7** — Given a file-mode handoff whose `last_updated` is `2026-01-01T00:00:00.000Z` (the hand-written shape), when the next same-feature write arrives with no `stamp-remediation:` note, then it is accepted. A `stamp-remediation:` note now gets no special treatment and is kept as an ordinary pending note.
  proof: qa test in `test/e419-*.test.mjs` (seed, `forceSeedStamp(ws, "2026-01-01T00:00:00.000Z")`, write, assert `!isError`).
- **AC8** — Given `tw_detect_drift`, when it runs on any workspace, then the JSON report has no `stampAdvisory` key (removed, Decisions D1), and the `tw_detect_drift` tool description no longer names it.
  proof: qa test in `test/e419-*.test.mjs` asserts `!("stampAdvisory" in JSON.parse(detectDrift(ws)))` on a hand-written-stamp handoff; `test/e441-tool-description-contracts.test.mjs` re-pinned passes.
- **AC9** — Given `content/skill-release-engineer.md`, when its no-MCP-path relay rule is read, then it still forbids hand-editing state to simulate a write and still says no dispatch brief overrides it. It no longer cites `STAMP_PROVENANCE_SUSPECT` as the backing rejection.
  proof: `test/e394-release-sop.test.mjs` and `test/feature-lease.test.mjs` `E9A-S1` (both re-pinned by qa) pass; `grep -c STAMP_PROVENANCE content/skill-release-engineer.md` prints `0`.

### Counts, docs and live-tree cleanliness

- **AC10** — Given the registry and pipeline, when counted, then `GATE_REGISTRY.length === 34` and `UPDATE_STATE_GATE_PIPELINE.length === 17`. The pipeline order is the old order with steps 2 (`STAMP_PROVENANCE_SUSPECT`) and 4 (`BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`) removed. No other step moves.
  proof: `test/e35-pipeline-order.test.mjs`, `test/error-code-contract.test.mjs`, `test/e26-gate-stats.test.mjs`, `test/e308-single-source-tier-enum.test.mjs` (re-pinned by qa) pass.
- **AC11** — Given the live tree, when grepped for the retired names (literal and regex forms), then nothing matches.
  proof: `git grep -n -E "bookkeeping_write|bookkeepingWrite|Bookkeeping-Write|BOOKKEEPING_WRITE|stamp-provenance|Stamp-Provenance|stampProvenance|STAMP_PROVENANCE|stamp-remediation|stampAdvisory|StampAdvisory|isHandAuthoredStamp|HAND_AUTHORED_STAMP" -- . ':!dist' ':!specs' ':!CHANGELOG.md' ':!docs/backlog.md' ':!docs/v4.0.0-new-tickets.md' ':!docs/discussion-*' ':!docs/retro-*' ':!docs/prompt-audit-*' ':!research' ':!qa_reports' ':!review_reports' ':!.current' ':!test'` prints nothing.
- **AC12** — Given the docs, when read, then every live statement of the pipeline length says 17 and every statement of the registry size says 34. This covers `README.md` lines ~69 and ~230, `CLAUDE.md` lines ~48 and ~62, `docs/architecture.md` (the layer box, the pipeline intro, the pipeline diagram renumbered 1–17, and the registry-size sentence) and `CONTRIBUTING.md`'s gate module list (`stamp-provenance` dropped; its stale "33 gate definitions" corrected to 34). `CLAUDE.md`'s gate module list (line ~107) drops `stamp-provenance`. The `agc-version` stamp in `CLAUDE.md` is not touched.
  proof: `git grep -n -E "19-step|19 steps|36 entries|33 gate" -- README.md CLAUDE.md docs/architecture.md CONTRIBUTING.md` prints nothing; `git diff c29f100 -- CLAUDE.md | grep -c agc-version` prints `0`.
- **AC13** — Given `content/**`, when the change is applied, then the Bookkeeping-Write and Stamp-Provenance bullets are gone from `content/const-08-chain-31-mid.md`, and no edited `content/**` line names a path that exists only in this repo.
  proof: `test/e437-repo-only-paths.test.mjs` (site 2 re-anchored or retired by qa because its anchor sentence is deleted) passes; code-reviewer reads every `content/**` hunk for repo-only paths.

### Tests, schema, goldens, budget

- **AC14** — Given `test/`, when the suite runs, then the two suites dedicated to the retired mechanisms are deleted (`test/drift-stamp-advisory.test.mjs`, `test/e148-stamp-provenance-seed.test.mjs`). The mixed suites keep their kept-mechanism tests: `test/e18-write-provenance.test.mjs` keeps every `QA_COMPLETION_EVIDENCE_MISSING` test, and `test/feature-lease.test.mjs` keeps every lease and lease-override test. `test/e148-seed-stamp.mjs` stays at its path with its exports `SAFE_SEED_STAMP`, `forceSeedStamp`, `forceSeedStampIfExists`, `freshNonSuspectStamp` and `nonSuspectStampAt` unchanged (Decisions D2). Every test file in the Probe list below passes.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 after commit, with a clean worktree.
- **AC15** — Given the handoff schema, when the change lands, then no schema version changes. `bookkeeping_write` was never persisted and `stampAdvisory` lives only in the drift report.
  proof: `git diff c29f100 -- schema/` prints nothing; qa states it in the review.
- **AC16** — Given the compose goldens, when qa re-captures them once after the content edits, then exactly six change, each by removal only: `build-full-design.txt`, `build-full-design-fd.txt`, `build-full-nondesign.txt`, `build-full-nondesign-fd.txt`, `constitution-monolith.txt` and `hook-full.txt`. The six lite and coordinator-monolith goldens stay byte-identical. qa explains each hunk.
  proof: `npm run build && node scripts/capture-constitution-golden.mjs && git status --porcelain test/fixtures/compose-golden/` lists exactly those six; the golden test in `npm test` passes.
- **AC17** — Given `test/context-budget.test.mjs`, when qa re-measures, then no floor (a `>=` saving) fails. Each cap (a `<=` limit) that this ticket's shrink moves is lowered to its exact measured value with zero headroom (Decisions D4). The PM probe measured four moved caps and no moved floor (table in Decisions D4).
  proof: `node --test test/context-budget.test.mjs` passes, and the four lowered caps equal qa's measured values (stated in the review).
- **AC18** — Given `dist/`, when `npm run build` runs on the final tree, then `git status --porcelain dist/` is empty after commit and only the files in this lane's owned `dist/` globs changed.
  proof: `git diff --stat c29f100 -- dist/ | grep -v -E "dist/gates/|dist/tools/(handoff-orchestrator|handoff-parse|handoff-write|registry|drift)\." | grep -c "|"` prints `0`.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sr.checkpoint.tail | `— an ordinary write that refreshes the lease (the feature is alive).` | authored-here — ruling 1 (16.1) wording: "改成一般寫入（照常延長租約）"; sr may reword if the pinned meaning holds |
| qa.checkpoint.tail | `— an ordinary write that refreshes the lease;` | authored-here — same ruling; keeps the line's existing `; a Crash-Resume reads …` continuation |

No other user-facing string is introduced. The removed strings (two error codes, two hints, two constitution bullets, one tool parameter description, one drift advisory sentence) are deletions.

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Manifest-tier cut approval and the Token Budget Brake (kept by the 2026-11-13 ruling).
- `tools/handoff-types.ts` (it has no `bookkeeping_write` field; removed from the file list by the audit amendment).
- Any other `tools/**` or `gates/**` file, including `tools/storage.ts` and `tools/storage-sqlite.ts` (neither names the option).
- Anything from E431 on, and every E422 file (`tools/config.ts`, `docs/config.md`, `package.json`, the ticket-file files).
- `docs/backlog.md` done-marking, version bump and CHANGELOG. These are release-engineer's at the v5.0.0 release (ruling 18). Note for that release: v5.0.0 must list as breaking the removed `tw_update_state` parameter `bookkeeping_write` (silently ignored, not rejected), the removed codes `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` and `STAMP_PROVENANCE_SUSPECT`, and the removed `tw_detect_drift` field `stampAdvisory`.
- Historical records: existing specs (including the `specs/e260*-rationale.md` headings for the deleted code), CHANGELOG sections, retros, audits, the discussion file and `docs/v4.0.0-new-tickets.md`.
- Comments and titles in test files that mention the retired gate only as background (listed under Probe as "comment-only"). qa may refresh them while already editing a file, but they are not required.

## Dependencies / Prerequisites

- Depends on E418 (DONE, v4.21.0). No dependency on E422 (disjoint files, `specs/fanout-v5-w1.md`).
- Human rulings applied: 2026-11-13 re-scope to two mechanisms; 16.1 ruling 1 (2026-11-19: retire the field, keep the E21 checkpoint as an ordinary write, keep the heal's internal option); ruling 18 (ship with E435 in v5.0.0); fan-out approval 2026-11-19 (lane list, ownership re-partition, merge order).
- No `design/<feature>.md`; mode = no-design. Visual Structural Assertions omitted.
- External references: none (no URL, design file, or tracker reference in the backlog row, the manifest row or ruling 1).

## Decisions

The fan-out manifest left these to the cut ("交給各 lane 的 PM 在 cut 裡決定"). Each is a PM decision. None is put to the human as an option, because in each case one choice is at least as safe as the other and keeps the human out of the loop.

- **D1 — `DriftReport.stampAdvisory`: removed** (not fixed at null). The field, its computation, its interface comment and its mention in the `tw_detect_drift` description go. Reason: this ticket ships inside v5.0.0, a major version, so a JSON field can be removed now at no extra versioning cost. Keeping it as a permanent `null` would advertise a field that never carries data, and removing it later would need another major. No consumer in this repo reads it except its own test and the description pin. A consumer that does `if (report.stampAdvisory)` behaves the same either way (`undefined` and `null` are both falsy). Only a consumer that checks the key exists (`"stampAdvisory" in report`) sees a difference.
- **D2 — `test/e148-seed-stamp.mjs`: kept** at its path (not migrated). It imports only `dist/tools/lane-paths.js`, not the gate, so all 28 importing test files keep working untouched. The fixed seed stamps still make seed-then-write fixtures deterministic. qa rewrites its header comment to drop the deleted-gate reference and deletes the `SUSPECT_SEED_STAMP` export, whose only importer (`test/e148-stamp-provenance-seed.test.mjs`) is deleted.
- **D3 — internal writer option renamed** `bookkeepingWrite` → `preserveLastUpdated` (in `tools/handoff-write.ts` and its one caller, the heal in `tools/handoff-parse.ts`). Internal only, no external surface. The new name says what the option does now that "bookkeeping write" is no longer a concept, and it keeps the AC11 live-tree grep clean. The same-feature guard inside the writer stays.
- **D4 — goldens and budget.** One golden re-capture by qa after all content edits (six goldens, AC16). PM probe numbers (`~tok`, chars/4, measured on a scratch copy with the probe edits):

  | budget test | kind | base | probe | action |
  |---|---|---|---|---|
  | non-design constitution | cap `<=` | 7484 | 6937 | lower cap to measured |
  | design-arm stripped constitution | cap `<=` | 9387 | 8840 | lower cap to measured |
  | teamwork stripped bundle | cap `<=` | 19012 | 18465 | lower cap to measured |
  | skill-sr stripped body | cap `<=` | 2816 | 2805 | lower cap to measured |
  | rationale+origin-tag saving | floor `>=` 240 | 442 | 415 | none (still above floor) |
  | design-only strip saving | floor `>=` 1903 | 1903 | 1903 | none (unchanged) |
  | design − non-design bundle | floor `>=` 1830 | 2066 | 2067 | none |
  | dual-injection saving | floor `>=` 1200 | 4171 | 4171 | none |
  | lean always-on, skill-pm | cap | 5761, 4791 | unchanged | none |

  No floor is affected, so the E336/E365 floor re-set does not apply. The caps are lowered because the test file's own cap rule says each cap is "the exact measured size (zero headroom)". Leaving about 550 tokens of headroom would let later content growth pass unnoticed. qa uses its own measured numbers, which may differ by a few tokens from the probe because sr's final wording may differ.
- **D5 — no architect hop.** This change only removes code. It adds no data model, no new API and no new module. Every removal site is listed below by file and symbol. The only design questions were D1–D3, and they are decided here. The ≥3-module architect threshold is meant for new structure; this ticket only takes structure away. Route pm → sr-engineer.
- **D6 — stale callers are ignored, not rejected.** `tw_update_state`'s top-level zod object is not `.strict()`, so an unknown key is dropped. An adopter whose old SOP still sends `bookkeeping_write: true` gets an ordinary write that refreshes the lease. That is exactly the ruled checkpoint behaviour, so no new rejection code is added (AC3).

## Removal sites (for sr-engineer)

- `gates/stamp-provenance.ts` — delete; `git rm` the four `dist/gates/stamp-provenance.*` files (tsc does not delete them).
- `gates/registry.ts` — remove both union members, both doc-map comment lines (~91–92), both `GateDefinition` entries (~293–336); fix the section-header code ranges (`codes 7-10`, `codes 11-25`, `code 36`) if they no longer match.
- `tools/handoff-orchestrator.ts` — remove the stamp-provenance import, the `STAMP_PROVENANCE_SUSPECT` step, the `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE` step, and the `bookkeepingWrite: parsed.bookkeeping_write` pass-through with its comment.
- `tools/registry.ts` — remove the zod `bookkeeping_write` field and its comment, the `inputSchema` `bookkeeping_write` property, and `stampAdvisory, ` from the `tw_detect_drift` description.
- `tools/drift.ts` — remove the import, `computeStampAdvisory`, the interface field and its comment, the `fanoutAdvisory` comment's "like stampAdvisory above" reference, and every `stampAdvisory` line in the report literals.
- `tools/handoff-write.ts`, `tools/handoff-parse.ts` — rename the option (D3); reword comments that say "bookkeeping write" to describe the preserve option.
- `content/const-08-chain-31-mid.md` — delete the Bookkeeping-Write and Stamp-Provenance bullets (lines 6–7).
- `content/skill-sr-engineer.md` step 4a, `content/skill-qa-engineer.md` Phase 4 crash checkpoint — drop `bookkeeping_write=true, ` and replace the administrative/lease-untouched clause (Copy / Strings).
- `content/skill-release-engineer.md` line 20 — drop ` (the server rejects such stamps as \`STAMP_PROVENANCE_SUSPECT\`)`.
- Docs per AC12.

sr leaves the test pins red for qa and records them in `qa_reports/expected-red_e419-retire-bookkeeping-stamp.txt` (the red set the Probe below predicts).

## Probe — tests red only because of this ticket

Method (real run, not only grep): the base tree at `c29f100` and a probe tree were copied to a scratch directory outside the repo and each was given its own throwaway history. The probe tree had the source and `content/**` removals applied (D1 and D3 as decided, docs not edited, no test or golden touched) and was built with `tsc`, with stale `dist/gates/stamp-provenance.*` removed. `node --test test/*.test.mjs` ran on both. Base: 4330 tests, 0 failed. Probe: 4310 tests, 42 failed, in exactly these files. Every one is red only because of this ticket.

| test file | red tests | qa action |
|---|---|---|
| `test/compose-equivalence.test.mjs` | 6 | none to the file; re-capture the six goldens (AC16) |
| `test/drift-stamp-advisory.test.mjs` | 7 | delete (dedicated suite) |
| `test/e148-stamp-provenance-seed.test.mjs` | 1 (import of the deleted module) | delete (dedicated suite) |
| `test/e18-write-provenance.test.mjs` | whole file (import of the deleted module) | remove the stamp-provenance import and tests; keep every `QA_COMPLETION_EVIDENCE_MISSING` test |
| `test/e20-e21-crash-resilience.test.mjs` | 5 | re-pin the two checkpoint lines to the ordinary-write wording (AC5) |
| `test/e26-gate-stats.test.mjs` | 6 | 36 → 34 |
| `test/e308-single-source-tier-enum.test.mjs` | 1 | 36 → 34 |
| `test/e35-pipeline-order.test.mjs` | 3 | 19 → 17, drop the two steps from the expected sequence |
| `test/e394-release-sop.test.mjs` | 1 | drop the `STAMP_PROVENANCE_SUSPECT` assertion in `L:E18 L:E9 relay rule` |
| `test/e410-task-alias-content-tail.test.mjs` | 1 | `const-08-chain-31-mid.md` line count 13 → 11 (**not in the manifest's test list; found by this probe**) |
| `test/e437-repo-only-paths.test.mjs` | 1 | retire site 2 (its anchor sentence is deleted) and the `gates/stamp-provenance.ts` entry in the banned list if no longer needed |
| `test/e441-tool-description-contracts.test.mjs` | 1 | `tw_detect_drift` description without `stampAdvisory` (D1) |
| `test/error-code-contract.test.mjs` | 3 | 36 → 34 (two tests); drop the two retired allowlist rows. The registry/code parity test goes green on its own once sr removes the doc-map comment lines in `gates/registry.ts` |
| `test/feature-lease.test.mjs` | 5 | remove the E10-AC5a/AC5b/AC6a/AC6b and SQLite AC9b bookkeeping tests and the E10-AC8b bullet test; cut the stamp-provenance block out of `AC4 (e10)` and keep its first assertion (AC4); drop the `STAMP_PROVENANCE_SUSPECT` assertion in `E9A-S1` |

Not red but edited by qa: `test/e148-seed-stamp.mjs` (D2), `test/context-budget.test.mjs` (D4 caps), `test/fixtures/compose-golden/**` (six goldens), new `test/e419-*.test.mjs` (AC2, AC3, AC7, AC8).

Named in the manifest's test list but **not red** (they mention the retired gate only in comments, or the word "bookkeeping" in an unrelated sense), so they are left untouched: `test/ac-execution.test.mjs`, `test/dispatch-pins.test.mjs`, `test/e23-evidence-schema.test.mjs`, `test/e28-shrink-warning.test.mjs`, `test/e38-next-role-lookahead.test.mjs`, `test/qa-flow.test.mjs`, `test/release-staging.test.mjs`, `test/success-metrics.test.mjs`. Also comment- or title-only and untouched: `test/e128-orchestrator-blocked-repair.test.mjs` ("19-step" in a title) and `test/hop-count-transitions.test.mjs`.

Literal and regex greps that were run (all tracked files outside the historical set): `bookkeeping_write|bookkeepingWrite|BOOKKEEPING`, `stamp-provenance|stampProvenance|STAMP_PROVENANCE|stamp-remediation|stampAdvisory`, `isHandAuthoredStamp|HAND_AUTHORED|SUSPECT_SEED_STAMP|hasStampRemediation`, `19-step|19 steps|36 entries|15 modules`, and `GATE_REGISTRY|UPDATE_STATE_GATE_PIPELINE` with `length`. The probe found one file that the greps did not: `test/e410-task-alias-content-tail.test.mjs`, a line-count pin.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E419 | Retire Bookkeeping-Write (field, orchestrator step, registry entry, error code; heal option kept and renamed `preserveLastUpdated`; E21 checkpoint becomes an ordinary write) and Stamp-Provenance (gate module, step, registry entry, `stamp-remediation:`, release-SOP mention, `stampAdvisory` removed). Registry 36→34, pipeline 19→17, docs synced, six goldens re-captured, four budget caps lowered | none | 15 + `dist/` + 15 tests + 6 goldens | `README.md`、`CLAUDE.md`、`docs/architecture.md`、`CONTRIBUTING.md`、`gates/registry.ts`、`gates/stamp-provenance.ts`、`tools/handoff-orchestrator.ts`、`tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/drift.ts`、`dist/gates/**`、`dist/tools/{handoff-orchestrator,handoff-parse,handoff-write,registry,drift}.*`、`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e148-seed-stamp.mjs`、`test/drift-stamp-advisory.test.mjs`、`test/e148-stamp-provenance-seed.test.mjs`、`test/e18-write-provenance.test.mjs`、`test/e20-e21-crash-resilience.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/e308-single-source-tier-enum.test.mjs`、`test/e35-pipeline-order.test.mjs`、`test/e394-release-sop.test.mjs`、`test/e410-task-alias-content-tail.test.mjs`、`test/e437-repo-only-paths.test.mjs`、`test/e441-tool-description-contracts.test.mjs`、`test/error-code-contract.test.mjs`、`test/feature-lease.test.mjs`、`test/e419-*.test.mjs` | — |

## Tasks

Ledger: `.current/e419/tasks.md` (written with `tw_add_task`). One serial chain: sr-engineer runs T-E419-01..04 in order (each within the 5-file / 300-line `task_size` budget; `dist/` is regenerated output and not counted), code-reviewer reviews the four together, then qa-engineer runs T-E419-05..07 in order.

| id | role | P | summary | files | depends_on |
|---|---|---|---|---|---|
| T-E419-01 | sr-engineer | P1 | Retire Stamp-Provenance in source (delete module, `git rm` its four `dist/` files, registry entry + union + doc-map line, orchestrator step + import, `stampAdvisory` removal in drift and the `tw_detect_drift` description) | `gates/stamp-provenance.ts`, `gates/registry.ts`, `tools/handoff-orchestrator.ts`, `tools/drift.ts`, `tools/registry.ts` | none |
| T-E419-02 | sr-engineer | P1 | Retire Bookkeeping-Write in source (zod field + `inputSchema` property, orchestrator step + pass-through, registry entry + union + doc-map line, section-header code ranges); rename the writer option to `preserveLastUpdated` | `tools/registry.ts`, `tools/handoff-orchestrator.ts`, `gates/registry.ts`, `tools/handoff-write.ts`, `tools/handoff-parse.ts` | T-E419-01 |
| T-E419-03 | sr-engineer | P1 | Content: delete the two `const-08` bullets; E21 checkpoint lines in the sr and qa SOPs become ordinary writes (Copy / Strings); drop the `STAMP_PROVENANCE_SUSPECT` parenthetical from the release-engineer relay rule. No repo-only path enters `content/**` | `content/const-08-chain-31-mid.md`, `content/skill-sr-engineer.md`, `content/skill-qa-engineer.md`, `content/skill-release-engineer.md` | T-E419-02 |
| T-E419-04 | sr-engineer | P2 | Docs per AC12 (17 steps, 34 entries, gate module lists); `npm run build`; write `qa_reports/expected-red_e419-retire-bookkeeping-stamp.txt` naming the Probe red set | `README.md`, `CLAUDE.md`, `docs/architecture.md`, `CONTRIBUTING.md` | T-E419-03 |
| T-E419-05 | qa-engineer | P1 | Registry/pipeline/contract pins: `e35`, `error-code-contract`, `e26`, `e308`, `e441`; new `test/e419-*.test.mjs` for AC2, AC3, AC7, AC8 | 6 test files | T-E419-04 |
| T-E419-06 | qa-engineer | P1 | Dedicated and mixed suites: delete `drift-stamp-advisory` and `e148-stamp-provenance-seed`; trim `e18-write-provenance` and `feature-lease` (keep the kept-mechanism tests, AC4); `e148-seed-stamp.mjs` header + drop `SUSPECT_SEED_STAMP` (D2) | 5 test files | T-E419-05 |
| T-E419-07 | qa-engineer | P1 | Content pins (`e20-e21`, `e394`, `e410`, `e437`); one golden re-capture (AC16, per-hunk explanation); budget re-measure and lower the four caps (AC17, D4); confirm no schema bump (AC15) and `dist/` scope (AC18); full suite after commit (AC14); run every AC proof | 4 test files + goldens + `test/context-budget.test.mjs` | T-E419-06 |

Release bookkeeping (CHANGELOG, version, backlog done-mark) is not cut here: E419 ships in v5.0.0 with E435 (ruling 18), and the integrator writes the not-yet-released done-mark at the wave close.
