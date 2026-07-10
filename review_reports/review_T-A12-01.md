# Review — T-A12-01

covers: T-A12-01, T-A12-02, T-A12-03, T-A12-05, T-A12-06, T-A12-07

## Round 1 — APPROVED — by code-reviewer

## Summary
- Ticket `a12-partials-limits-registry`, text/build-composition only. Part 1: a `{{PARTIAL:token}}` skill-body substitution mechanism (`prompts/partials-manifest.ts` + wiring in both render paths); Part 2: a canonical `## Limits` table in `const-01` plus reference-by-name rewrites across 4 const fragments and 7 skills.
- 23 files in the working tree; source-of-record changes reviewed: 1 new TS module, 2 TS wirings (`build.ts`, `role.ts`), 1 new partial content file, 5 const + 9 skill markdown edits. `dist/*` is the committed build output (matches `npm run build`, zero errors).
- All five review axes verified empirically: partials contract (single non-recursive pass, DR-3 one-newline strip, DR-6 fail-loud, fs-free); BOTH render paths wired; AC2 byte-identity of the partial mechanism proven by unit assertion; Limits values and all rewrite-map [NAME]/[KEEP-DERIVED]/[LEAVE] sites correct; transitions.ts `VISUAL_ROUND_CAP=6` and all test files untouched.
- One out-of-scope residual (const-06 L8 qa_round restatement) correctly left untouched and flagged to PM — sound scope discipline, not a defect.
- Verdict: APPROVED.

## Correctness
No blocking findings.

- `prompts/partials-manifest.ts:43-49` — `expandPartials` uses a single `String.replace(PARTIAL_RE, …)` with a `/g` regex; substituted text is not re-scanned. Verified empirically: a `{{PARTIAL:step1-preflight}}` returned inside a loaded partial body is left verbatim (non-recursive per Out of Scope / DR). Correct.
- DR-3 trailing-newline rule (`partials-manifest.ts:48`, `load(file).replace(/\r?\n$/, "")`): the partial file `content/partial-step1-preflight.md` is exactly `1. \`tw_get_state\` → \`tw_detect_drift\`.` + one `0a` (verified via `xxd`; arrow = U+2192; no leading indent, no trailing blank line). Empirical AC2 assertion `expandPartials("{{PARTIAL:step1-preflight}}", loader) === "1. \`tw_get_state\` → \`tw_detect_drift\`."` returns `true`.
- DR-6 fail-loud (`partials-manifest.ts:45-46`): unknown token → `[ERROR: unknown partial token 'nope']` (verified). Mirrors `loadContent`'s actual no-backtick marker convention (`build.ts:45` — `[ERROR: … not found …]`); the architecture doc's backticks were markdown formatting, so the implementation is consistent with the real precedent.
- Both render paths wired: `build.ts:368` expands before `parseSkillFile` (expand → parse → stripOriginTags → stripRationale, so the fence-free partial body is inert to the downstream strippers); `role.ts:64-72` wires an equivalent `.current`-override-aware `loadPartial` closure before `parseSkillFile`. `tw_switch_role` no longer leaks a raw token for any of the 5 adopting roles.

## Quality
No blocking findings.

- The token appears in exactly the 5 spec'd files (architect, pm, design-auditor, researcher, sr-engineer) and nowhere else; the DR-5 boundary holds — `grep "{{PARTIAL:"` over all `const-*.md`, `skill-coordinator.md`, `skill-coordinator-lite.md` returns nothing.
- AC1 restatement removals present and correct in all three files: skill-design-auditor step 6, skill-researcher step 4, skill-sr-engineer step 8 each drop the "on failure, still call `tw_update_state`" restatement (the const-05 bullet is now the sole source).
- Minor (non-blocking) — a few [NAME] rewrites read slightly awkwardly, e.g. const-08 "After the `review_round` cap of code-reviewer FAILs" and const-15 "Max consecutive auto-fix tries … is the `fix_try` cap". Meaning is preserved and each follows the rewrite map faithfully; readability polish is optional and not worth a round.
- Minor (non-blocking) — the two render paths differ on the missing-partial-*file* edge for a *known* token: `build.ts` (via `loadContent`) returns an `[ERROR: … not found]` marker, while `role.ts`'s raw-`fs.readFileSync` closure throws. Both match the architecture's specified loader shapes exactly (spec lines 74 / 80-85), and the case only fires on a corrupted checkout (the registry is curated + the file is committed) — both behaviors are fail-loud. No action required.

## Architecture
Conforms to the blueprint.

- DR-1: new `prompts/partials-manifest.ts` mirrors `constitution-manifest.ts` (data registry + pure function, fs-free via injected `load`). DR-4: both render paths wired with per-site override-aware loaders. DR-5: coordinator/const files render outside `expandPartials` and carry no token (verified).
- AC2 byte-identity is correctly scoped per the architecture's Byte-Identity Contract: the *partial refactor* is a pure source refactor (proven by the unit assertion above), evaluated on the step-1 line. The other skill-slice changes in pm/design-auditor/researcher/sr-engineer are the deliberate AC1 (restatement deletion) and AC4 (limit-name) edits — separate acceptance criteria in the same ticket — so full-file identity is neither expected nor required for those four; only skill-architect (partial swap only) is fully byte-identical. This reading is consistent with the spec + architecture; no contradiction.
- Limits table (`const-01`) values match DR-2 exactly: 3 / 3 / 5 / 10 / 2 / 3 / 250 lines × 5 passes / ≤ 5 files / 300 lines (user-visible framing; server-internal cap+1 indices correctly excluded).
- Rewrite-map compliance verified site-by-site. [LEAVE] sites intact: const-09 split-hatch "Split escalation (Round 3)" / `visual_round >= 3`; skill-sr-engineer `visual_round >= 3` (L28/L48); design-auditor per-surface "max 3 extraction attempts / max 5 files read per surface" (L70); qa-visual carry-forward "round ≥ 2" / `visual_round 0/1` (L30). [KEEP-DERIVED] indices (Round 4 / Round 6) preserved and phrased relative to the named cap.
- T-A12-07 headline drift resolved: skill-qa-visual L77 "round cap (6)" → "`visual_round` cap (Round 6 attempts)", aligning to the const-09 canonical framing (cap = 5, Round 6 = derived lock index). `transitions.ts VISUAL_ROUND_CAP=6` untouched (confirmed via git status; the constant is a framing-independent server counter).

## Security
No findings. `expandPartials` is pure with no eval/dynamic import; the token capture group is bounded to `[a-z0-9-]+` (no path separators, no `..`), and the substituted filename is always drawn from the curated `PARTIALS` registry (an unknown token short-circuits to the error marker before any `load`). Both loaders read only from `<workspace>/.current/<file>` or the server `CONTENT_DIR` — the same trust boundary as existing skill loading, not widened. No new input crosses a trust boundary; the output is markdown consumed as an agent prompt, not executed.

## Performance
No findings. `expandPartials` is a single O(n) regex pass over the skill text with one extra file read per matched token (one token, one read per role render) — negligible versus the existing per-render file I/O. Pure and idempotent, so the compose-golden / compose-equivalence loops that call the render paths repeatedly incur no accumulating state. No hot-path or complexity-class regression vs base.

## Verdict
APPROVED — the partials mechanism and Limits-table rewrites match `specs/a12-partials-limits-registry.md` (AC1-AC4) and the architecture (DR-1..DR-6 + rewrite map); AC2 partial byte-identity, DR-3/DR-6 behavior, both render paths, all [LEAVE]/[KEEP-DERIVED] sites, and the transitions.ts / test-file untouched-guarantees are all verified empirically. The const-06 L8 residual `qa_round` restatement is correctly outside the AC4 file list and blueprint rewrite map; leaving it untouched and flagging it to PM is proper scope discipline, not a miss — recommend PM triage it as a follow-up. Test re-baselines (T-A12-04/08/09) are qa-owned and correctly catalogued in `qa_reports/expected-red_a12-partials-limits-registry.txt` (18 reds; ≥3 sampled and confirmed to be real, locatable tests; the two literal-text collisions in design-auditor-volume-guard + pixel-perfect-design-coverage are flagged as AC7 scope beyond the two suites AC7 named — a note for qa).
