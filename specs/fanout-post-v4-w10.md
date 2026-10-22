# Fan-out: post-v4 佇列第 10 波（handoff 讀寫邊界 lane：E135 + E181 + E150 + E138 ∥ 測試基礎設施 lane：E209 + E182 + E183）
base: 57f3f4e    integration branch: integ/post-v4-w10
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-22。** 兩條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w10` merge `cfc3c68`（e135）、`88e8da9`（e209）→ finish 兩 lane（E359–E363 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。 `base:` 是規劃基準（E358 立票 PR #37 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

佇列 P2 段開頭三張（#1 E135、#2 E181、#3 E150）是同一類問題：handoff 的讀取視圖、序列化格式與作者寫的內容分不清，每多一跳就多累積一次。三張都落在同一組檔案（`tools/registry.ts` 的寫入邊界、`tools/handoff-parse.ts`、`tools/handoff-write.ts`），擁有集合無法拆開，所以放同一條 lane 依序做；E138 依 D1 併入同一條 lane。第二條 lane（D2）從 P2 段挑三張檔案完全不相交、成本低的測試基礎設施票平行跑。

## 派工前核對（整合者，2026-10-20，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `57f3f4e`；工作區乾淨。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox`；沒有 `e135`／`e209`／`post-v4-w10` 的殘留 branch。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ 每條 lane 的 cut 由人類在 lane session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **三張票為什麼不能拆成平行 lane**：
  - E135：合成標記產生在 `tools/handoff-parse.ts` 的讀取視圖（`…[truncated]` 後綴與 E92 的 `…[N further note(s) omitted — see pending_notes_truncated]`）；票面兩種修法分別落在寫入邊界（`tools/registry.ts` 的 E86 zod 檢查）或寫入路徑。
  - E181：序列化在 `tools/handoff-write.ts`（`pendingNotes.map((t) => \`- ${t}\`)`），讀回在 `tools/handoff-parse.ts`（`/^- (?!\[)(.+)/gm`）；拒絕多行的修法同樣落在 `tools/registry.ts`。
  - E150：`completed_tasks` 的 zod 是 `.optional().default([])`（`tools/registry.ts`），省略與傳 `[]` 目前分不出來；carry-forward 子句在 `tools/handoff-write.ts`（`dispatch_pins` 等欄位的同一區塊）。
  - 三張共用 `tools/registry.ts`、`tools/handoff-write.ts`，其中兩張再共用 `tools/handoff-parse.ts`，加上 `dist/` 對應檔 → 同一條 lane。
- **E150 的前提更正**：票面的第二個入口（平行 lane 合併時 `.current/handoff.md` 衝突、非勝出方的 ledger 被丟）已被 E123 的分 lane 目錄關閉：現在每條 lane 寫 `.current/<lane>/handoff.md`，primary 是 `.current/_primary/`，合併時不會同檔衝突。剩下的是第一個入口：同一 feature 的補寫省略 `completed_tasks` 會清空 ledger。`tools/drift.ts` 的提示文字仍寫著「a merged parallel lane's ledger can be discarded on conflict (root cause: E150 …)」，修好後要一起改。
- **E150 的設計題（交 lane 的 PM／architect）**：憲法 §3.1 Non-QA Completed-Tasks Gate 的清除方式寫「omit `completed_tasks` (or pass `[]`)」，code-reviewer SOP 也這樣寫。如果省略會 carry forward，而傳 `[]` 會清空，非 qa 角色照 SOP 傳 `[]` 時，第一個入口又會打開。所以 cut 必須決定 `[]` 是什麼意思（例如只有 `qa-engineer`／`tw_rollback_task` 能縮小 ledger），並判斷 `content/**` 的這兩句要不要改。整合者預期這張票需要 architect 那一跳。
- **E181 要先重現**：票面寫「切票前先由 qa 重現」。lane 的 cut 第一個 task 是 qa 寫兩行 note 的重現測試（expected-red），其餘 task 依重現結果決定。
- **E138 與 E135 在同一段程式碼（D1，需人類裁決）**：E138（佇列 #6，P2）是讀取截斷丟掉尾端的 note。它改的正是 E135 產生合成標記的那 40 行（`tools/handoff-parse.ts` 的 `PENDING_NOTES_CHAR_LIMIT` 迴圈），而且 E135 的標記設計取決於截斷保留哪些 note。分兩波做，那段程式碼和釘住它的 e92 測試就要改兩次。整合者建議**併入 e135 lane**。**人類裁決：併入。**
- **第二條 lane（D2，需人類裁決）**：E209（`scripts/test-lock.mjs` 回收空鎖檔時可能刪掉活著的鎖）、E182（`test/usage-accounting.test.mjs` 在負載下撞 5000 ms 逾時，只有 qa 能改）、E183（`scripts/summarize-metrics.mjs` 預設讀已不存在的扁平 `metrics.jsonl`，無聲回報零）。三張都在 P2 段，和 e135 的檔案完全不相交，也不碰共享生成物。E209 和 E182 是同一個失效（全套平行跑時隨機紅），E182 的票面也點名它可能是 E156 的成因。整合者建議**開這條 lane**。**人類裁決：開。**
- **schema 不升版**：E181 的「把 notes 搬進 YAML frontmatter」選項需要升 schema 加 migration，不在本波。如果 cut 認定非升不可，`type: escalate`。`schema/**` 列在共同禁止。
- **不在本波**：E184（`tw_get_state` 顯示上一跳的 tier，也在 `tools/handoff-parse.ts` 的讀取視圖），排在佇列 #20，本波不併。lane 如果順手碰到，記成新發現。
- **會被擊中的測試（規劃時清點，lane PM 逐一核對）**：
  - e135：
    - 釘標記文字的：`test/e92-e86-handoff-write-boundary.test.mjs`、`test/e92-e86-handoff-write-boundary-repro.test.mjs`、`test/token-efficiency.test.mjs`。
    - 釘 ledger 規則的：`test/e32-e33-gate-hardening.test.mjs`、`test/reviewer-completed-tasks-gate.test.mjs`。
    - 另有 59 個測試檔讀寫 handoff，其中 44 個碰 `completed_tasks`。
  - e209：`test/e177b-test-lock.test.mjs`、`test/usage-accounting.test.mjs`、`test/success-metrics.test.mjs`（讀 `summarize-metrics.mjs`）。
- task id：
  - e135 用 `T-E135-NN`／`T-E181-NN`／`T-E150-NN`／`T-E138-NN`。
  - e209 用 `T-E209-NN`／`T-E182-NN`／`T-E183-NN`。
  - 不重用前波 id（E310 的 basename 撞名）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要的話，在測試裡自己建固定清單或 fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。有 architect 那一跳的 lane，architect 的 Open Questions 也要預審。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`bin/**`、`schema/**`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/integrator-revision-2026-10-08.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e135 | E135、E181、E150、E138 | feat/e135-handoff-notes-ledger | ../agent-governance-mcp-lanes/e135 | `tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-write.ts`、`tools/handoff-types.ts`、`tools/handoff-orchestrator.ts`、`tools/drift.ts`、`tools/handoff.ts`（只在需要時）、`dist/tools/registry.*`、`dist/tools/handoff-parse.*`、`dist/tools/handoff-write.*`、`dist/tools/handoff-types.*`、`dist/tools/handoff-orchestrator.*`、`dist/tools/drift.*`、`dist/tools/handoff.*`、`content/**`（只在 E150 的 cut 需要改 ledger 清除方式的句子時）、`test/fixtures/compose-golden/**`（同上，只在需要重新固定時）、`test/context-budget.test.mjs`（同上）、`test/e92-e86-handoff-write-boundary.test.mjs`、`test/e92-e86-handoff-write-boundary-repro.test.mjs`、`test/token-efficiency.test.mjs`（只限 pending_notes 截斷與標記斷言）、`test/e32-e33-gate-hardening.test.mjs`（只限 ledger 斷言）、`test/reviewer-completed-tasks-gate.test.mjs`（只限 ledger 斷言）、其他讀寫 handoff 的 `test/**`（只限被本 lane 改變的行為斷言，cut 裡逐一列名，預審核對）、`test/e135-*.test.mjs`、`test/e181-*.test.mjs`、`test/e150-*.test.mjs`、`test/e138-*.test.mjs`、`specs/e135-*`、`qa_reports/*E135*`、`qa_reports/*E181*`、`qa_reports/*E150*`、`qa_reports/*E138*`、`review_reports/*E135*`、`review_reports/*E181*`、`review_reports/*E150*`、`review_reports/*E138*`、`.current/e135/**` | `scripts/**`、`docs/gate-retro-procedure.md`、`tools/storage-sqlite.ts`、其他 `tools/**`、其他 `dist/**`、`gates/**`、`guards/**`、`prompts/**`、其他 `docs/**`、其他 `.current/**`、e209 擁有的測試（`test/e177b-test-lock.test.mjs`、`test/usage-accounting.test.mjs`、`test/success-metrics.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E181：先由 qa 寫兩行 note 的重現測試（expected-red），再修寫入邊界。整合者建議在 `tools/registry.ts` 拒絕含換行的 note（大聲失敗，和 E86、E138 引用的 `scope_decision_why` 上限同一個做法）；做跳脫加解碼也可以，但不得升 schema。(2) E135：讓讀取視圖的合成標記在結構上可辨識，而且寫回時一定擋得住或清得掉（票面兩種修法擇一，cut 寫明理由）；呼叫端不必自己記得清理。(3) E150：同一 feature 內省略 `completed_tasks` 的寫入保留現有 ledger（和 `dispatch_pins` 同樣的 carry-forward 子句），切換 feature 時照舊清空；cut 決定 `[]` 的語意與誰能縮小 ledger（見派工前核對的設計題），必要時改 `content/**` 的清除方式句子並重定 golden 與 budget；`tools/drift.ts` 提示裡的 E150 段落改成符合修好後的事實。(4) E138（D1 併入）：截斷不得無聲丟掉尾端的指令，和 E135 的標記一起設計。硬條件：不升 `schema_version`；SQLite／HTTP 模式的行為不變（carry-forward 只在 file 模式，和其他 carry-forward 欄位一致）；所有 gate 的錯誤碼與既有拒絕條件不變；Non-QA Completed-Tasks Gate 仍是「非 qa 寫入帶非空 `completed_tasks` 就拒絕」的嚴格判斷；e209 擁有的測試全綠不改。　不做：E184（讀取視圖的 tier 回顯）；E181 的「搬進 frontmatter」選項；`tools/storage-sqlite.ts`。 | 無 |
| e209 | E209、E182、E183 | feat/e209-test-infra-fixes | ../agent-governance-mcp-lanes/e209 | `scripts/test-lock.mjs`、`scripts/summarize-metrics.mjs`、`docs/gate-retro-procedure.md`、`test/e177b-test-lock.test.mjs`、`test/usage-accounting.test.mjs`、`test/success-metrics.test.mjs`（只限 `summarize-metrics` 斷言）、`test/e209-*.test.mjs`、`test/e182-*.test.mjs`、`test/e183-*.test.mjs`、`specs/e209-*`、`qa_reports/*E209*`、`qa_reports/*E182*`、`qa_reports/*E183*`、`review_reports/*E209*`、`review_reports/*E182*`、`review_reports/*E183*`、`.current/e209/**` | `tools/**`、`dist/**`、`gates/**`、`guards/**`、`prompts/**`、`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、其他 `scripts/**`、其他 `docs/**`、其他 `.current/**`、其他 `test/**`（特別是 e135 擁有的測試、`test/e177b-mailbox-watch.test.mjs`、`test/e177b-lane-status.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E209：鎖檔的內容先寫進暫存檔，再用 `linkSync` 放到位，讓鎖檔永遠不會以空檔被看到；qa 用匯出的 `reclaimStale` 寫確定性重現。(2) E182：`runHook` 的逾時改成可由環境變數覆寫，或提高預設值（qa 的檔案，qa 決定）；cut 先確認它是不是 E156 的成因，結論寫進 qa 報告。(3) E183：`summarize-metrics.mjs` 改成解析 lane 路徑（或比照 `tw_gate_stats` 彙總各 lane），找不到檔案時大聲失敗；`docs/gate-retro-procedure.md` 的預設路徑說明同步改。硬條件：`test-lock` 的命令列介面與 `-- npm test` 用法不變；`test/e177b-mailbox-watch.test.mjs`、`test/e177b-lane-status.test.mjs`（不擁有）全綠不改，`test/e177b-test-lock.test.mjs` 裡 E224 的 AC10 案例不改斷言（E224 不在本波）；`tools/**` 一行都不改（E183 要用的 lane 路徑解析如果只在 `tools/` 裡，改用 `dist/` 已出貨的匯出，或在 script 內實作）。　不做：E224（mailbox-watch AC17／test-lock AC10 在負載下逾時）、E156 的修正（只記錄判斷）、E238／E254／E278 的其他偶發測試。 | 無 |

## 所有權重劃（相對於預設）
- 兩條 lane 的擁有集合不相交。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部歸 e135，只在 E150 的 cut 需要改句子時才動；e209 一律不碰。
- **三張 handoff 票放同一條 lane**（不拆）：共用 `tools/registry.ts` 與 `tools/handoff-write.ts`，見派工前核對。
- **`tools/drift.ts` 劃給 e135**：它的提示文字點名 E150 的根因，修好後要一起改。
- **`test/success-metrics.test.mjs` 劃給 e209，只限 `summarize-metrics` 斷言**。
- **`schema/**`、`docs/lane-protocol*.md` 加進共同禁止**：本波不升 schema，也不改 lane 規則。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 含換行的 note 不會再讀回成多筆偽造的 note（拒絕或無損往返），有 qa 的重現測試 | e135（E181） | ✓ |
| 讀取視圖的合成標記在結構上可辨識，原樣寫回時會被擋下或清掉，呼叫端不必自己處理 | e135（E135） | ✓ |
| 同一 feature 內省略 `completed_tasks` 的寫入不會清空 ledger；切換 feature 時照舊清空 | e135（E150） | ✓ |
| `[]` 的語意與誰能縮小 ledger 有明確規則，SOP／憲法的清除方式句子與實作一致 | e135（E150） | ✓ |
| `tw_detect_drift` 的提示不再把已關閉的 E150 第二個入口寫成現況 | e135（E150） | ✓ |
| 截斷不會無聲丟掉尾端的 note | e135（E138） | ✓ |
| 空鎖檔不會讓回收者刪掉活著的鎖 | e209（E209） | ✓ |
| `usage-accounting` 的 hook 測試在負載下不再因固定 5000 ms 逾時而紅；E156 的成因判斷寫進 qa 報告 | e209（E182） | ✓ |
| `summarize-metrics.mjs` 不帶參數執行時讀得到 lane 的 metrics，或大聲失敗；retro 文件同步 | e209（E183） | ✓ |
| 被改變行為釘住的測試重新固定，其他測試全綠不改 | e135、e209（各自的 qa） | ✓ |
| E135、E181、E150、E209、E182、E183、E138 done-mark；佇列對應列勾 DONE；E150 的前提更正寫進 done-mark | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e135 → e209。每次 merge 後跑 `merge-invariants`；全部合併後重建 `dist/`、跑 `check:bookkeeping`、`npm audit --audit-level=high`，push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback 時跑）。
- 本清單結案時，記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。

## 合併順序
1. `integ/post-v4-w10` ← `--no-ff` e135（共享生成物 lane 先），再跑 merge-invariants。
2. ← `--no-ff` e209，再跑 merge-invariants。
3. 重建 `dist/`，跑 `check:bookkeeping`。
4. 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w10`。
5. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
6. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/post-v4-w10`。

預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，一律重建。

## 結案
- 日期 2026-10-22。`integ/post-v4-w10` ← e135（`cfc3c68`）← e209（`88e8da9`），皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39711742858 在 `88e8da9` 綠。
- 彙總（上限按 lane 計）：e135 9 張 task（另 9 張因 cut 改版 void）／hop 6/14／review 0 輪退回／qa 0 輪退回；e209 5 張 task／hop 4/14／review 0 輪／qa 0 輪。合計 14 張 task、hop 10，每條 lane 都在自己的上限內。
- 完成定義 12 項全部成立（本清單的 `## 接手步驟` 為最後一項）。
- 例外：(1) e209 PM 在 cut 預審 close 前就寫了 `next_role=sr-engineer`（cut gate 擋住，沒有派工）。(2) e135 cut 預審退回一次：qa 預寫測試那一跳不在 ledger 上，改成 feature 模式；E150 的回滾路徑補了 AC16。(3) e135 照 E262 的實際順序走：人類先核准 cut → architect → 第二次預審 → 人類裁決 OQ。(4) e135 的 sr session 停住約 7 小時，人類喚醒後接續。(5) e135 有 5 個 task 打勾但沒進 handoff 完成清單（E237 同類），證據齊全。(6) e135 的越界 6 檔是 `qa_reports/e135-evidence/` 下的原始 log，整合者接受。(7) 兩條 lane 的 sr、reviewer 都是 opus（同模型疑慮，review 報告已註明）。
- 新票：E359–E361（e135）、E362–E363（e209），都由 `finish --shipped` 配號；E362 排在佇列 #13a（P2，人類裁決不拉進本波），其餘排在 #176–#179。
- 發版：`main` 帶 E181／E135／E138／E150（handoff 讀寫邊界與完成清單的保留規則，`tools/registry.ts`、`handoff-parse/write/types/orchestrator.ts`、`drift.ts`）與 E209／E182／E183（test-lock 發佈方式、hook 測試逾時、summarize-metrics 預設路徑）→ 是否發版與版號由人類決定。

## Dispatch pins
- e135：`pm=opus`、`sr-engineer=opus`。
- e209：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-20 | 整合者 | 草案：e135（E135＋E181＋E150，handoff 讀寫邊界，共用 `tools/registry.ts`／`tools/handoff-write.ts`／`tools/handoff-parse.ts` 所以不拆；唯一可能碰共享生成物的 lane）∥ e209（E209＋E182＋E183，測試基礎設施，檔案完全不相交）。E150 的前提更正：第二個入口已被 E123 的分 lane 目錄關閉，剩第一個入口；`tools/drift.ts` 劃給 e135。`schema/**`、`docs/lane-protocol*.md` 加進共同禁止；E184 不併入。待人類裁決：D1（E138 是否併入 e135）、D2（是否開 e209 lane） | 本檔 |
| 2026-10-20 | 人類 | 核准本清單（全部）：兩條 lane（e135、e209）與所有重劃；D1 —— E138 併入 e135；D2 —— 開 e209 lane；Lanes 表不加 `approval` 欄。人類回覆「approve, D1 併入, D2 開」 | 整合者 session |
| 2026-10-20 | 整合者 | 清單 PR #38 merge `2ad039d` = 派工 base（CI run 39414089621 在 `094299f` 綠）；派工前核對：兩條 lane 點名的擁有／禁止路徑在 base 存在，沒有殘留 branch／worktree；信箱 e135／e209 已建空檔，mailbox-watch 與 lane-status watch 都已 armed；兩份 prompt 以 `fanout.mjs render --base 2ad039d` 產生。派工前修正 e209 的硬條件：原句把 E224 的 AC10 寫成「不擁有」，但它在 e209 擁有的 `test/e177b-test-lock.test.mjs` 裡，改成「不改斷言」。此修正隨記帳 commit 進 integ | 本檔 |
| 2026-10-20 | 整合者 | e209 cut 預審 close（`9830195`，to-lane#3）：範圍、檔案邊界、完成定義對照都符合；check --cut exit 0；E209／E183 有 sr 實作 task，E182 依清單 qa-only；同意 feature 模式＋qa 對 base 副本重現、E183 用 `dist/tools/lane-paths.js` 且明確路徑缺檔也 exit 1。選填：AC-E183-1 加 linked worktree gitfile fixture。例外：PM 在預審 close 前就寫了 `next_role=sr-engineer`（cut gate 會擋，沒有派工） | 信箱 e209 |
| 2026-10-20 | 人類 | 在 e209 lane session 核准 cut（`9830195`） | e209 lane session；`specs/e209-test-infra-fixes.md`，commit `9830195` |
| 2026-10-20 | 整合者 | e135 cut 預審退回一次（`a23279a`，to-lane#1）：R1 —— qa 預寫測試的那一跳不在 ledger 上（沒有 transition、沒有狀態寫入），改用 feature 模式，比照 e239／e243／e209 由 qa 在 sr 之後對 base 副本重現；R2 —— E150 改成 carry-forward 後，被 `tw_rollback_task` 回滾的 id 會留在 ledger，`tw_sync` 會把它標回 [x]，architect 要定案縮小路徑並加一條 AC。Q2：清單硬條件「SQLite／HTTP 行為不變」只指 ledger carry-forward，輸入規則兩種模式共用（E86 先例）。Q3：`completed_tasks` id 含換行（E181-NEW-1）由整合者折進 T-E181-02 | 信箱 e135 |
| 2026-10-20 | 整合者 | e135 cut 預審 close（`62297e8`，to-lane#2）：R1（feature 模式，鏈 pm → architect → sr → cr → qa）、R2（AC16 回滾路徑）、Q2（Mode reading）、Q3（AC5）都已照辦；check --cut exit 0；舊的 9 個 task 已 void 重切。照 E262 的實際順序：人類先核准 cut → architect → Open Questions 與 AC15／AC16 定案做第二次預審 → 人類裁決後才派 sr | 信箱 e135 |
| 2026-10-20 | 整合者 | 5a：e209 `c68f00a`（CI run 39421355881）close —— review、qa 都是一輪通過；21 檔都在擁有範圍內；E156 成因判斷：unrelated（E156 不改）；新發現 E209-NEW-1（P2，reclaim guard 同類失效）、E182-NEW-1（P3，spawn 餘裕）等 finish 配號。是否把 E209-NEW-1 拉進本波由人類決定，整合者建議不拉，lane 照預設走完 | 本檔 |
| 2026-10-21 | 人類 | E209-NEW-1 不拉進本波：照整合者建議，finish 配號後排在佇列 P2 段、E209 原位置之後。人類回覆「1+2」（同意建議並恢復 watch） | 整合者 session |
| 2026-10-21 | 人類 | 在 e135 lane session 核准 cut（`62297e8`） | e135 lane session；`specs/e135-handoff-notes-ledger.md`，commit `62297e8` |
| 2026-10-21 | 整合者 | e135 第二次預審 close（architecture `ba4d5af`，to-lane#3）：同意 AC15（[] 等同省略、qa 用併集）與 AC16（只有 qa FAIL 加 review_task_ids 才縮小，在 writer 的鎖內處理）；`content/**` 不改。給人類的 OQ 建議：OQ1 接受並另開新發現、OQ2 接受（四個換行字元）、OQ3 接受。F1（空白的 completed_tasks id）由整合者折進 T-E181-03；F2（qa-visual FAIL 列缺 review_task_ids）與 `\b` 比對會連帶移除連字號後綴 id 的問題，都記成新發現 | 信箱 e135 |
| 2026-10-21 | 人類 | 在 e135 lane session 裁決 architect 的 OQ1–OQ3（照建議接受）；PM 修訂 spec 第 2 版（AC2／AC5 四個換行字元、completed_tasks 描述最終字串、AC5a 併入 F1、OQ1 殘留列入 Out of Scope） | e135 lane session；`specs/e135-handoff-notes-ledger.md`，commit `3c460ec` |
| 2026-10-22 | 整合者 | 5a：e135 `b9d977a`（CI run 39711237967）close —— review、qa 都是一輪通過；9 個 task 由 `qa_reports/review_T-E181-04.md` 的 covers 涵蓋；越界 6 檔是 `qa_reports/e135-evidence/` 下的原始 log（子目錄對不上 `*E135*` glob，內容無本機路徑），屬機械性越界，整合者接受。T-E150-04、T-E181-03、T-E138-03、T-E135-03、T-E150-05 在 tasks.md 已打勾，但沒進 handoff 完成清單（qa:PASS → qa:PASS 沒有邊，E237 同類），證據齊全，drift 未報。中途 sr session 停住約 7 小時，人類喚醒後 lane 自行接續 | 本檔 |
| 2026-10-22 | 整合者 | 5b：`integ/post-v4-w10` ← e135 `cfc3c68` ← e209 `88e8da9`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39711742858 綠；finish e135 配號 E359–E361、finish e209 配號 E362–E363 | 本檔 |

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 2ad039d
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v4-w10 @ 2190ccc）
- lane-status：primary（main ← integ/post-v4-w10 @ 2190ccc）release-post-v4-w9／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 第 10 波兩條 lane（e135、e209）已合併、finish、拆除；lane 紀錄在 `.current/history/2026-10/`，記帳與本清單在同一個 wave PR。佇列 P2 段的 E135、E181、E150、E138、E182、E209、E183 至此完成。
- 未配號的新發現：無（E359–E363 由 finish 配號）。
### 待人類決定
- 是否發版：`main` 帶 handoff 讀寫邊界的輸入拒絕規則（多行、`[` 開頭、空白 note 與 task id 會被拒）、讀取視圖的標記與保留頭尾、完成清單在同一 feature 內保留，以及 test-lock、hook 測試逾時、summarize-metrics 的修正；版號由人類決定（輸入規則收緊屬行為改動）。
- 是否開下一波：佇列 P2 段還有 E139、E136、E154、E152、E158、E161、E215、E184、E236 與新的 E362；E293 仍暫緩。
- 建議：下一步（發版或下一波）開新 session 進行；若要在本 session 繼續，先跑 `node scripts/fanout.mjs handoff --check specs/fanout-post-v4-w10.md`，exit 0 才繼續。
### 進行中的背景工作
無
