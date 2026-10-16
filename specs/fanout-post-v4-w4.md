# Fan-out: post-v4 佇列第 4 波（程式 lane：E320 + E319 + E317 + E321 ∥ content lane：E286 ∥ 程式 lane：E312）
base: 406ba87    integration branch: integ/post-v4-w4
mailbox: ../agent-governance-mcp-lanes/_mailbox

**狀態：人類已核准（Stage 2，2026-10-15）；v4.6.0 已發版（2026-10-16），本清單 PR 併入後派工。** `base:` 是規劃基準（v4.6.0 發版記帳 PR #12 merge）；實際派工 base = 本清單併入後的 `main` sha，記在 Decisions 派工列。

第 3 波結案時的建議照做：E320（P1）＋ E319 ＋ E317 是互不重疊的小程式修正，併成一條程式 lane；E321 是純測試稽核（qa 單一 judge），同 lane 順手做。E286（integrator 改版第 1 波）是本波唯一碰 `content/**` 的 lane。E312（AC-MIG-3 可能的真 race）檔案與前兩條不相交，人類核准開成第三條 lane。

## 派工前核對（整合者，2026-10-15，規劃時；派工時重做一次）
- `git worktree list` 只有 primary；main = origin/main = `406ba87`（v4.6.0：release PR #11 `807828a`、發版記帳 PR #12；tag `v4.6.0`）；遠端只剩 `main`。`tw_detect_drift` 無 drift（只有 T-REL4-02 的證據提示）。`<lanes-root>/_mailbox/` 是空的；`.current/` 與 `.current/history/` 都沒有 `e320`／`e286`／`e312`。
- `.current/.config.json` 的 `cutApprovalAutoTier` 未加 `manifest: true` → 本波每條 lane 的 cut 仍由人類在各自 lane session 核准；Lanes 表不加 `approval` 欄。
- **發版先行（已完成）**：v4.6.0 改了 `package.json`、`CHANGELOG.md`、`index.ts` 版本字面值、三個 adapter stamp、`dist/`；派工 base 在發版之後，lane 不必再 merge main。發版途中 `test/e308-single-source-tier-enum.test.mjs` 的「`index.ts` 對 lane base `c392cc3` 無 diff」斷言被版本 bump 打紅，已在 release commit `71fb458` 改成內容檢查。
- **E320 的落點**：`scripts/verify-release.mjs:353–370`（`--ci-check` 共用實作；非 `--strict` 時 `reason` → `WARN … graceful degradation` → PASSED）、`:517–524`（找 run 的分支取自目前 checkout）。發版路徑不受影響：release-engineer 8b 用 `--ci-check --strict`（`content/skill-release-engineer.md:230`），找不到即 FAIL；2a 對 `main` HEAD 查 `main`，sha 在該分支上。票面 (c)：修好後 `content/skill-integrator.md` 5a 不需改字 → e320 不碰 content。測試 `test/verify-release.test.mjs`（內含 E238 load-sensitive timing 測試，不得動）。
- **E319 的落點**：`gates/visual.ts:98–129` `parseDesignMode`，兩個呼叫點 `:88`（visual gate arm）與 `:825`（source-credibility），同一函式修一次即兩處生效。測試 `test/source-credibility-gate.test.mjs`、`test/visual-evidence-gate.test.mjs`。
- **E317 的落點**：`tools/registry.ts:84–100` `emitZodGateTelemetry`（已有 absolute／isDirectory guard，缺 basename `.current` guard）。測試 `test/e303-zod-boundary-telemetry.test.mjs`。
- **E321 的落點**：`test/e177b-lane-status.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e299-check-bookkeeping.test.mjs`。規劃時 grep：多數用 tmp fixture；`e235b:359` 是對全部 `specs/fanout-*.md` 的 validate 掃描（穩定結構，可留）；稽核結論可以是「無需改」，但要寫進證據。**整合者併入（同類）**：「對固定 lane base sha 做 diff 而斷言檔案不變」的測試，在下一次正當修改（例如發版 bump）時必紅 —— v4.6.0 已踩到一次。e320 的 qa 對全部 `test/**` grep 這個模式並在證據列出；只修 e320 擁有的檔，其他檔（例如 e286 擁有的 `test/e178a-integrator-role.test.mjs:19`／`:283`、`test/e296-manifest-tier.test.mjs:290` AC10）只列出、不改。
- **E286 的落點**：`content/skill-integrator.md`（O8 中途修 base 的整合者端、O10 有條件引用 lane 核准、O4 裁決者兩值、O5 只監看自己清單的 lane）、`docs/lane-protocol.md`（O8 lane 端暫停規則）。O8 第 (4) 步用 `git merge-tree --write-tree` 預測衝突：它不在憲法 §6 的唯讀清單（`content/const-15-core-tail.md:12–15`）也不在整合者 grant → 若 PM 判定要入 §6，就動憲法片段 → compose goldens（12 份）與 budget 上限要由 lane qa 重產／實測，人類核准 cut 時一併核准。integrator SOP 本身不在 goldens、無 budget 上限（`docs/integrator-revision-2026-10-08.md` §7.1）。讀 SOP／lane-protocol 的測試：`test/e178a-integrator-role.test.mjs`、`test/e177a-manifest.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e177b-mailbox-watch.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/render-structure.test.mjs`。
- **E286 的依賴 E282**：E282 是「下一支註解 proof 腳本要對 merge-base 算 scope」的延續提醒，沒有要改的追蹤檔；它與 O8（中途把 main merge 進 lane）正好是同一個觸發點。人類裁決（2026-10-15）：E282 的一句提醒併進 E286 的 lane-protocol O8 段（lane 端：merge 進來後，任何 scope 檢查改對 merge-base 算），E282 隨 E286 結案。
- **E312 的落點**：`tools/lane-migrate.ts`（lock-free core）、`tools/handoff-parse.ts`（`migrateOwnWorkspaceIfFlat` 讀路徑）；測試 `test/e123b9-lane-flip.test.mjs`。與 e320 的 `tools/registry.ts`、`gates/visual.ts` 不相交。結論若是「只是 timing」→ 是否把 AC-MIG-3 列入 load-sensitive 家族仍是人類裁決，lane 不可自定。
- task id：lane e320 用 `T-E320-NN`／`T-E319-NN`／`T-E317-NN`／`T-E321-NN`；lane e286 用 `T-E286-NN`；lane e312 用 `T-E312-NN`。不重用前波 id（E310）。

### 所有 lane 共通的範圍（寫進 prompt）
- `test/**` 的改動只有 qa-engineer 能寫（憲法 §2）。
- 全套一律包 `node scripts/test-lock.mjs -- npm test`，最後一次全套在最後的 HEAD 上跑；證據與 spec 不寫本機路徑字面值。
- 測試不得斷言真實 `specs/fanout-*.md` 會增長的內容（列數、最新日期、行號、整份輸出 hash）；要用就在測試裡建固定清單（E321 的教訓）。
- lane 的 git 指令一條一條下；含 git 的複合指令會被守衛拒絕。
- cut 先寄信箱預審（`type: proposal`），整合者 `close` 之後才呈給人類核准（lane-protocol §5-2）。
- 不 push、不 merge、不發版、不刪 worktree；hop 用完 → `type: escalate`。
- 共同禁止：`docs/backlog.md`、`docs/v4.0.0-new-tickets.md`、`specs/fanout-*.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`、`CLAUDE.md`、`AGENTS.md`、`.antigravityrules`、`templates/**`、`.github/**`、`.current/history/**`、`index.ts`、`bin/**`。

## Lanes
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e320 | E320、E319、E317、E321 | feat/e320-ci-check-sha-and-small-fixes | ../agent-governance-mcp-lanes/e320 | `scripts/verify-release.mjs`、`gates/visual.ts` 與其 `dist/gates/visual.*`、`tools/registry.ts` 與其 `dist/tools/registry.*`、`test/verify-release.test.mjs`、`test/source-credibility-gate.test.mjs`、`test/visual-evidence-gate.test.mjs`、`test/e303-zod-boundary-telemetry.test.mjs`、`test/e177b-lane-status.test.mjs`、`test/e178b-fanout-unmatched.test.mjs`、`test/e235b-relative-worktree.test.mjs`、`test/e299-check-bookkeeping.test.mjs`、`test/e320-*.test.mjs`、`test/e319-*.test.mjs`、`test/e317-*.test.mjs`、`specs/e320-*`、`qa_reports/*E320*`、`qa_reports/*E319*`、`qa_reports/*E317*`、`qa_reports/*E321*`、`review_reports/*E320*`、`review_reports/*E319*`、`review_reports/*E317*`、`.current/e320/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/**`、其他 `scripts/**`、其他 `tools/**`（特別是 `tools/lane-migrate.ts`、`tools/handoff-parse.ts`）、其他 `gates/**`、其他 `test/**`（特別是 `test/e123b9-lane-flip.test.mjs` 與 E286 列出的 SOP 測試）、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目 | 做：(1) E320 票面 (a)(b)：給 `--sha` 時以 sha 跨分支找 run（`gh run list --commit`，或從含該 sha 的遠端分支取 `--branch`）；給 `--sha` 而輪詢預算內找不到已完成的 run → FAIL，不再降級成 PASSED；不給 `--sha` 的發版路徑與 `gh` 不可用（E298 CI fallback）維持原樣。(2) E319：`parseDesignMode` 取該行**位置最前**的已知 mode（或只解析分隔符後第一個 token），`no-design` 照樣勝過單獨 `design`；inline／bullet／H2 與反引號包住的值照舊可解；兩個呼叫點自然同修。(3) E317：`emitZodGateTelemetry` 加一行 guard —— `workspace_path` 的 basename 是 `.current` 時不 emit。(4) E321：qa 稽核四個測試檔，凡斷言真實清單可增長內容的改用固定清單；結論「無需改」也要寫證據。PM 切票：E320、E319、E317 各一個 sr task，qa 一個 task 涵蓋三者測試，E321 一個 qa-only task。　不做：改 `content/skill-integrator.md` 5a 或 `content/skill-release-engineer.md`（票面 (c) 已定不需改字）；動 `test/verify-release.test.mjs` 內 E238 load-sensitive timing 測試；E312。 | 無 |
| e286 | E286 | feat/e286-integrator-trust-and-git | ../agent-governance-mcp-lanes/e286 | `content/skill-integrator.md`、`docs/lane-protocol.md`、`content/const-15-core-tail.md`（只在 PM 判定 `git merge-tree --write-tree` 要入 §6 時）、`content/constitution-rationale.md`（只在需要搬理由時）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`test/e178a-integrator-role.test.mjs`、`test/e177a-manifest.test.mjs`、`test/e130-lane-default.test.mjs`、`test/e177b-mailbox-watch.test.mjs`、`test/e246-mailbox-teardown.test.mjs`、`test/e296-manifest-tier.test.mjs`、`test/e297-main-protected-sop.test.mjs`、`test/e295-hop-cap-and-sop-halves.test.mjs`、`test/render-structure.test.mjs`、`test/e286-*.test.mjs`、`specs/e286-*`、`qa_reports/*E286*`、`review_reports/*E286*`、`.current/e286/**` | 其他 `content/**`、`tools/**`、`gates/**`、`scripts/**`、其他 `test/**`（特別是 E320 列出的測試與 `test/e123b9-lane-flip.test.mjs`）、`dist/**`、其他 `specs/**`、其他 `docs/**`、共同禁止的全部項目 | 做：E286 票面 O8／O10／O4／O5 全部。O8：整合者端「中途修 base」正式步驟（開插入 lane 仍是人類決定；merge 目標 branch 進各 lane 須 (1) 修正已併入並 push、(2) 修正沒碰任何 lane 擁有檔（`fanout check`）、(3) lane 已暫停並 ack、整合者核對其 tree 乾淨、(4) `git merge-tree --write-tree` 預測無衝突（git 2.38+；grant 無 `merge --abort`，預測衝突或 git 太舊即停下問人）、(5) merge-invariants、lane build 與 audit、恢復通知、一列 Decisions）；lane-protocol 加對應的 lane 端暫停規則。O10：lane session 裡的人類核准只在「只影響該 lane、寫在已核准的 cut、在 lane branch 上可見（引檔名與 sha）」時免再問，其他仍在整合者 session 問；信箱仍不載核准。O4：SOP 點名兩個 `裁決者` 值（誰決定；誰執行寫進 `內容`）。O5：只監看自己清單的 lane 信箱；別份清單的 lane 可用 `lane-status` 讀、`lane-status --watch` 看。E282（人類併入）：lane-protocol O8 段加一句 —— main／目標 branch merge 進 lane 之後，任何 scope 檢查（含註解 proof 腳本）改對 merge-base 算，不對固定 base sha 算；註解 proof 另斷言每一行改動都是註解。PM 判定 merge-tree 是否入 §6；入則 goldens 由 qa 重產、budget 上限由 qa 實測、人類核准 cut 時定。若動 `content/const-15-core-tail.md`：`test/e178a-integrator-role.test.mjs:283` 對固定 base `3c72a83` 算 §6 增加行數（base 不在 clone 時 skip），qa 判斷是否改成內容檢查。　不做：E283／E284／E285／E287–E294（改版其他票）；任何程式、`scripts/**`、`tools/**`；E296 manifest tier 的條件文字（已出貨，不重述）。 | 無 |
| e312 | E312 | feat/e312-read-path-migration-race | ../agent-governance-mcp-lanes/e312 | `tools/lane-migrate.ts` 與其 `dist/tools/lane-migrate.*`、`tools/handoff-parse.ts` 與其 `dist/tools/handoff-parse.*`、`test/e123b9-lane-flip.test.mjs`、`test/e312-*.test.mjs`、`specs/e312-*`、`qa_reports/*E312*`、`review_reports/*E312*`、`.current/e312/**` | `content/**`（全部）、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`、`docs/**`、`scripts/**`、其他 `tools/**`（特別是 `tools/registry.ts`）、`gates/**`、其他 `test/**`、其他 `dist/**`、其他 `specs/**`、共同禁止的全部項目 | 做：E312 票面：在 CI 類負載下重現 AC-MIG-3；分清 (a) 讀路徑 lock-free 遷移的真 race（修在 `tools/lane-migrate.ts`／`tools/handoff-parse.ts`：讀路徑拿 lane lock，或遷移進行中容忍兩份並存）與 (b) 只是測試 timing。(a) → 修程式、測試照舊；(b) → qa re-pin 測試並在證據寫明，列入 load-sensitive 家族一事以 `needs human ruling` 交回整合者。　不做：自行把 AC-MIG-3 列入 E298 flake 家族；改 `docs/backlog.md`；動 e320 擁有的 `tools/registry.ts`。 | 無 |

## 所有權重劃（相對於預設）
- 三條 lane 擁有集合不相交；沒有跨 lane 的重劃。共享生成物（`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`）全部在 e286。
- **E321 併進 e320**：純測試票（qa-only task），四個測試檔都只讀 `tools/**`／`scripts/**` 的行為，不讀 content；與 e286 擁有的 SOP 測試不重疊。
- **`content/const-15-core-tail.md` 條件式劃給 e286**：只在 PM 判定 `git merge-tree --write-tree` 要入憲法 §6 時才可動；不動則 goldens／budget 也不動。
- **`test/e296-manifest-tier.test.mjs` 劃給 e286**：它讀 `docs/lane-protocol.md` 與 skill-integrator 的字串，E286 改這兩檔時可能要 re-pin。
- **`test/e303-zod-boundary-telemetry.test.mjs` 劃給 e320**（E317 的落點），第 3 波 e308 已結案，無衝突。

## 完成定義 → 票
| 完成定義條目 | 由哪張票讓它成立 | 同一波？ |
|---|---|---|
| `verify-release.mjs --ci-check --sha <sha>` 在 primary（`main`）上對 lane sha 能找到它的 run；紅 → FAILED；找不到已完成 run → FAILED，不再 PASSED | e320（E320） | ✓ |
| 不給 `--sha` 的發版路徑與 `--strict` 行為不變；`test/verify-release.test.mjs` 的 E238 timing 測試未動且綠 | e320（E320 + qa） | ✓ |
| `parseDesignMode` 對 `image (no Figma)` 回 `image`、對 `no-design (no Figma)` 回 `no-design`；visual gate 與 source-credibility 兩個消費者都有否定句案例 | e320（E319 + qa） | ✓ |
| `workspace_path` 為 `<ws>/.current` 加錯誤 tier 時不再寫 `<ws>/.current/.current/…/telemetry.jsonl` | e320（E317 + qa） | ✓ |
| 四個讀真實清單的測試稽核完畢，可增長內容的斷言改用固定清單（或證據寫明無需改） | e320（E321） | ✓ |
| skill-integrator 有 O8 中途修 base 五條件步驟；lane-protocol 有 lane 端暫停規則 | e286（E286） | ✓ |
| skill-integrator 有 O10 有條件引用、O4 裁決者兩值、O5 只監看自己清單 | e286（E286） | ✓ |
| `git merge-tree --write-tree` 的許可有明文出處（§6 或 SOP 判定為唯讀）；若動憲法，goldens 重產、budget 綠 | e286（E286 + qa） | ✓ |
| lane-protocol O8 段有 merge-base scope 句（E282 併入，隨 E286 結案） | e286（E286） | ✓ |
| AC-MIG-3 的成因判定與修正（真 race 修程式，或 timing re-pin） | e312（E312） | ✓ |
| E320、E319、E317、E321、E286、E282、E312 done-mark；佇列對應列勾 DONE | 整合者（5c） | ✓ |

✗ 是人類決定，不是空格。

## 整合後（整合者自己的 commit／接線）
- 合併順序 e286 → e320 → e312（共享生成物 lane 先）；每次 merge 後 `merge-invariants`；全部合併後重建 `dist/`、`check:bookkeeping`、push integ → 以 `gh run list --branch integ/post-v4-w4 --commit <sha>` 讀 CI（E320 併入前不用 `--ci-check`；本機全套只在 CI fallback）。
- 5a 讀 lane CI 一律用 `gh run list --branch <lane branch> --commit <sha>`（E320 修正在 lane 上，primary 的工具仍是舊版）。
- backlog done-mark 與佇列 DONE（含 E282，隨 E286）。

## 合併順序
`integ/post-v4-w4` ← `--no-ff` e286 → merge-invariants → `--no-ff` e320 → merge-invariants → `--no-ff` e312 → merge-invariants → 重建 `dist/` → `check:bookkeeping` → 在 integ 上依序 `finish <lane> --shipped --base integ/post-v4-w4` → 記帳 commit → push → 讀 CI → `gh pr create` → `gh pr merge --auto --merge` → merged 後 `git switch main`、`git pull --ff-only` → `git branch -d integ/post-v4-w4`。預期零檔案衝突（擁有集合不相交）；`dist/` 不手解，重建。

## Dispatch pins
- e320：`sr-engineer=opus`。
- e286：`sr-engineer=opus`。
- e312：`sr-engineer=opus`。

## Decisions
| 日期 | 裁決者 | 內容 | 出處 |
|---|---|---|---|
| 2026-10-15 | 人類 | 第 3 波結案後：先發版，再 fan-out 第 4 波 | 整合者 session |
| 2026-10-15 | 整合者 | 草案：e320（E320＋E319＋E317＋E321）∥ e286（E286，唯一 content lane）∥ e312（E312，可選）；三條擁有集合不相交；`const-15` 條件式劃給 e286；E321 併入 e320；派工 base 放在發版之後；5a 以 `gh run list --branch --commit` 讀 lane CI | 本檔 |
| 2026-10-15 | 人類 | 核准本清單（全部）：三條 lane（e320、e286、e312）；E282 併入 E286 的 lane-protocol O8 段、隨 E286 結案；`git merge-tree --write-tree` 是否入憲法 §6 由 e286 PM 判定，入則 goldens 重產、budget 上限由 qa 實測、人類核准 cut 時定；派工 base 放在 v4.6.0 發版併入之後 | 整合者 session |
| 2026-10-16 | 整合者 | v4.6.0 已發版（PR #11 `807828a`、記帳 PR #12 → `main` `406ba87`）；本清單 branch `--no-ff` 併入 `main`（merge-invariants PASS），`base:` 改為 `406ba87`。E321 併入同類：「對固定 lane base 做 diff 斷言不變」的測試在發版 bump 時必紅（v4.6.0 途中 `test/e308-single-source-tier-enum.test.mjs` 已在 `71fb458` 改成內容檢查）→ e320 qa 全 repo grep 列出，只修自己擁有的檔；e286 若動 `const-15`，由其 qa 判斷 `test/e178a-integrator-role.test.mjs:283` | 本檔 |
