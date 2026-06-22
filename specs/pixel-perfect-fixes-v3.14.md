# pixel-perfect-fixes-v3.14

## Problem Statement

`research/visual-fidelity.md` 揭露 framework 在 pixel-perfect 工作上有六道**同向**的結構性破口（QA scope 排除 style、code-reviewer clean-context、MVP strict 反向獎勵 primitive、PM 無 widget-shape schema、architect 無 harness schema、無人擁有 harness、Phase 1.5 lazy-skip 無 server gate），加上 operator 在 §7 "Fail loud" 的可規避性。線性鏈僅有一個 feedback loop（`qa_round`），pixel convergence 無專屬迴圈。結果：visual fidelity 在 cde-oobe rollout 漏失 ~60%，且每一步都符合既有規約。本 feature 套用報告 R1-R4 + 後續討論的 R2a/R3a/R4a/R5/R6 共九項修法，封堵全部六道破口。

## User Stories

- As a **framework maintainer**, I want server-enforced visual evidence gates so that PASS cannot be issued when Visual Baselines exist but pixel diff was never run, so that the "skip-if-absent" 逃生門被關閉。
- As a **PM**, I want a `Visual Widgets` schema slot so that 非 HTML primitive 元件（column-scroller、virtual keyboard）能在 spec 階段被明文枚舉，sr-engineer 不會理性退回 primitive。
- As a **design-auditor**, I want a widget-shape extraction contract so that `design/<feature>.md` 主動產出 widget 表，PM 直接 verbatim 抄入，斷絕 PM 自由心證。
- As an **architect**, I want a `Visual Harness` 必填 schema 段 so that Playwright + pixelmatch harness 任務被明確分配給 sr-engineer，不會落在角色之間。
- As an **sr-engineer**, I want Phase 0.5 Design-Aware Pre-Flight so that 動工前先 Read `design/<feature>.md` 與相關 Visual Widgets row，避免「MVP strict 退回 primitive」的反向誘因。
- As a **qa-engineer**, I want Phase 1.5 強制 PASS 評估 widget-shape + pixel diff so that visual report 同時涵蓋形狀與像素，避免「換對顏色的 `<input>` 仍獲高分」。
- As any **role on a visual-iteration loop**, I want a bounded `visual_round` 子迴圈 so that pixel convergence 是 first-class iterative process，第 3 輪可 escalate split，第 5 輪重談 threshold/scope。

## Acceptance Criteria

### Skill 層（R1, R2, R2a, R3, R3a, R6）

- **AC-1 (R2)**: `Given` PM 撰寫含 `design/<feature>.md` 的 spec，`When` design 檔含 widget-shape 元件，`Then` `specs/<feature>.md` MUST 含 `## Visual Widgets` H2 段，3-column table `widget id | description | source-node`，且每筆 source 為 Figma node id 或 `authored-here`+理由。
- **AC-2 (R2a)**: `Given` design-auditor 處理含非 primitive 元件的 Figma 來源，`When` 偵測 component name 命中（`Picker`, `Wheel`, `Keyboard`, `Slider`, `Stepper`, `Accordion`, `Segmented`, `Scrollbar`, `Toggle`），`Then` `design/<feature>.md` MUST 產出 `## Visual Widgets` 段；PM 直接 verbatim 抄入 spec。
- **AC-3 (R3)**: `Given` architect 撰寫 architecture，`When` `design/<feature>.md` 存在，`Then` `specs/<feature>-architecture.md` MUST 含 `## Visual Harness` H2 段，列出 test runner / viewport list / diff library / threshold / CI command；且 `## Affected Files` MUST 含 `tests/visual/*.spec.ts` blueprint；且 `## Tasks` MUST 含一個 `[P0] Build visual-diff harness` 任務，順序在任何 widget 任務之前。
- **AC-4 (R3a)**: `Given` sr-engineer 接到任務，`When` workspace 含 `design/<feature>.md`，`Then` SOP 必須含 Phase 0.5 「Design-Aware Pre-Flight」：Read design 檔 + 相關 Visual Widgets row + 該 widget 之 baseline 路徑 BEFORE 任何 file edit。略過此步即違反 SOP。
- **AC-5 (R1)**: `Given` qa-engineer 收到 Phase 4 評估請求，`When` `design/<feature>.md` 含 `## Visual Baselines` H2，`Then` PASS 前 MUST 產出 `qa_reports/visual_<task-id>.md`，缺檔即 server 拒絕 PASS。
- **AC-6 (R6)**: `Given` AC-5 之 visual report，`When` 內容檢查，`Then` 文件 MUST 逐項對 spec `## Visual Widgets` 表打勾（per-widget shape verification），missing widget shape 即 FAIL（優先於 pixel diff %）。

### Constitution 層（R4, R4a, R5）

- **AC-7 (R5)**: Constitution §1 MUST 含明文例外：當 widget 列於 spec `## Visual Widgets`，以 HTML primitive 替代屬於 scope violation，非 MVP compliance。
- **AC-8 (R4)**: Constitution §3.1 MUST 新增 `visual_round` 子迴圈規約，獨立於 `qa_round` 與 `review_round`，cap 為 5 輪。
- **AC-9 (R4a)**: `Given` `visual_round=3`，`When` sr-engineer 判定任務無法在 LoC budget 內收斂，`Then` 允許 transition `(sr-engineer, In_Progress) → (pm, In_Progress)` 帶 `pending_notes: ['next_role: pm', 'visual_split_requested: <reason>']`；第 5 輪後僅允許 PM 路線（symmetric to qa_round circuit breaker）。

### Server enforcement 層

- **AC-10**: `tools/transitions.ts` MUST 新增 `visual_round` counter 處理；當 attempted PASS 且 `design/<feature>.md` 含 `## Visual Baselines` 且 `qa_reports/visual_<task-id>.md` 不存在 → server 回 `{error, attempted, allowed, hint}`，不寫入 storage。
- **AC-11**: handoff schema_version bump，新增 `visual_round: number` 欄位，預設 0；現有 handoff 透過 migration lazy 補欄位。
- **AC-12**: 全部測試通過（既有 + 新 AC 對應測試）。`npm run build` zero error。`npm audit --audit-level=high` 無新 HIGH/CRITICAL。

### Backwards compatibility

- **AC-13**: 無 `design/<feature>.md` 之 workspace（含本 repo dogfood）完全不觸發任何新 gate，行為等同 v3.13.0。
- **AC-14**: v3.13.0 之既有 `specs/*.md` 與 `*-architecture.md` 無需追溯補 Visual Widgets / Visual Harness 段（new-feature scope per user decision）。

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| err.visual_evidence_missing | `Visual baselines declared but qa_reports/visual_<task-id>.md not found. Run visual diff before PASS.` | authored-here — server error string for AC-10 gate; mirrors `qa_evidence_missing` error wording style in tools/transitions.ts |
| err.visual_widget_missing | `Spec ## Visual Widgets row not verified in visual report. Widget shape FAIL precedes pixel diff %.` | authored-here — AC-6 widget-shape gate; reinforces shape > pixel priority |
| sop.sr_engineer.phase_0_5 | `Phase 0.5 Design-Aware Pre-Flight: if design/<feature>.md exists, Read it AND the relevant ## Visual Widgets row AND each declared baseline path BEFORE any file edit.` | authored-here — AC-4 SOP directive |
| sop.pm.visual_widgets_intro | `Visual Widgets — every non-HTML-primitive control the feature renders, in a 3-column table widget id | description | source-node. Treating a listed widget as a primitive (e.g. <input type="date"> for a column-scroller picker) constitutes scope violation, not MVP compliance.` | authored-here — AC-1 schema description; cross-references R5 |

## Visual Tokens

N/A — 本 feature 純 framework 規約變更，無 user-facing UI literal。

## Visual Widgets

N/A — 本 feature 無 widget shape 需求（無 UI）。本段示範 Visual Widgets schema 在無 widget 工作上仍應出現並標 N/A（明文聲明、非省略）。

## Out of Scope

- 回頭追溯 v3.13.0 之前的 spec 補 Visual Widgets / Visual Harness 段（per AC-14）。
- code-reviewer 介入 visual review（per R-report Alternatives Considered A2 — 維持 clean-context property）。
- design-auditor 自動下載**全部** baseline PNG（per Alternatives A3 — token-budget cap 維持）。
- pixel-perfect threshold 之語意定義（per R-report Open Questions — 留待 PM per-feature 宣告，本 release 僅提供機制）。
- visual_round 之 cross-machine 同步（per CLAUDE.md：MCP server 非 cross-machine）。

## Dependencies / Prerequisites

- 答題批次決策（locked）：v3.14.0 MINOR / new-feature scope / strict server gate。
- `research/visual-fidelity.md` 為唯一外部 ref，已於 workspace，無需 fetch / index。
- `specs/qa-flow-enforcement-architecture.md` 需同步更新 transition matrix（列為 T09 任務）。
- `bin/agent-governance-context.mjs` SessionStart hook 行為不變（不需動）。
- `prompts/build.ts` 不需動（skills 自動納入）。

## Task Breakdown (architect 之後 sr-engineer 依此實作)

11 個任務，每個 ≤ 5 files / 300 LoC：

```
T100 [P0] Constitution §1 MVP exception + §3.1 visual_round + §4 chain note | depends_on: none
T101 [P0] skill-pm Visual Widgets schema + R5 cross-ref | depends_on: T100
T102 [P0] skill-design-auditor Visual Widgets extraction contract | depends_on: T101
T103 [P0] skill-architect Visual Harness Artifact Schema + harness task ordering | depends_on: T100
T104 [P0] skill-sr-engineer Phase 0.5 Design-Aware Pre-Flight | depends_on: T100
T105 [P0] skill-qa-engineer Phase 1.5 PASS-gated + skill-qa-visual widget-shape verify | depends_on: T100
T106 [P0] handoff schema bump (visual_round field) + migration | depends_on: T100
T107 [P0] tools/transitions.ts visual_round + R1 evidence gate + R4a split escalation; tools/evidence-file.ts visual check | depends_on: T106
T108 [P1] specs/qa-flow-enforcement-architecture.md matrix update | depends_on: T107
T109 [P0] Tests: visual-evidence-gate / visual-round-transitions / widget-shape-spec / phase-0-5-sop | depends_on: T107
T110 [P1] CHANGELOG / README / package.json + index.ts version bump 3.13.0 → 3.14.0 | depends_on: T109
```

Next role: **architect** — 需 architecture 決定 server-side `## Visual Baselines` 偵測機制（讀 design 檔 vs 標記在 handoff）、`visual_round` storage 位置（handoff vs 獨立檔）、widget-shape 驗證之文字解析策略（structured table vs free text）、以及 transitions 矩陣完整圖。

— @pm
