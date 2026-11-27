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

## 第二段：用量上限四項（依官方文件結案，2026-11-26）

原列「待觀察、等真的 lane 撞到上限時回報」（第 5 波人類裁定 Q2 (a)）。2026-11-26 人類改裁定 (a)：以 Claude Code 官方文件作為四項的結論，只把第 2 項的實際重派行為留到第一次真的撞到上限時補驗。下列引文由 coordinator 以 `curl` 取回各頁原始 Markdown 逐字核對（同日）；本機 CLI 2.1.332，高於文件要求的 v2.1.234。

| 頁面 | 網址 |
|---|---|
| interactive-mode，〈Wait for a usage limit to reset〉 | https://code.claude.com/docs/en/interactive-mode.md#wait-for-a-usage-limit-to-reset |
| errors，〈You've hit your session limit〉 | https://code.claude.com/docs/en/errors.md#youve-hit-your-session-limit |
| sub-agents，〈API errors in subagents〉 | https://code.claude.com/docs/en/sub-agents.md |
| settings-reference，`autoContinueAtUsageLimit` | https://code.claude.com/docs/en/settings-reference.md#autocontinueatusagelimit |
| statusline，〈Rate limit usage〉 | https://code.claude.com/docs/en/statusline.md#rate-limit-usage |

### 1. 重置後會不會自己接續 —— 會

- interactive-mode：「When a claude.ai usage limit stops Claude mid-task, Claude Code waits in the open session and continues the task on its own after the limit resets. Automatic continue is on by default in interactive sessions signed in with a claude.ai subscription. Requires Claude Code v2.1.234 or later.」
- 接續方式：「Claude Code prompts Claude to pick the task up where it stopped. It doesn't resend your last message.」
- 設定：`autoContinueAtUsageLimit`，**Default: `true`**；只從使用者設定、`--settings`、managed 設定讀取。「When none of those sets the key, a project or local settings file that sets it turns the feature off rather than being ignored.」本機使用者設定與本 repo 的 `.claude/` 設定都沒有這個 key（同日 grep）。
- 例外，**不會**自己開始等的情況：
  - 「A reset more than 24 hours away: a weekly limit can reset days out.」此時只在本人終端機打開一次選單（`/rate-limit-options`）。
  - 「Background sessions and `-p` runs: the menu row isn't available.」
  - 退出 Claude Code 後：「the wait doesn't restart when you resume the session.」
- 電腦睡眠：睡超過約 30 分鐘且期間已重置，畫面顯示 `Your usage limit has reset` / `Press enter to continue`，要按一次 Enter；睡得較短就自己接續。
- 接續後的任務「still asks for permissions as usual」；lane session 以 `--permission-mode bypassPermissions` 啟動（第 2 項），不受影響。

### 2. subagent 派工撞到上限 —— 回錯誤或回部分輸出，不會卡住

- sub-agents：subagent 的請求「count toward the same usage limits as your main conversation」。
- 「**Foreground**: if a rate limit, overload, or server error cuts off a subagent that already produced text output, the Agent tool returns that partial output with a note that the subagent was cut off and didn't finish its task. A subagent that produced nothing, or whose only output was tool calls, fails with `Agent terminated early due to an API error`, followed by the error detail.」
- 「**Background**: the subagent is marked failed, and the message Claude receives when it ends names the API error and includes the subagent's last output, so partial work isn't lost.」
- 「Once the underlying API error clears, ask Claude to retry the task or resume the subagent.」
- 文件**沒寫**：主 session 自動接續時會不會重派被中斷的 subagent。接續只是「prompts Claude to pick the task up」，所以重派與否由 coordinator 的 SOP 決定（Crash-Resume 流程）。**留待補驗**：第一次真的 lane 撞到上限時，記錄主 session 接續後是否照 Crash-Resume 流程重派、pin 是否保留。
- 注意：同節寫明設定了 fallback model chain 時，subagent 會在模型不可用時改用 chain 裡的下一個模型繼續（報告開頭出現 `⚠ This agent switched to <model> because its earlier model could not be used.`）。這與 E443 修訂第 (4) 項「不換角色的模型」相衝；lane 不得設定 fallback model chain，或在 Phase 1 的 cut 處理。

### 3. 第三次自動接續之後 —— 停止自動接續，等人

- interactive-mode：「After three automatic continuations, automatic continue stops and the `Automatic continue stopped after repeated usage-limit hits` notification appears. Run `/rate-limit-options` to choose what to do next. When you send another prompt, or pick a wait from that menu, the count starts over.」
- 對啟動器：此時視窗與 session 都還在，第 5 項的「已結束」訊號（`exit.txt`、`is processing`、`ps`）都不會出現；必須輪詢 `contents` 比對這行，標記該 lane 為 paused。送出新 prompt 會讓次數重新計算，可作為叫醒方式（是否自動叫醒由 Phase 1 的 cut 決定）。

### 4. 可辨識的訊號

| 時機 | 畫面文字 |
|---|---|
| 撞到上限 | `You've hit your session limit · resets <時間>`、`You've hit your weekly limit · resets <時間>`、`You've hit your Opus limit · resets <時間>`、`You've hit your Sonnet limit · resets <時間>` |
| 等待中 | `Usage limit reached · limit resets <時間>`、`Continuing automatically at <時間> · Esc to cancel`（兩行後面可能另接文字） |
| 重置時 | 第二行變成 `Continuing shortly · Esc to cancel`，對話中出現 `Usage limit reset · Continuing automatically` |
| 三次後停止 | `Automatic continue stopped after repeated usage-limit hits` |
| 等待被取消 | 以 `Automatic continue cancelled` 開頭的一行 |
| 快用完前的預警 | 例如 `You've used 85% of your session limit · resets 3:45pm` |

- 機器可讀的替代來源：statusline 的 `rate_limits.five_hour.resets_at`、`rate_limits.seven_day.resets_at`（Unix 秒）；「appears only for claude.ai Pro, Max, and Ultra subscribers … only after the first API response in the session」。
- 文件沒有保證這些字串跨版本不變；啟動器比對時以前綴比對，並在 CLI 升版時重查。

### 結論

四項都有文件答案；E443 Phase 0 第二段除上面第 2 項的「接續後重派」補驗外結案，Phase 1 可以開 lane。Phase 1 的 cut 要處理：週上限（重置超過 24 小時）不會自己等、三次後停住的偵測與叫醒、睡眠超過 30 分鐘要按 Enter、不得設定 fallback model chain、project／local 設定不得寫 `autoContinueAtUsageLimit`。
