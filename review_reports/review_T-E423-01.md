# Review — T-E423-01

covers: T-E423-01, T-E423-02, T-E423-03, T-E423-04, T-E423-05

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Base `0efc203`, head `98608ae` (`git diff 0efc203...HEAD`). Judged against `specs/e423-spec-workshop.md` (D1–D12, AC1–AC23, Copy / Strings, Implementation notes) and the e423 row of `specs/fanout-v5-w2.md`. No architecture spec (D2: architect hop not needed). Reviewer model: opus, the same tier as the sr hop (dispatch pins), so the two hops may share blind spots.

## Summary
- T-E423-01: `gates/visual.ts` adds `prototype` to `KNOWN_MODES`. `parseDesignMode` now returns the first unrecognised declared token, cut to 40 characters plus `…`, when no candidate yields a known mode (D3/D4).
- T-E423-02/03: new prompt-only `content/skill-spec-workshop.md` (40 lines) plus `prompts/spec-workshop.ts`, and one tail `PROMPT_REGISTRY` entry. The role has no `tw_switch_role` role and no subagent template.
- T-E423-04: prompt and role counts go from 12 to 13 in `CLAUDE.md` (still 250 lines), `README.md`, `docs/install.md`, `docs/architecture.md` (D12 (a)) and `CONTRIBUTING.md`, all within the allotted line ranges.
- T-E423-05: three additions. coord-01 gets prototype-export detection and the hint. design-auditor gets the `prototype` mode, the dual-source rule and an escalation row. integrator Stage 2 gets the wave-table exception.
- Verdict: CHANGES_REQUESTED. One `required` finding: the shipped design-auditor step 2b text contradicts approved decision D5 for dual-source designs.

## AC Completeness
AC1 — implemented — `tools/registry.ts:1190-1195`. Tail entry after `integrator`, with `PROMPT_WORKSPACE_ARG` and `skillFile: "skill-spec-workshop.md"`. Description equals `prompt.description` byte-for-byte.
AC2 — implemented — served through the generic `index.ts:159` `buildPromptForRole(entry.skillFile, …)` path. qa owns the stdio proof.
AC3 — implemented — `tools/role.ts` and `tools/transitions.ts` do not mention `spec-workshop`, and the `tw_switch_role` enum is unchanged.
AC4 — implemented — `prompts/spec-workshop.ts:6-12` copies the `prompts/integrator.ts` pattern. No `templates/claude-code-agents/spec-workshop.md` exists.
AC5 — implemented — `content/skill-spec-workshop.md:1-3` (`recommended_model: opus`). `content/skill-*.md` count is 13.
AC6 — implemented — all seven step anchors (`sop.step1`…`sop.step6`, `sop.short-form`) are present in the composed `buildSpecWorkshopPrompt` output (checked by running it).
AC7 — implemented — `content/skill-spec-workshop.md:38` carries `sop.no-handoff` verbatim; the tool names appear nowhere else. `sop.no-subagent` is on line 40.
AC8 — implemented — `content/skill-spec-workshop.md:12-17`: three entry cases, several item numbers, named-only, split or merge, small work routed to intake.
AC9 — implemented — `content/skill-spec-workshop.md:26` (step 4: rulings dated as made, and a replacing ruling names the ruling it replaces), lines 30-35 (`## Rulings` table, ticket format with the `<agc install>` prefix, `source` shape and the public-repo rule, wave table, approval table, commit) and line 28 (`sop.short-no-wave`).
AC10 — implemented — `content/skill-spec-workshop.md:23-24` (`sop.done`, `needs device or person: yes`, Figma/prototype divergence counted as a conflict; `not doing` / `not ready to cut` with open questions).
AC11 — implemented — the added text has no `E\d{3}` id and no unprefixed repo-only path. `docs/tickets/`, `docs/discussions/` and `.current/.config.json` are workspace paths. The ticket format is cited with the `<agc install>` prefix and its inline definition.
AC12 — implemented — `content/skill-integrator.md:98`, with the `integ.exception` and `integ.halt` anchors and both Decisions rows. Every pre-existing Stage 2 sentence survives as a byte-identical substring. D8 placement deviates; see Quality.
AC13 — implemented — `content/coord-01-core-head.md:72` (`coord.match-prototype`) and line 76 (`coord.hint` verbatim, no-ticket-file stop, ticket-file routing to design-auditor, `coord.ticket-file`). The existing bullets and the "If ≥ 1 hit" paragraph are unchanged.
AC14 — implemented (anchors) — `content/skill-design-auditor.md:22,45,48,49,55,73,105`. The existing "skip this gate" sentences in 2a and 2b are unchanged. The content conflicts with D5; see Correctness R1.
AC15 — implemented — probe: `mode: prototype` (inline, bullet and H2 forms) gives `prototype`, `required` true and credibility `ok` true with a `component-variant` audited row.
AC16 — implemented — probe: `mockup` / `code` / `freehand` are returned with `required` true and `ok` true. A 100 000-character token returns 40 chars + `…` without throwing.
AC17 — implemented (by construction) — `tools/handoff-orchestrator.ts:853` already prints `mode=${armCheck.mode}`. qa owns the end-to-end proof.
AC18 — implemented — probe: `## Mode\n\nfigma` + `- mode: dark` gives `figma`. `mode: <figma> (see board)` gives `figma`. `mode: —`, no Mode line and no file give `null` / `required` false.
AC19 — implemented — `wc -l CLAUDE.md` = 250. Lines 7, 10, 33, 38, 41, 42, 122, 130 match `claude.*`. `e436` and `e395` are green. The `e178a` AC5 red is expected (qa re-pin).
AC20 — implemented — `README.md:93,102-103`, `docs/install.md:294,308`, `docs/architecture.md:18,20-21` (every box line is 66 bytes, the same as its neighbours) and `CONTRIBUTING.md:138`. No stale count strings remain.
AC21 — qa-owned (T-E423-07); out of this review's scope.
AC22 — qa-owned (T-E423-07); out of this review's scope.
AC23 — partial (qa-owned remainder) — `dist/` changes only `dist/gates/visual.*`, `dist/prompts/spec-workshop.*` and `dist/tools/registry.*`. `npm run build` on HEAD leaves the tree clean, so `dist/` is reproducible. Running the full suite is qa's job.

## Correctness
- **R1 `required`** — `content/skill-design-auditor.md:55`, the appended sentence `` `prototype` skips this gate: every prototype page is a full screen. `` This contradicts approved decision D5, which says "The design-auditor still runs its step-2b classification on the Figma rows (SOP), but the server's credibility check … stays dormant for `prototype`". The `da.dual` rule (line 48) requires a Figma + prototype design to declare mode `prototype`. Step 2b keys on the declared mode: it opens with "fetch-based modes only (`figma`/`sketch`/`xd`/`penpot`)", and the new sentence says `prototype` skips it. So under the shipped text, an auditor working on a dual-source design skips the node-type classification for the Figma rows. That classification is the guardrail against transcribing from component variants or overview pages, and with the server check also dormant for `prototype`, nothing catches the mistake. Fix: on the same line, after the anchor sentence, add a sentence such as `` In a dual-source design (`prototype` + Figma), the Figma rows still run this gate. `` Putting it on the same line keeps the `da.credibility` anchor and the file's line count. Do not change the anchor text. The design-auditor SOP has no context-budget cap and no compose golden, so nothing else moves.
- `gates/visual.ts:139-166` — D3 logic is correct. A known mode on any candidate still wins. The first unknown token is remembered and returned only after every candidate fails. The no-token scan is unchanged. Truncation uses `slice(0, 40)` + U+2026. The token is constrained to `[a-z][a-z0-9-]*` and the regex has no ambiguous repetition, so a 100 000-character value parses in linear time. `hasDesignModeRequiringVisual`, `FETCH_BASED_MODES` and `checkSourceCredibility` are untouched (`gates/visual.ts:829,860`), so E384 protection holds: an unknown or `prototype` mode never arms the Figma-only check.
- Expected-red sampling (step 4a): read `qa_reports/expected-red_e423-spec-workshop.txt`. Sampled 5 entries by grepping each test file for its test string, and all 5 exist: e178a AC3 (`:163`), e384 "never scanned past" (`:97`), visual-evidence-gate E319 AC-E319-5 (`:673`), skill-manifest t-golden-byte-identity (`:101`), skill-frontmatter (`:97`). I ran 24 targeted files: 623 tests, 10 failing. Every failure is a manifest entry (e178a AC3/AC5, e384 ×6, skill-frontmatter, AC-E319-5). `check-md-tables`, `e410`, `e288`, `e296`, `e436`, `e395`, `e437`, `e438`, `e440`, the design-source-detection tests and the source-credibility, volume-guard and visual gate tests are green.

## Quality
- `optional` — D8 placement deviation (`content/skill-integrator.md:98`). The exception is appended to the end of the existing Stage 2 paragraph line instead of forming a new paragraph. On the merits this is acceptable. Every existing sentence stays a byte-identical substring, as D8 requires, and both anchors are present. A separate paragraph would have shifted line numbers that `test/e410-task-alias-content-tail.test.mjs` pins, and that test is not in e423's allocated test surface. The cost is readability: Stage 2 is now one very long line. Split it into its own paragraph the next time the e410 pins are re-cut.
- The two design-auditor additions on lines 49 and 55 are likewise appended to existing lines. That is allowed by the implementation notes ("add new sentences"), and every existing sentence is unchanged.
- New comments in `gates/visual.ts:106-116,147` are accurate and describe the current behaviour. `prompts/spec-workshop.ts` follows the `prompts/integrator.ts` header convention. No `agc check — comments` concern.

## Architecture
No architecture spec (D2). Layering is unchanged. The prompt is registered through `PROMPT_REGISTRY` only and served through the generic `index.ts` loop. There is no new error code and no change to the orchestrator, gate registry or `FETCH_BASED_MODES`. The edits stay inside the lane's owned ranges: one tail entry in `tools/registry.ts`; in `gates/visual.ts`, only `KNOWN_MODES`, `parseDesignMode` and its comment; `CLAUDE.md` lines 7–42 and 122–130 at 250 lines; `README.md` 93/102–103; `docs/install.md` 294/308; `docs/architecture.md` 18/20–21 under D12 (a); `CONTRIBUTING.md` 138. Strict typing holds: no `any`, and `firstUnknown: string | null`.

## Security
No findings. The unknown-mode value that reaches the rejection text matches `[a-z][a-z0-9-]*` and is at most 41 characters, so it cannot inject markup or control characters. No secrets. Shipped `content/**` text has no repo-only paths, ticket ids or names (Constitution §6 hygiene).

## Performance
No findings. `parseDesignMode` adds one variable and one string slice. Its two capped regex candidates and linear token match are unchanged from base. No hot-path change.

## Verdict
CHANGES_REQUESTED. R1: the shipped step 2b text makes a dual-source (`prototype` + Figma) design skip the Figma-row classification that approved decision D5 keeps, and the fix is one added sentence on line 55 of the design-auditor SOP.

## Round 2 — APPROVED — by code-reviewer

Base `0efc203`, head `d3d24d2`. This round covers the fix for R1 and checks the whole feature diff for regressions since round 1 (`git diff 98608ae HEAD`). Reviewer model: opus, the same tier as the sr hop. The same-model caveat from round 1 still applies.

## Summary
- d3d24d2 changes one line in shipped content: `content/skill-design-auditor.md:55`. It also carries `.current/e423/handoff.md` and `dispatch.jsonl` (lane state). Since round 1's head (`98608ae`), the only other change is this report.
- Step 2b now ends with: `` `prototype` skips this gate: every prototype page is a full screen. In a dual-source design (`prototype` + Figma), the Figma rows still run this gate. ``
- R1 is resolved and the result matches D5. No new findings.
- Verdict: APPROVED.

## AC Completeness
AC1–AC13 and AC15–AC20: unchanged since round 1 (`git diff 98608ae HEAD` does not touch their files) and still implemented as cited in Round 1.
AC14 — implemented — `content/skill-design-auditor.md:55`. The `da.credibility` anchor matches spec line 229 byte-for-byte (`grep -c` = 1), and the new sentence brings the anchor in line with D5. The sentence `` `image`/`pdf`/`paper`/`no-design` modes skip this gate `` is unchanged in 2a and 2b. `wc -l` = 110, the same as round 1.
AC21, AC22 — qa-owned (T-E423-07); out of this review's scope.
AC23 — partial (qa-owned remainder) — the fix changes content only, so `dist/` is untouched. Running the full suite is qa's job.

## Correctness
- R1 — resolved. D5 says the design-auditor "still runs its step-2b classification on the Figma rows (SOP), but the server's credibility check keys on the declared mode and stays dormant for `prototype`". The added sentence covers the SOP half of that. The server half is unchanged: `FETCH_BASED_MODES` and `checkSourceCredibility` are untouched. A dual-source auditor now classifies its Figma nodes before extracting, and the existing "Record the attestation" bullet then records `credibility: full-page-composite` on each (a) row. The volume gate in 2a for the same rows is already covered by `da.volume` (line 49, spec line 228), so step 2a has no gap.
- Expected-red: I re-ran `context-budget`, `e178a`, `e384`, `source-credibility-gate`, `e437`, `design-auditor-volume-guard`, `subagent-templates`, `skill-evolution-v3.11`, `e391`, `e438` and `e439`. 9 tests fail: context-budget AC8, e178a AC3/AC5 and e384 ×6. Each matches an entry in `qa_reports/expected-red_e423-spec-workshop.txt` (lines 6, 7, 15–20, 24). No new red. The context-budget AC8 red comes from the coordinator bundle (coord-01). The design-auditor SOP feeds only the partial-expansion tests there, and those are green. I also ran the other files that reference `skill-design-auditor` (`render-structure`, `pixel-perfect-*`, `widget-shape-spec`) together with `e437` and `check-md-tables`: 63/63 pass.

## Quality
No findings. The sentence follows the line's existing style. It sits on the same line, so the anchor and the e410 line pins hold. The round-1 `optional` D8 note on `content/skill-integrator.md:98` still stands and is not blocking.

## Architecture
No architecture spec (D2). The fix changes SOP text only, with no change to layering or code.

## Security
No findings. The added text has no repo-only path, ticket id or name, and `e437-repo-only-paths` is green.

## Performance
No findings. Content-only change.

## Verdict
APPROVED. The R1 fix applies the step-2b classification to the Figma rows of a dual-source design exactly as D5 requires, with no other change to shipped code or content since round 1.
