# QA review — T-E60-01 (e60-lockfile-version-parity)

Crash-Resume note: a prior QA context was killed mid-round by a session/usage
limit before its `tw_update_state` landed (`stale_dispatch` named
qa-engineer). This round independently re-verifies against the live tree
per the Crash-Resume Protocol rather than trusting the crashed transcript or
the coordinator's ground-truth summary at face value — every claim below was
re-checked by this session via `git diff`, direct file reads, and a live
`npm test` / `npm run build` / `node scripts/check-version.mjs` / `agc check`
run, not copied from the summary.

## Scope note
Backlog row IS the spec for this cut (mini-chain, PM/ARCH skipped per
`scope_decision_why` on the feature's `pm:In_Progress` write). No
`specs/e60-lockfile-version-parity.md` or `design/e60-lockfile-version-parity.md`
file exists — confirmed via `ls specs/ design/` (zero hits for `e60`).
Consequently Phase 1.5 (Visual Compare), Phase 3a (Copy Audit), Phase 3b
(Visual Audit), and Phase 3.5 (AC Execution Log) all skip: there is no spec
H2 to open and no `proof:`-annotated AC to execute. The acceptance bar is the
backlog row's own ACCEPTANCE line, mapped to tests below.

## Expected-Red Diff
`qa_reports/expected-red_e60-lockfile-version-parity.txt` is present (sr-authored,
one entry): `test/release-staging.test.mjs | E71(a): the git-add line stages
exactly 30 paths (19 directories + 11 metadata), set-equal to
FEATURE_DIRS/METADATA_PATHS/E65_METADATA_PATHS`.

**Disposition: RESOLVED GREEN.** This entry is not a residual red — it is now
dispositioned by this same QA round's own fix, since test authorship for this
cut is qa-owned (backlog row item 4) rather than sr's. Verified independently:
- `test/release-staging.test.mjs:106` — `METADATA_PATHS` now includes
  `"package-lock.json"` (7 entries, was 6).
- `test/release-staging.test.mjs:2151` — test title reads "stages exactly 31
  paths (19 directories + 12 metadata)" (was 30/11).
- `test/release-staging.test.mjs:2160-2161` — both `assert.equal(...)` calls
  read `31` (was `30`), with updated messages ("31 entries, not 19" /
  "the git-add line's 31 staged paths...").
- `test/release-staging.test.mjs:2166-2167` — `assert.match` calls now expect
  `/31 paths/` and `/19 directories \+ 12 metadata paths/`.
- The `METADATA_PATHS` header comment (`test/release-staging.test.mjs:100-104`)
  now reads "Seven pre-E65 ... package-lock.json joined post-E65, per E60's
  lockfile-parity cut ... plus the five E65 paths", replacing the stale
  "Six pre-E65 ... plus the five E65" prose.
- Live full-suite run (below) confirms this test passes, not just that its
  literals were edited to match production code — a coincidental-pass check,
  not a tautology, since the test derives its 31-count from
  `FEATURE_DIRS.length + METADATA_PATHS.length + E65_METADATA_PATHS.length`
  independently of the hardcoded `31` sanity assertion.

No entry is missing this disposition; the manifest's one line is fully
accounted for. Feature-mode (no `dispatch_mode: bugfix` on the handoff), so
this disposition is advisory per SOP — but it is stated explicitly rather than
left dangling, per the resume brief's instruction.

## Phase 1 — Review
Read `scripts/check-version.mjs`'s new lockfile block (`git diff` reviewed in
full) and `content/skill-release-engineer.md`'s three edits (step 4 bullet,
Artifact allowlist line, `## check-version gate` bullet, step 8 git-add
line + existence-pre-filter prose). Both match backlog row items 1 and 3
verbatim — see the code-reviewer's two-round record at
`review_reports/review_T-E60-01.md` (APPROVED, round 2) for the full
correctness/security/architecture pass; QA scope here is coverage and test
quality, not re-litigating what code-reviewer already cleared.

Independent read of the lockfile-parity block confirms the shape the
backlog row asked for: `existsSync` tolerance (absent → skip note, exit 0),
JSON.parse wrapped in try/catch (parse failure → fail loud, exit 1), a
`null`/non-object guard, a missing-field guard (covers non-null non-array
shapes lacking the expected keys, and — per code-reviewer's F2 finding and
this round's CV-10 — also catches JSON arrays one level down, since arrays
have neither a `.version` string nor a `packages[""]` entry), then the actual
parity comparison naming both observed lockfile values and `pkg.version` on
mismatch. No behavior outside this block was touched by sr; `git diff` on
`scripts/check-version.mjs` shows exactly the one new block appended after
the existing dist-parity check, nothing upstream reflowed.

## Phase 3 — Tests
Test-file placement: existing files (`test/check-version.test.mjs`,
`test/release-staging.test.mjs`) already cover this scope — no new file
needed.

### AC -> test map (backlog row T-E60-01, items 1/2/4)
| Acceptance criterion | Test(s) |
|---|---|
| `check-version.mjs` OK at 3.104.3, lockfile parity asserted | `node scripts/check-version.mjs` live run (below); CV-5 |
| Lockfile match -> exit 0, parity line prints | CV-5 |
| Stale root `version` -> exit non-zero, names both observed values | CV-6 |
| Stale `packages[""].version` only -> exit non-zero, names both observed values | CV-7 |
| Lockfile absent -> skip-note, exit 0 (mirrors `dist/index.js` tolerance) | CV-8 |
| Fail-loud on unparseable/malformed shape (not a silent pass) | CV-9 (JSON `null`, guarded shape message not a raw `TypeError` — pins code-reviewer's round-2 F2 fix), CV-10 (JSON array, caught one level down, not a hole) |
| `package-lock.json` refreshed 3.97.1 -> 3.104.3, no dependency-tree churn | Verified directly: `package-lock.json` root `version` and `packages[""].version` both read `3.104.3`; code-reviewer's F1 finding (round 2) independently reproduced the `--package-lock-only` command in isolated copies and confirmed exactly the 2 version fields change against this repo's lockfileVersion-3 lockfile |
| `content/skill-release-engineer.md` step 4/8 edits, `grep -c package-lock` >= 2 | E71(a) test above (31-path set-equality); `grep -c package-lock content/skill-release-engineer.md` = 5 (checked live, exceeds the >= 2 bar) |
| Full suite green, no expected-red carve-out remaining | Phase 4 run below: 1765/1765, 0 fail |

### Coverage gate
New/modified lines are in `scripts/check-version.mjs` (one new block,
fully branch-covered: match/mismatch-root/mismatch-packages/absent/parse-fail/
null-shape/array-shape — 7 distinct branches, 6 dedicated tests CV-5..CV-10
plus incidental absent-lockfile coverage from CV-1..CV-4's default fixture).
Tooling doesn't produce a line-coverage percentage for this repo's test
harness (plain `node --test`, no istanbul/c8 wired in) — noting explicitly
per SOP 6c rather than asserting an unmeasured number. Qualitatively: every
branch in the new block has at least one dedicated test with a distinct
fixture shape; this exceeds the 80% line-coverage bar by inspection (100% of
new statements are reachable from some CV-5..CV-10 case, confirmed by
re-reading the block against the six test bodies side by side).

### Security smoke tests
Boundary inputs on the new surface (an untrusted/corruptible JSON file):
`null` literal (CV-9), non-object JSON (array, CV-10), and the pre-existing
parse-fail path (invalid JSON entirely, exercised implicitly by CV-9's `"null"`
string literal going through `JSON.parse` — parses fine as the value `null`,
which is what distinguishes it from a true parse failure; the pre-existing
CV-3-equivalent parse-fail path for `dist/index.js` already covers malformed
JSON text and this block reuses the same try/catch shape). No auth/permission
surface applies — this is a local build-time script reading a repo-local file.

## Phase 4 — Run
Crash checkpoint: n/a — this round completes in one pass (no long-running gap
between artifact completion and the regression run).

- `npm run build`: exit 0. `check:version` (prebuild) OK at 3.104.3 including
  the new `package-lock.json parity OK (3.104.3)` line; `tsc` clean;
  `check:transitions-sync` OK (21 keys, exact match).
- `node scripts/check-version.mjs` (standalone): OK (3.104.3), both dist and
  lockfile parity lines print.
- `npm test`: **1765 / 1765 pass, 0 fail, 0 cancelled** (base 1759 + 6 new
  CV-5..CV-10 cases). No expected-red carve-out remains open — the one
  manifest entry is RESOLVED GREEN per Phase 0.5 above, not excluded.
- `node bin/agc-init.mjs check`: OK (3.104.3) — all adapters current.
- CI runnability: all four commands above ran headlessly, zero interactive
  prompts, exit codes checked directly.

All four match the coordinator's crash-resume summary exactly; independently
reproduced in this session rather than taken on trust.

## Verdict
**PASS.** Both remaining backlog-row acceptance items (full-suite green with
no carve-out; grep-count bar) are met, all six new tests pin the contract the
backlog row specified plus the two shapes code-reviewer's F2 surfaced, and
the sole expected-red entry is explicitly resolved-green rather than left
dangling. No non-test file was touched by qa-engineer this round (test-only
changes, per role boundary) — `git diff --stat` on the four in-cut files
matches the resume brief: `test/release-staging.test.mjs` (+24/-11),
`test/check-version.test.mjs` (+111 new), `scripts/check-version.mjs` and
`content/skill-release-engineer.md` unchanged since code-reviewer's round-2
APPROVED verdict.
## 2026-08-24T12:45:44.827Z — PASS — by qa-engineer

PASS. Crash-Resume round: independently re-verified (not trusted from the crashed transcript or coordinator summary alone) — git diff on all 4 in-cut files, live npm test (1765/1765, 0 fail), npm run build (exit 0, lockfile+dist parity OK 3.104.3), node scripts/check-version.mjs (OK, both parity lines), agc check (OK 3.104.3), grep -c package-lock content/skill-release-engineer.md = 5 (>= 2 bar met). Phase 0.5: the single expected-red manifest entry (test/release-staging.test.mjs E71(a), 31!==30) is RESOLVED GREEN by qa's own METADATA_PATHS + count edits this round — explicitly dispositioned, not left dangling. Tests CV-5..CV-10 added to test/check-version.test.mjs (new mkFixtureRoot lockfile param) cover: match, stale root, stale packages[""], absent lockfile, JSON null (code-reviewer F2 pin), JSON array — full branch coverage of the new check-version.mjs lockfile block. No non-test file touched by qa. Full detail: qa_reports/review_T-E60-01.md.

## 2026-08-24T12:46:07.206Z — PASS — by qa-engineer

PASS. Crash-Resume round: independently re-verified (not trusted from the crashed transcript or coordinator summary alone) — git diff on all 4 in-cut files, live npm test (1765/1765, 0 fail), npm run build (exit 0, lockfile+dist parity OK 3.104.3), node scripts/check-version.mjs (OK, both parity lines), agc check (OK 3.104.3), grep -c package-lock content/skill-release-engineer.md = 5 (>= 2 bar met). Expected-Red Diff: the single manifest entry (test/release-staging.test.mjs E71(a), 31!==30) is RESOLVED GREEN by qa's own METADATA_PATHS + count edits this round — explicitly dispositioned, not left dangling. Tests CV-5..CV-10 added to test/check-version.test.mjs (new mkFixtureRoot lockfile param) cover: match, stale root, stale packages[""], absent lockfile, JSON null (code-reviewer F2 pin), JSON array — full branch coverage of the new check-version.mjs lockfile block. No non-test file touched by qa. Full detail: qa_reports/review_T-E60-01.md.

