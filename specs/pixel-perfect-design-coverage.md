# Spec: pixel-perfect-design-coverage (Phase 1 — A1 + A2)

> Scope: implement Phase 1 of `research/pixel-perfect-and-design-coverage.md`.
> Phase 2 (vision-LLM compare) and Phase 3 (Playwright VRT) are out of scope.

## Problem Statement

The current `design-auditor` skill has two coverage gaps that let design details slip through to implementation: (1) the auditor's ≤ 250-line output + max-5-file-reads-per-surface limits force it to triage by "task-relevant frames" only, so frames the task description doesn't explicitly name are silently dropped into *Out of Scope*; (2) there is no explicit, source-agnostic manifest step that enumerates every surface in the design source up front, so neither PM nor downstream roles can tell whether something was deliberately deferred or just overlooked. Phase 1 closes both gaps with skill-markdown changes only — no server code, no extra API spend.

## User Stories

- As a **PM**, I want to see every surface the design contains classified as `audited / deferred / out-of-scope` before I write the spec, so I can list deferred surfaces under *Dependencies / Prerequisites* and the team knows what's not yet covered.
- As a **design-auditor agent**, I want explicit permission to run multiple audit passes (each within the 250-line cap) over a large design, so I don't have to choose between violating the line budget and silently dropping frames.
- As a **downstream role (architect / sr-engineer / qa-engineer)**, I want to read `design/<feature>.md` and know which surfaces were deferred (and why), so I don't implement against partial coverage by accident.

## Acceptance Criteria

- **AC-1 (Source manifest is exhaustive, source-agnostic)**
  Given a design source of any supported mode (`figma`, `sketch`, `xd`, `penpot`, `pdf`, `image`, `paper`),
  When the auditor runs,
  Then `design/<feature>.md` *Source manifest* MUST enumerate **every** surface in the source (Figma frame, Sketch artboard, XD artboard, Penpot board, PDF page, image file, photo file), each tagged with one of `status: audited | deferred | out-of-scope` and a one-line reason for `deferred` or `out-of-scope`.

- **AC-2 (Multi-pass audit is permitted and bounded)**
  Given a design whose audit cannot fit within 250 output lines,
  When the auditor runs,
  Then it MAY run additional passes (each ≤ 250 lines, each appending Copy / Strings + Visual Tokens rows to the same `design/<feature>.md`); each pass MUST flip at least one manifest entry from `deferred` → `audited`; the total number of passes per feature MUST NOT exceed 5 (anti-loop hard ceiling).

- **AC-3 (No-design mode unchanged)**
  Given no design source supplied,
  When the auditor runs,
  Then it writes the existing minimal `mode: no-design` artifact with an empty manifest — multi-pass and manifest gating do NOT apply.

- **AC-4 (PM Dependencies must list deferred surfaces verbatim)**
  Given `design/<feature>.md` exists and its *Source manifest* contains ≥ 1 entry with `status: deferred`,
  When PM writes `specs/<feature>.md`,
  Then the spec's *Dependencies / Prerequisites* section MUST list each deferred surface (pointer + reason) so the team has explicit knowledge that the feature ships without that surface covered.

- **AC-5 (Backwards compatibility)**
  Given an existing `design/<feature>.md` written before Phase 1,
  When any downstream role reads it,
  Then absence of a *Source manifest* MUST NOT block downstream work — older artifacts are treated as `status: audited` for whatever surfaces they listed and `status: unknown` for the rest. (No retroactive migration.)

- **AC-6 (Zero compile/type errors)**
  Phase 1 touches only markdown under `content/`. Build (`npm run build`) MUST pass with zero errors before handoff.

## Copy / Strings

No user-facing product copy is introduced. The feature modifies internal SOP markdown that ships as LLM context. Per spec schema, the literal SOP additions are recorded below as `authored-here` for traceability.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sop.auditor.manifest.header | `**Source manifest** — list each surface in the design source, exhaustively. One row per surface: `<medium> | <pointer> | <fetched? yes/no> | <status: audited \| deferred \| out-of-scope> | <reason if deferred or out-of-scope>`. Manifest MUST cover every Figma frame / Sketch artboard / XD artboard / Penpot board / PDF page / image file in the source — not just the ones referenced by the current task.` | authored-here (new SOP text — implements AC-1) |
| sop.auditor.multipass.header | `Multi-pass: if a single audit pass cannot cover every `status: audited` surface within the 250-line cap, you MAY run additional passes. Each pass appends to the same `design/<feature>.md` and MUST flip ≥ 1 manifest row from `deferred` to `audited`. Hard ceiling: 5 passes per feature (anti-loop, constitution §5).` | authored-here (new SOP text — implements AC-2) |
| sop.pm.deferred.gate | `If `design/<feature>.md` *Source manifest* contains rows with `status: deferred`, you MUST list each (pointer + reason) under the spec's *Dependencies / Prerequisites* section.` | authored-here (new SOP text — implements AC-4) |

## Visual Tokens

N/A — no UI or visual change. The feature edits markdown only.

## Out of Scope

- **Phase 2 (vision-LLM screenshot compare)** — separately evaluated; not in this spec.
- **Phase 3 (Playwright VRT)** — explicitly rejected in research §Alternatives Considered.
- **Server-enforced manifest gate** — `tw_update_state` will NOT validate the manifest in Phase 1; enforcement remains SOP-text only (matches existing Copy/Strings + Visual Tokens enforcement model). A future spec MAY promote it to a server guard.
- **Retroactive migration of old `design/*.md` files** — covered by AC-5 backwards-compat clause.
- **Constitution §5 anti-loop limit changes** — the 5-pass ceiling lives in skill text, not constitution. Research open question #4 deferred.
- **Bumping `design-auditor` per-surface file-read cap (A3 in research)** — researcher flagged token-bloat risk; explicitly excluded from Phase 1.

## Dependencies / Prerequisites

- **research/pixel-perfect-and-design-coverage.md** — `index` (already in workspace; the canonical research artifact this spec implements).
- **research/design-fidelity-enforcement.md** — `index` (already in workspace; prior research the new one builds on).
- **content/skill-design-auditor.md** — must exist; primary edit target.
- **content/skill-pm.md** — must exist; secondary edit target.
- **No external references** require fetching. The research file's `file://` links are workspace-internal; its web-research citations (Figma MCP, Gemini pricing, Playwright) are background for Phase 2/3 and not load-bearing for Phase 1.
- **Version bump** — Phase 1 is a constitutional artifact change consumed by every downstream workspace; ship as **v3.8.1** (patch — backwards-compatible SOP refinement; AC-5 guarantees existing audits keep working).
