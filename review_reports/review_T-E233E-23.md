# Review — T-E233E-23

covers: T-E233E-14, T-E233E-15, T-E233E-16, T-E233E-17, T-E233E-18, T-E233E-19, T-E233E-20, T-E233E-21, T-E233E-22

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Range reviewed: `6c61864..1a06a4b`, `test/` only. 17 of the 38 owned files changed, 48 comment lines rewritten (48 insertions, 47 deletions).
- The lines that were rewritten are good. Each one is comments-only, states the behaviour in plain words, and keeps the id as a trailing pointer. Both mechanical scripts pass.
- AC1 is only partly met. A sweep of every owned file still finds about 391 comment lines that lead with an id (heuristic upper bound), and many of them need an id to make sense. 21 owned files are untouched, including 14 that tasks 16-22 assigned and that clearly carry id-led comments (for example stale-dispatch-detection, skill-manifest, watermark-check, telemetry, repro-first-gate). release-staging (6 lines changed) and verify-release (4 lines changed) keep 36 and 108 id-led lines, although the spec itself sized them at about 200 and 155.
- Verdict: CHANGES_REQUESTED.

## AC Completeness
AC1 — partial — rewritten lines conform (e.g. test/verify-release.test.mjs:828-831, test/rag-lifecycle.test.mjs:148), but the owned set still has id-led or id-dependent comments; see the per-file table under Correctness. `required`.
AC2 — implemented — `check-comments-only.mjs 6c61864` prints `comments-only OK: 17 files`, exit 0.
AC3 — implemented — the same script's path-containment step passes. Every changed `test/` path is in the owned set, and no fixture, source, `dist/`, `docs/` or `content/` path is touched.
AC4 — implemented — the 48 added `test/` lines contain no URL and no user-home absolute path (scan pattern built at run time; 0 hits). No codename, file key or credential.
AC5 — out of scope for this task (T-E233E-24).
AC6 — implemented — no `test(` name line appears in the diff. String literals are unchanged, which the AC2 transpile comparison proves.

## Correctness
Commands run: `check-comments-only.mjs 6c61864` (OK, 17 files), `check-id-only.mjs` (advisory: 9 lines listed, 1050 id-mentioning comment lines across 38 files). I also ran my own sweep, with the same case-insensitive id matcher (it covers lowercase ids with letter or digit segments such as e178a and e123b9, `-NEW-n` suffixes, and task ids such as T-D4-01). The sweep flags any comment line whose text starts with an id, optionally after a short lead word such as "per" or "see". Its counts are an upper bound: a few hits are wrapped continuation lines, for example release-staging:846 and :1729.

**R1 (`required`) — AC1 is not met across the owned set.** Per-file results (id-mentioning comment lines / id-led lines / verdict / representative lines):

| file | id lines | id-led | changed | verdict | representative lines |
|---|---|---|---|---|---|
| test/eval/lib/assertions.mjs | 16 | 3 | yes | FAIL | 2 "D4 behavioral-eval harness ... (T-D4-03, spec AC-1..AC-5)"; 149 "exactly (spec AC-3)" |
| test/eval/lib/bundle.mjs | 4 | 1 | no | FAIL | 2 "D4 behavioral-eval harness — bundle loader (T-D4-01, spec AC-8)" |
| test/eval/run-eval.mjs | 9 | 3 | no | FAIL | 3 (D4 header), 11 "T-D4-03) against the reply text", 39 "AC-11 — fail fast ..." |
| test/eval/scenarios.mjs | 7 | 1 | no | FAIL | 2 (D4 header) |
| test/rag-lifecycle.test.mjs | 7 | 1 | yes | FAIL | 72 "AC1, AC12 — prd_path schema ..." (same header form as :148, which was rewritten) |
| test/rag.test.mjs | 0 | 0 | no | OK | - |
| test/release-staging.test.mjs | 247 | 36 | yes | FAIL | 7-16 AC map; 385 "C1 regression guard"; 1741 "E50 round 1 — (a) closed N4"; 1920/1951 "N14 ..."; 2124 "F2 (round 1 BLOCKING, CLOSED round 2)"; 2164 "N16: ..."; 2711 "T-E76-02 pins (E76 round 2 ...)" |
| test/repro-first-gate.test.mjs | 27 | 15 | no | FAIL | 4 "on top of the C15 expected-red"; 15-20 AC map "-> G1, G2 / D6 / G3"; 241 "Z1:"; 265 "M1:" |
| test/researcher-deep-research.test.mjs | 2 | 1 | yes | FAIL | 3-4 "AC-1 -> t1; AC-2 -> t2; ..." (bare map; only a title was added) |
| test/reviewer-completed-tasks-gate.test.mjs | 55 | 18 | yes | FAIL | 5-24 "AC-3 bullet 1 (...) -> FM1" map; 90/119/141/169 "FMn — AC-3 bullet n:"; 238 "E40 (...) additions below"; 368/384/412 "E148: ..." |
| test/schema-versions.test.mjs | 24 | 8 | no | FAIL | 25/31/38/40 "<feature-slug> bumped handoff to N"; 234, 257, 286 |
| test/session.test.mjs | 1 | 1 | no | FAIL | 21 "e123b9 J2 (spec AC1 — FLIPPED): ..." |
| test/skill-evolution-v3.11.test.mjs | 21 | 5 | yes | FAIL | 15 "d6-host-capability-compose-axis (T-D6-04): ..."; 41 "AC-11: ..."; 75/81/84 |
| test/skill-frontmatter.test.mjs | 9 | 3 | no | FAIL | 3 "Covers AC7 of ..."; 102; 106 "e178a-integrator-role (T-E178A-06, ... Q6)" |
| test/skill-manifest.test.mjs | 35 | 21 | no | FAIL | 3 "T-D6-04 (a): ..."; 10-19 AC map; 53 "E51 (T-E51-03): ..."; 155 "E103 (iii)"; 173 "E91 (iii)"; 391-398 |
| test/source-credibility-gate.test.mjs | 49 | 24 | yes | FAIL | 17-27 AC map; 109 "T1/T2: AC-1 fire"; 148 "T3: AC-3 fire"; 195, 244, 293, 312, 345, 404; 455 "(DR-6: ...)" (headers 173/266/448 were rewritten, their siblings were not) |
| test/sqlite-versioning.test.mjs | 5 | 4 | yes | FAIL | 2 "T30: ..."; 20 "AC-1: ..."; 55 "AC-2: ..."; 118 "AC-5: ..." (same header form as :98, which was rewritten) |
| test/stale-dispatch-detection.test.mjs | 53 | 29 | no | FAIL | 4 "T-D5-05 — ..."; 7-31 AC map; 39/49 "E97 ..."; 101-792 "AC-n: ..." headers |
| test/subagent-templates.test.mjs | 23 | 7 | yes | FAIL | 26; 94 "AC1 (v3.20.0) + AC1/AC2 (v3.21.0): ..."; 201; 238; 271; 341 "C5a: ..."; 484 |
| test/success-metrics.test.mjs | 41 | 19 | yes | FAIL | 9-15 AC map; 66 "e123b9 J2 ..."; 95 "E148 ..."; 538 "E1A terminal marker"; 740-745 "-> E12-D1 ..." |
| test/tasks-versioning.test.mjs | 10 | 6 | no | FAIL | 2 "T29: ..."; 4; 32 "e125a: ..."; 59/104/174 "AC-n: ..." |
| test/tasks.test.mjs | 5 | 1 | no | FAIL | 29 "e125a: after the first access ..." |
| test/teamwork-lite.test.mjs | 5 | 1 | yes | FAIL | 4 "AC6 (README) is verified manually in T42, not here." |
| test/telemetry.test.mjs | 21 | 10 | no | FAIL | 5-14 AC map "-> INT1 / NE1 / SHAPE1"; 45; 207 "NE1 — AC-2: ..."; 228 "INT1 — AC-1: ..." |
| test/token-budget-config.test.mjs | 16 | 12 | no | FAIL | 2 "T-B9-03: ... (v3.62.0+, B9)"; 7-14 AC map; 68/93/165 "AC1: / AC4: / AC6: ..." |
| test/token-efficiency.test.mjs | 6 | 1 | no | FAIL | 236 "E112 re-baseline (case-a negative pin): ..." |
| test/tw-sync-reconcile.test.mjs | 3 | 1 | no | FAIL | 2 "R10 — tw_sync / reconcileTasks: ..." (the author's commit calls this file "already plain", but it leads with the id) |
| test/usage-accounting.test.mjs | 25 | 13 | no | FAIL | 7-13 AC map; 57 "e123c AC7: ..."; 146/235 "AC7 (e123c, E123 F2): ..."; 495 "AC9 (e123c, E123 F2 — closes J2-NEW-3's second bullet)" |
| test/verify-release.test.mjs | 222 | 108 | yes | FAIL | 21-30 and 95-105 AC map; 33 "T-EB-04 (E14, backlog row + T-EB-01) additions"; 41, 51, 70, 91, 121; 315/330 "E174a: since the E123 lane flip ..."; 339/350 "E126 T-E126-04/T-E126-06 (X5/E198(a), spec AC10)" |
| test/visual-evidence-gate.test.mjs | 33 | 3 | yes | FAIL | 228 "(D4 — permissive parser ...)"; 341 "D3 — exclusion encoding ..."; 579 "AC-4 — rejection envelope ..." |
| test/visual-gate-e2e.test.mjs | 13 | 3 | yes | FAIL | 148 "AC-7 — visual_round persistence"; 340 "AC-10: no-design ..." (siblings 55/108/191 were rewritten) |
| test/visual-report-schema-validation.test.mjs | 0 | 0 | no | OK | - |
| test/visual-round-sqlite.test.mjs | 1 | 0 | no | OK | the only id is already a trailing pointer |
| test/visual-round-transitions.test.mjs | 7 | 3 | yes | FAIL | 158 "AC-11: handoff schema v3 round-trip"; 164 "d2-server-brake-accounting (...)"; 172 "e8-success-telemetry (...)" |
| test/visual-widgets-unverified-gate.test.mjs | 10 | 3 | yes | FAIL | 73 "AC-2 — all checked → accept"; 107 "AC-4 — error envelope ..." (siblings 29/85/132 were rewritten) |
| test/watermark-check.test.mjs | 13 | 12 | no | FAIL | 5-13 AC map; 35-142 "AC5 fixture n — ..."; 169/224 "T-C5C18-06 (AC-2, v3.58.0 C5b) — ..."; 338 "AC6 — ..." |
| test/widget-shape-spec.test.mjs | 8 | 4 | no | FAIL | 27 "AC-1: ..."; 65 "AC-2: ..."; 117 "R6: ..."; 131 "R5: ..." |
| test/writestate-options-object.test.mjs | 17 | 10 | yes | FAIL | 43/117/134/157 "AC-n — ..." (sibling :112 was rewritten); 195/278 "E36 — ..."; 213/294 "e235a/DR-5 (OQ-1): ..." |

Totals: 38 files scanned, 1050 id-mentioning comment lines, about 391 id-led lines. 3 files are OK and 35 fail (corrected in round 2; round 1 first said 4 and 34).

What must change, per file, applying the rule the spec states: plain language first, with the id only as a trailing parenthetical pointer on the same line.
1. **Section headers of the form `---- AC-n: <phrase> ----` or `AC-n — <phrase>`.** Put the phrase first and the id last, exactly as the author already did for sibling headers in the same files: sqlite-versioning:20/55/118, tasks-versioning:59/104/174, token-budget-config:68/93/165, widget-shape-spec:27/65, writestate-options-object:43/117/134/157, visual-gate-e2e:148/340, visual-widgets-unverified-gate:73/107, visual-evidence-gate:341/579, visual-round-transitions:158, rag-lifecycle:72, source-credibility-gate:109/148/195/220/244/293/312/345/374/404, stale-dispatch-detection:101-792, telemetry:207/228, watermark-check:35-338, reviewer-completed-tasks-gate:90/119/141/169, skill-evolution-v3.11:41, run-eval:39.
2. **File headers that lead with an id or a feature slug.** Examples: "D4 behavioral-eval harness", "T29:", "T30:", "R10 —", "T-D5-05 —", "T-D6-04 (a):", "T-B9-03:", "E174a:", "e125a:", "e123b9 J2", "E148:", and schema-bump lines such as "<slug> bumped handoff to N". Rewrite each so the behaviour or reason comes first and the id trails. This covers all four `test/eval/*.mjs` headers, session:21, tasks:29, tasks-versioning:2/4/32, sqlite-versioning:2, tw-sync-reconcile:2, schema-versions:25-286, skill-frontmatter:102/106, and the `re-baseline:` lines in repro-first-gate, stale-dispatch-detection and success-metrics.
3. **Comments whose meaning depends on an id.** They cite review-finding labels or ticket history that a reader cannot resolve, for example "closed N4", "N14 ...", "N16:", "F2 (round 1 BLOCKING, CLOSED round 2)", "C1 regression guard", "since the E123 lane flip", "on top of the C15 expected-red", "closes J2-NEW-3's second bullet", "E103 (iii)" and "E91 (iii)". Replace each label with the behaviour it names: release-staging:385/1741/1746/1920/1951/2124/2164/2711, verify-release:315/330/339/350, repro-first-gate:4, usage-accounting:495, skill-manifest:155/173, source-credibility-gate:455.
4. **Spec-to-test map rows.** Rows such as `AC-1 -> t1; AC-2 -> t2` (researcher-deep-research:3-4) and `AC-3 bullet 1 (...) -> FM1` (reviewer-completed-tasks-gate:5-24) either explain nothing or lean on test labels. Give each row a plain description of the behaviour it covers, with the AC id trailing. Rows that already carry a plain parenthetical (verify-release:21-30, release-staging:7-16, stale-dispatch-detection:7-31, telemetry:5-14, watermark-check:5-13, usage-accounting:7-13, source-credibility-gate:17-27, repro-first-gate:15-20, skill-manifest:10-19, success-metrics:9-15/740-745, token-budget-config:7-14) must still lead with that plain text and trail the id. Right now every one of them leads with the AC id.
5. **The 9 lines that `check-id-only.mjs` itself still lists.** assertions:149, release-staging:12, reviewer-completed-tasks-gate:6/8/14/23, skill-evolution-v3.11:4, verify-release:21/592. The cut requires that the advisory list be triaged. At least the reviewer-completed-tasks-gate and assertions lines need rewriting.

No other correctness findings. None of the 48 rewritten lines misstates the behaviour of the code next to it. I spot-checked verify-release:828-831 against its fixture fields, reviewer-completed-tasks-gate:108/303, and release-staging:738/855/873/1994.

Expected-red sampling: not armed. The change is comments-only, the dispatch mode is feature, no intentional red tests are claimed, and no expected-red manifest exists for this feature.

## Quality
- `recommended`: the author's T-E233E-21 commit subject says tw-sync-reconcile, scenarios and run-eval were "already plain". Each of them leads with an id (tw-sync-reconcile:2, scenarios:2, run-eval:3). Commit subjects and author records should not claim a file is conforming when it is not.
- The rewritten lines are good: consistent wording, the id trails in parentheses, and no governance jargon was introduced.

## Architecture
No architecture spec for this feature. Comments-only; no layering change.

## Security
No findings. The 48 added lines contain no URL, no user-home absolute path, no credential, no codename and no file key (AC4).

## Performance
No findings. Comments-only; the transpiled output is identical to base (AC2).

## Verdict
CHANGES_REQUESTED — AC1 is partial: the rewrites that were made are correct and comments-only, but 35 of the 38 owned files (corrected in round 2 from 34) still carry comments that lead with or depend on a ticket, AC or finding id (about 391 lines, listed per file above), including 14 assigned files that were not touched at all.

## Round 2 — APPROVED — by code-reviewer

Range re-judged: `6c61864..af90576` (author fix commits a31df8e..5d93b44, author record 03c95ad, lane-state commit af90576). The tree was clean at the start of the round. As the coordinator directed, I read the author record's justification for the id-led lines it kept, and nothing else from `qa_reports/`.

## Summary
- 35 of the 38 owned files are now changed under `test/` (810 insertions, 787 deletions). All of them are comments-only, and nothing outside the owned set changed.
- Id-led comment lines dropped from about 391 to 12 on my sweep (the same case-insensitive matcher as round 1). All 12 were triaged as acceptable: none uses a tracker id as its explanation.
- I triaged every comment line that still carries an id outside a parenthetical, a code span, a file name or a test label: 293 lines, including all 115 in release-staging and all 47 in verify-release. I read about 60 of them in full surrounding context. The ids that remain are trailing pointers, test or fixture labels, or the name of a change inside a sentence that itself states the behaviour. None depends on the id for meaning.
- Every round-1 required finding (items 1-5) is resolved.
- Erratum for round 1: the per-file summary should have read 3 OK and 35 FAIL. visual-round-transitions was FAIL, as its own table row already showed. The Round 1 Totals and Verdict lines are corrected in place.
- Verdict: APPROVED.

## AC Completeness
AC1 — implemented — the remaining id-led lines are all acceptable (see Correctness); round-1 examples are now plain-first, e.g. test/sqlite-versioning.test.mjs:20, test/tasks-versioning.test.mjs:59, test/rag-lifecycle.test.mjs:72, test/stale-dispatch-detection.test.mjs:101, test/source-credibility-gate.test.mjs:109, test/verify-release.test.mjs:21-30 and :315-318, test/release-staging.test.mjs:1743-1749.
AC2 — implemented — `check-comments-only.mjs 6c61864` prints `comments-only OK: 35 files`, exit 0.
AC3 — implemented — the same script's path-containment step passes; every changed path is in the owned set.
AC4 — implemented — 0 hits for a URL or a user-home or home-directory path across the 810 added `test/` lines (pattern built at run time).
AC5 — out of scope for this task (T-E233E-24).
AC6 — implemented — no added or removed diff line is a `test(` name line; literals are unchanged, which the AC2 transpile comparison proves.

## Correctness
**Round-1 findings, re-checked by file:line.**
1. AC-led section headers now lead with plain text. Examples: token-budget-config:68, widget-shape-spec:27, writestate-options-object:43, visual-gate-e2e:148, visual-widgets-unverified-gate:73, visual-evidence-gate:341, telemetry:207, source-credibility-gate:109. Resolved.
2. Id-led file headers now lead with plain text: eval/scenarios:2, eval/run-eval:3, tw-sync-reconcile:2, tasks-versioning:2, sqlite-versioning:2, token-budget-config:2, skill-manifest:3, schema-versions:25 (now "Handoff version history, one step per schema change"). Resolved.
3. Ids that carried meaning are replaced by what they name, for example release-staging:1743-1749 (N4 is now "the empty-baseline mass-sweep hazard", F8 "the unbound-variable defect"), verify-release:315-318 ("since bookkeeping moved into per-lane directories ... (E174a; lane layout change E123)"), usage-accounting:494-496, skill-manifest:155/173, repro-first-gate:4. Resolved.
4. Spec-to-test map rows now lead with a plain description: researcher-deep-research:3-9, reviewer-completed-tasks-gate:4-23, verify-release:21-30, release-staging:7-19, watermark-check:4-13, repro-first-gate:14-22. Resolved.
5. `check-id-only.mjs` now lists 17 lines, and I triaged all 17. Each one is a wrapped tail such as "(AC7, e123c)." or "(ticket T-E165-01, backlog E165).", or a map continuation that ends with a test label, for example release-staging:12 and verify-release:21. None is id-only in meaning. Resolved.

**Re-sweep: the 12 id-led lines left.**

| file:line | kind | disposition |
|---|---|---|
| token-budget-config:8, 10, 11, 12, 14 | map continuation lines listing test names (`t-ac1-absent-key` and so on) | acceptable: test labels, not tracker ids |
| skill-manifest:392, 444 | a test name (`t-e51-...`) as continuation or sentence subject | acceptable: test label |
| visual-gate-e2e:87, visual-widgets-unverified-gate:129 | fixture task `T02` from the test's own data | acceptable: fixture data |
| release-staging:1426, reviewer-completed-tasks-gate:236, verify-release:2197 | the wrapped tail of a sentence whose plain text is on the lines above | acceptable: trailing pointer |

The author record's 11 kept lines are a subset of these, apart from its session and visual-gate-e2e arrow-continuation lines, which my matcher does not flag. The record's justification is accurate.

**Mid-line ids, sampled (293 lines triaged, weighted to release-staging 115 and verify-release 47).**
- In verify-release, almost every remaining mid-line id is a `VR-n` test label (e.g. :15, :120, :284, :904) or a trailing pointer such as :95-96, :233 and :1530. Acceptable.
- In release-staging, most ids are parenthetical or trailing pointers, AC references to the cited spec's own criteria (e.g. :1101, :1143), or the name of a change in a sentence that states what the change did, for example :2656 ("E76 rewrote step 7a's move loop from one-bullet-per-tree ... into a single heredoc block") and :1298 ("E53 opens the edge in tools/transitions.ts"). A reader without the tracker still gets the behaviour and the reason from each line. Acceptable under the constitution's "not standing alone as the explanation" test and AC1's first clause.
- Elsewhere, ids are schema-history pointers (schema-versions:27-31), fixture ids (token-efficiency:113-114, tw-sync-reconcile:43), or gate names given next to the error code they produce (reviewer-completed-tasks-gate:244/327, where "the E18/E32 set-difference gate" is paired with `QA_COMPLETION_EVIDENCE_MISSING`). Acceptable.

**Meaning after re-wrapping.** I compared about 20 rewritten hunks against their base text. The replacements are accurate. release-staging:1743-1749 matches the base's N4/F8/F9 narrative, and the F8 fix still binds `CODES=$(...)`. release-staging:2126 ("future-state read") matches the body it introduces and the assertions below it, which check for `HEAD~1` and `git show HEAD`. verify-release:315-318 keeps the lane-path meaning. researcher-deep-research:3-9 gives accurate AC descriptions for t1-t5. I found no inaccuracy.

Expected-red sampling: not armed (comments-only, feature mode, no intentional red tests).

## Quality
- `recommended`: some lines still open with an id before plain text. Examples are the `Why: AC-n — <explanation>` lead-ins at source-credibility-gate:113-452 (10 lines), visual-evidence-gate:479/619/638 and skill-evolution-v3.11:132, and the `Contract: ACn ...` lines at release-staging:1101-1268. Each states its reason in the same sentence, so none relies on the id. The same form was left in sibling lanes' files that already passed, so this is recorded as a consistency polish, not a blocker.
- `recommended`: a handful of ids are used as the subject of a sentence, for example release-staging:2546 ("the adopter-workspace shape E71a exists to survive") and :2922 ("defeating F2's fix"). Both are understandable in context, because the test title and the neighbouring lines describe the fix, but a plain noun plus a trailing id would read better.
- `optional`: re-wrapping made some comment lines much longer than their neighbours (e.g. release-staging:89 and :2126, verify-release:1708). This is cosmetic.

## Architecture
No architecture spec; comments-only.

## Security
No findings. No URL, home-directory path, credential, codename or file key in the added lines.

## Performance
No findings. The transpiled output is identical to base.

## Verdict
APPROVED — every round-1 required finding is resolved, the change is proven comments-only across 35 files, and no remaining comment in the 38-file owned set relies on a ticket, AC or task id for its meaning; the leftover lead-id forms are recorded as recommended polish.
