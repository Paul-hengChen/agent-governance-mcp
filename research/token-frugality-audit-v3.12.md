# Token-Frugality Audit — v3.12

> Sr-engineer assessment — 2026-05-28
> Scope: `content/constitution.md` + 13 `content/skill-*.md` files. 580 lines total.
> Mandate: identify (a) lines that restate constitution rules inside a skill, (b) redundant padding, (c) per-file before/after counts. Constitution §1 forbids skills from restating constitution rules; this audit enforces that.

## Methodology

- **Restatement scan**: for every skill file, grep for keywords whose normative claim already lives in the constitution: `tw_get_state` + `tw_detect_drift` instruction prose (§3), `zero errors` / `ZERO errors` (§2 build gate), `Report drift before proceeding` (§3 drift check), `Skills inherit everything below` (§1 meta), `next_role:` prose (§4), `(constitution §X)` parenthetical pointers, anti-loop count thresholds (§5).
- **Operational vs restated**: a *step instruction* (`1. tw_get_state → tw_detect_drift`) is operational and stays. A *rule explanation* (e.g. "Report drift before proceeding" appended to the step, when §3 already says this) is restated padding.
- **Padding heuristic**: any inline rationale longer than the rule itself is a candidate; verbatim incident narratives (cde-oobe shipped X, the cde-oobe rollout, etc.) are kept once but de-duplicated when the same incident is cited in multiple places.
- **Preservation rule**: schemas, role-unique hard rules, gates, and behavioural verdicts are NEVER cut. Cuts are limited to explanatory prose whose normative content already lives elsewhere.

## Per-File Findings

### content/constitution.md
- **Before**: 91 lines.
- **Findings**: clean — §1 establishes the inheritance contract; §6 covers both `.env*` access-deny AND dependency audit (v3.9 eval's two flagged Security gaps both addressed in v3.10+). No restated text (it is the source).
- **Padding candidates**: zero — every line carries a unique normative rule.
- **After (target)**: 91 lines. NO CHANGE.

### content/skill-architect.md
- **Before**: 26 lines.
- **Restated constitution lines** (DELETE candidates):
  - L20: `tw_get_state → tw_detect_drift. Report drift before proceeding.` — the "Report drift before proceeding" tail restates §3 drift-check rule. KEEP the call sequence, DROP the trailing sentence.
- **Padding candidates**:
  - L23 tail: `Constitution §7 forbids unilateral defer.` — pointer to §7 is fine but the sentence is editorial; the gate itself is operational. KEEP the gate; DROP the editorial pointer.
- **Adds**: new `## Decision Records` H2 between Sequence Diagram bullet and Deferred Resources bullet (T81 — required by spec). +3 lines.
- **After (target)**: ~27 lines (net +1 after additions).

### content/skill-code-reviewer.md
- **Before**: 42 lines.
- **Findings**: schema-heavy; Performance section already added in v3.11; clean-context rule is role-unique.
- **Restated constitution lines**: none material.
- **Padding candidates**:
  - L11 long parenthetical `(the writer/reviewer separation is structural per industry consensus — different model = different blind spots)` — editorial. Can compress to one short clause.
- **After (target)**: ~41 lines.

### content/skill-coordinator.md
- **Before**: 60 lines.
- **Restated constitution lines** (DELETE candidates):
  - L23-26: `Multi-phase implementation flows the full chain pm → architect → sr-engineer ↔ code-reviewer → qa-engineer. Mid-cycle loops do not require coordinator triage — each role's pending_notes declares next_role: for the next hop.` — restates §4 routing diagram AND §4 next_role rule. DROP both sentences.
  - L59: `Each role's pending_notes should begin with next_role: <name> so you know the next hop.` — same restatement; drop.
- **Padding candidates**:
  - L55 `Skip state sync for: Q&A, doc edits, status checks. Go straight to step 3.` — operationally useful; KEEP.
- **After (target)**: ~56 lines.

### content/skill-coordinator-lite.md
- **Before**: 33 lines.
- **Findings**: most token-sensitive file (loaded every solo session per CLAUDE.md hook).
- **Restated constitution lines**: none — the "server-read-only" rule is lite-specific and not in constitution.
- **Padding candidates**:
  - L13 parenthetical `(tools/transitions.ts)` — internal pointer, useful for debugging. KEEP.
  - L15 long sentence `The reviewer gate is a multi-context separation tool; lite is solo-dev same-context work where it is structurally meaningless.` — explains *why* in a single line; KEEP (the why prevents agents from re-introducing the gate).
- **After (target)**: 33 lines. NO CHANGE — already token-frugal.

### content/skill-design-auditor.md
- **Before**: 50 lines.
- **Findings**: schema-heavy; multi-pass cap explicitly references §5.
- **Restated lines**: L13 `Hard ceiling: 5 passes per feature (constitution §5 anti-loop).` — pointer-style reference, acceptable per audit convention (a `(§X)` parenthetical is shorter than restating the rule). KEEP.
- **Padding candidates**: L26 `Report drift before proceeding.` — same pattern as other SOPs; DROP trailing sentence.
- **After (target)**: ~49 lines.

### content/skill-doc-writer.md
- **Before**: 33 lines.
- **Findings**: side-channel skill, role-unique behavior. Side-channel constraint (L12) is critical and not restated anywhere else.
- **Restated lines**: none material.
- **Padding candidates**: none — file is already tight.
- **After (target)**: 33 lines. NO CHANGE.

### content/skill-pm.md
- **Before**: 38 lines.
- **Restated constitution lines** (DELETE candidates):
  - L32 `tw_get_state → tw_detect_drift. Report drift before proceeding.` — trailing sentence restates §3. DROP.
- **Padding candidates**:
  - L18 trailing parenthetical incident narrative: `(cde-oobe shipped "Select your language" because nobody pinned the Figma title "Language" in this section).` — concrete incident, useful for agent understanding; KEEP but compress.
  - L19 same pattern: `an unsourced hex slipping into OobeTheme.kt is exactly the kind of silent drift that ate the cde-oobe rollout.` — duplicate incident reference; compress to a short clause.
- **After (target)**: ~37 lines.

### content/skill-qa-engineer.md
- **Before**: 66 lines.
- **Restated constitution lines** (DELETE candidates):
  - L23 `tw_get_state → tw_detect_drift.` — operational, KEEP. (No trailing "Report drift" sentence here — already tight.)
- **Padding candidates**:
  - L33 `Rationale: stylistic ACs (font, color, position) pass without catching paraphrased prose. The Copy Audit Gate is the only step that compares rendered text to the design contract.` — useful one-line WHY; KEEP.
  - L40 `Rationale: stylistic ACs only verify what the spec already enumerates. Without an explicit "every concrete literal must be sourced" gate, an unsourced hex / dp / sp / weight slipping into theme files goes undetected (this is the failure mode that drove the cde-oobe Figma re-alignment cycle). Layout proportions and platform defaults are out of scope for this gate by design — only literal-valued tokens are checked.` — verbose and duplicates rationale from L33 + PM L19. COMPRESS to single sentence.
- **After (target)**: ~64 lines.

### content/skill-qa-visual.md
- **Before**: 19 lines.
- **Findings**: already minimal; lazy-loaded sub-skill; rationale at L19 explains role boundary.
- **Padding candidates**: none.
- **After (target)**: 19 lines. NO CHANGE.

### content/skill-release-engineer.md
- **Before**: 52 lines.
- **Findings**: each Hard Rule is operationally load-bearing and unique to this role; HEREDOC rule, no-force-push rule, side-channel rule have no constitutional equivalent.
- **Restated lines**: none material.
- **Padding candidates**: none — every line carries unique normative weight.
- **After (target)**: 52 lines. NO CHANGE.

### content/skill-researcher.md
- **Before**: 40 lines.
- **Findings**: depth control + credibility tier + recency gate — all v3.11 additions; all role-unique.
- **Restated lines**:
  - L36 `tw_get_state → tw_detect_drift. Report drift before proceeding.` — DROP trailing sentence.
- **Padding candidates**: none beyond above.
- **After (target)**: ~39 lines.

### content/skill-sr-engineer.md
- **Before**: 30 lines.
- **Findings**: tight; every SOP step is a unique gate or instruction.
- **Restated lines**:
  - L8 `tw_get_state → tw_detect_drift. Report drift before proceeding.` — DROP trailing sentence.
- **Padding candidates**: none.
- **After (target)**: ~29 lines.

## Security Coverage (§6 review)

The v3.9 evaluation flagged §6 for two gaps:

1. **OWASP-level guidance** — sr-engineer L13-16 Security Checklist already enumerates the three OWASP categories that matter for an MCP/Markdown workspace (hardcoded secrets, input validation at boundaries, injection vectors SQL/command/XSS/path-traversal). The code-reviewer's Security section (L22) mirrors them as the second-pair-of-eyes check. Constitution §6 itself stays minimal (one access-deny rule + one dependency-audit rule); the checklist lives where it executes — at the role level. **Coverage: COMPLETE. No constitution edit required.**
2. **Dependency audit** — already added to §6 as the second bullet in v3.10. `npm audit --audit-level=high` / `cargo audit` / `pip-audit` is enforced at every role's build gate, with HIGH/CRITICAL findings treated as build failures unless explicitly waived in the PR description. **Coverage: COMPLETE.**

The remaining v3.9-flagged "no Agent Identity Binding" and "no Observability" items are architectural concerns about the MCP protocol itself, not constitution gaps; they are listed in `research/honest-evaluation.md` as known protocol-level limitations, not solvable by adding constitution rules. **No additional Security rules will be added in this release.**

## Aggregate

| File | Before | After (target) | Delta |
|---|---|---|---|
| constitution.md | 91 | 91 | 0 |
| skill-architect.md | 26 | 27 | +1 (ADR addition) |
| skill-code-reviewer.md | 42 | 41 | -1 |
| skill-coordinator.md | 60 | 56 | -4 |
| skill-coordinator-lite.md | 33 | 33 | 0 |
| skill-design-auditor.md | 50 | 49 | -1 |
| skill-doc-writer.md | 33 | 33 | 0 |
| skill-pm.md | 38 | 37 | -1 |
| skill-qa-engineer.md | 66 | 64 | -2 |
| skill-qa-visual.md | 19 | 19 | 0 |
| skill-release-engineer.md | 52 | 52 | 0 |
| skill-researcher.md | 40 | 39 | -1 |
| skill-sr-engineer.md | 30 | 29 | -1 |
| **Total** | **580** | **570** | **-10 lines (-1.7%)** |

**Note**: the spec's `≥ 5% reduction` (≥ 29 lines) target was based on an a-priori guess. After full audit, the actual restated/padded content is ~10 lines. The remainder of the corpus is genuinely load-bearing — every line either: (a) defines a unique role behavior, (b) specifies a schema field, (c) names a verdict path, or (d) cites a concrete failure incident that prevents agent regression. The spec's 5% floor was aspirational; the audit's honest finding is 1.7%. The audit recommends accepting the 10-line reduction and treating the remaining 570 lines as token-justified.

Per constitution §7 *Fail loud*: this audit reports the actual frugality ceiling rather than meeting the spec's optimistic target by deleting load-bearing content. PM may either (a) accept the 1.7% reduction and unblock v3.12, or (b) re-spec a more aggressive cleanup that the audit explicitly does not endorse.
