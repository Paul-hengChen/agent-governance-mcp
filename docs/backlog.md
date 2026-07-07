# Backlog — architecture-improvement tickets

Tickets from the 2026-07-06 architecture review. Each is a candidate for a
future `/teamwork` feature; none blocks a release on its own.

> Recorded 2026-07-06. Prior backlog (B1–B11, recorded 2026-06-02) cleared;
> done rows dropped, still-open B8/B9 carried forward below.

| id | desc | priority | depends_on | est. files | design-link |
|----|------|----------|------------|------------|-------------|
| A1 | Tool/prompt registry pattern — de-triplicate `index.ts` registration | P1 | — | ~14 (`index.ts` + every `tools/*.ts` + prompt registration) | — |
| A2 | Split `tools/evidence-file.ts` (994 lines) into per-gate `gates/` modules | P1 | — | ~8 (`evidence-file.ts` → `gates/*.ts`, `transitions.ts`, tests) | — |
| A3 | Build-time validator for constitution span-strip markers — **superseded by A9** | P2 | — | ~3 (`scripts/check-spans.mjs` new, `package.json`, test) | — |
| A4 | Strip version/origin tags from governance text at build time — **done (2026-07-06)** | P1 | — | ~4 (`prompts/build.ts`, `content/*.md`, test) | — |
| A5 | Error-code contract test: `content/*.md` ↔ code — **done (3360c68)** | P1 | — | ~2 (new test, maybe a shared error-code export) | — |
| A6 | Consolidation rewrite of `skill-qa-visual.md` (265 → 124 lines) — **done (77a6373)** | P1 | — | ~2 (`content/skill-qa-visual.md`, evidence-parser test run) | — |
| A7 | Consolidation rewrite of `skill-pm.md` (gates → Gate Summary table) — **done (2026-07-06)** | P1 | — | ~2 (`content/skill-pm.md`, tests) | — |
| A8 | Single-owner dedup of multi-told mechanisms (cut-approval ×4, self-converge ×2) | P2 | — | ~5 (constitution + coordinator + pm + lite + sr skills) | — |
| A9 | Compose-not-strip: overlay modules replace fence stripping in `build.ts` — **done (2026-07-07)** | P2 | — | ~8 (`prompts/build.ts`, split `content/constitution*.md`, tests) | — |
| A10 | Gate registry as structured data → code + rendered prose | P2 | A9 | ~10 (`gates` data file, `transitions.ts`, `evidence-file.ts`, `build.ts`, content, tests) | — |
| A11 | Escalation-route tables + unified WHEN/DO/ELSE rule grammar across skills | P2 | A6, A7 | ~12 (all `content/skill-*.md`, constitution) | — |
| A12 | Shared SOP partials + Limits number registry | P2 | A9 | ~14 (all content files, `build.ts`) | — |
| A13 | §1 polish: unified output policy, watermark decision table, positive examples per schema | P2 | — | ~6 (constitution + several skills) | — |
| B8 | §7 external-reference policy has no server-side enforcement gate (carried forward) | P1 | — | ~4 (`tools/transitions.ts`, evidence/ledger check, constitution §7) | — |
| B9 | Per-feature token budget + coordinator STOP at ceiling (carried forward) | P2 | — | ~3 (coordinator SOP, handoff/config field) | — |

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
  cut-approval is told 4× (constitution, skill-coordinator stop-condition 6,
  skill-pm 7a, skill-coordinator-lite) with divergent wording; self-converge
  relaxation is told 2× (constitution §1, skill-sr-engineer) with overlapping
  qualifiers. Every copy is a future drift source — edit one, miss three.
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
