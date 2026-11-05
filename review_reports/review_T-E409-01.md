# Review — T-E409-01

covers: T-E409-01, T-E411-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Scope: commit `ad2e1f1` (diff `fb44b61..ad2e1f1`), feature `e409-lite-wording-const-header`, spec `specs/e409-lite-wording-const-header.md`. No architecture spec exists for this feature.

## Summary
- `content/skill-coordinator-lite.md` line 16: the lite "Server-read-only" hard rule now lists only `tw_update_state` / `tw_complete_task` as server-rejected, and `tw_add_task` / `tw_rollback_task` / `tw_void_task` / `tw_switch_role` as SOP-forbidden (E409 option (a)).
- `content/const-01-core-head.md` line 1: `# Constitution v3.41.0 <!-- versioned independently of package.json -->` becomes `# Constitution` (E411 option (b)).
- 2 files, +2/-2. Both content edits match the spec byte for byte and are factually correct against the handler sources. No other file changed, and `dist/` is unchanged after a build.
- Verdict: CHANGES_REQUESTED. The commit leaves 18 tests red on purpose, but `qa_reports/expected-red_e409-lite-wording-const-header.txt` does not exist. SOP step 4a makes that a required finding. The content diff itself needs no change.

## AC Completeness
Only AC1 and AC3 belong to these two sr tasks. AC2 and AC4–AC8 belong to the qa tasks T-E409-02, T-E411-02 and T-E409-03, which come after this hop.
- AC1 — implemented — `content/skill-coordinator-lite.md:16` is byte-identical to Copy / Strings `lite.16`. I checked this by extracting the string from the spec table and comparing it to line 16 in Python: `True`. The file has 52 newline-terminated lines, and the diff touches line 16 only.
- AC2 — not in this hop's scope (qa-authored test). The facts behind it hold; see Correctness.
- AC3 — implemented — `content/const-01-core-head.md:1` is exactly `# Constitution`. The file has 36 newline-terminated lines, lines 2–36 are not in the diff, and `grep -rn "versioned independently" content/` finds 0 hits.
- AC4–AC8 — not in this hop's scope (qa: re-pins, golden recapture, budgets, lane hygiene).

## Correctness
- **required** — Expected-red manifest missing (SOP step 4a). The diff intentionally leaves 18 top-level tests red until qa re-pins them in T-E409-02 / T-E411-02. `qa_reports/expected-red_e409-lite-wording-const-header.txt` does not exist. QA Phase 0.5 compares this manifest against the actual suite run, and a prose list in the spec or the commit message does not replace it. Fix: write that file with the entries below (format `<relative test file path> | <exact test name>`). No content change is needed. All 18 were observed red in `node scripts/test-lock.mjs -- npm test` on `ad2e1f1` (`# tests 4042`, `# pass 4022`, `# fail 18`, `# skipped 2`):
  ```
  # E411: const-01 line 1 is now "# Constitution". The 11 goldens are recaptured by qa in T-E411-02.
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-coordinator-lite.md, design=false, fullDetail=false) is byte-identical to pre-refactor golden build-lite-nondesign.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-coordinator-lite.md, design=true, fullDetail=false) is byte-identical to pre-refactor golden build-lite-design.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-coordinator-lite.md, design=false, fullDetail=true) is byte-identical to pre-refactor golden build-lite-nondesign-fd.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-coordinator-lite.md, design=true, fullDetail=true) is byte-identical to pre-refactor golden build-lite-design-fd.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-sr-engineer.md, design=false, fullDetail=false) is byte-identical to pre-refactor golden build-full-nondesign.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-sr-engineer.md, design=true, fullDetail=false) is byte-identical to pre-refactor golden build-full-design.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-sr-engineer.md, design=false, fullDetail=true) is byte-identical to pre-refactor golden build-full-nondesign-fd.txt
  test/compose-equivalence.test.mjs | compose-equivalence: buildPromptForRole(skill-sr-engineer.md, design=true, fullDetail=true) is byte-identical to pre-refactor golden build-full-design-fd.txt
  test/compose-equivalence.test.mjs | compose-equivalence: SessionStart hook (lite/default env) is byte-identical to pre-refactor golden hook-lite.txt
  test/compose-equivalence.test.mjs | compose-equivalence: SessionStart hook (AGC_DEFAULT_SKILL=full) is byte-identical to pre-refactor golden hook-full.txt
  test/compose-equivalence.test.mjs | compose-equivalence: cat(15 manifest fragments in order) === the pre-refactor constitution.md monolith (DR-1 Option R invariant)
  # E411: header-shape pins. qa re-pins them in T-E411-02.
  test/constitution-deliverable-guard.test.mjs | A3 (t-a3-version-header): header matches v3.x.y pattern and is not stale v3.14.1
  test/e393-builder-judge-core.test.mjs | AC-C01: Limits table has the visual_split row
  test/prompt-state-footer.test.mjs | AC-4/AC-7/AC-8/DR-5/e2e: env threading, arg-priority-over-env, L1 same-process dedup, and the S03 recovery clause
  test/prompt-state-footer.test.mjs | C11/AC-7 L2 fail-safe: stale (>120s), malformed, and absent markers all degrade to a full emit
  test/teamwork-lite.test.mjs | AC2: prompts/coordinator-lite.ts exports buildCoordinatorLitePrompt
  test/teamwork-lite.test.mjs | AC3b: GetPromptRequestSchema dispatches 'teamwork-lite' correctly
  # E409: lite line 16 wording. qa re-pins it in T-E409-02.
  test/e391-prompt-audit-stale-facts.test.mjs | AC-G2-11: lite says four write tools server-rejected, tw_switch_role SOP-forbidden
  ```
  (The parent test `constitution-deliverable-guard (v3.27.0)` fails only because its A3 subtest fails. It is counted in the 18; whether to list it separately depends on QA's Phase 0.5 matching.)
- No other correctness findings. Handler facts checked against the source, with no reliance on line numbers:
  - `tools/tasks.ts` `handleCompleteTask` calls `enforcePreFlight` and then `requireQaEngineer` (lines 71–72). `requireQaEngineer` (`tools/transitions.ts:141–145`) allows only `agent_id === "qa-engineer"`, so the claim "server-rejected" is correct.
  - `handleRollbackTask` (line 81), `handleVoidTask` (line 89) and `handleAddTask` (line 95) call `enforcePreFlight` only, with no agent gate. Calling them "SOP-forbidden" (not server-rejected) is therefore correct.
  - `tw_update_state`: the first step of `UPDATE_STATE_GATE_PIPELINE`, `TRANSITION_VALIDATION`, calls `validateTransition` (`tools/handoff-orchestrator.ts:214`). That function returns `AGENT_ID_REQUIRED` when `next.agent === null` (`tools/transitions.ts:374–376`), and also for an unknown agent id. A lite write, which carries no `agent_id`, is therefore server-rejected.
  - `tw_switch_role` is context loading only, with no server gate, so "SOP-forbidden" is correct.
- Observed reds match the spec's Trial set exactly: the 7 tests in 5 files plus the 11 golden byte-identity tests. Each failure location confirms it is caused by the header or wording edit (for example, e393 `test/e393-builder-judge-core.test.mjs:136` fails with "AC-D1: header bumped to v3.41.0"; teamwork-lite `:84` / `:129` fail with "loaded constitution"; prompt-state-footer `:399` / `:469` fail with "must carry the full constitution"). **No red falls outside the expected set.**

## Quality
No findings. Both edits are one line each. The lite line keeps the existing `/`-separated, backticked list style and the "Server-read-only." label (renaming that label is out of scope per the spec). The diff adds no comments; it removes one HTML comment from const-01 line 1, so step 4b has nothing to check.

## Architecture
No architecture spec exists for this feature (mini-chain, no architect). Ownership holds: sr touched `content/` only, and all `test/` and golden changes are left to qa, as spec Dependencies §2 requires.
- `dist/`: `npm run build` exits 0, and afterwards `git status --porcelain` lists only `.current/e409/dispatch.jsonl` and `.current/e409/handoff.md` (governance state). `dist/` is unchanged.
- Header parser audit: grep of `prompts/ bin/ lib/ tools/ scripts/ gates/ transport/ index.ts` for `# Constitution`, `Constitution v`, `Constitution\s+v`, `^# ?Constitution`, `startsWith("# Constitution`, `v3.41.0`, `versioned independently`, `server-rejected` and `SOP-forbidden` finds nothing that reads the header's shape or version. The only hit is a comment at `index.ts:8` that mentions the word "constitution", not the header. No runtime code depends on the removed version.

## Security
No findings. This is a prose-only change to prompt content: no input surface, no secrets, no new trust boundary. The E409 edit makes the SOP more honest: it no longer claims a server guard on `tw_add_task` / `tw_rollback_task` that does not exist. Adding that guard (option (b)) is explicitly out of scope.

## Performance
No findings. Prompt size goes down slightly: the spec's trial budget shows lean −10, stripped −15, non-design −14 and teamwork −14 ~tok. Budget verification (AC7) belongs to qa in T-E409-03. Note for qa and the integrator: the spec flags that the design-only strip saving floor drops to exactly 1999 against a floor of ≥ 1999, which is zero margin.

## Verdict
CHANGES_REQUESTED — the content diff is correct and complete for AC1 and AC3, but the commit intentionally leaves 18 tests red without the required `qa_reports/expected-red_e409-lite-wording-const-header.txt` manifest (SOP step 4a). Add the manifest with the entries above; no change to `content/`.
