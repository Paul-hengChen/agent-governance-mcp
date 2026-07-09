# QA Review — T-C7-QA (c7-version-assertion-ownership)

covers: T-C7-01, T-C7-02, T-C7-03, T-C7-04, T-C7-CR, T-C7-QA

> Claimed for review by @qa-engineer (sonnet). Code-review verdict was
> **APPROVED** (`review_reports/review_T-C7-CR.md`): S01/S02 verified
> byte-identical at their stated anchors (T-C7-01/02), the 4 AC-9 tests
> rewritten dynamic + correct (T-C7-03/04), AC-1..AC-7 met. QA's scope per
> that verdict + this ticket's brief: (1) own the AC-8 rebaseline
> (compose-golden fixtures + 4 tripped context-budget caps) the const-05
> byte growth (S01) tripped, (2) fix the reviewer's non-blocking comment nit
> in both rewritten test files, (3) independently re-verify AC-1..AC-7
> against the shipped files rather than trust the review narrative, (4) run
> the full build+audit+test gate, (5) disclose the out-of-scope c8 leftover
> the reviewer flagged so release-engineer can split commits correctly.

## Verdict: **PASS**

- `npm run build` — 0 errors.
- `npm audit --audit-level=high` — 0 high/critical findings (1 pre-existing
  LOW `esbuild` dev-server advisory, unrelated to this ticket, not gated by
  `--audit-level=high`).
- `npm test` — **959 / 959 passing**.
- `node --test test/compose-equivalence.test.mjs` in isolation — **14 / 14
  passing** (11 byte-identity tests, all previously red from the const-05
  byte growth, now green after the AC-8 rebaseline below).
- `node --test test/context-budget.test.mjs` in isolation — **44 / 44
  passing** (4 previously red caps, all bumped below).
- `node --test test/baseline-manifest-gate.test.mjs` in isolation — 43/43.
- `node --test test/pixel-gate-attestation.test.mjs` in isolation — 52/52.
  (Matches the reviewer's independent isolation counts exactly.)

## Spec-to-Test map (AC-1..AC-9)

| AC | Covered by |
|---|---|
| AC-1 (`baseline-manifest-gate.test.mjs` package.json semver+floor `[3,40,0]`) | Re-ran the test in isolation (34/43 → `ok`); independently read the assertion body — `/^\d+\.\d+\.\d+$/` guard, then a three-clause numeric-tuple `>=` compare against `[3,40,0]`, no string comparison, no hardcoded target literal. |
| AC-2 (`baseline-manifest-gate.test.mjs` index.ts↔package.json coherence) | Re-ran in isolation (`ok`); confirmed the test reads `pkg.version` at run time and extracts the `Server()` literal via the existing regex, asserting `===` — both sides dynamic, no hardcoded target. |
| AC-3 (`pixel-gate-attestation.test.mjs` package.json semver+floor `[3,42,0]`) | Re-ran in isolation (`ok`); same shape as AC-1 with this file's own floor. |
| AC-4 (`pixel-gate-attestation.test.mjs` index.ts↔package.json coherence) | Re-ran in isolation (`ok`); same shape as AC-2. |
| AC-5 (const-05 S01 carve-out verbatim, narrow) | Independently re-extracted the S01 Copy/Strings cell from the spec (stripped wrapping backticks, unescaped `` \` `` → `` ` ``) and byte-compared against `content/const-05-core-standards.md`'s "Test ownership" bullet: `True`. Re-read the line — names the A10 precedent, excludes "test logic, assertion, or expected-value text changes", ends "No other exceptions." Does not authorize version-literal edits. |
| AC-6 (skill-release-engineer.md S02 verbatim) | Same extraction method against `content/skill-release-engineer.md`'s new Hard-rules bullet: `True`. Confirmed it mandates STOP + route-to-qa-engineer, never hand-edit. |
| AC-7 (zero hardcoded `3.53.0` literal) | `grep -rn '"3\.53\.0"' test/baseline-manifest-gate.test.mjs test/pixel-gate-attestation.test.mjs` — zero matches (exit 1 / no output), re-confirming the reviewer's finding independently. |
| AC-8 (compose-golden + context-budget rebaseline) | See below — this ticket's qa-owned work. |
| AC-9 (full gate green) | `npm run build && npm audit --audit-level=high && npm test` — all exit 0, 959/959, 0 high/critical. |

## Reviewer's non-blocking comment nit — FIXED

Per `review_reports/review_T-C7-CR.md` Quality section: the AC-9 numeric-
tuple-comparison rationale comment in both rewritten test files illustrated
the string-compare hazard backwards — `"3.9.0"` genuinely fails a `3.40.0`/
`3.42.0` floor even under correct numeric comparison, so it doesn't
demonstrate a false-fail; `"3.100.0"` does (string `"3.100.0" < "3.40.0"`
lexicographically, but numerically `100 > 40`, so numeric comparison
correctly passes it while a naive string comparison would falsely fail it).

Fixed both occurrences, comment-only, no assertion/logic change:
- `test/baseline-manifest-gate.test.mjs:640` — `"3.9.0"` → `"3.100.0"`.
- `test/pixel-gate-attestation.test.mjs:743` — `"3.9.0"` → `"3.100.0"`.

Re-ran both files in isolation after the edit (43/43, 52/52) — unaffected,
confirming the fix is comment-only as intended.

## AC-8 rebaseline (QA-owned, this ticket's core work)

### compose-golden fixtures

`content/const-05-core-standards.md`'s S01 edit (+420 chars net, one line
replaced) grew every fixture that includes const-05 (core, untagged
chain/design — loads on every dispatch path). Ran
`npm run build && node scripts/capture-constitution-golden.mjs`, which
regenerated the 10 dispatch fixtures it owns
(`build-{lite,full}-{design,nondesign}{,-fd}.txt`, `hook-{lite,full}.txt`).

The 11th byte-identity test in `test/compose-equivalence.test.mjs`
(`cat(15 manifest fragments) === constitution-monolith.txt`, the DR-1
Option R invariant) is **not** touched by the capture script — it explicitly
skips regenerating `constitution-monolith.txt` because its source
(`content/constitution.md`) was deleted at AC8 (script prints
`note: content/constitution.md absent (post-AC8 delete) — monolith baseline
not re-captured; committed fixture remains authoritative`). Per the
established house convention for this fixture (confirmed by checking prior
commits that touched it — `b7e13f4` (a11), `0bd0310` (a13), `f9cafe9` (b8) —
each manually re-wrote `constitution-monolith.txt` to the then-current
`cat(15 fragments)` output alongside a content edit), I regenerated it the
same way: imported `CONSTITUTION_SEGMENTS` from
`dist/prompts/constitution-manifest.js`, concatenated the 15 fragments in
manifest order, and wrote the result (23973 bytes) over the committed
fixture. Confirmed via `git stash` that this test passed at HEAD (before the
c7 edits) and only broke after the const-05 edit — i.e. this is exactly the
rebaseline territory AC-8 describes, not a pre-existing failure.

`node --test test/compose-equivalence.test.mjs` — **14/14 passing**,
confirming all 11 byte-identity tests (10 dispatch fixtures + the monolith
invariant) are green.

### context-budget.test.mjs caps

Independently re-measured (not trusted from the reviewer's or sr-engineer's
notes) via a standalone Node script importing `dist/prompts/build.js`'s
`composeConstitution`/`stripOriginTags`/`stripRationale` and reproducing each
test's exact composition:

| test (identified by its — stale — title cap) | old cap | new cap (measured) | comment location |
|---|---|---|---|
| AC2 lean always-on bundle (title says "≤ 3087", live cap was 3386) | 3386 | **3491** | `test/context-budget.test.mjs:99` block |
| AC8 rationale-stripped design-arm (title says "≤ 5561", live cap was 5616) | 5616 | **5721** | `test/context-budget.test.mjs:596` block |
| AC8 teamwork coordinator bundle, design-arm (title says "≤ 9545", live cap was 10774) | 10774 | **10879** | `test/context-budget.test.mjs:671` block |
| AC8 non-design constitution (title says "≤ 3477", live cap was 3531) | 3531 | **3636** | `test/context-budget.test.mjs:1101` block |

All four growths are attributable 1:1 to the same const-05 S01 edit (+420
chars net); no other fragment changed in this ticket. Appended an old→new
WHY comment to each block, citing `c7-version-assertion-ownership (qa-owned
bump, AC-8)`, following the exact prose convention already established in
each block's comment history (cause, byte/char delta, "independently
re-measured, not trusted from sr-engineer's/code-reviewer's notes",
measured value, margin re-verification where the block already tracks a
margin invariant). Margins re-verified: design-arm 5994 raw − 5721 stripped
= 273 ~tok (still ≥ 240); design-arm 5721 − non-design 3636 = 2085 ~tok
(still ≥ 2080) — both unchanged, since the const-05 edit sits outside the
rationale fences and outside the design-only fences.

**Did not clobber the stacked c8 cap.** The teamwork-bundle block already
carried an *uncommitted* c8 rebaseline (`9699 → 10774`, citing
T-C8-01..04) at the point I started this ticket. I appended my
`10774 → 10879` bump as a new comment block immediately after the existing
c8 block, leaving the c8 block's text untouched — the two bumps stack in
the order they were made, each independently attributable to its own
ticket's diff.

`node --test test/context-budget.test.mjs` — **44/44 passing** in isolation.

## Copy Audit Gate / Visual Audit Gate

N/A — spec's Copy/Strings table (S01, S02) was verified byte-verbatim above
(AC-5/AC-6), which is the substance of the Copy Audit Gate for this
content-only ticket. Visual Tokens/Visual Widgets tables are explicitly N/A
("feature has no visual literals" / "no non-primitive widgets"). Phase 1.5
Visual Compare: skipped — no `design/<feature>.md` / `## Visual Baselines`
declared; matches `scope_decision: single-feature`, `no-design` mode.

## Disclosure — stacked c8 cap co-mingling (for release-engineer)

Per the reviewer's out-of-scope flag (`review_reports/review_T-C7-CR.md`):
the working tree carries an **uncommitted** c8 rebaseline in
`test/context-budget.test.mjs` (teamwork-bundle cap `9699 → 10774`, citing
T-C8-01..04) that was never committed alongside the v3.53.0 release —
`git show HEAD:test/context-budget.test.mjs` still has `9699`, while HEAD's
`content/skill-coordinator.md` already ships the c8 +48-line growth, so the
tagged v3.53.0 has a red context-budget test at HEAD. This c8 hunk was
already sitting in the working tree before I started T-C7-QA; I did not
introduce it and I left its text unmodified (only appended my own c7 bump
after it, per above). It will co-mingle with this ticket's rebaseline diff
in the working tree. **Release-engineer must split this into its own commit**
— `chore(test): c8 AC8 cap rebaseline missed at v3.53.0` — committed
**before** the c7 feature commit, so the two rebaselines are attributed to
the correct tickets in history. This is recorded in `pending_notes` below as
well.

## Task completion

`tw_complete_task` called for T-C7-01, T-C7-02, T-C7-03, T-C7-04, T-C7-CR,
and T-C7-QA. State updated to `status: PASS`, `agent_id: qa-engineer`,
`next_role: release-engineer` in `pending_notes`, plus the c8-split
instruction above. `dispatch_pins: sr-engineer=fable` note preserved
verbatim. No release bookkeeping performed here (version bump, CHANGELOG,
backlog C10 done-marking) — explicitly release-engineer's, per this
ticket's brief.
## 2026-07-09T03:19:07.646Z — PASS — by qa-engineer

PASS. Independently re-verified AC-1..AC-7 against shipped files: S01/S02 byte-verbatim (extract-unescape-bytecompare, both true); AC-1..AC-4 tests re-run in isolation (43/43, 52/52) confirming numeric-tuple floor + dynamic index.ts<->package.json coherence, no hardcoded literal; AC-7 grep zero '3.53.0' hits. Fixed reviewer's non-blocking comment nit in both files (3.9.0 -> 3.100.0, comment-only, the false-fail illustration). AC-8 rebaseline: regenerated 10 compose-golden dispatch fixtures via scripts/capture-constitution-golden.mjs; manually re-synced the 11th (constitution-monolith.txt, script-skipped since content/constitution.md is deleted post-AC8) per the established house convention of prior const-05 edits (a11/a13/b8) that did the same; test/compose-equivalence.test.mjs now 14/14 (11 byte-identity tests green). Re-measured and bumped the 4 tripped context-budget caps to independently-measured new values with old->new WHY comments citing c7 const-05/S01 growth: AC2 lean 3386->3491, AC8 design-arm 5616->5721, teamwork bundle 10774->10879 (stacked AFTER the existing uncommitted c8 9699->10774 block, not clobbered), non-design 3531->3636; test/context-budget.test.mjs now 44/44. Full gate: npm run build (0 errors), npm audit --audit-level=high (0 high/critical, 1 pre-existing unrelated low), npm test (959/959). Evidence: qa_reports/review_T-C7-QA.md (covers T-C7-01..04, T-C7-CR, T-C7-QA). Disclosed the stacked-c8 co-mingling for release-engineer to split commits.

