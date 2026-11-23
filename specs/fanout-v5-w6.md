# Fan-out: v5.0.0 里程碑第 6 波（E445）
base: 69714ba    integration branch: integ/v5-w6
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-23。** e445 已合併進 `integ/v5-w6`（merge `059eced`，零衝突、無實質解衝突）、finish、拆除；派工 base `b3ac374`（清單 PR #170 merge），integ 自 `main` @ `b3ac374` 開出；merge 後 build 無 `dist/` 差異、audit 通過、`agc check` exit 0、`CLAUDE.md` 250 行；本波以一個 PR 合進 `main`，不發版（16.1 裁定 18）。lane 層 CI：run 45188303866 @ `bdc38ce` 綠（Node 20、22）。Roll-up：e445 tickets 4、hop 6/14、review 退回 0、qa 退回 0、sr 退回 1/2（R3 (b) 計畫性退回，重量 AC21）；證據 4/4。預算（~tok）：skill-spec-workshop stripped 1092→1415（+323），其他上限與 12 個 golden 不變。波中人類裁定見 Decisions（清單核准含 R3 (b) 與 pins、cut 在 lane session 核准、hop 上限續跑指示）。

範圍由人類指定（integrator prompt「fan-out v5.0.0 里程碑的下一波（第 6 波）」，2026-11-23）：下一張是 E445，並依 `docs/backlog.md` 的相依找出剩下的票裡能與它同時跑的；另看 E447 的相依與佇列位置。順序依 `docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 17.1 裁定 4 修訂後的版本（E422 → E423 → E419 → E431 → E432 → E433 → E434 → E445 → E435 → 其餘照 16.1 裁定 17）。依 16.1 裁定 18，合進 `main` 但不發版，與 E435 一起發 v5.0.0。

## 派工前核對（整合者，2026-11-23，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `69714ba`（PR #169 merge，第 5 波）、工作樹乾淨；沒有 open 的 pull request；`feat/e445-*`、`integ/v5-w6` 都不存在；`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。primary handoff 停在 `release-cd-v4.22.0`（schema 16），drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（manifest tier 未開 → cut 在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`（共用生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）、`artifacts` = `repo`。
- **第 5 波交接**：`node scripts/fanout.mjs handoff --check specs/fanout-v5-w5.md` exit 0，只有三個 `MOVED`（目標分支 `0d2a1ce` → `69714ba`、worktree、primary `lane-status`，都是 PR #169 合併後的預期結果），零 `DIFF`。
- **本 session 的 MCP server 跑第 5 波合併後的程式**：本 session 的 server 行程啟動於 2026-11-23 18:48，晚於 `dist/index.js` 的建置時間（同日 18:30）與 `69714ba` 的 commit 時間（同日 18:40）；`tw_get_state` 讀 schema 16 的 handoff 沒有報「newer server」錯誤；`schema/versions.ts` handoff = 16。服務出去的規則是新鏈（qa-engineer 寫測試 → sr-engineer 實作 → code-reviewer 裁判並寫 PASS；設計 feature 由 code-reviewer 載入 `reviewer-visual`）。
- **相依（`docs/backlog.md` depends_on 欄，2026-11-23 讀）**：剩下 10 張里程碑票中，相依全部已 DONE 的只有 E445（←E423 ✓）。其餘：E435←E434 ✓，但 17.1 裁定 4 排在 E445 之後，且它要切 v5.0.0、發版驗證涵蓋 E445；E424←E422、E435；E425←E422、E424、E435；E430←E425；E426←E422、E435；E427←E424；E428←E422、E423、E425；E443←E422、E425；E420←E419、E434（相依已滿足，但 16.1 裁定 17 排最後、在 E443 之後，計數釘點要用 E435 之後的 registry 數量，且票面要等新鏈上有 design-armed feature 結案後重新量測）。
- **沒有票能與 E445 並行**：（1）E435 依順序在 E445 之後；它也要改大量 `content/**` 與 `test/context-budget.test.mjs`，與 E445 共用生成物。（2）E420 依順序排最後，同樣動 `content/**`、golden 與預算。（3）其餘票都等 E435。結論：本波只有 e445 一條 lane；共用生成物（只限下表列出的檔）歸 e445。
- **E447（第 5 波後新開，PR #168）**：backlog depends_on 欄寫「none (ordered after E435)」；票面 Ordering 段與佇列檔第 258 號列寫「排在 v5.0.0 里程碑之後」且「排在 E446 之後」。里程碑含以 v5.x 發出的 E424–E420，所以佇列位置實際是 E420、E446 之後，比 depends_on 欄的「after E435」晚。兩處寫法不一致（只影響排序說明，不影響本波）；它要改 `content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md` 與 `test/context-budget.test.mjs`，與 E445 共用生成物，無論如何不能進本波。E446（相依無）同樣排在里程碑之後，改 `content/skill-doc-writer.md`，也撞共用生成物。
- **E445 的程式面**：只改 `content/skill-spec-workshop.md`（40 行）的 SOP 文字，八點折進既有六步（步驟標題與數量不變），外加測試。不新增 `tools/*.ts`（不加 `CLAUDE.md` Layout 列，`CLAUDE.md` 仍 250 行、不動）、不升 handoff／SQLite／config schema、`GATE_REGISTRY` 仍 35 條、pipeline 仍 17 步、`prompts/constitution-manifest.ts` 15 個片段不動、`content/*.md` 不新增或不再引用任何錯誤碼（`documentedInProse` 與 `(none)` 個數 1 不動）。`content/` 不編進 `dist/`，build 後 `dist/` 應無差異。
- **compose golden**：12 個 golden 都不收這份 SOP（`skill-coordinator-monolith.txt` 第 76、78 行只引用「start the `spec-workshop` prompt」這句，出自 coord 片段，不是本 SOP），不歸本 lane。
- **E445 不在佇列檔**：`docs/v4.0.0-new-tickets.md` 沒有 E445 列（第 247 號 E434、第 248 號 E435）；結案記帳時插在兩列之間、補第 `247a` 號列（佇列已有 `0a`、`0b` 這類字尾列號；`check:bookkeeping` 只檢查 `票` 欄的票號，結案時實跑確認）。遠端分支 `origin/docs/2026-11-20-file-e445` 已合併、未刪，列進待人類決定。

### 讀原始碼文字的測試（literal 與 regex 寫法一起搜：`skill-spec-workshop|spec-workshop|spec_workshop|specWorkshop`、`readdirSync` 掃整個 `content/` 的測試；本波只有一條 lane，下列全部歸 e445 或在 e445 的觀察範圍）
測試檔名省略 `test/` 與 `.test.mjs`：

| 被讀的檔 | 讀它的測試 | 檢查什麼 | 本票會不會打紅 |
|---|---|---|---|
| `content/skill-spec-workshop.md` | `context-budget` AC21（第 500–513 行） | stripped SOP ≤ 1092 ~tok（chars/4），零餘裕 | **會紅**（票面已知）；上限調到實測值 |
| `content/skill-spec-workshop.md`（`SOP`）與組合後 prompt（`SW_BUNDLE`） | `e423-spec-workshop` AC6 | 組合後 prompt 含 `# Skill: spec-workshop`、`## Steps`、六個步驟標題（`1. **Entry check**` … `6. **End without filing**`）、`## Short form`；`## Steps` 到 `## Short form` 之間 `^\d\. \*\*` 恰好 6 個；含「The short form writes no wave table.」 | 不該紅：新增文字不得出現新的行首 `\d. **` |
| 同上 | `e423` AC7 | `tw_update_state` 等六個寫入工具名只出現在禁止句那一行；「This role is never dispatched as a subagent: …」原句 | 不該紅：新增文字不得提這六個工具名 |
| 同上 | `e423` AC8 | 步驟 1 的七個原句 | 不該紅 |
| 同上 | `e423` AC9 | `## Outputs` 段的表頭與原句；regex「Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces」 | 不該紅：步驟 4 的這句要原樣保留，第 (8) 點另寫一句 |
| 同上 | `e423` AC10 | 完成條件原句（「every scenario has one verification, …」等）、`` `not doing` ``、`` `not ready to cut` ``、`list the open questions`、`file nothing` | 不該紅：第 (6) 點加的「以 `not ready to cut` 結束」不改這些句子 |
| 同上（dispatch view：`stripRationale(stripOriginTags())`） | `e423` AC11 | 整份 SOP 不得命中 `specs/`、`research/`、`docs/discussion-`、`docs/backlog.md`、裸 `tools/*.ts` 或 `gates/*.ts`、裸 `scripts/*.mjs`、`\bE\d{3}\b` 等 | 不該紅：新增文字不得引用討論檔、票號或 repo-only 路徑 |
| `content/*.md` 全部 | `e410-task-alias-content-tail` | 不得用 `Task` 當子 agent 的代稱（允許的開頭字見第 17 行）；AC2 的行數／行號釘點只釘 const-01、const-05、const-08、const-12、skill-coordinator-lite、skill-integrator、skill-pm，不含本檔 | 不該紅：寫「subagent」不寫「Task」 |
| `content/*.md` 全部 | `e434-reviewer-visual`（第 689–695 行） | `gates/registry.ts` 對照註解每列 = 實際以反引號引用該錯誤碼的 content 檔 | 不該紅：新增文字不得以反引號引用任何錯誤碼 |
| `content/*.md` 全部 | `e440-current-rule-wording` AC-E440-1 | 不得含「pre-v3.20.0」「is REMOVED」「is retired」「no remaining routing convention」 | 不該紅 |
| `content/*.md`（除 rationale） | `e438-origin-fenced-labels` AC-E438-3 | 舊名稱不得出現 | 不該紅 |
| `content/{skill-,const-,coord-}*.md` | `render-structure` 結構掃描 | 不得有未登記的不對稱 rationale 區段 | 不該紅：若加 rationale fence 須成對 |
| `content/{const,coord,skill}-*.md` | `e43-test-file-ask-at-dispatch` | 不得含「MUST ask the user before creating」等舊句 | 不該紅 |
| `content/*.md` 與 `docs/backlog.md` | `e92-e86-handoff-write-boundary` 語料掃描 | 每個非空行都要能當 `qa_review` 值寫入 | 不該紅；結案記帳的 backlog 列同樣受檢 |
| `content/skill-*.md` 檔數 | `skill-frontmatter`（第 99–106 行） | 恰好 13 個 skill 檔 | 不該紅：不新增、不刪 skill 檔 |

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e445 | E445 | feat/e445-spec-workshop-questioning | ../agent-governance-mcp-lanes/e445 | `content/skill-spec-workshop.md`、`test/context-budget.test.mjs`、`test/e423-spec-workshop.test.mjs`、`test/e445-spec-workshop-questioning.test.mjs`、`specs/e445-*.md`、`.current/e445/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；其他所有 `content/**`、`test/fixtures/compose-golden/**`、`templates/**`、`prompts/**`、`schema/**`、`tools/**`、`gates/**`、`dist/**`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`CHANGELOG.md`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/ticket-format.md`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` | 做：票面八點（步驟 4：同批題目都可現在問且互不依賴、4 題上限保留、`Q<n> — <title>: <question>` 格式且建議與例子各自一行、「yes」即接受建議的措辭與例外、可用編號回答、答案顯示舊裁定該改時下一批重開且新裁定點名被取代者、`needs prototype` 標記與暫緩、本角色不做原型、仍未裁定則以 `not ready to cut` 結束；步驟 2：第一批前的簡短調查保留，更深的事實查詢以 subagent 與提問並行、只有依賴查詢的題目等待；步驟 3：程式碼、文件或工具答得出的事實不問人類，建議在人類回答前不算裁定；步驟 5：完成條件句不變，請求核准前若人類全部照建議接受，提醒一次並請人類確認裁定是自己的，確認即繼續）；AC21 上限調到實測值；情境測試。不做：完成條件（11.4 裁定 1、3）、4 題上限、Outputs／Short form／Governance state 段、任何工具／prompt／registry 程式、安裝外部 skill；`tracker` 鏡射（E428，之後改同檔）；E435 的拆舊路 | 無 |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共用生成物**：`content/**` 只限 `content/skill-spec-workshop.md`；`test/context-budget.test.mjs` 只限 AC21（第 500–513 行）一段，其他上限不動；`test/fixtures/compose-golden/**` 不歸本 lane（沒有 golden 收這份 SOP；若 PM probe 發現 golden 變了，代表改到別的檔，寄信給整合者）。本波沒有別的 lane。
- **`test/e423-spec-workshop.test.mjs`**：預先劃進，只限 AC6、AC9、AC10、AC11 四段，且只在 cut 經預審寫明需要時才改（整合者預期不改：這四段釘的是本票要保留的文字）。檔內其他測試不動。
- **新測試檔**：`test/e445-spec-workshop-questioning.test.mjs`（qa 若要用別的檔名，先寄信給整合者補列；`fanout.mjs check` 只認擁有欄列出的檔名）。
- **測試檔**：上表其他讀 `content/` 的測試預期 probe 綠、不列進擁有欄。PM probe 找到不在擁有欄的紅檔 → 預審時列給整合者，人類在整合者 session 核准後補進本欄並記 Decisions；lane session 不能自己決定。

### 交給 lane 的 PM（寫進 cut，隨 cut 在 lane session 呈人類核准）
- **實際走法（取代票面 intake 的舊鏈 mini-chain 順序 sr → code-reviewer → qa）**：pm 寫入設 `chain_path: "test-first"`；qa-engineer 先寫每個情境的測試與 `qa_reports/expected-red_<feature>.txt`（列出每個預期紅的測試與原因）；sr-engineer 照測試改 SOP、不改 qa 寫的測試；code-reviewer 裁判並寫 PASS、`tw_complete_task`。不走 architect（純 SOP 文字）。
- **只有實作完才擷取得到的快照（AC21 上限）**：新鏈上沒有規則處理（SOP 票待人類決定）。整合者建議照第 5 波人類裁定 R3 (b)：sr 做完最後一個實作 task 後，事先排好退回 qa 一次（用掉 1 次 `sr_return`，上限 2），qa 量測並把 AC21 調到實測值（零餘裕），再經 sr（確認無需實作）交給 code-reviewer。hop 預估：pm→qa、qa→sr、sr→qa、qa→sr、sr→code-reviewer，5 次轉移，在 `hop` 上限內。人類 2026-11-23 在整合者 session 裁定照 R3 (b)；cut 照此寫明，lane 不再問。
- **AC 措辭**：票面第一條驗收「Given the composed prompt, then the six step headings and the short form are present exactly as before」——cut 要寫明「exactly as before」指的是六個步驟標題與 `## Short form` 段的文字，不是整份組合後的 prompt 不變（整份 prompt 必然變）。凡寫「除了某段都不變」的 AC，都寫明指 SOP 段落。
- **保留文字**：步驟 4 的「Write each ruling to the record the moment it is made, with its date; a ruling that replaces an earlier one names the one it replaces.」原樣保留（`e423` AC9 regex）；第 (8) 點的重開另寫一句。步驟 5 的完成條件句原樣保留（`e423` AC10）。新增文字不得出現行首 `\d. **`（AC6 數到 6）、六個 `tw_*` 寫入工具名（AC7）、票號或 repo-only 路徑（AC11）、`Task` 代稱（`e410`）、反引號引用的錯誤碼（`e434` 對照）。
- **步驟對應**：票面把第 (3) 點放步驟 2（目前標題「Check what exists first」）、第 (5) 點放步驟 3（目前標題「Delegate bulk reading」），與現有標題相符，不改標題。
- PM probe 用完整測試套件試跑（`node scripts/test-lock.mjs -- npm test`），不只跑相關測試檔；cut 逐檔列出紅的測試，標明是上表已知的還是新發現的。
- qa 寫的測試若要讀 base 樹的原始碼來比對（例如「步驟標題與 Short form 與 base 相同」），在擷取當下就把內容讀進記憶體；Node 20 上暫存目錄事後再讀會 ENOENT（第 3 波 e432 AC12）。不能用 `git show` 讀 base 樹（T-E77-02 的 meta-test 會擋）。用 `git archive` 讀固定 sha 時，取不到 sha（歷史被壓縮）會靜默 skip，cut 要寫明這一點；能用凍結在測試裡的字串就不用讀 git。CI 跑 Node 20 與 22 兩版。
- cut 預審的信用 `type: proposal`，`re:` 一定要含 `cut`（例如 `re: cut e445`），`lane-status --mailbox-root` 才偵測得到。
- 一個 SOP 檔加測試，在單一 sr task 的 `task_size` 預算內；每個 AC 都要有實作 task，不只 qa task。
- `test/eval/` 不必跑（只改 SOP 措辭，不改路由）；cut 若要跑，寫明。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 步驟 4：同批題目都可現在問、互不依賴；4 題上限保留；`Q<n> — <title>: <question>` 格式，建議與例子各自一行；「yes」接受建議的措辭與例外；可用編號回答；舊裁定在下一批重開，新裁定點名被取代者；`needs prototype` 標記與暫緩、本角色不做原型、仍未裁定以 `not ready to cut` 結束 | e445（E445） | ✓ |
| 步驟 2：第一批前的調查保留；更深的查詢以 subagent 並行，只有依賴它的題目等待 | e445（E445） | ✓ |
| 步驟 3：程式碼、文件或工具答得出的事實不問人類；建議在人類回答前不算裁定 | e445（E445） | ✓ |
| 步驟 5：完成條件句不變；全部照建議接受時提醒一次、確認即繼續 | e445（E445） | ✓ |
| 六個步驟標題與 Short form 文字不變、`## Steps` 仍六步；SOP 不引用 repo-only 路徑或票號 | e445（E445） | ✓ |
| AC21 上限調到實測值（零餘裕）；其他預算上限與 12 個 golden 不變 | e445（qa） | ✓ |
| `CLAUDE.md` 仍 250 行、`agc check` exit 0；build 後 `dist/` 無差異；`npm audit --audit-level=high` exit 0 | e445（qa 核對） | ✓ |
| E445 done-mark（not yet released：隨 v5.0.0 發出）：`docs/backlog.md` 第 568 行列加 done-mark；佇列 `docs/v4.0.0-new-tickets.md` 補第 `247a` 號列並加 done-mark；`npm run check:bookkeeping` exit 0 | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- merge 後 `node scripts/merge-invariants.mjs`；`npm run build` 後 `dist/` 無差異；golden capture 無差異；預算在上限內；`CLAUDE.md` 250 行。
- 記帳：E445 done-mark（not yet released），backlog 列與佇列第 `247a` 號新列；`npm run check:bookkeeping` 直接跑、不接 `| tail`，exit 0；表格儲存格裡的 `|` 跳脫成 `\|`。
- 接線票：無。
- 不發版（裁定 18）。合併後 primary 的 MCP server 不必因程式重啟（只改 `content/`，server 每次組 prompt 時讀檔）。
- 下一波 E435 從合併後的 `main` 開（它切 v5.0.0）。

## 合併順序
1. `integ/v5-w6` 自當時的 `main` 開。
2. ← `--no-ff` e445 → merge-invariants。
3. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
4. `finish e445 --shipped --base integ/v5-w6`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/v5-w6`。不發版。

## Dispatch pins
- e445：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=opus`（人類 2026-11-23 裁定沿用第 5 波）。本 lane 不走 architect、不載入 `reviewer-visual`，不設這兩個 pin。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-23 | 人類 | 開 v5.0.0 里程碑第 6 波：下一張是 E445，依 backlog 相依找出能並行的票，並看 E447 的相依與佇列位置；順序依 17.1 裁定 4 修訂版；合進 `main` 不發版（16.1 裁定 18）；dispatch pins 在 Stage 2 問 | integrator prompt「fan-out v5.0.0 里程碑的下一波（第 6 波）」；`docs/discussion-2026-11-10-gate-retro-and-full-auto.md` 16.1、17.1 |
| 2026-11-23 | 整合者 | Stage 1 核對：剩下的里程碑票中相依已滿足且依順序可做的只有 E445；E435 依 17.1 裁定 4 在 E445 之後，E420 排最後，其餘等 E435；E447、E446 排在里程碑之後且撞共用生成物。本波單一 lane e445；共用生成物只歸 `content/skill-spec-workshop.md` 與 `test/context-budget.test.mjs` AC21；`e423` 四段預先劃進；第 5 波交接 `handoff --check` exit 0（只有 `MOVED`） | 本檔 |
| 2026-11-23 | 人類 | 核准本清單（單一 lane e445；沒有票與 E445 並行），含所有權重劃（`content/**` 只限 `content/skill-spec-workshop.md`；`test/context-budget.test.mjs` 只限 AC21；`test/e423-spec-workshop.test.mjs` 只限 AC6、AC9、AC10、AC11，預期不改；新檔 `test/e445-spec-workshop-questioning.test.mjs`）與交給 lane PM 的 cut 事項；AC21 快照照第 5 波 R3 (b)（sr 做完最後一個實作 task 後計畫性退回 qa 一次，用 1 次 `sr_return`，qa 量測調上限後經 sr 回 code-reviewer）；Dispatch pins：pm、sr-engineer、code-reviewer、qa-engineer 全部 opus；本波結束不發版；寫進 lane 的 spec，lane 不再問 | 整合者 session（回覆「approve」，再確認「都照建議」） |
| 2026-11-23 | 整合者 | e445 cut 預審（to-integrator#1，spec `specs/e445-spec-workshop-questioning.md` @ `d7a1b22`）：範圍、八點與 Copy / Strings、AC → 實作 task 對應、檔案邊界（`check --cut` 0 out of bounds）與完成定義相符；PM 完整套件 probe（base 4525 tests／4523 pass／0 fail／2 skip）無紅檔；回 close（to-lane#1），附一則非阻擋建議（凍結原文的說明行）。qa 對 AC10「新增文字無行首 `\d. **`」讀成「不新增步驟」，整合者確認符合清單本意（to-lane#2） | 本檔；e445 信箱 to-integrator#1、#3 |
| 2026-11-23 | 人類 | e445 cut 核准，在 lane session 親手打字；只影響 e445、內容寫在人類核准的 cut（`specs/e445-spec-workshop-questioning.md`）、lane 分支 commit `d7a1b22` 可見 | lane session（e445），spec @ `d7a1b22`；e445 信箱 to-integrator#2 |
| 2026-11-23 | 人類 | e445 若撞到 hop 上限，就在新的 lane session 續跑（本波實際只用到 hop 6/14，未觸發） | 整合者 session（回覆「如果 hop 撞到上限就再續一波」） |
| 2026-11-23 | 整合者 | e445 lane 報告（to-integrator#8）驗證通過：HEAD `bdc38ce`（8 commits）、14 檔 0 out of bounds、證據 4/4（`review_reports/review_T-E445-01.md` APPROVED covers T-E445-01..04；`qa_reports/review_T-E445-01..04.md`）、工作樹乾淨、無新發現；lane 層 CI run 45188303866 @ `bdc38ce` 綠（Node 20、22）；回 close（to-lane#5）。波中 qa 兩次全套被主機高負載拖慢（無關測試逾時、`test/lane-migrate.test.mjs` 卡住），之後三次獨自在 lock 下全套 0 fail；`lane-migrate` 不歸本 lane、未修改。reviewer 的 optional 列進波次報告，不開票 | 本檔；e445 信箱 to-integrator#5、#8 |
| 2026-11-23 | 整合者 | `integ/v5-w6` 自 `main` @ `b3ac374` 開出；← `--no-ff` e445（merge `059eced`），零衝突、無實質解衝突；merge-invariants PASS；build 後 `dist/` 無差異、audit exit 0、`agc check` exit 0、`CLAUDE.md` 250 行；E445 done-mark（backlog 列與佇列新增第 `247a` 號列）、`check:bookkeeping` exit 0 | 本檔 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ b3ac374
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/v5-w6 @ 0bcf03d）
- lane-status：primary（main ← integ/v5-w6 @ 0bcf03d）release-cd-v4.22.0／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 本波 1 條 lane、1 張票（E445）code-reviewer PASS、合併、finish、拆除；not yet released——依 16.1 裁定 18 與 E435 一起隨 v5.0.0 發出（v5.0.0 發版驗證涵蓋九張：E422、E423、E419、E431–E434、E445、E435）。lane 紀錄在 `.current/history/2026-11/e445/`；裁定與驗證細節在本檔 Decisions 與狀態行。新發現：無（lane 沒有 `pending-tickets.md`，finish 沒有配號）。E445 補進佇列檔第 `247a` 號列。
- code-reviewer 的 optional（不開票，列在這裡）：`test/e445-spec-workshop-questioning.test.mjs` 開頭註解 8 行，`agc check` 建議上限 7（含作者行與重釘提醒，裁判保留）；`test/context-budget.test.mjs` 註解比例警告是 base 既有。
- 注意：`test/e445-spec-workshop-questioning.test.mjs` 把 `content/skill-spec-workshop.md` 步驟 2–5 以外的文字凍結成 `b3ac374` 的原文（`BASE_SOP`）；之後改同檔的票（E428 tracker 鏡射）要重釘，測試檔開頭與 tests 報告已寫明。
- 環境：本波 qa 兩次全套在主機高負載下有無關測試逾時、`test/lane-migrate.test.mjs` 卡住；獨自在 lock 下重跑都 0 fail。
### 待人類決定
- 新鏈上「只有實作完才擷取得到的快照測試」（compose golden、預算上限）沒有規則處理：第 5、6 波都靠 R3 (b) 計畫性退回 qa 一次。E435 會再遇到；要再裁一次，還是開票寫進 sr／qa SOP，由人類決定（整合者建議開票）。
- SQLite／HTTP 模式設不了 `chain_path`（第 4 波留下）：整合者建議在 E435 的 cut 寫明不靠標記也走新鏈，並列一條驗收，不另開票。
- 使用者層級已安裝的 subagent 範本要不要重裝（舊 `qa-visual.md` 會留下，新 `reviewer-visual.md` 是 opus）。
- 遠端分支 `origin/docs/2026-11-20-file-e445` 已合併、未刪，要不要刪。
- E447 的排序寫法不一致：backlog depends_on 欄寫「none (ordered after E435)」，票面 Ordering 段與佇列第 258 號列寫「排在 v5.0.0 里程碑與 E446 之後」，要不要統一。
- 是否發版、是否開下一波：依裁定 18 本波不發版；v5.0.0 里程碑順序的下一張是 E435（相依 E434 ✓，切 v5.0.0）。
### 進行中的背景工作
無
