# Tests — e446-doc-writer-close (T-E446-01)

Spec: `specs/e446-doc-writer-close.md` (no ticket file; AC1–AC9 stand in as the scenarios).
Test-file placement: dispatch brief's `Test-file placement` line — create `test/e446-doc-writer-close.test.mjs` (pre-authorized) and re-pin `test/e408-core-task-alias-tail.test.mjs` AC6 only. No other existing file changed.

## Scenario → Test Map

| scenario | test file | exact test name | state now |
|---|---|---|---|
| AC1 | `test/e446-doc-writer-close.test.mjs` | `AC1: no line of the doc-writer SOP instructs a state write (raw file and both served texts); the only tw_update_state mentions are the two prohibitions` | red |
| AC2 | `test/e446-doc-writer-close.test.mjs` | `AC2: the Side-channel constraint line is exactly C-DW1, keeps the e437 anchor once, cites no tools/transitions.ts, and names the commit and the final reply` | red |
| AC3 | `test/e446-doc-writer-close.test.mjs` | `AC3: the step-4 CHANGELOG.md bullet is exactly C-DW2 and sends gaps to the final reply, not pending_notes` | red |
| AC4 | `test/e446-doc-writer-close.test.mjs` | `AC4: SOP step 6 is exactly C-DW3 (commit + Output rule line, no state write) and the Output rule line is byte-identical to base` | red |
| AC5 | `test/e446-doc-writer-close.test.mjs` | `AC5: every line but 15, 32 and 36 is byte-identical to the frozen base; 36 lines; step 1, headings and the empty error-code set are kept` | green (unchanged-line guard; must stay green) |
| AC6 | `test/e446-doc-writer-close.test.mjs` | `AC6: the old close (code-reviewer, PASS) -> (code-reviewer, *) and agent_id doc-writer are rejected by validateTransition; transitions.ts never names doc-writer` | green (server behaviour already right; must stay green) |
| AC7 | `test/e446-doc-writer-close.test.mjs` | `AC7: the ROLE_SKILL_MAP comment above "doc-writer" is exactly the six C-RT1 lines, in tools/role.ts and in the rebuilt dist/tools/role.js` | red |
| AC7 (re-pin) | `test/e408-core-task-alias-tail.test.mjs` | `AC6 (E435): role.ts comment reflects transitions.ts (release-engineer opens on the judge's code-reviewer:PASS); map still carries doc-writer and release-engineer` | red |
| AC8 | `test/e446-doc-writer-close.test.mjs` | `AC8: every line changed in skill-doc-writer.md is shippable text (no URL, repo-only path, bare ticket id, version label, or backtick error code)` | red |
| AC9 | — (command scenario) | judge runs `node scripts/test-lock.mjs -- npm test` and the owned-set `git diff --name-only 07a6d47 …` from the spec; GATE_REGISTRY 33 / pipeline 17 are pinned by existing suites | n/a |

Command-only parts the judge runs (not encoded in the resident test, to avoid pinning a lane base sha in a resident test — `docs/lane-protocol.md` §3 / qa SOP 4f):
- AC6: `git diff --quiet 07a6d47 -- tools/transitions.ts dist/tools/transitions.js` (the test pins the behaviour and the absence of `doc-writer` instead).
- AC7: `git diff -U0 07a6d47 -- tools/role.ts | grep -E '^[-+] ' | grep -vE '^[-+]\s*//'` prints nothing.
- AC8: the render glue count 0 for doc-writer is `test/render-structure.test.mjs` (listed in the AC8 proof); this test adds a lighter render check (each changed line served as its own line in both render paths).
- AC9: full suite + owned-set diff.

## Open Interface Details

- Served text through `buildPromptForRole("skill-doc-writer.md", "probe", ROOT, false)`: the bundle also carries the constitution and the live handoff state, which legitimately mention `tw_update_state(` and `pending_notes`. AC1–AC5/AC8 check only the doc-writer skill slice — from `# Skill: doc-writer` to the `\n\nRecommended model for this role:` hint the builder appends after the skill. `switchRole("doc-writer", ROOT).sop` is the skill alone and is checked whole.
- Base text: the 36 lines of `content/skill-doc-writer.md` at the cut are frozen as a literal array in the test (no git lookup). AC5 compares every line but 15/32/36 with it; AC8 derives "lines this lane changes" as the lines that differ from it and requires that set to be exactly {15, 32, 36}.
- Backtick-quoted error code: checked against `ALL_GATE_CODES` from `dist/gates/registry.js` (33 codes), not a generic SCREAMING_SNAKE regex, because `ALLOWED_TRANSITIONS` is a legitimately quoted non-code identifier in the file.
- Repo-only path regex for AC8: `(?:^|[\s\`("'])(?:tools|test|specs|docs|scripts)/` on the changed lines only (line 13's list is unchanged base text, per the spec).
- dist comparison (AC7): `tsc` re-indents comments (4 spaces in `dist/tools/role.js`), so the six `C-RT1` lines are compared with leading whitespace trimmed, contiguous, and directly above the `"doc-writer"` entry.
- AC6 also rejects `doc-writer` for every status (In_Progress, PASS, FAIL, Blocked), a small superset of the spec's minimum; the `allowed` list is compared order-insensitively.
- e408 AC6 re-pin: only the `want` array (five → six `C-RT1` lines), its assertion message (`five` → `six`) and one `E446 re-pin` comment line changed; every other assertion in that test and file is untouched.

## Red Reasons

- AC1 — `content/skill-doc-writer.md` still has the base close: `tw_update_state(` on line 36 (and `pending_notes`, `<upstream-caller>`, `next_role`) in the raw file and both served texts. Fixed by T-E446-02.
- AC2 — line 15 is the base Side-channel text, not `C-DW1`. Fixed by T-E446-02.
- AC3 — line 32 still sends CHANGELOG gaps to `pending_notes`, not `C-DW2`. Fixed by T-E446-02.
- AC4 — line 36 is the base `tw_update_state(...)` call, not `C-DW3`. Fixed by T-E446-02.
- AC7 — `tools/role.ts` still carries the five base comment lines; `dist/tools/role.js` not rebuilt. Fixed by T-E446-03.
- e408 AC6 (re-pin) — same: the six `C-RT1` lines are not in `tools/role.ts` yet. Fixed by T-E446-03.
- AC8 — no line differs from the frozen base yet (expected exactly 15, 32, 36). Fixed by T-E446-02.

Green at base (kept, by design): AC5 (unchanged-line, heading, step-1 and error-code guard) and AC6 (the server already rejects the old close and `doc-writer`; the task is to leave it so).

## Pre-check (scratch copy, not the lane)

The spec Copy blocks `C-DW1`..`C-DW3` and `C-RT1` were applied to a scratch copy of the worktree, `tsc` rebuilt `dist/`, and `test/e446-doc-writer-close.test.mjs`, `test/e408-core-task-alias-tail.test.mjs`, `test/e437-repo-only-paths.test.mjs`, `test/render-structure.test.mjs`, `test/e433-test-first-rules.test.mjs`, `test/e453-served-text-v5.test.mjs`, `test/skill-evolution-v3.11.test.mjs` ran: 90 tests, 87 pass, 0 fail (3 skipped). The tests are satisfiable by the spec text exactly as written.

## CI Runnability

Headless: `node --test`, no network, no human interaction; imports only `dist/` modules already built by `pretest`.
