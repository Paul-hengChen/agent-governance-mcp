# Subagent Watermark Parent-Validation (v3.22.0)

## Problem Statement

Template-side hardening shipped in v3.21.2 (`CRITICAL:` top-line + example reply suffix in every `templates/claude-code-agents/*.md`) achieved 3/3 @lite watermark compliance in QA's controlled dispatch. However, a subsequent live `@lite hi` invocation in the main session dropped the watermark again. The root cause is that no instruction placed in a subagent template can deterministically force a haiku-tier model to append a trailing string on every reply under every prompt length. The fix must move up one layer: the **parent that dispatches the subagent** — whether the full coordinator (`/teamwork`) or coordinator-lite (`/teamwork-lite`) — must inspect the subagent's reply text and, when the watermark is absent, append the canonical watermark string to its relay to the user. This closes the compliance gap at the layer that has guaranteed execution regardless of subagent attention drift.

## User Stories

- As an agc operator, I want the parent coordinator to guarantee that every subagent reply surfaced to the user carries the `— @<name> (<tier>)` watermark, so I can verify which role spoke even when haiku silently omits it.
- As a coordinator-lite user, I want watermark post-validation active even in lite mode, because `@lite hi` from a lite-mode main session is exactly the failure scenario that slipped through v3.21.2.
- As a template maintainer, I want the parent-validation behavior defined in `content/skill-coordinator.md` and `content/skill-coordinator-lite.md` so that the rule is in the consumed SOP text, not buried in a template that varies per subagent.

## Acceptance Criteria

- **AC1** — Given `content/skill-coordinator.md`, when the file is read, then it MUST contain a section titled `## Subagent Reply Watermark Validation` (exact heading) with the detection regex, correction strategy, and out-of-scope guard documented per this spec.
- **AC2** — Given `content/skill-coordinator-lite.md`, when the file is read, then it MUST contain the same `## Subagent Reply Watermark Validation` section, verbatim-equivalent in behavior (both files MUST produce identical watermark-appended output for the same inputs). The lean always-on bundle (stripped constitution + lite skill) MUST be ≤ 2100 ~tokens (raised from the original 2000-token cap set in v3.6.0 — see Decision 7 below).
- **AC3** — Given a subagent reply text `reply` dispatched from an Agent/Task call for subagent named `name` and tier `tier`, when `validateWatermark(reply, name, tier)` is called, then:
  - It returns `{ present: true, corrected: reply }` if the last non-empty line of `reply` matches the detection regex (case-insensitive, leading/trailing whitespace stripped).
  - It returns `{ present: false, corrected: reply + "\n— @" + name + " (" + tier + ")" }` otherwise, where the appended string uses U+2014 (EM DASH) followed by a space.
- **AC4** — Given a parent context where the prior tool use was NOT an Agent/Task call (e.g. coordinator's own `tw_get_state` reply, a bash tool result, an ordinary LLM turn), when the coordinator produces its next reply, then it MUST NOT append a watermark suffix — the out-of-scope guard is active for non-Task-tool output only.
- **AC5** — Given `test/watermark-check.test.mjs` (new file), when `npm test` runs, then it MUST exercise at minimum:
  - Fixture: watermark present, correct name and tier → `present: true`, `corrected` unchanged.
  - Fixture: watermark absent entirely → `present: false`, `corrected` ends with `\n— @<name> (<tier>)`.
  - Fixture: watermark present but wrong name → `present: false`, corrected appends correct watermark.
  - Fixture: watermark present with leading/trailing whitespace on last line → treated as present (whitespace-tolerant).
  - Fixture: reply is empty string → `present: false`, `corrected` is `— @<name> (<tier>)`.
- **AC6** — Given `npm test`, when all existing tests in `test/` run, then the full suite passes with no regressions (no changes to `tools/transitions.ts`, constitution, or existing template format).
- **AC7** — Given `@lite` is dispatched N=10 times via `/teamwork` with the v3.22.0 SOP active, when the parent-corrected output is observed, then all 10 user-facing replies end with `— @lite (haiku)` (10/10 compliance). QA records pass/fail per invocation as evidence. (Real haiku model may be mocked in unit tests per AC5; this AC requires live or realistic simulation.)
- **AC8** — Given `package.json` and `index.ts`, when this feature ships, then both versions read `3.22.0` (MINOR bump — new SOP behavior, no breaking changes).

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| watermark.validation.heading | `## Subagent Reply Watermark Validation` | authored-here — new SOP section added to both coordinator skill files |
| watermark.correction.suffix | `— @<name> (<tier>)` | authored-here — U+2014 EM DASH + space + `@<name>` + space + `(<tier>)`; `<name>` and `<tier>` substituted from dispatched subagent frontmatter at runtime |
| watermark.detection.regex | `/^—\s@[\w-]+\s\([\w-]+\)$/i` | authored-here — see Detection Regex section below; case-insensitive to tolerate haiku capitalisation drift; leading/trailing whitespace stripped before match |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Design Decisions (PM-authored, embedded in spec)

### Decision 1: Where to add the SOP step

Add `## Subagent Reply Watermark Validation` to **both** `content/skill-coordinator.md` and `content/skill-coordinator-lite.md`.

Rationale: The reported failure was `@lite hi` dispatched from a **main session running coordinator-lite** (the user typed the `@` mention directly). In that flow the active skill is `coordinator-lite`, not `coordinator`. If validation only lives in `skill-coordinator.md`, coordinator-lite-mode sessions remain unprotected — exactly the failure mode that prompted v3.22.0. Both files must carry the section; they share identical behavior so the maintenance cost is one duplicated paragraph, not a diverged implementation.

### Decision 2: Correction strategy

Selected strategy: **(a) Parent appends `— @<name> (<tier>)` to its own relay when the subagent's last non-empty line is missing the pattern.**

Rejected (b) re-dispatch: doubles token cost on every miss; risks infinite correction loop if the re-dispatched reply also misses the watermark.

Rejected (c) warning-only: UX is loud and noisy; the user did not ask for a debugging trace; the operator's need is a compliant watermark string in the output, not a warning.

Strategy (a) has zero retry cost — one extra string concatenation in the parent relay — and produces a clean, spec-compliant output the user sees without visible repair noise. Cost is negligible: a single string append only when `present: false`.

### Decision 3: Detection regex

```
/^—\s@[\w-]+\s\([\w-]+\)$/i
```

- The leading character MUST be U+2014 (EM DASH, `—`), not a hyphen-minus (`-`) or en-dash (`–`). Haiku templates use U+2014; an imposter hyphen is treated as absent.
- Match is performed on the **last non-empty line** of the reply (strip trailing blank lines, trim leading/trailing whitespace from that line before matching).
- Case-insensitive (`/i`) to tolerate haiku capitalisation of the tier or name token.
- `<name>` matches `[\w-]+` — alphanumeric, underscore, hyphen (covers `lite`, `qa-engineer`, `sr-engineer`, etc.).
- `<tier>` matches `[\w-]+` — covers `haiku`, `sonnet`, `opus`.
- The parent MUST check `<name>` against the dispatched subagent's actual `name` frontmatter value and `<tier>` against its actual `model` frontmatter value. A reply ending with `— @wrong-name (haiku)` is treated as absent (mismatched name → append correct watermark).

### Decision 4: Out-of-scope guard

The parent MUST only apply watermark post-validation when it is relaying the text of a reply received from an Agent/Task tool call. Specifically:

- Apply when: the parent's current reply is a summary/relay of a just-completed `Task(subagent_type=...)` tool call, and the tool result contains the subagent's reply text.
- Do NOT apply when: the parent is replying to a `tw_get_state`, `tw_detect_drift`, bash tool result, or any non-Task tool result, or when the parent is composing its own independent analysis/answer without having just received a subagent reply.

Implementation in SOP text: "After a Task tool call completes, extract the subagent reply text. Before surfacing it to the user, call validateWatermark(reply, name, tier). Use `corrected` as the text you relay. For all other tool results or your own turns, do NOT add a watermark suffix."

This guard prevents the coordinator from stamping its own thoughts with a `@lite (haiku)` suffix — which would be semantically incorrect.

### Decision 5: Test plan

A new file `lib/watermark-check.ts` exports `validateWatermark(reply: string, name: string, tier: string): { present: boolean; corrected: string }`. This is a pure function with no I/O, justified as a shared util because:
- Both coordinator and coordinator-lite reference identical behavior (Decision 1).
- The test file `test/watermark-check.test.mjs` imports from `dist/lib/watermark-check.js` (compiled output).
- QA engineer can run `npm test` without spawning real haiku models — all AC5 fixtures use hardcoded reply strings.

AC7 (live/simulated 10/10 compliance) is a QA-engineer task using either real `@lite` dispatch or a mock harness that substitutes pre-authored reply strings for haiku output. The mock approach is preferred to avoid API cost and flakiness; QA documents the approach in `qa_reports/`.

### Decision 7: AC2 budget cap raised from 2000 → 2100 tokens

**Trigger:** sr-engineer Round 2 exhausted maximum compression on the new `## Subagent Reply Watermark Validation` section in `content/skill-coordinator-lite.md` (556 → 84 tokens, -85%). The pre-v3.22 lean bundle sat at 1996/2000 (4-token headroom). After adding the minimum viable watermark section (~84 tokens), the lean bundle reached 2080 — 80 tokens over the old cap. No further compression is possible without dropping the code-reviewer-required hint elements (regex code-fence + out-of-scope guard line + cross-reference to `skill-coordinator.md`).

**Options considered:**

- **(a) Raise AC2 cap to ≥ 2100** — selected. The 2000-token cap was a soft heuristic set in v3.6.0 when the lite skill was leaner. The constitution has grown since (chain-only fence block, v3.14.x `visual_round` additions, etc.). 2100 is a +5% relaxation, still well below the full coordinator bundle (~3500+ tokens).
- **(b) Compress constitution or other lite sections** — rejected. Out of sr-engineer authority; risks breaking unrelated constitutional invariants; blast radius too large relative to the benefit.
- **(c) Move watermark rules to chain-only fence, lite gets one-line cross-ref only** — rejected. This re-introduces the exact `@lite hi` failure mode that triggered v3.22.0 (lite-mode sessions would no longer carry the AC6 guarantee). Defeats half the original motivation.

**Impact:** `test/context-budget.test.mjs` line 54 constant changes from `2000` → `2100`. One-line change; sr-engineer owns it in Round 3.

### Decision 6: Backwards compatibility

- No change to `tools/transitions.ts`, `content/constitution.md`, or any `templates/claude-code-agents/*.md` file.
- No new `tw_*` tool; `validateWatermark` is a pure TypeScript util called from coordinator SOP logic, not an MCP tool.
- The `lib/watermark-check.ts` file is a new addition; no existing file is deleted or interface-broken.
- `tw_*` tool surface: unchanged.
- ALLOWED_TRANSITIONS matrix: unchanged.
- Template format: unchanged.
- Version bump: `3.21.2` → `3.22.0` (MINOR — new observable behavior in both coordinator SOP files).

## Out of Scope

- Modifying `tools/transitions.ts`, the constitution, or `templates/claude-code-agents/*.md`.
- Re-installing `~/.claude/agents/*.md` — user-managed per README `cp` snippet; template files are already correct as of v3.21.2.
- Making `validateWatermark` an MCP-exposed tool (it is internal SOP logic, not a governance state operation).
- Handling non-Task-tool output (coordinator's own replies) — explicitly excluded by Decision 4.
- Sonnet/opus watermark compliance gaps — none observed; this feature targets haiku-tier only.
- Retry/re-dispatch on watermark miss — explicitly rejected in Decision 2.

## Dependencies / Prerequisites

- v3.21.2 must be the released baseline (confirmed: PASS T440–T442, `package.json` + `index.ts` at `3.21.2`).
- `lib/` directory may not exist yet — sr-engineer creates it.
- `tsconfig.json` must include `lib/**/*.ts` in compilation; sr-engineer verifies `include` glob covers `lib/`.
- No external references found in requirements. Resource Audit Gate: zero `http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`, `URL`, `link`, `see <ticket>`, `Azure DevOps`, or `JIRA` references in the user brief or this spec.
