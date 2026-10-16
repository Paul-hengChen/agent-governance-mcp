<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E288-01 [P1] sr-engineer: skill-integrator Stage 0 (optional ticket cut; Task-dispatched PM writes only specs/ticket-cut-<feature>.md, no tasks.md, no write-type tw_*; approved with manifest at Stage 2), Work overview + Lifecycle row 0, invocation stages 0–3, Stage 1 Input line, Stage 2 one-approval sentence, Permissions row, D3 hand-off note (Background/Current state/To do/Not to do); skill-pm Gate Summary row "Integrator Stage 0 cut"; verbatim Copy literals; skill-pm ≤ approved ceiling; no edit in Mid-wave base fix or Stage 6 (AC-E288-1..8) | depends_on: none
- [x] T-E323-01 [P2] sr-engineer: add the qa.resident-hygiene convention line as SOP step 6 sub-item f. in content/skill-qa-engineer.md, verbatim, nothing else in that file (AC-E323-3) | depends_on: none
- [x] T-E288-02 [P1] qa-engineer: new test/e288-integrator-stage0.test.mjs (AC-E288-1..6 + negative control); re-pin skill-pm cap in test/context-budget.test.mjs to exact measured value ≤ approved ceiling (AC-E288-7); confirm compose goldens unchanged, regen+explain only if red; re-pin-only files only if red | depends_on: T-E288-01
- [x] T-E323-02 [P2] qa-engineer: e178a historical fixed-base test (BASE_SHA 3c72a83) → structural one-paragraph grant assertion (AC-E323-1); e296 AC10 base-vs-HEAD render (c392cc3) → frozen-manifest structural assertions, drop w2 control (AC-E323-2); qa-engineer.md byte cap re-pin in test/qa-visual-skill-split.test.mjs only under human decision D1 (AC-E323-4); final full suite on committed HEAD (AC-LANE-2) | depends_on: T-E323-01, T-E288-01
