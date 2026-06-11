# Spec: decodename-cleanup

schema_version: n/a (content-only feature, no persisted-artifact schema change)

## Problem Statement

The internal product codename **"CDE-OOBE"** (and its lowercase form `cde-oobe`)
appears in the governance text that this MCP server injects into **every** managed
workspace — `content/constitution.md` plus the always-loaded `content/skill-*.md`
files. agent-governance-mcp is a methodology-agnostic tool for arbitrary external
clients; to those users the codename is undefined inside-baseball that leaks a
private project name and adds zero instructional value. This feature genericizes the
**purely-citational** CDE-OOBE references in the always-loaded files into neutral
failure-mode descriptions (e.g. "a visual false-PASS retrospective"), with the named
specifics living in out-of-scope provenance docs (`research/`,
`content/constitution-rationale.md`). **This is provenance-genericization only — no
normative rule semantics change.**

## User Stories

- As an **external operator** of agent-governance-mcp, I want the always-injected
  governance text to describe failure modes generically, so that I am not exposed to
  an undefined internal codename I cannot interpret.
- As a **maintainer**, I want the named war-story (CDE-OOBE) preserved in the
  provenance/research docs, so that genericizing the always-loaded text loses no
  institutional knowledge.
- As a **governance-rule consumer (any agent)**, I want every MUST / MUST NOT / ONLY
  / VOID rule to read byte-identical in semantics after the edit, so that the rules
  agents follow do not silently drift.

## Reference Inventory + Classification

All 19 references below are in **always-loaded** files (the only ones in scope). Each
is classified **PURE PROVENANCE** (the codename only cites where a rule came
from / a war-story example — safe to genericize) or **LOAD-BEARING** (the codename is
part of setup an agent operationally needs — flag, leave, justify).

| # | File | Line | Context (abridged) | Class | Action |
|---|------|------|--------------------|-------|--------|
| 1 | content/constitution.md | 49 | "...Closes the routing-chain half of **CDE-OOBE** finding A0..." | PURE PROVENANCE | Genericize → "...the scope-creep finding (see `content/constitution-rationale.md`)." Rule sentence (the `SCOPE_DECISION_REQUIRED` mechanics) untouched. |
| 2 | content/constitution.md | 60–61 | §3.2 header para: "Hard governance rules that emerged from the **CDE-OOBE** false-PASS retrospective (`research/cde-oobe-...-2026-06-05.md`)." | PURE PROVENANCE | Genericize → "...that emerged from a visual false-PASS retrospective (see `content/constitution-rationale.md` / `research/`)." This is the section's attribution prose, NOT a normative rule. (See §3.2 decision below.) |
| 3 | content/skill-pm.md | 21 | Copy/Strings rationale (inside `<!-- rationale -->`): "...(cde-oobe shipped `"Select your language"`...)." | PURE PROVENANCE | Genericize → "(a prior rollout shipped `"Select your language"` because nobody pinned the Figma title `"Language"`...)" |
| 4 | content/skill-pm.md | 22 | Visual Tokens rationale: "...the kind of silent drift that ate the **cde-oobe** rollout." | PURE PROVENANCE | Genericize → "...silent drift that ate a prior visual rollout." |
| 5 | content/skill-pm.md | 23 | Visual Widgets: "...closes the gap that ate **cde-oobe** DateTime picker (column-scroller widget never enumerated...)." | PURE PROVENANCE | Genericize → "...the gap where a column-scroller widget was never enumerated → primitive `<input type="date">` shipped → no role had grounds to reject." (keeps the instructive mechanism, drops the name) |
| 6 | content/skill-pm.md | 39 | State-Count Split: "...large single targets made every **CDE-OOBE** QA round expensive and caused fix-A-break-B." | PURE PROVENANCE | Genericize → "...made every QA round expensive and caused fix-A-break-B." |
| 7 | content/skill-pm.md | 40 | Geometric-Density rationale: "(**CDE-OOBE** root cause; see `research/process-retrospective.md`)." | PURE PROVENANCE | Genericize → "(a layered-geometry root cause; see `research/process-retrospective.md`)." |
| 8 | content/skill-pm.md | 41 | Scope Decision Gate: "...slip into build silently (**CDE-OOBE** finding A0)." | PURE PROVENANCE | Genericize → "...slip into build silently (the scope-creep finding; see `content/constitution-rationale.md`)." |
| 9 | content/skill-sr-engineer.md | 23 | Scoped Render rationale: "...which is exactly where **CDE-OOBE** failed... (root cause C1)." | PURE PROVENANCE | Genericize → "...exactly where a prior visual rollout failed... (root cause C1)." |
| 10 | content/skill-sr-engineer.md | 24 | Flag-don't-assume: "**Inventing a layout/row style is a scope violation, not a default** (**CDE-OOBE** boxed-chips + invented copy)." | PURE PROVENANCE | Genericize → "...not a default (a prior rollout invented boxed-chips + copy)." Rule sentence (MUST query or STOP) untouched. |
| 11 | content/skill-sr-engineer.md | 25 | Declared-token-must-render: "...build-gate failure...(**CDE-OOBE** shipped grey `#333` primary buttons while accent `#3C5AAA` sat unused)." | PURE PROVENANCE | Genericize → "(a prior rollout shipped grey `#333` primary buttons while accent `#3C5AAA` sat unused)." |
| 12 | content/skill-sr-engineer.md | 26 | Whole-surface loop rationale: "...collapses the cross-context qa-visual rework rounds (**CDE-OOBE** root cause C1)..." | PURE PROVENANCE | Genericize → "...(a cross-context-rework root cause, C1)..." |
| 13 | content/skill-qa-visual.md | 50 | "...structural error (**CDE-OOBE** Language scored 6% while structurally wrong)." | PURE PROVENANCE | Genericize → "(a prior surface scored 6% while structurally wrong)." |
| 14 | content/skill-qa-visual.md | 75 | "...what catches the **CDE-OOBE** class..." | PURE PROVENANCE | Genericize → "...catches the false-PASS class..." |
| 15 | content/skill-qa-visual.md | 122 | "Step A (widget shape) catches the **cde-oobe** class of failure: correct color/font on the **wrong widget**..." | PURE PROVENANCE | Genericize → "...catches the wrong-widget class of failure: correct color/font on the **wrong widget**..." |
| 16 | content/skill-design-auditor.md | 16 | "...Name- or number-matching alone is INSUFFICIENT (**CDE-OOBE** "resolved" /time,/consent,/summary baselines to the wrong `4888:*` Network frames by name)." | PURE PROVENANCE | Genericize → "(a prior audit "resolved" baselines to the wrong frames by name)." Rule (`audited` only after content match) untouched. |
| 17 | content/skill-design-auditor.md | 27 | "The missing focus/selection bar in **CDE-OOBE** was an un-inventoried state..." | PURE PROVENANCE | Genericize → "A missing focus/selection bar is the kind of un-inventoried state..." |
| 18 | content/skill-design-auditor.md | 29 | "...the machine-checkable structures whose absence shipped the **CDE-OOBE** UI." | PURE PROVENANCE | Genericize → "...structures whose absence shipped a structurally-wrong UI." |

**Result: 18 reference sites (19 textual occurrences — constitution L60–61 spans two
lines of one citation; L49 is one), ALL classified PURE PROVENANCE. Zero LOAD-BEARING
references found** — in every case the codename is a citation/example label, never an
operative noun an agent must resolve to act. No reference is left in place.

## §3.2 Byte-Lock Decision (resolved — DECISION: EDIT)

The prior two features (constitution-restructure, governance-text-load) held a hard
constraint that bytes between `### 3.1` and the end of `### 3.2` must not change.
Reference #2 (constitution L60–61) sits inside §3.2.

**Decision: this feature MAY edit §3.2's provenance prose at L60–61.** Rationale: that
byte-lock was a **per-feature promise** scoped to those two features (they were
restructuring/byte-counting §3.1–§3.2 and froze it to keep their own diffs auditable),
**not a permanent law of the constitution**. L60–61 is the section's introductory
**attribution paragraph** ("rules that emerged from the … retrospective") — it carries
NO normative force. Every operative rule in §3.2 is a `**bolded**` bullet (L66+), none
of which this feature touches.

**Guard (encoded as HC-2 + AC-CONST-2 below):** the diff to §3.2 may touch ONLY the
citational clause in the L60–61 paragraph. The following §3.2 normative sentences MUST
remain verbatim (byte-identical):

- L62–64: "The decisive failure was a coordinator-authored accept-policy that
  pre-excused the exact visual defect; prompt-advisory rules proved insufficient, so
  these are also server-enforced (§3.1 visual evidence gate + report-schema validation)."
  *(This sentence stays as-is. It contains no codename and is part of the section's
  normative justification — it is NOT in the edit target.)*
- All bullets L66–92 (Visual verdict is qa-visual-owned; Builder ≠ judge; No
  global-frame metric; Sequential-context assumption) — **byte-identical, untouched.**

The ONLY §3.2 bytes that change: the noun phrase "the CDE-OOBE false-PASS retrospective
(`research/cde-oobe-...-2026-06-05.md`)" → "a visual false-PASS retrospective (see
`content/constitution-rationale.md` / `research/`)". No MUST / MUST NOT / ONLY / VOID /
enforcement clause is added, removed, or reworded.

## AC8 Token-Floor Decision (resolved — DECISION: RAISE THE FLOOR 4153 → 4161)

**Context (verified, not hypothetical).** The implementation of this feature is DONE
and correct: all 18 CDE-OOBE references genericized across the 5 always-loaded files,
AC-GREP=0, build clean, HC-1 semantics unchanged, HC-2 §3.2 byte-guard PASS. It trips
exactly one test: `test/context-budget.test.mjs:328` AC8, which asserts the
rationale-stripped `content/constitution.md` is `<= 4153 ~tok`.

**Root cause (measured against the working tree with the test's own estimator).**
HC-5 requires each genericized reference to keep pointing somewhere; references #1 (L49)
and #2 (L60–61) redirect named specifics via `(see content/constitution-rationale.md …)`
provenance pointers. Those pointers sit **OUTSIDE** the §1/§7 `<!-- rationale -->` fences,
so `stripRationale()` does not remove them, and they are longer than the codename strings
they replace. Net: stripped constitution moves **4153 → 4161 ~tok (+8, exact)**. Raw moves
4225 → 4233; saving stays **72 ~tok (≥ 49)**, so only the upper-bound assertion is breached.
The AC8 floor of 4153 was measured by the **sibling governance-text-load feature (T-GTL-06)**
in this same uncommitted working tree — i.e. it was pinned *before this feature existed*.

**Decision (coordinator-reviewed, human-approved; PM ratifies): ACCEPT the +8 ~tok and
raise the AC8 constitution floor 4153 → 4161.** Rationale: the constitution is loaded
**STANDALONE** into external client workspaces — *without* this repo's `CLAUDE.md` and
*without* the surrounding repo docs. For those outside users, an inline
`(see content/constitution-rationale.md …)` pointer is precisely what preserves
**provenance discoverability** — which is this feature's entire purpose. Dropping the
pointer to claw back 8 ~tok would defeat the cleanup (a generic description with no path
to the named specifics strands external operators). The +8 ~tok is therefore the
**irreducible, justified cost** of de-codenaming *with* a provenance redirect (HC-5).

**Ownership of the fix.** Editing the test is the **test-owner's** call, not sr-engineer's
(§2 forbids the implementer touching the assertion that gates their own work). The
implementation itself MUST NOT be redone — it is correct. The remaining work is:
(1) code-reviewer reviews the existing diff against HC-1/HC-2/AC-SEMANTICS; then
(2) **qa-engineer**, as test-owner, raises the AC8 assertion `4153 → 4161` and bumps its
comment to record this decision, runs the full suite green, and PASSes. HC-1 (rule
semantics) and HC-2 (§3.2 normative bullets + L62–64 byte-identical) remain in force and
unchanged — this decision touches only the AC8 numeric floor, nothing normative.

## Hard Constraints

- **HC-1 — Rule semantics unchanged.** No normative token (MUST, MUST NOT, ONLY, MAY
  NOT, VOID, "blocked with", "server-enforced", error-code names like
  `SCOPE_DECISION_REQUIRED`) may be added, removed, or have its meaning altered. This
  is provenance-genericization only. A reviewer diff must show changes confined to
  citational/example clauses.
- **HC-2 — §3.2 byte guard.** Within `content/constitution.md` §3.2 (L58 `### 3.2`
  through the last line before `## 4`), the diff touches ONLY the L60–61 citational
  clause. All bullets and the L62–64 justification sentence stay byte-identical
  (enumerated above).
- **HC-3 — Out-of-scope files untouched.** No edit to `research/`, `specs/`,
  `content/constitution-rationale.md`, `CHANGELOG.md`, `tasks.md`, `qa_reports/`,
  `review_reports/`, `.current/`, or any test file. The war-story name lives there.
- **HC-4 — Tests stay green (one sanctioned floor-raise excepted).** `npm test` must pass
  after the floor-raise below. Known risk: `test/visual-evidence-gate.test.mjs`,
  `test/visual-report-schema-validation.test.mjs`, `test/widget-shape-spec.test.mjs`
  contain `cde-oobe` — these are presumed mock-design fixtures (feature names), NOT
  assertions on constitution/skill prose. The ONE sanctioned test change is the AC8
  floor raise `4153 → 4161` in `test/context-budget.test.mjs:328` (see AC8 Token-Floor
  Decision above + AC-FLOOR below) — owned by qa-engineer as test-owner, NOT sr-engineer.
  No other test edit is permitted; no test asserts on the literal codename in an
  always-loaded file (confirmed by AC-GREP scope review).
- **HC-5 — Genericized prose must still point somewhere.** Each genericized reference
  either (a) keeps the instructive mechanism inline (e.g. the `<input type="date">`
  example) or (b) redirects the named specifics to `content/constitution-rationale.md`
  / `research/`. No knowledge is deleted, only relocated/abstracted.

## Acceptance Criteria

- **AC-CONST-1** — Given `content/constitution.md`, When reference #1 (L49) is
  genericized, Then the `SCOPE_DECISION_REQUIRED` rule sentence and its
  clear-conditions are byte-identical and only the trailing "Closes the … CDE-OOBE
  finding A0" citational clause changes.
- **AC-CONST-2** — Given `content/constitution.md` §3.2, When reference #2 (L60–61) is
  genericized, Then a diff of §3.2 shows changes confined to the L60–61 citational noun
  phrase, and the L62–64 justification sentence + all L66–92 bullets are byte-identical
  (verified by `git diff` line inspection).
- **AC-PM** — Given `content/skill-pm.md`, When references #3–#8 are genericized, Then
  every Spec-Schema rule, gate threshold (8–10 states, ≥3 layers), and STOP protocol
  reads identically; only the parenthetical/rationale war-story labels change.
- **AC-SR** — Given `content/skill-sr-engineer.md`, When references #9–#12 are
  genericized, Then the Scoped Render Self-Check, Flag-don't-assume STOP rule,
  Declared-token build-gate rule, and Whole-surface loop rule read identically; only
  example/rationale labels change.
- **AC-QAVIS** — Given `content/skill-qa-visual.md`, When references #13–#15 are
  genericized, Then Step A/B/C semantics and the PASS-blocking conditions read
  identically; only example labels change.
- **AC-AUDITOR** — Given `content/skill-design-auditor.md`, When references #16–#18 are
  genericized, Then the `audited`-only-after-content-match rule, the interactive-states
  inventory requirement, and the Visual Structural Assertions requirement read
  identically; only example labels change.
- **AC-GREP** — Given the five always-loaded files, When `grep -rin "cde[-_ ]?oobe"`
  is run over them, Then it returns **zero** matches (no LOAD-BEARING leftovers were
  identified, so a clean grep is required).
- **AC-TEST** — Given the repo, When `npm test` runs after the edits AND after the
  sanctioned AC8 floor-raise (AC-FLOOR), Then it passes (all subtests green), confirming
  no test asserted on the removed codename in always-loaded prose.
- **AC-FLOOR** — Given `test/context-budget.test.mjs:328` (AC8) currently asserts the
  rationale-stripped constitution is `<= 4153 ~tok`, When qa-engineer (the test-owner)
  applies the ratified decision, Then the assertion upper bound is raised `4153 → 4161`
  and its `WHY:` comment is updated to record this decision (HC-5 provenance redirects
  sit outside the rationale fences → measured stripped 4161 ~tok; raw 4233; saving 72
  still `>= 49`). sr-engineer MUST NOT make this edit (§2 — implementer does not touch
  the assertion gating their own work); the implementation diff is final and correct.
- **AC-SEMANTICS** — Given the full diff, When a code-reviewer inspects it, Then NO
  line adds/removes/reworders a normative token (MUST / MUST NOT / ONLY / MAY NOT /
  VOID / enforcement / error-code), satisfying HC-1.

## Out of Scope

- `research/` (incl. `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`,
  `research/process-retrospective.md`) — the named war-story belongs here; do NOT touch.
- `content/constitution-rationale.md` — destination for named specifics; not edited by
  this feature (it already / may carry the named provenance).
- `specs/`, `CHANGELOG.md`, `tasks.md`, `qa_reports/`, `review_reports/`, `.current/`
  — not always-loaded.
- `test/*.test.mjs` (incl. the three with `cde-oobe` fixtures) — fixtures, not prose;
  not edited (only verified green).
- Any normative rule change — explicitly forbidden (HC-1).
- `content/skill-coordinator.md`, `skill-coordinator-lite.md`, `skill-architect.md`,
  `skill-researcher.md`, `skill-qa-engineer.md` — prior grep found no CDE-OOBE refs;
  sr-engineer should re-grep to confirm but not edit absent a hit.
- `dist/` — rebuilt by `npm run build`; not hand-edited.

## Dependencies / Prerequisites

- None blocking. Non-design feature (no `design/<feature>.md`) → no Figma/Visual
  artifacts; Copy/Strings, Visual Tokens, Visual Widgets, Visual Structural Assertions
  sections are N/A (`N/A | — | non-design content-edit feature, no UI surface`).
- Scope decision: **single-feature** (focused content edit, no new code paths). The
  v3.30.0 scope-decision gate is silent for non-design features; attestation recorded
  defensively on the pm:In_Progress handoff.
- Routing chain: **sr-engineer → code-reviewer → qa-engineer** (MVP; no architect — no
  new modules / data model / API). sr-engineer's implementation is COMPLETE and correct;
  do NOT redo it. Remaining: code-reviewer reviews the existing diff (HC-1/HC-2/
  AC-SEMANTICS), then qa-engineer raises the AC8 floor per AC-FLOOR (as test-owner),
  runs the suite green, and PASSes.
