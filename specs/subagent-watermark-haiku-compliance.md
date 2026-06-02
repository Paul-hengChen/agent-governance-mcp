# Subagent Watermark Haiku Compliance (v3.21.2)

## Problem Statement

v3.21.1 added a trailing watermark reminder line to all 12 `templates/claude-code-agents/*.md` files. Empirical testing shows haiku-tier subagents (`@lite`, `@doc-writer`, `@release-engineer`) still omit the `— @<name> (<tier>)` watermark on short replies (greetings, single-line answers). The root cause is attention locality: haiku models attend strongly to top-of-context content; an instruction placed after a paragraph of SOP prose at the bottom of a short template body receives weak attention weight. Two complementary fixes close the gap while keeping templates concise: (1) reposition the reminder to the first line of every template body so it is always in the high-salience prefix position, and (2) strengthen imperative wording with a `CRITICAL:` prefix. For haiku-tier templates only, a single-line one-shot example is appended at the end to provide output-shape grounding — the minimum effective surface-area addition for the compliance gap observed in testing.

## User Stories

- As an agc operator, I want every haiku-tier subagent reply to carry the canonical `— @<name> (haiku)` watermark, so I can verify which role spoke without inspecting frontmatter, even on short greetings or one-line answers.
- As a template maintainer, I want the watermark rule to be the first instruction a subagent reads, so model attention cannot defer or skip it regardless of reply length.

## Acceptance Criteria

- **AC1** — Given any file under `templates/claude-code-agents/*.md`, when its body is read, then the FIRST non-blank line of the body (after the frontmatter `---` closing delimiter) MUST be `CRITICAL: End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).` where `<name>` is replaced verbatim with the file's frontmatter `name:` value and `<tier>` with its frontmatter `model:` value.
- **AC2** — Given the three haiku-tier templates (`lite.md`, `doc-writer.md`, `release-engineer.md`), when each file's body is read, then it MUST also contain an example reply block ending with the watermark (exact form: a blank line followed by `Example reply suffix: … — @<name> (haiku)`).
- **AC3** — Given `npm test`, when `test/subagent-templates.test.mjs` runs, then tests assert AC1 for every template and AC2 for the three haiku templates; the test suite fails if any template is missing either condition.
- **AC4** — Given the existing AC1–AC6 tests in `test/subagent-templates.test.mjs` (from v3.21.1), when the new lines are present, then all prior tests still pass (no frontmatter mutation, no body delegation contract break).
- **AC5** — Given `package.json` and `index.ts`, when this feature ships, then both versions read `3.21.2` (patch bump — template-only).
- **AC6** — Given `@lite hi` is dispatched to a haiku subagent, when the reply is observed by QA, then the reply's last line matches `— @lite (haiku)`. QA MUST invoke `@lite` at least 3 times with short prompts and record the watermark presence/absence for each invocation as evidence.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| watermark.reminder.critical | `CRITICAL: End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).` | authored-here — repositions and strengthens v3.21.1 `watermark.reminder` string; `CRITICAL:` prefix raises salience for haiku top-of-context attention |
| watermark.example.lite | `Example reply suffix: … — @lite (haiku)` | authored-here — one-shot output-shape grounding for haiku compliance; placed at body end so it does not displace the top-of-context CRITICAL line |
| watermark.example.doc-writer | `Example reply suffix: … — @doc-writer (haiku)` | authored-here — same rationale as `watermark.example.lite` |
| watermark.example.release-engineer | `Example reply suffix: … — @release-engineer (haiku)` | authored-here — same rationale as `watermark.example.lite` |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Sonnet-tier and opus-tier templates: no compliance gap observed. The CRITICAL: repositioning applies to all 12 templates for consistency, but the example-reply addition is haiku-only.
- Changes to `content/skill-*.md`, `content/constitution.md`, or the MCP server source.
- Re-installation of `~/.claude/agents/*.md` into user home — user-managed per README `cp` snippet.
- Mechanistic proof of haiku attention locality — out of scope for a template-only patch. The fix is empirically validated by AC6.
- Fixing non-haiku watermark omissions (none observed).

## Dependencies / Prerequisites

- v3.21.1 must be the released baseline (confirmed: PASS T430–T432, `package.json` + `index.ts` at `3.21.1`).
- No external references found in requirements. Resource Audit Gate: no `http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, or `JIRA` references in this spec.
- QA for AC6 requires a live Claude Code session with haiku subagent dispatch (`@lite` available). QA engineer must have `~/.claude/agents/` updated from the patched templates before running.
