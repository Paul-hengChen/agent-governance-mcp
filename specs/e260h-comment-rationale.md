# e260h comment rationale

Rationale moved out of long comment blocks in the `test/` files whose names start with m to z (`test/render-structure.test.mjs` excluded) and in the four `.mjs` files under `test/eval/`, by lane e260h of ticket E260 (spec: `specs/e260h-test-m-z-eval-comment-trim.md`). A trimmed comment keeps at most one pointer line, for example `// Rationale: specs/e260h-comment-rationale.md (test/verify-release.test.mjs).`, and the text it points to lives in the section named after its test file below.

Rationale that a tracked spec already holds is not copied here; the comment points to that spec instead. Only comments moved: no assertion, test name, assertion message or string changed.

## Retained blocks

Blocks of 8 to 20 counted lines that stay in the tests, each with a one-line reason (acceptance criterion AC5). The code-reviewer copies each reason into the review report of the task that owns the file. `line at HEAD` is the block's first physical line as printed by `node .current/e260h/proof.mjs --list-mid`; `counted` is the size `analyzeText` reports.

| file | line at HEAD | counted | reason |
|---|---|---|---|
| — | — | — | none: after T-E260H-24 every comment block in the owned files is 7 counted lines or fewer |

## test/release-staging.test.mjs

The release-engineer SOP has no server enforcement: the contract is the SOP wording reaching a low-tier agent, so this file pins that wording. Spec-to-test map at the time of the trim:

- explicit directory enumeration (AC1): the AC1 git-add-line test.
- pre-commit `git diff --cached --stat` (AC2): the AC2 verify-command test and fixtures A and B.
- inverted failure-mode wording, where source dirs are expected rather than blocked (AC3): the AC3 wording test.
- post-commit spec-file check and its conditional branches (AC4, backlog row E44, later range-corrected by E142(b) with a fourth MULTI-FEATURE branch): the AC4 test, fixtures C to K and the branch-exhaustiveness test.
- shim reinforcement hint of at most two sentences (AC5): the AC5 shim test.
- the file exercises its own fixtures (AC6); `npm test` green (AC7); version 3.22.1 (AC8, AC9) lives in `test/subagent-templates.test.mjs`.
- step 7a ticket-code set derivation (backlog row E49): the "E49 step 7a" block.

The step 7a derivation changed twice in review: first slug-hunting over commit prose, then committed history with `--diff-filter=A` (silently empty on two of the six releases checked), and finally an enumeration of the working tree with the git range used only as a membership predicate. The tests couple the derived set to the file content that shipped, not to substring presence.

`FEATURE_DIRS` history: `gates/` was added when `tsconfig.json` `include` gained `gates/**/*.ts`, because the AC-B5.5 guard is a set difference between `include` and this array. `docs/`, `research/` and `multi-agent-scripts/` were missing from the git-add line and the AC2 cross-reference set at cut time; `.github/` was missed because the `ls -d */` measurement used at the time hides dot-directories. None of the four are TypeScript roots, so repairing `include` (the `gates/` fix) cannot cover them, and none belong in `NON_SOURCE_DIRS`, since all four are tracked and feature-touchable.

Root-file completeness check (backlog row E94): `git status --short` was rejected in review because it also prints already-staged paths (`M ` against ` M`), so it fires the same way on a correct release and on the escape. The two adopted commands are a `git diff --name-only` of tracked unstaged files and an `ls-files --others` of untracked files, both excluding `.current`; the test extracts them from the SOP rather than holding a second copy, so a wording edit is exercised.

`release-engineer:Blocked` reachability (backlog row E53): before the fix, step 7a's empty-baseline guard and every Escalation Routes row told release-engineer to write `status=Blocked`, yet `tools/transitions.ts` had no such key and no edge into it, so the server would reject the write. The SOP also carried two claims that this was by design. E53 opened the edge, deleted both claims and turned step 7a's guard into a real Escalation Routes row; the D10 and release self-check rows were already pinned elsewhere, so this block covers the remaining rows only.

Dependency-audit waiver escape (backlog rows E57, E59, E48): the escape was restated in slightly different words at 9 live sites across 3 files, and three review passes each derived a different site count (5, 6, 7) before an enumeration by site settled on 9. E48 later deleted `docs/skills/`, which was never on the prompt path (prompts are composed from `content/` only), removing 8 of the 9 sites; only one of those 8 was a verbatim mirror, the rest were structures the live SOPs never had. Re-deriving from the tree, not from the deletion count, found 3 live sites never pinned before: the dependency-audit disposition mechanism in `content/skill-release-engineer.md`. Net 9 to 4, not 9 to 1. Every historical escape phrasing used the verb form "waived"; the retained sentences use "waive" or "waiver", so the content-wide sweep for "waived" has no legitimate positives to exclude and also catches a fifth site nobody has listed yet. The per-site replacement-text check catches a site being deleted or truncated, which would not bring "waived" back.

Step 7a derivation rounds (backlog rows E49, E50):

- E49 round 1 hunted ticket slugs in commit messages; on v3.95.0 it yielded a set disjoint from the right one, because shipped tickets appear in the range only as bare codes.
- E49 round 2 used committed history only; it returned nothing on two of the last six releases because `qa_reports/` evidence is usually untracked when step 7a runs (step 8's `git add` first commits it), and an empty result was a silent no-op.
- E49 round 3 (approved) enumerates root-level `qa_reports/` files in the working tree and uses the git range only as a membership test against the previous tag's tree; it was backtested against six releases. It left one hazard open: an empty or unresolvable previous-tag baseline makes the `grep -vxFf` filter pass its whole input through.
- E50 round 1 guarded that hazard with one global flag, which wedged any workspace that never produced `review_reports/`, and its zero-match log expanded an unbound variable on every release.
- E50 round 2 (shipped) bound the variable, split the flag per tree (`STOP_QA`, `STOP_RR`, `EXCLUDE_QA`, `EXCLUDE_RR`), and extended the predicate to `review_reports/` under a parallel archive directory, since the two trees share basenames.

Move-loop asymmetry pin (backlog row E76): E76 rewrote step 7a's move loops into one heredoc block sharing a `for c in $CODES` loop, with the `review_reports` side wrapped in an enclosing `if`. The earlier predicates looked for a literal `<CODE>` placeholder and an inline `&&` guard, so they died before reaching the guard assertions and silently stopped pinning anything. The test was retargeted rather than retired; code-reviewer did not block on the asymmetry in either round, and fixing it is not QA's scope.

## test/verify-release.test.mjs

The tests drive the real `scripts/verify-release.mjs`. The script resolves its own root from `import.meta.url` and runs every git check with that root as the working directory, so each test copies the script byte for byte into a temp fixture root and runs it against a fully controlled git repo whose "origin" is a local bare repo: no network and no mocked git output. Check 6 (CI ground truth) replaces only the external `gh` dependency, with a small executable shim placed on a temp PATH. The SOP-wording tests (VR-9, VR-10) follow the `test/release-staging.test.mjs` precedent, where the prompt text is the contract.

Spec-to-test map at the time of the trim:

| behaviour | tests |
|---|---|
| tag missing (AC1); tag exists, not at HEAD (AC2); no upstream, not pushed or fetch failure (AC3) | VR-1, VR-2, VR-3 |
| check-version fails with stderr propagated (AC4); CHANGELOG entry missing (AC5); dist uncommitted (AC6); committed dist parity mismatch (AC7) | VR-4 to VR-7 |
| all checks OK with an ALL PASSED line (AC8); SOP step 9a and its Escalation Routes row (AC9); `tw_get_state` read-back after the closing write (AC10) | VR-8, VR-9, VR-10 |
| security smoke on boundary inputs | VR-SEC-1 to VR-SEC-4 |
| Check 6 red or green at the release commit (backlog row E14) | VR-11, VR-12 |
| Check 6 degradation: `gh` missing, `gh` exits non-zero, zero completed runs, unparseable output | VR-13 to VR-16 |
| sha-matched ground truth (backlog row E78): green or red at a different commit WARNs; a matching red at position 8 of 10 still fails | VR-17, VR-18, VR-19 |
| bounded polling (backlog row E80): late run found, budget expires with the earlier WARN text, a zero wait makes one `gh` call | VR-20, VR-21, VR-22 |
| CI-wait default of 480 seconds, read from the script's own first poll-progress line rather than grepped from source (backlog row E82) | VR-23 |
| `--close-out` mode (backlog row E84): fails when HEAD is ahead of upstream, using a fixture a reversed range would pass; passes with `CLOSE-OUT PASSED` and never runs the other checks or resolves a version | VR-24, VR-25, VR-26 |
| tag-at-HEAD bookkeeping tolerance (`specs/e141-tag-at-head-bookkeeping-tolerance.md`): tag at HEAD with no note, a bookkeeping-only range tolerated with a NOTE, offenders named, a non-ancestor tag keeps the original FAIL, Check 2 still fails an unpushed bookkeeping commit | VR-28, VR-27, VR-2, VR-29, VR-30 |
| code-reviewer observations pinned as current behaviour: deleting an allowlisted path is tolerated; a non-ASCII allowlisted filename fails closed | VR-31, VR-32 |
| Check 6 release-sha resolution (`specs/e142-release-tooling-wave25.md`): resolves from the release tag, not a bookkeeping commit on top; falls back to HEAD when no tag exists | VR-33, VR-34 |

Merge handling and empty-range unreachability for the tolerance (AC6 of the E141 spec) were verified by the code-reviewer with separate fixtures and are not re-derived here.

Retargeted tests: when sha-matching landed, VR-11 and VR-12 had shimmed a dummy `headSha` that could never match a fixture's HEAD; under the old code (ground truth was the first run, sha unchecked) they passed for the wrong reason, and under sha-matching they would only WARN, so they now use the fixture's real HEAD. VR-17 and VR-18 drive the sha-not-found branch and pin `AGC_VERIFY_CI_WAIT_SECONDS=0`; without it the child inherits an unset variable and each test would wait the full default budget. VR-2 was re-pointed at `src/real-change.js` so the bookkeeping tolerance cannot satisfy it. VR-8's title once said five checks; its loop asserted OK lines by name, not by count, so it stayed green by accident when Check 6 was added.

The "no gh" PATH: a fixed `/usr/bin:/bin` worked on a macOS checkout but not on GitHub's hosted Ubuntu runner, which installs `gh` at `/usr/bin/gh`. There the real, unauthenticated `gh` exited non-zero, so VR-13 hit the auth-error branch (pinned by VR-14) instead of the missing-binary wording, and was red on every CI run until the PATH was built from the runner's own `git` location.

VR-9c (step 13a non-empty-stage check): the assertion proves that something was staged, not that everything was, and the test pins exactly that so the property is not later overclaimed as closing all partial-staging failures. Known gap, recorded rather than fixed: if `find` under-reports, for example when `.current/` is reached through a symlink (BSD `find` does not descend without `-L`), `handoff.md` still stages, the cached diff is non-empty, the check passes, and the `.jsonl` sidecars are left out of the bookkeeping commit; the next release's own 13a run sweeps them up. Since backlog row E143, step 8's release commit stages `tasks.md` and 13a's `git add` no longer names it; the guaranteed property does not depend on which paths that line names.

VR-47 exists because a comment in `scripts/verify-release.mjs` claims a drift-guard test pins the mirror between `LANE_SEGMENT_RE_SRC` and the lane-path helpers; the human asked for that test in code review.

## test/qa-flow.test.mjs

Every trimmed block here was cut to its plain-language core; the edge-by-edge reasoning lives in the specs the comments cite (`specs/pm-repair-resume-routing.md`, `specs/c9-protocol-fields.md`, `specs/c13-release-engineer-write-path.md`) and in `tools/transitions.ts`. Two points not held there:

- `design-auditor` after a PASS: the missing `qa-engineer:PASS` edge was seen in real use, where the first feature of a workspace opened fine and every later one was rejected.
- `qa-engineer:Blocked` to `pm` (backlog row E45): the dead end was recorded in `research/adopter-button-realign-qa-blocked-dead-end.md`. A purely additive row edit can land with the suite green unless something pins the row's exact membership, which is why the row-equality pin exists.

## test/prompt-state-footer.test.mjs

Footer cases: S01a (wrong path, visible), S01b (genuinely fresh), S02 (parse or migration error), S03 (recovery clause); de-dup layers L1 (in-memory set in the server) and L2 (the hook marker). Spec-to-test map for `specs/c6-c11-prompt-state-injection.md`:

| criterion | tests |
|---|---|
| AC-1 genuine fresh (S01b) | `t-s01b-*` |
| AC-2 wrong path visible, never a bare S01 | `t-s01a-*` |
| AC-3 parse or migration errors (S02) | `t-s02-*` |
| AC-4 workspace-resolution consistency: env threading, arg priority, cwd fallback, all through the real `index.ts` handler because `resolveWorkspacePath` lives there | `t-e2e-*` |
| AC-5 this file | whole file |
| AC-6 stale `prd_path` guard | `t-prd-*` |
| AC-7, AC-8 single delivery (L1 and L2) | `t-e2e-dedup`, `t-l2-*` |
| DR-5 S03 recovery clause not silent; DR-6 `buildPromptForRole` purity | `t-e2e-dedup`, `t-purity-*` |
| a normal handoff is unchanged | `t-normal-handoff` |

`resolveWorkspacePath`, the L1 set and `hookMarkerFresh` are not exported: `index.ts` runs a top-level IIFE that connects a stdio transport at load time, so importing `dist/index.js` in-process would take over the test runner's own stdin and stdout. The server-level tests therefore spawn the compiled server, as `test/teamwork-lite.test.mjs` does.

Map for `specs/d1-prompt-arg-workspace-fallback.md`: AC-1 (a non-path arg falls back) `t-d1-ac1`; AC-2 (an existing-dir arg is unchanged) is covered by the third fetch of the e2e de-dup test; AC-3 (path-shaped but missing) `t-d1-ac3`; AC-4 (the end-to-end repro) `t-d1-ac4`; AC-5 (absent arg unchanged) `t-d1-ac5` plus every earlier case with empty arguments.

Map for the workspace normalization tests (AC2): bare `~`, `~/x`, a relative path and an absolute path (the contrast case), each its own `AC2/...` test. On POSIX `os.homedir()` reads `HOME`, so the tilde fixtures override it to a throwaway directory under the temp dir, never the developer's real home.

## test/reviewer-completed-tasks-gate.test.mjs

Spec-to-test map for `specs/c16-c10-role-boundary.md` AC-3:

| behaviour | tests |
|---|---|
| a non-empty `completed_tasks` on a code-reviewer write is rejected, in file mode and in SQLite mode | FM1, SQ1 |
| the Phase-2 claim write with `completed_tasks=[]` is unaffected, both modes | FM2, SQ2 |
| `completed_tasks` omitted entirely (zod default) through the full `TOOL_REGISTRY` dispatch does not crash | FM3 |
| the APPROVED row with `agent_id=qa-engineer`: the new gate does not fire and `MISSING_REVIEW_EVIDENCE` still does (file mode, re-pinned after the gate-hardening amendment so review scope travels in `review_task_ids`) | FM4, FM5 |
| the same row in SQLite mode keeps the pre-amendment `completed_tasks` shape, because `QA_COMPLETION_EVIDENCE_MISSING` is file-mode only | SQ3 |
| the gate widened to every non-qa identity (backlog row E40; the backlog row is the spec): `NON_QA_COMPLETED_TASKS_REJECTED` for sr-engineer, pm, architect, researcher, design-auditor and release-engineer, while code-reviewer keeps its unchanged envelope and qa-engineer keeps the evidence path | FM6 to FM11 |
| the bypass: a non-qa prefill is rejected at the first write, and the evidence gate is still armed for the genuinely new id afterwards | BYPASS-FM, BYPASS-SQL |

The gate is storage-agnostic on purpose: it reads only the parsed arguments, with no file-storage guard, so it must fire the same way on both backends, and the tests pin both rather than trusting a code read. The pipeline-order hazard behind the self-loop seeding was flagged by the code-reviewer of E40: seeding `pm:In_Progress` without `cut_approved` and writing as architect would hit `CUT_APPROVAL_REQUIRED`, and a `doc-writer` write would hit `AGENT_ID_REQUIRED`, since it is not an agent name in `tools/transitions.ts`. The self-loop is accepted before the table lookup and before every build-entry gate. The bypass shape is the code-reviewer's end-to-end reproduction; in the evidence step the qa_review-recording step runs before the completion-evidence gate by design, which is why WRITE2 carries no `qa_review`.

## test/stale-dispatch-detection.test.mjs

Spec-to-test map for `specs/d5-server-side-stale-dispatch-detection.md` and its architecture:

| criterion | tests |
|---|---|
| AC-1 stamp persisted on dispatch, on the server rather than in memory | T1, T1b |
| AC-2 staleness surfaced on read, not enforced on write | T4, T4b, T5, T6 |
| AC-3 stamp cleared or replaced by the dispatched role's write | T3 |
| AC-4 detection from a completely fresh context: the signal is derived from a hand-written fixture and the wall clock, never from a write this process made | T4 |
| AC-5 no false positive within the threshold, including the exact boundary | T5, T5b |
| AC-6 feature-scoped, no bleed | T7 |
| AC-8 the other handoff semantics stay byte-identical (every sibling test file keeps passing unmodified) | T10 |
| AC-9 SQLite scope explicit: file mode only | T9 |
| AC-10 the v9 to v10 migration only stamps and seeds nothing | T8 |

The mechanism makes coordinator-memory bookkeeping durable, which is why no test relies on in-process memory of an earlier write. `isReleaseClosingWrite` was extracted from the feature-lease gate so it has exactly two callers, `isFeatureLeaseHeld` (pinned in `test/feature-lease.test.mjs`) and the stale-dispatch advisory in `tools/handoff-parse.ts`; the E97-A tests pin the predicate itself and the E97-B tests pin the wiring through `readHandoffState`. The predicate's design is in `specs/e13-terminal-marker-advisory.md`.

## test/skill-manifest.test.mjs

Spec-to-test map for `specs/d6-host-capability-compose-axis.md`: AC1 (`taskTool:true` includes host fragments) `t-full-includes-host`, `t-golden-byte-identity`; AC2 (`taskTool:false` excludes them) `t-lean-excludes-host`, `t-lean-exact-core-concat`; AC3 (absent or unknown signal defaults to lean) `t-hostcaps-default-lean`, `t-buildPromptForRole-default-lean`; AC4 (segment shape reuse) `t-includeSkillSegment-pure`; AC5 (golden byte identity) `t-golden-byte-identity`; AC7 both host states, whole file. `composeSkill` precedence: a whole-file `.current/` override bypasses host filtering (`t-override-bypass-lean`, `t-override-bypass-full`); registry fragments are filtered by predicate (the AC1 and AC2 tests); an unsplit skill passes through whole (`t-unsplit-passthrough`, `t-switchRole-unsplit-host-independent`). An explicit config `host` wins over the in-server lean default (`t-config-host-precedence-*`); the hook's structural default is the caller's concern.

Strip parity (backlog row E51, the backlog row is the spec): AC1 no marker in switchRole output for any role (`t-e51-switchRole-marker-free`, `t-e51-witness-fences-exist-in-source`); AC2 compose-golden fixtures byte-identical (`t-golden-byte-identity` and `test/compose-equivalence.test.mjs`; a differing fixture is a failure, never regenerated); AC3 strippers still importable from `build.js` (`t-e51-build-reexport-surface`); AC5 the hook path deliberately untouched (`t-e51-hook-remains-non-caller`); the shared-pass `fullDetail` contract, frontmatter surviving the strip and the whole-file override also stripped (`t-e51-applyTextTransforms-contract`, `t-e51-frontmatter-survives-strip`, `t-e51-override-is-stripped`).

## test/qa-visual-skill-split.test.mjs

Size-cap history. v3.14.0 relaxed both budgets: `skill-qa-engineer.md` gained a PASS-gate paragraph in the Phase 1.5 hook (about 600 bytes) and the visual sub-skill gained the widget shape checklist (about 1800 bytes), exceeding the v3.8.3 cap of 2400 bytes by design. The savings invariant against the v3.8.2 baseline still holds: the QA SOP was 8660 bytes before the split, a number that is informational only.

- `skill-qa-engineer.md`: raised over time for `covers:` batching, the Expected-Red Diff phase, `review_task_ids`, the bugfix-mode branch, AC execution, long runs and the crash checkpoint, and most recently (15500 to 17900, measured 17512) for the "Contract Defect vs Implementation Failure" section and its Escalation Routes row.
- `skill-qa-visual.md`: 9000 to 15000 in v3.36.0 (carry-forward gate and deterministic pixel-diff pre-screen, about 5400 bytes); 15000 to 16200 in v3.38.0 (baseline-provenance rules and the fidelity baseline scope guard, measured 15804); 16200 to 17600 in v3.39.0 (the baseline source-of-truth step, which copies the design-auditor manifest's frozen node-id list and forbids URL re-derivation, measured 17247); 17600 to 18100 in v3.40.0 (the baseline-manifest gate's server-enforcement note, measured 17928); 18100 to 20700 in v3.42.0 (pixel-gate attestation additions, measured 20180).

## test/source-credibility-gate.test.mjs

Modelled on `test/baseline-manifest-gate.test.mjs` (parser and predicate composition, no server spawn) and `test/cut-approval-gate.test.mjs` (resume safety, storage-mode skip, verbatim hint, compose stop-condition). Spec-to-test map for `specs/e4-design-source-credibility-gate.md`:

| criterion | tests |
|---|---|
| AC-1 credibility attestation on audited rows | T1, T2, T4, T5, T6, T7, T12 |
| AC-2 the existing STOP is unchanged (guarded by the design-auditor SOP prose, no code path here) | none |
| AC-3 the gate blocks on a missing or wrong attestation | T3, T5 |
| AC-4 dormant outside the fetch-based mode, with no design file or no Source section | T8, T9a, T9b |
| AC-5 independent of the baseline-manifest gates | T6, T7 |
| AC-6 pinned to a pm predecessor (resume safety) | T10 |
| AC-7 storage-mode agnostic | T11 |
| AC-8 hint format and byte-exact S02 | T13 |
| AC-9 coordinator Auto-Routing stop-condition | T14 |
| AC-10 build gate | the build, audit and test run, not a unit test |

## test/token-budget-config.test.mjs

Spec-to-test map for `specs/b9-token-budget-brake.md`: AC1 (absent key or file disables the brake) `t-ac1-absent-key`, `t-ac1-absent-file`; AC4 (non-positive or non-finite values filtered to absent, non-fatally) the `t-ac4-*` cases: string, negative, zero, infinity from overflow, null, empty string, numeric-looking string, and a valid positive control; AC6 (byte-identical for workspaces without the key) `t-ac6-existing-fields-untouched`, `t-ac6-never-created-file`.

NaN is not tested: JSON has no NaN literal, so `JSON.parse` can never hand `loadConfig` a NaN for this field (an unquoted `NaN` makes the whole document a parse error, a different failure). The `Number.isFinite` guard that would reject it was checked by the code-reviewer by reading the source rather than by a test fabricating an unreachable input. Infinity is reachable through numeric overflow such as `1e400` and is tested.

## test/skill-evolution-v3.11.test.mjs

Handoff schema history behind the version assertion: v6 `external_refs` (b8-external-ref-ledger); v7 `next_role`, `resume_of`, `review_verdict`, stamp-only (c9-protocol-fields); v8 `dispatch_pins`, stamp-only (c14-dispatch-pins); v9 `hop_count`, seeded 0 (d2-server-brake-accounting); v10 `dispatched_at`, stamp-only (d5-server-side-stale-dispatch-detection); v11 `dispatch_mode`, the feature-scoped carry-forward but scalar (e2-bugfix-repro-gate); v12 the three cumulative round totals, seeded 0, file mode only (e8-success-telemetry); v13 the `evidence_schema` pin (e23-evidence-schema-versioning); v14 `cut_approved_source` (e114-cut-approval-inheritance); v15 `dispatch_mechanism` and `dispatch_mechanism_tier` (e123a-lane-layout-migration). From v13 on each is stamp-only and uses the `dispatch_mode` scalar algorithm. SQLite stays at version 2: `hop_count` is added there through an idempotent `addColumnIfMissing` ALTER with no `schema_meta` bump, the mechanism `visual_round` used; every other field above lives only in the handoff YAML frontmatter, with no SQLite column.

The pending-notes token sweep covers the 13 files the c9-protocol-fields spec lists; most have narrower assertions elsewhere (compose goldens, context-budget caps, the phase-0.5 SOP test, the qa-visual split test, the pixel-perfect compare test), but `skill-code-reviewer`, `skill-release-engineer`, `skill-design-auditor`, `skill-doc-writer` and `skill-researcher` have no other test for this convention.

## test/telemetry.test.mjs

Spec-to-test map for `specs/d3-gate-fire-telemetry.md`: AC-1 a rejection emits exactly one 5-key line (INT1); AC-2 a pass emits nothing (NE1); AC-3 the directory is auto-created (SHAPE1, implicitly: every emit call starts from a workspace with no `.current/`); AC-4 a telemetry throw never masks or alters the real result (THROW1, THROW2); AC-5 `gate` comes from the `GATE_REGISTRY` producer, not re-derived (SHAPE1, PRODUCER1, PRODUCER2, UNKNOWN1); AC-6 a fixed 5-key shape where nulls are kept and never "undefined" (SHAPE1, NULL1, NULL2, BOUNDARY1); AC-7 best-effort append with no lock, verified by code inspection, not unit-testable; the `extractGateCodeFromText` helper (EXTRACT1 to EXTRACT4). The human-approved cut asked for this file because no telemetry coverage existed for the emit point.

THROW2 fixture: since the lane-aware path resolution, `readAndMigrate` does its own `readFileSync` with only ENOENT swallowed, so a non-directory `workspace_path` throws ENOTDIR inside the handoff read, before the gate and telemetry code the test isolates.

## test/success-metrics.test.mjs

Dedupe-guard map (`specs/e11-e12-release-integrity-batch.md`): the same feature and version dispatched twice gives one line (AC7, E12-D1); a version change between dispatches gives two lines (AC8, E12-D2); a pre-existing malformed line does not crash the guard (AC10, E12-D3); a null `released_version` dedupes against null only (AC9, E12-U1); the same version under different features does not collide (AC6, AC8, E12-U2); an unreadable `metrics.jsonl` fails open and appends (AC10, AC11, E12-U3).

## test/pixel-gate-attestation.test.mjs

AC map for `specs/qa-visual-pixel-gate-attestation.md`: PD1 to PD11 cover the placeholder set, null, whitespace and case variants, and non-placeholders (AC-1, AC-10); PA1 to PA8 cover attestation detection, the AC-3 label-line variants and edge cases; PR1 to PR4 cover the `pixelGateComplete` field; CK1 to CK10 cover the composition helper and the gate decision tree (AC-2, AC-4, AC-5, AC-7, AC-8); E1 to E5 cover the verbatim error strings (AC-9). Carry-forward surfaces are exempt from attestation (AC-4); a B1 LLM-fallback surface still needs `pixel_gate_complete: true` (AC-5); the gate is dormant on a non-armed or no-design workspace (AC-7) and on a legacy report with no `baseline:` line (AC-8).

## test/eval/scenarios.mjs

Each scenario's assertions close over the expected role and tier, so the runner only calls `scenario.assertions.map((check) => check(reply))` without knowing each checker's arguments. Bundles are built from the frozen fixture workspace, never this repo's own live handoff. An unknown role throws at import (matching the fail-loud `loadBundle` contract) rather than deep inside the paid live run.

Coverage (the spec's minimum): sr-engineer task completion, a qa-engineer PASS reply, pm escalating ambiguity to Blocked, code-reviewer CHANGES_REQUESTED, and one lite haiku-tier scenario for the watermark-omission class; researcher and architect round out the role coverage.

Every task's last line names the dispatch's role and tier for the watermark, as a real coordinator Task dispatch names the pinned tier (constitution section 1, pin override). That is dispatch metadata a real call carries, not coaching on content, so each scenario tests behaviour induced by the bundle and task rather than an under-specified prompt.

## test/eval/run-eval.mjs

Order of operations: the API key check comes first, before any dynamic import, so a missing key exits non-zero with a one-line error naming the variable and having done no work (no SDK load, no bundle assembly, no network call, no silent skip); `scenarios.mjs` and the SDK are imported dynamically after it for that reason. Every tier is resolved to a model id before the first call, so an unknown tier fails at zero spend. Scenarios run sequentially; retry and backoff are out of scope, so an API error marks that scenario FAIL and the run continues to a full report. The only filesystem reads happen in the scenario import (`dist/`, `content/`, the fixture workspace), all read-only, and no `tw_*` tool is called.

## test/usage-accounting.test.mjs

Spec-to-test map for `specs/d2-server-brake-accounting.md`: AC-5 (a durable, out-of-band usage record, not hand-summed) `t-append-*`, `t-hook-writes-record`; AC-4 (after a crash or compaction a fresh read rebuilds the feature's token total from disk) `t-crash-*`; AC-7 (no duplicated or conflated telemetry streams: key sets disjoint from `telemetry.jsonl`) `t-ac7-*`; AC-9 (opt-in: without `tokenBudgetPerFeature` there is no behaviour change and no sidecar write) `t-hook-noop-*`. The hook tests spawn the real `bin/` script with real stdin payloads; crash survival is the property that motivated the feature. The fan-out test (AC6 of e123c) builds the same three-source layout as the gate-stats aggregation tests of e26-gate-stats.

## test/schema-versions.test.mjs

The handoff and SQLite history is the one listed under `test/skill-evolution-v3.11.test.mjs` above. Two further notes: v9 `hop_count` is a sibling of the round counters, seeded 0, not a stamp-only attestation, and v12's round totals are likewise seeded rather than stamp-only. The tasks schema v2 is stamp-only: the step leaves the body untouched, and the meaning of v2 is which path the file lives at (e125a-lane-local-ledgers). The config schema v2 added the optional `artifacts` key, stamp-only, seeding nothing (e106-init-artifacts-flag).

## test/watermark-check.test.mjs

Spec-to-test map for `specs/subagent-watermark-parent-validation.md`: the `validateWatermark` contract (AC3) is covered by `t-present-correct`, `t-absent-appends`, `t-hyphen-treated-absent`, `t-wrong-name-treated-absent`, `t-wrong-tier-treated-absent`, `t-whitespace-tolerant`, `t-empty-reply` and `t-idempotent`; the required fixtures (AC5) are a subset of those; no regressions and a pure function (AC6) are `t-no-io-imports` and `t-buildWatermark-format`. The fixtures encode Decisions 2 and 3 of the spec.

## test/qa-review-scoped-append.test.mjs

A real write carrying `qa_review` used to append that text into the evidence file, or SQLite row, of every open task rather than only the reviewed one. Spec-to-test map for `specs/d9-qa-review-scoped-append.md`: AC1 (a FAIL with `review_task_ids=["T-X"]` touches only T-X) FM1 in file mode, SQ1 in SQLite mode; AC2 (a PASS with `completed_tasks` behaves as before) FM2, SQ2; AC3 (both empty gives `QA_REVIEW_TARGET_REQUIRED` and records nothing) FM3, SQ3; AC4 (with N open tasks exactly one evidence file or row changes) FM1 and SQ1, since the many-open-tasks shape that broke is the AC1 test. AC5 (the read side is untouched) is a design property checked in code review. The spec's Dependencies section allowed a new test file.

## test/repro-first-gate.test.mjs

Spec-to-test map for `specs/e2-bugfix-repro-gate.md`:

| criterion | tests |
|---|---|
| AC1 default routing with no architect hop | none: chain and SOP mechanics, not server-enforced (the spec's Out of Scope) |
| AC2 the gate blocks the fix-phase write | G1, G2 |
| AC3 strict PASS is load-bearing in bugfix mode | the QA SOP wording (S3); the machine floor is `EXPECTED_RED_DIFF_MISSING`, covered in `test/gates-expected-red.test.mjs` |
| AC4 opting back into the full chain (feature mode) | D6 |
| AC5 feature-mode chains unchanged | G3 |
| AC6 a clean rejection, never a silent skip or throw | G1 (message), G4 (the Blocked escape is never gated) |
| `dispatch_mode` parse, emit and carry-forward | D1 to D6, Z1, M1 |
| file mode only (SQLite ignores the field) | G5 |
| SOP wording of the repro-first rule | S1, S2, S3 |
