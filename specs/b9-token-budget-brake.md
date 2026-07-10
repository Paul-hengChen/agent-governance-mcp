# b9-token-budget-brake

## Problem Statement
The routing chain's cost exposure is bounded only implicitly, via count-side
caps (round caps ≤3-4 per skill-coordinator, §5 hop cap ≤10). There is no
cost-side ceiling. A process retrospective measured ~1.05M tokens burned on a
single feature across 4 visual-rework rounds with no brake tripping — the
count-side caps were never exceeded even as spend ballooned. This ships an
optional, off-by-default per-feature token budget: a workspace opts in via
`.current/.config.json`, and the coordinator — which already has read access
to per-dispatch `usage.*` telemetry in `agent-*.jsonl`
(`content/skill-coordinator.md` §Subagent Token Observability, v3.31.0) —
tracks accumulated spend for the current `/teamwork` invocation and STOPs to
the human when spend nears the configured ceiling. This is a cost-side
circuit breaker that complements, not replaces, the existing count-side caps.

## User Stories
- As a coordinator running a long visual-rework loop, I want a configurable
  token-spend ceiling, so that a runaway feature hands off to a human before
  it silently burns an outsized amount of tokens.
- As a workspace owner, I want the token budget to be opt-in and
  per-workspace, so that projects that don't care about cost exposure see
  zero behavior change.

## Acceptance Criteria
- **AC1** — Given `.current/.config.json` has no `tokenBudgetPerFeature` key
  (or the file doesn't exist), when the coordinator runs any `/teamwork*`
  session, then no budget check occurs and no new Escalation Routes row
  fires — absence = brake disabled (matches the existing `driftBaselineIds`
  absence precedent in `tools/config.ts`).
- **AC2** — Given `.current/.config.json` sets `tokenBudgetPerFeature: <positive
  number>`, when the coordinator completes a dispatch
  (`Task(subagent_type=<role>, …)`), then it adds that dispatch's
  `usage.input_tokens + usage.output_tokens + usage.cache_read_input_tokens +
  usage.cache_creation_input_tokens` (read from that dispatch's
  `agent-*.jsonl` entry) to an in-memory running total scoped to the current
  `/teamwork` invocation — never persisted to `handoff.md` or any tool
  argument, the identical scope discipline the existing hop counter already
  uses ("Hop counter scope: in-memory only ... Do NOT persist to
  `handoff.md`").
- **AC3** — Given the running total reaches or exceeds 80% of
  `tokenBudgetPerFeature`, when the coordinator would otherwise auto-hop to
  the next role, then it STOPs instead — surfaces the running total, the
  ceiling, and the percentage in one sentence, and hands to human (new
  Escalation Routes row; same halt semantics as the existing "hop counter ≥
  10" row).
- **AC4** — Given `tokenBudgetPerFeature` is present but not a positive
  finite number (string, negative, zero, `NaN`, etc.), when `loadConfig`
  parses `.current/.config.json`, then the field is treated as absent (brake
  disabled) — the same non-fatal filter-and-ignore precedent as non-string
  entries in `driftBaselineIds`.
- **AC5** — Given the brake fires, when the coordinator's next
  `tw_update_state` write happens, then it is an ordinary, unmodified
  escalation write per existing Escalation Routes semantics — the budget
  brake introduces NO new persisted field, NO `schema_version` bump, and NO
  server-side gate; it is coordinator-SOP-level and advisory only, exactly
  like the existing hop-cap row.
- **AC6** — Given a workspace has never created `.current/.config.json`, when
  `loadConfig` runs, then behavior is byte-identical to pre-feature behavior
  (regression guard on the additive-only change).

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| budget.stop-note | `token budget: {running_total} / {tokenBudgetPerFeature} ({pct}%) — handing to human` | authored-here — mirrors the existing hop-cap row's terse one-sentence surfacing style ("surface the hop cap") |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Cross-session / cross-invocation accumulation: the running total resets
  when a new `/teamwork` invocation starts (same scope as the hop counter).
  A feature reworked across multiple coordinator sessions is NOT tracked
  cumulatively in this iteration — closing that gap would require a
  persisted spend counter (a handoff schema bump) and is deferred; this is a
  known, explicit limitation, not a silently dropped requirement.
- Per-feature budget overrides (a map keyed by feature name) — MVP ships a
  single workspace-wide `tokenBudgetPerFeature` scalar applied uniformly. A
  future iteration could add a per-feature override map the same way
  `dispatch_pins` overrides per role.
- Automated / MCP-tool-based `agent-*.jsonl` parsing — stays
  skill-procedure-level per the existing Subagent Token Observability
  precedent (`visual-selfconverge` already deferred tooling; this feature
  does not reopen that decision).
- Dollar-cost conversion (token → currency via model pricing tables) — the
  budget is expressed in raw summed tokens, not currency, to avoid embedding
  pricing data that goes stale.
- Server-side enforcement — no `tw_*` tool gate; this is advisory
  coordinator-SOP text only, consistent with the backlog's own "risk if
  skipped: low" framing (round caps already bound worst-case cost).

## Dependencies / Prerequisites
- Builds on `content/skill-coordinator.md` §Subagent Token Observability
  (v3.31.0) — the four canonical `usage.*` fields this feature sums are
  already documented there; do not re-derive or rename them.
- Builds on the existing hop-counter precedent (`## Auto-Routing` section,
  "Hop counter scope: in-memory only ... Do NOT persist") — the token
  running total MUST follow the identical scope discipline.
- `tools/config.ts` `driftBaselineIds` is the direct precedent for adding an
  optional, non-schema-bumped config field with a non-fatal invalid-value
  filter (`docs/schema-versions.md` config version history notes
  `driftBaselineIds` required NO `schema_version` bump — this feature's
  `tokenBudgetPerFeature` follows that same additive-scalar precedent, not
  the handoff `dispatch_pins`-style bump).
- Resource Audit Gate: zero external references found in the backlog source
  item (`docs/backlog.md` §B9) — field omitted from `external_refs`,
  non-blocking.
- Scope Decision Gate: not armed (no `design/<feature>.md` for this
  feature); recorded here for the audit trail —
  `scope_decision: single-feature`, rationale: single config field + one
  coordinator-SOP section, no cross-cutting data model.
