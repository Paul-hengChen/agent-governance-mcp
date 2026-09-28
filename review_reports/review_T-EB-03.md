# Review — T-EB-03 (batched round)

covers: T-EB-01, T-EB-02, T-EB-03

Scope contract: no spec file — the spec IS docs/backlog.md E14 + E16 rows plus
the tasks.md `## E14+E16 batch` ticket text. Reviewed against the working-tree
diff (uncommitted) vs base. Base version in-tree is 3.82.0 (release bump to
3.83.0 is release-engineer scope, correctly not done here).

## Summary
- **T-EB-01 (E14)**: adds Check 6 "CI ground-truth" to `scripts/verify-release.mjs` — reads the latest COMPLETED CI-workflow run on `--branch main` via `gh run list`, FAILs only on a parsed run whose `conclusion !== "success"`, and WARN-and-continues on every "cannot obtain ground truth" path (gh missing / non-zero exit / unparseable / zero runs). One SOP sentence appended to `content/skill-release-engineer.md` step 9a + the header comment block.
- **T-EB-02 (E16 option B)**: content-only. `content/const-08-chain-31-mid.md` §3.1 Amend-Resume Edge bullet gains a "Single-role judge dispatch" charter clause; `content/coord-03-core-fallback.md` Amend-Resume relay row gains a pointer sentence. `tools/transitions.ts`, `gates/`, `index.ts` untouched (confirmed via `git status`).
- Mechanical: 7 compose-golden fixtures regenerated (lite fixtures byte-unchanged — const-08 is chain-tagged, lands on chain paths only); 3 token caps re-baselined in `test/context-budget.test.mjs`.
- Independently verified: `npm run build` clean, `npm test` 1408/1408 green; all 3 caps re-measured EXACT (7435 / 14740 / 5337); margins hold (raw−stripped 312 ≥ 240, design−nondesign 2098 ≥ 2080).
- Verdict: **APPROVED**.

## Correctness
No blocking findings.

- **Check 6 exception-safety (focus 1) — verified path by path, safe.** `spawnSync` does not throw on ENOENT (returns `{error}`); the `res.error` branch warns+returns before any throw. `res.status !== 0` branch guards `res.stderr` with `(res.stderr || "")` (null-safe) and warns+returns. `JSON.parse` is wrapped in its own try/catch → warn (handles empty/`undefined`/malformed stdout). The `!Array.isArray || length===0` branch warns+returns. Every documented graceful-degradation path exits via `warn()`+`return` *before* any throwable operation, so none can reach the `runCheck` outer catch and become a false FAIL. The only residual throw is destructuring a non-object element (e.g. JSON `[null]`), which `gh --json` never emits; if it ever occurred the outer catch fails-closed (a loud FAIL, not a silent pass) — acceptable and arguably correct. `scripts/verify-release.mjs:176-241`.
- **FAIL trigger is exactly the ticket contract.** The sole `fails.push` fires only when a parsed `runs[0].conclusion !== "success"` — a definitively red completed run. Matches "STOP only on a definitively red latest run". `scripts/verify-release.mjs:236-240`.
- **`--workflow CI` is functional, not a silent no-op.** `.github/workflows/ci.yml` line 1 is `name: CI`, so the filter resolves; a name mismatch would only degrade to WARN, never false-pass. Verified.
- **`--branch main` latest-completed keying (focus 3) — sensible for the intent.** Keying `--commit <release SHA> --status completed` at self-check time would return zero completed runs (the just-pushed release commit's CI is still running) → perpetual WARN → a check that never verifies. Reading the latest *completed* run on main yields the real available ground-truth signal ("was main healthy going into this release"), which aligns with the task's "keyed to the pre-release head" wording. The backlog row's looser "keyed on the release commit SHA" phrasing is superseded by the more-specific task text and the stated rationale; zero-runs graceful degradation means the keying choice can never false-block. Defensible.
- **VR-8 stale title (focus 5) — correctly deferred to QA.** `test/verify-release.test.mjs:362` still titled "all 5 checks pass" though 6 checks now exist. The test remains green: its loop asserts OK lines for 5 *named* checks (not a count), and Check 6 degrades to OK+WARN in the fixture repo (no github remote resolvable) with stderr empty. Test authoring — retitling VR-8 and adding CI-step degradation/red coverage — is T-EB-04 qa-engineer scope; sr-engineer authoring the tests that judge its own work would violate builder≠judge (§2/§3.2). Right call.

## Quality
No blocking findings.

- `updatedAt` is requested in `--json conclusion,headSha,url,updatedAt` but never consumed. Zero functional impact (extra JSON fields are free); noted only as a trivial cleanup candidate. `scripts/verify-release.mjs:196`.
- The design-arm re-baseline WHY block retains a prior "raw − stripped = 298" line while the current measured margin is 312; the assertion (`>= 240`) is correct and passes. Comment-only staleness, non-blocking. `test/context-budget.test.mjs` AC8 design-arm block.
- Comments, naming, and the `runCheck`/`warn` structure match the surrounding checks 1–5 exactly. WARN wording is consistent and self-labels the E14 degradation.

## Architecture
No findings. E16 is delivered as option B (content-only, zero server code) exactly as the ticket mandates — `tools/transitions.ts`, `gates/`, `index.ts` untouched, so `ALLOWED_TRANSITIONS` and every gate are byte-identical. Check 6 uses the established independent-`runCheck` pattern, preserving the "checks run independently, multi-cause failures all surface" invariant documented in the file header.

## Security
No findings. `gh` is invoked via `spawnSync` with a fixed argv array (no shell, no interpolation of untrusted input) — no injection vector. No secrets introduced. `gh` output crosses a trust boundary only as JSON parsed inside a try/catch; a hostile/garbled payload degrades to WARN, never to code execution. The charter text introduces no new server-trusted field (attestation trust class is unchanged and explicitly stated).

## Performance
No findings. Check 6 adds exactly one `gh` subprocess with `--limit 1` at release-self-check time (a manual, once-per-release operation) — no hot path, no loop, no unbatched I/O. Consistent with checks 2's single `git fetch`.

## Verdict
**APPROVED** — Check 6 degrades gracefully on every "cannot obtain ground truth" path and FAILs only on a definitively red completed run (exception-safe, verified path by path); WARN-to-stdout is contract-conforming and load-bearing for VR-8's stderr-empty pin, not pin-dodging; the §3.1 charter broadens without weakening (resume_of still required, judge-roles-only, no build-role edge, no retired-token regex collision); transitions/gates/index untouched; caps re-measured exact; build clean and 1408/1408 green. VR-8 title correction + new CI-step tests are correctly left to T-EB-04.
