# Review — T-E250-06

covers: T-E250-01, T-E250-02, T-E250-03, T-E250-04, T-E250-05, T-E250-06

## Round 1 — by qa-engineer

## Summary
- Scope: author `test/e250-eject-path-escape.test.mjs` covering
  `specs/e250-eject-path-escape.md` AC1-AC11, AC13, AC14 (AC12 verified by
  grep), against the sr-engineer diff APPROVED in
  `review_reports/review_T-E250-01.md` (commit fd6b5d7, `8437af1..fd6b5d7`).
- No `qa_reports/expected-red_e250-eject-path-escape.txt` manifest exists —
  Phase 0.5 skipped.
- No `design/e250-eject-path-escape.md` exists (backend CLI output, no visual
  surface, confirmed in the spec's own Dependencies note) — Phase 1.5
  skipped.
- The spec's Acceptance Criteria carry a `proof:` line on all 14 entries
  (AC1-AC14) — Phase 3.5 (AC Execution Log) applies; see below.
- Full suite: **2955/2958 pass, 0 fail, 3 skipped** (`npm test`, see Phase 4).
- Verdict: **PASS**.

## Phase 0.5 — Expected-Red Diff
Skipped (no expected-red manifest declared for this feature).

## Phase 1.5 — Visual Compare
Skipped (no `design/<feature>.md`, no Visual Baselines).

## Copy Audit Gate
Spec's Copy / Strings table, 2 entries, both grepped verbatim against the
implementation:
- `control-char-manual-removal-note` — `bin/agc-init.mjs:3223`
  (`STR_EJECT_CONTROL_CHAR_NOTE`) matches the spec's quoted text byte for
  byte, including the em dash. Used at both call sites (the tracked-artifact
  `git rm -r` swap and the cannot-do item 4 `rm` swap).
- `AGC_HYGIENE_KEYWORDS` row (purpose cell) — `docs/config.md:204` matches
  the spec's quoted text byte for byte, including the reused anchor
  (`docs/config.md:29` links to the same
  `install.md#keeping-governance-artifacts-out-of-git-agc-init---artifactslocalrepo`
  anchor; confirmed the heading exists at `docs/install.md:133`).
No drift, no coverage gap.

## Visual Audit Gate
N/A — spec's Visual Tokens/Widgets tables are both empty by design (CLI
stdout/stderr text only).

## AC Execution Log

| AC | proof | command | result |
|---|---|---|---|
| AC1 | test "AC1" | `node --test --test-name-pattern="^AC1:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC2 | test "AC2" | `node --test --test-name-pattern="^AC2:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC3 | test "AC3" | `node --test --test-name-pattern="^AC3:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC4 | test "AC4" | `node --test --test-name-pattern="^AC4:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC5 | test "AC5" | `node --test --test-name-pattern="^AC5:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC6 | test "AC6" | `node --test --test-name-pattern="^AC6:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC7 | `npm test -- test/e108-eject.test.mjs` (unmodified) + test "AC7" | both run | e108: `# pass 35 / # fail 0`; AC7 case: `# pass 1 / # fail 0` |
| AC8 | test "AC8" | `node --test --test-name-pattern="^AC8:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC9 | test "AC9" | `node --test --test-name-pattern="^AC9:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC10 | test "AC10" | `node --test --test-name-pattern="^AC10:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC11 | test "AC11" | `node --test --test-name-pattern="^AC11:" test/e250-eject-path-escape.test.mjs` | `# pass 1 / # fail 0` |
| AC12 | `grep -n "AGC_HYGIENE_KEYWORDS" docs/config.md` | run directly | one table row at `docs/config.md:204`, plus the advisory-prose mention at line 48; anchor resolves to `docs/install.md:133` |
| AC13 | `npm test -- test/e108-eject.test.mjs` | run directly, file byte-identical to what code-reviewer saw (no lane task owns it) | `# pass 35 / # fail 0` |
| AC14 | embedded in AC1/AC3/AC4/AC5 (no separate test name) | same runs as AC1/AC3/AC4/AC5 above | each case additionally asserts the `--yes` filesystem effect (deletion/edit/left-untouched) matches the equivalent ordinary-path disposition — see test bodies |

All 14 proofs pass. No proof was unrunnable.

## Spec-to-Test Map
See the header comment of `test/e250-eject-path-escape.test.mjs` for the full
AC -> test-name table (reproduced from the spec's own AC -> Task table).
Every AC1-AC11/AC13/AC14 has exactly one authored case except AC13, which is
verified by the unmodified `test/e108-eject.test.mjs` passing in the full
suite (same precedent that file itself uses for its own AC22/AC23) — not
duplicated in-process here to avoid re-running that file's 35 tests inside
this one.

## Control-byte coverage
- LF: AC1, AC2 (workspace's own directory name), and again independently in
  AC10/AC11 ($HOME's own directory name — a non-git code path).
- CR: AC3, AC4, AC5, AC6 (subdirectory repo-relative prefix).
- ESC: AC8, AC9 (linked-worktree directory name).
- A combined LF+CR+ESC case is covered under `test/e250-eject-path-escape.test.mjs`'s
  `boundary:` test (SOP Phase 3d security/boundary smoke — this ticket's only
  new surface is display escaping, so the boundary case targets that surface
  rather than flag parsing, which is unchanged and already covered by
  `test/e108-eject.test.mjs`'s own boundary cases).
- Every control-char test asserts the raw injected byte (CR/ESC: whole-output
  `.includes()`; LF: single-line / exact-line-membership proofs, since LF is
  also `agc eject`'s legitimate line separator and a blanket "no raw 0x0A"
  check would be a false constraint) never reaches stdout/stderr, and that
  the escaped form (`\n`/`\r`/`\x1b`) is present in its place.

## Repro-red (base 8437af1)
Before trusting this suite, `bin/agc-init.mjs` was temporarily swapped for
the base commit's version and the new suite re-run against it, per this
lane's dispatch brief:

```
cp bin/agc-init.mjs /tmp/agc-init-fixed-backup.mjs        # byte-identical backup, not a git operation
git show 8437af1:bin/agc-init.mjs > /tmp/agc-init-base-8437af1.mjs
cp /tmp/agc-init-base-8437af1.mjs bin/agc-init.mjs         # temporary swap — never git checkout/reset
node --test test/e250-eject-path-escape.test.mjs
```

Result against the base file: **1 pass / 11 fail** (only "AC7: ordinary path
(no control character) — ..." passed, as expected — that case never touches
the escaping surface). Two representative failures:

- **AC1** (workspace path containing LF): the dry-run plan header actually
  printed was split across two physical lines by the raw LF byte (the string
  up to the LF, then a bare continuation line), so it never matched the
  expected single-line `agc eject — plan for <escaped-cwd> (dry-run; ...)`
  form — the exact defect this ticket closes.
- **AC6** (control-char-bearing tracked path): stderr showed
  `git rm -r xy/tasks.md` with the CR silently dropped by the base
  implementation's unescaped interpolation (the two path segments visually
  merged because the CR was swallowed by terminal/string handling upstream
  of the test's own capture) instead of the manual-removal note — the base
  file still emits a paste-me command for a path it cannot safely represent.

Restore, confirmed byte-identical (no diff), and confirmed green again:

```
cp /tmp/agc-init-fixed-backup.mjs bin/agc-init.mjs
git diff --stat -- bin/agc-init.mjs   # empty — no diff
node --test test/e250-eject-path-escape.test.mjs   # 12 pass / 0 fail
```

This transcript is not itself committed (repro evidence only, same
discipline as `qa_reports/review_T-E239-02.md`'s and
`qa_reports/review_T-E243-04.md`'s own repro-red notes).

## Phase 4 — Run
- Build: N/A (pure `.mjs`, no compile step for `bin/agc-init.mjs`).
- `test/e250-eject-path-escape.test.mjs`: 12/12 pass, CI-runnable headlessly
  (spawnSync with stdin closed, `os.tmpdir()`-rooted fixtures, isolated HOME
  per call, own git identity — never the ambient config).
- `test/e108-eject.test.mjs` (unmodified): 35/35 pass.
- Full suite `npm test`: **2955 pass / 0 fail / 3 skipped** (2958 total;
  prebuild + `node --test test/*.test.mjs`). The 3 skips are pre-existing
  platform-conditional skips elsewhere in the suite, not from this file
  (every case here ran, none skipped, on this darwin host).

## Verdict
**PASS.** All 14 ACs pass their declared proof (AC Execution Log above); the
Copy Audit Gate finds no drift or coverage gap; repro-red confirms the new
suite is red against base commit 8437af1 and green against the fix; the full
suite is green.
## 2026-09-28T15:19:24.429Z — PASS — by qa-engineer

T-E250-01..06 PASS. Authored test/e250-eject-path-escape.test.mjs covering AC1-AC11/AC13/AC14 (AC12 verified by grep against docs/config.md). LF/CR/ESC control-byte coverage across workspace path, subdir prefix, linked-worktree name and $HOME, plus an ordinary-path regression (AC7) and a combined-byte boundary case. AC Execution Log: all 14 declared spec proofs pass. Copy Audit Gate: no drift/gap. Repro-red confirmed against base 8437af1 (11/12 new cases red there; byte-identical restore verified, no tree diff left). Full suite green: 2955/2958 pass, 0 fail, 3 pre-existing skips. Evidence: qa_reports/review_T-E250-06.md.

