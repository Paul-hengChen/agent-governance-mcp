# Review — T-E349-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Diff judged: `git diff fac8990 aecfd29 -- content docs`. Spec: `specs/e226-integrator-sop-portable.md`.

## Summary
- Integrator SOP repo facts now point at the addendum (shared artifacts, build, bookkeeping check) or at Constitution §6 (the dependency audit). The addendum's §5 gains three bullets.
- All ten strings this task owns are verbatim, each occurring once: `sop.stage1-shared`, `sop.basefix-5`, `sop.verifier-build`, `sop.5b-4` (both halves), `sop.5b-5`, `sop.5b-6`, `sop.5c-3`, `add.5-tools`, `add.5-ci` and `add.5-bookkeeping`.
- In the addendum, the diff is `@@ -30,0 +31,3 @@` and nothing else. The headings are unchanged, the existing §5 `fanout.mjs` line is untouched, and §7 is byte-identical.
- Verdict: CHANGES_REQUESTED, only for the lane-wide missing expected-red manifest.

## AC Completeness
AC-E349-1 — implemented — content/skill-integrator.md has 0 matches for each of `content/**`, `compose-golden`, `context-budget.test`, `npm run build`, `npm audit`, `check:bookkeeping` and `dist/`. Strings are at stage1-shared :91, basefix-5 :134, verifier-build :162, 5b-4 :175, 5b-6 :180 and 5c-3 :188.
AC-E349-2 — implemented — in docs/lane-protocol-addendum.md, the `## ` headings are unchanged. Line 30 (`fanout.mjs`) is untouched, and lines 31–33 are add.5-tools, add.5-ci and add.5-bookkeeping, in order. §7 (lines 35–38) is unchanged. `node scripts/<tool>.mjs` is present for fanout, mailbox-watch, lane-status, merge-invariants, test-lock and feature-rollup, plus `node scripts/verify-release.mjs --ci-check --sha <sha>`.
AC-E349-3 — implemented — the five hard-condition files pass 49/49 on `aecfd29`, and none of them is in the diff.

## Correctness
- **required** (lane-wide, same finding as review_T-E226-01.md) — the expected-red manifest is missing. This task owns these reds: e178a AC9 (:285 → `sop.5b-5`), e178a AC13 (:348 → `sop.verifier-build`), e286 AC1 "human owns the vehicle decision" (:56 `need` list and `item(5)` :74–75 → `sop.basefix-5`), e295 AC8 (:88) and e295 AC10 (:104). The manifest must list e178a AC9, which the spec's *Planned re-pins* table leaves out; qa's T-E349-02 must re-pin it.
- Constitution §6 really does require the audit: content/const-15-core-tail.md says "MUST also run the language's audit command (`npm audit --audit-level=high`, …) after build". The `sop.basefix-5` citation is therefore accurate, and the audit correctly stays generic (decision C1c).

## Quality
- **recommended** (follow-up, not this lane) — docs/lane-protocol-addendum.md:3 says the addendum 「只填通用規則寫「見補充規則」的地方」 ("only fills places where the generic rules say 'see the supplementary rules'"). The generic `docs/lane-protocol.md` §5 defers only the `fanout.mjs` call form (「補充規則可指定本 repo 的呼叫方式」, "the supplementary rules may give this repo's call form"). The three new bullets fill places named by the integrator SOP's *Tool calls* paragraph instead. Two of them, the CI check and 5c bookkeeping, are not mailbox (信箱) concerns. This is not a defect of this diff: the strings are spec-verbatim under human decision D1, the AC freezes the headings, and the AC forbids other line changes. Each bullet also names its reader (「整合者 SOP …」 / 「整合者 5c …」, "the integrator SOP …" / "integrator 5c …"), so a lane reader will not misapply them. Suggest filing a finding to widen line 3 to cover "places the integrator SOP points at the addendum", or to give integrator-only facts their own heading.
- `add.5-tools` placement is reasonable. It sits directly after the generic §5's only "見補充規則" site (the fanout call form) and extends the same call-form rule to the other scripts, including `feature-rollup` (decision C2).

## Architecture
No architecture spec. Repo facts move out of the generic SOP and into the addendum, which follows the two-layer rule (generic plus addendum) that the integrator SOP Render paragraph states. No new config key or file is added (D1).

## Security
No findings. The addendum's new lines hold only repo-relative commands. No absolute path, no secret.

## Performance
No findings. Text only. The addendum is not in the rendered prompt (e290 AC-E290-8/9 pass).

## Verdict
CHANGES_REQUESTED — T-E349-01's text is correct and in scope. The verdict carries only the lane-wide expected-red manifest finding, and that manifest must include e178a AC9.
