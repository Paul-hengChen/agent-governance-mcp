# Pending tickets — lane e268

## Applied

```pending-ticket
lane_local_id: E268-NEW-1
title: The teamwork subagent template tells the agent to Read the retired content/skill-coordinator.md; fix the path, then tighten the subagent-templates delegate regex
priority: P3
depends_on: [E272]
source: lane e268 PM cut (E272 investigation), confirmed by the integrator pre-review; human chose E272 option 1 on 2026-10-07
body: |
  templates/claude-code-agents/teamwork.md line 9 tells the subagent to load the coordinator SOP from
  content/skill-coordinator.md with the Read tool. That file no longer exists: the coordinator SOP is
  composed from the content/coord-01..07-*.md fragments by SKILL_SEGMENTS in prompts/skill-manifest.ts,
  where "skill-coordinator.md" survives only as a logical key. A subagent that follows the template
  reads a missing file.
  Two parts, one ticket:
  1. Fix the template's load instruction so it names a path or mechanism that exists (an edit in
     templates/**, a build-role change; check the installed copies under ~/.claude/agents/ are refreshed
     per the install docs).
  2. In the same change, tighten FILE_PATH_DELEGATES.teamwork in test/subagent-templates.test.mjs
     (qa-engineer edit) so it asserts the new text instead of the dead path. Lane e268 (E272 option 1)
     left that regex unchanged and commented that it pins the template's current text.
```

```pending-ticket
lane_local_id: E268-NEW-2
title: Two leftover comment nits in test files after lane e268 — over-wide pixel-gate-attestation lines and a bare ticket-id explanation in drift-skew
priority: P3
depends_on: [E268]
source: code-reviewer, lane e268 review (review_reports/review_T-E268-01.md, non-blocking findings), 2026-10-07
body: |
  Comment-only, qa-engineer edits (test/).
  1. test/pixel-gate-attestation.test.mjs: the E-section ruler comment (near line 622) grew to about
     133 columns when lane e268 named the two dist files it reads, and the header line naming the same
     files (line 5) is about 108 columns against about 85 for its neighbours. Rewrap both. The file
     already has other lines over 100 columns, so pick one width for the whole file.
  2. test/drift-skew.test.mjs (near line 202) explains a test with a bare old lane ticket id
     ("closes the former J2-NEW-9 gap"); replace it with a plain description of the gap.
  Prove behaviour-neutral the usual way (removeComments emit byte-identical before and after).
  Lane e268 did not fix these in-lane: item 2 is base text outside its approved range, and a rework round
  for item 1 would have cost about five more hops against the lane's hop cap.
```

```pending-ticket
lane_local_id: E268-NEW-3
title: Lane comment-proof scripts diff their scope check against the fixed base sha, so a main-into-lane merge produces a false scope VIOLATION
priority: P3
depends_on: none
source: fresh qa verifier, lane e268 (qa_reports/verify_E268_T-E268-06.md, AC14), 2026-10-08
body: |
  Lane e268's proof script (archived with the lane) builds its scope check from `git diff <base-sha>..HEAD`.
  After the integrator merged main into the lane (to pick up the dependency-advisory upgrades), the files
  main brought in showed up as out-of-scope and the script printed `scope: VIOLATION`, although
  `git diff main...HEAD` lists only lane-owned paths. The verifier had to discount the line by hand.
  Any future comment-trim / comment-accuracy proof script should compute scope against the merge-base with
  main (or the fan-out base the integrator uses), not a fixed base sha. Same "carry into the next proof
  script" class as the E271 proof-script note; no fix to an archived script is needed.
```
