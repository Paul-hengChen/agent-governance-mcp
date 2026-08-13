# Review — T-E39-03 (E39 + E58 fold-in, QA test surface)

covers: T-E39-01, T-E39-02, T-E39-03

Reviewed by @qa-engineer (sonnet). Code review APPROVED at round 3
(`review_reports/review_T-E39-01.md`) — this review does not re-open C1-C4/Q1-Q3/N1-N5;
it owns only the test surface named in T-E39-03 and the PASS decision on
T-E39-01/T-E39-02/T-E39-03.

## Expected-Red Diff

`qa_reports/expected-red_e39-e58-transition-matrix-sync.txt` exists, feature-scoped to
`e39-e58-transition-matrix-sync`, one entry:

> `test/qa-flow.test.mjs | T-E53-03(h): exhaustive matrix sweep — accepted edge set is
> EXACTLY the 68 tuples E53 leaves standing`

Confirmed red pre-edit (`npm test` before this round's changes: 1693/1694, sole failure
`not ok 1048 - T-E53-03(h)`, matching the manifest exactly). Disposition: genuine
expected-red, not a regression — E58 added a 69th accepted edge
(`pm:Blocked -> design-auditor:In_Progress`) to `tools/transitions.ts`, and the sweep is
a literal snapshot of the prior 68-tuple universe, so it necessarily fails until
extended. Fixed by this round (see Phase 3 below); 1/1 manifest entry confirmed red,
then confirmed turned green by the extension, 0 unexplained reds in the post-edit run.
Phase 0.5: clean.

## Phase 1 — Review

No `specs/e39-e58-transition-matrix-sync.md` or `design/e39-e58-transition-matrix-sync.md`
exists — this is a mini-chain, backlog-row-as-spec dispatch
(`.current/handoff.md` `scope_decision_why`: PM/architect skipped, backlog rows +
`.current/feature-split.md` F0 serve as the spec). Consequently:

- **Phase 3a Copy Audit Gate**: N/A, no spec Copy/Strings H2 exists. Skipped.
- **Phase 3b Visual Audit Gate**: N/A, no spec Visual Tokens H2 exists. Skipped.
- **Phase 1.5 Visual Compare**: no `design/<feature>.md`, no Visual Baselines H2.
  Skipped (`content/skill-qa-visual.md` not read).
- **Phase 3.5 AC Execution**: no `specs/<active_feature>.md` to scan for `proof:`
  annotations. Skipped.

Implementation review of the shipped diff (`specs/qa-flow-enforcement-architecture.md`
re-derive, `tools/transitions.ts`'s one E58 entry, `scripts/check-transitions-sync.mjs`,
`package.json` wiring) was already carried out exhaustively across three code-review
rounds — 21/21 keys re-derived independently three times, E58's edge isolated as the
sole source change, the wiring proven load-bearing by execution, the duplicate-row and
line-exact-anchor behaviors probed on an isolated fixture. QA scope (skill-qa-engineer
§Scope) is tests/coverage, not re-litigating correctness/architecture the reviewer
already cleared; no new correctness concern surfaced while building the test coverage
below.

## Phase 3 — Tests

### (1) E53 sweep extension — `test/qa-flow.test.mjs`

Extended (not rewritten) the `T-E53-03(h)` exhaustive sweep:

- Added `"pm:Blocked -> design-auditor:In_Progress"` to the `EXPECTED` array (kept
  alongside the sweep's existing `.sort()`, so array insertion position doesn't matter).
- `assert.equal(sortedAccepted.length, 68, ...)` -> `69`.
- Test name/WHY-comment updated for accuracy: "68 tuples E53 leaves standing" ->
  "69 tuples E53+E58 leave standing" — the prior wording would otherwise assert a false
  tuple count and mis-attribute the 69th edge to E53 alone. (The section's own top-level
  WHY comment at `test/qa-flow.test.mjs:2230,2370`, which describes E53's own point-in-time
  63->68 review differential, is left untouched — that is a historical claim about E53's
  own review artifact, still true.)

**Verified the count moves 68 -> 69**: `node --test --test-name-pattern="T-E53-03"
test/qa-flow.test.mjs` -> 8/8 pass, including `(h)`.

**Verified the negative property survives the edit** (the sweep's whole point — any
OTHER edge opening or closing must still fail it) by direct experiment against the
compiled artifact the test actually imports (`dist/tools/transitions.js`, backed up
first, restored after, `git diff` confirmed clean afterward — the real tree was never
left mutated):

- Opened an unrelated bogus edge (`architect:In_Progress -> qa-engineer:In_Progress`)
  -> sweep failed: `expected 69, actual 70`.
- Closed the E58 edge itself (removed `design-auditor:In_Progress` from `pm:Blocked`)
  -> sweep failed: `expected 69, actual 68`.
- Restored the original compiled file; `git diff dist/tools/transitions.js` shows
  exactly the one sanctioned 10-line E58 hunk versus HEAD (no residue from the
  experiment).

### (2) `scripts/check-transitions-sync.mjs` coverage — `test/check-version.test.mjs`

Used the file `tasks.md` T-E39-03 item (2) names as the closest existing home for a
`scripts/`-level checker; no reason found to deviate. Followed its established
pattern (its own header, lines 9-16): copy the real script byte-for-byte into a temp
fixture root (`fs.mkdtempSync`), lay out a synthetic `dist/tools/transitions.js` +
`specs/qa-flow-enforcement-architecture.md` beside it, `spawnSync` the copy — the real
repo's `dist/` and `specs/` are never touched. One addition versus the existing CV
fixtures: `check-transitions-sync.mjs` dynamically `import()`s `dist/tools/transitions.js`
(unlike `check-version.mjs`, which only ever regex-reads `dist/index.js` as text), so
each fixture root also gets its own `{"type":"module"}` `package.json` — the nearest one
Node's ESM loader finds when resolving a bare `.js` file's module format.

10 new tests (`CTS-1`..`CTS-10`), covering every item T-E39-03(2) named at minimum, plus
the two-round-2/3 line-exact-anchor directions and the two duplicate-row shapes the
reviewer manually probed three times:

| id | scenario | expectation |
|---|---|---|
| CTS-1 | corrected tree, dist and mirror agree | exit 0, `OK (2 keys, exact match...)` |
| CTS-2 | doc-side omission (row missing from mirror) | RED, names the missing key |
| CTS-3 | doc-side extra row (in doc, absent from source) | RED, names the extra key |
| CTS-4 | heading absent entirely | RED, "could not find a line-exact...", not vacuous |
| CTS-5 | line-exact anchor: heading renamed (`MatrixX`) | RED — does not bind to a near-miss |
| CTS-6 | line-exact anchor: inline prose mention of heading text elsewhere | exit 0 — healthy doc unaffected |
| CTS-7 | duplicate-row guard: wrong row first, correct row second | RED, never prints `OK (` — pins the exact round-1 false-green shape |
| CTS-8 | duplicate-row guard: correct row first, wrong row second | RED, BOTH duplicate message AND entry-set diff fire |
| CTS-9 | `dist/tools/transitions.js` absent | RED, fails loud, no unbuilt-checkout skip |
| CTS-10 | heading found but zero data rows (`## ` heading interposed before the table) | RED, "parsed ZERO data rows", not vacuous |

All 10 run against the actual shipped script logic (not a reimplementation) — traced
every assertion against a full read of `scripts/check-transitions-sync.mjs` before
writing the fixtures, so each RED case targets the exact code path that produces it
(header-not-found branch vs. zero-data-row branch vs. duplicate-guard branch vs.
missing-dist branch are four distinct branches in the script, and CTS-4/CTS-10 and
CTS-2/CTS-3 deliberately exercise different ones rather than one case standing in for
all).

**Spec-to-test map** (T-E39-03's own three items):
- Item (1) extend sweep -> `test/qa-flow.test.mjs` `T-E53-03(h)` (above).
- Item (2) sync-check coverage -> `test/check-version.test.mjs` `CTS-1`..`CTS-10`.
- Item (3) verify check green against shipped tree -> Phase 4 below (`npm run build`
  postbuild output).

**Coverage**: `scripts/check-transitions-sync.mjs` is a single-file, no-dependency
script with 4 top-level failure branches (missing dist, unparseable dist, heading not
found, zero data rows) plus the diff/duplicate logic; all reachable branches are hit by
CTS-1..CTS-10 above. No coverage tooling wired for `scripts/` in this repo; noted per
SOP 6c in lieu of a numeric figure.

**Security smoke**: boundary inputs exercised — empty parse (CTS-4/CTS-10), absent file
(CTS-9), malformed/duplicate structured input (CTS-7/CTS-8). No auth/permission surface
in this script (read-only, no argv/env-derived paths per the reviewer's Security
section) — no additional smoke tests needed.

## Phase 4 — Run

- **Build**: `npm run build` — `prebuild` (`check:version` OK 3.98.0) -> `tsc` (0
  errors) -> `postbuild` (`check:transitions-sync — OK (21 keys, exact match between
  dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)`). Confirms
  T-E39-03 item (3) directly: the check is green against the shipped tree.
- **Audit**: `npm audit --audit-level=high` — exit 0. 6 advisories (2 low, 4 moderate:
  `@hono/node-server`, `body-parser`, `esbuild`, `hono`, `protobufjs`), none HIGH/CRITICAL.
  `package.json`'s only diff this cut is the two script-lifecycle entries from T-E39-01
  (`check:transitions-sync`, `postbuild`); no dependency added, `package-lock.json`
  untouched — Constitution §6 dependency-audit gate does not fire.
- **Test**: `npm test` — **1704/1704 pass, 0 fail** (`# tests 1704 / # pass 1704 / # fail 0`).
  1694 baseline + 10 new `CTS-*` tests; `T-E53-03(h)` now passes at 69 tuples. CI
  runnability: headless, zero interaction, standard `node --test` exit code.

## Cut hygiene

`git status --short` after this round shows only my own edits
(`test/qa-flow.test.mjs`, `test/check-version.test.mjs`), the state-write side effects
(`.current/handoff.md`, `.current/telemetry.jsonl`), and the already-approved cut
(`specs/qa-flow-enforcement-architecture.md`, `tools/transitions.ts`, `package.json`,
`dist/tools/transitions.*`, `docs/backlog.md`, `.current/feature-split.md`,
`qa_reports/expected-red_*`, `review_reports/review_T-E39-01.md`,
`scripts/check-transitions-sync.mjs`). No `test/` file other than the two named above
was touched; no out-of-scope file was created.

## Out of scope (routed, not actioned)

Per the code-reviewer's round-3 notes and this ticket's own dispatch brief: N6/N7/N8 are
coordinator-facing content/backlog follow-ups (footnote completeness, the stale
"Authoritative source" sentence, E62 scope), not sr defects and not part of QA's test
surface. Not actioned here.

## Verdict

**PASS.** Both T-E39-03 test-surface items land: the E53 sweep is extended (not
rewritten) with its count and negative property verified by direct experiment, and
`scripts/check-transitions-sync.mjs` — which shipped with zero coverage — now has 10
tests pinning the exact contract three code-review rounds verified by hand (duplicate-
row guard, both directions of the line-exact anchor, both no-table branches, the
missing-dist hard failure). Build green with `postbuild` printing `OK (21 keys, exact
match)`; `npm audit --audit-level=high` clean of HIGH/CRITICAL; full suite
**1704/1704**, the previously-declared expected-red now closed. T-E39-01 and T-E39-02
were already code-review APPROVED (round 3, `review_reports/review_T-E39-01.md`) and are
completed here as part of this same PASS per this feature's dispatch shape (mini-chain,
qa owns the close for all three ids).
## 2026-08-12T08:41:34.663Z — PASS — by qa-engineer

PASS. T-E39-03 test surface closed: (1) T-E53-03(h) sweep extended 68->69 with pm:Blocked->design-auditor:In_Progress; count-move and negative property (fails if any OTHER edge opens/closes) verified by direct perturbation of dist/tools/transitions.js, restored clean (git diff shows only the sanctioned E58 hunk). (2) scripts/check-transitions-sync.mjs — zero prior coverage — now has 10 tests (CTS-1..CTS-10) in test/check-version.test.mjs (the pre-cleared sanctioned home) pinning: green on corrected tree; RED on doc-side omission/extra row; RED (not vacuous) when heading absent or table truncates to zero rows; line-exact anchor both directions (rename fails, prose-mention passes); duplicate-row guard both shapes (wrong-then-correct pins the round-1 false-green; correct-then-wrong fires both messages); missing-dist fails loud. (3) Verified check green against shipped tree via npm run build. Full build green (postbuild OK 21 keys exact match); npm audit --audit-level=high clean of HIGH/CRITICAL (6 pre-existing moderate/low advisories, no lockfile change); npm test 1704/1704 pass (1694 baseline + 10 new), the declared expected-red (T-E53-03(h)) now closed. No out-of-cut file touched. Evidence: qa_reports/review_T-E39-03.md covering T-E39-01, T-E39-02, T-E39-03. Note for coordinator: hop_count was 8/10 pre-write; this PASS is a same-agent status change and is not hop-counted, so the cap is unaffected by this write, but is close enough to flag if any further round is needed on this feature.

