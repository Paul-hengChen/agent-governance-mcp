# Review — T-E121-01

covers: T-E121-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Three `.replace(pattern, templateString)` calls in `tools/tasks-file.ts` became
  `.replace(pattern, (_match, p1) => templateString)` — `completeTaskInFile:197`,
  `rollbackTaskInFile:251`, `voidTaskInFile:400`. No other production file changed.
- **The delivered change is correct, and I verified it by execution rather than by
  reading it.** I reverted the three sites in a copy of the built module, re-ran the
  same probe, and reproduced the documented corruption (a `` $` `` note splicing the
  file preamble into the row); with the fix the same input is stored verbatim. Keep
  this change as-is.
- **But the fix closes one of the two halves E121 was filed wide to cover.** The
  `$`-expansion half is closed. The **newline half is untouched and still live in all
  four mutators**, with a *worse* consequence than the half that was fixed: a forged,
  parseable, immediately-offered task row, and `progress.total` moving — the exact
  headline symptom the backlog row cites.
- **The failing test `test/e117-void-task.test.mjs:298` is not a stale test.** It is a
  correct regression signal. sr-engineer's mechanical diagnosis of *why* it flipped is
  right, but its conclusion — "expected, hand it to qa to re-baseline" — is wrong.
  Close the newline half and the test goes green **as written**, with no re-baseline at
  all. Detail in Correctness C1.
- Verdict: CHANGES_REQUESTED. One defect class, one more fix shape, four sites.

## Correctness

### C1 — BLOCKING. The newline half of E121 is untouched; `test/e117-void-task.test.mjs:298` is a true regression signal, not a stale test.

**The scope question first, because it decides the round.**

The backlog E121 row (`docs/backlog.md:243`) instructs that it was filed WIDE, and names
its own origin: `review_reports/archive/e117-void-task/review_T-E117-01.md`, findings
C5/C6. That origin document is explicit about what "wide" means. Line 334:

> **C5 (blocking)** — … Do **not** fix the sibling call sites (`completeTaskInFile` /
> `rollbackTaskInFile` / `addTaskInFile`); that vector is pre-existing and belongs on
> its own backlog row

— "that vector" there is C5's **newline** vector. That sentence is what created the
round-2 backlog row. Then line 536:

> **C6 must widen the round-2 backlog row before it is filed** … the currently-drafted
> row names only the newline half.

So the row E121 *is* = the round-2 newline-in-siblings row, **widened** to also carry
the `$`-expansion half. It is the union of the two, not a replacement of one by the
other. "Filing it narrow loses the rest" means: keeping only the newline framing loses
the `$` half. It does not mean the newline half was dropped. E121 owns both.

**Now the measurements.** All run against `dist/` built from this working tree
(`npm run build` green, `npx tsc --noEmit` clean), driving the real exported mutators
against a temp workspace.

**The central question — the exact input from the failing test.**
`voidTaskInFile(ws, "T-A", "a\n$&")` against `## P\n- [ ] T-A first\n`:

```
result: {"success":true,"taskId":"T-A","marked":"voided","reason":"a\n$&"}

bytes:  "<!-- schema_version: 1 -->\n## P\n- [-] T-A first (voided: a\n$&)\n"

lines:  [0] "<!-- schema_version: 1 -->"
        [1] "## P"
        [2] "- [-] T-A first (voided: a"
        [3] "$&)"
        [4] ""

parsed task rows: (none)
getNextTask: {"allComplete":true,"totalTasks":0}
```

Answering the four questions put to me, for **this specific input**:

- The stray line 3 is `"$&)"`. It is **not** parseable as a task row — `parseTaskLine`
  returns `null` for it under the default pattern.
- `progress.total` does **not** move. It goes to 0 because the only task was voided,
  which is correct.
- `getNextTask` behaves **correctly** — `allComplete: true`, T-A is not re-offered.
- So for `"a\n$&"` in isolation, succeeding **is** the right behaviour, and the residue
  is cosmetic litter in a markdown file.

**That is exactly why the test is not stale — and why it must not be re-baselined to
`success: true`.** The input `"a\n$&"` is a *weak* instance of the class. Strengthen it
by one character and the same code path forges a live row. Same function, same fix, no
`$` involved:

```
voidTaskInFile(ws, "T-A", "oops\n- [ ] T-FORGED forged")
  → {"success":true,"taskId":"T-A","marked":"voided"}
  bytes: "…\n## P\n- [-] T-A first (voided: oops\n- [ ] T-FORGED forged)\n- [ ] T-B second\n"
  parsed rows: T-FORGED (live), T-B
  getNextTask → offers T-FORGED
```

The void succeeded **and planted a task that never existed**, which the server now
offers as the next unit of work. The E117 post-write invariant does not catch it
because it tests `parsed.id === taskId` only — it defends the *voided* id, not the
task list. The E117 review anticipated this precisely (line 449: "The C5 guard does
not catch these because it tests `parsed.id === taskId` only … Noted so the backlog
row records the full blast radius").

The sibling mutators are worse, because they have no invariant check at all:

| probe | result | effect on `tasks.md` |
|---|---|---|
| `completeTaskInFile(ws,"T-A","done\n- [ ] T-FORGED forged")` | `success:true` | forged live row; **`progress.total` 2 → 3**; `getNextTask` offers `T-FORGED` |
| `rollbackTaskInFile(ws,"T-A","oops\n- [ ] T-FORGED forged")` | `success:true` | forged live row; `progress.total` 2 → 3 |
| `addTaskInFile(ws,"T-NEW","real\n- [ ] T-FORGED forged","P")` | `success:true` | forged live row; `progress.total` 2 → 3; **bypasses the duplicate-id scan entirely**, which runs before the insert and only inspects `taskId` |

`progress.total` moving on a `success: true` receipt is the precise symptom
`docs/backlog.md:243` names as E121's headline harm ("one case moved `progress.total`
from 3 to 4"). It is still reproducible after the fix, through the half that was not
fixed.

This also falsifies a factual premise inside the spec. Both `docs/backlog.md:243` and
the `tasks.md` T-E121-01 row assert that for the three non-void mutators "the injected
row is **inert garbage**." It is not. Under the newline vector it is a live, parseable,
scheduled task row. Correcting that premise by measurement is not me widening my own
criterion — it is the spec understating its own blast radius, and the brief asked for
exactly this probe.

**Therefore the ruling on `test/e117-void-task.test.mjs:298`:**

The test asserts `result.error` matches `/Refusing to void T-A/` and that `tasks.md` is
byte-identical. Once the newline half is closed by a pre-write refusal, a reason
containing `\n` is refused **before** `atomicWrite`, so both assertions hold and **the
test passes unchanged**. There is no re-baseline to hand to qa. The test is currently
red because the fix is incomplete, which is what a red test is for.

### Required change

Establish, at all four mutators, the invariant: **no caller-supplied string may
introduce a line break into `tasks.md`**, and after any mutator write the set of
parseable task ids changes only as the operation intends. Two acceptable shapes:

- **(a) Refuse** — reject `note` / `reason` / `description` containing `\n` or `\r`
  before any write, returning the existing `Refusing to …` error shape. This matches
  the precedent already established in this file (`tools/tasks-file.ts:300-302`: "a
  silent no-op is worse than a loud refusal here"), and it keeps
  `test/e117-void-task.test.mjs:298` green as written.
- **(b) Flatten** — collapse line breaks to spaces before embedding. Also sound: a task
  row is one line by construction, so a multi-line note cannot round-trip through this
  format anyway. If you choose (b), `:298` *does* need a qa re-baseline, and (a) is the
  cheaper path for that reason alone.

I recommend (a) and am not mandating it. Whichever you pick, apply it at all four
sites — `addTaskInFile` included, per C2.

## Quality

**The delivered change is clean.** Three sites, minimal diff, no scope creep, no
sanitising bolted on where the spec said the replacer function *is* the fix.

- Typing is sound. `p1: string` is safe at all three sites: `completeTaskInFile:194`
  and `voidTaskInFile:360` use `(\s.+)$`, and `rollbackTaskInFile:246` has exactly one
  capture group (`(\s.+?)`; the trailing `(?:…)?` is non-capturing). Group 1 is always
  defined on a successful match, so it is never `undefined`.
- `_match` underscore-prefixing for the unused first parameter is consistent with repo
  convention; `npx tsc --noEmit` is clean.
- Comments are accurate and cite a durable id (`E121, docs/backlog.md order 0t`) — this
  directly addresses the E117 review's P-level nit (line 492) that inline comments cited
  review-report labels no reader could resolve. Good.
- No behavioural change for benign input: full suite is 1845/1846 with the single
  failure being `:298`, i.e. nothing else moved.

### Q1 (non-blocking) — one comment line will read as false once C1 is fixed

`tools/tasks-file.ts:394-399` says the post-write invariant check is "defense-in-depth,
not a substitute for this fix … a splice that lands inert garbage elsewhere in the file
would sail past it undetected." That is accurate *today*. When you close the newline
half, revisit the wording — see Architecture below for the ruling on the check itself.

## Architecture

### Ruling on the E117 post-write invariant check (`tools/tasks-file.ts:402-419`) — KEEP. It is load-bearing, not dead, not redundant.

Measured both ways:

- With the fix in place, `voidTaskInFile(ws,"T-A","oops\n- [ ] T-A resurrected")` is
  **still refused**, file byte-identical. The check is the only thing catching it. It
  is live code on a reachable path.
- Reverting the fix, `voidTaskInFile(ws,"T-A","a\n$&")` is **also** refused — that is
  precisely why `:298` was green before and red now.

So: the check is genuinely defensive, it fires, and per C1 it is currently one of the
few things standing between a caller string and a forged row. sr-engineer's *in-code*
comment characterises it correctly. Its scope limit should be recorded, though, because
it is the thing that misleads a future reader: **the check defends `taskId` only**
(`parsed.id === taskId`), so it does not see a forged *different* id (measured above,
`T-FORGED` sails straight past it). That limit is why C1 cannot be closed by leaning on
this check — it must be closed at the input boundary.

Layering is otherwise untouched: the fix stays inside `tools/tasks-file.ts`, the
file-mode implementation behind `HandoffStorage`. SQLite mode is unaffected (parameterised
statements; `reason` is not persisted there at all). No architecture spec exists for this
feature; the backlog row is the contract.

## Security

### S1 — The grep sweep is sound, and I extended it past the three directories sr-engineer swept.

sr-engineer swept `tools/*.ts`, `gates/*.ts`, `schema/*.ts`. That misses `bin/`,
`prompts/`, `lib/`, `scripts/`, `transport/` and `index.ts`. I re-ran it repo-wide
across `*.ts`, `*.mjs`, `*.js` excluding `dist/`, `node_modules/` and `test/`.

**Conclusion: the sweep's finding holds, and holds more widely than it was stated.**
Every `.replace(` outside `tools/tasks-file.ts` takes either a fixed literal replacement
(`""`, `"_"`, `"\\$&"`, `"\n"`, `"\n\n"`, `" "`) or a replacer function
(`prompts/partials-manifest.ts:43`). None takes caller-supplied text as a replacement
string. Specifically cleared: `bin/agc-init.mjs:86`, `bin/agent-governance-context.mjs:80`,
`lib/watermark-check.ts:127,135`, `prompts/text-transforms.ts:28-30,50-52`,
`transport/http.ts:68`, `tools/handoff-orchestrator.ts:1116`, `tools/handoff-parse.ts:202`,
`tools/rag.ts:62`, `tools/evidence-file.ts:46,81,110,244`, `gates/visual.ts` (all sites).

The `escapeRegExp` idiom `s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` recurs in
`tools/{tasks-file,drift,sync,metrics,storage-sqlite}.ts`. It *does* use `$&` — as a
fixed literal, which is the correct and intended use. Not a finding.

### S2 — Keeping the pattern-sanitising class out of scope was the right call. Agreed.

The `taskId.replace(/[^A-Za-z0-9._-]/g, "_")` calls in `gates/{code-review,qa-review,
ac-execution,expected-red,visual}.ts` sanitise a caller-supplied value used to build a
*path/pattern*, not a replacement string. Different mechanism, different blast radius
(path traversal, not file-content injection), and the E117 review already routed it to
its own row alongside C4. Folding it in here would be scope creep. Correctly excluded
and correctly reported separately.

### S3 — The trust boundary, restated.

`note` / `reason` / `description` arrive as `z.string()` with no content restriction
(`tools/registry.ts:259,266,272,278` — only `.min(1)` and a length cap) and cross
unescaped into a governed, parsed artifact. The caller is an authenticated local
governed role that could edit `tasks.md` directly, so this is integrity hygiene rather
than a privilege boundary — consistent with how E117 framed the identical hole. But for
a server whose entire purpose is that governance state cannot be quietly falsified,
"a free-text field forges a scheduled task row and the tool reports success" is the
class this product exists to prevent. That is the weight behind C1.

## Performance

No findings. A replacer function instead of a replacement string is the same single
`String.replace` call with an O(1)-per-match closure invocation, on a cold,
lock-held, once-per-mutation path already dominated by `readFileSync` + `parseTasks` +
`atomicWrite`. One closure allocation per call, not per line. No new I/O, no added
pass over the file, no complexity-class change versus base. The fix recommended in C1
adds at most one scan of a short caller string, which is free on the same path.

## Verdict

**CHANGES_REQUESTED** — the `$`-expansion half is correctly fixed and verified by
execution, but E121 is the *widened* row and the newline half it also owns is still
live at all four mutators, where a caller string forges a parseable task row, moves
`progress.total`, and returns `success: true`; `test/e117-void-task.test.mjs:298` is a
true regression signal that goes green as written once that half is closed, not a stale
test for qa to re-baseline.

---

## sr-engineer reply (Round 1)

C1 fixed, decision (a) — refuse, per the coordinator's ruling, not (b). No caller-supplied
`note` / `reason` / `description` may introduce a line break into `tasks.md`; enforced at
all four mutators, at the input boundary, before any read or write:

- **`completeTaskInFile`** (`tools/tasks-file.ts`) — new guard immediately inside the
  function body, before `findTasksFile` is even called: `note !== undefined &&
  containsLineBreak(note)` → `Refusing to complete <taskId>: note must not contain a line
  break …`.
- **`rollbackTaskInFile`** — same placement, guards `reason` (required, so no
  `undefined` branch needed): `Refusing to rollback <taskId>: reason must not contain a
  line break …`.
- **`voidTaskInFile`** — same placement, guards `reason`: `Refusing to void <taskId>:
  reason must not contain a line break …`. This is the site `test/e117-void-task.test.mjs:298`
  exercises; the message still matches `/Refusing to void T-A/`, so the test passes
  **unchanged**, exactly as predicted.
- **`addTaskInFile`** — same placement, guards `description` (the field the forged-row
  probe used, per C1's table): `Refusing to add <taskId>: description must not contain a
  line break …`.

All four share a new `containsLineBreak(s) { return /[\r\n]/.test(s); }` helper placed
just above `completeTaskInFile`. No caller-supplied `section` (addTaskInFile) or `taskId`
(any mutator) is touched — out of scope, per C1's explicit field list (`note` / `reason` /
`description`).

Also updated the in-code comment on `voidTaskInFile`'s post-write invariant check
(the "defense-in-depth … sail past it undetected" wording flagged Q1): it now says
plainly that the newline vector is closed upstream by this round's input-boundary guard,
and that the check's remaining job is the taskPattern-shape case (test C2 — a custom
checkmark class that also matches the void marker), not a substitute for either upstream
fix. Kept the check itself exactly as-is, per the Architecture ruling — did not weaken it.

**Verified by execution, all four sites, forged-row payload** (the exact probes from C1's
table, workspace built fresh per probe, byte-identical file confirmed each time):

| mutator | payload | result | file |
|---|---|---|---|
| `completeTaskInFile` | note = `"done\n- [ ] T-FORGED forged"` | refused: `Refusing to complete T-A: note must not contain a line break …` | byte-identical |
| `rollbackTaskInFile` | reason = `"oops\n- [ ] T-FORGED forged"` | refused: `Refusing to rollback T-A: reason must not contain a line break …` | byte-identical |
| `voidTaskInFile` | reason = `"oops\n- [ ] T-FORGED forged"` | refused: `Refusing to void T-A: reason must not contain a line break …` | byte-identical |
| `addTaskInFile` | description = `"real\n- [ ] T-FORGED forged"` | refused: `Refusing to add T-NEW: description must not contain a line break …` | byte-identical |

No forged row plants in any of the four; `getNextTask`/`progress.total` never move for a
refused write (nothing was written).

**Round 1's fix re-confirmed intact** — `voidTaskInFile(ws, "T-A", "a $&")` (no newline)
still stores the reason literally: `- [-] T-A first (voided: a $&)`, `success: true`. A
benign reason with neither vector (`"plain harmless reason"`) still succeeds normally —
the new guard does not over-refuse.

**`test/e117-void-task.test.mjs`**: all 25 tests pass, including `:298` unchanged (no
edit to the test file).

**Full suite**: `npm run build` clean (`tsc` zero errors, `check:version` and
`check:transitions-sync` both OK). `npm test` reads **1843/1846**, three failures, all in
`test/render-structure.test.mjs` (`T-E69-02 AC …`, both `cross-SOP render sweep …`
tests). These are **not caused by this round's code change** — confirmed by reverting
`tools/tasks-file.ts` to its pre-round-2 state and re-running the same test file: the
same three failures reproduce identically against last round's code. Root cause is this
workspace's own live `.current/handoff.md`: `buildPromptForRole`/`switchRole` render
against this repo's actual on-disk state (dogfooding), and this round's incoming
`pending_notes` (written by code-reviewer round 1, still on disk as I start) quote
literal example probe text containing a checkbox-shaped substring outside a rendered
line's leading position — exactly what the render-structure glue detector exists to
catch, just tripped by review-report prose rather than a real SOP/constitution fragment.
It is unrelated to the C1 fix and will clear on this round's own `tw_update_state` write,
which replaces `pending_notes` wholesale; I have kept this round's own notes free of the
same substring shape so it does not recur. Flagging rather than silently asserting
1846/1846 — the target acceptance signal, `test/e117-void-task.test.mjs:298`, is
confirmed green, and the three-failure state is a pre-existing artifact of this
workspace's live review content, not a regression from this diff.

**Confirmed**: after making the `tw_update_state` handoff write for this round (which
replaced `pending_notes` with this round's own, substring-clean notes), re-ran `npm test`
once more with no further code change — **1846/1846, zero failures**, prediction
verified. Do not read the earlier **1843/1846** measurement above as this diff's
acceptance state; it was a transient artifact of round 1's own `pending_notes` content,
already gone.

Scope confirmation: only `tools/tasks-file.ts` touched this round. No file under `test/`
touched. `docs/backlog.md:243` and the `tasks.md` T-E121-01 row's "inert garbage" premise
left uncorrected, per the coordinator's instruction — carried to release close-out
instead.

Ready for Round 2 review.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary

- Judged the round-2 diff only (`tools/tasks-file.ts`, +122/-25, plus its rebuilt `dist/` artefacts). `test/` is untouched, as required.
- The coordinator's settled decision — **(a) REFUSE, not (b) flatten** — is implemented correctly in shape: a `containsLineBreak(s)` helper plus an input-boundary refusal at four mutators, reusing this file's `Refusing to …` precedent. Placement, error shape, and non-over-refusal all verified by measurement.
- Round 1's `$`-expansion fix at the three replacer sites is **intact and re-confirmed against base** — every `$&` / `$1` / `` $` `` / `$'` / `$$` payload now stores literally, where `HEAD` expanded them.
- **One blocking finding (R2-C1): the refusal is complete by character class but not by field.** `addTaskInFile` guards `description` and leaves `taskId` unguarded — and `addTaskInFile` concatenates *both* into the new line. A newline-bearing `task_id` still plants a forged row, `success: true`, measured end-to-end. That is E121's headline defect, still open, at one of the four sites the ticket names.
- Two non-blocking findings recorded for downstream: the exact line-terminator boundary (answering the scope question by measurement), and a **pre-existing, out-of-scope** row-erasure class (U+2028 / U+2029) that this diff neither causes nor closes.
- Verdict: **CHANGES_REQUESTED** — one line of work, at the guard already written.

## Correctness

### R2-C1 — BLOCKING — `addTaskInFile` guards `description` but not `taskId`; the forged-row defect is still live

`tools/tasks-file.ts:481-493` refuses a line break in `description`. Twelve lines below, `tools/tasks-file.ts:530`:

```ts
const newLine = `- [ ] ${taskId} ${description}`;
```

`taskId` is caller-supplied, reaches the same physical line by the same plain concatenation, and is not checked by anything. The in-code comment on the new guard states the invariant correctly — *"that still plants a second, independently parseable line, bypassing the duplicate-id scan below entirely"* — and then applies it to only one of the two strings that satisfy it.

Measured against the working tree's own `dist/`, base fixture `- [ ] T-A alpha / - [ ] T-B beta / - [x] T-C gamma`:

| call | result | file changed | forged row planted | `parseTasksFromFile` after |
|---|---|---|---|---|
| `addTaskInFile(ws, "T-X" + LF + "<a forged incomplete row for T-FORGED>", "ordinary description")` | `success: true` | yes | **yes** | `T-A, T-B, T-C:x, T-FORGED` |
| `addTaskInFile(ws, "T-X" + CR + "<same>", "ordinary description")` | `success: true` | yes | no | `T-A, T-B, T-C:x, T-X` |
| `addTaskInFile(ws, "T-X", "ordinary description")` | `success: true` | yes | no | `T-A, T-B, T-C:x, T-X` |

Note the first row carefully: the caller's *own* task `T-X` does not appear. The planted LF leaves `- [ ] T-X` as a descriptionless line that `DEFAULT_TASK_REGEX`'s `\s+(.+)$` cannot match, so the requested task is silently dropped **and** a fabricated id appears in its place. That is strictly worse than the payload round 1 measured.

The duplicate-id scan at `tools/tasks-file.ts:521-527` compares `m[2] === taskId` against a `taskId` that itself contains the newline, so it never matches and provides no incidental cover.

**This is reachable from the real MCP boundary, not just the unit.** `tools/registry.ts:277` declares `task_id: z.string().min(1).max(200)` — length only, no character class. Nothing between `tw_add_task` and `addTaskInFile` filters it.

The other three mutators are *incidentally* safe: `completeTaskInFile`, `rollbackTaskInFile` and `voidTaskInFile` all resolve `taskId` against an existing row first, so a newline-bearing id fails the lookup (`Task <id> not found.`) before any write — verified, file byte-identical in all three cases. That safety is **derived from an unrelated precondition**, not stated or guaranteed anywhere. `addTaskInFile` is the one mutator with no existence precondition, which is exactly why it is the one that is exposed.

**Required fix** — guard `taskId` at `tools/tasks-file.ts:481`, alongside the existing `description` check, with a field-accurate message:

```ts
if (containsLineBreak(taskId)) {
  return JSON.stringify({
    error:
      `Refusing to add ${JSON.stringify(taskId)}: task id must not contain a line break — ` +
      `tasks.md is a line-oriented format and a multi-line task id would plant an ` +
      `unrelated, independently parseable line in the file.`,
  });
}
```

(Interpolate the id through `JSON.stringify` in *this one* message, or the refusal text itself spans two lines — a small thing, but the existing messages all assume a single-line id.)

**Recommended, not required**: apply the same `taskId` guard at the other three mutators too. It costs three lines and converts the invariant from *"safe because the lookup happens to fail first"* into a statable, testable property: **no caller-supplied string that reaches a task line may contain a line break.** As it stands, a future refactor that moves or relaxes the lookup silently re-opens three sites, with nothing to catch it.

### R2-Q1 — the line-terminator boundary, settled by measurement (non-blocking)

The scope question was: is `/[\r\n]/` the whole class, or is the guard narrower than the defect? Measured, not reasoned:

**For row forging — the defect E121 names — LF is the entire class, and the guard covers it with room to spare.**

The evidence is that `tasks.md` has exactly two line-splitting readers, and both split on LF alone:
- `parseTasks` — `tools/tasks-file.ts:81`, `migratedBody.split("\n")`
- `addTaskInFile`'s duplicate scan — `tools/tasks-file.ts:521`, `content.split("\n")`
- `voidTaskInFile`'s post-write invariant — `tools/tasks-file.ts:450`, `newContent.split("\n")`

No reader splits on CR, U+2028, U+2029, NEL, VT or FF. `DEFAULT_TASK_REGEX` (`tools/config.ts:100`) carries no `m` flag, and `resolveTaskRegex` (`tools/config.ts:353-364`) builds custom patterns with `new RegExp(config.taskPattern)` — no flags argument, so a caller cannot introduce `m` either. `^`/`$` therefore anchor to the whole candidate string, never per-terminator.

Measured at all four mutators with a forged-row payload prefixed by each candidate terminator. Every one of LF, CRLF, CR, U+2028, U+2029, VT, FF, NEL, NBSP: **zero forged rows** in the working tree. Against `HEAD`'s build, LF and CRLF forge at all four sites and nothing else does — confirming both that the defect was real and that LF is its whole extent.

So: **`containsLineBreak` is complete for the forging class.** qa can pin that boundary rather than guess at it. CR is not over-breadth either — see the next finding for why it earns its place.

### R2-C2 — row *erasure* via U+2028 / U+2029 — PRE-EXISTING, out of scope, do not fix here

Measurement surfaced a second, adjacent class the guard does not close. It is not a forging vector and not a regression; recording it so it can be ticketed rather than lost.

`DEFAULT_TASK_REGEX`'s trailing `(.+)$` cannot cross a JS line terminator, because `.` excludes `\n`, `\r`, `\u2028`, `\u2029`. When one of those lands mid-description, the whole line stops matching — so the row does not get forged, it gets **erased**: still on disk, invisible to `parseTasksFromFile`, and therefore to `getNextTaskFromFile`, `tw_detect_drift` and `tw_sync`.

| payload | working tree | base (`HEAD`) |
|---|---|---|
| `completeTaskInFile(T-A, note = "x" + CR + "y")` | REFUSED, file unchanged | `success: true`, **T-A erased** |
| `completeTaskInFile(T-A, note = "x" + U+2028 + "y")` | `success: true`, **T-A erased** | `success: true`, **T-A erased** |
| `completeTaskInFile(T-A, note = "x" + U+2029 + "y")` | `success: true`, **T-A erased** | `success: true`, **T-A erased** |
| `rollbackTaskInFile(T-C, reason = "x" + U+2028 + "y")` | `success: true`, **T-C erased** | `success: true`, **T-C erased** |

Two consequences worth stating plainly:

1. **Refusing CR is not over-refusal.** It is the one member of the erasure class this guard happens to close — `HEAD` erases a row on a lone CR, the working tree refuses it. Round 2 gets credit for that whether or not it was the stated intent.
2. **U+2028 / U+2029 remain open**, identically before and after this diff. Both columns match at base, so this is **pre-existing and untouched** — not a regression introduced here, and not within E121's named defect (row forgery via `String.replace`). It belongs to `parseTaskLine` / the regex, not to this diff.

Cheapest possible closure, if the follow-up ticket wants it: widen the helper to `/[\r\n\u2028\u2029]/`. Those four code points are exactly the set `.` cannot cross, so that one character class closes the erasure category completely for the default pattern. **Do not do it under T-E121-01** — it is a different defect with a different justification and it deserves its own test.

### R2-Q5 — the three replacer sites have not regressed (non-blocking, confirmed)

Re-measured the round-1 half against base, inspecting the actual on-disk line rather than the return value:

| payload | working tree, all four sites | base (`HEAD`), the three replacer sites |
|---|---|---|
| `BEGIN $& END` | stored literally | `BEGIN - [ ] T-A alpha END` — whole matched row spliced in |
| `BEGIN $1 END` | stored literally | `BEGIN  alpha END` — capture group spliced in |
| ``BEGIN $` END`` | stored literally | expanded |
| `BEGIN $' END` | stored literally | expanded |
| `BEGIN $$ END` | stored literally | expanded |

`addTaskInFile` stores literally in both columns, as expected — it never used `String.replace`. The round-1 fix is real, present, and correct. No regression.

## Quality

**R2-Q3 — placement and error contract: correct at all four sites.** Verified per site, by reading and by measurement:

- `tools/tasks-file.ts:177` (`completeTaskInFile`, `note`), `:242` (`rollbackTaskInFile`, `reason`), `:349` (`voidTaskInFile`, `reason`), `:488` (`addTaskInFile`, `description`) — each is the **first statement of the function body**, ahead of `findTasksFile`, ahead of `withFileLock`, ahead of `verifyFreshness`, and in `addTaskInFile` ahead of the `mkdirSync` of a missing `.current/` directory.
- Measured: on every refusal across all four sites and every refused payload, `tasks.md` is **byte-identical** (`Buffer.equals`) to its pre-call contents. No partial state change can precede the refusal, and no `.lock` artefact is created.
- Return shape is `JSON.stringify({ error: … })` — identical to every other refusal and every other failure in this file, with the `Refusing to ` prefix as the discriminator. That matches the existing contract exactly: `voidTaskInFile`'s post-write refusal already uses the same shape and the same prefix, and `test/e117-void-task.test.mjs:298` discriminates on precisely that prefix. A caller that distinguishes refusal from failure by prefix keeps working; a caller that wanted a structured `code` field never had one here and does not regress.

**R2-Q2 — no over-refusal.** Measured at all four sites: a 130-character ordinary reason with commas, semicolons, colons and parentheses; `$&`; `$1`; `` $` ``; `$'`; `$$`; NBSP; VT; FF — all fourteen benign payloads return `success: true` and store correctly. The guard fires only on CR and LF. A governed role writing a legitimately long `reason` is unaffected; the only inputs it rejects are ones that cannot be represented in a one-task-one-line file at all.

**R2-Q4 — the `voidTaskInFile` post-write invariant comment: accurate, and my round-1 ruling is preserved, not eroded.** The rewritten comment at `tools/tasks-file.ts:424-447` states the check *"remains load-bearing for what's left"* and names the residual case (a custom `taskPattern` whose checkmark class also admits the void marker `-`, test C2). That is the opposite of the *"largely redundant"* reading I rejected in round 1, and it is correct on the merits: with `$`-expansion closed by the replacer function and LF/CR closed at the boundary, the only remaining way the rewritten line re-parses as `taskId` is a `taskPattern` shape that admits the void marker, or an unanchored custom pattern matching a `taskId`-shaped substring inside the reason text. Both are fairly described as "the taskPattern-shape case". No objection.

One nit, non-blocking: the comment asserts *"By this point `reason` cannot contain a newline."* Precisely, it cannot contain LF or CR; U+2028 / U+2029 still can (R2-C2). The invariant the sentence is defending is unaffected — neither one splits a line for any reader here — but the absolutism is a hair ahead of the code. Either scope the sentence to "LF or CR", or leave it and close R2-C2 in its own ticket and the sentence becomes true as written.

**Naming nit, non-blocking:** `containsLineBreak` checks CR and LF, while "line break" in Unicode terms also covers U+2028 / U+2029 — the exact two this file mishandles (R2-C2). The helper name and the user-facing message both claim slightly more than the predicate delivers. If R2-C2 is deferred rather than fixed, consider `containsCrLf` to keep the name honest. Cosmetic; not worth a round on its own.

## Architecture

No architecture spec exists for E121; the backlog row is the contract. Layering is unchanged and correct: the guard sits in `tools/tasks-file.ts`, the file-mode implementation, alongside the format knowledge (`split("\n")`, the checkbox line grammar) that justifies it. That is the right home — the constraint is a property of the markdown-file storage backend, not of the tool contract, and pushing it up into `tools/registry.ts`'s zod schema would wrongly impose a markdown-file constraint on the SQLite backend, which has no line-oriented representation.

One consequence of that placement is worth noting rather than changing: the refusal is **file-mode only**. `tools/tasks.ts` delegates through `getActiveStorage()`, so an HTTP/SQLite workspace does not get this check — correctly, since it does not have the defect. Worth a sentence in the eventual doc-writer pass; not a code finding.

`containsLineBreak` is declared once and shared by all four call sites — no duplication of the predicate, and a single place to widen if R2-C2 is ever closed. Good.

## Security

The trust boundary is exactly right, and R2-C1 is the reason this is a `CHANGES_REQUESTED` rather than a nit.

The threat model E121 addresses is **ledger forgery by a caller-supplied string**: a role (or a compromised/confused client) supplying a note, reason, description or id that causes `tasks.md` to acquire a task row nobody cut. A forged row is not cosmetic — `tasks.md` is the id vocabulary for `tw_detect_drift` and `tw_sync`, and `getNextTaskFromFile` will dispatch work against a fabricated id.

- **Closed by this diff**: `note`, `reason` (×2), `description` — refused at the boundary, before any read or write, at all four sites, for the entire forging class (R2-Q1). Correct posture: refuse loud, do not rewrite the caller's text.
- **Still open**: `taskId` at `addTaskInFile` (R2-C1). Unvalidated at `tools/registry.ts:277` (length only) and unvalidated at `tools/tasks-file.ts:481-530`. End-to-end reachable through the ordinary `tw_add_task` tool call, with the aggravating twist that the caller's legitimate task is dropped while the fabricated one lands.

No secrets, no injection into any interpreter, no new external input path. The residual is the one field above.

## Performance

No findings. `containsLineBreak` is a single anchorless character-class test on a string bounded at 2000 characters by `tools/registry.ts:278`, executed once per mutator call, on a path already dominated by file I/O and lock acquisition. The three `String.replace` call sites swapped a replacement *string* for a replacement *function* — same single pass, same complexity class, no measurable difference. Running the guard *before* `withFileLock` is a small net improvement: a refused call no longer acquires the lock or stats the file at all.

## Verdict

**CHANGES_REQUESTED** — the decided design is implemented correctly and completely for the character class (LF/CR is provably the whole forging class for this parser), placement and error contract are right at all four sites, and round 1's `$`-expansion fix is intact; but `addTaskInFile` guards only one of the two caller-supplied strings it concatenates into the new line, leaving E121's headline forged-row defect live and reachable through `tw_add_task`'s unconstrained `task_id`.

**To clear round 3**, one required change:

1. **R2-C1** — guard `taskId` at `tools/tasks-file.ts:481`, with a field-accurate message. Recommended (not required): the same guard at the other three mutators, so the invariant stops depending on the lookup failing first.

Not required, explicitly out of scope for this task, recorded for follow-up tickets:

- **R2-C2** — U+2028 / U+2029 row erasure. Pre-existing at `HEAD`, unchanged by this diff, belongs to `parseTaskLine` / `DEFAULT_TASK_REGEX`. Do not fix under T-E121-01.
- The `containsLineBreak` naming nit and the "cannot contain a newline" sentence in the `voidTaskInFile` comment — cosmetic, fold into whichever ticket closes R2-C2, if any.

Acceptance signal for round 3, unchanged from round 1 and not to be re-baselined: `test/e117-void-task.test.mjs:298` green **unchanged**, `test/` untouched, and the suite at its current total with no new failures.

### Evidence for E122 (recorded here, not fixed, not part of this verdict)

Confirming the diagnosis, since it was cheap. `prompts/build.ts:381` renders the **entire** handoff state into the dispatch text verbatim:

```ts
stateBlock = `## 📍 Current Project State (Auto-injected)\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``;
```

`pending_notes` is part of `state`, so whatever a role writes there becomes rendered prompt text. `test/render-structure.test.mjs:331` and `:345` call `switchRole(role, ROOT)` and `buildPromptForRole(skillFile, "probe", ROOT, false)` with `ROOT` bound to this repo, then run the glue detector — which flags checkbox-shaped syntax appearing anywhere other than a line's leading position (`test/render-structure.test.mjs:46`) — over exactly that text, and asserts the per-role counts match a tracked debt list.

So a `pending_notes` entry that quotes a task-row marker mid-line raises the count above the tracked expectation and turns the suite red, with no defect in any SOP or constitution fragment. That is E122 (order `0u`) reproducing against live workspace state, and it explains the transient `1843/1846` observed mid-round: it cleared when the next `tw_update_state` replaced `pending_notes`. Recorded as evidence only — E122 is a separate ticket and nothing here touches it.

---

## Round 3 — APPROVED — by code-reviewer

## Summary

- Judged the round-3 delta only: `tools/tasks-file.ts` gains four `containsLineBreak(taskId)` guards (`:184` complete, `:261` rollback, `:375` void, `:534` add) plus their comments. Nothing else in the working tree moved; `test/` is byte-clean (`git status --porcelain test/` empty).
- **R2-C1 is closed.** My own round-2 payload, re-run unchanged against the rebuilt `dist/`, now refuses: no write, no forged row, `tasks.md` byte-identical, no `.lock` artefact, and — the part that made round 2 worse than round 1 — the caller's own row is no longer silently dropped, because nothing is written at all.
- The coordinator's all-four decision is implemented as stated, not approximated: each of the other three returns a distinct `task_id must not contain a line break` refusal, **not** a lookup miss. The invariant is now asserted at the boundary rather than derived from `find()` ordering.
- Over-refusal: zero, and structurally zero rather than empirically zero — see R3-Q1. Sixteen benign id shapes confirmed accepted, including `$`-bearing, backtick, CJK, emoji, slash, space and tab ids.
- Rounds 1-2 re-confirmed intact by measurement, not by inspection. Full suite independently re-run: **1846/1846**, 0 fail, 0 skipped.
- Verdict: **APPROVED**.

## Correctness

### R3-C1 — R2-C1 is closed. Measured, with the base contrast alongside it.

Base (`HEAD` `dist/`, extracted with `git archive HEAD dist`) vs working tree, same fixture `<!-- schema_version: 1 -->\n## P\n- [ ] T-A first\n`, same call:

```js
addTaskInFile(ws, "T-X" + LF + "- [ ] T-FORGED forged row", "ordinary description")
```

| | base (`HEAD`) | working tree |
|---|---|---|
| return | `{"success":true,"taskId":"T-X\n- [ ] T-FORGED forged row",…}` | `{"error":"Refusing to \"T-X\\n- [ ] T-FORGED forged row\": task_id must not contain a line break — …"}` |
| `tasks.md` | rewritten | **byte-identical** |
| forged row | **`- [ ] T-FORGED forged row ordinary description` live and parseable** | absent |
| caller's own row | `- [ ] T-X` — descriptionless, unmatched by `(\S+)\s+(.+)$`, **silently dropped** | never written |
| `getNextTask` progress | `{completed:0,total:2}` — `T-A` + `T-FORGED`, `T-X` invisible | `{completed:0,total:1}` |
| `.lock` artefact | n/a | none |

The base row is the whole defect in one line: `success: true`, an attacker-chosen row in the ledger mirror, and the row the caller actually asked for gone. All four properties invert in the working tree.

### R3-C2 — the other three refuse *explicitly*, which is the point of the all-four decision

For each of `completeTaskInFile` / `rollbackTaskInFile` / `voidTaskInFile`, with `taskId = "T-A" + LF + "- [ ] T-FORGED forged"` against a fixture containing a live `T-A`:

- error matches `/task_id must not contain a line break/` — **not** `not found` / `Could not find` / `No incomplete` (asserted negatively as well as positively);
- `tasks.md` byte-identical;
- no `.lock` artefact;
- the error message itself is single-line, because `JSON.stringify(taskId)` escapes the embedded LF rather than emitting it.

That last point matters more than it looks: the message is JSON-encoded into a tool result that agents read as text. Interpolating the raw id would have let a newline-bearing id break the error message across lines too. The round-3 code uses `JSON.stringify(taskId)` in exactly the four places where `taskId` may still contain a break, and raw `${taskId}` in the four payload-field guards where it provably cannot. That asymmetry is correct, not sloppy — and the raw form is required at `voidTaskInFile:389`, since `test/e117-void-task.test.mjs:295` matches `/Refusing to void T-A/`.

CR-only variants (`"T-A\r…"`) refuse identically at all four sites, file untouched.

### R3-C3 — placement: no partial state change or lock can precede any refusal

Verified by reading each function body, not by trusting the line numbers. At all four sites the `taskId` guard is the **first statement** of the body — only the JSDoc/rationale comment sits between the signature's closing `): Promise<string> {` and the `if`. It precedes:

- the payload-field guard (`note` `:192`, `reason` `:269`/`:389`, `description` `:549`);
- `findTasksFile` / `resolveTaskPaths` (first I/O);
- `withFileLock` (so no `.lock` is ever created — confirmed empirically, `fs.readdirSync(ws)` shows no lock file after every refusal);
- `verifyFreshness`, `mkdirSync`, `atomicWrite`, `refreshSnapshotFor`.

A refusal is therefore a pure function of the arguments. No file is opened, so there is no failure mode where the guard fires after a snapshot refresh or a lock acquisition.

### R3-C4 — the all-four decision opened four new early-return paths; none of them broke the error contract

Checked every consumer, not just the ones the diff touches:

- `tools/storage.ts:179/183/187/196` — `FileHandoffStorage` returns the string verbatim.
- `tools/tasks.ts` — `handleCompleteTask` / `handleRollbackTask` / `handleVoidTask` / `handleAddTask` pass the string through into `content[0].text` without parsing or branching.
- `tools/sync.ts:70-76` — the only programmatic caller of a mutator. It feeds `storage.completeTask` ids drawn from `vocab`, i.e. ids already parsed **out of** `tasks.md`. Those cannot contain a line break (see R3-Q1), so `tw_sync` can never trip the new guard. No behaviour change, confirmed by `test/sync.test.mjs` green.
- `tools/drift.ts` — reads only; calls no mutator.

Nothing anywhere assumes these functions can only fail *after* a lookup. The refusals join an existing family of pre-lookup returns (`"No task list file found."`, `"Could not resolve a target task file path."`), so the "fails before touching the file" shape is not new to any caller.

Discrimination: both refusal and failure are `{error: string}` with no `success` key, so a caller distinguishes them by message text. That is this file's pre-existing convention for all eleven of its error returns — the new ones are consistent with it, not a regression. Measured side by side:

```
miss    = {"error":"Task T-NOPE not found."}
refusal = {"error":"Refusing to complete \"T-A\\nx\": task_id must not contain a line break — …"}
```

See R3-Q2 for the non-blocking note on this.

## Quality

### R3-Q1 (non-blocking, and the answer to the over-refusal question) — the refused set is exactly the unrepresentable set

sr-engineer's 6 benign ids reproduce. I extended the sweep to 16, all accepted by `addTaskInFile`:

`T-1`, `JIRA-42`, `T-$1`, `T-$&`, `T-$$`, ``T-`bt` ``, `T-E121-01`, `ABC_123`, `feat/login-01`, `T-A.B.C`, `T-中文-01`, `T-emoji-🙂`, `T-with space`, `T-2026-09-15`, `#123`, `T-a\tb`

plus a round trip: `completeTask` / `rollbackTask` on a `$&`-bearing id with a `$&`/`$1`/`` $` ``-bearing note, and `voidTask` on a backtick id — all `success: true`.

But the stronger argument is structural, not empirical. **No id that contains a line break can round-trip through `tasks.md` in the first place.** `parseTasks` (`tools/tasks-file.ts:80-92`) splits the body on `\n` and calls `parseTaskLine(line.trim(), …)`; `DEFAULT_TASK_REGEX` (`tools/config.ts:100`) captures the id as `(\S+)`, which excludes `\r` and `\n` by definition, and the `.trim()` strips a CRLF `\r` before the regex ever sees it — so a CRLF-checkout workspace cannot produce a `\r`-bearing id either. A custom `taskPattern` changes the regex but not the per-line split, so no configured pattern can yield a multi-line id.

The guard therefore refuses precisely the set of ids the storage format cannot represent. There is no realistic adopter id shape — and no machine-derived id from `tw_sync`, `tw_detect_drift` or `getNextTask` — that newly gets refused. The zod schema at `tools/registry.ts` (`task_id: z.string().min(1)`) stays as wide as the coordinator chose; the file boundary is where the format's own constraint is now stated.

### R3-Q2 (non-blocking, recorded, do not fix here) — refusals are distinguishable only by message text

A structured discriminator (`{error, code: "TASK_ID_LINE_BREAK"}`) would let callers branch without string-matching, and would insulate `test/e117-void-task.test.mjs:295`'s `/Refusing to void T-A/` from message rewording. Out of scope: it would change the shape of all eleven error returns in this file, and `tools/registry.ts`'s error-code contract is registry-scoped (`gates/registry.ts`), not task-scoped. Recorded for whoever touches this surface next.

### R3-Q3 (non-blocking) — comment-to-code ratio at the four new guards

Roughly 45 lines of rationale for 32 lines of guard, with the same "derived, not stated" argument restated at three of the four sites. The `completeTaskInFile:178-183` block earns its length (it is the canonical statement the other two point back to); `rollbackTaskInFile:257-260` and `voidTaskInFile:370-374` already do the right thing by referring back rather than repeating in full. `addTaskInFile:519-533` is long but justified — it is the site where the defect was live. No change requested; this is the file's established house style and it is load-bearing history.

### R3-Q4 — round-2's "cannot contain a newline" comment nit is now resolved by construction

`tools/tasks-file.ts:466-472` asserts that by the time the post-write invariant runs, `reason` cannot contain a newline. Round 2 flagged that this was true only for `reason`. With the `taskId` guard now at `:375`, the statement holds for both strings that reach `newContent`, and the comment at `:477-483` correctly narrows the post-write check's remaining job to the custom-`taskPattern` same-id-resurrection case. The comment and the code now agree.

## Architecture

Unchanged from round 2's ruling, and the round-3 delta strengthens it. The design is a two-tier defence: an input-boundary refusal for everything the format cannot represent (all four mutators, both string fields each — eight guards), and the E117 post-write invariant at `voidTaskInFile` retained as the backstop for the one class the boundary cannot see (a custom `taskPattern` whose checkmark class also matches `-`, so a voided row still parses as its own id). Round 3 does not weaken the backstop; it removes the last case where the backstop was the *only* defence.

The all-four placement is the right architectural call for the reason the coordinator gave. Before this round, `completeTaskInFile` / `rollbackTaskInFile` / `voidTaskInFile` were safe because `result.tasks.find()` runs before any line is built — safety derived from statement order in a function body, invisible at the signature, and silently revocable by any refactor that hoists line construction or adds an upsert path. The invariant is now stated at each entry point and costs one regex test per call.

No layering change: `containsLineBreak` is a file-private helper alongside `escapeRegExp`, the guards return the same `{error}` shape as every other refusal in the module, and nothing new crosses a module boundary.

## Security

The trust boundary is unchanged and now fully defended at the `tasks.md` write surface. `task_id`, `note`, `reason` and `description` all arrive from an untrusted caller (an MCP client, i.e. any agent), and all four reach a line-oriented file. Both injection primitives E121 named are closed:

- **`$`-expansion** (round 1) — the three `String.replace` sites use replacer functions, so no `$&` / `` $` `` / `$'` / `$n` / `$$` in caller text is ever expanded. Re-confirmed this round by measurement, not inspection.
- **Line injection** (rounds 2-3) — refused at the boundary at all eight field × mutator combinations, before any I/O.

The privilege the injection bought is worth restating, because it is what makes a vacuous test dangerous here: `tasks.md` is the completion mirror that `tw_get_next_task`, `tw_detect_drift` and `tw_sync` read. A forged incomplete row invents work; a forged `[x]` row asserts a completion that no QA evidence backs, which is exactly the property `QA_COMPLETION_EVIDENCE_MISSING` exists to protect. The base measurement above shows an agent obtaining that with one `tw_add_task` call and `success: true` in its face.

Not closed here, by instruction, and not a regression: **R2-C2** (U+2028 / U+2029 erasing a row at parse time) — pre-existing, identical at base and working tree, owned by a separate ticket. `containsLineBreak`'s character class is deliberately unchanged.

## Performance

No findings. Each guard is one non-global `/[\r\n]/.test()` over a short string, executed once per mutator call, on a path already dominated by `findTasksFile`, a lock acquisition, a full-file read and an `fs.renameSync`. Refusals are strictly *cheaper* than the base path — they return before any syscall. No complexity-class change anywhere; the replacer-function conversion from round 1 is O-identical to the replacement-string form.

## Verdict

**APPROVED** — R2-C1 is closed at the site that was live and stated as an explicit invariant at the other three; placement precedes all I/O and locking at every site; over-refusal is structurally zero; rounds 1-2 are intact by measurement; 1846/1846 with `test/` untouched.

### Evidence handed to qa-engineer for T-E121-02

Verification this round was run from a scratchpad script against `dist/`, with `HEAD`'s `dist/` extracted separately for the base contrast (`git archive HEAD dist`). Nothing was left in the tree. The full executable surface qa must pin is specified in the `pending_notes` of the APPROVED handoff; the load-bearing points are that **the pre-fix behaviour also returned `success: true`**, so asserting "no crash" or "`success: true`" is not a test of this defect, and that the base-vs-fixed contrast above is the shape of the assertion that actually discriminates.
