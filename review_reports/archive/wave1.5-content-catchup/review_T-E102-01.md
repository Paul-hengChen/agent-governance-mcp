# Review — T-E102-01

covers: T-E102-01, T-E102-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Contract: the **E102 row in `docs/backlog.md`** + `docs/v4.0.0-execution-plan.md` §8 決 E.
Mini-chain, backlog-row-as-spec — no `specs/` file exists and none is required, so the
AC-execution machinery is dormant and was not treated as blocking.
Diff reviewed: uncommitted working tree vs `HEAD` (`178cfa4`), `bin/agc-init.mjs` only
(the `NEW-TICKETS.md` / `tasks.md` / `.current/` deltas are bookkeeping).

## Summary

- `bin/agc-init.mjs` only, 208 lines changed. All five round-3 findings (R3-A..R3-E) are
  addressed. R3-A is the only behaviour change; R3-C adds `try/finally` + mode
  preservation; R3-B/R3-D/R3-E are comment/string accuracy work.
- **R3-A verified end-to-end, not inferred.** Against a fixture where `repo/CLAUDE.md`
  is a symlink into a dotfiles dir: the link survives as a link, the canonical file
  receives the block, adopter prose is preserved, a `0600` mode stays `0600`, no `.tmp`
  is stranded in either directory, and `agc check` then reports OK **against the real
  file** rather than a detached copy. That is exactly the silent failure the row
  describes, fixed.
- **R3-C verified on both failure branches.** Read-only canonical dir (tmp never
  created) → `EACCES` propagates, canonical unchanged, link intact, no stray file.
  Rename-fails-after-tmp-exists → `EISDIR` propagates, tmp cleaned up. The `finally`
  swallows nothing the caller needed.
- **One required finding (F1)**, in new code: the `realpathSync` ENOENT handler states
  something false, and the branch is unreachable from all three call sites — which
  leaves 決 E implementation point (1) discharged only nominally and makes backlog row
  `0f`'s explicit qa obligation ("pin ... fail-closed on a dangling one") impossible to
  satisfy through the public surface. One recommended and two optional findings follow.
- Verdict: **CHANGES_REQUESTED** — on F1 alone. Everything else in the cut is sound and
  should be kept as-is.

## Correctness

### F1 — REQUIRED — `bin/agc-init.mjs:158-169`: the ENOENT handler misdiagnoses, and cannot run

```js
} catch (err) {
  if (err && err.code === "ENOENT") {
    throw new Error(
      `agc: cannot write ${target} — it is a symlink that does not ` +
        `resolve to anything (dangling)`
    );
  }
```

Two separate problems, one fix.

**(a) The message is false for the only condition that can produce it.** A plain missing
file throws `ENOENT` from `realpathSync` just as a dangling symlink does. Measured:

```
[missing plain file] -> agc: cannot write …/DOES-NOT-EXIST.md — it is a symlink that
                        does not resolve to anything (dangling)
```

Telling an adopter their regular file "is a symlink" sends them to debug a link that does
not exist.

**(b) Neither condition can actually reach it.** All three call sites are `existsSync`-
guarded upstream — `writeClaudeBlock`'s two branches (`:87` early-returns "created") and
`upsertHostKey` (`:363` guard, plus its own `readFileSync` at `:228` which would throw
first). And `fs.existsSync` returns **`false` for a dangling symlink**, not `true`:

```
existsSync(dangling) : false
existsSync(missing)  : false
```

I looked for any reachable state that yields `existsSync === true` with
`realpathSync` throwing `ENOENT` and found none — a symlink loop, the nearest
candidate, gives `existsSync === false` and `ELOOP`, not `ENOENT`. Nothing is exported
from this file (tests drive it as a subprocess), so there is no unit-level back door
either.

**Why this blocks rather than waits.** Backlog row `0f` states the qa obligation
literally: *"qa must pin all three shapes — write-through on a symlink, fail-closed on a
dangling one, and the documented hardlink limitation."* Shape 2 is unpinnable as
written. qa will either write a vacuous test or bounce the ticket — and a FAIL from qa
routes back to sr-engineer anyway, so the round-trip cost is the same and the
information is better now. Separately, a user-facing string that states a falsehood is
precisely the defect class R3-B and R3-D exist to remove; new code in this cut should
not be held to a looser standard than the code it is fixing.

**The constructive part: the dangling shape is already handled, and handled well — just
not where the comment says.** `writeClaudeBlock`'s `!existsSync` → `fs.writeFileSync`
branch follows the dangling link and creates the canonical file. Verified against the
real binary with a dangling `CLAUDE.md` symlink: exit 0, link preserved as a link,
canonical file created with the block. That behaviour is *better* than failing closed,
and it is pinnable.

Suggested resolution (either is fine, both are small):
1. Distinguish the two causes in the message — an `fs.lstatSync(target).isSymbolicLink()`
   check in the catch is ~3 lines; and
2. Add one line to the comment block recording that this branch is **defensive only** —
   every current caller pre-guards with `existsSync`, so the dangling case is handled at
   `writeClaudeBlock:87` instead. That tells the next reader the truth and tells qa where
   shape 2 actually lives.

### Verified sound — no finding

These were the specific things the assignment asked me to weigh; I checked each rather
than accepting the comments' word.

- **tmp lands beside the resolved target (`:184`).** Correct, and load-bearing:
  `tmpPath` and `resolvedTarget` are now guaranteed co-located, which is what keeps
  `renameSync` single-filesystem and therefore atomic. Deriving tmp from the *link* path
  while renaming onto the *resolved* path would risk `EXDEV`. Nothing downstream assumes
  the tmp file appears in the repo — the only place that mattered is a comment (see F2).
- **`finally` cannot delete a successfully renamed target (`:186-199`).** `tmpPath` always
  carries a `.{pid}.{ms}.tmp` suffix, so it can never equal `resolvedTarget`; after a
  successful rename the `unlinkSync` is a plain `ENOENT` no-op. A collision would need
  another process at the same pid in the same millisecond, which is impossible. Confirmed
  by reasoning and by fixture — no stray files, canonical intact.
- **`finally` masks nothing (`:195-198`).** Its `try/catch` wraps only the `unlinkSync`;
  the main block's exception propagates untouched. Observed directly with both `EACCES`
  and `EISDIR`.
- **`chmodSync` failing between write and rename** throws, `finally` removes the tmp, the
  original target is never touched. Fail-closed, correct ordering.
- **R3-A is correct at all three call sites**, not just `CLAUDE.md`: the fix lives inside
  `atomicWriteFile`, so `:105`, `:114` and `:321` (`.config.json`) all inherit it.
- **Expected red confirmed, not a regression.** Full suite: `1865 tests / 1864 pass /
  1 fail`. The single failure is `not ok 53 — KNOWN BEHAVIOUR (R3-A …)` at
  `test/agc-adapters.test.mjs:684`, which asserts the old broken behaviour. SOP 4a
  sampling: the manifest has one entry; it is real and locatable at that exact line.
  `git status test/` is clean — qa-owned surface untouched, Constitution §2 respected.
- **NEW-3's claim is true.** `tools/config.ts:326-333` `atomicWriteConfig` builds
  `tmpPath` from the raw `configPath` and calls `renameSync(tmpPath, configPath)` with no
  `realpathSync`, no `try/finally`, and no mode preservation — the identical defect, in
  the function `bin/agc-init.mjs:118-121` cites as its own precedent. Correctly filed
  out-of-lane rather than fixed.

## Quality

### F2 — RECOMMENDED — `bin/agc-init.mjs:191-194`: the R3-C comment says "repo root", which R3-A just made untrue

> *"must not strand a partial `.tmp` file in the repo root"*

After R3-A the tmp file is derived from `resolvedTarget`, so for a symlinked `CLAUDE.md`
it lands in the **canonical file's** directory — the user's dotfiles dir, not the repo.
Observed: `…/canon3/CLAUDE.md.55319.1789618562329.tmp`. The two halves of this cut were
written together and the older half's comment was not re-read against the newer half.
Suggest "beside the target file" or similar. Minor in isolation, but this is the exact
comment-drift class R3-B and R3-E are chartered to remove, so it should not ship inside
the fix for them.

### F3 — OPTIONAL — `bin/agc-init.mjs:178-182`: `statSync` failure silently forfeits mode preservation

```js
} catch {
  mode = undefined; // shouldn't happen — resolvedTarget just resolved above
}
```

If this ever fires, `mode` is `undefined`, the `chmodSync` is skipped, and a `0600` file
silently widens to `0644` — the precise outcome R3-C exists to prevent, with no warning.
The comment is right that it is near-impossible (`realpathSync` succeeded microseconds
earlier on the same path). Logging to `warnings` would cost one line, but the fallback is
no worse than pre-R3-C behaviour, so this is genuinely takeable as-is.

### R3-E sweep — complete, and the line it draws is principled

I ran the assignment's grep (`T-E1`, `C[0-9]`, `R[0-9]`, `P9`, `W3`, `Q6`, `review
round`, `review_T-`) plus `round [0-9]`. Every unreachable citation is gone:
`T-E100-03`, `C1`–`C5`, `R1`, `R2`, `P9`, `W3`, `Q6`, `review_T-E111-01`, and
`T-E111-02` — which the row's own grep list did miss, correctly caught here.

What remains is `E34 / E100 / E104 / E111` (pre-existing) and the new `E102` / `R3-C`.
I checked whether those violate E73 constraint (4) and concluded they do not: `package.json`
declares no `files` field and the documented install path is `npx github:…`, so
`docs/backlog.md` ships with the binary — and the E102 row documents every `R3-x` label
by name. Backlog E-numbers and `R3-x` labels are therefore reachable to an adopter;
`C3` / `R1` / `round 2` live only in `review_reports/` and are not. The sweep removed
exactly the unreachable class. That is the right line.

**The sweep also fixed a stale claim rather than just deleting a citation**, which is
worth recording as a positive: the old text read *"T-E111-02 … is the fixture test that
actually proves this … **until that lands**, this is a human-facing nudge"*. `T-E111-02`
is now `[x]` in `tasks.md`, so the rewrite's present-tense *"a qa-owned fixture test
under `test/` proves this detection logic"* is accurate and the temporal caveat was the
stale part. Reasoning was preserved, not destroyed, at every other site I diffed
(`isEmptyDir`, `hasUntrackedContent`, `hasIgnoredUntrackedContent`, `hasTrackedContent`,
`isSafelyLinkedOutside`, the `Q6` dangling/inside-lane split).

### F4 — OPTIONAL — `bin/agc-init.mjs:570-577`: "re-derive from first principles" drops a pointer that was still usable

The old text pointed at `review_T-E111-01` round 2's C4/C5 matrix; the replacement asks
the reader to re-derive it. Correct per the rule, but it converts a lookup into
rederivation for a maintainer working *in this repo*, where that report is tracked. A
non-citation pointer ("this file's review history in `review_reports/`") would keep the
rule and the affordance. Take it or leave it.

### R3-B and R3-D — both verified accurate against the code

- **R3-B (`:302-309`)**: the comment now names `hostIsDeclared` (`:246-247` — `hasHostKey
  && typeof parsed.host === "string" && parsed.host.length > 0`), which is exactly the
  predicate confirmed false before the splice. The enumeration is correct: `42` / `{}` /
  `["x"]` are truthy non-strings that do reach the splice, so "falsy" was genuinely
  wrong and the divergence is real. The `!m`-branch sibling comment at `:268-276` was
  corrected consistently. This was the highest-leverage of the five and it landed.
- **R3-D (`:373-379`)**: the contradiction is gone. The old comment's premise ("stderr is
  routinely discarded") was self-refuting because the stdout line at `:442` literally
  reads `"Not updated (rejected, see warnings)"` and points the reader at stderr. The
  replacement justifies the bucket on structured-stdout-vs-free-text-stderr grounds
  instead. Channels unchanged (`:431-446`), as intended.

## Architecture

No architecture spec exists for this feature; none is required (mini-chain,
backlog-row-as-spec). The change is confined to one function plus comments in one file —
`bin/agc-init.mjs`, this lane's exclusive file. No layering change.

The cut resolves the internal contradiction 決 E was decided on: the same binary that
teaches adopters to symlink `qa_reports/` / `review_reports/` / `specs/` back to primary,
and spends most of `checkWorktreeEvidence` verifying those links with `lstatSync` /
`isSymbolicLink` / `realpathSync`, no longer destroys a symlink a few hundred lines away.
The hardlink-unsupported rationale is stated in the code comment as the row required,
and states the reason (no target to resolve; the only alternative is the truncating write
that was removed to kill the `^C`/ENOSPC risk) rather than leaving it to be re-derived.

Ordering of R3-A before R3-C inside the function body (resolve → stat → write → chmod →
rename → finally) is the correct dependency order: mode must be read from the resolved
target, not the link.

## Security

No findings. No new input crosses a trust boundary. `realpathSync` broadens what the
process will write to only insofar as it now follows a link the adopter placed
themselves, which is the decided-supported layout. Mode preservation is a strict
improvement: the pre-fix code silently widened a deliberately-restricted `0600`
`CLAUDE.md` to `0644`; it no longer does (verified — `600` after a full `agc init`).
No secrets, no shell interpolation, no new subprocess.

One property worth recording as intentional rather than a finding: `agc init` now needs
write permission on the *canonical* file's directory rather than the repo's. It fails
loudly and cleanly when it does not have it (`EACCES`, nothing stranded, link and
canonical both intact) — correct, and strictly better than the pre-fix behaviour of
silently detaching the link.

## Performance

No findings. The change adds one `realpathSync` and one `statSync` per
`atomicWriteFile` call — three calls per `agc init` invocation, on a CLI that already
does synchronous file I/O and `git` subprocess calls throughout. Not a hot path, no
complexity-class change, no new allocation of consequence. The `finally`'s `unlinkSync`
adds one failed syscall per successful write, which is noise at this call volume.

## Verdict

**CHANGES_REQUESTED** — R3-A through R3-E all land and R3-A is verified fixed end-to-end,
but F1 ships a user-facing error string that states a falsehood about a plain missing
file, in a branch no call site can reach, which leaves 決 E point (1) discharged only
nominally and makes backlog row `0f`'s explicit "pin fail-closed on a dangling one" qa
obligation unsatisfiable through the public surface.

F2 is recommended (fix while you are in the file); F3 and F4 are optional and may be
declined without a further round. Nothing else in the cut should change.

## Round 1 reply — by sr-engineer

F1 fixed at `bin/agc-init.mjs:158-169` (line numbers pre-fix): the catch block now calls
`fs.lstatSync(target).isSymbolicLink()` to discriminate the two ENOENT causes before
choosing the message — a plain missing path now reports "no such file or directory",
a dangling symlink still reports the "does not resolve to anything (dangling)" message.
Verified against a fixture (real `fs.symlinkSync` dangling link + a genuinely missing
path, both routed through the exact catch-block logic): the two causes now produce
distinct, accurate messages.

Comment block above the catch rewritten to state plainly that this branch is
**defensive-only** — every current call site (`writeClaudeBlock`'s two branches,
`upsertHostKey`'s `existsSync` guard + its own `readFileSync`) pre-guards with
`fs.existsSync`, which is `false` for a dangling symlink exactly as it is for a
plain-missing path, so this catch cannot observe a dangling symlink today — and names
where the dangling case is actually handled: `writeClaudeBlock`'s `!existsSync` branch,
which lets `fs.writeFileSync` follow the dangling link and create the canonical file
(write-through, link preserved), not fail-closed.

**Reachability is unchanged by this fix.** The lstatSync discriminator only changes
what the message says *if* this catch is ever reached; it does not add a way to reach
it. `fs.existsSync` still returns `false` for a dangling symlink, so all three call
sites still short-circuit before `atomicWriteFile` is called on one, and the branch
remains dead code on the public surface today (kept as defensive-only per the comment).
Decision-E point (1) ("fail-closed on a dangling one") is therefore still discharged by
`writeClaudeBlock:87`'s write-through behavior, not by this catch, and the mechanism
is now documented as such rather than misattributed — see the divergence note in
`pending_notes`. Backlog row `0f`'s qa obligation to pin the dangling shape is
satisfiable against `writeClaudeBlock:87`'s write-through behavior, not against this
catch block.

F2 fixed at the `finally` comment: "in the repo root" replaced with "beside the target
file (the resolved target's directory — e.g. the dotfiles dir a symlinked CLAUDE.md
points into, not necessarily the repo)".

F3 declined as scoped (optional, near-impossible per the reviewer's own assessment;
not gold-plating it).

Verification: `npm test` — 1865 tests / 1864 pass / 1 fail, the one fail being the
declared expected-red `test/agc-adapters.test.mjs:684` (unchanged); `npx tsc --noEmit`
clean; `npm run check:md-tables` OK; `npm run check:version` OK. `git status test/`
clean — qa-owned surface untouched.

---

## Round 2 — APPROVED — by code-reviewer

Closing pass on the round-1 findings, not a fresh audit. Every claim below was
re-measured against the shipped bytes on a real fixture in `$TMPDIR`; nothing is
taken from `pending_notes` on trust.

## Summary

- **F1 (required) — RESOLVED, verified.** The ENOENT catch in `atomicWriteFile`
  now discriminates via `fs.lstatSync(target).isSymbolicLink()`. Exercised
  directly against the shipped function body: plain-missing yields
  `agc: cannot write <p> — no such file or directory`; a real dangling symlink
  yields `… it is a symlink that does not resolve to anything (dangling)`; a
  non-ENOENT failure (ELOOP, self-referential link) is rethrown unchanged with
  no `agc:` prefix. Two accurate diagnoses where round 1 found one wrong one.
- **F2 (recommended) — RESOLVED, verified.** The `finally` comment's "in the repo
  root" is gone; the replacement text matches measured behaviour (the `.tmp`
  lands beside the *resolved* target).
- **F3 (optional) — declined.** Correct call; it was graded optional for exactly
  the reason given.
- Diff scope unchanged and correct: `bin/agc-init.mjs`, `tasks.md`,
  `NEW-TICKETS.md`, `.current/*`, plus the two untracked evidence/report files.
  `docs/` and `test/` are byte-untouched (`git status` confirms both).
- Verdict: **APPROVED**.

## Correctness

**F1 fall-through default — correct, and no ENOENT path is diagnosed worse than
before.** `bin/agc-init.mjs:167` ff. The nested `lstatSync` is wrapped and
defaults `isSymlink = false`, i.e. plain-missing. Measured on fixtures:

| shape | `existsSync` | `realpathSync` | `lstatSync` | message chosen |
|---|---|---|---|---|
| dangling symlink | `false` | throws ENOENT | ok, `isSymbolicLink() === true` | dangling — accurate |
| plain missing path | `false` | throws ENOENT | throws ENOENT | no such file or directory — accurate |
| target removed mid-race | — | throws ENOENT | throws ENOENT | no such file or directory — accurate *at report time* |
| missing intermediate path component | — | throws ENOENT | throws ENOENT | no such file or directory — accurate |
| symlink loop | — | throws ELOOP | not reached | rethrown raw — unchanged |

Defaulting to plain-missing is the right choice: it is the diagnosis that is
still literally true in every fall-through case (the path does not resolve and
no symlink is observable), whereas defaulting to "dangling" would blame a
symlink the process cannot see. Against the round-1 baseline — which said
"dangling" unconditionally — every row above is equal or better. No regression.

**Expected-red sampling (SOP 4a).** `qa_reports/expected-red_e102-agc-init-symlink-atomicwrite.txt`
holds one entry; all one sampled and located at `test/agc-adapters.test.mjs:684`,
an exact string match. Full suite re-run independently: **1865 tests / 1864 pass /
1 fail**, and the single `not ok` is that exact test. sr-engineer's claim
reproduces.

No new correctness findings.

## Quality

**The defensive-only comment is accurate and does not overstate.** This is the
load-bearing artifact of round 2 — the branch is unreachable, so the comment is
what a maintainer acts on. Each claim checked:

1. *"Every current call site pre-guards with `fs.existsSync`"* — **true.** The
   three call sites are `bin/agc-init.mjs:105` and `:114` (both downstream of
   the `!fs.existsSync(target)` test at `:88`, so `existing` was read
   successfully) and `:345` inside `upsertHostKey`, itself reached only from
   the `else` of `if (!fs.existsSync(abs))` at `:387`, and additionally behind
   that function's own `fs.readFileSync(abs)` at `:252`. `upsertHostKey` has
   exactly one caller (`:392`). No unguarded path exists.
2. *"`fs.existsSync` returns false for a dangling symlink exactly as for a plain
   missing path"* — **measured true.**
3. *"The dangling case is handled at `writeClaudeBlock`'s `!existsSync` branch:
   `fs.writeFileSync` follows the dangling link and creates the canonical file,
   leaving the link intact"* — **measured true, end-to-end through the real
   binary.** `agc init` in a fixture repo whose `CLAUDE.md` is a dangling
   symlink: exit 0, link still a symlink, canonical file created, adapter block
   present, no dangling error on stderr.
4. *"This catch exists only so a future caller that skips the `existsSync` guard
   fails loudly"* — fair statement of purpose, and the narrower phrasing is what
   keeps claim 1 from being an overstatement.

One precision note, not a finding, recorded so it does not propagate: the prose
in `pending_notes` and in the Round 1 reply above cites **`writeClaudeBlock:87`**.
Line 87 is blank; the branch test is at **`:88`** and the write-through
`fs.writeFileSync` at **`:89`**. The in-code comment cites the branch by name
(`` `!existsSync` branch ``) rather than by line, so the load-bearing artifact is
correct — only the surrounding prose is off by one or two. Downstream consumers
should cite `bin/agc-init.mjs:88-89`.

Strictly, the comment's "never actually observes a dangling symlink today" holds
absent a concurrent race (the canonical target could be unlinked between the
`readFileSync` at `:93` and the `realpathSync` at `:167`). That race only
*strengthens* the case for keeping the branch, and the message it would then
produce is the correct one. Not a finding, and not worth a comment edit.

R3-A/R3-C behaviour re-confirmed end-to-end on a live (non-dangling) symlinked
`CLAUDE.md`: link preserved, canonical written through, adopter prose outside the
markers preserved, mode `0600` preserved rather than widened, and no stray `.tmp`
left in the target's directory.

## Architecture

No architecture spec for this feature; the layering is unchanged from round 1.

**Decision-E divergence record — reviewed, and "better but different" is a fair
characterisation.** Judged against the decision text at
`docs/v4.0.0-execution-plan.md:802-806`, which reads (implementation point 1):
"`realpathSync` 遇到 dangling symlink 會丟例外，要 fail-closed —— 先例就在幾百行外的
`checkWorktreeEvidence` 裡."

- **The record is in the right place.** `docs/` is byte-untouched (`git diff
  HEAD -- docs/` and `git status docs/` both empty); the divergence is captured
  in `pending_notes` for the coordinator to relay, which is the correct
  disposition for an out-of-lane doc edit.
- **The recorded description is accurate** as far as it goes: decision E point
  (1) does specify fail-closed on dangling, and the shipped end-to-end behaviour
  is indeed repair-by-write-through at `:88-89`, not a hard failure.
- **It is not a regression against the decision's intent — it is better on the
  decision's own stated terms.** The harm decision E names is 無聲失效: the
  canonical file never receives the block while `agc check` reports OK
  (`:792-794`). Write-through repair removes that harm completely (the canonical
  file *does* receive the block, the link survives, `agc check` then reports OK
  against the real file). Fail-closed would also remove it, but by leaving the
  adopter with a non-functional `agc init` instead of a working one. Loud-correct
  beats loud-refusing when both are available.
- **Two refinements the human should have before ratifying**, because the
  divergence is narrower than the record implies. First, on the decision's
  *literal* wording, point (1) is an implementation note about `realpathSync`'s
  exception inside `atomicWriteFile` ("it throws — handle that fail-closed"),
  and the shipped catch *does* throw a descriptive error rather than swallowing
  it. Read that way, point (1) is discharged as written; only the *end-to-end*
  reading ("`agc init` must refuse on a dangling `CLAUDE.md`") diverges. Second,
  the cited precedent cuts the same way: `checkWorktreeEvidence` treats a
  dangling link as a **warn at exit 0**, not a hard failure — so "fail-closed"
  in decision E's own vocabulary means "never silently accept it", which
  write-through satisfies. Third, `writeClaudeBlock`'s `!existsSync` branch is
  **pre-existing** and was not modified by this ticket; E102 changed the
  `atomicWriteFile` path only. The divergence is therefore a behaviour E102
  *documented* rather than one it introduced.
- **Residual cost, disclosed not dismissed:** if an adopter's dangling link
  points at a typo'd path, `agc init` now creates a file there instead of
  surfacing the typo. It is reported in the `created` bucket at the link's
  resolved path, so it is visible, not silent. Small, and strictly smaller than
  the harm decision E was written to prevent.

**Not escalated as a human decision by me** — this is a ratification item, not a
blocker. The coordinator should relay the record with the three refinements
above so the human ratifies the write-through choice (or asks for fail-closed)
with the divergence stated at its true width.

`NEW-TICKETS.md` NEW-3 correctly *files* rather than fixes the identical defect
shape in `tools/config.ts`'s `atomicWriteConfig` — the right call for a
single-file lane.

## Security

No findings. No new input crosses a trust boundary. The error messages
interpolate `target`, a path the invoking user already controls and can see; no
secret or environment content is newly disclosed. `chmodSync` copies the
existing mode rather than widening it, which is a small improvement over the
base.

## Performance

No findings. F1 adds at most one `lstatSync` on an already-failing error path.
The happy path gains one `realpathSync` plus one `statSync` per write of a file
`agc init` touches at most a handful of times per invocation. No complexity-class
change, no regression versus base.

## Verdict

**APPROVED** — both round-1 findings are genuinely resolved and independently
re-measured (not relabelled), the fall-through default is the correct one and
degrades no ENOENT diagnosis, the defensive-only comment is accurate on every
load-bearing claim, `docs/` is untouched with the divergence correctly parked in
`pending_notes`, and the diff introduces nothing outside its declared scope.

### Note for qa — what backlog row `0f` can and cannot pin

- **CAN pin**, against `bin/agc-init.mjs:88-89` (`writeClaudeBlock`'s
  `!existsSync` branch): `agc init` in a workspace whose `CLAUDE.md` is a
  **dangling** symlink → exit code 0, the symlink is still a symlink
  (`lstatSync().isSymbolicLink()`), the canonical target file is created, and it
  contains the adapter block. Verified end-to-end this round. This is the whole
  of row `0f`'s observable dangling behaviour.
- **CAN pin**, against the R3-A path: a **live** symlinked `CLAUDE.md` is written
  *through* — link preserved, canonical updated, adopter prose outside the
  markers preserved, file mode preserved (0600 stays 0600), no stray `.tmp`
  beside the resolved target.
- **CANNOT pin** the dangling diagnostic through `atomicWriteFile`'s ENOENT
  catch. That branch is **unreachable from every call site** (`existsSync` is
  false for a dangling link, so `writeClaudeBlock:88` short-circuits first) and
  round 2 did **not** change its reachability — only the accuracy of the message
  it would emit if a future unguarded caller reached it. A test asserting the
  string `"(dangling)"` from `agc init` will fail; the message is only
  observable by calling `atomicWriteFile` directly, which is not exported.
- **MUST invert** `test/agc-adapters.test.mjs:684`, the single declared
  expected-red. It currently pins the pre-fix behaviour (symlink replaced,
  canonical keeps old content); R3-A makes both assertions false by design.
  Baseline after inversion should be 1865/1865.
