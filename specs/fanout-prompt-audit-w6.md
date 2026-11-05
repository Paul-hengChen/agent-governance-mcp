# Fan-out: prompt-audit-w6（一 lane：E410＋E413，稽核 G2-16 殘餘＋G2-20，合一條 mini-chain）
base: aacf9b0    integration branch: integ/prompt-audit-w6
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已核准 2026-11-05，派工中。**

範圍由人類指定（coordinator chat：「用 cheapest path 先收 E410＋E413」，2026-11-05）：`docs/prompt-audit-2026-11-02.md` 在 v4.19.2 之後剩下的兩張不需人類取捨的純字句票。E410（佇列 #225）、E413（#228）都已開票。一條 lane、mini-chain（PM cut → sr-engineer → code-reviewer → qa-engineer，無 architect）：兩票都是字句，沒有介面契約要定；小批合併成一個 feature、一輪 review＋QA。本波不改 gate 程式、routing 表、schema、錯誤碼、`tools/**`、`prompts/**`、`dist/**`、`scripts/**`、`templates/**`、`content/coord-*.md`。

- **E410 的內容**（`docs/backlog.md` E410 列）：`Task(...)` 別名只在 `content/coord-02-host-dispatch.md`（host:claude-code）定義；E403／E408 把 coord-* core 片段全部改 host 中性之後，`content/` 其他檔還在用它。**站點集合以規劃時的 grep 為準**（`grep -n Task content/const-*.md content/skill-*.md`，排除 `tasks.md`／`_task`／`completed_tasks`／`TaskStop`／`Task <id>`／`Task-Size`／`Task ordering`／`Task Format`／`Tasks with` 等非別名用法），比票面多出六處，同一個 finding（G2-16 殘餘）、整合者依「併入既有列」決定權併入，見 Decisions。全部 12 處：`content/const-01-core-head.md` 第 33 行（watermark 表「Task-spawned with `model:` pinned by the parent (`Task(subagent_type=…)`)」，兩個 hit）、`content/const-05-core-standards.md` 第 9 行（「Task-dispatched with a silent brief」）、`content/const-08-chain-31-mid.md` 第 2 行與第 5 行（「under Task-subagent dispatch」×2）、`content/const-12-chain-r10-s4.md` 第 2 行（「Background/parallel `Task` fan-out」）、`content/skill-coordinator-lite.md` 第 43 行（「After `Task(subagent_type=…)`」）與第 49 行（「ONLY after `Task(…)`」）、`content/skill-integrator.md` 第 40 行（權限表「Dispatch code-reviewer / qa-engineer (Task)」）、第 177 行（「dispatch `code-reviewer` via Task」）、第 181 行（「dispatch `qa-engineer` via Task」）、第 248 行（「not Task-spawned」）、`content/skill-pm.md` 第 111 行（「Task-subagent dispatch: if your turn ends…」）。做法同 E403／E408 裁定 (a)：逐站 host 中性名詞（「subagent-dispatched」「dispatched subagent call」「subagent-dispatch tool」「subagent dispatch」），不搬別名定義進 core。**票面說「無測試逐字釘住」是不完整的**（規劃時用 filing 時沒用的 pattern 再 grep）：`content/skill-integrator.md` 第 248 行被 `test/e178a-integrator-role.test.mjs` 第 89 行與 `test/e285-integrator-session-handoff.test.mjs` 第 81 行逐字釘住（「(no tier: an MCP-prompt invocation is not Task-spawned, Constitution §1).」），第 177／181 行被 `test/e178a-integrator-role.test.mjs` 第 287／292 行釘住（「via Task on that merge commit」「via Task to regenerate…」）→ qa 重釘三處；其餘九站無逐字 pin。
- **E413 的內容**（`docs/backlog.md` E413 列）：`content/skill-pm.md` 第 109 行 Question Batch Gate 的 Action 格「Consolidate them into ONE upfront `AskUserQuestion` call covering ≤ 4 questions (split into 2 batches if more)」改成 inline 呈報：把批次編號列在回覆裡、每題附建議答案、結束回合；Task-dispatched 的 PM 呈給 coordinator、由 coordinator 轉給人類；其餘（≤ 4 題、答案記進 Dependencies / Prerequisites、rationale 區塊）不變。無測試釘住 `AskUserQuestion` 或「Question Batch」字串（規劃時 grep）。**`skill-pm` stripped body 上限 4849 ~tok 零餘裕**（`test/context-budget.test.mjs` AC9）：新字句必須淨字數 ≤ 0，或在同一列（rationale 區塊之外）等量縮短；上限不提高。
- **同時進行**：無其他 lane。primary 狀態是 v4.19.2 發版後的收尾狀態（release-cd-v4.19.2／release-engineer／In_Progress），與本 lane 無關。

## 派工前核對（整合者，2026-11-05，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`git status` 乾淨；`git fetch` 後 `main` = `origin/main` = `aacf9b0`（PR #88，E410–E414 開票）。遠端沒有任何 `feat/*`、`integ/*`、`docs/*`、`release/*`。`../agent-governance-mcp-lanes/` 只剩空的 `_mailbox/`。
- `.current/.config.json`：`artifacts: "repo"`、`host: "claude-code"`、`cutApprovalAutoTier` 是 `{}` → cut 由人類在 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。`agc check` OK（4.19.2）。
- **共享生成物全在 e410**（addendum §2：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）—— 單 lane，無衝突。
- **預算（上限都不提高，E397 的題目）**：const-01、const-05 是 core、lite skill 也在 lean bundle → lean AC2 上限 5723 ~tok，今日 5682、餘 41；const-08、const-12 是 chain → stripped constitution 上限 10598、non-design 上限 8501（都標 zero headroom，實際餘裕由 lane 的 PM 試套量）；teamwork bundle 上限 21715（上波 21408、餘約 307）；`skill-pm` stripped body 上限 4849 零餘裕。別名改成的名詞都比 `Task(subagent_type=…)` 短或等長，預期淨負；E413 是唯一可能變長的一列，lane 要在試套時量。
- **會動的 golden**：const-01／05／08／12 進所有憲法組合 → `constitution-monolith.txt`、`build-*.txt` 八檔、`hook-*.txt` 兩檔；lite 進 `hook-lite.txt`、`build-lite-*`；integrator／pm skill 不在任何 golden。預期 12 檔中最多 11 檔變（`skill-coordinator-monolith.txt` 不變：coord-* 不動）。
- **釘住站點的測試**（規劃時 grep）：`test/e178a-integrator-role.test.mjs`（第 89、287、292 行）、`test/e285-integrator-session-handoff.test.mjs`（第 81 行）逐字釘 integrator 三站；`test/skill-manifest.test.mjs`、`test/compose-equivalence.test.mjs`、`test/e90-golden-capture-completeness.test.mjs`（golden byte-identity）；`test/render-structure.test.mjs`（結構 ratchet）；`test/context-budget.test.mjs`（五個上限）；`test/e403-lean-dispatch-alias.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`（coord 側，預期不變但同族）；`test/teamwork-lite.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`（讀 lite 第 16 行與 skill-pm，預期不變）。
- **工具**：`scripts/fanout.mjs`、`mailbox-watch.mjs`、`lane-status.mjs`、`merge-invariants.mjs`、`test-lock.mjs`、`verify-release.mjs --ci-check`、`capture-constitution-golden.mjs`、`measure-context-cost.mjs` 都在 base 上。
- **schema**：不升版。憲法標頭（`const-01` 第 1 行 `v3.41.0`）不動（E411 的題目）。task id：`T-E410-NN`、`T-E413-NN`。

### 待人類裁定（Stage 2，2026-11-05）
整合者建議在前；每項都影響 lane 的 cut，派工前問一次，之後 lane 不再問。

1. **E410 站點集合**：以規劃時 grep 的 12 處為準（票面六處＋const-08 ×2、integrator 第 40／177／181 行、pm 第 111 行），同一 finding 併入 E410。建議**照此**；漏掉的六處與票面六處是同一個 lean／非 Claude Code 問題，分兩票只是多一輪。
2. **E410 做法**：(a) 逐站 host 中性名詞（沿用 E403／E408 的詞），或 (b) 別名定義搬進 core。建議 **(a)**。
3. **E413 字句形狀**：Action 格改為「Present the batch inline in your reply, numbered, each with a recommended answer, and end the turn; a subagent-dispatched PM presents it to the coordinator, which relays to the human」類的一句，長度不得超過原句（skill-pm 零餘裕）。建議**照此**，細字句由 lane 定。
4. **Dispatch pins**：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值；文件、spec 裡不得出現個人路徑、內部連結。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔、每個站點對應的 AC 與實作 task。mini-chain：PM 以 backlog E410、E413 列＋本清單的站點集合為 spec 來源寫 cut，不經 architect；PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 每一站改前對現行檔案重新核對行號；PM 在 cut 裡附試套後的五個預算數字（lean、stripped constitution、non-design、teamwork、skill-pm）與 golden 變動清單。
- 不 push、不 merge、不發版、不刪 worktree、不跑 Release workflow；hop 用完 → `type: escalate`。
- 共同禁止：`.github/**`、`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`docs/prompt-audit-2026-11-02.md`、`specs/fanout-*.md`、`specs/release-*`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`README.md`、`AGENTS.md`、`.antigravityrules`、`CLAUDE.md`、`qa_reports/archive/**`、`review_reports/archive/**`、`.current/history/**`、`.current/.config.json`、`.current/_primary/**`、`index.ts`、`tools/**`、`gates/**`、`guards/**`、`prompts/**`、`schema/**`、`lib/**`、`bin/**`、`dist/**`、`scripts/**`、`templates/**`、`content/coord-*.md`、`content/**` 點名六檔的點名行以外、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/dependency-advisories.md`。需要動禁止檔 → 寄信，整合者裁或轉人類。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e410 | E410＋E413 | feat/e410-task-alias-content-tail | ../agent-governance-mcp-lanes/e410 | `content/const-01-core-head.md`（只限第 33 行）、`content/const-05-core-standards.md`（只限第 9 行）、`content/const-08-chain-31-mid.md`（只限第 2、5 行）、`content/const-12-chain-r10-s4.md`（只限第 2 行）、`content/skill-coordinator-lite.md`（只限第 43、49 行）、`content/skill-integrator.md`（只限第 40、177、181、248 行）、`content/skill-pm.md`（只限第 109、111 行）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e285-integrator-session-handoff.test.mjs`、`test/skill-manifest.test.mjs`、`test/compose-equivalence.test.mjs`、`test/e90-golden-capture-completeness.test.mjs`、`test/render-structure.test.mjs`、`test/e403-lean-dispatch-alias.test.mjs`、`test/e408-core-task-alias-tail.test.mjs`、`test/teamwork-lite.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e410-*.test.mjs`、`test/e413-*.test.mjs`（新，qa 定名）、`specs/e410-*.md`、`.current/e410/**`、`qa_reports/`、`review_reports/` | 共同禁止全部；`content/**` 其他檔與點名站點以外的行；`content/coord-*.md` 整個 | 做：12 站 host 中性字句、pm 第 109 行 inline 呈報字句、golden 重抓、五個預算重量、integrator 三站重釘。不做：提高任何上限（E397）、憲法標頭（E411）、qa-visual 模板（E412）、G1-*（E414）、E409 的 lite 第 16 行 | 無 |

## 所有權重劃（相對於預設）
- **`content/**` 從共同禁止移出，劃給 e410，只限六檔的點名行**：addendum §2 的共享生成物（`content/**`、golden、budget 測試）本波只有這一條 lane。`content/coord-*.md` 仍禁止（E403／E408 已收，別名定義留在 coord-02）。
- `test/e178a-integrator-role.test.mjs`、`test/e285-integrator-session-handoff.test.mjs` 劃給 e410（integrator 三站的逐字 pin，qa 重釘）。
- 其餘列出的測試檔劃給 e410 作預期不變／紅了才重釘。
- **`templates/**`、`tools/**`、`dist/**` 回到共同禁止**（上波 w5 的 lite.md／role.ts 重劃不延續）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `content/const-*.md`、`content/skill-*.md` 裡（排除非別名用法）`Task` 別名為 0；四個憲法組合與 lite／pm／integrator skill 在 claude-code 下語意不變；coord-02 別名定義仍唯一 | e410（E410） | ✓ |
| golden 重抓（const 與 lite 相關最多 11 檔，coordinator monolith 不變）；五個預算上限綠且不提高 | e410（E410＋E413，qa） | ✓ |
| `e178a` 第 89／287／292 行、`e285` 第 81 行重釘到新字句；`skill-manifest`、`compose-equivalence`、`e90`、`render-structure`、`e403`、`e408`、`teamwork-lite`、`e391` 綠 | e410（qa） | ✓ |
| `skill-pm` 第 109 行 Question Batch Gate 不再點名 `AskUserQuestion`，改 inline 呈報；第 111 行與 lite 第 21 行的 cut 禁令不動 | e410（E413） | ✓ |
| `dist/` 無差異；`check:bookkeeping` 在 lane HEAD exit 0；`npm audit --audit-level=high` exit 0 | e410（qa 核對） | ✓ |
| E410、E413 done-mark；佇列 #225、#228 勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- `integ/prompt-audit-w6` ← `--no-ff` e410 → merge-invariants。單 lane，預期零衝突。
- `npm run build` 確認 `dist/` 無差異（不改 `.ts`）；`npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- backlog done-mark（E410、E413）與佇列 DONE（#225、#228）。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- 給下次發版的 CHANGELOG 提示：`content/` 裡最後 12 處 `Task` 別名改 host 中性（憲法四個組合與 lite／pm／integrator skill 在非 Claude Code 宿主不再點名未定義工具）；PM Question Batch Gate 改 inline 呈報；golden 重抓、上限不動；無行為變更，建議 PATCH。

## 合併順序
1. `integ/prompt-audit-w6` ← `--no-ff` e410，跑 merge-invariants。
2. `npm run build`（`dist/` 無差異），跑 `check:bookkeeping`。
3. 在 integ 上 `finish e410 --shipped --base integ/prompt-audit-w6`。
4. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
5. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/prompt-audit-w6`。

## Dispatch pins
- e410：`pm=opus`、`sr-engineer=opus`、`code-reviewer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-05 | 人類 | 本波範圍：E410＋E413，cheapest path（coordinator chat「用 cheapest path 先收 E410＋E413」）；兩票進本里程碑由此裁定 | coordinator session |
| 2026-11-05 | 整合者 | E410 站點集合以規劃時 grep 為準：票面六處之外再併入 const-08 第 2／5 行、integrator 第 40／177／181 行、pm 第 111 行（同一 finding，「併入既有列」決定權）；票面「無測試逐字釘住」修正為 integrator 第 177／181／248 行被 e178a／e285 釘住，qa 重釘。草案：一 lane mini-chain，e410 = E410＋E413；待人類裁定 1–4 見上 | 本檔 |
| 2026-11-05 | 人類 | 核准清單與待人類裁定 1–4 全部照整合者建議（「approve」）：E410 站點集合 12 處併入 E410；E410 取 (a)；E413 inline 呈報一句、不比原句長；pins 如 Dispatch pins。這四項寫進 lane 的 spec，lane 不再問 | 整合者 session |
