# QA review — T-E148-02

covers: T-E148-02

## Round 2 — re-audit + fix for the file round 1's grep missed

### What round 1 missed, and why

Round 1's candidate grep was case-sensitive on `updateState`, so it never
matched `handleUpdateState` — the actual call site used throughout the test
suite. `test/e32-e33-gate-hardening.test.mjs` has the exact susceptible
shape (`gates/stamp-provenance.ts`'s `STAMP_PROVENANCE_SUSPECT`, armed when
an on-disk `last_updated` happens to land on the wall-clock-derived
`HAND_AUTHORED_STAMP_RE` shape — seconds `00` AND ms `.000`, ~1/60000 odds):
its `seedFileState()` (line 60, pre-fix) seeds via `writeHandoffState(...)`
with an uncontrolled `new Date().toISOString()` `last_updated`, and every one
of the file's 10 tests then runs a single `handleUpdateState(...)` gated
write against that seeded prevState (first at line 114, pre-fix).

### Fix applied

`test/e32-e33-gate-hardening.test.mjs`:
- Added `import { forceSeedStamp } from "./e148-seed-stamp.mjs";`.
- `seedFileState()` now calls `forceSeedStamp(ws)` immediately after the
  `writeHandoffState(...)` seed write, before returning — same ordering
  convention the helper's own header documents (force AFTER the seed write,
  BEFORE the next `markStateRead` re-snapshot). All 10 tests in the file
  call `seedFileState` once and then a single `handleUpdateState` (no
  multi-write chains), so `SAFE_SEED_STAMP`'s fixed 2026-01-01 default is
  safe — none of this file's assertions are lease-freshness-sensitive
  (they test `QA_COMPLETION_EVIDENCE_MISSING` / `MISSING_REVIEW_EVIDENCE`,
  not `FEATURE_LEASE_HELD`), matching `test/e18-write-provenance.test.mjs`'s
  identical default-stamp usage rather than
  `test/feature-lease.test.mjs`'s `freshNonSuspectStamp()` usage.
- No other change to this file. `gates/stamp-provenance.ts` untouched.

### Task 2 — whole-tree re-audit (general predicate, case-insensitive)

Predicate: ANY gated write (`handleUpdateState`, `UPDATE_STATE_ENTRY.run`, a
`TOOL_REGISTRY` lookup/call of `tw_update_state`) that runs against an
on-disk `last_updated` produced by an uncontrolled clock — whether that
prevState came from a `writeHandoffState` seed, a raw fs-write seed, or a
prior ACCEPTED gated write in the same test becoming the next call's
prevState.

Method: `grep -liE "handleUpdateState|UPDATE_STATE_ENTRY\.run|tw_update_state" test/*.test.mjs`
(case-insensitive, whole tree) → 37 files. Diffed against files already
importing `test/e148-seed-stamp.mjs` (round 1's 15 fixes) → 22 remaining
candidates, of which `test/e32-e33-gate-hardening.test.mjs` is the one fixed
above. Read the other 21 individually (imports, call sites, and — where a
gated call exists — what prevState it runs against):

**Not susceptible, no change (21 files), with reason:**
- `baseline-manifest-gate`, `cut-approval-gate`, `context-budget`,
  `pixel-gate-attestation`, `source-credibility-gate`, `visual-gate-e2e`,
  `writestate-options-object` — every `tw_update_state` occurrence is inside
  a comment (the boilerplate "Relocated by the registry-pattern refactor:
  the tw_update_state gate-orchestration body … compiles into
  dist/tools/handoff-orchestrator.js" note) or a verbatim string-presence
  check against compiled `dist/gates/registry.js` / `dist/index.js` text.
  Zero calls to `handleUpdateState` or `TOOL_REGISTRY` in any of these files
  (confirmed by a direct grep for those two symbols — no matches). Any
  `writeHandoffState` calls in `cut-approval-gate`/`visual-gate-e2e`/
  `writestate-options-object` are raw, ungated seed/round-trip writes with
  no subsequent gated call reading them back.
- `drift-stamp-advisory` — only a raw `writeHandoffState` call, no gated
  write follows it in this file.
- `e128-blocked-self-loop-repro`, `eval-assertions`, `pixel-perfect-visual-
  compare`, `release-staging`, `skill-evolution-v3.11`, `subagent-
  templates`, `visual-evidence-gate` — `tw_update_state` appears only in
  prose/comments or in string literals fed to a shape-checking helper
  (`checkEscalationShape(...)`); no gated call site at all.
- `e26-gate-stats` — the one real hit (`TOOL_REGISTRY` name-list assertion,
  T2) only checks `names.includes("tw_update_state")`; it never invokes the
  tool. No gated write in this file.
- `e35-pipeline-order` — `tw_update_state` only in a comment; no
  `handleUpdateState`/`TOOL_REGISTRY` call.
- `e92-e86-handoff-write-boundary` and its `-repro` sibling — both call
  `updateStateTool.run(rawArgs)` directly (bypassing `handleUpdateState`),
  but every such call in both files either (a) targets a workspace that was
  never `fs`-written at all (`PROBE_WORKSPACE = "/nonexistent/…"`, or a
  freshly-`mkdtempSync`'d dir with no `writeHandoffState` seed), so there is
  no prevState for the stamp gate to read, or (b) is asserted synchronously
  (`assert.throws`) at the Zod-schema layer, which runs and can reject
  before the handler ever reaches storage/gate logic. Confirmed by reading
  every `updateStateTool.run`/`runTool` call site in both files.
- `handoff-write-arg-guard` — `mkWorkspace()` does raw-fs-seed a wall-clock
  `last_updated` (`new Date().toISOString()`, not through `writeHandoffState`),
  which looked like a genuine hit at first read. But every one of the 14
  tests explicitly sends its `tw_update_state` call via the spawned MCP
  server WITHOUT a prior `tw_get_state` in that server process (confirmed:
  zero `tw_get_state` calls anywhere in the file) — the in-memory pre-flight
  guard (`guards/session.ts enforcePreFlight`, which runs before the 18-step
  gate pipeline per `CLAUDE.md`'s documented guard order) therefore BLOCKS
  every call before `gates/stamp-provenance.ts` is ever reached. The file's
  own assertions are written to tolerate this: the AC-1 tests assert only
  "not rejected via the Zod path" (pre-flight rejection is explicitly
  documented as an acceptable outcome), and the AC-2/AC-3/AC-4/regression
  tests all assert an expected REJECTION (any rejection reason satisfies
  them) and/or "no corrupt write occurred" — none depend on the write being
  ACCEPTED end-to-end. Not susceptible by construction, independent of the
  seeded stamp's shape.
- `session` — zero `handleUpdateState`/`writeHandoffState`/`.run(` calls;
  only direct `enforcePreFlight(...)` unit tests. No gated write at all.
- `telemetry` — 4 `handleUpdateState` calls (NE1, INT1, THROW2×2), each on a
  brand-new `mkWorkspace()` with `.current/` created but no `handoff.md`
  ever written before the call (verified: no `writeHandoffState` import or
  call anywhere in the file). Fresh workspace ⇒ prevState is `(null, null)`
  ⇒ `STAMP_PROVENANCE_SUSPECT` is inert by construction (nothing on disk to
  read as a suspect stamp). Matches the dispatch brief's own reading.

No additional real hazard found beyond `e32-e33-gate-hardening`.

### Task 2b — multi-write / prior-accepted-write-as-prevState shape

Round 1 already closed this shape in `feature-lease.test.mjs` (E10-AC3:
`forceSeedStamp(ws, freshNonSuspectStamp())` inserted between write N's
acceptance and write N+1's dispatch). Checked whether any OTHER file in the
21-file candidate set has a test where one `handleUpdateState`/
`UPDATE_STATE_ENTRY.run` call's ACCEPTED result becomes a later call's
prevState in the same test body, with an intervening `resetSession`/
`markStateRead` pair (the shape that's fixable without breaking "no
intervening read" fidelity): none of the 21 files reviewed above contain
more than zero or one gated call per test (`e92-e86-handoff-write-boundary`'s
`updateStateTool.run` sites are each independent, on fresh/nonexistent
workspaces). No new instance of this sub-shape found outside what round 1
already fixed.

## Verification

- `npm run build`: clean. `tsc` 0 errors; `check:version` OK (3.112.0);
  `check:transitions-sync` OK (21 keys, exact match).
- `npm test`: **2104/2104**, 0 fail, 0 cancelled — exact count requested in
  the acceptance bar. Full log tail: `# tests 2104 / # pass 2104 / # fail 0`.
- Isolated re-run of the fixed file alone
  (`node --test test/e32-e33-gate-hardening.test.mjs`): **10/10** pass.
- `npm audit --audit-level=high`: exit 0. 6 findings, all moderate/low
  (`body-parser`, `esbuild`, `hono`, `protobufjs`, `qs`) — none HIGH/CRITICAL.
  `docs/dependency-advisories.md` tracks HIGH+ only; this round touched no
  `package.json`/`package-lock.json` (confirmed empty diff on both), so
  nothing new to record there.

## Scope check

`git status --short` shows only `test/e32-e33-gate-hardening.test.mjs`
modified by this round, plus this new `qa_reports/review_T-E148-02.md` and
the pre-existing coordinator routing writes to `.current/handoff.md` /
`tasks.md`. `gates/stamp-provenance.ts`, `content/`,
`scripts/verify-release.mjs`, and the E142/E146/E147 `docs/backlog.md` rows
are untouched (confirmed: `git diff` on each is empty / rows unchanged). No
stamp-override argument was added to any production code path — only the
test-layer `test/e148-seed-stamp.mjs` helper (round 1, reused verbatim here)
is used.

## Verdict

**PASS.**

— @qa-engineer (sonnet)
## 2026-09-18T07:32:45.096Z — PASS — by qa-engineer

PASS. T-E148-02 (round 2): fixed the one file round 1's case-sensitive grep missed — test/e32-e33-gate-hardening.test.mjs, whose seedFileState() seeded via writeHandoffState() with a wall-clock last_updated feeding 10 handleUpdateState() gated calls. Applied the round-1 helper (forceSeedStamp) matching e18-write-provenance.test.mjs's convention (fixed SAFE_SEED_STAMP, none of the 10 tests are lease-freshness-sensitive). Re-audited the full test/ tree case-insensitively for the general predicate (gated write against an uncontrolled-clock on-disk last_updated): 21 remaining candidates individually read and dispositioned in qa_reports/review_T-E148-02.md — none susceptible (comment-only mentions, dist-string checks, fresh/nonexistent-workspace calls, or handoff-write-arg-guard's pre-flight-blocks-before-stamp-gate structural immunity). No multi-write prior-accepted-write-as-prevState instances found beyond what round 1 already fixed in feature-lease.test.mjs. npm run build clean; npm test 2104/2104 (exact count matches acceptance bar); isolated re-run of the fixed file 10/10; npm audit --audit-level=high exit 0 (6 moderate/low findings, unrelated packages, no HIGH/CRITICAL, no dependency files touched). Scope clean: only test/e32-e33-gate-hardening.test.mjs changed; gates/stamp-provenance.ts, content/, scripts/verify-release.mjs, and E142/E146/E147 backlog rows untouched. Evidence: qa_reports/review_T-E148-02.md.

