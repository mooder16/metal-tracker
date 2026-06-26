@echo off
chcp 65001 >nul
cd /d "%~dp0"
set NODE_OPTIONS=--use-system-ca

echo ========================================
echo   啟用即時更新（需 Blaze，用多少付多少）
echo ========================================
echo.
echo 手機/網頁按「更新」要即時爬蟲，需要 Cloud Functions。
echo 這只要為此專案開啟 Blaze（綁定同一張信用卡即可）。
echo.
echo 1. 瀏覽器會開啟 Firebase 升級頁面
echo 2. 選 Blaze 並完成綁定
echo 3. 回到這裡按任意鍵繼續部署
echo.
start https://console.firebase.google.com/project/metal-tracker-gepin/usage/details
pause

echo.
echo 正在部署網頁 + 爬蟲 API...
call "C:\Users\user\AppData\Roaming\npm\firebase.cmd" deploy --only hosting,functions --project metal-tracker-gepin
if errorlevel 1 (
  echo.
  echo 若仍失敗，請確認已完成 Blaze 升級後再執行本腳本。
  pause
  exit /b 1
)

echo.
echo ========================================
echo 完成！現在按「更新」會即時爬最新資料
echo https://metal-tracker-gepin.web.app
echo ========================================
pause
