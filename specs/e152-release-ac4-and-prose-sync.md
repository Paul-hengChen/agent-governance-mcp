# e152-release-ac4-and-prose-sync

Lane `e152` of the post-v4 wave 12 fan-out (`specs/fanout-post-v4-w12.md`). Four tickets: E152, E365, E371, E372. One feature, `active_feature = e152-release-ac4-and-prose-sync`.

## Problem Statement

Four small text fixes. Each one leaves a document that no longer matches how things really work.

(1) **E152.** In the release-engineer SOP, step 8a's post-commit check (AC4) learns that a release ships more than one feature only from a `Multi-feature release: <a>, <b>` line in the handoff's `pending_notes`. No role is required to write that line. Without it, AC4 takes the REQUIRE branch, checks only `specs/<active_feature>.md`, passes, and never looks at the other features' specs. This looks exactly like a full pass.

(2) **E365.** E139 shipped the gate code `NON_REVIEWER_VERDICT_REJECTED` with `documentedInProse: false` and a `(none)` doc-mapping row, because lane e139 could not touch `content/**`. No constitution sentence names the code yet.

(3) **E371.** `docs/lane-protocol.md` §3 still says `--abandoned` collects only from `qa_reports/` and `review_reports/`, and still lists E217 as a known gap. Since E217, `--abandoned` also copies git-ignored `specs/` files into primary.

(4) **E372.** Two design docs still use the old harvest function names `planShippedEvidenceHarvest` and `applyShippedEvidenceHarvest`. In code these are now the shared pair `planIgnoredEvidenceHarvest` and `applyIgnoredEvidenceHarvest`.

## User Stories

- As a release-engineer shipping a wave, I want AC4 to work out which feature specs the release carries from the release range itself, so that a missing `pending_notes` line cannot quietly reduce the check to one spec.
- As an agent that gets rejected with `NON_REVIEWER_VERDICT_REJECTED`, I want the constitution to name the code and its rule, so that I can find the rule from the code.
- As a lane worker in an `artifacts: local` repo, I want the lane protocol to describe what `finish --abandoned` really keeps, so that I don't plan around a gap that has been fixed.
- As a reader following the `bin/` comments into the rationale docs, I want the function names there to exist in the code.

## Design decisions (per ticket)

### E152: derive the feature set from the release range (option A). Do not add a loud refusal (option B).

**Choice.** AC4 builds the set of other feature specs from the release range:

```
git diff "$PREV_TAG"..HEAD --name-only -- specs/ | grep -E '^specs/[^/]+\.md$' | grep -vE '^specs/(fanout-.*|.*-architecture)\.md$'
```

The command keeps top-level feature specs only. It leaves out `specs/fanout-*.md` wave manifests and `specs/*-architecture.md` companion docs. The pathspec has no glob and both grep patterns are quoted, so the command behaves the same under zsh NOMATCH.

Call **R** the condition "this set contains a path other than `specs/<active_feature>.md`". The MULTI-FEATURE branch now fires on **M ∨ R**, where M means `pending_notes` carries the `Multi-feature release:` line.

The `pending_notes` line becomes **optional extra input**. It is never required. When it is present, the features it names are added to the range-derived set (union), and each one is checked exactly as today (Fixtures I/J/K keep passing unchanged). This is the only way to name a feature whose spec is missing from the range.

**Non-weakening rule for R without M.** When the branch fires only because of R, the active feature is still classified by the single-feature rules:
- Its spec exists in the tree → it must be in the range. If not, STOP with the REQUIRE string, byte-identical.
- It has no spec and `scope_decision_why` records a mini-chain → log the skip.
- It has no spec and no mini-chain record → STOP with the UNCLASSIFIABLE string, verbatim.

Every range-derived sibling spec is logged by path. So:
- A release with no sibling spec in its range (¬M ∧ ¬R) has exactly the same outcome as before.
- A release with sibling specs is never checked less strictly than before.

The REQUIRE, SKIP and UNCLASSIFIABLE triggers change from "`pending_notes` does NOT record a multi-feature release" to "neither `pending_notes` records one nor the range carries another feature spec" (¬M ∧ ¬R). The four branch names stay. "Exactly one of four branches applies" still holds. Both STOP strings stay byte-identical.

**Why A and not B (refuse loudly).**
1. The ticket asks AC4 to stop depending on the prose convention. Option B keeps the convention as a required input and only makes a missing line loud.
2. Option B would stop every wave release in this repo. For example, the range `v4.13.0..v4.14.0` carries four sibling feature specs (`e139`, `e217`, `e362`, `e364`) besides the active `release-post-v4-w11` spec. To get past the stop, the release-engineer would write a line it can derive mechanically from that same range. The stop costs a state write and adds no information.
3. Option A fits entirely in `content/skill-release-engineer.md`. `scripts/verify-release.mjs` (owned by lane e158) does not need to change, so nothing has to be escalated.

**Honest limit, written into the SOP sentence.** A set derived from the range cannot show a feature whose spec is *absent* from the range. That case is covered elsewhere:
- Step 8a's root-file completeness check (E94) runs before the commit and stops on any uncommitted or untracked spec.
- The optional `pending_notes` line can still name such a feature (Fixture J's STOP).

### E365: the review_verdict sentence in `content/const-08-chain-31-mid.md` §3.1, not `const-05` Escalation call format

**Choice.** Add one sentence to the §3.1 code-reviewer-approval bullet of `const-08-chain-31-mid.md` (line 11), directly after the `(\`REVIEW_VERDICT_STATUS_MISMATCH\`)` sentence. It backtick-quotes `NON_REVIEWER_VERDICT_REJECTED`. Suggested text is in Copy / Strings.

**Why.**
1. That bullet is where `review_verdict` and its consistency gate are already defined. The authorship gate is the other half of the same pipeline step (the registry comment says so).
2. The sibling authorship codes `REVIEWER_COMPLETED_TASKS_REJECTED` and `NON_QA_COMPLETED_TASKS_REJECTED` are already documented in `const-08`.
3. `const-08` is tagged `chain` in `prompts/constitution-manifest.ts`. `const-05` is tagged `core` and is always on. Adding the sentence to `const-05` would make the lite bundle and its budgets larger for a code-reviewer gate that lite mode never reaches. Adding it to `const-08` changes only the full/chain goldens and budgets.

**Registry.** In `gates/registry.ts`, only these change:
- the `NON_REVIEWER_VERDICT_REJECTED` entry's `documentedInProse: false` → `true`;
- its doc-mapping comment row: the `(none)` marker is **replaced** by the real site, giving `//   NON_REVIEWER_VERDICT_REJECTED   const-08-chain-31-mid.md`. The row cannot be deleted, because `test/error-code-contract.test.mjs` requires the mapping to list all 35 codes;
- the two comments that state the `false` status:
  - the `documentedInProse` field comment ("Every entry is currently true except NON_REVIEWER_VERDICT_REJECTED …"). It becomes "every entry is true", keeping the E300 history and the opt-out purpose;
  - the catalog comment's "…shipped documentedInProse: false)". Append that it flipped to true when `const-08-chain-31-mid.md` quoted it (E365), the same way the E300/E295 clause is written.

No other line of the file changes. `npm run build` regenerates `dist/gates/registry.*`, and no other `dist/` file may differ.

### E371: two lines of `docs/lane-protocol.md` §3

- **Harvest sub-bullet.** Keep the `--shipped` half and the existing `--abandoned` evidence-move half. Add the `specs/` copy, matching `ABANDON_HARVEST_DIRS` and `STR_USAGE_FEATURE` in `bin/agc-init.mjs` (read-only): every git-ignored, untracked file under `specs/` is copied to primary's `specs/abandoned/<lane>/<relpath>`. The copy is recursive, has no lane-name filter, and is never committed. Tracked specs stay where they are on the kept branch.
- **Known-gaps sub-bullet.** Keep only E196 and drop the E217 clause. The file then contains no `E217`. The new clause does not cite an E number.

The generic file must stay generic: none of the `AC-E290-3` repo-only strings (`dist/`, `test/`, `content/**`, …).

### E372: function names only

- `specs/e260c-bin-scripts.md` (~line 208): use `planIgnoredEvidenceHarvest` / `applyIgnoredEvidenceHarvest`, and add one clause saying the same pair also does `--abandoned`'s `specs/` copy (bucket `abandoned`).
- `specs/e351-lane-protocol-gaps.md`: line 84's "source" cell and line 91 use `planIgnoredEvidenceHarvest`. The text that line 84 quotes from the old lane protocol stays as it is (it is a record), and `planAbandonEvidenceHarvest` stays (it still exists).
- `specs/e213-*` and `specs/e287-*` are not touched.

## Acceptance Criteria

### E152

- **AC-E152-1**: Given `content/skill-release-engineer.md` step 8a AC4, when it is read, then it does all of the following:
  - gives the range-derived command shown above, including the `fanout-*` / `*-architecture` exclusion;
  - says the MULTI-FEATURE branch fires on the `pending_notes` line **or** on another feature spec in the range;
  - calls the line optional;
  - keeps the four bold branch names, the verbatim `AC4_REQUIRE_STOP` and `AC4_UNCLASSIFIABLE_STOP` strings, `git diff <prev-tag>..HEAD --name-only`, and the `AC4: MULTI-FEATURE branch` / `AC4: SKIP branch` / `logged and skipped by design` phrases.
  proof: `node --test test/release-staging.test.mjs` — the `AC4 (E44/E142(b))` content test, extended by qa with the range-derived assertions, passes.
- **AC-E152-2** (the E152 defect): Given a release whose range carries `specs/<active>.md` and one other feature spec, and `pending_notes` without the `Multi-feature release:` line, when AC4 is simulated, then the branch is MULTI-FEATURE, both spec paths are reported as verified, and the result is pass.
  proof: the new qa fixture for the no-line two-spec range in `test/release-staging.test.mjs` passes.
- **AC-E152-3** (non-weakening, R without M):
  - the active spec exists in the tree but is absent from the range → STOP with the REQUIRE string, byte-identical;
  - no active spec and no mini-chain record → STOP with the UNCLASSIFIABLE string, verbatim;
  - no active spec and a mini-chain record → pass.

  proof: the new qa fixtures for the three R-only cases pass.
- **AC-E152-4** (unchanged shapes): Given ¬R, Fixtures C–H keep their assertions and pass. Given M, Fixtures I/J/K keep their assertions and pass.
  proof: `node --test test/release-staging.test.mjs` — Fixtures C, D, E, F, G, H, I, J, K are green with their assertions unchanged.
- **AC-E152-5**: Given every combination of (S, M, R, W) (16 cases), exactly one branch fires.
  proof: the re-pinned `AC4 branch exhaustiveness` test passes.
- **AC-E152-6**: Given a range whose only spec paths are `specs/fanout-x.md`, `specs/<active>-architecture.md` and `specs/<active>.md`, R is false (the check is single-feature).
  proof: the new qa exclusion fixture passes.

### E365

- **AC-E365-1**: `content/const-08-chain-31-mid.md` backtick-quotes `NON_REVIEWER_VERDICT_REJECTED` exactly once, inside the §3.1 `review_verdict` bullet. No other `content/*.md` quotes it.
  proof: ``grep -oF '`NON_REVIEWER_VERDICT_REJECTED`' content/*.md`` prints exactly one line, prefixed `content/const-08-chain-31-mid.md:`.
- **AC-E365-2**: In `gates/registry.ts`:
  - the entry has `documentedInProse: true`;
  - the mapping row reads `//   NON_REVIEWER_VERDICT_REJECTED   const-08-chain-31-mid.md`;
  - the file contains `(none)` zero times;
  - `git diff gates/registry.ts` touches only the entry's `documentedInProse` line, the mapping row and the two comments named above.

  proof: `node --test test/error-code-contract.test.mjs` passes (registry ⊆ doc, doc-file mapping), and `git diff --stat -- gates/` lists only `gates/registry.ts`.
- **AC-E365-3**: After `npm run build`, the only `dist/` paths that differ from base are `dist/gates/registry.*`.
  proof: `git diff --name-only <base>..HEAD -- dist/` lists only `dist/gates/registry.*` files.
- **AC-E365-4**: The compose goldens and `test/context-budget.test.mjs` are re-pinned to the new `const-08` text. Error codes, rejection conditions and every gate's behaviour are unchanged.
  proof: `node --test test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs test/context-budget.test.mjs` passes.
- **AC-E365-5**: The known pins are updated, and nothing else in those files changes:
  - `test/e308-single-source-tier-enum.test.mjs` E303-AC11a: the `(none)` count goes 1 → 0, and the title is updated;
  - `test/e295-hop-cap-and-sop-halves.test.mjs` AC11: the `(none)` count goes 1 → 0;
  - `test/e139-non-reviewer-verdict.test.mjs` AC-E139-7: `documentedInProse` goes false → true;
  - `test/error-code-contract.test.mjs`: the `FREE_TEXT_ALLOWLIST` reason for `NON_REVIEWER_VERDICT_REJECTED`/`triggerEdge` no longer says "documentedInProse:false … no mapped doc file". The row stays allowlisted, because the triggerEdge literal names the exempt edge.

  proof: `node --test test/e308-single-source-tier-enum.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e139-non-reviewer-verdict.test.mjs test/error-code-contract.test.mjs` passes.

### E371

- **AC-E371-1**: In `docs/lane-protocol.md` §3:
  - the harvest sub-bullet describes `--abandoned`'s `specs/` copy into primary's `specs/abandoned/<lane>/` (git-ignored + untracked, recursive, never committed; tracked specs stay on the kept branch);
  - the known-gaps sub-bullet names only E196;
  - `E217` appears 0 times in the file;
  - `git diff docs/lane-protocol.md` changes exactly those two lines.

  proof: `git diff --numstat -- docs/lane-protocol.md` prints `2	2	docs/lane-protocol.md`, and `grep -c E217 docs/lane-protocol.md` prints `0`.
- **AC-E371-2**: `test/e351-lane-protocol-gaps.test.mjs` is re-pinned:
  - `S3_HARVEST` and `S3_GAPS` match the new lines;
  - AC-E351-3 asserts E196 ×1 and E217 ×0;
  - AC-E351-5 also asserts `ABANDON_HARVEST_DIRS` is `["specs"]`, and its "E217 gap" message is reworded.

  The generic-file test `test/e290-lane-protocol-generic.test.mjs` stays green and unmodified.
  proof: `node --test test/e351-lane-protocol-gaps.test.mjs test/e290-lane-protocol-generic.test.mjs` passes.

### E372

- **AC-E372-1**: Neither design doc names the old functions, and both name the new pair. The e260c sentence also says the same helper serves `--abandoned`'s `specs/` copy. `specs/e213-*` and `specs/e287-*` are unchanged.
  proof: `grep -c "ShippedEvidenceHarvest" specs/e260c-bin-scripts.md specs/e351-lane-protocol-gaps.md` prints `:0` for both; `grep -c "IgnoredEvidenceHarvest" specs/e260c-bin-scripts.md` ≥ 2; `git diff --name-only <base>..HEAD -- 'specs/e213-*' 'specs/e287-*'` prints nothing.

### Lane-wide

- **AC-L1**: Under `node scripts/test-lock.mjs -- npm test`, run on the final HEAD after commit with no untracked files, every test passes. The only test files changed are the ones the Cut names.
- **AC-L2**: Every changed path is inside lane e152's 擁有 cell: `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e152 specs/e152-release-ac4-and-prose-sync.md` exits 0. No `schema_version` bump. No E161 qa-SOP sentence.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e152.ac4.range-log | `"AC4: MULTI-FEATURE branch — range-derived: <spec-1>, <spec-2>, … present in <prev-tag>..HEAD"` | authored-here — the log line a range-derived MULTI-FEATURE run prints, so the verified set is visible; it keeps the `AC4: MULTI-FEATURE branch` prefix already pinned |
| e152.ac4.require-stop | `"Release commit incomplete: specs/<active_feature>.md is absent from the release range <prev-tag>..HEAD. Stage missing files and amend or create a fix commit."` | existing (`content/skill-release-engineer.md` step 8a, unchanged byte-for-byte) |
| e152.ac4.unclassifiable-stop | existing UNCLASSIFIABLE string, unchanged byte-for-byte | existing (`content/skill-release-engineer.md` step 8a) |
| e365.const08.sentence | ``Only the code-reviewer may carry `review_verdict`: any other `agent_id` carrying it is rejected with `NON_REVIEWER_VERDICT_REJECTED`, except on the APPROVED handoff itself (`agent_id=qa-engineer` on the `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` edge); file mode only.`` | authored-here — paraphrases the registry entry's `hintStatic` / `clearingArtifact`; sr may tighten the wording but must keep the backtick-quoted code and the exception |
| e371.harvest.abandoned-specs | clause adding: `--abandoned` copies every git-ignored, untracked file under `specs/` to primary's `specs/abandoned/<lane>/<relpath>` (recursive, no lane-name filter, never committed; tracked specs stay on the kept branch) | authored-here — written in the file's existing Traditional Chinese register; facts from `bin/agc-init.mjs` `ABANDON_HARVEST_DIRS` / `STR_USAGE_FEATURE` |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- `scripts/verify-release.mjs` and every other `scripts/**` file (lane e158). Option A needs no script change.
- A server-side gate or a required producer for the multi-feature classification (backlog candidate 2).
- `docs/install.md` (its E371 half was fixed in wave 11), `specs/e213-*`, `specs/e287-*`.
- Any `gates/registry.ts` line outside the E365 entry/row/two comments; any other `dist/**`.
- The qa-SOP sentence for E161's structured field (D1 A, deferred).
- The CHANGELOG, backlog done-marks and version bump (integrator / release-engineer).

## Dependencies / Prerequisites

- Base `f5485a7` (wave 12 manifest merge, PR #49). No architect hop: four text tickets in four different files, no new module, data model or API.
- Resource Audit: the four backlog rows and the manifest's e152 row reference no external artifact (no URL, Figma, mockup or ticket system), so `external_refs` is omitted.
- Mode `no-design` (no `design/e152-release-ac4-and-prose-sync.md`). Visual Structural Assertions are omitted.
- `dispatch_mode` stays `feature`.
- **Routing.** sr-engineer makes every `content/**`, `gates/registry.ts`, `dist/gates/registry.*`, `docs/lane-protocol.md` and `specs/e260c-*`/`specs/e351-*` edit. qa-engineer makes every test change, including the compose-golden and context-budget re-pin. sr does not touch `test/**`.
- **Serial order for sr:** T-E152-01 → T-E365-01 → T-E371-01 → T-E372-01. The files don't overlap, but there is one sr session per task and the order follows the manifest's ticket order.
- **Pinned tests to re-pin (qa), complete list.** Found by grepping for `MULTI-FEATURE`, `Multi-feature release`, `NON_REVIEWER_VERDICT_REJECTED`, `(none)`, `documentedInProse`, the changed `const-08` line-11 phrases, `已知缺口`, the §3 harvest text and `ShippedEvidenceHarvest`:

  | test file | ticket | what changes |
  |---|---|---|
  | `test/release-staging.test.mjs` | E152 | AC4 only: `simulatePostCommitCheck` gains the range-derived R input; the `AC4 (E44/E142(b))` content test gains the range-derived assertions; new fixtures for AC-E152-2/3/6; exhaustiveness goes from 8 to 16 combinations. Fixtures C–K assertions unchanged |
  | `test/e152-*.test.mjs` (optional) | E152 | only if qa prefers the new fixtures in their own file; same content |
  | `test/fixtures/compose-golden/**` | E365 | `build-full-design.txt`, `build-full-design-fd.txt`, `build-full-nondesign.txt`, `build-full-nondesign-fd.txt`, `constitution-monolith.txt`, `hook-full.txt` (the six that include `const-08` line 11); lite goldens are expected unchanged |
  | `test/context-budget.test.mjs` | E365 | whichever full/chain-mode ceilings the added sentence moves |
  | `test/e308-single-source-tier-enum.test.mjs` | E365 | E303-AC11a `(none)` count 1 → 0 (and its title) |
  | `test/e295-hop-cap-and-sop-halves.test.mjs` | E365 | AC11 `(none)` count 1 → 0, nothing else |
  | `test/e139-non-reviewer-verdict.test.mjs` | E365 | AC-E139-7 `documentedInProse` false → true |
  | `test/error-code-contract.test.mjs` | E365 | `FREE_TEXT_ALLOWLIST` reason text for `NON_REVIEWER_VERDICT_REJECTED`/`triggerEdge` |
  | `test/e351-lane-protocol-gaps.test.mjs` | E371 | `S3_HARVEST`, `S3_GAPS`, AC-E351-3 E217 count, AC-E351-5 `ABANDON_HARVEST_DIRS` + message |

  No other test pins the changed sentences:
  - `MULTI-FEATURE` / `Multi-feature release` appear only in `test/release-staging.test.mjs`;
  - the `const-08` line-11 phrases appear only in the goldens;
  - `已知缺口` and the §3 harvest text appear only in `test/e351-lane-protocol-gaps.test.mjs`;
  - `ShippedEvidenceHarvest` appears in no test.

  If the full suite shows a red test outside this list, qa stops and reports it. qa does not re-baseline it.
- **Not touched, must stay green:**
  - `test/compose-equivalence.test.mjs`, `test/e90-golden-capture-completeness.test.mjs` (read the goldens);
  - `test/e290-lane-protocol-generic.test.mjs`;
  - `test/e336-portable-pull.test.mjs`, `test/e166-template-defers-staging.test.mjs` (also read `skill-release-engineer.md`);
  - `test/qa-flow.test.mjs`, `test/e35-pipeline-order.test.mjs`, `test/e26-gate-stats.test.mjs` (name the code; behaviour unchanged).
- No question batch: the E152 option and the E365 site are PM choices recorded above for the human to approve with the cut. One reading is recorded for pre-review: "remove its `(none)` mapping row" is done by replacing the marker with the real file, because the mapping must keep all 35 codes.

## Gate Summary

| gate | outcome |
|---|---|
| Visual State-Count Split | not triggered (no design) |
| Geometric-Density Split | not triggered (no design) |
| Parallel-Lane Cut | not applicable inside the lane (already one fan-out lane; serial sr order above) |
| Scope Decision | `single-feature`: one lane, four text tickets, disjoint files, one feature branch |
| Resource Audit | zero external references; `external_refs` omitted |
| Source-Credibility | not applicable (no design) |
| Question Batch | no-op |
| Ambiguity | none blocking; the one interpretation (mapping row replaced, not deleted) is recorded above |
| Cut-Approval | pending: integrator mailbox pre-review, then human approval in the lane session; PM does not set `cut_approved` |
| Manifest-Tier | not eligible: `cutApprovalAutoTier` is `{}` and the cut carries two option choices (E152 option, E365 site) |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E152-01 | sr (E152): rewrite step 8a AC4 in `content/skill-release-engineer.md` per option A. Add the range-derived spec set (exact command, `fanout-*`/`*-architecture` exclusion, zsh-safe); MULTI-FEATURE fires on M ∨ R; the `pending_notes` line becomes optional and its names are unioned in; R-only keeps the active feature on REQUIRE/SKIP/UNCLASSIFIABLE semantics; REQUIRE/SKIP/UNCLASSIFIABLE conditions become ¬M ∧ ¬R; add the range-derived log line and the honest-limit sentence (E94 + optional line). Both STOP strings stay byte-identical, the four branch names stay. ~20 lines | none | 1 | `content/skill-release-engineer.md` | — |
| T-E365-01 | sr (E365): add the `NON_REVIEWER_VERDICT_REJECTED` sentence to the §3.1 `review_verdict` bullet of `content/const-08-chain-31-mid.md`. In `gates/registry.ts`, flip the entry's `documentedInProse` to `true`, replace the `(none)` mapping marker with `const-08-chain-31-mid.md`, and update the two comments that state the false status. Nothing else in the file. `npm run build`, commit `dist/gates/registry.*` only. ~8 lines | T-E152-01 | 2 (+dist) | `content/const-08-chain-31-mid.md`、`gates/registry.ts`、`dist/gates/registry.*` | — |
| T-E371-01 | sr (E371): `docs/lane-protocol.md` §3, exactly two lines. Add the `--abandoned` `specs/` copy to the harvest sub-bullet; drop the E217 clause from the known-gaps sub-bullet (E196 stays). No `E217`, no AC-E290-3 repo-only string. ~2 lines | T-E365-01 | 1 | `docs/lane-protocol.md` | — |
| T-E372-01 | sr (E372): change function names to `planIgnoredEvidenceHarvest`/`applyIgnoredEvidenceHarvest` in `specs/e260c-bin-scripts.md` (~208, plus the clause that the pair also does `--abandoned`'s `specs/` copy) and `specs/e351-lane-protocol-gaps.md` (84 source cell, 91). Quoted historical text and `specs/e213-*`/`specs/e287-*` are untouched. ~3 lines | T-E371-01 | 2 | `specs/e260c-bin-scripts.md`、`specs/e351-lane-protocol-gaps.md` | — |
| T-E152-02 | qa (E152): AC4 tests. Extend `simulatePostCommitCheck` with the range-derived R input; add the content assertions (AC-E152-1); add fixtures for AC-E152-2/3/6; extend exhaustiveness to 16 combinations (AC-E152-5). Fixtures C–K assertions unchanged (AC-E152-4). New cases may go in `test/e152-*.test.mjs` instead | T-E152-01 | 1–2 | `test/release-staging.test.mjs`、`test/e152-*.test.mjs` | — |
| T-E365-02 | qa (E365): re-pin the six full-mode goldens and the moved `test/context-budget.test.mjs` ceilings. Update the `(none)` counts in `test/e308-single-source-tier-enum.test.mjs` (E303-AC11a) and `test/e295-hop-cap-and-sop-halves.test.mjs` (AC11), `documentedInProse` in `test/e139-non-reviewer-verdict.test.mjs` (AC-E139-7), and the allowlist reason in `test/error-code-contract.test.mjs` (AC-E365-1..5) | T-E365-01 | 5 + goldens | `test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e308-single-source-tier-enum.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e139-non-reviewer-verdict.test.mjs`、`test/error-code-contract.test.mjs` | — |
| T-E371-02 | qa (E371 + E372 + lane-wide): re-pin `test/e351-lane-protocol-gaps.test.mjs` (AC-E371-2). Run the AC-E371-1 and AC-E372-1 proofs, then AC-L1/AC-L2 on the final HEAD (full suite under `node scripts/test-lock.mjs -- npm test`) | T-E371-01, T-E372-01, T-E152-02, T-E365-02 | 1 | `test/e351-lane-protocol-gaps.test.mjs` | — |
