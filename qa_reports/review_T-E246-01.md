# QA review — T-E246-01 (e246-mailbox-teardown)

Reviewed commit 8b2afd3 (code-reviewer APPROVED at 1463b25). Spec: `specs/e246-mailbox-teardown.md`.

## Expected-Red Diff
Phase 0.5: skipped (no expected-red manifest declared)

## Phase 1 — Review
Read `removeLaneMailbox` / `mailboxKeepReason` in `bin/agc-init.mjs`: lstat-based entry check, only regular files named as the two message files or `.*.watch-lock`; liveness = `process.kill(pid,0)` with EPERM = alive; all fs errors downgraded to a single kept-warning; mailbox root never removed; ordering as spec (after `removeWorktreeNoForce`, before `branch -d`).
- 3a Copy Audit: `removed mailbox` / `kept mailbox` lines, usage paragraph (`_mailbox/<lane>/`), SOP stage 3 / stage 6 sentences, lane-protocol line all match the Copy table; no unlisted user-facing string (the extra reasons `not a plain directory`, `unreadable (...)`, `delete failed (...)` fall under the `kept mailbox <path>: <reason>` template; noted, not a gap).
- 3b Visual Audit: N/A (no visual tokens).
- Phase 1.5: skipped (no Visual Baselines declared).

## Phase 3 — Tests
Phase 3: placement per dispatch brief — created `test/e246-mailbox-teardown.test.mjs` (pre-authorized). Real-git temp repos; mailbox under the temp worktree parent, never the real lanes mailbox. Coverage: every new branch of `removeLaneMailbox` is exercised (absent, clean, dead lock, live lock, unparseable lock x4 shapes, unknown file, subdirectory, symlink, refused removal, branch -d refusal). Security smoke: symlink entry whose target is outside the mailbox is neither followed nor deleted.

### AC -> test map
| AC | test case(s) |
|---|---|
| AC1, AC8 | shipped removes clean mailbox |
| AC2 | abandoned removes clean mailbox |
| AC3 | dead watch-lock sidecars are removed |
| AC4 | unknown entry keeps folder and warns (+ subdirectory, symlink variants) |
| AC5 | live watch-lock keeps folder and warns; unparseable watch-lock keeps folder and warns |
| AC6 | absent mailbox is a silent no-op; sibling mailbox untouched |
| AC7 | shipped mailbox removed even when branch -d refuses (real refusal built via a stale `refs/heads/<branch>.lock`); refused worktree removal leaves mailbox |
| AC9 | usage text mentions mailbox |
| AC10 | integrator SOP names mailbox reset and finish cleanup (+ e178a/skill-frontmatter green) |
| AC11 | lane-protocol names mailbox lifecycle |
| AC12 | git diff --stat check below |

The AC7 `branch -d` case was NOT dropped: a real refusal was constructible, so the code-reviewer's diff-reading fallback is not needed.

## AC Execution Log
- AC1/AC2/AC3/AC4/AC5/AC6/AC7/AC8/AC9/AC10(case)/AC11: `node --test test/e246-mailbox-teardown.test.mjs` -> exit 0, `# tests 15 # pass 15 # fail 0`. PASS.
- AC10 (existing pins): `node --test test/e178a-integrator-role.test.mjs test/skill-frontmatter.test.mjs` -> exit 0, 28 tests, 0 fail (1 skipped pre-existing). PASS.
- AC12: `git diff --stat main...HEAD` lists only `.current/e246/*`, `bin/agc-init.mjs`, `content/skill-integrator.md`, `docs/lane-protocol.md`, `review_reports/`, `specs/` (plus this commit's `test/e246-*` and `qa_reports/`). No `scripts/`, `docs/install.md`, other `content/**`, `tools/**`, `dist/**`. PASS.

## Result
Full-suite result recorded in the verdict write.
## 2026-09-30T10:27:14.527Z — PASS — by qa-engineer

T-E246-01 PASS. test/e246-mailbox-teardown.test.mjs: 15/15 green, covering AC1-AC11 (AC12 via git diff --stat: only owned paths). The AC7 'branch -d refuses' case was built with a real refusal (stale refs/heads/<branch>.lock), so it was not dropped. Full npm test with clean worktree: 3010 pass / 3 skipped / 0 fail of 3013. e178a and skill-frontmatter pins unchanged and green. Copy audit clean; no expected-red manifest. Evidence: qa_reports/review_T-E246-01.md.

