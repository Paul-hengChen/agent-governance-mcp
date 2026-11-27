# Tests — e466-conductor (qa-engineer, T-E466-01..05)

Inputs: `docs/tickets/E466.md` S1–S9, `specs/e466-conductor.md` (Build contract, Copy / Strings),
`specs/e466-conductor-architecture.md` @ f690d63d (Interface Contracts, ConductorDeps, decision table, Open Questions
followed as written).

Test-file placement: dispatch brief's `Test-file placement` line — new files `test/e466-*.test.mjs` and fixtures under
`test/fixtures/e466/**` (pre-authorized); owned re-pins only in the five files the cut lists.

## Scenario → Test Map

| scenario | test file | exact test name |
|---|---|---|
| S1 | `test/e466-prompt.test.mjs` | S1: the prompt list holds fourteen prompts with conductor appended last, and tw_switch_role rejects conductor as a role |
| S2 | `test/e466-prompt.test.mjs` | S2: the composed conductor prompt states the loop (fan-out <record> first, 接手 <manifest> + wave later, notify and stop after the last wave, never another manifest) and the SOP has no tw_update_state |
| S3 | `test/e466-window-state.test.mjs` | S3: open --manifest <m> --wave 2 opens one window, sends the integrator prompt line then 接手 <manifest>，開始第 2 波次 with the launcher's send method and records the window id; close sends /exit to that window only |
| S4 | `test/e466-window-state.test.mjs` | S4: a fresh conductor reads the same manifest, wave, window id and step from agc-conductor.json in the git common dir, which is not tracked; an unparseable state is refused, not overwritten |
| S5 | `test/e466-wave-done.test.mjs` | S5: a wave-done report with an unmet fact keeps the integrator and replies naming it; with every fact met (merged, or open under pr-open) the integrator is closed, finished lane windows closed, the next wave's integrator opened; after the last wave nothing opens |
| S6 | `test/e466-wave-done.test.mjs` | S6: when the integrator window no longer exists and no wave-done report arrived, check reports integrator gone with its wave and opens no window |
| S7 | `test/e466-prompt.test.mjs` | S7: the conductor SOP wakes the paused integrator and paused-stopped lanes after its own automatic continue, and paused-weekly lanes only after the human says the weekly limit reset |
| S8 | `test/e466-integrator-sop.test.mjs` | S8: the integrator SOP reports wave-done to the conductor's mailbox at the waveDoneAt moment, carries pr-open waiting lanes itself, and no longer re-runs the launcher after a usage limit resets |
| S9 | — (device-or-person) | judge / person runs `qa_reports/manual-verification_e466-conductor.md` |

Select one scenario: `node --test --test-name-pattern "^S<n>:" test/e466-*.test.mjs`.

Fixtures (`test/fixtures/e466/`): `harness.mjs` (ConductorDeps stand-ins: FakeDriver, FakeClock, recording
`prState` / `handoffCheck` / `closeFinished`, temp git primary with a two-`波次` manifest built by the e443b
`manifestText`, wave-done report writer in `mailbox-watch.mjs` block format), `discussion-record.md`,
`wave-done-report.md` (lane-protocol §5 session-report body), `skill-conductor.expected.md` (`sop.conductor` frozen
verbatim), `integrator-relaunch.expected.md` (`integrator.relaunch` frozen verbatim).

Re-pins (owned, Probe table round 3): `test/e178a-integrator-role.test.mjs` AC3 (14 entries, spec-workshop 13th,
conductor tail), AC5 (CLAUDE.md `14 registered` / `Fourteen` / `the other twelve` / `the other 13`, `conductor`
listed, no stale 11/12/13), AC17 (regex now asserts skill-frontmatter's 14; green); `test/e423-spec-workshop.test.mjs`
AC1 (14 entries, conductor after spec-workshop); `test/e428-tracker-mirror.test.mjs` integrator base sha
`908fa6a0…` → `89bc41fc…` (base with `integrator.relaunch` in place; computed from the current file with the old
sentence replaced — verified the old sha reproduces first); `test/e443b-served-text.test.mjs` A2-19 (`sop.launcher`
with `integrator.relaunch` in place; asserts the usage-limit moment is gone); `test/skill-frontmatter.test.mjs`
count 14.

Pre-check: in a scratch copy with only `integrator.relaunch` applied to the integrator SOP, S8, e443b A2-19, e428
(all), e410, e430, e443a and e349 pass — so the S8 text and the integrator re-pins are satisfiable together with the
unowned / forbidden pins.

## Open Interface Details

- Test files split by surface (architecture's recommended names): prompt (S1/S2/S7), integrator SOP (S8),
  window + state (S3/S4), wave-done + check (S5/S6).
- S3–S6 are driven through `runConductorCli(argv, deps, cwd)` (the script's own entry, §E) with `cwd` = primary and
  `--manifest` given as an absolute path; the take-over line and the state must carry the primary-relative key.
- Window writes are asserted as `sendText` pairs (`[text,false]`, `["",true]`), so "the send method the launcher
  uses" is checked behaviourally, not by import.
- `fact.handoff`'s `<manifest>`: asserted by prefix / suffix and that the line contains the manifest key — works
  whether the implementation prints the key or the absolute path (cut leaves it open).
- Exit-1 lines (`out.unmet`, `out.gone`, refusals) asserted on `deps.err`; other lines on `deps.out`
  (architecture Decision Records, "Exit-1 lines").
- S4 also spawns `node scripts/conductor.mjs state` in the temp primary (a truly fresh process through
  `createConductorHostDeps`); `state` must not touch the window driver.
- S5 re-runs `wave-done` against the same report after an unmet reply (newest report at index ≥ `reportFloor`,
  OQ2); an unparseable first item is an unmet `fact.report` and no seam runs (decision table row 2).
- S6 includes the OQ5 contrast (window gone but report arrived → not "gone", exit 0) because S6's condition names
  "no wave-done report"; it also checks the SOP's notify-the-human sentence.
- Security smoke: S3 bad argv (empty, unknown command, missing / zero / non-numeric wave, both targets, empty record
  path, extra args, 100 000-char argument) → usage + exit 2, nothing opened; S4 unparseable state → refused exit 1,
  file untouched, no window; S5 hostile first item (path traversal, shell substitution) → unmet, no seam called.
- Served-text assertions require no bare ticket id and no repo-only path in `content/**`; S2/S7/S8 additionally
  assert no bare ticket id in the served SOP text.

## Red Reasons

- `test/e466-prompt.test.mjs` S1 — PROMPT_REGISTRY has 13 entries; no conductor entry / `prompts/conductor.ts`.
- `test/e466-prompt.test.mjs` S2, S7 — `content/skill-conductor.md` does not exist.
- `test/e466-integrator-sop.test.mjs` S8 — integrator SOP still has the "Re-run it at two moments" sentence.
- `test/e466-window-state.test.mjs` S3, S4 — module not found: `dist/tools/conductor.js` not built.
- `test/e466-wave-done.test.mjs` S5, S6 — module not found: `dist/tools/conductor.js` not built.
- `test/e178a-integrator-role.test.mjs` AC3 — registry 13 entries, tail spec-workshop.
- `test/e178a-integrator-role.test.mjs` AC5 — CLAUDE.md still reads 13 / Thirteen / the other eleven / the other 12.
- `test/e423-spec-workshop.test.mjs` AC1 — registry 13 entries.
- `test/skill-frontmatter.test.mjs` (skill-file count) — 13 skill files, 14 expected.
- `test/e428-tracker-mirror.test.mjs` AC6, AC12 — integrator base sha now includes `integrator.relaunch`.
- `test/e443b-served-text.test.mjs` A2-19 — Render line still carries the old two-moments sentence.

## Device-or-person

- S9 — `qa_reports/manual-verification_e466-conductor.md` (one real two-wave run; after PASS the ticket stops as
  `stopped — awaiting manual verification`).

## CI Runnability

All new tests run headlessly under `npm test`: no iTerm2, `gh`, network or real launcher; temp git repos under
`os.tmpdir()`, removed in `after()`. S1 spawns `dist/index.js` over stdio (as e423 AC2 does).
