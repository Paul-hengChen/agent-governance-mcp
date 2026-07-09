# c7-version-assertion-ownership

## Problem Statement
Constitution §2 (`content/const-05-core-standards.md`) states "ONLY qa-engineer
writes test files. No exceptions." In practice this bright line has already
been crossed mechanically and silently: at v3.46.1 release-engineer edited 4
version-assertion tests to retarget hardcoded version-literal strings
(`3.46.0` → `3.46.1`), and it happened again at v3.53.0
(`test/baseline-manifest-gate.test.mjs` + `test/pixel-gate-attestation.test.mjs`,
bumped to `3.53.0`). Each recurrence is a "quiet, sanctioned-in-practice
violation" (docs/backlog.md §C7) — the kind of routine violation that erodes a
bright-line rule by precedent instead of by decision.

Survey of `test/` confirms exactly 4 tests carry this hardcoded-literal
maintenance burden, all under one `AC-9` heading pattern in two files:

| file | test name | current hardcoded literal |
|---|---|---|
| `test/baseline-manifest-gate.test.mjs:631` | `AC-9: package.json version field equals 3.53.0` | `"3.53.0"` |
| `test/baseline-manifest-gate.test.mjs:640` | `AC-9: index.ts Server() literal equals 3.53.0` | `"3.53.0"` |
| `test/pixel-gate-attestation.test.mjs:734` | `AC-9: package.json version field equals 3.53.0` | `"3.53.0"` |
| `test/pixel-gate-attestation.test.mjs:742` | `AC-9: index.ts Server() literal equals 3.53.0` | `"3.53.0"` |

(The adjacent `AC-9`/`AC-10` CHANGELOG-heading tests in both files pin a
**historical, fixed** version — `[3.40.0]` / `[3.42.0]`, the release each
feature originally shipped in — and never need bumping. They are out of
scope; only the 4 rows above churn every release.)

This exact failure mode was already solved once in this codebase for a
different test: `test/qa-visual-skill-split.test.mjs`'s `AC-7` originally
pinned "current version equals X" and was relaxed at v3.14.0 to a permanent
CHANGELOG-history-retention check, explicitly delegating "is the *current*
release internally coherent" to `scripts/check-version.mjs` (already
dynamic — reads `package.json`/`index.ts` at run time, no hardcoded target;
run in `prebuild` and again at release-engineer SOP step 7). This spec
applies the same relaxation to the 4 AC-9 tests above.

## User Stories
- As a release-engineer, I want version-assertion tests to validate
  themselves against the live `package.json`/`index.ts` values, so that a
  routine version bump never requires me to edit a test file (and never
  requires a silent §2 exception).
- As a maintainer, I want Constitution §2's test-ownership rule to state its
  actual boundaries precisely, so that the one class of edit that genuinely
  cannot be made test-content-agnostic (import/require path retargets after a
  file move, per the A10 precedent) has an explicit, narrow carve-out instead
  of an unwritten one.
- As a qa-engineer, I want the AC-9 test bodies to keep asserting something
  meaningful (semver shape + monotonic floor + cross-file coherence) rather
  than being deleted outright, so the original AC-9 intent ("the version bump
  is self-consistent") is preserved.

## Acceptance Criteria

- **AC-1** — Given `test/baseline-manifest-gate.test.mjs`'s test currently
  named `AC-9: package.json version field equals 3.53.0`, when qa-engineer
  rewrites it, then it no longer contains any hardcoded target version
  string; it asserts (a) `pkg.version` matches `/^\d+\.\d+\.\d+$/` (valid
  semver shape) and (b) `pkg.version`'s `[major,minor,patch]` tuple is
  numerically `>=` the historical floor `[3,40,0]` (the version AC-9
  originally shipped in, per the file's own `AC-9` section-header comment at
  line 12/628) — using numeric tuple comparison, not string comparison. The
  test passes unmodified at every future `package.json` version.
- **AC-2** — Given the same file's test currently named
  `AC-9: index.ts Server() literal equals 3.53.0`, when qa-engineer rewrites
  it, then it no longer contains any hardcoded target version string; it
  reads `pkg.version` from `package.json` at test time, extracts the
  `Server({ ..., version: "..." })` literal from `index.ts` via the existing
  regex shape, and asserts the extracted literal `===` the dynamically-read
  `pkg.version` (cross-file coherence — the same invariant
  `scripts/check-version.mjs` already enforces). The test passes unmodified
  at every future version, including future major/minor bumps.
- **AC-3** — Given `test/pixel-gate-attestation.test.mjs`'s test currently
  named `AC-9: package.json version field equals 3.53.0` (line 734), when
  qa-engineer rewrites it, then it follows AC-1's shape with this file's own
  historical floor `[3,42,0]` (per the file's `AC-9` section-header comment
  at line 731).
- **AC-4** — Given the same file's test currently named
  `AC-9: index.ts Server() literal equals 3.53.0` (line 742), when
  qa-engineer rewrites it, then it follows AC-2's shape (dynamic
  `pkg.version` vs. extracted `index.ts` literal, no hardcoded target).
- **AC-5** — Given `content/const-05-core-standards.md`'s "Test ownership"
  bullet, when compared against this spec's Copy/Strings block below, then
  it now contains the narrow import/require-path-retarget carve-out verbatim,
  and no other semantic change (test *logic*/*assertion* authorship remains
  qa-engineer-exclusive; the carve-out does NOT cover version literals —
  AC-1..AC-4 remove that need entirely, so no exception is warranted for
  them).
- **AC-6** — Given `content/skill-release-engineer.md`'s "Hard rules"
  section, when compared against this spec's Copy/Strings block below, then
  it now contains a new bullet verbatim, directing release-engineer to STOP
  and route to qa-engineer (not hand-edit) if `npm test` ever again fails on
  a hardcoded version literal.
- **AC-7** — Given the full test suite after AC-1..AC-4 land, when
  `grep -rn '"3\.53\.0"' test/baseline-manifest-gate.test.mjs test/pixel-gate-attestation.test.mjs`
  runs, then it returns zero matches (no release-specific literal remains in
  either file's AC-9 block).
- **AC-8** — Given `content/const-05-core-standards.md`'s edit (AC-5) changes
  that fragment's byte length, when qa-engineer runs the full suite, then
  `test/fixtures/compose-golden/` fixtures (via
  `scripts/capture-constitution-golden.mjs`) and any tripped `~tok` caps in
  `test/context-budget.test.mjs` are regenerated/rebaselined with a
  documented old→new comment (house convention: qa-owned bump, C2-06/A11-02
  precedent) so `npm test` stays green.
- **AC-9** — Given all of AC-1..AC-8, when `npm run build && npm audit
  --audit-level=high && npm test` runs, then it exits 0 with zero failing
  tests and zero high/critical audit findings.

## Copy / Strings

Exact-text blocks below are binding — copy verbatim, do not paraphrase.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| S01-const05-carveout | `- **Test ownership**: ONLY qa-engineer writes test files, with one narrow carve-out — mechanical import/require-path retargets: when another role moves or renames a module a test imports, that role MAY update the affected test file's import/require path(s) to the new location, provided no test logic, assertion, or expected-value text changes (precedent: A10 gate-registry module split, \`specs/gate-registry.md\` — "assertions unmodified — only import paths may change"). No other exceptions.` | authored-here — replaces the current line-5 bullet in `content/const-05-core-standards.md` 1:1; wording chosen to name the exact precedent (A10) so the carve-out cannot be stretched to cover version literals or any other case (per PM decision below, "Design Decision"). |
| S02-release-eng-hardrule | `- **Version-assertion tests are self-updating, not release-engineer's to edit**: \`test/baseline-manifest-gate.test.mjs\` and \`test/pixel-gate-attestation.test.mjs\`'s AC-9 tests read \`package.json\`/\`index.ts\` dynamically (no hardcoded target version) — a version bump (SOP step 4) requires ZERO test-file edits. If \`npm test\` (SOP step 6) ever fails on a version-literal mismatch, a new hardcoded-version assertion was introduced somewhere — do NOT hand-edit it yourself (Constitution §2); STOP and route to qa-engineer via \`pending_notes=["release-engineer: found hardcoded version literal in <test file> — qa-engineer must retarget or relax it", "next_role: qa-engineer"]\`.` | authored-here — new bullet inserted into `content/skill-release-engineer.md`'s "Hard rules" section (after the existing "check-version gate" bullet); closes the loop so a *future* hardcoded-version test never becomes a second unwritten §2 exception. |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals (content/test-only change) |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Design Decision — why (a) is minimal-scope, not abandoned

The backlog states "(b) is stronger" and this spec adopts (b) — dynamic,
self-updating assertions (AC-1..AC-4) — as the **primary mechanism** for the
version-literal case; after AC-1..AC-4 ship, no role will ever again need to
touch a test file for a version bump, so no §2 exception is needed for that
case.

A minimal (a)-style carve-out (AC-5/S01) is still added, but scoped
**narrowly to import/require-path retargets**, not version literals, because:

1. Unlike version literals, an import path cannot be made "read itself
   dynamically" — it is a syntactic reference to a module location. When a
   role other than qa-engineer moves or renames that module (e.g. the A10
   gate-registry split, where sr-engineer retargeted 12 test files' imports
   from `tools/evidence-file.ts` to `gates/*.ts`, per
   `specs/gate-registry-architecture.md`), the test file's import statement
   must change or the suite goes red on an unrelated refactor — there is no
   (b)-equivalent fix.
2. That case already happened (A10) and was "ruled acceptable" per
   `docs/backlog.md` §C7's own framing — i.e. it is already an unwritten
   exception in practice. Leaving it unwritten is exactly the erosion-by-
   precedent risk this spec exists to close for version literals; writing it
   down, narrowly, closes it for this case too instead of leaving one
   loophole open while sealing the other.
3. The carve-out text (S01) explicitly excludes "logic, assertion, or
   expected-value text changes" — it cannot be stretched to authorize a
   qa-engineer-shaped edit (new/changed assertions) by a non-qa-engineer
   role, and it does not reference version literals at all (AC-1..AC-4 remove
   that need before this bullet ships).

## Out of Scope
- Any change to the CHANGELOG-heading AC-9/AC-10 tests in either file
  (`[3.40.0]` / `[3.42.0]` headings) — these already pin a fixed historical
  version per the existing AC-7 precedent and need no edit.
- Any change to `scripts/check-version.mjs` — it is already fully dynamic
  and is the exemplar this spec's AC-1/AC-2/AC-3/AC-4 follow.
- Extending the import/require-path carve-out (S01) to any role other than
  "the role that moved/renamed the module" performing that specific
  mechanical edit, or to any other file type.
- Retroactively re-litigating the v3.46.1 / v3.53.0 incidents — this spec is
  forward-looking only.

## Dependencies / Prerequisites
None external. `content/const-05-core-standards.md` is composed into the
constitution via `prompts/constitution-manifest.ts` (tag `core`, always
included) — editing it requires regenerating `test/fixtures/compose-golden/`
per AC-8. No PRD/design docs exist for this feature (content-only, mode =
no-design); Visual Structural Assertions section omitted per Spec Schema.
