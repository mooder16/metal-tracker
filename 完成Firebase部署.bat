@echo off
chcp 65001 >nul
cd /d "%~dp0"
set NODE_OPTIONS=--use-system-ca

echo ========================================
echo   完成 Firebase 部署（第 2 步）
echo ========================================
echo.
echo 請先在瀏覽器完成以下兩件事：
echo.
echo [1] 升級 Blaze 方案（Cloud Functions 需要）
echo     https://console.firebase.google.com/project/metal-tracker-gepin/usage/details
echo.
echo [2] 建立 Firestore 資料庫
echo     https://console.firebase.google.com/project/metal-tracker-gepin/firestore
echo     選 asia-east1 區域，測試模式即可
echo.
pause

echo 部署 Cloud Functions + Firestore 規則...
call "C:\Users\user\AppData\Roaming\npm\firebase.cmd" deploy --only functions,firestore:rules --project metal-tracker-gepin
if errorlevel 1 goto :error

echo.
echo 重新部署 Hosting（確保最新）...
call "C:\Users\user\AppData\Roaming\npm\firebase.cmd" deploy --only hosting --project metal-tracker-gepin

echo.
echo ========================================
echo 全部完成！
echo 手機開啟：https://metal-tracker-gepin.web.app
echo ========================================
pause
goto :end

:error
echo 部署失敗。若提示 Blaze，請先完成升級後再執行本腳本。
pause

:end
