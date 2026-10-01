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

## test/e5-intake-tiering.test.mjs

Tickets: E5. The file tests three coordinator intake rules and their config key. The config side follows the layout of the `tokenBudgetPerFeature` tests in `test/token-budget-config.test.mjs` (T-B9-03).

Config-side spec-to-test map (`CutApprovalAutoTier` in tools/config.ts):

- absent key means disabled: `t-absent-key`, `t-absent-file`
- present `{}` gives conservative defaults: `t-empty-object-defaults`
- non-object, array, null or primitive is treated as absent (non-fatal): `t-string-value`, `t-number-value`, `t-null-value`, `t-array-value`
- `maxFiles` fractional positive is floored, not defaulted: `t-maxfiles-fractional`
- `maxFiles` negative, zero, non-finite or non-number falls back to the default: `t-maxfiles-negative`, `t-maxfiles-zero`, `t-maxfiles-infinity`, `t-maxfiles-string`
- `maxPriority` valid `^P\d+$` is surfaced verbatim: `t-maxpriority-valid`
- `maxPriority` malformed pattern falls back to the default: `t-maxpriority-no-p`, `t-maxpriority-trailing-space`, `t-maxpriority-non-digit`
- `allowSchemaChange` and `allowDesignArmed` accept strict `=== true` only: `t-booleans-strict-true`, `t-booleans-truthy-non-true-stays-false`
- `CUT_APPROVAL_AUTO_TIER_DEFAULTS` export shape: `t-defaults-export-shape`
- byte-identical regression for workspaces without the key: `t-existing-fields-untouched`

Content spec-to-test map (plain text-containment checks against the shipped content files, in the style of `test/e16-judge-dispatch-charter.test.mjs`):

- const-08 auto-tier bullet, trust rule plus same-write recording plus halt-over-threshold language: `t-const08-trust-rule`, `t-const08-same-write-recording`, `t-const08-halt-over-threshold`, `t-const08-advisory-not-enforced`
- coord-03 Backlog Intake Loop present plus the never-auto-hop-to-release-engineer bound: `t-coord03-intake-loop-present`, `t-coord03-never-auto-hop-release`
- coord-07 SOP step 4a present plus the §2/§3.2 hard-floor sentence: `t-coord07-step4a-present`, `t-coord07-hard-floor`

## test/e90-golden-capture-completeness.test.mjs

Tickets: E90, E43. Two of the twelve golden fixtures were once hand-rebuilt, so they existed only as files the regeneration tool could not reproduce. Map of claims to tests: all 12 fixtures captured is `t-captured-equals-on-disk` and `t-asserted-equals-on-disk`; every fixture the suite asserts against has a capture in the script is the three-way tie across both tests.

Why: the capture script has its own completeness check (on-disk minus captured exits 1), but it only runs when someone runs the script by hand. Without this file, an edit that adds a golden fixture the suite asserts against without a capture for it, or adds a capture whose fixture never lands on disk, would go unnoticed until the next manual regeneration. This file runs the same "capture set equals fixture set" check on every `npm test` and also ties in the fixtures the two consuming suites (`compose-equivalence.test.mjs`, `skill-manifest.test.mjs`) read via `readGolden` or the `GOLDEN` constant. That three-way tie is stronger than the script's two-way check: a fixture an assertion depends on that has no capture and is not on disk is invisible to on-disk-minus-captured (both sets omit it), but shows up here.

The check is deliberately static (it reads the script's source text) instead of running the capture script, because the script overwrites the committed fixtures in `test/fixtures/compose-golden/` and running it inside `npm test` would silently rewrite the files the suite compares against. The extractors key off literal calls to the `writeFixture(...)` helper, so a dead branch that merely mentions a fixture name (for example `constitution-monolith.txt` in an unused `else`) is not counted as a capture.

## test/e92-e86-handoff-write-boundary.test.mjs

Tickets: E86, E92. Why the file leads with a corpus sweep: the whole existing suite stayed green while two drafts of this check wrongly rejected valid text (F1: bare placeholders and TS generics rejected; F4: a tag fragment quoted mid-string with more prose after it rejected). A green suite was never coverage for this check. Both defects were found by running real corpus lines through the shipped `run()` path, not by hand-written cases, so the corpus sweep near the bottom is the main method, and both false positives are pinned as regression tests so a later tightening of the regex cannot bring them back.

Spec-to-test map:

- AC1, reject true-positive tails with the verbatim message: "AC1:" tests
- AC2, accept mid-string and false-positive tails: "AC2:" tests, NEW-3 and NEW-4 tests, corpus sweep
- AC3, whole-note-drop omission marker: "AC3:" tests
- AC4, no read-path re-validation: "AC4:" tests
- AC5, no new false rejections and the just-under-cap case: "AC5:" tests, corpus sweep, full suite

Guarded fields under test: `pending_notes[i]`, `scope_decision_why`, `qa_review`, `blocking_reason` (all via `tw_update_state`), and `tw_add_task`'s description.

Workspace note: the AC1, AC2, NEW-3, NEW-4, whitespace and corpus tests exercise only the zod-level `superRefine`, which never touches the filesystem. `workspace_path` only needs `path.isAbsolute()` to hold, and any downstream guard or handler rejection (for example `PREFLIGHT_REQUIRED`, since `tw_get_state` was never called against this workspace) is irrelevant to what these tests assert and is swallowed deliberately. One non-existent absolute path is reused across all of them: no tmpdir, no fs writes, nothing to clean up. The AC3 and AC4 tests round-trip through tools/handoff.js and do use real tmpdir workspaces (`os.tmpdir()`, never the repo root).

## test/e96-dispatch-preference.test.mjs

Tickets: E96. A host system-prompt nudge is not a reason to fall back to in-context role switching once the user has asked for the chain. The spec is the backlog row (option (i)); there is no specs file. Each test checks a kind of regression, not a byte diff:

1. `t-anti-nudge-request`: coord-02 states that an explicit `/teamwork` (or equivalent explicit coordinator entry) invocation is the user's request for subagent dispatch. This is the root cause the ticket fixes.
2. `t-when-do-compose-axis-*`: the WHEN/DO §3.2 surfacing rule composes only under `hostCapabilitiesFor("claude-code")` and is absent from the lean (undefined host) profile. The rule assumes the Task tool exists, so the rule and that assumption must sit on the same side of the host-capability compose axis; otherwise the rule fires as a false alarm on every hop under the default (undeclared-host) profile. A code review of the first draft caught exactly this. A text search over one file cannot catch it, because it depends on `composeSkill`'s per-fragment host tag, so the test composes both profiles through the real render path (D6).
3. `t-fallback-genuine-unavailability` and `t-fallback-self-contained`: coord-03's fallback is conditioned on genuine tool unavailability (host advertises no Task, or the Task call errors or reports unknown subagent types); it is self-contained, with no "above" pointer into coord-02, since a reader of the lean profile would see a pointer with nothing to point at (C2); and the bare, unqualified "graceful and silent" wording is gone, because a silent fallback is the defect itself.

Each test searches for the shape of the guarantee (host-tag placement, self-containment, absence of the retired unqualified phrase) rather than the exact sentence, so a rewording that preserves the guarantee keeps passing and one that breaks it fails.

## test/error-code-contract.test.mjs

Spec: specs/gate-registry-architecture.md (A10, A2, A5, AC-1, AC-5). The file imports the real `GATE_REGISTRY` and `ALL_GATE_CODES` from the built gates/registry.ts, the single structured source of truth, and checks that:

- the registry's code set equals the codes harvested from source by the shared shape rule;
- the codes harvested from docs (backtick tokens) are a subset of the registry;
- every `documentedInProse` entry appears in at least one content/*.md file;
- each entry is self-consistent (`hintStatic` non-empty, `errorCode` literally present in its producer file).

A code added in one place but not the others fails here. `TransitionRejection["error"]` in tools/transitions.ts is a hand-written union, deliberately not generated from the registry (DR-8); the union is pinned to an exact member count and must be a subset of `ALL_GATE_CODES`. The file depends on a built tree (AC-7); `npm test`'s prebuild step guarantees `dist/`.

The round-cap constants (`ROUND_CAP_EXPORTED` and the review, visual and hop siblings) are imported so the `>= N` literals in `triggerEdge` are checked against the live transitions.ts values rather than trusted as hand-copied prose (c12-registry-field-consumers, d2-server-brake-accounting).

The shape-rule suffix list grew one suffix per gate whose final word was missing; the spec-mandated code names are fixed, so the suffix is added instead of renaming the code:

- `UNRESOLVED`: EXTERNAL_REFS_UNRESOLVED (b8-external-ref-ledger)
- `MISMATCH`: REVIEW_VERDICT_STATUS_MISMATCH (c9-protocol-fields)
- `HELD`: FEATURE_LEASE_HELD (e1-feature-scoped-state-design)
- `CHANGE`: BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE (e10-lease-override)
- `SUSPECT`: STAMP_PROVENANCE_SUSPECT (e18-write-provenance)

Code-side source set: index.ts, tools/*.ts, schema/*.ts, guards/*.ts and gates/*.ts (the `listFiles("tools", ".ts")` glob does not reach gates/, so it is added explicitly).

The newest registry entry at the time of the count pin was NON_QA_COMPLETED_TASKS_REJECTED (E40), which extends the reviewer-only `completed_tasks` check to every identity other than qa-engineer. The union membership notes: HOP_CAP_EXCEEDED is emitted by validateTransition's hop-cap override (same class as the three round-cap codes), hence also in `TRANSITION_GATE_CODES`; EXTERNAL_REFS_UNRESOLVED, FEATURE_LEASE_HELD and SOURCE_CREDIBILITY_UNVERIFIED are orchestrator-only and are in the union for narrowing at the emit site, the subset check and a complete catalog (DR-9, DR-3).

## test/eval-assertions.test.mjs

Spec: specs/d4-behavioral-eval-harness.md. The live runner (test/eval/run-eval.mjs) trusts the four checkers' verdicts against real model replies and spends real API dollars per run. If a checker silently regresses (for example the terse-cap exemption list drifts from Constitution section 1, or the escalation-shape key list drops a required key), the harness either fails compliant scenarios, burning budget on false negatives, or passes a real behavioural regression. This file proves each checker still does what its AC claims, with one compliant and one violating hand-written fixture per checker, before anything is spent trusting it. The file matches the `test/*.test.mjs` glob so it runs in plain `npm test` at zero API cost (AC-6).

## test/feature-rollup.test.mjs

Spec: specs/e113-feature-level-rollup.md (AC2-AC5). Test-label map: AC2 (seam and shape) is `t-seam-marker` and `t-provider-swap-zero-callsite`; AC3 (multi-lane sum against the hop cap) is `t-sum-against-hop-cap-exported`; AC3 plus the cross-feature regression is `t-round1-regression-no-cross-feature-sum`; AC4 (an unreadable lane is carried, not dropped or zero-filled) is `t-unreadable-lane-carried`; AC5 (the ROLL-UP INCOMPLETE banner leads the output, degrade honestly) is `t-banner-zero-matching` and `t-banner-unattributable`.

The cross-feature regression is the most important test in the file. An earlier version summed every lane in the repo and reported `hop: 54, OVER BY 44` for a feature whose true total was 3; the fix is the `matchingLanes = lanes.filter(lane => lane.activeFeature === featureId)` filter in tools/feature-rollup.ts, and the test stops a future edit from silently dropping it.

Why real workspaces back the "readable" lanes: `computeFeatureRollup` does not trust a `LaneListProvider`'s own `hopCount` or `activeFeature` for ticket counts. For every lane the provider reports `readable: true`, it re-reads that lane's own `.current/handoff.md` through `parseHandoff()` to get `completed_tasks`. A provider claiming `readable: true` for a workspace with no real handoff on disk is silently downgraded to `readable: false`, which would corrupt the fixtures that must stay `degraded: false`. So each lane meant to stay readable has a real temp workspace with a real handoff (written the way `test/drift-skew.test.mjs` does it); only the deliberately unreadable and unattributable lanes are synthesized `LaneInfo` objects.

The extension section (ticket E132, task T-E132-05) adds the lane-registry spec's AC5 and AC6 (specs/e132-lane-registry.md) plus review-found gaps; test names carry the labels:

- AC5 hand-forward 1 and 2: provider `completedTasks` preferred, N reads not 2N.
- AC6 hand-forward 3: a historical-only match is surfaced, not summed (also gap 11, the positive control: a readable moved-on lane must still degrade and print the note).
- gap 1 (two-sided stderr cleanliness), gap 2 (CRLF equals LF), gap 3 and 10 (refined plus adversarial combination), gap 5 (branch extraction, detached gives null), gap 8 (`flush()` control flow, two worktree lines in one block), gap 9 (porcelain terminal shapes), gap 12 (predicate parity between `computeFeatureRollup` and `renderRollupReport`).

The porcelain-shape tests prepend a small real executable `git` shim on PATH instead of mocking `execFileSync`: `node:test`'s `mock.method` cannot redefine a core-module export in this codebase's compiled ESM output ("Cannot redefine property"). The same limit rules out a call-count spy on `parseHandoff`, which is why the AC5 test deletes the file the provider's `workspacePath` points at: a second read would then find nothing.
