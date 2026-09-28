# Review — T-E74-01

Round 1 — by code-reviewer (opus). Feature `e74-md-table-integrity`.

## Summary

- New `scripts/check-md-tables.mjs` (147 lines, untracked) + one `check:md-tables` entry in `package.json`; 19 content files fixed (21 cell-count rows + 2 delimiter-less blocks visible in a single pre-fix pass, 22 cell-count rows once masking is accounted for).
- The content fixes are correct. I re-derived them independently: the pre-fix tree reports 21 cell-count rows across 18 files plus 2 block violations, the 22nd cell-count row appears only after the block fix, and no cell content was lost — the `—` filler cells dropped are exactly the surplus ones.
- The **checker itself is not yet correct**. Discriminator (ii) is implemented as a naive fence-parity toggle that ignores fence character and length. I demonstrated it producing both a false positive on an entirely-fenced file and — worse — a **silent false negative**, reporting `OK` on a file containing a real 3-vs-2 cell-count defect. This repo already contains two 4-backtick nesting fences (`content/coord-01-core-head.md:50`, `content/coord-02-host-dispatch.md:5`), so the trigger is present, not hypothetical.
- The `\|` escape was applied inside recorded **shell commands** in two historical evidence records, silently changing what those commands mean under `grep` BRE. Demonstrated.
- Verdict: **CHANGES_REQUESTED** — three findings, all in the checker/fix strategy, none in the site enumeration.

## Correctness

### F1 (BLOCKING) — `scripts/check-md-tables.mjs:70-77`: fence tracking is a parity toggle, so discriminator (ii) is incomplete in both directions

```js
if (/^(```+|~~~+)/.test(trimmed)) {
  inFence = !inFence;
```

This flips state on *any* fence-shaped line regardless of the opening fence's character or length. CommonMark closes a fence only with the same character and at least the opening run length. A 4-backtick block containing a 3-backtick inner fence — the exact reason 4-backtick fences exist, and the exact shape already in this repo at `content/coord-01-core-head.md:50` and `content/coord-02-host-dispatch.md:5` — therefore un-fences its own interior.

Reproduced, false positive (file is 100% fenced code; nothing should be reported):

```
````markdown
```
| h1 | h2 |
| x |
```
````
```
→ `b-nested-fence.md:3-4 — table block has no delimiter row`, exit 1.

Reproduced, **false negative** — this is the serious direction. An odd number of inner fence lines leaves `inFence` inverted for the remainder of the file, so every real table after it is skipped:

```
````markdown
```
some example
````

| a | b | c |
| --- | --- | --- |
| 1 | 2 |
```
→ `check:md-tables — OK (1 file(s) scanned, 0 malformed tables)`, exit 0.

A guard that reports green over a live defect is the failure mode T-E74-01 names as "worse than nothing." Fix: record the opening fence's char and run length when opening, and only close on a line of the same char with length ≥ the opening run and no info string. Roughly six lines; no change to any other discriminator.

### F2 (BLOCKING) — `qa_reports/review_T-E3-QA.md:120` and `review_reports/archive/e48-docs-skills-delete/review_T-E48-02.md:62`: the `\|` escape corrupts a recorded shell command, inside a frozen evidence record

Both edits added a backslash inside a code span holding a real `grep` invocation:

- `` `grep -c '^| N/A'` `` → `` `grep -c '^\| N/A'` ``
- `` `grep -n "^| [0-9]"` `` → `` `grep -n "^\| [0-9]"` ``

In POSIX basic regular expressions `\|` is not an escaped literal — in GNU grep it is the alternation operator, and BSD grep (this repo's platform, darwin) behaves the same way. `^\| N/A` therefore means "matches `^` **or** matches ` N/A`", i.e. every line. Measured on a 3-line fixture where the correct answer is 2:

```
original '^| N/A'  -> 2
escaped  '^\| N/A' -> 3
```

So the command text now recorded in a QA evidence file is not the command that was run, and the adjacent claim (`= 3`) is no longer supported by the command printed next to it. The GFM *rendering* is fine — inside a table cell GFM unescapes `\|` even within a code span — but in this repo raw `.md` source is the primary read path (agents grep these files; humans read them in editors), so the corruption is live for the actual consumers.

Two things need deciding, and the second is above my pay grade:

1. Whatever the disposition, `\|` must not be used inside a recorded shell command. Restructure the row (move the command out of the table, or split the command across a fenced block referenced from the cell) rather than escaping it in place.
2. `qa_reports/` and `review_reports/archive/` are **historical evidence records** — E17 record-integrity is CRITICAL in this repo, and this ticket is a mechanical formatting cut. Rewriting the bytes of a frozen evidence record to satisfy a new lint is a policy decision, not a mechanical one, and it was made silently. My recommendation is to exclude `qa_reports/` and `review_reports/archive/` from the checker's scan — a lint that forces edits to frozen records is misdesigned, and the exclusion removes 2 of the 24 sites and the whole E17 conflict with it. But that changes the ticket's oracle, so it is a coordinator/human call, not mine. If instead they stay in scope, the human should be told the cut mutates two evidence records.

### F3 (BLOCKING, cheap) — `scripts/check-md-tables.mjs:92`: a delimiter row is accepted without comparing its width to the header's

```js
const hasDelimiter = block.length >= 2 && isDelimiterRow(block[1].raw);
```

`isDelimiterRow` only checks that every cell matches `/^:?-+:?$/`. GFM additionally requires the delimiter row's cell count to equal the header's; when it does not, **the block is not a table at all** and renders as a paragraph — the same user-visible symptom as `docs/backlog.md:169`, the defect that motivated rule 2. Reproduced, silently accepted:

```
| a | b | c |
| --- | --- |
| 1 | 2 | 3 |
```
→ not reported (and the data rows are then validated against a header that GFM never treated as a header).

I verified the fix is free — appending `&& splitRow(block[1].raw).length === splitRow(block[0].raw).length` to line 92 leaves the fixed tree at `OK (806 file(s) scanned, 0 malformed tables)`, exit 0. No new sites, no scope growth.

### F4 (NOT blocking — behaviour is right, the reporting is not) — block-level masking makes a single pass name 23 of 24 sites

`scripts/check-md-tables.mjs:101` `continue`s past cell-count analysis for any block lacking a delimiter. Confirmed end to end: the pre-fix tree reports **23**; fixing only the `docs/backlog.md:169` blank line drops the block violation and surfaces `docs/backlog.md:171` (7 cells, header declares 6) in its place. The union across passes is 22 cell-count rows / 18 files + 2 blocks = 24, matching the AC oracle exactly.

**I am not asking for the semantics to change.** The masking is not merely defensible, it is correct: while that block carries no delimiter, GFM renders it as a paragraph, so the surplus pipe on the E49 row is genuinely not a rendering defect yet. Reporting it pre-fix would be reporting a non-defect — exactly the false-positive class this ticket exists to avoid. The tool converges to a fixpoint of 0 and its exit code is right in every intermediate state.

What is wrong is the honesty of the output. `check:md-tables — ${n} malformed table site(s) found` presents the list as exhaustive with nothing indicating that rows inside a delimiter-less block were not analyzed. Given E74's own standard about not training readers to distrust the checker, one line is enough — e.g. append to the `no-delimiter` message `(rows inside this block are not cell-count-checked until it parses as a table — re-run after fixing)`. That also reconciles the AC's literal "naming all 24 sites on the pre-fix tree": the run then accounts for all 24 even though it enumerates 23.

Note this makes the AC's own phrasing slightly wrong rather than the implementation wrong; T-E74-02's step (1) inherits the same phrasing and should expect 23-then-1, not 24 in one pass.

### F5 (NOT blocking) — `scripts/check-md-tables.mjs:55`: unguarded `readFileSync` over `git ls-files` output

`git ls-files` lists tracked-but-deleted files. Reproduced: deleting a tracked `.md` makes the script die with a raw `Error: ENOENT ... at readFileSync` stack trace rather than a lint message. Exit code is still non-zero so CI does not go green, but the operator sees a crash instead of a diagnosis. A `try/catch` that skips missing paths, or `git ls-files` filtered against existence, closes it.

Related and worth stating: because the source is `git ls-files`, a **newly created untracked** `.md` is not scanned at all. In CI everything is committed so coverage is complete; locally a fresh doc with a broken table passes until it is staged. `scripts/check-version.mjs` has the same shape so this is consistent with the repo, but the AC's "scan every git-tracked `*.md`" is met literally rather than in spirit.

## Quality

- `scripts/check-md-tables.mjs:42` — `if (cells.length === 0) return false;` is dead. `String.prototype.split` always returns at least one element; `splitRow` cannot return `[]`.
- `scripts/check-md-tables.mjs:139` — the `no-delimiter` message reports the block's own first line. For the blank-line-split case that points the reader at the *second half's* first row (`docs/backlog.md:170`) when the edit belongs one line earlier, at the blank line (`:169`). The parenthetical hints at it, but naming the preceding blank line explicitly when the block is preceded by one would make the message directly actionable.
- The header comment (lines 2-20) is unusually good — it states all four discriminators and why each is load-bearing, which is precisely the context E74 says was lost twice. Keep it, and update discriminator (ii)'s wording when F1 is fixed so the comment does not outlive its implementation.
- `splitRow`'s `!s.endsWith("\\|")` trailing-pipe guard and the `(?<!\\)\|` lookbehind are the right shape for discriminator (i). Both mis-handle a cell ending in an escaped backslash (`\\|` as literal-backslash-then-separator), which is a real CommonMark case but does not occur in this tree and is not worth code.
- Content fixes: consistent strategy (drop surplus `—` filler, never drop text) and I confirmed no cell content moved. `specs/d7-qa-reports-archive.md:98` correctly drops a *middle* `—` to preserve the trailing prose cell rather than truncating the row. Good judgement.

## Architecture

- Matches the `scripts/check-version.mjs` shape the AC asked for: root from `import.meta.url`, stderr + non-zero exit, no dependencies. Correct layer — a repo-hygiene script under `scripts/`, not a `tools/` module, not a gate.
- No `specs/e74-*.md` or architecture spec exists; the `tasks.md` T-E74-01 row is the contract, per the mini-chain cut. Nothing in the diff contradicts it.
- `content/skill-pm.md` and `content/skill-design-auditor.md` are untouched — correct, per the falsified SOP hypothesis in `scope_decision_why`. Verified: neither file appears in the diff.
- `test/` is untouched. Verified against the full status list — the hard boundary held.
- The guard is currently **inert**: `check:md-tables` is registered in `package.json` but wired into no lifecycle hook (`prebuild` runs `check:version`, `postbuild` runs `check:transitions-sync`, `test` runs neither). This is correct per decision D3 (verify-release wiring deferred to E82/E83/E84/E95), but it means nothing runs the checker automatically today. Worth an explicit line in the release notes so no one assumes coverage that does not exist yet.

## Security

No findings. The one external process call is `execFileSync("git", ["ls-files", "--", "*.md"], { cwd: root })` — argument-vector form, no shell, no interpolation of untrusted input, and the `--` correctly terminates option parsing. File reads are confined to `path.join(root, relPath)` where `relPath` comes from git's own tracked-file list, so there is no traversal surface. No secrets, no network, no writes. The content edits introduce no new content — they only delete surplus filler cells and add backslashes.

## Performance

No findings. One `git ls-files` invocation, then a single linear pass per file over 806 files; the block grouping is O(lines) and `splitRow` runs once per row plus once per header per block. The only redundancy is calling `splitRow(header.raw)` inside the loop-free header path and again per-block — negligible. No hot path, no prior implementation to regress against. Runtime on the full tree is well under a second.

## Verdict

**CHANGES_REQUESTED** — the content fixes and site enumeration are correct and I re-derived them independently, but the checker itself is demonstrably wrong on discriminator (ii) in a way that reports `OK` over a real defect (F1), silently under-detects the exact class rule 2 exists to catch (F3), and the fix strategy corrupted a recorded shell command inside two frozen evidence records (F2).

---

## sr-engineer reply (Round 1)

- **F1 (fixed)** — `scripts/check-md-tables.mjs` fence tracking now records the opening fence's character and run length (`fenceChar`/`fenceLen`) instead of a parity toggle, and only closes on a line with the same char, run length >= the opening's, and no info string. Reproduced both directions against the fixed checker in an isolated scratch git repo: the exact false-negative fixture from this review (4-backtick block, inner 3-backtick fence, trailing cell-count defect) now reports `row has 2 cell(s), header declares 3`, exit 1 (previously `OK`, exit 0); the 100%-fenced-file false positive still reports clean, exit 0. `content/coord-01-core-head.md:50` (4-backtick, closes at :61) confirmed as the live in-repo trigger shape.
- **F2 (reverted, not re-fixed)** — `qa_reports/review_T-E3-QA.md` and `review_reports/archive/e48-docs-skills-delete/review_T-E48-02.md` reverted to their committed bytes (`git checkout --`); the `\|` escapes are gone. Per the coordinator's decision (not mine to take), `qa_reports/` and `review_reports/` are now excluded from the checker's scan entirely — `EXCLUDED_DIR_PREFIXES` in `scripts/check-md-tables.mjs`, with a comment recording the E17/POSIX-BRE-alternation rationale so it isn't tidied away later. Oracle is now 22 sites / 17 files (`tasks.md` T-E74-01/02 already amended); `git ls-files -- '*.md'` is 806 total, 565 under the two excluded prefixes, 241 scanned.
- **F3 (fixed, free as verified)** — line 92's `hasDelimiter` now also requires `splitRow(block[1].raw).length === splitRow(header.raw).length`. Reproduced the 3-col-header/2-col-delimiter fixture: now correctly reported as a no-delimiter block rather than silently accepted. Fixed tree stays `OK`, 0 new sites.
- **F4 (reporting only, semantics untouched)** — masking behavior is unchanged; only the no-delimiter message gained the clause `(rows inside this block are not cell-count-checked until it parses as a table — re-run after fixing)`.
- **F5 (all three taken)** — `isDelimiterRow`'s dead `cells.length === 0` guard removed; `checkFile` now wraps `readFileSync` in try/catch and skips `ENOENT` (tracked-but-deleted files) instead of crashing — reproduced in a scratch repo, no stack trace, still exit 1 on the real remaining defect; the no-delimiter message now names the preceding blank line explicitly and directs the fix there (`split from its header by the blank line at <file>:<n> — fix there`) when one precedes the block, verified against a synthetic blank-line-split fixture.

Verification this round: `npx tsc --noEmit` clean; `npm run build` clean (`check:version` + `check:transitions-sync` both OK); `node --test test/*.test.mjs` — 1796/1796 pass, `test/` untouched; `npm run check:md-tables` (`node scripts/check-md-tables.mjs`) — `OK (241 file(s) scanned, 0 malformed tables)`, exit 0. `content/skill-pm.md` and `content/skill-design-auditor.md` untouched (confirmed via `git status`).

---

## Notes for qa-engineer (T-E74-02) — not to be actioned by sr-engineer

Recorded here rather than written as tests, since every `test/` edit is qa-owned (§2).

1. T-E74-02 step (1) says the checker must name **24** sites on the pre-fix tree. Per F4 a single pre-fix pass names **23**; the 24th is masked until the `docs/backlog.md` block is repaired. The assertion should be written as 23-then-1 (or as a union across two passes), otherwise it pins a behaviour the implementation correctly does not have.
2. F1's false-negative reproduction is the highest-value regression case in this ticket and is not covered by any of the four discriminator cases as currently enumerated — discriminator (ii)'s stated test ("a pipe-bearing union inside a fenced block must NOT be reported") passes today while the nested-fence inversion still fails. Suggest a fifth case: a 4-backtick block containing an odd number of inner 3-backtick fences, followed by a genuine cell-count defect, asserted to be reported.
3. F3's fixture (3-column header, 2-column delimiter) is a clean class assertion for "block does not parse as a table," and I verified adding the check reds nothing on the fixed tree.
4. F5's tracked-but-deleted-file crash is trivially reproducible in the `test/check-version.test.mjs` scratch-repo spawn pattern already suggested for this ticket.

## Note on the upstream summary (E17 record integrity)

My brief asked me to record two arithmetic imprecisions in sr-engineer's summary. I checked the **persisted** record — the `pending_notes` entry on `.current/handoff.md` — and it is **correct**: "22 cell-count rows/18 files + 2 no-delimiter blocks = 24 total" sums correctly and matches my independent measurement site-for-site (21 cell-count rows visible pre-fix + the 1 masked row = 22, across exactly 18 distinct files; 2 blocks; 19 files touched in total). Neither the "24 across 18 files" phrasing nor the 11+4+6+2 breakdown appears anywhere in the handoff. Those imprecisions are in sr-engineer's chat reply, which is not a persisted artifact and which my clean-context rule bars me from reading. E17 governs the record, and the record is clean — no finding.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer (opus)

Feature `e74-md-table-integrity`. Reviewed against the AC as **amended** (oracle 22 sites / 17 files).

## Summary

- F1, F3, F4 and F5 are all genuinely fixed. I re-derived each independently in a scratch git repo rather than reading the reply's claims: the round-1 false negative now reports, the round-1 false positive stays silent, the wrong-width delimiter is now caught, masking semantics are unchanged, and the ENOENT path no longer throws.
- Discriminators (i), (iii) and (iv) survived the round-2 edits — re-verified, not assumed.
- Boundaries held: `test/`, `content/skill-pm.md`, `content/skill-design-auditor.md` untouched; `git diff` over `qa_reports/` and `review_reports/` is empty.
- **One new blocking finding (F6), and it is a regression introduced by this round's F5 change.** The remedy clause added to the `no-delimiter` message is confidently wrong for one of the two real rule-2 causes — and it is wrong on precisely the cause that one of this cut's own two historical sites exhibited.
- Verdict: **CHANGES_REQUESTED** — one finding, ~3 lines, exact discriminator supplied and verified.

## Correctness

### F6 (BLOCKING) — `scripts/check-md-tables.mjs:151-164, 201-208`: the remedy clause asserts a single cause for a message that has three, and prescribes a destructive edit for two of them

The round-1 message was vague but true: `(or was split by a blank line from its header)`. F5 replaced it, when the block is preceded by any blank line, with a confident directive:

```
split from its header by the blank line at <file>:<n> — fix there
```

`precededByBlankLine` (line 157) tests only that *some* blank line precedes the block. That is true of essentially every well-formed table in this repo, because a blank line is the normal separator between a heading and the table under it. The predicate therefore does not detect the split cause — it detects ordinary Markdown layout.

Three distinct causes reach this message, and the clause is correct for only the first.

| cause | example in this cut | correct remedy | what the clause says |
|---|---|---|---|
| (a) blank line splits a table whose delimiter is earlier | `docs/backlog.md:169` | delete the blank line | delete the blank line — correct |
| (b) table genuinely has no delimiter row | `specs/qa-visual-pixel-gate-attestation.md:182` | add a delimiter row | delete the blank line — **wrong and destructive** |
| (c) delimiter row present but its width differs from the header | new this round, via the F3 fix | fix the delimiter's cell count | "has no delimiter row" — **factually false** |

Reproduced against the current script in an isolated git repo. Cause (b) fixture — a heading, the conventional blank line, then a header + row with no delimiter, i.e. `specs/qa-visual-pixel-gate-attestation.md:180-183` exactly:

```
specs/missing-delim.md:5-6 — table block has no delimiter row (split from its header
by the blank line at specs/missing-delim.md:4 — fix there) (...)
```

Line 4 is the ordinary blank between `## Visual Widgets` and the table. The block's own first line *is* its header, so "split from its header" is not merely unhelpful, it is false. I then followed the instruction literally:

```
## Visual Widgets
| widget id | description | source-node |
| N/A | — | feature has no non-primitive widgets |
```

Two consequences, and the second is the one that matters:

1. A legitimate blank line is gone and the table is welded to its heading.
2. **The violation does not clear.** Re-running reports the same block at its new line numbers — and the message silently *changes* to the generic fallback, because the blank line the clause depended on is the one the reader just deleted.

So the tool issues a specific, confident instruction; the reader complies; the document is damaged; the check still fails; and the tool now says something different without acknowledging that its previous instruction was wrong. That is the exact mechanism by which a reader learns to stop believing a checker — which the T-E74-01 AC does not treat as polish. It elevates it to a FAIL criterion in its own words: a checker that misfires "would train readers to ignore it, which E74 states is worse than no checker." Cause (b) is not hypothetical for this ticket; it is one of the two rule-2 sites the cut exists to fix.

I weighed this as a note and rejected that. Three things decide it:

- It is a **regression**, not a pre-existing gap. Round 1 shipped a vague-but-true message; this round traded it for a specific-but-false one. Net movement is backwards on the single axis this ticket is about.
- Unlike F4's masking — which I explicitly declined to block because the behaviour was *correct* and only the framing was incomplete — here the behaviour itself is wrong. It names a line number and tells the reader to edit it, and that edit is wrong.
- The fix is small and the discriminator is exact.

**Discriminator, verified against both real sites.** Look at the nearest preceding non-blank line above the blank. If it is itself a column-0 `|` row, the blank truly split a table (cause a); otherwise the block simply lacks a delimiter (cause b). Measured on the pre-fix bytes of both files:

| site | nearest preceding non-blank | starts with `\|` | cause |
|---|---|---|---|
| `docs/backlog.md:170` | `:168` `\| E46 \| ...` | yes | (a) |
| `specs/qa-visual-pixel-gate-attestation.md:182` | `:180` `## Visual Widgets` | no | (b) |

Clean separation, no ambiguity. Suggested shape — classify before pushing the violation, and give cause (c) its own branch now that the F3 fix creates it:

- (a) `— blank line at <file>:<n> splits this from the table above; delete that blank line`
- (b) `— header at <file>:<n> has no delimiter row; add one (\`|---|---|\`) beneath it`
- (c) `— delimiter row at <file>:<n> has <x> cell(s) but the header declares <y>; the block does not parse as a table`

Priority order matters: test (a) first (blank-line-preceded *and* previous non-blank is a table row), then (c) (a delimiter row is present but mis-sized), else (b). Keep the existing "rows inside this block are not cell-count-checked" trailer on all three — that clause is correct and was the right call on F4.

No other correctness findings. Nothing in the diff touches test files and no intentionally-red tests exist, so SOP step 4a does not arm.

### F1 — CLOSED (verified by execution, not by reading the reply)

Fence state is now `fenceChar` + `fenceLen` (lines 94-127) and closes only on matching char, `len >= fenceLen`, and empty info string. Re-ran the round-1 fixtures plus two I added:

| fixture | expected | observed |
|---|---|---|
| 4-backtick block, inner 3-backtick fence, then a 3-vs-2 cell defect | reported | `fn.md:8 — row has 2 cell(s), header declares 3` |
| 100%-fenced file with table-shaped lines inside | silent | silent, exit 0 |
| `` ``` `` then `` ``` js `` (info string on the close attempt) | must not close | silent — fence held |
| `~~~` opened, `` ``` `` inside | must not cross-close | silent — fence held |

The false negative that made me block in round 1 is gone. The header comment (lines 82-93) was updated in step with the code and now records the nested-fence trap and the two live in-repo trigger sites, so it will not outlive its implementation.

### F3 — CLOSED

`hasDelimiter` (lines 146-149) now also requires the delimiter's cell count to equal the header's. The 3-column-header / 2-column-delimiter fixture is reported (`f3.md:1-3`) where round 1 accepted it silently. Confirmed free on the real tree: `OK (241 file(s) scanned, 0 malformed tables)`, exit 0. Its only side effect is cause (c) in F6.

### F4 — CLOSED as scoped

Masking semantics untouched, as I asked. The trailer clause is present on every `no-delimiter` violation.

### F5 — CLOSED except for what it introduced

Dead `cells.length === 0` guard gone. ENOENT verified by deleting a tracked `.md` in a scratch repo: no stack trace, the remaining files still check, exit code still correct. The third sub-item — naming the preceding blank line — is F6.

## Quality

- `scripts/check-md-tables.mjs:30-38` — the F2 exclusion comment. Judged specifically, as asked: it is **good enough to survive a tidy-up**, and better than most. It names the mechanism (POSIX BRE `\|` is alternation), records that it was verified on this platform rather than asserted, states the trade explicitly ("a misrendered table cell in an evidence file is cheaper than a falsified command"), and carries an unambiguous do-not-remove instruction. Two durability gaps, neither blocking:
  - It points at `review_reports/review_T-E74-01.md` for the full write-up. Review reports in this repo get archived — the round-1 F2 finding itself cites `review_reports/archive/e48-docs-skills-delete/...`. When this file moves to `review_reports/archive/e74-md-table-integrity/`, the pointer dangles, and a dangling pointer is exactly what makes a future maintainer treat the comment as stale. Cite the durable identifier (backlog E74 / E17) as the primary reference and the report path as secondary.
  - "Evidence directories are write-once forensic artifacts" is accurate for `qa_reports/` and `review_reports/archive/`, but not for live `review_reports/` — this very file is append-only across rounds and was written twice this feature. The exclusion is still right (a lint should not gate an in-flight evidence record either), but the stated justification does not fit the live half, which weakens it against a reader who notices.
- Related, and worth one line in the comment: the exclusion covers 565 of 806 tracked `.md` files. That ratio invites a future "surely we can narrow this to the two affected files." Recording the measured blast radius — that it conceals exactly 2 rule-1 sites (the two shell-command cells deliberately left alone) and 0 rule-2 sites — would forestall the re-litigation the comment is trying to prevent.
- `scripts/check-md-tables.mjs:104` — fence detection runs against `trimmed`, so a fence at any indentation opens and closes. CommonMark allows at most 3 spaces. I built a column-anchored `/^ {0,3}(...)/ ` variant and ran both over the real tree: identical results (`OK (241 file(s) scanned, 0 malformed tables)`). The tree carries 56 indented fence lines and they all pair, so the permissiveness is not load-bearing either way today. Note only — I would not change it without a fixture that distinguishes them.
- `scripts/check-md-tables.mjs:215` — `${files.length} file(s) scanned` counts files *listed* by `git ls-files`, including any the ENOENT branch skipped. Cosmetic.
- Content fixes re-verified: the two evidence files are byte-identical to their committed state, and the two new content edits are minimal and right — `docs/backlog.md` drops the stray blank line, `specs/qa-visual-pixel-gate-attestation.md` adds `|---|---|---|` and nothing else.

## Architecture

- Unchanged from round 1 and still correct: a dependency-free `scripts/` hygiene script shaped like `scripts/check-version.mjs`, not a `tools/` module and not a gate. No architecture spec exists; the `tasks.md` row is the contract.
- `EXCLUDED_DIR_PREFIXES` is the right layer for the F2 decision — one constant at the top of the only consumer, not a config file or a per-file ignore comment.
- The guard remains **inert**: `check:md-tables` is in `package.json` but wired into no lifecycle hook (`prebuild` → `check:version`, `postbuild` → `check:transitions-sync`, `test` → neither). Correct per decision D3, but restating it so nobody assumes coverage that does not exist yet.

## Security

No findings, and no change in surface since round 1. The single subprocess is still `execFileSync("git", ["ls-files", "--", "*.md"], { cwd: root })` — argument-vector form, no shell, `--` terminating option parsing. `EXCLUDED_DIR_PREFIXES` filters git's own output with `String.startsWith`, no regex construction from data. Reads stay under `path.join(root, relPath)` with `relPath` from git's tracked list. The round-2 edits removed content rather than adding any.

## Performance

No findings. Still one `git ls-files` plus a single linear pass per file. The scanned set dropped from 806 files to 241, so this round is strictly faster. The F3 addition costs one extra `splitRow` per block; the fence change is a constant-factor comparison per fence line. Sub-second on the full tree.

## Verdict

**CHANGES_REQUESTED** — F1, F3, F4 and F5 are correctly and verifiably fixed and every discriminator survived, but F5's remedy clause landed a confidently wrong, document-damaging instruction on the one rule-2 cause this cut's own `specs/qa-visual-pixel-gate-attestation.md` site exhibits, and following it does not even clear the violation.

## Addendum for qa-engineer (T-E74-02) — supersedes note 1 of Round 1

1. Round 1's note 1 said the pre-fix assertion should be 23-then-1. **Stale** — under the amended AC the oracle is 22 sites / 17 files and a single pre-fix pass names **21**. Assert 21-then-1, or a union across two passes reaching 22.
2. The four discriminators in T-E74-02 all test *detection*. F6 is a **message-correctness** class that none of them covers: the checker detected the qa-visual site perfectly and still printed a wrong remedy. Add a fifth and sixth case asserting the emitted text, not just the exit code — cause (b) (heading, blank line, header+row, no delimiter) must not tell the reader to delete the blank line, and cause (a) must. These are the cheapest possible regression pins and they guard the property E74 actually cares about.
3. F3's fix creates cause (c) — delimiter present, wrong width. Worth its own message assertion for the same reason.
4. Round 1's note 2 stands and is the highest-value case in the ticket: a 4-backtick block with an odd number of inner 3-backtick fences followed by a genuine cell-count defect, asserted reported. I re-confirmed this round that it now passes, so it will pin a real fix rather than a wish.
5. Round 1's notes 3 and 4 stand unchanged.

---

## Round 3 — APPROVED — by code-reviewer (opus)

## Summary

- Only `scripts/check-md-tables.mjs` changed this round (F6 + the three
  non-blocking F2 comment items). Boundaries verified by `git status`:
  `test/`, `content/skill-pm.md`, `content/skill-design-auditor.md`,
  `qa_reports/` and `review_reports/archive/` untouched. F1/F3/F4/F5 not
  revisited, per instruction.
- The F6 three-way cause discriminator is correct on every shape that exists
  in this repo, and on all three edge cases the brief flagged as suspect.
  Working tree: `OK (241 file(s) scanned, 0 malformed tables)`, exit 0.
- Cause (c) `mis-sized-delimiter` is no longer accepted on the "exercised by
  construction" argument — it is now **executed**. See Correctness C3-1.
- Two non-blocking findings, both on the message/comment path, neither with
  any instance in the 806-file tracked corpus: C3-2 (a narrower
  cause-(a)/(b) conflation on a shape that does not occur here) and Q3-1 (a
  swapped parenthetical gloss in the exclusion comment).
- Verdict: **APPROVED**. Route to qa-engineer for T-E74-02.

## Correctness

**C3-1 — cause (c) is reachable and its message is accurate. Resolved by
execution, not by argument. (no finding)**

The claim under review was that cause (c) has no real instance and that the
path is "exercised by construction". That argument is not adequate on its own
— an unexercised branch on the message path is the shape that produced F6 and
F3 — so I discharged it by running the branch instead of reasoning about it.

Fixture (`| a | b |` / `|---|` / `| 1 | 2 |`) in a throwaway git repo with the
checker copied in verbatim:

```
c_missized.md:1-3 — table block's delimiter row has 1 cell(s), header
declares 2 — fix the delimiter row's column count (rows inside this block are
not cell-count-checked until it parses as a table — re-run after fixing)
```

The branch executes, `delimiterCellCount` is non-null on that path
(`scripts/check-md-tables.mjs:154` guards it behind `delimiterRowPresent`, and
`:186` selects (c) on the same predicate, so the two cannot disagree), both
counts print, and the message no longer claims "has no delimiter row". The
priority order at `:184-190` — (a) else (c) else (b) — behaves as specified.
Nothing further owed here.

**C3-2 — the (a)/(b) discriminator still conflates one pair, on a shape absent
from this repo. NON-BLOCKING; recommend a backlog row.**

The discriminator at `scripts/check-md-tables.mjs:174-190` asks one question:
is the nearest non-blank line above a column-0 `|` row? That question does not
separate "a blank line severed a continuation from its header" from "two
adjacent tables, the second one missing its delimiter". Both answer yes.

Fixture:

```
| A | B |
|---|---|
| 1 | 2 |
                      <- blank
| C | D | E |
| 4 | 5 | 6 |
```

Reported as:

```
adjacent.md:5-6 — table block split from its header by the blank line at
adjacent.md:4 — fix there
```

Following that remedy exactly — deleting `:4` — yields:

```
adjacent.md:4 — row has 3 cell(s), header declares 2
adjacent.md:5 — row has 3 cell(s), header declares 2
```

One violation became two, two distinct tables were merged into one, and the
second table's header was demoted to a data row. The correct fix (add
`|---|---|---|` after `| C | D | E |`) is confirmed clean by control fixture
and is the fix the message steers the reader away from. That is F6's exact
signature: confidently wrong remedy, document made worse, tool changes its
story after the reader complies.

Why this is non-blocking rather than a fourth round:

- The precondition shape does not occur. I enumerated the scanned corpus for
  "table-row run / exactly one blank line / table-row run" with the same
  fence-aware, column-0 logic the checker uses: **0 occurrences in 0 files**
  across all 241 scanned files. No author in this repo writes back-to-back
  tables separated by one blank line, so nothing is one forgotten delimiter
  away from tripping it.
- The tool is advisory — it prints, a human edits — and the damage announces
  itself loudly on the re-run the trailer already instructs.
- Consistency with C3-1: I am holding (c) and this case to the same bar. An
  absent shape is backlog material either way; the difference is that (c) came
  out correct under execution and this one did not.

Recording it so it is not lost. If the coordinator prefers to close it in-round,
the cheap disambiguator is to compare this block's first-row cell count against
the **prior run's header** cell count, not against the prior non-blank row.
I verified that tie-break against both cases before proposing it:

- `docs/backlog.md` (the real cause (a)): prior run's header `:78` = 6 cells,
  this block's first row `:170` = 6 cells → equal → (a), classification
  preserved. Note the prior *non-blank row* `:168` has **9** cells (it is
  itself a defective row), so a naive comparison against the adjacent row
  rather than the header would break the established case — the header
  comparison is the one that holds.
- `adjacent.md`: prior run's header = 2 cells, first row = 3 → unequal → (b).

Where the prior run has no well-formed header of its own, the honest output is
to name both remedies rather than assert either.

**C3-3 — multi-blank splits name only the nearest blank. NON-BLOCKING, self-
converging.**

The classification walk at `:179` skips a run of blank lines, but the reported
`blankLineNo` at `:198` is always `header.lineNo - 1`. With two blank lines
separating, the message names only the second; deleting it leaves the split in
place and the next run re-points at the first. Verified: two-blank fixture
reports `:5`, and after deleting `:5` reports `:4`. It converges, and the
trailer already tells the reader to re-run, so this costs one extra iteration
and nothing else. Mentioned for completeness only.

**Edge cases from the brief — all three classify correctly. (no findings)**

| shape | expected | actual |
|---|---|---|
| block at start of file, no delimiter | (b) missing-delimiter | (b) — correct, and no out-of-bounds read: `:175`'s `prevLineNo >= 1` short-circuits before `lines[-1]` |
| block preceded by a fenced block whose last content line is a `\|` row | (b) missing-delimiter | (b) — the closing fence line is the nearest non-blank and fails the `^\|` test |
| nearest non-blank is an indented `\|` continuation of a `- [ ]` item | (b), NOT (a) | (b) — correct |

The third one is the one the brief expected to fail, and it does not. The
reason is structural rather than lucky: the walk-up at `:180` reuses the same
raw column-0 `/^\|/` test as the run-grouping loop at `:134`, so
discriminator (iii) is honored identically on both paths. An indented `|` line
cannot start a run and cannot be mistaken for a severed header. If those two
tests ever diverge, this edge re-opens — worth a comment at the walk-up
tying it to (iii), but not a finding.

The fence case is also fine for the deeper reason: the walk-up itself is
fence-unaware, but a fence interior can never be the nearest non-blank above a
run, because the closing fence line always intervenes and never matches `^\|`.

## Quality

**Q3-1 — the F2 blast-radius edit landed with its two parenthetical glosses
swapped. NON-BLOCKING, factual error in load-bearing comment text.**

`scripts/check-md-tables.mjs:5-6` defines the numbering: rule **(1)** is
cell-count, rule **(2)** is the delimiter row. `:40-41` then reads:

```
conceals exactly 2 rule-1 (no-delimiter) sites and 0 rule-2 (cell-count) sites
```

Measured with the exclusion disabled:

```
qa_reports/review_T-E3-QA.md:120 — row has 4 cell(s), header declares 3
review_reports/archive/e48-docs-skills-delete/review_T-E48-02.md:62 — row has 4 cell(s), header declares 3
```

Both concealed sites are **cell-count** sites; there are **0** no-delimiter
sites. So the numerals bound to the rule *numbers* are right (2 rule-1, 0
rule-2) and only the glosses are inverted. A reader trusting the rule numbers
gets the truth; a reader trusting the parentheses concludes the exclusion hides
two delimiter-shaped defects, which is false. The decision the comment supports
(keep the exclusion) is unaffected either way, which is why this is not
blocking — but the comment is explicitly marked "do not tidy this away", so it
will be read by someone making exactly that call. Swap the two parentheticals.

**F2 items 1 and 2 landed as intended. (no findings)**

- Item 1: `grep` for `review_T-E74-01` / `review_reports/review` in the script
  returns nothing; `:35` cites `backlog E74/E17`. Clean.
- Item 2: `:30-32` now reads "qa_reports/ is a write-once forensic artifact and
  review_reports/archive/ likewise; live review_reports/ is not write-once (it
  was written twice during this feature) but is excluded anyway" — the
  overclaim is retired and the reason for excluding it anyway is stated
  separately. Clean.
- Item 3: counts correct, glosses swapped — Q3-1.

**Other quality notes.** The three cause branches at `:239-255` each carry the
shared `trailer` from a single binding at `:237`, so the three messages cannot
drift apart. Cause strings are compared against string literals at `:239`/`:244`
rather than a shared const; with three call sites in one function this is
acceptable and I am not raising it.

## Architecture

No architecture spec for this feature (mini-chain, backlog row = spec; PM and
architect skipped per the recorded scope decision). The change is confined to
one standalone script wired at `package.json:15`; no layering surface is
touched. The blast-radius exclusion at `:44` remains the one policy decision
embedded in the tool, and it is documented in place with its measurement and a
do-not-remove rationale — correct placement for it.

## Security

No findings. `execFileSync("git", ["ls-files", ...])` at `:62` passes an
argument array with no shell and no interpolated input. File reads at `:75` are
`path.join(root, relPath)` over paths that came from `git ls-files` inside
`root`. The ENOENT carve-out at `:79` handles tracked-but-deleted files without
leaking a stack trace. No new trust boundary, no secrets, no network.

## Performance

No findings, no regression. One `git ls-files` invocation, then a single
O(lines) pass per file: the run-grouping loop at `:104-141` visits each line
once, and the violation loop at `:145-218` visits each grouped row once. The
walk-up added this round at `:178-180` is the only new work and is bounded by
the length of the blank run above a block — it can only run on a block already
known to be malformed, of which there are at most a handful. Measured: 241
files scanned, no perceptible change against the round-2 build.

## Verdict

**APPROVED** — the F6 fix is correct on every shape present in this repo and on
all three edge cases the brief flagged, cause (c) is discharged by execution
rather than by assertion, and the two remaining findings (C3-2, Q3-1) are
message- and comment-level defects with zero instances in the 806-file tracked
corpus, which is backlog material rather than a fourth round.

I considered blocking on C3-2 and am recording why I did not, so the
coordinator can overrule with full information: it is a genuine F6 recurrence
in kind, but its precondition shape occurs 0 times in the 241 scanned files,
the tool is advisory, and the same absent-shape standard that lets (c) pass has
to let this one pass too.

## Addendum for qa-engineer (T-E74-02)

- C3-2 and Q3-1 are unowned by this round. Q3-1 is a two-word comment
  correction. C3-2 wants either the prior-run-header tie-break verified above
  or a softened both-remedies message; if neither is taken, it should become a
  backlog row rather than being dropped.
- The oracle from the brief re-confirmed independently this round: working tree
  `OK (241 file(s) scanned, 0 malformed tables)`, exit 0; exclusion disabled
  surfaces exactly the 2 concealed cell-count sites named in Q3-1.
- Fixtures for all six shapes exercised here are reproducible from the report
  text; `test/` was deliberately not touched by this round and remains
  T-E74-02's to author.

## Note on clean-context hygiene (Round 3)

`tw_get_state` returns `pending_notes` inline, so sr-engineer's round-3
commentary entered context before the SOP's clean-context rule could exclude
it. Unavoidable given the mandated pre-flight. Mitigation: every claim in this
round was re-derived by execution against fixtures I built, not accepted from
those notes — including the two the notes asserted most confidently ("exercised
by construction" and the blast-radius figures), one of which held and one of
which did not.
