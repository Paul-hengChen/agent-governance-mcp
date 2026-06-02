# Review — T460 + T461 (release-engineer-complete-staging, v3.22.1)

Reviewer: code-reviewer (opus-tier, different model than sr-engineer per SOP recommendation)
Spec: `specs/release-engineer-complete-staging.md`
Diff scope: `content/skill-release-engineer.md`, `templates/claude-code-agents/release-engineer.md`, `package.json`, `index.ts`, `CHANGELOG.md`

## Summary

- `content/skill-release-engineer.md` SOP step 7 rewritten with explicit directory enumeration, pre-commit `git diff --cached --stat` verify, and post-commit spec-file sanity check (AC1, AC2, AC4).
- Failure-modes bullet inverted: source dirs are EXPECTED, only UNRELATED paths trigger STOP (AC3).
- `templates/claude-code-agents/release-engineer.md` gains a 2-sentence reinforcement hint; watermark line and `tw_get_state` / `tw_switch_role` invocation preserved (AC5).
- Version bumped 3.22.0 → 3.22.1 in `package.json` and `index.ts`; CHANGELOG `[3.22.1] - 2026-06-02` entry added above `[3.22.0]`.
- Headline verdict: **CHANGES_REQUESTED** — one hard test regression (`test/subagent-templates.test.mjs` line 368 still pins version to `3.22.0`), violating AC7 (`npm test` MUST pass with zero regressions).

## Correctness

- `content/skill-release-engineer.md:43-48` — AC1 satisfied. Directory list matches spec verbatim ordering: `lib/ content/ templates/ specs/ test/ qa_reports/ review_reports/ tsconfig.json package.json index.ts CHANGELOG.md README.md dist/`. Haiku-readable, single line. Includes explicit anti-paraphrase warning ("Do NOT substitute abstract terms like 'touched files'").
- `content/skill-release-engineer.md:48` — AC2 satisfied. Pre-commit verify step instructs `git diff --cached --stat` and cross-references against `git status --short`. Explicitly calls out metadata-only staging as the FAIL signal — exactly the pattern that bit `a14b15f` (v3.21.2) and `f5a0b4d` (v3.22.0). The wording "Metadata-only staging (just `package.json` / `index.ts` / `CHANGELOG.md` / `README.md` / `dist/`) is a FAIL signal when source dirs have pending edits" is the right inversion of the original sin.
- `content/skill-release-engineer.md:50` — AC4 satisfied. Post-commit `git diff HEAD~1 --name-only` check with verbatim error string from spec Copy/Strings table: `"Release commit incomplete: specs/<active_feature>.md is absent from the commit. Stage missing files and amend or create a fix commit."` Concrete remediation (`backfill follow-up commit`) is named.
- `content/skill-release-engineer.md:58` — AC3 satisfied. Failure-modes bullet inverted: `lib/`, `content/`, `templates/`, `specs/`, `test/`, `qa_reports/`, `review_reports/` are EXPECTED; only UNRELATED paths trigger STOP. The new STOP string `"Pre-existing uncommitted changes found in <path> — this path is unrelated to the active feature. Commit or stash it first."` matches the spec Copy/Strings table verbatim.
- `templates/claude-code-agents/release-engineer.md:11` — AC5 satisfied. Reinforcement is exactly 2 sentences. Watermark line (`CRITICAL: End every reply with — @release-engineer (haiku)…`) on line 7 and the `tw_get_state` / `tw_switch_role` invocation on line 9 are preserved unmodified.
- **AC7 — FAIL**: `test/subagent-templates.test.mjs:368-382` ("v3.22.0 AC8: package.json + index.ts both at 3.22.0") still hard-asserts `3.22.0`. The test now fails:
  ```
  not ok 340 - v3.22.0 AC8: package.json + index.ts both at 3.22.0
  ```
  This is the version-coherence guard that the spec at line 25 explicitly calls out: *"`templates/release-engineer.md` changes trigger `test/subagent-templates.test.mjs` assertions"*. The sr-engineer's `pending_notes` claimed "npm run build: ZERO errors; check-version OK at 3.22.1; npm audit: 0 vulnerabilities" but did not run or did not surface `npm test`. AC7 is unambiguous: zero test regressions.
  - Fix: update the assertion in that test to `3.22.1` (and either rename the test label to `v3.22.1 AC8` or generalize it). Spec AC8 mandates `3.22.1` and the test must reflect that.
- AC8 satisfied: `package.json` and `index.ts` both at `3.22.1`. CHANGELOG `[3.22.1] - 2026-06-02` entry present and ordered correctly above `[3.22.0]`.

## Quality

- `content/skill-release-engineer.md:43-50` — Step 7 is well-structured: stage → verify → commit → post-commit-check → tag → push. The inline `AC2` / `AC4` parenthetical tags are unusual for an SOP file (typical SOPs do not reference the originating spec's AC numbers in prose) but harmless and arguably useful for future maintainers. Minor style nit only; not blocking.
- `content/skill-release-engineer.md:58` — The "Expected vs unrelated uncommitted changes" bullet runs long (single bullet ~6 lines). Readable for opus, marginal for haiku at the bottom of a long SOP. Could be split into two bullets ("Expected:" and "Unrelated → STOP:") for clearer scanning. Non-blocking nit.
- `templates/claude-code-agents/release-engineer.md:11` — Sentence 1 is borderline long (38 words). Still parses cleanly; within the ≤2 sentence cap. OK.
- CHANGELOG `[3.22.1]` entry is thorough and accurate — describes the SOP rewrite, the wording inversion, the template reinforcement, and explicitly notes it is a pure prompt/SOP fix with no code or schema changes.

## Architecture

- Pure prompt/SOP edit. No changes to `tools/transitions.ts`, `schema/`, `guards/`, `lib/`, or any tw_* tool. Spec Decision 6 (backwards compat) honored.
- Lite-bundle budget check (per reviewer's sanity prompt): `test/context-budget.test.mjs:51-69` measures `constitution + skill-coordinator-lite.md`. Neither `skill-release-engineer.md` nor `templates/claude-code-agents/release-engineer.md` is in the lite bundle, so the 2100-token ceiling is unaffected. Confirmed safe.
- `ALLOWED_TRANSITIONS` matrix untouched. release-engineer remains out-of-chain (uses upstream caller's `agent_id` per Hard rules line 18). Consistent with v3.20+ side-channel pattern.

## Security

- No new code paths, no injection vectors, no secret-handling changes.
- Failure-modes wording explicitly lists `.env*` and "secrets" as UNRELATED-path examples that DO trigger STOP — net positive for security posture (the prior whitelist wording was ambiguous about secret files).

## Performance

- N/A. SOP text edit only. No hot paths, no I/O changes, no algorithmic regressions.

## Verdict

**CHANGES_REQUESTED** — AC1, AC2, AC3, AC4, AC5, AC8 are all satisfied with high fidelity to the spec; however AC7 (`npm test` zero regressions) FAILS because `test/subagent-templates.test.mjs:368-382` still pins `3.22.0`. sr-engineer must either update that assertion to `3.22.1` or generalize it. The fix is mechanical (≤3 lines of test diff) but it is mandatory before qa-engineer can advance T462/T463.
