# Review — T-E76-01

covers: T-E76-01, T-E78-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Scope reviewed: `content/skill-release-engineer.md` step 7a (T-E76-01) and `scripts/verify-release.mjs` Check 6 (T-E78-01). Both diffs are surgical — no edit outside E76/E78 scope. §2 clean: the E76/E78 diff authors no test file.
- **T-E78-01: correct.** Verified by execution, not reading — 5 probes against the real script with sha-aware `gh` shims. The FAIL path is NOT disarmed; the v3.102.2 stale-green bug is fixed; both E9/E14 constraints and the VR-8 stdout/stderr split hold.
- **T-E76-01: CHANGES_REQUESTED — 4 blocking defects.** The step as written cannot be executed as written, and the one assembly a literal executor *can* produce is strictly worse than the bug it replaces: in a healthy repo with a valid baseline it sweeps prior releases' evidence into the current feature's archive dir and exits 0.
- The underlying *logic* of the new step 7a is sound — when hand-assembled with the three defects repaired, all five cases (multi-code, single-code, empty set, no-match, absent tree) behave correctly and the MUST NOT rule holds. The defects are all in how the SOP tells the executor to compose the script.
- Of the 3 suite reds: VR-11/VR-12 are legitimate contract flips (retarget); `release-staging.test.mjs:2303` is a stale-predicate ratchet whose underlying residual was NOT fixed (retarget, do NOT retire). Disposition detail at the end.

## Correctness

### F1 (BLOCKING) — `PREV_TAG` is left outside the single `bash -c`; failure mode (ii) is resurrected verbatim
`content/skill-release-engineer.md:61` binds `PREV_TAG=$(git describe --tags --abbrev=0)` in its own bullet. The new E76 bullet at `:62` opens with "everything **below**" and then enumerates a closed list of exactly seven fragments — "the empty-baseline guard, the `<CODES>` derivation, the `<CODES>` logging, the archive-dir `mkdir`, every move, the `expected-red` move, and the `covers:` sweep" — repeated verbatim in the assembly instruction at the end of the same bullet. `PREV_TAG` is in neither list and sits above the bullet.

The guard's very first line consumes it: `if [ -z "$PREV_TAG" ]; then STOP_QA=1; STOP_RR=1`.

Reproduced (real tag present, `PREV_TAG=v1.0.0` bound in the outer shell):
```
outer PREV_TAG=v1.0.0
step 7a has no membership baseline (PREV_TAG='') ...
exit=9
```
This is failure mode (ii) — "`$CODES` bound in one process, consumed in another" — moved onto `$PREV_TAG`. The bullet's own claim, "there is no second shell for `$CODES` to fail to reach", is true only of `$CODES`; it left exactly one second shell for `$PREV_TAG` to fail to reach. Note the Claude Code Bash tool does not persist shell state across calls at all, so `PREV_TAG` is unset even before the `bash -c` boundary is considered.

**Fix**: move the `PREV_TAG` assignment inside the single invocation and add it to both enumerations.

### F2 (BLOCKING) — the mandated single-quoted `bash -c '...'` cannot contain the derivation; E71(b)'s nested-quote defect re-shipped at whole-step scale
`:135` mandates: *"Every one of these lines lives inside the same single-quoted `bash -c '...'` string as the guard and derivation above — do not introduce a literal `'` anywhere in the assembled script (it would close the outer quoting early); the inner string literals above are all double-quoted for exactly this reason, matching the derivation's own style."*

The second clause is factually false. The derivation at `:106-107` contains 12 literal single quotes:
```
} | sed -E 's#.*/##' | grep -oE '^[a-z_]*T-[A-Za-z0-9]+-' | sed -E 's/^[a-z_]*T-//; s/-$//' \
  | tr 'a-z' 'A-Z' | sort -u | tr '\n' ' ' )
```
The STOP message at `:88` adds more (`PREV_TAG='$PREV_TAG'`).

The executor is given two instructions it cannot jointly satisfy: assemble the derivation block verbatim into the single-quoted wrapper, and introduce no literal `'`. Executing the literal composition under zsh:
```
/tmp/literal.zsh:2: no matches found: CODES=$( { ... | sed -E s#.*/## | grep -oE ^[a-z_]*T-[A-Za-z0-9]+- | sed -E s/^[a-z_]*T-//
/tmp/literal.zsh:7: no such file or directory: s/-$// \n  | tr a-z A-Z | sort -u | tr n
exit=127
```
Nothing executes; nothing moves. This is exactly the hazard E71(b) already shipped once (`-name '*.md'` inside `bash -c '...'`), now at the scale of the whole step.

**Fix**: rewrite the derivation's single-quoted literals as double-quoted (`sed -E "s#.*/##"`, `grep -oE "^[a-z_]*T-[A-Za-z0-9]+-"`, `sed -E "s/^[a-z_]*T-//; s/-\$//"`, `tr "a-z" "A-Z"`, `tr "\n" " "`) and de-quote the STOP message, or drop the single-quoted-wrapper mandate in favour of a heredoc-fed `bash -s`. Whichever is chosen, correct the false "all double-quoted" claim.

### F3 (BLOCKING) — the STOP `echo` + `exit 9` exist only in prose; no executable fragment implements them, so the E50/F9 guard is disarmed
`:88` asserts *"the script `echo`s that exact message to stdout and `exit`s non-zero (e.g. `exit 9`) BEFORE the derivation runs"* and *"the script itself enforces this by exiting before reaching that code."* No such code exists. The guard's code block at `:64-88` contains no `echo` and no `exit` — it only sets `STOP_QA`/`STOP_RR`. `exit` appears nowhere in step 7a as an executable fragment; grep confirms it occurs only inside prose bullets.

Before this diff the STOP worked, because the guard ran in the agent's own shell and the agent inspected `$STOP_QA`/`$STOP_RR`. The diff removes that inspection path (`:88`: "the agent can no longer inspect `$STOP_QA`/`$STOP_RR` directly") and replaces it with a script-internal exit that was never written. Net effect: the N4 guard no longer stops anything.

Reproduced — baseline empty for `qa_reports/` while the tree holds root-level files, i.e. `STOP_QA=1`, assembling only the fragments the SOP supplies:
```
step 7a: <CODES> = {E01 E02 E03 E04 }
exit=0
./qa_reports/archive/myfeat/review_T-E01-01.md
./qa_reports/archive/myfeat/review_T-E02-01.md
./qa_reports/archive/myfeat/visual_T-E03-01.md
./review_reports/archive/myfeat/review_T-E04-01.md
```
Every root-level evidence file from every prior release swept into one feature's archive dir, exit 0, reported success — precisely the unbounded sweep the F9 hardening exists to prevent.

Also note `exit 9` is given as *"e.g."*, so the code is not pinned; and the marker has no distinguishing prefix. See F5.

### F4 (BLOCKING, and the reason this is worse than the bug it replaces) — F1 + F3 compose into the *normal* production path
F1 empties `PREV_TAG`, which sets both STOP flags; F3 means nothing halts. The derivation then runs `git ls-tree -r --name-only "" -- qa_reports/`, which errors to an empty pattern file, and `grep -vxFf <(empty)` passes its entire input through.

Reproduced in a **healthy** repo — valid `v1.0.0` baseline containing both trees, only `review_T-E76-01.md` genuinely new:
```
fatal: Not a valid object name
fatal: Not a valid object name
step 7a: <CODES> = {E01 E02 E04 E76 }
exit=0
./qa_reports/archive/myfeat/review_T-E01-01.md
./qa_reports/archive/myfeat/review_T-E02-01.md
./qa_reports/archive/myfeat/review_T-E76-01.md
./review_reports/archive/myfeat/review_T-E04-01.md
```
Three of four files violate the step's own **MUST NOT** ("files not new since `$PREV_TAG` MUST NOT be touched"). E76's original bug moved *nothing*; this moves the *wrong things* and destroys the membership baseline that every future release's `$PREV_TAG` test depends on. That is a strict regression, not a partial fix.

### F5 (BLOCKING) — `covers:` sweep diverges from the `parseCoversIds` semantics it claims to match, producing silent false negatives
The new sweep uses `cl=$(grep -im1 "covers" "$qf")` (`:142`, `:148`) — unanchored, no `:` delimiter required, first-match-wins. `:151` claims "same membership semantics as `parseCoversIds`/`buildCoverageIndex` in `tools/evidence-file.ts`". `COVERS_LINE_RE` (`tools/evidence-file.ts:34`) is anchored and requires a `covers` **label line** with a `[:—-]` delimiter.

Reproduced on a batched review report that mentions the word in prose above its label line:
```
  cl = [This round covers the release-integrity batch end to end.]
  -> would NOT move for E76
  -> would NOT move for E78
  parseCoversIds = ["T-E76-01","T-E78-01"]
```
The file is silently left un-archived — the silent-orphan class step 7a exists to kill. This is highly reachable: batched review reports are the exact shape that carries a `covers:` line, and "covers" is ordinary review prose. (This very report would trip it.)

**Fix**: anchor the match, e.g. `grep -iEm1 '^[[:space:]]*([-*][[:space:]]*)?(\*\*[[:space:]]*)?covers' "$qf"` — noting that this reintroduces F2's quoting problem and must be written double-quoted with `$` escaped.

### F6 (non-blocking) — `exit 9` is unpinned and genuine errors are swallowed
Two consequences of the one-big-subshell shape, both new:
- The exit code is specified as "e.g. `exit 9`", so the agent cannot key on it; the only reliable signal is the echoed message, which has no marker prefix distinguishing it from the success-path `step 7a: <CODES> = {…}` line. Pin the code and give the STOP line a fixed prefix.
- With no `set -e` and no per-fragment exit checking, a genuine mid-script failure (a failing `mv`, a `find` on an absent tree) is swallowed: the script's exit status is that of the last command, which is normally 0. Previously each bullet was its own shell call and a failure surfaced per bullet. Recommend `set -u` plus explicit failure reporting, but not `set -e` (it would turn the many intentional `[ -z … ] &&` false branches into aborts).

### E78 — verified correct by execution
Five probes driving the real `scripts/verify-release.mjs` against fixture repos with sha-aware `gh` shims, all passing:
- **matching sha + `failure` → FAIL**, exit 1, stderr names conclusion/sha/url, no WARN. The check is *not* disarmed.
- **matching sha + `success` → OK**, exit 0, no WARN, stderr empty.
- **stale green (different sha, `success`) → WARN on stdout**, exit 0, stderr empty. The v3.102.2 bug is fixed.
- **red run at a different sha → does not block**, exit 0, WARN.
- **matching red at position 8 of 10 → still FAIL**, so the widened window is genuinely searched, not just `runs[0]`.

Every "cannot obtain ground truth" branch (spawn error, non-zero `gh` exit, unparseable JSON, zero completed runs) is untouched and precedes the new sha-match branch, so E9/E14 graceful degradation is intact. No blocking wait or poll loop was introduced. `git rev-parse HEAD` is the right notion of "the commit being released" at step 9a: Check 1 asserts the tag points at HEAD and Check 2 asserts HEAD equals upstream, so if HEAD were not the release commit the run would already have FAILed on those checks.

## Quality
- `scripts/verify-release.mjs:8-13` — the file-header docblock still describes the pre-E78 contract ("the latest COMPLETED CI run on origin/main concluded success", and a degradation list that omits the new no-match-for-this-sha path). The Check 6 block comment was updated; the header summary was not. Stale contract documentation in the file's most-read location.
- `scripts/verify-release.mjs:267` — the FAIL message still reads `latest completed CI run on main`, but post-E78 it can only ever describe *this commit's* run. Kept verbatim to avoid disturbing VR-11's assertion; since VR-11 must be retargeted anyway, this is the moment to correct the wording to something like `CI run for this commit (head …) concluded "<conclusion>"`.
- `content/skill-release-engineer.md:121` vs `:127-128` — the `mkdir` now appears twice, once as the prose bullet's inline snippet and once inside the code block. Idempotent, so harmless, but an executor told to assemble "all of it, in order" will emit it twice. Pick one home.
- `content/skill-release-engineer.md:129-137` — the `qa_reports` move loop and the `qa_reports` `covers:` sweep carry no `EXCLUDE_QA` guard while both `review_reports` counterparts carry `EXCLUDE_RR`. This is the E69 round-2 Minor-2 residual, unchanged. Not introduced here and still non-blocking (an absent tree makes `find` error to empty and the loop iterate zero times), but see the test-disposition note — it is why `release-staging.test.mjs:2303` must be retargeted rather than retired.

## Architecture
- The chosen shape — collapse all of step 7a into one invocation — is the option E76 explicitly preferred ("prefer the last: one shell for the whole step removes the boundary rather than documenting it"), and it is the right call. The objection is not to the shape but to its execution: the boundary was not removed, it was relocated to `$PREV_TAG` (F1), and the guard that the old boundary made enforceable was dropped without a replacement (F3).
- E76 also asked for a **class fix** ("prefer a class fix over a fifth instance patch") — a check that no SOP shell snippet iterates an unquoted variable outside a `bash -c` wrapper. None was added, and the diff introduces two new instances of the adjacent class (F1: variable consumed across an invocation boundary; F2: nested quoting). A `test/release-staging.test.mjs` assertion that step 7a's assembled script contains no literal `'` and binds every variable it reads would have caught F1 and F2 mechanically. Test authorship is qa's under §2, but the recommendation belongs in the handoff.
- E78 `scripts/verify-release.mjs:213-224` — `--limit 10` plus a client-side `runs.find` re-implements a filter `gh` provides natively: `gh run list --commit <SHA>` exists in the pinned `gh` 2.92.0 (`-c, --commit SHA  Filter runs by the SHA of the commit`). A sha-targeted query removes the window entirely and lets the existing zero-runs branch handle the no-match case, deleting the `find` and the bespoke WARN string. As written, a main busy enough to complete 10 runs after the release run degrades to a permanent WARN with no signal that it has stopped verifying. Not a correctness defect under E78's constraints (the degradation is a WARN by design, and the spec only asked for `runs[0].headSha`), but the bound is unjustified when a native flag makes it unnecessary.

## Security
- No new input crosses a trust boundary in `verify-release.mjs`; `releaseSha` comes from local `git`, is compared by `===`, and is only ever `.slice()`d into a message. No injection vector, no secrets.
- The step 7a defects are a data-integrity, not a confidentiality, concern — but F3/F4 do amount to an unbounded destructive file operation reachable on the normal path, which is the strongest reason this round cannot be approved. `mv -n` limits it to relocation rather than overwrite, so the damage is recoverable from git, and untracked evidence files are the ones genuinely at risk.
- `content/skill-release-engineer.md:132` — `$(find …)` word-splitting means any evidence filename containing whitespace would split into multiple `mv` arguments. Pre-existing and out of scope; filenames are machine-generated as `T-<CODE>-NN`, so unreachable in practice. Recording only so the next round does not rediscover it.

## Performance
No findings. Check 6 goes from 1 to 10 records in a single already-existing `gh` call — no extra round trip, and `runs.find` over ≤10 entries is irrelevant. Step 7a's loops are O(codes × files) over single-digit inputs; the collapse into one invocation removes process spawns rather than adding them.

## Verdict
CHANGES_REQUESTED — T-E78-01 is correct and verified by execution, but T-E76-01 ships a step that cannot be executed as written (F1, F2), and whose only literally-assemblable form disarms the N4 empty-baseline guard and performs an unbounded sweep of prior releases' evidence while reporting success (F3, F4), plus a `covers:` sweep that silently misses batched reports (F5).

### Disposition of the 3 suite reds — for qa-engineer
- `test/verify-release.test.mjs` **VR-11** and **VR-12** — **legitimate contract flips, retarget.** Both fixtures use dummy `headSha` values (`2222…`, `1111…`) that cannot match the fixture repo's real HEAD, so under sha-matching both correctly WARN. I confirmed the FAIL path is not disarmed by re-running both with `headSha` set to the fixture's actual HEAD: red → FAIL with the full message, green → OK with empty stderr. Retarget by resolving the fixture HEAD via `git(["rev-parse","HEAD"], root)` and using it as `headSha`. Worth adding while there: stale-green → WARN + exit 0 + empty stderr (the v3.102.2 bug, currently uncovered), another commit's red → does not block, and a matching red found deep in the 10-run window.
- `test/release-staging.test.mjs:2303` — **retarget, do NOT retire.** sr-engineer's account of this red is wrong in a way that matters. The failing assertion is `assert.ok(rrLine, "must find the review_reports move example line")`: the test's two `String.includes` predicates search for `review_T-<CODE>-*.md`, and the new block writes `review_T-${c}-*.md`, so both line lookups return `undefined` and the test dies before reaching either guard assertion. The E69 round-2 residual it ratchets was **not** fixed as a side effect — the asymmetry is still exactly present (`review_reports` guarded by `if [ -z "$EXCLUDE_RR" ]`, `qa_reports` unguarded). Only the string predicates went stale: `<CODE>` → `${c}`, and the `review_reports` guard moved from an inline `[ -z "$EXCLUDE_RR" ] &&` prefix to an enclosing `if`, which also breaks the surviving `assert.match(rrLine, /\[ -z "\$EXCLUDE_RR" \] &&/)`. Retarget both predicates and the regex to the new shape; the ratchet's intent remains valid and should keep reding if anyone changes either guard.
- No real regressions among the three.

### Process note (§2 / accuracy)
The E76/E78 diff authors no test file — §2 clean, and leaving the reds for qa was correct. But `pending_notes` describes the step-7a composition as "Verified end-to-end in this repo's real zsh (multi-code, single-code, empty-set, and no-match cases)", and that claim cannot hold for the text as committed: as written the script does not parse (F2), and if it did it would exit 9 on `PREV_TAG` (F1). The underlying logic *does* pass all four of those cases — I reproduced every one — but only after hand-repairing F1/F2/F3, i.e. what was verified is not what was written. Combined with the misdescription of the third red, the self-report is inaccurate about its own diff in two places. Flagging per E17; no action required beyond tightening the next round's claims to the artifact actually committed.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- Scope: `content/skill-release-engineer.md` step 7a only. `scripts/verify-release.mjs` is byte-identical to round 1 (diffstat 38 ins / 9 del, unchanged) — T-E78-01's round-1 approval stands and was not re-reviewed.
- All five round-1 blocking defects are fixed, each confirmed by executing the assembled script rather than reading it. The step now assembles into a heredoc-fed `bash` script that I extracted mechanically from the file, syntax-checked, and ran across 8 scenarios, 2 platforms, and 3 locales.
- The `[:—-]` locale question is settled: correct on BSD grep 2.6.0 (macOS) **and** GNU grep 3.11 (Debian) under `en_US.UTF-8`, `C`, and `POSIX`. The `[:` character-class ambiguity does not bite — neither implementation treats it as a class opener without a closing `:]`.
- The five-fragment assembly burden is a real, named residual, but I am not blocking on it. Both mis-assembly modes are detectable and neither is silently destructive; reasoning below.
- Suite: 1736 tests, 1733 pass, 3 fail — exactly the three dispositioned in round 1, no fourth. §2 clean, §1 surgical.

## Correctness

### F1 — FIXED (verified)
`PREV_TAG` is now fragment 1, named explicitly in the assembly order at `:63` and consumed inside the same script. Verified mechanically rather than by inspection: the set of variables *referenced* anywhere in the assembled script is exactly equal to the set *assigned* within it —
```
referenced: c cl CODES COVERS_RE EXCLUDE_QA EXCLUDE_RR f MSG PREV_TAG qf rf STOP_QA STOP_RR
assigned:   c cl CODES COVERS_RE EXCLUDE_QA EXCLUDE_RR f MSG PREV_TAG qf rf STOP_QA STOP_RR
```
Nothing crosses in from outside. Re-run under `set -u` with `PREV_TAG`/`CODES`/`EXCLUDE_*` explicitly scrubbed from the environment: exit 0, correct derivation. This closes the *class*, not just the `PREV_TAG` instance.

### F2 — FIXED (verified)
`bash -c '...'` is replaced by `bash <<'STEP7A'` (`:68`). Because the delimiter is quoted, the outer shell performs no expansion or quote-parsing on the body, so the derivation's dozen literal single quotes need no re-quoting — and none was done, which is the right call. I assembled the five fragments straight out of the file (`sed` extraction, markdown indent stripped, `<active_feature>` substituted), and:
- `bash -n` on the whole assembled command: syntax OK.
- Executed under **zsh** — the shell that broke round 1 — in all scenarios below: correct, no quoting error.
Round 1's false "the inner string literals above are all double-quoted" sentence is gone.

### F3 — FIXED (verified)
The guard fence at `:97-101` now contains real code, not prose asserting it:
```
MSG="step 7a has no membership baseline for <qa_reports|review_reports> (PREV_TAG='$PREV_TAG') — …"
echo "STEP7A_STOP: $MSG"
exit 9
```
Both STOP conditions exercised:
- *no tags at all* (`PREV_TAG` empty) → `STEP7A_STOP: … (PREV_TAG='')`, exit 9, the `step 7a: <CODES> = …` line never printed, nothing moved.
- *tag exists but a tree's baseline is empty while root files are present* → `STEP7A_STOP: … (PREV_TAG='v1.0.0')`, exit 9, all four root-level files left in place.
The derivation is provably never reached, the marker prefix is present, and the message is byte-exact including the em dash. The E50/F9 guard is re-armed.

### F4 — FIXED (re-reproduced independently, not accepted from the handoff)
Rebuilt the exact scenario myself: `v1.0.0` baseline with `review_T-E01-01.md`, `review_T-E02-01.md` and `review_reports/review_T-E04-01.md` **committed**, only `review_T-E76-01.md` genuinely new.
```
step 7a: <CODES> = {E76 }
exit=0
./qa_reports/archive/myfeat/review_T-E76-01.md
./qa_reports/review_T-E01-01.md
./qa_reports/review_T-E02-01.md
./review_reports/review_T-E04-01.md
```
`CODES={E76}` only; all three baseline files untouched at root. Round 1 produced `{E01 E02 E04 E76}` and swept all four. MUST NOT holds.

### F5 — FIXED (verified across both grep implementations and three locales)
`COVERS_RE='^[[:space:]]*([-*][[:space:]]*)?(\*\*[[:space:]]*)?covers([[:space:]]*\*\*)?[[:space:]]*[:—-]'` at `:154`, applied via `grep -iEm1 "$COVERS_RE"`. Shape matches `COVERS_LINE_RE` (`tools/evidence-file.ts:34`).

**The `[:—-]` bracket expression was the sharp risk and it is clear.** Two concerns, both tested rather than reasoned about:
- *Multibyte em dash under a byte-oriented locale.* Under `LC_ALL=C` the em dash decomposes to bytes `E2 80 94`, but the set still contains `:` and `-`, so ASCII delimiters keep matching and a literal em-dash delimiter matches on its lead byte.
- *`[:` parsed as a character-class opener.* POSIX leaves `[:` without a closing `:]` undefined, and GNU grep is known to reject some such forms.

Matrix — `label_colon`, `label_bullet_bold` (`- **covers**:`), `label_emdash`, `label_hyphen` must match; `decoy_discovers` (`This round discovers: …`) and `decoy_midsentence` (`The report covers: …` mid-sentence) must not:

| implementation | `en_US.UTF-8` / `C.UTF-8` | `C` | `POSIX` |
|---|---|---|---|
| BSD grep 2.6.0-FreeBSD (macOS) | 4 match / 2 reject | 4 / 2 | 4 / 2 |
| GNU grep 3.11 (Debian) | 4 / 2 | 4 / 2 | 4 / 2 |

No `Unmatched [, [^, [:, [., or [=` error in any cell — neither implementation treats `[:` as a class opener absent a closing `:]`. The regex is safe as written; no change needed.

### Full-script portability — Linux / GNU / `LC_ALL=C`
Because the SOP ships to `npx` consumers, I ran the whole assembled step under Debian, bash 5.2.37, GNU grep 3.11, `LC_ALL=C`, with a decoy file (`discovers:` prose on line 1, real `covers: T-E71-01` on line 2):
```
step 7a: <CODES> = {E69 E71 YYY ZZZ }
→ both trees swept into their own parallel archive dirs; expected-red moved;
  review_T-YYY-88.md swept via its real label line; notes.md and the baseline file untouched
```
`<(...)` process substitution, `grep -vxFf`, `sed -E`, `tr` and `find -maxdepth` all behave identically to macOS.

### Both original E76 failure modes remain unreachable
- **(i) unwrapped single-iteration over the literal string** — `for c in $CODES` can only ever execute inside the heredoc body, which is read by `bash`, which word-splits. Confirmed: `CODES={E69 E71 ZZZ}` produced three iterations and archived all three. There is no path by which this loop reaches zsh.
- **(ii) bound in one process, consumed in another** — derivation and consumption are the same `bash` process, and the referenced==assigned audit above proves no variable is expected from outside.

### Case matrix (assembled script, run under zsh on macOS)
| case | result |
|---|---|
| multi-code `{E69,E71,ZZZ}` + `covers:` sweep + `expected-red` | all moved to correct parallel dirs, exit 0 |
| single code `{E80}` | moved, exit 0 |
| empty set | `{∅}`, no-op, exit 0, nothing moved |
| no-match tree | exit 0, nothing moved |
| `review_reports/` absent (`EXCLUDE_RR`) | exit 0, no error, qa side still swept |
| STOP — no tag | `STEP7A_STOP:` + exit 9, derivation not reached |
| STOP — empty baseline + root files | `STEP7A_STOP:` + exit 9, nothing swept |
| MUST NOT | `notes.md` (no `T-` prefix, no `covers:`) and the baseline file untouched in every case |

## Quality
- **Assembly burden — accepted, with a named residual (coordinator's item 1).** The step requires assembling five fragments spread over ~110 lines, two of which are inline prose snippets, and step 7a contains two further fences that are *not* executable (the illustrative `find`/`grep` pair at `:107-110`, the `{E36}` verification example at `:126`). I tested both mis-assembly modes rather than assuming:
  - *Terminator left with its markdown indent* (`     STEP7A`): the heredoc runs to EOF, the body still executes **correctly and completely** (both files archived), and the run exits **127** with `bash: line 70: STEP7A: command not found`. Fail-loud, work still done — benign.
  - *Illustrative fence pasted as fragment 3*: nothing is bound, so `CODES` is empty and nothing moves — the E76 silent-no-op class. But it is not actually silent: the transcript reads
    ```
    qa_reports/review_T-E69-01.md
    review_reports/review_T-E69-01.md
    step 7a: <CODES> = {∅}
    ```
    i.e. the wrong fence prints the very files it failed to derive from, immediately above `{∅}`. That self-contradicting transcript is exactly the signal the E50 "log `<CODES>` even when empty" bullet was added to produce, and it lands here without further work.

  Not blocking, for three reasons: the text as written, followed as written, is correct on both platforms and all three locales; fragment 3 is disambiguated three independent ways (by number, as "the **executable** … fence", and by its opening token "the one that opens `CODES=$(`") while the decoy is labelled "exists only to explain the predicate"; and neither mis-assembly mode is silently destructive. That said, the coordinator's proposed shape — ONE complete copy-pasteable block with explanatory fences explicitly marked non-executable — is strictly safer at no cost, and this file's five-instance history of execute-only defects argues for taking it. Recorded as a follow-up, and the durable control belongs to qa (below) rather than to another sr-engineer round.
- **`STEP7A_STOP:` embeds the heredoc delimiter** (`:99`). Benign — a heredoc terminates only on a line consisting of *exactly* the delimiter, and `echo "STEP7A_STOP: $MSG"` never is. Verified across all eight scenarios. Worth knowing if anyone ever changes the delimiter or switches to `<<-`.
- Round-1 Quality items cleared: the duplicated executable `mkdir` is gone (`:136` now defers to fragment 5's fence, "so there is exactly one place that runs them"), and the false "all double-quoted" claim is removed.
- Round-1 Quality items still open, carried to qa/doc as non-blocking: `scripts/verify-release.mjs:8-13` header docblock still states the pre-E78 contract, and `:267`'s FAIL text still says "latest completed CI run on main" when it can now only mean this commit's run. Both are in the untouched file; neither affects behaviour.
- The E69 round-2 `EXCLUDE_QA`/`EXCLUDE_RR` asymmetry is unchanged and still non-blocking — an absent `qa_reports/` makes `find` error to empty and the loop iterate zero times. It is the reason `release-staging.test.mjs:2303` is a retarget rather than a retirement.

## Architecture
- The quoted-heredoc choice is better than the `bash -c` shape E76 originally suggested: it removes the boundary *and* removes the quoting obligation, so the fragments can be shown byte-for-byte as they already read. That is a genuine class fix for the nested-quote hazard E71(b) shipped, not another per-site patch.
- E76's requested class check still has no mechanical enforcement. The referenced==assigned invariant I ran by hand is precisely the assertion that would have caught F1 automatically, and "step 7a contains exactly one fence opening `CODES=$(`" would catch the mis-assembly residual above. Both are `test/release-staging.test.mjs` assertions — qa's under §2 — and I have handed them forward rather than blocking.

## Security
- No new trust boundary. The STOP message interpolates `$PREV_TAG` into `MSG`, but it is `echo`ed, never `eval`ed, and originates from `git describe` on the local repo.
- The round-1 destructive path (unbounded sweep at exit 0) is closed: both STOP branches now halt before the derivation, verified by execution.

## Performance
No findings. One `bash` process for the whole step, down from one per bullet.

## Verdict
APPROVED — all five round-1 blocking defects are fixed and independently verified by execution across 8 scenarios, 2 grep implementations, 2 operating systems and 3 locales; the remaining assembly-ergonomics residual is documented, non-destructive in both of its failure modes, and better addressed by a qa ratchet than by a third review round.
