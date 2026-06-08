# Research — A better design-to-code workflow: stop Figma drift & first-version rebuilds

> Topic owner: process improvement after the `oobe-setup-wizard` incident (2026-06-04,
> agc-test-setup-wizard workspace). Companion to `docs/postmortem-visual-fidelity-gate.md`
> and backlog `B7`. Depth: shallow (standalone researcher default).

## Summary

- **The gates that would have prevented this already exist in the codebase — they were
  simply never *armed*.** A complete visual-fidelity pipeline is implemented (design-auditor
  `## Visual Baselines`, sr-engineer Design-Aware Pre-Flight, qa-visual Phase 1.5,
  server-enforced `VISUAL_EVIDENCE_MISSING` gate, `visual_round` counter). The OOBE run
  shipped a design doc **without** a `## Visual Baselines` H2, so every visual gate
  silently passed through and `visual_round` stayed `0`. [T1]
- **The arming condition is opt-in and easy to omit.** The server arms the gate only when
  `design/<feature>.md` matches `/^##\s+Visual\s+Baselines\b/im`; absent → silent
  pass-through (by design, for non-UI work). A well-formed Figma design doc with no such H2
  looks complete but disables the entire visual chain. [T1]
- **Composition/layout intent has no owner.** The design-doc template captures Copy,
  Visual Tokens, and Visual Widgets — but has **no "Layout / Canvas" section**. The one
  decision that distorted all 8 screens (fixed 1280×720 stage vs fluid full-width) had
  nowhere to be recorded, so it was never specified, implemented, or checked. [T1]
- **The fix is cheap and matches Figma's own guidance.** Figma's REST/MCP guidance is a
  two-tier read: a sparse `get_metadata` structural pass first, then targeted detail —
  precisely the cheap "geometry assertion up front, expensive pixel diff at the end" split
  the postmortem recommends. The early geometry check needs **no vision model**. [T1]
- **Net recommendation:** don't build new machinery — **auto-arm the existing machinery**
  for any design-backed feature, add a mandatory Layout/Canvas capture, and add a near-free
  screen-1 geometry assertion to sr-engineer. The token-frugal "pixel diff once at the end"
  design is preserved.

## Evidence

### What already exists (own codebase — primary source)

- **design-auditor template** declares H2 sections `## Mode`, `## Source manifest`,
  `## Copy / Strings`, `## Visual Tokens`, `## Visual Widgets`, and `## Visual Baselines`
  *(marked OPTIONAL — "present only when the design source produced comparable images")*,
  `## Out of Scope`. No Layout/Canvas section exists. — `content/skill-design-auditor.md:18–26` [T1]
- **Server visual-evidence gate** arms only on a `## Visual Baselines` H2:
  `hasVisualBaselinesInDesign()` tests `/^##\s+Visual\s+Baselines\b/im`; absent or no design
  file → `{present:false}` → gate silent. — `tools/evidence-file.ts:133–148` [T1]
- When armed and evidence missing, PASS is rejected with `VISUAL_EVIDENCE_MISSING`
  ("…declares ## Visual Baselines but qa_reports/visual_<task-id>.md is absent…"). —
  `index.ts:710–754` [T1]
- **qa-visual Phase 1.5** fires only when that H2 is present; absent → logs
  "Phase 1.5: skipped (no Visual Baselines declared)" and proceeds. It does a Widget-Shape
  checklist + per-baseline pixel diff into `qa_reports/visual_<task-id>.md`. —
  `content/skill-qa-engineer.md:45–47`, `content/skill-qa-visual.md:5–53` [T1]
- **sr-engineer Design-Aware Pre-Flight (3a)** reads `design/<feature>.md`, the relevant
  `## Visual Widgets` rows, and the `## Visual Baselines` `baseline path`/`impl path` —
  i.e. it is scoped to *widgets and images*, **not** canvas/layout geometry, and reads
  nothing when no `## Visual Baselines` exists. — `content/skill-sr-engineer.md:14–18` [T1]
- **visual_round** bumps only on `(qa-engineer, FAIL)` carrying a `visual_fail:` token;
  cap 6 → forced rollback to pm. Independent of `qa_round`. — `tools/transitions.ts:327–376`,
  Constitution §3.1 [T1]
- **PM Resource Audit Gate** already greps `figma|sketch|mockup|設計圖|http(s)://…` and must
  classify each ref fetch/index/ignore; **architect** must list leftovers under
  `Deferred Resources` and block on unclassified refs. — `content/skill-pm.md:38–40`,
  `content/skill-architect.md:19,34` [T1]
- **Incident root cause** (8 screens diverged; all gates green; `visual_round=0`): Figma
  node `290:6616` shows fixed canvas `1280×720`, `main-container` width `984`; the build
  rendered fluid full-width. — `docs/postmortem-visual-fidelity-gate.md:18–104` [T1]

### External best practice (corroboration)

- **Figma-as-source-of-truth visual testing** compares the live build against the original
  mockup, not just a previous code baseline (Sauce Visual Figma plugin; Applitools Eyes
  flags only meaningful diffs). Confirms the missing step here is *build-vs-Figma*, which
  no role performed until the human did. — applitools.com/solutions/figma, saucelabs.com
  2026 tools roundup [T2]
- **Regression vs fidelity testing**: regression is binary (zero-diff), fidelity is a
  continuous similarity ratio that tolerates minor rendering noise — argues the end gate
  should be a *fidelity* check (threshold), not pixel-perfect equality. — animaapp.com
  "Scooby" design-to-code fidelity tool [T2]
- **Figma raw JSON "has precision but drowns the LLM in noise"; a full-page fetch can exceed
  the 25k-token MCP limit and truncate. Figma's remedy is `get_metadata` (sparse XML
  outline) to see structure cheaply, then `get_design_context` only on chosen nodes.**
  This is the official two-tier pattern and directly validates a cheap structural pass
  before any expensive detail/vision pass. — developers.figma.com REST API docs;
  blog.bytebytego.com "Figma Design to Code" [T1/T2]
- **MCP transforms pixel positions into layout relationships** ("centered inside its
  parent") — so composition *is* extractable from the API; the gap was a doc section to
  record it, not a tooling limit. — blog.bytebytego.com [T2]
- **Component visual test cases**: wrap each component's variants/states into an
  auto-layout frame so the design itself enumerates the states to verify — a low-cost way
  to define baselines designers maintain. — Nathan Curtis / EightShapes [T2]

## Recommendation

**Auto-arm the existing pipeline for every design-backed feature, add the missing
composition capture, and insert a near-free screen-1 geometry assertion. Five minimal,
diff-sized changes — no new subsystem.**

### Proposed workflow (changes mapped to existing roles)

1. **design-auditor — make the gate self-arming + capture composition** (`skill-design-auditor.md`)
   - When `## Mode` ≠ `no-design`, **`## Visual Baselines` becomes MANDATORY** (drop the
     "optional" wording). This single change arms the server gate, Phase 1.5, and
     `visual_round` automatically for every Figma/Sketch/XD feature.
   - Add a **new mandatory `## Layout / Canvas`** section: stage type (fixed `W×H` vs
     fluid/responsive), root canvas dimensions, fixed container widths, outer margins,
     column/grid structure, and persistent chrome (sidebar/header) structure. Populate it
     cheaply from a `get_metadata`/shallow `get_figma_data` pass over the root frame.
   - **Empty-node honesty:** a node whose fetch returns `nodes: []` must be marked
     `empty`/`unresolved`, never `audited` (the incident marked empty frame `483:82597`
     as audited).

2. **PM — promote canvas framing to a first-class spec field** (`skill-pm.md` Resource Audit)
   - When a design source exists, the spec's *Dependencies / Prerequisites* (or a new
     *Canvas / Stage* line) MUST carry the fixed-vs-responsive decision and root dimensions,
     copied verbatim from `## Layout / Canvas` — the same treatment Visual Widgets already
     gets. Removes the "fluid was a silent default" failure mode.

3. **sr-engineer — add a screen-1 Geometry Assertion build-gate** (`skill-sr-engineer.md` 3a)
   - Extend Design-Aware Pre-Flight: after the **first** screen/surface is built and before
     fanning out the rest, fetch the root frame's **metadata only** (sparse, no vision) and
     assert the implementation matches the `## Layout / Canvas` contract (stage fixed?
     container widths? margins?). Mismatch → fix the shell **now**, before screens 2..N
     inherit the error. This is the cheap (A) check; it is **not** a qa-visual run.

4. **qa-visual — unchanged, but now actually fires** (`skill-qa-visual.md`)
   - Keeps the expensive per-screen pixel/fidelity diff once at the end. Because step 1
     auto-arms `## Visual Baselines`, Phase 1.5 can no longer be silently skipped on a
     design-backed feature.

5. **Token economics — formalise the two-tier read** (rationale, not a rule change)
   - (A) **geometry assertion** = one shallow `get_metadata` root-frame fetch, number-vs-
     number, no vision → near-free; runs once at screen 1. (B) **pixel/fidelity diff** =
     vision, expensive → runs once at the end. This mirrors Figma's own
     `get_metadata`→`get_design_context` guidance [T1] and preserves the original
     "visual once at the end" token-saving intent. The early check costs one cheap fetch;
     skipping it cost a 8-screen rebuild.

**Why this option:** lowest cost / lowest risk — it activates machinery already written and
tested, rather than adding gates. The only genuinely new artifact is one doc section
(`## Layout / Canvas`) plus one assertion step. Effort ≈ wording edits to 3 skill files +
one optional sparse-fetch helper.

## Alternatives Considered

- **Make qa-visual a hard, always-on gate for all UI work (ignore the `## Visual Baselines`
  opt-in).** Rejected: it would force expensive vision diffs on features with no design
  source and break the backwards-compatible non-UI pass-through that the server gate was
  explicitly built to preserve (`evidence-file.ts:133–148`). Auto-arming *only when a design
  source exists* gets the safety without the blanket cost. [T1]
- **Run a full pixel diff on every screen as it's built (not just screen 1).** Rejected on
  token cost: vision diffs are the expensive half, and per-screen-during-build redundantly
  re-checks geometry that the cheap (A) assertion already locks. Fidelity testing literature
  treats the comprehensive diff as an end-of-cycle activity. [T2]
- **Rely on richer design-auditor token extraction alone (no sr-engineer assertion).**
  Rejected: even a perfect `## Layout / Canvas` section is only a *spec*; nothing verifies
  the build honoured it until something compares them. The screen-1 assertion is the
  verification step that closes the loop. [T1]

## Open Questions

- **Auto-arm scope:** should `## Visual Baselines` become mandatory for *all* non-`no-design`
  modes, or only raster-capable sources (figma/sketch/xd) where baseline images exist?
  Paper/whiteboard modes may have no comparable image — needs a PM/maintainer ruling.
- **Geometry assertion mechanics:** is a deterministic numeric assert (CSS/computed widths
  vs Figma dims) feasible in the sr-engineer harness without a browser, or does it need a
  headless render? If headless, it is no longer "free" and the cost trade-off shifts.
- **Threshold for the end fidelity diff:** what similarity ratio counts as PASS vs a
  `visual_fail:`? The literature favours a tolerance, not zero-diff, but the cap is
  currently undefined in `skill-qa-visual.md`. [T2]
- **Several best-practice citations are vendor blogs (T2).** No T1 standard governs
  design-to-code fidelity thresholds; the numeric tolerance recommendation rests on T2
  sources and should be validated against a real baseline run before being codified.

---

### Sources

- [Applitools — Visual Testing in Figma](https://applitools.com/solutions/figma/) [T2]
- [Sauce Labs — 20 Best Visual Testing Tools of 2026](https://saucelabs.com/resources/blog/comparing-the-20-best-visual-testing-tools-of-2026) [T2]
- [Anima — Scooby: regression & fidelity testing](https://www.animaapp.com/blog/design-to-code/scooby-open-source-regression-and-fidelity-testing/) [T2]
- [Figma Developer Docs — REST API](https://developers.figma.com/docs/rest-api/) [T1]
- [ByteByteGo — Figma Design to Code, Code to Design](https://blog.bytebytego.com/p/figma-design-to-code-code-to-design) [T2]
- [Nathan Curtis / EightShapes — Component Visual Test Cases](https://medium.com/eightshapes-llc/component-visual-test-cases-e501e2d21def) [T2]
- Own codebase (primary, [T1]): `content/skill-design-auditor.md`, `skill-qa-visual.md`,
  `skill-qa-engineer.md`, `skill-sr-engineer.md`, `skill-pm.md`, `skill-architect.md`,
  `tools/evidence-file.ts`, `tools/transitions.ts`, `index.ts`,
  `docs/postmortem-visual-fidelity-gate.md`
