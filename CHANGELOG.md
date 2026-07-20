# Changelog

All notable changes to `agent-governance-mcp` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Versioning policy

- **Install via tagged ref**: `npx -y github:Paul-hengChen/agent-governance-mcp#v<version>`.
- `main` is the development branch; pinning to a tag is the supported way to use this server.
- **MAJOR** bumps signal breaking changes to the MCP tool surface, prompt schema, or
  handoff/state file format. Re-read this changelog before upgrading across a MAJOR.
- **MINOR** bumps add backwards-compatible tools, role skills, or storage features.
- **PATCH** bumps are bug fixes, doc clarifications, and internal refactors with no
  observable behavior change.

## [Unreleased]

## [3.92.1] - 2026-07-20

### Changed
- **`e35-gate-pipeline-extraction` — gate-pipeline extraction: check order becomes data (backlog E35, 2026-07-20 refactor-survey revision).** `handleUpdateStateCore`'s ~1,260-line hand-woven gate sequence in `tools/handoff-orchestrator.ts` is now a declarative ordered `UPDATE_STATE_GATE_PIPELINE` array of 18 gate steps, executed by a first-rejection-wins runner — extending the A10 registry pattern (gate METADATA as data) with its E35 half (gate ORDER as data). New `gates/pipeline.ts` holds the shared contract: `UpdateStateGateContext` (per-write ctx derived once in the ctx-building phase — gate steps never derive values later steps depend on), `UpdateStateGateStep` (`name` + `codes[]` + `run`), and `runUpdateStatePipeline()`. The ordered array itself stays in `tools/handoff-orchestrator.ts` because the source-pin suites assert emit-body literals against that file; per-gate emit bodies are byte-verbatim relocations (mechanically verified — diff empty after scaffolding-strip, `review_reports/review_T-E35-01.md`). `gates/registry.ts` change is comment-only. ZERO observable behavior change: error codes, envelope shapes, telemetry emits, and the frozen 18-step check order are all unchanged — PATCH per the internal-refactor policy above.
- **test/e35-pipeline-order.test.mjs** (new, qa-engineer-authored per §2): order-pin test asserting the pipeline's 18 step names in exact sequence and each step's `codes[]` array against `gates/registry.ts` `ALL_GATE_CODES` (31 codes, set-equal, no duplicates, no gaps) — replacing the frozen-additive comment as the order's enforcement mechanism.
- **docs/backlog.md**: E35/E36 refactor-survey rows added (2026-07-20 revision); E35 row is this release's spec (mini-chain, backlog-row-as-spec).
- **package.json / index.ts / dist/**: version 3.92.0 → 3.92.1 (manifest + Server() literal + rebuilt dist).
- **README.md**: install pins caught up 3.92.0 → 3.92.1; status line suite count 1612 → 1618.

### Notes
- Suite **1618/1618** green (1612 pre-existing + 6 new order-pin tests); zero test-expectation edits.
- Chain: mini-chain (backlog row as spec, PM/architect skipped, `scope_decision: single-feature`) sr(fable) → code-reviewer (APPROVED round 1, zero blocking findings, `review_reports/review_T-E35-01.md`) → qa-engineer (PASS, `qa_reports/review_T-E35-01.md`). Implementation commit `fffe3d9`; QA commit `c542a28`.
- No MCP tool-surface, gate-semantics, or schema changes (handoff schema stays v13, evidence schema v2); no migration needed.

## [3.92.0] - 2026-07-17

### Fixed
- **`e34-agc-init-dead-end-seed` — `agc init` no longer seeds a dead-end handoff state (backlog E34, live incident 2026-07-17 VS-NDI-Receiver consumer workspace).** `bin/agc-init.mjs` previously wrote a `.current/handoff.md` template with `status: "Not_Started"` + `last_agent: "pm"`. But `pm:Not_Started` has no `ALLOWED_TRANSITIONS` edge, so every init'd consumer workspace rejected ALL subsequent `tw_update_state` writes with `TRANSITION_REJECTED` — dead on arrival, unrecoverable without manually removing `handoff.md`. Fix (human-scoped 2026-07-17, minimal init-side option): `runInit()` stops writing `.current/handoff.md` entirely — a fresh workspace is now `null:null` (file absent, the matrix's sanctioned fresh tuple), and the first `pm:In_Progress` write creates the handoff via the normal `null:null` edge. `.config.json` / `tasks.md` / adapters are unchanged. Defensive prev-tuple coercion in the handoff orchestrator was explicitly DESCOPED (human decision). Chain: content-scoped mini-chain (backlog row as spec, PM/architect skipped) sr(fable) → code-reviewer (APPROVED round 1, zero findings, `review_reports/review_T-E34-01.md`) → qa-engineer (PASS, `qa_reports/review_T-E34-01.md` + `qa_reports/review_T-E34-02.md`). Expected-Red manifest `qa_reports/expected-red_e34-agc-init-dead-end-seed.txt`. Commit `23aee75`.
- **Install-command doc fix (same incident):** `README.md` install command changed from `npx -y github:…#vX agc init` to `npx -y -p github:…#vX agc init`. The package ships 3 bin entries, so without `-p` npx runs the default bin (the MCP server, `dist/index.js`) and the `agc` bin never executes → no files created. `docs/install.md` was already correct via `--package=`.

### Changed
- **bin/agc-init.mjs**: `runInit()` no longer writes `.current/handoff.md`.
- **README.md**: install command gains `-p`; install pins caught up 3.91.0 → 3.92.0; status line suite count 1611 → 1612.
- **test/p0-onboarding-lite-default.test.mjs**: AC1/AC2/AC3 flipped to the no-handoff contract + permanent E34 regression pin (a seeded tuple must have an `ALLOWED_TRANSITIONS` edge).
- **package.json / index.ts**: version bumped 3.91.0 → 3.92.0 (package manifest + Server() literal).
- **dist/**: rebuilt for the 3.92.0 Server() literal.

### Notes
- **BREAKING-ish for existing consumers**: `agc init` output no longer includes `.current/handoff.md`. Consumers upgrading who already have a seeded dead-end `handoff.md` (from an older `agc init`) must delete or rename it manually — defensive coercion was explicitly descoped — and must NOT re-run an older `agc init` afterward.
- Suite **1612/1612** green; build zero errors.
- No MCP tool-surface or handoff-schema changes; no migration needed (handoff schema stays v13, evidence schema v2).

## [3.91.0] - 2026-07-16

### Added
- **`e-p3-tail-batch` — P3 tail batch: E25 + E27 + E28 + E29 + E30 + release-SOP bump-build line (backlog rows E25/E27/E28/E29/E30, 104447-F0 retro).** Six ~1-file tickets shipped as one content-scoped batch (backlog-rows-as-spec mini-chain):
  - **E25 — §6 git vocabulary completion** (`content/const-15-core-tail.md`): `git stash` / `git stash pop` (reversible, non-destructive) added to the sanctioned git-ops list; `git checkout -- <file>` clarified as forbidden (irreversibly discards uncommitted edits — stash instead). Under a whitelist regime an incomplete vocabulary forces correct behavior into violation — the 104447 QA used stash correctly as an isolation-proof tool. QA re-baselined 11 compose-equivalence goldens + 4 context-budget caps for the const-15 edit.
  - **E27 — opt-in arming onboarding doc** (new `docs/arming.md` + `docs/config.md` cross-link): walks a consumer workspace through arming each of the 4 opt-ins (`tokenBudgetPerFeature` usage sidecar + PostToolUse hook, `driftBaselineIds`, `cutApprovalAutoTier`, `staleDispatchNotifyFile`) — how to arm, expected effect, how to verify it's live. Motivation: unarmed-reads-as-dead produced near-duplicate reimplementation tickets (the 104447 retro concluded the usage sidecar "was never implemented"; it shipped in D2). QA live-verified the `staleDispatchNotifyFile` walkthrough against real `tw_get_state` calls.
  - **E28 — wholesale-replace shrink warning** (`tools/handoff-orchestrator.ts`): `dispatch_pins` / `external_refs` REPLACE on write, so a writer that skips read-before-write silently drops entries. Same-feature writes that shrink either set now get an advisory `warnings` array on the success envelope naming the dropped entries — warn-only, never rejects, no new arg, no schema bump, envelope additive-only. 11-test matrix `test/e28-shrink-warning.test.mjs`; the same-count-swap evasion was confirmed-and-pinned as backlog E33 (shipped below in this same release).
  - **E29 — stale_dispatch Crash-Resume pointer** (`tools/handoff.ts`): the advisory `message` now appends a one-line ground-truth-then-resume protocol summary, so a dead coordinator or a lite takeover session sees the protocol without skill-coordinator text in context. Reaches the E22 watch-file end-to-end; the `(dispatched_at, role)` dedupe contract verified unbroken (+2 tests in `test/e22-stale-notify.test.mjs`).
  - **E30 — qa-visual actual-capture output convention** (`content/skill-qa-visual.md`): actual screenshot captures go to an UNTRACKED directory outside the committed baseline dir (never `ACTUAL_DIR` = baseline dir); qa flags suites that violate it. Cost basis: one full pixelmatch forensics round spent clearing a false alarm that was routine overwrite noise.
  - **Release-SOP bump-build line** (`content/skill-release-engineer.md` SOP step 5): sanctioned bump-build path — post-bump `npm run build` deadlocks (prebuild `check:version` demands the dist parity only the build produces); run `npx tsc` directly, then `node scripts/check-version.mjs` (observed live in the v3.90.0 release).
  - Chain: mini-chain sr(fable) → code-reviewer (APPROVED, `review_reports/review_T-E25-01.md`) → qa-engineer (PASS, batched evidence `qa_reports/review_T-E25-01.md` covering all 6 ids + per-id disposition reports). Expected-Red manifest `qa_reports/expected-red_e-p3-tail-batch.txt` (11 goldens, 4 budget caps, 2 message pins — all explained, zero unexplained). Suite 1600/1600 at batch PASS. Evidence archived per SOP 7a into `qa_reports/archive/e-p3-tail-batch/`. Commits `95d6376` (feat) + `6ef1a6e` (test/qa) + `61db22b` (backlog done-marks).

### Fixed
- **`e32-e33-gate-hardening` — E32 c16-amendment: unconditional QA completion-evidence gate (P1) + E33 entry-identity shrink detection (P3).**
  - **E32 (backlog row E32, fourth E9A/E18-class incident, live replay 2026-07-16):** a state write with `agent_id=qa-engineer`, `status=In_Progress`, `completed_tasks` pre-filled with all 6 e-p3-tail-batch ids and ZERO per-id QA evidence on disk was ACCEPTED. Root cause (corrected after review round 1 + PM re-scope, human option A): the E18 gate was already status-agnostic — the real door was the c16 APPROVED-manifest contract persisting review-scope ids into `completed_tasks` on the code-reviewer→qa edge, which made the incident write byte-identical to a sanctioned write and opened a two-step carry-forward evasion. Fix: (1) the APPROVED handoff now carries review scope via the transient `review_task_ids` channel ONLY — it never persists into `completed_tasks` (`tools/handoff-orchestrator.ts`); (2) the APPROVED-row exemption is removed — ANY qa-agent-id `completed_tasks` growth without per-id QA evidence is rejected unconditionally, regardless of status; (3) `MISSING_REVIEW_EVIDENCE` re-pointed at the amended channel (`gates/qa-review.ts`, `gates/registry.ts`); (4) `content/skill-code-reviewer.md` APPROVED-handoff template amended, `content/const-08-chain-31-mid.md` + `specs/c16-c10-role-boundary.md` aligned (historical v3.9.0 spec text supersession-marked). Rejection envelope names every offending id + its exact `qa_reports/review_<id>.md` path + the `covers:` fallback (E23 posture). The R1 incident shape is now REJECTED and permanently regression-pinned (`test/e32-e33-gate-hardening.test.mjs` R1), and the P6 divergent-field matrix proves the QA-evidence and review-evidence gates orthogonal — neither substitutes for the other.
  - **E33 (backlog row E33, spun out of the E28 code review):** E28's shrink detection was cardinality-based, so a same-count entry SWAP (e.g. pins `{sr,release}→{sr,qa}`) dropped an entry silently. Detection now diffs entry identity — `dispatch_pins` by key set, `external_refs` by ref string — warning on ANY dropped entry at any count; value-only pin changes and ref-state advances stay silent. P1a/P1b re-pinned to warn-on-swap.
  - Chain: pm re-scope (1 review round, CHANGES_REQUESTED → human option A) → sr(fable) → code-reviewer (APPROVED, `review_reports/review_T-E32-01.md`, live R1–R4 replay table) → qa-engineer (PASS, batched evidence `qa_reports/review_T-E32-01.md` covering T-E32-01 + T-E33-01). Expected-Red manifest `qa_reports/expected-red_e32-e33-gate-hardening.txt` (11 reds: 6 compose-goldens, QAEV-4 contract flip, FM4/FM5 re-pins, P1a/P1b — exact 1:1, zero unexplained). QAEV-4 split into 4a (OLD sanctioned shape now REJECTED) / 4b (amended `review_task_ids` shape ACCEPTED, ledger stays `[]`). Evidence archived per SOP 7a into `qa_reports/archive/e32-e33-gate-hardening/`. Commits `9fb6022` (feat) + `f1daf2b` (test/qa) + `3ac5582` (backlog done-marks).

### Changed
- **tools/handoff-orchestrator.ts**: E28 shrink `warnings` + E33 entry-identity diff + E32 c16-amendment (transient `review_task_ids` carry, exemption removal).
- **tools/handoff.ts**: E29 Crash-Resume pointer on the `stale_dispatch` advisory message.
- **gates/qa-review.ts / gates/registry.ts**: unconditional QA completion-evidence check; `MISSING_REVIEW_EVIDENCE` re-pointed.
- **content/const-15-core-tail.md** (E25 git vocab), **content/const-08-chain-31-mid.md** (c16 amendment), **content/skill-code-reviewer.md** (APPROVED-handoff template), **content/skill-qa-visual.md** (E30 convention), **content/skill-release-engineer.md** (bump-build line).
- **docs/arming.md** (new, E27), **docs/config.md** (cross-link), **specs/c16-c10-role-boundary.md** + **specs/code-reviewer-role-extraction-architecture.md** (c16 alignment).
- **test/**: new `e28-shrink-warning.test.mjs` (11) + `e32-e33-gate-hardening.test.mjs` (10); QAEV-4 split, FM4/FM5 + P1a/P1b re-pins, stale-dispatch T4/T4b re-pins, E29a/E29b; 10 compose goldens + `constitution-monolith.txt` re-captured; 4 context-budget caps re-baselined.
- **package.json / index.ts**: version bumped 3.90.0 → 3.91.0 (Server() literal + package manifest).
- **README.md**: install pins caught up 3.89.0 → 3.91.0 (v3.90.0 release skipped the README step); status line suite count 1547 → 1611.
- **dist/**: rebuilt for the tools/gates changes + 3.91.0 Server() literal.

### Notes
- **Gate behavior change (E32)**: the OLD sanctioned code-reviewer APPROVED-manifest shape — persisting review-scope ids into `completed_tasks` — is now REJECTED server-side. The amended contract carries review scope via transient `review_task_ids` only. `content/skill-code-reviewer.md` in this release matches the new contract; a running MCP server process loads `dist/` at startup and must be restarted to pick up the new gates (E23 precedent).
- Suite **1611/1611** green (1600 at e-p3-tail-batch PASS + 1 net QAEV-4 split + 10 net new-file); build zero errors.
- No MCP tool-surface or handoff-schema changes; no migration needed (handoff schema stays v13, evidence schema v2).

## [3.90.0] - 2026-07-16

### Added
- **`e22-stale-notify` — opt-in stale-dispatch watch-file notify emit (v3.90.0, backlog E22, D5 follow-on / 104447-F0 A3).** The existing `stale_dispatch` advisory is pull-only — computed at `tw_get_state` read time — so a stalled dispatch goes unseen until the next `/teamwork`. E22 adds an opt-in push channel: when the `stale_dispatch` threshold is crossed, the server touches a configured watch-file that an external watcher (desktop notification / webhook) can observe. New `tools/stale-notify.ts` (`notifyStaleDispatch()`) rides the existing threshold check — it never adds a second trigger, and fires only when the underlying advisory fires. Armed by the new `staleDispatchNotifyFile` config key (`tools/config.ts`, additive-optional, empty-string filtered to absent); disarmed is byte-identical to pre-E22 (no `notify` key on the advisory, verified by exact key-set equality). The emit payload carries the advisory fields + `workspace` + an ISO `emitted_at`, published atomically via tmp-then-rename. Dedupe cursor is exactly `(dispatched_at, role)` stored in the watch-file: an identical pair is skipped, a fresh dispatch or a different role at the same timestamp re-arms, and a hand-deleted watch-file forces a fresh emit (fails toward notification, never toward silence). Never-throws: corrupt config, future-schema config, corrupt/non-object prior watch-file, unwritable directory, and directory-as-target all collapse to a loud `error` string with `emitted: false`. File-mode only — no new handoff state, no schema bump. Wired into the read-time computation in `tools/handoff.ts`; documented in `docs/config.md`. Chain: content-scoped mini-chain (backlog row as spec, no `specs/e22-*.md`) sr(fable) → code-reviewer (APPROVED, `review_reports/review_T-E22-01.md`) → qa-engineer (PASS, `qa_reports/review_T-E22-01.md`, 26-test matrix `test/e22-stale-notify.test.mjs`). Commits `34ef7d5` (feat) + `8650f1a` (test/qa).

### Fixed
- **`e31-config-nonfatal` — non-fatal `loadConfig` on corrupt `.current/.config.json` (v3.90.0, backlog E31, filed from the E22 QA Phase-1 finding).** A corrupt/unparseable `.config.json` made `loadConfig` throw uncaught through the pre-existing task-path resolution call site (`guards/session.ts` → `findTasksFile` → `resolveTaskPaths`), which runs during `tw_get_state` *before* any advisory/notify computation — so the mandatory pre-flight read failed entirely on a bare workspace, with zero stale-dispatch involvement (surfaced by E22 QA, `qa_reports/review_T-E22-01.md`). `tools/config.ts` now degrades loudly-but-readable through a shared non-fatal `loadConfigEntry()` core: `loadConfig` NEVER throws on any fatality mode (unreadable / unparseable / non-object root / future `schema_version`), returning `{}` and caching the loud error (stat/read failures left uncached since chmod is invisible to mtime; content-derived failures mtime-cached and self-healing once the file is fixed). New `getConfigError()` export; `readHandoffState` (`tools/handoff.ts`) spreads `config_error` onto both `tw_get_state` envelope shapes (`exists:true`/`exists:false`), absent and byte-identical on clean/absent config. `tools/stale-notify.ts` adopts `getConfigError()` so the E22 loud-per-emit contract is preserved instead of the old throw propagating. The best-effort observer hook `bin/agent-governance-usage-hook.mjs` keeps its raw-read path (comment updated: the heal-on-read objection stands even though the throw no longer does). The acknowledged C18 post-cache chmod-staleness limitation is out of scope and untouched. Chain: content-scoped mini-chain (backlog row as spec) sr(fable) → code-reviewer (APPROVED, recorded in handoff `pending_notes`) → qa-engineer (PASS, `qa_reports/review_T-E31-01.md`). Expected-Red manifest `qa_reports/expected-red_e31-config-nonfatal.txt` (6 pre-E31 throw-pins confirmed red pre-edit, 0 unexplained) re-pinned to the new contract in `test/config-versioning.test.mjs` + `test/e22-stale-notify.test.mjs`, plus 14 new tests in `test/e31-config-nonfatal.test.mjs`. Commits `f6df606` (feat) + `d3c8beb` (test/qa) + `5836c1c` (backlog done-marks).

### Changed
- **package.json / index.ts**: version bumped 3.89.0 → 3.90.0 (Server() literal + package manifest; `scripts/check-version.mjs` asserts source + dist parity).
- **dist/**: rebuilt so the shipped compiled artifact carries the 3.90.0 Server() literal and the E22 + E31 `tools/` changes.

## [3.89.0] - 2026-07-16

### Added
- **`e26-gate-stats` — `tw_gate_stats` per-gate fire-count coverage reader (v3.89.0, backlog E26, 104447-F0 §4-D).** New read-only twelfth `tw_*` tool that aggregates the two observability sidecars the E6 rule-retirement retro (`docs/gate-retro-procedure.md`) consumes — `.current/telemetry.jsonl` (one line per `GATE_REGISTRY`-cataloged rejection, from D3) and `.current/metrics.jsonl` (one line per shipped feature, from E8) — into per-gate / per-error-code counts, so the retro runs on data instead of raw `jq` + hand-categorization (the 2026-07-13 and 2026-07-15 retros both hand-tallied). (D1) `tools/gate-stats.ts` — full `GATE_REGISTRY` coverage (fired codes ranked by count plus the complete zero-fire list), per-feature and per-agent breakdowns, first/last timestamps, unregistered-code detection (a gate added/removed mid-window: investigate, don't count), and a deduped metrics summary keyed on the E12 `(feature, released_version)` idempotency key (pre-E12 double-appends healed at read time). (D2) **Category boundary — the load-bearing E26 requirement**: telemetry can prove a *gate-backed* rule dead or alive because every enforcement path emits a `GATE_REGISTRY` error code, but *prose-behavioral* rules (§5 read cap, §1 terse cap, `dispatch_pins` honoring, the coordinator token-budget brake) have NO server gate and therefore NO telemetry. The output makes this structural: prose-behavioral rows live in a separate array whose `fires` is `null` (never `0`), so a reader can never conflate "not measured" with "never fired" — zero fires for a prose rule means transcript sampling is required, never auto-retirement. (D3) Never-throws posture (mirrors the `tools/exemptions.ts` loader): a missing sidecar is the normal young-workspace case (zero counts + a note), a malformed line is skipped and counted loudly, and no failure mode may block a retro. Registered in `tools/registry.ts` with the `WorkspaceOnly` zod schema. Spec: backlog row `docs/backlog.md` §E26 (backlog-row-as-spec mini-chain, no dedicated `specs/` file — same pattern as E24). Chain: mini-chain sr(fable) → code-reviewer(APPROVED, `review_reports/review_T-E26-01.md`) → qa-engineer(PASS). Evidence (archived per SOP step 7a into `qa_reports/archive/e26-gate-stats/`): `review_T-E26-01.md` (covers T-E26-01/02/03), `review_T-E26-02.md`, `review_T-E26-03.md`.

### Changed
- **tools/gate-stats.ts**: New read-only aggregation module implementing `handleGateStats` (413 lines).
- **tools/registry.ts**: `tw_gate_stats` registry entry + `handleGateStats` import.
- **docs/gate-retro-procedure.md**: retro procedure steps 2–4 now point at `tw_gate_stats` as the preferred aggregation (the `jq` one-liners retained as a no-server fallback); adds the gate-backed vs prose-behavioral category note; drops the stale hardcoded "22 entries" `GATE_REGISTRY` count.
- **CLAUDE.md**: tool inventory updated from eleven to twelve `tw_*` tools; `tools/gate-stats.ts` added to the layout map.
- **test/e26-gate-stats.test.mjs**: 26-test coverage / never-throws / dedupe matrix.
- **dist/**: rebuilt for the new `tools/gate-stats.ts` module + `tools/registry.ts` entry.

### Notes
- driftBaselineIds appended with T-E26-01, T-E26-02, T-E26-03
- Chain: mini-chain sr(fable) → code-reviewer(APPROVED) → qa-engineer(PASS), one pass, 4 hops; full suite **1547/1547** green, build zero errors, `npm audit` clean at high (one pre-existing low-severity esbuild advisory, below the high threshold).
- No breaking changes to the MCP tool surface or handoff schema; `tw_gate_stats` is a purely additive read-only tool. A running MCP server process loads `dist/` at startup and must be restarted to expose the new tool.

## [3.88.0] - 2026-07-16

### Added
- **`e24-exemptions-manifest` — Declarative build-gate exemptions manifest `.current/exemptions.json` (v3.88.0, backlog E24, 104447-F0 C2).** Replaces prose-only, re-litigated-every-round build-gate exemptions with a single declarative channel: a permanent-violation state (e.g. the 104447 workspace's 33 known tsc errors across exempted test files) is now recorded once in a committed manifest instead of re-explained in every review/QA round, so it stops teaching agents that rules are negotiable. (D1) `tools/exemptions.ts` — a never-throws loader (mirrors the `config.ts` validation posture but sits on the mandatory `tw_get_state` path). Entry shape: `path` + `reason` + `expires_when` (`expires_when` is a recorded, human-checked string — no server-side expiry engine per the cut). Fail direction is **never-silently-exempt**: absent file = no exemptions; structural malformation (bad JSON / root / `schema_version` / non-array) voids the whole manifest to zero exemptions plus a loud `errors[]`; a single malformed entry is dropped (NOT exempted) while valid siblings survive. `schema_version` 1 (absent === 1; future versions refused loudly — birth version has no migration registry entry yet). (D2) `tools/handoff.ts` surfaces the manifest read-time in the `tw_get_state` envelope (both `exists:true` and fresh-workspace branches) as `exemptions` — pure read-time computation, NO handoff-schema bump, informational, never blocks; `tw_get_state` chosen because it is every role's mandatory first action, so the sanctioned exemption list + only-grows `count` metric need no second read (manifest is a committed file — count growth is auditable via git history). (D3) `content/const-05-core-standards.md` §2 gains one bullet: the manifest is the ONLY sanctioned exemption channel; gates subtract manifest-exempted paths automatically; a prose-only exemption counts as NOT exempted; a malformed manifest exempts nothing; `exemptions.count` is a monitored only-grows metric (adding an entry requires human approval). Tests: `test/e24-exemptions.test.mjs` (loader / envelope matrix — absent, structural-malformation-voids-all, per-entry-drop, schema-version handling). Spec: backlog row `docs/backlog.md` §E24 (backlog-row-as-spec mini-chain, no dedicated `specs/` file). Chain: mini-chain sr(fable) → code-reviewer(APPROVED, `review_reports/review_T-E24-01.md`) → qa-engineer(PASS). Evidence (archived per SOP step 7a into `qa_reports/archive/e24-exemptions-manifest/`): `review_T-E24-01.md`, `review_T-E24-02.md`, `review_T-E24-03.md`.

### Changed
- **tools/exemptions.ts**: New never-throws loader module for `.current/exemptions.json`.
- **tools/handoff.ts**: `readHandoffState` calls `loadExemptions` and adds an `exemptions` key to the `tw_get_state` envelope on both the fresh-workspace and `exists:true` branches (read-time only; no schema field).
- **content/const-05-core-standards.md**: One §2 bullet — declarative build-gate exemptions manifest as the sole sanctioned exemption channel.
- **test/context-budget.test.mjs**: 4 budget pins re-baselined +~188 tok for the new const-05 §2 bullet (declared in `qa_reports/archive/e24-exemptions-manifest/expected-red_e24-exemptions-manifest.txt`).
- **test/fixtures/compose-golden/**: 10 compose goldens + `constitution-monolith.txt` regenerated for the const-05 addition.
- **dist/**: rebuilt for the new `tools/exemptions.ts` module + `tools/handoff.ts` integration.

### Notes
- driftBaselineIds appended with T-E24-01, T-E24-02, T-E24-03
- Chain: mini-chain sr(fable) → code-reviewer(APPROVED) → qa-engineer(PASS), one pass, 4 hops; full suite **1521/1521** green, build green, `npm audit` clean at high
- No breaking changes to the MCP tool surface or handoff schema; the `exemptions` envelope key is additive and read-time only (no `schema_version` bump). A running MCP server process loads `dist/` at startup and must be restarted to surface the E24 read-time envelope key.
- Also rides on `main` (landed after the v3.87.0 tag): second gate-fire retro (E6 cadence) `docs/retro-2026-07-15-gate-fire.md` + `docs/gate-retro-procedure.md` pointer (`d875882`), README install-pin + suite-count catch-up (`ead9dfc`); plus v3.87.0 post-release bookkeeping (`87170e9`).

## [3.87.0] - 2026-07-15

### Added
- **`e23-evidence-schema-versioning` — Evidence-schema versioning: pinned `evidence_schema` field + normalized-contains H2 matching + named rejection envelopes (v3.87.0, backlog E23).** Fixes the 104447-F0 class where a mid-flight evidence-schema tightening made crash-era artifacts that were legal when written illegal at resume. (D1) `evidence_schema` integer pin, server-stamped on the first write of a new `active_feature` (never client-supplied — zod surface unchanged); feature-scoped carry mirrors `dispatch_mode` (preserve same-feature, drop+restamp on change). Handoff schema **v12→v13** with a migration that invents no pin — absent stays absent and validates under the current (v2) rules, which are a strict superset (backwards-compatible; old files migrate lazily). (D2) `gates/evidence-schema.ts` (`EVIDENCE_SCHEMA_CURRENT=2`) + `sliceH2SectionAt`/`findH2LineAt` in `tools/evidence-file.ts`: pin 1 replays the legacy exact anchor byte-for-byte; pin ≥2/absent matches H2 headings by normalized-contains, so the incident heading `## Phase 3.5 — AC Execution Log` now clears. `verdictIsPass` value semantics and pass/fail cell parsers unchanged. (D3) `VISUAL_EVIDENCE_MISSING` / `VISUAL_REPORT_INCOMPLETE` / `AC_EXECUTION_LOG_MISSING` envelopes now name the missing section / expected string, the file path(s) inspected, and the evidence-schema version. Implementation: `gates/evidence-schema.ts` (new), `gates/{ac-execution,registry,visual}.ts`, `schema/{versions,migrations-handoff}.ts`, `tools/{evidence-file,handoff,handoff-orchestrator}.ts`, `content/skill-qa-visual.md`. Tests: `test/e23-evidence-schema.test.mjs` (18 AC1–AC6 proof tests) + 41 pre-existing fixtures re-baselined for the v13 bump (groups A/B/C per `qa_reports/expected-red_e23-evidence-schema-versioning.txt`); suite **1503/1503** green, coordinator re-verified independently. Spec: `specs/e23-evidence-schema-versioning.md`. Chain: coordinator design study → sr(fable, crash-resumed once after a session-limit kill per Crash-Resume Protocol) → code-reviewer APPROVED (41-failure classification adversarially spot-checked) → qa PASS (`qa_reports/review_T-E23-01.md`, `review_T-E23-02.md`, `review_T-E23-03.md`).
- **`e20-e21` — Long-run in-turn hard line + crash-checkpoint-via-`bookkeeping_write` SOP lines (v3.87.0, backlog E20 tier (i) + E21).** Content-only. E20 tier (i): a HARD line in `skill-qa-engineer` + `skill-sr-engineer` — long suites/builds run synchronously to completion OR are poll-harvested within the same turn; ending a turn with a run in flight is a violation (tier (ii) `waiting_on` field / per-phase stale thresholds deferred). E21: crash-checkpoint SOP lines — before any long regression/build, roles `bookkeeping_write` completed artifacts (file-mode only; lease timestamp preserved) so Crash-Resume reads the checkpoint instead of git archaeology. Implementation: `content/skill-qa-engineer.md`, `content/skill-sr-engineer.md` (templates are thin pointers, no mirrors). Tests: 13 pins in `test/e20-e21-crash-resilience.test.mjs`; byte/token budget pins re-baselined (`test/context-budget.test.mjs`, `test/qa-visual-skill-split.test.mjs`); suite **1485/1485** green. Chain: mini-chain sr(fable) → code-reviewer(APPROVED) → qa(PASS) (`qa_reports/review_T-E20-01.md`, `review_T-E21-01.md`).

### Changed
- **gates/evidence-schema.ts**: New module exporting `EVIDENCE_SCHEMA_CURRENT=2` and the evidence-schema gate pieces.
- **gates/ac-execution.ts, gates/visual.ts**: normalized-contains H2 matching keyed off the pinned `evidence_schema` (pin 1 exact legacy replay, ≥2/absent contains); rejection envelopes name section/expected-string/path/version.
- **gates/registry.ts**: evidence-schema envelope registration.
- **schema/versions.ts, schema/migrations-handoff.ts**: handoff schema v12→v13 + migration (invents no pin).
- **tools/evidence-file.ts, tools/handoff.ts, tools/handoff-orchestrator.ts**: `sliceH2SectionAt`/`findH2LineAt`, `evidence_schema` server-stamp on first write of a new feature, feature-scoped carry.
- **content/skill-qa-visual.md**: evidence-schema note.
- **content/skill-qa-engineer.md, content/skill-sr-engineer.md**: E20 long-run-in-turn hard line + E21 crash-checkpoint-via-`bookkeeping_write` lines.
- **dist/**: rebuilt for the E23 gate/schema/tool changes.

### Notes
- driftBaselineIds appended with T-E20-01, T-E21-01, T-E23-01, T-E23-02, T-E23-03
- No breaking changes to the MCP tool surface or zod schema; the handoff schema v12→v13 bump is backwards-compatible (lazy migration invents no pin; absent validates under the current superset rules). A running MCP server process loads `dist/` at startup and must be restarted to serve the v13/D2 behavior.
- Also rides on `main` (landed after the v3.86.0 tag): E19 onboarding/opt-in-hook docs housekeeping — SessionStart hook retired to opt-in and no longer presented as default (`f85b08c`, `b89701e`, `f643465`), backlog DONE-mark sync of 39 shipped tickets + D6 row (`bf42442`), release-engineer opus pin in skill + template (`a55f48a`); plus v3.86.0 post-release bookkeeping (`59fe327`, CHANGELOG record-integrity fixes + drift baseline + relayed closing write + metrics).

## [3.86.0] - 2026-07-14

### Added
- **`e18-write-provenance` — Write-provenance hardening: stamp gate + qa completion-evidence gate (v3.86.0).** Delivers two integrated gates to prevent out-of-band state writes: (a) STAMP_PROVENANCE_SUSPECT — file-mode tw_update_state rejects over a hand-authored-shaped on-disk last_updated (predicate extracted verbatim to gates/stamp-provenance.ts, shared with the E9A stampAdvisory) unless the write carries a pending_notes[0] `stamp-remediation:` audit note; ordered after validateTransition, before the feature-lease gate; new-workspace inert, self-disarms; (b) QA_COMPLETION_EVIDENCE_MISSING — qa-engineer writes adding new completed_tasks ids require per-id QA evidence on disk (reuses hasEvidenceInFile); APPROVED-row edge exempt (backstopped per-id by MISSING_REVIEW_EVIDENCE); tw_complete_task untouched. Implementation: `gates/stamp-provenance.ts` (new module with isHandAuthoredStamp predicate), `tools/handoff-orchestrator.ts` (orchestrator integration + qa-evidence check), `tools/drift.ts` (stampAdvisory reuse), `const-08-chain-31-mid.md` (two §3.1 mechanism bullets, v3.86.0), `content/skill-release-engineer.md` (COORDINATOR-RELAYED hard line). Test suite: `test/e18-write-provenance.test.mjs` (17 tests incl. exact replays of both E5-cycle incidents — hand-authored stamp and qa-impersonated completed_tasks pre-fill, both now rejected); goldens regenerated; ratchets re-measured +574 tok (8437/16532/6340); error-code contract 30→32; suite 1472/1472 green. Spec: `docs/backlog.md` §E18 (backlog row, line 1288). Code-review APPROVED (verdict returned inline in the chain and recorded in handoff pending_notes; no review_reports file was written this round). QA verified (`qa_reports/review_T-E18-01.md` and `qa_reports/review_T-E18-02.md` cover incident replays, spec fidelity confirmed, golden fixtures regenerated, ratchets independently measured). Closes E18 ticket.

### Changed
- **gates/stamp-provenance.ts**: New module exporting the `isHandAuthoredStamp(lastUpdated)` predicate and the `STAMP_PROVENANCE_SUSPECT` gate pieces.
- **tools/handoff-orchestrator.ts**: Integrated STAMP_PROVENANCE_SUSPECT gate (after validateTransition, before feature-lease) + QA_COMPLETION_EVIDENCE_MISSING check (qa-engineer path, APPROVED-row exempt).
- **tools/drift.ts**: Imports and reuses the `isHandAuthoredStamp` predicate verbatim for stampAdvisory consistency.
- **gates/registry.ts**: Catalog expanded 30→32 errors; new STAMP_PROVENANCE_SUSPECT and QA_COMPLETION_EVIDENCE_MISSING registered.
- **content/const-08-chain-31-mid.md**: Two §3.1 mechanism bullets added (v3.86.0, E18).
- **content/skill-release-engineer.md**: COORDINATOR-RELAYED hard line added (dispatch brief cannot override relay rule).
- **test/**: New `test/e18-write-provenance.test.mjs` (17 tests); compose-equivalence and context-budget golden fixtures regenerated (6 + 1 compose goldens; 3 budget ratchets); error-code contract test updated 30→32.

### Notes
- driftBaselineIds appended with T-E18-01, T-E18-02
- Chain: mini-chain sr(fable) → code-reviewer(APPROVED) → qa-engineer(PASS), one pass, 4 hops
- Responds to two out-of-band state-write incidents: v3.85.0 hand-authored closing write (E9A class); E5-cycle qa-impersonated completed_tasks pre-fill (incident disclosed in `qa_reports/review_T-E5-01.md`)
- No breaking changes to MCP tool surface or handoff schema; all changes additive (new gates, predicate-driven rejection)
- Gates-and-skill-dominant release (gates/stamp-provenance.ts + orchestrator integration + SOP amendment); test-heavy (17 new tests + 6 goldens ratcheted)

## [3.85.0] - 2026-07-14

### Added
- **`e5-intake-tiering` — Backlog intake loop + tiered cut-approval + cheapest-compliant-path intake (v3.85.0).** Delivers three integrated fixes to intake flow: (a) Backlog Intake Loop — coordinator auto-proposes or auto-starts the next open backlog ticket at feature close; auto-start gated by §3.1 cut-approval auto-tier qualification, else auto-propose; never auto-hops to release-engineer (PASS terminal per backlog risk note); (b) Cut-Approval Auto-Tier — §3.1 bullet + opt-in `cutApprovalAutoTier` config key in `tools/config.ts` (absent = disabled; empty `{}` = conservative defaults ≤2 files / P3 / no schema change / non-design-armed); thresholds and opt-in-only design honor backlog's risk notes verbatim; documented in `docs/config.md`; (c) Cheapest-Compliant-Path Intake — coordinator SOP step 4a adds phase decomposition: coordinator-direct (full within-SOP), mini-chain (2–3 roles), full-chain (4+ roles); § 2 test ownership + §3.2 builder ≠ judge hard floors preserved. Implementation: `content/coord-03-core-fallback.md` (Backlog Intake Loop h2), `content/const-08-chain-31-mid.md` (§3.1 auto-tier bullet), `content/coord-07-core-sop.md` (step 4a + phase classifications), `tools/config.ts` + `docs/config.md` (config key + docs). Test suite: `test/e5-intake-tiering.test.mjs` (31 pins covering tools/config.ts parse, content pins for const-08/coord-03/coord-07); context-budget ratchets independently re-measured (design-arm 7863, teamwork bundle 15958, non-design 5766). Full suite 1455/1455 green. Spec: `docs/backlog.md:1016–1047` (backlog row). Code-review APPROVED (`review_reports/review_T-E5-01.md`). QA verified (`qa_reports/review_T-E5-01.md` covers T-E5-01/02/03, spec fidelity confirmed, golden fixtures regenerated, ratchets independently measured). Closes E5 ticket.

### Changed
- **content/coord-03-core-fallback.md**: Backlog Intake Loop h2 added to PASS stop-condition row.
- **content/const-08-chain-31-mid.md**: §3.1 Cut-Approval Auto-Tier bullet added (threshold-gated auto-approval, opt-in arming, advisory/non-server-enforced).
- **content/coord-07-core-sop.md**: SOP step 4a Cheapest-Compliant-Path Intake added (phase decomposition: coordinator-direct / mini-chain / full-chain; §2/§3.2 hard-floor sentence).
- **tools/config.ts**: New `cutApprovalAutoTier` optional field + parser (absent/empty/malformed/defaults logic); `CUT_APPROVAL_AUTO_TIER_DEFAULTS` export with conservative thresholds.
- **docs/config.md**: `cutApprovalAutoTier` key documented (opt-in, defaults, example thresholds).
- **test/**: New `test/e5-intake-tiering.test.mjs` (31 tests); compose-equivalence and context-budget golden fixtures regenerated (6 + 1 compose goldens; 3 budget ratchets).

### Notes
- driftBaselineIds appended with T-E5-01, T-E5-02, T-E5-03
- Chain: mini-chain sr(fable) → code-reviewer(APPROVED) → qa-engineer(PASS)
- QA anomaly disclosed in `qa_reports/review_T-E5-01.md`: prior out-of-band impersonated completion write detected and superseded by real QA completion path; disclosure documented per governance-audit transparency
- No breaking changes to MCP tool surface or handoff schema; all changes additive (config key opt-in)
- Content-dominant release (skill & const amendments); small server-code addition (config parse logic in tools/config.ts)

## [3.84.0] - 2026-07-13

### Added
- **`e17-release-record-integrity` — Record-integrity Hard rule for release mechanics (v3.84.0).** Codifies Hard rule in release-engineer SOP: every file path named in commit messages, CHANGELOG entries, or release-notes bodies MUST appear in the `git diff --stat` of the commit being described, and every referenced report/spec path MUST exist on disk at write time. Prevents narrative fabrication from dispatch-brief memory (v3.83.0 incident: release message and CHANGELOG entry claimed nonexistent `tools/handoff-orchestrator.ts` change and nonexistent report paths, corrected post-release in commit a484a4d). Pinning suite `test/feature-lease.test.mjs` expanded with E17-S1..S4 dispatch pins (haiku-pinned feature-lease test assertions). Spec backfill: `specs/e17-release-record-integrity.md` (summarizing backlog incident). Test pinning: 1424/1424 suite green. Code-review APPROVED (review_reports/review_T-E17-03.md). QA verified (qa_reports/review_T-E17-04.md). Closes E17 ticket.

### Changed
- **content/skill-release-engineer.md**: Hard rule added (record-integrity rule #6 in rule sequence) — prescriptive verification: derive file lists from `git diff --stat` before writing records, verify report/spec paths exist on disk, claim only rounds whose reports exist.
- **templates/claude-code-agents/release-engineer.md**: Dispatch template updated with Hard rule instruction block.
- **test/feature-lease.test.mjs**: Test-pinning suite expanded with E17-S1..S4 pins (4 new haiku-pinned assertions verifying release-engineer record-integrity discipline).

### Notes
- driftBaselineIds appended with T-E17-01, T-E17-02, T-E17-03, T-E17-04
- Content-only release: no server-code changes to `tools/`, `guards/`, `index.ts` logic; updates to SOP skill text only
- E17 tracks forensic incident from v3.83.0 post-release correction (commit a484a4d)
- Full test suite including new E17 pins: 1424/1424 pass

## [3.83.0] - 2026-07-13

### Added
- **`e14-ci-ground-truth` — Verify-release CI ground-truth check (v3.83.0).** Adds Check 6 to `scripts/verify-release.mjs`: reads the latest completed CI run on main via `gh` and FAILs on non-success conclusion. Degrades gracefully (`gh` missing/unauthenticated or zero completed runs is WARN-and-continue, never a release blocker). Implements script check routine and release-engineer SOP step 9a integration; exercised live during this release's own self-check. Spec: `specs/e14-e16-release-hardening.md`. Code-review APPROVED (`qa_reports/archive/e14-e16-release-hardening/review_T-EB-03.md`). QA verified (`qa_reports/archive/e14-e16-release-hardening/review_T-EB-04.md`). Closes E14 ticket.
- **`e15-spawned-server-de-flake` — Spawned-server test de-flake (v3.83.0).** Addresses test flakiness in spawned-server integration tests via response-driven waits instead of fixed delays. Refactors wait patterns to detect server readiness from response content rather than time-based heuristics. Shipped in commit 3267a69 as a single-role qa-engineer ticket (test-only; no code-review round by design — §2 test ownership). QA evidence: `qa_reports/review_T-E15-01.md`. Closes E15 ticket.
- **`e16-judge-dispatch-charter` — Single-role judge-dispatch charter broadening (v3.83.0).** CONTENT-ONLY amendment — zero server-code change (`tools/`, `gates/`, `index.ts` untouched; `ALLOWED_TRANSITIONS` unchanged). Broadens the Amend-Resume Edge charter in Constitution §3.1 (`content/const-08-chain-31-mid.md`): the existing `resume_of`-gated pm→{code-reviewer,qa-engineer} edge is ALSO the sanctioned door for a PM-sanctioned FRESH single-role judge dispatch on a test-only/evidence-only ticket — not only a mid-chain resume. Same field, same trust mechanics, judge roles only (the field opens no edge to any build role). Adds a pointer sentence to the coordinator's Amend-Resume relay row (`content/coord-03-core-fallback.md`). Pinning suite `test/e16-judge-dispatch-charter.test.mjs`; golden fixtures regenerated. Full suite: 1420/1420 pass. Spec: `specs/e14-e16-release-hardening.md`. Code-review APPROVED (`qa_reports/archive/e14-e16-release-hardening/review_T-EB-03.md`). QA verified (`qa_reports/archive/e14-e16-release-hardening/review_T-EB-04.md`). Closes E16 ticket. *(Correction note: the v3.83.0 release commit message and the original version of this entry erroneously described a `tools/handoff-orchestrator.ts` gate-predicate change — no such change shipped; verified against the release diff.)*

### Changed
- **scripts/verify-release.mjs**: Added Check 6 (CI ground-truth read via `gh`; FAIL on non-success, WARN-and-continue on missing).
- **content/const-08-chain-31-mid.md**: §3.1 Amend-Resume Edge charter broadened — single-role judge dispatch bullet (content-only; no server code changed in this release beyond verify-release.mjs).
- **content/skill-release-engineer.md**: SOP step 9a line documenting the Check 6 CI ground-truth read.
- **content/coord-03-core-fallback.md**: pointer sentence on the Amend-Resume relay row referencing the §3.1 charter.
- **test/**: New pinning suite `test/e16-judge-dispatch-charter.test.mjs`; verify-release suite extended (VR-11..VR-16 incl. degradation paths); chain-arm golden fixtures regenerated; context-budget caps re-baselined (exact-measured).

### Notes
- driftBaselineIds appended with T-EB-01, T-EB-02, T-EB-03, T-EB-04
- E14, E15, E16 are a 3-item batch shipped as single feature (`e14-e16-release-hardening`) per small-batch precedent (C16+C10 scope rule)
- E15 was previously shipped in commit 3267a69; this release marks its formal completion alongside E14 and E16
- No breaking changes to MCP tool surface or handoff schema; all changes content-only (E16) or additive (E14, E15)
- Release-engineer self-check (step 9a) now exercises Check 6 live via `gh`

## [3.82.0] - 2026-07-13

### Added
- **`e9a-stamp-integrity` — No-MCP-path relay codification + stampAdvisory hand-authored forensics (v3.82.0).** Elevates the no-MCP-path emergency fallback from a per-incident workaround (D10, E1A, E13) to a sanctioned, formalized pattern in release-engineer SOP (Hard rule: "No-MCP-path sessions MUST relay, never hand-edit"). Adds `RELAY REQUIRED:` relay convention: when a release session has no MCP `tw_*` tool invocation path at all, it states the exact literal `tw_update_state` call as output to the coordinator instead of hand-editing `.current/handoff.md` directly. Implements new `stampAdvisory` field in `tw_detect_drift` output (read-only advisory reporting) that flags any drift entries with hand-authored `last_updated` timestamps outside the session's own durable `tw_update_state` writes (forensics: v3.75.0, v3.77.0, v3.80.0 all had hand-edited drift recoveries). Codified in `content/skill-release-engineer.md` (Hard rule #5: no-MCP-path relay + exact RELAY REQUIRED format), `tools/drift.ts` (stampAdvisory read-only advisory field), release-engineer SOP steps 2/12 (relay directive), and `test/drift-stamp-advisory.test.mjs` (suite validation). Full suite 1408/1408 pass. Spec: `specs/e9a-stamp-integrity.md`. Code-review APPROVED (`qa_reports/review_T-E9A-04.md`). QA verified (`qa_reports/review_T-E9A-05.md`). Closes E9A ticket.

### Changed
- **content/skill-release-engineer.md**: Hard rule #5 codified (no-MCP-path relay pattern with `RELAY REQUIRED:` format; exact literal `tw_update_state` calls relayed when session has no MCP path).
- **tools/drift.ts**: New `stampAdvisory` field added to `tw_detect_drift` output (read-only advisory reporting hand-authored-stamp detection).
- **test/drift-stamp-advisory.test.mjs**: New test suite validating stampAdvisory forensics.

### Notes
- driftBaselineIds appended with T-E9A-01, T-E9A-02, T-E9A-03, T-E9A-04, T-E9A-05
- E9A is a governance-resilience feature addressing the no-MCP-path emergency fallback used in v3.75.0, v3.77.0, and v3.80.0 incident recovery
- `stampAdvisory` is read-only advisory, never blocks any gate — purely informational forensics reporting
- No breaking changes to MCP tool surface, handoff schema, or transitions; no new gates
- Release-engineer SOP steps 2 and 12 now include relay directive for no-MCP-path sessions (coordinator confirms receipt before release is claimed complete)

## [3.81.0] - 2026-07-13

### Added
- **`e7-governed-git-surface` — All-roles sanctioned-git-ops whitelist (v3.81.0).** Generalizes D10's release-engineer git-ops safety rules to all roles via a new core-tagged Constitution §6 bullet (Security & Privacy) listing sanctioned operations (add/commit/tag/fast-forward push only; reset/rebase/clean/force-push/checkout --force blocked with status=Blocked + pending_notes explanation + handoff to coordinator). Release-engineer's D10 bullet rewritten as pointer-only cross-reference preserving recovery mechanics (Blocked + SHA example + step 3a re-baseline). Byte-budget bumped to account for §6 bullet in core-tagged dispatch arms (lite + chain). Implemented in `content/const-15-core-tail.md` (new §6 bullet), `content/skill-release-engineer.md` (pointer rewrite), and `test/context-budget.test.mjs` (budget recomputed). Spec: `specs/e7-governed-git-surface.md`. Code-review APPROVED (`qa_reports/review_T-E7-04.md`). QA verified (`qa_reports/review_T-E7-05.md`, 1394/1394 tests). Closes E7 ticket.

### Changed
- **content/const-15-core-tail.md**: New §6 bullet for sanctioned-git-ops whitelist (core-tagged, all roles).
- **content/skill-release-engineer.md**: D10 bullet rewritten as pointer-only cross-reference to §6, preserving recovery mechanics.
- **test/context-budget.test.mjs**: Byte-budget caps re-baselined to accommodate new const-15 bullet in every dispatch arm.

### Notes
- driftBaselineIds appended with T-E7-01, T-E7-02, T-E7-03, T-E7-04, T-E7-05
- E7 is a security-hardening feature generalizing release-engineer git safety to all roles via Constitution §6
- Core-tagged bullet ships in lite + chain dispatch arms, increasing byte budgets across all roles
- No breaking changes to MCP tool surface, handoff schema, or prompt system

## [3.80.0] - 2026-07-13

### Added
- **`e10-lease-override` — Feature-lease human override + non-work write exemptions (v3.80.0).** Introduces two new transient `tw_update_state` args: `lease_override` (coordinator-attested FEATURE_LEASE_HELD bypass for any edge; requires `lease-override:` audit note in `pending_notes`, else LEASE_OVERRIDE_AUDIT_MISSING gate fires) and `bookkeeping_write` (preserves `last_updated` timestamp on same-feature bookkeeping writes; rejects different-feature combinations with BOOKKEEPING_WRITE_INVALID_CHANGE-class error). Migration heal-write hard-wired to preserve `last_updated`. Adds two new Constitution §3.1 bullets (const-08-chain-31-mid.md) governing lease-override attestation and bookkeeping-mode semantics. File-mode only; SQLite behavior unchanged. No handoff schema version bump (both fields transient, never persisted — handoff remains v12). Implemented in `tools/handoff-orchestrator.ts` (gate logic + field validation), `content/const-08-chain-31-mid.md` (new governance bullets), and `test/lease-override.test.mjs` (suite: 1390/1390 pass). Spec: `specs/e10-lease-override.md`; architecture: `specs/e10-lease-override-architecture.md`. Code-review APPROVED (`qa_reports/review_T-E10-07.md`). QA verified (`qa_reports/review_T-E10-08.md`). Closes E10 ticket.

### Changed
- **tw_update_state tool args**: Added `lease_override` (string, optional) and `bookkeeping_write` (boolean, optional) parameters with strict validation and gate enforcement.
- **tools/handoff-orchestrator.ts**: LEASE_OVERRIDE_AUDIT_MISSING and BOOKKEEPING_WRITE_INVALID_CHANGE gate logic; `last_updated` preservation in migration heal-write path.
- **content/const-08-chain-31-mid.md**: Two new Constitution §3.1 bullets governing lease-override attestation semantics and bookkeeping-mode exclusive-feature requirement.

### Notes
- driftBaselineIds appended with T-E10-ARCH, T-E10-01, T-E10-02, T-E10-03, T-E10-04, T-E10-05, T-E10-06, T-E10-07, T-E10-08
- E10 is a governance-tooling feature enabling human intervention on blocked releases while maintaining audit trail + accounting for maintenance writes
- File-mode only (SQLite inert per AC-4); no breaking changes to MCP tool surface or handoff schema
- No new gates beyond LEASE_OVERRIDE_AUDIT_MISSING and BOOKKEEPING_WRITE_INVALID_CHANGE (both transient validations, no persistent state impact)

## [3.79.0] - 2026-07-13

### Added
- **`e13-terminal-marker-advisory` — Terminal-marker resilience fix (v3.79.0).** Broadens the feature-lease terminal marker (`gates/feature-lease.ts`) to accept closing writes via durable signature: exact triple `last_agent="release-engineer" && status="In_Progress" && next_role="pm"` (primary contract, still required) OR a fallback pattern matching `pending_notes[0]` against `/^Released v/` (file-mode only, resilience fallback). Covers two known incident classes where `next_role` was absent/dropped despite correct intent: (1) closing write omitting `next_role` (v3.75.0), and (2) correct closing write whose transient `next_role` was later dropped by an unrelated migration heal-write while `pending_notes` survived (v3.77.0). Scoped to file-mode only via orchestrator call-site enforcement (`tools/handoff-orchestrator.ts`); SQLite behavior unchanged. Implements gate-broadening predicate (`gates/feature-lease.ts` third conjunct), orchestrator scoping (`tools/handoff-orchestrator.ts` leaseFields param), release-engineer SOP resilience note (`content/skill-release-engineer.md` step 12-13 terminal-marker section), and test coverage (`test/feature-lease.test.mjs`, E13-R1 + 6 ACs). Full suite 1370/1370 pass. QA verified (`qa_reports/review_T-E13-06.md`). Closes E13 ticket.

### Changed
- **gates/feature-lease.ts**: Terminal marker third conjunct broadened to accept closing writes via `pending_notes[0]` signature (file-mode only, guarded at call site).
- **tools/handoff-orchestrator.ts**: leaseFields scoped to `FileHandoffStorage` only for resilience fallback.
- **content/skill-release-engineer.md**: Terminal-marker resilience note appended after step 13 (documents the fallback safety net and reiterates that steps 12-13 remain the primary contract).
- **test/feature-lease.test.mjs**: E13-R1 regression test + 6 ACs (pending_notes signature matching, file-mode enforcement, SQLite isolation).

### Notes
- driftBaselineIds appended with T-E13-01, T-E13-02, T-E13-03, T-E13-04, T-E13-05, T-E13-06, T-E13-07
- E13 is a resilience/governance ticket addressing silent lease-stalls from v3.75.0 and v3.77.0 closing-write incidents
- Terminal-marker relaxation is file-mode only (SQLite behavior preserved byte-for-byte per AC-4)
- No breaking changes to MCP tool surface, handoff schema, or prompt system

## [3.78.0] - 2026-07-12

### Added
- **`e9-release-self-check` — Release self-check gate (v3.78.0).** Introduces `scripts/verify-release.mjs` for independent post-push verification of release artifacts before closing the release (5 checks: tag-at-HEAD, pushed-to-origin, check-version green, CHANGELOG entry present, dist committed+parity at HEAD). Mandatory SOP step 9a; prevents incomplete/broken releases from being claimed PASS. Addresses v3.72.0 and v3.73.0 regression where releases were self-reported clean while actually broken. Implemented in `scripts/verify-release.mjs` with full test coverage (`test/verify-release.test.mjs`, 20 tests) and release-engineer SOP wiring (`content/skill-release-engineer.md` step 9a + Escalation Routes). Full suite 1370/1370 green. QA verified (`qa_reports/review_T-E9-04.md`). Closes E9 ticket.

### Changed
- **release-engineer SOP step 9a (new, mandatory)**: Run `node scripts/verify-release.mjs vX.Y.Z` post-push/gh-release, pre-closing-write. ALL checks MUST pass (exit 0) before proceeding to closing write. Any non-zero exit triggers Escalation Routes blockage and stops the release.
- **release-engineer Escalation Routes**: Added release-self-check failure mode row (`release self-check reports any FAIL`).

### Notes
- driftBaselineIds appended with T-E9-01, T-E9-02, T-E9-03, T-E9-04
- E9 is a release-integrity follow-up ticket addressing v3.72.0 + v3.73.0 false-clean self-reports
- Release-engineer SOP step 13 (closing-write read-back, AC10 mandatory) validates the closing write landed on server before emitting final `Done. Released` claim
- No breaking changes to MCP tool surface, handoff schema, or prompt system

## [3.77.0] - 2026-07-12

### Added
- **`e3-outcome-shaped-acceptance` — QA Phase 3.5 runtime-evidence gate (v3.77.0).** Introduces AC_EXECUTION_LOG_MISSING (28th gate) to enforce proof annotations in feature specs as a precondition for QA PASS. Three legs: PM AC schema specification (`content/skill-pm.md` proof guidance), QA Phase 3.5 runtime-evidence execution phase (`content/skill-qa-engineer.md`), and the AC_EXECUTION_LOG_MISSING evidence gate (`gates/ac-execution.ts` NEW, `gates/registry.ts`, `tools/handoff-orchestrator.ts`). Gate arms when the active feature spec has ≥1 line-leading `proof:` annotations and fires (file mode) on qa-engineer's PASS write if no `## AC Execution Log` H2 is present in the review file (motivated by F2 false-green to ensure outcome-shaped verification). Covers 8 ACs: AC schema, phase guidance, gate arm-detection, missing-log detection, test coverage, escalation routes, scope alignment, and visual/copy audit baselines. Full suite 1350/1350 pass. QA verified (`qa_reports/review_T-E3-QA.md`). Closes E3 ticket.

### Changed
- **skill-pm and skill-qa-engineer**: Added proof-annotation guidance and QA Phase 3.5 description per AC schema.
- **test suite**: New `test/ac-execution.test.mjs` (28 assertions covering arm-check, disposition, integration, and file-mode guard); re-baselined `test/error-code-contract.test.mjs` (27→28 gate entries), `test/context-budget.test.mjs` (skill-pm cap 3922→4128), `test/qa-visual-skill-split.test.mjs` (skill-qa-engineer cap 12950→14729).

### Notes
- driftBaselineIds appended with T-E3-ARCH, T-E3-01, T-E3-02, T-E3-03, T-E3-CR, T-E3-QA, T-E3-04, T-E3-REL, T-E3-DONE
- E3 is a governance-feature ticket closing a v3.76.0+ follow-up workstream: proof annotations + runtime-evidence phase + gate 28
- AC Execution Log manifest in `qa_reports/review_T-E3-QA.md` (Phase 3.5); test-infra path correction applied (gates-expected-red.test.mjs pattern → flat test/ac-execution.test.mjs)
- No breaking changes to MCP tool surface, handoff schema, or prompt system

## [3.76.0] - 2026-07-12

### Added
- **`e11-check-version-dist-parity` — dist/ build parity guard (v3.76.0).** Introduces `scripts/check-version.mjs` dist-parity verification to catch stale or mismatched `dist/index.js` at release time. Detects v3.74.0 regression (stale dist shipped to users). Adds `--strict` mode for CI gate, prints `dist/index.js parity OK (version)` on success. Implemented in `scripts/check-version.mjs` and `test/check-version.test.mjs`; gates release-engineer SOP step 7 pre-tag. Closes E11 ticket following post-v3.74.0 stale-dist incident review.
- **`e12-metrics-emit-dedupe` — Metrics emit de-duplication (v3.76.0).** Fixes v3.74.0 double-emit regression where `tools/metrics.ts` appendMetrics() could emit duplicate lines on concurrent release attempts (same feature, same closing write, multiple handoff refreshes). Adds idempotent emit via `metrics.jsonl` last-line read-back check; only unique features are appended. Implemented in `tools/metrics.ts` with `test/success-metrics.test.mjs` dedupe regression tests. Full suite 1323/1323 green. QA verified (`qa_reports/review_T-E11E12-03.md`). Closes E12 ticket following post-v3.74.0 metrics incident review.

### Changed
- **release-engineer SOP step 7**: `npm run build` followed by `node scripts/check-version.mjs` now mandatory pre-tag; gate returns exit code 0 on success, prints version parity line.
- **metrics emit**: `tools/metrics.ts` appendMetrics() now idempotent — duplicate features are silently skipped, preventing metric-line duplication on retried releases.

### Notes
- driftBaselineIds appended with T-E11-01, T-E12-01, T-E11E12-02, T-E11E12-03, T-E11E12-REL, T-E11E12-DONE
- E11+E12 are joint-release follow-up tickets addressing v3.74.0 (E8) release-integrity incidents: stale dist and double-emit
- No schema changes; fixes are additive to release-engineer SOP + metrics pipeline
- `npm run build` prebuild now includes `check:version` for every `tsc` run (v3.70.0+ chain standard)

## [3.75.0] - 2026-07-12

### Added
- **`e4-design-source-credibility-gate` — Design source credibility verification (v3.75.0).** Introduces SOURCE_CREDIBILITY_UNVERIFIED gate for design-armed features to ensure requirement sources are verified before work begins. Extends `gates/visual.ts` with credibility cell parser reading from design baseline manifests; new gate fires on pm→architect/sr-engineer edge when fetch-based modes (Figma/Sketch/XD/Penpot) have audited rows missing credibility attestation (`credibility: full-page-composite` required). Implements source verification in `gates/registry.ts` + `gates/visual.ts` + `tools/handoff-orchestrator.ts` check-order block. Complements E8 metrics: gates ensure source credibility + E8 measures outcome quality cross-feature. Full suite 1313/1313 green (1281 QA baseline + 32 E4 tests). QA verified (`qa_reports/review_T-E4-05.md`). See `specs/e4-design-source-credibility-gate.md` and `specs/e4-design-source-credibility-gate-architecture.md` for gate mechanism and design-auditor integration.

### Changed
- **SOP enhancement**: design-auditor step 2b requires credibility attestation (`credibility: full-page-composite`) on all audited rows for fetch-based design modes.
- **Gate check-order**: pm→{architect,sr-engineer} edge now checks source-credibility alongside existing cut-approval, scope-decision, external-refs gates (storage-mode agnostic, v11 schema — zero schema bump).

### Notes
- driftBaselineIds appended with T-E4-ARCH, T-E4-01, T-E4-02, T-E4-03, T-E4-04, T-E4-05, T-E4-REL, T-E4-DONE
- E4 integrates E8 v3.74.0 (v11→v12 schema: cumulative round counters + metrics emit). E4 adds SOURCE_CREDIBILITY_UNVERIFIED gate on v11 schema (zero schema bump, no E1A-style lease additions).
- Gate is dormant on image/PDF/paper design modes and when `## Source` section absent
- Handoff schema remains v11 (no migration needed — gate operates on existing visual evidence format)

## [3.74.0] - 2026-07-12

### Added
- **`e8-success-telemetry` — Per-feature success-side metrics emission (v3.74.0).** Introduces cumulative per-feature round counters (qa_round, review_round, visual_round) and hop_count to handoff schema (v11→v12 migration). Adds release-time metrics emission: release-engineer closing write emits feature metadata `{feature, tickets, rounds, hops, one_pass, released_version}` as JSON lines to `.current/metrics.jsonl` for cross-feature analytics on QA intensity, review cycles, and release velocity. Implements metrics collection in `tools/metrics.ts` + automatic best-effort emit on closing-write success in `tools/handoff-orchestrator.ts`. Includes `scripts/summarize-metrics.mjs` summarizer and `test/success-metrics.test.mjs` regression tests; full suite 1295/1295 green. QA verified (`qa_reports/review_T-E8-07.md`). See `specs/e8-success-telemetry.md` and `specs/e8-success-telemetry-architecture.md` for mechanism and analytics use cases.

### Changed
- **SOP enhancement**: release-engineer SOP step 11b (metrics emit) is automatic, best-effort; no manual action required on closing write.

### Notes
- driftBaselineIds appended with T-E8-ARCH, T-E8-01, T-E8-02, T-E8-03, T-E8-04, T-E8-05, T-E8-06, T-E8-07, T-E8-REL, T-E8-DONE
- Handoff schema v12: added `qa_round`, `review_round`, `visual_round`, `hop_count` fields (auto-migration from v11 on first read)
- Metrics emit is best-effort; absence does not fail the release

## [3.73.1] - 2026-07-12

### Fixed
- **`e1a-feature-lease-amendment` — Post-release lease terminal marker + negative-age hardening (v3.73.1).** Fixes feature-lease hold duration post-release by introducing the terminal-marker signature in `gates/feature-lease.ts` (release-engineer closing write status=In_Progress + next_role="pm" now signals feature-lease release; prior versions leaked ~30 min post-release because the closing write clobbered the QA PASS tuple). Adds negative-age guard: `last_updated` in future (clock skew) no longer blocks lease release; only fresh updates reset the lease TTL, preventing indefinite hold on time-jumped handoff files. Amendment architecture in `specs/e1-feature-scoped-state-design.md ## Amendment (2026-07-12)` section. Feature-lease regression tests extended (`test/feature-lease.test.mjs`, +18 tests); full suite 1263/1263 green. QA verified (`qa_reports/review_T-E1A-03.md`).

### Changed
- **SOP clarification**: release-engineer closing write (step 12) SOP text corrected — `agent_id` must be "release-engineer" (self-loop), never "pm" (stamps false audit trail). This ensures the feature-lease terminal-marker contract (last_agent="release-engineer" ∧ status="In_Progress" ∧ next_role="pm") is satisfied, releasing the lease post-PASS.

### Notes
- driftBaselineIds appended with T-E1A-01, T-E1A-02, T-E1A-03, T-E1A-04
- Feature-lease amendment is backwards-compatible (no schema bump, test-only validation)

## [3.73.0] - 2026-07-12

### Added
- **`e2-bugfix-repro-gate` — Bugfix-mode dispatch and repro-first gate enforcement (v3.73.0).** Introduces bugfix-mode signal mechanism (handoff schema v10→v11 adds `dispatch_mode?: "feature"|"bugfix"` field; absence-is-signal precedent = feature-mode default). Implements repro-first gate (`REPRO_MANIFEST_MISSING`) in `gates/registry.ts` blocking sr-engineer fix-phase writes until a qa_reports manifest documents the failing test(s). Integrates manifest parsing and gate enforcement in `tools/handoff-orchestrator.ts`. Extends `content/skill-pm.md`, `content/skill-sr-engineer.md`, `content/skill-qa-engineer.md` with bugfix-mode ticket-cut guidance, repro-first manifest step, and strict bugfix-mode PASS criterion (exact repro red-set green + zero new reds, load-bearing not advisory). Comprehensive architecture in `specs/e2-bugfix-repro-gate.md` and `specs/e2-bugfix-repro-gate-architecture.md`. Regression test suite added; full suite 1251/1251 green. QA verified (`qa_reports/review_T-E2-05.md`). Feature-mode chains remain byte-behavior-unchanged per AC5.

### Notes
- driftBaselineIds appended with T-E2-ARCH, T-E2-01, T-E2-02, T-E2-03, T-E2-04, T-E2-05, T-E2-06
- Handoff schema v11: `dispatch_mode` field added to track bugfix vs feature mode (migration from v10 auto-runs on read)

## [3.72.0] - 2026-07-12

### Added
- **`e1-feature-scoped-state-design` — Feature-scoped state isolation and release re-baseline (v3.72.0).** Introduces the feature-lease mechanism (`gates/feature-lease.ts` + `gates/registry.ts`) for serializing concurrent E-series features and coordinating release timing. Adds `FEATURE_LEASE_HELD` gate code blocking competing features during active release; re-baselines release-engineer SOP step 3a (mandatory pre-release HEAD re-fetch before version bump) to prevent concurrent-release collisions. Implements feature-lease acquire/release orchestration in `tools/handoff-orchestrator.ts` and transition rules in `tools/transitions.ts`. Enables future per-feature handoff-file scoping (E1b) and coordinator escalation routes (E1c). Comprehensive architecture in `specs/e1-feature-scoped-state-design.md`. Feature-lease tests added (`test/feature-lease.test.mjs`, 24 new tests); full suite 1235/1235 green. QA verified (`qa_reports/review_T-E1-05.md`). See specs for mechanism, rationale, and downstream enablement roadmap.

### Changed
- **SOP hardening**: release-engineer SOP now includes mandatory step 3a (re-baseline off `origin/HEAD` before bumping) to prevent version-collision race conditions when features are released concurrently in separate git worktrees.

### Notes
- driftBaselineIds appended with T-E1-01, T-E1-02, T-E1-03, T-E1-04, T-E1-05, T-E1-06
- Feature-lease mechanism is backwards-compatible (no handoff schema bump, gate is internal only)

## [3.71.1] - 2026-07-12

### Changed
- **`d10-release-engineer-git-stop-rule` — Release-engineer hard-stop rules and escalation routes (v3.71.1).** Adds critical Hard rule (STOP on push rejection / concurrent-release collision via D10 escalation case), reinforces no-force-push prohibition, and deepens `driftBaselineIds` baseline acknowledgment instructions in `content/skill-release-engineer.md`. Adds escalation-routes table row (non-fast-forward push rejection collision) and CRITICAL condition for task-cleanup misconfigurations triggering premature version-literal assertions. SOP scope clarified for major-version opt-in (explicit user confirmation required). Reinforcement hint added to `templates/claude-code-agents/release-engineer.md`. Regression test suite extended with 6 new pinning tests in `test/release-staging.test.mjs` covering git-state-collision scenarios and hard-rule enforcement. QA verified with 1211/1211 tests green. See `specs/d10-release-engineer-git-stop-rule.md`.

### Notes
- driftBaselineIds appended with T-D10-01, T-D10-02, T-D10-03, T-D10-REL

## [3.71.0] - 2026-07-11

### Added
- **`d6-host-capability-compose-axis` — Host-capability as a third compose axis for skills (v3.71.0).** Extends the skill-composition system with a host axis, mirroring the existing design/chain axes in `prompts/constitution-manifest.ts`. Skills are now split into core + `host:claude-code`-tagged fragments, allowing Claude-Code-specific prose (Task-tool dispatch, telemetry parsing, `~/.claude/agents` template instructions, watermark validation) to be excluded for non-Claude-Code hosts (Cursor, Continue, Anti-Gravity, plain MCP). Adds `host` parameter to `buildPromptForRole()`, reusing `ConstitutionSegment`/`includeSegment` fragment patterns. Mechanism documented in `specs/d6-host-capability-compose-axis.md` and `specs/d6-host-capability-compose-axis-architecture.md`. Backwards-compatible feature addition (MINOR bump). Code-review approved; QA verified with 1179+ tests green. See `qa_reports/review_T-D6-04.md`.

### Notes
- driftBaselineIds appended with T-D6-ARCH, T-D6-01, T-D6-02, T-D6-03, T-D6-04, T-D6-05, T-D6-06, T-D6-REL, T-D6-DONE
- Skill files now support host-targeted fragment tagging via `host:claude-code` in `<!-- origin:* -->` markers

## [3.70.0] - 2026-07-11

### Added
- **`d5-server-side-stale-dispatch-detection` — Server-side stale-dispatch liveness detection (v3.70.0).** Implements read-time staleness advisory for in-flight handoff dispatches. Handoff schema v9→v10 adds transient `dispatched_at` (ISO-8601) auto-stamped in `writeHandoffState` whenever a write sets `next_role`. `tw_get_state` surfaces a `stale_dispatch` advisory (`{role, dispatched_at, elapsed_minutes, threshold_minutes, message}`) when an in-flight dispatch has no state write for >15 min (fixed `STALE_DISPATCH_THRESHOLD_MIN`, read-path only, no new gates). Enables coordinator + agents to detect and handle dispatch liveness anomalies (hung agents, network partitions, race conditions). Zero new client args; orchestrator untouched; backwards-compatible MINOR bump. `content/skill-coordinator.md` gains Stale-dispatch Escalation Routes row + Crash-Resume step 0 instructions. Comprehensive architecture in `specs/d5-server-side-stale-dispatch-detection.md` and `specs/d5-server-side-stale-dispatch-detection-architecture.md`. Code-review approved; QA verified with 1179/1179 green. See `review_reports/review_T-D5-04.md`, `qa_reports/review_T-D5-05.md`.

### Notes
- driftBaselineIds appended with T-D5-ARCH, T-D5-01, T-D5-02, T-D5-03, T-D5-04, T-D5-05, T-D5-REL, T-D5-DONE
- Handoff schema v10: `dispatched_at` field added to track dispatch-write timestamps (migration from v9 auto-runs on read)

## [3.69.0] - 2026-07-11

### Added
- **`d9-qa-review-scoped-append` — Scoped QA review auto-append targeting (v3.69.0).** Implements `review_task_ids` field in `tools/registry.ts` and handoff-orchestrator resolution logic to scope the auto-append of QA evidence files to a specific subset of completed task IDs (rather than all tasks in a feature). Adds `QA_REVIEW_TARGET_REQUIRED` gate code to `gates/registry.ts` enforcing that releases with QA evidence must declare explicit target scope via this field. Updates `content/skill-qa-engineer.md` with new auto-append scoping semantics and gate documentation. Adds regression test suite `test/qa-review-scoped-append.test.mjs` (1173/1173 tests pass). Re-baselines `test/error-code-contract.test.mjs` and `test/qa-visual-skill-split.test.mjs` for new gate code. Observable behavior addition (new field + gate code = MINOR bump). Comprehensive spec in `specs/d9-qa-review-scoped-append.md`; code review approved (`review_reports/review_T-D9-01.md`); QA verified (`qa_reports/review_T-D9-05.md`).

### Notes
- driftBaselineIds appended with T-D9-01, T-D9-02, T-D9-03, T-D9-04, T-D9-05, T-D9-REL, T-D9-DONE
- `review_task_ids` field added to handoff schema (schema version unchanged; new optional field)

## [3.68.1] - 2026-07-11

### Changed
- **`d8-lite-recommended-model` — Lite skill recommended model bump (v3.68.1).** Bumps `content/skill-coordinator-lite.md` frontmatter `recommended_model: haiku → sonnet`. Rationale: the lite skill's direct-invocation surface (e.g., `/teamwork-lite`, SessionStart hook default) has no corrective watermark-validation layer, unlike the Task-subagent dispatch path, so recommending the tier with documented §1 (watermark) compliance weaknesses creates unguarded risk. Decision made post-QA-FAIL per backlog D8's "decide directly" instruction given unavailable live D4 eval evidence and near-zero remaining bundle trim margin. Mirror doc updated (`docs/skills/coordinator-lite.md`); test amended to encode the deliberate `@lite` Task-subagent template divergence as a dated exemption (post-QA-FAIL reconciliation, T-D8-03). All 1107/1107 tests pass; 0 unrelated regressions. PATCH bump. See `specs/d8-lite-recommended-model.md`, `qa_reports/review_T-D8-03.md`.

### Notes
- driftBaselineIds appended with T-D8-01, T-D8-02, T-D8-03, T-D8-REL, T-D8-DONE

## [3.68.0] - 2026-07-11

### Added
- **`d2-server-brake-accounting` — Server-side hop-cap brake + durable token-usage accounting (v3.68.0).** Implements server-enforced cost-side circuit breakers, replacing in-memory coordinator arithmetic with durable, persisted field tracking. (1) Hop Counter Brake: adds `hop_count` field to `handoff.md` (schema v9, seed 0), incremented deterministically by `tools/transitions.ts`, with `HOP_CAP_EXCEEDED` gate enforcing 10-hop limit per feature. Feature-scoped reset on (pm, In_Progress) landing edge with exemption for the same-feature re-entry edge. (2) Token Budget Brake (opt-in): adds `bin/agent-governance-usage-hook.mjs` PostToolUse hook (best-effort, never-throw) appending `{ts, feature, dispatch, usage}` records to `.current/usage.jsonl` sidecar; coordinator reads sidecar (with hand-sum fallback to `agent-*.jsonl` for backward-compat) instead of model-maintained arithmetic. Handoff schema v8→v9 migration adds `hop_count` field to all extant task records (seed 0 for backward-compat, no replay required). Updated `content/skill-coordinator.md` (Token Budget Brake section) and `content/skill-coordinator-lite.md` to document feature-scoped reset mechanics. Comprehensive architecture documented in `specs/d2-server-brake-accounting.md` and `specs/d2-server-brake-accounting-architecture.md`. Code-review approved; QA verified with 1165/1165 green. See `review_reports/review_T-D2-04.md`, `qa_reports/review_T-D2-05.md`.

### Notes
- driftBaselineIds appended with T-D2-ARCH, T-D2-01, T-D2-01A, T-D2-01B, T-D2-02, T-D2-03, T-D2-04, T-D2-05, T-D2-REL, T-D2-DONE
- `hop_count` field added to handoff schema v9 (migration from v8 auto-runs on read)
- `.current/usage.jsonl` is new append-only sidecar for token accounting (created on-demand by hook)

## [3.67.1] - 2026-07-11

### Added
- **`d7-qa-reports-archive` — QA Reports Archive SOP (v3.67.1).** Introduces release-engineer SOP step 7a to archive shipped feature qa_reports into `qa_reports/archive/<active_feature>/` subdirectory, preventing stale evidence from cluttering the root during multi-feature releases. Updates `content/skill-release-engineer.md` with new SOP step 7a, allowlist annotation (archive path excluded from `evidence-file.ts` coverage scans via `.md`-suffix + non-recursive readdirSync), and no-clobber move semantics per Constitution §2 safety rules. Adds regression test to `test/covering-evidence.test.mjs` (1107/1107 tests pass) pinning AC8-b invariant: `buildCoverageIndex` tolerates archive/ subdirectories and never surfaces archived ids. QA verified empirically via temp-fixture probe against compiled production code (dist/tools/evidence-file.js, dist/gates/qa-review.js) demonstrating bit-for-bit identical behavior with/without archive present. Backwards-compatible; PATCH bump. All acceptance criteria met; see `specs/d7-qa-reports-archive.md`, `qa_reports/review_T-D7-02.md`, `review_reports/review_T-D7-01.md`.

### Notes
- driftBaselineIds appended with T-D7-01, T-D7-02, T-D7-REL, T-D7-DONE

## [3.67.0] - 2026-07-10

### Added
- **`d4-behavioral-eval-harness` — Behavioral compliance eval harness (v3.67.0).** Adds `test/eval/` bundle loader infrastructure with assertion helpers and 7 compliance scenarios covering role routing, state machine transitions, gate enforcement, and drift detection. Provides on-demand `npm run eval` runner for live evaluation of core constraints. Live smoke tests (AC-10) deferred due to missing `ANTHROPIC_API_KEY` — fail-fast path (AC-11) independently verified as substitute evidence. Full feature scope documented in `specs/d4-behavioral-eval-harness.md`; QA verified with human-waived scope (degraded). All 1089/1089 tests pass. See `qa_reports/review_T-D4-09.md`, `review_reports/review_T-D4-08.md`.

### Notes
- driftBaselineIds appended with T-D4-01, T-D4-02, T-D4-03, T-D4-05, T-D4-06, T-D4-07, T-D4-08, T-D4-09, T-D4-REL, T-D4-DONE

## [3.66.0] - 2026-07-10

### Added
- **`d3-gate-fire-telemetry` — Gate-fire telemetry and retro procedure (v3.66.0).** Adds `tools/telemetry.ts` (65 lines) with `emitGateTelemetry()` function to record all gate rejections in `.current/telemetry.jsonl` (append-only, no locks). Splits `tools/handoff-orchestrator.ts` `handleUpdateState` into `handleUpdateStateCore` (unchanged frozen check-order body) + wrapper that emits telemetry on rejection. Adds `docs/gate-retro-procedure.md` — five-step periodic retro to parse telemetry, rank gate fires by frequency, flag zero-fire gates at N=5 releases (configurable), and surface findings for human review. No authoritatively-gated state change, no new API surface; pure observability sidecar. Enables load-bearing vs dead-weight distinction on gate rules — foundational for counter-pressure on superlinear rule-corpus growth (C-series tickets). QA verified; all 1089/1089 tests pass. See `specs/d3-gate-fire-telemetry.md`, `qa_reports/review_T-D3-05.md`.

### Notes
- driftBaselineIds appended with T-D3-01, T-D3-02, T-D3-03, T-D3-04, T-D3-05, T-D3-REL, T-D3-DONE

## [3.65.0] - 2026-07-10

### Added
- **`d1-prompt-arg-workspace-fallback` — Shape-gating for `workspace_path` arg (v3.65.0).** Adds `looksLikePath()` heuristic to `resolveWorkspacePath()` in `index.ts` to prevent free-text prompt arguments (e.g. natural-language questions in any script) from being misinterpreted as broken workspace paths. When the arg does not look path-shaped (`/`, `\`, `.`, `~`), it falls through to the `CLAUDE_PROJECT_DIR` env / `cwd` fallback chain, matching pre-D1 behavior for absent args. Path-shaped-but-missing args remain byte-identical to pre-D1 (C6's "resolution suspect" diagnostic still fires). Fixes live repro 2026-07-10: `/teamwork-lite <free text>` now resolves the real workspace state instead of rendering the S01a "not managed" footer. QA verified; all 1071/1071 tests pass. See `specs/d1-prompt-arg-workspace-fallback.md`, `qa_reports/review_D1-03.md`, `review_reports/review_D1-02.md`.

### Notes
- driftBaselineIds appended with D1-01, D1-02, D1-03, D1-REL, D1-DONE

## [3.64.1] - 2026-07-10

### Changed
- `content/const-06-chain-31-head.md` L8: phrasing fix — "After 3 QA FAILs (Round 4)" → "After the `qa_round` cap of QA FAILs (Round 4 of `qa_round`)" for consistency with A12 naming convention.
- `test/compose-equivalence.test.mjs` golden fixtures regenerated (6 updates).
- `test/context-budget.test.mjs` AC8 design-arm floor rebaselined: 6391 → 6399 ~tok; teamwork bundle 12538 → 12547 ~tok; non-design floor 4293 → 4302 ~tok.

### Notes
- driftBaselineIds appended with T-A12F-03

## [3.64.0] - 2026-07-10

### Added
- **`a12-partials-limits-registry` — Skill-partials registry and Limits-table refactor (v3.64.0).** Introduces `prompts/partials-manifest.ts` canonical partial-file registry, wired into `buildPromptForRole()` render paths for const/ and skill/ composition. Adds `## Limits` table to `content/const-01-core-head.md` (8 named limits: `qa_round` cap 3, `review_round` cap 3, `visual_round` cap 5, hop cap 10, fix-try cap 2, file-read cap 3, design-auditor pass budget 250×5, sr-engineer task-size budget ≤5 files/300 lines) with name-references rewritten across all const-*.md and skill-*.md files, replacing bare-number restatements. Refactors byte-identical step-1 preflight line across 5 skills (architect, pm, design-auditor, researcher, sr-engineer) into one canonical partial, eliminating silent-drift hazard on SOP edits. Fixes qa-visual visual_round framing (const-09: "cap is 5 rounds" → `visual_round` name-reference; skill-qa-visual.md: "round cap (6)" corrected to 5). Context-budget rebaselined: lean bundle ≤4027 tok, design-arm floor ≤6391 tok, teamwork bundle ≤12538 tok, non-design floor ≤4293 tok (skill-pm ≤3196 / skill-sr-engineer ≤2469 caps unchanged, repointed to partial-composed text). Golden compose-equivalence fixtures regenerated. Backwards-compatible; MINOR bump. QA verified; all 1067/1067 tests pass. See `specs/a12-partials-limits-registry.md`, `qa_reports/review_T-A12-04.md`, `review_reports/review_T-A12-01.md`.

### Changed
- `prompts/partials-manifest.ts` new file — canonical registry of shared partials and their file paths.
- `prompts/build.ts` `buildPromptForRole()` refactored to wire partial-composition into const-order and skill-order render paths.
- `content/const-01-core-head.md` `## Limits` table added (pre-§1 position).
- `content/const-08`, `const-09`, `const-12`, `const-15` — bare-number limits rewritten as name-references.
- `content/skill-architect.md`, `skill-pm.md`, `skill-design-auditor.md`, `skill-researcher.md`, `skill-sr-engineer.md` — step-1 preflight line sourced from partial; state-update rule restated → removed (inherit from const-05 per const-01 mandate).
- `content/skill-qa-engineer.md`, `skill-code-reviewer.md`, `skill-qa-visual.md`, `skill-coordinator.md` — bare-number limits rewritten as name-references.
- `test/context-budget.test.mjs` AC8 design-arm floor rebaselined to 12247 ~tok; skill-pm ≤3196 tok; skill-sr-engineer ≤2469 tok.
- `test/compose-equivalence.test.mjs` golden fixtures regenerated (`test/fixtures/compose-golden/*.txt`).
- `test/subagent-templates.test.mjs` assertions updated to reflect partial-composition changes.
- `test/skill-evolution-v3.11.test.mjs` assertions swept and updated.

### Notes
- Non-blocking follow-up for PM/release: const-06-chain-31-head.md L8 restates qa_round value outside A12 scope (noted for future const-06 landing or follow-up ticket per sr-engineer + code-reviewer concurrence).
- driftBaselineIds appended with T-A12-01..09
- `docs/backlog.md` A12 row marked DONE with v3.64.0 tag reference

## [3.63.0] - 2026-07-10

### Added
- **`b9-token-budget-brake` — Optional cost-side circuit breaker for per-feature token budgets (v3.63.0).** Introduces opt-in, off-by-default token-budget brake that complements count-side caps. Enabled ONLY when `.current/.config.json` sets `tokenBudgetPerFeature` to a positive finite number; invalid values filter to absent (no schema_version bump). When enabled, running token total (input + output + cache read + cache creation) across all subagent dispatches within a `/teamwork` invocation is tracked in-memory (session-scoped, not persisted). When running total reaches or exceeds 80% of `tokenBudgetPerFeature`, stop routing and surface the running total, ceiling, and percentage. Halt semantics mirror hop-cap: observe/halt only, no state write, no new persisted field, no schema bump — advisory-only. Adds "Token Budget Brake" subsection to `content/skill-coordinator.md` Auto-Routing section with detailed enablement and escalation semantics. Updates Escalation Routes table with 80%-ceiling row. New test file `test/token-budget-config.test.mjs` (13 tests) covering config loading, invalid-value filtering, and brake-disabled state. Context-budget cap rebaselined (11815 → 12247 ~tok). One Copy/Strings regression in `test/subagent-templates.test.mjs` fixed. Backwards-compatible; MINOR bump. QA verified: all 5 acceptance criteria (AC1–AC5) passed; all 1043/1043 tests pass. See `specs/b9-token-budget-brake.md`, `qa_reports/review_T-B9-03.md`, `review_reports/review_T-B9-01.md`.

### Changed
- `tools/config.ts` `ConfigType` now includes optional `tokenBudgetPerFeature?: number`.
- `tools/config.ts` `loadConfig()` filters invalid token budget values to absent.
- `content/skill-coordinator.md` "Token Budget Brake" subsection added to Auto-Routing section.
- `content/skill-coordinator.md` Escalation Routes table updated with 80%-ceiling token-budget-brake row.
- `test/context-budget.test.mjs` AC8 design-arm floor bumped to 12247 ~tok.
- `test/subagent-templates.test.mjs` Copy/Strings assertion fixed.

### Notes
- driftBaselineIds appended with T-B9-01..05
- `docs/backlog.md` B9 row marked DONE with v3.63.0 tag reference

## [3.62.0] - 2026-07-10

### Added
- **`c17-dispatch-brief-template` — Dispatch Brief Template subsection (v3.62.0).** Adds a new "Dispatch Brief Template" subsection to `content/skill-coordinator.md` under the Auto-Routing section, providing agents with a standardized template structure for subagent dispatch briefs (6 invariant lines: upstream pending_notes summary, subagent type, task list, branching strategy, assumptions, success criteria). Updates the "Subagent Dispatch (Claude Code)" paragraph to point dispatch brief authoring at the template rather than ad-hoc phrasing. Context-budget rebaselined (test/context-budget.test.mjs AC8 design-arm floor: 11445 → 11815 ~tok). Backwards-compatible; MINOR bump. QA verified: all acceptance criteria met; 1043/1043 tests pass. See `specs/c17-dispatch-brief-template.md`, `qa_reports/review_T-C17-03.md`.

### Changed
- `content/skill-coordinator.md` "Dispatch Brief Template" subsection added to Auto-Routing section.
- `content/skill-coordinator.md` "Subagent Dispatch (Claude Code)" paragraph updated to point at template.
- `test/context-budget.test.mjs` AC8 design-arm floor bumped to 11815 ~tok.
- `test/subagent-templates.test.mjs` assertion added verifying Dispatch Brief Template section presence.

### Notes
- driftBaselineIds appended with T-C17-01..05
- `docs/backlog.md` C17 row marked DONE with v3.62.0 tag reference

## [3.61.0] - 2026-07-10

### Added
- **`c12-registry-field-consumers` — Registry field parity tests (v3.61.0).** Implements option (b) assert: extends A10/DR-3's existing generative-parity test pattern to `triggerEdge` and `armCondition` doc-facing fields in `gates/registry.ts`, adding 7 new parity test cases to `test/error-code-contract.test.mjs`. Eliminates the fourth unverified copy of gate semantics and ensures registry comments remain synchronized with code. No schema_version bump, no new tw_* tool, no code changes beyond test assertions (one comment-only edit to `gates/registry.ts`). Backwards-compatible; MINOR bump. QA verified via Phase 0.5 dogfood: all acceptance criteria independently verified; 1042/1042 tests pass. See `specs/c12-registry-field-consumers.md`, `qa_reports/review_T-C12-02.md`.

### Changed
- `gates/registry.ts` assertion comment expanded to document field parity contract.
- `test/error-code-contract.test.mjs` 7 new test cases for `triggerEdge` and `armCondition` field validation.

### Notes
- driftBaselineIds appended with T-C12-01..05
- `docs/backlog.md` C12 row marked DONE with v3.61.0 tag reference

## [3.60.0] - 2026-07-10

### Added
- **`a8-single-owner-dedup` — Self-converge relaxation dedup + pointer consolidation (v3.60.0).** Eliminates duplicate restatement of the self-converge relaxation mechanism across Constitution §1 and skill-sr-engineer.md; consolidates into a single-owner pattern where the constitution owns the full normative text and skill text shrinks to a pointer line ("see Constitution §1"). Two content-only edits to `content/skill-sr-engineer.md`. Precedent set by C2 (cut-approval consolidation, v3.47.0) and C1 (amend-resume routing, v3.42.0). No schema_version bump, no new tw_* tool, no code changes. Backwards-compatible; MINOR bump. QA verified via Phase 0.5 dogfood: all 5 acceptance criteria (AC1–AC5) independently verified; single flaky test (prompt-state-footer.test.mjs e2e subprocess timing) confirmed pre-existing, not a regression. See `specs/a8-single-owner-dedup.md`, `qa_reports/review_T-A8-05.md`.

### Changed
- `content/skill-sr-engineer.md` step 7 now references Constitution §1 for self-converge relaxation details instead of restating.

### Notes
- driftBaselineIds appended with T-A8-01..05
- `docs/backlog.md` A8 row marked DONE with v3.60.0 tag reference

## [3.59.0] - 2026-07-10

### Added
- **`c5-c18-watermark-configcache` — Watermark replace logic fix + configCache mtime invalidation (v3.59.0).** C5(a) de-hardcodes the CRITICAL watermark reminder tier across all `templates/claude-code-agents/*.md` files to read the actual model tier invoked with; C5(b) fixes `lib/watermark-check.ts` validateWatermark's mismatched-watermark branch to replace (not double-append) the wrong trailing line. C18 adds mtime-based invalidation to `tools/config.ts`'s `configCache` to ensure config changes are reflected immediately in-process (documented trade-off: identical mtime serves cached value). Authored `test/watermark-check.test.mjs` additions (no-double-stamp + mismatch-branch idempotency + CRLF + watermark-only edges) and new `test/config-cache.test.mjs` (in-process mtime-driven reload + existence-transition cases). Phase 0.5 Expected-Red Diff run confirmed 5/5 manifest entries genuinely red, all re-baselined. Full suite 1035/1035 pass. See `specs/c5-c18-watermark-configcache.md`, `qa_reports/review_T-C5C18-06.md`, `review_reports/review_T-C5C18-01.md`.

### Changed
- Template watermarks now read `(<the model tier you were actually invoked with>)` instead of hardcoded `(haiku)` in 12 template files.
- `tools/config.ts` configCache now checks file mtime on each `loadConfig` call; identical mtime returns cached value; changed mtime triggers reload.

### Notes
- driftBaselineIds appended with T-C5C18-01..08
- `docs/backlog.md` C5 and C18 rows marked DONE with v3.59.0 tag reference

## [3.58.0] - 2026-07-10

### Added
- **`c16-c10-role-boundary` — Code-reviewer gate + release-engineer SOP step 11 for backlog done-marking (v3.58.0).** Introduces REVIEWER_COMPLETED_TASKS_REJECTED gate (C16) to enforce code-reviewer attestation boundary: when a code-reviewer completes any task while in the review pass, they bypass the normal peer-review process. Gate applies post-PASS (if any tasks remain INCOMPLETE after code-reviewer exit) to prevent self-approval of code changes. Wired in `gates/registry.ts` + `tools/handoff-orchestrator.ts`. Also elevates backlog done-marking into release-engineer's SOP (C10, step 11): WHEN `docs/backlog.md` exists AND the active feature traces to one or more backlog rows, release-engineer marks the active feature's row(s) DONE with a one-line mechanism summary and release commit reference (tag or sha). This folds ad hoc post-PASS backlog-marking (previously a PM/coordinator task) into release-engineer's own SOP, alongside version bump and CHANGELOG. Content updates to `skill-release-engineer.md`, `skill-qa-engineer.md`, `skill-pm.md`, and `skill-code-reviewer.md`. 7 C16-C10 subtasks completed; QA baseline regenerated. See `specs/c16-c10-role-boundary.md`, `qa_reports/review_T-C16-04.md`, `review_reports/review_*.md`.

## [3.57.0] - 2026-07-10

### Added
- **`c15-expected-red-manifest` — Expected-Red SOP surface + manifest-diff gate (v3.57.0).** Introduces expected-red manifest convention and integration: qa-engineer Phase 0.5 authors `qa_reports/expected-red_<feature>.txt` documenting "expected red" test outcome (known failures, flakes, or intentionally deferred). Skill-sr-engineer.md step 7a updates to emit manifest on release. Code-reviewer performs manifest sampling (4a) during review. New gate `EXPECTED_RED_DIFF_MISSING` (21st in gate sequence) wired at qa PASS transition; gate fires in file-mode only (dormant when no manifest authored, consistent with manifest-optional design). Gate enforces that expected-red manifest must exist and be committed when feature is marked PASS in file-mode (mirrors visual-baseline convention). No schema bump: new gate does not alter handoff/tasks YAML structure or zod boundaries. Feature shape mirrors VISUAL_EVIDENCE_MISSING gate — single gate module `gates/expected-red.ts`, registry entry, orchestrator wiring. 8 T-C15-* tasks completed; all test suites green. See `specs/c15-expected-red-manifest.md`, `qa_reports/expected-red_c15-expected-red-manifest.txt`, `review_reports/review_T-C15-*.md`.

## [3.56.0] - 2026-07-09

### Added
- **`c14-dispatch-pins` — Model-tier dispatch pins as first-class persistent handoff field (v3.56.0).** Elevates dispatch-time model-pin convention (e.g., `dispatch_pins: sr-engineer=fable`) from ad-hoc `pending_notes` tokens into a dedicated, typed `dispatch_pins` field in handoff state. Adds zod-validated `dispatch_pins?: Record<AgentName, ModelTier>` field to handoff YAML schema; field is transient/write-scoped (not preserved across writes unless explicitly re-set), allowing agents to declare model overrides at dispatch time and have them survive context loss during a role's execution. New consistency gate: `dispatch_pins` values must match the closed set of AgentName and ModelTier enums. Handoff schema v7→v8 migration (stamp-only: `dispatch_pins` absent on migrated files means "no pins recorded"). SOP updates: skill-coordinator.md updated to read and honor `dispatch_pins` on role dispatch; skill-sr-engineer.md, skill-qa-engineer.md, and skill-release-engineer.md updated to respect dispatch-time pin contracts. Constitution const-01-core-head.md updated with pin-override rule (when `dispatch_pins` records a model tier for your role, you MUST use that tier; Constitution §1 watermark accordingly). 12 T-C14-* tasks completed; build 997/997 tests green (4 new tests in test/dispatch-pins.test.mjs, baseline regenerated). Reuses v3.55.0's c9-protocol-fields pattern (schema bump + zod closed-enum + skill-text migration). See `specs/c14-dispatch-pins.md`, `specs/c14-dispatch-pins-architecture.md`, `qa_reports/review_c14-dispatch-pins.md`, `review_reports/review_T-C14-*.md`.

## [3.55.0] - 2026-07-09

### Added
- **`c9-protocol-fields` — Structured routing/review fields in handoff state (v3.55.0).** Migrates three load-bearing protocol signals from free-text `pending_notes` conventions into dedicated handoff fields: `next_role` (which role should act next), `resume_of` (which stranded role a PM amendment resumes), and `review_verdict` (code-reviewer's verdict: APPROVED or CHANGES_REQUESTED). New zod schema validation at the `tw_update_state` boundary: `next_role` must be one of 8 AgentName values; `resume_of` must be one of {code-reviewer, qa-engineer}; `review_verdict` must be one of {APPROVED, CHANGES_REQUESTED}. New consistency gate: when `agent_id==="code-reviewer"` and `review_verdict` is present, an `APPROVED` verdict MUST pair with `status !== FAIL` (and vice versa for CHANGES_REQUESTED). All three fields are transient, write-scoped directives (absent on each write unless explicitly set — they are NOT blindly preserved or feature-scoped-preserved). Updates `tools/transitions.ts` Amend-Resume Edge to read structured `resume_of` field instead of pending_notes substring grep. Handoff schema v6→v7 migration (stamp-only, mirrors v3→v4 and v4→v5 precedent: absence of new fields on migrated files means "no signal recorded", not synthesized default). Skill updates: skill-pm.md, skill-coordinator.md, skill-code-reviewer.md, skill-sr-engineer.md, and skill-qa-engineer.md updated to emit/consume the structured fields instead of convention tokens. Five-layer defense: zod schema validation (tool boundary), consistency gate (review_verdict↔status), transient-semantic enforcement (write-scoped not feature-scoped), decision-record contrast (explicit vs. external_refs/cut_approved), and skill-text documentation. 16 T-C9-* tasks completed; build 973/973 tests green. See `specs/c9-protocol-fields.md`, `specs/c9-protocol-fields-architecture.md`, `qa_reports/review_c9-protocol-fields.md`, `review_reports/review_T-C9-01.md`.

## [3.54.0] - 2026-07-09

### Added
- **`c7-version-assertion-ownership` — Dynamic version assertions (v3.54.0).** Implements AC-9 version assertions in `test/baseline-manifest-gate.test.mjs` and `test/pixel-gate-attestation.test.mjs` to read target version dynamically from `package.json`/`index.ts` at test time (numeric-tuple floors); eliminates need for test edits on version bumps. Adds narrow import-path-retarget carve-out in Constitution §2 (`content/const-05-core-standards.md`) for version-comparison AST logic, gated to `@agent-governance-mcp/internal` marker. New STOP+route-to-qa rule in `skill-release-engineer.md` (S02): if hardcoded version literal found in test during release, release-engineer routes to qa-engineer (Constitution §2 violation). 11 compose-golden fixtures regenerated; 4 context-budget caps rebaselined. See `specs/c7-version-assertion-ownership.md`, `qa_reports/review_T-C7-QA.md`, `review_reports/review_T-C7-CR.md`.

## [3.53.0] - 2026-07-09

### Added
- **`c8-crash-resume-protocol` — Mid-role crash recovery: ground-truth working tree, restate findings, re-assert dispatch-time model pins (v3.53.0).** Adds skill-coordinator.md crash-resume protocol (three-step procedure: ground-truth the working tree vs role's last claims via git status; restate findings in the resume brief; re-assert dispatch-time overrides like model pins from dispatch notes, verifying resumed run honors them). New dispatch_pins convention in pending_notes (records dispatch-time model pins surviving context loss). New pinned-tier expectation in Watermark Validation section. New Crash detection row in Escalation Routes table (routes to Crash-Resume Protocol). Content-only, no schema bump, no new tw_* tool. 6 C8 subtasks (T-C8-01..04 implementation + T-C8-CR code review + T-C8-QA verification); build 959/959 tests green; test/context-budget.test.mjs AC8 cap rebaselined 9699 → 10774 per QA. See `specs/c8-crash-resume-protocol.md`, `qa_reports/review_T-C8-QA.md`, `review_reports/review_T-C8-CR.md`.

## [3.52.0] - 2026-07-09

### Added
- **`b8-external-ref-ledger` — External-reference ledger + build-entry gate (v3.52.0).** Adds server-enforced EXTERNAL_REFS_UNRESOLVED gate to Constitution §7, blocking the PM→architect/sr-engineer build-entry transition while any recorded external reference remains `unresolved`. New `external_refs` field in handoff YAML (file-mode only): array of `{ref, state}` entries with closed-enum states (`fetched`, `indexed`, `user-confirmed-ignorable`, `unresolved`). Ledger is feature-scoped (reset on `active_feature` change) and preserves across writes in same feature. Mirrored attestation pattern mirrors `scope_decision`/`cut_approved` (AC-2 absence = "zero refs found", not unresolved sentinel). Gate fires on both PM→architect and PM→sr-engineer edges (AC-4); gated edge reset on Amend-Resume re-entry (AC-3); SQL-mode skips (AC-5). Handoff schema v5→v6 migration (stamp-only, `external_refs` absent on migrate). SOP updates: skill-pm.md Resource Audit Gate + skill-coordinator.md Auto-Routing stop-condition surface unresolved refs. Constitution §7 wording reflects enforcement. 11 B8 subtasks + QA completed; 959/959 tests (938 baseline + 21 new). See `specs/b8-external-ref-ledger.md`, `qa_reports/review_b8.md`, `review_reports/review_b8.md`.

## [3.51.0] - 2026-07-08

### Added
- **`a11-escalation-grammar` — Escalation-route tables + WHEN/DO/ELSE rule grammar (v3.51.0).** Consolidates scattered escalation-call incantations into a canonical format defined once in Constitution §3 and expressed as one `## Escalation Routes` table per skill file. Adds one canonical **Escalation call format** bullet to `content/const-05-core-standards.md` and one **Rule grammar (WHEN/DO/ELSE)** bullet. Restructures escalation sites in 7 skill files (`skill-architect.md`, `skill-sr-engineer.md`, `skill-qa-engineer.md`, `skill-design-auditor.md`, `skill-code-reviewer.md`, `skill-coordinator.md`, `skill-release-engineer.md`) from prose to tabular form; light-touch cross-reference edits to `skill-pm.md` and `skill-qa-visual.md`. 11 content-only edits (A11-01..A11-11); no new data model, no schema_version bump, no new tw_* tool, no cross-cutting API surface change. Backwards-compatible; PATCH bump for consistency polish. See `specs/a11-escalation-grammar.md`, `qa_reports/review_a11-escalation-grammar.md`, `review_reports/review_a11-escalation-grammar.md`.

## [3.50.0] - 2026-07-08

### Added
- **`a13-section1-polish` — Constitution §1 unified output policy, watermark decision table, schema examples, context-budget cap bumps (v3.50.0).** Polishes Constitution §1 governance coverage by consolidating clause 1d output-format rules, adding a decision table for watermark role/tier selection, and including concrete schema examples for handoff/tasks formats. Nine content-only edits to constitution fragment + skill files; fixture/test-cap follow-up completed. No new data model, no schema_version bump, no new tw_* tool, no cross-cutting API surface change. Backwards-compatible; MINOR bump for polish. See `specs/a13-section1-polish.md`, `qa_reports/review_a13-section1-polish.md`, `review_reports/review_a13-review.md`.

## [3.49.0] - 2026-07-08

### Added
- **`c13-release-engineer-write-path` — Release-engineer legal write path + STOP-on-rejection rule (v3.49.0).** Closes the v3.48.0 release-wedge incident by adding two new backwards-compatible ALLOWED_TRANSITIONS edges: `qa-engineer:PASS → release-engineer:In_Progress` (AC-1, enables release-engineer to open with its own agent_id without coordinator intermediary) and `release-engineer:In_Progress → pm:In_Progress` (AC-2, completes the handoff to PM for post-release coordination). New §3 STOP-on-rejection rule (Constitution v3.40.0) — any tw_* call returning a ⛔ rejection must halt immediately; agents must hand back Blocked/FAIL with error verbatim (never hand-edit .current/handoff.md or tasks.md). SOP updates: skill-release-engineer.md step 10 driftBaselineIds appending + step 11 closing write to pm:In_Progress; templates/claude-code-agents/release-engineer.md workflow clarification. 7 C13 subtasks + driftBaselineIds step completed. Full implementation in tools/transitions.ts ALLOWED_TRANSITIONS map + index.ts STOP-on-rejection guard. Backwards-compatible; no schema_version bump. See specs/c13-release-engineer-write-path.md, qa_reports/review_C13-QA.md, review_reports/review_C13-REV.md.

## [3.48.0] - 2026-07-08

### Added
- **`c6-c11-prompt-state-injection` — Fail-loud handoff-state footer variants + constitution dedup (v3.48.0).** C6: Prompt state injection now fails loud when workspace path resolution is ambiguous (CLAUDE_PROJECT_DIR not set, cwd fallback, file not found, or parse error) — three footer variants (S01a/S01b/S02 per `specs/c6-c11-prompt-state-injection.md`) alert agents to call `resolveWorkspacePath()` or explicitly pass `workspace_path` to GetPrompt. Unified workspace-resolution logic at `resolveWorkspacePath()` in `index.ts` and reused across `prompts/build.ts`'s footer builder and handoff-state read paths (AC-4 consistency). C11: Constitution inject-dedup now uses two-level strategy — L1 in-memory per-workspace hook-marker flag (set post-SessionStart, cleared per-workspace on role switch) and L2 120s stale-sentinel file at `.current/.agc-hook-marker.json` (gitignored) — reduces duplicate injection from concurrent hook fires and session-boundary bleed, measured ~1500 token saving per deduped dispatch; token assertion pins ≥1200 (AC-9). Backwards-compatible; file-mode only for now; no schema version bump. Both fixes live in `prompts/build.ts` (S01a/S01b/S02 footer builder) and `bin/agent-governance-context.mjs` (SessionStart hook), with architecture decided in `specs/c6-c11-prompt-state-injection-architecture.md`. Closes backlog C6 (prompt state blindness) and C11 (constitution double-injection).

## [3.47.0] - 2026-07-08

### Added
- **`c3-covering-evidence` — Covering-report evidence mechanism for evidence checks (v3.47.0).** Evidence checks in `gates/qa-review.ts` (`hasEvidenceInFile`) and `gates/code-review.ts` (`hasCodeReviewEvidenceInFile`) now accept a covering report — a `covers: <id1>, <id2>, ...` line in one report file satisfies N task ids. Lazy directory scan triggered only on per-id miss; per-id files remain valid as the default. Closes backlog C3 (stub-pointer-file litter from batched review rounds). Parser/index helpers (`parseCoversIds`, `buildCoverageIndex`, `COVERS_LINE_RE`) live in `tools/evidence-file.ts`. File-mode only; no schema version bump; backwards-compatible with existing per-id evidence files.

## [3.46.1] - 2026-07-08

### Changed
- **`gate-registry` (backlog A10 + A2 folded in) — single structured source of truth for the 18-gate catalog (v3.46.1).** Introduces `gates/registry.ts` (`GATE_REGISTRY` — 18 typed `GateDefinition` entries: `errorCode`, `producer`, `envelope`, `triggerEdge`, `armCondition`, `clearingArtifact`, `hintStatic`, `documentedInProse`) as the single source `tools/transitions.ts` and the new `gates/*.ts` predicate modules source their error codes and hint text from, replacing three independently-drifting copies (code, constitution prose, skill prose) with one. `tools/evidence-file.ts` (994 lines) is split per backlog A2 into `gates/qa-review.ts`, `gates/code-review.ts`, `gates/visual.ts`, `gates/scope-decision.ts`, `gates/cut-approval.ts` — verbatim predicate moves, no behavior change — leaving `evidence-file.ts` as shared read/write plumbing only. Reconciled the gate catalog from the spec's stated 17 codes to the actual 18 (the spec omitted `MISSING_REVIEW_EVIDENCE`; see `specs/gate-registry-architecture.md`). `test/error-code-contract.test.mjs` rewritten as a generative parity test: imports the built registry and asserts registry↔code↔doc parity by construction (registry ⊆/⊇ doc-side backtick tokens, registry ⊆/⊇ code-side shape-rule harvest, `TransitionRejection["error"]` 12-member union ⊆ `ALL_GATE_CODES`) instead of a doc↔code regex-scrape. Pure re-plumbing: error codes, hint text, JSON/plain-text envelope shapes, frozen `tw_update_state` gate check order, and all `content/*.md` bytes are unchanged (zero `content/*.md` diff) — no schema_version bump, no new/removed gate, no observable behavior change. See `specs/gate-registry.md`, `specs/gate-registry-architecture.md`, `review_reports/review_A10-09.md`.

## [3.46.0] - 2026-07-07

### Added
- **`cut-approval-coordinator-attestation` — Constitution §3.1 single-owner Cut-Approval Gate + coordinator-attested trust rule (v3.46.0).** Extends the pm:In_Progress → architect/sr-engineer build-entry edge with coordinator attestation semantics: `cut_approved` may be set ONLY by the context that witnessed the human's chat-turn approval — in subagent dispatch, that is the coordinator itself via `tw_update_state(agent_id="pm", cut_approved: true, ...)`. Adds `Sanctioned writer (coordinator-attested approval)` section to §3.1, wiring the trust boundary at the handoff read side. New SOP step in skill-coordinator.md stop-condition 6. File-mode only (SQLite/HTTP skip the gate); backwards-compatible with existing ALLOWED_TRANSITIONS. Constitution header unchanged (v3.40.0 supersedes the feature).
- **`pm-repair-resume-routing` — Amend-Resume guarded edges pm→{code-reviewer,qa-engineer} via resume_of marker in tools/transitions.ts (v3.46.0).** Adds two new guarded edges to the ALLOWED_TRANSITIONS state machine: `pm:In_Progress → code-reviewer:In_Progress` and `pm:In_Progress → qa-engineer:In_Progress`, armed only when the write carries `resume_of: <role>` in pending_notes. Enables PM mid-chain spec amendments without manufacturing a detour through sr-engineer, addressing the "stranded downstream role" gap (see specs/pm-repair-resume-routing-architecture.md). Honest-attestation trust class (like `cut_approved`). Does NOT interact with Scope Decision or Cut-Approval gates. New §3.1 Amend-Resume Edge bullet. 34 new regression tests in test/qa-flow.test.mjs.
- **`drift-baseline-exemption` — driftBaselineIds config exemption in tools/drift.ts + 144-id backfill (v3.46.0).** Closes the tw_detect_drift historical-noise flooding issue: new optional `driftBaselineIds: string[]` config array in `.current/.config.json` exempts specified task ids from drift-detector output. Allows teams to whitelist known-benign task reachability differences (archived ephemeral tasks, pre-migration historical runs, etc.). Backfilled with 144 historical ids; new tasks are explicitly appended at each release. No schema version bump (field is optional). Backwards-compatible; dormant if absent. Wired into drift.ts `shouldSkipDrift()` check before the baseline-manifest gate.

### Changed
- **`origin-marker-reconciliation` — Amend-Resume Edge marker corrected from v3.47.0 to v3.46.0.** The forward-looking origin tag on the new Amend-Resume Edge bullet (§3.1) was set speculatively to v3.47.0 during C1 implementation; reconciled to v3.46.0 for this release as this feature ships in v3.46.0, not v3.47.0.

### Notes
- Constitution header remains v3.40.0 (versioned independently per convention; tracks highest documented behavior). C1/C2 add new §3.1 bullets (subsumbed by v3.40.0 scope).
- 144 historical task ids backfilled into driftBaselineIds per C4 scope. New released features (C1-01..C1-10, C2-01..C2-07, C4-01..C4-07) appended to baseline for next release drift filtering.

## [3.45.0] - 2026-07-07

### Added
- **`registry-pattern` — Tools and prompts now use centralized registry for cleaner maintainability (v3.45.0).** Refactored `index.ts` from 1436 → 201 lines by extracting tool definitions and handlers into `tools/registry.ts`, prompt definitions into shared `PROMPT_REGISTRY`. Introduced `tools/handoff-orchestrator.ts` for unified handoff orchestration. Wire surface is byte-compatible with v3.44.0 — no MCP interface change, no schema bump, no migration. MINOR bump for architectural cleanup.
- **`compose-not-strip-overlays` — Constitution overlay composition replaces fence stripping in build pipeline (v3.45.0).** Refactored `prompts/build.ts` to compose constitution overlays (rationale spans, design-only sections, chain-only gates) additively instead of stripping them post-render. Captured golden fixtures pre-refactor in test suite. Behavior is identical; token efficiency per-dispatch is preserved. MINOR bump for build-time refactor. Backwards-compatible; no prompt schema or content change.

### Changed
- **`prompts/build.ts` — Composition-based overlay architecture replaces conditional stripping (v3.45.0).** Overlays (rationale, design-only, chain-only) are now conditionally included during template render rather than stripped post-render, improving reasoning clarity during development and simplifying maintenance. No observable output change; token spend is identical to v3.44.0.

## [3.44.0] - 2026-07-06

### Added
- **`governance-tag-strip` — Fourth context-budget stripper for provenance redaction (v3.44.0).** Implements `stripOriginTags()` in `prompts/build.ts`, the fourth stripper in the context-compression pipeline after stripChainOnly/stripRationale/stripDesignOnly. Redacts 42 fenced provenance metadata sites (Figma node-id pointers, git commit hashes, auth tokens, timestamps, internal tracking codes) from prompt injection vectors, reducing per-dispatch token spend by ~200 tokens. Context-budget re-baselined lower across all seven role prompts. Backwards-compatible: MINOR bump. No schema/migration/tool-surface change.

### Changed
- **`skill-qa-visual` — Consolidation rewrite, 265 → 124 lines (v3.44.0).** Removed redundant gate repetition; streamlined step numbering; clearer evidence schema and failure modes. No SOP behavior change.
- **`skill-pm` — Consolidation rewrite, gates → Gate Summary table (v3.44.0).** Extracted gate enforcement bullets into a dedicated reference table for clarity; cleaner navigation. No PM flow change.

### Fixed
- **`error-code-contract` — Eight previously-undocumented error codes now documented (v3.44.0).** New test `test/error-code-contract.test.mjs` enforces strict 1:1 mapping between all error codes emitted by the server and their definitions in `content/constitution.md` or role SOPs. All currently-emitted codes brought into the contract.

## [3.43.0] - 2026-06-26

### Added
- **`pm-cut-approval-gate` — PM ticket-cut approval gate, a server-enforced checkpoint before build entry (v3.43.0).** Closes the ticket-splitting accuracy gap (`research/ticket-splitting-for-ai-agents.md`): after PM splits tickets, a human checkpoint is required before the cut enters architect/sr-engineer context. New server gate on `pm:In_Progress → {architect,sr-engineer}:In_Progress` edge: transition blocked with `error: "CUT_APPROVAL_REQUIRED"` + hint unless `cut_approved === true` in handoff. Handoff schema v4→v5 migration (stamp-only; `cut_approved` absent = unapproved sentinel, no default seeding). PM SOP updated (skill-pm.md §7a): inline cut-draft table (id | desc | depends_on | est. files | design-link) with halt-for-approval pattern; per-ticket Figma node-id + URL in design-link column when `hasDesignModeRequiringVisual()` is armed. Coordinator skill (skill-coordinator.md) updated with cut-approval gate as documented Auto-Routing stop-condition. Coordinator-lite SOP ceiling enforcement (skill-coordinator-lite.md): lite mode is read-only; PM enforces cut-approval SOP text (AC-3), cannot server-gate. New gate wired into `tools/transitions.ts` `validateTransition()` call in `index.ts` (handles CUT_APPROVAL_REQUIRED error); new helper `isCutApprovalRequired()` in `tools/transitions.ts`. Lite enforcement at SOP-ceiling per Constitution §3.1. Full spec: `specs/pm-cut-approval-gate.md`.

## [3.42.0] - 2026-06-25

### Added
- **`qa-visual-pixel-gate-attestation` — Pixel-gate attestation, the SEVENTH visual sub-gate (v3.42.0).** Closes the F2 false-pass (`research/104445-F2-qa-visual-false-pass-postmortem.md`): a qa-visual session that skipped the pixel diff could write `diff-metric: N/A` (or `dimensionsMatch=false`) and still PASS the v3.38.0 provenance gate, which only checked the line was non-empty. Two changes in `tools/evidence-file.ts`: (1) **AC-1 — placeholder rejection.** New pure `isPlaceholderDiffMetric()` + `DIFF_METRIC_PLACEHOLDERS` set (`n/a`, `skipped`, `skip`, `dimensionsmatch=false`, `dimensions mismatch`, `todo`, `tbd`, `none`, `-`, empty); `checkVisualProvenance` now treats a placeholder diff-metric as absent, emitting `VISUAL_PROVENANCE_MISSING` with the invalid value listed. The B1 LLM-fallback token is deliberately NOT a placeholder (AC-5). (2) **AC-2 — new gate.** New pure `parsePixelGateAttestation()` + fs composition `checkPixelGateAttestation()` require a positive `pixel_gate_complete: true` line in each non-carry-forward surface's `### <surface id>` prose sub-section under `## Region Diff`; missing → **`PIXEL_GATE_ATTESTATION_MISSING`**. Wired into `index.ts` inside the armed `if (armCheck.required)` block immediately after the baseline-manifest gate. Opt-in / backwards-compatible (AC-8): dormant for reports with no `baseline:` line. Carry-forward surfaces exempt (AC-4); the B1 LLM-fallback path still requires the attestation (AC-5). `diffMetric` is kept RAW in the parser so the error can name the offending value (AC-9). `PIXEL_GATE_ATTESTATION_MISSING` added to the `TransitionRejection["error"]` union (handler-side type only; not produced by `validateTransition`). `content/skill-qa-visual.md` updated (Step B1/B2, B1-fallback path, Report schema, Failure modes — AC-11). No schema/migration change.

## [3.40.1] - 2026-06-18

### Fixed
- **`handoff-write-arg-guard` — Reject two malformed `tw_update_state` args (v3.40.1).** Two `.refine()` guards added to the `UpdateStateArgs` Zod schema in `index.ts`, hardening the input boundary so the server fails loud (Constitution §7) instead of writing corrupt handoff state. (1) **`workspace_path` basename `.current` guard** — when a caller passes the `.current/` state directory instead of the workspace root, the server appended `.current/handoff.md` to it, silently writing a doubly-nested `.current/.current/handoff.md`; the call is now rejected with `workspace_path must be the workspace root, not the .current state directory`. (2) **`active_feature` `"[object Object]"` sentinel guard** — when a caller passes `active_feature` as an object, the MCP transport stringifies it to the literal `"[object Object]"` before Zod sees it, and the prior `z.string()` check persisted the corrupt sentinel verbatim; the call is now rejected with `active_feature must be a plain string id, not a serialised object`. PATCH-only: no tool-surface, schema, or migration change — exact-string equality is the only check possible at this layer since the object is already stringified before Zod runs (deeper artifacts like `"[object Array]"` are out of scope). Valid args (absolute non-`.current` root + plain string id) still pass. No constitution header bump.

## [3.40.0] - 2026-06-17

### Added
- **`figma-baseline-manifest-gate` — Server-enforced baseline manifest gate (v3.40.0).** Promotes the v3.39.0 prose-only baseline-selection SOP to a server-checked PASS gate, the SIXTH and last visual sub-gate (after the v3.38.0 provenance gate). New pure parsers `parseBaselineManifestRows()` / `hasBaselineProvenance()` plus the fs composition `checkBaselineManifest()` in `tools/evidence-file.ts`, wired into `index.ts` inside the armed `if (armCheck.required)` block. When `design/<feature>.md` is armed (`## Mode` ≠ `no-design`) and carries a `## Source` manifest, PASS now requires ≥1 audited baseline row (`status: audited` + non-empty node-id pointer): zero audited rows → **`BASELINE_MANIFEST_MISSING`**. Multi-surface manifests (≥2 audited rows) additionally require a `## Baseline Selection Provenance` section with both a `filter-conditions:` line and an `exclusion-reasons:` line → else **`BASELINE_PROVENANCE_INCOMPLETE`**. Opt-in / backwards-compatible: dormant when `## Source` is absent (pre-v3.40 designs never retro-blocked, AC-N3); single-surface (exactly 1 audited row) is exempt from the provenance section (AC-3). No `schema_version` bump (the gate reads `design/<feature>.md`, not a versioned artifact). SOP enforcement notes added to `content/skill-design-auditor.md` step 2c and `content/skill-qa-visual.md` Step A.0; Constitution §3.1 gate bullet added and header advanced to v3.40.0. Deferred: `## Visual Baselines`↔`## Source` cross-reference check (`figma-baseline-crossref-gate`), `tw_extract_figma_baseline` tooling, pointer-format validation.

## [3.39.0] - 2026-06-17

### Added
- **`figma-baseline-mechanical-selection` — Mechanical baseline selection + qa-visual baseline-copy rule (v3.39.0).** Two SOP additions, no server/schema/build-logic change: (1) **Design-auditor Step 2c "Mechanical baseline selection"** in `content/skill-design-auditor.md` — when a single Figma URL expands to a multi-surface board, forbids eyeball-picking baseline frames and requires a deterministic structural filter (frame-type + name-glob + semantic-anchor descendant) with grouping by spatial proximity (`absoluteBoundingBox`) and/or `componentId` (explicitly NOT by fragile Figma `id` prefix), freezing the node-id list plus filter conditions and exclusion reasons into the Source manifest; (2) **QA-visual Step A.0 "Baseline Source-of-Truth"** in `content/skill-qa-visual.md` — requires qa-visual to copy the frozen baseline node-id list from the design-auditor Source manifest verbatim and forbids re-deriving the set from the Figma URL. Method docs: `research/figma-baseline-mechanical-filtering-method.md`, `research/figma-extraction-analysis.md`. Deferred (out of scope): `tw_extract_figma_baseline` tooling, pHash state-grouping.

## [3.38.0] - 2026-06-17

### Added
- **`qa-visual-baseline-provenance-gate` — QA-visual provenance guard (F0, v3.38.0).** New `VISUAL_PROVENANCE_MISSING` gate in `checkVisualProvenance()` enforces that visual baseline evidence carries provenance metadata (creation timestamp, agent role, context hash) before release. Prevents stale or unattributed baseline data. Implementation in `tools/evidence-file.ts`; SOP in `content/skill-qa-visual.md` Step A.4 (Provenance Validation); test coverage in `test/evidence-provenance.test.mjs`.
- **`retro-sop-hardening` — Design-auditor source-credibility classification and context-dependent guards (F2, v3.38.0).** Three SOP additions: (1) **Design-auditor Step 2b source-credibility classification** — new rule in `content/skill-design-auditor.md` requiring asset sources be marked as `credible: [✓—external-vendor, ✓—in-house-tool, ⚠️—preliminary, ✗—deprecated]` with rationale; (2) **Context-dependent design-auditor multi-value guard** — design-auditor checks source-credibility classification before asset import approval; (3) **QA-visual Step A.5 fidelity-baseline scope guard** — qa-visual validates fidelity baseline target against visual-complexity (pixel-budget vs. geometry) in scope; (4) **Coordinator-lite scope-creep visual-fidelity example** — lite-mode SOP extended with concrete scope-creep scenario (visual-fidelity creep in responsive layouts). All QA evidence in companion review files.

### Changed
- `content/skill-qa-visual.md` Step A.5 now includes fidelity-baseline scope validation (pixel-budget vs. visual-complexity).
- `content/skill-coordinator-lite.md` Step 2b extended with visual-fidelity scope-creep example.
- `content/skill-design-auditor.md` Step 2b now includes source-credibility classification requirement.

### Notes
- F0 (baseline-provenance gate) shipped in commit c02372a; F2 (retro-sop-hardening) shipped in commit 258435a. Both carry v3.38.0 markers and ship as a single minor release.
- Pre-existing HIGH vulns in RAG embeddings stack (@xenova/transformers → onnxruntime-web → onnx-proto) waived per Constitution §6; not introduced by this release, fixable only via breaking --force override.
- Full qa-engineer, code-reviewer, and release-engineer reviews green; all tests passing.

## [3.37.1] - 2026-06-15

### Changed
- Removed redundant initialization steps (step 1 and step 2) from agent adapter templates.
- Enabled watermark requirements by default for Codex and Antigravity execution profiles.

## [3.37.0] - 2026-06-12

### Added
- **`qa-visual-token-reduction` — Token-optimized visual QA skill gates.** Backlog items B10 and B11 shipping together: (1) **B10 — Step B0 carry-forward gate.** When re-diffing a visual fixture (round N > 1), skip re-running Step B0 (deterministic pixel-diff) if no content-significant changes detected since the previous round; carry forward the baseline. Reduces token spend for iterative visual refinement. (2) **B11 — Deterministic-diff-first gate in Step B2.** Escalate to Step B2 LLM visual assessment only if deterministic pixel-diff (Step B1) exhausts its ~7k-token budget AND returns inconclusive. Closes token leakage from premature LLM escalation. Whole-frame-% PASS ban preserved. New skill prose in `content/skill-qa-visual.md` with clear AC-B10.1…3 and AC-B11.1…3 assertions; updated `test/qa-visual-skill-split.test.mjs` byte cap (9000→15000) for test doc growth.

### Changed
- `test/qa-visual-skill-split.test.mjs` byte-cap assertion updated to 15000 (from 9000) to accommodate new carry-forward and deterministic-diff-first gate prose in the skill definition.

### Notes
- Both B10 and B11 complete with full qa-engineer, design-auditor, and sr-engineer reviews. Full test suite passing; all release gates green.

## [3.36.0] - 2026-06-12

### Added
- **`design-asset-source-rule` — Governance mandate for exported (not hand-drawn) design assets.** New governance rule requiring that all raster/vector assets sourced from design files be EXPORTED from Figma (via `download_figma_images`) and imported, never reconstructed as approximate hand-drawn SVG (fidelity defect). CSS/geometric primitives exempt. Three content edits: (1) `content/skill-design-auditor.md` — asset export workflow + manifest table in `design/<feature>.md`; (2) `content/skill-sr-engineer.md` — asset import mandate and fidelity-defect classification for hand-drawn approximation; (3) `content/constitution.md` §1 — one design-only-fenced governance line (constitution header already v3.28.0, independent of package version). Feature PASS with design-auditor, sr-engineer, and qa-engineer reviews completing v3.36.0.

### Changed
- `test/context-budget.test.mjs` re-baselined 4 context-budget caps to account for design-asset-source-rule governance additions: lean always-on 2600→2700; skill-sr-engineer stripped 2048→2210; design-arm constitution 4239→4304; teamwork bundle 7703→7768. Rationale: design-asset rule adds ~70 tok to constitution and skill-sr prose; all margins remain comfortable for tooling headroom and future governance growth.

### Notes
- Constitution header remains v3.28.0 (set independently during constitution-conditional-load v3.33.0 / Phase 2 v3.34.0; unrelated to package version bumps).
- All context-budget, schema-versioning, and release-staging guards green; full test suite 634/634 passing.
- Untracked `research/orientation-process-retrospective.md` from v3.35.0 omission included in this release.

## [3.35.0] - 2026-06-12

### Added
- **`orientation-reach-matrix` — Baseline Reachability Matrix architect deliverable.** Architect role now produces a mandatory Baseline Reachability Matrix documenting which roles/steps/PRD zones are reachable under each dispatch mode (design-only, lite, standard). New `content/skill-architect.md` §5 guidance; reach-hook co-location rule (§4) ensuring reachability spec is committed alongside arc spec; pre-build `test/phase-0-5-sop.test.mjs` self-check validates matrix against handoff scopes. Closes backlog B7.
- **`backlog-b6` — Derive tsconfig source dirs dynamically.** New `lib/tsconfig-source-dirs.ts` helper extracts include paths from `tsconfig.json` at build time, replacing the hand-maintained `EXCLUDED_DIRS` constant in `test/release-staging.test.mjs` (AC-B5.5). Reduces hardcoding and future-proofs staging verification as the project grows. Test suite verifies all staged directories are present in cached diff. Closes backlog B6.
- **Backlog B9 documentation.** Deferred B9 scope-audit backlog entry documented in `docs/backlog.md` for future visibility.

### Changed
- `test/release-staging.test.mjs` now derives source directories from `tsconfig.json` `include` instead of a static list, improving maintainability.
- `content/skill-architect.md` extended with mandatory reachability matrix section and reach-hook rules.

### Notes
- Both orientation-reach-matrix and backlog-b6 features shipped in this release (v3.35.0 bundles two completed PASS features).
- Full test suite: 634/634 passing; all context-budget, schema-versioning, and release-staging guards green.

## [3.34.0] - 2026-06-11

### Added
- **`constitution-conditional-load` — Phase 2 extension (§4 visual prose + §1 governance exceptions).** Extends the design-only fence axis from v3.33.0 to two additional spans: (1) §4 visual governance prose (the `visual_round` description, arming-signal, `VISUAL_*` error-code sentences, and design-auditor paragraph following a reflow-only reordering that preserves byte-identical rule sentences), and (2) §1 L16/L17/L19 governance exceptions (Visual-Widgets-exception, Design-baseline-scope, Self-converge-relaxation — two `<!-- design-only -->` fences with L16's existing rationale fence nested inside the outer design-fence). Non-design constitution now ~2409 ~tok (down from 4200 pre-v3.33.0 baseline; ~1790 tok lighter per non-design dispatch). Design-mode features load the full, unchanged constitution. No build.ts change (reuses v3.33.0 `stripDesignOnly()` mechanism); rule semantics unchanged (only §4 sentence reorder + marker insertion). AC-P2-1…8 assertions in `test/context-budget.test.mjs` verify Phase-2 strips and design loads; full test suite 629/629 passing.

## [3.33.0] - 2026-06-11

### Added
- **`constitution-conditional-load` — Feature-conditional design-only constitution load axis.** New `stripDesignOnly()` in `prompts/build.ts` removes `<!-- design-only -->`-fenced visual-governance spans from the constitution when a feature has no design file (absent `design/<active_feature>.md` or its `## Mode` = `no-design`). On non-design features, this strips §3.2 (Visual Verdict Authority & Separation of Duties) and the four §3.1 visual bullets (L47, L48, L52, L53), which are inert when no visual verdict can exist. The arm probe reuses `hasDesignModeRequiringVisual()` (tools/evidence-file.ts:155) — the identical signal the server PASS gates use (index.ts:747/816) — guaranteeing the strip and the server gates cannot drift from each other (HC1 identity-by-construction). On design-armed features, the full constitution loads byte-identical to source (AC2/HC2). Design-only marker comments added to `content/constitution.md` (3 fenced regions: L47–48, L52–53, L58–85); R10 (tw_sync/reconcile) left unmodified in §3.2 per anti-sweep policy. Saves −1,187 ~tok/dispatch on non-design chain hops; +39 on the design path (marker-line cost). Composition verified safe with existing `stripChainOnly` and `stripRationale` axes (all permutations tested). AC1–AC8 assertions in `test/context-budget.test.mjs` confirm non-design strips, design loads unchanged, anti-sweep boundaries preserved, and measured token impact.

## [3.32.0] - 2026-06-11

### Added
- **F-C1: `constitution-restructure` — Non-normative rationale companion document.** New `content/constitution-rationale.md` provides extended "why" commentary for §1 (Constitution preamble), §3.1/§3.2 (Pre-Flight Protocol), §5 (Evidence Taxonomy), and §7 (Watermark § 1 enforcement). Constitution.md itself byte-unchanged; rationale document is authoritative for design rationale only. CLAUDE.md layout updated to include rationale file. Backwards compatible.
- **F-C2: `governance-text-load` — Rationale-stripping on chain-role dispatch.** `prompts/build.ts` now removes `<!-- rationale -->`-fenced prose from skill bodies when building role prompts (−72 tok/typical dispatch). Rationale fences added to `constitution.md` §1 and §7 (documentation only, no rule change). `scripts/measure-context-cost.mjs` mirror updated. AC7/AC8/AC9 assertions added to `test/context-budget.test.mjs` covering losslessness and token-cap enforcement. AC8 token floor raised 4153→4161 to account for new assertions; no rule bytes changed.
- **F-C3: `decodename-cleanup` — Genericized private-codename provenance refs.** 18 "CDE-OOBE" private-codename mentions across `constitution.md`, `skill-pm.md`, `skill-sr-engineer.md`, `skill-qa-visual.md`, and `skill-design-auditor.md` genericized to reference patterns (e.g., "internal codename X"). Rules byte-unchanged; evidence taxonomy (§5) unaffected. Reduces coupling to legacy project names.

### Fixed
- **Ledger cleanup (QA maintenance).** 4 stale task rows (T-CR-01 descoped; T-CR-02/03/04 superseded by -REV variants) closed via `tw_complete_task`. T-CR-02-REV and T-CR-04-REV records confirm constitution-restructure feature (v3.32.0, constitution-rationale.md shipped). Test-label cosmetic fix: `test/context-budget.test.mjs` L80 name updated from '(<= 2400 ~tok)' → '(<= 2600 ~tok)' to match L96 assertion floor.

## [3.31.0] - 2026-06-10

### Added
- **F-A: `visual-selfconverge` — Scoped Render Self-Check with in-context region-diff + VSA structural-assertion loop.** SR-engineer role extended to run per-widget→whole-surface visual validation before QA handoff, reducing visual-rework reject cycles. Coordinator subagent-token observability and PM geometric-density split gate (2a-bis) included; architect Visual Harness per-region numbers. Prompt-doc-only, no server-code changes. Constitution §1 bounded self-converge relaxation honored.
- **F-B: `governance-text-load` — Rationale-stripping to reduce prompt context burden.** New `stripRationale()` in `prompts/build.ts` removes `<!-- rationale -->`-fenced prose from skill bodies on every dispatch (−261 tok/pm, −154 tok/sr-engineer). Rationale fences added to `skill-pm.md` and `skill-sr-engineer.md` without altering rules or SOP steps. 6 new losslessness + token-cap tests added. Constitution unchanged; AC-3 guard satisfied.

## [3.30.0] - 2026-06-09

### Added
- **`SCOPE_DECISION_REQUIRED` server-side transition gate.** The MCP server now
  enforces a new `SCOPE_DECISION_REQUIRED` status in the allowed-transitions state
  machine. When a coordinator or sr-engineer attempts to transition out of a scoped
  decision checkpoint without an explicit acceptance record, the server rejects the
  transition and surfaces a structured error, preventing silent scope drift.
- Handoff schema bumped to v4: new `scope_decision` field carries the gate payload
  (decision text, timestamp, accepting agent).
- +23 tests covering the new gate, schema migration v3→v4, and rejection paths.

### Notes
- This gate enforces scope decisions at the MCP-tool layer. It does NOT stop a
  coordinator from bypassing the gate via direct in-context edits to `handoff.md`
  or via constitution-only paths — those remain out-of-scope for server-side enforcement.

## [3.29.1] - 2026-06-09

### Fixed
- `agc init` now reports a pre-existing `CLAUDE.md` that received the adapter block as
  **Updated**, not **Created**. The `writeClaudeBlock` `"appended"` result (block added to an
  existing file) was wrongly mapped to the `created` list; an appended block means the file
  pre-existed, so it now joins `updated`. Behavior was already correct (prose preserved, block
  appended once) — only the printed label was misleading.
- `test/agc-adapters.test.mjs`: +2 regression tests covering the missing case (existing
  CLAUDE.md without the block → Updated label) and the truly-fresh-dir → Created complement
  (over-correction guard).

## [3.29.0] - 2026-06-09

### Added
- **Cross-agent adapter scaffolding (`agc init` + `agc check`).** `agc init` now also
  writes three per-project entry adapters — `AGENTS.md` (Codex), `.antigravityrules`
  (Antigravity), and a marker-delimited block in `CLAUDE.md` (Claude Code) — from
  `templates/agent-adapters/`. Each adapter is a **thin loader** (points at the
  constitution served by the MCP server + the agent's execution profile: subagent
  dispatch availability, watermark applicability, layering note) — it does **not**
  duplicate constitution rules, preserving a single source of truth.
- Adapters carry an `agc-version:` stamp (HTML comment in `CLAUDE.md`, `#` comment in the
  others). New **`agc check`** subcommand compares each deployed stamp against the installed
  agc package version (resolved via `import.meta.url`, cwd-poison-immune) and exits 1 on any
  stale adapter — making drift detectable, not silent.
- `agc init` adapter writes are idempotent: skip-existing for `AGENTS.md` / `.antigravityrules`;
  marker-block upsert for `CLAUDE.md` (preserves surrounding user prose, refreshes the stamp).
- `test/agc-adapters.test.mjs` (12 tests) covering init/check behavior, idempotency, the
  zero-duplicated-clauses invariant, exit codes, and version-resolution immunity.

### Notes
- Research: `research/cross-agent-governance-single-source-strategy-2026-06-08.md` (the
  architecture + the three-party Codex/Gemini/Claude convergence) underpins this feature.
- Deferred follow-ups: `agc update`, live-reference (Mode A) delivery, Cursor adapter, agent
  auto-detection, constitution pruning + §1 watermark-mechanic relocation.

## [3.28.0] - 2026-06-08

MINOR — adds the `release-engineer` role to the routing state machine and syncs the constitution
(now self-versioned v3.27.0) with shipped server behavior. Closes the doc-vs-code drift (A1–A4) and
internal-consistency (B1–B3) items from the two-AI review.

### Fixed

- **`release-engineer` was absent from `ALLOWED_TRANSITIONS` (matrix gap A5).** A `release-engineer:PASS`
  write hit an empty allowed set, wedging the chain (no valid escape transition). Added
  `release-engineer` to the `AgentName` union and `isAgent()` guard, plus an `ALLOWED` row
  `release-engineer:PASS → (pm, In_Progress), (researcher, In_Progress)` mirroring `qa-engineer:PASS`
  (`tools/transitions.ts`). Mirrored into `specs/qa-flow-enforcement-architecture.md`.

### Changed (governance docs)

- **`content/constitution.md` synced to shipped behavior and self-versioned v3.27.0** (independent of
  `package.json`; `check-version.mjs` does not read the header). §3 pre-flight list and "Task list edits"
  rule now name `tw_sync` (A1); §3.1 + §4 document `VISUAL_REPORT_INCOMPLETE` / `VISUAL_ASSERTIONS_REQUIRED`
  with the six required report sections verbatim (A2); §3.2 authorship wording softened to "accepted and
  owned by the qa chain at PASS time (server validates report schema, not file authorship)" (A4).
- **§1 internal-consistency carve-outs.** Terse ≤15-word cap no longer applies when surfacing a blocker,
  flagging an assumption gap (§7), or stating acceptance criteria (B1). Added a design-baseline rule:
  for design-backed work the canonical design is the scope baseline; omitting a design-present element is
  a fidelity defect, not MVP compliance (B2).
- **`## Document Priority` intra-constitution tie-breaker (B3).** Safety/correctness rules (§2/§3/§6/§7)
  override efficiency/style rules (§1); a §5 anti-loop trip hands back Blocked/FAIL — never an error-laden
  PASS.
- **Skill forward-references.** `content/skill-sr-engineer.md` and `content/skill-design-auditor.md` each
  point to the §1 B2 design-baseline rule (forward-ref only, no restatement).

## [3.27.1] - 2026-06-08

PATCH — documentation/research only; no code or behavior change. Captures the CDE-OOBE analysis
and the cross-AI review trail that drove v3.26.0–v3.27.0.

### Added (docs)

- `docs/postmortem-visual-fidelity-gate.md` — postmortem of the visual-fidelity gate failure.
- `research/cde-oobe-visual-fidelity-governance-recommendations-2026-06-05.md` — Codex/GPT-5
  governance recommendations.
- `research/oobe-visual-fidelity-improvement-plan.md` — Antigravity/Gemini 3.1 Pro improvement plan.
- `research/design-fidelity-workflow.md`, `research/multi-ai-agent-pipeline-report.md` — supporting
  analysis.

## [3.27.0] - 2026-06-05

PATCH-plus follow-up hardening the v3.26.0 visual-verdict gate after an external code review
(Codex/GPT-5) found the headline guarantee ("visual PASS can't be softened by prose") was not yet
fully true. Closes five gaps. One behavior change (missing structural assertions becomes a hard
error) makes this a MINOR.

### Fixed / Hardened

- **Verdict parser was too loose (Codex #1).** `validateVisualReport` matched `\bPASS\b` anywhere, so
  "NOT PASS" / "PASS blocked" / "not ready to PASS" could set `verdictPass=true`. Now the verdict
  value must normalize to exactly `PASS` (first alphabetic token) and is rejected on any negation token
  (not/fail/blocked/changes requested/incomplete/pending).
- **Strict validation no longer silently opt-out (Codex #3).** Report-schema validation now runs
  whenever the visual gate is armed (`mode != no-design`). A design that omits `## Visual Structural
  Assertions` is a **hard error `VISUAL_ASSERTIONS_REQUIRED`** (design-auditor must add it), not a
  backwards-compatible bypass — mirrors how a missing `## Visual Baselines` blocks since v3.16.0.
  **Behavior change:** pre-v3.26 design-backed workspaces (mode≠no-design, no assertions section) now
  block at PASS until the section is added.
- **Region Diff is now interpreted (Codex #4).** Previously a required-but-unparsed section. qa-visual
  emits a per-surface result table `| surface | result |` (`pass`/`accepted`/`fail`); any non-pass/
  accepted row blocks PASS via `failedRegionDiffs`.
- **Constitution claim corrected to match the code (Codex #2).** §3.2 no longer claims the server
  rejects non-qa-authored allowed-diffs (infeasible — the report is plain markdown with no agent_id).
  Authorship is enforced *by construction* (PASS is qa-exclusive; the report is consulted only on a qa
  PASS). The server now requires `## Allowed Differences` as a schema section but does not content-sniff
  authorship.
- **Docs refreshed (Codex #5).** README → v3.27.0 / 539 tests; architecture doc → 11 tools incl.
  `tw_sync`.

### Changed

- `tools/evidence-file.ts` — `REQUIRED_VISUAL_SECTIONS` adds `Allowed Differences`;
  `VisualReportValidation` adds `failedRegionDiffs`; new `verdictIsPass` + `parseRegionDiffFailures`.
- `index.ts` PASS gate — mandatory-when-armed flow + `VISUAL_ASSERTIONS_REQUIRED`; region-diff failures
  surfaced in `VISUAL_REPORT_INCOMPLETE`.
- `tools/transitions.ts` — `VISUAL_ASSERTIONS_REQUIRED` added to the rejection union.
- `content/skill-qa-visual.md` — Region Diff per-surface result-row format.

### Tests

- `test/visual-report-schema-validation.test.mjs` — +5 cases (verdict false-positive rejection,
  body-form verdict, region-diff fail/accepted, mandatory Allowed Differences). Suite 539/539.

## [3.26.0] - 2026-06-05

MINOR release delivering **visual-verdict integrity** — the response to the CDE-OOBE
retrospective (`research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`), where a run burned
heavy tokens and shipped a UI far from Figma under a *nominal* PASS. v3.25.0 made visual evidence
*exist*; v3.26.0 makes the visual verdict *hard to corrupt*: authority separation, canonical-state
parity, structural assertions, server-validated report schema, and a ledger-reconcile op. All
changes are backwards-compatible (new gates are opt-in via the design contract; chain-only additions
stay off the always-on bundle).

### Added

- **`tw_sync` tool** (`tools/sync.ts`) — reconciles `tasks.md` checkboxes to the authoritative
  `handoff.completed_tasks` (handoff → tasks direction only). Heals the drift that background/parallel
  subagents + inline-coordinator execution produce. SAFETY: never writes `handoff`, never promotes a
  `tasks.md`-only `[x]` into completed_tasks (still needs a qa-engineer PASS); vibe-drift is reported,
  not reconciled. No `agent_id` gate (can only mirror already-qa-blessed completions). [R10]
- **Server report-schema validation** (`tools/evidence-file.ts`) — `validateVisualReport` /
  `validateVisualReports` parse `qa_reports/visual_<id>.md` and reject PASS on a missing required
  section (Widget Shape / Canonical State / Structural Assertions / Region Diff / Verdict), any
  unchecked canonical-state row, any structural assertion whose result ≠ `pass`, or a non-PASS
  verdict. New error code `VISUAL_REPORT_INCOMPLETE`. Gated opt-in by
  `designDeclaresStructuralAssertions()` so pre-v3.26 workspaces are unaffected. [R1 Tier 2]
- **Constitution §3.2 — Visual Verdict Authority & Separation of Duties** (chain-only): the visual
  verdict is qa-visual-owned; coordinator/non-qa roles pass context only and may not define / override
  / relax / pre-accept any visual difference (a coordinator accept-policy is void). Builder ≠ judge:
  an inline-run role under subagent limits cannot self-issue a visual PASS → `Blocked`. Whole-frame
  pixel-% banned as a PASS metric. Plus the R10 sequential-context + reconcile rule. [R1/R9/R10]

### Changed

- **skill-qa-visual** — added Step A.5 Canonical-State Verification (state mismatch = capture defect,
  not accepted drift); renamed Step B → Region Diff (whole-frame % banned, compare declared region);
  added Step C Structural Assertions (focus bar / group box / primary accent / selected-card desc /
  declared-token-rendered); qa-owned `## Allowed Differences`; per-widget kitchen-sink isolation;
  declared the server-validated report schema. [R2/R3/R4]
- **skill-design-auditor** — `## Layout / Canvas` now records auto-layout metadata (layoutMode/align/
  itemSpacing/padding/sizing/fills + group containers), not prose; Visual Widgets must inventory
  per-state deltas (default/focused/selected/disabled); new `## Visual Structural Assertions` section;
  Visual Baselines schema extended (source node, viewport, route, canonical state, compare region);
  content-verified node ids (name-match insufficient → fixes the wrong-baseline class). [R6/R8]
- **skill-sr-engineer** — added a scoped render self-check for custom widgets / focus-selected / group
  rows / drawers / modals / primary buttons (render in isolation, screenshot, compare to the Figma
  node in-loop before handoff); flag-don't-assume for unspecified structure; declared state tokens
  must render (build-gate failure otherwise). [R5/R7]
- **skill-pm** — copies `## Visual Structural Assertions` verbatim into the spec; new visual
  state-count split gate (>~8–10 canonical states → surface-state tasks, shared shell/widgets first).
  [R4]
- **skill-coordinator** — Visual Verdict Boundary (no accept-policy injection in qa-visual dispatch;
  unavailable judge → `Blocked`, never self-PASS) + Drift Reconcile guidance (`tw_detect_drift` →
  `tw_sync` after out-of-band/inline execution). [R1/R9/R10]
- `tools/transitions.ts` — `VISUAL_REPORT_INCOMPLETE` added to the rejection error union.

### Tests

- `test/visual-report-schema-validation.test.mjs` (10 cases — all fail branches of the schema
  validator + the opt-in gating signal).
- `test/tw-sync-reconcile.test.mjs` (5 cases — safe sync / refused vibe-drift / in-sync / no-handoff /
  idempotent).
- Updated stale assertions in `test/pixel-perfect-visual-compare.test.mjs` (extended Baselines schema;
  Region Diff rename) and raised the lazy-loaded `skill-qa-visual` byte cap (4700 → 9000) in
  `test/qa-visual-skill-split.test.mjs`.

## [3.25.0] - 2026-06-05

MINOR release delivering visual-fidelity gate hardening: server-enforced baselines validation for design-backed features, mandatory canvas/layout auditing, and geometry assertions at sr-engineer screen-1 gate.

### Added (Visual Fidelity Gate Hardening)

- **Server enforcement** — new helper `hasDesignModeRequiringVisual()` in `tools/evidence-file.ts` reads `## Mode` from design files; when mode ≠ `no-design`, the PASS gate now requires `## Visual Baselines` section and emits a new error code `VISUAL_BASELINES_REQUIRED` if absent. Non-UI features with mode `no-design` or no design file continue to pass silently.
- **Helper function** — `parseDesignMode()` in `tools/evidence-file.ts` extracts and validates `## Mode` from design files; used to arm the visual gate.
- **Auditor template** — `content/skill-design-auditor.md` now mandates `## Layout / Canvas` section (captures root canvas type, dimensions, responsive behavior); clarified that `## Visual Baselines` absence only skips silently when `mode = no-design`, all other cases block at server PASS.
- **PM spec schema** — `content/skill-pm.md` Dependencies / Prerequisites bullet now instructs copying `## Layout / Canvas` decision (fixed vs. responsive, dimensions) verbatim from design doc to spec.
- **sr-engineer geometry assertion** — `content/skill-sr-engineer.md` step 3a adds Screen-1 Geometry Assertion (reads CSS/style literals, no headless renderer); verifies root canvas dimensions match design spec before multi-screen build.

### Changed (Specs & Constitution Alignment)

- **`content/constitution.md` §3.1 & §4** — updated visual-evidence gate description and `visual_round` semantics to reflect new arming logic (design-mode detection instead of `## Visual Baselines` H2 presence).
- **`specs/qa-flow-enforcement-architecture.md`** — reconciled with new visual-fidelity behavior (v3.16.0 gate amendment); clarifies that design-backed features without baselines now block PASS instead of silently skipping.

### Migration & Behavior Change

Design-backed features (with `design/<feature>.md` where mode ≠ `no-design`) that previously PASSED without a `## Visual Baselines` section will now encounter the `VISUAL_BASELINES_REQUIRED` error at the server PASS gate. This is intentional: the feature closes a gap where design sources could bypass the visual-quality pipeline. Non-UI features and those with no design file are unaffected.

## [3.24.0] - 2026-06-02

MINOR release delivering a backlog batch (B1–B5): spec wording relaxation, context budget increase, dynamic version pinning test, release staging dir completeness, and code-review transport fixes.

### Added (B2 — context budget increase)

- Increased context budget cap from 2100 to 2300 tokens across all role prompts to accommodate larger PRD and multi-source workspace contexts without truncation warnings.

### Changed (B1 — Constitution §4.1 watermark spec wording)

- Relaxed watermark specification language to accommodate model-tier variations (`@sr-engineer (haiku)`, `@release-engineer (sonnet)`, etc.) while preserving SOP compliance.

### Fixed (B3 — dynamic version-pin test)

- Updated `test/release-staging.test.mjs` and `test/version-pin-dynamic.test.mjs` to read `package.json` version dynamically at test runtime instead of hardcoding semver strings, ensuring future PATCH/MINOR/MAJOR releases do not require updating test assertions.

### Completeness (B5 — release staging directory inventory)

- Updated `content/skill-release-engineer.md` SOP step 7 staging list to include `transport/` directory alongside existing `lib/`, `content/`, `templates/`, `specs/`, `test/`, `qa_reports/`, `review_reports/` — all code-review fixes to HTTP/stdio transport layer are now included in release commits.

## [3.23.1] - 2026-06-02

PATCH release combining two fixes: drift false-positive exclusion (B3) and
Node version pinning for dev/CI environment consistency (B4).

### Added (B4 — Node version pin)

- `.nvmrc` pinned to `22` — `nvm use` / `fnm use` will switch to Node 22
  automatically in dev, matching the CI matrix (`[20, 22]`).
- `engines.node` set to `">=20"` in `package.json`. Lower bound enforced to
  match the oldest CI target; no upper bound set (Option Y) because
  `better-sqlite3` is rebuilt from source on `npx` install, so consumers on
  Node 23+ do not hit ABI issues — adding `<23` would produce spurious engine
  warnings for them with no safety benefit. Dev-environment consistency is
  handled by `.nvmrc` + CI matrix, not by the engines upper bound.

### Fixed (B3 — drift archived-task exclusion)

PATCH release fixing a long-standing false-positive in `tw_detect_drift`.
Previously the drift comparison fed every `[x]` task — including those
already migrated to the `## Completed` archive section by `tw_complete_task`
— into the "completed in task list but not in handoff" check, producing one
spurious vibe-coding-drift line per archived task (161 in this repo) on every
call.

`tools/drift.ts` now excludes archived tasks at read time:

- Adds an `isArchivedSection()` helper matching `## Completed`
  case-insensitively with trimmed whitespace (consistent with
  `tasks-file.ts` section parsing).
- Detects the Active/Completed convention by checking whether any task carries
  an `Active` or `Completed` section; filters `## Completed` tasks out of the
  drift comparison only when the convention is present.
- Backward-compatible: legacy `tasks.md` files with neither `## Active` nor
  `## Completed` headings retain full-file drift behaviour unchanged. Tasks
  under unknown sections (e.g. `## Sprint-3`) are treated as active so genuine
  drift is never silently dropped.
- Returned `tasksCompleted` / `tasksIncomplete` now reflect active-scope tasks
  only.

Read-time filter only — no on-disk format change, no migration, no
`schema_version` bump.

## [3.23.0] - 2026-06-02

MINOR release introducing a two-format watermark regime. Previously every reply
ended with `— @<role> (<tier>)`, which led users to read the visible `(<tier>)`
as "the whole conversation ran on this model" — true only for Task-dispatched
subagents whose model is pinned by agent frontmatter. Now the watermark format
depends on execution context.

### Changed

- **`content/constitution.md` §1 Watermark** — replaced the single-format rule
  with a two-format rule. **Subagent context** (running as a fresh
  Task-dispatched subagent, model pinned by `~/.claude/agents/<role>.md`
  frontmatter): end reply with `— @<role> (<tier>)`. **Non-subagent context**
  (coordinator main loop, coordinator-lite, or a same-context `tw_switch_role`
  switch): end reply with `— @<role>` (no model token). Added the load-bearing
  self-detection rule for distinguishing the two contexts.
- **`content/skill-coordinator.md`** — §Subagent Reply Watermark Validation now
  states up front that validation applies only to Task-dispatched subagent
  replies (which still emit the with-tier form), and that the coordinator's own
  main-loop replies end with `— @coordinator` (no tier) and are excluded from
  `validateWatermark` processing.
- **`content/skill-coordinator-lite.md`** — clarified that coordinator-lite's
  own replies end with `— @lite` (no tier); the subagent-relay cross-reference
  is unchanged.

### Unchanged (intentional)

- **`lib/watermark-check.ts`** and **`test/watermark-check.test.mjs`** — the
  `validateWatermark` signature, regex, and logic are untouched. It validates
  subagent relays, which still emit `— @<role> (<tier>)`.
- **`templates/claude-code-agents/*.md`** and **`test/subagent-templates.test.mjs`**
  — subagent templates still emit the with-tier form; the `CRITICAL:` reminders
  stay verbatim and the suite passes without modification.
- **`schema/versions.ts`** — content/SOP-only change; no persisted-state schema
  is touched.

## [3.22.1] - 2026-06-02

PATCH release fixing the release-engineer SOP that produced two consecutive
incomplete release commits (v3.21.2 `a14b15f` and v3.22.0 `f5a0b4d`). Both
staged only version-bump metadata and silently omitted feature source files,
requiring backfill commit `6aaa042` to repair v3.22.0. Root cause: the SOP's
ambiguous `git add <touched files including dist/>` instruction read at
haiku-tier as "files I edited this turn" (just the metadata), and the
"release-artifact whitelist" failure-mode wording implicitly taught that
staging source dirs was abnormal — the exact opposite of correct behavior.

### Changed

- **`content/skill-release-engineer.md`** — SOP step 7 rewritten. The `git add`
  instruction now enumerates explicit directories (`lib/ content/ templates/
  specs/ test/ qa_reports/ review_reports/ tsconfig.json`) plus metadata
  files (`package.json index.ts CHANGELOG.md README.md dist/`) instead of the
  vague "touched files" phrase. Added pre-commit verification step
  (`git diff --cached --stat`) that cross-references against
  `git status --short` to catch metadata-only staging when source dirs have
  pending edits. Added post-commit sanity check
  (`git diff HEAD~1 --name-only`) requiring `specs/<active_feature>.md` to
  appear in the commit — if absent, STOP with a specific recommend-backfill
  error string.
- **`content/skill-release-engineer.md`** — Failure modes section reworded.
  The old "release-artifact whitelist" framing implied feature source dirs
  were OUTSIDE the acceptable staging set. The new wording inverts the
  framing: feature source dirs (`lib/`, `content/`, `templates/`, `specs/`,
  `test/`, `qa_reports/`, `review_reports/`) are EXPECTED in every release
  commit and never trigger STOP. Only UNRELATED uncommitted paths (editor
  swap files, `.DS_Store`, `.env*`, secrets, scratch dirs, unrelated source
  edits) trigger the stop condition.
- **`templates/claude-code-agents/release-engineer.md`** — Added a 2-sentence
  reinforcement hint to the subagent shim body, naming the explicit staging
  directories and the pre-commit verify step. Reinforces dual-anchoring for
  haiku-tier without altering the watermark line or the `tw_get_state` /
  `tw_switch_role` invocation lines.

### Notes

- Pure prompt/SOP fix — no code, schema, transitions, or MCP tool changes.
- `ALLOWED_TRANSITIONS` matrix unchanged.
- Backwards compatible — existing release commits and tags untouched.
- The v3.22.0 backfill commit `6aaa042` already repaired the prior incomplete
  release; this v3.22.1 ships only the SOP fix that prevents recurrence.

## [3.22.0] - 2026-06-02

MINOR release adding parent-level watermark post-validation to the
`/teamwork` and `/teamwork-lite` coordinator SOPs. Template-side hardening
in v3.21.2 raised haiku compliance to 3/3 in controlled dispatch, but a
subsequent live `@lite hi` invocation in a lite-mode main session still
dropped the suffix — no instruction inside the subagent template can
deterministically force a haiku model to append a trailing string on every
reply. v3.22.0 closes the gap at the parent layer, which has guaranteed
execution regardless of subagent attention drift.

### Added

- **`lib/watermark-check.ts`** — new pure util exporting
  `validateWatermark(reply, name, tier)` and `buildWatermark(name, tier)`.
  Detects the canonical `— @<name> (<tier>)` suffix on the last non-empty
  line of a subagent reply using regex `/^—\s@[\w-]+\s\([\w-]+\)$/i` (U+2014
  EM DASH required, case-insensitive). Returns `{ present, corrected }`;
  callers relay the `corrected` value. Verifies the captured name and tier
  match the expected dispatched subagent. Pure (no I/O), idempotent. Now
  included in `tsconfig.json` `include` glob and compiled into
  `dist/lib/watermark-check.js`.
- **`## Subagent Reply Watermark Validation`** section in both
  `content/skill-coordinator.md` and `content/skill-coordinator-lite.md`
  (verbatim-equivalent). Documents the detection regex, append-on-miss
  correction strategy, and the out-of-scope guard that limits validation to
  replies relayed from a `Task` / Agent tool call (never the coordinator's
  own non-Task tool turns).

### Changed

- **`package.json` + `index.ts`** — version bumped from `3.21.2` to `3.22.0`
  (MINOR — new observable behavior in both coordinator SOP files, no
  breaking changes).

### Notes

- No change to `tools/transitions.ts`, `content/constitution.md`, or any
  `templates/claude-code-agents/*.md` file. No new `tw_*` MCP tool;
  `validateWatermark` is internal SOP logic.
- ALLOWED_TRANSITIONS matrix unchanged. Template format unchanged. Existing
  `~/.claude/agents/` copies keep working unmodified.

## [3.21.2] - 2026-06-01

PATCH release tightening haiku-tier watermark compliance. Empirical testing
on v3.21.1 showed haiku subagents (`@lite`, `@doc-writer`,
`@release-engineer`) still omitted the `— @<name> (<tier>)` watermark on
short replies because the reminder lived after the SOP paragraph at the
bottom of the template, where haiku attention is weakest. This release
repositions the reminder to the FIRST body line of every template, adds a
`CRITICAL:` prefix to raise salience, and appends a one-shot example reply
line to the three haiku templates for output-shape grounding.

### Changed

- **All 12 `templates/claude-code-agents/*.md`** — the watermark reminder
  is now the first non-blank line after frontmatter and reads
  `CRITICAL: End every reply with \`— @<name> (<tier>)\` per Constitution §1 (watermark).`
  with `<name>` and `<tier>` filled from the file's own frontmatter
  `name:` and `model:` values.
- **`lite.md`, `doc-writer.md`, `release-engineer.md`** (haiku tier) —
  body now ends with `Example reply suffix: … — @<name> (haiku)` as a
  one-shot grounding for the watermark suffix shape.

### Notes

- Template-only change. No server-side tool, schema, or transition-matrix
  modification. Existing `~/.claude/agents/` copies keep working; users
  re-copy from this release to pick up the haiku-compliance fix.

## [3.21.1] - 2026-06-01

PATCH release adding an explicit watermark reminder line to all 12
`templates/claude-code-agents/*.md` subagent shims. Closes the gap where
short replies from dispatched subagents omitted the `— @<role> (<tier>)`
watermark mandated by Constitution §1.

### Changed

- **All 12 `templates/claude-code-agents/*.md`** — each template body now
  includes `End every reply with \`— @<name> (<tier>)\` per Constitution §1
  (watermark).` with `<name>` and `<tier>` filled from the file's own
  frontmatter `name:` and `model:` values.

### Notes

- Template-only change. No server-side tool, schema, or transition-matrix
  modification. Existing `~/.claude/agents/` copies continue working;
  users re-copy from this release to pick up the reminder.

## [3.21.0] - 2026-06-01

MINOR release shortening Claude Code subagent entry points + adding the
coordinator subagent that v3.20.0 deliberately omitted. Template-layer-only
change — all server-side identifiers (`content/skill-*.md`,
`prompts/*.ts`, `/teamwork-lite` and `/teamwork` MCP prompt names,
`tools/transitions.ts`) are unchanged; backwards-compatible at the wire
contract.

### Added

- **`templates/claude-code-agents/teamwork.md`** — Sonnet-pinned
  coordinator subagent. Entry via `@teamwork <task>` spawns a fresh
  context running the full coordinator SOP at its recommended tier
  (instead of inheriting the user's main session model). The
  subagent's body delegates by file path (`content/skill-coordinator.md`)
  rather than `tw_switch_role`, because the full coordinator is not in
  the `RoleName` enum exposed by that tool (it's the dispatcher, not a
  destination).

### Changed

- **`@coordinator-lite` → `@lite`** — `templates/claude-code-agents/coordinator-lite.md`
  renamed to `lite.md`; frontmatter `name:` field updated. Model
  (`haiku`), description, and body are unchanged. Shorter to type for
  everyday solo-doer work.
- README `### Claude Code subagent install (auto model-routing)`
  sub-section now lists `@teamwork` + `@lite` as primary entry points
  alongside the per-role subagents, plus a migration note for v3.20.0
  users.
- Test suite regression-guard updated: `test/subagent-templates.test.mjs`
  now expects 12 templates (was 11); `LITE_EXEMPT` Set extended to
  `{ lite, teamwork }` (both delegate by file path); the v3.20.0
  "coordinator template absent" assertion is removed.

### Reversed (from v3.20.0)

- **v3.20.0 AC2** — "the full coordinator MUST NOT have a template
  (recursive-spawn avoidance)" — is reversed. Claude Code's Dynamic
  Workflows research preview (May 2026) confirms subagents support
  nested spawn (up to 1,000 in parallel), invalidating the original
  concern. See `research/multi-agent-auto-model-routing-directions.md`
  §E1 and `specs/subagent-short-names.md` §AC3.

### Notes

- **No server-side identifier renamed** — `coordinator-lite` /
  `coordinator` still live as their full names in
  `content/skill-*.md`, `prompts/*.ts`, MCP prompt names, transition
  tables. A server-side rename would be MAJOR (v4.0.0) and is
  deliberately out of scope.
- **v3.20.0 install survives** — users who already copied
  `coordinator-lite.md` into `~/.claude/agents/` keep working
  (Claude Code reads the frontmatter `name:` field). `@coordinator-lite`
  continues to resolve until they re-copy from this release.
- No persisted-state `schema_version` bump (template + docs only).
  Suite tests passing; build zero-error.

## [3.20.0] - 2026-06-01

MINOR release shipping **Claude Code subagent dispatch** — turning v3.19.0's
advisory `recommended_model` hint into actual per-role auto model-routing for
Claude Code users. Other clients (Cursor, Continue, Anti-Gravity, plain MCP)
keep the existing `tw_switch_role` text-load path with no behavior change.

### Added

- **`templates/claude-code-agents/*.md`** — 11 pre-pinned subagent template
  files (pm, researcher, architect, design-auditor, sr-engineer,
  code-reviewer, qa-engineer, qa-visual, doc-writer, release-engineer,
  coordinator-lite). Each carries `name` / `model` / `description`
  frontmatter; the `model:` tier mirrors the corresponding
  `content/skill-<role>.md` `recommended_model`. Users copy into
  `~/.claude/agents/` to enable per-role model pinning under Claude Code's
  Task-tool dispatch (Dynamic Workflows / parallel subagents).
- **`content/skill-coordinator.md` §Auto-Routing — Subagent Dispatch
  (Claude Code)** sub-bullet: coordinator now prefers
  `Task(subagent_type=<role>)` when available, falls back to
  `tw_switch_role` otherwise. Server-enforced `ALLOWED_TRANSITIONS` is
  unchanged — dispatch only chooses WHICH MODEL runs the role.
- **README §Claude Code subagent install (auto model-routing)** — install
  snippet + degradation callout + design link.
- **`specs/subagent-dispatch.md`** — PRD (AC1–AC8).

### Changed

- Coordinator full skill SOP §5 reworded: gate-triggered routes now read
  "dispatch via the Auto-Routing preference order" instead of hard-coding
  `tw_switch_role`. Behavior preserved for non-Claude-Code hosts via the
  fallback path.

### Notes

- **`tw_switch_role` tool surface is unchanged** — backwards-compatible.
- No persisted-state `schema_version` bump (content + templates + skill
  SOP only).
- Coordinator full template is deliberately NOT shipped — it's the parent
  dispatcher; spawning it as a subagent would be recursive.
  `coordinator-lite` IS shipped for solo-dev Haiku-tier work.
- Track 2 (`tw_dispatch_role` MCP tool for cross-IDE dispatch) and the
  cost-telemetry `dispatch_ack` audit are deferred — see
  `research/multi-agent-auto-model-routing-directions.md`.

## [3.19.1] - 2026-06-01

PATCH release — constitution v3.14.1 extends the watermark format from
`— @<role>` to `— @<role> (<model>)` so the running model tier is visible
alongside the role. Pairs with the per-role `recommended_model` shipped in
v3.19.0: drift between recommended and actual tier is now visible at a
glance in chat.

### Changed

- `content/constitution.md` §1 Output Directives — Watermark rule rewritten;
  examples now show `— @coordinator (opus)`, `— @pm (sonnet)`. Constitution
  header bumped v3.14.0 → v3.14.1.

### Notes

- Content-only patch. No tool surface or schema change.
- Lean always-on bundle remains under the 2000-token budget enforced by
  `test/context-budget.test.mjs` AC2.

## [3.19.0] - 2026-06-01

MINOR release adding per-role model-routing hints — an advisory tier (`opus` /
`sonnet` / `haiku`) declared in each skill's YAML frontmatter so multi-IDE
clients can stop running flagship-tier inference on Haiku-class work. The
server cannot enforce client-side inference; the hint is surfaced via
`tw_switch_role`, the prompt builder, and the SessionStart hook so client
wrappers (Claude Code subagents, `/model` switches) can honor it.

### Added

- **`recommended_model` frontmatter** on all 12 `content/skill-*.md` files.
  Tier table: researcher / architect / code-reviewer / design-auditor /
  sr-engineer = `opus`; coordinator / pm / qa-engineer / qa-visual =
  `sonnet`; coordinator-lite / doc-writer / release-engineer = `haiku`.
- **`tools/skill-frontmatter.ts`** — shared YAML-frontmatter parser and
  stripper consumed by `tools/role.ts`, `prompts/build.ts`, and
  `bin/agent-governance-context.mjs`. Soft-degrades on missing/malformed
  frontmatter (no throw); never leaks raw `---` blocks into context.
- **`recommended_model` field in `tw_switch_role` response** — additive;
  absent when the skill file has no frontmatter (backwards-compat).
- **Recommended-model banner line** in SessionStart hook output
  (`Recommended model: <model> (tier <tier>)`).
- **README §Per-Role Model Routing** with the full tier table plus a
  Claude Code `~/.claude/agents/<role>.md` example.
- **`specs/model-routing.md` + `specs/model-routing-architecture.md`** —
  PRD and architecture blueprint.

### Changed

- `tw_switch_role` `sop` field now returns the skill body with the
  YAML frontmatter stripped (the frontmatter is parsed into the new
  `recommended_model` field instead). Callers consuming `sop` as the
  rendered SOP see no functional change.
- `prompts/build.ts` appends `Recommended model for this role: <model>.`
  between skill body and handoff state block when frontmatter declares it.

### Notes

- Advisory only — no server-side enforcement of client inference.
- No persisted-state schema bump (content-only change). Suite tests
  passing; new unit coverage added for the shared parser.

## [3.18.0] - 2026-05-31

MINOR release giving the Feature-Scope Gate's `.current/feature-split.md` a
lifecycle, so a split plan can be resumed safely across `/teamwork` invocations
without redoing completed units.

### Added

- **Split-plan `status` column** — the Feature-Split Plan Split Table gains a
  `status` column (coordinator pre-fills `pending` on every row).
- **Resume + done-marking (`content/skill-coordinator.md`)** — when an incoming
  `/teamwork` finds an existing `.current/feature-split.md`, the Feature-Scope Gate
  no longer re-assesses/regenerates: it **reconciles** (flips a row to `done` when its
  `feature id` matches the handoff `active_feature` at PASS), then works the next
  `pending` row — or a **human-named row** (`do F0` / a feature id) — by **hydrating**
  it (scope + figma link + widgets + notes) as the feature input. A `done` row is
  never re-run.

### Changed

- "How to proceed" documents `done`-on-PASS, resume-skips-`done`, and the `do F<n>`
  by-id shortcut.
- The Feature-Scope-Gate always-on footprint ceiling was raised ~425 → ~550 approx
  tokens to accommodate the lifecycle logic (section ~496 tok; still guarded by test).

### Notes

- Prompt-layer + human-checkpoint only; no server transition-matrix change. The
  coordinator edits `.current/feature-split.md` directly (not a `tw_*` write). Suite
  439 tests passing.

## [3.17.0] - 2026-05-31

MINOR release adding two complementary front-door guardrails that keep large,
design-heavy PRDs from overrunning the design-auditor — a feature-level split
gate in the coordinator, and an input-volume guard in the design-auditor.

### Added

- **Feature-Scope Gate (`content/skill-coordinator.md`)** — a new coordinator SOP
  step (after state-sync, before Design-source detection) that judges, **text-only**
  (never fetching a design), whether an incoming PRD is one feature or many. Single
  → continue automation uninterrupted; multi → STOP, write a `.current/feature-split.md`
  **Feature-Split Plan** (coordinator pre-fills every column except `figma link` +
  `notes / 注意事項`, which the human completes), surface a recommendation + hint, and
  wait for the human to split + re-invoke per unit. Lite mode is unaffected.
- **design-auditor Volume Gate + node-scoped fetch (`content/skill-design-auditor.md`)**
  — a pre-fetch input-side gate (fetch-based modes only) that estimates a single
  feature's surface/frame count from cheap metadata and STOPs (`Blocked → pm`,
  fail-loud) when it exceeds ~one feature's worth, recommending a further split
  instead of ingest-then-defer; plus a node-scoped-fetch rule so the auditor pulls
  only the frames it audits this pass. The coordinator split-schema now asks for
  **frame-scoped** Figma links (not whole-file) to bound the fetch at the source.

### Changed

- The Feature-Split Plan "How to proceed" line instructs the human to use a
  frame-scoped Figma link per row.

### Notes

- Both additions are **prompt-layer + human-checkpoint** (advisory, like Design-source
  detection); no server transition-matrix change. The coordinator gate's always-on
  footprint is held to ~350 tok (guarded by test). Suite: 432 tests passing.

## [3.16.3] - 2026-05-31

PATCH release clearing the `npm audit` advisories waived in v3.16.2. Adds
`package.json` `overrides` pinning the two vulnerable transitive dependencies to
their first patched releases. `npm audit` goes from 5 advisories (1 critical, 3
high, 1 moderate) to **0**.

### Changed

- **`package.json` `overrides`** — `protobufjs: ^7.5.8` (resolved 7.6.2) clears the
  critical RCE (GHSA-xq3m-2v4x-88gg) + several high/moderate advisories reaching
  the tree via the optional embedding dep `@xenova/transformers` → `onnxruntime-web`
  → `onnx-proto`. `qs: ^6.15.2` clears the moderate DoS (GHSA-q8mj-m7cp-5q26) via
  the MCP SDK's `express` → `qs` chain.

### Added

- **`test/dependency-overrides.test.mjs`** — pin-regression test asserting the
  override floors (`protobufjs ≥ 7.5.8`, `qs ≥ 6.15.2`) stay in place so the
  advisories cannot silently return on a future dependency edit.

### Notes

- The `protobufjs` override is a deliberate major bump (6 → 7) past `onnx-proto`'s
  declared `^6.8.8` range. Verified at runtime, not just install: the RAG embedding
  path (`@xenova/transformers`) still produces a correct 384-dim vector under the
  forced version, and `tools/rag.ts` is unchanged. Full suite 417/417.

## [3.16.2] - 2026-05-31

PATCH release trimming the **always-on context budget**. The constitution's
chain-only sections (§3.1 Server-enforced chain, §4 Routing Chain) are now fenced
and stripped from **lite contexts only** (the SessionStart hook's default lite
bootstrap and the `teamwork-lite` prompt), which never enter the role-to-role
chain. Chain roles (`teamwork` full + `pm`/`architect`/`sr-engineer`/
`code-reviewer`/`researcher`/`qa-engineer`) still receive the full, unmodified
constitution — no normative rule is dropped from any path that enforces it.

Measured effect: the default always-on bundle drops from ~2837 to ~1961 approx
tokens per session (−31%). Single source of truth (one `constitution.md` with
HTML-comment fences), so there is no dual-file drift risk.

### Added

- **`scripts/measure-context-cost.mjs`** — deterministic (chars/4) measurement of
  the always-on bundle: per-artifact token table for `constitution.md`, every
  `skill-*.md`, both SessionStart hook variants, and all 7 role-prompt bundles,
  plus the pre/post-strip lite total. The baseline tool behind this change.
- **`test/context-budget.test.mjs`** — asserts the reduction, that lite omits only
  the chain-only sections while retaining every universal rule, that chain roles
  keep the full constitution, and that the three `stripChainOnly` regex copies
  stay identical.

### Changed

- **`content/constitution.md`** — §3.1 + §4 wrapped in a single
  `<!-- chain-only:start -->` … `<!-- chain-only:end -->` fence (rule text
  unchanged).
- **`prompts/build.ts`** — new exported `stripChainOnly()`; `buildPromptForRole`
  strips the fenced sections when the skill is `skill-coordinator-lite.md`.
- **`bin/agent-governance-context.mjs`** — strips the fenced sections for the lite
  SessionStart variant (duplicate stripper across the TS/.mjs module boundary,
  kept in sync by a regex-equivalence test).
- **`test/researcher-deep-research.test.mjs`** — updated AC-1/2/4/5 to the v3.16.1
  shallow-default contract (they had been left asserting the superseded `deep`
  standalone default).

### Notes

- Dependency audit: pre-existing HIGH/CRITICAL advisories in `protobufjs`
  (transitive via `@xenova/transformers` → onnxruntime-web → onnx-proto, the RAG
  embedding chain) remain. **Waived** for this release — unrelated to the change,
  and the available fix is a breaking downgrade of `@xenova/transformers`. Tracked
  separately for a dedicated dependency-bump pass.

## [3.16.1] - 2026-05-31

PATCH release flipping the **standalone** `researcher` default from `deep` back
to `shallow`. A bare `researcher` invocation (no `researcher_depth:` in
`pending_notes`) no longer auto-spawns the token-expensive `/deep-research`
harness; `deep` is now opt-in only. This reverses the cost exposure introduced
in v3.16.0 while keeping the `deep`→`/deep-research` wiring intact.

### Changed

- **Standalone default is `shallow`** — `content/skill-researcher.md` Hard rules
  + SOP step 2: a standalone researcher call defaults to the cost-frugal
  `shallow` path (direct web search / file reads, no `/deep-research` harness).
  `deep` runs only when explicitly requested or when the question is genuinely
  strategic.
- **Token-cost warning before `deep`** — at `deep` depth the researcher MUST
  first warn the user that `/deep-research` is token-expensive (≈ 100+
  verification sub-agents, > 1M tokens typical) and confirm before launching.
- **`shallow` corroboration floor** — `shallow` now requires ≥ 3 sources
  spanning ≥ 2 credibility tiers (was ≥ 1 source); a single-source answer is no
  longer acceptable.

## [3.16.0] - 2026-05-30

MINOR release wiring the `researcher` role to the Claude Code `/deep-research`
skill. At `deep` depth the researcher now invokes `/deep-research` to gather a
multi-source, cited report before distilling it into the Findings Schema, and a
**standalone** invocation (one not routed through coordinator/PM, so no
`researcher_depth:` is declared in `pending_notes`) now defaults to `deep` —
making a bare `researcher` call auto-run the harness.

Backwards-compatible: the routed `shallow` path is unchanged and explicitly does
NOT invoke `/deep-research` (cost-frugal). The directive is prompt-layer
guidance — the server still enforces only routing/state, not skill invocation —
and degrades gracefully to manual web search when `/deep-research` is
unavailable in the session.

### Added

- **`/deep-research` invocation at `deep` depth** — `content/skill-researcher.md`
  SOP step 2 now directs the agent to invoke the `/deep-research` skill (when
  available in the session) to gather a multi-source, cited report, then distil
  it into the Findings Schema, with a manual-web-search fallback when the skill
  is absent.
- **Standalone default depth = `deep`** — the Depth Hard-rule gains a
  `Standalone default` bullet: an invocation with no `researcher_depth:`
  declared defaults to `deep`, so a bare `researcher` call auto-runs the
  harness.
- **`test/researcher-deep-research.test.mjs`** — 5 content-assertion tests
  (AC-1..AC-5) pinning the standalone-default-deep rule, the `/deep-research`
  invocation directive, the fallback wording, the unchanged shallow path, and
  the end-to-end presence of all directives in the assembled prompt via
  `buildResearcherPrompt`.

### Changed

- **`content/skill-researcher.md` SOP step 2** — reworded from "Research using
  web search, file reads, code traversal" to the depth-aware
  invoke-`/deep-research`-then-distil flow described above. `shallow` explicitly
  skips the harness.

### Notes

- Prompt-layer only: no `tools/` / `prompts/` / `schema/` source changed, so
  `dist/` is byte-identical. The constitution version is unchanged.

## [3.15.0] - 2026-05-29

MINOR release activating the R6 server-enforced widget verification gate
that v3.14.0 architecture §A intentionally reserved for v3.15.0, refactoring
`writeHandoffState` / `HandoffStorage.writeState` to a dual API (positional
`@deprecated`, options-object new), and bringing the `qa_round` / `review_round`
Round 4 sentinel predicates in line with v3.14.1's `visual_round` Round 6 fix.

Backwards-compatible: workspaces without `design/<feature>.md` see no
behaviour change; v3.14.x visual reports without a `## Widget Shape
Verification` H2 still accept (the gate verifies CLAIMED checks, not
mandates the claim shape); positional `writeState` callers still work.

### Added

- **R6 server-enforced Widget Shape Verification gate** —
  `index.ts` runs `hasUncheckedWidgets(workspace, completed_tasks)` after
  the v3.14.0 `VISUAL_EVIDENCE_MISSING` gate. The new helper in
  `tools/evidence-file.ts` parses each `qa_reports/visual_<id>.md`,
  locates the `## Widget Shape Verification` H2 section, and reports
  rows whose bracket is not `[x]` / `[X]`. Any unchecked row → server
  rejects PASS with the new error code `VISUAL_WIDGETS_UNVERIFIED`,
  listing every offending task-id and widget-id inline so the operator
  fixes everything in one round-trip. The error code was reserved in
  v3.14.0 architecture §A — it is now active.
- **`parseVisualWidgetsChecklist`** and **`hasUncheckedWidgets`** exports
  in `tools/evidence-file.ts`. Pure parser + composition helper. Permissive
  on whitespace, strict on bracket content (`[Y]` / `[ ]` / `[garbage]`
  → unchecked, catching operator typos rather than silently accepting).
- **`WriteHandoffStateOptions`** interface in `tools/handoff.ts`. The
  options-object overload accepts every field that the 11-positional
  signature used to require, with sensible defaults for the optional
  ones.

### Changed

- **`writeHandoffState` dual API** — `tools/handoff.ts` now exposes
  both the legacy positional signature (now `@deprecated v3.15.0` with
  `removal in v4.0.0` migration hint) and a new options-object overload.
  Discrimination is runtime-`typeof` on the first argument.
- **`HandoffStorage.writeState` dual API** — `tools/storage.ts` interface
  + `FileHandoffStorage` + `SqliteHandoffStorage` implementations all
  support both call shapes. Implementations delegate to
  `writeHandoffState` for both branches.
- **`index.ts` handler call site** switched to the options-object form —
  each field is named, eliminating the 11-positional risk that motivated
  the refactor. Positional remains supported for backwards-compat callers.
- **Round 4 sentinel predicates symmetric fix** — `index.ts:795-805`
  predicates for `qa_round` and `review_round` Round 4 lock-injection
  changed from `=== 4 && === 3` to `>= 4 && < 4`, matching v3.14.1's
  `visual_round` Round 6 fix. All three counters now share the same
  cap-cross detection semantics: fires exactly once per crossing from
  any prior value (handles migration / hand-edit edge cases).

### Tests

- **+27 tests across 3 files**:
  - `test/visual-widgets-unverified-gate.test.mjs` (new) — 14 tests
    covering AC-1 through AC-5: unchecked-rejection, all-checked
    acceptance, backwards-compat (missing section), error aggregation
    across multiple task ids, permissive whitespace + strict bracket
    content (`[x]` / `[X]` / `[Y]` / `[ ]` cases), case-insensitive
    section heading, defensive edge cases (empty input, missing file,
    section bounded by next `## `).
  - `test/writestate-options-object.test.mjs` (new) — 8 tests covering
    AC-6 through AC-10: options-object parity with positional,
    all-fields persistence, compiled-handler call-site shape grep,
    `@deprecated` JSDoc presence in both `handoff.ts` and `storage.ts`,
    8-arg backwards-compat positional defaults, minimal options
    defaults.
  - `test/qa-flow.test.mjs` (extended) — 6 new tests covering
    AC-11/AC-12/AC-13: qa_round + review_round Round 4 cap-cross
    predicate from prev=3 (normal), from prev<3 (external-bump
    handling), no-fire-past-cap, sentinel wording unchanged.
- **Tally**: 371/371 (v3.14.1 baseline) → **398/398** passing.

### Deferred to v3.16+

- README "Why not spec-kit?" FAQ entry (positioning improvement; no
  community pull yet).
- spec-kit compatible command bridge.
- tasks.md historical drift cleanup (105+ entries).
- doc-writer / release-engineer routing-chain integration.

### Notes

- `npm audit` waiver unchanged from v3.14.1 (the `embedding_model`
  allowlist closes the exploit path; transitive dep tree unchanged
  because no patched upstream release exists).
- Handoff schema NOT bumped — v3.15.0 changes API signatures and adds
  one error code, but no new field is added to `HandoffState`.
  `CURRENT_VERSIONS.handoff` stays at 3.

## [3.14.1] - 2026-05-29

PATCH release closing three findings + six missing tests from the post-v3.14.0
audit. No public API change, no schema bump, no behavioural regression on
default flow. Backwards-compatible with `#v3.14.0` consumers.

### Security

- **`embedding_model` allowlist** (`index.ts:139-180`) — the v3.13.0 / v3.14.0
  waiver claim that `@xenova/transformers` → `onnxruntime-web` → `protobufjs`
  CRITICAL chain (CVE-2026-41242 / GHSA-xq3m-2v4x-88gg) was "not reachable"
  was **incorrect** in HTTP mode. The `tw_index_prd` MCP tool accepts a
  client-controlled `embedding_model` parameter; the v3.14.0 regex
  `/^[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-]+$/` admitted any HF Hub repo, including
  attacker-controlled ones. A malicious .onnx file's protobuf schema would
  trigger the protobufjs RCE during model load.
  v3.14.1 adds an explicit allowlist (`Xenova/all-MiniLM-L6-v2`,
  `Xenova/bge-small-en-v1.5`, `Xenova/multilingual-e5-small`) gated by a zod
  `refine`. Default-flow callers (no `embedding_model`) are unaffected. Full
  reachability trace in `research/xenova-reachability.md`.
  Audit waiver REFRAMED from "not reachable" to "reachable but path closed
  by allowlist" — `npm audit` still shows the transitive vuln chain because
  the dep tree is unchanged, but the exploit path through the MCP surface
  is mitigated.

### Fixed

- **Path sanitiser collapse for `..` literal** (`tools/evidence-file.ts:115-123`)
  — the v3.14.0 sanitiser `replace(/[^A-Za-z0-9._-]/g, "_")` collapsed `/` to
  `_` (blocking traversal) but preserved the literal `..` in filenames. A
  hostile `active_feature` like `..feat` produced `..feat.md` — not a
  traversal exploit, but a cosmetic surprise that could mislead grep / audit
  logs. v3.14.1 chains a second `replace(/\.\.+/g, "_")` after the first to
  collapse any run of 2+ dots. Single `.` survives (legitimate filename
  character — `feat.v2.md` is allowed).
- **Round 6 sentinel cap-cross predicate** (`index.ts:775-784`) — v3.14.0
  injected the `⛔ Visual Round 6: forced rollback to pm…` pending_notes
  sentinel using `new_visual_round === 6 && prev_visual_round === 5`. If
  `prev_visual_round` ever arrived at the handler at a value < 5 with the
  new counter going to 6+ (migration / hand-edit), the sentinel would not
  fire. Fixed to `new >= 6 && prev < 6` — correct cap-cross predicate that
  fires exactly once per crossing. Symmetric fix for `qa_round` /
  `review_round` sentinels at `index.ts:747-752` deferred to v3.14.2
  (trigger path is migration-only; not blocking).

### Tests

- **+18 tests across 3 files**:
  - `test/visual-gate-e2e.test.mjs` (new) — 11 tests covering AC-5 / AC-6
    / AC-7 / AC-10: handler composition through `validateTransition` +
    visual evidence gate + `computeNewRound` + `writeState` round-trip,
    Round 6 sentinel cap-cross from `prev < 5`, visual_round persistence
    through subsequent read+write cycles, `VISUAL_ROUND_EXCEEDED` PM-only
    acceptance at cap.
  - `test/visual-round-sqlite.test.mjs` (new) — 4 tests gated on
    `better-sqlite3` availability: `visualRound` round-trip via
    `SqliteHandoffStorage.writeState` + `parse`, default-to-0 when omitted,
    update-not-append semantics, PASS-resets-to-0.
  - `test/visual-evidence-gate.test.mjs` (extended) — 3 new v3.14.1 cases:
    `..` literal collapse (leading / middle / triple-dot), single-dot
    survival, read-error silent-swallow contract pin.

- **Tally**: 353/353 (v3.14.0 baseline) → **371/371** passing.

### Research

- **`research/xenova-reachability.md`** (new) — deep dive into the
  `@xenova/transformers` → `onnxruntime-web` → `protobufjs` call graph
  from `tools/rag.ts`. Verdict: **REACHABLE in HTTP mode** via
  `embedding_model` parameter; MODERATE in stdio mode (trust-equivalent
  to existing local-process surface). Includes the CVE detail, the exact
  exploit path, and three rejected alternatives (upgrade Xenova,
  override-transitively, drop RAG).

### Deferred to v3.15.0 (Question Batch decisions)

- R6 server-enforced widget verification (`VISUAL_WIDGETS_UNVERIFIED`)
- `writeHandoffState` / `storage.writeState` options-object refactor
  (dual API: positional deprecated, options-object new)

## [3.14.0] - 2026-05-29

MINOR release closing the **pixel-perfect framework gap** uncovered by
`research/why-pixel-perfect-missed.md`. Adds a third independent
feedback loop (`visual_round`) to the routing chain, a server-side
PASS-evidence gate for visual diff reports, and four new schema
sections distributed across PM / design-auditor / architect /
sr-engineer SOPs.

**Backwards-compatible**: workspaces without `design/<feature>.md`
(server logic, CLI, this MCP repo itself) pay zero overhead and see
no behaviour change. The new gates fire only when a feature declares
`## Visual Baselines` in its design file.

### Added

- **Constitution §1 Visual Widgets exception** — sub-bullet under
  *MVP strict*. When a widget is listed in a spec's `## Visual Widgets`
  section, substituting an HTML primitive (e.g. `<input type="date">`
  for a column-scroller picker) is now **scope violation**, NOT MVP
  compliance. Closes the gap where sr-engineer rationally chose
  primitives because the spec didn't enumerate widget shapes.
- **Constitution §3.1 visual evidence gate** — `(qa-engineer, PASS)`
  requires `qa_reports/visual_<task-id>.md` when
  `design/<active_feature>.md` declares `## Visual Baselines`. Server
  rejects with `VISUAL_EVIDENCE_MISSING` on the missing file. No
  baselines declared → gate is silent and pass-through.
- **Constitution §3.1 `visual_round` sub-loop** — third feedback
  counter, independent of `qa_round` and `review_round`. Ticks on
  `(qa-engineer, FAIL)` when `pending_notes` contains `visual_fail:`
  (pixel/widget drift, NOT test-logic FAIL). Cap is 5 rounds; Round 6
  locks to `(pm, In_Progress)` only. Symmetric to the v3.2.0 qa_round
  Round 4 circuit breaker.
- **Constitution §3.1 split escalation** — at `visual_round >= 3`,
  sr-engineer MAY route `(sr-engineer, In_Progress) → (pm, In_Progress)`
  with `pending_notes` containing `visual_split_requested:`. Early
  escape hatch: instead of grinding two more rounds toward threshold
  renegotiation, the team splits an oversized widget into sub-tasks.
- **`skill-pm.md` § Visual Widgets schema bullet** — new required H2
  section between *Visual Tokens* and *Out of Scope*. 3-column table
  `widget id | description | source-node`. Mandatory `N/A | — | …` row
  for features without widgets (absence must be explicit).
- **`skill-design-auditor.md` § Visual Widgets extraction** — schema
  bullet + 8-row widget-shape heuristics table (Picker, Wheel,
  Keyboard, Segmented, Scrollbar, Stepper, Accordion, Slider, Toggle)
  + "verify with PM" uncertainty tag + out-of-scope clause for restyled
  primitives.
- **`skill-architect.md` § Visual Harness Artifact Schema bullet**
  (MANDATORY when `design/<feature>.md` declares `## Visual Baselines`;
  OMIT entirely otherwise) — specifies test runner, viewport list,
  diff library + threshold, CI command, font/rendering pinning, task
  ordering rule. New SOP gate 4a blocks back to PM when the spec's
  task list lacks a `[P0] Build visual-diff harness` task.
- **`skill-sr-engineer.md` § Phase 0.5 Design-Aware Pre-Flight** — new
  SOP step 3a positioned BETWEEN Task-Size Check (3) and Implement (4).
  Mandates reading `design/<active_feature>.md` end-to-end + relevant
  `## Visual Widgets` row + baseline paths BEFORE any file edit. Skips
  silently on non-UI workspaces. References split escalation at
  `visual_round >= 3`.
- **`skill-qa-engineer.md` § Phase 1.5 PASS-gated** — Phase 1.5 label
  upgraded from "lazy-load, skip-if-absent" to "lazy-load + PASS-gated
  when Visual Baselines present". Names the server error code
  (`VISUAL_EVIDENCE_MISSING`) operators will see. The "Phase 1.5
  deferred" escape clause is REMOVED.
- **`skill-qa-visual.md` § Widget Shape Checklist** — new Step A
  preceding the v3.8.2 Pixel Diff (now Step B). One markdown checkbox
  per spec `## Visual Widgets` row. Unchecked `[ ]` → "widget shape
  miss" failure mode (`visual_fail: <widgets>` token in pending_notes).
  Shape FAIL gates Step B — pixel-perfect on the wrong widget is
  meaningless. Output filename changed from `qa_reports/review_<id>.md`
  to `qa_reports/visual_<id>.md` (Constitution §3.1 PASS gate target).
- **`tools/evidence-file.ts` new exports** —
  `hasVisualBaselinesInDesign(workspace, activeFeature)` and
  `hasVisualEvidenceInFile(workspace, taskIds)`. Mirror existing
  `hasEvidenceInFile` / `hasCodeReviewEvidenceInFile` patterns. Path
  sanitisation reuses the `[^A-Za-z0-9._-]` filter.
- **`tools/transitions.ts` new exports** — `VISUAL_ROUND_CAP_EXPORTED`
  constant (=6). `TransitionRejection.error` union extends with
  `VISUAL_ROUND_EXCEEDED`. `validateTransition` consults
  `prev_visual_round` (optional; defaults to 0). `computeNewRound`
  signature widens by two positional params and returns
  `{ qa_round, review_round, visual_round }`.

### Changed

- **Handoff schema v2 → v3** — new `visual_round: number` field.
  v2→v3 migration registered in `schema/migrations-handoff.ts` stamps
  the field to 0 for in-flight tickets. SQLite mode adds a
  `visual_round INTEGER NOT NULL DEFAULT 0` column via
  `ALTER TABLE handoff_state` (no sqlite schema_version bump because
  no new tables / no breaking column changes).
- **`writeHandoffState` + `HandoffStorage.writeState`** — eleventh
  positional parameter `visualRound?: number` added. All call sites
  in `tools/handoff.ts`, `tools/storage.ts`, `tools/storage-sqlite.ts`,
  and `index.ts` updated. Pre-v3.14 callers passing 10 params
  continue to work (visualRound defaults to 0).
- **Constitution §4 routing chain** — diagram annotation updated to
  reflect "Round 1-3 QA review; Round 1-5 visual review" feedback
  arrow scope. Textual paragraph documents `visual_round`'s gating
  conditions.

### Server enforcement summary

| State | Server check (new in v3.14.0) | Trigger condition |
|---|---|---|
| PASS attempt | `hasVisualBaselinesInDesign` → if true, `hasVisualEvidenceInFile` for every completed_tasks id | `design/<active_feature>.md` declares `## Visual Baselines` |
| Any transition | `visual_round >= 6` → only `(pm, In_Progress)` accepted | counter independent of `qa_round` / `review_round` |
| `pending_notes` synthesis | `⛔ Visual Round 6: forced rollback to pm…` prepended | when `new_visual_round === 6 && prev_visual_round === 5` |

### Backwards-compatibility

- Workspaces without `design/<feature>.md`: no behaviour change.
- Workspaces with `design/<feature>.md` but no `## Visual Baselines`
  H2: no behaviour change (v3.8.2/v3.8.3 audit format still supported).
- Existing specs (pre-v3.14) without `## Visual Widgets` section: no
  retroactive enforcement; the section becomes mandatory only for
  features authored after v3.14.0.
- Handoff files at schema_version 0/1/2 lazy-migrate to v3 on first
  read, identical to the v3.9.0 v1→v2 mechanism. v3.13.0 callers that
  omit `visualRound` continue to work — the parameter defaults to 0.

### Tests

- 4 new test files (T109): `visual-evidence-gate.test.mjs`,
  `visual-round-transitions.test.mjs`, `widget-shape-spec.test.mjs`,
  `phase-0-5-sop.test.mjs`.
- 8 existing test files migrated for the schema_version bump +
  signature widening: `handoff-versioning.test.mjs`,
  `handoff-migration.test.mjs`, `schema-versions.test.mjs`,
  `drift-skew.test.mjs`, `qa-flow.test.mjs`,
  `qa-visual-skill-split.test.mjs`,
  `pixel-perfect-visual-compare.test.mjs`,
  `skill-evolution-v3.11.test.mjs`.
- Final tally: **353/353 passing**.

### Notes

- `npm audit` waiver from v3.13.0 carries forward unchanged: 3 HIGH +
  1 CRITICAL transitive findings under `@xenova/transformers` (not
  reachable). 1 moderate `qs` finding is new but below audit threshold.
- Root-cause analysis lives in
  `research/why-pixel-perfect-missed.md`. The R1-R6 recommendations
  in that document map to ACs in `specs/pixel-perfect-fixes-v3.14.md`:
  R1+R6 → AC-5/AC-6 (qa gate + widget checklist),
  R2+R2a → AC-1/AC-2 (PM + design-auditor widgets),
  R3 → AC-3 (architect harness),
  R3a → AC-4 (sr Phase 0.5),
  R4+R4a → AC-8/AC-9 (visual_round + split escalation),
  R5 → AC-7 (Constitution §1 exception).

## [3.13.0] - 2026-05-28

Bundled MINOR release covering both the v3.12 polish pass and the v3.13
auto-routing behaviour. No `tw_*` tool surface changes, no schema bump,
no wire-protocol change — all behaviour lives in the prompt-injected
constitution + skill files. Backwards-compatible with `#v3.11.0`
consumers.

### Added (auto-routing — v3.13 scope)
- **`skill-coordinator.md` § Auto-Routing** — default-ON in `/teamwork`
  (lite explicitly exempt). After each role's handoff the coordinator
  self-calls `tw_switch_role(<next_role>)` based on `pending_notes`.
  Five stop conditions yield to the human:
  (1) `status: Blocked`,
  (2) `status: PASS` (terminal — release-engineer remains a human decision),
  (3) `pending_notes` contains `next_role: human`,
  (4) `pending_notes` lacks any `next_role:` line (silent termination),
  (5) Hop counter ≥ **10** per `/teamwork` session.
- **`AGC_AUTO_ROUTE=0`** env-var opt-out — restores pre-v3.13 manual
  routing. Read agent-side at coordinator SOP step 1; not validated
  server-side.
- **`skill-pm.md` § Question Batch Gate** — new SOP step 4 that batches
  Resource Audit `fetch/index/ignore` decisions + Ambiguity Gate
  clarifications into one upfront `AskUserQuestion` call (≤ 4 questions;
  split into 2 batches if more). Empty-batch = no-op. Converts N
  mid-chain `Blocked` round-trips into 1 upfront human interaction.
- **`skill-coordinator-lite.md`** — new `No auto-routing` hard rule
  preserves lite's single-shot zero-state-write contract.
- **Constitution §5 Anti-Loop Circuit Breaker** — new bullet referencing
  the 10-hop cap and naming lite as exempt.

### Added (skill polish — v3.12 scope)
- **`skill-architect.md` § Decision Records** — new H2 with a
  `Context | Decision | Consequences` table; one row per non-trivial
  trade-off. Empty section renders
  `_No non-trivial trade-offs in this artifact._`.

### Changed (token-frugality audit — v3.12 scope)
- **Audit artifact** `research/token-frugality-audit-v3.12.md` —
  per-file pass against the constitution §1 *Skills inherit everything
  below — they MUST NOT restate these rules* contract.
- **Subtractive trims** to 8 skill files:
  - Removed restated `§3 drift-check` tails from
    `skill-architect.md`, `skill-design-auditor.md`, `skill-pm.md`,
    `skill-researcher.md`, `skill-sr-engineer.md`.
  - Removed the restated `§4 routing chain` block from
    `skill-coordinator.md` (5 lines).
  - Compressed redundant `cde-oobe` incident narrative in
    `skill-qa-engineer.md`.
  - Compressed editorial parenthetical in
    `skill-code-reviewer.md` L11.
- **Net line reduction**: 580 → 576 (-0.7% at line level; character-level
  reduction is materially larger due to in-line compressions). Audit's
  *Aggregate* section documents that the spec's aspirational 5% floor
  was unachievable without deleting load-bearing content; the OR-branch
  of the spec AC was honoured by audit justification.

### Notes
- **Security coverage verified (v3.12 audit)** — constitution §6
  already covers the v3.9 evaluation's two flagged Security gaps:
  OWASP-level guidance lives at sr-engineer + code-reviewer role
  checklists; the dependency-audit rule shipped in v3.10. No §6 edits
  in this release.
- **No `tw_*` tool surface, schema, or transition-matrix changes** —
  this release is content-only. `prompts/build.ts` consumes
  `content/*.md` as opaque blobs, so section additions/edits cannot
  break the prompt-build path; build clean + 303/303 tests pass.
- **Skipped tag `v3.12.0`** — v3.12 polish and v3.13 auto-routing were
  bundled into one MINOR cut at user direction. No `#v3.12.0` install
  pin is published; consumers go directly from `#v3.11.0` to `#v3.13.0`.

## [3.11.0] - 2026-05-28

### Added
- **`doc-writer` side-channel role** — new `content/skill-doc-writer.md`,
  `prompts/doc-writer.ts`, and MCP prompt registration. Keeps `README.md`,
  `CHANGELOG.md`, and `docs/**` in sync after QA PASS. Staff-level technical
  writer persona; fact-preservation hard rule; side-channel constraint
  (not in `ALLOWED_TRANSITIONS`; uses upstream caller's `agent_id`).
- **`release-engineer` side-channel role** — new
  `content/skill-release-engineer.md`, `prompts/release-engineer.ts`, and MCP
  prompt registration. Owns post-PASS version bumps, `CHANGELOG.md` entries,
  `npm run build`, `git tag`, and `gh release create`. PASS-precondition
  hard rule; major-bump opt-in gate; HEREDOC commit messages; immutable tags;
  `scripts/check-version.mjs` gate; side-channel constraint.
- **`tw_switch_role` enum widened** to include `doc-writer` and
  `release-engineer` (zod schema + JSON inputSchema). Both roles loadable via
  `tw_switch_role` and as standalone MCP prompts.
- **`tools/role.ts` `ROLE_SKILL_MAP`** extended with both new role entries.

### Changed
- **`skill-researcher.md`** — new Hard rules `Depth` clause (`shallow` ≤ 15 min /
  `deep` ≤ 60 min), `Source Credibility Tier` (T1/T2/T3 tags on Evidence
  citations), and `Recency Gate` (sources > 18 months tagged `(stale)`;
  deep research requires ≥ 1 source ≤ 12 months old per major claim).
- **`skill-coordinator-lite.md`** — new `Scope-creep examples` H2 with 3
  concrete escalate-to-`/teamwork` cases and 1 affirmative lite case.
- **`skill-code-reviewer.md`** — new `Performance` section in Review Report
  Schema (O(n²) loops, unbatched I/O, memory leaks, algorithmic regression).
  Schema sections: 6 → 7.
- **Constitution v3.11.0 §6** — new `Dependency audit at build gate` bullet:
  `npm audit --audit-level=high` / `cargo audit` / `pip-audit` required after
  build, before `tw_update_state`. HIGH/CRITICAL findings are build failures
  unless explicitly waived.

### Notes
- **MINOR bump** — side-channel only. No `ALLOWED_TRANSITIONS` edges added;
  no `AgentName` union widened; no schema version bumps (`handoff: 2`,
  `sqlite: 2` unchanged). `#v3.10.0` consumers keep working unchanged.

## [3.10.0] - 2026-05-28

### Added
- **Constitution §2: Conditional test writing** (qa-engineer). Not every
  task requires new tests. If existing test files already cover the
  task's scope, qa-engineer writes or modifies tests accordingly. If
  NO relevant test file exists for the current task, qa-engineer MUST
  ask the user whether tests are needed before creating any — do not
  assume. Constitution bumps v3.9.0 → v3.10.0.

### Changed
- **`skill-qa-engineer.md` Phase 3 SOP** prepends a new step
  `3a. Test File Discovery` that gates test creation on existence of
  relevant test files. When the discovery step results in user-declined
  test creation, Phase 3 is skipped, the review doc logs
  `Phase 3: skipped (user declined — no existing test coverage)`, and
  the flow proceeds to Phase 4. Prior steps 3a–3d renumber to 3b–3e.

### Notes
- MINOR bump (not PATCH) — qa-engineer behavior observably changes
  (gated test creation, new user-prompt branch). Tooling, transition
  matrix, schema versions, and wire protocol are unchanged.
- Consumers pinned at `#v3.9.1` keep working unchanged. Upgrade to
  `#v3.10.0` to get the new qa SOP rule.
- Research basis: `research/architecture-and-skills-evaluation-v3.9.md`.

## [3.9.1] - 2026-05-28

### Added
- QA test coverage for the v3.9.0 code-reviewer chain (T67 / AC-12).
  33 new tests across `test/qa-flow.test.mjs` and the new
  `test/handoff-migration.test.mjs`: every new `code-reviewer:*`
  ALLOWED edge accepts; the removed `sr-engineer:In_Progress →
  qa-engineer:In_Progress` edge rejects with allowed-list naming
  code-reviewer; `REVIEW_ROUND_EXCEEDED` cap symmetric to qa_round;
  `computeNewRound` review_round semantics (FAIL increments,
  APPROVED-handoff reset gated on `prev=(code-reviewer, In_Progress)`,
  PM resets both counters); evidence-file round-trip + sanitisation;
  AC-8 verbatim hint reachability in compiled `dist/index.js`; AC-9
  stderr migration warning fires on `sr-engineer:In_Progress` and is
  silent otherwise (and on already-v2 files).

### Changed
- Revised 26 v3.8.3-era contract tests in-place across
  `schema-versions.test.mjs`, `handoff-versioning.test.mjs`,
  `sqlite-versioning.test.mjs`, `qa-flow.test.mjs`,
  `qa-visual-skill-split.test.mjs`, `drift-skew.test.mjs`. The
  pre-existing assertions encoded contracts removed by v3.9.0 AC-2
  (direct sr→qa edge, single-return `computeNewRound`, schema v1
  CURRENT). "Additive only" wording in AC-12(f) was structurally
  impossible alongside AC-2; this release ships the resolution.
- Sqlite-versioning tests now bootstrap `handoff_state` before calling
  `runSqliteMigrations` standalone, mirroring the production ctor
  flow where the schema is created before migration runs.

### Notes
- 297/297 tests pass; `tsc` clean; `scripts/check-version.mjs` OK.
- No runtime / wire-protocol changes vs v3.9.0 — patch-only test
  coverage + version bump. Consumers pinned at `#v3.9.0` keep working;
  `#v3.9.1` is recommended for anyone running `npm test` against the
  shipped checkout.

## [3.9.0] - 2026-05-28

### Added
- **`code-reviewer` role** between `sr-engineer` and `qa-engineer` in the
  routing chain. Owns code review (correctness / quality / architecture /
  security) in a clean context — reads only the diff vs base, the PM spec,
  and the architect handoff. Bias-free judgement is structural, not
  optional, per 2025–2026 industry consensus
  (`research/reviewer-role-extraction.md`).
- **`review_round` counter** symmetric to `qa_round`. Incremented on
  `(code-reviewer, FAIL)`, reset on handoff to qa or PM re-entry. Cap at
  4 (3 FAILs allowed); Round 4 forces `(pm, In_Progress)` like the qa
  circuit breaker.
- **`review_reports/review_<task-id>.md` evidence gating.** The
  `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` handoff
  is rejected when any task id in `completed_tasks` lacks a review file
  (file mode) or `code_review_reports` row (SQLite mode).
- New skill `content/skill-code-reviewer.md`, new prompt
  `prompts/code-reviewer.ts` (id `code-reviewer`), new SQLite table
  `code_review_reports`. `tw_switch_role` accepts `"code-reviewer"`.

### Changed
- **Routing chain**: `sr-engineer → qa-engineer` direct edge replaced
  with `sr-engineer ↔ code-reviewer → qa-engineer`. Constitution v3.9.0.
- **`qa-engineer` scope narrowed**: rejects only for failing tests,
  missing AC coverage, or test-infra defects. Style/architecture/
  correctness review moved to code-reviewer; QA escalates rather than
  FAILs on those grounds.
- **`computeNewRound` signature**: now takes
  `(prev_qa_round, prev_review_round, next, prev?)` and returns
  `{ qa_round, review_round }`. Internal callers updated; external
  callers must adopt the new shape.
- **Schema bumps**: `CURRENT_VERSIONS.handoff: 1 → 2`,
  `CURRENT_VERSIONS.sqlite: 1 → 2`. Migrations add `review_round=0` to
  existing rows.

### Breaking
- **In-flight `sr-engineer:In_Progress` tickets** at upgrade time must
  be manually re-routed to code-reviewer (or rolled back to pm). The
  old `sr-engineer:In_Progress → qa-engineer:In_Progress` edge is
  rejected by the new transition matrix. The v1→v2 handoff migration
  emits a one-shot stderr warning on first parse when this state is
  detected.
- **`HandoffStorage.writeState`** gains a trailing optional
  `reviewRound?: number` parameter. Trailing-optional is
  backwards-compatible for positional callers; named-arg callers should
  pass it for accurate persistence.

### Notes
- `teamwork-lite` (solo-dev mode) is **explicitly excluded** from the
  code-reviewer step — lite is server-read-only same-context work
  where the reviewer gate is structurally meaningless.
- Spec: `specs/code-reviewer-role-extraction.md`.
- Architecture: `specs/code-reviewer-role-extraction-architecture.md`.

## [3.8.3] - 2026-05-26

### Changed
- **`skill-qa-visual.md` extracted from `skill-qa-engineer.md`** — the
  v3.8.2 Phase 1.5 SOP block (skip-if-absent gate, six diff categories,
  three failure routes, PASS sub-verdict, rationale) was moved verbatim
  into a new `content/skill-qa-visual.md`. `skill-qa-engineer.md` step 4
  shrinks to a 3-line lazy-load hook that instructs the agent to Read
  the sub-skill *only* when `design/<feature>.md` declares a
  `## Visual Baselines` H2.
- **Token impact** — non-UI workspaces (server logic, CLI, this MCP
  repo) save ~300 input tokens on every qa-engineer load. UI workspaces
  pay roughly the v3.8.2 total: the Read brings the sub-skill into
  context on demand. Motivated by
  `research/skill-token-cost-and-pixel-perfect-success-rate.md`
  § Recommendation watch-item (`skill-qa-engineer.md` was 2.17K tokens,
  27% larger than the next-biggest skill).

### Backwards-compatible
- Phase 1.5 contract is unchanged: same skip-if-absent gating, same six
  diff categories, same three failure routes (visual drift → sr-engineer,
  missing baseline → design-auditor, missing impl → sr-engineer), same
  PASS sub-verdict. v3.8.2 `design/<feature>.md` files with Visual
  Baselines declarations execute the same protocol.
- No server tool surface, prompt schema, ALLOWED_TRANSITIONS, or
  handoff/state format change. No new role registered. Pure SOP-text
  reorganisation.
- SOP step numbering 1..7 in `skill-qa-engineer.md` is preserved; Phase
  N labels remain stable so internal cross-refs keep working.

### Notes
- Spec: `specs/qa-visual-skill-split.md`.
- Mechanism chosen: SOP-only lazy Read (rejected alternatives:
  server-side conditional inject, separate role with `tw_switch_role`).

## [3.8.2] - 2026-05-26

### Changed
- **`design-auditor` Artifact Schema** (`content/skill-design-auditor.md`): new
  OPTIONAL `**Visual Baselines**` H2 section. 4-column table
  `surface id | baseline path | impl path | notes`. `surface id` MUST match a
  *Source manifest* row; `baseline path` is workspace-relative to whatever
  image file the design source produced (Figma / Sketch / XD / Penpot export,
  PDF page rendered to PNG, raw mockup file, photo); `impl path` is
  workspace-relative to where the QA agent expects the implementation
  screenshot at QA time. Absence of the section is the explicit no-op signal
  to QA Phase 1.5.
- **`skill-qa-engineer` SOP** — new step 4 `**Phase 1.5 — Visual Compare**`
  inserted between Phase 1 (3a Copy Audit / 3b Visual Audit) and Phase 2.
  Skip-if-absent gating against `design/<feature>.md` *Visual Baselines*.
  For each row, QA Reads both PNGs (multimodal context) and emits a
  structured diff covering layout / spacing / alignment / element presence
  / color / text / image content into the review doc. Three failure routes:
  visual drift → sr-engineer; missing baseline file → design-auditor;
  missing impl file → sr-engineer. Prior steps 4–6 renumber to 5–7
  (`Phase 2 — Discussion`, `Phase 3 — Tests`, `Phase 4 — Run`); the
  *Phase N* labels are unchanged so internal cross-refs remain stable.

### Backwards-compatible
- `design/<feature>.md` files written under v3.8.1 (Source manifest present,
  no Visual Baselines section) cause QA Phase 1.5 to skip silently — no
  retroactive migration. Phase 1 behavior is unchanged.
- Non-UI features (server logic, CLI tools, this MCP repo) pay zero
  Phase 1.5 overhead because they declare no Visual Baselines.
- Server tool surface unchanged. No new `tw_*` tool, no
  ALLOWED_TRANSITIONS edits, no handoff/state format change. Pure
  skill-text refinement.

### Notes
- Phase 2 of `research/pixel-perfect-and-design-coverage.md` — the
  vision-LLM screenshot-compare arm. Phase 3 (Playwright VRT) remains
  out of scope.
- SOP-only delivery (no `tw_visual_compare` tool); vision capability is
  provided by the QA agent's host LLM, not via the Figma REST API or any
  pixel-diff library.
- Spec: `specs/pixel-perfect-visual-compare.md`.

## [3.8.1] - 2026-05-26

### Changed
- **`design-auditor` Source manifest is now exhaustive + status-tagged**
  (`content/skill-design-auditor.md` Artifact Schema): every surface in
  the design source (Figma frame, Sketch / XD artboard, Penpot board,
  PDF page, image / photo file) MUST appear in the manifest, tagged
  `status: audited | deferred | out-of-scope` with a one-line reason for
  non-`audited` rows. Replaces the old behaviour of audit-only-task-
  referenced-frames + cite-the-rest-in-Out-of-Scope, which silently
  dropped frames the task description did not name.
- **`design-auditor` multi-pass is now explicit** — Hard rules upgraded
  from single-pass `Token-frugal` to `Token-frugal multi-pass`: ≤ 250
  lines per pass, up to 5 passes per feature, each follow-up pass MUST
  flip ≥ 1 `deferred` row to `audited`. No-op passes forbidden
  (constitution §5 anti-loop).
- **`skill-pm` Deferred-surface gate** (`content/skill-pm.md` SOP step 2):
  PM MUST enumerate every `status: deferred` manifest row (pointer +
  reason) under the spec's *Dependencies / Prerequisites* section, so
  the team knows which surfaces ship without coverage.

### Backwards-compatible
- Older `design/<feature>.md` artifacts written before v3.8.1 lack the
  status column and require no retroactive migration. Downstream roles
  treat the listed surfaces as `audited` and any unknown surfaces as
  `unknown`.
- `no-design` mode is unchanged: empty manifest, single pass, no gate
  activation.
- Server tool surface unchanged. No prompt schema, ALLOWED_TRANSITIONS,
  or handoff/state format change. Pure skill-text refinement.

### Notes
- Phase 1 of `research/pixel-perfect-and-design-coverage.md`. Phase 2
  (vision-LLM screenshot compare) and Phase 3 (Playwright VRT) remain
  out of scope.
- Spec: `specs/pixel-perfect-design-coverage.md`.

## [3.8.0] - 2026-05-21

### Added
- **`design-auditor` role** — new optional pre-PM role registered in
  `tools/transitions.ts`, `tools/role.ts`, `prompts/design-auditor.ts`,
  and `index.ts` prompt list. Reads any design source — Figma, Sketch,
  Adobe XD, Penpot, PDF mockup, PNG screenshot, paper photo — and
  produces `design/<feature>.md` with verbatim *Copy / Strings* and
  *Visual Tokens* tables that PM copies into the spec.
  Source-agnostic: detects mode from the supplied design surface and
  picks the matching extraction strategy. Never assumes Figma. Tasks
  with no design reference skip the auditor entirely (zero per-prompt
  overhead — the skill is not loaded).
- **`skill-coordinator` Design-source detection** — coordinator scans
  every incoming PRD / ticket / user prompt for design-source patterns
  (`figma.com`, `sketch.cloud`, `xd.adobe.com`, `penpot.app`, `marvelapp`,
  `invisionapp`, `framer`, `.fig` / `.sketch` / `.xd` / `.penpot`, plus
  mockup-context `.pdf` / `.png` / `.jpg`, plus EN / 中文 / 日本語
  design keywords). On hit → routes to `design-auditor` before PM.
- **ALLOWED_TRANSITIONS** — three new edges:
  `null → design-auditor:In_Progress` (coordinator entrypoint),
  `researcher:In_Progress → design-auditor:In_Progress` (chain after
  researcher), `pm:In_Progress → design-auditor:In_Progress` (PM
  re-route when refs surface late). Exit edges:
  `design-auditor:In_Progress → pm:In_Progress` and
  `design-auditor:Blocked → {design-auditor, pm}:In_Progress`.

### Changed
- **`skill-pm` SOP step 2** — PM must now copy `design/<feature>.md`'s
  *Copy / Strings* and *Visual Tokens* tables verbatim into the spec
  when a design audit exists. Additional entries authored by PM stay
  flagged `authored-here` per the existing spec schema rule.
- **Constitution §4 routing chain** — adds the optional design-auditor
  hop with a one-paragraph explanation of when it fires.

### Token economy

The design-auditor's skill markdown is only loaded when (a) the
coordinator detects a design source and (b) routes to it via
`tw_switch_role` or the dedicated prompt. The routine 80% case
(refactors, infra, bug fixes, server-side work) bypasses it entirely.
The new skill file is intentionally ≤ 80 lines so even active runs
stay token-frugal — comparable to `skill-researcher` (24 lines) +
`skill-pm` (44 lines). No new MCP tools added; the role reuses
existing `tw_*` surface.

## [3.7.4] - 2026-05-21

### Added
- **`skill-pm` Visual Tokens H2** (Spec Schema, between Copy / Strings
  and Out of Scope). Every concrete literal-valued visual property —
  hex color, sp font size, dp dimension, weight, radius, stroke,
  opacity — must be enumerated in a 4-column table `token id |
  property | value | source` with the source quoted from a Figma node
  id, fill / text-style name, design-system token name, or
  `authored-here` with a one-line justification. Layout proportions
  (`weight(1f)`), runtime values, and platform defaults are explicitly
  excluded. PM blocks if any literal lacks a source.
- **`skill-qa-engineer` Visual Audit Gate** (Phase 1 step 3b). QA
  greps the source tree for each spec'd literal and FAILs on drift
  (impl ≠ spec), coverage gap (impl literal missing from spec —
  bounces to PM), or — when Figma MCP is available — source rot
  (Figma value changed after spec was written).

### Why
v3.7.3's Copy Audit Gate fixed text drift. Visual properties (colors,
spacing, typography literals) still relied on PM-authored stylistic
ACs, which only catch what the spec already enumerates. An unsourced
hex slipping into `OobeTheme.kt` — exactly what kicked off the
`cde-oobe-figma-alignment` re-work — stayed invisible. v3.7.4 makes
every literal a tracked, sourced contract, audited at QA time. This is
the cheapest of the four design-fidelity options surveyed in
`research/design-fidelity-enforcement.md`; pixel-baseline approaches
(Paparazzi against Figma exports) remain out of scope.

## [3.7.3] - 2026-05-21

### Added
- **`skill-pm` Copy / Strings H2** (Spec Schema). Every spec must now
  enumerate every user-facing string the feature introduces or changes
  in a 3-column table `string id | exact text | source`. *Source* must
  be a PRD section number, a Figma node id, a CSV/ticket ref, or the
  literal token `authored-here` with a one-line justification. PM
  blocks if any string lacks a source.
- **`skill-qa-engineer` Copy Audit Gate** (Phase 1 step 3a). QA now
  greps the source tree for each spec'd string and FAILs on either
  drift (impl ≠ spec) or coverage gap (impl introduces a string not in
  the spec — bounces back to PM, not sr-engineer).

### Why
The `cde-oobe` implementation shipped titles like `"Select your language"`
that the engineer (correctly) had no source for — the PRD only said
"功能：選取系統主要語系". The Figma title was literally `"Language"`.
Stylistic ACs (font/color/size) passed cleanly because they tested
the *style*, not the *text*. v3.5.3 closed the "did anyone fetch the
design?" gap; v3.7.3 closes the "did anyone audit the words?" gap.

## [3.7.2] - 2026-05-21

### Added
- **Constitution v3.5.3 — External-reference policy** (`content/constitution.md` §7).
  A spec referencing external artifacts (URLs, Figma/Sketch files, ticket IDs,
  mockups, "see XYZ" prose) is presumed *incomplete* until each reference is
  (a) fetched, (b) indexed via `tw_index_prd`, or (c) user-confirmed as
  ignorable. No role may unilaterally treat a reference as out-of-scope.
- **`skill-pm` Resource Audit Gate** (new SOP step 3). PM must grep every
  supplied requirement doc for `http(s)://`, `figma`, `sketch`, `mockup`,
  `設計圖`, `URL`, `link`, `Azure DevOps`, `JIRA` and ask the user
  `fetch / index / ignore` per hit before writing the spec. Decisions are
  recorded in the spec's *Dependencies / Prerequisites* section.
- **`skill-architect` Deferred Resources section + Sanity Gate** (Artifact
  Schema + new SOP step 4). Architect must cross-check every PM-deferred
  reference against the spec and block if any spec reference is missing
  from `Deferred Resources` — closes the loophole where architect
  silently dropped a Figma URL during the `cde-oobe` rollout (2026-05-20).

### Why
First triggered when the CDE OOBE wizard shipped without ever loading the
Figma mockup linked seven times in the PRD. Architect's own design doc had
unilaterally declared the link out-of-scope; nothing in the SOPs forced a
user confirmation. These three changes turn "did anyone fetch the link?"
into a server-enforced gate via the spec/architecture artifacts.

## [3.7.1] - 2026-05-20

### Changed
- **`handoff.md` write path emits English headers.** `bin/agc-init.mjs`
  scaffold and `tools/handoff.ts` `writeHandoffState` now produce
  `# Handoff State / ## Completed / ## Pending & Handoff Notes` (and
  `- (none)` empty-section sentinel) instead of the mixed Chinese +
  English template. Parser keeps bilingual section regex and continues
  to recognize the legacy `無` sentinel, so existing handoff.md files
  parse unchanged. No tool surface or schema change.

## [3.7.0] - 2026-05-20

### Added
- **`agc init` CLI** (`bin/agc-init.mjs`). Scaffolds an
  agent-governance-managed workspace in one command:
  `.current/handoff.md`, `.current/.config.json`, and `tasks.md` with
  sane defaults. Idempotent — existing files are skipped, no `--force`
  flag. Wired as the `agc` bin in `package.json`; invoke via
  `npx -y --package=github:Paul-hengChen/agent-governance-mcp#v3.7.0 agc init`.
  Closes P0 onboarding item from `research/agc-value-proposition-2026-05-20.md`.

### Changed
- **SessionStart hook defaults to `skill-coordinator-lite.md`**
  (`bin/agent-governance-context.mjs`). Solo-dev direct-execute is now
  the default boot mode; the intro prose names "Coordinator-Lite mode"
  and points at `/teamwork` for cross-module work. Existing managed
  workspaces see the lite skill on next session start with no config
  change.
- **Full coordinator opt-in via `AGC_DEFAULT_SKILL=full`**. Setting this
  env var in the Claude Code session env restores the previous full
  coordinator skill + intro prose verbatim. No breaking change to the
  `/teamwork` or `/teamwork-lite` prompts themselves — both keep their
  v3.6.x behavior; only the hook default flipped.

### Tests
- 8 new tests in `test/p0-onboarding-lite-default.test.mjs` covering
  scaffold happy path, idempotency, parseHandoff round-trip, bin
  wiring, both hook variants, and CLI usage/silent-no-op smoke tests.
  Suite: 243/243 passing.

## [3.6.1] - 2026-05-20

### Fixed
- **`skill-coordinator-lite.md` slimmed** (2502 → 1097 bytes, -56%). The
  v3.6.0 lite skill was paradoxically *larger* than the full coordinator
  skill, making the `teamwork-lite` prompt 120 tokens heavier than
  `teamwork` at load time — contradicting the lite-mode value
  proposition. Trimmed to essentials while preserving the section
  contract (`Persona`, `When to use`, `Hard rules`, `SOP`, `Output rule`)
  the integration tests rely on.
- **Result**: `teamwork-lite` prompt is now ~228 tokens (-13%) smaller
  than `teamwork` at load time. Per-task savings (chain skipping) are
  unchanged from v3.6.0.

## [3.6.0] - 2026-05-20

### Added — Lite Mode Coordinator (`/teamwork-lite`)
First architectural response to the post-fusion value audit
(`research/value-assessment.md`), which identified the multi-role chain
as net overhead for solo-dev daily work. Spec:
`specs/lite-mode-coordinator.md`.

- **New prompt `teamwork-lite`** — solo-dev minimal-overhead entry
  point. Loads the full constitution (single source of truth preserved)
  plus a new lighter skill `content/skill-coordinator-lite.md` that
  documents direct-execute orientation: no `tw_switch_role`, no
  `tw_detect_drift` by default, no chain routing.
- **Lite is server-read-only by design.** `tools/transitions.ts`
  `AgentName` is intentionally unchanged — lite has no valid `agent_id`
  in the routing chain, so it cannot call `tw_update_state` /
  `tw_complete_task` / `tw_add_task` / `tw_rollback_task`. This is
  documented as a hard rule in the skill. Work that needs handoff
  tracking should use `/teamwork` (full).
- **`RAG_SKIP_ROLES`** now also skips `teamwork-lite` — triage doesn't
  need PRD chunks.
- **6 new integration tests** (`test/teamwork-lite.test.mjs`) exercise
  the prompt registration, dispatch, RAG skip, and skill content.
  Total suite: 235/235 pass.
- **README Step 5** documents when to use lite vs full and what lite
  skips.

### Migration
- Additive only — existing prompts and behavior unchanged. Users opt
  into lite mode by invoking the new prompt; no config flag, no
  workspace change.

## [3.5.2] - 2026-05-20

### Added — YAGNI Single-Use (Constitution v3.5.2)
Closes the single remaining medium-high gap from the post-v3.5.1 audit
(`research/post-v3.5.1-coverage-audit.md`). Spec:
`specs/constitution-v3.5.2-yagni-single-use.md`.

- **§1 MVP strict** extended (from R2): `No abstractions for single-use
  code.` Concrete YAGNI rule — distinct from "no speculative refactors"
  (which targets *edits*) by targeting *new code shape* (e.g. a base
  class with one subclass, a helper hook with one caller).

### Status
- The 12-rule template fusion cycle is now considered **complete**. R5
  and R6 remain deferred (need server-side enforcement); all other
  rules either fully covered or correctly scoped to skill files.

### Migration
- Content-only. No code or schema changes.

## [3.5.1] - 2026-05-20

### Added — Rule Completeness (Constitution v3.5.1)
Three gaps in the v3.5.0 fusion (vs the original 12-rule template) closed —
spec: `specs/constitution-v3.5.1-rule-completeness.md`.

- **§1 Surgical changes** (new bullet, from R3): "Touch only what the task
  requires. Don't 'improve' adjacent code, comments, or formatting. Clean
  up only your own mess." Complements `MVP strict` (which limits *what*
  is added) by limiting *what is edited*.
- **§2 Match conventions** extended (from R11): "Conformance > personal
  taste; if a convention is genuinely harmful, surface it — don't fork
  silently." Prevents agents from quietly drifting from house style.
- **§7 Fail loud** extended (from R12): `"Tests pass" is wrong if any
  were skipped.` Explicit qa-engineer guardrail against partial-test PASS.

### Migration
- Content-only — no code or schema changes. Pin to `#v3.5.1` to receive
  the updated constitution; agents will see the new rules on next
  session-start.

## [3.5.0] - 2026-05-20

### Added — Cognitive Discipline (Constitution v3.5.0)
Cross-references: research `research/claude-md-12-rule-fusion.md`, spec
`specs/constitution-v3.5-cognitive-discipline.md`. Five high-value rules
extracted from the 12-rule CLAUDE.md template (R1, R4, R7, R8, R12) and
fused into a new constitution §7 — ~100-token addition for the
"thinking quality" dimension the prior process-compliance rules lacked.

- **New §7 Cognitive Discipline** with 5 bullets: Think first,
  Goal-driven, Surface conflicts, Read before write, Fail loud.
- **§2 new bullet — Match conventions** (from R11): follow existing
  codebase style before introducing new patterns; grep when in doubt.
- **`skill-qa-engineer` new Hard rule — Tests verify intent** (from R9):
  tests must encode WHY (contract/invariant), not just WHAT.

### Deferred (intentional)
- R5 (use model only for judgment) — implicitly satisfied by the
  tool-driven MCP architecture.
- R6 (token budgets 4k/task, 30k/session) — needs server-side tracking
  to be enforceable; deferred per research open question #1.

### Migration
- Content-only — no code or schema changes. No action required.

## [3.4.0] - 2026-05-20

### Added — Schema Versioning (Phase 4)
- **Lazy migrate-on-read** across all four persisted artifacts: handoff YAML
  frontmatter, `tasks.md` sentinel, SQLite (`PRAGMA user_version`), and
  `.current/.config.json`. Older files are detected by missing/lower
  `schema_version` and upgraded transparently on the next read; no manual
  migration step.
- New module `schema/versions.ts` (current version constants, registries).
- New migration runners — `schema/migrations-handoff.ts`,
  `schema/migrations-tasks.ts`, `schema/migrations-sqlite.ts`,
  `schema/migrations-config.ts` — each exporting an ordered `MIGRATIONS`
  array keyed by `from → to`.
- `tw_detect_drift` now also surfaces schema-version skew (e.g. handoff at
  v2 but tasks.md still at v1) so cross-artifact drift is visible.
- New doc `docs/schema-versions.md` explaining how to ship a new schema
  version (when to bump, where migrations live, test expectations).

### Added — Token-Efficiency Improvements
- **Drift response compression** (`tools/drift.ts:compressDriftDetails`)
  collapses repeated drift lines and caps the response payload so
  `tw_detect_drift` stops bloating per-turn context.
- **`pending_notes` truncation** (`tools/handoff.ts`) enforces a total
  character budget on `pending_notes` returned by `readState()`. Older
  notes are dropped first; truncation metadata is attached so callers can
  see what was trimmed.

### Migration
- All format upgrades are read-side and idempotent — no maintenance step
  required. Files written by older versions continue to load; files
  written by 3.4.0 carry the new `schema_version` field.
- SQLite databases gain a `schema_version` row via additive migration on
  first boot.

## [3.3.0] - 2026-05-19

### Changed
- Project renamed from `teamwork-mcp-server` to `agent-governance-mcp` — package name, GitHub repo, bin commands (`agent-governance-mcp`, `agent-governance-context`), and all internal references updated.

## [3.2.0] - 2026-05-18

### Added — QA-Flow Enforcement
- **Routing-chain state machine**: `tw_update_state` now validates every write
  against an `ALLOWED_TRANSITIONS` matrix keyed on `(prev_last_agent,
  prev_status)`. Illegal edges (e.g. `sr-engineer → PASS`) reject with a
  structured envelope listing the attempted tuple and allowed alternatives.
  Self-loop on same-agent `In_Progress→In_Progress` is fast-pathed.
- **QA round counter**: `qa_round` is now persisted in handoff frontmatter
  (file mode) and the `handoff_state` table (SQLite). Increments on
  `(qa-engineer, FAIL)`, resets on PASS or PM re-entry. Round 4 triggers
  forced rollback to PM — only `(pm, In_Progress)` is accepted thereafter.
- **Evidence-of-QA**: PASS path now requires `qa_reports/review_<id>.md`
  (file mode) or a `reports` table row (SQLite) for every `completed_tasks`
  id. `tw_update_state` gained an optional `qa_review` field; when set with
  `agent_id="qa-engineer"` and status in {PASS, FAIL}, the server records
  the review automatically.
- **`tw_complete_task` agent gate**: `agent_id="qa-engineer"` now required.
  Symmetric to the PASS gate; closes the bypass where any role could flip
  `[x]` directly.
- **`UpdateStateArgs` schema refinement**: `status="PASS"` requires
  `agent_id="qa-engineer"` at the zod layer, so the constraint is visible
  in the MCP client error envelope, not just a handler `if`.
- New module `tools/transitions.ts` (pure: ALLOWED_TRANSITIONS,
  validateTransition, computeNewRound, requireQaEngineer).
- New module `tools/evidence-file.ts` (file-mode recordReview/hasEvidence).
- `HandoffStorage` interface gained `recordReview` + `hasEvidence`;
  `writeState` gained a trailing `qaRound` parameter.

### Migration
- SQLite databases upgrade automatically on first boot: the schema gets a
  `qa_round` column (additive `ALTER`) and a new `reports` table.
- File-mode `handoff.md` without `qa_round` frontmatter loads as `qa_round=0`.
- No tool-name changes; client code keeps working.

### Out of Scope (deferred)
- Server-side session role snapshot (option C). Without MCP caller identity
  binding it only relocates the self-declaration; revisit when MCP gains a
  caller-id field.

## [3.1.2] - 2026-05-16

### Changed
- Constitution heading bumped to `v3.1.2` (`content/constitution.md`) so the
  in-prompt version label stays aligned with the server package version. Going
  forward, each release bumps both together; no semantic change to the rules
  themselves in this release.

## [3.1.1] - 2026-05-16

### Fixed
- SessionStart hook hint now lists `/architect` alongside the other four roles
  (`bin/agent-governance-context.mjs`). Previously, users were never told the architect
  role existed via the auto-injected coordinator briefing, even though
  constitution §4 and the coordinator routing table both include it.
- `markStateRead()` (`guards/session.ts`) no longer scans the workspace
  filesystem when the workspace path doesn't exist on the host. In SQLite/HTTP
  mode the server may handle workspace paths it can't see locally; previously
  every `tw_get_state` call there did wasted `stat()` syscalls (and risked
  EACCES noise on hostile mounts). Freshness in that mode still rides on the
  `extra` snapshot map.
- `CLAUDE.md` no longer claims the SessionStart hook is a silent no-op in this
  repo. The repo dogfoods its own server (`.current/`, `tasks.md` are present);
  the hook fires here exactly as in any managed workspace.
- `skill-sr-engineer.md` "Hard rules" no longer restates constitution §2 and §3
  verbatim — both bullets now point at the relevant constitution section. This
  honors constitution §1's "skills MUST NOT restate these rules".

## [3.1.0] - 2026-05-15

### Added
- `tw_add_task` MCP tool — append tasks to the active list. Works in stdio (markdown)
  and HTTP/SQLite modes. Required for seeding tasks remotely without filesystem access.
- SQLite storage adapter for HTTP mode (`SqliteHandoffStorage`) implements the same
  `HandoffStorage` interface as the markdown file storage — no workspace files needed
  on the server host.

### Changed
- Constitution and skills slimmed (v3.1.0): removed redundancy, fixed role gaps,
  consolidated repeated prompts. Net token budget per role ≈ 1.4k.
- `tools/tasks.ts` is now a thin delegator through `getActiveStorage()`. File-system
  task ops live in `tools/tasks-file.ts`; SQLite task ops live in `tools/storage-sqlite.ts`.
- `tools/drift.ts` rewritten to use `storage.listTasks()` — no direct fs access, so
  drift detection works identically in stdio and HTTP modes.
- README clarifies first-time install timing, hook ordering, and the `Step 4: Verify`
  pass.

### Fixed
- Architect role prompt registered in `index.ts` (previously missing from the
  `ListPrompts` handler).
- Stable hook bin path: `bin/agent-governance-context.mjs` exposed as a `bin` entry so users
  no longer have to dig into `~/.npm/_npx/<hash>/…`.
- `better-sqlite3` is loaded lazily — stdio users without a C++ toolchain are no
  longer blocked at install time. HTTP mode still requires it.
- Per-IDE install docs (Claude Code, Claude Desktop, Cursor, Continue, Zed, Windsurf,
  Cline, Gemini, Antigravity) reconciled to a single canonical install command.
- Token policy + tool schema synced across all role prompts.

## [3.0.x and earlier]

This is the first release under a version-pinned distribution policy. Prior history is
preserved in `git log` and the GitHub commit graph; future entries will live in this file.
