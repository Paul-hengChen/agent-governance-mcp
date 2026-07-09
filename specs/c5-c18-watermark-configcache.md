# c5-c18-watermark-configcache

Source: `docs/backlog.md` §C5 — "Watermark toolchain defects" (P2, observed
2026-07-06) + §C18 — "configCache never invalidates; post-release baseline
appends are invisible until restart" (P3, observed 2026-07-09; C4 follow-on).
Batched per the execution-order row 4 note: "one small-code-fix batch:
watermark replace-not-append + template tier; config-cache mtime
invalidation — both ~1-file fixes, single QA round."

Note on naming: the human's original request said "C15+C18"; C15
(expected-red manifest convention) already shipped in v3.57.0
(`6ba0386`, 2026-07-10). The open row-4 batch pairs C5 with C18, so this
feature covers C5+C18, not C15+C18. Surfaced to the human by the
coordinator before this spec was drafted.

## Re-verification against current code (2026-07-10)

Both items were filed 2026-07-06/09; re-read the live files before cutting
to confirm the defects are still present and scoped as described.

- **C5(a)** confirmed live: all 14 `templates/claude-code-agents/*.md` files
  hardcode the tier in the `CRITICAL:` reminder line, e.g.
  `templates/claude-code-agents/sr-engineer.md:7` reads `CRITICAL: End every
  reply with `— @sr-engineer (opus)` per Constitution §1 (watermark).` A
  dispatch-time override (e.g. `dispatch_pins: {"sr-engineer": "fable"}`,
  in active use on the current handoff) means the template's own reminder
  tells the model to stamp the WRONG tier.
- **C5(b)** confirmed live: `lib/watermark-check.ts` `validateWatermark`
  (lines 110–116) — when the last line matches `WATERMARK_REGEX` (a
  watermark IS present) but `actualName`/`actualTier` don't match the
  expected pinned values, it falls through to `return { present: false,
  corrected: reply + "\n" + watermark }` — i.e. it APPENDS the correct
  watermark after the wrong one instead of replacing it, producing two
  trailing `— @...` lines. The absent-watermark branch (line 96, same
  concat) is correct as-is and must not change.
  Also confirmed: `content/skill-coordinator.md:174` ("Correction
  strategy") currently documents this as "append the canonical suffix" for
  BOTH the absent and mismatched cases — this line will become inaccurate
  once the mismatched-branch behavior changes to strip-then-append, so it
  is in scope as a doc-sync edit (small, same file family as the rest of
  the coordinator SOP's watermark section already read for this spec).
  ~~fable tier-enum addition~~ — already shipped via A13 (2026-07-08); not
  in this scope.
- **C18** confirmed live: `tools/config.ts` `configCache` (module-level
  `Map<string, WorkspaceConfig>`, line 41) is set-once, read-many with no
  invalidation path — `loadConfig()` returns the cached entry on any hit
  regardless of on-disk changes. `content/skill-release-engineer.md:59`
  (SOP step 10, "Drift-baseline acknowledgment") already documents the
  *symptom* mitigation (append `driftBaselineIds` post-PASS) but not the
  fact that within a single long-lived server process the append is
  invisible to `tw_detect_drift` until the process restarts, because
  `loadConfig` never re-stats the file.

No drift from the backlog framing on either item — both fixes are exactly
as scoped, no re-scoping needed.

## Fix design

### C5(a) — de-hardcode tier in agent templates

Rephrase the `CRITICAL:` line in all 14
`templates/claude-code-agents/*.md` files from a hardcoded tier to an
instruction to stamp whichever tier the dispatch actually pinned, e.g.:

```
CRITICAL: End every reply with `— @<role> (<the model tier you were actually invoked with>)` per Constitution §1 (watermark).
```

using the file's own role name for `<role>` (not literally the string
`<role>`). This keeps the frontmatter `model:` field as the *default*
expectation (used by `validateWatermark` when no `dispatch_pins` entry
exists) while making the in-context reminder tier-agnostic so a
`dispatch_pins` override doesn't fight the subagent's own instructions.
No change to frontmatter `model:` values — those remain the default tier
per role.

### C5(b) — strip-then-append on mismatch, not double-stamp

In `lib/watermark-check.ts` `validateWatermark`, when a watermark IS
present (`WATERMARK_REGEX` matches the last non-empty line) but
name/tier don't match expected, strip that trailing watermark line from
`reply` before appending the canonical one — mirroring how the function
already isolates "last non-empty line" for detection. Do not touch the
absent-watermark branch (line ~96) or the present-and-matching branch
(returns unchanged). Idempotency and purity properties (stated in the
file's docstring) must still hold: calling `validateWatermark` twice on a
`corrected` mismatched-input result must yield `present: true` on the
second call, with exactly one watermark line, not two.

Also update `content/skill-coordinator.md`'s "Correction strategy" line
(~174) to describe the two cases distinctly: absent → append; present-but-
mismatched → replace (strip wrong trailing line, append canonical) — so
the SOP prose matches the corrected implementation.

### C18 — mtime-based cache invalidation

In `tools/config.ts`, change `configCache` to also record the config
file's `mtimeMs` (or store `{ config: WorkspaceConfig, mtimeMs: number |
null }`, `null` meaning "file did not exist at cache time"). On each
`loadConfig()` call:
1. `fs.statSync(configPath)` (or `existsSync` + `statSync`) to get current
   mtime, tolerating ENOENT (file may not exist, or may have just been
   created since the last miss).
2. If a cache entry exists AND its recorded mtime matches the current
   file state (both absent, or both present with equal `mtimeMs`), return
   the cached value — unchanged fast path.
3. Otherwise (no entry, or mtime differs, or existence flipped), fall
   through to the existing read/parse/migrate logic and refresh the cache
   entry with the new mtime.

Backlog explicitly prefers this over a `drift.ts`-side cache bypass
(forking config-read behavior); implement only the `tools/config.ts`
change. One extra `stat` call per `loadConfig()` invocation is the
accepted cost (read is already lazy per call site, per the backlog note).

Then add one line to `content/skill-release-engineer.md` SOP step 10
(near line 59) noting that once the cache honors mtime, the
`driftBaselineIds` append (this same step) takes effect immediately for
any `tw_detect_drift` call in the same process — no restart needed.

## Acceptance Criteria

- AC-1: All 14 files under `templates/claude-code-agents/*.md` have their
  `CRITICAL:` reminder rephrased to reference "the model tier you were
  actually invoked with" (or equivalent tier-agnostic phrasing) instead of
  a hardcoded tier string; frontmatter `model:` fields unchanged.
- AC-2: `validateWatermark(reply, name, tier)` on a reply whose last line
  is a watermark with a WRONG name or tier returns `corrected` with
  exactly one trailing watermark line (the canonical one) — no double
  watermark. Existing absent-watermark and matching-watermark behaviors
  are unchanged (regression-covered by existing tests in
  `test/watermark-check.test.mjs`).
- AC-3: `content/skill-coordinator.md`'s Correction-strategy prose
  distinguishes "absent → append" from "mismatched → replace", matching
  AC-2's implementation.
- AC-4: `loadConfig(workspacePath)` reflects an on-disk `.config.json`
  change (e.g. an appended `driftBaselineIds` id) within the SAME process,
  without requiring cache eviction via restart — verified by a test that
  writes a config, calls `loadConfig`, mutates the file's content AND
  mtime, calls `loadConfig` again, and asserts the second call sees the
  new content.
- AC-5: `loadConfig` behavior when the config file does not exist, then is
  created, then is deleted again, is still correct (no crash, no stale
  positive/negative caching across existence transitions).
- AC-6: `content/skill-release-engineer.md` SOP step 10 gains a one-line
  note that the `driftBaselineIds` append is now immediately visible to
  `tw_detect_drift` in the same process (no restart needed).
- AC-7: `npm run build && npm test` green.

## Out of Scope

- Any change to `fable` or other tier-enum membership in Constitution §1
  (shipped via A13).
- `drift.ts` cache-bypass alternative for C18 (explicitly deprioritized by
  the backlog in favor of the mtime check).
- C16/C10 role-boundary work (separate, already-in-flight feature
  `c16-c10-role-boundary`).

## Owner

/teamwork — `lib/watermark-check.ts`, `templates/claude-code-agents/*.md`,
`content/skill-coordinator.md`, `tools/config.ts`,
`content/skill-release-engineer.md` + tests. Small, single-feature,
single QA round per backlog framing.
