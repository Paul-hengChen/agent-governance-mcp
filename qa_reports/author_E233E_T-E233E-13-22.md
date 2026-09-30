# Author record (not a PASS): e233e-test-comments-c, T-E233E-13..22

Author context only; independent review and a separate verifier context follow per the approved cut.

## Round 1 (superseded by round 2 below)
The first pass rewrote 48 comment lines in 17 files using a narrow "fewer than 6 words" filter. The independent review found this too narrow (id-led comments remained in 34 of 38 files). The T-E233E-21 commit subject wrongly called three files already plain; that claim was wrong and is corrected in round 2.

## Round 2 (review fix pass)
- Scope: every comment in all 38 owned files was swept for lines that lead with an id, using a case-insensitive matcher (letter prefix, digits, trailing letter or digit segments, -NEW-n suffixes, task ids such as T-D4-01; non-ids such as utf8, sha256, e2e and v3 excluded). Lead-label ids were restated in plain words with the id moved to a trailing pointer; ids that carried meaning as nouns were replaced by what they name; mapping rows now lead with plain text.
- Sweep tool: `sweep-id-led.mjs` (lane tooling; `--mid` also lists ids outside a parenthetical). Id-led comment lines went from 396 to 11.
- The 11 remaining lines are justified: 8 are test-name labels or fixture task names inside otherwise plain comments (token-budget-config map continuation lines that carry test names, skill-manifest lines naming a test, visual-gate-e2e and visual-widgets-unverified-gate fixture task `T02`), 2 are a wrapped code fragment or arrow continuation with no id (session, visual-gate-e2e), 1 is a test name used as a sentence subject (skill-manifest). None is a tracker id.
- Mid-sentence ids left in place are trailing pointers, file names, test labels or version tags next to plain text; they were not each re-reviewed, and the independent reviewer should sample them.
- check-comments-only.mjs 6c61864: `comments-only OK: 35 files`, exit 0 (self-test still passes). check-id-only.mjs is advisory only.
- Hygiene: no URL or home-directory path in lines added under test/; `agc check` result recorded in the final run.
- Files touched under test/: 35 of the 38 owned files; the other three had no id-led comments. Nothing outside the owned set was changed.
