covers: T-E77-01, T-E77-02

# QA Review — E77 (hermetic test fixture) — T-E77-01 + T-E77-02

**Dispatch shape**: single-role qa judge-dispatch per Constitution §3.1 (test-only
ticket — no build role, no code-reviewer round). Spec = `docs/backlog.md` E77 row
+ its 2026-08-18 amendment (mini-chain, backlog-row-as-spec; no
`specs/<feature>.md`). Cut approved by human 2026-08-18 (see `scope_decision_why`
on the pm write). Human also approved the cut with `main` known-RED.

## Phase 0.5 — Expected-Red Diff
Skipped (no `qa_reports/expected-red_e77-hermetic-test-fixture.txt` manifest —
this is not a `dispatch_mode: "bugfix"` ticket; it is a test-infra fixture swap).

## Phase 1 — Review

**T-E77-01 root cause** (re-verified independently, not taken on faith from the
row): `test/render-structure.test.mjs:148-151` built its detector-soundness
fixture via `execFileSync("git", ["show", "ffa4082:content/skill-release-engineer.md"])`.
`.github/workflows/ci.yml:17` uses `actions/checkout@v4` with no `fetch-depth`
(action default: 1), so `ffa4082` is absent from CI's clone — confirmed by
reproducing the exact failure locally in a genuinely shallow (depth-1) throwaway
clone (see Phase 4 below): `fatal: invalid object name 'ffa4082'`.

**Fix shape chosen**: (i) hermetic fixture, per the row's stated preference and
2026-08-18 amendment — NOT (ii) `fetch-depth: 0`. Verified this preserves the
guard's strength rather than narrowing it:
- Extracted the exact two known-broken spans verbatim from
  `git show ffa4082:content/skill-release-engineer.md` (lines 119-120 and
  126-129) into two `const` string literals (`BASELINE_EXCERPT_MKDIR_P`,
  `BASELINE_EXCERPT_DRIFT_BASELINE`) in `test/render-structure.test.mjs`, with
  `ffa4082` cited in an adjacent comment as PROVENANCE ONLY (never read at test
  time).
- Confirmed byte-for-byte, before swapping, that these two excerpts — and only
  these two — reproduce both assertions unchanged: the structural detector
  (`findAsymmetricRationaleSpans`, source-level) finds exactly 2 asymmetric
  spans, and the render detector (`findLineGlueFindings` over
  `applyTextTransforms(..., {fullDetail:false})`) finds exactly 2 glue findings
  including the literal `MUST NOT be touched.7b.`. Both detectors exercise the
  identical code paths against the identical historical bytes at those two
  sites; only the surrounding ~170 lines of uninvolved prose are omitted, and
  omitting them cannot change either detector's output since both operate on
  fixed-width local context (one rationale span, or one rendered line) that
  never crosses outside the two excerpts.
- Removed the now-unused `execFileSync` and `parseSkillFile` imports (no other
  call sites in this file).

**T-E77-02 (meta-test, folded in by human decision)**: added
`findHistoryFixtureReads()` (module-scope in `test/render-structure.test.mjs`)
plus two tests:
1. A sweep of every `*.mjs` file under `test/` (93 files, recursive — includes
   `test/eval/**`) asserting zero history-as-fixture reads.
2. A guard-the-guard test asserting the detector actually REDs against a
   reconstructed (not git-read) copy of the pre-fix `git show ffa4082:...`
   line, plus a negative control (a legitimate working-tree `git(["rev-parse",
   "HEAD"])` wrapper call and a SOP-prose `.includes("git describe --tags...")`
   string assertion) that must NOT be flagged.

**Scope-trap verification** (measured, not assumed): the detector distinguishes
"reads history as a fixture" from "calls git" by looking only at actual
exec-family invocations (`execFileSync`/`spawnSync`/`spawn`/`execFile`
array-form, `execSync`/`exec` string-form, and the local `git(args, cwd)`
wrapper convention used in `test/verify-release.test.mjs`) whose subcommand is
`show`/`log`, or whose argument is a bare 7-40-char hex commit sha. Confirmed
by direct inspection that the 5 files named in the row's scope trap —
`test/feature-lease.test.mjs`, `test/context-budget.test.mjs`,
`test/e16-judge-dispatch-charter.test.mjs`, `test/release-staging.test.mjs`,
`test/verify-release.test.mjs` — are NOT flagged:
- `feature-lease`, `context-budget`, `e16-judge-dispatch-charter` never
  actually invoke a subprocess at all; their `git` mentions are string
  literals being asserted against (SOP-prose checks), not calls.
- `release-staging.test.mjs` invokes git for real, but only against a
  throwaway fixture repo it creates itself (`init`, `config`, `add`, `commit`,
  `reset`, `diff --cached --name-only`, `ls-files`) — working-tree/staging
  state, never a pinned historical blob.
- `verify-release.test.mjs` invokes git for real via its own `git(args, cwd)`
  wrapper, also against a throwaway fixture repo/bare remote it creates
  (`init`, `checkout -b`, `add`, `commit`, `rev-parse HEAD`/`@{u}`, `push`,
  `tag`, `status --porcelain`) — again working-tree/ref mechanics, never
  `show`/`log`/a pinned sha.

**A real bug found and fixed during authorship of the detector itself**: a
naive quote-tracking-only tokenizer misfired on this same file's own regex
literals (`BULLET_RE = /-\s(?:\*\*|`+"`"+`|\[[ xX]\])/g` contains a bare
backtick that is not a template-literal delimiter) and desynced, swallowing
real `//` comments — including this ticket's own explanatory comment — into a
bogus multi-line "string". Fixed by adding a divide-vs-regex-literal heuristic
(classic: a `/` starts a regex when the previous significant character is one
of `([{,;:=!&|?+-*%^~<>` or start-of-file) so regex-literal contents are
treated as opaque, matching how a real JS tokenizer would. Also had to route
the guard-the-guard test's reconstructed "bad" snippet through a small
runtime-assembly helper (`assembleReconstructedCall`) rather than a single
static string literal, because the sweep test (scanning `test/*.mjs`,
including itself) was — correctly — flagging its own demo data as a literal
`execFileSync("git", ["show", ...])` call. Both are documented inline in the
test file.

Copy/Visual Audit Gates: N/A — no `specs/<feature>.md` exists (backlog-row-as-
spec mini-chain); the backlog row carries no Copy/Strings or Visual Tokens H2s
to audit against, and this cut touches test code only, no user-facing surface.

## Phase 1.5 — Visual Compare
Skipped (no `design/e77-hermetic-test-fixture.md`, no Visual Baselines H2).

## Phase 2 — Discussion
No issues found in Phase 1 requiring an sr-engineer round (none exists in this
single-role dispatch regardless).

## Phase 3 — Tests
Test file discovery: `test/render-structure.test.mjs` already exists and is
exactly the file both tickets scope to. AC-to-test map:
- T-E77-01 AC (fixture must not depend on repository history / clone depth) →
  `"detector soundness: both detectors reproduce exactly the 2 known ffa4082
  glue sites, byte-identical"` (now hermetic).
- T-E77-02 AC (no test/ file reads history as a fixture) →
  `"T-E77-02 meta-test: no file under test/ reads repository history as a
  fixture (pinned sha / git show <rev>:<path> / git log)"`.
- T-E77-02 AC (guard the guard — must demonstrate, not merely assert, that the
  meta-test catches the historical defect) →
  `"T-E77-02 guard-the-guard: the history-fixture detector reds against the
  pre-fix `+"`git show ffa4082:...`"+` line"`.

Coverage: both new/changed test-only surfaces are covered by the tests above;
no production `tools/`/`prompts/`/etc. source changed. Security smoke tests
N/A (no new user input surface; this is test-infrastructure).

## Phase 3.5 — AC Execution
Skipped (no `specs/<feature>.md`, so no `proof:`-annotated ACs to execute —
backlog-row-as-spec mini-chain, mirrors the Phase 0.5/1.5 absent branches).

## Phase 4 — Run

**Build**: `npm run build` — zero compile errors, `check:version` and
`check:transitions-sync` both OK (v3.102.2).

**Local suite (deep clone, this checkout)**: `npm test` → **1736 tests, 1736
pass, 0 fail** (baseline was 1734 all-green-on-deep; +2 new T-E77-02 tests).
This alone is exactly the false green that shipped the original defect and is
NOT reported as sufficient evidence on its own — see the real gate below.

**Real acceptance gate — shallow clone**: this repo's actual working tree has
the E77 fix only in the uncommitted working tree (QA does not commit — that is
release-engineer's job, post-PASS, in one release commit). A literal
`git clone --depth 1 .` of THIS checkout would silently pick up only the last
*committed* revision (`aef076b`), which predates the fix, so it would not
actually exercise the fix under CI's fetch-depth-1 constraint. To get a
faithful, real shallow clone of the FIXED tree without committing to the
project's actual history, I copied the current (tracked + untracked
non-ignored) working tree into a throwaway scratch directory, `git init`'d it
there as a single-commit repo (a scratch artifact only, never part of this
project's real git history), and then ran a genuine `git clone --depth 1
file://...` against that throwaway repo — reproducing exactly the constraint
`actions/checkout@v4`'s default imposes (no arbitrary historical objects
reachable):

```
$ git clone --depth 1 file:///.../repo-under-test /.../shallow-clone-test
Cloning into '.../shallow-clone-test'...
$ cd shallow-clone-test && git cat-file -e ffa4082
fatal: Not a valid object name ffa4082          # <- confirms the CI failure
                                                  #    condition is genuinely
                                                  #    reproduced
$ npm ci
added 174 packages, and audited 175 packages in 8s
$ npm test
...
# tests 1736
# pass 1736
# fail 0
# cancelled 0
```

**1736/1736 pass under a genuinely shallow (depth-1) clone with `ffa4082`
confirmed unreachable** — including both new tests
(`detector soundness: ... byte-identical` and the two T-E77-02 tests). This is
the actual acceptance gate for T-E77-01/T-E77-02 and it is green.

**`npm audit --audit-level=high`**: exit 0, zero HIGH/CRITICAL findings. 5
pre-existing moderate/low findings (`@hono/node-server`, `body-parser`,
`esbuild`, `hono`, `protobufjs`) are all transitive under
`@modelcontextprotocol/sdk@1.29.0` and already dispositioned in
`docs/dependency-advisories.md` (lines 83-98) with an explicit re-review
trigger ("any of these six is promoted to HIGH/CRITICAL... or a ticket is
filed to take the SDK upgrade deliberately") that has not fired. Nothing new to
escalate.

**CI runnability**: `npm test` runs headlessly, zero human interaction,
confirmed in both the deep-clone and shallow-clone runs above.

## Verdict: PASS

T-E77-01: the detector-soundness fixture is now a hermetic literal — both
assertions (structural: exactly 2 asymmetric spans; render: exactly 2 glue
findings including the literal `MUST NOT be touched.7b.`) are unchanged and
verified byte-for-byte against the real historical content before the swap.
Fix shape (i) hermetic fixture, per the row's decision — confirmed it
preserves rather than narrows the guard.

T-E77-02: the meta-test closes the class (no test/ file may read repository
history as a fixture) without banning `git` outright — the 5 legitimately
git-invoking files are verified, individually, not to trip it — and the
guard-the-guard test demonstrates (not merely asserts) that the detector
actually catches the historical defect shape.

E78 (verify-release CI-ground-truth staleness) is out of scope for this cut,
per the row, and was not touched.
## 2026-08-18T04:04:45.445Z — PASS — by qa-engineer

PASS. T-E77-01: test/render-structure.test.mjs's detector-soundness fixture no longer reads git history (git show ffa4082:...) at test time; replaced with a hermetic literal of the two known-broken rationale spans, ffa4082 cited only as provenance in a comment. Both assertions unchanged and verified byte-identical against the real historical content before the swap (structural: exactly 2 asymmetric spans; render: exactly 2 glue findings incl. the literal MUST NOT be touched.7b.). Fix shape (i) hermetic fixture per the row's decision, confirmed to preserve rather than narrow the guard. T-E77-02: added a meta-test sweeping all 93 test/*.mjs files for history-as-fixture reads (git show <rev>:<path> / git log / pinned sha) with zero findings, plus a guard-the-guard test demonstrating the detector reds against a reconstructed pre-fix ffa4082 line; verified the 5 legitimately git-invoking files (feature-lease, context-budget, e16-judge-dispatch-charter, release-staging, verify-release) are not false-positived — all read working-tree state or regex SOP prose, never history. Acceptance: local deep-clone npm test 1736/1736 pass (baseline 1734, +2 new tests); real gate is a genuinely shallow (depth-1) clone built from a throwaway single-commit copy of the fixed working tree (QA does not commit to the real repo) with ffa4082 confirmed unreachable (fatal: Not a valid object name) — 1736/1736 pass there too, reproducing and clearing the exact CI failure condition (run 32093068950). npm audit --audit-level=high: exit 0, zero HIGH/CRITICAL; 5 pre-existing moderate/low findings all already dispositioned in docs/dependency-advisories.md with an unfired re-review trigger. E78 untouched, out of scope. Evidence: qa_reports/review_T-E77-01.md (covers T-E77-01, T-E77-02).

