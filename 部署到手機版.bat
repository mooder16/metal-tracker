@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo   金屬追蹤器 - 部署 Firebase 手機版
echo ========================================
echo.
echo 【部署前請先完成】
echo 1. 到 https://console.firebase.google.com 建立專案（或選現有專案）
echo 2. 開啟 Firestore Database（測試模式即可）
echo 3. 升級為 Blaze 方案（Cloud Functions 需要，有免費額度）
echo 4. 編輯 public\firebase-config.js 填入 Firebase 設定
echo 5. 編輯 .firebaserc 填入專案 ID
echo 6. 安裝 Firebase CLI：npm install -g firebase-tools
echo 7. 登入：firebase login
echo.
pause

echo 安裝 Functions 依賴...
cd functions
call npm install --strict-ssl=false
if errorlevel 1 goto :error
cd ..

echo.
echo 部署 Hosting + Functions + Firestore 規則...
call firebase deploy
if errorlevel 1 goto :error

echo.
echo ========================================
echo 部署完成！
echo 手機開啟 Firebase Hosting 網址即可使用
echo 瀏覽器選單可「加入主畫面」像 App 一樣開啟
echo ========================================
pause
goto :end

:error
echo 部署失敗，請檢查上方錯誤訊息。
pause

:end
