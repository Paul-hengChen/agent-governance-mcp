# Review — T-E260D-01

covers: T-E260D-01, T-E260D-02, T-E260D-03, T-E260D-04, T-E260D-05, T-E260D-06, T-E260D-07

## Round 1 — APPROVED — by code-reviewer

Range `b37178a..4da5fe9` on `feat/e260d-core-dirs`, judged against `specs/e260d-core-dirs-comment-trim.md`, the common rules in `specs/fanout-e260.md` and `docs/lane-protocol.md` section 2. Ruling D1 (a) applies: the 33 mapping rows above `GATE_REGISTRY` stay byte-identical. That block is the one allowed block over 20 lines. The reviewer tier is opus and the builder pin is fable, so the two hops ran on different models.

Clean-context note: `tw_get_state` returns the builder's `pending_notes` in its output, so I saw them. I did not use them as evidence. Every result below was re-derived from the diff, the specs and my own commands.

## Summary
- 25 lane `.ts` files changed, comments only, plus the matching `dist/` share (`.js`, `.d.ts`, `.map`). Also new: `specs/e260d-comment-rationale.md`, the cut spec, and the lane-local `.current/e260d/proof.mjs` and ledger.
- The builder's proof passes on HEAD: scope ok, emit 25/0, tokens 25/0, pins 25/0, `>20: 0 unexpected (1 allowed)`, `8-20: 0 block(s)`, bare-id 0, form ok.
- Independent checks, not the builder's script:
  - I wrote my own scanner-level token comparison (template- and regex-aware; it records whether a newline comes before each token, which is what matters for automatic semicolon insertion). It covers all 55 changed `.ts`, `dist/*.js` and `dist/*.d.ts` files. 0 differ.
  - A clean `npm run build` leaves no diff.
  - The `dist/` file set matches the source file set, both for the whole lane and for each of the six trim commits separately.
  - 22 targeted test files that read lane sources: 616 pass, 0 fail, 1 skipped.
- No 8–20-line block remains, so AC5 has no retained-block reasons to copy (see AC Completeness).
- Verdict: APPROVED. No required findings. Two recommended findings about how strict the proof script is, both checked by hand. Three optional nits.

## AC Completeness
AC1 — implemented — the proof prints `emit: 25 files, 0 differ` (`transpileModule`, `removeComments: true`, maps and declarations off). My own check agrees: the scanner token streams of src, `dist/*.js` and `dist/*.d.ts` are identical to base, 55 files.
AC2 — implemented — the proof prints `tokens: 25 files, 0 differ`. The AST leaf walk skips JSDoc nodes, so a type-only edit would show up. My scanner check also covers types.
AC3 — implemented — the proof prints `scope: ok` (25 files, all `M` and `.ts`, none added or deleted). The forbidden-path `git diff --stat … | wc -l` gives `0`. Every changed path is in the lane's owned list (`gates/`, `prompts/`, `schema/`, `lib/`, `index.ts`, the matching `dist/` slice, `specs/e260d-*`, `.current/e260d/**`). Nothing else changed.
AC4 — implemented — `>20: 0 unexpected (1 allowed: gates/registry.ts mapping table)`. The allowed block is one pointer line plus the 33 rows.
AC5 — implemented — `--list-mid` prints `8-20: 0 block(s)` over every lane file at HEAD, not only the changed ones. Retained-blocks table in `specs/e260d-comment-rationale.md`, copied here as the spec requires: `| — | — | — | none: after T-E260D-07 every block in the lane is 7 counted lines or fewer, except the mapping table in gates/registry.ts (decision D1) |`. So there is no per-block keep reason for any task. The D1 table's reason is ruling D1 (a): `test/error-code-contract.test.mjs` `parseDocFileMappingComment` pins the 33 rows.
AC6 — implemented — 8 pointer lines to `specs/e260d-comment-rationale.md`, in `gates/feature-lease.ts`, `gates/registry.ts`, `gates/pipeline.ts`, `gates/visual.ts`, `gates/stamp-provenance.ts`, `prompts/build.ts`, `prompts/text-transforms.ts` and `prompts/skill-manifest.ts`. Each points to an existing `## <source path>` section. The `registry.ts` pointer goes to the `gates/stamp-provenance.ts` section. `node scripts/check-md-tables.mjs` exits 0. Spot-checked 14 cited specs, and each holds the rationale it is cited for:
  - e1 holds the lease formula, and its Amendment (2026-07-12) holds the negative-age guard.
  - e13 holds the heal-write incident.
  - e10 holds the audit note.
  - e23 holds the v1/v2 rules (D1/D2).
  - c16 holds the E32 amendment.
  - c12 holds AC2.
  - e4 holds storage-mode independence and the inclusion list.
  - a12 holds the non-recursive pass, the one-newline strip and the unknown-token marker.
  - c6-c11 holds the two dedup layers.
  - d1 holds the shape-only rule.
  - c9 holds DR-1 and DR-2.
  - e114 holds absence as non-inherited.
  - schema-versioning holds AC-5 (atomic migrations).
  - backlog-b6 holds `EXCLUDED_DIRS` and the `transport/` incident.
  - e137 holds the Threat Model and the adaptive fence.
  - d6 holds the hook's `{ taskTool: true }` default.
AC7 — implemented — `bare-id: 0`. All ids on added comment lines are trailing pointers after plain words: `registry.ts` AC2 and AC6, the E32 amendment, B1-fallback, and AC-5 of the schema spec. No lane file cites `content/constitution.md` any more; it is called "the retired single-file constitution". Every path cited in an added comment line is tracked (about 60 paths enumerated with `git ls-files --error-unmatch`; the only miss was the substring `prompts/build.js` inside `dist/prompts/build.js`). Sampled every trimmed block in all 25 files for plain-language readability.
AC8 — implemented — `form: ok`. The first lines are unchanged. The `/**` opener count per file equals base for all 25 files (checked by hand, see Quality R1). No `##` heading in any comment. No `/*!` or `/// <reference`.
AC9 — implemented — `npm run build` then `git status --porcelain dist | wc -l` gives `0`. `git diff --stat b37178a...HEAD -- dist/tools | wc -l` gives `0`. The changed `dist/` stems equal the changed source stems for the lane and for each of the commits 0e9442e, 5442a2e, f5ec388, 5880059, c7ff4c2 and 4da5fe9.
AC10 — implemented — the AC10 `diff` command prints nothing. `^//\s{2,}[A-Z][A-Z0-9_]*\s{2,}` matches exactly 33 lines in `gates/registry.ts`, so no other comment adds a row to the test's parse.
AC11 — implemented, pending QA's run — a comment-only change needs no code. The full suite on the final HEAD is qa-engineer's proof. My targeted run of 22 files (`lane-paths`, `lane-migrate`, `error-code-contract`, `covering-evidence`, `e114`, `e137`, `e23`, `watermark-check`, `ac-execution`, `gates-expected-red`, `feature-lease`, `visual-evidence-gate`, `context-budget`, `compose-equivalence`, `skill-manifest`, `release-staging`, `teamwork-lite`, `e122`, `render-structure`, `drift-stamp-advisory`, `e178a`, `e35-pipeline-order`) gave 616 pass, 0 fail, 1 skipped.

## Correctness
No required findings. The behaviour-neutral proof is sound for its purpose:
- Emit with comments removed catches any runtime change. AST leaf tokens catch type-only edits, which emit cannot see.
- The pins check holds the `lane-paths` / `lane-migrate` substring counts at base.
- JSDoc that flows into `.d.ts` changes only comment trivia. My scanner check shows `dist/*.d.ts` token-identical to base.
- `tsconfig.json` has no `stripInternal`, and no `@internal`, `@deprecated`, `@ts-*`, `eslint-*`, `__PURE__` or `@see` / `@link` comment was added or removed in the diff (grep over the `+` and `-` lines). So no comment-borne directive changed declaration output or type-check behaviour.

Comment accuracy against the code, spot-checked:
- `gates/feature-lease.ts:1-6` matches the predicate's clauses.
- `isReleaseClosingWrite` has two callers: the lease predicate and `tools/handoff-parse.ts:29,743`.
- `lib/watermark-check.ts` regex prose matches `WATERMARK_REGEX`, and the `validateWatermark` return contract matches lines 69/73/85.
- `prompts/skill-manifest.ts` "absent or unknown host gets the lean profile" matches `hostCapabilitiesFor` (`host === "claude-code"`).
- `prompts/text-transforms.ts` "bin/agent-governance-context.mjs deliberately does not call them" holds (no call in `bin/`).
- `gates/visual.ts` placeholder comment matches `DIFF_METRIC_PLACEHOLDERS`.

No new false statements found.

## Quality
- R1 (recommended): the proof script's `form` check is one-directional. In `.current/e260d/proof.mjs`, the check flags `nh > nb` (more `/*` / `/**` comments than base) but not fewer, so turning JSDoc into `//` would pass unnoticed. AC8 requires JSDoc to stay JSDoc. I checked by hand that the `/**` opener count equals base in all 25 files, so nothing slipped. The fix is to compare for equality. This is not blocking because the script is lane-local and does not ship.
- R2 (recommended): the proof has no check for directive comments (`@ts-ignore`, `@ts-expect-error`, `eslint-disable`, `/*#__PURE__*/`). Emit and tokens cannot see these, but they change type-check or bundler behaviour. Verified by grep that none were touched. Worth adding if other E260 lanes reuse this script as a template.
- O1 (optional): `gates/registry.ts:67`. The D1 pointer line is 162 characters. It stays on one line on purpose: wrapping would make the block 35 lines, over the AC4 cap of 34. Acceptable.
- O2 (optional): `lib/watermark-check.ts:2`. "The coordinator SOPs call it…" — "it" refers to the module named on line 1. Readable, slightly abrupt.
- O3 (optional): `prompts/build.ts`, fail-loud footer. The trim drops "the lane handoff path comes from the lane-layout seam, never a restated filename". This is recoverable from the code (`resolveCurrentLanePaths`), so nothing is lost that a maintainer needs.

No dead code, renamed identifiers or style drift. `//` stays `//` and JSDoc stays JSDoc.

## Architecture
No architecture spec (comment-only ticket; the spec says there is no architect hop). Layering is unchanged. The rationale spec gives the moved text one home, and each pointer resolves. The `specs/d6-…` file-list mismatch (`skill-coord-NN-*.md` vs the shipped `coord-NN-*.md`) is recorded inside `specs/e260d-comment-rationale.md` and not fixed in the d6 spec. That is correct, because d6 is outside this lane's owned list.

## Security
No findings. No code, string or boundary changed (proved mechanically). There are no absolute local paths in tracked lane files: a `git grep` for a home-directory prefix over `.current/e260d` and `specs/e260d-*` finds nothing. The proof script holds no absolute paths and resolves the repo root from `import.meta.url`.

## Performance
No findings. Emit is identical, so there is no runtime change. The shipped `dist/*.js` and `.d.ts` get smaller.

## Verdict
APPROVED — the emit, AST-token and my independent scanner checks prove the change is comment-only, the cited specs exist and hold the moved rationale, and the scope, `dist/` share, D1 table and lane-path pins all match base; the open findings are only recommended or optional.
