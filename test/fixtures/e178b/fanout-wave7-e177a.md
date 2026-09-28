# Fan-out: v4.0.0 Wave 7（翻開關）
base: 98052c6（派工前 commit；本行在派工後由整合者重蓋 —— 原寫 3f648bd，是派工前 commit 的 parent）    integration branch: integ/wave7.1（7.1 的並行 lane 共用一條）；7.2 每條序列 lane 各一條 integ/wave7-<lane>

<!-- test fixture (E178b AC19): a verbatim COPY of specs/fanout-wave7.md's title + base lines and its ## Lanes (7.1) header + e177a row. Never edit specs/fanout-*.md; edit this copy only if the fixture must change. -->

## Lanes（7.1，並行；假設 D1=A）
| lane | 票 | branch | worktree | 擁有 | 禁止 | 範圍切線 | 相依 |
|---|---|---|---|---|---|---|---|
| e177a | E177a | feat/e177a-fanout-manifest | ../agm-lanes/e177a | 新檔 `tools/fanout-manifest.ts`、新檔 `scripts/fanout.mjs`（薄殼，吃 `dist/tools/*.js`，同 `feature-rollup.mjs` 模式）、`dist/**`；qa：新檔 `test/e177a-*.test.mjs` 與 `test/fixtures/e177a/**`（建立已預先授權）；自己的 spec／證據／`.current/e177a/` | `bin/**`、`content/**`、goldens、budget、`package.json`、`docs/**`（含 `docs/lane-protocol.md`）、`.claude/commands/integrator.md`、既有的 `specs/fanout-*.md`（歷史產物；要當 fixture 就複製進 `test/fixtures/e177a/`）、e177b 的新檔 | 做：(1) manifest 格式 —— 以 `specs/fanout-wave7.md` 的 `## Lanes` 表為基準，寫出欄位定義；(2) `fanout render <manifest> <lane>` 由那一列 + 3b 模板輸出派工 prompt（共同規則仍指向 `docs/lane-protocol.md`，不複製進 prompt）；(3) `fanout check <manifest> <lane> [--base main]` 用 `git diff --name-only <base>...<branch>` 比對「擁有」glob，**逐一列出越界檔案、非零 exit**；(6) `## Decisions` 區的格式（每一筆：日期、誰裁決、內容、出處）。不做：lane 狀態／roll-up、信箱、`feature start` 接線、改整合者 SOP 或 lane-protocol（E178 會改成引用本工具） | 無 |
