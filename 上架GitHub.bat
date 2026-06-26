@echo off
chcp 65001 >nul
cd /d "%~dp0"
set NODE_OPTIONS=--use-system-ca

echo ========================================
echo   金屬追蹤器 - 上架 GitHub（方案2）
echo ========================================
echo.
echo 此模式與 on-sell-tracker 相同：
echo   GitHub Actions 跑爬蟲 ^(免費^)
echo   Firebase Hosting 放網頁 ^(Spark 免費^)
echo   不需要 Blaze 方案
echo.
echo ----------------------------------------
echo 步驟 1：在 GitHub 建立新 repo
echo   名稱建議：metal-tracker
echo   https://github.com/new
echo ----------------------------------------
echo.
echo 步驟 2：取得 Firebase 部署金鑰（雙擊 取得Firebase部署金鑰.bat）
echo   在 GitHub repo 設定 Secret：
echo   名稱：FIREBASE_SERVICE_ACCOUNT
echo   值：貼上從 Firebase 下載的 JSON 全文
echo.
pause

echo.
echo 初始化 Git 並推送...
if not exist .git git init
git add .
git status
echo.
set /p REPO_URL="請貼上 GitHub repo 網址（例如 https://github.com/mooder16/metal-tracker.git）："
git branch -M main
git remote remove origin 2>nul
git remote add origin %REPO_URL%
git commit -m "feat: metal tracker with GitHub Actions scraper" 2>nul
git push -u origin main

echo.
echo 推送完成！請到 GitHub ^> Actions ^> Scrape and Deploy ^> Run workflow
echo 手動執行第一次爬蟲（約 2~3 分鐘）
echo.
echo 手機網址：https://metal-tracker-gepin.web.app
pause
