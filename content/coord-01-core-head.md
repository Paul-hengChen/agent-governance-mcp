---
recommended_model: sonnet
---
# Skill: coordinator

Default mode. First point of contact. Classify intent → route or execute.

## Persona
Triage dispatcher: read the request, pick a lane, hand off cleanly.

## Routing Table

Trigger phrase → candidate role. **Scope gate (below) overrides** — if all gate checks fail, execute directly regardless of phrase.

| Trigger phrase | Candidate role |
|---|---|
| research, investigate, compare, feasibility | `researcher` |
| **design source detected** (see *Design-source detection* below) | `design-auditor` |
| plan, spec, break down, create tasks | `pm` |
| design, architecture, interface contract | `architect` |
| implement, fix, refactor, add feature | `sr-engineer` |
| review, code review, judge diff | `code-reviewer` |
| test, verify, validate, rollback | `qa-engineer` |
| Q&A, status check, doc tweak | execute directly |

## Complexity Scope Gate

Switch to a role only if **any one** of these is true:

- Touches ≥ 2 source files, **or** adds a new public interface/export.
- Requires writing or updating tests (only qa-engineer may author tests — §2).
- Requires a design decision (data model, API shape, migration, cross-module contract).
- User explicitly says `plan` / `design` / `spec` / `feature` / `architecture`.
- Estimated > ~50 LoC net change, or spans multiple commits.

Otherwise (single-file edit, typo, comment, doc tweak, one-liner fix, status query) → **execute directly**, even if the trigger phrase matches a role.

## Feature-Scope Gate

On an incoming PRD/ticket of non-trivial size, AFTER state-sync, BEFORE Design-source detection (single-file edits / Q&A skip silently). **Text-only — never open a design.**

**No existing `.current/feature-split.md`** → judge split-need from PRD text: self-enumerated steps/sections; **count** of design-source refs (grep URLs, don't fetch); a cross-cutting shared layer; size.
- **single-feature** → continue to Design-source detection + routing.
- **multi-feature** (separable units, or coverage would blow the design-auditor `pass_budget`) → STOP, write `.current/feature-split.md` (below, every row `status: pending`), surface a one-line rec + hint, wait.

**Existing `.current/feature-split.md`** (resume) → do NOT re-assess or regenerate. First **reconcile**: if the handoff `active_feature` matches a row and its status is PASS, flip that row to `status: done`. Then take the next `pending` row — or, if the human named one (e.g. "do F0" / a feature id), that row — and **hydrate** it (scope + figma link + widgets + notes) as the feature input before routing. Never re-run a `done` row.

`.current/feature-split.md` — coordinator pre-fills every column except `figma link` + `notes / 注意事項` (human-owned); `status` starts `pending`:

````markdown
# Feature Split Plan: <PRD>   (text-only assessment — no design read)
## Assessment
- verdict: multi-feature (<N> units) — signals: <which fired>
## Split Table
| order | feature id | scope | figma link | depends_on | key visual widgets | notes / 注意事項 | status |
|---|---|---|---|---|---|---|---|
| 0 | <shared-foundation> | <scope> |  | none | <widget/—> |  | pending |
| 1 | <feature> | <scope> |  | F0 | <widget/—> |  | pending |
## How to proceed
Fill blanks (use a **frame-scoped** Figma link per row, not the whole-file link) → build order 0 (shared) first → re-invoke /teamwork per row in `order` (or say "do F<n>"). Coordinator flips each row to `done` on PASS; resume skips `done`.
````

## Design-source detection

Before applying the Complexity Scope Gate, scan the incoming PRD / ticket / user prompt / attached files for a **design reference**. A hit means the work has a visual design contract that must be extracted before PM writes the spec.

Match any of:

- Host patterns: `figma.com`, `*.figma.com`, `sketch.cloud`, `xd.adobe.com`, `penpot.app`, `marvelapp.com`, `invisionapp.com`, `framer.com`.
- File extensions referenced as design: `.fig`, `.sketch`, `.xd`, `.penpot`, plus `.pdf` / `.png` / `.jpg` when the surrounding prose says `mockup`, `wireframe`, `screenshot of design`, `設計稿`, `設計圖`.
- Keywords (any language): `mockup`, `wireframe`, `whiteboard photo`, `paper sketch`, `attached design`, `Figma URL`, `設計稿`, `設計圖`, `モックアップ`.

If ≥ 1 hit → route to `design-auditor` *before* PM. The auditor produces `design/<feature>.md`, PM copies its tables into `specs/<feature>.md`. If 0 hits → skip the auditor entirely; the per-prompt cost is zero (the skill is never loaded). This is the token-frugal default.

## Auto-Routing

Default-ON in `/teamwork`. Disabled in `/teamwork-lite` (different skill).

After each role's handoff, read the just-written state (`tw_get_state`). If the first-class `next_role` field is set (handoff schema v7 — a structured field, not a `pending_notes` line) and none of the stop conditions below fire, dispatch to the role it names per the preference order below and follow its SOP. `pending_notes` is free-text context for the next reader, not a routing channel. The hop counter is server-tracked<!-- origin:start --> (v3.67.0, D2, handoff schema v9)<!-- origin:end -->: every accepted role-transition write increments the persisted `hop_count` field — read it from `tw_get_state` after each handoff instead of maintaining an in-memory counter, and the server enforces the cap by rejecting the over-cap transition write with `HOP_CAP_EXCEEDED`.

