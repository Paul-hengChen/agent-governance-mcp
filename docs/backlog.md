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

| id | desc | priority | depends_on | est. files | design-link |
|----|------|----------|------------|------------|-------------|
| A1 | Tool/prompt registry pattern — de-triplicate `index.ts` registration — **done (2026-07-07)** | P1 | — | ~14 (`index.ts` + every `tools/*.ts` + prompt registration) | — |
| A2 | Split `tools/evidence-file.ts` (994 lines) into per-gate `gates/` modules — *recommend folding into A10* | P1 | — | ~8 (`evidence-file.ts` → `gates/*.ts`, `transitions.ts`, tests) | — |
| A3 | Build-time validator for constitution span-strip markers — **superseded by A9** | P2 | — | ~3 (`scripts/check-spans.mjs` new, `package.json`, test) | — |
| A4 | Strip version/origin tags from governance text at build time — **done (2026-07-06)** | P1 | — | ~4 (`prompts/build.ts`, `content/*.md`, test) | — |
| A5 | Error-code contract test: `content/*.md` ↔ code — **done (3360c68)** | P1 | — | ~2 (new test, maybe a shared error-code export) | — |
| A6 | Consolidation rewrite of `skill-qa-visual.md` (265 → 124 lines) — **done (77a6373)** | P1 | — | ~2 (`content/skill-qa-visual.md`, evidence-parser test run) | — |
| A7 | Consolidation rewrite of `skill-pm.md` (gates → Gate Summary table) — **done (2026-07-06)** | P1 | — | ~2 (`content/skill-pm.md`, tests) | — |
| A8 | Single-owner dedup of multi-told mechanisms (cut-approval ×3 — *resolved via C2, 2026-07-07*; self-converge ×2 still open) | P2 | — | ~5 (constitution + coordinator + pm + lite + sr skills) | — |
| A9 | Compose-not-strip: overlay modules replace fence stripping in `build.ts` — **done (2026-07-07)** | P2 | — | ~8 (`prompts/build.ts`, split `content/constitution*.md`, tests) | — |
| A10 | Gate registry as structured data → code + rendered prose — *P2→P1 2026-07-07: prereqs landed (A9 ✓, A1 orchestrator ✓)* | P1 | A9 ✓ | ~10 (`gates` data file, `transitions.ts`, `handoff-orchestrator.ts`, `build.ts`, content, tests) | — |
| A11 | Escalation-route tables + unified WHEN/DO/ELSE rule grammar across skills | P2 | A6, A7 | ~12 (all `content/skill-*.md`, constitution) | — |
| A12 | Shared SOP partials + Limits number registry | P2 | A9 | ~14 (all content files, `build.ts`) | — |
| A13 | §1 polish: unified output policy, watermark decision table, positive examples per schema | P2 | — | ~6 (constitution + several skills) | — |
| B8 | §7 external-reference policy has no server-side enforcement gate (carried forward) | P1 | — | ~4 (`tools/transitions.ts`, evidence/ledger check, constitution §7) | — |
| B9 | Per-feature token budget + coordinator STOP at ceiling (carried forward) | P2 | — | ~3 (coordinator SOP, handoff/config field) | — |
| C1 | Transitions matrix lacks amend/repair semantics (pm re-entry strands downstream roles) | P1 | — | ~4 (`tools/transitions.ts`, constitution §3.1, skill-coordinator, tests) | — |
| C2 | Cut-approval cannot cross the subagent boundary — formalize coordinator-attested approval — **done (2026-07-07)** | P1 | — | ~5 (`handoff` field, `transitions.ts`/orchestrator, skill-pm, skill-coordinator, tests) | — |
| C3 | Per-task-id evidence check forces stub pointer files — accept covering review + id manifest | P2 | — | ~3 (evidence check in orchestrator/evidence-file, skills, tests) | — |
| C4 | Drift detector drowned by historical noise — acknowledged-baseline / archive mechanism | P2 | — | ~4 (`tools/drift.ts`, maybe `tw_sync`/config, tests) | — |
| C5 | Watermark toolchain: template hardcodes tier; validateWatermark appends instead of replacing on mismatch | P2 | — | ~4 (`lib/watermark-check.ts`, `templates/claude-code-agents/*`, tests) | — |

---

## A1 — Registry pattern for tool & prompt registration (P1)
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

## A2 — Split `evidence-file.ts` into per-gate modules (P1)
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

## A4 — Strip version/origin tags from governance text at build time (P1)
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

## A5 — Error-code contract test: content ↔ code (P1)
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

## A6 — Consolidation rewrite of `skill-qa-visual.md` (P1)
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

## A7 — Consolidation rewrite of `skill-pm.md` (P1)
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

## A8 — Single-owner dedup of multi-told mechanisms (P2)
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

## A9 — Compose-not-strip: overlay modules replace fence stripping (P2, supersedes A3)
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

## A10 — Gate registry as structured data → code + rendered prose (P2, depends A9)
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

## A11 — Escalation-route tables + unified rule grammar (P2, depends A6/A7)
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

## A12 — Shared SOP partials + Limits number registry (P2, depends A9)
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

## A13 — §1 polish: output policy, watermark table, positive examples (P2)
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

## C1 — Transitions matrix lacks amend/repair semantics (P1, observed 2026-07-07)
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

## C3 — Per-task-id evidence check forces stub pointer files (P2, observed 2026-07-07)
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

## C4 — Drift detector drowned by historical noise (P2, observed 2026-07-06/07)
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

## C5 — Watermark toolchain defects (P2, observed 2026-07-06)
- **What:** two related defects seen live: (a) agent templates hardcode the tier
  in the CRITICAL reminder line (`— @sr-engineer (opus)`), so a dispatch-time
  model override (fable) produced a mis-signed watermark; (b)
  `validateWatermark` on a MISMATCHED (not absent) watermark appends the
  canonical line instead of replacing, yielding a double watermark in the relay.
- **Fix:** (a) templates phrase the reminder as "end with `— @<role> (<the
  model you are actually pinned to>)`" or the dispatching coordinator injects
  the tier into the brief; (b) validateWatermark strips a detected-but-wrong
  trailing watermark line before appending. Also add `fable` to the §1 tier
  enum (constitution mentions opus/sonnet/haiku only — fold into A13 if that
  ships first).
- **Owner:** /teamwork (lib/watermark-check.ts + templates + tests; small).
- **Risk if skipped:** cosmetic but user-facing on every relay; tier attribution
  in the audit trail is wrong for overridden dispatches.

## B8 — §7 external-reference policy is text-only, no server-side enforcement (P1, carried forward 2026-06-11)
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

## B9 — Per-feature token budget + coordinator STOP at ceiling (P2, carried forward)
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
