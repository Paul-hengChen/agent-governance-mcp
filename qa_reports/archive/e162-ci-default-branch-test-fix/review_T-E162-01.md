# Review: T-E162-01 — fix environment-dependent test defect in test/e115-join-precondition.test.mjs

**Ticket class**: backlog-row-as-spec equivalent (routed by release-engineer per
skill-release-engineer.md :153, "npm test regression -> qa-engineer"); no
PM/ARCH this round. Ships as v3.115.1 (release itself is a separate dispatch).

## Diagnosis confirmed

`test/e115-join-precondition.test.mjs`'s `mkGitRepo()` helper (line 68, pre-fix)
called `execFileSync("git", ["init", "-q"], { cwd: root })` with no branch
pinned. Four call sites (AC1's two tests, lines 116/126/151/158 pre-fix) then
run `git checkout -q main` against that scratch repo. On a machine whose global
`init.defaultBranch` happens to be `main`, the scratch repo's initial branch is
`main` and all 23 subtests pass. On a machine without that config — every
GitHub Actions runner — git's built-in default (`master`) applies and the two
`checkout -q main` calls inside the AC1 tests die with
`error: pathspec 'main' did not match any file(s) known to git`. This exactly
matches CI run 35699511268 (node 22): `not ok 464` / `not ok 465`, both AC1.

Confirmed independently before making any change:
```
TMPC=$(mktemp -d); printf '[init]\n\tdefaultBranch = master\n' > "$TMPC/gitconfig"
GIT_CONFIG_GLOBAL="$TMPC/gitconfig" node --test test/e115-join-precondition.test.mjs
```
Pre-fix result: `# tests 23 / # pass 21 / # fail 2` (AC1 pair), matching the CI
failure signature exactly. This machine's own config (`init.defaultBranch=main`
locally) explains why the original 2234/2234 figure was never
environment-independent.

`tools/join-precondition.ts` / `dist/tools/join-precondition.js` were grepped
and confirmed to contain no `'main'` literal — `checkLaneAncestry` calls
`git merge-base --is-ancestor <branch> HEAD`, which never names a branch by a
fixed string. The shipped module is not implicated; this is a test-harness-only
defect, confined to `mkGitRepo()` in this one file.

## Fix

In `mkGitRepo()` (test/e115-join-precondition.test.mjs), changed:
```js
execFileSync("git", ["init", "-q"], { cwd: root });
```
to:
```js
execFileSync("git", ["-c", "init.defaultBranch=main", "init", "-q"], { cwd: root });
```

**Route chosen and why**: the ticket names three options — `git init -q -b main`
(needs git >= 2.28), `git init -q` + `git branch -M main` (two calls, no
version floor), or `git -c init.defaultBranch=main init -q` (one call, no
version floor). Picked the third: it is a single call (no intermediate state
where the repo exists but isn't yet on `main`), and `-c init.defaultBranch=`
is a plain config override rather than a git-version-gated flag — it has
worked since `init.defaultBranch` itself was introduced, well before git 2.28,
and does not depend on any CLI convenience flag added on top of it.

## Same-class sweep of the rest of this file (as instructed)

Went through every other config assumption in `mkGitRepo()`:
- `user.email` / `user.name` — already explicitly set (lines 69-70 pre-fix).
  Not a defect; confirmed as the reason commits succeed regardless of any
  global `user.*` config (or its absence) on the host.
- **`commit.gpgsign` — found and fixed.** Nothing in the original helper set
  this. On a host with a global `commit.gpgsign = true` (common on developer
  machines that sign real commits) and no configured/available signing key,
  `git commit -q -m "init"` would fail (or hang waiting on a passphrase/agent)
  — the same class of "silently inherits host config" defect as the branch
  name, just triggered by a different host setting. Added
  `execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root });`
  immediately after the user.email/user.name lines, so every scratch commit
  in this file is deterministic regardless of the host's signing config.
- `core.autocrlf` — checked, no actionable defect found. This file's fixtures
  are written via `fs.writeFileSync` with explicit `\n`, and no assertion in
  the file compares raw file bytes or diffs line endings; nothing here is
  sensitive to CRLF/LF normalization. Also moot in CI specifically: this
  repo's only workflow (`.github/workflows/*.yml`) runs `runs-on: ubuntu-latest`
  only, where `core.autocrlf` defaults to `false` regardless of host config.
  Left unset — adding it would be defensive noise, not a fix for a real risk.
- Default hash algorithm (`init.defaultObjectFormat`, SHA-1 vs SHA-256) —
  checked, no actionable defect found. Every fixture in this file is a single
  self-contained repo; nothing cross-references object ids between two repos
  or hardcodes a hash length/format, so a host-level SHA-256 default would not
  break any assertion here. Left unset.

**Verdict on the class**: one additional instance (`commit.gpgsign`) found and
fixed in the same round, as asked; two other candidates checked and ruled
non-actionable for this file, with the reasoning above on record.

## Other files using the same `git init` (no `-b`/config override) idiom — reported, NOT fixed (separate ticket, out of scope this round)

Grepped `test/` for the same raw-`git init` pattern:
- `test/agc-adapters.test.mjs` — 3 call sites (`execSync("git init -q", ...)`
  at the `mkWorktreeFixture` helper and two standalone fixtures, currently
  around lines 913/1020/1119). None of these ever `checkout` a branch by
  name (`main` or otherwise) — they stay on whatever the initial checkout is
  — so they are in the same *idiom* family but are not currently exhibiting
  this *defect*: no observed or reasoned failure mode tied to branch naming.
- `test/check-md-tables.test.mjs:79` — `execFileSync("git", ["init", "-q"], ...)`
  in `mkFixtureRepo()`. Same idiom; also never checks out a named branch, so
  not currently broken by it.
- `test/verify-release.test.mjs:237-238` — calls `git init -q` immediately
  followed by `git checkout -q -b main`, i.e. it already pins the branch name
  itself right after init and does not rely on the inherited default. Not
  broken, and not really the same defect class (it self-corrects one line
  later) — listed only because it matched the initial grep.

No fixes applied to any of the above per the dispatch brief's scope discipline
(test-file placement restricted to `test/e115-join-precondition.test.mjs`
only) — filing as a separate ticket is the coordinator's/PM's call, not mine
this round.

## Verification (by execution, not read-through)

1. **Overridden-config run** (`GIT_CONFIG_GLOBAL` pointed at a gitconfig with
   `init.defaultBranch = master`) of `test/e115-join-precondition.test.mjs`:
   `# tests 23 / # pass 23 / # fail 0`. This is the exact CI-mimicking
   condition the ticket's acceptance test is anchored to.
2. **Normal-config run** (this machine's own config,
   `init.defaultBranch = main`) of the same file:
   `# tests 23 / # pass 23 / # fail 0`.
3. **Full `npm test`**: `# tests 2234 / # pass 2234 / # fail 0 / # cancelled 0
   / # skipped 0 / # todo 0` (duration ~96.2s). No flake observed this run,
   including `AC3b: GetPromptRequestSchema dispatches 'teamwork-lite'` (the
   E156 intermittent) — per the dispatch brief, that's a data point to report,
   not a problem to chase; not investigated further.
4. **`npm run build`**: clean, exit 0 (`check:version` OK at 3.115.0,
   `tsc` clean, `check:transitions-sync` OK, 21 keys).

## Scope discipline confirmed

- Only file touched: `test/e115-join-precondition.test.mjs` (the two edits
  documented above, both inside `mkGitRepo()`).
- `tools/join-precondition.ts` and `dist/` untouched — confirmed not
  implicated per the diagnosis above.
- No test logic/assertions rewritten; AC1's assertions were not re-litigated.
- No version bump, no CHANGELOG edit, no commit/tag/push — release-engineer's
  job, explicitly left undone here.

## Verdict

**PASS.** Root cause confirmed independently, fix applied narrowly (one
`mkGitRepo()` helper, two lines), same-class sweep done with one additional
fix (`commit.gpgsign`) and two non-actionable items on record, sibling-file
survey reported without touching any of them, and all four owed verification
runs executed with figures quoted above (not restated from any prior claim).

## Post-PASS correction (coordinator-flagged, comment-only)

The coordinator caught that the second comment block in `mkGitRepo()`
overclaimed: it named `init.defaultObjectFormat` (SHA-1 vs SHA-256 object
hash format) as pinned alongside `commit.gpgsign`, but the code only ever
sets `user.email`, `user.name`, and `commit.gpgsign` — no object-format
config is set anywhere. The code was correct (this review's own "same-class
sweep" section above already classified object format as non-actionable and
left it inherited, on purpose); only the comment misstated what the code
does, which is exactly the class of unchecked prose assertion E161 was filed
about — worth closing immediately in a file already open.

Reworded the comment (comment-only change; no `execFileSync` call, assertion,
or logic touched) from claiming the object format is pinned to stating it was
considered and deliberately left inherited, with the same rationale already
on record here (nothing in this file compares object ids across repos). New
comment text, in place of the old one:

```
  // Likewise pin commit identity and disable signing so a scratch commit
  // never depends on the host's global config: without this, a host with
  // global commit.gpgsign=true and no usable signing key would hang or fail
  // the commit below. (Considered and rejected: pinning the object hash
  // format, e.g. via init.defaultObjectFormat. Left inherited, not pinned —
  // nothing in this file compares object ids across repos, so a host-level
  // SHA-1 vs SHA-256 default is irrelevant to what this test verifies.)
```

Re-verified by execution after the comment edit:
- Overridden-config run (`GIT_CONFIG_GLOBAL` → `init.defaultBranch = master`):
  `# tests 23 / # pass 23 / # fail 0`.
- Normal-config run: `# tests 23 / # pass 23 / # fail 0`.

No state write made for this correction per the coordinator's instruction —
handoff remains `qa-engineer:PASS`, `next_role=release-engineer`.
Ready for release-engineer to cut v3.115.1.
## 2026-09-22T07:37:39.656Z — PASS — by qa-engineer

T-E162-01 PASS. Confirmed the diagnosed defect: mkGitRepo() in test/e115-join-precondition.test.mjs called `git init -q` with no branch pinned, so AC1's `git checkout -q main` calls die on any host without init.defaultBranch=main (every GH Actions runner) -- reproduced pre-fix with GIT_CONFIG_GLOBAL override: 23/23 -> 21/23 (AC1 pair red), matching CI run 35699511268 exactly. Fix: `git -c init.defaultBranch=main init -q` (chosen over `-b main`, which needs git>=2.28, and over the two-call `init` + `branch -M main`, which works but adds an intermediate not-yet-on-main state) -- single call, no version floor. Same-class sweep of the rest of mkGitRepo(): found and fixed one more inherited-config risk, commit.gpgsign (added `git config commit.gpgsign false`); checked core.autocrlf and default hash algo (init.defaultObjectFormat), both non-actionable for this file's assertions (no CRLF-sensitive comparisons, CI is ubuntu-only where autocrlf defaults false; no cross-repo hash-format comparisons) -- reasoning on record in the review doc. Surveyed test/ for the same raw `git init` idiom: agc-adapters.test.mjs (3 sites), check-md-tables.test.mjs:79 -- neither checks out a named branch so neither is currently broken by it; verify-release.test.mjs:237 already self-corrects via an immediate `checkout -q -b main`. Listed, not fixed (separate ticket, out of scope). tools/join-precondition.ts / dist/ grepped and confirmed NOT implicated (no 'main' literal; checkLaneAncestry uses merge-base --is-ancestor, branch-name agnostic). Verification by execution: (1) overridden-config run (init.defaultBranch=master) of the target file: 23/23; (2) normal-config run: 23/23; (3) full npm test: 2234/2234, 0 fail (E156's intermittent did not reproduce this run); (4) npm run build: clean, exit 0. Scope respected: only test/e115-join-precondition.test.mjs touched, no assertion logic changed, no version/CHANGELOG/commit/tag/push (release-engineer's). Full evidence: qa_reports/review_T-E162-01.md. No tasks.md row exists for T-E162-01 (ad-hoc backlog-row-as-spec ticket, no PM cut) so tw_complete_task was not called against a fabricated ledger id; T-E115-01/02/03 remain correctly [x] from the original round and are unaffected by this fix-forward patch.

