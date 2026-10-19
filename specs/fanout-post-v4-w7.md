# Fan-out: post-v4 佇列第 7 波（content lane：E285 + E294 + E336 ∥ fanout 工具 lane：E289 + E337 + E338 + E339）
base: 76ed29a    integration branch: integ/post-v4-w7
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-19。** 兩條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w7` merge `a7af0f3`（e285）、`259c7ad`（e289）→ finish 兩 lane（E342、E343 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。 `base:` 是規劃基準（v4.9.0 發版記帳 PR #24 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

照第 6 波結案的建議做：integrator 改版第 3 波。content lane 是 E285（integrator SOP 引用 `fanout.mjs handoff`、接手模式、session 節奏），加上 E294 剩下的 lane-protocol §1 那一半（實測已在 2026-10-14 完成），以及 E336（`git pull --ff-only` 的可攜寫法，改憲法 §6 等四處 content 與 goldens）—— 三張都要改 `content/**` 或 `docs/lane-protocol.md`，而共享生成物一波只能在一條 lane。程式 lane 是 E289（render 指向 repo 補充檔、prompt 範本加 `EnterWorktree` 一行；原本等的 E284、E291 都已出貨），加上 E337、E338、E339（同為 `tools/fanout-manifest.ts`／`tools/fanout-handoff.ts`）。E340（新 `tw_*` 工具）本波不做：照預設排在佇列後段，且新工具要同步 README／CLAUDE.md 的工具數與 SOP 引用，屬共同禁止範圍。E290、E292 是改版第 4 波（分別等 E289＋E294、E285＋E289）。

## 派工前核對（整合者，2026-10-19，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `76ed29a`（v4.9.0：release PR #23 `968a095`、發版記帳 PR #24；tag `v4.9.0`）；遠端另有已合併的 `release/v4.9.0`、`release/v4.9.0-bookkeeping` 兩個分支（刪遠端分支不在整合者授權內，交人類處理）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`<lanes-root>/_mailbox/` 是空的。
- `.current/.config.json` 的 `cutApprovalAutoTier` 是 `{}`，沒有 `manifest: true` → 本波每條 lane 的 cut 仍由人類在 lane session 核准；Lanes 表不加 `approval` 欄（人類 2026-10-19 確認）。
- **E336 的寫法**（人類 2026-10-19 裁定 (a)，見 Decisions）：(a) 四處都改成 `git -c pull.rebase=false pull --ff-only`，不動 §6 的授權清單；(b) 改成 `git fetch` 加 `git merge --ff-only origin/main`，要改憲法 §6 的 base list。兩種寫法的檔案範圍相同（`content/const-15-core-tail.md`、`content/coord-03-core-fallback.md`、`content/skill-integrator.md`、`content/skill-release-engineer.md`、goldens、`test/e297-main-protected-sop.test.mjs`），所以 lane 劃分不受影響；裁定寫進 Decisions，lane 照裁定做。
- **E285 的落點**：`content/skill-integrator.md`（P1 結案必寫交接、Stage 6 第 7 步的下一波建議改為「待人類決定清單＋建議開新 session」；P3 第四種模式 `接手 <manifest>`：讀交接與 Decisions、跑 `node scripts/fanout.mjs handoff --check`、不一致就停；O9 兩小時無新信且無 lane 狀態變化就停 watch，re-arm baseline 記入交接；P4 每一次全套都交給唯讀 verifier 子代理；O11 對話已有別的角色的工作時建議開新 session），`test/e178a-integrator-role.test.mjs`。引用的指令形狀以派工 base 上的 `scripts/fanout.mjs` 為準（`handoff`、`handoff --check`、`handoff --closing` 已出貨）。
- **E294 的落點**：`docs/lane-protocol.md` §1：`feature start` 後用 `EnterWorktree(path=<worktree>)` 切進 worktree、確認目錄與 branch；工具不可用時退回每個指令帶 cd 的規則；寫明實測發現 (1) 隔離 session 的 git 守衛拒絕 `git -C <primary>` 與含 git 的複合指令，git 一條一條下。prompt 範本那一行屬 E289，不在本 lane。
- **E289 的落點**：`tools/fanout-manifest.ts`（`PROMPT_TEMPLATE_3B` 與 render）、`tools/config.ts`（指定 repo 補充檔的新 key）、`docs/config.md`（新 key 說明）、`test/fixtures/e177a/render-e177a.golden.txt`（重新固定）。config schema 要不要升版由 PM 決定；升版時連帶 `schema/versions.ts`、`schema/migrations-config.ts`、`docs/schema-versions.md`。整合者建議：沒設新 key 時，render 仍只指向 `docs/lane-protocol.md`，除了新增的 `EnterWorktree` 一行外 byte-identical。本 repo 的補充檔本身與 `.current/.config.json` 的設定屬 E290（第 4 波）。
- **E337／E338／E339 的落點**：`tools/fanout-manifest.ts`（E337 註解或順序檢查；E338 反引號後的 `**` 不當粗體開頭，空白後的 `**/a/b` 怎麼判由 PM 決定）、`tools/fanout-handoff.ts`（E339 git status 加 `-c core.quotePath=false`，附非 ASCII 檔名 fixture）。**硬條件**：本 repo 現有每一份 `specs/fanout-*.md` 的 `validate` 結果（exit code 與錯誤碼集合）不變。
- **跨 lane 的唯一交會點**：`test/e177a-manifest.test.mjs` AC7 斷言 render 出來的 prompt 不含 `docs/lane-protocol.md` 任何超過 20 字的非空行。E289 的 `EnterWorktree` 範本行與 E294 寫進 §1 的句子由兩條 lane 各自寫，**不得逐行相同**；兩條都在自己的 lane 綠，整合層 CI 會再跑一次 AC7。
- **`test/e178a-integrator-role.test.mjs` AC15** 讀 `tools/fanout-manifest.ts` 中 `PROMPT_TEMPLATE_3B` 上方的 provenance 註解（須含 `content/skill-integrator.md`、`the single canonical copy`、`E177a render golden`）：e289 改範本時保留這三段字，e178a 屬 e285，對 e289 是硬條件（全綠不改）。
- task id：e285 用 `T-E285-NN`／`T-E294-NN`／`T-E336-NN`；e289 用 `T-E289-NN`／`T-E337-NN`／`T-E338-NN`／`T-E339-NN`。不重用前波 id。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要就在測試裡建固定清單／fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e285 | E285、E294、E336 | feat/e285-integrator-session-handoff | ../agent-governance-mcp-lanes/e285 | `content/skill-integrator.md`、`content/const-15-core-tail.md`（只限 E336 那一句）、`content/coord-03-core-fallback.md`（只限 E336 那一句）、`content/skill-release-engineer.md`（只限 E336 那一句）、`docs/lane-protocol.md`（只限 §1）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`、`test/e288-integrator-stage0.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e246-mailbox-teardown.test.mjs`（只限 SOP／lane-protocol 句子的重新固定，finish 行為案例不動）、`test/e130-lane-default.test.mjs`（只在需要重新固定時）、`test/skill-frontmatter.test.mjs`（同上）、`test/render-structure.test.mjs`（同上）、`test/e285-*.test.mjs`、`test/e294-*.test.mjs`、`test/e336-*.test.mjs`、`specs/e285-*`、`qa_reports/*E285*`、`qa_reports/*E294*`、`qa_reports/*E336*`、`review_reports/*E285*`、`review_reports/*E294*`、`review_reports/*E336*`、`.current/e285/**` | 其他 `content/**`（特別是 `content/skill-pm.md`、`content/skill-qa-engineer.md`）、`tools/**`、`gates/**`、`scripts/**`、`dist/**`、其他 `docs/**`（特別是 `docs/config.md`、`docs/lane-protocol.md` 的 §2–§7）、其他 `test/**`（特別是 `test/e296-manifest-tier.test.mjs`、`test/e177a-manifest.test.mjs` 與 e289 擁有的測試）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E285：integrator SOP 的 P1（結案必寫交接、Stage 6 第 7 步改為待人類決定清單＋建議開新 session，人類可在 `handoff --check` 後說繼續）、P3 接手模式、O9 兩小時停 watch 與 baseline 記入交接、P4 全套交給唯讀 verifier、O11 建議開新 session。(2) E294：lane-protocol §1 加 `EnterWorktree` 切入、確認目錄與 branch、工具不可用時退回 cd 規則、git 一條一條下。(3) E336：照 Decisions 的人類裁定改四處 `git pull --ff-only` 寫法，重新固定 e297 與 goldens。硬條件：`test/e296-manifest-tier.test.mjs`、`test/e177a-manifest.test.mjs`（不擁有）全綠不改 —— 不得改 e296 釘住的 lane-protocol §5-2 與 skill-integrator Stage 2 句子，§1 新句不得與 E289 的範本行逐行相同；`test/e246-mailbox-teardown.test.mjs` 釘住的句子只能在同一個改動裡重新固定、語意不變；引用的指令形狀以派工 base 為準。　不做：prompt 範本的 `EnterWorktree` 行（E289）；lane-protocol 改通用寫法與補充檔（E290）；姊妹 repo（E292）；mid-wave 交接（E293，暫緩）。 | 無 |
| e289 | E289、E337、E338、E339 | feat/e289-render-addendum | ../agent-governance-mcp-lanes/e289 | `tools/fanout-manifest.ts` 與其 `dist/tools/fanout-manifest.*`、`tools/fanout-handoff.ts` 與其 `dist/tools/fanout-handoff.*`、`tools/config.ts` 與其 `dist/tools/config.*`、`docs/config.md`、`scripts/fanout.mjs`、`schema/versions.ts`、`schema/migrations-config.ts` 與其 `dist/schema/versions.*`、`dist/schema/migrations-config.*`（只在 PM 決定升 config schema 版本時）、`docs/schema-versions.md`（同上）、`test/fixtures/e177a/**`、`test/e177a-manifest.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e248-relative-mailbox-header.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e284-fanout-handoff.test.mjs`、`test/e332-absolute-path-boundaries.test.mjs`、`test/config-versioning.test.mjs`（只在升版時）、`test/e291-start-link-locations.test.mjs`（只在 config 解析共用 helper 改動需要時）、`test/e289-*.test.mjs`、`test/e337-*.test.mjs`、`test/e338-*.test.mjs`、`test/e339-*.test.mjs`、`specs/e289-*`、`qa_reports/*E289*`、`qa_reports/*E337*`、`qa_reports/*E338*`、`qa_reports/*E339*`、`review_reports/*E289*`、`review_reports/*E337*`、`review_reports/*E338*`、`review_reports/*E339*`、`.current/e289/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、其他 `docs/**`（特別是 `docs/lane-protocol.md`）、其他 `scripts/**`、其他 `tools/**`、`gates/**`、其他 `dist/**`、其他 `test/**`（特別是 `test/e178a-integrator-role.test.mjs`、`test/e296-manifest-tier.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E289：config 新 key 指定 repo 的 lane-protocol 補充檔；render 的 prompt 同時指向通用規則（解析到 agc 安裝位置）與補充檔；`PROMPT_TEMPLATE_3B` 加「`feature start` 後用 `EnterWorktree` 切進 worktree」一行；`docs/config.md` 說明新 key；schema 升版與否由 PM 決定。(2) E337：`HANDOFF_SUBITEMS` 註解與 validate 行為一致（改註解或加順序檢查，PM 決定）。(3) E338：反引號後的 `**/a/b` glob 不再誤報 `HANDOFF_ABSOLUTE_PATH`；空白後的情形由 PM 決定並寫入 spec。(4) E339：handoff 的 git status 事實以 `-c core.quotePath=false` 收集，附非 ASCII 清單檔名 fixture。硬條件：現有每一份 `specs/fanout-*.md` 的 `validate` 結果不變；沒設新 key 時 render 除新增的 `EnterWorktree` 行外 byte-identical；`PROMPT_TEMPLATE_3B` 上方 provenance 註解保留 e178a AC15 檢查的三段字；`test/e178a-integrator-role.test.mjs`、`test/e296-manifest-tier.test.mjs`（不擁有）全綠不改；範本行不得與 `docs/lane-protocol.md` 任何超過 20 字的行相同。　不做：改 `docs/lane-protocol.md` 與本 repo 的補充檔（E290、E294）；改 `content/**`（SOP 引用屬 E285）；姊妹 repo 宣告（E292）。 | 無 |

## 所有權重劃（相對於預設）
- 兩條 lane 擁有集合不相交；共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e285。
- **`docs/lane-protocol.md` 劃給 e285，只限 §1**：E294 必須改它；§2–§7 不動（E290 第 4 波才改通用寫法）。
- **`docs/config.md` 劃給 e289**：E289 的新 key 要寫進去；e285 一律禁止其他 `docs/**`。
- **`content/const-15-core-tail.md`、`content/coord-03-core-fallback.md`、`content/skill-release-engineer.md` 劃給 e285，只限 E336 那一句**：第 6 波它們在禁止範圍；E336 必須改它們。
- **`test/e178a-integrator-role.test.mjs` 劃給 e285**：它同時讀 `tools/fanout-manifest.ts` 的 provenance 註解（AC15），所以 e289 改範本時保留那三段字，對 e289 是硬條件。
- **`test/e177a-manifest.test.mjs` 劃給 e289**：它同時讀 `docs/lane-protocol.md`（AC7），所以 e285 寫 §1 新句時不得與範本行逐行相同，對 e285 是硬條件。
- **`README.md` 加進共同禁止**：第 6 波沒列；本波任何 lane 都不需要改它。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| integrator SOP 寫明結案必寫交接、不提下一波，Stage 6 第 7 步改為待人類決定清單＋建議開新 session | e285（E285） | ✓ |
| integrator SOP 有 `接手 <manifest>` 模式：讀交接與 Decisions、跑 `handoff --check`、不一致就停 | e285（E285） | ✓ |
| integrator SOP 寫明兩小時停 watch、baseline 記入交接、全套交給唯讀 verifier、建議開新 session | e285（E285） | ✓ |
| lane-protocol §1 寫明 `EnterWorktree` 切入、確認目錄與 branch、退回 cd 規則、git 一條一條下 | e285（E294） | ✓ |
| 四處 `git pull --ff-only` 改成人類裁定的可攜寫法，e297 與 goldens 重新固定 | e285（E336） | ✓ |
| goldens 重產、budget 綠 | e285（qa） | ✓ |
| config 新 key 可指定 repo 補充檔，render 同時指向通用規則與補充檔；沒設時行為不變；`docs/config.md` 有說明 | e289（E289） | ✓ |
| render 的 prompt 有 `EnterWorktree` 一行，E177a render golden 重新固定 | e289（E289） | ✓ |
| `HANDOFF_SUBITEMS` 的註解與 validate 行為一致 | e289（E337） | ✓ |
| 反引號後的 `**/a/b` glob 不再被判為絕對路徑；現有清單 validate 結果不變 | e289（E338） | ✓ |
| 非 ASCII 清單檔名在 `handoff --check` 不再誤報 git status 差異，有 fixture 測試 | e289（E339） | ✓ |
| E285、E294、E336、E289、E337、E338、E339 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時自己寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e285 → e289；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback）。
- 本清單結案時用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟` 的事實欄位，再以 `handoff --check` 核對；並照 E285 新寫的 SOP 結案（不提下一波，只列待人類決定）。
- 改版第 4 波（E290 lane-protocol 通用寫法與本 repo 補充檔、E292 姊妹 repo）列入待人類決定。
- backlog done-mark 與佇列 DONE。

## 合併順序
`integ/post-v4-w7` ← `--no-ff` e285 → merge-invariants → `--no-ff` e289 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w7` → 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main`、`git pull --ff-only` → `git branch -d integ/post-v4-w7`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## Dispatch pins
- e285：`sr-engineer=opus`。
- e289：`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-19 | 整合者 | 草案：e285（E285＋E294＋E336，唯一 content lane）∥ e289（E289＋E337＋E338＋E339）；兩條擁有集合不相交；`docs/lane-protocol.md`（只限 §1）與三個 content 檔（只限 E336 那一句）劃給 e285；`docs/config.md` 劃給 e289；e178a 與 e177a 互為對方的硬條件；E340 本波不做；`README.md` 加進共同禁止 | 本檔 |
| 2026-10-19 | 人類 | 核准本清單（全部）：兩條 lane（e285、e289）與七項所有權重劃；一併接受整合者的四項建議 —— E336 用 (a) `git -c pull.rebase=false pull --ff-only`、不動 §6 授權清單；E340 本波不做；`cutApprovalAutoTier.manifest` 本波不開；v4.8.0 回報的 9a 問題照建議處理 | 整合者 session |
| 2026-10-19 | 整合者 | v4.8.0 回報的 9a 問題不併進 E82：E82 已在 v3.111.0 完成且只處理 CI 輪詢預算，這次是整體執行時間與 API 連線錯誤只給警告；改配號 E341（backlog 列＋佇列 #158，排在後段），列內註明與 E82 相關 | 本檔 |
| 2026-10-19 | 整合者 | 清單 PR #25 merge `93ed15c` = 派工 base；派工前核對：兩條 lane 點名的擁有／禁止路徑在 base 存在、無殘留 branch／worktree；信箱 e285／e289 空建、mailbox-watch 與 lane-status watch 皆 armed；兩份 prompt 以 `fanout.mjs render --base 93ed15c` 產生 | 本檔 |
| 2026-10-19 | 整合者 | 兩條 cut 預審 close：e289（`e4beb2b`；退回一次：G3b 的 `CONFIG_UNREADABLE` 從 exit 2 改為警告、照 key 未設輸出，守住「沒設 key 時 render 不變」）、e285（`fb7aae5`，一次通過）；e285 G1 解讀：e285 列「只限 E336 那一句」= 只限 E336 的指令替換，`content/skill-release-engineer.md` 6 處（5 行）全改；跨 lane 通知 e289 範本行給 e285（e177a AC7） | 信箱 e285／e289 |
| 2026-10-19 | 人類 | 在兩條 lane 各自的 session 核准 cut：e289（`e4beb2b`，G1–G9 照呈）、e285（`fb7aae5`，G1–G4 照呈） | lane session；各 lane spec 與 handoff commit |
| 2026-10-19 | 整合者 | 5a：e285 `3c096c0`（CI run 39197789385）close —— review 退回 1 輪（結案交接產生時機），qa 0 輪；e289 `89512bd`（CI run 39197761306）close —— review 0 輪，qa 第 1 輪 FAIL 只因 review 報告引用了像家目錄路徑的字串（改寫後 PASS）；e285 的 lane-protocol 全檔對 e289 最終範本行 AC7 交叉比對 0 命中 | 本檔 |
| 2026-10-19 | 整合者 | 5b：`integ/post-v4-w7` ← e285 `a7af0f3` ← e289 `259c7ad`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39198090267 在 `259c7ad` 綠；finish 兩 lane：e285 無新發現，e289 配號 E342、E343 | 本檔 |
| 2026-10-19 | 整合者 | E344 配號（backlog 列＋佇列 #161）：e285 review 的兩項選填（停 watch 後 lane-status watch 的恢復、結案交接時機「唯一未 commit」措辭）lane 未做；E342、E343 排在佇列 #159、#160 | 本檔 |

## 結案
- 日期 2026-10-19。`integ/post-v4-w7` ← e285（`a7af0f3`）← e289（`259c7ad`），皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39198090267 在 `259c7ad` 綠。
- 彙總（上限按 lane 計）：e285 6 張 task／hop 6/14／review 退回 1 輪／qa 0 輪；e289 5 張 task／hop 7/14／review 0 輪／qa 退回 1 輪（review 報告的路徑字樣）。合計 11 張 task、hop 13，每條 lane 都在自己的上限內。
- 完成定義 13 項全部成立（本清單的 `## 接手步驟` 為最後一項，依 E285 新 SOP：記帳 commit 之後、清單是唯一未 commit 的改動時，以 `fanout.mjs handoff --closing` 產生）。
- 例外：(1) 兩條 lane 的 sr、reviewer 都是 opus（同模型疑慮，e285 報告已註明）；qa 用預設 sonnet。(2) e285 沒寫 expected-red 清單檔（檔名不在擁有範圍），預期紅改列在 handoff 並由 qa 全部轉綠。(3) e285 spec AC-E336-4 的 golden diff 指令寫法本身無法輸出空白，qa 改用去前綴版本驗證 —— spec 瑕疵，不影響產物。
- 新票：E342、E343（e289，`finish --shipped` 配號）、E344（整合者配號），排在佇列 #159–#161；E341（規劃時配號）在 #158。
- 發版：`main` 帶 E289（新設定 key `laneProtocolAddendum`、render 指向 repo 補充檔、範本 `EnterWorktree` 行）、E285（integrator 交接與接手模式）、E294、E336（四份 SOP 的 pull 寫法）、E337／E338／E339（修正）→ 是否發版與版號由人類決定。

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 93ed15c
- 目標分支對 origin：一致
- git status：乾淨
- worktree：primary（main ← integ/post-v4-w7 @ cea86e6）
- lane-status：primary（main ← integ/post-v4-w7 @ cea86e6）release-post-v4-w6／In_Progress／release-engineer，hop 3，commits 0，clean
### 已結案
- 第 7 波兩條 lane（e285、e289）已合併、finish、拆除；lane 紀錄在 `.current/history/2026-10/`，記帳與本清單在同一個 wave PR。
- 未配號的新發現：無（E342、E343 由 finish 配號，E344 由整合者配號）。
### 待人類決定
- 是否發版：`main` 帶新設定 key `laneProtocolAddendum`、integrator 接手模式與 SOP 改字 —— 版號由人類決定（新功能，整合者建議 MINOR）。
- 是否開下一波：integrator 改版剩 E290、E292（E293 暫緩）；佇列後段另有 E340–E344。
- 遠端已合併的 `release/v4.9.0`、`release/v4.9.0-bookkeeping` 兩個分支要不要刪（刪遠端分支不在整合者授權內）。
- 建議：下一步（發版或下一波）開新 session 進行；若要在本 session 繼續，先跑 `node scripts/fanout.mjs handoff --check specs/fanout-post-v4-w7.md`，exit 0 才繼續。
### 進行中的背景工作
無
