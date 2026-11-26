# Tests — e428-tracker-mirror (T-E428-01)

Author: qa-engineer. Scenarios: `specs/e428-tracker-mirror.md` AC1–AC13 (no ticket file; the spec's ACs stand in).
Test-file placement: the dispatch brief's `Test-file placement` line (new `test/e428-tracker-mirror.test.mjs`, plus
re-pins in four existing files); no split, so the spec's `proof:` file names stand unchanged.

## Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| AC1 | `test/e428-tracker-mirror.test.mjs` | AC1: spec-workshop has `## Tracker mirror` (C-SW2) directly after the unchanged last Outputs bullet and before `## Governance state`; served text carries it |
| AC2 | `test/e428-tracker-mirror.test.mjs` | AC2: imported tickets get no new item, a child item only on request, at most one created item (C-SW2, C-TF1 bullet 2, map rule) |
| AC3 | `test/e428-tracker-mirror.test.mjs` | AC3: without a mirror request nothing is written — C-SW2 opens with the request condition, C-TF1 bullet 6, C-IN1 `No row, no write.`, C-CO1 ends read-only |
| AC4 | `test/e428-tracker-mirror.test.mjs` | AC4: the Ticket files bullet carries C-SW1 in place of the old one-item sentence; e423 fragments kept; C-TF1 bullet 3; `source` field row byte-identical |
| AC4 (cross-check) | `test/e423-spec-workshop.test.mjs` | existing, unchanged; green at base and with the Copy |
| AC5 | `test/e428-tracker-mirror.test.mjs` | AC5 (format text): `## Tracker mirror` + `### Tracker map` are exactly C-TF1, after the unchanged `## Where ticket files are listed`, before `## Named tests checked in CI`; the map example parses |
| AC5 | `test/e428-tracker-mirror.test.mjs` | AC5 (behaviour): a map written into `git rev-parse --git-common-dir` is untracked with no ignore rule and is the same file from a linked worktree |
| AC6 | `test/e428-tracker-mirror.test.mjs` | AC6: integrator `## Tracker items` (C-IN1) sits after the Stage 6 *Your own commits* paragraph and before `## Git operations`; nothing else moves |
| AC7 | `test/e428-tracker-mirror.test.mjs` | AC7: a stop shows the stopped state and reason; the open question is drafted, never posted (C-IN1 bullet 3, C-TF1 bullet 5) |
| AC8 | `test/e428-tracker-mirror.test.mjs` | AC8: source items are written only when the map's `write-back` reads `on` (off by default, a person turns it on); no config key |
| AC9 | `test/e428-tracker-mirror.test.mjs` | AC9: coord-01 carries C-CO1 directly after the unchanged no-ticket-file paragraph and before `## Auto-Routing`; served teamwork carries it |
| AC9 (cross-check) | `test/e433-test-first-rules.test.mjs` | existing, unchanged; green at base and with the Copy |
| AC10 | `test/e428-tracker-mirror.test.mjs` | AC10: the source item's revision is compared at work start and before each code-reviewer dispatch; a change is reported, never copied (C-CO1 sentence 2, C-TF1 bullet 4) |
| AC11 | `test/e428-tracker-mirror.test.mjs` | AC11: where tracker content differs, the ticket file wins and the difference is reported (C-TF1 bullet 1, C-IN1 bullet 4, C-CO1 sentence 1) |
| AC12 | `test/e428-tracker-mirror.test.mjs` | AC12: every added or changed line in the four files holds no URL, repo-only path, bare ticket id, version label, quoted error code or vendor name |
| AC12 (proof part 2) | `test/e437-repo-only-paths.test.mjs`, `test/error-code-contract.test.mjs` | existing, unchanged; run in the full suite |
| AC13 | — | no dedicated test (see Open Interface Details 6); covered by the full suite, T-E428-04 and T-E428-05 |

Re-pins (integrator-assigned unowned pins, re-pin only, no logic change):

| file | test | change |
|---|---|---|
| `test/e445-spec-workshop-questioning.test.mjs` | AC10 (unchanged sections) | `BASE_SOP` holds C-SW1 in the Ticket files bullet and the C-SW2 section after Outputs |
| `test/e462-stale-comments-wording.test.mjs` | AC6 no other line of the SOP changes … | `FROZEN_SW_SOP` holds C-SW1 + C-SW2 (steps 4/5 replacements unchanged) |
| `test/e410-task-alias-content-tail.test.mjs` | AC2 site row; AC2 line count | `skill-integrator.md` row 260 → 269, count 261 → 270 |
| `test/e430-mailbox-outside-lane.test.mjs` | AC8 | newline count 260 → 269 (title kept, see Open Interface Details 5) |

Each re-pin carries a two- or three-line `E428 re-pin:` comment in the style of the existing E425/E430/E462 ones.

## Open Interface Details

1. **Base text frozen as sha256, not as full text.** The four touched files total ~77 KB at base; freezing them
   verbatim would bloat the test. Instead each file's base sha256 is frozen and the base is rebuilt from the
   current file by removing the Copy blocks (and swapping C-SW1 back to the old sentence); the rebuilt text must
   hash to the frozen value. That makes "no other line changes" exact (AC1/AC5/AC6/AC9 call it, AC12 diffs against
   the rebuilt base). The frozen hashes were taken from the worktree at `32e7f7e`, where the four files equal base.
   No history read, no fixed-sha diff (resident-test hygiene).
2. **AC12 changed-line scan** scans only the new part of a changed line (the text between its common prefix and
   suffix with the base line it replaced) — otherwise the C-SW1 bullet would be flagged for the base text it keeps
   (`.current/.config.json`, `docs/tickets/`). Added lines are scanned whole.
3. **AC12 deny list** is the spec's list plus `github`, `bitbucket`, `pivotal tracker`, `servicenow`; whole-word and
   case-insensitive. Also: no `/` outside `<agc install>/…`, no file name other than `agc-tracker-map.md`, no
   `.current` / `specs` / `qa_reports` / `dist`, ids matching `[A-Z]{1,4}-?\d{2,}` only `E900`/`E899`, no `v<digits>`
   version label, no backtick-quoted `UPPER_SNAKE` code, and no `snake_case` token (a tracker action named as a
   tool rather than by capability).
4. **AC5 split in two tests** (like e445 AC10): the format-text half (red at base) and the behaviour half (a
   throwaway git repo + one linked worktree in `os.tmpdir()`, cleaned up in `after`). The behaviour half tests
   git's property the Copy relies on, so it is green at base and is not in the manifest. It isolates git from
   user config (`GIT_CONFIG_GLOBAL` = null device, `GIT_CONFIG_NOSYSTEM=1`, inherited `GIT_DIR`-style variables
   dropped), and includes a control (the same file in the working tree does show in `git status`) so the empty
   status is not vacuous.
5. **e430 AC8 title kept** (`file stays 260 lines`): archived evidence (`qa_reports/review_T-E430-04.md`,
   `qa_reports/expected-red_e430-mailbox-and-verify-rule.txt`) names this test by title; the re-pin changes only the
   asserted count and message, and the comment says why the title still reads 260.
6. **AC13: no dedicated test.** Its parts are already pinned elsewhere — goldens by `test/skill-manifest.test.mjs`,
   caps by `test/context-budget.test.mjs`, the four re-pins above, `GATE_REGISTRY` 33 / pipeline 17 by the existing
   registry and `test/e35-pipeline-order.test.mjs` suites — and its proof is the full suite plus the
   `git diff --name-only 32e7f7e …` command, which T-E428-05 runs and the judge re-runs. A resident test diffing
   against `32e7f7e` would violate resident-test hygiene.
7. **Served text**: `buildPromptForRole("skill-spec-workshop.md", …)` and `buildPromptForRole("skill-coordinator.md",
   …)` in a fresh tmp workspace with `FileHandoffStorage`, as e423/e445/e258a do.

## Red Reasons

- AC1, AC4: C-SW1 / C-SW2 are not in `content/skill-spec-workshop.md` (T-E428-02).
- AC2: the C-SW2 imported-ticket sentences, C-TF1 bullet 2 and the map rule are absent (T-E428-02).
- AC3: C-SW2, C-TF1 bullet 6 (T-E428-02), C-IN1, C-CO1 (T-E428-03) are absent.
- AC5 (format text): C-TF1 is not in `docs/ticket-format.md` (T-E428-02).
- AC6: C-IN1 is not in `content/skill-integrator.md` (T-E428-03).
- AC7, AC8, AC11: C-IN1 bullets (T-E428-03) and C-TF1 bullets (T-E428-02) absent.
- AC9, AC10: C-CO1 is not in `content/coord-01-core-head.md` (T-E428-03).
- AC12: the Copy is not in the files, so the base rebuild cannot take it out.
- e445 AC10 (unchanged sections), e462 AC6: their frozen SOP now holds C-SW1 + C-SW2 (T-E428-02).
- e410 AC2 ×2, e430 AC8: their pins now expect the nine C-IN1 lines (T-E428-03).

## Probe

Copy applied verbatim to the four shipped files in the worktree, then restored from a scratch backup (sha256 of all
four re-checked equal to base): `test/e428-tracker-mirror.test.mjs` plus e423, e433, e445, e462, e410, e430, e425,
e455, e437 and error-code-contract — 191 pass, 0 fail. At base the same set shows exactly the 17 manifest entries
red (12 in the new file, 5 re-pins).

CI runnability: headless, no human interaction; the git test needs only a `git` binary on PATH (already required by
other suites).
