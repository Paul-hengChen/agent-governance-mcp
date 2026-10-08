# T-E269-05 authoring report (E269, E274) — qa-engineer AUTHOR session

Authoring only. No verdict, no PASS, no `tw_complete_task`. An independent code-reviewer (T-E269-06) then a fresh qa verifier (T-E269-07) judge these edits.

## Edits

1. **E274 titles** (`test/context-budget.test.mjs`): skill-pm title `≤ 4376` -> `≤ 4401`; skill-sr-engineer title `≤ 2642` -> `≤ 2852` (equal to the asserted caps). AC5.
2. **Caps** (human ruling, witnessed in the coordinator chat 2026-10-07). Re-measured by this session with `node --test test/context-budget.test.mjs` on the current content, before editing: lean 5567, design-arm stripped 10076, teamwork bundle 20453, non-design 7978 (identical to the sr/reviewer numbers). Each cap's title, assert and message set to the measured value, message says "E269 re-baseline"; the two inline comments restating 10057 / 7959 updated too. No other cap touched. Old numbers no longer appear in the file (grep clean). AC8.

   | cap | old | new |
   |---|---|---|
   | AC2 lean always-on bundle | 5548 | 5567 |
   | AC8 design-arm stripped constitution | 10057 | 10076 |
   | AC8 teamwork coordinator bundle | 20434 | 20453 |
   | AC8 non-design constitution | 7959 | 7978 |
3. **New `test/e269-budget-title-sync.test.mjs`** (AC6): splits `context-budget.test.mjs` into `test(` blocks; the number after `≤`/`<=` in a title must equal a `<= N,` comparison in that block's body (the trailing comma excludes numbers inside message strings). Checks >= 6 titles so a parser drift cannot pass vacuously. A second test proves the checker flags a mismatch and accepts a match. `E269_TITLE_SYNC_TARGET` env var points it at another file (used for the negative control).
4. **Goldens**: `npm run build` (no dist diff), then `node scripts/capture-constitution-golden.mjs` unmodified. It writes only to `test/fixtures/compose-golden/` (OUT_DIR) plus `os.tmpdir()` scratch; `git status` shows nothing else changed.

## Negative controls (copies outside the worktree, no stash)

- Copy of the edited file with the pm title changed to 4400: check FAILS (`title says 4400 but body asserts [4401]`).
- Pre-edit `HEAD:test/context-budget.test.mjs` (the real drifted file): check FAILS, naming both 4376/[4401] and 2642/[2852]. So it would have caught the original E274 drift.
- At HEAD of the worktree: 2/2 pass.

## Golden diff explanation (AC7)

`git diff --stat -- test/fixtures/compose-golden`: 11 files, 1 line changed each. Word-diff of every one of the 11 hunks is identical:
`-and` / `reversibly)` -> `reversibly), \`git stash drop\`, and \`git stash clear\` (irreversibly discard stashed content)`.
That is exactly the T-E269-01 change to the §6 FORBIDDEN list in `content/const-15-core-tail.md` (verified against `git diff main...HEAD -- content/const-15-core-tail.md`): the word "and" moves from before the `git checkout -- <file>` entry to before the last entry, and the two stash commands with the reason are added. Nothing else changed in any golden.

Files (all constitution-bearing): build-full-design, build-full-design-fd, build-full-nondesign, build-full-nondesign-fd, build-lite-design, build-lite-design-fd, build-lite-nondesign, build-lite-nondesign-fd, constitution-monolith, hook-full, hook-lite. `skill-coordinator-monolith.txt` (no const-15) is UNCHANGED. `test/e178a-integrator-role.test.mjs` untouched (`git diff --quiet main...HEAD` clean).

## AC map

- AC5 -> `grep -nE "meets ≤ (4376|2642) cap"` prints nothing; sync test.
- AC6 -> `test/e269-budget-title-sync.test.mjs` + controls above.
- AC7 -> section above.
- AC8 -> caps table; full-suite result recorded in the handoff / commit follow-up.

## Notes

- The expected-red manifest lists the four cap tests by their OLD titles; those titles changed with the caps (per the ruling), so the verifier should match by the cap numbers, not the old title strings. The 15 planned reds are the 11 goldens + 4 caps and are all green after this edit.
- `test/feature-lease.test.mjs:1008` flake: see handoff note for whether it recurred in the full run.
