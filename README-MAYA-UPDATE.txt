瑪雅足球更新包｜2026-10-03

這是套用至現有 maya-sports 專案的更新包，不是完整網站。

上傳方式
1. 先將 ZIP 解壓縮。
2. 將解壓後的 .github、lib、data、scripts、tests、docs 等內容，按原路徑合併至瑪雅 GitHub 儲存庫的根目錄（與 package.json 同一層）。同名更新檔案需覆蓋。
3. 提交更新。Render 若已設定 main 自動部署，會建置新版本；成功狀態為 Live。
4. 請上傳解壓後的內容；單獨上傳 ZIP 不會更新網站程式。

更新內容
- 2,299 場跨來源核對的足球 xG 資料，以及原始賽果、身分與場地核對紀錄。
- 每日台灣時間 04:25 的 GitHub Actions 資料更新流程；排程可能延遲。
- 足球分析資料端讀取 xG；新資料不會自行開啟未通過的模型。
- 共用足球模型及其相依資料檔；西甲、法甲使用已通過的版本。
- 瑪雅版本保留 BBC 備援路由、請求佇列及 sourceSlug 球隊欄位。

模型狀態
德甲、義甲、歐冠、歐國聯的 v6 新候選仍未通過全部回測門檻，維持停用；不會因資料下載成功而冒稱校準通過。完整結果在 docs/football-opponent-xg-v6-results.json。

適用範圍與驗證
本包以最後可讀取的瑪雅版本 298ae442f2e3fcaaea6d9c3586919facaaebbc0d，整合 YJ 已部署版本 753487382c3db281b4a4efe99a1dce86e61825a1 的足球更新。
已通過包內資料解析、xG 特徵與瑪雅國家隊分析管線測試；共用模型程式來自已部署的 YJ 版本。
瑪雅最新儲存庫仍回傳 404，因此尚未驗證套用後的瑪雅整站建置；以實際 Render 建置結果為準。

現有瑪雅專案需保留 lib/alternate-schedules.ts、lib/source-request.ts、lib/sports-source-access.ts，以及原本的 package.json、package-lock.json。它們屬於現有瑪雅網站，這個更新包不含整站或帳號環境設定。
