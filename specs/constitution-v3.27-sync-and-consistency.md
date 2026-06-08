# Spec: Constitution v3.27 Sync + Internal-Consistency Pass

> Status: **governed spec** — PM-owned, supersedes the draft brief.
> Feature: `constitution-v3.27-sync-consistency`
> Date: 2026-06-08
> Author: pm (sonnet)

## Problem Statement

`content/constitution.md` carries a stale v3.14.1 header while its body
already references v3.16.0 / v3.26.0 behavior, and the server has since
shipped through v3.27.1. Two independent reviews surfaced 7 items: four
doc-vs-code drift gaps (Codex audit, A1–A4) where the constitution text
lags shipped server enforcement, and three internal-consistency gaps
(Claude audit, B1–B3) where efficiency rules (§1) and correctness rules
(§2/§3/§6/§7) conflict with no stated tie-breaker. No server-code changes
are required — A2 documents already-shipped behavior; all other items are
documentation or reasoning-rule edits only.

---

## User Stories

- As an **agent** reading the constitution, I want the pre-flight list (§3)
  to include `tw_sync`, so that I do not accidentally call it before
  `tw_get_state` and get a spurious `⛔ BLOCKED` error.
- As a **qa-engineer**, I want §3.1 and §4 to document
  `VISUAL_REPORT_INCOMPLETE` and `VISUAL_ASSERTIONS_REQUIRED` with their
  required report sections, so that I know exactly what the server will
  reject and can write a conformant visual report on the first attempt.
- As a **maintainer** reading the constitution header, I want the version to
  reflect the highest behavior the document describes, so that I can
  cross-reference it against the changelog without guessing.
- As an **agent** following §3.2, I want the authorship wording to match
  what the server actually enforces (schema validation, not content-sniffing),
  so that I do not over-interpret "authored under the qa chain" as a
  provenance check the server does not perform.
- As an **sr-engineer**, I want §1 to explicitly carve out blocker signals
  and gap-flags from the ≤15-word cap, so that the terse rule does not
  silently suppress a blocker report.
- As an **architect**, I want §1 to state that the canonical design (Figma
  node), not a lossy prose transcription, is the scope baseline for
  design-backed work, so that a gap between the spec and the design is
  always a fidelity defect, never MVP compliance.
- As **any agent**, I want the constitution's `## Document Priority` section
  to include an intra-document tie-breaker and a circuit-breaker escape, so
  that I never reach a hard conflict (§2 build gate vs §5 anti-loop) without
  a defined resolution path.

---

## Acceptance Criteria

**AC-A1** — Pre-flight list coverage
- Given: an agent reads §3 of the constitution.
- When: they scan the pre-flight rule.
- Then: `tw_sync` is listed alongside `tw_update_state`, `tw_complete_task`,
  `tw_rollback_task`, and `tw_add_task`; the "Task list edits go through
  tools" rule names `tw_sync` as the only sanctioned ledger→`tasks.md`
  reconcile operation.

**AC-A2** — Visual-gate error code documentation
- Given: an agent reads §3.1 and §4.
- When: they look up what PASS rejects.
- Then: both sections document `VISUAL_REPORT_INCOMPLETE` (v3.26.0) and
  `VISUAL_ASSERTIONS_REQUIRED` (v3.27.0), and the required visual-report
  sections are listed **verbatim** as: `Widget Shape Verification`,
  `Canonical State Verification`, `Structural Assertions`, `Region Diff`,
  `Allowed Differences`, `Verdict` — matching `REQUIRED_VISUAL_SECTIONS`
  at `tools/evidence-file.ts:342`.

**AC-A3** — Header version
- Given: a reader opens `content/constitution.md`.
- When: they read the H1 header.
- Then: the version is `v3.27.0` (see A3 decision below); the versioning
  policy (independent of `package.json`) is noted in a comment on the same
  line or in `docs/schema-versions.md`.

**AC-A4** — §3.2 authorship wording
- Given: an agent reads §3.2 "Visual Verdict Authority".
- When: they read the enforcement explanation.
- Then: the phrase "authored under the qa chain" is replaced with "accepted
  and owned by the qa chain at PASS time (server validates report schema,
  not file authorship)".

**AC-B1** — Terse carve-out
- Given: an agent reads §1.
- When: they apply the ≤15-word Terse rule.
- Then: the rule explicitly states the word cap does NOT apply when
  surfacing a blocker, flagging an assumption gap (§7), or stating
  acceptance criteria.

**AC-B2** — MVP design-baseline generalization
- Given: an agent reads §1.
- When: they determine what constitutes MVP scope on design-backed work.
- Then: the rule states that for design-backed work the canonical design
  (Figma node or equivalent) is the scope baseline — not the lossy prose
  transcription in the spec. Omitting a design-present element is a fidelity
  defect, not MVP compliance. A gap must be flagged per §7, never silently
  dropped.

**AC-B3** — Internal-precedence tie-breaker + circuit-breaker escape
- Given: an agent reads `## Document Priority`.
- When: they encounter a conflict between two rules within the constitution.
- Then: the section states that safety/correctness rules (§2, §3, §6, §7)
  override efficiency/style rules (§1) on any intra-constitution conflict.
  The section also states that when §5 anti-loop trips (2 fix tries / 3
  reads exhausted), the correct outcome is to hand back `Blocked`/FAIL to
  the human — never issue an error-laden PASS and never extend the loop.

**AC-SKILLS** — Skill propagation
- Given: `content/skill-sr-engineer.md` and `content/skill-design-auditor.md`
  are read after this PR.
- When: an agent looks for guidance on design-baseline scope.
- Then: both files carry a reference to the B2 rule (design = scope baseline;
  gap = fidelity defect, not MVP compliance) without restating the full
  constitution rule (constitution line 4 prohibition).
- And: neither coordinator nor qa-engineer skill files are modified (see
  Skill Propagation Blast Radius decision below).

**AC-BUILD** — No regressions
- Given: the changes are applied.
- When: `npm run build` and `npm test` run.
- Then: both exit 0 and `scripts/check-version.mjs` passes (it validates
  only `package.json` ↔ `index.ts` Server() literal, not the constitution
  header — no check-version change required).

---

## Copy / Strings

The following strings are introduced or changed by this PR. All are
governance rule text in `content/constitution.md`; they have no UI
rendering surface — the "source" is the constitution body itself or the
upstream code literal they document.

| string id | exact text | source |
|---|---|---|
| CONST-PRE-FLIGHT-ADD | `, tw_sync` (insertion into §3 pre-flight list) | authored-here — closes A1 gap between `index.ts:651 enforcePreFlight("tw_sync")` and §3 line 30 |
| CONST-SYNC-RECONCILE | `tw_sync` (named in §3 "Task list edits" rule as the sanctioned reconcile op) | authored-here — mirrors `index.ts:645` comment intent |
| CONST-VISUAL-ERR-1 | `VISUAL_REPORT_INCOMPLETE` | `index.ts:850` verbatim |
| CONST-VISUAL-ERR-2 | `VISUAL_ASSERTIONS_REQUIRED` | `index.ts:824` verbatim |
| CONST-VISUAL-SECTIONS | `Widget Shape Verification`, `Canonical State Verification`, `Structural Assertions`, `Region Diff`, `Allowed Differences`, `Verdict` | `tools/evidence-file.ts:342–349` verbatim (`REQUIRED_VISUAL_SECTIONS` array) |
| CONST-HEADER-VERSION | `v3.27.0` | authored-here — see A3 decision |
| CONST-A4-AUTHORSHIP | `accepted and owned by the qa chain at PASS time (server validates report schema, not file authorship)` | authored-here — replaces "authored under the qa chain"; aligns with `evidence-file.ts:330–334` comment |
| CONST-B1-CARVEOUT | `The word cap does NOT apply when surfacing a blocker, flagging an assumption gap (§7), or stating acceptance criteria.` | authored-here — resolves §1↔§7 tension documented in B1 |
| CONST-B2-BASELINE | `For design-backed work, the canonical design (Figma node or equivalent) is the scope baseline — not the lossy prose transcription in the spec. Omitting a design-present element is a fidelity defect, not MVP compliance; flag the gap per §7, never drop silently.` | authored-here — generalizes v3.14.0 Visual Widgets exception |
| CONST-B3-PRECEDENCE | `On any intra-constitution conflict, safety/correctness rules (§2, §3, §6, §7) override efficiency/style rules (§1).` | authored-here — root fix for §1↔§7/§2/§6 tensions |
| CONST-B3-CIRCUIT | `When §5 anti-loop trips (2 fix tries / 3 reads exhausted), hand back Blocked/FAIL to the human. Never issue an error-laden PASS; never extend the loop.` | authored-here — explicit escape for §2-build-gate↔§5 and §6-vuln↔§1-MVP hard conflicts |
| SKILL-B2-SR | One-line forward-reference to §1 B2 design-baseline rule (no restatement) | authored-here — propagates to `skill-sr-engineer.md`; constitution line 4 prohibits restatement |
| SKILL-B2-DA | One-line forward-reference to §1 B2 design-baseline rule (no restatement) | authored-here — propagates to `skill-design-auditor.md`; constitution line 4 prohibits restatement |

---

## Visual Tokens

N/A — this feature introduces no UI rendering surface, no design file, and
no visual literals. All changes are governance rule text in markdown files.

| token id | property | value | source |
|---|---|---|---|
| N/A | — | — | feature has no visual tokens (doc-only changes) |

---

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets (doc-only changes) |

---

## Out of Scope

- Server-code changes. A2 documents already-shipped behavior confirmed at
  `index.ts:824` and `index.ts:850`; `tools/evidence-file.ts:342` is
  the authoritative source. No re-implementation.
- Remaining lower-severity §1↔§7 frictions (read-cap ↔ read-before-write
  ambiguity; surgical ↔ surface-harmful-convention). B3's tie-breaker
  gives them a resolution direction; explicit per-rule edits are deferred.
- `docs/schema-versions.md` schema version table update (constitution header
  version is independent of the server schema_version tracked there — no
  entry needed).
- Skill files beyond `skill-sr-engineer.md` and `skill-design-auditor.md`
  (see Blast Radius decision below).

---

## Dependencies / Prerequisites

### Open Question Resolutions (PM decisions)

**A3 — Constitution semver policy (DECIDED)**

The constitution carries its own independent semver. `scripts/check-version.mjs`
validates only `package.json` ↔ `index.ts` Server() literal; it does NOT
read the constitution header. Mirroring `package.json` blindly would couple
two orthogonal clocks — every patch/build bump would force a constitution
edit even when no rule changed.

Policy (adopted now, note to record alongside the version bump):
> The constitution version tracks the **highest behavior the document
> describes**. It advances independently of `package.json`. The check-version
> script is not modified.

Chosen version: **v3.27.0** — the constitution body already references
v3.26.0 behavior; v3.27.0 adds `VISUAL_ASSERTIONS_REQUIRED` (the one new
error code shipped in v3.27.x). The `.0` patch suffix is reserved: future
doc-only corrections to the same behavior set bump the patch digit.

**B2/B3 enforcement mode (DECIDED)**

Both are **prompt-advisory** (reasoning rules), not server-enforced.

Rationale:
- B2 is *partly* already server-enforced via the visual gate
  (`VISUAL_ASSERTIONS_REQUIRED`, `VISUAL_EVIDENCE_MISSING`). The
  generalization to "canonical design = scope baseline" is a reasoning
  rule agents apply when deciding whether to flag a gap; it cannot be
  checked server-side without a Figma diffing pipeline that does not exist.
- B3's intra-precedence tie-breaker is inherently a reasoning rule —
  the server cannot detect which two constitution sections an agent is
  weighing. Advisory is correct and sufficient; the value is in making the
  tie-breaker explicit so agents do not invent their own.

No server changes required.

**Skill propagation blast radius (DECIDED)**

B1 (terse carve-out) and B2 (design-baseline generalization) need forward
references in skill files that have implementation-level scope decisions:

| Skill file | Propagation | Rationale |
|---|---|---|
| `skill-sr-engineer.md` | B2 forward-ref | Implements design-backed widgets; Design-Aware Pre-Flight already exists; R7 already says "flag, don't assume" but does not reference the constitution B2 rule |
| `skill-design-auditor.md` | B2 forward-ref | Defines the design baseline; B2 is the policy that elevates its output to scope-law |
| `skill-coordinator.md` | None | Coordinator routes and dispatches; it does not make MVP scope decisions; B3 tie-breaker is a constitution-level rule the coordinator inherits by default |
| `skill-qa-engineer.md` | None | QA scope rules (copy/visual audit gates) already enforce fidelity; B1's terse carve-out is constitution-level and inherited; adding a skill-level reference would risk restatement (constitution §4 prohibition) |
| `skill-pm.md` | None | PM's Ambiguity Gate and spec schema already enforce gap-flagging; B2 is consumed downstream by sr-engineer/design-auditor, not PM |

B1 (terse carve-out) does NOT require skill-level propagation — it is a
global output-directive correction at §1 level; all roles inherit it. Adding
per-skill references would violate the constitution "skills MUST NOT restate
these rules" prohibition (line 4).

### Blocking Dependencies

None. All evidence verified inline:
- `index.ts:651` confirms `tw_sync` is pre-flight-gated (A1).
- `index.ts:824` / `index.ts:850` confirm both error-code strings (A2).
- `tools/evidence-file.ts:342–349` confirms `REQUIRED_VISUAL_SECTIONS` verbatim (A2).
- `scripts/check-version.mjs` confirmed to NOT read the constitution header (A3).
- No external URLs, Figma links, or ticket references in the PRD brief.

---

## Task List

Tasks are bootstrapped below and submitted via `tw_add_task`. Orphan tasks
T470/T478–T481 from prior sessions are left untouched (pre-existing drift,
out of scope per §3.2 R10 report-only policy).

```
- [ ] T-DRIFT-A1 [P1] Constitution §3: add tw_sync to the pre-flight list and name it as the only sanctioned ledger→tasks.md reconcile op in the "Task list edits" rule | depends_on: none
- [ ] T-VISUAL-A2 [P1] Constitution §3.1 + §4: document VISUAL_REPORT_INCOMPLETE (v3.26.0) and VISUAL_ASSERTIONS_REQUIRED (v3.27.0) with the 6 required report sections verbatim from REQUIRED_VISUAL_SECTIONS | depends_on: none
- [ ] T-VERSION-A3 [P2] Constitution header: bump to v3.27.0 per the A3 policy; add a one-line policy comment near the header | depends_on: none
- [ ] T-WORDING-A4 [P3] Constitution §3.2: soften "authored under the qa chain" to "accepted and owned by the qa chain at PASS time (server validates report schema, not file authorship)" | depends_on: none
- [ ] T-TERSE-B1 [P1] Constitution §1 Terse rule: add carve-out — cap does NOT apply when surfacing a blocker, flagging an assumption gap (§7), or stating acceptance criteria | depends_on: none
- [ ] T-MVP-B2 [P1] Constitution §1 MVP strict: add design-baseline generalization — canonical design is the scope baseline for design-backed work; gap = fidelity defect, not MVP compliance; must flag per §7 | depends_on: none
- [ ] T-PRECEDENCE-B3 [P1] Constitution ## Document Priority: add intra-precedence tie-breaker (correctness §2/§3/§6/§7 > efficiency §1) and circuit-breaker escape (§5 trip → Blocked/FAIL, never error-laden PASS) | depends_on: none
- [ ] T-SKILLS-PROP [P1] Propagate B2 design-baseline forward-reference to skill-sr-engineer.md and skill-design-auditor.md (one line each, no restatement per constitution line 4) | depends_on: T-MVP-B2
```
