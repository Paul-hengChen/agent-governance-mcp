# Feature Split Plan: process-retrospective remediation   (text-only assessment — no design read)

## Assessment
- verdict: multi-feature (3 units) — signals: human-directed split; 3 separable governance concerns (visual-rework loop vs context-cost vs budget-ceiling); no shared code foundation; non-design (no Figma source).
- source: `research/process-retrospective.md` (CDE-OOBE Language run) — 55.6% of tokens spent on 4 rounds of visual rework; sr-engineer rejected 4× by qa-engineer.

## Split Table
| order | feature id | scope | figma link | depends_on | key visual widgets | notes / 注意事項 | status |
|---|---|---|---|---|---|---|---|
| 0 | visual-selfconverge | Collapse the sr↔qa visual-rework loop: sr runs qa's region-diff + VSA structural assertions whole-surface, in-context, looping until all VSA rows pass BEFORE handoff (4 cross-context round-trips → 1 dispatch). §1 surgical bounded-relaxation inside the self-converge loop. §3.2 global-frame ban UNCHANGED. + #3 reusable region-measure harness (architect Visual Harness emits per-region numbers, shared by sr+qa). + #4 single-surface geometric-density split gate (state-count ≠ density). + #5 subagent_tokens observability (read agent-*.jsonl usage). Touches: constitution.md, skill-sr-engineer.md, skill-design-auditor.md, skill-qa-visual.md, possibly tools/evidence-file.ts. | — | none | — | 主修法。直接對應報告的 55.6% 返工 + sr 被 reject 4 次。 | done |
| 1 | governance-text-load | Trim/layer-load constitution + skills to cut the per-dispatch context tax (full constitution + claude-api skill re-injected every dispatch, ~40k+ tokens unmeasured). Build on existing chain-only block mechanism. | — | none | — | 與視覺返工無關的全局成本問題,獨立開。 | done |
| 2 | token-budget-gate | Add explicit per-feature token budget + coordinator STOP when approaching ceiling (currently only implicit round-caps bound cost). | — | none | — | 與視覺返工無關的全局問題,獨立開。 **Migrated to `docs/backlog.md` B9 (2026-06-12)** — track there, not here. | migrated → backlog B9 |
| 3 | constitution-restructure | Slim the per-dispatch constitution bundle by RESTRUCTURING (move §1/§3.2 cde-oobe war-story rationale into an on-demand referenced doc), not fencing. | — | none | — | F-B option-(b) finding: safe rationale-fencing of the constitution yields only ~49 tok because the verbose prose lives in the §3.2 AC-3 exclusion zone or is entangled with rule text in bullets. Real slimming needs restructuring + on-demand load — bigger than fence markers. Follow-up, not urgent. Shipped as `constitution-conditional-load` v3.32.0–v3.34.0 (rationale extracted to `constitution-rationale.md` + design-only conditional strip). | done |

## How to proceed
Build order 0 (visual-selfconverge) first — re-invoke /teamwork per row in `order` (or say "do F<n>"). Coordinator flips each row to `done` on PASS; resume skips `done`. Features are independent (no shared foundation); order is sequencing preference, not a dependency chain.
