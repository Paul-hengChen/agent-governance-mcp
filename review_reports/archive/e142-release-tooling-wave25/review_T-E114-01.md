# Review — T-E114-01 + T-E114-02

covers: T-E114-01, T-E114-02

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Base `3a98aaf`, branch `feat/e114-cut-approval-inheritance`, diff scope `schema/ tools/ docs/`
(129 insertions / 1 deletion across 8 files). `dist/` excluded from judgement per dispatch.
Reviewer model tier: opus; sr-engineer was pinned to `fable` — different models, no same-model
bias to flag.

## Summary

- Adds `cut_approved_source?: string` (`inherited:<parent-feature>`), handoff schema bump 13→14,
  a stamp-only v13→v14 migration, and the two owed `docs/schema-versions.md` rows.
- **Carry-forward is a faithful, verified clone of the `dispatch_mode` scalar algorithm** — the
  headline risk in the dispatch brief is clean. No `cut_approved` re-arm contamination.
- Migration chain, emit-only-when-set, never-throws parsing, and the retroactive v13 doc row all
  verify correct against the real code they describe.
- **Two blocking findings, both on the write path**: a malformed value is persisted verbatim into
  the frontmatter and only filtered on read-back, which can silently destroy a genuine inheritance
  record (AC4 violation); and the parser accepts a whitespace-only feature suffix.
- Verdict: CHANGES_REQUESTED.

## Correctness

All behaviour below was executed against the lane's built `dist/` (which is in sync with source),
not inferred from reading. Probe harness: write/read round-trip through `writeHandoffState` +
`parseHandoff` on a scratch workspace.

### VERIFIED CORRECT — priority 1, carry-forward fidelity (no finding)

`tools/handoff-write.ts:363-364, 380, 412-415, 481` is a structural clone of the `dispatch_mode`
block at `:331-332, 378, 402-405, 469`, clause for clause: `!== undefined → verbatim`,
`omitted && same active_feature → carry`, `omitted && feature changed → undefined`. Critically it
does **not** carry `cutApproved`'s `isPmReentry` term (`tools/handoff-write.ts:290`) — there is no
`isPmReentry` reference anywhere in the new code. Observed:

| step | write | on-disk YAML | read-back |
|---|---|---|---|
| 1 | `f1`, `cutApprovedSource: "inherited:parent-a"` | `inherited:parent-a` | `inherited:parent-a` |
| 2 | `f1`, omitted | `inherited:parent-a` | `inherited:parent-a` |
| 3 | `f1`, `lastAgent: pm`, `In_Progress`, omitted (PM re-entry) | `inherited:parent-a` | `inherited:parent-a` |
| 4 | `f2`, omitted (feature change) | *(key absent)* | `undefined` |

Step 3 is the precise failure this ticket exists to prevent, and it does not occur. Step 4 confirms
the `active_feature`-change drop path.

### VERIFIED CORRECT — priority 2, emit-only-when-set (no finding)

`tools/handoff-write.ts:481` guards the assignment; step 4 above shows the key genuinely absent
from the file (not `cut_approved_source: null` / `""`), and `tools/handoff-parse.ts:328` uses the
same spread-guard posture as `dispatch_mode`. Absence-is-signal is preserved end to end.

### VERIFIED CORRECT — priority 3, parser never throws (no finding for the throw property)

Hand-edited `.current/handoff.md` with `cut_approved_source:` set to `42`, `[a, b]`, `{k: v}`,
`null`, `true`, and `""` — every case returned `undefined` from `parseHandoff`, none threw. The
`typeof raw !== "string"` guard at `tools/handoff-parse.ts:174` covers the non-string YAML types
(js-yaml gives number / array / object / `null` / boolean respectively), so `tw_get_state` cannot
be bricked by a hand edit.

### FINDING 1 (BLOCKING) — malformed values are persisted to frontmatter, destroying a valid record

`tools/handoff-write.ts:215` — `const cutApprovedSource = opts.cutApprovedSource;` — takes the
client value with **no shape check**, and `tools/handoff-write.ts:481` emits any truthy value
verbatim. `parseCutApprovedSource` is applied only on the read path
(`tools/handoff-parse.ts:242`). Observed, with `f2` already holding a valid
`cut_approved_source: "inherited:parent-b"`:

| client value | resulting on-disk YAML | `tw_get_state` reports |
|---|---|---|
| `"inherited:"` | `cut_approved_source: "inherited:"` | `undefined` |
| `"inherited"` | `cut_approved_source: "inherited"` | `undefined` |
| `"lane:x"` | `cut_approved_source: "lane:x"` | `undefined` |
| `""` | *(key removed entirely)* | `undefined` |

Two distinct harms, both silent and both reachable through the public `tw_update_state` surface
with a single typo:

1. **Record destruction.** The previously-persisted, valid `inherited:parent-b` is *overwritten* by
   the malformed value (or, for `""`, deleted outright). The provenance fact this ticket exists to
   preserve is gone, with no error returned to the writer and no trace left. The next omitting
   same-feature write then carries forward `existing?.cut_approved_source`, which parse has already
   reduced to `undefined` — so the garbage is scrubbed and the record stays permanently lost.
2. **Audit artifact disagrees with the API.** `.current/handoff.md` is a human-readable audit file;
   it now displays `cut_approved_source: lane:x` while `tw_get_state` denies the field exists. For a
   field whose *only* purpose is auditability, a visible claim the server refuses to acknowledge is
   the worst of both worlds.

This is an AC4 violation, not a design-taste question. Spec AC4 (`specs/e114-cut-approval-inheritance.md:92-98`):
"it MUST NOT throw, and **MUST NOT silently pass through a value the field's own shape forbids**."
The read path honours the first clause; the write path breaks the second.

On the priority-4 question the brief asked me to judge — the zod/parser split as shipped is **not
coherent**. The split sr-engineer describes is defensible in principle: reject nothing at the
boundary, sanitize at the trust edge. But only *one* trust edge was instrumented. `z.string().max(200)`
at `tools/registry.ts:305` admits the value, `writeHandoffState` persists it unexamined, and the
parser filters it a whole file-write later. The AC4 phrase "dropped defensively at parse time"
describes where the *drop* is implemented, not a licence for the write path to commit a forbidden
value to disk first.

**Recommended fix — keeps every ratified decision intact.** Do *not* add a regex to the zod arg:
that would reject at the boundary, which AC4 and the registry description text both forbid. Instead
sanitize on the write path, so a malformed option behaves exactly like an omitted one:

- export `parseCutApprovedSource` from `tools/handoff-parse.ts` (or hoist it to a shared spot);
  `tools/handoff-write.ts` already imports `parseHandoff` from that module, so this introduces no
  new cycle;
- at `tools/handoff-write.ts:215`, apply it: a malformed value collapses to `undefined`, which makes
  `cutApprovedSourceNeedsExisting` true, which makes the existing valid record **carry forward**
  rather than be destroyed — the correct and safe outcome;
- this also fixes the `""` sub-case for free, and means nothing shape-forbidden ever reaches YAML.

Note the intended consequence: after this fix a client cannot clear the field by passing garbage or
`""`. That is right — clearing was never a defined operation on this field, and `active_feature`
change remains the only sanctioned drop.

### FINDING 2 (BLOCKING, one line) — parser accepts a whitespace-only feature suffix

`tools/handoff-parse.ts:176-177`:

```ts
  const parentFeature = raw.slice(CUT_APPROVED_SOURCE_PREFIX.length);
  return parentFeature.length > 0 ? raw : undefined;
```

`.length > 0` is tested against the untrimmed slice, so `"inherited:   "` passes. Observed: it is
written to YAML *and* survives read-back as `cut_approved_source: "inherited:   "`. AC4 names "an
empty feature suffix" as malformed; `"   "` names no parent feature and is an empty suffix in every
sense that matters to an auditor. The result is a persisted, API-visible inheritance claim pointing
at nothing — precisely the "pass through a value the field's own shape forbids" that AC4 forbids,
and the one edge the bare `inherited:` guard was written to catch.

Fix: `const parentFeature = raw.slice(...).trim();` before the length test. (Returning `raw`
unchanged on success is fine and preserves AC3's "verbatim" round-trip for well-formed values.)

### VERIFIED CORRECT — priority 5, migration (no finding)

`schema/migrations-handoff.ts:191-197` is `up: (input) => ({ ...input, schema_version: 14 })` —
stamp-only, seeds nothing, byte-shaped exactly like the v12→v13 block at `:176-181`. The diff is
purely additive: no prior `registerMigration` call was touched (confirmed against the full diff —
the only `schema/migrations-handoff.ts` hunk is the 16-line insertion). Registered `from`/`to`
pairs run contiguous 0→1→2→…→13→14 with no gap and no duplicate.
`schema/versions.ts:8` `handoff: 14` matches, so the file's compile-time grep guard at the foot of
`migrations-handoff.ts` stays satisfied.

### VERIFIED CORRECT — priority 6, the retroactive v13 doc row (no finding)

Checked claim by claim against source rather than accepted as prose:

| row claim | verified against |
|---|---|
| "server-stamped, NEVER client-supplied … on the first accepted write of a new `active_feature`" | `tools/handoff-orchestrator.ts:1578` `evidenceSchema: feature_changed ? EVIDENCE_SCHEMA_CURRENT : undefined`; no `evidence_schema` zod arg exists in `tools/registry.ts` |
| "v1 exact-anchored H2, v2 normalized-contains" | `gates/evidence-schema.ts:9-16`, verbatim |
| "absence === pre-E23 feature, gets the v2 normalized-contains default at the gates" | `gates/evidence-schema.ts:21-22` "pinned 1 → exact; pinned >= 2 OR ABSENT → normalized-contains" |
| "v2 is a strict superset of v1, an absent pin can only newly ACCEPT, never newly reject" | `gates/evidence-schema.ts:23-25`, verbatim |
| "feature-scoped carry-forward (the `dispatch_mode` scalar algorithm), NO PM-re-entry re-arm" | `tools/handoff-write.ts:409-411` — same-feature carry, no `isPmReentry` term |
| "stamp-only, seeds nothing" | `schema/migrations-handoff.ts:176-181` |
| "104447-F0 incident class" | real incident id, cited in `specs/e23-evidence-schema-versioning.md:3,87` |

The row is accurate; the retroactive documentation debt is genuinely paid. AC7 holds —
`grep -c '^| v13 '` and `'^| v14 '` each return 1.

One nuance, non-blocking: the row frames the pin as protecting crash-era artifacts from
retroactive invalidation, whereas `gates/evidence-schema.ts:24-26` states the pin's protective
value is for *future* tightenings (v3+) — 104447-F0 was the incident v2 *fixed*, not one the pin
guards against. The row is a fair summary of the incident class and I am not asking for a change,
but a future editor should not read it as claiming the pin itself closed 104447-F0.

## Quality

No findings that block. The new code sits correctly among its neighbours: the option lives beside
`evidenceSchema` in `WriteHandoffStateOptions`, the parser helper beside `parseDispatchPins`, the
zod arg beside `dispatch_mode`, the type beside `cut_approved`. Naming matches the file's
`effective*` / `*NeedsExisting` convention exactly.

The comments are long but earn it — every one records *why* the field diverges from a neighbour
(`NOT cutApproved's re-arm`, `NOT evidenceSchema's server-only posture`), which is the specific
confusion this field invites. The `tools/registry.ts:665-668` JSON-Schema description is the spec's
Copy/Strings string verbatim.

Observation, not a finding: `tools/handoff-write.ts:353-362` and `tools/registry.ts:292-304` both
assert the value is defensively dropped "at parse time, never rejected at the boundary" — accurate
as to *where the drop happens*, but a reader would reasonably infer from that prose that a
malformed value never lands in the file. It does (Finding 1). If Finding 1 is fixed as recommended,
these comments become true as written and need no edit.

## Architecture

No `specs/e114-cut-approval-inheritance-architecture.md` exists; judged against the spec's
**Field Design Decisions** section. All five ratified decisions are honoured as ratified, and I did
not re-litigate them:

- field name / `inherited:<feature>` shape — as specified;
- v14 bump, stamp-only migration, absence === non-inherited — as specified;
- client-settable zod arg, deliberately unlike server-stamped `evidence_schema` — as specified
  (`tools/registry.ts:305`, and `tools/handoff-orchestrator.ts:1586` passes `parsed.cut_approved_source`
  straight through rather than computing it);
- carry-forward = `dispatch_mode` scalar algorithm with no PM-re-entry re-arm — verified above;
- no gate reads the field — `grep -rn "cut_approved_source" gates/` prints nothing. AC9 holds.

Layering is right: the type in `handoff-types.ts`, sanitization in `handoff-parse.ts`, persistence
in `handoff-write.ts`, boundary in `registry.ts`, pass-through in the orchestrator, with no gate
coupling. The E36 split boundary is respected. The file-mode-only claim holds trivially — the
option is consumed only inside `writeHandoffStateCore`, and `SqliteHandoffStorage.writeState`
references neither name.

AC3's read-back leg is satisfied: `handleGetState` (`tools/handoff-orchestrator.ts:89-93`) returns
`readState()` unprojected, so the field surfaces to clients with no allow-list to extend.

Finding 1 is an implementation gap against AC4, not an architectural disagreement — the recommended
fix needs no structural change.

## Security

No findings. The field crosses a trust boundary but carries no authority: it is recording-only, no
gate predicate reads it, and it cannot satisfy `CUT_APPROVAL_REQUIRED` — so a client cannot forge
its way past an approval gate by asserting inheritance. `z.string().max(200)` bounds the length, so
there is no unbounded-write amplification into the handoff file. Values are written through
`js-yaml`'s dump (quoted on emit — observed `cut_approved_source: "inherited:parent-a"`), so a
crafted value such as `inherited:x"\n status: PASS` cannot break out of the scalar and forge
sibling frontmatter keys; I probed the surrounding write path and found no string-concatenated YAML
assembly. No secrets, no injection vector, no path derived from the value.

One note for the record, not a finding: the field is an *attestation*, and the server explicitly
cannot verify it (a cross-workspace claim). That is the ratified design. The honest security
posture is therefore "this records who claimed what," not "this proves inheritance" — which is
exactly what the type comment at `tools/handoff-types.ts:112-118` says.

## Performance

No findings. The change adds one `typeof` + `startsWith` + `slice` per handoff read and one
truthiness test per write — constant time, no allocation of consequence. Crucially it adds **no new
I/O**: `cutApprovedSourceNeedsExisting` joins an existing `||` chain
(`tools/handoff-write.ts:375-382`) that already triggers the single `parseHandoff(workspacePath)`
read for `dispatchPins` / `dispatchMode` / `evidenceSchema`, so the existing-state fetch is still
performed at most once per write. No new loop, no new file handle, no unbounded growth. No
regression vs base.

## Verdict

CHANGES_REQUESTED — the carry-forward algorithm, migration, emit posture and documentation are all
correct, but the write path persists shape-forbidden values verbatim into the audit artifact
(Finding 1, AC4) where they can silently overwrite a genuine inheritance record, and the parser
admits a whitespace-only feature suffix (Finding 2); both are small, localized fixes that keep
every ratified decision intact.

## Out-of-scope notes (no action by sr-engineer)

Recorded for the coordinator and qa-engineer; deliberately excluded from the verdict per dispatch.

**SOP step 4a (expected-red sampling) — not armed.** The diff touches no test file. The nine red
test files are a declared, spec-level consequence of an intentional constant bump (AC8), cut as
T-E114-03, not an undeclared red ship; and `dispatch_mode` is absent from handoff state (feature
mode), so the `REPRO_MANIFEST_MISSING` manifest gate is unarmed and no
`qa_reports/expected-red_e114-cut-approval-inheritance.txt` is owed. No finding.

**Independent judgement on sr-engineer's `test/handoff-migration.test.mjs:465` flag — CONFIRMED
that a problem is real, but the framing is wrong; it is not a scenario rework.**

The test is `"AC-10(g): future v14 handoff refuses-loud against a v13 server (no silent downgrade)"`.
Its invariant — a file at *(server max + 1)* must refuse loud rather than silently downgrade — is
still exactly the right invariant and needs no rethinking. The scenario is sound.

What actually breaks is AC8's *mechanical rule*. The numbers in this test are not all the same
number: the payload carries `schema_version: 14` (server max + 1) while the assertion regex carries
both — `/on-disk version 14 > server max 13/`. A literal "bump every 13 to 14" pass therefore
produces `/on-disk version 14 > server max 14/`, which is incoherent and will fail. This is the one
file in the nine where AC8's substitution rule does not yield a correct result.

Correct rework — a **coupled** bump, still zero semantic change to the invariant:

- payload `schema_version: 14` → `15`;
- assertion `/on-disk version 14 > server max 13/` → `/on-disk version 15 > server max 14/`;
- test name `future v14 … against a v13 server` → `future v15 … against a v14 server`;
- the comment block at `:466-472` names "e23-evidence-schema-versioning … v12→v13" as the bump being
  pinned — retarget to e114 / v13→v14, and drop the now-stale sentence "A hypothetical v14 file must
  still refuse-loud against the current v13 server."

Optional and strictly better, if QA judges it inside AC8's "zero semantic change": derive both
numbers from `CURRENT_VERSIONS.handoff` (payload `= handoff + 1`, regex built from the same
constant). The test then never needs touching on any future bump, and nothing observable changes.
I would not block T-E114-03 on QA choosing the literal form.

---

## Round 2 — APPROVED — by code-reviewer

Verification pass over the F1/F2 fix diff only (`git diff HEAD -- tools/ schema/ docs/`, branch
`feat/e114-cut-approval-inheritance`, base `3a98aaf`). Everything marked VERIFIED CLEAN in Round 1
was re-checked only for disturbance by the fix; none was disturbed. `dist/` excluded from judgement
but used as the execution target (rebuilt 17:17, newer than both edited sources). Reviewer tier opus;
sr-engineer pinned `fable` — no same-model bias.

## Summary

- Both Round 1 blocking findings are genuinely closed. F1: `parseCutApprovedSource` is exported from
  `tools/handoff-parse.ts:173` and applied at `tools/handoff-write.ts:224`. F2: the parent-feature
  slice is `.trim()`'d before the length test at `tools/handoff-parse.ts:176`.
- No zod regex was added — `tools/registry.ts:305` is still `z.string().max(200).optional()`, so
  AC4's "never rejected at the boundary" is intact.
- Re-ran the Round 1 probe table against the rebuilt `dist/`: all five original malformed values plus
  six more (non-string YAML types) now leave a valid record untouched on disk *and* on readback.
- Two judged properties recorded below rather than left undiscovered: the **erase-path** question and
  the **whitespace-padded parent name** question. Neither blocks.
- Verdict: APPROVED.

## Correctness

### F1 CLOSED — verified, not trusted

Probe: scratch workspace, feature `f2` seeded with a valid `cut_approved_source: "inherited:parent-b"`,
then one write per malformed value through `writeHandoffState`, checking the literal YAML line on disk
and the `parseHandoff` readback after each.

| client value | on-disk YAML after write | readback | Round 1 behaviour |
|---|---|---|---|
| `"inherited:"` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | overwrote with `"inherited:"` |
| `"inherited"` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | overwrote with `"inherited"` |
| `"lane:x"` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | overwrote with `"lane:x"` |
| `""` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | **deleted the key** |
| `"inherited:   "` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | persisted + survived readback |
| `"inherited:\t\n "` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | (new case) |
| `42`, `null`, `["a"]`, `{k:1}`, `true` | `cut_approved_source: "inherited:parent-b"` | `inherited:parent-b` | (new cases, non-string) |

The valid record survives all eleven. A subsequent omitting same-feature write still reads
`inherited:parent-b`, and an explicit valid overwrite to `inherited:parent-c` still lands — the field
is not frozen, only protected from shape-forbidden input.

### The preserve branch is REAL — "record preserved" distinguished from "both values lost"

A naive on-disk check cannot tell a working carry-forward from a write path that simply drops
everything. Three discriminating probes separate them:

| probe | setup | write | on-disk result | what it proves |
|---|---|---|---|---|
| A | no prior record | `f1` + `"lane:x"` | *(key absent)* | no phantom value is invented |
| B | `f1` holds `inherited:old` | `f2` + `"lane:x"` | *(key absent)* | the branch is **feature-scoped**, not a blind "keep whatever was there" |
| C | `f1` holds `inherited:old` | `f1` + `"lane:x"` | `inherited:old` | clause (2) carry-forward is what supplies the value |

B is the decisive one: if the preserve were unconditional the value would have survived the
`active_feature` flip. It does not. So the malformed option genuinely collapses to `undefined` and
falls into `cutApprovedSourceNeedsExisting` (`tools/handoff-write.ts:373`), which then resolves
through the same-feature guard at `:421-424`.

### Structural closure argument (beyond the empirical table)

`frontmatterData.cut_approved_source` is assigned at exactly **one** site,
`tools/handoff-write.ts:490`, from `effectiveCutApprovedSource`, whose only two possible sources are:

1. `parseCutApprovedSource(opts.cutApprovedSource)` (`:224`) — sanitized; and
2. `existing?.cut_approved_source` (`:424`) — which reached `existing` only through
   `parseHandoff` → `parseCutApprovedSource` (`tools/handoff-parse.ts:247`) — also sanitized.

There is no third route: `grep` over `tools/*.ts` shows no other producer, `tools/storage-sqlite.ts`
references neither name (file-mode-only claim holds), and the orchestrator at `:1586` is a bare
pass-through. A shape-forbidden value therefore cannot reach YAML by *any* caller, not merely by the
ones I probed. Carry-forward also cannot resurrect pre-fix garbage already on disk, since the
`existing` read is itself sanitized.

### F2 CLOSED — whitespace-only suffix

Read-path probe over hand-edited frontmatter: `"inherited:"`, `"inherited:   "` and `"inherited:\t"`
all now return `undefined` (Round 1: the latter two round-tripped). Nothing throws.

### JUDGED PROPERTY — no in-band erase path exists within a feature; accepted

With malformed input collapsing to omitted-and-preserve, no `tw_update_state` argument can clear a
`cut_approved_source` while `active_feature` is unchanged. Verified: `""`, `"   "`, `"inherited:"`,
`null` and `undefined` all preserve the incumbent value. The sanctioned in-band drop is an
`active_feature` change (verified: key absent).

Recorded as a decision, not an accident. **Acceptable for this field**, because:

- clearing was never a defined operation — the spec defines set, carry-forward and drop-on-feature-change
  and nothing else (AC3/AC5);
- the field feeds no gate (AC9 re-verified: `grep -rn cut_approved_source gates/` prints nothing), so
  a stuck value cannot block, unblock or forge anything — the worst case is a stale provenance note;
- the asymmetry is *toward* retention, which is the correct direction for an audit record: losing a
  provenance claim silently is the harm this ticket exists to prevent, whereas keeping one a beat too
  long is visible in the file and in git;
- an out-of-band erase does exist and is arguably the honest channel: deleting the line from
  `.current/handoff.md` leaves the field absent, and the next same-feature omitting write does **not**
  resurrect it (verified). For a human-readable audit artifact, an erase that leaves a git diff is
  better than a silent API-level clear.

If a future ticket ever needs a first-class clear, the natural shape is an explicit sentinel, not
re-admitting malformed input. Flagging for the follow-on `L-SCHEMA-NEW-1`, not for this cut.

### JUDGED PROPERTY — a whitespace-padded parent name is accepted and stored verbatim

`"inherited:  parent-x  "` is accepted (trimmed suffix is non-empty) and both stored and returned
**untrimmed**: on-disk `cut_approved_source: "inherited:  parent-x  "`, readback identical. AC3's
verbatim round-trip therefore survives intact — which is exactly why the fix must not normalize the
stored form, and the implementation is right to trim only for the validity test.

The latent inconsistency, stated for the record: validity is decided on the *trimmed* slice while the
persisted form is the *untrimmed* one, so a future consumer doing
`raw.slice("inherited:".length)` gets `"  parent-x  "`, which will not string-compare equal to a real
feature name. **Non-blocking** — AC9 guarantees no consumer exists today, and trimming on store would
directly contradict AC3. The right place to settle it is the follow-on coordinator-SOP ticket
(`L-SCHEMA-NEW-1`): either instruct writers not to pad, or have the eventual consumer trim at the
point of comparison. Same class, also non-blocking: the prefix match is case-sensitive
(`"INHERITED:a"` → `undefined`), consistent with "the one shape this ticket defines."

### No collateral damage

Read path re-probed over the full Round 1 case set plus new ones (`inherited:parent-a` quoted and
unquoted, `inherited:a b`, `" inherited:a"`, `"INHERITED:a"`, `42`, `[a, b]`, `{k: v}`, `null`, `true`,
`""`, `inherited`, `lane:x`, key absent). Every previously-passing case behaves identically to Round 1;
the *only* behavioural delta is the intended F2 tightening of the whitespace-only suffix. Nothing throws.

Neighbour fields re-probed on the shared `existing`-read `||` chain (`tools/handoff-write.ts:385-392`),
since `cutApprovedSourceNeedsExisting` was inserted into it: `dispatch_mode`, `evidence_schema`,
`dispatch_pins` and `cut_approved` all still carry forward on a same-feature omitting write; PM
re-entry still drops `cut_approved` while correctly retaining `cut_approved_source` (the ratified
divergence, decision 3); `active_feature` change still drops all of them. No regression.

Round 1's VERIFIED-CLEAN items re-checked for disturbance only — carry-forward as an exact
`dispatch_mode` clone with no `isPmReentry` term, emit-only-when-set, never-throws parsing, the
stamp-only v13→v14 migration and contiguous 0→14 chain, AC7's two doc rows (`grep -c` returns `1` and
`1`), AC9's empty `gates/` grep. None disturbed; the fix diff touches only
`tools/handoff-parse.ts:166-182` and `tools/handoff-write.ts:44,211-224`.

No test file is touched by the fix diff, so SOP step 4a stays unarmed. Nothing surfaced in this
round's probing that is not a v13→v14 constant mismatch.

## Quality

No findings. The `export` keyword is the minimal change that closes F1; no helper was hoisted to a new
module and no import cycle was created (`handoff-write.ts` already imported `parseHandoff` from
`handoff-parse.ts`). The Round 1 observation that the `tools/handoff-write.ts:353-362` and
`tools/registry.ts:292-304` comments implied a malformed value never lands in the file is now **true as
written** — no edit needed, as predicted. Both new comment blocks cite the finding they close
(`review_T-E114-01.md Finding 1/2`), which is the right provenance for a fix hunk.

## Architecture

No findings. The fix moves sanitization to the write trust edge as recommended and changes no
structure: the parser remains the single definition of the legal shape, now shared by both edges
instead of one. All five ratified Field Design Decisions remain honoured; none was re-litigated.
Layering, the E36 split boundary, and the file-mode-only property are unchanged.

## Security

No findings; posture improved. The audit artifact and the API can no longer disagree — the Round 1
harm where `.current/handoff.md` displayed `cut_approved_source: lane:x` while `tw_get_state` denied
the field is gone, because nothing shape-forbidden is written at all. `z.string().max(200)` still
bounds the length, `js-yaml` still quotes on emit, and the field still carries no authority (no gate
reads it), so no forgery path past `CUT_APPROVAL_REQUIRED` is opened. The new refusal-to-clear is a
retention bias on a non-authoritative record, not a denial-of-service surface.

## Performance

No findings. The fix adds one `typeof` + `startsWith` + `slice` + `trim` per write — constant time on
a ≤200-char string. No new I/O: `cutApprovedSourceNeedsExisting` was already in the existing `||`
chain in Round 1, so the single `parseHandoff(workspacePath)` per write is unchanged. No regression.

## Verdict

APPROVED — both Round 1 blocking findings are independently verified closed against the rebuilt
`dist/`: no shape-forbidden value can reach the handoff file by any route, and the valid record is
preserved by the genuine feature-scoped carry-forward branch (not by a blanket drop), with the read
path unchanged for every previously-passing case and neighbour fields unaffected. The two remaining
observations — no in-band erase path, and verbatim storage of a whitespace-padded parent name — are
judged acceptable and recorded for the follow-on `L-SCHEMA-NEW-1` ticket rather than blocking this cut.
