# 自動化流程中每個 Skill 的職責、技術做法與 Token 消耗（中文）

> Researcher findings。Depth: **shallow**（standalone 預設，未啟動 `/deep-research`）。
> 方法：直接讀本 repo 的 `content/skill-*.md` + `content/constitution.md` + `prompts/build.ts`，並以本專案的 `scripts/measure-context-cost.mjs`（chars/4 近似）量測注入 token。
> Date: 2026-05-31。所有 token 為 **~近似值**（chars/4）；固定注入為實測，工作區間為推估（含 input + tool 結果 + output）。

## Summary

- **注入機制**：auto-flow（`/teamwork`）中 **constitution 只在鏈起點注入 1 次**（~2366 tok 完整版；起始 `/teamwork` prompt 連同 coordinator skill 共 ~3516）。之後每個 `tw_switch_role` hop **只回傳該角色的 skill SOP**，不重載 constitution（見 [[token-burn-mitigations-zh]]）。
- 因此每個角色的 **token 最低值 ≈ 它的 skill SOP 注入量**（auto-hop floor）；**最高值**由「讀檔（每目標上限 3 次）+ RAG spec 注入（top-5 chunks）+ 重試迴圈（qa_round≤3 / review_round≤3 / visual_round≤5）+ 產出文件大小」共同推高，理論上無硬上限。
- **最省的角色**：sr-engineer skill SOP 僅 ~766 tok（floor 最低）；**最貴的固定注入**：qa-engineer ~1998、design-auditor ~1936、pm ~1708。
- **實際工作最燒**的通常是 **design-auditor / sr-engineer / qa-engineer**——因為它們會做**多模態圖片讀取**、**多檔讀取**、以及**重試迴圈**。
- **單純治理開銷**（每 hop 的 `tw_get_state`/`tw_detect_drift`/`tw_update_state`）很小（每次 ~100–600 tok），但 drift 列表大時 detect_drift 會膨脹（已由 `tools/drift.ts` 壓縮）。

## Evidence

固定注入量（實測 `scripts/measure-context-cost.mjs`，chars/4）：constitution 完整 **2366** / lite-lean **1489**；skill SOP 各值見下表「注入 floor」欄。[repo]

### 逐一列舉：每個 Skill 的職責 / 技術做法 / Token 區間

| 角色 | 做什麼（SOP 核心） | 技術與做法（工具） | 注入 floor (~tok) | 工作區間 (~tok, 推估) | 推高最高值的因子 |
|---|---|---|---|---|---|
| **coordinator** (`teamwork`) | 分類意圖 → Routing Table + Complexity Scope Gate + 設計稿偵測；auto-routing hop 迴圈（≤10）；起點做 `tw_get_state`/`detect_drift` | `tw_get_state`/`tw_detect_drift`/`tw_switch_role`、`printenv AGC_AUTO_ROUTE` | 1149（起點含 constitution ~3516） | 1.5k–4k | 為偵測設計稿而讀 PRD/附件 |
| **researcher** | 調查→`research/<topic>.md`（Findings Schema + 來源 tier + recency gate）；shallow（web/檔案，≥3 源/≥2 tier）或 deep（opt-in，先警告成本才跑 `/deep-research`） | `WebSearch`/`WebFetch`、`Read`、`/deep-research` skill | 959 | **shallow 5k–25k**；**deep 100k–>1M**（harness） | deep harness（數十~上百子代理）；web fetch 數量 |
| **design-auditor** | 偵測設計來源 mode → **逐字萃取** Copy/Strings + Visual Tokens + Visual Widgets（+選擇性 Visual Baselines）入 `design/<feature>.md`；widget-shape 啟發式；≤250 行/pass、≤5 pass；Source manifest | Figma/Sketch/XD/Penpot **MCP**、`Read`（圖片→多模態）、OCR（脆弱→請使用者確認） | 1936 | **3k–40k+** | Figma JSON（可達 5–20k）、多模態圖片讀取、最多 5 passes |
| **pm** | 寫 `specs/<feature>.md`（Problem/User Stories/AC(BDD)/Copy/Visual Tokens/Visual Widgets/Out-of-scope/Deps）；Resource Audit Gate；Question Batch Gate（1 次 `AskUserQuestion`）；逐筆 `tw_add_task` | `AskUserQuestion`、`tw_add_task`、`grep`、`tw_update_state` | 1708 | 4k–15k | 讀 research/design 產物、spec 篇幅、任務數 |
| **architect** | 寫 `specs/<feature>-architecture.md`（Affected Files/Data Structures/Interface Contracts/mermaid Sequence/Decision Records/Deferred Resources/Visual Harness/Open Questions）；四道 gate（ambiguity/external-ref/visual-harness/open-questions→block） | `Read`（spec + 既有原始碼）、`tw_update_state` | 1083 | 4k–15k | 讀多個原始碼檔、藍圖篇幅 |
| **sr-engineer** | 實作；**Design-Aware Pre-Flight**（有設計檔則完整讀 design + Visual Widgets + Baselines 路徑）；Task-Size 檢查（≤5 檔/300 行）；`tsc`/lint 零錯；安全清單；build + 依賴稽核 | `Edit`/`Write`、`Bash`（tsc/build/`npm audit`）、`Read` | **766**（最低 floor） | **3k–50k+** | 設計檔/圖片讀取、多檔讀取（每目標≤3）、build log、code-review/QA 退回重做 |
| **code-reviewer** | **乾淨脈絡**對抗式審 diff（只讀 git diff + spec + arch，不讀 sr-engineer 註解）；七段報告（Summary/Correctness/Quality/Architecture/Security/Performance/Verdict）；APPROVED / CHANGES_REQUESTED；`review_round` | `git diff`、`Read`、`Write` `review_reports/`、`tw_update_state` | 1067 | 4k–25k | diff 大小、spec/arch 篇幅、多輪 review |
| **qa-engineer** | Phase 0 claim → Phase 1 審查（Copy Audit Gate + Visual Audit Gate）→ Phase 1.5（有 Baselines 才 lazy-load qa-visual）→ Phase 2 討論（≤3 輪）→ Phase 3 測試（spec-to-test map、≥80% 覆蓋、安全 smoke）→ Phase 4 跑測 + PASS/FAIL + `tw_complete_task` | `Read`、`Write`（測試 + `qa_reports/`）、`Bash`（`npm test`）、`tw_complete_task`/`tw_rollback_task` | **1998**（最高固定注入） | **4k–60k+** | 測試檔撰寫、`npm test` log、Phase 1.5 多模態圖片、qa_round≤3 + visual_round≤5 重讀 |
| **qa-visual**（子技能，被 qa lazy-load） | Step A widget-shape 勾選清單 + Step B 逐 baseline 像素 diff（多模態讀 baseline+impl 圖，6 類差異）；寫 `qa_reports/visual_<id>.md`（PASS gate） | `Read`（圖片→多模態）、`tw_update_state` | +1125 | 每 surface +3k–5k | baseline×impl 圖片數、surface 數 |
| **doc-writer**（side-channel，PASS 後） | 同步 `README`/`CHANGELOG`/`docs/**`；fact-preservation；不改 source/spec | `Read`、`Edit`、`grep`、`tw_update_state`（agent_id=上游） | 709 | 3k–12k | 讀 specs + grep 過時引用 + 文件改動量 |
| **release-engineer**（side-channel，PASS 後） | semver bump（package.json/index.ts）+ CHANGELOG + README pins；build+test+check-version；commit(HEREDOC)+tag+push；`gh release` | `Edit`、`Bash`（build/test/`git`/`gh`）、`tw_update_state`（agent_id=qa-engineer） | 1364 | 5k–15k | build/test log、git/gh 輸出 |

### 治理開銷（每個角色共通）

- `tw_get_state` ~100–300 tok；`tw_detect_drift` ~150 tok（drift 列表大時膨脹，已由 `tools/drift.ts` 壓縮，省 ~500/次）；`tw_update_state` ~100–400 tok（`pending_notes` 由 `tools/handoff.ts` 字元預算截斷）。[repo]
- HTTP/SQLite 模式：非 coordinator 角色的 prompt 會額外注入 **RAG spec context（top-5 chunks，每 chunk ≤2048 字元≈512 tok，上限 ~2.5k）**（`prompts/build.ts` `appendSpecContext`）。[repo]

## Recommendation

**以「注入 floor（固定、可預測）」+「工作區間（變動、由迴圈與讀檔主導）」兩層看待每角色成本，最佳化優先序：**

1. **控制重試迴圈**（最高槓桿）：qa_round/review_round/visual_round 的每一輪都會重讀 spec/design/code 並重跑測試——這是 sr-engineer/qa-engineer 工作區間衝到 50k–60k 的主因。把 PM 的 AC 寫精確、code-reviewer 一次到位，能直接砍掉重試輪數。
2. **design-auditor 的多模態圖片讀取**：每張圖進多模態脈絡成本高；維持 ≤250 行/pass、≤5 pass 的既有上限，並只讀 task 觸及的 surface。
3. **固定注入已最佳化**：constitution 已對 lite 剝離（−31%，v3.16.2）；chain 角色靠 1× constitution + per-hop skill SOP（已是 amortized 設計），再壓縮空間有限。
4. **善用 prompt caching**：同一角色連續來回（如 sr-engineer↔code-reviewer 迴圈）若前綴穩定可吃快取。

## Alternatives Considered

- **重跑 `/deep-research` 做這份報告**：*否決*。資料全在本 repo（skill 檔 + 量測腳本），shallow 直接合成即可,符合 token 節省。
- **用真實 tokenizer 取代 chars/4**：*否決（此次）*。chars/4 對「相對比較與量級」已足夠且零依賴；精確值待有 tokenizer 時再校準。

## Open Questions

- **工作區間是推估**：固定注入為實測（chars/4），但「最高 token」隨任務內容、檔案大小、重試輪數變動，無硬上限；表中區間為量級推估，非保證上界。
- **chars/4 偏差**：中文/程式碼 token 密度與英文散文不同，實際值可能 ±30%。
- **多模態圖片 token**：design-auditor / qa-visual 讀圖的實際 token 取決於圖片解析度與張數，未在本輪精確量測（需實跑帶圖任務）。
- **prompt caching 命中率未量測**：迴圈來回是否吃到快取，取決於 harness，未實測（同 [[token-burn-mitigations-zh]] 的 Open Question）。
