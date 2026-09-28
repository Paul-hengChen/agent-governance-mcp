# agc 使用心得 / 改動提案 — 2026-09-08

討論暫存檔。收斂後才轉成 `docs/backlog.md` 正式票（避免半成品污染 order table）。
狀態：`raised` = 已記錄未定案 / `mapped` = 已對應到現有票 / `filed` = 已開票。

**2026-09-14：H1–H9 全部開票完畢**（E106–E118，全部 P1；`docs/backlog.md` order `00` 與 `0h`–`0s`）。
本檔自此為設計依據與待決事項的來源，不再是開票前的暫存區。剩餘未結的只有 待決表 #1／#3–#9。

**2026-09-15：H1 續談**（worktree-by-default 的完整設計）→ **E123–E129** 開票，order `0x`–`0z` 與 `13n`–`13q`。
翻開關本身的 capstone 票（建議 E130）**尚未開**；待決表新增 #15–#18。

---

## H1 — 自動化開發流程一律在 git worktree 內執行

**提出者**：human, 2026-09-08
**狀態**：`filed` → **E73（order `0`，P1，lifecycle 半邊）+ E106（order `0h`，untrack 半邊）+ E111（order `00`，lane worktree 的 symlink bootstrap）**
**2026-09-15 續**：`raised` → **E123–E129**（order `0x`–`0z`、`13n`–`13q`）。翻開關的 capstone（建議編號 E130）**尚未開票**，見本節 2026-09-15 續談 §6。
**原話**：「使用 agc 工具開始進行自動化開發流程時, 我覺得都要直接開 worktree 進行任務,
確保不會污染 branch 或者其他 worktree」

### 對應現況
- E73（docs/backlog.md:195，order 0，human 於 2026-08-17 從 8g 提升至頭部）已完整涵蓋此需求，
  含 `agc feature start/finish` 的 worktree lifecycle 與 7 條 constraint。
- coord-01/coord-03 的 Feature-Scope Gate 已經在建議 worktree 路線
  （"run the second feature in a separate git worktree"），但那是**人工建議**，非機制。

### 阻塞事實（已量測，E73 (b)(c)(d)）
- `.current/handoff.md`、`tasks.md`、`.current/{metrics,telemetry}.jsonl`、
  `.current/.config.json`、`.current/feature-split.md` 全部 **tracked**（本 session 覆核確認）。
- 182 commits 動過 `handoff.md`；兩個 `.jsonl` 是 append-only → 平行 branch 結構性必衝突。
- `git worktree add` 會 checkout **committed 的 stale handoff** → 新 worktree 出生即帶
  poisoned lease、假 `hop_count`、假 `completed_tasks`。
- 結論：**先 untrack，才談 worktree**。順序不可反。

### 待與 human 確認
1. 「都要開 worktree」是否含 read-only lane？E73 constraint (1) 主張 trigger 為
   **per-feature（chain entry: sr → review → qa）**，coordinator-direct 的 forensics /
   doc / bookkeeping、`/teamwork-lite`、Q&A 一律不付 worktree 成本。
   coordinator 建議採 E73 (1) 的窄觸發，而非字面上的「都要」。
2. 是否同意把 E73 的 (a) untrack 半邊**切出成獨立小票先做**（1–2 files：`agc init` 寫
   `.git/info/exclude` + 本 repo 自身 `git rm --cached`），讓手動 worktree 流程今天就可用；
   `agc feature start/finish` 的完整 lifecycle 留在 E73 本體。
   — 副作用需接受：untrack 後本 repo 不再累積新的 handoff 版本史（既有 182 commits 的
   history 保留，不刪），該史料曾是 E73/E104 這類調查的證據來源。

### 2026-09-15 續談（worktree-by-default 的完整設計；E123–E129 由此開出）

**觸發**：E111 釋出 v3.109.0 後，human 問「以後 agc 開發任務都會開 worktree 嗎」。
**結論先寫**：**不會，而且 E123–E129 做完也還不會** —— 那七張只是把路障移開，真正翻開關的那張票還沒開（見本節最後「還缺什麼」）。

#### 0. 先釐清一個常見誤解：E111 不是「worktree 變預設」

E111 ship 的是**條件式**規則。`content/coord-03-core-fallback.md` 的措辭是 *when the separate-worktree route is taken* —— 它管的是「你如果用了 worktree，別把證據弄丟」。worktree 在 SOP 裡目前只出現在三處（Feature-Scope Gate、E111 的 bootstrap 義務、feature-lease 的 Escalation Routes row），三處都綁在 **feature lease 衝突**上，也就是並行工作的逃生口。

而且 **E111 的對象不是本 repo**：agc 自己三個證據目錄都是 tracked，`agc check` 在這裡永遠靜默，symlink 的需求本地不會發生。E111 保護的是 adopter workspace（目錄 gitignored、證據只存在一份會被 `git worktree remove` 刪掉的目錄裡）。本 repo 對應的解法是 code-reviewer 在 E111 round 2 裁決 R2 時寫下的那句：**tracked 目錄的解法是 commit it，不是 symlink**。

#### 1. 本 session 實測到的阻塞（全部是量測，非推論）

**(a) 治理狀態檔 tracked，每條 lane 對每條 lane 都會撞**
`git ls-files` 覆核：`.current/handoff.md`、`.current/.config.json`、`.current/feature-split.md`、`.current/metrics.jsonl`、`.current/telemetry.jsonl`、`tasks.md` 全部 tracked。證據目錄（`qa_reports/`、`review_reports/`、`specs/`）在本 repo 也是 tracked，且**不在 `.gitignore` 裡**。repo **沒有 `.gitattributes`**，沒有任何 merge driver。

**(b) 衝突要分三級，最危險的那級不會吵**

| 級別 | 檔案 | 行為 |
|---|---|---|
| 吵而安全 | 原始碼、證據檔 | git 會擋。證據檔每票一獨立檔名、純新增，**幾乎不衝突** |
| 吵但解錯會掉東西 | `tasks.md`、`docs/backlog.md`、`.current/handoff.md` | 多 lane 同改的單一大檔 |
| **靜默遺失** | `.current/*.jsonl` | append-only，take-ours 直接吃掉另一條 feature 的紀錄 |

**(c) 靜默遺失的實測實例**（本 session 直接量）：primary 與 e111 lane 各持一份 **44 行**的 `telemetry.jsonl`，**行數相同、位置相同、內容不同** —— primary 第 2/3 行是 E104 的 gate fire（06:45、06:57），lane 是 E111 的（07:39、11:37）。這是最糟的形狀：merge 在完全相同的行位衝突，隨手 take-ours 靜默吃掉另一邊，而且行數一樣，肉眼看不出少了東西。這兩個檔案餵 `tw_gate_stats` → E6 rule-retirement retro，**遺失的後果是一條活規則被誤判成死規則而退役**。

**(d) `handoff.md` 的爆點是活鏈**：E111 全程 primary 掛著 E104 的非終結鏈（`next_role: pm`），merge 時若順手選了 lane 那側，就直接蓋掉一條還在跑的治理狀態。

**(e) 現有偵測器結構上抓不到**：`tw_detect_drift` 比對 `handoff.completed_tasks` 與 `tasks.md` 勾選。一次爛 merge 若**同時**砍掉 lane 的 handoff 與它的 `[x]`，兩邊「一致地錯」，工具回報 *No drift detected*。它偵測的是不一致，不是對稱遺失。與 B2、E112、E120（existence-based 證據 gate）同族。

**(f) MCP server 綁 primary，lane 改的規則在自己的 session 不生效**
`~/.claude.json` 實測：`args: ["/Users/…/agent-governance-mcp/dist/index.js"]`。`workspace_path` 是 runtime 參數所以狀態寫對了 lane，但**執行的程式碼與 prompt 內容都來自 primary**。實證：本 session 載入的 coord-03 **沒有** E111 那段 Worktree bootstrap obligation，因為當時還沒 merge。後果：改 `content/` 或 `gates/` 的票，永遠無法在寫它的那條 lane 裡 dogfood。

**(g) 分層改造的實際尺寸**：`grep` 覆核，**28 個 source 檔**（`tools/`、`gates/`、`guards/`、`prompts/`、三個 `bin/` hook）與 **56 個 test 檔**硬編 `.current` 路徑；`.current/` 底下有約 10 種製品（`.config.json` 被讀 18 次）。改 layout 等於 schema bump + migration。

#### 2. 設計演進（三輪，記錄含被推翻的中間結論）

**輪 1 — human 提案**：`.current/` 底下按 worktree/branch 名開資料夾，各自放 `handoff.md` 等；並設一個角色在 `git pull` / `merge` 時處理衝突。

- coordinator 對**分層**：結構上正確，而且優於 merge driver（不同路徑根本不會被拿來互比，是消滅而非補救），也優於直接 gitignore（gitignore 零衝突但 lane 治理史永遠不進 git，死在 teardown —— 那是 E111 defect 往上一層的翻版）。
- coordinator 對**解衝突的角色**：**反對**，三個理由。(i) 動到 project charter —— `CLAUDE.md` 明寫 *It does NOT touch git. Commit/PR workflow is out of scope*；(ii) 這個角色**沒有 judge**，違反 §3.2 builder ≠ judge，它決定哪些 task row 活下來卻沒有第二隻眼；(iii) 最致命 —— 會把一個**不可驗證的 actor 放在唯一沒有偵測器的失效模式上**（見 1(e)）。
- **反提案**：不要解衝突的角色，要**merge 後的機械不變量檢查**（可計算、可失敗、可寫成 qa-owned test）。
- 另指出分層不是全有全無：`.config.json` 與 `exemptions.json` 是 **workspace 全域政策**，搬進 lane 會讓各 lane 政策分岔，等於把衝突原封不動搬到 config 上。

**輪 2 — human 追加**：把 `tasks.md`、`docs/backlog.md`、`qa_reports/`、`review_reports/` 也收進 lane 資料夾，任務結束時各自 summary 回寫外層。

- coordinator 對**證據目錄比照辦理**：**反對** —— 那就是 harvest-at-teardown，正是 E111 否定掉的模型，且有量測失敗紀錄（一個 adopter 驗收專案 2026-09-08：7 張票 4 張證據在 primary 零副本，靠人工搬運才救回）。失敗原因不是搬運做錯，是**搬運這步沒有發生**；E111 選 symlink 正是為了讓那一步不存在。而證據檔本來就屬「幾乎不衝突」那級，分層無利可圖。
- 對 **`docs/backlog.md`**：它是**輸入不是產出**（`prd_path` 指的就是它），各 lane fork 會壞在票號配置（見 3）。
- 對 **summary**：是壓縮，會永久丟掉逐行 granularity；當時建議 verbatim append。**此建議後來被 coordinator 自己推翻**（見輪 3）。

**輪 3 — human 再精煉**：回寫發生在 **PR merge 之後**，並記下 PR number / commit 編號作為指標。

- **coordinator 撤回輪 2 對 E111 的反對意見**。理由：該 adopter 專案的失效條件是「證據只存在於 worktree 目錄、未 commit、目錄 gitignored」，git 裡什麼都沒有。新版本是 **commit 進 branch、PR merge 進 main**，merge 那一刻證據就永久在 git 歷史裡，之後 summary 回寫**失敗也不會掉東西** —— 它是索引不是唯一副本。風險結構完全不同。
- **同時撤回「要 verbatim 不要 summary」**：那對 `docs/backlog.md` 是錯建議。該檔光 E88 一個 row 就約 4000 字，本 session 讀它得靠 `cut -c1-190` 截斷；再逐行 append 只會更不可讀。**summary + 指標**是對的模式（索引指向 durable store），granularity 沒消失，只是移進 PR。
- **指標必須用 PR number，不能用 sha**：squash-merge 會讓 lane 的 commit sha 與 main 上的對不起來；且本 repo 自己有一次待執行的 history rewrite（E104 phase 1，已在 mirror 備好未推），真的推下去所有記下的 sha 全失效。
- **外層檔案換身分**：`tasks.md` / `docs/backlog.md` 不再是帳本，而是**歷史索引**。唯一寫入者是回寫步驟 → 結構上不可能並行衝突；`tw_*` 工具只看 lane 內那份（**runtime 上本來就已經是這樣**）；外層可壓縮歸檔不影響任何 gate。
- **已有一半機制存在**：release-engineer SOP **7a 已經在歸檔** 到 `qa_reports/archive/<feature>/` 與平行的 `review_reports/` 子樹，E111 也已 ship「只 link 頂層目錄」的限制正是為了讓該子樹跟著走。應**擴充 7a**，不要另造第二條歸檔路徑。

#### 3. 票號撞號：掃描解不掉，延後配號才解得掉

human 提議：開工前掃 `.current/` 看有哪些 worktree，命名若依票號就能知道 E119 有人在做。

- **掃描解得掉的**：兩條 lane 搶同一張**既有**票。等於把 per-workspace 的 feature lease 升級成跨 worktree 的。有價值。
- **但 `.current/` 掃不到在飛行中的 lane** —— 各 worktree 的 `.current/` 是各自的檔案樹。**實證**：本 session 在 e111 lane 內完全不知道 `agent-governance-mcp-e117` 存在，直到跑 `git worktree list` 才看見。**`git worktree list` 才是正確的註冊表**：git 原生、metadata 存在共用 `.git`、所有 lane 都看得到、不需要命名慣例也不需要 bootstrap commit。
- **掃描解不掉的**：兩條 lane 各自**開新票**撞號。開票不會產生 worktree，掃描天生看不到。lane A 看 backlog 最大 E118、看 worktree 沒有 E119 → 挑 E119；lane B 同時做一模一樣的判斷。掃描只把「必然撞」縮成「更窄的 race」。
- **正解：號碼不要在看不見別人的時候決定。** lane 只寫內容不寫號碼（或寫 lane 內暫時代號），release 回寫 apply 時才配號 —— 那一刻只有一個 actor 在寫，且是排隊的，「下一個空號」在每個瞬間只有一個正確答案。**結構上不可能撞，不需要掃描，沒有 race 窗口。**
- 撞號非理論風險：本 repo 常態性在執行中開票 —— E106–E118 出自一個 session、E119–E122 出自另一個、E123–E129 出自第三個。

#### 4. 最終設計與取捨（→ E123–E129）

| 票 | order | P | 要點 |
|---|---|---|---|
| E123 | `0x` | P1 | **分層版（2026-09-16 human 決定）**：`.current/<lane>/` 各自持有 `handoff.md` 與三個 sidecar，**維持 tracked** —— 不同路徑天然不衝突，lane 治理史留在 git 裡。`.config.json`／`exemptions.json` 不搬。代價：schema bump + migration + 28/56 檔的路徑解析 |
| E124 | `0y` | P1 | lane 不配號 + pending 檔 + apply 時配號 |
| E125 | `0z` | P2 | 回寫接 SOP 7a、PR number 當主鍵、外層宣告為 index。證據目錄**不搬** |
| E126 | `13n` | P2 | post-merge 不變量檢查（建議與 E115 併刀）。明寫不要解衝突的 agent 及三理由 |
| E127 | `13o` | P2 | shell cwd 穿透 worktree 隔離 —— **觀察票，無 cut** |
| E128 | `13p` | P3 | Blocked 角色無法修正自己的 Blocked 記錄 |
| E129 | `13q` | P3 | `README.md:182` 過期的 `#v3.104.2` pin |

依賴鏈 E123 → E124 → E125 → E126。

**取捨記錄 —— 並於 2026-09-16 由 human 反轉**。當初（2026-09-15）選了便宜版：gitignore 活狀態檔、由回寫複製快照進 `.current/archive/<lane>/`，成本一行 `.gitignore` + 回寫腳本。**human 於 2026-09-16 重申原案，改採分層版**，E123 已整張重新 scope。

反轉時順帶更正一處當初的不精確：原文寫便宜版「拿到的東西一樣（零衝突 + 歷史保留 + 可追 PR）」—— **「歷史保留」是誇大的**。便宜版把活狀態檔 gitignore 掉，git 裡只會有 release 當下的那一份快照，lane 在執行過程中的狀態演進（每次 handoff 寫入）不會留下。分層版則是全程 tracked。這正是兩者真正的差別，也讓 human 的選擇站得住腳。

**分層版的代價（已量測，寫在 E123 票面避免重推）**：28 個 source 檔碰 `.current`、56 個 test 檔引用它、schema bump + migration、`tw_gate_stats` 與 `usage-accounting` 要改成跨 N 個 lane 目錄聚合。**三個必須在 cut 呈現時結清的決定**：lane 名來源（建議用票號 `e111`，由 `feat/<id>-*` 慣例推出並在 bootstrap 時寫進 `.current/.config.json`，rename-safe 且無 `/` 問題）、merge 後 lane 目錄的生命週期（否則 `.current/` 自己變成這個設計要解決的無限成長問題）、以及 E125 還欠什麼（歷史既然 tracked，它的快照歸檔那半大致多餘，但 `tasks.md`／backlog 回寫那半不受影響、仍然需要）。

#### 5. 實地事故：shell cwd 穿透了 worktree 隔離（E127 的來源）

本 session 在 E111 的 QA 輪實際發生：

1. harness 每次 Bash 呼叫後把 cwd **重置回 primary**，多次呼叫搭 fixture 時每次都從 primary 重新開始
2. 於是在 primary 建出 `s1primary/`、`w567primary/`，並把 fixture 檔寫進 primary 真正的 `qa_reports/`、`review_reports/`、`specs/`
3. 且 **commit 進 main**：`96a562b "tracked baseline"`（三個檔，內容各一行 `tracked` / `tracked v1`）
4. 該 commit 隨**無關的** E117 feature branch 上了 origin
5. 最後由**另一個 session** 以 `54dcfdc` 清掉

「不要動 primary」寫在鏈上每個角色的 dispatch brief 裡，**每一次刻意編輯都遵守了**；邊界是被**副作用**穿透的。沒有任何 gate 看得到：`GATE_REGISTRY` 全部 33 條都在驗狀態寫入，**沒有一條觀察 `workspace_path` 以外的檔案系統寫入**。

需一併記錄的是：**提交進去的測試是乾淨的** —— `mkWorktreeFixture()` 用 `mkTmp` 並帶顯式 `cwd`，獨立跑完整套零殘留（本 session 驗過）。漏的是臨場量測指令，那是更難治的一半。

**目前沒有便宜解法**，故 E127 只開成觀察票。但 worktree-by-default 會把暴露面乘上 lane 數量，因此它是翻開關前必須先處置的項目之一。

#### 6. 還缺什麼才真的變成預設

E123–E129 全做完，仍**不會**變預設：

| 項目 | 狀態 |
|---|---|
| 合併衝突 | ✅ E123 |
| 撞票號 | ✅ E124 |
| 回寫／無限成長 | ✅ E125 |
| 靜默遺失 | ✅ E126（併 E115） |
| **翻開關本身**（改 `coord-03` Feature-Scope Gate 的措辭） | ✅ **E130**（order `13r`，2026-09-15 開票） |
| **每個成本煞車被 lane 數除掉** | ❌ **E113**（2026-09-16 補進 E130 依賴：hop 上限量到 2.8 倍超標且單次讀取永遠看不到；扇出變預設等於讓所有煞車名存實亡） |
| **lane bootstrap 機制**（`agc feature start/finish`） | ❌ **E73**（2026-09-15 重新劃界：E73 = 機制，E130 = 政策；E130 不自己造 bootstrap，改為呼叫 E73 的指令） |
| PM 怎麼切 lane | ❌ **E110 仍開著**（human 原始需求：切成可平行、盡量無互依） |
| join 前置驗證 | ❌ **E115 仍開著** |
| worktree 重用 → 永久覆蓋前一張票的 ledger | ❌ **E116 仍開著**；「一張票一個 lane」之下從罕見變常見 |
| shell cwd 穿透 | ❌ **E127 無解法** |

coordinator 判斷 **E116 與 E127 是真正的擋路石**。

**建議的 capstone 票（尚未開，待 human 決定）**：

> **E130**（**已開票 2026-09-15，order `13r`，P2**）— 把 lane worktree 從逃生口改為預設：改 `content/coord-03-core-fallback.md` 的 Feature-Scope Gate 措辭、`agc init` 生 lane bootstrap、並宣告適用範圍。
> `depends_on: **E73**, E123, E124, E125, E126, E110, E115, E116`，且 **E127 必須先有處置**。
> 票面明寫 E116／E127 是 load-bearing 前置而非清單項目，且範圍決定須在 cut 呈現時結清。

#### 7. 範圍問題（待決 #15）

human 的問句是「使用 agc 工具開發的**專案**」，但整場討論的對象其實是 **agc 自己這個 repo**。兩者差異實質：

- agc 自己 **tracked** `.current/` 與三個證據目錄；絕大多數 adopter 是 gitignore 它們（正是 E111 要救的形狀）
- E125 的回寫假設有 PR 流程，adopter 不一定有
- 對單人小專案，每張票一個 worktree 是淨成本

coordinator 立場：**agc 自身先預設開 lane，adopter 端等有實績再談**，兩者當成兩個決定。


---

## H2 — PM 切票必須切成「可平行、盡量無互相依賴」

**提出者**：human, 2026-09-08（2026-09-08 第二輪：human 補述 NDI 實際工作模式）
**狀態**：`filed` → **E110（order `0l`，P1）**；(a) → E111、(b) → E109、(d) → E117
**原話（第一輪）**：「PM 這個角色在切票時, 要切成可以把任務平行開發且盡可能量不互相依賴的狀態」
**原話（第二輪）**：依賴票優先序拉高先做 → 可平行票基於被依賴票的 worktree 開新 worktree →
開發完推回被依賴票的 worktree → 統一發一個 PR。

### 實證來源（coordinator 直接讀樹，非詢問 peer session）
一個 adopter 驗收專案的本機 checkout，live worktree 拓樸與 `docs/BACKLOG.md` §SRCL。
該專案的一個 peer session 存在但未詢問——工作樹本身是更強的證據。

### 已驗證的 pattern：`S0 → L1..Ln（平行）→ J1a → J1b`（單一 PR）
NDI 把 SRCL 從**舊的 8 列序列切票**（`SRCL-ARCH01`→`SRCL01..06`→`SRCL07`）**作廢重切**成
4 條平行 lane，human 已核准：

```
S0（序列種子，只凍結 types.ts 契約，depends_on: none）
  ├─▶ L1 state        ─┐
  ├─▶ L2 view+widget  ─┤
  │   L3 mock bridge  ─┤──▶ J1a 接線 ─▶ J1b 整合  （序列，最後落地）
  │   L4 docs contract─┘
```
- **人類的硬不變式**：`L1–L4 互不碰觸對方的檔案`。各自獨立 worktree／branch／`.current/`／session。
- 全部併回 `feat/screen-source-list`，**只有這條整合分支開一個 PR 到 main**。
- git 覆核：三條 lane 現為 `0 ahead / 15–17 behind` root → 已全部併回；root 領先 main 28 commits，
  `origin/feat/screen-source-list` 已存在（統一 PR）。pattern 走完一輪，可用。

### 讓 L1/L2 真平行的機制（本節最關鍵，且 agc SOP 目前沒有）
lane 歸屬**依 AC 的 `proof:` 落點決定，不依 AC 的主題**。凡 proof 落在
`SourceListView`／`NoNetworkBlock` 的 DOM 斷言 → 一律 L2，因為該 view 是**純、prop-driven**：
測試手造 props 即可滿足 proof，**L2 不等 L1，只等 S0 凍結的 `SourceListViewProps`**。
→ 平行性的真正來源＝「prop-driven 純元件 ＋ 提前凍結的 props 型別」，不是 `depends_on` 排序。
→ NDI 實際抓到過錯誤：human 草案把 AC8／AC12／AC13 放 L1，逐條核對 `proof:` 後改判 L2。
   **這道 per-AC proof 稽核是 PM SOP 缺的步驟。**

### 我原本三個缺口的結案
1. `touches`（實際路徑集合）欄位 —— **確認需要，且 NDI 已手工實作**：lane 表第 2 欄就是檔案集合。
   → 形式化進 `content/skill-pm.md:113` 的 cut 表頭與 `feature-split.md` 表頭。
2. `order` 線性 → DAG —— **修正**：實際形狀不是任意 DAG，而是固定三段拓樸
   **seed → fan-out → join**。應當作**樣板**寫入，比通用 DAG 簡單也更好用。
3. release 瓶頸 —— **撤回，理由比 human 給的更強**：不是「release 只有本專案用」，而是
   **單一 PR join 在結構上就序列化了** —— N lanes → 1 branch → 1 PR → 1 release，
   平行度根本到不了 release role。跨 *feature* 併發才需要 queue，而那已被 feature lease 擋住。

### NDI 暴露、E73 與本檔第一版都沒涵蓋的四件事
- **(a) gitignored 產出在新 worktree 裡不存在，且已造成過事故**（`§SPC01 的事故成因`）：
  `specs/`、`qa_reports/`、`review_reports/` 為 gitignored → 新 worktree 裡三者皆無。
  NDI 的解法是在 worktree 內做**指回 primary 的 symlink**。
  → **E73 constraint (3) 只處理了 `docs/backlog.md` 與 `.config.json`，漏了這三個目錄。需修正 E73。**
- **(b) 治理狀態的錨點是分裂的，與 E73 的「workspace ≡ feature」相衝突。**
  NDI 明文規定 S0／J1a／J1b 的 `workspace_path` ＝ **primary**（「不要把 worktree 路徑傳給任何
  `tw_*` 工具」），但 L1–L4 **各有自己的 `.current/handoff.md`**（已覆核：7 個 worktree 全部有）。
  後果：feature lease／`hop_count`／`tw_detect_drift` 全部變成 per-lane，沒有元件看得見整個 feature。
  NDI 實際上是用 **tracked 的 `docs/BACKLOG.md` 承擔 handoff 無法承擔的協調職責**。
  → coordinator 建議：**把這件事寫成明示設計**（lane plan 放 tracked backlog/spec，handoff 保持
  per-lane，不要試圖讓 lease 跨 lane），而不是視為缺陷去「修好」。這是 H2 最大的待決問題。
- **(c) per-worktree bootstrap 成本真實且失敗是靜默的**：root 與 `app/web` 都要跑 `pnpm install`，
  漏任一次 → git hook 靜默跳過或 commit 失敗。E73 的「link node_modules / copy .env」方向正確，
  但需標明失敗模式是 silent。
- **(d) `tasks.md` 沒有作廢能力 —— 新的 tw_* 缺口。** 舊 8 列切票作廢後仍是 `[ ]`，
  「PM 沒有工具能刪除或劃記」，NDI 只能追加一列 `SRCL-VOID` 標記任務當 workaround。
  → 候選新票：`tw_void_task`，或 task 增加 `voided` 狀態。

### 待與 human 確認
1. (b) 的錨點分裂要「明示為設計」還是「當缺陷修」？coordinator 主張前者。
2. seed→fan-out→join 樣板要寫進 `skill-pm.md`（PM 切票時主動採用）還是只寫進 coordinator 的
   Feature-Scope Gate（人工選用）？coordinator 主張 `skill-pm.md`，因為 per-AC `proof:` 稽核是 PM 的動作。
3. (d) 是否獨立開票。

### 護欄（仍成立，需寫進票）
不可為平行而平行。PM 須保留宣告 `serial — shared layer` 的權利；S0 這類共享層必須 serial-first。
NDI 的 S0 只凍結型別、不含行為，正是這條護欄的正確實作範例。

---

---

## H2-b 深入 — 治理錨點分裂（2026-09-08 第三輪，human 要求闡述）

### 論點一句話
**`workspace` 不再等於 `feature`，而 agc 每一個機制都以 workspace 為鍵。**
lease、`hop_count`、round caps、`tw_detect_drift`、telemetry、evidence 路徑、
`cut_approved` —— 全部 per-workspace 解析。fan-out 把一個 feature 攤成 5 個 workspace，
於是這些機制沒有「壞掉」，它們**各自正確地回報了一個不再等於 feature 的範圍**。

### 實測：一個 feature，五份互不相見的 ledger
（一個 adopter 驗收專案的本機 checkout，2026-09-08 讀取）

| workspace | `active_feature` | status | hop | completed | review/qa rounds | telemetry 行 |
|---|---|---|---|---|---|---|
| primary | `screen-source-list` | PASS | 8 | S0 | 0 / 1 | 67 |
| wt `source-list` | `source-list-join-b` | PASS | 4 | J1b | 0 / 0 | 1 |
| wt `srcl-l1-state` | `source-list-state` | PASS | 6 | L1 | 1 / 0 | 2 |
| wt `srcl-l2-view` | `source-list-view` | PASS | 4 | L2 | 0 / 0 | 1 |
| wt `srcl-l3l4-mock-contract` | `source-list-mock-contract` | PASS | 6 | L3, L4 | 1 / 0 | 2 |

primary 自己的 `scope_decision_why` 明寫 **"Still single-feature ... only dispatch topology
changed"** —— 人類與文件都認定這是一個 feature，但 ledger 記成 5 個 `active_feature`。

### B1 —— 證據即將永久遺失（最嚴重，距離一個指令）
`specs/` 在四個 worktree 都是 symlink 回 primary，但 **`qa_reports/`／`review_reports/`
只有整合 worktree `source-list` 做了 symlink，三條 lane worktree 都是 REAL DIR**。
覆核結果：

```
review_SRCL-L1.md   primary qa_reports:N  review_reports:N   （只存在於 srcl-l1-state/）
review_SRCL-L2.md   primary qa_reports:N  review_reports:N   （只存在於 srcl-l2-view/）
review_SRCL-L3.md   primary qa_reports:N  review_reports:N   （只存在於 srcl-l3l4/）
review_SRCL-L4.md   primary qa_reports:N  review_reports:N   （只存在於 srcl-l3l4/）
```
primary 只有 `review_SRCL-{S0,J1a,J1b}.md` + `visual_SRCL-J1b.md`。
**7 張票裡 4 張的 code-review ＋ QA 證據零副本在 primary**，而那四張全部 PASS ＝ 可拆除狀態。
E73 (d) 已實驗證明 gitignored 產出**不會**阻擋 `git worktree remove`（連 `--force` 都不用），
所以拆除即毀證。L1 自己的 handoff 還明寫 "gitignored, not in the commit"。
→ PR reviewer 在 primary 看得到的證據，結構上只涵蓋 3/7 張票。

### B2 —— `tw_detect_drift` 在 6/7 未記錄的情況下回報「乾淨」
primary `handoff.completed_tasks` = `[SRCL-S0]`；primary `.current/tasks.md` 只有
`SRCL-S0` 是 `[x]`，`L1/L2/L3/L4/J1a/J1b` 全是 `[ ]`。兩邊一致 → **drift 判定 clean**。
但真實狀態是 7/7 PASS。專門用來抓這類 desync 的工具，對這個形狀**結構性盲目**——
它沒有算錯，它正確地回報了一個不再等於 feature 的範圍。
副作用：primary 的 `tw_get_next_task` 會發出已作廢的 `SRCL-ARCH01`（line 97，`[ ]`，
`depends_on: none`）—— 這正是 NDI 必須手工加 `SRCL-VOID` 標記列的原因（見 H2 (d)）。

### B3 —— 所有 feature-scoped 成本閘門同時失效
- **`hop` cap = 10。實際消耗 8+4+6+4+6 = 28**，且 J1a 的 hop 已不可考（見 B5），真值更高。
  任何單次讀取最高只看到 8 → **上限不可能觸發，2.8 倍超支且完全靜默**。
- **`review_round` / `qa_round` cap = 3，per-lane**。4 條 lane 理論上可燒 12 輪
  CHANGES_REQUESTED 而永遠不會 lock 到 pm。
- **telemetry 5 份**（67/1/2/1/2）。`tw_gate_stats`（E26，E6 retro 的資料來源）讀單一 sidecar
  → 任何 gate 統計對 fan-out feature 都失真。
- **token brake 若啟用會 5 分**：`tokenBudgetPerFeature` 依 `.current/usage.jsonl` feature-scoped
  加總，5 個 sidecar 各算 ~20% → 80% 煞車永不觸發。（NDI 目前未設此鍵、無 usage.jsonl，
  所以尚未被咬到；但這是 agc 自己要採用 fan-out 時的必然後果。）

### B4 —— `cut_approved` 由一次人類核准繁殖成五次自我認證
五份 handoff **全部** `cut_approved: true`。人類只在 2026-09-07 的 parent coordinator chat
核准過一次。L2 自己的 `scope_decision_why` 誠實寫明出處：
*"Cut approved once in the parent coordinator chat 2026-09-07"*。
但 coordinator SOP 的 writer obligation 要求「confirm the approval text appears in **YOUR OWN**
conversation turn — never write cut_approved from a subagent's summary or relayed claim」。
lane coordinator 沒有目擊，它繼承了一個轉述。
→ **`CUT_APPROVAL_REQUIRED` 在單一 workspace 內不可偽造，跨 lane 則退化為信譽制。**
這裡的實作是誠實的（註記寫了出處），但機制**無法區分誠實繼承與捏造**——缺的是一個
「繼承」語意，而不是第五次「見證」。

### B5 —— join 前置條件無機器檢查；且 worktree 重用會銷毀前一張票的 ledger
- J1b 的 `depends_on`（J1a, L3, L4）滿足性只寫在**散文**裡：
  *"J1a PASS at 0637e61, L3+L4 merged at 3245bb9"*。沒有任何東西驗證過。
  server 也無法驗證：L3/L4 的 PASS 在另一份 `.current/handoff.md`，整合 workspace 從不讀它。
  一條 FAIL 或猝死的 lane **不會**阻擋 join。
- **J1a 的 handoff 記錄已不存在。** J1a 與 J1b 共用整合 worktree `source-list`，
  `active_feature` 從 `source-list-join-a` 改成 `source-list-join-b` 時整份被覆寫
  （`active_feature` 變更同時重置 `hop_count`）。J1a 的 PASS 現在只殘存於 J1b 的
  `scope_decision_why` 散文與 git。**同一 worktree 依序跑兩張票 → 前票 ledger 永久消失。**
- 附帶：`tasks.md` 宣告的 lane 身分與實際不符（line 134 宣告 L3 用
  `active_feature=source-list-mock`、line 135 宣告 L4 用 `source-list-contract-docs`，
  實際兩張票合用一份 `source-list-mock-contract`）。無任何檢查。

### 決定性證據：這條錨點規則連它的作者一天內就沒遵守
`docs/BACKLOG.md` §SRCL《開工位置》明文規定：治理 `workspace_path` ＝ **primary**，
「**不要把 worktree 路徑傳給任何 `tw_*` 工具**」，且 S0／J1a／J1b 用整合 worktree。
實際：`.claude/worktrees/source-list/.current/handoff.md` 存在且持有 `source-list-join-b`
→ **J1a／J1b 寫進了 worktree 自己的 `.current/`，不是 primary。**
→ 這不是紀律問題，是規則本身**太細以致不可遵守**：一個 role 在 worktree 裡工作，
自然會把 cwd 當 workspace。「有些票錨 primary、有些票錨 worktree」不是可執行的規則。

### coordinator 的建議（修正版）
**不要試圖讓 lease／hop／round caps 跨 lane。** 對一條 lane 而言，per-lane 預算其實是
*正確* 語意：lane 就是一個有界工作單元。要放棄的是「一個 feature 一份 ledger」的假設，
並補上三件跨 lane 才需要的東西——而它們都不是 lease：

1. **證據 harvest 必須在 lane PASS 當下發生，不是在拆除時。**
   最便宜的解法：lane worktree 沿用整合 worktree**已經在用**的 symlink 紀律
   （`qa_reports/`、`review_reports/` → primary）。一行 bootstrap 規則，
   **完全消滅 B1，零 server 成本**。這是投報率最高的一項，應獨立開票並優先。
2. **feature 層 roll-up 記錄。** 今天只有 `docs/BACKLOG.md` 散文在做這件事。
   建議維持散文（server 刻意 workspace-scoped、非跨機器，不該加跨 workspace 讀取），
   但把它寫成 PM／coordinator 的**明示義務**：feature 收尾時必須列出所有 lane 的
   ticket／status／hop 總和。至少讓 B3 的 28 vs 10 在人類眼前出現一次。
3. **`cut_approved` 需要「繼承」語意，而非第五次見證。**
   候選：新欄位 `lane_of: <parent_feature>` 或 `cut_approved_source: inherited:<feature>`，
   讓 lane 記錄「繼承自母 feature 的核准」而不是聲稱親自見證。保住 §3.1 的稽核性質。
4. **join 前置條件可以用 git 機器檢查，不需要跨 workspace 讀取。**
   `git merge-base --is-ancestor <lane-branch> HEAD` 對每個 `depends_on` 的 lane branch 驗證
   —— 本地可驗、便宜、不需要新的跨 workspace 機制。可作為 join 票的 build-entry 自檢。

### 待與 human 確認（更新）
1. 上述 1（symlink 紀律）是否立刻獨立開票？coordinator 主張是，且優先於 E73 本體。
2. 3（`cut_approved` 繼承語意）需要 handoff schema 升版，是否接受？
3. 4（git ancestor 檢查）要做成 gate，還是只寫進 SOP 當自檢步驟？

---

## H3 — 由 PM 寫 QA 的驗收條款

**狀態**：`filed` → **E118（order `0s`，P1）——但該票卡在 待決 #9，需 human 先指認缺口屬於三選一的哪一個**

已實作的部分：
- `content/skill-pm.md:20` —— PM 的 **Acceptance Criteria** 用 BDD `Given / When / Then`，
  每條 AC 必須可測，且帶 **`proof:` 標註**（可執行的驗證指令）。
- `content/skill-qa-engineer.md:17` —— 每條 spec AC 必須映射到 ≥ 1 個測試，映射關係寫進 review doc。
- `content/skill-qa-engineer.md:78` —— **Phase 3.5 AC Execution**：QA 掃 spec 的 `proof:` 標註並實際執行。
- **server 端有閘門**：spec 只要宣告了任一 `proof:` AC，PASS 會被
  `AC_EXECUTION_LOG_MISSING` 拒絕，除非附上執行記錄。
- NDI 實例：`specs/screen-source-list.md` 17 條 AC，且 lane 歸屬就是逐條依 `proof:` 落點裁定的（見 H2）。

→ **待確認**：這條需求跟現況的差距在哪？可能的解讀（請指認）：
  (i) 現況夠了，你只是不知道已經有；
  (ii) 你要的是 PM 額外寫一份**QA 面向的驗收清單**（跟 AC 分開）；
  (iii) 你遇到的是 PM 寫的 AC**不可測 / proof 寫不出來**，要加強 PM 端的品質要求。

---

## H4 — agc 退場機制

**狀態**：✅ **done 2026-09-28** —— (a) 隨 E73 出貨；(b) E108 出貨（`agc eject`，預設 dry-run、`--yes` 執行）

覆核：`bin/agc-init.mjs` 只有 `init` 與 `check` 兩個子命令，沒有 `eject`／`remove`／`uninstall`。
`docs/backlog.md` 全文無 eject / uninstall / 退場 / stop using agc 相關票。

需先釐清「退場」的層級 —— 兩種完全不同的東西：
- **(a) feature 層退場**：一個 feature 做完後把 worktree／governance 產物收乾。
  ＝ E73 的 `agc feature finish`（harvest → PR → merge → remove），已在 order 0。
- **(b) 專案層退場**：一個專案決定**不再使用 agc**，要能乾淨移除所有 agc 痕跡
  （`.current/`、`tasks.md`、adapter stamps in `CLAUDE.md`／`AGENTS.md`／`.antigravityrules`、
  gitignore 規則、以及 H6 講的程式碼內註解引用）。**這個完全沒有。**
  且 (b) 跟 H5／H6 直接相扣：產物不上 repo ＋ 程式碼不留引用，本身就是「隨時可退場」的前提。

→ coordinator 判斷：H4 真正的新東西是 **(b)**，而且 H5／H6 是它的兩個必要條件。
   建議把 H4/H5/H6 當成**同一組**（「agc 可逆性 / reversibility」）而非三張獨立票。

---

### 2026-09-14 續談（human 提案：完成專案後可下指令清空產物）

**eject 不能是「undo init」。** 覆核 `bin/agc-init.mjs`：init 實際只建四樣 ——
`.current/.config.json`、`tasks.md`、`CLAUDE.md` 的 adapter 區塊（有 `BEGIN/END agc-adapter` marker，可精準移除）、
`AGENTS.md` / `.antigravityrules`。**其餘全是 runtime 長出來的**（`handoff.md`、`telemetry.jsonl`、
`metrics.jsonl`、`specs/`、`qa_reports/`、`review_reports/`）。eject 的清單必須自己列。

**分類（2026-09-14 修正：原本的 (ii) 包太大，依「領域知識 vs 治理紀錄」再拆）**：

| 類 | 內容 | 非 agc 同事讀到 | 處置 |
|---|---|---|---|
| (i) 機械狀態 | `.current/`（handoff、config、lock、telemetry、metrics） | 看不懂，也不需要看 | **預設清** |
| (ii-a) 領域知識 | `design/`、`specs/` | **讀得懂**（H9 生效後更是），是「為什麼這樣做」的唯一紀錄 | **預設保留** |
| (ii-b) 流程證據 | `qa_reports/`、`review_reports/`、`tasks.md`、`docs/backlog.md` | PASS/FAIL、round 數、gate 名稱 —— **純噪音** | **預設清** |
| (iii) 宿主痕跡 | adapter 區塊、`.git/info/exclude` 規則、MCP server 註冊、`~/.claude/agents/` 的 12 個樣板 | — | **預設清**（見邊界 3） |

**三個邊界**（與 H8 決定 4 同一個誠實原則）：

1. **不碰 git history** —— 產物若曾 tracked（`repo` 模式），刪檔＋commit 後歷史裡仍在。必須明講，不可讓人以為乾淨了（E104 先例）。
2. **不碰程式碼內註解** —— H6 那類引用機器判讀不了，eject 清不掉，誠實列為「剩下這些要人處理」。
3. **不改使用者的 host 設定** —— `.mcp.json` / `settings.json` 的 server 註冊是 host 層，印指令、不代跑。

**H9 收掉的一個設計** —— 產物本來就通用，所以不需要「退場時把 review/QA 結論降級摘要成
commit message」這個加值功能。

**`--yes` 不等於全清**（2026-09-14 澄清）：`agc eject --yes` 執行的是上表的**預設處置** ——
清 (i)+(ii-b)+(iii)，**保留 (ii-a)**。理由是 H9 的直接推論：通用化之後 `design/`／`specs/`
**已經不算「agc 產物」**，它們是專案文件，只是碰巧由 agc 產出。eject 清的是「只有 agc 才看得懂、
才用得到的東西」，不是「agc 碰過的東西」。

**`--purge-knowledge`（已決 2026-09-14：加，但不預設）** —— 連 (ii-a) 也刪的真・全清，
需明確指定。預設保留的理由同上。

**仍未決**：`agc eject` 是否預設 dry-run、`--yes` 才真的動手（這會是 agc 第一個 destructive 指令；init/check 都只增不減）。coordinator 立場：是。

---

## H5 — agc 產物不上 repo

**狀態**：✅ **done 2026-09-28** —— E106 出貨（`agc init --artifacts=local|repo`，config schema 2）

- NDI：`.gitignore` 已含 `/specs/`(26)、`/qa_reports/`(24)、`/review_reports/`(25)、`.current/`(19)；
  四者 tracked 檔案數 **0 / 0 / 0**（`design/` 是刻意 tracked 的 122 檔，不在此列）。
- agc 自己：`.current/handoff.md`、`tasks.md`、`.current/{metrics,telemetry}.jsonl`、
  `.config.json`、`feature-split.md` **全部 tracked**（H1 已詳列）。
- `bin/agc-init.mjs` 不寫任何 ignore 規則 → 新採用者第一個 commit 就把 ledger 帶進共用 repo。

**2026-09-14 human 修正 —— 適用範圍**：H5 是 **per-workspace 決定，不是全域規則**。

- **本 repo（agent-governance-mcp）是明確例外：產物照常上版控。** 這裡的 agc 產物就是產品自身的
  dogfood 證據，`.current/`、`tasks.md`、`specs/`、`qa_reports/` 全部 tracked 是刻意的，不是待修缺陷。
- **NDI 也是例外，但方向相反**：它一開始就打算上 repo，開發到中期才因為「有同事不使用 agc」
  轉為 untrack。2541 處 dangling reference 是**那次中途轉向的遺留**，不是 H5 的必然後果。
- 真正的目標對象：**一開始就確定不上 repo 的團隊 repo** —— day 1 就 gitignore，沒有回溯清理問題。

→ 無新分析，H1 的排序結論適用：**這是 E73 裡最該先切出來獨立做的一半。**

---

## H6 — 程式碼不得留 agc 產物關聯的註解

**狀態**：✅ **done 2026-09-28** —— E107 併入 E231 出貨（constitution §6 *Generic citation*，merge `f95e4ae`）

**2026-09-14 human 修正 —— 真正的動機**：H6 的理由是 **「當有同事不使用 agc 時，註解不會讓他們看不懂」**
（跨團隊可讀性），不是 dangling reference。後者是附帶後果，不是立論基礎。

**2026-09-14 human 決定 —— 本 repo 豁免票號規則**：H6 拆成兩條，適用範圍不同。

| 規則 | 內容 | 本 repo | 團隊 repo |
|---|---|---|---|
| A | 註解只准引用 **tracked** 的路徑 | 適用（`specs/` 已 tracked → 合法） | 適用（只剩 `design/`） |
| B | 註解不准出現票號／AC 編號 | **豁免** | 適用 |

B 豁免的理由：本 repo 的讀者都是 agc 使用者，且 `docs/backlog.md` 已 tracked，`E26`／`E36` 是**有效索引**
而非無意義字串 —— human 原話「當有其他同事不使用 agc 時」本身就是條件句，本 repo 不滿足該條件。
現況因此無須清理（`tools/handoff-orchestrator.ts` 92 處、`gates/registry.ts` 44 處、`tools/transitions.ts` 33 處等，全部保留）。

憲法現況：`content/const-*.md` 全文關於註解**只有一條**
（`const-03-core-surgical.md:1` 的「不要順手改動鄰近註解」）。
**沒有任何規則管註解內容、沒有禁止引用治理產物、沒有篇幅要求。** H6／H7 都是全新政策。

實測（NDI `app/web/src`，排除測試檔）：

| 引用類型 | 出現次數 |
|---|---|
| `specs/*.md`、`qa_reports/*.md`、`review_reports/*.md` 路徑 | 177 |
| ticket id（`SRCL-*`、`APL*`、`BRG*`、`SEL*`、`TGL*`、`DLG-*`、`BTN-*`…） | 293 |
| AC 引用（`AC<n>`、`SL-A<n>`） | 2071 |
| **合計** | **~2541，散布 116 個檔案** |

**這不只是「看不懂」，是 dangling reference。** 被引用的 `specs/`、`qa_reports/`、
`review_reports/` 三個目錄 tracked 檔案數都是 **0** —— 任何 clone 這個 repo 的人／AI，
讀到 `App.tsx:4` 的 `specs/webview-app-shell.md AC12`，**那個檔案在 repo 裡根本不存在**，
`AC12` 也無處可查。H5 成立的同時，H6 就從「風格問題」升級為「壞連結問題」。

**但因果要修正**：dangling reference 並非「H5 成立才出現」。即使 day 1 就 gitignore，寫程式的 agent
本機仍看得到 `specs/`，仍會寫下 `specs/foo.md AC12`，clone 的人一樣讀到壞連結。早做決定省掉的是
**回溯清理那 2541 處**，不是問題本身 —— 問題只有 H6 關得掉。

（註：引用 `design/*.md` 是**安全**的 —— 那個目錄刻意 tracked、122 個檔案在 repo 裡。
分類規則因此不是「禁止引用一切治理產物」，而是「禁止引用 **未 tracked** 的產物」。）

---

## H7 — 註解長話短說

**狀態**：✅ **done 2026-09-28** —— E107 併入 E231 出貨（constitution §6 *Generic citation*，merge `f95e4ae`）

實測（NDI `app/web/src` 非測試檔）：**33,584 行原始碼、11,247 行註解 → 33%**。
最極端的檔案：

| 檔案 | 註解／總行 | 比例 |
|---|---|---|
| `components/ui/Combobox.tsx` | 437 / 644 | **68%** |
| `screens/source-list/sourceListState.ts` | 373 / 539 | **69%** |
| `screens/app-launch/useBrandIntro.ts` | 354 / 534 | **66%** |
| `components/ui/DropdownPanel.tsx` | 313 / 513 | 61% |
| `showcase/Showcase.tsx` | 504 / 1851 | 27% |

→ 診斷：篇幅膨脹的**成因**多半就是 H6 —— agent 把 spec 的 rationale 逐段搬進註解。
   兩者是同一個病的兩個症狀，應同票處理。

---

## ⚠️ H5 + H6 的交互衝突（必須先解，否則會弄丟「為什麼」）

H5（產物不上 repo）＋ H6（程式碼不留引用）**同時成立時，rationale 就從 repo 裡完全消失**：
spec 不在 repo、註解也不准指向它 → 沒有任何 clone 得到的東西記錄「為何這樣寫」。
H7 再砍掉註解篇幅，會加速這個流失。

→ 這一組三票必須一起決定「**why 落在哪裡**」。三個候選落點：
  1. **`design/` 已經是 tracked**（NDI 有 122 個檔案）—— 把需要留存的 rationale 收斂到這裡，
     註解只准引用 tracked 路徑。（最小改動，且與現況一致）
  2. **commit message／PR body** —— 隨 git history 永存，非 agc 使用者也讀得到。
  3. **註解只寫「是什麼／不變式」，不寫「哪張票要求的」** —— 保留知識、去掉治理耦合。

coordinator 傾向 **1 ＋ 3 併用**：註解寫不變式與陷阱（不提票號、不提 gitignored 路徑），
需要溯源的長篇 rationale 放 tracked 的 `design/` 或 commit message。

### 2026-09-14 收斂（human 修正後）

- **本 repo 不存在這個衝突**：產物 tracked，註解引用 `specs/` 完全合法 → H5/H6/H7 在此不必綁成一組票。
- **「只准引用 tracked 的路徑」這條規則不需要 per-repo 分岔**：在 agc repo 它等於「可自由引用 `specs/`」，
  在 NDI 它等於「只能引用 `design/`」。同一條字面規則，兩邊都給出正確答案。
- **剩下真正要決定的只有 H6 的跨團隊可讀性**：ticket id／AC 編號對不用 agc 的同事沒有意義，
  無論被引用的檔案 tracked 與否 —— 這是候選落點 **3**（註解只寫不變式與陷阱）的獨立理由，
  不依賴 H5。落點 1（tracked `design/`）仍適用於需要長篇溯源的部分。
- **2026-09-14 結清**：規則 B 的適用範圍已由 human 決定 —— 本 repo 豁免，團隊 repo 適用（見 H6 表）。
  H5+H6+H7 不再是必須綁在一起的一組票。

---

## H8 — `agc init` 必須在裝機時就決定產物上不上 repo

**提出者**：human, 2026-09-14
**狀態**：✅ **done 2026-09-28** —— E106 出貨（`agc init --artifacts=local|repo`，config schema 2）
**關係**：這就是 **E73 (a) untrack 半邊**，也是 2026-09-08 中斷題的答案（先拆 untrack 半邊）。

### 問題

`bin/agc-init.mjs`（421 行）目前 **零 flag、完全非互動**，只有 `init` / `check` 兩個 subcommand，
且不寫任何 ignore 規則 → 新採用者的第一個 commit 就把 ledger 帶進共用 repo。
與其事後清理（NDI 的 2541 處就是這樣來的），不如裝機時決定一次。

### 決定（2026-09-14，human）

| # | 決定 | 理由 |
|---|---|---|
| 1 | **用 flag，不用互動提問**：`agc init --artifacts=local\|repo` | `agc init` 常由 agent 在 session 內執行（`npx github:...`），readline 在非互動環境會 hang |
| 2 | **預設 `local`（不上 repo）** | 不可逆性不對稱：local→repo 只要 `git add`；repo→local 之後**歷史裡已經有了**（E104 先例） |
| 3 | **local 模式寫 `.git/info/exclude`**，不寫 `.gitignore` | 維持 2026-08-17 方向：共用 repo 零足跡，同事看不到與他們無關的規則。代價是不隨 clone 走，換機器要重做 |
| 4 | **已 tracked 的檔案：只偵測＋印指令，不代跑** | `git rm -r --cached` 不在憲法 §6 sanctioned git 操作清單；那個 commit 對同事顯示為刪檔；且代跑容易讓人誤以為乾淨了 |

### 決定 4 要關掉的陷阱（最重要的一點）

在 `.current/handoff.md`、`tasks.md` **已經 commit** 的 repo 裡執行 `--artifacts=local`，
把路徑寫進 `.git/info/exclude` **完全沒有效果** —— git 的 ignore 規則只對 untracked 檔案生效。
使用者以為保護好了，下次 `git add .` 照樣把 ledger 送進 commit。**靜默失敗且反饋是錯的。**

→ 報告必須明講兩件事：(a) 要跑哪一行 `git rm -r --cached ...`，(b) 跑完之後**既有歷史仍然含有那些檔案**。

### 附帶（需一併決定範圍）

- 決定寫進 `.current/.config.json`（例如 `"artifacts": "local"`）→ `.config.json` schema 1 → 2，
  走 `docs/schema-versions.md`。
- 同一套偵測邏輯放進 `agc check`：config 寫 `local` 但 `.current/` 實際 tracked → 報漂移。
  裝機時決定一次，之後長期有人守。

### 先例

E100／E101 同形狀：`agc init` 寫 key + `test/agc-adapters.test.mjs` 的 qa-owned assertion，mini-chain 一輪。

---

## H9 — 給人讀的產物一律通用（可保留性的前提）

**提出者**：human, 2026-09-14（由 H4 退場討論反推上游）
**狀態**：✅ **done 2026-09-28** —— E107 併入 E231 出貨（constitution §6 *Generic citation*，merge `f95e4ae`）

### 論點

H4 原本問「退場時要刪什麼」，human 反推一層：**如果產物本來就人人看得懂，保留才真正有價值。**
與 H8（裝機時決定，別事後清理）、H6（一開始就別寫票號，別回溯改 2541 處）同一個模式 ——
**上游決定永遠比下游清理便宜。**

### 規則（這是要寫進 SOP 的措辭）

> **凡是給人讀的文字，一律假設讀者不使用 agc**：不用治理術語（round／gate／`tw_*`／PASS-FAIL 流程）、
> 不引用票號、不引用未 tracked 的路徑。
> **機器欄位、檔名慣例、狀態值不在此列** —— 那是協定，由 server 驗證。

| | 例子 | 為什麼 |
|---|---|---|
| 散文 → **一律通用** | spec 的行為描述與 AC、review／QA 的結論、`design/` 的表格、程式碼註解、commit message | 寫給人看的，通用化零損失 |
| 協定 → **不動** | `handoff.md` 的 YAML 欄位（`next_role`、`review_verdict`、`hop_count`）、`qa_reports/review_<id>.md` 檔名慣例、`tasks.md` checkbox 格式、`telemetry.jsonl` | server 用 enum 驗證、用檔名判斷證據存在。改名不是變好懂，是**協定壞掉** |

**界線是必要的，不是潔癖**：若規則寫成「所有產物都要讓人看懂」，agent 會把 `handoff.md` 的
`pending_notes` 寫成長篇解釋 —— 正好撞上 **E92（欄位靜默截斷）** 與 **E86（欄位吸收壞工具呼叫殘文）**。
用可讀性的名義膨脹機器欄位，是製造缺陷。

規則的自適應性與 H6 規則 A 相同：不必逐檔判斷「這個要不要通用」，只需判斷「這段是散文還是協定」。

### 連鎖效果（這是 H9 最大的價值，不只是退場變乾淨）

> 產出通用 → 可 tracked → 註解可引用（H6 規則 A）→ why 有去處 → 退場只清治理證據

`specs/` 一旦通用，H5+H6 那個「rationale 從 repo 消失」的問題就不必勉強塞進 commit message，
`specs/` 本身就是那個家。

### 範圍：原則普遍適用，投資不普遍

`qa_reports/` 寫得再通用，不用 agc 的同事也不會去讀「第 2 輪為何 CHANGES_REQUESTED」。
通用化的力氣集中在 **`design/` + `specs/`**（退場後唯一有保留價值的兩個），
其餘順手做到即可，**不值得為它們加規則或加檢查**。

### 落點

`content/skill-pm.md`（spec 產出標準）＋ `content/skill-design-auditor.md`。
與 H6／H7 同源（都是「寫給誰看」的問題），可考慮同一張票。

### 未量測

本 repo 的 `specs/` 治理術語密度很高（`qa-flow-enforcement-architecture.md` 344 處），
但**不能當樣本** —— 這個 repo 的 spec 主題本來就是治理。真實落差要看 NDI 的 `specs/`，尚未量。

---

## 未歸類 / 待補
（human 後續心得續填於此）

---

## 續接資訊（2026-09-11 補記，coordinator 復原）

2026-09-08 的討論 session 因 terminal 關閉而中斷。本節記錄復原座標，避免再次失聯。

### 原始對話紀錄
- **transcript**：`<claude-config-dir>/projects/<本 repo 路徑的連字號編碼>/70f48f94-726b-4d28-aa27-71810535e83d.jsonl`（某個個人 config 目錄下的 session 目錄）
- 範圍 `2026-09-08T06:14:58Z → 2026-09-08T11:04:55Z`（本地 14:14 → 19:04），392 筆，human 發話 12 次。
- 該 session 跑在某個個人 config 目錄下；從別的 config 目錄執行 `claude --resume` **看不到它**。接回方式：
  ```bash
  CLAUDE_CONFIG_DIR=<claude-config-dir> claude --resume 70f48f94-726b-4d28-aa27-71810535e83d
  ```
- 本檔內容已涵蓋該 session 的全部結論；transcript 僅供追溯逐輪推導過程。

### 中斷點（尚未回答）
coordinator 最後丟出的問題，human 未及回覆：

> 要先開票，還是先把 E73 拆成「untrack 半邊（今天可用）」＋「lifecycle 半邊」？

**2026-09-14 已答**：拆。untrack 半邊的設計已在 **H8** 收斂完畢（四項決定齊備），可獨立開票；
lifecycle 半邊留在 E73 本體。

### 懸而未決的確認事項總表
彙整本檔三處「待與 human 確認」，供下次接續時逐條結清：

| # | 出處 | 待決事項 | coordinator 立場 |
|---|---|---|---|
| 1 | H1 | 「都要開 worktree」是否含 read-only lane（forensics／doc／lite／Q&A）？ | 採 E73 constraint (1) 的窄觸發，不採字面上的「都要」 |
| 2 | H1 | E73 的 (a) untrack 半邊是否切出成獨立小票先做？ | **已決 2026-09-14：切出，設計見 H8**。副作用（本 repo 不再累積 handoff 版本史）**不發生** —— 本 repo 選 `repo` 模式 |
| 3 | H2 | seed→fan-out→join 樣板寫進 `skill-pm.md` 還是只寫進 coordinator 的 Feature-Scope Gate？ | `skill-pm.md`——per-AC `proof:` 稽核是 PM 的動作 |
| 4 | H2 | (b) 錨點分裂「明示為設計」還是「當缺陷修」？ | 明示為設計 |
| 5 | H2 | (d) 是否獨立開票 | 未定 |
| 6 | H2-b | symlink 證據 harvest 是否立刻獨立開票？ | 是，且優先於 E73 本體（投報率最高，零 server 成本） |
| 7 | H2-b | `cut_approved` 繼承語意需要 handoff schema 升版，是否接受？ | 需 human 決定 |
| 8 | H2-b | join 前置的 git ancestor 檢查做成 gate 還是 SOP 自檢步驟？ | 未定 |
| 9 | H3 | 差距在 (i) 現況已足你只是不知道／(ii) 要獨立於 AC 的 QA 清單／(iii) PM 端 AC 品質不足？ | 待 human 指認 |
| 10 | H5+H6 | rationale 的落點：`design/` tracked／commit message／註解只寫不變式 | 1 ＋ 3 併用 |
| 11 | H6 | 票號／AC 編號規則是否套用到本 repo | ~~已決 2026-09-14：本 repo 豁免~~ → **2026-09-28 人類撤銷**：repo 將轉 public，讀者不再都是 agc 使用者；既有票號註解的改寫是 E233 |
| 12 | H4 | `agc eject` 是否預設 dry-run、`--yes` 才執行 | **已決 2026-09-14：是**。`local` 模式下產物不在版控，誤刪無 git 可救 —— H8 的預設反而讓 eject 更危險。不做互動確認（同 H8 決定 1） |
| 13 | H8 | 決定是否寫進 `.current/.config.json`（`"artifacts"` key，schema 1→2） | **已決 2026-09-14：存**。exclude 檔記錄「狀態」、key 記錄「意圖」，兩者比對才驗得出漂移（config 說 local 但 `.current/` 實際 tracked → 報）。不存則分不清「刻意選 repo」與「沒跑過新版 init」。**absence === 未宣告**（不是 local），沿用 schema-versions.md 的 stamp-only／seeds-nothing 模板（8 次先例） |
| 14 | H9 | H6／H7／H9 是否合為同一張票（都是「寫給誰看」） | **已決 2026-09-14：合一張**。同一條原則分三張會在三個 SOP 各重述一次，正是 A8／憲法「skills MUST NOT restate」要防的；原則寫憲法或 `partial-*.md` 一次，三個角色 SOP 引用。落點不同檔案不是分票理由（E61+E62+E70 先例：一張票動四個 prose 檔） |
| 15 | H1 (2026-09-15) | worktree-by-default 的**適用範圍**：只有 agc 自身，還是所有 adopter 專案？ | **agc 自身先做，adopter 等實績**。兩者 repo 形狀不同（adopter 的 `.current/` 與證據目錄多為 gitignored、不一定有 PR 流程），對單人小專案每票一 worktree 是淨成本 |
| 16 | H1 (2026-09-15) | 半途作廢的 lane（票被 void／被取代）如何收尾？它的 pending 新票與證據永遠不會被 apply | 未定 —— E124 的 cut 必須在呈現時就決定（丟棄／強制 apply／要求走一次 release-engineer），不可留給 sr-engineer。`tw_void_task`（E117）相鄰可接 |
| 17 | H1 (2026-09-15) | E127（shell cwd 穿透 worktree 隔離）目前無便宜解法，是否阻擋 capstone？ | **是，必須先有處置**。worktree-by-default 把暴露面乘上 lane 數；且無 gate 看得到（33 條全在驗狀態寫入，無一觀察 `workspace_path` 外的檔案系統寫入） |
| 18 | H1 (2026-09-15) | 是否開出 capstone 票（翻開關本身：改 `coord-03` 措辭 + `agc init` lane bootstrap + 宣告範圍） | **已決 2026-09-15：開，E130，order `13r`**，`depends_on: E123, E124, E125, E126, E110, E115, E116`，且 E127 須先處置。範圍決定（#15）明列為 cut 呈現時必須結清的項目，不下放給 sr-engineer |

### 本檔位置變更
原位於 `.current/agc-feedback-2026-09-08.md`（untracked，一次 `git clean -fd` 即遺失）。
2026-09-11 移入 `docs/` 並納入版控。選 `docs/` 而非留在 `.current/`：H5／E73 (a) 一旦執行，
`.current/` 會整個 untrack，留在原處等同排定了第二次遺失。
