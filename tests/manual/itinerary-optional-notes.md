# 行程地點說明與空白內容（2026-11-25）

修改前範圍：PlaceSearchField 說明、ItineraryItemFormDialog 必填欄位、共用 itinerary 讀寫契約、itinerary_items.notes check；相依 API 驗證與保存交易。不改 Prototype，UI 僅縮短指定說明及允許空內容。

- 說明只保留「搜尋公開地點並選取正確地址。」。
- 行程名稱必填，內容可留白；不搜尋也可儲存。
- 空白內容新增後重新載入仍可顯示；修改可清空。
- 搜尋錯誤不阻擋空白內容保存。
- 手機 390 × 844 與桌面表單驗收；內容空白、說明、按鈕均正常，長視窗維持既有捲動。
- 本機使用實際 Edge handler、資料庫 adapter 與 PostgreSQL 相容 PGlite；外部搜尋為合成回應，不呼叫地理 API。
- 資料庫放寬 notes 空字串，保留 NOT NULL 與既有 500 字上限；新 SQL 回歸測試覆蓋新增、清空、讀回及限制。

## 搜尋診斷

正式後端 2026-11-24 22:37:34、22:37:37 搜尋 HTTP 200。截圖缺少新版 Geoapify 署名。既有 4 組正式快取回應（包括 Stephansdom＋維也納）本機重播：舊版 9e7c734 契約全部拒絕 OSM 座標連結，新版契約全部接受。正式新版瀏覽器以相同快取成功顯示候選。未呼叫外部 geocoding API，也未保存正式測試行程。

根因為舊版前端與新 provider 回應格式不相容。現行契約已支援，不需要再次修改 provider 或消耗額度。手機需先保存，完全關閉 Travel Book App 與其瀏覽器分頁，再重新開啟以啟用更新；確認出現 Powered by Geoapify。未自動重載或清除存取資料。真實 iPhone 更新仍需裝置驗證。

## 驗證

53 檔／313 項單元測試、TypeScript、build、6 檔 Prototype baseline、diff check 通過。本機資料庫已先重現原約束失敗，再套用新 migration 驗證空字串新增、空白清空、重讀與 NOT NULL／字數上限。CI 補跑 pgTAP。正式部署順序為 migration、API、Pages。
