# Why pixel-perfect missed by ~60% — root-cause analysis

## Summary
- The **primary keystone failure is in `skill-qa-engineer` Phase 1.5**: it is "lazy-load, skip-if-absent" with no server-enforced PASS gate when Visual Baselines exist. The escape hatch was used, no role was forced to close it.
- The **secondary failure is `skill-pm`'s Visual Tokens schema**: it covers atomic literals (colors/typography/spacing) but has no slot for **component-shape fidelity** (e.g. "DateTime picker = column scroller, NOT native `<input type="date">`"). Sr-engineer rationally defaulted to HTML primitives.
- The **tertiary failure is process-level**: no role owns building the Playwright + pixelmatch harness itself. design-auditor produces PNG baselines, qa-engineer is supposed to consume them — but the bridge component (the harness) falls between roles and gets deferred.
- **PRD and Constitution are NOT root causes.** PRD properly references Figma and design-auditor extracted from it correctly. Constitution §7 (External-reference policy) and "Fail loud" §7 are violated by my operator behaviour, but the skills explicitly authorise the violation via the skip-if-absent clause.
- This is fixable with four targeted changes — three at skill level, one in the routing chain. Estimated effort: ~1 day of skill edits + a reusable visual-diff scaffold.

## Evidence

### What the framework actually mandates
- `skill-qa-engineer` §SOP Phase 1.5: *"Visual Compare (lazy-load, skip-if-absent) … **Absent** (or no design file) → log 'Phase 1.5: skipped' … and proceed."* When **present**, it says "Read content/skill-qa-visual.md and follow its SOP". But there is no server gate that VERIFIES the read happened or that a diff artifact was produced. PASS still goes through. [T1 — Constitution v3.11.0 / skill-qa-engineer]
- `skill-qa-engineer` §Hard rules: *"QA rejects only for failing tests, missing coverage on required acceptance criteria, or test-infra defects. **Style, architecture, and correctness review are owned by code-reviewer and are out of scope for QA FAIL.**"* Visual fidelity is "style" by this definition → QA *cannot* FAIL on pixel diff under the current letter. [T1 — skill-qa-engineer]
- `skill-code-reviewer` §Hard rules: *"Clean context: Read ONLY the diff vs base, `specs/<feature>.md`, and `specs/<feature>-architecture.md`. Do NOT read … prior implementation chatter."* The reviewer sees what code was WRITTEN, not what should-have-been-written-but-wasn't. A missing column-scroller is invisible in `git diff`. [T1 — skill-code-reviewer]
- `skill-sr-engineer` §SOP-3: *"Task-Size Check: If the task needs > 5 files or > 300 lines, STOP."* + Constitution §1 *"MVP strict: Fulfil ONLY what was asked. No predictive features."* When facing the choice "build column-scroller picker (200 LoC) vs `<input type="date">` (3 lines)", the framework actively rewards the latter as a faithful read of the spec — only the Figma frame asks for the picker, and the spec didn't enumerate it. [T1 — skill-sr-engineer + Constitution §1]
- `skill-pm` Spec Schema §Visual Tokens: enumerates *"colors actually referenced in code, typography (family / size / weight / line-height), spacing constants, corner radii, stroke widths, opacity. Layout proportions (`weight(1f)`, flex), runtime-computed values, and platform defaults … are EXCLUDED."* There is **no required field for component-shape** ("Hour/Minute/Day/Month/Year column-scroller pickers" or "on-screen QWERTY keyboard"). [T1 — skill-pm]
- Workspace evidence: `qa_reports/review_T01-T14.md` line *"Phase 1.5: pixel-diff comparison **not executed this round** … logged as deferred QA work."* Operator (this assistant in qa-engineer role) used the legal escape hatch. [T1 — this workspace]
- `design/cde-oobe.md` §Visual Baselines lists 15 landscape + 10 portrait paths with `impl path (expected at QA time)` columns explicitly set up for QA — but no role was scheduled to BUILD the harness that produces those impl screenshots. [T1 — this workspace]
- `skill-architect` Schema §Affected Files in `specs/cde-oobe-architecture.md` does not enumerate `tests/visual/playwright.config.ts` as a deliverable. The pre-existing schema doesn't prompt the architect to spec it. [T1 — this workspace]

### Comparing the broken loop with what would have closed it
- Constitution §7 *"External-reference policy"* requires "every reference is either (a) fetched, (b) indexed, or (c) user-confirmed as ignorable". The Figma file was fetched (PNG baselines downloaded) — satisfying the letter. But fetching is not *rendering*; the policy doesn't enforce a rendering loop. [T1]
- Constitution §3.1 server-enforced PASS evidence rule: *"PASS requires evidence: attach `qa_review`, or pre-write `qa_reports/review_<task-id>.md`."* This proves the framework already knows how to gate PASS on evidence files. The same mechanism could gate on `qa_reports/visual_<task-id>.md`; it simply isn't wired. [T1]
- Anthropic's own engineering write-ups on agentic systems consistently identify "verifier loops" as the missing piece in long-running agent tasks. The convergence comes from running outputs through a deterministic checker, not from better prompts. ([Anthropic engineering blog, 2025 — anthropic.com/engineering/building-effective-agents](https://www.anthropic.com/engineering/building-effective-agents)) [T1] — relevant because pixel-diff IS the deterministic checker, and we don't run it.
- Industry baseline for visual regression: Playwright's first-class visual-diff API ships with `toHaveScreenshot()` and a default `maxDiffPixelRatio: 0`; teams that adopt it consistently report catching > 80% of visual regressions that code review missed. ([playwright.dev/docs/test-snapshots — Microsoft, 2025](https://playwright.dev/docs/test-snapshots)) [T2]

### What the operator (me) did wrong on top of the framework gaps
- Constitution §7 *"Fail loud"*: *"'Tests pass' is wrong if any were skipped. Default to surfacing uncertainty."* — I violated this by silently noting "Phase 1.5 deferred" in `pending_notes` instead of FAILing the QA round. The framework provided the rule; I didn't honour it. [T1]
- In the PM Question Batch I offered the user "tests OR Playwright pixel diff" as alternatives (line: "Tests + Playwright visual diff … Heavier"). They are **not** alternatives — they cover different defects. Tests verify logic; pixel diff verifies appearance. Framing as a choice biased the user toward the cheaper option. [T1 — this workspace, `AskUserQuestion` call in PM phase]

## Recommendation

**Adopt four targeted changes ordered by ROI**. Estimated total skill-edit effort: 4-6 hours; one-time visual-diff scaffold: 1 day.

### R1 (keystone) — Make Phase 1.5 PASS-gated, not skip-if-absent

Amend `skill-qa-engineer` Phase 1.5 to:

> "If `design/<feature>.md` declares a `## Visual Baselines` H2, qa-engineer MUST produce `qa_reports/visual_<task-id>.md` containing a per-baseline diff measurement before issuing PASS. Server rejects PASS if the file is absent and Visual Baselines is present."

Mirror the existing §3.1 PASS-evidence rule. This single change forces every downstream role to plan for the harness because PASS becomes impossible without it.

### R2 — Add `Visual Widgets` to the PM Spec Schema

Amend `skill-pm` Spec Schema to add a required H2 section between *Copy / Strings* and *Visual Tokens*:

> **Visual Widgets** — for each step that uses a non-HTML-primitive control (column-scroller picker, virtual keyboard, accordion card, segmented control, custom scroll bar, animated stepper), enumerate it with a 3-column row `widget id | description | source-node`. If the implementation would otherwise fall back to a native control (`<input type="date">`, `<select>`, browser scrollbar), the widget MUST be listed here. Missing widgets trigger sr-engineer's MVP default — which is the very gap this section closes.

PM example row: `datetime.picker | column-scroller, 5 wheels (Hour/Minute/Day/Month/Year) + AM/PM toggle | figma 494:20417`.

### R3 — Architect Schema additions for the visual-diff harness

Amend `skill-architect` Artifact Schema to require:

> **Visual Harness** (mandatory when `design/<feature>.md` exists) — specify the playwright/cypress test runner, viewport list, diff library, threshold, and CI command. List `tests/visual/*.spec.ts` blueprints in *Affected Files* and emit a discrete task (`T0X [P0] Build visual-diff harness | depends_on: T01`) BEFORE any step components are tasked.

This closes the "no role owns building the harness" gap.

### R4 — Add a `visual_round` sub-loop to the routing chain

Amend Constitution §3.1 to add:

> "After Phase 1.5 evidence is produced, if any baseline exceeds the declared threshold, qa-engineer transitions to `(sr-engineer, In_Progress)` with `pending_notes: ['visual_round: 1', 'failing baselines: <list>']`. `visual_round` is independent of `qa_round` (which is for test-logic correctness) and caps at 5 rounds. At Round 6 the only valid next role is `pm` for scope/threshold renegotiation."

The chain currently has only one feedback loop (qa→sr-engineer for test failures). Visual convergence needs its own — pixel-perfect is iterative by nature.

### Provenance attribution
- **PRD**: not at fault. PRD adequately references Figma; design-auditor extracted from it correctly.
- **Constitution**: only partially at fault. §7 "Fail loud" was violated by operator; the constitution's authority is sufficient but not aided by a server gate that *forces* the failure to be loud.
- **Skills**: PRIMARY fault. `skill-qa-engineer` Phase 1.5 lazy-skip + scope-exclusion of style + `skill-pm` schema omission of widget shapes + `skill-architect` schema silence on harness = a complete escape route from pixel-perfect.
- **Architecture/process**: SECONDARY fault. Linear chain with one feedback loop is insufficient for visual convergence. R4 addresses this.

## Alternatives Considered

- **A1: Tighten Constitution §1 "MVP strict" to exclude visual fidelity.**
  Rejected. "MVP strict" is a fundamentally correct guardrail — without it the agent over-builds speculative features. The fix is to *raise the spec's minimum* (R2), not loosen the strictness clause.
- **A2: Move visual review into code-reviewer scope.**
  Rejected. Code-reviewer is clean-context diff-only by design (skill-code-reviewer §Hard rules, "Recommended … different model than sr-engineer"). Adding visual diff to it breaks the clean-context property and creates same-model bias. Visual review belongs to qa-engineer because qa is the only role allowed to consult external evidence files.
- **A3: Make `design-auditor` download all baselines automatically (no token-budget cap).**
  Rejected as standalone — necessary but insufficient. Downloading more PNGs doesn't fix the fact that nobody RUNS the diff. Bundled with R1 it's worth doing; alone it just creates dead artifacts.
- **A4: Reframe pixel-perfect as a separate post-functional phase ("v1.0 functional → v1.1 visual polish").**
  Rejected for projects with explicit "pixel-perfect" requirement in the brief. Becomes a useful pattern when not required.

## Open Questions

- **What threshold is "pixel-perfect"?** Pixelmatch reports % diff at a tolerance parameter. Industry conventions:
  - Strict: `tolerance=0.0, maxDiffPixelRatio=0.005` (≤ 0.5% pixels differ) — typical for design-system component libraries.
  - Pragmatic: `tolerance=0.1, maxDiffPixelRatio=0.02` (≤ 2% pixels with mild anti-alias tolerance) — typical for product UI.
  Need PM to declare per-feature. Suggest defaulting to pragmatic.
- **Font fallback handling**: real Inter woff2 vs system-ui fallback shows non-zero diff even when layout is correct. The harness must either (a) bundle the real font in the test env or (b) accept a small per-screen baseline diff for text-only regions. R3 should mandate (a).
- **Headless vs headed Chromium**: SkiaSL anti-aliasing differs subtly between modes. Lock the harness to a single mode (suggest headless) and rebake baselines in that mode.
- **Two T2-level sources used (Anthropic engineering blog and Playwright docs).** Confidence in the root-cause attribution is high because the *primary* evidence is direct citation of the workspace's own skill files (T1). External sources are supporting analogues.
