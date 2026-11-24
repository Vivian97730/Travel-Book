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

正式程式包含首頁、行程、住宿、記帳與清單五頁。GitHub Pages 切換依下方發布與回復清單執行。

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

啟動時依序使用分享連結、`localStorage`、同源 Cookie 取得權杖。驗證成功後寫入 `Secure; SameSite=Strict`、host-only、路徑限於 `/Travel-Book/` 的 Cookie，有效期 180 天；每次啟動或恢復連線驗證成功後續期。Cookie 由 JavaScript 讀寫，無法使用 `HttpOnly`，只作為安裝還原來源；API 仍逐次驗證 Bearer Token。後端明確拒絕時清除 Cookie、本機權杖及對應快照；暫時服務錯誤保留憑證。儲存遭拒絕時仍可使用此次記憶體中的線上憑證，但無法保證下次恢復。

iOS／iPadOS 17.2 以上加入主畫面時會複製 Cookie，不複製 `localStorage` 或 IndexedDB，之後兩個環境不持續同步。因此須在 Safari 成功驗證後才加入主畫面；既有安裝需重新加入或另外啟用。主畫面首次開啟須連網完成驗證與快取，之後依既有快照提供離線唯讀。瀏覽器或使用者可能提前清除憑證，180 天不是授權免驗證期間，也不使 `localStorage` 自動到期。實際 iPhone 安裝、重啟及離線驗收仍待完成。

正式前端以 `#/access/<token>` 接收私人連結片段，擷取後立即將網址清理為 `#/itinerary`，後端驗證成功才持久保存。後續請求透過 `Authorization: Bearer <token>` 呼叫 `travel-book-api`；前端不直接連接 Database，也不持有 Supabase Secret Key。

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

### 正式 PWA 更新與版本回復

- 本機驗證使用 `pnpm build` 和 `pnpm exec vite preview`。以 Chrome 網址列的安裝功能安裝，先連線開啟旅程並等候資料載入，再離線重開。
- 新版 Service Worker 完成預先快取後會等待。儲存編輯內容並關閉所有 Travel Book 分頁與獨立視窗，再重新開啟即可使用新版。
- 回復時，將同一個發布路徑上的靜態檔案整批替換為上一版完整的 `build/`，包含原本的 Worker、Manifest 與資產。裝置連線開啟以取得 Worker，關閉所有 Travel Book 分頁與獨立視窗後重開。回復適用於已含正式 Service Worker 的建置，會保留 IndexedDB 與裝置清單。

## GitHub Pages 發布與回復清單

### 切換前

- [ ] 確認 Pages 來源為 GitHub Actions，並將 `github-pages` 環境限定由 `master` 部署。記錄現行成功部署的 Commit 及其 Prototype 版本。
- [ ] 在 repository 或 `github-pages` 環境變數設定 `VITE_API_BASE_URL`，值為公開的 HTTPS Edge Function 網址。確認 API 健康檢查回傳 200、未授權請求回傳 401，以及正式 Pages 來源的 CORS 預檢成功。
- [ ] 確認 PR 的 Validate 通過並審核發布工作流程。在隔離的靜態託管環境使用相同的 `/Travel-Book/` 路徑演練完整正式產物的發布與第一次切換回 Prototype。使用合成旅程，並分別驗證全新瀏覽器與先前安裝過 PWA 的瀏覽器。
- [ ] 經審核後由維護者合併 PR。確認 `Deploy GitHub Pages` 成功，保留部署 Commit、執行紀錄與完整產物供回復。

### 正式網址驗證

- [ ] 確認 HTTPS、首頁與雜湊路由、Manifest、Service Worker、圖示及同版靜態資產可用。驗證舊 Prototype 裝置在連線開啟並關閉所有分頁與獨立視窗後可使用正式版。
- [ ] 用合成旅程確認私人連結開啟後會清除網址中的權杖，五頁均可正常載入。試寫共享資料並重載，確認離線共用資料唯讀及裝置清單可用。驗收後清除合成旅程。
- [ ] 從正式網址確認 CSP、`strict-origin` Referrer Policy 與 API CORS，檢查部署後 API Log 是否出現原始請求路徑或權杖。驗收紀錄只留結果。

### 回復

- 五頁載入或寫入失敗、出現敏感資料洩漏、或新版無法正常更新時，停止繼續發布並以 PR 回復。已有可用正式版時，發布上一版的完整 `build/`，然後依上節重驗。
- 首次切換回 Prototype 時，以 PR 恢復原發布流程，將切換前 Commit 的完整 `dist/` 複製到獨立發布目錄。僅在該目錄加入下列 `app-shell-worker.js`，保留原 `service-worker.js`。將工作流程上傳路徑指向這份暫存產物。瀏覽器更新原正式 Worker 後會重新走網路載入，Prototype 隨後會註冊自己的 Worker。

  ```js
  self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
  self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
  ```

- 維護者合併回復 PR 後，確認同一網址可取得回復產物。已開啟正式版的裝置須連線、關閉分頁及獨立視窗後重開，必要時重新整理以完成 Worker 更新。確認 Prototype 導覽可用，記錄回復 Commit 與驗證結果。前端回復不還原資料庫。若涉及資料問題，另依階段 7 的備份及還原紀錄處理。

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


## 家庭角色與個人清單

行程授權後選擇爸爸、媽媽、弟弟或我；頁首目前角色按鈕可切換使用者。角色不是登入憑證，所有 API 仍需有效私人連結。行李與待辦依行程、成員存於 Supabase；必備清單的項目名稱與新增／刪除維持全家共享，但勾選狀態及進度依角色分開保存。舊裝置清單保留，只有明確確認歸屬後才匯入。離線僅讀已快取資料。

本功能須先套用 `20261118020000_member_checklists.sql` 與 `20261124020000_member_essential_progress.sql`、部署新版 API，再發布前端。資料回復、驗收限制與 iPhone 手動步驟見 [POST-03 驗收紀錄](tests/manual/member-checklists.md)。

### 行程地點搜尋與座標

新增與修改行程可在「地點（選填）」輸入公開地點名稱及城市，按「搜尋地點」後核對候選地址並選取。選取只修改當前草稿，按表單儲存及完成當日編輯後，才在同一交易保存行程與座標；小地圖依順序更新標記。可以完全不搜尋直接新增；搜尋失敗、無結果或不選地點均不阻擋儲存。移除地點只解除當前行程的關聯，不刪除共用地點。

搜尋經過 Bearer 驗證的 `POST /v1/places/search`，不直接從瀏覽器呼叫圖資供應商。前端只提交選取的 `placeId`，伺服器只接受該行程項目既有地點或本旅程未過期的搜尋候選；省略 `placeId` 保留原關聯，`null` 明確移除。地點與行程保存沿用版本衝突及冪等規則，不接受前端任意座標。

預設採 Nominatim，必須遵守 [使用政策](https://operations.osmfoundation.org/policies/nominatim/)：只由使用者明確按搜尋觸發，沒有輸入即時建議；全 App 共用資料庫 lease，呼叫完成後至少隔 1.1 秒才允許下一次上游搜尋，失敗也限流。候選與空結果按旅程／正規化查詢快取 30 天，過期紀錄於下一次成功搜尋時清理。UI 顯示 OpenStreetMap 授權與公開名稱查詢提示；日期、私人憑證及旅程 ID 不送往圖資服務，搜尋內容不寫入請求 Log。

部署先套用 `20261124010000_itinerary_place_search.sql`，再部署 API，最後發布前端。可透過 Edge Function 的 `GEOCODING_SEARCH_URL` 切換至 HTTPS、無網址憑證的 Nominatim 相容 `/search` 端點，不需重新發布前端。預設服務不可用時可先保存純文字行程；離線維持唯讀。未選擇地點的既有／新行程不會背景自動定位。


若營運後端被 Nominatim 以 HTTP 403 拒絕，可在確認使用者同意新的查詢目的地後改設 `GEOCODING_PROVIDER=photon`，並移除原 `GEOCODING_SEARCH_URL` 覆寫值，或設為 `https://photon.komoot.io/api/`。Photon 採 OSM 資料，維持同樣的私有快取、限流與候選保存驗證；不自動把查詢轉送至未同意的其他服務。Photon 公共服務允許合理用量，但不保證可用性，參照 [Photon 官方使用說明](https://github.com/komoot/photon#demo-server)。此設定不需要前端改版。


公開圖資服務的 User-Agent 使用本專案專屬識別與 GitHub Issues 聯絡入口，Referer 固定為公開 App 網址，不包含私人 fragment。遵循 [Photon 維護者的應用識別說明](https://community.openstreetmap.org/t/getting-403-response-when-calling-the-api-endpoint-via-a-specific-device/141345/5)，不偽裝瀏覽器、變更來源 IP 或繞過服務封鎖。拒絕回應只記錄供應商、HTTP 狀態與固定原因分類，不保存回應內容或查詢。
必備清單進度存於 `member_essential_progress`，使用行程、成員與項目複合鍵；三種清單都由角色 API 讀取，快取與離線快照依角色隔離。舊版共用勾選無法辨識操作者，因此保留原資料但不複製成任何角色的完成紀錄。角色「我」採與媽媽不同的女生短髮頭像。

### Geoapify 地點搜尋

經使用者同意後，將後端 Secret `GEOCODING_PROVIDER` 設為 `geoapify`、`GEOCODING_SEARCH_URL` 設為 `https://api.geoapify.com/v1/geocode/search`，並設定 `GEOAPIFY_API_KEY`。Key 只存在後端，不能設為 VITE_ 變數。為防止 Key 被送往其他主機，Geoapify 模式只接受此固定 endpoint；不自動 fallback。

使用 [Geocoding API](https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/) 的 JSON 結果，停用 IP 國家偏好；只傳公開地點名稱與城市。Geoapify 快取獨立於舊供應商，沿用 30 天快取、全 App lease 與限流。座標通過驗證後產生 OSM 座標檢視連結，不假造 OSM 物件 ID。前端補上 Powered by Geoapify 與既有資料來源標示；搜尋仍為選填。部署後需從正式後端確認成功，免費方案不代表可用性保證。
