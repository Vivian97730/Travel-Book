# 專案協作規則

## 1. Git Workflow

- 所有新功能與錯誤修正必須在獨立分支開發。
- 所有變更必須透過 Pull Request 合併至 `master`。
- 不得直接推送或直接合併至 `master`。
- Commit message 使用 Conventional Commits。
- 分支使用清楚的 `feature/`、`fix/` 或 `refactor/` 名稱。
- 優先使用 Squash and Merge，保持歷史清楚。

## 2. Security

- 不得提交 API key、密碼、Token、憑證、`.env` 或私鑰。
- 敏感設定使用環境變數，且不得出現在程式碼、Log 或測試資料。

## 3. Code Quality

- 遵守既有架構與程式風格，變更保持小而聚焦。
- 不得在未經要求時重構不相關程式或改變既有行為。
- 避免不必要的相依套件。

## 4. Testing

- 建立 Pull Request 前執行相關檢查。
- 新功能與錯誤修正應更新測試；無法執行的檢查必須在 Pull Request 說明。

## 5. Documentation

- 功能或設定改變時，更新 README 或相關文件。
- 新環境變數只記錄於 `.env.example`，不得放入真實值。

## 6. Pull Request

- 說明目的、實作摘要、測試結果、破壞性變更與已知限制。
