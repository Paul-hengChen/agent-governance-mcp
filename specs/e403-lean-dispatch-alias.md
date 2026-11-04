# e403-lean-dispatch-alias

Tickets E403 + E407 (lane `e403`, fan-out manifest `specs/fanout-prompt-audit-w4.md`, branch
`feat/e403-lean-dispatch-alias`, lane base `1000517`). Sources: `docs/backlog.md` rows E403 and
E407; `docs/prompt-audit-2026-11-02.md` findings G2-16 and G2-17 (section 3.2) and the section 5
hunks for `content/coord-05-core-visual-drift.md`, `content/skill-coordinator-lite.md` (the
Hop cap-exempt line only), `content/skill-qa-engineer.md` (the line-13 ownership line only) and
`content/skill-integrator.md` (line 38 only) — report only, not modified. Human rulings fixed in
the manifest Decisions table (2026-11-04, "approve"): ruling 1 = option (a), ruling 2 = the
integrator permission row per the report hunk, ruling 6 = pins `pm=opus`, `sr-engineer=opus`,
`code-reviewer=opus`, `qa-engineer=sonnet`. Mini-chain: pm → sr-engineer → code-reviewer →
qa-engineer, no architect (five sentence-level text edits, no module, no data model, no API).
Line numbers are at the lane base; each site's current text was re-verified against the report's
`-` lines before this cut (all four E407 sites match; coord-03 line 1 matches the backlog quote).

## Problem Statement

Two kinds of drift in the prompt text. (E403) `content/coord-03-core-fallback.md` is a core
fragment, composed on every host, but its line-1 Fallback sentence says "the host advertises no
`Task` tool, or the `Task` call returns a tool-error". The `Task(...)` alias is defined only in
`content/coord-02-host-dispatch.md` line 1, which is tagged `host:claude-code`, so the lean
coordinator composition (no host, or a non-Claude-Code host) names a tool it never defines.
(E407) Four skill sites restate a constitution rule nearly word for word while the rule is
loaded in the same composition: coord-05's *Drift Reconcile* section restates §3 *Sequential-context
assumption + reconcile* (R10); the lite *Hop cap-exempt* bullet restates the Limits table and the §5
hop-cap bullet; the qa *Hard rules* ownership bullet restates §3 *`tw_complete_task` ownership*;
the integrator *Permissions* first row enumerates the §6 integrator-only grant and the forbidden
verbs. Restatements cost tokens on every load and drift from the rule they copy. Each site becomes
a role-specific trigger plus a named citation of the rule. The lean always-on budget
(`test/context-budget.test.mjs` AC2, ceiling 5723 ~tok) may not be raised (E397), so the cut must
be net-negative there; E407 removes far more bytes than E403 adds.

## User Stories

- As a coordinator running on a host without Claude Code's subagent tool, I want the Fallback
  condition to name a tool kind I can check, so that I do not look for an undefined `Task` tool.
- As a coordinator on Claude Code, I want the Fallback condition to mean what it meant before, so
  that dispatch behaviour does not change.
- As any role reading its SOP, I want each constitution rule stated once and cited by name, so
  that the copies cannot disagree and the prompt is shorter.
- As the maintainer, I want the lean and teamwork budgets to go down, not up, so that E397 stays
  the only place ceilings are discussed.

## Acceptance Criteria

All `node --test` proofs run on a built tree (`npm run build` first). New tests are qa-authored;
suggested names `test/e403-lean-dispatch-alias.test.mjs` and `test/e407-restatement-citations.test.mjs`
(qa may rename inside the `test/e403-*.test.mjs` / `test/e407-*.test.mjs` globs). Per-site mapping:
*Site map* below.

- **AC1 (E403, lean composition)** — Given `composeSkill("skill-coordinator.md", hostCapabilitiesFor(undefined), load)`
  (the no-host profile), when the paragraph starting `**Fallback (`tw_switch_role`)**` is read,
  then it contains string `coord03.fallback` verbatim and contains no `` `Task` `` and no `Task(`.
  proof: `node --test test/e403-lean-dispatch-alias.test.mjs` (AC1 test green).
- **AC2 (E403, claude-code semantics unchanged)** — Given the `claude-code` profile composition,
  when it is read, then coord-02's alias sentence (`` `Task(...)` throughout this SOP is shorthand
  for Claude Code's subagent-dispatch tool, named `Agent` ``) is present and precedes the coord-03
  Fallback paragraph, which uses the same noun `subagent-dispatch tool`; and
  `content/coord-02-host-dispatch.md` is byte-identical to the lane base (ruling 1: coord-02
  untouched).
  proof: `node --test test/e403-lean-dispatch-alias.test.mjs` (AC2 test green) and `git diff --exit-code 1000517 -- content/coord-02-host-dispatch.md` exits 0 (review-time, not a resident test).
- **AC3 (E403, e96 re-pin)** — Given the new coord-03 line 1, when `test/e96-dispatch-preference.test.mjs`
  runs, then `t-fallback-genuine-unavailability` asserts both disjuncts in their new wording
  (`host advertises no subagent-dispatch tool, or the dispatch call returns a tool-error`), and
  `t-fallback-self-contained` still passes unchanged (no `above`, `unknown-subagent-type` restated).
  proof: `node --test test/e96-dispatch-preference.test.mjs` (all green).
- **AC4 (E407 a, coord-05)** — Given `content/coord-05-core-visual-drift.md`, when the
  `## Drift Reconcile after out-of-band execution` section is read, then its heading line is
  unchanged, its body is exactly string `coord05.drift`, it holds no numbered list and no
  `handoff-ahead` / `vibe drift` / `tw_sync` mechanism text, and the cited name
  `Sequential-context assumption + reconcile` occurs exactly once in
  `composeConstitution({ chain: true, design: true })` and in `composeConstitution({ chain: true, design: false })`
  (coord-05 loads only in chain compositions). The `## Visual Verdict Boundary` section (lines
  1–14) is byte-unchanged, so `test/e393-builder-judge-core.test.mjs` AC-B stays green.
  proof: `node --test test/e407-restatement-citations.test.mjs test/e393-builder-judge-core.test.mjs` (green).
- **AC5 (E407 b, lite)** — Given `content/skill-coordinator-lite.md`, when the *Hard rules* list is
  read, then the Hop cap-exempt bullet is exactly string `lite.hopcap`, and `Limits` and
  `## 5. Anti-Loop Circuit Breaker` are both present in `composeConstitution({ chain: false, design: true })`
  and `composeConstitution({ chain: false, design: false })`.
  proof: `node --test test/e407-restatement-citations.test.mjs` (AC5 test green).
- **AC6 (E407 c, qa)** — Given `content/skill-qa-engineer.md`, when *Hard rules* is read, then its
  first bullet is exactly string `qa.ownership`, and the cited bullet name `` **`tw_complete_task` ownership** ``
  is present in every constitution composition (`const-05` is core).
  proof: `node --test test/e407-restatement-citations.test.mjs` (AC6 test green).
- **AC7 (E407 e, integrator)** — Given `content/skill-integrator.md`, when the `## Permissions`
  table is read, then its first data row is `| <integrator.row1.can> | <integrator.row1.cannot> |`, each cell exactly its string; rows 2–5 and the
  `## Git operations` section are byte-unchanged; the `| can | cannot |` header stays
  (`test/e178a-integrator-role.test.mjs` AC1 green); and §6 in `content/const-15-core-tail.md`
  still enumerates the grant (`test/e178a-integrator-role.test.mjs` AC6 green, unchanged).
  proof: `node --test test/e407-restatement-citations.test.mjs test/e178a-integrator-role.test.mjs` (green).
- **AC8 (E407 e, e336 grant-name re-pin)** — Given AC7, when `test/e336-portable-pull.test.mjs`
  runs, then the `AC-E336-1: the two bare grant-name mentions…` test no longer asserts
  `` `pull --ff-only` on `main` `` in the Permissions row (that text leaves with the enumeration)
  and instead asserts the row cites `Constitution §6`; its second assertion (the Git operations
  `followed by `pull --ff-only` (6-5)` line) stays; the `SITES` count for `skill-integrator.md`
  stays 4. The assertion is assigned to this lane by the integrator at pre-review (fan-out manifest *所有權重劃*, limited to the `AC-E336-1` Permissions-row assertion).
  proof: `node --test test/e336-portable-pull.test.mjs` (all green).
- **AC9 (no other line moves)** — Given the lane diff against `1000517`, when it is read, then the
  `content/**` changes are confined to coord-03 line 1, coord-05 lines 18–29, lite line 20, qa line
  13 and integrator line 38; no other `content/**` line, no `const-*` file, no constitution header,
  no `tools/**` / `prompts/**` / `dist/**` file changes.
  proof: `git diff --stat 1000517 -- content/ tools/ prompts/ dist/` lists exactly the five `content/` files above (review-time).
- **AC10 (goldens)** — Given the edits, when `npm run build && node scripts/capture-constitution-golden.mjs`
  runs, then only `test/fixtures/compose-golden/skill-coordinator-monolith.txt` changes (two hunks:
  coord-03 line 1, coord-05 Drift Reconcile body; PM dry run 46220 → 45762 bytes) and the other 11
  goldens are byte-identical; `test/skill-manifest.test.mjs` `t-golden-byte-identity` is green
  after the re-capture.
  proof: `git diff --stat -- test/fixtures/compose-golden/` after capture names one file; `node --test test/skill-manifest.test.mjs test/compose-equivalence.test.mjs` green.
- **AC11 (budgets, no ceiling raised)** — Given the edits, when `test/context-budget.test.mjs`
  runs, then AC2 lean measures ≤ 5711 ~tok (PM dry run: 5682) and the teamwork bundle AC8 ≤ 21515
  ~tok (PM dry run: 21401); no cap literal in the file is raised; before/after values for AC2,
  AC8 teamwork, the skill-integrator and skill-qa-engineer bodies are recorded in the qa review
  evidence.
  proof: `node --test test/context-budget.test.mjs` (green) and `git diff 1000517 -- test/context-budget.test.mjs` shows no raised number (review-time).
- **AC12 (full suite)** — Given the final lane HEAD, when `node scripts/test-lock.mjs -- npm test`
  runs, then it exits 0, and `dist/` has no diff after `npm run build`.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0 on the last HEAD; `git status --porcelain dist/` empty after build.

## Site map

| site | change | AC | task |
|---|---|---|---|
| `content/coord-03-core-fallback.md:1` | the two disjuncts → string `coord03.fallback`; rest of the line unchanged | AC1, AC2, AC3 | T-E403-01 |
| `content/coord-05-core-visual-drift.md:18-29` | body of *Drift Reconcile* (two paragraphs + 3-step list + closing paragraph) → string `coord05.drift`; heading line 16 and lines 1–15 unchanged; file keeps its single trailing blank line | AC4 | T-E407-01 |
| `content/skill-coordinator-lite.md:20` | Hop cap-exempt bullet → string `lite.hopcap` | AC5 | T-E407-02 |
| `content/skill-qa-engineer.md:13` | ownership bullet → string `qa.ownership` | AC6 | T-E407-03 |
| `content/skill-integrator.md:38` | Permissions first row → strings `integrator.row1.can` + `integrator.row1.cannot` | AC7 | T-E407-04 |
| `test/e96-dispatch-preference.test.mjs:94-95` | re-pin regex + message to the new disjuncts | AC3 | T-E403-02 |
| `test/e403-lean-dispatch-alias.test.mjs` (new) | AC1, AC2 | AC1, AC2 | T-E403-02 |
| `test/e407-restatement-citations.test.mjs` (new) | AC4–AC7 site text + citation-resolves checks | AC4–AC7 | T-E407-05 |
| `test/e336-portable-pull.test.mjs:70` | re-pin the Permissions-row assertion (assigned to this lane at pre-review) | AC8 | T-E407-05 |
| `test/fixtures/compose-golden/skill-coordinator-monolith.txt` | re-capture | AC10 | T-E407-06 |
| `test/context-budget.test.mjs` | re-measure; record before/after; no cap raised, no edit expected | AC11 | T-E407-06 |

### Test files: pin audit (grep at lane base + PM dry run)

PM dry run: the five site edits applied to a scratch copy of the lane base, `npm run build`, full
`node --test test/*.test.mjs` on the unpatched and the patched copy. The unpatched copy had 8
failures, all from the scratch copy lacking git metadata and the real backlog corpus (same 8 in
both copies, not in scope). The patched copy added exactly 3 failures:

| test file | test | red? | why | action |
|---|---|---|---|---|
| `test/e96-dispatch-preference.test.mjs` | `t-fallback-genuine-unavailability` | red | its regex quotes the old `` no `Task` tool, or the `Task` call `` disjuncts | re-pin (T-E403-02) |
| `test/e96-dispatch-preference.test.mjs` | `t-fallback-self-contained` | green | new sentence keeps `unknown-subagent-type`, adds no `above` | none |
| `test/skill-manifest.test.mjs` | `t-golden-byte-identity (AC1/AC5)` | red | the coordinator monolith golden carries coord-03 and coord-05 | golden re-capture only, no test edit (T-E407-06) |
| `test/e336-portable-pull.test.mjs` | `AC-E336-1: the two bare grant-name mentions in the integrator SOP stay as grant names` | red | line 70 asserts `` `pull --ff-only` on `main` `` in the Permissions row, which ruling 2's row drops | re-pin (T-E407-05) — that one assertion is assigned to this lane, see *Dependencies* |
| `test/e178a-integrator-role.test.mjs` | AC1, AC6, AC7 | green | AC1 pins only `## Permissions` and `\| can \| cannot \|`; AC6/AC7 read const-15 | none |
| `test/e393-builder-judge-core.test.mjs` | AC-B | green | coord-05 citation `§3 builder ≠ judge` is in Visual Verdict Boundary (line 3), untouched | none |
| `test/render-structure.test.mjs` | glue / ratchet sweeps | green | single-paragraph replacement, no fence or origin tag touched | none |
| `test/compose-equivalence.test.mjs` | all | green | the 11 constitution/hook goldens are byte-identical (no `const-*` change) | none |
| `test/teamwork-lite.test.mjs` | all | green | no pin on lite line 20 | none |
| `test/e164-e167-content.test.mjs` | all | green | no pin on a touched sentence | none |
| `test/skill-evolution-v3.11.test.mjs` | all | green | lite pin is `## Scope-creep examples` only | none |
| `test/context-budget.test.mjs` | AC2, AC8 and per-skill caps | green | every measure goes down (see below) | re-measure, record; no edit expected |

### Budget delta (PM dry run, chars/4 estimator as in `test/context-budget.test.mjs`)

| measure | base | after | delta | cap (unchanged) |
|---|---|---|---|---|
| AC2 lean always-on (lite constitution + raw `skill-coordinator-lite.md`) | 5711 ~tok | 5682 ~tok | −29 ~tok (−114 bytes) | 5723 |
| AC8 teamwork bundle (claude-code profile, both strips) | 21515 ~tok | 21401 ~tok | −114 ~tok | 21715 |
| lean coordinator composition (no-host profile, raw skill) | 32804 bytes | 32351 bytes | −453 bytes | — |
| lean coordinator bundle (no-host, both strips) | 18351 ~tok | 18237 ~tok | −114 ~tok | — |
| `skill-integrator.md` body, stripped | 10235 ~tok | 10167 ~tok | −68 ~tok (−270 bytes raw) | — |
| `skill-qa-engineer.md` body, stripped | 4399 ~tok | 4399 ~tok | 0 (±0 bytes) | — |

Per site (raw bytes): coord-03 +13, coord-05 −466, lite −114, qa ±0, integrator −270. E403's +13
sits only in the coordinator compositions, where coord-05's −466 covers it; the lean always-on
bundle gets only the lite −114.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| coord03.fallback | ``the host advertises no subagent-dispatch tool, or the dispatch call returns a tool-error / unknown-subagent-type`` (replaces ``the host advertises no `Task` tool, or the `Task` call returns a tool-error / unknown-subagent-type``; everything else on line 1 unchanged) | authored-here — ruling 1 option (a), host-neutral; reuses coord-02's alias noun `subagent-dispatch tool` so the claude-code reading is unchanged |
| coord05.drift | ``Coordinator trigger for Constitution §3 *Sequential-context assumption + reconcile* (R10): you`` / ``dispatched background/parallel subagents, OR executed a role inline (subagent unavailable). In those`` / ``cases run that reconcile before any PASS or hand-back; never hand-edit `tasks.md` checkboxes to paper`` / ``over drift.`` (four lines, joined by single newlines; one blank line follows, as today) | authored-here — report §5 coord-05 hunk with its parenthetical mechanism recap dropped (E407: "no restated mechanism") |
| lite.hopcap | ``- **Hop cap-exempt** — per Constitution Limits / §5 (lite issues no role-transition write, so `hop_count` never moves).`` | report §5 `skill-coordinator-lite.md` hunk, Hop cap-exempt line (verbatim) |
| qa.ownership | ``- **You own `tw_complete_task` and `tw_rollback_task`** (Constitution §3 *`tw_complete_task` ownership*).`` | report §5 `skill-qa-engineer.md` hunk, line 13 (verbatim) |
| integrator.row1.can | ``Constitution §6: the base list plus the integrator-only grant (enumerated there, not here), and pushing the integration branch`` (the row's `can` cell) | report §5 `skill-integrator.md` hunk (verbatim), ruling 2 |
| integrator.row1.cannot | ``Pushing `main` directly (protected: it moves only by pull request merge) and every git verb Constitution §6 forbids`` (the row's `cannot` cell) | report §5 `skill-integrator.md` hunk (verbatim), ruling 2 |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Raising any budget ceiling (E397). Lowering a cap literal is also not done here: the re-measure
  is recorded, the caps stay.
- The constitution header bump (G2-14); any `const-*` edit.
- G2-17d (the skill half is closed by E394; the template half is E404 in lane e395).
- `content/coord-02-host-dispatch.md` (ruling 1 = option (a)).
- Other `Task` mentions in core fragments outside coord-03 line 1 (the PM dry run counts 6 left in
  the no-host coordinator composition, e.g. coord-05 line 5 "(Task or `tw_switch_role`)"). Not
  E403's site; filed as a lane finding in `.current/e403/pending-tickets.md` (`E403-NEW-1`), per integrator pre-review.
- The rest of the report's lite hunk (the Server-read-only line, the `@@ -46` hunk) and qa hunk
  (`@@ -57`), the integrator `## Git operations` section, and every other flag-only finding.
- Release bookkeeping (version bump, CHANGELOG, backlog done-marks) — release-engineer / integrator.

## Dependencies / Prerequisites

(Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.) Lane base
`1000517`; `.current/.config.json` has `host: "claude-code"` and no `cutApprovalAutoTier.manifest`,
so the cut is human-approved in this lane's session after integrator pre-review.

Rulings applied (not re-asked): ruling 1 (a), ruling 2 (report hunk), ruling 6 (pins).

**Ownership (granted at integrator pre-review, manifest *所有權重劃*)**: `test/e336-portable-pull.test.mjs` was not in
the e403 擁有 cell, but ruling 2's row removes the `` `pull --ff-only` on `main` `` text that its
`AC-E336-1` grant-name test asserts at line 70 (PM dry run: red). Granted: that file is assigned to e403,
limited to the line-70 assertion of that one test (the line-71 assertion, `SITES` and every other
test in the file untouched). It is not in e395's set either. The
cut does not change ruling 2's wording to dodge the pin.

Resource audit: the sources are in-repo documents; no URL, design file or external ticket system
is referenced (internal ticket ids E392/E397/E404/G2-14 point at `docs/backlog.md` and the report).
`external_refs` omitted.

## Gate Summary

| gate | result |
|---|---|
| Visual State-Count Split | not triggered — no visual surface |
| Geometric-Density Split Gate | not triggered — non-design |
| Parallel-Lane Cut | not applicable — this spec is one lane of an approved fan-out; inside the lane the five sites are serial text edits on disjoint lines |
| Scope Decision Gate | not gated (no design file); `scope_decision: single-feature` recorded anyway — why: the manifest Lanes row e403 binds E403 + E407 into one lane because only their combined re-measure keeps the zero-headroom lean / teamwork budgets green, and they share the golden and budget files |
| Resource Audit Gate | zero external hits; `external_refs` omitted |
| Source-Credibility Gate | not applicable — no design source |
| Question Batch Gate | zero questions — rulings 1, 2, 6 fixed by the manifest Decisions row |
| Ambiguity Gate | clear; the ownership item (above) was granted at integrator pre-review |
| Cut-Approval Gate | cut below; Task-dispatched PM — `cut_approved` not set; integrator mailbox pre-review, then human approval in the lane session |
| Manifest-Tier Self-Attestation | `fanout.mjs check --cut` run; not eligible — the workspace has no `cutApprovalAutoTier.manifest` |
| Integrator Stage 0 cut | not applicable |

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E403-01 | sr-engineer: coord-03 line 1, replace the two disjuncts with string `coord03.fallback`, rest of line unchanged (AC1, AC2; site coord-03:1) | none | 1 | `content/coord-03-core-fallback.md` | — |
| T-E407-01 | sr-engineer: coord-05 Drift Reconcile body lines 18–29 → string `coord05.drift`; heading and Visual Verdict Boundary unchanged (AC4; site coord-05:18-29) | none | 1 | `content/coord-05-core-visual-drift.md` | — |
| T-E407-02 | sr-engineer: lite Hop cap-exempt bullet line 20 → string `lite.hopcap` (AC5; site lite:20) | none | 1 | `content/skill-coordinator-lite.md` | — |
| T-E407-03 | sr-engineer: qa Hard rules ownership bullet line 13 → string `qa.ownership` (AC6; site qa:13) | none | 1 | `content/skill-qa-engineer.md` | — |
| T-E407-04 | sr-engineer: integrator Permissions first row line 38 → strings `integrator.row1.can` and `integrator.row1.cannot` (AC7; site integrator:38) | none | 1 | `content/skill-integrator.md` | — |
| T-E403-02 | qa-engineer: re-pin e96 `t-fallback-genuine-unavailability` regex + message to the new disjuncts; new AC1/AC2 test file (AC1, AC2, AC3) | T-E403-01 | 2 | `test/e96-dispatch-preference.test.mjs` `test/e403-*.test.mjs` | — |
| T-E407-05 | qa-engineer: new AC4–AC7 test file (site text + citation resolves in each composition that loads it); re-pin e336 `AC-E336-1` grant-name line-70 assertion to the §6 citation, assertion assigned to this lane at pre-review (AC4–AC8) | T-E407-01, T-E407-02, T-E407-03, T-E407-04 | 2 | `test/e407-*.test.mjs` `test/e336-portable-pull.test.mjs` | — |
| T-E407-06 | qa-engineer: `npm run build && node scripts/capture-constitution-golden.mjs` — only the coordinator monolith may differ, each hunk explained; re-measure budgets, record before/after, no cap raised; final `node scripts/test-lock.mjs -- npm test` on the last HEAD, `dist/` clean (AC10–AC12; AC9 review) | T-E403-02, T-E407-05 | 1–2 | `test/fixtures/compose-golden/**` `test/context-budget.test.mjs` | — |
