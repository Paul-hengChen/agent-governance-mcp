# E443 Phase 0 — 實機檢查：腳本能否不靠人開出 lane session

- 日期：2026-11-26
- 執行者：非 lane session `p0host`（替整合者跑；不開 branch、不建 worktree、不改 repo 檔案、不呼叫寫入型 `tw_*`）
- CLI：Claude Code 2.1.332
- 作業系統：macOS 15.7
- Terminal：iTerm2 3.7.8（Terminal.app 有安裝，未使用 —— iTerm2 已可行）
- tmux：本機未安裝

## 共用做法

- 測試目錄：每次 `mktemp -d` 新開，結束後刪除。
- 啟動殼層腳本 `run2.sh <測試目錄> <tag> <mode>`：`cd <測試目錄>` → `claude --permission-mode <mode> -n <tag>` → 結束時把 exit code 與時間寫入 `<測試目錄>/exit.txt`。
- 驅動腳本 `drive.sh`：`osascript` 叫 iTerm2 `create window with default profile`，對新 session `write text` 執行 `run2.sh`；輪詢 session `contents` 直到出現狀態列（`permissions on`），再等 6 秒，然後送 teamwork prompt（見第 2 項的送字方式）。
- 送給 session 的 prompt：`/mcp__agent-governance-mcp__teamwork` + 指示「只呼叫 `tw_get_state(workspace_path=<測試目錄>)` 並寫出 `exists`；用 Bash 寫 `<測試目錄>/done.txt`；最後一行回 `p0host-ok`」。`done.txt` 是給腳本看的完成訊號。

## 1. CLI 版本

- 指令：`claude --version`
- 結果：`2.1.332 (Claude Code)` —— 成功。

## 2. 開一個看得到的視窗

| 嘗試 | 指令 / 做法 | 結果 |
|---|---|---|
| 2a | iTerm2 新視窗，`claude --permission-mode bypassPermissions -n <tag> "<slash 指令 + 參數>"`，測試目錄在 `$TMPDIR` 下 | **停在信任資料夾畫面**（見第 3 項），失敗 |
| 2b | 同 2a，測試目錄改開在一個**已被信任的上層資料夾**底下 | 無信任畫面、無 bypass 確認畫面，session 起來了；但初始 prompt 回 `Unknown command: /mcp__agent-governance-mcp__teamwork` —— 初始 prompt 在 MCP 伺服器連上前就被解析（啟動競態），失敗 |
| 2c | 2b 的視窗裡，用 `osascript` 對 session `write text "<slash 指令>"`（預設帶換行） | 文字進了輸入框但**沒送出** |
| 2d | 再送 `write text (ASCII character 13) newline NO` | 仍未送出 |
| 2e | `System Events` `key code 36`（模擬 Return） | `AppleEvent timed out (-1712)`，未送出；需要「輔助使用 / 自動化」權限，且要搶焦點 —— 不採用 |
| 2f | 再送 `write text ""`（空字串 + 換行） | **送出成功**：session 呼叫 `tw_get_state` 回 `exists: false`、寫出 `done.txt`、最後一行 `p0host-ok`，約 5 秒完成 |
| 2g | 正式做法（`drive.sh`）：啟動時**不帶**初始 prompt；等狀態列出現再等 6 秒；`write text "<指令>" newline NO` → `delay 0.5` → `write text ""` | 成功（第 4 項兩個視窗都用這個做法） |

- `--permission-mode bypassPermissions`：本機使用者設定已有 `skipDangerousModePermissionPrompt: true`，**沒有** bypass 確認畫面。另用 `--settings '{"skipDangerousModePermissionPrompt":false}'` 再開一次，仍沒有確認畫面 —— 本機無法觀察到這個畫面；在沒接受過 bypass 的全新機器上會不會出現，**未驗證**。
- `auto` / `dontAsk`：bypass 已可用，未改用。只用 `auto` 在不受信任的目錄測了一次，信任資料夾畫面照樣出現 —— 信任檢查與 permission mode 無關。
- 結論：**方案 A 第一段可行**，條件是 (1) 啟動目錄位於已信任的資料夾底下，(2) slash 指令不放在命令列初始 prompt，而是 session 就緒後用 `write text` 送字、再用 `write text ""` 送出。

## 3. 沒有人介入

| 畫面 | 文字（節錄） | 觸發條件 | 對應參數或設定 |
|---|---|---|---|
| 信任資料夾 | `Accessing workspace: <測試目錄>` / `Quick safety check: Is this a project you created or one you trust? …` / `❯ No, exit` / `Yes, I trust this folder` / `Enter to confirm · Esc to cancel` | 啟動目錄及其上層都不在已信任清單 | 與 `--permission-mode` 無關（`bypassPermissions`、`auto` 都出現）。測試目錄開在已信任資料夾底下就不出現 —— 信任會往下繼承 |
| bypass 確認 | 本機未出現 | — | 本機使用者設定 `skipDangerousModePermissionPrompt: true` |
| macOS 自動化權限 | 未直接看到；`System Events` 按鍵在逾時後失敗 | 用 `System Events` 模擬按鍵 | 不用 `System Events`，改用 iTerm2 自己的 `write text`，就不需要這個權限 |

- 2f / 2g 的流程中，從視窗打開到 `p0host-ok` 之間**沒有任何等人按鍵的畫面**（工具呼叫、Bash 都未跳權限提示）。
- lane worktree 實測不跳信任畫面（主 repo 有明確信任項目時）；主 repo 的信任若只是從上層資料夾繼承，worktree 會跳。補測（同日，人類要求）：
  - 真的 lane worktree（位在 lane 根目錄底下，信任清單沒有它的項目）：`claude --permission-mode bypassPermissions` 直接進到輸入畫面、不跳信任畫面；只看啟動畫面，未送 prompt、未呼叫工具，隨即 `/exit`（結束碼 0），不影響該 lane 的 session。
  - 拋棄式 repo 對照：主 repo 開在已信任資料夾底下（信任從上層繼承、自己沒有項目），worktree 放在未信任的暫存目錄 → 跳信任畫面。拋棄式 repo 與暫存目錄都已刪除。
  - 推論（未對照原始碼）：worktree 沿用主 repo 的信任，但只限主 repo 在信任清單裡有自己的項目；從上層繼承的信任不傳到 worktree。
  - 對啟動器：從已被明確信任的主 repo 開出的 lane worktree 不需另外處理信任；前提是主 repo 曾在根目錄被選過「信任這個資料夾」——寫進啟動器的前置檢查。

## 4. 一條 lane 一個視窗

- 做法：兩個 `mktemp -d` 測試目錄（都在已信任的上層底下），背景同時跑兩個 `drive.sh`；prompt 的 Bash 步驟改為 `sleep 20; echo <tag> > done.txt`，讓兩個 session 一定重疊。
- 結果：兩個視窗各有自己的 tty，送出後兩個 session 都是 `is processing = true`；兩個 `done.txt` 相隔 2 秒寫出（各自都含 20 秒等待，代表同時在跑），內容各為自己的 tag、沒有互寫；兩個 session 都回 `exists: false` 與 `p0host-ok`。之後各自 `/exit`，`exit.txt` 都是 `exit=0`。—— 成功。

## 5. 辨識結束

| 要辨識的事 | 可行的查法 | 本次觀察 |
|---|---|---|
| session 完成了交代的工作（仍開著） | session 寫出約定的訊號檔（本次 `done.txt`）；或輪詢 `contents` 找最後一行標記 | 可靠 |
| 視窗裡的 session 已結束（視窗還在） | (a) 啟動殼層在 `claude` 結束後寫 `exit.txt`（含 exit code）；(b) iTerm2 session 的 `is processing` 變 `false`；(c) `ps -t <session 的 tty>` 不再有 `claude` 行程 | 三者一致。session 的 `name` 會殘留舊的「(claude)」字樣，**不可靠** |
| 視窗被關掉 | `osascript -e 'tell application "iTerm" to exists (first window whose id is <id>)'` 回 `false`；或該 id 不在 `id of windows` 裡 | 可靠 |
| 兩者能否分開 | 能：session 結束時視窗仍 `exists = true` 且 `exit.txt` 已寫；視窗被關時 `exists = false`。若使用者在 session 還在跑時直接關窗，`exit.txt` 可能寫不出來 —— 以「`exists = false` 且無 `exit.txt`」判為被關窗 | 前兩種已實測；「跑到一半直接關窗」未實測 |

- 腳本要結束 session：送 `write text "/exit" newline NO` → `write text ""`，已實測可行（`exit=0`）。session 本身無法自己退出，需由腳本送 `/exit`。
- 視窗識別：`create window` 回傳的 window `id` 可一路用來查 `contents`、`tty`、`is processing`、`exists`、`close`。

## 方案 A（看得到的視窗）第一段是否可行

**可行**，有兩個前提要寫進啟動器：
1. 啟動目錄在已信任資料夾底下，否則會卡在信任資料夾畫面（預設選項是 `No, exit`）。
2. 不把 `/mcp__…__teamwork` 放在命令列初始 prompt（啟動競態會回 `Unknown command`）；改成 session 就緒後以 iTerm2 `write text` 送字、`write text ""` 送出。就緒判定本次用「狀態列出現 + 6 秒」，是經驗值，MCP 連線慢時可能不夠 —— 啟動器應檢查回應裡沒有 `Unknown command`，有就重送。

## 方案 B（tmux）現況

本機未安裝 tmux，未測。若日後採用，對應做法為 `tmux new-session -d` + `send-keys`，結束 / 關閉辨識改查 pane 與行程；全部未驗證。

## 待觀察（不在本次觸發；由人類日後在真的 lane 撞到用量上限時回報）

1. 互動 session 在用量上限重置後，會不會自己接續。
2. subagent dispatch 撞到上限時會怎樣（回錯誤、空回覆、或卡住）。
3. 第三次接續之後會怎樣。
4. 撞到上限時，畫面上可辨識的訊號是什麼（可供腳本輪詢 `contents` 比對的文字）。
