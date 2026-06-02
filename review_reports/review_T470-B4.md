# Review — T470-B4 (v3.23.1 incremental: B4 Node version pin + overall release consistency)

Scope: the **B4 increment** of the v3.23.1 payload only. The drift.ts core (B3 / T470)
was APPROVED in `review_reports/review_T470.md` Round 1 and is re-confirmed unchanged
here, not re-reviewed. Reviewer: code-reviewer (opus) — clean-context, working-tree diff.

## Round 1 — APPROVED — by code-reviewer

## Summary

- **B4 — `.nvmrc`**: new file, bytes `32 32 0a` = `22\n`. Correct content, single trailing newline.
- **B4 — `package.json` `engines`**: `"engines": { "node": ">=20" }` added; lower-bound-only (Option Y). Valid JSON, version still `3.23.1`. Placed conventionally between `license` and `dependencies`.
- **CHANGELOG [3.23.1]**: documents both B3 (drift archived-task exclusion) and B4 (.nvmrc + engines), with the Option Y rationale stated explicitly and correctly.
- **test/subagent-templates.test.mjs**: version pin `3.23.0 → 3.23.1` in all 4 places (test name, comment block, two asserts). No other change.
- **drift.ts (B3/T470)**: working-tree diff is byte-identical to the logic APPROVED in `review_T470.md` — `isArchivedSection` helper + `usesActiveCompletedConvention` gate + `activeScopeTasks` filter. dist/tools/drift.js compiled output matches source. No additional change since approval.
- **docs/backlog.md**: new; B1–B4 records are reasonable. One non-blocking inconsistency flagged in Quality.
- Version triple consistent at `3.23.1` (`package.json`, `index.ts` Server literal, `dist/index.js`).
- Headline verdict: **APPROVED**.

## Correctness

- `.nvmrc` = `22\n` (verified via hexdump `3232 0a`). `nvm use` / `fnm use` will select Node 22, matching the running env (`node -v` = v22.22.3) and the CI matrix lower-target intent.
- `package.json` parses as valid JSON (`node -e require` succeeds); `version` = `3.23.1`; `engines.node` = `">=20"`. No syntactic or structural issue.
- `index.ts:200` Server literal = `3.23.1`; `dist/index.js` compiled literal = `3.23.1`. All three version sites agree — `scripts/check-version.mjs` invariant holds.
- `test/subagent-templates.test.mjs` AC8 test correctly updated: test name, comment, and both asserts now expect `3.23.1`; the index.ts regex `/version: "3\.23\.1"/` matches the shipped literal. No stale `3.23.0` reference remains in the test.
- drift.ts (B3): re-verified the working-tree diff matches the previously-approved implementation exactly (helper, gate, filter, `partitionTasks(activeScopeTasks)`). The dist diff shows the same compiled output. No drift-logic change to re-validate — the 9 ACs from Round 1 of `review_T470.md` stand.

## Quality

- **Non-blocking finding — backlog/shipped divergence.** `docs/backlog.md` B4 "Fix:" line still recommends `"engines": { "node": ">=20 <23" }` (the upper-bound proposal), but the shipped `package.json` uses `">=20"` (Option Y, no upper bound — the deliberate pm decision). The backlog row carries no note that Option Y was selected or why. This is stale proposal-stage text, not a defect in shipped behaviour: the authoritative record (CHANGELOG [3.23.1]) documents Option Y completely and correctly. Backlog rows are explicitly framed as "candidate for a future feature" proposals, not decision records, so the divergence is tolerable. **Recommendation (follow-up, not a blocker):** update the B4 "Fix:" line to reflect the shipped `">=20"` + a one-line Option-Y rationale, or mark B4 `Status: done (v3.23.1, Option Y)`. Filed as a nit, not a release gate.
- `.nvmrc` content is minimal and idiomatic (bare major version + newline) — matches common `nvm`/`fnm`/`asdf` expectations.
- CHANGELOG entry quality is high: the Option Y rationale (npx consumers rebuild better-sqlite3 from source → no ABI break on Node 23+ → upper bound would only emit spurious engine warnings; dev consistency handled by .nvmrc + CI matrix) is accurate and well-stated.
- Test edit is surgical — only the version literals changed; comment was updated to describe the actual 3.23.1 feature (drift exclusion) rather than left stale.

## Architecture

- B4 is pure environment/metadata configuration; no code-path or layering impact. `.nvmrc` + `engines` are advisory dev/CI gates, fully decoupled from the MCP server runtime. No `specs/<feature>-architecture.md` for B4 (it is a backlog item, not a spec'd feature); the task framing's Option Y decision is the design constraint and is honored.
- **Design judgment on `engines: ">=20"` (no upper bound) — CONFIRMED CORRECT.** For an npx-distributed MCP server whose only native dependency (`better-sqlite3`) is compiled from source against the *consumer's* local Node ABI at install time, there is no prebuilt-binary ABI mismatch on newer Node. An upper bound (`<23`) would produce `EBADENGINE` warnings (or hard failures under `engine-strict`) for consumers on Node 23+ with zero safety benefit. Dev/CI determinism — the legitimate concern that motivated B4 — is correctly addressed by `.nvmrc` (pins the dev shell) plus the CI matrix `[20, 22]` (gates merges), not by an artificial consumer-facing ceiling. Lower-bound-only is the right call. The reviewer's incoming reasoning is endorsed.

## Security

- No security surface. `.nvmrc` and `engines` are static metadata; no external input, no execution, no secrets. Secret scan over all tracked text changes (`api_key|secret|token=|password|PRIVATE|AKIA…`) returned clean. No unexpected or binary files in the untracked set — all are expected artifacts (specs, tests, qa/review reports, backlog, research note, .nvmrc).

## Performance

- B4 has no runtime performance dimension (build/install-time metadata only). drift.ts performance characteristics are unchanged from Round 1 of `review_T470.md`, where the active-scope filter was assessed as a net reduction in downstream work (strict improvement on archive-heavy repos). No regression.

## Verdict

**APPROVED** — B4 (`.nvmrc` = `22\n`, `engines: ">=20"` Option Y) is correct, valid, and well-documented; version triple consistent at 3.23.1; test pin updated cleanly; drift.ts unchanged from the prior approval. The `engines` lower-bound-only design is confirmed correct for an npx-distributed, source-rebuilt-native-dep server. One non-blocking nit: backlog B4 "Fix:" text still cites the rejected `<23` upper bound — recommend updating to match the shipped decision in a follow-up, does not gate this release.
