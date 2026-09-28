# QA Review — T-E94-01 / T-E97-01

covers: T-E94-01, T-E97-01

## Context

Feature `e94-e97-release-staging-and-terminal-marker` — mini-chain, backlog rows in `tasks.md` ARE the spec (no `specs/<feature>.md`, no `design/<feature>.md`). code-reviewer APPROVED at review round 2 (`review_reports/review_T-E94-01.md`), after fixing round-1 blocking finding C1. QA scope per the task rows: `test/release-staging.test.mjs` (T-E94-01 re-baseline) and `test/stale-dispatch-detection.test.mjs` (T-E97-01 pins) — both untouched entering this round, both qa-owned by explicit instruction ("Tests are qa-owned (S2) — do NOT author them" in the sr rows).

## Expected-Red Diff

Manifest present: `qa_reports/expected-red_e94-e97-release-staging-and-terminal-marker.txt`, one entry:

```
test/release-staging.test.mjs | E71(a): the git-add line stages exactly 31 paths (19 directories + 12 metadata), set-equal to FEATURE_DIRS/METADATA_PATHS/E65_METADATA_PATHS
```

Full-suite run before any re-baseline edit: `# tests 1765 / # pass 1764 / # fail 1`, and the single `not ok` was byte-identical to the manifest entry above (T-E94-01's step-8 line/prose edits moved the true count to 33/14 while the pre-existing test still asserted 31/12 — sr-engineer's own manifest rationale). Diff: empty — the one actual red is exactly the one manifest entry, 1/1 confirmed, 0 unexplained reds.

**Disposition**: the manifest entry is the re-baseline target itself, per the task row's own instruction ("qa updates METADATA_PATHS and the AC2 pin"). Closed by editing `test/release-staging.test.mjs`: added `E94_METADATA_PATHS = ["CONTRIBUTING.md", "tasks.md"]`, folded it into the AC1 metadata-presence loop and the E71(a) exact-count pin (31→33 paths, 12→14 metadata, prose regexes retargeted to `/33 paths/` and `/19 directories \+ 14 metadata paths/`). Post-edit: that test (renamed to state "33 paths (19 directories + 14 metadata)") passes; full suite green (see Phase 4).

## Phase 1 — Review

No `specs/<feature>.md` or `design/<feature>.md` exists (mini-chain) — Copy Audit Gate, Visual Audit Gate, and Phase 1.5 Visual Compare are all N/A (logged, not silently skipped):
- Phase 1 (3a Copy Audit): skipped — no spec Copy/Strings H2 to audit against.
- Phase 1 (3b Visual Audit): skipped — no spec Visual Tokens H2.
- Phase 1.5: skipped (no `design/<feature>.md`, no Visual Baselines H2).
- Phase 3.5 (AC Execution Log): skipped (no `specs/<feature>.md`, so no `proof:`-annotated ACs are possible).

Read the implementation (both source diffs, re-confirmed against code-reviewer's round-2 APPROVED findings rather than re-litigating them from scratch):

- `content/skill-release-engineer.md` (T-E94-01): step 8's `git add` line and the E71a existence pre-filter both gained `CONTRIBUTING.md tasks.md`; E71a prose reads "33 paths (19 directories + 14 metadata paths)"; AC2 gained the "Root-file completeness (E94)" paragraph, final form (round-2 APPROVED, form (b)): `git diff --name-only -- . ':!.current'` (tracked-left-unstaged) + `git ls-files --others --exclude-standard -- . ':!.current'` (untracked-never-staged), empty-both = PASS. The paragraph explicitly names `git status --short` as the anti-pattern it replaces and explains why (prints already-staged paths too).
- `gates/feature-lease.ts` + `tools/handoff-parse.ts` (T-E97-01): `isReleaseClosingWrite` extracted verbatim (mechanically re-diffed against `HEAD:gates/feature-lease.ts` with the `prevState`→`state` rename normalized away — still byte-identical), exported, exactly 2 call sites (`gates/feature-lease.ts:150`, `tools/handoff-parse.ts:503`). The `handoff-parse.ts` guard (`state.next_role && state.dispatched_at && !isReleaseClosingWrite(state)`) short-circuits before `Date.parse`, matching the task row's "skipped entirely, not computed then discarded" instruction.

Own-judgment items I was handed (not requirements, per instruction):
- **N1** (STOP remedy has no branch for a stray file that should not ship): real but low-severity prose gap, matches an existing house-convention phrasing one bullet up, so fixing it alone would create an inconsistency worse than the gap. Not a test-infra defect, not a missing-coverage item against any stated AC — out of QA-FAIL scope by the SOP's own Scope rule. Leaving to the reviewer's own recommendation ("fold into whichever ticket next touches that bullet").
- **N2** (`.`/`':!.current'` pathspec scopes to cwd, silent-PASS-from-a-subdirectory hazard, defused today because the `git add -- lib/ tools/ …` line 3 bullets earlier fails loudly first from a subdirectory): I agree this is a real hardening, not a false alarm — `':/'`/`':!:/.current'` root-anchoring is cheap and the reviewer's own repro table (case D) demonstrates the gap directly, even though it's inert today only because of an unrelated line's fail-loud behavior 3 bullets up (fragile, not structural). **Recommend filing as a backlog row rather than folding into this cut** — it's a genuine improvement to a still-open bullet, not a defect in what shipped, and pulling it in now would scope-creep a mini-chain past a second review round for a hazard that cannot currently fire.

## Phase 2 — Discussion

None needed — code-reviewer's round-2 APPROVED verdict stands, and my own Phase 1 read found no new correctness issue. Proceeding directly to Phase 3.

## Phase 3 — Tests

### Spec-to-Test map (backlog rows are the spec)

| AC (tasks.md row) | Test(s) |
|---|---|
| T-E94-01 (1): step 8 git-add + pre-filter gain CONTRIBUTING.md, tasks.md | `AC1: skill-release-engineer.md's git-add step...` (existing, extended with `E94_METADATA_PATHS`) |
| T-E94-01 (2): prose reads 33 paths / 19 dirs + 14 metadata | `E71(a): the git-add line stages exactly 33 paths...` (re-baselined) |
| T-E94-01 (3): AC2 Root-file completeness check is enforceable | **NEW** `AC2 (E94): Root-file completeness check — the two EXTRACTED commands, EXECUTED, discriminate...` |
| T-E97-01 (1): `isReleaseClosingWrite` — both E13 disjuncts | **NEW** `E97-A1`/`E97-A2`/`E97-A3` (direct predicate unit tests) |
| T-E97-01 (1) non-regression: opening write matches neither disjunct | **NEW** `E97-A4` (direct predicate unit test; complements `test/feature-lease.test.mjs`'s own `E13-AC3` at the `isFeatureLeaseHeld` layer) |
| T-E97-01 (2): guard suppresses the advisory for the closing write, "at any elapsed" | **NEW** `E97-B1` |
| T-E97-01 (2): a genuine stale dispatch still emits | **NEW** `E97-B2`, `E97-A5` |
| reviewer C2 (pin as intended): release-engineer→pm escalation also suppresses (advisory + E22 watch-file) | **NEW** `E97-B3` |

### T-E94-01 test detail

`AC2 (E94)` is written to survive the exact class of defect that sank the round-1 wording: it **extracts** the two commands' literal text from the live SOP (never hardcodes a second copy) and **executes** them in scratch git repos, across four shapes mirroring the reviewer's own round-2 verification table — (1) an adopter repo with no `.current/` at all and source in a directory outside the 19 `FEATURE_DIRS`, confirming the pathspec doesn't error on a missing `.current/` and that a non-enumerated source dir is still caught (the "enumeration-free" property); (2) a dirty `.current/handoff.md` alongside an untracked stray root file, confirming the one legitimate exclusion still works and the untracked file is still surfaced; (3) the literal ESCAPE/PASS pair (a root file left unstaged after `git add`, then fully staged), confirming discriminating power in both directions. Also pins that `git status --short` may appear in the paragraph at most once, and only inside the "Do NOT use" disclaimer — regression guard against C1 recurring under a different edit.

`E71(a)`'s exact-count pin is re-baselined 31→33 / 12→14 via a new `E94_METADATA_PATHS = ["CONTRIBUTING.md", "tasks.md"]` array (mirrors the existing `E65_METADATA_PATHS` layering convention), folded into both the AC1 presence-loop and the E71(a) set-equality assertion.

### T-E97-01 test detail

`isReleaseClosingWrite` is now exported specifically so both of its consumers can be pinned independently against the same shared predicate (single-owner-with-two-consumers only holds if BOTH sides are actually tested) — `E97-A1`..`E97-A5` unit-test it directly: disjunct 1 (`next_role==="pm"`, independent of `pending_notes`), disjunct 2 both with `next_role` absent (the documented heal-write incident class) and with `next_role` present-but-not-`"pm"` (the second incident class E13 names — this is what makes disjunct 2 a genuine OR, not a next_role-gated variant of disjunct 1), the opening-write non-regression negative (same fixture shape as `test/feature-lease.test.mjs`'s pre-existing `E13-AC3`, exercised here against the shared exported function rather than only at the lease layer), and a negative proving `last_agent==="release-engineer"` alone is insufficient. `E97-B1`..`E97-B3` pin the same shapes end-to-end through `readHandoffState`, confirming the wiring at `tools/handoff-parse.ts`'s guard site: the E1A-triple closing write emits no `stale_dispatch` key at an absurdly stale elapsed (999 min); a genuine stale dispatch authored by `release-engineer` (`next_role="qa-engineer"`) still emits normally; and — per code-reviewer's C2 finding, which explicitly asked QA to pin this as intended rather than treat it as a defect — a release-engineer→pm write that is an *escalation* (ordinary notes, not `"Released vX.Y.Z"`) also suppresses both the advisory and the E22 watch-file emit, since disjunct 1 doesn't inspect `pending_notes` at all. Narrowing the predicate to avoid this would recreate the two-owner divergence E97 exists to kill (the lease gate already releases on exactly this state), so this is recorded as accepted behavior, made loud if a future edit narrows it back.

### Coverage gate

New/modified files: `test/release-staging.test.mjs` (+1 test, 1 array, re-baselined assertions in 2 existing tests), `test/stale-dispatch-detection.test.mjs` (+8 tests, +1 import). All new code is test code exercising the target SOP text / exported predicate directly — no untested branch introduced.

### Security smoke

Boundary inputs already covered by the pre-existing suite (malformed `dispatched_at`, absent `next_role`, schema migration boundaries — T1-T10 unchanged). No new trust boundary or input surface in this cut (confirmed independently in Phase 1, matching code-reviewer's Security section).

## Phase 4 — Run

- `npx tsc --noEmit`: clean, exit 0.
- `npm run build`: green (`check:version` OK 3.104.4, `tsc` clean, `check:transitions-sync` OK — 21 keys).
- `node --test test/*.test.mjs`: **1774/1774 pass, 0 fail** (1765 baseline + 9 new: 8 in `test/stale-dispatch-detection.test.mjs`, 1 in `test/release-staging.test.mjs`). `test/release-staging.test.mjs` alone: 77/77 (the manifest's one prior red is now green, re-baselined). `test/feature-lease.test.mjs` (pre-existing, untouched): green, confirming T-E97-01's own acceptance clause ("existing feature-lease tests unchanged and green").
- `agc check`: `OK (3.104.4) — all adapters current`.
- Acceptance greps re-confirmed independently: `grep -c CONTRIBUTING.md content/skill-release-engineer.md` = 3 (≥2 ✓); `grep -c tasks.md` = 5 (≥5 ✓); prose = "33 paths (19 directories + 14 metadata paths)" ✓; `isReleaseClosingWrite` exported with exactly 2 call sites (`gates/feature-lease.ts:150`, `tools/handoff-parse.ts:503`) ✓.

**PASS.**
## 2026-08-27T07:47:44.596Z — PASS — by qa-engineer

QA PASS, round 1. Phase 0.5 Expected-Red Diff: manifest 1 entry, actual reds 1/1 matched, disposition = the re-baseline target itself (closed by editing test/release-staging.test.mjs). T-E94-01: re-baselined METADATA_PATHS/E71(a) 31->33 paths (19 dirs + 14 metadata) via new E94_METADATA_PATHS=[CONTRIBUTING.md, tasks.md]; added a new AC2(E94) test that EXTRACTS the two Root-file-completeness commands from the live SOP text and EXECUTES them across 4 workspace shapes (adopter repo w/ no .current/ + source outside FEATURE_DIRS, dirty .current/, ESCAPE/PASS pair) plus a C1-regression guard on the git-status-short anti-pattern mention. T-E97-01: 8 new pins in test/stale-dispatch-detection.test.mjs -- E97-A1..A5 unit-test the exported isReleaseClosingWrite directly (both E13 disjuncts incl. the next_role-present-but-not-pm variant, the opening-write non-regression negative, and the last_agent-alone-insufficient negative); E97-B1..B3 pin the same shapes end-to-end via readHandoffState (E1A-triple closing write emits no stale_dispatch at 999min elapsed; genuine stale dispatch from release-engineer still emits; C2 escalation-widening pinned as intended per reviewer's explicit ask, incl. confirming the E22 watch-file also stays silent). Full suite 1774/1774 (1765+9 new), tsc clean, agc check OK (3.104.4), acceptance greps re-confirmed (CONTRIBUTING.md=3, tasks.md=5, isReleaseClosingWrite 2 call sites). N1/N2 judged: N2 (pathspec cwd-scoping) is a real hardening but inert today only via an unrelated line's fail-loud behavior -- recommend filing as a backlog row, not folding into this cut. Full detail qa_reports/review_T-E94-01.md.

## 2026-08-27T07:48:02.873Z — PASS — by qa-engineer

QA PASS, round 1. Phase 0.5 Expected-Red Diff: manifest 1 entry, actual reds 1/1 matched, disposition = the re-baseline target itself (closed by editing test/release-staging.test.mjs). T-E94-01: re-baselined METADATA_PATHS/E71(a) 31->33 paths (19 dirs + 14 metadata) via new E94_METADATA_PATHS=[CONTRIBUTING.md, tasks.md]; added a new AC2(E94) test that EXTRACTS the two Root-file-completeness commands from the live SOP text and EXECUTES them across 4 workspace shapes (adopter repo w/ no .current/ + source outside FEATURE_DIRS, dirty .current/, ESCAPE/PASS pair) plus a C1-regression guard on the git-status-short anti-pattern mention. T-E97-01: 8 new pins in test/stale-dispatch-detection.test.mjs -- E97-A1..A5 unit-test the exported isReleaseClosingWrite directly (both E13 disjuncts incl. the next_role-present-but-not-pm variant, the opening-write non-regression negative, and the last_agent-alone-insufficient negative); E97-B1..B3 pin the same shapes end-to-end via readHandoffState (E1A-triple closing write emits no stale_dispatch at 999min elapsed; genuine stale dispatch from release-engineer still emits; C2 escalation-widening pinned as intended per reviewer's explicit ask, incl. confirming the E22 watch-file also stays silent). Full suite 1774/1774 (1765+9 new), tsc clean, agc check OK (3.104.4), acceptance greps re-confirmed (CONTRIBUTING.md=3, tasks.md=5, isReleaseClosingWrite 2 call sites). N1/N2 judged: N2 (pathspec cwd-scoping) is a real hardening but inert today only via an unrelated line's fail-loud behavior -- recommend filing as a backlog row, not folding into this cut. Full detail qa_reports/review_T-E94-01.md.

