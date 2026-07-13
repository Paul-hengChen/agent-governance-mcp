# Review — T-E17-04 addendum: VR-13 CI Fix

covers: T-E17-04 (post-PASS fix; original PASS record archived unmodified at
`qa_reports/archive/e17-release-record-integrity/review_T-E17-04.md`)

This is a new, separate artifact rather than an edit to the archived T-E17-04
PASS record: the original ticket's scope was the `content/skill-release-engineer.md`
+ `templates/claude-code-agents/release-engineer.md` Hard-rule pinning tests
(E17-S1..S4); this fix is unrelated in scope (`test/verify-release.test.mjs`,
E14's Check 6 test infra) and should not be folded into that immutable record.

## VR-13 CI Fix

### Symptom
`test/verify-release.test.mjs`'s **VR-13** ("gh binary not on PATH → ENOENT
WARN") has been red on every `main` CI run since v3.83.0 (cbe0d21), correctly
blocking v3.84.0's release self-check (Check 6 reads CI ground truth — E14 —
so the red run legitimately stopped the release from claiming green). The
test passes locally (macOS + Homebrew) and fails only on GitHub's
`ubuntu-latest` hosted runners.

### Root cause
VR-13 built its "no `gh` on PATH" fixture from a hardcoded system path:

```js
const GH_LESS_SYSTEM_PATH = "/usr/bin:/bin";
```

reasoning "`git` lives there but `gh` doesn't" — an assumption that only
holds on the author's own machine. On macOS with Homebrew, `git` resolves to
Apple's `/usr/bin/git` stub while `gh` lives at `/opt/homebrew/bin/gh` —
outside `/usr/bin:/bin`, so the fixture genuinely produced ENOENT. On
GitHub's `ubuntu-latest` runner image, the `gh` CLI is preinstalled via apt
directly at `/usr/bin/gh` — inside `/usr/bin:/bin`. So in CI,
`scripts/verify-release.mjs`'s Check 6 (`spawnSync("gh", [...])`) resolved
and ran the REAL `gh` binary instead of ENOENT-ing. Real `gh`, unauthenticated
(CI does not export `GH_TOKEN`/`GITHUB_TOKEN` into the job env — confirmed by
reading `.github/workflows/ci.yml`, which sets neither), exits non-zero with
an auth/resolution error. `scripts/verify-release.mjs` handled this exactly
per its own documented contract: `res.error` is unset (the spawn itself
succeeded), so it falls into the `res.status !== 0` branch and emits the
**gh-run-list-failed WARN** (the branch VR-14 pins), never the **ENOENT
WARN** VR-13's regex requires. Product behavior was correct throughout — the
script degraded gracefully exactly as designed (E14's contract: never block
a release on missing/unconfigured `gh` tooling) — the test's environment
assumption was wrong, not the script.

### Fix chosen
Per the suggested direction, made the ENOENT scenario deterministic on any
machine rather than relaxing VR-13's specificity (VR-14 already separately
pins the gh-errored/WARN branch, so collapsing VR-13 into a generic
degradation assertion would have thrown away real coverage for no reason).

Replaced the static `GH_LESS_SYSTEM_PATH` constant with a dynamically-built
shim directory (`noGhSystemPath()` in `test/verify-release.test.mjs`)
containing symlinks to ONLY the external binaries this test file legitimately
needs, resolved from whatever the CURRENT test process's own `PATH` points
at (never a hardcoded, host-shaped guess):
- `git` — the sole PATH-resolved binary `scripts/verify-release.mjs` and
  `scripts/check-version.mjs` actually invoke (`node` itself runs via the
  absolute `process.execPath`; `check-version.mjs`'s `execSync` shells out to
  the literal `/bin/sh`, not a PATH-resolved `sh`).
- `cat` — needed because the `ghJsonShim()` fixture bodies used by
  VR-11/VR-12/VR-15 pipe canned JSON through `cat <<'EOF' ... EOF`, an
  external command the shell resolves via `PATH` (the `echo`-only shim
  bodies used by VR-14/VR-16 need nothing extra, since `echo` is a shell
  builtin).

Because the shim dir is built to contain exactly these two binaries and
nothing discovered from a hardcoded path guess, `gh` is guaranteed absent
from it on any host — the ENOENT guarantee VR-13 needs no longer depends on
where a given OS/package-manager happens to install `gh`.

Applied the same `noGhSystemPath()` builder to all six Check-6 tests
(VR-11, VR-12, VR-13, VR-14, VR-15, VR-16) that previously referenced
`GH_LESS_SYSTEM_PATH`, for consistency — VR-11/12/14/15/16 were not
functionally broken (their own `gh` shim directory is prepended first in
`PATH`, so it always won PATH-resolution over any real `gh` elsewhere), but
leaving them on the old hardcoded-path helper while VR-13 alone used a new
one would have left an inconsistent, confusing two-mechanism test file for
no benefit.

### Audit of VR-11..VR-16 for the same class of env-dependence
- **Ambient `GH_TOKEN`/`GITHUB_TOKEN`**: none of VR-11/12/14/15/16 are
  sensitive to these — each shims `gh` with a static script body (`cat` a
  canned JSON heredoc, or `echo` a canned error) that ignores its
  environment and argv entirely; there is no code path in the shim scripts
  that reads any env var. Confirmed via `grep -n "GH_TOKEN\|GITHUB_TOKEN\|GITHUB_ACTIONS" test/verify-release.test.mjs` — zero references. `runVerifyWithPath` does spread `...process.env` into the child (so ambient `GH_TOKEN`/`GITHUB_TOKEN` do flow through), but since the shim ignores env, this is inert for VR-11/12/14/15/16, and VR-13 (post-fix) never reaches a real `gh` at all.
- **VR-8** (`test("VR-8 (AC8): all 6 checks report OK ...")`, not itself
  numbered VR-11..16 but sharing Check 6) intentionally does NOT shim `gh` —
  it drives the real environment's `gh` binary (or its absence) against a
  fixture whose `origin` remote is a local bare repo path, not a real GitHub
  host. This is robust to environment by construction: whether `gh` is
  missing (ENOENT), unauthenticated, or simply can't resolve a GitHub host
  from a local-path remote, Check 6 degrades via WARN in every case, and the
  test only asserts the generic `/WARN: CI ground-truth —/` pattern (not a
  specific reason string) — verified by rereading the test body, no fix
  needed.
- **Other suites**: no other test file in `test/` shims or invokes `gh`, and
  no other test references a hardcoded `/usr/bin`-style system path for a
  similar "binary must appear absent" fixture (`grep -rn "usr/bin:/bin\|GH_LESS_SYSTEM_PATH" test/` — only the file fixed here, now with zero
  remaining references after this change).
- **`git` resolution itself**: unaffected — every fixture already runs real
  `git` against a fully-controlled temp repo (pre-existing convention, not
  part of this defect class).

## Evidence

**`npm run build`** — clean, `check:version` OK at 3.84.0 (no-op relevant,
test-only change).

**`test/verify-release.test.mjs` in isolation** (local, macOS):
```
$ node --test test/verify-release.test.mjs
# tests 26
# pass 26
# fail 0
```

**CI-condition simulation** (best-effort, per task item 2): ran VR-13 alone
with `GH_TOKEN`/`GITHUB_TOKEN` unset and `PATH` forced to include a directory
where the real, reachable `gh` binary resolves (mimicking `ubuntu-latest`'s
`/usr/bin/gh`):
```
$ env -u GH_TOKEN -u GITHUB_TOKEN PATH="/opt/homebrew/bin:/usr/bin:/bin:..." \
    node --test --test-name-pattern="VR-13" test/verify-release.test.mjs
✔ VR-13 (E14 degradation): gh binary not on PATH -> WARN on stdout naming gh unavailability, check still OK, exit 0
# pass 1, fail 0
```
This passes because `noGhSystemPath()` builds its shim from resolved
binaries, not from the ambient `PATH` handed to the test process — the fix
holds regardless of what the surrounding environment looks like.

Additionally reproduced the OLD bug standalone (throwaway script, not
committed) by pointing the pre-fix `GH_LESS_SYSTEM_PATH`-style path at a
directory containing both a real `git` and a real, reachable `gh` (the exact
shape of `ubuntu-latest`'s `/usr/bin`), with `GH_TOKEN`/`GITHUB_TOKEN`
unset — confirmed it takes the gh-run-list-failed WARN branch, not the
ENOENT WARN branch, i.e. the exact CI failure mode reported:
```
WARN: CI ground-truth — gh run list failed: failed to determine base repo:
none of the git remotes configured for this repository point to a known
GitHub host. To tell gh about a new GitHub host, please use `gh auth login`;
continuing without CI verification (graceful degradation, E14)
Old-code VR-13 regex would match? false
```

**Full suite**: `npm test` → **1424/1424 pass**, 0 failures (no regressions;
test count unchanged — this is a fixture-construction fix inside existing
tests, not new tests).

## Verdict
Test-infra defect confirmed and fixed. VR-13's environment assumption
("`/usr/bin:/bin` never contains `gh`") was false on GitHub-hosted
`ubuntu-latest` runners; the product code (`scripts/verify-release.mjs`)
behaved correctly throughout per its documented graceful-degradation
contract. Fix makes the "no `gh` anywhere on PATH" fixture deterministic on
any host by resolving its shim binaries from the running test process's own
environment rather than a hardcoded path. No other test in the suite was
found to share this class of host-shape-dependence after auditing VR-8 and
VR-11..VR-16 plus a repo-wide grep for the same pattern.
