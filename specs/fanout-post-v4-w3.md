# Fan-out: post-v4 佇列第 3 波（content lane：E296 + E309 ∥ 程式 lane：E308 + E303）
base: db542da    integration branch: integ/post-v4-w3
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：人類核准 2026-10-15，派工中。** `base:` 是規劃基準（`fanout check` 用三點 diff，只看 lane 自己的 commit）；實際 `feature start --base main` 的 sha 記在 Decisions 派工列。

第 2 波（PR #8 → `main` `db542da`）結案時的建議照做：E296 是唯一碰 `content/**` 的票，E309 是同檔（`content/skill-integrator.md`）一句修正，兩者併成一條 content lane；E308 + E303 都只碰 `tools/**`／`gates/**` 的 dispatch-pins 同一組程式（tier 四值 enum 與 zod 邊界拒絕），不碰 content，成第二條 lane。兩條 lane 的擁有集合不相交（下表），可以同時跑。E298 SOP 已在 `main` 上，本波 5a／5b-6／Stage 6 都讀 pushed branch 的 CI（`ci.yml` 對 `feat/**`／`integ/**` push 觸發，已核對）；本機全套只當 fallback。

## 派工前核對（整合者，2026-10-15）
- `git worktree list` 只有 primary；main = origin/main = `db542da`（PR #8 merged，第 2 波結案）。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。primary handoff 停在 `release-v4.5.0`。`<lanes-root>/_mailbox/` 是空的；`.current/` 與 `.current/history/2026-10/` 都沒有 `e296`／`e308`；本機與 remote 都沒有 `feat/e296*`／`feat/e308*`／`integ/post-v4-w3`。`gh auth status` 登入正常。
- **hop cap 已是 14**（E295 出貨：`tools/transitions.ts:326`、`content/const-01-core-head.md:16`），兩條 lane 都跑在 `main` 的 server 上。
- `cutApprovalAutoTier` 在 `.current/.config.json` 是空物件（`{}`）、E296 本波才做 → 兩條 lane 的 cut 仍由人類在各自 lane session 核准（E296 出貨後，本 workspace 要不要加 `manifest: true` 是另一個人類決定，見「整合後」）。
- 本檔以 `docs/2026-10-15-fanout-post-v4-w3` branch 走 PR 併入 `main`（coord-03 記帳段：沒有開放波次時記帳走 docs branch），**併入後的 `main` sha 才是派工 base**（讓 lane branch 帶著本清單；派工時把 `base:` 改成該 sha 並記一列 Decisions）。
- **E296 的落點**（票面寫 `const-01`，實際 §3.1 Cut-Approval Auto-Tier 段在 `content/const-08-chain-31-mid.md:3`，chain tag）：const-08 該段加 manifest tier 的八個條件；`content/coord-03-core-fallback.md:45`（*Auto-tier writer action*）加 manifest-tier 的 writer action 與 `cut-approved: manifest-tier (<manifest path>, Decisions <date>)` 稽核句；`content/skill-pm.md:96` Gate Summary 加一欄 PM 自證「cut 無待選方案、無 needs-human-ruling 項」；`docs/lane-protocol.md:86`（§5-2 cut 預審）改成「cut 在任何核准寫入**之前**先送預審；只有條件不成立時才呈給人類」；`content/skill-integrator.md:79`（Stage 2）點名 `approval` 欄由人類在 Stage 2 對還想親看的 lane 填 `human`；`tools/config.ts:50–62`（`CutApprovalAutoTier` 型別）與 `:236–262`（parse，加 `manifest`，嚴格 `=== true`）；`docs/config.md:51`（欄位表加 `manifest`）；`tools/fanout-manifest.ts:16`（`LANES_HEADER` 是 8 欄**精確比對**，`:448` 列數必須相等 → `approval` 做成可選第 9 欄，**19 份既有 `specs/fanout-*.md` 全部要繼續 validate 通過**）、`:593` `parseDecisions`（條件 (2) 讀人類核准列，重用不另寫）、新 `check --cut <manifest> <lane> <spec>` 子指令（讀 PM cut 宣告的檔案清單，PM spec 的檔案清單格式由 lane 定義並寫進 skill-pm Gate Summary）；`scripts/fanout.mjs:6–13`（usage 與 routes 加 `--cut`）。`bin/**`、`templates/**` 不含 `cutApprovalAutoTier`，不受影響。
- **E296 的預算風險**：const-08 是 chain 片段 → 進 design-arm 憲法上限 10226 與 coordinator bundle 上限 21138（兩者都是 E297 re-baseline、**零 headroom**）與 non-design 8129；coord-03 進 coordinator bundle；skill-pm 另有 4401 上限。四個上限幾乎必然要調高 → 照第 2 波 R2 前例：qa 實測定值、人類核准 cut 時一併核准；goldens（`test/fixtures/compose-golden/**` 全部 12 份都含 const-08 或 coord-03／skill-pm）由 lane qa 重產。
- **E309 的落點**：`content/skill-integrator.md:166`（Stage 6-4 BEHIND 補救句「…`node scripts/merge-invariants.mjs`, the full suite, and a push of the integration branch…」）→ 改成 CI 優先（push 後 `--ci-check`，本機全套只在 CI fallback），一句。`test/e295-hop-cap-and-sop-halves.test.mjs:76–104` 釘住同檔 5a／5c 字串，6-4 不在其中，預期不動。
- **E308 的落點**：`tools/skill-frontmatter.ts:8`（`MODEL_TIERS`，只 import yaml/fs/path，**沒有循環相依風險**，適合當單一來源）；`tools/handoff-parse.ts:285–286`（`DISPATCH_PIN_TIER_VALUES` 字面值 + 未使用的 `DispatchPinTier` 型別 → 改成從 `MODEL_TIERS` 衍生或 re-export）；`tools/registry.ts:125`（`DISPATCH_PIN_TIER_HINT` 的四值字面值 → 從常數組出，**字串必須 byte-identical** 於 `gates/registry.ts:633` 的 `hintStatic`，`test/error-code-contract.test.mjs` 比對）、`:216–222`（註解「File-mode only, no gate」過時，E300 已是 tool-boundary gate）、`:579–594`（inputSchema 8 個 `enum: ["opus","sonnet","haiku","fable"]` 字面值 → 由常數生成）；`tools/handoff-orchestrator.ts:83–96`（advisory 的 `allowed` 已用常數；hint 文字裡的「opus, sonnet, haiku, fable」字面值）。測試：`test/dispatch-pins.test.mjs`、`test/skill-frontmatter.test.mjs:86–88`（`MODEL_TIERS` 四值 deepEqual）、`test/error-code-contract.test.mjs`、`test/e297-main-protected-sop.test.mjs:103`（同一 deepEqual，預期不動）。
- **E303 的落點**：zod parse 在 `tools/registry.ts:71`（`defineTool` 的 `run: (rawArgs) => handler(zodSchema.parse(rawArgs))`），**不在 `index.ts`** —— `index.ts:204` 只把 `ZodError` 格式化成文字。所以 emit 點放在 `defineTool.run`（catch `ZodError` → 對 message 以已註冊 gate code 開頭的 issue 呼叫 `emitGateTelemetry`（`tools/telemetry.ts:38`，從 raw args 取 `workspace_path`／`agent_id`／`active_feature`，取不到就 null）→ rethrow），`index.ts` 照第 1 波前例**不動、維持共同禁止**；lane 若證明非改 `index.ts` 不可，走信箱 `escalate`，由整合者記一列 Decisions 重劃。`gates/registry.ts:45–47`、`:112–116` 的 producer 註解改成實話（fires 可觀測）；`:107` 的 mapping 行與「`(none)` 零次」被 `test/e295-hop-cap-and-sop-halves.test.mjs:110–111` 釘住，**不得動**。`test/e35-pipeline-order.test.mjs:109–145`（tool-boundary code 不進 pipeline step）預期仍成立；`test/e26-gate-stats.test.mjs`（34 碼 zero_fire 覆蓋）預期不動；`test/telemetry.test.mjs`（emit 形狀、THROW1／THROW2 不可拋）要加 zod 邊界案例。
- task id：lane e296 用 `T-E296-NN`／`T-E309-NN`；lane e308 用 `T-E308-NN`／`T-E303-NN`（同一 lane、同一 spec；證據檔名跟 task id 走）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- **cut 先寄信箱預審（`type: proposal`），整合者 `close` 之後才呈給人類核准**（lane-protocol §5-2）；有 architect hop 的票預審兩次。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e296 | E296、E309 | feat/e296-manifest-tier-cut-approval | ../agent-governance-mcp-lanes/e296 | `content/const-08-chain-31-mid.md`、`content/coord-03-core-fallback.md`、`content/skill-pm.md`、`content/skill-integrator.md`、`content/constitution-rationale.md`（只在需要搬理由時）、`docs/lane-protocol.md`、`docs/config.md`、`tools/config.ts` 與其 `dist/tools/config.*`、`tools/fanout-manifest.ts` 與其 `dist/tools/fanout-manifest.*`、`scripts/fanout.mjs`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e5-intake-tiering.test.mjs`、`test/cut-approval-gate.test.mjs`、`test/e177a-manifest.test.mjs`、`test/e177a-check-cli.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e248-relative-mailbox-header.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/render-structure.test.mjs`、`test/config-cache.test.mjs`、`test/config-versioning.test.mjs`、`test/e31-config-nonfatal.test.mjs`、`test/agc-adapters.test.mjs`（只在 adapter 文字提到 auto-tier 時）、`test/p0-onboarding-lite-default.test.mjs`（同上）、`test/e296-*.test.mjs`、`specs/e296-*`、`qa_reports/*E296*`、`qa_reports/*E309*`、`review_reports/*E296*`、`review_reports/*E309*`、`.current/e296/**` | 其他 `content/**`、其他 `tools/**`（特別是 `tools/registry.ts`、`tools/handoff-parse.ts`、`tools/handoff-orchestrator.ts`、`tools/skill-frontmatter.ts`、`tools/telemetry.ts`）、`gates/**`、其他 `scripts/**`、其他 `test/**`（特別是 `test/dispatch-pins.test.mjs`、`test/error-code-contract.test.mjs`、`test/telemetry.test.mjs`）、其他 `dist/**`、其他 `specs/**`、其他 `docs/**`、共同禁止的全部項目 | 做：(1) E296 票面 (1)–(8) 全部：const-08 §3.1 Auto-Tier 段加 manifest tier（八個條件：config `manifest: true`；lane branch 帶 `specs/fanout-<id>.md` 且 Decisions 有人類核准列、Lanes 表有本 lane 列；cut 的每個檔案都在該列擁有集合內，用新 `fanout.mjs check --cut` 機械檢查；cut 無待選方案、無 needs-human-ruling，PM Gate Summary 自證；既有 no-schema-change、non-design 仍成立，`maxFiles`／`maxPriority` 被該列取代；整合者預審已 `close`；該列 `approval` 欄不是 `human`；稽核句 `cut-approved: manifest-tier (<manifest path>, Decisions <date>)`）；coord-03 writer action；skill-pm Gate Summary 欄；lane-protocol §5-2（預審在任何核准寫入之前；只有條件不成立才呈人類）；skill-integrator Stage 2 點名 `approval` 欄；`tools/config.ts` 解析 `manifest`（嚴格 `=== true`）+ `docs/config.md`；`tools/fanout-manifest.ts` + `scripts/fanout.mjs`：`approval` 可選第 9 欄 + `check --cut`。硬條件：19 份既有 `specs/fanout-*.md` 在改後 `validate` 全部仍通過；`render` 輸出對既有 8 欄清單 byte-identical。(2) E309：skill-integrator Stage 6-4 BEHIND 補救句改成 CI 優先（一句）。建議走 architect hop（P2、~8 檔、新 CLI 子指令、既有格式相容性）。PM 切票：同一檔的句子併成一個 task；四個 budget 上限由 qa 實測、人類核准 cut 時定；goldens 由 qa 重產。　不做：本 workspace `.current/.config.json` 加 `manifest: true`（人類決定，整合後）；E286（integrator 改版 wave 1）；任何 `tools/registry.ts`／dispatch-pins 相關程式（E308／E303 在另一條 lane）；不動 `index.ts`、`bin/**`、`templates/**`。 | 無 |
| e308 | E308、E303 | feat/e308-tier-enum-and-zod-telemetry | ../agent-governance-mcp-lanes/e308 | `tools/registry.ts` 與其 `dist/tools/registry.*`、`tools/handoff-parse.ts` 與其 `dist/tools/handoff-parse.*`、`tools/handoff-orchestrator.ts` 與其 `dist/tools/handoff-orchestrator.*`、`tools/skill-frontmatter.ts` 與其 `dist/tools/skill-frontmatter.*`、`tools/telemetry.ts` 與其 `dist/tools/telemetry.*`、`gates/registry.ts` 與其 `dist/gates/registry.*`（只限 producer／tool-boundary 註解；`:107` mapping 行與「零個 `(none)`」不得動）、`test/dispatch-pins.test.mjs`、`test/skill-frontmatter.test.mjs`、`test/error-code-contract.test.mjs`、`test/telemetry.test.mjs`、`test/e26-gate-stats.test.mjs`、`test/e35-pipeline-order.test.mjs`（只在 tool-boundary 斷言需要 re-pin 時）、`test/e297-main-protected-sop.test.mjs`（只限 `:103` 的 `MODEL_TIERS` deepEqual，預期不動）、`test/e308-*.test.mjs`、`test/e303-*.test.mjs`、`specs/e308-*`、`qa_reports/*E308*`、`qa_reports/*E303*`、`review_reports/*E308*`、`review_reports/*E303*`、`.current/e308/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/**`、`tools/config.ts`、`tools/fanout-manifest.ts`、`scripts/**`、其他 `tools/**`、其他 `gates/**`、其他 `test/**`、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目（含 `index.ts`） | 做：(1) E308：`DISPATCH_PIN_TIER_VALUES` 從 `MODEL_TIERS` 衍生或 re-export（建議 `tools/skill-frontmatter.ts` 當單一來源，它不 import 任何 tools 模組）；`tw_update_state` inputSchema 8 個 `enum` 陣列與 `DISPATCH_PIN_TIER_HINT` 的四值列表由同一常數生成；hint 字串對 `gates/registry.ts` `hintStatic` **byte-identical**（error-code-contract 比對）；advisory hint 的四值文字同源；`DispatchPinTier` 型別用上或刪掉；`tools/registry.ts:216–222` 過時的「no gate／File-mode only」措辭改正。(2) E303：在 `tools/registry.ts` `defineTool.run` 的 zod parse 外 catch `ZodError`，對 message 以已註冊 gate code 開頭的 issue 呼叫 `emitGateTelemetry`（workspace_path／agent_id／active_feature 從 raw args 盡力取，取不到為 null；emit 永不拋、永不改變回傳文字），再 rethrow；`tw_gate_stats` 對 `DISPATCH_PIN_TIER_REJECTED` 能顯示 fires；`gates/registry.ts` producer 註解改成實話。無 schema 變更、無 content 變更。PM 切票：E308 一個 task（單一來源 + 生成）、E303 一個 task（emit 點）、qa 一個 task。　不做：改 `index.ts`（zod parse 不在那裡；真的需要 → 信箱 `escalate`，不自行擴權）；改 `content/**` 任何一字（E300 的 coord-02 句子已出貨，不重述）；改 `gates/registry.ts` 的 mapping 行；新增 gate code（E303 是既有碼的可觀測性，不是新 gate）。 | 無 |

## 所有權重劃（相對於預設）
- 兩條 lane 擁有集合不相交；沒有跨 lane 的重劃。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e296。
- **`index.ts` 維持共同禁止**（第 1 波前例）：E303 票面寫「index.ts / registry.ts run() error path」，核對後 zod parse 在 `tools/registry.ts:71`，`index.ts` 不必動。
- **`gates/registry.ts` 劃給 e308 但只限註解**，且 `:107` mapping 行與零個 `(none)` 被 e296 擁有的 `test/e295-hop-cap-and-sop-halves.test.mjs` 釘住 —— 這是 prose 約束，`fanout check` 不會機械檢查，整合者在 5a 看 diff。
- **`test/error-code-contract.test.mjs` 劃給 e308**：E296 不新增 gate code、不改 hint，content 改動不會碰到它；若 e296 的 qa 發現該測試對 content 有釘（例如 code 的 backtick 引用計數），走信箱，整合者記 Decisions 重劃。
- **E296 票面的 `const-01` 更正為 `const-08`**（§3.1 Auto-Tier 段的實際位置；只改清單，不改票）。
- **E296 的 `approval` 欄**：`LANES_HEADER` 今天是 8 欄精確比對；新欄做成可選第 9 欄、舊清單不動 —— 這是本清單加的硬條件（相容性），不是票面重寫；lane 若主張改成必填欄並改寫 19 份舊清單，走信箱 `escalate`，是「改票」，交人類。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| const-08 §3.1 Auto-Tier 段有 manifest tier 的八個條件與稽核句 | e296（E296-1） | ✓ |
| coord-03 writer action 含 manifest-tier；skill-pm Gate Summary 有「無待選方案／無 needs-human-ruling」自證欄 | e296（E296-1） | ✓ |
| lane-protocol §5-2：cut 在任何核准寫入前先預審；條件不成立才呈人類 | e296（E296-1） | ✓ |
| skill-integrator Stage 2 點名 `approval` 欄 | e296（E296-1） | ✓ |
| `tools/config.ts` 解析 `cutApprovalAutoTier.manifest`（嚴格 true）；`docs/config.md` 欄位表有它 | e296（E296-2） | ✓ |
| `fanout-manifest.ts`／`fanout.mjs`：`approval` 可選第 9 欄 + `check --cut`；19 份舊清單 validate 仍過、render 對舊清單 byte-identical | e296（E296-2） | ✓ |
| compose goldens 重產、budget 四上限綠（調高由人類核准 cut 時定） | e296（qa） | ✓ |
| skill-integrator Stage 6-4 BEHIND 補救句改 CI 優先 | e296（E309） | ✓ |
| `DISPATCH_PIN_TIER_VALUES` 與 `MODEL_TIERS` 單一來源；inputSchema enum ×8、hint 列表、advisory 文字同源；hint 對 `hintStatic` byte-identical；`DispatchPinTier` 用上或刪；`tools/registry.ts` 過時措辭改正 | e308（E308） | ✓ |
| zod 邊界的 `DISPATCH_PIN_TIER_REJECTED` 會 emit telemetry；`tw_gate_stats` 能顯示它 fired；`gates/registry.ts` producer 註解為實 | e308（E303） | ✓ |
| error-code-contract、e35 pipeline-order、e26 gate-stats、telemetry 全綠 | e308（qa） | ✓ |
| E296、E303、E308、E309 done-mark；佇列 #117、#120、#125、#126 勾 DONE | 整合者（5c） | ✓ |
| 本 workspace `.current/.config.json` 加 `manifest: true`（第一次真的用 manifest-tier） | 人類決定（整合後，不是票） | ✗（人類） |

一個 ✗ 是人類決定，不是空格。

## 整合後（整合者自己的 commit／接線）
- 合併順序 e296 → e308（共享生成物 lane 先）；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → `--ci-check`（本機全套只在 CI fallback）。
- backlog done-mark：E296、E303、E308、E309；佇列 #117、#120、#125、#126 勾 DONE。
- **人類決定**：本 workspace `.current/.config.json` 的 `cutApprovalAutoTier` 要不要加 `manifest: true`（出貨後第 4 波起 lane cut 可自動核准）；要的話由整合者在記帳 commit 一併加，並在第 4 波清單 Stage 2 對想親看的 lane 填 `approval: human`。
- 第 4 波建議：E286（integrator 改版 wave 1，`docs/integrator-revision-2026-10-08.md` §7.3）—— 會再碰 `skill-integrator.md`／`lane-protocol.md`，所以排在 E296 之後。
- 發版：第 3 波結案後 `main` 帶 E297–E301 + E303／E308 server 行為變更 + E296 → 仍建議 MINOR（v4.6.0），由人類決定；E310（7a basename 撞名）在發版前要看。

## 合併順序
`integ/post-v4-w3` ← `--no-ff` e296 → merge-invariants → `--no-ff` e308 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish e296 --shipped --base integ/post-v4-w3`、`finish e308 --shipped --base integ/post-v4-w3` → 記帳 commit → `git push -u origin integ/post-v4-w3` → `--ci-check` → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main && git pull --ff-only` → `git branch -d integ/post-v4-w3`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## Dispatch pins
- e296：`sr-engineer=fable`（人類長期偏好）。
- e308：`sr-engineer=fable`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-15 | 人類 | 第 2 波結案後做第 3 波：E296 + E309 一條 content lane ∥ E308 + E303 一條程式 lane；5a／5b 改讀 CI（E298 SOP 已出貨） | 整合者 session |
| 2026-10-15 | 整合者 | 兩條 lane 擁有集合不相交；`index.ts` 維持共同禁止（E303 的 zod parse 在 `tools/registry.ts:71`）；`gates/registry.ts` 劃給 e308 只限註解；`test/error-code-contract.test.mjs` 劃給 e308；E296 票面 `const-01` 更正為 `const-08`；`approval` 欄做成可選第 9 欄、19 份舊清單不動；E296 建議 architect hop、預審兩次；四個 budget 上限由 qa 實測、人類核准 cut 時定 | 本檔 |
| 2026-10-15 | 人類 | 核准本清單（含六項裁定：`index.ts` 維持禁止、`gates/registry.ts` 只限註解、error-code-contract 劃給 e308、`const-01` 更正為 `const-08`、`approval` 可選第 9 欄、E296 走 architect hop），開始派工 | 整合者 session |
