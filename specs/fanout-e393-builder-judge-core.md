# Fan-out: prompt-audit 第 2 波（單 lane：E393 builder ≠ judge 搬出 §3.2、round cap 具名）
base: 8a79731    integration branch: integ/e393-builder-judge-core
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：規劃中 2026-11-02。** `base:` 是規劃基準（PR #60，prompt-audit 第 1 波結案的 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

範圍由人類指定：只做 E393（來源 `docs/prompt-audit-2026-11-02.md` 的 G2-10、G2-21）。單一 lane。E392 不同波：它也改 `coord-02`、`templates/agent-adapters/claude.md` 與 `CLAUDE.md` 的 adapter 區塊，和本票檔案重疊，排在本波之後。E391 已合併，E393 的「依賴 E391」解除。本波是文字與（必要時）manifest 一列，不改任何 gate 程式、routing 表、schema、錯誤碼。

- **E393 的內容**：(1) G2-10：`content/const-11-design-chain-32.md`（manifest tag `chain-design`）的「Builder ≠ judge (role-collapse guard)」一條搬到所有引用它的片段都會載入的片段，§3.2 只留兩條 visual 規則（qa-visual 擁有 visual verdict、No global-frame metric）；每個引用站點改指新位置。(2) G2-21：重述 Limits 表的裸 round 數字改成具名 cap；sr-engineer 的 `visual_round >= 3` 分割門檻在 `const-01` Limits 表新增一列（`visual_split`）。
- **同時進行**：另一個 session 在跑 v4.16.1 發版（release-engineer 會動 `package.json`、`CHANGELOG.md`、`CLAUDE.md`／`AGENTS.md`／`.antigravityrules` 的 `agc-version` 戳記與 `CLAUDE.md` 的「221 test files」字面值、`qa_reports/` 歸檔、`docs/backlog.md`）。lane 的 base 取派工當下的 `main`；整合時 `CLAUDE.md` 若兩邊都動，5b-4 逐 hunk 解。

## 派工前核對（整合者，2026-11-02，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示，已知、不處理）。規劃時 `main` = `origin/main` = `8a79731`。核准後、開 docs PR 前重做：v4.16.1 已落地（PR #61 merge `f3767e5`，記帳 PR #62 merge `ebeb96d`），primary 回到 `main` = `origin/main` = `ebeb96d`，工作區只有本清單與不進 repo 的開票草稿 `docs/agc-ticket-draft-wc32.md`；`8a79731..ebeb96d` 沒有動 `content/**`、`templates/**`、`prompts/**`、compose-golden 或 `test/context-budget.test.mjs`，`CLAUDE.md` 的 Subagent dispatch 仍在第 233 行，點名站點的行號全部不變。遠端沒有 `e393` branch；信箱 `../agent-governance-mcp-lanes/_mailbox/e393/` 已建空檔。
- `.current/.config.json`：`artifacts: "repo"`、`cutApprovalAutoTier` 是 `{}`（沒有 `manifest: true`）→ cut 由人類在 lane 的 session 核准；Lanes 表不加 `approval` 欄。`laneProtocolAddendum` = `docs/lane-protocol-addendum.md`。
- **builder ≠ judge 的引用站點（整合者 2026-11-02 逐一核對現行檔案；行號是 `8a79731` 的）**：
  - 定義：`content/const-11-design-chain-32.md` 第 22–26 行。現行字句只講 visual（「MUST NOT author the visual verdict nor self-issue a visual PASS」）；引用它的核心站點把它當成一般的 reviewer／qa 獨立性底線。搬到新位置時字句要一般化（建造者不得替自己的改動寫 review verdict、qa verdict 或 PASS；沒有獨立的 judge context 就停在 `Blocked`），visual 那半句可留。**這是放寬適用範圍的規則改寫**，lane 呈給人類時要明說。
  - `content/coord-02-host-dispatch.md` 第 1 行（host:claude-code）「a §3.2 builder ≠ judge downgrade」。
  - `content/coord-03-core-fallback.md` 第 39 行（core）Escalation Routes 列「(builder ≠ judge, §3.2)」。
  - `content/coord-05-core-visual-drift.md` 第 3 行（core）「Per Constitution §3.2, the coordinator routes and summarizes」。
  - `content/coord-07-core-sop.md` 第 11 行（core）硬底線「§3.2 builder ≠ judge」。
  - `content/skill-integrator.md` 第 51 行「§3.2 builder ≠ judge」、第 166 行「(§3.2)」。
  - `content/skill-sr-engineer.md` 第 26 行「(§3.2 builder ≠ judge)」——**人類清單外、整合者補列**。同行另一處「Constitution §3.2 — no global-frame metric」指的是留在 §3.2 的規則，不改。
  - `content/skill-qa-visual.md` 第 12 行「(§3.2 builder≠judge provenance)」——**整合者補列**。同檔第 24、69 行引用的是 visual verdict 歸屬（留在 §3.2），不改。
  - `content/const-04-design-surgical.md` 第 2 行「(c) §3.2 is unchanged — … and builder ≠ judge」——**整合者補列**，只改這個引用。
  - `content/constitution-rationale.md` 第 7、10 行（Scope 列 §3.2）、第 104–137 行（§3.2 段與「Why builder ≠ judge」）、第 165 行——**整合者補列**；rationale 對憲法是單向引用，搬家後錨點要跟著。
  - `templates/agent-adapters/claude.md` 第 12 行與 `CLAUDE.md` 第 233 行（adapter 區塊「## Execution Profile — Claude Code」的 Subagent dispatch）：兩處字句相同（`builder != judge`），**一起改**，`agc init` 由模板再生 `CLAUDE.md` 區塊。
  - 不改：`gates/registry.ts` 第 483 行「Constitution §3.2」指的是 visual verdict 歸屬，留在 §3.2，仍可解析；`skill-architect.md` 第 24 行「§3.2 no-global-frame」同理。`docs/`、`specs/`、`research/` 裡的歷史紀錄不改。
- **目的地與 manifest**：人類 2026-11-02 裁定選項 (A)，目的地是 core 片段（`const-05` §3 末，或 `const-15`），兩者都不需要改 `prompts/constitution-manifest.ts`，是 mini-chain。若 cut 改成新增 segment，manifest 與 `dist/prompts/constitution-manifest.*` 由本 lane 擁有，但 intake 變成 full chain（architect），lane 要先寄信、由人類核准。整合者另提一個替代方案，見下方「待人類裁定」。
- **G2-21 裸數字站點（`8a79731`）**：`const-06` 第 8 行「(Round 4 of `qa_round`)」；`const-08` 第 12 行「(Round 4 of `review_round`)」；`const-09` 第 2 行「Round 6 attempts」、第 3 行「Split escalation (Round 3)」「`visual_round >= 3`」「Round 3 through Round 5」「Round 6」；`const-12` 第 13 行「(Round 1-3 QA review; Round 1-5 visual review)」、第 15–16 行「up to 3 rounds」、第 18 行「review Round 1 through the `qa_round` cap」；`skill-qa-engineer.md` 第 66 行「Escalation Routes: unresolved after Round 3」、第 91 行「At Round 4 (the `qa_round` cap of prior FAILs exhausted)」（人類清單的第 92 行，E391 之後移到第 91 行；前一版草案漏列，本次補上）與第 113 行該 Escalation Routes 列（情境名與 pending note 都含 Round 3，第 66 與 113 行要一起改名）；`skill-qa-visual.md` 第 83 行「(Round 6 attempts)」、第 99 行「FAIL past visual round 6」；`skill-sr-engineer.md` 第 28、51 行「`visual_round >= 3`」。新增：`const-01` Limits 表一列 `visual_split`（值 3）。
- **context budget（`node scripts/measure-context-cost.mjs` 與 `test/context-budget.test.mjs`，2026-11-02 於 `8a79731`）**：lean 5722／上限 5723（餘裕 1）；non-design 8495／8501（餘裕 6）；design-arm stripped 10593／10598（餘裕 5）；teamwork 21588／21715（餘裕 127）。把一條規則搬進 core 會讓 lean 與 non-design 長出整條字句，`const-01` 的新 Limits 列也落在 lean；兩者都必然超過。lane 在 cut 裡列出前後實測值，並提出 (i) 等量刪減（列出刪哪幾句）或 (ii) 由人類核准上修 `test/context-budget.test.mjs` 對應的上限到實測值（比照 E336／E365 的重設基準）。上修是人類裁定，不是 lane 或整合者能決定的。
- **會被擊中的測試（qa 在 cut 裡逐檔核對、列名）**：`test/fixtures/compose-golden/**`（12 個 golden 全部重抓——core／chain 片段一動每個組合都變；其中 4 個直接含 §3.2 標頭或 builder ≠ judge 字串）、`test/context-budget.test.mjs`（第 517、658–659、712、780–784 行釘 `3.2 Visual Verdict Authority`、`Split escalation (Round 3)`、`up to 3`）、`test/compose-equivalence.test.mjs`（第 137–179 行，const-11 與 rationale 的雙向引用）、`test/e178a-integrator-role.test.mjs` 第 83 行（`SOP.includes("§3.2")`）、`test/e391-prompt-audit-stale-facts.test.mjs` 第 94 行（釘「(Round 4 of `review_round`)」恰好 1 次，本票會改掉它）、`test/e5-intake-tiering.test.mjs` 第 385 行（coord-07 硬底線字句）、`test/e96-dispatch-preference.test.mjs` 第 52 行（coord-02 字句）、`test/phase-0-5-sop.test.mjs` 第 67 行（`visual_round >= 3`）、`test/agc-adapters.test.mjs`（E101 讀 adapter 模板，現不釘 §3.2，核對即可）。`test/qa-flow.test.mjs`、`test/visual-gate-e2e.test.mjs`、`test/visual-round-transitions.test.mjs` 測的是伺服器行為，不受影響、不改。
- **不在本波**：E392（`coord-02`／`coord-04` 的 Task／Agent 字句、`templates/claude-code-agents/**`、`test/subagent-templates.test.mjs`）、E394（`skill-release-engineer.md`）、E395（`CLAUDE.md` 計數與 Layout）、E396。報告裡 G2-17 的重述合併、flag-only 項。`tools/transitions.ts` 與 gate 提示字串裡的 round 數字（程式，不在本票）。
- **共享生成物**：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs` 全部歸 e393（單 lane）。
- **`CLAUDE.md` 從共同禁止移出，劃給 e393，只限第 233 行（adapter 區塊的 Subagent dispatch 一條）**，要和 `templates/agent-adapters/claude.md` 第 12 行同字；`agc-version:` 戳記與其餘正文不碰（發版 session 在動）。
- **`dist/`**：預設不改任何 `.ts`，`npm run build` 後 `dist/` 應無差異；只有在人類核准新增 segment 時，`dist/prompts/constitution-manifest.*` 才會有差異。
- **schema**：不升版。憲法標頭版本（`const-01` 第 1 行 `Constitution v3.40.0`）要不要升由 PM 在 cut 裡寫明。
- task id：`T-E393-NN`。不重用前波 id。

### 待人類裁定（Stage 2）
- **目的地的替代方案（needs human ruling；預設維持已裁定的 (A)）**：除了 `teamwork-lite`，每個 prompt 都載入 chain 片段（`prompts/constitution-manifest.ts` 的 `includeSegment`：`chain` = 非 lite 派工），而引用 builder ≠ judge 的 `coord-*` 只在 `teamwork`（chain）載入。所以把這條放進現有 chain 片段（`const-10` §3.1 末或 `const-12`）也能讓每個 coord 引用解析，且 lean bundle 只多 `visual_split` 一列（約 20 ~tok）而不是整條字句；但 non-design（餘裕 6）仍必然超過，上修或刪減的裁定不變。(A) 的理由：`CLAUDE.md` adapter 區塊每個 session 都載入（含 lite），它引用的規則應該在 lite 的憲法裡也找得到；lite 雖沒有 reviewer／qa 角色，但「沒有獨立 judge 就停在 Blocked」對 lite 的單人模式同樣成立。**整合者建議維持 (A)**，人類已在本 session 派工訊息裡重申 (A)；若人類改選 chain 片段，Lanes 表的 `const-05`／`const-15` 擁有條件改成 `const-10`／`const-12`，其餘不變。
- **時序**（已解）：v4.16.1 與其記帳 PR 在核准後落地，primary 回到 `main`；本清單走 `docs/2026-11-02-fanout-e393` PR，merge sha 為派工 base（見 Decisions 派工列）。
- **E392 開票時的人類裁決**（不在本波，先記下）：`templates/claude-code-agents/teamwork.md` 要修還是刪。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。golden 重抓由 qa 執行並逐 hunk 說明。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後，lane 才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段，cut 裡逐檔列出要動的測試檔、每個站點對應的 AC 與實作 task、搬家後的一般化字句全文、budget 前後實測值與 (i)／(ii) 的提案。本票預設走 mini-chain：PM 寫 cut（以 backlog 列＋本清單為 spec 來源），不經 architect。PM 在預審 `close` 之前不寫 `next_role=sr-engineer`。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/prompt-audit-2026-11-02.md`（報告是來源，不是修改對象）、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`specs/release-*`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/claude-code-agents/**`、`.github/**`、`qa_reports/archive/**`、`.current/history/**`、`.current/.config.json`、`index.ts`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`docs/integrator-revision-2026-10-08.md`、`docs/dependency-advisories.md`、`docs/agc-ticket-draft-wc32.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e393 | E393 | feat/e393-builder-judge-core | ../agent-governance-mcp-lanes/e393 | `content/const-01-core-head.md`（只限 Limits 表新增 `visual_split` 一列與第 1 行版本標頭）、`content/const-04-design-surgical.md`（只限第 2 行 (c) 的引用）、`content/const-05-core-standards.md`（只限 §3 末新增一條）、`content/const-06-chain-31-head.md`、`content/const-08-chain-31-mid.md`（只限第 12 行）、`content/const-09-design-chain-vround.md`、`content/const-10-chain-31-tail.md`、`content/const-11-design-chain-32.md`、`content/const-12-chain-r10-s4.md`、`content/const-15-core-tail.md`（只在目的地選 const-15 時）、`content/constitution-rationale.md`（只限第 7、10、104–137、165 行）、`content/coord-02-host-dispatch.md`（只限 §3.2 引用）、`content/coord-03-core-fallback.md`（只限第 39 行）、`content/coord-05-core-visual-drift.md`（只限第 3 行）、`content/coord-07-core-sop.md`（只限第 11 行）、`content/skill-integrator.md`（只限第 51、166 行）、`content/skill-qa-engineer.md`（只限第 66、91、113 行）、`content/skill-qa-visual.md`（只限第 12、83、99 行）、`content/skill-sr-engineer.md`（只限第 26、28、51 行）、`templates/agent-adapters/claude.md`（只限第 12 行）、`CLAUDE.md`（只限第 233 行）、`prompts/constitution-manifest.ts` 與 `dist/prompts/constitution-manifest.*`（只在人類核准新增 segment 時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/compose-equivalence.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e391-prompt-audit-stale-facts.test.mjs`、`test/e5-intake-tiering.test.mjs`、`test/e96-dispatch-preference.test.mjs`、`test/phase-0-5-sop.test.mjs`、`test/agc-adapters.test.mjs`、`test/e393-*.test.mjs`、`specs/e393-*`、`qa_reports/*E393*`、`review_reports/*E393*`、`.current/e393/**`；其他被本 lane 改變字句釘住的測試檔，cut 裡逐檔列名、預審核對 | 其他 `content/**`（含 `coord-01`、`coord-04`、`coord-06`、`const-02`、`const-03`、`const-07`、`const-13`、`const-14`、`skill-architect.md`、`skill-pm.md`、`skill-code-reviewer.md`、`skill-release-engineer.md`、`skill-coordinator-lite.md`）、擁有檔案中點名行以外的段落（含 `coord-02` 的 Task／Agent 字句、`skill-qa-visual.md` 第 24、69 行）、`templates/agent-adapters/` 的其他檔、`CLAUDE.md` 第 233 行以外（含 `agc-version:` 戳記）、`tools/**`、`gates/**`、`dist/**`（上列條件除外）、`bin/**`、`scripts/**`、`guards/**`、`prompts/**`（上列條件除外）、`schema/**`、`lib/**`、`test/subagent-templates.test.mjs`、`test/qa-flow.test.mjs`、`test/visual-gate-e2e.test.mjs`、`test/visual-round-transitions.test.mjs`、其他 `docs/**`、其他 `.current/**`、其他 `specs/**`、共同禁止的全部項目 | 做：G2-10 把 builder ≠ judge 從 §3.2 搬到所有引用片段都會載入的片段，字句一般化到 reviewer／qa 獨立性（visual 半句可留），§3.2 只留兩條 visual 規則；「派工前核對」列的每個引用站點改指新位置，cut 裡逐站寫出新引用；G2-21 把點名站點的裸 round 數字改成具名 cap，`const-01` Limits 表新增 `visual_split` 一列，`skill-qa-engineer.md` 的 Escalation Routes 情境名改名時連同第 66 行的引用一起改；`templates/agent-adapters/claude.md` 第 12 行與 `CLAUDE.md` 第 233 行同字；qa 重抓 golden、逐 hunk 說明、量 budget 前後值；新增一個 AC 測試，斷言每個 builder ≠ judge 引用在載入該引用的每種組合裡都能解析、點名站點不再有裸 round 數字。硬條件：不改 gate 程式、routing、schema、錯誤碼；`dist/` 無差異（除非人類核准新增 segment）；`agc check` 的戳記不動；budget 上限只在人類於 lane session 核准後上修；每個站點在 spec 裡對應一個 AC 與一個實作 task。　不做：E392 的 Task／Agent 字句與 subagent 模板；E395 的 `CLAUDE.md` 計數；`tools/transitions.ts` 與 gate 提示字串裡的數字；`docs/`／`specs/`／`research/` 歷史紀錄裡的 §3.2 引用；G2-17 重述合併。 | 無 |

## 所有權重劃（相對於預設）
- 單 lane，擁有集合不相交的條件自動成立。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）歸 e393。
- **`CLAUDE.md` 從共同禁止移出，劃給 e393，只限第 233 行**（adapter 區塊的 Subagent dispatch），和 `templates/agent-adapters/claude.md` 第 12 行一起改。發版 session 同時改 `CLAUDE.md` 的戳記與「221 test files」，hunk 不重疊；整合時若衝突，5b-4 逐 hunk 解。
- **`templates/agent-adapters/claude.md` 從共同禁止移出**，只限第 12 行；`templates/claude-code-agents/**` 仍禁止（E392）。
- **條件式擁有**：`prompts/constitution-manifest.ts` 與 `dist/prompts/constitution-manifest.*` 只在人類核准新增 segment 時歸 e393；否則禁止。
- 人類清單外、整合者補列的站點：`skill-sr-engineer.md` 第 26 行、`skill-qa-visual.md` 第 12 行、`const-04` 第 2 行、`constitution-rationale.md` 的 §3.2 錨點；以及 `const-12` 第 18 行、`skill-qa-engineer.md` 第 91 行（「At Round 4」，人類清單的第 92 行）與第 113 行（Escalation Routes 列，第 66 行的引用目標）。`constitution-rationale.md` 第 184 行「at Round 3, prefer splitting」是非規範性的敘事，不在點名站點；PM 若要一併改，cut 裡寫明即可（整合者裁定，不需人類）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| builder ≠ judge 位於引用它的每個片段都會載入的片段，字句一般化，§3.2 只留兩條 visual 規則 | e393（E393） | ✓ |
| 「派工前核對」列的每個引用站點都改指新位置，`templates/agent-adapters/claude.md` 與 `CLAUDE.md` adapter 區塊同字；AC 測試證明每種組合都能解析 | e393（E393） | ✓ |
| 點名站點不再重述裸 round 數字；`const-01` Limits 表有 `visual_split` 列 | e393（E393） | ✓ |
| compose-golden 重抓、每個 hunk 有說明；budget 前後值記在 qa 報告；上限未超，或由人類在 lane session 核准上修 | e393（qa；上修由人類） | ✓ |
| 被改變字句釘住的測試重新固定，其他測試全綠不改；`dist/` 無差異（或只有人類核准的 manifest 差異） | e393（qa） | ✓ |
| E393 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 單 lane：`integ/e393-builder-judge-core` ← `--no-ff` e393，跑 `merge-invariants`；`npm run build` 確認 `dist/` 無差異（或只有核准的 manifest 差異）；`npm run check:bookkeeping`、`npm audit --audit-level=high`；push integ，再跑 `node scripts/verify-release.mjs --ci-check --sha <HEAD>`。
- 若 v4.16.1 已在 lane 派工後合進 `main`，整合 branch 從當時的 `main` 開；`CLAUDE.md` 衝突逐 hunk 解，兩邊都保留（實質解決則送 code-reviewer）。
- 結案時記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。

## 合併順序
1. `integ/e393-builder-judge-core` ← `--no-ff` e393，再跑 merge-invariants。
2. `npm run build`（`dist/` 應無差異），跑 `check:bookkeeping`。
3. 在 integ 上 `finish e393 --shipped --base integ/e393-builder-judge-core`。
4. 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge`。
5. merged 之後 `git switch main`、`git -c pull.rebase=false pull --ff-only`，再 `git branch -d integ/e393-builder-judge-core`。

## Dispatch pins
- e393：`pm=opus`、`sr-engineer=opus`、`qa-engineer=sonnet`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-11-02 | 人類 | 選項 (A)：builder ≠ judge 搬出 const-11 到 core 片段（`const-05` §3 末或 `const-15`），§3.2 留兩條 visual 規則，每個引用在四種組合都能解析；同票把裸 round 數字改成具名 cap，sr-engineer 的 `visual_round >= 3` 門檻在 Limits 表新增一列 | `docs/backlog.md` E393 列 |
| 2026-11-02 | 人類 | 第 2 波範圍：只做 E393（「fan-out E393」）；lean bundle 必然超過時，lane 在 cut 裡提出等量刪減或由人類核准上修 `test/context-budget.test.mjs` 的上限；E393 的檔案面與 manifest 條件式擁有照人類列出的站點 | 整合者 session |
| 2026-11-02 | 人類 | 在前一個整合者 session 要求刪掉草案、改由新 session 接手；新 session 的派工訊息「fan-out E393」重申：E391 已合併、依賴解除；(A) 抽成 core 片段必然超過 lean 上限，lane 在 cut 裡提出等量刪減或由人類核准上修 `test/context-budget.test.mjs`；檔案面含 const-11、目的地 core 片段、全部 §3.2 引用站點（coord-02／03／05／07、skill-integrator、adapter 模板與 `CLAUDE.md` adapter 區塊一起改）、G2-21 裸數字站點、`const-01` Limits 表 `visual_split` 一列；若要加 segment，manifest 與 `dist/prompts/constitution-manifest.*` 一起劃給 lane；`content/**`、compose-golden、context-budget 全歸該 lane；lane base 取派工當下的 `main`；`CLAUDE.md` 衝突 5b-4 逐 hunk 解 | 整合者 session |
| 2026-11-02 | 整合者 | 新 session 接手：從前一個 session 的紀錄復原草案，在 `8a79731` 逐站重新核對（builder ≠ judge 13 個站點、G2-21 站點、Limits 表、manifest 標籤、budget 四個數字、會被擊中的測試）全部一致；補列 `skill-qa-engineer.md` 第 91 行「At Round 4」（人類清單的第 92 行，前一版草案誤判為無裸數字）；golden 計數改為 12 個全部重抓；補「待人類裁定」段（目的地替代方案建議維持 (A)；docs PR 與派工等 primary 回到 `main`）。`fanout.mjs validate` exit 0 | 本檔 |
| 2026-11-02 | 人類 | 核准本清單（全部）：單 lane e393、mini-chain、四項所有權重劃（`CLAUDE.md` 第 233 行、adapter 模板第 12 行、manifest 條件式擁有、共享生成物歸 e393）、補列的站點（含 `skill-qa-engineer.md` 第 91 行）、目的地維持 (A)、budget 超過時由 lane 在 cut 提 (i)／(ii)。人類回覆「approve」 | 整合者 session |
| 2026-11-02 | 整合者 | 草案：單 lane e393，mini-chain（PM cut、無 architect；新增 segment 才改 full chain）。重劃：`CLAUDE.md` 第 233 行與 `templates/agent-adapters/claude.md` 第 12 行從共同禁止移出、劃給 e393；manifest 與其 `dist/` 條件式擁有。補列人類清單外的引用站點（`skill-sr-engineer.md:26`、`skill-qa-visual.md:12`、`const-04:2`、rationale §3.2 錨點、`const-12:18`、`skill-qa-engineer.md:113`）。budget 實測：除 lean 外，non-design（餘裕 6）也必然超過。E392 與本票檔案重疊，排在本波之後 | 本檔 |
