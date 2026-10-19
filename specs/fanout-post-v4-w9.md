# Fan-out: post-v4 佇列第 9 波（integrator／PM SOP 通用化 lane：E226 + E349 + E350 ∥ lane-protocol lane：E351 + E352）
base: 9205e84    integration branch: integ/post-v4-w9
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-19。** 兩條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w9` merge `61acbc9`（e226）、`e91c254`（e226 之後的 e351）→ finish 兩 lane（E354–E357 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。 `base:` 是規劃基準（v4.11.0 發版記帳 PR #32 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

integrator 改版的收尾波：E290 把 lane 規則拆成 agc 通用檔加 repo 補充檔之後，SOP 與通用檔還有幾處只在本 repo 成立。五張票分兩條 lane：e226 讓 integrator／PM SOP 在 adopter 的 workspace 也能照做（`content/**` 一波只能一條 lane，所以三張都在這裡）；e351 補通用 lane-protocol 的兩個缺口（`artifacts: local` 的 commit 規則、`agc` 不在 PATH 又沒有補充檔時的呼叫方式）。

## 派工前核對（整合者，2026-10-19，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `9205e84`；工作區乾淨。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ 每條 lane 的 cut 由人類在 lane session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **E226 的前提更正**：票面說 `scripts/*.mjs` 與 `docs/lane-protocol.md`「沒有出貨給 adopter」。`package.json` 沒有 `files` 欄、repo 沒有 `.npmignore`，`npx github:…` 安裝的是整個 tracked 樹 —— 這些檔案**在** agc 安裝位置裡。真正的缺口是 SOP 用 repo 相對路徑呼叫（`node scripts/<x>.mjs`），只有 workspace 就是 agc 本身時才跑得起來。E290 已在通用檔 §5 定下寫法：`node <agc 安裝位置>/scripts/fanout.mjs`，補充檔可給 repo 自己的呼叫方式。E226 與 E349 因此是同一件事的兩半，同一條 lane 做。
- **E349 的落點（D1，需人類裁決）**：E349 點名的本 repo 事實，補充檔**已經有**大部分：共享生成物清單（補充檔 §2）、`node bin/agc-init.mjs`（§1）、`npm run build`／`dist/`（§1、§3）、`node scripts/fanout.mjs`（§5）。缺的只有 `mailbox-watch`／`lane-status`／`merge-invariants`／`verify-release`／`test-lock` 的呼叫方式。整合者建議：integrator 讀**同一份**補充檔（不新增 config key、不新增檔案）；SOP 改成「通用呼叫 `node <agc 安裝位置>/scripts/<x>.mjs`，repo 的呼叫方式與共享生成物、建置指令見補充檔」，補充檔 §5 那一行擴成涵蓋全部 `scripts/*.mjs`。
- **E350 併入（整合者裁定，折進既有票）**：同樣的 `node scripts/fanout.mjs check --cut` repo 相對呼叫還出現在 `content/const-08-chain-31-mid.md`（§3.1 Manifest tier 條件 3）與 `content/coord-03-core-fallback.md`（Manifest-tier writer action）。同一類、同一條 content lane，折進 E350 一起改。
- **E351 的落點（D2，需人類裁決）**：工具現況（`bin/agc-init.mjs`）：`artifacts: local` 時 `.current/<lane>/`、`qa_reports/`、`review_reports/` 被 exclude，lane 無法 commit；`finish` 只為「commit 在 `--base` 上」的 `pending-tickets.md` 配號，否則警告、在 primary 的 `.current/history/<YYYY-MM>/<lane>/` 留一份，由整合者手動建票（E287 的 O6 路徑）；`--shipped` 會收割被 ignore 的證據目錄（E214）。已知缺口：E196（`--shipped` 第一次跑時 `.current/<lane>/` 裡被 ignore 的檔案不搬）、E217（`--abandoned` 不收割 `specs/`）。兩個選項：(i) 通用檔寫明 local 模式的行為（lane 不 commit 被 exclude 的路徑；新發現照樣寫 `pending-tickets.md`，由整合者從 history 那份手動建票；證據靠 finish 收割），點名 E196／E217 為已知缺口，不改工具；(ii) 通用檔宣告 fan-out 目前只支援 `artifacts: repo`，local 模式等 E196／E217 修好再寫。整合者建議 **(i)**：team repo 的預設正是 local（E73），宣告 repo-only 等於 adopter 不能扇出；(i) 只寫工具現在真的會做的事。選 (i) 時，integrator SOP 5a 的 `git show <branch>:<evidence path>` 與 `pending-tickets.md` 兩列也要寫 local 模式的讀法 —— 這半在 `content/**`，歸 e226（E226 的「任何 workspace 都能用」）。
- **E352 的落點**：通用檔 §1「`agc` 不在 PATH 上時的呼叫方式見補充規則」改成先給通用後備 `node <agc 安裝位置>/bin/agc-init.mjs`（與 §5 的 fan-out 工具寫法一致），補充檔可覆寫。補充檔本來就給了本 repo 的形式，不動。
- **不在本波**：`tools/fanout-handoff.ts` 產生的 `## 接手步驟` 文字也寫死 `node scripts/fanout.mjs`／`node scripts/mailbox-watch.mjs`（工具輸出，非 SOP）。SOP 的通用呼叫句已足以讓 adopter 照著換路徑；若 lane PM 判定非改不可，記成新發現，不擴大本波。E345（同檔檔頭註解過長）同理不併。
- **會被擊中的測試（規劃時清點，lane PM 逐一核對）**：讀 `content/skill-integrator.md` 的有 `test/e178a-integrator-role.test.mjs`、`e285`、`e286`、`e288`、`e292`、`e295`、`e296`、`e297`、`e329`、`e336`、`skill-frontmatter`；其中 e178a、e286、e295、e296 釘了 E349 要搬的句子（`npm audit`、`npm run build`、`this repo:`、共享生成物清單）。讀 `docs/lane-protocol.md` 的有 e130、e177a、e177b、e178a、e246、e286、e289 ×2、e290、e294、e295、e296、e329、e342、e343。
- task id：e226 用 `T-E226-NN`／`T-E349-NN`／`T-E350-NN`；e351 用 `T-E351-NN`／`T-E352-NN`。不重用前波 id。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要就在測試裡建固定清單／fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`bin/**`、`tools/**`、`gates/**`、`schema/**`、`scripts/**`、`dist/**`、`docs/integrator-revision-2026-10-08.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e226 | E226、E349、E350 | feat/e226-integrator-sop-portable | ../agent-governance-mcp-lanes/e226 | `content/skill-integrator.md`、`content/skill-pm.md`、`content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`、`docs/lane-protocol-addendum.md`、`test/fixtures/compose-golden/**`（只在需要重新固定時）、`test/context-budget.test.mjs`（同上）、`test/e178a-integrator-role.test.mjs`、`test/e285-integrator-session-handoff.test.mjs`、`test/e286-integrator-trust-and-git.test.mjs`（只限 SOP 斷言）、`test/e288-integrator-stage0.test.mjs`、`test/e292-integrator-sop.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`（只限 SOP 斷言）、`test/e296-manifest-tier.test.mjs`（只限 SOP、PM SOP 與憲法斷言）、`test/e297-main-protected-sop.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`（只限 SOP 斷言）、`test/e336-portable-pull.test.mjs`、`test/skill-frontmatter.test.mjs`（只在需要時）、`test/e226-*.test.mjs`、`test/e349-*.test.mjs`、`test/e350-*.test.mjs`、`specs/e226-*`、`qa_reports/*E226*`、`qa_reports/*E349*`、`qa_reports/*E350*`、`review_reports/*E226*`、`review_reports/*E349*`、`review_reports/*E350*`、`.current/e226/**` | 其他 `content/**`、`docs/lane-protocol.md`、其他 `docs/**`、其他 `.current/**`、其他 `test/**`（特別是 `test/e290-lane-protocol-generic.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e177a-manifest.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e289-*.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E226＋E349：`content/skill-integrator.md` 裡的 `node scripts/<x>.mjs` 改成通用呼叫 `node <agc 安裝位置>/scripts/<x>.mjs`，並說明 repo 的呼叫方式見補充檔；Stage 1 共享生成物清單、Stage 4 base-fix 第 5 步的建置與相依稽核、Stage 6 第 1 步「this repo: …」改成指向補充檔（依 D1 裁決）；補充檔 §5 擴成涵蓋全部 `scripts/*.mjs` 的本 repo 呼叫方式。依 D2 裁決選 (i) 時，SOP 5a 的證據列與新發現列補 `artifacts: local` 的讀法（讀 worktree 檔案、`pending-tickets.md` 未 commit 時由 finish 留下的 history 那份手動建票），措辭與 e351 的通用檔一致（以 Decisions 的 D2 列為準，不讀 e351 的 branch）。(2) E350：`content/skill-pm.md` Manifest-Tier 列、`content/const-08-chain-31-mid.md` Manifest tier 條件 3、`content/coord-03-core-fallback.md` Manifest-tier writer action 的 `node scripts/fanout.mjs` 改成同一套通用寫法。硬條件：`test/e290-lane-protocol-generic.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e177a-manifest.test.mjs` AC7、`test/e246-mailbox-teardown.test.mjs`、`test/e289-render-addendum.test.mjs` AC-E289-6（不擁有）全綠不改；補充檔仍只填通用檔寫「見補充規則」的地方、標題結構不變、路徑不含單字 `approval`（e296 AC10）；SOP 不得出現「本 repo 規則絕不在本 SOP」之類的新斷言（e292 cut 預審退回過）。　不做：`docs/lane-protocol.md`（e351）；`tools/fanout-handoff.ts` 產生的文字（見派工前核對「不在本波」）；`skill-release-engineer.md` 的 `node scripts/*.mjs`（本 repo 的發版工具，不屬於 adopter 流程）。 | 無 |
| e351 | E351、E352 | feat/e351-lane-protocol-gaps | ../agent-governance-mcp-lanes/e351 | `docs/lane-protocol.md`、`test/e290-lane-protocol-generic.test.mjs`（只在需要重新固定時）、`test/e294-lane-enterworktree.test.mjs`（只限 §1 斷言）、`test/e351-*.test.mjs`、`test/e352-*.test.mjs`、`specs/e351-*`、`qa_reports/*E351*`、`qa_reports/*E352*`、`review_reports/*E351*`、`review_reports/*E352*`、`.current/e351/**` | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/lane-protocol-addendum.md`、其他 `docs/**`、其他 `.current/**`、其他 `test/**`（特別是 e226 擁有的測試、`test/e130-lane-default.test.mjs`、`test/e177a-manifest.test.mjs`、`test/e177b-mailbox-watch.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e289-*.test.mjs`、`test/e342-*.test.mjs`、`test/e343-*.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E351：依 D2 裁決，在通用檔 §3（commit 規則）與 §4（`pending-tickets.md` 一定要 commit）寫明 `artifacts: local` 的行為 —— (i) 寫工具現況並點名 E196／E217 為已知缺口，或 (ii) 宣告 fan-out 目前只支援 `artifacts: repo`。(2) E352：§1「`agc` 不在 PATH 上時」先給通用後備 `node <agc 安裝位置>/bin/agc-init.mjs`（與 §5 的寫法一致），補充檔可覆寫。硬條件：通用檔路徑不變；`## 1.`、`## 3. `、`## 4. ` 標題位置與「§7 是最後一個 `## ` 標題」不變；e178a AC11／AC14／AC15、e246、e295 AC5、e296 AC4／AC10、e286 AC5／AC6、e329、e177a AC7、e289 AC-E289-6 全綠不改；新行不得與 `PROMPT_TEMPLATE_3B` 任何一行相同；通用檔仍不得含 `test/e290-lane-protocol-generic.test.mjs` AC-E290-3 列出的本 repo 字串（例如 `node bin/agc-init.mjs`、`dist/`、`test/`）—— `node <agc 安裝位置>/bin/agc-init.mjs` 不含這些子字串，可以用。　不做：改工具（`bin/**`；E196、E217 是各自的票）；補充檔與 SOP（e226）。 | 無 |

## 所有權重劃（相對於預設）
- 兩條 lane 擁有集合不相交；共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e226。
- **`docs/lane-protocol-addendum.md` 劃給 e226**：E349 要擴 §5 的呼叫方式；E352 的通用後備不需要改補充檔。
- **E350 併入 `content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`**（整合者折進既有票）：同一個 `node scripts/fanout.mjs check --cut` repo 相對呼叫。
- **local 模式的 SOP 讀法（5a 證據列、新發現列）劃給 e226**：語意屬 E351，但在 `content/**`；兩條 lane 的措辭都以 Decisions 的 D2 列為準，不互讀 branch。
- **`test/e290-lane-protocol-generic.test.mjs`、`test/e294-lane-enterworktree.test.mjs` 劃給 e351**：前者也釘補充檔內容 —— 對 e226 是全綠不改的硬條件（擴 §5 時保留既有字串）。
- **`test/e286`、`test/e295`、`test/e296`、`test/e329` 劃給 e226，只限 SOP／PM SOP／憲法斷言**：它們也釘 lane-protocol 的句子 —— 那些句子對 e351 是全綠不改的硬條件。
- **`tools/**`、`scripts/**`、`bin/**`、`dist/**`、`.current/.config.json` 加進共同禁止**：本波只改文字，不改程式、不動 config。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| integrator SOP 不再用 repo 相對路徑呼叫 agc 的工具；通用呼叫寫成 agc 安裝位置，repo 的呼叫方式見補充檔 | e226（E226） | ✓ |
| integrator SOP 不再把本 repo 的共享生成物、建置指令、`bin/agc-init.mjs` 寫成通用事實；改指向補充檔 | e226（E349） | ✓ |
| 補充檔涵蓋 integrator 會呼叫的全部 `scripts/*.mjs` 的本 repo 呼叫方式 | e226（E349） | ✓ |
| PM SOP、憲法 §3.1 Manifest tier、coord-03 writer action 的 `fanout.mjs check --cut` 呼叫用同一套通用寫法 | e226（E350） | ✓ |
| 通用 lane-protocol 寫明 `artifacts: local` 下的 commit 與新發現規則（或宣告只支援 repo 模式） | e351（E351） | ✓ |
| integrator SOP 5a 的證據與新發現兩列有 local 模式讀法（D2 選 (i) 時） | e226（E226，E351 連帶） | ✓ |
| 通用 lane-protocol 在 `agc` 不在 PATH 又沒有補充檔時給得出可執行的呼叫方式 | e351（E352） | ✓ |
| 被搬動句子釘住的測試重新固定，其他讀這些檔案的測試全綠不改 | e226、e351（各自的 qa） | ✓ |
| E226、E349、E350、E351、E352 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e226 → e351；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback）。整合層 CI 是 e290／e296 測試（同時讀補充檔、SOP 與通用檔）的第一次合併驗證。
- 本清單結案時，記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE；E226 的票面前提更正寫進 done-mark。

## 合併順序
`integ/post-v4-w9` ← `--no-ff` e226（共享生成物 lane 先）→ merge-invariants → `--no-ff` e351 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w9` → 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only` → `git branch -d integ/post-v4-w9`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## 結案
- 日期 2026-10-19。`integ/post-v4-w9` ← e226（`61acbc9`）← e351（`e91c254`），皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39246553167 在 `e91c254` 綠。
- 彙總（上限按 lane 計）：e226 10 張 task／hop 6/14／review 退回 1 輪（缺 expected-red 清單，程序性）／qa 0 輪；e351 2 張 task／hop 4/14／review 0 輪／qa 0 輪。合計 12 張 task、hop 10，每條 lane 都在自己的上限內。
- 完成定義 10 項全部成立（本清單的 `## 接手步驟` 為最後一項）。
- 例外：(1) 兩條 lane 的 PM 都先寫 `next_role=sr-engineer` 才送 cut 預審，整合者在信箱追問後補送；兩條都沒有在預審 close 前派 sr。(2) e226 PM 修 cut 時手改 `.current/e226/tasks.md` 五筆描述（核取未動，E340 的缺口），lane 已在 pending_notes 註明。(3) 兩條 lane 的 sr、reviewer 都是 opus（同模型疑慮，兩份 review 都已註明並以逐字比對補償）；qa 用預設 sonnet。(4) e226 的 sr 有一次沒包 test-lock 跑全套；最終全套由 qa 在 test-lock 下重跑。
- 新票：E354–E356（e226）、E357（e351），都由 `finish --shipped` 配號，排在佇列 #171–#174。
- 發版：`main` 帶 E226／E349／E350（integrator 與 PM SOP、憲法 §3.1 manifest tier 條件 3、coord-03 改用 agc 安裝位置呼叫工具；本 repo 事實移到補充檔；compose golden 與 context budget 重定）、E351／E352（通用 lane-protocol 的 local 模式規則與 `agc` 不在 PATH 時的後備）→ 是否發版與版號由人類決定。

## Dispatch pins
- e226：`pm=opus`、`sr-engineer=opus`。
- e351：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-19 | 整合者 | 草案：e226（E226＋E349＋E350，唯一 content lane，擁有補充檔）∥ e351（E351＋E352，通用 lane-protocol）；兩條擁有集合不相交；E350 折進 `const-08`、`coord-03` 的同類呼叫；local 模式的 SOP 讀法劃給 e226；e290／e294 測試劃給 e351，e178a／e285／e286／e288／e292／e295／e296／e297／e329／e336 劃給 e226（只限 SOP 斷言），互為對方的硬條件；`tools/**`、`scripts/**`、`bin/**`、`dist/**`、`.current/.config.json` 加進共同禁止；`tools/fanout-handoff.ts` 的產生文字與 E345 不併入 | 本檔 |
| 2026-10-19 | 人類 | 核准本清單（全部）：兩條 lane（e226、e351）與四項重劃／折入；D1 —— integrator 讀同一份補充檔（`laneProtocolAddendum`），不新增 key 或檔案，補充檔 §5 擴成涵蓋全部 `scripts/*.mjs`；D2 —— 選 (i)：通用檔寫明 `artifacts: local` 的工具現況並點名 E196／E217 為已知缺口，integrator SOP 5a 的證據與新發現兩列補 local 模式讀法（歸 e226）；Lanes 表不加 `approval` 欄。人類回覆「approve」，D1、D2 照整合者建議記錄 | 整合者 session |
| 2026-10-19 | 整合者 | 清單 PR #33 merge `125b552` = 派工 base（CI 在 `173a1ae` 綠）；派工前核對：兩條 lane 點名的擁有／禁止路徑在 base 存在、無殘留 branch／worktree；信箱 e226／e351 空建、mailbox-watch 與 lane-status watch 皆 armed；兩份 prompt 以 `fanout.mjs render --base 125b552` 產生。派工前把 e351 硬條件的 e290 字串句改寫清楚（原句把 `bin/agc-init.mjs` 列成禁字，與 E352 本身衝突；實際禁的是 AC-E290-3 的子字串），此修正隨記帳 commit 進 integ | 本檔 |
| 2026-10-19 | 整合者 | e351 cut 預審 close（`19fc049`，to-lane#2）：範圍、檔案邊界、DoD 對照皆符合；check --cut exit 0。選填：AC-E351-5 改成解析陣列比對集合 | 信箱 e351 |
| 2026-10-19 | 人類 | 在 e351 lane session 核准 cut（`19fc049`） | e351 lane session；`specs/e351-lane-protocol-gaps.md`，commit `19fc049` |
| 2026-10-19 | 整合者 | e226 cut 預審退回一次（`683251c`，to-lane#2）：`verify-release.mjs` 與 `check-bookkeeping.mjs` 從自己的安裝目錄找 repo root，通用呼叫在 adopter 會查錯 repo → verify-release 比照 C1 改成「repo 的 CI 檢查」（補充檔 §5 給本 repo 寫法，無補充檔時用 `gh` 讀該 sha 的 run）；相依稽核不進補充檔，SOP 改指憲法 §6；`coord-03` 的 `feature-rollup.mjs` 折進 E350 | 信箱 e226 |
| 2026-10-19 | 整合者 | e226 cut 預審 close（`fac8990`，to-lane#3）：verify-release 改成「repo 的 CI 檢查」並有 `gh` 後備（AC-E226-5），相依稽核指憲法 §6，補充檔 §7 不加行；check --cut exit 0。例外：PM 手改 `.current/e226/tasks.md` 五筆 task 的描述（核取狀態未動）—— 憲法 §3 不允許，但沒有改描述的工具（E340），記成例外，lane 在 pending_notes 註明 | 信箱 e226 |
| 2026-10-19 | 人類 | 在 e226 lane session 核准 cut（`fac8990`） | e226 lane session；`specs/e226-integrator-sop-portable.md`，commit `fac8990` |
| 2026-10-19 | 整合者 | 5a：e351 `436f189`（CI run 39239867881）close —— review、qa 皆 0 輪退回；reviewer 選填 (1)（通用檔 E196 子句未提 E206 併入的 `--abandoned` 同型缺口）不退回，記在 done-mark。e226 `c1c9132`（CI run 39246128505）close —— review 退回 1 輪（缺 expected-red 清單，程序性），qa 0 輪；golden 7 檔與 context budget 4 個上限由 lane qa 重擷／重定 | 本檔 |
| 2026-10-19 | 整合者 | 5b：`integ/post-v4-w9` ← e226 `61acbc9` ← e351 `e91c254`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39246553167 綠；finish e226 配號 E354–E356、finish e351 配號 E357 | 本檔 |
