# GitHub 協作與上傳規則

## 分支與提交

1. 先同步 `master`，再建立描述性分支，例如 `feature/pwa-home-screen-icon`。
2. Commit message 使用 Conventional Commits，例如 `feat: add PWA home screen icon`。
3. 僅推送工作分支，禁止直接推送 `master`。

## Pull Request

Pull Request 必須包含：

- 變更目的。
- 實作摘要。
- 已執行的測試與結果。
- 破壞性變更或已知限制；若無，請明確寫「無」。

合併前必須通過 `Validate`，並使用 Squash and Merge。`master` 應啟用分支保護：要求 Pull Request，但不要求核准者；同時要求必要狀態檢查 `Validate static prototype`，並禁止強制推送與刪除分支。

## 安全

公開的 GitHub Pages 只能放靜態前端。API 金鑰、Supabase Service Role Key、密碼、Token、`.env`、私鑰與真實敏感旅遊資料不得提交。未來的安全寫入、匯入與上傳必須由 Supabase Edge Functions 處理。
