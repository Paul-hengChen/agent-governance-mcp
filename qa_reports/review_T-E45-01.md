# QA Review — T-E45-01

covers: T-E45-01

## Phase 0 — Claim

Claimed at `(qa-engineer, In_Progress)` after code-reviewer APPROVED at review_round 2
(`review_reports/review_T-E45-01.md`). That report's verified facts are treated as
established and not re-derived here; this doc covers what code-reviewer's scope
explicitly excludes — test authorship and full-suite verification.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e45-qa-blocked-pm-escape.txt` manifest declared).

## Phase 1 — Review

Change under test (confirmed via `git diff`): one additive `ALLOWED` entry
`{ agent: "pm", status: "In_Progress" }` on the `qa-engineer:Blocked` row
(`tools/transitions.ts:246-287`, entry + a v3.95.0 provenance comment), mirrored at
`specs/qa-flow-enforcement-architecture.md:161`. Human chose option A, loose variant —
no `resume_of` requirement on this outbound edge. Code-reviewer's two-round review
(APPROVED at round 2) already verified: the code is provably unmoved across rounds
(one non-comment diff line total), the comment's rationale is now accurate against
`content/skill-qa-engineer.md`, no sibling edge opened, judge-skip probes still reject,
round-cap overrides still outrank the table, `computeNewRound` reset semantics
unchanged, and the spec mirror is byte-accurate. No new correctness findings from this
pass — nothing in the sanctioned diff was re-opened.

**Stale-field note**: `.current/handoff.md`'s `scope_decision_why` still carries an
uncorrected claim (N-2 in the review report) that skill-qa-engineer's Escalation Routes
prescribe `Blocked` + `next_role: pm` for spec defects — they do not (`content/skill-qa-engineer.md:97-98`
route both spec-defect rows via `FAIL` → pm; the file's only `Blocked` row, `:95`, routes
to sr-engineer). The corrected rationale lives in the `tools/transitions.ts` comment,
`docs/backlog.md`'s E45 row, and `research/vs-ndi-button-realign-qa-blocked-dead-end.md`'s
勘誤 block. Not propagated further here; per the dispatch, the coordinator corrects that
field at close.

### 3a. Copy Audit Gate

N/A — no `specs/<feature>.md` exists for E45 (mini-chain, backlog row is the spec, no
*Copy / Strings* H2). No user-facing string introduced by this diff (comment text and a
markdown table cell only).

### 3b. Visual Audit Gate

N/A — no Visual Tokens H2, no literal property introduced.

## Phase 1.5 — Visual Compare

Skipped (no `design/e45-qa-blocked-pm-escape.md`, no Visual Baselines declared).

## Phase 2 — Discussion

No open issues at QA intake — code-reviewer's round 2 APPROVED with only
coordinator/PM-owned bookkeeping notes (N-1..N-5), none actionable by sr-engineer or QA.
Proceeding directly to Phase 3.

## Phase 3 — Tests

### 3a. Test File Discovery

`test/qa-flow.test.mjs` already covers `tools/transitions.ts` (`ALLOWED_TRANSITIONS`,
`validateTransition`, `computeNewRound`) and, via `handleUpdateState`/`TOOL_REGISTRY`,
the E38 next_role lookahead advisory in `tools/handoff-orchestrator.ts`. Per the
dispatch's explicit instruction, the EXISTING file was modified — no new test file
created.

### 3b. Spec-to-Test Map

No `specs/<feature>.md` exists (mini-chain); the backlog E45 row + the dispatch's four
numbered coverage requirements are the spec. Mapping:

| requirement | test(s) |
|---|---|
| 1. Positive accept, no `resume_of` | `T-E45-01: qa-engineer:Blocked → pm:In_Progress accepted, no resume_of required` |
| 2. Row-equality pin (T-MATRIX-C13 shape) | `T-E45-01: qa-engineer:Blocked row equals exactly {sr-engineer:In_Progress, qa-engineer:In_Progress, pm:In_Progress}` |
| 3. Regression: `qa-engineer:In_Progress` unchanged | `T-E45-01 (regression pin): qa-engineer:In_Progress row still admits only its three own-agent statuses — no direct pm entry` |
| 3. Regression: round-cap override envelopes unaffected | `qa_round at cap still rejects … (QA_ROUND_EXCEEDED, pm-only)`, `review_round at cap still rejects … (REVIEW_ROUND_EXCEEDED, pm-only)`, `visual_round at cap still accepts … (the cap's own escape, unweakened)` |
| 4. E38 lookahead: silent now that pm is legal | `T-E45-01/E38: qa-engineer:Blocked write with next_role=pm produces NO advisory (pm now a legal successor)` |
| 4. E38 lookahead: still fires for unreachable next_role | `T-E45-01/E38: qa-engineer:Blocked write with an unreachable next_role STILL warns (predicate pinned, not just its silence)` |

8 new tests added to `test/qa-flow.test.mjs`, appended after the T-E37-01 section.

### 3c. Coverage Gate

New/modified source: zero (`tools/transitions.ts` and `specs/qa-flow-enforcement-architecture.md`
were sr-engineer's diff, already reviewed; QA's own diff is test-file-only). The 8 new
tests exercise every line of the new `ALLOWED` entry (both the static row via
`ALLOWED_TRANSITIONS.get`, and the runtime accept path via `validateTransition`), plus
the orchestrator's E38 branch on the new row membership. No tooling gap to note.

### 3d. Security Smoke Tests

N/A for this diff class (static routing-table data + a markdown cell; no user input,
no auth/permission surface). Code-reviewer's Security section already covers this
(widened-authorization-matrix check, backward-only edge, no judge-skip, no cap
weakened) — not re-litigated here.

## Phase 3.5 — AC Execution

Skipped (no `specs/e45-qa-blocked-pm-escape.md`, no `proof:`-annotated ACs — mini-chain,
backlog row is the spec).

## Phase 4 — Run

### Build

```
npm run build
```
`tsc` — zero errors. `check:version` — OK (3.94.0); dist parity confirmed (also
independently reproduced byte-identically by code-reviewer in both rounds).

### Full suite

```
node --test test/*.test.mjs
```

```
1..1628
# tests 1641
# suites 1
# pass 1641
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Baseline before this ticket was 1633/1633 (per dispatch). 1641 = 1633 + 8 new tests, all
green — no regressions, no pre-existing failures uncovered.

### `npm audit --audit-level=high`

11 pre-existing vulnerabilities, unrelated to this diff:

- `js-yaml` 4.0.0–4.3.0 (high) — quadratic CPU in merge-key/`!!omap` resolution
- `sharp` <0.35.0 (high, via `@xenova/transformers`) — libvips CVEs
- `protobufjs` 7.5.0–7.6.4 (moderate) — infinite loop in `.proto` option parsing
- `fast-uri` 3.0.0–3.1.4 (high) — host confusion via backslash/IDN authority parsing
- `ip-address` ≤10.3.0 (high) — octal/CIDR/NAT64 SSRF misclassification
- `hono` ≤4.12.33 (moderate) — ReDoS/SSR/proxy-header issues
- `esbuild` 0.27.3–0.28.0 (dev-only) — arbitrary file read on Windows dev server

Confirmed pre-existing and out of scope: `git status --porcelain package.json
package-lock.json` and `git diff --stat -- package.json package-lock.json` both return
empty — neither file is touched by this diff. Not attempted to fix, per the dispatch.

## Quality

None on the test additions. Row-equality pin follows the exact T-MATRIX-C13/E37
`deepEqual` shape at `test/qa-flow.test.mjs:1841` the dispatch asked to mirror. Round-cap
regression pins reproduce, from `qa-engineer:Blocked`'s own direction, the exact probes
code-reviewer ran manually against `dist/` in round 2 (`qa_round=4` → `QA_ROUND_EXCEEDED`,
`review_round=4` → `REVIEW_ROUND_EXCEEDED`, `visual_round=6` → accept), so they are now
pinned rather than one-off manual verification. The two E38 tests go through the real
`tw_update_state` tool boundary (`handleUpdateState`), matching the through-the-tool
convention `test/e38-next-role-lookahead.test.mjs` established for this exact advisory,
rather than re-testing the bare helper.

## Security

No findings — no new source touched. Code-reviewer's round-2 security analysis stands
(backward-only hand-off to PM, no judge-skip, no cap weakened, PASS still
qa-engineer-exclusive).

## Verdict: PASS

All four dispatch requirements covered with passing, deepEqual-pinned tests; full build
clean; full suite 1641/1641 (1633 baseline + 8 new, zero regressions); audit advisories
confirmed pre-existing and unrelated. Release bookkeeping (version bump, CHANGELOG,
backlog done-mark) is release-engineer's job post-PASS, per SOP — not done here.
## 2026-08-10T05:57:18.346Z — PASS — by qa-engineer

PASS. code-reviewer APPROVED at review_round 2 (review_reports/review_T-E45-01.md); no correctness re-opened. Authored 8 tests in test/qa-flow.test.mjs (no new file, per dispatch): (1) positive accept qa-engineer:Blocked -> pm:In_Progress with no resume_of; (2) row-equality pin (T-MATRIX-C13/E37 shape) — qa-engineer:Blocked row deepEqual {sr-engineer:In_Progress, qa-engineer:In_Progress, pm:In_Progress}; (3) regression pins — qa-engineer:In_Progress row unchanged (no pm leak), and all three round-cap override envelopes (QA_ROUND_EXCEEDED, REVIEW_ROUND_EXCEEDED, VISUAL_ROUND_EXCEEDED-escape) reproduced from this row's own direction; (4) E38 next_role lookahead advisory on Blocked states — silent now that pm is legal, still fires for a genuinely unreachable next_role (through the real tw_update_state tool boundary). Full npm run build clean; full suite 1641/1641 (1633 baseline + 8 new, zero regressions). npm audit --audit-level=high: 11 pre-existing vulnerabilities (js-yaml, sharp/libvips via @xenova/transformers, protobufjs, fast-uri, ip-address, hono, esbuild) confirmed unrelated — package.json/package-lock.json untouched by this diff, not fixed per scope. Evidence: qa_reports/review_T-E45-01.md. Note: .current/handoff.md scope_decision_why still carries the stale skill-qa-engineer claim (N-2, review report) — left uncorrected per dispatch instruction for coordinator to fix at close.

