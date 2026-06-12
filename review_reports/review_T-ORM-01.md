# Review — T-ORM-01 (orientation-reach-matrix)

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff vs HEAD touches two deliverable files: `content/skill-architect.md` (adds a Baseline Reachability Matrix sub-block) and `docs/backlog.md` (B7 close + an unrelated B8 addition).
- The skill-architect.md edit fully and correctly satisfies AC-01, AC-02, AC-03 — the substantive feature work is sound, internally consistent, and closes the test-reach gap the retrospective describes.
- Both HARD constraints pass: AC-05 (no model-tier / frontmatter / recommended_model change) and AC-06 (no `.ts/.mjs/.js/package.json` in diff) are grep-confirmed clean.
- AC-04 (B7 → done) passes with the exact required mechanism citations.
- **Blocker:** the diff also introduces a brand-new **B8 backlog entry** (summary row + full detail block) that is **NOT present in HEAD** and is **explicitly named in the spec's Out of Scope** ("Backlog items B6, B8 — separate features"). Out-of-scope work bundled into this task's diff fails the correctness gate.

## Correctness
- `content/skill-architect.md:29-35` — Baseline Reachability Matrix. AC-01 satisfied: block is MANDATORY, columns are stated *exactly* as required (`baseline id | canonical state description | reach mechanism (URL param / store seed / prop + exact value) | paper-verifiable (yes/no)`), one row per frozen baseline, paper-verifiable, and stated as a precondition to the Visual Harness Gate ("may not pass until every row has `paper-verifiable: yes`"). Correct.
- `content/skill-architect.md:34` — AC-02 co-location rule. Reach-hooks must ship in the SAME task as the surface, explicitly "NOT a reactive second task added after a QA FAIL." Correct.
- `content/skill-architect.md:35` — AC-03 pre-build self-check. Cheap, string/grep-level, run BEFORE the full visual build, explicitly to move discovery cost off the QA playwright stage. Correct.
- `docs/backlog.md:17` — B7 summary row flipped to `**done** — constitution §3.2 visual gates, content/skill-qa-visual.md, visual_round caps, and Visual Verdict Boundary (v3.26.0) own visual fidelity`. AC-04 satisfied; all four required mechanism citations present.
- `docs/backlog.md:18, 85-112` — **OUT-OF-SCOPE ADDITION.** A new B8 summary row plus a 28-line `## B8` detail block were added. `git show HEAD:docs/backlog.md` confirms no `B8` token exists in HEAD, so this is net-new content in the working tree under review. The spec's *Out of Scope* section reads: "Backlog items B6, B8 — separate features." This change does not satisfy any AC of T-ORM-01 and is expressly excluded. It must be removed from this task's diff (and pursued as its own feature if desired).

## Quality
- `content/skill-architect.md:29` — the `####` (h4) heading is the first h4 in any `content/*.md` file; the established convention nests sub-bullets, not heading levels, under the `## Artifact Schema` h2. This is a minor convention drift, not a blocker — the deeper level is semantically defensible since the block sits under the `Visual Harness` bullet. Recommend (non-blocking) considering a bold-label bullet to match the sibling `Task ordering rule` style, but the h4 is acceptable.
- `content/skill-architect.md:30` — the `<!-- rationale:start --> … <!-- rationale:end -->` fence is the correct established convention (recognized by `prompts/build.ts` `stripRationale` at lines 71-73; the retrospective's ~529k-token war-story is appropriately fenced as non-`fullDetail`-strippable rationale). Good convention adherence.
- Prose is internally consistent with the surrounding Visual Harness section — references `design/<feature>.md` `## Visual Baselines`, the Visual Harness Gate, and "block back to PM," all matching the existing SOP vocabulary (cf. SOP step 4a).

## Architecture
- No `specs/orientation-reach-matrix-architecture.md` present (governance-doc change, no architect hop per the spec's Dependencies/Chain). Nothing to check against.
- The matrix block is correctly positioned as a sub-deliverable of the existing Visual Harness Artifact-Schema entry, and the gate-precondition wording dovetails with the existing `4a. Visual Harness Gate` SOP step. Architecturally coherent.

## Security
- Governance prose only. No injection vectors, no secrets, no boundaries. N/A.

## Performance
- Documentation change. No runtime code path affected; `npm run build` (tsc) exits 0. No regression. N/A.

## Verdict
**CHANGES_REQUESTED** — the substantive feature work (AC-01..AC-06) is correct, but the diff bundles an out-of-scope B8 backlog entry that the spec's Out of Scope explicitly excludes; remove the B8 summary row and `## B8` detail block from `docs/backlog.md`, leaving only the B7-close edit, then re-submit.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- **Round 1 verdict CORRECTED.** The sole Round-1 blocker (out-of-scope B8 entry) rested on a mis-attribution: "net-new vs HEAD" was read as "authored by sr-engineer." Net-new-vs-HEAD only proves the lines are *uncommitted* — not that they were authored in this T-ORM-01 session.
- **B8 is pre-existing, out-of-feature-scope user documentation, not a T-ORM-01 deliverable.** Independently re-confirmed: `git show HEAD:docs/backlog.md | grep -c B8` → 0 (absent from HEAD); the B8 row + `## B8` block are present in the working tree; the coordinator's session-start `git diff docs/backlog.md` (recorded 2026-06-11) already showed them — i.e. they predate sr-engineer's T-ORM-01 edit, which touched only the B7 summary row.
- Corroborating evidence: the B8 block is dated `figma-url-placeholder analysis (2026-06-11)` (a different workstream, predating this 2026-06-12 session); its text appears nowhere in `specs/orientation-reach-matrix.md` or `research/orientation-process-retrospective.md`. The spec naming B8 in *Out of Scope* is itself proof B8 was a known pre-existing backlog item at spec-authoring time, not something this feature created.
- Recording a deliberately-deferred backlog item is correct backlog hygiene; deleting the B8 lines would destroy the user's own pre-existing edit. B8 is therefore **out of feature scope, not a scope-bleed blocker.**
- AC-01..AC-06 re-verified against the diff: all PASS. No genuine new defect found in the T-ORM-01 changes themselves.

## Correctness
- `content/skill-architect.md:29-35` — Baseline Reachability Matrix. AC-01 PASS (re-confirmed): MANDATORY block, columns exactly `baseline id | canonical state description | reach mechanism (URL param / store seed / prop + exact value) | paper-verifiable (yes/no)`, one row per frozen baseline, stated precondition to the Visual Harness Gate ("may not pass until every row has `paper-verifiable: yes`").
- `content/skill-architect.md:34` — AC-02 co-location PASS. `content/skill-architect.md:35` — AC-03 pre-build self-check PASS.
- `docs/backlog.md` B7 row — AC-04 PASS; all four mechanism citations present (§3.2 visual gates, `content/skill-qa-visual.md`, `visual_round` caps, Visual Verdict Boundary v3.26.0).
- `docs/backlog.md` B8 row + `## B8` block — **NOT a T-ORM-01 change.** Out-of-feature-scope, pre-existing, correctly left intact. No longer a blocker.

## Quality
- No change from Round 1: the `####` h4 in `skill-architect.md` remains a minor, non-blocking convention note (first h4 in any `content/*.md`). Acceptable as-is.

## Architecture
- Unchanged from Round 1: no architecture spec to check against; the matrix block is coherently positioned as a Visual-Harness sub-deliverable.

## Security
- Governance prose only. N/A.

## Performance
- Documentation change. No runtime path affected. N/A.

## Verdict
**APPROVED** — scoped to T-ORM-01. AC-01..AC-06 all PASS; the Round-1 B8 blocker is withdrawn as a mis-attribution (B8 is pre-existing, out-of-feature-scope user documentation, not sr-engineer's work and not a deliverable of this feature).
