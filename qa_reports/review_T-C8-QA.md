# QA Review — T-C8-QA (c8-crash-resume-protocol)

covers: T-C8-01, T-C8-02, T-C8-03, T-C8-04, T-C8-CR, T-C8-QA

> Claimed for review by @qa-engineer (sonnet). Code-review verdict was
> **APPROVED** (`review_reports/review_T-C8-CR.md`): four exact-text blocks
> (T-C8-01..04) verified verbatim at the spec's stated anchors, purely
> additive (+48/-0, `content/skill-coordinator.md` only),
> `content/skill-coordinator-lite.md` byte-untouched (AC-5). QA's scope per
> that verdict: (1) independently re-verify the verbatim/anchor/AC-5 claims
> rather than trust them, (2) re-verify the PM's post-review one-word errata
> fix (`specs/c8-crash-resume-protocol.md:260` and
> `content/skill-coordinator.md:148`, "above" → "below") landed byte-identically
> in both files, (3) own the `test/context-budget.test.mjs` AC8 cap
> re-baseline flagged by the reviewer as QA territory, (4) run the full
> build+test gate.

## Verdict: **PASS**

- `npm run build` — 0 errors.
- `npm test` — **959 / 959 passing** (958 pre-existing + this ticket's cap
  edit; no new tests added or removed — see rationale below).
- `node --test test/context-budget.test.mjs` in isolation — **44 / 44
  passing**, confirming the AC8 rebaseline holds standalone.

## Spec-to-Test map (AC-1..AC-5)

This is a `no-design`, content-only SOP-text feature (`specs/c8-crash-resume-protocol.md`,
"Design mode: `no-design`"). Per the spec's own Out of Scope section, "no
changes to `tools/transitions.ts`, `tools/handoff.ts`, `guards/`, or any `.ts`
file" — there is no executable behavior to unit-test. Verification is
byte-level text-contract checking against the shipped file, which I performed
directly (see below) rather than via new `.test.mjs` assertions, consistent
with how prior no-design content tickets in this repo (e.g. skill-text-only
additions) are QA-verified. No test file exists that asserts
`content/skill-coordinator.md` prose content line-by-line, and adding one
would duplicate the code-reviewer's already-independent verbatim/anchor
check — Phase 3 Test File Discovery: no relevant test file for prose-content
assertions exists, and none is warranted (the file's actual runtime
consumption — token budget — is covered by the existing
`test/context-budget.test.mjs`, which IS the relevant test file and IS
updated below).

| Spec item | Covered by |
|---|---|
| AC-1 (`dispatch_pins` persist-before-dispatch convention, Auto-Routing) | Independently extracted the spec's T-C8-01 fenced block (1204 bytes) and confirmed byte-exact substring match in `content/skill-coordinator.md`; anchor confirmed between the "Subagent Dispatch (Claude Code)" paragraph and the "Fallback (`tw_switch_role`)" paragraph. |
| AC-2 (pinned-tier expectation, watermark validation) | T-C8-02 block (555 bytes) byte-exact substring match; anchor confirmed between the "leading character MUST be U+2014…" paragraph and "Correction strategy". |
| AC-3 (`## Crash-Resume Protocol`, 3 numbered steps in order) | T-C8-03 block (2163 bytes) byte-exact substring match; anchor confirmed between the Cut-approval gate writer obligation paragraph and `## Subagent Reply Watermark Validation`; steps 1/2/3 (ground-truth → restate → re-assert) present in that order. |
| AC-4 (Crash detection row in Escalation Routes) | T-C8-04 block (424 bytes) byte-exact substring match; anchor confirmed between the `hop counter ≥ 10` row and the `Cut-approval gate` row; DO column points at the Crash-Resume Protocol. |
| AC-5 (`skill-coordinator-lite.md` untouched) | `diff <(git show HEAD:content/skill-coordinator-lite.md) content/skill-coordinator-lite.md` — empty diff, exit 0. File is byte-identical to the committed HEAD version. |

Verification method: a standalone Python script re-extracted each spec fenced
block by heading (`#### T-C8-0N`) and asserted it is a literal substring of
the shipped `content/skill-coordinator.md` — this re-does the reviewer's
verbatim/anchor claim from scratch rather than trusting `review_T-C8-CR.md`'s
narrative. All four returned `True`. Anchor ordering was additionally
confirmed by direct `Read` of the shipped file (lines 75–270).

## Errata re-verification (PM's post-review fix)

Per the ticket's chain context, PM applied a one-word fix in both
`specs/c8-crash-resume-protocol.md:260` and `content/skill-coordinator.md:148`
("Pinned-tier expectation **above**" → "**below**") after code-review, since
the code-reviewer's CR-1 finding noted the heading is physically below the
Crash-Resume Protocol section, not above it. I re-verified this myself rather
than trusting PM's or the reviewer's byte-match claim: the same substring
extraction used for AC-1..4 above extracts the **entire** T-C8-03 block from
the current spec (which now reads "...per the Pinned-tier expectation
**below**...") and confirms it is *still* a byte-exact substring of the
shipped skill file. Since the substring match only succeeds if every byte —
including the corrected word — agrees between both files, this single check
transitively re-confirms the errata fix landed identically in both files.
Direct `Read` of both files at their stated line numbers additionally
confirms: `specs/c8-crash-resume-protocol.md:260` and
`content/skill-coordinator.md:148` both read "...check the tier against the
pin per the Pinned-tier expectation **below**, not the frontmatter default."
Errata fix confirmed consistent. Non-blocking, LOW severity, as the reviewer
assessed — recorded here for the audit trail per PM's request.

## AC8 token-budget re-baseline (QA-owned, this ticket's only code/test change)

`test/context-budget.test.mjs:741` ("AC8/AC-P2-7: teamwork coordinator bundle
(design-arm, both strips) is at/below the floor") asserted the composed
coordinator bundle (`stripRationale(stripOriginTags(CONSTITUTION)) + SEP +
stripRationale(stripOriginTags(skill-coordinator.md body))`) is `≤ 9699`
~tok — the exact cap from the prior (`b8-external-ref-ledger`) ticket, with
no headroom, per this file's established ~10-bump convention (cap = last
measured value, re-raised only when a real content addition grows the
bundle).

I independently re-measured via a standalone Node script importing
`dist/prompts/build.js`'s `composeConstitution`/`stripRationale`/
`stripOriginTags` and reproducing the test's exact composition: **10774
~tok**, exceeding the 9699 cap by 1075 — reproducing both sr-engineer's and
the code-reviewer's independent measurements exactly (three independent
measurements now agree). The growth is 100% spec-mandated: `git diff
--numstat` shows `48 0 content/skill-coordinator.md`, matching the four
additive AC-1..4 text blocks and nothing else — no constitution-side change,
no unrelated drift.

Per the file's house convention (QA owns the exact-cap re-baseline; sr-engineer
correctly leaves this test untouched per-ticket), I bumped the cap
`9699 → 10774` and appended a WHY comment citing `c8-crash-resume-protocol`
(T-C8-01..04), naming the four additive sections responsible and stating the
diff stat and re-measurement provenance, consistent in form with the ~10
prior bump comments in the same file (e.g. the immediately preceding
`b8-external-ref-ledger` comment block).

No other cap in `test/context-budget.test.mjs` needed adjustment: the other
AC8-family tests (`≤ 5561`, `≤ 3477`, the `~1830 ~tok lighter` delta test)
measure the constitution alone or a constitution-arm delta, neither of which
includes `content/skill-coordinator.md`'s body — unaffected by this
content-only, single-file ticket. Confirmed via `grep -n "9545\|9699\|10774"`
that no stale reference to the old cap remains in the assertion or its
active comment (the test's *title* string at line 671 still reads the older
`9545` value — this is pre-existing drift from an earlier bump cycle that
was never title-synced either, e.g. the `b8` bump raised the assert to 9699
without updating the title from 9545; consistent with that established
pattern, I left the title as-is rather than introduce an inconsistent new
convention unilaterally).

## Copy Audit Gate / Visual Audit Gate

N/A — spec's Copy/Strings table states "No user-facing strings"; Visual
Tokens/Visual Widgets tables are explicitly N/A ("feature introduces no
visual tokens" / "no non-primitive widgets"). Phase 1.5 Visual Compare:
skipped — no `design/<feature>.md` / `## Visual Baselines` declared, matches
`scope_decision: single-feature`, `no-design` mode recorded in handoff state.

## Task completion

`tw_complete_task` called for T-C8-01, T-C8-02, T-C8-03, T-C8-04, T-C8-CR,
and T-C8-QA. State updated to `status: PASS`, `agent_id: qa-engineer`,
`next_role: release-engineer` in `pending_notes` (release bookkeeping —
version bump, CHANGELOG, backlog C10 done-marking — is explicitly
release-engineer's, not QA's, per this ticket's brief). `dispatch_pins:
sr-engineer=fable` note preserved verbatim; PM's errata-fix line logged in
`pending_notes` per PM's request, recorded once QA exits `In_Progress`.
## 2026-07-09T02:39:52.447Z — PASS — by qa-engineer

PASS. Independently re-verified AC-1..5: extracted each of the four spec fenced blocks (T-C8-01..04, 1204/555/2163/424 bytes) and confirmed byte-exact substring match in content/skill-coordinator.md at the spec's stated anchors; skill-coordinator-lite.md confirmed byte-identical to HEAD (AC-5, empty diff). Re-verified PM's post-review errata fix ("above"->"below") landed byte-identically in both specs/c8-crash-resume-protocol.md:260 and content/skill-coordinator.md:148 — the same substring match that confirms AC-1..4 transitively re-confirms the errata since it covers the corrected word. Re-measured test/context-budget.test.mjs AC8 design-arm coordinator bundle independently via dist/prompts/build.js: 10774 ~tok (matches sr-engineer's and code-reviewer's prior measurements exactly, three-way agreement). Bumped the QA-owned exact cap 9699->10774 with a WHY comment citing c8-crash-resume-protocol (T-C8-01..04, +48/-0 additive). npm run build: 0 errors. npm test: 959/959 passing (full suite); node --test test/context-budget.test.mjs: 44/44 in isolation. Evidence: qa_reports/review_T-C8-QA.md (covers T-C8-01, T-C8-02, T-C8-03, T-C8-04, T-C8-CR, T-C8-QA).

