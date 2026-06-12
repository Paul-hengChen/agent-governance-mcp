# Research: 自動化開發流程回顧 — CDE OOBE「Orientation」功能（visual_round 1 FAIL）

> Topic: 本次 `/teamwork` 鏈在實作 Orientation 步驟時的 token 消耗，以及 **QA 第 1 輪 FAIL 的明確根因** —— 為什麼又燒 token。
> Scope: 單一功能（Orientation, A.3.2）。資料來源為本 session 的 subagent 遙測（每次 dispatch 回傳的 `<usage>` 區塊）+ handoff state。
> 狀態：**本功能尚未完成**。截至撰寫時停在 `status=FAIL / visual_round=1`，補 hook 的 sr-engineer dispatch 因撞 Opus session limit 回傳 0 token，迴圈卡住（reset 23:30 Asia/Taipei）。

---

## 問題明確陳述（先講結論）

**本次 FAIL 不是正確性缺陷，也不是視覺保真度偏差，而是一個「完全可避免」的測試可達性（test-reach）契約缺口。**

- design-auditor 凍結了 **4 張 baseline，分別描繪 4 種不同的 canonical UI 狀態**：
  1. `412:6217` — 預設 3 卡、Auto focused
  2. `721:30289` — 無 Auto 的 2 卡裝置、Landscape focused
  3. `3696:36357` — Portrait active（committed）
  4. `3696:35942` — Auto active、Back 鍵 focused
- architect 的 DR-11 **只定義了一個** test-reach hook：`?step=orientation`。
- 結果 QA 只能把 **1 / 4** 張 baseline 驅動到拍攝狀態（`412:6217` → 2.712% diff，通過），其餘 3 張**根本無法進到對應狀態**（缺 `?committed=` 與 `?noauto=` URL hook），只能判 **FAIL**。
- 這個缺口在 **architecture 階段就可在紙上驗出**（純介面設計問題），卻一路到 **最貴的 QA playwright 擷取階段（162 工具呼叫 / 40 分鐘）** 才被發現。發現它之前，已花掉 design→pm→architect→sr→reviewer→qa R1 共 **~529k token**。
- 修正本身極小（1–2 檔，只動 `src/App.tsx` 的 `initialStepFromQuery`），但因為迴圈設計，必須再跑 **整輪 sr → code-reviewer → qa**。

**一句話：4 張 baseline 需要 3 種 canonical 狀態才能擷取，但只規格化了 1 個可達 hook —— 這個對照在設計時就該存在，卻在 40 分鐘的 QA 後才爆，逼出整個第二輪。**

> 注意：這與上一個功能（Language）的根因**不同**。Language 是像素幾何逐輪收斂（4 輪 region-weighted 修正）；Orientation 是 test-reach 契約缺口（目前 1 輪、可完全避免）。兩者**共用**的成本放大器是「單一畫面跑滿 6 角色、全程 Opus tier」。

---

## Summary

- **可量測 subagent token = 528,945**（≈ 0.53M，約為 Language 那輪 1.05M 的一半 —— 但本功能**尚未完成**，第二輪 sr+reviewer+qa 還沒跑，最終成本會更高）。
- **沒有任何一個角色超過 21%**，分佈比 Language 平均（Language 是 qa+sr 佔 74.5%）。本次最貴的單次 dispatch 是 **qa-engineer：162 工具呼叫 / 40 分鐘**，反映視覺擷取的固有成本。
- **燒 token 的真正原因是「可避免的整輪重工」**：FAIL 的修正只需動 1–2 檔，卻要重跑 sr→reviewer→qa。重工成本 ≈ 半個 feature。
- **根因可前移**：baseline 能不能被擷取，是 architecture 階段的紙上可驗問題，本次卻拖到 QA 才發現。
- **次生問題**：補 hook 的 sr-engineer 撞 Opus session limit（0 token），迴圈當前停滯；好消息是修正不需重跑任何上游角色。

---

## Evidence

所有 token / 工具呼叫 / 耗時數字皆引自本 session 各 subagent 回傳的 `<usage>` 區塊 [T1: session telemetry]。FAIL 細節引自 `tw_get_state` 的 handoff `blocking_reason` 與 `pending_notes` [T1: handoff state]。

### 1. 逐次 dispatch 明細（依時間順序）

| # | 角色 / 任務 | subagent_tokens | tool_uses | duration_ms |
|---|---|---:|---:|---:|
| 1 | design-auditor（抽 4 張 Figma frame + baseline） | 108,777 | 16 | 289,615 |
| 2 | pm（寫 specs/Orientation.md + ORI01–06） | 52,226 | 29 | 295,269 |
| 3 | architect（藍圖 DR-1…DR-11） | 85,807 | 27 | 257,108 |
| 4 | sr-engineer（實作 ORI01a/b–ORI06） | 109,475 | 59 | 635,047 |
| 5 | code-reviewer（APPROVED, round 1） | 84,945 | 28 | 213,197 |
| 6 | qa-engineer（R1 **FAIL**：3/4 baseline 無法擷取） | 87,715 | **162** | **2,413,063** |
| 7 | sr-engineer（補 hook；撞 session limit） | **0** | 0 | 480 |
| | **總計（截至 FAIL）** | **528,945** | **321** | **4,103,779** |

牆鐘活躍時間合計 ≈ **4,103,779 ms ≈ 68.4 分鐘**（本次無跨夜閒置異常值）。第 7 列為 0-token stall：Opus session limit 觸發，dispatch 未實際執行。

### 2. Token 佔比（分母 = 528,945）

| 角色 | tokens | 佔比 |
|---|---:|---:|
| sr-engineer（實作） | 109,475 | 20.70% |
| design-auditor | 108,777 | 20.56% |
| qa-engineer（R1 FAIL） | 87,715 | 16.58% |
| architect | 85,807 | 16.22% |
| code-reviewer | 84,945 | 16.06% |
| pm | 52,226 | 9.87% |

依階段：截至 FAIL 為止 **100% 屬「第一次建置」**；返工尚未發生（被 session limit 卡住）。一旦第二輪 sr+reviewer+qa 跑完，返工佔比預估會跳到 ~30–40%。

工具呼叫：總 321 次，其中 **qa R1 佔 162 次（50.5%）** —— 諷刺的是其中大部分是「嘗試把無法到達的狀態驅動出來」的失敗探查，而非有效的像素量測。

### 3. 成本換算（Opus 4.8：$25/M out）[T1]

| 情境 | 估算 |
|---|---:|
| Output-only 下限（截至 FAIL） | 0.529M × $25/M = **$13.22** |
| 含第二輪返工（預估 sr+reviewer+qa ≈ +260k） | + ~$6.5 → **~$20**（output-only 下限） |
| 含 input + coordinator context（未快取） | 實際帳單估 **$25–55 區間，低信心** |

成本約為 Language 那輪（$26 下限）的一半，但**因為功能未完成，且 FAIL 屬可避免，這 $13+ 的相當比例是純浪費**。

### 4. FAIL 根因鏈 [T1: handoff blocking_reason + pending_notes F-01/F-02]

1. **baseline→reach-hook 對照缺失**：4 張 baseline 隱含 4 種 canonical 狀態，DR-11 只列了 `?step=orientation` 一個 hook。沒有任何一個角色產出「哪個 URL/狀態能驅動哪張 baseline」的對照表。
2. **檢查點放在最後而非最前**：「QA 能否擷取到每張 baseline 的狀態」是 architecture 階段的純介面問題，可紙上驗證；卻在 build + review + qa R1（~529k token）之後才暴露。
3. **全鏈 Opus**：單一畫面跑滿 6 角色，每個 subagent 都是 opus tier —— 與 Language 回顧相同的結構性成本放大器。
4. **session-limit 次生 stall**：補 hook 的 sr dispatch 回 0 token，迴圈停在 visual_round 1。所幸修正只動 `src/App.tsx`，session reset 後可直接續做，無需重跑上游。
5. 平心而論：sr 第一次實作通過 code review、Language baseline 零迴歸、build 乾淨；QA 完全盡責（正確拒發無法擷取的 PASS）。問題在**契約完整性**，不在任何單一角色的執行品質。

---

## Recommendation

**首選：把「baseline × reach-hook 對照表」訂為 architect 的強制交付物，並把所有 reach hook 與建畫面的 sr 任務綁在同一輪。**

具體：
1. **architect 升級 — Baseline Reachability Matrix**：凡是有 N 張凍結 baseline 的功能，architect 必須產出一張表，把每張 baseline → 驅動到該擷取狀態的**確切確定性機制**（URL query / store seed / prop）對應起來。此表紙上可驗、不需 build。納入視覺證據閘門的前置條件。
2. **所有 reach hook 與建畫面同任務交付**：本次應把 `?committed=` / `?noauto=` 一起放進 DR-11 / ORI01，整個第二輪即可消失。
3. **可達性前移為 architect 或 sr 的自檢**：在完整 build 前，先確認每張 baseline 狀態都可被驅動（cheap smoke），把 40 分鐘的 QA 昂貴發現往前挪到便宜階段。
4. **tier 紀律（沿用 Language 回顧）**：pm、純機械式的 sr 修正可改 sonnet；design-auditor / qa 這種高 tool_use 的維持 opus。本次每角色 <21% 的均衡分佈，意味降 tier 的邊際效益對每個非設計判斷角色都成立。
5. **把以上寫進 `CLAUDE.md` / architect 規則**，讓後續步驟（Mode、Network…）不再重蹈 test-reach 缺口。

成本/風險權衡：Reachability Matrix 是零風險的純文件前移，省下的是整輪 sr+reviewer+qa（本功能預估省 ~30–40% 最終 token）。

---

## Alternatives Considered

- **維持現狀（reach hook 等 QA 發現缺什麼再補）**：每個非預設 baseline 都可能觸發一次「QA 擷取失敗 → FAIL → 補 hook → 重跑整輪」。對 7 步 OOBE 會反覆發生，否決為預設。
- **讓 QA 自己加 reach hook**：違反憲法 §2（只有 sr 改產品碼、只有 qa 寫測試）；且 builder ≠ judge 的邊界會破。否決。
- **放寬視覺閘門、允許 QA 跳過無法擷取的 baseline**：等於放棄 3/4 的視覺證據，回到 false-PASS 風險（憲法 §3.2 禁止）。否決。

---

## Open Questions

- **`subagent_tokens` 確切定義未知**（沿用 Language 回顧的保留）：本報告假設其 ≈ output token。精算需從 `agent-*.jsonl` 讀 `usage.input_tokens` / `output_tokens` / `cache_*`（憲法 §coordinator v3.31.0 已認可此來源）。**此為成本僅低信心的主因。**
- **最終總成本未定**：第二輪 sr+reviewer+qa 尚未執行（session limit），返工佔比為預估值，待迴圈收尾後回填。
- **coordinator 自身 context 開銷未量測**：每次 /teamwork 注入完整憲法，不在 subagent_tokens 內。
- 來源信心：硬數字皆 T1（session 遙測 + handoff state），無 T3 依賴。
