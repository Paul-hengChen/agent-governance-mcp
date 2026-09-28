# QA Review — c5-c18-watermark-configcache

covers: T-C5C18-01, T-C5C18-02, T-C5C18-03, T-C5C18-04, T-C5C18-05, T-C5C18-06, T-C5C18-07, T-C5C18-08

Reviewer: qa-engineer (sonnet). T-C5C18-01..05 already code-reviewer APPROVED
(`review_reports/review_T-C5C18-01.md`, covers T-C5C18-01..05) — this review
adds QA's own Phase 1 spot-checks (Copy Audit Gate) plus authors/executes
T-C5C18-06/07/08.

## Summary

C5(a) de-hardcodes the CRITICAL watermark reminder tier across all
`templates/claude-code-agents/*.md` files; C5(b) fixes `validateWatermark`'s
mismatched-watermark branch to replace (not double-append) the wrong
trailing line; C18 adds mtime-based invalidation to `tools/config.ts`'s
`configCache`. Authored `test/watermark-check.test.mjs` additions
(T-C5C18-06, AC-2: no-double-stamp + mismatch-branch idempotency + CRLF +
watermark-only edges) and a new `test/config-cache.test.mjs`
(T-C5C18-07, AC-4/AC-5: in-process mtime-driven reload + all existence-
transition cases). Phase 0.5 Expected-Red Diff run before any re-baseline:
5/5 manifest entries confirmed genuinely red, 0 unexplained reds — all 5
re-baselined. Full suite 1035/1035 pass, build clean, audit clean. Verdict:
**PASS**.

## Expected-Red Diff

Phase 0.5 ran the full suite (`node --test test/*.test.mjs`, equivalently
`npm test`) BEFORE touching any baseline, per
`qa_reports/expected-red_c5-c18-watermark-configcache.txt` (5 declared
entries). First run (after adding T-C5C18-06/07 tests, before any
re-baseline edit) showed **6** actual reds vs the 5-entry manifest — diff
is non-empty (1 extra entry), dispositioned below per SOP 2a:

- `test/subagent-templates.test.mjs | v3.21.1 AC1: every template body
  contains the watermark reminder with correct name+tier` — **on
  manifest.** Confirmed genuinely red: assertion still expected the OLD
  hardcoded-tier line; template now reads `... (<the model tier you were
  actually invoked with>) ...` per AC-1. Re-baselined the assertion to the
  tier-agnostic phrase; added a frontmatter-`model:`-still-present check so
  the test doesn't silently stop verifying AC-1's "frontmatter unchanged"
  clause.
- `test/subagent-templates.test.mjs | v3.21.2 AC1: every template body's
  FIRST non-blank line is the CRITICAL: watermark reminder` — **on
  manifest.** Same cause/fix as above, applied to the first-non-blank-line
  variant.
- `test/release-staging.test.mjs | AC5: release-engineer.md shim contains a
  reinforcement hint (<=2 sentences)` — **on manifest.** The shim's
  watermark-line-unaltered assertion hardcoded `(haiku)`; the shim's
  CRITICAL line is now tier-agnostic like every other template. Re-baselined
  the regex to match `(<the model tier you were actually invoked with>)`.
- `test/release-staging.test.mjs | C13-AC6: shim watermark and
  tw_get_state/tw_switch_role invocation lines are unaltered by the new
  hints` — **on manifest.** Same cause/fix as the AC5 case above (separate
  test, same hardcoded-tier regex).
- `test/context-budget.test.mjs | AC8/AC-P2-7: teamwork coordinator bundle
  (design-arm, both strips) is at/below the floor (≤ 9545 ~tok)` — **on
  manifest.** Confirmed genuinely red: actual stripped bundle measured at
  11445 ~tok against the pre-existing 11415 cap (skill-coordinator.md's
  Correction-strategy prose grew ~30 ~tok distinguishing absent→append from
  mismatched→replace, T-C5C18-03/AC-3). Re-baselined cap 11415 → 11445
  (exact-measured, no headroom, per this test's established convention).
- `test/config-cache.test.mjs | T-C5C18-07 AC-4 fast path: identical mtime
  serves the cached value (documented trade-off, not a defect)` — **NOT on
  manifest — QA's own new test, not a regression.** Root-caused to a bug in
  the *test fixture*, not the implementation: the fixture's `writeConfig`
  helper wrote raw JSON with no `schema_version`, so every `loadConfig` call
  triggered the migrate-on-read heal-write path (`atomicWriteConfig`),
  which rewrites the file via `fs.writeFileSync` + `renameSync` and stamps a
  REAL wall-clock mtime — silently overwriting the exact synthetic mtime the
  test had just pinned via `fs.utimesSync`, so the "same mtime" scenario the
  test intended to construct never actually existed on disk. Fixed by making
  `writeConfig` always stamp `schema_version: CURRENT_VERSIONS.config` so the
  heal-write path never fires and the pinned mtimes hold. Re-ran in
  isolation and in the full suite: green. Disposition: **test-fixture bug in
  qa-engineer's own new test, found and fixed before the manifest was
  touched — not a production regression** (`tools/config.ts` itself required
  no change).

Second run (after the fixture fix + the 5 re-baselines above): exactly 5
reds, all 5 on the manifest, 0 unexplained. Diff empty. Full suite green on
the third run (1035/1035).

## Copy Audit Gate

This spec has no `## Copy / Strings` H2 (unlike the PM-template norm — e.g.
`specs/c15-expected-red-manifest.md` and `specs/c16-c10-role-boundary.md`
both carry the section, marked N/A where inapplicable). This spec's
`## Fix design` section instead quotes the exact required copy verbatim
inline (the tier-agnostic CRITICAL line format under "C5(a)", the
absent/mismatched Correction-strategy distinction under "C5(b)", and the
step-10 driftBaselineIds note under "C18"). Audited the live files against
that inline-quoted text rather than failing on the missing table format
(no undocumented string was introduced — every changed string traces to
text the spec already quotes):

- `grep -c "CRITICAL: End every reply with .*(<the model tier you were
  actually invoked with>)\." templates/claude-code-agents/*.md` → all 12
  files, count 1 each. `grep -rnE "CRITICAL: End every reply with
  .*\((opus|sonnet|haiku|fable)\)" templates/` → zero matches (no residual
  hardcoded tier anywhere).
- `content/skill-coordinator.md:174` Correction-strategy line reads "absent:
  append the canonical suffix ... Mismatched (present but wrong name/tier):
  replace — strip the wrong trailing watermark line, then append the
  canonical suffix (exactly one watermark line, never two)" — matches the
  spec's Fix-design C5(b) wording exactly (AC-3).
- `content/skill-release-engineer.md` SOP step 10 gained: "The append takes
  effect immediately — `loadConfig` re-stats `.config.json`'s mtime on every
  call (v3.58.0, C18), so any `tw_detect_drift` in the same server process
  sees the new baseline with no restart needed." — matches the spec's
  Fix-design C18 wording exactly (AC-6).

No copy drift, no undocumented coverage gap. Not escalated to PM.

## Visual Audit Gate

No `## Visual Tokens` H2 either, for the same reason as above (no visual
literals in this feature — templates/skill docs are agent-instruction text,
not rendered UI). N/A, consistent with `specs/c15-expected-red-manifest.md`'s
precedent for non-UI features.

## Phase 1.5 — Visual Compare

Skipped (no Visual Baselines declared; no `design/c5-c18-watermark-configcache.md`
exists).

## Spec-to-Test Map

| AC | Test(s) |
|---|---|
| AC-1 (12 templates rephrased, frontmatter unchanged) | `test/subagent-templates.test.mjs` "v3.21.1 AC1" (re-baselined, now also asserts `model:` still present) + "v3.21.2 AC1" (re-baselined) + "v3.21.1 AC3" (frontmatter-fence structural guard, unchanged). Spec's "14 files" miscount independently re-confirmed as 12 (code-reviewer already caught this; re-verified live: `ls templates/claude-code-agents/*.md \| wc -l` → 12). |
| AC-2 (mismatch → replace, exactly one trailing line; absent/matching unchanged) | `test/watermark-check.test.mjs`: pre-existing `t-present-correct`, `t-absent-appends`, `t-wrong-name-treated-absent`, `t-wrong-tier-treated-absent`, `t-idempotent` (absent-branch idempotency, unchanged regression coverage) PLUS new T-C5C18-06 tests: `t-mismatch-no-double-stamp`, `t-mismatch-wrong-tier-no-double-stamp`, `t-mismatch-watermark-only-body`, `t-mismatch-crlf`, `t-mismatch-idempotent` (mismatch-branch idempotency specifically, distinct from the pre-existing absent-branch idempotency test). |
| AC-3 (skill-coordinator.md doc-sync) | Manually verified above (Copy Audit Gate) — doc-only AC, no dedicated unit test (same precedent as c15's AC-1: doc content not machine-parsed). |
| AC-4 (same-process content+mtime bump visible, no restart) | `test/config-cache.test.mjs`: "AC-4: content change + mtime bump is visible without restart", "AC-4: driftBaselineIds append is visible on the next loadConfig call", "AC-4 fast path: identical mtime serves the cached value" (documents the accepted same-mtime-collision trade-off code-reviewer flagged as non-blocking). |
| AC-5 (absent→create→delete→recreate, no crash, no stale caching) | `test/config-cache.test.mjs`: "AC-5: absent -> create -> delete -> recreate, no crash, no stale caching", "AC-5: repeated absent reads before creation never crash and stay empty", "AC-5: existence flip beats mtime equality (delete+recreate at same numeric mtime still refreshes)" — this last one specifically exercises the `null` vs `number` cache-key discriminator so a same-valued mtime across an existence flip can't produce a false cache hit. |
| AC-6 (skill-release-engineer.md doc-sync) | Manually verified above (Copy Audit Gate) — doc-only AC, no dedicated unit test. |
| AC-7 (build + test green) | This review's Build/Audit section below. |

## Coverage

`lib/watermark-check.ts`'s mismatch branch (~20 executable lines) is now
exercised by 5 new tests covering: body-preserved replace, tier-only
mismatch, watermark-only-body edge (`lastBreak === -1`), CRLF line-ending
normalization, and mismatch-branch-specific idempotency — all branches
reachable from the mismatch path are hit. `tools/config.ts`'s cache
compare/refresh logic (~15 executable lines added for C18) is exercised by
6 new tests covering both AC-4 transitions (content+mtime bump,
driftBaselineIds specifically) and all 3 AC-5 existence transitions (create,
delete, recreate, including the same-mtime-after-flip edge case). Estimated
line coverage on both modified files: effectively 100% of the new/changed
branches (no tooling instrumented; assessed by manual branch enumeration
against the diff, per SOP).

Security smoke: boundary inputs already covered by pre-existing
`t-empty-reply`/`t-whitespace-only-reply` (watermark-check) and
`T31 boundary: malformed JSON throws descriptive error` /
`non-object rejected` (config-versioning, unaffected by this feature's
change). No new auth/permission surface in either module.

## Build / Audit

- `npm run build` — clean (`tsc`, zero errors).
- `npm test` (`node --test test/*.test.mjs`) — 1035/1035 pass (0 fail) after
  the fixture fix + 5 re-baselines. No flakes observed on this run (the
  known `test/handoff-write-arg-guard.test.mjs` AC-1 timing flake did not
  fire).
- `npm audit --audit-level=high` — clean (exit 0; 1 low-severity `esbuild`
  dev-server advisory, below threshold, pre-existing and unrelated to this
  feature).

## Verdict

**PASS** — T-C5C18-01..08 all satisfied. AC-1..AC-7 conformant. Spec's "14
files" miscount independently re-confirmed as 12 (already caught by
code-reviewer). No blocking findings. One qa-owned test-fixture bug was
found and fixed in QA's own new test before it ever touched the manifest
or a re-baseline (see Expected-Red Diff) — not a production defect.
## 2026-07-09T19:35:39.970Z — PASS — by qa-engineer

Phase 0.5 Expected-Red Diff run BEFORE re-baseline: 5/5 manifest entries confirmed genuinely red (2 subagent-templates tier-agnostic assertions, 2 release-staging shim watermark assertions, 1 context-budget teamwork design-arm floor); 1 unexplained red found in QA's own new test/config-cache.test.mjs (fast-path test), root-caused to a test-fixture bug (writeConfig omitted schema_version, so every loadConfig call triggered the migrate-on-read heal-write, stomping the pinned synthetic mtime) — fixed in the fixture itself, not a production regression. Full disposition recorded under ## Expected-Red Diff in qa_reports/review_T-C5C18-06.md. Re-baselined all 5 manifest entries (tier-agnostic phrasing in subagent-templates.test.mjs x2 and release-staging.test.mjs x2; context-budget teamwork design-arm floor 11415->11445). Authored T-C5C18-06 (test/watermark-check.test.mjs: 5 new mismatch-branch tests — no-double-stamp, wrong-tier, watermark-only-body, CRLF, mismatch-branch-specific idempotency) and T-C5C18-07 (new test/config-cache.test.mjs: 6 tests covering AC-4 in-process mtime-driven reload + driftBaselineIds visibility + documented same-mtime trade-off, and AC-5 all existence-transition cases incl. existence-flip-beats-mtime-equality). Copy/Visual Audit Gates: spec lacks the Copy/Strings and Visual Tokens H2s (unlike sibling specs), so audited the changed strings against the spec's Fix-design section verbatim quotes instead — all 12 templates + skill-coordinator.md + skill-release-engineer.md match exactly, zero residual hardcoded tiers, no undocumented coverage gap; not escalated to PM. Spec's "14 files" miscount re-confirmed as 12 (already caught by code-reviewer). Full suite 1035/1035 pass, npm run build clean, npm audit --audit-level=high clean (1 low-severity esbuild advisory, below threshold).

