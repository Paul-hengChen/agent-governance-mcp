<!-- design-only:start -->
A third counter
`visual_round` (<!-- origin:start -->v3.14.0, <!-- origin:end -->§3.1) tracks pixel-fidelity iterations
separately from test-logic failures; it only ticks when `pending_notes`
contains `visual_fail:` and only fires when the workspace has a
`design/<active_feature>.md` whose `## Mode` is ≠ `no-design` (the v3.16.0
self-arming signal). An armed workspace missing the `## Visual Baselines`
section is blocked at PASS with `VISUAL_BASELINES_REQUIRED` rather than
silently passing through. Beyond `VISUAL_BASELINES_REQUIRED`, an armed
workspace also rejects PASS with `VISUAL_ASSERTIONS_REQUIRED` (design omits
`## Visual Structural Assertions`) or `VISUAL_REPORT_INCOMPLETE` (the report
fails the required-section / row / verdict schema) — see §3.1.

`design-auditor` fires when the coordinator detects a design source
(Figma / Sketch / XD / Penpot / mockup attachment / 設計稿 keyword) in the
incoming PRD / ticket / prompt. It extracts Copy / Strings + Visual
Tokens tables into `design/<feature>.md`; PM then copies those verbatim
into the spec. Tasks with no design reference skip the auditor entirely.
<!-- design-only:end -->
