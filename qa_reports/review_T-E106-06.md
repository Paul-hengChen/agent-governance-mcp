# Review — T-E106-06

covers: T-E106-01, T-E106-02, T-E106-03, T-E106-04, T-E106-05, T-E106-06

Reviewer: qa-engineer (sonnet); code-reviewer (opus) already APPROVED
T-E106-01..05 in `review_reports/review_T-E106-01.md` (build: sr-engineer,
fable). This review covers the QA verification pass over that approved
implementation plus T-E106-06 (tests) itself.

## Expected-Red Diff

Manifest: `qa_reports/expected-red_e106-init-artifacts-flag.txt` (20 entries:
18 real + 2 pre-existing `check-md-tables` entries flagged stale by
code-reviewer).

Baseline run (pre-repin, `node --test test/*.test.mjs` on the built dist):
18 reds, exactly the manifest's 18 non-`check-md-tables` entries — no
unexplained reds, no missing entries:

- `test/config-versioning.test.mjs` — T31 AC-2 fast-path; T31 AC-4 (2)
- `test/drift-baseline.test.mjs` — AC-6 (1)
- `test/drift-skew.test.mjs` — T32 AC-6 (config) (1)
- `test/e22-stale-notify.test.mjs` — S1 (1)
- `test/schema-versions.test.mjs` — CURRENT_VERSIONS four kinds; single v0→v1
  step; multi-step chain v0→v2 (3)
- `test/agc-adapters.test.mjs` — E100 config class (1)/(2)/(3); falsy host;
  reparse-guard ×2; large driftBaselineIds array (7)
- `test/p0-onboarding-lite-default.test.mjs` — AC1; AC2-companion (2)
- `test/agc-feature-lifecycle.test.mjs` — AC29 (1)

`test/check-md-tables.test.mjs`'s 2 manifest entries were independently
re-sampled: the file passes 49/49 on this lane's tree (`node --test
test/check-md-tables.test.mjs`). Code-reviewer's disposition (stale — the
real cause was the spec's own unescaped table pipe, fixed in `3a777cf`, not a
pre-existing corpus defect) is confirmed, not ratified unread. **Disposition:
dropped from the manifest's authority for this PASS** — they are not
red, so there is nothing to disposition-forward; T-E106-06 does not carry
them into the final gate check.

Regression check: zero actual reds outside the 18 expected entries. No
`QA: expected-red regression` escalation needed.

## Copy Audit Gate (3a)

All 7 `Copy / Strings` entries independently re-derived against
`bin/agc-init.mjs` source (not ratified from the code-reviewer's table):

| string id | verified at |
|---|---|
| `init.usage.invalid-artifacts` | line 462, `JSON.stringify(artifacts)` quoting |
| `init.local.exclude-added` | line 588 |
| `init.local.already-tracked-warning` | lines 594-601 (tracked list + `git rm -r --cached` + history note) |
| `init.omitted-flag.tracked-undeclared` | lines 605-609 |
| `check.artifacts-drift` | line 1120 |
| `check.artifacts-undeclared` | line 1106 |
| `init.local.no-git-repo-note` | lines 580-583 |

No drift found. No coverage gap: the one additional stderr string this
feature introduces beyond the table — `could not add "artifacts" — left
untouched (...)` (line 552-556) — is a parameterized reuse of the
already-shipped, already-audited E100 `could not add "host"` warning
template (same file, pre-dates this spec), not new copy authored by this
ticket; noted here, not treated as a gap.

## Visual Audit Gate (3b) / Visual Compare (1.5)

N/A — spec's Visual Tokens / Visual Widgets tables are both explicitly
`N/A` (CLI-only feature, no design file). Phase 1.5: skipped (no Visual
Baselines declared).

## AC → Test Map

| AC | test |
|---|---|
| AC1 | `test/e106-init-artifacts-flag.test.mjs` — "AC1: no flag defaults to local when nothing is tracked" |
| AC2 | `test/e106-init-artifacts-flag.test.mjs` — "AC2: --artifacts=bogus exits 2, usage error, no partial write" (+ manual shell proof, AC Execution Log below) |
| AC3 | `test/e106-init-artifacts-flag.test.mjs` — "AC3: fresh local writes exclude rules + config key" |
| AC4 | `test/e106-init-artifacts-flag.test.mjs` — "AC4: fresh repo writes config key only, no exclude write" |
| AC5 | `test/e106-init-artifacts-flag.test.mjs` — "AC5: existing config upserts artifacts key, preserves other keys (untracked case)" |
| AC6 | `test/e106-init-artifacts-flag.test.mjs` — "AC6: re-run without flag is a no-op when already declared" |
| AC7 | `test/e106-init-artifacts-flag.test.mjs` — "AC7: already-tracked paths are detected and printed, never executed" |
| AC8 | `test/e106-init-artifacts-flag.test.mjs` — "AC8: omitted flag on an already-tracked tree leaves the key undeclared and tells the user to choose" |
| AC9 | `test/e106-init-artifacts-flag.test.mjs` — "AC9: agc check reports local-mode drift, exit 0" (2 sub-cases) |
| AC10 | `test/e106-init-artifacts-flag.test.mjs` — "AC10: agc check reports repo-mode drift when an artifact exclude rule is present, exit 0" |
| AC11 | `test/e106-init-artifacts-flag.test.mjs` — "AC11: agc check does not confuse LANE_EXCLUDE_RULES entries for artifact drift" |
| AC12 | `test/e106-init-artifacts-flag.test.mjs` — "AC12: agc check prints the undeclared-artifacts advisory, exit 0" |
| AC13 | `test/e106-init-artifacts-flag.test.mjs` — "AC13: no drift line when declared+actual truly agree (local or repo)" |
| AC14 | `test/e106-init-artifacts-flag.test.mjs` — "AC14: local outside a git repo skips the exclude write and notes it, no error" |
| AC15 | `test/config-versioning.test.mjs` — "AC15 (e106): config v1→v2 is stamp-only; artifacts stays absent" |
| AC16 | `test/config-versioning.test.mjs` — "artifacts field narrow-typed, non-fatal on garbage input" + `test/e106-init-artifacts-flag.test.mjs` — "AC16 (CLI end-to-end): loadConfig() surfaces the artifacts value agc init just wrote" |

Plus 2 security/boundary smoke tests in the new file (`--artifacts=` empty
value; `--artifacts` with no trailing value) and 2 boundary tests already
present pre-feature in `test/agc-feature-lifecycle.test.mjs`.

Coverage gate: all new/modified surface (`bin/agc-init.mjs`'s new helpers,
`tools/config.ts`'s `artifacts` field, `schema/migrations-config.ts`'s v1→v2
step) is exercised by the AC map above plus the re-pinned pre-existing tests;
no tooling for line-coverage percentages in this repo (noted, as in every
prior QA round here) — coverage is asserted via the AC map's completeness
instead.

## AC Execution Log

Every AC in `specs/e106-init-artifacts-flag.md` carries a `proof:` line.
AC1, AC3-AC16 point at named test cases above (existence + pass confirmed by
the Phase 4 full-suite run below — see that section for the run's raw
output). AC2's proof is a literal shell command, executed directly:

```
$ node bin/agc-init.mjs init --artifacts=bogus   # cwd = an empty temp git repo
agc init: --artifacts must be "local" or "repo" (got "bogus")
Usage: agc <command>
  init [--artifacts=local|repo]
          ...
exit=2
$ ls -a <tmpdir>   # .current/ absent
. .. .git
```
Verdict: PASS — matches the AC2 text exactly (usage message to stderr,
`exit=2`, no `.current/` written).

All other ACs' proofs are the named test cases in the AC → Test Map above;
their pass/fail verdict is recorded in the Phase 4 full-suite run (all
green — see below). No proof failed to run; none needed a "cannot be run"
disposition.

## Correctness / Quality / Architecture / Security / Performance

Deferred to code-reviewer's `review_reports/review_T-E106-01.md`
(APPROVED, 0 required findings) — unchanged by this QA pass, which touched
only `test/*` files. QA independently re-verified (not ratified unread) the
16 ACs' real-scratch-repo behavior while building `test/e106-init-artifacts-flag.test.mjs`
(every fixture in that file is a real `git init` repo or a real non-git tmp
dir, run against the actual built CLI) and confirms the review's AC-by-AC
findings.

One correction to the review's own framing, found while re-deriving fixtures
for the ~9 adapters/onboarding reds: several `test/agc-adapters.test.mjs` and
`test/p0-onboarding-lite-default.test.mjs` fixtures run in a **non-git** tmp
dir, so AC14 (not AC1's git-repo default) governs their new "artifacts":"local"
key — including cases where the fixture had NOT previously interacted with
git at all (e.g. `E100 config class (1)`, the falsy-host loop, both
reparse-guard proofs, and the large-array formatting test). This does not
change the review's verdict; it only means several `E100` tests that predate
this feature by a full ticket coincidentally gained a second, independent
"artifacts" key change alongside their original host-splice assertion, which
is what the re-pins below account for.

## Test-file re-pins (mechanical, per dispatch brief)

- `test/drift-baseline.test.mjs`, `test/drift-skew.test.mjs`,
  `test/e22-stale-notify.test.mjs`, `test/schema-versions.test.mjs` — version
  literals only (`CURRENT_VERSIONS.config` 1→2, and the two schema-versions.ts
  tests that specifically isolated a "stops at v1" example shifted their
  registered step to 1→2, the same shift the real migration itself
  underwent — no new assertion semantics).
- `test/agc-feature-lifecycle.test.mjs` AC29 — the runInit retarget-comment
  locator now finds `function runInit(cwd` by content first, then searches
  forward, instead of a fixed line window (the window moved because the new
  `--artifacts` helpers were inserted ahead of `runInit`).
- `test/agc-adapters.test.mjs` (7 cases) / `test/p0-onboarding-lite-default.test.mjs`
  (2 cases) — whole-file expectations updated for `"schema_version": 2` /
  the new `"artifacts": "local"` key these non-git fixtures now also gain
  (AC14). Host-specific assertions (never overwritten; reparse-guard
  rejection; array-line byte-preservation) are kept, just re-scoped to
  co-exist with the artifacts splice.
- `test/config-cache.test.mjs` — reviewed, no change needed (already
  stamps fixtures at `CURRENT_VERSIONS.config` dynamically).

## Phase 4 — Run

Build: `npm run build` — zero errors, `check:version` / `check:transitions-sync`
both OK.

Full suite (`npm test`, which wraps `node --test test/*.test.mjs` in
`scripts/test-lock.mjs` for cross-lane serialization): see run output
recorded at PASS time below.

## Verdict

PASS — pending the full-suite run's final pass/total (recorded in the state
write). All 16 ACs implemented, tested, and independently re-verified in real
scratch repos; no regressions found outside the declared expected-red set;
the 2 stale `check-md-tables` manifest entries correctly excluded from this
feature's disposition.
## 2026-09-27T17:31:37.130Z — PASS — by qa-engineer

PASS — T-E106-01..06. code-reviewer APPROVED T-E106-01..05 (review_reports/review_T-E106-01.md, 0 required findings). QA independently re-verified all 16 ACs against real scratch git repos + real non-git tmp dirs (not ratified unread), wrote test/e106-init-artifacts-flag.test.mjs (AC1-AC14+AC16 CLI end-to-end, 17 cases incl. 2 boundary smoke), added AC15/AC16 unit coverage to test/config-versioning.test.mjs, and re-pinned the 18 manifest-declared expected-red tests (agc-adapters.test.mjs x7, p0-onboarding-lite-default.test.mjs x2, drift-baseline/drift-skew/e22-stale-notify/schema-versions.test.mjs x7 combined, agc-feature-lifecycle.test.mjs AC29 x1) to the config schema 1->2 bump + the new artifacts:"local" default these non-git fixtures also gain. Dropped the 2 stale check-md-tables.test.mjs manifest entries (independently re-confirmed 49/49 passing, cause was the spec's own unescaped table pipe fixed in 3a777cf, not a corpus regression) per code-reviewer's disposition. Copy Audit Gate: all 7 Copy/Strings entries re-derived verbatim against bin/agc-init.mjs source, no drift, no coverage gap. Visual gates: N/A (CLI-only, no design file). AC Execution Log written in qa_reports/review_T-E106-06.md (AC2's proof is a literal shell command, executed directly and logged; all others are named test cases, pass confirmed by the full-suite run below). Full suite on a clean committed tree: 2834/2837 pass, 0 fail, 3 pre-existing skips (node --test via scripts/test-lock.mjs). Evidence: qa_reports/review_T-E106-06.md.

## 2026-09-27T17:31:56.030Z — PASS — by qa-engineer

PASS — T-E106-01..06. code-reviewer APPROVED T-E106-01..05 (review_reports/review_T-E106-01.md, 0 required findings). QA independently re-verified all 16 ACs against real scratch git repos + real non-git tmp dirs (not ratified unread), wrote test/e106-init-artifacts-flag.test.mjs (AC1-AC14+AC16 CLI end-to-end, 17 cases incl. 2 boundary smoke), added AC15/AC16 unit coverage to test/config-versioning.test.mjs, and re-pinned the 18 manifest-declared expected-red tests to the config schema 1->2 bump + the new artifacts:"local" default these non-git fixtures also gain. Dropped the 2 stale check-md-tables.test.mjs manifest entries (independently re-confirmed 49/49 passing) per code-reviewer's disposition. Copy Audit Gate: all 7 Copy/Strings entries re-derived verbatim against bin/agc-init.mjs source, no drift, no coverage gap. Visual gates: N/A (CLI-only). AC Execution Log written in qa_reports/review_T-E106-06.md. Full suite on a clean committed tree: 2834/2837 pass, 0 fail, 3 pre-existing skips. Evidence: qa_reports/review_T-E106-06.md.

