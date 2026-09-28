# e123b0-lane-runtime-resolver

E123 F1, stage **S0**: the frozen interface. v4.0.0 Wave 4. Split: `.current/feature-split.md` rows 1.0–1.9. Decisions: that file's Decisions section (D1).

## Problem Statement

F1 routes ~15 source files through the F0 lane resolver, in three parallel lanes (L1–L3), before J flips it. Every one of those call sites has to ask "what are my lane's paths *right now*?", and F0 only answers "what would lane X's paths be?". If each lane invents its own way to name the current lane, the three branches will disagree at integration. So S0 freezes that one function first, with no behaviour of its own (E110's "freeze the type, not the behaviour").

## Acceptance Criteria

- **AC1** — `tools/lane-paths.ts` exports `PRIMARY_LANE = "_primary"`.
- **AC2** — `resolveCurrentLane(workspacePath: string): string` reads the checked-out branch **by pure fs**: `<ws>/.git` is a directory → read `.git/HEAD`; `<ws>/.git` is a gitfile (`gitdir: <path>`) → read `<gitdir>/HEAD`. No git subprocess, no network (the precedent is `tools/drift.ts`, which is fs.statSync only). `HEAD` = `ref: refs/heads/<branch>`:
  - `<branch>` = `feat/<rest>` and `<rest>` starts with a ticket-id token → the lowercased id (`feat/e123b1-core-write-path` → `e123b1`).
  - anything else (`main`, `integ/wave4`, `fix/x`, a detached HEAD, no `.git`, an unreadable or malformed file) → `PRIMARY_LANE`.
  - It never throws.
  proof: table-driven unit test over temp dirs covering a `.git` dir, a gitfile, a detached HEAD, a missing `.git`, and a malformed gitfile.
- **AC3** — The ticket-id token accepts trailing alphanumerics, so the S0/L/J ids resolve distinctly: `e123b0`, `e123b1`, `e123b9` → themselves. `TICKET_ID_RE` is widened in the one place it lives, and `resolveLaneName` (the F0 migration-time resolver) uses the same pattern. F0's worked examples still hold (`e163-ci-gate-ordering` → `e163`, `e123a-lane-layout-migration` → `e123a`, unparseable → `_legacy`). `resolveLaneName` still never returns `_primary`.
  proof: extend F0's `resolveLaneName` table and add the three new ids.
- **AC4** — `resolveCurrentLanePaths(workspacePath: string): LanePaths` returns `resolveLanePaths(workspacePath, resolveCurrentLane(workspacePath))`. It is therefore **still today's flat paths** for every branch, so there is zero behaviour change.
  proof: output equality versus the flat paths across the branch shapes from AC2.
- **AC5** — Zero production callers of `resolveCurrentLane` or `resolveCurrentLanePaths` outside `tools/lane-paths.ts`. L1–L3 add them.
  proof: `grep -rn "resolveCurrentLane" tools/ gates/ guards/ prompts/ bin/ index.ts` matches only `tools/lane-paths.ts`.
- **AC6** — `npm run build` is clean, the full suite is green, and `npm audit --audit-level=high` exits 0.

## Out of Scope

- Any call-site migration (L1–L3), the flip or migration wiring (J), and the F2 aggregation.
- **The `.config.json` explicit lane key (D1's first rung) is NOT read here.** `.current/.config.json` is **tracked**, so a lane key written into it inside a worktree would be committed and merged into `main`, and `main` would then claim that lane. E73's bootstrap must store the explicit name in an untracked place, such as the worktree's own gitdir, and not in the tracked config. This is recorded here for E73's cut.
- The L-SCHEMA-NEW-7 items (lock re-resolution, shared lock constant) belong to J.

## Files

- `tools/lane-paths.ts` (sr-engineer). The qa-owned test is `test/lane-paths.test.mjs` (extend it).
