# QA review — T-E34-01, T-E34-02

covers: T-E34-01, T-E34-02

Feature: `e34-agc-init-dead-end-seed` (backlog E34, live incident 2026-07-17,
VS-NDI-Receiver consumer workspace). Bugfix-mode mini-chain (sr-engineer →
code-reviewer → qa-engineer; PM/architect skipped per human scope
`「實作 option 1 就好」`). No `specs/e34-*.md` file — the backlog E34 row IS
the spec, per E10/E17/E18/E20/E22-E33 mini-chain precedent. Code review:
APPROVED, zero findings (`review_reports/review_T-E34-01.md`, covers both
ids).

Shipped diff:
- `bin/agc-init.mjs`: `runInit()` no longer writes `.current/handoff.md`.
  `.current/.config.json` + `tasks.md` + the CLAUDE.md/AGENTS.md/
  .antigravityrules adapter loop are behaviorally unchanged; `.current/` is
  still created via the `.config.json` entry's `mkdirSync`. Dead `const now`
  (sole consumer was the deleted handoff template) fully excised.
- `README.md:34`: install command gains `-p` — the package ships 3 bin
  entries, so `npx github:...#vX agc init` without `-p` runs the default bin
  (the MCP server, `dist/index.js`) and `agc` never executes.
- Descope verified clean: `tools/transitions.ts` / `tools/handoff-orchestrator.ts`
  untouched (no defensive prev-tuple coercion), no seeded-workspace migration
  added — matches the human-scoped minimal-fix decision.

## Expected-Red Diff

Phase 0.5 (bugfix-mode — this disposition is load-bearing for PASS, not
advisory).

`qa_reports/expected-red_e34-agc-init-dead-end-seed.txt` declares 3 entries —
the pre-fix tests pinning the OLD `pm:Not_Started` template, expected to go
red against the fixed (no-handoff-seed) code:

- `test/p0-onboarding-lite-default.test.mjs | AC1: agc init creates handoff/.config/tasks with expected templates`
- `test/p0-onboarding-lite-default.test.mjs | AC2: agc init leaves existing files byte-for-byte unchanged on re-run`
- `test/p0-onboarding-lite-default.test.mjs | AC3: agc init scaffold parses via parseHandoff with Not_Started + pm + empty arrays`

Ran the FULL suite BEFORE any re-baseline edit: `1608 pass / 3 fail`
(`not ok 775/776/777`) — **exactly** the 3 manifested entries, 0 unexplained
reds, 0 manifest entries that failed to reproduce. Phase 0.5: **clean (3/3
manifest entries confirmed red, 0 unexplained reds)**.

Manifest's own repro claim (bugfix-mode reproduction, not merely trusted —
independently re-verified both directions):
- **Pre-fix RED shape**: the manifest records a script-based repro (fresh
  temp workspace, real `node bin/agc-init.mjs init`, seeded handoff fed
  through `parseHandoff` + `validateTransition(pm:Not_Started → pm:In_Progress)`)
  yielding `TRANSITION_REJECTED`, `allowed: []`. Confirmed structurally: the
  OLD template (now deleted) wrote exactly `status: "Not_Started"` +
  `last_agent: "pm"`, and `tools/transitions.ts`'s `ALLOWED` map has no
  `"pm:Not_Started"` key (`ALLOWED.get("pm:Not_Started")` → `undefined` →
  `[]`) — the dead-end is real, not hypothetical.
- **Post-fix GREEN shape, independently re-driven end-to-end** through the
  REAL tool-handler write path (not just unit assertions): fresh temp
  workspace → `node bin/agc-init.mjs init` (confirmed `.current/handoff.md`
  absent) → `handleGetState` (the exact code behind `tw_get_state`) →
  `handleUpdateState({agent_id:"pm", status:"In_Progress", ...})` (the exact
  code behind `tw_update_state`). Result: **ACCEPTED**
  (`{"success":true,...}`, no `TRANSITION_REJECTED`), and `handoff.md` is
  created for the first time via the `null:null` edge with the correct
  `pm:In_Progress` tuple. This closes the loop the manifest predicted:
  init-side fix ⇒ first real pm write through the actual dispatcher succeeds.

Since `dispatch_mode: "bugfix"` is set on the handoff, this disposition is
load-bearing for PASS (not advisory): both conditions hold — (a) all 3
manifest entries confirmed red pre-fix and their post-fix behavior
independently re-derived as correct, (b) re-running the full suite after the
test flip (below) shows zero strays — no red outside the 3 manifested/
re-pinned entries.

## Phase 1 — Review

Re-derived (not merely copied) the code-reviewer's findings by reading
`bin/agc-init.mjs`'s diff directly and exercising it:

- `.current/` is still created post-fix even with `handoff.md` gone: the
  `.current/.config.json` files[] entry drives `fs.mkdirSync(path.dirname(abs),
  {recursive:true})` — confirmed via a fresh-workspace smoke run
  (`find . -maxdepth 3 -type f` shows `.current/.config.json` present, no
  stray `.current/` artifacts).
- Fresh-workspace `agc init` stdout: `Created: .current/.config.json, tasks.md,
  CLAUDE.md, AGENTS.md, .antigravityrules` — no `handoff.md` token anywhere.
- Re-run stdout: `Updated: CLAUDE.md` (upsert always re-stamps the version
  block) then `Skipped (already exists): .current/.config.json, tasks.md,
  AGENTS.md, .antigravityrules` — `.config.json`/`tasks.md` byte-for-byte
  unchanged, confirmed via `fs.readFileSync` buffer comparison.
- No-args invocation: exit 1 (well, `sub===undefined` branch → exit 1),
  usage printed to **stderr**, and — critically — `.current/` and `tasks.md`
  are NOT created (idempotency invariant for the usage path; pre-existing
  behavior, untouched by this diff, re-verified).
- No spec `Copy / Strings` or `Visual Tokens` H2 exists (the backlog row is a
  single-paragraph spec, not a full `specs/<feature>.md` doc) — Copy Audit
  Gate / Visual Audit Gate are **N/A** for this bugfix ticket, consistent
  with the code-reviewer's "no architecture spec" note. Non-design feature,
  no `design/e34-*.md` — Phase 1.5 Visual Compare: **skipped (no Visual
  Baselines declared)**.
- Phase 3.5 AC Execution: the backlog E34 row carries no `proof:`-annotated
  ACs — **skipped (no proof:-annotated ACs)**.
- Descope re-confirmed independently: `git diff --stat` against the pre-QA
  tree touches exactly `.current/handoff.md` (my own claim write),
  `README.md`, `bin/agc-init.mjs`, `docs/backlog.md` (PM done-mark, pre-
  existing), plus my own `test/p0-onboarding-lite-default.test.mjs` edit and
  the two new `qa_reports`/`review_reports` files — `tools/transitions.ts`
  and `tools/handoff-orchestrator.ts` untouched, matching the human-scoped
  minimal-fix decision.

No findings — implementation matches the E34 contract, zero regressions
introduced.

## Phase 3 — Tests

Test File Discovery: `test/p0-onboarding-lite-default.test.mjs` is the
existing owner of `agc init` scaffolding coverage (T43/T44/T45); no new file
needed — re-pinned AC1/AC2/AC3 in place per the expected-red manifest's
disposition, plus one new permanent regression test.

Spec (backlog E34 row)-to-test map:
- `agc init` must not write `.current/handoff.md` → AC1 (re-pinned):
  asserts stdout is exactly `Created: .current/.config.json, tasks.md, ...`
  with no `handoff.md` token, and the file itself is absent on disk.
- `.config.json` + `tasks.md` scaffolding + idempotent re-run unaffected by
  the handoff removal → AC2 (re-pinned): byte-for-byte comparison across two
  runs, `Skipped (already exists): .current/.config.json, tasks.md, ...`
  stdout shape, re-run stdout also never mentions `handoff.md`.
- The sanctioned fresh-workspace tuple is `null:null` (file absent), not a
  seeded template → AC3 (re-pinned): `parseHandoff(ws)` returns `null`
  post-init (was previously asserting a parsed `Not_Started`/`pm` state —
  now the obsolete shape entirely, replaced with the new-contract
  equivalent: handoff absent post-init).
- Permanent regression pin (outlives refactors, per coordinator's ask): new
  test `REGRESSION (E34): agc init never seeds a handoff.md whose
  (last_agent,status) tuple lacks an ALLOWED_TRANSITIONS edge` — imports the
  real `ALLOWED_TRANSITIONS` map from `dist/tools/transitions.js` and checks
  `ALLOWED_TRANSITIONS.has(key)` for whatever tuple (if any) `agc init`
  seeds. Passes today via the "no handoff.md at all" branch; if some future
  refactor reintroduces a seeded template, this test forces that template's
  tuple to have a live outgoing edge — the actual invariant the E34 incident
  violated, not merely the current implementation shape.
- AC4 (bin wiring), AC5/AC6 (hook skill-variant switching), and both
  security-smoke tests (no-subcommand usage + non-managed-workspace hook
  silence) are unrelated to the handoff-seed removal — left untouched,
  re-verified still green.

Coverage: `runInit`'s full behavior (created/updated/skipped bookkeeping,
`.config.json`+`tasks.md` scaffolding, adapter upsert/skip, no-handoff
invariant) is covered across every branch exercised by AC1/AC2/AC3/
REGRESSION plus the pre-existing AC4-AC6 and security-smoke tests.

## Phase 4 — Run

- Confirmed the pre-edit baseline was EXACTLY the 3 manifested reds
  (`not ok 775/776/777`, 1608 pass / 3 fail / 1611 total) via a full-suite
  run before any test edit.
- Build: `npm run build` (`tsc`) — zero errors.
- `test/p0-onboarding-lite-default.test.mjs` alone: 9/9 pass (was 6/9 before
  the flip).
- Full suite (`npm test` / `node --test test/*.test.mjs`): **1612/1612
  pass**, 0 fail, 0 cancelled, headless, zero human interaction (1608
  pre-existing baseline + 3 re-pinned to the new contract + 1 new
  REGRESSION test).
- End-to-end init smoke (temp dir, outside the automated suite): fresh
  `agc init` creates exactly `.current/.config.json, tasks.md, CLAUDE.md,
  AGENTS.md, .antigravityrules` (no handoff.md); re-run prints
  `Updated: CLAUDE.md` + `Skipped (already exists): ...`; `agc` with no args
  exits 1, prints usage to stderr, creates nothing.
- Post-fix repro (bugfix-mode Phase 0.5, see above): real
  `handleGetState`/`handleUpdateState` dispatcher path accepts the first
  `pm:In_Progress` write in a freshly-inited workspace with no
  `TRANSITION_REJECTED` — dead-on-arrival incident does not reproduce
  post-fix.

## Verdict

PASS. `agc init` no longer seeds a dead-end `.current/handoff.md` — the
`pm:Not_Started` tuple that dead-ended every consumer workspace
(`ALLOWED_TRANSITIONS` has no edge for it) is gone; the sanctioned
fresh-workspace tuple (`null:null` = file absent) is now what `agc init`
actually produces, independently re-verified end-to-end through the real
`tw_get_state`/`tw_update_state` dispatcher code. `README.md:34`'s `-p` fix
is correct and minimal (`docs/install.md:130` already correct via
`--package=`, untouched). Expected-Red Diff clean (3/3 manifest entries
confirmed red pre-edit, 0 unexplained reds) before re-pinning AC1/AC2/AC3 to
the new contract, plus one new permanent regression test. Full suite
1612/1612 green, `tsc` zero errors, `npm test` exits 0 headlessly. Descope
verified clean — no changes to `tools/transitions.ts`,
`tools/handoff-orchestrator.ts`, or any seeded-workspace migration.
## 2026-07-17T03:26:45.317Z — PASS — by qa-engineer

PASS — T-E34-01 (bin/agc-init.mjs no longer seeds .current/handoff.md) + T-E34-02 (README.md:34 -p fix). Full evidence in qa_reports/review_T-E34-01.md. Phase 0.5 (bugfix-mode, load-bearing): expected-red manifest qa_reports/expected-red_e34-agc-init-dead-end-seed.txt confirmed clean — pre-edit full suite was EXACTLY the 3 manifested reds (not ok 775/776/777, 1608/1611), 0 unexplained. Post-fix repro independently re-driven end-to-end through the real dispatcher code (handleGetState + handleUpdateState, the exact handlers behind tw_get_state/tw_update_state): fresh temp workspace -> agc init creates no handoff.md -> first pm:In_Progress write is ACCEPTED via the null:null edge, no TRANSITION_REJECTED -- the VS-NDI-Receiver dead-on-arrival incident does not reproduce post-fix. Modernized test/p0-onboarding-lite-default.test.mjs: AC1/AC2/AC3 re-pinned from the OLD pm:Not_Started template to the new no-handoff contract, plus one new permanent regression test (checks ALLOWED_TRANSITIONS.has(key) for whatever tuple, if any, agc init seeds -- outlives refactors). Descope verified clean: tools/transitions.ts and tools/handoff-orchestrator.ts untouched, no seeded-workspace migration added. Build (tsc) zero errors; full suite 1612/1612 pass, 0 fail, npm test exits 0 headlessly. End-to-end smoke confirmed: fresh init creates .current/.config.json+tasks.md+3 adapters (no handoff.md), re-run prints Updated:CLAUDE.md + Skipped(...), agc with no args exits 1 with usage to stderr and creates nothing.

## 2026-07-17T03:27:34.168Z — PASS — by qa-engineer

PASS — T-E34-01 (bin/agc-init.mjs no longer seeds .current/handoff.md) + T-E34-02 (README.md:34 -p fix). Full evidence in qa_reports/review_T-E34-01.md. Phase 0.5 (bugfix-mode, load-bearing): expected-red manifest qa_reports/expected-red_e34-agc-init-dead-end-seed.txt confirmed clean -- pre-edit full suite was EXACTLY the 3 manifested reds (not ok 775/776/777, 1608/1611), 0 unexplained. Post-fix repro independently re-driven end-to-end through the real dispatcher code (handleGetState + handleUpdateState, the exact handlers behind tw_get_state/tw_update_state): fresh temp workspace -> agc init creates no handoff.md -> first pm:In_Progress write is ACCEPTED via the null:null edge, no TRANSITION_REJECTED -- the VS-NDI-Receiver dead-on-arrival incident does not reproduce post-fix. Modernized test/p0-onboarding-lite-default.test.mjs: AC1/AC2/AC3 re-pinned from the OLD pm:Not_Started template to the new no-handoff contract, plus one new permanent regression test (checks ALLOWED_TRANSITIONS.has(key) for whatever tuple, if any, agc init seeds -- outlives refactors). Descope verified clean: tools/transitions.ts and tools/handoff-orchestrator.ts untouched, no seeded-workspace migration added. Build (tsc) zero errors; full suite 1612/1612 pass, 0 fail, npm test exits 0 headlessly. End-to-end smoke confirmed: fresh init creates .current/.config.json+tasks.md+3 adapters (no handoff.md), re-run prints Updated:CLAUDE.md + Skipped(...), agc with no args exits 1 with usage to stderr and creates nothing.

