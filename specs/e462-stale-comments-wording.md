# e462-stale-comments-wording

Ticket: E462 (1)–(7) plus E461 (3) (pre-v5.0.0, wave 2 lane e462 of `specs/fanout-pre-v5-w2.md`). Chain: v5 (pm → qa-engineer → sr-engineer → code-reviewer), no architect. Non-design. No persisted schema change (handoff, tasks, SQLite, config and `evidence_schema` all unchanged).

## Problem Statement

The v5.0.0 waves left source comments that still describe the old chain (qa-engineer judging, `pm → {architect,sr-engineer}` build entry, "test-first" features, "either chain path"), two redundant `parsed.resume_of === "code-reviewer" ? …` ternaries in the update-state handler, a completion-evidence message that hard-codes `qa_reports/` instead of asking `resolveJudgeReport()`, a server-written judge report whose first line still reads `# QA review — <id>`, an unknown design mode reported as a truncated lowercase token (`mode: N/A` → `mode=n`) with no hint, a duplicated supersede rule and an incomplete done condition in the spec-workshop SOP, and a migration guide that does not say the review-evidence check is file-mode only or that old mid-line verdict headings stop counting. Separately, two behaviours of the design-mode parser (`prototype` is a known mode; the first unknown token wins) have no test that fails when they break (E461 (3)).

## User Stories

- As a maintainer reading the gate code, I want every comment to describe the one v5 chain, so that I do not reason from a retired path.
- As an adopter reading a rejection, I want the completion-evidence message to name the judge-report directory the server actually reads, so that the path stays right if that directory moves.
- As a code-reviewer, I want the report the server writes for me to carry a heading that is not QA's, so that the evidence file reads as the judge's.
- As an adopter whose design file says `mode: N/A`, I want the rejection to show what I wrote and tell me to write `no-design` when there is no design source, so that I can fix the file in one step.
- As a spec-workshop operator, I want the supersede rule stated once and the done condition to exclude an open `needs prototype` question, so that the SOP does not contradict itself.
- As an adopter upgrading to v5, I want the migration guide to tell me which review check is file-mode only and which old reports stop counting, so that drift after the upgrade is not a surprise.

## Acceptance Criteria

Test file (qa-engineer creates it): `test/e462-stale-comments-wording.test.mjs`. Every test title starts with its AC id followed by a space (`AC1 …`), so the `proof:` name patterns select exactly that AC's tests. Strings are the Copy / Strings rows, verbatim.

- **AC1** — stale comments, comment-only (E462 (1) and (6)).
  - Given the base `83ca8c0` and HEAD, when each of `tools/transitions.ts`, `tools/registry.ts`, `tools/handoff-types.ts`, `schema/migrations-handoff.ts`, `gates/expected-red.ts` and `gates/registry.ts` is transpiled with TypeScript `transpileModule` (`removeComments: true`, target/module ESNext) at both commits, then the two outputs are byte-identical for every file (comment-only change; judge-run, not a resident test).
  - Given HEAD, then none of these phrases occurs in the named file: `{architect,sr-engineer}` (`tools/transitions.ts`, `tools/registry.ts`); `either chain path` (`tools/transitions.ts`); `test-first` (`gates/expected-red.ts`, `gates/registry.ts`, `schema/migrations-handoff.ts`); `Phase 0.5` (`gates/expected-red.ts`); `QA must log`, `a qa PASS must`, `agent_id="qa-engineer" with pre-filled` (`gates/registry.ts`); `sr-engineer declared`, `QA's suite-vs-manifest` (`tools/handoff-orchestrator.ts`); `QA's expected-red check` (`tools/handoff-types.ts`). And `tools/transitions.ts` and `tools/registry.ts` each name the build-entry edge as `{architect,qa-engineer}`.
  - Kept (must not change): the `tools/transitions.ts` HOP_CAP comment still starts `// v9 (d2-server-brake-accounting) — const-01 Limits` and still contains `independent brake` and `before or after any round cap` (comment lines joined with single spaces); the `tools/transitions.ts` line-158 migration hint string and the line-393 comment are byte-identical to base; the `gates/registry.ts` errorCode → doc-file mapping comment (from line 75) is byte-identical to base; no changed or added line in any file contains `chain_path` (the existing `schema/migrations-handoff.ts` lines keep theirs).
  proof: `node --test --test-name-pattern "^AC1 " test/e462-stale-comments-wording.test.mjs` exits 0, and the judge-run `transpileModule` invariance script over the six files above against `83ca8c0` prints no DIFF (script in the judge's scratch directory, base text via `git show`, never committed).
- **AC2** — `resume_of` ternaries (E462 (2)).
  - Given HEAD, then `tools/handoff-orchestrator.ts` contains no occurrence of `parsed.resume_of === "code-reviewer" ? "code-reviewer" : undefined`, and the two consumers (the `validateTransition` input and the handoff write option) read `parsed.resume_of` directly.
  - Given a direct `handleUpdateState` call (no zod) on `pm:In_Progress` with `agent_id: "code-reviewer", status: "In_Progress"` and `resume_of` set to a value other than `"code-reviewer"` (e.g. `"qa-engineer"`, `"sr-engineer"`, `""`), then the write is rejected exactly as when `resume_of` is absent: the hint ends `received resume_of: absent.`.
  - Given a direct call on any edge that is legal without `resume_of` (qa-engineer picks one that needs no attestation, e.g. a same-role `In_Progress` self-loop the transition table allows) carrying `resume_of: "qa-engineer"`, then the write lands and the handoff on disk has no `resume_of` key.
  - Given a direct call with `resume_of: "code-reviewer"` on `pm:In_Progress → code-reviewer:In_Progress`, then it is accepted and the handoff carries `resume_of: code-reviewer` (unchanged behaviour).
  proof: `node --test --test-name-pattern "^AC2 " test/e462-stale-comments-wording.test.mjs` exits 0.
- **AC3** — judge-report directory and report heading (E462 (3)).
  - Given a file-mode code-reviewer write that adds an id with no evidence, when `QA_COMPLETION_EVIDENCE_MISSING` fires, then the message contains `e462.evidence-covers` with `<judge report dir>` = `resolveJudgeReport(<workspace>).dir` (absolute), and no longer contains `qa_reports/ report covering`.
  - Given a code-reviewer PASS or FAIL write with `qa_review` for an id with no report yet, then the new `qa_reports/review_<id>.md` starts with `e462.report-heading` followed by the unchanged `\n\n<!-- Auto-appended by tw_update_state(qa_review=...). -->\n\n` and the server verdict section; no new file starts with `# QA review — `.
  - Given an existing report that starts with the old heading `# QA review — <id>` and ends with a server-recorded PASS section, then the PASS gate, `tw_detect_drift` evidence credit and lane-status all still credit the id, and a later append adds no second `#` heading (old-heading reports stay readable).
  - Given HEAD, then `EVIDENCE_SCHEMA_CURRENT` is still `3` (the H1 is not an evidence heading; no `evidence_schema` bump).
  proof: `node --test --test-name-pattern "^AC3 " test/e462-stale-comments-wording.test.mjs` exits 0.
- **AC4** — unknown design mode reported as written, with the `no-design` hint (E462 (4)).
  - Given a design file declaring `mode: N/A`, when `hasDesignModeRequiringVisual` / `checkSourceCredibility` read it, then `mode` is `N/A` (case kept, not cut at `/`) and `required` is `true`. Likewise `mode: n/a` → `n/a`, `mode: none` → `none`, `mode: TBD` → `TBD`, ``mode: `N/A` `` → `N/A`, `mode: tbd.` → `tbd` (trailing `.,;:` dropped); every one arms (`required: true`); only `no-design` (and `no-design-*`) disarms.
  - Given `mode: mockup <script>alert(1)</script>`, then `mode` is `mockup` (the value is the first word only: whitespace and `` ` * _ " ' ( ) [ ] < > `` end it); a 100 000-character word is cut to 40 characters plus `…`; known modes are still returned lowercased (`mode: Figma` → `figma`, `mode: figma-export` → `figma`).
  - Given a judge PASS on a feature whose design declares `mode: N/A` with no `## Visual Baselines`, then the `VISUAL_BASELINES_REQUIRED` message contains `(mode=N/A, at ` and `e462.unknown-mode-note` with `<mode>` = `N/A`, placed after `but ## Visual Baselines is absent. ` and before the static hint; the same note follows `Assertions is absent. ` in `VISUAL_ASSERTIONS_REQUIRED`. For a known mode (e.g. `mode: figma`) neither message contains `is not a known design mode`.
  - Error codes, gate count (33) and arming conditions are unchanged.
  proof: `node --test --test-name-pattern "^AC4 " test/e462-stale-comments-wording.test.mjs` exits 0.
- **AC5** — design-mode mutation guards (E461 (3)), written against the AC4 format.
  - Given `mode: prototype-v2`, then `mode` is `prototype` (fails if `prototype` leaves `KNOWN_MODES`: the result becomes `prototype-v2`).
  - Given an inline `mode: prototype` and an H2 `## Mode` whose value is `figma`, then `mode` is `prototype` (fails if `prototype` leaves `KNOWN_MODES`: the result becomes `figma`).
  - Given an inline `mode: mockup` and an H2 `## Mode` whose value is `N/A`, then `mode` is `mockup`; and given inline `mode: N/A` with H2 `mockup`, then `mode` is `N/A` (both fail if the last unknown token wins).
  - The qa report records each mutation (applied in a scratch copy only, never committed) and that the named test goes red under it and green after restore.
  proof: `node --test --test-name-pattern "^AC5 " test/e462-stale-comments-wording.test.mjs` exits 0.
- **AC6** — spec-workshop SOP (E462 (5)).
  - Given `content/skill-spec-workshop.md` step 4, then the sentence `Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.` is kept, and the reopen sentence is exactly `sw.reopen` (no second "names the one it replaces").
  - Given step 5, then its first sentence is exactly `sw.done`.
  - No other line of the file changes; the file gains and loses no backtick-quoted error code; the `spec-workshop` stripped body stays within the `test/context-budget.test.mjs` AC21 cap (1415 ~tok; PM probe: still passes unchanged).
  proof: `node --test --test-name-pattern "^AC6 " test/e462-stale-comments-wording.test.mjs` exits 0.
- **AC7** — migration guide (E462 (7)).
  - Given `docs/migration-v5.md`, then `## What changed` contains `mig.midline` as its own bullet, and `## SQLite / HTTP mode` contains `mig.sqlite_checks` (unchanged, e453) immediately followed by `mig.review_evidence`; no existing paragraph or row is removed, and the SQLite section still names no old/new server mix.
  proof: `node --test --test-name-pattern "^AC7 " test/e462-stale-comments-wording.test.mjs` exits 0.
- **AC8** — whole suite.
  - Given the change is built (`npm run build`, `dist/` committed with every `.ts` change), when the full suite runs, then every test is green except the known base skips, the re-pinned tests listed under Dependencies are green, `GATE_REGISTRY` has 33 entries and `UPDATE_STATE_GATE_PIPELINE` 17 steps, and no compose golden changed (PM probe: none moves).
  proof: `node scripts/test-lock.mjs -- npm test` prints `# fail 0`.

**Amendment (2026-11-25, after code-reviewer PASS @ `4620ebc`).** Human ruling made in the integrator session on 2026-11-25 and relayed by the integrator (to be recorded in the manifest Decisions at close): the two stale comments the reviewer listed as optional are fixed in this lane, and in a second ruling the same day ("expected-red 那項也一起修") the `gates/expected-red.ts` header re-wrap the reviewer recommended joins them. Scope is exactly AC9; nothing else reopens. Base for AC9 is `4620ebc`.

- **AC9** — three more comment-only fixes (amendment).
  - (a) Given `tools/handoff-orchestrator.ts`, the comment at the top of the `QA_COMPLETION_EVIDENCE_MISSING` pipeline step (~lines 737–745), then it no longer contains `QA completion-evidence gate` or `per-id QA evidence`, and names the judge's evidence instead (e.g. "Completion-evidence gate" and "per-id evidence in the judge report"). No code or message string changes: the step name and error code `QA_COMPLETION_EVIDENCE_MISSING` stay.
  - (b) Given `gates/visual.ts`, the `Source-credibility gate` comment (~line 862), then it no longer contains `pm to architect or sr-engineer hop` and names the current build-entry edge pm → {architect, qa-engineer} (e.g. "Build-entry gate on the pm to architect or qa-engineer hop").
  - (c) Given `gates/expected-red.ts`, the file-header comment block, then it is re-wrapped so the block is at most 7 lines (the comment-length scan limit), e.g. by joining `File mode only.` back onto one line; wording otherwise unchanged.
  - For all three: comment-only (no code, string or behaviour change), no `chain_path`, no bare ticket id in new comment text.
  proof: `node --test --test-name-pattern "^AC9 " test/e462-stale-comments-wording.test.mjs` exits 0 (resident: the old phrases in (a) and (b) are absent, (b) names `qa-engineer`); the judge-run `transpileModule` script (`removeComments: true`, target/module ESNext, as AC1) over `tools/handoff-orchestrator.ts`, `gates/visual.ts` and `gates/expected-red.ts` against `4620ebc` prints no DIFF; and the comment-length scan against base `83ca8c0` prints no `gates/expected-red.ts` line and no line that the same scan at `4620ebc` did not print. Judge-run scan, from the worktree after `npm run build`: `node --input-type=module -e "const m=await import('./dist/tools/comment-scan.js');const {langForPath}=await import('./dist/tools/comment-langs.js');const f=[];for(const [r,a] of m.collectAdded(process.cwd(),'83ca8c0')){const l=langForPath(r);const t=l&&m.readScannable(process.cwd(),r);if(t)f.push(...m.findingsForFile(r,m.analyzeText(t,l),a));}m.formatFindings(f).forEach((x)=>console.log(x));"`. A plain `node bin/agc-init.mjs check` cannot show this, because it diffs against `@{upstream}` (currently `4620ebc`); PM run of the scan at `4620ebc` against `83ca8c0` prints `gates/expected-red.ts:1 long-block 8 lines (limit 7)`.

## Copy / Strings

`<…>` marks an interpolated value. No string cites a repo-only path or a ticket id.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| e462.evidence-covers | `(or an existing report in <judge report dir> covering the id via a covers: line). ` | authored-here — E462 (3): replaces `(or an existing qa_reports/ report covering the id via a covers: line). `; `<judge report dir>` = `resolveJudgeReport(<workspace>).dir`, absolute like the expected-file paths before it |
| e462.report-heading | `# Review — <id>` | authored-here — E462 (3): replaces `# QA review — <id>` on newly created judge reports only; not an evidence heading |
| e462.unknown-mode-note | `"<mode>" is not a known design mode; write ` + "`no-design`" + ` if there is no design source. ` | authored-here — E462 (4) hint wording ("write `no-design` if there is no design source"); `<mode>` = the reported raw value; trailing space so the static hint follows |
| e462.unknown-mode-value | `<first word of the declared value, as written>` (≤ 40 chars, else 40 + `…`) | authored-here — E462 (4) "report the raw declaration": first word after leading `` ` * _ " ' ( [ `` / whitespace, ended by whitespace or `` ` * _ " ' ( ) [ ] < > ``, trailing `.,;:` dropped, case kept |
| sw.reopen | `When an answer shows an earlier ruling should change, reopen that question in the next batch.` | authored-here — E462 (5): the supersede clause is already in the preceding ruling sentence |
| sw.done | `the work is ready to cut when every scenario has one verification, every device-or-person scenario is marked, every conflict between sources has a ruling, and no ` + "`needs prototype`" + ` question is open.` | authored-here — E462 (5): done condition excludes an open `needs prototype` question (consistent with step 4) |
| mig.midline | `- A judge report whose verdict heading an older server appended mid-line (the report had no trailing newline) is no longer read as a verdict: drift and lane-status stop crediting those ids until the heading starts its own line.` (wrapped at ~78 columns, two-space continuation indent) | E462 (7), backlog row E462 "Folded in by the integrator" |
| mig.review_evidence | `So is the PASS-time review-evidence check (` + "`MISSING_REVIEW_EVIDENCE`" + `).` | E462 (7), backlog row E462 "Folded in by the integrator" |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Implementation notes for sr-engineer

- Comment-only files (AC1): `tools/transitions.ts` (lines 93, 106, 113: `{architect,sr-engineer}` → `{architect,qa-engineer}`, same width; line 401: `on either chain path` → `in the chain`, nothing else in the HOP_CAP block), `tools/registry.ts` (~358, same edge), `tools/handoff-types.ts` (~160: "makes the judge's Expected-Red Diff decisive"), `schema/migrations-handoff.ts` (~202: "has never made an sr-engineer -> qa-engineer return"), `gates/expected-red.ts` (header lines 2–5: qa-engineer lists the tests it leaves red, the judge records the diff; ~13: the H2 the judge writes, skill-code-reviewer step 7; ~38: "a feature needs no new test"), `gates/registry.ts` (~300–306 completion-evidence comment: the judge write; ~573 "the judge must log"; ~596 "a judge PASS"). Hint strings in `gates/registry.ts` are not changed.
- `tools/handoff-orchestrator.ts` ~1044 expected-red comment: dormant unless the manifest exists (qa-engineer writes it with the scenario tests); the judge's disposition in a judge report.
- AC2: normalise once in `handleUpdateStateCore`, next to the existing `completed_tasks` normalisation (any value other than `"code-reviewer"` becomes `undefined`), then pass `parsed.resume_of` straight to both consumers. No new comment cites a ticket id.
- AC3: message uses `resolveJudgeReport(parsed.workspace_path).dir` (already imported); heading literal in `gates/qa-review.ts` `recordReviewInFileUndoable`. Readers never read the H1 (grep: only this writer), so no reader change.
- AC4: in `gates/visual.ts` `parseDesignMode`, only the remembered first-unknown value changes (the known/prefix decision still uses the lowercased token, so arming and the Figma-only check are untouched). Export a pure helper (suggested `unknownDesignModeNote(mode: string | null): string`, `""` for null or a `KNOWN_MODES` member) and append it in the two orchestrator messages after `is absent. ` / `Assertions is absent. `.
- AC6/AC7: text edits only, exactly the Copy / Strings rows.
- `npm run build` after source changes; `dist/**` committed with the source.

## Test placement and base reads (for qa-engineer)

- One new file `test/e462-stale-comments-wording.test.mjs`; fixtures inline in temp dirs (no new `test/fixtures/` files). Import from `dist/`; direct `handleUpdateState` calls follow `test/e423-spec-workshop.test.mjs` AC17 (seed with `writeHandoffState`, `resetSession` / `markStateRead`).
- AC1 resident assertions read HEAD source text only (phrase absence/presence, the HOP_CAP phrases, the mapping comment compared to a string literal frozen from base). The `transpileModule` invariance is judge-run, not resident. Never `git show` in a test (the T-E77-02 meta-test refuses it); read anything captured from disk into memory at capture time (Node 20 ENOENT on later re-reads).
- Re-pin, in the same task, the existing tests this lane turns red (list under Dependencies) to the new strings; keep each test's intent. Old-heading fixtures (`# QA review — <id>` written by tests as pre-existing reports) stay as they are: they are the AC3 "old reports stay readable" guard.
- Write `qa_reports/expected-red_e462-stale-comments-wording.txt` (`<test file> | <exact test name> | reason`, every test red at base, new and re-pinned) and `qa_reports/tests_e462-stale-comments-wording.md` (scenario → test map, AC5 mutation log).

## Out of Scope

- Any decision behaviour: arming conditions, `none` / `n/a` / `tbd` handling (human ruling 2026-11-25: they stay unknown and arm), gate count 33, pipeline 17 steps, error codes, hint strings in `gates/registry.ts`.
- The `gates/registry.ts` errorCode → doc-file mapping comment; the HOP_CAP phrases `independent brake` / `before or after any round cap`; `tools/transitions.ts` line-158 hint and line-393 comment; the string `chain_path` anywhere new.
- Rewriting old reports' `# QA review — <id>` headings; an `evidence_schema` bump.
- E461 items other than (3); `content/**` other than `content/skill-spec-workshop.md`; `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `docs/backlog.md`.

## Dependencies / Prerequisites

- Base `83ca8c0` (= `166a460` plus the wave-2 manifest commit; the manifest's file/line facts re-verified against the actual text). Ticket text: `docs/backlog.md` rows E462 (with the 2026-11-25 re-check corrections and the integrator's (6)(7)) and E461 item (3). No external references (Resource Audit over the backlog rows and the manifest: zero `http(s)://` / Figma / tracker hits) — `external_refs` omitted.
- **Schema**: no persisted schema change. The H1 retitle is not an evidence-schema change: no reader in `tools/`, `gates/`, `bin/`, `scripts/` or `lib/` reads the H1 (grep: `gates/qa-review.ts` is the only site, the writer); every reader keys on the `## <ISO> — PASS|FAIL — by <signer>` verdict heading, which is unchanged. `EVIDENCE_SCHEMA_CURRENT` stays 3. So `allowSchemaChange` is not engaged.
- **Design**: non-design, no design source.
- **Human ruling applied** (2026-11-25, backlog E462 (4)): `none`, `n/a` and `tbd` stay unknown tokens that arm the visual checks; only `no-design` disarms. This cut changes only the reported value and adds the hint.
- **Cross-lane facts (manifest table 「讀對方檔案文字的測試」, re-checked)**: the HOP_CAP comment keeps its first line and both phrases (only `on either chain path` → `in the chain` on line 401; `test/e431-test-first-server-path.test.mjs` stays green in the probe); `tools/transitions.ts` lines 158 and 393 untouched (`test/e453-served-text-v5.test.mjs` AC9 green); the errorCode → doc-file mapping comment untouched and `content/skill-spec-workshop.md` gains/loses no backtick-quoted error code (`test/e433-*`, `test/e431-*`, `test/e434-*`, `test/error-code-contract.test.mjs` green); no new `chain_path` (`test/e435-remove-old-path.test.mjs` AC4 green); `docs/migration-v5.md` only gains text (`test/e435-*` AC8, `test/e453-*` AC7/AC8, `test/qa-flow.test.mjs`, `test/e151-*`, `test/e32-e33-*` green). No e461-owned test turns red, so no mailbox item for e461.
- **Tests that read this lane's files** (grep of `test/` for the literal and regex forms of every changed string, plus every test that reads the source text of a changed file): the re-pin set below, plus fixtures that write the old `# QA review — <id>` heading as a pre-existing report (`test/e150-*`, `test/e177b-*`, `test/e18-*`, `test/e32-e33-*`, `test/e432-*`, `test/e434-*`, `test/e448-*`, `test/e451-*`, `test/e452-*`, `test/e459-*`, `test/qa-review-scoped-append.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs`, `test/covering-evidence.test.mjs`, `test/e161-*` line ~311, `test/e236-*` line ~94) — these stay green unedited and act as the AC3 old-heading guard. No test pins the old `qa_reports/ report covering` message text.
- **PM probe** (intended changes applied in a scratch clone of the branch, built, committed there, full suite run; Node 22): base **4668 tests, 4666 pass, 0 fail, 2 skipped** (the two known history-dependent `test/e130-lane-default.test.mjs` skips, AC4 and AC14). With the changes: **4658 pass, 8 fail, 2 skipped**. The 8 fails:

  | test file | test | why | manifest prediction |
  |---|---|---|---|
  | `test/e161-qa-suite-result.test.mjs` | AC-E161-2 (line ~136) | report heading regex `^# QA review — ` | predicted (確定會紅) |
  | `test/e236-rejected-write-evidence.test.mjs` | AC-E236-6 (line ~232) | report heading regex | predicted (確定會紅) |
  | `test/qa-flow.test.mjs` | `recordReviewInFile creates qa_reports/review_<id>.md per task` (line ~645) | report heading regex | predicted (確定會紅) |
  | `test/e423-spec-workshop.test.mjs` | AC10 (line ~214) | step-5 done sentence | file predicted; the test differs: AC10, not AC16/AC17 (the as-written report keeps `mockup` / `code` / `freehand` / the 40-char cut, so AC16/AC17 stay green) |
  | `test/e445-spec-workshop-questioning.test.mjs` | AC5, AC6 (`S.reopen`), AC9 (`B.done`) | spec-workshop step 4 / 5 sentences | predicted (可能會紅), now confirmed |
  | `test/e108-eject.test.mjs` | AC2 `--yes executes exactly the AC1 plan` | load flake (`agc init` child killed, `null !== 0`, two full suites running at once); green 35/35 when re-run alone; on the addendum's load-sensitive list | not this lane's — no action |

  Every red file is in the e462 owned set; **no red file outside it**. Predicted but green in the probe: `test/context-budget.test.mjs` (spec-workshop AC21 still ≤ 1415 ~tok), every `test/fixtures/compose-golden/**` golden (no composed bundle carries the spec-workshop SOP body), `test/e453-served-text-v5.test.mjs`, `test/e431-test-first-server-path.test.mjs`, `test/skill-frontmatter.test.mjs`, the `mode=` message tests (`test/visual-gate-e2e.test.mjs`, `test/source-credibility-gate.test.mjs`, `test/baseline-manifest-gate.test.mjs`, `test/pixel-gate-attestation.test.mjs`, `test/pixel-perfect-visual-compare.test.mjs`, `test/repro-first-gate.test.mjs`, `test/agc-adapters.test.mjs`) and the completion-evidence message group (`test/e154-*`, `test/e150-*`, `test/e18-*`, `test/e247-*`, `test/e32-e33-*`, `test/e35-pipeline-order.test.mjs`, `test/e380-*`, `test/e432-*`, `test/e448-*`, `test/error-code-contract.test.mjs`, `test/reviewer-completed-tasks-gate.test.mjs`). Newly found red files: none.
- Probe check of AC1 invariance: `transpileModule` (`removeComments: true`) output of the six comment-only files is byte-identical to base. Probe check of AC2 at base and with the change: a direct call with `resume_of` `"qa-engineer"` / `"sr-engineer"` / `""` on `pm → code-reviewer:In_Progress` is rejected with `received resume_of: absent.` and writes nothing; on the `sr-engineer:In_Progress` self-loop it lands with no `resume_of` on disk; `"code-reviewer"` is accepted and persisted — identical before and after.
- **Golden / budget (R3 (b))**: the probe moves neither, so no planned sr → qa return is cut. If sr's final text does move a compose golden or the AC21 cap after all, the R3 (b) route applies: after the last implementation task sr returns once to qa (uses 1 `sr_return`), qa re-captures the golden / sets the cap to the measured value with a per-hunk note, then sr hands to code-reviewer.
- `CLAUDE.md` unchanged: no `tools/*.ts` file is added.

## Gate Summary

| gate | outcome |
|---|---|
| Visual state-count / geometric-density split | not triggered: non-design, no `design/e462-stale-comments-wording.md` |
| Parallel-Lane Cut | not triggered: already one lane of `specs/fanout-pre-v5-w2.md`; the cut stays serial inside the lane |
| Scope Decision | `scope_decision: single-feature` recorded (dormant for a non-design feature) |
| Resource Audit | zero external references in the backlog rows and the manifest; `external_refs` omitted |
| Question Batch | zero open questions; the `none` / `n/a` / `tbd` question was already ruled by the human (2026-11-25); the H1 retitle judged not an evidence-schema change (see Dependencies); the AC9 amendment scope was ruled by the human (2026-11-25, relayed by the integrator), nothing left open |
| Expected-red | qa-engineer writes `qa_reports/expected-red_e462-stale-comments-wording.txt` (new AC tests red at base plus the five re-pinned files) before the qa → sr hand-off; AC9: T-E462-10 appends the new AC9 tests, red at `4620ebc` |
| Cut-Approval | cut presented inline; `cut_approved` left to the coordinator after the integrator pre-review (original cut and the AC9 amendment alike); `fanout.mjs check --cut` exit 0 |

manifest-tier: no option choice, no needs-human-ruling item

## Cut

| id | desc | depends_on | est. files | touches | design-link |
|---|---|---|---|---|---|
| E462 | Stale old-chain comments (comment-only in six files) and the expected-red / build-entry comments; `resume_of` normalised once instead of two ternaries (direct-call behaviour unchanged); completion-evidence message names `resolveJudgeReport().dir`; new judge reports start `# Review — <id>` (old-heading reports still read); unknown design mode reported as written plus the `no-design` hint (arming unchanged); spec-workshop step 4 de-dup and step 5 open-`needs prototype` exclusion; migration guide gains two sentences; re-pin the five red test files | E419–E445 (shipped) | 9 source + 1 content + 1 doc + `dist/` + 1 new test + 5 re-pinned tests | `tools/transitions.ts`、`tools/registry.ts`、`tools/handoff-types.ts`、`tools/handoff-orchestrator.ts`、`schema/migrations-handoff.ts`、`gates/expected-red.ts`、`gates/registry.ts`、`gates/qa-review.ts`、`gates/visual.ts`、`content/skill-spec-workshop.md`、`docs/migration-v5.md`、`dist/**`、`test/e462-*.test.mjs`、`test/e161-qa-suite-result.test.mjs`、`test/e236-rejected-write-evidence.test.mjs`、`test/qa-flow.test.mjs`、`test/e423-spec-workshop.test.mjs`、`test/e445-spec-workshop-questioning.test.mjs`、`specs/e462-stale-comments-wording.md` | — |
| E461 (3) | Design-mode mutation guards against the new report format: `prototype` stays in `KNOWN_MODES` (prefixed and mixed-candidate input), first unknown token wins (both orders) | E462 | 1 new test (shared file) | `test/e462-*.test.mjs` | — |

## Tasks

Cut notes: `dist/**` is the tracked build product of every `.ts` change (addendum §3), committed with the source. Comment-only files: `tools/transitions.ts`, `tools/registry.ts`, `tools/handoff-types.ts`, `schema/migrations-handoff.ts`, `gates/expected-red.ts`, `gates/registry.ts`. No compose golden or `test/context-budget.test.mjs` change is expected (probe); they stay owned in case. No `tools/*.ts` file is added. Release bookkeeping (CHANGELOG, backlog done-marks for E461 / E462) belongs to the integrator / release-engineer and is not cut here.

Order (v5 chain): qa T-E462-01 → qa T-E462-02 → sr T-E462-03 → T-E462-09 → T-E462-04 → T-E462-05 → T-E462-06 → T-E462-07 → T-E462-08 (each one sr session, within the `task_size` budget of ≤ 5 files; T-E462-09 was appended at the integrator pre-review to split the original seven-file T-E462-03, ids never renumbered) → code-reviewer judges every task and writes PASS. sr never edits a qa-written test; any red sr leaves is appended to the expected-red manifest with its reason. No planned sr → qa return (see Dependencies, R3 (b) fallback).

Task Budget Map:

| task | role | AC | size |
|---|---|---|---|
| T-E462-01 | qa-engineer | AC1–AC7 new tests, expected-red manifest, test map | 1 new file |
| T-E462-02 | qa-engineer | re-pin of the five red files | 5 files, ~10 lines |
| T-E462-03 | sr-engineer | AC1 (part 1) | 4 files, comments only |
| T-E462-09 | sr-engineer | AC1 (part 2) | 3 files, comments only |
| T-E462-04 | sr-engineer | AC2 | 1 file, ~8 lines |
| T-E462-05 | sr-engineer | AC3 | 2 files, ~2 lines |
| T-E462-06 | sr-engineer | AC4, AC5 | 2 files, ~20 lines |
| T-E462-07 | sr-engineer | AC6, AC7 | 2 text files, ~8 lines |
| T-E462-08 | sr-engineer | AC8 | build + full suite |
| T-E462-10 | qa-engineer | AC9 resident assertions, manifest + tests report | 1 test file + 2 qa_reports files |
| T-E462-11 | sr-engineer | AC9 (a)(b)(c), build, full suite | 3 source files, comments only, + `dist/` |

Amendment order (AC9, after the PASS @ `4620ebc`): qa T-E462-10 → sr T-E462-11 → code-reviewer judges T-E462-10 and T-E462-11 and writes PASS again.

- [ ] T-E462-01 [P0] qa-engineer: new `test/e462-stale-comments-wording.test.mjs`, tests for AC1–AC7 (titles start `AC<n> `; Copy / Strings pinned verbatim; AC5 mutations run in a scratch copy only and logged; base text frozen as literals, never read from history); `qa_reports/expected-red_e462-stale-comments-wording.txt` and `qa_reports/tests_e462-stale-comments-wording.md` | depends_on: none
- [ ] T-E462-02 [P0] qa-engineer: re-pin the tests this lane turns red to the new strings, intent kept: `test/e161-qa-suite-result.test.mjs` AC-E161-2, `test/e236-rejected-write-evidence.test.mjs` AC-E236-6, `test/qa-flow.test.mjs` recordReviewInFile heading (all to `e462.report-heading`), `test/e423-spec-workshop.test.mjs` AC10 (`sw.done`), `test/e445-spec-workshop-questioning.test.mjs` `S.reopen` / `B.done` (AC5, AC6, AC9); add each to the expected-red manifest; old-heading fixtures untouched | depends_on: T-E462-01
- [ ] T-E462-03 [P0] sr-engineer: stale old-chain and build-entry comments in `tools/transitions.ts`, `tools/registry.ts`, `tools/handoff-types.ts` and the expected-red comment in `tools/handoff-orchestrator.ts` (AC1, part 1 of 2; comment-only; HOP_CAP phrases, lines 158 / 393 and `chain_path` untouched) | depends_on: T-E462-02
- [ ] T-E462-09 [P0] sr-engineer: stale old-chain comments in `schema/migrations-handoff.ts`, `gates/expected-red.ts`, `gates/registry.ts` (AC1, part 2 of 2; comment-only; the errorCode → doc-file mapping comment, hint strings and `chain_path` untouched) | depends_on: T-E462-03
- [ ] T-E462-04 [P0] sr-engineer: `tools/handoff-orchestrator.ts` `resume_of` normalised once at handler entry, both ternaries removed (AC2) | depends_on: T-E462-09
- [ ] T-E462-05 [P0] sr-engineer: completion-evidence message via `resolveJudgeReport().dir` in `tools/handoff-orchestrator.ts`; new-report heading `# Review — <id>` in `gates/qa-review.ts` (AC3) | depends_on: T-E462-04
- [ ] T-E462-06 [P0] sr-engineer: `gates/visual.ts` unknown mode reported as written plus an exported note helper, wired into the two visual messages in `tools/handoff-orchestrator.ts` (AC4, AC5) | depends_on: T-E462-05
- [ ] T-E462-07 [P0] sr-engineer: `content/skill-spec-workshop.md` step 4 / step 5 (AC6) and `docs/migration-v5.md` two sentences (AC7), exactly the Copy / Strings rows | depends_on: T-E462-06
- [ ] T-E462-08 [P0] sr-engineer, last implementation task: `npm run build`, `dist/**` committed; full suite `node scripts/test-lock.mjs -- npm test` with every manifest entry green and no red beyond the base skips; gate count 33 / pipeline 17; goldens and the AC21 cap unmoved (else the R3 (b) return) (AC8) | depends_on: T-E462-07
- [ ] T-E462-10 [P0] qa-engineer: AC9 tests in `test/e462-stale-comments-wording.test.mjs` (titles start `AC9 `; old phrases `QA completion-evidence gate`, `per-id QA evidence` absent from `tools/handoff-orchestrator.ts`; `pm to architect or sr-engineer hop` absent from `gates/visual.ts` and its build-entry comment names `qa-engineer`); append them to `qa_reports/expected-red_e462-stale-comments-wording.txt` and update `qa_reports/tests_e462-stale-comments-wording.md` | depends_on: none
- [ ] T-E462-11 [P0] sr-engineer: AC9 comment-only fixes in `tools/handoff-orchestrator.ts` (completion-evidence gate comment), `gates/visual.ts` (source-credibility build-entry edge) and `gates/expected-red.ts` (header re-wrapped to ≤ 7 lines); `npm run build`, `dist/**` committed; full suite `node scripts/test-lock.mjs -- npm test` green beyond the base skips | depends_on: T-E462-10
