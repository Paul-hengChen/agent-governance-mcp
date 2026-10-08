# Integrator 流程改版：討論結論

日期：2026-10-08
輸入：`docs/integrator-session-per-wave-2026-10-07.md`（討論稿，`b6f61dc`）、`specs/fanout-e260-followups.md`（E260 後續票的 Decisions 與結案）
狀態：人類已逐題裁決並定案（2026-10-08）。票已開：E283–E294（`docs/backlog.md`），佇列 #104–#115（`docs/v4.0.0-new-tickets.md`）。本文只記錄結論，沒有改動任何 SOP、程式或測試。

---

## 1. 核對結果：討論稿 vs 現行規則

討論稿裡每一句「SOP 沒寫」「工具不檢查」，都對照了 `content/skill-integrator.md`、`docs/lane-protocol.md`、憲法 §6 和工具原始碼。大部分屬實，以下 5 處需要修正。

| 稿中說法 | 核對結果 |
|---|---|
| §4.2：integrator 結案後主動提議下一波 | 這是 SOP 規定的行為，不是 integrator 自作主張：Stage 6 第 5 點要求最後回報附「下一步建議」。要改這個行為，必須連這條舊規定一起改 |
| §4.4：新 session 的第一步沒有標準化 | 只對一半。SOP 的 Lifecycle 段已規定每個 stage 前都要讀治理狀態、檢查漂移、列出 worktree、看 git 狀態；Status 段也寫了「不要憑對話記憶回答」。缺的是清單層級的核對：遠端 sha、信箱、lane 狀態、Decisions |
| P4：全套測試交給驗證子代理 | 已經在 SOP 裡（5a 的 E192 verifier，寫的是「可以」）。E260 那次是有規則沒用，不是沒有規則 |
| §3、O3：integrator 派 PM 切票 | 超出現行權限。權限表只允許派 code-reviewer、qa-engineer 和唯讀驗證子代理，沒有 PM |
| O7：DEV 步驟範本 | agc 沒有實機驗證步驟的範本，那是該專案自己的東西 |

屬實、而且情況比稿中寫的嚴重的幾項：

- **O1**：dispatch prompt 範本把 `docs/lane-protocol.md` 寫死成相對路徑，而且 lane-protocol 的內容本身就是為本 repo 寫的。§6 的跨 repo 觀察顯示，別的專案已經每一波 fork 一份複本再改寫。
- **O5**：SOP 要求監看信箱底下**所有** lane，所以會撞上另一個 session 的監看鎖。問題出在 SOP 自己的指令。
- **O6**：`agc feature finish` 在 base 上讀不到 `pending-tickets.md` 時直接跳過，沒有任何警告，新發現會靜默遺失。
- **O11**：伺服器看不到對話內容，無法自動偵測，只能寫成 SOP 文字讓 integrator 自己檢查。

討論中另外確認的現行流程（後來成為 O12）：

| 問題 | 現行做法 | 出處 |
|---|---|---|
| fan-out 後誰開信箱 | integrator 在 Stage 3 建好每條 lane 的信箱、先掛監看，才發 prompt | SOP Stage 3 |
| fan-out 後誰開 worktree 和 branch | lane 自己開：lane session 第一步在 primary 跑 `agc feature start` | lane-protocol §1；憲法 §6「start 由 lane 執行，finish 由 integrator 執行」 |
| prompt 有沒有叫 agent cd | prompt 只列路徑（worktree 為絕對路徑），cd 規則寫在 lane-protocol §1：每個會改檔的 Bash 都要帶 `cd <worktree> &&`，因為 harness 每次 Bash 後都把目錄重置回 session 啟動的位置 | `PROMPT_TEMPLATE_3B`；lane-protocol §1 |
| 收工後有沒有逐條核對 | 有，核對回報和分支是否一致：commit、越界、每個 task 的證據檔、工作區、在 commit 後的分支重跑全套、新發現、共享生成物；不重新判斷程式正確性（那是各 lane 的 code-reviewer 和 qa 的事），只有合併時的實質衝突另派 code-reviewer | SOP Stage 5a、5b |
| 關票後有沒有刪 worktree、branch、信箱 | `finish --shipped` 刪 lane 的 worktree、branch（`-d`）和預設位置的信箱（只含預期檔案時）；不在預設位置的信箱、整合分支由 integrator 手動刪 | SOP Stage 6-3、6-4；`bin/agc-init.mjs` |

---

## 2. 流程：現在 vs 改版後

### 2.1 現在

| 階段 | 誰做 | 做什麼 |
|---|---|---|
| 開場 | 人類 | 呼叫 `integrator`，在聊天裡說 fan-out、fan-in 或 status |
| 每個階段前 | integrator | 讀治理狀態、檢查漂移、列出 worktree、看 git 狀態 |
| 1. 規劃 | integrator | 讀已經切好的票，排 lane 的檔案歸屬，寫清單 `specs/fanout-<id>.md` |
| 2. 核准 | 人類 | 在 integrator session 核准清單 |
| 3. 派工 | integrator | 核對前提、建信箱、掛監看（信箱底下所有 lane）、產出每條 lane 的 prompt |
| 4. 執行 | lane + integrator | cut 經信箱預審，人類在 lane session 核准；integrator 每 29 分鐘重掛監看，一直重掛 |
| 5. 驗證與合併 | integrator | 核對回報和分支、跑全套（可以交給子代理）、開整合分支合併、再跑全套 |
| 6. 收尾 | integrator | 記帳、ff 目標分支、push、每條 lane `finish --shipped`、刪整合分支 |
| 最後回報 | integrator | 回報結果，附「下一步建議」 |

### 2.2 改版後（🆕 是新增或改動的地方）

| 階段 | 誰做 | 做什麼 |
|---|---|---|
| 開場 | 人類 | fan-out、fan-in、status，或 🆕「接手 `specs/fanout-<id>.md`」 |
| 🆕 開場自我檢查 | integrator | 如果這個對話已經做過其他角色的工作，建議先換新 session（只建議、不擋） |
| 🆕 0. 切票（選用） | integrator 派 PM | 人類只給範圍草案或跨 repo 交辦單時，派 PM 切票，只產出切票檔；票已切好就跳過 |
| 1. 規劃 | integrator | 同現在 |
| 2. 核准 | 人類 | 同現在 |
| 3. 派工 | integrator | 🆕 信箱只監看自己清單的 lane；別份清單的 lane 可以查進度、用 `lane-status --watch` 盯住 |
| 4. 執行 | lane + integrator | 🆕 lane 建完 worktree 後用 `EnterWorktree` 把 session 切進去；🆕 有條件引用人類在 lane 的核准；🆕 連續 2 小時沒動靜就停止監看；🆕 中途修 base 的正式步驟 |
| 5. 驗證與合併 | integrator | 🆕 所有全套測試必須交給子代理 |
| 6. 收尾 | integrator | 🆕 加上寫交接，由 `fanout.mjs handoff` 產生骨架並填好事實欄位 |
| 🆕 最後回報 | integrator | 「本波已結案、交接已寫好、待你決定的事、建議換新 session」，不再給下一步建議 |

---

## 3. 逐題裁決

### 3.1 討論稿 §7 的 7 題

| 題 | 問題 | 裁決 | 內容 |
|---|---|---|---|
| 1 | 換 session 的單位 | 固定以波次為單位，不做設定項 | 波次結束可以用指令確認；以整份清單為單位一定會碰上等人類的空等 |
| 2 | 不主動提議下一波：硬規則或可覆寫 | 拆成三件事 | ① 結案一定寫交接（不可覆寫）；② integrator 不主動問下一波；③ 人類說「繼續」可以在同一個 session 做，但要先跑 `handoff --check` 重新核對 |
| 3 | 交接骨架要不要由工具產生 | 兩張票 | 先做 `validate` 檢查交接段落；再做 `handoff` 指令自動填事實類欄位 |
| 4 | 接手模式怎麼叫出 | 第四種聊天模式「接手」 | 不做 prompt 參數，也不併進 status；核對交給 `handoff --check` |
| 5 | 把目標分支 merge 進 lane | 寫成正式步驟 | 開插隊 lane 仍由人類決定；merge 本身照五個條件做（見 §4 O8） |
| 6 | 暫停監看由誰判斷 | 修改後採用人類提出的規則 | 連續 2 小時沒有新信、也沒有任何 lane 狀態改變，就停止監看；還有 lane 不需要人類也在做事時不停 |
| 7 | 核准轉述 | 有條件放寬 | 只影響該 lane、寫在核准過的 cut 裡、分支上看得到，三個都成立才不再問 |

第 7 題的補充：人類曾提議「在任何 session 核准都算數」，後來撤回，維持有條件放寬。反方向（在 integrator session 核准就算 lane 的核准）需要改憲法 §3.1，不開票。

### 3.2 追加裁決

| 題 | 裁決 |
|---|---|
| 全套測試 | 從「可以」改成「必須」交給子代理，包括 lane 驗收、整合層，以及 integrator 自己 push 前的全套 |
| 監看其他 lane | 信箱只監看自己清單的 lane；別份清單的 lane 可以查進度，也可以用 `lane-status --watch` 盯住，因為不同清單的 lane 可能互相依賴 |
| 跨 repo 溝通 | 採 D：姊妹 repo 宣告 + 標準交辦單，不做跨 repo 信箱，P3（見 §6） |
| O1 | 改成三層 lane-protocol，優先提高到 P2（見 §6） |
| 中途斷線補交接（G3） | 暫緩，記錄在 §8，並開一張標「暫緩」的票 |
| lane 建完 worktree 後切進去（O12） | 加入本次改版。原提案「integrator 先建 worktree、人類在 worktree 開 session」和人類的操作習慣相反，改用 `EnterWorktree`；設計見 §4 O12 |

---

## 4. 每個提案和觀察的處理方式

| 項目 | 處理 | 理由 |
|---|---|---|
| P1 結案收尾 | 修改後採用 | 結案一定寫交接、不主動提議下一波，人類說「繼續」可以覆寫；Stage 6-5 的「下一步建議」一併改掉 |
| P2 交接格式 | 採用 | `validate` 檢查交接段落；`handoff` 指令自動填事實類欄位 |
| P3 接手模式 | 修改後採用 | 改成第四種聊天模式「接手」，核對交給 `handoff --check` |
| P4 波次內省 context | 修改後採用 | 全套測試必須交給子代理；同一張表第二次出現時只寫差異 |
| O1 lane-protocol 路徑 | 修改後採用 | 拆成 agc 通用、repo 補充、lane 專屬三層；P2 |
| O2 node_modules 連結 | 採用 | 讓子目錄的連結位置可以設定 |
| O3 integrator 派 PM 切票 | 修改後採用 | 新增 Stage 0 和權限；PM 的 SOP 加一列「被 integrator 派來切票時只寫切票檔、不呼叫 `tw_*` 寫入工具」；跨 repo 交辦單是 Stage 0 的一種輸入 |
| O4 裁決者欄 | 修改後採用 | `validate` 不放寬；SOP 寫明裁決者只記誰決定，誰執行寫在內容欄 |
| O5 兩個 integrator session | 修改後採用 | 信箱只監看自己清單的 lane；清單本身就界定了負責範圍，不另記 session 編號 |
| O6 不進版控的新發現 | 採用 | 至少不能靜默；一併設計給別的 repo 的新發現 |
| O7 實機注意事項 | 不採用 | 該專案自己的事；交接有選填的「裝置」欄 |
| O8 中途修 base | 修改後採用 | 正式步驟，五個條件見下 |
| O9 暫停監看 | 修改後採用 | 2 小時規則，見 §3.1 第 6 題 |
| O10 核准轉述 | 修改後採用 | 有條件放寬，見 §3.1 第 7 題 |
| O11 同 session 換角色 | 修改後採用 | 只寫進 SOP：開場時自我檢查，建議換新 session |
| O12 lane 建完 worktree 後切進去 | 採用（討論中新增） | lane 用 `EnterWorktree` 把 session 切進 worktree，目錄重置時回到 worktree，「每個指令都要帶 cd」的風險消失；人類的操作習慣不變；設計見下 |

**O8 的五個條件**（全部成立，integrator 才能把目標分支 merge 進 lane）：

1. 修正已經合進目標分支，而且已經 push。
2. 修正改到的檔案，不在任何 lane 擁有的範圍內（用 `fanout.mjs check` 驗證）。
3. lane 已經暫停並回信確認，integrator 自己再查一次工作區是乾淨的。
4. merge 前用 `git merge-tree --write-tree` 預測衝突。這個指令只計算、不改任何東西，需要 git 2.38 以上。現行 git 授權裡沒有 `merge --abort`，merge 到一半衝突就沒有合法的退回方式，所以預測有衝突就不 merge，交回人類。git 版本太舊時視同有衝突。
5. merge 後跑 `merge-invariants`、確認 lane 的 build 和 audit 都通過，寫信通知 lane 恢復，記進 Decisions。

條件 2 或 4 不成立時，停下來交給人類。憲法 §6 不用改：integrator 的授權本來就包含 `merge --no-ff`，前提是 SOP 有寫。

**O12 的設計**：

**問題**：人類的做法是在 primary 開 lane session、貼上 prompt，由 lane 自己建 worktree、cd 進去實作。但 Claude Code 每跑完一個指令，就會把工作目錄重置回 session 啟動的地方（primary），cd 不會一直生效。現行 lane-protocol 的對策是「每個指令都自己帶 `cd <worktree> &&`」，只要漏一次，那個指令就會在 primary（主 branch）上執行。

**設計**：

1. **流程不變的部分**：人類在 primary 開 session、貼上 prompt；lane 自己跑 `agc feature start` 建 worktree 和 branch。誰建 worktree、憲法 §6、integrator SOP 都不改。
2. **新增一步**：`feature start` 成功後，lane 呼叫 Claude Code 的 `EnterWorktree` 工具（參數 `path` = worktree），把整個 session 切進 worktree。之後目錄重置會回到 worktree，不用每個指令帶 cd，漏帶也不會跑到 primary。
3. **備案**：`EnterWorktree` 不能用時（不是 Claude Code、工具拒絕），退回現行「每個指令都帶 `cd <worktree> &&`」的規則。
4. **lane-protocol §1**：寫進上面兩條，並寫明切進去後先確認目前目錄是 worktree、目前 branch 是派工指定的 branch。臨時檔放 `$TMPDIR` 或 scratchpad 的規則不變；寫信箱一律用絕對路徑。
5. **prompt 範本**：加一行「建完 worktree 後用 `EnterWorktree` 切進去」（在 E289 做，同一個檔案）。
6. **要先實測**：
   - 工具說明寫「第一次切入時，路徑只要出現在 `git worktree list` 就可以」，但本 repo 的 lanes 放在 repo 外（`../<repo>-lanes/`），要實際試一次。
   - 切進去後 CLAUDE.md、記憶等設定會改讀 worktree 的版本，要確認沒有問題。
   - `ExitWorktree` 不會刪除用這種方式進入的 worktree，刪除照舊由 `finish` 負責，這正是需要的行為。

**沒有採用的方案**：integrator 在派工時先建好 worktree，人類直接在 worktree 目錄開 lane session。這個方案和人類的操作習慣相反，而且要改憲法 §6（11 個 compose golden 和所有角色的 budget），代價較大。

**O10 的範圍**：

| 情況 | 改版後 |
|---|---|
| 人類在 lane 核准 cut，cut 裡寫了方案選擇、只對應該 lane 的完成定義改寫、該 lane 擁有的檔案的上限調整 | 不再問；Decisions 記「人類（lane session）」，出處寫 lane 分支上的檔案和 commit sha |
| 人類在 lane 口頭做的決定，沒寫進 spec | 仍要問；或請 lane 寫回 spec，人類在 lane 上核准那份更新 |
| 影響其他 lane 或整個波次的決定 | 仍在 integrator session 問 |
| lane 在信裡寫「人類已核准」 | 一律無效，信箱永遠不傳核准 |

---

## 5. 情境對照

| 情境 | 現在 | 改版後 |
|---|---|---|
| 票已經切好（E260） | 直接進 Stage 1 | 同現在，Stage 0 跳過 |
| 人類只丟範圍草案（gateway 專案） | SOP 假設票已切好，派 PM 是越權 | Stage 0 正式允許派 PM 切票 |
| 同一個 session 先問狀態，再叫 integrator（E260） | 沒人提醒 | integrator 開場建議換新 session |
| 派工後開 lane session | 人類在 primary 開 session 貼 prompt，lane 自己跑 `feature start` | 同現在，lane 建完 worktree 後多一步 `EnterWorktree` 把 session 切進去 |
| lane 某個 Bash 指令漏帶 cd | 指令在 primary（主 branch）上執行，可能改錯地方 | session 已切進 worktree，目錄重置也回到 worktree |
| `EnterWorktree` 不能用（不是 Claude Code、工具拒絕） | — | 退回「每個指令都帶 cd」的現行規則 |
| 同一個 repo 兩個 integrator session | 撞上對方的監看鎖 | 信箱只監看自己的 lane；對方的 lane 只讀 |
| 人類在 lane 核准的 cut 裡含方案選擇（E260 的 E272） | 要人類回 integrator session 再確認 | 從分支上的 spec 和 `cut_approved` 引用，不再問 |
| cut 寫「照 qa 實測值調高 budget 上限」（E260 的 e269） | 要人類再確認四個數字 | 不問；驗收時核對數字和 qa 證據一致 |
| 波次中途 base 要修，修正不碰 lane 的檔案（E260 的 e275） | 人類臨時同意把 main merge 進 lane | 人類只決定開插隊 lane，merge 照五個條件自動做 |
| 預測會衝突，或修正碰到 lane 的檔案 | 沒有規則 | 停下來交給人類 |
| 所有 lane 等人類，人類離開 16 小時（E260） | 每 29 分鐘重掛，空轉約 25 次 | 2 小時後停止監看，baseline 記進交接 |
| 人類離開，但有 lane 在跑大票 | 一直重掛 | 不停，繼續監看 |
| 監看停了，lane 寄來回報 | — | 人類回來說「恢復監看」，從 baseline 重掛，信不會漏 |
| 監看停了，integrator session 也關了 | — | 新 session 用「接手」模式，從交接拿 baseline 接著監看 |
| 全套測試（E260 共 10 次在主 session） | 可以交給子代理 | 必須交給子代理 |
| 合併有實質衝突、合併後變紅、push 被拒 | 審查、停下、回報 | 不變 |
| 波次結案，清單還有下一波（gateway 專案） | integrator 問要不要開始下一波 | 寫好交接，列出待人類決定的事，建議換新 session |
| 結案後人類說「繼續」 | — | 可以在同一個 session 做，先跑 `handoff --check` |
| 結案後人類說「發版」（E260） | integrator 不能發版，交接也沒寫 | integrator 仍不能發版，但交接一定已經寫好 |
| 新 session 接手 | 靠交接文字裡的一句核對 | 「接手」模式：讀交接和 Decisions，`handoff --check`，全部一致才回答 |
| 接手時發現對不上 | — | 列出不一致的項目，停下來回報 |
| 波次中途 session 意外中斷，沒有交接 | 靠 status | 仍靠 status；改法暫緩（§8） |

---

## 6. 跨 repo 的實際觀察與設計

### 6.1 觀察

來源：gateway 專案和 receiver 專案的 fan-out 清單（唯讀檢視，2026-10-08）。

- **分工**：receiver 專案定協定，協定寫在它的 README（有進版控）；gateway 專案照協定實作後端和 web console。兩邊的清單都禁止碰對方 repo 的任何檔案。
- **跨 repo 往來只有兩種，次數很少**：
  - 上游 → 下游：「我這邊做完了，換你」。上游的 integrator 寫一份交辦稿，分成背景（已定案協定和出處）、現況（讀過下游程式碼的接線點）、要做、不做四段。人類把路徑帶給下游的 integrator，下游的 Decisions 第一列就記這次交辦。
  - 下游 → 上游：「我發現你那邊有 bug」。下游實機測試時發現上游的問題，記成自己的新發現；人類裁定後，在上游的 backlog 開票，出處寫「下游整合者轉來」。
- **得知對方進度**：清單裡記對方的分支 sha、票號和協定出處。
- **lane 之間從來沒有跨 repo 直接對話**，每次往來都在 integrator 層級，而且都經過人類。
- **兩個 repo 的 agc 產物都不進版控**。其中一個 repo 沒有 `docs/backlog.md`，所有票都在一個未追蹤的 `pending-tickets.md` 裡；另一個 repo 的 backlog 引用這些票時，引用的是一個不在 git 裡的檔案。
- **其中一個 repo 每一波都自己改寫一份 lane-protocol**（約 10KB，從上一波的複本改寫，一路串下來），裡面混了 repo 規則、本波的人類裁定和 lane 範圍。

### 6.2 跨 repo 溝通：D「姊妹 repo 宣告 + 標準交辦單」（P3）

不做跨 repo 信箱。理由：跨 repo 的信箱要放在兩個 repo 之外的共用資料夾，還要另外掛監看；實際往來大約一個功能一兩次；每次往來本來就需要人類決定，因為要不要在對方 repo 開票，就是新票要不要進 milestone。

| 項目 | 做什麼 | 落在哪張票 |
|---|---|---|
| D1 姊妹 repo 宣告 | 設定檔宣告對方 repo 的路徑、負責什麼、backlog 和協定文件在哪；status 和接手模式自動讀對方的進行中 lane 和分支 sha（現有 `lane-status --repo` 已支援） | E292 |
| D2 外部依賴段落 | 清單選填：對方 repo、票號、分支 sha、協定出處；接手時 `handoff --check` 核對對方的 sha 有沒有變 | E292 |
| D3 交辦單格式 | 背景、現況、要做、不做四段，作為 Stage 0 的一種輸入；路徑仍由人類帶過去 | E288 |
| D4 給別的 repo 的新發現 | 新發現加「目標 repo」欄位；`finish` 不在本 repo 配號，改列進最終回報待人類裁定 | E287 |

### 6.3 lane-protocol 三層（P2）

| 層 | 內容 | 誰維護 | 多久改一次 |
|---|---|---|---|
| agc 通用規則 | 信箱格式、回報格式、檔案邊界原則 | agc | 跟著 agc 版本 |
| repo 補充規則 | 該 repo 的建置指令、共享生成物、實機注意事項 | 各 repo，一個 repo 一份 | 很少 |
| lane 專屬內容 | 本波的人類裁定、範圍切線 | 派工 prompt（現在就有這一段） | 每條 lane |

`fanout.mjs render` 產生 prompt 時同時指向前兩層。

---

## 7. 切票

### 7.1 限制

- `content/**` 是共享生成物，同一波只能有一條 lane 修改。
- integrator SOP 沒有被 compose golden 收錄，也沒有 budget 上限，但 `test/e178a-integrator-role.test.mjs` 會檢查 SOP 內容，改 SOP 的 lane 要一併擁有這個測試檔。
- PM 的 SOP 有 budget 上限（4401 ~tok，`test/context-budget.test.mjs`）。
- 引用 `docs/lane-protocol.md` 的測試共 5 個，改 lane-protocol 的 lane 要檢查哪些受影響。
### 7.2 票（E283–E294，佇列 #104–#115）

| 票 | 範圍 | 要改的檔 | content、golden、budget | 優先 |
|---|---|---|---|---|
| E283 validate 交接段落 | 已結案時要求 `## 接手步驟` 和四個必填子項（核對 primary、已結案、待人類決定、進行中的背景工作），「進行中的背景工作」必須是「無」，擋本機絕對路徑；「已結案」的判斷方式和舊清單要不要套用由 PM 決定 | `tools/fanout-manifest.ts`、新測試 | 都不動 | P2 |
| E284 `handoff` 指令 | 產生交接骨架、自動填事實類欄位；`--check` 核對交接和 repo 是否一致 | `tools/fanout-manifest.ts`（或新檔）、`scripts/fanout.mjs`、新測試 | 都不動 | P2 |
| E285 SOP：交接與 session 節奏 | P1（含改 Stage 6-5）、P3 接手模式、O9 兩小時規則、P4 全套必須交給子代理、O11 | `content/skill-integrator.md`、`test/e178a-integrator-role.test.mjs` | 動 content；不動 golden，沒有 budget 上限 | P2 |
| E286 SOP：信任與 git | O8 中途修 base（integrator 端和 lane 端）、O10 有條件引用、O4 裁決者說明、O5 只監看自己的 lane（可查看別份清單的 lane） | `content/skill-integrator.md`、`docs/lane-protocol.md`、e178a 測試、其他引用 lane-protocol 的測試 | 動 content；不動 golden，沒有 budget 上限 | P2 |
| E287 finish 不再遺失新發現 | O6：不進版控的 repo 至少要警告，並決定新發現放到哪裡；D4：給別的 repo 的新發現 | `bin/agc-init.mjs`、`tools/lane-ticket-allocation.ts`、新測試 | 都不動 | P2 |
| E288 Stage 0 派 PM 切票 | O3：integrator SOP 加 Stage 0 和權限，PM SOP 加一列；D3：跨 repo 交辦單格式 | `content/skill-integrator.md`、`content/skill-pm.md`、e178a 測試、`test/context-budget.test.mjs` | 動 content，動 PM 的 budget | P3 |
| E289 render 支援 repo 補充規則 | O1 三層的工具端：設定裡指定 repo 補充檔，prompt 同時指向通用規則和補充規則；O12 的 prompt 範本加一行「建完 worktree 後用 `EnterWorktree` 切進去」 | `tools/fanout-manifest.ts`、`tools/config.ts`、E177a render golden（測試 fixture） | 不動 content golden | P2 |
| E290 lane-protocol 改成通用寫法 | O1 三層的文件端：本 repo 專用的規則移到本 repo 自己的補充檔 | `docs/lane-protocol.md`、新的補充檔、相關測試 | 都不動 | P2 |
| E291 node_modules 連結位置可設定 | O2：node_modules 的連結位置可以設定（例如 `web/`） | `bin/agc-init.mjs`、`tools/config.ts` | 都不動 | P3 |
| E292 姊妹 repo 宣告與外部依賴 | D1 + D2 | `tools/config.ts`、`tools/fanout-manifest.ts`、可能還有 `tools/lane-status.ts`、`content/skill-integrator.md`、測試 | 動 content；不動 golden | P3 |
| E293 中途斷線補交接（暫緩） | G3，見 §8 | — | — | P3，暫緩 |
| E294 lane 建完 worktree 後切進去 | O12：先實測 `EnterWorktree` 能否切進 repo 外的 lane worktree（§4 O12 第 6 點）；lane-protocol §1 加入「`feature start` 後用 `EnterWorktree` 切進去、確認目錄和 branch」，不能用時退回 cd 規則 | `docs/lane-protocol.md`、相關測試 | 都不動 | P2 |

依賴：

- E286 開工前先處理既有的 E282（main merge 進 lane 後，lane 的註解檢查腳本會誤報）。
- E294 的 prompt 範本那一行放在 E289 做（同一個檔案）。E289 之前，lane 從 lane-protocol §1 得知這一步。
- 新增的設定欄位要不要升 `.config.json` 的 schema 版本，由各票的 PM 判斷。

### 7.3 執行順序

| 波次 | 並行的票 | 為什麼這樣排 |
|---|---|---|
| 第 1 波 | E283、E286、E287 | 三張改的檔案不重疊；E286 是本波唯一動 content 的 lane |
| 第 2 波 | E284、E288、E291、E294 | E284 等 E283（同檔）；E288 是本波唯一動 content 的 lane；E291 等 E287（同檔）；E294 的 lane-protocol 等 E286 |
| 第 3 波 | E285、E289 | E285 要引用 E284 的指令；E289 等 E284（同檔）和 E291（`config.ts`） |
| 第 4 波 | E290、E292 | E290 等 E289（要先有補充檔機制）和 E294（同檔）；E292 等 E289（同檔）和 E285（content） |

只想先解決「換 session」的核心問題時，最短路徑是 E283 → E284 → E285。

---

## 8. 暫緩的改法：波次中途斷線時的交接

**問題**：改版後，交接只在兩個時間點寫：波次結案時、停止監看時。session 在波次中途意外中斷（沒有停止監看、也沒有結案）時，新 session 沒有交接可以核對，只能退回 status 的讀法：`lane-status`、信箱、清單的 Decisions。

**改法**：integrator 在關鍵時間點也更新交接，例如每條 lane 驗收完、每次合併後。

**目前不做的理由**：

- 每次更新交接都是一次 commit，每次 commit 都要跑全套。
- 最常見的中斷情況（人類不在、session 被關掉）已經由「停止監看時寫交接」涵蓋。
- 清單的 Decisions 本來就逐筆記錄進度。

**重新考慮的時機**：真的發生一次波次中途斷線，而且新 session 接手很困難。

---

## 9. 下一步

1. ✅ E283–E294 已寫進 `docs/backlog.md`，佇列 `docs/v4.0.0-new-tickets.md` 排在 #104–#115（2026-10-08）。
2. ✅ 討論稿 §7 已記上裁決，§6 之後指向本文 §4（2026-10-08）。
3. SOP、程式和測試的修改，等票開好後照一般流程做。
