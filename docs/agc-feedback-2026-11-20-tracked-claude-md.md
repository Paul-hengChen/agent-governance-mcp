# agc 使用回饋：adopter 的 CLAUDE.md 是團隊追蹤檔 — 2026-11-20

討論暫存檔。收斂後才轉成 `docs/backlog.md` 正式票。
狀態：`filed`（待決 #1–#3 已於 2026-11-20 由人類裁定，見文末「裁定」；已開票 `docs/backlog.md` E444）。

---

## 摘要

`agc init` 一律把 adapter block（`<!-- BEGIN agc-adapter -->` … `<!-- END agc-adapter -->`）
upsert 進 adopter repo 的 `CLAUDE.md`。當那個 `CLAUDE.md` 本來就是團隊共用、已追蹤的檔案時：

1. `--artifacts=local` 管不到它：exclude 規則只涵蓋 `.current/`、`tasks.md`、`qa_reports/`、`review_reports/`，對已追蹤檔案本來也無效。
2. adopter 只能自己想辦法藏起這 16 行，常見作法是 `git update-index --skip-worktree CLAUDE.md`。
3. skip-worktree 讓 `git status`／`git diff` 看起來乾淨，但上游一改 `CLAUDE.md`，`git pull` 就失敗，錯誤訊息還指向一個「看不到改動」的檔案。
4. agc 的 `check`／`eject`／`feature start` 都不知道這個情境，governance 允許的 git 指令也不含 `update-index`，agent 無法自行收拾。

Claude Code 原生支援的 `CLAUDE.local.md` 正好是這個 block 的合理落點。

---

## 事件經過

adopter 環境：一個已上線的前端專案，預設分支為 `dev`（非 `main`），`CLAUDE.md` 由團隊維護，多個 PR 動過它。

| # | 事件 | 觀察 |
|---|---|---|
| 1 | 使用者回報 `git pull` 被擋 | `git status` 乾淨、`git diff` 空，`dev` 落後 `origin/dev` 171 commits，`pull.rebase=true` |
| 2 | 改跑 `git -c pull.rebase=false pull --ff-only` | `error: Your local changes to the following files would be overwritten by merge: CLAUDE.md` — 但 porcelain 仍是空的 |
| 3 | `git ls-files -v` | `S CLAUDE.md`：該檔被設了 skip-worktree |
| 4 | 比對工作區與 `HEAD:CLAUDE.md` | 唯一差異是 agc adapter block（16 行）；上游同時改了 `CLAUDE.md`（+20/−1） |
| 5 | 使用者決定退場，跑 `agc eject` | 乾跑計畫正確：移除 block、保留檔案其他內容。但計畫**沒有提到 skip-worktree**，使用者仍需手動 `--no-skip-worktree` 才能 pull |
| 6 | eject + pull 完成後，使用者再跑 `agc init --artifacts=local` | `git status` 出現 ` M CLAUDE.md`。使用者的直覺是「`--artifacts=local` 怎麼把 CLAUDE.md 變成追蹤檔了」 |

第 6 步的誤解很關鍵：`CLAUDE.md` 一直都是追蹤檔，只是先前被 skip-worktree 藏住。
`--artifacts=local` 這個旗標名稱讓人以為「agc 寫的東西都會留在本機」，但 adapter block 不在它的範圍內。

---

## 根因

1. **adapter block 的落點寫死在 `CLAUDE.md`。** `bin/agc-init.mjs` 的 `ADAPTERS` 表把 `CLAUDE.md` 設為 `mode: "upsert"`，沒有替代落點。
2. **`--artifacts=local` 的語意沒有涵蓋 adapter。** `docs/install.md` 說明的是 runtime artifacts 的 git 姿態，adapter block 對團隊的可見性不在任何旗標的控制範圍內。
3. **workaround 有副作用卻沒人偵測。** skip-worktree 是使用者唯一能自己用的隱藏手段，但：
   - `agc check` 不檢查 adapter 檔的 index flag；
   - `agc eject` 的計畫不提醒要清 flag；
   - 被擋的 pull 錯誤訊息與 `git status` 互相矛盾，排查成本高。
4. **agent 不能自救。** 憲法 §6 的允許清單沒有 `git update-index`，所以 agent 只能診斷、把指令交給人類跑。這是正確的保守設計，但代表 agc 應該在工具層就避免把人推到這一步。
5. **lane 也受影響。** `agc feature start` 不在 lane 內跑 `agc init`，lane 的 `CLAUDE.md` 就是 `git worktree add` checkout 出來的版本。如果團隊版 `CLAUDE.md` 沒有 adapter block，lane 裡就沒有 governance 指令。

---

## Claude Code 對 `CLAUDE.local.md` 的官方說明

來源：Claude Code memory 文件（`code.claude.com/docs/en/memory.md`），2026-11-20 查閱。

- 仍受支援，與 `CLAUDE.md` 同等對待：
  > "For private per-project preferences that shouldn't be checked into version control, create a `CLAUDE.local.md` at the project root. It loads alongside `CLAUDE.md` and is treated the same way."
- 兩者是串接，不是覆寫；`CLAUDE.local.md` 排在同一層的 `CLAUDE.md` 之後：
  > "All discovered files are concatenated into context rather than overriding each other. ... Within each directory, `CLAUDE.local.md` is appended after `CLAUDE.md`, so your personal notes are the last thing Claude reads at that level."
- 不會自動被 git 忽略，需自行處理。

adapter block 是純增補（不和團隊 `CLAUDE.md` 的內容衝突），放在 `CLAUDE.local.md` 的效果與放在 `CLAUDE.md` 等價。

---

## 改動提案

| # | 對象 | 提案 | 備註 |
|---|---|---|---|
| P1 | `agc init` | 新增 adapter 落點選項，例如 `--adapter=shared\|local`。`local` 把 block 寫進 `CLAUDE.local.md`，並把 `/CLAUDE.local.md` 加進 `.git/info/exclude`（與 artifacts 同一套 exclude 機制）。 | 預設值見待決 #1 |
| P2 | `agc init` | 偵測 `CLAUDE.md` 已追蹤且沒有 adapter block 時，印出一行提示：寫進去會出現在團隊 diff，建議改用 `--adapter=local`。 | 比照「Already-tracked paths」那段的作法：只提示，不代跑 git |
| P3 | `agc check` | (a) 在 `CLAUDE.md` 或 `CLAUDE.local.md` 任一處找到最新 block 都算 fresh；兩處都有則警告重複。(b) adapter 檔被設了 skip-worktree／assume-unchanged 時發 advisory，說明對 `pull` 的影響並列出 `--no-skip-worktree` 指令。 | (b) 可直接解掉本次排查的大部分時間 |
| P4 | `agc eject` | (a) 計畫納入 `CLAUDE.local.md` 的 block（檔案只剩 block 就刪檔）以及對應 exclude 行。(b) adapter 檔帶 skip-worktree 時，在「cannot do」清單列出 `git update-index --no-skip-worktree <file>`。 | |
| P5 | `agc feature start` | 主 checkout 有未追蹤的 `CLAUDE.local.md` 時，像 `.env` 一樣 byte-copy 進 lane。 | 否則 local 模式的 lane 沒有 governance 指令 |
| P6 | `docs/install.md` | 新增一段「CLAUDE.md 是團隊追蹤檔時」：說明 `--artifacts` 不涵蓋 adapter、`--adapter=local` 的用法，並明確不建議用 skip-worktree，附上原因。 | |

---

## 順帶觀察（非本次主因）

- 憲法 §6 對 `git -c pull.rebase=false pull --ff-only` 的放行寫的是「on `main`」。這次 adopter 的預設分支是 `dev`，嚴格解讀下同一個安全動作在 `dev` 上沒有明文放行。建議改成「on the default branch」。
- adopter 的全域 `pull.rebase=true` 讓裸 `git pull` 在語意上屬於 rebase（§6 禁止）。分支沒有領先時其實只是 fast-forward，但 agent 無法事先確定。憲法已給出 `-c pull.rebase=false … --ff-only` 這個標準寫法，可以考慮在 SOP 裡更醒目地指向它。

---

## 待決事項

1. **`--adapter` 預設值。** 選項 A：維持 `shared`（向後相容），只靠 P2 的提示。選項 B：`--artifacts=local` 且 `CLAUDE.md` 已追蹤時自動選 `local`。B 對新 adopter 最省事，但會改變既有 adopter 重跑 `init` 的行為。
2. **既有 adopter 遷移。** 已把 block 放在 `CLAUDE.md` 的 repo，重跑 `init --adapter=local` 時，要不要順手把舊 block 從 `CLAUDE.md` 移除？移除等於改動追蹤檔，需要使用者自己 commit 或還原。
3. **其他 host 的對應檔。** `AGENTS.md`、`.antigravityrules` 在其他 host 是否也有 local 版本可用，或只能維持現狀。

---

## 裁定（人類，2026-11-20）

| # | 待決 | 裁定 | 說明 |
|---|---|---|---|
| 1 | `--adapter` 預設值 | **B'** | 只在首次導入時自動選 `local`：`CLAUDE.md` 已追蹤、`--artifacts=local`、且 `CLAUDE.md` 內**尚無** adapter block → 寫進 `CLAUDE.local.md`。`CLAUDE.md` 已有 block（既有 adopter）→ 照舊原地更新，重跑 `init` 行為不變。想搬須明示 `--adapter=local`。 |
| 2 | 既有 adopter 遷移 | **不自動移除，只提示** | 明示 `--adapter=local` 且 `CLAUDE.md` 仍有舊 block 時，寫入 `CLAUDE.local.md` 並印出提示：舊 block 需自行從 `CLAUDE.md` 移除並 commit。`init` 不改動追蹤檔。 |
| 3 | 其他 host 的對應檔 | **本次只做 `CLAUDE.md`** | `AGENTS.md`、`.antigravityrules` 維持現狀。 |

未裁：「順帶觀察」中憲法 §6 `pull --ff-only` 寫「on `main`」一事，不在 P1–P6 範圍內。
