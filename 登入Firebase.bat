@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   步驟 1：登入 Firebase（只需做一次）
echo ========================================
echo.
echo 接下來會開啟瀏覽器，請用你的 Google 帳號登入並允許。
echo 完成後回到這裡按任意鍵繼續。
echo.
pause

firebase login --reauth
if errorlevel 1 (
  echo 登入失敗，請重試。
  pause
  exit /b 1
)

echo.
echo 登入成功！
echo.
echo 請在 Cursor 跟我說：「已登入 Firebase」
echo 並告訴我要用「新建專案」還是「現有專案名稱」。
echo.
echo 例如：已登入 Firebase，用新專案 metal-tracker
echo 或：  已登入 Firebase，用 order-tracker-app-9aee8
echo.
pause
