# QA review — T-E22-01

Feature: `e22-stale-notify` (backlog E22, D5 follow-on / 104447-F0 A3). No
`specs/e22-*.md` or `design/e22-*.md` file exists — this is a content-scoped
mini-chain (sr-engineer → code-reviewer → qa-engineer) with the backlog row
itself as spec, per E10/E17/E18/E20/E23/E24/E26 precedent. Implementation
commit: `34ef7d5`. Code review: APPROVED (`review_reports/review_T-E22-01.md`)
— zero blocking findings, one non-blocking "QA awareness" note on a
corrupt/future-schema-config vector.

Shipped diff: `tools/stale-notify.ts` (new, `notifyStaleDispatch()` — opt-in
watch-file emit on the v10 `stale_dispatch` threshold crossing), `tools/config.ts`
(`staleDispatchNotifyFile` additive-optional field, non-fatal string filter),
`tools/handoff.ts` (wiring at the existing read-time stale-dispatch computation),
`docs/config.md` (key documented + verify steps + example watcher).

## Expected-Red Diff

Phase 0.5: skipped (no `qa_reports/expected-red_e22-stale-notify.txt` manifest
declared — this feature introduces a new opt-in emit path, not a re-baseline
of existing assertions).

## Phase 1 — Review

Read `tools/stale-notify.ts`, the `tools/handoff.ts` wiring, and the
`tools/config.ts` filter in full; independently exercised the code (not just
read it) against every failure mode named in the review focus, plus the
dispatch task's explicit vector list. Cross-checked against code-reviewer's
APPROVED findings — re-derived, not merely copied:

- **Opt-in / disarmed byte-identical holds**: absent `.config.json`, and a
  valid config that simply lacks the key, both return `null` from
  `notifyStaleDispatch` and produce a `stale_dispatch` object with exactly the
  5 pre-E22 fields (`role`, `dispatched_at`, `elapsed_minutes`,
  `threshold_minutes`, `message`) — no `notify` key at all, confirmed via
  `Object.keys()` equality, not just presence/absence (tests U1, U2, I1, I2).
  An empty-string key value is also correctly filtered to absent by
  `config.ts`'s non-empty-string guard (U3).
- **Armed emit is correct and atomic**: payload carries the advisory fields +
  `workspace` + a valid ISO `emitted_at`; the tmp-then-rename publish leaves
  zero `.tmp` files behind; an absolute configured path is honored via
  `path.resolve` rather than re-rooted under the workspace (U4, U5, I3).
- **Dedupe cursor is exactly `(dispatched_at, role)`, cursor lives in the
  watch-file**: an identical pair is skipped (`skipped_duplicate: true`, file
  mtime unchanged); a fresh `dispatched_at` OR a different `role` at the same
  timestamp both re-arm the emit (the pair is the key, not either field
  alone); hand-deleting the watch-file forces a fresh emit even for the
  identical pair — fails toward notification, never toward silence (U6-U9,
  I4, I5). Confirmed at the end-to-end `tw_get_state` level, not just the
  unit level.
- **Not-stale + armed → no notify at all**: notify never fires independently
  of the underlying `stale_dispatch` advisory (I6) — confirms the emit rides
  the existing threshold check rather than adding a second trigger.
- **Never-throws holds at the `notifyStaleDispatch` unit level** across every
  adversarial input: corrupt JSON config, future-schema config
  (`schema_version` above server max), a corrupt/non-object prior watch-file,
  an unwritable parent directory, and the configured path itself being an
  existing directory (rename-onto-directory failure) — all collapse to a
  loud `error` string, `emitted: false`, never a throw (U10-U15, I9).

### Correctness finding — escalated, non-blocking (not a T-E22-01 FAIL basis)

Independently verifying the code-reviewer's flagged vector ("a config that
exists but is corrupt / on a future schema... will newly surface
`stale_dispatch.notify.error` even when E22 was never armed") surfaced that
**this specific claim does not hold** — the actual behavior is worse than
described, but the cause is pre-existing and outside this diff's blast
radius:

- `readHandoffState` (`tools/handoff.ts`) calls `markStateRead` →
  `findTasksFile` → `resolveTaskPaths` → `loadConfig` for **task-path
  resolution** *before* the `stale_dispatch`/notify computation is ever
  reached. That earlier `loadConfig` call throws uncaught on corrupt or
  future-schema `.config.json`, so the entire `tw_get_state` pre-flight read
  throws — it never gets far enough to produce a `notify.error`. Tests I7/I8
  pin the true observed behavior (a throw with the exact error message), not
  the review doc's claim.
- Confirmed this is **orthogonal to and predates the E22 diff**: test I7b/I8b
  reproduces the identical throw on a bare workspace with no `handoff.md` and
  no stale dispatch involved at all — a corrupt `.config.json` alone already
  breaks `tw_get_state`, independent of anything E22 added.
  `git diff HEAD~1 HEAD -- tools/config.ts` confirms the E22 hunk only *adds*
  the `staleDispatchNotifyFile` field parser; the pre-existing throwing
  statements (`Failed to parse ...` / `on-disk version N > server max`) are
  untouched by this commit.
- Net assessment: `notifyStaleDispatch()` itself correctly implements its own
  never-throws contract in isolation (U10, U11 call it directly against the
  same corrupt/future-schema fixtures and it returns a loud error, no
  throw). The gap is a **different, pre-existing `loadConfig` call site**
  (session-guard task-path resolution) that the E22 diff did not introduce
  and is not responsible for fixing. Per SOP scope (§ QA rejects only for
  failing tests / missing AC coverage / test-infra defects; correctness
  issues the code-reviewer missed get surfaced and escalated, not FAILed),
  this is escalated to code-reviewer/pm as a follow-up-worthy finding — the
  `tw_get_state` pre-flight action can be broken entirely by ANY corrupt
  `.config.json`, regardless of E22 — but it is **not grounds to FAIL
  T-E22-01**, since the diff under review neither introduces nor worsens it.

## Phase 3 — Tests

Test File Discovery: no pre-existing test file covered this feature; authored
`test/e22-stale-notify.test.mjs` (26 tests) per the per-feature test file
convention (`test/e24-exemptions.test.mjs`, `test/e26-gate-stats.test.mjs`,
`test/stale-dispatch-detection.test.mjs` precedent — the last of which this
suite deliberately reuses the raw-fixture `writeRaw`/`isoMinutesAgo` pattern
from, to model a fresh/post-compaction session with zero in-process memory).

Spec (backlog row)-to-test map:
- Opt-in / key-absent = fully disarmed, byte-identical pre-E22 payload →
  U1, U2, U3, I1, I2
- Armed emit on threshold crossing, correct payload, atomic tmp+rename
  publish, absolute-path honored → U4, U5, I3
- Dedupe: one emit per `(dispatched_at, role)`, cursor lives in the
  watch-file, re-arm on fresh dispatch/role, fresh emit after
  hand-deletion → U6, U7, U8, U9, I4, I5
- Armed-but-not-stale ⇒ no notify at all (rides the existing threshold
  check, not a second trigger) → I6
- Never-throws on the pre-flight read path: corrupt config, future-schema
  config, corrupt/non-object prior watch-file, unwritable directory,
  directory-as-target → U10, U11, U12, U13, U14, U15, I9
- File-mode only / no new handoff state / no schema bump → S1 (sanity pin
  on `CURRENT_VERSIONS`)
- Code-reviewer's flagged corrupt/future-schema-config vector → I7, I8,
  I7b/I8b (independently verified NOT to match the review doc's
  characterization; see the Phase 1 finding above)

Coverage: `tools/stale-notify.ts` is fully covered — every branch of
`notifyStaleDispatch` (disarmed-null, dedupe match/skip, read-back failure
paths, mkdir/write/rename failure paths, success path) and both
`tools/handoff.ts` wiring branches (disarmed spread, armed spread) via the
end-to-end `readHandoffState` tests.

Security smoke: U10-U15/I7-I9 exercise adversarial/malformed input at the
config + prior-watch-file trust boundary (bad JSON, wrong schema version,
non-object JSON, unwritable directory, directory-as-file collision) and
confirm the notify layer itself never throws or corrupts the advisory. No
auth/permission surface — file-mode-only, workspace-owned path, same trust
boundary as `taskPaths` (per code-reviewer's Security finding, independently
confirmed).

## Phase 4 — Run

- Crash checkpoint written via `tw_update_state(bookkeeping_write=true)`
  before the final regression run (E21).
- Build: `npm run build` (`tsc`) — zero errors.
- `npm test` / `node --test test/*.test.mjs`: **1573/1573 pass** (1547
  pre-existing baseline + 26 new `test/e22-stale-notify.test.mjs` tests), 0
  fail, 0 cancelled, headless, zero human interaction.
- `npm audit --audit-level=high`: exit 0, zero high/critical findings (one
  pre-existing low-severity `esbuild` dev-server advisory, unrelated to this
  feature and below the audit-level threshold).

## Verdict

PASS. The E22 opt-in stale-dispatch watch-file notify emit matches its spec
under direct exercise: disarmed byte-identical (no `notify` key, verified by
exact key-set equality, not mere absence-checking), armed emit correct and
atomically published, dedupe cursor exactly `(dispatched_at, role)` with
re-arm on either field changing and fresh-emit-after-hand-deletion, and
`notifyStaleDispatch()`'s own never-throws contract holds under every
adversarial input at the unit level. One non-blocking correctness finding
escalated to code-reviewer/pm: the code-reviewer's specific claim about the
corrupt/future-schema-config + stale-dispatch vector does not match observed
behavior (the read throws entirely, via a pre-existing and unmodified
task-path `loadConfig` call site, rather than gracefully surfacing
`notify.error`) — verified to predate and be orthogonal to the T-E22-01 diff,
so it is not a basis for failing this task. Full suite 1573/1573 green,
`tsc` zero errors, `npm audit --audit-level=high` clean.
## 2026-07-16T07:20:38.697Z — PASS — by qa-engineer

PASS. Authored test/e22-stale-notify.test.mjs (26 tests): disarmed byte-identical envelope (exact key-set equality, no notify key), armed emit content + atomic tmp+rename publish, dedupe cursor exactly (dispatched_at, role) with re-arm on either field and fresh-emit-after-hand-deletion, never-throws matrix at the notifyStaleDispatch unit level (corrupt/future-schema config, corrupt/non-object prior watch-file, unwritable dir, dir-as-target). Escalating one non-blocking correctness finding to code-reviewer/pm (not a FAIL basis, verified pre-existing and orthogonal to this diff): the review doc's claim that corrupt/future-schema config + stale dispatch "surfaces stale_dispatch.notify.error" is factually wrong — tw_get_state actually THROWS entirely via a pre-existing, unmodified task-path loadConfig call site (guards/session.ts -> findTasksFile) that runs before notify is ever reached; reproduces even on a bare workspace with no stale dispatch at all (tests I7/I8/I7b-I8b). Full suite 1573/1573 green (1547 baseline + 26 new), npm run build zero errors, npm audit --audit-level=high clean. Evidence: qa_reports/review_T-E22-01.md.

