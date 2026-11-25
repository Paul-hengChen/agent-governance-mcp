# Tests — e462-stale-comments-wording (T-E462-01, T-E462-02)

Author: qa-engineer. Spec: `specs/e462-stale-comments-wording.md` (no ticket file; the spec's Acceptance
Criteria stand in as the scenarios). Test-file placement: the spec's "Test placement and base reads" names
one new file, `test/e462-stale-comments-wording.test.mjs`, fixtures inline in temp dirs, imports from
`dist/` — acted on as written. Red-test manifest: `qa_reports/expected-red_e462-stale-comments-wording.txt`
(22 entries).

## Scenario → Test Map

All titles below are in `test/e462-stale-comments-wording.test.mjs` unless a file is named. Every title
starts `AC<n> ` so the spec's `proof:` patterns (`--test-name-pattern "^AC<n> "`) select exactly that AC.

| AC | test | red at base? |
|---|---|---|
| AC1 | `AC1 no stale old-chain phrase remains in the named source files` | red |
| AC1 | `AC1 tools/transitions.ts and tools/registry.ts comments name the build-entry edge {architect,qa-engineer}` | red |
| AC1 | `AC1 kept text: HOP_CAP comment head and phrases, transitions.ts migration hint and visual-cap comment, the errorCode mapping comment` | green (guard: must stay green) |
| AC1 | `AC1 no line containing chain_path is added or changed in the ticket's files` | green (guard) |
| AC1 | transpileModule invariance over the six comment-only files vs `83ca8c0` | not a resident test — judge-run (spec AC1 `proof:`) |
| AC2 | `AC2 the two resume_of ternaries are gone and both consumers read parsed.resume_of` | red |
| AC2 | `AC2 a non-code-reviewer resume_of on pm -> code-reviewer:In_Progress is rejected exactly as an absent one` | green (behaviour exists; guard) |
| AC2 | `AC2 a stale resume_of on an edge legal without it lands and is not persisted` | green (behaviour exists; guard) |
| AC2 | `AC2 resume_of code-reviewer still opens pm -> code-reviewer:In_Progress and is persisted` | green (unchanged behaviour) |
| AC3 | `AC3 QA_COMPLETION_EVIDENCE_MISSING names the judge report directory from resolveJudgeReport` | red |
| AC3 | `AC3 a new judge report starts with `# Review — <id>`, then the unchanged auto-append marker and verdict section` | red |
| AC3 | `AC3 an old-heading report with a server PASS section still credits the id, and a later append adds no second heading` | green (guard) |
| AC3 | `AC3 EVIDENCE_SCHEMA_CURRENT stays 3` | green (guard) |
| AC4 | `AC4 an unknown declared mode is reported as written (case kept, not cut at `/`) and arms` | red |
| AC4 | `AC4 only no-design disarms; known modes are still lowercased` | green (guard) |
| AC4 | `AC4 the reported value is the first word only and a very long word is cut to 40 characters plus `…`` | red |
| AC4 | `AC4 VISUAL_BASELINES_REQUIRED reports mode=N/A and the no-design note before the static hint` | red |
| AC4 | `AC4 VISUAL_ASSERTIONS_REQUIRED carries the same note after `Assertions is absent. `` | red |
| AC4 | `AC4 a known mode gets no unknown-mode note in either message` | green (guard) |
| AC4 | `AC4 gate count stays 33 and the two visual error codes are unchanged` | green (guard) |
| AC5 | `AC5 `prototype-v2` resolves to prototype (prototype stays a known mode)` | green (mutation guard) |
| AC5 | `AC5 an inline `mode: prototype` wins over an H2 `## Mode` of figma (prototype stays a known mode)` | green (mutation guard) |
| AC5 | `AC5 the first unknown token wins: inline mockup over an H2 N/A` | green (mutation guard) |
| AC5 | `AC5 the first unknown token wins: inline N/A over an H2 mockup` | red (AC4 format: base reports `n`) |
| AC6 | `AC6 step 4 keeps the ruling sentence and states the reopen rule once, as sw.reopen` | red |
| AC6 | `AC6 step 5's first sentence is sw.done (no open `needs prototype` question)` | red |
| AC6 | `AC6 no other line of the SOP changes and no backtick-quoted error code is gained or lost` | red |
| AC6 | spec-workshop stripped body within the AC21 cap | `test/context-budget.test.mjs` AC21, unchanged (not re-pinned; green in the scratch build below) |
| AC7 | `AC7 `## What changed` has mig.midline as its own bullet` | red |
| AC7 | `AC7 `## SQLite / HTTP mode` has mig.sqlite_checks immediately followed by mig.review_evidence, no server mix` | red |
| AC7 | `AC7 no paragraph, bullet or row of the base migration guide is removed` | green (guard) |
| AC8 | whole suite, `node scripts/test-lock.mjs -- npm test` | command — judge/sr run, no test |

T-E462-02 re-pins (intent kept, each now red until the implementation lands):

| file | test | re-pinned to |
|---|---|---|
| `test/e161-qa-suite-result.test.mjs` | `AC-E161-2 (E435): ...` | heading regex `^# Review — T-E161-X` (e462.report-heading) |
| `test/e236-rejected-write-evidence.test.mjs` | `AC-E236-6 (E435): ...` | heading regex `^# Review — T-E236-X` |
| `test/qa-flow.test.mjs` | `recordReviewInFile creates qa_reports/review_<id>.md per task` | `^# Review — T01` |
| `test/e423-spec-workshop.test.mjs` | `AC10: done condition ...` | sw.done sentence |
| `test/e445-spec-workshop-questioning.test.mjs` | `AC5: ...`, `AC6: ...`, `AC9: ...` | `S.reopen` = sw.reopen, `B.done` = sw.done |

Old-heading fixtures (`# QA review — <id>` written by tests as pre-existing reports: e161 ~311, e236 ~94 and
the files the spec lists) are untouched: they are the AC3 "old reports stay readable" guard.

## Open Interface Details

- **AC1 "names the build-entry edge"**: read as "at least one `//` comment line in each of
  `tools/transitions.ts` and `tools/registry.ts` contains `{architect,qa-engineer}`". `tools/registry.ts`
  already has it in a zod description string, which is not a comment, so the test looks at comment lines.
- **AC1 "no changed or added line contains `chain_path`"**: resident form without history — the set of lines
  containing `chain_path` across the eleven files this ticket touches must equal the frozen base set (three
  `schema/migrations-handoff.ts` lines, two `docs/migration-v5.md` lines).
- **AC1 line-393 comment**: frozen as the whole four-line visual-round cap comment (lines 393-396), which also
  covers line 394 that `test/e453-served-text-v5.test.mjs` AC9 pins.
- **AC2 consumers "read parsed.resume_of directly"**: source regexes `next_resume_of:\s*parsed\.resume_of\s*[,\n}]`
  and `resumeOf:\s*parsed\.resume_of\s*[,\n}]`. The normalisation itself must not reuse the exact text
  `parsed.resume_of === "code-reviewer" ? "code-reviewer" : undefined` anywhere in the file (AC2 says no
  occurrence), e.g. write `... ? parsed.resume_of : undefined` or an `if`.
- **AC2 self-loop edge**: `sr-engineer:In_Progress → sr-engineer:In_Progress` (the PM probe's edge).
- **AC3 FAIL write**: the heading test also drives a code-reviewer FAIL (`review_verdict: CHANGES_REQUESTED`)
  and `recordReviewInFile` directly.
- **AC3 old-heading credit**: the PASS gate is checked both through `hasPassEvidenceInFile` and a real
  code-reviewer PASS write with no `qa_review`; drift through `hasEvidenceAnywhere`; lane-status through
  `checkLaneEvidence(...).evidenceIds`.
- **AC4 first-word ends**: beyond the spec's examples the test also checks `Mock*up` → `Mock`, `"Draft"`,
  `(Draft)`, `[Draft]`, `Draft_v1`, `Draft'x`, `Draft<x>` → `Draft`, and trailing `;` `:` `,` dropped — all
  straight from the e462.unknown-mode-value row. The 100 000-character case uses `"Ab".repeat(50000)` so the
  kept case is visible in the cut value.
- **AC4 VISUAL_ASSERTIONS_REQUIRED fixture**: design with `mode: N/A` and a `## Visual Baselines` table,
  `qa_reports/visual_<id>.md` present, no `## Visual Structural Assertions`.
- **AC6 "no other line changes"**: the SOP's lines must equal the frozen base lines, with step 4's line equal
  to base with only the reopen sentence swapped for sw.reopen and step 5's line equal to base with only the done
  sentence swapped for sw.done. Error codes counted as backtick-quoted `UPPER_SNAKE` tokens (base set: none).
- **AC7 "no paragraph or row removed"**: base units = each blank-line paragraph, with list / table paragraphs
  split into bullets (plus continuation lines) and rows; each unit, whitespace-normalised, must still occur
  in the whitespace-normalised doc. mig.review_evidence may continue the sqlite_checks paragraph or start
  the next line; the check is on whitespace-normalised text.

## Red Reasons

- `AC1 no stale old-chain phrase ...` — the thirteen phrases are still in the six comment-only files and the orchestrator (T-E462-03 / T-E462-09).
- `AC1 ... comments name the build-entry edge {architect,qa-engineer}` — transitions.ts comments still say `{architect,sr-engineer}`.
- `AC2 the two resume_of ternaries are gone ...` — both ternaries still present (T-E462-04).
- `AC3 QA_COMPLETION_EVIDENCE_MISSING names the judge report directory ...` — message still hard-codes `qa_reports/` (T-E462-05).
- `AC3 a new judge report starts with `# Review — <id>` ...` — writer still emits `# QA review — <id>` (T-E462-05).
- `AC4 an unknown declared mode is reported as written ...` — base reports the lowercased token (`N/A` → `n`, `TBD` → `tbd`) (T-E462-06).
- `AC4 the reported value is the first word only ...` — base lowercases (`Mock*up` → `mock`, long word cut lowercased).
- `AC4 VISUAL_BASELINES_REQUIRED reports mode=N/A ...` — base message says `mode=n` and has no note.
- `AC4 VISUAL_ASSERTIONS_REQUIRED carries the same note ...` — same, on the assertions message.
- `AC5 the first unknown token wins: inline N/A over an H2 mockup` — written against the AC4 format; base reports `n`.
- `AC6 step 4 ... sw.reopen` / `AC6 step 5 ... sw.done` / `AC6 no other line ...` — SOP still has the old sentences (T-E462-07).
- `AC7 ... mig.midline` / `AC7 ... mig.review_evidence` — the guide has neither sentence yet (T-E462-07).
- e161 AC-E161-2, e236 AC-E236-6, qa-flow `recordReviewInFile creates ...` — re-pinned to `# Review — <id>`; writer not changed yet.
- e423 AC10, e445 AC5 / AC6 / AC9 — re-pinned to sw.done / sw.reopen; SOP not changed yet.

## Scratch build check (never committed)

To make sure the tests are satisfiable as written, a scratch copy of the tree outside the worktree got a
minimal stand-in for T-E462-03..07 (comment phrase swaps, `resume_of` normalised once, the message via
`resolveJudgeReport().dir`, the new heading, first-word / case-kept unknown mode plus a note helper wired
into both visual messages, the two SOP sentences, the two guide sentences), built with `tsc`. Result: the new
file 29/29, e161 9/9, e236 7/7, qa-flow 153/153, e423 19/19, e445 11/11, plus e453 23/23, context-budget
55/55 and error-code-contract 27/27 all green. That stand-in is not a design for sr-engineer; sr builds from
the spec.

## AC5 Mutation Log

Applied to the scratch copy's built `dist/gates/visual.js` only (with the AC4-format stand-in in place), never
to the worktree; run `node --test --test-name-pattern "^AC5 " test/e462-stale-comments-wording.test.mjs`.

| mutation | tests red under it | after restore |
|---|---|---|
| `prototype` removed from `KNOWN_MODES` | `AC5 `prototype-v2` resolves to prototype ...`, `AC5 an inline `mode: prototype` wins over an H2 `## Mode` of figma ...` (the two mockup/N/A tests stay green) | all four green |
| last unknown token wins (`if (firstUnknown === null)` → `if (true)`) | `AC5 the first unknown token wins: inline mockup over an H2 N/A`, `AC5 the first unknown token wins: inline N/A over an H2 mockup` (the two prototype tests stay green) | all four green |

code-reviewer re-runs both mutations against sr-engineer's real `gates/visual.ts` build (scratch copy only).

## CI Runnability

Headless `node --test`; temp workspaces under `os.tmpdir()`, removed in `after`. No history read, no network.
