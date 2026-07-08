# Review — a13-section1-polish

covers: A13-01, A13-02, A13-03, A13-04, A13-05, A13-06

Round 1 — APPROVED — by code-reviewer

## Summary
- Content-only §1 polish: `content/const-01-core-head.md` Terse bullet unified into a single output-length policy; Watermark bullet rewritten as a two-row markdown decision table with `fable` added to the tier enum (C5 fold-in).
- 8 skill files (`pm`, `code-reviewer`, `architect`, `qa-engineer`, `design-auditor`, `doc-writer`, `researcher`, `release-engineer`) had their per-skill word-cap sentence stripped from `## Output rule`; every `Final reply:`/`Details go in files.` line and every `## Output rule` heading retained.
- Minimal complete passing examples added to `skill-pm` Spec Schema, `skill-code-reviewer` Review Report Schema, `skill-architect` Artifact Schema.
- 11 golden fixtures regenerated (8 `build-*.txt`, 2 `hook-*.txt`, `constitution-monolith.txt`); `skill-qa-visual.md` untouched (AC6).
- Verdict: APPROVED.

## Correctness
No findings.
- AC1 (`content/const-01-core-head.md` Terse bullet): states the output policy exactly once ("this is the ONLY output-length policy; it is stated here exactly once"), marks structured artifacts exempt/rendered in full, and states skills define no own word cap (only a canonical final-reply string). Both test-pinned literals survive verbatim: `assumption gap` and `acceptance criteria`. Verified green: `test/constitution-deliverable-guard.test.mjs` passes in the full run.
- AC2 (Watermark bullet): two-row table — row 1 Task-spawned+`model:` pinned → `— @<role> (<tier>)`; row 2 otherwise → `— @<role>` (no tier). Tier enum reads `opus` / `sonnet` / `haiku` / `fable`. No other §1 bullet changed (Tool-First, MVP strict untouched).
- AC3a/4a/5a/6/7 (word-cap removal): each `Chat output ≤ 1 sentence.` / `Chat output MUST be exactly 1 sentence.` removed; each `Final reply:` line (and qa's `Details go in files.`) preserved byte-for-byte.
- AC3b/4b/5b (schema examples): pm example carries a populated `authored-here` Copy row + `N/A` Visual Tokens + `N/A` Visual Widgets rows and legitimately omits Visual Structural Assertions (no-design note in Dependencies); code-reviewer example has all seven H2 sections with `APPROVED` verdict; architect example covers all six always-required H2s with the correct "Sequence Diagram and Visual Harness omitted (≤ 2 actors; no design/<feature>.md)" note.
- AC8 (A13-06): all 11 fixtures regenerated and reflect the new §1 text. `constitution-monolith.txt` correctly retains `<!-- rationale:* -->` tags (fullDetail path) while `build-*.txt` are rationale-stripped — consistent with the compose pipeline. `test/compose-equivalence.test.mjs` 14/14 green.

## Quality
No findings. New prose matches surrounding constitution/skill conventions; the `### Example — minimal complete passing …` H3 nesting under each schema H2 mirrors the pre-existing `skill-qa-visual.md` precedent. No dead text, no duplicated policy left behind in the skill files.

## Architecture
No architecture spec exists (content-only ticket; architect correctly skipped per spec Decision, matching the `c3-covering-evidence` / `c13-release-engineer-write-path` bar). Layering unchanged — no data model, no schema_version bump, no new `tw_*` tool. The single-source-of-truth move (word cap lives only in §1) improves the governance-text layering.

## Security
No findings. No executable code changed; no input crosses a trust boundary; no secrets introduced. Governance-prose and fixture edits only.

## Performance
No findings. No runtime/hot-path code touched. Net token growth on the lean/design-arm bundles is expected and is deferred to the qa-owned cap bump (A13-07); no algorithmic change.

## Test-ownership check
No `test/**/*.test.mjs` logic file was modified (verified via `git diff --name-only`). Only `test/fixtures/compose-golden/*.txt` changed — sr-engineer-owned regeneration per AC8, not test-assertion edits. `test/context-budget.test.mjs` correctly left untouched (AC9 is qa-engineer scope).

## Build & Test state
- `npm run build`: clean (tsc, version check OK at 3.49.0).
- `npm test`: 933/938. The 5 failures are exactly the qa-owned context-budget caps flagged for A13-07 (lean 3087/3030, skill-pm 3196/2918, design-arm const 5316/5260, teamwork bundle 9106/9050, non-design const 3232/3175). Per spec AC9 these are the expected hand-off signal to qa — sr-engineer correctly did not edit the test file. Not a review blocker.

## Verdict
APPROVED — A13-01..A13-06 match all governing ACs (1–8) with zero findings; the only red tests are the pre-declared qa-owned cap bumps (A13-07/AC9), which are out of sr-engineer's scope by design.
