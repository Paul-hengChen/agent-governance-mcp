# Deep-Research Run: Process & Lessons (Retrospective)

> A walkthrough of running the `/deep-research` harness end-to-end to compare this framework against industry-mainstream agent frameworks — including how it was interrupted, resumed, rate-limited, and ultimately salvaged. Written so the *process* is reusable, not just the result.
> Date: 2026-05-31. Companion to the findings file: `research/agent-governance-framework-industry-comparison.md`.

## TL;DR

- The `/deep-research` harness produced a high-quality, adversarially-verified answer (**104 of 107 claims confirmed at high confidence**) across all five research questions.
- It cost **~1.63M tokens across 107 sub-agents** for one question — most of it in the verification phase.
- The run survived a session interruption and a rate-limit failure; the final answer was **salvaged from the run journal without spawning any new agents** by reading the cached verdicts directly.
- Net lesson: the harness is excellent for *strategic / architecture / competitive* questions, but its cost is dominated by per-claim adversarial verification (`claims × 3`). For routine lookups, use a cheaper path. (Captured as a standing preference in memory: [[deep-research-token-cost]].)

## The goal

A single research question: *how do this framework's constitution + role skills compare to mainstream agent frameworks (MetaGPT, ChatDev, AutoGen, CrewAI, LangGraph, OpenAI Agents SDK) and rules conventions (AGENTS.md, CLAUDE.md, Spec Kit, Kiro), and what should improve?* Five sub-questions, told to prioritise T1/T2 sources from the last 12-18 months.

## How the harness works (the 5 phases)

| Phase | What it does | Approx. agent count |
|---|---|---|
| **Scope** | Decompose the question into ~5 search angles | 1 |
| **Search** | One WebSearch agent per angle, in parallel | ~5 |
| **Fetch** | Dedup URLs, fetch top sources, extract falsifiable claims (each with quote + source-quality + date) | ~15 |
| **Verify** | **3-vote adversarial verification per claim** — three agents each *try to refute* the claim; needs 2/3 refutes to kill it | **~107** |
| **Synthesize** | Merge semantic dupes, rank by confidence, emit cited report | 1 |

Total this run: **188 unique cached results / 107 agents / ~1.63M tokens**. The claim base was 332 extracted claims, distilled to 175 unique on the under-verified angles plus 107 fully-verified verdicts.

## What actually happened (the messy part)

1. **Launched** as a background workflow. The session was suspended overnight before it finished.
2. **Interrupted state:** the journal showed 103 agents *started* but only 53 *returned* — search/fetch had largely completed, verify was mid-flight, synthesize never ran. No output file.
3. **Resume attempt #1 failed** — a resume must re-supply `args`; without it the script's guard threw immediately (`No research question provided`). The cache-hit mechanism is keyed on `(prompt, opts)`, *not* on args, but the script body still needs args to run. **Lesson: always pass `args` again alongside `resumeFromRunId`.**
4. **Resume attempt #2 ran** but then **failed at the verify/synthesize tail** with `agent stalled… no progress for 180000ms` and `completed without calling StructuredOutput` — the signature of **rate-limit exhaustion** (usage hit 100%), not a logic bug. The schema-bound agents couldn't make progress.
5. **Salvage (no new agents):** rather than re-run and burn tokens again, the completed work was recovered straight from the run journal. The journal stores every agent's result keyed by a content hash; parsing it yielded the scope, the search results, 70 claim-fetch payloads, and **107 verification verdicts (104 confirmed, 3 refuted)** — enough to synthesise the report by hand.

## Token-cost breakdown (where it burns)

The verify phase dominates, for two compounding reasons:

- **Fan-out = claims × 3.** Every extracted claim spawns three independent refutation agents. With ~100+ claims, that's the bulk of the 107 agents.
- **Each verify agent re-reads source material** into its own context to check the quote verbatim — so the per-agent token cost is also high, not just the agent count.

Search + fetch + scope together were only ~20 agents. **Verify was ~107.** This is also exactly where the rate-limit wall was hit.

## Lessons & recommendations

1. **Match depth to the question.** The researcher skill defaults a *standalone* call to `deep`, which auto-triggers this harness (`skill-researcher.md:13`). For lookups and feasibility sniff-tests, declare `researcher_depth: shallow` (direct web search, ≤15 min, no harness) or just run a few inline WebSearch calls.
2. **Reserve the harness for high-stakes questions** — strategy, architecture evaluation, competitive analysis — where adversarial verification earns its cost.
3. **Tune the verify fan-out if cost matters more than rigour.** 3-vote → 1-vote roughly thirds the dominant cost, at the price of confidence. Or verify only `central`-importance claims, not `supporting`/`tangential` ones.
4. **Run it as a background workflow and expect to resume.** Long runs outlive a single session window. On resume: re-pass `args`, keep the same script + `resumeFromRunId`, and unchanged agents replay from cache for free.
5. **The journal is a real safety net.** Even a failed run leaves every completed verdict on disk. A stalled/rate-limited synthesize step does *not* mean the work is lost — salvage from the journal before re-spending.
6. **Quality held up.** Despite the failure tail, 104/107 verified claims at high confidence produced a defensible report. The adversarial verification also caught real errors (e.g. it refuted an "AGENTS.md is the de-facto standard" overreach and flagged two ChatDev mischaracterisations) — that rigour is the reason to pay for `deep` when it's warranted.

## Artifacts

- **Findings:** `research/agent-governance-framework-industry-comparison.md`
- **Standing preference:** memory note [[deep-research-token-cost]] — default to the cheap path; propose `deep` only when warranted, and state the cost first.
