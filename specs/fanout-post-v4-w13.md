# Fan-out: post-v4 佇列第 13 波（lane 工作流 lane：E383 + E385 ∥ 工具小修 lane：E384 + E386 + E346）
base: 1530622    integration branch: integ/post-v4-w13
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-30。** 兩條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w13` merge `5e0b8b1`（e383）、`029f94d`（e384）→ finish 兩條（E387–E390 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。 `base:` 是規劃基準（E383–E386 開票的 PR #53 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

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

## 結案
- 日期 2026-10-30。`integ/post-v4-w13` ← e383 `d3926a0`（merge `5e0b8b1`）← e384 `c103f89`（`029f94d`），皆 `--no-ff`、零衝突 → 無合併審查；每次合併後 merge-invariants PASS；重建 `dist/` 無差異；`check:bookkeeping` OK；`npm audit --audit-level=high` exit 0（只有 moderate）；整合層 CI run 41001717456 在 `029f94d` 綠（golden 與 context budget 在合併後仍綠）。
- 彙總（上限按 lane 計，合計僅供參考）：e383 7 張 task／hop 4/14／review 0 輪退回／qa 0 輪；e384 7 張／hop 4/14／0／0。合計 14 張 task、hop 8，每條 lane 都在自己的上限內，證據與 `completed_tasks` 一致。
- 完成定義：9 項全部成立（E386 的 `checkLane` 預設以新發現 E390 結案，符合核准的範圍縮減）。
- 例外：(1) 兩條 lane 的 sr 與 code-reviewer 都是 opus（同模型疑慮，比照第 11、12 波）。(2) e384 的 qa 沒有做負對照（沒在 base 上確認新測試會紅，lane 已揭露）；e383 的 golden 舊版紅燈由重抓推定。(3) e383 本機一次全套撞到 `test/e132-lane-registry.test.mjs` gap-4 計時，重跑全綠，CI 綠。
- 新發現：E387–E389（e383）、E390（e384）由 `finish --shipped` 配號，排在佇列 #202–#205；e384 code review 的兩處 `gates/visual.ts` 註解問題由整合者併入 E345。
- 發版：`main` 帶 E383（`tools/tasks-lane-migrate.ts`）、E385（`content/coord-03-core-fallback.md`、`bin/agc-init.mjs` 的 `agc check` 提示、`docs/lane-protocol.md` §1／§3、golden）、E384（`gates/visual.ts`）、E386／E346（`tools/fanout-handoff.ts`）。給發版的注意（adopter 可見）：Mode 行的宣告值不在清單內時（含 `mode: Design from Figma` 這種散文式寫法）不再武裝 visual 閘門；`agc check` 不再要求 symlink 證據目錄，反而對指向 worktree 外的 symlink 提示；coordinator SOP 的 Worktree bootstrap obligation 改寫。`GATE_REGISTRY` 仍是 35；不升 schema。是否發版與版號由人類決定。

## 接手步驟
（事實欄位由 `node scripts/fanout.mjs handoff` 產生；接手時先跑 `node scripts/fanout.mjs handoff --check <manifest>`。`<待填：…>` 由整合者填寫。）
### 核對 primary
- 目標分支：main @ 35f20e2
- 目標分支對 origin：一致
- git status：1 項：?? docs/agc-ticket-draft-wc32.md
- worktree：primary（main ← integ/post-v4-w13 @ 39df897）
- lane-status：primary（main ← integ/post-v4-w13 @ 39df897）release-post-v4-w12／In_Progress／release-engineer，hop 3，commits 0，dirty
### 已結案
- 第 13 波兩條 lane（e383、e384）都已合併、finish、拆除；lane 紀錄在 `.current/history/2026-10/`。記帳與本清單在同一個 wave PR。佇列 E383、E384、E385、E386、E346 至此完成。
- 未配號的新發現：無（E387–E390 由 finish 配號，排在佇列 #202–#205；兩處註解問題併入 E345）。
### 待人類決定
- 是否發版、版號（本波動到 `tools/`、`gates/visual.ts`、`bin/agc-init.mjs`、`content/`、`docs/lane-protocol.md`、`dist/`；Mode 宣告值的解讀與 `agc check` 的證據目錄提示屬 adopter 可見的行為改變）。
- 是否開下一波。
- primary 上未追蹤的開票草稿 `docs/agc-ticket-draft-wc32.md` 要不要刪（內容已全數開成 E383–E386；它含外部專案名稱，不進 repo）。
### 進行中的背景工作
無

## Dispatch pins
- e383：`pm=opus`、`sr-engineer=opus`。
- e384：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-30 | 人類 | 第 13 波範圍：E383–E386（PR #53 開票，來自一個 adopter repo 的 lane 波次回報）。人類回覆「fan-out 這四張票開始實作」 | 整合者 session |
| 2026-10-30 | 整合者 | 草案：e383（E383＋E385，lane 工作流，唯一碰共享生成物的 lane）∥ e384（E384＋E386，兩個各約一檔的工具小修合成一條）。重劃：`bin/agc-init.mjs` 從共同禁止移出、劃給 e383；`docs/lane-protocol.md` §1／§3 與 `tools/fanout-manifest.ts` 的 `PROMPT_TEMPLATE_3B` 劃給 e383；`gates/visual.ts` 的 `parseDesignMode` 與 `tools/fanout-handoff.ts` 劃給 e384。範圍縮減：E386 票面「`checkLane` 的 `--base` 預設一併查看」改成只查看、要改就記成新發現（`tools/fanout-manifest.ts` 本波歸 e383）。待人類裁決：E345、E346 是否併入 e384 | 本檔 |
| 2026-10-30 | 人類 | 核准本清單（全部）：兩條 lane（e383、e384）、所有重劃、E386 的範圍縮減（`checkLane` 只查看、要改就記成新發現）；E346 併入 e384；E345 未併入，留在佇列。人類回覆「approve，E346 併入 e384」 | 整合者 session |
| 2026-10-30 | 整合者 | 清單 PR #54 merge `35f20e2` = 派工 base（PR 的 CI run 40995764581 綠）；派工前核對：兩條 lane 點名的擁有／禁止路徑在 base 都存在，沒有殘留 branch／worktree；信箱 e383／e384 已建空檔，mailbox-watch 與 lane-status watch 都已 armed；兩份 prompt 以 `fanout.mjs render --base 35f20e2` 產生。此列隨記帳 commit 進 integ | 本檔 |
| 2026-10-30 | 整合者 | e384 cut 預審 close（`f8b86a4`，to-lane#2）：check --cut exit 0（7 tasks）；每條 AC 都有實作 task。第一版 `325f042` 退回一點：E384 把 `figma-export` 這類「已知 mode + 連字號後綴」讀成未宣告，會引入新的 fail-open 方向；lane 改成開頭是完整已知 mode 加連字號就取該 mode（`no-design` 先比對），只有開頭不是已知 mode 的值（`code`）才當成未宣告。E384 選「未宣告」而非大聲報錯（要新的 GATE_REGISTRY 條目），lane 呈給人類時須講明這是刻意的行為改變。E386 只有 `--check` 讀記錄的目標分支；E346 `--show-toplevel` 失敗時退回現行判斷。新發現 E386-NEW-1（`checkLane` 的 `--base` 預設）等 finish 配號 | 信箱 e384 |
| 2026-10-30 | 整合者 | e383 cut 預審 close（`9ce871e`，to-lane#1）：check --cut exit 0（7 tasks）；每條 AC 都有實作 task。同意 D-E383 (b)（linked worktree、非 `_primary`、路徑被忽略、沒有舊帳本 → 用 lane 帳本；finish 與 `tools/tasks-file.ts` 不改）、D-E385 (b)（證據目錄不 symlink、真目錄由 finish 收割；改 bootstrap obligation 與 `agc check` 提示）、`PROMPT_TEMPLATE_3B` 不改。給人類的建議（needs human ruling，由 lane 呈）：R1 照 PM 建議，指向 worktree 外的證據 symlink 改成警告（翻轉 E111(ii)，只是提示）。非阻擋：`.git` 是檔案也可能是 submodule，留給 sr／reviewer。新發現 E383-NEW-1、E383-NEW-2 等 finish 配號 | 信箱 e383 |
| 2026-10-30 | 人類 | 在 e384 lane session 核准 cut（`f8b86a4`），含 E384 的選項與刻意行為改變（宣告值不在清單內 → 未宣告；已知 mode 加連字號 → 取該 mode；大聲報錯不在本 lane） | e384 lane session；`specs/e384-design-mode-and-handoff-target.md`，commit `f8b86a4`（`cut_approved` 見 lane 的 handoff，尚未 commit） |
| 2026-10-30 | 人類 | 在 e383 lane session 核准 cut（`9ce871e`），R1 裁決照建議：指向 worktree 外的證據目錄 symlink 改成 `agc check` 警告（翻轉 E111(ii)，只是提示） | e383 lane session；`specs/e383-lane-ledger-and-worktree-evidence.md`，commit `8dd1f7b`（R1 與 `cut_approved` 記在同一 commit） |
| 2026-10-30 | 整合者 | e383 E383-NEW-3（finish 區段 `evidenceAtRisk` 的註解指向本 lane 刪掉的 helper）：在清單擁有範圍內、只超出 lane 自己 AC-E385-7 的區段限制，認定為機械性小改 —— code review 若退回就順手修（只改註解），一輪通過則留成新發現 | 信箱 e383（to-lane#2） |
| 2026-10-30 | 整合者 | 5a：e384 `c103f89`（CI run 40999642992）close —— review、qa 都一輪通過；22 檔都在擁有範圍內，`gates/visual.ts` 只動 `parseDesignMode` 與其上方註解；共享生成物未動；新發現 E386-NEW-1 等 finish 配號。review 的註解類非阻擋項（`KNOWN_MODES` 上方 14 行註解、`parseDesignMode` 內過時舊註解）由整合者在 5c 併入 E345。qa 未做負對照（lane 已揭露） | 本檔 |
| 2026-10-30 | 整合者 | 5a：e383 `d3926a0`（CI run 41001309654）close —— review、qa 都一輪通過；27 檔都在擁有範圍內；`bin/agc-init.mjs` 只動 `agc check` 證據警告區段，`tools/fanout-manifest.ts`（`PROMPT_TEMPLATE_3B`）、`tools/tasks-file.ts`、`feature finish` 未動；`content/coord-03-core-fallback.md` 一行、`skill-coordinator-monolith` golden 重抓，context budget 不必重釘。lane 本機一次全套撞到 `test/e132-lane-registry.test.mjs` gap-4 計時（重跑全綠），CI 綠。新發現 E383-NEW-1..3 等 finish 配號；review 選修（`isLinkedWorktree` 第三份拷貝）只記錄 | 本檔 |
| 2026-10-30 | 整合者 | 5b：`integ/post-v4-w13` ← e383 `5e0b8b1` ← e384 `029f94d`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 41001717456 綠 | 本檔 |
| 2026-10-30 | 整合者 | 5c／6：finish e383 配號 E387–E389、finish e384 配號 E390；E387–E390 排在佇列 #202–#205；e384 code review 的兩處 `gates/visual.ts` 註解問題併入 E345；E383、E384、E385、E386、E346 done-mark 與佇列 DONE | 本檔 |
