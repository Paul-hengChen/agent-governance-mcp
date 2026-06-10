# Architecture: visual-selfconverge

Feature id: `visual-selfconverge` | Order 0 in `.current/feature-split.md`
Source spec: `specs/visual-selfconverge.md` (PM, 2026-06-10)
Architect: @architect (opus), 2026-06-10

> **Scope note (read first).** This is a NON-DESIGN governance feature: no Figma
> source, no `design/visual-selfconverge.md`, no `## Visual Baselines` for THIS
> feature's own delivery. The architect Artifact-Schema **Visual Harness** section
> is therefore OMITTED (it is mandatory only when `design/<feature>.md` carries a
> `## Visual Baselines` H2 — it does not). Do not confuse the two layers: this
> feature EDITS the governance text that describes visual harnesses for OTHER
> design-backed features, but its own deliverable is prompt-document edits to
> `content/constitution.md` and `content/skill-*.md`, plus a test-run verification.
> Per Constitution §1 (MVP strict), all five bundled changes ship as
> prompt-document edits with **no server code change and no version bump** — see
> Decision Records D1.

---

## Affected Files

All changes are edits to governance prompt documents. No `.ts` source, no
`index.ts`, no schema, no test infrastructure is created or modified. `dist/` is
untouched (no `npm run build` needed; the build only ships compiled `.ts`).

| File | Change | AC | Task | Anchor (current) |
|---|---|---|---|---|
| `content/skill-sr-engineer.md` | Extend the Scoped Render Self-Check (line 23, "**Scoped Render Self-Check (v3.26.0, R5)**") from per-widget to **whole-surface self-converge loop**: screenshot full surface → Read baseline+impl → region-diff over every `compare region` (≡ qa-visual Step B) → structural-assertion checks over every VSA row (≡ qa-visual Step C) → iterate in-context until ALL VSA rows pass, BEFORE the "ready for code review" handoff. | AC-1 | T-VSC-01 | line 23, SOP step 3a item 5 |
| `content/constitution.md` | Add bounded **§1 surgical relaxation** clause. Edit the **Surgical changes** bullet (line 18) — or add an adjacent sub-bullet under §1 — stating: inside the sr self-converge loop ONLY, sr MAY fix all VSA-detected structural deviations in one pass (not one property per round-trip). Must carry three qualifiers: (a) scope = pre-handoff self-converge loop only; (b) the QA gate still independently verifies all VSA rows; (c) §3.2 is unchanged. | AC-2 | T-VSC-02 | §1 line 18 (`**Surgical changes**`) |
| `content/skill-architect.md` | Extend the **Visual Harness** Artifact-Schema bullet (line 20, esp. the "Diff library + threshold" sub-bullet at line 23): require the harness to emit **per-region structural numbers** for every declared `compare region` (not a pass/fail boolean or whole-frame pixel ratio), AND require the **same output format** to be consumed by both sr-engineer self-check and qa-engineer verdict. | AC-4 | T-VSC-03 | line 20–23, "Visual Harness" bullet |
| `content/skill-pm.md` | Add a **geometric-density split gate** sub-step, parallel to step 2a (line 39, "**Visual State-Count Split (v3.26.0, R4/B5)**"). Suggest numbering it **2a-bis** (or extend 2a) so it sits beside the state-count gate without renumbering 2b (the v3.30.0 Scope Decision Gate). Define density = number of independently-constrained geometry layers on one surface, threshold ≥ 3, recommend a sub-task split when met. MUST NOT alter the existing 8–10 state-count threshold. | AC-5 | T-VSC-04 | step 2a, line 39 |
| `content/skill-design-auditor.md` | Add geometric-density **awareness**: when auditing, flag a surface with ≥ 3 independently-constrained geometry layers and recommend the PM density split gate. Natural anchor: alongside the widget-shape heuristics block (line 56) or the *Visual Structural Assertions* bullet (line 29). | AC-5 (support) | T-VSC-05 | line 29 / 56 |
| `content/skill-coordinator.md` | Add a **subagent token observability** clause: `agent-*.jsonl` MAY be read to extract `usage.input_tokens`, `usage.output_tokens`, `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens` per dispatch; these fields (NOT `subagent_tokens` alone) are the canonical cost-attribution source. Place near the existing watermark/observability content (around line 108). **Read the section first** to avoid duplicating any existing observability clause (none found in the grep, but verify in-edit). | AC-6 | T-VSC-06 | ~line 108 |
| `tasks.md` / `.current/handoff.md` | State bookkeeping via `tw_*` tools only (not hand-edited). | — | all | — |

**Regression guard (AC-3 — load-bearing).** §3.2 of `content/constitution.md`
(lines 57–91) MUST remain **word-for-word** the v3.27.0 text. Specifically the
three rules: **No global-frame metric** (line 82), **Visual verdict is
qa-visual-owned** (line 65), **Builder ≠ judge** (line 77). The AC-2 edit lives
entirely in §1 (lines 7–18) and MUST NOT touch §3.2. Verification command (from
AC-3): `git diff HEAD content/constitution.md | grep "^-" | grep -E "global-frame|qa-visual-owned|builder.*judge"` must return **0** deleted lines.

**Out of scope (do not touch):** `tools/evidence-file.ts`, `index.ts`, any
`schema/*`, `package.json` version, `scripts/check-version.mjs`, the `visual_round`
circuit-breaker thresholds, the QA evidence report schema, the 8–10 state-count
threshold. (Per spec *Out of Scope* + Decision Records D1.)

---

## Data Structures

_No new types, interfaces, or schemas._ This feature is entirely prompt-document
text. The existing server-side data structures it relies on are unchanged:

- `VisualReportValidation` / `VisualReportsCheck` (`tools/evidence-file.ts`
  lines 470–551) — already parse the per-region `## Region Diff` table
  (`| surface | result |`) and the `## Structural Assertions` table
  (`| assertion id | surface | … | result |`). The AC-4 harness "per-region
  structural numbers" requirement is already the EXISTING report contract; AC-4
  only adds the architect-skill INSTRUCTION that a feature's harness must emit
  data in that shape and that both roles consume it. No struct change.
- `REQUIRED_VISUAL_SECTIONS` (line 362) — unchanged; QA report schema is
  explicitly out of scope.

---

## Interface Contracts

_No function or API signatures change._ For completeness, the existing contracts
that the new prompt text leans on (verified during this design, all in
`tools/evidence-file.ts`) and which remain untouched:

```ts
// Region Diff per-surface result parser — already consumes per-region numbers.
function parseRegionDiffFailures(section: string): string[]        // result ∉ {pass, accepted} ⇒ fail

// Structural-assertion table parser — already per-assertion / per-region.
function parseAssertionFailures(section: string): string[]         // last cell !== "pass" ⇒ fail

// Strict report validation gate (v3.26.0).
function validateVisualReport(content: string): VisualReportValidation
function validateVisualReports(workspacePath: string, taskIds: string[]): VisualReportsCheck
```

The sr-engineer self-converge loop (AC-1) reuses the **existing playwright/
headless render harness** already referenced in `skill-sr-engineer.md` R5
("existing playwright/headless harness — reuse it, don't add infra you won't
keep"). It produces the same `impl path` screenshots QA reads. No new tool, no
new MCP surface, no new evidence file.

---

## Sequence Diagram

The behavioral change is the sr-engineer pre-handoff loop now covering the whole
surface and running the same checks QA later runs (collapsing the cross-context
rework rounds). Three actors (sr, the render harness, QA) → diagram required.

```mermaid
sequenceDiagram
    participant SR as sr-engineer
    participant H as render harness (existing playwright/headless)
    participant FS as impl path + design/<feature>.md
    participant QA as qa-engineer (qa-visual)

    Note over SR: AC-1 whole-surface self-converge loop (pre-handoff)
    loop until ALL VSA rows pass
        SR->>H: render FULL surface (not only changed widget)
        H-->>FS: screenshot → declared impl path
        SR->>FS: Read baseline + impl images into context
        SR->>SR: region-diff over every compare region (≡ qa-visual Step B)
        SR->>SR: structural-assertion checks over every VSA row (≡ qa-visual Step C)
        alt deviations detected
            Note over SR: AC-2 §1 bounded relaxation — fix ALL VSA deviations<br/>in one pass (loop-only; §3.2 unchanged)
            SR->>SR: apply surgical fixes
        end
    end
    SR->>FS: tw_update_state(In_Progress, "ready for code review")

    Note over QA: QA gate runs INDEPENDENTLY (unchanged — §3.2, AC-3)
    QA->>FS: Read baseline + impl; re-run Steps A/A.5/B/C
    QA->>QA: own verdict; writes qa_reports/visual_<id>.md
    Note over QA: server validateVisualReport() gates PASS (unchanged)
```

Key invariant the diagram encodes: the loop is **upstream and additive**. QA's
independent verdict path (Constitution §3.2 + `validateVisualReport`) is
unchanged. The win is fewer iterations of that path, not removal of it.

---

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| **AC-4 critical decision (PM Open Question): does the shared region-measure harness require a server-side interface in `tools/evidence-file.ts` / a new tool, or is it prompt-doc-only?** Grounding: `tools/evidence-file.ts` `parseRegionDiffFailures` (L426) + `parseAssertionFailures` (L403) ALREADY parse per-region/per-assertion result tables; `skill-qa-visual.md` Steps B (L47) + C (L58) ALREADY mandate per-`compare region` tables that the server consumes; `skill-sr-engineer.md` R5 (L23) ALREADY tells sr to reuse the existing playwright/headless harness and Read its screenshots. The only gap AC-4 names is that the architect's **Visual Harness** skill section does not yet require the harness to emit per-region numbers consumed by BOTH roles. | **PROMPT-DOC-ONLY. Resolved — NO server change, NO version bump.** AC-4 is satisfied by extending the `content/skill-architect.md` Visual Harness bullet to (a) require per-region structural numbers per `compare region` and (b) name the same output format as shared by sr self-check and qa verdict. The server already validates the consuming report shape; no new interface, no new tool, no struct change is needed for any AC. Constitution §1 MVP-strict mandates the minimal path. | No `npm run build`, no `dist/` change, no `package.json`/`index.ts` version bump, no `scripts/check-version.mjs` impact. `prebuild`→`check:version` stays green because the version literal is unchanged. Future hardening (server enforcement of the sr loop) is explicitly deferred by the spec *Out of Scope*; if it ever lands it WILL need a minor bump — but that is a separate feature, not this one. Closed the PM Open Question — no remaining open questions. |
| **AC-2 relaxation must not weaken §3.2 (AC-3 regression guard).** A §1 "fix all deviations at once" exception could be read as licensing sr to self-judge visual PASS. | Scope the AC-2 clause to the pre-handoff self-converge LOOP only, and require it to carry three explicit qualifiers (loop-only; QA still independently verifies; §3.2 unchanged). Place the edit strictly inside §1 (lines 7–18); never edit §3.2 (lines 57–91). | sr gets the round-collapsing speedup without acquiring verdict authority. AC-3 stays satisfiable by `git diff` (0 deleted §3.2 lines). The "Builder ≠ judge" guard (L77) still forces builder-inline work to `status=Blocked`, not a self-PASS. |
| **AC-5 placement: skill-pm.md vs skill-design-auditor.md, and renumbering risk.** PM step 2a is the state-count split gate; step 2b is the v3.30.0 Scope Decision Gate. Inserting a new gate could renumber 2b and desync cross-references. | Put the **authoritative** density-split gate clause in `skill-pm.md` (the role that owns the split decision and writes `.current/feature-split.md`), numbered to sit beside 2a WITHOUT renumbering 2b (use `2a-bis` or extend the 2a bullet). Add only **awareness/flag** language to `skill-design-auditor.md` (the upstream role that can spot layered geometry but does not own the split). | Single source of truth for the gate (PM); design-auditor feeds it. No renumber of 2b ⇒ no broken `SCOPE_DECISION_REQUIRED` references. Density defined as distinct from state-count, 8–10 threshold untouched (AC-5 testable holds). |
| **AC-6 fields: `subagent_tokens` vs the four `usage.*` fields.** The retrospective found `subagent_tokens` alone has an unknown denominator. | Document the four `usage.*` fields (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`) from `agent-*.jsonl` as the canonical cost source, explicitly displacing `subagent_tokens` as the sole metric. Skill-procedure clause only — automated parsing/tooling is deferred (spec *Out of Scope*). | Future retrospectives have a precise denominator. `grep -c` for `agent-.*jsonl|input_tokens|cache_read_input_tokens` returns ≥ 2 (AC-6 testable). No new script/tool ⇒ MVP-compliant. |
| **Whether to omit the architect Visual Harness section in THIS artifact.** The feature edits governance text about visual harnesses, which could be mistaken for a trigger to include the section. | OMIT the Visual Harness H2 from this architecture doc. The Artifact-Schema rule arms it only when `design/<feature>.md` has a `## Visual Baselines` H2 — this feature has no design file (`mode: no-design`). | Correct per schema; avoids fabricating a harness spec for a doc-only feature. The Visual Harness Gate (SOP 4a) is not tripped (no design file). |

---

## Deferred Resources

_No external references to defer._ The spec's *Dependencies / Prerequisites*
(spec lines 127–134) records zero external URLs, zero Figma links, zero ticket
IDs — every referenced artifact is a local governance/research file already in the
repo (`research/process-retrospective.md`, `content/constitution.md`,
`content/skill-*.md`, `tools/evidence-file.ts`). Empty section is therefore valid
per the Artifact-Schema rule (Deferred Resources may be empty only when the spec
shows zero such refs). External-reference Sanity Gate (SOP 4): PASS — no
unclassified reference.

---

## Implementation Notes for sr-engineer

1. **Order.** T-VSC-01 first (sr-engineer loop), then T-VSC-02 (it cross-references the loop), then T-VSC-03 / 04 / 05 / 06 in any order; T-VSC-07 (QA) last.
2. **No build step.** These are `.md` edits. `dist/` ships compiled `.ts` only; nothing here recompiles. Do NOT run `npm run build` expecting a diff.
3. **Verbatim §3.2.** Before handing to QA, run the AC-3 guard command yourself and confirm 0 deleted §3.2 lines. The AC-2 edit must be confined to §1 (constitution lines 7–18).
4. **Anchor verification.** Each row in *Affected Files* names the current line/anchor as of this read; if line numbers have shifted, match on the quoted heading/phrase, not the number.
5. **AC grep markers.** Each AC carries a `grep`/`grep -c` testable in the spec — write the new text so those exact patterns match (`whole-surface`/`self-converge`; `self-converge`/`pre-handoff loop` in §1; `per-region`/`shared.*harness` in skill-architect; `geometric.density`/`density.*split`; `agent-.*jsonl`/`input_tokens`).
6. **No new test files.** AC-7 is satisfied by `npm test` staying green; qa-engineer owns any test edits, and the spec asserts none are required for doc-only changes.

---

## Open Questions

_None._ The single PM-flagged Open Question (AC-4 harness: server change vs
prompt-doc-only) is resolved in Decision Records D1 as **prompt-doc-only, no
version bump**. Handing off to sr-engineer.
