# Review — T-D5-04

covers: T-D5-04

Clean-context adversarial review of the full D5 diff (T-D5-01/02/03, uncommitted
working tree; baseline = HEAD `c1e8147`). Judged against
`specs/d5-server-side-stale-dispatch-detection.md` (AC-1..AC-10) and
`specs/d5-server-side-stale-dispatch-detection-architecture.md` (DR-1..DR-8).

## Summary

- Adds one server-stamped `dispatched_at?: string` handoff field (v9→v10) plus a
  read-time `stale_dispatch` advisory on `tw_get_state` — 5 source files changed
  (`tools/handoff.ts`, `schema/migrations-handoff.ts`, `schema/versions.ts`,
  `docs/schema-versions.md`, `content/skill-coordinator.md`), plus the untracked
  spec/arch/manifest. dist rebuilt.
- The stamp is a pure additive companion to `next_role`: single-sourced in
  `writeHandoffState` on the identical `if (nextRole)` predicate and the same
  `now` as `last_updated` (DR-2). Every constraint file the blueprint pinned as
  untouched — `handoff-orchestrator.ts`, `storage-sqlite.ts`, `gates/registry.ts`,
  `transitions.ts`, `config.ts`, `index.ts`/zod — is byte-for-byte unchanged.
- No new `GateErrorCode`, no write ever blocked; the advisory is read-only and
  cannot throw (DR-6). Storage-scope is file-mode-only by construction (DR-5).
- Skill prose (Escalation Routes row, Crash-detection pointer clause, Crash-Resume
  step 0 + intro) matches the blueprint Interface Contracts verbatim (AC-7).
- Expected-red manifest sampled across all 4 class blocks — every sampled entry is
  a real, locatable test failing on the v10 bump / prose-growth ratchet, not a
  masked product defect.
- **Verdict: APPROVED.**

## Correctness

No findings. Verified against every task-row checklist item:

- **Stamp single-sourced, same `now` as `last_updated`** — `tools/handoff.ts:718`
  (`const now`), `:740` (`last_updated: now`), `:870`
  (`if (nextRole) frontmatterData.dispatched_at = now`). Smoke-confirmed
  `dispatched_at === last_updated` on a real options-object write (AC-1).
- **Transient lifecycle mirrors `next_role`** — the stamp keys on the same
  this-write `nextRole` local (positional overload leaves it `undefined`,
  `:663-666`), so an omitting write drops it and a re-dispatching write re-stamps
  it. Smoke-confirmed: omit-`nextRole` write ⇒ `dispatched_at` gone; feature-change
  write omitting `nextRole` ⇒ no bleed (AC-3, AC-6). AC-6 holds *a fortiori* — the
  every-write-scoped drop is strictly stronger than the `dispatch_pins`
  feature-scoped reset; no `active_feature`-comparison code was added, correctly.
- **Heal-write drops the stamp** — the migration heal-write (`:449-467`) passes 12
  positional args (no `nextRole`), so it omits `dispatched_at`; matches the
  architecture "migration-boundary note" (a v9 file carrying a live `next_role`
  loses it on heal — pre-existing v7 transient behavior, nothing to detect anyway).
- **Read-path advisory** — `tools/handoff.ts:525-543`. Fires only when both
  `state.next_role` and `state.dispatched_at` are present, `Date.parse` is finite,
  and `elapsedMin` is **strictly** `> 15`. Smoke-confirmed: fresh stamp → no key;
  16-min stamp → fires; malformed `"not-a-date"` → inert, no throw; omit → no key.
  Message string is verbatim to the spec Copy row
  (`stale in-flight dispatch: <role>, no state write for >15 min`), and the object
  shape is exactly `{role, dispatched_at, elapsed_minutes (floored),
  threshold_minutes, message}` (AC-2, AC-4, AC-5). It is a bare synchronous compute
  with no I/O — it can never throw or block a read.
- **v9→v10 migration seeds nothing** — `schema/migrations-handoff.ts:122-127`
  (`up: (input) => ({ ...input, schema_version: 10 })`), `schema/versions.ts:8`
  (`handoff: 10`). Absence-is-signal, not `hop_count`'s seed-0 (DR-7). Confirmed the
  compile-time missing-step guard reference remains intact below the new step.

## Quality

No blocking findings. Two benign observations (no change requested):

- The `dispatched_at` field comment (`tools/handoff.ts:124-130`) and the read/write
  inline comments are consistent with the surrounding `next_role` precedent prose;
  naming and placement match convention.
- **Non-issue, noted for the record:** js-yaml auto-parses the unquoted ISO
  timestamp back into a `Date` on read, so `asString` renders the surfaced
  `dispatched_at` in locale form rather than the ISO string written. This is
  **pre-existing behavior identical to `last_updated`** (the smoke confirmed
  `dispatched_at === last_updated`), it round-trips through `Date.parse` cleanly so
  the advisory computes correctly, and it is not introduced or worsened by D5. No
  action.
- The expected-red manifest header prose says "32 reds total, three classes" — it
  was authored at T-D5-01 and predates the T-D5-03 4th class block appended below
  it (making 33 entries / 4 blocks, which is what the file actually contains and
  what the task checklist expects). Cosmetic stale-comment only; the machine-read
  `file | test name` pairs are all correct.

## Architecture

No findings. The implementation honors every pinned decision:

- **DR-2** stamp in `writeHandoffState`, orchestrator untouched — confirmed
  `tools/handoff-orchestrator.ts` has zero diff.
- **DR-4** fixed constant `STALE_DISPATCH_THRESHOLD_MIN = 15`
  (`tools/handoff.ts:177`), not config-driven — `tools/config.ts` untouched.
- **DR-5** file-mode-only by construction — `tools/storage-sqlite.ts` untouched;
  the advisory needs both `next_role` and `dispatched_at`, neither of which the
  SQLite backend persists.
- **DR-6** no gate — `gates/registry.ts` and `tools/transitions.ts` untouched; the
  `GateErrorCode` union is unchanged; no telemetry event added.
- **DR-7** v9→v10 stamp-only, seeds nothing.
- **AC-8** — `next_role`, `hop_count`, `qa_round`/`review_round`/`visual_round`,
  `dispatch_pins`, `cut_approved`, `external_refs` write/gate semantics are all
  byte-identical; the only additions are additive lines guarded by the pre-existing
  `if (nextRole)` predicate. No existing logic path was modified.
- Skill prose (`content/skill-coordinator.md`) — the Stale-dispatch detection
  Escalation Routes row, the "(fresh-session counterpart…)" pointer clause on the
  Crash detection row, the "BOTH … route here" intro rewrite, and the Crash-Resume
  step 0 all match the blueprint's Interface Contracts (a)/(b)/(c) verbatim (AC-7).

## Security

No findings. `dispatched_at` is server-derived from `now()`, never client-supplied
(no new `tw_update_state` arg, no zod-schema change). The read-path advisory is a
pure computation over already-persisted state plus the wall clock; it introduces no
new input crossing a trust boundary, no injection vector, and no secret. A malformed
on-disk stamp is defused by the `Number.isFinite` guard rather than propagated.

## Performance

No findings. The write adds one string assignment; the read adds one `Date.parse` +
arithmetic behind a two-field presence guard — both O(1), no I/O, no new allocation
in any hot path. No algorithmic regression versus base.

## Expected-Red Sampling (SOP 4a)

`qa_reports/expected-red_d5-server-side-stale-dispatch-detection.txt` exists (33
`file | test name` entries, 4 class blocks). Sampled one entry per class block by
grepping the named file for the named test string — all real and locatable, all
genuinely re-baseline-class:

1. `test/dispatch-pins.test.mjs` → `sanity: CURRENT_VERSIONS.handoff is 9` (line
   803) — hardcoded v9 assertion, now fails on the v10 bump. Re-baseline.
2. `test/handoff-versioning.test.mjs` → `AC-4: readHandoffState refuses-loud when
   on-disk schema_version > CURRENT` (line 190) / `test/handoff-migration.test.mjs`
   → `AC-10(g): future v10 handoff refuses-loud …` (line 463) — v10 was the
   "future" fixture; now v10 is CURRENT, so the fixture must move to v11.
   Re-baseline.
3. `test/cut-approval-gate.test.mjs` → `M1: v4 → v5 migration is stamp-only` (line
   401) — `_clearRegistryForTests` fixture that re-registers only steps ≤ v9; reads
   now demand the v9→v10 step. Re-baseline.
4. `test/context-budget.test.mjs` → `AC8/AC-P2-7: teamwork coordinator bundle
   (design-arm, both strips) is at/below the floor` (line 911) — actual assertion is
   `bundle <= 13046` (line 1058); D5's skill-coordinator.md prose additions push it
   to 13298 (+252). Genuine qa-owned prose-growth ratchet, not a product defect.

No entry sampled masks a real regression; qa-engineer owns the fixture/floor
re-baseline in T-D5-05.

## Verdict

**APPROVED** — the dispatch stamp is a faithful transient companion to `next_role`
with zero behavior change to any existing field (AC-8); the staleness signal is
read-only/advisory and can never block or throw (AC-2, DR-6); storage-scope is
file-mode-only as pinned (AC-9, DR-5); feature-scoped reset holds *a fortiori*
(AC-6); skill prose matches the blueprint verbatim (AC-7); and the expected-red
manifest is legitimate re-baseline data. No findings in any category.
