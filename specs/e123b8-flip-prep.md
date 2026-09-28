# e123b8-flip-prep

E123 F1, stage **J1**: everything that must be true *before* the flip, with zero behaviour change. v4.0.0 Wave 4. Split: `.current/feature-split.md` rows 1.8 / 1.9. Decisions: that file's Decisions section.

## Problem Statement

L1–L3 routed the lane-file call sites through `resolveCurrentLanePaths`, and the integration surfaced the rest. A few sites still build lane paths directly. One input path is never normalized. The handoff lock is named in two places and taken before the path it guards is resolved. The ticket-id regex is quadratic. Each of these is harmless while the resolver returns flat paths, and wrong the moment J2 flips it. J1 fixes all of them now, so that J2 — the irreversible step — contains only the flip.

## Acceptance Criteria

- **AC1** — `tools/dispatch-log.ts` gets `dispatch.jsonl` from `resolveCurrentLanePaths(<absolute ws>).dispatchLogPath`, not from a direct `.current/` join (L2-NEW-1). The resulting path is byte-identical to today's.
  proof: unit assertion that the path equals the flat path, plus `grep` finding no direct `.current` join in the file.
- **AC2** — `resolveWorkspacePath` in `index.ts` returns an **absolute, normalized** path for every source (`workspace_path` arg, `CLAUDE_PROJECT_DIR`, cwd): a leading `~` or `~/` expands to `os.homedir()`, and the result passes through `path.resolve` (L2-NEW-2, L-SCHEMA-NEW-9). An already-absolute input is returned unchanged.
  proof: table test covering `~`, `~/x`, a relative path, and an absolute path.
- **AC3** — There is one exported lock filename constant, `HANDOFF_LOCK_FILENAME = ".handoff.lock"`, in `tools/lane-paths.ts`. `tools/handoff-write.ts` and `tools/lane-migrate.ts` both import it, and no other literal `.handoff.lock` remains in `tools/` (L-SCHEMA-NEW-7 part 2). **The lock stays workspace-wide at `.current/.handoff.lock` in J1.** Whether it becomes per-lane is J2's decision.
- **AC4** — `writeHandoffState` resolves `handoffPath` **inside** the `withFileLock` callback, not before it, so a writer that waited on the lock re-resolves after acquiring it (L-SCHEMA-NEW-7 part 1). `ensureDir` still runs before the lock, since the lock file lives in `.current/`. There is no observable behaviour change.
  proof: the full suite stays green; a code-reviewer check that `getHandoffPath` is called inside the callback.
- **AC5** — `migrateLaneToFlat` no longer refuses a lane dir just because it contains a leftover lock file (`HANDOFF_LOCK_FILENAME`) or a stale atomic-write temp file. It ignores them and removes them with the dir. Any other non-`LANE_FILES` entry still causes a refusal (L-SCHEMA-NEW-7 part 3).
  proof: fixture tests for each of the three cases.
- **AC6** — `TICKET_ID_RE` becomes `/^([a-z]+\d[a-z0-9]*)(?:-|$)/i`, which accepts the same ids in linear time (L-SCHEMA-NEW-8). Every existing `resolveLaneName` / `resolveCurrentLane` case is unchanged.
  proof: the existing tables, plus a timing-free check that a 10k-digit input returns promptly.
- **AC7** — The stale "NO production callers" comment in `tools/lane-paths.ts` is corrected. This is a comment-only change.
- **AC8** — Workspace-wide by decision (human, 2026-09-23): the role SOP override files that `tools/role.ts` reads from `.current/`, and `.current/.agc-hook-marker.json`, are **NOT** lane files. `LANE_FILES` is unchanged. A one-line comment at each read site says so, so J2 does not "helpfully" route them.
- **AC9** — The CALLERS2/CALLERS3 allow-lists in `test/lane-paths.test.mjs` are updated for any caller J1 adds, such as `tools/dispatch-log.ts` (qa-owned).
- **AC10** — `npm run build` is clean, the full suite is green with **no expected-red exemptions**, and `npm audit --audit-level=high` exits 0.

## Out of Scope (J2)

The resolver flip, migration wiring, per-lane vs workspace lock, E132 re-point, real-layout reversibility, and flat-assuming test rewrites. Also out of scope: the `metricsPath()` double HEAD read (optional; leave it to J2).

## Files

sr-engineer: `tools/dispatch-log.ts`, `index.ts`, `tools/lane-paths.ts`, `tools/handoff-write.ts`, `tools/lane-migrate.ts`, `tools/role.ts` (comment only), plus the rebuilt `dist/`. Cut this as two sr tasks within the `task_size` budget. qa-engineer: `test/lane-paths.test.mjs`, plus existing or new tests for AC2/AC5, plus the expected-red manifest if one is ever needed.
