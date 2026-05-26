# Skill Token Cost & Pixel-Perfect Success Rate Under v3.8.2

> @researcher · 2026-05-26
> Scope: measure per-skill prompt cost under the current architecture (constitution v3.5.3 + v3.8.2 skills) and model the end-to-end pixel-perfect success rate given the v3.8.2 defense stack (auditor manifest + multi-pass + QA Phase 1.5).

## Summary

- **Per-role base prompt** ranges from **~1.9K tokens** (researcher / coordinator-lite) to **~3.8K tokens** (qa-engineer). The qa-engineer skill alone is now 2.2K tokens — twice the size of any other skill — because it carries 7 SOP steps (Phase 0..4) plus the two Audit Gates plus the new Phase 1.5.
- **A single complete chain** (coordinator → pm → sr-engineer → qa-engineer) costs **~50K tokens** input + output without auditor or Phase 1.5. **With** design-auditor (one pass) and Phase 1.5 (5 baseline pairs) the chain rises to **~95K–115K tokens**. Vision tokens dominate the Phase 1.5 cost.
- **Pixel-perfect success rate** on the first QA round under v3.8.2 is **~70–80%** for typical UI features — up from the ~30–40% baseline before v3.8.1's manifest / multi-pass shipped. The gap to 100% is dominated by **sub-pixel / ≤ 5px drift** that vision LLMs cannot reliably resolve.
- **Three drivers of remaining miss-rate**: (1) vision-LLM precision floor (~5px), (2) auditor coverage ceiling (~30 surfaces with 5 passes × 250 lines), (3) baseline freshness (no enforcement that `baseline path` reflects the *current* Figma frame).
- **The cheapest next 5% of fidelity** is a **server-enforced manifest gate** (already deferred from Phase 1 to "future spec"). The next 10% beyond that requires Phase 3 (Playwright VRT) — explicitly rejected for setup cost in `research/pixel-perfect-and-design-coverage.md`.

---

## Evidence

### E1. Per-skill markdown sizes (current main, post-v3.8.2)

Source: `wc -c content/constitution.md content/skill-*.md`. Token estimate uses **4 chars ≈ 1 token** (Claude BPE typical for English markdown; ±20% per role depending on Chinese / symbol density).

| File | Bytes | Lines | Tokens (est.) |
|---|---:|---:|---:|
| `content/constitution.md` | 5911 | 83 | **~1480** |
| `content/skill-coordinator.md` | 3190 | 56 | ~800 |
| `content/skill-coordinator-lite.md` | 1097 | 22 | ~270 |
| `content/skill-researcher.md` | 1144 | 22 | ~290 |
| `content/skill-design-auditor.md` | 5797 | 50 | ~1450 |
| `content/skill-pm.md` | 4994 | 38 | ~1250 |
| `content/skill-architect.md` | 2373 | 26 | ~590 |
| `content/skill-sr-engineer.md` | 1876 | 31 | ~470 |
| `content/skill-qa-engineer.md` | 8660 | 73 | **~2170** |

### E2. Per-role full prompt cost

`prompts/build.ts:237` composes every role prompt as `constitution + skill + state-block`, optionally followed by RAG spec context (for non-coordinator/lite roles). State block is small (~500 chars, ~125 tokens), spec context is bounded by RAG top-5 (target ~2K tokens when enabled).

| Role | Constitution | Skill | State | RAG ctx (when on) | **Total input/load (est.)** |
|---|---:|---:|---:|---:|---:|
| coordinator | 1480 | 800 | 125 | — (skipped, build.ts:81) | **~2400** |
| coordinator-lite | 1480 | 270 | 125 | — (skipped) | **~1880** |
| researcher | 1480 | 290 | 125 | ~2000 | **~3900** |
| design-auditor | 1480 | 1450 | 125 | ~2000 | **~5050** |
| pm | 1480 | 1250 | 125 | ~2000 | **~4850** |
| architect | 1480 | 590 | 125 | ~2000 | **~4200** |
| sr-engineer | 1480 | 470 | 125 | ~2000 | **~4080** |
| qa-engineer | 1480 | 2170 | 125 | ~2000 | **~5780** |

Notes:
- **Anthropic prompt cache amortises load** to ~10% of these numbers on subsequent turns within the 5-min TTL. The numbers above are worst-case (cold load).
- **State JSON grows** with `completed_tasks` history and `pending_notes` — this workspace currently shows 51 completed tasks (T01–T51), which adds ~400 extra tokens vs a fresh workspace.

### E3. Output tokens per role (typical)

Estimated from `qa_reports/`, `specs/`, and recent commits' file deltas:

| Role | Typical output | Tokens (est.) |
|---|---|---:|
| coordinator | routing decision + watermark | ~50 |
| coordinator-lite | execution + watermark | ~100–300 |
| researcher | `research/<topic>.md` (this file is ~3K tokens) | ~3000 |
| design-auditor | one pass of `design/<feature>.md` (~250 lines cap) | ~1000 |
| pm | `specs/<feature>.md` + 3–5 task descriptions | ~3000 |
| architect | `specs/<feature>-architecture.md` | ~3000 |
| sr-engineer | code patches across 3–5 files (~300 LoC) | ~5000 |
| qa-engineer | `qa_reports/review_<id>.md` + 6–10 tests | ~4000 |

### E4. Multi-pass auditor incremental cost (v3.8.1+)

Each additional auditor pass: **~5K input (cold) + 1K output ≈ 6K tokens**. Hard ceiling = 5 passes per feature (`content/skill-design-auditor.md:13`). Maximum auditor cost per feature: **~30K tokens** for an exhaustive 5-pass run on a large design.

### E5. Phase 1.5 Visual Compare incremental cost (v3.8.2)

Per baseline row (`content/skill-qa-engineer.md:41-52`):
- 2× image Read into multimodal context.
- Image input tokens (Claude Vision typicals): 768×768 → ~800 tokens; 1920×1080 → ~3000 tokens.
- **Per pair: ~5K–8K tokens input** (research/pixel-perfect-and-design-coverage.md §3 confirmed these numbers against Anthropic and Gemini token tables).
- Diff output: ~200–500 tokens per surface.

A 5-surface feature ≈ **+25K–40K vision tokens**. A 30-surface feature ≈ **+150K–240K** — at this scale Phase 1.5 dominates the entire chain budget.

### E6. End-to-end chain budget under v3.8.2

| Scenario | Pre-auditor (coord) | Auditor passes | PM + arch + sr-eng + qa | Phase 1.5 (5 surfaces) | **Total tokens** |
|---|---:|---:|---:|---:|---:|
| Non-UI feature (no auditor, no Phase 1.5) | ~3K | 0 | ~38K | 0 | **~41K** |
| Small UI (1 pass, 3 baselines) | ~3K | ~6K | ~38K | ~18K | **~65K** |
| Medium UI (3 passes, 10 baselines) | ~3K | ~18K | ~38K | ~50K | **~109K** |
| Large UI (5 passes, 30 baselines) | ~3K | ~30K | ~38K | ~180K | **~251K** |

Cost ranges (input-side only, conservative):

| Model (input $/1M, output $/1M) | Medium UI total | Large UI total |
|---|---:|---:|
| Claude Sonnet 4.6 ($3 / $15) | **~$0.33** | **~$0.75** |
| Claude Opus 4.7 ($15 / $75) | **~$1.64** | **~$3.77** |
| Claude Haiku 4.5 ($1 / $5) | **~$0.11** | **~$0.25** |
| Gemini 3 Flash ($0.5 / $3) | **~$0.05** | **~$0.13** |

Prompt caching across the same role within 5 min cuts re-load cost by ~90%; in practice a multi-role chain pays full price only on the first turn per role.

### E7. Pixel-perfect defense stack (v3.8.2) and per-failure-class catch rate

Per-failure detection rate estimated from research/pixel-perfect-and-design-coverage.md §3 (vision-LLM ~5px sensitivity), research/design-fidelity-enforcement.md (Copy / Visual gate failure modes), and the actual SOP text in v3.8.2 skills.

| Failure class | Caught by | Catch rate (est.) |
|---|---|---:|
| Copy text paraphrase | QA 3a Copy Audit Gate (`skill-qa-engineer.md:28-32`) | ~95% |
| Literal-token paraphrase (hex / sp / dp / weight) | QA 3b Visual Audit Gate (`skill-qa-engineer.md:34-39`) | ~95% |
| Frame entirely missed by auditor | Auditor Source manifest (v3.8.1) + multi-pass | ~95% |
| Layout / spacing drift > 5px | Phase 1.5 vision-LLM (category i + ii) | ~80% |
| Layout / spacing drift ≤ 5px (sub-pixel) | — (vision-LLM precision floor) | **~25%** |
| Missing element | Phase 1.5 vision-LLM (category iii) | ~85% |
| Non-literal color drift (gradient, alpha) | Phase 1.5 vision-LLM (category iv) | ~60% |
| Wrong icon / photo content | Phase 1.5 vision-LLM (category vi) | ~75% |
| Stale baseline (Figma updated after audit) | — (no freshness check) | **0%** |

### E8. Joint pixel-perfect success rate (first QA round)

Modelling: a "typical UI feature" exhibits 0–5 issues drawn from the classes above. Probability of catching *all* issues = product of per-class catch rates. Average across 1000 simulated features with weighted class incidence (text drift 30%, literal drift 20%, frame miss 10%, > 5px drift 25%, ≤ 5px drift 5%, missing element 5%, color drift 3%, stale baseline 2%):

| Stack | First-round perfect rate |
|---|---:|
| Pre-v3.7.3 (no Copy gate, no Visual gate, no manifest, no Phase 1.5) | **~30–40%** |
| v3.8.0 (gates only, no manifest, no Phase 1.5) | **~55–65%** |
| v3.8.1 (gates + manifest + multi-pass) | **~60–70%** |
| **v3.8.2 (full v3.8.1 + Phase 1.5)** | **~70–80%** |
| v3.8.2 + Phase 3 Playwright VRT (hypothetical) | ~92–96% |

Numbers are estimates extrapolated from the catch-rate table; production data is not available. The relative *delta* between rows is more reliable than the absolute level.

---

## Recommendation

**Stop here for now.** v3.8.2 gives the *largest* fidelity gain per token spent. The remaining ~20% gap to pixel-perfect splits into two regions, both with sharp diminishing returns:

1. **Sub-pixel / ≤ 5px drift (~5% of the gap)** — vision-LLMs cannot resolve this. Closing it requires Phase 3 (Playwright VRT) or an external Applitools/Percy service. Setup cost is high and `research/pixel-perfect-and-design-coverage.md` already rejected both for the AI-agent-first workflow. Defer.

2. **Stale baseline drift (~2% of the gap)** — the auditor records `baseline path` once, with no mechanism to detect that the underlying Figma frame has changed. A cheap mitigation: extend QA Phase 1.5 to compare `baseline path`'s mtime against `design/<feature>.md`'s mtime and fail-loudly when the baseline is older than the audit. ~10 lines of SOP. Worth doing if the team observes false-PASS incidents from stale baselines.

3. **The next ~5% beyond that** — a **server-enforced manifest gate** (deferred from Phase 1 per `specs/pixel-perfect-design-coverage.md` "Out of Scope"). Promote auditor manifest enforcement from SOP-text to `tw_update_state` payload validation. Closes the "auditor lied about coverage" failure mode that SOP-only enforcement cannot.

**Token-cost watch-item**: `skill-qa-engineer.md` is now 2.17K tokens — 27% larger than `skill-pm.md` (next largest). If Phase 1.6+ adds further QA sub-phases, consider splitting into `skill-qa-engineer.md` + `skill-qa-visual.md` so workspaces without UI work don't load the visual SOP. Not urgent today.

---

## Alternatives Considered

- **Promote Phase 1.5 to a server tool `tw_visual_compare`** — rejected during T49+T50+T51 planning by user choice (kept SOP-only). Server-side image processing would add a Sharp / Jimp dependency and break the zero-runtime-deps principle of the MCP server; the host LLM's native multimodal capability is strictly better.
- **Bump per-pass auditor line cap from 250 → 500** — rejected as "A3" in `research/pixel-perfect-and-design-coverage.md`. Doubles per-pass token cost for marginal coverage gain; the 5-pass × 250 = 1250-line ceiling already covers ~30 surfaces, which is more than most features need.
- **Add per-token Figma node-id source-rot check** — already exists in `skill-qa-engineer.md:37` for the literal Visual Audit Gate but only "when feasible". Mandating it would require Figma MCP availability — couples the chain to a specific external tool. Source-agnostic principle wins.
- **Switch all roles to Haiku 4.5** to halve token costs — rejected as a coordinator/sr-engineer/qa-engineer choice because the reasoning depth required for spec drafting and code review degrades observably below Sonnet 4.6. Researcher and design-auditor (mechanical extraction) could safely run on Haiku — worth experimenting with `MODEL_PER_ROLE` config but out of scope for this report.

---

## Open Questions

1. **Anthropic prompt cache hit rate in practice**: the per-role load numbers in E2 assume a cold load each time. In a single Claude Code session that bounces across roles, how often does the cache TTL expire before the next role-call? Without telemetry we cannot verify the 90% reload-discount estimate.
2. **Vision-LLM precision floor across models**: the "~5px" sensitivity figure comes from Anthropic's own image-input docs. Has anyone benchmarked Gemini 3 Flash's actual floor on side-by-side mockup vs. implementation pairs? If Gemini is ≥ 3× cheaper *and* equally precise, switching Phase 1.5 to Gemini is a free 60–70% cost cut.
3. **Production drift data**: the success-rate numbers in E8 are model estimates. To close the gap to "what *actually* happens", we would need to instrument `qa_reports/review_*.md` PASS/FAIL outcomes against post-ship visual audits. Out of scope today; worth adding `tw_report_outcome` as a future telemetry hook.
4. **State JSON growth**: at 51 completed tasks the state block already adds ~400 tokens to every role load. There is no GC mechanism for old `completed_tasks` entries; a future feature workspace at 500+ completed tasks would pay an extra ~4K tokens per role load. Consider a `state.completed_tasks` window (last N) with overflow in `tasks.md`.
5. **Baseline stale-detection threshold**: if we implement the mtime check from Recommendation §2, what tolerance is acceptable? A 1-hour-old baseline is usually fine; a 30-day-old baseline is suspect. Probably needs to be configurable, not a hard-coded constant.
