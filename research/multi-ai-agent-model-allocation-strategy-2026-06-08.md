# Multi-AI-Agent Model Allocation Strategy

> Date: 2026-06-08
> Scope: model and role allocation guidance for `agent-governance-mcp`.
> Summary: Gemini gathers and compresses truth, Claude builds, Codex judges.

## Executive Summary

The current allocation idea is directionally right:

- Research and search: Gemini
- Development and coding: Claude
- Code review, testing, and QA gates: Codex

The recommended improvement is to make the routing rule based on failure modes, not vendor identity. The most important governance principle is:

> The model that builds should not be the final authority that declares PASS.

For `agent-governance-mcp`, this means the system should preserve builder/judge separation even when a single model looks strong enough to do both. The architecture becomes more reliable when each model family is used for its strongest role and its bias is checked by another model family.

## Recommended Mental Model

Use this operating rule:

```text
Gemini gathers and compresses truth.
Claude builds.
Codex judges.
```

This gives each provider a clear place in the workflow:

- Gemini is the information engine: research, search, long-context synthesis, external-source compression, design/source extraction.
- Claude is the builder: implementation, refactor, UI composition, codebase edits, iterative debugging.
- Codex is the verifier: code review, QA, test execution, gate validation, release sanity checks.

## Role Allocation Table

| AGC role | Primary recommendation | Fallback / escalation | Rationale |
|---|---|---|---|
| `researcher` | Gemini 3.1 Pro Preview for deep research; Gemini 3.5 Flash or 3.1 Flash-Lite for shallow research | Gemini 2.5 Pro only as conservative fallback; Codex/GPT research model if OpenAI source-specific or API-specific | Gemini has long context and search grounding, useful for current multi-source research. |
| `design-auditor` | Gemini 3.1 Pro Preview | Gemini 2.5 Pro if preview access is unavailable; Claude Opus or Codex vision-capable model for adversarial verification | Design extraction benefits from long context, multimodal input, and structured source synthesis. |
| `pm` | Gemini 3.1 Pro Preview when input is large; Claude Sonnet when converting into executable engineering tasks | Codex for final feasibility check | PM work needs both broad synthesis and implementation realism. |
| `architect` | Claude Sonnet by default | Claude Opus or Codex high-reasoning for high-risk architecture | Architecture must stay close to implementation constraints. Claude is strong at coherent engineering plans. |
| `sr-engineer` | Claude Sonnet | Claude Opus for large refactors or high-risk UI; Codex as second engineer if Claude stalls | Claude Code is well-suited for terminal coding, file edits, and iterative implementation. |
| `code-reviewer` | Codex / GPT-5-Codex | Claude Sonnet if Codex wrote the code | Review should be clean-context and independent from the builder. |
| `qa-engineer` | Codex | Claude only if Codex was the builder and independent judging is preserved | QA needs command execution, test interpretation, evidence discipline, and gate validation. |
| `qa-visual` | Gemini 3.1 Pro Preview, GPT/Codex vision-capable top model, or Claude Opus | Must be independent from `sr-engineer` | Visual verdicts are judgment work. The builder must not self-certify visual PASS. |
| `doc-writer` | Gemini 3.5 Flash / 3.1 Flash-Lite, Claude Haiku, or GPT mini | Any low-cost model | Documentation, changelog, and summarization do not need the top model unless the source is huge. |
| `release-engineer` | Low-cost model with strict checklist | Codex final sanity check for important releases | Release work is mostly mechanical but high blast-radius when staging/version/tagging fails. |

## Provider-Level Strengths

### Gemini

Best used for:

- Long-context source ingestion
- Web and document research
- Grounded summaries with citations
- Large design/source extraction
- Cross-document comparison

Gemini 3.1 Pro is the preferred high-end recommendation when preview access is acceptable. Google's Gemini API documentation lists Gemini 3.1 Pro as an advanced-intelligence preview model for complex problem solving and agentic/coding workflows, while the Gemini 3 guide states Gemini 3 models support a 1 million token input context window, up to 64k output tokens, Google Search, File Search, Code Execution, URL Context, and Function Calling. Gemini 2.5 Pro remains a conservative fallback when preview-model availability, pricing, or stability is a concern.

Use Gemini when the core risk is missing or misreading external truth.

### Claude

Best used for:

- Main implementation
- Refactoring
- UI composition
- Debugging in a repo
- Turning spec/architecture into code

Claude Code is an agentic coding tool that runs in the terminal and can plan, edit files, and verify work. Claude's Sonnet tier is usually the best default for implementation because it balances quality and cost; Opus should be reserved for high-risk work.

Use Claude when the core risk is turning a plan into working code.

### Codex

Best used for:

- Code review
- Test writing and execution
- QA evidence validation
- Release sanity checks
- Schema and gate enforcement
- Independent verification of Claude-built code

OpenAI documents GPT-5-Codex as optimized for agentic coding tasks in Codex-like environments. Codex is also positioned around production coding workflows, code review, debugging, and controlled codebase changes.

Use Codex when the core risk is shipping a regression, missing a test, or accepting weak evidence.

## Separation Of Duties

The allocation should enforce these rules:

1. Builder cannot be final judge.
2. Researcher cannot be the only source of engineering feasibility.
3. Coordinator cannot define acceptance criteria for QA or visual PASS.
4. If subagent/model limits collapse roles into one context, high-risk work should stop as `Blocked` instead of self-certifying PASS.
5. The final PASS path should always be owned by the QA role and backed by evidence.

This is more important than choosing the single strongest model. Independent disagreement catches more failures than self-review.

## Cost Control Strategy

Use model tiers by risk:

| Risk level | Example tasks | Suggested tier |
|---|---|---|
| Low | docs, changelog, release notes, task summaries | Gemini 3.5 Flash / 3.1 Flash-Lite / Claude Haiku / GPT mini |
| Medium | ordinary feature implementation, focused review, test writing | Claude Sonnet / Codex standard |
| High | architecture, large refactor, security, visual fidelity, cross-system design | Gemini 3.1 Pro Preview / Claude Opus / Codex high reasoning |

Default policy:

- Start cheap for summarization and mechanical work.
- Use mid-tier models for normal implementation and QA.
- Escalate only when the blast radius, ambiguity, or failure cost is high.

## Suggested AGC Routing Defaults

Recommended defaults for `recommended_model` or equivalent routing metadata:

```yaml
researcher:
  shallow: gemini-3.5-flash or gemini-3.1-flash-lite
  deep: gemini-3.1-pro-preview
  fallback: gemini-2.5-pro

design-auditor:
  default: gemini-3.1-pro-preview
  fallback: gemini-2.5-pro

pm:
  large_context: gemini-3.1-pro-preview
  executable_spec: claude-sonnet

architect:
  default: claude-sonnet
  high_risk: claude-opus
  adversarial_review: codex-high

sr-engineer:
  default: claude-sonnet
  high_risk_refactor: claude-opus

code-reviewer:
  default: gpt-5-codex
  if_codex_built: claude-sonnet

qa-engineer:
  default: codex

qa-visual:
  default: gemini-3.1-pro-preview
  alternative: vision-capable codex/gpt or claude-opus

doc-writer:
  default: low-cost summarization model

release-engineer:
  default: low-cost checklist model
  final_sanity_check: codex
```

Exact model IDs should stay configurable because provider catalogs, preview status, pricing, and account availability change frequently. Use `gemini-3.1-pro-preview` when the workflow accepts preview-model risk; use `gemini-2.5-pro` only as a stable/conservative fallback.

## Workflow Examples

### Standard Feature

1. Gemini researches and summarizes requirements.
2. Claude writes implementation.
3. Codex performs clean-context code review.
4. Codex runs QA and tests.
5. Low-cost release engineer stages release.
6. Codex performs final sanity check if release blast radius is high.

### Design-Backed UI Feature

1. Gemini audits design source and extracts layout, states, baselines, and structural assertions.
2. Claude implements UI and performs scoped render self-checks.
3. Codex reviews code diff and verifies tests.
4. Independent visual judge compares canonical states and structural assertions.
5. Codex QA validates visual evidence and server gates before PASS.

### High-Risk Refactor

1. Gemini summarizes existing architecture and risk areas.
2. Claude Opus or Sonnet implements in constrained batches.
3. Codex reviews each batch independently.
4. Codex writes targeted regression tests.
5. Release requires final sanity check plus version/build verification.

## Recommendations For `agent-governance-mcp`

1. Encode provider defaults as advisory routing metadata, not hard requirements.
2. Add a "builder_model" and "judge_model" note to handoff or reports for high-risk tasks.
3. Make builder/judge separation a first-class rule in Constitution or role SOPs.
4. Add model-escalation triggers: large context, high-risk refactor, visual-backed UI, security-sensitive change, repeated QA failure.
5. Track model/cost usage per role so teams can see whether Full mode was worth it.
6. Keep Lite mode available for low-risk work so governance does not become the bottleneck.

## Source Notes

- Gemini model catalog: https://ai.google.dev/gemini-api/docs/models
- Gemini 3 guide, context limits, tools, and preview details: https://ai.google.dev/gemini-api/docs/gemini-3
- Gemini 3.1 Pro announcement: https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/
- Gemini Search grounding and citation metadata: https://ai.google.dev/gemini-api/docs/google-search
- Claude Code setup and terminal coding workflow: https://code.claude.com/docs/en/getting-started
- Claude Code CLI model selection: https://docs.anthropic.com/en/docs/claude-code/cli-usage
- GPT-5-Codex model description: https://developers.openai.com/api/docs/models/gpt-5-codex
- Codex production coding and review use cases: https://developers.openai.com/codex/explore/

## Final Position

The proposed Gemini + Claude + Codex split is strong. The main refinement is to formalize it as a governance strategy:

- Gemini owns external truth and context compression.
- Claude owns construction.
- Codex owns independent judgment.

This split should improve both individual and team productivity, especially for long-running, multi-role, design-backed, or release-sensitive work. The value comes less from any single model being best and more from making different models check each other's blind spots.
