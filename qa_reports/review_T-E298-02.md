# QA review — T-E298-02 (finish --shipped remote branch delete), round 1: PASS

Test file: test/e298-finish-remote-delete.test.mjs, 10 tests total (commit c816251); scratch repos + bare origin under os.tmpdir(), torn down in after().
Phase 0.5 / 1.5 / 3.5: skipped (none declared). Copy audit: hint strings asserted verbatim in tests.

| AC | verdict | test |
|---|---|---|
| AC3 origin + tracking ref -> push --delete, stdout line, branch gone on bare origin | PASS | "AC3: finish --shipped with origin + tracking ref deletes the branch on origin ..." |
| AC4 no origin -> stderr hint, exit 0 | PASS | "AC4: no origin remote -> stderr hint, exit 0" |
| AC5 no tracking ref -> hint, exit 0, no network | PASS | "AC5: never pushed ... no network call even with unreachable origin" (origin set to nonexistent path before finish; no could-not-delete line) |
| AC6 push fails -> hint, exit 0, local branch deleted, worktree removed | PASS | "AC6a: ... origin unreachable after push ..." and "AC6b: remote branch already deleted but tracking ref remains ..." |
| AC7 --abandoned unchanged; prior lines still printed first; non-main --base | PASS | "AC7a: --abandoned keeps the branch and never touches origin"; AC3 asserts ordering (deleted branch line before remote line, removed worktree still printed); "AC7b: --base other than main (integ/wave) still deletes the remote branch" (integ/wave on origin survives) |
| No ls-remote | PASS | "source: new code carries no ls-remote" (helper body) + grep of bin/agc-init.mjs: zero hits |
| dist unchanged | PASS | git diff --stat 6b8a195..HEAD -- dist/ empty |

Regression: five existing finish test files 117/117 pass. Full suite (final HEAD, clean tree, node scripts/test-lock.mjs -- npm test): 3052 pass / 3055 total, 0 fail, 3 skipped. Build green; npm audit --audit-level=high: no high/critical.

## Reviewer's non-blocking notes — judged non-blocking (no AC violated)
- Comment "never stall on a credential prompt" (bin/agc-init.mjs ~2767): overstated for SSH passphrase/host-key prompts, no timeout; no AC covers it. Recommend softening wording.
- AC5 wording when pushed via a non-origin remote: AC text is satisfied as written.
- Stale tracking ref left after an AC6 failure: AC6 specifies hint + exit 0 only.
- Delete push runs the repo's pre-push hook: not specified; observation only.
