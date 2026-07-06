# Review — T-PMC-01 (skill-pm-consolidation)

Task: behavior-preserving consolidation rewrite of `content/skill-pm.md` — lettered
SOP sub-steps (2a / 2a-bis / 2b / 7a) folded into a single **Gate Summary** table.
Base: uncommitted working tree vs `HEAD` (26e1a18). Reviewed change: `content/skill-pm.md` ONLY.
Contract: `specs/skill-pm-consolidation.md`. Reviewed in clean context (diff + spec + pinning
tests only; no qa_reports/ or pending_notes read).

## Round 1 — APPROVED — by code-reviewer

## Summary

- Single-file content rewrite: `content/skill-pm.md` grew 54 → 62 lines. The four lettered
  sub-steps collapse into one `gate | trigger | clearing action` table; top-level SOP is now
  plain integers 1–8 (no letter suffixes). Chain artifacts (`handoff.md`, `docs/backlog.md`,
  `tasks.md`, untacked `specs/skill-pm-consolidation.md`) changed too but are out of review scope
  — confirmed nothing else in the tree changed (`git status` shows exactly those 5 paths).
- Every S01–S22 pin verified against the PINNING SOURCES themselves (not just the spec): all 9
  `PM_RULE_MARKERS`, the cut-table header, widget-shape regexes, deferred-surface regexes,
  frontmatter, and both error codes are satisfied character-for-character.
- Behavior preserved: all seven gates' triggers + clearing actions, all three STOP/Blocked
  payloads, the design-link rule, feature-scoped cut re-arm, deferred-surface gate, and the
  backwards-compat clause all survive with exact semantics.
- Full suite green: `npm run build` OK, `npm test` = **812 pass / 0 fail**. Stripped body 2820 ~tok
  (≤ 2850 cap, 30-tok headroom). 4 balanced rationale fences; all markers survive `stripRationale`.
- Headline verdict: **APPROVED**.

## Correctness

Independent verification of every load-bearing claim (each checked against the pinning file, not the spec):

- **Byte-identical zones (AC-6)** — `diff` of HEAD lines 1–34 vs working-tree lines 1–34 is
  empty: frontmatter, Spec Schema (incl. Copy/Strings, Visual Tokens, Visual Widgets, Visual
  Structural Assertions bullets), and the Task Format code block are unchanged. This satisfies
  S05/S06/S09/S11–S16 (all in the Spec Schema zone) by construction. `content/skill-pm.md:1-34`.
- **PM_RULE_MARKERS (S01–S04, S05–S09)** — all 9 present verbatim AND all survive `stripRationale`
  (ran the stripper: `PM_RULE_MARKERS survive: true`, idempotent). Step anchors kept their exact
  number+token text: `1. \`tw_get_state\`` (L37), `3. **Resource Audit Gate**` (L39),
  `5. **Ambiguity Gate**` (L41), `8. \`tw_update_state` (L44). Matches `test/context-budget.test.mjs:45-56`.
- **Token cap (S10)** — stripped body = 2820 ~tok ≤ 2850 (`test/context-budget.test.mjs:281`). Verified.
- **Deferred-surface gate (S17)** — the five regexes from `pixel-perfect-design-coverage.test.mjs:82-92`
  all match the relocated Gate Summary "Visual State-Count Split" row (`content/skill-pm.md:52`):
  literal `Deferred-surface gate`, `Source manifest…contains rows with…status: deferred`,
  `Dependencies / Prerequisites`, `pointer + reason`, and the single-line
  `Backwards-compat…older…design…requires no action`.
- **Cut-table header (S18)** — `id | desc | depends_on | est. files | design-link` present verbatim
  at `content/skill-pm.md:62` (`cut-approval-gate.test.mjs:543`).
- **Frontmatter (S19)** — `recommended_model: sonnet` intact; body starts `# Skill: pm`
  (`skill-frontmatter.test.mjs:96-121`; the 12-skill-count guard unaffected).
- **Error codes (S20)** — `` `SCOPE_DECISION_REQUIRED` `` (L54) and `` `CUT_APPROVAL_REQUIRED` `` (L58)
  both remain backtick-mentioned.
- **Cross-file citations (S21/S22)** — gate NAMES `Resource Audit Gate` and `Geometric-Density Split
  Gate` survive, so `constitution.md:159` and `skill-design-auditor.md:88` still resolve by name.
- **STOP/Blocked payloads (AC-8)** — all three survive exactly, including em-dash U+2014
  (hexdump-confirmed `e2 80 94`): `PM blocked: copy missing source for <string id>`,
  `PM blocked: ambiguous — <detail>`, `PM blocked: design lacks Visual Structural Assertions`
  + `next_role: design-auditor`.

Behavior preservation — enumerated the old file's normative statements and confirmed each survives:

| gate / rule | old location | new location | semantics |
|---|---|---|---|
| Visual State-Count Split (>~8–10 states → surface-state tasks, shell/widgets first, record feature-split.md) | step 2a | Gate Summary row L52 | preserved |
| Deferred-surface sub-gate (pointer+reason under Dependencies) + backwards-compat no-op | step 2a | L52 | preserved |
| Geometric-Density Split (≥3 layers → sub-task split, shell first, same artifact, additive, non-design exempt) | step 2a-bis | L53 | preserved (see Quality note) |
| Scope Decision Gate (armed + no decision → `SCOPE_DECISION_REQUIRED`; clears via feature-split.md OR `scope_decision: "single-feature"`) | step 2b | L54 | preserved |
| Resource Audit Gate (grep list incl. `設計圖`/`Azure DevOps`/`JIRA`; classify each; no silent defer) | step 3 | L55 | preserved |
| Question Batch Gate (ONE AskUserQuestion, ≤4 / 2 batches, zero→no-op, record answers) | step 4 | L56 | preserved |
| Ambiguity Gate (STOP + Blocked payload; do not guess) | step 5 | L57 + L41 | preserved |
| Cut-Approval Gate (inline chat table NOT AskUserQuestion, HALT, `CUT_APPROVAL_REQUIRED` block, `cut_approved` only post-approval, design-link rule, feature-scoped re-arm) | step 7a | L58 + L62 header + L43/L44 | preserved |

No dropped payload, no dropped clearing artifact, no weakened trigger threshold. Only non-normative
motivational asides were shed (see Quality).

## Quality

- **`MUST` verb softened on Geometric-Density clearing action (non-blocking).** Old step 2a-bis read
  "you **MUST** recommend a sub-task split"; the Gate Summary cell (`content/skill-pm.md:53`) reads
  "Recommend a sub-task split". The obligation is preserved structurally — the table intro states
  "Work each row when its trigger holds" and the clearing action stays an imperative — and the
  *recording* MUST ("record it in `.current/feature-split.md` … before routing") is retained verbatim.
  The State-Count row's split action never carried an explicit MUST either, so the table treats
  split/recommend imperatives uniformly. No test pins the modal verb. Assessed as immaterial to
  behavior; noted for the record, not a change request.
- **Non-normative motivation dropped (acceptable).** Two "why" asides fell out: the 2a
  "large single targets made every QA round expensive / fix-A-break-B" clause and the 2b
  "forces an explicit split-or-attest decision" clause. Both are rationale, not rules or payloads;
  dropping them is within a behavior-preserving consolidation. The two SOP-embedded rationale
  *fences* (2a-bis, step 4) were correctly relocated into their table cells rather than deleted.
- **Version-tag suffixes dropped from Gate Summary names** (e.g. "Scope Decision Gate" vs old
  "Scope Decision Gate (v3.30.0)"). Safe: no test or cross-file citation pins the version suffix in
  a skill-pm gate name; S07/S08 and both external cross-refs pin the bare names, all present.
- Table is well-formed: no stray `|` leaked into any cell (the cut-table header lives on L62 outside
  the table, referenced as "quoted below this table"); rationale-fence interiors contain no pipes.

## Architecture

No `specs/skill-pm-consolidation-architecture.md` (single-file content change, none required). The
rewrite fits the stated design: one Gate Summary table as single source of truth, numbered SOP steps
pointing into it by name, schema/task-format zones frozen. Consistent with the just-shipped A6
`skill-qa-visual.md` consolidation precedent cited in the spec. No layering or separation concern —
this is governance prose, not server code; `git status` confirms zero changes under `tools/`,
`index.ts`, `schema/`, `guards/`, or `test/` (AC-1 non-target-diff constraint met).

## Security

N/A for a documentation-only change — no code, no inputs, no boundaries, no secrets. Second-pair-of-eyes
check on the diff surfaced nothing: no injected content, no external URLs added beyond the pre-existing
Figma canonical-URL *template* (`https://www.figma.com/design/<fileKey>/<name>?node-id=<node-id>`) which
is illustrative placeholder text carried over unchanged from HEAD.

## Performance

N/A — static skill text. One relevant observation in-scope for this role: the stripped dispatch body
is 2820 ~tok vs the 2850 cap (30-tok headroom), a net change from the pre-rewrite measurement well
within budget; the table format adds row/header overhead but the file stays under every pinned floor.
No algorithmic surface exists to regress.

## Verdict

**APPROVED** — every S01–S22 pin verified against its source test, all seven gates and three STOP
payloads preserved with exact semantics, byte-identical schema/task-format zones, 4 balanced
strip-safe rationale fences, and the full 812-test suite passes with zero non-target diff; the sole
observation (a softened `MUST` verb on the Geometric-Density clearing action) is immaterial and
non-blocking.
