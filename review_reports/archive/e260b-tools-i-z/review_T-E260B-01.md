# Review — T-E260B-01

covers: T-E260B-01, T-E260B-02, T-E260B-03, T-E260B-04, T-E260B-05, T-E260B-06, T-E260B-07, T-E260B-08, T-E260B-09

## Round 1 — APPROVED — by code-reviewer

Diff: `git diff b37178a..HEAD` (HEAD = 82cf48a, branch `feat/e260b-tools-i-z`). Contract: `specs/e260b-tools-comments.md` (AC1-AC14, Trim rule, Proof scripts). No architecture spec for this feature. Reviewer model: opus; sr-engineer pinned fable, so the two hops ran on different models.

## Summary
- Comment-only trim of 21 `tools/{i..z}*.ts` files plus the rebuilt `dist/tools/{i..z}*`. Moved rationale goes to the new `specs/e260b-rationale.md` (18 per-file sections). Two proof scripts are added under `.current/e260b/`.
- The mechanical proofs pass when I re-run them, and I confirmed each one can fail (negative tests below). `npm run build` leaves the tree clean, so the committed dist matches the source.
- AC2/AC3: 0 blocks over 20 lines and 0 blocks of 8-20 lines remain. That is down from 23 and 60 at base; I re-scanned the base tree myself.
- The trimmed comments I read still describe the code. I found one comment that over-generalizes (recommended) and a few optional nits. None of them block.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — `node .current/e260b/check-invariance.mjs` → `invariance OK: 21 files`, exit 0 (re-run by reviewer).
AC2 — implemented — `node .current/e260b/measure-comments.mjs` → `over20: 0`, exit 0.
AC3 — implemented — `mid: 0`, `mid-unjustified: 0`. Zero 8-20 line blocks remain at HEAD, so there are no kept-block lines to copy. The "Kept 8-20 line blocks" table in `specs/e260b-rationale.md` is intentionally header-only and agrees with the scan. Kept 8-20 line blocks copied from the table: **none (0 kept blocks)**.
AC4 — implemented — `grep -c '^ *// Watch mode (E178b' tools/lane-status.ts` → `1` (tools/lane-status.ts:1201).
AC5 — implemented — AC5a grep → empty; AC5b → `0`. Per-file counts of `/**` openers and `/*` openers are identical at base and HEAD in all 21 files, so no comment changed style in either direction.
AC6 — implemented — the marker loop prints nothing.
AC7 — implemented — `git diff -U0 b37178a -- tools | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*(//|/\*|\*)'` → empty. **Code lines whose only change is the trailing comment: none.** No blank lines were added or removed either (`^[+-]\s*$` count 0). This grep also covers the one blind spot of AC1: `transpileModule` erases types, so it cannot see a type-only edit.
AC8 — implemented — all 71 hits of the AC8 grep have words besides the id, and every id is a trailing parenthetical. Judgment calls are under Quality.
AC9 — implemented — `grep -c '^## tools/' specs/e260b-rationale.md` → 18. A base re-scan finds 11 files with a block over 20 lines, and all 11 have a section. Every in-code `Why:` pointer resolves to an existing section. Spot-checks are listed below.
AC10 — implemented — the hygiene grep over the diff of `tools`, both e260b specs and `.current/e260b` → empty. A direct grep of `.current/e260b/*.mjs` and `specs/e260b-*.md` → empty.
AC11 — implemented — `npm run build` exits 0. Afterwards `git status --porcelain` shows only the two tw_*-written `.current/e260b/` files (dispatch.jsonl, handoff.md), which are in the allowed set. The name-only scope filter → empty.
AC12 — implemented — postbuild prints `check:transitions-sync — OK (21 keys, exact match ...)`.
AC13 — n/a at review — qa runs the full suite on the final committed HEAD. As a reviewer smoke test I ran the 7 comment-text-pinned test files (e177b, e235b, e178b, lane-paths, lane-migrate, e115, writestate-options-object): 174/174 pass.
AC14 — implemented — the pins are checked inside check-invariance.mjs (exit 0). I proved each pin can fire (see below).

### Proof scripts can fail (reviewer negative tests, in a throwaway detached worktree, since removed)
| probe | result |
|---|---|
| `--self-test` | `self-test OK`, exit 0 |
| unresolvable base arg | `cannot resolve base ...`, exit 2 |
| base = HEAD (zero changed files) | `vacuous pass refused`, exit 2 |
| base read from `.current/e260b/base-sha` (set to HEAD) | resolved from the file → exit 2 (base-sha is git-excluded and holds the full b37178a sha in the lane) |
| code edit in tools/registry.ts / appended statement in tools/role.ts | `DIFF <file>`, exit 1 |
| string-literal edit in tools/sync.ts | `DIFF tools/sync.ts`, exit 1 |
| `resolveCurrentLane` added in a comment in tools/role.ts | `PIN tools/role.ts resolveCurrentLane`, exit 1 |
| watch prefix reworded | `PIN tools/lane-status.ts // Watch mode (E178b`, exit 1 |
| second `HOOK POINT FOR E126` | `PIN tools/join-precondition.ts ...`, exit 1 |
| edit to tools/config.ts (a-h) | `SCOPE tools/config.ts`, exit 1 |
| measure on base `tools/[i-z]*` | `over20: 23 / mid: 60 / mid-unjustified: 60`, exit 1 |
| measure with one new 10-line JSDoc | `mid-unjustified: 1`, exit 1 |
| measure with a 24th tracked i-z file | `expected 23 files`, exit 2 |
| measure without dist/tools/comment-scan.js | exit 2 |

### AC9 rationale spot-checks (pointer → section content)
1. tools/registry.ts:212 `dispatch_mode`: "never gates a transition edge itself" is preserved verbatim in the registry section ("Handoff arg field notes"). The remaining in-code text is accurate: "bugfix" arms REPRO_MANIFEST_MISSING on the sr-engineer -> code-reviewer edge.
2. tools/registry.ts `TRAILING_TAG_FRAGMENT_RE`: the full two-halves regex explanation and the known-gaps list are preserved, plus a new pointer to the source spec.
3. tools/lane-migrate.ts header and `migrateFlatToLaneLocked`: Two functions per runner, destination lane, lock, candidate files, move-not-copy, refuse-never-clobber, sidecar merge, never-merged and the flat->lane resume cases (`alreadyMigrated`, `allowMissingRequired`) are all preserved.
4. tools/tasks-lane-migrate.ts header: lock order (tasks lock OUTER, legacy INNER), TasksLedgerAbsentError and the reverse-runner preconditions are preserved under "Locks" / "Index, never a source" / "Reverse".
5. tools/lane-ticket-allocation.ts `allocateTicketIds`: the AC5 collision-freedom argument, the AC9 no-disposition note and the RangeError reason are preserved.
6. tools/transitions.ts `computeNewRound`: the full per-counter table is preserved, and the code keeps an accurate one-paragraph summary.
7. tools/lane-paths.ts `enumerateLaneSidecarSources`: the dedup rules are preserved exactly in the rationale. See finding R1 for the in-code summary.

### AC14 token-restoration comments (reviewer judgment: accurate, not filler, except O1)
- tools/lane-status.ts:20-21, the new 2-line `//` above the lane-paths import. This is real rationale moved from the base header: the resolver functions have pinned caller allow-lists in test/lane-paths.test.mjs, so this file imports only the helpers. It is accurate and useful where it sits. It does not break the `//`-line filters in e177b/e235b (174/174 pass).
- tools/lane-migrate.ts. MOVABLE_LANE_FILES ("The tools/lane-paths.ts LANE_FILES entries") and TASKS_FILENAME ("tools/lane-paths.ts owns it") are accurate. hasFlatLaneFiles ("before calling migrateFlatToLaneLocked on resolveCurrentLane's lane") is accurate: tools/handoff-parse.ts:170-186 and tools/handoff-write.ts:271-286 both do exactly that.
- tools/lane-paths.ts. LANE_PATH_FIELD "(resolveLanePaths' shape)", HEAD_REF_RE "the only one resolveCurrentLane maps to a lane", headFilePath "resolveCurrentLane's HEAD locator" and the resolveLaneName doc are all accurate and informative. The `(this file's section)` pointer wording is explained in the rationale preamble. Header line 6 is the exception: see O1.

## Correctness
- **R1 (recommended)** — tools/lane-paths.ts:381-383. The trimmed `enumerateLaneSidecarSources` doc says "a copy that is a byte prefix of a counted copy is a half-finished move or merge and is skipped". The code is narrower in two ways. Empty files are never skipped (tools/lane-paths.ts:413 and :425 guard `bytes.length > 0`), even though an empty file is a byte prefix of everything. A history copy is compared only against the live copy of the same lane (`liveByLane.get(lane)`), not against any counted copy. The exact rules survive in the rationale section, and the empty-file case contributes zero records either way, so nothing a caller computes is wrong. Still, the summary now overstates what the code does. Suggested wording: "a non-empty copy that is a byte prefix of its own lane's live copy (history) or of any lane copy (flat) is ... skipped".
- No other correctness findings. AC1 + AC7 together prove the emitted JS and every non-comment line are unchanged.

## Quality
- **AC8 judgment.** Every AC8 grep hit is prose followed by a trailing id. Three groups needed a closer look:
  - Untouched base lines with a leading label followed by a full sentence: `// R-2:` / `// Q-1:` (tools/merge-invariants.ts:158, :485), `// D-D:` / `// O-1:` (tools/tasks-lane-migrate.ts:18, :33), `// R-3:` / `// R-2:` (tools/tasks-lane-migrate.ts:117, :120). None of them relies on the label to explain anything. Each sentence states the behaviour and the reason, so none is a Generic citation under AC8. Leaving these untouched lines alone is acceptable.
  - Bare `ACn` references to other features' specs (`AC15 is about filenames` in lane-paths.ts, `pinned by test, AC14` in lane-status.ts, `(AC3)/(AC5)/(AC8)` in lane-ticket-allocation.ts, `spec AC1` in tasks-lane-migrate.ts). Each one follows words that already explain the code, and the per-file rationale sections name the source specs. Acceptable.
  - `Feat-lane forward (D-C)` in tasks-lane-migrate.ts. The sr moved the label from leading to trailing, which is the AC8 shape.
- **O1 (optional)** — tools/lane-paths.ts:6, "three read-only fs helpers (resolveCurrentLane too)". The parenthetical exists to keep the `resolveCurrentLane` count and reads like padding. A count-neutral wording that also informs: "except three read-only fs helpers: resolveCurrentLane, enumerateLaneSidecarSources, hasHistoryLedger". The last two names are not AC14 tokens.
- **O2 (optional)** — `specs/e260b-rationale.md` has sections for tools/storage-sqlite.ts, tools/role.ts and tools/telemetry.ts, but those files carry no `Why:` pointer. The trim rule allows zero pointers, but a reader of those files cannot find the moved text.
- **O3 (optional, pre-existing, not introduced by this lane)** — three comments were already stale at base and the trim either carried them or did not touch them:
  - tools/merge-invariants.ts:159 cites `tasks-file.ts:216/703`. Those lines were already wrong at base, and the tasks-file trim shifts them further. Better to cite `parseTasks` / the void scans by name.
  - tools/telemetry.ts:6 says usage lives in `.current/usage.jsonl`. It is lane-scoped `.current/<lane>/usage.jsonl` (tools/usage-accounting.ts header).
  - tools/lane-migrate.ts:332 says the wrapper serves callers like readHandoffState, but readHandoffState calls `migrateFlatToLaneLocked` directly (tools/handoff-parse.ts:186).

## Architecture
No architecture spec. Layering is unchanged: the diff touches comments only (AC1/AC7). Rationale moved to a tracked spec with one-line pointers, as the Trim rule requires.

## Security
No findings. The emitted JS and all non-comment lines are unchanged. The embedding-model allowlist comment keeps its security reason (the CVE and the provenance spot-check procedure), and the full detail is in the rationale. No secrets, local paths or internal links appear (AC10).

## Performance
No findings. The trim changes no runtime code, so it cannot regress performance. The proof scripts are dev-only and linear in the number of tools files.

## Verdict
APPROVED. The mechanical proofs pass and I showed each one can fail. Every AC with a reviewer-checkable proof is met, and AC13 is qa's. The remaining findings are one recommended wording fix (R1) and optional nits, none of which affects behaviour or loses rationale.
