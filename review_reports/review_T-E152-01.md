# Review — T-E152-01

covers: T-E152-01, T-E365-01, T-E371-01, T-E372-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Base `f5485a7`, branch `feat/e152-release-ac4-and-prose-sync`. Diff under review:
`git diff f5485a7..HEAD` (commits 8757b05, 74bafc4, 351d7a0, 53d05a9, ledger 330b613),
judged against `specs/e152-release-ac4-and-prose-sync.md` (`## Cut` + ACs). No
architecture spec exists for this feature (no architect hop, per the spec).

## Summary
- T-E152-01: step 8a AC4 in `content/skill-release-engineer.md` now derives the feature-spec set from the release range; MULTI-FEATURE fires on M ∨ R; REQUIRE/SKIP/UNCLASSIFIABLE are keyed on ¬M ∧ ¬R; R-only non-weakening and the honest-limit sentence are present.
- T-E365-01: one sentence added to the const-08 §3.1 `review_verdict` bullet; `gates/registry.ts` changes only the entry's `documentedInProse`, its mapping row, and the two status comments; `dist/` diff is `dist/gates/registry.*` only and matches a fresh compile.
- T-E371-01: `docs/lane-protocol.md` §3, exactly two lines (numstat 2/2), `E217` ×0, `--abandoned` description matches `bin/agc-init.mjs`.
- T-E372-01: function names only in `specs/e260c-*` / `specs/e351-*`; `specs/e213-*` / `specs/e287-*` untouched.
- Verdict: CHANGES_REQUESTED — one `required` finding (F1): the handoff intentionally leaves 14 tests red but `qa_reports/expected-red_e152-release-ac4-and-prose-sync.txt` does not exist. The text changes themselves are clean.

## AC Completeness
AC-E152-1 — implemented (sr text) — `content/skill-release-engineer.md:224-228`: range command byte-identical to the spec (1 occurrence each in SOP and spec); `fanout-*` / `*-architecture` exclusion present; "WHEN M OR R holds (M ∨ R)"; "That line is optional extra input, never required"; four bold branch names, `AC4: MULTI-FEATURE branch`, `AC4: SKIP branch`, `logged and skipped by design`, `git diff <prev-tag>..HEAD --name-only` all retained (counts base→head 1→1 / 1→2 / 1→1 / 2→2 / 2→2). Proof test owned by T-E152-02 (out of this round's scope).
AC-E152-2 — implemented (sr text) — `:226` MULTI-FEATURE fires on R alone; union + per-spec range membership check yields pass for the no-line two-spec range. Fixture owned by T-E152-02.
AC-E152-3 — implemented (sr text) — `:226` "Non-weakening when only R fires (E152)" names all three cases with the REQUIRE string "byte-identical" and the UNCLASSIFIABLE string "verbatim". Fixtures owned by T-E152-02.
AC-E152-4 — implemented (sr text) — under ¬R every branch condition reduces to the base condition (¬M); under M the MULTI-FEATURE check is the base check plus range-derived names. Proof owned by T-E152-02.
AC-E152-5 — implemented (sr text) — branch conditions partition (S, M, R, W): REQUIRE = S∧¬M∧¬R, MULTI = M∨R, SKIP = ¬S∧¬M∧¬R∧W, UNCLASSIFIABLE = ¬S∧¬M∧¬R∧¬W — exactly one of 16. Proof owned by T-E152-02.
AC-E152-6 — implemented (sr text) — command excludes `specs/fanout-*.md` and `specs/*-architecture.md`; reviewer ran it on `v4.13.0..v4.14.0`: 6 spec paths in, `specs/fanout-post-v4-w11.md` dropped, 5 kept (matches the spec's example of four siblings + the active spec).
AC-E365-1 — implemented — `grep -oF` prints exactly one line, `content/const-08-chain-31-mid.md:11`, inside the §3.1 `review_verdict` bullet directly after the `REVIEW_VERDICT_STATUS_MISMATCH` sentence.
AC-E365-2 — implemented — `gates/registry.ts:605` `documentedInProse: true`; `:109` mapping row `//   NON_REVIEWER_VERDICT_REJECTED   const-08-chain-31-mid.md`; `(none)` ×0; diff hunks touch only the field comment (`:69-71`), the mapping row, the catalog comment (`:121-122`), and the entry line.
AC-E365-3 — implemented — `git diff --name-only f5485a7..HEAD -- dist/` lists only `dist/gates/registry.{d.ts.map,js,js.map}`; reviewer recompiled to a scratch outDir: `diff -rq --exclude='*.map'` vs `dist/` is empty, `registry.js` / `registry.d.ts` byte-identical, both maps' `mappings` identical (only `sources` differs, an outDir artefact).
AC-E365-4 — out of this round's scope (qa re-pin, T-E365-02).
AC-E365-5 — out of this round's scope (qa re-pin, T-E365-02).
AC-E371-1 — implemented — `docs/lane-protocol.md:43-44`; numstat `2	2`; `grep -c E217` = 0; harvest clause states git-ignored + untracked, recursive, no lane-name filter, never committed, tracked specs stay on the kept branch.
AC-E371-2 — out of this round's scope (qa re-pin, T-E371-02).
AC-E372-1 — implemented — `ShippedEvidenceHarvest` count 0 in both files; `IgnoredEvidenceHarvest` count 2 in `specs/e260c-bin-scripts.md`; e260c gains the `--abandoned` `specs/` clause (bucket `abandoned`); `git diff --name-only f5485a7..HEAD -- 'specs/e213-*' 'specs/e287-*'` is empty; the quoted historical lane-protocol text in e351 line 84 is unchanged and `planAbandonEvidenceHarvest` (still defined in `bin/agc-init.mjs`) stays.
AC-L1 — out of this round's scope (final-HEAD full suite, T-E371-02).
AC-L2 — implemented — `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e152 specs/e152-release-ac4-and-prose-sync.md` exits 0 ("0 out of bounds"); no `test/**` path in the sr diff; no `schema_version` bump.

## Correctness
- **F1 (required) — expected-red manifest missing.** The handoff intentionally leaves tests red for the qa re-pin hop (SOP step 4a arms). Reviewer ran the spec's listed files at HEAD: 14 fail, all inside the spec's re-pin list — `test/compose-equivalence.test.mjs` ×6 (build-full-nondesign, build-full-design, build-full-nondesign-fd, build-full-design-fd, hook-full, constitution monolith), `test/context-budget.test.mjs` ×3 (rationale-stripped design-arm constitution floor, teamwork coordinator bundle floor, non-design constitution floor), `test/e139-non-reviewer-verdict.test.mjs` ×1 (AC-E139-7), `test/e295-hop-cap-and-sop-halves.test.mjs` ×1 (AC11), `test/e308-single-source-tier-enum.test.mjs` ×1 (E303-AC11a), `test/e351-lane-protocol-gaps.test.mjs` ×2 (AC-E351-2, AC-E351-3). The reds themselves are expected and are NOT the finding. The finding is that `qa_reports/expected-red_e152-release-ac4-and-prose-sync.txt` does not exist: the sr SOP (step 7a, Expected-Red Manifest) requires one `<test file> | <exact test name>` line per intentional red, and states that a prose catalogue (pending_notes, or the spec's re-pin table) does not substitute, because qa's Phase 0.5 diffs the manifest against the actual suite run. Fix: sr adds that file with the 14 entries (exact test-name strings as printed by `node --test`), grouped under `#` rationale lines per ticket, and commits it (path is inside the lane's implicit bookkeeping bounds, `qa_reports/*e152*`). No text change to any other file is requested.
- No other findings. T-E152-01 branch conditions are internally consistent: the base's "`pending_notes` does NOT record a multi-feature release" phrasing is gone from every branch (count 2→0), each of REQUIRE / SKIP / UNCLASSIFIABLE now reads ¬M ∧ ¬R, and MULTI-FEATURE reads M ∨ R. Both STOP strings are byte-identical to base (count 1→1 each, full-string match). The honest-limit sentence states that range-derived siblings are in range by construction (gain = listing/logging every feature spec), and that a spec absent from the range stays invisible, covered only by the optional line and 8a's E94 root-file completeness check (which exists at `content/skill-release-engineer.md:218`). The command is zsh-safe: reviewer ran it under `zsh` with `setopt nomatch extendedglob` and got the same 5 paths as under bash.
- T-E365-01 sentence checked against the predicate (`tools/handoff-orchestrator.ts` REVIEW_VERDICT_STATUS_MISMATCH step, authorship half): fires on `FileHandoffStorage && review_verdict && agent_id && agent_id !== "code-reviewer"` unless prev `(code-reviewer, In_Progress)` → next `(qa-engineer, In_Progress)` with `review_verdict=APPROVED`. The sentence's "any other `agent_id` … except on the APPROVED handoff itself (`agent_id=qa-engineer` on the … edge); file mode only" is accurate; "any other `agent_id`" correctly implies an agent_id is present.
- T-E371-01 checked against `bin/agc-init.mjs`: `ABANDON_HARVEST_DIRS = ["specs"]`, its comment ("every git-ignored, untracked file under them, recursively and with no ticket-token filter … never committed. Tracked files stay where they are on the kept branch"), the `--abandoned` call `planIgnoredEvidenceHarvest({ dirs: ABANDON_HARVEST_DIRS, bucket: "abandoned", … })`, and `STR_USAGE_FEATURE` ("copies git-ignored specs/ files into primary's specs/abandoned/<ticket-id>/"). The new clause matches.
- **O1 (optional)** — `git diff --name-only` also lists specs *deleted* in the range, so a deleted top-level spec would set R. Outcome is harmless (non-weakening keeps the active-feature checks; the deleted sibling falls to "logged and skipped by design"), and the spec fixes the command verbatim, so no change requested; a future `--diff-filter=d` would make the log line exact.
- **O2 (optional)** — the trailing `grep` exits 1 on an empty set; read as R = false that is the intended outcome, but a release-engineer running the pipeline under `set -e -o pipefail` would abort. Prose-only SOP, so no change requested.

## Quality
No findings. New prose reuses the file's existing register and branch vocabulary; the e351 table edit changes only the "source" cell, leaving the quoted record intact. `agc check — comments` reports two `gates/registry.ts` long-block warnings (`:77` the 35-row doc-mapping table, `:114` the catalog comment); both blocks pre-exist at base and the spec mandates editing exactly these comments (the catalog block grew by one line). Kept: the mapping table is required verbatim by `test/error-code-contract.test.mjs`, and the catalog comment is the registry's own history record.

## Architecture
No architecture spec for this feature. Placement follows the spec's recorded decisions: the E365 sentence sits in chain-tagged `const-08`, not core `const-05`, so lite bundles are untouched; E152 option A stays entirely in `content/skill-release-engineer.md` with no `scripts/**` change (lane e158 boundary respected).

## Security
No findings. No executable code changes beyond a regenerated `dist/gates/registry.js` that differs only in the `documentedInProse` literal and comments. No absolute local paths, hostnames or personal identifiers in any added line (grep for home-directory / org strings: 0). Citations are generic (E-numbers, file names).

## Performance
No findings. Prose and metadata only; the one runtime-visible change is a boolean literal in a static registry.

## Verdict
CHANGES_REQUESTED — every text change matches the spec and the code it describes, but the handoff leaves 14 intentional reds with no `qa_reports/expected-red_e152-release-ac4-and-prose-sync.txt` manifest (F1, required); add the manifest and this review can approve without re-reading the text diffs.

## Round 2 — APPROVED — by code-reviewer

Re-review range: `c6a8e2f..HEAD` (sr fix `b767ba0`, ledger `370c0df`), against base `f5485a7` and `specs/e152-release-ac4-and-prose-sync.md`.

## Summary
- The round-2 delta adds `qa_reports/expected-red_e152-release-ac4-and-prose-sync.txt` (14 entries) plus lane bookkeeping. Nothing else changed.
- `git diff --stat c6a8e2f..HEAD` lists only the manifest, `.current/e152/dispatch.jsonl` and `.current/e152/handoff.md`. The text diffs approved in round 1 (`content/`, `gates/registry.ts`, `dist/gates/registry.*`, `docs/lane-protocol.md`, `specs/e260c-*`, `specs/e351-*`) are byte-unchanged since `c6a8e2f`.
- F1 is resolved: the manifest exists, follows the repo convention, and matches the reds at HEAD exactly in both directions.
- Verdict: APPROVED.

## AC Completeness
The round 1 per-AC table still applies, because no implementation file changed since `c6a8e2f`. The ACs deferred to qa (AC-E152-5/6, AC-E365-4/5, AC-E371-2, AC-L1) are still qa-owned re-pins. Every red that blocks them is now listed in the manifest. AC-L2 is implemented: `node scripts/fanout.mjs check --cut specs/fanout-post-v4-w12.md e152 specs/e152-release-ac4-and-prose-sync.md` exits 0 (`7 ticket(s), 16 token(s), 0 out of bounds`).

## Correctness
- **F1 — resolved.** I verified the manifest independently:
  - **Format.** Each data line has the form `<relative test file path> | <exact test name>`, with `#` rationale lines grouped by ticket. This matches the existing convention (e.g. `qa_reports/expected-red_e18-write-provenance.txt`, which carries the same 6 compose-equivalence and 3 context-budget line shapes) and the header contract in `gates/expected-red.ts:1-6`. The gate only checks that the file exists (`hasExpectedRedManifest`, `gates/expected-red.ts:46-53`), and the filename matches `expectedRedManifestPath("e152-release-ac4-and-prose-sync")`.
  - **Both-way diff at HEAD.** `npm run build` was a no-op (tree stayed clean). I then ran each of the six named files under `node --test --test-reporter=tap` and collected the `not ok` names as `file | name` pairs. Result: 14 actual fails and 14 manifest entries. Manifest entries that do not fail: `[]`. Fails missing from the manifest: `[]`. Combined run: 106 tests, 92 pass, 14 fail.
  - **Inside the spec's re-pin list.** All 14 reds fall under rows of the "Pinned tests to re-pin (qa), complete list" table (spec lines 205-217): compose goldens ×6 and `context-budget` ×3 (E365), `e139` AC-E139-7, `e295` AC11 and `e308` E303-AC11a (E365), and `e351` AC-E351-2/3 (E371). No red falls outside the list.
- **O2 (optional, carried from round 1): sr's rationale holds.** Spec AC-E152-1 (spec line 31) quotes the range pipeline verbatim. `content/skill-release-engineer.md:224` reproduces it byte-for-byte, so appending `|| true` would break that spec/SOP identity. The SOP never sets `-e`/`pipefail`, and the agent reads the pipeline's output rather than its exit status, so an empty set's exit 1 just means R = false. This stays optional and is not re-raised.
- **O1:** unchanged, no action.

## Quality
No findings. The manifest's `#` rationale blocks give per-cap token deltas (+71/+71/+72) and the reason for each ticket. This matches earlier manifests. No code comments were added (SOP 4b: nothing to check).

## Architecture
No architecture spec exists for this feature. Round 2 adds only a data file, so layering is unchanged.

## Security
No findings. The manifest is plain data with no secrets and no executable content.

## Performance
No findings. Round 2 changed no code.

## Verdict
APPROVED — F1 is fixed: the manifest exists, follows the convention, and matches the 14 HEAD reds exactly in both directions. Every red is inside the spec's re-pin list, the round-1-approved text is unchanged, and the lane scope check exits 0.
