# Review — T-E223-01

## Summary
- `tools/lane-status.ts`: `parseWatchBaseline` gains `opts.unknownIsGone` — under the default watch set, an unknown `--baseline` key is kept in the returned map (in `--baseline` order) instead of throwing; `watchLoop` passes `unknownIsGone=!named`, computes `goneKeys` (unknown keys not in the current watched set) and prints `[<lane>] gone` for each, once, after the watched-lane start lines.
- Gone keys are excluded from `armed: watching <N> lane(s)` (N derived from `keys`, unaffected) and from `last` (never `.set()`), so the next re-arm `--baseline` — built from `last` — omits them (AC3/decision e).
- `--lanes` path unaffected: `unknownIsGone` is `false` when `named` is set, so an unknown named key still throws `WatchUsageError` (exit 64, AC4); `goneKeys` is forced to `[]` under `--lanes`.
- Validation ordering, repeated-key, malformed-entry, bad-fingerprint and empty-value checks are unchanged and still run before any output (AC5) — the repeated-key check (`result.has(k)`) fires regardless of `unknownIsGone`, so a repeated gone key still throws.
- Scope matches `tasks.md` T-E223-01 exactly: no test files touched (T-E223-02, qa-engineer, depends_on this task), no `specs/e178b-lane-watch-tooling.md` edit, no `scripts/lane-status.mjs` change, `dist/tools/lane-status.*` rebuilt with zero drift from source.
- Verdict: **APPROVED**.

## AC Completeness
- AC1 — implemented — `tools/lane-status.ts:1570` (`unknownIsGone: !named` keeps `zeta` in `baselines`), `:1574` (`goneKeys` computed, excluded from `keys`), `:1590` (`armed:` line uses `keys.length`), `:1591-1595` (loop prints watched-lane start lines) + `:1596` (loop prints `[zeta] gone` after them). Order matches the spec (armed → watched-lane lines → gone lines).
- AC2 — implemented — `goneKeys` is `[...baselines.keys()].filter(...)` (`tools/lane-status.ts:1574`); `Map` preserves insertion order from the `--baseline` string split, so multiple gone keys print in `--baseline` order, each exactly once (single pass, no dedup needed since `parseWatchBaseline` already rejects a repeated key).
- AC3 — implemented — gone keys are never written to `last` (only `keys` are, at `tools/lane-status.ts:1591-1592`), so the re-arm command's `lastRead` (built from `[...last]` at `:1617`) has no gone key and the loop still returns `WATCH_EXIT_EXPIRED` (`= 3`, `tools/lane-status.ts:1285`) at the deadline. All-gone + empty lane list: `keys = []`, `parseWatchBaseline` still succeeds (`unknownIsGone` bypasses the `keys.includes` check independent of `keys.length`, and `result.size` is nonzero since the gone entries were added), so `armed: watching 0 lane(s)` prints, the (empty) watched-lane loop is a no-op, the gone lines print, and `last` stays empty so `formatWatchRearmCommand` omits `--baseline` (`lastRead.length > 0` guard, `:1479` region, unchanged).
- AC4 — implemented — `named` truthy ⇒ `unknownIsGone: false` (`:1570`) ⇒ unchanged `WatchUsageError` throw at `:1449` for an unknown key under `--lanes`.
- AC5 — implemented — malformed entry (`:1443`), bad fingerprint (`:1446`), repeated key (`:1451`, unconditional — fires whether or not the key was accepted as gone), and empty value (`result.size === 0` at `:1456`) all still throw before any `io.out` call, matching "validated before anything is printed" (decision b). Proof file `test/e178b-lane-watch.test.mjs` is qa-owned (T-E223-02, depends_on this task) — the currently-red assertion there is the documented, spec-anticipated expected-red (AC5's own proof line describes the exact edit qa makes), not a defect in this diff.
- AC6 — implemented — verified independently: `npm run build` (exit 0) leaves `git status --porcelain dist/` empty, confirming `dist/tools/lane-status.{js,d.ts}` (+ maps) are byte-current with `tools/lane-status.ts`; `npx tsc --noEmit` is clean.

## Correctness
No findings. Traced every AC path above against the actual control flow (not the author's notes): the `unknownIsGone` short-circuit, the `goneKeys` filter, the `last`-map exclusion, and the unchanged validation order all line up with spec decisions (a)-(g). The mid-watch tick loop (`:1633` onward, "a gone lane leaves the watched set... reported gone once") is comment-only churn — no logic changed there, correctly out of scope per the spec's Out of Scope list.

## Quality
No findings. Naming (`unknownIsGone`, `goneKeys`) is self-documenting and consistent with the file's existing style; doc comments on `parseWatchBaseline` and the two `watchLoop` call sites correctly attribute each behavior to its owning spec/decision. No dead code or duplication introduced.

## Architecture
No `specs/e223-watch-rearm-gone-architecture.md` exists (spec's Dependencies section notes no design surface / no cross-module API) — nothing to check against. The change stays inside the existing `parseWatchBaseline` / `watchLoop` layering; no new module boundaries crossed.

## Security
No findings. No new input crosses a trust boundary — `--baseline` was already user-supplied CLI input validated by the same fingerprint/format checks as before; the only behavioral change is which validated keys are treated as fatal vs. reportable. `shellQuote`/`formatWatchRearmCommand` (re-arm command construction) is untouched by this diff.

## Performance
No findings. `goneKeys` is a single `O(k)` filter over the baseline map (k = number of `--baseline` entries, already bounded by CLI input); no loop nesting added, no new I/O.

## Verdict
APPROVED — all six ACs are implemented correctly against the diff, dist is rebuilt clean with no drift, and the diff carries no unscoped changes (no spec/test/script edits outside T-E223-01's owned files).
