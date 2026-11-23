# Test report — e445-spec-workshop-questioning (T-E445-01)

Author: qa-engineer (test-first chain; writes no verdict). Test file: `test/e445-spec-workshop-questioning.test.mjs` (new; placement pre-authorized by the dispatch brief's `Test-file placement` line and the spec's *Test placement and base reads* — that is the branch acted on for Test File Discovery; no existing test file covers these ACs, and `test/e423-spec-workshop.test.mjs` is not edited).

Re-pin notice: AC1 and AC10 freeze the base SOP text outside steps 2-5 as in-test string constants (`BASE_SOP`); a later edit of this same SOP (e.g. tracker mirroring) must re-pin those constants.

## Scenario → Test Map

| scenario | test file | exact test name | state on base |
|---|---|---|---|
| AC1 | test/e445-spec-workshop-questioning.test.mjs | AC1: six step headings in the composed prompt, exactly six numbered steps, short form byte-identical to base | green |
| AC2 | test/e445-spec-workshop-questioning.test.mjs | AC2: step 4 keeps the 4-question cap and admits only askable, mutually independent questions to a batch | red |
| AC3 | test/e445-spec-workshop-questioning.test.mjs | AC3: step 4 sets the `Q<n> — <title>: <question>` format, recommendation and example on own lines, answer by number | red |
| AC4 | test/e445-spec-workshop-questioning.test.mjs | AC4: step 4 words each question so "yes" accepts the recommendation, and says so when it cannot | red |
| AC5 | test/e445-spec-workshop-questioning.test.mjs | AC5: step 4 keeps the dated/replacing ruling sentence and follows it with a separate reopen sentence | red |
| AC6 | test/e445-spec-workshop-questioning.test.mjs | AC6: step 4 marks look-and-feel questions `needs prototype`, defers them, builds none, and ends `not ready to cut` if open | red |
| AC7 | test/e445-spec-workshop-questioning.test.mjs | AC7: step 2 keeps the survey before the first question, then keeps it short with parallel lookups | red |
| AC8 | test/e445-spec-workshop-questioning.test.mjs | AC8: step 3 keeps delegated bulk reading, then never asks a lookup-able fact and treats a recommendation as no ruling | red |
| AC9 | test/e445-spec-workshop-questioning.test.mjs | AC9: step 5 keeps its three base sentences in order, then the one-time accept-all reminder | red |
| AC10 | test/e445-spec-workshop-questioning.test.mjs | AC10 (unchanged sections): frontmatter, Purpose, step 1, step 6, Short form, Outputs, Governance state are byte-identical to base | green |
| AC10 | test/e445-spec-workshop-questioning.test.mjs | AC10 (added lines): every added or changed line in steps 2-5 carries no new step, write tool, ticket id, repo path, Task alias or gate code | red |
| AC11 | test/context-budget.test.mjs | AC21 block (T-E445-03, planned R3 return; not touched this hop) | — |
| AC12 | hygiene run (`node scripts/test-lock.mjs -- npm test`, goldens, dist, CLAUDE.md, agc check, npm audit) | command scenario — the judge runs it | — |

Secondary proof lines in the spec that run `test/e423-spec-workshop.test.mjs` (AC6, AC9, AC10, AC11 there) are existing tests, green on base; they must stay green after the edit.

## Open Interface Details

- **AC10 split into two tests**, both titled `AC10 (...)` so `--test-name-pattern="^AC10"` selects both: the unchanged-sections half is green on the base (the brief requires the unchanged parts green now) and the added-lines half is red until steps 2-5 are edited. Precedent: `AC14 (D5)` in `test/e423-spec-workshop.test.mjs`.
- **AC10 line-start `\d. **` rule on changed step lines.** Each step is one line, so editing steps 2-5 makes those four step lines "changed" lines that necessarily start with `2. **` … `5. **`. Read literally, the rule would forbid any edit. Interpreted per the spec's stated intent (*no new line starting with a digit, dot, space, `**`*; no new step): a changed line may start with a numbered prefix only when that prefix is one of the six base step headings verbatim; any other numbered opener fails. The numbered-line count of the dispatch view must also equal the base count.
- **Added-line anchor-drift guard.** The added-lines test requires a changed line for each of steps 2, 3, 4, 5, so the scan cannot pass vacuously (same idea as the "found no added lines to scan" guard in `test/e423-spec-workshop.test.mjs` AC11). This is why it is red on the base (the spec's Tasks line lists "the added-line part of AC10" as expected red).
- **Sentence joining.** Order is asserted by index; adjacency is asserted only where the spec requires it: `sw.batch_cap` opens step 4 right after `<heading> — ` and is followed by a space (the clause ends its sentence), and `sw.reopen` follows the preserved ruling sentence after exactly one space (AC5 "SEPARATE following sentence", "directly after"). `sw.prototype_end` must be the last text of step 4 and `sw.pushback` the last text of step 5 (trailing whitespace ignored).
- **AC3 replaced clause.** The base clause `each with your recommendation and a worked example` must be gone from step 4 (Copy / Strings: `sw.format` replaces it); the parenthesis is still required verbatim.
- **Task-alias, repo-only and gate-code rules** are replicated in-test (test files are not importable modules): the `REPO_ONLY` list is copied from `test/e423-spec-workshop.test.mjs`, the `Task` occurrence rule from `test/e410-task-alias-content-tail.test.mjs`; gate codes come from `ALL_GATE_CODES` in `dist/gates/registry.js` and are matched backtick-quoted.
- **Name-pattern overlap.** `--test-name-pattern="^AC1"` also selects the two `AC10 (...)` tests; after T-E445-02 all three are green, so the AC1 proof line holds.
- **Base text.** `BASE_SOP` is the SOP at the cut's base commit, frozen as one string literal per line (byte-identical; checked against the working tree before the edit). No history read (T-E77-02 meta-test), no temp directory re-read (Node 20).
- **Security smoke cases**: not applicable — the scenarios cover static agent-facing SOP text; no interface takes input.

## Red Reasons

- AC2: `sw.batch_cap` / `sw.batch_ready` not in step 4 (base still reads `at most 4 questions per batch, each with …`).
- AC3: `sw.format` / `sw.by_number` not in step 4; the replaced base clause is still present.
- AC4: `sw.yes` not in step 4.
- AC5: `sw.reopen` not after the preserved ruling sentence.
- AC6: `sw.prototype` / `sw.prototype_end` not in step 4.
- AC7: `sw.lookup` not appended to step 2.
- AC8: `sw.facts` not appended to step 3.
- AC9: `sw.pushback` not appended to step 5.
- AC10 (added lines): no changed line yet for steps 2-5 (anchor-drift guard).

Satisfiability check: all 11 tests pass against a scratch copy of the SOP with the Copy / Strings applied in the spec's order (single space between sentences); the scratch copy is not in the tree.

## CI Runnability

`node --test` headless, no human interaction; builds the composed prompt from `dist/` in an OS temp workspace, removed in `after`. Runs the same on Node 20 and 22 (no Node-22-only API).

## AC21 Re-baseline (T-E445-03, planned R3 (b) return)

- Scenario AC11 → `test/context-budget.test.mjs` | `AC21 (spec-workshop): skill-spec-workshop stripped token count meets ≤ 1415 cap` (AC21 block only; title, re-baseline comment line, cap and assertion message changed; no other cap and no other test file touched).
- Measurement: same computation as the test — frontmatter stripped, `stripRationale(stripOriginTags(expandPartials(body)))`, `Math.ceil(chars / 4)` — on sr-engineer's SOP (commit e99c7c9), after `npm run build`.
- Delta: 1092 → **1415 ~tok (+323)**, zero headroom; matches pm's dry-run in the spec.
- State: AC21 green; the expected-red manifest notes it (earlier lines kept).
- Full suite (`node scripts/test-lock.mjs -- npm test`, Node 22, run alone under the lock, on 64e71f5): 4536 tests, 4534 pass, 0 fail, 2 skipped (the pre-existing e130 history skips), 7.2 min.
- Environmental note: two earlier full runs under host load (about 16.8, from OS indexing daemons) each lost one unrelated test to a child-process timeout. The first was the e320 polling test (1003 s, no exit status; 15/15 when that file ran alone). The second was a `git` call in the e386 test (`spawnSync git ETIMEDOUT` after 739 s), and that run then stalled in `test/lane-migrate.test.mjs`. The coordinator stopped it, and on the clean rerun above lane-migrate passed with no hang. No test file other than the AC21 block was edited.
