# Re: RAG 實作 — 修正建議

> @researcher · 2026-05-19
> 補充我先前那份分析報告,外加兩個當時沒寫進去的點。

---

## TL;DR

1. **改注入點**：`buildPromptForRole`,不是 `tw_get_state`
2. **改 embedding**：本地 `@xenova/transformers`,不打 Voyage API
3. **改儲存**：SQLite 新增一張表,不另開 JSON
4. **改 chunking**：你那行 `split` 有 bug,會漏資料
5. **加 invalidation key**(我先前報告漏寫的)
6. **indexing / querying 拆開**(我先前 Open Question 1 的拍板答案)

這六點對齊就可以開工;BM25 hybrid 放 v1.5(不是 v2,理由在下面)。

---

## 1. 注入點:`buildPromptForRole`,不要 `tw_get_state`

你的方案:

```ts
// tw_get_state 尾端
state.spec_context = await querySpec(activeTask);
```

三個問題(先前報告 Issue 3 已列):

- `HandoffState` 是 typed interface(`tools/handoff.ts:14`),多塞一個欄位,所有 downstream 的型別都要動。
- `tw_get_state` 在實際使用中**會被 LLM 反覆呼叫**(每次想 double-check 狀態都打一次),每次都跑 embedding query 是純浪費。
- state-level 注入會被所有 tool 看到,但 spec context 只有 role prompt 用得到。

改注入到 `prompts/build.ts:buildPromptForRole()`(line 38 附近):

- 那裡本來就在組 `constitution + skill + state`,多一塊 `specContext` 是純加法。
- 一個 role 啟動只跑一次,符合 query 的成本曲線。
- 可以做 role-aware(PM 拿廣的、sr-engineer 拿窄的)。
- `buildPromptForRole` 改成 `async` 即可。

---

## 2. Embedding:本地 `@xenova/transformers`,不要 Voyage API

你打 `api.voyageai.com`。問題:

- 多一把 API key,破壞 zero-config 定位。
- 每次 query 多一個 network round-trip。
- 離線/airgap 環境直接壞掉。

我驗證過的本地方案:`@xenova/transformers` + `all-MiniLM-L6-v2`(23 MB, 384-dim, ONNX)。Node.js 直接跑,模型 cache 在 `~/.cache/`,第一次跑會下載,之後是本地。

**Voyage 不要砍掉,留成 opt-in**:`.current/.config.json` 加一個 `embeddingModel` 欄位,預設 `xenova/all-MiniLM-L6-v2`,team 願意付 API key 換更高品質就改 `voyage-3-lite`。MTEB 分數差 ~0.05,對 PRD 這種短文件影響沒想像中大。

---

## 3. 儲存:SQLite 一張新表,不要 JSON 檔

你寫 `.current/prd-index.json`。我先前報告主要論點是 size(300 KB × workspace 數),但補一個**更強的理由**:

- JSON 整檔寫入不是 atomic,crash 在中途會壞檔。SQLite 有 WAL,免費拿到。
- 增量更新:PRD 改一個 section,JSON 要整檔重寫;SQLite 只 update 變動的 rows。
- `tools/storage-sqlite.ts` 已經在了,多一張表是加法;多一個檔案格式則是新增一條路徑要維護。

Schema:

```sql
CREATE TABLE IF NOT EXISTS prd_chunks (
  workspace_path TEXT NOT NULL,
  chunk_id       TEXT NOT NULL,
  section        TEXT NOT NULL,
  text           TEXT NOT NULL,
  embedding      TEXT NOT NULL,  -- JSON float array
  prd_mtime      INTEGER NOT NULL,
  PRIMARY KEY (workspace_path, chunk_id)
);
```

> ⚠️ 我先前 Open Question 4 問「file-mode 要不要 fallback 到 JSON」— **拍板:不要**。Pick one,SQLite-mode 才支援 RAG,file-mode 不支援(或最多 in-memory,session 結束就丟)。維護 dual-path 長期會痛,PRD RAG 不是核心功能,不值得這個複雜度。

---

## 4. Chunking:你那行 `split` 有 bug

```ts
text.split(/^#{1,3} /m);
```

兩個問題:

- `split()` 會吃掉 delimiter。第二段開始 section 標題全部消失,retrieval quality 直接掉一截。
- `.slice(0, 1500)` 直接截斷。長 section 後半段永遠不會被檢索到 — 這不是「不夠好」,是會漏資料。

修法(比我先前報告寫的「完整 recursive splitter」簡單):

1. 用 `matchAll` 抓 heading + content,**保留** heading 文字。
2. 對超過 ~512 token 的 section 再做二次切分(按段落、再按句子)。
3. Overlap 10%,每個 child chunk 把 parent section 的 heading 黏在前面當前綴。

不需要一開始就上完整的 LangChain 風格 recursive splitter。先把 bug 修了,調參等實際 retrieval quality 出來再說。

---

## 5. ⭐ 先前報告漏寫:Invalidation key 不能只看 mtime

我先前報告只提了 `mtime`,但這樣會踩坑:

> 假設 user 沒改 PRD,但我們升級了 chunker 邏輯(例如把 overlap 從 10% 改 15%)或換了 embedding model,**舊的 embeddings 還在 SQLite 裡,mtime 一樣**,永遠不會重 index。

要存的 invalidation key 是三個欄位的 tuple:

```ts
{
  prd_mtime: number,
  chunker_version: string,    // 一個 const,邏輯改了就 bump
  embedding_model: string,    // "xenova/all-MiniLM-L6-v2"
}
```

任一變動就觸發 reindex。一行 code 的事,但忘了會 debug 到天黑。

---

## 6. ⭐ Open Question 1 拍板:indexing 跟 querying 拆開

我先前 Open Question 1 問「2 秒冷啟動可不可接受」。**拍板:不要放在 SessionStart hook。**

- **Indexing**:獨立的 `tw_index_prd` CLI command,user 主動跑,或 SessionStart 偵測到 PRD mtime / version 變動再觸發。2 秒冷啟動可接受,因為不常跑。
- **Querying**:每次 role 啟動會跑,這條路徑要量。

**Querying 的 latency 我先前報告沒寫,是更需要先量測的點**:

- 模型載入(如果是 cold process)+ embed query string + cosine scan
- 200 chunks × 384 dim 的全表掃描在 JS 是純 CPU,估計幾十 ms 不是瓶頸
- 真正的瓶頸是 ONNX runtime 的 cold start

PoC 第一步:寫個 10 行的 script 量一次 end-to-end query latency(warm process + cold process 各量)。如果 warm 下 <100ms、cold 下 <2s,那 `buildPromptForRole` 變 async 沒問題。如果 cold start 太久,要嘛改 `fastembed-js`(quantized,cold start 快),要嘛把模型 process 常駐。

---

## 其他幾個值得拍板的小決定

### Query 用什麼字串?

我先前 recommendation 寫「query = active task description」。但 task description 可能很短("實作 OAuth flow"),語義訊號弱。

**Baseline 先用 task description,但留一個 hook** 之後可以拼成 `task description + role skill 摘要`。先量 baseline retrieval quality 再決定要不要動。

### BM25 hybrid 的優先級

我先前 Alternative B 否決純 BM25 的理由 valid(PRD 會 paraphrase),但補一點:**PRD 裡有大量專有名詞**(feature 名、API 名、人名),這些 BM25 比 embedding 強。

所以 hybrid 我重新評估是 **v1.5 不是 v2** — 純語義在「找一下那個叫 XXX 的 feature」這種 query 上會表現很差,而這是 PRD RAG 的常見情境。實作上不貴(`minisearch` 5 行 + RRF 融合),先把 v1 做完,跑一週看實際 query 分佈再決定。

### Open Question 3 拍板:config 可覆寫 embedding model

**Yes**,已經在第 2 點講了。`.current/.config.json` 加 `embeddingModel`,預設本地,opt-in Voyage。

---

## 修正後的 pipeline

```
PRD 變動偵測(SessionStart hook 比對 mtime + chunker_version + model_name)
  → 若需 reindex:呼叫 tw_index_prd
      ├─ chunk PRD:regex match 保留 heading + 長 section 二次切分 + 10% overlap
      ├─ embed via @xenova/transformers(或 config 指定的 model)
      └─ upsert prd_chunks 表(含 invalidation key 三欄位)

Role 啟動
  → buildPromptForRole(role, state)
      ├─ 既有:constitution + skill + state
      └─ 新增:若 prd_chunks 有此 workspace 的 rows
              → embed(activeTask)
              → cosine top-5
              → 拼成 specContext block 加到 prompt 尾端
```

---

## 開工前要先對齊的清單

- [ ] 注入點改 `buildPromptForRole`(不是 `tw_get_state`)
- [ ] Embedding 用 `@xenova/transformers`,Voyage 留 opt-in
- [ ] 新增 `prd_chunks` 表到既有 SQLite,**不**做 file-mode fallback
- [ ] Chunking 修 bug:保留 heading + 長 section 二次切分 + overlap
- [ ] Invalidation key 三欄位:mtime + chunker_version + model_name
- [ ] `tw_index_prd` CLI tool 獨立,indexing 不放 SessionStart hot path
- [ ] PoC 第一步:量 query end-to-end latency(warm + cold)
- [ ] BM25 hybrid 列 v1.5 backlog

對齊完就可以走 `/architect` 出設計文件了。設計文件主要要釐清的是:`buildPromptForRole` 改 async 之後對 call sites 的影響、`tw_index_prd` 的 CLI 介面、以及 invalidation key 的具體 schema。

要直接路由 `/architect` 嗎?

— @researcher
