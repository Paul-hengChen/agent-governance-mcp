# Fan-out: prompt audit fixes（2026-11-18 prompt audit：E437→E438→E439→E440 ∥ E436＋E441）
base: 01093e1    integration branch: integ/prompt-audit-fixes
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-11-18。** 兩條 lane 都已合併進 `integ/prompt-audit-fixes`（e437 merge `562a530`、e436 `9293f60`，零衝突）、finish、拆除；派工 base `41c301e`（清單 PR #138 merge）；本波以一個 PR 合進 `main`，不發版。

範圍由人類指定（integrator prompt「fan-out E436–E442」，2026-11-18）。E442 已由人類在 2026-11-18 裁定維持原樣、結案、不改字（backlog 列 E442 開頭的 DONE 段），不進本波。各列的順序裁定（2026-11-18）：本波排在 v5.0.0 里程碑票（E422 起）之前，不屬於該里程碑；每張票都寫「no release of its own」→ 本波不發版，兩條合進 `integ/prompt-audit-fixes` 後一次 PR。

起點：`docs/prompt-audit-2026-11-18.diff` 各站點的 hunk（在 `a68704b` 對過、未套用）；lane 在 cut 時於派工 base 重核每個站點，並以「只套本票 hunk 後跑全套」的失敗清單為準（各列原文）。該 diff 裡 `content/const-01-core-head.md` 與 12 個 template 第 7 行的 `CRITICAL:` hunk 屬 E442（已裁定不改），任何 lane 都不套。

## 派工前核對（整合者，2026-11-18，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `01093e1`、工作樹乾淨；primary handoff 停在 `release-cd-v4.21.0`，drift 無（T-REL4-02、T-E421-01、T-E421-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`（每條 lane 的 cut 都在 lane session 呈人類）、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`、`artifacts` = `repo`。
- **E437–E440 必須同一條 lane、依序**：四張都改 `content/**`、都動全部 compose golden 與 `test/context-budget.test.mjs`（補充規則 §2 的共享生成物，一波只能歸一條 lane）；`content/skill-design-auditor.md`（E437／E438／E439）、`content/coord-03-core-fallback.md`（E438／E440）、`content/skill-qa-visual.md`（E437／E439）、`content/coord-02-host-dispatch.md`（E437／E440）重疊。
- **E441 的面**：只有 `tools/registry.ts` 第 648–981 行六段 description 與 `dist/tools/registry.*`。`test/` 沒有任何測試釘舊 description 字串（`MANDATORY FIRST ACTION`、`Read next uncompleted task`、`Check state vs tasks drift`、`Mark task uncompleted`、`never-should-have-existed`、`Atomic write handoff state` 全 repo 只在 `tools/registry.ts`、`dist/`、`docs/backlog.md`）；不在任何 golden。驗收的 guard 集合要讀 `guards/session.ts` 的 `enforcePreFlight` 呼叫點（只讀）。
- **E436 的面**：`CLAUDE.md` 第 13、220 行（另有第 44、64、195 行的簡寫，cut 時決定）、`templates/claude-code-agents/release-engineer.md` 第 9、13 行（第 7 行 `CRITICAL:` 屬 E442，不動）。不在 golden、不動 `content/**`。釘住它的測試與 E437–E440 有兩檔重疊——`test/subagent-templates.test.mjs`（E436：`e9a AC2`；E437 lite 文字、E440 AC4 fallback 句）、`test/feature-lease.test.mjs`（E436：S4；E438：S5）——依測試切（見所有權重劃）。讀 `CLAUDE.md` 的測試：`test/agc-adapters.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/e132-lane-registry.test.mjs`、`test/release-staging.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`（e391 也讀 `content/**` → 歸 e437）。
- **預算**：E437 的 `<agc install>/` 前綴加字；`test/context-budget.test.mjs` 多個上限自 E418 起零餘量（stripped constitution ≤ 9533、teamwork bundle ≤ 19225、non-design ≤ 7533、skill-pm stripped ≤ 4849）；E438、E439、E440 只會縮 → 待人類裁定 2。
- **未歸屬的已知項**（E437 列）：`test/render-structure.test.mjs`（追蹤的債務計數 3 個失敗）→ e437；`test/e234-hygiene-scan.test.mjs`、`test/e258b-comment-scan.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e299-check-bookkeeping.test.mjs` 在無 git 歷史的拷貝裡失敗、推定環境性 → 不劃給任何 lane，lane 在真 worktree 打紅 → 寄信。

### 人類裁定（Stage 2，2026-11-18：1 = a、2 = a、3 = a）
1. **lane 數**：(a) 兩條——e437（E437→E438→E439→E440 同一個 cut、依序，golden 由 qa 在最後一次重抓）∥ e436（E436＋E441 同一個 cut）（整合者建議：E436、E441 各只有一兩個檔，合一條省一個 session 與一次核准）；(b) 三條——e437 ∥ e436 ∥ e441。
2. **預算上限**：(a) e437 的 PM 把三張縮字的票排在 E437 之前或在 cut 裡以四張合計量測，lane 結束時合計仍超出的上限照 E336／E365 慣例重定到實測值、零餘量，PM 在 cut 附試套後的數字（整合者建議）；(b) 不動上限，壓縮其他字句抵銷。
3. **E436 的 `CLAUDE.md` 三處簡寫（第 44、64、195 行）與 template 第 9 行**：(a) 交給 e436 的 PM 在 cut 裡決定、隨 cut 呈你核准（整合者建議，列原文即如此）；(b) 現在裁定。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e437 | E437＋E438＋E439＋E440 | feat/e437-prompt-content-hygiene | ../agent-governance-mcp-lanes/e437 | `content/**`（`content/skill-release-engineer.md` 除外）、`templates/claude-code-agents/lite.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/subagent-templates.test.mjs`（`e9a AC2` 除外，歸 e436）、`test/feature-lease.test.mjs`（S4 除外，歸 e436）、`test/e408-core-task-alias-tail.test.mjs`、`test/e409-lite-write-tool-facts.test.mjs`、`test/teamwork-lite.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/design-auditor-volume-guard.test.mjs`、`test/widget-shape-spec.test.mjs`、`test/phase-0-5-sop.test.mjs`、`test/e226-integrator-sop-portable.test.mjs`、`test/e288-integrator-stage0.test.mjs`、`test/e355-integrator-generic-wording.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e407-restatement-citations.test.mjs`、`test/e130-lane-default.test.mjs`、`test/render-structure.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、其他只因 `content/**` 字句而紅、且不在 e436 擁有集的測試（PM 在 cut 逐檔列出，整合者預審時確認）、`test/e437-*.test.mjs`、`test/e438-*.test.mjs`、`test/e439-*.test.mjs`、`test/e440-*.test.mjs`（新，qa 定名）、`specs/e437-*.md`、`.current/e437/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`CLAUDE.md`；`content/skill-release-engineer.md`；`content/const-01-core-head.md` 第 20–32 行（E442 裁定不改）；`templates/claude-code-agents/`（`lite.md` 除外）；`tools/**`、`dist/**`、`guards/**`；e436 擁有的測試（打紅 → 寄信）；`docs/backlog.md` | 做：E437——列上 13 站不再引用只存在本 repo 的路徑（句子不需要就刪；agent 真的要開的檔用既有 `<agc install>/` 前綴）；`lite` template 給的 SOP 路徑在 adopter workspace 解析得到；`skill-qa-visual.md` 第 24 行的 FAIL note 不再寫 repo 專屬路徑。E438——約 43 個裸標籤包進既有 origin fence（cut 時重數），三處以 id 當名字的改名並同步所有引用；`coord-03` 的 `pre-v3.20.0` 句屬 E440。E439——11 段事故敘事移進 rationale fence，fence 外的句子自成完整規則；full-detail bundle 只多 fence 標記。E440——六句改寫為現行規則或刪除（鄰句已陳述時）；保留「舊 state 檔的 legacy 行 inert」類句子。四張一個 cut、依序；golden 由 qa 在最後重抓一次；預算照裁定 2。不做：E442 的任何站點、`tools/registry.ts`（E441）、adopter 路徑如 `specs/<feature>.md`（列外） | — |
| e436 | E436＋E441 | feat/e436-stale-paths-tool-contracts | ../agent-governance-mcp-lanes/e436 | `CLAUDE.md`（只限第 13、220 行與 cut 決定的第 44、64、195 行；`agc-version` stamp 不動）、`templates/claude-code-agents/release-engineer.md`（第 7 行除外）、`tools/registry.ts`（只限六個 tool 的 `description`）、`dist/tools/registry.*`、`test/e404-release-engineer-template.test.mjs`、`test/release-staging.test.mjs`、`test/e392-subagent-templates.test.mjs`、`test/subagent-templates.test.mjs`（只限 `e9a AC2`）、`test/feature-lease.test.mjs`（只限 S4）、`test/agc-adapters.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/e132-lane-registry.test.mjs`、`test/e395-claude-md-tail.test.mjs`、`test/e436-*.test.mjs`、`test/e441-*.test.mjs`（新，qa 定名）、`specs/e436-*.md`、`.current/e436/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**`；golden；budget；`guards/**`（只讀）；`tools/registry.ts` 的 schema、handler、zod；其他 `tools/**`、`dist/**`；其他 template；e437 擁有的測試（打紅 → 寄信）；`docs/backlog.md` | 做：E436——`CLAUDE.md` 第 13、220 行改成 `.current/_primary/handoff.md`（lane layout），第 44、64、195 行簡寫照裁定 3；release-engineer template 第 13 行改點 lane-scoped 路徑（對齊 `content/skill-release-engineer.md` 的 `.current/<lane>/handoff.md`），第 9 行改寫或不動由 cut 決定（第 13 行是 no-MCP 情況、保留）。E441——`tw_get_state`、`tw_get_next_task`、`tw_detect_drift`、`tw_rollback_task`、`tw_update_state`、`tw_void_task` 六段 description 改寫為契約（做什麼、回傳什麼、何時失敗），逐項對 handler 與 pre-flight guard 呼叫點核對；`tw_get_state` 列出的被擋 tool 與 guard 實際擋的完全一致；去掉 repo 專屬 spec 路徑與 ticket id。只改字串，不改行為、schema、錯誤碼。不做：template 第 7 行 `CRITICAL:`（E442）、其他 template、guard 行為 | — |

## 所有權重劃（相對於 lane-protocol 預設與補充規則）
- **共享生成物**（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部 → e437。e436 不動 golden、不動預算；它的改動不進任何 compose bundle（`CLAUDE.md`、template、tool description 都不在 golden）。
- **`test/subagent-templates.test.mjs` 依測試切**：`e9a AC2`（release-engineer template 的 no-MCP 段）→ e436；其餘（含 lite 相關斷言與 AC4 fallback 句）→ e437。**`test/feature-lease.test.mjs` 依測試切**：S4（release-engineer template 的 re-baseline 提示）→ e436；其餘（含 S5 `(E1)`）→ e437。兩檔各自的 hunk 相距遠，預期 git 自動合併；同一 hunk 兩邊都改 → 屬改劃錯誤、停。
- **`dist/**`**：只有 e436 的 `dist/tools/registry.*` 會變；e437 不動 `tools/` → 它的 `dist/` 重建應零差異，有差 → 寄信。
- **`CLAUDE.md`、`tools/**`** 在 lane-protocol 預設的共同禁止外另行劃給 e436（只限上表範圍）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `CLAUDE.md` 第 13、220 行指向實際存在的 handoff 路徑；三處簡寫照裁定 3 處理 | e436（E436） | ✓ |
| release-engineer template 第 13 行指向 lane-scoped 路徑，與 SOP 一致；第 9 行照 cut 決定 | e436（E436） | ✓ |
| 列上 13 站不再引用只存在本 repo 的路徑；需開的檔帶 install 前綴；`lite` template 的 SOP 路徑在 adopter workspace 可解析 | e437（E437） | ✓ |
| 任一 composed bundle 不含列上站點的 ticket id／版本標籤；源檔標籤仍在 fence 內；三處改名與引用同步 | e437（E438） | ✓ |
| dispatch bundle 不含 11 段事故敘事、每條規則仍是完整指令；full-detail bundle 只多 fence 標記 | e437（E439） | ✓ |
| 六句改為現行規則或刪除；legacy-inert 句保留 | e437（E440） | ✓ |
| 六段 tool description 寫明回傳與失敗情況、每項都在 handler 裡存在；`tw_get_state` 的被擋清單 = guard 實際擋的 | e436（E441） | ✓ |
| compose golden 在 e437 最後重抓一次並逐 hunk 說明；預算照裁定 2 在上限內 | e437（qa） | ✓ |
| 每條 lane `dist/` 只含自己原始碼的產物、`npm audit --audit-level=high` exit 0、`check:bookkeeping` exit 0 | 全部 lane（qa 核對） | ✓ |
| 六張 done-mark（not yet released） | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序見下；每次 merge 後 `node scripts/merge-invariants.mjs`。
- 合併後 `npm run build`、`dist/` 無差異；`capture-constitution-golden.mjs` 對合併樹 byte-identical（只有 e437 動 golden）；預算在上限內。
- 記帳：六列 done-mark；`npm run check:bookkeeping` exit 0。
- 接線票：無。

## 合併順序
1. `integ/prompt-audit-fixes` 自派工 base 開。
2. ← `--no-ff` e437（共享生成物 lane 先）→ merge-invariants。
3. ← `--no-ff` e436（`test/subagent-templates.test.mjs`、`test/feature-lease.test.mjs` 同一 hunk 兩邊都改 → 停）→ merge-invariants。
4. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
5. 依序 `finish <lane> --shipped --base integ/prompt-audit-fixes`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/prompt-audit-fixes`。不發版。

## 結案
- 日期 2026-11-18。`integ/prompt-audit-fixes` 自 `main` `41c301e` 開；← `--no-ff` e437 `7626d5c`（merge `562a530`）、e436 `4f1ac81`（merge `9293f60`），兩次零衝突（`test/feature-lease.test.mjs`、`test/subagent-templates.test.mjs` 由 git 自動合併，兩邊原樣保留，非實質解決）→ 無合併審查；merge-invariants 兩次 PASS；合併樹 `npm run build` 後 `dist/` 無差異、`capture-constitution-golden.mjs` 無差異、context-budget 54/54、`npm audit --audit-level=high` exit 0、`agc check` OK（4.21.0）。
- 彙總（上限按 lane 計，全部在上限內、證據與帳本一致）：e437 13 task／hop 4/14／review 0 退回／qa 0；e436 5 task／hop 4/14／review 0 退回／qa 0。合計 18 task、8 hop。
- 完成定義：表中「同一波 ✓」的列全部成立。E439 的 const-11 §3.2 前言依人類裁定 R1 = b 刪除（故事留在 `content/constitution-rationale.md`），full-detail bundle 少該段，是 E439 full-detail 驗收的唯一例外。
- 記帳：`docs/backlog.md` 六列 done-mark（not yet released）；佇列 `docs/v4.0.0-new-tickets.md` 六列 DONE；`check:bookkeeping` OK。新票：無（兩條 lane 都沒有 pending-tickets）。接線票：無。
- 不開票的觀察（reviewer／qa 的 recommended、optional）：e436——`tw_get_state` 描述沒寫閒置 1 小時後 guard 再擋（BLOCKED 訊息自帶恢復指示，base 亦未寫）、`tw_update_state` 並非每種拒絕都以 ⛔ 開頭（引數驗證走 ❌，BLOCKED／STATE DRIFT 帶 `Error:` 前綴）、`tw_get_next_task` 第一列的 `isCheckpoint` 是 null、`tw_detect_drift` 在 file mode 讀取時仍可能遷移 lane layout；e437——`content/skill-sr-engineer.md` 的 AC6 escape 是 base 既有的 id 當名稱、一個 qa commit 標題漏寫 E438、`agc check` 註解 advisory（三個新測試檔開頭註解 9–11 行，超過 7 行上限；不影響 exit code）。
- 給下次發版的 CHANGELOG 提示：出貨的規章、SOP 與 lite 範本不再引用只存在本 repo 的路徑（需要開的檔帶 `<agc install>/`，lite 子 agent 的 SOP 路徑在 adopter 端可解析）；票號與版本標籤包進 origin fence、事故敘事進 rationale fence，派發 bundle 變小；六句「相對舊版」的規則改寫成現行規則；六個 tool description 改寫為對過 handler 的契約（每次 `tools/list` 約多 340 token），`tw_void_task` 兩個與程式不符的說法修正；`CLAUDE.md` 與 release-engineer 範本的 handoff 路徑改為 lane 形式。無新 gate、無新錯誤碼、無 schema 變更；context-budget 上限重定（lean 5731→5761、design-only 下限 1999→1903，其餘收緊）→ 建議 MINOR。

## Dispatch pins
- e437：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e436：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-18 | 人類 | 本波範圍：E436–E442；E442 已裁定維持原樣、結案、不改字，不進本波；六張排在 v5.0.0 里程碑票之前、不屬該里程碑；各票不單獨發版 | integrator prompt「fan-out E436–E442」；`docs/backlog.md` E436–E442 列 |
| 2026-11-18 | 整合者 | Stage 1 核對：E437–E440 同一條 lane、依序（共享生成物與四個 content 檔重疊）；E441 無測試釘舊 description、不動 golden；E436 與 e437 在 `test/subagent-templates.test.mjs`（`e9a AC2`）與 `test/feature-lease.test.mjs`（S4）依測試切；diff 裡屬 E442 的 hunk 一律不套 | 本檔 |
| 2026-11-18 | 人類 | 核准清單與待人類裁定 1–3（回覆「approve」，對應整合者呈報的「全部照建議就回 approve」）：1 = a（兩條 lane：e437 ∥ e436）、2 = a（預算：縮字票先排或合計量測，合計仍超出則照 E336／E365 慣例重定到實測值、零餘量，PM 在 cut 附數字）、3 = a（`CLAUDE.md` 三處簡寫與 template 第 9 行由 e436 的 PM 在 cut 決定、隨 cut 呈核），含本檔所有權重劃；寫進各 lane 的 spec，lane 不再問 | 整合者 session |
| 2026-11-18 | 整合者 | 清單 PR #138 merge `41c301e` = 派工 base（docs branch 已刪；樹與 PR head `c212da4` 相同，CI run 44235483543 綠，Node 20／22）；派工前核對在 `41c301e` 重做：擁有集裡的既有檔都 tracked、標為新建的檔都不存在、兩條 lane 的 branch 與 `.current/<lane>/` 都不存在；`npm run build` 後工作樹乾淨、`agc check` OK（4.21.0）；信箱 `_mailbox/{e437,e436}/` 建為空、watch armed baseline 全 0、`lane-status --watch` 已掛；兩份 prompt 由 `fanout.mjs render --base 41c301e` 產生 | 整合者 session |
| 2026-11-18 | 整合者 | 改劃（e436 cut 預審）：清單的 feature-lease「S4」原意是 release-engineer template 的測試，PM probe 的紅燈是同檔 `E9A-S4`；`test/feature-lease.test.mjs` 中所有讀 `templates/claude-code-agents/release-engineer.md` 的測試（`S4 [E404 re-pin]`、`E9A-S4`、`E9A-S5`、`E17-S3`、`E17-S4`）→ e436，其餘（含 coord-03 的 S5）→ e437 | 信箱 e436 to-lane#1、e437 to-lane#2 |
| 2026-11-18 | 整合者 | e436 cut 預審 close（spec `a636215`，to-integrator#1–#2；初版 `96ecf18` 缺 `## Cut` 段退回）：5 task（3 sr、2 qa）、check --cut 9 token 0 越界、每個 AC 有實作 task；同意 D1（`CLAUDE.md` 第 44、64、195 行改 `.current/<lane>/handoff.md`）、D2（template 第 9 行改寫點名兩段重複）；`tw_get_state` 被擋清單 = `enforcePreFlight` 六個呼叫點；`tw_void_task` 兩個與程式不符的舊說法隨之修正；六段 description 1151→2492 字元（約 +340 token），請 lane 呈人類時明列；probe 5 紅全在擁有集、無跨 lane 紅燈 | 信箱 e436 to-lane#2 |
| 2026-11-18 | 整合者 | e437 cut 預審 close（spec `8cede30`，to-integrator#3）：13 task（8 sr、5 qa）、check --cut 53 token 0 越界、每個 AC 有實作 task；E438 重數 45（稽核 41＋cut 4）、4 處改名、lite 定義句、5 個上限收緊到實測值都同意；改劃：`test/compose-equivalence.test.mjs`、`test/skill-manifest.test.mjs` → e437（golden 比對，只靠重抓轉綠、檔不改）。needs human ruling 交 lane 呈人類：R1（const-11 §3.2 前言 vs AC7 §3.x 無 fence 不變量）整合者建議 (b) 刪段、PM 建議 (a) fence＋重釘；R2（design-only saving 下限 1999→約 1903）整合者與 PM 都建議 (a) 重定到實測值 | 信箱 e437 to-lane#3 |
| 2026-11-18 | 人類 | 在 e436 lane session 核准 cut（`specs/e436-stale-paths-tool-contracts.md` @ `a636215`，含 D1、D2 與 description +340 token 的成本）；coordinator 寫 cut_approved，sr（opus）派 T-E436-01、T-E436-02、T-E441-01。只影響 e436、已寫在核准的 spec 裡 | e436 lane session；信箱 e436 to-integrator#3 |
| 2026-11-18 | 人類 | 在 e437 lane session 核准 cut 並裁 R1 = b（刪 const-11 §3.2 前言段，§3.x 維持無 rationale fence，不重釘 AC7 ×2 與 AC2/AC4；full-detail bundle 少該段，偏離 E439 full-detail AC 一處，人類同意）、R2 = a（design-only saving 下限重定到實測值）；裁定記入 `specs/e437-prompt-content-hygiene.md` @ `420bf1f`（相對預審 close 的 `8cede30` 只改裁定相關的列），coordinator 寫 cut_approved，sr（opus）依序派 T-E437-01 起。只影響 e437、已寫在核准的 spec 裡 | e437 lane session；信箱 e437 to-integrator#4 |
| 2026-11-18 | 整合者 | e436 lane 層驗證 close（to-integrator#6）：HEAD `4f1ac81`，8 commits，hop 4/14，review 1 輪核准、qa 0 輪（第一次 PASS 寫入因缺 `## Expected-Red Diff` 段被拒、補齊後通過）；fanout check 23 檔 0 越界；證據 `qa_reports/review_T-E436-01..03.md`、`review_T-E441-01..02.md` PASS（suite-result 4236/4238）、`review_reports/review_T-E436-01.md` APPROVED r1（covers 三個實作 task）；ledger 5/5；worktree porcelain 空；無 pending-tickets；`dist/` 只 registry 三檔；content、golden、budget 未動；整合者 push 後 CI run 44251441572 在 `4f1ac81` 綠。review R1（`tw_get_state` 描述沒寫閒置 1 小時後 guard 再擋，BLOCKED 訊息自帶恢復指示、base 亦未寫）、O1（`tw_update_state` 並非每種拒絕都以 ⛔ 開頭）、O2（第一列 `isCheckpoint` 是 null）、O3（`tw_detect_drift` file mode 讀取時仍可能遷移 lane layout）列入結案報告、不開票 | 信箱 e436 to-lane#4 |
| 2026-11-18 | 整合者 | e437 lane 層驗證 close（to-integrator#7）：HEAD `7626d5c`，22 commits，hop 4/14，review 1 輪核准、qa 0 輪；fanout check 57 檔 0 越界、禁止清單無命中；證據 `qa_reports/review_T-E437-03.md`（covers 13 id，suite-result 4318/4320）、`review_reports/review_T-E437-01.md` APPROVED r1（covers 8 個 build task）；worktree porcelain 空；無 pending-tickets；`dist/` 零差異；12 golden 一次重抓（20 hunk 全歸屬）；預算 lean 5731→5761、skill-pm 4849→4791、skill-sr 2852→2816、design-arm 9533→9387、teamwork 19225→19012、non-design 7533→7484、design-only 下限 1999→1903；整合者 push 後 CI run 44257018320 在 `7626d5c` 綠。optional（`skill-sr-engineer.md:29` 的 AC6 escape 是 base 既有 id 當名稱；bb11826 標題漏寫 E438；`agc check` 註解 advisory：三個新測試檔開頭註解 9–11 行超過 7 行上限）列入結案報告、不開票 | 信箱 e437 to-lane#4 |
| 2026-11-18 | 整合者 | 合併：`integ/prompt-audit-fixes` 自 `main` `41c301e` 開，← `--no-ff` e437 `7626d5c`（merge `562a530`）、e436 `4f1ac81`（merge `9293f60`），兩次零衝突（兩個依測試切的測試檔由 git 自動合併，非實質解決）→ 無合併審查；merge-invariants 兩次 PASS；合併樹 `npm run build` 後 `dist/` 無差異、golden capture 無差異、context-budget 54/54、`npm audit --audit-level=high` exit 0、`agc check` OK | 本檔 |
| 2026-11-18 | 整合者 | 記帳：`docs/backlog.md` E436–E441 六列 done-mark（not yet released，附 merge sha 與證據路徑）；`docs/v4.0.0-new-tickets.md` 佇列六列 DONE；兩條 lane 無 pending-tickets、不開新票；`check:bookkeeping` OK；彙總 18 task、8 hop、review／qa 皆 0 退回 | 本檔 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 41c301e
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/prompt-audit-fixes @ 5a405eb）
- lane-status：primary（main ← integ/prompt-audit-fixes @ 5a405eb）release-cd-v4.21.0／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 本波 2 條 lane、6 張票（E437＋E438＋E439＋E440、E436＋E441）全部 qa PASS、合併、finish；E442 已由人類裁定維持原樣，不在本波。lane 紀錄在 `.current/history/2026-11/{e437,e436}/`；判定與驗證細節在本檔 Decisions 與結案段。新發現：無（兩條 lane 都沒有 pending-tickets）；無未配號的新發現。
### 待人類決定
- 是否發版：本波改了出貨的規章與 SOP 字句、六個 tool description、context-budget 上限，無新 gate／錯誤碼／schema，整合者建議 MINOR；CHANGELOG 提示見結案段。
- 是否開下一波：由人類決定。
### 進行中的背景工作
無
