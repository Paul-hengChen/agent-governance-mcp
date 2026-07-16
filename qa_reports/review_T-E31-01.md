# QA review — T-E31-01

Feature: `e31-config-nonfatal` (backlog E31, filed 2026-07-16 from the E22 QA
Phase 1 finding, qa_reports/review_T-E22-01.md). No `specs/e31-*.md` file
exists — content-scoped mini-chain (sr-engineer → code-reviewer →
qa-engineer) with the backlog row itself as spec, per E10/E17/E18/E20/E22-E26
precedent. Code review: APPROVED (recorded in handoff `pending_notes`, no
separate `review_reports/review_T-E31-01.md` — mini-chain convention) — zero
blocking findings, cache-correctness independently re-derived, two QA probes
flagged for explicit coverage/scope confirmation.

Shipped diff: `tools/config.ts` (`loadConfigEntry` non-fatal core +
`getConfigError()` export), `tools/handoff.ts` (`config_error` spread onto
both envelope shapes), `tools/stale-notify.ts` (adopts `getConfigError()`
instead of letting the old throwing `loadConfig` propagate).

## Expected-Red Diff

`qa_reports/expected-red_e31-config-nonfatal.txt` declares 6 entries — the
pre-E31 tests pinning the OLD throw behavior, expected to go red against the
fixed (non-fatal) code:

- `test/config-versioning.test.mjs | T31 AC-4: refuses-loud when on-disk schema_version > CURRENT`
- `test/config-versioning.test.mjs | T31 boundary: malformed JSON throws descriptive error`
- `test/config-versioning.test.mjs | T31 boundary: JSON array (non-object) is rejected`
- `test/e22-stale-notify.test.mjs | I7: corrupt (unparsable) .config.json + stale dispatch -> tw_get_state THROWS ...`
- `test/e22-stale-notify.test.mjs | I8: future-schema .config.json + stale dispatch -> tw_get_state THROWS ...`
- `test/e22-stale-notify.test.mjs | I7b/I8b — pre-existing-scope pin ...`

Ran the FULL suite BEFORE any re-baseline edit. Actual reds:
`not ok 114/117/118` (the three config-versioning entries) and
`not ok 380/381/382` (the three e22-stale-notify entries) — **exactly** the
6 manifested entries, 0 unexplained reds, 0 manifest entries that failed to
reproduce.

Phase 0.5: **clean (6/6 manifest entries confirmed red, 0 unexplained
reds)**. Proceeded to re-pin all 6 to the new non-fatal contract (see Phase 3
below) — this is a re-baseline of intentionally-red tests to a new server
contract (E31), not a regression.

## Phase 1 — Review

Re-derived (not merely copied) the code-reviewer's findings by reading
`tools/config.ts`'s `loadConfigEntry` in full and exercising it directly:

- **Never-throws holds for every fatality mode**: unreadable (stat error,
  non-ENOENT), unreadable (read error), unparseable JSON, non-object root
  (array), future `schema_version` — all five collapse to
  `{ config: {}, error: <message naming path + problem> }`, confirmed via
  `assert.doesNotThrow` wrapping `loadConfig()` for each, plus a message-content
  assertion that the config path and the specific failure appear in
  `getConfigError()`'s return.
- **Envelope purity holds**: clean/absent config never adds a `config_error`
  key on either envelope shape (`exists:true`/`exists:false`) — verified via
  `!("config_error" in parsed)`, a stricter check than a falsy-value
  comparison (catches an accidentally-emitted `config_error: null`/`""` that
  a falsy check would miss).
- **mtime-cache correctness holds**: a corrupt file's cached error clears on
  the very next call once the file is fixed (mtime bump invalidates the
  cache entry, per the code-reviewer's cache-correctness note); the inverse
  also holds — breaking a previously-clean file surfaces the error
  immediately on the next call, no stale-clean cache entry lingers.
- **QA Probe 1 (task-mutation tools silently fall back to defaults)**:
  independently reproduced. A workspace with a custom `taskPattern` +
  `taskPaths` parses correctly under a clean config; corrupting that SAME
  config makes the custom-format task file silently undiscoverable
  (`parseTasksFromFile` returns `null` — `DEFAULT_TASK_PATHS` doesn't include
  the custom path) without throwing. `completeTaskInFile` against the
  degraded workspace returns a loud `{error: "No task list file found."}`
  JSON response — never a throw, never a false-success, never a
  mis-completion of the wrong file. `addTaskInFile` against the degraded
  workspace silently creates the new task at `DEFAULT_TASK_PATHS[0]`
  (`.current/tasks.md`) instead of the workspace's configured custom path —
  confirmed the custom path is never touched. This matches the spec's
  "degrade to defaults loudly-but-readable" posture (the loudness lives at
  the `tw_get_state` envelope via `config_error`, not echoed by every
  downstream consumer of `loadConfig`) — by design, not a defect. Coverage
  added; behavior unchanged.
- **QA Probe 2 (post-cache chmod staleness) confirmed out of scope**: this is
  the pre-existing, acknowledged C18 limitation documented in
  `loadConfigEntry`'s comment block (a config that becomes unreadable via
  chmod AFTER a successful clean cache, with mtime unchanged, keeps serving
  the cached-good config with no `config_error` — only first-read-unreadable
  or content-derived failures are cached-and-surfaced). E31's target scenario
  (read-time corruption with no valid prior cache) is unaffected and is what
  the re-pinned + new tests cover. Not a regression, not fixed by this diff,
  correctly left alone.

## Phase 3 — Tests

Test File Discovery: `test/config-versioning.test.mjs` and
`test/e22-stale-notify.test.mjs` carry the 6 manifested pre-E31 tests
(re-pinned in place, same test names annotated `(re-pinned E31)` in their
descriptions); authored `test/e31-config-nonfatal.test.mjs` (14 new tests)
for the E31 contract's own coverage per the per-feature test file convention.

Spec (backlog row)-to-test map:
- loadConfig never throws on any config-file fatality → re-pinned T31 AC-4 /
  malformed-JSON / array-root (config-versioning.test.mjs); E31 error-message
  tests (unparseable / non-object / future-schema / unreadable-via-chmod)
- `config_error` surfaces on the tw_get_state envelope, never a throw →
  re-pinned I7/I8/I7b-I8b (e22-stale-notify.test.mjs)
- Clean/absent config leaves the envelope byte-identical (no key) → E31
  envelope-purity tests (4 tests, both envelope shapes)
- Error message names path + problem → E31 error-message tests (4 tests)
- mtime-cache invalidation (fix clears cache, break surfaces immediately) →
  E31 cache-invalidation tests (2 tests)
- QA Probe 1 (task-mutation tools fall back to defaults, documented) → E31
  QA-probe-1 tests (4 tests: baseline, corrupted-config discovery failure,
  completeTaskInFile loud error, addTaskInFile silent mis-target)
- QA Probe 2 — confirmed out of scope, not re-tested (see Phase 1)

Coverage: `tools/config.ts`'s `loadConfigEntry` non-fatal core is fully
covered across every branch (stat-error, read-error, parse-error,
non-object-root, future-schema, clean load, cache-hit, cache-invalidation);
`tools/handoff.ts`'s envelope-spread wiring covered on both shapes;
`tools/stale-notify.ts`'s `getConfigError()` adoption covered via the
re-pinned I7/I8 (notify.error surfaces alongside config_error, matching the
sr-engineer diff).

## Phase 4 — Run

- Confirmed the pre-edit baseline was EXACTLY the 6 manifested reds
  (`not ok 114/117/118/380/381/382`, 1567 pass / 6 fail / 1573 total) via a
  throwaway full-suite run before any test edit.
- Build: `npm run build` (`tsc`) — zero errors.
- `npm test` / `node --test test/*.test.mjs`: **1587/1587 pass**, 0 fail, 0
  cancelled, headless, zero human interaction (1567 pre-existing baseline +
  6 re-pinned to new assertions, same count + 14 new
  `test/e31-config-nonfatal.test.mjs` tests).

## Verdict

PASS. loadConfig never throws on corrupt/unparseable/unreadable/non-object/
future-schema `.current/.config.json` under direct exercise across every
fatality mode; `config_error` surfaces on both `tw_get_state` envelope shapes
and is byte-identical-absent on clean/absent config; the mtime cache
self-heals on fix and re-triggers on breakage; QA Probe 1 (task-mutation
tools silently falling back to `DEFAULT_TASK_PATHS`/`DEFAULT_TASK_REGEX`)
reproduced and explicitly covered as documented by-design behavior, not a
defect; QA Probe 2 (post-cache chmod staleness) confirmed as the pre-existing
acknowledged C18 limitation, correctly out of scope and untouched. Expected-
Red Diff clean (6/6 manifest entries confirmed red pre-edit, 0 unexplained
reds) before re-pinning to the new contract. Full suite 1587/1587 green,
`tsc` zero errors.

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-07-16T07:54:13.820Z — PASS — by qa-engineer

PASS — T-E31-01 (E31 non-fatal loadConfig). Pre-flight: tw_get_state read code-reviewer's pending_notes (APPROVED + both QA probes) before starting.

Re-pinned the 6 manifested expected-red tests (qa_reports/expected-red_e31-config-nonfatal.txt) to the new contract:
- test/config-versioning.test.mjs: T31 AC-4 (future schema_version 99), malformed-JSON, JSON-array-root — each now asserts loadConfig() returns {} with assert.doesNotThrow, and getConfigError() carries a message naming the config path + the specific problem (schema version numbers / "Failed to parse" / "must be a JSON object").
- test/e22-stale-notify.test.mjs: I7 (corrupt config + stale dispatch), I8 (future-schema + stale dispatch), I7b/I8b (bare workspace, no stale dispatch at all) — each now asserts readHandoffState() returns a normal envelope (exists:true or exists:false) carrying config_error, never throws; I7/I8 additionally confirm the underlying stale_dispatch advisory still fires with its own notify.error (via stale-notify.ts's getConfigError() short-circuit). Updated the file's header comment block to stop describing the old throw behavior as current.

New coverage authored in test/e31-config-nonfatal.test.mjs (14 tests) for gaps the re-pins didn't reach:
- Envelope purity: absent config and clean/valid config both produce zero config_error key on both exists:true and exists:false shapes (byte-identical to pre-E31, verified via `!("config_error" in parsed)`, not just falsy-check).
- Error-message content: unparseable JSON / non-object array root / future schema_version / unreadable-via-chmod (skipped under root) each assert getConfigError() names the exact config path AND the specific problem.
- mtime-cache invalidation: fixing a corrupt config file clears the cached error on the next call (self-heals without restart); conversely breaking a previously-clean file surfaces the error on the very next call after the mtime bump.
- QA Probe 1 (code-reviewer, non-blocking, documented not fixed): a workspace with custom taskPattern+taskPaths parses correctly under a clean config (baseline); corrupting that SAME config makes the custom task file silently undiscoverable (falls back to DEFAULT_TASK_PATHS, parseTasksFromFile returns null, never throws) while getConfigError() still surfaces the failure for tw_get_state to report; completeTaskInFile against the degraded workspace returns a loud {error: "No task list file found."} JSON response (never throws, never mis-completes); addTaskInFile against the degraded workspace silently targets DEFAULT_TASK_PATHS[0] (.current/tasks.md) instead of the configured custom path. This documents the by-design behavior per code-reviewer's probe; not a defect, not fixed.
- Probe 2 (post-cache chmod staleness) confirmed out of scope: pre-existing acknowledged C18 limitation, verified unchanged by this diff, not re-tested.

Verification: npm run build (tsc) zero errors. npm test: 1587/1587 pass, 0 fail (1567 pre-existing baseline + 6 re-pinned to new assertions + 14 new E31 tests). Confirmed the pre-fix baseline was exactly the 6 manifested reds (not ok 114/117/118/380/381/382) before editing, via a throwaway pre-edit run.

Files touched: test/config-versioning.test.mjs, test/e22-stale-notify.test.mjs, test/e31-config-nonfatal.test.mjs (new), dist/ rebuilt. No production code changed by QA (tools/config.ts, tools/handoff.ts, tools/stale-notify.ts were sr-engineer's diff, already code-reviewer APPROVED). Not committed — commit is a post-PASS coordinator/human step. next_role intentionally omitted (release is a human decision).

## 2026-07-16T07:55:55.810Z — PASS — by qa-engineer

PASS — T-E31-01 (E31 non-fatal loadConfig). Full evidence in qa_reports/review_T-E31-01.md: Phase 0.5 Expected-Red Diff clean (6/6 manifest entries confirmed red pre-edit, 0 unexplained reds) before re-pinning test/config-versioning.test.mjs (T31 AC-4/malformed-JSON/array-root) and test/e22-stale-notify.test.mjs (I7/I8/I7b-I8b) to the new non-fatal contract (loadConfig returns {} + getConfigError() names path+problem, no throw; tw_get_state envelope carries config_error). Authored test/e31-config-nonfatal.test.mjs (14 new tests): envelope purity (no config_error key on clean/absent config, both envelope shapes), error-message content (4 fatality modes), mtime-cache invalidation (fix clears cache, break re-triggers), QA Probe 1 (task-mutation tools silently fall back to DEFAULT_TASK_PATHS/DEFAULT_TASK_REGEX under a corrupt config — reproduced and documented as by-design, not fixed). QA Probe 2 (post-cache chmod staleness) confirmed as the pre-existing acknowledged C18 limitation, correctly out of scope. Verification: npm run build zero errors; npm test 1587/1587 pass, 0 fail. Not committed — commit is a post-PASS coordinator/human step. next_role intentionally omitted (release is a human decision).

