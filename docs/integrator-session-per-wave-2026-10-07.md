# Integrator：一個波次一個 session（討論稿）

日期：2026-10-07
來源：另一個採用 agc 的專案（下稱「gateway 專案」；它的上游是另一個也採用 agc 的「receiver 專案」）的 integrator session（該專案的一份 fan-out 清單）；第二個例子是 agent-governance-mcp 本身的 integrator session（E260 後續票，`specs/fanout-e260-followups.md`，2026-10-07～08，見 §3b）
用途：人類要拿這份和 agc 討論，作為 integrator 改版的輸入。本文只記錄實際觀察和提案，沒有改動任何 agc 程式或 SOP。

---

## 1. 人類的工作節奏

> 我每次請 integrator fan-out 且完成這系列的任務之後，會發現這個 integrator 的 context 太長了。為了避免幻想跟節省 token，我都會換另一個 session 開始下一個任務。

- 換 session 是**固定的節奏**，不是做到一半被打斷。
- 目的有兩個：
  - **避免幻想**：context 太長、太舊時，integrator 容易憑對話記憶回答，不回 repo 查證。
  - **節省 token**：越後面的每一回合都要帶上整段 context，成本越高。
- 這件事在 gateway 專案已經反覆發生。它有五份 fan-out 清單都有一節「接手步驟（換 session 用）」，其中一份還直接寫著「上一個整合者 session 因 context 過長結束」。
- 現行 SOP 沒有寫到這個節奏，所以每次都是人類開口要求，integrator 才去補交接。

## 2. 「一個 session」的單位：波次（wave）

討論時先釐清了單位。換 session 的時間點是**一個波次結案**，不是整份清單做完，也不是一張任務做完。

| 單位 | 範例 | 做完就換 session？ | 理由 |
|---|---|---|---|
| 整份清單 `specs/fanout-<id>.md` | lane A → A-web（整合後的下一波）→ A 的實機驗證票 → A 的文件票 | 否 | 跨好幾波，context 一定會太長 |
| **一個波次** | 這份清單的 Wave 1 只有 {A}；另一份清單的 Wave 1 是 {B ‖ C} | **是** | 一次派出去、一起合回來，結案點很清楚 |
| 一張任務（一條 lane） | 只有 B | 否 | 同一波的平行 lane 要在同一個 session 合併，整合者才看得到彼此是否衝突、合併後全套是否仍綠 |

- **定義**：一個波次 = 一次 fan-out 裡同時派出、最後一起合回整合分支的所有 lane。
- **一個波次的完整流程**：
  1. 切票。
  2. 清單核准（人類）。
  3. 派工：開 lane、建信箱、產出 prompt。
  4. 信箱預審 cut；人類在 lane 自己的 session 核准。
  5. lane 層驗證。
  6. 開整合分支、合併、跑整合層全套。
  7. 實機驗證（如果有）。
  8. 快進目標分支並推送（人類核准）。
  9. 每條 lane 跑 `finish --shipped`。
  10. 刪除整合分支。
- 第 10 步做完就是換 session 的時間點。
- **整合後才開的下一波**（例如 A-web）屬於下一個 session，即使它寫在同一份清單裡。

## 3. 這次 session 實際發生的事（gateway 專案，lane A 的 Wave 1）

| 步驟 | 內容 | 和本題的關係 |
|---|---|---|
| fan-out 請求 | receiver 專案的暫停／繼續功能完成後，要 gateway 專案規劃並派工 | — |
| 切票 | integrator 以 Task 派 PM 做票層級切分，產出一份切票檔：A（gateway）、A-web（web）、A 的實機驗證票、A 的文件票 | 現行 SOP 的 Stage 1 假設票已經切好，沒有寫「先派 PM 切票」這一步 |
| 清單核准 | Wave 1 只開 A；A-web 等另一條進行中的 lane 和 A 都合進來後再開 | 一份清單包含兩個波次 |
| 執行 | cut 預審 → 人類核准 → lane 做到 qa PASS → report | — |
| 驗證與合併 | 驗證子代理重跑兩層全套；開整合分支合併 | 全套交給子代理，主 session 的 context 省很多 |
| 實機 | 在實機上驗證端點兩次 | — |
| 推送與 finish | 快進該專案的目標分支並推送 → `finish --shipped` A → 刪整合分支 | **波次結案** |
| 結案之後 | integrator 問「要我開始寫 A-web 的清單嗎？」 | ❌ 違反人類的節奏：下一波應該留給新 session |
| 人類提出 | 「這個 context 太長了，我要換一個 session」 | 交接是人類開口後才寫的，不是 integrator 主動寫 |

## 3b. 第二個例子：agent-governance-mcp 的 E260 後續票（2026-10-07～08）

一個 session 從頭做到尾：先以 coordinator 回答狀態問題，再切成 integrator 做完一整個波次（三條 lane，中途追加第四條）。前後約一天，其中一整晚在等人類。

| 步驟 | 內容 | 和本題的關係 |
|---|---|---|
| 開場 | `/teamwork` 問「整理註解的任務到哪了」，接著在**同一個 session** 呼叫 `integrator` 做 fan-out | coordinator 的對話整段帶進 integrator，一開始 context 就不短 |
| 切票與核准 | 票已在 backlog（E263–E274），不用另外切；integrator 先在聊天裡問 3 個範圍問題，再寫清單、人類核准 | 對 O3 是反例：票已切好時，Stage 1 照現行 SOP 就夠 |
| cut 預審 | 三條 lane 的 cut 都經信箱預審；e264 的預審抓到整合者清單裡標錯的行號（`lane-migrate.ts` :320 應為約 :330） | 預審也能反過來抓整合者的錯 |
| 波次中途被擋 | 三條 lane 的 build 都被 §6 dependency audit 擋住（三則新公布的 HIGH／CRITICAL advisory，`main` 上一樣會擋） | 見 O8：SOP 沒有「波次中途 base 需要先修」的路徑 |
| 追加 lane | 人類裁決：開第四條 lane e275 修相依套件，先合進 `main`，再由整合者把 `main` merge 進三條 lane branch | 「把 main merge 進 lane」不在 integrator SOP 的步驟裡，要人類另外同意 |
| 等人類核准 | e275 的 cut 送出後，人類約 16 小時沒回到 lane session；整合者每 30 分鐘重新啟動一次監看，約 25 次都沒有新信，最後才主動暫停 | 見 O9：等人類時的監看最耗 context，而且什麼都沒得到 |
| 核准轉述 | 三件人類決定（E272 選項、完成定義改寫、e269 調高 budget 上限）都是在 lane session 核准的；信箱不能傳核准，整合者每件都要人類在整合者 session 再確認一次 | 見 O10 |
| 驗證與合併 | 四條 lane 的 lane 層全套、兩次整合層全套，加上整合者自己每次 commit 後、push 前的全套，共 10 次，全部在主 session 跑；log 寫進 scratchpad，只讀摘要行 | P4 只做到一半：只讀摘要行有效，但沒有交給驗證子代理，跑測試的時間也都算在主 session |
| 結案 | ff `main` 並 push → 四條 lane 依序 `finish --shipped`（配 E276–E282）→ 刪兩個整合分支 | **波次結案** |
| 結案之後 | 整合者回報裡建議發版；人類說「發版」時，整合者沒有在同一個 session 接著做，而是給一段 prompt，請人類開新 session 用 `/teamwork` 處理 | 主因是角色邊界（整合者不能發版），次因是 context 太長（參考了本稿 §1）。接近 P1，但**仍沒有寫 `接手步驟`**，印證 §4 第 1 點 |

## 4. 現行做法的問題

1. **交接是被動的**：「接手步驟」要等人類說要換 session 才寫。如果人類忘了說、或 session 意外中斷，交接就不完整。
2. **波次結案後還在推進下一件事**：integrator 結案後會主動提議下一波，等於鼓勵在同一個長 context 裡繼續做，正好和人類想避免的事相反。
3. **交接格式沒有規範**：五份清單的「接手步驟」各寫各的，`fanout.mjs validate` 不檢查它，新 session 不知道哪些欄位一定會有。
4. **新 session 的第一步沒有標準化**：現在靠交接文字裡的「核對 primary」那一點。SOP 的 *Status* 一節有讀取狀態的指令，但沒有寫成「接手時必做」的固定步驟。

## 5. 改版提案

### P1. Stage 6 加上「session 收尾」步驟
最後一條 lane `finish` 完、整合分支刪掉之後，加一個固定的 6-6：
- 更新清單的 `## 接手步驟（換 session 用）`，不用人類開口。
- 回報最後加一行：「本波次已結案，建議換新 session；新 session 用 `integrator` prompt 接手 `specs/fanout-<id>.md`」。
- **不主動提議或規劃下一波**，只把下一波的待決事項寫進交接。

### P2. 交接段落成為清單格式的一部分
`fanout.mjs validate` 認得 `## 接手步驟` 這一節，固定子項：

| 子項 | 內容 |
|---|---|
| 核對 primary | 目標分支 sha = origin、`git status` 乾淨、worktree 清單應有哪些（標明哪些屬於別的 session，不要動） |
| 已結案 | 本波次結果、lane 紀錄位置（`.current/history/...`）、未配號的新發現 |
| 待人類決定 | 下一波要不要開、待裁定的題目（Q 編號）、整合者的建議 |
| 裝置 | 實機現在的狀態、注意事項（如果有用到實機） |
| 工具 | 腳本路徑、本 repo 特有的步驟 |
| 進行中的背景工作 | 監看、整合分支、未推送的 commit；結案時應該都是「無」 |

狀態行是「已結案」時，可以要求這一節存在而且「進行中的背景工作」是「無」。

### P3. 新 session 接手的固定第一步
`integrator` prompt 加一個接手模式（例如 `resume <manifest>`）：
1. 讀清單的 `接手步驟` 和 Decisions。
2. 對照 repo 逐條重新核對：fetch、目標分支 sha、worktree、信箱、lane-status。
3. 有任何一條對不上就停下來回報，不從交接文字推論。
4. 確認無誤後，才回答「下一步要做什麼」。

### P4. 波次內也要省 context（已在這次驗證有效）
- 全套測試交給唯讀驗證子代理（E192），主 session 只拿結構化結果，再自己對照 log 摘要行。
- 大範圍讀檔、切票交給子代理（這次的 PM 切票就是這樣做）。
- 同一張表不重複貼；回報只寫差異。

## 6. 其他觀察（這次 session 碰到的摩擦，可一併討論）

| # | 現象 | 建議 |
|---|---|---|
| O1 | `fanout.mjs render` 產出的 prompt 寫的是相對路徑 `docs/lane-protocol.md`，但 lane 在別的 repo，每次都要手動改成 agc 的絕對路徑 | render 時輸出絕對路徑，或加 `--protocol-path` |
| O2 | `agc feature start` 在沒有 root `package.json` 的 repo 會警告找不到 root `node_modules`；而 `web/node_modules` 的 symlink 每次都要整合者手動建 | 讓 node_modules 的連結路徑可以設定（例如 `web/`） |
| O3 | 現行 SOP 的 Stage 1 假設票已經切好；但實際上人類常直接丟一份範圍草案，要 integrator「先交 PM 切票」 | Stage 1 前加 0：可派 PM 做票層級切分，只寫一份切票檔，不碰 `tasks.md`、不呼叫 `tw_*` 寫入工具 |
| O4 | Decisions 的裁決者欄只接受「人類」或「整合者」；寫「人類／整合者」會被 validate 擋 | 文件寫明，或允許「人類核准、整合者執行」這種寫法 |
| O5 | 同一個 repo 同時有兩個 integrator session（各管不同的 lane），信箱上可以看到對方的 watch-lock | SOP 寫明「每個 session 只監看自己派的 lane」，並在清單記錄是哪個 session 負責 |
| O6 | repo 把 agc 產物設為不進版控時，`finish --shipped` 不會替 `pending-tickets.md` 配號（三則 lane 新發現都留在 history） | 決定這種 repo 的新發現要放哪裡，避免被遺忘 |
| O7 | 實機裝完 app 後 `am start` 把它拉到前景，另一個相依的 app 沒在跑，狀態查詢讀到舊值，一開始誤判為對方沒反應 | 屬於該專案的實機注意事項，已寫進交接；可考慮在 DEV 步驟範本加「先確認相關 app 在跑」 |
| O8 | （E260 後續票）波次中途，所有 lane 共同依賴的 base 需要先修（這次是新公布的 npm advisory 擋住 §6 audit）。lane 不能 merge，所以修正要先合進 `main`，再由整合者 merge 進每條 lane branch；SOP 沒寫這條路，這次靠人類臨時同意 | SOP 加一段「波次中途的 base 修正」：開一條插隊 lane → 先合進目標分支 → 整合者對每條 lane 做 `git -C <worktree> merge --no-ff <目標分支>`（前提是 lane 已 ack 乾淨工作區）→ 寄恢復通知；並把這個 merge 寫進 integrator 的 git 授權說明 |
| O9 | （E260 後續票）所有 lane 都在等人類核准時，`mailbox-watch` 每 29 分鐘到期，整合者照 SOP「一律從印出的 baseline 重新啟動」，空轉約 25 次。每次重新啟動都要帶整段 context 跑一回合 | SOP 允許「所有 lane 都在等人類時暫停監看」：把 baseline 記在清單裡，人類回來時再從這組 baseline 重新啟動（這次實際這樣做，沒有漏信）；或由 `lane-status --watch` 判斷所有 lane 都卡在人類時自動停止 |
| O10 | （E260 後續票）人類在 lane session 做的決定（選項、完成定義改寫、上限調高），整合者都要人類在整合者 session 再確認一次才記進 Decisions，因為「信箱不傳核准」。三件決定就多了三次來回 | 討論：lane 可否把人類的核准原文寫進它的 handoff 或 spec，讓整合者引用並記為「人類（lane session，原文見 …）」，不必再問一次。信任規則要不要放寬，是本題的核心 |
| O11 | （E260 後續票）同一個 session 先當 coordinator 再當 integrator，前一個角色的對話全部留在 context | 呼叫 `integrator` 時如果偵測到同一個 session 已經有其他角色的工作，建議先換新 session |

## 7. 待和 agc 討論的問題

1. 換 session 的單位定為「波次」是否適用於所有 repo？還是要可設定（波次／整份清單）？
2. P1 的「不主動提議下一波」要寫成硬規則，還是人類可以在當下說「繼續做」來覆寫？
3. P2 的交接格式要不要由 `fanout.mjs` 產生骨架（例如 `fanout.mjs handoff <manifest>`），讓整合者只填內容？
4. P3 的接手模式是新的 prompt 參數，還是併進現有的 `status` 模式？
5. O8 的「把目標分支 merge 進 lane」要不要成為 integrator 的正式步驟？還是每次都要人類個別同意？
6. O9 的暫停監看：由整合者判斷，還是由工具自動判斷「所有 lane 都在等人類」？
7. O10 的核准轉述：信箱不傳核准這條規則，要不要允許「引用 lane 記錄的人類原文」這種例外？
