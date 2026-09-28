# Review — T-E8795-02

covers: T-E8795-01, T-E8795-02

## Phase 0 — Claim

QA claiming review of T-E8795-01 / T-E8795-02. code-reviewer round 2 APPROVED (review_reports/review_T-E8795-01.md), handoff `pending_notes` read in full (not the truncated `tw_get_state` view) for exact scope, numbers, and the two non-blocking items to record but not fix.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e87-e95-release-citation-accuracy.txt` manifest declared). sr-engineer's own note and code-reviewer's independent confirmation agree the diff touches nothing under `test/`, so SOP 4a expected-red sampling never armed for this ticket.

## Phase 1 — Review

Read `content/coord-03-core-fallback.md:52-55` (new `## Evidence-Citation Convention`, E87) and `content/skill-release-engineer.md:203-206` (new CHANGELOG citation check bullet, E95), plus code-reviewer's round 1 and round 2 (`review_reports/review_T-E8795-01.md`). No new correctness/architecture findings of my own — round 2 already closed F1-F4 and the round 2 verdict is APPROVED; QA scope here is the re-baseline + behavioural pin, not a second correctness pass. Copy Audit / Visual Audit gates: not applicable (no `specs/<feature>.md` Copy/Strings or Visual Tokens sections — this is a mini-chain content cut, backlog rows serve as the spec). Phase 1.5 Visual Compare: skipped, no `design/<feature>.md`.

## Re-baseline 1 — test/context-budget.test.mjs AC8/AC-P2-7 design-arm coordinator floor

Independently re-measured (not trusted from sr-engineer's or code-reviewer's figure, though both reported it across two review rounds) through the exact render path the assertion uses:

```
composeConstitution({ chain: true, design: true }) -> stripOriginTags -> stripRationale   (constitution side)
composeSkill("skill-coordinator.md", hostCapabilitiesFor("claude-code"), readContent)
  -> frontmatter stripped -> stripOriginTags -> stripRationale                             (skill side)
bundle = approxTokens(constitution_stripped + "\n\n---\n\n" + skill_stripped)
```

Result: **18369 ~tok**, exactly matching the settled figure. `test/context-budget.test.mjs:1385` raised from `18303` to `18369` (exact, no headroom, per the file's documented Phase-2 convention), with a rationale comment naming E87/E95, the source of the +66, and an explicit note that `coord-03-core-fallback.md` lands in THIS bundle only.

**Confirmed the other AC8 floors are untouched**, as the reviewer flagged explicitly: `coord-*.md` fragments are never part of `CONSTITUTION` (only `const-*.md` composes it), so the constitution-only floors (design-arm stripped ≤ 9374 at :1089, non-design ≤ 7276 at :1771, and the raw/stripped saving-margin assertions) do not measure anything this feature touched. Full suite run below re-confirms all of them still pass unchanged.

## Re-baseline 2 — test/fixtures/compose-golden/skill-coordinator-monolith.txt

Regenerated via the standing tool, `node scripts/capture-constitution-golden.mjs` (the real `composeSkill` pipeline, fail-loud, all 12 fixtures re-derived from source). Diff-confirmed the regeneration touches only the intended span:

```
$ git status --short test/fixtures/compose-golden/
 M test/fixtures/compose-golden/skill-coordinator-monolith.txt
```

The other 11 fixtures (8 build.ts modes, 2 hook fixtures, the constitution monolith) are byte-identical post-regeneration — none of them compose `content/coord-03-core-fallback.md`'s new section into their scope, or they do but the tool re-derived them to the same bytes, either way `git status` shows zero diff for them. The one file that DID change shows exactly the E87 heading + normative sentence + rationale fence, nothing else:

```diff
+## Evidence-Citation Convention<!-- origin:start --> (E87)<!-- origin:end -->
+
+A `docs/backlog.md` row that cites a `qa_reports/`/`review_reports/` evidence file MUST cite its eventual archive path — `<tree>/archive/<feature>/<file>`, `<tree>` matching the file's own source tree — never the pre-archive root.
+<!-- rationale:start --> Release-engineer's step 7a moves it there at the next release regardless of which row cites it, and no role is authorized to repair a stale citation afterward. <!-- rationale:end -->
```

This is the check that stops a golden refresh from laundering an unrelated change into the baseline — confirmed clean.

## Behavioural pin (load-bearing — the part a golden refresh + cap bump alone would NOT provide)

A regenerated golden and a raised cap both still pass even if the new convention text were silently dropped from source (the golden re-captures whatever the composer currently emits; the cap only gets easier to clear). Appended to `test/render-structure.test.mjs` (the file already renders composed output via `buildPromptForRole`/`switchRole` — the natural home; no new file needed) 5 new tests:

1. **coord-03 E87, fullDetail=false**: coordinator bundle contains the `## Evidence-Citation Convention` heading and the `<tree>/archive/<feature>/<file>` template; rationale prose absent; zero raw `rationale:start|end` / `origin:start|end` markers survive.
2. **coord-03 E87, fullDetail=true**: same heading + template present, PLUS rationale prose now present (rationale fence is opt-out, not deletion); origin markers still zero (stripOriginTags is unconditional regardless of fullDetail — verified from `prompts/text-transforms.ts` `applyTextTransforms`, which calls `stripOriginTags` unconditionally and only gates `stripRationale` on `fullDetail`).
3. **skill-release-engineer.md E95, fullDetail=false**: release-engineer bundle contains the `CHANGELOG citation check (E95)` bullet; rationale prose (the v3.104.2 worked example) absent; zero raw markers.
4. **skill-release-engineer.md E95, fullDetail=true**: bullet present, rationale prose present, origin markers still zero.
5. **Regression guard**: `findLineGlueFindings` (this file's own existing line-glue detector, the one that caught the E69 defect class) returns `[]` for both the coordinator bundle and the `tw_switch_role("release-engineer")` dispatch text — proves the E87/E95 fences are block-style, not the asymmetric-inline shape sr-engineer hit and fixed mid-round.

**One methodological note worth recording**: the positive/inverse assertions render the composed **skill body** directly (`composeSkill` + `applyTextTransforms`, mirroring `test/context-budget.test.mjs`'s own `readSkillFile` helper), not `buildPromptForRole`'s full dispatch text. Reason: `buildPromptForRole`'s output also concatenates this workspace's LIVE `.current/handoff.md` state as a trailing JSON block, and this very feature's own `pending_notes` prose (mine, sr-engineer's, code-reviewer's) literally discusses the strings `rationale:start`/`origin:start` as descriptive text about the mechanism — which would falsely trip a raw marker-count assertion if it were run against the live-state-polluted text. Verified this empirically before writing the test (a throwaway script counted 1 spurious "origin marker" and 1 spurious "rationale marker" via `buildPromptForRole` at fullDetail=false, traced to the state-block JSON dump, zero via the composed-body-only path). The glue-regression test (#5 above) still exercises the real `tw_switch_role` dispatch path for release-engineer, since that path returns `{sop: ...}` with no state block and needed no such isolation.

## Phase 3.5 — AC Execution Log

Skipped (no `specs/<active_feature>.md` — mini-chain, backlog-row-as-spec; no `proof:`-annotated ACs exist to execute).

## Phase 4 — Run

- `npm run build`: clean (`tsc` 0 errors; `check:version` OK 3.109.0; `check:transitions-sync` OK 21 keys).
- `npm run check:md-tables`: OK (242 files scanned, 0 malformed tables).
- `npm test`: **1864/1864 pass, 0 fail** (1859 baseline − the 2 known expected reds fixed by this ticket + 5 net new render-structure tests + 2 = 1864; confirmed both previously-red tests — `AC8/AC-P2-7: teamwork coordinator bundle ... (≤ 18303 ~tok)` and `t-golden-byte-identity` — are now green under their re-baselined form).

## Non-blocking items (recorded per code-reviewer's instruction — NOT fixed, NOT gating this PASS)

1. **`<feature>` template residual**: the E87 archive-path template's `<feature>` resolves to the RELEASING `active_feature`, not the citing row's own feature — a residual of the archive mechanism itself (`skill-release-engineer.md:138` names the archive dir after `active_feature` regardless of `<CODES>` count). Correct under this batch's own workflow (nothing commits until the shared release ships) but would mis-resolve for a row whose evidence ends up shipping under a different `active_feature` later (re-split, rename, abandonment). Fixable only by E87 option (iii), which the backlog row already anticipates.
2. **E95 check is path-granular, not hunk-granular**: `git diff --cached --name-only` catches 3 of the 4 miscitations in its own v3.104.2 worked example but not `content/skill-release-engineer.md`, which was staged for an unrelated change and so passes a path-presence test. The rule as written is correct, self-consistent, and enforceable; closing this gap needs hunk-level verification, which costs more than a P3 convention warrants per the reviewer's cost ruling. A backlog row rather than a fix here.

## Boundaries respected

`cut_approved` not written by qa-engineer (already true, PM/coordinator's write). Neither the E87 nor E95 `docs/backlog.md` row done-marked (release-engineer, SOP 7c). Nothing committed. `test/e117-void-task.test.mjs` and `test/e121-tasks-file-injection.test.mjs` untouched (verified via `git status --short`/`git diff --stat` before finishing — only `test/context-budget.test.mjs`, `test/render-structure.test.mjs`, and `test/fixtures/compose-golden/skill-coordinator-monolith.txt` carry my edits).
## 2026-09-15T13:22:56.660Z — PASS — by qa-engineer

PASS. Verified code-reviewer round 2 APPROVED (review_reports/review_T-E8795-01.md) on the E87 Evidence-Citation Convention (content/coord-03-core-fallback.md:52) and E95 CHANGELOG citation check (content/skill-release-engineer.md:203). Two qa-owned re-baselines completed and verified: (1) test/context-budget.test.mjs AC8/AC-P2-7 design-arm coordinator floor raised 18303 -> 18369, independently re-measured through the exact render path the assertion uses (confirms the settled figure exactly); confirmed the other AC8 floors (constitution-only) are untouched since coord-*.md is never part of CONSTITUTION. (2) test/fixtures/compose-golden/skill-coordinator-monolith.txt regenerated via scripts/capture-constitution-golden.mjs (the real composeSkill pipeline); diff-confirmed only the intended E87 span changed, all other 11 fixtures byte-identical. Behavioural pin (load-bearing, not provided by the golden+cap alone): 5 new tests appended to test/render-structure.test.mjs asserting the E87 heading/template and E95 bullet actually render in the coordinator/release-engineer bundles at fullDetail=true AND fullDetail=false, the inverse at fullDetail=false (rationale prose absent, zero raw rationale:/origin: markers survive), and a line-glue regression guard confirming both fences are block-style (not the asymmetric-inline shape sr-engineer hit and fixed mid-round). Recorded two non-blocking items per code-reviewer's instruction without fixing them or gating PASS: the <feature> template residual (resolves to the releasing active_feature, not the citing row's) and the E95 check's path-vs-hunk granularity gap. npm run build clean, npm run check:md-tables OK (242 files, 0 malformed), full suite 1864/1864 pass 0 fail (both previously-red tests now green under re-baselined form). Evidence: qa_reports/review_T-E8795-02.md (covers: T-E8795-01, T-E8795-02). Boundaries respected: cut_approved not touched, neither E87 nor E95 backlog row done-marked, nothing committed, test/e117-void-task.test.mjs and test/e121-tasks-file-injection.test.mjs untouched.

