# Fan-out: post-v4 佇列第 2 波（單一 content lane：E295 + E298／E299／E300 的 SOP 半邊 + E301）
base: 25bc84c    integration branch: integ/post-v4-w2
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：結案 2026-10-15。** e295 qa PASS → 整合者 close → `integ/post-v4-w2` merge `6985b3a` → finish e295（E309–E311 配號）→ 記帳 commit → PR + auto-merge（見「結案」）。

本波只有一條 lane：五張票全部碰 `content/**`（共享生成物一波只能一條 lane），而且第 1 波拆出的三句 SOP 文字要引用的程式（`check:bookkeeping`、`DISPATCH_PIN_TIER_REJECTED`、`--ci-check` 流程、`feat/**` CI 觸發）現在都已在 `main` 上，可以在同一個 branch 驗證。Stage 6 照第 1 波同一流程（E297 已出貨，`content/skill-integrator.md` 現行文字即為準）。

## 派工前核對（整合者，2026-10-15）
- `git worktree list` 只有 primary；main = origin/main = `25bc84c`（PR #6 merged，第 1 波結案）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.5.0`。`<lanes-root>/_mailbox/` 是空的，`e295` 不重名。
- 派工 base：`25bc84c`。本檔以 `docs/2026-10-15-fanout-post-v4-w2` branch 走 PR 併入 `main`（coord-03 記帳段：沒有開放波次時記帳走 docs branch）。
- **hop cap 仍是 10**：E295 把上限改成 14，但本 lane 自己跑在 `main` 的 server 上（10）。五張票、一條 lane，是本波最大的風險 —— 範圍切線要求 PM 把 task 切少（同一檔的 SOP 句子併成一個 task）、單一 sr session、整合者預審從嚴以免 review 多輪；hop 用完 → escalate 給人類，不自行開 `-r<n>-fix`（E295 正是要把這件事正式化，本波還沒出貨）。
- `cutApprovalAutoTier` 空物件、E296 未出貨 → cut 仍由人類在 lane session 核准。
- **E295 的落點**：`content/const-01-core-head.md:16`（Limits 表 `hop` cap 10）；`tools/transitions.ts:324`（`const HOP_CAP = 10`）與 `:367–:440`（precedence 2.5 hop-cap override；E41 要求 override 形狀對齊 `ROUND_CAP` 的 round-style override，`:65`、`:383`）；`content/coord-03-core-fallback.md:29`（Escalation Routes 的 hop-cap 列）；`docs/lane-protocol.md:77`（`hop:` 欄的 `7/10` 範例）與 §3 的「hop 用完」規則。規格鏡像：`specs/d2-server-brake-accounting.md:9、:119` 與 `specs/d2-server-brake-accounting-architecture.md:16、:30、:87` 寫死 10 —— 是設計紀錄，照 E267 前例**不改原文**，由 lane 在檔尾加一段帶日期的修正註記（lane 擁有這兩檔，只限追加）。`scripts/check-transitions-sync.mjs` 只比對 transition 表的 key，不含上限，不受影響。測試：`test/hop-count-transitions.test.mjs`、`test/error-code-contract.test.mjs`（import `HOP_CAP_EXPORTED`）、`test/feature-rollup.test.mjs`（`tools/feature-rollup.ts:11` 用 `HOP_CAP_EXPORTED` 比對上限）、`test/e178b-lane-watch.test.mjs:474`（`hop_count: 10 + n`）；`test/e177b-mailbox-watch.test.mjs` 的 `1/10` 只是格式範例，預期不動。const-01 與 coord-03 都組進 compose golden 並計入 `test/context-budget.test.mjs` 四個上限（5717／10226／20749／8129）。
- **E298 SOP 半邊的落點**：`content/skill-integrator.md:119`（5a 表 test claim 列）、`:125`（Verifier dispatch 段）、5b-6（第 135 行起的 Merge 段：合併後本機全套改為 integ push／PR 的 CI，本機只當 fallback）、Stage 6 第 164 行（E297 已把「等 merge」寫成本波的 CI check，E298 只需對齊措辭）；新增 fallback（`gh`／Actions 不可用 → 本機 `test-lock` 全套並在清單 Decisions 記錄未諮詢 CI）與 flake rule（E238／E254／E278 家族的 load-sensitive 測試可重跑一次）。`scripts/verify-release.mjs --ci-check --sha` 已存在（第 32–44 行），不改。前提已成立：`ci.yml` 自第 1 波起對 `feat/**` push 觸發；整合者 push lane branch 是 base list 的 fast-forward push；lane 仍不 push（`docs/lane-protocol.md:42` 不動）。測試：`test/e178a-integrator-role.test.mjs:128` 釘住 5a 指令清單。
- **E299 5c 一句的落點**：`content/skill-integrator.md:149`（5c 段）—— 一句指向 `npm run check:bookkeeping`，在記帳 commit 之前跑。
- **E300 coord-02 一句的落點**：`content/coord-02-host-dispatch.md:19`（*Dispatch-time overrides* 段）—— 點名四個值與 `DISPATCH_PIN_TIER_REJECTED`；同時 `gates/registry.ts:66` 該列 `documentedInProse: false` → `true`、`:106` mapping comment `(none)` → `coord-02-host-dispatch.md`（`test/error-code-contract.test.mjs:487–489` 認得 `(none)`，翻成檔名後 qa 重釘）。coord-02 在 coordinator bundle 的 golden 裡。
- **E301 的落點**（建議納入本波，見下）：`content/coord-03-core-fallback.md:62`（Evidence-Citation Convention）、`content/skill-release-engineer.md:69`（7a 歸檔）；選項 (i)／(ii)／(iii) 是人類裁決，PM 在 cut 呈現。選 (i) 或 (iii) 時 `scripts/check-bookkeeping.mjs` 可能要跟著調（lane 條件式擁有）。現況：22 則容忍註記（14 則預測 archive 路徑、8 則 root 路徑），下一次 release 7a 搬檔後全部轉失敗 → release 記帳 PR 的 CI 會紅。**人類已表示第 2 波先於發版，所以 E301 必須在發版前出貨**，這是建議納入的理由。
- task id：`T-E295-NN`（E298／E299／E300／E301 的句子各自用 `T-E298-NN`／`T-E299-NN`／`T-E300-NN`／`T-E301-NN`，同一 lane、同一 spec；證據檔名跟 task id 走）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕（E294 票面）。`docs/lane-protocol.md` 的改寫可以 EnterWorktree 為前提（E294 spike：repo 外的 lane 能進入、cwd 不跑回 primary）。
- **cut 先寄信箱預審（`type: proposal`），整合者 `close` 之後才呈給人類核准**（lane-protocol §5-2；第 1 波四條 lane 都漏了這步）。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`。

## Lanes（單一）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e295 | E295、E298（SOP 半邊）、E299（5c 一句）、E300（coord-02 一句）、E301 | feat/e295-hop-cap-and-sop-halves | ../agent-governance-mcp-lanes/e295 | `content/const-01-core-head.md`、`content/coord-02-host-dispatch.md`、`content/coord-03-core-fallback.md`、`content/skill-integrator.md`、`content/skill-release-engineer.md`、`content/constitution-rationale.md`（只在需要搬理由時）、`tools/transitions.ts` 與其 `dist/tools/transitions.*`、`gates/registry.ts` 與其 `dist/gates/registry.*`（只限 `DISPATCH_PIN_TIER_REJECTED` 列的 `documentedInProse` 與 mapping comment）、`docs/lane-protocol.md`、`specs/d2-server-brake-accounting.md` 與 `specs/d2-server-brake-accounting-architecture.md`（只限檔尾追加帶日期的修正註記）、`scripts/check-bookkeeping.mjs`（只在 E301 選項需要時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/hop-count-transitions.test.mjs`、`test/error-code-contract.test.mjs`、`test/feature-rollup.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e178b-lane-watch.test.mjs`、`test/e177b-mailbox-watch.test.mjs`（只在格式範例真的綁死上限時）、`test/e299-check-bookkeeping.test.mjs`（只在 E301 動了檢查時）、`test/e295-*.test.mjs`、`specs/e295-*`、`qa_reports/*E295*`、`qa_reports/*E298*`、`qa_reports/*E299*`、`qa_reports/*E300*`、`qa_reports/*E301*`、`review_reports/*E295*`、`review_reports/*E298*`、`review_reports/*E299*`、`review_reports/*E300*`、`review_reports/*E301*`、`.current/e295/**` | 其他 `content/**`、其他 `tools/**`、其他 `gates/**`、`scripts/verify-release.mjs`、其他 `scripts/**`、其他 `test/**`、其他 `dist/**`、其他 `specs/**`、其他 `docs/**`、共同禁止的全部項目 | 做：(1) E295 票面 (1)(2)：`hop` cap 10 → 14（const-01、`HOP_CAP`，override 形狀對齊 `ROUND_CAP`）；coord-03 hop-cap 列與 `docs/lane-protocol.md` 加同 lane 接續的全部條件（review／qa round 皆未滿、剩餘工作有界且由最後 verdict 點名、人類在 lane session 裁決並記進清單 Decisions、新 feature 名 `<feature>-r<n>-fix` 且 `scope_decision_why` 引原 feature、`lease_override: true` + `pending_notes[0]` `lease-override: hop-cap continuation of <feature>`、每個 feature 只能接續一次）；d2 兩份規格檔尾加修正註記。(2) E298 票面 (2)(3)(4)(6)(7)：5a test claim 改成整合者 `git push -u origin <branch>` + `node scripts/verify-release.mjs --ci-check --sha <reported sha>`（lane branch 可同時 push、CI 平行跑）；5b-6 整合層改讀 integ push／PR 的 CI、本機全套只當 fallback；verifier brief 回 run id + verdict；fallback 與 flake rule。(3) E299：5c 一句指向 `npm run check:bookkeeping`（記帳 commit 前）。(4) E300：coord-02 *Dispatch-time overrides* 一句點名四個值與 `DISPATCH_PIN_TIER_REJECTED`，`documentedInProse` 翻 true、mapping comment 改檔名。(5) E301：PM 呈 (i)／(ii)／(iii) 給人類裁決後寫進 coord-03 與 release SOP 7a（必要時調 `check-bookkeeping.mjs`）。PM 切票：同一檔的句子併成一個 task、單一 sr session；四個 budget 上限若需調高，qa 實測、人類核准 cut 時定。　不做：E295 票面 (3) roll-up 認 `-r<n>-fix` 後綴（E175(d)）；E298 票面 (1)(5)（已出貨）；E303、E308（程式，不在本波）；不碰 `templates/**`、`docs/backlog.md`、`scripts/verify-release.mjs`。 | 無 |

## 所有權重劃（相對於預設）
- 單一 lane，沒有跨 lane 的重劃。清單列出的「只限」條件（`gates/registry.ts` 只動一列、d2 規格只追加、`check-bookkeeping.mjs` 只在 E301 需要時）是 prose 約束，`fanout check` 不會機械檢查，整合者在 5a 看 diff。
- **E301 建議納入本波**（人類裁決是否進當前里程碑）：它是下一次 release 7a 的必踩紅燈，而人類已決定第 2 波先於發版。不納入的話，發版前要另開一條 content lane。
- **五張票一條 lane 的 hop 風險**：對策寫在範圍切線（task 併檔、單一 sr session）；整合者預審時把非必要修改改成整合後的票，不在 lane 內來回。
- **執行中追加的所有權註記（整合者裁定，5a 看 diff 接受）**：(1) `gates/registry.ts` 除 `DISPATCH_PIN_TIER_REJECTED` 一列外，另改了描述該列為「唯一 false／(none)」的兩句註解（否則變成假話）與 `HOP_CAP_EXCEEDED` 列的 predicate／hint 字面值 10 → 14（commit e78057d；error-code-contract 釘住該字面值、hint 是使用者看得到的錯誤文字）；(2) `test/e177b-lane-status.test.mjs`、`test/render-structure.test.mjs` 劃給 e295（qa 限定、只 re-pin：前者 hop fixture 改用 `HOP_CAP_EXPORTED`+1，後者改釘 E301 的 write-time 措辭）—— 兩者都是 cap 14／E301 慣例改變的直接後果；(3) `skill-integrator.md` 5c 第 3 項「citing archive evidence paths」改成 write-time 慣例（E301 (ii) 之後舊句與 coord-03 矛盾）；(4) coordinator 在 lane 擁有的 spec 做了一個字元的 pipe escape（66911d0，qa 證據已揭露）。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| const-01 Limits `hop` cap = 14；`HOP_CAP = 14`，override 形狀與 `ROUND_CAP` 一致；相關測試與 goldens 綠 | e295（E295-1） | ✓ |
| coord-03 hop-cap 列與 lane-protocol 寫明同 lane 接續的全部條件（含只能接續一次） | e295（E295-2） | ✓ |
| d2 兩份規格檔尾有帶日期的修正註記（10 → 14） | e295（E295-1） | ✓ |
| skill-integrator 5a 改為 push lane branch + `--ci-check --sha`；5b-6 改讀 CI；verifier brief、fallback、flake rule | e295（E298 SOP 半邊） | ✓ |
| skill-integrator 5c 一句指向 `check:bookkeeping` | e295（E299） | ✓ |
| coord-02 一句點名四個值與錯誤碼；`documentedInProse` true、mapping comment 對齊；error-code-contract 綠 | e295（E300） | ✓ |
| Evidence-Citation Convention 與 release 7a 依人類選的選項對齊；`check:bookkeeping` 在現況下仍綠 | e295（E301） | ✓（若人類納入） |
| compose goldens 重產、budget 測試綠（上限調整由人類核准） | e295 | ✓ |
| E298、E299、E300 的 done-mark（程式半邊第 1 波已合併）；E295、E301 done-mark；佇列 0j／0k／0l／#116／#118 勾 DONE | 整合者（5c） | ✓ |
| roll-up 認 `-r<n>-fix` 後綴 | E175(d)（既有票，不在本波） | ✗（既有票） |
| `dispatch_pins` enum ↔ `MODEL_TIERS` 單一來源 | E308（#125，程式，可與第 3 波平行） | ✗（已開票） |

兩個 ✗ 都有既有票承接，沒有空格。

## 整合後（整合者自己的 commit／接線）
- 合併後：重建 `dist/`、`check:bookkeeping`、全套（本機；E298 SOP 出貨後下一波起改讀 CI）。
- backlog done-mark：E295、E298、E299、E300、E301（若納入）；佇列 #116、0j、0k、0l、#118 勾 DONE。
- E301 選 (ii) 之後的一次性改寫：預測 archive 路徑的引用實測 19 則（不是票面的 14，E311）全部改成 root 形式，另 5 則 E177／E178 引用指向不存在的 lane 名資料夾、實際已在 `archive/release-v4.0.0/`，改成真實路徑；`check:bookkeeping` 零提示。E41 由 AC2 關閉，補 done-mark。
- 新票：E309（Stage 6-4 BEHIND 補救一句，content → 第 3 波 E296 同 lane）、E310（7a basename 撞名，下次 release 前）、E311（計數更正，已折進本波記帳）。
- 第 3 波建議：E296（content，單獨一條 lane）；E308 + E303（程式，不碰 content）可與 E296 平行成第二條 lane。之後才是 integrator 改版 E283–E294（`docs/integrator-revision-2026-10-08.md` §7.3）。
- 發版：第 2 波結案後 `main` 帶 E297–E301 + E300 server 行為變更 → 建議 MINOR（v4.6.0），由人類決定；是改版後 release SOP 的第一次實跑。

## 合併順序
只有 e295：`integ/post-v4-w2` ← `--no-ff` e295 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 全套 → 在 integ 上 `finish e295 --shipped --base integ/post-v4-w2` → 記帳 commit → 全套 → `git push -u origin integ/post-v4-w2` → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main && git pull --ff-only` → `git branch -d integ/post-v4-w2`。

## Dispatch pins
- e295：`sr-engineer=fable`（人類長期偏好）。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-15 | 人類 | 第 1 波結案後先做第 2 波、再考慮發版 | 整合者 session |
| 2026-10-15 | 整合者 | 第 2 波為單一 content lane e295，票 E295 + E298 SOP 半邊 + E299 5c 一句 + E300 coord-02 一句；建議再納入 E301（下一次 release 7a 的必踩紅燈，發版前必須出貨）交人類裁決；d2 兩份規格檔照 E267 前例只追加修正註記；`gates/registry.ts` 只動 `DISPATCH_PIN_TIER_REJECTED` 一列；hop 風險以「task 併檔、單一 sr session、預審從嚴」對策 | 本檔 |
| 2026-10-15 | 人類 | 核准本清單（E301 納入本波；接受五張票一條 lane 的 hop 風險與對策），開始派工；整合者改在新 session 接手 Stage 3 起 | 整合者 session |
| 2026-10-15 | 整合者 | cut 預審 close（to-lane#1）：範圍在 lane 列內、AC1–AC12 各有實作 task；接受 `gates/registry.ts` 兩句註解；E301 建議 (ii)；E41 隨 AC2 關閉 | 信箱 e295 |
| 2026-10-15 | 人類 | 在 lane session 核准 cut；E301 裁決選項 (ii)（引用寫入時的真實路徑，`check:bookkeeping` 以 basename 解析）；R2 原則核准（只有 coordinator bundle 上限動、值以 qa 實測為準） | lane e295 session（commit b751b6c） |
| 2026-10-15 | 整合者 | `gates/registry.ts` `HOP_CAP_EXCEEDED` 列字面值 10 → 14 與 5c 措辭對齊 E301：接受（to-lane#2）；`test/e177b-lane-status.test.mjs`、`test/render-structure.test.mjs` 劃給 e295 qa re-pin（to-lane#3／#4） | 信箱 e295 |
| 2026-10-15 | 整合者 | R2 實測：coordinator bundle 上限 20749 → 21138（零 headroom）；其餘三個上限不動 | lane report（to-integrator#4） |
| 2026-10-15 | 整合者 | 整合層全套第一輪 3124/3128，唯一紅燈 `test/e132-lane-registry.test.mjs` gap-6 = 已列管的 E254 timing 測試（與本 lane 無關、單跑綠）；依 flake rule 重跑一次 3125/3128 綠 | 本檔 |

## 結案
- 日期 2026-10-15。`integ/post-v4-w2` ← e295 `6985b3a`（`--no-ff`，零衝突 → 無合併審查；merge-invariants PASS：452 task id 全在、0 lost [x]、sidecar 0 shortfall）。重建 `dist/` 無差異；`check:bookkeeping` OK；整合層全套 3124/3128（E254 flake）→ 重跑 3125/3128/0 fail/3 skipped；記帳 commit 後再跑一次（見 PR）。`main` 以本 branch 的 PR + auto-merge 併入（Stage 6 照現行 `skill-integrator.md`，E297 已出貨）。
- 彙總（上限按 lane 計）：e295 5 張 task／hop 4/10／review 0 輪／qa 0 輪；證據 `qa_reports/review_E295_T-E295-01-05.md`、`review_reports/review_T-E295-01.md`（皆 covers 五個 id），與 `completed_tasks` 一致。
- 完成定義 11 項：9 項成立（含 E301 納入）；2 項 ✗ 早有歸屬（E175(d)、E308）。
- 例外：(1) lane 的 cut 有送信箱預審（第 1 波的漏步已修正），但 qa Blocked 時 lane 沒寄信、由 lane-status watch 發現，整合者主動寫 to-lane#3；(2) 本波在 cap-10 的 server 上跑，hop 4/10，未觸發接續；(3) 整合者第一次全套跑到 E254 的 timing flake，依 E298 剛出貨的 flake rule 重跑一次。
- 新票：E309、E310、E311 由 `finish --shipped` 配號（E311 折進本波記帳即關）。
- 第 3 波建議不變：E296（content，建議與 E309 同 lane）∥ E308 + E303（程式）。發版建議 MINOR（v4.6.0），人類決定；E310 在發版前要看。
