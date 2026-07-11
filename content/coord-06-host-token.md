## Subagent Token Observability<!-- origin:start --> (v3.31.0)<!-- origin:end -->

For a retrospective or post-feature cost review, you MAY read the workspace's `agent-*.jsonl` dispatch
logs to extract per-dispatch token telemetry. The canonical cost-attribution fields are the four
`usage.*` numbers on each entry: `usage.input_tokens`, `usage.output_tokens`,
`usage.cache_read_input_tokens`, and `usage.cache_creation_input_tokens`. These four fields — NOT
`subagent_tokens` alone — are the authoritative source for cost attribution: `subagent_tokens` has an
unknown denominator (it conflates cached vs fresh input), whereas the `usage.*` breakdown from
`agent-*.jsonl` gives a precise denominator per dispatch. Read-only, skill-procedure-level: no script or
MCP tool is required to parse `agent-*.jsonl` (automated tooling is deferred). Use these fields so
future retrospectives report measured costs, not estimates.

## Token Budget Brake<!-- origin:start --> (v3.63.0, B9; durable sidecar v3.67.0, D2)<!-- origin:end -->

Opt-in, off-by-default cost-side circuit breaker that complements (not replaces) the count-side caps
(the `hop` cap, per-skill round caps). Enabled ONLY when `.current/.config.json` sets
`tokenBudgetPerFeature` to a positive finite number — an absent key, absent file, or invalid value
(filtered to absent by `loadConfig`) means the brake is disabled and NO budget check occurs.

When enabled, after each completed dispatch (`Task(subagent_type=<role>, …)`), read the durable
sidecar `.current/usage.jsonl` — populated per dispatch by the opt-in PostToolUse hook
(`bin/agent-governance-usage-hook.mjs`; wiring: README) — and compute the running total
feature-scoped: over every line whose `feature` equals the active feature, sum the four canonical
`usage.*` fields (§Subagent Token Observability above): `usage.input_tokens + usage.output_tokens +
usage.cache_read_input_tokens + usage.cache_creation_input_tokens`. **Running-total scope**:
feature-scoped and durable — the sidecar survives context loss, session kills, and new `/teamwork`
invocations of the same feature; any future coordinator instance recomputes the same total by
re-reading the file. Do NOT keep a parallel in-memory total as the source of truth, and do NOT
persist totals to `handoff.md` or any tool argument — the sidecar is the ledger. WHEN
`.current/usage.jsonl` is absent (hook not wired) → DO fall back to the pre-D2 B9 hand-sum: read
each completed dispatch's `agent-*.jsonl` entry and accumulate the same four `usage.*` fields
in-memory for the lifetime of this `/teamwork` invocation (B9 behavior preserved for un-wired
users) → ELSE the sidecar sum is authoritative.

WHEN the running total reaches or exceeds 80% of `tokenBudgetPerFeature` → DO stop instead of
auto-hopping, surfacing the running total, the ceiling, and the percentage in one sentence per the
*Token budget brake* Escalation Routes row (same halt semantics as the hop-cap row: observe/halt
only, no state write, no schema bump — advisory-only) → ELSE keep routing.

