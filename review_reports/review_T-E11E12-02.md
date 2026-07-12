# Review — T-E11E12-02

covers: T-E11-01, T-E12-01, T-E11E12-02

## Summary
- Adversarial review of the `e11-e12-release-integrity-batch` implementation: E11 (`scripts/check-version.mjs` — dist/index.js parity check) + E12 (`tools/metrics.ts` — per-release idempotency guard). Two source files + dist rebuild of `tools/metrics.*`.
- Scope matches `specs/e11-e12-release-integrity-batch.md` AC1–AC13 exactly; no scope creep. Existing index.ts/CHANGELOG/git-tag checks unchanged; E12 leaves `.current/metrics.jsonl` untouched (AC12 confirmed — file not in diff, code is append-only).
- All four E11 branches and E12 AC6–AC11 driven against the real code / compiled module — every case passes.
- Verdict: APPROVED.

## Correctness
No findings. All acceptance criteria verified by execution, not inspection alone.

E11 — `scripts/check-version.mjs:42-66`. The dist regex `/name:\s*"agent-governance-mcp",\s*version:\s*"([^"]+)"/` was run against the actual compiled `dist/index.js`: exactly **one** match (`name: "agent-governance-mcp", version: "3.75.0"` at line 95) — no false-positive on any other version-shaped string in the compiled output, and `.match()` (non-global) takes the first occurrence regardless. Four branches driven in an isolated copy:
- Match → prints `dist/index.js parity OK (3.75.0)` + `OK`, exit 0 (AC1, AC4).
- Mismatch (stale `3.73.1`) → error names both `package.json=3.75.0` and `dist/index.js=3.73.1`, exit 1 (AC2).
- Parse-fail (file present, no literal) → `could not find dist version literal` error, exit 1 (AC3 fail-loud) — correctly distinguished from absent via `existsSync`.
- Absent → skip note, exit 0, downstream checks continue (AC3 tolerance).

E12 — `tools/metrics.ts:72-104`. Dedupe key is the `(feature, released_version)` pair (line 95), guard sits after `released_version` resolution and before record construction. Driven against the compiled module:
- Same pair twice → 1 line (AC6/AC7).
- New version, same feature → 2 lines (AC8) — `parsedVersion !== released_version` correctly appends.
- Two null-version emits (no package.json) → 1 line, `released_version: null` (AC9) — null is a real key, normalized via `typeof x === "string" ? x : null` on both sides, not a wildcard.
- Malformed JSON line pre-seeded → skipped per-line without crashing; valid duplicate still deduped; new feature still appends (AC10).
- Cross-feature, same version → 2 lines — the `parsed.feature === args.feature` guard prevents deduping across **different** features (adversarial angle cleared).

## Quality
No findings. Naming (`alreadyEmitted`, `parsedVersion`, `distPath`, `dm`) mirrors the surrounding code; the new E11 block reuses the existing regex verbatim rather than re-deriving it; message style matches the existing index.ts-vs-package.json mismatch precedent. Comments are accurate and non-redundant.

## Architecture
No findings. E11 inserts the dist check between the index.ts assertion and the CHANGELOG check — additive, and the fail-loud exits never suppress a pre-existing check's behavior on the passing path (AC1). E12 keeps the guard entirely inside `emitFeatureMetrics`'s outer never-throw `try` (lines 48-122); no change to the release-engineer closing-write signature or the call site in `handoff-orchestrator.ts`, matching the spec's Out-of-Scope list. File-mode-only surface unchanged.

## Security
No findings. No new trust boundary. `existsSync`/`readFileSync` operate on repo-relative constructed paths; parsed JSON fields are read as `unknown` and compared, never executed or interpolated into a shell/regex. No secrets introduced.

## Performance
No findings — no regression. E12 adds one full read + line-scan of `.current/metrics.jsonl` per release emit (O(n) in existing records). This is acceptable: `emitFeatureMetrics` fires only at the release-engineer terminal marker (once per shipped feature), not on a hot path, and the file grows by ~1 line per release. `.match()` on `dist/index.js` is a single startup-time scan. Adversarial posture cases confirmed non-throwing: `metrics.jsonl` as a directory (EISDIR) and unreadable/`chmod 000` (EACCES) both fall through the fail-open dedupe catch and are ultimately swallowed by the outer never-throw try — the AC11 contract (never propagate) holds in every case; where the file is also unwritable the record is dropped, which is the environment-failure path the never-throw sidecar contract explicitly accepts.

## Verdict
APPROVED — E11 AC1–AC4 and E12 AC6–AC12 all verified by execution; TS strict with no `any` (parsed as `{ feature?: unknown; released_version?: unknown }`), `npm run build` green. AC5/AC13 are qa-owned (T-E11E12-03).
