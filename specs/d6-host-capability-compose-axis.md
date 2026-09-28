# d6-host-capability-compose-axis

## Problem Statement
`content/skill-coordinator.md` carries large Claude-Code-only sections — Task-tool
subagent dispatch (`Task(subagent_type=...)`), `agent-*.jsonl` token-telemetry
parsing, `~/.claude/agents/<role>.md` template copying, and watermark validation
via `dist/lib/watermark-check.js` — that are dead text on Cursor, Continue,
Anti-Gravity, and plain-MCP hosts: those clients fall back to `tw_switch_role`
and never touch any of that machinery. The prose that documents the graceful
fallback is itself evidence of the waste: every non-CC dispatch pays the token
cost of reading instructions for a code path it structurally cannot take. The
constitution already solved an analogous problem for the design/chain axes via
additive composition (ticket A9: `prompts/constitution-manifest.ts` tags
fragments `core`/`design`/`chain`/`chain-design` and `composeConstitution()`
includes each fragment iff its tag's predicate holds). Skills have no
equivalent axis — `buildPromptForRole()` loads the full skill file unconditionally
(`prompts/build.ts` L363, `loadContent(skillFile, ...)`). This ticket extends
the same compose-not-strip pattern to skills, gated on a new host axis, so
CC-only prose ships only when the target host can actually use it.

## User Stories
- As a Cursor/Continue/plain-MCP user, I want the coordinator (and any other
  role) skill prompt to omit Claude-Code-only dispatch/telemetry/template
  prose, so that every dispatch I pay for is prose I can act on.
- As a Claude Code user, I want the CC-specific dispatch guidance (Task-tool
  subagent dispatch, tier-pin persistence, telemetry parsing, watermark
  validation) to keep shipping exactly as today, so that the existing
  Task-tool workflow is unaffected by this change.
- As a maintainer, I want the skill-side host axis to reuse the same
  fragment-manifest + inclusion-predicate shape the constitution already
  uses (`ConstitutionSegment` / `includeSegment`), so that the codebase has
  one compose pattern, not two divergent ones.

## Acceptance Criteria
- **AC1** — Given a dispatch context in which the host is determined to have
  Task-tool capability (exact detection/declaration mechanism is an
  architect design decision — see Dependencies below), when a role skill
  (starting with `skill-coordinator.md`) is composed for that dispatch, then
  the host-tagged CC-only fragments (Task-tool dispatch section, `agent-*.jsonl`
  telemetry section, `~/.claude/agents` template-copy instruction, watermark
  validation via `dist/lib/watermark-check.js`) are included in the assembled
  skill text.
- **AC2** — Given a dispatch context in which the host is determined NOT to
  have Task-tool capability, or capability is unknown/undeclared, when the
  same skill is composed, then those host-tagged fragments are excluded, and
  the assembled skill contains no Task-tool-dispatch, `agent-*.jsonl`-telemetry,
  `~/.claude/agents`-template, or watermark-check.js prose.
- **AC3** — Given no host signal is available at all (the default/degraded
  case — e.g. a fresh workspace, or a host that never sets the signal), the
  compose predicate defaults to the SAFE side (host-tagged fragments
  excluded) — mirroring the existing safe-default precedent for the design
  axis (`isDesignFeature` defaults to `false` when `state` is null,
  `prompts/build.ts` L337-339). Backward compatibility: an unrecognized or
  absent host signal must never suppress prose that ships today to a host
  that has no way to declare its capability — see Dependencies for how the
  architect's chosen mechanism is required to satisfy this without a breaking
  default flip for existing non-CC integrations.
- **AC4** — Given the skill-manifest mechanism the architect designs, when
  implemented, it follows the existing `ConstitutionSegment`/`includeSegment`
  shape (ordered fragment list + tag + boolean predicate) rather than a
  bespoke ad hoc mechanism, so `prompts/build.ts`'s compose pipeline
  (`compose → stripOriginTags → stripRationale unless fullDetail`) needs at
  most an additional axis parameter, not a parallel pipeline.
- **AC5** — Given `content/skill-coordinator.md` is split into core +
  `host:claude-code`-tagged fragments, when every fragment is concatenated
  in manifest order under `{ host: true }` (or equivalent full-capability
  input), the result reproduces today's `skill-coordinator.md` byte-for-byte
  (golden-baseline invariant, same shape as the constitution's
  `test/fixtures/compose-golden/constitution-monolith.txt`).
- **AC6** — Given the other five skill files (`skill-sr-engineer.md`,
  `skill-pm.md`, `skill-architect.md`, `skill-researcher.md`,
  `skill-qa-engineer.md`), when the architect/sr-engineer audit them for
  CC-only prose, then each file is either (a) split using the same tagging
  if CC-only prose is found, or (b) left untouched with the audit outcome
  ("no CC-only prose found") recorded — no file is silently skipped.
- **AC7** — Given the change ships, when the full test suite runs, then all
  pre-existing tests remain green and new tests cover both host states
  (CC-capable / not-CC-capable) for every skill file actually split.

## Copy / Strings
N/A — feature has no new user-facing copy. (The fragments being re-tagged are
existing governance/skill prose being relocated, not authored; no new string
is introduced.)

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual surface |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Visual Structural Assertions
N/A — no `design/<feature>.md` exists for this feature; mode = no-design
(server-internal prose-composition change, no visual surface).

## Out of Scope
- **D10** (release-engineer must not resolve push conflicts with
  reset/rebase/clean) — explicitly out of scope for this ticket even though
  it is an adjacent open backlog item; not folded in.
- Any E-series backlog ticket.
- **Deciding the host-detection mechanism itself.** The backlog entry frames
  this as an open design question ("how the server learns the host") —
  config field the workspace/client sets vs. some form of capability
  detection/handshake (MCP has no standard capability-advertisement channel
  for "Task tool available"). That decision belongs to the architect, not
  this spec — see Dependencies.
- Retrofitting the host axis onto any prompt surface other than the skill
  files (the constitution's own core/design/chain axes are unchanged; this
  ticket adds a fourth, independent axis to skills only).
- Any change to the constitution manifest's existing four segment tags
  (`core`/`design`/`chain`/`chain-design`) — those are untouched; the host
  axis is new and skill-scoped.

## Dependencies / Prerequisites
- **Design-first, blocking.** Per human directive, this ticket's build chain
  routes through **architect** (not sr-engineer direct) before any
  implementation. The architect resolves: (a) the host-detection/declaration
  mechanism (config field vs. capability handshake vs. another approach —
  open question, not pre-decided here), (b) the safe-default behavior for
  unknown/absent host signal (AC3), (c) the exact skill-manifest shape
  extending `ConstitutionSegment`/`includeSegment` (AC4), (d) which of the
  five non-coordinator skill files actually carry CC-only prose worth
  splitting (AC6), and (e) a file-by-file diff plan sized to the task_size
  budget (splitting sr-engineer tasks further if needed, same as
  `T-D5-ARCH` did for D5).
- Scope confirmed **single-feature** (one compose-axis mechanism, ~5 files
  per the backlog estimate: `prompts/constitution-manifest.ts` pattern
  extended to skills, `prompts/build.ts`, content splits, tests) — no
  `.current/feature-split.md` needed.
- Resource Audit Gate: scanned the backlog entry and this spec's source
  material for external references (`http(s)://`, figma, sketch, mockup,
  設計圖, URL, ticket links, Azure DevOps, JIRA) — zero hits. No
  `external_refs` entries required.
- No design source (no Figma/mockup) exists for this feature — confirmed by
  human directive; all visual sections above are marked N/A per the
  explicit-absence convention rather than omitted.
- Release convention (context for the task cut, not for immediate
  execution): this ships as a single-feature commit after QA PASS, then the
  release-engineer flow — semver bump, CHANGELOG, tag, `gh release`, backlog
  done-mark, `driftBaselineIds` append, `qa_reports/` archive per the D7 SOP.
  All release-bookkeeping line items are cut to release-engineer
  (post-PASS) only, per the release-bookkeeping ownership rule (constitution
  v3.58.0/C10) — never to qa-engineer or sr-engineer.
- Prior art this ticket extends directly: `prompts/constitution-manifest.ts`
  (`CONSTITUTION_SEGMENTS`, `SegmentTag`, `includeSegment`),
  `prompts/build.ts` (`composeConstitution`, `buildPromptForRole` L304-433,
  in particular the design-arm probe at L337-339 as the precedent for a safe
  default), and `content/skill-coordinator.md` (Subagent Dispatch section
  ~L81, tier-pin persistence ~L99, fallback note ~L113, token-budget-brake
  `agent-*.jsonl` reference ~L132, watermark validation ~L199,
  retrospective/telemetry read ~L241-269).
