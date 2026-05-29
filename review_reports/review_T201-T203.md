# Code review — T201 + T202 + T203 (v3.14.1 patch trio)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Three surgical fixes: sanitiser (T201, `tools/evidence-file.ts`), Round 6 sentinel predicate (T202, `index.ts`), `embedding_model` allowlist (T203, `index.ts`).
- All changes additive or strictly-tighter; no API removal, no schema bump, no behavioural regression on the default flow.
- Diff is ~30 lines net add. All comments cite `v3.14.1` and the specific CVE / report for grep-stability.
- AC mapping: T201 → AC-3 sanitiser hardening; T202 → AC-4 Round 6 sentinel `>=` predicate; T203 → AC-1 + AC-2 mitigation derived from `research/xenova-reachability.md`.
- Verdict: APPROVED.

## Correctness

- `tools/evidence-file.ts:115-123`: `.replace(/\.\.+/g, "_")` chained after the existing `[^A-Za-z0-9._-]` filter correctly collapses any run of 2+ dots to a single `_`. Edge cases verified:
  - `..feat` → `_feat` ✓
  - `f..oo` → `f_oo` ✓
  - `...` → `_` ✓
  - Single `.` survives (intended — `feat.v2.md` is a legitimate filename) ✓
  - `..` alone → `_.md` (no traversal, no surprise) ✓
- `index.ts:778-780`: `new_visual_round >= 6 && prev_visual_round < 6` is the correct cap-cross predicate. Verified scenarios:
  - prev=5 → new=6 (normal increment): fires ✓
  - prev=4 → new=6 (impossible via in-band logic but possible via migration / hand-edit): fires ✓
  - prev=6 → new=7 (already crossed): does NOT fire ✓ (correct — sentinel injected exactly once per cap-cross)
  - prev=0 → new=0 (no change): does NOT fire ✓
- `index.ts:139-149` + `:161-170`: zod refine chained after regex — both layers execute. `.optional()` preserves absence semantics (undefined still satisfies). Default flow with no `embedding_model` parameter is unaffected. ✓
- The error message in T203 surfaces the allowlist contents via `[...ALLOWED_EMBEDDING_MODELS].join(", ")` — operators see exactly which models are permitted, not a generic "rejected" message. Good UX. ✓

## Quality

- Comments are surgical: each block carries a `v3.14.1` tag, references the upstream CVE or the reachability report, and explains *why* (not *what*). Convention matches existing `v3.7.x` / `v3.13.x` comment style.
- `ALLOWED_EMBEDDING_MODELS` declared as `Set<string>` — idiomatic for membership checks. Could be `readonly` (const array) but Set semantics make intent clearer.
- No dead code, no convention drift. The new constant sits next to `EMBEDDING_MODEL_RE` (the previous validation layer) — co-located, easy to find.
- The error message is built inline inside the `refine` block. Could be pre-computed once outside the closure for micro-perf, but the validation runs at most once per `tw_index_prd` call (infrequent) — not worth the refactor.
- File:line citations correctly mark the v3.14.1 additions; the existing v3.14.0 comments are preserved unmodified (surgical change discipline).

## Architecture

- No `specs/bug-fixes-v3.14.1-architecture.md` exists (small patch — architect skipped per `skill-pm` `architect vs sr-engineer` heuristic). Architecture-doc-absence is correct for a 30-line diff.
- All three changes fit the existing architecture:
  - T201 lives in the same `designFilePath` helper that already enforces filename sanitisation. Strictly tighter.
  - T202 changes one predicate; symmetric to the existing `qa_round` / `review_round` Round 4 sentinels (which use `=== 4 && === 3` — those have the same off-by-one issue and should arguably be migrated to `>= 4 && < 4` in a follow-up, BUT that is out of scope for v3.14.1 per the spec).
  - T203 layers a `refine` onto the existing zod schema — additive, no removal of the regex layer.
- The relationship between `research/xenova-reachability.md` and the T203 code change is documented inline in the source comment. Audit trail intact.

### Observation for follow-up (NOT blocking this release)

- The `qa_round` Round 4 sentinel at `index.ts:747-749` and `review_round` Round 4 sentinel at `:750-752` carry the same `=== 4 && === 3` pattern that T202 just fixed in `visual_round`. If a migration ever bumps qa_round / review_round past cap externally, those sentinels would skip too. Worth a v3.14.2 follow-up to apply the same predicate fix symmetrically. Flag for PM tracking; not a v3.14.1 blocker because the path-to-trigger is migration-only (no in-band logic produces it).

## Security

- T201: closes the cosmetic `..` literal surprise. Already path-safe before (slashes were replaced), but `..` segments in filenames could mislead grep / audit logs. Tighter is better.
- T203: **closes the documented reachable CVE chain** from `research/xenova-reachability.md`. Allowlist trust boundary is HuggingFace + Xenova organisation membership — same trust boundary as the default install, so no NEW trust assumption. The allowlist is the strictly-tighter version of "trust the regex'd HF Hub model name."
- No new injection surfaces. Allowlist check is a Set membership lookup (no eval, no regex compilation per call, no shell-out).
- Comment block above `ALLOWED_EMBEDDING_MODELS` documents the addition procedure (PR + provenance check) — sensible governance.

## Performance

- T201 sanitiser: adds one extra `.replace()` pass per `hasVisualBaselinesInDesign` call. Input bounded to 500 chars by zod elsewhere. O(n) on a small string. Negligible.
- T202 predicate: identical CPU cost to the previous `===` comparison.
- T203 allowlist: O(1) Set lookup, gated on `m` being a string (zod ensured). Error-message construction with spread + join runs ONLY on rejection (rare). No regression vs base.
- No new loops, no unbatched I/O, no new caches, no listeners.

## Verdict

**APPROVED.** All three changes are minimal, surgical, and correct. They close the v3.14.0 audit findings without altering public API or changing default-flow behaviour. The `embedding_model` allowlist is the right answer to the reachable-CVE finding per `research/xenova-reachability.md`. Recommend qa-engineer write the AC-3, AC-4, AC-10 tests next, plus the e2e suite from T204-T206.

— @code-reviewer
