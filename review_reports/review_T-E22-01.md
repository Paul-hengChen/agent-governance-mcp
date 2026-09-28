# Review — T-E22-01

## Summary
- E22 opt-in stale-dispatch watch-file notify: new `tools/stale-notify.ts` (`notifyStaleDispatch`), wired at the v10 `stale_dispatch` advisory point in `tools/handoff.ts` `readHandoffState`; config key `staleDispatchNotifyFile` surfaced in `tools/config.ts`; `docs/config.md` documents it. 5 source files + committed `dist/*`.
- Scope matches the E22 backlog spec exactly: watch-file emit ONLY, opt-in/config-gated, no new handoff state, no schema bump, atomic tmp+rename publish, dedupe one emit per `(dispatched_at, role)` with the watch-file as cursor, file-mode only, never-throws on the pre-flight read path.
- Verified against the cut-time scope decisions: no deviations that block. dist compiles clean (`tsc --noEmit` rc=0) and matches source; no test files touched (§2); no `any`.
- Verdict: APPROVED.

## Correctness
No blocking findings. Path-by-path against the review focus:

- **Emit wiring** (`tools/handoff.ts:663-681`): the advisory is constructed once and typed as `StaleDispatchAdvisory`; `notifyStaleDispatch` is called on every stale path (inside the `elapsedMin > STALE_DISPATCH_THRESHOLD_MIN` block) and only there. No emit when not stale (guard) or disarmed (null return). Correct.
- **Disarmed-path guarantee** (`tools/handoff.ts:681`): `staleDispatch = { ...advisory, ...(notify && { notify }) }`. When `notify` is null, `null && {…}` is `null` and `{...null}` is a no-op, so no `notify` key appears and key order is `role, dispatched_at, elapsed_minutes, threshold_minutes, message` — byte-identical to the pre-E22 literal. Confirmed the common disarmed cases are truly unchanged: `loadConfig` returns `{}` for a missing `.config.json` (`tools/config.ts:136-139`, no throw) and returns no `staleDispatchNotifyFile` for a valid config lacking the key → both yield `null`.
- **Never-throws** (`tools/stale-notify.ts`): every escape is contained. `loadConfig` throw → caught (73-81) → error outcome. Absent key → early null return (82). `path.resolve` on strings cannot throw. Dedupe read-back (`readFileSync`/`JSON.parse`/narrowing) → own try/catch, falls through to emit (95-108). Emit block (`mkdirSync`/`writeFileSync`/`renameSync`) → outer try/catch → error outcome (110-131). No statement outside a guard can throw. Confirmed against corrupt config, missing/unwritable dir, corrupt prior file, and directory-as-target (rename fails → caught).
- **Dedupe cursor**: prior file parsed and compared on `(dispatched_at, role)`; match → `skipped_duplicate` with the file left untouched (no re-fire per read); a fresh `dispatched_at` re-arms naturally; hand-deletion of the watch-file makes the read-back throw → caught → fresh emit (fails toward notification, not silence). Correct per spec.
- **Note (non-blocking, considered acceptable):** a config that *exists but is corrupt / on a future schema* combined with a stale dispatch will newly surface `stale_dispatch.notify.error` even when E22 was never armed — a narrow deviation from "byte-identical when disarmed." This is the deliberate, documented fail-loud choice (`tools/stale-notify.ts:71-81`): a broken config should be visible, and the alternative (swallow to null) hides real corruption. It only manifests in an already-degraded workspace, never throws, and never perturbs the common disarmed path. Acceptable; flagged for QA awareness.

## Quality
No findings. `staleDispatchNotifyFile` surfaces via the exact `host` non-fatal filter pattern (`typeof x === "string" && x.length > 0`, `tools/config.ts:233-239`). Naming, JSDoc, and the shared `StaleDispatchAdvisory`/`StaleNotifyOutcome` contract are clear and match surrounding conventions. `path.resolve` (not `join`) deliberately honors an absolute configured path — documented inline.

## Architecture
Fits the stated design: emit rides the existing read-time threshold check, no daemon/timer, dedupe cursor lives in the watch-file (no new handoff state, no schema bump), atomic tmp+rename publish. Typed contract shared between the emit module and the handoff wiring instead of a `Record<string, unknown>` handshake. Matches the sibling E10/E18/E24 file-mode, opt-in, never-throws posture. The E22 backlog row is the spec; no separate architecture doc.

## Security
No findings. The configured path is workspace-owned (same trust boundary as `taskPaths`); no new external/untrusted input crosses a boundary. tmp filename is `pid.time`-scoped; rename-over-symlink replaces the link rather than following it into a write. No secrets, no injection surface.

## Performance
No findings. The added work (`loadConfig` — cached with mtime invalidation — plus at most one read-back and one atomic write) executes only on the already-rare stale-dispatch branch, not on the common read path. No loops, no algorithmic regression.

## Verdict
APPROVED — implementation matches the E22 cut scope with no blocking findings; never-throws and disarmed byte-identical guarantees both hold on all common paths, with one documented, acceptable fail-loud edge on corrupt-config workspaces noted for QA.
