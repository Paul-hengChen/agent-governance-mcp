# Review — T-E60-01 (e60-lockfile-version-parity)

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- 3 in-cut files: `scripts/check-version.mjs` (+47 lines, new lockfile-parity block after the dist block), `package-lock.json` (2 lines, 3.97.1 -> 3.104.3, zero dependency-tree churn), `content/skill-release-engineer.md` (step-4 bump bullet, `package-lock.json` added to step 8's git-add line + `bash -c` PATHS pre-filter, E71a prose count 30/19+11 -> 31/19+12).
- The guard itself is sound. I probed 18 lockfile shapes against a fixture root (present/absent, invalid JSON, empty file, whitespace-only, missing root `version`, `packages` absent, `packages[""]` absent, `packages`/`packages[""]` null, non-object JSON, fields disagreeing with each other while one matches `pkg.version`, non-string version types). **Zero vacuous passes**: every shape except "both fields match" and "lockfile absent" exits non-zero. This is the E60 defect class and it is closed.
- Step ordering is correct: the bump bullet is step 4's last bullet, so the lockfile is refreshed before step 5's `npm run build` / sanctioned `npx tsc` + `check-version.mjs` path and before step 7's `check-version.mjs`. No new deadlock on the ordering surface. Also confirmed no npm lifecycle script (`prebuild`/`postbuild`/`pretest`) is triggered by `npm install --package-lock-only`, so step 4 cannot re-enter `check:version` against a stale `dist/`.
- Count coherence verified by counting real tokens, not by trusting the increment: the git-add line and the PATHS variable are token-for-token identical (same set AND same order), 31 tokens = 19 trailing-slash directories + 12 metadata paths (with `dist/` classified as metadata per the pre-existing convention, matching the test's `FEATURE_DIRS`(19) + `METADATA_PATHS`(6+1) + `E65_METADATA_PATHS`(5) partition). Prose is arithmetically true.
- One blocking finding, F1: the SOP now mandates a write to `package-lock.json` that its own `## Artifact` allowlist does not permit. Same-file self-contradiction, one-line fix. Verdict: CHANGES_REQUESTED.

## Correctness

**F1 (BLOCKING) — `content/skill-release-engineer.md:27-39` vs `:54`: step 4 mandates a write to a file absent from the role's own Artifact allowlist.**
The new bullet at `:54` is imperative and explicitly non-optional ("REQUIRED here, not optional"): the release-engineer must run `npm install --package-lock-only`, which rewrites `package-lock.json`. But the `## Artifact` section at `:27` opens "Release-engineer is allowed to write to:" and enumerates a closed list at `:28-39` — `package.json`, `index.ts`, `CHANGELOG.md`, `README.md`, `.current/.config.json`, `docs/backlog.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `qa_reports/archive/**`, `review_reports/archive/**`, `dist/**`. `package-lock.json` is not on it.

Why this is blocking rather than cosmetic:
- The conflict is unresolvable from the file alone, and the conservative resolution is the damaging one. A release-engineer that reads the allowlist as closed and declines to regenerate the lockfile then reaches step 7, where `check-version.mjs` now hard-fails on lockfile drift — the release deadlocks on this cut's own new check. That is exactly the failure shape step 5 already documents for `dist/`, arriving through the governance surface instead of the ordering surface. The ordering fix at `:54` is correct; it just does not protect against this path.
- The file's own precedent is to reconcile this tension in writing rather than leave it to inference: the MUST-NOT paragraph at `:52` spends a full sentence on `gates/` explaining that *staging* someone else's change is not *authoring* it ("E64 judgment call, stated rather than assumed"). That reconciliation does not extend to `package-lock.json`, because here release-engineer genuinely authors (regenerates) the artifact — it is not a staging-only case.
- The allowlist already has the exact entry shape needed, at `:39`: `` `dist/**` (via `npm run build` only — never hand-edited) `` — a tool-generated artifact admitted with its generating command named. `package-lock.json` is the same category.

Fix (one line, in the same in-cut file, no other surface touched): add to the `## Artifact` list, adjacent to `:28`'s `package.json` entry —
```
- `package-lock.json` (the root `version` and `packages[""].version` fields only — refreshed via `npm install --package-lock-only` per SOP step 4, never hand-edited)
```
This is E60's own surface, not E94's: E94 owns the `CONTRIBUTING.md` / `tasks.md` stage-list additions and the option-(iii) cut-manifest assertion, not this role's Artifact allowlist. No test enumerates the allowlist (`grep "allowed to write" test/` -> no hits; `test/skill-evolution-v3.11.test.mjs:110` only asserts the `## Artifact` heading exists), so this addition breaks nothing and needs no qa pin.

**No vacuous-pass finding — probed, not assumed (`scripts/check-version.mjs:77-113`).** Fixture root (real script text, synthetic `package.json`/`index.ts`/`dist/index.js`), 18 lockfile shapes:

| shape | exit | branch |
|---|---|---|
| both fields match | 0 | `package-lock.json parity OK (…)` |
| root `version` stale | 1 | mismatch, names pkg + both lockfile fields |
| `packages[""].version` stale only | 1 | mismatch, names both |
| fields disagree, root matches `pkg.version` | 1 | mismatch, names both |
| invalid JSON / empty file / whitespace-only | 1 | parse branch |
| no root `version` | 1 | shape branch, `observed root=undefined` |
| `packages` absent entirely | 1 | shape branch |
| `packages[""]` absent, root matches | 1 | shape branch |
| `packages` null / `packages[""]` null | 1 | mismatch branch (`…=null`) |
| JSON `[]` / JSON string literal | 1 | shape branch |
| numeric `version` (`2.5`) / empty-string versions | 1 | mismatch branch |
| lockfile absent | 0 | informational skip note |

No path exits 0 without having compared both fields against `pkg.version`. The `undefined`-only shape check at `:92` is not a hole: null/false-ish values fall through to the strict `!==` comparison at `:100` and still fail loud, just with the mismatch message instead of the shape message.

**F2 (non-blocking) — `scripts/check-version.mjs:89`: one shape crashes with a stack trace instead of the guarded message.** A lockfile whose entire content is the JSON literal `null` parses successfully, so the `try/catch` at `:80-87` does not fire, and `:89` throws `TypeError: Cannot read properties of null (reading 'version')`. Exit is still non-zero, so this is *not* a vacuous pass and not the E60 defect class — but it is the one shape where the block's own promise ("fail loud on … a parse/shape failure", `:70-75`) degrades to an unguided crash, and the guidance sentence ("regenerate it with `npm install --package-lock-only`") is exactly what a release-engineer needs at that moment. Hoisting the null/non-object case into the shape predicate closes it: `if (lock === null || typeof lock !== "object" || lockRootVersion === undefined || …)`. Contrast with the dist branch, which reads text and regex-matches and so has no analogous shape.

**Expected-red manifest — verified complete and correct (SOP step 4a).** `qa_reports/expected-red_e60-lockfile-version-parity.txt` holds one structured entry; with fewer than 3, I sampled all of it. The named pair is real and locatable: `test/release-staging.test.mjs:2150`, test title byte-matching the manifest's test-name string. I reproduced the red independently — `node --test test/release-staging.test.mjs` gives 75/76 with `not ok 68`, `expected: 30 / actual: 31`, i.e. the `stagedTokens.length` assertion at `:2159`. Across the six test files that reference `skill-release-engineer.md` and are plausibly prose-coupled (`release-staging`, `check-version`, `context-budget`, `render-structure`, `skill-evolution-v3.11`, `verify-release`) the total is 192/193 — this is the only red, so the manifest's "ONLY suite failure" claim holds on the surface most at risk from the prose edit (the +~500-char step-4 bullet does not breach the context budget).

I then verified *completeness* rather than plausibility: I re-implemented test 68's body verbatim in a standalone script with the manifest's four stated edits applied (`package-lock.json` appended to `METADATA_PATHS`; both `assert.equal(…, 30)` -> 31; `/30 paths/` -> `/31 paths/`; `/19 directories \+ 11 metadata paths/` -> `12`) and ran it against the real SOP text. All assertions pass, including the `deepEqual` set-equality and the AC1 membership loop at `:239` that also consumes `METADATA_PATHS`. The manifest is sufficient — no fifth edit is needed for green, and no other test consumes these constants (`grep METADATA_PATHS test/*.test.mjs` is confined to `release-staging.test.mjs`).

Two comment/label sites the manifest could name but does not — non-blocking, and *not* something sr should fix (qa-owned file), only something worth passing to qa so the same stale-count class this cut cites (E70) is not reintroduced inside the test: the test title at `:2150` and the three assertion messages at `:2159-2166` still read "30"/"11 metadata"; the `METADATA_PATHS` header comment at `:102-104` still says "Six pre-E65 … plus the five E65 paths" (becomes seven); and the coverage note at `:2151-2153` ("an exact-token-count pin must normalize it away or it reads 31, not 30") reads confusingly once the normalized count *is* 31. None affect green.

## Quality
- The new block mirrors the dist block's structure faithfully — same comment-then-guard shape, same "a guard that can't find what it checks must not pass silently" phrasing, same `console.log` parity line + `else` skip note. Error messages name observed values on both the mismatch and shape paths, and both name the remedy command. Convention fit is good.
- Minor: the mismatch message renders empty-string versions invisibly (`root version= packages[""].version=`) in the all-empty-string shape. Exit is 1, so behavior is right; only the message reads oddly. Quoting the interpolations would fix it. Not worth a round on its own.
- **F3 (non-blocking) — `content/skill-release-engineer.md:17`, the `check-version gate` Hard rule.** It enumerates what an incoherent bump means: "across `package.json` / `index.ts` Server() literal / `dist/index.js` / `CHANGELOG.md`". The failure surface of that very script just grew a fifth member, and this enumeration was not updated — a release-engineer diagnosing a red `check-version.mjs` from this bullet gets a list that cannot explain the failure it is reading. Same one-line class as F1; worth folding into whatever round fixes F1 since it is the same file and the same omission pattern. (Step 6's `:56` parenthetical about `test/qa-visual-skill-split.test.mjs` is fine as-is — that test genuinely does not cover the lockfile.)
- The `Metadata-only staging (just package.json / index.ts / …)` illustration at `:202` also omits the lockfile, but that list is illustrative of a smell ("metadata-only staging is suspicious") rather than normative, so its meaning survives. Not a finding.

## Architecture
No `specs/e60-lockfile-version-parity.md` and no architecture spec exist — this is a backlog-row-as-spec mini-chain (`scope_decision_why` records it; the T-E60-01 row in `tasks.md` is the per-file contract). Judged against that contract:
- Item 1 (assert both fields, fail loud naming observed values, mention `npm install --package-lock-only`, tolerant skip when absent, mirroring the `dist/index.js` existsSync branch at `:42-66`) — satisfied, and the layering choice is right: the assertion lives in the one script both `prebuild` and SOP step 7 already run, so no new enforcement point was invented.
- Item 2 (lockfile refresh, both fields, no dependency-tree churn) — satisfied; the diff is the two version lines and nothing else.
- Item 3 (step-4 bullet ordered before step 7; `package-lock.json` on step 8's git-add line; E71a count 30/19+11 -> 31/19+12) — satisfied on all three, plus the PATHS pre-filter, which the row did not name but which item 3's intent requires (the plain listing and the pre-filter must stay set-equal or the pre-filter silently drops the path). F1 is the one place where the SOP edit is incomplete against its own file rather than against the row.
- Item 4 (no test authoring) — honored; no test file is touched by this diff.

## Security
No findings. The new code adds one `readFileSync` + `JSON.parse` of a repo-local, version-controlled file; no shell, no `execSync`, no network, no user-controlled path (`lockPath` is derived from the script's own location at `:77`). Lockfile-derived values reach only `console.error` as interpolated strings — no shell, no eval, no file write. The `npm install --package-lock-only` command the SOP adds is a documented instruction to a human/agent operator, not executable code in this diff. Malformed or hostile lockfile content cannot produce a pass: every non-conforming shape I probed exits non-zero.

## Performance
No findings. One extra synchronous read + parse of a ~104 KB file, once per `check:version` invocation (`prebuild`, `pretest` -> `build`, SOP steps 5/7). Same complexity class as the existing `package.json` / `index.ts` / `dist/index.js` / `CHANGELOG.md` reads in the same script; no loops, no repeated I/O, no regression versus base. The lockfile refresh itself moves 2 lines, so no diff-size or clone-cost regression.

## Verdict
CHANGES_REQUESTED — the guard, the ordering, the pre-filter and the counts are all correct and were verified by execution, but step 4 now mandates a `package-lock.json` write that the file's own `## Artifact` allowlist does not permit (F1), and the conservative reading of that contradiction deadlocks the release at step 7's new check; F2/F3 are non-blocking and cheap to fold into the same round.

## sr-engineer reply (Round 1)

All three findings addressed, same two in-cut files, no scope expansion:

- **F1 (BLOCKING) — fixed.** `content/skill-release-engineer.md:29` (new line, adjacent to the `package.json` entry at `:28`) now reads:
  `` - `package-lock.json` (the root `version` and `packages[""].version` fields only — refreshed via `npm install --package-lock-only` per SOP step 4, never hand-edited) ``
  Modeled on the `dist/**` entry's shape exactly as the review suggested (name the sanctioned generating command, not a free-hand edit). No other Artifact-list entry, MUST-NOT sentence, or `gates/` staging-vs-authoring paragraph touched.
- **F2 (non-blocking) — fixed.** `scripts/check-version.mjs`: hoisted `lock === null || typeof lock !== "object"` into its own guard immediately after the parse `try/catch` (new lines, before the existing `:89`-area field reads), so a lockfile whose entire content is `null` (or any non-object JSON: array, string, number, boolean) now hits the guarded shape-branch message and exits 1, instead of throwing an unguarded `TypeError` on `lock.version`. Verified against a fixture repo (script + package.json/index.ts/dist copied to an isolated root, since `check-version.mjs` derives `root` from its own file location, not `cwd`): re-ran all 18 of the review's probed shapes plus the `null` literal — every shape's exit code and branch (parse / shape / mismatch / OK) is unchanged from the review's table, and `null` now reports `observed root=null, packages[""]=undefined` via the shape message instead of crashing. One cosmetic side-effect: the "JSON string literal" shape (e.g. `"3.104.3"`) now also lands in the new early guard (`typeof "string" !== "object"`) and its error message shows `root="3.104.3"` (the raw string) rather than `root=undefined` — exit code and branch class (shape failure, exit 1) are unchanged, only the interpolated value differs. `grep -rl package-lock test/*.test.mjs` is empty — no test pins either message, so this is not a qa-facing change.
- **F3 (non-blocking) — fixed.** `content/skill-release-engineer.md:17`, the `check-version gate` Hard rule, now enumerates the fifth surface: `` package.json / index.ts Server() literal / dist/index.js / CHANGELOG.md / package-lock.json (root version and packages[""].version) ``.

**Scope confirmation**: no other line in either file changed. Step 8's git-add line, the `bash -c` PATHS pre-filter, and the E71a 31 = 19+12 count are untouched by this round — F1/F2/F3 do not touch that surface.

**Expected-red manifest**: unchanged, and correctly so. `qa_reports/expected-red_e60-lockfile-version-parity.txt` still names exactly `test/release-staging.test.mjs | E71(a): the git-add line stages exactly 30 paths (19 directories + 11 metadata)...` as the sole intentional red. Re-ran the full suite after this round's fixes: **1758/1759, one failure**, `not ok 1217` (test 68 of `test/release-staging.test.mjs`, the same E71a set-equality assertion) — identical to the manifest's claim and to round 1's baseline. No new red, no red resolved, no qa-pin update needed.

**Acceptance set re-run**:
- `node scripts/check-version.mjs` → `check:version — OK (3.104.3)` (dist and lockfile parity both OK).
- `npm run build` → green (prebuild check:version OK, tsc clean, postbuild check:transitions-sync OK).
- `agc check` → `agc check — OK (3.104.3) — all adapters current`, exit 0.
- `npm test` → 1758 pass / 1 fail / 1759 total, sole failure is the accepted E71a expected-red.

Ready for Round 2 review.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- Round 2 touches two files and, per my own reconstruction, exactly three sites: `content/skill-release-engineer.md:29` (F1, new `## Artifact` entry), `:17` (F3, fifth incoherence surface in the check-version Hard rule), `scripts/check-version.mjs:89-96` (F2, `lock === null || typeof lock !== "object"` guard).
- **F2 verified by execution, not by reading.** I rebuilt the round-1 script as current-minus-the-guard and re-probed 22 lockfile shapes against both. Every shape's exit code is identical; the only exit-0 shapes are still "both fields match" and "lockfile absent". Branch is identical everywhere except the `null` literal (CRASH → guarded SHAPE — the fix). No shape lost a more specific message, and nothing that previously took PARSE or MISMATCH was swallowed by the new guard.
- **F1 verified as a contract against the command's real behaviour**, by running `npm install --package-lock-only` in isolated copies of this repo's `package.json`/`package-lock.json`. The two-field diff is a property of the command given an in-sync lockfileVersion-3 lockfile, not a coincidence of the 3.97.1 → 3.104.3 bump. Where it is not (a lockfileVersion-2 lockfile), step 4's own "confirm the diff touches only those two version fields" already routes the churn to a halt-and-look, so the allowlist is exactly as wide as the sanctioned outcome — and correctly no wider.
- **F3 does not contradict the tolerant skip**: the rule is conditional ("If it fails, the bump is incoherent across …"), an enumeration of *possible* incoherence surfaces. `dist/index.js` was already a member of that list and already carries a tolerant-skip branch, so the enumeration has never asserted unconditional coverage.
- Round-1 clearances re-confirmed where a round-2 edit could have reached them: the E71a 31 = 19 + 12 count still holds by real token count, no new stale count was introduced, and the six prose-coupled test files are 192/193 with the accepted expected-red as the sole red. Verdict: APPROVED.

## Correctness

**F2 — fixed, and the blast radius is bounded. Probed, not assumed (`scripts/check-version.mjs:89-96`).**
Reconstruction fidelity first: I produced the round-1 script by deleting exactly lines 89-96 from the current file (`diff` confirms the deletion is the guard and nothing else), and the reconstruction is corroborated independently — every line number my round-1 report cited lands on the right construct in it (block `77-113`, parse `try/catch` `80-87`, the throwing `lock.version` at `:89`, the shape predicate's `observed root=undefined` at `:92`, the strict `!==` at `:100`). So the guard insertion is the only round-2 change to this file.

Both scripts run in a fixture root (synthetic `package.json` 3.104.3, `index.ts`, `dist/index.js`, `CHANGELOG.md`), lockfile content varied:

| shape | round 1 | round 2 |
|---|---|---|
| both fields match | 0, OK | 0, OK |
| root stale / `packages[""]` stale / both stale | 1, MISMATCH | 1, MISMATCH |
| invalid JSON / empty file / whitespace-only | 1, PARSE | 1, PARSE |
| no root `version` | 1, SHAPE `root=undefined` | 1, SHAPE `root=undefined` |
| `packages` absent / `packages[""]` absent | 1, SHAPE | 1, SHAPE |
| `packages` null / `packages[""]` null / `packages[""].version` null | 1, MISMATCH | 1, MISMATCH |
| `{}` | 1, SHAPE | 1, SHAPE |
| `[]` / `[1,2]` | 1, SHAPE | 1, SHAPE (unchanged — `typeof [] === "object"`, arrays do NOT enter the new guard) |
| numeric `2.5` / empty-string versions | 1, MISMATCH | 1, MISMATCH |
| **JSON `null` literal** | **1, CRASH (unguarded TypeError)** | **1, SHAPE `root=null`** |
| JSON string literal `"3.104.3"` | 1, SHAPE `root=undefined` | 1, SHAPE `root=3.104.3` |
| JSON `42` / `true` | 1, SHAPE `root=undefined` | 1, SHAPE `root=42` / `root=true` |
| lockfile absent | 0, skip note | 0, skip note |

Three conclusions, each the thing that could have gone wrong:
- **No exit-code change on any shape**, and no new exit-0 path — the E60 defect class stays closed.
- **No branch class changed except the intended one.** The guard's catchment is exactly `null` plus the JSON primitives, and every one of those already took the generic SHAPE branch before (or crashed). Nothing that previously earned a *more specific* message — PARSE, MISMATCH — now lands in the guard. The array cases are the ones that would have shown a regression here, and they demonstrably do not enter it.
- **The guard's hardcoded `packages[""]=undefined` is accurate for every shape that can reach it**: `null` and the primitives have no `packages` property, so the interpolation cannot lie.

sr's characterization is correct but under-inclusive: the `root=<raw value>` change applies to JSON numbers and booleans as well as strings, not the string literal alone. Same class, no behavioural consequence.

Nit (non-blocking, not worth a round): for a string-literal lockfile the message now reads "is missing root \"version\" … (observed root=3.104.3)", which can momentarily read as if the version *was* found. The following sentence ("not in the expected shape — regenerate it with `npm install --package-lock-only`") still points at the right remedy, and this shape is a corrupt-file case, not a release path.

**F1 — fixed, and the field scope is the right width. Measured against the command (`content/skill-release-engineer.md:29` vs `:55`).**
The entry is placed adjacent to the `package.json` entry and follows the `dist/**` shape exactly (generating command named, hand-editing forbidden). The substantive question is whether "the root `version` and `packages[""].version` fields only" authorizes everything step 4 mandates. I tested the command rather than trusting round 1's 2-line diff:
- Isolated copy, same version, `npm install --package-lock-only --offline` → output **byte-identical** to input.
- Isolated copy, synthetic bump 3.104.3 → 3.105.0 → **4 changed lines, exactly the two version fields**, npm reporting "up to date". So the two-field diff follows from the resolved tree already being satisfied, not from which version was being set — round 1's observation generalizes.
- Negative control: same synthetic bump against a lockfileVersion-**2** lockfile under npm 10.9.8 → **1746 changed lines** (the legacy `dependencies` mirror regenerated). So the two-field property is conditional on an in-sync lockfileVersion-3 lockfile — true of this repo, not true of the command unconditionally.

That third case does not make F1 half-fixed, for two reasons. Step 4 already carries the narrowing instruction in the same breath as the mandate ("confirm the diff touches only those two version fields — a churned … is a signal something else drifted and needs its own look, not a routine release artifact"), so the mandated action's *sanctioned* output is precisely the two fields the allowlist names. And the narrowness is load-bearing: an entry written wide enough to cover a whole-lockfile regeneration would have pre-blessed a 1746-line rewrite as a routine release artifact, which is the opposite of what this cut is for. The allowlist and the mandate are now congruent, and the residual case fails in the safe direction (out-of-allowlist write → operator halts).

Nit (non-blocking): step 4 names only the *dependency-tree* symptom, while the churn I could actually reproduce is a lockfile-format regeneration. The primary clause ("only those two version fields") catches it regardless, so the meaning survives; only the illustrative symptom is narrower than the real failure set.

**Expected-red manifest — re-sampled, still stands (SOP step 4a).** One structured entry, so all of it sampled: `test/release-staging.test.mjs | E71(a): the git-add line stages exactly 30 paths (19 directories + 11 metadata), set-equal to FEATURE_DIRS/METADATA_PATHS/E65_METADATA_PATHS` resolves to a real test at `test/release-staging.test.mjs:2150`, title byte-matching. Its four-edit qa fix list is still sufficient after round 2: test 68's assertions read `FEATURE_DIRS`(19) + `METADATA_PATHS`(6) + `E65_METADATA_PATHS`(5), the staged-token count, the set-equality, `/30 paths/` and `/19 directories \+ 11 metadata paths/` — none of which the two round-2 prose lines touch (neither adds an "N paths" phrase). Unchanged, and correctly so.

## Quality
- No new stale count introduced by F1 — checked, because this cut exists partly to avoid that class (E70). The file carries no count of `## Artifact` entries anywhere (the only "N paths" prose is E71a's, about the git-add line), so growing the allowlist from 12 to 13 entries falsifies nothing. `grep -rl "allowed to write" test/` is still empty and `test/skill-evolution-v3.11.test.mjs:110` still only asserts the `## Artifact` heading exists.
- The `MUST NOT touch source` paragraph needed no edit: it scopes source directories, and `package-lock.json` is neither under them nor in tension with the new entry.
- F3's parenthetical names the two fields exactly as the script checks them, so a release-engineer diagnosing a red run from `:17` now gets an enumeration that can explain what they are reading. That was the whole of the finding.
- Round-1 clearance re-confirmed by re-counting rather than by trusting that step 8 was untouched: the git-add line and the `PATHS` variable are 31 tokens each, token-for-token identical including order, `package-lock.json` present in both; 20 trailing-slash tokens of which `dist/` is metadata under the test's own partition, i.e. 19 + 12, matching the prose. The four stale comment/label sites flagged in round 1 remain open and remain qa's (out of scope this round).

## Architecture
Unchanged from round 1 and still satisfied. The three round-2 edits add no new enforcement point, no new file, and no new layer: F2 is a shape guard inside the block it belongs to, F1/F3 are governance prose in the role SOP that already owned the mandate. Backlog-row-as-spec items 1-4 all remain satisfied, and item 4 (no test authoring) is still honored — no test file is touched by this diff.

## Security
No findings. F2 strictly *reduces* the failure surface: the one input shape that previously escaped the block's own error handling (an unguarded TypeError on attacker- or corruption-supplied `null`) now exits through the guarded path. Lockfile-derived values still reach only `console.error` as interpolated strings — the guard's new `${lock}` interpolation of a primitive is a string coercion into a log line, no shell, no eval, no file write. F1/F3 are prose. No malformed or hostile lockfile shape produces a pass.

## Performance
No findings. F2 adds one `=== null` test and one `typeof` per invocation, both O(1), on a path that runs once per `check:version`. F1/F3 add ~260 characters of SOP prose; `test/context-budget.test.mjs` passes, so the composed release-engineer bundle is still within budget.

## Verdict
APPROVED — all three round-1 findings are fixed at the cited sites and verified by execution rather than inspection: F2 changes no shape's exit code and no shape's branch except the `null` crash it was written to close, F1's field scope matches what `npm install --package-lock-only` actually rewrites in this repo and is correctly no wider, and F3's fifth enumeration member is consistent with the script's tolerant skip by the same precedent `dist/index.js` already set.
