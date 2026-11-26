# Fan-out: post-v5.0.0 第 3 波（E430，加上 E449）
base: ca6dade    integration branch: integ/post-v5-w3
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-26。** e430 `--no-ff` 合進 `integ/post-v5-w3`（merge `6ca6de9`，零衝突），merge-invariants PASS；派工 base `f08ea57`（清單 PR #197）；merge 後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、`check:bookkeeping` exit 0。lane 層 CI run 45759043059 @ `c0e9c73` 綠（Node 20、22）。Roll-up：e430 8 個 task、hop 10/14、review 退回 0、證據 8/8；收工後依人類裁定在 lane 內修一個本票造成的缺口（修訂 2，idle-stop 恢復路徑）。E430、E449 done-mark。本波以一個 PR 合進 `main`，不發版。

範圍由人類指定（integrator prompt「fan-out 下一波」，2026-11-26；整合者提三題，人類答「照建議」）：一條 lane 做 E430 與 E449，一次 cut。票面以 `docs/backlog.md` 的 E430、E449 列為準（E430 含 2026-11-19 的里程碑註記）；佇列 `docs/v4.0.0-new-tickets.md` 第 251、260 號列。E430 屬 v5.0.0 里程碑、依排定順序在 v5.0.0 之後以 v5.x 發出；E449 不屬里程碑，人類 2026-11-24 裁定以 v5.x 發出。本波不發版。

## 派工前核對（整合者，2026-11-26，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `ca6dade`（PR #196 合併後），工作樹乾淨；`feat/e430-*`、`integ/post-v5-w3` 都不存在；`../agent-governance-mcp-lanes/_mailbox/` 是空的。primary handoff 停在 `release-cd-v5.0.0-r2`；drift 檢查沒有偏差（T-REL4-02、T-E421-01、T-E421-02、T-RELCD8-01..03 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{ "manifest": true }`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）。
- `dist/` 實測：`GATE_REGISTRY` 33、`UPDATE_STATE_GATE_PIPELINE` 17 步。
- 兩張票都不改 `.ts`（E430 票面「prose and docs only」；E449 只改 `content/const-15-core-tail.md`），所以 `dist/**` 列為禁止。

### 為什麼只開一條 lane
剩下的 v5.x 票（E430、E426、E428、E443、E420、E449）都改 `content/**`，共用生成物一波只能歸一條 lane；E443 另外與 E430 同改 `content/skill-integrator.md`、`docs/lane-protocol.md`。E449 若單獨做，只為 golden 就要再開一波，所以併進本 lane（人類 2026-11-26 選 (a)）。

### 檔案面（在 `ca6dade` 核對）
- **E430**：`content/skill-integrator.md`（251 行；Stage 3 第 100 行起只為 lane 建信箱並掛監看；Stage 4 第 125 行「Mailbox unavailable → fall back to the human relaying text」；Take-over 第 233 行起，第 240 行 step 4 的重掛監看是一句話，不是核對項）；`docs/lane-protocol.md`（154 行；§5 信箱第 88 行起，只寫 lane ↔ 整合者，第 91 行「信箱在 `agc feature finish` 拆除 lane 時才會刪除」——非 lane session 沒有 finish）。票面「Out of scope unless the cut decides otherwise」：fan-out 工具的非 lane prompt 範本、任何 server 或 gate 變動——本清單不劃 `scripts/**`、`tools/**`，cut 若要做需先送預審、由人類裁定是否擴範圍。
- **E449**：`content/const-15-core-tail.md`（55 行；§7 在第 37 行，*Read before write* 第 42 行、*Fail loud* 第 43 行）。`prompts/constitution-manifest.ts` 第 33 行把它標為 `core`，所以每個派工模式都會帶到。
- **共用生成物**：11 個 compose golden 含 §7 *Fail loud*（`build-{full,lite}-{design,nondesign}{,-fd}.txt`、`constitution-monolith.txt`、`hook-full.txt`、`hook-lite.txt`），E449 會全部動到；integrator SOP 不在任何 compose golden 內。`test/context-budget.test.mjs` 的 lite 憲法上限目前零餘裕（第 204 行註解：measured 6003）。

### 讀這些檔文字的測試（literal 搜尋，沒跑）
| 被讀的檔 | 讀它的測試檔數 |
|---|---|
| `content/skill-integrator.md` | 38 |
| `docs/lane-protocol.md` | 42 |
| `content/const-15-core-tail.md` | 12 |

本波只有一條 lane，這些讀者測試裡因本 lane 而紅的全歸 e430；完整清單由 PM probe 用完整套件列出。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 | approval |
|---|---|---|---|---|---|---|---|---|
| e430 | E430、E449 | feat/e430-mailbox-and-verify-rule | ../agent-governance-mcp-lanes/e430 | `content/skill-integrator.md`、`docs/lane-protocol.md`、`content/const-15-core-tail.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e430-*.test.mjs`（新，qa 定名）、`test/e449-*.test.mjs`（新，qa 定名）、`test/fixtures/` 下本 lane 新增的 fixture、其他只因本 lane 而紅的測試（PM probe 逐檔列出，整合者預審確認）、`specs/e430-*.md`、`.current/e430/**`、`qa_reports/`、`review_reports/` | 其他 `content/**`；其他 `docs/**`（含 `docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol-addendum.md`）；`specs/fanout-*.md`；`scripts/**`、`.github/**`；`dist/**` 與所有 `.ts` 原始碼（`tools/**`、`gates/**`、`schema/**`、`guards/**`、`prompts/**`、`templates/**`、`bin/**`、`lib/**`、`transport/**`、`index.ts`）；`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`CONTRIBUTING.md`、`package.json`、`package-lock.json` | 做：E430 (1) integrator SOP——WHEN 整合者把 prompt 交給任何會回報給它的 session（lane 或非 lane，例如實機驗收、對照實驗）→ DO 交出 prompt 前建該 session 的信箱對並加入監看 → ELSE（信箱不可用）由人類轉達，並在 Decisions 表記一列；(2) `docs/lane-protocol.md` §5 寫明哪些信箱規則適用於非 lane session（訊息是資料、永不傳核准；回報格式），以及沒有 `agc feature finish` 時誰刪它的信箱；(3) Take-over 的重掛信箱監看改成核對項，不再只是一句話；cut 註記：同一帳號下宿主的 session 清單與直接傳訊可達同機器的其他 session，檔案信箱仍是可攜的機制。E449：`content/const-15-core-tail.md` §7 加一條「先查證再斷言」——說明工具、指令、腳本或流程怎麼運作，或把指令寫進計畫與完成定義，要以讀過的檔或跑過的指令為據，否則標明未查證；每個派工模式組出的憲法裡 §7 下恰好出現一次；通過 content 全域的用字與引用 pin（無 repo 專屬路徑、無裸票號、不重述數值上限）。最終用字、以及要不要有角色 SOP 指向這條，cut 標 needs human ruling。golden 與預算以本 lane 為準。不做：fan-out 工具的非 lane prompt 範本；任何 server、gate、錯誤碼、`GATE_REGISTRY`（33）與 pipeline（17 步）變動；E443 的啟動器與 `content/coord-03-core-fallback.md` 那一行；E426、E428 的 SOP 文字 | 無 | human |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **E449 併進 e430（人類 2026-11-26 選 (a)）**：`content/**` 一波只能歸一條 lane；E449 的佇列備註「與其他 content 票撞共用生成物，不能同波」指的是分兩條 lane 同波，同一條 lane 不受影響。兩張票共用一個 feature 的 `hop` 上限。
- **共用生成物整組歸 e430**：本波唯一一條 lane。
- **`dist/**` 禁止**：本 lane 不改 `.ts`；若 cut 判斷需要改，先送預審。
- **常設規則：無主紅檔直接劃給該 lane（沿用人類 2026-11-25 在 `specs/fanout-pre-v5-w2.md` 採用的規則）**：只因本 lane 改動而紅、且不在任何擁有欄的測試檔，整合者在 cut 預審時核對（base 上綠、本 lane 改動下紅）後直接劃給 e430，記一列 Decisions（裁決者 `整合者`），不問人類。

### 交給 lane 的 PM（寫進 cut）
- **走法**：v5 鏈——qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（或 `qa_reports/no-new-test_<feature>.txt`）；sr-engineer 照測試實作、不改 qa 寫的測試；code-reviewer 裁判、寫 PASS、`tw_complete_task`。`tw_update_state` 沒有 `chain_path` 欄位，不要設。
- **不走 architect**：沒有 gate 或 pipeline 變動。Lanes 表 `approval` = `human`：本 lane 改憲法 §7 與 integrator 自己的規則，cut 先經整合者預審收斂，再由 lane 在自己的 session 呈人類核准（含 E449 用字、是否加 SOP 指標兩題）。
- **一個 feature、一次 cut**：E430 與 E449 寫在同一份 `specs/e430-*.md`，task id 分票標明；兩張票共用 `hop` 上限，cut 先估 hop 數。
- **只有實作完才擷取得到的快照**（golden 與預算上限）：照第 5、6 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後計畫性退回 qa 一次（用掉 1 次 `sr_return`），qa 重擷取 golden、預算調到實測值並逐 hunk 說明，再經 sr 交給 code-reviewer。
- PM probe 用完整套件試跑（`node scripts/test-lock.mjs -- npm test`），cut 逐檔列出紅的測試，標明是上表讀者還是新發現的；不在擁有欄的紅檔 → 預審時列給整合者。
- 新的 SOP、協定與憲法文字寫進 cut 的 Copy / Strings。`content/**` 隨套件發給每個 adopter：不得引用只在本 repo 存在的路徑或裸票號。
- cut 預審的信件 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e430`）。
- 每個 AC 都要有實作 task，不只 qa task；每個 sr task 在 `task_size` 預算內。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| integrator SOP：交 prompt 給任何會回報的 session 前先建信箱對並加入監看；信箱不可用時人類轉達並記 Decisions 列 | e430（E430） | ✓ |
| `docs/lane-protocol.md` §5：非 lane session 適用的信箱規則與其信箱由誰刪除 | e430（E430） | ✓ |
| Take-over 的重掛信箱監看是核對項 | e430（E430） | ✓ |
| 每個派工模式組出的憲法 §7 下恰好一條「先查證再斷言」，通過 content 用字與引用 pin | e430（E449） | ✓ |
| golden 與預算重擷取並逐 hunk 說明 | e430 | ✓ |
| 合併後 `npm run build` 無 `dist/` 差異、`npm audit --audit-level=high` exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17、全套 CI 綠 | 整合者（5b） | ✓ |
| E430、E449 done-mark（not yet released）；佇列第 251、260 號列；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（6） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 確認 `dist/` 無差異；本 lane 不改 `.ts`，不需重啟 primary 的 MCP server。
- 記帳：見完成定義；`npm run check:bookkeeping` 直接跑、exit 0。
- 沒有接線票。不發版。

## 合併順序
1. `integ/post-v5-w3` 自當時的 `main` 開。
2. ← `--no-ff` e430 → merge-invariants。
3. `npm run build`、golden、預算、`check:bookkeeping`、audit；記帳 commit。
4. `finish e430`（`--shipped --base integ/post-v5-w3`）；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/post-v5-w3`。不發版。

## Dispatch pins
- e430：`pm=opus`、`qa-engineer=opus`、`sr-engineer=opus`、`code-reviewer=opus`（人類 2026-11-26 核准）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-26 | 人類 | 第 3 波範圍：一條 lane 做 E430 與 E449、一次 cut（Q1 (a)）；`approval` = `human`（Q2）；pm／qa-engineer／sr-engineer／code-reviewer 全部 pin opus（Q3） | 整合者 session（integrator prompt「fan-out 下一波」；三題答「照建議」） |
| 2026-11-26 | 整合者 | Stage 1：一條 lane e430（E430 + E449），因剩下的 v5.x 票都改 `content/**`、一波只能一條 lane 擁有共用生成物；不走 architect；不改 `.ts`，`dist/**` 禁止；E443、E426、E428、E420 留待後續波次（E420 另需設計稿 adopter 在新流程結案一個 feature） | 本檔 |
| 2026-11-26 | 人類 | 核准本清單：一條 lane e430（E430 + E449）、E449 併入、共用生成物歸 e430、`dist/**` 與 `scripts/**` 禁止、沿用無主紅檔常設規則、`approval` = `human`、四個角色 pin opus，其餘照清單 | 整合者 session（「核准」） |
| 2026-11-26 | 整合者 | 清單 PR #197 合進 `main`（merge `f08ea57`，CI run 45742806846 綠），派工 base = `f08ea57`；派工前核對在該 sha 重做通過（`agc check` exit 0、只有 primary worktree、`feat/e430-*` 與 `integ/post-v5-w3` 都不存在、擁有欄點名的既有路徑都在、`cutApprovalAutoTier.manifest` 為 true、`validate` exit 0）；建 `_mailbox/e430/`、開信箱監看（baseline 0）與 lane-status 監看、render prompt（信箱用絕對路徑） | 本檔 |
| 2026-11-26 | 整合者 | e430 cut 預審（to-integrator#1，spec @ `961cf55`）回 `reply`（to-lane#2）：範圍、檔案界線、完成定義對照相符，每個 AC 有實作 task；要求 R1：C-IN2 與 Stage 4 Watch 子項「Watch the mailboxes of your own manifest's lanes only」衝突，新增一個 string id 改寫該句並併入 AC1。Q1 (a)、Q2 (a)、Q3 每個非 lane session 記一列 Decisions——同意 PM 建議（needs human ruling，由 lane 呈人類） | e430 信箱 to-integrator#1、to-lane#2 |
| 2026-11-26 | 整合者 | 無主紅檔劃歸（常設規則）：`test/e410-task-alias-content-tail.test.mjs` 劃給 e430——base `f08ea57` 上 6/6 綠；以行號 pin `content/skill-integrator.md` 第 179、183、251 行與總行數 252，C-IN2、C-IN3 會讓它們位移（PM probe 套用草稿後 2 紅），不在任何擁有欄；qa 在 T-E449-03 只改行號與行數 | e430 信箱 to-integrator#1、to-lane#2；整合者在 base 跑該檔 |
| 2026-11-26 | 整合者 | e430 修訂 cut（to-integrator#2，spec @ `573eb12`：新增 C-IN4 原地改寫 Watch 子項、AC1 涵蓋、T-E430-02 涵蓋）`close`（to-lane#3）；`check --cut` exit 1 只有已劃歸的 e410 與 `APPROVAL_HUMAN`；approval = human，由人類在 lane 的 session 核准 cut 並裁定 Q1–Q3 | e430 信箱 to-integrator#2、to-lane#3 |
| 2026-11-26 | 人類 | 在 e430 的 session 核准 cut（spec @ `573eb12`）並裁定 Q1 = (a)（§7 新條照 backlog 草稿原文）、Q2 = (a)（不加角色 SOP 指標）、Q3 同意（E430 用字照草稿，每個非 lane session 記一列 Decisions）；三題都寫在已核准的 spec 裡，只影響本 lane 的交付內容 | e430 lane session；`specs/e430-mailbox-and-verify-rule.md` 「Human ruling」段 @ `460f8f4`、`.current/e430/handoff.md`（`cut_approved: true`）；e430 信箱 to-integrator#3 |
| 2026-11-26 | 整合者 | e430 收工報告（to-integrator#7，HEAD `9516b1a`）核對：9 commits、乾淨樹、`check` 31 檔越界只有已劃歸的 e410、無 `dist/`／`scripts/` 變動、證據 6/6（`review_reports/review_T-E430-01.md` covers 六個 id、APPROVED）、無新發現。回 `reply`（to-lane#4）：review recommended (1) `mailbox-watch.mjs --send` 對非 integrator 要求 hop 值、與 C-LP1 的 `hop: —` 不合——工具核對屬實，但協定訊息可手寫、不會讓 session 出錯，列波次報告不開票；(2) Stage 4 Two-hour idle stop 在同一 session 恢復時只從 handoff 的 lane baseline 重掛、會漏掉非 lane session——本票新規則造成的缺口，建議 merge 前在 lane 修（needs human ruling，由 lane 呈人類），估 hop 到 10/14 | e430 信箱 to-integrator#7、to-lane#4 |
| 2026-11-26 | 整合者 | e430 cut 修訂 2（to-integrator#9，spec @ `a4f0348`：C-IN5、AC8、T-E430-04 qa、T-E430-05 sr）`close`（to-lane#5）：接受 C-IN5 以獨立句放在 Resuming 句之前，而非句內子句——`test/e285-integrator-session-handoff.test.mjs` AC-E344-1 逐字 pin 該句且要求它是子項最後一句，獨立句版不必動不在擁有欄的 e285；只重述 C-IN3 (a)(b)；不增行、golden 與預算不動。Q4 建議 (a) | e430 信箱 to-integrator#9、to-lane#5 |
| 2026-11-26 | 人類 | 在 e430 的 session 選 (a)：merge 前在本 lane 修 idle-stop 恢復路徑的缺口（不另開票）；核准修訂 2 cut（spec @ `a4f0348`）並裁定 Q4 = (a)（C-IN5 獨立句、以接手第 5 步 (b) 編號指引）；只影響本 lane 的交付內容 | e430 lane session；`specs/e430-mailbox-and-verify-rule.md` 「Revision 2」段 @ `f108c19`、`.current/e430/handoff.md`（`cut_approved: true`）；e430 信箱 to-integrator#8、#10 |
| 2026-11-26 | 整合者 | e430 修訂後報告（to-integrator#12，取代 #7，HEAD `c0e9c73`）驗證通過：14 commits、乾淨樹、`check` 34 檔越界只有已劃歸的 e410；證據 8/8（`review_reports/review_T-E430-01.md` covers 六個 id、`review_reports/review_T-E430-04.md` covers T-E430-04、05，皆 APPROVED；`qa_reports/review_T-<id>.md` ×8）；無新發現；lane 層 CI run 45759043059 @ `c0e9c73` 綠（Node 20、22）；review 退回 0、hop 10/14；`close`（to-lane#6）。波次報告不開票的意見：(1) `mailbox-watch.mjs --send` 對非 integrator 要求 hop 值、非 lane session 只能手寫；(2) C-IN5 的「Whichever way it resumes」在點名兩種恢復方式那句之前；(3) session 信箱以讀完後的則數掛、緊接的 lane 句寫「never the current count」 | e430 信箱 to-integrator#12、to-lane#6 |
| 2026-11-26 | 整合者 | 整合：`integ/post-v5-w3` 自 `main` @ `f08ea57` 開出，`--no-ff` 合 e430（merge `6ca6de9`），零衝突、無實質解衝突，merge-invariants PASS；build 無 `dist/` 差異、audit exit 0、`agc check` exit 0、`GATE_REGISTRY` 33／pipeline 17；`check:bookkeeping` exit 0；E430、E449 done-mark；`agc feature finish e430 --shipped --base integ/post-v5-w3` 無新發現可配號，worktree、branch、信箱已拆除 | 本清單；`docs/backlog.md`、`docs/v4.0.0-new-tickets.md` |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ f08ea57
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v5-w3 @ 74d40d3）
- lane-status：primary（main ← integ/post-v5-w3 @ 74d40d3）release-cd-v5.0.0-r2／In_Progress／release-engineer，hop 5，commits 0，clean
### 已結案
- e430（E430、E449）PASS，merge `6ca6de9`，以本波 PR 合進 `main`；lane 紀錄在 `.current/history/2026-11/e430/`；沒有未配號的新發現。波次報告不開票的意見三則記在 Decisions 表。
### 待人類決定
- 要不要發 v5.x：E424、E425、E427、E430、E449 都已完成，合進 `main` 後尚未發版。
- 下一波要不要開、開哪些票，由人類決定；佇列上還沒做的 v5.x 票見 `docs/v4.0.0-new-tickets.md`。
### 進行中的背景工作
無
