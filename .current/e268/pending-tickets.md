# Pending tickets — lane e268

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

## Applied
