# Review — T-E86-01

covers: T-E86-01, T-E92-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Diff under judgment: `tools/registry.ts` (E86 — a tail-anchored zod `superRefine` on `tw_update_state`'s `pending_notes` / `scope_decision_why` / `qa_review` / `blocking_reason` and on `tw_add_task`'s `description`) and `tools/handoff-parse.ts` (E92 — a synthetic whole-note-drop marker in the `readHandoffState` read view), plus the compiled `dist/` mirrors. Base `3d53c93`.
- **E92 / AC3 is correct.** I exercised the truncation loop against five sized fixtures, including the partial-keep-then-drop case; the omitted count is right in every one. AC4 (negative) and the lane boundary are both clean.
- **E86 / AC2 fails.** The predicate reds on truthful prose. It fires on agc's own pervasive `<placeholder>` convention (`<role>`, `<feature>`, `<task-id>`, `<field>`, `<N>`) and on ordinary TypeScript prose (`Promise<void>`, `Array<string>`) whenever such a token lands at the end of a field.
- A verbatim line of agc's own coordinator SOP — `content/coord-01-core-head.md`'s `- verdict: multi-feature (<N> units) — signals: <which fired>` — is rejected if quoted into a note. So is a line of `docs/backlog.md`.
- Verdict: **CHANGES_REQUESTED**, on AC2 / AC5 only. E92 needs no rework.

## Correctness

### F1 — BLOCKER — `tools/registry.ts:104-116` — the E86 predicate reds on truthful prose (AC2, AC5)
`hasTrailingTagFragment()` takes the last `<` in the trimmed value and fires when `TRAILING_TAG_FRAGMENT_RE` consumes the remainder. Because the regex's closing `>` is optional and its tag-name class is `[A-Za-z_][\w.:-]*`, **any** `<word>` at the tail matches — there is nothing tool-call-specific about the shape being detected.

I probed through the real shipped `TOOL_REGISTRY` `run()` path rather than reading the regex. Confirmed rejections of legitimate values:

| field value (realistic agc / TS prose) | fires |
|---|---|
| `next hop is <role>` | yes |
| `the spec is specs/<feature>` | yes |
| `report path review_reports/review_<task-id>` | yes |
| `rejection message names the offending <field>` | yes |
| `evidence lands at qa_reports/archive/<F>` | yes |
| `verdict: multi-feature (<N> units) — signals: <which fired>` | yes |
| `the handler now returns Promise<void>` | yes |
| `the field is typed Array<string>` | yes |
| `generic bound <T extends Foo>` | yes |
| `blocked on <reason>` | yes |

The fifth row is this very ticket's own AC1 phrasing. The sixth is a **byte-verbatim line from `content/coord-01-core-head.md`** — the coordinator SOP that every session loads. A sweep of all `content/*.md` (1455 non-blank lines) and `docs/backlog.md` (1561 lines) as candidate field values produced one firing line each, both from the `<placeholder>` convention, neither containing any tool-call markup.

All four guarded scalars plus `tw_add_task.description` reject identically, so there is no field where an agent can safely end a note on a placeholder.

The backlog row set the bar in its own words — the predicate "must be narrow … or it will red on truthful prose, the E74 false-positive lesson" — and AC2 requires legitimate tag-quoting prose to be accepted. Position-anchoring alone does not achieve narrowness, because agc's documentation dialect *ends sentences on angle-bracket placeholders as a matter of routine*. Per the dispatch bar, a predicate that reds on truthful prose is worse than no predicate.

**Suggested remedy** (implementer's choice, but narrowing is required): combine the existing tail anchor with a genuine tool-call signal rather than a bare tag shape. Any one of these would close it:
1. Require the fragment to be *unbalanced* against the value's own tag stack — the AC1 text and the task row both say "unbalanced", and the current implementation never computes balance at all. `<role>` is a lone open tag, so balance alone is insufficient; pair it with (2) or (3).
2. Require an attribute (`<x name="...">`) or a close-tag slash (`</x>`). This alone clears every row in the table above except `<T extends Foo>`, since bare `<role>` / `<void>` / `<string>` carry neither.
3. Restrict to the tool-call vocabulary actually observed in the incident (`invoke`, `parameter`, `function_calls`, `antml:*`). The code comment explicitly rejects vocabulary-restriction as a design choice; that choice is what produced the false positives, and the E74 lesson argues the opposite way.

### F2 — nit — `tools/registry.ts:107` — trailing non-ASCII-space characters defeat the predicate
`trimEnd()` strips U+2028/U+2029/NBSP, so those tails are caught (verified). A trailing zero-width space (U+200B) is **not** stripped and the tail check fails: `note </invoke>​` is accepted. Low severity — a bleed is unlikely to append U+200B — but worth pinning in T-QA-01 given E131's U+2028 history in this repo.

### F3 — nit — `tools/registry.ts:104` — two narrow false negatives
Verified accepted: `<parameter name='pending_notes'>` (single-quoted attribute — the regex only admits `"`), and `<parameter name=` (truncated exactly at the `=`, before the quote). Both are plausible truncation shapes for the very incident class E86 targets. Not blocking, but cheap to cover once F1 forces a rewrite.

### E92 / AC3 — no findings. Arithmetic verified by execution.
`omittedCount = pendingNotes.length - i` is computed at the break, so it counts exactly the notes from the break point onward. I ran five fixtures through `writeHandoffState` → `readHandoffState`:

| fixture | omitted reported | correct |
|---|---|---|
| 4 × 1000ch (3 fill the budget exactly) | 1 | yes |
| 5 × 900ch (note 4 partially kept, note 5 dropped) | 1 | yes |
| 1 × 4000ch (partial only, nothing dropped) | no marker | yes |
| 2500 + 1000 + 1000 (partial then one drop) | 1 | yes |
| 3000 + 50 × 10ch | 50 | yes |

The specific risk raised in the brief — a note partially kept **and** followed by dropped notes — is handled correctly (fixture 2 and 4): the partial branch sets `charBudget = 0`, the next iteration breaks at index `i`, and `length - i` excludes the partially-kept note. The no-drop case correctly emits no marker.

### E92 — observation (not blocking) — the marker overshoots `PENDING_NOTES_CHAR_LIMIT`
The marker is appended *after* the 3000-char budget is exhausted, so the returned view runs 3000 + ~58 chars (measured: +58 to +70 across fixtures). This is pre-existing behaviour in kind — the `…[truncated]` partial marker already overshoots by +12 (measured, fixture 3) — and the spec's Copy/Strings table mandates the marker text without a budget caveat, so I am not treating it as a defect. Flagging so the overshoot is a known, bounded property rather than a surprise.

### E92 — observation (not blocking) — the marker is indistinguishable from a real note on write-back
Confirmed: `tw_update_state` accepts `…[3 further note(s) omitted — see pending_notes_truncated]` as an ordinary `pending_notes` entry, so a role that reads state and carries its notes forward will persist a synthetic marker as real content. This is the self-inflicted-corruption shape the brief asked about. I am **not** blocking on it because the pre-existing `…[truncated]` marker has had the identical property since long before this cut, and the spec explicitly chose to "extend the existing convention". It is a real latent defect in that convention, not a regression introduced here — filed as NEW-1. Confirmed harmless for `tw_detect_drift` specifically: `tools/drift.ts` does not read `pending_notes` at all.

## Quality
No findings. The comment blocks are unusually good — they state the design intent, name the AC, and cite the Copy/Strings ids. Both mandated strings match the spec's table byte-for-byte (`e86.rejection_message` with the `<field>` substitution the table declares; `e92.omission_marker` with `{n}`). The `pending_notes[i]` path indexing in the issue is a nice touch for diagnosis. Placement of the `superRefine` next to the existing `[object Object]` sentinel refine is the right layer.

Note that the code comment's stated rationale ("Narrowed BY POSITION ONLY (tail-anchored), never by tag-name vocabulary") is precisely the decision F1 overturns — the comment should be revised along with the predicate, not left asserting a superseded design.

## Architecture
Correct layer, and the spec's boundary is respected. The rejection is a zod input-schema check in `tools/registry.ts`, not a gate — `gates/*.ts` and `gates/registry.ts` are untouched, exactly as the spec's Out of Scope demands. No `GateErrorCode` was added.

**Lane boundary verified against the diff** (stronger than `git status`): `git diff 3d53c93 --name-only` over `gates/`, `tools/transitions.ts`, `content/`, `test/fixtures/compose-golden/`, and `test/context-budget.test.mjs` returns empty. The complete changed set is `tools/registry.ts`, `tools/handoff-parse.ts`, their `dist/` mirrors, `tasks.md` (PM's three task rows), `.current/handoff.md`, and three new files (spec, repro test, expected-red manifest). No L-GATE / L-TRANS / L-CONTENT breach.

## Security
No findings. The change is input-tightening on a trust boundary and introduces no new sink. The regex carries no catastrophic-backtracking risk in practice: the nested quantifier `(?:\s+NAME(?:\s*=\s*"[^"]*"?)?)*` is bounded by the slice from the last `<`, and every alternative branch is anchored, so no pathological input is reachable through the 1000-char-per-note cap. Worth noting the irony that F1 makes the guard *deny service* to legitimate writes — an availability regression on the write path, which is the security-relevant consequence here.

## Performance
No findings. `hasTrailingTagFragment` is O(n) in the value length via `lastIndexOf`, runs once per guarded field per call (at most 50 notes + 3 scalars), on a cold write path. The E92 change converts a `for…of` to an indexed loop with no added passes and appends at most one entry. No complexity-class regression versus base.

## Expected-Red Sampling (SOP 4a)
The diff adds `test/e92-e86-handoff-write-boundary-repro.test.mjs`, so sampling armed. `qa_reports/expected-red_e92-e86-handoff-write-boundary.txt` exists and holds 2 structured entries (fewer than 3, so all sampled). Both are real and locatable in the named file by their exact test strings:
- `E86 repro: pending_notes entry ending in leftover tool-call tag markup is rejected with the new message, not a length-cap message` — located.
- `E92 repro: a wholly-dropped pending_notes entry leaves a synthetic omission marker as the array's last element` — located.

RED-before-fix is plausible against the diff for both, and I checked the claim rather than accepting it. The E86 test asserts `updateStateTool.run(...)` throws with `/leftover tool-call markup/`; that message string is introduced by this diff and the pre-fix schema had no `superRefine` at all, so pre-fix the call would not have thrown a `ZodError` on that input and `assert.throws` would fail. The E92 test asserts the last array element matches `/further note\(s\) omitted/`; pre-fix the loop was a plain `for…of` with `break` and appended nothing, so the last element would have been the third 1000-char note. Neither repro could have passed against the un-fixed code.

## Independent verification (brief's instruction — handoff claims not trusted)
Re-ran both claims myself in the lane worktree:
- `npm run build` — exit 0. `tsc`, `check:version` (3.110.0 parity), and `check:transitions-sync` (21 keys, exact match) all pass. Rebuilding produced no further `dist/` delta, so the committed `dist/` mirrors are genuinely in sync with the `.ts` sources.
- `npm test` — exit 0, **1866 pass / 0 fail**, matching the claimed figure exactly.

The suite being green does **not** clear AC5: no existing test writes a `pending_notes` entry ending in an angle-bracket placeholder, so F1's regression is invisible to it. That gap is itself worth closing in T-QA-01.

## Verdict
CHANGES_REQUESTED — E92/AC3 is correct and needs no rework, but the E86 predicate fires on truthful agc prose (agc's own `<placeholder>` convention, including a verbatim `content/coord-01-core-head.md` line, and ordinary TypeScript generics), which violates AC2 and AC5 and misses the ticket's own explicitly stated false-positive bar.

## Round 2 reply — by sr-engineer

Addressed F1 (BLOCKER) in `tools/registry.ts`. Left E92/AC3 untouched per the
round-2 brief's explicit instruction not to rework it.

**F1** — took remedy option 2 from the review's own suggested-remedy list:
`hasTrailingTagFragment` now requires the tail's tag-shaped fragment to carry
a genuine tool-call signal — a close-tag slash (`startsWith("</")`) or an
attribute assignment (`/=\s*"/`) — in addition to the pre-existing tail
position anchor. A bare placeholder (`<role>`, `<field>`, `<N>`) or a TS
generic (`Promise<void>`, `Array<string>`) carries neither signal and no
longer fires; `<parameter name="pending_notes">` and `</scope_decision_why></invoke>`
carry one each and still fire. Also revised the block comment above the
predicate: it no longer asserts "narrowed BY POSITION ONLY, never by
tag-name vocabulary" (F1's own root cause) — it now documents the two-part
test and why it defeats the false-positive corpus.

Re-ran the review's own corpus-sweep method against the fixed predicate,
through the real `TOOL_REGISTRY` `tw_update_state.run()` path (not the regex
read in isolation):
- **False-positive direction**: every non-blank line of `content/*.md` (36
  files) and `docs/backlog.md`, fed as a `pending_notes[0]` value —
  **3016 lines swept, 0 rejections** (1455 + 1561, matching the round-1
  count). Also re-checked the ten specific false positives named in this
  round's dispatch (`next hop is <role>`, `the spec is specs/<feature>`,
  `report path review_reports/review_<task-id>`, `rejection message names
  the offending <field>`, `evidence lands at qa_reports/archive/<F>`, the
  verbatim `content/coord-01-core-head.md` verdict line, `Promise<void>`,
  `Array<string>`, `blocked on <reason>`) — all now accepted.
- **True-positive direction**: the round-1 repro tails
  (`<parameter name="pending_notes">`, `</scope_decision_why></invoke>`, and
  a mid-attribute truncation `<parameter name="pending_notes`) — **all three
  still reject** with the `leftover tool-call markup` message.
- The two existing repro tests in
  `test/e92-e86-handoff-write-boundary-repro.test.mjs` still pass unmodified
  (no new repro cases were needed this round, so the expected-red manifest
  was not extended).

**F2 / NEW-2** (trailing U+200B) — folded in as part of the same rewrite
(cheap, same anchor line being touched): `hasTrailingTagFragment` now trims
`/[\s​]+$/` instead of `trimEnd()`. Verified `</invoke>` + trailing
U+200B now rejects. Logged as resolved in `NEW-TICKETS.md` (NEW-2).

**F3** (single-quoted attributes, truncated-before-quote `name=`) — left
alone per this round's scope (not raised as a required fix in the round-2
brief; both remain the same pre-existing false negatives as round 1, not
made worse by this change).

**NEW-1** (read-view markers indistinguishable from real notes) — untouched
per this round's explicit instruction not to fix it.

Comment above `hasTrailingTagFragment`/`TRAILING_TAG_FRAGMENT_RE` rewritten
to describe the two-part narrowing (tail position + tool-call signal) and to
stop asserting the superseded "position only" design.

Verified independently before handoff:
- `npm run build` — exit 0 (`tsc`, `check:version` 3.110.0 parity,
  `check:transitions-sync` 21 keys).
- `npm test` — exit 0, **1866 pass / 0 fail** (same count as round 1's
  baseline — no regression, no new tests added this round).

Lane boundary: only `tools/registry.ts` and their `dist/` mirrors changed
this round (plus this reply and `NEW-TICKETS.md`); `tools/handoff-parse.ts`
and its `dist/` mirror are unchanged since round 1. No `gates/*`,
`tools/transitions.ts`, or `content/**` touched.

---

## Round 2 — CHANGES_REQUESTED — by code-reviewer

## Summary
- **F1 (the round-1 blocker) is genuinely fixed.** All 14 round-1 false positives now pass, all 10 true positives still reject. Verified with my own harness through the real shipped `run()` path.
- **NEW-2 is genuinely fixed** and I confirmed it independently: the anchor's char class really is `[\s​]` (bytes `e2 80 8b` at `tools/registry.ts:134`), and a trailing zero-width space no longer hides a fragment. U+2028 / U+2029 / NBSP remain caught.
- `tools/handoff-parse.ts` is untouched (+21/-2, identical to round 1). E92/AC3 stands as passed; not re-reviewed.
- **One residual AC2 violation, found by my own 84,256-line corpus sweep, not contrived.** The regex's unterminated-quote branch `"[^"]*"?` swallows arbitrary trailing prose, so a tag fragment quoted **mid-string with further prose after it** still rejects — the exact case AC2 requires be accepted. It fired on a real governance artifact of this very feature.
- Verdict: **CHANGES_REQUESTED** — narrow, well-understood, with a fix I have already validated 8/8. Round 3 should be quick.

## Correctness

### F1 — RESOLVED. Verified, not accepted on claim.
The two-part test (tail position AND a tool-call signal — `startsWith("</")` or `/=\s*"/`) does what it claims. I re-ran my round-1 attack corpus against the rebuilt `dist/`:

| round-1 false positive | round 2 |
|---|---|
| `next hop is <role>` | accepted |
| `the spec is specs/<feature>` | accepted |
| `report path review_reports/review_<task-id>` | accepted |
| `rejection message names the offending <field>` | accepted |
| `evidence lands at qa_reports/archive/<F>` | accepted |
| `verdict: multi-feature (<N> units) — signals: <which fired>` | accepted |
| `the handler now returns Promise<void>` | accepted |
| `the field is typed Array<string>` | accepted |
| `generic bound <T extends Foo>` | accepted |
| `blocked on <reason>`, `html snippet <div>`, `the tag is <parameter>`, `math: a<b`, `kept is a List<string>` | accepted |

All 14 clear. No true positive was lost: `<parameter name="pending_notes">`, `</invoke>`, `</scope_decision_why></invoke>`, the two-tag bleed, the mid-attribute truncation, the balanced `<invoke name="x"></invoke>`, and all four trailing-whitespace variants still reject.

### F4 — BLOCKER — `tools/registry.ts:124-125` — unterminated-quote branch swallows trailing prose, re-violating AC2
`TRAILING_TAG_FRAGMENT_RE`'s attribute-value group is `(?:\s*=\s*"[^"]*"?)?`. When the closing quote is absent, `[^"]*` is greedy and matches **everything to end of string, including spaces and further sentences**, after which `"?` matches empty and `\s*\/?>?$` succeeds trivially. The tail check therefore does *not* require the tag to be the tail once an unterminated `"` is present — arbitrary prose may follow and the value is still rejected.

Confirmed rejections of legitimate mid-string prose:

| value (fragment quoted mid-string, prose after — AC2 says accept) | fires |
|---|---|
| `the bleed looked like <parameter name="pending_notes and then I wrote three more sentences about it.` | yes |
| ``we saw a mid-attribute truncation `<parameter name="pending_notes`) — all three still reject`` | yes |
| `quoting <invoke name="x and continuing the sentence normally here` | yes |
| `AC1 says a value ending in <parameter name="... is rejected, which is what we want.` | yes |

All four guarded scalars plus `tw_add_task.description` reject identically (`qa_review` verified specifically).

**This is not a contrived input.** I swept 84,256 non-blank lines across `content/`, `specs/`, `docs/`, `review_reports/`, `templates/`, `prompts/`, `test/` and the root docs through the real `run()` path. Exactly one line rejected — line 134 of *this review report*, my round-1 prose quoting a truncated fragment. The raw-line rate (1 / 84,256) understates the risk because the corpus is overwhelmingly prose that never discusses tool-call markup. Conditioned on the population that matters — lines that quote a tag-with-attribute at all — the rate is **1 / 29 (3.4%)**.

The exposure is immediate rather than theoretical: T-QA-01's author must write prose about truncated tag fragments to document AC1/AC2 coverage, and `qa_review` is a guarded field. Approving now would most likely surface this as a QA-round failure that routes back here anyway, burning a qa round instead of a review round.

**Validated fix** — split the attribute-value alternation so the terminated form keeps its permissiveness while the truncated form must run to end of string and contain no whitespace:

```
/<\/?[A-Za-z_][\w.:-]*(?:\s+[A-Za-z_][\w.:-]*(?:\s*=\s*(?:"[^"]*"|"[^"\s]*$))?)*\s*\/?>?$/
```

I ran this against an 8-case table — **8/8 PASS**: both F4 false positives become accepted; the genuine mid-attribute truncation `<parameter name="pending_no`, the complete `<parameter name="pending_notes">`, `</invoke>`, and a multi-word attribute value `<parameter name="a b c">` all still reject; `<role>` and `Promise<void>` stay accepted. Take it or derive your own, but the round-3 change should be this small.

### F5 — finding — `tools/registry.ts:114-120` — the rewritten comment still overclaims (coordinator priority 3)
Most of the rewrite is accurate and well done: the signal description (`an attribute assignment (name="...") or a close-tag slash (</...)`), the U+200B note, and the F1 post-mortem all match the code. But the Implementation paragraph asserts the fragment must be consumed "with nothing else trailing it — i.e. the tag IS the tail, not a token embedded within further text."

F4 is precisely a token embedded within further text that the predicate rejects, so that invariant is false as written. This is the same failure mode as round 1: the comment states a narrowness property the regex does not actually enforce, and the round-1 comment overclaiming is what let F1 ship. Correct the sentence alongside the regex — if the fix above is taken, the invariant becomes true and the comment can stand as written.

### F3 (round 1) — judged, NOT a blocker — the signal test did widen the false-negative hole
Per the coordinator's priority 2, I attacked the other direction. Newly missed in round 2 (caught in round 1):

| tail | round 1 | round 2 |
|---|---|---|
| `<parameter>` / `<invoke>` / `<function_calls>` (bare open tag) | rejected | accepted |
| `<parameter name` (truncated before any `=`) | rejected | accepted |
| `<br/>` (self-closing, no attribute) | rejected | accepted |

Still missed, unchanged from F3: `<parameter name='pending_notes'>` (single-quoted) and `<parameter name=` (truncated exactly at `=`). Still caught: `</invoke` and `</parameter` (bare truncated close tags).

So yes, the hole widened beyond F3's description. **I am not blocking on it**, for a reason I want on record: a bare `<parameter>` is *structurally indistinguishable* from `<role>`, and `<invoke>` from `<div>`. Separating them is impossible without a tag-name vocabulary check — which is exactly remedy (3) from my round-1 report, the one the design declined. The widening is therefore the necessary price of fixing F1 under a no-vocabulary design, and the trade is the right way round: a missed bleed leaves the status quo ante that E86 was filed against, whereas a false red blocks a legitimate write. AC1's two named exemplars (`<parameter name="...">` and `</invoke>`-style) both still reject, so AC1 is met on its own terms.

A zero-cost future tightening is available and I have filed it as NEW-3 rather than demanding it here: add tag-name vocabulary (`invoke`, `parameter`, `function_calls`, `antml:*`) as a **third OR-branch** alongside the slash and attribute signals. Because it is purely additive and no agc placeholder or TS generic is named `invoke` or `parameter`, it cannot reintroduce F1.

## Quality
The comment rewrite is otherwise a model of its kind — it records the round-1 finding, names the AC, and explains *why* position alone failed, which is exactly what a future maintainer needs. F5 is the one sentence to correct.

Two nits:
- `tools/registry.ts:134` embeds a **literal, invisible U+200B** inside the character class `[\s​]+`. It is correct today (I verified the bytes), but an invisible literal is fragile — an editor, a lint autofix, or a copy-paste through a normalising tool can silently delete it and the NEW-2 regression would return with no visible diff. Prefer the escape `[\s​]+`, which is byte-identical in behaviour and self-documenting.
- `review_reports/review_T-E86-01.md` now contains a `## Round 2 reply — by sr-engineer` section (line 103). This file is the code-reviewer's evidence artifact and the one `MISSING_REVIEW_EVIDENCE` keys off; the SOP describes it as append-only with `## Round N — VERDICT — by code-reviewer` sections. The reply is clearly attributed and did no harm, but implementer responses belong in `pending_notes` or a separate file. Convention drift, not a defect.

## Architecture
Unchanged from round 1 and still correct. The check remains a zod-level `superRefine` in `tools/registry.ts`; no gate was added. `hasToolCallSignal` is a clean, separately-named, separately-testable helper — good factoring for what is now a two-part predicate.

**Lane boundary re-verified against the diff**, as instructed: `git diff 3d53c93 --name-only` restricted to `gates/`, `tools/transitions.ts`, `content/`, `test/fixtures/`, and `test/context-budget.test.mjs` returns empty. The full changed set is `tools/registry.ts`, `tools/handoff-parse.ts`, their `dist/` mirrors, `tasks.md`, `.current/handoff.md`, plus untracked `NEW-TICKETS.md`, the spec, the repro test, the expected-red manifest, and this report. No L-GATE / L-TRANS / L-CONTENT breach.

## Security
No findings. Unchanged posture from round 1. The added `hasToolCallSignal` runs two constant-time-ish checks on an already-bounded slice. The F4 fix narrows the greedy `[^"]*`, which incidentally reduces backtracking surface as well.

## Performance
No findings. One extra `startsWith` plus one short regex test per guarded field on a cold write path.

## Independent verification (round 2)
Re-ran both claims rather than accepting them:
- `npm run build` — exit 0 (`tsc`, `check:version` 3.110.0 parity, `check:transitions-sync` 21 keys).
- `npm test` — exit 0, **1866 pass / 0 fail**, matching the claimed figure.
- Corpus sweep re-run with **my own** round-1 harness, deliberately not sr-engineer's: 84,256 non-blank lines (a superset of the claimed 3,016, adding `specs/`, `templates/`, `prompts/`, `test/`, `review_reports/` and the root docs). Result: 1 rejection, which is F4. The two harnesses agree on the 3,016-line subset and mine found the residual the narrower sweep could not — which is the case for running both.

As in round 1, suite-green does not clear AC5: no existing test exercises an unterminated-quote tail, so F4 is invisible to the suite. T-QA-01 should pin both directions.

## Verdict
CHANGES_REQUESTED — F1 and NEW-2 are genuinely fixed and verified, but F4 leaves a residual AC2 violation (an unterminated `"` lets the tail check swallow trailing prose, rejecting a mid-string fragment followed by further sentences) that fired on real agc prose in my corpus sweep; the fix is a validated two-token regex change plus the F5 comment correction.

---

## Round 3 — APPROVED — by code-reviewer

## Summary
- **F4 is fixed.** sr-engineer took my validated regex verbatim. All four F4 false-positive shapes now accept, every round-1 false positive stays accepted, and all twelve true positives still reject.
- **F5 is fixed.** The Implementation comment now describes the code accurately, including a correct explanation of *why* only the unterminated half needs its own end anchor. Third round this check has mattered; this time it holds.
- **The U+200B nit is fixed at the level that matters.** `LC_ALL=C grep -c` for the raw `e2 80 8b` byte sequence returns **0 in both `tools/registry.ts` and the rebuilt `dist/tools/registry.js`** — the artifact that actually runs. The source now reads `[\s​]+$`, and the ZWS behaviour still works.
- **My wide sweep re-run, same harness, returns a genuine 0** — 84,330 lines, 0 rejections (round 2: 1). Conditioned on tag-quoting lines: 0/35 (round 2: 1/29).
- One new false negative *is* introduced this round (an unterminated attribute value containing whitespace). It is inherent to the fix I myself specified, unreachable for the real defect class, and filed as NEW-4. Not blocking.
- Verdict: **APPROVED**.

## Correctness

### F4 — RESOLVED. Verified through the shipped `run()` path in the rebuilt `dist/`.
`TRAILING_TAG_FRAGMENT_RE` now splits the attribute-value alternation into `(?:"[^"]*"|"[^"\s]*$)` — my round-2 proposal applied as given.

All four F4 shapes now **accept**, including the naturally-occurring line-134 shape from my own round-1 report:

| value | round 2 | round 3 |
|---|---|---|
| `the bleed looked like <parameter name="pending_notes and then I wrote three more sentences about it.` | rejected | accepted |
| ``we saw a mid-attribute truncation `<parameter name="pending_notes`) — all three still reject`` | rejected | accepted |
| `quoting <invoke name="x and continuing the sentence normally here` | rejected | accepted |
| `AC1 says a value ending in <parameter name="... is rejected, which is what we want.` | rejected | accepted |

No regression in either direction. All twelve true positives still reject (complete tag, `</invoke>`, the two-tag bleed, mid-attribute truncation `<parameter name="pending_no`, balanced `<invoke name="x"></invoke>`, `</scope_decision_why></invoke>`, the ZWS/NBSP/U+2028/U+2029 variants, and the bare truncated close tags `</invoke` / `</parameter`). All round-1 false positives still accept (`<role>`, `specs/<feature>`, `Promise<void>`, `Array<string>`, `<N>`/`<which fired>`, `<parameter>`, `<div>`).

### Coordinator priority 1 — did the fix open anything new? Yes, one shape. Judged non-blocking.
I probed the `no-whitespace-to-EOL` constraint specifically. Newly missed (round 2 caught these):

| tail | round 3 |
|---|---|
| `<parameter name="pending notes` (space) | accepted |
| `<parameter name="pending\tnotes` (tab) | accepted |
| `<parameter name="pending\nnotes` (newline) | accepted |
| `<parameter name="pending\rnotes` (CR) | accepted |
| `<parameter name="a b` (NBSP) | accepted |

**This is the trade, not an oversight.** `<parameter name="pending notes` and `<parameter name="pending_notes and then three more sentences of prose` are the *same shape* — no predicate can reject the first while accepting the second, and accepting the second is AC2, which is binding. I specified this exclusion in round 2 knowing that; I am recording the cost now that it is measurable. It is practically unreachable besides: agc tool-call attribute values are identifier-shaped (`pending_notes`, `qa_review`, `active_feature`) and contain no whitespace, so a real bleed truncated mid-value cannot produce these. Both live tails on record in `docs/backlog.md` still reject. Filed as **NEW-4**.

Everything that *should* still reject under whitespace handling does. Verified explicitly:

| case | result |
|---|---|
| fragment + trailing space / newline / CRLF | rejects (trim runs first) |
| complete tag + CRLF, close tag + trailing tab, close tag + CRLF + ZWS | rejects |
| fragment followed by only whitespace | rejects |
| `<parameter name="x ` (space then EOL — trimmed, then no internal whitespace) | rejects |
| terminated multi-word value `<parameter name="a b c">` | rejects |
| terminated value with tab / newline; two attributes `<invoke name="x" id="y">` | rejects |

That last block matters: the fix did **not** cost the terminated-half permissiveness. A complete attribute value may still contain spaces, tabs or newlines and is still caught.

### Coordinator priority 2 — the sweep is genuinely 0, not 0-because-the-harness-changed.
I re-ran my round-2 sweep script **unmodified** (same roots, same file filter, same `run()` probe), changing only the `dist/` it loads:

| metric | round 2 | round 3 |
|---|---|---|
| non-blank lines swept | 84,256 | 84,330 |
| rejections | 1 | **0** |
| lines quoting a tag-with-attribute | 29 | 35 |
| of those, rejected | 1 (3.4%) | **0 (0%)** |

The 74-line growth is my own round-2 report append; the 6 extra conditioned lines are the F4 examples I wrote into it — i.e. the corpus now contains *more* of exactly the prose that triggered F4, and none of it rejects.

### Coordinator priority 3 — the comment now matches the code.
It does, and it is the best version yet. Two specifics I checked rather than skimmed:
- The overclaiming sentence is gone. The Implementation paragraph now says only that the fragment must be consumed by a tag-shaped fragment carrying the tool-call signal — no "nothing else trailing it" invariant.
- The F4 paragraph's explanation of the asymmetry is **correct**, which is a subtle thing to get right: the terminated half does not need its own `$` because the outer `\s*\/?>?$` anchor already forces tail position, whereas the unterminated half must carry its own `$` and whitespace exclusion or it swallows the anchor's job. I verified both halves behave as described (terminated multi-word values still reject; unterminated-plus-prose now accepts).

The comment also now enumerates what the predicate knowingly misses, which is exactly the right habit. One gap: the NEW-4 shape above is not in that list. Documentation nit only, noted in NEW-4.

### E92 / AC3 — untouched and unaffected.
`tools/handoff-parse.ts` remains +21/-2 against base, byte-identical to what I passed in round 1. Not re-reviewed, per the coordinator's instruction and my own round-1 conclusion.

## Quality
The U+200B nit was taken seriously and fixed properly. I verified the outcome rather than the method: `LC_ALL=C grep -c $'\xe2\x80\x8b'` returns 0 for `tools/registry.ts` **and** for `dist/tools/registry.js`. The source reads the `​` escape, and the behaviour is preserved (a fragment hidden behind a trailing ZWS still rejects). The inline comment explaining *why* the escape is used rather than the literal is a good addition — it prevents a future maintainer "simplifying" it back.

`review_reports/review_T-E86-01.md` was not appended to this round; it still ends on my round-2 verdict. Convention drift from round 2 corrected.

No other quality findings. `hasToolCallSignal` remains cleanly factored and separately testable.

## Architecture
Unchanged and correct. Still a zod-level `superRefine` in `tools/registry.ts`; no gate, no `GateErrorCode`, `gates/` untouched.

**Lane boundary re-verified against the diff**: `git diff 3d53c93 --name-only` restricted to `gates/`, `tools/transitions.ts`, `content/`, `test/fixtures/`, `test/context-budget.test.mjs` returns empty. Full changed set is `tools/registry.ts`, `tools/handoff-parse.ts`, their `dist/` mirrors, `tasks.md`, `.current/handoff.md`, plus untracked `NEW-TICKETS.md`, the spec, the repro test, the expected-red manifest and this report. No L-GATE / L-TRANS / L-CONTENT breach across any of the three rounds.

## Security
No findings. The narrowed `[^"\s]*` is strictly less greedy than the `[^"]*` it replaces, which marginally reduces backtracking surface. No new sink, no new trust boundary.

## Performance
No findings. Same single-pass predicate on a cold write path.

## Independent verification (round 3)
- `npm run build` — exit 0 (`tsc`, `check:version` 3.110.0 parity, `check:transitions-sync` 21 keys).
- `npm test` — exit 0, **1866 pass / 0 fail**, matching the claim and unchanged across all three rounds.
- Adversarial harness re-run against the rebuilt `dist/`: 6 new-FN probes, 7 whitespace/CRLF probes, 4 terminated-half probes, 11 must-accept probes, 12 must-reject probes — all as specified.

## Guidance for T-QA-01 (what the suite cannot see)
Stated plainly, because I have now flagged twice that suite-green does not clear AC5 and this file is what T-QA-01's author will work from. **All 1866 existing tests passed at every round, including the two rounds that contained confirmed AC2 violations.** The suite is blind to this predicate; do not treat green as coverage.

Please pin, at minimum:

1. **AC2 — the false-positive direction, which is where both blockers lived.** Assert *acceptance* of: a bare placeholder tail (`next hop is <role>`, `specs/<feature>`, `review_<task-id>`); a TS generic tail (`Promise<void>`, `Array<string>`); and — the round-2 blocker — a tag fragment with an **unterminated quote** followed by further prose (`... <parameter name="pending_notes and then more sentences.`). That third case is the one a reviewer, QA author or spec writer produces naturally when documenting this very feature.
2. **AC1 — the true-positive direction.** Assert *rejection* with the `e86.rejection_message` text (not `"Too big"`) for: the complete tag `<parameter name="pending_notes">`, the close tag `</invoke>`, the mid-attribute truncation `<parameter name="pending_no`, and a bare truncated close tag `</invoke`.
3. **Cover all five guarded fields, not just `pending_notes`.** The check is duplicated across `pending_notes[i]`, `scope_decision_why`, `qa_review`, `blocking_reason`, and `tw_add_task`'s `description`. `qa_review` matters most to you — it is where your own prose about this defect lands.
4. **Whitespace/Unicode boundary.** Assert rejection survives a trailing space, newline, CRLF, NBSP, U+2028, U+2029 **and U+200B** (NEW-2 — regression-prone, since it depends on one escape sequence in one character class).
5. **A corpus assertion is worth more than any single case here.** Feeding `content/*.md` and `docs/backlog.md` line-by-line through the schema and asserting zero rejections is what caught both blockers; a handful of hand-written cases would not have. Consider pinning it.
6. **Do not add coverage for NEW-3 / NEW-4 shapes as failures** — bare `<parameter>`/`<invoke>`/`<br/>`, single-quoted attributes, truncated-at-`=`, and unterminated values containing whitespace are documented accepted misses, not defects. If you pin them at all, pin them as *accepted* so a future tightening has to make a deliberate choice.
7. **AC3 / AC4 (E92)** are unchanged since round 1 and already pass; the arithmetic table in my round-1 section lists the five fixtures I verified, which may be reusable.

## Verdict
APPROVED — F4, F5 and the U+200B nit are all fixed and independently verified; the wide corpus sweep is genuinely clean at 0/84,330; the one new false negative is inherent to the fix, unreachable for the real defect class, and documented as NEW-4.
