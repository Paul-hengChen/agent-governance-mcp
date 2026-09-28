# Review — T-E7-04

covers: T-E7-01, T-E7-02, T-E7-03

## Summary
- Reviews the uncommitted T-E7-01..03 working-tree diff for e7-governed-git-surface against `specs/e7-governed-git-surface.md`.
- Changes: one new §6 sanctioned-git-ops whitelist bullet in `content/const-15-core-tail.md` (core-tagged), one appended cross-reference sentence on the D10 bullet in `content/skill-release-engineer.md`, four exact cap re-baselines + a stale-title fix in `test/context-budget.test.mjs`, and 11 regenerated compose-golden fixtures.
- All six spec ACs (AC1–AC6) and their `proof:` annotations verified independently. Caps confirmed to be the exact measured values (no padding). `npm run build` clean; `npm test` 1390/1390 pass; `dist/` untouched; zero changes under `gates/`, `tools/`, `index.ts`.
- Verdict: APPROVED.

## Correctness
No findings.

- **AC1 (git diff `content/const-15-core-tail.md`)** — the single new bullet contains, in the same bullet: sanctioned verbs `git add`, `git commit`, `git tag`, fast-forward `git push`; forbidden verbs `git reset`, `git rebase`, `git clean`, force-push (`git push --force`), `git checkout --force`; and the STOP → `status: Blocked` (branch/local SHA/trigger in `pending_notes`) → hand-back-to-coordinator/human phrase. Read-only git (`diff`/`log`/`status`/`show`) explicitly permitted. D10 cited and generalized. Satisfies the grep-based AC1 proof.
- **AC3 (core-tag reachability)** — `prompts/constitution-manifest.ts:64-65` returns `true` for `case "core"` unconditionally; `const-15-core-tail.md` is tagged `core` (line 51). Confirmed the bullet ships in every dispatch arm: all 11 compose-golden fixtures (full/lite × design/non-design × ±fd, plus monolith and hook-full/hook-lite) each gained exactly the identical +1 bullet line (`git diff --numstat`: +1/-0 on every fixture). Reachable in lite mode as required.
- **Expected-red carve-out (SOP 4a)** — the diff touches a test file, but this is a feature-mode ticket (dispatch_mode absent/feature) with no intentionally-red tests: the `context-budget.test.mjs` edit is a cap re-baseline, and the full suite is green. No `expected-red` manifest applies; carve-out not armed.

## Quality
No findings.

- Cap-bump comments in `context-budget.test.mjs` cite the ticket (`e7-governed-git-surface ... T-E7-03, AC4`) per the b9-token-budget-brake convention, and correctly explain that the bullet is unfenced (counts on both raw and stripped paths).
- Bonus fix disclosed and legitimate: the lean-cap test title had stalled at `<= 3087` while its assert had already moved to a higher value (a11-escalation-grammar drift); this change re-syncs the title to `<= 4297`. In-scope housekeeping on the same test being modified, not hidden drift.
- Golden-fixture regeneration is limited to the single bullet delta — spot-checked `build-lite-nondesign.txt`, `build-full-design-fd.txt`, `constitution-monolith.txt`, and `hook-lite.txt`: each is exactly the one identical bullet, no smuggled edits, zero deletions.

## Architecture
No findings. No `-architecture.md` spec for this feature. The design (core-tagged single source of truth in the constitution + pointer-only cross-reference from the role skill) matches the spec Decision and mirrors the cited E10 const-08 precedent. No layering touched.

## Security
No findings. This change *adds* a security-hardening rule (destructive-git STOP discipline for all roles); it introduces no input crossing a trust boundary and no secrets.

## Performance
No findings. Content-only + test-constant change; no runtime code path altered. Cap bumps verified against the invariant margins: design-arm raw−stripped = 298 ~tok (≥ 240) and design-only saving stripped−nonDesign = 2098 ~tok (≥ 2080), both still satisfied.

## Verdict
APPROVED — all of AC1–AC6 verified against the diff and their `proof:` annotations, caps are the exact re-measured values (lean 4297, design-arm 7275, teamwork 14544, non-design 5177) with no unrelated drift, D10 recovery mechanics preserved verbatim (AC5: only an append), and no server-side gate added (AC6: zero changes under `gates/`/`tools/`/`index.ts`, `dist/` untouched). Build clean, 1390/1390 tests pass.

### AC5 non-regression detail
`git diff content/skill-release-engineer.md` shows exactly one changed line — the D10 CRITICAL bullet — with the entire original STOP / `status=Blocked` / `pending_notes` local-release-SHA example / coordinator-recovery text preserved byte-for-byte and a single pointer sentence appended (`... one source of truth is the general git-ops whitelist in Constitution §6 ... this bullet retains only the release-engineer recovery mechanics`). The step-3a re-baseline text lives elsewhere in the file and is untouched (single-line diff). Satisfies AC2 (a §6/"general git-ops whitelist" reference exists) and AC5 (recovery mechanics unchanged) simultaneously.
