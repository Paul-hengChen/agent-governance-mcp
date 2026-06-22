<!-- @pm | feature_id: code-reviewer-role-extraction | created_at: 2026-05-28 | research_basis: research/process-retrospective.md -->

# Code-Reviewer Role Extraction (v3.9.0)

## Problem Statement

The current routing chain `sr-engineer → qa-engineer` conflates two distinct judgement tasks: **code review** (correctness, quality, architecture, security of the diff) and **test authorship** (writing and running tests). Industry consensus (2025–2026) treats writer/reviewer separation as a structural requirement — a model "too close" to code it co-authored rationalises its own logic, and the same context-degraded review-then-test combo produces tests that pass flawed logic [research/process-retrospective.md §E1–E2]. The current chain reaches only the two-agent baseline; this spec promotes it to three-agent (`sr ↔ code-reviewer → qa`), which the literature shows "catches categorically more, especially on complex diffs."

Out-of-band, this also clarifies qa-engineer's mandate — currently silently overloaded with both review and test duties — by making test authorship its sole responsibility.

## User Stories

- As a sr-engineer, I want my work judged in a clean context that has never seen my reasoning notes, so that style/correctness verdicts are not biased by my own framing of the change.
- As a code-reviewer, I want to see only the diff, the PM spec, and (if present) the architect handoff, so that I can apply adversarial review per industry best practice without inheriting writer-side blind spots.
- As a qa-engineer, I want explicit scope narrowing to test authorship and test-infra defects only, so that I do not double-gate on style/architecture concerns the code-reviewer already cleared.
- As a PM, I want a `review_round` circuit breaker symmetric to `qa_round` that forces escalation back to me after 3 FAILs, so that endless sr↔code-reviewer ping-pong cannot drain the loop budget.
- As a teamwork-lite user (solo-dev mode), I want the code-reviewer flow to be excluded from lite mode entirely, so that solo same-context work is unaffected (lite is server-read-only by design; adding an enforced reviewer gate would defeat its purpose).

## Acceptance Criteria

### AC-1 — Agent enum extended

**Given** `tools/transitions.ts` defines `AgentName` as a closed union
**When** the implementation lands
**Then** `AgentName` MUST include the literal `"code-reviewer"` between `sr-engineer` and `qa-engineer` in the union ordering, and `isAgent()` MUST accept `"code-reviewer"`.

### AC-2 — Transition matrix mutated

**Given** the previous `sr-engineer:In_Progress` row in `ALLOWED_TRANSITIONS` allowed direct handoff to `qa-engineer:In_Progress`
**When** the implementation lands
**Then** the matrix MUST:
- Remove `{agent: "qa-engineer", status: "In_Progress"}` from `sr-engineer:In_Progress` allowed-next.
- Insert `{agent: "code-reviewer", status: "In_Progress"}` into `sr-engineer:In_Progress` allowed-next (replacing the removed qa edge).
- Add row `code-reviewer:In_Progress` → `[{code-reviewer, FAIL}, {code-reviewer, Blocked}, {qa-engineer, In_Progress}]`.
- Add row `code-reviewer:FAIL` → `[{sr-engineer, In_Progress}, {pm, In_Progress}]`.
- Add row `code-reviewer:Blocked` → `[{code-reviewer, In_Progress}, {pm, In_Progress}]`.
- NOT add any `code-reviewer:PASS` row — PASS remains qa-engineer-exclusive (see AC-4).

### AC-3 — `review_round` counter symmetric to `qa_round`

**Given** handoff state currently carries `qa_round: N`
**When** the implementation lands
**Then** handoff state MUST also carry `review_round: N`, with:
- `REVIEW_ROUND_CAP = 4` (identical to `ROUND_CAP`).
- `computeNewRound` MUST increment `review_round` on `(code-reviewer, FAIL)`, reset to 0 on `(code-reviewer, In_Progress → qa-engineer, In_Progress)` handoff, reset to 0 on `(pm, In_Progress)` re-entry, and hold steady otherwise.
- Round-cap override: when `prev_review_round >= REVIEW_ROUND_CAP`, only `(pm, In_Progress)` is accepted as next; emit error code `REVIEW_ROUND_EXCEEDED`.
- The existing `qa_round` precedence is unchanged; both counters are checked independently.

### AC-4 — PASS reserved for qa-engineer (unchanged)

**Given** constitution §3.1 currently states `status=PASS and tw_complete_task require agent_id="qa-engineer"`
**When** the implementation lands
**Then** this rule MUST remain literal. Code-reviewer approval is expressed as a state handoff `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` accompanied by `pending_notes` containing `["next_role: qa-engineer", "review: APPROVED", "review_report: review_reports/review_<task-id>.md"]`. The server-side `requireQaEngineer()` guard is NOT extended to accept code-reviewer.

### AC-5 — Constitution updates

**Given** `content/constitution.md` is currently at version `v3.8.3`
**When** the implementation lands
**Then** the file MUST:
- Bump header version to `v3.9.0`.
- §3.1 Server-enforced chain: append bullet `Code-reviewer approval is signalled via (code-reviewer, In_Progress) → (qa-engineer, In_Progress) handoff with pending_notes containing 'review: APPROVED' and a review_reports/review_<task-id>.md evidence file. Code-reviewer cannot use status=PASS; that remains qa-engineer-exclusive.`
- §3.1: append bullet `After 3 code-reviewer FAILs (Round 4 of review_round), only (pm, In_Progress) is accepted — symmetric to the qa_round circuit breaker.`
- §4 Routing Chain: replace the ASCII diagram with `researcher (optional) → design-auditor (optional) → pm → architect (if complex) → sr-engineer ↔ code-reviewer → qa-engineer ↻ sr-engineer (Round 1-3 review)`. Note that the existing qa loop arrow back to sr-engineer is preserved separately.

### AC-6 — Skill files

**Given** there is no `content/skill-code-reviewer.md` today
**When** the implementation lands
**Then**:
- `content/skill-code-reviewer.md` MUST exist with sections: Persona, Output rule (chat ≤ 1 sentence, final reply `Done. Review in review_reports/review_<task-id>.md.`), Hard rules (clean-context mandate — read only the diff vs base, the PM spec, and architect handoff if present; explicitly ignore sr-engineer pending_notes commentary), SOP (1. `tw_get_state` + `tw_detect_drift`; 2. read diff + spec; 3. produce review report; 4. `tw_update_state` PASS-equivalent or FAIL).
- Review report schema (sections in order): Summary / Correctness / Quality / Architecture / Security / Verdict. Verdict is one of `APPROVED` or `CHANGES_REQUESTED` with rationale.
- `content/skill-sr-engineer.md` final-handoff line MUST change from `next_role: qa-engineer` to `next_role: code-reviewer`.
- `content/skill-qa-engineer.md` MUST add a Scope clause: `QA rejects only for failing tests, missing coverage on required acceptance criteria, or test-infra defects. Style, architecture, and correctness review are owned by code-reviewer and are out of scope for QA FAIL.`
- `content/skill-coordinator.md` Routing Table MUST add row `review, code review, judge diff → code-reviewer` and the chain diagram must mirror constitution §4.
- `content/skill-coordinator-lite.md` MUST add an explicit note: `Lite mode excludes the code-reviewer step. The reviewer gate is a multi-context separation tool; lite is solo-dev same-context work where it is structurally meaningless.`

### AC-7 — Prompt registration

**Given** `index.ts` registers six prompts today (`teamwork`, `teamwork-lite`, `sr-engineer`, `pm`, `architect`, `researcher`, `qa-engineer` — actually seven counting design-auditor)
**When** the implementation lands
**Then**:
- `prompts/code-reviewer.ts` MUST exist, calling `buildPromptForRole("code-reviewer")`, mirroring `prompts/qa-engineer.ts`.
- `index.ts` MUST register the prompt with id `code-reviewer` and human description `Code review role — clean-context diff judge between sr-engineer and qa-engineer.`
- The `tw_switch_role` zod enum in `tools/role.ts` MUST include `code-reviewer`.

### AC-8 — Evidence file extension

**Given** `tools/evidence-file.ts` today checks for `qa_reports/review_<task-id>.md`
**When** the implementation lands
**Then** an analogous `review_reports/review_<task-id>.md` check MUST exist, called when the next-state agent is `qa-engineer` and the previous agent was `code-reviewer`. Absence of the review file MUST reject the transition with hint `Code-reviewer evidence missing: write review_reports/review_<task-id>.md before handing off to qa-engineer.`

### AC-9 — Schema versioning

**Given** the handoff and sqlite schemas carry `schema_version` integers
**When** the implementation lands
**Then**:
- Handoff schema bumps with a migration that defaults `review_round` to `0` for existing rows. Pre-existing handoff entries with `last_agent=sr-engineer, status=In_Progress` MUST log a one-line stderr warning on first parse: `[code-reviewer migration] In-flight ticket detected at sr-engineer:In_Progress — next transition to qa-engineer will be rejected. Manually re-route to code-reviewer or roll back to pm.`
- SQLite handoff table gains `review_round INTEGER NOT NULL DEFAULT 0` via migration v(N)→v(N+1).
- `schema/versions.ts` increments the relevant `CURRENT` constants.

### AC-10 — SessionStart hook context

**Given** `bin/agent-governance-context.mjs` auto-injects the current project state
**When** the implementation lands
**Then** the injected YAML MUST include `review_round: <N>` alongside the existing `qa_round: <N>`, sourced from the migrated handoff state.

### AC-11 — Version bump & shipping artifacts

**Given** `package.json` and `index.ts` Server() literal are at `3.8.3`
**When** the implementation lands
**Then**:
- `package.json` `version` MUST be `3.9.0`.
- `index.ts` Server() constructor version literal MUST be `3.9.0`.
- `CHANGELOG.md` MUST have a `[3.9.0]` entry with sub-sections `### Added` (code-reviewer role + review_round counter + review_reports evidence), `### Changed` (sr → code-reviewer → qa chain replaces sr → qa direct edge; qa scope narrowed; constitution v3.9.0), `### Breaking` (in-flight `sr-engineer:In_Progress` tickets must be manually re-routed at upgrade; old direct edge to qa-engineer is rejected).
- `README.md` MUST gain a v3.9.0 section after the existing v3.8.3 block, renumbering subsequent letters per existing convention.
- `npm run build` MUST produce ZERO compile errors and refresh `dist/`.

### AC-12 — Tests (qa-engineer authored)

**Given** the existing test suite in `test/`
**When** the implementation lands
**Then** new tests MUST cover:
- Transition matrix: every new edge accepts the documented next-tuple set; every removed edge rejects with a structured `TRANSITION_REJECTED` error citing the new allowed list.
- `review_round` cap: `(code-reviewer, FAIL)` at `prev_review_round=3` yields `REVIEW_ROUND_EXCEEDED` unless next-tuple is `(pm, In_Progress)`.
- `computeNewRound` semantics for `review_round`: increments on FAIL, resets on PM re-entry, resets on handoff to qa-engineer.
- Evidence file: handoff `code-reviewer → qa-engineer` is rejected when `review_reports/review_<task-id>.md` is absent.
- Schema migration: a v(N-1) handoff fixture without `review_round` is upgraded to v(N) with `review_round=0`.
- The pre-existing test count (269 green at v3.8.3 per tasks.md T54) MUST stay green; new tests are additive.

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| agent_id_code_reviewer | `code-reviewer` | authored-here — new agent identifier; chosen over `reviewer` per user decision to disambiguate from GitHub PR-reviewer terminology |
| evidence_dir | `review_reports/` | authored-here — mirrors existing `qa_reports/` convention |
| evidence_file_template | `review_reports/review_<task-id>.md` | authored-here — verbatim mirror of qa-engineer's evidence path |
| handoff_marker_approved | `review: APPROVED` | authored-here — pending_notes marker enabling future grep/scriptable approval scans |
| handoff_marker_changes | `review: CHANGES_REQUESTED` | authored-here — symmetric to APPROVED for FAIL handoff |
| error_review_evidence_missing | `Code-reviewer evidence missing: write review_reports/review_<task-id>.md before handing off to qa-engineer.` | authored-here — error envelope hint (see AC-8) |
| migration_warning_inflight | `[code-reviewer migration] In-flight ticket detected at sr-engineer:In_Progress — next transition to qa-engineer will be rejected. Manually re-route to code-reviewer or roll back to pm.` | authored-here — one-shot stderr warning on first parse of pre-migration handoff (see AC-9) |
| error_review_round_exceeded | `REVIEW_ROUND_EXCEEDED` | authored-here — error code symmetric to `QA_ROUND_EXCEEDED` |

## Visual Tokens

N/A — this is internal MCP-server infrastructure; no UI surface introduced or changed.

## Out of Scope

- Parallel reviewer fan-out (correctness + security + style as separate agents) — deferred per research §A2.
- Self-review sub-agent inside sr-engineer — rejected per research §A1.
- Forcing a different model for code-reviewer vs sr-engineer — server cannot enforce; skill file MAY include a recommendation, but no tool-level gate.
- design-auditor relationship to code-reviewer (should reviewer re-check copy/tokens?) — out of scope; remains qa-visual's concern per existing v3.8.3 contract.
- teamwork-lite mode integration — explicitly excluded per user decision; lite remains untouched.
- Migrating in-flight tickets automatically. Operators drain manually per the AC-9 stderr warning.

## Dependencies / Prerequisites

- Research artifact `research/process-retrospective.md` (audited; user has read and made decisions on all open questions relevant to scope).
- Existing schema-versioning infrastructure (`schema/versions.ts`, `schema/migrations-*.ts`) from v3.4.0 — must be reused, not reinvented.
- Existing transition state machine in `tools/transitions.ts` — extended, not rewritten.
- Existing evidence-file mechanism in `tools/evidence-file.ts` for `qa_reports/` — paralleled for `review_reports/`.
- Resource Audit: no external URLs, Figma files, tickets, or design references in the source material. Research file is internal and fetched into the workspace. **No deferred references.**
