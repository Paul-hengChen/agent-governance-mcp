# Spec: pixel-perfect-visual-compare (Phase 2 — Option B)

> Scope: implement Phase 2 of `research/visual-fidelity.md` — vision-LLM screenshot compare.
> Builds on Phase 1 (`pixel-perfect-design-coverage`, v3.8.1) which shipped the Source manifest + multi-pass auditor.
> Phase 3 (Playwright VRT) remains out of scope.

## Problem Statement

Phase 1 closed the *"frames silently dropped"* coverage gap by requiring an exhaustive Source manifest. It did **not** close the *"implementation paraphrased the design"* gap for **non-literal** visual properties: layout, spacing, alignment, element presence, and ~5px-grade positioning differences cannot be caught by the QA Visual Audit Gate's literal-grep approach (which only checks hex / sp / dp / weight tokens enumerated in `Visual Tokens`). Phase 2 adds a new QA sub-phase that consumes a **user-supplied baseline PNG** and **user-supplied implementation PNG** per surface, hands both to the QA agent's own multimodal vision, and surfaces visual differences as a structured diff in the review doc. Source-agnostic: works with Figma exports, Sketch / XD / Penpot exports, raw mockup PNGs, photos — anything the design source can produce as an image and anything the implementation can capture as a screenshot.

## User Stories

- As a **PM**, I want the auditor to declare baseline image paths in `design/<feature>.md` alongside the Source manifest, so QA has a manifest of what to compare without re-deriving it from prose.
- As a **QA agent**, I want a deterministic sub-phase that reads (baseline.png, impl.png) pairs and emits a structured diff into the review doc, so I can catch layout / spacing / alignment drift that the existing literal Visual Audit Gate cannot.
- As a **sr-engineer**, I want the visual diff appended to the review doc with concrete coordinates and element names, so I can act on the FAIL without a second QA round just to clarify what changed.
- As **anyone on a non-UI feature** (server logic, CLI tool, this MCP repo), I want Phase 1.5 to skip silently when no `Visual Baselines` section exists, so non-UI work pays zero overhead.

## Acceptance Criteria

- **AC-1 (Visual Baselines schema in design/<feature>.md)**
  Given a feature whose design produces comparable surfaces,
  When the auditor finishes,
  Then `design/<feature>.md` MAY contain a `## Visual Baselines` H2 section with a 4-column table `surface id | baseline path | impl path | notes`. `surface id` MUST match a row in *Source manifest*. `baseline path` MUST be a workspace-relative path to an image file (PNG / JPG / PDF page) that the design source produced. `impl path` MUST be a workspace-relative path (file or glob) where the QA agent expects the implementation screenshot to live at QA time. `notes` is free text.

- **AC-2 (QA Phase 1.5 fires only when Visual Baselines exists — skip policy)**
  Given QA Phase 1 has produced no Copy / Visual Audit failures,
  When QA proceeds toward Phase 2,
  Then QA MUST first check for a `## Visual Baselines` H2 in `design/<feature>.md`. If absent → log "Phase 1.5: skipped (no Visual Baselines declared)" in the review doc, proceed directly to Phase 2. If present → execute Phase 1.5 for each row.

- **AC-3 (Per-row compare contract)**
  Given a Visual Baselines row,
  When QA executes Phase 1.5 for that row,
  Then QA MUST: (a) Read both `baseline path` and `impl path` files via the Read tool; (b) request a structured diff from its own multimodal vision capability, prompted to enumerate *every* observable difference in (i) layout / position, (ii) spacing / alignment, (iii) element presence (missing or extra), (iv) color (where visually distinguishable), (v) text content (rendered string), and (vi) image content where the surface contains photos / icons; (c) append the result under a `## Phase 1.5 — Visual Compare` heading in `qa_reports/review_<task-id>.md`, with one sub-section per surface id.

- **AC-4 (Failure modes)**
  Given Phase 1.5 surfaces ≥ 1 difference,
  When QA classifies the difference,
  Then:
  - **Drift on a visual property** (e.g. button misaligned, color off, padding wrong) → FAIL back to sr-engineer with the diff list (same channel as Phase 1 Copy / Visual Audit drift). `tw_rollback_task` + `tw_update_state(status=FAIL, qa_review=<diff>, pending_notes=["QA: <task-id> Phase 1.5 FAIL — visual drift", "next_role: sr-engineer"])`.
  - **Missing baseline file** (the auditor's declared path does not exist on disk) → FAIL back to design-auditor: `tw_update_state(status=FAIL, qa_review=<missing path>, pending_notes=["QA: missing baseline — <path>", "next_role: design-auditor"])`.
  - **Missing impl file** (sr-engineer claimed "ready for QA" but the declared impl path is empty) → FAIL back to sr-engineer: `tw_update_state(status=FAIL, qa_review=<missing path>, pending_notes=["QA: missing impl screenshot — <path>", "next_role: sr-engineer"])`.
  - **No differences** → Phase 1.5 PASS sub-verdict; proceed to Phase 2 / 3 normally.

- **AC-5 (Source-agnostic)**
  Phase 1.5 MUST NOT mention Figma in the gating logic. The auditor populates `baseline path` from whatever its mode produced (Figma export, Sketch export, XD export, Penpot export, PDF page extracted to PNG, raw mockup file, photo). The QA SOP MUST work uniformly across all `Mode` values defined by `skill-design-auditor.md`.

- **AC-6 (Backwards-compat with v3.8.1)**
  Given a `design/<feature>.md` written under v3.8.1 (Source manifest present, no Visual Baselines section),
  When v3.8.2 QA runs,
  Then Phase 1.5 MUST skip silently (per AC-2). No retroactive migration of older audits. Phase 1 behavior unchanged.

- **AC-7 (Zero compile/type errors)**
  Phase 2 touches only markdown under `content/` and version literals. `npm run build` MUST pass with zero errors before handoff.

## Copy / Strings

No user-facing product copy is introduced. The feature modifies internal SOP markdown that ships as LLM context. Per spec schema, the literal SOP additions are recorded below as `authored-here` for traceability (Phase 1 review acknowledged this category as documentation-only; same applies here).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sop.auditor.visual-baselines.header | `**Visual Baselines** — OPTIONAL H2 section, present only when the design source produced comparable images. 4-column table: `surface id \| baseline path \| impl path \| notes`. `surface id` MUST match a Source manifest row. `baseline path` is workspace-relative to an image file the design source produced. `impl path` is workspace-relative to where the QA agent expects the implementation screenshot. Absence of this section = QA Phase 1.5 skipped silently.` | authored-here (new SOP text — implements AC-1) |
| sop.qa.phase15.header | `**Phase 1.5 — Visual Compare** (skip-if-absent): after Phase 1 PASS, before Phase 2. Read `design/<feature>.md` for a `## Visual Baselines` H2. If absent → log "skipped" and proceed to Phase 2. If present → for each row, Read baseline + impl PNGs and emit a structured diff (layout / spacing / alignment / element presence / color / text / image content) into `qa_reports/review_<task-id>.md` under a `## Phase 1.5 — Visual Compare` heading. Drift → FAIL to sr-engineer. Missing baseline → FAIL to design-auditor. Missing impl → FAIL to sr-engineer.` | authored-here (new SOP text — implements AC-2 + AC-3 + AC-4) |

## Visual Tokens

N/A — no UI or visual change. The feature edits markdown only.

## Out of Scope

- **Phase 3 (Playwright VRT)** — explicitly rejected in research §Alternatives Considered for setup cost reasons.
- **Auto-capture of implementation screenshots** — user picked "User-supplied paths"; QA does NOT invoke Playwright or any browser automation.
- **Auto-export of baselines from Figma/Sketch/XD/Penpot MCPs** — auditor populates `baseline path`; if it needs to call `figma.download_figma_images` during audit, that lives inside the auditor's existing SOP step 3 ("Extract"), not in this spec. Phase 2 only consumes paths.
- **Pixel-diff (non-vision) implementation** — explicitly rejected when scoping; vision-LLM diff is the chosen mechanism. Pixel diff belongs to Phase 3 / VRT tooling.
- **Server-side tw_visual_compare tool** — user picked SOP-only; no new TS code or tool registration.
- **Bumping baseline tolerance threshold** — vision LLMs have ~5px sensitivity (per research §3); precision tuning is out of scope.
- **i18n / locale-variant baselines** — one canonical baseline per surface; localization variants are deferred.

## Dependencies / Prerequisites

- **v3.8.1 (Phase 1)** — Source manifest + multi-pass auditor. Already shipped; provides the `surface id` foreign key Visual Baselines references.
- **research/visual-fidelity.md** — `index` (already in workspace; the research source).
- **content/skill-design-auditor.md** — must exist; primary edit target (adds Visual Baselines schema row to Artifact Schema H2 list).
- **content/skill-qa-engineer.md** — must exist; primary edit target (inserts Phase 1.5 sub-section).
- **No external references** require fetching. The research file's web citations (Gemini pricing, Figma REST API, Playwright) are background and NOT load-bearing for Phase 2 — vision capability is provided by the QA agent's host LLM, not via the Figma API.
- **Vision-capable QA host** — the QA agent's host must support multimodal image input (Claude / Gemini / GPT-class). Per `Document Priority`, workspaces with non-vision hosts will see Phase 1.5 fail-loudly (the Read tool will return image bytes but the vision step will produce gibberish) — acceptable: this is constitution §7 *Fail loud*. Soft fallback not in scope for Phase 2.
- **Version bump** — Phase 2 is a backwards-compatible SOP refinement (AC-6 guarantees v3.8.1 audits keep working). Ship as **v3.8.2** (patch).
- **Deferred surfaces** (from Phase 1 Source manifest) — N/A: this feature's `design/<feature>.md` is self-describing; the spec text IS the design. No design source to audit for this internal MCP work.
