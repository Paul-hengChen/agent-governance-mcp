# QA Review — T-E111-02 (+ T-E111-01)

covers: T-E111-01, T-E111-02

Feature: `e111-lane-worktree-evidence`. Verdict: **PASS**.

## Scope

- **T-E111-02** (mine, the real work): fixture-verify `bin/agc-init.mjs`'s
  `checkWorktreeEvidence()` against a real linked git worktree (this repo
  cannot reproduce the defect — all three evidence dirs are tracked here),
  author the pinned regression tests in `test/agc-adapters.test.mjs`
  alongside the E104(i)/E104(ii) fixtures per the dispatch brief's precedent,
  and re-baseline the two qa-owned tests the diff pushed past their floors
  (`test/context-budget.test.mjs` AC8/AC-P2-7, `test/skill-manifest.test.mjs`
  `t-golden-byte-identity`).
- **T-E111-01** (sr-engineer, three code-reviewer rounds, Round 3 APPROVED —
  `review_reports/review_T-E111-01.md`): verified by execution against fresh
  fixtures, not accepted on the review's word. See *Verification* below.

## Expected-Red Diff (Phase 0.5)

`qa_reports/expected-red_e111-lane-worktree-evidence.txt` does not exist.
Phase 0.5: skipped (no expected-red manifest declared) — consistent with
code-reviewer Round 3's note that the diff touches no test file and the two
known failures are cap/golden re-baselines, not intentional reds.

## Phase 1 — Review (spec = backlog E111 row; PM/architect skipped per
`scope_decision_why` — mini-chain)

No `specs/e111-lane-worktree-evidence.md` exists; the backlog row (`tasks.md`
lines 899-901, `docs/backlog.md` E111) is the spec. No Copy/Visual Tokens H2
sections apply (CLI stderr text + a coordinator SOP paragraph, not a UI
surface) — Phase 3a/3b and Phase 1.5 are all N/A and skipped accordingly.

### Verification of T-E111-01's central claims (re-derived, not ratified)

The brief instructed reading Round 3 (binding) over Round 2 where they
conflict, and asserting only on observable warn/silent + exit code, never on
git plumbing. Built 21 fresh fixtures myself (git 2.50.1, node — this repo's
runtime) rather than trusting the review's own 21-fixture claim, covering
every row the dispatch brief named as load-bearing:

| row | shape | measured | required |
|---|---|---|---|
| W1 | linked wt, plain untracked real dir | **warn** | warn |
| W3 | linked wt, gitignored dir + force-added tracked `.gitkeep` + untracked evidence (C1 hole) | **warn** | warn |
| S1 | linked wt, symlink resolving outside the worktree | **silent** | silent |
| W6 | linked wt, dir fully tracked and clean | **silent** | silent |
| W5 | linked wt, tracked content + untracked straggler (this repo's own shape) | **silent** | silent |
| W7 | linked wt, tracked content + a locally modified tracked file | **silent** | silent |
| P1 | primary checkout (`.git` is a directory), real untracked dirs | **silent** | silent |
| W4 | linked wt, dir real and completely empty (R1) | **warn** | warn |
| — | warning rows + a stale adapter together | **exit 1** (stale gate), advisory text still present | stale path untouched, advisory never suppresses or is suppressed |

All nine measured exactly as Round 3's matrix and the dispatch brief
predicted. Additionally **falsified my own W3 test**: patched
`hasIgnoredUntrackedContent` to the Round-2-proposed directory-level `git
check-ignore -q -- <dir>` predicate and re-ran — the W1/W3 test failed
(`review_reports/` went silent), reproducing the exact C1 reopening Round 3
diagnosed, then restored the real file (`git diff --stat` confirmed
byte-identical to the dispatched state afterward, and `npm run build` still
green). This proves the pinned test is load-bearing, not vacuous — it is
sensitive to precisely the regression the ticket exists to keep closed.

No contract defect encountered (Round 3's corrections (a)/(b)/(c) are text
corrections to Round 2's report, not disputes with the shipped code — the
shipped predicate was never wrong, only Round 2's proposed alternative was).

## Phase 3 — Tests

### Test file placement

Per the dispatch brief: appended to `test/agc-adapters.test.mjs`, directly
after the existing `E104(i)`/`E104(ii)` fixtures at the file's end — same
file, same fixture pattern (`mkTmp`, `execSync`/`spawnSync`, real git
commands against throwaway temp dirs), extended with a `mkWorktreeFixture()`
helper (`primary` repo + `git worktree add` to get a real `.git` gitfile,
which a plain `git init` temp dir — as E104 uses — does not have).

### Backlog-row (spec) → test map

tasks.md T-E111-02 named four cases, (i)-(iv), mapping onto Round 3's
matrix rows per the dispatch brief:

| case | matrix rows | test |
|---|---|---|
| (i) untracked real dir warns | W1, W3 | `E111(i)` |
| (ii) symlink back to primary is silent | S1 | `E111(ii)` |
| (iii) tracked dir is silent | W5, W6, W7 | `E111(iii)` |
| (iv) primary checkout is silent regardless of dir state | P1 | `E111(iv)` |
| exit code never changes | E1 (all warn rows), stale-adapter path | `E111` (exit-code invariant test) |

Plus the two regressions the ticket exists to keep closed, both explicitly
required by the dispatch brief to carry a pinned test beyond the four
tasks.md cases:

- **R1** (empty-dir bootstrap moment, row W4) → `E111 R1 regression guard`.
- **R2/C1 tension** (tracked-straggler silence vs. the gitignored+forced-add
  hole) → covered jointly by `E111(i)`'s W3 case and `E111(iii)`'s W5 case,
  which is the same tension the brief calls out — one must warn, the
  adjacent tracked-shape must not, and both are asserted in the same suite.

Six tests added, all pass; none assert on which git subcommand fires — every
assertion is against `r.status` and `r.stderr` text/absence, per the binding
instruction in both the dispatch brief and Round 3's correction (c).

### Coverage / security

No new production logic in `test/` itself; the fixtures exercise
`checkWorktreeEvidence()`, `isLinkedWorktree()`, `isEmptyDir()`,
`hasUntrackedContent()`, `hasIgnoredUntrackedContent()`, `hasTrackedContent()`,
and `isSafelyLinkedOutside()` — every helper `bin/agc-init.mjs` added for
E111. Boundary cases covered: absent dir (existing behavior, unchanged),
empty dir, dangling/inside/outside symlinks (outside covered directly;
inside/dangling are S2/S3, carried in the matrix but not required by
tasks.md's four cases and left to the record above rather than duplicated
into new tests). No auth/permission surface — this is a local advisory CLI
check with a fixed 3-element directory allowlist and no external input.

### Re-baselines (both qa-owned, both expected per the dispatch brief)

1. **`test/context-budget.test.mjs` AC8/AC-P2-7** (design-arm coordinator
   bundle cap): `content/coord-03-core-fallback.md` grew by the new
   "Worktree bootstrap obligation" paragraph (T-E111-01(a)) plus one clause
   added to the Feature-lease gate escalation row. Re-measured through the
   real render path at exactly 18303 ~tok (was 17984, +319). Raised the cap
   to the exact measured value, no headroom, per the file's own established
   "qa-owned bump" convention (matches the e43/e96 precedents in the same
   file) — updated both the assertion and the test's own title string.
2. **`test/skill-manifest.test.mjs` `t-golden-byte-identity`**: regenerated
   `test/fixtures/compose-golden/skill-coordinator-monolith.txt` by running
   the exact same `composeSkill("skill-coordinator.md",
   hostCapabilitiesFor("claude-code"), readContent)` call the test itself
   uses, against the built `dist/prompts/skill-manifest.js`. Diffed the
   regenerated fixture against git HEAD: the only changes are the same two
   `content/coord-03-core-fallback.md` spans named above — no incidental
   drift.

## Phase 4 — Run

- `npm run build`: clean (tsc, check:version, check:transitions-sync all OK).
- `npm test`: **1821/1821 pass** (was 1813/1815 per the dispatch brief's
  pre-existing-failure count; +6 for the new E111 tests, and both named
  re-baselines now green). No third failure — the two named re-baselines
  were the only pre-existing failures, confirmed before touching either.
- `agc check` (run manually against this worktree, which itself has all
  three evidence dirs tracked with real content): exits 0, `OK (3.107.0) —
  all adapters current`, matching Round 3's own verification that this
  repo's own shape (the W5/W6 rows) stays silent.
- Scratch fixture repos created during manual verification (under this
  session's scratchpad, never under the repo root) were removed after use.

## Verdict

**PASS.** T-E111-01's advisory logic is verified by execution against fresh
fixtures for every row the dispatch brief and Round 3's matrix named as
load-bearing, including a direct falsification check proving the W3/C1 test
is not vacuous. T-E111-02's tests are authored, pinned to observable
behavior only (never git plumbing, per the binding instruction), placed in
`test/agc-adapters.test.mjs` per the brief. Both qa-owned re-baselines are
applied with rationale comments in the existing convention. Full suite green
at 1821/1821, build clean.
## 2026-09-15T02:22:14.578Z — PASS — by qa-engineer

PASS. T-E111-01 (worktree-evidence advisory, Round 3 APPROVED) verified by executing 21 fresh fixtures against the real CLI, not by reading the review — every matrix row the dispatch brief named as load-bearing (W1, W3, W4, W5, W6, W7, S1, P1, plus the stale-adapter exit-code invariant) measured exactly as predicted. Directly falsified the W3/C1 test by patching in Round 2's rejected directory-level check-ignore predicate and confirming it fails — proves the pinned test is load-bearing, not vacuous. T-E111-02: 6 fixture tests added to test/agc-adapters.test.mjs (mkWorktreeFixture helper + git worktree add, alongside the existing E104(i)/(ii) fixtures at file end), asserting only on observable warn/silent stderr text + exit code, never on git plumbing, per the binding instruction. Two qa-owned re-baselines applied: test/context-budget.test.mjs AC8/AC-P2-7 cap raised 17984->18303 (content/coord-03-core-fallback.md's Worktree bootstrap obligation growth), and test/fixtures/compose-golden/skill-coordinator-monolith.txt regenerated via the real composeSkill pipeline (diff confirmed to contain only the same coord-03 spans). npm run build clean; npm test 1821/1821. Evidence: qa_reports/review_T-E111-02.md (covers T-E111-01, T-E111-02).

