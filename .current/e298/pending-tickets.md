# Pending tickets — lane e298

```pending-ticket
lane_local_id: E298-NEW-1
title: finish --shipped remote delete — soften the credential-prompt comment, drop the stale tracking ref after a failed delete
priority: P4
depends_on: [E298]
source: code-reviewer round 1 non-blocking notes, confirmed by qa round 1
body: |
  The remote lane-branch delete step in `agc feature finish --shipped` ships as specified
  (hint + exit 0 on every failure). Two follow-ups the reviewer flagged and QA judged
  non-blocking: (a) its head comment says the push can never stall on a credential prompt,
  but GIT_TERMINAL_PROMPT=0 does not cover SSH passphrase / host-key prompts and the call has
  no timeout — reword the comment or add a timeout; (b) after a failed delete the local
  refs/remotes/origin/<branch> tracking ref is left behind, so a re-run keeps hitting the
  same hint — consider `git update-ref -d` on the tracking ref when git reports the remote
  ref does not exist. Also the agc check comment advisory (long block at the helper head).
```

## Applied
