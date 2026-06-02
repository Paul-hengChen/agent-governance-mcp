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
