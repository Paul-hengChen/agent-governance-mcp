# Manual verification — e466-conductor (S9)

Scenario S9 (device-or-person): a real two-wave run rotates the integrator. A person runs this once on macOS with
iTerm2, after code-reviewer PASS, and records the result in the lane's stop record. No automated test stands in for it.

## Setup

- [ ] macOS with iTerm2 installed; `gh` authenticated for the repository; the lane launcher's host checks pass
      (trust entry for the primary checkout, no fallback model, automatic continue on).
- [ ] This repository (or a small project) on `main`, with `npm run build` done and `dist/tools/conductor.js` present.
- [ ] An approved discussion record whose wave table has at least two waves (or an approved fan-out manifest with
      at least two `波次`), committed. Note its path: ______________________
- [ ] `.current/.config.json` `waveDoneAt`: `merged` (default) / `pr-open` (circle one). Run once with `merged`;
      a second run with `pr-open` is optional.
- [ ] No `agc-conductor.json` in the directory `git rev-parse --git-common-dir` prints (or it says `step done`).

## Run

1. [ ] Open a new Claude Code session in the primary checkout and invoke `/mcp__agent-governance-mcp__conductor`;
       give it the discussion record path.
2. [ ] The conductor runs `node scripts/conductor.mjs state` (prints `step none`), then `open --record <record>`.
       Seen: one new iTerm2 window (integrator 1) receives `/mcp__agent-governance-mcp__integrator`, then
       `fan-out <record>`. Window id printed: ______
3. [ ] The conductor arms a Monitor on `<git common dir>/agc-conductor/to-lane.md` with `mailbox-watch.mjs`.
4. [ ] Integrator 1 plans, starts wave 1 with the lane launcher, and carries wave 1 through Stage 6.
5. [ ] At the `waveDoneAt` moment, integrator 1 writes a `type: report` (`re: wave-done 1`) to the conductor's
       `to-lane.md`, first item `- 做了什麼：wave 1 of <manifest>, pull request #<n>`.
6. [ ] The conductor runs `conductor.mjs wave-done`. If a fact is unmet: integrator 1 stays open, a reply appears in
       `to-integrator.md` naming the fact; after the fix and a new report, run again.
7. [ ] **Integrator 1 closed after wave 1**: its window receives `/exit` and the session ends
       (`closed integrator — window <id>` printed).
8. [ ] **Finished lane windows closed**: each wave-1 lane window whose lane finished receives `/exit` and closes; a
       lane whose ticket reads `stopped — …` keeps its window.
9. [ ] **Integrator 2 takes over wave 2**: a new window receives `/mcp__agent-governance-mcp__integrator` then
       `接手 <manifest>，開始第 2 波次`; integrator 2 runs *Take-over*, Stage 3 checks 1–3, then starts wave 2 with
       the launcher (`opened integrator — wave 2, window <id>` printed). Window id: ______
10. [ ] Integrator 2 carries wave 2 to its wave-done report; the conductor closes it and the finished lane windows.
11. [ ] On the last wave, `wave-done` prints `all waves done — <manifest>`; the conductor notifies the human and
        stops; no further integrator window opens and no other manifest is started.
12. [ ] `node scripts/conductor.mjs state` prints `step done`; `git status` in the primary shows no conductor file.

## Optional checks

- [ ] Close the integrator window by hand mid-wave (before its report): at the next watch expiry `conductor.mjs check`
      prints `integrator gone — wave <n> of …; no new window opened`, the conductor tells the human, and no window opens.
- [ ] Close the conductor session mid-run, open a new one: `conductor.mjs state` shows the same manifest, wave, window
      id and step, and the new conductor continues from there.

## Result

- Date / person: ______________________
- Pass / fail, with the step that failed and what was seen: ______________________
