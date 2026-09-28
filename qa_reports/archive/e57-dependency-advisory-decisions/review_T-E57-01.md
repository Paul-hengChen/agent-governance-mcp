# Review — T-E57-01

covers: T-E57-01, T-E57-02, T-E57-03

## Context

E57 (`docs/backlog.md:180`, P2) — five HIGH npm advisories waived release
after release on individually-correct-but-cumulatively-wrong grounds.
Mini-chain: backlog row is the spec (no `specs/e57-dependency-advisory-decisions.md`),
PM/architect skipped, `scope_decision_why` records the mini-chain classification.
sr-engineer → code-reviewer (round 1 CHANGES_REQUESTED, round 2 APPROVED, see
`review_reports/review_T-E57-01.md`) → qa-engineer (this report). This QA round
re-verifies every AC independently per Constitution §7 fail-loud — prior verdicts
are treated as hypotheses, not inherited evidence.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e57-dependency-advisory-decisions.txt` —
this is not a bugfix-mode ticket; `dispatch_mode` absent = feature mode).

## Phase 1 — Review

Read the 4-file cut in full: `package.json`, `package-lock.json` diff,
`docs/dependency-advisories.md` (99 lines), `content/skill-release-engineer.md`
diff (+3 lines, step 6a). Also read both rounds of code-reviewer's
`review_reports/review_T-E57-01.md` (round 1 CHANGES_REQUESTED with F1-F6,
round 2 APPROVED confirming all fixed) — read as claims to re-test, not as
settled fact.

**Phase 3a/3b (Copy/Visual Audit Gates)**: skipped — the backlog row (the
spec-of-record for this mini-chain) has no *Copy/Strings* or *Visual Tokens*
H2; this is a dependency/docs change with no user-facing copy or visual
tokens. Nothing to audit.

## Phase 1.5 — Visual Compare

Skipped (no `design/<feature>.md`, no Visual Baselines — not a UI change).

## Phase 3.5 — AC Execution Log

Skipped: no `specs/<active_feature>.md` exists (mini-chain, backlog row is
the spec) and the backlog row carries no `proof:`-annotated ACs. The
independent re-verification below (AC1-AC7 from the dispatch brief) serves
the equivalent purpose and is recorded here instead.

## Independent AC Re-Verification (re-run fresh, not inherited)

All commands re-run by qa-engineer in this session, from a clean shell, with
no reference to sr-engineer's or code-reviewer's session notes for the
numeric/exit-code results (only the prose record was read, as an artifact to
audit — this is the "verify AC5's honesty" instruction from the dispatch brief).

1. **`npm audit --audit-level=high` exits 0** — CONFIRMED. Live output: 6
   vulnerabilities remain (2 low: `body-parser`, `esbuild`; 4 moderate:
   `@hono/node-server`, `@modelcontextprotocol/sdk` (via `@hono/node-server`),
   `hono`, `protobufjs`), all below the `--audit-level=high` gate. Exit code 0.

2. **Pin integrity** — CONFIRMED via `npm ls @modelcontextprotocol/sdk
   @xenova/transformers sharp js-yaml fast-uri ip-address`:
   `@modelcontextprotocol/sdk@1.29.0` (unchanged), `@xenova/transformers@2.17.2`
   (unchanged), `sharp@0.35.3 overridden`, `js-yaml@4.3.1`, `fast-uri@3.1.5`,
   `ip-address@10.5.0`. No semver-major downgrade smuggled in on either pinned
   package.

3. **Build + suite** — CONFIRMED. `npx tsc --noEmit` exit 0. Full suite
   `node --test test/*.test.mjs`: **1692/1692** (baseline 1690/1690 + 2 new
   tests authored this round, see Phase 3 below — 0 failures, 0 skipped).

4. **`node scripts/smoke-rag.mjs`** — CONFIRMED. `Embedding dim: 384`,
   correct top-ranked retrieval result ("Session Management" for the
   session-length query), exit 0, under the live `sharp@0.35.3` /
   `@xenova/transformers@2.17.2` pair.

5. **`docs/dependency-advisories.md` coverage** — CONFIRMED. All 5 HIGH
   advisories covered (js-yaml, fast-uri, ip-address, sharp, `@xenova/transformers`),
   each with GHSA id(s), dependency path, reachability finding, decision, and
   re-review trigger. Residual-out-of-scope table names exactly the 6
   findings `npm audit` reports today (2 low + 4 moderate), matching #7 below
   digit for digit.

   **The reachability probe — independently re-run, reproduces exactly as
   the corrected record states.** This is the claim the dispatch brief
   specifically flagged as worth attacking (round 1 asserted, on a
   `process.moduleLoadList` probe, that sharp's native binding never loads —
   later shown false by code-reviewer and corrected in round 2). I re-ran
   both halves of the method myself, from a clean `node -e` process, with no
   reference to either party's transcript:
   - *Valid probe*: intercepted `process.dlopen`, then
     `await import("@xenova/transformers")`. Result:
     `node_modules/onnxruntime-node/bin/napi-v3/darwin/arm64/onnxruntime_binding.node`
     and `node_modules/@img/sharp-darwin-arm64/lib/sharp-darwin-arm64-0.35.3.node`
     — byte-for-byte the two paths the record names, same order, same filename.
   - *Positive control*: `require("sharp")` — `sharp.versions.vips === "8.18.3"`,
     `sharp.versions.sharp === "0.35.3"` — against `process.moduleLoadList`:
     **0 of 163** entries matched `sharp`/`.node`/`Addon`/`dlopen`, confirming
     `moduleLoadList` has no discriminating power over `dlopen`'d addons.
   - Conclusion independently reproduced: **libvips IS resident in-process
     under SQLite mode**, the resident binding is the fixed 0.35.3/8.18.3,
     and the safety argument correctly rests on the RAG pipeline never
     issuing a decode call (text-only feature extraction), not on absence of
     load. The record as written matches what I observed — no further
     correction needed.

6. **`content/skill-release-engineer.md` points at the record; byte-pinned
   rows unchanged** — CONFIRMED. Step 6a (new, +3 lines) reads
   `docs/dependency-advisories.md` for a per-advisory disposition rather than
   instructing an ad-hoc waiver. Extracted every `^| ` line from `HEAD` and
   from the working tree and diffed: **identical** — the Escalation Routes
   table (now at `:155-160` after the +3-line insertion, unchanged content)
   is untouched, satisfying `test/release-staging.test.mjs:757` and
   `test/verify-release.test.mjs:701`'s byte-pins (both pass live in the full
   suite run above; they match by content/regex, not literal line number, so
   the +3-line shift does not trip them).

7. **No residual advisory silently promoted/suppressed** — CONFIRMED. The
   live `npm audit --audit-level=high` output names exactly: `body-parser`
   (low), `esbuild` (low), `@hono/node-server` (moderate),
   `@modelcontextprotocol/sdk` via `@hono/node-server` (moderate), `hono`
   (moderate), `protobufjs` (moderate) — 2 low + 4 moderate, matching
   `docs/dependency-advisories.md`'s "Out of scope" table package-for-package.
   None promoted, none silently dropped from the table.

**All 7 ACs independently confirmed.** No discrepancy found between the
record's claims and live re-verification — including on the one claim
(AC5's reachability probe) that had already failed one prior verification
attempt and had to be corrected before this round began.

## Phase 3 — Tests

**Test File Discovery**: `test/dependency-overrides.test.mjs` already exists
(authored for the prior protobufjs/qs override ticket) and is the pre-named
target per the dispatch brief — no new test file needed, §2's
ask-before-creating rule does not arm.

**Tests authored this round** (2 new, added to the existing file, matching
its structure/comment conventions — `minVersion`/`gte` helpers reused as-is):

1. `E57 AC1: sharp override floor is >= 0.35.3 (clears GHSA-f88m-g3jw-g9cj
   libvips CVEs)` — anchors the one re-review trigger in
   `docs/dependency-advisories.md` that the record itself flags as
   attention-dependent (no test/gate/grep currently observes it): *"RAG/SQLite
   mode gains any image-input code path"*. Without this pin, a future edit
   could silently drop or loosen the override and the libvips CVEs would
   return with no mechanical signal until the next manual `npm audit` run.

2. `E57: package.json declares exactly ONE top-level "overrides" key with all
   three pins effective` — targets the real near-miss from this ticket's own
   history: sr-engineer's first edit produced a **duplicate** top-level
   `"overrides"` key; `JSON.parse` silently keeps the last and drops the
   first, so the sharp override was momentarily inert and only surfaced via
   an installed-version mismatch, not any existing check. This test asserts
   both halves independently — a raw-text count of `"overrides":`
   occurrences (catches the duplicate-key shape itself, which a
   parsed-object assertion cannot see, since `JSON.parse` already normalized
   it away by the time `pkg.overrides` exists) **and** the effective parsed
   key set (`protobufjs`, `qs`, `sharp`, exactly). Either check alone would
   have missed a different half of the failure mode that actually occurred.

Both pass: `node --test test/dependency-overrides.test.mjs` → 5/5 (3
pre-existing + 2 new). Full suite: **1692/1692** (was 1690/1690 baseline).

**Coverage Gate**: n/a in the line-coverage-tool sense — the change under
test is a JSON config value and a markdown prose document, not executable
application code. The two new tests fully exercise the one thing that *is*
executable and regression-prone here (the override block's shape and floor).

**Security smoke tests**: not applicable — no new input path, no new
auth/permission surface. The dependency bumps themselves are the security
fix under test (AC1/AC2 above).

## Non-blocking nits — fixed in this round

Both nits from code-reviewer (confirmed genuine, both non-verdict-holding)
were straightforward, low-risk prose corrections within the same two files
already in the cut, so I applied them directly rather than carrying them
forward:

- **N1** (`content/skill-release-engineer.md`, step 6a): the `:20`
  line-number cross-reference to the version-literal Hard rule was wrong
  (actual line 18; `:20` is the unrelated "CRITICAL — STOP on ⛔ rejection"
  rule) — replaced with the phrase-anchored reference "the
  version-assertion-tests Hard rule" per code-reviewer's own recommendation,
  so it can't drift again on the next insertion.
- **N2** (`docs/dependency-advisories.md:68`): deleted the circular trailing
  clause "rather than a merely-out-of-range one" — meaning was never in
  doubt, just redundant phrasing.

Verified post-edit: full suite still 1692/1692, `npm audit --audit-level=high`
still exit 0, byte-pinned Escalation Routes rows still untouched (neither
edit touched the table; N1 is outside it, N2 is in a different file
entirely).

## Known drift — not this ticket's, not touched

`tw_detect_drift` reports `tasks.md` marks `T-E53-01/02/03` complete while
the handoff's `completed_tasks` doesn't mention them. Confirmed this is E53
residue: E53 was already QA-PASSed and committed (`7b33f90`, `bb6bb2e`); its
review files (`qa_reports/review_T-E53-01/02/03.md`) exist and predate this
session; `completed_tasks` is feature-scoped and reset when `active_feature`
moved to E57. No `tw_sync`, no `tw_rollback_task` run against it — reported
here for the coordinator to handle at feature close, per the dispatch brief.

## Phase 4 — Run

- Build: `npx tsc --noEmit` — zero errors.
- CI runnability: `node --test test/*.test.mjs` runs headlessly, zero human
  interaction, exit 0.
- Dependency audit (build-gate rule, Constitution §6): `npm audit
  --audit-level=high` exit 0.

## Verdict

**PASS.** All 7 dispatch-brief ACs independently re-verified from a clean
session, including a fresh re-run of the one probe whose first verification
attempt in this ticket's history disproved the original claim — this
round's re-run reproduces the corrected claim exactly. Two tests added to
the pre-existing `test/dependency-overrides.test.mjs` (sharp floor pin +
duplicate-overrides-key guard), full suite 1692/1692 (+2 over the 1690
baseline). Two non-blocking nits fixed in-place. Known `T-E53-*` drift is
pre-existing residue, correctly left untouched per the dispatch brief.

`completed_tasks` was `[]` entering this round — `T-E57-01`, `T-E57-02`,
`T-E57-03` are newly added by the PASS write that accompanies this report,
which is the on-disk evidence satisfying `QA_COMPLETION_EVIDENCE_MISSING`
for all three.
## 2026-08-12T02:39:25.959Z — PASS — by qa-engineer

PASS. All 7 dispatch-brief ACs independently re-verified from a clean session (npm audit --audit-level=high exit 0; SDK 1.29.0 + transformers 2.17.2 unchanged; npx tsc --noEmit clean + suite 1692/1692; smoke-rag.mjs 384-dim correct; docs/dependency-advisories.md covers all 5 HIGH advisories; skill-release-engineer.md points at record with byte-pinned Escalation Routes rows untouched; residual 2 low + 4 moderate named exactly matching live audit output). Independently re-ran the process.dlopen reachability probe that had disproven the record's original round-1 claim -- reproduces the corrected claim exactly (libvips resident under SQLite mode via the fixed 0.35.3/8.18.3 binding; safety rests on no decode call ever issuing). Added 2 tests to the pre-existing test/dependency-overrides.test.mjs: sharp override floor >=0.35.3 (anchors the record's one attention-dependent re-review trigger) and a raw-text+parsed guard against the duplicate-"overrides"-key near-miss from this ticket's own history. Fixed both non-blocking nits (N1 line-cite, N2 circular clause) in place. Known T-E53-01/02/03 tasks.md/handoff drift confirmed as pre-existing E53 residue (already QA-PASSed, committed 7b33f90/bb6bb2e) -- reported, not touched. See qa_reports/review_T-E57-01.md (covers: T-E57-01, T-E57-02, T-E57-03).

