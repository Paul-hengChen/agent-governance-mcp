# CDE-OOBE Build Retrospective — THE BASELINE LESSON (2026-06-05)

> **Status: reference baseline.** Use this doc as the benchmark when judging future
> agent-governance-mcp workflow changes. The framework's constitution, skills, and flow were
> iterated repeatedly; this run still burned a large token volume AND shipped a UI far from the
> Figma design while reporting a "PASS". This document records, in detail: what was built vs the
> design (with screenshots), every problem, the discussion/external review, and the conclusions.
>
> Feature: `agc-test-setup-wizard` — CDE 31/14 OOBE Setup Wizard (React + TS + Vite, Figma
> file `mb8UaOE6OYac3BFWNB4PNh`). Author: researcher (in-context). Date: 2026-06-05.

## 深刻反省（為什麼這次特別該記住）

憲法、skill、流程改了又改，方法也一再檢討優化——結果這次 **燒了大量 token，成品卻跟設計稿差很遠，而且還一度判 PASS**。
核心教訓一句話：**我們把 Figma 的「結構」轉成有損的文字規格，讓工程師盲寫、缺口用假設補；再用一個會被稀釋、又被
coordinator 放水的視覺判準蓋章。流程越自動，錯誤被自動放大得越快。** 工具其實都在（Figma MCP、kitchen-sink、playwright），
只是沒接進迴圈。下面是完整證據。

---

## 1. Per-Screen Visual Comparison (impl vs Figma)

Left = what the automated run shipped. Right = the Figma design (and the sub-states it never built).
Screenshots in `assets/cde-oobe-retro/`.

### 1.1 Language

| Built | Figma |
|---|---|
| ![](assets/cde-oobe-retro/impl-01-language.png) | ![](assets/cde-oobe-retro/figma-01-language.png) |

- Rows: **boxed surface-raised chips** vs Figma **full-width plain text rows** (no box).
- Selection: **none rendered** vs Figma **full-width `#3C5AAA` selection bar** on the focused row.
- Alignment: list **left-aligned, narrow column** vs Figma **centered, full content width**.
- Default state: impl **scrolled mid-list (Deutsch top), nothing selected** vs Figma **English selected & vertically centered**.
- Stepper dots tiny; Figma dots larger/filled.

### 1.2 Orientation

| Built | Figma |
|---|---|
| ![](assets/cde-oobe-retro/impl-02-orientation.png) | ![](assets/cde-oobe-retro/figma-02-orientation.png) |

- 3 cards + Auto-selected blue: **correct**.
- Card artwork: impl **generic line icons**; Figma **Auto = overlapping screens + rotate arrows; Landscape/Portrait = solid device rectangles sized to orientation**. (device-illustration art was a documented *deferred* item — but it's a real gap.)

### 1.3 Mode (selection list)

| Built | Figma |
|---|---|
| ![](assets/cde-oobe-retro/impl-03-mode-list.png) | ![](assets/cde-oobe-retro/figma-03-mode-list.png) |

- Figma: the **focused/selected card EXPANDS to show its description** (Energy Star: blue card + full paragraph); other cards compact title-only.
- Built: **all cards title-only** even when selected — round-3 *over-corrected* (removed the description entirely instead of showing it on focus).

### 1.4 Mode → Adjust (Manual)

| Built | Figma |
|---|---|
| ![](assets/cde-oobe-retro/impl-04-mode-adjust.png) | ![](assets/cde-oobe-retro/figma-04-mode-adjust-manual.png) |

- **Regression bug:** impl shows **"Adjust Mode Settings" TWICE** (chrome header + body title overlapping).
- Subtitle: impl "Fine-tune each OSD setting for this display." vs Figma **"Customized setting from Manual Setup"** (blue).
- **Group containers:** Figma wraps each group (Connectivity / Power & Boot) in a **rounded bordered box**; impl renders **flat rows, no box**.
- **Focused row:** Figma highlights the focused setting with a **full-width blue bar** (e.g. HDMI with Device Control); impl has **no row-focus highlight**.

Figma sub-states the run never matched (focused-row bar, per-row):

| Power Save focused | Boot on Source focused |
|---|---|
| ![](assets/cde-oobe-retro/figma-06-mode-adjust-powersave.png) | ![](assets/cde-oobe-retro/figma-07-mode-adjust-bootsource.png) |

### 1.5 Mode → Overview (Review) — NO impl screenshot captured

| Built | Figma |
|---|---|
| *(not shown / under-verified)* | ![](assets/cde-oobe-retro/figma-05-mode-overview.png) |

- Figma: subtitle "Review the setting for **Manual Setup**", **group boxes**, values right-aligned (On/Off/External), a **Power Authority: External** row, **Adjust** link + **blue primary OK**.
- Built review exists in code but was not visually verified; OK button is grey not blue; Power Authority row presence unconfirmed.

### 1.6 Boot on Source picker + Select App (right drawer) — under-built

| Boot picker | Custom selected | Select App (nested) |
|---|---|---|
| ![](assets/cde-oobe-retro/figma-08-boot-source-picker.png) | ![](assets/cde-oobe-retro/figma-09-boot-source-custom.png) | ![](assets/cde-oobe-retro/figma-10-select-app.png) |

- Figma: right-side **drawer** (Last Input / HDMI 1-3 / USB Auto Play / Type C / Custom + Done), left rail collapses to dots; selecting **Custom** opens a **nested "Select App" drawer** (Chromium / Youtube / App…). The run's `RightSidePanel` exists but the two-level nesting + styling was never visually confirmed.

### 1.7 Network

| Built — DHCP | Built — Static IP |
|---|---|
| ![](assets/cde-oobe-retro/impl-05-network-dhcp.png) | ![](assets/cde-oobe-retro/impl-06-network-static.png) |

Figma — many states the run did not match:

| Ethernet + IP cycling | Ethernet+Wi-Fi | Wi-Fi connected (VS-Access) |
|---|---|---|
| ![](assets/cde-oobe-retro/figma-11-network-ethernet.png) | ![](assets/cde-oobe-retro/figma-13-network-eth-wifi.png) | ![](assets/cde-oobe-retro/figma-15-network-wifi-connected.png) |

| Static IP (real values) | IP octet editor (drawer) | Wi-Fi available list |
|---|---|---|
| ![](assets/cde-oobe-retro/figma-16-network-static-real.png) | ![](assets/cde-oobe-retro/figma-17-ip-octet-edit.png) | ![](assets/cde-oobe-retro/figma-19-network-wifi-list.png) |

- Label: impl **"Ethernet"** vs Figma **"Turn On Ethernet"**.
- IP config: impl **DHCP / Static IP segmented buttons** vs Figma **‹ DHCP › cycling selector**.
- **Group box:** Figma wraps Ethernet + IP config in one bordered box; impl flat.
- **Wi-Fi section entirely missing** in impl shots: Figma has Wi-Fi toggle + **Available networks** list (VS-Access 🔒 **Connected** badge, VS-Guest open, ViewSonic-3F/7F/Wifi 🔒) with lock + signal icons.
- Static IP defaults: impl **all `0.0.0.0`, single DNS, plain text inputs** vs Figma **real values `192.168.1.2` / `255.255.255.0` / `192.168.1.1`, DNS1 + DNS2 `8.8.8.8`**, edited via an **octet drawer** ("Press OK to edit", `192 · 168 · 1 · 2`).
- Focused row blue bar: present in Figma, absent in impl.

### 1.8 Time (Date & Time)

| Built | Figma — Set Time Zone drawer |
|---|---|
| ![](assets/cde-oobe-retro/impl-07-time.png) | ![](assets/cde-oobe-retro/figma-20-set-timezone.png) |

- Built: flat rows (network toggle, Set date `01/01/2026`, Set time `12:00 AM`, Time zone ‹Los Angeles›, 24h toggle, Date format ‹MM/DD/YYYY›).
- Figma: rows wrapped in **group boxes**, **focused-row blue bar**, and **Set date / Set time / Time zone open drawers** (timezone drawer: Denver / London / Berlin / Rome…). Impl had drawers in code but the row grouping + focus bar are missing.

### 1.9 Consent (Privacy and terms)

| Built | Built — modal | Figma | Figma — real legal modal |
|---|---|---|---|
| ![](assets/cde-oobe-retro/impl-08-consent.png) | ![](assets/cde-oobe-retro/impl-09-consent-modal.png) | ![](assets/cde-oobe-retro/figma-21-privacy-terms.png) | ![](assets/cde-oobe-retro/figma-22-privacy-modal.png) |

- Layout, checkbox, instruction text: **close match** (the strongest screen).
- **Agree button:** impl **grey** vs Figma **blue primary**.
- **Modal content:** impl **placeholder** ("Terms of Use (placeholder)…") vs Figma **real legal text** ("ViewSonic Corporation and its affiliates…") with scroll + chevron; impl Close grey vs Figma **Close blue**.

### 1.10 Summary

| Built | Figma |
|---|---|
| ![](assets/cde-oobe-retro/impl-10-summary.png) | ![](assets/cde-oobe-retro/figma-23-summary.png) |

- Chrome-free, green check, unified table, Back + Done: **close match** (good outcome of round-3).
- **Done button:** impl **grey** vs Figma **blue primary**.
- Minor: timezone label "(UTC−7, DST)" vs Figma "(UTC-7)".

---

## 2. Problem Taxonomy (the framework-level causes)

### A. Output far from design (fidelity)
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
`design → lossy prose (A1/A2)` → `engineer blind-writes, fills gaps by assumption, doesn't apply tokens (A3/A4/A5)` → **output far from design** → `QA uses a diluting metric (B2/B3/B5) and is overridden by a coordinator accept-policy (B1/B4)` → **false PASS (B6)** → `reopen + whole-app re-runs (C1/C2)` → **token burn**, with `state-machine desync (D1)` and `limit-driven role collapse (C5/D2)` amplifying throughout.

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
- **Scope honesty:** this "PASS" certifies **UI visual + flow only**. ApplyLayer is a `NoOpApplyLayer` stub; no Android/OSD bridge, Wi-Fi connect simulated, 14 non-English locales are English stubs, OOBE boot-entry/exit absent, Phase II out. Add a spec field distinguishing *UI-complete* from *integration-complete* so a visual+test PASS cannot imply device readiness.
- Re-run all 9 routes under R2/R3 (canonical-state, region-weighted, structural assertions) to find other screens the diluted metric passed.
