# Research：以「機械化過濾」決定 Figma Baseline 的方法

> 撰寫情境：ticket [104444](https://viewsonic-ssi.visualstudio.com/Corporate%20OS/_workitems/edit/104444)（Step 4 Network Settings）baseline 抓取。
> 目的：把方法固化成可移植的流程，後續導入 **agent-governance-mcp** 架構（design-auditor / qa-visual SOP）。
> 角色：coordinator-lite（Q&A + 文件，無 state 寫入）。

---

## 1. 問題（Why this exists）

需求單通常只附 **一個 Figma 連結**（本例 `node-id=72-3455`）。但該 node 展開後**不是單一畫面，而是整個 OOBE 畫板**（所有步驟、含箭頭與標註框）。

若直接叫 design-auditor「打開連結、挑出 Network 畫面當 baseline」，會在三處分岔、不可重現：

| 失誤模式 | 實例（本案） |
|---------|------------|
| **漏抓**：畫面散落在輸出遠處 | slide 319/320/321（`4888:52841/53203/53361`）離主區塊約 8000 行、夾在其他步驟中間，目視掃板會抓 18 張就收手 |
| **誤收**：look-alike 含相同面板 | slide 279/293–299（`3217/3557/3554:*`）屬 Summary/其他步驟，但**也含 `NetworkOptions` 面板**，憑「有沒有網路元件」會多抓 |
| **混入雜訊**：把非畫面當畫面 | flow board 的箭頭 CONNECTOR、標註 TEXT（如 `Default Option: Ethernet off`）被當成 screen |

核心病灶：**判準在模型腦中、不可見、不可究責、每次不同**。

---

## 2. 方法（Mechanical Filtering）

把「需求」翻譯成**對 Figma 結構資料的確定性規則**，用 grep/awk 跑，而非模型目視。

### 步驟

1. **取結構資料**
   `mcp__figma__get_figma_data(fileKey, nodeId)` → 輸出為 YAML 結構（每 node 有 `id` / `type` / `name` / children）。資料過大時自動落地成檔，改用 grep/awk 處理。

2. **過濾 screen frame**
   保留 `type=FRAME` ∧ `name` 符合畫面命名規則（本案 `Slide 16:9 - *`）。→ 濾掉 CONNECTOR、標註 TEXT、子元件。

3. **判定「屬於本功能」的語意錨點**
   對每個 slide，檢查其子樹（到下一個 slide 之前）是否出現特定面板節點（本案 `name: ' NetworkOptions'`）。命中才算目標畫面。

4. **依 `id` 前綴分群，剔除跨步驟誤收**
   同一功能的畫面通常由同一作者區塊產出、id 前綴一致（本案 `4888:*` = Step 4 本體）。其他前綴（`3217/3557/3554:*`）= 其他步驟嵌入同面板 → 排除。

### 實際指令（節錄）

過濾「含 NetworkOptions 的 Slide frame」：

```bash
awk '
/name: Slide 16:9/ {
  if (curname!="") print curline": "curid"  ->  "curname"   ["(hasnet?"YES":"-")"]"
  curname=$0; sub(/^ *name: /,"",curname); curid=previd; curline=NR; hasnet=0
}
/name: '"'"' NetworkOptions'"'"'/ { hasnet=1 }
/- id: / { previd=$0; sub(/^ *- id: /,"",previd) }
END { if (curname!="") print curline": "curid"  ->  "curname"   ["(hasnet?"YES":"-")"]" }
' "$FIGMA_DUMP" | grep 'YES'
```

產出：29 張含網路面板的 slide → 依 id 前綴分成 A 群 21 張（Step 4 本體）+ B 群 8 張（排除）。

---

## 3. 產物：凍結成 Manifest

判準的產出寫進 `design/network-step4-baseline-manifest.md`：列出 21 個 node-id + 過濾條件 + 排除理由 + 人工確認清單。

**規則：下游（design-auditor / qa-visual）照抄 manifest，禁止從 URL 重推。**

效果 = **可重現 (reproducible)**：規則寫死，誰跑、跑幾次都同一份 21 張。

---

## 4. 對 agent-governance-mcp 架構的建議（移植重點）

> 以下為導入 governance 時可落地的修改點，供後續設計參考。

### 4.1 新增 SOP 條款（design-auditor / qa-visual）

- **禁止「目視挑圖」當 baseline 來源**。凡需求單只給單一 Figma 連結，design-auditor MUST：
  1. 先 dump node 結構；
  2. 以可寫出的過濾規則（frame 類型 + 命名 pattern + 語意錨點面板 + id 前綴分群）選出畫面；
  3. 把 node-id 清單 + 過濾規則凍結成 `design/<feature>-baseline-manifest.md`；
  4. qa-visual 照 manifest 抄，不得重推。

### 4.2 工具層（可選，較完整）

- 在 MCP server 增一個 `tw_extract_figma_baseline` 工具：輸入 `fileKey/nodeId` + 過濾規則（frame pattern、anchor 子節點名、id 前綴白名單），輸出凍結 manifest。把「機械化過濾」從 ad-hoc awk 升級成第一級能力，避免每案重寫 script。

### 4.3 與既有原則的銜接

- 對齊 Constitution §7「External-reference policy」：外部 Figma 視為**未完成直到被索引**。本方法即「索引」的具體手段——把一個模糊連結拆成可驗證的 node 清單。
- 對齊既有教訓：**值衝突時 PRD > Figma**（見 memory `modes-editability-and-preset-source`）；baseline 只負責「視覺對齊對象」，數值仍以 PRD 為準。
- 對齊 §5 anti-loop：baseline 一次凍結，避免 visual 迭代時反覆重抓導致 eyeball loop。

---

## 5. 一句話總結

> 把「幫我挑出 Network 畫面」這種**請模型判斷**的任務，改寫成**對結構資料的可驗證過濾規則**並凍結成 manifest——這是讓 design baseline 可重現、可究責、可移交的關鍵。
