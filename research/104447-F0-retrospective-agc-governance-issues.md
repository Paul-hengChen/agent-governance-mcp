# 104447-F0 Summary Screen 實作回顧 — 問題記錄與 agent-governance-mcp 改善建議

- **日期**：2026-07-14（實作日）／ 2026-07-15（本報告）
- **Feature**：`104447-F0-summary-screen`（Ticket 104447 兩件拆分中的 F0：Step 7 Summary 視覺層，點 1–3）
- **最終結果**：PASS（qa-engineer，2026-07-14T12:13:15Z = 20:13 台北時間）
- **記錄者**：coordinator（`/teamwork continue` 恢復 session）
- **證據來源**：`.current/handoff.md`、`.current/telemetry.jsonl`、`qa_reports/review_SM-T05.md`、`qa_reports/visual_SM-T06.md`、`qa_reports/visual_SM-T05.md`、檔案 mtime、本 session 的 subagent usage 回報

---

## 1. 時間軸重建（台北時間 UTC+8，2026-07-14）

| 時間 | 事件 | 證據 |
|---|---|---|
| ~16:08 | design-auditor 階段進行中（有一筆 `TRANSITION_REJECTED`） | telemetry 08:08:58Z |
| 16:08–16:41 | design-auditor → pm → sr-engineer → code-reviewer 鏈完成（hop_count 累計至 4）；SM-T01..T04 實作 + APPROVED | handoff `review_verdict: APPROVED`、`review_reports/review_SM-T01.md` |
| 16:41 | qa-engineer 被派工（SM-T05 / SM-T06） | handoff `dispatched_at: 08:41:03Z` |
| 16:51 | 死亡前 QA：`tests/visual/summary-unit.spec.ts`（47 tests）寫完 | 檔案 mtime |
| 17:02 | 死亡前 QA：Figma baseline `summary-step7-f0-default.png` 抓完（node 5228:22321） | 檔案 mtime |
| 17:07–17:10 | 死亡前 QA：`summary.spec.ts`（21 tests）、`visual_SM-T06.md`、`review_SM-T05.md` 寫完；把全套回歸丟到背景後 **session 死亡，未寫任何狀態** | 檔案 mtime；handoff 無更新 |
| 17:10–19:05 | **~1 小時 55 分純空轉等待** — 沒有任何機制通知人類或 coordinator 該 session 已死 | `stale_dispatch.elapsed_minutes: 144` |
| ~19:05 | 本 session（`/teamwork continue`）啟動：偵測 `stale_dispatch` advisory → 執行 Crash-Resume Protocol（ground-truth 工作樹）→ `tw_sync` 修復 SM-T01..T04 drift | tw_get_state / tw_sync 結果 |
| ~19:10–19:18 | Crash-Resume 派工 #1（qa-engineer subagent）：跑了 7.4 分鐘後又把測試丟背景、自行停下等通知（**第二次差點斷鏈**） | usage: 73,457 tokens / 29 tool uses / 446.5s |
| ~19:18 | coordinator 以 SendMessage 強制其收尾（「不要停下等待」） | 本 session 記錄 |
| 19:18–20:13 | 恢復後 QA 完整收尾：重跑全部測試、隔離證明 17 個既有失敗、PNG 鑑識、證據 schema 重工、落 PASS | usage: 178,584 tokens / 47 tool uses / 3,545.7s（59.1 分鐘） |
| 20:06:19 | 第一次 PASS 嘗試被拒：`VISUAL_EVIDENCE_MISSING` | telemetry 12:06:19Z |
| 20:07:10 | 第二次被拒：`VISUAL_REPORT_INCOMPLETE` | telemetry 12:07:10Z |
| 20:12:43 | 第三次被拒：`AC_EXECUTION_LOG_MISSING`（H2 標題字串不完全吻合） | telemetry 12:12:43Z |
| 20:13:15 | **PASS 落地**（連續三次 gate 重工後） | handoff `last_updated: 12:13:15Z` |

### 關鍵耗時彙總

| 項目 | 時長 | 備註 |
|---|---|---|
| QA 派工 → PASS 全程 | **3 小時 32 分**（16:41→20:13） | |
| 其中：死亡 session 有效工作 | ~29 分鐘（16:41→17:10） | 實際完成了 ~90% 的 QA 工作 |
| 其中：**無人察覺的空轉等待** | **~1 小時 55 分**（17:10→19:05） | 全程最大浪費，佔 54% |
| 其中：Crash-Resume 鑑識 + 重新派工 | ~13 分鐘 | coordinator 端 |
| 其中：恢復 QA 重驗 + 收尾 | ~66 分鐘 | 含約 25 分鐘全套回歸 ×3 輪隔離跑 |
| 其中：證據 schema gate 重工迴圈 | ~7 分鐘（20:06→20:13） | 三連拒 |

## 2. Token 消耗

| 段落 | tokens | tool uses | 時長 | 資料品質 |
|---|---|---|---|---|
| design-auditor → pm → sr → code-reviewer（前段鏈） | **未記錄** | — | ~33 分 | ❌ 無 `usage.jsonl`（token sidecar 未啟用），無法回溯 |
| 死亡的 qa-engineer session | **未記錄** | — | ~29 分有效 | ❌ session 死亡連 usage 都蒸發 |
| Crash-Resume 派工 #1（中途自停） | 73,457 | 29 | 7.4 分 | ✅ subagent usage 回報 |
| 恢復收尾（SendMessage 續跑） | 178,584 | 47 | 59.1 分 | ✅ subagent usage 回報 |
| coordinator 本體（鑑識、路由、drift sync） | 未精確記錄 | ~15 | — | ⚠️ 主迴圈無逐段計量 |
| **可量測合計（僅恢復段）** | **≥252,041** | 76+ | | |

**觀察**：可量測的 25 萬 tokens 全部是「恢復」成本——其中相當比例（估 30–40%）花在重做死亡 session 已做過但無法信任的驗證（重跑測試、重讀檔案、重建證據格式）。若死亡 session 的結果有 checkpoint 持久化，這筆恢復成本大部分可省。同時 `tokenBudgetPerFeature` 煞車因為根本沒有 usage 記錄管道，在本 workspace 是永遠不會觸發的死規則（見 §4-A1）。

---

## 3. 實作期間遇到的問題（依影響排序）

### P1 — qa-engineer session 無聲死亡，零狀態殘留（最嚴重）

- **現象**：QA 完成了 ~90% 工作（68 個測試、3 張 baseline、2 份報告）後把全套回歸丟到背景，session 被外部終止。Constitution §3 要求「crash 時仍要寫 `tw_update_state` 記失敗」，但被 kill 的 process 做不到——這條規則對最常見的死法（session/usage-limit kill）在物理上不可執行。
- **代價**：1h55m 空轉 + 25 萬 tokens 的恢復成本 + coordinator 必須做 git 考古來重建「它到底做到哪」。
- **現有機制的表現**：`stale_dispatch` advisory（15 分鐘門檻）**有效偵測到死亡**，Crash-Resume Protocol 的三步驟（ground-truth → 重述 → pin 重申）**流程本身是好的**——問題在偵測是被動的（要等下一次 `/teamwork` 才看得到）以及沒有任何進度殘留可信任。

### P2 — 恢復派工又差點斷鏈一次（背景等待無合法表達）

- **現象**：Crash-Resume 派工的新 QA 重蹈覆轍：把長回歸丟背景後回覆「我停下來等通知」就結束 turn。若 coordinator 沒有主動 SendMessage 追擊，這會是第二次 stale dispatch。
- **根因**：治理狀態機沒有「工作沒死、在等長時間證據」的狀態。`In_Progress` 之後唯一合法動作是持續工作或寫終態；等待外部事件（1 小時的回歸套件）落在規則空白區，每個 agent 只能自行發明行為。

### P3 — 證據 schema gate 三連拒（規則在崩潰前後變嚴 + 字串比對太脆）

- **現象**：PASS 前 7 分鐘連吃三個拒絕：
  1. `VISUAL_EVIDENCE_MISSING` — 死亡前寫的 visual 報告缺新版 `skill-qa-visual` 要求的段落（Widget Shape Verification / Canonical State Verification / Region Diff 等）。
  2. `VISUAL_REPORT_INCOMPLETE` — 補格式後仍缺項；且舊報告用的全幀 pixel diff 已是被禁指標，被迫重算 region-crop 對齊 diff（5.74% naive → 3.98% shift-aligned）。
  3. `AC_EXECUTION_LOG_MISSING` — H2 標題寫 `Phase 3.5 — AC Execution Log`，gate 要求一字不差的 `AC Execution Log`。
- **評價**：gate 攔截本身是正當的（證據品質確實提升了），但（a）schema 沒有版本協商，做到一半規則變嚴只能重工；（b）用 markdown 標題字串當機器介面，比對失敗的錯誤訊息也不會告訴你差在哪個字。

### P4 — 兩張既有截圖被改動的虛驚（鑑識成本）

- **現象**：`git status` 顯示 `datetime-step5-f2-impl-panel-open.png`、`network-step4-f2-impl-316.png` 被修改，一度懷疑 summary 動到共用檔（App.tsx / ScreenShell / useKeyboard / wizard router）造成視覺回歸。
- **結論**：良性。`time.spec.ts` / `network.spec.ts` 的 `ACTUAL_DIR` 直接指向 `tests/visual/`，每次執行都會覆寫 actual 截圖；pixelmatch 對 HEAD 差異 0.0105% / 0.0105% /（連帶第三張 0.0002%），是抗鋸齒雜訊。
- **深層問題**：actual-capture 產物和 committed baseline 混在同一目錄，每次跑測試都污染 `git status`，讓「真的視覺回歸」和「例行覆寫」無法一眼區分——這次為了排除它花了一整輪 pixelmatch 鑑識。屬於 repo 慣例問題，但治理層的 qa-visual skill 可以規範 actual 輸出目錄。

### P5 — 全套回歸 17 個既有失敗（遺留債，隔離證明成本高）

- **現象**：`npx playwright test tests/visual` → 1350 passed / **17 failed**（energystar / mode / mode-unit / modeconfig / modeconfig-mpvf / network 系列），summary 相關 0 失敗。
- **隔離證明**（做得很紮實但很貴）：`--workers=1` 重跑（排除平行競爭）+ `git stash` 4 個 summary 觸碰的共用檔回 HEAD 重跑——兩次失敗集合逐 byte 相同，證明與本 feature 零因果。兩輪全套回歸約佔恢復段 25 分鐘。
- **後續**：這 17 個失敗是無主遺留債，目前只活在 QA 報告的附錄裡。**建議另開 ticket**，否則每個後續 feature 的 QA 都要重付一次「證明不是我弄壞的」成本。

### P6 — 歷史 vibe drift 噪音（105 筆）

- **現象**：`tw_detect_drift` 報出 105 筆 tasks.md 已勾但 handoff 沒有的歷史完成項（T05…SL-T04，跨十幾個早已 merge 的 feature）。`tw_sync` 正確拒絕自動提升，但唯一正規清理路徑是逐項 qa PASS 或 `tw_rollback_task`——對歷史項不現實。
- **代價**：每次 drift 檢查都是 105 行噪音，稀釋真信號；本次 SM-T01..T04 的真 drift 混在裡面要人工分辨。

### P7 —（輕微）§6 git 白名單詞彙缺口

- QA 隔離證明用了 `git stash` / `stash pop`——用得完全正確，但 §6 的 sanctioned 清單（add/commit/tag/ff-push）和 forbidden 清單（reset/rebase/clean/force）都沒有 stash。嚴格讀是「未經許可的 mutation」。規則詞彙表不完整，正確行為被迫落在灰區。

---

## 4. agent-governance-mcp 值得討論與修正的地方

### A. 高優先：故障恢復（本次最痛）

**A1. Crash checkpoint / 進度持久化管道**
- 問題：§3「crash 時仍要寫狀態」對外部 kill 不可執行；死亡 session 的測試結果、usage、進度全部蒸發。
- 提案：
  1. 長任務角色（QA 全套回歸、sr 大 task）在階段邊界做輕量 checkpoint 寫入。現有 `bookkeeping_write` 語意幾乎就是這個（不刷新 lease 時戳的行政寫入），但沒有任何 skill SOP 引導角色這樣用——只要在 skill-qa-engineer 的 Phase 4 加一條「跑全套回歸前先 bookkeeping_write 記錄『已完成 X，等待回歸結果』」，這次的恢復成本就會砍半。
  2. dispatch 時登記 evidence journal 路徑（如 `.current/journal-<feature>.jsonl`），角色邊做邊 append；Crash-Resume 直接讀 journal 而不是 git 考古。
  3. usage 記錄（`usage.jsonl`）目前完全沒有落地——`tokenBudgetPerFeature` 煞車引用一個不存在的資料源。要嘛實作 sidecar，要嘛把煞車規則標為未實裝。

**A2. 「等待長時間證據」的合法狀態**
- 問題：P2 所述——把測試丟背景後 agent 沒有合法的「等待中」表達，只能違規停下或空轉。15 分鐘 stale 門檻對 1 小時的回歸套件必然誤報。
- 提案：
  1. 新增 `status: Waiting`（或 `In_Progress` + `waiting_on: "<描述>"` 欄位），寫入時重置 stale 計時。
  2. 或 per-phase stale 門檻（QA Phase 4 放寬到 90 分）。
  3. skill SOP 明文：**長套件必須同步跑完再結束 turn**，或跑背景就必須在同一 turn 內輪詢收割——二選一，不留空白。

**A3. stale_dispatch 偵測從被動變主動**
- 問題：advisory 只在下一次有人呼叫 `tw_get_state` 時才被看到；這次空轉 1h55m 就是因為沒人呼叫。
- 提案：server 端已有時戳與門檻，加一個可選的通知 hook（桌面通知 / webhook / 檔案 touch 讓外部 watcher 撿）即可把空轉成本從「小時級」降到「分鐘級」。

### B. 高優先：證據格式的演進管理

**B1. 證據 schema 版本化 + dispatch 時釘住**
- 問題：P3 —— visual 報告 schema 在 feature 進行中變嚴，崩潰前的合法產物在崩潰後變非法。
- 提案：schema 帶版本號（如 `evidence_schema: 3`），dispatch 時寫進 handoff 釘住；升版只影響新 feature。gate 拒絕時的錯誤 envelope 要指出「缺哪個段落 / 期望哪個標題字串」，而不是只給錯誤碼。

**B2. 結構化證據取代 markdown 標題 grep**
- 問題：`AC_EXECUTION_LOG_MISSING` 因為標題多了 `Phase 3.5 — ` 前綴而觸發。給機器驗的東西用人類散文格式，是把脆弱性設計進去。
- 提案：報告加 YAML frontmatter（`sections: [ac-execution-log, region-diff, ...]`、`verdict: PASS`、`region_diff_pct: 3.98`），gate 驗 frontmatter；markdown 正文留給人讀。或至少標題比對改為 contains / 正規化後比對。

### C. 中優先：帳面健康

**C1. 歷史 drift 歸檔機制**
- 提案：feature 達 PASS + release 後，允許一次性 `tw_archive_feature`（human-attested）把該 feature 的 task 區塊移到 `tasks-archive.md`；或 `tw_detect_drift` 加 `--since <feature>` 把歷史噪音摺疊成一行摘要。105 筆永久噪音是會讓人開始忽略 drift 報告的——警報疲勞是真實風險。

**C2. Build gate 豁免正式化**
- 問題：§2「ZERO compile errors」在本 repo 是永久違反狀態（33 個 tsc error 在 3 個豁免測試檔、`npm run build` 已知壞掉）。每輪 review/QA 都要用散文重新解釋豁免清單，且 §6 的 dependency-audit-at-build-gate 因 build 從不跑而連帶死亡。
- 提案：`.current/exemptions.json` 宣告式豁免清單（檔案 + 原因 + 到期條件），gate 讀清單自動扣除；散文豁免視為未豁免。順帶讓「豁免清單只增不減」變成可監控指標。

**C3. §6 git 詞彙補全**
- 把 `git stash` / `stash pop`（可逆、非破壞）明文納入 sanctioned；同時明文 `git checkout -- <file>`（本次 PNG 復原用得到）的地位。白名單制的規則,詞彙表不全等於逼正確行為違規。

### D. 中優先：死規則盤點（本 workspace 實測從未觸發）

依 telemetry + handoff 實證,以下規則在本 feature（乃至本 workspace）從未生效,值得逐一決定「實裝 / 簡化 / 刪除」：

| 規則 | 狀態 | 建議 |
|---|---|---|
| Token budget brake（`tokenBudgetPerFeature`） | 資料源 `usage.jsonl` 不存在,永不觸發 | 實裝 sidecar 或移除 |
| Cut-Approval Auto-Tier | 未 arm,整段 writer action 死路 | 保留但文件標註「預設未啟用」 |
| Backlog Intake Loop | 無 `docs/backlog.md`,必走 no-op 分支 | 保留（低成本）,或 lazy-load |
| `dispatch_pins` 全套（含 Crash-Resume step 3、watermark pin-override） | 從未設過 pin,本次 Crash-Resume 該步驟空轉 | 保留,但 step 3 可改為「pin 缺席時明示跳過」 |
| `dispatch_mode: bugfix` / expected-red 鏈 | 本 feature 為 feature-mode,Phase 0.5 skipped | 保留（設計上就是條件性的） |
| `resume_of` Amend-Resume、`FEATURE_LEASE_HELD`、`lease_override` | 未觸發 | 保留（保險絲） |
| §5 `read` cap（每檔最多讀 3 次） | **無任何計數機制,純榮譽制** | 要嘛做計數,要嘛降級為建議 |
| §1 Terse ≤15 字 | 實務上全部回覆經由「structured artifact 豁免」逃逸,dead letter | 刪除或改寫為可執行的規則 |
| 三個 round cap + hop cap | 本 feature 全程 0 / 峰值 4/10 | 保留（保險絲,設計正確） |

**方法論建議**：telemetry 這次只有 4 筆就回答了「哪些 gate 在做事」——把它擴充成 per-gate 觸發計數的 coverage 報表（`tw_gate_stats`），幾個 feature 後就能用數據做上表的裁決,而不是靠回憶。

### E. 低優先：人因與一致性

**E1. SessionStart hook 與 `/teamwork` 的模式矛盾**
- hook 注入「You are in Coordinator-Lite mode」+ 整份 coordinator-lite skill；同 session 使用者隨即 `/teamwork` 載入 full coordinator。兩份互相矛盾的模式聲明並存,浪費 ~5KB context 且留下歧義（lite 說「不可寫狀態」,full 的核心工作就是寫狀態）。
- 提案：hook 偵測到 `/teamwork` 調用時跳過 lite skill 注入；或 hook 只注入 constitution,skill 一律由 command 載入。

**E2. 整包替換（wholesale-replace）footgun**
- `dispatch_pins`、`external_refs` 都是整包替換不是 merge。忘了先讀再寫會默默清掉既有 entry。提案：寫入若導致 entry 數減少,回傳警告要求確認（或加 `merge: true` 選項）。

**E3. Crash-Resume Protocol 文件位置**
- 本次協議執行順利,但它只存在於 skill-coordinator 文本裡。若死的是 coordinator 本身（或使用者用 lite 模式接手）,沒有任何提示指向該協議。提案：`stale_dispatch` advisory 的 message 欄位直接附上協議摘要或指路。

---

## 5. 這次做對的事（保留,不要改壞）

1. **`stale_dispatch` advisory**：純靠持久化狀態偵測,無記憶的新 session 也能看到——這是整個恢復的起點,設計正確。
2. **Crash-Resume Protocol 的 ground-truth 原則**：「不信任死者的最後陳述,一切以工作樹為準」在本次直接抓到「verdict 寫 PASS 但 addendum 缺席」的差距。
3. **`tw_sync` 的不對稱設計**：自動修復 handoff-ahead、拒絕提升 vibe-drift——105 筆歷史項一筆都沒被錯誤合法化。
4. **證據 schema gate**：雖然重工了 7 分鐘,但攔下的三個缺口（缺段落、被禁指標、缺執行記錄）都是真缺口,最終證據品質確實更高。
5. **builder ≠ judge 全程未破**：崩潰壓力下 coordinator 沒有代寫視覺判定,恢復後仍由 qa-visual 獨立裁決。
6. **恢復 QA 的隔離證明**：`--workers=1` + `git stash` 雙重隔離證明 17 個失敗與本 feature 無關,是可複製的 SOP 範本,值得寫進 skill-qa-engineer。

---

## 6. 待辦（從本報告衍生）

- [ ] 開 ticket:17 個既有 visual 回歸失敗(energystar / mode / modeconfig / network 系列)
- [ ] agent-governance-mcp:A1 checkpoint 管道 + A2 Waiting 狀態(高優先)
- [ ] agent-governance-mcp:B1/B2 證據 schema 版本化 + frontmatter 化(高優先)
- [ ] agent-governance-mcp:C1 歷史 drift 歸檔、C2 豁免 manifest、C3 git 詞彙補全
- [ ] agent-governance-mcp:D 表逐項裁決(建議先做 `tw_gate_stats` 蒐集數據)
- [ ] repo 慣例:actual-capture 截圖移出 `tests/visual/` 或加 .gitignore 規劃(P4 根因)
