# Post-mortem — Visual fidelity diverged structurally while every gate stayed green

> Recorded 2026-06-04. Origin: `oobe-setup-wizard` feature (agc-test-setup-wizard
> workspace). Surfaced by the human opening localhost, NOT by any pipeline gate.
> Status: **open — process fix wanted.**

## 1. Symptom

All 8 implemented OOBE screens (Language, Orientation, Mode, Mode Overview,
Network, Time, Consent, Summary) diverged from the Figma design at a
**structural / layout level**, not pixel-drift level. The human's words:
"幾乎是要回鍋重造的等級". Yet the chain state showed:

- `review: APPROVED` (code-reviewer, T18–T26)
- qa-engineer about to sign off on logic/string tests
- `visual_round: 0` — qa-visual had **never run**

Every gate that *did* run was green.

## 2. What actually diverged

Compared the running build against real Figma frames (file `mb8UaOE6OYac3BFWNB4PNh`):

| # | Gap | Evidence |
|---|-----|----------|
| 1 | **Root cause** — wizard rendered fluid full-width; Figma is a **fixed 1280×720 (16:9) stage**, main card fixed **984px**, 40px margins. One wrong foundational choice distorted all 8 screens. | Figma node `290:6616` → `layout_7VP0H5` width 1280 height 720; `main-container` `layout_QEMNXM` width 984 |
| 2 | Missing **Progress** indicator in sidebar (next to 184px Stepper) | Figma node `365:6308` (Progress, height 346) — absent in build |
| 3 | Missing / weak per-page **Header** block (Language page had no title at all) | Figma `290:6632` Header instance, centered, gap 24 |
| 4 | Page background should be `#2A2A2A`; card border `#666666` 2px + shadow md — build too dark, border too faint | `fill_B96136` `#2A2A2A`, `fill_QB5D8W` `#666666`, `vsds/sys/shadow/neutral/md` |
| 5 | **BUG**: stray ToggleSwitch rendered at bottom-left of sidebar on Network & Time pages | localhost screenshots |
| 6 | Naming inconsistency: Summary "Energy Star **Optimized**" vs Mode/Figma "Energy Star **Certified**" | screenshot 8 vs node `347:4891` text |
| 7 | Mode-card **description copy** not extracted into `design/…md` Copy/Strings (later patched) | `347:4891` focused-state TEXT nodes vs design doc |

Reusable / correct (NOT a rebuild): the 9 widgets, per-step logic, i18n, routing,
state, Mode-card copy. The rework is concentrated in the **layout/composition
shell**, not the ~2000 lines of widget/step logic.

## 3. Root cause — why every gate was green

The pipeline optimised for **tokens + logic + widget-shape correctness**, all of
which passed. **Layout-composition fidelity had no owner until the last optional
gate**, which had not run. Chain of misses:

1. **design-auditor** reads Figma **JSON node trees**, not rendered images.
   Colors/fonts/widget specs extract cleanly; *composition intent* ("this whole
   thing is a fixed 1280×720 centered stage") is nearly invisible in JSON and was
   not written into `design/oobe-setup-wizard.md`. The doc is token-centric.
2. **PM / architect** specified widgets + per-step logic, but the fixed-16:9-stage
   framing was never surfaced as a hard requirement. Constitution §1 **Visual
   Widgets** rule governs *widget shape* (no `<select>` smuggling) — it does **not**
   govern overall page composition.
3. **sr-engineer** received largely-correct tokens + logic + widget specs and built
   good widgets, then chose the natural default — fluid full-width — because nothing
   told them to lock a 1280×720 centered stage. Reasonable, but wrong.
4. **code-reviewer** judges **diff correctness in clean context** — no browser, no
   Figma compare. Code was correct *as code*, so it passed.
5. **qa-engineer** ran logic/string tests — logic was correct, so it passed.

No role ever compared **rendered pixels vs Figma** until the human did. That is
qa-visual's job (Phase 1.5), and `visual_round: 0` means it never ran.

**`visual_round = 0` is why the divergence was not CAUGHT; it is not why the
divergence is large.** The size comes from one un-owned foundational decision
(fluid vs fixed stage) cascading across 8 screens under all-green gates.

## 4. Process fixes to consider (for later correction)

1. **Promote visual check from optional last gate to an sr-engineer build-gate —
   but only the cheap half.** Two checks were conflated; they have very different
   token cost and must be scheduled separately:

   | | (A) Structure / geometry check | (B) Pixel / visual diff |
   |---|---|---|
   | Checks | fixed stage? canvas 1280×720? card 984px? sidebar structure? | per-screen alignment, spacing, color, exact pixels |
   | Method | **number-vs-number** (Figma root frame width/height vs the CSS) | screenshot + vision-model reasoning |
   | Token cost | **near-free** — one shallow (depth≈2) root-frame fetch, **no vision** | **expensive** — image tokens + reasoning per screen |
   | When | **screen 1, once** | **final qa-visual, once** |

   The original "save tokens, do visual once at the end" design refers to **(B)** —
   that is correct, **keep it**; per-screen pixel diff should not re-run every screen.
   This incident blew up on **(A)**, which **no role ran at all** (not even at the end,
   because `visual_round = 0`). (A) needs no vision and no qa-visual subagent — the
   sr-engineer fetches the root frame's dimensions once and asserts "am I building a
   fixed 1280×720 stage with a 984px card?" as a **build-gate assertion**.

   **Token math:** early (A) = one shallow frame fetch (fetch the *page* frame, e.g.
   `290:6616` at depth≈4 — NOT a component set, those are huge). Cost of skipping (A)
   = rebuilding 8 screens through sr-engineer + code-reviewer + qa twice. The early
   check is not extra burn; it is tiny one-time insurance against the most expensive
   failure (foundational rework) — same logic as type-checking despite having
   integration tests. **Net: the "expensive pixel diff once at the end" design stays
   intact; only a near-free geometry assertion is added up front.**
2. **design-auditor must capture composition, not just tokens.** Add a required
   "Layout / Canvas" section to `design/<feature>.md`: fixed vs fluid, root canvas
   dimensions, fixed container widths, margins, sidebar structure. Today the
   template has no home for this, so it silently drops.
3. **PM/architect: make canvas-framing a first-class spec field.** A "Fixed stage
   / responsive" decision belongs in the spec the same way Visual Widgets does.
4. **Gate ordering / blocking:** consider making qa-visual a *required* gate (not
   selectable-away) for any feature whose spec references a Figma/design source —
   tie it to the existing External-reference policy (Constitution §7).
5. **Empty-node honesty:** design-auditor marked Figma frame `483:82597` as
   `audited` although `get_figma_data` returns `nodes: []` for it. "audited" should
   not be assertable on an empty fetch — flag as `empty`/`unresolved` instead.

## 5. One-line lesson

Green gates measured everything except the one artifact that encodes layout intent
— the rendered design — so a structural divergence accumulated silently. Split the
Figma compare into a near-free **geometry assertion** up front (sr-engineer, screen 1,
no vision) and the existing **pixel diff** once at the end (qa-visual) — the
token-saving "visual once at the end" design stays intact; only the cheap foundational
check moves upstream. And give layout composition an explicit owner in design-auditor
+ spec.
