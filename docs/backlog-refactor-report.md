# agent-governance-mcp Backlog 重構前後差異報告

> 撰寫:2026-07-09,由 Fable 5(coordinator 主迴圈)產出。
> 範圍:`docs/backlog.md` 所記錄的架構改善票(A 系列 2026-07-06 架構評審、B 系列 carried-forward、C 系列 live 過程摩擦),對照修改前(≈ v3.43.0,2026-06-26)與修改後(v3.54.0,2026-07-09;C9 於本報告撰寫時處於 QA 階段)。
> 資料來源:`CHANGELOG.md`、`scripts/measure-context-cost.mjs` 實測、`test/context-budget.test.mjs` 歷史 cap 註解、本次 C9 run 的 subagent 用量遙測。

---

## 1. 摘要

三天內(07-06 → 07-09)透過 /teamwork 鏈自舉(dogfooding)出貨了 11 個版本(v3.44.0 → v3.54.0),關閉 backlog 票 18 張。整體方向是同一件事的三個面向:**把「約定」變成「資料」,把「散文」變成「結構」,把「信任」變成「閘門」**。代價是治理文字持續變厚 —— 常駐 token 預算三天內成長約 20%,每 dispatch 的角色 bundle 落在 7k–12k ~tok。省下的不是總量,是「每條規則的漂移風險」。

---

## 2. 修改前 vs 修改後 — 明確差異

### 2.1 程式結構(A1 / A2 / A10)

| 項目 | 修改前 | 修改後 |
|---|---|---|
| `index.ts` | 1,436 行;新增工具要改三處(list、zod、dispatcher case),prompt 註冊是 11 分支 if-chain | 201 行;`tools/registry.ts` + `PROMPT_REGISTRY` 單一註冊點,`tools/handoff-orchestrator.ts` 統一編排(v3.45.0) |
| `tools/evidence-file.ts` | 994 行,15 個 `has*/check*` 閘門判定式全塞一檔 | 拆為 `gates/qa-review.ts`、`code-review.ts`、`visual.ts`、`scope-decision.ts`、`cut-approval.ts`;原檔只剩共用讀寫 plumbing(v3.46.1) |
| 閘門目錄 | 錯誤碼、憲法散文、skill 散文三份獨立手寫、互相漂移 | `gates/registry.ts` 的 `GATE_REGISTRY`(18→C9 後 20 個 typed `GateDefinition`)單一來源;`error-code-contract.test.mjs` 改為生成式對偶測試(registry↔code↔doc 三向包含斷言)(v3.46.1) |

### 2.2 治理文字管線(A4 / A9 / A6 / A7 / A11 / A13)

| 項目 | 修改前 | 修改後 |
|---|---|---|
| 憲法組裝 | 單檔 `constitution.md` render 後「減法剝除」(strip fences) | 15 個 `const-*.md` 片段依 dispatch 模式「加法組合」(`prompts/constitution-manifest.ts`),golden fixture 鎖 byte 等價(v3.45.0) |
| 出處標記 | 42 處 provenance 標記(commit hash、node-id、時間戳)隨文入 context | `stripOriginTags()` 建置期剝除,每 dispatch 約省 200 ~tok(v3.44.0) |
| skill-qa-visual | 265 行,閘門規則重複陳述 | 124 行整併重寫(v3.44.0) |
| 升級規則文法 | 各 skill 各自散文描述升級/停止條件 | 統一 `## Escalation Routes` 表 + WHEN/DO/ELSE 文法,憲法 §3 定義一次(v3.51.0) |
| §1 輸出政策 | 字數上限、watermark 格式散落多處、彼此矛盾風險 | 單一 15-word 政策宣告 + watermark 決策表(v3.50.0) |

### 2.3 伺服器閘門 — 從「文字約束」到「寫入攔截」(C1 / C2 / C13 / B8 / C3)

| 項目 | 修改前 | 修改後 |
|---|---|---|
| PM 切票核准 | SOP 散文要求人類核准,子代理邊界外無法驗證 | `CUT_APPROVAL_REQUIRED` 伺服器閘門 + coordinator 見證式 attestation(v3.43.0 / v3.46.0) |
| PM 中途修 spec | 下游角色被 strand,得繞道 sr-engineer 製造假 hop | Amend-Resume guarded edges(`resume_of:` 標記開 pm→code-reviewer/qa-engineer 邊)(v3.46.0) |
| release-engineer | 無合法寫入邊;v3.48.0 release 時子代理被拒後**手改 handoff.md 卡死狀態機**(實際事故) | 兩條新合法邊 + §3 STOP-on-rejection 規則(拒絕即停、不得手改)(v3.49.0) |
| 外部參照 | §7 純文字政策,spec 引了沒抓的 Figma/文件無人擋 | `external_refs` ledger + `EXTERNAL_REFS_UNRESOLVED` build-entry 閘門,handoff schema v5→v6(v3.52.0) |
| 批次證據 | 每 task id 一個 stub 指標檔,review 輪塞滿垃圾檔 | `covers:` 行的 covering-report 機制(v3.47.0) |

### 2.4 可靠性 / 成本(C4 / C6 / C11 / C8 / C7)

| 項目 | 修改前 | 修改後 |
|---|---|---|
| 漂移偵測 | 144 個歷史 task id 淹沒真警報 | `driftBaselineIds` 基線豁免,每次 release 追加(v3.46.0) |
| Prompt 狀態注入 | handoff 存在卻回報「No handoff state found」,靜默誤導 | 三種 fail-loud footer 變體 + `resolveWorkspacePath()` 統一解析(v3.48.0) |
| 憲法雙重注入 | hook + prompt 同 session 各帶一份全文 | 兩層 dedup(記憶體旗標 + 120s sentinel 檔),實測每次去重省 1,505 ~tok(v3.48.0) |
| 角色中途被殺 | 無 §3 失敗寫入、resume 掉 model pin(無聲降級) | Crash-Resume Protocol(ground-truth 工作樹 → 重述 → 重申 pin)+ `dispatch_pins:` note 慣例(v3.53.0)。本次 C9 run 兩次實戰驗證(architect session-limit kill、QA 529)均無損復原 |
| 版本字面量 | 每次 release 都逼出 §2 測試所有權違規 | 動態版本斷言(讀 `package.json`)+ 窄 carve-out(v3.54.0) |

### 2.5 進行中(C9,本報告撰寫時於 QA 階段)

`pending_notes` 內的協定 token(`next_role:` / `resume_of:` / `review: APPROVED`)升為 handoff v7 第一級欄位,伺服器改驗 enum 而非 substring 比對;舊 token 轉為 inert。

---

## 3. 優缺點

### 優點

1. **漂移類缺陷被結構性消滅。** 閘門語意從三份手寫散文變成一個 typed registry + 生成式對偶測試 —— 改一處、測試逼你同步其餘。A5/A10/C12 這一類「文件說 A、程式做 B」的缺陷從「靠人審」變成「build 就紅」。
2. **信任邊界誠實化。** cut-approval、scope-decision、resume_of、external_refs 全部標明是「attestation(誠實聲明)」而非密碼學保證,且各自綁定唯一 sanctioned writer。誰能寫、憑什麼寫,第一次有了明確答案。
3. **事故驅動、閉環快。** C13(手改 handoff 卡死)07-08 發生、07-08 出貨修復;C8(crash 掉 pin)07-08 觀察、07-09 出貨、同日在 C9 run 實戰驗證兩次。backlog → spec → 閘門的回路約 24 小時。
4. **測試基數暴漲且生成式。** 601(06-26)→ 959+(07-09)。且新增的多為 parity/golden/behavioral-simulation 類,鎖的是「規則與程式的一致性」而非單點行為。
5. **每一筆節省都有實測數字。** A4 的 200 ~tok、C11 的 1,505 ~tok、governance-text-load 的 49 ~tok —— cap 一律「獨立重測、精確值入 test、附日期註解」,不信任 handoff note 的自報數字。

### 缺點

1. **治理文字淨成長,節省被吃掉。** 見 §5。strippers/dedup 是實打實的,但每張票都往憲法/skill 加字,常駐成本曲線仍向上。
2. **閘門複雜度本身成為攻擊面。** 20 個閘門、13 種 rejection、6+ 個 visual 子閘門 —— 新角色/新 IDE 接入的學習成本顯著上升;C12(registry 三個 doc-facing 欄位零消費者)證明結構化本身也會長出死資料。
3. **file-mode / SQLite 模式分岔加深。** cut_approved、external_refs、C9 三欄位全是 file-mode only;HTTP/SQLite 模式的治理保證持續落後,文件有標註但使用者未必讀到。
4. **規則以「補丁層積」方式演化。** §2 的 carve-out、§3.1 的六個 bullet、各 skill 的例外條款 —— 每條都有正當理由,但整體閱讀負擔已接近需要「第二次 A6/A7 式整併重寫」的臨界點。
5. **本體風險:server 改自己。** 本 repo dogfood 自己,C9 改的正是管本 workspace 的狀態機;跑中的 server 不會熱載新 dist,升級窗口內新舊語意並存(C9 架構 R2 風險已標)。

---

## 4. 修改原因

三個根因貫穿全部 18 張票:

1. **三份拷貝必然漂移**(A5/A10/A11/C12 類)—— 錯誤碼、憲法、skill 各寫一次,漂移只是時間問題。解法一律是「單一結構化來源 + 生成/對偶測試」。
2. **文字約束擋不住子代理邊界**(C1/C2/C13/B8 類)—— SOP 寫「必須人類核准」對一個在新 context 醒來的子代理毫無強制力;v3.48.0 手改 handoff 事故是直接證據。解法一律是「把約束下沉到 `tw_update_state` 寫入路徑」。
3. **context 是計費資源**(A4/A9/C11 類)—— 每 dispatch 7k–12k ~tok 的治理 bundle 直接乘在每個 subagent 的帳單上,strip/compose/dedup 都是對這條成本線的正面攻擊。

C 系列票全部來自 live run 的實際摩擦(非推測),這是本專案 backlog 品質最高的特徵:每張票都附「observed 日期 + 事故描述」。

---

## 5. Token 成本差異(實測)

### 5.1 每 dispatch 節省(修改直接帶來)

| 機制 | 版本 | 每次節省 |
|---|---|---|
| `stripOriginTags`(A4) | v3.44.0 | ~200 ~tok/dispatch |
| 憲法雙注入去重(C11) | v3.48.0 | 1,505 ~tok/去重命中(下限斷言 ≥1,200) |
| rationale 圍欄(governance-text-load) | 先前 | 49 ~tok/dispatch(量測後誠實下修,不硬湊 100) |

### 5.2 常駐預算淨變化(修改間接代價)

`test/context-budget.test.mjs` 歷史 cap 註解重建的 lean always-on bundle 軌跡:

```
2348 → 2528 → 2641 → 2791 → 2958 → 3030 → 3087 → 3332 → 3386 → 3491 → 3685 ~tok
(≈06-26)                                  (07-06)              (07-09, C9 re-baseline 中)
```

skill-pm stripped body 同期:2,800 → 3,377 ~tok。**三天 +20%、一個月 +57%**。每張票的閘門說明、Escalation Routes 表、attestation 條款都是字。目前實測(v3.54.0 工作樹):

| Bundle | ~tokens |
|---|---|
| teamwork(full coordinator) | 11,622 |
| pm | 9,964 |
| sr-engineer | 8,836 |
| qa-engineer | 8,491 |
| teamwork-lite | 7,227 |

### 5.3 每 feature 實際成本樣本(本次 C9 run 遙測)

| 角色 | subagent tokens | 備註 |
|---|---|---|
| pm | 139,985 | spec + 16 票切分 |
| architect | 193,806(58,642 crash + 135,164 resume) | session-limit kill 重跑一次 |
| sr-engineer(fable pin) | 201,750 | 112 tool uses |
| code-reviewer | 83,594 | |
| qa-engineer | 進行中 | 預估為最大單筆(52 個 re-baseline + 5 個測試票) |

**C9 至 QA 前合計 ≈ 619k subagent tokens。** 其中每個角色開場都吞一次 7k–12k 的治理 bundle;粗估治理文字佔每 feature 總成本 5–8%,而 crash 重跑(本次 58.6k)是單一最大浪費源 —— 這正是 C8 協定的價值所在,也是 B9(per-feature token 預算)該排進日程的理由。

---

## 6. 架構建議與看法

### 看法

1. **方向正確,且有罕見的證據紀律。** 「每個 cap 獨立重測、每張票附事故出處、每個節省有數字」在 agent 治理專案裡是稀缺品質。這套系統最有價值的產出不是省了多少 token,而是**把多代理協作的失敗模式一個個變成可回歸測試的資產**。
2. **治理文字的成長是結構性的,不是紀律問題。** 只要「加一個閘門 = 加一段散文」的等式成立,曲線就不會回頭。真正的解是讓散文從 registry 生成(C12 選項 a),把「第四份手寫拷貝」變成 render 產物 —— 這是我認為 backlog 裡槓桿最高的一張票。
3. **下一個能力斷層在「信任的機器化」。** 目前所有 attestation 都是誠實聲明。單機 file-mode 下這是對的取捨;但一旦 HTTP/SQLite 模式要承載多人,cut_approved 這類欄位需要至少 append-only 審計軌跡。建議在那之前不要投資密碼學方案 —— MVP-strict。

### 建議(與 backlog 既定順序一致,新增理由)

1. **C14(dispatch_pins 升欄位)最優先** —— 本次 run 中 pin 只靠每份 brief 手工重述存活,這是已實測命中的風險,且 C9 剛好把 v7 欄位模式做熱。
2. **C15(expected-red 機器清單)緊隨** —— 52 個 expected-red、reviewer 抽查 2 個,是本輪最大的未攔截面:mass re-baseline 可以洗白真 regression。成本幾乎純 content。
3. **C12 建議選 (a) 生成而非 (b) 斷言或 (c) 刪除** —— 理由見上;它同時是 token 曲線唯一的結構性解。
4. **B9 從 P2 提升關注** —— §5.3 顯示 per-feature 成本已可觀測、可預算化;round caps 管次數不管錢,619k/feature 的量級值得一個成本側斷路器。
5. **一年內做第二次整併重寫(A6/A7 精神)** —— 補丁層積的 §2/§3.1 例外條款正在逼近可讀性臨界點;等 C14/C15/C16 落地後統一整併一次,順便收割 token。
6. **SQLite 模式要嘛補齊閘門、要嘛在文件降級承諾** —— 目前「同一套憲法、兩種強制力」的狀態最容易產生錯誤安全感。

---

*報告完。基於 v3.54.0 工作樹 + C9 未合併變更;C9 出貨後 §5.2 的 cap 數字以 QA re-baseline 後的 `test/context-budget.test.mjs` 為準。*
