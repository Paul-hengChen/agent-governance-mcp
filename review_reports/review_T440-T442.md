# Code Review — T440 / T441 / T442

**Feature**: `subagent-watermark-haiku-compliance` (v3.21.2 candidate)
**Spec**: `specs/subagent-watermark-haiku-compliance.md`
**Reviewer**: code-reviewer (opus)
**Round**: 1

## Summary

- T440: All 12 `templates/claude-code-agents/*.md` now place the watermark reminder — prefixed `CRITICAL:` — as the first non-blank body line after frontmatter, with `<name>` and `<tier>` substituted verbatim from each file's own `name:` / `model:` frontmatter.
- T441: The 3 haiku-tier templates (`lite.md`, `doc-writer.md`, `release-engineer.md`) additionally end with a one-shot example line `Example reply suffix: … — @<name> (haiku)` preceded by a blank line.
- T442 (sr-engineer scope only): `package.json` and `index.ts` Server() literal bumped 3.21.1 → 3.21.2; `CHANGELOG.md` gains a [3.21.2] section above [3.21.1]; `dist/index.js` rebuilt to reflect the version literal. The v3.21.1 version-pin test is intentionally NOT updated here — owned by qa-engineer per sr-engineer abstention.
- Headline verdict: APPROVED. The diff is minimal, scoped, and matches the spec's Copy/Strings table verbatim. Prior v3.21.1 test invariants (substring assertion + delegation contract + frontmatter integrity) continue to hold.

## Correctness

- **Spec AC1 verified per file** — `templates/claude-code-agents/{architect,code-reviewer,design-auditor,doc-writer,lite,pm,qa-engineer,qa-visual,release-engineer,researcher,sr-engineer,teamwork}.md` line 7 in each file is `CRITICAL: End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).` with the correct frontmatter-derived `<name>` and `<tier>` (e.g. `lite.md:7` → `@lite (haiku)`; `teamwork.md:7` → `@teamwork (sonnet)`; `pm.md:7` → `@pm (sonnet)`). No substitution errors observed.
- **Spec AC2 verified per file** — `lite.md:11`, `doc-writer.md:11`, `release-engineer.md:11` each end the body with `Example reply suffix: … — @<name> (haiku)` preceded by a blank line, exactly matching the Copy/Strings table values (`watermark.example.lite/doc-writer/release-engineer`). The blank line at line 10 satisfies "a blank line followed by" per AC2.
- **Spec AC5 verified** — `package.json:3` reads `"version": "3.21.2"`; `index.ts:200` reads `name: "agent-governance-mcp", version: "3.21.2"`; `dist/index.js:153` reflects the same — keeps `npx -y github:...` consumers honest.
- **Spec AC4 (no regression) traced through `test/subagent-templates.test.mjs`**:
  - v3.21.1 AC1 substring assertion (`test/subagent-templates.test.mjs:248-263`) uses `raw.includes(expected)` where `expected = "End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark)."`. The new `CRITICAL:` prefix line still contains this substring verbatim → assertion will still pass.
  - v3.21.1 AC3 frontmatter integrity (`test/subagent-templates.test.mjs:265-281`) requires `>= 2 non-empty body lines` and intact `---` fences. Post-change body has 2 non-empty lines (10 templates) or 3 (3 haiku templates), fences intact → assertion still passes.
  - AC1 body-delegation contract (`test/subagent-templates.test.mjs:106-134`) requires every body to mention `tw_get_state` and either `tw_switch_role("<role>")` or the file-path-delegate regex. The delegation line is preserved (just moved to second position) in all 12 templates → assertion still passes.
  - Tier-consistency (`test/subagent-templates.test.mjs:146-162`) reads only frontmatter `model:` — untouched.
  - The expected single failure (`test/subagent-templates.test.mjs:287-296`) pins `3.21.1` and will fail until qa-engineer rewrites it for `3.21.2` plus adds AC1/AC2 tests — consistent with sr-engineer's stated abstention.
- No off-by-one, race, or edge case applicable: the change is pure static text reordering + version literals.

## Quality

- Reordering preserved the exact pre-existing delegation sentences (no rewording slipped in) — verifiable by diff: only the CRITICAL line was inserted at top and the original "End every reply with…" line was removed/replaced. Clean minimal change.
- Haiku templates' trailing example line uses ` … ` (U+2026 horizontal ellipsis) consistently with the spec Copy/Strings table — not three ASCII dots. Confirmed in `lite.md:11`, `doc-writer.md:11`, `release-engineer.md:11`.
- All 12 templates end with a trailing newline (Read tool shows line 12 in haiku files / line 9 in non-haiku files as blank-after-content). Convention with the rest of the repo holds.
- CHANGELOG entry (`CHANGELOG.md:19-46`) sits correctly between `[Unreleased]` (line 17) and `[3.21.1]` (line 47); follows the same Keep-a-Changelog formatting as adjacent releases (`### Changed`, `### Notes` headings).
- One observation, out of scope for T440-T442 but worth flagging: `README.md` still references `v3.21.1` in three places (lines 7, 28, 171) — these are stale for the 3.21.2 release. sr-engineer correctly left them: README is doc-writer/release-engineer scope per the spec's Out-of-Scope section ("Re-installation of `~/.claude/agents/*.md` … user-managed"). This will be picked up at release packaging; not blocking review.

## Architecture

- Spec §"Problem Statement" defines the architectural intent: (1) move the reminder into the high-salience top-of-context prefix position, and (2) for haiku only, add a one-shot output-shape example at the end. The diff implements exactly this — no deviation, no over-reach. The spec is its own architecture document (template-only patch); no separate `specs/<feature>-architecture.md` exists, which is consistent with the spec's Out-of-Scope item ("Mechanistic proof of haiku attention locality — out of scope for a template-only patch").
- Single-source-of-truth principle preserved: SOPs still live in `content/skill-*.md`; templates remain thin delegators (`tw_switch_role` or documented file-path delegation for `lite`/`teamwork`). The CRITICAL line is a reminder, not a duplicated SOP.
- No server-side, schema, or transition-matrix changes — appropriate for a patch release (correct semver per spec AC5).
- `dist/index.js` rebuilt — required because `dist/` is shipped for `npx github:...` consumers per `CLAUDE.md` §"Dev workflow".

## Security

- No new external inputs, no parsing of untrusted data, no shell-out, no network call. Template text only.
- No hardcoded secrets, tokens, or PII introduced. Confirmed by reading the full diff for all 12 templates.
- No injection vector: templates are consumed by Claude Code's subagent loader (static `~/.claude/agents/*.md` install), not interpreted as code.
- npm audit `--omit=dev --audit-level=high` reported 0 vulnerabilities per sr-engineer's pending_notes — not re-run here since no `package.json` dependency change occurred (only `version` field bumped).

## Performance

- No hot-path code, no I/O, no loops touched. Template files unchanged in line count by more than +1 (non-haiku) or +3 (haiku) bytes per file. No conceivable performance regression.
- Subagent context cost increases by ~80-120 bytes per dispatched subagent (one extra line plus the optional haiku example). Negligible against the constitution + skill payload size (~10-30 KB). Not a regression.

## Verdict

**APPROVED** — The diff matches the spec's AC1/AC2/AC5 verbatim across all 12 templates and the three version artifacts; pre-existing v3.21.1 tests still pass because the substring + structural invariants they assert are preserved; security, architecture, and performance posture are unchanged. Hand off to qa-engineer for the AC3/AC4/AC6 test updates and the live `@lite` smoke evidence.
