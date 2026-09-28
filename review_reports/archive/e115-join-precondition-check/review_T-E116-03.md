# Review — T-E116-03

covers: T-E116-01

*Reviewed: `git diff 1b5a48c -- tools/handoff-write.ts` against
`specs/e116-archive-on-feature-change.md` (AC1–AC7 + "Reconciliation with
E114's v14 block" + "E150 two-door coverage").*
*Reviewer model: opus. Implementer model: fable (per `dispatch_pins`) —
different model, so no same-model blind-spot concern to flag.*
*Note: this review was resumed after a prior code-reviewer context was killed
mid-review by a session usage limit. All conclusions below were re-derived in
this context; nothing was inherited on trust.*

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- One production file changed: `tools/handoff-write.ts`, +53/−2 (the single
  removed line is the reflowed `bookkeepingWrite === true` trigger clause).
  `dist/` is regenerated tsc output (verified faithful to source, not
  hand-edited). No `content/`, `schema/`, `test/`, `storage-sqlite.ts` or
  `handoff-types.ts` touched.
- **AC1, AC2, AC3, AC4, AC6, AC7 verified PASS** empirically against the built
  writer, not by reading the code alone. The archive is a verbatim byte copy,
  fires only on a real `active_feature` change, and is strictly additive —
  the reset-on-feature-change design is fully intact.
- **AC5 passes for the charset half and FAILS for the length half.** All nine
  traversal/degenerate inputs (`..`, `../../etc/passwd`, `.`, `///`, backslash,
  spaces, URL-encoded, `../`, `-rf`) stay under `.current/archive/` — confirmed
  with `path.resolve` containment. But `active_feature` is unbounded relative
  to `NAME_MAX`, and that is the one blocking finding.
- Failure semantics are **fail-closed and correct**: a copy failure aborts the
  whole write, leaves the live ledger untouched, leaks no lock and no tmp file.
  This is the right call and is the single most important thing the diff got
  right.
- E114's v14 `cut_approved_source` block is **byte-unchanged** — verified from
  the diff, not from the claim.
- Verdict: **CHANGES_REQUESTED** on one finding (C1). Everything else is clean;
  the fix round is deliberately narrow.

## Correctness

### C1 (BLOCKING) — unbounded `active_feature` length permanently wedges feature transitions (`tools/handoff-write.ts:466`–`:472`)

The archive filename is built as:

```ts
const archivePath = path.join(
  archiveDir,
  `${sanitizedOutgoingFeature}.${process.pid}.${Date.now()}.md`,
);
```

`sanitizedOutgoingFeature` is sanitized for *charset* but never for *length*.
The boundary schema permits far more than the filesystem does:

- `tools/registry.ts:187` — `active_feature: z.string().min(1).max(500)`
- `getconf NAME_MAX /` on this platform — **255**

Measured threshold (binary-searched against the built writer, 5-digit pid):

| sanitized feature length | outcome |
|---|---|
| 232 | archives fine |
| **233** | **`ENAMETOOLONG` — write throws** |

Budget is `255 − len(".<pid>.<epoch>.md")` = `255 − 23` = **232** for a 5-digit
pid. Consequence, confirmed empirically:

1. A first write with a 233–500 char `active_feature` **succeeds** (no archive
   on a first/unchanged write) and lands that value on disk.
2. Every subsequent write that changes `active_feature` **throws
   `ENAMETOOLONG`** and is rejected. Re-running it fails identically.
3. Same-feature writes keep working, so the workspace is not dead — it is
   *stuck on that feature forever*.

The only escape is hand-editing `.current/handoff.md`, i.e. exactly the
out-of-band mutation this server's governance model exists to prevent. There is
no recovery path through any `tw_*` tool.

Three reasons this blocks rather than being a note:

- **It is a regression.** Before this diff, a 500-char `active_feature` was
  accepted end-to-end and a feature change out of it worked. The diff turns a
  previously-working, boundary-sanctioned input into a hard, unrecoverable
  failure.
- **It is non-deterministic.** The budget depends on `String(process.pid).length`.
  A 231-char feature archives fine under a 5-digit pid and throws under a
  7-digit pid (Linux `pid_max` default). The same workspace can behave
  differently across processes — a heisenbug in a durability mechanism.
- **It is squarely inside AC5's own stated intent** ("defends against a
  pathological `active_feature` value"). The charset half of that defense was
  implemented at this exact expression; the length half was not.

Suggested shape (for sr-engineer — not applied here, §3.2): clamp the sanitized
name to a fixed safe budget before interpolation, e.g. `.slice(0, 200)`, which
leaves comfortable headroom for a 7-digit pid and a 13-digit epoch. Truncation
is lossless for the archive's purpose — the full outgoing `active_feature`
still lives inside the copied file's frontmatter, so nothing is actually lost
by shortening only the filename. Please also make the clamp explicit in the
comment so the NAME_MAX reasoning is not re-derived later.

### Verified correct — failure semantics (the highest-value question)

`fs.copyFileSync` is deliberately **not** wrapped in a try/catch, so a copy
failure propagates out of the `withFileLock` callback and aborts the entire
`tw_update_state`. I consider this the **right** call, and I want the record to
be explicit about why, because the opposite choice is superficially attractive:

- Swallowing the error would let the write proceed and overwrite the ledger
  *silently* — which is precisely the silent-loss failure mode E116 exists to
  eliminate. A best-effort archive that quietly does nothing is worse than no
  archive, because it manufactures false confidence in a durability guarantee.
- Fail-closed is safe here because the abort happens **before** any mutation:
  the tmp-write + rename publish is at `:626`–`:627`, well after the archive
  block at `:453`–`:476`.

Confirmed empirically by making `.current/archive` a regular file (forcing
`ENOTDIR` out of `copyFileSync`):

- the write throws — `ENOTDIR` propagates, nothing is silently skipped;
- `.current/handoff.md` is **byte-identical** before and after the failed write;
- **the lock is released** — `guards/file-lock.ts` wraps the callback in
  `try { return await fn(); } finally { close(fd); unlink(lockPath) }`, so a
  throw from inside the critical section cannot strand `.handoff.lock`. No
  deadlock, no stale-lock recovery needed;
- no tmp file is left in `.current/`;
- `refreshSnapshotFor` (`:629`) is correctly *not* reached, and since the file
  is unchanged the session freshness snapshot stays consistent — a subsequent
  write does not spuriously trip `verifyFreshness`;
- same-feature writes continue to succeed while the obstruction exists.

So the ordering is right and the abort is clean. The problem in C1 is not the
fail-closed choice — it is that C1 supplies an input that makes the clean abort
fire forever with no sanctioned way out.

### Verified correct — Site 1 is genuinely unconditional (`:384`, `:401`)

`const archiveCheckNeedsExisting = true;` is OR'd in as the last disjunct of
the existing-read trigger (`:389`–`:402`). Tested on the exact path that
motivated it — a write supplying all six feature-scoped fields explicitly
(`cutApproved`, `externalRefs`, `dispatchPins`, `dispatchMode`,
`evidenceSchema`, `cutApprovedSource`) plus `prdPath`/`scopeDecision`/
`scopeDecisionWhy`, and **not** a `bookkeepingWrite` — the one combination that
previously skipped the read entirely. The archive fires. Site 1 does what it
claims.

Making the read unconditional is harmless, and I checked the one way it could
not have been: `parseHandoff` could in principle re-enter the writer, because
`tools/handoff-parse.ts` does call `writeHandoffState` for its schema-migration
heal — and that call would try to acquire the *same* lock we are already
holding, which `withFileLock` would spin on for `LOCK_MAX_WAIT_MS` (10s) and
then throw, since our own pid is alive and the lock is fresh. It is safe:
`tools/handoff-parse.ts:364`–`:370` documents and implements `parseHandoff` as
migrate-in-memory, explicitly "does NOT write back" — the heal-write lives in
`readHandoffState`, which this path never calls. No caller depended on the read
being skipped; no re-entrancy hazard is introduced or widened.

### Verified correct — AC1/AC3/AC4

- **AC1**: on a feature change, exactly one file appears under
  `.current/archive/`, named `e116-old.<pid>.<epoch>.md`, and its bytes are
  **identical** to the pre-overwrite `.current/handoff.md` (compared as a whole
  buffer, not field-by-field). The archived frontmatter retains `hop_count: 7`,
  `qa_round: 2`, `completed_tasks` and `cut_approved: true`.
- **AC3**: three consecutive same-feature writes create no `.current/archive/`
  directory at all. Guarded by `existing.active_feature !== _activeFeature`.
- **AC4**: a first-ever write on a workspace with no `.current/handoff.md`
  creates no archive and succeeds normally. Guarded twice over — `existing !==
  null` and `fs.existsSync(handoffPath)`.
- Edge case beyond the ACs: an **empty-string** on-disk `active_feature`
  correctly produces no archive, caught by the `!!existing.active_feature`
  conjunct. Without it the filename would have been a dotfile
  `.<pid>.<epoch>.md`. Good defensive instinct.

### Verified correct — AC2, the reset is NOT weakened

This is the ticket's central tension, so I checked it against behaviour rather
than against the diff's shape. After a feature change the live
`.current/handoff.md` shows: `hop_count` 7→**0**, `qa_round` 2→**0**,
`review_round` 3→**0**, `visual_round` 1→**0**, `cut_approved`
true→**undefined**, `evidence_schema` 2→**undefined**, `completed_tasks`
→**[]**. Identical to base behaviour.

Structurally the archive is purely additive and correctly ordered: it sits at
`:453`–`:476`, the round/`hop_count` emits are at `:563`–`:603`, and the
publish is at `:626`–`:627`. The archive **strictly precedes** both, so it
captures the pre-reset ledger. It never reads or writes `frontmatterData`. No
line of the six-field preserve/reset logic is modified — the only edit inside
that region is the added disjunct on the trigger `if`.

## Quality

No blocking findings. Three minor observations, none of which need action this
round:

- `:459`–`:461` — the `if (!fs.existsSync(archiveDir))` guard around
  `fs.mkdirSync(archiveDir, { recursive: true })` is redundant: `recursive: true`
  is already idempotent on an existing directory. Worse, the guard is what turns
  the "`.current/archive` is occupied by a regular file" case into a confusing
  `ENOTDIR` from `copyFileSync` instead of a clear `EEXIST` from `mkdirSync` at
  the actual point of trouble. Dropping the guard would improve the error
  message for free. Cosmetic — the failure is still safe either way.
- `:466` — `existing!.active_feature` needs the non-null assertion because TS
  cannot narrow through the intermediate `featureChanged` const. Legitimate use,
  not a smell; noting only so a future reader does not "clean it up" into a
  compile error.
- Comment density on the new block is high, but it matches the established
  convention in this file exactly (every one of the six fields carries the same
  numbered-concern commentary), and the v15 comment correctly explains *why* the
  flag is unconditional rather than restating *what* it does. This is convention
  adherence, not bloat.

## Architecture

No architecture spec exists for this feature (`specs/e116-*-architecture.md`
absent), so the spec's own "Reconciliation with E114's v14 block" section is the
binding design constraint. The implementation matches it.

**E114 v14 block byte-unchanged — verified from the diff, not the claim.** The
whole diff contains 53 added lines and exactly **2** removed lines, and the only
removed line is:

```
-      bookkeepingWrite === true
```

which is the trigger clause being reflowed to append `||`. Grepping every `+`/`-`
line for `cut_approved_source` / `cutApprovedSource` / `parseCutApprovedSource`
yields exactly one hit, and it is inside a **new comment**. E114's option doc,
its `parseCutApprovedSource` sanitize, and its carry-forward clause are all
context lines with zero functional change. The reconciliation deliverable is
satisfied.

The placement claim also holds: the archive sits *alongside* the six-field
preserve pattern rather than inside it, never touches `frontmatterData`, and
reuses the existing `withFileLock` critical section and the existing
`verifyFreshness` call (`:243`/`:245`) rather than adding a second lock or a
second freshness check. That is the correct layering — a second lock would have
been a deadlock, and a second freshness check would have been a TOCTOU window.

The spec's "E150 two-door coverage" section is a design-judgment deliverable
rather than a code deliverable, and the code is consistent with it: the trigger
really is feature-change-only, so door 1 is structurally unreachable here (which
AC3 pins as a *requirement*, correctly), and nothing in the diff attempts
door 2. No scope creep into E150.

## Security

No findings. Reviewed as the second pair of eyes on the untrusted-input
boundary, since `active_feature` is agent-supplied free text that reaches a
filesystem path.

**Path traversal is structurally defused — I tested the argument rather than
accepting it.** sr-engineer's reasoning was that `.` being in the allow-list
lets a doubled `..` survive sanitization, but that this is safe because `/` is
always replaced. That reasoning is correct, and the suffixing makes it correct
for a second, independent reason. Results — on-disk `active_feature` forced to
each value, then a feature change, then `path.resolve` containment asserted
against `.current/archive/` plus a check that no stray file appeared outside it:

| input `active_feature` | resulting filename | contained |
|---|---|---|
| `..` | `...<pid>.<epoch>.md` | yes |
| `../../etc/passwd` | `..-..-etc-passwd.<pid>.<epoch>.md` | yes |
| `.` | `..<pid>.<epoch>.md` | yes |
| `///` | `---.<pid>.<epoch>.md` | yes |
| `..\..\windows` | `..-..-windows.<pid>.<epoch>.md` | yes |
| `   ` (spaces) | `---.<pid>.<epoch>.md` | yes |
| `%2e%2e%2f` | `-2e-2e-2f.<pid>.<epoch>.md` | yes |
| `../` | `..-.<pid>.<epoch>.md` | yes |
| `-rf` | `-rf.<pid>.<epoch>.md` | yes |
| `` (empty) | *no archive written* | n/a |

Two independent defenses, either of which suffices:

1. Every path separator (`/` and `\`) is outside `[A-Za-z0-9._-]` and collapses
   to `-`, so the sanitized value can never contain a separator and
   `path.join(archiveDir, name)` cannot escape `archiveDir`.
2. The `.<pid>.<epoch>.md` suffix is **always** appended, so the degenerate
   whole-name cases can never *be* `.` or `..` — they become `..<pid>…` and
   `...<pid>…`, which are ordinary filenames, not directory references. This is
   what structurally defuses the case sanitization alone would leave open.

No `path.resolve` escape in any case. No injection vector (no shell, no
interpolation into a command). No secrets. The archive file inherits the same
permissions and the same git-tracked posture as `handoff.md` itself, which the
spec calls out as deliberate.

One boundary *is* unvalidated, and it is C1 above — length, not charset. I have
filed it under Correctness rather than Security because the impact is
availability (a wedged workspace), not confidentiality or traversal.

## Performance

No findings. No regression versus base.

- The archive adds, **only on an actual feature change**, one `existsSync`, one
  conditional `mkdirSync`, and one `copyFileSync` of a file that is a few KB.
  Feature changes are rare by construction (once per ticket), and this happens
  inside a lock that is already performing a write.
- Site 1's widened read is the only change on the hot path. It makes
  `parseHandoff` run on *every* write instead of *almost* every write — the
  previously-skipped case required all six feature-scoped fields set explicitly
  **and** `prdPath`, `scopeDecision`, `scopeDecisionWhy` all present **and** not
  a bookkeeping write, which is rare in practice. The marginal cost is one file
  read plus one YAML parse, inside a lock that already reads and writes. No
  complexity-class change.
- `.current/archive/` grows monotonically with no rotation. The spec explicitly
  places pruning/retention out of scope, so this is not a finding — but it is
  worth a future ticket before the directory is consumed by E113's roll-up.
- Full suite run on the branch: **2135/2135 pass**, matching sr-engineer's
  claim. No test regression.

## Verdict

**CHANGES_REQUESTED** — the archive mechanism is otherwise correct, well-placed,
and fail-closed in the right direction, but C1 lets a boundary-legal
`active_feature` (233–500 chars, `z.string().min(1).max(500)` vs `NAME_MAX` 255)
permanently block every feature-change write in a workspace with no recovery
path through any `tw_*` tool.

### Scope of the fix round (please keep it to this)
1. **C1 only** — clamp the sanitized filename component to a fixed safe budget
   before interpolation, and say why in the comment.
2. Optionally the redundant `existsSync` guard at `:459` (Quality), which
   improves the error message on the obstructed-directory path. Not required.

Nothing else in the diff needs to change. Do **not** alter the fail-closed
semantics, the archive's position ahead of the reset, Site 1's unconditional
flag, or anything in E114's v14 block — all four were checked and are correct as
shipped.

### Note for whoever writes T-E116-04 (qa-owned, `test/e116-archive-on-feature-change.test.mjs`)
sr-engineer's AC1–AC5 smoke checks were scratch scripts outside `test/`; they are
not tests and are not coverage. The real test file still does not exist. When it
is written, please add a case pinning the C1 fix — a `>232`-char `active_feature`
must archive (truncated) rather than throw — otherwise the current behaviour
gets baked in as the baseline.

### Non-finding, noted at the coordinator's request
`NEW-TICKETS.md` **L-STATE-NEW-1** describes a `CUT_APPROVAL_REQUIRED` rejection
whose root cause was a malformed `tw_update_state` argument from the
coordinator, not a server defect and not an sr-engineer defect. It is **not** a
review finding and I have not treated it as one. Worth noting that the entry is
not wrong as written — its own "Shape, unevaluated" paragraph already
hypothesises exactly the right cause ("worth checking whether that write was
hand-constructed JSON/XML-ish text rather than a proper structured tool call").
My recommendation is to **amend rather than drop** it: append a resolution note
confirming the cause and that the handoff now carries a genuine
`cut_approved: true`. The entry has residual value as a record that a malformed
write can strand a lane at a gate with a confusing symptom.

---

## Round 2 — APPROVED — by code-reviewer

*Scope: NARROW. Verifies only the C1 fix (length-bounding the archive
filename stem). AC1–AC7, the E114 v14 byte-identity, fail-closed copy
semantics and AC5 charset containment were cleared in Round 1; each was
re-confirmed as still true below, but not re-litigated.*
*Reviewer model: opus. Implementer model: fable (per `dispatch_pins`) —
different model, no same-model blind-spot concern.*
*Everything below was re-derived empirically in this context against the
freshly built `dist/`; no claim from `pending_notes` was accepted on trust.*

## Summary
- The C1 fix is **one added code line** — `.slice(0, 200)` appended to the
  existing charset `.replace()` at `tools/handoff-write.ts:481`–`:483` — plus
  ~12 lines of arithmetic comment. Nothing else in the diff moved.
- **The arithmetic is correct, and the real bound is stronger than claimed.**
  Worst-case archive filename measured at **223 bytes** against `NAME_MAX`
  255 (32 bytes of headroom). Round 1's exact wedge threshold (233 chars)
  now passes; so do 255, 500, and 10 000-char inputs.
- **AC1's verbatim-copy guarantee is intact.** Proven by byte-comparing the
  archive against the pre-overwrite live file, and by confirming a 492-char
  `active_feature` survives in full inside the archived frontmatter while the
  filename correctly drops the tail.
- **Collision risk from truncation: real in theory, not introduced by this
  fix, and not reachable through the write path.** Details in Correctness.
  Recorded as non-blocking `L-STATE-NEW-2`, not as a round-3 block.
- All four do-not-touch items verified untouched. Build clean; `npm test`
  **2135/2135**, matching Round 1's baseline exactly.
- Verdict: **APPROVED**.

## Correctness

### C1 — RESOLVED (`tools/handoff-write.ts:481`–`:483`)

The fix:

```ts
const sanitizedOutgoingFeature = existing!.active_feature
  .replace(/[^A-Za-z0-9._-]/g, "-")
  .slice(0, 200);
```

**Arithmetic re-derived independently.** Filename =
`stem(≤200) + "." + pid + "." + epochMs + ".md"`.
Suffix worst case = 1 + 7 + 1 + 13 + 3 = **25 bytes**, where 7 digits is the
correct generous pid bound (Linux `pid_max` ceiling is 2²² = 4 194 304; this
platform's `pid_max` is 5 digits) and 13 digits holds `Date.now()` until
year 2286. 255 − 25 = 230 available; the clamp to 200 leaves 30 bytes of
deliberate headroom. **The stated arithmetic checks out in every term.**

**A byte-vs-code-unit trap the comment does not mention, but which the code
gets right by construction.** `NAME_MAX` counts *bytes*; `.slice(200)` counts
*UTF-16 code units*. These would diverge for any non-ASCII input — except
that `.replace()` runs **first** and, with no `u` flag, maps every code unit
outside `[A-Za-z0-9._-]` (including each half of a surrogate pair) to a
single ASCII `-`. The post-replace string is therefore pure ASCII, where code
units and bytes are 1:1, so the 200-unit slice is genuinely a 200-byte
slice. The ordering `replace → slice` is load-bearing for this. It is correct
as written; I flag it only because the comment justifies the clamp purely by
digit arithmetic and would not warn a future editor against reordering.

**Empirically probed, not just reasoned** (driving the built
`writeHandoffState` directly, bypassing the zod boundary):

| input | result |
|---|---|
| 500-char `active_feature`, 3 consecutive feature-change writes | no throw, 2 archives, stems clamped to 200 |
| exactly 233 chars (Round 1's measured wedge threshold) | **passes** |
| exactly 255 chars | passes |
| 10 000 plain chars | passes |
| 10 000 astral emoji (surrogate pairs) | passes |
| 10 000 CJK (3-byte UTF-8) | passes |
| 10 000 `/` chars | passes, stays inside `.current/archive/` |
| **worst observed filename across all of the above** | **223 bytes ≤ 255** |

**No input can exceed `NAME_MAX`.** The clamp is unconditional — it does not
depend on the `z.string().max(500)` boundary the comment cites. That matters:
`writeHandoffState` is reachable from internal callers that never pass through
`tools/registry.ts`'s zod schema, and the fix holds for them too. The comment
undersells its own guarantee.

**AC5 charset containment re-confirmed** post-fix: `path.resolve` containment
holds for every archive produced by the traversal payloads above; none escapes
`.current/archive/`.

### Truncation-induced collision — analysed, NON-BLOCKING

The question is fair and I treated it as the round's main work. Findings:

1. **Truncation does collapse distinct features into one stem.** Verified:
   two `active_feature` values sharing a 200-char prefix but differing after
   it produce byte-identical stems. Confirmed, not assumed.
2. **A collision would be silent and destructive.** `fs.copyFileSync` without
   `COPYFILE_EXCL` overwrites an existing destination with no error —
   demonstrated directly. So a genuine collision *would* be an E116-class
   ledger loss reintroduced by E116's own fix. The concern is correctly framed.
3. **But the hazard is not introduced by truncation — it predates the fix.**
   The disambiguator is `.<pid>.<epochMs>`, so *any* repeat of the same stem
   in the same process within the same millisecond collides. An A→B→A→B
   alternation on **short** names reuses stems just as thoroughly: measured
   2 distinct stems across 200 archives. Round 1 approved that scheme.
   Truncation only widens the equivalence class from "identical name" to
   "identical 200-char prefix" — it does not create the class.
4. **The same-millisecond precondition is not reachable through the write
   path.** Over **400** consecutive archive-producing writes on one process:
   **min inter-archive delta 3 ms, median 6 ms, max 17 ms, zero same-
   millisecond pairs, zero files lost (400 archives for 400 writes).** The
   write path — `withFileLock` acquire, `parseHandoff`, `copyFileSync`, YAML
   serialize, tmp-write, `rename`, unlock — cannot complete in under a
   millisecond here. Cross-process collision is excluded by construction:
   different processes carry different pids, and the file lock serializes
   them regardless.
5. To actually lose an archive you would need: two `active_feature` values
   >200 chars **and** sharing a 200-char prefix, **and** the same pid,
   **and** the same millisecond. The repo's own ticket-id convention
   (`e116-archive-on-feature-change`, 30 chars) is an order of magnitude
   below the truncation point.

**Judgment: not blocking.** Blocking here would hold the ticket on a
pre-existing property of a scheme Round 1 already approved, for an
unreachable-through-the-write-path race, in a pathological-input regime.
The cheap hardening — `fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL)`,
which converts the silent overwrite into an `EEXIST` throw and so matches the
fail-closed posture the rest of this block already has (verified available:
it throws `EEXIST`) — is recorded as **`L-STATE-NEW-2`** in `NEW-TICKETS.md`
for a later lane. It is a one-argument change, but it is a behaviour change to
a line Round 1 explicitly cleared, and widening this round to take it would
cost more than it buys.

### AC1 verbatim-copy — re-verified post-truncation

The claim that truncation is "lossless because the full name survives in the
copied frontmatter" is **true**, and I verified it rather than reasoning about
it. With a 492-char `active_feature` carrying a distinctive tail marker past
byte 200, and a non-trivial ledger:

- the archive is **byte-identical** to the pre-overwrite `.current/handoff.md`
  (compared whole, 940 = 940 bytes);
- the **full 492-char** `active_feature` appears verbatim in the archived
  frontmatter, tail marker included;
- `hop_count: 9`, `qa_round: 2`, `completed_tasks` entries all preserved;
- the **filename** correctly lacks the tail.

So the truncation is filename-only. Nothing recoverable is lost, and the AC1
guarantee Round 1 verified is unaffected by the fix. Confirmed.

### No other correctness findings this round.

## Quality

No blocking findings.

- The comment carries its own arithmetic, which is the right instinct for a
  magic number — a bare `.slice(0, 200)` would have been much worse. Two
  gaps noted above and neither is worth a round: it does not state that
  `replace`-before-`slice` is what makes the code-unit slice byte-safe, and
  it justifies the clamp via the 500-char zod cap when the clamp is in fact
  unconditional and stronger than that.
- Naming (`sanitizedOutgoingFeature`) and the numbered-concern comment
  convention match the surrounding six-field block. No convention drift.

## Architecture

No findings. The fix is confined to the filename-construction expression and
changes no control flow, no layering and no call graph. The spec's
"Reconciliation with E114's v14 block" section still holds exactly as Round 1
found it.

**Did-not-widen verification** — all four do-not-touch items confirmed from
the diff and the file, not from the implementer's summary:

1. **Fail-closed copy** — `fs.copyFileSync(handoffPath, archivePath)` at
   `:487` is still uncaught; there is no `try`/`catch` anywhere in the archive
   block. A copy failure still aborts the whole write.
2. **Archive strictly ahead of the reset** — archive at `:487`; timestamp
   resolution `:505`–`:509`; `hop_count` emit `:595`; tmp-write + `rename`
   publish `:637`–`:638`. Ordering intact, inside the same `withFileLock`,
   after the same `verifyFreshness`.
3. **Site 1 unconditional** — `const archiveCheckNeedsExisting = true;` at
   `:384`, consumed in the trigger `if` at `:402`. Unchanged.
4. **E114 v14 `cut_approved_source`** — all sites (`:142`, `:153`, `:211`,
   `:224`, `:359`–`:373`, `:433`–`:436`, `:549`–`:552`) appear in the diff as
   **context lines only**. Byte-unchanged.

Still absent from the working tree, verified via `git status --porcelain` on
each path: `content/`, `scripts/verify-release.mjs`, `schema/versions.ts`,
`tools/handoff-types.ts`, `test/`, `tools/storage-sqlite.ts` (AC6),
`docs/backlog.md`. `test/e116-archive-on-feature-change.test.mjs` is
correctly still absent — that is T-E116-04, qa-engineer's.

The only source file changed is `tools/handoff-write.ts` (+63/−1). `tasks.md`
adds the three E116 rows as unchecked `- [ ]` (no done-marking).
`NEW-TICKETS.md` carries the L-STATE-NEW-1 amendment. `dist/` is regenerated
tsc output, outside review.

*Bookkeeping note: Round 1 recorded the diff as +53/−2 while its own prose
said "the single removed line". The current diff contains exactly one removed
line, so `−1` is right and Round 1's `−2` was a miscount in the report, not a
change in the code. Flagged for the record only; it affects no conclusion.*

## Security

No findings. The change strictly narrows the attack surface Round 1 flagged:
an unbounded attacker-influenced string reaching a filesystem name is now
hard-capped at 200 bytes regardless of input. Path-traversal containment
(AC5) re-verified against the traversal payloads above. No new input crosses
a trust boundary; no secrets.

## Performance

No findings. `.slice(0, 200)` is O(1)-bounded work on a ≤500-char string,
executed at most once per feature-change write — a path that already performs
a full file copy. No regression vs base; no change in complexity class.

Measured: 400 archive-producing writes completed with a median 6 ms per write,
end to end.

## Verdict

**APPROVED** — C1 is genuinely fixed, the bound is correct at every term and
in fact unconditional (max filename 223 bytes vs `NAME_MAX` 255, across
inputs up to 10 000 chars including multi-byte and surrogate-pair payloads);
AC1's verbatim-copy guarantee is verified unaffected; the fix did not widen,
with all four do-not-touch items confirmed intact; and the truncation
collision question resolves to a pre-existing, write-path-unreachable hazard
recorded as non-blocking `L-STATE-NEW-2` rather than a third round.
Build clean, `npm test` 2135/2135.
