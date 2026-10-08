# e260g comment rationale

Rationale moved out of long comment blocks in 28 test files (`test/e3*` to `test/e9*`, `test/error-*`, `test/eval-*`, `test/evidence-*`, `test/{f,g,h,i,j,k,l}*.test.mjs`) by lane e260g of ticket E260 (spec: `specs/e260g-test-e3-l-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260g-comment-rationale.md (test/<file>).`

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the code, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260g/proof.mjs --list-mid`.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: every long block was cut to 7 counted lines or fewer |

## test/e31-config-nonfatal.test.mjs

The mandatory `tw_get_state` pre-flight read sits on the call path guards/session.ts `markStateRead`, `findTasksFile`, `resolveTaskPaths`, `loadConfig`, so a throw in `loadConfig` blocks the one call everything else depends on. The matching "degrades, does not throw" checks for older cases live in `test/config-versioning.test.mjs` and `test/e22-stale-notify.test.mjs`. Ticket: E31.

Contract under test (backlog row and the `loadConfigEntry` doc comment in tools/config.ts):

- `loadConfig(ws)` never throws; any config-file fatality collapses to the empty config, defaults in effect.
- `getConfigError(ws)` surfaces the loud failure (path and problem) exactly when `loadConfig` is serving defaults in place of a config file that exists but cannot be used; null when clean or absent.
- `tw_get_state` (`readHandoffState`) spreads `config_error` onto both the `exists:false` and the normal envelope; clean or absent config adds no key, so the envelope stays byte-identical to the shape before the change.
- The mtime cache behind `loadConfig` also caches the load error; fixing the file bumps mtime and invalidates the cached error on the next call, so it self-heals without a server restart.
- Known and accepted ("QA probe 1" tests, raised in code review, documented, not fixed): task-mutation tools (`completeTask`, `addTask` via `resolveTaskPaths` and `resolveTaskRegex`) share the same non-throwing core, so under a corrupt config they resolve `DEFAULT_TASK_PATHS` and `DEFAULT_TASK_REGEX` instead of the workspace's custom `taskPattern` and `taskPaths`. The tests show the effect per tool: `completeTaskInFile` returns a loud JSON error ("No task list file found.") and `addTaskInFile` writes the lane ledger `.current/<lane>/tasks.md`. Neither crashes or mis-writes, but the mutation tools do not surface the config problem; only the `config_error` key makes the degradation discoverable. By design per spec ("degrade to defaults loudly-but-readable" is scoped to the pre-flight read); the suite documents the behaviour and does not change it.
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

Config-side spec-to-test map (`CutApprovalAutoTier` in tools/config.ts). Tests are titled `T-E5-02 config: ...`; the map names each by a phrase from its title:

- absent key means disabled: "no cutApprovalAutoTier key", "does not exist at all"
- present `{}` gives conservative defaults: "present-but-empty {} object"
- non-object, array, null or primitive is treated as absent (non-fatal): "a string value", "a number value", "null for", "an array for"
- `maxFiles` fractional positive is floored, not defaulted: "fractional positive maxFiles is floored"
- `maxFiles` negative, zero, non-finite or non-number falls back to the default: "negative maxFiles", "zero maxFiles", "numeric-literal overflow", "a string maxFiles"
- `maxPriority` valid `^P\d+$` is surfaced verbatim: "a valid ^P\d+$ maxPriority"
- `maxPriority` malformed pattern falls back to the default: "missing the 'P' prefix", "trailing whitespace", "non-digit maxPriority"
- `allowSchemaChange` and `allowDesignArmed` accept strict `=== true` only: "accept only the literal boolean true", "truthy-but-not-true values"
- `CUT_APPROVAL_AUTO_TIER_DEFAULTS` export shape: "DEFAULTS export has the exact conservative shape"
- byte-identical regression for workspaces without the key: "existing config fields are untouched"

Content spec-to-test map (plain text-containment checks against the shipped content files, in the style of `test/e16-judge-dispatch-charter.test.mjs`; titles are `T-E5-01 content: ...`, `T-E5-02 content: ...`, `T-E5-03 content: ...`):

- const-08 auto-tier bullet, trust rule plus same-write recording plus halt-over-threshold language: the five `T-E5-02 content: const-08 ...` tests ("trust rule", "SAME write", "HALTs exactly as today", "opt-in ... and advisory", "documents the conservative per-field defaults")
- coord-03 Backlog Intake Loop present plus the never-auto-hop-to-release-engineer bound: "carries the Backlog Intake Loop section", "never auto-hops to release-engineer"
- coord-07 SOP step 4a present plus the §2/§3.2 hard-floor sentence: "carries step 4a", "hard floor is never bypassed"

## test/e90-golden-capture-completeness.test.mjs

Tickets: E90, E43. Two of the twelve golden fixtures were once hand-rebuilt, so they existed only as files the regeneration tool could not reproduce. Map of claims to tests: all 12 fixtures captured is the pair of tests "capturedSet has no accidental duplicates and is exactly 12" and "the set of fixtures ... captures equals the set present in test/fixtures/compose-golden/"; every fixture the suite asserts against has a capture in the script is the test "every fixture the consuming suites assert against ... has a capture in the script", which closes the three-way tie.

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

Spec: specs/e113-feature-level-rollup.md (AC2-AC5). Test-title map (tests are titled `AC2: ...`, `AC3: ...`, `AC4: ...`, `AC5: ...`, `round-1 regression PIN: ...`; the `t-*` labels came from the old file header and do not appear in the file now): AC2 (seam and shape) is the three `AC2:` tests (SEAM FOR E132 marker, `localFallbackLaneList` export, substitute `LaneListProvider`); AC3 (multi-lane sum against the hop cap) is the `AC3:` test; AC3 plus the cross-feature regression is `round-1 regression PIN`; AC4 (an unreadable lane is carried, not dropped or zero-filled) is the two `AC4:` tests; AC5 (the ROLL-UP INCOMPLETE banner leads the output, degrade honestly) is the `AC5:` tests (zero matching lanes, unattributable lane, no bare total without the banner).

The cross-feature regression is the most important test in the file. An earlier version summed every lane in the repo and reported `hop: 54, OVER BY 44` for a feature whose true total was 3; the fix is the `matchingLanes = lanes.filter(lane => lane.activeFeature === featureId)` filter in tools/feature-rollup.ts, and the test stops a future edit from silently dropping it.

Why real workspaces back the "readable" lanes: `computeFeatureRollup` does not trust a `LaneListProvider`'s own `hopCount` or `activeFeature` for ticket counts. For every lane the provider reports `readable: true`, it re-reads that lane's own `.current/handoff.md` through `parseHandoff()` to get `completed_tasks`. A provider claiming `readable: true` for a workspace with no real handoff on disk is silently downgraded to `readable: false`, which would corrupt the fixtures that must stay `degraded: false`. So each lane meant to stay readable has a real temp workspace with a real handoff (written the way `test/drift-skew.test.mjs` does it); only the deliberately unreadable and unattributable lanes are synthesized `LaneInfo` objects.

The extension section (ticket E132, task T-E132-05) adds the lane-registry spec's AC5 and AC6 (specs/e132-lane-registry.md) plus review-found gaps; test names carry the labels:

- AC5 hand-forward 1 and 2: provider `completedTasks` preferred, N reads not 2N.
- AC6 hand-forward 3: a historical-only match is surfaced, not summed (also gap 11, the positive control: a readable moved-on lane must still degrade and print the note).
- gap 1 (two-sided stderr cleanliness), gap 2 (CRLF equals LF), gap 3 and 10 (refined plus adversarial combination), gap 5 (branch extraction, detached gives null), gap 8 (`flush()` control flow, two worktree lines in one block), gap 9 (porcelain terminal shapes), gap 12 (predicate parity between `computeFeatureRollup` and `renderRollupReport`).

The porcelain-shape tests prepend a small real executable `git` shim on PATH instead of mocking `execFileSync`: `node:test`'s `mock.method` cannot redefine a core-module export in this codebase's compiled ESM output ("Cannot redefine property"). The same limit rules out a call-count spy on `parseHandoff`, which is why the AC5 test deletes the file the provider's `workspacePath` points at: a second read would then find nothing.

## test/handoff-write-arg-guard.test.mjs

Spec: `specs/handoff-write-arg-guard.md`. Spec-to-test map (the test names carry the same labels):

- AC-1, valid args accepted: `t-ac1-valid-root-path-accepted`, `t-ac1-valid-feature-string-accepted`.
- AC-2, a `.current` workspace_path rejected: `t-ac2-current-basename-rejected`, `t-ac2-exact-error-message`, `t-ac2-non-current-basename-accepted`, `t-ac2-current-as-parent-not-rejected`.
- AC-3, the `[object Object]` sentinel rejected: `t-ac3-object-sentinel-rejected`, `t-ac3-exact-error-message`, `t-ac3-valid-feature-id-not-rejected`.
- AC-4, no corrupt write produced: `t-ac4-no-nested-current-dir`, `t-ac4-sentinel-not-persisted`.
- Regression guards, the older refines still fire: `t-reg-pass-requires-qa-engineer` (PASS needs agent_id qa-engineer), `t-reg-prd-path-traversal`.

Why: these guards are the only server-side barrier against two silent corruptions: a doubly nested `.current/.current/handoff.md` from a misdirected workspace_path, and the JavaScript object-stringification artefact `[object Object]` persisted verbatim as the feature sentinel. Both break constitution section 7 (fail loud) and section 3.1 (reject invalid tw_update_state writes).

Strategy: the tests drive the real MCP dispatch boundary (dist/index.js as a stdio server) so the full Zod, handler and ZodError-catch pipeline runs; the schema is not exported, so this is the only public way to exercise `UpdateStateArgs`. The spawn pattern follows `test/teamwork-lite.test.mjs`. The `callServer` helper resolves as soon as every id-bearing request has a response; `waitMs` is only a failure ceiling, because a fixed sleep flaked when the full suite's concurrency slowed the server's cold start (ticket E15).

## test/gates-expected-red.test.mjs

Specs: `specs/c15-expected-red-manifest.md`. The check works like the other evidence-existence checks (MISSING_EVIDENCE, VISUAL_EVIDENCE_MISSING): sr-engineer declares intentionally red tests in `qa_reports/expected-red_<feature>.txt`; qa-engineer diffs the actual run against it and records the disposition under a `## Expected-Red Diff` H2 in `qa_reports/review_<id>.md`; the server checks that the section exists and nothing more.

Spec-to-test map:

- AC-1 (manifest artifact and format): not re-tested here; the file format is a plain-text convention, not machine-parsed (spec Out of Scope).
- AC-4 arm check (`hasExpectedRedManifest`): U1-U5.
- AC-4 disposition check (`hasExpectedRedDisposition`): U6-U12.
- AC-4 PASS gate composition (`EXPECTED_RED_DIFF_MISSING`): I1-I4.
- AC-5 file-mode only: I5, I5b.

I1-I4 go through the real `handleUpdateState`, the way `test/qa-flow.test.mjs` does (C1-07). The server's recordReview step runs before the evidence checks and appends `qa_review` verbatim to `qa_reports/review_<id>.md`, so a `qa_review` containing `## Expected-Red Diff` becomes the on-disk disposition section, exactly as in the real sr-engineer and qa-engineer flow.

I5 follows the convention of `test/cut-approval-gate.test.mjs` (S1, XS1): the gate is wrapped in `storage instanceof FileHandoffStorage` at the orchestrator call site, so a plain fake storage object fails the check, and no SQLite DB is needed because the predicate is a pure instanceof test. I5b pins the real call sites: a refactor that hoists the expected-red check out of the file-mode guard would silently break AC-5 otherwise (ticket e2-bugfix-repro-gate, task T-E2-02).

## test/handoff-migration.test.mjs

Three in-body blocks were shortened; the comments now carry the contract and the cited spec holds the rest (`specs/server-scope-decision-gate.md`). The v6 to v10 test (AC-8/B8) lists every field that migration must not invent: next_role, resume_of, review_verdict, dispatch_pins, dispatched_at, dispatch_mode, evidence_schema, cut_approved_source, dispatch_mechanism and dispatch_mechanism_tier. The runner walks current to target stepwise, so the public API cannot isolate one intermediate step. The next_role/resume_of/review_verdict inverse test belongs to the c9-protocol-fields ticket (AC-3): these three are single-hop directives with the same lifetime as the pending_notes lines they replaced, so a stale `next_role: architect` from three writes ago must not linger.

## test/hop-count-transitions.test.mjs

Specs: `specs/d2-server-brake-accounting.md` (T-D2-05), `specs/e1-feature-scoped-state-design.md` (T-E1-05). Spec-to-test map:

- AC-1, persisted and server-computed field: `t-compute-*`, `t-e2e-accumulate`.
- AC-2, hop cap enforced server-side: `t-gate-*`, `t-e2e-cap-fires`.
- AC-3, hop count resets per feature: `t-compute-feature-reset`, `t-gate-feature-bypass`, `t-e2e-feature-reset`.
- AC-4, survives a coordinator crash or compaction: `t-crash-file`, `t-crash-sqlite`.
- AC-8, the existing round caps are unchanged and take precedence over the hop-cap override: `t-precedence-*`.
- DR-6, a pm landing does not reset hop_count: `t-compute-pm-no-reset`, `t-e2e-landing-no-reset`.
- DR-9, increment only on role transitions: `t-compute-self-loop-holds`.

Why: the hop counter is the one remaining cost-side circuit breaker (const-01 Limits, `hop` cap 10) that used to live only in the coordinator's in-memory arithmetic, exactly the failure a context compaction or crash could silently reset. It now uses the same persisted, server-enforced machinery as qa_round, review_round and visual_round; the tests pin that the sibling mechanism (a) computes correctly in isolation, (b) enforces the cap end to end through the real state-write orchestrator, and (c) survives a simulated crash by reconstructing purely from what is on disk or in SQLite.

End-to-end climb: it bounces pm and sr-engineer through two real ALLOWED_TRANSITIONS rows (`pm:In_Progress` to sr-engineer, and back), so every write is a counted role transition (DR-9), none touches qa_round, review_round or visual_round (no FAIL or PASS in the sequence), and the file-mode CUT_APPROVAL_REQUIRED, SCOPE_DECISION_REQUIRED and EXTERNAL_REFS_UNRESOLVED build-entry gates stay quiet as long as every pm write carries `cut_approved: true` (those gates key on the previous pm write's attestation, and `cut_approved` re-arms to undefined on every bare PM re-entry).

`backdateLastUpdated`: the feature lease rejects any write whose `active_feature` differs from the incumbent's while the incumbent is non-terminal (status not PASS) and fresh (`last_updated` within LEASE_TTL_MIN, 30 minutes). `t-e2e-feature-reset` writes a new feature over a still In_Progress incumbent, exactly the overwrite FEATURE_LEASE_HELD rejects, so the helper backdates the persisted `last_updated` past the TTL before the feature-change write, without altering the reset assertion.

## test/lane-migrate.test.mjs

Specs: `specs/e123a-lane-layout-migration.md` (AC6-AC10, AC15; tasks T-E123A3-05, T-E123A3-08). Spec-to-test map:

- AC6, flat to lane full-fixture move, optional-file skip, never touches `.config.json`, `exemptions.json`, `tasks.md` or `feature-split.md`, derived from LANE_FILES: FL1, FL2, FL3.
- AC7, a differing destination throws and both sides stay untouched: CONFLICT1, CONFLICT2 (bonus: identical-content resume).
- AC8, lane to flat is the exact reverse and the empty lane dir is removed: REV1, REV2.
- AC9, round trip byte-identical modulo schema_version: RT1.
- AC10, unwired (zero callers outside the module's own test), later replaced by the AC3, AC12 and AC13 checks: CALLERS1.
- AC15, moved plus skipped key count equals LANE_FILES.length on both runners: COUNT1, COUNT2.

Shortened in-body blocks, with the detail that no longer sits next to the code:

- Debris tolerance (AC5, ticket e123b8 J1): the three AC5-DEBRIS fixtures are AC5's own worked examples; REV3 already proves that any other non-LANE_FILES entry still refuses. AC5-DEBRIS4's lock-path case (ticket e123b9 J2): the per-lane lock now lives at `.current/<lane>/.handoff.lock`, the name the AC5-DEBRIS series probes.
- base-sha (AC11, e125b, T-E125B-01): registering base-sha as a LANE_FILES entry is what lets a lane holding it reverse-migrate without refusing; RT1 already proves the full-fixture round trip byte-identical now that `seedAllFiveFiles` seeds it.
- Wired through the lock-free cores (AC3, AC12, AC13, which replaced the AC10 unwired check; e123b9 J2): `writeHandoffStateCore` and `readHandoffState`'s non-blocking attempt call the core directly. The CALLERS scan excludes dist/ and test/ and matches `name(` so `migrateFlatToLaneLocked(` (see CALLERS-LOCKED) is not a hit.
- `noFlatCounterpart` (specs e125a AC1 and AC2, architecture D1 and D2): OPTIONAL_FILENAMES and ALL_FILENAMES stay derived from the full registry so a future flat-movable entry is caught automatically; MOVABLE_FILENAMES mirrors the unexported MOVABLE_LANE_FILES filter in tools/lane-migrate.ts.
- Sidecar merge (ticket e123b9, T-E123B9-05 (h)) and pendingTickets (ticket e179 AC10): pending-tickets.md is committed markdown, so concatenating two copies would yield two `## Applied` sections and duplicate lane_local_ids.

## test/lane-paths.test.mjs

Specs: `specs/e123a-lane-layout-migration.md` (AC4, AC5, AC15; tasks T-E123A3-08), `specs/e123b0-lane-runtime-resolver.md` (AC1-AC5; task T-E123B0-03). Spec-to-test map:

- e123a AC4, `resolveLaneName`: leading ticket-id token, `_legacy` fallback, must never return `_primary`: RN1..RN9 (table-driven).
- e123a AC5, `resolveLanePaths` derived by iterating LANE_FILES, with only a short listed set of callers of the function itself (lane-aware code calls `resolveCurrentLanePaths` instead; dispatch-log.ts imports its filename from LANE_FILES): RP1..RP4, CALLERS1. CALLERS2 lists every module allowed to import `lane-paths`, so a new unreviewed importer fails.
- e123a AC15, LANE_FILES is the single owner (the returned key count equals LANE_FILES.length): REG1, REG2.
- e123b0 AC1, `PRIMARY_LANE = "_primary"` export: AC1-1.
- e123b0 AC2, `resolveCurrentLane` pure-fs HEAD read over temp dirs (.git dir, gitfile with absolute or relative gitdir, detached HEAD, missing .git, malformed gitfile), never throws: CL1..CLn (table-driven).
- e123b0 AC3, TICKET_ID_RE accepts a trailing letter or digit suffix so ids like e123b0, b1, b9 resolve to themselves, the older examples and the `_legacy` fallback still hold, and `resolveLaneName` never returns `_primary`: RESOLVE_LANE_NAME_CASES additions plus the existing RN never-primary sweep.
- e123b0 AC4, `resolveCurrentLanePaths(ws)` equals `resolveLanePaths(ws, resolveCurrentLane(ws))`, zero behaviour change: CLP1..CLPn.
- e123b0 AC5, only reviewed modules call `resolveCurrentLane`: CALLERS3, an allow-list.

In-body blocks, with the detail dropped from beside the code: the AC6 regex test (ticket e123b8 J1) uses `{ timeout }` because measuring wall-clock milliseconds flakes under CI load; if TICKET_ID_RE regresses to a two-quantifier shape the test times out instead of passing slowly. The lock-path table is Decision 2 of T-E123B9-05. The allow-listed callers list (T-E123BI-01) grows because AC15 requires tools/dispatch-log.ts and tools/lane-migrate.ts to import from lane-paths.ts, and the write path, sidecars, prompt builder and bin/ hooks all go through `resolveCurrentLane(Paths)`. The base-sha consumers (ticket e125b AC11) call `resolveLanePaths(ws, lane).baseShaPath` directly, the same registry-derived path every other lane file uses, not a standalone composer. The lane-local task ledgers (ticket e125a AC1, AC10) have three importers: tools/tasks-lane-migrate.ts (PRIMARY_LANE, laneFile, resolveCurrentLanePaths, resolveLaneDir, resolveLaneName), tools/config.ts (resolveCurrentLanePaths; findTasksFile checks the lane path first and stays side-effect-free) and tools/tasks-file.ts (LEGACY_LANE, PRIMARY_LANE, resolveCurrentLanePaths, resolveLaneName).

## test/lane-paths-history.test.mjs

Spec: `specs/e125b-lane-close-writeback.md` (AC6, AC8, X7; task T-E125B-01). Spec-to-test map:

- AC6, `resolveHistoryBucket` returns a UTC YYYY-MM bucket; `resolveHistoryLaneDir` throws on a malformed bucket or an unsafe lane and never returns a path outside `.current/history/<bucket>/`: BUCKET1..BUCKET3, HISTDIR1..HISTDIR6.
- AC8, `hasHistoryLedger` is pure fs, scans every HISTORY_BUCKET_RE bucket and never throws: HASHIST1..HASHIST7.

The file is scoped to the pure, read-only resolvers. The fixture-driven proof that `agc feature finish --shipped` writes into `.current/history/<bucket>/<lane>/` lives in `test/agc-feature-finish-history.test.mjs` (AC1, AC9), and the read and refuse integration through `makeForeignCheck` in tools/tasks-file.ts (X7) lives in `test/e125a-lane-local-ledgers.test.mjs`, next to the lane-ledger fixtures it needs (e125a D12).

## test/lane-ticket-allocation.test.mjs

Spec: `specs/e124-lane-ticket-allocation.md` (AC1-AC8; task T-E124-01). Spec-to-test map (test names):

- AC1: "parsePendingTickets ignores NEW-TICKETS.md-shaped prose and extracts only fenced pending-ticket blocks".
- AC2: "parses N valid blocks"; "a malformed block is skipped and reported, siblings still parse".
- AC3: "allocateTicketIds assigns sequential ids across batches in input order".
- AC4: "resolves same-batch lane-local dependency to its allocated id"; "an unresolvable depends_on is surfaced in unresolvedDependencies, not silently dropped".
- AC5: "two sequential allocateTicketIds calls with re-derived currentMaxId never repeat an id".
- AC6: "extractMaxBacklogId counts suffixed ids by base number and ignores prose-embedded ids, using a fixed fixture".
- AC7: "detectOrphanLanes finds branches with a pending file whose worktree is gone, ignores branches without one"; "a branch-name vs lane-name mismatch does not falsely orphan a live branch".
- AC8: "markApplied archives the named entries and leaves the rest parseable".
- Below the map: boundary and security smoke tests (qa-engineer SOP Phase 3.d).

AC9 (allocateTicketIds and markApplied take no `disposition` parameter, so a finding filed on an abandoned lane applies identically to one on a shipped lane) is checked by reading the signatures, not by a runnable test: `dist/tools/lane-ticket-allocation.js` exports `allocateTicketIds(input)` with one parameter and `markApplied(fileText, appliedLaneLocalIds)` with two.

Deliberately untested, with the reason: two suspect behaviours (a pending-ticket block appended after an existing `## Applied` section is silently archived instead of reported, and a stray unmatched fence in prose silently swallows the next pending-ticket block). Asserting either of today's behaviours as correct would turn a bug into a contract; both are tracked as follow-up work (L-STATE-NEW-2, L-STATE-NEW-3, E124b).
