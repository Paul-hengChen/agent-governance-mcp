# Spec: constitution-restructure (F-D)

> Source requirements: `.current/feature-split.md` (F-D, order 3), `specs/governance-text-load.md`
> (Amendment v3 descope decision + architect Round-2 measurement), `research/process-retrospective.md`
> (CDE-OOBE Language run — context-cost findings).
>
> **Origin**: F-B (`governance-text-load`) proved that safe rationale-fencing of
> `content/constitution.md` yields only ~49 tok (below the 100-tok economic floor) because verbose
> war-story prose is either entangled with operative rule text inside bullets or lives in §3.2,
> which F-A's AC-3 guard treated as a byte-freeze zone. F-D's premise: real slimming requires
> **restructuring** — moving the verbose §3.2 opening-paragraph war-story and the Bullet-1
> "Enforcement:" explanation OUT of the per-dispatch constitution into an on-demand referenced doc,
> leaving terse enforceable rules inline.
>
> **HUMAN DECISION (2026-06-10): option (a) — ship rationale doc ALONE.**
> The achievable token saving is only ~96 tok and would require surgery on §3.2 (the
> false-PASS-prevention governance). That is a bad risk/reward trade. The real value of F-D is
> the audit-trail: a permanent, human-readable "why" document. No §3.2 extraction, no constitution
> edits, no build/code change. This decision locks scope — §3.2 surgery is explicitly OUT OF SCOPE.

## Problem Statement

Every `/teamwork` role-prompt dispatch re-injects the full `content/constitution.md` (4,202 ~tok,
v3.27.0). F-B proved that safe fence-marker extraction of the constitution yields only ~49 tok.
The deeper structural reorganisation that F-D originally explored — extracting §3.2 opening-paragraph
prose to save ~96 tok — was evaluated against the risk of §3.2 surgery (the false-PASS-prevention
governance section) and found to be a poor risk/reward trade.

**This feature therefore delivers the secondary value exclusively**: `content/constitution-rationale.md`
— a permanent, human-readable audit trail for *why* each governance rule exists (the cde-oobe
war-stories, the long "Reason:" prose, the intent behind §1 MVP/Visual-Widgets/Design-baseline, §3.1
gates, §3.2 visual-verdict authority, §5 anti-loop, §7). It compiles and curates rationale already
present inline in the constitution plus the retrospectives. It does NOT remove anything from
`content/constitution.md`.

**Measured baseline (scripts/measure-context-cost.mjs, v3.31.0):**

| artifact | raw ~tok | after chain-strip (lite/SessionStart) |
|---|---|---|
| constitution.md | 4,202 | 1,956 |
| chain-only block (§3.1+§3.2+§4) | 2,246 | — (stripped) |
| §3.2 full section | 744 | — (chain-only, stripped for lite) |
| §4 full section | 446 | — (chain-only, stripped for lite) |
| §3.1 full section | 1,050 | — (chain-only, stripped for lite) |

**PM finding (recorded, NOT acted upon for token saving): total cleanly extractable constitution
rationale = ~96 tok (§3.2 opening paragraph only). The §3.2 Enforcement clause (188 tok) is
SCOPED OUT (contains operative "void by this rule" instruction). Achieving even the 96 tok saving
requires §3.2 surgery — a bad trade per human decision above.**

## User Stories

- As a **governance maintainer**, I want all war-story/audit-trail rationale for constitution
  rules to live in a single reachable `content/constitution-rationale.md` document, so that
  the "why" behind each rule is accessible to humans and future agents without being injected
  on every dispatch.
- As a **future PM/architect**, I want the rationale document to compile the cde-oobe war-stories
  and the intent behind each major section (§1, §3.1, §3.2, §5, §7), with one-way section
  references pointing back to constitution section ids, so that any agent that needs the "why"
  can locate it without guessing.
- As a **qa-engineer**, I want to confirm that `content/constitution.md` is byte-identical before
  and after all F-D commits, so that no governance contract is silently weakened by a doc-authoring
  pass.

## Acceptance Criteria

- **AC1 (DESCOPED — constitution.md is NOT edited)**
  - The original AC1 (full-mode constitution bundle reduction) is DESCOPED per human decision
    (option a). `content/constitution.md` is byte-untouched across all F-D commits.
  - `git diff content/constitution.md` across all F-D commits MUST be empty.
  - This is now a HARD CONSTRAINT, not a "best-effort" goal.

- **AC2 (no token regression on any prompt bundle)**
  - Given `buildPromptForRole` called for any chain-role (pm, sr-engineer, architect,
    qa-engineer, teamwork coordinator),
  - When the returned prompt text is measured via `scripts/measure-context-cost.mjs`,
  - Then all bundle sizes are at or below their v3.31.0 baselines:
    - Lite bundle: ≤ 2,527 ~tok
    - Full-mode constitution-only token count: ≤ 4,202 ~tok (no change permitted, no regression)
  - Rationale: `content/constitution-rationale.md` is NOT loaded into any prompt bundle; it is a
    repo artifact only (on-demand, read via file tool). This AC is a regression guard.

- **AC3 (DESCOPED — §3.2 diff is rationale-relocation only)**
  - Original AC3 is DESCOPED. There is no constitution diff to inspect. `content/constitution.md`
    is byte-untouched. Trivially satisfied.

- **AC4 (rationale document created, covers major sections, one-way references)**
  - Given `content/constitution-rationale.md` is created by this feature,
  - When any human or agent reads it,
  - Then it covers the design rationale and "why" for each of: §1 (MVP/Visual-Widgets/
    Design-baseline intent), §3.1 gates (why the pre-flight and freshness guards exist),
    §3.2 visual-verdict authority (the cde-oobe war-story, false-PASS-prevention), §5
    anti-loop (why the circuit-breaker exists), §7 (external-reference policy rationale).
  - And it contains one-way section references FROM the rationale doc TO constitution section ids
    (e.g., "See constitution.md §3.2") — these are navigational anchors in the rationale doc only.
  - And it does NOT add any reverse-links or back-references INTO `content/constitution.md`
    (that would require editing the constitution — out of scope for option a).
  - And it draws from and cites `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`
    and `research/process-retrospective.md` where relevant.

- **AC5 (DESCOPED — build.ts unchanged constraint)**
  - Original AC5 is DESCOPED. No build.ts / prompt-assembly change is in scope. `prompts/build.ts`
    MUST NOT be modified by F-D. This is now trivially enforced by the zero-code constraint.

- **AC6 (DESCOPED — §3.2 rule clause presence check)**
  - Original AC6 is DESCOPED. Constitution is byte-untouched; no clause verification needed.

- **AC7 (PRIMARY DELIVERABLE — rationale doc exists and is well-formed)**
  - `content/constitution-rationale.md` exists, is well-formed markdown, and is the sole
    deliverable of F-D.
  - It is a curated, human-readable compilation — NOT a raw paste of the constitution. It
    synthesises and organises the rationale/war-story content with clear section headings
    matching constitution section ids.
  - Discoverability: `CLAUDE.md` (repo layout section, under `content/`) is updated with a
    one-line entry pointing to `content/constitution-rationale.md`. This is the designated
    discoverability path (CLAUDE.md already lists content/* files — it is the natural home).
    `content/constitution.md` itself is NOT edited.

- **AC8 (DESCOPED — measure-script delta row)**
  - Original AC8 (measure-script constitution-restructure delta row) is DESCOPED. There is no
    token-saving delta to record. `scripts/measure-context-cost.mjs` is NOT modified by F-D.

- **AC9 (tests pass — no regression)**
  - Given the existing test suite,
  - When `npm test` runs after F-D,
  - Then all tests pass with zero failures.
  - NOTE: since no code files are changed by F-D (only `content/constitution-rationale.md` and
    `CLAUDE.md` are authored), this AC is expected to be trivially satisfied — but qa-engineer
    must verify explicitly.

- **AC10 (DESCOPED — human code-review gate for constitution diff)**
  - Original AC10 is DESCOPED. There is no constitution diff to review.
  - The human review for F-D is simply: confirm `git diff content/constitution.md` is empty
    and `content/constitution-rationale.md` exists and reads well.

## Copy / Strings

N/A — governance-doc authoring only; introduces no user-facing strings.

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

N/A — no design file; `## Mode` = no-design (governance-doc authoring only).

## Out of Scope

- **§3.2 surgery (HARD CONSTRAINT)**: Any edit to `content/constitution.md` is explicitly OUT OF
  SCOPE per human decision (option a, 2026-06-10). `git diff content/constitution.md` must be
  empty across all F-D commits.
- §3.2 opening-paragraph extraction (~96 tok) — DESCOPED. Was the original target; human decided
  the risk/reward is poor (§3.2 false-PASS-prevention surgery for only ~96 tok saving).
- §3.2 Bullet-1 "Enforcement:" clause (188 tok) — SCOPED OUT (also out of scope for option a).
  Contains active "void by this rule" and "authorship is enforced by the chain" operative text.
- §4 post-diagram prose (362 tok) — SCOPED OUT.
- §3.1 rationale (entangled) — SCOPED OUT.
- §1, §2, §5, §6, §7 token extraction — SCOPED OUT.
- Any changes to `prompts/build.ts` — NOT touched by F-D.
- Any changes to `scripts/measure-context-cost.mjs` — NOT touched by F-D.
- Architecture decision gate (T-CR-01) — DESCOPED. No architecture needed for a zero-code
  single-doc feature. Routing directly to sr-engineer.
- Code-reviewer pass for constitution diff (T-CR-03) — DESCOPED. No constitution diff to review.
  QA verifies byte-untouched constraint directly.
- SessionStart hook (`bin/agent-governance-context.mjs`) — NOT touched.
- Token budget gate (F-C, order 2 in feature-split.md) — separate feature.
- Any server-side transition logic, evidence gates, or circuit breakers.
- Version bump of `package.json` — release-engineer does at release time.
- Reverse-links or back-references added INTO `content/constitution.md` — out of scope (would
  require editing the constitution).

## Dependencies / Prerequisites

- **Resource audit (§7)**: internal files only — `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`
  and `research/process-retrospective.md` are the primary source material for the rationale doc.
  No remote fetch needed. No external URLs found.
- **Predecessor work**: F-B (`governance-text-load`) shipped at v3.31.0. No F-B artifacts are
  consumed by F-D (no build.ts change, no measure-script change). F-D is now standalone.
- **Baseline measurements (v3.31.0, for reference — no delta expected)**:
  - constitution.md raw: 4,202 ~tok
  - Lite bundle: 2,527 ~tok (cap: 2,600)
  - Full-mode bundles (pm: 6,526, sr-engineer: 6,251, teamwork: 7,675)
- **Human decision recorded**:
  - 2026-06-10: human chose option (a) — rationale doc alone, constitution byte-untouched.
  - Reason: ~96 tok saving requires §3.2 surgery; bad risk/reward. Real value = audit trail.
  - AC7 fallback (original) is now the ENTIRE feature.
- **Non-design feature**: no design file, `## Mode` = no-design. Scope decision gate silent.
  `scope_decision: single-feature` retained.
- **Complexity routing**: ZERO-code, single-doc work. No architecture decision needed.
  Routing DIRECTLY to sr-engineer (no architect pass). Tasks: T-CR-02 (sr-engineer) →
  T-CR-04 (qa-engineer).
- **Discoverability path**: `CLAUDE.md` layout section (under `content/`) is the designated
  location for a pointer to `content/constitution-rationale.md`. This is the natural home
  (CLAUDE.md already lists all `content/*` files). NOT in `content/constitution.md`.
- **Version target**: v3.32.0. `package.json` is NOT bumped here (release-engineer at release time).
