# Review — T-E174A-01 (review task T-E174A-02)

covers: T-E174A-01, T-E174A-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviewed the uncommitted working-tree diff in lane `e174a`: `content/skill-release-engineer.md` (hand-edit bans :20-21, Artifact list :41-42, step 11b, step 13a prose and script) and `scripts/verify-release.mjs` (header :6-7, allowlist comment, and `BOOKKEEPING_PATH_RES` :243-259). `tasks.md` is coordinator bookkeeping and was not reviewed.
- Spec is the E174a row in `docs/backlog.md:297`, plus the human-approved cut decisions (i) and (ii) from the dispatch brief.
- I ran the 13a script exactly as written (lines extracted from the SOP) under `zsh -c` in throwaway repos. I also checked the regex against the real `isSafeLaneName` / `NON_LANE_DIRS` from `dist/tools/lane-paths.js` over 17 lane names × 4 sidecar names and found 0 mismatches.
- Verdict: APPROVED. The one `recommended` finding is left for qa to act on. It does not block approval.
- Independence: builder is fable, reviewer is opus, so there is no same-model bias. Disclosure: the mandatory `tw_get_state` returned sr's `pending_notes`. I did not use them as evidence, and every claim below was verified independently.

## AC Completeness
AC Completeness: SKIP — no specs/e174a-release-lane-paths.md (backlog-row-as-spec mini-chain)

Checked informally against the backlog row's scope list and cut decisions:
- Defect (1), step 13a retargeted — implemented — `content/skill-release-engineer.md:250-259`
- Artifact list :41-42 — implemented — `:41-42` (includes a gloss on `resolveCurrentLane`)
- Step 11b metrics.jsonl — implemented — `:242`
- Hand-edit bans :20-21 — implemented — `:20-21`
- `.current/.config.json` left top-level — confirmed. The remaining flat `.current/` mentions (`:36, :198, :204, :209, :215, :216, :285`) are all `.config.json`, the `':!.current'` pathspec exclusion, or the generic `.current/**` tree. None of them is a flat handoff/sidecar path.
- Defect (2), `BOOKKEEPING_PATH_RES` — implemented — `scripts/verify-release.mjs:253-259`. Header comment at `:6-7` is updated.
- Cut (i): lane comes from importing `resolveCurrentLane(process.cwd())`, `_primary` is never hardcoded, STOP fires if `.current/$LANE` is missing, and the non-empty assertion is kept — implemented — `:251-257`
- Cut (ii): any single-segment lane dir that mirrors SAFE_LANE_RE, excluding archive/history; flat forms and tasks.md still accepted; no dist import — implemented — `:252-259`

## Correctness
13a script, run verbatim from the SOP under `zsh -c`:
- Quoting works. The outer `'...'` contains no single quotes. Inside it, `\"` is literal to the outer shell, and bash then unescapes it inside the `-e "..."` double-quoted string, so node receives `import {resolveCurrentLane} from "./dist/tools/lane-paths.js"; ...`. In this lane worktree (linked, `.git` is a file) the resolver prints `e174a`.
- Test case `main` with `.current/_primary/{handoff.md,metrics.jsonl,dispatch.jsonl,handoff.md.lock,sub/y.jsonl}`: exit 0. It staged exactly `handoff.md`, `metrics.jsonl` and `dispatch.jsonl`. The lock file and the nested jsonl were not staged, so 13a does not mis-stage non-bookkeeping files.
- Test case `feat/e999-x` with no lane dir: `lane dir .current/e999 missing — STOP`, exit 1.
- Test case: empty lane dir, or lane dir holding jsonl but no `handoff.md`: git reports a pathspec fatal and stages nothing, then the non-empty assertion STOPs with exit 1. This fails safe (STOP), and the closing write always creates `handoff.md`, so it is acceptable.
- If `dist/` is missing or the import throws, `$LANE` is empty and the first guard STOPs. This is the correct direction.

Regex, `scripts/verify-release.mjs:252-259`:
- `LANE_SEGMENT_RE_SRC` compiles to `(?!(?:archive|history)\/)[A-Za-z0-9_][A-Za-z0-9_-]*`. I compared it with `isSafeLaneName(l) && !NON_LANE_DIRS.has(l)` on `_primary, e174a, archive, history, archived, historyx, Archive, -x, .x, a.b, "a b", "", a/b, _, 9, e1-2, "x\n"` × `{handoff.md, telemetry.jsonl, dispatch.jsonl, usage.jsonl}`, and got 0 mismatches. The trailing `\/` in the lookahead correctly keeps `archived` / `historyx` as valid lanes. Case sensitivity matches the Set (`Archive` is accepted by both).
- A 13a commit touching `dispatch.jsonl` / `usage.jsonl` is accepted, which is correct. The following are rejected, also correctly: `.current/_primary/handoff.md.lock`, nested `.current/_primary/x/y.jsonl`, `.current/archive/f/handoff.md`, `.current/.config.json`, `.current/_primary/feature-split.md`.
- No `.current/<lane>/*.jsonl` is gitignored (`git check-ignore` returned nothing), so explicit `git add` of the sidecars cannot hit a "paths are ignored" error.

- `optional` O1 — `.current/<lane>/.jsonl` (a file named only `.jsonl`) would be staged by `find` but rejected by `[^/]+\.jsonl`. This matches the flat regex's existing behaviour, and no writer produces that name. Negligible.
- `optional` O2 — BSD `find` does not descend a symlinked start directory under the default `-P` behaviour. If `.current/$LANE` were a symlink, the jsonl files would be under-staged, though not to an empty stage. This is the same class that VR-9c already documents for flat `.current/`, so it is not new.

Step 4a (expected-red sampling): not armed. The diff touches no test files. The 4 red tests in `test/{feature-lease,release-staging,verify-release}.test.mjs` (S8, E9A-S1, C13-AC5, VR-9c) are all explained by the diff: I grepped them, and each pins the old flat-text literal (e.g. VR-9c `/JSONL=\$\(find \.current -maxdepth 1 .../`, C13-AC5 `NEVER hand-edit \.current\/handoff\.md ...`). They are stale pins that qa owns under §2, not intentionally-red repro tests. `dispatch_mode` is not `bugfix`. So a missing `qa_reports/expected-red_e174a-release-lane-paths.txt` is not a finding.

## Quality
- `recommended` R1 — `scripts/verify-release.mjs:249-250`: the comment says "a drift-guard test pins the mirror", but no such test exists in the tree yet. It is qa-owned follow-up work. qa MUST add a test asserting that `LANE_SEGMENT_RE_SRC` stays equivalent to `SAFE_LANE_RE` + `NON_LANE_DIRS` (for example the table-driven comparison above, run against `dist/tools/lane-paths.js`). Otherwise the comment is false and the mirror can drift silently. Not blocking, because test authorship belongs to qa.
- `optional` O3 — `content/skill-release-engineer.md:248`: the 13a prose lists the jsonl sidecars as "(`metrics.jsonl`, `telemetry.jsonl`)". Post-E99, `dispatch.jsonl` (and `usage.jsonl` where the hook is registered) is staged too. Wording it as "e.g." would stop the list reading as exhaustive.
- Naming (`LANE_SEGMENT_RE_SRC`) and comment style match the surrounding file. No dead code.

## Architecture
There is no architecture spec. The changes respect the layering:
- `scripts/verify-release.mjs` stays standalone (no `dist/` import), as cut (ii) requires.
- The SOP relies on the compiled resolver as the single owner of `TICKET_ID_RE` instead of re-parsing branch names in shell, as cut (i) requires.
- `dist/` is committed at step 8, so the import is available at step 13a.

## Security
No findings. The inline `node -e` payload is a fixed string with no interpolated input. `$LANE` is resolver output restricted to `[a-z0-9]`-class ids or `_primary`, and it is double-quoted at every use. `$JSONL` is deliberately left unquoted for word-splitting, which is pre-existing N9 behaviour, and filenames come from `find` inside a governed dir. No secrets.

## Performance
No findings. One extra node process per release close-out, and two extra regexes in a per-path `.some()` over a handful of paths.

## Verdict
APPROVED — both E174a release-path defects are fixed, following cut decisions (i) and (ii), and the 13a script and regex were verified empirically. The one `recommended` item (R1: the drift-guard test the comment promises) is qa's to deliver.
