# 討論紀錄 2026-11-10 — gate 退役檢討與全自動開發流程的預期

> 一次 `/teamwork` 對話的整理。前半是用 `tw_gate_stats` 對三個 workspace 做的
> gate 使用量檢討，產出 E418–E420 三張票；後半是操作者對這個工具的下一階段預期
> （人類只參與切票，之後全自動執行）與 coordinator 的評估。
> 票的正本在 `docs/backlog.md`；這份檔只記脈絡、數據與裁定。

## 1. 起點：這個工具現在是什麼

操作者問 coordinator 對 agent-governance-mcp 的整體看法。結論：

- **做得好**：路由鏈、round cap、hop cap、PASS 證據檔都是 server 端強制，不靠 agent
  自覺；builder ≠ judge 落實到工具層；attested 欄位誠實標明「attested, not
  server-verified」；多 lane worktree 模型解決了多帳號並行的真問題。
- **代價**：`/teamwork` 每次付約兩萬 token 的憲法加 SOP；規則密度高到 agent 自己也會漏；
  cut approval 讓每張票至少停一次等人；backlog 裡治理層修治理層的比例高。
- **一句話**：更像「給 agent 用的 CI」，對多 agent 長期專案有價值，對單人小改動偏重。
  下一階段最值得投資的是減法。

## 2. 名詞解釋

- **gate**：`tw_update_state` 寫入前跑的一串檢查，不過就退回並給錯誤碼。量測當時
  `GATE_REGISTRY` 有 35 個錯誤碼（wave A 的 E247 之後是 36）。
- **attested 欄位**：server 只驗格式、不驗真假的欄位，例如 `cut_approved`、
  `scope_decision_why`、`lease_override`、`bookkeeping_write`、`resume_of`、
  `dispatch_pins`、`dispatch_mechanism`。
- **tier 與例外**：讓 cut approval 不停下來問人的兩種自動核准（Auto-tier、
  Manifest-tier），加上 lease override、hop cap 續跑這類有條件繞過的條款。

## 3. 量測結果

資料來源：`tw_gate_stats`，讀每個 workspace `.current/` 樹下的所有 `telemetry.jsonl`
（含 history 與 archive）。只記被拒絕的寫入，不記通過；沒有分母，所以是次數不是比率。
`.current/` 在兩個 adopter repo 都列在 `.git/info/exclude`，與分支無關；
adopter 的 feature id 已逐一對回各自工作分支的 commit 訊息確認。

| workspace | 期間 | 拒絕次數 | 備註 |
|---|---|---|---|
| 本 repo | 2026-07-10 至 2026-11-09 | 131 | 78 個 feature，one-pass 率 0.67，hop 平均 4.9、最高 10 |
| adopter A（API gateway 加 web console，非設計稿） | 2026-09-29 至 2026-10-27 | 29 | 無 `metrics.jsonl` |
| adopter B（有 Figma 設計稿的裝置端 app，多 lane） | 2026-07-22 至 2026-10-27 | 121 | 另有一個 worktree 1 次；無 `metrics.jsonl` |

### 3.1 有觸發的錯誤碼（三者合計由多到少）

| 錯誤碼 | 本 repo | adopter A | adopter B | 白話 |
|---|---|---|---|---|
| TRANSITION_REJECTED | 56 | 8 | 65 | 角色順序走錯，多數是 qa-engineer |
| EXPECTED_RED_DIFF_MISSING | 28 | 1 | 10 | 說紅燈是預期的但沒附 manifest |
| AC_EXECUTION_LOG_MISSING | 19 | 12 | 6 | QA 要 PASS 卻沒附驗收執行紀錄 |
| NON_QA_COMPLETED_TASKS_REJECTED | 11 | 0 | 9 | 非 qa 角色自己勾票 |
| QA_COMPLETION_EVIDENCE_MISSING | 5 | 0 | 7 | 勾完成但磁碟上沒證據檔 |
| VISUAL_EVIDENCE_MISSING | 0 | 2 | 7 | 視覺 PASS 沒附證據 |
| VISUAL_REPORT_INCOMPLETE | 0 | 1 | 5 | 視覺報告欄位不齊 |
| FEATURE_LEASE_HELD | 4 | 0 | 3 | 同 workspace 第二個 feature 想開 |
| CUT_APPROVAL_REQUIRED | 3 | 2 | 0 | 沒等人批准就想進 build |
| MISSING_REVIEW_EVIDENCE | 2 | 1 | 3 | |
| AGENT_ID_REQUIRED | 1 | 0 | 3 | |
| HOP_CAP_EXCEEDED | 0 | 0 | 2 | 真的撞到 14 hop |
| SOURCE_CREDIBILITY_UNVERIFIED | 0 | 2 | 0 | |
| VISUAL_PROVENANCE_MISSING | 0 | 0 | 1 | |
| MISSING_EVIDENCE、QA_REVIEW_TARGET_REQUIRED | 1、1 | 0 | 0 | |

### 3.2 三個 workspace 都從未觸發的 19 個

- round cap 三個：`QA_ROUND_EXCEEDED`、`REVIEW_ROUND_EXCEEDED`、`VISUAL_ROUND_EXCEEDED`。
- 視覺系列七個：`VISUAL_BASELINES_REQUIRED`、`VISUAL_WIDGETS_UNVERIFIED`、
  `VISUAL_ASSERTIONS_REQUIRED`、`BASELINE_MANIFEST_MISSING`、`BASELINE_PROVENANCE_INCOMPLETE`、
  `PIXEL_GATE_ATTESTATION_MISSING`、`REPRO_MANIFEST_MISSING`。
- 稽核類四個：`SCOPE_DECISION_REQUIRED`、`LEASE_OVERRIDE_AUDIT_MISSING`、
  `BOOKKEEPING_WRITE_INVALID_FEATURE_CHANGE`、`STAMP_PROVENANCE_SUSPECT`。
- 身份類四個（上線一兩個月，樣本短）：`REVIEW_VERDICT_STATUS_MISMATCH`、
  `REVIEWER_COMPLETED_TASKS_REJECTED`、`NON_REVIEWER_VERDICT_REJECTED`、`DISPATCH_PIN_TIER_REJECTED`。
- `EXTERNAL_REFS_UNRESOLVED`：兩個 adopter 共 56 份 handoff 都有填 `external_refs`，gate 從未擋，表示 PM 有做審查。

### 3.3 attested 欄位與 tier 的使用

| 項目 | 本 repo | adopter A | adopter B |
|---|---|---|---|
| `cut_approved`、`scope_decision`、`dispatch_mechanism` | 每個 feature | 每個 feature | 每個 feature |
| `lease_override` | 有 | 0 | 9 份 handoff |
| `resume_of` | 有 | 0 | 7 份 |
| `dispatch_pins` | 有 | 0 | 6 份 |
| `review_verdict` | 有 | 0 | 1 份 |
| `bookkeeping_write`、`stamp-remediation` | 0 | 0 | 0 |
| Auto-tier、Manifest-tier | 0 | 0（`cutApprovalAutoTier` 未設） | 0（同左） |
| `tokenBudgetPerFeature`、`usage.jsonl` | 未設 | 未設 | 未設 |

兩個 adopter 的每一張 cut 都是人類手動批准。

## 4. 解讀與三層建議

- 真正在工作的 gate 約 10 個，其中證據類四個（AC 紀錄、expected-red、完成證據、
  review 證據）合計擋了約 60 次，是最有價值的部分。
- `TRANSITION_REJECTED` 最大宗，反映 agent 記不住順序，不是流程有問題。
- 零觸發不等於沒用：telemetry 只記拒絕；gate 程式執行幾乎免費，省的是 prose 的
  context 與維護成本。退役是人類決定，走 `docs/gate-retro-procedure.md` 第 5 步開票。

| 層 | 內容 | 體積 |
|---|---|---|
| 整個拿掉 | Bookkeeping-Write、Stamp-Provenance、Manifest-tier、Token Budget Brake 與 Observability、Watermark Validation 段落 | 約 10KB |
| prose 縮減、程式保留 | Escalation Routes 表（9.4KB）、§3.1 六段、視覺片段、Non-QA／QA-completion 段落 | 約 20KB |
| 原樣保留 | 轉換矩陣、三個 round cap、hop cap、feature lease、四個證據 gate、builder ≠ judge、`dispatch_pins`、`cut_approved`、external refs 帳本 | |

constitution 15 片段合計約 44KB，coordinator SOP 7 片段約 46KB；粗估可省約兩成。

**人類裁定（2026-11-10）：Auto-tier 保留，不退役。**

## 5. 產出：E418–E420（PR #113，merge `a91d649`）

執行順序與層對調：prose 縮減收益最大、風險最低，所以先做。

| 票 | 優先 | 相依 | 內容 |
|---|---|---|---|
| E418 | P2 | 無 | 第一波：§3.1 六段、Escalation Routes、watermark 段落縮成 WHEN/DO/ELSE 加錯誤碼；gate、欄位、schema 不動；前提是每個碼的 server hint 足以讓角色自我修正。2026-11-13 起另含 manifest-tier 與 token brake 的文字縮減 |
| E419 | P3 | E418 | 第二波：移除 bookkeeping_write、stamp-provenance；registry 36 變 34。原本還含 manifest-tier、token budget brake，2026-11-13 裁定抽出（見第 10 節） |
| E420 | P3 | E419 | 第三波：視覺系列 10 個碼合併成 3 個，predicate 全留；等 adopter B 再結一個 design-armed feature 才切 |

三波共用 golden 與 context-budget cap，序列做，不開平行 lane。

## 6. backlog 現況（2026-11-10）

- 未處理的票只剩 E417（P3，merge-invariants 檢查 (c) 的靜默漏報，相依 E203 已完成）。
- v4.20.0 已發版（wave A 加 wave B，23 張票）。
- wave B 交接段留的問題：`test/e108-eject.test.mjs` 多 lane 並行時 AC1、AC7、AC15、
  AC19、AC20 都逾時過，補充規則只列 AC7；擴大清單、整檔去耦或維持現狀待裁。

## 7. 操作者的下一階段預期

> 把需求或 PRD 餵給套用 agc 的 agent；一開始人類與 AI 一起用 BDD 精神討論任務、
> 定驗收標準、切票；票切好後上 GitHub Issues 或 Azure DevOps；之後人類只啟動 agent
> 開發已討論好的票，全程 auto approve，不再過人手。

### 7.1 coordinator 的評估

方向對，與資料吻合：人類把力氣花在切票，自動化成功率就上來（細票成功率高是先前已觀察到的）。
工具現在約七成具備，缺的三塊在流程設計，不在 gate。

**與 E419 的衝突**：Manifest-tier 本質上就是「人類先批准一份清單，lane 之後不再過人手」，
沒被用過是因為條件太重，不是想法錯。建議 E419 第 (3) 項改成「用預先核准的票取代
manifest-tier」而非單純刪除。2026-11-13 已裁，見第 10 節。

**第一階段（人類與 AI 共同切票）缺什麼**

- （2026-11-13 更正：這一點寫錯，PM SOP 早已規定 Given/When/Then 與 `proof:` 標註；實際缺口見第 11.1 節。）
  PM SOP 沒有 BDD 格式；驗收標準要改成 Given/When/Then 的 scenario，讓 qa 一對一寫成測試，
  接上既有的 AC 執行紀錄 gate（它只檢查有沒有跑驗收，不檢查驗收長什麼樣）。
- 票的正本現在是 `docs/backlog.md`；要讓 backlog intake loop 從 issue tracker 讀票、回寫狀態，
  需要一個「票來源」抽象層。host 端已接 GitHub 與 Azure DevOps 的 MCP，agent 開票這段今天就能做。
- 預先核准的票必須機器可核對：允許動的路徑、scenario 清單、優先級。
  `fanout.mjs check --cut` 已會做這種核對，只是對象要從 fan-out manifest 改成 issue 內容。

**第二階段（全自動執行）真正的風險**

- 不是 gate：三個 workspace 的資料顯示 gate 擋得住 agent 的錯，round cap 從未撞到。
- 需要人類裁定的時刻：PM cut 常冒出選項、qa 發現 spec 矛盾。現在是寫 Blocked 等人；
  全自動要改成「停這張票、記錄原因、做下一張」，人類在批次結束看摘要一次裁完。
- 成本：目前只有 hop cap 在擋，token 煞車未開。全自動跑一批前至少設每票 token 上限。
  E419 要刪 token brake，這點要重新想。
- 設計稿類的票：視覺判定的獨立性與品質最不穩，adopter B 的視覺 gate 觸發紀錄也證明這一塊最常出錯。

**建議推進順序**

1. 先在 adopter A 試：票小、非設計稿、one-pass 高。設 `cutApprovalAutoTier` 就能先體驗不過人手。
2. 同時開三張功能票：BDD 驗收格式進 PM SOP、issue tracker 作為票來源、停票續跑的失敗政策。
3. design-armed 專案最後再放進全自動。

全自動不等於零人力，而是把人力從「每張票批一次」變成「每批看一次摘要」。
integrator 信箱與 lane 回報機制已經是為這個形狀設計的。

## 8. 待人類決定

1. E419 第 (3) 項：刪 manifest-tier，還是改成「預先核准的票」tier。**已裁 2026-11-13：從 E419 抽出，保留。**
2. E419 第 (4) 項：全自動需要成本煞車，token brake 要不要留或換形式。**已裁 2026-11-13：從 E419 抽出，保留；形式待後續票決定。**
3. 是否開第 7.1 節的三張功能票（BDD 格式、票來源抽象層、停票續跑政策）。**2026-11-13：方向已定，設計見第 11 節；票的切法待人類核准。**
4. E417、e108 負載敏感問題的處理順序。**e108 部分已結：E421 擴大清單、測試不動（PR #114）。E417 已裁 2026-11-13：排在 E418 之後。**
5. 是否先在 adopter A 設 `cutApprovalAutoTier`。**已裁 2026-11-13：設，用保守預設；見第 12 節。**

## 9. 重現方法

```bash
# 任一 workspace 的 gate 使用量（讀 .current/ 樹下所有 sidecar）
tw_gate_stats(workspace_path=<workspace>)

# 各片段體積
wc -c content/const-*.md content/coord-*.md

# attested 欄位使用量（handoff 檔數）
grep -rl 'lease_override' <workspace>/.current --include=handoff.md | wc -l
```

注意：`tw_gate_stats` 不讀同 repo 其他 worktree 的 `.current/`，要逐一跑。

## 10. 後續裁定（2026-11-13）

**人類裁定：E419 抽掉第 (3)、(4) 項。**

- manifest-tier 保留：它是目前唯一的「預先核准」機制，等票級的預先核准 tier 落地再替換，
  不先刪以免出現空窗。
- token budget brake 保留：全自動執行時它是唯一的成本側煞車；之後可能改成每票上限。
- 兩者的說明文字縮減併入 E418，config key、Escalation Routes 列、script 都不動。
- E419 剩 bookkeeping_write 與 stamp-provenance 兩項，檔案數約 14 降為約 9；
  registry 仍是 36 變 34（抽出的兩項本來就不佔錯誤碼），E420 的 34→27 不受影響。
- 第 4 節「整個拿掉」一列的 Manifest-tier 與 Token Budget Brake 因此改列「prose 縮減、程式保留」；
  約兩成的節省估計會略降，未實測。

第 8 節五項至此全部裁定：第 3 項見第 11 節，第 4、5 項見第 12 節。

## 11. 規格討論到全自動開發的流程設計（2026-11-13）

同一天的後續討論。操作者以 adopter B 的實際開發經過為例說明預期，以下是整理後的設計與裁定。

### 11.1 更正與現況

- 第 7.1 節說「PM SOP 沒有 BDD 格式」是錯的。PM SOP 已規定驗收標準用 Given/When/Then，
  並有 `proof:` 標註；有 `proof:` 的 spec，qa 要附驗收執行紀錄才能 PASS。
- 實際的缺口有四個：scenario 到 cut 階段才出現，人類批准 cut 時才第一次看到；`proof:` 是選填；
  gate 只檢查紀錄是否存在，不逐條核對；票上沒有結構化的 scenario 欄位。

### 11.2 adopter B 的觀察

adopter B 的 backlog 逾八千行，前期規格來源是 PRD 加設計稿，中後期改用設計工具匯出的原型當規格；
票分成共用元件與建在其上的功能系列。三個與設計有關的觀察：

1. 切票真正的產出是「要人類裁定的問題表」。一個功能在開工前有十一題裁定，內容是來源互相矛盾時聽誰的、
   超出容量怎麼辦、返回鍵行為這一類，幾乎每條都能直接寫成 Given/When/Then。
2. PRD 與設計稿會互相矛盾，而且是拆到能對照的粒度時才被發現。
3. 裁定會過期：先前的裁定被後續的票推翻，整段功能也曾被暫緩。scenario 需要記錄被哪條後續裁定取代。

### 11.3 操作者預期的三段流程

1. **觸發**：輸入含 PRD、設計稿或設計工具原型時，進入規格討論階段，不直接開發。
2. **討論與切票**：人類全程參與，量大且細。agent 把來源剝開對照，把矛盾與未定義的行為整理成問題逐題問，
   人類的裁定變成 scenario；切票時按互不相碰的檔案範圍切，產出可交給 integrator 平行展開的波次表。
3. **全自動開發**：票定案後，cut、build、review、QA、合併都不再過人手，人類只在每批結束看摘要。

### 11.4 人類裁定（2026-11-13）

| # | 題目 | 裁定 |
|---|---|---|
| 1 | 開發中途冒出的問題 | 停票處理，下一批再裁；討論階段不必問到滴水不漏 |
| 2 | 什麼情況停票 | 只有兩種：scenario 本身有問題（矛盾、漏了影響行為的情況、做不出來）；要動到票沒授權的範圍（允許路徑以外的檔案、schema、對外合約）。其餘由 agent 自決並記入摘要 |
| 3 | 討論階段的完成條件 | 每條 scenario 有明確驗證方式（自動測試、指令、實機或人眼）；需實機或人眼的在票上標明；來源衝突都有裁定 |
| 4 | 票的分級 | 兩級：全部 scenario 可自動驗的跑到合併；含實機或視覺驗收的跑到驗收前停 |
| 5 | 開發中 scenario 能否改 | 只能加，不能改或刪；加的列入摘要。要改或刪就是停票 |
| 6 | 機器核對的深度 | 第一步：逐條核對票上每條 scenario 在驗收紀錄裡有對應的一筆且通過。第二步：每條 scenario 對應測試名稱，由 CI 確認這些測試存在且通過。server 不執行任何指令 |
| 7 | 討論階段由誰做 | 新增獨立角色 `spec-workshop`：只有 prompt、由人類直接啟動、不進路由鏈、不寫交接狀態（與 integrator 同類） |
| 8 | 沒有規格來源、只有想法時 | 同一個角色處理；此時現有程式與文件就是來源 |
| 9 | 票的正本 | repo 內被 git 追蹤的票檔。issue tracker 是單向鏡射，人類要求時才開；內容不一致以 repo 為準；在 tracker 上改內容不生效 |
| 10 | 票檔的形式 | 新票一張一檔，backlog 檔退成索引，舊票不搬 |
| 11 | tracker 對照 | 票檔只記編號、不記網址；公開 repo 連編號都不記，對照表只放本機 |
| 12 | 票檔格式 | 通用格式，不用這套工具的人或 agent 也讀得懂（四條規則見 11.6）；不採用獨立的 `.feature` 檔 |

### 11.5 `spec-workshop` 的形狀

- 不能被派成子 agent：子 agent 無法與人類多輪對話，所以這段必須在人類正在對話的 session 裡。
- 讀取量大的工作（抽設計稿、查既有程式）派子 agent，自己只留摘要。
- 產出三樣：裁定表（附日期）、帶 scenario 與驗證方式的票、平行波次表。波次表沿用 integrator 現用的
  fan-out 清單格式，裁定表帶人類核准紀錄，接上保留下來的 manifest-tier。
- 入口條件：有規格或設計稿要拆，或有一個需要多輪討論才能定案的想法。一兩個檔案能做完的事不進來。
- 四條工作規則：先查現況再提問；裁定邊談邊落檔，不等最後整理；允許以「不做」或「還不能切」結束，
  不為產出硬切；討論紀錄是正式產出，票只記結論並指回紀錄。

### 11.6 票檔格式的四條規則

1. Markdown 加開頭的欄位區塊；scenario 用 Given/When/Then。
2. 欄位名稱用白話（允許修改的路徑、相依的票、驗證方式、需要實機或人工驗收），不出現這套工具專有的詞。
3. 票檔自己就夠用：沒裝這套工具的 agent 或工程師拿到就能開工；驗證方式是任何人都能執行的指令或測試名稱。
4. 工具專屬的資料（路由狀態、審查輪數、證據檔、派工紀錄）不放進票檔。票檔只有三種狀態：未開始、完成、停住（附原因）。

連帶方向：票檔是通用文件所以進 git；在不使用這套工具的團隊 repo，其餘工具產物照舊只留本機。

### 11.7 由裁定推得的設計後果

- 停票要能擴散：一張票停了，相依它的票跟著停，其餘照跑。切票時記錄的相依關係同時是停票範圍的依據。
- 批次摘要是人類唯一的介入點：一次列出停了哪些票、各自卡在什麼問題、連帶停了哪些。
- PM 變薄：票上已有 scenario，PM 每張票只做細部切分；小票可跳過 PM。
- 這些功能票與 E418 都動 `content/**`，共用 golden 與 context-budget 上限，要排在 E418 之後序列做。

## 12. 收尾裁定與開票（2026-11-13）

- **E417 排在 E418 之後。** 執行順序：E429 → E418 → E417 → E422 → E423 → E424 → E425 → E426 → E427 → E428；
  E419、E420 照原相依排在 E418 之後，E420 另等 design-armed 的 adopter 再結一個 feature。
- **adopter A 已設 `cutApprovalAutoTier`**，值為保守預設：最多 2 個檔、優先級 P3 以下、不含 schema 變更、
  不含設計稿、manifest 關閉。設定檔在該 workspace 的本機工具目錄，不進 git。
- **設定時發現的限制**：這個鍵是逐 workspace 讀取的，lane 的工作目錄沒有自己的設定檔，也不會沿用主目錄的。
  所以目前只有在主目錄直接進行的票會套用自動核准；在 lane 裡進行的票仍會停下等人。是否讓開 lane 時帶入
  主目錄的設定，已開成 E429；人類裁定排在 E418 之前先做。只發生在工具產物留本機的 repo，產物進 git 的 repo 不受影響。
- **第 11 節的設計已開成七張票**：E422（通用票檔格式）、E423（`spec-workshop` 角色）、E424（驗收紀錄逐條核對）、
  E425（停票續跑）、E426（PM 只能加不能改 scenario）、E427（CI 核對測試名稱）、E428（單向鏡射到 tracker）。
