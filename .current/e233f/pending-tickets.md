# Pending tickets — lane e233f

```pending-ticket
lane_local_id: E233F-NEW-1
title: skill-release-engineer step 13a cites its own line numbers, and they are already stale
priority: P3
depends_on: [E233]
source: e233f code review (T-E233F-01..03), optional note O4
body: |
  Step 13a in content/skill-release-engineer.md refers to other places in the same file by line number
  (":143" and ":196"). Those numbers were already out of date before lane e233f started; they now point
  at the wrong lines (the intended targets are about lines 145 and 207). Line numbers drift on every edit,
  so replace them with a reference to the step or heading name. This is a rule-text change, which is
  outside E233's comment-only scope.
```

## Applied
