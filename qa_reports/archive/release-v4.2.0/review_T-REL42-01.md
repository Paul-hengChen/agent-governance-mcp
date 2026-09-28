# QA review — T-REL42-01, T-REL42-02
<!-- covers: T-REL42-01, T-REL42-02 -->

Feature: `release-v4.2.0` (evidence-only MINOR release gate; no new code
written under this ticket). Reviewed independently against
`specs/release-v4.2.0.md` — PM's inline summary in `scope_decision_why` was
treated as a claim to verify, not a fact to trust.

## Phase 0.5 — Expected-Red Diff
skipped (no expected-red manifest declared — `qa_reports/expected-red_release-v4.2.0.txt` absent)

## Copy Audit Gate
N/A — spec's Copy / Strings table is explicitly `N/A` (evidence-verification only, no user-facing strings introduced).

## Visual Audit Gate
N/A — spec's Visual Tokens / Visual Widgets tables are explicitly `N/A`; no `design/release-v4.2.0.md` exists, `## Mode` not armed.

## Phase 1.5 — Visual Compare
skipped (no Visual Baselines declared — no design file for this feature)

## AC Execution Log

### AC1 — E234 / E250+E251 evidence table (task T-REL42-01)

| lane | task id | qa evidence file | grep -i verdict (last `## Verdict` / auto-appended block) | code-review evidence file | grep -i verdict |
|---|---|---|---|---|---|
| e234 | T-E234-01..05 | `qa_reports/review_T-E234-05.md` | auto-appended block: `## 2026-09-28T13:59:08.852Z — PASS — by qa-engineer` (`PASS T-E234-01..05.`) | `review_reports/review_T-E234-01.md` | Round 3 (line 110): `## Round 3 — APPROVED — by code-reviewer`; final `## Verdict` (line 138): `APPROVED: every required finding from rounds 1 and 2 is resolved and verified at runtime...` |
| e250 | T-E250-01..06 | `qa_reports/review_T-E250-06.md` | `## Verdict` (before line 143): `**PASS.** All 14 ACs pass...`; auto-appended block: `## 2026-09-28T15:19:24.429Z — PASS — by qa-engineer` | `review_reports/review_T-E250-01.md` | Round 1 (line 5): `## Round 1 — APPROVED — by code-reviewer`; final `## Verdict`: `APPROVED. All 14 ACs are implemented...` |

Both evidence files exist at the paths the spec's table cites (no archive-path
fallback needed — this ticket runs while both lanes' files are still at their
original, non-archived location).

Lane handoff check:
```
$ grep -E '^(status|last_agent):' .current/history/2026-09/e234/handoff.md
status: "PASS"
last_agent: "qa-engineer"

$ grep -E '^(status|last_agent):' .current/history/2026-09/e250/handoff.md
status: "PASS"
last_agent: "qa-engineer"
```

**AC1 verdict: PASS.** Both task-id groups resolve to a PASS qa evidence
file, both code-review files read APPROVED (e234 at round 3, e250 at round
1), and both closed lane handoffs record `status: "PASS"` /
`last_agent: "qa-engineer"`.

### AC4 — release-v4.1.0 follow-up regression check (task T-REL42-01)

(a) `docs/install.md` still describes the wider unsafe-path character class
refusal (backslash / control character, incl. the visible-escape display for
`agc eject` paths):
```
$ grep -n -i 'backslash\|control character' docs/install.md
150:- ... a backslash (`\`), or a control character (including CR and LF) — `local` refuses to run ...
220:- **Paths with control characters.** A printed path that contains a control character (for example LF, CR or ESC) is shown with visible escapes (`\n`, `\r`, `\x1b`) ...
```
Non-empty, both the E243 refusal text and the E250 visible-escape `agc eject`
display are present — not reverted.

(b) `specs/e177a-fanout-manifest.md` still records the primary-relative
`mailbox:` header semantics and the `MAILBOX_TILDE` error code:
```
$ grep -n -i 'MAILBOX_TILDE' specs/e177a-fanout-manifest.md
23:| `mailbox:` (NEW, optional) | ... a value starting with `~` fails render with `MAILBOX_TILDE` (E248). | ...
50:| `信箱` | ... | `MAILBOX_ROOT_ABSENT`; `MAILBOX_TILDE` (header starts with `~`). ... |
```
Non-empty — not reverted.

(c) `CHANGELOG.md` still carries the `[4.1.0]` entry, and the v4.1.0
release-time evidence archive is still present:
```
$ grep -n '\[4.1.0\]' CHANGELOG.md
19:## [4.1.0] - 2026-09-28

$ ls qa_reports/archive/release-v4.1.0/ review_reports/archive/release-v4.1.0/
qa_reports/archive/release-v4.1.0/:
review_T-E243-03.md  review_T-E243-04.md  review_T-E248-01.md  review_T-E248-02.md  review_T-REL41-01.md  review_T-REL41-02.md

review_reports/archive/release-v4.1.0/:
review_T-E243-03.md  review_T-E248-01.md
```
Both directories non-empty. **AC4 verdict: PASS.** All three follow-up items
unregressed and v4.1.0's own release-closure record still reads closed.

### AC2 — full suite green (task T-REL42-02)

```
$ npm test  (exit code captured explicitly, not inferred from tail)
EXIT_CODE=0
# tests 2958
# suites 1
# pass 2955
# fail 0
# cancelled 0
# skipped 3
# todo 0
# duration_ms 166870.507375
```
Exit 0, 0 failures. Matches the integrator baseline at HEAD `c5c7c30`
exactly (2958 tests, 2955 pass, 0 fail, 3 skipped). **AC2 verdict: PASS.**

### AC3 — clean build, no `dist/` diff (task T-REL42-02)

```
$ npm run build
> prebuild: check:version — dist/index.js parity OK (4.1.0); package-lock.json parity OK (4.1.0)
  note: HEAD (c5c7c30) is past tag v4.1.0 (f37a04c). Bump version + add
  CHANGELOG entry before tagging next release. (expected — release-engineer's
  job, out of scope here per spec)
> tsc
> postbuild: check:transitions-sync — OK (21 keys, exact match between
  dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)
BUILD_EXIT=0

$ git status --porcelain dist/
(empty output)
EXIT=0
```
Committed `dist/` is byte-identical to a fresh build. **AC3 verdict: PASS.**

## Phase 4 — Run

- Project build: zero errors (see AC3 log above).
- CI Runnability: `npm test` ran headlessly to completion with zero human
  interaction (see AC2 log above).
- No source or `dist/` file was modified by this QA pass; `git status
  --porcelain` at completion shows only this ticket's own governance-state
  writes (`.current/_primary/{handoff.md,tasks.md,dispatch.jsonl,telemetry.jsonl}`)
  plus PM's pre-existing untracked `specs/release-v4.2.0.md`.

## Verdict

**PASS.** AC1, AC2, AC3, AC4 all independently re-verified on the committed
main tree (HEAD `c5c7c30`) — not taken on PM's word. No anomalies found:
both lanes' (e234, e250+e251) qa PASS + code-review APPROVED evidence
stands, both closed lane handoffs read PASS/qa-engineer, the full suite is
green (2955 pass / 0 fail / 3 pre-existing skips, 2958 total, matching the
integrator baseline exactly), the build is clean with zero `dist/` diff, and
all of `release-v4.1.0`'s own shipped behavior and release-closure record
remain unregressed. `next_role: release-engineer`.
## 2026-09-28T16:18:04.237Z — PASS — by qa-engineer

PASS — AC1 (E234 + E250/E251 evidence: qa PASS, code-review APPROVED, closed lane handoffs PASS/qa-engineer) and AC4 (docs/install.md backslash/control-char refusal, specs/e177a-fanout-manifest.md MAILBOX_TILDE, CHANGELOG [4.1.0] + v4.1.0 evidence archive — all unregressed) independently re-verified on HEAD c5c7c30. AC2: npm test 2958 tests, 2955 pass, 0 fail, 3 skipped, exit 0 (matches integrator baseline). AC3: npm run build clean, git status --porcelain dist/ empty. No source/dist changes made. Details: qa_reports/review_T-REL42-01.md (covers T-REL42-01, T-REL42-02).

