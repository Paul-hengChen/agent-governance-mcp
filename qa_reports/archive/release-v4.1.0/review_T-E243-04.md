# Review — T-E243-04

## Round 1 — PASS — by qa-engineer

Spec: `specs/e243-init-path-escape-refusal.md`. Depends on T-E243-03 (APPROVED round 1,
`review_reports/review_T-E243-03.md`). No architecture spec exists for this feature
(`dispatch_mode: "feature"`, single-file same-class generalization of E239).

## Expected-Red Diff

`qa_reports/expected-red_e243-init-path-escape-refusal.txt` exists (2 entries, both against
`test/e239-init-subdir-exclude.test.mjs`: the old-copy AC8 and AC13 cases). Ran the full suite
BEFORE editing either test file to confirm both were red and nothing else was:

```
$ git stash && node --test test/e239-init-subdir-exclude.test.mjs test/e108-eject.test.mjs
```

Result before this round's edits: 46 pass, 2 fail — the 2 failures were exactly
`AC8: gitignore-metacharacter subdir name refuses local mode cleanly` and
`AC13: agc check advises rather than mis-tests on a gitignore-unsafe subdir path`, both failing
only on the pinned old message-text substring (`one of * ? [ ]`), matching the manifest's own
description. `git stash pop` restored this round's edits.

Disposition: **clean (2/2 manifest entries confirmed red, 0 unexplained reds)**. Both entries are
now dispositioned by this round's AC12 work (message-text assertions updated to match AC9/AC10's
new copy) — see the AC Execution Log below and the Phase 4 full-suite run.

## Repro-First Red (against base 3663b3a, per the spec's Dependencies note)

Before authoring AC15-AC20, extracted `bin/agc-init.mjs` as it existed at the lane's base commit
and ran the new scenarios against it standalone in a throwaway `$TMPDIR` fixture (not committed —
this is the required red-before-fix evidence, same discipline as this suite's own AC1/AC2 note):

```
$ git show 3663b3a:bin/agc-init.mjs > $TMPDIR/agc-init-base.mjs
$ grep -n 'GITIGNORE_WILDCARD_RE\s*=' $TMPDIR/agc-init-base.mjs
1293:const GITIGNORE_WILDCARD_RE = /[*?[\]]/;
```

- **Backslash** (`a\b`): `init --artifacts=local` did NOT refuse — it wrote
  `.current/.config.json` declaring `"local"` and wrote `/a\b/.current/` (and 3 sibling rules) into
  `.git/info/exclude`. `git check-ignore -v 'a\b/.current/foo'` → exit 1 (no match) — the rule git
  actually parses is `/ab/.current/` (backslash consumed as gitignore's own escape character).
  `git status --short` confirmed the real directory as untracked: `?? "a\\b/"`. This is exactly the
  "created but not actually ignored" defect this ticket names.
- **CR** (`x\rdir`): `init --artifacts=local` also did not refuse; a raw `0x0D` byte landed in the
  shared `.git/info/exclude`, splitting the one intended rule across lines (confirmed via `xxd`).
- **LF** (`x\nx`): same — did not refuse; the written exclude file grew from 10 to 14 lines (4 new,
  all beginning with the pre-LF fragment `/lf`), confirming the embedded LF split one intended rule
  into multiple exclude-file lines.
- **BEL** (`x\x07x`, sampling AC3's C0/DEL class): same — did not refuse; wrote a rule containing
  the directory name verbatim, raw control byte included.

All four confirm the gap this ticket closes actually existed before the fix. Full transcript is
this round's own session (not re-pasted here per the SOP's "details go in files" — the commands
above are reproducible against the same base commit).

## Copy Audit Gate (Phase 3a)

Spec's Copy / Strings table has 3 entries (`init.local.unsafe-segment-refusal`,
`check.local.unsafe-segment-advisory`, `install.local.unsafe-segment-sentence`) — all implemented
by T-E243-03, already verified word-for-word by code-reviewer (`review_reports/review_T-E243-03.md`
AC9/AC10/AC11). Re-verified independently this round:

```
$ grep -n 'unsafe for a gitignore exclude rule' bin/agc-init.mjs | head -1
524:        `contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character), ` +
$ grep -c 'one of \* ? \[ \]' bin/agc-init.mjs
0
$ sed -n '1168,1170p' bin/agc-init.mjs
        `agc check — cannot verify artifacts drift: workspace path segment "${escapeSegmentForDisplay(workspace.unsafeSegment)}" ` +
          `contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character) ` +
          `— rename the directory, or declare artifacts explicitly via agc init --artifacts=repo\n`
$ grep -n 'unsafe for a gitignore exclude rule' docs/install.md
150:- When a directory name below the repo root in the workspace path contains a character unsafe
    for a gitignore exclude rule — a wildcard (`*`, `?`, `[`, `]`), a backslash (`\`), or a control
    character (including CR and LF) — ...
$ grep -c 'gitignore wildcard character' docs/install.md
0
```

No drift, no coverage gap — all three strings match the spec's table verbatim, and the old
four-character enumeration is gone from all three surfaces.

## Visual Audit Gate / Phase 1.5

`Phase 1.5: skipped (no Visual Baselines declared)` — spec's Visual Tokens / Visual Widgets tables
are both `N/A` (CLI-only feature, no design file for this feature).

## AC Execution Log

Spec has no `proof:`-annotated ACs in the `proof:` sentinel format used elsewhere (E3+) — this spec
instead states, per-AC, an explicit test-name or grep proof inline. Treating each as the equivalent
of a `proof:` annotation (same spirit — a concrete, reproducible check), executed here in full and
recorded before PASS.

| AC | proof | command | result |
|---|---|---|---|
| AC1 | new case "AC15" | `node --test --test-name-pattern="AC15" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC15: backslash subdir name refuses local mode cleanly` — 1 pass, 0 fail |
| AC2 | new case "AC16" | `node --test --test-name-pattern="AC16" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC16: CR/LF subdir name refuses local mode cleanly` — 1 pass, 0 fail |
| AC3 | new case "AC17" | `node --test --test-name-pattern="AC17" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC17: other C0/DEL subdir name refuses local mode cleanly` — 1 pass, 0 fail |
| AC4 | existing AC8/AC9 continue to pass | `node --test --test-name-pattern="^AC[89]:" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC8...`, `ok 2 - AC9...` — 2 pass, 0 fail |
| AC5 | new case "AC18" | `node --test --test-name-pattern="AC18" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC18: backslash/control-character subdir name is fine under explicit repo mode` — 1 pass, 0 fail |
| AC6 | sr code-reading confirmation (T-E243-03) + new case "AC19" | `node --test --test-name-pattern="AC19" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC19: agc check advises rather than mis-tests on a backslash/control-character path` — 1 pass, 0 fail |
| AC7 | sr code-reading confirmation (T-E243-03) + new eject case | `node --test --test-name-pattern="AC7 \(E243\)" test/e108-eject.test.mjs` | `ok 1 - AC7 (E243): eject skips the exclude-line plan entry cleanly on a wildcard or backslash workspace, same shape for both` — 1 pass, 0 fail |
| AC8 | architectural — single predicate location | `grep -n "GITIGNORE_UNSAFE_SEGMENT_RE" bin/agc-init.mjs` | 3 matches: the constant definition (:1300), its one use inside `repoRelativeWorkspacePrefix` (:1332), and a comment (:517) naming it — no second character-class test at any of the three call sites (`init` :521-524, `check` :1166-1170, `planExcludeEntry` :3370) |
| AC9 | grep pair | see Copy Audit Gate above | `unsafe for a gitignore exclude rule` matches; `one of \* ? \[ \]` — 0 matches |
| AC10 | same grep pair, `check` advisory | see Copy Audit Gate above | template string at :1168-1170 matches AC10's Copy/Strings text word for word |
| AC11 | grep pair, `docs/install.md` | see Copy Audit Gate above | `unsafe for a gitignore exclude rule` matches at :150; `gitignore wildcard character` — 0 matches |
| AC12 | `npm test` — AC8/AC13 cases pass | `node --test --test-name-pattern="^AC(8\|13):" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC8...`, `ok 2 - AC13...` — 2 pass, 0 fail |
| AC13 | sr code-reading confirmation (T-E243-03) + win32 skip guards | every AC15-AC20 case and the new eject AC7 case opens with `if (process.platform === "win32") { t.skip(...); return; }`, following `test/e130-lane-default.test.mjs`'s loud-skip precedent | present in all 7 new/modified cases |
| AC14 | new case "AC20" | `node --test --test-name-pattern="AC20" test/e239-init-subdir-exclude.test.mjs` | `ok 1 - AC20: message printed for a CR/LF/ESC segment contains no raw control byte` — 1 pass, 0 fail |

No proof could not be run; none skipped silently.

## Security Smoke (Phase 3d)

Boundary inputs for this ticket's own surface: backslash, CR, LF, BEL (0x07), US (0x1F), DEL (0x7F)
and ESC (0x1B) directory-name segments (AC15-AC20 above) — each proven to refuse cleanly in local
mode, proceed cleanly in repo mode, and never leak a raw control byte into a printed message. NUL
(0x00) is excluded per the spec's own reasoning (cannot occur in a real path segment on any
filesystem). No new auth/permission surface — `agc init`/`check`/`eject` remain a local CLI acting
on the caller's own working tree, same as every existing suite in this repo covering them. Existing
oversized-payload / empty-string boundary tests in both files (`boundary: a very long garbage
flag...`, `boundary: an empty-string argument...`) are unmodified and still pass (see Phase 4).

## Correctness

No findings beyond what T-E243-03's code review already recorded (the one optional stale comment at
`bin/agc-init.mjs:1129-1130`, non-blocking, not qa-engineer's to fix).

## Coverage

Tooling: no coverage instrumentation configured in this repo's `npm test`. Every AC in this spec has
an explicit, executed proof (AC Execution Log above) — 6 new test cases (AC15-AC20) plus 1 new eject
case (AC7) plus 2 updated pinned-message assertions (AC12), covering all of AC1-AC14 exercisable via
test.

## Phase 4 — Full Suite Run (after commit)

Committed on `feat/e243-init-path-escape-refusal` (commit `05e388f`, `test(e243): E243 T-E243-04 —
backslash/control-char refusal coverage + eject/message-escape proof`). Worktree was clean (`git
status --short` — no output) before running.

```
$ npm test
```

**2914/2917 pass, 0 fail, 3 skipped** (`duration_ms: 161255.814542`). The 3 skips are pre-existing
and unrelated to this change (none of AC15-AC20 or the new eject AC7 case skip on this platform —
`process.platform === "darwin"` here, confirmed by the isolated per-file runs above showing 0
skipped in both `test/e239-init-subdir-exclude.test.mjs` (20/20) and `test/e108-eject.test.mjs`
(35/35)). Build (`npm run build`, part of the `pretest` hook) completed with zero errors. CI
runnability: `npm test` ran headlessly to completion with zero human interaction.

`test/e106-init-artifacts-flag.test.mjs` (the one file this lane's dispatch brief allows editing
only if it goes red because of this change) stayed green — 18/18, unmodified.

## Verdict

**PASS.** T-E243-04's full scope (AC1-AC14, plus the expected-red diff, the repro-first red
evidence, and the message-echo escaping proof) is implemented, tested, and green. No untracked
files remained in the worktree at run time.
## 2026-09-28T09:35:32.251Z — PASS — by qa-engineer

T-E243-04 PASS. Repro-first red confirmed against base 3663b3a (backslash/CR/LF/BEL segments did not refuse; backslash produced an exclude rule git reads as /ab/.current/ — git check-ignore returned no match and the real dir showed untracked; CR/LF wrote raw control bytes into the shared exclude file, splitting lines). Expected-red diff clean (2/2 manifest entries dispositioned via AC12's message-text update). Added AC15-AC20 to test/e239-init-subdir-exclude.test.mjs (backslash/CR/LF/other-C0/DEL refusal, repo-mode pass-through, agc check advisory, message-echo escaping proof — no raw CR/LF/ESC byte in printed output) and a new AC7 case to test/e108-eject.test.mjs (planExcludeEntry's unsafeSegment skip covers the widened class, same shape as the wildcard case). All new tests carry win32 skip guards per AC13. Copy Audit Gate: AC9/AC10/AC11 verified word-for-word via grep, no drift, no coverage gap. Full suite after commit (05e388f, e0061d8), clean worktree: 2914/2917 pass, 0 fail, 3 pre-existing unrelated skips. See qa_reports/review_T-E243-04.md.

