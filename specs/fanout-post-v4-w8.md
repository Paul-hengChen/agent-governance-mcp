# Fan-out: post-v4 佇列第 8 波（lane-protocol lane：E290 ∥ 工具＋SOP lane：E292 + E342 + E343 + E344）
base: ef9aec6    integration branch: integ/post-v4-w8
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：已結案 2026-10-19。** 兩條 lane 皆 qa PASS（CI 綠）→ `integ/post-v4-w8` merge `936be52`（e292）、`dfd585b`（e290；修帳本後再 merge `7af69ca`）→ finish 兩 lane（E345–E352 配號）→ 記帳 commit → PR + auto-merge（見「結案」與「接手步驟」）。 `base:` 是規劃基準（v4.10.0 發版記帳 PR #28 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

integrator 改版第 4 波，也是最後一波：原 12 張改版票只剩 E290、E292（E293 暫緩，不做）。E290 等的 E289、E294，E292 等的 E285、E289 都已在第 7 波出貨（v4.10.0）。E342、E343、E344 是第 7 波結案時配的號，和 E290／E292 改同一批檔案，人類 2026-10-19 裁定本波一起做（見 Decisions）。

## 派工前核對（整合者，2026-10-19，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `ef9aec6`；遠端只剩 `main`。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`<lanes-root>/_mailbox/` 是空的。
- primary 有一個未追蹤的 `docs/existing-test-allowlist-drift-2026-10-19.md`（另一個 session 留下的 adopter 觀察報告，狀態 raised），不屬於本波；人類裁定 (a)：在本清單的 docs PR 裡另開一個 commit 收進來（見 Decisions）。
- `.current/.config.json` 有進版控，`cutApprovalAutoTier` 是 `{}`，沒有 `manifest: true` → 每條 lane 的 cut 由人類在 lane session 核准；Lanes 表不加 `approval` 欄。
- **E290 的落點**：`docs/lane-protocol.md` 改通用寫法，本 repo 專用的規則搬到新檔 `docs/lane-protocol-addendum.md`（`docs/config.md` 的範例檔名），並在 `.current/.config.json` 設 `laneProtocolAddendum`。通用檔的路徑必須維持 `docs/lane-protocol.md`（E289 spec D2：render 從 agc 安裝位置解析它，換名會 `LANE_PROTOCOL_ABSENT`）。整合者清點的本 repo 專用行：§1 第 13、14、16、18 行（`node bin/agc-init.mjs`、`npm run build`、`npm ci`），§2 第 34 行（共享生成物清單），§3 第 40、44、45 行（`dist/`、receipt、`check-md-tables`、`test/e130-lane-default.test.mjs` 範例），§4 第 67 行（`NEW-TICKETS.md`），§5 第 93 行（`node scripts/fanout.mjs check --cut` 的呼叫路徑），§7 第 132、133 行（`dist/`、註解 proof）。哪些搬、哪些改成通用說法由 PM 決定。
- **E290 的硬條件（D6）**：`.current/.config.json` 設 key 的那個 commit 必須同時加入 `docs/lane-protocol-addendum.md`，否則 `test/e296-manifest-tier.test.mjs` AC10（`render --primary <repo root>`，會讀本 repo 設定）因 `ADDENDUM_ABSENT` exit 2。
- **E290 的洩漏檢查**：`test/e177a-manifest.test.mjs` AC7 與 `test/e289-render-addendum.test.mjs` AC-E289-6 都**只掃 `docs/lane-protocol.md`**，不掃補充檔，而且 render 時不讀本 repo 設定（`primary: "/p"` 或暫存 primary）。「通用規則和補充檔的任何一行都不能出現在 render 出來的 prompt 裡」要成立，需要 E290 自己加測試：用本 repo 的設定 render，兩個檔案每一行（去頭尾空白後超過 20 字）都不得出現在 prompt 中。
- **會被 E290 改動擊中的測試（逐一清點，2026-10-19）**：
  - 必須重新固定（劃給 e290）：`test/e286-integrator-trust-and-git.test.mjs` AC5（§7 要含 `dist/`，且 §7 必須是最後一個 `## ` 標題）與 AC6（§7 要含 `註解 proof`、`每一行改動都是註解`）；`test/e329-integrator-sop-followups.test.mjs` AC-E327-2（§3 那一行要含 `test/e130-lane-default.test.mjs`）；`test/e294-lane-enterworktree.test.mjs`（§1 的切片與 needle，若 §1 改寫需要）。這三個測試同時讀 `content/skill-integrator.md`，e290 只動 lane-protocol 的斷言。
  - 必須全綠不改（e290 的硬條件）：`test/e178a-integrator-role.test.mjs` AC11、AC14、AC15（§5 規則 2／3、§3 task id 三段字、檔頭前 400 字內含 `content/skill-integrator.md`）；`test/e246-mailbox-teardown.test.mjs`（§5 的 `信箱在 \`agc feature finish\` 拆除 lane 時才會刪除`）；`test/e295-hop-cap-and-sop-halves.test.mjs` AC5（`例如 7/14` 恰一次、`-r<n>-fix`、`不要 push、不要 merge、不要發版、不要刪 worktree` 恰一行）；`test/e296-manifest-tier.test.mjs` AC4（`check --cut`、`信箱**永遠不傳核准**` 恰一行）與 AC10；`test/e177a-manifest.test.mjs` AC7、`test/e289-render-addendum.test.mjs` AC-E289-6（新行不得與 `PROMPT_TEMPLATE_3B` 任何一行相同）。
  - 標題位置被釘住：`## 1.`（e294）、`## 3. `、`## 4. `（e329）、`## 7. 中途修 base（整合者把目標分支 merge 進 lane）` 是最後一個 `## ` 標題（e286）。不可重新編號、不可在檔尾加 `##` 段。
  - 只在註解提到 lane-protocol 的：`test/e130-lane-default.test.mjs`、`test/e177b-mailbox-watch.test.mjs`、`test/e289-config-key.test.mjs`，不受影響。
- **E292 的落點**：D1 —— `tools/config.ts` 加姊妹 repo 宣告的選填 key（路徑、負責什麼、backlog 與協定文件位置），`docs/config.md` 說明；integrator SOP 的 status 與接手模式透過現有 `lane-status --repo` 讀對方的進行中 lane 與分支 sha（`content/skill-integrator.md`，`tools/lane-status.ts`／`scripts/lane-status.mjs` 只在需要時動）。D2 —— 清單選填的外部依賴段落（對方 repo、票號、分支 sha、協定出處）：`tools/fanout-manifest.ts` 的 validate 在段落存在時驗格式；`tools/fanout-handoff.ts` 的 `handoff --check` 核對對方 sha 是否改變。不做跨 repo 信箱（改版文件 §6.2）。
- **E292 的 config schema**：E289（`laneProtocolAddendum`）與 E291（`nodeModulesLinks`）都是選填 key、沒有升版，config 仍是 v2。若 E292 升版，`loadConfig` 讀到舊版設定會把 `.current/.config.json` 原地改寫成新版（heal-write）——這個檔有進版控，本波劃給 e290 —— e292 的 worktree 會出現對它的改動，兩條 lane 在同一個檔案相撞。人類裁定：本波 E292 不升 config schema（見 Decisions）。
- **E342／E343／E344 的落點**：E342 `docs/config.md` 的 `laneProtocolAddendum` 段（「第一段是 ..」的措辭、建議從 primary 跑 render）；E343 `tools/fanout-manifest.ts` 的 render 在範本不含它要取代的指標字串時大聲失敗（或模組載入時檢查），測試；E344 `content/skill-integrator.md` Stage 4 停 watch 後 `lane-status --watch` 直接重啟、Stage 6 結案交接時機改成點名記帳改動，`test/e285-integrator-session-handoff.test.mjs`。
- **integrator SOP 的兩層說法**（E290 連帶，劃給 e292）：`content/skill-integrator.md` 第 101 行（Premises：「the prompt and `docs/lane-protocol.md` give」）、第 105 行（「Shared rules live only in `docs/lane-protocol.md`」）、第 109 行（「`docs/lane-protocol.md` §5 and §6 — the only copy」，e178a AC10 釘住）在 E290 之後不完整：本 repo 的規則也在補充檔。`content/**` 一波只能一條 lane，所以這三處由 e292 改（照 E289 出貨的設定 key 名稱寫，不依賴 e290 的檔案內容）。`content/const-15-core-tail.md` 的「the role `docs/lane-protocol.md` assigns」在通用檔仍成立，不動。
- **跨 lane 的交會點**：(1) `test/e296-manifest-tier.test.mjs` AC10 —— e290 設 key 後 render 走兩層指標，e292 改 render（E343）；兩條都不擁有 e296，各自在 lane 綠，整合層 CI 再跑一次。(2) `test/e286`、`test/e329` 讀 SOP（e292 改）也讀 lane-protocol（e290 改）—— 劃給 e290；對 e292 是全綠不改的硬條件（e292 不得改 e286 的 `### Mid-wave base fix` 與 e329 釘住的 SOP 句子）。(3) `test/e178a-integrator-role.test.mjs` 讀 SOP 也讀 lane-protocol —— 劃給 e292；對 e290 是硬條件（上列 AC11／AC14／AC15 的句子不動）。
- task id：e290 用 `T-E290-NN`；e292 用 `T-E292-NN`／`T-E342-NN`／`T-E343-NN`／`T-E344-NN`。不重用前波 id。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 新測試不得斷言真實 `specs/fanout-*.md` 會增長的內容，也不得對固定 base sha 做 diff；需要就在測試裡建固定清單／fixture。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），附 lane branch 上已 commit 的 spec sha；整合者 `close` 之後才呈給人類核准（lane-protocol §5-2）。spec 要有 `## Cut` 段。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`README.md`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`、`docs/integrator-revision-2026-10-08.md`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e290 | E290 | feat/e290-lane-protocol-generic | ../agent-governance-mcp-lanes/e290 | `docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`（新檔）、`.current/.config.json`（只限 `laneProtocolAddendum` 一個 key）、`test/e286-integrator-trust-and-git.test.mjs`（只限 lane-protocol 斷言的重新固定）、`test/e329-integrator-sop-followups.test.mjs`（同上）、`test/e294-lane-enterworktree.test.mjs`（同上）、`test/e290-*.test.mjs`、`specs/e290-*`、`qa_reports/*E290*`、`review_reports/*E290*`、`.current/e290/**` | `content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`tools/**`、`gates/**`、`scripts/**`、`schema/**`、`dist/**`、其他 `docs/**`（特別是 `docs/config.md`）、其他 `.current/**`、其他 `test/**`（特別是 `test/e177a-manifest.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e289-*.test.mjs` 與 e292 擁有的測試）、其他 `specs/**`、共同禁止的全部項目 | 做：E290 —— `docs/lane-protocol.md` 改成通用寫法（任何 adopter 都成立）；本 repo 專用的規則（呼叫方式、共享生成物清單、建置與測試指令、`dist/`、註解 proof 等）搬到 `docs/lane-protocol-addendum.md`；`.current/.config.json` 設 `laneProtocolAddendum: "docs/lane-protocol-addendum.md"`，與補充檔同一個 commit（E289 D6）；新測試：用本 repo 設定 render 時走兩層指標，且兩個檔案每一行（去頭尾空白後超過 20 字）都不出現在 prompt 中。搬哪些行、哪些改成通用說法由 PM 決定。硬條件：通用檔路徑不變；`## 1.`、`## 3. `、`## 4. ` 標題位置與「§7 是最後一個 `## ` 標題」不變；e178a AC11／AC14／AC15、e246、e295 AC5、e296 AC4／AC10、e177a AC7、e289 AC-E289-6 全綠不改；新行不得與 `PROMPT_TEMPLATE_3B` 任何一行相同；補充檔路徑不含單字 `approval`（e296 AC10）。　不做：integrator SOP 裡的 lane-protocol 說法（e292）；`docs/config.md`（E342，e292）；SOP 其他本 repo 專用句（Stage 1 共享生成物、Stage 6 呼叫方式），發現就記成新發現。 | 無 |
| e292 | E292、E342、E343、E344 | feat/e292-sister-repos | ../agent-governance-mcp-lanes/e292 | `tools/config.ts` 與其 `dist/tools/config.*`、`tools/fanout-manifest.ts` 與其 `dist/tools/fanout-manifest.*`、`tools/fanout-handoff.ts` 與其 `dist/tools/fanout-handoff.*`、`tools/lane-status.ts` 與其 `dist/tools/lane-status.*`（只在需要時）、`scripts/fanout.mjs`（只在需要時）、`scripts/lane-status.mjs`（只在需要時）、`docs/config.md`、`content/skill-integrator.md`、`test/fixtures/compose-golden/**`（只在需要重新固定時）、`test/context-budget.test.mjs`（同上）、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`（只在需要時）、`test/e177b-lane-status.test.mjs`（只在 lane-status 改動時）、`test/e178b-lane-watch.test.mjs`（同上）、`test/e178a-integrator-role.test.mjs`、`test/e283-validate-handoff.test.mjs`、`test/e284-fanout-handoff.test.mjs`、`test/e285-integrator-session-handoff.test.mjs`、`test/e289-config-key.test.mjs`、`test/e289-render-addendum.test.mjs`、`test/e339-non-ascii-manifest.test.mjs`（只在需要時）、`test/fixtures/e177a/**`、`test/fixtures/e178b/**`（只在需要時）、`test/e292-*.test.mjs`、`test/e342-*.test.mjs`、`test/e343-*.test.mjs`、`test/e344-*.test.mjs`、`specs/e292-*`、`qa_reports/*E292*`、`qa_reports/*E342*`、`qa_reports/*E343*`、`qa_reports/*E344*`、`review_reports/*E292*`、`review_reports/*E342*`、`review_reports/*E343*`、`review_reports/*E344*`、`.current/e292/**` | 其他 `content/**`、`docs/lane-protocol.md`、`docs/lane-protocol-addendum.md`、`.current/.config.json`、其他 `docs/**`、其他 `tools/**`、`gates/**`、其他 `scripts/**`、`schema/**`、其他 `dist/**`、其他 `test/**`（特別是 `test/e286-integrator-trust-and-git.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e294-lane-enterworktree.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/config-versioning.test.mjs`）、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E292 D1：config 選填 key 宣告姊妹 repo（路徑、負責什麼、backlog 與協定文件位置），`docs/config.md` 說明；integrator SOP 的 status 與接手模式透過 `lane-status --repo` 讀姊妹 repo 的進行中 lane 與分支 sha。D2：清單選填的外部依賴段落（對方 repo、票號、分支 sha、協定出處），validate 在段落存在時驗格式，`handoff --check` 核對對方 sha。(2) E342：`docs/config.md` 的 `laneProtocolAddendum` 段改成「第一段是 `..`」並建議從 primary 跑 render。(3) E343：render 遇到範本不含它要取代的 lane-rules 指標時大聲失敗（或模組載入時檢查），附測試。(4) E344：SOP Stage 4 停 watch 後 `lane-status --watch` 直接重啟（沒有 baseline）、Stage 6 結案交接時機改成點名記帳改動。(5) E290 連帶：SOP 第 101、105、109 行改成通用規則加 repo 補充檔（`laneProtocolAddendum`）的兩層說法。硬條件：現有每一份 `specs/fanout-*.md` 的 `validate` 結果（exit code 與錯誤碼集合）不變；沒有外部依賴段落、沒設姊妹 repo key 時，validate、render、`handoff`、`handoff --check` 的輸出 byte-identical；config schema 不升版（人類裁定；`schema/**`、`test/config-versioning.test.mjs` 在禁止範圍）；`PROMPT_TEMPLATE_3B` 上方 provenance 註解保留 e178a AC15 的三段字；`test/e286-integrator-trust-and-git.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/e296-manifest-tier.test.mjs`（不擁有）全綠不改；範本行不得與 `docs/lane-protocol.md` 任何超過 20 字的行相同。　不做：改 `docs/lane-protocol.md` 與補充檔（e290）；跨 repo 信箱（§6.2）；mid-wave 交接（E293，暫緩）。 | 無 |

## 所有權重劃（相對於預設）
- 兩條 lane 擁有集合不相交；共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e292。
- **`content/skill-integrator.md` 第 101、105、109 行的兩層說法劃給 e292**：語意上屬 E290，但 `content/**` 一波只能一條 lane，E292、E344 也要改這個檔。
- **`.current/.config.json` 劃給 e290，只限 `laneProtocolAddendum`**：E289 D6 要求 key 與補充檔同一個 commit。
- **`docs/config.md` 劃給 e292**：E292 的新 key 與 E342 都改它。
- **`test/e286-integrator-trust-and-git.test.mjs`、`test/e329-integrator-sop-followups.test.mjs`、`test/e294-lane-enterworktree.test.mjs` 劃給 e290**：只限 lane-protocol 斷言；對 e292 是全綠不改的硬條件。
- **`test/e178a-integrator-role.test.mjs`、`test/e177a-manifest.test.mjs` 劃給 e292**：前者主要釘 SOP，後者主要驗 validate／render；它們釘的 lane-protocol 句子與 AC7 洩漏檢查對 e290 是硬條件。
- **`docs/integrator-revision-2026-10-08.md` 加進共同禁止**：設計文件，兩張票都引用、都不需要改。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `docs/lane-protocol.md` 只剩任何 adopter 都成立的規則；本 repo 專用規則在 `docs/lane-protocol-addendum.md` | e290（E290） | ✓ |
| `.current/.config.json` 設 `laneProtocolAddendum`，與補充檔同一個 commit；本 repo render 走兩層指標 | e290（E290） | ✓ |
| 通用檔與補充檔的任何一行（超過 20 字）都不出現在 render 出來的 prompt 中，有測試 | e290（E290） | ✓ |
| e286、e329、e294 對 lane-protocol 的斷言重新固定，其他讀 lane-protocol 的測試全綠不改 | e290（qa） | ✓ |
| integrator SOP 寫明通用規則加 repo 補充檔的兩層說法 | e292（E290 連帶） | ✓ |
| config 可宣告姊妹 repo；`docs/config.md` 有說明；沒設時行為不變 | e292（E292 D1） | ✓ |
| integrator SOP 的 status 與接手模式透過 `lane-status --repo` 讀姊妹 repo | e292（E292 D1） | ✓ |
| 清單可有選填外部依賴段落，validate 驗格式、`handoff --check` 核對對方 sha；現有清單 validate 結果不變 | e292（E292 D2） | ✓ |
| `docs/config.md` 的 `laneProtocolAddendum` 段措辭修正 | e292（E342） | ✓ |
| render 在範本指標漂移時大聲失敗，有測試 | e292（E343） | ✓ |
| integrator SOP 的 watch 恢復與結案交接時機措辭修正，e285 測試重新固定 | e292（E344） | ✓ |
| E290、E292、E342、E343、E344 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |
| 本清單結案時寫 `## 接手步驟`，狀態行以「已結案」開頭 | 整合者（5c） | ✓ |

## 整合後（整合者自己的 commit／接線）
- 合併順序 e292 → e290；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → `node scripts/verify-release.mjs --ci-check --sha <HEAD>`（本機全套只在 CI fallback）。整合層 CI 是 e296 AC10（兩層指標＋E343 的 render 改動）與 e177a AC7 的第一次合併驗證。
- 本清單結案時，記帳 commit 之後、清單是唯一未 commit 的改動時，用 `node scripts/fanout.mjs handoff --closing` 產生 `## 接手步驟`。
- backlog done-mark 與佇列 DONE。

## 合併順序
`integ/post-v4-w8` ← `--no-ff` e292（共享生成物 lane 先）→ merge-invariants → `--no-ff` e290 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w8` → 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main`、`git -c pull.rebase=false pull --ff-only` → `git branch -d integ/post-v4-w8`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## 結案
- 日期 2026-10-19。`integ/post-v4-w8` ← e292（`936be52`）← e290（`dfd585b`，帳本修正 `7af69ca`），皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 三次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39219943832 在 `dfd585b` 綠。
- 彙總（上限按 lane 計）：e290 2 張 task／hop 6/14／review 0 輪退回／qa 退回 1 輪（spec 驗證指令的路徑字樣）；e292 7 張 task／hop 4/14／review 0 輪／qa 0 輪。合計 9 張 task、hop 10，每條 lane 都在自己的上限內。
- 完成定義 13 項全部成立（本清單的 `## 接手步驟` 為最後一項）。
- 例外：(1) 兩條 lane 的 sr、reviewer 都是 opus（同模型疑慮，e290 報告已註明）；qa 用預設 sonnet。(2) e290 finish 第一次被拒，修帳本多一輪 lane commit、CI 與 merge（已配號 E353）。(3) 兩條 cut 預審都漏看一點：e290 spec 的驗證指令寫了本機路徑前綴，由 qa 的全套抓到。
- 新票：E345–E348（e292）、E349–E352（e290，`finish --shipped` 配號）、E353（整合者配號），排在佇列 #162–#170。
- 發版：`main` 帶 E290（通用 lane-protocol 與本 repo 補充檔、`.current/.config.json` 設 `laneProtocolAddendum`）、E292（`sisterRepos` 設定 key、清單 `## 外部依賴` 段、`handoff --check` 核對姊妹 repo sha、新錯誤碼）、E342／E343／E344（文件、render 防呆、SOP 措辭）→ 是否發版與版號由人類決定。

## Dispatch pins
- e290：`pm=opus`、`sr-engineer=opus`。
- e292：`pm=opus`、`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-19 | 整合者 | 草案：e290（E290，lane-protocol 與補充檔、`.current/.config.json` 的一個 key）∥ e292（E292＋E342＋E343＋E344，唯一 content lane）；兩條擁有集合不相交；SOP 的 lane-protocol 兩層說法（E290 連帶）劃給 e292；e286／e329／e294 劃給 e290、e178a／e177a 劃給 e292，互為對方的硬條件；`docs/integrator-revision-2026-10-08.md` 加進共同禁止 | 本檔 |
| 2026-10-19 | 人類 | 核准本清單（全部）：兩條 lane（e290、e292）與六項重劃／切分；E342、E343、E344 本波一起做（歸 e292）；E292 本波不升 config schema；未追蹤的 adopter 觀察報告 `docs/existing-test-allowlist-drift-2026-10-19.md` 照 (a) 在本清單的 docs PR 另開 commit 收進來（不屬於本波範圍）；Lanes 表不加 `approval` 欄 | 整合者 session |
| 2026-10-19 | 整合者 | 清單 PR #29 merge `a67d799` = 派工 base（未追蹤的 adopter 觀察報告以另一個 commit 一併收進）；派工前核對：兩條 lane 點名的擁有／禁止路徑在 base 存在（新檔已標註）、無殘留 branch／worktree；信箱 e290／e292 空建、mailbox-watch 與 lane-status watch 皆 armed；兩份 prompt 以 `fanout.mjs render --base a67d799` 產生 | 本檔 |
| 2026-10-19 | 整合者 | 兩條 cut 預審 close：e290（`c1d0784`；退回一次：§5 的 `fanout.mjs` 呼叫改成沒有補充檔也能照做的安裝位置寫法）、e292（`57edf6f`；退回一次：拿掉 SOP Stage 4 新句「本 repo 規則絕不在本 SOP」的錯誤斷言；G10 Stage 1 提外部依賴段，整合者確認保留） | 信箱 e290／e292 |
| 2026-10-19 | 人類 | 在兩條 lane 各自的 session 核准 cut：e290（`c1d0784`）、e292（`57edf6f`） | lane session；各 lane spec 與 handoff commit |
| 2026-10-19 | 人類 | e292 G6：姊妹 repo 分支前進時 `handoff --check` 報 `DIFF`、exit 1，不給 `MOVED`（照 PM 與整合者建議；看過收工回報後再次確認） | e292 lane session；`specs/e292-sister-repos.md` Gate Summary G6，commit `964de08` |
| 2026-10-19 | 整合者 | 5a：e290 `18d93c3`（CI run 39215855179）close —— review 0 輪退回，qa 第 1 輪 FAIL 只因 spec 驗證指令寫了本機路徑前綴字面值（hygiene 掃描），PM 改 spec 後 PASS；e292 `473a694`（CI run 39219402518）close —— review、qa 皆 0 輪退回 | 本檔 |
| 2026-10-19 | 整合者 | 5b：`integ/post-v4-w8` ← e292 `936be52` ← e290 `dfd585b`，皆 `--no-ff`、零衝突 → 無合併審查；merge-invariants 兩次 PASS；重建 `dist/` 無差異；`npm audit --audit-level=high` exit 0；整合層 CI run 39219943832 在 `dfd585b` 綠；finish e292 配號 E345–E348 | 本檔 |
| 2026-10-19 | 整合者 | finish e290 被拒（`pending-tickets.md` 一個 block 的 title 含未加引號的「: 」，YAML 解析失敗，未套用也未拆除）：退回 lane 修一行（`c54587a`，CI run 39221918215），再 merge `7af69ca`（merge-invariants PASS）後 finish 配號 E349–E352；整合者配號 E353（帳本格式提早檢查）；E345–E353 排在佇列 #162–#170 | 本檔 |
