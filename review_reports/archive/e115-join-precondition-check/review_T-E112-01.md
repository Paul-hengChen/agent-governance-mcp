# Review — T-E112-01 (e112-drift-fanout-and-feature-scope)

covers: T-E112-01

Reviewed diff: `git diff 1b5a48c -- tools/drift.ts` + new untracked `tools/evidence-lookup.ts`.
Base `1b5a48c`, branch `feat/e112-drift-fanout-and-feature-scope`, lane `<lanes-root>/e112`.
Method: A/B execution — the base build (`git show 1b5a48c:dist/tools/drift.js`, staged to a temp module and
removed afterwards) run side by side with this lane's `dist/tools/drift.js` against ~25 scratch fixtures
outside the repo, plus cost measurement against this workspace's real `qa_reports/` tree.

> **Note on provenance**: a previous code-reviewer context was killed mid-review by a usage limit and left
> no output. This review was performed from scratch; no claim from that context was inherited.

## Summary

- Two mechanisms in `tools/drift.ts` (+148/−5) and one new 91-line module `tools/evidence-lookup.ts`:
  (a) an advisory-only `fanoutAdvisory` field + scope-qualified clean headline; (b) an evidence-aware split
  of the "Possible vibe-coding drift" bucket into a new `evidenceBackedIds` array.
- The **structural separation is right**: `fanoutAdvisory` is genuinely advisory (read by no gate, never
  flips `driftDetected`, present on all five return paths), `driftBaselineIds` still runs first and
  unchanged, and the handoff-ahead / FAIL-Blocked / version-skew / archived-section paths are byte-identical
  under A/B. `npx tsc --noEmit` clean; full suite **2135/2135 green**; boundaries respected.
- **One blocking defect**: the case-(b) evidence test is existence-only, so a genuine, *server-written*
  QA **FAIL** report silences the detector for that id — `driftDetected` flips `true → false` and the
  headline reads "No drift detected. Handoff and tasks are synchronized." A zero-byte hand-created file
  does the same. This is the E120 family and it fails the ticket's own bar (`該叫的時候叫`).
- Six non-blocking findings: bucket re-tiering (verified correct, needs a QA pin), a legacy clean-headline
  change on essentially every active workspace, an uncompressed 576-byte unconditional advisory, a missing
  memoisation that diverges from the precedent the module itself cites (~10 ms per drifted id measured here),
  a symlink escape out of the workspace, and untyped early-return literals.
- Verdict: **CHANGES_REQUESTED**.

## Correctness

### [BLOCKING] C1 — Existence-only evidence lets a QA **FAIL** launder a `[x]` out of the drift bucket
`tools/evidence-lookup.ts:60-67` (`hasDirectEvidenceFile`), consumed at `tools/drift.ts:418-421`.

`hasEvidenceAnywhere` returns true on `fs.existsSync(qa_reports/review_<id>.md)` with **no inspection of
the file's content**. But `gates/qa-review.ts:44-59` (`recordReviewInFile`) writes PASS and FAIL rounds into
that *same path* — `## <ts> — FAIL — by <reviewer>` — and creates the file on the FAIL round. So the very
server path that records a failed QA round manufactures the artifact that silences the detector.

Reproduced end to end (scratch fixture, this lane's `dist/`):

```
BEFORE any evidence:                     driftDetected = true
  details[0] = "Task list shows T-X completed, but handoff state doesn't mention it. Possible vibe-coding drift."
await recordReviewInFile(w, ["T-X"], "FAIL", "qa-engineer", "AC-2 fails: nothing implemented.")
AFTER server-written FAIL:               driftDetected = false   evidenceBackedIds = ["T-X"]
  details[0] = "No drift detected. Handoff and tasks are synchronized."
  details[1] = "1 task(s) (T-X) ... but QA evidence for them exists on disk ... this is NOT vibe-coding drift."
```

The scenario is ordinary, not contrived: QA FAILs a task (file created), sr-engineer fixes, someone marks
`[x]` in `tasks.md` without a PASS ever being recorded. Previously that was reported. Now the detector
affirmatively asserts the opposite — *"this is NOT vibe-coding drift"* — on the strength of a failure record.

Weaker variants of the same hole, each verified:
- **Zero-byte file** — `qa_reports/review_T-9.md` of length 0 diverts the id and flips `driftDetected` false.
- **Unrelated archive `covers:`** — `qa_reports/archive/totally-other-feature/review_T-OTHER.md` containing
  `covers: T-OTHER, T-9` launders `T-9`, a feature that report never judged.

**Judgement on the Q1 trade-off**: existence is the wrong call *here*, and the trade-off is not stated
anywhere a future reader would find it. `gates/qa-review.ts` can defensibly use existence because its file
is created only by a `tw_update_state(qa_review=...)` write that the server itself gated. `drift.ts` cannot:
it is the *last* check that catches a ledger/tasks mismatch, so its evidence test must be at least as strong
as the claim it suppresses — and the claim it prints is "this completion was really recorded". Neither the
module header (`tools/evidence-lookup.ts:1-18`) nor `buildEvidenceBackedLine`'s 12-line rationale comment
(`tools/drift.ts:62-73`) mentions that a FAIL, an empty file, or an unrelated `covers:` line qualifies.

**Required fix** (cheap — the content is already structured): require a PASS verdict, not a file.
`recordReviewInFile` appends chronologically, so the correct rule is that the **last** `## <ts> — <VERDICT> — by <r>`
section in the file is `PASS` (a stricter and more honest rule than "contains a PASS anywhere", which a
PASS-then-FAIL re-open would defeat). Apply the same content test on the `covers:` path — a `covers:` line
should only launder an id if the file carrying it records a PASS. If the team instead decides existence is
acceptable, that decision must be written into `tools/evidence-lookup.ts`'s header *and* into
`buildEvidenceBackedLine`'s output string, because the string currently over-claims.

### [non-blocking] C2 — Diverting ids re-tiers the surviving drift bucket (verified correct, needs a QA pin)
`tools/drift.ts:415-427` feeding `compressDriftDetails` / `DRIFT_COMPRESS_THRESHOLD` (`tools/drift.ts:174-196`).

Removing evidence-backed ids before compression changes the bucket's size and therefore which of the three
tiers the remainder lands in. Measured (6 drifted ids, 2 evidenced):

```
BASE: ["6 tasks (T-1–T-6) completed in task list but not in handoff state. Likely accumulated prior-session drift."]
NEW:  ["Task list shows 4 task(s) completed (T-3, T-4, T-5, T-6) that handoff state doesn't mention. Possible vibe-coding drift.", <evidence line>]
```

This is **semantically correct** — the un-evidenced bucket genuinely holds 4 ids, and tiering should follow
the bucket actually being reported. No id is lost, `driftDetected` stays true, and the un-diverted cases are
byte-identical to base at every tier (1 id, 6 ids, and the mixed vibe+handoff-ahead case all verified). Raised
only so qa-engineer pins it deliberately rather than discovering it as a surprise re-baseline.

### [non-blocking] C3 — sr-engineer's "no re-baseline needed" claim is true, but its inference is false
`test/token-efficiency.test.mjs`, `test/drift-archived-tasks.test.mjs`, `test/drift-baseline.test.mjs` do all
pass unmodified (re-run here: 71/71 across those three plus `drift-stamp-advisory`, `tw-sync-reconcile`,
`e117-void-task`; full suite 2135/2135). But the stated reason — "every legacy path stayed byte-identical" —
is **not** what happened. The clean headline is *not* byte-identical (see Q2 below). The suite passes because
the single assertion on that string, `test/token-efficiency.test.mjs:235`, is a loose
`assert.match(report.details[0], /No drift detected/)`, and the new string `"No drift detected within this
workspace. …"` coincidentally still matches that regex. The green suite is luck, not coverage — qa-engineer
should treat the clean-headline branch as **untested**, not as baselined.

### [non-blocking] C4 — Clean headline changes for essentially every active workspace
`tools/drift.ts:444-451`.

With `drifts.length === 0`, the legacy string is now returned only when `incompleteTasks` is empty:

```
zero incomplete tasks  → "No drift detected. Handoff and tasks are synchronized."          (byte-identical ✅)
≥1 incomplete task     → "No drift detected within this workspace. N active-scope task(s) are not yet
                          recorded as complete here — see fanoutAdvisory."                  (changed)
```

Verified across four fixtures including the archived-`## Completed` convention. Since almost every workspace
under active development has at least one unchecked task, this is the common path, not the edge. It is
**in-cut** per the approved `scope_decision` ("advisory-only `fanoutAdvisory` field + scope-qualified clean
headline"), so non-blocking — flagged because it is a wider blast radius than the phrase "scope-qualified"
suggests, and because C3 means nothing in `test/` currently guards either branch.

## Quality

### [non-blocking] Q1 — `hasEvidenceAnywhere` diverges from the precedent it cites
`tools/evidence-lookup.ts:84-91` vs `gates/qa-review.ts:62-85`.

The module header names `hasEvidenceInFile` as its model, but inverts that function's shape. `hasEvidenceInFile`
is a **batch** API over `taskIds[]` that memoises the coverage index — its comment says so explicitly: *"built
at most once per call and ONLY on the first direct-file miss (AC-6)."* `hasEvidenceAnywhere` is per-id with no
memoisation, and `drift.ts:416` calls it in a loop, so the index is rebuilt from scratch for every id. See P1
under **Performance** for the measured cost. Recommend `hasEvidenceAnywhere(workspacePath, taskIds: string[])`
returning a `Set`, mirroring the precedent exactly.

### [non-blocking] Q2 — Early-return literals are not typed as `DriftReport`
`tools/drift.ts:294`, `:311`, `:324`, `:343`.

All four early returns are bare object literals handed to `JSON.stringify`, so TypeScript never checked them
against the `DriftReport` interface — nothing would have caught a dropped field. I verified by hand and by
execution that all five return paths do carry `fanoutAdvisory` and `evidenceBackedIds`, and that neither is
ever `undefined` (version skew, missing handoff, missing tasks, no-tasks-file, and the main path all checked).
Annotating them `: DriftReport` would make the next field addition safe by construction.

### [non-blocking] Q3 — Sanitisation collision and direct/covers asymmetry (inherited, informational)
`tools/evidence-lookup.ts:28-30`.

`sanitizeTaskId` folds any non-`[A-Za-z0-9._-]` character to `_`, so distinct ids collapse onto one filename
(`T-A:B` and `T-A_B` both → `review_T-A_B.md`) — one more way an unrelated incarnation's evidence launders an
id. Also asymmetric: the direct-file path sanitises while `hasCoversEvidence` matches the **raw** id against
the index. Both behaviours mirror `gates/qa-review.ts` exactly, so this is consistency, not drift, and I am
not asking for a change. Noted only because the collision has more consequence in a detector than in a gate.

Comment quality elsewhere is good — the rationale headers on `buildEvidenceBackedLine` and
`computeFanoutAdvisory` correctly record the E109 / E150 boundary and why `tw_sync` is the wrong remedy. The
one thing they omit is C1's trade-off.

## Architecture

No `specs/e112-*.md` or architecture doc exists (mini-chain: the backlog row at `docs/backlog.md:234` is the
spec). Judged against that row and the approved `scope_decision`.

**Boundary compliance — verified clean.** `git status` shows only `tools/drift.ts`, new `tools/evidence-lookup.ts`,
`dist/` build output, and the two governance files. Untouched: `gates/qa-review.ts` (and `hasEvidenceInFile`
semantics), `test/`, `content/`, `tools/handoff-write.ts`, `scripts/verify-release.mjs`, `schema/`,
`docs/backlog.md`. No part of E113/E115/E116/E132/E150 is implemented; E150 is correctly named as the root
cause and deliberately not fixed.

**Case (a) is genuinely advisory — verified.** `grep -rn "fanoutAdvisory|evidenceBackedIds" gates/ index.ts
content/ prompts/` prints nothing: no gate reads either field. `fanoutAdvisory` never enters a drift `details`
line (the scope-qualified headline is a separate string in the `drifts.length === 0` branch, reached only when
`driftDetected` is already false) and never flips `driftDetected`. Correct.

**E109 compliance — one leak.** `computeFanoutAdvisory` reads only `workspacePath`, as required. But
`safeIsDirectory` (`tools/evidence-lookup.ts:40-46`) uses `fs.statSync`, which follows symlinks, so a
symlinked `qa_reports/archive/<name>` pointing outside the workspace *is* scanned:

### [non-blocking] A1 — Symlinked archive subdir escapes the workspace
Verified: `qa_reports/archive/link -> /tmp/outside/` containing `review_T-7.md` diverts `T-7` and flips
`driftDetected` to false. Given E109's ratification that the server is deliberately workspace-scoped, evidence
living outside the workspace should not count. `fs.lstatSync` in `safeIsDirectory` confines it in one word.

**Worktree probe — clean.** `isLinkedWorktree` (`tools/drift.ts:88-95`) is pure `fs.statSync(.git).isFile()`
in a try/catch, never shells out to git, and matches the documented detection in `bin/agc-init.mjs`. Verified
no throw and correct result for: `.git` absent (false), `.git` directory (false), gitfile (true), dangling
`.git` symlink (false).

### [non-blocking] A2 — The advisory's trigger is not sharpened by its own signals
`tools/drift.ts:113-140`. Answering the ticket's `該叫的時候叫、不該叫的時候不叫` test for case (a): the
advisory fires on `incompleteTasks.length > 0` alone, which is true of virtually every workspace under
development. The two positive lane signals — `.current/feature-split.md` and linked-worktree — are appended as
*text* inside the message, not used as conditions, so they decorate the advisory rather than sharpen it. A
solo-dev single-checkout workspace with one open task gets the full 576-byte multi-lane caveat with no lane
signal at all. That is the "trains readers to ignore it" failure mode. Suggested: fire only when at least one
positive lane signal is present (or emit a one-line form otherwise). Non-blocking — no gate reads it and it
cannot cause a wrong verdict — but as written it is closer to decoration than to a signal.

## Security

No new trust boundary, no secrets, no injection vector, no network or subprocess. All filesystem access is
read-only.

**Path traversal — closed.** `sanitizeTaskId` folds `/` to `_`, so no task id can produce a path separator.
Verified with a task id of literally `../../evil`: the constructed filename is `review_.._.._evil.md` inside
`qa_reports/`, and the detector reports the id normally with no escape. `..`-only segments are inert for the
same reason. Matches the `gates/qa-review.ts:24-28` precedent.

**Failure modes — non-throwing, verified.** Every fs call is wrapped (`safeReaddir`, `safeIsDirectory`, plus
the outer try/catch in `hasEvidenceAnywhere`). A `qa_reports` path that is a broken symlink yields the
un-diverted base behaviour, byte-identical to base, with no exception. Absent `qa_reports/` and absent
`qa_reports/archive/` both yield `false` cleanly.

The symlink-follow at A1 above is a scope leak rather than a security hole — it reads only paths the workspace
owner created — but it is the one place the module can touch bytes outside `workspacePath`.

## Performance

### [non-blocking] P1 — The archive scan is unbatched and un-memoised; ~10 ms per drifted id here
`tools/evidence-lookup.ts:51-77`, called per-id from `tools/drift.ts:418`.

Per **miss** id the module performs, with nothing cached across ids:
`archivedFeatureDirs` → 1 `readdir` + 58 `statSync` (in `hasDirectEvidenceFile`), up to 58 `existsSync`, then
in `hasCoversEvidence` a full `buildCoverageIndex` over `qa_reports/` root (**reads all 292 `.md` files**),
then `archivedFeatureDirs` **again** (another readdir + 58 stats), then one `buildCoverageIndex` per archive
subdir — 58 more `readdir`s and the remaining ~200 file reads. Roughly 490 file reads and 120 directory
listings *per id*.

Measured against this workspace's real tree (58 subdirs under `qa_reports/archive/`, 492 `.md` files total):

| ids (all misses) | wall time |
|---|---|
| 1 | 46 ms (cold) |
| 5 | 59 ms |
| 10 | 112 ms |
| 20 | 208 ms |

Linear at ~10 ms/id, versus 0 ms for the base implementation (which did no I/O at all) and ~0 ms for the
root-hit path. The cost lands on the **miss** path — i.e. exactly the genuine-drift ids, in exactly the oldest
and largest workspaces. This lane's own state (8 drifted ids) pays ~80 ms per `tw_detect_drift`; a workspace
with 100 drifted ids and a 200-subdir archive would pay seconds on a tool that is a mandatory pre-flight step.
It is bounded and linear, so not a complexity-class blow-up, but it is a regression from zero and it
contradicts the memoisation the cited precedent performs (Quality Q1). Fix with Q1's batch signature, or hoist
the index build to once per `detectDrift` call.

### [non-blocking] P2 — `fanoutAdvisory` is unconditional prose and skips the file's own compression discipline
`tools/drift.ts:113-140`.

576 bytes of largely static text are emitted on **every** `tw_detect_drift` call in any workspace with ≥1 open
task. Measured: a clean report grows from **182 → 868 bytes (4.8×)**. Worse, `incompleteTasks.join(", ")` at
`tools/drift.ts:132` enumerates *every* open id with no `formatIdRange` and no `DRIFT_COMPRESS_THRESHOLD`
check — directly against the stated purpose of the compression machinery 40 lines above it in the same file
("preventing 20+ identical lines from bloating the LLM context"). A 60-open-task backlog emits all 60 ids
every call. At minimum apply `formatIdRange`; better, combine with A2 and gate the advisory on a lane signal.

No other performance change: `idPatterns` pre-compilation, the archived-section filter, and the baseline set
are untouched, and their A/B output is byte-identical.

## Verdict

**CHANGES_REQUESTED** — the case-(b) evidence test is existence-only, so a server-written QA **FAIL** report
(or a zero-byte file) flips `driftDetected` to false and makes the detector assert "this is NOT vibe-coding
drift" about an id whose only recorded verdict is a failure; that is the ticket's prohibited trade of quiet
for laxity (C1). The case-(a) advisory mechanism, the baseline/handoff-ahead/version-skew/archived-section
regression surface, the boundary discipline, and the non-git worktree probe are all correct and verified —
only C1 must change to land; C2–C4, Q1–Q3, A1–A2 and P1–P2 are non-blocking.

---

# Round 2 — APPROVED — by code-reviewer

> Fresh context. No memory of round 1 beyond the report above and the coordinator's brief.
> Every claim below was re-established by execution against **this lane's own `dist/`**, not by
> reading sr-engineer's `pending_notes`. Harnesses lived in the session scratchpad; nothing was
> written under `test/`.

## Summary

- Round 2 touches `tools/drift.ts` (call site, `buildEvidenceBackedLine` wording, `DriftReport`
  typing on the 4 early returns) and rewrites the untracked `tools/evidence-lookup.ts`. Nothing
  else: `gates/`, `test/`, `content/`, `schema/`, `scripts/`, `tools/handoff-write.ts` and
  `docs/backlog.md` are untouched.
- **C1 is closed.** The FAIL-record back door no longer exists: a server-written `FAIL` round, a
  later `FAIL` after an earlier `PASS`, a CRLF `FAIL`, and a `covers:` report whose own last
  verdict is `FAIL` all keep the id in the vibe-drift bucket with `driftDetected: true`.
- The two-branch rule landed exactly as directed, applied identically on the direct-file and
  `covers:` paths, and `VERDICT_HEADING_RE` matches `recordReviewInFile`'s write shape exactly.
- A1, Q1/P1 and Q2 all verified by execution and by a negative compile test. Round-1's A/B
  regression claims re-verified where round 2 moved code: 16-case matrix, base (`1b5a48c`) vs
  round 2, byte-identical on every field except the intended clean-headline rewording.
- Verdict: **APPROVED.** Three non-blocking findings (C5, Q4, A3), two filed as
  `E112-NEW-2` / `E112-NEW-3`. Full suite green: **2135/2135**.

## Correctness

### C1 — RESOLVED (was BLOCKING)

Reproduced round 1's exploit end-to-end against the round-2 build, plus the edges the brief named.
Fixture: `.current/handoff.md` with empty `completed_tasks`, `tasks.md` with `- [x] T-1` and
`- [ ] T-2`, driven through `dist/tools/drift.js` and `dist/gates/qa-review.js`'s real
`recordReviewInFile`.

| # | scenario | `evidenceBackedIds` | `driftDetected` | correct? |
|---|---|---|---|---|
| A | no evidence at all | `[]` | `true` | yes (control) |
| B | **`recordReviewInFile(FAIL)` only** — round 1's exploit | `[]` | `true` | **yes — hole closed** |
| C | `FAIL` then later `PASS` | `["T-1"]` | `false` | yes |
| D | `PASS` then later `FAIL` (last-wins) | `[]` | `true` | yes |
| E | zero-byte `review_T-1.md` | `["T-1"]` | `false` | yes — declared trade-off |
| F | CRLF `FAIL`-only | `[]` | `true` | yes |
| I | `covers:` report, last verdict `FAIL` | `[]` | `true` | yes |
| J | `covers:` report, last verdict `PASS` | `["T-9"]` | `false` | yes |
| K | `covers:` report, no verdict section | `["T-9"]` | `false` | yes — branch 2 |
| L | archived `qa_reports/archive/featX/review_T-1.md` `PASS` | `["T-1"]` | `false` | yes |

**Does `VERDICT_HEADING_RE` match the server's write shape exactly?** Yes. `recordReviewInFile`
(`gates/qa-review.ts:58`) writes `` `## ${ts} — ${status} — by ${reviewer}` ``, and every
component is pinned:

- `ts` is `new Date().toISOString()` — contains no whitespace, so `\S+` always matches.
- the separator is a literal U+2014 em-dash with single surrounding spaces; `\s+—\s+` matches.
- `status` is the literal `"PASS"` / `"FAIL"` union — case matches.
- `reviewer` is **hardcoded** `"qa-engineer"` at the sole call site
  (`tools/handoff-orchestrator.ts:805`, via `tools/storage.ts:206`), so `by\s+.+$` can never be
  starved by an empty reviewer. This was the one shape that would have silently reopened C1 — it
  is unreachable.

`gates/code-review.ts:44` writes an identical heading shape, but into `review_reports/`, which
this module never scans; no interaction.

**Shapes the regex does NOT match** (checked: hyphen separator, en-dash separator, lowercase
`fail`, `###` instead of `##`, a space-bearing timestamp, leading whitespace before `##`). All of
them fall through to branch 2 and qualify as evidence. None is producible by a server write — they
are only reachable by hand-authoring, i.e. the trust class the rule deliberately admits. So the
non-matching set does **not** reopen the back door.

### [non-blocking] C5 — `lastVerdict` does not strip fenced code blocks, in both directions

`tools/evidence-lookup.ts:106-119` scans the raw file text. A ``` fence is not excluded, so a
verdict-shaped line *quoted inside* a code block is scored as a recorded verdict.

Reproduced — the **under-count** direction, which is the failure the standing bar
(`不要弱化偵測器去換取安靜`, both halves) warns about on this side:

```
## 2026-01-01T00:00:00.000Z — PASS — by qa-engineer

Prior round said:

```
## 2025-12-01T00:00:00.000Z — FAIL — by qa-engineer
```

done
```

→ `evidenceBackedIds: []`, `driftDetected: true`. A genuinely PASSed, evidenced task is newly
reported as vibe-coding drift — exactly the case-(b) false alarm E112 exists to remove. The mirror
direction also exists: because `recordReviewInFile` appends `notes.trim()` verbatim and `notes` is
the free-text `qa_review` field, a `PASS`-shaped heading pasted into a **FAIL** round's notes would
launder the id.

**Measured incidence today: zero.** I scanned this lane's real corpus (`qa_reports/`, walked
recursively): **492** `.md` files, **484** carrying ≥1 verdict section, **0** ending on `FAIL`, and
**0** verdict-shaped lines inside fenced blocks. So this changes nothing on real data and is not a
landing blocker — but it is a genuine latent path in both directions and the corpus grows. Filed as
**E112-NEW-2**.

### C6 — the diverted-ids / surviving-bucket interaction re-checked where round 2 moved it

Round 2 restructured the loop (`tools/drift.ts:436-456`) into a filter + a single batch lookup +
a `continue`-style loop. Verified the restructure preserves the three-way split:

- `driftBaselineIds` still runs **first and unchanged** — `baselineIds.has(taskId) continue` is the
  first statement in the loop, and the candidate filter at `:436` also excludes baseline ids, so a
  baselined id is never even submitted for evidence lookup. A/B on a `driftBaselineIds` fixture is
  byte-identical to base.
- `compressDriftDetails` returns a **fresh** `out` array (`tools/drift.ts`), so
  `details.push(buildEvidenceBackedLine(...))` at `:482` cannot mutate `drifts`. This matters
  because `driftDetected: drifts.length > 0` is evaluated *after* that push. Confirmed
  empirically: with one drifted id and one evidence-backed id, `driftDetected` stays `true`,
  `details.length === 2`, and the vibe line still carries the correct single-id tier.

## Quality

### Q2 — RESOLVED, and the typing genuinely proves the invariant

All **5** `return` statements in `detectDrift` are now `return JSON.stringify(report)` over a
`const report: DriftReport`. `DriftReport` (`tools/drift.ts:16-42`) declares all eight fields
**non-optional**, including `fanoutAdvisory: string | null` and `evidenceBackedIds: string[]`.

Proved by negative compile test rather than by inspection — I copied `drift.ts` to a throwaway
sibling, deleted `fanoutAdvisory: null` from the version-skew early return, and ran `npx tsc
--noEmit`:

```
tools/zz-tscheck-drift.ts(305,11): error TS2741: Property 'fanoutAdvisory' is missing in type
'{ driftDetected: true; details: string[]; ... evidenceBackedIds: never[]; }'
but required in type 'DriftReport'.
```

(throwaway file removed; `git status` clean of it). So no return path can omit either new field,
and the invariant is now compiler-enforced rather than convention-enforced. `npx tsc --noEmit` on
the real tree is clean.

### Q1/P1 — RESOLVED (see **Performance** for the measurements)

Signature is now `hasEvidenceAnywhere(workspacePath, taskIds: string[]): Set<string>`
(`tools/evidence-lookup.ts:153`), called from exactly **one** site
(`tools/drift.ts:439`), outside every loop, once per `detectDrift`. Confirmed in the compiled
`dist/tools/drift.js` as well, not just the source.

### [non-blocking] Q4 — the residual trade-off is stated, but understates two reachable cases

The brief asked whether the residual trade-off is "genuinely stated where a reader finds it". It
is — `tools/evidence-lookup.ts:47-55`, module header, immediately under the rule it qualifies,
which is the right place. But it enumerates only (a) a verdict-less hand file and (b) a `covers:`
line naming an id its report never judged. Two reachable cases are stronger than that wording
suggests, both reproduced:

- **P1** — a hand-authored `covers:` line **overrides that id's own server-written FAIL**. Seeded
  `recordReviewInFile(["T-1"], "FAIL")` *and* a `review_BATCH.md` containing `covers: T-1` →
  `evidenceBackedIds: ["T-1"]`, `driftDetected: false`. The direct FAIL file is not authoritative
  over an indirect PASS/verdict-less one.
- **P2** — an **archived** `PASS` overrides a current root `FAIL` for the same id → `["T-1"]`.

Both follow correctly from the "a qualifying record exists **anywhere**" precedence the coordinator
specified, and both still require a hand-authored artifact — no pure server write reaches them, so
C1 stays closed. This is a documentation-completeness gap, not a logic defect: the header should
say the check is "any qualifying record in any location wins", not merely "existence is credited
for hand files". Folded into **E112-NEW-2**.

### [non-blocking] Q5 — `buildEvidenceBackedLine` wording: accurate, two small gaps

The new wording (`tools/drift.ts:84-96`) is correctly limited to what the check establishes —
"whose most recently recorded verdict is PASS, or which records no verdict at all (a hand-authored
covering report) — that is what this check establishes, not an independent re-verification that the
work is correct." That is exactly right and the flat "this is NOT vibe-coding drift" over-claim is
gone. Two nits, neither worth a round:

1. The parenthetical names only `qa_reports/` and `qa_reports/archive/<feature>/`. An id resolved
   via a `covers:` line has **no** file at either named path, so a reader who follows the pointer
   finds nothing.
2. The closing sentence says "Verify via the cited `qa_reports` evidence instead", but nothing is
   actually cited — the line carries ids, never filenames. `hasEvidenceAnywhere` returns a
   `Set<string>`, so the resolving path is discarded and cannot be cited without a signature change.

## Architecture

### A1 — RESOLVED, with a stated residual

`safeIsDirectory` now uses `fs.lstatSync` (`tools/evidence-lookup.ts:83-89`). Verified by
execution: seeded `qa_reports/archive/link` as a symlink to a directory **outside** the workspace
containing a valid `PASS` `review_T-1.md` → `evidenceBackedIds: []`, T-1 still reported as
vibe-coding drift. The directed fix landed. Real-tree cost of the change is nil: of 59 entries
under `qa_reports/archive/`, **0** are symlinks, so no legitimate archive dir is newly excluded.

### [non-blocking] A3 — the confinement is partial; two link-following paths remain

The brief asked whether anything else in the archive walk still follows links. Two do, both
reproduced:

- a symlinked **file** named `review_<id>.md` *inside a real* archive subdir is followed —
  `fileQualifiesAsEvidence` uses `fs.readFileSync` (`tools/evidence-lookup.ts:132`), which resolves
  links. Seeded → `evidenceBackedIds: ["T-1"]` from a file outside the workspace.
- `qa_reports/` **itself** being a symlink is followed — nothing `lstat`s the root. Seeded →
  `["T-1"]`.
- additionally `buildCoverageIndex` (`tools/evidence-file.ts`, correctly untouched — out of scope
  and shared with the live `MISSING_EVIDENCE` gate) uses `readdirSync`/`readFileSync` throughout,
  so the `covers:` path follows links in both locations.

So only symlinked *directories directly under* `qa_reports/archive/` are excluded. The threat model
is weak — anyone able to plant a symlink in the workspace can plant a `PASS` file directly — so this
is informational, not a security block, and closing it properly means touching shared plumbing this
feature must not touch. Filed as **E112-NEW-3**.

### Boundaries — clean

`git diff --stat 1b5a48c` plus untracked: `tools/drift.ts`, new `tools/evidence-lookup.ts`,
`dist/tools/{drift,evidence-lookup}.*`, and the three bookkeeping files
(`.current/handoff.md`, `tasks.md`, `NEW-TICKETS.md`) plus this report. Confirmed **absent** from
the change set: `gates/qa-review.ts` (and `hasEvidenceInFile` — read-only reuse of
`buildCoverageIndex` only), `tools/evidence-file.ts`, `test/`, `content/`, `schema/`,
`tools/handoff-write.ts`, `scripts/verify-release.mjs`, `docs/backlog.md`. No E113/E115/E116/E132/E150
surface touched.

**E112-NEW-1 correctly not folded**: `computeFanoutAdvisory` (`tools/drift.ts:132`) still triggers
on `incompleteTasks.length > 0` alone, and `incompleteTasks.join(", ")` is still an uncompressed
enumeration. That is the approved cut shape; its absence from this diff is not a defect.

## Security

No new findings. The taint surface is unchanged from round 1: `sanitizeTaskId`
(`tools/evidence-lookup.ts:65-67`) is byte-identical to `gates/qa-review.ts:27`'s precedent and is
applied before any path is built; every `fs` call is wrapped and returns a falsy default rather than
throwing; no secrets, no injection vector, no network, no shelling out to git (`isLinkedWorktree`
uses `fs.statSync` on `.git`, per the server charter). `lastVerdict` is a bounded regex scan with no
catastrophic-backtracking shape (`\S+`, `\s+`, `.+` against a line-anchored alternation).

The one quasi-security observation is C5's mirror direction — free-text `qa_review` notes are
appended verbatim and can contain a verdict-shaped line. That is content injection into a record
the detector reads, but the writer is an already-trusted `qa-engineer`-stamped server write, so it
is a robustness issue, not a privilege boundary. Tracked in E112-NEW-2.

## Performance

### Q1/P1 — re-measured independently on this tree, claim confirmed

Measured on this lane's real corpus (59 archive subdirs, 492 `.md` files) with
`process.hrtime.bigint()`, against a per-id oracle I wrote to round 1's shape (no memoisation, same
content test):

| n ids | round-2 batch | per-id oracle (round-1 shape) |
|---|---|---|
| 1 | 10.8 ms | 10.7 ms |
| 5 | 12.1 ms | 55.5 ms |
| 10 | 14.3 ms | 108.0 ms |
| 20 | 16.1 ms | 223.0 ms |
| 50 | 21.8 ms | — |

sr-engineer's claim (~13 ms@1 → ~18 ms@20, "essentially flat") is accurate within measurement
noise, and the shape claim is exactly right: **near-flat vs ~11 ms/id linear**. The flatness is
*structural*, not cache-dependent — `archivedFeatureDirs()` runs once (`:158`) and each directory's
`buildCoverageIndex` runs at most once per call (`:188`), regardless of `n`. I could not purge the
OS page cache without elevation, so these are warm-cache numbers; a cold cache scales the one-time
492-file read (the constant) and leaves the slope at zero, which is the property under test.

### Batching did not change which ids qualify

Compared `hasEvidenceAnywhere(ws, ids)` against the per-id oracle over **530** ids on the real tree
(every root `review_*.md` id, every archived id, 40 non-existent ids, plus the specific ids named in
the drift advisory): **490 qualified under both, zero divergence in either direction**
(`onlyBatch: []`, `onlyPerId: []`). Also order-independent — a shuffled input yields an identical
set.

### [non-blocking] P3 — a new fixed I/O cost on `detectDrift`, and an eager index build

Two observations for the record, neither a regression against the ticket's bar:

- At base, `detectDrift` did **zero** `qa_reports/` I/O. It now pays a full 492-file read
  (~10–22 ms here) whenever at least one candidate id misses the direct check — i.e. in the common
  *true-drift* case. Once per session at pre-flight, so negligible in absolute terms, but it is a
  genuinely new constant that scales with corpus size, not with drift size. A workspace with a clean
  ledger pays nothing (`hasEvidenceAnywhere` returns on `taskIds.length === 0` at `:155`, and the
  direct-hit fast path returns before any index build at `:180`) — confirmed by the A/B matrix,
  where the "all synced" case is byte-identical to base.
- `coverageIndexes` at `:188` is built **eagerly for all 59 directories** even when the first one
  resolves every remaining id. The cited precedent (`gates/qa-review.ts:71-78`) is lazy — it builds
  its single index only on the first direct-file miss. Making the per-directory build lazy would be a
  small further win; not required this round.

## Round-1 regression surface — re-verified where round 2 moved code

Round 2 touched the call site, the four early-return paths and `buildEvidenceBackedLine`, so I
re-ran round 1's A/B rather than accepting it on those paths. Method: extracted the base compiled
`dist/tools/drift.js` at `1b5a48c` via `git show` into a scratch `dist` tree, and ran both
`detectDrift` implementations over a 16-case matrix, comparing full JSON with the two new fields
stripped.

Byte-identical on **every field** in all 16 cases — version skew, fresh project, tasks-without-handoff,
handoff-without-tasks, all-synced, vibe drift at 1 / 3 / 12 ids (all three compression tiers),
handoff-ahead at 1 and 9, `FAIL` status, `Blocked` status, archived `## Completed` filter, and
`driftBaselineIds` — **except** `details[0]`, which differs in exactly the 5 cases where
`incompleteTasks.length > 0 && drifts.length === 0`. That is precisely the intended case-(a)
clean-headline rewording and nothing else. `driftDetected` never diverges in any case. The two new
fields are present on all 16, including all four early returns.

Round 1's verdict is accepted unchanged everywhere round 2 did not move code.

**Full suite: 2135 / 2135 pass, 0 fail** (`node --test test/*.test.mjs`).

## Verdict

**APPROVED** — C1 is genuinely closed at its edges: the server-written `FAIL` back door is gone,
last-wins is correct in both orders, CRLF and the `covers:` path behave identically, and
`VERDICT_HEADING_RE` provably matches `recordReviewInFile`'s exact write shape (reviewer is
hardcoded, so the one starving variant is unreachable). The two-branch rule, A1's `lstatSync`
confinement, Q1/P1's batching (490 = 490 ids, zero divergence; near-flat vs linear) and Q2's
compiler-enforced typing all landed as directed, the round-1 regression surface is byte-identical
where round 2 moved code, and the detector did not overshoot into false alarms on real data
(0 / 492 corpus files affected). C5, Q4, Q5, A3 and P3 are non-blocking; C5 + Q4 are filed as
**E112-NEW-2** and A3 as **E112-NEW-3**.
