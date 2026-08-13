# Review — T-E39-01 (E39 + E58 fold-in)

covers: T-E39-01

Round 1 — reviewed by @code-reviewer (opus). sr-engineer was pinned to `fable`
(`dispatch_pins`), so writer and reviewer ran on different models — no same-model
bias caveat applies to this round.

## Summary

- Re-derives the `## ALLOWED_TRANSITIONS Matrix` mirror in
  `specs/qa-flow-enforcement-architecture.md` (16 rows → 21), rewrites the stale
  Amend-Resume paragraph, adds E58's `pm:Blocked → design-auditor:In_Progress`
  edge to `tools/transitions.ts`, and adds `scripts/check-transitions-sync.mjs`.
- **The table itself is correct.** An independent third re-derivation (my own
  order-preserving parser, not sr's script) matches `ALLOWED_TRANSITIONS` loaded
  from `dist/` on all 21 keys — entry order within every row and key order across
  rows included. Zero divergences.
- E58's edge is present, mirrored, legal, and provably the *only* source change:
  the full-file diff of `tools/transitions.ts` against HEAD is one added entry
  plus its comment. The round-cap paragraph was correctly left untouched.
- Two blocking findings, both in the parts of the cut that are *not* the table:
  the newly written Amend-Resume paragraph asserts a persistence semantic the
  source contradicts (C1), and the new check is wired to nothing, so nothing ever
  runs it (C2).
- Verdict: **CHANGES_REQUESTED**.

## Correctness

### C1 — BLOCKING. The new Amend-Resume paragraph contradicts the source it cites.

`specs/qa-flow-enforcement-architecture.md:179`:

> This field is transient and write-scoped — it applies to that single call only
> and is never persisted to `handoff.md`/SQLite state, so there is nothing to
> re-arm or clear between writes.

"Never persisted to `handoff.md`" is false. In file mode `resume_of` **is** written
into the handoff frontmatter on the write that sets it:

- `tools/handoff-write.ts:459` — `if (resumeOf) frontmatterData.resume_of = resumeOf;`
- `tools/handoff-parse.ts:232,299` — parsed back off disk into state
- `tools/handoff-types.ts:152` — `resume_of?: ResumeOfTarget;` is a declared
  `HandoffState` field, not a call-local parameter

The claim is true only for the SQLite half of the compound ("File-mode only
(DR-5): `SqliteHandoffStorage.writeState` ignores all three" —
`tools/handoff-orchestrator.ts:1509-1511`, echoed at `tools/storage-sqlite.ts:493`).
A sentence that is right about one storage mode and wrong about the other is more
misleading than one that is simply wrong.

The orchestrator states the real semantics in its own comment at
`tools/handoff-orchestrator.ts:1509-1511`: *"Transient, write-scoped (AC-3):
**persisted only when set on this write.**"* The mechanism that makes the
paragraph's *conclusion* correct is a different one than the paragraph gives —
`tools/handoff-write.ts:440-444` deliberately does **not** join these fields to
the existing-state preserve read, so a later write that omits `resume_of` drops
it; and nothing ever reads it back (I grepped `tools/` and `gates/` for
`prevState.resume_of` / `state.resume_of` / `existing.resume_of` — zero hits;
`validateTransition` sees only the incoming write's value, threaded as
`next_resume_of` at `tools/handoff-orchestrator.ts:151`).

So the conclusion "nothing to re-arm or clear" survives, but the stated reason
does not. Suggested replacement:

> This field is write-scoped: it is emitted to `handoff.md` only on the write that
> sets it and is never carried forward — `writeHandoffState` deliberately does not
> join it to the existing-state preserve read, so a later write that omits it drops
> it (`tools/handoff-write.ts:440-459`). SQLite mode never persists it at all
> (DR-5). Nothing reads it back off state; `validateTransition` sees only the
> incoming write's value. There is therefore nothing to re-arm or clear between
> writes.

This is blocking because it is precisely the defect class E39 exists to eliminate —
a spec paragraph asserting something the source contradicts — reintroduced in the
one paragraph the ticket asked to be re-verified against source. Everything else in
the rewritten paragraph checks out exactly; see "Verified clean" below.

### C2 — BLOCKING. The new check is unwired; nothing ever runs it.

`scripts/check-transitions-sync.mjs` has zero references anywhere except the spec
prose, the expected-red manifest, and its own file. `package.json` is unchanged;
`.github/workflows/ci.yml` runs only `npm run build` and `npm test`.

sr's stated reasoning — that `check-version.mjs` is also invoked directly — inverts
the precedent. `check-version.mjs`'s load-bearing path is
`"prebuild": "npm run check:version"`, which is why it fires on every `npm run build`
*and* every `npm test` (via `pretest` → `build` → `prebuild`), in CI included.
Direct invocation is its *secondary* path, not the pattern to copy.

Both authorities are explicit:

- `docs/backlog.md:165` (E39, the spec): "consider whether a generated-from-source
  check (pattern: `scripts/check-version.mjs`) should pin the two **in CI** so the
  next edit cannot silently desync."
- `tasks.md` T-E39-01 item (4): "**Wire it so it is runnable the way
  `check-version.mjs` is.**"

Neither is satisfied. And the qa follow-on does not rescue it: T-E39-03 is routed at
`test/check-version.test.mjs`, whose established pattern — stated in its own header,
lines 9-16 — is to copy the real script into a temp fixture root and spawn it there,
"never touching the real repo's `package.json` / `index.ts` / `dist/index.js`". A
test in that mold proves the script's logic and still never checks the shipped tree.
T-E39-03's item (3) ("verify the check is green against the shipped tree") is a
one-time manual step, not a standing gate.

E39 exists because a mirror drifted through 9 sites with nothing watching it. A
check nobody runs reproduces exactly that condition. Fix is two lines in
`package.json`:

```json
"check:transitions-sync": "node scripts/check-transitions-sync.mjs",
"prebuild": "npm run check:version && npm run check:transitions-sync",
```

One ordering caveat to decide, not a blocker either way: the check imports from
`dist/`, so under `prebuild` it reads the *previous* build's dist. That is the same
staleness `check-version.mjs` already lives with (it also reads `dist/index.js` at
prebuild), so matching it is defensible; a `postbuild` hook would check the fresh
dist instead. Either is acceptable. Unwired is not.

### C3 — Non-blocking, but a real hole: duplicate key rows silently pass.

`scripts/check-transitions-sync.mjs:119` uses `mirrorTable.set(key, tuples)`, which
is last-write-wins, and `dataRowCount` (incremented at :114) is never reconciled
against `mirrorTable.size`. A mirror table containing the same key twice therefore
has only its *last* occurrence checked.

Verified on an isolated fixture copy of the script + dist + spec (the real tree was
never mutated):

| seeded mirror | result |
|---|---|
| wrong `\| architect \| Blocked \|` row, then the correct one | **exit 0**, "OK (21 keys, exact match)" — while the doc visibly contains a wrong row |
| correct row, then the wrong one | exit 1, "DIFFERENT allowed-entry set" |

The failure banner at :172 also reports "21 source keys, 21 mirror keys" when 22 data
rows were parsed, so the row count never surfaces the duplication either.

This matters because appending a row for a key that already exists is the most
plausible way this table re-drifts — it is the shape of the E58 edit itself (someone
adding `pm | Blocked` again rather than editing it in place). One line at :115 closes
it:

```js
if (mirrorTable.has(key)) fail(`duplicate mirror row for ${key} — the later row silently wins`);
```

### Verified clean (Correctness)

- **The 21-row re-derivation is exact.** I parsed the shipped table with my own
  order-preserving parser and diffed it against `ALLOWED_TRANSITIONS` imported from
  `dist/tools/transitions.js`: 21 keys, every entry set identical, **entry order
  within each row and key order across rows both preserved**. No missing key, no
  extra key, no set difference, no order-only difference.
- **The old-table forensics, recomputed independently** from
  `git show HEAD:specs/qa-flow-enforcement-architecture.md`: 16 rows, **5 missing
  keys** (`design-auditor:{In_Progress,Blocked}`, `code-reviewer:{In_Progress,FAIL,Blocked}`),
  **0 extra**, and — against the *pre-E58* source — **4 wrong / 12 correct**. The
  12/4/5 enumeration is confirmed exactly; three independent passes now agree. The
  reason this count has looked unstable is arithmetic, not error: measured against
  the *post*-E58 source the same old table reads 5 wrong / 11 correct, because
  `pm:Blocked` only became a wrong row at the moment this cut added the edge.
  The four genuinely-wrong rows were: `null:null` missing **both** `design-auditor`
  entries; `researcher:In_Progress` and `pm:In_Progress` each missing exactly one
  (`(design-auditor, In_Progress)`); and `sr-engineer:In_Progress` naming
  `(qa-engineer, In_Progress)` where the source has always said
  `(code-reviewer, In_Progress)`.
- **Round-cap paragraph untouched** — it appears as unchanged context in the diff
  hunk. `prev_qa_round >= 4` remains correct; `ROUND_CAP = 4` has moved to
  `tools/transitions.ts:375` (from :365 — E58's comment block shifted it ten lines),
  and no document cites that line number, so nothing needs updating.
- **E58's edge**: added at `tools/transitions.ts:216`, mirrored in the spec's
  `| pm | Blocked |` row, and legal — the destination key `design-auditor:In_Progress`
  exists and exits to `(pm, In_Progress)`, so it is not a dead end. The premise holds:
  `content/skill-pm.md:28` does stamp `next_role="design-auditor"` on a
  `status=Blocked` write, so the edge was genuinely unreachable before. **No other
  key moved** — the full-file diff of `tools/transitions.ts` and of
  `dist/tools/transitions.js` against HEAD is exactly the one added entry plus its
  comment.
- **The rewritten paragraph's citations are all exact**: `tools/registry.ts:156` is
  the `z.enum(["code-reviewer","qa-engineer"]).optional()` line; `tools/handoff-orchestrator.ts:151`
  is `next_resume_of: parsed.resume_of`; `tools/transitions.ts:44` is the
  `next_resume_of?:` field declaration and `:39-44` covers its comment. The quoted
  comment text matches the source verbatim (ellipsis correctly elides
  "(`resume_of: <target>` line)"). The v3.55.0 / backlog-C9 supersession claim
  matches `CHANGELOG.md:801,804`, and both cited spec files exist. The footnote's
  provenance ("found by code-reviewer during E37 round 1, 2026-07-27") matches
  `docs/backlog.md:165` verbatim.
- **Precedence position is correct.** Step 3.5 sits after the self-loop fast path
  (`tools/transitions.ts:521-530`) and before the static table lookup (:552) — exactly
  as the paragraph asserts, and the round caps do outrank it. See Q3 for one
  omission in that sentence.
- **Expected-red manifest** (SOP 4a): `qa_reports/expected-red_e39-e58-transition-matrix-sync.txt`
  exists and carries one entry (fewer than 3, so all sampled). The named test string
  is locatable in the named file — exactly one occurrence in `test/qa-flow.test.mjs`.
- **`npm test`: 1693 pass / 1 fail of 1694.** The single red is
  `not ok 1048 — T-E53-03(h): exhaustive matrix sweep — accepted edge set is EXACTLY
  the 68 tuples E53 leaves standing`, which is precisely the declared expected red
  and is qa-owned under T-E39-03. Confirmed as the only red.

## Quality

### Q1 — the section anchor should be line-exact. Non-blocking.

`scripts/check-transitions-sync.mjs:91` anchors on
`specSrc.indexOf("## ALLOWED_TRANSITIONS Matrix")` — an unanchored substring match.
Probes on the isolated fixture:

| probe | exit | assessment |
|---|---|---|
| heading renamed `## ALLOWED_TRANSITIONS MatrixX` | 0 | defensible — the correct table *was* located and checked |
| inline prose mention of the heading string earlier in the file | 1, "parsed ZERO data rows" | **misleading** — hard failure on a document whose mirror is perfectly correct |
| a `## ` heading inserted between the section header and the table | 1, "parsed ZERO data rows" | fails safe, same misleading message |
| one table row indented two spaces | 1, names `null:null` missing | fails safe |
| `dist/tools/transitions.js` absent | 1 | fails safe |

**My decision on the question you left open**: passing the `MatrixX` rename was
substantively correct — it found and checked the right table, so it did not lie. The
prefix match is therefore *not* a member of the E50 vacuous-pass class, and none of my
probes produced a false green from it. But it should still be line-exact, because the
failure mode it *does* have is the second row above: `indexOf` takes the first
occurrence anywhere in the file, so any prose that quotes the heading — and this repo
quotes headings constantly; `tasks.md` T-E39-01 quotes this exact one, and the script's
own error message tells readers to go look for the literal — binds the anchor to the
mention and produces a confident, wrong-cause failure on a healthy document. A
line-exact anchor has strictly fewer failure modes, no downside, and additionally pins
the heading text itself, which the script's own error message already treats as part
of the contract:

```js
const headerRe = /^## ALLOWED_TRANSITIONS Matrix\s*$/m;   // start
// end boundary: /^## /m from the match index onward
```

### Q2 — the footnote reproduces the imprecision it was meant to correct.

`specs/qa-flow-enforcement-architecture.md:173`: "`null:null` and `pm:In_Progress`
each missing both/one `design-auditor` entry". "both/one" does not tell the reader
which row got which, and this footnote is now the permanent record of what was wrong.
Ground truth from my re-derivation: `null:null` was missing **both** `design-auditor`
entries; `pm:In_Progress` and `researcher:In_Progress` were each missing exactly one,
`(design-auditor, In_Progress)`. Suggested: "`null:null` missing both `design-auditor`
entries; `researcher:In_Progress` and `pm:In_Progress` each missing
`(design-auditor, In_Progress)`; `sr-engineer:In_Progress` naming …".

### Q3 — informational, not a regression.

`:183` says step 3.5 is evaluated "after the round-cap overrides and the self-loop
fast path". True but incomplete: `HOP_CAP_EXCEEDED` (`tools/transitions.ts:504-519`,
`HOP_CAP = 10` at :388) also precedes 3.5 and also outranks the resume edge. That
clause is carried over verbatim from the pre-existing paragraph, so this diff did not
introduce it — recording it only because the precedence position was explicitly in
scope for this review. Worth a half-sentence while the paragraph is open.

### Otherwise

Script naming, comment density, and error-message style match `scripts/check-version.mjs`.
The header comment usefully records both the E48 contrast (why this artifact is
mechanizable and `docs/skills/*` is not) and the E50 hard requirement. The E58 code
comment in `tools/transitions.ts` is long but consistent with the surrounding
per-key rationale comments in that file.

## Architecture

Fits. The check reads `dist/` rather than regex-parsing the `.ts`, as the ticket
required, and follows `check-version.mjs`'s shape (root resolved from
`import.meta.url`, fail loud rather than skip, actionable exit message). No layering
change; `tools/transitions.ts` remains the single source and the spec remains a
declared mirror of it.

One invariant worth recording as verified: **the mirror is unique.** I searched
`docs/`, `specs/`, `content/`, `README.md`, and `CONTRIBUTING.md` for rows of the
mirror's shape, and `specs/qa-flow-enforcement-architecture.md` is the only file that
carries the table. This cut therefore leaves no second, still-stale mirror behind —
which also means the new check, once wired, covers the whole obligation.

C2 is arguably an architecture finding as much as a correctness one: the check is
built to the right design and then not connected to the only mechanism in this repo
that makes a `scripts/` checker load-bearing.

## Security

No findings. The script is read-only. Its dynamic `import()` target is a fixed path
derived from `import.meta.url`, never from argv, env, or file content, so there is no
injection surface; the markdown it parses is only ever matched against regexes, never
evaluated. No secrets, no new trust boundary. The `tools/transitions.ts` change adds
one literal to a static table.

## Performance

No findings. The check does two `readFileSync` calls, one dynamic import, and a
set-difference over 21 keys — O(rows) with no hot path. `tools/transitions.ts` gains
one entry in a 21-key `Map`; `validateTransition`'s per-call cost is unchanged
(`allowed.some(...)` over a 3-element array instead of 2). No regression versus base.

## Verdict

**CHANGES_REQUESTED** — the re-derived table is exactly right and E58's edge is
clean, but the newly written Amend-Resume paragraph asserts a persistence semantic
that `tools/handoff-write.ts:459` contradicts (C1 — the very defect class this ticket
exists to eliminate), and the new sync check is wired to no npm script or CI path, so
nothing will ever run it (C2 — the ticket's own AC says wire it the way
`check-version.mjs` is wired, and the backlog row asks for CI pinning). Both are
small, well-localized fixes; C3's one-line duplicate-key guard should ride along.

---

### Note to the coordinator (outside this cut, no action for sr-engineer)

An untracked `undefined/` directory sits at the repo root (`undefined/actual.txt`, a
composed-constitution dump, and `undefined/ws/.current/handoff.md` with
`active_feature: "cnso-golden-feat"`). It is debris from some ad-hoc script run with
an undefined output path. It is not part of the E39 cut and was not part of E59's
commit `25d231e`. Harmless in place, but `git add -A` at release time would sweep it
into a commit. Recommend deleting or gitignoring it.

Also for the record: E59 was committed as `25d231e` partway through this review, which
removed the E59 files from the working tree. The `npm test` run reported above was
executed against a tree carrying those same changes, so the 1693/1694 result stands.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer (opus)

sr-engineer was pinned to `fable` on both rounds (`dispatch_pins`), so writer and
reviewer remain on different models — no same-model bias caveat applies.

**Provenance discipline for this round.** The round-1 fixes arrived from two
different sr-engineer contexts: a first context applied C1/C2/C3/Q1 and died
before `tw_update_state`, and a resumed context applied only Q2/Q3. I therefore
extended trust to neither the coordinator's ground-truthing nor the resumed
context's `pending_notes`, and **re-verified all six findings from source as if
unreported** — fresh re-derivation with my own parser, fresh probe matrix against
an isolated fixture, fresh citation checks, fresh test run. Every claim below is
first-hand.

### Summary

- **All six round-1 findings are verifiably fixed.** C1's paragraph now states a
  semantic the source actually has; C2's check is wired and genuinely load-bearing
  on both the build and test paths; C3's duplicate-row false-green is closed; Q1's
  misleading-failure mode is gone with no new one introduced; Q2's footnote is
  precise; Q3's citations are exact.
- **The 21-row table and E58's edge are unchanged from round 1** — re-derived from
  scratch: 21/21 keys exact, entry order within rows and key order across rows
  both preserved, zero divergence. `tools/transitions.ts` carries exactly one
  10-line hunk versus HEAD.
- **No out-of-cut file was touched.** `docs/schema-versions.md` is clean, the
  modified/new sets match expectation exactly, and `undefined/` is gone
  (not re-flagged).
- **One new blocking finding, C4** — introduced by the Q2 fix and, importantly,
  **traceable to my own round-1 wording**: the footnote's claim that the source
  "has always said `(code-reviewer, In_Progress)`" is false, and it mis-diagnoses
  the drift mechanism that justifies the very check this ticket ships. One-clause
  fix; exact replacement text supplied.
- Verdict: **CHANGES_REQUESTED** on C4 alone. Everything else is explicitly
  cleared and needs no re-verification in round 3.

### Correctness

#### C4 — BLOCKING (new). The footnote asserts a source history that git contradicts.

`specs/qa-flow-enforcement-architecture.md:173`:

> `sr-engineer:In_Progress` wrongly naming `(qa-engineer, In_Progress)` where the
> source **has always said** `(code-reviewer, In_Progress)`

The source has not always said that. History, verified directly:

- `7e81cf7^` (pre-v3.9.0) — `tools/transitions.ts:117-121` has
  `["sr-engineer:In_Progress", [{ agent: "qa-engineer", status: "In_Progress" }, …]`.
- `7e81cf7` (v3.9.0, 2026-05-28, *"code-reviewer role extraction (sr → code-reviewer
  → qa chain)"*) — the same key becomes
  `{ agent: "code-reviewer", status: "In_Progress" }`.
- The mirror row was authored once, in `6485c37` (the original architecture doc),
  and **never touched again**: `git show 7e81cf7^:specs/…` and
  `git show 7e81cf7:specs/…` both print the identical
  `| sr-engineer | In_Progress | (qa-engineer, In_Progress), … |` at line 158.

So the row was **correct when written** and went stale at v3.9.0, when the
role-extraction refactor changed the source and left the mirror behind.

This is blocking for two reasons, neither of them cosmetic:

1. It is the same defect class E39 exists to eliminate — spec text asserting
   something the source contradicts — landing in the footnote that is E39's
   *permanent forensic record* of that exact defect class. C1 was blocked in round
   1 on this principle; the principle does not weaken because the false claim is
   historical rather than current.
2. It mis-states the **mechanism**, which is the part that carries the lesson.
   "Always wrong" reads as a transcription error, for which a one-time re-derivation
   suffices. The truth is refactor-induced staleness — a correct mirror silently
   invalidated by an edit elsewhere — which is precisely why a *standing* check
   wired into `postbuild` is the right remedy rather than a one-off correction. The
   backlog row itself frames it this way and never claims otherwise
   (`docs/backlog.md:165`: "`sr-engineer | In_Progress` **still lists** qa-engineer
   as a successor").

**The wording is mine.** It came verbatim from my round-1 "Verified clean" bullet
and my Q2 suggested replacement; "always" was an unverified flourish I did not
check against history, and the sr-engineer applied the reviewer's dictated text
faithfully. There is no process fault on the writer here. I am nonetheless blocking
rather than filing it as a note, because an APPROVED verdict would leave a
known-false statement with **no owner** — qa owns tests (T-E39-03), doc-writer runs
post-PASS on README/CHANGELOG — and this repo's own E37→E39 history is the proof
that an unowned spec inaccuracy survives indefinitely. Correcting it also makes the
record strictly more useful.

Exact replacement for that clause (nothing else in the footnote changes):

> `sr-engineer:In_Progress` naming `(qa-engineer, In_Progress)` — correct when the
> table was authored, but silently invalidated at v3.9.0 (`7e81cf7`), which extracted
> the code-reviewer role and changed the source to `(code-reviewer, In_Progress)`
> without updating this mirror

#### C1 — FIXED. Verified against source, clause by clause.

`specs/qa-flow-enforcement-architecture.md:179` now reads write-scoped / never
carried forward / SQLite never persists / nothing reads it back. Every clause holds:

- *"emitted to `handoff.md` only on the write that sets it"* — `tools/handoff-write.ts:459`,
  `if (resumeOf) frontmatterData.resume_of = resumeOf;`, guarded on the incoming value.
- *"never carried forward — `writeHandoffState` deliberately does not join it to the
  existing-state preserve read"* — confirmed structurally, not just by comment:
  `resumeOf` occurs exactly three times in the whole file (`:113` declaration,
  `:186` `const resumeOf = opts.resumeOf`, `:459` emit). It never touches `existing`,
  which is read at `:350` and feeds only `prd_path` / `scope_decision` /
  `cut_approved` / `external_refs` / `dispatch_pins` / `dispatch_mode`. There is no
  `effectiveResumeOf`. The `:440-444` comment ("Deliberately NOT joined to the
  existing-state preserve read") and the type-level note at `:106-112` both agree.
  The cited range `:440-459` is exact.
- *"SQLite mode never persists it at all (DR-5)"* — `tools/storage-sqlite.ts:493`
  documents the omission and grep finds no other `resume` handling in that file.
- *"Nothing reads it back off state; `validateTransition` sees only the incoming
  write's value"* — grep across `tools/ gates/ schema/ prompts/ guards/`: no
  consumer reads a persisted `resume_of`. `validateTransition` receives
  `next_resume_of` from `parsed.resume_of` (`tools/handoff-orchestrator.ts:151`),
  i.e. the incoming write. The one other `next_resume_of` site,
  `tools/handoff-orchestrator.ts:1312`, *synthesizes* a hypothetical value inside
  `effectiveAllowedSuccessors` — it does not read state either.

The round-1 defect ("never persisted to `handoff.md`", falsified by `:459`) is gone
and the replacement is accurate about both storage modes.

#### C2 — FIXED, and the `postbuild` variant is the better choice. Wiring is load-bearing.

`package.json:14,17` add `check:transitions-sync` and `postbuild`. Verified by
execution, not inspection:

- `npm run build` → `prebuild` (check:version) → `tsc` → `postbuild` →
  `check:transitions-sync — OK (21 keys, exact match …)`. Fires.
- `npm test` → `pretest` → `npm run build` → nested lifecycle including `postbuild`.
  Fires. Confirmed load-bearing on a minimal npm fixture: with a *failing* check,
  `npm test` exits **1** and the `test` script never runs (`TESTS-ACTUALLY-RAN`
  never printed).
- `.github/workflows/ci.yml` runs `npm run build` **and** `npm test`, so the check
  is exercised in CI on both Node 20 and 22. The backlog's "pin the two in CI" and
  T-E39-01 item (4) are both satisfied.

On the `postbuild`-vs-`prebuild` question I left open in round 1 — `postbuild` has
**no failure mode `prebuild` lacks**, and avoids one that `prebuild` has:

| scenario | `postbuild` (shipped) | `prebuild` (my round-1 suggestion) |
|---|---|---|
| normal build | checks the **fresh** dist | checks the **previous** build's stale dist |
| `tsc` fails | check skipped — but `npm run build` still exits 1, so no vacuous pass (fixture-verified: exit 1, check never ran) | check runs, then build fails anyway |
| dist absent (hypothetical fresh clone without committed `dist/`) | fine — dist exists by the time it runs | **deadlock**: the check hard-fails "run `npm run build` first", and `prebuild` is what blocks the build |
| `tsc` invoked directly, outside npm | bypassed | bypassed (no asymmetry) |
| `npm ci` | not run (no `prepare` script) | not run (no asymmetry) |

The "`tsc` fails ⇒ check skipped" row is the only behavioral loss, and it costs
nothing: the command already exits non-zero, so the check can never appear green
without having run. `postbuild` is the correct call and the script's header comment
at `:26-37` documents the reasoning accurately.

#### C3 — FIXED. All three duplicate shapes now fail; the round-1 false green is closed.

Guard at `scripts/check-transitions-sync.mjs:145-147`, ahead of `mirrorTable.set`.
Re-ran the round-1 fixture probes (isolated fixture root; the real tree was never
mutated):

| seeded mirror | round 1 | round 2 |
|---|---|---|
| wrong `\| architect \| Blocked \|` row **first**, correct second | **exit 0** — "OK (21 keys, exact match)" while the doc visibly contained a wrong row | **exit 1** — "duplicate mirror row for architect:Blocked — the later row silently wins" |
| correct first, wrong second | exit 1 | exit 1 — duplicate message **and** the entry-set diff |
| two identical correct rows | (untested) | exit 1 — duplicate message |

The last row is worth noting as deliberate strictness: even a *benign* duplicate
fails, because `has(key)` is checked before `set`. That is the right polarity for a
table whose whole contract is one row per key.

#### Verified clean (Correctness)

- **Re-derivation is exact, independently.** My own order-preserving parser against
  `ALLOWED_TRANSITIONS` imported from `dist/tools/transitions.js`: **21 source keys,
  21 mirror rows, 21 mirror keys, correct=21, wrong=0, missing=0, extra=0, zero
  order-only differences, key order across rows identical.** Byte-identical outcome
  to round 1.
- **The 12/4/5 forensics reproduce exactly.** HEAD's 16-row table against HEAD's
  pre-E58 source: **12 correct / 4 wrong / 5 missing / 0 extra**, with the four wrong
  rows being precisely `null:null` (missing both `design-auditor` entries),
  `researcher:In_Progress` and `pm:In_Progress` (each missing exactly
  `(design-auditor, In_Progress)`), and `sr-engineer:In_Progress`
  (`(qa-engineer, In_Progress)` vs source's `(code-reviewer, In_Progress)`). The
  same old table against the *post*-E58 source reads 11 correct / 5 wrong, because
  `pm:Blocked` only became wrong when this cut added the edge — the arithmetic
  reconciliation from round 1 holds.
- **E58's edge is unchanged and correctly mirrored.** `tools/transitions.ts` shows a
  single hunk versus HEAD: 10 insertions, 0 deletions — a 9-line comment plus
  `{ agent: "design-auditor", status: "In_Progress" }` inside `["pm:Blocked", …]`.
  `dist/tools/transitions.js` carries exactly the compiled mirror of that one hunk.
  No other key moved. The `pm | Blocked` spec row lists all three entries.
- **Nothing shifted in `tools/transitions.ts` across the two sr contexts.**
  Independent confirmation via the round-1 fingerprint: `ROUND_CAP = 4` is at `:375`,
  exactly where round 1 recorded it after E58's 10-line insertion (from `:365`);
  `REVIEW_ROUND_CAP` `:376`, `VISUAL_ROUND_CAP` `:381`, `HOP_CAP` `:388`.
- **Round-cap paragraph untouched** — `specs/…:177` still reads `prev_qa_round >= 4`,
  appearing as unchanged context in the diff. Correct, and correctly left alone.
- **Expected-red manifest** (SOP 4a): one entry, so all sampled. The named test
  string is locatable in the named file — exactly one occurrence in
  `test/qa-flow.test.mjs`.
- **`npm test`: 1694 tests, 1693 pass, 1 fail.** Sole red is
  `not ok 1048 — T-E53-03(h): exhaustive matrix sweep — accepted edge set is EXACTLY
  the 68 tuples E53 leaves standing`, matching
  `qa_reports/expected-red_e39-e58-transition-matrix-sync.txt` exactly. Independently
  reproduced.
- **Cut hygiene is clean.** Modified: `specs/qa-flow-enforcement-architecture.md`,
  `tools/transitions.ts`, `package.json`, `dist/tools/transitions.{js,js.map,d.ts.map}`,
  `.current/handoff.md`. New: `scripts/check-transitions-sync.mjs`,
  `qa_reports/expected-red_*`, `review_reports/review_T-E39-01.md`,
  `.current/feature-split.md`. `docs/schema-versions.md` is absent from the diff —
  the revert is confirmed. `undefined/` is gone. No unexpected file, tracked or
  untracked.

### Quality

#### Q1 — FIXED. The misleading failure is gone; no new failure mode introduced.

`scripts/check-transitions-sync.mjs:110-123` — `headerRe = /^## ALLOWED_TRANSITIONS Matrix\s*$/m`
with `.exec`, end boundary via `indexOf("\n## ", …)`. Full probe matrix re-run on the
isolated fixture:

| probe | round 1 | round 2 | assessment |
|---|---|---|---|
| inline prose mention of the heading earlier in the file (mid-line) | **1** — "parsed ZERO data rows" on a healthy doc | **0** | the misleading-failure mode is **gone** |
| prose line *starting* with the heading text plus more words | (untested) | **0** | `\s*$` correctly refuses to bind |
| heading renamed `## ALLOWED_TRANSITIONS MatrixX` | 0 | **1** — "could not find a line-exact … heading" | deliberate tightening, accurately messaged |
| `## ` heading interposed before the table | 1 | **1** — "parsed ZERO data rows" | fails safe, unchanged |
| one table row indented two spaces | 1 (named `null:null`) | **1** — names `architect:Blocked` | fails safe, and now names the right key |
| real heading with trailing whitespace | — | **0** | `\s*` tolerance is load-bearing and works |
| `### ` subsection between header and table | — | **0** | benign; `"\n## "` correctly does not match `"\n### "` |
| `dist/tools/transitions.js` absent | 1 | **1** | fails safe |

The `MatrixX` behavior change is the intended consequence, not a regression: the
heading text is part of the contract (the script's own error messages at `:115` and
`:202-203` say so), and the failure names the real cause. No probe produced a false
green.

I also checked the end-boundary arithmetic for a subtle hazard: `\s*$` can consume
the newline after the heading, so `headerMatch[0].length` sometimes includes it. It
cannot skip a subsequent `"\n## "`, because backtracking always leaves the match
ending at-or-before a newline — verified by construction and by the interposed-heading
probe, which correctly truncates the section to zero rows.

**`headerMarker` is not dead**: `:103` is consumed at `:115` and `:153`, in both
error messages. Retaining it is correct — inlining the pattern twice would be worse.

#### Q2 — FIXED for precision; see C4 for the one clause that is still wrong.

The per-key breakdown at `:173` now matches my re-derivation exactly: `null:null`
missing **both** `design-auditor` entries; `researcher:In_Progress` and
`pm:In_Progress` each missing exactly `(design-auditor, In_Progress)`;
`sr-engineer:In_Progress` naming `(qa-engineer, In_Progress)`. The round-1
"both/one" ambiguity is resolved.

Survived unchanged, as required: the **12/4/5 counts** (all three verified against
source), the **21-keys** claim, the **E37-round-1 provenance line** ("found by
code-reviewer during E37 round 1, 2026-07-27" — verbatim against
`docs/backlog.md:165`), and the **check-script sentence**. Only the "has always
said" clause is defective (C4).

#### Q3 — FIXED. Citations and ordering are exact.

`specs/…:183` now names `HOP_CAP_EXCEEDED`. Verified against current source:

- `HOP_CAP = 10` at `tools/transitions.ts:388` — **exact**.
- `tools/transitions.ts:494-518` — `:494` opens the `// 2.5 hop-cap override` comment
  block, `:505-518` is the guard, `:518` its closing brace. **Exact and well chosen**
  (better than my round-1 `:504-519`).
- Asserted ordering — "step 3.5 … after the round-cap overrides, the hop-cap
  override …, and the self-loop fast path, before the static-table lookup" — matches
  the source exactly: round caps (through `:492`) → hop cap (`:505-518`) → self-loop
  fast path (`:520-528`) → step 3.5 resume edge (`:530-548`) → table lookup
  (`:550-553`). "The round caps and the hop cap therefore both outrank the resume
  edge" is correct.

The rewritten paragraph's other citations re-verified: `tools/registry.ts:156` is the
`z.enum(["code-reviewer","qa-engineer"]).optional()` line;
`tools/handoff-orchestrator.ts:151` is `next_resume_of: parsed.resume_of`;
`tools/transitions.ts:44` is the `next_resume_of?:` declaration with `:39-44` covering
its comment.

#### N1 — informational. The Q1 comment's evidence is misaddressed.

`scripts/check-transitions-sync.mjs:104-109` justifies the line-exact anchor with
"(this repo has one — `tasks.md` T-E39-01 quotes this exact heading)". The script only
ever parses `specs/qa-flow-enforcement-architecture.md`, which today contains exactly
**one** occurrence of the string, at `:145` — the real heading. The other occurrences
live in `tasks.md`, `specs/pm-repair-resume-routing.md:163`, and
`specs/pm-repair-resume-routing-architecture.md:87`, none of which the script reads,
so the in-file hazard is prospective rather than actual. The fix remains correct and
worth keeping — a future prose mention inside this spec is entirely plausible — only
the parenthetical's evidence points at the wrong file. This framing also came from my
round-1 report. No action required; noted so the comment is not read as describing a
live condition.

#### N2 — informational. Residual anchor edge case, fails safe.

A fenced code block containing the exact line `## ALLOWED_TRANSITIONS Matrix`
*before* the real heading binds the anchor to the decoy and yields "parsed ZERO data
rows" (exit 1). This is strictly narrower than the class Q1 closed, behaves identically
under the old `indexOf`, no such fence exists in the file, and it fails safe rather
than green. No action.

#### N3 — informational. `dataRowCount` is still never surfaced.

The failure banner at `:200-203` reports "21 mirror keys" even when 22 data rows were
parsed. Harmless now that the duplicate guard names the offending key explicitly, so
the message is no longer capable of misleading. No action.

#### N4 — round-1 errata, for the record.

Round 1 placed E58's entry at `tools/transitions.ts:216`; it is at `:218` (the comment
block is 9 lines, not 7). Round 1 cited `HOP_CAP_EXCEEDED` at `:504-519`; `:494-518`
is the better range. Both were my arithmetic, not file movement — the 10-line hunk and
`ROUND_CAP` at `:375` prove the file is unchanged. No document cites either line, so
nothing needs updating.

#### Otherwise

Script naming, comment density, and error-message style continue to match
`scripts/check-version.mjs`. The `postbuild` rationale in the header comment
(`:26-37`) is accurate in every particular I checked, including the
`pretest → build → postbuild` chain.

### Architecture

Unchanged from round 1, and C2's resolution completes the picture: the check now sits
on the only mechanism in this repo that makes a `scripts/` checker load-bearing, and
it covers the whole obligation (the mirror is unique — re-confirmed: one line-exact
heading occurrence, in one file). `tools/transitions.ts` remains the single source;
the spec remains a declared, now machine-pinned mirror.

The `postbuild` placement is a small, well-argued departure from `check-version.mjs`'s
`prebuild` precedent, justified by a real difference between the two invariants (a
version literal does not change mid-edit; a transition table does). The divergence is
documented at the call site. Fits.

#### N5 — out of cut, for the coordinator/backlog.

`tools/handoff-orchestrator.ts:1268` and `:1692` both cite "transitions.ts:417-422"
for the hop cap. The hop-cap block is at `:494-518` and `HOP_CAP` at `:388`; those
citations are stale. Pre-existing at HEAD (confirmed via `git show`), so **not** this
diff's defect and correctly outside this cut. Same drift class as E39 but in a code
comment, which the new check cannot catch — worth a backlog row.

### Security

No findings, unchanged from round 1. The script is read-only; its dynamic `import()`
target is derived from `import.meta.url`, never from argv, env, or file content; the
markdown is only ever matched against regexes. The new duplicate guard and the
`headerRe` anchor add no input surface — `headerRe` is a literal pattern, not
constructed from data. `package.json` gains two script entries invoking a
repo-local path with no interpolation. No secrets, no new trust boundary.

### Performance

No findings. The duplicate guard adds one `Map.has` per row (21 rows). The anchor
change swaps one `indexOf` for one anchored `.exec` plus one `indexOf` — same
complexity class. The check adds ~0.1 s to `npm run build` / `npm test`, measured
against a 42 s suite. `tools/transitions.ts` gains one entry in a 21-key `Map`;
`validateTransition`'s per-call cost is a 3-element `some(...)` instead of 2. No
regression versus base.

### Verdict

**CHANGES_REQUESTED** — all six round-1 findings (C1, C2, C3, Q1, Q2, Q3) are
verified fixed from source, the 21-row table and E58's edge re-derive exactly, the
check is wired and provably load-bearing in CI, the cut is hygienic, and the test
result matches the declared expected-red. The single surviving defect is **C4**: the
Q2 footnote asserts the source "has always said `(code-reviewer, In_Progress)`",
which `7e81cf7` (v3.9.0) falsifies — the mirror row was correct when authored and
went stale in a role-extraction refactor. That is the same spec-contradicts-source
defect class E39 exists to close, sitting in E39's own forensic record, and it
mis-states the mechanism that justifies the standing check. The wording originated in
my round-1 report, so no process fault attaches to the writer; exact replacement text
is given under C4, and it is the **only** change round 3 needs.

#### Notes for qa-engineer (T-E39-03 — not sr defects, no action for this round)

- The E53 sweep needs its `EXPECTED` array extended by the single tuple
  `pm:Blocked → design-auditor:In_Progress`, per the expected-red manifest.
- `scripts/check-transitions-sync.mjs` has no test coverage. Worth pinning at least
  the three behaviors this review exercised by hand, all of which are the script's
  actual contract: the duplicate-row guard, the line-exact anchor (heading-rename
  fails, prose-mention passes), and the empty-parse/missing-dist hard failures. Per
  `test/check-version.test.mjs`'s established pattern, drive it from a temp fixture
  root rather than the real tree. Test ownership is qa's under §2 — recording this as
  routing information, not as a finding against this diff.

---

## Round 3 — APPROVED — by code-reviewer (opus)

sr-engineer was pinned to `fable` on all three rounds (`dispatch_pins`), so writer
and reviewer stayed on different models throughout — no same-model bias caveat
applies to any round of this review.

Scope discipline for this round: round 2 was CHANGES_REQUESTED on **C4 alone**, and
C1/C2/C3/Q1/Q2/Q3 were verified fixed from source there. This round re-verifies the
C4 clause, the untouched remainder of the footnote, cut containment, and the
build/test result. C1–C3 and Q1–Q3 are **not** re-opened.

### Summary

- **C4 is fixed, and the new clause is accurate in both directions.** Every factual
  component re-verified against git first-hand: `7e81cf7^` reads `qa-engineer`,
  `7e81cf7` is v3.9.0 *"code-reviewer role extraction"* and is the commit that
  changed it, and the mirror row is **byte-identical across all twelve commits** that
  ever touched the spec file, from `6485c37` through HEAD. It does not over-claim in
  the opposite direction either — see C4-R3.
- **Dropping "wrongly" was correct**, and is not in fact a deviation: my round-2
  dictated replacement text already omitted the word. Ruling under R1.
- **The "4 wrong" / "correct when authored" enumeration is legible as written.** No
  added word is needed; the sentence already carries three explicit time markers.
  Ruling under R2.
- **Exactly one clause moved.** The rest of the footnote holds, and I re-derived its
  load-bearing claims from scratch rather than trusting continuity: 21/21 keys exact,
  and the 12/4/5 forensics with the full per-key breakdown reproduce precisely.
- **Cut containment confirmed independently of any self-report**, by file mtime:
  `specs/qa-flow-enforcement-architecture.md` is the only cut file with an mtime in
  this round's window.
- **Build green** with `postbuild` printing `OK (21 keys, exact match)`; **`npm test`
  1693/1694** with `T-E53-03(h)` the sole red, matching the manifest.
- Verdict: **APPROVED**. Three informational notes (N6–N8), none blocking, two of
  them routed to the coordinator rather than to qa.

### Correctness

#### C4-R3 — FIXED. The clause is accurate, and does not over-claim in reverse.

`specs/qa-flow-enforcement-architecture.md:173` now reads:

> `sr-engineer:In_Progress` naming `(qa-engineer, In_Progress)` — correct when the
> table was authored, but silently invalidated at v3.9.0 (`7e81cf7`), which extracted
> the code-reviewer role and changed the source to `(code-reviewer, In_Progress)`
> without updating this mirror

Component-by-component, verified first-hand this round:

| claim | verification | verdict |
|---|---|---|
| `7e81cf7` is v3.9.0 and extracted code-reviewer | `git log -1`: *"chore(release): v3.9.0 — code-reviewer role extraction (sr → code-reviewer → qa chain)"* | exact, incl. the commit subject the clause paraphrases |
| `7e81cf7` is the commit that changed the source | `7e81cf7^:tools/transitions.ts:117-121` = `{ agent: "qa-engineer" … }`; `7e81cf7:…:119-123` = `{ agent: "code-reviewer" … }` | exact — the change is in that commit, not merely released by it |
| the mirror was not updated there | `833241b`, `7e81cf7` absent from `git log -- specs/qa-flow-enforcement-architecture.md` | confirmed |
| "without updating this mirror" / never touched | the row is **byte-identical at all 12 commits** that touched the spec file (`6485c37`, `63a3348`, `3d3688c`, `d5b4c72`, `c8c8c4c`, `fa5031f`, `645ddaf`, `6ce344e`, `4e0b525`, `ad617da`, `7b33f90`, HEAD) | confirmed, stronger than round 2's two-commit sample |
| "correct when the table was authored" | see below | confirmed, and stronger than the clause claims |

**On the over-claim risk you asked me to rule on specifically.** The failure mode to
watch for was the clause swinging from "always wrong" to an equally unverified
"verified correct at authoring". It does not, and the history turns out to *support*
the wording more strongly than round 2 established:

At `6485c37` — the commit that authored this table — `tools/transitions.ts` contained
**no transition map at all**. Its header read: *"T03 scope: requireQaEngineer helper
only. T08-T10 will add the full ALLOWED_TRANSITIONS map, validateTransition, and
computeNewRound."* The table was written as the **design specification**, and the
implementation followed at `ebc4e49` (v3.2.0), which landed
`["sr-engineer:In_Progress", [{ agent: "qa-engineer", … }, …]]` — identical to the
row. `833241b` (v3.8.0) left that key untouched. So the row agreed with the source
from the moment a source existed until `7e81cf7`.

"Correct when the table was authored" is therefore true on the strongest available
reading, and notably it does **not** assert the inverse errors it could have: it does
not claim the source ever said `qa-engineer` "always", does not claim the doc was
ever authoritative-and-later-demoted, and does not date the correctness window more
precisely than the evidence supports. The clause is exactly as strong as the facts.

#### R1 — Ruling: dropping "wrongly" was right, and was not a deviation.

sr flagged this as its one deliberate departure. Two independent reasons it stands:

1. **It matches my dictated text.** My round-2 C4 replacement began *"`sr-engineer:In_Progress`
   naming `(qa-engineer, In_Progress)` — correct when …"*. There was no "wrongly" in
   it. sr applied the dictated text literally; what it dropped was a word from the
   **old** clause that the replacement never carried. The `pending_notes` framing
   ("dropped the stale word") is accurate about the edit and slightly over-modest
   about its fidelity — this is a literal paste, not a judgement call I need to bless.
2. **The reasoning offered is correct on its own merits.** "Wrongly naming X —
   correct when the table was authored" contradicts itself inside one clause. Keeping
   the word to preserve literal continuity with the old sentence would have been the
   wrong instinct; a reviewer's dictated text is a specification of intent, not a
   string to concatenate. Had sr kept it, I would have raised it.

#### R2 — Ruling: the "4 wrong" enumeration needs no added word.

The coordinator's question — does *"4 wrong ( … correct when the table was authored
… )"* read as self-contradictory to someone who has not read this review — is a fair
one to raise, and my answer is no. The sentence already carries three explicit time
markers and one bridge:

> "**Previously** this table carried 16 rows — 12 correct, 4 wrong (… `sr-engineer:In_Progress`
> naming `(qa-engineer, In_Progress)` — correct **when the table was authored**, but
> silently **invalidated at v3.9.0** …)"

- "**Previously** this table carried … 4 wrong" time-stamps the enumeration to
  *immediately before this cut*. It is not a timeless claim.
- "**when the table was authored**" explicitly marks a different, earlier index.
- "**silently invalidated**" is the bridge: *invalidated* means "became wrong",
  which is precisely the wrong-now/correct-then relation the reader needs. A word
  that means "was always wrong" cannot be read into it.

Adding a hedge ("wrong as of this cut, though correct when written") would restate
what "previously … invalidated" already says, lengthen the longest clause in an
already-dense parenthetical, and — worse — imply the distinction is subtle when the
sentence has already drawn it. My ruling: leave it. The one genuine imprecision in
this enumeration is a different one, and it is not the clause's fault; see N6.

#### Verified clean (Correctness) — re-derived, not carried forward

- **The 21-row table is exact.** Fresh run of my own order-preserving parser against
  `ALLOWED_TRANSITIONS` imported from `dist/tools/transitions.js`: **21 source keys,
  21 rows parsed, 21 distinct keys, 0 duplicate rows, correct=21, wrong=0, missing=0,
  extra=0, zero order-only differences, key order across rows identical.** Third
  consecutive round with a byte-identical outcome.
- **The 12/4/5 counts and the per-key breakdown reproduce exactly.** HEAD's 16-row
  table against the pre-E58 source: **12 correct / 4 wrong / 5 missing / 0 extra**,
  with the wrong rows being exactly `null:null` (missing **both** `design-auditor`
  entries), `researcher:In_Progress` and `pm:In_Progress` (each missing exactly
  `design-auditor:In_Progress`), and `sr-engineer:In_Progress` (extra entry
  `qa-engineer:In_Progress`, missing `code-reviewer:In_Progress`). The footnote's
  wording matches this ground truth clause for clause. Against the *post*-E58 source
  the same table reads 11 correct / 5 wrong — the round-1 arithmetic reconciliation
  still holds, and the footnote correctly states the pre-E58 figure.
- **The rest of the footnote is intact and independently correct**: the 21-keys
  claim, the 12/4/5 counts, the Q2 per-key `design-auditor` breakdown, the provenance
  line (*"found by code-reviewer during E37 round 1, 2026-07-27"* — re-checked
  verbatim against `docs/backlog.md:165`), and the `scripts/check-transitions-sync.mjs`
  sentence. On that last one: *"so it cannot silently re-drift"* is a fair claim, not
  an over-claim — the check is on `postbuild`, and CI runs both `npm run build` and
  `npm test`, so a one-sided edit cannot reach main green.
- **Nothing else in the file moved.** The spec's diff is two hunks: the table
  re-derivation, and the footnote + Amend-Resume rewrite. The round-cap paragraph
  (`prev_qa_round >= 4`) and the self-loop paragraph both appear as unchanged
  context. The Amend-Resume paragraph is unchanged from the round-2 text I cleared.
- **`tools/transitions.ts`: one hunk, 10 insertions, 0 deletions** — the 9-line E58
  comment plus `{ agent: "design-auditor", status: "In_Progress" }` in `["pm:Blocked", …]`.
  `dist/tools/transitions.js` carries exactly the compiled mirror. No other key moved.
- **`package.json`: 2 insertions, 0 deletions** — `check:transitions-sync` and
  `postbuild`. Unchanged from round 2.
- **Cut containment, verified by mtime rather than by self-report** (the check that
  does not depend on trusting anyone's account of what they touched):

  | file | mtime | round |
  |---|---|---|
  | `specs/qa-flow-enforcement-architecture.md` | 16:19:12 | **this round** |
  | `package.json` | 15:56:07 | round 2 |
  | `scripts/check-transitions-sync.mjs` | 15:56:32 | round 2 |
  | `tools/transitions.ts` | 12:03:53 | round 1 |
  | `qa_reports/expected-red_*` | 12:07:21 | round 1 |
  | `docs/backlog.md` | 16:20:03 | coordinator (E62), post-edit |

  Exactly one cut file carries a this-round mtime, and it is the one clause's file.
  `docs/schema-versions.md` is absent from the diff entirely — the revert holds.
- **Expected-red manifest** (SOP 4a): `qa_reports/expected-red_e39-e58-transition-matrix-sync.txt`
  carries one entry, so all sampled. `T-E53-03(h)` is locatable in
  `test/qa-flow.test.mjs`.
- **Build and test, run first-hand this round.** `npm run build` exits 0, with
  `prebuild → check:version OK (3.98.0)`, `tsc`, then
  `postbuild → check:transitions-sync — OK (21 keys, exact match between
  dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)`.
  `npm test`: **# tests 1694 / # pass 1693 / # fail 1**, the single red being
  `not ok 1048 - T-E53-03(h): exhaustive matrix sweep …` — exactly the manifest's
  declared entry, and the only red in the run.

### Quality

#### N6 — informational. The footnote gives one wrong row a history and three none.

Not a defect in what the clause asserts, and **not blocking** — recorded because it
is the one place this footnote is still less useful than it could be, and because I
only established the fact while verifying C4.

All four wrong rows and all five missing keys trace to exactly **two** role-extraction
refactors, neither of which touched the spec:

| refactor | source change | mirror drift caused |
|---|---|---|
| `833241b` v3.8.0 — *"design-auditor role"* | added `design-auditor` to `null:null` (both), `researcher:In_Progress`, `pm:In_Progress`; added the 2 `design-auditor:*` keys | 3 of the 4 wrong rows + 2 of the 5 missing keys |
| `7e81cf7` v3.9.0 — *"code-reviewer role extraction"* | `sr-engineer:In_Progress` → `code-reviewer`; added the 3 `code-reviewer:*` keys | 1 wrong row + 3 missing keys |

So *every* drift site in this table is refactor-induced staleness, and the three
`design-auditor` omissions were equally "correct when authored". The footnote states
this history for the v3.9.0 row only, which a careful reader could take to imply the
other three were born wrong. Nothing false is asserted — the footnote says only what
each row was missing, and is silent on when — so this is incompleteness, not the
C4 defect class, and blocking on it would reverse my own round-2 statement that C4
was the only change round 3 needs. The facts are durably recorded here; if anyone
reopens this footnote, one clause ("both role extractions — `833241b` v3.8.0 and
`7e81cf7` v3.9.0 — changed the source and left this mirror behind") would make it the
complete forensic record and would strengthen the standing-check argument further,
since it makes the pattern recurring rather than singular.

#### N7 — informational, for the coordinator. `:148` still calls this table the "Authoritative source".

`specs/qa-flow-enforcement-architecture.md:148`, three lines above the table, reads
*"Authoritative source. Key: `(prev_agent, prev_status)` → …"*. It is pre-existing,
appears as unchanged context in this diff, and `tools/transitions.ts:3-4` says the
opposite — the spec table is the declared **mirror** of `ALLOWED`. The new footnote
also says mirror. So the document calls itself authoritative in one line and a
machine-pinned mirror in the next paragraph.

Worth flagging now for a reason specific to this cut: the cut **changes the
consequence** of that stale word. Before, a contributor who trusted "Authoritative
source", edited the table, and expected the code to follow would produce silent
drift. Now `postbuild` hard-fails and reports the doc as wrong — a loud, correctly-
diagnosed failure, but one that contradicts the sentence that invited the edit.

Not blocking, and deliberately so: it is pre-existing (I read it as diff context in
rounds 1 and 2 and did not raise it), round 3's scope was one clause, and the failure
mode is a loud build failure rather than a silently wrong rule. It is a two-word
content fix ("Authoritative source" → "Mirror of `ALLOWED_TRANSITIONS` in
`tools/transitions.ts` — machine-checked, see the footnote below"), cheap enough for
the coordinator to apply directly or to fold into the E61/E62 content-only batch.

#### N8 — informational, for the coordinator. E62 is well-framed; one addition to its scope.

Reviewed as a note only, per the brief — it had no bearing on the verdict.

The row reads accurately. It attributes the two-site version to my round-2 note,
states plainly that the coordinator's own grep found five, and prefers option (ii)
(symbol/anchor citations) over a second checker. I agree with (ii) for the stated
reason and for one more: option (iii) would have to resolve citations in files the
transition table has no relationship to, so its blast radius exceeds its value for a
class whose worst outcome is a reader landing in the wrong place. Excluding
`review_reports/**` as dated evidence is right, and is the same principle that makes
E56's DR-2 amendment a one-time write rather than a checked invariant. It does not
mis-frame my finding; if anything it strengthens it by measuring past where I stopped.

I spot-checked two of the five sites rather than take them on faith:

- `tools/handoff-orchestrator.ts:1674` does cite `transitions.ts:432-440` for the
  self-loop fast path. `:432-440` is now inside a **doc-comment block** that
  *describes* the fast path (`:438` = `*   3. self-loop fast path on same-agent
  In_Progress→In_Progress`), while the implementation is at `:520`. Stale as measured,
  with the mild extra hazard that it now lands on prose that looks like a hit.
- `specs/qa-visual-consolidation.md:181` does cite `tools/transitions.ts:408` for the
  `visual_fail:` prefix check; the real site is `:642-646`. Stale as measured.

**The one thing E62 should add**: this cut's Amend-Resume paragraph *creates* seven
new line-number citations, four of them into `tools/transitions.ts` itself — `:39-44`,
`:44`, `:494-518`, and `HOP_CAP = 10` at `:388`, plus `tools/registry.ts:156`,
`tools/handoff-orchestrator.ts:151`, `tools/handoff-write.ts:440-459`. All are exact
today (verified in round 2, re-confirmed here), so they are not defects — and they
exist because **I** asked for them, in C1's replacement text and in Q3. But they are
new instances of exactly the class E62 exists to close, in the exact file E62 is
about, added by the very cut E62 cites as the exemplar of option (ii). E62 should
either count them among its sites or state explicitly that precise line cites are
retained where a reviewer required them. Left as-is they will be the largest new
debt the moment `transitions.ts` next moves — and E62's own row notes that E58's
comment block already shifted that file by ten lines once.

#### Otherwise

No new quality findings. Round 2's N1–N5 stand as recorded and none was re-opened.

### Architecture

Unchanged and unaffected. This round moved prose inside one footnote; no layering,
interface, or control-flow surface was touched. The architecture position cleared in
round 2 holds: `tools/transitions.ts` is the single source, the spec table is a
declared and now machine-pinned mirror of it, the mirror is unique in the repo, and
the check sits on the one mechanism (`postbuild`, reached by both `npm run build` and
`npm test`, both of which CI runs) that makes a `scripts/` checker load-bearing.

N7 is arguably an architecture note as much as a quality one — the document's
self-description at `:148` inverts the source-of-truth relationship the rest of the
cut establishes — but it is pre-existing text and out of this round's scope.

### Security

No findings. This round's change is prose inside a markdown comment-style footnote:
no code, no input surface, no new trust boundary, no secret. The round-2 security
position (read-only script, `import()` target derived from `import.meta.url` and never
from argv/env/file content, markdown only ever regex-matched, `package.json` gaining
two entries with no interpolation) is unchanged and re-affirmed.

### Performance

No findings. No executable line changed this round. Re-measured for the record: the
`postbuild` check adds ~0.1 s to a 42.8 s suite; `tools/transitions.ts` carries one
extra entry in a 21-key `Map`, making `validateTransition`'s `pm:Blocked` lookup a
3-element `some(...)` instead of 2. No regression versus base.

### Verdict

**APPROVED** — C4 is fixed by exactly the one-clause edit it called for, and the new
clause is accurate in both directions: `7e81cf7` is verifiably the v3.9.0
code-reviewer-extraction commit that changed `sr-engineer:In_Progress` from
`qa-engineer` to `code-reviewer`, the mirror row is byte-identical across all twelve
commits that ever touched the spec file, and "correct when the table was authored"
holds on the strongest available reading — the table was written as the design spec at
`6485c37`, before any source map existed, and `ebc4e49` (v3.2.0) implemented it
identically. It over-claims in neither direction. Dropping "wrongly" was correct and
matches my dictated text verbatim (R1); the "4 wrong" enumeration is legible as
written and needs no added word, since "previously … carried … 4 wrong" and "silently
invalidated at v3.9.0" already draw the wrong-now/correct-then distinction (R2). The
remainder of the footnote is intact and independently re-verified — 21/21 keys exact,
12/4/5 with the full per-key breakdown reproduced, provenance line verbatim against
`docs/backlog.md:165` — cut containment is confirmed by mtime rather than self-report
(one cut file touched this round), and build/test are green to spec with `T-E53-03(h)`
the sole declared red. N6–N8 are informational: N6 (the footnote gives one wrong row a
history and three none — all nine drift sites trace to `833241b` v3.8.0 and `7e81cf7`
v3.9.0) and N7 (`:148` still calls this mirror the "Authoritative source") are routed
to the coordinator, not to sr-engineer or qa; N8 is a scope addition for E62.

#### Notes for qa-engineer (T-E39-03 — carried forward, unchanged from round 2)

- Extend the E53 sweep's `EXPECTED` array by the single tuple
  `pm:Blocked → design-auditor:In_Progress`, per the expected-red manifest. This is
  the sole red in the suite and the only thing standing between this cut and a clean
  1694/1694.
- `scripts/check-transitions-sync.mjs` still has no test coverage. Worth pinning the
  behaviors this review exercised by hand across three rounds, all of which are the
  script's actual contract: the duplicate-row guard, the line-exact anchor
  (heading-rename fails, prose-mention passes), and the empty-parse / missing-dist
  hard failures. Per `test/check-version.test.mjs`'s established pattern, drive it
  from a temp fixture root rather than the real tree. Test ownership is qa's under
  §2 — routing information, not a finding against this diff.
