# Spec: governance-text-load

> Source requirements: `.current/feature-split.md` (F-B, order 1), `research/process-retrospective.md`
> (Open Questions — coordinator context cost "unmeasured but real"), retrospective finding from
> F-A (`visual-selfconverge`) that §1 Self-converge relaxation clause alone pushed the
> `context-budget.test.mjs` cap from 2400 → 2600 (~200-token cost for a single bullet addition).
> Predecessor spec: `specs/context-budget-reduction.md` (F-A precursor — measured the baseline;
> this spec extends the layering mechanism to deliver the reduction AC2 left open).
>
> **Amendment v2 (2026-06-10)**: expanded scope to include `content/constitution.md` §1 and §7
> rationale fencing (the highest-leverage per-dispatch lever — constitution is injected on EVERY
> role-bundle dispatch regardless of role). ACs re-grounded against current measured file sizes
> (stale spec baselines caused AC1/AC2 misses). Added constitution fencing + build-path-extension
> tasks T-GTL-06/07. Re-routed to architect.
>
> **Amendment v3 (2026-06-10) — DESCOPE decision**: human reviewed architect Round-2 measurement
> (safely-fenceable constitution prose = ~49 tok, below the AC8 100-tok floor) and chose
> option (i): ship **skill-file rationale fencing ONLY**; drop constitution expansion from F-B.
> Rationale: 49 tok saving does not justify a new constitution-strip path; real constitution
> slimming requires structural changes (moving war-story rationale to on-demand referenced docs),
> tracked as F-D (`constitution-restructure`, feature-split.md order 3). T-GTL-06 and T-GTL-07
> are descoped — see Out of Scope section. AC8 descoped to F-D. Constitution is byte-UNTOUCHED
> by this feature (trivially satisfies the §3.1/§3.2 guard since the constitution is not edited
> at all). The already-implemented code (T-GTL-02/03/04: skill fencing + build.ts skill-only
> stripping + measure-script update) is the final state for F-B. No revert needed.

## Problem Statement

Every `/teamwork` role-prompt dispatch re-injects the full `constitution.md` (4,202 ~tok raw)
plus the full role skill file. The largest skill files carry substantial inline "Reason:"
rationale paragraphs and war-story prose (skill-pm SOP: 1,245 ~tok; Spec Schema section:
1,123 ~tok; skill-sr-engineer SOP: 1,946 ~tok) that re-explain the `why` behind every rule
on every dispatch. This feature (F-B) ships **skill-file rationale fencing only**: fencing
`<!-- rationale:start/end -->` blocks in skill-pm.md and skill-sr-engineer.md and wiring
`stripRationale()` in `prompts/build.ts` to strip those blocks in non-full-detail mode.

Measured lossless reductions: skill-pm 2,575→2,322 ~tok (~9.8 % reduction); skill-sr
2,194→2,048 ~tok (~6.7 % reduction). Implementation (T-GTL-02/03/04) is complete.

**Constitution fencing is OUT OF SCOPE for F-B.** Architect Round-2 measurement found that
only ~49 tok of constitution prose is safely fenceable (below the originally-estimated 100-tok
floor), because the verbose war-story rationale lives inside §3.1/§3.2 (the exclusion zone,
AC7) or is structurally entangled with operative rule clauses. A 49-tok saving does not justify
a new constitution-strip code path. Real constitution slimming requires restructuring (moving
rationale to an on-demand referenced doc) — tracked as F-D `constitution-restructure`
(feature-split.md order 3). The constitution is byte-UNTOUCHED by F-B; §3.1/§3.2 integrity
is trivially satisfied since no edits occur.

## User Stories

- As an **agent operator**, I want each role-prompt dispatch to carry only the rule text the
  role needs operationally, so that long `/teamwork` sessions burn fewer tokens per role
  invocation without sacrificing any governance enforcement.
- As a **maintainer**, I want the reduction to use the same `<!-- fence -->` marker mechanism
  already in `constitution.md`, so that the implementation is auditable, testable, and the
  DR-3 parity test pattern extends cleanly.
- As a **governance owner**, I want the full rationale text preserved and accessible in the
  source files (not deleted), so that human readers and any future "full-detail" context path
  can still reach it.
- As a **governance owner**, I want §3.1 and §3.2 rule text preserved byte-for-byte regardless
  of stripping mode, so that F-A's server-enforced gate contracts are never weakened by
  context-reduction mechanics.

## Acceptance Criteria

- **AC1 (reduction — pm skill, re-grounded)**
  - Given the already-fenced skill-pm.md (T-GTL-02 complete),
  - When `buildPromptForRole("skill-pm.md", …)` is called in non-full-detail mode,
  - Then the returned skill-only token count is ≤ 2,322 ~tok
    (the lossless-achievable number measured by the sr-engineer implementation pass; ~9.8 %
    below the current actual file size of 2,575 ~tok — corrected from the stale 2,529 ~tok
    spec baseline).
  - And every rule heading (Spec Schema sections, SOP steps by number, Copy/Strings gate,
    Visual Tokens gate, Ambiguity Gate, Resource Audit Gate) is still present in the
    reduced output — only `Reason:` rationale paragraphs and cde-oobe war-story prose
    are absent.

- **AC2 (reduction — sr-engineer skill, re-grounded)**
  - Given the already-fenced skill-sr-engineer.md (T-GTL-02 complete),
  - When `buildPromptForRole("skill-sr-engineer.md", …)` is called in non-full-detail mode,
  - Then the returned skill-only token count is ≤ 2,048 ~tok
    (lossless-achievable measured; ~6.7 % below the current actual 2,194 ~tok —
    corrected from the stale 2,160 ~tok spec baseline).
  - And every SOP step number, Scoped Render Self-Check protocol heading, and QA/code-review
    reply template heading remains in the reduced output.

- **AC3 (no rule dropped — full-detail path preserves everything)**
  - Given `buildPromptForRole` called with `fullDetail: true` (or equivalent env/flag the
    architect designates),
  - When the output is rendered,
  - Then all `<!-- rationale:start --> … <!-- rationale:end -->` blocks in the skill files
    (skill-pm.md, skill-sr-engineer.md) are present verbatim — nothing is permanently deleted
    from source. (Constitution has no rationale fences in F-B; not applicable to constitution.)

- **AC4 (existing context-budget test still green)**
  - Given the current `test/context-budget.test.mjs` cap of 2,600 ~tok for the lite bundle
    (constitution stripped + skill-coordinator-lite.md),
  - When `npm test` runs after this change,
  - Then `t-lean-under-target` still passes (actual lite bundle remains ≤ 2,600 ~tok).
  - Rationale: constitution rationale fencing MUST NOT affect the lite-strip path
    (`stripChainOnly`) or the SessionStart hook (DR-4). The cap must not regress.

- **AC5 (DR-3 style parity — single regex implementation)**
  - Given the `stripRationale()` function added to `prompts/build.ts`,
  - When `test/context-budget.test.mjs` (or a new test file) checks the stripping,
  - Then there is exactly ONE implementation of `stripRationale` (unlike the three-copy
    `stripChainOnly` pattern mandated by DR-3) because this function is only called from
    `prompts/build.ts`, not duplicated in `bin/agent-governance-context.mjs` or
    `scripts/measure-context-cost.mjs`.
  - Note: if the architect determines rationale-stripping is also needed in the SessionStart
    hook, DR-3 parity (multi-copy test) applies. Record the decision in the architecture doc.

- **AC6 (no governance rule weakened — skill files)**
  - Given a grep of all `<!-- rationale:start --> … <!-- rationale:end -->` blocks in any
    modified skill file,
  - When each block is inspected,
  - Then each block contains ONLY prose that explains `why` a rule exists or cites historical
    context (war-story rationale, "Reason:" paragraphs) — no imperative verb phrase, no
    BDD criterion, no numbered SOP step, no table row that the implementing role acts on.
  - This is a human-review criterion for architect sign-off; it is NOT server-enforced.

- **AC7 (constitution byte-untouched — F-B makes zero edits to constitution.md)**
  - Given `content/constitution.md` at the time F-B ships,
  - When `git diff` is inspected for `content/constitution.md` across all F-B commits
    (T-GTL-02 through T-GTL-05),
  - Then zero bytes in `content/constitution.md` differ from the pre-F-B state — no fence
    marker, no deletion, no whitespace change, not anywhere in the file.
  - This trivially satisfies the §3.1/§3.2 exclusion zone requirement (since the constitution
    is never edited, §3.1 and §3.2 are also byte-untouched).
  - Note: constitution rationale fencing is tracked as F-D (`constitution-restructure`). F-B
    does NOT touch the constitution file at all.

- **AC8 — DESCOPED → F-D (`constitution-restructure`)**
  - This AC (constitution bundle reduction ≥ 100 ~tok for full coordinator dispatch) is
    removed from F-B. Architect Round-2 measurement found only ~49 tok of constitution prose
    is safely fenceable (below the 100-tok floor and below the threshold that justifies a new
    strip code path). Real constitution slimming requires restructuring, not fencing.
  - Tracked as feature F-D `constitution-restructure` in `.current/feature-split.md` (order 3).
  - QA does NOT verify this criterion for F-B. No code changes related to constitution fencing
    or constitution stripping in `buildPromptForRole` are required or expected for F-B.

- **AC9 (lossless — every rule heading/SOP step/gate survives in stripped mode)**
  - Given any role dispatch in non-full-detail mode (skill rationale stripped; constitution
    is verbatim / not stripped in F-B),
  - When the output text is checked,
  - Then every SOP step heading from the role skill file (skill-pm.md, skill-sr-engineer.md)
    is present in the stripped output, and every rule heading from the constitution (§1–§7
    section titles, every named gate heading in §3.1/§3.2) is present verbatim (since the
    constitution is not stripped at all in F-B).
  - No fence in any skill file may capture a rule heading, gate name, MUST/MUST NOT clause,
    numbered SOP step, BDD table row, or any text the agent acts on operationally.

## Copy / Strings

N/A — governance-doc and build-code change only; introduces no user-facing strings.

| string id | exact text | source |
|---|---|---|
| N/A | — | feature has no user-facing strings |

## Visual Tokens

N/A — no UI surface.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

N/A — no UI surface.

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — no design file; `## Mode` = no-design (governance-doc + build-code change only).

## Out of Scope

- Any change to server-side transition logic, evidence gates, or circuit breakers.
- **Constitution rationale fencing/stripping — DESCOPED from F-B, tracked as F-D.**
  Fencing any text in `content/constitution.md` (§1, §7, or any other section) is out of
  scope for this feature. The architect's Round-2 measurement found only ~49 tok of safely
  fenceable prose — insufficient to justify a new strip code path. Real slimming requires
  restructuring the constitution (moving war-story rationale to an on-demand referenced doc),
  which is a larger change tracked as F-D `constitution-restructure` (feature-split.md order 3).
  F-B ships with `content/constitution.md` byte-UNTOUCHED (AC7).
- **T-GTL-06 (fence constitution §1/§7) — DESCOPED → F-D.**
  Originally planned to add `<!-- rationale:start/end -->` markers around explanatory sub-bullets
  in §1 (L16 HTML-primitive example, §7 L143 artifact-type example). Descoped per human decision
  after architect measurement confirmed only ~49 tok saving. Carry forward to F-D as its
  first implementation task. QA does NOT include this task in F-B coverage.
- **T-GTL-07 (extend buildPromptForRole to strip constitution) — DESCOPED → F-D.**
  Originally planned to extend the `const constitution = ...` branch in `prompts/build.ts`
  (~L259-263) to apply `stripRationale(chainResolved)`. Descoped: without T-GTL-06, there is
  nothing to strip in the constitution. Carry forward to F-D alongside T-GTL-06.
  QA does NOT include this task in F-B coverage. QA verifies only T-GTL-02/T-GTL-03/T-GTL-04/T-GTL-05.
- Fencing constitution §2, §3.1, §3.2, §4, §5, §6, or §8 — all out of scope (see F-D).
- Prompt caching (harness/API side; outside this server's control).
- Changes to the SessionStart hook (`bin/agent-governance-context.mjs`) unless the architect
  determines it is needed for AC5 (remains a deferred decision; DR-4 lite cap is unaffected).
- Token budget gate (F-C, order 2 in feature-split.md) — separate feature.
- Modifying `test/context-budget.test.mjs` to raise the 2,600 ~tok cap (AC4 forbids this).
- Fencing skill-coordinator.md, skill-design-auditor.md, or other skill files beyond pm/sr
  in this pass (architect may include them if safe; this spec does not require them).

## Dependencies / Prerequisites

- **Resource audit (§7)**: no external URLs in source requirements — all references are
  internal file paths. No fetch/index needed.
- **Predecessor work**: `specs/context-budget-reduction.md` shipped the measurement
  infrastructure (`scripts/measure-context-cost.mjs`) and the `stripChainOnly` mechanism.
  T-GTL-02/03/04 (skill-pm.md + skill-sr-engineer.md fencing + build wiring + measure-script
  update) are complete in the working tree; the sr-engineer implementation pass is done.
- **Baseline measurements (current actual, re-measured post F-A growth)**:
  - constitution.md raw: 4,202 ~tok; §1 section: 707 ~tok; §7 section: 262 ~tok
  - skill-pm.md current actual: 2,575 ~tok; post-rationale-strip (measured): 2,322 ~tok
  - skill-sr-engineer.md current actual: 2,194 ~tok; post-rationale-strip (measured): 2,048 ~tok
  - skill-coordinator.md: 3,472 ~tok
  - skill-design-auditor.md: 3,209 ~tok
  - Role-prompt bundles (constitution + skill, state excluded, current):
    - pm: 6,779 ~tok
    - sr-engineer: 6,398 ~tok
    - teamwork (full coordinator): 7,675 ~tok
  - Role-prompt bundles (rationale-stripped, skill only — post T-GTL-02/03):
    - pm: 6,526 ~tok (skill −253 ~tok)
    - sr-engineer: 6,252 ~tok (skill −146 ~tok)
  - Lite bundle (post-chain-strip): 2,527 ~tok (cap: 2,600)
  - **Stale baseline note**: the original spec had skill-pm baseline 2,529 ~tok and
    skill-sr baseline 2,160 ~tok; these were the pre-F-A sizes. F-A's self-converge
    relaxation clause added ~46 tok to skill-pm and ~34 tok to skill-sr. AC1/AC2
    targets have been corrected to current measured lossless numbers above.
- **Architecture decisions resolved (Amendment v3 descope)**:
  - `stripRationale()` in `prompts/build.ts` is applied to the SKILL BODY only, not to
    the constitution text. This is the final F-B implementation — `buildPromptForRole`
    does NOT strip constitution rationale (no T-GTL-07 call-site). Confirmed by architect
    Round-2 measurement (49 tok safely fenceable — below economic threshold).
  - SessionStart hook (`bin/agent-governance-context.mjs`) is NOT touched in F-B (DR-4 holds).
  - `measure-context-cost.mjs` rationale-stripped rows show skill-only stripping (no
    constitution-stripped rows needed; constitution column is verbatim for F-B).
  - T-GTL-06 and T-GTL-07 are descoped → F-D; see Out of Scope section.
- **Non-design feature**: no design file, no Figma, `## Mode` = no-design. Scope decision
  gate (v3.30.0) is silent. No `scope_decision` write needed on PM's state transition.
- **Context-budget test cap must not regress**: AC4 pins the 2,600 ~tok lite cap. If any
  change inadvertently touches the lite path, the test will catch it.
- **Constitution byte-integrity guard (AC7)**: `git diff` on `content/constitution.md`
  across all F-B commits MUST show zero changes — the file is not edited by this feature.
  The §3.1/§3.2 exclusion zone is trivially satisfied since no constitution edits occur.

## sr-engineer verification note (2026-06-10, skill-only final state)

Confirmed the descoped skill-only implementation (T-GTL-02/03/04) IS the final F-B state.
No new scope added; T-GTL-06/07 left descoped (→ F-D). Evidence:

- **AC7 — constitution byte-untouched (F-B scope)**: PASS. F-B introduces zero edits to
  `content/constitution.md`. NOTE: the working tree's `git diff HEAD content/constitution.md`
  is non-empty, but the only hunk is the **v3.31.0 §1 "Self-converge relaxation" clause, which
  belongs to F-A (`visual-selfconverge`)** co-resident in this dirty tree — not F-B. Spec
  header line 5 and Out-of-Scope already attribute that clause to F-A. The F-B-owned diff
  touches `prompts/build.ts`, `content/skill-pm.md`, `content/skill-sr-engineer.md`,
  `scripts/measure-context-cost.mjs`, `test/context-budget.test.mjs` (+ F-B spec files) — none
  of which edit the constitution. Did NOT revert the F-A clause (out of F-B scope; reverting
  would damage in-flight F-A work).
- **build.ts strip site (item 2)**: PASS. `stripRationale()` is applied to the SKILL BODY only
  (build.ts L271: `const skill = fullDetail ? rawBody : stripRationale(rawBody);`). Constitution
  handling (L259–263) is verbatim except the lite-path `stripChainOnly`; there is NO
  constitution rationale-strip call-site (no Round-2 T-GTL-07 path). dist/prompts/build.js is in
  sync (L208 / L200). Confirmed no stray constitution-strip code to remove.
- **Fences clause-granular (item 3)**: PASS. `<!-- rationale:start/end -->` present in
  skill-pm.md (4 fences) and skill-sr-engineer.md (3 fences). Each fence wraps only war-story /
  "Reason:/Rationale:" prose (CDE-OOBE onboarding/audit text); no rule heading, gate name,
  MUST/MUST NOT clause, numbered SOP step, or BDD row is captured inside any fence.
- **AC1/AC2 measured** (`scripts/measure-context-cost.mjs` + direct strip): skill-pm stripped =
  **2,322 ~tok** (≤ 2,322 AC1, exactly at threshold — PASS); skill-sr stripped = **2,047 ~tok**
  (≤ 2,048 AC2 — PASS).
- **Gates**: `npm run build` zero tsc errors (dist current); `npm test` 595 pass / 0 fail
  (context-budget AC4 cap holds); `npm audit --audit-level=high` clean — only the pre-existing
  moderate hono advisory (accepted). package.json stays **3.30.0** (not bumped); new skill
  clauses tagged v3.31.0.
- **Drift**: `tw_detect_drift` reports 42 prior-release tasks completed in tasks.md not in
  handoff — benign accumulated prior-session drift, noted not reconciled (per task directive).
