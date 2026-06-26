# 事故報告 — F2 set-date-panel「編框被切掉」漏網事件:qa-visual 假綠燈

> 類型:流程缺陷事後檢討(process post-mortem)。
> 對象讀者:之後另開 session 修正 **agent-governance-mcp** 架構的人。
> 日期:2026-06-25。撰寫者:coordinator-lite(唯讀證據彙整)。
> 相關 feature:104445-F2-set-date-panel(已被標記 PASS,但帶有未抓到的視覺缺陷)。

## 1. 一句話總結

F2 的「選取藍框被切掉 / 群組外框未對齊 Figma」缺陷**通過了 QA**,根因是 **qa-visual 在像素比對失效時,降級成 DOM 結構斷言放行(structural-only PASS),而結構斷言在設計上抓不到佈局幾何溢出**。這是一個**假綠燈**:PASS 不該成立。

## 2. 缺陷現象

- 現況(impl):日期面板的 active 欄「選取藍框」貼齊面板左緣被切掉;Figma 的圓角群組外框幾乎不可見;左緣有一條 shell 選取帶滲出的藍細邊。
- Figma(應該):圓角 `#666666` 群組外框完整包住三欄並有內距;選取藍框內縮在群組框內、左右有 margin。

## 3. 程式層面的 bug 源頭(供修 F2 時參考,非本報告重點)

`src/components/SetDatePanel.tsx`:
1. **欄寬衝突**:每欄同時有 `flex-1 min-w-0`(flex-basis:0,可壓縮)與 inline `width:144`。三欄 144 + 2×gap-12 + 2×padding-12 = **480 > 群組框寬 472** → flex 壓縮欄寬 → 幾何偏離 design audit 基準。
2. **選取藍框未內縮**:active center row 用 `bg-selected-bar w-full`(滿欄寬貼邊),而非 Figma 的「內縮於群組框、帶圓角 margin」。

## 4. 流程根因:qa-visual 為何放行

### 4.1 直接證據(`qa_reports/visual_SD-T08.md`)

- **AD-F2-1**:F2 baseline 以 **@1×** 匯出(1280×720 全幅 / 504×592 卡片),慣例是 @2×。
- `comparePngRegion` 偵測到 `dimensionsMatch=false` → **graceful skip,完全沒跑像素 diff**(`diff-metric: N/A`,兩個 surface 皆然)。
- PASS 唯一依據 = **40 條 DOM 結構斷言**(data-attribute / computed style)。
- 報告 Verdict 原文:「Pixel diff skipped (AD-F2-1: @1x baseline vs @2x impl — structural-only PASS per qa-visual decision)」。
- 報告甚至自承:「Re-export at @2x **recommended for a future sprint**」——**明知 gate 有洞仍放行**。

### 4.2 為什麼 40 條結構斷言抓不到

這個缺陷是**元素之間的相對佈局幾何溢出**;結構斷言查的是**單一元素的屬性值**。兩者正交:

| 結構斷言查了 | 結果 | 為何漏掉 |
|---|---|---|
| `Width 504px exact` | PASS | 查的是 **shell** 寬,非內層群組框 |
| `Group box 1px border #666666` | PASS | border **存在** ≠ 沒被切到 |
| `Column border-radius 12px` | PASS | 圓角值對 ≠ 欄位實際寬度正確 |
| `Active col bg-selected-bar fill` | PASS | 藍框**存在** ≠ 有內縮在框內 |

→ 幾何溢出只有**像素比對**會抓到;DOM 斷言天生看不到「被切掉」。

## 5. 三個環節的責任歸屬

| 環節 | 責任 | 性質 |
|---|---|---|
| baseline 來源 | F2 baseline 用 @1× 匯出(錯誤解析度) | **觸發點** |
| sr-engineer | `flex-1` + inline `width` 衝突幾何 + 藍框未內縮 | **bug 源頭** |
| **qa-visual** | 像素 gate 失效時降級結構斷言放行,而非擋下 | **最該負責 — 假綠燈** |

依 Constitution §3.2 / coordinator「Visual Verdict Boundary」:**獨立視覺判定無法執行時應 `Blocked`,不得自行放行**。本案 qa-visual 用 DOM 斷言**代償**了缺失的像素 gate,違反此原則。正解是 **FAIL/Blocked + 要求重出 @2× baseline**。

## 6. 對 agent-governance-mcp 架構的修正建議(本報告主要目的)

> 以下是「讓這類假綠燈在制度上不可能發生」的候選機制,供另一 session 設計時取捨。

### R1 — 像素 gate 不可被「結構斷言」代償(防降級)
qa-visual 的 PASS 必須附帶**有效的像素 diff 數據**(實際 `diff-metric` 數值,非 `N/A`)。當 `dimensionsMatch=false` / 工具不可用 / 比對被 skip 時,server 應**拒絕 `status=PASS`**,只允許 `FAIL` 或 `Blocked`。目前「structural-only PASS」是合法路徑——應移除。

### R2 — baseline 解析度契約化(arm 即驗)
baseline 與 impl 截圖的維度/scale 必須一致(@2× 慣例)。維度不符時,視為**證據缺失**而非「Allowed Difference」。`comparePngRegion` 的 `dimensionsMatch=false` 不應是「graceful skip → accepted」,而應是**硬性 FAIL 訊號**。

### R3 — 「Allowed Differences」不得涵蓋 gate 本身失效
目前 AD-F2-1 把「整個像素比對被跳過」當成一條 Allowed Difference。AD 的本意是**個別已知差異**(如 anti-aliasing),不該用來豁免**整個比對機制的缺席**。server/skill 應禁止 AD 條目的效果等同「跳過 gate」。

### R4 — 「自承待辦」即阻擋
報告若出現「recommend for a future sprint / TODO / re-export later」這類**自承 gate 不完整**的字樣,不應同時 `PASS`。可由 server 對 qa_review 文字做關鍵字檢查,或要求 qa-visual 明確聲明「本次像素 gate 完整執行」才放行。

### R5 — 區分「視覺契約變更」與「新功能」
F2 改動會改變既有視覺契約,但目前流程把它當一般新 feature。建議在 baseline 缺失/過期時強制回 design-auditor 重取,而非讓 qa-visual 自行用 stale baseline(AD-F2-4 的 Done 鈕也是 stale baseline 問題)放行。

## 7. F2 本身的後續(與架構修正分開)

`/teamwork` 開 F2-fix:① design 重出 @2× baseline ② sr-engineer 修 `SetDatePanel` 欄寬幾何 + 藍框內縮(對 Figma node `494:22260`)③ qa-visual **必須**跑真實像素 diff,禁止 structural-only。在架構修好前,需人工盯這次的視覺驗收。

## 8. 附:可複用的偵測啟發

未來任何 qa-visual 報告出現以下任一,即視為**可疑的假綠燈**,需人工複核:
- `diff-metric: N/A` 或 `dimensions match: NO` 卻 `Verdict: PASS`
- `structural-only PASS` / `DOM ... is the PASS gate`
- Allowed Difference 內含「skip」「graceful」「future sprint」「re-export later」
