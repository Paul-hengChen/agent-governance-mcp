# e445-spec-workshop-questioning

Ticket E445 (v5.0.0 milestone, wave 6, single lane `e445`). Spec basis: the E445 row of `docs/backlog.md` (line 568) and the lane row plus the "交給 lane 的 PM" section of `specs/fanout-v5-w6.md`. Design and rulings: `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` section 17 (17.1 rulings 1–4) and section 11.4 rulings 1 and 3. Base: `b3ac374`.

## Problem Statement

`content/skill-spec-workshop.md` step 4 caps a question batch at 4 but says nothing about how questions in one batch relate, so a batch can hold a question whose premise is another open question in the same batch, and the human answers it before its premise is decided. The SOP sets no question format (the human answers by quoting questions back), never forbids asking the human a fact the code could answer, never says the agent's own recommendation is not a ruling, has no rule for reopening an earlier ruling, and has no rule for a question that talking cannot settle (how something looks or feels), which then gets rephrased round after round. It also has no check for a human who accepts every recommendation unread. This ticket folds eight questioning rules into the existing six steps — SOP text only, step headings and step count unchanged — and changes nothing about when the run is done (section 11.4 rulings 1 and 3 stand).

## User Stories

- As an operator running `spec-workshop`, I want every batch to hold only questions I can answer now, so that I never rule on a question whose premise is still open.
- As an operator, I want numbered questions worded so "yes" accepts the recommendation, so that I can answer a batch in one short reply.
- As an operator, I want facts looked up instead of asked, and recommendations kept apart from rulings, so that the record holds only decisions I actually made.
- As an operator, I want look-and-feel questions marked and deferred instead of re-asked, so that a run does not loop on something only a prototype can settle.
- As an operator who accepted every recommendation, I want one reminder before approval, so that I confirm the rulings are mine without being forced to change any.

## Acceptance Criteria

Scope words. "SOP" = `content/skill-spec-workshop.md`. "Composed prompt" = the `spec-workshop` prompt text built by `buildPromptForRole("skill-spec-workshop.md", …)`. "Exactly as before" means the six step-heading texts and the `## Short form` section text — NOT the whole composed prompt, which necessarily changes. Every "unchanged except" AC names the SOP section it covers. "Base text" = the SOP at `b3ac374`, frozen as string literals inside the test file (see *Test placement and base reads*).

- **AC1** — Given the composed prompt and the SOP, when the step headings and the short form are compared with the base text, then the six step-heading texts (`1. **Entry check**`, `2. **Check what exists first**`, `3. **Delegate bulk reading**`, `4. **Ask in batches, record as you go**`, `5. **Done condition**`, `6. **End without filing**`) are present in the composed prompt, the `## Short form` section text (heading through the line before `## Outputs`) is byte-identical to the base text, and the SOP span from `## Steps` to `## Short form` holds exactly six lines matching `^\d\. \*\*`.
  proof: `node --test --test-name-pattern="^AC1" test/e445-spec-workshop-questioning.test.mjs` passes, and `node --test --test-name-pattern="^AC6" test/e423-spec-workshop.test.mjs` passes.
- **AC2** — Given SOP step 4, when it is read, then it keeps `at most 4 questions per batch`, and states that a question goes in a batch only when every decision it depends on already has a ruling and that no question in a batch depends on another in the same batch (strings `sw.batch_cap`, `sw.batch_ready`).
  proof: `node --test --test-name-pattern="^AC2" test/e445-spec-workshop-questioning.test.mjs` passes.
- **AC3** — Given SOP step 4, when it is read, then it gives the question format `Q<n> — <title>: <question>` with the recommendation on its own line and the worked example on its own line, keeps the worked-example definition `(a named case, step by step, what breaks under each option)`, and lets the human answer by number (strings `sw.format`, `sw.by_number`).
  proof: `node --test --test-name-pattern="^AC3" test/e445-spec-workshop-questioning.test.mjs` passes.
- **AC4** — Given SOP step 4, when it is read, then each question is worded so "yes" accepts the recommendation, and when a question cannot be worded so, the question says so (string `sw.yes`).
  proof: `node --test --test-name-pattern="^AC4" test/e445-spec-workshop-questioning.test.mjs` passes.
- **AC5** — Given SOP step 4, when it is read, then the base sentence `Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.` is present verbatim, and a SEPARATE following sentence says that when an answer shows an earlier ruling should change, that question is reopened in the next batch and its new ruling names the one it replaces (string `sw.reopen`).
  proof: `node --test --test-name-pattern="^AC5" test/e445-spec-workshop-questioning.test.mjs` passes, and `node --test --test-name-pattern="^AC9" test/e423-spec-workshop.test.mjs` passes.
- **AC6** — Given SOP step 4, when it is read, then a question about how something looks or feels is marked `needs prototype` in the record and its ruling deferred until the human has seen one, this role does not build the prototype, and a `needs prototype` question still open when the run ends makes the run end `not ready to cut` (strings `sw.prototype`, `sw.prototype_end`).
  proof: `node --test --test-name-pattern="^AC6" test/e445-spec-workshop-questioning.test.mjs` passes.
- **AC7** — Given SOP step 2, when it is read, then its base text (`before the first question, read the current code and docs and tell the human what already exists that bears on the request. With no source document, the code and docs are the source.`) is still present verbatim (the survey before the first batch stays), followed by the rule that the survey stays short, deeper fact lookups go to a subagent that runs alongside the questions, and only the questions that depend on a lookup wait for it (string `sw.lookup`).
  proof: `node --test --test-name-pattern="^AC7" test/e445-spec-workshop-questioning.test.mjs` passes.
- **AC8** — Given SOP step 3, when it is read, then its base text (`send design extraction and codebase surveys to subagents; keep their summaries, not the raw dumps.`) is still present verbatim, followed by the rules that a fact the code, docs or tools can answer is never asked of the human and that a recommendation is not a ruling until the human answers it (string `sw.facts`).
  proof: `node --test --test-name-pattern="^AC8" test/e445-spec-workshop-questioning.test.mjs` passes.
- **AC9** — Given SOP step 5, when it is read, then its three base sentences (the done-condition sentence `the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, and every conflict between sources has a ruling.`, the verification sentence and the Figma-divergence sentence) are present verbatim and in base order, followed by the one-time reminder: before asking for approval, if the human accepted every recommendation unchanged, say so once and ask them to confirm the rulings are theirs; a confirmation continues and a changed answer is never required (string `sw.pushback`). The reminder adds nothing to the done condition.
  proof: `node --test --test-name-pattern="^AC9" test/e445-spec-workshop-questioning.test.mjs` passes, and `node --test --test-name-pattern="^AC10" test/e423-spec-workshop.test.mjs` passes.
- **AC10** — Given the SOP, when it is compared with the base text, then everything outside steps 2, 3, 4 and 5 is unchanged: the frontmatter, `## Purpose`, step 1 (heading, three bullets, following paragraph), step 6, `## Short form`, `## Outputs` and `## Governance state` sections are byte-identical to the base text; and every line added or changed relative to the base text (the dispatch view, `stripRationale(stripOriginTags(...))`) contains no line-start `\d. **`, none of `tw_update_state`, `tw_add_task`, `tw_complete_task`, `tw_rollback_task`, `tw_void_task`, `tw_sync`, no ticket id (`\bE\d{3}\b`) and no repo-only path (the `REPO_ONLY` patterns of `test/e423-spec-workshop.test.mjs` AC11), no `Task` used as the subagent alias (the `test/e410-task-alias-content-tail.test.mjs` rule), and no backtick-quoted error code from `GATE_REGISTRY`.
  proof: `node --test --test-name-pattern="^AC10" test/e445-spec-workshop-questioning.test.mjs` passes, and `node --test --test-name-pattern="^AC11" test/e423-spec-workshop.test.mjs` passes.
- **AC11** — Given sr-engineer's final SOP, when qa-engineer measures the stripped token count the `test/context-budget.test.mjs` AC21 block computes, then the AC21 cap equals the measured value (zero headroom) with one re-baseline comment line naming the delta, and no other cap in `test/context-budget.test.mjs` moves.
  proof: `node --test --test-name-pattern="AC21" test/context-budget.test.mjs` passes, and `git diff b3ac374 -- test/context-budget.test.mjs` touches only lines inside the AC21 test block.
- **AC12** — Given the finished branch, when the hygiene checks run, then the full suite (`node scripts/test-lock.mjs -- npm test`) is green, the 12 compose goldens under `test/fixtures/compose-golden/` are byte-identical to base, `npm run build` leaves `git status --porcelain dist/` empty, `CLAUDE.md` is 250 lines, `node bin/agc-init.mjs check` exits 0, and `npm audit --audit-level=high` exits 0.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0; `git diff --stat b3ac374 -- test/fixtures/compose-golden/ dist/ CLAUDE.md` prints nothing.

## Copy / Strings

The SOP is agent-facing text shipped to every adopter; its new sentences are listed here so qa can pin them and the human can review the wording at the cut. sr-engineer writes them verbatim (straight double quotes around `yes`, em dash `—` in the format). Placement column = where in the SOP the string goes.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| sw.lookup | `Keep this survey short; send any deeper fact lookup to a subagent that runs while you ask, and hold back only the questions that depend on its answer.` — appended to step 2 after the base text | E445 point (3); discussion section 17 point 3 |
| sw.facts | `Never ask the human a fact the code, docs or tools can answer; look it up. Your recommendation is not a ruling until the human answers it.` — appended to step 3 after the base text | E445 point (5); discussion section 17 point 5 |
| sw.batch_cap | `at most 4 questions per batch.` — step 4 opening after the heading dash (base text `at most 4 questions per batch` kept; the clause now ends the sentence) | E445 out-of-scope (cap stays); 11.4 / 17.1 "不變" |
| sw.batch_ready | `A question goes in a batch only when every decision it depends on already has a ruling, and no question in a batch depends on another in the same batch.` — step 4, after `sw.batch_cap` | E445 point (1); discussion section 17 point 1 |
| sw.format | ``Write each question as `Q<n> — <title>: <question>`, then your recommendation on its own line, then a worked example on its own line (a named case, step by step, what breaks under each option).`` — step 4, after `sw.batch_ready` (replaces the base clause `each with your recommendation and a worked example (…)`; the parenthesis is kept verbatim) | E445 point (4); discussion section 17 point 4 |
| sw.yes | `Word each question so that "yes" accepts your recommendation; when it cannot be worded so, say so in the question.` — step 4, after `sw.format` | E445 point (2); discussion section 17 point 2 |
| sw.by_number | `The human may answer by number.` — step 4, after `sw.yes` | E445 point (4) |
| sw.reopen | `When an answer shows an earlier ruling should change, reopen that question in the next batch; its new ruling names the one it replaces.` — step 4, directly after the preserved base sentence `Write each ruling to the record …` | E445 point (8); discussion section 17 point 8 |
| sw.prototype | ``A question about how something looks or feels is marked `needs prototype` in the record, and its ruling waits until the human has seen one; this role does not build the prototype.`` — step 4, after `sw.reopen` | E445 point (6); 17.1 ruling 2 |
| sw.prototype_end | ``A `needs prototype` question still open when the run ends makes the run end `not ready to cut`.`` — step 4, last sentence | E445 point (6); 17.1 ruling 2 |
| sw.pushback | `Before asking for approval, if the human accepted every recommendation unchanged, say so once and ask them to confirm the rulings are theirs; a confirmation continues, and a changed answer is never required.` — appended to step 5 after the base text | E445 point (7); 17.1 ruling 3 |

Step 4 keeps, verbatim and in this order relative to the new sentences: `Address every question to the operator in this session; a tracker item's author is not here.` then `Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.` Resulting step 4 order: heading — `sw.batch_cap` `sw.batch_ready` `sw.format` `sw.yes` `sw.by_number` + operator sentence + preserved ruling sentence + `sw.reopen` `sw.prototype` `sw.prototype_end`. Every step stays one list-item paragraph (no new line starting with a digit, dot, space, `**`).

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- The done condition (section 11.4 rulings 1 and 3 stand — these rules change how questions are asked, not when the run is done); the step-5 done-condition sentence is kept verbatim.
- The 4-question cap (kept as is).
- The `## Purpose`, `## Outputs`, `## Short form` and `## Governance state` sections; step 1 and step 6.
- Any tool, prompt, registry, gate, schema or template code; `dist/` changes.
- Installing or depending on the external interview skill (17.1 ruling 1).
- Issue-tracker mirroring (E428, edits the same file later) and E435's removal of old paths.
- Every other `content/**` file, the compose goldens, every other `test/context-budget.test.mjs` cap.
- `test/eval/` is not run (SOP wording only, no routing change).
- Release bookkeeping (backlog done-mark, queue row `247a`, `check:bookkeeping`) — the integrator's 5c, not a lane task.

## Dependencies / Prerequisites

- E423 ✓ (the SOP exists). Ordered after E434, before E435 (17.1 ruling 4); merges to `main`, not released until E435 cuts v5.0.0 (16.1 ruling 18).
- No `design/<feature>.md`; mode = no-design (Visual Structural Assertions omitted, scope gate not armed). `scope_decision: "single-feature"` recorded anyway: one SOP file plus tests.
- External references (Resource Audit): the backlog row and section 17 cite a public MIT-licensed interview skill. Not fetched: 17.1 ruling 1 limits the work to the eight points already distilled in section 17 and forbids installing the skill, so its text is not load-bearing for this cut. Recorded as `external_refs` entry `public interview skill (discussion section 17) — user-confirmed-ignorable`. No other hits (no URL, Figma, mockup, tracker reference in the spec sources; "Figma file" / "prototype" in the SOP are SOP subject matter, not design sources).
- Question Batch: zero open questions. Every scope point, the chain, the AC21 snapshot rule and the dispatch pins were ruled by the human in the integrator session 2026-11-23 (manifest Decisions); nothing here offers an option.

## Decisions (carried from the manifest; human-ruled, not re-asked)

- **Chain (replaces the ticket's intake mini-chain order sr → code-reviewer → qa)**: test-first. The pm write sets `chain_path: "test-first"`. qa-engineer writes each scenario's test first plus `qa_reports/expected-red_e445-spec-workshop-questioning.txt` (every expected-red test with its reason); sr-engineer edits the SOP to the tests and never edits a qa-written test; code-reviewer judges, writes PASS and calls `tw_complete_task`. No architect (pure SOP text). No `reviewer-visual`.
- **AC21 snapshot (only measurable after the implementation)**: wave-5 human ruling R3 (b), ruled again for this lane 2026-11-23. After sr-engineer finishes the last implementation task, a planned single return to qa-engineer (uses 1 `sr_return`, cap 2); qa measures and sets the AC21 cap to the measured value (zero headroom); then via sr-engineer (confirms nothing to build) to code-reviewer. Hop estimate: pm→qa, qa→sr, sr→qa, qa→sr, sr→code-reviewer = 5 transitions, within the hop cap.
- **Dispatch pins**: `pm=opus`, `sr-engineer=opus`, `code-reviewer=opus`, `qa-engineer=opus`.
- **`test/e423-spec-workshop.test.mjs`**: pre-allocated to this lane (AC6, AC9, AC10, AC11 only) but NOT changed by this cut — those four blocks pin text this ticket keeps, and the Copy / Strings above are written so they stay green. If qa or sr finds one would have to change, stop and mail the integrator; do not edit it.
- **Cut pre-review mail**: `type: proposal`, `re: cut e445` (the `re:` must contain `cut` for `lane-status --mailbox-root`).

## Test placement and base reads

- New file `test/e445-spec-workshop-questioning.test.mjs` (the only new test file name the manifest's 擁有 column allows; any other name needs the integrator first). One test per AC1–AC10, titles starting with the AC id (`AC1: …`), so the `proof:` name patterns select them. AC11 lives in the existing `test/context-budget.test.mjs` AC21 block; AC12 is the hygiene run.
- Base comparisons (AC1, AC5, AC7–AC10) use the base text **frozen as string literals in the test file** (copied from `content/skill-spec-workshop.md` at `b3ac374`). Do NOT read the base tree from git: `git show` is refused by the T-E77-02 meta-test. Avoid `git archive` too; if a test ever does read a fixed sha with `git archive`, note that an absent sha (shallow or squashed history, as in some CI checkouts) makes it skip — it must skip loudly (`t.skip` with a reason naming the sha), never pass silently. Any base content a test captures from disk is read into memory at capture time; a temp directory re-read later hits ENOENT on Node 20 (wave-3 e432 AC12). CI runs Node 20 and 22.
- The composed prompt is built once per file, the way `test/e423-spec-workshop.test.mjs` builds `SW_BUNDLE` (temp workspace, `FileHandoffStorage`), imported from `dist/`.
- Added-line scan (AC10): diff the dispatch view of the current SOP against the dispatch view of the frozen base text line by line; scan only lines not present in the base.

## Probe — full suite on the unchanged base `b3ac374`

Command: `node scripts/test-lock.mjs -- npm test` (prebuild + full `node --test`), run once by pm on 2026-11-23, Node 22, unchanged tree.

Result: **exit 0 — 4525 tests, 4523 pass, 0 fail, 2 skipped, 0 cancelled.** Red files: **none** (so none known, none new). The prebuild left `dist/` unchanged (`git status --porcelain` showed only this spec and `.current/e445/`).

| red file | known (manifest table) / new |
|---|---|
| — (no red file on base) | — |

The two skips are pre-existing loud history skips, not reds: `ok 839` and `ok 849` (e130 AC4 / AC14, `# SKIP HISTORY-DEPENDENT AC SKIPPED: commit 121ddc8 is not resolvable in this repo's history`) — the same "absent sha skips loudly" pattern this cut requires of any `git archive` read.

Expected reds after sr-engineer's edit (manifest table, all owned by this lane): `test/context-budget.test.mjs` AC21 only — base 1092 ~tok; a pm dry-run of the Copy / Strings text applied to a scratch copy of the SOP (not the tree) measured **1415 ~tok (+323)**, so the cap moves to about 1415 at T-E445-03 (the real value is whatever qa measures on sr's file). The same dry-run kept six `^\d\. \*\*` lines under `## Steps`, one line per write-tool name (the prohibition line), no `Task` token, and every Copy / Strings entry present verbatim — so `test/e423-spec-workshop.test.mjs` AC6–AC11 should stay green. No golden and no not-owned test is expected to move (no compose golden holds this SOP; the `content/*.md`-wide scans in the manifest table see no new path, ticket id, error code, `Task` alias or retired phrase).

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E445 | `spec-workshop` questioning rules folded into steps 2–5 (batch only askable, mutually independent questions; 4-question cap kept; `Q<n> — <title>: <question>` format with recommendation and example on own lines; "yes" accepts the recommendation, exception stated; answer by number; reopen an earlier ruling in the next batch; `needs prototype` mark, deferral, no prototype built, open at end → `not ready to cut`; lookups as parallel subagents; facts never asked, recommendation is not a ruling; one-time accept-all reminder before approval); step headings / count, done condition, Short form, Outputs, Governance state unchanged; scenario tests; AC21 cap re-measured (R3 (b)) | E423 | 1 SOP + 1 new test + 1 test block | `content/skill-spec-workshop.md`、`test/e445-spec-workshop-questioning.test.mjs`、`test/context-budget.test.mjs`、`specs/e445-spec-workshop-questioning.md` | — |

## Tasks

Cut notes: `test/e423-spec-workshop.test.mjs` is owned but not touched (Decisions). `test/context-budget.test.mjs` is touched in the AC21 block only (manifest 所有權重劃). No golden, no `dist/`, no other `content/**`.

Order (test-first chain): qa T-E445-01 → sr T-E445-02 (last implementation task) → planned R3 return to qa → qa T-E445-03 → sr T-E445-04 (no code change) → code-reviewer judges every task and writes PASS. sr never edits a qa-written test; sr appends any red it leaves to the expected-red manifest (`<test file> | <exact test name> | reason`).

- [ ] T-E445-01 [P0] qa-engineer: new `test/e445-spec-workshop-questioning.test.mjs`, one test per AC1–AC10 (titles start with the AC id; base text frozen in-test; Copy / Strings pinned verbatim); `qa_reports/expected-red_e445-spec-workshop-questioning.txt` (expected reds: AC2–AC9 and the added-line part of AC10, each with its reason); `qa_reports/tests_e445-spec-workshop-questioning.md` (scenario → test map). Base must stay green apart from the listed reds | AC1–AC10 | depends_on: none
- [ ] T-E445-02 [P0] sr-engineer, last implementation task: edit `content/skill-spec-workshop.md` steps 2, 3, 4, 5 per Copy / Strings (exact text and order; nothing else in the file); `npm run build` (expect no `dist/` diff); full suite; append the expected AC21 red (`test/context-budget.test.mjs | AC21 (spec-workshop): …`) to the manifest; then the planned R3 return to qa-engineer | AC1–AC10 | depends_on: T-E445-01
- [ ] T-E445-03 [P0] qa-engineer, R3 return: measure the AC21 stripped token count on sr's SOP and set the cap to it (zero headroom) with one re-baseline comment line (`// E445 re-baseline: …, +<delta> ~tok (measured <n>); was 1092, zero headroom.`), AC21 block only; record the delta in the test report; hygiene run (AC12 checks) | AC11, AC12 | depends_on: T-E445-02
- [ ] T-E445-04 [P1] sr-engineer: post-return confirmation — full suite on a clean tree, `npm run build` leaves `dist/` unchanged, goldens byte-identical; no code change; hand to code-reviewer | AC1, AC11, AC12 | depends_on: T-E445-03

### Task Budget Map

| id | role | P | summary | files (count) | est. lines | depends_on |
|---|---|---|---|---|---|---|
| T-E445-01 | qa-engineer | P0 | scenario tests AC1–AC10 + manifest + test report | `test/e445-spec-workshop-questioning.test.mjs` (1 + 2 reports) | ~250 | none |
| T-E445-02 | sr-engineer | P0 | SOP steps 2–5 per Copy / Strings | `content/skill-spec-workshop.md` (1) | ~4 lines changed | T-E445-01 |
| T-E445-03 | qa-engineer | P0 | AC21 re-baseline + hygiene | `test/context-budget.test.mjs` AC21 block (1) | ~3 | T-E445-02 |
| T-E445-04 | sr-engineer | P1 | confirm green / no build diff | — (0) | 0 | T-E445-03 |

Every AC has an implementation task: AC1–AC10 → T-E445-02 (AC1 and AC10 are kept-green constraints the edit must hold); AC11 → T-E445-03 (the cap edit is the implementation, per R3 (b)); AC12 → T-E445-03 / T-E445-04. Each task fits one session (`task_size`).
