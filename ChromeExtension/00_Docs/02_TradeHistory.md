# Project 1: TradeHistory (交易歷史紀錄解析與同步)

本專案的核心目標是自動化讀取、解析當前 Chrome 分頁中的華南證券月對帳單 HTML，並將交易資料清洗、結構化後，自動上傳/同步至線上的 Supabase 資料庫，保障歷史交易紀錄的完整性。

## 華南證券連結
* https://www.entrust.com.tw/entrust/index.do
* 登入 > 月對帳單 > 點選月份 > 跳出新視窗 > 按 Extension 的 "Fetch HN History" button.

---

## 🛠️ 事前準備與環境設定

### 1. Supabase 資料庫規格
在 Supabase 的 **SQL Editor** 中執行以下 SQL 語法，建立 `StockTradeHistory` 資料表與 RLS 安全性原則：

```sql
-- 建立對帳單交易歷史正式表 (StockTradeHistory)
create table "StockTradeHistory" (
  "id" text primary key,                     -- 唯一組合鍵 (格式: 成交日期_交易類別_證券名稱_股數_share_at_單價)
  "成交日期" text not null,
  "交割日期" text not null,
  "交易類別" text not null,
  "證券名稱" text not null,
  "股票代碼" text not null,
  "股數" bigint not null,
  "單價" numeric not null,
  "成交金額" bigint not null,
  "手續費" bigint not null,
  "代徵交易稅" bigint not null,
  "融資自備款_融券擔保品" bigint not null,
  "融資金額_融券保證金" bigint not null,
  "融券手續費" bigint not null,
  "融資利息_融券利息" bigint not null,
  "標借費" bigint not null,
  "利息代扣稅款" bigint not null,
  "客戶應收付金額" bigint not null,
  "created_at" timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 開啟 RLS 安全防護
alter table "StockTradeHistory" enable row level security;

-- 允許前端 API 進行批次寫入 (Insert / Upsert)
create policy "Allow public insert" 
on "StockTradeHistory" for insert 
to public 
with check (true);

-- 允許前端 API 進行讀取 (Select)
create policy "Allow public select" 
on "StockTradeHistory" for select 
to public 
using (true);
```

### 2. 環境變數設定 (.env)
在本專案路徑 `background/02_TradeHistory/.env` 下配置 Supabase 專案的連線設定（正式資料請保留在本地 `.env` 檔案中，請勿提交至版本控制或共享文件中）：
```env
DB_URL=postgresql://<db_user>:<db_password>@<db_host>:<db_port>/<db_name>
SUPABASE_URL=https://<your_project_ref>.supabase.co
SUPABASE_KEY=<your_supabase_anon_key>
```

---

## 📋 程式執行與資料解析步驟

當使用者在擴充功能中展開 `TradeHistory` 並點擊 **`抓取華南對帳單`**（按鈕 ID 為 `btn-fetch-HN-history`）時，系統將按照以下四個步驟在當前分頁執行腳本：

### Step 1: 網頁表格掃描與篩選
1. 從當前 Chrome Tab 網頁 DOM 中擷取所有的 `<table>` 元素。
2. **忽略前兩個表格**（Index 0 與 1），以避開目錄與無關的超連結導覽，防範誤判。

### Step 2: 交易明細表格定位與欄位重建
1. 從 Index 2 開始搜尋，尋找其 `innerText` 同時包含 **`"成交"`** 與 **`"日期"`** 的表格（如：`成交<br>日期`），此表格即為交易明細表。
2. 提取表格中所有的 `<tr>` 行。
3. 利用前兩行（`tr[0]` & `tr[1]`）重建表格的 **17 欄複合欄位標題 (Keys)**：
   * 透過動態網格計算 `rowspan`，對兩列標題進行對齊與合併（例如：將 `"融資自備款"` 與 `"融券擔保品"` 合併為 `"融資自備款_融券擔保品"`）。

### Step 3: 資料清洗、格式化與唯一鍵生成
1. 從表格的 `tr[2]` 開始往下讀取每筆交易細項。
2. **行過濾**：自動跳過標題列、無效的日期行，以及包含 `"本期合計"` 的總計欄。
3. **格式清洗與轉換**：
   * **日期轉換**：將民國格式如 `"115/04/28"` 的日期，換算並轉換為西元緊湊格式的字串 `"20260428"`。
   * **交易類別轉換**：若該欄位包含 `"買"` 則轉換為 `"Buy"`；否則轉換為 `"Sell"`。
   * **數值清洗**：剔除所有欄位中的千分位逗號（`,`）與空白字元。非股票代碼的數值欄位自動轉為 JavaScript `Number` 型別，並完整保留正負號。
4. **生成唯一識別碼 (Primary Key)**：
   * 為每列交易紀錄組裝唯一字串作為資料庫的主鍵：
     `{成交日期}_{交易類別}_{證券名稱}_{股數}_share_at_{單價}`

### Step 4: 批次同步至 Supabase 資料庫
1. 將所有格式化完成的交易物件，以 batch 陣列形式封裝。
2. 透過 `fetch()` 發送 HTTPS POST 請求至 Supabase REST API：
   `https://qrydooeraslchtqhyfme.supabase.co/rest/v1/StockTradeHistory`
3. **資料防重與冪等性 (Idempotency)**：
   * 請求頭加入 `'Prefer': 'resolution=merge-duplicates'`。若偵測到資料庫中已有相同組合鍵的交易紀錄，Supabase 將自動執行 **Upsert（安全合併更新）**，避免主鍵衝突。
4. 於 Tab 頁面彈出成功同步提示，並在 Chrome 的開發者工具 Console 中輸出完整結構化的 JSON 成果。


---

## 📌 優化與未來擴充防護 (Optimization & Extensibility)
1. **獨立證券商標示 (HN)**：已將目前華南證券專屬的抓取按鈕明確更名為「`抓取華南對帳單`」（ID: `btn-fetch-HN-history`），為日後擴充整合其他證券商（如：元大、富邦等）的對帳單抓取與解析功能預留清晰的命名空間。
2. **測試功能移除**：已全面移除過渡期的「`Test Supabase`」暫存按鈕，保持前端 UI 面板的簡潔與直覺。

