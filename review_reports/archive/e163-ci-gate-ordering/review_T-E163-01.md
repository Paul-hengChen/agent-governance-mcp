# Review — T-E163-01 (`e163-ci-gate-ordering`)

covers: T-E163-01

Spec: `docs/backlog.md` row E163 + the three cut decisions (D1/D2/D3) recorded verbatim in
`scope_decision_why`. Diff under review: `content/skill-release-engineer.md`,
`scripts/verify-release.mjs`. Round 1.

## Summary

- Implements all three cut decisions: D1 (step 8 → 8a commit+push-branch / 8b CI gate / 8c
  tag+push, sub-lettered not renumbered), D2 (E141 tag-at-HEAD wording untouched — confirmed,
  zero edits in that region), D3 (new step 2a pre-flight CI query before the bump).
- `scripts/verify-release.mjs` gains a `--ci-check [--strict] [--sha]` mode; Check 6's CI
  ground-truth logic is extracted into a shared `evaluateCIGroundTruth({sha, strict, fails})`.
- **The strictness asymmetry genuinely holds.** I drove all seven reachable CI states through
  the new mode with a stubbed `gh`. All five WARN paths convert to FAIL under `--strict`;
  the E78 wrong-sha-green case is still refused; the only `--strict` exit-0 is a completed
  run for *this* sha concluding `success`. No WARN path survives. Evidence below.
- **The extraction is behaviour-preserving.** The poll loop and match logic are byte-identical
  to base (`diff` clean but for the closing brace), the non-strict `warn` string is unchanged,
  and E147's tag-first sha resolution survived intact inside Check 6's own callback.
- Verdict: **CHANGES_REQUESTED** — one blocking finding (F1: step 8b as documented is not
  runnable to completion under a default host command timeout, and its only documented
  outcome in that case is `Blocked` → human on a *green* release), plus two small defects.
  The security-relevant core — "no unverified commit gets a tag" — is correct.

## Correctness

### F1 (BLOCKING) — step 8b cannot complete under a default host command timeout, and the SOP gives it no retry affordance. `content/skill-release-engineer.md:228`

Measured, not inferred. Real CI durations on `main` for the last 8 completed runs
(`gh run list ... --json createdAt,updatedAt`): **139s, 157s, 159s, 161s, 166s, 171s, 174s,
184s** — median ~165s.

Step 8b runs `node scripts/verify-release.mjs --ci-check --strict` immediately after 8a's
push, so the run it waits for has just been triggered and has not started, let alone
completed. The script blocks in `sleepSync` until it completes — up to
`AGC_VERIFY_CI_WAIT_SECONDS` (default `DEFAULT_WAIT_SECONDS` = 480s,
`scripts/verify-release.mjs:456`). 480s is ample for a 165s CI run.

The problem is one layer up. A release-engineer invokes this as an ordinary shell command,
and the default command timeout in this harness is 120s — below the ~165s the poll must
absorb. I hit this during review: my own verification run was killed at exactly 120s mid-poll
("moved to the background"), printing the poll-progress line and nothing else. So the
expected steady state at step 8b on a **perfectly green** release is: command killed at 120s,
no `CI-CHECK PASSED` line, and per the Escalation Routes row
(`content/skill-release-engineer.md:271`) the release-engineer STOPs with
`Blocked` / `next_role: human`.

Why this is blocking rather than a papercut:

1. It fires on every release, not on an edge case. The first real use of E163's gate looks
   like a defect *in the gate*.
2. The Escalation Routes row cannot distinguish "the script reported FAIL" from "the script
   never got to report at all" — both present to the agent as "did not report
   `CI-CHECK PASSED`". A host-level kill is not evidence about CI, but the SOP treats it as
   the STOP condition.
3. The obvious human response to a gate that blocks every green release is to relax it —
   drop `--strict`, or skip 8b. Either reopens exactly the hole E163 exists to close. A gate
   that trains its operator to bypass it is worse than a gate with a documented retry.
4. E82 already established this hazard class in this very file (`DEFAULT_WAIT_SECONDS` was
   cut to 480s precisely because of a host command ceiling). Step 8b does not carry that
   lesson forward. Note the asymmetry with step 9a: a host kill there is harmless (9a's poll
   is a WARN path, and post-8b the run is already complete so Check 6 returns on the first
   `gh` call with no polling at all — E163 actually *improves* 9a's latency). At 8b the same
   kill is release-blocking.

Fix is prose-only and can stay host-agnostic (this file deliberately avoids hardcoding host
specifics — cf. the `Co-Authored-By` discussion at :212). Suggested shape, in step 8b:

> This command blocks while CI completes — up to `AGC_VERIFY_CI_WAIT_SECONDS` (default
> `DEFAULT_WAIT_SECONDS`, currently 480s), and a cold run on this repo takes ~3 minutes.
> Invoke it with the longest command timeout your host allows. If your host kills the command
> before the script prints either `CI-CHECK PASSED` or a `FAIL:` line, that is **not** the
> STOP condition — the script never answered. Re-run it; the CI run is still completing and
> the second invocation normally returns immediately.

and a matching qualifier on the Escalation Routes row so it triggers on *the script reporting*
a red-or-inconclusive result, not on the absence of output.

### F2 (minor) — `--sha` with a missing value silently falls back to HEAD. `scripts/verify-release.mjs:106-107`

```js
const shaFlagIdx = argv.indexOf("--sha");
const shaOverride = shaFlagIdx !== -1 ? argv[shaFlagIdx + 1] : undefined;
```

`--sha` as the final argument yields `undefined`, and `const sha = shaOverride || git([...])`
(:190) silently checks HEAD instead. Verified: `verify-release.mjs --ci-check --sha` printed
`CI-only check (lenient) for a2d91d8cd38a` and exited 0 — a caller that asked about a specific
sha was answered about a different one, with no diagnostic.

Worse shape: `--ci-check --sha --strict` consumes `--strict` as the sha value *and* still sets
`ciCheckStrict` (because `argv.includes("--strict")` is independent). Verified output:
`CI-only check (strict) for --strict` followed by a full 480s poll for a run whose headSha is
the literal string `--strict`, ending in FAIL. Fails closed, but burns the entire budget and
produces a misleading failure.

Neither call site in the SOP passes `--sha` today, so this is latent, not live. Still — the
flag exists and the mode is the pre-tag gate; reject a missing or `--`-prefixed value
explicitly rather than degrading to HEAD.

### Confirmed correct (no finding)

**Every WARN path converts under `--strict`.** Driven with a stubbed `gh` on `PATH`:

| condition | lenient | `--strict` |
|---|---|---|
| `gh` binary missing (spawn ENOENT) | WARN, exit 0 | FAIL, exit 1 |
| `gh` exits non-zero (unauth / HTTP 403 rate limit) | WARN, exit 0 | FAIL, exit 1 |
| malformed JSON on stdout | WARN, exit 0 | FAIL, exit 1 |
| empty run list `[]` | WARN, exit 0 | FAIL, exit 1 |
| sha not found + budget expired (incl. E78 green-run-for-a-different-sha) | WARN, exit 0 | FAIL, exit 1 |
| this sha completed `failure` | FAIL, exit 1 | FAIL, exit 1 |
| this sha completed `success` | PASS, exit 0 | PASS, exit 0 |

This is exhaustive: all five `warn()` call sites inside `evaluateCIGroundTruth` route through
the single helper at :439, and the only other `return` from the loop is the matched-run branch.
There is no path that exits the function without either pushing to `fails` or having matched a
`success` run for the requested sha.

**No behaviour drift in the non-strict path.** `diff` of base Check 6's body against the
extracted function body from `const POLL_INTERVAL_SECONDS` to close is clean except `});` → `}`.
The non-strict `warn` string is character-identical to base. `runCheck`'s `try/catch` still
wraps the call, so a throw inside the evaluator remains a FAIL.

**E147 survived the extraction.** The tag-first two-call resolution (`rev-parse --verify
--quiet refs/tags/v<version>` → `rev-list -n 1 v<version>`, HEAD only as fallback) stayed in
Check 6's own `runCheck` callback (`scripts/verify-release.mjs:554-567`) and was *not* pulled
into the shared function — which is the correct split, since the two new call sites must
resolve from HEAD, not from a tag that does not exist yet. Check 6 still never polls the
bookkeeping commit.

**D2 verified.** Zero edits in the E141 tag-at-HEAD region; step 9a's Check 1 wording is
byte-identical to base.

**Expected-red manifest (SOP 4a) sampled.** All four entries in
`qa_reports/expected-red_e163-ci-gate-ordering.txt` grep-match real, locatable tests in
`test/release-staging.test.mjs` (`:2078`, `:2392`, `:2402`, and the 7-row Escalation Routes
pin). Manifest is well-formed and its explanation matches the diff.

## Quality

### F3 (minor) — one missed cross-reference retarget. `content/skill-release-engineer.md:260`

> "...it already owns every other git mechanic in this file — **steps 8**, 9, 9a, and now 13a"

Should read `steps 8a, 8c, 9, 9a`. This is the only genuine miss: a sweep for
`steps? 8([^abc]|$)` over the whole file returns exactly two hits — this one, and :201's
deliberate self-reference ("split out of the former single step 8"), which is correct as
written. It contradicts the change's own completeness claim at :201 ("Every cross-reference
elsewhere in this file ... now reads step 8a").

Everything else retargeted correctly, including the one that had to go to **8c** rather than
8a: :69 ("Step 7a runs BEFORE step 8c creates the new tag") — mechanically pointing that at 8a
would have been wrong and it was not. :139/:199 (`git add` staging) → 8a, :41/:42 (release
commit ownership) → 8a, :246/:257 (13a's relationship to the release commit) → 8a: all correct.
Note `test/release-staging.test.mjs:1437` searches for `"MUST be staged per SOP step 8"`, which
still matches `"step 8a"` as a prefix — that test is unaffected, correctly not in the manifest.

### F4 (minor) — the `gh` CLI missing/unauthenticated Escalation Routes row now contradicts three different postures. `content/skill-release-engineer.md:276`

The pre-existing unqualified row says `gh` missing/unauthenticated → `Blocked` → human. As of
this change, three steps query `gh` with three different answers to that same condition:
step 2a WARNs and continues (explicitly, :53), step 8b FAILs (:228), step 9a WARNs (:233).
The tension pre-dates E163 (9a already contradicted it), but E163 adds a second contradicting
site and a *third* posture. The step-level prose is explicit enough that an agent will do the
right thing, so this is documentation coherence, not a live hazard. Worth scoping the row to
step 9's `gh release create` while the file is open.

### F5 (observation) — `--strict` is silently ignored outside `--ci-check` mode

`ciCheckStrict` is computed globally (:104) but Check 6 hardcodes `strict: false` (:568). So
`verify-release.mjs 3.116.0 --strict` accepts the flag and ignores it. Safe direction (it
cannot weaken a full run) and arguably correct — Check 6 must stay lenient by design — but a
caller could reasonably expect it to work. Consider rejecting `--strict` without `--ci-check`.

### F6 (observation) — step 2a's efficacy is bounded by the hardcoded `--limit 10` window

`listCompletedRuns` asks for the last 10 completed runs on `main` (:464-479). That bound is
generous for Check 6 and 8b, which ask about a sha pushed seconds ago. Step 2a is different:
it asks about a sha that may be weeks old (the previous release's HEAD, untouched since). On a
busier repo, ten completed runs can easily post-date it, so 2a degrades to "not found → WARN →
continue" precisely when `main` is active — a silent no-op. It cannot distinguish "this sha is
older than my window" from "CI never ran". On *this* repo `main` is quiet enough that the
measured six-red-commit scenario would be caught (all six runs would sit in the window), so the
ticket's motivating case is genuinely closed. Naming the limitation is enough; no change asked.

## Architecture

The 8a/8b/8c split is the right shape and correctly realises D1. The reversibility boundary is
now stated where it actually is: 8a is explicitly labelled "Reversible — nothing immutable yet",
8b sits between, 8c is labelled "irreversible from here". That is the single most valuable line
in the diff — it is the thing v3.115.0 did not have.

Factoring `evaluateCIGroundTruth` out with `strict` as the only behavioural parameter is the
correct decomposition: one poll mechanism, one sha-match rule, two postures. Leaving the
tag-first sha resolution *outside* the shared function (in Check 6's callback) rather than
parameterising it is also right — the three call sites genuinely resolve their sha differently,
and hoisting that into the shared function would have been the obvious way to break E147.

**On the judgement call the brief asks about (step 2a: WARN-and-continue on unknown/timeout) —
I think sr read D3 correctly, and for a stronger reason than cost.** D3 specified only that a
`failure` conclusion STOPs; it said nothing about unknown. Failing closed there would be wrong
on the merits, not merely expensive:

- At 2a nothing irreversible exists. No commit, no tag, no release. The asymmetry that justifies
  strictness at 8b — "an inconclusive read is not consent to publish an immutable tag" — has no
  force at 2a, because there is nothing to consent to yet.
- The same question is re-asked under `--strict` at 8b before anything immutable is published.
  An unknown at 2a is therefore *covered downstream*, which is the textbook justification for
  leniency at a pre-flight: a lenient early check plus a strict late check is strictly safer
  than one strict early check, because the late one is the one that actually guards the artifact.
- The realistic causes of "unknown" at 2a — `gh` not configured in this shell, the sha aged out
  of the run window (F6), a workflow rename since the last release — are all things the
  release-engineer cannot act on at that moment. Failing closed would manufacture a human
  escalation with zero marginal safety.

The one thing I would want stated, and which the current 2a prose does not say, is *why* it is
safe to be lenient here — i.e. an explicit forward reference to 8b as the strict backstop.
Step 8b points back at 2a; 2a does not point forward at 8b. It currently justifies leniency with
"there is nothing to protect yet", which is true but weaker than "and 8b re-asks this strictly
before anything is published". Optional, but it would stop a future reader from "fixing" the
asymmetry in the wrong direction.

**Cross-reference sweep beyond this file:** `specs/qa-flow-enforcement-architecture.md` contains
no copy of the release step list — clean, nothing stale there. The repo-wide sweep found no
other live mirror. Two dormant copies, neither actionable here and neither sr's file to touch
(Constitution §2):

- `test/render-structure.test.mjs:193,200` embeds a verbatim prose snapshot of step 7a/7b
  including "one of the paths **step 8's** `git add` now stages explicitly". It is renderer
  *input* (a self-contained fixture), not an assertion against the live SKILL text, which is
  why it stays green and is correctly absent from the expected-red manifest. It is now a stale
  copy of prose. Flagging for qa's awareness only.
- `CHANGELOG.md` and `tasks.md` reference "step 8" in historical entries. Those are records of
  what shipped at the time and MUST NOT be rewritten. Correctly left alone.

## Security

No findings. No new trust boundary, no secret, no injection vector. The `gh` invocation uses
`spawnSync` with an argv array (no shell), unchanged from base. `--sha` is interpolated only
into `String.slice` for display and an `===` comparison against `headSha` — never into a shell
string or a git ref — so F2's unvalidated value is a correctness and UX problem, not an
injection one.

Worth recording as an intentional non-finding: `listCompletedRuns` hardcodes `--branch main`
(:468). A release cut from a non-`main` branch would never find its sha, so 2a WARNs (no-op)
and 8b FAILs after burning the full poll budget. That is the safe direction, and the hardcode
is inherited from base rather than introduced here — but E163 newly makes it release-blocking
at 8b rather than merely advisory at 9a.

## Performance

No findings. No new I/O in the full-run path — `--ci-check` exits before version resolution and
before Checks 1-6, so it issues exactly one `git rev-parse` plus the same bounded `gh` poll
Check 6 already performs. The extraction adds one function call per full run. `sleepSync`'s
`Atomics.wait` blocking loop is unchanged from base and is consistent with the script's
top-to-bottom `execFileSync`/`spawnSync` style.

One genuine net improvement worth recording: after 8b, step 9a's Check 6 finds a completed run
on its **first** `gh` call, because 8b already absorbed the wait. E163 removes 9a's polling from
the normal release path rather than adding a second wait — which is exactly what the backlog row
predicted ("the cost is one wait the SOP already pays, moved earlier").

## Verdict

**CHANGES_REQUESTED** — the gate itself is correct and I could not find a path that publishes a
tag on a red or unverified commit, but step 8b as documented will be killed by a default host
command timeout before it can answer on essentially every release (measured: ~165s CI vs a 120s
ceiling), and its only documented outcome in that case is `Blocked` → human on a green release —
which is how a correct gate gets relaxed away.

Required for APPROVED: **F1** (step 8b prose + the matching Escalation Routes row must
distinguish "the script reported a red/inconclusive result" from "the script never answered",
and must tell the operator to allow the poll to run and to re-run on a host-level kill).
**F2** and **F3** are small and should ride along. F4-F6 are non-blocking; fix or decline with
a line either way.

Everything else in this change is good work — the reversibility labelling at 8a/8c, keeping the
tag-first sha resolution out of the shared function, the 8c-vs-8a retarget at :69, and the
strictness conversion being genuinely total are all correct, and I verified each empirically
rather than taking the claim.

---

*Reviewer note (SOP "Recommended"): this review ran on `opus`; `dispatch_pins` records
sr-engineer as `fable`. Different model from the writer — no same-model bias to flag.*

## sr-engineer reply (round 1)

- **F1 (BLOCKING), fixed.** `content/skill-release-engineer.md` step 8b now carries a new
  paragraph, immediately after the existing strictness-asymmetry prose, that names the
  distinction explicitly: a host-level command-timeout kill is silence, not a verdict, and
  must never be conflated with the script itself printing a result. States the measured
  ~165s CI duration vs the 480s `AGC_VERIFY_CI_WAIT_SECONDS` budget, tells the operator to
  invoke with the longest timeout the host allows, and says explicitly that a kill before
  either `CI-CHECK PASSED` or a `FAIL:` line prints is NOT the STOP condition — re-run
  instead of escalating, since the CI run keeps completing independent of this process's
  lifetime. Says *why* the distinction exists (a gate that blocks every green release is a
  gate that gets relaxed, reopening E163's hole) so a future reader does not collapse the
  two states again. The matching Escalation Routes row (was :272, now further down after the
  new paragraph) is re-worded to trigger only on the script itself printing a non-`CI-CHECK
  PASSED` result, with an explicit carve-out for a host-level kill before any line prints.
  Host-agnostic throughout — no specific harness's timeout knob is named.
- **F2, fixed.** `scripts/verify-release.mjs`: `--sha` with a missing value or a flag-like
  next token (e.g. `--strict`) now prints `check:release — --sha requires a value (got
  <value>) — refusing to silently fall back to HEAD` and exits 1, rather than silently
  defaulting to HEAD. Verified both cases manually (`--ci-check --sha` and `--ci-check --sha
  --strict`) and confirmed a well-formed `--sha <sha>` still resolves and runs normally.
- **F3, fixed.** `content/skill-release-engineer.md:260`: "steps 8, 9, 9a, and now 13a" →
  "steps 8a, 8c, 9, 9a, and now 13a".
- **2a→8b forward reference, added.** Step 2a's prose now ends with an explicit forward
  reference to 8b as the strict backstop — nothing irreversible exists at 2a, 8b re-asks the
  same question under `--strict` before 8c's tag push, so a lenient early check plus a strict
  late check is safer than one strict early check — and states that a future asymmetry
  "fix" should look at 8b's coverage, never at tightening 2a.
- **F4-F6**: left as-is. Not named in this round's dispatch brief as required; all three were
  scored non-blocking in the review (F4 documentation-coherence-only, F5/F6 observations with
  no change asked). Deferring rather than expanding scope beyond the brief; can take a pass at
  F4's Escalation Routes row scoping if wanted in a later round.
- **qa flag (not mine to act on, per the brief):** `test/render-structure.test.mjs:193,200`
  still embeds the pre-E163 "step 8's `git add`" prose as a verbatim fixture/snapshot input,
  not an assertion against the live SOP text — correctly green, correctly outside the
  expected-red manifest, but now a stale copy. Flagging again here so it's visible in this
  doc, not only in the handoff note, for qa to pick up.
- **Verification**: `npm run build` clean (tsc + check:version + check:transitions-sync all
  OK). `npm test`: 2234 tests / 2230 pass / 4 fail — the same 4 as
  `qa_reports/expected-red_e163-ci-gate-ordering.txt`
  (`test/release-staging.test.mjs`: the E53 row-count pin, the E49/E44 step-order pin, and
  both E65 adapter-stamp/step-order pins), nothing else. No count change, no new reds.

---

## Round 2 — APPROVED — by code-reviewer

Scope of this round, per the dispatch brief: F1 only, plus a regression re-check on the
round-1 work and the 2a→8b forward reference. F2/F3 were verified by the coordinator before
dispatch (exit codes checked directly, sweep re-run) and are not re-litigated here. F4–F6
remain non-blocking and are not re-raised — see "Carried forward" below for my position.

### F1 — RESOLVED. The distinction is machine-checkable, and I verified it under the actual hazard.

I did not judge this on whether the prose says the right words. I checked whether the
executor can *mechanically* separate the two states, because that is the whole property.

**The output contract genuinely supports the discriminator.** `--ci-check` mode emits exactly
four line shapes (`scripts/verify-release.mjs:200-213`, plus `runCheck` at `:126-140`):

| line | when | stream |
|---|---|---|
| `check:release — CI-only check (strict\|lenient) for <sha12>` | preamble, always, immediately | stdout |
| `check:release — CI ground-truth: head <sha12> not found … polling again in Ns` | per poll iteration | stdout |
| `OK: CI ground-truth` + `check:release — CI-CHECK PASSED (<sha12>)` | terminal, success | stdout, exit 0 |
| `FAIL: …` + `check:release — CI-CHECK FAILED (<sha12>)` | terminal, failure | stderr, exit 1 |

The two terminal markers the SOP names are the only terminal outputs, and the poll-progress
line cannot be confused with either — it is prefixed `check:release — CI ground-truth:`,
sharing no prefix with `FAIL:` or `CI-CHECK PASSED`. I also confirmed the contract is
*complete* in the failure direction: `CI-CHECK FAILED` prints iff `failedChecks` is non-empty,
and `runCheck:136-140` prints every accumulated `FAIL:` line before pushing onto
`failedChecks`, so `CI-CHECK FAILED` can never appear without at least one `FAIL:` line
preceding it. There is no third terminal state.

**Flushing — tested, not reasoned about.** This was the real risk: the poll loop is fully
synchronous (`Atomics.wait` at `:498-502`, `spawnSync` at `:474`), so the event loop never
turns during a poll, and Node's stdout is async when connected to a pipe. If lines were
queued rather than written, a SIGKILL would discard them and the discriminator would be
reading a truncated stream. I spawned the script over a real pipe against an unmatched sha
with a 200s budget and SIGKILLed it at t=25s:

```
[t=  168ms] check:release — CI-only check (strict) for 000000000000
[t= 1880ms] check:release — CI ground-truth: head 000000000000 not found … (~198s left in budget)
[t=23671ms] check:release — CI ground-truth: head 000000000000 not found … (~176s left in budget)
--- SIGKILL at t=25s ---  child closed code=null signal=SIGKILL
contains CI-CHECK PASSED? false     contains a FAIL: line? false
```

Lines arrive incrementally in real time despite the synchronous loop (libuv writes short
lines to the pipe inline), and the killed process produced **neither** marker — precisely the
state the SOP tells the executor to treat as silence. The three states are mutually exclusive
and exhaustive, and `grep -q 'CI-CHECK PASSED'` / `grep -q '^FAIL:'` / neither is a sound
mechanical classifier. F1's fix rests on the output contract, not on the operator noticing.

### The re-run instruction terminates. Worked through, and it converges in ≤2 attempts.

A killed poll does restart from cold, but the CI run's completion is a **fixed instant on the
wall clock** set by 8a's push — it is not restarted by the retry. Successive attempts tile the
timeline, so some attempt's window necessarily contains that instant. The only question is
whether an attempt is long enough to *observe* it: from the trace above, the first `gh run
list` returns at ~1.9s, so an already-complete run is reported in ~2s. Any host timeout above
a few seconds suffices.

With the measured figures — CI ~165s median, host timeout ~120s — attempt 1 is killed at
t≈120 having learned nothing; attempt 2 starts at t≈120, polls at 20s intervals, and observes
the completed run at t≈165–185, i.e. 45–65s into its own 120s window. Two attempts. The
guidance converges.

### The Escalation Routes carve-out did not open a hole. A red CI cannot reach 8c through it.

The carve-out is safe because it removes silence from the STOP branch **without** adding it to
the GO branch, and the GO branch is stated positively: step 8b (`:228`) says refuse to
continue *unless the script reports `CI-CHECK PASSED`*. So silence is neither STOP nor GO — it
is RETRY. Proceeding to 8c still requires a positive marker, not merely the absence of a
negative one. That polarity is what makes the carve-out non-exploitable.

I also confirmed the marker cannot lie under `--strict`. Every "cannot obtain ground truth"
path — `gh` spawn failure, `gh` non-zero exit, unparseable JSON, zero completed runs, budget
expiry — routes through the `warn` closure (`:457-465`), which under `strict` pushes a `FAIL:`
and returns instead of logging a WARN. The definite-red path (`:545-549`) pushes `FAIL:`
unconditionally, independent of mode. So under `--strict` the *only* way to reach
`CI-CHECK PASSED` is a matched completed run with `conclusion === "success"`. A genuinely red
CI can only produce a printed `FAIL:`; if that attempt is killed first, the re-run prints it
again, because a red run stays red. No path from red CI to 8c.

Verified both directions empirically rather than by reading alone:

```
strict, unmatched sha, 0s budget   → FAIL: … refusing to proceed under the strict pre-tag gate   exit 1
strict, gh stubbed to exit 4       → FAIL: … gh run list failed: gh exited 4                     exit 1
lenient, gh stubbed to exit 4      → OK: CI ground-truth / CI-CHECK PASSED                       exit 0
```

### Regression check on the round-1 work — both clear.

- **`--strict` WARN→FAIL conversion**: intact. The three runs above exercise the conversion
  end-to-end across two distinct warn paths (budget expiry, `gh` error) and confirm the
  lenient sibling is unchanged in the same breath.
- **`evaluateCIGroundTruth` extraction**: intact. Check 6's call site (`:583`) still passes
  `strict: false`, reproducing pre-E163 behaviour, and the tag-first sha resolution (AC1/AC2,
  E141) remains at the call site rather than being pulled into the shared function — so Check
  6 still resolves from the tag and never polls the bookkeeping commit.
- **F2's edit did not disturb either.** It is confined to the CLI flag block
  (`scripts/verify-release.mjs:104-121`) and touches only `shaOverride`. `ciCheckStrict`
  remains an independent `argv.includes("--strict")` with no coupling to `shaFlagIdx`, and the
  guard returns before any mode dispatch, so it cannot reorder or suppress a strict check.

### 2a→8b forward reference — says *why*, not merely *where*.

`content/skill-release-engineer.md:53` gives the actual argument: nothing irreversible exists
at 2a (no release commit, no tag, nothing published), so an inconclusive read there has
nothing to protect; 8b re-asks the same question under `--strict` immediately before 8c's tag
push, which is the one point where inconclusive genuinely is not consent to publish; a lenient
early check backed by a strict late check is therefore strictly safer than making 2a strict,
which would manufacture escalations at zero marginal safety. It closes by directing any future
"fix" of the asymmetry at 8b's coverage rather than at tightening 2a. That is a reason, not a
pointer.

### Expected-Red Sampling (SOP 4a)

`qa_reports/expected-red_e163-ci-gate-ordering.txt` exists and carries 4 structured entries,
all in `test/release-staging.test.mjs`. I sampled **all 4** (not just 3) by grepping the named
test file for each exact test string — every one resolves to exactly 1 real, locatable test.
All four are pinned-string re-baselines caused by the deliberate step-8 → 8a/8b/8c rename and
the two added Escalation Routes rows; none indicates a defect. Retargeting them is qa's.

### Carried forward for qa — recorded, not blocking, no round spent

1. **The retry loop has no bound, and on exactly the hosts 8b addresses the budget-expiry
   escalation is unreachable.** `content/skill-release-engineer.md:230`. On a host whose
   command timeout is shorter than `AGC_VERIFY_CI_WAIT_SECONDS` (480s default) — which is the
   premise of the whole paragraph — every attempt is killed before the script's own deadline,
   so the `warn`-driven strict FAIL at `scripts/verify-release.mjs:552-558` can never fire. If
   a CI run genuinely hangs rather than merely being slow, the operator re-runs indefinitely
   with no escalation route, because the carve-out removed the only one. Safety direction is
   fine (it never publishes), which is why this is not blocking. Two cheap fixes, either
   sufficient: add a bounded-retry clause ("if N consecutive runs are killed with no verdict,
   escalate Blocked"), or advise setting `AGC_VERIFY_CI_WAIT_SECONDS` *below* the host timeout
   so the script reaches its own budget and prints a real strict `FAIL:` the executor can act
   on. The second is the more elegant — it converts an unobservable livelock into the existing
   printed-verdict path with no new prose semantics.
2. **`--branch main` is hardcoded** in `listCompletedRuns` (`scripts/verify-release.mjs:477-478`).
   Pre-existing to E163 (Check 6, E78), but E163 newly makes it *blocking*: a release cut from
   any branch other than `main` can never match, so 8b hard-FAILs under `--strict` after the
   full budget. Latent for this repo, which releases from `main`. Worth a follow-up ticket
   rather than a fix here.
3. **`CI-CHECK PASSED` is mode-dependent.** Under `--strict` it means "verified green"; under
   lenient it can mean "could not tell, degrading gracefully" — my first run printed
   `WARN: … has not completed yet` followed by `CI-CHECK PASSED`. Sound today, because 8b
   always passes `--strict` and the SOP hardcodes it. But the same literal is 8b's go-signal,
   so any future grep-based tooling that does not also track the mode flag would conflate the
   two. Consider disambiguating the summary line (`CI-CHECK PASSED (strict, verified)` vs
   `(lenient, unverified)`).
4. **Stale prose fixture**: `test/render-structure.test.mjs:193,200` — already recorded by
   sr-engineer and by the coordinator. Noted here only so it is not lost.

**F4–F6**: I stand by non-blocking and am not re-raising them. F4 (the `gh`-unavailable
Escalation Routes row now reading against three postures) is the one I would most like tidied,
but it is documentation coherence with no behavioural consequence — it belongs in the same
follow-up as items 1–3, not in a third review round.

### Round 2 verdict

**APPROVED.** F1 is fixed at the property level, not merely the prose level: the executor can
mechanically separate a host kill from a printed verdict (confirmed under SIGKILL over a pipe),
the re-run instruction provably converges in two attempts at the measured figures, the
Escalation Routes carve-out keeps the GO branch positively gated on `CI-CHECK PASSED` so no red
CI can reach 8c through it, and the round-1 `--strict` conversion and `evaluateCIGroundTruth`
extraction are both undisturbed by the F2 edit. Four non-blocking items recorded above for qa
and a follow-up ticket; none justifies a third round against a cap of 3.
