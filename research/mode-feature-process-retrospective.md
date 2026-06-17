# Research: 自動化開發流程回顧（整合版）— CDE OOBE「Mode」功能全線（選擇頁 → F0/F1 → F2–F6 → 視覺保真返修）

> Topic: 把 Mode 功能線**四個階段**的 `/teamwork` + `/teamwork-lite` 開發回顧整合為一份：(1) Mode 選擇頁（手風琴）、(2) F0 ModeConfig 共用骨架 + F1 ENERGY STAR、(3) F2–F6 per-mode 預設、(4) toggle / OK button / stepper 視覺保真返修。本篇取代並合併 `mode-process` / `modeconfig-energystar` / `mode-presets-f2-f6` / `mode-presets-visual-fix` 四份原始回顧。
> Scope: Mode 功能線（不含 Orientation / Language / React 遷移，各自另有回顧保留）。資料來源：各 dispatch 回傳的 `<usage>`（`subagent_tokens`，分母未知、低信心，僅作相對比例；精確成本應改讀 `agent-*.jsonl` 的 `usage.*`，憲法 v3.31.0，本回顧未做該層解析）。lite 階段為 main-loop 內聯，無 dispatch token。
> 狀態：**Mode 選擇頁、F0、F1、F2–F6 皆 PASS 並已併入 main（PR #75526 / #75529 等）；視覺保真返修在 `fix/mode-presets-visual-fidelity`（PR #75530），尚待獨立 qa-visual 重判 + qa-engineer 更新過時測試/baseline。**

---

## 一、四階段總覽

| 階段 | 內容 | 可量測 token | 返工 | 主題 / 根因 |
|---|---|---:|---|---|
| **P1 Mode 選擇頁** | 手風琴模式選擇（A.3.3） | ~894K | 1 完整重開 + 1 假警報 | **baseline 取材錯誤**（per-card 裁切）污染排版+文案；閘門盲；過時本機建置假警報 |
| **P2 F0 + F1** | OSD 設定共用骨架 + ENERGY STAR 唯讀預設 | ~775K | **0** | **設計來源錯誤在動工前被攔下**（PRD 為真值裁決）；兩次中斷零重工自癒 |
| **P3 F2–F6** | 五個 per-mode 預設（讀寫雙態） | ~642K | **0**（鏈內） | 鏈乾淨但**「PASS ≠ 畫面對」**：toggle 旋鈕 `height:0` 從 F0 隱形繼承；建立首個測試套件 |
| **P4 視覺返修** | toggle / OK button / stepper 對齊真 Figma | ~395K + lite | 多輪 | **qa-visual 發空 PASS**（無真圖比對）；眼測迴圈；抓真 Figma 圖 + render 才收斂 |

**合計可量測 `subagent_tokens` ≈ 2.7M**（跨四階段、約 40+ 個 dispatch）。

---

## 二、問題明確陳述（貫穿四階段的主線）

1. **【視覺驗收閘門盲 —— 全線最系統性的慢性病】**
   - P1：design-auditor 抓 **per-card component-set 裁切圖**（非全幅合成 frame），逐卡裁切對齊把分佈資訊丟掉 → `justify-between` 把六張卡撐爆的崩壞照樣 PASS；且 variant 文案（"Signage (USB or CMS)"）≠ 合成頁（"Signage (CMS)"），錯字一路過。
   - P1：暗畫面的**全幅百分比門檻無鑑別力**（per-card 3.5% / 全幅 15% 都能讓真缺陷過關，缺陷區只佔少數像素）。
   - P3：toggle 旋鈕 `osd-toggle-handle` 漏在 tailwind height scale → `height:0` 不可見，**DOM 斷言（class 在不在）天生照不到**，從 F0 跨五個 mode 繼承到 F6 都沒被攔。
   - P4：/teamwork 的 qa-visual 發了 PASS，但**只比對 token 數值與 DOM computed-style，從未拿真 Figma 圖做像素比對**（自揭 `AD-MPVF-4`）。值抽錯/版面錯照樣綠燈。
   - **四階段共通**：自動視覺關卡沒有一關真正攔下視覺缺陷；**人類肉眼始終是唯一有效的 gate**。

2. **【設計契約「來源正確性」決定一切 —— 正反兩面都驗證了】**
   - P1（反例）：取材源頭錯（variant 而非全幅 node）→ 排版閘門 + 文案雙雙被污染 → 假 PASS → 操作者撤回 → 整輪重開。
   - P2（正例）：design-auditor 當場驗出 split table 指定的 Figma node 其實是「Mode Overview 唯讀頁、且是別的 mode」→ coordinator STOP 用 `AskUserQuestion` → 操作者裁決「PRD 矩陣為真值、非 Figma；唯讀/可編輯雙態」→ **污染擴散前釘死 → 零返工**。
   - P4：toggle ON 被我在 `AskUserQuestion` 框成「單選 canonical」，但 Figma 其實**依列是否 focused 用兩種 ON**（選中 #86A1F4+白旋鈕 / 非選中 白底+深旋鈕）→ 把錯答案做進規格。
   - **結論**：契約來源在動工前釘死且凍結 → 一次收斂；任何源頭錯誤都會以「假 PASS → 撤回 → 重開」回來。

3. **【基建中斷的成本，取決於「產出有沒有先落地」】**
   - P1/P2 共四次撞 Opus session limit + 一次 529 Overloaded。
   - P2 的兩次中斷（sr-engineer session-limit mid-implementation、code-reviewer 529 mid-write）**都因角色把實質產出（程式編輯 / APPROVED 判決檔）先落地、最後才寫 state** → 補派只需「驗證既有 + 補寫 state」，近零重工。對照早期 session-limit 需整段重做。

4. **【lite 模式的定位 —— 用對省一條鏈，用錯陷入眼測迴圈】**
   - P1 正用：最後「差很多」假警報，lite 用一次 build + live DOM 量測（~5 個 bash）證實是**過時 dev-server CSS**（改 `tailwind.config.ts` 沒重啟），非程式缺陷 → 省下一整條鏈。
   - P4 誤用：跨多檔的視覺保真本是 /teamwork + qa-visual 工作，卻在 lite 來回約四輪眼測逼近，**每輪引入新副作用**（卡片左滑 → 抽屜超框；scrim 遮擋 → 露字）。最後收斂靠「人類給精確機制 + 抓真圖 render 驗證」，不是 lite 流程本身有效。憲法 §5 反迴圈正是要擋這種形態。

**一句話：Mode 全線的執行品質一直很穩（每階段 build 乾淨、邏輯正確），真正反覆燒錢的是「視覺驗收層」—— 沒有任何一關把『真實 render 的畫面』和『真正的 Figma 圖』擺在一起像素比對。P2 的零返工證明：只要動工前把正確來源釘死、用結構斷言守門，鏈就一次收斂。**

---

## 三、各階段關鍵事實

### P1 — Mode 選擇頁（~894K，13 dispatch）
- Phase A 首建「一次過 PASS」（152 測試綠、`qa_round=0`）是**假性勝利**：閘門盲，PASS≠正確。
- Phase B 以人工提供的**全幅 node `4091:46836`** 重審，同時釘死排版（`column / gap 8 / 無 justify-content`）與六條正確文案 → pm→sr→reviewer→qa 一輪收斂。
- 二次 PASS 後「還是差很多」= **過時本機建置假警報**（lite live DOM 量測排除：gap=8/py=12/default 55px/focused 159px 皆與設計一致）。
- 教科書範例：reviewer FAIL 其實指向 QA-owned 的過時測試斷言，sr **不回退、不動測試、轉交 QA**（28,855 token / 44s）——流程紀律正確。

### P2 — F0 + F1（~775K，11 dispatch，零返工）
- **最大價值點**：design-auditor 在 90,626 token 一輪驗出 Figma node 錯誤並 STOP；coordinator 用一次 `AskUserQuestion` 取得人工裁決（PRD 為真值、唯讀模式、忽略 Power Authority 列）。
- F1 的 PASS 用 **79 條 DOM 結構斷言**（非像素全幅）守門 → **真·一次過**。
- 兩次中斷（session-limit + 529）皆「artifact-first / state-last」零重工自癒。
- 唯讀渲染 `readOnly`（`committedMode !== 'manual-setup'`）成為 F2–F6 共用契約；已寫入記憶 `modes-editability-and-preset-source`。

### P3 — F2–F6 per-mode 預設（~642K，14 dispatch，鏈內零返工）
- B1+B2 批次（F2/F3/F4 + 共用 choice-set 修正）攤平固定成本；F5 signage、F6 manual-setup（唯一可編輯，含 architect 設計編輯保存契約：`commitMode` 僅在 mode 轉換時 re-seed）。
- 建立**首個測試套件**（vitest，30→36→73 測）。
- **隱形繼承缺陷**：toggle 旋鈕 `height:0`（tailwind height scale 漏 token）——靠**讀編譯後 CSS** 抓到；DOM 斷言看不到。`test:visual`（Playwright）從 F0 到 F6 一次都沒跑。

### P4 — 視覺保真返修（~395K teamwork + 約四輪 lite）
- /teamwork 鏈（design-auditor→pm→sr→code-review→qa-visual）零返工但**qa-visual 發空 PASS**（無 Figma PNG baseline，只比 token/DOM）。
- 真正逐項收斂靠：`mcp__figma__download_figma_images` 抓 node 4091-46913 / 543-43635 / 483-83992 → `vite preview` + Playwright render `/?step=mode-config(&overlay=drawer-bootsource)` → `Read` 截圖並排比對。
- 各問題最終正解：toggle 旋鈕補 height token（12px）；ON 兩變體加 `focused` prop；OFF 填 #333+白描邊+白旋鈕；OK button `self-stretch` 撐滿 48px（Figma `vertical: fill`）+180px；stepper 完成態點/線填白（`isActive || isCompleted` + `.step.is-completed::after`）；side panel 開啟以 **scrim 由右至左加長至 x:64** 蓋住 label 欄、dots(x<56) 留白、抽屜回框內。
- 殘留：scrim 0.64 半透明為「壓暗」非「完全消失」，待裁決；MPVF Playwright 斷言與 Orientation/Mode stepper baseline 因行為更正而過時，待 qa-engineer。

---

## 四、根因與可前移改進（合併四階段）

1. **視覺關卡必須做「真 Figma 圖 × 真 render」的像素比對，否則不准發 PASS。** token 斷言、DOM 斷言、看截圖、全幅百分比門檻全都被驗證為會放行錯誤。qa-visual SOP 應強制：先 `download_figma_images` 落地 baseline → render 受測畫面 → 區域像素 diff + 結構斷言；拿不到匯出圖 → `Blocked`，不得以 token 斷言代替 PASS（§3.2 builder≠judge）。
2. **design-auditor 第一步先查核「設計來源可信度」**：判定 node 是「整頁合成 frame / component variant / 唯讀 review 頁」，與功能意圖不符就 STOP 回報，不硬抄。P2 正是此行為救了一整輪、P1 正是缺此而重開。
3. **視覺 gate 從「全幅百分比」改「關鍵區域 + 結構斷言」**：暗畫面全幅平均無鑑別力；P1 的 `justifyContent≠space-between`、P2 的 79 條 DOM 斷言證實有效。
4. **純視覺元件需 component-level 像素 baseline + computed-style 斷言並用**：單一種都漏（`height:0` 靠讀 CSS、`py-0` 靠讀 Figma layout、completed 灰靠肉眼）。
5. **成對 token（w/h、min/max…）加一條 build 檢查**：防 `osd-toggle-handle` 這類只定義一半而隱形繼承。
6. **保留「artifact-first / state-last」角色紀律**：使 session-limit / 529 / mid-write 中斷都能近零成本自癒。
7. **context-dependent 狀態別框成單選題**：toggle ON 兩變體被壓成單選才做錯；裁決前先確認該屬性是否依情境有多值。
8. **lite 定位**：診斷/環境排除（如過時建置）用 lite 省一條鏈；跨多檔視覺保真不該長期 lite 眼測——會陷入 §5 反迴圈。

---

## 五、跨功能對照（含非 Mode 線，各自另存）

| | Language 首建 | Language 遷移 | Orientation | **Mode 全線（本篇）** |
|---|---|---|---|---|
| 返工 | 4 visual | 0 | 2 | P1 重開 / P2 0 / P3 0 / P4 多輪 |
| 一次過？ | ✗ | ✓ | ✗ | P2 真·一次過；P1/P4 假/多輪 |
| 主題 | 缺陷層遮蔽+框太窄 | **契約凍結→零返工** | 契約缺口+閘門盲 | 取材源頭 + 視覺驗收閘門盲（反覆） |

**跨所有回顧的單一最強結論（Language 遷移 + Mode P2 正面驗證，P1/P4 反面再證）：動工前把「正確且凍結的驗收契約」釘死 —— 對視覺功能就是「真 Figma 全幅/區域 baseline + 結構斷言 + 真 render 像素比對」—— 鏈就一次收斂；任何來源錯誤或閘門盲，成本都會以『假 PASS → 操作者撤回 → 整輪重開』的形式回來。**
