# e288-integrator-stage0-and-test-hygiene

Lane `e288` of `specs/fanout-post-v4-w5.md` (post-v4 wave 5). Tickets: E288 (integrator Stage 0, D3 hand-off note) and E323 (fixed-base diff tests, qa convention line). Sources: `docs/backlog.md` rows E288 / E323; `docs/integrator-revision-2026-10-08.md` §2.2 (row 🆕 0), §4 (O3), §6.2 (D3), §7.1; the manifest's 派工前核對 bullets for E288 / E323 and the e288 Lanes row.

## Problem Statement
The integrator SOP's Stage 1 assumes tickets are already cut, and its permission table does not let the integrator dispatch PM. When the human brings only a scope draft or a hand-off note from another repo, there is no sanctioned path from that input to tickets. The PM SOP has no row for being dispatched that way, so every brief would have to restate the protocol. Separately, two resident tests diff against a fixed lane base sha: `test/e178a-integrator-role.test.mjs` (added-line count of `content/const-15-core-tail.md` vs `3c72a83`) and `test/e296-manifest-tier.test.mjs` AC10 (HEAD `fanout render` vs the render of `c392cc3`'s code). Both rot under legitimate later edits, and both only loud-skip when the base is absent. `3c72a83` is already absent from this clone, so the e178a check never runs. No test-writing SOP says not to write such tests.

## User Stories
- As the integrator, I want an optional Stage 0 that dispatches PM to write only a ticket-cut file, so that a scope draft or cross-repo hand-off note becomes Stage 1 input without me cutting tickets myself.
- As PM dispatched by the integrator, I want my SOP to carry the Stage 0 protocol, so that the brief only names input and output paths.
- As a human working across repos, I want one standard hand-off note shape (background with the settled contract and its sources, current state, to do, not to do), so that the receiving integrator gets the same four facts every time.
- As qa-engineer, I want a one-line convention in my SOP and no fixed-base diff in resident tests, so that tests do not rot when the code they compare is legitimately edited.

## Acceptance Criteria

### E288 — `content/skill-integrator.md`, `content/skill-pm.md`
- **AC-E288-1** — Given `content/skill-integrator.md`, when it is read, then (a) a `## Stage 0 — Ticket cut (optional)` heading sits after `## Governance state (D11)` and before `## Stage 1 — Fan-out planning`; (b) the *Work overview* table has a row whose first cell is `0. Ticket cut (optional)`, placed above the `1. Fan-out planning` row; (c) the *Lifecycle* table has a stage-0 row placed above the stage-1 row; (d) the invocation line says `fan-out <feature or wave>` covers stages 0–3.
  proof: `node --test --test-name-pattern "AC-E288-1" test/e288-integrator-stage0.test.mjs`
- **AC-E288-2** — Given the Stage 0 section, when it is read, then it says Stage 0 is skipped when the tickets are already cut, and runs only when the human gives a scope draft or a cross-repo hand-off note.
  proof: `node --test --test-name-pattern "AC-E288-2" test/e288-integrator-stage0.test.mjs`
- **AC-E288-3** — Given the Stage 0 section, when it is read, then it says: PM is dispatched via Task; PM writes only the ticket-cut file at `specs/ticket-cut-<feature>.md`; PM writes no spec, no `tasks.md`, and makes no write-type `tw_*` call; the cut file is approved together with the manifest at Stage 2; the brief does not restate the protocol because the PM SOP row carries it. The Stage 1 `Input:` line names the Stage 0 cut file as an input. Stage 2 says one approval covers both the manifest and the cut file.
  proof: `node --test --test-name-pattern "AC-E288-3" test/e288-integrator-stage0.test.mjs`
- **AC-E288-4** — Given the `## Permissions` table, when it is read, then it has exactly one new row allowing a Stage 0 PM dispatch (Task) to write the ticket-cut file only, no `tasks.md`, no write-type `tw_*`; the existing `cannot` cell `` `tw_update_state`; writing any lane's `.current/<lane>/` `` is unchanged; the table has 5 body rows (was 4).
  proof: `node --test --test-name-pattern "AC-E288-4" test/e288-integrator-stage0.test.mjs`
- **AC-E288-5** — Given the Stage 0 section, when it is read, then it defines the cross-repo hand-off note (D3) as one Stage 0 input with four parts in this order — **Background** (the settled contract and its sources), **Current state**, **To do**, **Not to do**; says the human carries its path; and says the note is recorded as the manifest's first Decisions row, with `出處` naming the sending repo and the note's repo-relative path (never an absolute path).
  proof: `node --test --test-name-pattern "AC-E288-5" test/e288-integrator-stage0.test.mjs`
- **AC-E288-6** — Given `content/skill-pm.md`, when it is read, then the *Gate Summary* table has exactly one row whose first cell is `**Integrator Stage 0 cut**`, placed after the `**Manifest-Tier Self-Attestation**` row. The row says: write only the cut file the brief names; one row per ticket under the existing Cut-Approval header (`id` = backlog id, else `NEW-<n>`); open questions as `needs human ruling` items; no spec, no `tasks.md`, no write-type `tw_*`; do not halt for approval because the human approves the file with the integrator's manifest; final reply is the file path. The Cut-Approval header literal stays present exactly once.
  proof: `node --test --test-name-pattern "AC-E288-6" test/e288-integrator-stage0.test.mjs`
- **AC-E288-7** — Given the edited `content/skill-pm.md`, when its body is measured the way `test/context-budget.test.mjs` does (frontmatter stripped, `stripRationale(stripOriginTags(expandPartials(body)))`, `ceil(length/4)`), then the measured ~tok is ≤ the cap the human approves with this cut (proposed 4860, see Cut). The cap test is re-pinned to the exact measured value, with zero headroom per that test's own cap rule. The message names this lane.
  proof: `node --test --test-name-pattern "skill-pm stripped token count" test/context-budget.test.mjs`
- **AC-E288-8** — Given the whole edited `content/skill-integrator.md`, when the existing pins run, then each one is green without change to its assertions: e246 (Stage 6 finish / mailbox fragments `reset`, `never reused`, `by hand`, `stop the mailbox watch`, `removes the default-location mailbox`), e297, e286, e295, e296 AC5/AC6/AC14, and e178a apart from the E323 rewrite. Stage 4 *Mid-wave base fix* (including condition 2) and `## Stage 6` are byte-identical to the merge-base.
  proof: `git diff origin/main...HEAD -- content/skill-integrator.md` shows no `-` line inside `### Mid-wave base fix` or `## Stage 6`, and `node --test test/e246-mailbox-teardown.test.mjs test/e297-main-protected-sop.test.mjs test/e286-integrator-trust-and-git.test.mjs test/e295-hop-cap-and-sop-halves.test.mjs test/e296-manifest-tier.test.mjs test/e178a-integrator-role.test.mjs` exits 0.

### E323 — fixed-base diff tests, qa convention line
- **AC-E323-1** — Given `test/e178a-integrator-role.test.mjs`, when it is read, then it contains no `BASE_SHA`, no `3c72a83`, and no `git diff` against a fixed sha. The historical "AC6 (historical): const-15 §6 addition stays terse vs base" test is replaced by a structural assertion that stays true under legitimate const-15 edits (Test Plan T1). Any helper left unused, such as `skipIfHistoryAbsent`, is removed.
  proof: `grep -nE 'BASE_SHA|3c72a83|"diff"' test/e178a-integrator-role.test.mjs` prints nothing, and `node --test test/e178a-integrator-role.test.mjs` exits 0 with no skipped test.
- **AC-E323-2** — Given `test/e296-manifest-tier.test.mjs`, when it is read, then AC10 no longer extracts or runs code from a fixed commit: there is no `git archive`, no `git rev-parse --verify` of `c392cc3`, and no base-vs-HEAD render comparison. It is replaced by content/structure assertions on the render of the frozen in-test manifest (Test Plan T2). The file header comment no longer says AC10 runs git.
  proof: `grep -nE '"archive"|"rev-parse"|BASE_CODE' test/e296-manifest-tier.test.mjs` prints nothing, and `node --test test/e296-manifest-tier.test.mjs` exits 0 with no skipped test.
- **AC-E323-3** — Given `content/skill-qa-engineer.md`, when it is read, then SOP step 6 (*Phase 3 — Tests*) carries exactly one new sub-item `f.` with the convention line (Copy `qa.resident-hygiene`). The SOP's top-level step numbering stays `1..7`, so `test/qa-visual-skill-split.test.mjs` AC-4 holds.
  proof: `grep -c 'never diff against a fixed lane base sha' content/skill-qa-engineer.md` prints `1`, and `node --test --test-name-pattern "AC-4" test/qa-visual-skill-split.test.mjs` exits 0.
- **AC-E323-4** — Given the edited `content/skill-qa-engineer.md`, when `test/qa-visual-skill-split.test.mjs` AC-5 runs, then the qa-engineer.md byte cap holds. The cap is re-pinned per that test's own convention (measured `wc -c` + 350–550 bytes; proposed 18500) **only if** the human approves Decision D1.
  proof: `node --test --test-name-pattern "AC-5" test/qa-visual-skill-split.test.mjs` exits 0.

### Lane-wide
- **AC-LANE-1** — Given the lane branch, when its scope is checked, then every touched path is inside the e288 `擁有` cell, plus `test/qa-visual-skill-split.test.mjs` if D1 is approved and recorded in the manifest.
  proof: `node scripts/fanout.mjs check specs/fanout-post-v4-w5.md e288 --base main` exits 0 (or names only `test/qa-visual-skill-split.test.mjs` under an approved D1).
- **AC-LANE-2** — Given the final committed HEAD with no untracked files, when the full suite runs, then it is green.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0.

## Copy / Strings
SOP text is agent-facing, not user-facing. The literals below are pinned so that sr copies them verbatim and qa asserts on them. The prose around them is the sr-engineer's, bounded by the ACs.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| int.stage0.heading | `## Stage 0 — Ticket cut (optional)` | `docs/integrator-revision-2026-10-08.md` §2.2 row 🆕 0 (切票（選用）) |
| int.overview.row0 | `\| 0. Ticket cut (optional) \| Only when the human gives a scope draft or a cross-repo hand-off note: dispatch PM to write the ticket-cut file only; skipped when tickets are already cut \|` | §2.2 row 🆕 0; authored-here (English rendering) |
| int.stage0.skip | `Skip it when the tickets are already cut` | §2.2 「票已切好就跳過」 |
| int.stage0.path | `specs/ticket-cut-<feature>.md` | authored-here: `specs/fanout-*` is swept by `fanout.mjs validate` (e296 AC9), and `specs/cut-*` already holds an unrelated spec |
| int.stage0.pm-only | `no spec, no \`tasks.md\`, no write-type \`tw_*\` call` | §4 O3 「只寫切票檔、不呼叫 `tw_*` 寫入工具」 |
| int.stage0.approval | `approved together with the manifest at Stage 2` | backlog E288 「approved together with the manifest」 |
| int.perm.row | `\| Stage 0 only: dispatch PM (Task) to write the ticket-cut file — no \`tasks.md\`, no write-type \`tw_*\` \| Dispatch PM for anything else (spec, tasks, state writes) \|` | §4 O3 「新增 Stage 0 和權限」; authored-here wording |
| int.d3.parts | `**Background** (the settled contract and its sources), **Current state**, **To do**, **Not to do**` | §6.2 D3 + §6.1 (背景、現況、要做、不做) |
| int.d3.path | `The human carries its path` | §6.2 D3 「路徑仍由人類帶過去」 |
| pm.stage0.row | `\| **Integrator Stage 0 cut** \| The integrator's brief dispatches you for its Stage 0. \| Write only the cut file the brief names: one row per ticket under the Cut-Approval header below (\`id\` = the backlog id, else \`NEW-<n>\`), then each open question as a \`needs human ruling\` item. No spec, no \`tasks.md\`, no write-type \`tw_*\` (reads stay). Do not halt for approval — the human approves the file with the integrator's manifest. Final reply: the file path. \|` | §4 O3 「PM 的 SOP 加一列」; authored-here wording (459 bytes measured) |
| qa.resident-hygiene | `   f. **Resident-test hygiene**: assert only the stable structure of a real, growable file (e.g. \`specs/fanout-*.md\`) or use a frozen in-test fixture; never diff against a fixed lane base sha.` | manifest 派工前核對 E323 bullet (慣例句); 193 bytes measured |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- `content/const-*.md`, `content/coord-*.md` (constitution and coordinator SOP).
- E285 / E294 / E289 / E290 / E292 (other tickets of the integrator revision); D1 / D2 / D4.
- E322's SOP wording (Stage 4 *Mid-wave base fix* condition 2); any edit inside `### Mid-wave base fix` or `## Stage 6`.
- The sentences `test/e246-mailbox-teardown.test.mjs` pins (Stage 6 finish / mailbox).
- `docs/lane-protocol.md` §3 (its guarded historical-SHA allowance is filed as a finding instead, see Dependencies).
- Allocating backlog ids for Stage 0 `NEW-<n>` tickets with a tool. The SOP says the integrator allocates them at Stage 1; no tooling is added.
- Release bookkeeping (version, CHANGELOG, backlog done-marks): release-engineer / integrator 5c.

## Dependencies / Prerequisites
- Lane base: `main` at the manifest merge; lane ledger empty at start. No design file (mode = no-design, so Visual Structural Assertions are omitted). No external references: every source is a repo file. The Resource Audit found zero `http(s)://` / figma / ticket-system hits in the inputs.
- **Stale number in the dispatch inputs**: backlog E288 and integrator-revision §7.1 say the PM cap is 4401. The actual cap in `test/context-budget.test.mjs:475–487` is **4708**, re-baselined by E296. The current skill-pm measures **4708 ~tok** (18832 stripped chars), so there is zero headroom and any added row requires the cap bump.

### Edit locations (current file, base of this lane)
`content/skill-integrator.md` (215 lines):
- L18–30 `## Work overview` table: insert the `int.overview.row0` row between the header separator (L23) and the `| 1. Fan-out planning |` row (L24).
- L32–39 `## Permissions` table: append the `int.perm.row` row after L38 (`Dispatch code-reviewer / qa-engineer (Task) …`), before the *Decide alone* row (L39).
- L51–60 `## Lifecycle` table: insert a stage-0 row above `| 1 | integrator | lane manifest |` (L55): `| 0 (optional) | PM, dispatched by the integrator | ticket-cut file \`specs/ticket-cut-<feature>.md\` |`.
- L62 invocation sentence: `fan-out <feature or wave>` (stages 1–3) → (stages 0–3).
- L64–66 `## Governance state (D11)`: no change. Stage 0's PM makes no state write, so D11 holds as written.
- New `## Stage 0 — Ticket cut (optional)` section between L66 and L68 (`## Stage 1 — Fan-out planning`). Contents: skip / run condition; numbered steps (dispatch PM via Task with a brief naming input path(s) and the output path; read the cut as Stage 1 input; `NEW-<n>` ids get full backlog rows from the integrator at Stage 1, as in 5c-1; present and commit the cut file with the manifest); the D3 hand-off note paragraph (four parts, the human carries its path, first Decisions row with a repo-relative `出處`).
- L70 Stage 1 `Input:` line: append `, or the Stage 0 cut file` inside the parenthesis.
- L79–81 `## Stage 2`: append one sentence saying that when Stage 0 ran, the cut file is presented with the manifest and one approval covers both. Keep the existing `approval` / `human` text that e296 AC5 pins.
- Do not touch L108–118 (`### Mid-wave base fix`) or L172–184 (`## Stage 6` incl. *Your own commits*).

`content/skill-pm.md` (118 lines):
- L97–112 `## Gate Summary` table: append `pm.stage0.row` as the last row, after `**Manifest-Tier Self-Attestation**` (L112) and before the blank line preceding the Cut-Approval header paragraph (L114–116).
- No other edit. The Output rule (L9–10) is overridden for this case by the row's "Final reply" clause, not by rewording the Output rule.

`content/skill-qa-engineer.md` (116 lines):
- L69–76 SOP step 6 *Phase 3 — Tests*: insert `qa.resident-hygiene` as a new line after `   e. Write the automated tests.` (L76), before the blank line and `6a.` (L78).

### Budget impact (measured on the lane base)
| file | measure | now | after (est.) | cap now | proposed cap |
|---|---|---|---|---|---|
| `content/skill-pm.md` | stripped ~tok (`test/context-budget.test.mjs` method) | 4708 (18832 chars) | ≈ 4823 (+459-byte row ≈ +115 ~tok) | 4708 (zero headroom) | **4860**: authoring ceiling; qa pins the exact measured value |
| `content/skill-qa-engineer.md` | raw bytes (`test/qa-visual-skill-split.test.mjs` AC-5) | 17873 | ≈ 18066 (+193) | 17900 (27 bytes headroom) | **18500** (measured + ~430, inside that test's own "+350–550" convention); needs D1 |
| `content/skill-integrator.md` | — | 30705 bytes | ≈ +2.0 KB | no cap | — |

Goldens: `test/fixtures/compose-golden/*` compose the constitution with `skill-sr-engineer` / `skill-coordinator-lite` / the coordinator SOP only. None of the three edited files is in any golden, so no regeneration is expected. qa confirms with `test/compose-equivalence.test.mjs` + `test/e90-golden-capture-completeness.test.mjs`, and regenerates only on a red, explaining each hunk.

### Test plan (qa-engineer)
- **T0, new `test/e288-integrator-stage0.test.mjs`**: one test per AC-E288-1..6, named `AC-E288-<n>`. Assert on section-bounded slices (`## Stage 0` … `## Stage 1`; `## Permissions` … `## Who you are`; `## Gate Summary` … the Cut-Approval header paragraph) and on the Copy literals above. Assert ordering by index (heading / row positions), not by line numbers. Count with `grepC === 1` where the AC says "exactly one". Add a negative control: confirm, on a mutated in-memory copy, that a missing row or misplaced heading fails each structural assertion. Use no fixed sha and no git.
- **T1, `test/e178a-integrator-role.test.mjs`**: delete `const BASE_SHA`, the "AC6 (historical)" test, and `skipIfHistoryAbsent` (its only caller), plus `execFileSync` if it is then unused. Replace them with "AC6 (terse grant): the integrator-only grant is one paragraph": the line containing `**Integrator-only grant**` occurs exactly once in const-15 and holds the whole clause the substance test pins, so the clause is not split across lines. The `Two namespaces sit beside it` and `**Tool-internal ops**` sentences each occur exactly once. These are stable-structure facts that legitimate const-15 edits elsewhere cannot break. The substance test "AC6: const-15 §6 — integrator-only git grant …" stays unchanged.
- **T2, `test/e296-manifest-tier.test.mjs` AC10**: replace "render output is byte-identical to base (…)" with "AC10: render of the frozen 8-column manifest carries the lane's own fields". `render MANIFEST e296 --summary x --reading y --base <neutral 7-hex literal> --primary ROOT --mailbox-root TMP` exits 0. Its stdout contains the e296 row's branch, the `擁有` and `禁止` cells (taken from `parseManifest(MANIFEST_TEXT)`, not retyped), the `--summary` / `--reading` values, the `--base` value, and the mailbox path under TMP. It does not contain the header literal `approval`. Drop the committed w2 control (`specs/fanout-post-v4-w2.md`, base `25bc84c`): it pinned a real growable manifest against old code, and the frozen w3 copy covers the same render path. Keep "AC10: render ignores the approval column" as is; replacing its `--base c392cc3` argument with the same neutral literal is optional, because it is a string argument, not a git ref. Update the file header (L9–10) so it no longer says AC10 runs git.
- **T3, `test/context-budget.test.mjs`**: re-pin the skill-pm cap to the exact measured value (≤ approved ceiling) and name this lane in the message (`E288 integrator Stage 0 row re-baseline, zero headroom`).
- **T4, `test/qa-visual-skill-split.test.mjs` AC-5** (only under D1): raise `17900` to the approved value, and add a raise-history pointer to this spec in the comment.
- **Re-pin-only files** (skill-frontmatter, cut-approval-gate, e5, skill-manifest, subagent-templates, ac-execution, e164-e167, repro-first-gate, e43, render-structure): touch them only if they go red, and explain each re-pin in the review doc.
- **Full suite**: `node scripts/test-lock.mjs -- npm test` on the final committed HEAD, with no untracked files.

### Findings filed (not fixed here)
- `.current/e288/pending-tickets.md` `E323-NEW-1`: `docs/lane-protocol.md` §3 still permits a guarded, loud-skipped historical-SHA test. The E323 convention line says "never diff against a fixed lane base sha". Align the two (likely with E290's lane-protocol rewrite). The lane does not own `docs/**`.

## Cut
| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E288-01 | sr-engineer: integrator Stage 0 section (skip/run condition, Task-dispatched PM writes only `specs/ticket-cut-<feature>.md`, approved with the manifest at Stage 2), Work overview row 0, Lifecycle row 0, invocation stages 0–3, Stage 1 Input line, Stage 2 one-approval sentence, Permissions row, D3 hand-off note paragraph; skill-pm Gate Summary row `**Integrator Stage 0 cut**` — verbatim Copy literals; skill-pm stays ≤ 4860 ~tok; no edit inside Mid-wave base fix or Stage 6 (AC-E288-1..8) | none | 2 | `content/skill-integrator.md`, `content/skill-pm.md` | — |
| T-E323-01 | sr-engineer: add the `qa.resident-hygiene` line as SOP step 6 sub-item `f.` in skill-qa-engineer, verbatim, nothing else in that file (AC-E323-3) | none | 1 | `content/skill-qa-engineer.md` | — |
| T-E288-02 | qa-engineer: new `test/e288-integrator-stage0.test.mjs` (T0, AC-E288-1..6 + negative control); re-pin skill-pm cap to exact measured value ≤ approved ceiling (T3, AC-E288-7); confirm goldens unchanged, regen + explain only if red; re-pin-only files only if red | T-E288-01 | 2–3 | `test/e288-integrator-stage0.test.mjs`, `test/context-budget.test.mjs`, `test/fixtures/compose-golden/**` | — |
| T-E323-02 | qa-engineer: e178a historical fixed-base test → structural one-paragraph grant assertion (T1, AC-E323-1); e296 AC10 base-vs-HEAD render → frozen-manifest structural assertions, drop the w2 control (T2, AC-E323-2); qa-engineer.md byte cap re-pin under D1 (T4, AC-E323-4); final full suite on committed HEAD (AC-LANE-2) | T-E323-01, T-E288-01 | 3 | `test/e178a-integrator-role.test.mjs`, `test/e296-manifest-tier.test.mjs`, `test/qa-visual-skill-split.test.mjs` | — |

## Open Decisions
Chain: pm → sr-engineer (T-E288-01 + T-E323-01, one session) → code-reviewer → qa-engineer (T-E288-02 + T-E323-02). No architect hop: these are content edits in 3 SOP files plus test rewrites, with no new module, data model or API.

The human approves these together with the Cut above:
- **D1 — needs human ruling (manifest re-assignment).** Adding the E323 convention line to `content/skill-qa-engineer.md` breaks `test/qa-visual-skill-split.test.mjs` AC-5. Its byte cap is 17900, and the file is already at 17873, which leaves 27 bytes. The line needs 193. That test file is in no lane's `擁有` cell, so it falls under e288's 禁止 "其他 `test/**`". Recommendation: re-assign `test/qa-visual-skill-split.test.mjs` to e288 as re-pin-only (cap only), with a manifest Decisions row (no other lane owns it, so lanes stay disjoint). Raise the cap to **18500** (measured ≈ 18066 + ~430, inside that test's own "+350–550 bytes" convention). Alternative: move the convention line to a file with headroom. That would contradict the manifest, which names `content/skill-qa-engineer.md`, so it is not recommended. Until D1 is approved, `fanout.mjs check --cut` reports T-E323-02's third path as OUT.
- **D2 — PM budget cap.** The cap is **4708**, not the 4401 the backlog and revision doc quote. Proposed new ceiling: **4860** ~tok. The row is measured at 459 bytes, about 115 ~tok, so 4860 = 4708 + 152 gives sr ~37 ~tok of wording room and no more. qa then pins the exact measured value (zero headroom, per the cap rule in `test/context-budget.test.mjs`).
- **D3 — Stage 0 output path `specs/ticket-cut-<feature>.md`.** Recommended over `specs/fanout-<feature>-cut.md`, which `fanout.mjs validate` sweeps would read as a malformed manifest (e296 AC9 asserts the set of non-zero exits), and over `specs/cut-<feature>.md` (an unrelated `specs/cut-approval-coordinator-attestation.md` already exists). The integrator commits it with the manifest.
- **D4 — where Stage 0 sits and where the D3 template lives.** Recommended: a standalone `## Stage 0` section before Stage 1, with the four-part hand-off note defined inline there as the single copy. A separate template file was rejected because it would be a new path outside the owned set and a second copy to keep in sync.
- **D5 — ids for Stage 0 tickets.** The cut file uses the backlog id when one exists, else `NEW-<n>`. The integrator allocates full backlog rows for `NEW-<n>` at Stage 1, under the same authority as 5c-1. Ticket admission is still covered by the human's Stage 2 approval.
- **D6 — e296 AC10 replacement drops the w2 control** (Test Plan T2) instead of freezing a second in-test manifest. The frozen w3 copy already covers the render path; e283's own hard condition covers render byte-identity on existing manifests during this wave.
