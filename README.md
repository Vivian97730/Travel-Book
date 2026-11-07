# Travel Book

本目錄同時保留可供比對的靜態 prototype，以及依照專案[頁面與功能規劃](../../docs/頁面功能.md)逐頁開發的正式 `React + TypeScript + Vite` 程式。

## 正式程式進度

首頁是第一個正式功能切片，目前包含：

- 以台北時區起飛時間計算的即時倒數。
- 進入首頁時單次請求裝置定位，並透過 Open-Meteo 取得目前天氣。
- 定位顯示已離開台灣時隱藏出發倒數；拒絕定位、天氣失敗與離線時保留其他首頁內容。
- 去回程航班、杜拜轉機、總旅行時間與跨日標示。
- 需先進入編輯模式的小知識新增、修改、移除、取消與儲存流程。
- 小知識暫存於目前瀏覽器，資料介面已獨立；串接 Supabase 後可替換為全家共享版本。

正式程式尚未取代 GitHub Pages 上的 prototype；其餘四頁會依後續功能切片逐步移植。

## 正式系統基礎

階段 0 已建立正式系統的共同基礎：

- `packages/contracts`：前後端共用 DTO、穩定錯誤代碼、執行期驗證與共享寫入 metadata。
- Home Repository 契約測試：Browser 與 Fake Adapter 必須遵守相同的資料隔離、正規化及版本衝突行為。
- `supabase/functions/travel-book-api`：Edge Function 最小健康檢查入口。
- `supabase/migrations`、`supabase/tests`、`supabase/seed.sql`：可重現的 Database 基礎與測試骨架。
- `tests/visual/prototype-baseline.json`：核准 Prototype 與三種 viewport 截圖的 SHA-256 基準。

本機可使用下列命令確認 Prototype 基準未被意外修改：

```bash
pnpm verify:prototype
```

## 階段 1 私人存取

正式前端以 `#/access/<token>` 接收一次性的私人連結片段，保存後立即將網址清理為 `#/itinerary`。後續請求透過 `Authorization: Bearer <token>` 呼叫 `travel-book-api`；前端不直接連接 Database，也不持有 Supabase Secret Key。

本機串接前，複製 `.env.example` 為不提交的 `.env.local`，並將 `VITE_API_BASE_URL` 設為完整 Edge Function 網址；地圖圖磚網址與署名可用 `VITE_MAP_TILE_*` 選填設定覆寫。沒有有效私人連結、無法連線或 Edge Function 尚未設定時，正式前端不會載入共享旅程內容。

## 頁面

- 首頁：以歐洲雪山、積雪小鎮與尖屋頂建築構成冬季主視覺，文字靠下避免遮擋插畫，並包含旅程封面、倒數、天氣狀態、航班與小知識。
- 行程：預設頁面，包含五日日期列、OpenStreetMap 串接預留區，以及不顯示時間與類型文字標籤、具有左側連接線的行程卡片清單；箭頭開啟唯讀檢視與名稱搜尋導航，城市鉛筆則進入新增、修改、刪除及拖曳排序模式。
- 住宿：依日期排列住宿資訊與導航入口，提供貼上名稱後自動搜尋 Google Places 照片的狀態原型，以及新增、編輯與視窗內刪除。
- 記帳：三幣別同列總覽、日期分群展開／收合、支出新增、修改與刪除。
- 清單：必備、行李、待辦三類清單與完成進度；項目只顯示名稱與完成狀態。

主要卡片使用 `32 px` 大圓角，內層資訊卡使用 `24 px` 圓角；整體採冰雪色盤與雪景背景，卡片本身不顯示右上角星芒裝飾。

## 正式程式本機開發

需要 Node.js 20.19 以上版本與 pnpm。安裝後執行：

```bash
pnpm install
pnpm dev
```

檢查與建置：

```bash
pnpm typecheck
pnpm test
pnpm build
```

正式建置會輸出至 `build/`，不會覆蓋 `dist/` 內的 prototype。

## Prototype 本機預覽

在本目錄執行：

```bash
python3 -m http.server 4173 --directory dist
```

再開啟 `http://localhost:4173`。

Prototype 的所有修改只存在記憶體，重新整理後會還原。

## 手機開啟與加入主畫面

正式網址部署至 GitHub Pages 後，可直接用手機瀏覽器開啟：

- iPhone／iPad：使用 Safari 開啟，點選「分享」→「加入主畫面」。
- Android：使用 Chrome 開啟，點選選單→「加到主畫面」或「安裝應用程式」。

主畫面捷徑會使用 `dist/icons/apple-touch-icon.png` 或 Web App Manifest 內的冬季村莊插圖。此儲存庫是可公開瀏覽的前端原型，請勿加入 API 金鑰、私人憑證或真實敏感旅遊資料。

## GitHub 開發與上傳規則

所有變更必須遵守 [AGENTS.md](AGENTS.md) 與 [CONTRIBUTING.md](CONTRIBUTING.md)：

1. 從 `master` 建立 `feature/`、`fix/` 或 `refactor/` 分支。
2. 使用 Conventional Commits。
3. 推送分支後建立 Pull Request，不得直接推送或合併至 `master`。
4. `Validate` 檢查提供參考，但不阻擋合併。
5. 合併至 `master` 後，由 `Deploy GitHub Pages` 自動發佈。

