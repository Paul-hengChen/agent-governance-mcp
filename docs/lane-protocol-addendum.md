# Lane protocol 補充規則（agent-governance-mcp）

> 本 repo 對 `docs/lane-protocol.md`（agc 通用規則）的補充：只填通用規則寫「見補充規則」的地方，不改寫通用規則。
> `.current/.config.json` 的 `laneProtocolAddendum` 指向本檔，`fanout.mjs render` 產生的派工 prompt 會要 lane 兩份都讀。

## §1 開工

- `agc` 在本 repo 不在 PATH 上，一律用 `node bin/agc-init.mjs` 呼叫（adopter 裝了套件後才有 `agc`），例如 `cd <primary> && node bin/agc-init.mjs feature start <ticket-slug> --base <base> --path <worktree>`。
- worktree 建好之後，先在 worktree 裡跑 `npm run build`。
- 要改相依套件：先 `rm node_modules`（只刪 symlink），再 `npm ci`；不要直接在 lane 裡跑 `npm ci` / `npm install`。

## §2 檔案邊界

- 共享生成物：`content/**`、`test/fixtures/compose-golden/**`、`test/context-budget.test.mjs`。
- 測試目錄是 `test/`（含 `test/fixtures/**`），只有 qa-engineer 能碰。

## §3 執行與驗證

- tracked 建置產物是 `dist/`（`npm run build` 產生，`npx` 使用者直接執行它），在自己的 branch 上和原始碼一起 commit。
- `.current/` 頂層唯一要 commit 的例外是 `.current/tasks-index-receipt.json`（E125a 的反向遷移 receipt，tracked）。
- 只看已追蹤檔案的檢查：`check-md-tables` 等只看 `git ls-files`（Wave 5 的 E174：commit 前 2417/2417，commit 後 2415/2417）。
- 常駐測試釘歷史 SHA 的例外，範例見 `test/e130-lane-default.test.mjs`（E229）。

## §4 新發現

- root 的 `NEW-TICKETS.md` 已退役，**不要再寫**；新發現只寫 `.current/<lane>/pending-tickets.md`。

## §5 信箱

- `fanout.mjs` 在本 repo 用 `node scripts/fanout.mjs …` 呼叫，例如 cut 預審之後跑 `node scripts/fanout.mjs check --cut specs/fanout-<id>.md <lane> specs/<feature>.md`。
- 整合者 SOP 與 coordinator 呼叫的其他 agc 工具，在本 repo 一樣用 repo 相對路徑：`node scripts/mailbox-watch.mjs`、`node scripts/lane-status.mjs`、`node scripts/merge-invariants.mjs`、`node scripts/test-lock.mjs`（全套一律 `node scripts/test-lock.mjs -- npm test`）、`node scripts/feature-rollup.mjs`。
- 整合者 SOP 的「repo 的 CI 檢查」在本 repo 是 `node scripts/verify-release.mjs --ci-check --sha <sha>`（只在本 repo 能用：它從自己的位置找 repo）。
- 整合者 5c 的記帳檢查是 `npm run check:bookkeeping`：記帳 commit 前跑、要 exit 0；它也透過測試檔在 `npm test` 裡，PR 的 CI 會再跑一次。

## §7 中途修 base

- 恢復通知點名要重建的建置產物就是 `dist/`：確認 HEAD 之後把它 commit 掉。
- merge-base 規則也適用註解 proof 腳本：它一樣對 merge-base 算，另外斷言每一行改動都是註解（只比對去掉註解後的編譯產物，連只改型別註記的改動也會過）。
