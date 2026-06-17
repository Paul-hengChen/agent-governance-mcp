# Feature Split Plan: mode-retrospective 架構調整   (text-only assessment — no design read)

來源：`research/mode-feature-process-retrospective.md` §四（合併 Mode 四階段根因與可前移改進）。
（前一份 split = `process-retrospective.md` Language 線，已全數 done/migrated，見 git 歷史。）

## Assessment
- verdict: multi-feature (3 units) — signals: 三個可分離關注點橫跨 server-parse / build-gate / SOP-text，分別改動不同檔案、彼此無相依、可獨立交付。
- 已落地（不重做）：§四#3 區域diff、#4 per-widget isolation、#6 artifact-first 已在 v3.26.0/v3.36.0 存在於 `skill-qa-visual.md` / 既有實務。

## Split Table
| order | feature id | scope | figma link | depends_on | key visual widgets | notes / 注意事項 | status |
|---|---|---|---|---|---|---|---|
| 0 | qa-visual-baseline-provenance | §四#1：把「baseline 必須是真 Figma 匯出 + 真 render 區域像素 diff」從 SOP 自律升級為 **server 可驗**。`visual_<id>.md` 的 `## Region Diff` 須帶 baseline 來源指紋（檔案 hash 或 Figma node id）+ B1 diff 工具數值；`tools/evidence-file.ts` 解析驗證，缺則擋 PASS。改 `evidence-file.ts` + `skill-qa-visual.md` + 測試，可能 schema bump。 | — (no-design) | none | — | 核心缺口；最高價值。指紋形式（hash vs node-id）由 PM/architect 定。 | done |
| 1 | paired-token-build-check | §四#5：build-gate lint 偵測成對 token（`w/h`、`min/max`）只定義一半（防 `osd-toggle-handle` 的 `height:0` 隱形繼承）。新 script + 接 build gate + 測試；§2 build gate 範疇。 | — (no-design) | none（與 F0 並行可） | — | 此 repo 是 MCP server（TS）無 tailwind；lint 目標（掃 token 定義檔 vs 泛用）需 PM 釐清。 | descoped |
| 2 | retro-sop-hardening | §四#2/#7/#8：design-auditor 第一步查核設計來源可信度（frame/variant/readonly 判定）；context-dependent 狀態別框成單選；lite 定位（跨多檔視覺保真不長期 lite 眼測）。純 `content/*.md` SOP 文字強化，無 server/build 變更。 | — (no-design) | none | — | 低風險純文字；可收尾或視需要略過。 | done |

## How to proceed
無設計稿（全 no-design），免 design-auditor。建議順序：**F0（核心 server gate）優先** → F1 可並行 → F2 收尾。逐單元 re-invoke `/teamwork`（或說「do F0」）。Coordinator 在每單元 PASS 後翻 `done`，resume 跳過 `done`。
