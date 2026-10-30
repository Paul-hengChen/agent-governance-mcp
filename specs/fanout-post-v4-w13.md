# Fan-out: post-v4 佇列第 13 波（lane 工作流 lane：E383 + E385 ∥ 工具小修 lane：E384 + E386 + E346）
base: 1530622    integration branch: integ/post-v4-w13
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准，派工中。** `base:` 是規劃基準（E383–E386 開票的 PR #53 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

範圍由人類指定：E383–E386，來自一個 adopter repo 的 lane 波次回報（2026-10-19／20），PR #53 開票。依檔案範圍分成兩組，擁有集合互不相交：
- (1) lane 工作流：E383、E385。兩張都落在 lane 的開工與收尾流程上，共用 `bin/agc-init.mjs`（`feature finish` 收割、`agc check` 的 worktree 證據目錄警告）與 `docs/lane-protocol.md`（§1 切進 worktree、§3 帳本與證據）。E385 可能要改 `content/coord-03-core-fallback.md` 的 Worktree bootstrap obligation，所以共享生成物只歸這條 lane。
- (2) 工具小修：E384、E386、E346。各約一個原始檔：`gates/visual.ts` 的 `parseDesignMode`，與 `tools/fanout-handoff.ts` 的 `--target` 預設、姊妹 repo 根目錄核對（E346 由人類裁決併入）。合成一條 lane，一輪 review 加一輪 qa。

## 派工前核對（整合者，2026-10-30，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。PR #53 merge 之後：`main` = `origin/main`，工作區乾淨（未追蹤的開票草稿不進 repo）。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ 每條 lane 的 cut 都由人類在該 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **本 repo 是 `artifacts: "repo"`**：E383、E385 回報的情境（agc 檔案被 git 忽略、證據目錄 symlink 回 primary）在本 repo 不會自然發生，qa 要在測試裡自己建 `artifacts: "local"`／被忽略路徑的 fixture，不能靠本 repo 的現況重現。
- **E383 的站點**：`tools/tasks-lane-migrate.ts` 的 `resolveTasksLedgerPath`（lane 帳本不存在且路徑被忽略時退回舊帳本）；`bin/agc-init.mjs` 的 `feature finish` 收割（目前只收 `.current/<lane>/`）。票面兩個修法：finish 也收割退回的帳本，或 lane worktree 一律用 lane 帳本（若選後者，可能要動 `tools/tasks-file.ts`，條件式劃給本 lane）。cut 擇一並寫明理由；退回機制是給舊的 primary workspace 用的，不能因此壞掉。會被擊中：`test/e125a-lane-local-ledgers.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`。
- **E385 的站點**：`docs/lane-protocol.md` §1（E294 加的「`feature start` 之後用 `EnterWorktree` 切進去」）；`tools/fanout-manifest.ts` 的 `PROMPT_TEMPLATE_3B`（派工 prompt 裡同一句）；`content/coord-03-core-fallback.md` 的 Worktree bootstrap obligation（要求把未追蹤的證據目錄 symlink 回 primary）；`bin/agc-init.mjs` 的 `agc check`（worktree 裡是真的未追蹤目錄時警告、建議 symlink）。衝突的本質：E214 之後 `finish --shipped` 已會收割未連結、被忽略的證據，但 bootstrap obligation 與 `agc check` 仍要求 symlink，而 `EnterWorktree` 隔離不准寫到 worktree 外。修法方向（cut 擇一）：只在文件與派工 prompt 講明；或讓 `EnterWorktree` 的 lane 不建 symlink、證據留在 worktree 由 finish 收割（要一起改 bootstrap obligation 與 `agc check` 的警告）。會被擊中：`test/agc-adapters.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e289-render-addendum.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`，改 `content/**` 時另有 golden 與 context budget。同類的 `PATH=` 前綴被 git 防護拒絕：只記錄在 lane-protocol（git 指令一條一條下的那段），不改防護本身（那是 host 的行為）。
- **E384 的站點**：`gates/visual.ts` 的 `parseDesignMode`（第 109 行起）。E319 只處理同一行兩個已知 mode 的情況。design-auditor SOP 的 Mode 清單（`content/skill-design-auditor.md` 第 22 行）沒有 `code`，所以票面的「把 `code` 加進已知 mode」會動 `content/**`，本波不歸這條 lane：cut 若認定必須加，先停下來寄信。會被擊中：`test/source-credibility-gate.test.mjs`、`test/visual-evidence-gate.test.mjs`（兩者都有 E319 的案例）。
- **E386 的站點**：`tools/fanout-handoff.ts` 的 `collectFacts`（`opts.target ?? "main"`）。清單的 `### 核對 primary` 段已記錄「目標分支：<branch> @ <sha>」，`--check` 可以先讀它。票面另請一併查看 `tools/fanout-manifest.ts` 的 `checkLane` 的 `--base` 預設；`tools/fanout-manifest.ts` 本波劃給 e383（`PROMPT_TEMPLATE_3B`），所以 E386 只改 `tools/fanout-handoff.ts`，`checkLane` 的預設由 lane 查看後記成新發現（本清單的範圍縮減，見 Decisions）。會被擊中：`test/e284-fanout-handoff.test.mjs`、`test/e285-integrator-session-handoff.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e292-handoff-sister-sha.test.mjs`。
- **E346 的站點**（人類裁決併入 e384）：`tools/fanout-handoff.ts` 的姊妹 repo 比對（`## 外部依賴`，第 548 行起）用 `rev-parse --git-dir` 判斷是不是 git repo，巢在別的 repo 工作樹裡的普通目錄也會通過，branch sha 就從外層 repo 讀。票面修法：比對 `--show-toplevel` 與宣告的姊妹 repo 根目錄。會被擊中：`test/e292-handoff-sister-sha.test.mjs`。
- **不在本波**：E345（`tools/fanout-handoff.ts` 檔頭註解超長）人類未裁決併入，留在佇列。E381（`check --cut` 把擁有欄的說明文字解析成 glob）尚未修，所以本清單的擁有欄不寫帶反引號的萬用測試 glob，其他測試檔一律在 cut 裡逐檔列名。
- **共享生成物**：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` 全部歸 e383。
- **`bin/**` 從共同禁止移出，劃給 e383，只限 `bin/agc-init.mjs`**。
- **schema**：兩條 lane 一律不升版。
- task id：
  - e383 用 `T-E383-NN`／`T-E385-NN`。
  - e384 用 `T-E384-NN`／`T-E386-NN`／`T-E346-NN`。
  - 不重用前波 id（E310 的 basename 撞名）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要的話，在測試裡自己建固定清單或 fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔。有 architect 那一跳的 lane，architect 的 Open Questions 也要預審。PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`docs/lane-protocol-addendum.md`、`docs/integrator-revision-2026-10-08.md`、`docs/dependency-advisories.md`、`docs/agc-ticket-draft-wc32.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e383 | E383、E385 | feat/e383-lane-ledger-and-worktree-evidence | ../agent-governance-mcp-lanes/e383 | `bin/agc-init.mjs`（只限 `feature finish` 的收割與 `agc check` 的 worktree 證據目錄警告）、`tools/tasks-lane-migrate.ts`、`dist/tools/tasks-lane-migrate.*`、`tools/tasks-file.ts`（只在 E383 選「lane 一律用 lane 帳本」時）、`dist/tools/tasks-file.*`（同上）、`tools/fanout-manifest.ts`（只限 `PROMPT_TEMPLATE_3B` 的開工指示）、`dist/tools/fanout-manifest.*`、`docs/lane-protocol.md`（只限 §1 的切進 worktree 與 git 指令段、§3 的帳本與證據段）、`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e125a-lane-local-ledgers.test.mjs`、`test/agc-feature-finish-history.test.mjs`、`test/agc-feature-lifecycle.test.mjs`、`test/e213-shipped-ignored-shape.test.mjs`、`test/agc-adapters.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e289-render-addendum.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e351-lane-protocol-gaps.test.mjs`、`test/e383-*.test.mjs`、`test/e385-*.test.mjs`、`specs/e383-*`、`qa_reports/*E383*`、`qa_reports/*E385*`、`review_reports/*E383*`、`review_reports/*E385*`、`.current/e383/**`；其他被本 lane 改變字句或行為釘住的測試檔，cut 裡逐檔列名、預審核對 | `gates/**`、`tools/fanout-handoff.ts`、其他 `tools/**`、其他 `dist/**`、其他 `bin/**`、`scripts/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、其他 `docs/**`、其他 `.current/**`、其他 `specs/**`、e384 擁有的測試、共同禁止的全部項目 | 做：(1) E383：lane worktree 裡的任務帳本在 `agc feature finish` 之後不會遺失 —— finish 也收割退回的帳本，或 lane 一律用 lane 帳本，cut 擇一並寫明理由；`docs/lane-protocol.md` §3 寫明這個情境；qa 用 git 忽略 agc 檔案的 fixture 重現。(2) E385：用 `EnterWorktree` 切進 worktree 的 lane 不再因為寫不進 symlink 的證據目錄而卡住 APPROVED／PASS。修法 cut 擇一（只在文件與派工 prompt 講明；或不建 symlink、證據留在 worktree 由 finish 收割，連同 Worktree bootstrap obligation 與 `agc check` 的警告一起改）；`PATH=` 前綴被拒的同類問題寫進 lane-protocol 的 git 指令段。硬條件：既有錯誤碼與拒絕條件不變；舊 primary workspace 的帳本退回行為不變；`artifacts: "repo"` 的 repo 行為不變；`feature finish` 拒絕時不留半套狀態（既有保證）不變；不升 `schema_version`；改 `content/**` 時 golden 與 context budget 重新固定。　不做：E381；`docs/lane-protocol-addendum.md`；`docs/install.md` 與 `docs/config.md`（若需要，記成新發現）。 | 無 |
| e384 | E384、E386、E346 | feat/e384-design-mode-and-handoff-target | ../agent-governance-mcp-lanes/e384 | `gates/visual.ts`（只限 `parseDesignMode`）、`dist/gates/visual.*`、`tools/fanout-handoff.ts`、`dist/tools/fanout-handoff.*`、`test/source-credibility-gate.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/e284-fanout-handoff.test.mjs`、`test/e285-integrator-session-handoff.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e292-handoff-sister-sha.test.mjs`、`test/e384-*.test.mjs`、`test/e386-*.test.mjs`、`test/e346-*.test.mjs`、`specs/e384-*`、`qa_reports/*E384*`、`qa_reports/*E386*`、`qa_reports/*E346*`、`review_reports/*E384*`、`review_reports/*E386*`、`review_reports/*E346*`、`.current/e384/**`；其他被本 lane 改變行為釘住的測試檔，cut 裡逐檔列名、預審核對 | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`gates/registry.ts`、其他 `gates/**`、`tools/fanout-manifest.ts`、其他 `tools/**`、其他 `dist/**`、`bin/**`、`scripts/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`docs/**`、其他 `.current/**`、其他 `specs/**`、e383 擁有的測試、共同禁止的全部項目 | 做：(1) E384：Mode 行開頭宣告的值優先於說明文字；宣告值不是已知 mode 時不再從說明文字猜出一個已知 mode（大聲報錯或當成未宣告，cut 擇一並寫明理由）；E319 的行為（同一行多個已知 mode 取最前面）不變；qa 加「宣告 `code`、說明文字含 Figma」的案例。(2) E386：`fanout.mjs handoff --check` 沒給 `--target` 時，先用清單 `### 核對 primary` 記錄的目標分支，找不到才退回 `main`；`REF_NOT_FOUND` 的訊息提示 `--target`；查看 `tools/fanout-manifest.ts` 的 `checkLane` 的 `--base` 預設，要改就記成新發現。(3) E346：`handoff --check` 拒絕「巢在別的 repo 工作樹裡的普通目錄」當姊妹 repo（比對 `--show-toplevel` 與宣告的根目錄），用既有的「不是 git repo」錯誤路徑回報；qa 用巢狀目錄的 fixture 重現。硬條件：既有錯誤碼與 exit code 語意不變；明確給 `--target` 時行為不變；沒有 `### 核對 primary` 段的清單行為不變；`GATE_REGISTRY` 不變；不升 `schema_version`；不動 `content/**`（E384 若認定要把 `code` 加進 Mode 清單，先停下來寄信）。　不做：E345；`tools/fanout-manifest.ts`。 | 無 |

## 所有權重劃（相對於預設）
- 兩條 lane 的擁有集合不相交。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部歸 e383。
- **`bin/agc-init.mjs` 從共同禁止移出，劃給 e383**（E383 的 finish 收割、E385 的 `agc check` 警告）。
- **`docs/lane-protocol.md` 劃給 e383，只限 §1 與 §3 的相關段**（E383、E385）。
- **`tools/fanout-manifest.ts` 劃給 e383，只限 `PROMPT_TEMPLATE_3B`**（E385 的派工 prompt 開工指示）。因此 E386 不改 `tools/fanout-manifest.ts`，`checkLane` 的 `--base` 預設由 e384 查看後記成新發現。
- **`tools/tasks-file.ts` 條件式劃給 e383**（只在 E383 選「lane 一律用 lane 帳本」時）。
- **`gates/visual.ts` 劃給 e384，只限 `parseDesignMode`**；`tools/fanout-handoff.ts` 整個劃給 e384。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| git 忽略 agc 檔案的 repo 裡，lane 的任務帳本在 `feature finish` 之後仍保留下來；lane-protocol §3 寫明；有 qa 的 fixture 測試 | e383（E383） | ✓ |
| 用 `EnterWorktree` 切進 worktree 的 lane，code-reviewer 與 qa-engineer 的證據寫得進去，不需要 coordinator 手動複製；lane-protocol、派工 prompt 與 coordinator SOP 的說法一致；`PATH=` 前綴的同類問題寫進 lane-protocol | e383（E385） | ✓ |
| 宣告不在清單內的 Mode 值時，`parseDesignMode` 不再從說明文字猜出 `figma`；E319 的案例仍通過 | e384（E384） | ✓ |
| `handoff --check` 在沒有 `main` 分支的 repo，不加 `--target` 也能用清單記錄的目標分支核對；錯誤訊息提示 `--target` | e384（E386） | ✓ |
| `handoff --check` 不把巢在別的 repo 工作樹裡的普通目錄當成姊妹 repo；有 qa 的巢狀目錄測試 | e384（E346） | ✓ |
| `checkLane` 的 `--base` 預設是否要改有結論（改或記成新發現） | e384（E386 查看，記成新發現由 finish 配號） | ✓ |
| 被改變行為釘住的測試重新固定，其他測試全綠不改 | e383、e384（各自的 qa） | ✓ |
| 5 張票 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e383 → e384。每次 merge 後跑 `merge-invariants`；全部合併後重建 `dist/`、跑 `check:bookkeeping`、`npm audit --audit-level=high`，push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback 時跑）。
- 本清單結案時，記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。

## 合併順序
1. `integ/post-v4-w13` ← `--no-ff` e383（共享生成物 lane 先），再跑 merge-invariants。
2. ← `--no-ff` e384，再跑 merge-invariants。
3. 重建 `dist/`，跑 `check:bookkeeping`。
4. 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w13`。
5. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
6. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/post-v4-w13`。

預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，一律重建。

## Dispatch pins
- e383：`pm=opus`、`sr-engineer=opus`。
- e384：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-30 | 人類 | 第 13 波範圍：E383–E386（PR #53 開票，來自一個 adopter repo 的 lane 波次回報）。人類回覆「fan-out 這四張票開始實作」 | 整合者 session |
| 2026-10-30 | 整合者 | 草案：e383（E383＋E385，lane 工作流，唯一碰共享生成物的 lane）∥ e384（E384＋E386，兩個各約一檔的工具小修合成一條）。重劃：`bin/agc-init.mjs` 從共同禁止移出、劃給 e383；`docs/lane-protocol.md` §1／§3 與 `tools/fanout-manifest.ts` 的 `PROMPT_TEMPLATE_3B` 劃給 e383；`gates/visual.ts` 的 `parseDesignMode` 與 `tools/fanout-handoff.ts` 劃給 e384。範圍縮減：E386 票面「`checkLane` 的 `--base` 預設一併查看」改成只查看、要改就記成新發現（`tools/fanout-manifest.ts` 本波歸 e383）。待人類裁決：E345、E346 是否併入 e384 | 本檔 |
| 2026-10-30 | 人類 | 核准本清單（全部）：兩條 lane（e383、e384）、所有重劃、E386 的範圍縮減（`checkLane` 只查看、要改就記成新發現）；E346 併入 e384；E345 未併入，留在佇列。人類回覆「approve，E346 併入 e384」 | 整合者 session |
