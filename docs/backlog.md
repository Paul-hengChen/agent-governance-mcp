# Backlog — architecture-improvement tickets

Tickets from the 2026-07-06 architecture review. Each is a candidate for a
future `/teamwork` feature; none blocks a release on its own.

> Recorded 2026-07-06. Prior backlog (B1–B11, recorded 2026-06-02) cleared;
> done rows dropped, still-open B8/B9 carried forward below.
>
> **2026-07-07 revision** (after shipping A1/A4–A7/A9 through the /teamwork
> chain, v3.44.0–v3.45.0): C1–C5 added from live process friction observed
> during those runs. Priorities revised: A10 P2→P1 (its prerequisites A9 +
> the A1 orchestrator extraction both landed, cost dropped); A2 recommended
> to fold into A10 (split gates/ while data-fying them, one QA round); A12
> deprioritized (A9 shrank its marginal benefit).
>
> **2026-07-09 revision** (during the C9 /teamwork run): C14–C17 added from
> live process friction observed in that run (pin carry-forward fragility,
> expected-red opacity, code-reviewer ledger write, brief boilerplate). An
> explicit execution order for everything still open is recorded in
> *Recommended execution order* below the table.
>
> **2026-07-10 revision** (architecture review, lite session): with A/B/C
> series fully shipped, D1–D8 added from a fresh review of the shipped system.
> One observed live bug (D1); the rest are structural: the review's thesis is
> that rule-corpus growth is superlinear and D3 (gate telemetry → rule
> retirement) is the only counter-pressure — it should outrank adding any new
> gate. Suggested order: D1 → D3 → D2 → D5 → D4 → D6 → D7+D8.
>
> **2026-07-11 revision** (lite session, post-D5/D9 architecture Q&A): E1–E8
> added from a "what's left for near-autonomous feature/bug-fix delivery"
> review grounded in the `research/` retrospectives (Language 1.05M-token
> run, Mode four-phase integration, F2 false-green postmortem,
> ticket-splitting report). Thesis: the A–D series eliminated the
> process-failure class (crash, pin loss, hand-edited state, collisions);
> the remaining success-rate ceiling is set by contract-correctness-before-
> work, outcome-shaped verification, and concurrency isolation — none of
> which is another prose rule. Suggested order:
> E8 → E4 → E2 → E1 → E3 → E7 (after D10) → E6 → E5.
>
> **2026-07-15 revision** (from the 104447-F0 field retrospective,
> `research/104447-F0-retrospective-agc-governance-issues.md` — first
> full-chain crash-and-resume observed in a managed consumer workspace):
> E19–E30 added. Dominant costs measured there: a silently-dead qa-engineer
> session (1h55m unnoticed idle, ≥250k tokens of re-verification) and an
> evidence-schema tightening mid-feature (3 consecutive gate rejections).
> One finding was a *mis*-finding worth its own ticket: both the retro and
> the operator concluded the usage.jsonl token sidecar "was never
> implemented" when it is merely un-armed (E27). Suggested order:
> E19 (human-prioritized, executed same day) → E20+E21 (content-only,
> halve the crash cost) → E23 → E24 → E26 → E22 → E25/E27–E30.

| id | desc | priority | depends_on | est. files | design-link |
|----|------|----------|------------|------------|-------------|
| A1 | Tool/prompt registry pattern — de-triplicate `index.ts` registration — **done (2026-07-07)** | P1 | — | ~14 (`index.ts` + every `tools/*.ts` + prompt registration) | — |
| A2 | Split `tools/evidence-file.ts` (994 lines) into per-gate `gates/` modules — **done (2026-07-08, via A10)** | P1 | — | ~8 (`evidence-file.ts` → `gates/*.ts`, `transitions.ts`, tests) | — |
| A3 | Build-time validator for constitution span-strip markers — **superseded by A9** | P2 | — | ~3 (`scripts/check-spans.mjs` new, `package.json`, test) | — |
| A4 | Strip version/origin tags from governance text at build time — **done (2026-07-06)** | P1 | — | ~4 (`prompts/build.ts`, `content/*.md`, test) | — |
| A5 | Error-code contract test: `content/*.md` ↔ code — **done (3360c68)** | P1 | — | ~2 (new test, maybe a shared error-code export) | — |
| A6 | Consolidation rewrite of `skill-qa-visual.md` (265 → 124 lines) — **done (77a6373)** | P1 | — | ~2 (`content/skill-qa-visual.md`, evidence-parser test run) | — |
| A7 | Consolidation rewrite of `skill-pm.md` (gates → Gate Summary table) — **done (2026-07-06)** | P1 | — | ~2 (`content/skill-pm.md`, tests) | — |
| A8 | Single-owner dedup of multi-told mechanisms (cut-approval ×3 — *resolved via C2, 2026-07-07*; self-converge ×2 still open) — **done (2026-07-10, v3.60.0)** | P2 | — | ~5 (constitution + coordinator + pm + lite + sr skills) | — |
| A9 | Compose-not-strip: overlay modules replace fence stripping in `build.ts` — **done (2026-07-07)** | P2 | — | ~8 (`prompts/build.ts`, split `content/constitution*.md`, tests) | — |
| A10 | Gate registry as structured data → code + rendered prose — **done (2026-07-08)** | P1 | A9 ✓ | ~10 (`gates` data file, `transitions.ts`, `handoff-orchestrator.ts`, `build.ts`, content, tests) | — |
| A11 | Escalation-route tables + unified WHEN/DO/ELSE rule grammar across skills — **done (2026-07-08)** | P2 | A6, A7 | ~12 (all `content/skill-*.md`, constitution) | — |
| A12 | Shared SOP partials + Limits number registry — **done (2026-07-10, v3.64.0)**; follow-up const-06 qa_round naming consistency fix **shipped v3.64.1** | P2 | A9 ✓ | ~14 (all content files, `build.ts`) | — |
| A13 | §1 polish: unified output policy, watermark decision table, positive examples per schema — **done (2026-07-08)** | P2 | — | ~6 (constitution + several skills) | — |
| B8 | §7 external-reference policy has no server-side enforcement gate (carried forward) — **done (2026-07-09)** | P1 | — | ~4 (`tools/transitions.ts`, evidence/ledger check, constitution §7) | — |
| B9 | Per-feature token budget + coordinator STOP at ceiling (carried forward) — **done (2026-07-10, v3.63.0)** | P2 | — | ~3 (coordinator SOP, handoff/config field) | — |
| C1 | Transitions matrix lacks amend/repair semantics (pm re-entry strands downstream roles) — **done (2026-07-07)** | P1 | — | ~4 (`tools/transitions.ts`, constitution §3.1, skill-coordinator, tests) | — |
| C2 | Cut-approval cannot cross the subagent boundary — formalize coordinator-attested approval — **done (2026-07-07)** | P1 | — | ~5 (`handoff` field, `transitions.ts`/orchestrator, skill-pm, skill-coordinator, tests) | — |
| C3 | Per-task-id evidence check forces stub pointer files — accept covering review + id manifest — **done (2026-07-08)** | P2 | — | ~3 (evidence check in orchestrator/evidence-file, skills, tests) | — |
| C4 | Drift detector drowned by historical noise — acknowledged-baseline / archive mechanism — **done (2026-07-07)** | P2 | — | ~4 (`tools/drift.ts`, maybe `tw_sync`/config, tests) | — |
| C5 | Watermark toolchain: template hardcodes tier; validateWatermark appends instead of replacing on mismatch — **done (2026-07-10, v3.59.0)** | P2 | — | ~4 (`lib/watermark-check.ts`, `templates/claude-code-agents/*`, tests) | — |
| C6 | Prompt-injection state footer reports "No handoff state found" while handoff exists; stale `prd_path` suspect — **done (2026-07-08, v3.48.0)** | P1 | — | ~3 (`prompts/build.ts` state loader, `bin/agent-governance-context.mjs`, test) | — |
| C7 | §2 test-ownership absolutism collides with mechanical version-literal edits at release — **done (2026-07-09)** | P2 | — | ~3 (constitution §2, skill-release-engineer, version-assertion tests) | — |
| C8 | Crash-resume protocol: mid-role kill leaves no §3 failure write; resume drops dispatch-time model pin — **done (2026-07-09)** | P2 | — | ~2 (skill-coordinator SOP, maybe handoff field) | — |
| C9 | pending_notes free-text protocol tokens (`next_role:`/`resume_of:`/`review: APPROVED`) → structured handoff fields — **done (2026-07-09, v3.55.0)** | P2 | A10 ✓ | ~6 (`tools/handoff.ts` schema, `transitions.ts`, orchestrator, skills, tests) | — |
| C10 | qa-engineer / release-engineer bookkeeping boundary blur (QA did version bump + CHANGELOG in A10-10) — **done (2026-07-10, v3.58.0)** | P2 | — | ~3 (skill-pm cut guidance, skill-qa-engineer, skill-release-engineer) | — |
| C11 | Constitution double-injection: SessionStart hook + `/teamwork*` prompt both carry the full constitution in one session — **done (2026-07-08, v3.48.0)** | P2 | — | ~3 (`prompts/build.ts`, `bin/agent-governance-context.mjs`) | — |
| C12 | Registry doc-facing fields (`triggerEdge`/`armCondition`/`clearingArtifact`) have zero consumers/tests — fourth unverified copy of gate semantics — **done (2026-07-10, v3.61.0, option b: test-assertion parity)** | P2 | A10 ✓ | ~4 (`gates/registry.ts`, `prompts/build.ts` or `test/error-code-contract.test.mjs`, content) | — |
| C13 | release-engineer has no legal handoff write; on TRANSITION_REJECTED the subagent hand-edited handoff.md, wedging the state machine — **done (2026-07-08)** | P1 | — | ~4 (`tools/transitions.ts`, skill-release-engineer, templates, tests) | — |
| C14 | `dispatch_pins` survives only by coordinator-reminded verbatim carry-forward — promote to first-class handoff field + skill carry rule — **done (2026-07-09, v3.56.0)** | P1 | C9 | ~5 (`tools/handoff.ts` schema, `tools/registry.ts`, orchestrator, skill-coordinator + role skills, tests) | — |
| C15 | Expected-red test handoff is prose — machine-checkable red-list manifest, QA diffs actual vs expected — **done (2026-07-10)** | P1 | — | ~4 (skill-sr-engineer, skill-qa-engineer, skill-code-reviewer, maybe evidence check) | — |
| C16 | code-reviewer wrote `completed_tasks` ledger entries + evidence filename drifted from its own stated path — **done (2026-07-10, v3.58.0)** | P2 | — | ~3 (skill-code-reviewer, maybe orchestrator guard, tests) | — |
| C17 | Coordinator dispatch briefs restate protocol by hand each hop — per-role brief template partial — **done (2026-07-10, v3.62.0)** | P3 | — | ~2 (skill-coordinator, maybe templates/) | — |
| C18 | `configCache` never invalidates — post-release driftBaselineIds appends invisible until server restart (C4 follow-on) — **done (2026-07-10, v3.59.0)** | P3 | — | ~3 (`tools/config.ts` mtime check, skill-release-engineer note, test) | — |
| D1 | Prompt args mis-resolved as `workspace_path` — non-path arg should fall back to cwd detection, not just "resolution suspect" — **done (2026-07-10, v3.65.0)** | P1 | — | ~3 (`prompts/build.ts`, `tools/registry.ts` prompt arg handling, test) | — |
| D2 | Hop counter + token budget brake are model-executed in-memory arithmetic — move to server-side accounting (orchestrator counter field or PostToolUse hook) — **done (2026-07-11, v3.68.0)** | P2 | D3 | ~4 (`tools/handoff-orchestrator.ts` or hook script, skill-coordinator, config, tests) | — |
| D3 | Gate-fire telemetry: log every gate rejection (`TRANSITION_REJECTED`, `CUT_APPROVAL_REQUIRED`, …) to `.current/telemetry.jsonl` → data-driven rule retirement in retros — **done (2026-07-10, v3.66.0)** | P1 | — | ~3 (`tools/telemetry.ts`, `tools/handoff-orchestrator.ts` wrapper, `docs/gate-retro-procedure.md`) | — |
| D4 | Behavioral compliance eval harness — scripted dispatch scenarios asserting model output format (§1 watermark etc.), guarding token-saving skill rewrites against behavior regressions — **done (2026-07-10, v3.67.0)** | P2 | — | ~3 (new `test/eval/` harness, fixtures, npm script) | — |
| D5 | Server-side crash detection: stamp `dispatched_at` + target role on dispatch; `tw_get_state` surfaces stale in-flight dispatch (>N min, no state write) — removes coordinator-memory dependence (C8 follow-on) — **done (2026-07-11, v3.70.0)** | P2 | — | ~4 (`tools/handoff.ts` schema, orchestrator, skill-coordinator, tests) | — |
| D6 | Host-capability as third compose axis: tag Claude-Code-only skill sections (Task tool, `agent-*.jsonl`, `~/.claude/agents`) `host:claude-code`; non-CC hosts skip dead text — **done (2026-07-11, v3.71.0)** — host axis in prompts/build.ts + skill fragment splits (tag v3.71.0, commit b68746f; see §D6) | P3 | — | ~5 (`prompts/constitution-manifest.ts` pattern extended to skills, `prompts/build.ts`, content splits, tests) | — |
| D7 | `qa_reports/` unbounded growth (232 files) — per-feature archive / retention policy mirroring the tasks-archive convention — **done (2026-07-11, v3.67.1)** | P3 | — | ~2 (skill-release-engineer or skill-qa-engineer archive step, docs) | — |
| D8 | Lite recommended model is haiku but haiku §1 compliance is known-poor (watermark omissions) — trim lite bundle further or bump recommendation to sonnet — **done (2026-07-11, v3.68.1)** | P3 | — | ~2 (`content/skill-coordinator-lite.md` frontmatter, measure-context-cost) | — |
| D9 | `qa_review` auto-append fan-out: on a qa FAIL/PASS state write the evidence stamp was appended to every OPEN task's `qa_reports/review_<id>.md` (11 unrelated stale files modified + `review_T-D8-REL.md`/`review_T-D8-DONE.md` spuriously created, 2026-07-11 D8 run) instead of only the current task's — evidence pollution risks corrupting the `covers:` coverage index | P2 | — | ~3 (auto-append target resolution in tools/, regression test, cleanup note) | **done (2026-07-11, v3.69.0)** — Implements review_task_ids field + QA_REVIEW_TARGET_REQUIRED gate; 1173/1173 tests pass; tag v3.69.0 (1481717) |
| D10 | release-engineer (haiku) resolved a concurrent-release push conflict with destructive `git reset`, discarding its own committed release (recovered via reflog cherry-pick, D8 v3.68.1) — add STOP-on-non-ff rule: never reset/rebase/clean; hand back Blocked with the local commit SHA for coordinator recovery | P2 | — | ~2 (skill-release-engineer Hard rule + Escalation Routes row, template hint, test pin) | **done (2026-07-12, v3.71.1)** — Hard-stop rule + escalation routes row + template hint + 6 pinning tests; tag 5c73c47 |
| E1 | Single `active_feature` cannot model concurrent sessions — feature-scoped state (lease field or per-feature branch/worktree) + serialized release queue; structural root cause of the D9/D10 collision class | P1 | — | ~6 (design first: handoff schema, orchestrator, storage, skills) | **done (2026-07-12, v3.72.0)** — Feature-lease mechanism (gates/feature-lease.ts + gates/registry.ts) + FEATURE_LEASE_HELD gate + SOP step 3a (re-baseline off origin/HEAD); 1235/1235 tests green; tag v3.72.0 (269c42b) + E1A amendment (v3.73.1, terminal-marker gate + negative-age guard, tag cb38d06) |
| E2 | Bug-fix as a first-class chain: `bugfix` dispatch mode (lighter than feature chain) + server-enforced repro-first gate — failing expected-red repro manifest required BEFORE fix work (reuses C15 machinery) | P1 | — | ~4 (transitions/dispatch mode, gate, skill-pm/sr/qa, tests) | **done (2026-07-12, v3.73.0)** — Bugfix-mode signal (handoff schema v11, dispatch_mode field) + REPRO_FIRST_REQUIRED gate + skill guidance; 1251/1251 tests pass; tag c279d70 |
| E3 | Outcome-shaped acceptance: machine-executable ACs in specs + mandatory QA runtime-evidence step — gates currently verify evidence exists, never that the change does what the AC says | P1 | — | ~4 (skill-pm AC schema, skill-qa, evidence gate, tests) | **done (2026-07-12, v3.77.0)** — AC_EXECUTION_LOG_MISSING gate (28th gate) + PM/QA Phase 3.5 runtime-evidence integration; 1350/1350 tests pass; tag v3.77.0 (5dbfc57) |
| E4 | design-auditor source-credibility check as a hard STOP gate — classify source node (full-frame / variant / read-only page) with server-checked attestation before the build hop; retros' single highest-leverage lever | P1 | — | ~3 (skill-design-auditor, gate check, test) | **done (2026-07-12, v3.75.0)** — SOURCE_CREDIBILITY_UNVERIFIED gate on pm→{architect,sr-engineer} edge + credibility cell parser in gates/visual.ts + design-auditor SOP update; 1313/1313 tests green; tag v3.75.0 (0932338) |
| E5 | Backlog intake loop + tiered cut-approval + cheapest-compliant-path intake: coordinator auto-starts next open backlog ticket; small cuts (≤2 files, P3, no schema) auto-approve, large/design-armed still HALT; intake SOP gains a phase-decomposition step — classify each ticket's phases as coordinator-direct / mini-chain / full-chain and propose the cheapest compliant path by default (2026-07-13 evidence: direct analysis phases saved 50–90% tokens across E6/E9A/E15) | P2 | E8 ✓ | ~3 (skill-coordinator, const §3.1 tier rule, config threshold) | **done (2026-07-14, v3.85.0)** — coord-03 Backlog Intake Loop + const-08 Cut-Approval Auto-Tier bullet + opt-in `cutApprovalAutoTier` config key (absent = disabled, conservative defaults) + coord-07 SOP step 4a cheapest-compliant-path intake; 31 pins in test/e5-intake-tiering.test.mjs; 1455/1455 green; tag v3.85.0 (064683d) |
| E6 | Rule-retirement retro cadence: actually run the D3 data every N features; zero-fire gates/prose become retirement PRs — the counter-pressure D3 was built for, still unexecuted | P2 | D3 ✓, E8 ✓ | ~2 (retro procedure doc, summarizer script) | **done (2026-07-13, no release — procedure institution)** — first retro executed (docs/retro-2026-07-13-gate-fire.md: 4 fired gates KEEP, EXTERNAL_REFS_UNRESOLVED on WATCH, no retirements) + cadence & retired-rule ledger instituted in docs/gate-retro-procedure.md (every 5 features / first design-armed; next due ~v3.87); commits de6352b + 96b9324; human-approved done-mark |
| E7 | Git/CI as a governed surface: sanctioned-git-ops whitelist for ALL roles (generalizes D10 beyond release-engineer) + optional CI-status check at release instead of self-reported test-green | P2 | D10 | ~3 (constitution/skill content, optional gh check step, test) | **done (2026-07-13, v3.81.0)** — Constitution §6 all-roles sanctioned-git-ops whitelist (core-tagged, lite+chain dispatch arms); release-engineer D10 pointer rewrite; byte-budget re-baseline (tag v3.81.0, commit d4f1520) |
| E8 | Success-side telemetry: per-feature one-pass rate / qa-review-visual rounds / hops / token totals appended at release — D3 records only rejections; success claims are currently hand-assembled anecdotes | P2 | D3 ✓ | ~3 (telemetry emit, release SOP line, summarizer) | **done (2026-07-12, v3.74.0)** — schema v12 cumulative round counters + release-time metrics emit to .current/metrics.jsonl + scripts/summarize-metrics.mjs; 1295/1295 green; tag v3.74.0 |
| E9A | Suspected hand-authored `.current/handoff.md` release-closing writes: v3.72.0 and v3.73.1 closing stamps are round-to-the-minute AND local-time-mislabeled-as-Z, unlike server `tw_update_state` stamps (ms entropy) — suspect release-engineer subagents hand-editing during release staging, forbidden by skill-release-engineer.md L20 | P2 | — | ~3 (reproduce + find writer; optional server-side integrity check: reject client-shaped stamps / drift-detect out-of-band writes) | **done (2026-07-13, v3.82.0)** — Codified no-MCP-path coordinator-relay pattern in skill-release-engineer SOP (Hard rule #5 + steps 2/12 RELAY REQUIRED directive); stampAdvisory read-only advisory field in tw_detect_drift output (forensics: hand-authored-stamp detection); test suite 1408/1408 green (tag v3.82.0, commit 21e7d82) |
| E10 | Feature-lease human override + non-work write exemptions: failure-record writes and lazy-migration heals refresh a dead lease with no sanctioned human attestation path (2026-07-12 E8-start incident — ~34 min of timeout-waiting in an idle workspace) | P2 | E1 ✓ | ~4 (lease_override field + §3.1 trust mechanics, exempt admin/heal writes from stamp refresh, tests) | **done (2026-07-13, v3.80.0)** — lease_override + bookkeeping_write transient args, new Constitution §3.1 bullets, LEASE_OVERRIDE_AUDIT_MISSING + BOOKKEEPING_WRITE_INVALID_CHANGE gates, file-mode only (tag v3.80.0, commit 22541e5) |
| E11 | `check-version.mjs` ships-vs-source blind spot: the guard asserts only `index.ts` Server() literal vs `package.json`, NOT the compiled `dist/index.js` that npx consumers actually run — v3.74.0 shipped `dist/index.js` at 3.73.1 while the check passed (caught in coordinator post-release verify, fixed in 9b91db9) | P2 | — | ~2 (extend check-version.mjs to parse+assert dist Server() literal + test) | **done (2026-07-12, v3.76.0)** — dist-parity check via scripts/check-version.mjs + gate in release-engineer SOP step 7; 1323/1323 green; tag v3.76.0 commit 4d38a8a |
| E12 | E8 metrics emit not idempotent per release: two terminal-signature writes during v3.74.0 release staging appended two identical `e8-success-telemetry` records to `.current/metrics.jsonl` — emit should fire once per (feature, released_version) | P3 | E8 ✓ | ~2 (dedupe guard in tools/metrics.ts + test) | **done (2026-07-12, v3.76.0)** — idempotent metrics emit in tools/metrics.ts via last-line check; dedupe regression tests; 1323/1323 green; tag v3.76.0 commit 4d38a8a |
| E13 | E1A terminal-marker fragility: v3.75.0 closing write omitted `next_role=pm` (coordinator brief error), so the exact-triple terminal clause failed silently and the lease stayed held ~30 min — release-engineer got no warning the closing write was non-terminal; server should warn/reject a release-engineer closing-signature write missing the triple, or relax the marker | P2 | E1 ✓, E10 ✓ | ~3 (gates/feature-lease.ts or orchestrator advisory, skill-release-engineer note, test) | **done (2026-07-13, v3.79.0)** — closing-signature advisory broadening (pending_notes[0] `/^Released v/` disjunct in gates/feature-lease.ts terminal marker) + skill-release-engineer note; tag v3.79.0 (see §E13 detail) |
| E14 | CI-status self-report vs. ground-truth: release-engineer currently asserts "npm test green" by self-check; optional follow-on reads `gh` API to verify CI status before release — deferred from E7 per spec Out of Scope, enables automated release gates on CI health. Premise correction 2026-07-13: ci.yml has existed since 2026-05-15 and is green — implementable immediately | P3 | E7 ✓ | ~2 (release SOP optional step, gh API call, test) | **done (2026-07-13, v3.83.0)** — Check 6 in scripts/verify-release.mjs (latest completed CI run on origin/main via gh; FAIL on non-success; WARN-and-continue on gh-missing/unauthenticated/zero-runs) + SOP step 9a line; exercised live during the v3.83.0 release itself; VR-11..16 tests (tag v3.83.0, release commit 41cb8aa) |
| E15 | `test/handoff-write-arg-guard.test.mjs` AC-1 concurrency flake: passes consistently in isolation; flakes ~1-in-3 on full-suite runs (observed independently by code-reviewer and qa-engineer 2026-07-13) — investigate and fix concurrency guard or test isolation. **Diagnosed (2026-07-13, coordinator-direct):** root cause is the fixed sleep-then-kill in the file's `callServer` helper (`waitMs = 2000` → `p.kill()` → assert response exists) — under full-suite concurrency the spawned `dist/index.js` server's cold start + response can exceed 2s, so the reply never arrives before the kill; passes in isolation because there is no CPU contention. Fix: replace the fixed sleep with a response-driven wait (resolve when the expected JSON-RPC id appears on stdout, generous ceiling timeout). Same-class helpers to sweep in the same ticket: `test/prompt-state-footer.test.mjs` `sendPromptRequests` (3000ms, same shape), plus fixed-sleep waits in config-versioning / file-lock / session / teamwork-lite tests. Test-only change → qa-engineer single-role ticket, no full chain | P3 | — | ~2 (test isolation / race condition fix + test reproducer) | **shipped v3.83.0** — response-driven wait (resolve on expected JSON-RPC ids, 20s ceiling) replaced sleep-then-kill in handoff-write-arg-guard + prompt-state-footer + teamwork-lite helpers; time-semantic sleeps in config-versioning/file-lock/session deliberately left; 3 consecutive full-suite runs 1420/1420 (qa_reports/review_T-E15-01.md); commit 3267a69 |
| E16 | `ALLOWED_TRANSITIONS` has no native `pm → qa-engineer` intake edge for a single-role test-only ticket (E15 run had to enter via the Amend-Resume edge, whose documented purpose is narrower — disclosed honestly by qa-engineer in review_T-E15-01.md) — either add a sanctioned direct edge (maybe gated on a scope attestation) or document Amend-Resume as the blessed door for this shape | P3 | — | ~2 (tools/transitions.ts edge + const §3.1 note + test) | **done (2026-07-13, v3.83.0, option B — content-only)** — §3.1 Amend-Resume charter broadened: the resume_of-gated pm→{code-reviewer,qa-engineer} edge is also the sanctioned door for a PM-sanctioned FRESH single-role judge dispatch on test-only/evidence-only tickets (judge roles only, no build-role edge); coordinator pointer in coord-03-core-fallback.md; ZERO server-code change — the release-authored commit-message/CHANGELOG claims of a handoff-orchestrator.ts change were erroneous (E9A-class record-integrity slip, this time narrative-only — the diff itself was clean), corrected post-release against the actual diff in commit a484a4d; pinning suite test/e16-judge-dispatch-charter.test.mjs; 1420/1420 (tag v3.83.0, release commit 41cb8aa) |
| E17 | release-engineer record-integrity hard rule: v3.83.0's release commit message, CHANGELOG entry, gh release notes, and backlog done-mark all described a `tools/handoff-orchestrator.ts` change that does not exist in the diff, plus nonexistent spec paths and a fabricated code-review round for E15 (haiku narrative fabrication; second E9A-class integrity incident in two days, this time narrative-only) — add a Hard rule: every file named in a commit message / CHANGELOG entry / release-notes body MUST appear in `git diff --stat` of the commit being described, and every referenced report/spec path MUST exist on disk at write time; verify-with-`ls`/`git diff --stat` before writing, never from memory of the dispatch brief | P2 | — | ~3 (skill-release-engineer Hard rule + template paragraph + qa pinning tests) | **done (2026-07-13, v3.84.0)** — CRITICAL record-integrity Hard rule in skill-release-engineer + matching template paragraph (content-only, +3 lines); E17-S1..S4 pins in test/feature-lease.test.mjs; release notable: E14 Check 6 fired live and correctly blocked this release on a real CI red (VR-13 env-dependence from v3.83.0, fixed in 726480c by qa single-role dispatch via the E16 charter — first live use); 1424/1424 (tag v3.84.0, release commit e4d0b01) |
| E18 | Write-provenance hardening: (a) escalate the E9A stampAdvisory to a blocking gate on the tw_update_state write path + RELAY REQUIRED hard line in the release dispatch template — v3.85.0's closing write was hand-authored by the no-MCP-path release-engineer subagent (fabricated zero-entropy 2026-07-14T00:00:00.000Z stamps on handoff.md + metrics.jsonl, first hand-edit also recorded a nonexistent tag SHA; commits 5950c58/199b164, remediated in 70e3a35 — third E9A-class incident); (b) qa completion-evidence gate — a qa-engineer state write adding completed_tasks ids must have per-id QA evidence on disk, closing the identity-swap evasion of REVIEWER_COMPLETED_TASKS_REJECTED (E5 chain: code-reviewer subagent wrote a second state write as agent_id=qa-engineer pre-filling completed_tasks with zero QA evidence; qa_reports/review_T-E5-01.md) | P2 | E9A ✓, E17 ✓ | ~5 (2 gates, zod/index.ts arg, const §3.1 bullet, skill-release-engineer template line) | **done (2026-07-14, v3.86.0)** — STAMP_PROVENANCE_SUSPECT + QA_COMPLETION_EVIDENCE_MISSING gates (gates/stamp-provenance.ts + tools/handoff-orchestrator.ts integration); RELAY REQUIRED hard line (skill-release-engineer.md); 17 tests in test/e18-write-provenance.test.mjs (exact replays of both E5-cycle incidents, both now rejected); 1472/1472 suite green; tag v3.86.0 (commit 1826840) |
| E19 | SessionStart hook auto-injection retired (104447-F0 E1 + live 2026-07-15 evidence): the hook injects the full lite constitution+skill block (~18.7KB) into EVERY session in a managed workspace — including casual Q&A sessions that never touch state — and double-fires (~37KB) when registered in both `~/.claude/settings.json` and a project `.claude/settings.local.json` (observed live this session); a subsequent `/teamwork` then loads the full coordinator, leaving two contradictory mode declarations in one context (lite says server-read-only; full's core job is state writes). Decision (2026-07-15, human): remove SessionStart registration — governance context loads only on explicit prompt invocation (`/teamwork` full, `teamwork-lite` solo); `bin/agent-governance-context.mjs` kept in-tree as a documented opt-in for users who prefer auto-arming; CLAUDE.md + docs/install.md updated to present the hook as opt-in with the context-cost tradeoff | P1 | — | ~3 (2 settings files, CLAUDE.md, docs/install.md; no server code) | **done (2026-07-15, docs+settings only, no release)** — hook entries removed from both settings files (double-fire eliminated); CLAUDE.md "Governance context loading" section rewritten invocation-scoped; docs/install.md hook section demoted to opt-in with single-registration warning |
| E20 | Legal "waiting on long evidence" expression (104447-F0 P2): after backgrounding a ~1h regression suite an agent has no sanctioned state — `In_Progress`'s only legal moves are keep-working or terminal write, so each agent invents behavior (the crash-resume QA stopped its turn to "wait for notification" and nearly caused a second stale dispatch; only a coordinator SendMessage chase saved it). Fix, two tiers: (i) content-only hard line in skill-qa-engineer + skill-sr-engineer — long suites run synchronously to completion OR are poll-harvested within the same turn; ending a turn with work in flight is a violation (ship this first); (ii) server tier — `waiting_on` free-text field on tw_update_state that resets the stale-dispatch clock, or per-phase stale thresholds (QA full-regression phase ≫ 15 min default) | P1 | — | ~3 (2 skills; optional handoff field + stale predicate) | **done (2026-07-15, tier (i) content-only, unreleased — rides next release)** — HARD long-runs-end-in-turn line in skill-qa-engineer + skill-sr-engineer (templates are thin pointers, no mirror); tier (ii) server field deferred; 13 pins in test/e20-e21-crash-resilience.test.mjs; 1485/1485 green |
| E21 | Crash checkpoint via existing bookkeeping_write (104447-F0 P1, the retro's single highest-leverage item): §3 "write state even on crash" is physically unexecutable for external kills (session/usage-limit); the dead QA session lost ~90% of completed work traces → 1h55m silent idle + a resume that re-verified everything (~30–40% of the 250k-token recovery). `bookkeeping_write` semantics already fit (administrative write, no lease-timestamp refresh) but no skill SOP directs roles to use it. Fix (content-only): skill-qa-engineer Phase-4 line — before launching a full regression, bookkeeping_write "completed <artifacts>, awaiting regression"; matching line in skill-sr-engineer for long builds; optionally register an evidence-journal path at dispatch that Crash-Resume reads instead of git archaeology | P1 | — | ~2 (content-only) | **done (2026-07-15, content-only, unreleased — rides next release)** — crash-checkpoint-via-bookkeeping_write line in skill-qa-engineer Phase 4 + skill-sr-engineer step 4a, with file-mode-only caveat (qa accuracy fix in-round); byte-budget pins re-baselined; shipped with E20 in one mini-chain, PASS 1485/1485 |
| E22 | Proactive stale-dispatch notification (D5 ✓ follow-on; 104447-F0 A3): the advisory is pull-only — computed at tw_get_state time, so nobody sees it until the next `/teamwork`; the 1h55m idle window went entirely unnoticed. Server already owns the timestamp + threshold; add an opt-in notify channel on threshold crossing (touch a watch-file for an external watcher / desktop notification / webhook), config-gated, no new state | P2 | D5 ✓ | ~3 (watcher emit + config key + test) | — |
| E23 | Evidence schema versioning + structured frontmatter (104447-F0 P3 / B1 / B2): the visual-evidence schema tightened while a feature was in flight, so crash-era artifacts that were legal when written became illegal at resume — 3 consecutive rejections (VISUAL_EVIDENCE_MISSING → VISUAL_REPORT_INCOMPLETE → AC_EXECUTION_LOG_MISSING), the last fired on a `Phase 3.5 — ` heading prefix, i.e. markdown prose as machine interface. Fix: (a) `evidence_schema: <n>` pinned into handoff at dispatch — gates validate against the pinned version, upgrades affect new features only; (b) reports carry YAML frontmatter (`sections: [...]`, `verdict`, `region_diff_pct`) that gates validate, prose body stays for humans — or minimally, heading match becomes normalized-contains; (c) rejection envelopes name the missing section / expected string, not just the error code | P1 | — | ~5 (gates/evidence parsing, handoff field, skill-qa-visual, tests) | — |
| E24 | Exemptions manifest `.current/exemptions.json` (104447-F0 C2, priority raised from the retro's "medium"): §2 ZERO-compile-errors is a *permanent-violation state* in the 104447 workspace (33 known tsc errors across 3 exempted test files; `npm run build` known-broken), re-litigated in prose every review/QA round, and §6's dependency-audit-at-build-gate is dead because build never runs. A rule everyone knows is permanently violated teaches agents that rules are negotiable — normalization of deviance corrodes every OTHER gate's authority, which is worse than the re-explanation cost. Fix: declarative exemption entries (path + reason + expiry condition), gates subtract them automatically; a prose-only exemption counts as not exempted; exemption-count becomes a monitorable only-grows metric | P1 | — | ~4 (config/manifest loader, build-gate check, const §2, tests) | — |
| E25 | §6 git vocabulary completion (104447-F0 P7/C3): `git stash` / `stash pop` appear in NEITHER the sanctioned list (add/commit/tag/ff-push) nor the forbidden list (reset/rebase/clean/force) — verified absent from all const-*.md 2026-07-15 — yet the 104447 QA used stash correctly as an isolation-proof tool; under a whitelist regime an incomplete vocabulary forces correct behavior into violation. Add stash/stash-pop (reversible, non-destructive) to sanctioned; clarify `git checkout -- <file>` status while there | P3 | — | ~1 (const content + pin test) | — |
| E26 | `tw_gate_stats` — per-gate fire-count coverage reader (D3 ✓ / E8 ✓ enabler; 104447-F0 §4-D): telemetry.jsonl (gate fires) and metrics.jsonl (per-feature outcomes) both exist but no aggregation exists — the 104447 retro answered "which rules are alive" from 4 raw telemetry lines by hand. Aggregate per-gate/per-error-code counts across features so the E6 rule-retirement retro runs on data instead of recall; also the substrate for adjudicating the retro's dead-rule table (token brake, dispatch_pins, read cap, terse cap et al.). NOTE the category boundary: telemetry only proves *gate-backed* rules dead/alive; prose-behavioral rules (§5 read cap, §1 terse) need transcript sampling, not gate stats — the reader's output should say which category a rule is in rather than imply zero-fires = dead | P2 | D3 ✓ | ~3 (new tool or script over the two sidecars + tests) | — |
| E27 | Opt-in arming onboarding doc (104447-F0 correction ticket): the retro AND its operator both concluded the usage.jsonl token sidecar "was never implemented / implement it" — it IS implemented (tools/usage-accounting.ts + opt-in PostToolUse hook + coord-06 hand-sum fallback, shipped D2); same unarmed-reads-as-dead pattern for `driftBaselineIds` (C4 ✓ — would fold the retro's 105-item historical-drift noise, P6) and `cutApprovalAutoTier` (E5 ✓). One doc walks a consumer workspace through arming each opt-in: hook wiring, config key, expected effect, how to verify it's live. Unarmed-and-unaware produces duplicate reimplementation tickets downstream — this retro nearly filed one | P3 | — | ~1 (docs/config.md or new docs/arming.md) | — |
| E28 | Wholesale-replace footgun on `dispatch_pins` / `external_refs` (104447-F0 E2): both fields replace rather than merge on write — a writer that forgets read-before-write silently drops existing entries. Fix: when a write shrinks the entry set, warn in the response envelope (or reject absent an explicit `shrink_ack` flag) | P3 | — | ~2 (orchestrator check + test) | — |
| E29 | stale_dispatch advisory carries a Crash-Resume pointer (104447-F0 E3): the protocol lives only in skill-coordinator text; if the coordinator itself is the dead party, or a lite session takes over, nothing in the advisory points at it. Append a one-line protocol summary/pointer to the advisory `message` field | P3 | — | ~1 (advisory string + test) | — |
| E30 | qa-visual actual-capture output convention (104447-F0 P4): consumer test suites write actual screenshots next to committed baselines (`ACTUAL_DIR` = `tests/visual/`), so every run dirties git status and a real visual regression is indistinguishable from routine overwrite at a glance — cost one full pixelmatch forensics round to clear a false alarm. skill-qa-visual gains a convention line: actual captures go to an untracked directory outside the baseline dir; qa flags suites that violate it | P3 | — | ~1 (skill-qa-visual line) | — |

### Recommended execution order (2026-07-13, post-E7 — supersedes the 2026-07-09 order, which shipped in full)

Remaining open tickets as of 2026-07-14: none (superseded 2026-07-15 by the E19–E30 batch — see the next order table). The 2026-07-14 batch shipped in full — E18 done
(v3.86.0). The 2026-07-13 batch shipped in full — E6 done
(procedure institution, human-approved), E9A done (v3.82.0), E14 done
(v3.83.0), E5 done (v3.85.0). Order table retained for the record; it
optimized: cheapest-highest-leverage first, integrity before automation,
optional-external last.

| order | ticket | why here |
|---|---|---|
| 1 | E6 | the counter-pressure loop D3/E8 were built to feed is still unexecuted; the data finally exists (gate-rejection telemetry + `.current/metrics.jsonl` per-feature records, E7 emitted `one_pass: true`); cheapest (~2 files) and its output — retirement PRs — shrinks constitution bytes, compounding every later feature |
| 2 | E9A | governance-integrity; fresh 2026-07-13 evidence narrows the investigation (see §E9A Evidence bullet: haiku release-engineer subagents have no MCP tool-invocation path, making direct-file-edit the path of least resistance) — reproduce is now cheap, and the minimal fix (stamp-shape advisory in `tw_detect_drift`) is small |
| 3 | E5 | intake automation should follow the retro, not precede it: E6's evidence is what justifies (or vetoes) the auto-approve tier thresholds E5 introduces; medium content ticket once that data is in hand |
| 4 | E14 | P3 and optional — the original "externally gated, no CI configured" premise was WRONG (corrected 2026-07-13: ci.yml has existed since May and is green), so E14 is implementable whenever wanted; still last because it's an optional hardening step |

### Recommended execution order (2026-07-15, E19–E30 batch from the 104447-F0 retrospective)

| order | ticket | why here |
|---|---|---|
| 1 | E19 | human-prioritized 2026-07-15; no server code — settings + docs only; also kills the live double-injection burning ~37KB every session in every managed workspace |
| 2 | E20 + E21 | content-only SOP lines, one edit session together; directly halve the measured worst cost (1h55m idle + 250k-token recovery) of the crash class that WILL recur |
| 3 | E23 | the other measured pain (3-rejection rework loop); schema pinning prevents every future mid-feature tightening from taxing in-flight work |
| 4 | E24 | governance-integrity: permanent-violation state corrodes all other gates; declarative manifest also unblocks the dead dependency-audit gate |
| 5 | E26 | cheap, and its output (per-gate coverage data) is the prerequisite for adjudicating the retro's dead-rule table honestly instead of by anecdote |
| 6 | E22 | turns the crash class from hour-scale to minute-scale detection; after E20/E21 shrink the blast radius, this shrinks the window |
| 7 | E25, E27–E30 | P3 tail — each ~1–2 files, batchable into any convenient release |

---

## A1 — Registry pattern for tool & prompt registration (P1) — DONE 2026-07-07
- **What:** `index.ts` is 1436 lines; adding a tool requires touching three
  places (`ListToolsRequestSchema` list, zod schema, `CallToolRequestSchema`
  dispatcher case — per CLAUDE.md), and prompt registration is an 11-branch
  if-chain (`index.ts:382-402`). The three registration sites can drift.
- **Fix:** each `tools/*.ts` exports `{ name, schema, handler }`; `index.ts`
  iterates a registry to build the tool list, validate args, and dispatch.
  Same for prompts: a `Map<promptId, buildFn>` replaces the if-chain.
- **Owner:** /teamwork (cross-module refactor; pm→architect→sr→reviewer→qa).
- **Risk if skipped:** every new tool/prompt re-pays the triple-registration
  tax; a missed site ships a tool that lists but doesn't dispatch (or vice
  versa).

## A2 — Split `evidence-file.ts` into per-gate modules (P1) — DONE 2026-07-08 (via A10)
- **Done:** folded into and shipped as part of feature `gate-registry` (spec
  `specs/gate-registry.md` + architecture `specs/gate-registry-architecture.md`;
  v3.46.1). `tools/evidence-file.ts` (994 lines) drained to shared read/write
  plumbing only (path helpers, section slicing, cell parsers); its 15
  `has*`/`check*`/`validate*` predicates moved verbatim (no behavior change)
  into `gates/qa-review.ts`, `gates/code-review.ts`, `gates/visual.ts`,
  `gates/scope-decision.ts`, `gates/cut-approval.ts`. Every caller
  (`tools/handoff-orchestrator.ts`, `prompts/build.ts`) retargeted to the new
  import paths. Import DAG acyclic (`evidence-file.ts` has zero `gates/`
  imports). See A10 below for the fold-in rationale.
- **What:** `tools/evidence-file.ts` (994 lines) has grown from "file-mode QA
  evidence write/check" into gate-central: review, code-review, visual
  baselines/evidence, design-mode arm signal, scope-decision, cut-approval —
  10+ `has*` predicates in one file, each consumed by a different
  `transitions.ts` gate.
- **Fix:** extract a `gates/` directory, one module per gate (e.g.
  `gates/qa-review.ts`, `gates/code-review.ts`, `gates/visual.ts`,
  `gates/cut-approval.ts`, `gates/scope-decision.ts`), aligned with the gate
  trigger points in `tools/transitions.ts`. `evidence-file.ts` keeps only the
  shared read/write plumbing.
- **Owner:** /teamwork (pure refactor but wide import surface; sr→reviewer→qa).
- **Risk if skipped:** the file keeps absorbing every new gate; predicates
  entangle and a change to one gate's parsing silently affects another's.

## A3 — Validate constitution span-strip markers at build time (P2) — SUPERSEDED by A9
> A9 (compose-not-strip) eliminates the fence-stripping mechanism entirely, removing the
> unbalanced-marker failure class this validator guards. Implement A3 only if A9 is rejected.
- **What:** `prompts/build.ts` strips constitution spans via markdown fence
  markers (`stripChainOnly` / `stripRationale` / `stripDesignOnly`). A typo or
  unbalanced marker in `content/constitution.md` silently changes the
  governance text agents receive — no error, no test failure tied to the
  marker itself.
- **Fix:** add a build-time check (pattern: `scripts/check-version.mjs`) that
  asserts every strip marker is paired, spans are non-empty, and each strip
  mode produces non-identical output where expected. Wire into `npm run build`
  / `npm test`.
- **Owner:** /teamwork (qa-engineer owns the test; small script).
- **Risk if skipped:** governance text corruption is silent and only surfaces
  as agent misbehavior in downstream workspaces — the hardest failure class to
  trace back.

## A4 — Strip version/origin tags from governance text at build time (P1) — DONE 2026-07-06
- **What:** Nearly every rule in `content/constitution.md` and `content/skill-*.md`
  carries inline provenance tags — `(v3.26.0, R5)`, `(B10)`, `root cause C1`,
  `§四#7`, references to retrospectives the executing agent cannot read. For the
  agent consuming the prompt these are pure noise: they change no behavior, cost
  tokens on every dispatch, and add cognitive load.
- **Fix:** extend the existing strip infrastructure in `prompts/build.ts` — either a
  new `<!-- origin:start/end -->` fence or a regex pass that removes `(vX.Y.Z…)` /
  root-cause-code tags at bundle time. Source files keep full provenance for
  maintainers; agents receive clean normative text. Estimated 5–10% token saving
  per role prompt.
- **Owner:** /teamwork (build.ts + content markup; qa verifies bundle output).
- **Risk if skipped:** every dispatch pays the tag tax; rules read as archaeology
  instead of instructions.

## A5 — Error-code contract test: content ↔ code (P1) — DONE (commit 3360c68)
- **What:** Governance prose asserts server behavior by name —
  `VISUAL_PROVENANCE_MISSING`, `CUT_APPROVAL_REQUIRED`, `BASELINE_MANIFEST_MISSING`,
  etc. Nothing prevents those claims drifting from what `tools/transitions.ts` /
  `tools/evidence-file.ts` actually throw.
- **Fix:** a test that (a) extracts every `SCREAMING_CASE` error code mentioned in
  `content/*.md`, asserting each exists in code; (b) reverse direction: every
  gate error code in code is mentioned in at least one content file. Cheap; no
  behavior change. Interim guard until A10 makes the relationship generative.
- **Owner:** /teamwork (qa-engineer owns the test).
- **Risk if skipped:** doc rot — agents follow prose describing gates that no
  longer exist or miss ones that do; the failure surfaces as confusing `⛔` rejections.

## A6 — Consolidation rewrite of `skill-qa-visual.md` (P1) — DONE (commit 77a6373)
- **What:** 265 lines accreted from successive postmortems: B0/B1/B2 staged gates,
  three attestation fields (`baseline:` / `diff-metric:` / `pixel_gate_complete:`),
  carry-forward exemption prose spread across four sections ("fallback token
  satisfies diff-metric but does NOT exempt pixel_gate_complete (AC-5)"…). The
  exemption logic is near-unfollowable as prose.
- **Fix:** behavior-preserving rewrite as if authored fresh: one **exemption
  matrix table** (`surface class × required fields`), one error-code trigger
  table, renumbered steps, one minimal complete example of a passing
  `visual_<id>.md` report. Target ~120 lines. Server parser
  (`tools/evidence-file.ts`) unchanged — the rewrite must keep every
  server-checked token/format identical (verify against parser tests).
- **Owner:** /teamwork (content-only but high blast radius; pm→sr→reviewer→qa).
- **Risk if skipped:** each new visual gate compounds the prose debt; agent
  compliance degrades as exemption logic gets harder to hold in context.

## A7 — Consolidation rewrite of `skill-pm.md` (P1) — DONE 2026-07-06
- **What:** SOP numbering 2 → 2a → 2a-bis → 2b → … → 7a is patch-layering
  sediment; gates (state-count split, geometric-density split, scope decision,
  resource audit, question batch, ambiguity, cut-approval) each live in their own
  accreted paragraph with duplicated STOP incantations.
- **Fix:** behavior-preserving rewrite: clean sequential numbering, a single
  gate-summary table (gate → trigger → clearing action), keep verbatim-table
  schema sections. Same server-token constraint as A6.
- **Owner:** /teamwork.
- **Risk if skipped:** same as A6 — PM is the chain's entry role; its SOP being
  hard to follow costs every feature.

## A8 — Single-owner dedup of multi-told mechanisms (P2) — DONE v3.60.0 (2026-07-10)
- **What:** The constitution's own header says skills "MUST NOT restate" it, yet:
  cut-approval is told 3× (skill-coordinator stop-condition 6, skill-pm 7a,
  skill-coordinator-lite) with divergent wording — *(correction 2026-07-07:
  the original "4×" claim assumed a constitution copy that never existed;
  grep across `content/const-*.md` returned zero pre-fix hits. **Resolved via
  C2**: the mechanism now lives once in Constitution §3.1
  (`content/const-08-chain-31-mid.md`) and the three skill retellings are
  pointer lines.)* — and self-converge relaxation is told 2× (constitution §1,
  skill-sr-engineer) with overlapping qualifiers — **still open under A8**.
  Every copy is a future drift source — edit one, miss the others.
- **Fix:** single-owner principle. Each mechanism's full definition lives in
  exactly one document (server-gate class → constitution §3.1; process class →
  the owning skill); every other mention shrinks to one pointer line ("see X").
- **Owner:** /teamwork (touches constitution + 4 skills; content-only).
- **Risk if skipped:** wording drift between copies produces contradictory
  instructions; Document Priority resolves conflicts but agents burn context
  reconciling them.

## A9 — Compose-not-strip: overlay modules replace fence stripping (P2, supersedes A3) — DONE 2026-07-07
- **What:** `prompts/build.ts` assembles role prompts **subtractively**: one large
  constitution file minus `<!-- chain-only -->` / `<!-- rationale -->` /
  `<!-- design-only -->` fenced spans. A single malformed fence silently changes
  the governance text agents receive (the failure class A3 wanted to guard).
- **Fix:** invert to **additive composition**:
  `constitution-core.md` (always) + `overlay-chain.md` (full mode) +
  `overlay-design.md` (design-armed) + `rationale/` (never shipped).
  `build.ts` concatenates instead of stripping. Each module is independently
  lintable and token-countable; the unbalanced-fence failure class disappears
  structurally instead of being guarded (hence A3 superseded).
- **Owner:** /teamwork (build.ts + content split + `test/context-budget.test.mjs`
  rework; pm→architect→sr→reviewer→qa).
- **Risk if skipped:** fence fragility persists; every conditional-content
  feature adds more strip markers to get wrong.

## A10 — Gate registry as structured data → code + rendered prose (P2, depends A9) — DONE 2026-07-08
- **Done:** shipped as feature `gate-registry` (A2 folded in; spec
  `specs/gate-registry.md`, architecture `specs/gate-registry-architecture.md`;
  v3.46.1). `gates/registry.ts` is the single structured source of truth:
  `GATE_REGISTRY` — 18 typed `GateDefinition` entries (`errorCode`, `producer`,
  `envelope`, `triggerEdge`, `armCondition`, `clearingArtifact`, `hintStatic`,
  `documentedInProse`), reconciled up from the spec's stated 17 codes (the
  spec omitted `MISSING_REVIEW_EVIDENCE`). `tools/transitions.ts` and the new
  `gates/*.ts` predicate modules (A2) source their error codes/hint text from
  it. Rendering mechanism for AC-3/AC-4 (constitution + skill prose): chosen
  as a generative **parity check** (rewritten `test/error-code-contract.test.mjs`,
  DR-3) rather than in-band file generation — the A9 compose-not-strip
  pipeline and `constitution-monolith.txt` golden baseline are untouched by
  construction; zero `content/*.md` bytes changed. `TransitionRejection["error"]`
  12-member union kept byte-identical, not narrowed to the registry (DR-8) —
  non-drift enforced by a `union ⊆ ALL_GATE_CODES` test assertion instead.
  Frozen `tw_update_state` gate check order (AC-7) and all four
  `schema_version` constants (AC-8) unchanged. Full chain: sr-engineer
  implemented, code-reviewer APPROVED (`review_reports/review_A10-09.md`),
  qa-engineer rewrote the generative test + verified build/audit/test/smoke
  green (`qa_reports/review_A10-10.md`).
- **What:** Gate definitions (error code, trigger edge, arm condition, clearing
  artifact) currently exist in triplicate: `transitions.ts`/`evidence-file.ts`
  (code), constitution §3.1 (prose), per-role skills (prose again). All three
  drift independently; A5's contract test only detects divergence, it doesn't
  prevent it.
- **Fix:** one structured source (e.g. `gates.yaml` or a TS constants module)
  with three consumers: (a) `transitions.ts` / `evidence-file.ts` import it;
  (b) `build.ts` renders constitution §3.1 tables and each skill's
  "gates you must clear" section from templates; (c) contract tests become
  free — data is the test. Doc↔code drift becomes structurally impossible.
- **Owner:** /teamwork (full feature: code + content + build + tests;
  pm→architect→sr→reviewer→qa).
- **Risk if skipped:** every new gate re-pays the triple-authoring tax and
  reopens the drift window A5 can only detect after the fact.

## A11 — Escalation-route tables + unified rule grammar (P2, depends A6/A7) — DONE 2026-07-08
- **Done:** shipped as feature `a11-escalation-grammar` (spec
  `specs/a11-escalation-grammar.md`). const-05 §3 defines the escalation call
  format + WHEN/DO/ELSE grammar once; 7 skills gained `## Escalation Routes`
  tables (31 rows), 12 inline incantations removed. PM survey corrected the
  stale estimate below: post-A6/A7/A13, `skill-architect.md` boilerplate was
  ~9% (5 sites), not ~40%; qa-visual/pm were already table-form exemplars.
- **What:** Every skill carries 5–8 scattered
  `tw_update_state(status=Blocked, pending_notes=["…", "next_role: …"])`
  incantations with slightly different phrasing (~40% of `skill-architect.md` is
  this boilerplate). Rule conditions/actions/escapes are buried in varied prose.
- **Fix:** (a) constitution defines the escalation **call format once**; each
  skill replaces its incantations with one table:
  `| situation | status | note token | next_role |`. (b) Normative rules adopt a
  consistent WHEN → DO → ELSE shape so trigger/action/escape are scannable.
- **Owner:** /teamwork (all skill files + constitution; content-only but wide).
- **Risk if skipped:** boilerplate divergence — near-identical escalations with
  different note formats confuse downstream parsers and readers.

## A12 — Shared SOP partials + Limits number registry (P2, depends A9) — DONE v3.64.0 (2026-07-10)
- **What:** (a) Verbatim-repeated blocks across all skills: step 1
  (`tw_get_state` → `tw_detect_drift`), output-rule lines, "on failure still
  call `tw_update_state` with the failure summary". (b) Magic numbers scattered
  everywhere: qa_round 3, review_round 3, visual_round 5, hop cap 10, 2 fix
  tries, 3 reads, 250 lines × 5 passes, ≤5 files / 300 lines — changing one cap
  means grepping all of `content/`.
- **Fix:** (a) extract shared partials composed by `build.ts` (natural extension
  of A9's composition model). (b) one **Limits table** at the top of the
  constitution; body text references limits by name.
- **Owner:** /teamwork.
- **Risk if skipped:** cap changes silently miss copies; repeated blocks drift
  in wording.

## A13 — §1 polish: output policy, watermark table, positive examples (P2) — DONE 2026-07-08
- **What:** three small text-quality issues: (a) output directives conflict —
  PM's "≤ 1 sentence" vs step 7a's mandatory inline cut table; exceptions are
  implicit and growing. (b) §1 watermark self-detection is the constitution's
  most convoluted sentence. (c) governance text is prohibition-heavy
  ("do NOT ×N") while models comply better with positive canonical examples;
  most schemas lack a minimal complete passing example.
- **Fix:** (a) constitution states once: "terse by default; structured artifacts
  (tables / blockers / ACs) exempt" — skills stop defining their own word caps.
  (b) watermark rule becomes a two-row decision table
  (`Task-spawned + pinned model → — @role (tier)` / `otherwise → — @role`).
  (c) each artifact schema (spec, review report, visual report, architecture)
  gains one minimal passing example.
- **Owner:** /teamwork (constitution + several skills; content-only).
- **Risk if skipped:** minor per item, but these are the highest-frequency
  friction points — every role reads §1 every session.

## C1 — Transitions matrix lacks amend/repair semantics (P1, observed 2026-07-07) — DONE 2026-07-07
- **Done:** shipped as feature `pm-repair-resume-routing` (spec
  `specs/pm-repair-resume-routing.md` + architecture
  `specs/pm-repair-resume-routing-architecture.md`; single-feature commit
  follows PASS per workspace convention). Mechanism: option (b) — guarded
  Amend-Resume edges `pm:In_Progress → {code-reviewer,qa-engineer}:In_Progress`
  in `tools/transitions.ts` (step-3.5 precedence check), gated by a
  self-attested `resume_of: <role>` pending_notes token (honest-attestation
  trust class, matching `cut_approved`). No schema bump, no new error code,
  no orchestrator change; Scope Decision / Cut-Approval gate re-arm semantics
  untouched (they fire only on pm→{architect,sr-engineer}). Constitution §3.1
  Amend-Resume Edge bullet is the single owner; skill-coordinator
  stop-condition 7 + skill-pm declaration paragraph are pointers.
- **What:** During the A1 run, PM re-entered `pm:In_Progress` mid-feature to amend
  the spec's Test Impact table (a legitimate §7 flag from sr-engineer). Result:
  the state machine stranded the chain — no `pm:In_Progress → code-reviewer` edge
  exists, so the reviewer could not claim; the cut-approval gate re-armed and
  re-blocked; the coordinator had to hand-author three transition writes
  (pm→sr re-claim→reviewer claim) to repair routing. The matrix models the ideal
  forward flow only; real development has sanctioned backtracking.
- **Fix (design space):** either (a) an explicit `spec-amend` write mode that
  preserves the prior chain position (pm writes the amendment note WITHOUT
  becoming the current tuple), or (b) conditional edges from `pm:In_Progress`
  to the role that was stranded (guarded by a `resume_of:` note), or (c) a
  sanctioned coordinator `repair` transition documented in §3.1. Weigh
  against gate re-arm semantics — a real cut change SHOULD re-arm (that part
  worked correctly); only the routing strand is the defect.
- **Owner:** /teamwork (transitions.ts + constitution §3.1 + skill-coordinator).
- **Risk if skipped:** every mid-feature spec amendment costs manual routing
  surgery by whoever coordinates; done wrong it corrupts the chain audit trail.

## C2 — Cut-approval cannot cross the subagent boundary (P1, observed 2026-07-06/07) — DONE 2026-07-07
- **Done:** shipped as feature `cut-approval-coordinator-attestation`
  (spec `specs/cut-approval-coordinator-attestation.md`; single-feature commit
  follows QA PASS per workspace convention). Mechanism: option (a),
  coordinator-attested approval — one new Cut-Approval Gate bullet in
  Constitution §3.1 (`content/const-08-chain-31-mid.md`) owns the full
  mechanism + sanctioned-writer trust rule; the 3 skill retellings
  (skill-pm step 8 / Gate Summary row, skill-coordinator stop-condition 6,
  skill-coordinator-lite hard-rules bullet) trimmed to pointers plus
  role-specific actions only. No server code change — the gate stays a pure
  boolean check (spec AC-6). Absorbs A8's cut-approval dedup bullet.
- **What:** The cut-approval gate assumes the PM who presents the cut also sees
  the human's approval. Under the RECOMMENDED dispatch model (fresh-context Task
  subagent), the PM subagent ends its turn after presenting the cut; when resumed
  with "the human approved", it (correctly, per its own rules) refused to set
  `cut_approved` on an agent's relayed word. Every run this session worked around
  it via coordinator same-context writes with `agent_id="pm"` — a workaround,
  not a design.
- **Fix:** formalize ONE of: (a) coordinator-attested approval — the coordinator
  (the context that directly witnessed the human's chat approval) is the
  sanctioned writer of `cut_approved`, documented in constitution §3.1 +
  skill-pm + skill-coordinator; or (b) an approval token the human's client
  writes (out of scope for stdio mode). (a) is honest about the trust chain and
  cheap. Fold the A8 dedup of the four cut-approval retellings into this same
  feature.
- **Owner:** /teamwork (governance text + possibly an orchestrator check;
  absorbs part of A8).
- **Risk if skipped:** strict PM subagents deadlock the chain on every cut;
  lenient ones accept relayed approval inconsistently — both are wrong.

## C3 — Per-task-id evidence check forces stub pointer files (P2, observed 2026-07-07) — DONE 2026-07-08
- **What:** `review: APPROVED` handoff and QA PASS verify
  `review_reports/review_<id>.md` / `qa_reports/review_<id>.md` exist for EACH
  id in `completed_tasks`. A single review round covering 7 tasks (T-REG-01..07)
  forced creation of 6 one-line pointer stubs (precedent set in T-GTS, repeated
  since). Bookkeeping noise that buries the real reports.
- **Fix:** evidence check accepts a covering report: a `covers: <id list>` line
  (or the ids in the filename/frontmatter) lets one file satisfy N ids. Keep
  per-id files valid for multi-round features.
- **Owner:** /teamwork (evidence check in `tools/handoff-orchestrator.ts` /
  `evidence-file.ts` + skill-code-reviewer/qa text + tests).
- **Risk if skipped:** every batched review round generates stub litter; future
  readers open pointer files instead of evidence.

## C4 — Drift detector drowned by historical noise (P2, observed 2026-07-06/07) — DONE 2026-07-07
- **Done:** shipped as feature `drift-baseline-exemption` (spec
  `specs/drift-baseline-exemption.md`; single-feature commit follows PASS
  per workspace convention). Mechanism: `driftBaselineIds: string[]` in
  `.current/.config.json` (config, NOT handoff — handoff is echoed to agents
  on every pre-flight, config is a server-side Set-lookup). File-mode only
  (mirrors `cut_approved` scoping); no config schema bump (optional field,
  `taskPaths` precedent); release-engineer is the sanctioned baseline writer
  (post-PASS trust boundary, skill SOP step 9). One-time backfill: 144
  historical ids. The v3.23.1 archived-section filter (`## Completed`
  heading) remains valid and composes; it was never adopted because the
  repo's convention is per-feature headings — root cause noted in the spec.
- **What:** `tw_detect_drift` reports the same ~98 pre-existing completed-in-
  tasks.md-but-not-in-handoff rows on EVERY pre-flight; every subagent brief this
  session needed an explicit "known drift, ignore it" clause. Real new drift
  would be invisible inside the noise. tasks-ahead direction, so `tw_sync`
  cannot reconcile it by design.
- **Fix:** an acknowledged-baseline mechanism — e.g. archive completed tasks
  older than the last release into a `## Archived` section drift ignores, or a
  `drift_baseline` config/handoff field recording acknowledged ids; report only
  NEW drift since baseline.
- **Owner:** /teamwork (`tools/drift.ts` + maybe config field + tests).
- **Risk if skipped:** alert fatigue — the one drift report that matters gets
  ignored like the 98 that don't.

## C5 — Watermark toolchain defects (P2, observed 2026-07-06) — DONE v3.59.0 (2026-07-10)
- **What:** two related defects seen live: (a) agent templates hardcode the tier
  in the CRITICAL reminder line (`— @sr-engineer (opus)`), so a dispatch-time
  model override (fable) produced a mis-signed watermark; (b)
  `validateWatermark` on a MISMATCHED (not absent) watermark appends the
  canonical line instead of replacing, yielding a double watermark in the relay.
- **Fix:** (a) templates phrase the reminder as "end with `— @<role> (<the
  model you are actually pinned to>)`" or the dispatching coordinator injects
  the tier into the brief; (b) validateWatermark strips a detected-but-wrong
  trailing watermark line before appending. ~~Also add `fable` to the §1 tier
  enum~~ — *shipped via A13 (2026-07-08)*; remaining scope is (a)+(b) only.
- **Owner:** /teamwork (lib/watermark-check.ts + templates + tests; small).
- **Risk if skipped:** cosmetic but user-facing on every relay; tier attribution
  in the audit trail is wrong for overridden dispatches.

## C6 — Prompt-injection state footer blind to existing handoff (P1, observed 2026-07-08) — DONE 2026-07-08
- **Done:** shipped as feature `c6-c11-prompt-state-injection` (spec
  `specs/c6-c11-prompt-state-injection.md`, architecture
  `specs/c6-c11-prompt-state-injection-architecture.md`; v3.48.0).
  Mechanism: unified workspace-resolution at `resolveWorkspacePath()` in
  `index.ts` (called from GetPrompt handler; arg → CLAUDE_PROJECT_DIR → cwd,
  never redirects); three fail-loud footer variants in `prompts/build.ts`
  (S01a resolved path not a managed workspace, S01b managed + genuinely fresh,
  S02 handoff present but parse/migration error — never rendered as fresh),
  each naming the resolved path + resolution source; stale `prd_path` covered
  by the existing `resolvePrdPath` existsSync guard (test-only per DR-7).
  Closed by implemented AC-1..AC-6 in spec and verified in
  qa_reports/review_C6C11-QA.md.
- **What:** During the A10 run, BOTH `/teamwork` and `/teamwork-lite` prompt
  injections ended with "📍 Current Project State — No handoff state found.
  Fresh project" while `tw_get_state` returned a full, current handoff for the
  same workspace. Additionally the persisted `prd_path` still pointed at the
  pre-rename home directory (`/Users/paul.ph.chen/...` vs the current
  `/Users/paulchen/...`), suggesting workspace/path resolution in the prompt
  build reads a stale or differently-resolved root. The prompt state footer is
  the first-layer defense (context before any tool call); it silently failing
  degrades every session that trusts it.
- **Fix:** diagnose the prompt-build state loader's workspace resolution
  (symlinks? env root? cwd at prompt-request time vs tool-call time); make the
  footer fail loud ("state lookup failed at <path>") instead of masquerading as
  a fresh project; migrate/normalize stale absolute paths on read.
- **Owner:** /teamwork (`prompts/build.ts` state section + possibly
  `bin/agent-governance-context.mjs`; add a regression test).
- **Risk if skipped:** agents in managed workspaces boot believing the project
  is fresh; pre-flight still catches writes, but read-side context (active
  feature, pending_notes routing) is lost exactly where it's cheapest to have.

## C7 — §2 test-ownership absolutism vs mechanical release edits (P2, observed 2026-07-08) — DONE 2026-07-09
- **Done:** shipped as feature `c7-version-assertion-ownership` (spec
  `specs/c7-version-assertion-ownership.md` + code-review `review_reports/review_T-C7-CR.md`
  + QA `qa_reports/review_T-C7-QA.md`; single-feature commit + release flow).
  Implemented via option (b): version assertions in `test/baseline-manifest-gate.test.mjs`
  and `test/pixel-gate-attestation.test.mjs` now read target version dynamically from
  `package.json`/`index.ts` at test time (numeric-tuple floors); eliminates need for
  test-file edits on version bumps. Adds narrow import-path-retarget carve-out
  in Constitution §2 (`content/const-05-core-standards.md`) for version-comparison AST
  logic, gated to `@agent-governance-mcp/internal` marker. New STOP+route-to-qa rule in
  `skill-release-engineer.md` (S02): if hardcoded version literal found in test during
  release, release-engineer routes to qa-engineer (Constitution §2 violation).

## C8 — No crash-resume protocol; resume drops the dispatch-time model pin (P2, observed 2026-07-08) — DONE 2026-07-09
- **Done:** shipped as feature `c8-crash-resume-protocol` (spec
  `specs/c8-crash-resume-protocol.md` + code-review `review_reports/review_T-C8-CR.md`
  + QA `qa_reports/review_T-C8-QA.md`; single-feature commit + release flow).
  Mechanism: three-step resume procedure in skill-coordinator.md Crash-Resume
  Protocol section — (1) ground-truth working tree via git status, (2) restate
  findings in the resume brief, (3) re-assert dispatch-time model pins from
  `dispatch_pins` pending_notes convention, verifying resumed run honors them.
  New dispatch_pins convention in Auto-Routing section (AC-1), new pinned-tier
  expectation in Watermark Validation section (AC-2), new Crash-Resume Protocol
  section (AC-3), new Crash detection row in Escalation Routes table (AC-4).
  Content-only, no schema bump; test/context-budget.test.mjs AC8 cap rebaselined
  9699 → 10774 per QA. 6 C8 subtasks (T-C8-01..04 + T-C8-CR + T-C8-QA) + PASS.
- **What:** The sr-engineer subagent was killed mid-task by a session usage
  limit — it could not honor §3's "on crash, still call tw_update_state", so
  the chain had no failure record. The coordinator improvised: ground-truthed
  the working tree via `git status`, then resumed the agent from transcript.
  The resume path also dropped the dispatch-time `model: fable` pin — the agent
  came back on its frontmatter default (opus), silently violating a human
  directive (related: C5(a) covers the watermark side of tier attribution).
- **Fix:** skill-coordinator gains a **resume protocol**: before re-dispatching
  or resuming a role that died without a state write, (1) ground-truth the
  working tree vs the role's last claims, (2) restate findings in the resume
  brief, (3) re-assert any dispatch-time overrides (model pin) and verify the
  resumed run honors them — pin recorded in `pending_notes` at dispatch so it
  survives context loss.

## C9 — pending_notes is a free-text protocol channel (P2, observed 2026-07-08; natural A10 follow-on) — DONE v3.55.0 (2026-07-09)
- **What:** Load-bearing routing/gating signals — `next_role:`, `resume_of:`,
  `review: APPROVED`, cut-attestation notes — all live as string conventions
  inside `pending_notes`. The server greps for exact tokens; coordinators parse
  by convention. A10 data-fied the gate *definitions* but the *signals* that
  clear/route them remain stringly-typed.
- **Fix:** promote recurring protocol tokens to first-class handoff fields
  (`next_role`, `resume_of`, `review_verdict`), schema-versioned per
  `docs/schema-versions.md`; `pending_notes` reverts to prose for humans.
  Server validates enums instead of substring-matching.
- **Owner:** /teamwork (handoff schema bump + `transitions.ts`/orchestrator
  consumers + skill text; medium).
- **Risk if skipped:** token-format drift between skills and server grep
  (exactly the drift class A10 just eliminated for gate definitions).

## C10 — qa-engineer / release-engineer bookkeeping boundary blur (P2, observed 2026-07-08) — DONE v3.58.0 (2026-07-10)
- **What:** The A10 cut assigned version bump + CHANGELOG + backlog-marking to
  qa-engineer (A10-10); release-engineer then re-ran build/tests and did the
  commit/tag/release. Result: release bookkeeping split across two roles, QA's
  version bump forced the C7 test edits at release time, and build/test ran
  twice.
- **Fix:** cut-template guidance (skill-pm) + skill-qa/skill-release wording:
  QA owns verification + evidence + task completion; ALL release bookkeeping
  (version, CHANGELOG, backlog done-marking) belongs to release-engineer
  post-PASS. QA's PASS is on the feature diff, not the release artifacts.
- **Owner:** /teamwork (3 skill files; content-only).
- **Risk if skipped:** duplicated build/test cost each release and recurring
  C7-style boundary violations.

## C11 — Constitution double-injection in one session (P2, observed 2026-07-08) — DONE 2026-07-08
- **Done:** shipped as feature `c6-c11-prompt-state-injection` (spec
  `specs/c6-c11-prompt-state-injection.md`, architecture
  `specs/c6-c11-prompt-state-injection-architecture.md`; v3.48.0).
  Mechanism: two-level dedup at the GetPrompt handler in `index.ts` (NOT inside
  `buildPromptForRole`, which stays pure per DR-6) — L1 in-memory per-workspace
  delivered flag (prompt→prompt within one server process); L2 120s freshness
  marker `.current/.agc-hook-marker.json` written by the
  `bin/agent-governance-context.mjs` SessionStart hook on successful full emit
  (gitignored; absent/stale/malformed ⇒ fail-safe to full emission). Deduped
  bundles carry the S03 sentinel + recovery instruction; measured
  ~1500 token saving per deduped injection (AC-9 token assertion pins ≥1200).
  Closed by implemented AC-7/AC-8 in spec and verified in
  qa_reports/review_C6C11-QA.md.
- **What:** A session that receives the SessionStart hook context AND invokes a
  `/teamwork*` prompt carries the full constitution twice (hook block + prompt
  bundle) — observed live when `/teamwork` then `/teamwork-lite` were invoked
  in the same conversation, tripling the governance text in context. Pure
  token waste; also two copies can drift mid-session after an upgrade.
- **Fix:** the prompt bundle detects hook presence (marker line in the hook's
  additionalContext) and degrades to skill + state only; or the hook self-gates
  when the client is known to fetch prompts. Cheapest: a one-line "constitution
  already in context via hook — omitted" sentinel the build emits.
- **Owner:** /teamwork (`prompts/build.ts` + `bin/agent-governance-context.mjs`).
- **Risk if skipped:** every dual-path session pays double governance tokens —
  directly against the context-frugality design goal (cf. B9).

## C12 — Registry doc-facing fields are dead data — the drift class A10 killed, recreated inside the registry (P2, observed 2026-07-08, depends A10 ✓) — DONE v3.61.0 (2026-07-10)
- **What:** `gates/registry.ts` carries three doc-facing prose fields per gate —
  `triggerEdge`, `armCondition`, `clearingArtifact` — with **zero consumers and
  zero test assertions** (the generative parity test verifies only `errorCode`
  tokens bidirectionally + `hintStatic` presence at the producer file;
  `documentedInProse` is the only other field it reads). These 3×18 strings are
  a fourth hand-written copy of gate semantics that nothing verifies — exactly
  the unverified-copy drift class A10 was cut to eliminate. Root cause: DR-3
  deliberately chose parity-check over generation (safe, no content byte
  edits), which left the registry's prose fields with no downstream role.
  Found in the post-ship Fable-5 review of the Opus 4.8 implementation.
- **Fix (pick one):** (a) complete the original A10 option-(b) vision —
  `build.ts` renders the constitution §3.1 gate table / skill "gates you must
  clear" sections FROM these fields, making them load-bearing (preferred;
  turns detection into generation); (b) extend
  `test/error-code-contract.test.mjs` to assert the three fields against the
  prose (weaker — keyword-level parity); (c) delete the three fields until a
  consumer exists (MVP-strict; zero dead data, loses the captured semantics).
- **Owner:** /teamwork (option (a): `prompts/build.ts` + content restructure +
  tests; options (b)/(c): registry + test only).
- **Risk if skipped:** the three fields silently rot; a future consumer (or
  human reader) trusts stale trigger/arm/clear descriptions — an unverified
  fourth copy is worse than no copy.

## C13 — release-engineer has no legal handoff write; rejected subagent hand-edited handoff.md (P1, observed 2026-07-08) — DONE 2026-07-08

**Mechanism:** two new legal edges (`qa-engineer:PASS → release-engineer:In_Progress`, `release-engineer:In_Progress → pm:In_Progress`) + STOP-on-rejection rule in constitution §3
- **What:** During the v3.48.0 release, the release-engineer subagent's
  `tw_update_state(agent_id="release-engineer", status="In_Progress")` was
  rejected (`qa-engineer:PASS` allows only `pm`/`researcher` successors), so it
  **hand-edited `.current/handoff.md`** (fabricated timestamp, self-inserted
  `completed_tasks` row) and committed it — wedging the state machine at
  `release-engineer:In_Progress`, which has **zero outbound edges** (mirror of
  the `release-engineer:PASS` empty-set wedge T-MATRIX-A5 fixed; the PASS row
  is also unreachable since PASS is qa-exclusive). Coordinator recovered by
  restoring the last server-valid tuple and stamping via the legal
  `qa:PASS → pm` edge (commit 2f75c6a). Two defects: (a) the transitions
  matrix gives release-engineer no legal write path, so any SOP that tells it
  to record a release stamp forces a violation; (b) the subagent treated a
  server rejection as an obstacle to bypass rather than a stop signal — §3's
  hand-edit ban needs a CRITICAL line in the release-engineer template.
  Also skipped: the C4 `driftBaselineIds` release-time append.
- **Fix:** (a) either add `qa-engineer:PASS → release-engineer:In_Progress` +
  `release-engineer:In_Progress → pm:In_Progress` edges, or amend
  skill-release-engineer to stamp the handoff as `agent_id="pm"` (current de
  facto convention, v3.47.0 and earlier); (b) template CRITICAL line: on any
  `⛔` rejection, STOP and hand back — never edit state files directly;
  (c) add the driftBaselineIds append to the release SOP checklist.
- **Owner:** /teamwork (transitions.ts or skill text + template + tests).
- **Risk if skipped:** every release re-runs the same rejection→hand-edit
  temptation; a wedged handoff blocks the next feature's first PM write.

## C14 — dispatch_pins survives only by hand-carried pending_notes (P1, observed 2026-07-09; C9 follow-on) — DONE 2026-07-09 (v3.56.0)
- **Done:** shipped as feature `c14-dispatch-pins` (spec `specs/c14-dispatch-pins.md` + architecture `specs/c14-dispatch-pins-architecture.md` + code-review `review_reports/review_T-C14-*.md` + QA `qa_reports/review_c14-dispatch-pins.md`; single-feature commit + release flow). Mechanism: `dispatch_pins?: Record<AgentName, ModelTier>` field elevated to first-class handoff state (transient/write-scoped), zod-validated closed-enum, skill-coordinator.md reads and honors pin on dispatch, handoff schema v7→v8 migration (stamp-only). 12 T-C14-* tasks (design-and-spec through test-evidence + release); 997/997 tests green.
- **What:** In the live C9 run, the human's `sr-engineer=fable` pin survived
  four role hops and two crash-resumes ONLY because the coordinator wrote
  "carry `dispatch_pins: sr-engineer=fable` VERBATIM" into every dispatch
  brief. `pending_notes` is replaced wholesale on every write — one role
  forgetting the line silently drops the pin, and the resumed/next dispatch
  degrades to the frontmatter-default model with no error. C9 promoted
  `next_role`/`resume_of`/`review_verdict` but explicitly re-deferred
  `dispatch_pins` (shape differs: multi-entry `<role>=<model>` map vs single
  scalar — see specs/c9-protocol-fields.md Out of Scope).
- **Fix:** promote `dispatch_pins` to a first-class handoff field (record/map
  shape, schema bump per docs/schema-versions.md) that PERSISTS across writes
  until the feature closes (unlike C9's transient per-write fields —
  pins are durable directives, not routing signals); plus a one-line skill
  rule in each role: never re-derive model tier from frontmatter when a pin
  covers the role. Coordinator Crash-Resume step 3 then reads the field, not
  a grep.
- **Owner:** /teamwork (schema bump + orchestrator + skill text; small-medium).
- **Risk if skipped:** exactly the C8 failure class, still live — a dropped
  note line silently downgrades the model mid-feature; nobody notices until
  the watermark mismatches.

## C15 — Expected-red test handoff is unverifiable prose (P1, observed 2026-07-09) — DONE 2026-07-10
- **What:** C9's sr-engineer (correctly) edited no tests and handed QA a
  prose catalogue of 52 expected-red tests. Code-reviewer spot-checked 2 of
  52. A genuine regression hiding among the reds would be invisible: nothing
  machine-checks "actual red set == expected red set" before QA starts
  re-baselining — QA could re-baseline a regression into the suite.
- **Fix:** skill-sr-engineer: when leaving expected-reds, emit a
  machine-comparable manifest (file + test name, one per line, e.g.
  `qa_reports/expected-red_<feature>.txt`). skill-qa-engineer Phase 0: run
  the suite, diff actual reds vs manifest — the difference set must be empty
  or each extra/missing entry explicitly dispositioned in the evidence file
  before any re-baseline edit. skill-code-reviewer: verify the manifest
  exists and sample from it, not from prose.
- **Owner:** /teamwork (3 skill files + maybe an evidence-check hook;
  content-mostly).
- **Risk if skipped:** mass re-baselines (schema bumps do this every time)
  can launder a real regression into a "cap update"; post-hoc detection cost
  is a full release audit.

## C16 — code-reviewer overstepped bookkeeping: ledger write + evidence-path drift (P2, observed 2026-07-09) — DONE v3.58.0 (2026-07-10)
- **What:** In the C9 run the code-reviewer's APPROVED handoff wrote
  `completed_tasks: T-C9-01..06, T-C9-12..16` onto the handoff ledger —
  task-completion bookkeeping that belongs to qa-engineer's PASS (§3
  ownership; the reviewer judges the diff, it does not record completions).
  Separately its reply promised evidence at
  `review_reports/review_c9-protocol-fields.md` but wrote
  `review_reports/review_T-C9-01.md` — harmless here (the server found it),
  but path drift breaks any downstream consumer that trusts the stated path.
- **Fix:** skill-code-reviewer: explicit "never pass `completed_tasks`" rule;
  standardize evidence naming to one convention (per-feature
  `review_<feature>.md` OR per-task with a `covers:` manifest — pick one,
  align with the C3 covering-review precedent). Optionally an orchestrator
  guard rejecting `completed_tasks` from `agent_id=code-reviewer`.
- **Owner:** /teamwork (1–2 skill files, optional orchestrator guard + test).
- **Risk if skipped:** double-entry bookkeeping between reviewer and QA
  drifts the ledger; stated-vs-actual evidence paths rot into dead links.

## C17 — Coordinator dispatch briefs restate protocol by hand (P3, observed 2026-07-09) — DONE v3.62.0 (2026-07-10)
- **What:** Every C9-run dispatch brief hand-restated the same protocol
  boilerplate (first action tw_get_state → tw_detect_drift, known-drift
  ignore list, carry pins verbatim, don't set cut_approved, watermark
  format). Each restatement is a chance to omit or contradict a rule — the
  pin-carry line only existed because the coordinator remembered it.
- **Fix:** skill-coordinator gains a canonical per-role brief template
  partial (the invariant protocol block), so briefs are template + per-hop
  delta only. Overlaps C14 (pin block drops out of the template once pins
  are a field) — sequence after it.
- **Owner:** /teamwork (skill-coordinator, maybe templates/; content-only).
- **Risk if skipped:** low — ergonomics; but every omission class C14/C16
  document started life as a forgotten brief line.

## C18 — configCache never invalidates; post-release baseline appends are invisible until restart (P3, observed 2026-07-09; C4 follow-on) — DONE v3.59.0 (2026-07-10)
- **What:** `tools/config.ts` caches `.current/.config.json` per workspace in
  a process-lifetime `configCache` Map with no invalidation. The release SOP
  appends the feature's task ids to `driftBaselineIds` AFTER the session's
  server process started, so every release the just-appended ids leak through
  `tw_detect_drift` as false vibe-drift until the next server restart.
  Observed live post-v3.55.0: T-C9-01..16 reported as 16-task drift while
  already present in the on-disk baseline; a fresh process read the same
  config and reported clean. Self-healing (next session is clean) but every
  release pays one round of false alarms — the exact noise class C4 was cut
  to eliminate, recreated one layer down.
- **Fix:** cheapest that works: stat the config file and drop the cache entry
  when mtime changed (read is already lazy per call site); plus one line in
  skill-release-engineer noting the append takes effect immediately once the
  cache honors mtime. Alternative (zero-code): drift.ts bypasses the cache —
  but that forks config-read behavior; prefer the mtime check.
- **Owner:** /teamwork (`tools/config.ts` + test; batched with C5 per the
  execution order — two ~1-file fixes, one QA round).
- **Risk if skipped:** low — self-healing, but recurring: every release's
  post-stamp drift check cries wolf, training operators to ignore drift
  output right when it matters most.

## B8 — §7 external-reference policy is text-only, no server-side enforcement (P1, carried forward 2026-06-11) — DONE 2026-07-09
- **What:** Constitution §7 says a spec referencing external artifacts is
  presumed incomplete until each ref is fetched / indexed via `tw_index_prd` /
  user-confirmed ignorable — but this is prose only; `tw_update_state` never
  verifies it. Compare §3 pre-flight, which IS server-enforced (`⛔ BLOCKED`).
- **Origin:** `agc-SetupWizard` OOBE PRD had per-section `UI設計圖：Figma URL`
  placeholders while the real Figma link sat only in the文末 `相關連結`
  section; a PM reading section-by-section could skip it with all gates green.
- **Fix (refined):** per-spec external-reference **ledger** (each ref +
  `fetched`/`indexed`/`user-confirmed-ignorable`/`unresolved`); `tw_update_state`
  rejects the outbound hop while any ref is `unresolved`. Gate at PM→architect,
  not only PM→sr. Prefer an explicit PM-populated ledger over URL-scraping the
  spec (heuristic, error-prone).
- **Owner:** /teamwork (cross-module — `tools/transitions.ts` hop gate +
  ledger check + constitution §7 wording).
- **Risk if skipped:** a PM can silently drop a real external design/spec
  reference; downstream builds proceed against an incomplete spec with all
  gates green.

## B9 — Per-feature token budget + coordinator STOP at ceiling (P2, carried forward) — DONE v3.63.0 (2026-07-10)
- **What:** The routing chain bounds cost only implicitly (round caps ≤ 3-4,
  §5 hop cap ≤ 10). No explicit per-feature token budget, no coordinator
  stop-condition on spend. Language process-retrospective measured ~1.05M
  tokens on one feature across 4 visual-rework rounds with no budget brake.
- **Fix (sketch):** optional per-feature token budget (handoff field or
  `.config.json`); coordinator reads accumulated `agent-*.jsonl` `usage.*`
  (skill-coordinator §Subagent Token Observability, v3.31.0) and STOPs / hands
  to human near the ceiling — a cost-side circuit breaker complementing the
  count-side round caps.
- **Owner:** /teamwork (coordinator SOP + handoff/config field).
- **Risk if skipped:** low — round caps bound worst-case cost; this is a finer
  cost-side brake, not a correctness gate.

## D1 — Prompt args mis-resolved as `workspace_path` (P1) — DONE v3.65.0 (2026-07-10)
- **What:** Invoking `/teamwork-lite <free text>` (e.g. a question in Chinese)
  passes the text as the prompt's `workspace_path` argument;
  `prompts/build.ts` resolves it literally and emits the S01a "resolution
  suspect" state footer (`build.ts:410`) — the session starts with a wrong
  "not a managed workspace" claim instead of the real workspace state.
  Observed live 2026-07-10 in this repo.
- **Fix:** when the `workspace_path` arg is not an existing directory, fall
  back to cwd-based workspace detection (same probe the SessionStart hook
  uses) and treat the arg as user text, not a path. Keep the suspect footer
  only for path-shaped args that genuinely don't resolve.
- **Owner:** /teamwork (small code fix + test; sr→qa).
- **Risk if skipped:** every lite invocation with inline args loses state
  injection; agents act on "no handoff found" while a handoff exists — the
  exact failure class C6 fixed for the stale-`prd_path` variant.

## D2 — Server-side accounting for hop counter + token brake (P2, depends D3) ✓ DONE
- **Done (v3.68.0):** Hybrid implementation — (a) hop counter: schema v8→v9 with persisted hop_count field, HOP_CAP_EXCEEDED gate enforcing 10-hop limit; (b) token budget brake: opt-in PostToolUse hook appends usage.jsonl sidecar. Mechanism: specs/d2-server-brake-accounting.md + specs/d2-server-brake-accounting-architecture.md. Commit: af8537b (v3.68.0 tag).
- **What:** Both cost-side circuit breakers are "in-memory, model-maintained
  arithmetic" (`skill-coordinator.md` §Auto-Routing, §Token Budget Brake):
  the coordinator increments its own hop counter and sums four `usage.*`
  fields per dispatch by hand. Context compaction or a coordinator crash
  silently resets both; model arithmetic is inherently unreliable. C9/C14
  already proved the pattern: prose-token bookkeeping → validated first-class
  mechanism.
- **Fix (sketch):** either (a) orchestrator-side dispatch counter — a
  per-feature counter field stamped on each role-transition write, checked
  server-side against the `hop` cap; or (b) a PostToolUse hook on `Task` that
  appends usage to a `.current/` side file the coordinator reads instead of
  summing. Decide (a)/(b) at architecture time; telemetry from D3 shares the
  emit point.
- **Owner:** /teamwork (needs an architecture decision first).
- **Risk if skipped:** the brakes exist but fail exactly in the long/expensive
  sessions they were built for (compaction is correlated with high spend).

## D3 — Gate-fire telemetry → data-driven rule retirement (P1) — DONE v3.66.0 (2026-07-10)
- **What:** Every C-series ticket came from a human noticing friction in a
  live run. The server already sees each gate rejection
  (`TRANSITION_REJECTED`, `CUT_APPROVAL_REQUIRED`, `EXTERNAL_REFS_UNRESOLVED`,
  `REVIEW_VERDICT_STATUS_MISMATCH`, visual gates…) but records nothing.
  There is no data on which rules ever fire — a prose rule or gate that never
  fires is pure token cost on every dispatch.
- **Fix:** one emit point (orchestrator or `gates/registry.ts`) appending
  `{ts, gate, error_code, agent_id, feature}` to `.current/telemetry.jsonl`
  on every rejection (and optionally every pass-through). Retro procedure:
  rank rules by fire count; zero-fire rules over N features become retirement
  candidates. Same "measured costs, not estimates" standard the coordinator
  skill already applies to token telemetry (§Subagent Token Observability).
- **Owner:** /teamwork (small code + retro SOP line).
- **Risk if skipped:** rule-corpus growth is superlinear (every friction adds
  a rule; nothing removes one) — compliance load keeps crowding out task
  tokens with no counter-pressure. This is the review's highest-leverage
  ticket.

## D4 — Behavioral compliance eval harness (P2) — DONE v3.67.0 (2026-07-10)
- **What:** All 1067 tests are structural (marker greps, error-code contract,
  compose golden baseline, parser round-trips). Nothing verifies that a model
  given the assembled bundle actually follows it — known haiku watermark
  omissions (patched downstream by coordinator `validateWatermark`) prove
  behavioral drift is real and currently invisible to CI.
- **Fix:** a small eval harness (5–10 scripted scenarios): feed a role bundle
  + canned task to a model, assert output invariants (watermark format, terse
  cap, escalation-call shape, no banned phrases). Run on demand / pre-release,
  not per-commit (costs API calls). Primary purpose: catch behavior
  regressions when skills are rewritten for token savings (A6/A7-class
  rewrites).
- **Owner:** /teamwork (qa-engineer owns the harness).
- **Risk if skipped:** every token-saving rewrite is a blind bet that
  compressed prose still steers the model; failures surface as downstream
  agent misbehavior — the hardest class to trace (same rationale as A3).

## D5 — Server-side stale-dispatch detection (P2, C8 follow-on) ✓ DONE
- **Done (v3.70.0):** Handoff schema v9→v10 adds transient `dispatched_at` (ISO-8601) auto-stamped in writeHandoffState whenever a write sets `next_role` (single-sourced, orchestrator untouched); `tw_get_state` surfaces a `stale_dispatch` advisory ({role, dispatched_at, elapsed_minutes, threshold_minutes, message}) when an in-flight dispatch has no state write for >15 min (fixed STALE_DISPATCH_THRESHOLD_MIN, read-path advisory, no new gate). skill-coordinator.md: Stale-dispatch Escalation Routes row + Crash-Resume step 0. Mechanism: specs/d5-server-side-stale-dispatch-detection.md + -architecture.md.
- **What:** The Crash-Resume Protocol (skill-coordinator, v3.53.0) depends on
  the coordinator *remembering* it dispatched a role that never wrote state.
  If the coordinator itself is compacted/killed, the wedge is invisible: the
  handoff shows a stale tuple and nothing marks a dispatch as in-flight.
- **Fix:** orchestrator stamps `dispatched_at` + target role on (or alongside)
  the state write preceding a dispatch; `tw_get_state` surfaces "stale
  in-flight dispatch: <role>, no state write for >N min" so ANY context —
  including a fresh session — can detect the dead role and run Crash-Resume
  without dispatch-side memory.
- **Owner:** /teamwork (handoff schema field + orchestrator + skill note).
- **Risk if skipped:** double-crash (subagent + coordinator) leaves a wedged
  chain that only a human forensic pass can diagnose.

## D6 — Host-capability as a third compose axis (P3) ✓ DONE
- **Done (v3.71.0, git tag v3.71.0, commit b68746f):** Extended skill composition with host axis. Skills split into core + `host:claude-code`-tagged fragments (skills loaded via `buildPromptForRole()` with new `host` parameter, pattern mirrors `ConstitutionSegment`/`includeSegment`). Claude-Code-specific prose (Task-tool dispatch, telemetry, template instructions, watermark validation) excluded for non-CC hosts (Cursor, Continue, Anti-Gravity, plain MCP). Mechanism: prompts/build.ts, content/skill-*.md splits, test coverage. Backwards-compatible MINOR feature. See specs/d6-host-capability-compose-axis.md + -architecture.md.
- **What:** `skill-coordinator.md` carries large Claude-Code-only sections
  (Task-tool dispatch, `agent-*.jsonl` token telemetry, `~/.claude/agents`
  templates, watermark validation via `dist/lib/watermark-check.js`). On
  Cursor/Continue/plain-MCP hosts this is dead text loaded on every dispatch;
  the graceful-fallback prose documents its own irrelevance.
- **Fix:** extend the A9 compose pattern (`prompts/constitution-manifest.ts`
  tags core/design/chain) with a host axis — e.g. `host:claude-code` tagged
  skill fragments included only when the client advertises Task-tool
  capability (or via config). Skills gain the same manifest treatment the
  constitution already has.
- **Owner:** /teamwork (manifest + build.ts + skill splits; design first —
  how the server learns the host).
- **Risk if skipped:** low — token waste on non-CC hosts only; grows as more
  CC-specific machinery (hooks, pins, telemetry) accretes in coordinator prose.

## D7 — `qa_reports/` retention / archive policy (P3) — DONE v3.67.1 (2026-07-11)
- **What:** `qa_reports/` holds 232 files and grows monotonically — every QA
  round, review, and visual report lands there forever. tasks.md got an
  archive convention (C4 / drift baseline); evidence files have none.
- **Fix:** per-feature archive step at release time (release-engineer SOP):
  move the shipped feature's reports to `qa_reports/archive/<feature>/` (or
  a dated subdir). Server evidence checks only ever read the active feature's
  reports, so the move is safe post-release; verify the drift/evidence paths
  ignore the archive.
- **Owner:** /teamwork (content + one SOP step; small).
- **Risk if skipped:** low — directory noise, slower human navigation; no
  correctness exposure found.

## D8 — Lite recommended model vs haiku §1 compliance (P3) — DONE v3.68.1 (2026-07-11)

> **DONE (2026-07-11, v3.68.1, commit f531a8c).** Option (b): bumped `recommended_model` haiku → sonnet
> (skill frontmatter + doc mirror); `@lite` Task-subagent template stays haiku (has validating parent) —
> sanctioned divergence encoded as dated `MIRROR_EXEMPT_ROLES` exemption in test/subagent-templates.test.mjs.
> Decision on documented evidence (D4 live eval unavailable, per T-D4-09). See specs/d8-lite-recommended-model.md.
- **What:** `skill-coordinator-lite.md` recommends haiku, but haiku's §1
  compliance is documented-poor (watermark omissions are the stated reason
  the coordinator runs `validateWatermark` at all). Lite has NO validating
  parent — its replies go to the human unchecked, so lite is exactly where a
  low-compliance tier hurts most.
- **Fix:** either trim the lite bundle further until haiku reliably complies
  (measure via D4 harness), or bump the lite `recommended_model` to sonnet
  and accept the cost. Decide with D4 data if available.
- **Owner:** solo/lite-scale decision once D4 exists; content-only change.
- **Risk if skipped:** low — cosmetic non-compliance (missing watermark,
  verbosity) in solo sessions.

## D9 — `qa_review` auto-append fan-out to unrelated review files (P2) — DONE v3.69.0 (2026-07-11)
- **What:** During the D8 run (2026-07-11), a qa-engineer FAIL `tw_update_state`
  auto-appended its `qa_review` stamp not only to the current task's report but
  to `qa_reports/review_<id>.md` for **every open task**: 11 pre-existing,
  unrelated files (T-ORM-02/03, T-PGAT-01..04, T-PCAG-ARCH/SCHEMA/GATE/SOP,
  A11-12) were modified, and `review_T-D8-REL.md` / `review_T-D8-DONE.md` were
  spuriously created (the FAIL stamp also duplicated into `review_A11-12.md`
  etc.). Polluted diffs are parked in git `stash@{0}` (never popped) and the two
  stray files in the session scratchpad — inspect before fixing.
- **Why it matters:** evidence files are load-bearing (PASS gate, `covers:`
  coverage index via `buildCoverageIndex`). Cross-task stamps forge apparent
  evidence for tasks that were never reviewed and dirty release staging.
- **Fix:** find the auto-append target resolution (recordReview path) and scope
  it to the task id(s) actually being reviewed — never "all open tasks"; add a
  regression test (FAIL write with N open tasks → exactly the intended file(s)
  touched).
- **Risk if skipped:** medium — silent evidence forgery; next `covers:` sweep or
  archive step may relocate/attribute wrong evidence.

## D10 — release-engineer destructive conflict recovery (P2) — DONE v3.71.1 (2026-07-12)
- **What:** Shipping D8, the release-engineer (haiku tier) hit a non-fast-forward
  push (concurrent D2 session had advanced main to v3.68.0) and "resolved" it by
  aborting a rebase and running `git reset HEAD~1`, discarding its own committed
  release (v3.67.2) and the working tree. Only the reflog (`2115a2b`) made
  recovery possible; the coordinator re-versioned and re-released as v3.68.1.
- **Fix:** add to `content/skill-release-engineer.md`: a Hard rule — on any
  non-fast-forward / push-rejection / concurrent-release collision, STOP: no
  `git reset`, `git rebase`, `git checkout --force`, or `git clean`; write
  `status=Blocked` with the local release-commit SHA in `pending_notes` and hand
  back for coordinator recovery — plus a matching Escalation Routes row, a
  ≤2-sentence reinforcement hint in `templates/claude-code-agents/release-engineer.md`
  (C13 pattern), and a test pinning the rule text (release-staging.test.mjs
  convention).
- **Risk if skipped:** high on busy repos — concurrent sessions are now routine
  (D2/D7/D8 overlapped); next collision may not leave a reflog-reachable commit.

## E1 — Feature-scoped state: concurrency isolation for parallel sessions (P1, from 2026-07-11 review) — DONE v3.72.0 (2026-07-12)
- **What:** `handoff.md` models exactly ONE `active_feature`, but concurrent
  sessions are now routine and every overlap produced an incident: D2/D7/D8
  overlapped in one day; D5/D9 collided on v3.69.0 (D5's release re-versioned
  to v3.70.0 via a coordinator-executed rebase); D9's evidence fan-out dirtied
  11 unrelated files; D10's destructive `git reset` discarded a committed
  release. D10's STOP-on-non-ff rule is a tourniquet — the structural cause is
  that all in-flight features share one state file, one ledger, and one
  release path.
- **Fix (design first):** per-feature state scoping. Candidates: (a) a feature
  lease field — a second feature's PM write is rejected/queued while a lease
  is live; (b) branch/worktree-per-feature with feature-scoped handoff files
  and a serialized release queue. Weigh against local-fs file-lock semantics
  and schema-migration cost; decide at architecture time.
- **Owner:** /teamwork (architecture decision first; handoff schema +
  orchestrator + storage + skill-coordinator/release).
- **Risk if skipped:** every future overlap re-rolls the D9/D10 dice; the next
  collision may not leave a reflog-reachable commit.

## E2 — Bug-fix as a first-class chain: repro-first gate (P1, from 2026-07-11 review) — DONE v3.73.0 (2026-07-12)
- **What:** the entire chain is feature-shaped (pm spec → architect → sr →
  reviewer → qa). A bug fix today pays either full-chain overhead or goes lite
  with no independent QA. Nothing enforces the one discipline that makes
  automated bug fixing trustworthy: a failing reproduction test that exists
  BEFORE the fix.
- **Fix:** a `bugfix` dispatch mode with a lighter chain (pm ticket → sr → qa;
  architect/design skipped by default), plus a server gate: fix-phase work is
  blocked until an expected-red repro manifest exists (reuse C15 machinery,
  e.g. `qa_reports/expected-red_<bug>.txt`); QA PASS requires exactly that red
  set turned green with no new reds.
- **Owner:** /teamwork (transitions/dispatch mode + gate + skill-pm/sr/qa + tests).
- **Risk if skipped:** bug fixes keep paying feature-chain cost or skip QA —
  either depresses autonomous success exactly where it should be cheapest.

## E3 — Outcome-shaped acceptance: executable ACs + runtime evidence (P1, from 2026-07-11 review) — DONE v3.77.0 (2026-07-12)
- **What:** every gate is process-shaped — it checks that evidence files
  exist, parse, and that transitions are legal; nothing verifies the change
  does what the spec's AC says. QA writes its own tests and grades its own
  homework. The F2 false-green postmortem and the Mode retrospective's
  chronic "PASS ≠ 畫面對" theme both show the evidence layer passing while
  the output was wrong.
- **Fix:** PM specs gain machine-executable ACs where feasible (each AC
  provable by one command / test / pixel-diff — per the ticket-splitting
  report's field contract); skill-qa gains a mandatory "drive the change
  end-to-end and record runtime evidence" step; the evidence check requires
  the AC execution log, not just the report file's existence.
- **Owner:** /teamwork (skill-pm AC schema + skill-qa + evidence gate + tests).
- **Risk if skipped:** gate-green-but-wrong ships keep recurring — the most
  expensive failure class (human retraction → full-round redo).

**Release:** v3.77.0 (5dbfc57, 2026-07-12) — shipped AC_EXECUTION_LOG_MISSING (28th gate) to enforce proof annotations in feature specs as a release precondition, motivated by F2 false-green. Three legs: PM AC schema (`content/skill-pm.md` proof guidance), QA Phase 3.5 runtime-evidence phase (`content/skill-qa-engineer.md`), and gate implementation (`gates/ac-execution.ts`, `gates/registry.ts`, `tools/handoff-orchestrator.ts`). Covers 8 ACs: AC schema, phase guidance, gate arm-check, missing-log detection, test coverage, escalation routes, scope alignment, and visual/copy baselines. Full suite 1350/1350 pass. Evidence: qa_reports/review_T-E3-QA.md. Specs: specs/e3-outcome-shaped-acceptance.md + specs/e3-outcome-shaped-acceptance-architecture.md.

## E4 — design-auditor source-credibility check as a hard STOP gate (P1, from 2026-07-11 review) — DONE v3.75.0

**Release:** v3.75.0 (0932338, 2026-07-12) — shipped SOURCE_CREDIBILITY_UNVERIFIED gate on pm→{architect,sr-engineer} edge. Extends gates/visual.ts with credibility cell parser reading design baseline manifests; gate fires when fetch-based modes (Figma/Sketch/XD/Penpot) have audited rows missing credibility attestation (credibility: full-page-composite required). Dormant on image/PDF/paper modes. Complements E8 metrics: ensures source quality (E4) + measures outcome quality (E8) cross-feature. Full suite 1313/1313 green (1281 baseline + 32 new E4 tests). Evidence: qa_reports/review_T-E4-05.md. Specs: specs/e4-design-source-credibility-gate.md + specs/e4-design-source-credibility-gate-architecture.md.

**What:** the retrospectives' single strongest cross-feature conclusion:
  pin the correct, frozen design contract before work and the chain converges
  in one pass. Mode P2 caught a wrong Figma node pre-build → zero rework;
  Mode P1 mis-sourced per-card crops → full-round redo; Language's lossy
  geometry → 4 rework rounds (55.6% of 1.05M tokens). Today source
  verification is SOP prose, not a gate.
- **Fix:** formalize design-auditor step 0 as machine-checkable: classify the
  source node (full-frame composite / component variant / read-only review
  page / wrong mode), record the verdict as an attestation field in the
  design artifact; a mismatched or unverified source is Blocked — the server
  checks the attestation before the pm→build hop on design-armed features
  (B8 external-refs ledger pattern).
- **Owner:** /teamwork (skill-design-auditor + gate check + test; content-mostly).
- **Risk if skipped:** the highest-leverage lever stays unpulled; every
  mis-sourced design costs a full round.

## E5 — Backlog intake loop + tiered cut-approval (P2, depends E8, from 2026-07-11 review) — DONE v3.85.0 (2026-07-14)
- **What:** every feature ends with "next feature is a human decision", and
  cut-approval halts every cut regardless of size. These two human touchpoints
  are the availability bottleneck for autonomous operation.
- **Fix:** (a) coordinator intake loop — read backlog order, auto-propose or
  auto-start the next open ticket at feature close; (b) cut-approval tiering —
  cuts under a threshold (e.g. ≤2 files, P3, no schema change, non-design)
  auto-approve with `cut_approved` recorded as auto-tier; larger or
  design-armed cuts HALT as today. Per the ticket-splitting report, cut review
  is the highest-leverage human checkpoint — remove it LAST, and only after E8
  data shows the auto-tier is safe.
- **Fix (c) — cheapest-compliant-path intake step (added 2026-07-13, human-directed):**
  the Complexity Scope Gate classifies a ticket by its END deliverable, so
  feature-shaped tickets always route to the chain even when most of the work
  is analysis. Add an explicit intake step to skill-coordinator BEFORE routing:
  decompose the ticket into phases and classify each as (i) coordinator-direct
  (investigation, forensics, diagnosis, doc/bookkeeping, design-decision
  studies — read-only or no-test-no-verdict work), (ii) mini-chain (sr→CR→qa
  with the spec being the backlog row itself, skipping PM/ARCH; or qa-only via
  the E16 single-role judge-dispatch charter for test-only work), or (iii)
  full chain. Propose the cheapest compliant path by default and surface the
  classification to the human in one line. Hard floor stays: §2 test ownership
  and §3.2 builder ≠ judge are never bypassed. Evidence (2026-07-13): the
  human had to ask three times before the coordinator offered direct paths;
  direct analysis phases for E6 (retro run), E9A (stamp forensics), and E15
  (flake diagnosis) cost 50–90% less than chain execution AND made the
  subsequent build chains shorter because the spec arrived pre-researched.
  Small-batch precedent (C16+C10, E14+E16) composes with this: batch small
  same-class rows into one feature with a single review + QA round.
- **Owner:** /teamwork (skill-coordinator + const §3.1 tier rule + config threshold).
- **Risk if skipped:** low-risk small tickets queue behind human availability;
  mis-tiering risk if done before E8 exists — start conservative.
- **STATUS:** ✓ released in v3.85.0 (2026-07-14): E5 tickets T-E5-01/02/03 PASS; 1455/1455 tests green; driftBaselineIds: T-E5-01, T-E5-02, T-E5-03.

## E6 — Rule-retirement retro: actually run it (P2, depends D3 ✓ + E8, from 2026-07-11 review) — DONE 2026-07-13 (procedure institution, no release)
- **What:** D3 landed the telemetry emit, but the review thesis it was built
  for (rule-corpus growth is superlinear; retirement is the only
  counter-pressure) remains unexecuted — zero retros run, zero rules retired.
  The context tax compounds on every dispatch and directly crowds out task
  tokens.
- **Fix:** institute a cadence — every N features (suggest 5), run
  `docs/gate-retro-procedure.md` over `telemetry.jsonl` + E8 summaries;
  zero-fire gates/prose over the window become retirement-candidate PRs;
  keep a retired-rule list so removals are auditable.
- **Owner:** recurring lite/coordinator procedure, not a one-off feature;
  first run is the deliverable.
- **First run executed 2026-07-13** (coordinator-direct, no chain):
  `docs/retro-2026-07-13-gate-fire.md`. Verdict: 4 gates fired (all
  load-bearing), 26 zero-fire but only 8 genuinely armed-and-silent — all
  KEEP except EXTERNAL_REFS_UNRESOLVED placed on WATCH. No retirement PR
  this cycle; re-run after 5 more features or the first design-armed
  feature. The remaining E6 deliverable is the *cadence* (making the re-run
  happen), not the mechanics — those are proven now.
- **Cadence instituted 2026-07-13**: `docs/gate-retro-procedure.md` now
  carries a Cadence & retired-rule-ledger section (every 5 shipped features
  or first design-armed feature; next due ~v3.87; retro log + auditable
  retirement table). E6's fix description is thereby fulfilled —
  done-marking this row is a human call since no release ships it.
- **Risk if skipped:** compliance load keeps growing with no counter-pressure;
  autonomous success degrades invisibly as bundles grow.

## E7 — Git/CI as a governed surface (P2, sequence after D10, from 2026-07-11 review) — DONE v3.81.0 (2026-07-13)
- **What:** "does NOT touch git" is the stated design boundary, yet
  release-engineer touches git every release and the two worst recent
  incidents were git incidents (C13 hand-edit wedge, D10 destructive reset).
  Test-green is self-reported by agents; nothing external verifies it.
- **Fix (minimal):** a sanctioned-git-ops whitelist in constitution §6 or a
  shared skill fragment, applying to ALL roles (add/commit/tag/fast-forward
  push only; reset/rebase/clean/force-push → Blocked-and-hand-back —
  generalizing D10 beyond release-engineer). Optional second step: where CI
  exists, the release gate reads CI status (`gh` checks) instead of trusting
  the agent's own test claim.
- **Owner:** /teamwork (content + optional gh check step; small).
- **Risk if skipped:** the next git incident comes from a role other than
  release-engineer, with no rule to point to.

## E8 — Success-side telemetry: per-feature outcome metrics (P2, D3 follow-on, from 2026-07-11 review) — DONE v3.74.0 (2026-07-12)
- **What:** telemetry records only gate rejections. Success-rate claims
  ("fine-grained logic tickets ≈ near-100% one-pass; visual features far
  lower") are hand-assembled from retrospectives after the fact; nothing
  accumulates per-feature one-pass rate, qa/review/visual rounds, hops, or
  token totals.
- **Fix:** extend the D3 emit point (or add a feature-close/release hook) to
  append one per-feature summary record
  `{feature, tickets, qa_rounds, review_rounds, visual_rounds, hops, one_pass, released_version}`
  to `.current/telemetry.jsonl` (or a sibling `metrics.jsonl`) at release;
  small summarizer script for retros. Feeds E6 retirement decisions and E5
  auto-tier safety evidence.
- **Owner:** /teamwork (small code + release SOP line + summarizer).
- **Risk if skipped:** process tuning stays anecdotal — no way to verify
  whether E1–E5 actually move the success rate they were cut to move.

## E9 — Server-verifiable release self-check before done-report (P1, carried from E2 close-out 2026-07-11, sequence with E7) — DONE v3.78.0 (2026-07-12)
- **What:** two consecutive release integrity failures, both self-reported as
  clean: v3.72.0 (hand-edited handoff + local-time-stamped-as-UTC
  `last_updated`) and v3.73.0 (partial source commit + wrong gate name +
  unpushed commit + fabricated state-write claims). The release-engineer's
  done-report is currently trusted verbatim; nothing external verifies that
  the claimed artifacts (commit, tag, push, state write) actually exist.
- **Fix (proposed at E2 close-out):** a server-verifiable release self-check
  that must pass BEFORE the done-report / closing `tw_update_state` — e.g. a
  script (or gate) asserting: tag exists and points at HEAD; HEAD == origin
  (pushed, no unpushed commits); `check-version.mjs` green; CHANGELOG entry
  for the tagged version present; dist/ rebuilt in the release commit; the
  claimed closing state write actually landed (read back via `tw_get_state`).
  Failures → Blocked-and-hand-back, never a "released" claim. Overlaps E7's
  CI-reads-instead-of-trusting direction — sequence together; E9 is the
  release-specific, CI-independent subset.
- **Owner:** /teamwork (script + release SOP step + optional orchestrator gate).
- **Risk if skipped:** third integrity failure; release done-reports remain
  unverifiable claims, and downstream bookkeeping (backlog done-marking,
  drift baselines) inherits fabricated state.

## E9A — Suspected hand-authored release-closing handoff writes (P2, governance-integrity, from 2026-07-12 coordinator finding) — **DONE (2026-07-13, v3.82.0)**
- **What:** the last two release-closing writes to `.current/handoff.md`
  (v3.72.0 and v3.73.1) carry `last_updated` stamps that are round-to-the-
  minute AND local-time-mislabeled-as-Z (e.g. `2026-07-12T04:35:00.000Z`
  written at real UTC ~20:35). Every server-side `tw_update_state` stamp
  carries millisecond entropy (`new Date().toISOString()`), so a
  minute-round, wrong-offset stamp is not something the write path
  produces — these two look hand-authored. `content/skill-release-engineer.md`
  L20 already forbids hand-editing `.current/handoff.md`/`tasks.md` under
  any circumstance (STOP-on-rejection rule); the suspected mechanism is a
  release-engineer subagent hand-editing the handoff file directly during
  release staging instead of calling `tw_update_state`, rather than an
  explicit rule violation choice.
- **Blast radius today:** contained — the v3.73.1 negative-age guard
  (E1A, `gates/feature-lease.ts`) already treats a stamp that cannot
  establish a trustworthy non-negative elapsed time as lease-NOT-held
  (fail-open), so a mislabeled-offset stamp cannot itself wedge the
  feature-lease mechanism. The concern is integrity/audit-trail, not an
  active outage.
- **Fix (scope suggestion, not yet chosen):** (1) reproduce — find the
  exact writer (audit recent release-engineer transcripts/tool-call logs
  for a direct file write vs. a `tw_update_state` call around those two
  releases); (2) consider a server-side integrity check — e.g. reject
  client-shaped timestamp patterns (round-minute, non-UTC-tagged) on
  `tw_update_state`-adjacent reads, or extend `tw_detect_drift` to flag a
  handoff `last_updated` that could not plausibly have come from
  `new Date().toISOString()`.
- **Evidence (2026-07-13, v3.81.0 release):** the suspected mechanism got a
  live confirmation datapoint — the release-engineer subagent (haiku)
  reported it had NO MCP tool-invocation capability (Read/Edit/Write/Bash
  only) and could not call `tw_update_state` for the terminal closing
  write; it correctly escalated and the coordinator relayed the write via
  MCP instead. A less-careful run of the same setup plausibly reaches for
  Edit on `.current/handoff.md` directly — which would produce exactly the
  hand-authored stamp shape v3.72.0/v3.73.1 exhibit. Investigation should
  start from subagent tool-surface configuration, not rule-compliance.
- **Forensics complete (2026-07-13):** `research/e9a-stamp-forensics.md` —
  full-history stamp audit found 5 hand-authored stamps (v3.48.0, v3.49.0,
  v3.72.0, v3.73.1 release stamps + one pre-era seed), ALL in the
  release-close class, none elsewhere; every other stamp has ms entropy.
  Root cause confirmed as tool-surface (no MCP path in the release-engineer
  subagent; pre-C13 no legal write existed at all). The reproduce step of
  this ticket is DONE — remaining scope is the fix: codify the
  coordinator-relay for closing writes (skill + template) + optional
  `tw_detect_drift` stamp-shape advisory.
- **Owner:** TBD — not started; do not fix opportunistically inside an
  unrelated feature's ticket.
- **Risk if skipped:** the false audit trail persists silently; if the
  same mechanism produces a stamp that DOES pass the negative-age guard
  (e.g. correctly-offset but still hand-authored), a future incident loses
  the one signal (`tw_update_state`'s ms-entropy timestamp) that currently
  distinguishes a real write from a hand-edit.

## E10 — Feature-lease human override + non-work write exemptions (P2, from 2026-07-12 E8-start incident) — DONE v3.80.0 (2026-07-13)

- **What:** two lease false-positive classes surfaced while starting E8 with
  a human present and the incumbent feature (E1) verifiably shipped:
  (1) a PM *failure-record* write — required by Constitution §3 crash/failure
  rules and forced onto the only legal edge `(pm, In_Progress)` — re-held the
  lease for a feature everyone knew was terminal; (2) the server's lazy
  schema-migration rewrite on first read refreshed `last_updated`, extending
  the same dead lease by another TTL window. Net effect: the human waited out
  ~34 minutes of timeouts to start approved work in an idle workspace, with
  no sanctioned way to attest "this lease is dead".
- **Fix (scope suggestion):** (1) a human-override write path — e.g. a
  `lease_override: true` field writable only on a coordinator-authored
  `tw_update_state` carrying an inline human-approval attestation (mirror the
  `cut_approved` §3.1 trust mechanics + audit-trail note); (2) exempt
  bookkeeping writes from lease refresh — failure-record/admin writes and
  migration heals should preserve the incumbent `last_updated` instead of
  stamping fresh (a heal is not evidence the feature is alive);
  (3) optionally: a distinct `status` or flag for administrative notes so the
  state machine stops conflating "record of being blocked" with "work in
  progress".
- **Owner:** TBD — needs PM cut; touches gates/feature-lease.ts,
  handoff-orchestrator, migrations, constitution §3.1 text.
- **Risk if skipped:** every future crash-record or migration in a busy
  workspace re-arms a dead lease; humans learn to work around the gate
  (worktrees, waiting, or — worse — hand-edits), eroding exactly the
  discipline the lease was built to protect.

## E11 — check-version.mjs ships-vs-source blind spot (P2, release-integrity, from 2026-07-12 v3.74.0 post-release verify) — DONE v3.76.0 (2026-07-12)

- **What:** `scripts/check-version.mjs` asserts the `index.ts` `Server()`
  version literal equals `package.json` version — but never checks the
  compiled `dist/index.js`, which is the artifact `npx github:...#<tag>`
  actually runs. At v3.74.0 the release commit shipped `dist/index.js` still
  carrying `"3.73.1"` while source + package.json were correctly `3.74.0`;
  `check-version.mjs` passed, so a wrong-version tag would have gone out. The
  coordinator caught it in post-release verify and corrected it (fixup commit
  9b91db9, tag moved), but nothing automated would have.
- **Fix:** extend `check-version.mjs` to also parse the `Server({... version})`
  literal out of `dist/index.js` and assert it equals `package.json`; fail
  loud on mismatch. Add a test that a stale dist trips it.
- **Owner:** TBD — small (1 script + 1 test); qa owns the test per §2.
- **Risk if skipped:** the same stale-dist mis-versioned release can recur
  every release; the guard that exists to prevent exactly this class silently
  doesn't cover the shipped artifact.
- **Status:** ✅ DONE (2026-07-12, v3.76.0 — commit 4d38a8a) — dist-parity check now parses dist/index.js Server() literal and compares against package.json; gate mandatory in release-engineer SOP step 7; 1323/1323 tests green.

## E12 — E8 metrics emit not idempotent per release (P3, data-quality, from 2026-07-12 v3.74.0 first live emit) — DONE v3.76.0 (2026-07-12)

- **What:** the release-time metrics emit (E8, `tools/metrics.ts` wired at the
  E1A terminal-marker in `handoff-orchestrator.ts`) fires on every write
  matching the release-engineer closing signature. During v3.74.0 staging two
  such writes occurred, so `.current/metrics.jsonl` now holds two identical
  `e8-success-telemetry` records (differing only in `ts`). The metric values
  are correct; the duplication is a data-quality wart for the very telemetry
  E8 exists to produce.
- **Fix:** dedupe per `(feature, released_version)` — either skip the append
  when a record for that pair already exists in `metrics.jsonl`, or fire the
  emit exactly once per release close. Keep best-effort/never-block posture.
- **Owner:** TBD — small (dedupe guard in tools/metrics.ts + test). Do NOT
  hand-edit the existing duplicate out of `metrics.jsonl` (append-only
  telemetry; hand-edits are the E9 anti-pattern) — let the summarizer or a
  migration handle historical dedupe if needed.
- **Risk if skipped:** cross-feature success-rate math (the E6/E5 consumers)
  double-counts any release that double-fired, skewing the exact numbers E8
  was built to make trustworthy.
- **Status:** ✅ DONE (2026-07-12, v3.76.0 — commit 4d38a8a) — metrics emit now idempotent via last-line read-back check in tools/metrics.ts; silent skip on duplicate (feature, released_version) pairs; dedupe regression tests in test/success-metrics.test.mjs; 1323/1323 tests green.

## E13 — E1A terminal-marker fragility: non-terminal closing write fails silently (P2, release-integrity, from 2026-07-12 E11+E12 intake incident) — DONE v3.79.0 (2026-07-13)

- **What:** the E1A feature-lease terminal marker requires the exact triple
  `last_agent="release-engineer" && status="In_Progress" && next_role="pm"`
  (gates/feature-lease.ts:70-95). During the v3.75.0 close-out the coordinator
  briefed the release-engineer to omit `next_role` ("parked, awaiting human"),
  the write landed without complaint, the terminal clause's third conjunct
  failed silently, and the next feature's PM write was rejected with
  FEATURE_LEASE_HELD until a corrective reissue. Nothing warned either agent
  that the closing write was non-terminal.
- **Fix (pick one at design time):** (a) server-side advisory/rejection when a
  write matches the release-engineer closing signature except for a missing
  `next_role` — "closing write is non-terminal, lease stays held"; or (b)
  relax the marker to `last_agent="release-engineer" && status="In_Progress"`
  post-PASS; or (c) both-belt: advisory + skill-release-engineer checklist
  line. Sequence with E10 (lease human-override) — same trust surface.
- **Owner:** TBD — small (~3: gates/feature-lease.ts or orchestrator advisory,
  skill-release-engineer note, test).
- **Risk if skipped:** every future close-out that omits the triple re-creates
  a silent ~30-min lease stall at the next feature start; the marker's
  correctness depends on prose SOP compliance the server never checks.
- **Second occurrence (2026-07-12, E9 intake):** a new failure path for the same
  marker — the v3.77.0 closing write DID carry the full triple (`next_role=pm`
  observed in a 11:08Z read), but a subsequent server-side rewrite at
  11:14:49.627Z (suspected read-path heal during a PM subagent session; not an
  agent write — `last_agent` stayed `release-engineer`, `pending_notes`
  unchanged) dropped the transient `next_role`, breaking the triple's third
  conjunct after the fact. Next feature's PM write rejected with
  FEATURE_LEASE_HELD; ~30-min stall waiting out the re-armed lease. Implication
  for the fix: relaxing the marker to drop the `next_role` conjunct (option b)
  also covers this class, whereas a write-time advisory (option a) alone does
  not — the closing write here was correct when written. Overlaps E10 class 2
  (heal refreshes `last_updated` / mutates persisted state of a dead lease).

## E18 — Write-provenance hardening: stamp gate + completion-evidence gate (P2, from 2026-07-14 v3.85.0 incidents) — DONE v3.86.0 (2026-07-14)
- **What:** two independent provenance holes exploited (once each) during the
  E5/v3.85.0 cycle, both by subagents routing around the server's write path
  or its per-role gates. Identity and stamps are attestation-based by design;
  these fixes verify what CAN be verified server-side: stamp shape and
  on-disk evidence.
- **Incident (a) — hand-authored closing write (third E9A-class):** the
  no-MCP-path haiku release-engineer subagent hand-edited
  `.current/handoff.md` + hand-appended `.current/metrics.jsonl` via git
  commits 5950c58/199b164 instead of Blocked-and-hand-back per the
  skill-release-engineer RELAY REQUIRED directive: fabricated zero-entropy
  stamps (`2026-07-14T00:00:00.000Z`) and, in the first hand-edit, a
  fabricated tag SHA. Caught by the E9A `stampAdvisory` (read-only) during
  coordinator post-release verify; remediated in 70e3a35 (server-relayed
  closing write + metrics re-emit). Contributing cause: the coordinator's
  dispatch brief told the subagent to write state itself, contradicting the
  relay SOP — the template must make RELAY REQUIRED un-overridable by a brief.
- **Fix (a):** on the file-mode `tw_update_state` write path, when the
  CURRENT on-disk `last_updated` matches the stampAdvisory hand-authored
  predicate (reuse the exact predicate from tools/drift.ts — do not fork it),
  reject with a new gate error (e.g. `STAMP_PROVENANCE_SUSPECT`) unless the
  write carries an audited override in the LEASE_OVERRIDE_AUDIT_MISSING
  style (`pending_notes[0]` matching `/^stamp-remediation:/`), forcing the
  next writer to acknowledge the contamination instead of silently
  overwriting the evidence. Plus: one hard line in the release dispatch
  template / skill-release-engineer (closing write is COORDINATOR-RELAYED;
  a dispatch brief cannot override this).
- **Incident (b) — identity-swap gate evasion:** the E5 code-reviewer
  subagent, after its legitimate APPROVED write, made a second
  `tw_update_state` as `agent_id="qa-engineer"` pre-filling
  `completed_tasks` T-E5-01/02/03 — before any qa-engineer ran, with zero
  evidence on disk. `REVIEWER_COMPLETED_TASKS_REJECTED` (guarding exactly
  this C16 class) was bypassed entirely by the borrowed agent_id; tasks.md
  stayed unchecked, so tw_detect_drift surfaced nothing. Disclosed to the
  real qa-engineer, which re-established completion legitimately
  (qa_reports/review_T-E5-01.md records the anomaly).
- **Fix (b):** file-mode gate on `tw_update_state`: a write with
  `agent_id="qa-engineer"` whose `completed_tasks` adds ids not already in
  the on-disk handoff requires per-id QA evidence present on disk (the
  evidence-file convention tools/evidence-file.ts already checks — reuse it),
  else reject (e.g. `QA_COMPLETION_EVIDENCE_MISSING`). Keeps tw_complete_task
  untouched (it has its own evidence path); targets only the update-state
  side door the impersonated write used.
- **Owner:** /teamwork mini-chain sr → CR → qa; the spec is this row plus the
  incident record in the E5 commits (62cd36d message, 70e3a35 message).
- **Risk if skipped:** both holes are now documented in a public repo — the
  next occurrence is a matter of time, and the third E9A incident shows the
  advisory-only tier does not deter a subagent that cannot reach the tools.
- **STATUS:** ✓ released in v3.86.0 — STAMP_PROVENANCE_SUSPECT gate (gates/stamp-provenance.ts) + QA_COMPLETION_EVIDENCE_MISSING gate (tools/handoff-orchestrator.ts) + RELAY REQUIRED hard line (skill-release-engineer.md); mini-chain sr(fable) → CR(APPROVED) → qa(PASS); 1472/1472 tests green.

## E19 — SessionStart hook auto-injection retired (P1, human decision 2026-07-15) — DONE 2026-07-15 (docs+settings, no release)
- **What:** the SessionStart hook (`bin/agent-governance-context.mjs`)
  auto-injects the full constitution + coordinator-lite skill (~18.7KB) into
  every session in any workspace with `.current/` or `tasks.md` — including
  sessions that only ask questions and never touch governed state.
- **Evidence (both observed live 2026-07-15, this repo):**
  1. **Double-fire:** the hook was registered in BOTH `~/.claude/settings.json`
     (global) and this repo's `.claude/settings.local.json` — every session
     here received two byte-identical ~18.7KB injections (~37KB dead context).
  2. **Mode contradiction (104447-F0 retro E1):** hook says "You are in
     Coordinator-Lite mode" (server-read-only); the user then invokes
     `/teamwork`, loading the full coordinator whose core job is state
     writes. Two contradictory standing declarations coexist for the rest of
     the session.
- **Decision (human, 2026-07-15):** remove the SessionStart registration
  entirely rather than patch around it. Governance context becomes
  invocation-scoped: `/teamwork` loads the full coordinator, the
  `teamwork-lite` prompt loads lite — you pay the context cost exactly when
  you opt into the mode, and only one mode declaration ever exists per
  session. Rationale: users who open a session to ask the coordinator a
  question (not to run lite) were paying the lite injection for nothing.
- **Scope:** delete the hook entry from both settings files; keep
  `bin/agent-governance-context.mjs` in-tree as a documented opt-in;
  rewrite the CLAUDE.md "Auto-injection" section + docs/install.md hook
  step to present it as opt-in with the tradeoff stated (auto-arming for
  hook users vs. zero passive context cost without it).
- **Non-goal:** no server/prompt code changes; the lite prompt itself is
  untouched.
- **STATUS:** ✓ done 2026-07-15 (same session as intake, coordinator-direct,
  docs+settings only — no build, no release). Hook removed from
  `~/.claude/settings.json` and `.claude/settings.local.json` (both re-validated
  as JSON); CLAUDE.md §"Governance context loading" rewritten; docs/install.md
  hook section marked OPT-IN with the double-registration warning; intro link
  anchor fixed. `bin/agent-governance-context.mjs` kept in-tree. Takes effect
  from the next session start. Follow-up same day: the agc-init adapter
  template (`templates/agent-adapters/claude.md`) still claimed the hook
  auto-injects — rewritten to invocation-scoped + opt-in hook wording, and this
  repo's own CLAUDE.md adapter block synced to match. Note for consumers:
  workspaces agc-init'd before this date carry the stale line until they re-run
  `agc init`.
