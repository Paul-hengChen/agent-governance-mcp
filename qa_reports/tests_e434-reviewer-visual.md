# Tests — e434-reviewer-visual (qa-engineer, T-E434-01 / T-E434-02)

Spec: `specs/e434-reviewer-visual.md` (cut v1, approved 2026-11-23; rulings R1 (a), R2 (a), R3 (b)). Chain: test-first (qa-engineer writes, sr-engineer builds, code-reviewer judges).
Placement branch: dispatch brief `Test-file placement` line — new tests in `test/e434-reviewer-visual.test.mjs` (creation pre-authorized); re-pins inside the existing files the spec's Probe table marks *qa T-02*, file names kept (D20).

## Scenario → Test Map

All new tests are in `test/e434-reviewer-visual.test.mjs`; run one with `node --test --test-name-pattern "AC<n>:" test/e434-reviewer-visual.test.mjs` after `npm run build`.

| scenario | test (exact name) | state at write |
|---|---|---|
| AC1 | `AC1: skill-reviewer-visual.md (opus, rv.title) and templates/reviewer-visual.md replace the qa-visual pair; 12 templates; template model = SOP recommended_model` | red |
| AC2 | `AC2: code-reviewer step 6a (cr.visual_step) between steps 6 and 7; qa SOP loads no visual sub-skill and gives no visual verdict; coord-05 picks reviewer-visual; non-design code-reviewer prompt changes only by step 6a` | red |
| AC3 | `AC3: no served file or registry text names qa-visual (two historical spec names allowed); const-11 opens with const11.head and carries const11.measure; no design-armed composed prompt gives the visual verdict to qa` | red |
| AC4 | `AC4: qa SOP step 4 has a Visual checks sub-step (capture check, diff check, isolation captures, sr passes both); sr's whole-surface loop runs qa-engineer's checks` | red |
| AC5 | `AC5: skill-reviewer-visual.md is code-reviewer's sub-skill, reads images only over threshold, records accepted differences with no human stop, rejects as CHANGES_REQUESTED in review_round, and keeps the report contract` | red |
| AC6 | `AC6: design-armed test-first feature, every surface pass with a numeric diff-metric, empty Allowed Differences, Verdict PASS → code-reviewer PASS accepted (no visual code fires)` | green (pins behaviour to keep; D3 no gate change) |
| AC7 | `AC7: one surface accepted in Region Diff with an Allowed Differences entry (surface id + reason) → code-reviewer PASS accepted; the section keeps surface id and reason` | green (pins behaviour to keep) |
| AC8 | `AC8: design-armed test-first feature with Visual Baselines and no visual report → code-reviewer PASS rejected VISUAL_EVIDENCE_MISSING naming qa_reports/visual_<id>.md, hint hint.visual_evidence` | red (hint text) |
| AC9 | `AC9: (a) a visual code-reviewer rejection counts in review_round and visual_round does not move; (b) the visual counter / split rule text leaves served content` | red at (b); part (a) passes at base (D1) |
| AC10 | `AC10: GATE_REGISTRY — three visual hints renamed, VISUAL_ROUND_EXCEEDED documentedInProse false with mapping.vround, mapping rows name skill-reviewer-visual.md and match the quote sites, field comment, 35 entries, 17 steps, every other field frozen (D21)` | red |
| AC11 | `AC11: docs/config.md override list + config.migration directly under it; README rv row at the old position, no qa-visual row; eval bundle maps reviewer-visual (offline load)` | red (config / README); the bundle part already passes (T-02 renamed the map key) |
| AC12 | `node --test test/compose-equivalence.test.mjs test/context-budget.test.mjs` — no new test; T-E434-08 re-captures the goldens and caps after the build (R3 (b)) | green now; goes red when sr edits `content/**` |
| AC13 | `AC13: 35 gates, 17 steps, CURRENT_VERSIONS unchanged; transitions / schema / prompts / CLAUDE.md byte-identical to base; dist outside the four rebuilt groups unchanged; agc check exits 0` | green (pins what must not move); the full-suite / `npm audit` / clean-tree parts are the T-E434-08 hygiene run and the judge's `command` proof |

### T-E434-02 re-pins (existing files, names kept — D20)

| file | test(s) re-pinned | what changed |
|---|---|---|
| `test/subagent-templates.test.mjs` | the 8 tests over `EXPECTED_ROLES` / `ROLE_TO_SKILL` | `qa-visual` → `reviewer-visual`, `skill-qa-visual.md` → `skill-reviewer-visual.md` |
| `test/e412-qa-visual-template.test.mjs` | all 5 | template path `reviewer-visual.md`, `model: opus`, tpl.rv_desc, tpl.rv_watermark, `tw_switch_role("code-reviewer")`, coord05.dispatch clause; file now read lazily per test (a missing file fails named tests, not the module load) |
| `test/e360-qa-visual-review-task-ids.test.mjs` | AC-E360-1 | path; every spelled-out `tw_update_state(status=FAIL` call carries `review_task_ids` and `agent_id="code-reviewer"`; no `agent_id="qa-engineer"`; read inside the test |
| `test/e391-prompt-audit-stale-facts.test.mjs` | AC-G2-12 | cr cites `` `<agc install>/content/skill-reviewer-visual.md` `` once; rv carries no qa-SOP pointer; every rv `<agc install>/content/` pointer resolves |
| `test/e393-builder-judge-core.test.mjs` | AC-A2, AC-B, AC-C, AC-C01 | const11.head bullet (count no longer pinned, D: const11.measure may be a bullet); rv cites `§3 builder ≠ judge`; const-09 / sr name `review_round` / `fix_try` cap; Limits has no visual rows, `fix_try` row stays |
| `test/e410-task-alias-content-tail.test.mjs` | both AC2 tests | const-01 watermark row line 33 → 31, line count 37 → 35 |
| `test/e437-repo-only-paths.test.mjs` | sites 7, 8; AC-E437-3; bundle test | path only |
| `test/e438-origin-fenced-labels.test.mjs` | sites 37, 38; label sweep | path only |
| `test/e439-rationale-fenced-stories.test.mjs` | site 11 (both); site 1 | site 11 path; site 1 first bullet is const11.head |
| `test/widget-shape-spec.test.mjs` | both R6 | path only |
| `test/skill-evolution-v3.11.test.mjs` | c9-protocol-fields | file list entry renamed |
| `test/pixel-perfect-visual-compare.test.mjs` | AC-3, AC-4, AC-5, AC-6 | path; AC-4 routes = code-reviewer CHANGES_REQUESTED in `review_round`, implementation → sr-engineer, check defect, design defect; AC-6 old file gone |
| `test/qa-visual-skill-split.test.mjs` | AC-1, AC-3, AC-5, AC-6, AC-2 (Step A.0), AC-3 (S15/S16) | path; header names code-reviewer; no `visual_fail:`, CHANGES_REQUESTED; design-defect route; byte cap 20700 kept for the renamed file, the qa cap 18500 kept (e329 reads it) |
| `test/e118-reviewer-ac-completeness.test.mjs` | AC7 (title changed: 3275 → 3665) | cap 12800 → 13190 = 12691 + 399 (cr.visual_step + newline) + ~100 slack; green at write |
| `test/e295-hop-cap-and-sop-halves.test.mjs` | AC11 | `(none)` count 0 → 1, the one is mapping.vround |
| `test/e308-single-source-tier-enum.test.mjs` | E303-AC11a (title changed) | `(none)` count 0 → 1, the one is mapping.vround |
| `test/phase-0-5-sop.test.mjs` | the AC-4 split test (title changed) | split guidance → sr.progress verbatim, no `visual_split` / `visual_split_requested:` |
| `test/constitution-deliverable-guard.test.mjs` | A4 (t-a4-new-wording-present) (title changed) | §3.2 `**Enforcement:**` clause names code-reviewer and PASS, no qa role; "owned by the qa chain at PASS time" gone |
| `test/eval/lib/bundle.mjs` (not in `npm test`) | role map | `"qa-visual": "skill-qa-visual.md"` → `"reviewer-visual": "skill-reviewer-visual.md"` (D7: offline load only, no live eval run) |

Not edited (pre-assigned only if they went red; they stay green as long as sr keeps the Probe keep-green constraints): `test/error-code-contract.test.mjs` (mapping rows must equal the final quote sites; the `(none)` row parses as an empty set), `test/e433-test-first-rules.test.mjs` (AC9 live mapping check skips `(none)` rows). `test/compose-equivalence.test.mjs`, `test/skill-manifest.test.mjs` (golden) and `test/context-budget.test.mjs` are T-E434-08.

## Open Interface Details

1. **Over-threshold / no-human-stop wording (AC5).** The test requires the literal phrase `no human stop` (case-insensitive) in `content/skill-reviewer-visual.md`: AC5's own words; no Copy row gives the sentence.
2. **Prose checks without a Copy row (AC4, AC5).** Where the spec gives a behaviour but no verbatim string, a check passes when one line, table row or blank-line paragraph of the file carries all of the named words (e.g. `within` + `` `pass` `` + `image`; `sr-engineer` + `widget shape` + `material drift`; `qa-engineer` + `check defect` + state/region; design defect + `baseline` + `manifest` + `scale`; `skill-code-reviewer` + `5c`; `diff check` + `full suite`). sr may word the sentences freely as long as each fact sits in one unit.
3. **qa SOP Visual checks location (AC4).** The sub-step must sit inside step 4 (between `4. **Write the tests**` and `5. **Run**`), label `**Visual checks**` once; the checks it must name are matched in the text from the label to step 5 (capture check, diff check, canonical state, untracked, baseline dir, not reached, baseline missing, dimension, compare region, installed tool, surface id, metric, threshold, `` `within` ``, `` `over` ``, `` `## Visual Checks` ``, cannot measure, isolation, sr-engineer + hand-off).
4. **"Gives the visual verdict to qa" (AC2, AC3).** A sentence (hard-wrapped prose re-joined) is flagged when it names a qa owner (`qa-engineer`, `qa chain`, `qa-owned`, `qa-authored`, `qa-exclusive`, `qa-visual`), a verdict term (`visual verdict`, `Allowed Differences`, `allowed-diffs`, `visual PASS`, `visual report`) and no judge (`reviewer-visual`, `code-reviewer`). At base it flags exactly the const-11 verdict / enforcement sentences and the coord-05 pre-excuse sentence. In the qa SOP (AC2) every line mentioning the visual verdict, `Allowed Differences` or `qa_reports/visual_` must name the judge.
5. **AC2 "unchanged except step 6a".** Read as: the code-reviewer SOP that the non-design prompt composes is the base SOP plus the one 6a line (checked on the source: removing `cr.visual_step` + newline gives base blob `7c5e519c`), and the composed non-design prompt carries 6a once. The constitution part of that prompt does change (AC9: const-01 Limits rows and example; D16: const-05:19), so the clause cannot mean the whole prompt (flagged to pm below).
6. **"Directly under the list" (AC11).** The first non-blank text after the list's closing code fence starts with `config.migration`.
7. **README row position (AC11).** `readme.rv_row` is the line right after the `| qa-engineer ` row (where the qa-visual row sits at base); its cell widths equal the base row's (checked: 18/8/19/70).
8. **Frozen digests (D21, AC2, AC13) and `LANE_END_SHA`.** Registry digest: sha256 of the JSON of every entry (keys sorted) minus the four moving fields. File checks compare git blob ids (live: `git hash-object --stdin-paths`; base frozen from e5ccda0): `tools/transitions.ts`, `CLAUDE.md`, `schema/**`, `prompts/**`; and `dist/**` minus `gates/registry.*`, `gates/visual.*`, `tools/evidence-file.*`, `tools/handoff-orchestrator.*` (360 files). `LANE_END_SHA` is `null` now (live tree); T-E434-08 sets it to the lane's last content commit so these checks read a closed range after merge instead of the growing live tree (resident-test hygiene) and skip loudly when the commit is unreachable.
9. **AC13 `CLAUDE.md` 250 lines, `npm audit`, clean-tree full suite.** Not in the resident test (a line count and a network audit are not stable resident checks); they are the T-E434-08 hygiene run and the judge's AC13 `proof:` command. `node bin/agc-init.mjs check` exit 0 is in the test.
10. **AC9 (a) fixture.** The FAIL write is a real `tw_update_state` (`code-reviewer`, `FAIL`, `CHANGES_REQUESTED`, `review_task_ids`, `qa_review` naming a visual finding, `next_role: sr-engineer`) on a design-armed, test-first workspace seeded with `visual_round: 2`; it asserts `review_round` +1 and `visual_round` still 2.
11. **Server fixtures (AC6–AC9 (a)).** Temp workspace: `design/<feature>.md` with `## Mode` figma, one-row `## Source` (audited), one `## Visual Baselines` row, one `## Visual Structural Assertions` row; handoff `chain_path: test-first` at `code-reviewer:In_Progress`; ledger task T-1; red-test manifest; spec with a `proof:` line; judge report with `## Expected-Red Diff` and `## AC Execution Log`; visual report with the six sections and the three provenance lines.
12. **D9 visual-check record.** This repo has no `design/`, so no visual check is written for this feature; the record contract (surface id, metric, threshold, `within`/`over`, actual image path, location named in `## Visual Checks`) is what AC4 requires the qa SOP to state.
13. **Retained text pinned by path-only re-pins** (sr must keep these sentences in `content/skill-reviewer-visual.md`): `### Step A.0 — Baseline Source-of-Truth` with `(§3 builder ≠ judge provenance.)` and the origin-fenced `(v3.39.0)`; `### Actual-Capture Output Convention` with origin-fenced `(E30)` and its fenced forensics story; `**Multi-value guard:**` with the note `FAIL it with note: "context-dependent property requires per-context baseline". Per Constitution §3.2`; `Step A.*Widget Shape Checklist`, `shape FAIL precedes pixel diff`, `do NOT proceed to Step B`; `Read both … baseline path … impl path … via the Read tool`; the six diff categories (i)–(vi); `multimodal vision against a user-supplied baseline`; `sub-section per surface id`; `` `VISUAL_EVIDENCE_MISSING` ``; size ≤ 20700 bytes; no bare `E<n>` / `v<n>.<n>.<n>` label in its dispatch bundle.

## Red Reasons

Suite at write (`node scripts/test-lock.mjs -- npm test`, base e5ccda0 + these tests): **4525 tests, 4467 pass, 56 fail, 2 skipped** (base 4513 / 4511 / 0 / 2; +12 new e434 tests). The 56 reds are exactly `qa_reports/expected-red_e434-reviewer-visual.txt`. No compile errors (the build gate is clean; every red is an assertion or ENOENT inside a test body).

New (`test/e434-reviewer-visual.test.mjs`):
- AC1 — `content/skill-reviewer-visual.md` and `templates/claude-code-agents/reviewer-visual.md` not created yet (T-03).
- AC2 — code-reviewer step 6a not written; coord-05 still names `qa-visual` (T-03, T-05).
- AC3 — 11 served files still contain `qa-visual`; const-11 still opens with the qa-visual-owned bullet (T-03..T-07).
- AC4 — qa SOP step 4 has no **Visual checks** sub-step; sr loop still runs its own region diff (T-03).
- AC5 — ENOENT on `content/skill-reviewer-visual.md` (T-03).
- AC8 — `VISUAL_EVIDENCE_MISSING` hint still `Run Phase 1.5 (skill-qa-visual) …` (T-07).
- AC9 — part (a) passes; part (b) fails: const-01 still has the `visual_round` cap row (T-04).
- AC10 — `hint.visual_evidence` not in the registry yet (T-07).
- AC11 — `docs/config.md` list still names `.current/skill-qa-visual.md` (T-06).

Re-pinned (T-E434-02):
- `test/subagent-templates.test.mjs` (8) — `templates/claude-code-agents/reviewer-visual.md` missing, `qa-visual.md` still present (T-03).
- `test/e412-qa-visual-template.test.mjs` (5) — template missing (4); coord-05 line still names `qa-visual` (1, T-05).
- `test/e360-…` AC-E360-1, `test/e391-…` AC-G2-12, `test/e437-…` sites 7/8 + AC-E437-3, `test/e438-…` sites 37/38 + label sweep, `test/e439-…` site 11 (×2), `test/widget-shape-spec.test.mjs` R6 (×2), `test/skill-evolution-v3.11.test.mjs` c9-protocol-fields, `test/pixel-perfect-visual-compare.test.mjs` AC-3/4/5/6, `test/qa-visual-skill-split.test.mjs` AC-1/3/5/6/2/3(S15/S16) — ENOENT on `content/skill-reviewer-visual.md` (and, for AC-G2-12, no step 6a pointer in the code-reviewer SOP) (T-03).
- `test/e393-…` AC-A2, `test/e439-…` site 1, `test/constitution-deliverable-guard.test.mjs` A4 — const-11 not rewritten (T-05).
- `test/e393-…` AC-B, AC-C — rv missing / const-09 and sr SOP not rewritten (T-03, T-04); AC-C01 — const-01 still has the two visual rows (T-04).
- `test/e410-…` AC2 (×2) — const-01 still 37 lines, watermark row at line 33 (T-04).
- `test/phase-0-5-sop.test.mjs` AC-4 — sr SOP has no `sr.progress`, still has the split route (T-03).
- `test/e295-…` AC11, `test/e308-…` E303-AC11a — the mapping comment has no `(none)` row yet (T-07).

Green at write (pins to keep, not in the manifest): e434 AC6, AC7, AC13; `test/e118-reviewer-ac-completeness.test.mjs` AC7 (cap raised to 13190 ahead of step 6a); `test/e437-repo-only-paths.test.mjs` bundle test (`buildPromptForRole` on a missing skill file returns a bundle without throwing); `test/e329-integrator-sop-followups.test.mjs` (still finds `18500` in qa-visual-skill-split).

Will go red during the build and are NOT pre-captured (R3 (b), T-E434-08): the 11 compose goldens in `test/compose-equivalence.test.mjs`, `test/skill-manifest.test.mjs` t-golden-byte-identity, and the moved `test/context-budget.test.mjs` caps / sentinels. sr appends them to the manifest when it leaves them red.

CI runnability: headless, no network (the AC13 `agc check` reads local files), Node 20 / 22 compatible (no temp dir re-read after capture; `git hash-object` / `git ls-tree` only; no `git show`).

## Spec problems for pm

- **AC2 last clause vs AC9 / D16.** "the code-reviewer composed prompt on a non-design workspace … is unchanged except step 6a" cannot hold for the whole prompt: const-01 (Limits rows, example) and const-05:19 are core fragments in every composition, and AC9 / D16 change them. Tested as the SOP part only (Open Interface Details 5); pm may want to reword AC2.

## T-E434-08 — snapshot re-capture (AC12) and hygiene run (AC13)

Planned sr → qa return per ruling R3 (b). Placement branch: dispatch brief `Test-file placement` line (`test/fixtures/compose-golden/**`, `test/context-budget.test.mjs` moved caps / sentinels only, `test/e434-reviewer-visual.test.mjs` `LANE_END_SHA` only). No `content/**`, source, template or doc edit.

### Goldens (12) — re-captured by tool

`node scripts/capture-constitution-golden.mjs` (dist current at 11073f3; the script also runs the E90 completeness guard: 12 written, 0 uncovered). The diff was reviewed before keeping it: every hunk is an E434 content move (const-01 Limits `visual_round` / `visual_split` rows and the example, const-05 `visual_fail:` token, const-07 visual evidence gate names `reviewer-visual`, const-09 bullet, const-11 `const11.head` / `const11.measure` / enforcement names the judge, const-13 S3 sentence, coord-03 / coord-05 dispatch and Blocked row, coord `hop_count` sibling list). No content defect found, so nothing was held back.

Per-site token delta (chars / 4, ceil; before = HEAD fixture, after = re-captured):

| golden | before | after | delta |
|---|---|---|---|
| build-full-design-fd.txt | 9338 | 9292 | -46 |
| build-full-design.txt | 9265 | 9219 | -46 |
| build-full-nondesign-fd.txt | 7387 | 7326 | -61 |
| build-full-nondesign.txt | 7363 | 7301 | -62 |
| build-lite-design-fd.txt | 4977 | 4916 | -61 |
| build-lite-design.txt | 4905 | 4843 | -62 |
| build-lite-nondesign-fd.txt | 4531 | 4469 | -62 |
| build-lite-nondesign.txt | 4506 | 4444 | -62 |
| constitution-monolith.txt | 9681 | 9610 | -71 |
| hook-full.txt | 9681 | 9610 | -71 |
| hook-lite.txt | 5053 | 4991 | -62 |
| skill-coordinator-monolith.txt | 10344 | 10343 | -1 |

### `test/context-budget.test.mjs` — caps (zero-headroom convention: cap = measured value)

Measured with the file's own composition at base e5ccda0 (each value equals the base cap exactly, which validates the measure) and on this branch:

| site (test title) | before | after | delta |
|---|---|---|---|
| AC2 lean always-on bundle (`<= N`) | 6029 | 5969 | -60 |
| AC1/AC2 skill-pm stripped body (`≤ N`) | 4998 | 4999 | +1 |
| AC1/AC2 skill-sr-engineer stripped body (`≤ N`) | 3335 | 3285 | -50 |
| AC8/AC-P2-7 design-arm stripped constitution (`≤ N`) | 9265 | 9219 | -46 |
| AC8/AC-P2-7 teamwork coordinator bundle (`≤ N`) | 19155 | 19108 | -47 |
| AC8/AC-P2-7 non-design constitution (`≤ N`) | 7363 | 7301 | -62 |
| design-only strip saving floor (`>= N`, measured-min) | 1902 | 1918 | +16 |
| skill-spec-workshop (`≤ 1092`) | 1092 | 1092 | 0 (not moved) |
| rationale+origin saving floor (`>= 240`, slack floor) | 416 | 391 | -25 (floor has slack; not moved) |
| non-design bundle saving (`>= 1830`), dual-injection (`>= 1200`) | — | pass | slack floors; not moved |

Each moved cap carries one `// E434 re-baseline: …` line; titles re-synced (E274 title check green).

### `test/context-budget.test.mjs` — sentinels (design arm names `const11.head`)

- `DESIGN_ONLY_SENTINELS`: `` "`visual_round` sub-loop" `` → `"Visual rejections are review rounds"`; `` "Split escalation (`visual_split`)" `` (bullet deleted) → `"there is no separate visual counter, cap or split threshold"` (same §3.1 fence); `"Visual verdict is qa-visual-owned"` → `"**Visual verdict is reviewer-visual-owned.**"` (`const11.head`). The AC2 design-arm test's explicit §3.2 assertion re-pinned to `const11.head` too.
- `P2_S4_VISUAL_SENTINELS`: `"A third counter"` → `"Visual checks arm only when the workspace has a"` (S3 opener).
- AC-P2-5: the S3 anchor is the new const-13 sentence (raw, origin fence included) and the §4 visual block slice starts at `Visual checks arm only when`; re-pin note says S3 was reworded by the E434 content edit, not by the reflow.
- T-GTS-07/AC1/AC2 (design arm, mixed-content site): the `` `visual_round` (v3.14.0, §3.1) `` site is gone; re-pinned to the next mixed site in the same §4 block, `(the<origin> v3.16.0</origin>\nself-arming signal)`, asserting the built prompt keeps the parenthetical text with the `(§3.1)` cross-reference and drops `(the v3.16.0`.

### `LANE_END_SHA`

`test/e434-reviewer-visual.test.mjs`: `LANE_END_SHA = "11073f3d67fb5c2d62af4f0e5cd2000016a495d1"` — sr-engineer's last source commit (T-E434-07 field comment + dist maps); the only later lane commit before this hop (94aea34) touches `.current/e434/` only. With it set, the D21 registry digest, frozen-path blobs and dist-scope checks read that commit (closed range) and skip loudly when it is unreachable. e434 file: 12 / 12 pass.

### Expected-red manifest

The 17-entry snapshot block is marked RESOLVED (entries kept as history; the pm-cap entry renamed to its new title `≤ 4999`); a closing line records that no expected red remains for this feature.

### Hygiene run (AC13)

- `CLAUDE.md`: 250 lines (byte-identical to base per e434 AC13).
- `node bin/agc-init.mjs check`: exit 0 (`OK (4.23.0)`). Advisory comment warnings only; the three `test/context-budget.test.mjs` long-block warnings at the design-arm / teamwork / non-design cap sites come from the cap-history comment runs, each now one `E434 re-baseline` line longer (the file's existing convention); advisory, exit code unchanged.
- `dist/` vs e5ccda0: only `dist/gates/registry.*`, `dist/gates/visual.*`, `dist/tools/evidence-file.*`, `dist/tools/handoff-orchestrator.*`.
- `npm audit --audit-level=high`: exit 0.
- Full suite after the commit, clean tree: see the hand-off note (`node scripts/test-lock.mjs -- npm test`).
