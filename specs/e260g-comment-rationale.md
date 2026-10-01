# e260g comment rationale

Rationale moved out of long comment blocks in 28 test files (`test/e3*` to `test/e9*`, `test/error-*`, `test/eval-*`, `test/evidence-*`, `test/{f,g,h,i,j,k,l}*.test.mjs`) by lane e260g of ticket E260 (spec: `specs/e260g-test-e3-l-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260g-comment-rationale.md (test/<file>).`

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the code, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260g/proof.mjs --list-mid`.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none yet: filled in as tasks land |

## test/e31-config-nonfatal.test.mjs

The mandatory `tw_get_state` pre-flight read sits on the call path guards/session.ts `markStateRead`, `findTasksFile`, `resolveTaskPaths`, `loadConfig`, so a throw in `loadConfig` blocks the one call everything else depends on. The matching "degrades, does not throw" checks for older cases live in `test/config-versioning.test.mjs` and `test/e22-stale-notify.test.mjs`. Ticket: E31.

Contract under test (backlog row and the `loadConfigEntry` doc comment in tools/config.ts):

- `loadConfig(ws)` never throws; any config-file fatality collapses to the empty config, defaults in effect.
- `getConfigError(ws)` surfaces the loud failure (path and problem) exactly when `loadConfig` is serving defaults in place of a config file that exists but cannot be used; null when clean or absent.
- `tw_get_state` (`readHandoffState`) spreads `config_error` onto both the `exists:false` and the normal envelope; clean or absent config adds no key, so the envelope stays byte-identical to the shape before the change.
- The mtime cache behind `loadConfig` also caches the load error; fixing the file bumps mtime and invalidates the cached error on the next call, so it self-heals without a server restart.
- Known and accepted ("QA probe 1" tests, raised in code review, documented, not fixed): task-mutation tools (`completeTask`, `addTask` via `resolveTaskPaths` and `resolveTaskRegex`) share the same non-throwing core, so a corrupt config makes them silently fall back to `DEFAULT_TASK_PATHS` and `DEFAULT_TASK_REGEX` instead of the workspace's custom `taskPattern` and `taskPaths`. That is predictable (never a crash, never a mis-write) but not surfaced as an error by the mutation tools; only the `config_error` key makes the degradation discoverable. By design per spec ("degrade to defaults loudly-but-readable" is scoped to the pre-flight read); the suite documents the behaviour and does not change it.
- Not covered: a chmod after the config is cached goes unnoticed until mtime changes, a known limitation of the mtime cache.

## test/e32-e33-gate-hardening.test.mjs

Tickets: E32, E33. Why a separate file: `test/e18-write-provenance.test.mjs` and `test/reviewer-completed-tasks-gate.test.mjs` already test the amended rule (their QAEV-4a/b and FM4/FM5 cases), but only by flipping older assertions. This file adds shapes that had no test at all, most importantly an exact replay of the real incident where a code-reviewer write marked a whole batch complete with no QA evidence. If the R1 test is deleted or weakened, that incident can come back unnoticed.

Spec-to-test map (labels match the ones the code review used when it replayed each shape):

- R1: exact incident replay (verdict carried, `completed_tasks` grown, `review_reports` covers-file present, `qa_reports` absent) is rejected and the ledger stays unpolluted. Permanent pin.
- R2: R1 minus `review_verdict`.
- R4: verdict, growth and no review evidence at all; proves `QA_COMPLETION_EVIDENCE_MISSING` fires independently of, and before, `MISSING_REVIEW_EVIDENCE`.
- C2: amended compliant shape (`review_task_ids`, `completed_tasks` empty) minus review evidence gives `MISSING_REVIEW_EVIDENCE`.
- C3: a legitimate qa-engineer PASS with its own `qa_review` auto-record satisfies the completion-evidence check for its own ids.
- PROBE 6 (P6a, P6b, P6c): the two checks are independent; divergent `completed_tasks` and `review_task_ids` id sets, each evidenced or not.
- ENV-1, ENV-2: the rejection message names the offending ids, the expected `qa_reports/review_<id>.md` path per id, and the `covers:` fallback, so the writer knows what to add (E23).

C1 (compliant amended shape accepted) is covered by QAEV-4b, and C4 (carry-forward without growth accepted) by QAEV-3, both in `test/e18-write-provenance.test.mjs`; not duplicated here. The seed-stamp note: `SAFE_SEED_STAMP` (fixed 2026-01-01) is safe because every `handleUpdateState` call reads the seed as its previous state for the same feature and never depends on lease freshness; E148.

## test/e35-pipeline-order.test.mjs

Tickets: E35 (e35-gate-pipeline-extraction). The order of the write-path checks used to be kept only by a comment that nothing enforced. Two independent assertions:

1. Exact ordered name and codes pin (`t-order-exact`): a literal expected array transcribed from the current tools/handoff-orchestrator.ts and verified against source; catches reorder, rename or code drift on any single step.
2. Registry cross-check (`t-codes-registry-parity`): flattens every step's codes and compares them as a set against `ALL_GATE_CODES` in gates/registry.ts, so the pin has a single source of truth for the code catalog rather than two hand-maintained literal lists that could diverge. `TRANSITION_VALIDATION`'s codes are asserted to be the same array reference as the registry-exported `TRANSITION_GATE_CODES`, not a re-typed literal, for the same reason.

The file imports from `dist/` (the built tree), matching the pin-suite convention of `test/hop-count-transitions.test.mjs` and `test/error-code-contract.test.mjs`; `npm test`'s prebuild step guarantees `dist/` exists.

## test/e38-next-role-lookahead.test.mjs

Ticket: E38. The warning is only useful if it can be trusted, so false warnings and empty remedy lists are the failures that matter. Two such defects were invisible in the diff and showed up only when every state was tried under each counter setting: a hardcoded `feature_changed:false` warned wrongly on the legal qa-engineer:PASS to design-auditor edge at the hop cap, and an over-broad self-loop filter emptied the remedy list on qa-engineer:In_Progress and pm:Blocked, printing a false "(none ...)" message. That is why the tests go through the `tw_update_state` tool boundary (what a user sees), not just the bare helper. The requirements come from the backlog row, not a specs file. The through-the-tool shape (seed a state, then one write) mirrors `test/e28-shrink-warning.test.mjs`, which uses the same `warnings` array.

Spec-to-test map:

- the originally reported shape warns, remedy names pm:In_Progress and sr-engineer:In_Progress: L1
- qa-engineer:PASS to design-auditor silent at hop 2 (in-table): S-E37-lo
- same edge silent at hop 10 (guards the hop-cap false warning): S-E37-hi
- resume_of allowance, pm:In_Progress with next_role code-reviewer silent: S-RESUME
- capped-counter allowance, qa_round at cap with next_role pm silent: S-ROUNDCAP
- self-loop allowance, sr-engineer:In_Progress self-loop silent: S-SELFLOOP
- non-empty named remedy on qa-engineer:In_Progress (guards the emptied-list defect): R-QA-IP
- non-empty named remedy on pm:Blocked: R-PM-BLOCKED
- never rejects, a bogus next_role still succeeds and persists: N-NEVERREJECT
- coexists with the shrink warning, one write and two warnings, neither clobbers the other: C-E28COEXIST

## test/e43-test-file-ask-at-dispatch.test.mjs

Ticket: E43. Constitution §2's *Conditional test writing* bullet used to say "qa-engineer MUST ask the user before creating any [test file]". A Task-dispatched subagent has no way to ask and no way to resume, so it could only stop and lose its context, or decide on its own and disclose it. A rule that every run must break teaches that rules are optional, so the ask now happens upstream, at the dispatcher, whom a human can reach when the brief is written. The backlog row is the spec; there is no specs file.

Ticket-to-test map:

- dispatcher decides: `t-e43-branch-a-reads-the-brief`, `t-e43-coord02-template-line`, `t-e43-coord02-rule-is-target-conditional`
- round-1 F1 (two-sided outcome): `t-e43-branch-c-is-two-sided`
- round-1 F2 (branches must partition): `t-e43-branches-partition-with-catch-all`
- no silent create or skip in either direction: `t-e43-no-silent-create-or-skip`
- the retired unexecutable form is gone: `t-e43-retired-form-absent-everywhere`
- §2 no-restatement and brief-first: `t-e43-qa-sop-defers-to-const2`
- cross-file label coherence: `t-e43-placement-label-is-one-string`
- normative text must not be stripped: `t-e43-branches-survive-strip`
- guard-the-guard (must be red pre-fix): `t-e43-assertions-red-against-pre-e43-text`

Why the tests check the shape of the rule rather than today's exact wording, where possible: the realistic regression is not "someone deletes branch (b)". It is someone adding a fourth branch that reintroduces a fall-through, adding a conditional template line without stating when it applies, or drifting the `Test-file placement` label in one of the three files that must agree on it. Instance pins on today's wording would miss all three (same approach as E66 option (ii) and E69).
