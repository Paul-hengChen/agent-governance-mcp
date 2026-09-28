# Feature: multi-agent-pipeline (Antigravity PM/Design → Claude Build/QA 跨 CLI 串接)

> **狀態:草案 / 待下一個 session 接手研究與實作。**
> 本檔是交接給下一個 session 的 feature spec。**尚未**寫入 governance 狀態
> (`.current/handoff.md` 目前是另一個 feature `handoff-write-arg-guard` 的
> PASS 狀態待 release-engineer,未被覆蓋)。下一個 session 請以 `/teamwork`
> 進入,由 PM 依本檔 bootstrap `handoff.md` + `tasks.md`。
>
> **背景研究全文見 `research/multi-agent-script.md`**(已含 token 成本、
> Antigravity 效果、業界比較、Recommendation、Open Questions)。
> 原始評估見 `multi-agent-scripts/*.md`。

---

## Goal

讓 Antigravity CLI(Gemini 3 Pro)負責 PM/Design 階段、Claude CLI 負責
architect→sr-engineer→QA,透過 agent-governance-mcp 既有的 file-based handoff
(`.current/handoff.md` + `tasks.md`)串接。目的:把 PM/Design 的 token 成本
分擔到較便宜的 Gemini,並善用 Antigravity 的 Artifacts/browser 在規格與視覺
產出上的優勢。**使用者主動觸發 + 單程交接**(非雙向自動迴圈)。

## 架構(兩個入口,共用一支 pipeline)

- **入口 2(terminal 直接跑,先做)**:`pipeline.sh "<prompt>"` 在真實終端內
  依序跑 `agy`(PM/Design,互動)→ review gate → `claude`(build/QA)。腳本
  自己掌控 agy→claude 順序。
- **入口 1(對話框觸發,後做)**:Claude 對話框內用 `osascript` 開新 iTerm
  視窗跑 `pipeline.sh "<我整理的 brief>"`。新視窗有獨立 TTY,繞開子進程無
  TTY 問題(`dual-agent.sh` 已證明 osascript 開窗可行)。入口 1 = 開終端 +
  把對話結論當 prompt 餵給入口 2 的腳本。

切分點 `pm → architect/sr-engineer` 落在既有 `tools/transitions.ts` 轉換邊,
**server / 狀態機零改動**。

## context 傳遞(必做,不可省 — 多代理頭號失敗模式是上下文遺失)

- **方案 A**:`.ai-pipeline/00-discussion-summary.md`(PM 階段結束前產出的
  對話決策摘要),`pipeline.sh` 啟動 Claude 時讀取並注入 prompt。
- **方案 B**:結構化 todo 寫入 handoff `pending_notes`,Claude `tw_get_state`
  時進 context。
- **否決方案 C**:原始 transcript 注入(token 災難 + 噪音)。

---

## Tasks(交給下一個 session 的 PM 拆解;以下為建議分解)

### T0 [P0] 先實測 Antigravity ↔ agent-governance-mcp 連線(阻斷性前提)
**這是整個 feature 的單點依賴,沒過後面全部白做。** 用一個小 feature 手動跑:
`agy` 啟動 → 確認能連同一個 agent-governance-mcp server → `tw_get_state` 可讀
→ `tw_switch_role("design-auditor")` 能正確載入 SOP → 寫出的
`.current/handoff.md` 內容合規。
- **AC-T0.1** Antigravity CLI 能呼叫 `tw_get_state` 並取得正確 workspace state。
- **AC-T0.2** `tw_switch_role("pm")` / `tw_switch_role("design-auditor")` 能載入對應 SOP 文字。
- **AC-T0.3** Antigravity 寫的 handoff.md 通過 `parseHandoff`(schema_version 正確、`pending_notes` 含 `next_role:`)。
- **AC-T0.4** 量測:記錄 PM/Design 段 input/output tokens,對照 `research/multi-agent-script.md` 的省額試算。
- **若 AC-T0.1~T0.3 任一不過 → STOP,回報使用者,不進 T1。**

### T1 [P0] 寫 `multi-agent-scripts/pipeline.sh`(入口 2,串接)
真實終端內 sequential:`agy -i "PM/Design: <prompt>"`(互動,使用者退出 agy
才往下)→ 解析 `.current/handoff.md` 的 `next_role` + `active_feature` →
`claude "讀 tw_get_state,從 <next_role> 接手到 QA PASS"`。
- **AC-T1.1** 無 handoff.md / 無 `next_role` 時 graceful 報錯退出。
- **AC-T1.2** 只有 `next_role ∈ {architect, sr-engineer}` 才啟動 Claude 段。
- **AC-T1.3** 啟動 Claude 前注入 `.ai-pipeline/00-discussion-summary.md`(存在時)。
- **AC-T1.4** Bash:`set -euo pipefail`;`next_role`/`active_feature` 解析需處理引號與空白。

### T2 [P1] 加 review gate(propose-then-commit 的人核可點)
agy 退出後、claude 啟動前,印出 spec/tasks 路徑,等使用者 Enter 才繼續
(Ctrl-C 中止)。
- **AC-T2.1** gate 顯示 `active_feature`、`next_role`、待審檔案路徑。
- **AC-T2.2** Enter → 繼續;Ctrl-C / 非預期輸入 → 乾淨中止,不啟動 Claude。

### T3 [P2] 對話框觸發 wrapper(入口 1)
Claude 端用 `osascript` 開新 iTerm 視窗跑 `pipeline.sh "<distilled brief>"`。
brief = 對話結論的濃縮(**不是** transcript)。
- **AC-T3.1** 新視窗有獨立 TTY,agy 能正常互動(非 headless 退化)。
- **AC-T3.2** 餵入的 prompt 是濃縮 brief,非原始對話紀錄。
- **AC-T3.3** 沿用 T1 的 `pipeline.sh`,wrapper 不重造接力邏輯。

---

## 設計決策(已定,勿重議)

- **單程交接**:QA 返工多數回 sr-engineer(留在 Claude 內);回 PM 罕見,
  不為雙向自動迴圈加複雜度。罕見時人工重啟 Antigravity。
- **使用者主動觸發**,非 agent 自我偵測 model 名稱(字串匹配脆弱)。
- **互動式 PM**(`agy -i`),非 headless(`-p`)——PM 價值在能與人來回問。

## Open Questions(見 research/multi-agent-script.md 完整版)

1. Antigravity 對重角色 SOP(design-auditor ~17KB)的遵從度?(T0 順帶觀察)
2. 跨 CLI 實際省額 > 協調 overhead?(T0.4 量測後再決定是否值得維護兩套 CLI)
3. Gemini 3 Pro >200K context 價格跳 $4/$18;PM 注入大量 PRD/Figma 是否越界?
4. 是否需要 `.antigravityrules` 指引 Antigravity 走 PM+Design 流程?

## 參考

- `research/multi-agent-script.md` — 完整研究(成本/效果/業界比較/建議)
- `multi-agent-scripts/multi_agent_architecture.md` — 原始架構草圖
- `multi-agent-scripts/dual-agent.sh` — osascript 開窗範例(入口 1 基礎)
- `multi-agent-scripts/user_triggered_handoff_evaluation.md` — handoff.sh 草案 + context 傳遞方案 A/B/C
- `tools/transitions.ts` — 狀態機轉換邊(切分點所在)
