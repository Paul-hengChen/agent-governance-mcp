# QA Review — T-CR-04-REV (and T-CR-02-REV verification)

- Feature: `constitution-restructure`
- Reviewer: qa-engineer
- Date: 2026-06-10
- Type: ZERO-CODE doc feature (human decision option a — ship rationale doc alone, constitution.md byte-untouched)
- Version target: v3.32.0 (doc-only; package.json intentionally NOT bumped)
- Verdict: **ALL ACCEPTANCE CRITERIA PASS** — see governance blocker note at end re: PASS transition.

## Acceptance Criteria results

### AC1 (HARD CONSTRAINT) — constitution.md byte-untouched — **PASS**
- `git diff --stat content/constitution.md` → empty (no output).
- `git diff content/constitution.md` → empty (no output).
- `grep -ni constitution-rationale content/constitution.md` → NONE (no reverse reference injected).
- Result: constitution.md is byte-for-byte unchanged. Hard constraint satisfied.

### AC7 — rationale doc exists, well-formed, covers §1/§3.1/§3.2/§5/§7 with one-way refs — **PASS**
- File present: `content/constitution-rationale.md` (209 lines, well-formed markdown — single H1, blockquote preamble, five H2 sections, fenced cross-ref notes balanced).
- Section coverage verified by heading + content:
  - §1 — MVP zero-tolerance, Visual-Widgets exception (v3.14.0), Design-baseline scope (v3.27.0). Cites CDE-OOBE retrospective §1.1/§1.4/§1.7, taxonomy A1.
  - §3.1 — PASS gates server-side; visual-evidence gate (v3.16.0), report-schema gate (v3.26.0/v3.27.0), scope-decision gate (v3.30.0). Cites taxonomy B1/B4/B6, finding A0.
  - §3.2 — visual-verdict authority, builder≠judge role-collapse guard, no-global-frame metric (false-PASS prevention), sequential-context reconcile clause R10. Cites the CDE-OOBE false-PASS war-story (taxonomy B1/B2, D1/D2/C5).
  - §5 — anti-loop circuit breaker hard caps; cites process-retrospective (~1.05M tokens, 55.6% rework, 15.6h idle).
  - §7 — external-reference policy; cites finding A0, taxonomy C5/A6.
- One-way reference direction verified: each section opens with `See Constitution §N.` (lines 21/58/106/171/191) — refs point FROM rationale TO constitution section ids. The doc's own preamble states the one-way contract explicitly (lines 6-8). No reverse ref in constitution.md (grep NONE).

### AC2 / token — no bundle token regression — **PASS (by construction + verified)**
- constitution.md untouched (AC1), no `content/skill-*.md` changes, no `prompts/build.ts` change → lite bundle ≤ 2,527 ~tok invariant holds by construction.
- Belt-and-suspenders: `npm test` green (601/601), suite does not depend on the new doc.

### AC9 — npm test passes — **PASS**
- `npm test` → `# pass 601 # fail 0 # cancelled 0 # skipped 0` (duration ~11.5s). Headless, zero human interaction (CI-runnable).

### CLAUDE.md layout entry present — **PASS**
- `git diff CLAUDE.md` shows exactly one added line in the `content/` block:
  `content/constitution-rationale.md  non-normative "why" behind §1/§3.1/§3.2/§5/§7 (one-way refs into constitution; v3.32.0)`
- Discoverability hook present and correctly placed under `content/constitution.md` entry.

### No .ts / build-script / package.json changes — **PASS**
- `git diff --stat` (tracked) touches only: `.current/handoff.md`, `CLAUDE.md` (+1), `tasks.md` (+6).
- Untracked: `content/constitution-rationale.md` (the deliverable), `specs/constitution-restructure.md` (PRD).
- Confirmed NO changes to `prompts/build.ts`, `scripts/measure-context-cost.mjs`, or any `.ts` file. `package.json` untouched (version bump deferred per brief).

## Spec-to-AC map
| AC | Evidence | Result |
|----|----------|--------|
| AC1 | git diff content/constitution.md empty | PASS |
| AC7 | doc present, 5 sections, one-way refs | PASS |
| AC2 | constitution+build untouched; npm test green | PASS |
| AC9 | 601/601 tests pass | PASS |
| CLAUDE.md entry | git diff CLAUDE.md +1 line | PASS |
| No code change | git diff --stat file list | PASS |

## Phase notes
- Phase 1.5 (Visual Compare): skipped — no design file / no Visual Baselines (non-UI doc feature).
- Phase 3 (Tests): no new test coverage needed — zero-code doc feature; existing suite re-run as regression guard (601/601 green).

## Governance note — code-reviewer hop required by state machine
The ALLOWED_TRANSITIONS table (`tools/transitions.ts`) requires
`sr-engineer:In_Progress → code-reviewer:In_Progress → qa-engineer:In_Progress`.
There is no direct `sr-engineer → qa-engineer` edge. The REV-path tasks collapsed out
the code-reviewer hop, so qa cannot claim/PASS until a human switches code-reviewer in to
make the `code-reviewer:In_Progress` write. All substantive ACs already PASS — this is a
routing-chain gate, not a deliverable defect.
## 2026-06-10T11:10:57.366Z — PASS — by qa-engineer

PASS — All ACs verified per qa_reports/review_T-CR-04-REV.md. Re-confirmed two hard checks this pass: AC1 git diff --stat content/constitution.md empty (byte-untouched), AC9 npm test 601/601 green 0 fail. code-reviewer APPROVED (review_reports/review_T-CR-03.md): AC4/AC7 rationale doc covers §1/§3.1/§3.2/§5/§7 one-way refs, AC10 no reverse refs into constitution.md, zero .ts/build/package.json changes.

