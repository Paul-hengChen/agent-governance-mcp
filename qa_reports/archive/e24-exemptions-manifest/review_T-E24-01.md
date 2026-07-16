# QA review — T-E24-01 / T-E24-02 / T-E24-03

covers: T-E24-01, T-E24-02, T-E24-03

Feature: `e24-exemptions-manifest` (backlog E24, 104447-F0 C2). No
`specs/e24-*.md` or `design/e24-*.md` file exists — this is a content-scoped
mini-chain (sr-engineer → code-reviewer → qa-engineer) with the backlog row
itself as spec, per E10/E17/E18/E20/E23 precedent. Implementation commit:
`3141a2a`. Code review: APPROVED (`review_reports/review_T-E24-01.md`,
covers all three ids) — zero blocking findings.

Shipped diff: `tools/exemptions.ts` (new, 178 lines — never-throw loader for
`.current/exemptions.json`), `tools/handoff.ts` (`loadExemptions` wired into
both `readHandoffState` envelope return paths), `content/const-05-core-standards.md`
(new §2 "Build-gate exemptions" bullet, the ONLY sanctioned exemption channel
for the ZERO-errors gate) + regenerated golden/monolith/hook fixtures (11
files, content-only propagation of the new bullet).

## Expected-Red Diff

Present: `qa_reports/expected-red_e24-exemptions-manifest.txt` (4 entries, all
in `test/context-budget.test.mjs` — lines 220/853/1010/1581, the four
token-budget pins pushed by the new §2 bullet's +188 ~tok, per the e18
write-provenance re-baseline precedent).

Ran the FULL suite (`node --test test/*.test.mjs`, 1521 tests) BEFORE any
re-baseline edit, isolating my own working tree from the not-yet-applied
context-budget.test.mjs change via `git stash push -- test/context-budget.test.mjs`
so the pre-edit run is a true pre-baseline snapshot rather than a
same-session re-run of numbers I already knew:

- **Result: 1517 pass / 4 fail.** The 4 failures, by exact test name:
  - `AC2: lean always-on bundle is below the raw baseline and within target (<= 4297 ~tok)` — actual 4485
  - `AC8/AC-P2-7: rationale-stripped (design-arm) constitution is at/below the measured floor (≤ 8437 ~tok)` — actual 8625
  - `AC8/AC-P2-7: teamwork coordinator bundle (design-arm, both strips) is at/below the floor (≤ 16532 ~tok)` — actual 16720
  - `AC8/AC-P2-7: non-design (design-only + rationale stripped) constitution is at/below the floor (≤ 6340 ~tok)` — actual 6528
- **Diff empty**: 4/4 manifest entries confirmed red, 0 unexplained reds. Every
  failure's actual measured value matches the manifest's declared re-baseline
  target (4485/8625/16720/6528) exactly — independently re-measured, not
  trusted from sr-engineer's or code-reviewer's handoff notes, which happened
  to state the same figures.
- No dispositions needed beyond "artifact to re-baseline": all 4 are pure
  token-count pins tripped by the one approved content bullet, none touch
  business-logic assertions.
- Restored the stashed edit (`git stash pop`) and re-ran: 1521/1521 green.

## Phase 1 — Review

Read `tools/exemptions.ts`, the `tools/handoff.ts` diff, and the new
`content/const-05-core-standards.md` §2 bullet in full, cross-checked against
code-reviewer's APPROVED findings (independently re-derived, not merely
copied):

- **Never-throw holds**: every `fs.readFileSync`/`JSON.parse` call site is
  try/caught; all structural and per-entry validation is pure value-returning
  logic with no unguarded throw surface. `loadExemptions` runs at
  `handoff.ts:536`, before `readAndMigrate`, on the mandatory `tw_get_state`
  pre-flight path — a throw here would brick every role's first action in the
  workspace, so this property is load-bearing and was exercised directly
  (test L8: chmod-based unreadable-file case, never throws).
- **Never-silently-exempt fail direction confirmed** across every malformed
  shape exercised in tests L4-L7: bad JSON, non-object root (array / string /
  number / null), unsupported/future `schema_version` (including the string
  `"1"` vs numeric `1` distinction), and non-array `exemptions` all collapse
  to zero exemptions + a loud `errors[]` entry — never to a granted
  exemption. Per-entry malformation (test L3) drops only that entry with its
  own loud error while valid siblings survive.
- **`count === valid-entries-only`** (test L9 + L3): the metric counts pushed
  entries, never raw JSON array length — confirmed with a 3-entry list
  containing one valid, one missing-field, and one non-object candidate,
  yielding `count: 1`.
- **Envelope surface on both branches** (tests G1/G2) and **key entirely
  absent when no manifest exists** on both branches (test G3) — confirmed by
  direct `JSON.parse(readHandoffState(ws))` inspection rather than trusting
  the reviewer's read of the source; `"exemptions" in json` is `false` on
  both the fresh (`exists:false`) and established (`exists:true`) paths when
  `.current/exemptions.json` is absent.
- **const-05 §2 prose pin** (tests P1-P5): the "ONLY sanctioned exemption
  channel" sentence, the three-field shape (`path`/`reason`/`expires_when`),
  the prose-only-counts-as-NOT-exempted rule, the malformed-manifest-exempts-
  nothing rule, and the monitored-only-grows-metric/human-approval rule are
  all pinned verbatim against the shipped file.

No new findings beyond code-reviewer's APPROVED verdict; QA's job here is
tests + the token-budget re-baseline, not a second correctness pass.

## Phase 3 — Tests

Test File Discovery: no pre-existing test file covered this feature; authored
`test/e24-exemptions.test.mjs` (18 tests) per the sr-engineer qa-expectations
pending note.

Spec(backlog row)-to-Test map:
- Loader never-throw / never-silently-exempt matrix → L1 (absent), L2/L2b
  (valid, absent-version-defaults-to-1), L3 (mixed-validity), L4 (bad JSON),
  L5 (non-object root), L6 (future schema_version), L7 (non-array
  `exemptions`), L8 (unreadable file), L9 (count is valid-only)
- `tw_get_state` envelope surface → G1 (exists:false surfaces), G2
  (exists:true surfaces), G3 (key absent on both branches when no manifest)
- const-05 §2 prose pin → P1-P5

Coverage: `tools/exemptions.ts` is fully covered by L1-L9 (every branch:
ENOENT, read-error, parse-error, non-object root, bad schema_version,
non-array list, per-entry valid/invalid, count computation). The
`tools/handoff.ts` `loadExemptions` wiring is covered by G1-G3 on both
envelope branches.

Security smoke: L8 exercises a permissions-boundary failure mode
(sandbox-agnostic — asserts internal consistency rather than assuming 0o200
enforcement, since a root-run sandbox may bypass file permission bits); L4-L7
exercise adversarial/malformed input at the JSON trust boundary (bad JSON,
wrong types, non-object roots, unsupported version) and confirm none of them
throw or silently grant an exemption.

## Phase 4 — Run

- Crash checkpoint written via `tw_update_state(bookkeeping_write=true)`
  before the final regression run (E21).
- Build: `npm run build` (`tsc`) — zero errors.
- `npm test` (prebuild + `node --test test/*.test.mjs`): **1521/1521 pass**,
  0 fail, 0 cancelled, headless, zero human interaction.

## Verdict

PASS. Loader never-throw and never-silently-exempt invariants hold under
direct test exercise; both `tw_get_state` envelope branches surface
exemptions correctly and omit the key when absent; `count` is confirmed
valid-entries-only; the const-05 §2 prose is pinned; the 4 declared
context-budget pins are re-baselined to independently-verified measured
values (4485/8625/16720/6528 ~tok); full suite is green at 1521/1521.
## 2026-07-15T07:20:19.841Z — PASS — by qa-engineer

PASS. Authored test/e24-exemptions.test.mjs (18 tests: L1-L9 never-throw loader matrix, G1-G3 tw_get_state envelope surface incl. absent-key check, count-valid-only, P1-P5 const-05 §2 prose pin). Phase 0.5 Expected-Red Diff clean: pre-edit full-suite run (git-stash isolated) showed exactly the 4 declared context-budget pins red, 0 unexplained; re-baselined to independently re-measured values (4485/8625/16720/6528 ~tok, matching sr's declared figures). Full suite 1521/1521 green post-edit, tsc zero errors. Commit 271c5d0. Evidence: qa_reports/review_T-E24-01.md (covers all 3 ids).

## 2026-07-15T07:21:12.248Z — PASS — by qa-engineer

PASS. Authored test/e24-exemptions.test.mjs (18 tests: L1-L9 never-throw loader matrix, G1-G3 tw_get_state envelope surface incl. absent-key check, count-valid-only, P1-P5 const-05 §2 prose pin). Phase 0.5 Expected-Red Diff clean: pre-edit full-suite run (git-stash isolated) showed exactly the 4 declared context-budget pins red, 0 unexplained; re-baselined to independently re-measured values (4485/8625/16720/6528 ~tok, matching sr's declared figures). Full suite 1521/1521 green post-edit, tsc zero errors. Commit 271c5d0. Evidence: qa_reports/review_T-E24-01.md (covers all 3 ids).

