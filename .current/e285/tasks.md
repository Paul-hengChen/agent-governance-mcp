<!-- schema_version: 2 -->
# Tasks

## Active

- [ ] T-E336-01 [P1] sr: E336 — replace every `git pull --ff-only` literal with `git -c pull.rebase=false pull --ff-only` (const-15 1, coord-03 1, integrator 4, release-engineer 6); nothing else in the three borrowed files; one reason clause in integrator Git operations (spec AC-E336-1..3) | depends_on: none
- [ ] T-E294-01 [P1] sr: E294 — lane-protocol §1 only: EnterWorktree(path=<worktree>) after feature start, confirm pwd + git branch --show-current as separate calls, cd fallback when the tool is unavailable, git-guard finding (one plain git command per call); AC7-safe line lengths (spec AC-E294-1..5) | depends_on: none
- [ ] T-E285-01 [P1] sr: E285 — integrator SOP: P1 close handoff sub-bullet + Stage 6 step 7 rewrite (pending decisions, new-session recommendation, continue after handoff --check); 接手 <manifest> mode + Take-over section; O9 2-hour idle stop with watch-stop handoff; P4 MUST-verifier for every local full suite + Output differences bullet; O11 advisory; keep pinned sentences (spec AC-E285-1..7, AC-HC-2) | depends_on: T-E336-01
- [ ] T-E336-02 [P1] qa: E336 — re-pin e297 AC1/AC7, regenerate compose goldens, re-measure context-budget caps (exact, zero headroom, explained), new test/e336-portable-pull.test.mjs; AC-E336-2 at review time (spec AC-E336-4) | depends_on: T-E336-01
- [ ] T-E294-02 [P1] qa: E294 — new test/e294-lane-enterworktree.test.mjs (AC-E294-1..3, AC-E294-5 structural half); AC-E294-4 at review time; e177a AC7 green unchanged (AC-HC-1) | depends_on: T-E294-01
- [ ] T-E285-02 [P1] qa: E285 — new test/e285-integrator-session-handoff.test.mjs (AC-E285-1..7); re-pin owned SOP tests turned red, each explained (AC-HC-2); owned-files-only check (AC-HC-3); single final full suite via node scripts/test-lock.mjs -- npm test on final committed HEAD, clean tree (AC-HC-4) | depends_on: T-E285-01, T-E336-02, T-E294-02
