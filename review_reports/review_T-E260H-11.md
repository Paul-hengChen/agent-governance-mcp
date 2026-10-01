# Review — T-E260H-11..25 (lane e260h, comment-only trim of test m–z + eval)

covers: T-E260H-11, T-E260H-12, T-E260H-13, T-E260H-14, T-E260H-15, T-E260H-16, T-E260H-17, T-E260H-18, T-E260H-19, T-E260H-20, T-E260H-21, T-E260H-22, T-E260H-23, T-E260H-24, T-E260H-25

Range reviewed: bdbffaf..f563701 (suite evidence at 315f092; later commits touch only .current/e260h and the author evidence file, verified by `git diff --name-only 315f092..HEAD`).

## Summary
- 38 owned test/eval files changed, comments only; plus the proof script, the rationale spec and lane bookkeeping. No path outside AC3 scope.
- I re-ran `node .current/e260h/proof.mjs --base bdbffaf --list-mid`: scope ok, emit 38/0 differ, leaves 38/0 differ, >20: 0, 8-20: 0, bare-id 0, directives/form/hygiene ok, exit 0.
- I mutation-tested the proof (below); it is not vacuous and does compare against base blobs.
- Readability sampling: well over 10 trimmed blocks per task read; comments state what the test protects accurately.
- Verdict: APPROVED, with two optional notes.

## AC Completeness
AC1 — implemented — proof `emit: 38 files, 0 differ` (re-run by me)
AC2 — implemented — proof `leaves: 38 files, 0 differ`
AC3 — implemented — `scope: ok`; render-structure, fixtures, source dirs, dist, content untouched
AC4 — implemented — `>20: 0`
AC5 — implemented — `8-20: 0 block(s)` at HEAD (I re-ran --list-mid; empty), so the empty Retained blocks table is true and nothing needs a keep-reason
AC6 — implemented — every pointer names `specs/e260h-comment-rationale.md` (tracked, added in this lane) with a `(test/<file>)` suffix; 20 distinct pointer targets, all 20 have a matching `## test/...` section. `test/qa-flow.test.mjs` has a section but no rationale pointer: its comments cite already-tracked specs (pm-repair-resume-routing, c9-protocol-fields, c13-release-engineer-write-path), which the spec's own text allows. Every other spec/content path cited in added comment lines exists (only glob placeholders like `content/coord-NN-*.md` do not, and they are meant as patterns). `node scripts/check-md-tables.mjs` exits 0.
AC7 — implemented — `bare-id: 0`; sampled blocks (list below) all open with plain words, ids trail as pointers
AC8 — implemented — `directives: ok`, `form: ok`
AC9 — implemented (by evidence) — emit-identical output means no test can have been added, removed or renamed; author suite run 3043/3040/0/3 at 315f092 matches the base record. I did not re-run the full suite (QA T-E260H-26 owns that).
AC10 — deferred to T-E260H-26 (clean-tree suite run). Tree at HEAD is clean apart from the in-progress handoff writes, which are committed with this report.
AC11 — implemented — `hygiene: ok`; see note (a) below.

## Correctness
No findings. Accuracy spot checks of what a comment claims against the retained code:
- test/qa-flow.test.mjs: `next_resume_of` (the comment's "structured field") matches the base code (`TransitionRequest.next_resume_of`); "1056 tuples" and "76 = 69 baseline + 7 Blocked self-loops" match the retained assertion message at base.
- test/reviewer-completed-tasks-gate.test.mjs: gate ordering claim (after AGENT_ID_REQUIRED, TRANSITION_REJECTED, CUT_APPROVAL_REQUIRED) and the BYPASS-SQL scope note preserve the base meaning.
- test/release-staging, verify-release, stale-dispatch-detection, skill-manifest, source-credibility-gate, pixel-gate-attestation, telemetry, usage-accounting, qa-visual-skill-split, rag-lifecycle, eval/run-eval, eval/scenarios, eval/lib/assertions: each trimmed header and inline block still names the specific property pinned (for example the vacuous whole-document search in release-staging, the PATH-without-gh rationale in verify-release, the dist `+` concatenation reading in source-credibility, the byte-cap headroom rule in qa-visual-skill-split). None claims more or less than the code.

### Proof-script soundness (what the mechanical gate can and cannot do)
- Base comparison is real: `baseText` runs `git show <base>:<file>`; emit and leaves compare base blob vs working file.
- Mutation 1: inserted one character into a string literal of test/token-efficiency.test.mjs -> `emit: 1 differ`, `leaves: 1 differ`, `proof: FAIL`. Reverted.
- Mutation 2: appended a comment containing a git-show phrase, an absolute home path and a URL to test/rag.test.mjs -> `hygiene: 3 problem(s)`, FAIL. Reverted.
- Mutation 3: added a bare `// E12` comment -> `bare-id: 1`, FAIL. Reverted.
- Vacuity: changed set comes from `git diff --name-status`; it printed 38, and a missing base arg exits 2. A zero-file diff would print `0 files` visibly; not a silent pass, though no explicit `changed > 0` assertion exists (optional).
- Note (a): `\bgit show\b` / `\bgit log\b` do not weaken AC11. The word boundaries only exclude "git logic"/"git shown"-style words; every literal `git log` or `git show` still matches. Residual gap: a double space or tab between the words would slip through (optional hardening, `git\s+log`).

## Quality
No required findings.
- optional: test/subagent-templates.test.mjs (trimmed FILE_PATH_DELEGATES comment) still says `teamwork` "references content/skill-coordinator.md". That file was retired (CLAUDE.md: there is no skill-coordinator.md), but the sentence and the regex it describes are carried over from base, and the lane is comment-only, so this is out of scope. Worth a follow-up ticket.
- agc check — comments (SOP 4b): 6 high-ratio warnings touch the diff: eval/lib/assertions.mjs 43.2%, eval/lib/bundle.mjs 37.8%, pixel-perfect-design-coverage 42.5%, pixel-perfect-visual-compare 48.3%, qa-visual-skill-split 44.6%, watermark-check 32.5%. All were above the 30% limit at base (47.4, 43.3, 49.5, 53.9, 57.9, 36.2) and every one went down. Kept: the lane's contract (AC4/AC5) is block length, which is satisfied, and driving ratios under 30% would mean deleting still-useful one-to-seven-line explanations. The warnings are advisory.

## Architecture
No architecture spec. Layering untouched: only test comments, one new tracked rationale spec, lane proof script.

## Security
No findings. New comment text carries no secrets, local paths, URLs or shas (proof hygiene check plus my mutation test of it).

## Performance
No findings. Comment-only; transpiled output is byte-identical to base for all 38 files.

## Verdict
APPROVED — the mechanical proof is sound (mutation-tested), re-runs green, and sampled comments stay accurate and plain while rationale moved to a tracked spec with real pointers.
