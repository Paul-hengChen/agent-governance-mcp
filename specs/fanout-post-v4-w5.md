# Fan-out: post-v4 佇列第 5 波（fanout 工具 lane：E283 + E322 + E316 ∥ finish／小修 lane：E287 + E324 + E325 + E326 ∥ content lane：E288 + E323）
base: 2099162    integration branch: integ/post-v4-w5
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-17。** 三條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w5` merge `b9d9eab`（e288）、`1f0535e`（e283）、`95ec767`（e287）→ finish 三 lane（E327–E335 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。本清單是 E283 的「已結案」規則併入後的第一份結案清單。 `base:` 是規劃基準（v4.7.0 發版記帳 PR #16 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

第 4 波結案時的建議照做：integrator 改版第 1 波剩下的兩張程式票 E283（`fanout.mjs validate` 交接段）與 E287（finish 不再遺失新發現）檔案不相交，各成一條 lane；E322（`fanout check` ref 模式）與 E283 同檔，併入；E316（`check --cut` 標題變體）也是同檔的小修，併入。E324（telemetry 路徑）與 E325（`tools/drift.ts` 同類窗口）是第 4 波留下的 P3 小修，檔案和 e287 不重疊，併進 e287。content lane 是 E288（integrator Stage 0）＋ E323（固定 base diff 測試與慣例句；兩個測試檔都讀 content，與 E288 同 lane 最不衝突）。

## 派工前核對（整合者，2026-10-16，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `2099162`（v4.7.0：release PR #15 `7dbb4fc`、發版記帳 PR #16；tag `v4.7.0`）；遠端只剩 `main`。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`<lanes-root>/_mailbox/` 是空的。
- `.current/.config.json` 的 `cutApprovalAutoTier` 未加 `manifest: true` → 本波每條 lane 的 cut 仍由人類在 lane session 核准；Lanes 表不加 `approval` 欄。
- E320 已在 `main`：5a 可直接用 `node scripts/verify-release.mjs --ci-check --sha <lane sha>`（以 commit 跨分支找 run、找不到 FAIL）。
- **E283 的落點**：`tools/fanout-manifest.ts`（validate）＋ `scripts/fanout.mjs`。「已結案」的判斷方式與舊清單是否豁免由 PM 決定（票面）。**硬條件**：本 repo 現有每一份 `specs/fanout-*.md` 在改後的 `validate` 結果（exit code 與錯誤碼集合）不變 —— `test/e235b-relative-worktree.test.mjs:359` 與 `test/e296-manifest-tier.test.mjs` AC9 都對全部真實清單跑 validate 掃描；`render` 對既有清單 byte-identical（`test/e296-manifest-tier.test.mjs` AC10 比對 HEAD 與固定 base 的 render，E323 會改掉它，但兩條 lane 並行時 render 不可變）。
- **E322 的落點**：同檔新增 ref／路徑清單模式（例如給定 `<ref>...<target>` 或一份路徑清單，對每條 lane 的擁有欄比對）；介面由 PM 定。給 `content/skill-integrator.md` Stage 4 *Mid-wave base fix* 條件 2 用 —— 本波**不改** SOP 字（e288 擁有 skill-integrator，但 E288 不含這句）；工具出貨後 SOP 改字另開票或下一波帶。
- **E316 的落點**：`tools/fanout-manifest.ts` `parseCutSection`：票面「便宜的部分防護」—— `/^ {0,3}##[ \t]+cut[ \t#]*$/i` 的每一行都計入 `CUT_SECTION_DUPLICATE`；setext 與同形字仍是文件化的限制。`test/e296-manifest-tier.test.mjs:430` 的 `CUT_SECTION_DUPLICATE` 案例須照舊通過；新案例寫在 e283 自己的新測試檔（e296 測試檔劃給 e288）。
- **E287 的落點**：`bin/agc-init.mjs`（finish）、`tools/lane-ticket-allocation.ts`。票面「PM 和 architect 決定這些新發現放哪裡」→ **走 architect hop**（人類核准 2026-10-16）。D4（新發現點名別的 repo）不在本機配號、列在輸出等人類裁決。測試：`test/lane-ticket-allocation.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/e298-finish-remote-delete.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e246-mailbox-teardown.test.mjs`（也讀 skill-integrator 的 Stage 6 finish／mailbox 句 —— e288 不得改那些字）。
- **E324 的落點**：`tools/registry.ts` `emitZodGateTelemetry`：`workspace_path` 是 `<ws>/.current/<lane>`（或任何 `.current` 之下的目錄）時不 emit；測試 `test/e303-zod-boundary-telemetry.test.mjs`。
- **E325 的落點**：`tools/drift.ts` 先選路徑再讀的窗口，照 E312 的作法（讀不到時改讀另一側一次）；測試 `test/drift-*.test.mjs`（只在需要時）＋ 新測試檔。
- **E326（人類核准入本波，整合者配號 2026-10-16）**：v4.7.0 發版的 release-engineer 回報 —— 發版 8b 預設的分支範圍 `--ci-check --strict`（不帶 `--sha`）在剛建的 `release/*` 分支上一個已完成 run 都沒有時立刻 FAIL（`scripts/verify-release.mjs:539–541`，`no completed CI runs found on …`，非 commit 範圍的空清單不輪詢），所以 8b 第一次幾乎必失敗；當時以 E320 的 `--sha` 路徑繞過。修法：讓分支範圍的空清單也在預算內輪詢（只動 script，不動 `content/skill-release-engineer.md`），併進 e287（`scripts/verify-release.mjs` 與 `test/verify-release.test.mjs` 都不在其他 lane）。
- **E288 的落點**：`content/skill-integrator.md`（可選 Stage 0、權限表允許派 PM 寫 ticket-cut 檔，不寫 `tasks.md`、不呼叫寫入型 `tw_*`）、`content/skill-pm.md`（對應一列；PM budget 上限 4401，`test/context-budget.test.mjs`）；D3 跨 repo 交辦單格式。`test/e178a-integrator-role.test.mjs` 檢查 SOP 內容。
- **E323 的落點**：`test/e178a-integrator-role.test.mjs:19`／`:283`（const-15 對固定 base `3c72a83` 算增加行數）、`test/e296-manifest-tier.test.mjs:290` AC10（HEAD render 對固定 base `c392cc3` render）→ 改成內容／結構斷言或測試內固定 fixture；慣例句「常駐測試只斷言真實清單的穩定結構或用測試內固定清單，絕不對固定 lane base sha 做 diff」寫進 `content/skill-qa-engineer.md`（qa 寫測試的 SOP）。
- task id：e283 用 `T-E283-NN`／`T-E322-NN`／`T-E316-NN`；e287 用 `T-E287-NN`／`T-E324-NN`／`T-E325-NN`／`T-E326-NN`；e288 用 `T-E288-NN`／`T-E323-NN`。不重用前波 id。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要就在測試裡建固定清單／fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/lane-protocol.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`（e287 擁有的 `bin/agc-init.mjs` 除外）。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e283 | E283、E322、E316 | feat/e283-fanout-handoff-and-ref-check | ../agent-governance-mcp-lanes/e283 | `tools/fanout-manifest.ts` 與其 `dist/tools/fanout-manifest.*`、`scripts/fanout.mjs`、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e248-relative-mailbox-header.test.mjs`、`test/e283-*.test.mjs`、`test/e322-*.test.mjs`、`test/e316-*.test.mjs`、`specs/e283-*`、`qa_reports/*E283*`、`qa_reports/*E322*`、`qa_reports/*E316*`、`review_reports/*E283*`、`review_reports/*E322*`、`review_reports/*E316*`、`.current/e283/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/**`、其他 `scripts/**`、其他 `tools/**`、`gates/**`、`bin/**`、其他 `test/**`（特別是 `test/e296-manifest-tier.test.mjs`、`test/e178a-integrator-role.test.mjs`）、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E283：清單結案時 `validate` 要求 `## 接手步驟` 與四個必填子項（核對 primary、已結案、待人類決定、進行中的背景工作），「進行中的背景工作」必須是「無」，擋本機絕對路徑；「裝置」「工具」子項可選；「已結案」如何判斷、舊清單是否豁免由 PM 決定。(2) E322：新增 ref／路徑清單比對模式，對每條 lane 的擁有欄報告命中；介面由 PM 定。(3) E316：`parseCutSection` 把 `/^ {0,3}##[ \t]+cut[ \t#]*$/i` 的每一行計入 `CUT_SECTION_DUPLICATE`。硬條件：現有每一份 `specs/fanout-*.md` 的 `validate` 結果不變、`render` 對既有清單 byte-identical、`test/e296-manifest-tier.test.mjs`（不擁有）全綠不改。　不做：改 `content/skill-integrator.md`（E322 的 SOP 改字另議）；E284 `handoff` 指令；E314／E315；改 `docs/lane-protocol.md`。 | 無 |
| e287 | E287、E324、E325、E326 | feat/e287-finish-findings-and-small-fixes | ../agent-governance-mcp-lanes/e287 | `bin/agc-init.mjs`、`tools/lane-ticket-allocation.ts` 與其 `dist/tools/lane-ticket-allocation.*`、`tools/registry.ts` 與其 `dist/tools/registry.*`、`tools/drift.ts` 與其 `dist/tools/drift.*`、`scripts/verify-release.mjs`（只限 E326）、`test/lane-ticket-allocation.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/e298-finish-remote-delete.test.mjs`、`test/e180-abandoned-harvest.test.mjs`、`test/e246-mailbox-teardown.test.mjs`（只在 finish 行為改變需 re-pin 時）、`test/e303-zod-boundary-telemetry.test.mjs`、`test/drift-*.test.mjs`（只在需要時）、`test/verify-release.test.mjs`（只限 E326；E238 timing 測試不動）、`test/e287-*.test.mjs`、`test/e324-*.test.mjs`、`test/e325-*.test.mjs`、`test/e326-*.test.mjs`、`specs/e287-*`、`qa_reports/*E287*`、`qa_reports/*E324*`、`qa_reports/*E325*`、`qa_reports/*E326*`、`review_reports/*E287*`、`review_reports/*E324*`、`review_reports/*E325*`、`review_reports/*E326*`、`.current/e287/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/**`、其他 `scripts/**`（特別是 `scripts/fanout.mjs`）、其他 `tools/**`（特別是 `tools/fanout-manifest.ts`、`tools/handoff-parse.ts`）、`gates/**`、其他 `bin/**`、其他 `test/**`、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E287：`.current/<lane>/pending-tickets.md` 不在 base revision（agc 產物不進版控的 repo）時 finish 至少警告、不再靜默；新發現放哪裡由 PM＋architect 決定；D4：新發現點名別的 repo 時不在本機配號、在輸出列出等人類裁決。走 architect hop（人類核准），architect Open Questions 預審第二次。(2) E324：`emitZodGateTelemetry` 在 `workspace_path` 位於 `.current` 之下（含 `<ws>/.current/<lane>`）時不 emit。(3) E325：`tools/drift.ts` 讀 handoff 的「先選路徑再讀」窗口照 E312 作法補上（讀不到改讀另一側一次）。(4) E326：`verify-release.mjs` 分支範圍的空清單也在輪詢預算內輪詢，預算用完才 FAIL／WARN（照 `--strict`）；`--sha` 路徑與 gh 不可用的降級不變。　不做：改 `content/skill-release-engineer.md` 8b 字句；E291（node_modules 連結位置，同檔，下一波）；改 `templates/**`。 | 無 |
| e288 | E288、E323 | feat/e288-integrator-stage0-and-test-hygiene | ../agent-governance-mcp-lanes/e288 | `content/skill-integrator.md`、`content/skill-pm.md`、`content/skill-qa-engineer.md`（只限 E323 慣例句）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/render-structure.test.mjs`、`test/skill-frontmatter.test.mjs`（只在需要 re-pin 時）、`test/cut-approval-gate.test.mjs`（同上）、`test/e5-intake-tiering.test.mjs`（同上）、`test/skill-manifest.test.mjs`（同上）、`test/subagent-templates.test.mjs`（同上）、`test/ac-execution.test.mjs`（同上）、`test/e164-e167-content.test.mjs`（同上）、`test/repro-first-gate.test.mjs`（同上）、`test/e43-test-file-ask-at-dispatch.test.mjs`（同上）、`test/e288-*.test.mjs`、`test/e323-*.test.mjs`、`specs/e288-*`、`qa_reports/*E288*`、`qa_reports/*E323*`、`review_reports/*E288*`、`review_reports/*E323*`、`.current/e288/**` | 其他 `content/**`（特別是 `content/const-*.md`、`content/coord-*.md`）、`tools/**`、`gates/**`、`scripts/**`、`bin/**`、其他 `test/**`（特別是 `test/e246-mailbox-teardown.test.mjs`、`test/lane-ticket-allocation.test.mjs` 與 e283 擁有的 fanout 測試）、`dist/**`、其他 `specs/**`、`docs/**`、共同禁止的全部項目 | 做：(1) E288：`content/skill-integrator.md` 加可選 Stage 0（票已切好就跳過）：派 PM 只寫一份 ticket-cut 檔（不寫 `tasks.md`、不呼叫寫入型 `tw_*`），與清單一起核准；權限表加對應一列；D3 跨 repo 標準交辦單（背景含已定契約與出處、目前狀態、要做、不做）是 Stage 0 的一種輸入，路徑仍由人類帶；`content/skill-pm.md` 加對應一列，讓 brief 不必重述協定；PM budget 上限由 qa 實測、人類核准 cut 時定。(2) E323：`test/e178a-integrator-role.test.mjs` 的 const-15 固定 base 行數、`test/e296-manifest-tier.test.mjs` AC10 的固定 base render 比對 → 改成內容／結構斷言或測試內固定 fixture；`content/skill-qa-engineer.md` 加一行慣例。不得改 `test/e246-mailbox-teardown.test.mjs` 釘住的 Stage 6 finish／mailbox 句。　不做：憲法片段與 coordinator SOP；E285／E294／E289／E290／E292（改版其他票）；E322 的 SOP 改字。 | 無 |

## 所有權重劃（相對於預設）
- 三條 lane 擁有集合不相交；共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e288。
- **`bin/agc-init.mjs` 劃給 e287**：前幾波都在共同禁止；本波 E287 必須改它，共同禁止改成「`bin/**`（e287 的 `bin/agc-init.mjs` 除外）」。
- **`test/e296-manifest-tier.test.mjs` 劃給 e288**：它讀 skill-pm／skill-integrator／lane-protocol，且 E323 要改它的 AC10；e283 的 E316 新案例改寫在 e283 自己的新測試檔，e296 測試檔對 e283 是硬條件（全綠不改）。
- **`test/e246-mailbox-teardown.test.mjs` 劃給 e287**（finish 的 mailbox 拆除行為）；它也釘 skill-integrator 的 Stage 6 句，e288 不得改那些字。
- **E322 只做工具**：SOP 條件 2 的改字不在本波（e288 擁有 skill-integrator，但不含此句），避免 content lane 依賴 e283 的介面。
- **`docs/lane-protocol.md` 本波無人擁有**，列入共同禁止。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| 結案清單缺 `## 接手步驟`（或四個必填子項、或「進行中的背景工作」不是「無」、或含本機絕對路徑）時 `validate` 失敗；舊清單依 PM 的豁免規則處理且現有每一份 validate 結果不變 | e283（E283） | ✓ |
| `fanout.mjs` 有 ref／路徑清單模式，對每條 lane 的擁有欄報告命中 | e283（E322） | ✓ |
| `##<TAB>Cut`、前導 1–3 空白、小寫 `## cut` 與合法 `## Cut` 並存時 `check --cut` 報 `CUT_SECTION_DUPLICATE` | e283（E316） | ✓ |
| finish 遇到 base 上沒有 `pending-tickets.md` 時會警告；點名別 repo 的新發現不在本機配號、列在輸出 | e287（E287） | ✓ |
| `workspace_path` 在 `.current` 之下時 zod 邊界 telemetry 不 emit | e287（E324） | ✓ |
| `tools/drift.ts` 併發遷移時不會因「先選再讀」少讀 handoff | e287（E325） | ✓ |
| 剛建的 release 分支 8b `--ci-check --strict` 在預算內輪詢、不立刻 FAIL | e287（E326） | ✓ |
| skill-integrator 有可選 Stage 0、權限表允許派 PM 寫 ticket-cut 檔；skill-pm 有對應列；D3 交辦單格式 | e288（E288） | ✓ |
| e178a 的 const-15 斷言與 e296 AC10 不再對固定 base 做 diff；skill-qa-engineer 有慣例句 | e288（E323） | ✓ |
| goldens 重產、budget 綠（調高由人類核准 cut 時定） | e288（qa） | ✓ |
| E283、E322、E316、E287、E324、E325、E326、E288、E323 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時自己寫 `## 接手步驟`（E283 併入後的第一份） | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e288 → e283 → e287（共享生成物 lane 先）；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（E320 已出貨；本機全套只在 CI fallback）。
- e283 併入後本清單即受 E283 的結案規則約束：5c 記帳 commit 寫 `## 接手步驟`。
- E322 出貨後，skill-integrator 條件 2 改用新模式的改字另開票或下一波帶。
- backlog done-mark 與佇列 DONE。

## 合併順序
`integ/post-v4-w5` ← `--no-ff` e288 → merge-invariants → `--no-ff` e283 → merge-invariants → `--no-ff` e287 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w5` → 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main`、`git pull --ff-only` → `git branch -d integ/post-v4-w5`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## Dispatch pins
- e283：`sr-engineer=opus`。
- e287：`sr-engineer=opus`。
- e288：`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-16 | 人類 | v4.7.0 發版後 fan-out 第 5 波 | 整合者 session |
| 2026-10-16 | 整合者 | 草案：e283（E283＋E322＋E316）∥ e287（E287＋E324＋E325，E326 待裁決）∥ e288（E288＋E323，唯一 content lane）；三條擁有集合不相交；`bin/agc-init.mjs` 劃給 e287；`test/e296-manifest-tier.test.mjs` 劃給 e288；E322 只做工具不改 SOP；e287 建議 architect hop | 本檔 |
| 2026-10-16 | 人類 | 核准本清單（全部）：三條 lane（e283、e287、e288）；E326 開票（P2）並入第 5 波、併入 e287；e287 走 architect hop | 整合者 session |
| 2026-10-16 | 整合者 | E326 配號（backlog 列＋佇列 #143），來源為 v4.7.0 release-engineer 的回報（primary handoff pending_notes），不屬任何 lane 檔 | 本檔 |
| 2026-10-16 | 整合者 | 清單 PR #17 merge `dac6069` = 派工 base；派工前核對：三條 lane 點名的擁有／禁止路徑在 base 存在或標為新建、無殘留 branch／worktree；信箱 e283／e287／e288 空建、mailbox-watch 與 lane-status watch 皆 armed；三份 prompt 以 `fanout.mjs render --base dac6069` 產生 | 本檔 |
| 2026-10-16 | 整合者 | 三條 cut 預審 close：e287（`4b8d551`，第一次）、e283（`befadd7`；D1–D5 接受：「已結案」開頭才算結案、舊清單自然豁免，`owners` 介面，Cut 標題變體）、e288（`91c5384`；D1 改劃、D2 上限、D3–D6 接受） | 信箱 e283／e287／e288 |
| 2026-10-16 | 人類 | 在三條 lane 各自的 session 核准 cut；e287 選 O-E326＝A（完整發版的 Check 6 也輪詢空清單）；e288 核准 D1（`test/qa-visual-skill-split.test.mjs` 改劃給 e288，只限把 qa SOP 位元組上限 17900 調到 18500）與 D2（PM budget 上限 4708→4860；清單與票面寫的 4401 是舊值，實際為 4708） | lane session |
| 2026-10-16 | 整合者 | e287 第二次預審（architect `5d0e5ea`）close：Q1–Q6 照 PM 提案，DR-8 維持（`agc check` 孤兒掃描只算本地未處理項）；e283 核准後的 spec 修正 `1cffc6b`（範例家目錄改佔位名、AC-E322-1 lane id 小寫）只動範例、AC 語意不變，不需重新核准；e283 `RANGE_INVALID` 比 spec 嚴（git ref 規則本就禁止），接受；e288 review 選修 2＋3 合為 E288-NEW-1 | 信箱 e283／e287／e288 |
| 2026-10-17 | 人類 | 在 e287 session 核准 architect 結論（session 重啟後） | lane session |
| 2026-10-17 | 整合者 | 5a 三條 lane 收工 close，皆以 `verify-release.mjs --ci-check --sha` 讀 CI（E320 修正後第一次用於 5a）：e288 `3226f5d`（run 38973015994；唯一越界即 D1 那個檔，diff 只改上限）、e283 `33483ae`（run 38974393927；0 越界）、e287 `3cdc90b`（run 39021138304；0 越界；review 第 1 輪 R1 修法選 (a)、R3 延後為 E287-NEW-2、R4 接受不開票）。記下的疑慮：三條 lane 的 sr 與 reviewer 皆為 opus；e288 第一次全套有 3 個計時 flake（主機高負載，重跑全綠，CI 綠） | 本檔 |

## 結案
- 日期 2026-10-17。`integ/post-v4-w5` ← e288（`b9d9eab`）← e283（`1f0535e`）← e287（`95ec767`），皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 三次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；所有 `specs/fanout-*.md` 的 validate 結果與派工 base 相同；整合層 CI run 39021413586 在 `95ec767` 綠。
- 彙總（上限按 lane 計）：e283 3 張 task／hop 4/14／review 0 輪／qa 0 輪；e287 8 張 task（走 architect）／hop 7/14／review 退回 1 輪／qa 0 輪；e288 4 張 task／hop 4/14／review 0 輪／qa 0 輪。
- 完成定義 12 項全部成立（本清單自己的 `## 接手步驟` 為最後一項）。
- 例外：(1) e288 越界一處（D1，人類核准）；(2) e283 核准後的 spec 範例修正；(3) 2026-10-16 夜間主機重啟，三條 lane session 以接續 prompt 重開，lane 狀態無遺失；(4) 三條 lane 的 sr 與 reviewer 同為 opus。
- 新票：E327、E328（e288）、E329–E333（e283）、E334、E335（e287），由 `finish --shipped` 配號，排在佇列 #144–#152；E329（P2）是下一個 content lane 的第一張。
- 下一波建議：content lane E329＋E328＋E334（同為 `content/skill-integrator.md`，E334 另碰 lane-protocol §4）；程式 lane E331＋E330＋E332（`tools/fanout-manifest.ts`，可與 E284 同批）；E333 qa 單一 judge 隨時可做。
- 發版：`main` 帶 E283／E322／E316（fanout 工具）、E287（finish 行為）、E324／E325／E326（修正）、E288／E323（SOP 與測試）→ 建議 MINOR v4.8.0，由人類決定。

## 接手步驟
### 核對 primary
- `git switch main`、`git pull --ff-only` 後，`main` 應含 `integ/post-v4-w5` 的 wave PR merge；`git worktree list` 只有 primary；`git status` 乾淨。
- `tw_get_state` → `tw_detect_drift`：預期只有 T-REL4-02 的既有證據提示。
### 已結案
- 第 5 波三條 lane（e283、e287、e288）已合併、finish、拆除；記帳與本清單在同一個 wave PR。
### 待人類決定
- 是否發版（建議 MINOR v4.8.0）。
- 是否在 `.current/.config.json` 加 `cutApprovalAutoTier.manifest: true`。
- 使用者層級的 teamwork 子代理定義檔是否由 fable 改為 opus。
- 下一波範圍（建議見「結案」）。
### 進行中的背景工作
無
