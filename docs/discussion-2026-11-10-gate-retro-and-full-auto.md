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

## 13. 待討論：測試要不要先寫（2026-11-16；已於第 14 節裁定）

人類提出、尚未裁定；預定在 E417 結束後另開 session 討論。本節只記錄問題與 coordinator 的初步分析，不是決議。

> 2026-11-17 更新：已裁定，結果見第 14 節。本節的建議（逐張選用、qa 拆前後兩段）已被第 14 節取代。

**問題**：目前的流程是 pm →（architect）→ sr-engineer → code-reviewer → qa-engineer，qa 排在最後。
BDD 是先有情境、再寫會失敗的測試、最後才寫程式。是否該把 qa 挪到 sr 前面？

**現況**

- qa 同時做兩件事：寫測試，以及當獨立的裁判並簽下 PASS。
- 修 bug 模式已經是「先紅後綠」：sr 先寫重現測試、記在預期紅燈清單，再修。E417 就是這樣跑的
  （5 個重現測試先紅後綠）。差別是測試由寫程式的人自己寫。
- 交接規則目前不允許 pm 直接交給 qa。

**初步分析**

- 裁判那一段必須留在最後（builder ≠ judge），能往前挪的只有「寫測試」。所以是把 qa 拆成前後兩段，不是整個挪。
- 好處：測試只能根據情境寫，不會被實作帶著走；sr 的目標明確（把紅的做綠）；預期紅燈清單的機制直接可用。
- 代價：每張票多一次交接；測試先寫容易猜錯介面，而 sr 不能改測試，只能退回 qa；
  縮字、文件、需要實機或肉眼驗收的票不適用；要在交接規則加一條路徑（改伺服器）。

**coordinator 的建議（待裁定）**

- 做成切票時逐張決定的選項，不全面改順序。
- 適用條件：情境的驗證方式是「自動測試」，而且對外介面已在情境裡講定。適用的票走
  「qa 先寫紅測試 → sr → 審查 → qa 驗收」，其他票維持現在的順序。
- 先寫的測試只打在情境講定的對外介面（指令、工具呼叫、檔案格式），不碰內部函式。
- 與第 11 節的裁定相接：討論結束時每個情境都標了驗證方式，標成「自動測試」的就是候選。
- 較便宜的替代做法：把修 bug 模式的「sr 先寫測試」擴大到一般功能票。不多交接、不改伺服器，但測試的獨立性較弱。
  若目標是「人只切票、其餘全自動」，coordinator 傾向前一個做法。

**待人類決定**

1. 要不要做；做的話採哪一個做法（qa 先寫，或 sr 先寫）。
2. 是逐張選用，還是符合條件就預設啟用。
3. 介面猜錯時怎麼處理：退回 qa，或允許 sr 在限定範圍內調整測試。
4. 多出來的交接要不要計入 hop 上限。
5. 要不要另開一張票。它依賴 E422（票上的情境欄位）與 E424（逐情境核對），適合排在 E424 之後；
   目前不在 E422–E428 的範圍內，也還沒有開票。

## 14. 測試先寫：裁定紀錄（2026-11-17）

第 13 節的後續討論，五點全部裁定完畢。本節只記錄裁定；沒有任何程式或規則變更，實作由 14.4 的五張票進行。

### 14.1 第 13 節查證後的更正

- **「交接規則不允許 pm 直接交給 qa」不精確。** 一般情況沒有這條路，但 pm 中途修 spec 後，可以帶
  `resume_of` 直接交回 qa 或 code-reviewer。
- **缺的路徑不只一條。** qa 先寫需要 pm → qa、architect → qa、qa 寫完 → sr 三條；現在 qa 進行中只能寫
  PASS、FAIL、Blocked。
- **「預期紅燈清單的機制直接可用」說得太滿。** 閘門只檢查清單檔和報告標題在不在；伺服器不讀清單內容，
  不確認測試真的紅過，也不確認清單早於修正。SOP 寫的是「sr 的清單」，改由 qa 先寫時作者和閘門位置都要改。
- **現行規則有矛盾。** 規章寫「只有 qa 寫測試檔」，唯一例外是搬動模組時改 import 路徑；但 sr 的 Repro-First
  要 sr 寫重現測試，規章裡沒有 bugfix 的例外。E417 是在這個矛盾下跑的。
- **hop 已有預設行為。** 換角色就加一，上限 14；多一段交接會自動多算，「不計入」才需要改程式。
- **依賴少列了 E427。** E424 核對的是裁判自己的紀錄；能獨立確認「票上寫的測試存在且通過」的是 E427（CI）。
- **「builder ≠ judge」不擋測試先寫。** 條文禁的是做出變更的人簽自己的審查或 PASS。

### 14.2 人類裁定（2026-11-17）

| # | 題目 | 裁定 |
|---|---|---|
| 1 | 要不要做、誰先寫 | 做。qa 先寫情境測試，sr 照測試實作，code-reviewer 同時審測試與實作，並由 code-reviewer 寫入 PASS。qa 不再當裁判 |
| 2 | 主鏈的形狀 | pm →（architect）→ qa → sr → code-reviewer → PASS |
| 3 | 退件：測試有問題 | 退 qa；qa 改完後必經 sr 複查（有漏掉或要改的實作就補，沒有就交出），再回 code-reviewer |
| 4 | 退件：只有實作有問題 | 退 sr，改完回 code-reviewer |
| 5 | 退件：情境本身有問題（矛盾、漏情況） | 不退 qa 或 sr；照 11.4 的裁定停票，回 pm 等人裁 |
| 6 | architect 的位置 | 需要時放在 qa 前面，介面先定，qa 不用猜 |
| 7 | 退件上限與 hop | 只算 code-reviewer 的退件次數，退 qa 或退 sr 都算一次，沿用現有審查輪數上限 4，到頂回 pm 停票。hop 上限 14 不改，多出的交接照常計入 |
| 8 | 適用範圍 | 新流程是唯一的主鏈，取代舊順序，不是逐張選用的選項 |
| 9 | bugfix 票 | 維持 sr 先寫重現測試；收尾同樣由 code-reviewer 寫入 PASS |
| 10 | 沒有測試可寫的票（純文件、縮字） | 不另開一條鏈；qa 那一步寫下「不需新測試」後交給 sr |
| 11 | 有設計稿的票 | 走同一條鏈。qa-visual 改為 code-reviewer 底下的 reviewer-visual，視覺裁定歸它；code-reviewer 一側是唯一裁判 |
| 12 | 測試的完整度與介面細節 | qa 把票上每條情境都寫成測試。情境沒講定的介面細節（指令名稱、參數、結束碼、輸出格式）由 qa 決定，記入摘要；測試就是介面的定義 |
| 13 | sr 能否改先寫的測試 | 不能。sr 照測試和情境實作 |
| 14 | sr 照測試做不下去時 | 測試和情境矛盾、或和既有程式衝突（名稱已被占用、與現有慣例不合）：退回 qa，附具體說明。這種退回不算 code-reviewer 的退件次數，只計入 hop；上限 2 次，超過就停票回 pm。情境本身做不出來：照裁定 5 停票回 pm |
| 15 | 票級與視覺驗收（修訂 11.4 第 4 條） | 停票是為了等人，不是等視覺。自動測試、指令、對基準圖的比對（門檻內由可執行檢查判定，超過門檻由 reviewer-visual 讀圖裁定）都一路跑到合併；只有標成「要實機」或「要人眼」的情境才停在驗收前 |
| 16 | reviewer-visual 判定「超過門檻但可接受」的差異 | 直接放行，不停下等人；接受了哪些差異、依據是什麼，記入每批的摘要。人類不同意時另開票修 |
| 17 | 出貨預設的模型釘選 | qa 由 sonnet 升 opus；reviewer-visual 釘 opus（qa-visual 原為 sonnet）；sr 與 code-reviewer 維持 opus。各 workspace 仍可用自己的設定覆蓋 |
| 18 | 開票與拆法 | 開票，拆成五張依序進行：先加新路、再切換規則、最後拆舊路，中途 main 不能壞（見 14.4） |
| 19 | 排序 | E422 → E423 → E419 → E431 → E432 → E433 → E434 → E435 → E424 → E425 → E426 → E427 → E428 → E420。E419 提前；E424、E426 挪到新鏈之後，票面改照「code-reviewer 是裁判」重寫；E420 排最後 |
| 20 | 版號 | 拆掉舊路的那一張發 v5.0.0（使用中的 workspace 交接順序會變，屬不相容變更）；前四張是新增或相容的變更，照常發小版 |
| 21 | v5.0.0 里程碑 | 裁定 19 排序裡的十四張票（含 gate 退役的 E419、E420）都標為 v5.0.0 里程碑；排序與裁定 20 不變：E422、E423、E419、E431–E434 在 v5.0.0 之前落地，E435 發 v5.0.0，E424–E428、E420 在其後以 v5.x 發出。E430 不在里程碑內 |

裁定 1 的理由：裁判既沒寫程式也沒寫測試，獨立性比「qa 先寫、qa 收尾」強；三個角色各做一件事（qa 出題、
sr 作答、code-reviewer 裁判）。coordinator 原先反對由 code-reviewer 收尾，檢查後承認理由大半是修改成本，已撤回。

裁定 17 的理由：qa 現在要把每條情境寫成測試並定下介面細節，錯了後面全跟著錯，而 sr 不能改測試；reviewer-visual
讀圖次數變少，但判定可接受就直接放行，後面沒有人再看。曾討論把 sr 降為 sonnet（介面與完成條件已由測試定死，
且 sr 是用量最大的一站），人類裁定不降：測試只規定行為、不規定做法，退件一輪的成本高於差價。
成本變化沒有實測數字，新流程跑過一批票後再看用量紀錄。

裁定 12–14 的理由：coordinator 原先把這題當成「qa 猜錯介面」，前提是 sr 會自己決定介面。人類指出順序相反：
qa 先寫下的測試就是介面定義，sr 照做，所以沒有猜錯可言；剩下的只有 qa 讀錯票、或定出的介面撞到既有程式兩種例外。
qa 定下的介面細節屬於 11.4 第 2 條的「由 agent 自決並記入摘要」。

### 14.3 裁定帶出的設計要點（coordinator 整理，開票時要處理）

- **伺服器要改三塊**：交接表（pm → qa、architect → qa、qa → sr、code-reviewer → PASS、code-reviewer 退件 → qa）；
  PASS 與完成任務的身分檢查（現在只收 qa）；PASS 時讀的證據檔（現在只讀 qa 的報告目錄）。
- **規章要改的條文**：「只有 qa 能完成任務」改成該流程的裁判；補上 bugfix 模式 sr 寫重現測試的例外；
  「視覺裁定只能由 qa-visual 做」改成 reviewer-visual。「只有 qa 寫測試」與「builder ≠ judge」不用動。
- **有設計稿的票的分工**：design-auditor 照舊；qa 除了行為測試，另把「截圖到指定狀態、算像素差」寫成可執行的檢查；
  sr 實作到兩者都過；reviewer-visual 只在有基準圖時載入，負責超過門檻時讀圖、定可接受差異、下視覺裁定。
  機械的截圖比對往前移後，視覺問題不必等到最後一站才發現。
- **先寫的測試只打在對外介面**（指令、工具呼叫、檔案格式），不碰內部函式。
- **qa 寫測試前要讀既有程式的介面與慣例**，定出來的介面才不會撞到；有 architect 時照 architect 定的介面寫。
  qa 不看這張票的實作（當時還不存在）。
- **「每條情境都有測試」不等於沒有漏洞**：完整度是對票上的情境而言。
- **已知補不了的洞**：情境沒列到的情況照樣會漏（E417 的漏洞屬於這種），仍靠 code-reviewer 動手實測。
  實作還不存在時測試可能因「找不到模組」而紅，伺服器分辨不出來，只能靠 SOP 要求 qa 記下紅的原因。
- **設計來源對照表的缺口**：design-auditor 的來源對照表沒有「設計工具匯出的原型」這一列，照字面比對會落到
  `no-design`，視覺閘門不會啟動。11.2 記過這是實際在用的來源類型。是否補列尚未討論。
- **E424 還沒開工是有利的時機**：可以一開始就寫成「讀裁判的驗收紀錄」，不必先綁 qa 再拆。

### 14.4 新鏈的五張票（裁定 18–20）

| 票 | 範圍 | 依賴 |
|---|---|---|
| E431 伺服器加新路 | 交接表加 pm → qa、architect → qa、qa → sr、code-reviewer → PASS、code-reviewer 退 qa；code-reviewer 可寫 PASS 與完成任務；sr 退 qa 的次數上限 2。舊路全部保留。最大的一張，需要 architect 先出設計 | E422、E419 |
| E432 PASS 的證據改讀裁判的報告 | PASS 時的各項檢查能讀 code-reviewer 的報告；預期紅燈清單的檢查移到 qa → sr 那一步 | E431 |
| E433 規則切換到新鏈 | 規章三處條文、pm / qa / sr / code-reviewer / coordinator 的 SOP、bugfix 例外、子 agent 範本與模型釘選 | E432 |
| E434 reviewer-visual | qa-visual 改名並移到 code-reviewer 底下；截圖與像素差改成 qa 寫的可執行檢查；設計來源對照表補上「設計工具匯出的原型」 | E433 |
| E435 拆掉舊路並發版 | 移除舊的交接路徑與 qa 的 PASS 權限；遷移說明；發 v5.0.0 | E434 |

排序的理由：

- E422、E423 與主鏈無關，而且新流程靠票上的情境欄位，先做。
- E419 是刪掉兩個沒用過的機制，先刪，E431、E432 要搬的東西就少一些。
- E424、E426 原本照「qa 是裁判」寫，都會改 qa 的 SOP；等新鏈完成後直接照新的裁判做，不用做兩次。
- E420 和 E434 動同一批視覺相關的檔案，而且本來就在等 adopter B 再結一個有設計稿的 feature；E434 先做，
  E420 之後直接改新的檔名。

已於 2026-11-17 開成 E431–E435，票面在 `docs/backlog.md`，排序在 `docs/v4.0.0-new-tickets.md`。
每張票動哪些檔、哪些測試要重釘，在切票時確定，張數可能再調整。E430 的位置這次沒有討論，暫列在佇列最後。

第 13 節的五點全部裁定完畢：第 1 點見裁定 1；第 2 點見裁定 8；第 3 點見裁定 12–14；第 4 點見裁定 7；第 5 點見裁定 18–20。

## 15. issue tracker 作為票的來源（2026-11-18）

起因：操作者以一張同事開在 issue tracker 上的 bug（某產品開機引導流程的設定在重開機後遺失，
需外接硬體與實機操作才能重現）為例，問第 14 節的新流程會怎麼處理。走過一遍後發現兩處裁定沒寫到，
本節記錄討論結果。兩處都已裁定（15.2 與 15.5）。

### 15.1 問題：規則只定了 repo 到 tracker 的方向

11.4 的裁定 9、11 與 E428 只涵蓋「repo 的票檔鏡射到 tracker」。實際上 tracker 是同事提需求的入口：
項目可能是 bug、UI/UX 或 feature，開票的人不是操作者，repo 裡一開始沒有對應的票檔。
照 E428 的字面，角色拿到 tracker 編號後找不到票檔可以對回去。

### 15.2 裁定（2026-11-18）

「依據」欄記錄每條是怎麼定的。裁定 4–6 是 coordinator 的提案，操作者於同日稍後逐條同意。

| # | 題目 | 裁定 | 依據 |
|---|---|---|---|
| 1 | tracker 項目的定位 | 是來源，與 PRD、設計稿同類，不是票。11.4 的裁定 9（repo 票檔是正本）不變 | 操作者明示同意 |
| 2 | 誰把 tracker 項目寫成票檔 | 一律由 `spec-workshop`，不論項目大小。coordinator 不寫情境；拿到沒有票檔的 tracker 編號時，只回報「尚無票檔，請先跑 `spec-workshop`」 | 操作者提出 |
| 3 | 預期的整體用法 | 操作者一次給 `spec-workshop` 多個 tracker 編號；它產出各自的票檔、裁定表與波次表；操作者核准一次後交給 integrator 照波次表 fan-out，多條 lane 並行；integrator 合併並出批次摘要 | 操作者提出 |
| 4 | 回寫 tracker | 預設關閉，逐 workspace 由人類開啟。開啟後，完成時把狀態與 PR 編號寫回原項目；停票的問題只產生草稿，由人類決定是否貼出 | coordinator 提案，操作者同意 |
| 5 | 匯入的票要不要另開鏡射 | 預設不開，原項目就是這張票在 tracker 上的對應。一個項目切成多張票時，人類要求才在原項目底下開子項目，一張票檔一個。一張票檔在 tracker 上最多對應一個項目 | coordinator 提案，操作者同意 |
| 6 | 要不要自動從 tracker 拉票 | 不做。做哪些項目由人類指定編號 | coordinator 提案，操作者同意 |
| 7 | bugfix 票在新鏈的交接順序（補 14.2 的裁定 9） | 仍經過 qa：pm → qa → sr → code-reviewer，交接表不為 bugfix 開例外。票上有可自動驗的情境就由 qa 先寫成測試，沒有就記下「不需新測試」；sr 的重現測試照舊。兩種讀法的比較見 15.5 | 操作者選定 |
| 8 | 15.4 的缺口怎麼處理 | 缺口二併入 E425。缺口一與三合開一張 E443（照波次表啟動 lane 的 session）：並行上限預設 3；排在 E428 之後、E420 之前；列入 v5.0.0 里程碑，以 v5.x 發出。14.2 裁定 21 的十四張因此成為十五張，其餘排序不變 | coordinator 提案，操作者同意 |

裁定 2 的理由：情境是測試與裁判的依據，寫情境的規則只該存在一份 SOP 裡。coordinator 原先提議小 bug
由自己在進件時直接轉，操作者指出這與 `spec-workshop` 的職責重疊，已撤回。轉出的情境本來就要人類看過，
所以 `spec-workshop` 必須在人類對話的 session 裡進行，不算額外成本。

### 15.3 裁定帶出的設計要點（coordinator 整理，開票時要處理）

- **`spec-workshop` 的入口條件要改**：11.5 寫「一兩個檔案能做完的事不進來」，小 bug 會被擋在外面。
  加上「沒有票檔的 tracker 項目」這個入口。小而清楚的項目走短流程：讀項目、查現有程式、寫出情境與驗證方式，
  人類確認一次就落檔，不產波次表。不清楚或要拆的照原本的多輪討論。
- **分流看的是需不需要多輪討論**，不是 tracker 上的類型欄位；類型只是初判。有設計稿的項目先過 design-auditor。
- **問題問誰**：開票的人不在 session 裡，一律由操作者裁定。操作者也答不了的，以「還不能切」結束，列出待問的問題。
- **來源事後被改**：票檔記下 tracker 編號與匯入當時的修訂號，開工前與驗收前各比對一次；有變動就報告差異，
  由人類裁定，不自動讀回。這修訂了 E428 的「tracker 內容不讀回」：對匯入的項目，變動是要報告的訊號。
- **對應關係不是一對一**：一個項目可切成多張票，多個項目也可併成一張。票檔的來源欄位可記多個編號；
  原項目要等它切出的票全部完成才算完成。
- **進 git 前要過濾**：tracker 上常有內部網址、專案代號、人名。票檔只留編號，其餘按類別描述；
  公開 repo 連編號都不記（11.4 的裁定 11）。
- **來源與程式在不同平台時**：不為了對應去另一個平台開項目；回寫時把 PR 編號記到原項目。
- **誰驗收不由流程決定**：流程只負責停在驗收前；由操作者或開票的人驗，是人的事。

落點（這幾張票都還沒開工，併入而不另開票）：

| 票 | 要加的內容 |
|---|---|
| E422 | 票檔加「來源」欄位：tracker 編號（可多個）與匯入時的修訂號 |
| E423 | 入口條件加 tracker 項目與短流程；一次收多個編號；一個項目切成多張票的做法 |
| E428 | 匯入項目的回寫規則、子項目、來源變動的比對、「一張票檔最多對應一個項目」 |
| E431 | 交接表不為 bugfix 保留 pm → sr；bugfix 票走同一條新路（裁定 7） |
| E433 | coordinator SOP 加一行：沒有票檔就指向 `spec-workshop`；qa 與 sr 的 SOP 寫明 bugfix 票各自寫哪一種測試（裁定 7） |

### 15.4 缺口：裁定 3 的用法還沒接上的地方

現有零件：波次表沿用 integrator 的 fan-out 清單格式（11.5），裁定表帶人類核准紀錄，可接上 manifest-tier；
lane 的開啟、合併與收尾都已存在。並行的單位是 session：每條 lane 一個獨立 session，
lane 內的 coordinator 再把各角色派成子 agent。不把整條 lane 派成一個子 agent，
因為子 agent 若不能再派子 agent，lane 內的裁判就得與實作者共用同一個 context（這個前提是依宿主的一般行為判斷，
未在本 repo 找到明文）。

| 缺口 | 說明 | 現有的票 |
|---|---|---|
| 誰開 lane 的 session | 現在由人類逐條開 session、貼上派工內容；八張票就是八次。要讓 integrator 一啟動就全部跑起來，需要另外的啟動機制 | E443 |
| lane 裡沒有人在場 | lane 協定要求 cut 核准等事等人類在該 session 親手打字。無人值守時要由 manifest-tier 加停票規則取代，兩者接起來後 lane 才不用等人 | E425（已加附註） |
| 用量 | 多條 lane 同時跑在同一個帳號上可能撞到用量上限；撞到後的處理（現行做法是暫停，不自行換模型）要算進批次的設計 | E443 |

三項都已有落點（裁定 8）。E443 的票面有兩點是核對現有派工內容後補上的：派工內容結尾的「等人類親手打字」
在批次用法要換成「需要人裁定的事一律停票」；`render` 目前要人逐條給的摘要與閱讀清單，批次用法改從票檔讀取。
跨波次由 integrator 的 session 重新執行腳本（每個波次合併後、額度恢復後），不需要人再啟動（操作者同意，2026-11-18）。
能否無人啟動 session 尚未實測，E443 的第一段先查證，做不到就以「做不出來」結束。

### 15.5 bugfix 票在新鏈裡要不要經過 qa（已裁定，見 15.2 的裁定 7）

14.2 的裁定 9 只定了 bugfix 票由 sr 先寫重現測試、code-reviewer 寫入 PASS，沒有定交接順序。兩種讀法：

| 讀法 | 路徑 | 代價 |
|---|---|---|
| A：跳過 qa | pm → sr → code-reviewer | 伺服器要為 bugfix 保留 pm → sr；E435 拆舊路時得寫成只有 bugfix 模式能走 |
| B：仍經過 qa | pm → qa → sr → code-reviewer | 交接表不開例外；每張 bug 多一次派工，qa 沒有情境可寫時只記下「不需新測試」 |

連帶問題：一張 bug 票同時有 qa 可先寫的情境測試與 sr 寫的重現測試時，各由誰寫哪一條。
coordinator 建議讀法 B：票上有可自動驗的情境就由 qa 寫，否則記「不需新測試」，sr 的重現測試照舊。
E431 的交接表設計與 E433 的 SOP 都要用到這個答案。操作者於 2026-11-18 選定讀法 B。

## 16. v5.0.0 里程碑十五張票的逐張審查（2026-11-19）

起因：操作者要求逐張檢查里程碑的十五張票，找出要改的、要討論的、與現況不符的。coordinator 派五個唯讀審查
agent，依共用的程式範圍分組核對票面與 repo 現況，結果整理成十四個待裁定題目與一批不需裁定的票面更正。
裁定逐題記在 16.1；票面更正在全部裁定後一次寫入 backlog。

### 16.1 裁定（2026-11-19）

| # | 題目 | 裁定 | 依據 |
|---|---|---|---|
| 1 | E419 要不要退役 `bookkeeping_write` | 退役欄位，保留 E21 的當機存檔點，改成一般寫入（照常延長租約）。E419 加改 sr、qa 兩份 SOP 各一行與 `test/e20-e21-crash-resilience.test.mjs` 的釘點；結構遷移的修補寫入仍保留「不更新時間戳」的內部選項，可改名 | coordinator 提案，操作者選定 |
| 2 | 新流程的入口與「pm 交回 qa」怎麼分（E431） | 新流程由入口那筆寫入明確帶路徑標記（如 `chain_path: "test-first"`）進入，設定後到換 feature 前不可改。沒帶標記的 pm → qa 維持現行規則（須帶 `resume_of`）；兩者都沒帶就拒絕，提示兩種寫法。新流程 feature 的 pm 改 spec 後再交 qa，不需 `resume_of` | coordinator 提案，操作者選定 |
| 3 | 新流程入口要不要過四道開工檢查（E431） | 要。cut 核准、範圍決定、外部參考、設計來源可信度四道檢查也套用在「pm → qa 且帶路徑標記」這一步，比照舊流程的 pm → sr；帶 `resume_of` 的交回 qa 照舊不檢查。E431 檔案清單補 `tools/handoff-orchestrator.ts` 這四處判斷，驗收加「未核准 cut 的 pm → qa（帶標記）被拒」 | coordinator 提案，操作者選定 |
| 4 | bug 票上 qa 與 sr 共用紅燈測試清單（E432、E433） | qa 寫了紅燈情境測試時，那條測試就算重現測試，sr 不必另寫；qa 記了「不需新測試」時才由 sr 寫重現測試並建清單。sr → code-reviewer 的檢查照舊只看清單在不在（qa 或 sr 建的都算）。E433 的 code-reviewer SOP 加一條：bug 票要確認修的是原因，不只是讓票上的情境通過。sr 仍可自行加底層測試，不強制、不檢查。修訂 15.2 裁定 7 的「sr 的重現測試照舊」 | coordinator 提案，操作者選定 |
| 5 | 新流程較早撞到交接次數上限（E431） | 維持 14。只把 `tools/transitions.ts` 中「輪數上限會先到」的註解改成符合新流程，併進 E431。退件四、五次以上的 feature 交給人類；token 預算煞車未啟用前，這是唯一的成本上限 | coordinator 提案，操作者選定 |
| 6 | 寫死「只有 qa 能寫 PASS」的地方歸哪張票 | 依性質分：E431 改工具入口的 PASS 限制（`tools/registry.ts`）、`tw_complete_task`（`tools/tasks.ts`）與交接表中 PASS 之後的出口（`tools/transitions.ts`），依路徑標記判斷裁判；E432 改發版腳本（`scripts/release.mjs`）與 lane 狀態（`tools/lane-status.ts`）；E433 改 release-engineer、doc-writer、integrator 的 SOP 文字與派工範本（`tools/fanout-manifest.ts`）。全部在 E434 動工前落地。E443 的「派工內容與今天逐字相同」改為「與 E443 動工前的輸出相同」 | coordinator 提案，操作者選定 |
| 7 | 新流程中視覺退件怎麼計數（E434、E420） | 併進審查輪數：`reviewer-visual` 的退件與其他 code-reviewer 退件同算審查輪數上限。視覺計數、上限與拆票門檻退役；計數行為在 E434 改，錯誤碼 `VISUAL_ROUND_EXCEEDED` 在 E420 收掉。E434 的 sr SOP 寫明：比對測試的差異每次都變小算有進展，不算同一個失敗；差異沒變小才照 §5 的連續修正上限停下 | coordinator 提案，操作者選定 |
| 9 | 波次表由 `spec-workshop` 寫到多細（E423） | `spec-workshop` 只寫精簡波次表（票、分波、相依）與人類核准列；integrator 在 stage 1 照當下的 `main` 調查程式碼，轉成完整 lane 清單（起點、branch、worktree、擁有／禁止檔案）。轉出的清單沒改動已核准的票、分組與順序，且沒有需要人類選的項目時，`spec-workshop` 已 commit 的核准就算數，stage 2 不再停；有任何改動或待選項目就照舊停下請人類核准。此條為 §3.1「不能憑轉述的核准」的明文例外，寫進 `content/skill-integrator.md`，E423 檔案清單補上該檔 | coordinator 提案，操作者選定 |
| 10 | 設計工具匯出的原型交給誰、用哪個 mode（E423、E434） | ① 沒有票檔時，coordinator 提示改走 `spec-workshop`；已有票檔時，照其他設計來源先交 design-auditor。② 新增正式 mode `prototype`，涵蓋單一畫面原型頁與可執行的 demo app；同時有 Figma 時為雙來源：Figma 定有哪些狀態、原型定狀態的行為，兩者每處衝突都是待裁定項目（有票前在 `spec-workshop` 裁，有票後停下問人）。能讀遠端專案時套量體檢查，不套可信度檢查。③ ② 由 E434(6) 移到 E423；同票修伺服器的 mode 解析：設計檔有寫 mode 但值認不得時改為啟動視覺檢查並在錯誤訊息點名該值，不再靜默不啟動，E384 的保護照舊。E423 檔案清單補 `content/skill-design-auditor.md`、`gates/visual.ts` | coordinator 提案，操作者選定 |
| 11 | 開發中補情境由誰補、寫在哪（E426） | 三分法：延伸票上或既有程式已決定的行為 → 追加情境；要新決定一個行為 → 停票（11.4 裁定 2）；介面細節 → qa 自決記入摘要（14.2 裁定 12）。可追加的角色只有 pm（切 cut 時）與 qa（寫測試時）；sr 照 14.2 裁定 14 退回 qa，code-reviewer 以退件請 qa 補。追加的情境寫在票檔末尾，標明新增者、日期、理由與驗證方式，E424 的檢查與 E425 的摘要因此都看得到。spec 改為引用票檔情境，不另抄；E426 的「原樣抄進 spec、在 spec 加情境」照此改寫 | coordinator 提案，操作者選定 |
| 12 | 票上的測試名稱誰填、CI 檢查哪些票（E427） | `spec-workshop` 寫票時驗證欄只寫「自動測試」；qa 寫完測試後回填名稱（測試檔路徑加測試標題），回填只動驗證欄、不動 Given/When/Then，不算改情境；code-reviewer 確認該名稱的測試確實在測這條情境。CI 每個 PR 檢查所有狀態為 `done` 的票，`not started` 與 `stopped` 跳過；測試改名的 PR 須在同一 PR 更新票上名稱。E427 驗收「沒改票檔的 branch 直接通過」改為「沒有 `done` 票時直接通過」，並加測試改名的驗收；E422 的格式說明寫明驗證欄可回填 | coordinator 提案，操作者選定 |
| 13 | E443 的啟動器怎麼開 lane、怎麼讀波次 | ① 啟動器先跑 `agc feature start` 建 worktree，再直接在 worktree 裡開 session；worktree 已存在（續跑）就跳過建立。批次模式下 `render` 的開工段改為「worktree 已建好，先確認位置與 branch」，手動開 lane 的輸出不變；E443 第 (1) 條照此放寬。② 派工清單的 Lanes 表加「波次」欄（整數），「相依」欄限定為 `無` 或以逗號分隔的 lane 名，說明文字移到「範圍切線」；`fanout.mjs check` 驗格式。依賴是否滿足以「被依賴 lane 的 branch 已是整合 branch 的祖先」判定，沿用 `tools/join-precondition.ts`。舊清單不回頭改，沒有「波次」欄的清單啟動器拒絕並說明。兩欄由 integrator 在 stage 1 照 `spec-workshop` 的精簡波次表填。實數：`specs/` 41 份清單、105 條 lane，「相依」欄 32 種寫法（審查初稿的「50 多種」更正） | coordinator 提案，操作者選定 |
| 14 | 撞到用量上限時怎麼辦（E443） | ① `content/coord-03-core-fallback.md` 補一句：用量上限或限流不算「工具不可用」，重試一次，仍失敗就存檔、寫下暫停原因並結束 session（即 E443 偵測的暫停訊號）；不換模型，也不改用 `tw_switch_role` 在自己的 context 代跑。換模型只能由人類以 `dispatch_pins` 明確指定。併入 E443，檔案清單補該檔，驗收加「派工回傳用量上限錯誤時不走 fallback」。② 操作者目前只用一個帳號，E443 拿掉第 (4) 條「每條 lane 指定帳號設定的本機對照表」與對應驗收，Phase 0 的「指定的帳號設定」改為「目前帳號」；日後要多帳號另開票。③ 用量上限的處理以 Claude Code 內建行為為主：互動式 session 撞到上限時會停在原地等，到恢復時間自動繼續（預設開啟，同一 session 最多 3 次；電腦休眠可能需按 Enter；背景與 `-p` 模式沒有）。E443 Phase 0 改為實測：啟動器開互動式 session、撞到上限時是否自動繼續、subagent 派工中途撞到時的行為、3 次用完後的狀況；行不通時的後備是 statusline 腳本把 `rate_limits.*.resets_at` 寫進檔案，由 `CronCreate` 在該時間喚醒。模型本身讀不到額度百分比；文件只列 Pro、Max、Ultra 提供該欄位。① 仍保留，作為自動等待失效時的最後一道防線 | coordinator 提案，操作者選定 |
| 15 | E433 與 E434 之間的視覺判定空窗 | E433 合進 `main` 後不單獨發版，與 E434 合發一個小版，adopter 拿不到只有 E433 的版本。本 repo 沒有 `design/`，`main` 上的空窗不影響自身開發。E433 票面加「不單獨發版」；14.2 裁定 20「前四張照常發小版」修訂為「E431、E432 照常發小版，E433 與 E434 合發一版」；發版前由 coordinator 確認 `main` 不是「有 E433、沒有 E434」 | coordinator 提案，操作者選定 |
| 16 | integrator 轉清單時改了分組或順序，要不要再停（修訂裁定 9） | 不停，前提是 `fanout.mjs check` 機械比對已核准的波次表與轉出的清單，三點都成立：票的集合相同（未增、刪、拆任何一張）；已核准的依賴全部保留（只能多加，不能拿掉）；每條 lane 擁有的檔案都在其票允許的路徑內。三點成立就自動派工，並在清單 Decisions 表記一列「integrator（自動：只改順序或分組）」與理由，批次摘要列出；任一點不成立就停下請人類核准（要擴大票的範圍，本來就是 E425 的停票條件）。比對要讀結構化的「波次」「相依」欄（裁定 13），所以併入 E443；E443 落地前照裁定 9 原規則，有改動就停。`content/skill-integrator.md` 照此改寫 | coordinator 提案，操作者選定 |
| 17 | E430 要不要納入里程碑 | 納入，維持單獨一張、票面不變：排在 E425 之後、E426 之前（兩張共用 `docs/lane-protocol.md`，一前一後），以 v5.x 發出。里程碑由十五張成為十六張，順序 E422 → E423 → E419 → E431 → E432 → E433 → E434 → E435 → E424 → E425 → E430 → E426 → E427 → E428 → E443 → E420。修訂 14.2 裁定 21「E430 不在里程碑內」 | 操作者選定 |
| 18 | 新舊版的分界：中間版本要不要發 | 不發。E422、E423、E419、E431、E432、E433、E434 依序合進 `main` 但都不單獨發版，與 E435 一起發 v5.0.0：adopter 從 v4.x（舊流程）一步升到 v5.0.0（新流程且舊路已拆），拿不到任何新舊並存的中間版本。從 E422 合併到 E435 發版之間不從 `main` 發版；這段期間 v4.x 若要修正，從 v4.22.0 的 tag 另開分支處理，做法屆時決定。v5.0.0 的發版驗證一次涵蓋這八張票。E424–E428、E430、E443、E420 仍在 v5.0.0 之後以 v5.x 發出。修訂 14.2 裁定 20（「前四張照常發小版」）與本表裁定 15（「E431、E432 照常發小版，E433 與 E434 合發一版」）；裁定 15 的空窗檢查因此不再需要。不選「E422–E434 先發 v5.0.0、E435 之後再發」：那樣 v5.0.0 仍新舊並存，拆舊路依版號規則得發 v6.0.0 | 操作者選定 |
| 19 | E443 的 lane 開成什麼形式、操作者看不看得到 | 選 A：每條 lane 開一個看得到的 terminal 視窗（macOS 的 Terminal 視窗或 iTerm 分頁），裡面跑互動式 session，畫面與手動開的相同，操作者可直接點進去看或打字。已知風險：視窗被誤關，該 lane 就中斷；腳本要能分辨「視窗已關但 lane 沒做完」，下次執行時依當機續跑規則在同一個 worktree 接續，不當成已完成。備選 B 一併記錄：每條 lane 開在 tmux 的背景 session，不跳視窗、不佔螢幕、不怕誤關，要看時用 `tmux attach -t <lane>`，看完離開它繼續跑；代價是要裝 tmux、不主動去看就不知道進度（靠 `lane-status`）。Phase 0 先驗 A；若 A 做不到（腳本開不出視窗，或開出的 session 在額度重置後不會自己接著跑），改用 B，不必回來重裁。A、B 都必須是互動式 session：裁定 14 的「額度重置後自己接著跑」只有互動式有，背景 `-p` 模式不採用 | 操作者選定 |
| 20 | 已標記的 feature 帶 `resume_of` 交回 qa 時，四道開工檢查要不要豁免（2026-11-20，E431 架構第二次預審 OQ1） | 不豁免。已標記（`chain_path: test-first`）的 feature 上 pm → qa 一律過四道開工檢查，帶不帶 `resume_of` 都一樣；未標記的 feature 照舊豁免。修訂本表裁定 3 的「帶 `resume_of` 的交回 qa 照舊不檢查」：該句只適用未標記的 feature。理由：新路徑上 qa 之後就是 sr 動工，若豁免，pm 修改 cut 後未經核准，qa 接回即可交 sr 照未核准的內容實作 | 操作者選定（E431 lane session；`specs/fanout-v5-w2.md` Decisions） |
| 8 | E435 之後路徑標記要不要保留 | 移除。升級時停在舊流程中途的提示改由「這次寫入是否為已拆掉的舊步驟」判斷（pm 直交 sr、code-reviewer 核准後交 qa、qa 寫 PASS），不靠標記。E435 加：交接檔結構升版、讀舊檔時丟掉該欄位；`resume_of` 移除 `qa-engineer` 這個值；票面「若沒人讀就移除」改為「移除」 | coordinator 提案，操作者選定 |

裁定 1 的理由：§3.3 表的「0 次」量的是交接檔，但這個欄位不寫入交接檔，數字證明不了沒人用；實際用到它的是
E21 的存檔點。「不延長租約」原是為閒置 feature 上的 PM 當機紀錄設計的；存檔點是正在工作的角色寫的，feature
確實還活著，延長租約才對。E21 當初用這個欄位只因它是現成的。

裁定 2 的理由：E431 到 E433 之間 SOP 還是舊流程，實際 feature 都走舊路；要明確標記才會進新流程，這段期間伺服器
行為與現在完全相同。若改成「沒帶 `resume_of` 就算新流程」，舊流程 feature 在 pm 改完 spec 交回 qa 時漏帶欄位，
會被悄悄改走新流程。

裁定 3 與自動化不衝突：檢查只看 `cut_approved` 有沒有寫入，不限定由人類寫。批次自動化時由 Auto-tier 或
Manifest-tier 自動寫入並留紀錄；越界的 cut（動到別條 lane 的檔）才會停。要讓批次 lane 不等人類打字，要改的是
lane 協定與 §3.1 的文字（E425 的範圍），不是這道檢查。

裁定 4 的理由：qa 的紅燈情境測試是在沒看實作的情況下照票寫的，本身就證明 bug 存在且被抓到，獨立性比建置者
自寫的重現測試高。sr 另寫重現測試的價值在於逼出根本原因，但伺服器只看檔案在不在，擋不住只修症狀的修法；
真正抓得到的是看實作的 code-reviewer，所以把這項檢查放在它的 SOP。

裁定 10 的依據：2026-11-19 實際查 adopter B 的設計檔。原型來自 Claude Design，本機副本有兩種形式：單一畫面頁（內嵌狀態機、載入 design system token）與可執行的 demo app。design-auditor 沒有寫 `no-design`，而是自創 `mockup` 與「雙來源」寫法；但伺服器只認 8 個 mode，認不得的值當作沒有 mode。以伺服器自己的判斷函式檢查，5 份原型相關設計檔中有 4 份視覺檢查沒啟動。14.3「會落到 `no-design`」的說法原因不對、結果相同，而且已實際發生。那 4 個已結案 feature 要不要補跑視覺比對，屬 adopter B 的範圍，不在本次審查。

### 16.2 審查中新發現、待裁定的題目

- **E433 與 E434 之間的視覺判定空窗。** E433 落地後 qa 不再當裁判，但視覺判定要到 E434 才移給 code-reviewer 的
  `reviewer-visual`；這段期間有設計稿的新 feature 沒有人做視覺判定。兩張票都沒寫。（已由 16.1 裁定 15 處理。）
- **3.2 把 `REPRO_MANIFEST_MISSING` 列進視覺系列是錯的。** 它是 bugfix 重現測試清單的檢查（`gates/registry.ts` 的 expected-red 系），不在視覺步驟的 9 個碼裡；從未觸發的視覺碼是 6 個，不是 7 個。E420 照此重寫（見 16.3）。

### 16.3 票面修正

裁定 1–15 與審查中不需裁定的更正（檔案清單、測試影響計數、過期排序、E424/E426 改寫為 code-reviewer 當裁判、E433 預拆至少 3 個 sr 任務、E431「伺服器的 builder-is-not-judge 檢查」改為「§3 條文不動」、E420 重寫）已寫進 `docs/backlog.md` 十五列，各列以「Audit amendment (2026-11-19 …)」附註標示，與上文衝突處以附註為準。

