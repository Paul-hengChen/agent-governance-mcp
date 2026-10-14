<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E298-01 E298 (1): `.github/workflows/ci.yml` push trigger branches become `[main, 'feat/**', 'integ/**', 'release/**']` (E170 option (i) folded in); `pull_request` trigger unchanged.
- [ ] T-E298-02 E298 (5): `agc feature finish --shipped` also deletes the remote lane branch (`git push origin --delete <branch>`) after the local `git branch -d`; no `origin` remote, no remote-tracking ref, or a failed push (offline / auth / remote ref already gone) is a one-line hint and exit 0, never a failure; push runs with GIT_TERMINAL_PROMPT=0; usage text in `bin/agc-init.mjs` updated.
