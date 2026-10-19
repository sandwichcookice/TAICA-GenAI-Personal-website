# 雲科吃什麼

一個解決「今天吃什麼」的靜態互動網站。從雲林科技大學校園、龍潭路、鎮南路與大學路生活圈的餐飲名單中，轉出下一餐，並透過 Google 地圖查看位置與導航。

## 使用方式

1. 選擇餐點類型與區域。
2. 按下「轉一下，決定吃什麼」。
3. 轉盤停下後查看店家地址，或按「帶我去吃」開啟導航。

可選擇避免連續抽到同一家，也能從口袋名單直接查看店家位置。下方搜尋框僅搜尋名單，不影響轉盤候選店家。最近五次抽選紀錄只保留於當次頁面，重新整理後清除。

## 本機開啟

直接使用瀏覽器開啟 `index.html`。HTML、CSS、JavaScript 與店家資料集中在同一個檔案，無須安裝套件、建置工具、後端或 API 金鑰。

也可以在專案目錄執行：

```sh
python3 -m http.server 8000
```

再開啟 `http://localhost:8000`。Google 地圖與外部資料來源需要網路連線；離線時轉盤仍可操作。

## GitHub Pages

將根目錄的 `index.html` 與 `.nojekyll` 放在 `main` 分支後：

1. 進入 repository 的 **Settings → Pages**。
2. 在 **Build and deployment → Source** 選擇 **Deploy from a branch**。
3. Branch 選擇 **main**，資料夾選擇 **/(root)**，按下 **Save**。
4. 等待 GitHub 的 Pages 部署完成，使用設定頁顯示的網址開啟網站。

此 repository 啟用 Pages 後的預期網址為：

`https://sandwichcookice.github.io/TAICA-GenAI-Personal-website/`

是否已發布請以 Settings → Pages 與 Actions 的部署結果為準。更新 `main` 上的檔案後，GitHub 會重新發布。

參考：[GitHub 官方發布來源說明](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)。

## 餐飲資料

目前收錄 18 個餐飲選項，資料查閱日期為 2026-10-19。這是可持續擴充的名單，並非周邊餐廳的完整普查，也不是即時營業資料庫。每筆資料保留來源連結；校內餐飲可能隨學期調整，餐車停靠位置可能變動，出發前應以店家公告為準。

在 `index.html` 的 `RESTAURANTS` 陣列增修資料：

| 欄位 | 說明 |
| --- | --- |
| `id` | 唯一且穩定的識別碼 |
| `name` / `short` | 完整名稱 / 轉盤簡稱 |
| `area` | 龍潭路、鎮南路、大學路或校園內 |
| `categories` | 正餐、早午餐、點心、飲料，可有多個 |
| `icon` | 店家清單中的圖示 |
| `address` / `note` | 可查證地址與簡短餐飲說明 |
| `source` / `sourceName` | 公開資料來源網址與名稱 |

更新資料時也要更新頁面中的收錄數量、查閱日期與本說明。不加入未核對的價格、評分、座標或營業狀態。

## 視覺與規格

以[雲科官方校徽說明](https://www.yuntech.edu.tw/index.php/2019-04-02-07-04-39/3/2019-04-02-07-27-44)的青綠色意象為基礎，搭配白色、淺青綠與少量淡暖色。實際網頁色階為介面設計延伸，不宣稱是官方指定 HEX 色碼。

完整互動規格見 [SPEC.md](SPEC.md)。
