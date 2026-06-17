# Review — T-RSH (retro-sop-hardening: T-RSH-01 / T-RSH-02 / T-RSH-03)

Reviewer: code-reviewer (opus) · clean-context diff judge
Base: HEAD (5902e98) · Scope: F2 retro-sop-hardening — pure governance-text, no code
Spec: `specs/retro-sop-hardening.md` (AC-1 / AC-2 / AC-3)

## Summary

- Three `content/*.md` SOP files are in the working tree as modified. The F2-relevant
  additions are: T-RSH-01 (design-auditor step 2b), T-RSH-02a (design-auditor Visual
  Widgets multi-value guard), T-RSH-02b (qa-visual Step A.5 multi-value guard), and
  T-RSH-03 (coordinator-lite scope-creep example).
- The three F2 text additions, judged in isolation, each satisfy their acceptance
  criterion, match the binding exact-text in the spec, and reference the constitution
  (§3.2, §5) and the retrospective (§四#2, §四#7) by pointer only — no rule restatement.
- The routing edge invoked by step 2b — `(design-auditor → Blocked)` then recovery to
  `(pm, In_Progress)` — is a real, pre-existing edge in `tools/transitions.ts`; not invented.
- **Blocking issue (working-tree contamination):** `content/skill-qa-visual.md` carries
  ~180 lines of churn (191-line diffstat, +107/−84) that does NOT belong to F2. It is the
  uncommitted F0 (`qa-visual-baseline-provenance`, feature-split order 0, status `done`)
  work — `VISUAL_PROVENANCE_MISSING` gate text, B1/B2 fingerprint blocks, references to
  `specs/qa-visual-baseline-provenance.md`. F2's spec scope is one appended bullet under
  Step A.5; the rest is out-of-scope per the spec's Out-of-Scope section and §1 MVP.
- Headline verdict: **CHANGES_REQUESTED** — not because the F2 text is wrong, but because
  the qa-visual diff cannot be reviewed/approved as F2 work; it mixes a second feature into
  the same change. The F0 churn must be isolated (committed under F0 / staged separately)
  before T-RSH can be handed to qa as a clean, single-feature diff.

## Correctness

- **AC-1 (T-RSH-01, `skill-design-auditor.md:30-35`)** — SATISFIED. Step 2b
  "Source-Credibility Classification (v3.38.0)" is inserted after 2a Volume Gate and before
  step 3 Extract. It enumerates the four categories (a) full-page composite / (b) component
  variant / (c) read-only overview / (d) other, and fires a STOP →
  `tw_update_state(status=Blocked, agent_id="design-auditor", … "next_role: pm")` on
  (b)/(c)/(d). The fetch-mode gate and image/pdf/paper/no-design skip mirror 2a exactly.
- **Routing-edge check (the requested adversarial item):** the step-2b transition is VALID.
  `tools/transitions.ts:133` allows `design-auditor:In_Progress → (design-auditor, Blocked)`;
  `:137` allows `design-auditor:Blocked → (pm, In_Progress)`, so `next_role: pm` is a real
  recovery edge, not an invented one. It is the identical pattern the existing 2a Volume Gate
  uses (`Blocked, agent_id="design-auditor", next_role: pm`) — fully consistent.
- **AC-2 (T-RSH-02a, `skill-design-auditor.md:22`)** — SATISFIED. The multi-value guard is
  appended to the Visual Widgets interactive-states inventory sentence ("…incomplete, not
  done."), requires per-context enumeration, forbids collapsing into one canonical entry, and
  cites `research/mode-feature-process-retrospective.md` §四#7. Matches spec exact-text.
- **AC-2 (T-RSH-02b, `skill-qa-visual.md:45-53`)** — the *content* of the bullet SATISFIES
  the AC: per-context guard under Step A.5 Rules, requires recording both contexts as
  separate baselines or flagging for re-audit + FAIL, references §3.2 builder≠judge and §四#7
  by pointer. (Its delivery is the blocking issue — see Architecture.)
- **AC-3 (T-RSH-03, `skill-coordinator-lite.md:33`)** — SATISFIED. New scope-creep example
  "Fix the visual / make it match Figma" names Constitution §5 anti-loop, routes cross-file
  visual-fidelity iteration to `/teamwork` + `qa-visual` (full), and permits lite ONLY for a
  one-shot environment-exclusion diagnosis. Matches spec exact-text.

## Quality

- The two design-auditor additions and the coordinator-lite addition are surgical (8-line and
  1-line diffs) and voice/heading/numbering-matched to each file (2b numbering follows the
  2a precedent; the scope-creep bullet matches the existing `**"…"** — … → **full**.` format;
  the qa-visual guard matches the bullet voice of the Step A.5 Rules block).
- The qa-visual file is the opposite of surgical: a 191-line diffstat. Every block outside the
  one F2 bullet (Step A widget rules rewording, Step B0/B1/B2 provenance fingerprint blocks,
  Step C table edits, Allowed Differences, Rationale) is F0 content. Mixing two features in one
  uncommitted file is a convention-drift / hygiene defect for this single-feature change.

## Architecture

- F2 is declared `scope_decision: single-feature`, "three `content/*.md` files, surgical text
  additions only, no server/build/schema change" (spec Dependencies + Out of Scope). The
  working tree violates that: `skill-qa-visual.md` carries the full F0 provenance rewrite, and
  git status shows F0's `tools/evidence-file.ts`, `dist/`, and untracked
  `specs/qa-visual-baseline-provenance*.md` all uncommitted. F0 (feature-split order 0) is
  marked `done` but was never committed, so its diff is bleeding into F2's review surface.
- Consequence for this gate: a clean-context reviewer cannot approve `skill-qa-visual.md` as
  F2 work — the AC-2b bullet is correct, but it is not separable from ~180 unrelated lines in
  the same hunk range. Handing this to qa as `completed_tasks=[T-RSH-02]` would attribute the
  F0 churn to F2 and pollute the F2 PASS evidence.

## Security

- N/A — governance text only. No injection vectors, secrets, or boundary changes introduced by
  any of the three F2 additions.

## Performance

- N/A — no executable code path. The qa-visual provenance text (F0) does add runtime gate
  parsing, but that is F0 scope and out of bounds for this review.

## Verdict

**CHANGES_REQUESTED** — The three F2 text additions are individually correct and meet
AC-1/AC-2/AC-3, but `content/skill-qa-visual.md` is contaminated with the entire uncommitted
F0 (`qa-visual-baseline-provenance`) rewrite, breaking F2's single-feature scope and making the
qa-visual change un-approvable as F2 work.

### Required to clear

1. Isolate the F0 churn: commit `qa-visual-baseline-provenance` (skill-qa-visual.md provenance
   blocks, `tools/evidence-file.ts`, `dist/`, its specs) under its own feature/commit, so the
   F2 diff for `skill-qa-visual.md` reduces to ONLY the `Context-dependent multi-value guard
   (v3.38.0)` bullet under Step A.5 (current lines 45-53).
2. Re-present the F2 diff (T-RSH-01/02a/02b/03) as a clean three-file, additions-only change.
   No edits to the F2 text are required — it passes on content.

---

## Round 2 — APPROVED — by code-reviewer (opus)

Re-review on a now-clean working tree. The Round 1 blocking issue (scope
contamination) has been resolved by the coordinator committing F0 separately.

### What changed since Round 1

- **F0 isolated**: `qa-visual-baseline-provenance` is now committed as `c02372a`
  ("feat(qa-visual): baseline-provenance gate (F0, v3.38.0)"). That commit carries the
  182-line `skill-qa-visual.md` provenance rewrite, `tools/evidence-file.ts` (+142),
  `dist/`, and the F0 specs/evidence — i.e. exactly the churn that bled into the
  Round 1 review surface. No F2 text was reworked (none was needed; Round 1 approved all
  F2 content).
- **Working tree now clean**: live `git status` shows `content/skill-qa-visual.md` as the
  only modified file in the F0/F2 overlap; `tools/evidence-file.ts` and dist/ are no longer
  dirty (committed in F0). The session-start git snapshot is stale and superseded.

### Re-verified findings

- **Diff scope**: `git diff content/` is now exactly three files, +17/−1.
  `skill-coordinator-lite.md` +1; `skill-design-auditor.md` +8/−1 (the −1 is the in-place
  append to the existing Visual Widgets interactive-states sentence — a single-line edit);
  `skill-qa-visual.md` +9. Down from the Round 1 191-line (+107/−84) qa-visual diffstat.
  Additions-only in substance; no deletions of pre-existing rules.
- **Contamination gone (the gating check)**: `skill-qa-visual.md` now shows ONLY the single
  "Context-dependent multi-value guard (v3.38.0)" bullet under Step A.5 Rules. No
  VISUAL_PROVENANCE_MISSING gate text, no B1/B2 fingerprint blocks, no
  `specs/qa-visual-baseline-provenance.md` refs. Confirmed.
- **AC-1 / AC-2a / AC-2b / AC-3**: all still satisfied per Round 1 Correctness; the text is
  byte-identical to what Round 1 approved on content. Constitution refs (§3.2 builder≠judge,
  §5 anti-loop) and retrospective refs (§四#2, §四#7) remain by pointer only — no rule
  restatement (spec Out-of-Scope §115-116 honored).
- **Step-2b routing edge**: re-confirmed valid in `tools/transitions.ts` — `:133`
  `design-auditor:In_Progress → (design-auditor, Blocked)`, `:137`
  `design-auditor:Blocked → (pm, In_Progress)`. `next_role: pm` is a real recovery edge,
  mirroring the existing 2a Volume Gate. Not invented.
- **Quality / voice**: all three additions match their file's heading/numbering/bullet voice
  (2b follows the 2a precedent; the lite bullet matches the `**"…"** — … → **full**.` format;
  the qa-visual guard matches the Step A.5 Rules bullet voice).
- **Security / Performance**: N/A — governance text only, no executable path in the F2 diff.
- **MVP**: no over-reach — surgical text matching the binding spec exact-text; no
  server/build/schema change.

### Round 2 Verdict

**APPROVED** — The F2 working-tree diff is now a clean, three-file, additions-only
single-feature change; the sole Round 1 blocker (F0 contamination in `skill-qa-visual.md`) is
resolved by commit `c02372a`, and all F2 content findings (AC-1/AC-2/AC-3) continue to hold.
Ready for qa-engineer.
