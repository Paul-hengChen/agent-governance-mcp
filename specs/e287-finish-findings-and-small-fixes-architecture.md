# e287-finish-findings-and-small-fixes — architecture

Covers **E287 only**. It decides the spec's Open Questions Q1–Q6 and fixes the function-level shape of AC-E287-1..10. **E324, E325 and E326 need no architecture.** Each is a local change in one file, and the spec's ACs already pin the mechanism: E324 is a normalized path-segment test in `emitZodGateTelemetry`, E325 is a one-shot other-layout re-read local to `tools/drift.ts` that mirrors E312, and E326 is an empty-list poll inside the existing budget loop. sr implements them from the spec. O-E326 (option A vs B) is a human product choice, not an architecture question, and is out of this artifact.

Line numbers refer to the lane base `dac6069`.

## Decisions on the spec's Open Questions

| Q | Decision | Why (short) |
|---|---|---|
| Q1 | **(a) warn only.** finish never numbers content it read from the worktree. Only a pending file read from git's object db (`<rev>:<path>`) is allocated. A file that exists only in the worktree is parsed so it can be *reported*: count, `lane_local_id`s, titles and `target_repo`s. It is also preserved (Q2), and nothing in it is numbered. | E179 AC4: what gets a backlog id is what was reviewed and merged. Option (b) would number un-reviewed working-copy text. Option (c) adds a file format that nothing consumes. Integrator pre-review 1 agreed. |
| Q2 | **Copy, don't refuse.** When an existing harvest step (shipped lane-close harvest, shipped re-run refresh, abandoned E194 harvest) does not already carry the file, finish writes the file's bytes to `.current/history/<YYYY-MM>/<lane>/pending-tickets.md` in the primary checkout. The copy uses the E180 discipline: absent → exclusive create; already present and byte-identical → no-op; already present and different → **refusal at plan time**, before the first mutation. The warning names the destination only after a post-condition check passes: the destination must be a regular file byte-identical to the lane's file. | Refusing would block every finish of a lane whose `.current/<lane>/` is tracked and whose `pending-tickets.md` is ignored, and the operator would still have to copy the file by hand. A spare copy costs nothing, while a lost file costs the findings (same rationale as `evidenceAtRisk`). Integrator pre-review 1 agreed. |
| Q3 | **`target_repo: <non-empty string>`**, free text, trimmed, presence-only semantics (never compared with this repo's identity). If the key is present with a value that is `null` (bare `target_repo:`), empty or whitespace-only, or not a string, the block is malformed. Absent key means a local finding. | AC-E287-5 calls a present-but-empty value malformed, so bare `target_repo:` (YAML `null`) is malformed. This differs from `source`/`body`, where `null` means absent. A lane that wants a local id omits the field. |
| Q4 | **Archive under `## Applied`** in the same commit that archives the local entries (`--shipped`: on `--base`; `--abandoned`: on the lane branch). **Archived `target_repo` blocks are exempt from the provenance check.** In addition, `checkOrphanLanes` counts only *local* live entries (see DR-8). | A live block would be re-listed on every re-run and would flag an abandoned branch forever. With the exemption, `parsePendingTickets(…, {appliedLaneLocalIds})` never reports a block that by design has no backlog row. Integrator pre-review 1 agreed. |
| Q5 | **Refuse (fail-closed) as an unresolvable reference**, using the existing `unresolvedDependencies` path, with a reason that names `target_repo`. The rule lives in `allocateTicketIds` (pure module) so it is unit-testable. | The lane must rewrite a cross-repo dependency as prose. A local id cannot depend on a ticket in another repo's id space. |
| Q6 | **stderr**, with the `agc feature finish — ` prefix, for both the O6 warning and the D4 listing. Progress lines stay on stdout. | Both ask a human to act, the same class as the kept-mailbox line (`removeLaneMailbox`) and the remote-delete hints. |

## Affected Files

- `tools/lane-ticket-allocation.ts`: modify. Adds the `targetRepo` field, its validation, the provenance exemption for archived `target_repo` blocks, and the rule that `allocateTicketIds` never numbers `target_repo` entries, plus the Q5 reason.
- `dist/tools/lane-ticket-allocation.{js,d.ts}` (and `.js.map` if the build emits one): rebuild and commit. `bin/agc-init.mjs` loads the module from `dist/`.
- `bin/agc-init.mjs`: modify. Changes `checkOrphanLanes`, `STR_USAGE_FEATURE`, `planPendingApply`, `planPendingOnShipped`, `commitPendingOnShipped`, `applyPendingOnAbandoned` and `planLaneClose` (re-run branch). Adds the E287 helper block and the `runFeatureFinish` wiring.
- `.current/e287/pending-tickets.md`: create (sr), committed on the lane branch. It holds the AC-E287-10 doc follow-up block (exact content under *Interface Contracts → Lane finding*).
- Tests (qa-owned, T-E287-02): new `test/e287-*.test.mjs`, plus new unit cases in `test/lane-ticket-allocation.test.mjs`. Re-pins are expected to be zero (see *Test impact*).

Placement constraint: two existing source-slice tests read text out of `bin/agc-init.mjs`.

- `test/agc-feature-lifecycle.test.mjs` slices from `async function checkOrphanLanes(cwd) {` to the next `\nasync function ` and asserts that the word **`history`** never appears. The edit to `checkOrphanLanes` (code and comments) must not contain that word. sr must not add any non-`async` function between `checkOrphanLanes` and `loadHygieneScan`.
- `test/e298-finish-remote-delete.test.mjs` slices from `function deleteRemoteLaneBranch(` to `\nasync function runFeatureFinish`. Nothing new goes between those two functions.

Put the new E287 helpers in their own block directly after `commitPendingOnShipped`, before the `--- finish-time lane close writeback (E125b` banner. Function declarations are hoisted, and the module-level consts they read (`TASKS_REL`, `CLOSED_LANES_HEADING`) are initialised before any finish runs.

## Data Structures

### `tools/lane-ticket-allocation.ts`

```ts
export interface PendingTicketEntry {
  laneLocalId: string;
  title: string;
  priority: string;
  dependsOn: string[];
  source?: string;
  /** E287 (D4): trimmed `target_repo` value. Set ONLY when the block carries
   *  the key (same "absent key → absent property" rule as `source`), so every
   *  existing deepEqual over a local entry is unchanged. Presence alone means
   *  "belongs to another repo": never numbered here. */
  targetRepo?: string;
  body: string;
  lane: string;
}
```

`AllocateTicketIdsInput`, `AllocationResult`, `AllocatedTicket`, `UnresolvedDependency` and `ParsePendingTicketsOptions` keep their shapes. Only the documented semantics change (see *Interface Contracts*).

### `bin/agc-init.mjs` (plain-object shapes, JSDoc only)

```js
// planPendingApply's return value gains two fields (all others unchanged):
//   external:       PendingTicketEntry[]  // live target_repo entries with no backlog provenance, file order
//   backlogPresent: boolean               // docs/backlog.md exists at --base

// readUnallocatedFindings → Findings | null
/** @typedef {{
 *   lane: string, pendingRel: string, filename: string,
 *   bytes: Buffer,                 // lane worktree file, captured at plan time
 *   entries: PendingTicketEntry[], // two-argument parse (no provenance check)
 *   errors: string[],              // malformed-block reasons (counted only, not listed)
 *   revLabel: string,              // --shipped: the --base name; --abandoned: the branch name
 * }} Findings */

// target derivation → FindingsTarget
/** @typedef {{
 *   histAbs: string, histRel: string,  // the lane's .current/history/<bucket>/<lane> dir
 *   covered: boolean,                  // an existing harvest step writes the file there this run
 *   carryAbs: string | null,           // shipped first run, tracked lane dir: primary's
 *                                      // <repoRoot>/.current/<lane>/pending-tickets.md, which `git mv` carries
 * }} FindingsTarget */

// planFindingsPreserve → Preserve
/** @typedef {Findings & { dstAbs: string, dstRel: string, verb: "--shipped" | "--abandoned" }} Preserve */

// planLaneClose's alreadyClosed return gains `hist`:
//   { alreadyClosed: true, refresh, hist: { histAbs, histRel } | null }
```

## Interface Contracts

### `tools/lane-ticket-allocation.ts`

**`validateBlock`** (private). After the `body` check and before building the entry, add:

```ts
if (Object.prototype.hasOwnProperty.call(rec, "target_repo") && !isNonEmptyString(rec.target_repo)) {
  return { error: "target_repo must be a non-empty string when present (omit it for a finding that belongs to this repo)" };
}
// …build entry…
if (Object.prototype.hasOwnProperty.call(rec, "target_repo")) entry.targetRepo = (rec.target_repo as string).trim();
```

On the revision path this error falls into the existing `problem(s)` refusal, so nothing is applied (AC-E287-5).

**`parsePendingTickets`**: the signature is unchanged. Live `target_repo` blocks are returned in `entries` like any other, so the duplicate-`lane_local_id` check spans local and external blocks alike. Change the archived branch to:

```ts
if ("entry" in v && v.entry.targetRepo === undefined && !applied.has(v.entry.laneLocalId)) { …existing error… }
```

The archived-provenance error now fires only for local blocks (Q4). Update the TSDoc to say so.

**`allocateTicketIds`**: the signature is unchanged. New semantics:
- Pass 1 numbers only entries with `targetRepo === undefined`. Entries that carry `target_repo` are recorded in `external: Map<laneLocalId, {batch, targetRepo}[]>` and never consume an id, so `maxAllocatedId` is unaffected.
- Pass 2 changes only the `pool.length === 0` branch. If the reference matches an external entry (same batch first, else any batch), report this instead of the "no entry" reason. `<repo>` has whitespace runs collapsed to one space and is trimmed:
  `depends on a target_repo finding (target_repo: <repo>), which gets no id in this repo — rewrite the reference as prose in body`
  Every other reason string is unchanged.
- Update the TSDoc: "`target_repo` entries are never numbered; a lane-local reference to one is unresolved (E287 Q5)."

**`markApplied`, `findAppliedProvenance`, `appendBacklogRows`, `extractMaxBacklogId`, `detectOrphanLanes`**: unchanged. `markApplied` already moves a `target_repo` block because it reuses `parsePendingTickets` per block.

### `bin/agc-init.mjs`: changed functions

**`checkOrphanLanes(cwd)`**: one-line change:
`const has = text !== null && ta.parsePendingTickets(text, lane).entries.some((e) => e.targetRepo === undefined);`
Any comment added there must not contain the word that the e125b grep test forbids (see *Affected Files*). Suggested comment: `// target_repo entries are another repo's (E287 D4): never this repo's orphans.`

**`planPendingApply(args)`**: same parameters. The loop over `parsed.entries` becomes:
1. If `prov.has(laneLocalId)`, add the entry to `skipped`. Provenance wins whatever `targetRepo` says, so re-runs stay idempotent.
2. Otherwise, if `entry.targetRepo !== undefined`, push it to `external`.
3. Otherwise push it to `toAllocate`.

`allocateTicketIds` is called only when `toAllocate.length > 0`, with `batches: [{ lane, entries: [...toAllocate, ...external] }]`. External entries ride along only so that the Q5 reason can name them. The `backlogBlob === null` refusal stays inside that branch, so a file whose only live entries are external never needs a backlog (AC-E287-7). The function still returns `null` only when `parsed.entries.length === 0`. The return object gains `external` and `backlogPresent: backlogBlob !== null`.

**`planPendingOnShipped`**: returns `rels: plan.backlogPresent ? [BACKLOG_REL, pendingRel] : [pendingRel]`. This is byte-identical to base whenever the backlog exists, which every pre-E287 non-null plan required. Without it, `git commit -- docs/backlog.md …` would fail on a pathspec that does not exist in the external-only, no-backlog case.

**`commitPendingOnShipped`**:
- The restore list includes the backlog entry only when `plan.allocated.length > 0`. That is the only case in which the backlog is written, and an absent backlog must never be re-created as an empty file.
- Commit message: if ids are non-empty, the unchanged `chore(backlog): allocate …` message. Else, if `plan.skipped.size > 0`, the unchanged `chore(backlog): mark lane <lane> pending tickets applied`. Else (external entries only), the new `chore(lane): archive lane <lane> target_repo finding(s) (shipped, not allocated here)`.
- After `printAppliedSummary`, call `printTargetRepoListing(lane, plan.external)`.

**`applyPendingOnAbandoned`**: the `onBase` / `assertPrimaryWritable` logic is unchanged (keyed on `toAllocate`). The archived list for the lane-commit message becomes `[...ids, ...plan.skipped.values(), ...plan.external.map((e) => `${e.laneLocalId} (target_repo)`)]`. After the existing `archived pending tickets on <branch>` line and `printAppliedSummary`, call `printTargetRepoListing(lane, plan.external)`.

**`planLaneClose`**: in the `alreadyClosed` branch, compute `hist = closedLanePointerHistory(…)` before the `atRisk` early return and include it in **both** returns: `{ alreadyClosed: true, refresh: null, hist }` and the refresh return (`…, hist`). The existing hist-null refusal (ignored lane state is at risk) is unchanged and still comes first.

**`STR_USAGE_FEATURE`** (Copy `e287.usage`): replace the four lines from `keeps the branch. Either way, the lane's` through `the primary checkout. Also deletes` with:

```
"          keeps the branch. Either way, the lane's committed\n" +
"          .current/<lane>/pending-tickets.md findings (if any) first get\n" +
"          real ids, appended to docs/backlog.md and committed on --base in\n" +
"          the primary checkout. Only the copy committed on --base\n" +
"          (--shipped) or on the branch (--abandoned) is numbered: a\n" +
"          pending-tickets.md that exists only in the worktree is not\n" +
"          numbered — finish warns, lists its findings and keeps a copy\n" +
"          under .current/history/<YYYY-MM>/<lane>/. A finding that carries\n" +
"          target_repo: <repo> belongs to another repo: it gets no id here,\n" +
"          is archived with the others and is listed on stderr for a human\n" +
"          ruling. Also deletes\n" +
```

### `bin/agc-init.mjs`: new helpers (E287 block, after `commitPendingOnShipped`)

```js
// Display form of a free-text field on a one-line message: whitespace runs
// (incl. newlines) → one space, trimmed, then escapeSegmentForDisplay.
function displayField(s) → string

// True when `abs` is a regular file (lstat, no link-following) whose bytes equal `buf`.
function fileHasBytes(abs, buf) → boolean

// O6 detector. Read-only. null when: the worktree file is absent or not a
// regular file (fs.statSync → !isFile, or any stat/read error); OR
// `git cat-file -e <rev>:<pendingRel>` succeeds in repoRoot (the file IS at
// the revision → E179 path owns it); OR the two-argument parse yields zero
// entries and zero errors. Loads lane-ticket-allocation lazily, only once the
// worktree file exists and is absent at rev.
async function readUnallocatedFindings({ lanePaths, repoRoot, lanePath, lane, rev, revLabel }) → Findings | null

// --shipped target. Throws FeatureError (refusal, nothing applied/removed):
//   close.alreadyClosed && close.hist === null  → Copy e287.preserve-nohist-refuse
// First run:  { histAbs: close.histAbs, histRel: close.histRel,
//               covered: close.harvestSrc !== null,
//               carryAbs: close.tracked ? path.join(repoRoot, findings.pendingRel) : null }
// Re-run:     { histAbs: close.hist.histAbs, histRel: close.hist.histRel,
//               covered: close.refresh?.files.some((f) => f.rel === findings.pendingRel) ?? false,
//               carryAbs: null }
function shippedFindingsTarget({ close, findings, repoRoot }) → FindingsTarget

// --abandoned target. `now` is the SAME Date passed to planAbandonCurrentHarvest.
// currentHarvest !== null → { histAbs: currentHarvest.histAbs,
//   histRel: `.current/history/${currentHarvest.bucket}/${ticketId}`, covered: true, carryAbs: null }
// else bucket = lanePaths.resolveHistoryBucket(now), histAbs = lanePaths.resolveHistoryLaneDir(repoRoot, bucket, ticketId);
//   lstat(histAbs) present && !isDirectoryPath(histAbs) → FeatureError with the e194.current-harvest-refuse-line text verbatim;
//   covered: false, carryAbs: null.
function abandonedFindingsTarget({ lanePaths, repoRoot, currentHarvest, ticketId, now }) → FindingsTarget

// Plan-time collision check (read-only). dstAbs = path.join(target.histAbs, findings.filename),
// dstRel = path.posix.join(target.histRel, findings.filename). When !target.covered:
//   carryAbs !== null && lstat(carryAbs) !== null && !fileHasBytes(carryAbs, bytes) → Copy e287.preserve-carry-refuse
//   lstat(dstAbs) !== null && !fileHasBytes(dstAbs, bytes)                         → Copy e287.preserve-differs-refuse
// When covered, no check: the harvest step overwrites/creates dst from the same file.
function planFindingsPreserve({ findings, target, verb }) → Preserve

// Mutation, run AFTER the harvest step that may cover the file and BEFORE removeWorktreeNoForce:
//   mkdirSync(dirname(dstAbs), recursive);
//   lstat(dstAbs) === null → writeFileSync(dstAbs, bytes, { flag: "wx" })
//       (on error: rmSync(dstAbs, {force:true}) unless err.code === "EEXIST"; throw Copy e287.preserve-fail);
//   else !fileHasBytes(dstAbs, bytes) → throw Copy e287.preserve-fail with reason "a different file is already there".
// Only once dst is a byte-identical regular file: process.stderr.write(formatUnallocatedWarning(p)).
function executeFindingsPreserve(p) → void

// Pure composer of Copy e287.unallocated-warning (the ONE composer).
function formatUnallocatedWarning(p) → string

// Copy e287.target-repo-line, one stderr line per entry; no-op on [].
function printTargetRepoListing(lane, external) → void
```

### `runFeatureFinish` wiring

`--shipped`. New steps are marked ★, and the order of everything else is unchanged:

```
pending  = await planPendingOnShipped(…)
close    = planLaneClose(…)
evidenceHarvest = planShippedEvidenceHarvest(…)
★ findings = await readUnallocatedFindings({ lanePaths, repoRoot, lanePath, lane: ticketId, rev: base, revLabel: base })
★ preserve = findings && planFindingsPreserve({ findings, target: shippedFindingsTarget({ close, findings, repoRoot }), verb: "--shipped" })
assertPrimaryWritable(…)              // unchanged condition and rels
commitPendingOnShipped(…)             // if pending !== null
executeLaneClose | executeHarvestRefresh
★ if (preserve) executeFindingsPreserve(preserve)
applyShippedEvidenceHarvest(…)
removeWorktreeNoForce → removeLaneMailbox → branch -d → deleteRemoteLaneBranch
```

`--abandoned`. Hoist `const now = new Date();` and pass it to `planAbandonCurrentHarvest` (it already takes `now`):

```
currentHarvest = planAbandonCurrentHarvest({ …, now })
★ findings = await readUnallocatedFindings({ lanePaths, repoRoot, lanePath, lane: ticketId, rev: `refs/heads/${branch}`, revLabel: branch })
★ preserve = findings && planFindingsPreserve({ findings, target: abandonedFindingsTarget({ lanePaths, repoRoot, currentHarvest, ticketId, now }), verb: "--abandoned" })
plannedMoves = await applyPendingOnAbandoned(…)   // unchanged; returns null at once for an O6 file
applyAbandonEvidence(…)
if (currentHarvest) executeAbandonCurrentHarvest(currentHarvest)
★ if (preserve) executeFindingsPreserve(preserve)
removeWorktreeNoForce → removeLaneMailbox → "kept branch"
```

The O6 path and the E179 path exclude each other. Each one fires only for a file that is respectively absent from, or present at, the revision. When the pending file is absent from both the worktree and the revision, both are `null`, and the output is byte-identical to base (AC-E287-4).

### Copy / Strings (exact; `<…>` = interpolation)

| id | text |
|---|---|
| e287.unallocated-warning | Header: `agc feature finish — warning: lane <lane>: <pendingRel> is not committed on <revLabel>, so its <N> unapplied finding(s) were not allocated ids (only a committed pending-tickets.md is numbered); kept at <dstRel> in the primary checkout (fs copy, not committed) — a human must file them:\n`. Then one line per entry, in file order: `  <laneLocalId> — <title>\n`, or, when the entry carries `target_repo`, `  <laneLocalId> — <title> [target_repo: <repo> — needs a human ruling, not this repo's]\n`. Then, only when `errors.length > 0`: `  (+ <K> malformed pending-ticket block(s), not listed — see <dstRel>)\n`. `<title>` and `<repo>` go through `displayField`. |
| e287.target-repo-line | `agc feature finish — <lane>/<laneLocalId> "<title>" names target_repo <repo>: not allocated here, archived under ## Applied — needs a human ruling (file it in that repo)\n` |
| e287.preserve-carry-refuse | `agc feature finish --shipped: the primary checkout's untracked <pendingRel> differs from the lane's copy (<N> unallocated finding(s)), and the lane close would carry it into <histRel>/ — move it aside first (nothing applied, nothing removed)` |
| e287.preserve-differs-refuse | `agc feature finish <verb>: <dstRel> already exists in the primary checkout and differs from the lane's <pendingRel> (<N> unallocated finding(s)) — move it aside first (nothing applied, nothing removed)` |
| e287.preserve-nohist-refuse | `agc feature finish --shipped: lane <lane> is already recorded under tasks.md ## Closed Lanes, but its pointer's history= field does not resolve to a .current/history/<YYYY-MM>/<lane>/ dir, so the <N> unallocated finding(s) in <pendingRel> have nowhere to be kept — copy the file somewhere safe and remove the worktree by hand (nothing removed)` |
| e287.preserve-fail | `agc feature finish <verb>: could not keep <pendingRel> at <dstRel> (<reason>) — worktree and branch left in place (re-running finish is safe)` |
| e287.usage | see `STR_USAGE_FEATURE` above |
| allocator Q5 reason | `depends on a target_repo finding (target_repo: <repo>), which gets no id in this repo — rewrite the reference as prose in body` |
| validateBlock D4 error | `target_repo must be a non-empty string when present (omit it for a finding that belongs to this repo)` |

These cover the spec's fragment requirements. e287.unallocated-warning contains `agc feature finish —`, `pending-tickets.md`, the revision name, `not allocated`, the count and every `lane_local_id`. e287.target-repo-line contains the `lane_local_id`, the repo and `human ruling`.

### Lane finding (AC-E287-10)

sr creates `.current/e287/pending-tickets.md` and commits it on the lane branch:

````
```pending-ticket
lane_local_id: E287-NEW-1
title: Document the pending-ticket target_repo field and finish's unallocated-findings warning in docs/lane-protocol.md §4 and the integrator SOP Stage 6
priority: P3
depends_on: [E287]
source: e287 architect hop (spec AC-E287-10; both files are forbidden to lane e287)
body: |
  lane-protocol §4: optional `target_repo: <repo>` marks a finding for another repo (no local id; archived and listed on stderr for a human ruling); a pending-tickets.md never committed to the branch is not numbered — finish warns and keeps a copy under .current/history/<YYYY-MM>/<lane>/. Integrator SOP Stage 6: rule on each listed target_repo finding and hand-file any warned unallocated finding.
```
````

## Sequence Diagram

```mermaid
sequenceDiagram
  participant Op as Operator (agc feature finish)
  participant Odb as git object db (rev)
  participant Lane as Lane worktree fs
  participant Prim as Primary checkout

  Note over Op: plan phase (read-only, every refusal here)
  Op->>Odb: cat-file -e rev:.current/lane/pending-tickets.md
  alt present at rev (E179 path, + D4)
    Odb-->>Op: blob
    Op->>Op: parse; split skipped / external / toAllocate; allocate local only (Q5 refusal)
  else absent at rev (O6 path)
    Op->>Lane: stat + read pending-tickets.md
    Lane-->>Op: bytes (or absent, then silent)
    Op->>Op: two-arg parse (report only, never numbered)
    Op->>Prim: target history dir; collision check (carry / differs)
  end
  Note over Op: mutation phase
  opt E179 path
    Op->>Prim: commit backlog rows + archive (shipped) / backlog on base
    Op->>Lane: archive commit on branch (abandoned)
    Op-->>Op: stderr target-repo-line per external entry
  end
  Op->>Prim: lane close / harvest (existing)
  opt O6 path
    Op->>Prim: write history/<bucket>/<lane>/pending-tickets.md (wx) unless harvested
    Op->>Prim: verify byte-identical regular file
    Op-->>Op: stderr unallocated-warning naming the history copy
  end
  Op->>Lane: git worktree remove (no --force)
```

## `--shipped` vs `--abandoned`

| aspect | `--shipped` | `--abandoned` |
|---|---|---|
| revision read | `--base` (`readBlob(repoRoot, base, …)`) | `refs/heads/<branch>` |
| `revLabel` in warning | base name (e.g. `main`) | branch name |
| D4 archive commit | on `--base` in primary (with backlog rows if any local) | on the lane branch in the worktree; backlog commit on base only if local ids |
| external-only, no backlog on base | pending-file-only commit on base, message `chore(lane): archive lane <lane> target_repo finding(s) (shipped, not allocated here)`; no `chore(backlog): allocate` | lane-branch archive commit only; no base commit |
| O6 history dir | first run: `close.histAbs` (the lane-close dir); re-run: the pointer's `history=` dir | `currentHarvest.histAbs` or, if no harvest, the same bucket computed from the shared `now` |
| O6 "covered by" | untracked-dir lane-close harvest (first run) / refresh listing the file (re-run) | E194 current-dir harvest |
| O6 not covered | tracked lane dir (git mv'd; the copy is written next to the moved tracked files), non-directory `.current/<lane>` link, or a re-run where the file is not git-ignored | `.current/<lane>/` has tracked content on the branch (E194 AC8), or is linked outside |

## Re-run / idempotency

- **D4, shipped.** The first run's base commit archives every entry, external ones included. A re-run after a later failure, such as a refused `git worktree remove`, reads the archived file at base. Archived external blocks are exempt from the provenance check, and archived local blocks have their rows. The result: no error, `plan === null`, a silent no-op. No `target_repo` entry is ever allocated (AC-E287-8).
- **D4, abandoned.** The archive is committed on the branch, so a re-run reads it from the branch ref. The outcome is the same as for shipped. A failure *between* the base backlog commit and the lane archive commit is the existing E179 case: the re-run skips local entries through provenance, and external entries are still live and simply archived and listed again. A second listing is harmless.
- **Orphan scan.** `has` counts only local live entries, so a kept abandoned branch whose only remaining live entries are `target_repo` ones is never flagged (AC-E287-8). After a successful finish those entries are archived anyway.
- **O6.** Nothing is committed or numbered, so a re-run sees the same worktree file. A shipped re-run is `alreadyClosed`: the destination is the pointer's history dir, the first run's copy is already byte-identical, so nothing is copied and the warning is printed again. The warning is truthful, because the copy is verified each run. If the lane file was edited between runs and nothing covers it, the re-run refuses at plan time with e287.preserve-differs-refuse. That is the E180 rule: a human looks before anything is overwritten. When the file *is* covered (git-ignored, so the shipped refresh or the E194 copy-over applies), the newer lane bytes overwrite the history copy as those steps already do.
- **O6 copy failure** happens after the shipped lane-close commit. finish throws e287.preserve-fail with the worktree kept. The re-run takes the `alreadyClosed` path, where the destination is absent or identical, so the copy succeeds.

## Test impact (owned finish tests only)

Expected re-pins: **none**. Reasoning per file, for qa to confirm. Any re-pin that does turn out to be needed goes in QA evidence with its reason (AC-E287-4).

- `test/lane-ticket-allocation.test.mjs`: `targetRepo` is set only when the key is present, so the existing `deepEqual`s over entries hold. `allocateTicketIds` is unchanged for entries without `targetRepo`. New D4 and Q5 unit cases go here or in `test/e287-*.test.mjs`.
- `test/agc-feature-lifecycle.test.mjs`: every existing case commits its pending file, so it is present at the revision and the O6 path stays `null`. Commit messages are unchanged on existing paths. The orphan cases have no `target_repo`. The `checkOrphanLanes` source-slice test stays green if the word constraint is kept. No test pins `STR_USAGE_FEATURE`.
- `test/agc-feature-finish-history.test.mjs`, `test/e213-shipped-ignored-shape.test.mjs`, `test/e180-abandoned-harvest.test.mjs`, `test/e246-mailbox-teardown.test.mjs`, `test/e298-finish-remote-delete.test.mjs`: none of them writes a `pending-tickets.md`, so no new line appears. `planLaneClose`'s extra `hist` field is internal. The e298 source slice is untouched as long as the placement rule holds.

New-test hints for qa:
- Ignored-`.current` fixture: `info/exclude` `/.current/`, plus an uncommitted `.current/<lane>/pending-tickets.md`. This covers AC-E287-1, -2 and -9.
- Tracked-dir / ignored-file fixture: commit `.current/<lane>/handoff.md` and exclude `pending-tickets.md`. This is the uncovered branch of AC-E287-3. Assert that `<dstRel>` exists and is byte-identical.
- AC-E287-8 forced late failure: an untracked non-ignored file in the worktree makes `git worktree remove` refuse.

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| Q1: what to do with a pending file that is only in the worktree | Report and preserve; never number it | E179's object-db rule holds. The operator files these findings by hand. |
| Q2: the history copy is not always made | Copy the file itself, with the E180 discipline (exclusive create, identical is a no-op, different is refused at plan time). Do not refuse the whole finish. | Tracked-dir lanes keep finishing. A rare collision refuses before any mutation. |
| What "covered" means | Skip the extra copy only when an existing harvest step writes the same file this run. In every other case copy, even when git would refuse the removal (untracked, not ignored) or the dir is linked outside. | One rule and one destination for every warning. A spare primary copy is harmless (the `evidenceAtRisk` rationale). |
| Truthful destination (AC-E287-3) | The bytes are captured at plan time. The warning is printed only after a post-condition check (destination is a regular file, byte-identical). | A harvest that copied a symlink, or any other surprise, fails closed with the worktree kept. Correctness does not depend on predicting harvest internals. |
| Q3: is a null `target_repo` absent or malformed? | Malformed when the key is present (AC-E287-5 "present-but-empty") | Differs from `source`/`body`, where null means absent. The error text tells the lane to omit the key. |
| Q4: what happens to an external block after finish | Archive it under `## Applied`, and exempt archived external blocks from the provenance check | No forever-live block and no false provenance error. The block's text stays in the archive (history copy / branch). |
| DR-8 (AC-E287-8): orphan scan with live external-only entries | `checkOrphanLanes` counts only local live entries | Matches the spec's literal AC. Cost: a worktree removed by hand whose only live entries are `target_repo` ones gets no `agc check` nudge. Those findings remain durable on the kept branch, and they are not this repo's backlog. *Flagged for the second pre-review.* |
| Q5: where the "depends on a target_repo entry" rule lives | In `allocateTicketIds`, which skips externals in numbering and names them in the reason. Not as a bin post-process. | Pure and unit-testable. The bin passes `[...toAllocate, ...external]`. The module now owns the "never number an external" invariant (defence in depth). |
| Q6: output stream | stderr for both the warning and the listing | Consistent with the existing human-action lines. stdout stays progress-only. |
| Commit pathspec when the backlog is absent at base | `rels` includes `docs/backlog.md` only when the blob exists. The restore list includes it only when it is written. | The external-only, no-backlog shape (AC-E287-7) commits cleanly. Every pre-E287 non-null plan had a backlog, so behaviour is byte-identical there. |
| Malformed blocks in an O6 file | Counted in the warning (`+ K malformed …`), not listed. They never refuse. | Nothing is dropped silently, and nothing is numbered, so a fail-closed refusal would buy nothing. |
| Where the new code goes in the file | A new block after `commitPendingOnShipped`, with no new code inside the two source-sliced regions | The e125b grep test and the e298 slice test stay green unmodified. |

## Deferred Resources

_None — the spec's Dependencies / Prerequisites records a Resource Audit with zero external references._

## Open Questions

None. Q1–Q6 are all decided above. One decision is flagged for the second mailbox pre-review, though it does not block: **DR-8**, where the orphan scan ignores branches whose only live entries are `target_repo` ones, as the AC-E287-8 text requires. Recommendation: keep it as specified. If the integrator prefers a softer `agc check` line for that shape, it is a one-line follow-up and does not change this architecture. O-E326 (option A or B) is still awaiting the human ruling. It is outside this artifact and blocks only T-E326-01, not the E287 work.
