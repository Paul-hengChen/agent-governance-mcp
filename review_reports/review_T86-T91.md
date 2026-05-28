# Code Review — T86–T91 (auto-routing-v3.13)

## Round 1 — APPROVED — by code-reviewer

### Summary
- 4 `content/*.md` files touched this release: `skill-coordinator.md` (new §Auto-Routing + SOP env-var pre-check), `skill-pm.md` (new Question Batch Gate step), `skill-coordinator-lite.md` (lite exemption disclaimer), `constitution.md` (§5 hop-cap pointer bullet). Zero `.ts` / production-code changes.
- The `git diff HEAD` ALSO includes the previously-PASSed v3.12 trims (T80–T85, qa-engineer PASS) because v3.12 was not committed before v3.13 began. Those edits were independently reviewed and PASSed in `review_reports/review_T80-T85.md` + `qa_reports/review_T80-T85.md`; this round's verdict scope is T86–T91 only.
- Behavioural change: `/teamwork` now self-hops between roles by default, capped at 10 hops/session, with 5 stop conditions and an `AGC_AUTO_ROUTE=0` opt-out. PM batches all upfront clarifications into one `AskUserQuestion` call.
- Build clean, 303/303 tests pass.

### Correctness
- `content/skill-coordinator.md:47-63` — Auto-Routing H2 enumerates all 5 stop conditions in order (Blocked, PASS, `next_role: human`, missing `next_role:`, hop ≥ 10). Condition #4 (missing `next_role:`) correctly catches the silent-termination edge case where a role finishes without nominating a successor — yields to human as ambiguous rather than dropping the chain. Matches architecture spec's `should_stop` predicate exactly.
- `content/skill-coordinator.md:65-72` — SOP renumbered cleanly: step 1 (env-var pre-check), step 2 (skip state sync for Q&A), step 3 (state sync otherwise), step 4 (scope gate + hop counter increment), step 5 (multi-phase auto-hop). Cross-references inside the SOP are consistent (step 2 says "go straight to step 4", which is correct after the renumber).
- `content/skill-pm.md:32-39` — Question Batch Gate inserted as step 4. Existing Resource Audit Gate (step 3) reworded to remove the inline "Ask the user per reference" prose (the ask now happens in step 4); existing Ambiguity Gate becomes step 5 with the qualifier "AFTER the Question Batch resolved what it could". Empty-batch no-op explicitly stated. Step 5's "If load-bearing requirements remain incomplete or conflicting AFTER the Question Batch..." correctly handles the case where the human's batched answers themselves introduce new ambiguity (still escalates to Blocked).
- `content/skill-coordinator-lite.md:16` — single-line disclaimer added to Hard rules block, structurally adjacent to "No code-reviewer step" (same exemption-list semantics). Lite's existing zero-state-write contract is preserved (the line is informational, not behavioural).
- `content/constitution.md:73` — new bullet added to §5 Anti-Loop Circuit Breaker; explicitly names lite as exempt, matching the lite skill's own disclaimer (two-place authoritative statement as ADR'd in the architecture spec).

### Quality
- Hop counter wording in skill-coordinator: `in-memory only, for the lifetime of one /teamwork invocation. Do NOT persist to handoff.md or any tool argument.` — clear, matches architecture spec's ADR on agent-side counter and prevents an implementer from misreading "counter" as a new `handoff.md` field.
- Naming: `AGC_AUTO_ROUTE` follows the existing `AGC_*` env-var convention (`bin/agent-governance-context.mjs` uses `AGC_DEFAULT_SKILL`). No naming drift.
- Section placement in skill-coordinator: Auto-Routing sits between Design-source detection and SOP — same architectural layering as the existing sections (concepts before procedure). Reads cleanly top-to-bottom.
- Question Batch Gate's rationale paragraph is one sentence, terse, no padding (`each mid-flow Blocked round-trip costs a human context-switch; batching upfront converts N round-trips into 1 and lets auto-routing run uninterrupted from PM onward.`) — consistent with the v3.12 token-frugality pass.
- `content/skill-coordinator.md` SOP step 4 sub-bullet says `Increment hop counter.` — clear instruction, matches the Auto-Routing section's `Increment your in-memory hop counter by 1 per successful switch.`

### Architecture
- `specs/auto-routing-v3.13-architecture.md` Interface Contracts section mandated four concrete strings/numbers: H2 name `## Auto-Routing`, env-var name `AGC_AUTO_ROUTE`, hop cap `10`, lite disclaimer one-liner, constitution §5 bullet. All five appear verbatim in their respective files.
- Sequence Diagram (5-hop happy path; QA FAIL Round 4 trips cap at hop 10) is consistent with the implemented stop conditions — the diagram-encoded edge case (QA FAIL → SR → QA → SR → QA → SR → QA → PM at hop 10) terminates exactly at the cap, validating the chosen ceiling.
- ADR table in architecture spec (5 trade-offs recorded) is the first concrete use of the v3.12 Decision Records schema — bonus dogfooding signal.
- No code-layer impact (no `.ts` change). `prompts/build.ts` consumes content files as opaque blobs, so the new H2 cannot break the prompt-build path; the green build + green tests confirm.

### Security
- `content/skill-coordinator.md` step 1 reads `AGC_AUTO_ROUTE` via `printenv` — no shell injection vector, no untrusted-input boundary (the env var is set by the user/operator at session start, not by remote data).
- No hardcoded secrets, no API keys, no auth boundary changes. Content-only release with no executable surface.
- The trim of `Constitution §7 forbids unilateral defer.` from skill-architect.md (a v3.12 carry-over) was already approved in the v3.12 review; constitution §7 itself still mandates the rule, so the gate behaviour is unchanged.

### Verdict
**APPROVED** — every v3.13 AC satisfied: Auto-Routing section + 5 stop conditions + env-var opt-out + hop cap 10 land in skill-coordinator.md; PM Question Batch Gate inserted with empty-batch no-op; lite exemption disclaimer added; constitution §5 pointer bullet added; build + tests green. ADR'd trade-offs from the architecture spec are honoured in the implementation. No security or architecture regression.
