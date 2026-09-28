# Review — T-E90-02

covers: T-E90-01, T-E90-02

Feature: `e90-golden-capture-completeness` (backlog E90, order 13e)
Round: 1 — by qa-engineer (sonnet), after round-1 APPROVED from code-reviewer
(`review_reports/review_T-E90-01.md`)
Under verification: `scripts/capture-constitution-golden.mjs` (1 file, +107/−33,
sr-engineer). Nothing under `test/` had been touched before this round —
confirmed via `git status` at claim time.

Mini-chain: `docs/backlog.md`'s `| E90 |` row (line 213) and `tasks.md`'s
T-E90-01/T-E90-02 rows are the spec. No `specs/<feature>.md`, no
`design/<feature>.md`, no `qa_reports/expected-red_e90-golden-capture-completeness.txt`.

## const-05 branch disclosure (E43, content/const-05-core-standards.md:9)

Branch **(a)**: the dispatch brief pre-authorized new-test-file creation by
name — "Test-file placement: creation is pre-authorized for this ticket...
a new `test/e90-*.test.mjs` is equally acceptable" — so `test/e90-golden-capture-completeness.test.mjs`
was created without an ask, per branch (a)'s "proceed on it, no ask."

## Phase 0.5 — Expected-Red Diff

Skipped (no expected-red manifest declared; no `dispatch_mode: bugfix`).

## Phase 1 — Review (re-derived, not replayed)

Both prior roles' claims were independently re-derived rather than trusted:

1. **Build**: `npm run build` — clean, twice (once before manual verification,
   once before the full-suite run below). `check:version` and
   `check:transitions-sync` both OK.

2. **Byte-identity by execution (T-E90-01 acceptance)**: from a confirmed-clean
   `git diff test/fixtures/compose-golden/`, ran
   `node scripts/capture-constitution-golden.mjs` fresh. Output: "Captured 12
   golden fixtures", exit 0. `git diff --exit-code test/fixtures/compose-golden/`
   → exit 0. All 12 fixtures byte-identical to committed.

3. **Derivation genuineness — deletion**: `rm constitution-monolith.txt
   skill-coordinator-monolith.txt` (both previously-uncapturable fixtures) →
   10 files remained. Re-ran the script → "Captured 12 golden fixtures", exit
   0, both files restored. `git diff --exit-code` → exit 0 (byte-identical
   restoration, not merely "a file reappeared").

4. **Derivation genuineness — perturbation**: overwrote both files with junk
   (`echo "CORRUPTED-JUNK-BYTES" > ...`), confirmed `git diff --stat` showed
   the corruption (514 lines removed across both). Re-ran the script → exit 0,
   `git diff --exit-code` → exit 0. Confirms the script OVERWRITES rather than
   skip-if-exists — ruling out "accidentally untouched," which was the
   specific concern in the dispatch brief.

5. **Fail-loud (E90's sharper half)**: copied the script into `scripts/` (so
   `__dirname`-relative `ROOT` resolution stays correct — a `/tmp` copy
   resolves `ROOT` wrong), patched the constitution-monolith derivation to
   `""`. Ran it: uncaught `Error: refusing to write empty fixture
   constitution-monolith.txt (...) — derivation produced no bytes`, **exit 1**.
   Confirms an empty derivation throws and halts rather than printing a benign
   note and exiting 0 — the exact defect class E90 was filed over. (Partial-
   failure note, matches code-reviewer's item 4: the 10 fixtures before the
   throw point were already rewritten; acceptable for a `git diff`-inspected
   regeneration tool, not a transaction.) Confirmed the working tree was
   unaffected afterward (`git diff --exit-code test/fixtures/compose-golden/`
   → exit 0) and deleted the probe file.

6. **Residual path, reproduced independently** (code-reviewer's item 3, "for
   QA"): built a probe copy of the script with the `skill-coordinator-
   monolith.txt` `writeFixture(...)` call removed, then moved the real
   `skill-coordinator-monolith.txt` fixture OUT of `test/fixtures/compose-golden/`
   before running the probe. Result: "Captured 11 golden fixtures", **exit 0**
   — the internal `onDisk − captured` guard cannot see a fixture that is
   absent from BOTH sets. Restored the fixture from the temp copy immediately
   after; final `git diff --exit-code test/fixtures/compose-golden/
   scripts/capture-constitution-golden.mjs` showed only the expected T-E90-01
   script diff, nothing else. This is exactly the gap the class guard (below)
   closes, since it derives its "asserted" set from the TEST FILES' OWN
   source rather than from the on-disk directory, so an assertion that
   depends on a fixture no one ever captured or wrote is visible even when
   the fixture is entirely absent.

## Phase 2 — Discussion

No blocking findings from Phase 1. Two non-blocking nits carried over from
`review_reports/review_T-E90-01.md` (Quality section): `const written = []`
declared after the `writeFixture` closure that references it (TDZ hazard only
for a future capture inserted between), and the "Captured 12 golden fixtures"
banner printing before the completeness guard's `stderr`/`exit 1`. **Decision:
not worth closing.** Both are demonstrated safe today (reviewer verified every
call site sits below the `written` declaration; the exit code and stderr are
both correct regardless of banner ordering), the file is sr-owned (not a test
file — §2 doesn't reach it, and re-opening a round for cosmetic-only reordering
in an already-APPROVED, zero-blocking-finding diff costs a full sr round-trip
for zero behavior change). Recorded here rather than silently dropped.

## Phase 3 — Tests

**3a Test File Discovery**: per the dispatch brief's `Test-file placement`
line (branch (a), pre-authorized), created `test/e90-golden-capture-completeness.test.mjs`.
`test/compose-equivalence.test.mjs` and `test/skill-manifest.test.mjs` (the
two suites that own the fixtures) were read but not modified — they are
consumers of the class guard's `assertedSet`, not places to add it, since the
guard's job is comparing what THEY assert against what the script captures,
not adding another instance-level assertion inside either.

**3b Spec-to-Test Map** (backlog `| E90 |` row + `tasks.md` T-E90-01/T-E90-02
rows are the spec):

| Requirement | Test |
|---|---|
| T-E90-01(a)/(b): script captures all 12, not 10 | `t-captured-equals-on-disk` (capturedSet == onDiskSet, both size 12) |
| T-E90-02: "every fixture the suite asserts against must have a capture in the script" | `t-asserted-equals-on-disk` (assertedSet == capturedSet == onDiskSet) |
| No accidental duplicate capture | `t-no-duplicate-captures` (capturedSet.size === 12, not just a coincidental match) |

**Design — class assertion over instance pins** (E66 option (ii) / E69
precedent, per the dispatch brief): the shipped test is **static source-text
extraction**, not script execution, for two reasons: (1) executing the real
script from inside `npm test` would make every test run silently rewrite the
committed oracle fixtures — wrong for a suite whose premise is an inert
oracle; (2) the extractors key off literal calls to the `writeFixture(...)`
helper (E90's own addition), which makes them airtight against the specific
historical failure mode without needing to model the old conditional branch.

**Soundness verification against the real pre-E90 script** (not shipped — a
throwaway git-blob check, done by hand this round): extracted `HEAD`'s
committed `scripts/capture-constitution-golden.mjs` (the exact pre-T-E90-01
version, since sr-engineer's fix is still an uncommitted working-tree edit)
to `/tmp/pre-e90-script.mjs` via `git show HEAD:scripts/capture-constitution-golden.mjs`,
then ran the shipped test's own extractor functions against it directly:

```
buildModes: 8   hooks: 2   writeFixture literal calls: 0   (fn doesn't exist pre-E90)
TOTAL capturedSet size (pre-E90 reconstruction): 10  -- vs 12 on disk/asserted
```

Then re-ran the actual shipped test FILE (a patched copy with only
`SCRIPT_PATH` repointed at the pre-E90 blob, `ROOT` still resolving to the
real repo for the fixture dir and consuming test files) end-to-end through
`node --test`: all 3 assertions **FAIL** — `capturedSet.size` 10 ≠ 12, and
both set-equality asserts show `constitution-monolith.txt` /
`skill-coordinator-monolith.txt` missing from the actual/expected diff. This
is the literal reconstruction the dispatch brief asked for ("must red against
a reconstruction of the pre-fix state (the pre-E90 script captured 10 of
12)"), confirmed by execution, not by inspection. Scratch files removed after
(`/tmp/pre-e90-script.mjs`, `/tmp/e90-redcheck/`); `git status` clean of any
residue.

**3c Coverage Gate**: N/A — no new production code; the change under test IS
the test file plus the already-reviewed script.

**3d Security Smoke Tests**: N/A — no user input, no auth surface. The three
new tests each `assert.ok`-guard their own regex matches before indexing into
capture groups (E66-style "must find" guards), so a future structural change
that breaks the extraction fails loud with a clear message rather than a
silent `undefined`/empty-set false pass.

## Phase 3.5 — AC Execution

Skipped (no `specs/<feature>.md`, no `proof:`-annotated ACs — mini-chain, no
spec file).

## Phase 4 — Run

- Build: clean (`npm run build`, re-run after adding the test file).
- Full suite: **1759/1759 pass, 0 fail** (`npm test`), independently
  re-measured — not replayed from either prior role's claim. This is
  1756 (the E43 close count both prior roles cited) + 3 new tests in
  `test/e90-golden-capture-completeness.test.mjs`, confirming no test was
  silently dropped or double-counted.
- Fixture diff, final check: `git diff --exit-code test/fixtures/compose-golden/`
  → exit 0, after the full suite run (rules out any test polluting the
  fixture directory as a side effect).
- CI runnability: `npm test` runs headlessly, zero interaction.

## Verdict

**PASS** — T-E90-01's acceptance (12/12 byte-identical regeneration,
including genuine re-derivation of the two previously-uncapturable fixtures
under both deletion and perturbation) and fail-loud behavior are independently
re-confirmed by execution. The residual gap code-reviewer flagged (a fixture
absent from disk with no capture exits 0) is reproduced and independently
verified real, then closed by a suite-side class guard
(`test/e90-golden-capture-completeness.test.mjs`) that ties three
independently-derived sets — the script's own capture set, the two consuming
suites' asserted set, and the on-disk fixture directory — to each other on
every `npm test` run, with no dependency on a human remembering to run the
regeneration tool. The guard is confirmed to red against a literal
reconstruction of the pre-E90 script (10 of 12 captured), matching the exact
defect count E90 was filed over. Two non-blocking nits from round 1 are
recorded as deliberately not closed (cosmetic, sr-owned, zero behavior
risk). Full suite 1759/1759, build clean, fixture diff clean.
## 2026-08-21T06:48:28.851Z — PASS — by qa-engineer

PASS. Re-derived both prior roles' claims by execution, not replay: build clean; regenerated all 12 fixtures fresh, git diff --exit-code clean; deleted then perturbed both previously-uncapturable fixtures (constitution-monolith.txt, skill-coordinator-monolith.txt), re-ran, confirmed byte-identical restoration both times; forced an empty derivation and confirmed uncaught throw + exit 1 (fail-loud, not a benign note). Reproduced the residual code-reviewer flagged (fixture absent from disk + no capture -> internal guard exits 0) independently, then closed it with a new suite-side class guard, test/e90-golden-capture-completeness.test.mjs (3 tests, static source-text extraction, no script execution/side effects): ties the script's own capture set, the two consuming suites' (compose-equivalence.test.mjs, skill-manifest.test.mjs) asserted set, and the on-disk fixture directory together on every npm test run. Verified by execution that this guard reds against a reconstruction of the real pre-E90 script (git show HEAD, prior to this ticket's uncommitted edit): capturedSet.size=10 vs 12 expected, matching the exact defect count E90 was filed over. Two non-blocking nits from round 1 (TDZ-safe declaration order, banner-before-guard print order) reviewed and deliberately left open -- cosmetic, sr-owned, zero behavior risk, not worth another round. Full suite 1759/1759 pass (1756 + 3 new), build clean, fixture diff clean after full run. Evidence: qa_reports/review_T-E90-02.md (covers T-E90-01, T-E90-02).

