# Review — T-C7-CR (c7-version-assertion-ownership)

covers: T-C7-01, T-C7-02, T-C7-03, T-C7-04, T-C7-CR

## Summary
- Adversarial review of the uncommitted working-tree diff (`git diff HEAD`) for 4 in-scope impl files against `specs/c7-version-assertion-ownership.md`.
- `content/const-05-core-standards.md` (T-C7-01): the "Test ownership" bullet replaced 1:1 with spec S01 (narrow import/require-path carve-out). `content/skill-release-engineer.md` (T-C7-02): one new Hard-rules bullet = spec S02, placed after the check-version-gate bullet.
- `test/baseline-manifest-gate.test.mjs` (T-C7-03) + `test/pixel-gate-attestation.test.mjs` (T-C7-04): the 2 churning AC-9 tests each rewritten to semver-shape + numeric-tuple floor + dynamic index.ts↔package.json coherence; zero hardcoded release-target literal remains.
- Verdict: **APPROVED**. AC-1..AC-7 met; AC-8/AC-9 are qa-owned rebaseline/gate work in T-C7-QA. Two non-blocking observations recorded (one cosmetic comment nit in-scope; one out-of-scope c8 leftover).

## Correctness
- **S01/S02 verbatim (AC-5, AC-6)** — CONFIRMED byte-identical. Extracted the S01/S02 Copy/Strings cells, stripped the wrapping backticks, unescaped ``\` `` → `` ` ``, and byte-compared against the actual file lines: both `===` true. `content/const-05-core-standards.md:5` is exactly one line replaced (one `-`/one `+`, no other semantic change). S02 lands in the "Hard rules" section immediately after the check-version-gate bullet (`content/skill-release-engineer.md:18`), per spec.
- **Carve-out is narrow (AC-5)** — S01 names the A10 precedent, requires "no test logic, assertion, or expected-value text changes", and ends "No other exceptions." It does not authorize version-literal edits or any qa-shaped assertion change. S02 mandates STOP + route-to-qa-engineer on a future hardcoded-version failure and explicitly forbids hand-editing (cites Constitution §2). Neither string leaks authorization beyond its stated boundary.
- **AC-1/AC-3 (package.json floor)** — semver guard `/^\d+\.\d+\.\d+$/`, then numeric-tuple `>=` floor. The three-clause compare (`t[0]>F[0] || (t[0]===F[0] && t[1]>F[1]) || (t[0]===F[0] && t[1]===F[1] && t[2]>=F[2])`) is correct lexicographic numeric ordering. Verified against edge cases: 3.40.0 == floor → pass; 3.100.0 vs 3.40.0 → pass (second clause, `100>40`); 4.0.0 → pass (first clause); 3.9.0 vs 3.40.0 → correctly fails (`9<40`). No string-compare hazard (the classic `"3.10" < "3.9"` bug) survives — comparison is fully numeric. Floors are correct per-file: `[3,40,0]` (baseline-manifest), `[3,42,0]` (pixel-gate).
- **AC-2/AC-4 (index.ts coherence)** — reads `pkg.version` from `package.json` at test time, extracts the Server() literal via `/Server\(\s*\{[^}]*version:\s*["']([^"']+)["']/s`, guards the match with `assert.ok`, then asserts `match[1] === pkg.version`. Both sides dynamic → passes at any future bump (3.100.0, 4.0.0) as long as the two files agree — the same invariant `scripts/check-version.mjs` enforces. No hardcoded target.
- **AC-7 (grep)** — `grep -rn '"3\.53\.0"'` over both files returns ZERO matches. The only remaining `3.x.y` occurrences are (a) pre-existing out-of-scope historical CHANGELOG/section-header pins (`[3.40.0]`/`[3.42.0]`) and (b) the new floor-value/illustrative comments — none are hardcoded release-target assertions.
- Both suites pass in isolation: baseline-manifest 43/43, pixel-gate 52/52.

## Quality
- **Comment direction inverted (non-blocking, in-scope)** — `test/baseline-manifest-gate.test.mjs:640` and `test/pixel-gate-attestation.test.mjs:743` justify numeric comparison with "so `3.9.0` doesn't falsely fail against a `3.40.0`/`3.42.0` floor." The example has the hazard backwards: `3.9.0` is genuinely below the floor and correctly *fails* under numeric compare; the string-compare bug it means to illustrate actually causes false *passing* for `3.9.0` (string `"3.9.0" > "3.40.0"`) and false *failing* for a value like `3.100.0`. The test *logic* is correct — this is only the comment's chosen illustration. Cosmetic; does not affect any AC. Suggest qa fix the example to `3.100.0` if touching these lines during T-C7-QA, but not required.
- Test naming, structure, and the documented-rationale comment style match the surrounding AC-9 blocks. New code reuses the existing `pkgPath`/`import.meta.url` idiom already present in the file.

## Architecture
- No architecture spec for this feature (content/test-only, mode = no-design). The change follows the exemplar the spec cites: it delegates "is the current release coherent" to the already-dynamic `scripts/check-version.mjs` invariant and relaxes the tests to shape+floor+coherence, mirroring the v3.14.0 `qa-visual-skill-split` AC-7 relaxation precedent. Layering unchanged.
- §2 ownership held: the sr-engineer tasks (T-C7-01/02) touch only the two `content/*.md` files; the qa-engineer tasks (T-C7-03/04) touch only the two `test/*.mjs` files. Diff file-scope is consistent with the ownership split.

## Security
- No findings. No new input crosses a trust boundary. `package.json`/`index.ts` are read read-only from the repo tree via `import.meta.url`-derived paths; no secrets, no injection surface. Content-file edits are prose only.

## Performance
- No findings. Each rewritten test does one extra synchronous `readFileSync` of `package.json` (already read elsewhere in the suite); no hot path, no loop, no algorithmic change.

## Verdict
APPROVED — S01/S02 land byte-verbatim with a provably narrow carve-out, and the 4 rewritten AC-9 tests are fully self-updating (numeric-tuple floor + dynamic cross-file coherence, zero release-target literal), satisfying AC-1..AC-7; the only defects are one cosmetic comment nit and out-of-scope churn (below), neither of which blocks the c7 contract.

## Out-of-scope observations (for coordinator / T-C7-QA, not c7 findings)
- **Uncommitted c8 leftover in `test/context-budget.test.mjs`** — the working tree carries a c8-crash-resume rebaseline (line 741/750: teamwork design-arm cap `9699 → 10774`, comment cites T-C8-01..04) that was NOT committed with the v3.53.0 release (`git show HEAD:test/context-budget.test.mjs` still has 9699). Because HEAD's `skill-coordinator.md` already ships the c8 +48-line growth, HEAD (the tagged v3.53.0) has a red context-budget test. This is a c8 release-hygiene defect, outside c7 scope, but the uncommitted diff will co-mingle with T-C7-QA's rebaseline commit — flag for the coordinator to decide attribution.
- **Known-failing set confirmed as ONLY rebaseline territory** — full-suite failures are exactly: 11 compose-golden byte-identity (`test/compose-equivalence.test.mjs`) + 4 context-budget `~tok` caps (`test/context-budget.test.mjs` tests 85/108/109/121), all driven by the const-05 (S01) byte growth. Per-file tallies confirm no other test file fails. These are the AC-8 qa-owned rebaseline items for T-C7-QA. (The aggregate runner reported `# fail 16`; per-file isolation authoritatively totals 15 across those two files — the extra count is a node:test rollup artifact, not a distinct failure.)
- **Stale cap numbers in `test/context-budget.test.mjs` test titles** — several titles embed old cap literals (e.g. "≤ 9545", "≤ 5561") while the asserts use newer values (10774, 5616). Pre-existing, not introduced by c7; T-C7-QA may wish to resync titles when rebaselining.
