# Review — T-E232-02

Commit `8f014a4`, judged on its own diff (per-task review).

## Summary
- Scrubs all three leak classes from 33 spec files, +100/−100. `specs/fanout-*.md` is not touched, as required.
- Class 1: the 3 employer-internal work-item URLs become "(the internal work-item tracking this decision; URL not reproduced here)".
- Class 2: codename mentions become "prior visual rollout" / "prior-rollout" wording. `specs/decodename-cleanup.md` uses a `<client-codename>` redaction marker, because that spec is about the literal itself.
- Class 3: absolute paths become `<lanes-root>`, `<repo-root>`, `~/`, or repo-relative links.
- The 4 spec referrers of the renamed research file now point at the new path.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `specs/figma-baseline-manifest-gate.md`, `specs/figma-baseline-manifest-gate-architecture.md`, `specs/figma-baseline-mechanical-selection.md`. `git grep -E <class1>` over the tree at d8f09d9 finds 0 hits.
AC2 — implemented (specs slice) — 0 class-2 hits under specs/.
AC3 — implemented (spec referrers) — `specs/constitution-restructure.md` (2 refs), `specs/decodename-cleanup.md`, `specs/qa-flow-enforcement-architecture.md`, and `specs/server-scope-decision-gate.md` all cite the new path. No file anywhere carries the old prefixed path.
AC4 — implemented (specs slice) — 0 class-3 hits under specs/ outside `specs/fanout-*.md`, which is out of scope and belongs to E235.
AC5 — n/a.
AC6 — deferred to qa. The suite is green.

## Correctness
No required findings.
- The AC1 replacement does not cite a backlog ticket id. That matches the AC, which asks for one only "where the surrounding sentence needs a citable pointer", and none of the three sentences needs one.
- optional: some `file://` links were converted to relative links whose targets no longer exist: `../content/constitution.md` in `specs/constitution-v3.5-cognitive-discipline.md` and `specs/lite-mode-coordinator.md`. The old absolute links pointed at the same missing file. This is carried-over link rot, not a regression.
- The `specs/decodename-cleanup.md` rewording ("A third-party client's private product codename (redacted here as `<client-codename>`, in both its upper- and lowercase forms)") keeps the spec's meaning, and its reference table stays readable.

## Quality
No findings. The placeholder vocabulary is consistent across files. `<lanes-root>` stands for both historical lane roots, which is acceptable because the distinction carried no information.

## Architecture
No architecture spec. Docs only.

## Security
No findings. The replacement text brings in no new identifier. The home-relative placeholder keeps the adopter project directory name. That name is not one of the three E232 leak classes and already appears throughout the tree (backlog, CHANGELOG, dist comments), so the edit adds nothing new. Whether that name should be treated as sensitive is a separate question for a future ticket, not E232 scope.

## Performance
Not applicable.

## Verdict
APPROVED — all three classes are gone from specs/, the referrers point at the new path, and the replacements are neutral.
