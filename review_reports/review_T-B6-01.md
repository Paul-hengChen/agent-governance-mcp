# Review — T-B6-01 (backlog-b6)

## Round 1 — APPROVED — by code-reviewer

## Summary
- New pure helper `lib/tsconfig-source-dirs.ts` exports `getTsConfigSourceDirs(tsconfigPath: string): string[]`, parsing `tsconfig.json` `include` into unique top-level source-dir names.
- `docs/backlog.md` B6 flipped to done (summary-table row + `## B6` detail block) with a one-line closure summary.
- Scope is exactly the two deliverables for T-B6-01; `test/release-staging.test.mjs` is correctly left untouched (qa's T-B6-02).
- Build clean (`tsc` exit 0); `dist/lib/tsconfig-source-dirs.js` emitted; live smoke against the repo tsconfig returns exactly `["tools","guards","prompts","schema","transport","lib"]`.
- Headline verdict: **APPROVED**.

## Correctness
- `lib/tsconfig-source-dirs.ts:32-61` — Logic verified by execution, not reasoning:
  - Repo `tsconfig.json` → `["tools","guards","prompts","schema","transport","lib"]`, exact content + first-seen order; `index.ts` correctly skipped (AC-B6.1).
  - `include` missing / `null` / non-array → `[]` without throwing (AC edge cases). ✓
  - Non-string entries (number/null/object) silently skipped. ✓
  - Dedup via `Set` with first-seen order preserved (`tools/a/*.ts`+`tools/b/*.ts` → single `tools`). ✓
  - Leading-slash entry (`/abs/x.ts`) skipped via `slashIndex <= 0` guard — prevents emitting an empty-string dir; a subtle edge the `<= 0` (not `< 0`) check handles correctly (`lib/tsconfig-source-dirs.ts:49`). ✓
  - Bare files (`index.ts`, `main.ts`) → `[]`; single-star glob (`lib/*.ts`) → `["lib"]`; no trailing slash on any output. ✓
- No off-by-one, no race (synchronous pure function, no shared state).

## Quality
- Strictly typed: `TsConfigShape { include?: unknown }` + runtime `Array.isArray` / `typeof === "string"` narrowing. No `any` (AC-B6.1 hard requirement). ✓ (`lib/tsconfig-source-dirs.ts:16-18`).
- Doc comment accurately describes behavior, MVP scope, and cross-references `specs/backlog-b6.md` Out-of-Scope. Naming matches surrounding `lib/` convention (cf. `lib/watermark-check.ts`).
- No dead code, no duplication.

## Architecture
- Pure, dependency-light (only `node:fs` `readFileSync`), synchronous — directly consumable by the qa-owned `test/release-staging.test.mjs` via `../dist/lib/tsconfig-source-dirs.js` per AC-B6.3. Fits the spec contract exactly.
- MVP boundary honored: reads only the direct `include` array — no `extends`-chain or path-alias resolution (spec Out of Scope). No architecture spec present for this feature; not required (non-design, single-file helper).

## Security
- Input is a developer-controlled local config path; `readFileSync` + `JSON.parse` only. No injection vector, no secrets, no network. A malformed JSON file would throw from `JSON.parse` — acceptable for a build/test-time helper fed a known repo path (spec does not require malformed-JSON tolerance, only missing/non-array `include`, which is handled). No boundary concern.

## Performance
- Single file read + one linear pass over `include` (O(n) in entry count, n is tiny). `Set`-backed dedup is O(1) per entry. No hot-path loop, no unbatched I/O, no leak. No regression vs base (new code).

## Verdict
APPROVED — helper is correctly typed, handles all required edge cases without throwing, smoke-verified to return the exact expected source dirs against the repo tsconfig, and B6 is closed in docs/backlog.md; `test/release-staging.test.mjs` correctly deferred to qa's T-B6-02.

### NIT (non-blocking)
- The doc-closure version string `v3.35.0` (in `docs/backlog.md` summary row + `## B6` block) is an sr-side assumption — the actual next-release version is release-engineer's call (`package.json`/`index.ts` are still at 3.34.0). Not wrong on its face (it is the plausible next minor), so flagged as a NIT, not a blocker. Release-engineer should confirm/correct at tag time.

### Out-of-feature working-tree content (NOT reviewed, NOT blocking)
- `content/skill-architect.md`, `test/phase-0-5-sop.test.mjs`, `.current/feature-split.md` row 3, and the new `## B8` block in `docs/backlog.md` belong to the already-completed T-ORM-01 / separate backlog work, not T-B6-01. Per review scope these are out-of-feature pre-existing content and are explicitly not gated by this review. The pre-existing 66/67-task drift is likewise carry-over, untouched by this task.
