# QA review — T-REL41-01, T-REL41-02
<!-- covers: T-REL41-01, T-REL41-02 -->

Feature: `release-v4.1.0` (evidence-only MINOR release gate; no new code
written under this ticket). Reviewed independently against
`specs/release-v4.1.0.md` — PM's inline summary in `scope_decision_why` was
treated as a claim to verify, not a fact to trust.

## Phase 0.5 — Expected-Red Diff
skipped (no expected-red manifest declared — `qa_reports/expected-red_release-v4.1.0.txt` absent)

## Copy Audit Gate
N/A — spec's Copy / Strings table is explicitly `N/A` (evidence-verification only, no user-facing strings introduced).

## Visual Audit Gate
N/A — spec's Visual Tokens / Visual Widgets tables are explicitly `N/A`; no `design/release-v4.1.0.md` exists, `## Mode` not armed.

## Phase 1.5 — Visual Compare
skipped (no Visual Baselines declared — no design file for this feature)

## AC Execution Log

### AC1 — E243/E248 evidence table (task T-REL41-01)

| lane | task id | qa evidence file | grep -i verdict (last `## Verdict` / auto-appended block) | code-review evidence file | grep -i verdict |
|---|---|---|---|---|---|
| e243 | T-E243-03 | `qa_reports/review_T-E243-03.md` | `**Verdict: PASS.**` (line 53) | `review_reports/review_T-E243-03.md` | `Verdict: APPROVED.` (line 12) |
| e243 | T-E243-04 | `qa_reports/review_T-E243-04.md` | `## Verdict` → `**PASS.**` (line 160) | (covered by T-E243-03's review, same lane) | — |
| e248 | T-E248-01 | `qa_reports/review_T-E248-01.md` | auto-appended block: `## 2026-09-28T09:19:51.929Z — PASS — by qa-engineer` | `review_reports/review_T-E248-01.md` | `Verdict: APPROVED.` (line 9) |
| e248 | T-E248-02 | `qa_reports/review_T-E248-02.md` | auto-appended block: `## 2026-09-28T09:19:51.929Z — PASS — by qa-engineer` | (covered by T-E248-01's review, same lane) | — |

Note: `grep -n -i verdict` returned no line match on the two E248 files
because their tw_update_state auto-appended PASS block does not contain the
literal word "verdict" — the section is a stamped date-header, not a
`## Verdict` H2. I read both files' tails directly and confirmed the text
reads `PASS` unambiguously in both (T-E248-01: "PASS. AC1-AC9 each have a
dedicated test..."; T-E248-02: same auto-appended block, plus its own body
closes "Exactly the two named table rows changed; no other line of the spec
differs. PASS."). Not a defect — recorded so the raw `grep` command in the
spec's `proof:` line is not misread as failing.

Lane handoff check:
```
$ grep -E '^(status|last_agent):' .current/history/2026-09/e243/handoff.md
status: "PASS"
last_agent: "qa-engineer"

$ grep -E '^(status|last_agent):' .current/history/2026-09/e248/handoff.md
status: "PASS"
last_agent: "qa-engineer"
```

**AC1 verdict: PASS.** All 4 task ids resolve to a PASS qa evidence file, the
2 code-review files both read APPROVED, and both closed lane handoffs record
`status: "PASS"` / `last_agent: "qa-engineer"`.

### AC4 — release-v4.0.0 follow-up regression check (task T-REL41-01)

(a) `docs/schema-versions.md` still carries the E125a lane-ledger narrative:
```
$ grep -n -i 'tasks_role\|_primary\|tasks-index-receipt' docs/schema-versions.md
29:| v2 | lane-local ledgers (e125a): ... <!-- tasks_role: index — ... --> ...
66:`integ/*`, `fix/*`, detached HEAD) → `_primary`. `.current/.config.json`,
95:### Tasks v2 index shape and `_primary` forward migration (e125a)
101:- **Line 2 (Notice comment):** `<!-- tasks_role: index ... -->`
104:**The `_primary` forward migration** runs lazily on first task-list access...
110:1. **Copies** the root `tasks.md` body into `.current/_primary/tasks.md` (stamped v2)
112:3. **Writes** a receipt file `.current/tasks-index-receipt.json` ...
114:**Why copy instead of move for `_primary`:** ...
118:**Reception and reverse runner:** ...
```
Non-empty, narrative present and intact — not reverted.

(b) `.github/workflows/ci.yml`'s checkout step still carries `fetch-depth: 0`:
```
$ grep -n -A2 'checkout@v4' .github/workflows/ci.yml
17:      - uses: actions/checkout@v4
18-        with:
19-          fetch-depth: 0
```
CI-red fix unregressed.

(c) `docs/v4.0.0-execution-plan.md` line 1269 (final §9 checklist item):
```
$ sed -n '1269p' docs/v4.0.0-execution-plan.md
- [x] 全套測試綠、`agc check — OK (4.0.0)` exit 0、`verify-release` 六項全過（✅ v4.0.0 `0bca302`，2026-09-27）
```
Reads `[x]` — v4.0.0 closed cleanly, confirming the baseline this ticket's
scope assumes.

**AC4 verdict: PASS.** All three follow-up items unregressed.

### AC2 — full suite green (task T-REL41-02)

```
$ npm test  (exit code captured explicitly, not inferred from tail)
EXIT_CODE=0
# tests 2926
# suites 1
# pass 2923
# fail 0
# cancelled 0
# skipped 3
# todo 0
# duration_ms 161033.871542
```
Exit 0, 0 failures. 3 skips are pre-existing (unrelated to this ticket — no
code changes were made under it). **AC2 verdict: PASS.**

### AC3 — clean build, no `dist/` diff (task T-REL41-02)

```
$ npm run build
BUILD_EXIT=0
check:version — dist/index.js parity OK (4.0.0)
check:version — package-lock.json parity OK (4.0.0)
check:version — note: HEAD (11084c8) is past tag v4.0.0 (48fb9fe). Bump
  version + add CHANGELOG entry before tagging next release. (expected —
  release-engineer's job, out of scope here per spec)
check:version — OK (4.0.0)
> tsc
> check:transitions-sync — OK (21 keys, exact match between
  dist/tools/transitions.js and specs/qa-flow-enforcement-architecture.md)

$ git status --porcelain dist/
(empty output)
EXIT=0
```
Committed `dist/` is byte-identical to a fresh build. **AC3 verdict: PASS.**

## Phase 4 — Run

- Project build: zero errors (see AC3 log above).
- CI Runnability: `npm test` ran headlessly to completion with zero human
  interaction (see AC2 log above).

## Verdict

**PASS.** AC1, AC2, AC3, AC4 all independently re-verified on the committed
main tree (HEAD `11084c8`) — not taken on PM's word. No anomalies found:
both lanes' qa PASS + code-review APPROVED evidence stands, both closed lane
handoffs read PASS/qa-engineer, the full suite is green (2923 pass / 0 fail
/ 3 pre-existing skips, 2926 total), the build is clean with zero `dist/`
diff, and all three of `release-v4.0.0`'s own follow-up items remain
unregressed. `next_role: release-engineer`.
## 2026-09-28T10:07:49.409Z — PASS — by qa-engineer

Independently re-verified (not on PM's summary alone). AC1: all 4 E243/E248 task ids resolve to PASS qa evidence + APPROVED code-review evidence; both closed lane handoffs (.current/history/2026-09/{e243,e248}/handoff.md) read status:PASS/last_agent:qa-engineer. AC4: v4.0.0 follow-ups unregressed — docs/schema-versions.md E125a narrative intact, ci.yml fetch-depth:0 intact, v4.0.0-execution-plan.md line 1269 checklist item reads [x]. AC2: npm test exit 0, 2923 pass / 0 fail / 3 pre-existing skips / 2926 total. AC3: npm run build exit 0, git status --porcelain dist/ empty (byte-identical). No anomalies. Evidence: qa_reports/review_T-REL41-01.md (covers T-REL41-01, T-REL41-02).

