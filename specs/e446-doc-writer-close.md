# e446-doc-writer-close

Ticket E446 (`docs/backlog.md`). Wave manifest: `specs/fanout-post-v5-w6.md`, lane `e446`, base `07a6d47`. Ruling: human Q3 (a) of the wave (2026-11-26) — doc-writer, which runs after `(code-reviewer, PASS)`, does not call `tw_update_state` at close; it accounts for what it changed through its commit and its final reply. No server edge is added (Q3 rejected option (b)). The fix is settled; this cut opens no option.

## Problem Statement

`content/skill-doc-writer.md` runs after the chain's judge has written PASS, yet its Side-channel constraint (line 15) and SOP step 6 (line 36) tell doc-writer to finish with `tw_update_state(status=In_Progress, agent_id="<upstream-caller>", …)` — on the v5 chain that is `(code-reviewer, PASS) → (code-reviewer, In_Progress)`. The transition table's `code-reviewer:PASS` row opens only pm, researcher, release-engineer and design-auditor, and PASS is not on the self-loop fast path, so a doc-writer that follows its SOP gets a rejected write and its close is never recorded. Step 4 also tells it to flag CHANGELOG gaps in `pending_notes`, which only a state write could carry. The `tools/role.ts` comment on `ROLE_SKILL_MAP` (lines 36–40) still describes the old close ("callers set agent_id to the upstream chain role when invoking tw_update_state on its behalf").

## User Stories

- As a coordinator that dispatches doc-writer after a PASS, I want its SOP to close without a state write, so that it never hits a rejected write and the handoff stays at the judge's PASS for release-engineer or pm.
- As a reader of doc-writer's work, I want its commit and its final reply to name every file it changed, so that the doc update is accounted for without a handoff entry.
- As a maintainer of the server, I want a test that pins both the new SOP close and the server's rejection of `(code-reviewer, PASS) → (code-reviewer, In_Progress)`, so that neither drifts back.

## Acceptance Criteria

No ticket file (no `ticketDir` in `.current/.config.json`), so Given/When/Then with `proof:` lines. qa-engineer names the new test file `test/e446-*.test.mjs` (below `test/e446-doc-writer-close.test.mjs`; if qa picks another name or splits, it updates the `proof:` file names); each test title starts with its AC id. "Copy" names refer to the *Copy / Strings* table. SOP text assertions run on the raw file AND on the served text through both render paths (`switchRole("doc-writer", …).sop` from `dist/tools/role.js` and `buildPromptForRole("skill-doc-writer.md", …)` from `dist/prompts/build.js`).

- **AC1** — Given doc-writer runs after `(code-reviewer, PASS)`, when it reads its SOP, then no line instructs a state write: the raw file and both served texts contain no `tw_update_state(` (call form), no `pending_notes`, no `<upstream-caller>` and no `next_role`; every remaining `tw_update_state` occurrence is inside a prohibition — exactly two, one on the Side-channel constraint line (`never calls \`tw_update_state\``) and one on step 6 (`Do NOT call \`tw_update_state\``).
  proof: `node --test --test-name-pattern "^AC1" test/e446-doc-writer-close.test.mjs` exits 0.
- **AC2** — Given the Hard rules section, when the Side-channel constraint is read, then its line is exactly `C-DW1`: it still contains the anchor `doc-writer is NOT in \`ALLOWED_TRANSITIONS\`` exactly once in the file (so `test/e437-repo-only-paths.test.mjs` site 9 keeps its anchor), cites no `tools/transitions.ts`, and names the commit and the final reply as the record of what changed.
  proof: `node --test --test-name-pattern "^AC2" test/e446-doc-writer-close.test.mjs test/e437-repo-only-paths.test.mjs` exits 0.
- **AC3** — Given SOP step 4, when a CHANGELOG gap is found, then the bullet sends it to the final reply, not to `pending_notes`: the `CHANGELOG.md` bullet line is exactly `C-DW2`.
  proof: `node --test --test-name-pattern "^AC3" test/e446-doc-writer-close.test.mjs` exits 0.
- **AC4** — Given SOP step 6, when doc-writer closes, then it commits the doc updates, gives the Output rule line naming every changed file (`none` with no commit when nothing changed) and does not call `tw_update_state`: line 36 is exactly `C-DW3`; the Output rule line `Final reply: \`Done. Doc updates in <files>.\`` is byte-identical to base (the new close fills `<files>`, it does not change the string).
  proof: `node --test --test-name-pattern "^AC4" test/e446-doc-writer-close.test.mjs` exits 0.
- **AC5** — Given the rest of the SOP, when the file is compared with base text frozen in the test, then only lines 15, 32 and 36 differ: the file has 36 lines; step 1 (line 28, with its `tw_get_state` → `tw_detect_drift` precondition and the phrase `(code-reviewer, PASS)` that `test/e433-test-first-rules.test.mjs` AC7 pins) is byte-identical; the five `##` headings (`Persona`, `Output rule`, `Hard rules`, `Artifact`, `SOP`) are unchanged and in order; the backtick-quoted error-code set of the file stays empty (`test/e453-served-text-v5.test.mjs` AC25).
  proof: `node --test --test-name-pattern "^AC5" test/e446-doc-writer-close.test.mjs` exits 0, and `node --test test/e433-test-first-rules.test.mjs test/e453-served-text-v5.test.mjs test/skill-evolution-v3.11.test.mjs test/e391-prompt-audit-stale-facts.test.mjs` exits 0.
- **AC6** — Given the server's transition rules, when the old close is replayed, then it is still rejected and the claims `C-DW1` makes hold: `validateTransition` (from `dist/tools/transitions.js`) rejects `(code-reviewer, PASS) → (code-reviewer, In_Progress)` with `TRANSITION_REJECTED` and an `allowed` list of exactly pm, researcher, release-engineer and design-auditor (each `In_Progress`); it also rejects `(code-reviewer, PASS) → (code-reviewer, PASS)`, `→ (code-reviewer, FAIL)` and `→ (code-reviewer, Blocked)`; and it rejects `agent_id` `doc-writer` with `AGENT_ID_REQUIRED`. `tools/transitions.ts` is byte-identical to base and does not mention `doc-writer`. (qa may add an end-to-end replay through the `tw_update_state` handler on a throwaway workspace; the pure-function check is the minimum.)
  proof: `node --test --test-name-pattern "^AC6" test/e446-doc-writer-close.test.mjs` exits 0, and `git diff --quiet 07a6d47 -- tools/transitions.ts dist/tools/transitions.js` exits 0.
- **AC7** — Given `tools/role.ts`, when the `ROLE_SKILL_MAP` comment above `"doc-writer"` is read, then it is exactly the six lines of `C-RT1`, contiguous (`test/e408-core-task-alias-tail.test.mjs` AC6 re-pinned to them, its other assertions unchanged); the comment no longer says callers write state on doc-writer's behalf; `dist/tools/role.js` is rebuilt and carries the same six lines; no non-comment line of `tools/role.ts` changes.
  proof: `node --test --test-name-pattern "^AC7" test/e446-doc-writer-close.test.mjs test/e408-core-task-alias-tail.test.mjs` exits 0, and `git diff -U0 07a6d47 -- tools/role.ts | grep -E '^[-+] ' | grep -vE '^[-+]\s*//'` prints nothing.
- **AC8** — Given every line this lane changes in `content/skill-doc-writer.md`, when it is scanned, then it holds no URL (`://`), no repo-only path (no `tools/`, `test/`, `specs/`, `docs/`, `scripts/` path — the line-13 list is unchanged base text), no bare ticket id (`/\bE\d{2,4}\b/`), no version label (`/\bv\d+\.\d+/`), and no backtick-quoted error code; the doc-writer render glue count stays 0 in both render paths (`test/render-structure.test.mjs`).
  proof: `node --test --test-name-pattern "^AC8" test/e446-doc-writer-close.test.mjs test/render-structure.test.mjs test/e437-repo-only-paths.test.mjs` exits 0.
- **AC9** — Given the build is done, when the full suite runs, then it is green and the change stays in the lane's owned set: `GATE_REGISTRY` still has 33 entries and `UPDATE_STATE_GATE_PIPELINE` 17 steps; `templates/**`, `docs/**`, other `content/**`, every `.ts` but `tools/role.ts` and every `dist/**` file but `dist/tools/role.*` are unchanged.
  proof: `node scripts/test-lock.mjs -- npm test` exits 0, and `git diff --name-only 07a6d47 -- templates docs content '*.ts' dist | grep -vxE 'content/skill-doc-writer\.md|tools/role\.ts|dist/tools/role\.(js|js\.map|d\.ts|d\.ts\.map)'` prints nothing.

## Copy / Strings

Every row is `authored-here` from human Q3 (a) and the E446 row of `docs/backlog.md`. `C-DW1`..`C-DW3` ship to every adopter (`content/**`): no repo-only path, no bare ticket id, no URL, no backtick-quoted error code. `C-RT1` is a source comment (not shipped as prompt text). Each exact text is the block of the same id below the table (the four-tilde fence belongs to this spec, not to the text; every block is one line except `C-RT1`).

| string id | exact text (quote verbatim) | source |
|---|---|---|
| C-DW1 | block `C-DW1` — replaces line 15 of `content/skill-doc-writer.md` (the `- **Side-channel constraint**: …` bullet) whole | authored-here — Q3 (a): no state write at close; the record is the commit and the final reply. Keeps the clause label (`tools/role.ts` names it) and the `doc-writer is NOT in \`ALLOWED_TRANSITIONS\`` anchor; states only what `validateTransition` does (AC6 pins each claim) |
| C-DW2 | block `C-DW2` — replaces line 32 (the step-4 `` - `CHANGELOG.md`: `` bullet) whole | authored-here — direct consequence of Q3 (a): `pending_notes` exists only in a state write, so the gap goes to the final reply, above the Output rule line |
| C-DW3 | block `C-DW3` — replaces line 36 (SOP step 6) whole | authored-here — Q3 (a): commit + Output rule line instead of `tw_update_state`; `none` fills `<files>` when nothing changed, so the canonical string `Done. Doc updates in <files>.` stays as it is |
| C-RT1 | block `C-RT1` — replaces the five comment lines 36–40 of `tools/role.ts` (`// Post-chain roles. …` through `… (the chain's judge).`) with six lines, two-space indent as shown | authored-here — Q3 (a); keeps the line-1 opening and the release-engineer sentence (edge name and `(the chain's judge)`) of the E435 wording |

Block `C-DW1`:

~~~~
- **Side-channel constraint**: doc-writer is NOT in `ALLOWED_TRANSITIONS` and never calls `tw_update_state`. It runs after `(code-reviewer, PASS)`, and from that tuple the server accepts no further write under the judge's `agent_id`; `agent_id="doc-writer"` is rejected too, because it never appears in the transition matrix. Record what you changed in your commit and your final reply (Output rule); the state stays at the judge's PASS for the next role.
~~~~

Block `C-DW2`:

~~~~
   - `CHANGELOG.md`: confirm the release entry the release-engineer authored (or will author) covers every AC. Flag gaps in your final reply, above its Output rule line; do NOT silently amend an existing entry the release-engineer signed.
~~~~

Block `C-DW3`:

~~~~
6. Commit the doc updates with a message naming the shipped feature, then reply with the Output rule line naming every file you changed (no change: no commit, and `<files>` is `none`). Do NOT call `tw_update_state`: the state stays at `(code-reviewer, PASS)`.
~~~~

Block `C-RT1`:

~~~~
  // Post-chain roles. doc-writer is intentionally absent from tools/transitions.ts
  // AgentName + ALLOWED_TRANSITIONS: it runs after code-reviewer:PASS, never calls
  // tw_update_state, and records its doc updates in its commit and final reply
  // (skill-doc-writer.md "Side-channel constraint" clause). release-engineer is in
  // AgentName and opens on the code-reviewer:PASS -> release-engineer:In_Progress
  // edge there (the chain's judge).
~~~~

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any server change: no edge in `tools/transitions.ts` (Q3 rejected (b), a `code-reviewer:PASS → code-reviewer:PASS` amendment), no gate, error code, `GATE_REGISTRY` (33) or pipeline (17 steps) change; no `.ts` but the `tools/role.ts` comment.
- `templates/**` (the doc-writer subagent template carries no state-write text); every other role SOP and `content/**` fragment, including the Constitution's §6 git-wall rule that names `pending_notes` for all roles.
- `README.md`, `CHANGELOG.md`, `docs/**`, version bump, `docs/backlog.md` done-mark (integrator / release-engineer bookkeeping, post-PASS).
- The e447-owned readers (`test/e433-test-first-rules.test.mjs`, `test/e453-served-text-v5.test.mjs`, `test/e391-prompt-audit-stale-facts.test.mjs`, `test/e178a-integrator-role.test.mjs`, `test/skill-evolution-v3.11.test.mjs`) and `test/subagent-templates.test.mjs`: this lane must keep them green without editing them.

## Dependencies / Prerequisites

No `design/e446-doc-writer-close.md`: mode no-design, so Visual Structural Assertions are omitted. No ticket file. Not bugfix mode by flag (feature mode; the new tests are still written red-first and listed in `qa_reports/expected-red_e446-doc-writer-close.txt`). Resource audit: the backlog row, the manifest and the read files cite only tracked in-repo documents (`review_reports/review_T-E433-01.md` is the row's provenance, not a requirement); no URL, design file or external ticket — `external_refs` empty. Question Batch: none — Q3 (a) fixes the fix; the step-4 `pending_notes` sentence (`C-DW2`) is changed because the ruling removes the only write that could carry it, not as an option.

**Shipped-text constraints checked at the cut.** `C-DW1`..`C-DW3` hold no repo-only path, URL, bare ticket id, version label or backtick-quoted error code; `ALLOWED_TRANSITIONS`, `tw_update_state`, `agent_id` and `(code-reviewer, PASS)` were already in the file. `content/skill-doc-writer.md` is in no compose golden and has no `test/context-budget.test.mjs` cap (manifest *所有權重劃*), so no shared artifact moves and no planned sr → qa return is needed.

**PM probe (full suite, `node scripts/test-lock.mjs -- npm test`, run in the worktree, 2026-11-26).** `content/skill-doc-writer.md`, `tools/role.ts` and the four `dist/tools/role.*` files were copied to a scratch backup; `C-DW1`, `C-DW2`, `C-DW3` and `C-RT1` were applied exactly as in the blocks above; the suite ran (its `pretest` build rebuilt `dist/`); then all six files were copied back from the backup. Afterwards `git status --short` shows only this spec (`?? specs/e446-doc-writer-close.md`) and no other `dist/` file moved. The rebuild changed `dist/tools/role.js`, `dist/tools/role.js.map` and `dist/tools/role.d.ts.map`; `dist/tools/role.d.ts` stayed byte-identical. Result: 4791 tests, 4788 pass, 1 fail, 2 skipped (exit 1). The base was not re-run; 4791 = 4788 + 1 + 2, and the one red is caused by `C-RT1`. Red test files, one by one:

| test file | red tests | why it turns red | Probe-table reader (manifest second table)? | in the e446 owned set? | fixed by |
|---|---|---|---|---|---|
| `test/e408-core-task-alias-tail.test.mjs` | 1 (`AC6 (E435): role.ts comment reflects transitions.ts …`) | pins the five base comment lines of `tools/role.ts` contiguously; `C-RT1` rewrites them as six lines | yes | yes | T-E446-01 re-pin to the six `C-RT1` lines (red until T-E446-03) |

No other red, and no red outside the e446 owned column. The other two e446-owned Probe-table readers stay green with the final Copy: `test/e437-repo-only-paths.test.mjs` (site 9 anchor `doc-writer is NOT in \`ALLOWED_TRANSITIONS\`` kept on line 15, no `tools/transitions.ts`; the real-bundle check of the doc-writer prompt passes) and `test/render-structure.test.mjs` (doc-writer glue count 0 in both render paths). Every e447-owned reader stays green without edits: `e433-test-first-rules` AC7 (`(code-reviewer, PASS)` kept on line 28, now also on lines 15 and 36; no `(qa-engineer, PASS)`, no `qa PASS`), `e453-served-text-v5` AC25 (the file's backtick error-code set stays empty), `e391-prompt-audit-stale-facts` (line 13 untouched), `e178a-integrator-role` (no `integrator` in `tools/role.ts`), `skill-evolution-v3.11` (headings, `doc-writer` absent from `tools/transitions.ts`); also `subagent-templates`, `e392-subagent-templates`, `e423-spec-workshop`, `skill-frontmatter`, `skill-manifest`, `context-budget`.

**Hop estimate.** pm (this write) → qa-engineer T-E446-01 → sr-engineer T-E446-02 + T-E446-03 in one hop → code-reviewer PASS: 4 writes; the coordinator's `cut_approved` attestation, if separate, makes 5. One review round of rework adds 2–3 (code-reviewer → sr-engineer → code-reviewer, or via qa-engineer): 7–8. Well inside the hop cap 14; no planned return.

## Gate Summary and Task Budget Map

Gate Summary: `scope_decision` single-feature — one ticket, one lane, one cut by the wave's ruling (manifest Decisions 2026-11-26); no design source (`design-link` `—` throughout); `external_refs` empty; feature mode (no `dispatch_mode`); `next_role` qa-engineer, no architect (one SOP file and one comment, no gate, pipeline, schema or behavioural `.ts` change). No `chain_path` field is set. `cut_approved` is not set by pm (Task-dispatched; manifest tier per Constitution §3.1 is attested by the coordinator).

**Task Budget Map** (every sr task within the `task_size` budget of 5 files / 300 lines). Order: qa T-E446-01 → sr T-E446-02 → sr T-E446-03 → code-reviewer judges all three ids. Every AC has an implementing task: AC1, AC2, AC3, AC4, AC5, AC8 → T-E446-02 (SOP text); AC7 → T-E446-03 (comment + rebuild); AC6 → T-E446-03 (confirm `tools/transitions.ts` and its `dist` output untouched — the server behaviour is already right, the task is to leave it so); AC9 → T-E446-03 (full suite, owned-set diff). T-E446-01 writes the tests for AC1–AC8 and the re-pins.

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| T-E446-01 | qa-engineer: write AC1–AC8 as tests in `test/e446-doc-writer-close.test.mjs` (Copy constants, base text of `content/skill-doc-writer.md` frozen for AC5; AC1–AC4, AC7 and AC8 red at base, AC5's unchanged-line checks and AC6 green at base), list the reds in `qa_reports/expected-red_e446-doc-writer-close.txt`; re-pin `test/e408-core-task-alias-tail.test.mjs` AC6 to the six `C-RT1` lines (red until T-E446-03); test report with the Scenario → Test Map | none | 2 | `test/e446-doc-writer-close.test.mjs`, `test/e408-core-task-alias-tail.test.mjs` | — |
| T-E446-02 | sr-engineer: SOP text — `C-DW1` (line 15), `C-DW2` (line 32), `C-DW3` (line 36) in `content/skill-doc-writer.md`, byte-exact, file stays 36 lines (AC1, AC2, AC3, AC4, AC5, AC8) | T-E446-01 | 1 | `content/skill-doc-writer.md` | — |
| T-E446-03 | sr-engineer: `C-RT1` in `tools/role.ts` (comment only), `npm run build`, commit the rebuilt `dist/tools/role.*`; confirm `tools/transitions.ts` untouched, full suite green, every expected-red entry green, diff vs `07a6d47` inside the owned set; hand to code-reviewer (AC6, AC7, AC9) | T-E446-02 | 4 | `tools/role.ts`, `dist/tools/role.js`, `dist/tools/role.js.map`, `dist/tools/role.d.ts.map` | — |
