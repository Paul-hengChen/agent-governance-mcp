# Fan-out: prompt audit fixes（2026-11-18 prompt audit：E437→E438→E439→E440 ∥ E436＋E441）
base: 01093e1    integration branch: integ/prompt-audit-fixes
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准 2026-11-18，派工中。**

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

## Dispatch pins
- e437：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e436：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-18 | 人類 | 本波範圍：E436–E442；E442 已裁定維持原樣、結案、不改字，不進本波；六張排在 v5.0.0 里程碑票之前、不屬該里程碑；各票不單獨發版 | integrator prompt「fan-out E436–E442」；`docs/backlog.md` E436–E442 列 |
| 2026-11-18 | 整合者 | Stage 1 核對：E437–E440 同一條 lane、依序（共享生成物與四個 content 檔重疊）；E441 無測試釘舊 description、不動 golden；E436 與 e437 在 `test/subagent-templates.test.mjs`（`e9a AC2`）與 `test/feature-lease.test.mjs`（S4）依測試切；diff 裡屬 E442 的 hunk 一律不套 | 本檔 |
| 2026-11-18 | 人類 | 核准清單與待人類裁定 1–3（回覆「approve」，對應整合者呈報的「全部照建議就回 approve」）：1 = a（兩條 lane：e437 ∥ e436）、2 = a（預算：縮字票先排或合計量測，合計仍超出則照 E336／E365 慣例重定到實測值、零餘量，PM 在 cut 附數字）、3 = a（`CLAUDE.md` 三處簡寫與 template 第 9 行由 e436 的 PM 在 cut 決定、隨 cut 呈核），含本檔所有權重劃；寫進各 lane 的 spec，lane 不再問 | 整合者 session |
