# Review — T-E288-01

covers: T-E288-01, T-E323-01

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff `dac6069..HEAD` (impl commit `1d7304f`): additive SOP text in `content/skill-integrator.md` (optional Stage 0, Work overview row 0, Permissions row 5, Lifecycle row 0, invocation stages 0–3, Stage 1 `Input:` line, Stage 2 one-approval sentence, cross-repo hand-off note), one Gate Summary row in `content/skill-pm.md`, one step 6 sub-item `f.` in `content/skill-qa-engineer.md`, plus the expected-red manifest.
- Scope matches the approved cut: `node scripts/fanout.mjs check specs/fanout-post-v4-w5.md e288 --base main` exits 0 (9 files changed, 0 out of bounds). No test, `dist/`, constitution or coordinator file touched.
- All 11 Copy literals appear verbatim (scripted check against the spec's Copy table; `int.stage0.path` occurs twice, everything else exactly once).
- `### Mid-wave base fix` and `## Stage 6` (through *Your own commits*) are byte-identical to the base (same sha1 of the extracted sections at `dac6069` and `HEAD`).
- Verdict: APPROVED. Only optional findings. Same-model note: sr-engineer is pinned to opus and this review also ran on opus, so the two may share blind spots.

## AC Completeness
AC-E288-1 — implemented — `content/skill-integrator.md:71` heading sits between `## Governance state (D11)` (:67) and `## Stage 1` (:81); overview row 0 at :24 above row 1 (:25); Lifecycle row 0 at :57 above row 1 (:58); invocation "(stages 0–3)" at :65.
AC-E288-2 — implemented — `content/skill-integrator.md:73` (skip when already cut; runs only on a scope draft or a cross-repo hand-off note).
AC-E288-3 — implemented — `content/skill-integrator.md:75` (Task dispatch, `specs/ticket-cut-<feature>.md` only, no spec / `tasks.md` / write-type `tw_*`, brief does not restate the protocol), :77 (approved together with the manifest at Stage 2), :83 (Stage 1 `Input:` names the Stage 0 cut file), :94 (one approval covers both).
AC-E288-4 — implemented — `content/skill-integrator.md:40` is the single new row (verbatim `int.perm.row`). The `cannot` cell at :38 is unchanged, and the table has 5 body rows (:37–41).
AC-E288-5 — implemented — `content/skill-integrator.md:79` (four parts in order, the human carries its path, first Decisions row, `出處` = sending repo plus repo-relative path, never absolute).
AC-E288-6 — implemented — `content/skill-pm.md:113` is the only `**Integrator Stage 0 cut**` row, directly after `**Manifest-Tier Self-Attestation**` (:112), verbatim `pm.stage0.row`. The Cut-Approval header literal (:117) occurs once.
AC-E288-7 — implemented (author side) — measured 4823 ~tok using the `test/context-budget.test.mjs` method (test output), which is ≤ the approved 4860 ceiling. The cap re-pin is T-E288-02 (qa). The current 4708 red is declared in the expected-red manifest.
AC-E288-8 — implemented — no `-` line in the pinned sections (see Summary). e246, e297, e286, e295, e296 and e178a are green; e178a AC6 (historical) still SKIPs, and T-E323-02 removes that skip.
AC-E323-1 — N/A this round — qa task T-E323-02 (test rewrite).
AC-E323-2 — N/A this round — qa task T-E323-02.
AC-E323-3 — implemented — `content/skill-qa-engineer.md:77` is the only sub-item `f.`, verbatim `qa.resident-hygiene`. `grep -c 'never diff against a fixed lane base sha'` gives 1. Top-level steps are still `1..7` (:28–86), and qa-visual-skill-split AC-4 is green.
AC-E323-4 — implemented (author side) — 18066 bytes ≤ the D1-approved 18500. The re-pin is T-E323-02. The 17900 red is declared in the expected-red manifest.
AC-LANE-1 — implemented — fanout check exit 0.
AC-LANE-2 — deferred to qa (final suite on the committed HEAD after T-E288-02 / T-E323-02).

## Correctness
No required findings.

Consistency checks against the rest of the integrator SOP, the PM SOP and the constitution:
- **D11 / Permissions**: Stage 0 adds no integrator state write, and the PM it dispatches makes none ("no write-type `tw_*`", PM row "(reads stay)"). The existing `tw_update_state` cannot-cell is untouched. The new cannot cell "Dispatch PM for anything else (spec, tasks, state writes)" keeps PM dispatch bounded to the cut file.
- **Constitution §3.1 / human approval**: neither file lets the integrator approve for the human. The integrator text says the cut file "is approved together with the manifest at Stage 2", and Stage 2 still needs "the human's explicit yes in this session". The PM row says "the human approves the file with the integrator's manifest". The PM row's "Do not halt for approval" does not contradict the PM Cut-Approval Gate, because that gate triggers only before routing to a build role, and a Stage 0 PM never routes or writes `cut_approved`.
- **Constitution §6 git grant**: unaffected. Committing the cut file with the manifest follows *Your own commits* (docs branch landed by pull request).
- **Decisions / `出處`**: the hand-off-note row uses the existing Decisions table (`日期 | 裁決者 | 內容 | 出處`). "never an absolute path" agrees with the comment-hygiene and pull-request-body rules.
- **5c-1 authority for `NEW-<n>` rows**: matches spec D5. Ticket admission is still covered by the human's Stage 2 approval, so the *always the human* column ("whether a new ticket enters the current milestone") is not bypassed.

Expected-red sampling (step 4a): `qa_reports/expected-red_e288-integrator-stage0-and-test-hygiene.txt` has 2 entries, and both were sampled. `test/context-budget.test.mjs` contains `AC1/AC2: skill-pm stripped token count meets ≤ 4708 cap` (:475), and `test/qa-visual-skill-split.test.mjs` contains the AC-5 byte-count test. Across 15 targeted test files (305 tests), exactly these 2 tests fail, with no unexplained red.

- optional — `content/skill-integrator.md:83`: "a spec, or a wave of the execution plan, or the Stage 0 cut file" has two "or"s in one list. This is the wording the spec prescribes ("append `, or the Stage 0 cut file`"), so it is faithful. A later tidy could change it to "a spec, a wave of the execution plan, or the Stage 0 cut file".
- optional — `content/skill-integrator.md:79`: the hand-off-note Decisions row does not name its `裁決者` value. :218 requires exactly `人類` or `整合者`, and `fanout.mjs validate` rejects anything else, so a wrong value fails loudly. Naming `人類` (the human carried the note) would remove one judgement call.
- optional — `content/skill-integrator.md:88` (Stage 1 step 4, unchanged) says "goes back to PM". When the cut came from Stage 0, the permission row at :40 leaves it implicit whether a re-dispatch to revise the cut file counts as "Stage 0 only". A reasonable reading says it does, because it is still the ticket-cut file only.
- optional — `content/skill-pm.md:113`: the row does not say that the Resource Audit (`external_refs` on a state write), Question Batch (`AskUserQuestion`) and Ambiguity (`Blocked` write) gates are bypassed in Stage 0. "No write-type `tw_*`" and "open question as a `needs human ruling` item" cover them by implication. The literal is pinned by the spec, and the PM budget has zero headroom, so this is a spec-level note, not an sr defect.

## Quality
No findings. The new prose matches the surrounding SOP style: bold step leads, tables extended in place, no new headings beyond the specified one, and no new HTML comments (so step 4b's comment check has nothing to flag).

## Architecture
No `specs/e288-integrator-stage0-and-test-hygiene-architecture.md` (no architect hop, per the cut). The layering matches D4: one inline Stage 0 section is the single copy of the hand-off-note template, and the PM row carries the protocol so the brief does not restate it.

## Security
No findings. No secrets, no local absolute paths: `git grep` for `/Users/`, `/home/` and `/private/` over the 4 touched tracked files finds nothing. No internal links or sensitive information.

## Performance
No regression in prompt budget beyond the approved ceilings: skill-pm is 4823 ≤ 4860 ~tok, and skill-qa-engineer is 18066 ≤ 18500 bytes. skill-integrator grew from 30705 to 32492 bytes (+1787) and is not capped. It is not composed into any golden, and compose-equivalence and e90 are green.

## Verdict
APPROVED — every in-scope AC is implemented with verbatim Copy literals, the pinned sections are byte-identical, scope is clean, and the only reds are the two declared, qa-owned cap re-pins.
