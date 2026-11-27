# 討論紀錄：每個波次換一個 integrator session（排程者）

- 開始：2026-11-27，spec-workshop
- 來源：人類在 coordinator session 提出的想法（無來源文件，以現有程式與文件為準）

## 想法（人類提出，尚未裁定）

再加一個角色，負責開 session 並派工給 integrator。integrator 帶一個波次 fan-out、收尾之後，這個角色把它的 session 關掉，再開一個新的 integrator session 接下一波。目的有兩個：integrator 不必一直開著，context 也不會越積越大；並且符合人類先前的看法：下一波要換一個新 session 做 fan-out。

## 現況（2026-11-27 查證）

- `content/skill-integrator.md` Stage 6 第 7 步：每波的最終回報要建議開新 session，integrator 不主動提下一波。
- `content/skill-integrator.md` 的接手模式（`接手 <manifest>`）：新 session 先用 `fanout.mjs handoff --check` 核對 handoff，全部吻合（exit 0）才接著做。handoff 寫好之後若又有新信件進來，核對會出現 `DIFF`，接手就會停下。
- E443b（lane e443b，實作中）已核准的 SOP 文字：同一份 manifest 裡較後的 `波次` 不算「下一波」，每個波次的 PR 合併後，由**同一個** integrator 重跑啟動器。這跟上面的想法衝突。
- 啟動器由 integrator 當背景程序執行；當前波次已經沒有 `running` 的 lane 時，它以 exit 0 結束。integrator 的 session 被關掉時，啟動器會不會跟著停，未驗證。
- Phase 0（`specs/e443-phase0-host-check.md`）實測過：用腳本開 iTerm2 視窗、送字、送 `/exit` 讓 session 結束、判斷視窗還在不在，都可行。
- 波次進行中只有 integrator 做的事：cut 預審的 `close`（manifest tier 自動核准的條件之一）、回信、合併與收尾、重跑啟動器。
- 所有 session 共用一個帳號：週用量上限會讓全部 AI session 一起停。

## Rulings

| # | date | question | ruling | replaces |
|---|---|---|---|---|
| R1 | 2026-11-27 | Q1 換 session 的單位 | 每個 `波次` 換一個新的 integrator session。integrator 收完一波，向調節器回報「這一波完成」；調節器關掉這個 integrator session，開一個新的 integrator 接下一波。調節器是唯一一直開著的 session，它的 context 只放「開下一波 integrator、派工」和「這一波完成、可以關」這類訊息。 | — |
| R2 | 2026-11-27 | Q2 調節器的形式 | 調節器是 AI session，跟 integrator 一樣是只有 prompt 的角色；開視窗、送字、送 `/exit` 這些操作由它呼叫的腳本執行。 | — |
| R3 | 2026-11-27 | Q3 時程 | E443b 照目前範圍做完；調節器等 E443b 合併後另開新票。新票會改寫 E443b 裡「同一個 integrator 重跑啟動器，開較後波次」的 SOP 文字。 | — |
| R4 | 2026-11-27 | Q4 波次中 integrator 消失 | 只有人手動關掉、Claude Code 當掉或電腦重開機時才會發生；調節器只通知人類，不自動重開。lane 的恢復照舊由啟動器處理。 | — |
| R5 | 2026-11-27 | Q5 一波完成的時機 | 在 `.current/.config.json` 加一個 repo 層級的設定，值是「PR 開出來」或「PR 合併」，預設「PR 合併」。PR 需要人 review 或手動合併的 repo 設成「PR 開出來」；本 repo 用預設值，integrator 等 auto-merge 完成才回報，調節器再關掉它。 | — |
| R6 | 2026-11-27 | Q6 「PR 開出來」模式下的相依 | 相依滿足的條件是被依賴的程式碼已在依賴方 lane 的起點裡，也就是前一波的 PR 已經合併。下一波裡不依賴未合併工作的 lane 立刻開始；依賴的 lane 列為等待，等 PR 合併後才開始。不從前一波的 integ branch 疊上去做。這條取代 E443 切票裁定 Q1 在此模式下的「branch 已刪、有 history 紀錄就算滿足」。 | E443 切票 Q1（僅限「PR 開出來」模式） |
| R7 | 2026-11-27 | Q7 調節器自己消失 | 調節器把狀態寫進檔案（目前的 manifest、第幾波次、integrator 的視窗 id、進行到哪一步）。消失時不自動恢復；人類開一個新的調節器 session，它讀狀態檔接著做。 | — |
| R8 | 2026-11-27 | Q8 調節器怎麼開始 | spec-workshop 核准並提交後，人類開一個調節器 session，給它討論紀錄的路徑。它開第一個 integrator 並送 `fan-out <紀錄>`；之後每個 integrator 送 `接手 <manifest>`，並告訴它要開始第幾波次。全部波次做完後通知人類。 | — |
| R9 | 2026-11-27 | Q9 回報管道與核對 | integrator 在調節器的信箱寫一則 `type: report`，格式沿用 lane-protocol §5 的「非 lane 的 session」。調節器照 R5 的設定先確認：PR 已開出或已合併、`handoff --check` 是 exit 0，確認後才送 `/exit`；不符合就回信請 integrator 補上。 | — |
| R10 | 2026-11-27 | Q10 等待中的 lane 由誰開始 | 「PR 開出來」模式下，由當前波次的 integrator 留意前一波的 PR，合併後重跑啟動器開始等待中的 lane；這些 lane 做完之前這一波不算完成。等待期間，調節器通知人類是哪個 PR 卡住。 | — |
| R11 | 2026-11-27 | Q11 收完一波後關 lane 視窗 | 收完一波後，調節器對已收工的 lane 視窗送 `/exit`；停下等人類裁定的 lane（任何 `stopped — …`）保留視窗。 | — |
| R12 | 2026-11-27 | Q12 名稱 | prompt id `conductor`，中文稱「調節器」；它是第 14 個 prompt。 | — |
| R13 | 2026-11-27 | Q13 週用量上限 | 第二點在這次討論處理並交給調節器：週上限重置後，人類在調節器打一句話，調節器叫醒 integrator 和所有暫停的 lane，包括 `paused-weekly`。 | E443b A2-7 的「`paused-weekly` 永遠不叫醒」 |
| R14 | 2026-11-27 | Q14 叫醒時機 | 兩個叫醒時機都交給調節器：session 上限重置後，調節器自動接續，接著叫醒暫停的 integrator 和 lane；週上限照 R13，等人類打一句話。integrator SOP 裡「用量重置後重跑啟動器」這個時機拿掉。 | E443b A2-19 的第二個重跑時機 |
| R15 | 2026-11-27 | Q15 切票 | 切兩張票，分兩個波次。第 1 張（第 1 波次）是啟動器與設定：R5 的設定、R6 的相依規則、可叫醒 `paused-weekly`、可對指定 lane 視窗送 `/exit`。第 2 張（第 2 波次，依賴第 1 張）是調節器本身：`conductor` prompt 與 SOP、integrator 視窗的開關、狀態檔、信箱、integrator SOP 的配合修改。 | — |
| R16 | 2026-11-27 | Q16 真機驗收 | 第 2 張票的最後一個情境是真的跑一份至少 2 個波次的 manifest，由人親眼確認，驗證方式是 `device-or-person`；這張票跑到 PASS 後停下，人驗收完才合併。 | — |
| R17 | 2026-11-27 | Q17 E466 放寬兩個測試 | E466 的 `allowed paths` 加上 `test/e423-spec-workshop.test.mjs` 與 `test/e428-tracker-mirror.test.mjs`。依據：integrator 派的 probe 實測，S1（14 個 prompt）讓 e423 的 registry 長度檢查變紅，S8（改 integrator SOP）讓 e428 的 sha256 檢查變紅，換寫法都避不開。 | — |
| R18 | 2026-11-27 | Q18 `CLAUDE.md` 行數 | E466 的 Context 加一句：`CLAUDE.md` 維持目前行數，新增的列以合併既有續行抵銷；不把 `test/e432-judge-report-checks.test.mjs`、`test/e436-stale-handoff-paths.test.mjs` 加進允許清單。依據：probe 驗證淨行數 0 時兩者全綠。 | — |

## 討論中

- Q4（integrator 在波次中消失）：人類問誤關從哪裡來。查證：目前流程沒有任何一步會關 integrator，AI 也沒有關視窗的步驟；`/exit` 只會由調節器對收完一波的 integrator 送出（依視窗 id）。會消失的只有：人手動關掉視窗或結束 iTerm2、Claude Code 當掉、電腦重開機。撞到用量上限時 session 會等，不會結束。
- Q5（integrator 什麼時候算完成一波）：人類提出依專案彈性處理。PR 要人 review 或手動 merge 的專案，PR 開出來就算完成；本 repo 用 auto-merge，等合併後才回報。查證到一個衝突：Stage 6 第 1 步的 `agc feature finish` 在開 PR **之前**就執行，會刪掉 lane branch 並寫下 history 紀錄；E443 切票裁定 Q1 把「branch 已刪、有 history 紀錄」算成相依已滿足。所以 PR 一開出來就換下一波的話，依賴前一波的 lane 會被放行，但它的起點 `main` 還沒有前一波的程式碼。

## 待決問題

無。

## Wave table

| wave | ticket | depends on |
|---|---|---|
| 1 | E465 | — |
| 2 | E466 | E465 |

票檔：`docs/tickets/E465.md`、`docs/tickets/E466.md`。

## Approval

| date | decided by | content | source |
|---|---|---|---|
| 2026-11-27 | human | 核准票檔 E465、E466 與上方波次表（第 1 波次 E465；第 2 波次 E466，依賴 E465） | spec-workshop session（「approve」） |
| 2026-11-27 | human | 確認 R17、R18 為人類裁定，核准修改後的 E466 票檔（`allowed paths` 加 e423、e428 兩個測試；Context 加 `CLAUDE.md` 行數限制）；E465 與波次表不變 | spec-workshop session（「是」「approve」） |
