# Judge report — T-E434-01 (feature e434-reviewer-visual, test-first chain)

covers: T-E434-01, T-E434-02, T-E434-03, T-E434-04, T-E434-05, T-E434-06, T-E434-07, T-E434-08

## Round 1 — by code-reviewer

Full suite, clean tree at 7a3ca66 (only this hop's `.current/e434/handoff.md` writes uncommitted): `node scripts/test-lock.mjs -- npm test` → `# tests 4525`, `# pass 4523`, `# fail 0`, `# skipped 2`, exit 0. The 2 skips are the pre-existing history-dependent e130 checks (commit 121ddc8 not resolvable), same as base.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e434-reviewer-visual.txt`: 73 entries (56 scenario / re-pin reds from T-E434-01/02 + 17 snapshot reds from T-E434-07), final line states no expected red remains. Actual reds in the suite: 0.

- 56 scenario / re-pin entries (e434 AC1–AC5, AC8, AC9, AC10, AC11; subagent-templates, e412, e360, e391, e393, e410, e437, e438, e439, widget-shape-spec, skill-evolution-v3.11, pixel-perfect-visual-compare, qa-visual-skill-split, phase-0-5-sop AC-4, constitution-deliverable-guard A4, e295 AC11, e308 E303-AC11a): scenario tests, now green — built (T-E434-03..07).
- 17 snapshot entries (11 compose-equivalence goldens, skill-manifest t-golden-byte-identity, 5 context-budget sites incl. the pm cap retitled `≤ 4999`): snapshot tests, now green — re-captured by qa in T-E434-08 (R3 (b)).
- Actual reds not on the manifest: none.

Result: clean — every manifest entry green, zero off-manifest reds.

## AC Execution Log

Build current (`dist/` committed; `git diff --name-only e5ccda0...HEAD -- dist/` lists only the four owned groups). Per-AC runs: `node --test --test-reporter=spec test/e434-reviewer-visual.test.mjs` → 12 tests, 12 pass, 0 fail, 0 skipped (`LANE_END_SHA` 11073f3 reachable, so the closed-range checks ran, none skipped).

- AC1 — `node --test --test-name-pattern "AC1:" test/e434-reviewer-visual.test.mjs` — ✔ pass (also `test/subagent-templates.test.mjs` green in the full suite).
- AC2 — `node --test --test-name-pattern "AC2:" test/e434-reviewer-visual.test.mjs` — ✔ pass. Extra check by the judge: composed the non-design code-reviewer prompt at base e5ccda0 and at HEAD (`buildPromptForRole("skill-code-reviewer.md", "code-reviewer", <temp ws>)`) and diffed — differences are step 6a, the const-01 Limits example + two rows and the const-05 note-token list (AC9 (b) / D16), nothing else. Clause read as the SOP part — pass.
- AC3 — `--test-name-pattern "AC3:"` — ✔ pass; `grep -rn qa-visual content/` → no hit; `gates/registry.ts` only the two historical spec file names (:474, :512).
- AC4 — `--test-name-pattern "AC4:"` — ✔ pass.
- AC5 — `--test-name-pattern "AC5:"` — ✔ pass.
- AC6 — `--test-name-pattern "AC6:"` — ✔ pass (PASS accepted, no visual code).
- AC7 — `--test-name-pattern "AC7:"` — ✔ pass (PASS accepted with an `accepted` surface).
- AC8 — `--test-name-pattern "AC8:"` — ✔ pass (`VISUAL_EVIDENCE_MISSING`, expected path, `hint.visual_evidence`).
- AC9 — `--test-name-pattern "AC9:"` — ✔ pass ((a) `review_round` +1, `visual_round` unchanged; (b) served text); `grep -rnE "visual_round|visual_split|visual_fail|VISUAL_ROUND_EXCEEDED|Phase 1\.5" content/` → no hit.
- AC10 — `--test-name-pattern "AC10:"` — ✔ pass (35 entries, 17 steps, D21 digest equal); `test/error-code-contract.test.mjs` green in the full suite.
- AC11 — `--test-name-pattern "AC11:"` — ✔ pass (incl. the offline bundle one-liner printing `true`).
- AC12 — `node --test test/compose-equivalence.test.mjs test/context-budget.test.mjs test/skill-manifest.test.mjs` — 97 tests, 97 pass, 0 fail, exit 0.
- AC13 — `node scripts/test-lock.mjs -- npm test; echo "exit=$?"` → 4525 / 4523 pass / 0 fail / 2 skipped, exit=0; `--test-name-pattern "AC13:"` ✔ pass; `wc -l CLAUDE.md` → 250; `node bin/agc-init.mjs check` → exit 0 (`OK (4.23.0)`, 13 advisory comment warnings, dispositioned in `review_reports/review_T-E434-01.md` Quality); `npm audit --audit-level=high` → exit 0; `node scripts/fanout.mjs check --cut …/specs/fanout-v5-w5.md e434 specs/e434-reviewer-visual.md` → 0 out of bounds, exit 0.
## 2026-11-23T10:24:46.100Z — PASS — by code-reviewer

suite-result: 4523/4525 passed (server-recorded from qa_suite_result; command: node scripts/test-lock.mjs -- npm test)

code-reviewer PASS (APPROVED) for e434-reviewer-visual, T-E434-01..08 (covers: line in review_reports/review_T-E434-01.md and qa_reports/review_T-E434-01.md). Full suite on the clean tree: 4525 tests, 4523 pass, 0 fail, 2 skipped (pre-existing e130 history-dependent skips), exit 0. AC1-AC13 all pass (AC Execution Log). Expected-Red Diff clean: 73 manifest entries all green (56 built, 17 snapshots re-captured in T-E434-08), zero off-manifest reds. Copy audit: every Copy / Strings row verbatim. Scope: fanout check --cut 0 out of bounds; manifest line/section restrictions checked by hand (registry hints / mapping / field comment / one documentedInProse; README :107; docs/config list + note; comment-only edits in gates/visual.ts, tools/evidence-file.ts, tools/handoff-orchestrator.ts; transitions / schema / prompts / CLAUDE.md untouched, CLAUDE.md 250 lines); dist only the four owned groups; agc check exit 0; npm audit --audit-level=high exit 0. Ruling on note (1): AC2's last clause read as the code-reviewer SOP part — the spec's own AC9 (b) / D16 change core const-01/05 in every composition; the judge composed the non-design code-reviewer prompt at base and HEAD and the only differences are step 6a plus those AC9 (b) / D16 edits; not a scenario defect. Ruling on note (2): agc check comment advisories kept — registry mapping block pre-exists on base and is read by error-code-contract; context-budget long blocks are the file's cap-history convention with the one re-baseline line AC12 requires. Recommended (report-only, non-blocking): e360 AC-E360-1 lacks a calls-count assertion; e393 AC-A2 could pin 3 const-11 bullets; pm may word AC2-style clauses as 'the SOP part'. review_report: review_reports/review_T-E434-01.md

