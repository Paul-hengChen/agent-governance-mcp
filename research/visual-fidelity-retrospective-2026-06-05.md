# Visual-Fidelity Build Retrospective — THE BASELINE LESSON (2026-06-05)

> **Status: reference baseline.** Use this doc as the benchmark when judging future
> agent-governance-mcp workflow changes. The framework's constitution, skills, and flow were
> iterated repeatedly; this run still burned a large token volume AND shipped a UI far from the
> design source while reporting a "PASS". This document records, in detail: every problem, the
> discussion/external review, and the conclusions.
>
> Feature: `agc-test-setup-wizard` — a 9-screen first-run setup wizard for a third-party
> product (React + TS + Vite, Figma design source). Author: researcher (in-context).
> Date: 2026-06-05.
>
> **De-identified 2026-09-04.** The 33 side-by-side screenshots (design frames + implementation
> captures) and the client-identifying details they carried — product/model names, the Figma file
> key, network SSIDs, legal copy, and the per-screen UI descriptions built on those images — were
> removed as third-party confidential material. §1 below is what survives of that evidence: the
> defect classes, stated product-neutrally. Everything §2 onward is unchanged and self-contained;
> every A/B/C/D finding and every R recommendation traces to a §1 class listed here.

## 深刻反省（為什麼這次特別該記住）

憲法、skill、流程改了又改，方法也一再檢討優化——結果這次 **燒了大量 token，成品卻跟設計稿差很遠，而且還一度判 PASS**。
核心教訓一句話：**我們把 Figma 的「結構」轉成有損的文字規格，讓工程師盲寫、缺口用假設補；再用一個會被稀釋、又被
coordinator 放水的視覺判準蓋章。流程越自動，錯誤被自動放大得越快。** 工具其實都在（Figma MCP、kitchen-sink、playwright），
只是沒接進迴圈。下面是完整證據。

---

## 1. What the Per-Screen Comparison Showed (defect classes)

The original §1 was a 10-subsection, screenshot-backed walk of every screen. The images and the
product-specific descriptions are gone (see the de-identification note above); the defect classes
they established are below. Each is the *pattern*, observed across multiple surfaces — which is
what makes it a framework finding rather than a bug list.

| # | Defect class | Spread | Feeds |
|---|---|---|---|
| 1 | **Focus/selection state never rendered.** A full-width accent selection/focus bar is specified throughout the design source and appears **nowhere** in the build. | 4 of 9 surfaces | A2, B4, R-VIS 2 |
| 2 | **Group-container boxes dropped.** Design wraps each setting group in a rounded bordered box; build renders flat rows with no container. | 3 surfaces | A1, R-VIS 3 |
| 3 | **Declared token not applied.** Every primary/confirm button shipped grey despite an accent color sitting in the extracted token table. One unwired token, whole-app symptom. | every surface with a primary button | A5, R-VIS 1 |
| 4 | **Row style invented.** Design specifies plain full-width text rows; build produced boxed surface-raised chips — a gap filled by assumption, never flagged. | list surfaces | A1, A4 |
| 5 | **Alignment/sizing guessed.** Left-aligned narrow column where the design centers content at full width. | list surfaces | A1 |
| 6 | **Capture at non-canonical state.** Implementation screenshots were taken mid-scroll with nothing selected, then the resulting difference from the baseline's depicted state was *excused* rather than treated as a capture defect. | the decisive surface | B1, B3, R2 |
| 7 | **Over-correction.** A round-3 fix removed a description block entirely instead of showing it on focus, as designed. | 1 surface | A4 |
| 8 | **Regression shipped.** A title rendered twice (chrome header + body title overlapping). | 1 surface | A3 |
| 9 | **Nested drawer sub-states never visually confirmed.** Two-level drawer flows existed in code; styling and nesting were never verified against the design. | 2 flows | A6, B5 |
| 10 | **Placeholder copy shipped** where the design supplies real content. | 2 surfaces | A4 |
| 11 | **One surface had no implementation capture at all** — it existed in code, was never visually verified, and still rode inside the PASS. | 1 surface | B6 |
| 12 | **Artwork substituted** with generic line icons (a *documented deferral*, but still a real gap against the design). | 1 surface | A4 |
| 13 | **Label and format divergences** — wording and value-format mismatches against the design's strings. | several | A1 |

Two surfaces were close matches, and both were round-3 outcomes — evidence the loop *could*
converge when it had the right target, which is why the recommendations below are about the
target and the judge, not about effort.

---

## 2. Problem Taxonomy (the framework-level causes)

### A. Output far from design (fidelity)
- **A0 — The "oversized → ask the human" gate never fired (upstream miss).** The mechanisms existed *before* this run: design-auditor **Volume Gate** (v3.17.0, 2026-05-31 — Block when a single feature's design source exceeds ~one feature's worth, recommend re-split), the feature-split **`figma link` human-owned column** (v3.18.0, 2026-05-31), and PM's **Resource Audit Gate** (constitution §7). None triggered because the work bypassed the path that arms them: the whole 9-screen wizard was scoped as **one feature** (`agc-test-setup-wizard`) and driven **in-context by researcher** — never decomposed through PM → feature-split → design-auditor, so the human-fills-Figma prompt never appeared. design-auditor then hit limits and collapsed inline (see C5/A6) with no clean pre-fetch metadata estimate, so the Volume Gate's STOP was skipped on a Figma source that plainly exceeded one feature. **The original taxonomy missed this entirely** — A1–A6 start *after* the feature was already (wrongly) ingested whole; the most upstream failure was that nobody stopped to ask the human to split it. (skill-design-auditor Volume Gate enforcement under inline collapse + coordinator feature-split routing)
- **A1 — Layout serialized to lossy prose.** Figma autolayout (flex/align/itemSpacing, **group-box containers**, **cycling selectors**) is dropped when the design-auditor transcribes to prose tokens; the engineer then flat-lays its own guess. (design-auditor output + handoff format)
- **A2 — focused/selection state never specced or asserted.** Full-width blue selection/focus bar is everywhere in Figma (Language, Mode, Network, Time) and **nowhere** in the build. (design-auditor under-spec + qa never asserts state)
- **A3 — Engineer writes blind.** `skill-sr-engineer` self-check is **render-free** (string-compares declared root dimensions only); it cannot see component-internal layout, so wrong row style / missing bar / flat groups pass its gate. The engineer also did not re-query the Figma node's autolayout. (skill-sr-engineer)
- **A4 — Gaps filled by assumption, not flagged.** Boxed chips (no row spec), invented Mode descriptions, over-corrected Mode list to title-only, placeholder legal text. §7 "ask-before-assumptions" not enforced as a UI hard rule. (constitution §7 / skill-sr-engineer)
- **A5 — Declared tokens not applied.** Primary buttons stayed grey `#333` although accent `#3C5AAA` was in the token table; the selected-row token was never wired. No "declared token must render" check. (skill-sr-engineer build gate)
- **A6 — design-auditor coverage incomplete + node-ids mis-resolved.** Mode-card frames missed on first audit; baseline node-ids "resolved" by name pointed at the **wrong screens** (`4888:*` = Network). The human had to re-verify ids **by frame text content**. Wrong baselines → meaningless diffs. (skill-design-auditor manifest completeness + node-id verification)

### B. QA did not catch it / false PASS
- **B1 — Coordinator overrode the qa-visual contract.** A hand-written *accept-policy* in the subagent prompt pre-classified "selection state" and "scroll offset" as accepted — excusing the exact Language defect. **This is the single decisive cause of the false PASS.**
- **B2 — Global-frame pixel-% diluted the error.** Language scored 6.18% on a mostly-empty 1280×720 dark canvas → "looks near-passing"; a structural error in a small content region is invisible to whole-frame %.
- **B3 — No canonical-state parity.** Impl captured at an arbitrary scroll/selection state, then the difference vs the baseline's state was excused rather than treated as a capture defect.
- **B4 — No structural assertions.** Nothing checked "is the focus bar present? is the group box present? is the primary button the accent color? does the declared selected-token render?"
- **B5 — Whole-screen diff, not per-widget.** Large blast radius; fixing one screen reflowed others (fix-A-break-B), wasting rounds.
- **B6 — Gate armed late.** The first "PASS" ran no visual check at all (`visual_round=0`); a coordinator-declared "structural PASS". Caught only by the human.

### C. Token burn (process)
- **C1 — Async blind-write → downstream-QA → bounce loop.** Each correction is a full role round-trip (reload context, re-spawn, re-handoff). The dominant cost.
- **C2 — False PASS → reopen → re-run whole-app QA.** "Passed while wrong" rounds were thrown away.
- **C3 — Coordinator orchestration noise.** Verbose subagent prompts, repeated whole-app qa-visual re-runs, and (under limits) the coordinator doing roles inline.
- **C4 — Lossy spec guarantees a first-pass miss → guarantees ≥1 bounce minimum**, before any real iteration.
- **C5 — Subagent rate/weekly limits mid-run.** design-auditor, sr-engineer, and the final qa-engineer all hit limits; the coordinator absorbed those roles, losing independence and adding churn.

### D. Governance / state-machine
- **D1 — State-machine assumes strict sequential single-context handoffs.** Background/parallel subagents + inline coordinator action caused chronic `TRANSITION_REJECTED` and drift (tasks done-but-unrecorded, checkboxes unflipped). Required manual reconciliation (pm reopen, hand-written PASS).
- **D2 — Same actor could build, judge, and sign PASS.** Under limits the coordinator wrote code, authored the verdict criteria, and issued the PASS — no separation.

### Causal chain (one line)
`feature scoped whole + driven in-context → oversized/ask-human gate bypassed (A0)` → `design → lossy prose (A1/A2)` → `engineer blind-writes, fills gaps by assumption, doesn't apply tokens (A3/A4/A5)` → **output far from design** → `QA uses a diluting metric (B2/B3/B5) and is overridden by a coordinator accept-policy (B1/B4)` → **false PASS (B6)** → `reopen + whole-app re-runs (C1/C2)` → **token burn**, with `state-machine desync (D1)` and `limit-driven role collapse (C5/D2)` amplifying throughout.

---

## 3. External review (Gemini) — what to keep / reject
- **Keep:** "give the engineer Figma access" (we had it, never wired in); "component-driven sandbox / per-widget verify" (we even have `/dev/kitchen-sink`, never used per-widget); "text handoff loses information" (true — but the fix is structured layout, not *more prose*).
- **Reject:** "lower QA tolerance to ±4px / looks-similar PASS." This run failed from QA being **too lenient**; loosening worsens false-PASS, and a px tolerance can't catch structural errors (boxed-chips vs blue-bar is not a 4px offset).
- **Partial:** "Figma-to-code (Anima/html.to.design) dump" — generated absolute-positioned CSS clashes with the token system + remote-nav focus engine; use as layout reference only.

---

## 4. Recommendations (R1–R10, ranked by leverage)

Most are prompt/SOP edits to existing skill files; the three systemic visual wins (R-VIS) are also called out because they alone close ~70% of the pixel gap.

**R1 (primary) — Lock visual-verdict authority to qa-visual; forbid coordinator accept-policies.** `skill-coordinator.md` + `skill-qa-visual.md`: coordinator may pass context (baselines, node-ids, canonical-state) but MUST NOT redefine pass thresholds or pre-authorize "accepted" divergence. Per-surface allowed-diffs justified by qa-visual only.

**R2 — Canonical-state parity before diffing.** Drive the impl to the baseline's depicted state (selection/focus/scroll/drawer) before comparing; a state mismatch is a capture defect, never an accepted diff.

**R3 — Forbid global-frame pixel-% as a PASS metric.** Use the per-surface structured multimodal diff; if numeric, weight to the component bbox. Sparse dark canvases make global % meaningless.

**R4 — Per-widget isolation diff before assembly.** Diff each widget in `/dev/kitchen-sink` vs its Figma component node and PASS it individually, before screen-level diffs.

**R5 (decision needed) — Scoped in-loop render self-check for sr-engineer.** Today's self-check is deliberately render-free (token frugality) — that is *why* intra-component errors survive. Add an opt-in render+screenshot self-check scoped to custom widgets / changed surfaces so the writer self-corrects in-context. Trade-off: more per-task tokens, far fewer QA bounces. Net favours scoped-render for custom-widget-heavy UI.

**R6 — Keep design layout as STRUCTURE, not prose.** design-auditor emits autolayout props (layoutMode / align / itemSpacing / padding / sizing / fills) + node-id; engineer re-queries the node per custom widget.

**R7 — Engineer: gap → flag, never assume; apply declared state tokens.** Missing component structure → STOP and request it. A declared selection/focus token that renders nowhere is a build-gate failure.

**R8 — design-auditor: manifest completeness + content-verified node-ids.** A baseline node-id is `audited` only when verified by reading the frame's text/structure (not by name/number). Manifest reconciles against the spec's screen list.

**R9 — Inline execution must not collapse the adversarial gate.** When a subagent is unavailable and the coordinator runs a role inline, it may build but MUST NOT self-issue the qa PASS nor author the visual verdict. No independent QA available → `Blocked`, not coordinator-PASS.

**R10 — State-machine must tolerate parallel/background subagents + inline coordinator, or declare it doesn't.** Add a reconcile/`tw_sync` op, or document that `/teamwork` requires sequential single-context execution. Silent drift is the worst option.

**R-VIS (the 3 systemic visual fixes, from the screenshot audit):**
1. **Primary button = accent blue `#3C5AAA`** (currently grey on every screen — one fix, whole-app win).
2. **Shared focused-row full-width blue bar** component (missing on Language/Mode/Network/Time).
3. **Group-container box** component (missing on Mode-adjust/Network/Time; Figma wraps each setting group).
   Then: drawer set (timezone / date / time / IP-octet / boot-source+select-app), real content (legal text, static-IP real values, DNS2, Wi-Fi SSID list, Power Authority row), fix the double-title regression, restore Mode-list focused-card description.

---

## 5. Alternatives Considered
- **Lower QA tolerance — rejected** (root cause was over-leniency; px tolerance can't catch structural misses).
- **Figma-to-code full dump — partially rejected** (generated CSS clashes with tokens + focus engine; reference only).
- **Status quo — rejected** (machinery exists but is overridable (R1) and has the parity/metric/structure gaps (R2/R3/R4/R-VIS)).

## 6. Open Questions
- **R5 fork (token-budget call):** render-free (cheaper/task, more bounces) vs scoped-render (more/task, fewer bounces)?
- **R1 enforcement:** server-reject a qa-visual handoff whose `qa_review` shows a wholesale accept-policy, or skill-advisory only?
- **R10 fork:** extend the state-machine (reconcile op) vs declare background/parallel unsupported for state-tracked work?
- **Scope honesty:** this "PASS" certifies **UI visual + flow only**. the device-apply layer is a no-op stub; no platform/OSD bridge, Wi-Fi connect simulated, the non-English locales are English stubs, first-run boot-entry/exit absent, Phase II out. Add a spec field distinguishing *UI-complete* from *integration-complete* so a visual+test PASS cannot imply device readiness.
- Re-run all 9 routes under R2/R3 (canonical-state, region-weighted, structural assertions) to find other screens the diluted metric passed.
