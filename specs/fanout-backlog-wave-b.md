# Fan-out: backlog wave B（wave A 之後第二波：E262＋E355＋E360＋E340 ∥ E196＋E225＋E353＋E205 ∥ E359＋E376＋E172 ∥ E406＋E203）
base: e8e11da    integration branch: integ/backlog-wave-b
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准 2026-11-09，派工中。**

範圍由人類指定（integrator prompt「fan-out：backlog wave B（wave A 之後的第二波），共 13 張，四條 lane」，2026-11-09）：wave A 清單 `specs/fanout-backlog-wave-a.md`「Wave B」段的 13 張。本波不發版：四條合進 `integ/backlog-wave-b` 後一次 PR。

人類已裁定、lane 不再問：E340 走 SOP 例外、不做工具（列開頭「Scope ruled 2026-11-09 (triage)」段是 cut 依據）。wave A 留給本波：E355 那條 lane 一併重寫 `content/skill-integrator.md:156` 的 flake rule 家族清單，並評估 wave A 記下的兩個負載敏感候選（`test/e108-eject.test.mjs` AC7、`test/verify-release.test.mjs` VR-20；CI 都綠、未開票）。

## 派工前核對（整合者，2026-11-09，規劃時；派工時在派工 base 重做一次）
- `git worktree list` 只有 primary；`main` = `origin/main` = `e8e11da`；工作樹乾淨；primary handoff 停在 `release-cd-v4.19.4`，drift 無（T-REL4-02 是舊 feature 的 evidence-backed 標記，照 drift 訊息不 sync）。`.current/.config.json`：`cutApprovalAutoTier` = `{}`、`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`、`artifacts` = `repo`。`npm run build` 後工作樹乾淨、budget 測試 54/54 綠。
- **預算重量**（wave A 量的數字，之後只動 rationale 內與 qa SOP，不影響下列五項）：skill-pm stripped 4847 / 4849、lean 5665 / 5723（餘 58）、stripped constitution 10451 / 10598（餘 147）、non-design 8452 / 8501（餘 49）、teamwork bundle 21526 / 21715（餘 189）。
- **E340 的面**：`content/const-05-core-standards.md:17` 那一條在 11 個 compose golden（`skill-coordinator-monolith.txt` 以外全部）與 lean／non-design／stripped／teamwork 四個預算裡；釘住原句的是 `test/e130-lane-default.test.mjs:217`（AC9，`/Do NOT hand-edit the task-list file from a role\./`）。一句例外約 60–80 token，**預期超出 lean（餘 58）與 non-design（餘 49）上限** → 待人類裁定 5。
- **E360 的面**：`content/skill-qa-visual.md:88-91,93` 五列 FAIL 呼叫都沒有 `review_task_ids`（qa SOP 第 107 行的格式句要求有）。qa-visual 不在任何 compose golden、不在 `test/context-budget.test.mjs`；只有 `test/qa-visual-skill-split.test.mjs` 的 20700 bytes 上限（現 17024）。列寫的「goldens and context budget re-baselined」在本 repo 不會發生。
- **E262 的面**：`content/skill-integrator.md:117` 與 `docs/lane-protocol.md:101`（§5 規則 2）；釘住的是 `test/e178a-integrator-role.test.mjs:300,323`。skill-integrator 不在任何 golden 或預算。
- **E355 的面**：`content/skill-integrator.md` 第 142 行（`ci.yml` 觸發 `feat/**`）、第 151、164 行（root `NEW-TICKETS.md`）、第 156 行（flake rule：「listed as load-sensitive in `docs/backlog.md` (the E238 / E254 / E278 family)」）、第 175 行（重啟 primary MCP server）、第 142、156 行（`npm test`）；補充規則在 `docs/lane-protocol-addendum.md`（§4 已有 `NEW-TICKETS.md` 退役一行、§5 已有 test-lock 一行）。E349 先例的測試是 `test/e349-integrator-repo-facts.test.mjs`、`test/e226-integrator-sop-portable.test.mjs`。兩個候選：`test/e108-eject.test.mjs`（AC7 有第 380、568 行兩個）、`test/verify-release.test.mjs:851`（VR-20）。
- **E225＋E353 的面**：同一缺陷（E353 是 E225 的重述）。`bin/agc-init.mjs:758` orphan 偵測用兩參數 `parsePendingTickets(...).entries`，壞 block 進 `errors` 被略過；parser 在 `tools/lane-ticket-allocation.ts:389`；finish 的解析在 `bin/agc-init.mjs:2099,2334`。文件面是 `docs/lane-protocol.md` §4（第 55–74 行）／§6（第 114–132 行）的收工檢查。
- **E196 的面**：`bin/agc-init.mjs:2624` `laneIgnoredStateFiles`、`:2650-2711` alreadyClosed 判定、`:2876` 重跑的 re-harvest、`:3103` `applyPendingOnAbandoned`、`:3211` `runFeatureFinish`。
- **E205 的面**：`bin/agc-init.mjs:1528` `runFeatureStart`（拍快照）、`:3211` `runFeatureFinish`（比對）；快照若是新的 lane 檔名，依 CLAUDE.md 只能經 `tools/lane-paths.ts`。
- **E359 的面**：拒絕訊息在 `tools/tasks-file.ts:548` 與 `tools/storage-sqlite.ts:770` 兩處（file 與 SQLite 各一）；測試 `test/e117-void-task.test.mjs`。
- **E376 的面**：`prompts/build.ts:139` `renderHandoffStateBlock`（`:489` 呼叫）；`dispatch_mechanism_tier` 在 golden 裡只出現在 `skill-coordinator-monolith.txt` 的 SOP 散文，**不是**即時狀態 → 預期不動任何 golden（lane 跑 capture 確認 byte-identical）。既有測試 `test/e184-get-state-omits-tier.test.mjs`、`test/e137-render-sanitise.test.mjs`。
- **E172 的面**：`index.ts:58-70` `resolveWorkspacePath`（`~`、`~/` 兩支）；測試 `test/prompt-state-footer.test.mjs`。
- **E406 的面**：`scripts/release.mjs:51` `STAGE_PATHS`、`:607-639` staging 與 `STAGING_INCOMPLETE`；`content/skill-release-engineer.md:80` 的 exit 30 列在新語意下仍成立（規劃的路徑沒 stage 進去仍是 exit 30），預期不動 content。
- **E203 的面**：`tools/merge-invariants.ts:331` `unionReconciliationFailures`；列寫「spec change first」→ `specs/e126-merge-invariants.md`；測試 `test/e126-merge-invariants.test.mjs`。

### 待人類裁定（Stage 2，2026-11-09）
1. **E359 修法**：(a) 只改 void 拒絕訊息（`tools/tasks-file.ts:548`、`tools/storage-sqlite.ts:770`）點名配對的 qa FAIL 寫入（整合者建議）；(b) `tw_rollback_task` 從 handoff 帳本移除 id。
2. **E205 的反應**：(a) `feature finish` 兩種 disposition 都只警告、點名新路徑、exit code 不變（整合者建議）；(b) 拒絕 finish。
3. **E225＋E353 的方向**：(a) 做 (1) lane 端驗證入口＋lane-protocol §6 一行、(2) orphan 偵測對壞 block 警告；不做 (3) 5a 改寫（整合者建議）；(b) 三個都做，5a 那句由整合者合併後記帳補。
4. **E355 的兩個負載敏感候選**：(a) 列進補充規則的負載敏感清單、不改測試（整合者建議）；(b) e262 由 qa 去耦兩個測試；(c) 不處理、不列。
5. **E340 的預算**：(a) 照 E336／E365 慣例把超出的上限重定到實測值、零餘量，PM 在 cut 附數字（整合者建議）；(b) 不動上限，壓縮憲法其他字句抵銷。
6. **lane 數**：(a) 四條平行、含本檔所有權重劃（整合者建議）；(b) e406 併入 e359 成三條。

### 所有 lane 共通的範圍（寫進 prompt）
- 共同禁止照 `docs/lane-protocol.md` 與補充規則的預設；下表「擁有」欄以外的檔一律不動；以下只列相對於預設與 wave A 清單的重劃。
- `test/**` 只有 qa-engineer 能寫（憲法 §2）。全套一律 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑。
- 證據、spec、commit 不寫本機路徑字面值或內部連結；不拼出 product-style prefix。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後才呈人類核准。spec 要有 `## Cut` 段，逐檔列出要動的檔（含測試檔）、每站對應的 AC 與實作 task。PM 以 backlog 票列＋本清單的站點與 Decisions 為 spec 來源，不經 architect。
- 每一站改前對現行檔案重核行號；動到 `content/**` 的 lane，PM 在 cut 裡附試套後的預算數字與 golden 變動清單。
- 跑 `capture-constitution-golden.mjs` 之後只 commit 自己擁有的 golden；其他 lane 的 capture 必須 byte-identical，有差 → 停、寄信。
- 每一 hop 都寄信箱進度；lane session 裡的人類裁定一律寄信告知整合者。
- 不 push、不 merge、不發版、不刪 worktree、不跑 Release workflow；hop 用完 → `type: escalate`。
- 需要動別條 lane 擁有的檔（例：本 lane 的改動打紅別條 lane 擁有的測試）→ 停、寄信，不順手修。
- 動到檔案系統／symlink 行為的 lane（e196）：CI 跑 Node 20 與 22，PM 在 cut 裡寫 Node 20 的驗證方式。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e262 | E262＋E355＋E360＋E340 | feat/e262-sop-text-fixes | ../agent-governance-mcp-lanes/e262 | `content/skill-integrator.md`、`content/skill-qa-visual.md`、`content/const-05-core-standards.md`、`docs/lane-protocol.md`（只限 §5 與 E355 需要的通用句；§4、§6 歸 e196）、`docs/lane-protocol-addendum.md`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e226-integrator-sop-portable.test.mjs`、`test/e349-integrator-repo-facts.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e298-finish-remote-delete.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`、`test/e290-lane-protocol-generic.test.mjs`、`test/e416-filing-bar.test.mjs`、`test/qa-visual-skill-split.test.mjs`、`test/visual-widgets-unverified-gate.test.mjs`、`test/e262-*.test.mjs`、`test/e355-*.test.mjs`、`test/e360-*.test.mjs`、`test/e340-*.test.mjs`（新，qa 定名）、`specs/e262-*.md`、`.current/e262/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；其他 `content/**`；`docs/lane-protocol.md` §4、§6；所有非 md 的產品碼；`docs/backlog.md` | 做：E262——兩處改成實際能跑的順序（PM cut 預審 → lane 呈人類核准 → architect → Open Questions 二次預審、談定後才呈人類裁、sr 才開始），e178a 的釘句隨之移動（qa）；E355——第 142、151、156、164、175 行與 `npm test` 寫法照 E349 模式改成通用句＋補充規則一行，flake rule 改指補充規則裡的負載敏感清單（裁定 4 = a：`test/e108-eject.test.mjs` AC7 與 `test/verify-release.test.mjs` VR-20 列入、測試不改；wave A 已去耦的 E238 六站是否移出由 PM 在 cut 裡判定並說明），補充規則同步；E360——五列 FAIL 呼叫補 `review_task_ids=[<task-id>]`（對齊 qa SOP 第 107 行）；E340——`const-05` 第 17 行加列開頭裁定的窄例外（只限未勾、未 void 的 task 的描述與 `depends_on`，由修 cut 的角色就地改並在 `pending_notes` 揭露；id、勾選、void 列不准；其餘仍 void＋add），不引用 repo 專屬路徑；e130 AC9 釘句移動（qa）；golden 重抓；超出的預算上限照 E336／E365 慣例重定到實測值、零餘量（裁定 5 = a），PM 在 cut 附試套後的數字。不做：`tw_edit_task`、E358、E225 的 5a 改寫（裁定 3） | — |
| e196 | E196＋E225＋E353＋E205 | feat/e196-agc-init-lane-checks | ../agent-governance-mcp-lanes/e196 | `bin/agc-init.mjs`、`tools/lane-ticket-allocation.ts`（只在 PM 匯出驗證 helper 時）、`tools/lane-paths.ts`（只在 E205 快照需要新 lane 檔名時）、`tools/lane-status.ts`、`scripts/lane-status.mjs`（以上兩項只在 PM 選 lane-status 為驗證入口時）、`dist/tools/lane-ticket-allocation.*`、`dist/tools/lane-paths.*`、`dist/tools/lane-status.*`（同上條件）、`docs/lane-protocol.md`（只限 §4、§6）、`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/agc-adapters.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e217-abandoned-specs-harvest.test.mjs`、`test/e287-finish-findings.test.mjs`、`test/lane-ticket-allocation.test.mjs`、`test/lane-paths.test.mjs`、`test/e196-*.test.mjs`、`test/e225-*.test.mjs`、`test/e205-*.test.mjs`（新，qa 定名）、`specs/e196-*.md`、`.current/e196/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**`；`docs/lane-protocol.md` §4、§6 以外；`docs/lane-protocol-addendum.md`；`test/e130-lane-default.test.mjs`、`test/e125a-lane-local-ledgers.test.mjs`、`test/e383-lane-ledger-worktree.test.mjs`（打紅 → 寄信）；golden；budget | 做：E196（含 E206）——tracked 形狀第一次 `--shipped` 與 `--abandoned` 都套用 re-run 路徑的 `laneIgnoredStateFiles` 複製；E225＋E353——裁定 3 = a（方向 (1)＋(2)，不做 (3)）：lane 端驗證入口解析本 lane 的 `pending-tickets.md` 並印出每個 `errors`、`docs/lane-protocol.md` §6 收工檢查加一行；orphan 偵測把 `errors.length > 0` 當作有未套用的發現（警告、不沉默）；parser 不放寬；E205——裁定 2 = a：`feature start` 對 primary 的 `git status --porcelain` 拍快照、`feature finish`（兩種 disposition）比對並以警告點名每個新路徑，exit code 不變、不擋拆除。不做：改 finish 拒絕壞 block 的行為、`content/skill-integrator.md` 的 5a | — |
| e359 | E359＋E376＋E172 | feat/e359-server-core-fixes | ../agent-governance-mcp-lanes/e359 | `tools/tasks-file.ts`、`tools/storage-sqlite.ts`、`prompts/build.ts`、`index.ts`、`dist/tools/tasks-file.*`、`dist/tools/storage-sqlite.*`、`dist/prompts/build.*`、`dist/index.*`、`test/e117-void-task.test.mjs`、`test/e184-get-state-omits-tier.test.mjs`、`test/e137-render-sanitise.test.mjs`、`test/prompt-state-footer.test.mjs`、`test/e359-*.test.mjs`、`test/e376-*.test.mjs`、`test/e172-*.test.mjs`（新，qa 定名）、`specs/e359-*.md`、`.current/e359/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**`；golden；budget；`bin/**`；`gates/**`；`tools/handoff-*.ts`；`test/e125a-lane-local-ledgers.test.mjs`（打紅 → 寄信） | 做：E359——裁定 1 = a：void 拒絕訊息（file 與 SQLite 兩處）點名「先由 qa-engineer 寫一筆帶 `review_task_ids` 的 FAIL」這一步；`tw_rollback_task` 與 `tw_sync` 行為不變；E376——`renderHandoffStateBlock` 省略 `dispatch_mechanism_tier`（與 E184 的 `handleGetState` 同一鍵），golden capture 確認 byte-identical；E172——`resolveWorkspacePath` 在 win32 也接受 `~\`（`process.platform` 判斷或可注入，PM 定；測試不得依賴執行平台）。不做：改 E184 的 envelope、其他 render 欄位 | — |
| e406 | E406＋E203 | feat/e406-release-and-merge-scripts | ../agent-governance-mcp-lanes/e406 | `scripts/release.mjs`、`tools/merge-invariants.ts`、`dist/tools/merge-invariants.*`、`specs/e126-merge-invariants.md`（只限 (c) union 條件段）、`test/e394-release-script.test.mjs`、`test/release-staging.test.mjs`、`test/e126-merge-invariants.test.mjs`、`test/e406-*.test.mjs`、`test/e203-*.test.mjs`（新，qa 定名）、`specs/e406-*.md`、`.current/e406/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**`（含 `content/skill-release-engineer.md`：需改 → 寄信）；`scripts/merge-invariants.mjs`；`test/e130-lane-default.test.mjs`、`test/e115-join-precondition.test.mjs`（打紅 → 寄信）；golden；budget | 做：E406——照列：tracked 修改用 `git add --update -- <member>`、未追蹤只 stage 計畫點名的路徑；計畫外的未追蹤檔只警告並點名、不 stage、不致命；exit 30 只留給計畫路徑沒 stage 進去；測試用暫存 repo 在 `docs/` 放一個未追蹤檔。E203——先改 spec 的 (c)：U 只收合併後**找不到**的已結 task_id；再改碼；列的三個驗證點各一個測試（5 對 4 反例仍 FAIL、合併丟掉 T-D-01 仍 FAIL、只豁免真正被壓縮的列）。不做：本機 `.git/info/exclude` 的那一行（本機狀態，不屬 repo） | — |

## 所有權重劃（相對於 lane-protocol 預設與 wave A 清單）
- **`docs/lane-protocol.md` 依節切**：§5（E262）與 E355 需要的通用句 → e262；§4、§6（E225 收工檢查一行）→ e196。預期合併零衝突（相距 40 行以上）。wave A 這兩檔與 `content/skill-integrator.md` 在共同禁止裡，本波解禁給 e262／e196。
- **`index.ts`、`prompts/**`** 在 wave A 共同禁止，本波解禁給 e359（只限 `index.ts`、`prompts/build.ts`）。
- **`bin/agc-init.mjs`** 解禁給 e196。
- **`test/e130-lane-default.test.mjs` 劃給 e262**（E340 的 AC9 釘句一定要動）；它也釘 finish 與 release 的行為——e196、e406 打紅它 → 寄信，由整合者改劃或合併後派 qa。
- **共享生成物**（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部 → e262。e359 的 E376 預期不動 golden（`dispatch_mechanism_tier` 只在 monolith 的 SOP 散文）。
- **E353 併入 E225**（整合者決定：同一缺陷，同 lane 一起修；E353 列記帳時標 CLOSED、由 E225 完成）。
- **E225 的方向 (3)（integrator SOP 5a 改用解析）不在本波**：它在 e262 的檔、又依賴 e196 的指令名（裁定 3）。
- **`dist/**` 按檔案切**，各 lane 只 commit 自己原始碼的產物；其他 `dist/` 重建應為零差異，有差 → 寄信。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| integrator SOP 與 lane-protocol §5 的 architect-hop 順序可實際執行（cut 核准在 architect 之前、Open Questions 二次預審在 sr 之前），e178a 釘句同步 | e262（E262） | ✓ |
| integrator SOP 不再陳述只在本 repo 成立的事實（`feat/**`、backlog 的負載敏感清單、重啟 MCP server、root `NEW-TICKETS.md`、`npm test`），各有通用句＋補充規則一行 | e262（E355） | ✓ |
| flake rule 指向補充規則裡的負載敏感清單；兩個候選列入清單（裁定 4 = a） | e262（E355） | ✓ |
| qa-visual Phase 1.5 FAIL 呼叫都帶 `review_task_ids`，與 qa SOP 格式句一致 | e262（E360） | ✓ |
| const-05 有 E340 的窄例外、不引用 repo 專屬路徑；e130 AC9 釘句、golden 同步；預算上限照慣例重定（裁定 5 = a） | e262（E340） | ✓ |
| tracked 形狀第一次 finish（兩種 disposition）不再丟失 git-ignored 的 lane 檔 | e196（E196） | ✓ |
| 壞的 `pending-ticket` block 在 lane 還開著時就被報出；orphan 偵測不再沉默略過壞 block；lane-protocol §6 收工檢查有對應一行 | e196（E225＋E353） | ✓ |
| `feature finish` 點名 lane 期間在 primary 新出現的路徑（裁定 2 = a，只警告），不誤報 primary 原本就有的工作 | e196（E205） | ✓ |
| 未配對 qa FAIL 的 rollback 之後，void 拒絕訊息點名配對的 qa FAIL 寫入（裁定 1 = a） | e359（E359） | ✓ |
| role prompt／SessionStart 的狀態區塊不再顯示 `dispatch_mechanism_tier` | e359（E376） | ✓ |
| win32 的 `~\x` workspace 路徑會展開 | e359（E172） | ✓ |
| `release.mjs prepare` 不再整個目錄 stage；計畫外未追蹤檔只警告；exit 30 只給計畫路徑 | e406（E406） | ✓ |
| merge-invariants (c) 不再對合併後仍在的列誤報 MISSING；spec 先改；三個驗證點有測試 | e406（E203） | ✓ |
| 每條 lane `dist/` 只含自己原始碼的產物、`npm audit --audit-level=high` exit 0、`check:bookkeeping` exit 0 | 全部 lane（qa 核對） | ✓ |
| 13 張 done-mark（E353 標 CLOSED、由 E225 完成） | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併順序見下；每次 merge 後 `node scripts/merge-invariants.mjs`。
- 合併後 `npm run build`、`dist/` 無差異；`capture-constitution-golden.mjs` 對合併樹 byte-identical（只有 e262 動 golden）；預算在上限內。
- 記帳：done-mark；E353 標 CLOSED；`npm run check:bookkeeping` exit 0。
- 接線票：無。

## 合併順序
1. `integ/backlog-wave-b` 自派工 base 開。
2. ← `--no-ff` e262（共享生成物 lane 先）→ merge-invariants。
3. ← `--no-ff` e196（`docs/lane-protocol.md` 若同一 hunk 兩邊都有改屬改劃錯誤 → 停）→ merge-invariants。
4. ← `--no-ff` e359、e406（誰先過 lane 層誰先），每次 merge-invariants。
5. `npm run build`、golden byte-identical、預算、`check:bookkeeping`、audit；記帳 commit。
6. 依序 `finish <lane> --shipped --base integ/backlog-wave-b`；`fanout.mjs handoff --closing`；push、CI、`gh pr create`、`gh pr merge --auto --merge`；merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only`、`git branch -d integ/backlog-wave-b`。不發版。

## Dispatch pins
- e262：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e196：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e359：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。
- e406：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-09 | 人類 | 本波範圍：E262＋E355＋E360＋E340、E196＋E225＋E353＋E205、E359＋E376＋E172、E406＋E203，13 張進本里程碑由此裁定；E340 走 SOP 例外、不做工具；E355 一併處理 flake rule 家族清單並評估兩個負載敏感候選；pins pm／sr／code-reviewer=opus、qa=sonnet；`cutApprovalAutoTier` 維持 `{}`；四條合進 `integ/<feature>` 後一次 PR、不發版 | 整合者 session（integrator prompt） |
| 2026-11-09 | 整合者 | Stage 1 核對：E353 併入 E225；`docs/lane-protocol.md` 依節切（§5 → e262、§4／§6 → e196）；`test/e130-lane-default.test.mjs` 劃 e262；共享生成物全歸 e262；`index.ts`、`prompts/build.ts` 解禁給 e359、`bin/agc-init.mjs` 解禁給 e196；E360 不動 golden／預算（qa-visual 不在其中）；E376 預期不動 golden；E406 預期不動 `content/skill-release-engineer.md` | 本檔 |
| 2026-11-09 | 人類 | 核准清單與待人類裁定 1–6（回覆「approve」，對應整合者呈報的「全部照建議就回 approve」）：1 = a、2 = a、3 = a、4 = a、5 = a、6 = a，含本檔所有權重劃；寫進各 lane 的 spec，lane 不再問 | 整合者 session |
