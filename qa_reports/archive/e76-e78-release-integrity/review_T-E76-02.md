covers: T-E76-01, T-E78-01, T-E76-02, T-E78-02

# QA Review — E76 + E78 (release-integrity) — T-E76-01, T-E78-01, T-E76-02, T-E78-02

**Dispatch shape**: mini-chain (sr-engineer -> code-reviewer -> qa-engineer),
backlog-row-as-spec — no `specs/e76-e78-release-integrity.md` (PM/architect
skipped; `docs/backlog.md` E76 + E78 rows ARE the spec, per `scope_decision_why`
on the coordinator's cut-approval write). Code-reviewer APPROVED at round 2
(`review_reports/review_T-E76-01.md`, covers T-E76-01 + T-E78-01). This
document is QA's own build (T-E76-02, T-E78-02 pins) plus the final release
gates for all four task ids, batched per the SOP's `covers:` convention.

`main` is RED at origin and stays red until this release ships (3 pre-existing
reds, all diagnosed by code-reviewer as legitimate contract flips — see
Disposition section below, independently re-verified by QA, not taken on faith).

## Phase 0.5 — Expected-Red Diff
Skipped: no `qa_reports/expected-red_e76-e78-release-integrity.txt` manifest
exists, and this is not a `dispatch_mode: "bugfix"` ticket (feature mode,
implicit — no `dispatch_mode` field on the handoff state).

## Phase 3.5 — AC Execution Log
Skipped: no `specs/e76-e78-release-integrity.md` exists (backlog-row-as-spec
mini-chain), so there are no `proof:`-annotated Acceptance Criteria to execute.

## Phase 1 — Review

### Disposition of the 3 pre-existing suite reds (independently re-verified, not accepted from code-reviewer's report)

1. **`test/verify-release.test.mjs` VR-11 / VR-12** — code-reviewer's claim:
   both fixtures shimmed a dummy `headSha` that could never match a real
   fixture repo's actual HEAD, so under E78's sha-matched Check 6 both
   correctly WARN instead of FAIL/OK; the FAIL path itself is not disarmed.
   **Verified myself, independently, before touching the test file**: wrote a
   standalone probe (not part of the committed suite) that builds a real
   fixture repo exactly as `mkFixtureRepo` does, resolves its actual
   `git rev-parse HEAD`, and shims `gh` with that real sha —
   - conclusion `"failure"` at the real HEAD -> exit 1, stderr:
     `FAIL: latest completed CI run on main concluded "failure" (head
     7b6f43a257f2) — https://example.com/actions/runs/2`, all 5 other checks
     OK.
   - conclusion `"success"` at the real HEAD -> exit 0, `OK: CI ground-truth`,
     `ALL CHECKS PASSED`, empty stderr.
   This confirms the single most consequential assertion in this cut — the
   red-run FAIL path — still arms correctly under the fixed code. Retargeted
   both tests to resolve `headSha` via `git(["rev-parse","HEAD"], root)`
   rather than a placeholder (matching the real script's own
   `releaseSha = git(["rev-parse","HEAD"])`).
2. **`test/release-staging.test.mjs:2303`** — code-reviewer's claim: sr-engineer
   misattributed this red; the E69-round-2 `EXCLUDE_QA`/`EXCLUDE_RR` asymmetry
   is still exactly present, and only the test's string predicates
   (`review_T-<CODE>-*.md` vs the shipped `review_T-${c}-*.md`) and the
   inline-`&&`-guard regex (now an enclosing `if`) went stale. Confirmed by
   reading `content/skill-release-engineer.md:143` (qa_reports move loop, no
   `EXCLUDE_QA` guard) against `:146-150` (review_reports move loop, guarded
   by an enclosing `if [ -z "$EXCLUDE_RR" ]; then`). Retargeted the test to
   locate both loops by their actual `${c}` text and assert the guard by
   scanning a small window of preceding lines for the enclosing `if`, rather
   than an inline suffix on the match line itself — and pinned the asymmetry's
   continued presence (qa_reports side still unguarded) as an exact ratchet,
   not silence.
3. No real regressions among the three, confirmed independently.

### T-E76-02 pins — `test/release-staging.test.mjs`

Per code-reviewer's explicit recommendation (round 2 Architecture section):
a **class assertion** over an instance pin, citing the E66/E69 precedent that
"both paid off" (E69's class assertion found E75 on its first run). Three new
pins added, all extracting fragments mechanically from the shipped SOP text
(never a hand-copied restatement) and all demonstrated — not merely
asserted — to red against the round-1 defect shape:

1. **Referenced == assigned** (closes F1 as a class): assembles all five step
   7a fragments (PREV_TAG resolution, guard fence, the EXECUTABLE `CODES=`
   derivation, the logging line, the move/covers fence) in the SOP's own
   mandated order, then statically extracts every shell variable name
   REFERENCED (`$VAR`/`${VAR}`) versus ASSIGNED (`VAR=`, `for VAR in`)
   anywhere in the assembled text. Asserts the two sets are equal (both
   directions — `referenced-not-assigned` is the load-bearing half that
   closes F1; `assigned-not-referenced` is a non-load-bearing sanity check
   against dead assignments, noted as such in the test).
   - On the current shipped text: both sets are exactly `{CODES, COVERS_RE,
     EXCLUDE_QA, EXCLUDE_RR, MSG, PREV_TAG, STOP_QA, STOP_RR, c, cl, f, qf,
     rf}` — 13 names, matching code-reviewer's own hand-verification in round
     2 exactly.
   - A real false-positive was caught and fixed while building this pin: the
     STOP guard's own message text contains the literal substring
     `(PREV_TAG='$PREV_TAG')` — human-readable documentation of what the
     printed message will look like, embedded inside `MSG`'s double-quoted
     value. A naive `VAR=` scan flags this as an assignment, which would have
     silently defeated the whole invariant (both sets would spuriously gain a
     `PREV_TAG=` hit and always appear balanced). Fixed by masking the
     interior of quoted strings before scanning for assignments — a real
     shell assignment's LHS name is never itself inside a quote, so masking
     removes exactly this class of false hit without touching real
     assignments like `MSG=` or `CODES=`.
   - **Guard-the-guard, demonstrated in the test itself**: reconstructs
     round 1's actual defect (fragment 1 omitted from the assembled script,
     matching round 1's enumeration bug — "everything below" never named the
     `PREV_TAG` bullet above it) against fragments 2-5, and asserts the
     invariant's `referenced-not-assigned` diff is exactly `["PREV_TAG"]` on
     that reconstruction. Confirms the pin is a real ratchet, not vacuously
     true against the current text.
2. **Exactly one fence opens `CODES=$(`** (pins fragment 3's identity):
   scoped to step 7a's own section (between the "7a." and "7b." headings, so
   step 8's unrelated `bash -c` existence-pre-filter fence is out of scope).
   Confirmed exactly 1 match on the shipped text (the illustrative
   `find`/`grep` fence immediately above it does not open with `CODES=$(`).
   Guard-the-guard: a mutated copy with a synthetic second `CODES=$(` opener
   injected into the illustrative fence's position confirms the count-based
   assertion actually discriminates (count goes to 2, not vacuously 1).
3. **Single-invocation property** (F2 regression guard, added beyond the two
   explicitly requested pins, per the ticket's "consider also pinning"
   note): asserts (a) the literal quoted heredoc opener `bash <<'STEP7A'` is
   present, (b) no fenced code block within step 7a's section contains
   `bash -c` (scoped to fences, not surrounding prose, since the prose
   legitimately discusses the retired `bash -c` shape by name while
   explaining why it was replaced — a bare substring match over the whole
   section would false-positive there), and (c) exactly one bare `STEP7A`
   terminator line closes the heredoc. Guard-the-guard: a reconstructed
   round-1-style `bash -c`-wrapped move fence is confirmed caught by the same
   predicate.
   - **Not covered, deliberately**: the five-fragment assembly-ergonomics
     residual itself (spreading the script across ~110 lines of SOP prose,
     two of which are non-executable illustrative fences). See Part 4 below
     for the explicit accept/file/pin decision on that separate concern —
     this pin only guards the *invocation shape*, not the *assembly burden*.

All three run and pass against the current shipped text; all three
demonstrably red against a reconstruction of the round-1 defect they exist to
close. `npm test` after adding them: 1742/1742 (see Phase 4).

### T-E78-02 pins — `test/verify-release.test.mjs`

Four behaviors required by the row; the fourth (degradation) is the actual
regression risk per E9/E14 and per the ticket's own framing:

1. **Green run at a DIFFERENT commit -> WARN, not OK** (the core v3.102.2
   regression this ticket exists to close): new test **VR-17** — a completed
   `success` run whose `headSha` is an unrelated sha WARNs
   `"this commit's CI has not completed yet"` naming THIS commit's own head,
   never accepted as ground truth. This is the one behavior no pre-existing
   test covered (VR-11/VR-12 only ever exercised the matching-sha paths, so
   retargeting them alone would have left the actual regression-fix
   unpinned).
2. **Green run at the release commit -> OK**: VR-12, retargeted to resolve
   `headSha` from the fixture's real HEAD (see Disposition #1 above).
3. **Red run at the release commit -> FAIL**: VR-11, retargeted the same way.
4. **Every existing graceful-degradation path still WARNs, check stays
   green, never a blocker**: VR-13 (gh missing), VR-14 (gh non-zero/auth),
   VR-15 (zero completed runs), VR-16 (unparseable output) — all
   pre-existing, all still pass unmodified against the new sha-matched Check
   6, confirming E9/E14's contract survived the fix. Two more added for
   completeness given code-reviewer's own "worth adding while there" note:
   - **VR-18**: a red run at a DIFFERENT commit also WARNs (does not block) —
     it is exactly as much "the wrong answer" as a stale green, not a fatal
     mismatch; only a red run AT the release commit is a FAIL.
   - **VR-19**: a matching red run buried at position 8 of a 10-run
     `--limit 10` window still FAILs, proving the window is genuinely
     searched via `.find`, not effectively just `runs[0]`.
   VR-8's WARN-on-stdout/FAIL-on-stderr split (VR-8 pin) re-verified
   unmodified and still passing.

All nine Check-6-relevant tests (VR-8, VR-11, VR-12, VR-13-19) pass. `npm test`
after adding them: 1742/1742 (see Phase 4).

## Part 4 — recorded follow-up: the five-fragment assembly burden

**Decision: FILE (not pin, not silently accept).**

Code-reviewer tested both mis-assembly modes by execution and found neither
destructive: an indented terminator fails loud (exit 127, `command not
found`) after the body still runs correctly and completely; pasting the
illustrative fence in fragment 3's place binds nothing, producing a visibly
self-contradicting transcript (the files it failed to derive from, printed
directly above `{∅}`) rather than a silent no-op. On that basis code-reviewer
did not block round 2 on it, and named the qa ratchet (the three T-E76-02
pins above) as the durable control it chose *instead of* a third sr-engineer
round or a same-round reorg.

Why FILE rather than PIN: the three tests above already pin every concrete
correctness invariant this residual could violate (referenced==assigned,
fragment 3's unique identity, single-invocation shape) — a fourth test
asserting "step 7a is exactly one fence" would not be pinning a behavior, it
would be silently re-litigating code-reviewer's own explicit non-block
decision by making the reorg a requirement through the back door. That is
also outside QA's scope: style/assembly-shape calls belong to code-reviewer
and sr-engineer, and QA FAILs only for failing tests, missing required
coverage, or test-infra defects (none of which this is, once the three pins
above are in place).

Why FILE rather than ACCEPT (silently): code-reviewer explicitly called the
coordinator's single-complete-block shape "strictly safer at no cost," and
letting that observation evaporate with no record would be the same failure
mode E17 flags elsewhere in this same feature (a self-report claim not
tied to a durable artifact). Recommending pm/coordinator open a follow-up
backlog row (post-release, non-blocking, P3) to consolidate step 7a's five
prose fragments into one copy-pasteable block with explicitly-marked
non-executable illustrative fences — QA does not hand-author
`docs/backlog.md` rows itself (release bookkeeping / backlog authorship is
outside qa-engineer's Artifact allowlist); this is a recommendation for the
next role in the chain (release-engineer hands to pm at the terminal step
regardless), not a self-executed action.

## Phase 4 — Run

**Full suite** (`npm test`, this working tree, all edits included):
```
1..1729
# tests 1742
# suites 1
# pass 1742
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
1742/1742 — the expected 1736 (E77 baseline) + 3 net-new tests from VR-17/18/19
(VR-11/VR-12 retargeted in place, not net-new). Zero fails, zero skips. All
three former reds (VR-11, VR-12, `release-staging.test.mjs:2303`) now pass.

**Shallow-clone gate** (E77 precedent — this release ships E77's own
hermetic-fixture meta-test, so a deep-clone green run alone is not evidence):
built a throwaway snapshot repo capturing the CURRENT working tree exactly
(tracked + untracked, all of this session's edits included — not just the
last commit, since qa's job is to validate the proposed change set, not a
stale prior commit), committed it once, then:
```
$ git clone --depth 1 file://<snapshot> <clone>
$ cd <clone> && git rev-list --count HEAD   -> 1
$ git rev-parse --is-shallow-repository     -> true
$ npm ci                                     -> added 174 packages, 0 errors
$ npm test
1..1729
# tests 1742
# suites 1
# pass 1742
# fail 0
```
Genuinely shallow (single commit, `is-shallow-repository=true`, no history
available at all) — 1742/1742, confirming E77's meta-test guard holds and
none of this feature's own new tests read repository history as a fixture
either.

**Build**: `npm run build` — `check:version` OK (3.102.2, dist parity
confirmed), `tsc` clean, `check:transitions-sync` OK (21 keys, exact match).
Zero errors.

**Dependency audit**: `npm audit --audit-level=high` — exit 0. 5 findings, all
LOW/MODERATE (none HIGH/CRITICAL): `body-parser` (low), `esbuild` (low),
`@hono/node-server` (moderate), `hono` (moderate), `protobufjs` (moderate).
Cross-checked against `docs/dependency-advisories.md:91-98` (E57's
disposition table) — all five already recorded with a decision (deliberately
deferred; upgrading `@modelcontextprotocol/sdk` to clear them was rejected as
out of scope for E57) and no re-review trigger fired (none promoted to
HIGH/CRITICAL). Expected and non-blocking per skill-release-engineer.md step
6a.

**`scripts/verify-release.mjs` independent re-verification** (QA is the last
gate before this script is trusted to guard the next release): beyond the
retargeted VR-11/VR-12/new VR-17/18/19 in the committed suite, ran a
standalone probe (outside the suite, disposable) building a real fixture repo
and driving the actual shipped script against a real `gh` shim at the
fixture's real HEAD — confirms independently, not just via the test harness,
that: (1) a green run at a different commit WARNs [confirmed via VR-17], (2)
a green run at the release commit passes [probe: exit 0, `OK: CI
ground-truth`, empty stderr], (3) a red run at the release commit FAILs
[probe: exit 1, `FAIL: latest completed CI run on main concluded "failure"
(head 7b6f43a257f2)`, all 5 other checks still OK], (4) every degradation
path still WARNs and leaves the check green [VR-13-16, unmodified, all pass].

## Verdict

**PASS** — T-E76-01, T-E78-01, T-E76-02, T-E78-02. All three pre-existing
reds resolved by retarget (none retired, none masked). Both requested T-E76-02
pins landed as class assertions per code-reviewer's recommendation, plus a
third (single-invocation) added for completeness, all three demonstrated to
red against the round-1 defect shape. All four required T-E78-02 behaviors
covered, including the one (stale-green WARN) no pre-existing test exercised.
Full suite 1742/1742, shallow-clone gate 1742/1742, build clean, audit clean
against recorded advisories, `verify-release.mjs` independently
re-confirmed at all four Part-3 behaviors. Part 4 follow-up recorded
(FILE, not pinned, not silently accepted) with explicit rationale. Ready for
release-engineer; E77's already-PASSed, uncommitted work
(`test/render-structure.test.mjs`, `qa_reports/review_T-E77-0{1,2}.md`) is
undisturbed and ships in the same release.
## 2026-08-18T05:43:34.390Z — PASS — by qa-engineer

PASS — E76+E78 release-integrity, batched with T-E76-02/T-E78-02 pins. All 3 pre-existing suite reds retargeted (none retired): VR-11/VR-12 (verify-release.test.mjs, dummy headSha never matched fixture HEAD under E78's sha-matched Check 6) and release-staging.test.mjs:2303 (stale review_T-<CODE>-*.md string predicate + inline-guard regex vs the shipped ${c}/enclosing-if shape; EXCLUDE_QA/EXCLUDE_RR asymmetry confirmed still present, re-pinned as ratchet). Independently re-verified (not on code-reviewer's word) that the red-run FAIL path still arms: standalone probe against a real fixture HEAD shimmed red -> exit 1 FAIL naming conclusion/sha/url; shimmed green -> exit 0 OK. T-E76-02: 3 class-assertion pins added to test/release-staging.test.mjs (referenced==assigned over the assembled 5-fragment step-7a script, closing F1 as a class; exactly-one-fence-opens-CODES=$( pinning fragment 3's identity; single-invocation shape guarding against bash -c reintroduction) -- each demonstrated (not merely asserted) to red against a round-1 reconstruction via an in-test guard-the-guard. T-E78-02: VR-11/VR-12 retargeted + VR-17 (stale-green at a different commit -> WARN, the actual v3.102.2 regression, previously uncovered) + VR-18 (unrelated red -> WARN, non-blocking) + VR-19 (matching red buried at position 8/10 in the run window still FAILs) added; all pre-existing degradation tests (VR-13..16, gh missing/non-zero/zero-runs/unparseable) and VR-8's stdout/stderr split re-verified unmodified and passing. Part 4 (5-fragment assembly-burden follow-up) decided explicitly: FILE, not pin or silent-accept -- recommend pm open a non-blocking P3 backlog row post-release for the single-complete-block consolidation; rationale in qa_reports/review_T-E76-02.md (the 3 class pins are the durable control code-reviewer asked for instead of a reorg, and a 4th test enforcing the reorg shape would silently override code-reviewer's own non-block call, outside QA's FAIL scope). Gates: full suite 1742/1742 (1736 baseline + 3 net-new VR-17/18/19; VR-11/VR-12 retargeted in place). Shallow-clone gate: built a throwaway snapshot of the current working tree (this session's edits included), git clone --depth 1 (confirmed genuinely shallow: rev-list count 1, is-shallow-repository=true), npm ci clean, npm test 1742/1742 -- E77's hermetic-fixture meta-test holds and none of this feature's new tests read repo history as a fixture either. npm run build clean (check:version OK 3.102.2, tsc clean, check:transitions-sync OK). npm audit --audit-level=high exit 0 -- 5 findings (body-parser/esbuild low, @hono/node-server/hono/protobufjs moderate), all pre-recorded in docs/dependency-advisories.md:91-98 (E57) with no re-review trigger fired. Full evidence: qa_reports/review_T-E76-02.md (covers all 4 task ids). E77's already-PASSed, uncommitted work (test/render-structure.test.mjs, qa_reports/review_T-E77-0{1,2}.md) undisturbed, ships in this same release. Ready for release-engineer.

