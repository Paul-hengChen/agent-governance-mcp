# e393-builder-judge-core

Ticket E393 (lane `e393`, fan-out manifest `specs/fanout-e393-builder-judge-core.md`). Sources:
`docs/backlog.md` row E393; `docs/prompt-audit-2026-11-02.md` findings G2-10 and G2-21 (report
only, not modified). Mini-chain: pm → sr-engineer → code-reviewer → qa-engineer, no architect
(text-only change, no new manifest segment). All line numbers below are at the lane base
`f664ec9` unless marked otherwise.

## Problem Statement

The constitution's role-collapse guard "Builder ≠ judge" lives only in
`content/const-11-design-chain-32.md` (§3.2), whose manifest tag is `chain-design`, so it is
composed only into design-armed chain dispatches. Core coordinator fragments (coord-02, coord-03,
coord-05, coord-07), two role SOPs, the design-only const-04 and the Claude Code adapter block in
`CLAUDE.md` all cite "Constitution §3.2 builder ≠ judge" as a hard floor — so every non-design
`/teamwork` composition (most work in this repo) cites a heading and a rule that are not in its
constitution, and reviewer/qa independence on non-design work rests on those citations alone
(G2-10). The rule's own wording is also visual-only ("MUST NOT author the visual verdict"),
while every citing site treats it as general reviewer/qa independence. Separately, eleven body
sites restate the round caps as bare numbers ("Round 4 of `qa_round`", "up to 3 rounds",
"Round 6", `visual_round >= 3`, …) despite const-01's rule that body text names a limit and
never restates its number; the sr-engineer split threshold has no Limits row at all (G2-21).

## User Stories

- As a coordinator running a non-design `/teamwork`, I want the builder ≠ judge rule I cite as a
  hard floor to be in my own constitution, so that the floor is enforceable text rather than a
  dangling reference.
- As any role on any composition (lite, chain, design-armed or not), I want one general
  builder ≠ judge rule covering code-review verdicts, qa verdicts and PASS, so that an inline
  role collapse cannot self-sign a non-visual verdict.
- As a maintainer changing a round cap, I want body text to reference the cap by name, so that
  changing the Limits table value cannot leave stale numbers elsewhere.

## Acceptance Criteria

Every site below maps to exactly one AC and one implementation task. sr-engineer applies the
**current → new** replacements verbatim (exact substring replace, one occurrence each). The new
AC test is `test/e393-builder-judge-core.test.mjs` (qa-authored, T-E393-06); "proof: e393 <case>"
names a test case in that file.

### A. G2-10 — move and generalize the rule (T-E393-01)

- **AC-A1** — Given the lane HEAD, when `content/const-05-core-standards.md` is read, then §3
  *State Synchronisation* ends (after the *Rule grammar (WHEN/DO/ELSE)* bullet, before the blank
  line that closes the fragment) with exactly this bullet, and the composed constitution for each
  of the four `{chain, design}` combinations contains its anchor `**Builder ≠ judge (role-collapse guard)**:` exactly once:

  ```
  - **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change — even a role run inline in another role's context — MUST NOT author its code-review verdict, its qa verdict (visual verdict included), or its PASS. With no independent judge context available, the work stops at `status=Blocked` ("awaiting independent QA") — never a builder-signed verdict.
  ```
  proof: e393 "AC-A1: builder ≠ judge rule is in const-05 §3 and in all four compositions"
- **AC-A2** — Given the lane HEAD, when `content/const-11-design-chain-32.md` is read, then the
  five-line bullet `- **Builder ≠ judge (role-collapse guard).** …never a builder-signed\n  PASS.`
  (base lines 22–26) is absent; the `### 3.2 Visual Verdict Authority & Separation of Duties`
  header (with its origin tag), the intro paragraph (base lines 4–8, **unchanged** — it still
  describes the two remaining rules accurately) and exactly two bullets remain:
  **Visual verdict is qa-visual-owned.** and **No global-frame metric.**
  proof: e393 "AC-A2: const-11 §3.2 keeps its header and exactly two visual bullets"

Destination: **const-05 §3 end** (not const-15) — §3 *State Synchronisation* already holds every
escalation-shape rule (Escalation call format, `tw_complete_task` ownership, which is itself a
builder ≠ judge corollary) and `const-15` stays untouched. Both are tag `core`, so either resolves
in all four compositions; no `prompts/constitution-manifest.ts` change.

Anchor name for every retargeted citation: **"§3 builder ≠ judge"** (`§3 builder != judge` in the
ASCII adapter line).

### B. Citation sites retargeted (G2-10)

| AC | site (base) | current wording (exact substring) | new wording | task |
|---|---|---|---|---|
| AC-B01 | `content/const-04-design-surgical.md:2` | `and builder ≠ judge (sr fixes, qa judges)` | `and §3 builder ≠ judge (sr fixes, qa judges)` | T-E393-01 |
| AC-B02 | `content/coord-02-host-dispatch.md:1` | `as a §3.2 builder ≠ judge downgrade` | `as a §3 builder ≠ judge downgrade` | T-E393-02 |
| AC-B03 | `content/coord-03-core-fallback.md:39` | `(builder ≠ judge, §3.2)` | `(builder ≠ judge, §3)` | T-E393-02 |
| AC-B04 | `content/coord-05-core-visual-drift.md:3` | `Per Constitution §3.2, the coordinator routes` | `Per Constitution §3 builder ≠ judge and, when design-armed, §3.2, the coordinator routes` | T-E393-02 |
| AC-B05 | `content/coord-07-core-sop.md:11` | `and §3.2 builder ≠ judge.` | `and §3 builder ≠ judge.` | T-E393-02 |
| AC-B06 | `content/skill-integrator.md:51` | `your own report, §3.2 builder ≠ judge)` | `your own report, §3 builder ≠ judge)` | T-E393-02 |
| AC-B07 | `content/skill-integrator.md:166` | `never any lane's builder (§3.2)` | `never any lane's builder (§3 builder ≠ judge)` | T-E393-02 |
| AC-B08 | `content/skill-sr-engineer.md:26` | `(§3.2 builder ≠ judge)` (the "Constitution §3.2 — no global-frame metric" on the same line stays: that rule remains in §3.2) | `(§3 builder ≠ judge)` | T-E393-05 |
| AC-B09 | `content/skill-qa-visual.md:12` | `(§3.2 builder≠judge provenance;` | `(§3 builder ≠ judge provenance;` | T-E393-05 |
| AC-B10 | `templates/agent-adapters/claude.md:12` | `voids Constitution §3.2 builder != judge` | `voids Constitution §3 builder != judge` | T-E393-03 |
| AC-B11 | `CLAUDE.md:233` | `voids Constitution §3.2 builder != judge` | `voids Constitution §3 builder != judge` — the whole line byte-identical to `templates/agent-adapters/claude.md:12` | T-E393-03 |
| AC-B12 | `content/constitution-rationale.md:7` | `(e.g. "see Constitution §3.2")` | **unchanged** — a format example; `### 3.2` still exists in const-11, so the reference still resolves | T-E393-03 |
| AC-B13 | `content/constitution-rationale.md:10` | `> Scope: §1, §3.1, §3.2, §5, §6, §7.` | `> Scope: §1, §3, §3.1, §3.2, §5, §6, §7.` | T-E393-03 |
| AC-B14 | `content/constitution-rationale.md:104–137` | header (104) and `See Constitution §3.2.` (106) unchanged; the paragraph at 131–137 from `independent adversary left. The guard: if subagent limits force a role inline, that actor` through `independent QA") — never a builder-signed PASS.` | `independent adversary left. The guard was born here for the visual verdict; it now lives in`⏎`§3, generalized to every code-review verdict, qa verdict and PASS, because the same collapse`⏎`voids a non-visual verdict just as surely. See Constitution §3.` (the first three lines of the paragraph, through `with no`, stay) | T-E393-03 |
| AC-B15 | `content/constitution-rationale.md:165` | `> every VSA row at PASS, and §3.2 is unchanged (no global-frame metric; builder ≠ judge).` | `> every VSA row at PASS, §3.2 is unchanged (no global-frame metric), and so is §3 builder ≠ judge.` | T-E393-03 |

- **AC-B** — Given the lane HEAD, when each citing file above is read, then it contains no
  `§3.2 builder`, `builder≠judge`, `builder ≠ judge, §3.2` or `builder (§3.2)` form; each
  B02–B11 file contains its new `§3 builder ≠ judge` (or `§3 builder != judge`) wording; and for
  every `{chain, design}` combination whose composition loads the citing text (coord-* and the
  chain role skills: `{true,false}`, `{true,true}`; const-04: `{false,true}`, `{true,true}`;
  adapter line: all four), the composed constitution contains the AC-A1 anchor.
  proof: e393 "AC-B: every builder ≠ judge citation resolves in each composition that loads it"
- **AC-B11-eq** — `templates/agent-adapters/claude.md` line 12 === `CLAUDE.md` adapter
  Subagent-dispatch line (located by its `- Subagent dispatch:` prefix, not by line number).
  proof: e393 "AC-B11: adapter template line equals the CLAUDE.md adapter line"
- **AC-B-rat** — rationale stays one-way (rationale → constitution) and every
  `see Constitution §X` in it resolves to exactly one fragment heading (`§3` → const-05
  `## 3. State Synchronisation`). proof: `node --test test/compose-equivalence.test.mjs` passes
  unchanged.

### C. G2-21 — bare round numbers → named caps

| AC | site (base) | current wording (exact substring) | new wording | task |
|---|---|---|---|---|
| AC-C01 | `content/const-01-core-head.md` Limits table, new row after the `visual_round` cap row | — | new row (pipes shown escaped): \| `visual_split` threshold \| 3 \| `visual_round` at which sr-engineer MAY request a split (design-armed only). \| | T-E393-01 |
| AC-C02 | `content/const-06-chain-31-head.md:8` | `cap of QA FAILs (Round 4 of `qa_round`), only` | `cap of QA FAILs is exhausted, only` | T-E393-04 |
| AC-C03 | `content/const-08-chain-31-mid.md:12` | `cap of code-reviewer FAILs (Round 4 of `review_round`), only` | `cap of code-reviewer FAILs is exhausted, only` | T-E393-04 |
| AC-C04 | `content/const-09-design-chain-vround.md:2` | `Capped by the `visual_round` cap; Round 6 attempts lock to` | `Capped by the `visual_round` cap; any round past it locks to` | T-E393-04 |
| AC-C05 | `content/const-09-design-chain-vround.md:3` (four replacements) | (a) `**Split escalation (Round 3)**: at `visual_round >= 3`, sr-engineer` (b) `instead of grinding 2 more rounds toward` (c) `Available at Round 3 through Round 5 (the `visual_round` cap); mandatory route at Round 6.` | (a) `**Split escalation (`visual_split`)**: once `visual_round` reaches the `visual_split` threshold, sr-engineer` (b) `instead of grinding the remaining rounds toward` (c) `Available from the `visual_split` threshold through the `visual_round` cap; mandatory route past the cap.` | T-E393-04 |
| AC-C06 | `content/const-12-chain-r10-s4.md:13` | `(Round 1-3 QA review; Round 1-5 visual review)` | `(QA up to the `qa_round` cap; visual up to the `visual_round` cap)` | T-E393-04 |
| AC-C07 | `content/const-12-chain-r10-s4.md:16–17` | `loops on `(code-reviewer, FAIL)` for up to 3`⏎`rounds (`review_round` cap).` | `loops on `(code-reviewer, FAIL)` up to the`⏎``review_round` cap.` | T-E393-04 |
| AC-C08 | `content/const-12-chain-r10-s4.md:18` | `(review Round 1 through the `qa_round` cap)` | `(up to the `qa_round` cap)` | T-E393-04 |
| AC-C09 | `content/skill-qa-engineer.md:66` | `*Escalation Routes: unresolved after Round 3*` | `*Escalation Routes: unresolved at the `qa_round` cap*` | T-E393-05 |
| AC-C10 | `content/skill-qa-engineer.md:91` | `At Round 4 (the `qa_round` cap of prior FAILs exhausted), only` | `Once the `qa_round` cap of prior FAILs is exhausted, only` | T-E393-05 |
| AC-C11 | `content/skill-qa-engineer.md:113` | row (pipes shown escaped): \| unresolved after Round 3 \| FAIL \| `QA: <task-id> failed Round 3` \| pm \| | \| unresolved at the `qa_round` cap \| FAIL \| `QA: <task-id> unresolved at the qa_round cap` \| pm \| (renamed together with C09 — same task) | T-E393-05 |
| AC-C12 | `content/skill-qa-visual.md:83` | `Past the `visual_round` cap (Round 6 attempts), only` | `Past the `visual_round` cap, only` | T-E393-05 |
| AC-C13 | `content/skill-qa-visual.md:99` | first cell (pipes shown escaped): \| FAIL past visual round 6 \| | \| FAIL past the `visual_round` cap \| | T-E393-05 |
| AC-C14 | `content/skill-sr-engineer.md:28` | `When `visual_round >= 3` and you assess` | `When `visual_round` ≥ `visual_split` and you assess` | T-E393-05 |
| AC-C15 | `content/skill-sr-engineer.md:51` | `(`visual_round >= 3`, cannot converge within budget)` | `(`visual_round` ≥ `visual_split`, cannot converge within budget)` | T-E393-05 |
| AC-C16 | `content/constitution-rationale.md:184–185` (PM decision: touched — non-normative, but it would rot the same way) | `at Round 3, prefer splitting the oversized`⏎`widget over grinding two more rounds toward threshold renegotiation.` | `from the `visual_split` threshold on, prefer`⏎`splitting the oversized widget over grinding the remaining rounds toward threshold renegotiation.` | T-E393-03 |

(⏎ = line break inside the replaced span. Inner backticks in the table are literal file text.)

- **AC-C** — Given the lane HEAD, then none of the old substrings in C02–C16 remains;
  `content/const-06-chain-31-head.md`, `content/const-08-chain-31-mid.md`,
  `content/const-09-design-chain-vround.md` and `content/const-12-chain-r10-s4.md` contain no
  match for `/Round \d|round \d|>= ?\d|up to \d|\d more rounds/`; `content/skill-sr-engineer.md`,
  `content/skill-qa-visual.md` and `content/skill-qa-engineer.md` contain none of
  `visual_round >= 3`, `Round 3`, `Round 4`, `Round 6`, `visual round 6` (other occurrences
  such as qa's "Phase 2 round 1" are out of scope and must not be asserted on); and the Limits
  table contains the C01 row. proof: e393 "AC-C: named sites restate no bare round number" and
  e393 "AC-C01: Limits table has the visual_split row"
- **AC-C-x** — the qa Escalation Routes table keeps 7 data rows (rename only).
  proof: `node --test test/ac-execution.test.mjs` passes unchanged.

Note: `visual_split` is prose-governed — the server allows `(sr-engineer, In_Progress) →
(pm, In_Progress)` at any round (see `test/visual-round-transitions.test.mjs` AC-9); no code
mirrors the value, exactly like `pass_budget`. `tools/transitions.ts` is not touched.

### D. Constitution header (T-E393-01) — needs human ruling

- **AC-D1** — If the human approves the bump: `content/const-01-core-head.md:1` reads
  `# Constitution v3.41.0` (comment unchanged unless budget option (i-b) is chosen); otherwise
  line 1 is unchanged. PM recommendation: **bump** — a rule's scope widens. Zero bytes either way.
  proof: `head -1 content/const-01-core-head.md`

### E. Context budget (T-E393-06) — needs human ruling

Measured on the base tree (`dist/` built) with the composition `test/context-budget.test.mjs`
uses; "after" computed in memory by applying exactly the replacements in this spec (no file
written). Negative headroom = over the ceiling, in ~tok (chars/4).

| figure (test line) | ceiling | before | after (this spec) | headroom | after + (i-a) | after + (i-a) + (i-b) |
|---|---|---|---|---|---|---|
| lean always-on (`context-budget.test.mjs:200`) | 5723 | 5722 | 5844 | −121 | 5809 (−86) | 5711 (+12) |
| non-design stripped (`:912`) | 8501 | 8495 | 8609 | −108 | 8574 (−73) | 8476 (+25) |
| design-arm stripped (`:566`) | 10598 | 10593 | 10626 | −28 | 10574 (+24) | 10475 (+123) |
| teamwork stripped bundle (`:591`) | 21715 | 21588 | 21630 | +85 | 21577 (+138) | 21479 (+236) |
| skill-sr-engineer stripped (`:502`) — not in the manifest's list, found by PM | 2852 | 2850 | 2856 | −4 | 2851 (+1) | 2851 (+1) |
| skill-qa-engineer bytes (`e391-prompt-audit-stale-facts.test.mjs:88`) | 18500 | 18371 | 18398 | +102 | 18398 | 18398 |

Option (i) — equal-bytes trims (no ceiling raised):

| id | file (site) | exact trim | saves (chars) | in lane ownership? |
|---|---|---|---|---|
| t1 | `content/const-04-design-surgical.md:2` | `(c) §3.2 is unchanged — no global-frame metric, the visual verdict stays qa-visual-owned, and §3 builder ≠ judge (sr fixes, qa judges).` → `(c) §3 builder ≠ judge and §3.2 still hold (sr fixes, qa judges).` | 70 | yes (the (c) clause) |
| t2 | `content/const-01-core-head.md` C01 row | meaning cell → `` `visual_round` from which sr-engineer MAY request a split. `` | 18 | yes |
| t3 | `content/const-05-core-standards.md` AC-A1 bullet | delete ` — even a role run inline in another role's context —` | 53 | yes |
| t4 | `content/const-12-chain-r10-s4.md:13` | delete the diagram parenthetical `  (QA up to the `qa_round` cap; visual up to the `visual_round` cap)` (§4 prose below states the loops) | 68 | yes |
| t5 | `content/skill-sr-engineer.md:26` | `self-converge relaxation (v3.31.0)` → `self-converge relaxation` | 10 | yes |
| t6 | `content/skill-sr-engineer.md:26` | `Reuse the same existing playwright/headless harness and the same per-region output format` → `Reuse the existing playwright/headless harness and the per-region output format` | 10 | yes |
| w1 | `content/const-05-core-standards.md:5` | delete ` (precedent: A10 gate-registry module split, `specs/gate-registry.md` — "assertions unmodified — only import paths may change")` | 127 | **no** — const-05 is owned only for the §3-end bullet |
| w2 | `content/const-15-core-tail.md:12` | delete ` Reason (D10, generalized): a destructive "fix" under push-rejection pressure once discarded a committed release — recovery is coordinator-owned, never agent-improvised.` | 169 | **no** — const-15 is owned only if it is the destination |
| w3 | `content/const-01-core-head.md:1` | header comment → `<!-- versioned independently of package.json -->` | 97 | line 1 is owned, but the comment is G2-14 territory |

(i-a) = t1–t6 (all in ownership): design-arm, teamwork and sr fit; lean (−86) and non-design
(−73) still over. (i-b) = (i-a) + w1–w3: all six figures fit; needs the integrator to widen
ownership to `content/const-05-core-standards.md:5` and `content/const-15-core-tail.md:12`
(w1/w2 drop a precedent citation and a "Reason" sentence — non-normative why-text, no rule
changes; the human should confirm that loss). No equal-bytes path exists inside the current
ownership.

Option (ii) — raise ceilings to the measured after-values (E336/E365 re-baseline precedent):
lean 5723 → 5844, non-design 8501 → 8609, design-arm 10598 → 10626, sr 2852 → 2856; teamwork
unchanged (fits). A hybrid — (i-a) plus raising only lean → 5809 and non-design → 8574 — is
also possible. PM does not pick; qa re-measures on the real tree and sets any raised cap to the
exact measured value with a one-line E393 re-baseline comment.

- **AC-E1** — every figure in the table above passes on the lane HEAD under the option the
  human approved; the qa report records before/after per figure.
  proof: `node --test test/context-budget.test.mjs test/e391-prompt-audit-stale-facts.test.mjs`
  (inside the suite lock)

### F. Tests and goldens (T-E393-06, qa-owned)

Tests whose pinned strings change (grep-verified on the base tree):

| file | site | change |
|---|---|---|
| `test/fixtures/compose-golden/**` (12 files) | all | re-capture with `node scripts/capture-constitution-golden.mjs`; every hunk explained in the qa report (const-01/04/05 hit lite + full + hooks + monolith; chain const-06/08/09/11/12 hit full + monolith + hook-full; coord-* hit `skill-coordinator-monolith.txt` + hook-full; `skill-sr-engineer.md` hits `build-full-*` — it is the capture script's `CHAIN_SKILL`) |
| `test/context-budget.test.mjs` | :200, :566, :912 (+ comments :906–907), :502 | ceilings per the human's budget ruling |
| `test/context-budget.test.mjs` | :658 | sentinel `Split escalation (Round 3)` → `` Split escalation (`visual_split`) `` |
| `test/context-budget.test.mjs` | :712, :1022 | anchor `… for up to 3` → `` sr-engineer ↔ code-reviewer loops on `(code-reviewer, FAIL)` up to the `` (reworded sentence, T-C9-11 precedent at :1025) |
| `test/context-budget.test.mjs` | :517, :659, :780–784 | **no change** — the `3.2 Visual Verdict Authority` header and the §3.2 span anchors remain |
| `test/e178a-integrator-role.test.mjs` | :83 | `SOP.includes("§3.2")` → `SOP.includes("§3 builder ≠ judge")` (skill-integrator has no `§3.2` left) |
| `test/e391-prompt-audit-stale-facts.test.mjs` | :91–94 | `(Round 4 of `review_round`)` count 1 → 0, plus `cap of code-reviewer FAILs is exhausted` count 1; retitle the case |
| `test/e5-intake-tiering.test.mjs` | :385 | regex `§3\.2 builder ≠ judge` → `§3 builder ≠ judge` |
| `test/e96-dispatch-preference.test.mjs` | :52 | regex `as a §3\.2 builder ≠ judge downgrade` → `as a §3 builder ≠ judge downgrade` |
| `test/phase-0-5-sop.test.mjs` | :67 | `/visual_round\s*>=\s*3/` → a match for `` `visual_round` ≥ `visual_split` `` |
| `test/compose-equivalence.test.mjs` | :137–179 | verify only — passes unchanged (golden monolith re-captured; rationale `§3` ref resolves) |
| `test/agc-adapters.test.mjs` | — | verify only (does not pin §3.2) |
| `test/ac-execution.test.mjs` | :403–413 | verify only (row count 7 unchanged) |

No other test pins a changed string (grep of `test/` for `Round 4 of`, `up to 3`, `3.2 Visual`,
`builder`, `visual_round >= 3`, `Round 6`, `Round 3`, `§3.2`, `Round 1-3`, `Split escalation`,
`unresolved after`, `visual round 6`, `failed Round`, `Round 1 through`, `v3.40.0`; remaining hits
are comments or server-behaviour tests). `test/qa-flow.test.mjs`,
`test/visual-gate-e2e.test.mjs` and `test/visual-round-transitions.test.mjs` test server code and
are not touched.

- **AC-F1** — goldens re-captured; `node --test test/compose-equivalence.test.mjs test/skill-manifest.test.mjs test/e90-golden-capture-completeness.test.mjs` passes; every golden hunk explained.
- **AC-F2** — `test/e393-builder-judge-core.test.mjs` exists with the cases named in AC-A1,
  AC-A2, AC-B, AC-B11-eq, AC-C, AC-C01; it composes via `dist/prompts/build.js`
  `composeConstitution`, does not pin a base sha, and does not read `specs/fanout-*.md`.
  proof: `node --test test/e393-builder-judge-core.test.mjs`
- **AC-F3** — full suite green on the final HEAD: `node scripts/test-lock.mjs -- npm test`.
- **AC-F4** — `npm run build` leaves `git status --short dist/` empty; `agc check` exits 0 with
  stamps untouched; `npm run check:md-tables` passes (new Limits row).

## Copy / Strings

Agent-facing governance text only (no end-user UI). Every replaced substring is listed in the
B and C tables above with its exact text; this table names the new strings.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| const05.builder-judge | `- **Builder ≠ judge (role-collapse guard)**: the actor that built or edited a change — even a role run inline in another role's context — MUST NOT author its code-review verdict, its qa verdict (visual verdict included), or its PASS. With no independent judge context available, the work stops at `status=Blocked` ("awaiting independent QA") — never a builder-signed verdict.` | `docs/backlog.md` E393 (human decision option (A)); `docs/prompt-audit-2026-11-02.md` G2-10; generalized from const-11:22–26 |
| anchor.citation | `§3 builder ≠ judge` / `§3 builder != judge` (adapter) | authored-here — shortest anchor naming section + rule, mirrors the old `§3.2 builder ≠ judge` form |
| const01.limits.visual_split | \| `visual_split` threshold \| 3 \| `visual_round` at which sr-engineer MAY request a split (design-armed only). \| | `docs/backlog.md` E393; G2-21 ("在 Limits 表加 `visual_split` 門檻"); value from const-09:3 `visual_round >= 3` |
| qa.route.cap | `unresolved at the `qa_round` cap` (situation) / `QA: <task-id> unresolved at the qa_round cap` (pending note) | authored-here — matches the existing step-66 label "Unresolved at the `qa_round` cap" and its rollback reason |
| blocked.label | `"awaiting independent QA"` (kept for code-review blocks too) | const-11:25 / coord-03:39 — kept verbatim for continuity; PM decision, not a ruling item |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any change to `tools/**`, `gates/**`, `schema/**`, `guards/**`, `lib/**`, `bin/**`,
  `scripts/**`, `prompts/**`, error codes, `ALLOWED_TRANSITIONS` or routing; no new manifest
  segment. `dist/` shows no diff after `npm run build`.
- `agc-version:` stamps in `CLAUDE.md` / `AGENTS.md` / `.antigravityrules`; any `CLAUDE.md` line
  other than 233 (E395 counts and Layout).
- E392 (Task/Agent wording in coord-02/coord-04, `templates/claude-code-agents/**`), E394, E395,
  E396; G2-17 restatement merge; the G2-14 header-versioning policy (only the bump itself is
  ruled here).
- Round numbers in `tools/transitions.ts` and in gate hint strings (code).
- Historical §3.2 references in `docs/`, `specs/`, `research/`; `gates/registry.ts:483` and
  `content/skill-architect.md:24` (they cite visual rules that stay in §3.2);
  `content/skill-qa-visual.md:24,69` (visual verdict authority, stays §3.2).
- `content/skill-qa-engineer.md:46` "Phase 2 round 1" (a phase step, not a cap restatement).
- Release bookkeeping (version bump, CHANGELOG, backlog done-mark) — release-engineer /
  integrator.

## Dependencies / Prerequisites

- E391 merged (dependency cleared). Base `f664ec9`; `dist/` built; drift clean.
- No design file → no-design mode; Visual Structural Assertions omitted.
- Resource Audit: every reference in the sources is an in-repo path; `external_refs` = none.
- Question Batch: no human channel in this hop (Task-dispatched); open items are recorded as
  `needs human ruling` in the Cut Gate Summary.

## Tasks

Tasks (all `T-E393-NN`; each within the `task_size` budget; each site maps to exactly one task):

- [ ] T-E393-01 [P0] sr-engineer: AC-A1, AC-A2, AC-B01, AC-C01, AC-D1 (if approved) + any approved budget trims t1/t2/t3/w1/w3 (and w2 if widened) — `content/const-05-core-standards.md`, `content/const-11-design-chain-32.md`, `content/const-04-design-surgical.md`, `content/const-01-core-head.md` (+ `content/const-15-core-tail.md` only under (i-b)) | depends_on: none
- [ ] T-E393-02 [P0] sr-engineer: citation retargets AC-B02–AC-B07 — `content/coord-02-host-dispatch.md`, `content/coord-03-core-fallback.md`, `content/coord-05-core-visual-drift.md`, `content/coord-07-core-sop.md`, `content/skill-integrator.md` | depends_on: T-E393-01
- [ ] T-E393-03 [P1] sr-engineer: AC-B10–AC-B15, AC-C16 — `templates/agent-adapters/claude.md`, `CLAUDE.md` (line 233 only), `content/constitution-rationale.md` | depends_on: T-E393-01
- [ ] T-E393-04 [P1] sr-engineer: G2-21 constitution sites AC-C02–AC-C08 (+ t4 if approved) — `content/const-06-chain-31-head.md`, `content/const-08-chain-31-mid.md`, `content/const-09-design-chain-vround.md`, `content/const-12-chain-r10-s4.md` | depends_on: T-E393-01
- [ ] T-E393-05 [P1] sr-engineer: AC-B08, AC-B09, AC-C09–AC-C15 (+ t5/t6 if approved) — `content/skill-sr-engineer.md`, `content/skill-qa-visual.md`, `content/skill-qa-engineer.md` | depends_on: T-E393-01
- [ ] T-E393-06 [P0] qa-engineer: AC-E1, AC-F1–AC-F4 — golden re-capture with hunk notes, pinned-test re-pins (F table), budget re-measure, ceiling change only as the human ruled, new `test/e393-builder-judge-core.test.mjs` | depends_on: T-E393-02, T-E393-03, T-E393-04, T-E393-05

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E393 | Lift builder ≠ judge out of const-11 §3.2 into const-05 §3 (generalized to code-review / qa verdicts and PASS), retarget every §3.2 builder ≠ judge citation to §3, replace bare round numbers with named caps, add the `visual_split` Limits row; qa re-captures goldens, re-pins tests, re-measures budget, adds the AC test | none | ~38 (19 text, 12 golden, 7 test) | `content/const-01-core-head.md`, `content/const-04-design-surgical.md`, `content/const-05-core-standards.md`, `content/const-06-chain-31-head.md`, `content/const-08-chain-31-mid.md`, `content/const-09-design-chain-vround.md`, `content/const-11-design-chain-32.md`, `content/const-12-chain-r10-s4.md`, `content/constitution-rationale.md`, `content/coord-02-host-dispatch.md`, `content/coord-03-core-fallback.md`, `content/coord-05-core-visual-drift.md`, `content/coord-07-core-sop.md`, `content/skill-integrator.md`, `content/skill-qa-engineer.md`, `content/skill-qa-visual.md`, `content/skill-sr-engineer.md`, `templates/agent-adapters/claude.md`, `CLAUDE.md`, `test/fixtures/compose-golden/**`, `test/context-budget.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e5-intake-tiering.test.mjs`, `test/e96-dispatch-preference.test.mjs`, `test/phase-0-5-sop.test.mjs`, `test/e393-*.test.mjs`, `specs/e393-*` | — |

## Gate Summary

- **Policy change (flagged for the human): the builder ≠ judge rule's scope widens.** Today the
  constitution text forbids only a builder-authored *visual* verdict / visual PASS, and only on
  design-armed chain dispatches. After E393 it forbids the actor that built or edited a change
  from authoring that change's code-review verdict, qa verdict or PASS, on every composition
  (lite, chain, design-armed or not). The citing sites already assumed this wider reading; no
  server gate changes (PASS stays server-restricted to `agent_id="qa-engineer"`; the rest is
  prompt-governed, as before). Lite mode writes no verdicts, so it gains a prohibition but no new
  duty.
- **§3.2 after the move**: header and intro paragraph unchanged; exactly the two visual rules
  remain.
- **Destination**: const-05 §3 end (reason above); `const-15` untouched unless (i-b) widens it
  for trim w2.
- **needs human ruling — budget**: (i) equal-bytes trims — (i-a) in-ownership t1–t6 leave lean
  −86 and non-design −73 over; (i-b) adds w1–w3 and fits all figures but needs ownership widened
  to `content/const-05-core-standards.md:5` and `content/const-15-core-tail.md:12`; or (ii) raise
  lean → 5844, non-design → 8609, design-arm → 10626, sr → 2856 (the hybrid (i-a) + lean → 5809,
  non-design → 8574 is also possible). PM does not pick.
- **needs human ruling — constitution header**: bump `Constitution v3.40.0` → `v3.41.0`
  (PM recommends bump: a rule's scope widens).
- **Extra test found beyond the manifest list**: the skill-sr-engineer stripped cap
  (`test/context-budget.test.mjs:502`, 2852) is hit (+4 after) — same owned file, covered by the
  budget ruling. No other test file outside the manifest's list pins a changed string.
- **PM decisions (no ruling needed)**: rationale :184 touched (AC-C16); rationale :7 left
  unchanged (AC-B12); `"awaiting independent QA"` kept verbatim for all blocks.
- **Resource Audit Gate**: `external_refs` = none (all in-repo).
- **Scope decision**: single feature (one ticket, one lane, disjoint by construction).
- manifest-tier: not eligible — config cutApprovalAutoTier has no manifest:true; cut is human-approved in the lane session
