# Travel Book UI Prototype

這是依照專案[頁面與功能規劃](../../docs/頁面功能.md)製作的互動原型，不是正式產品程式。

## 頁面

- 首頁：以歐洲雪山、積雪小鎮與尖屋頂建築構成冬季主視覺，文字靠下避免遮擋插畫，並包含旅程封面、倒數、天氣狀態、航班與小知識。
- 行程：預設頁面，包含五日日期列、OpenStreetMap 串接預留區，以及不顯示時間與類型文字標籤、具有左側連接線的行程卡片清單；箭頭開啟唯讀檢視與名稱搜尋導航，城市鉛筆則進入新增、修改、刪除及拖曳排序模式。
- 住宿：依日期排列住宿資訊與導航入口，提供貼上名稱後自動搜尋 Google Places 照片的狀態原型，以及新增、編輯與視窗內刪除。
- 記帳：三幣別同列總覽、日期分群展開／收合、支出新增、修改與刪除。
- 清單：必備、行李、待辦三類清單與完成進度；項目只顯示名稱與完成狀態。

主要卡片使用 `32 px` 大圓角，內層資訊卡使用 `24 px` 圓角；整體採冰雪色盤與雪景背景，卡片本身不顯示右上角星芒裝飾。

## 本機預覽

在本目錄執行：

```bash
python3 -m http.server 4173 --directory dist
```

再開啟 `http://localhost:4173`。

所有修改只存在記憶體，重新整理後會還原。

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
4. Pull Request 必須通過 `Validate` 檢查後才可使用 Squash and Merge。
5. 合併至 `master` 後，由 `Deploy GitHub Pages` 自動發佈。

