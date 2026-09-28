# Spec: gate-registry

## Problem Statement

Gate definitions — error code, trigger edge, arm condition, clearing artifact,
hint text — currently exist in triplicate for every one of the ~17 gate
error codes the server enforces (`TRANSITION_REJECTED`, `QA_ROUND_EXCEEDED`,
`REVIEW_ROUND_EXCEEDED`, `VISUAL_ROUND_EXCEEDED`, `AGENT_ID_REQUIRED`,
`SCOPE_DECISION_REQUIRED`, `CUT_APPROVAL_REQUIRED`, `MISSING_EVIDENCE`,
`VISUAL_BASELINES_REQUIRED`, `VISUAL_EVIDENCE_MISSING`,
`VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_ASSERTIONS_REQUIRED`,
`VISUAL_REPORT_INCOMPLETE`, `VISUAL_PROVENANCE_MISSING`,
`BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`,
`PIXEL_GATE_ATTESTATION_MISSING`): (1) code —
`tools/transitions.ts` (the routing-edge gates) and `tools/evidence-file.ts` /
`tools/handoff-orchestrator.ts` (the value-add gates: scope-decision,
cut-approval, the seven visual sub-gates, QA/code-review evidence); (2) prose
— constitution §3.1/§3.2 (`content/const-06..11*.md`, tagged `chain` /
`chain-design` per `prompts/constitution-manifest.ts`); (3) prose again — the
per-role skill files that reference these gates inline
(`content/skill-qa-engineer.md`, `content/skill-sr-engineer.md`,
`content/skill-pm.md`, `content/skill-code-reviewer.md`). All three copies
drift independently. `test/error-code-contract.test.mjs` (backlog A5) only
*detects* divergence after the fact via regex-scanning code and
backtick-quoted doc tokens — it cannot prevent a hint string from silently
diverging between `handoff-orchestrator.ts`'s literal text and the
constitution's hand-authored paraphrase of that same text.

Separately, `tools/evidence-file.ts` (994 lines) has grown from "file-mode QA
evidence write/check" into gate-central: 15 `has*`/`check*`/`validate*`
predicates — QA evidence, code-review evidence, visual-baseline arming, five
of the seven visual sub-gate checks, scope-decision, cut-approval — all in
one file, each consumed by a different `tools/handoff-orchestrator.ts` gate
check. This is backlog ticket A2, independently scoped but touching the same
import surface this ticket must already rewire.

## Fold-In Decision — A2 (`evidence-file.ts` split) folded into this feature

**Decision: fold A2 in.** Both tickets touch the identical call-site
surface: `tools/evidence-file.ts`'s predicate exports, imported by
`tools/handoff-orchestrator.ts` and (for the arm-signal helper) by
`prompts/build.ts`. If A2 shipped first as a pure file-split, its per-gate
modules (`gates/qa-review.ts`, `gates/code-review.ts`, `gates/visual.ts`,
`gates/cut-approval.ts`, `gates/scope-decision.ts`) would need every import
site touched once; this feature would then touch the same sites again to
wire in the new registry. Doing both in one pass means each call site is
edited exactly once, and — per the backlog's own 2026-07-07 revision note —
"one QA round" covers both instead of two. The natural module boundary A2
proposes (one file per gate) is also the natural home for this ticket's
per-gate registry slices: a `gates/scope-decision.ts` module is the obvious
place for both the `SCOPE_DECISION_REQUIRED` predicate AND its
`GateDefinition` registry entry to live side by side. Splitting the work
into two rounds would not reduce risk — the same lines move either way —
it would only double the review surface.

This decision is attested here (PM, single-feature scope) rather than via
`.current/feature-split.md`, because the Scope Decision Gate does not arm
for this feature (no `design/<feature>.md` exists — see Dependencies /
Prerequisites) and there is no design-armed multi-surface split to record.
Recording the attestation explicitly (matching the `drift-baseline-exemption`
precedent) makes the decision auditable even though the server does not
require it here.

## User Stories

- As a maintainer adding a new gate, I want to define it once (error code,
  trigger edge, arm condition, clearing artifact, hint text) and have code,
  constitution prose, and skill prose all derive from that one definition,
  so that a new gate cannot ship with mismatched documentation.
- As a maintainer changing an existing gate's hint text, I want the change
  to propagate to every consumer (code error message, constitution table,
  skill excerpt) from a single edit, so drift between "what the server says"
  and "what the docs say" becomes structurally impossible instead of merely
  detectable.
- As a contributor reading `tools/evidence-file.ts`, I want gate predicates
  grouped by the gate they implement (not all 15 predicates in one
  994-line file), so a change to one gate's parsing logic cannot
  accidentally entangle with another's.
- As a qa-engineer running the test suite, I want the error-code contract
  test to fail the moment a gate's registry entry, code emit-site, or
  rendered doc fragment diverge, so the check is generative (a real
  guarantee) rather than a coincidental regex match.

## Acceptance Criteria

**AC-1 — Single structured source of truth**
Given the shipped feature, when a contributor inspects the codebase, then
exactly one module (e.g. `gates/registry.ts`) defines, for every gate in the
current 17-code catalog (enumerated in Dependencies / Prerequisites), its
`errorCode`, `triggerEdge` (the prev/next agent+status pattern or edge
description the gate fires on), `armCondition` (description, naming the
existing predicate where one exists), `clearingArtifact` (what satisfies the
gate), and `hintTemplate` (the exact hint text, lifted verbatim from
today's code — no new wording).

**AC-2 — Code consumes the registry; error text is byte-for-byte preserved**
Given a client triggers any of the 17 existing gate rejections, when the
server responds, then the emitted error code, JSON envelope shape
(`{error, attempted, allowed, hint}` for transitions.ts-sourced rejections;
the existing plain-text `⛔ CODE: message` shape for handoff-orchestrator.ts
literal-text gates), and hint text are byte-for-byte identical to
pre-refactor behavior. Regression proof: every existing gate test file
(`cut-approval-gate`, `baseline-manifest-gate`, `pixel-gate-attestation`,
`visual-evidence-gate`, `visual-widgets-unverified-gate`,
`visual-round-transitions`, `feature-scope-gate`, `qa-flow`) passes with its
assertions unmodified — only import paths may change.

**AC-3 — Constitution gate prose is generated, not hand-authored, and unchanged**
Given `composeConstitution({chain: true, design: true})`, when computed
post-refactor, then its output is byte-for-byte identical to the current
golden baseline (`test/fixtures/compose-golden/constitution-monolith.txt`)
for every span, including the gate-table spans currently hand-authored in
`content/const-06-chain-31-head.md`, `const-07-design-chain-gates.md`,
`const-08-chain-31-mid.md`, `const-09-design-chain-vround.md`, and
`const-11-design-chain-32.md`. Those spans now render from
`gates/registry.ts` (mechanism — build-time generator vs. runtime template —
is an architect decision per Dependencies / Prerequisites) but produce
identical bytes.

**AC-4 — Skill "gates you must clear" excerpts render from the registry**
Given a role skill file that references a gate's error code inline today
(`skill-qa-engineer.md`, `skill-sr-engineer.md`, `skill-pm.md`,
`skill-code-reviewer.md` — see Dependencies / Prerequisites for the exact
excerpts), when the skill is composed for a role prompt (`tw_switch_role` /
the corresponding MCP prompt), then the gate-related excerpt text is sourced
from the same registry entry AC-1/AC-3 consume, so a gate's error code, arm
condition, or clearing description can never diverge between code,
constitution, and skill again. Rendered text is unchanged from today's
hand-authored prose (no new/removed information).

**AC-5 — Contract test becomes generative, not scan-based**
Given `test/error-code-contract.test.mjs` (rewritten or replaced), when run,
then it imports `gates/registry.ts` and asserts parity by construction
against code emit-sites and rendered doc fragments — not by regex-scanning
`content/*.md` for backtick-quoted tokens. The rewritten test still fails if
any of the 17 gates' code emit-site, hint text, or rendered fragment drifts
from its registry entry, and passes green on introduction (no gate dropped
or added by this refactor: 17 in, 17 out).

**AC-6 — `evidence-file.ts` split into `gates/` modules (A2 folded in)**
Given the post-refactor tree, when `tools/evidence-file.ts` is inspected,
then it contains only shared read/write plumbing (path helpers, section
slicing, file I/O common to multiple gates) — the 15 `has*`/`check*`/
`validate*` predicates it exports today live in per-gate modules under
`gates/` (suggested boundaries: `gates/qa-review.ts`, `gates/code-review.ts`,
`gates/visual.ts`, `gates/cut-approval.ts`, `gates/scope-decision.ts`, per
backlog A2 — architect may refine), each importing only its own slice of
`gates/registry.ts`. Every existing caller (`tools/handoff-orchestrator.ts`,
`prompts/build.ts`) is updated to the new import paths with no behavior
change.

**AC-7 — Frozen check order is unchanged**
Given `tools/handoff-orchestrator.ts`'s `tw_update_state` gate sequence,
when the refactor lands, then the execution order documented at the top of
that file — preflight → PASS/qa-engineer gate → transition validation →
scope-decision gate → cut-approval gate → QA evidence record → PASS evidence
gate → visual sub-gates (in their existing 7-step sub-order) →
code-reviewer evidence gate → round-cap sentinels → `storage.writeState` →
PASS RAG GC hook — is unchanged: no reorder, no merge, no early-return
removal (carries forward `qa-flow-enforcement-architecture.md` AC-5/AC-8
verbatim).

**AC-8 — No schema/version-field change**
Given `.current/handoff.md`, `.current/.config.json`, `tasks.md`, and the
SQLite schema, when this feature ships, then none of the four
`schema_version` constants change — this is a code/content refactor with no
new persisted field and no new data model.

## Copy / Strings

This feature does not author new user-facing copy — its entire goal is
byte-for-byte preservation of existing gate error codes, hint text, and
constitution/skill prose (AC-2/AC-3/AC-4), now sourced from one place instead
of three. The "copy" is the existing corpus being centralized, not new text.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01 | All 17 existing gate error codes (`TRANSITION_REJECTED` … `PIXEL_GATE_ATTESTATION_MISSING`, full list in Dependencies / Prerequisites) | authored-here — pre-existing, unchanged; extract verbatim from `tools/transitions.ts` / `tools/evidence-file.ts` / `tools/handoff-orchestrator.ts` at implementation time. Do NOT retype from memory — copy the literal string from source. |
| S02 | Every hint/message string currently emitted alongside those 17 codes | authored-here — pre-existing, unchanged; same extraction rule as S01. |
| S03 | Every gate-table bullet currently in `content/const-06..11*.md` (§3.1/§3.2) | authored-here — pre-existing, unchanged; the generated fragment must byte-match the current file (AC-3). |
| S04 | Every gate-referencing excerpt currently in `skill-qa-engineer.md` / `skill-sr-engineer.md` / `skill-pm.md` / `skill-code-reviewer.md` | authored-here — pre-existing, unchanged; the generated excerpt must byte-match the current file (AC-4). |

## Visual Tokens

N/A — no visual surface. Server-gate + governance-text + code-organization
feature only.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — governance-text/code-only feature |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions

N/A — no `design/<feature>.md` exists; no design mode is armed for this
feature (confirmed: no `design/gate-registry.md` in the repo).

## Out of Scope

- **Data-fying `ALLOWED_TRANSITIONS` itself.** The routing-edge graph in
  `tools/transitions.ts` is already structured data (a `Map`); this ticket
  centralizes each edge's error code / hint text into the shared registry
  but does not rewrite the graph's shape or its `validateTransition` logic.
- **SQLite/HTTP-mode gate parity.** `CUT_APPROVAL_REQUIRED` is already
  file-mode-only by design (backlog C2); this ticket does not extend or
  change any gate's storage-mode scoping.
- **New gates or error codes.** This is a provenance refactor of the
  existing 17-gate catalog, not a feature addition. Any gate proposed while
  implementing this ticket goes through the normal PM flow as its own
  ticket, landing in `gates/registry.ts` going forward.
- **A11** (escalation-route tables + WHEN/DO/ELSE grammar) and **A12**
  (shared SOP partials + Limits registry) — related, adjacent backlog
  tickets; not folded in here. A11/A12 may reuse this ticket's
  `gates/registry.ts` pattern later, but that is their own scoping decision.
- **A3** (build-time span-marker validator) — already superseded by A9; not
  resurrected.
- **C3** (per-task evidence stub relief) — separate backlog item, unrelated
  call sites.
- **A8's self-converge-relaxation dedup** — separate, still-open backlog
  item.

## Dependencies / Prerequisites

### Resource Audit Gate (constitution §7)

Scanned the backlog ticket text (`docs/backlog.md` A10/A2 sections) and this
spec's own sources for `http(s)://`, `figma`, `sketch`, `mockup`, `URL`,
`link`, `see <ticket>`, `Azure DevOps`, `JIRA`. Result: **no external
references found** — every pointer in the ticket is an in-repo path
(`tools/transitions.ts`, `content/const-*.md`, `specs/qa-flow-enforcement-
architecture.md`). No fetch/index/ignore classification needed.

### Question Batch Gate

No clarifications accumulated. The fold-in decision (A2) was explicitly
delegated to this PM pass by the dispatching brief and is resolved above,
not via `AskUserQuestion`. The rendering-mechanism choice (build-time
generator vs. runtime template, see below) is an implementation decision
left to the architect, not a product ambiguity requiring human input.

### Prerequisites shipped

- **A9** (compose-not-strip, v3.44.0+) ✓ — `prompts/constitution-manifest.ts`
  (`CONSTITUTION_SEGMENTS` + `includeSegment`) is the composition substrate
  this ticket's rendering mechanism builds on. `composeConstitution()` in
  `prompts/build.ts` concatenates fragment files verbatim; the golden
  baseline test (`test/fixtures/compose-golden/constitution-monolith.txt`)
  is the byte-for-byte contract AC-3 must continue satisfying.
- **A1** (registry pattern, v3.46.0 lineage) ✓ — produced
  `tools/handoff-orchestrator.ts` (the verbatim `tw_update_state`
  gate-orchestration extraction) and the `{name, schema, handler}` registry
  pattern this ticket's `gates/registry.ts` follows structurally.

### Full gate catalog (17 codes) to migrate into `gates/registry.ts`

Routing-edge gates (`tools/transitions.ts`, `TransitionRejection` union):
`TRANSITION_REJECTED`, `QA_ROUND_EXCEEDED`, `REVIEW_ROUND_EXCEEDED`,
`VISUAL_ROUND_EXCEEDED`, `AGENT_ID_REQUIRED`.

Value-add gates (`tools/handoff-orchestrator.ts` + `tools/evidence-file.ts`
predicates): `SCOPE_DECISION_REQUIRED`, `CUT_APPROVAL_REQUIRED`,
`MISSING_EVIDENCE`, `VISUAL_BASELINES_REQUIRED`, `VISUAL_EVIDENCE_MISSING`,
`VISUAL_WIDGETS_UNVERIFIED`, `VISUAL_ASSERTIONS_REQUIRED`,
`VISUAL_REPORT_INCOMPLETE`, `VISUAL_PROVENANCE_MISSING`,
`BASELINE_MANIFEST_MISSING`, `BASELINE_PROVENANCE_INCOMPLETE`,
`PIXEL_GATE_ATTESTATION_MISSING`.

Architect must re-verify this count against source at blueprint time (`test/
error-code-contract.test.mjs` AC-1 floor is ">= 18", which may include one
or two codes this enumeration missed — reconcile exactly, don't approximate).

### Rendering-mechanism decision — deferred to architect

Two candidate mechanisms for AC-3/AC-4 ("render from templates"):

- **(a) Build-time generator script** (precedent: `scripts/check-version.mjs`
  — a checked script, not a runtime path) that reads `gates/registry.ts` and
  writes/verifies the affected `content/const-*.md` fragments and skill
  excerpts, checked into git like today. Lowest runtime risk: zero change to
  `prompts/build.ts`'s composition pipeline; the A9 golden-baseline test's
  guarantee is untouched by construction.
- **(b) Runtime template composition** inside `composeConstitution()` /
  `buildPromptForRole()`. Higher risk: touches the composition pipeline
  every existing prompt/hook test exercises.

**PM recommendation (non-binding): (a).** It minimizes blast radius on the
already-hardened A9 pipeline and matches the existing "generated content,
checked in, verified by a diff test" pattern the repo already uses for
`dist/`. Architect makes the final call in `specs/gate-registry-
architecture.md` and must justify a deviation if choosing (b).

### Fragment placement (chain/design tags, `prompts/constitution-manifest.ts`)

The gate-table fragments this ticket regenerates carry existing tags that
must be preserved: `const-06-chain-31-head.md` (`chain`),
`const-07-design-chain-gates.md` (`chain-design`), `const-08-chain-31-mid.md`
(`chain`), `const-09-design-chain-vround.md` (`chain-design`),
`const-11-design-chain-32.md` (`chain-design`). Whatever rendering mechanism
the architect picks, it must not change which fragments ship on which
dispatch (lite vs. chain, design-armed vs. not) — that arming logic is out
of scope here and already correct.

### Task-granularity note for the architect

The task list below (`tw_add_task`) is sized on the current best estimate of
module boundaries. Per PM SOP ("one task = one sr-engineer session, ≤5
files / 300 lines"), the architect blueprint MUST further split any task
below that its file-by-file diff plan shows exceeding that budget once exact
line counts per predicate are known — preserve task ordering and
`depends_on` chains when splitting; do not silently merge or drop tasks.
