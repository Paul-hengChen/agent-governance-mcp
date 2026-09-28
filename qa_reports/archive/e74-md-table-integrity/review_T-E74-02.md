# QA Review — T-E74-02

covers: T-E74-01, T-E74-02

Feature: e74-md-table-integrity. code-reviewer APPROVED T-E74-01 at round 3
(`review_reports/review_T-E74-01.md`). This is a Crash-Resume — the two
prior qa-engineer dispatches on this task died before writing anything
(no test file, no evidence file, no state write, HEAD unchanged). Starting
clean.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e74-md-table-integrity.txt` manifest
declared).

## Phase 1 — Review

No `specs/e74-md-table-integrity.md` exists — this is a mini-chain, the
`tasks.md` backlog row is the spec (PM/architect skipped, per
`scope_decision_why`). No *Copy / Strings* or *Visual Tokens* H2 to audit
against (3a/3b: skipped, no spec doc carrying those sections).

Read `scripts/check-md-tables.mjs` in full and re-derived the round-3
APPROVED findings independently rather than trusting the review's claims:

- F1 (nested-fence false negative), F3 (mis-sized delimiter accepted),
  F4 (masking), F5 (ENOENT / trailer text) — all fixed, matches round-3's
  account.
- F6 (three-way cause discriminator for the "no-delimiter" message: (a)
  blank-split, (b) missing-delimiter, (c) mis-sized-delimiter) — verified
  correct on every shape the round-3 review enumerated, and independently
  on the additional synthetic shapes built for this task's test suite
  (see MSG-A/B/C below).
- Q3-1 (the coordinator-direct fix, disclosed in the dispatch brief):
  `scripts/check-md-tables.mjs:40-41` now reads "conceals exactly 2 rule-1
  (cell-count) sites and 0 rule-2 (no-delimiter) sites" — matches rule
  numbering at `:5-6` (rule 1 = cell-count, rule 2 = delimiter) and matches
  the measured concealed sites (`qa_reports/review_T-E3-QA.md:120` and
  `review_reports/archive/e48-docs-skills-delete/review_T-E48-02.md:62`,
  both cell-count rows, re-verified by disabling the exclusion — see AC
  Execution note below). The swap the reviewer found is corrected; no
  further action needed. Judged independently since this specific edit
  post-dated round 3 and never passed through code-reviewer.
- C3-2 (the fourth misclassification shape — two adjacent tables separated
  by one blank line, second missing its delimiter) — confirmed
  deliberately NOT in this cut per the coordinator's brief; its
  precondition occurs 0 times in 0 files (re-verified below). No action
  taken; will be filed as a backlog row by the coordinator after this PASS,
  deliberately after so filing it doesn't perturb `docs/backlog.md` mid-QA.

### Phase 1.5 — Visual Compare

Skipped (no `design/e74-md-table-integrity.md`, no Visual Baselines H2).

## Phase 3 — Tests

No existing test file covered `scripts/check-md-tables.mjs`. New file
created per pre-authorization (dispatch brief: "Test-file placement:
creation pre-authorized — `test/check-md-tables.test.mjs` is the suggested
home"): `test/check-md-tables.test.mjs`, 17 tests, following the
`test/check-version.test.mjs` scratch-repo spawn pattern — REAL_SCRIPT
copied byte-for-byte into a throwaway git repo per fixture (`git init` +
write + `git add -A`; the checker calls `git ls-files` internally, unlike
`check-version.mjs`), never touching this repo's own tree.

**Hard constraint honored (T-E77-02):** no fixture reads this repo's git
HISTORY (no pinned sha, no `git show <rev>:<path>`, no `git log`) — every
fixture is synthetic content, freshly git-initialized. Re-ran
`test/render-structure.test.mjs` after adding the file; its T-E77-02
meta-test still passes (10/10), confirming the new file doesn't trip the
history-fixture guard.

### AC → test map

| AC / discriminator | test(s) |
|---|---|
| rule 1 (cell-count) | MASK-1/2/3, GD-4, MSG-C |
| rule 2 (delimiter row / blank-split, masking preserved) | MASK-1/2/3, MSG-A/B/C |
| discriminator (i) escaped `\|` not a separator | GD-1 |
| discriminator (ii) fenced code skipped, incl. F1 nested-fence | GD-2a, GD-2b |
| discriminator (iii) indented `\|` continuations rejected | GD-3, EDGE-1 |
| discriminator (iv) delimiter row skipped + width-checked | GD-4, MSG-C |
| F6 message correctness (not just detection) + remedy-clears | MSG-A, MSG-B, MSG-C |
| F5 ENOENT (tracked-but-deleted file) | SMOKE-DELETED |
| boundary/security smoke | SMOKE-EMPTY-REPO, SMOKE-EMPTY-FILE, SMOKE-CRLF |
| npm wiring | WIRING |

Per T-E74-02 item (2): each of the four discriminators is pinned as a
**guard-the-guard** case — a fixture demonstrated to red against a
reconstruction of the naive (pre-discriminator) version, using a
parameterized `naiveCheck()` helper in the test file that flips exactly one
of `escapeAware` / `fenceMode` / `columnZeroOnly` off the correct default,
isolating one discriminator's failure per test:

- GD-1: naive bare-pipe split reports 3 cells where there are really 2;
  real script clean.
- GD-2a: a fence-blind naive reconstruction misreports fenced pipe content
  as a headerless table; real script clean.
- GD-2b (F1, the historical regression): naive parity-toggle fence tracker
  (any `>=3` backtick/tilde run flips state regardless of char/length) —
  fixture is a 4-backtick block containing exactly one inner 3-backtick
  marker line (odd parity). Hand-traced the toggle: it ends "still in
  fence" after the true close, so a genuine cell-count defect right after
  the block is never scanned (`naiveCheck` returns `[]`) — reproduces F1's
  "silently reported OK over a real defect" exactly. The real
  (run-length-aware) script still reports it
  (`t.md:9 — row has 3 cell(s), header declares 2`).
- GD-3: a column-agnostic naive reconstruction misreports an indented `\|`
  list-continuation line as a headerless 1-line table; real script clean.
- GD-4: a well-formed delimiter row is confirmed skipped and a downstream
  defect is attributed to its own line only (never the header's or
  delimiter's line) — no separate naive reconstruction is meaningful for
  this discriminator (a naive "don't skip the delimiter" version produces
  no observable divergence for a *correctly-sized* delimiter; the
  mis-sized case is discriminator iv's real failure mode and is pinned via
  MSG-C instead, per F6/F3).

**F6 (message correctness, not just detection)** — the code-reviewer's
addendum said the four discriminators test detection only and F6 is a
message-correctness class none of them covers. MSG-A/B/C each assert the
*exact* emitted cause text for one of the three causes, AND — the
strongest form, per the dispatch brief — follow the prescribed remedy and
re-run to confirm the violation **actually clears**:

- MSG-A (blank-split): message names the severing blank line; deleting it
  clears the violation.
- MSG-B (missing-delimiter): message says "add one directly after the
  header", does NOT claim a blank-split; inserting the delimiter row
  clears the violation.
- MSG-C (mis-sized-delimiter, the cause with no naturally-occurring
  instance in this repo per the dispatch brief — it exists only because
  the F3 fix created the class): message reports both cell counts and
  says "fix the delimiter row's column count", never "has no delimiter
  row"; widening the delimiter row clears the violation. Fixture matches
  the one code-reviewer ran by hand in round 3 (`| a | b |` / `|---|` /
  `| 1 | 2 |`).

EDGE-1 pins the round-3 "suspect" edge case explicitly: an indented `\|`
continuation immediately above a blank-preceded defective block must
classify as (b), never (a) — an indented line can never be "the header
this block was severed from".

Coverage gate: `scripts/check-md-tables.mjs` is fully exercised by the 17
tests above — every branch (both rules, all four discriminators, all three
no-delimiter causes, the ENOENT guard, the exclusion list wiring via the
whole-repo run in Phase 4) is hit. Tooling doesn't measure line coverage
for standalone scripts in this repo; noted explicitly per SOP.

### Phase 3.5 — AC Execution Log

Skipped (no `specs/e74-md-table-integrity.md`, so no `proof:`-annotated
ACs — the backlog row is the spec, per the recorded scope decision).

### Item (1) manual proof — pre-fix reds / post-fix clean (not a permanent test, see below)

`test/check-md-tables.test.mjs`'s MASK-1/2/3 pin the **masking mechanism**
(F4) at class scale permanently. The literal real-repo numbers from
`tasks.md` T-E74-01/02 ("oracle is 22 sites / 17 files... a single
pre-fix pass names 21... fixing only `docs/backlog.md:169` yields 21
again") were verified **by hand** this session, and are recorded here
rather than as a permanent test, because embedding a pinned pre-fix commit
or a `git show`/`git log` read into `test/` would violate the T-E77-02
meta-test (no file under `test/` may read repository history as a
fixture) — and T-E74-02 itself instructs "prefer class assertions over
instance pins".

Method: `git worktree add --detach /tmp/e74-prefix-wt HEAD` (HEAD =
`309c3bf`, the pre-fix commit at dispatch time), copied the real (fixed)
`scripts/check-md-tables.mjs` into that worktree's `scripts/`, and ran it
three times:

1. **Full pre-fix tree** (worktree as checked out): `21 malformed table
   site(s) found`, exit 1. Matches the oracle's "single pre-fix pass names
   21" exactly, including the block-level masking at
   `docs/backlog.md:170-227` (the E49 row inside it not separately
   reported).
2. **Partial fix** (only `docs/backlog.md`'s stray blank line at :169
   removed, nothing else touched): `21 malformed table site(s) found`
   again, exit 1 — but the composition changed exactly as predicted: the
   `docs/backlog.md:170-227` block violation is gone, and
   `docs/backlog.md:171 — row has 7 cell(s), header declares 6` (the
   previously-masked E49 row) now reports on its own.
3. **Full post-fix tree** (this session's actual working tree, all fixes
   applied): `check:md-tables — OK (241 file(s) scanned, 0 malformed
   tables)`, exit 0.

Union of passes 1 and 2's distinct sites: 20 common + 1 only-in-pass-1
(the block violation) + 1 only-in-pass-2 (the surfaced row) = **22
sites**, across **17 files** (`docs/backlog.md` + the 16 `specs/*.md`
files) — matches the amended AC exactly. Worktree removed after
verification (`git worktree remove`); nothing under this left in the
working tree or committed.

## Phase 4 — Run

- Crash checkpoint written before the regression run (`tw_update_state`,
  `bookkeeping_write: true`).
- Build: `npm run build` — clean (`check:version` OK 3.105.2, `tsc` clean,
  `check:transitions-sync` OK 21 keys exact match).
- Full suite: `npm test` — **1813/1813 pass** (0 fail, 0 cancelled,
  61.3s). New file's 17 tests included (`GD-1..GD-4`, `MSG-A..MSG-C`,
  `EDGE-1`, `MASK-1..MASK-3`, `SMOKE-*` x4, `WIRING`), plus
  `test/render-structure.test.mjs`'s T-E77-02 meta-test re-verified clean
  against the new file (10/10).
- `npm run check:md-tables`: `OK (241 file(s) scanned, 0 malformed
  tables)`, exit 0.
- Boundaries re-verified via `git status`/`git diff --stat`: `test/` gains
  only the new file (qa-owned edit, §2); `content/skill-pm.md` and
  `content/skill-design-auditor.md` byte-identical (no diff); `qa_reports/`
  clean except this new file; `review_reports/archive/` untouched.

## Verdict

**PASS** — T-E74-01 and T-E74-02 both verified. The checker is correct on
every discriminator and every F6 cause, message text matches remedy
behavior (following the prescribed fix actually clears the violation in
all three cases), the masking mechanism (F4) is pinned at class scale, the
F1 regression has a permanent guard-the-guard test, and the real-repo
pre-fix/post-fix oracle (22 sites / 17 files, 21-then-1) was independently
re-derived by hand and matches exactly. Build clean, full suite green,
`check:md-tables` green. No release bookkeeping performed here (release-
engineer's job, post-PASS).
## 2026-09-07T12:35:45.235Z — PASS — by qa-engineer

PASS. Verified scripts/check-md-tables.mjs (round-3 APPROVED, F1/F3/F4/F5/F6 all correct, Q3-1 coordinator-direct comment fix confirmed). New test/check-md-tables.test.mjs (17 tests): guard-the-guard for all 4 discriminators incl. F1 nested-fence (naive reconstructions demonstrated to red), F6 message-correctness for all 3 causes with remedy-clears-violation proof, F4 masking pinned at class scale (MASK-1/2/3), F5 ENOENT + boundary smoke tests, EDGE-1 round-3 suspect case. Real-repo pre-fix/post-fix oracle (22 sites/17 files, 21-then-1) independently re-derived by hand via git worktree at HEAD (not baked into permanent tests per T-E77-02 history-fixture guard) -- matches exactly. Build clean, 1813/1813 suite green, check:md-tables OK (241 files) exit 0. Boundaries held: test/ gains only the new file (qa-owned), skill-pm.md/skill-design-auditor.md untouched, qa_reports/ and review_reports/archive/ byte-clean. Evidence: qa_reports/review_T-E74-02.md (covers T-E74-01, T-E74-02).

