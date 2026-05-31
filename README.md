# 🛡️ Agent Governance MCP

> Prevents lost updates and rule drift when multiple AI coding agents (Cursor, Claude Code, Windsurf) work on the same project.

---

## 📑 Table of Contents

- [One-Line Summary](#one-line-summary)
- [Quick Guide for Non-Engineers](#quick-guide-for-non-engineers)
- [Motivation: What Problem Does It Solve?](#motivation-what-problem-does-it-solve)
- [Core Architecture: Three Layers of Defense](#core-architecture-three-layers-of-defense)
- [Technical Details](#technical-details)
- [Pros and Cons](#pros-and-cons)
- [Installation & Startup](#installation--startup)
- [Multi-Agent Workflow](#multi-agent-workflow)
- [FAQ](#faq)
- [Future Roadmap](#future-roadmap)
- [Project Structure](#project-structure)
- [Glossary](#glossary)

---

## One-Line Summary

**Agent Governance MCP** is an infrastructure layer that allows multiple AI agents/IDEs to work on the same project while **sharing state, adhering to a single source of truth for rules, and avoiding mutual overwrites.**

It is **not a code-generation tool**, but a "governance layer" for collaboration.

> Analogy: It acts as the team's PM + QA + Employee Handbook—built specifically for AI, running 24/7.

> **Positioning**: Technically an MCP server (protocol/transport), functionally a **harness** — it injects governance, shared state, and role SOPs into the agent's execution shell, not data sources or external APIs.

---

## Quick Guide for Non-Engineers

Imagine three scenarios:

- **Scenario A**: You ask Claude to write a login feature today. Tomorrow, you open Cursor to continue, but Cursor has no idea what was done or how it was implemented. It guesses, resulting in inconsistencies.
- **Scenario B**: You establish a rule: "Never read `.env` directly." But every tool (Cursor, Claude, Anti-Gravity) requires different config files. You must update rules in four places, which is error-prone.
- **Scenario C**: You have Cursor and VS Code open simultaneously. Both AIs update the project status file. **The later write silently overwrites the earlier one.** A whole task's progress is lost.

**This server solves all three scenarios with code.** It runs locally, and AIs talk to it instead of directly editing progress files. It will:
1. Memorize project progress. Regardless of which AI you use, they read the same state.
2. Centralize rules. All AIs fetch instructions from one place.
3. Prevent collisions. If two AIs write simultaneously, it queues them and prevents overwriting.

---

## Motivation: What Problem Does It Solve?

AI coding assistants have four fatal flaws when handling long-term projects:

### Pain Point 1: The Goldfish Memory — State Decoupling
- With every new session or IDE switch, the AI forgets its progress.
- What Claude modified yesterday is unknown to Cursor today.
- Result: Duplicated work, missed steps, or inconsistent implementations.

### Pain Point 2: Rule Drift
- Your rules ("No yapping", "TDD first", "Never touch .env") live in disparate config files (`.cursorrules`, `CLAUDE.md`, etc.).
- Modifying a single rule requires updating multiple files.

### Pain Point 3: Format Drift
- When AI maintains a progress file manually (`handoff.md` or `tasks.md`), it often breaks YAML syntax, messes up checkboxes, or drops fields.
- The next time you parse it, it fails, rendering the progress tracker useless.

### Pain Point 4 (The Silent Killer): Write Conflicts / Lost Updates
- Parallel sessions or multiple IDEs running concurrently.
- Both AIs read State X. They perform work and attempt to write State Y and State Z.
- **The later write overwrites the earlier write. State is silently lost.**

**Agent Governance MCP solves all four pain points via server-side hard constraints.**

---

## Core Architecture: Three Layers of Defense

This isn't just "soft prompt engineering." It employs **server-side hard constraints** that AI cannot bypass.

### Layer 1: Prompts — Auto-Injected Rules

When an MCP-compatible client calls any role prompt (`teamwork` for the Coordinator, `teamwork-lite` for the solo-dev lite mode, plus `pm`, `architect`, `researcher`, `sr-engineer`, `qa-engineer`), the server dynamically assembles:

```
content/constitution.md         ← Your "Constitution" (rules of conduct)
+ content/skill-<role>.md        ← Role-specific SOP (standard operating procedures)
+ Current handoff.md JSON state  ← Where the project is currently at
```

This is injected into the AI's context.
**In short**: The moment AI starts working, it automatically memorizes the employee handbook, workflow, and handover notes.

### Layer 2: Tools — Structured APIs (Revoking Free-Text Privileges)

The server exposes 10 MCP tools. **AI cannot edit `handoff.md` or tasks directly; it MUST use these tools:**

| Tool | Function | Why this design? |
|---|---|---|
| `tw_get_state` | Reads current project progress | **Mandatory first step**, otherwise write tools are blocked (pre-flight check) |
| `tw_update_state` | Updates handoff | Server enforces valid YAML; impossible for AI to break formatting |
| `tw_get_next_task` | Fetches next incomplete task | Returns structured data |
| `tw_add_task` | Appends a new task | Works in stdio (markdown) and HTTP/SQLite modes — no workspace filesystem needed |
| `tw_complete_task` | Changes `[ ]` to `[x]` | Safely edits markdown checkboxes atomically |
| `tw_rollback_task` | `[x]` → `[ ] (reverted: reason)` | Used when implementations fail later |
| `tw_detect_drift` | Compares handoff vs tasks | Catches synchronization issues |
| `tw_switch_role` | Loads a role's SOP into context | Coordinator calls this to auto-route complex tasks without a full prompt reload |
| `tw_index_prd` | Indexes a PRD file into RAG chunks | Embeds spec context for downstream roles (SQLite mode only); auto-triggered lazily |
| `tw_clear_prd_chunks` | Purges RAG chunks for a workspace | Ops escape hatch for manual cleanup (SQLite mode only) |

**In short**: AI works in a cleanroom. It can only report progress by pressing pre-defined buttons.

### Layer 3: Guards — Server-Side Interception

Two lines of defense enforced at the **code level**:

#### (a) Pre-Flight Check
If the AI tries to `update_state` without ever calling `tw_get_state`, it receives a `⛔ BLOCKED` error. This forces a "read-before-write" discipline.

#### (b) Cross-Process File Lock + Mtime Freshness Check
- **File Lock**: If two AIs write simultaneously, an `O_EXCL` lockfile serializes them. No torn writes.
- **Freshness Check**: If the file was modified by someone else after you read it, the server throws a `STATE DRIFT` error and demands a re-read.
- **Atomic Writes**: Writes to a `*.tmp` file, then uses POSIX `rename`. Readers only see the complete old or new version.

#### (c) QA-Flow Enforcement (v3.2.0)
The server validates every `tw_update_state` write against an
`ALLOWED_TRANSITIONS` matrix so the routing chain
`pm → architect → sr-engineer → qa-engineer` can't be bypassed. Highlights:

- **Agent-id gate**: `status=PASS` and `tw_complete_task` require
  `agent_id="qa-engineer"` (zod refinement + handler defense).
- **Transition matrix**: `(prev_last_agent, prev_status) → (new_agent,
  new_status)` must be a legal edge. Self-loops on
  `In_Progress→In_Progress` for the same agent are fast-pathed.
- **Round counter**: `qa_round` increments on `(qa-engineer, FAIL)` and
  resets on PASS or PM re-entry. Round 4 collapses the matrix to
  `{(pm, In_Progress)}` until PM resets.
- **Evidence-of-QA**: PASS requires `qa_reports/review_<id>.md` (file
  mode) or a `reports` table row (SQLite). Attach `qa_review` on the
  PASS/FAIL write and the server records evidence automatically.

Rejections return a structured envelope (`error`, `attempted`, `allowed`,
`hint`). Full design: `specs/qa-flow-enforcement-architecture.md`.

#### (d) RAG Lifecycle Automation (v3.3.0)
The server manages PRD-to-RAG indexing and garbage collection automatically:

- **Lazy auto-reindex**: When any specialist role prompt is activated,
  `appendSpecContext` checks the PRD's mtime against the stored invalidation
  key. If stale or missing, it reindexes inline (coalesced via
  `_indexingInFlight` map). Coordinator is skipped (`RAG_SKIP_ROLES`).
- **Auto-discover**: If `state.prd_path` is not set, the server probes
  `PRD.md` → `docs/PRD.md` → `specs/PRD.md` in the workspace root.
  Graceful no-op if none found.
- **PASS cleanup**: When `tw_update_state(status=PASS)` succeeds, all
  `prd_chunks` rows for that workspace are deleted. In-flight reindexing
  is awaited first to prevent INSERT-after-DELETE races.
- **Tombstone sweep**: On first RAG operation per process, workspaces
  whose directories no longer exist on disk have their chunks purged.
- **Manual tool**: `tw_clear_prd_chunks(workspace_path)` for ops.

Full design: `specs/rag-lifecycle-automation.md`.

#### (e) Schema Versioning & Lazy Migration (v3.4.0)
All four persisted artifacts carry a `schema_version` and are upgraded
transparently on the next read — no manual migration step:

- **Handoff YAML**: `schema_version` in frontmatter (`handoff.md`).
- **`tasks.md`**: sentinel comment line carries the version.
- **SQLite**: `PRAGMA user_version` plus an additive `schema_version` row.
- **`.config.json`**: top-level `schema_version` field.

Migration runners live under `schema/migrations-*.ts`, keyed by `from → to`.
`tw_detect_drift` also reports schema-version skew across artifacts. See
`docs/schema-versions.md` for the upgrade-authoring checklist.

#### (f) External-reference Policy (constitution v3.5.3, 2026-05-20)
The constitution and PM/architect SOPs now enforce a three-way classification
of every external reference in a PRD (URL, Figma/Sketch mockup, ticket ID,
"see XYZ" prose):

- **PM Resource Audit Gate** (`skill-pm` SOP step 3): PM greps every supplied
  requirement doc for `http(s)://`, `figma`, `sketch`, `mockup`, `設計圖`,
  `URL`, `link`, `Azure DevOps`, `JIRA` and asks the user `fetch / index /
  ignore` per hit. The decision lands in the spec's *Dependencies /
  Prerequisites* section before the spec is finalized.
- **Architect Sanity Gate** (`skill-architect` SOP step 4 + new
  `Deferred Resources` H2): architect cross-checks every PM-deferred
  reference against the spec; any spec reference missing from `Deferred
  Resources` blocks the handoff back to PM.
- **Constitutional backstop** (§7 *External-reference policy*): no role may
  unilaterally treat an external reference as out-of-scope.

Closed the failure mode where a Figma URL linked seven times in a PRD shipped
without ever being fetched (`cde-oobe`, 2026-05-20).

#### (g) `design-auditor` role + design-source detection (v3.8.0, 2026-05-21)
A source-agnostic optional pre-PM role that closes the *"design was
never read"* gap for UI-bearing work:

- **Coordinator Design-source detection** (`skill-coordinator` new
  section): every incoming PRD / ticket / user prompt is scanned for
  host patterns (`figma.com`, `sketch.cloud`, `xd.adobe.com`,
  `penpot.app`, `marvelapp`, `invisionapp`, `framer`), file extensions
  (`.fig`, `.sketch`, `.xd`, `.penpot`, plus mockup-context `.pdf` /
  `.png` / `.jpg`), and EN / 中文 / 日本語 design keywords (`mockup`,
  `wireframe`, `設計稿`, `モックアップ`). On hit, the coordinator
  routes to `design-auditor` *before* PM. On miss, the auditor's
  skill is never loaded — zero per-prompt cost.
- **`design-auditor` extracts** `design/<feature>.md` with verbatim
  *Copy / Strings* (text) and *Visual Tokens* (hex / sp / dp /
  weight / radius literals) tables. Mode-aware: prefers the matching
  MCP tool when available (Figma MCP, etc.) and falls back to
  `authored-here` annotations for OCR / paper / whiteboard sources.
- **PM consumes** the audit verbatim — `skill-pm` SOP step 2 copies
  the auditor's tables straight into the spec, eliminating the
  paraphrase failure mode (`"Select your language"` instead of
  Figma-canonical `"Language"`).
- **No new MCP tools** — the role reuses the existing `tw_*` surface
  and adds three `ALLOWED_TRANSITIONS` edges
  (`null/researcher/pm → design-auditor`, `design-auditor → pm`).

#### (h) `design-auditor` multi-pass + Source manifest (v3.8.1, 2026-05-26)
Closes the *"frames silently dropped"* coverage gap surfaced by
`research/pixel-perfect-and-design-coverage.md`:

- **Exhaustive *Source manifest***: the auditor now lists **every**
  surface in the design source (Figma frame / Sketch artboard / XD
  artboard / Penpot board / PDF page / image file), each tagged
  `status: audited | deferred | out-of-scope` with a one-line reason.
  Surfaces no longer disappear into *Out of Scope* by omission.
- **Multi-pass audit**: when a design cannot fit in one ≤ 250-line
  pass, the auditor may run additional passes (hard ceiling: 5 per
  feature, constitution §5 anti-loop). Each follow-up pass MUST flip
  ≥ 1 `deferred` row to `audited` — no-op passes are forbidden.
- **PM Deferred-surface gate**: `skill-pm` SOP step 2 now requires
  that any `status: deferred` manifest rows be enumerated under the
  spec's *Dependencies / Prerequisites* section, so downstream roles
  know which surfaces ship without coverage.
- **Backwards-compatible**: pre-Phase-1 `design/<feature>.md` files
  without the new status column are treated as `audited` for what
  they list and `unknown` for the rest — no retroactive migration.
- **Source-agnostic**: the manifest applies to all auditor modes,
  not Figma-specific.

#### (i) QA Phase 1.5 — Visual Compare (v3.8.2, 2026-05-26)
Closes Phase 2 of `research/pixel-perfect-and-design-coverage.md` —
the non-literal visual-drift gap that v3.8.1's Source manifest /
multi-pass did not address:

- **Auditor *Visual Baselines* schema** (OPTIONAL) — auditor MAY
  append a `## Visual Baselines` H2 to `design/<feature>.md` with
  `surface id | baseline path | impl path | notes`. Source-agnostic:
  any image format the design source produces is accepted.
- **QA Phase 1.5 sub-phase** — inserted between Phase 1
  (Copy / Visual Audit Gates) and Phase 2 (Discussion). For each
  baseline row, QA Reads both PNGs into multimodal context and emits
  a structured diff (layout / spacing / alignment / element presence
  / color / text / image content) into `qa_reports/review_<id>.md`.
- **Skip-if-absent gating** — non-UI features (server logic, CLI,
  this MCP repo) declare no `Visual Baselines` and Phase 1.5 silently
  no-ops. Zero overhead.
- **Three failure routes**: visual drift → sr-engineer; missing
  baseline file → design-auditor; missing impl screenshot →
  sr-engineer.
- **SOP-only delivery** — no new `tw_*` tool, no TS changes. Vision
  capability is provided by the QA agent's host LLM (Claude / Gemini
  / GPT-class); the Figma REST API is NOT a runtime dependency.

#### (j) `qa-visual` sub-skill split (v3.8.3, 2026-05-26)
Token-efficiency follow-up to v3.8.2 — the qa-engineer skill grew to
2.17K tokens (27% larger than the next-biggest skill) because Phase 1.5
Visual Compare was inlined. Now the visual sub-phase lives in its own
file and is Read on demand:

- **`content/skill-qa-visual.md`** carries the verbatim v3.8.2 Phase 1.5
  SOP (gate / 6 diff categories / 3 failure routes / PASS sub-verdict
  / rationale).
- **`skill-qa-engineer.md` SOP step 4** is now a 3-line lazy-load hook
  that Reads `content/skill-qa-visual.md` *only* when
  `design/<feature>.md` declares a `## Visual Baselines` H2.
- **Token impact** — non-UI workspaces (server logic, CLI, this MCP
  repo) save ~300 input tokens per qa-engineer load forever. UI
  workspaces pay roughly the v3.8.2 total: the Read brings the
  sub-skill into context exactly when needed.
- **Backwards-compatible** — Phase 1.5 contract is unchanged. Same
  skip-if-absent gating, same diff categories, same failure routes,
  same PASS sub-verdict. v3.8.2 `design/<feature>.md` files keep
  working without migration.
- **SOP-only delivery** — no new `tw_*` tool, no `prompts/build.ts`
  change, no transitions edit. Pure markdown reorganisation.

#### (k) Code-reviewer role split (v3.9.0, 2026-05-28)
Writer/reviewer separation is now structural. The
`sr-engineer → qa-engineer` direct edge is replaced with
`sr-engineer ↔ code-reviewer → qa-engineer`. Industry research
(2025–2026) treats this as a requirement — a model "too close" to code
it wrote rationalises its own logic; a clean-context reviewer with no
access to the writer's reasoning notes is the only structural fix.

- **`content/skill-code-reviewer.md`** — new role SOP. Reads only the
  diff vs base, the PM spec, and the architect handoff. Produces
  `review_reports/review_<task-id>.md` with Summary / Correctness /
  Quality / Architecture / Security / Verdict (`APPROVED` or
  `CHANGES_REQUESTED`).
- **`review_round` counter** symmetric to `qa_round`. 3 FAILs allowed;
  Round 4 forces escalation to `(pm, In_Progress)`.
- **PASS stays qa-only** — code-reviewer approval is signalled via
  `(code-reviewer, In_Progress) → (qa-engineer, In_Progress)` handoff
  with `review: APPROVED` in `pending_notes` plus a
  `review_reports/<id>.md` evidence file (file mode) or
  `code_review_reports` row (SQLite). The transition is rejected when
  evidence is missing.
- **QA scope narrowed** — failing tests / missing coverage /
  test-infra only. Style and architecture concerns are code-reviewer's
  domain.
- **`teamwork-lite` is unaffected** — solo-dev same-context work where
  a reviewer gate is structurally meaningless. Lite stays
  server-read-only as before.
- **Breaking** — in-flight `sr-engineer:In_Progress` tickets at the
  v3.8.3 → v3.9.0 boundary must be manually re-routed to code-reviewer
  (or rolled back to pm). The old direct edge is rejected. A
  one-shot stderr warning fires on first parse when this state is
  detected.
- Spec: `specs/code-reviewer-role-extraction.md`. Architecture:
  `specs/code-reviewer-role-extraction-architecture.md`. Research:
  `research/reviewer-role-extraction.md`.

#### (l) QA test coverage for the code-reviewer chain (v3.9.1, 2026-05-28)
Patch follow-up to v3.9.0. No runtime / wire-protocol changes — adds
the test suite that proves the v3.9.0 chain mutation is correct, and
revises pre-existing v3.8.3-era contract tests that AC-2's edge
removal made structurally obsolete.

- **33 new tests** across `test/qa-flow.test.mjs` and the new
  `test/handoff-migration.test.mjs`. Every new `code-reviewer:*` edge
  accepts; the removed `sr→qa` direct edge rejects with the new
  allowed-list naming code-reviewer; `REVIEW_ROUND_EXCEEDED` cap
  symmetric to `qa_round`; `computeNewRound` review_round semantics
  (FAIL increments, APPROVED handoff resets only when `prev` was
  `(code-reviewer, In_Progress)`, PM resets both counters); evidence
  round-trip + path sanitisation; AC-8 verbatim hint reachability in
  compiled `dist/index.js`; AC-9 stderr migration warning fires on
  `sr-engineer:In_Progress` and is silent for any other tuple or on
  already-v2 files.
- **26 obsoleted-contract tests revised in-place**, not deleted. The
  v3.9.0 AC-12(f) "additive only" wording was structurally impossible
  alongside AC-2's edge removal; this release ships the resolution
  with rationale documented inline at each touched assertion. Files:
  `schema-versions.test.mjs`, `handoff-versioning.test.mjs`,
  `sqlite-versioning.test.mjs`, `qa-flow.test.mjs`,
  `qa-visual-skill-split.test.mjs`, `drift-skew.test.mjs`.
- Consumers pinned at `#v3.9.0` keep working unchanged. Recommended
  upgrade target if you run `npm test` against the shipped checkout.

#### (m) Conditional test writing (constitution v3.10.0, 2026-05-28)
SOP refinement, no runtime change. Constitution §2 adds a
**Conditional test writing** clause for qa-engineer:

- If existing test files already cover the current task's scope,
  qa-engineer writes or modifies tests in those files as usual.
- If NO relevant test file exists for the current task,
  qa-engineer MUST ask the user before creating any new test file.
  Do not assume — solo / doc-only / spec-only tasks often need no test.
- `content/skill-qa-engineer.md` Phase 3 SOP gains a new step
  `3a. Test File Discovery` ahead of the spec-to-test map. When the
  user declines, Phase 3 is skipped, the review doc logs the skip,
  and the flow proceeds to Phase 4.

MINOR bump (qa-engineer behavior observably changes). Tooling,
transition matrix, schema versions, and wire protocol are unchanged.
Research basis: `research/architecture-and-skills-evaluation-v3.9.md`.

#### (n) Skill evolution — side-channel doc-writer + release-engineer (v3.11.0, 2026-05-28)
Two new **side-channel roles** (skill files + prompts + `tw_switch_role` — NOT
in `ALLOWED_TRANSITIONS`, no schema bump) plus four existing-skill
strengthenings and a constitution §6 amendment:

- **`doc-writer`** — staff-level technical writer. Keeps `README.md`,
  `CHANGELOG.md`, and `docs/**` in sync after QA PASS. Fact-preservation
  hard rule; reads code + CHANGELOG only; side-channel `agent_id` constraint.
- **`release-engineer`** — staff-level release engineer. Owns post-PASS
  version bumps, `CHANGELOG.md`, `npm run build`, `git tag -a`, and
  `gh release create`. PASS precondition; major-bump opt-in; immutable tags;
  HEREDOC commit messages; `scripts/check-version.mjs` gate.
- **`skill-researcher.md`** — new `Depth` clause (`shallow` ≤ 15 min /
  `deep` ≤ 60 min), `Source Credibility Tier` (T1/T2/T3), `Recency Gate`
  (sources > 18 months tagged `(stale)`).
- **`skill-coordinator-lite.md`** — new `Scope-creep examples` with 3
  concrete escalation cases + 1 affirmative lite case.
- **`skill-code-reviewer.md`** — new `Performance` section (O(n²) loops,
  unbatched I/O, memory leaks). Review schema: 6 → 7 sections.
- **Constitution §6** — new `Dependency audit at build gate` bullet.

MINOR bump. `#v3.10.0` consumers keep working unchanged.

#### (o) Skill polish + token-frugality audit (v3.12.0, 2026-05-28)
Content-only release; no `.ts` / wire-protocol change. Outcomes:

- **`skill-architect.md`** — new `## Decision Records` H2 (`Context | Decision | Consequences` table). One row per non-trivial trade-off; empty section renders `_No non-trivial trade-offs in this artifact._`. Trivial decisions excluded by rule.
- **Token-frugality audit** (`research/token-frugality-audit-v3.12.md`) — exhaustive per-file pass against the constitution §1 *Skills inherit everything below — they MUST NOT restate these rules* contract.
- **Subtractive trims** to 8 skill files: removed restated `§3 drift-check` tails, the restated `§4 routing chain` block in `skill-coordinator.md`, redundant cde-oobe incident narrative in `skill-qa-engineer.md`.
- **Security coverage verified**: constitution §6 already covers the v3.9 evaluation's two flagged gaps (OWASP-level guidance lives at the sr-engineer + code-reviewer role checklists; dependency audit shipped in v3.10). No §6 edits required.
- Total reduction: 580 → 576 lines (line-level); character-level reduction is materially larger (within-line compressions across 8 files). The audit's *Aggregate* section documents the honest ceiling.

PATCH-level content change. Awaiting release-engineer bump from `v3.11.0`.

#### (r) Researcher × `/deep-research` integration (v3.16.0, 2026-05-30)
MINOR release wiring the `researcher` role to the Claude Code `/deep-research` skill. At `deep` depth the researcher invokes `/deep-research` to gather a multi-source, cited report before distilling into the Findings Schema; a standalone invocation (no `researcher_depth:` declared in `pending_notes`) now defaults to `deep`, so a bare `researcher` call auto-runs the harness.

**Backwards-compatible**: the routed `shallow` path is unchanged and explicitly does NOT invoke `/deep-research`. Prompt-layer guidance only — the server still enforces routing/state, not skill invocation — and it degrades gracefully to manual web search when `/deep-research` is unavailable.

- **`content/skill-researcher.md` SOP step 2** — depth-aware: at `deep` invoke `/deep-research` → distil into Findings Schema, fallback to manual search; at `shallow` skip the harness (cost-frugal).
- **Standalone default depth = `deep`** — new Depth Hard-rule bullet so undeclared invocations auto-run the harness.
- **Tests** — `test/researcher-deep-research.test.mjs`, 5 content-assertion tests (AC-1..AC-5) incl. end-to-end via `buildResearcherPrompt`. Suite **403/403 passing**.
- **Prompt-layer only** — no `tools/` / `prompts/` / `schema/` change; `dist/` is byte-identical.

Spec: `specs/researcher-deep-research-integration.md`.

#### (s) Always-on context-budget reduction (v3.16.2, 2026-05-31)
PATCH release trimming the always-on token cost. The constitution's chain-only sections (§3.1 Server-enforced chain, §4 Routing Chain) are fenced with `<!-- chain-only:start/end -->` and stripped from **lite contexts only** — the SessionStart hook's default lite bootstrap and the `teamwork-lite` prompt, neither of which enters the role-to-role chain. Chain roles still receive the full, unmodified constitution, so no enforced rule is lost.

**Measured**: default always-on bundle ~2837 → ~1961 approx tokens/session (−31%). Single source of truth (one fenced `constitution.md`); no dual-file drift.

- **`scripts/measure-context-cost.mjs`** — deterministic (chars/4) baseline tool: per-artifact token table + pre/post-strip lite total.
- **`prompts/build.ts`** — exported `stripChainOnly()`; lite skill → stripped, chain roles → full.
- **`bin/agent-governance-context.mjs`** — strips for the lite SessionStart variant (regex kept in sync with `build.ts` by an equivalence test).
- **Tests** — `test/context-budget.test.mjs`; suite **414/414 passing**.
- Also corrects `test/researcher-deep-research.test.mjs` to the v3.16.1 shallow-default contract (standalone `researcher` defaults to `shallow`; `deep` is opt-in and warns on token cost — superseding the v3.16.0 default-deep behavior noted in (r) above).

Spec: `specs/context-budget-reduction.md`.

#### (t) Dependency-security fix — protobufjs + qs (v3.16.3, 2026-05-31)
PATCH release clearing the `npm audit` advisories waived in v3.16.2. Adds `package.json` `overrides` pinning the two vulnerable transitive dependencies to their first patched releases — `npm audit` goes from 5 advisories (1 critical, 3 high, 1 moderate) to **0**.

- **`protobufjs: ^7.5.8`** (resolved 7.6.2) — clears the critical RCE (GHSA-xq3m-2v4x-88gg) + high/moderate advisories reaching the tree via the optional embedding dep `@xenova/transformers` → `onnxruntime-web` → `onnx-proto`.
- **`qs: ^6.15.2`** — clears the moderate DoS (GHSA-q8mj-m7cp-5q26) via the MCP SDK's `express` → `qs` chain.
- **Runtime-verified**: the protobufjs 6 → 7 major bump (past `onnx-proto`'s declared `^6.8.8`) was confirmed by exercising the RAG embedding path — still produces a 384-dim vector; `tools/rag.ts` unchanged.
- **`test/dependency-overrides.test.mjs`** — pin-regression guard. Suite **417/417**.

Spec: `specs/dependency-security-protobufjs.md`.

#### (q) Pixel-Perfect Framework Fixes — Visual Widgets + visual_round (v3.14.0, 2026-05-29)
MINOR release closing the pixel-perfect framework gap uncovered by `research/why-pixel-perfect-missed.md`. Adds a third independent feedback loop (`visual_round`) to the routing chain alongside `qa_round` (v3.2.0) and `review_round` (v3.9.0), a server-side PASS-evidence gate for visual diff reports, and new schema sections distributed across four role SOPs.

**Backwards-compatible**: workspaces without `design/<feature>.md` (server logic, CLI, this MCP repo itself) pay zero overhead and see no behaviour change. The new gates fire only when a feature declares `## Visual Baselines` in its design file.

- **Constitution §1 Visual Widgets exception** — when a widget is listed in a spec's `## Visual Widgets` section, substituting an HTML primitive (e.g. `<input type="date">` for a column-scroller picker) is now **scope violation**, NOT MVP compliance.
- **Constitution §3.1 visual evidence gate** — server rejects `(qa-engineer, PASS)` with `VISUAL_EVIDENCE_MISSING` if `design/<feature>.md` declares `## Visual Baselines` but `qa_reports/visual_<task-id>.md` is absent for any completed task id.
- **Constitution §3.1 `visual_round` sub-loop** — cap at 5 rounds; Round 6 locks to `(pm, In_Progress)` only. Increments only on `(qa-engineer, FAIL)` with `visual_fail:` in `pending_notes` — pure test-logic FAILs leave the counter untouched.
- **Split escalation (R4a)** — at `visual_round >= 3`, sr-engineer may transition `(sr-engineer → pm, In_Progress)` with `pending_notes` containing `visual_split_requested:`. Early escape hatch instead of grinding to threshold renegotiation.
- **`skill-pm.md` § Visual Widgets schema bullet** — new required H2 section listing non-primitive controls (column-scroller, virtual keyboard, custom segmented, scrollbar, stepper, accordion, slider, toggle). Mandatory `N/A | — | …` row when no widgets.
- **`skill-design-auditor.md` § Visual Widgets extraction** — 8-row widget-shape heuristics table + "verify with PM" uncertainty tag. Auditor is the upstream owner; PM copies the table verbatim.
- **`skill-architect.md` § Visual Harness Artifact Schema** — MANDATORY when `design/<feature>.md` has Visual Baselines. Specifies test runner, viewport list, diff library + threshold, CI command, font pinning. New Gate 4a blocks back to PM when the spec lacks a `[P0] Build visual-diff harness` task.
- **`skill-sr-engineer.md` § Phase 0.5 Design-Aware Pre-Flight** — new SOP step 3a between Task-Size Check and Implement. Mandates reading `design/<active_feature>.md` end-to-end + Visual Widgets row + baseline paths BEFORE any file edit.
- **`skill-qa-engineer.md` Phase 1.5 PASS-gated** — escape clause "Phase 1.5 deferred" REMOVED. The server now backs the gate.
- **`skill-qa-visual.md` Widget Shape Checklist** — new Step A precedes pixel diff. Per-row checkbox against spec `## Visual Widgets`; unchecked → "widget shape miss" (shape FAIL precedes pixel diff, gates Step B). Output file renamed `qa_reports/review_<id>.md` → `qa_reports/visual_<id>.md` (the server PASS-gate target).
- **Handoff schema v2 → v3** — new `visual_round` field. Lazy-migrates on first read (identical mechanism to v3.9.0 v1→v2). SQLite mode adds the column via `ALTER TABLE` (no sqlite schema_version bump).
- **Tests** — 4 new files + 8 migrated = **353/353 passing**.

Root-cause analysis: `research/why-pixel-perfect-missed.md`. Spec + architecture: `specs/pixel-perfect-fixes-v3.14.md` + `specs/pixel-perfect-fixes-v3.14-architecture.md`.

#### (p) Auto-Routing in /teamwork + PM Question Batch Gate (v3.13.0, 2026-05-28)
Content-only release; no `.ts` / wire-protocol change. Removes the per-hop human handoff in `/teamwork` while preserving every existing HITL checkpoint.

- **`skill-coordinator.md` § Auto-Routing** — default-ON in `/teamwork` (lite mode explicitly exempt). After each role's handoff, the coordinator self-calls `tw_switch_role(<next_role>)` based on `pending_notes.next_role`. Five stop conditions yield to the human:
  1. `status: Blocked`
  2. `status: PASS` (terminal success — release-engineer is a deliberate human decision)
  3. `pending_notes` contains `next_role: human`
  4. `pending_notes` lacks any `next_role:` line (silent termination — surface as ambiguous)
  5. Hop counter ≥ **10** per `/teamwork` session
- **Hop counter** — agent-side in-memory, scoped to one `/teamwork` invocation. Not persisted to `handoff.md`, not a new schema field, zero server change.
- **Opt-out** — `AGC_AUTO_ROUTE=0` at session start restores the pre-v3.13 manual-routing behaviour (the coordinator surfaces the `next_role:` recommendation and waits).
- **`skill-pm.md` § Question Batch Gate** — new SOP step (step 4) that consolidates every human clarification PM would have asked mid-flow (Resource Audit `fetch/index/ignore` decisions + Ambiguity Gate triggers) into ONE upfront `AskUserQuestion` call covering ≤ 4 questions (split into 2 batches if more). Empty-batch = no-op. Records answers inline in the spec's *Dependencies / Prerequisites* section. Trade-off: converts N mid-chain Blocked round-trips into 1 upfront round-trip; the auto-routing chain then runs uninterrupted from PM onward.
- **`skill-coordinator-lite.md`** — explicit `No auto-routing` Hard rule (lite stays single-shot).
- **Constitution §5** — new bullet referencing the hop cap and naming lite as exempt.

MINOR bump candidate. Awaiting release-engineer bump from `v3.11.0` (can bundle with v3.12.0 polish as a single MINOR cut — recommended).

#### (q) Token-Efficiency (v3.4.0)
Two write-side optimisations stop the governance layer from inflating
per-turn context:

- **Drift response compression** (`tools/drift.ts:compressDriftDetails`)
  collapses repeated drift entries and caps response payload.
- **`pending_notes` truncation** (`tools/handoff.ts`) enforces a character
  budget on `pending_notes` returned by `readState()`; oldest entries are
  dropped first, and truncation metadata is attached so callers see what
  was trimmed.

---

## Technical Details

### Language / Runtime
- **TypeScript** compiled to ES2022, strict typing.
- **Node.js** ESM modules.
- Output lives in `dist/` and is committed for immediate remote execution via `npx`.

### Dependencies
- `@modelcontextprotocol/sdk`: MCP server framework
- `zod` v4: Runtime validation
- `js-yaml`: Safe YAML frontmatter read/write
- `better-sqlite3`: SQLite storage adapter for HTTP/remote mode

### Communication
- **Stdio transport** (default): Communicates via standard input/output. Zero network ports, zero config, highly secure.
- **HTTP transport** (`--port <n> [--db <path>]`): Streamable HTTP at `/mcp`, SQLite-backed state, `GET /healthz` for liveness probes.
  - `TW_AUTH_TOKEN` — required Bearer token (set this whenever the port is reachable beyond localhost; a loud warning is logged if unset).
  - `TW_ALLOWED_ORIGINS` — comma-separated Origin allowlist (DNS-rebinding defense). Empty list = allow any.

### Methodology-Agnostic
The server defaults to a generic markdown checkbox format, but handles customization via workspace overrides:
- **Task format override**: Place `<workspace>/.current/.config.json` with `taskPattern` (regex) and `taskPaths`.
- **Constitution/Skill override**: Place `<workspace>/.current/constitution.md` to override the default rules.
- **Vibe coding mode**: If no task lists exist, the tools fail gracefully, but the prompt injection and handoff state still function perfectly.

### State Format Example (`handoff.md`)
The progress state is stored as a human-readable file with YAML frontmatter. This allows AI to easily parse it, and humans to easily read it.
```markdown
---
active_feature: Implement user login page
status: In_Progress
completed_tasks:
  - 'T01 src/auth.ts: Setup JWT validation'
pending_notes:
  - 'T02 blocked: Waiting for UI team to provide login button SVGs'
---

# Project State
Do not edit this file manually. Use the provided tools.
```

---

## Pros and Cons

### ✅ Pros
1. **Zero-Config Startup**: Run directly via `npx github:...#v3.13.0` (version-pinned). No *manual* clone or install — first invocation auto-downloads dependencies (~30-60s), subsequent runs are instant from the npx cache.
2. **Single Source of Truth**: Change rules in one place; all AI clients obey instantly.
3. **True Cross-Tool Consistency**: Works with Claude, Cursor, Anti-Gravity, Gemini, Cline, etc.
4. **Data Integrity**: Cross-process file locks + mtime checks genuinely prevent write conflicts.
5. **Human Readable**: State is saved as plain text markdown, not a black-box DB.
6. **Fails Loudly**: Clean Zod errors, explicit STATE DRIFT warnings.
7. **Ultra-lightweight Context (Caveman-style)**: Tool descriptions are heavily compressed to save LLM prompt tokens and reduce context window bloat, maximizing the tokens available for your actual code.
8. **Lite Mode for Solo Work (v3.6.0+)**: `/teamwork-lite` skips the multi-role chain, drift checks, and role switching for daily 1-file edits — ~80% per-task token savings while keeping the constitution as a single source of truth.

### ❌ Limitations
- **Cannot Force AI Rule Compliance**: The constitution is injected, but AI can still hallucinate or ignore it (inherent LLM limitation).
- **Cannot Force Tool Usage**: AI *could* bypass MCP and use `fs.write` directly. `tw_detect_drift` catches this on the *next* session, not at write time.
- **Self-Declared Identity**: `agent_id` is a self-reported string. The gate blocks empty/misspelled ids but cannot stop deliberate impersonation.
- **Opt-In Hook**: The SessionStart hook is a silent no-op unless the workspace contains `.current/`, `tasks.md`, or `TODO.md`.
- **No Cross-Machine Sync**: File locks are local-fs only. Remote team sync requires HTTP mode + SQLite, or Git-committed `.current/`.

---

## Installation & Startup

**Requirements**: Node.js 18+. Check with `node --version` — older versions emit cryptic ESM errors that look like server bugs. Stdio mode has zero native dependencies; HTTP mode optionally pulls in `better-sqlite3` (needs Python + a C++ toolchain on first install).

> ⏱️ **First `npx` invocation downloads ~30-60s of dependencies.** This is *not* a hang — subsequent runs are instant from the npx cache.

### TL;DR (Claude Code, 3 steps)

```bash
# 1. Register the MCP server (writes to ~/.claude.json)
claude mcp add -s user agent-governance-mcp -- npx -y github:Paul-hengChen/agent-governance-mcp#v3.16.3

# 2. Mark the current workspace as agent-governance-managed (REQUIRED for the hook in step 3)
#    Either scaffold via the bundled CLI...
npx -y --package=github:Paul-hengChen/agent-governance-mcp#v3.16.3 agc init
#    ...or just create the directory manually:
# mkdir -p .current

# 3. Add the SessionStart hook to ~/.claude/settings.json (full JSON in Step 3 below)
```

Then run `claude mcp list` — should show `✓ Connected`. Full step-by-step below.

### Step 1: Configure your MCP Client

Every client below points at the same command: `npx -y github:Paul-hengChen/agent-governance-mcp#v3.16.3`. Pick the section that matches your tool.

#### Claude Code (CLI) — writes to `~/.claude.json`

> ⚠️ **Do NOT add `mcpServers` to `~/.claude/settings.json`** — Claude Code CLI ignores that key (that's Claude Desktop's format). Use the CLI command:

```bash
claude mcp add -s user agent-governance-mcp -- npx -y github:Paul-hengChen/agent-governance-mcp#v3.16.3
claude mcp list
# agent-governance-mcp: npx -y github:Paul-hengChen/agent-governance-mcp#v3.16.3 - ✓ Connected
```

#### Most other clients — same JSON, different file

The following clients all accept this exact `mcpServers` JSON block:

```json
{
  "mcpServers": {
    "agent-governance-mcp": {
      "command": "npx",
      "args": ["-y", "github:Paul-hengChen/agent-governance-mcp#v3.16.3"]
    }
  }
}
```

Paste it into whichever file matches your tool, then restart the client:

| Client | Config file |
|---|---|
| Claude Desktop¹ | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows) |
| Cursor² | `~/.cursor/mcp.json` (global) or `<project>/.cursor/mcp.json` (per-project) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Cline (VS Code) | `cline_mcp_settings.json` (open via `Cline: Open MCP Settings`) |
| Gemini CLI / Code Assist | `~/.gemini/settings.json` |

¹ Claude Desktop does **not** support the SessionStart hook (Step 3); invoke roles via the prompt picker instead.
² Verify via Settings → Features → MCP (server should show ✓).

#### Clients with a different config shape

**Continue (VS Code / JetBrains)** — `~/.continue/config.yaml` (YAML, not JSON):
```yaml
mcpServers:
  - name: agent-governance-mcp
    command: npx
    args:
      - "-y"
      - "github:Paul-hengChen/agent-governance-mcp#v3.16.3"
```

**Zed** — `~/.config/zed/settings.json` (uses `context_servers`, not `mcpServers`):
```json
{
  "context_servers": {
    "agent-governance-mcp": {
      "command": {
        "path": "npx",
        "args": ["-y", "github:Paul-hengChen/agent-governance-mcp#v3.16.3"]
      }
    }
  }
}
```

**Google Antigravity**: open the in-app MCP Server settings UI and add a new entry — command `npx`, args `-y github:Paul-hengChen/agent-governance-mcp#v3.16.3`. (Underlying config file is platform-dependent.)

### Step 2: Enable Agent Governance in a Workspace (⚠️ Required before the hook works)

The SessionStart hook (Step 3) is a **silent no-op** unless the workspace contains **any of**: `.current/`, `tasks.md`, or `TODO.md`. This is by design — keeps unrelated projects clean. Skip this step and the hook from Step 3 will look broken.

```bash
mkdir -p .current
```

*Optional:* also create a `tasks.md` with markdown checkboxes (`- [ ] T01 …`).

### Step 3: (Claude Code only) Configure SessionStart Hook — edit `~/.claude/settings.json`

Auto-injects the constitution + Coordinator SOP + handoff state into every Claude Code session. **Finish Step 2 first**, or this hook will appear to do nothing.

The hook helper is exposed as a `bin` entry, so use `npx` directly — no fragile `~/.npm/_npx/<hash>/…` paths required.

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "npx -y -p github:Paul-hengChen/agent-governance-mcp#v3.16.3 agent-governance-context",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

> `timeout` is in seconds. **60 leaves headroom for the first cold-start `npx` install (~30-60s)**; cached runs return instantly. Setting this too low (e.g. 10) is the #1 cause of "hook silently does nothing" on first install.

> Other MCP clients (Claude Desktop, Cursor, Continue, etc.) don't have a SessionStart hook concept. For them, the constitution is loaded when you invoke a role prompt (Step 5) — that's expected.

### Step 4: Verify Installation

```bash
# 1. MCP server is registered and reachable
claude mcp list
# → agent-governance-mcp: ... - ✓ Connected

# 2. SessionStart hook helper works
#    IMPORTANT: cd into a workspace with .current/ first — outside a managed
#    workspace the helper exits silently with NO output (by design).
cd <your-project-with-.current>
npx -y -p github:Paul-hengChen/agent-governance-mcp#v3.16.3 agent-governance-context
# → emits a JSON blob containing "additionalContext" with the constitution
```

If the second command above produces no output, you're either not inside a workspace with `.current/`/`tasks.md`/`TODO.md` (re-do **Step 2**), or the npx download itself failed (check `node --version ≥ 18`, network, then `npx clear-npx-cache` and retry).

Finally, open Claude Code in that workspace — you should see the constitution banner injected on session start.

**Troubleshooting**: hook silently doing nothing? Check, in order:
1. One of `.current/`, `tasks.md`, `TODO.md` exists at workspace root (Step 2).
2. `timeout` in `~/.claude/settings.json` is ≥ 60.
3. You restarted the Claude Code session after editing `settings.json`.
4. `claude mcp list` shows `✓ Connected` — if not, the MCP server itself isn't reachable.

### Step 5: Invoke Roles Manually

In **Claude Code**, MCP prompts are exposed as namespaced slash commands:
- `/mcp__agent-governance-mcp__teamwork` — Coordinator (auto-routes to specialists)
- `/mcp__agent-governance-mcp__teamwork-lite` — Coordinator (lite): solo-dev direct execution, no chain
- `/mcp__agent-governance-mcp__pm` — write specs, break down tasks
- `/mcp__agent-governance-mcp__architect` — system design, interface contracts
- `/mcp__agent-governance-mcp__researcher` — deep tech research
- `/mcp__agent-governance-mcp__sr-engineer` — implement / fix / refactor
- `/mcp__agent-governance-mcp__qa-engineer` — review, write tests, rollback

> Want shorter aliases like `/teamwork`? Create `~/.claude/commands/teamwork.md` (or per-project `.claude/commands/teamwork.md`) containing a single line that invokes the namespaced command. Claude Code's own slash commands take precedence over MCP prompts of the same name.

**Lite vs full coordinator.** `teamwork-lite` skips drift checks, role switching, and the multi-role chain — appropriate for solo daily work (1-file edits, doc tweaks, Q&A, one-liner fixes). It is read-only from the server's perspective: it cannot call `tw_update_state` / `tw_complete_task` / other state writers (no valid `agent_id` in the routing chain). Use `teamwork` (full) for cross-module work, anything that should be tracked in `tasks.md` / `handoff.md`, or anything you want an independent QA pass on. Install command and config are unchanged — same `npx` tag covers both.

In **other clients**, use the in-app prompt picker (Claude Desktop), `@`-mention syntax (Cursor's MCP prompt menu), or your client's documented MCP-prompt invocation. The prompt names themselves (`teamwork`, `teamwork-lite`, `pm`, `architect`, `researcher`, `sr-engineer`, `qa-engineer`) are stable across clients.

### Step 6: (Optional) HTTP / Remote Mode

Stdio mode is the default and recommended for solo / single-machine use. For shared remote state (e.g. a team server), run HTTP mode:

```bash
# Local
npx -y github:Paul-hengChen/agent-governance-mcp#v3.16.3 --port 3000 --db ./agc.db
# Liveness probe
curl http://localhost:3000/healthz
```

**Required env vars** (whenever the port is reachable beyond `localhost`):
- `TW_AUTH_TOKEN` — Bearer token clients must send (server logs a loud warning if unset).
- `TW_ALLOWED_ORIGINS` — comma-separated `Origin` allowlist (DNS-rebinding defense; empty = allow any).

```bash
TW_AUTH_TOKEN=hunter2 TW_ALLOWED_ORIGINS=https://app.example.com \
  npx -y github:Paul-hengChen/agent-governance-mcp#v3.16.3 --port 3000
```

**Docker**:
```bash
docker build -t agent-governance-mcp .
docker run --rm -p 3000:3000 \
  -e TW_AUTH_TOKEN=hunter2 \
  -e TW_ALLOWED_ORIGINS=https://app.example.com \
  -v $(pwd)/data:/app/data \
  agent-governance-mcp --db /app/data/agc.db
```

> HTTP mode requires `better-sqlite3` (a native module needing Python + C++ toolchain on first install). It's an `optionalDependency` — stdio users on machines without build tools are unaffected.

---

## Multi-Agent Workflow

Every user message goes through the same routing pipeline. The diagram below shows both the session boot sequence and per-message decision flow.

### Full Routing Flowchart

```mermaid
flowchart TD
    USER([👤 User types a message]) --> HOOK

    subgraph BOOT ["🚀 Session Start — fires once per session"]
        HOOK[SessionStart hook detected\n.current/ or tasks.md present?] -- Yes --> INJECT[Inject into context:\nconstitution + coordinator SOP\n+ current handoff.md state]
        HOOK -- No --> NOOP[Silent no-op\nnormal Claude session]
    end

    INJECT --> COORD
    NOOP --> COORD

    subgraph ROUTING ["🎯 Coordinator — every message"]
        COORD{Classify intent\nfrom message}
    end

    COORD -- "research · investigate\ncompare · feasibility" --> RES
    COORD -- "design source detected\n(Figma · Sketch · XD · 設計稿 · …)" --> DA
    COORD -- "plan · spec · create tasks\nbreak down" --> PM
    COORD -- "design · architecture\ninterface contract" --> ARCH
    COORD -- "implement · fix\nrefactor · add feature" --> ENG
    COORD -- "test · verify\nvalidate · rollback" --> QA
    COORD -- "Q&A · single-file edit\nstatus check" --> DIRECT["Execute directly\n≤ 15 words reply\nno state sync needed"]

    subgraph PIPELINE ["🔄 Specialist Roles — each follows its own SOP"]
        RES["🔍 researcher\n① tw_get_state → tw_detect_drift\n② web search / file reads\n③ distil → write research/＊.md\n④ tw_update_state"]

        DA["🎨 design-auditor  (optional — when design source detected)\n① tw_get_state → tw_detect_drift\n② detect mode (figma / sketch / xd / pdf / paper / no-design)\n③ extract verbatim → write design/＊.md\n   · Copy / Strings table\n   · Visual Tokens table\n④ tw_update_state → pm"]

        PM["📋 pm\n① tw_get_state → tw_detect_drift\n② if design/＊.md exists — copy Copy / Visual tables verbatim\n③ ambiguity gate — stop if unclear\n④ write specs/＊.md  ← enforced schema\n⑤ append tasks.md  ← priority + depends_on\n⑥ tw_update_state"]

        ARCH["🏗️ architect  (optional — complex features)\n① tw_get_state → tw_detect_drift\n② read specs/＊.md\n③ write specs/＊-architecture.md\n   file list · data structs · interface contracts\n④ tw_update_state"]

        ENG["⚙️ sr-engineer\n① tw_get_state → tw_detect_drift\n② clarification gate — block if ambiguous\n③ task-size check — block if > 5 files / 300 lines\n④ modify files\n⑤ tsc / mypy / cargo check — ZERO errors\n⑥ security checklist  ← OWASP basics\n⑦ tw_update_state → code-reviewer"]

        CR["👀 code-reviewer\n① tw_get_state → tw_detect_drift\n② read modified files\n③ write review_reports/review_＊.md\n④ tw_update_state (status=In_Progress)\n   · approved → qa-engineer\n   · rejected → sr-engineer"]

        QA["🧪 qa-engineer\n① tw_get_state → tw_detect_drift\n② Phase 1 — review code (if needed)\n③ Phase 2 — 3-round discussion\n④ Phase 3 — write tests (conditional)\n   · spec-to-AC mapping\n   · ≥ 80% coverage gate\n   · security smoke tests\n⑤ Phase 4 — run + CI runnability check\n⑥ tw_complete_task / tw_rollback_task\n   tw_update_state"]
    end

    subgraph SIDE_CHANNELS ["🔧 Side-Channel Roles (post-PASS)"]
        DW["✍️ doc-writer\n① verify PASS state\n② update README / CHANGELOG / docs\n③ tw_update_state (impersonates caller)"]
        RE["🚀 release-engineer\n① verify PASS state\n② bump version / tag / build\n③ tw_update_state (impersonates caller)"]
    end

    DA --> PM
    PM --> ARCH
    ARCH --> ENG
    ENG --> CR
    CR -- "❌ rejected" --> ENG
    CR -- "✅ approved" --> QA
    
    QA -- "✅ PASS" --> DONE(["handoff.md\nstatus = PASS"])
    QA -- "❌ FAIL" --> ROLL["tw_rollback_task\ntask checkbox reverted"]
    ROLL --> ENG
    
    DONE -. "manual /tw_switch_role" .-> DW
    DONE -. "manual /tw_switch_role" .-> RE

    style BOOT fill:#e3f2fd,stroke:#1976D2,color:#000
    style ROUTING fill:#fff8e1,stroke:#F57F17,color:#000
    style PIPELINE fill:#f3e5f5,stroke:#7B1FA2,color:#000
    style SIDE_CHANNELS fill:#e8f5e9,stroke:#388E3C,color:#000
```
### Typical Multi-Phase Feature Flow

```
User: "add dark mode"
  └─▶ pm        → specs/dark-mode.md + tasks.md (T01–T04)
       └─▶ architect  → specs/dark-mode-architecture.md
            └─▶ sr-engineer  → implements T01–T04, build PASS
                 └─▶ code-reviewer → reviews, approves
                      └─▶ qa-engineer → reviews, writes tests, PASS
                           └─▶ handoff.md: status = PASS ✅
```

### Automated Per-Write Pipeline (v3.2.0)

Every `tw_update_state` call goes through a 9-step server-side pipeline
*before* `.current/handoff.md` (or the SQLite row) is touched. This is what
makes the routing chain non-bypassable rather than advisory.

```
caller: tw_update_state({ agent_id, status, completed_tasks, qa_review?, pending_notes })
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│ ① Pre-Flight Check (guards/session.ts)                          │
│    hasReadState(workspace)? ─ no → ⛔ BLOCKED                    │
├─────────────────────────────────────────────────────────────────┤
│ ② File Lock (guards/file-lock.ts)                               │
│    O_EXCL on .current/handoff.md.lock + stale-PID detection      │
├─────────────────────────────────────────────────────────────────┤
│ ③ Freshness Check                                                │
│    file mode: current mtime == snapshot mtime?                   │
│    SQLite mode: SNAPSHOT_KEY token unchanged?                    │
│    drift → ⛔ STATE DRIFT (caller must re-read)                  │
├─────────────────────────────────────────────────────────────────┤
│ ④ validateTransition() (tools/transitions.ts)                   │
│    (prev_agent, prev_status) → (next_agent, next_status)         │
│    must appear in ALLOWED_TRANSITIONS, OR qualify for the        │
│    same-agent In_Progress→In_Progress self-loop fast path.       │
│    reject → { error, attempted, allowed, hint }                  │
├─────────────────────────────────────────────────────────────────┤
│ ⑤ Round-Cap Override                                             │
│    if prev_qa_round ≥ 4 → matrix collapses to {(pm, In_Progress)}│
│    forces PM re-entry; everything else rejected                  │
├─────────────────────────────────────────────────────────────────┤
│ ⑥ Agent-ID Gate (PASS path + tw_complete_task)                  │
│    agent_id == "qa-engineer"? ─ no → ⛔ BLOCKED                  │
├─────────────────────────────────────────────────────────────────┤
│ ⑦ Evidence-of-QA (PASS path)                                     │
│    every id in completed_tasks must have                         │
│    qa_reports/review_<id>.md (file mode) or `reports` row        │
│    qa_review attachment recorded atomically                      │
├─────────────────────────────────────────────────────────────────┤
│ ⑧ computeNewRound()                                              │
│    (qa-engineer, FAIL) → prev + 1                                │
│    (qa-engineer, PASS) | (pm, In_Progress) → 0                   │
│    else → unchanged                                              │
├─────────────────────────────────────────────────────────────────┤
│ ⑨ Atomic Write                                                   │
│    tmp file + fs.renameSync → refreshSnapshotFor                 │
│    next same-session write won't self-trip freshness check       │
└─────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                                  handoff state updated
```

---

## FAQ

**Q: Why use `npx github:...` instead of `npm install`?**
A: Zero config. Your team doesn't need to clone or install anything. The install command pins a specific tag (`#v3.13.0`) so upstream breaking changes can't silently affect your sessions — see the next question for how to upgrade.

**Q: How do I upgrade, or pin to a different version?**
A: Replace `#v3.13.0` in the install command with another tag or `#main` to track the bleeding edge. After changing it, clear the npx cache: `npx clear-npx-cache`. The CHANGELOG records breaking changes per version.

**Q: I modified `content/constitution.md` but the client didn't update?**
A: Start a new session. Also, clear the npx cache: `npx clear-npx-cache` (or `rm -rf ~/.npm/_npx` on older npm 9 and below).

**Q: Why does it work even if `.current/handoff.md` doesn't exist?**
A: It supports cold starts. `tw_get_state` returns `{exists: false}`, prompting the AI to initialize it via `tw_update_state`.

**Q: How about cross-machine team collaboration?**
A: Stdio mode locks are local-only. For remote collaboration, use **HTTP mode** (`--port <n>`) with SQLite storage (Phase 6+). Alternatively, commit `.current/handoff.md` to Git for async sync.

**Q: Does this conflict with `.cursorrules` or `CLAUDE.md`?**
A: No, they are complementary. The MCP Server acts as the source of truth, while your IDE rules act as a fallback.

---

## Future Roadmap

| Phase | Content | Status |
|---|---|---|
| 1 | 3-layer architecture, 6 tools, `sr-engineer` prompt | ✅ Done |
| 2 | Zod validation, safe YAML, file locks, SessionStart hook | ✅ Done |
| 2.5 | Configurable task paths/patterns, workspace overrides | ✅ Done |
| 3 | Multi-Agent Ecosystem (Researcher, PM, QA) | ✅ Done |
| 3.5 | Per-role watermark as chat sign-off line | ✅ Done |
| 3.6 | Architect role + skill enhancements (spec schema, BDD AC, security checklist, coverage gate, persona backstory) | ✅ Done |
| 4 | Schema versioning — lazy auto-migrate-on-read across handoff YAML, tasks.md, SQLite, `.config.json` | ✅ Done |
| 5a | Unit + integration test suite | ✅ Done |
| 5b | GitHub Actions CI | ✅ Done |
| 6 | SSE / HTTP transport, SQLite storage, Docker deployment | ✅ Done |
| 6.1 | HTTP-mode Bearer auth + Origin allowlist + `/healthz` | ✅ Done |
| 7 | Task ops lifted into storage adapter — HTTP/SQLite mode no longer needs a mounted workspace; new `tw_add_task` tool | ✅ Done |
| 8 | QA-flow enforcement (v3.2.0): `ALLOWED_TRANSITIONS` matrix, `agent_id="qa-engineer"` gate, `qa_round` counter, evidence-of-QA | ✅ Done |
| 9 | RAG lifecycle automation (v3.3.0): lazy auto-reindex in `appendSpecContext`, `prd_path` in handoff state, PASS cleanup GC, tombstone sweep, `tw_clear_prd_chunks` tool | ✅ Done |
| 9.1 | Token-efficiency improvements — drift response compression + `pending_notes` truncation to reduce per-turn context bloat | ✅ Done |
| 9.2 | Constitution v3.5.3 — External-reference policy + PM Resource Audit Gate + architect Deferred Resources / Sanity Gate (v3.7.2) | ✅ Done |
| 9.3 | PM Copy / Strings spec H2 + QA Copy Audit Gate (v3.7.3) | ✅ Done |
| 9.4 | PM Visual Tokens spec H2 + QA Visual Audit Gate (v3.7.4) | ✅ Done |
| 9.5 | `design-auditor` role + coordinator design-source detection (v3.8.0) — source-agnostic pre-PM role extracting Copy / Visual tables from Figma / Sketch / XD / Penpot / PDF / image / paper | ✅ Done |
| 10 | CI/CD hook — auto-update handoff on PR merge | Planning |

---

## Project Structure

```
agent-governance-mcp/
├── index.ts                       # MCP server entry point (prompts/tools/dispatcher)
├── tools/                         # tw_* tool implementations
│   ├── handoff.ts                 #   read/write .current/handoff.md (+ pending_notes truncation, v3.4.0)
│   ├── tasks.ts / tasks-file.ts   #   task ops (delegator + file backend)
│   ├── drift.ts                   #   tw_detect_drift (+ drift compression, v3.4.0)
│   ├── role.ts                    #   tw_switch_role
│   ├── transitions.ts             #   ALLOWED_TRANSITIONS state machine (v3.2.0)
│   ├── evidence-file.ts           #   QA evidence write/check (v3.2.0)
│   ├── rag.ts                     #   PRD chunking + embeddings (v3.3.0)
│   ├── rag-coalesce.ts            #   shared _indexingInFlight registry (v3.3.0)
│   ├── storage.ts / storage-sqlite.ts  # storage interface + SQLite adapter
│   └── config.ts                  #   .current/.config.json loader
├── schema/                        # schema_version constants + migration runners (v3.4.0)
│   ├── versions.ts                #   current versions + registries
│   └── migrations-{handoff,tasks,sqlite,config}.ts  # lazy migrate-on-read
├── transport/                     # HTTP transport (Streamable HTTP + auth/origin guard)
├── guards/                        # session.ts (pre-flight), file-lock.ts (O_EXCL)
├── prompts/                       # teamwork (= coordinator), pm, architect, researcher, design-auditor (v3.8.0), sr-engineer, qa-engineer, doc-writer, release-engineer (v3.11.0)
├── content/                       # constitution.md + skill-<role>.md (9 roles incl. design-auditor, doc-writer, release-engineer)
├── specs/                         # design docs (qa-flow, rag-lifecycle, schema-versioning, etc.)
├── docs/schema-versions.md        # how to ship a new schema version (v3.4.0)
├── bin/agent-governance-context.mjs       # SessionStart hook helper
├── test/                          # unit + integration tests
├── dist/                          # compiled JS (committed for npx execution)
├── CLAUDE.md                      # guide for Claude Code (this repo dogfoods itself)
└── .antigravityrules              # guide for Anti-Gravity
```

---

## Glossary

| Term | Definition |
|---|---|
| **MCP (Model Context Protocol)** | Open standard by Anthropic enabling AI agents to interact with external tools and data. |
| **MCP Server** | An application (like this one) implementing the MCP protocol. |
| **MCP Client** | The AI tool (Cursor, Claude, Anti-Gravity) connecting to the server. |
| **Tool / Prompt** | Interfaces exposed by the server. Tools are callable functions; Prompts are context templates. |
| **Stdio transport** | Communication via standard input/output (no network ports). |
| **handoff.md** | The "handover" file detailing project state and blockers. |
| **Race condition** | Timing issue when multiple processes access the same resource simultaneously. |
| **`ALLOWED_TRANSITIONS`** | Server-side state machine that validates every `(prev_agent, prev_status) → (next_agent, next_status)` write — the routing chain is non-bypassable (v3.2.0). |
| **`qa_round`** | Counter persisted in handoff that increments on `(qa-engineer, FAIL)` and resets on PASS or PM re-entry; round 4 forces PM re-entry (v3.2.0). |
| **Evidence-of-QA** | PASS path requires a `qa_reports/review_<task-id>.md` file (file mode) or `reports` table row (SQLite) for every completed task (v3.2.0). |
| **`prd_chunks`** | SQLite table holding PRD-derived RAG embeddings; GC'd on PASS and via tombstone sweep (v3.3.0). |
| **`schema_version`** | Version field stamped on each persisted artifact (handoff YAML, tasks.md sentinel, SQLite `PRAGMA user_version`, `.config.json`); enables lazy migrate-on-read (v3.4.0). |

---

## License & Author

- Author: Paul Chen ([@Paul-hengChen](https://github.com/Paul-hengChen))
- License: ISC
- Repo: <https://github.com/Paul-hengChen/agent-governance-mcp>
