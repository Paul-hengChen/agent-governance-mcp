# Review — T-QA-01

covers: T-E86-01, T-E92-01, T-QA-01

Feature: `e92-e86-handoff-write-boundary` (E92 + E86, L-STATE, Wave 1). Code-reviewer APPROVED at round 3 (`review_reports/review_T-E86-01.md`) after two CHANGES_REQUESTED rounds (F1, then F4). `dispatch_mode: bugfix`.

## Expected-Red Diff

Phase 0.5 (bugfix mode — this section is load-bearing for PASS, not advisory).

Manifest: `qa_reports/expected-red_e92-e86-handoff-write-boundary.txt` (sr-engineer's 2-entry repro-first manifest, `test/e92-e86-handoff-write-boundary-repro.test.mjs`, left untouched — confirmed byte-identical via `git diff` against the pre-round-1 base, empty diff).

Ran the full suite (`npm test`, 2008 tests) and located both manifest entries:

| manifest entry | result |
|---|---|
| `E86 repro: pending_notes entry ending in leftover tool-call tag markup is rejected with the new message, not a length-cap message` | **GREEN** (`ok 641`) |
| `E92 repro: a wholly-dropped pending_notes entry leaves a synthetic omission marker as the array's last element` | **GREEN** (`ok 642`) |

Disposition: both manifest (repro) entries confirmed turned GREEN by the fix (round 3, F4 + F5 + U+200B nit). Zero actual reds absent from the manifest — full suite ran 2008/2008 pass, 0 fail. No stray red, no regression. Clean per the bugfix-mode PASS gate (both conjuncts satisfied).

## Phase 1 — Review

Read the round-3-APPROVED diff directly (not re-trusting the review's claims):
- `tools/registry.ts:90-182` (`hasTrailingTagFragment`, `hasToolCallSignal`, `TRAILING_TAG_FRAGMENT_RE`, `trailingTagFragmentMessage`) and the two `superRefine` call sites at `tools/registry.ts:355-376` (`UpdateStateArgs`, 3 scalars + `pending_notes[i]`) and `tools/registry.ts:410-418` (`AddTaskArgs.description`) — matches the review's description exactly, including the round-3 split attribute-value alternation `(?:"[^"]*"|"[^"\s]*$)` (F4 fix) and the `​` escape (not a raw literal) in the trim regex at line 169.
- `tools/handoff-parse.ts` whole-note-drop marker logic (`omittedCount` computed at the `charBudget <= 0` break, appended as `e92.omission_marker`) — byte-identical to what round 1 passed (confirmed `+21/-2` unchanged since round 1, matching the round-3 report's own claim).
- Confirmed via `LC_ALL=C grep -c` equivalent (a Unicode-aware regex read of the file text) that neither `tools/registry.ts` nor `dist/tools/registry.js` contains a literal U+200B codepoint — the escape is real, not a raw byte. Same finding as the round-3 review, verified independently.

No new correctness findings. Round 3's APPROVED verdict holds under my own re-verification (see AC Execution Log below for the executed proofs).

### Copy Audit Gate (3a)

Spec's Copy/Strings table has two entries. Grepped source AND spec for both, byte-for-byte:

| string id | spec text | found verbatim in source | match |
|---|---|---|---|
| `e86.rejection_message` | `Field "<field>" appears to end with leftover tool-call markup (a trailing tag fragment) — this usually means a malformed multi-argument call bled into this field. Re-issue the call with each argument in its own tag.` | `tools/registry.ts:181` (`trailingTagFragmentMessage`), template form | exact |
| `e92.omission_marker` | `…[{n} further note(s) omitted — see pending_notes_truncated]` | `tools/handoff-parse.ts` (`kept.push(...)` line), template form | exact |

No drift, no coverage gap. A dedicated automated check for both (`Copy/Strings oracle` test) and per-field byte-exact assertions of the substituted form (`e86Message(field)` for all 5 guarded fields, `e92Marker(n)` for all 5 AC3 fixtures) are now in `test/e92-e86-handoff-write-boundary.test.mjs` — no unlisted user-facing string was introduced by the diff (the only two new strings in the diff are these two, both spec-sourced).

### Visual Audit Gate (3b)

Spec's Visual Tokens / Visual Widgets tables are both `N/A — feature has no visual literals / non-primitive widgets`. Skipped, nothing to audit.

## Phase 1.5 — Visual Compare

`design/e92-e86-handoff-write-boundary.md` does not exist (no `design/` directory at all in this lane). **Phase 1.5: skipped (no Visual Baselines declared).** Backend/schema feature, no UI surface.

## Phase 3 — Tests

**Test File Discovery**: no pre-existing test file covers this predicate (confirmed — the 1866-test baseline passed at every review round including the two rounds with confirmed AC2 violations, per the round-3 review's own "Guidance for T-QA-01"). Per the dispatch brief's explicit placement instruction, authored `test/e92-e86-handoff-write-boundary.test.mjs` (new file, pre-authorized). Did NOT touch `test/e92-e86-handoff-write-boundary-repro.test.mjs` (sr-engineer's bugfix-mode repro, referenced by the expected-red manifest) — confirmed untouched via `git diff` (empty).

### Spec-to-Test Map

| AC | test(s) in `test/e92-e86-handoff-write-boundary.test.mjs` |
|---|---|
| AC1 (reject true-positive tails, verbatim message, not length-cap) | `AC1: <field> rejects a true-positive trailing tag fragment (<shape>)` — 5 fields × 6 shapes = 30 tests |
| AC2 (accept mid-string / false-positive tails) | `AC2: <field> accepts a truthful bare-placeholder/generic tail (<shape>)` (5×7), the byte-verbatim `content/coord-01-core-head.md` verdict-line test (all 5 fields), `AC2: <field> accepts a tag fragment with an unterminated quote followed by further prose` (5 fields — the round-2 F4 shape), the spec's own worked mid-string example (all 5 fields), plus the corpus sweep |
| AC3 (whole-note-drop omission marker) | the 5 `AC3: ...` fixture tests (4×1000, 5×900, 1×4000, 2500+1000+1000, 3000+50×10), reproducing code-reviewer's round-1 execution table |
| AC4 (no read-path re-validation) | `AC4: reading a crafted over-cap scope_decision_why from a handoff fixture does not throw` |
| AC5 (no new false rejections) | full suite green (2008/2008) + `AC5: <field> at exactly its <cap>-char cap with no markup is accepted` (5 fields) + the corpus sweep |

**Coverage Gate**: no code coverage tool wired into this repo's `npm test`; noting explicitly per SOP. Every branch of `hasTrailingTagFragment`/`hasToolCallSignal`/`TRAILING_TAG_FRAGMENT_RE` is exercised by the AC1/AC2/NEW-3/NEW-4/whitespace test groups (12 true-positive shapes × 5 fields, 8 accepted-false-positive families × 5 fields, 8 documented-accepted-miss shapes × 5 fields, 8 whitespace/Unicode variants × 2 fields), and the AC3 loop (`omittedCount` computation) is exercised at all 5 boundary-arithmetic fixtures from the round-1 review.

**Security Smoke Tests**: boundary inputs covered — empty/near-empty via `ROUND1_FALSE_POSITIVES`, oversized via `AC5` cap-boundary tests + the corpus sweep's length filter, special characters (Unicode line/paragraph separators, NBSP, ZWS) via the whitespace boundary group. No new auth/permission surface (this is a zod input check, not a new gate).

## Phase 3.5 — AC Execution Log

All five spec ACs carry `proof:` annotations. Executed each:

| AC | proof | command | result | verdict |
|---|---|---|---|---|
| AC1 | qa-authored unit test asserting rejection with the new message (not "Too big") | `node --test test/e92-e86-handoff-write-boundary.test.mjs` (AC1 group, 30 tests) | all 30 pass; each asserts the exact `e86.rejection_message` text is present in `err.issues` and no message matches `/too big/i` | PASS |
| AC2 | qa-authored unit test with a mid-sentence `<parameter name="pending_notes">` fragment followed by further prose, asserting acceptance | same run — "AC2: a fragment quoted mid-string then closed..." (5 fields) + "AC2: ... unterminated quote followed by further prose" (5 fields, the round-2 F4 shape) | all 10 pass, `assertAccepted` (no throw) | PASS |
| AC3 | qa-authored unit test round-tripping a handoff whose notes are sized so at least one is wholly dropped, asserting the marker is the array's last element | same run — the 5 `AC3:` fixture tests | all 5 pass; byte-exact `e92Marker(n)` match for n ∈ {1, 1, 0 (no marker), 1, 50} | PASS |
| AC4 | qa-authored unit test reading a crafted over-cap `scope_decision_why`, asserting no throw | same run — `AC4: reading a crafted over-cap scope_decision_why...` | pass; `assert.doesNotThrow` holds, and the 2500-char value round-trips intact (length preserved, not truncated) | PASS |
| AC5 | full existing suite green (`npm test`) plus a qa-authored boundary test just under each affected cap | `npm test` (full suite, from repo root) | **2008 pass / 0 fail / 0 cancelled** (1866 baseline + 142 new, exact arithmetic match — no baseline regression) — plus the 5 `AC5:` cap-boundary tests and the 3016-line corpus sweep, all pass | PASS |

No proof failed to run (no missing fixtures). No proof's observed outcome contradicted its AC text.

## Phase 4 — Run

- `npm run build`: exit 0. `tsc`, `check:version` (3.110.0 parity), `check:transitions-sync` (21 keys, exact match) all clean.
- `npm test`: exit 0, **2008 pass / 0 fail / 0 cancelled / 0 skipped** (`test/*.test.mjs`, includes the new `test/e92-e86-handoff-write-boundary.test.mjs`, 142 tests, all passing). CI-runnable headlessly, zero human interaction.
- Lane boundary re-verified against the diff (not `git status`): `git diff --name-only -- gates/ tools/transitions.ts content/ test/fixtures/compose-golden/ test/context-budget.test.mjs` returns empty. My own changes are confined to one new file, `test/e92-e86-handoff-write-boundary.test.mjs`, plus this report and (implicitly) `.current/handoff.md`/`tasks.md` via the `tw_*` tool calls that close this task. No L-GATE / L-TRANS / L-CONTENT breach.
- No new defects found — no `NEW-TICKETS.md` entry added. NEW-1 through NEW-4 (already filed) are pinned as documented, non-blocking, accepted-by-design behavior in the new test file (the `ACCEPTED_BY_DESIGN_SHAPES` group and the whitespace/U+200B group), not re-litigated as failures.

## Verdict

**PASS** — AC1-AC5 all execute green with dedicated coverage (172 assertions across 142 new tests, this feature's full AC1-AC5 matrix across all 5 guarded fields), the Copy/Strings oracle matches the spec verbatim, the bugfix-mode expected-red manifest is clean (both entries GREEN, zero stray reds), the lane boundary is clean, and the full suite is green with an exact-arithmetic non-regression (1866 + 142 = 2008). NEW-3/NEW-4/round-1-F3 accepted misses are pinned as accepted, not failures, so a future tightening of the regex must consciously revisit this file rather than silently reintroducing F1/F4.
## 2026-09-16T10:30:20.620Z — PASS — by qa-engineer

PASS. Authored test/e92-e86-handoff-write-boundary.test.mjs (142 tests, new file, pre-authorized placement) covering AC1-AC5 across all 5 guarded fields (pending_notes[i], scope_decision_why, qa_review, blocking_reason, tw_add_task description) per code-reviewer round-3 guidance: false-positive direction first (bare placeholders, TS generics, the byte-verbatim content/coord-01-core-head.md verdict line, and the round-2 F4 unterminated-quote-plus-prose shape across all 5 fields), true-positive direction with the verbatim e86.rejection_message (not a length-cap message), a 3016-line corpus sweep of content/*.md and docs/backlog.md through the real run() path (0 rejections), the whitespace/Unicode boundary including U+200B (both a behavioral persistence test and a static source-scan pinning the escape over a raw literal), the 5 AC3 omitted-count fixtures reproducing the round-1 execution table byte-exact, and an AC4 negative-requirement test (over-cap scope_decision_why read does not throw, value preserved intact). NEW-3/NEW-4/round-1-F3 shapes are pinned as accepted by design, not failures. Phase 0.5 expected-red diff: clean, both manifest entries confirmed GREEN, zero stray reds. npm run build exit 0; npm test 2008 pass / 0 fail (1866 baseline + 142 new, exact match, no regression). Lane boundary clean against the diff (gates/, tools/transitions.ts, content/, test/fixtures/compose-golden/, test/context-budget.test.mjs all untouched). Full report: qa_reports/review_T-QA-01.md (covers T-E86-01, T-E92-01, T-QA-01).

## 2026-09-16T10:30:43.215Z — PASS — by qa-engineer

PASS. Authored test/e92-e86-handoff-write-boundary.test.mjs (142 tests, new file, pre-authorized placement) covering AC1-AC5 across all 5 guarded fields (pending_notes[i], scope_decision_why, qa_review, blocking_reason, tw_add_task description) per code-reviewer round-3 guidance: false-positive direction first (bare placeholders, TS generics, the byte-verbatim content/coord-01-core-head.md verdict line, and the round-2 F4 unterminated-quote-plus-prose shape across all 5 fields), true-positive direction with the verbatim e86.rejection_message (not a length-cap message), a 3016-line corpus sweep of content/*.md and docs/backlog.md through the real run() path (0 rejections), the whitespace/Unicode boundary including U+200B (both a behavioral persistence test and a static source-scan pinning the escape over a raw literal), the 5 AC3 omitted-count fixtures reproducing the round-1 execution table byte-exact, and an AC4 negative-requirement test (over-cap scope_decision_why read does not throw, value preserved intact). NEW-3/NEW-4/round-1-F3 shapes are pinned as accepted by design, not failures. Phase 0.5 expected-red diff: clean, both manifest entries confirmed GREEN, zero stray reds. npm run build exit 0; npm test 2008 pass / 0 fail (1866 baseline + 142 new, exact match, no regression). Lane boundary clean against the diff (gates/, tools/transitions.ts, content/, test/fixtures/compose-golden/, test/context-budget.test.mjs all untouched). Full report: qa_reports/review_T-QA-01.md (covers T-E86-01, T-E92-01, T-QA-01).

