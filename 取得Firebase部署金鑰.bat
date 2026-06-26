@echo off
chcp 65001 >nul
echo ========================================
echo   取得 Firebase 部署金鑰（推薦方式）
echo ========================================
echo.
echo login:ci 在 Windows 常失敗，改用這個方法更穩定：
echo.
echo 1. 瀏覽器開啟以下網址：
echo    https://console.firebase.google.com/project/metal-tracker-gepin/settings/serviceaccounts/adminsdk
echo.
echo 2. 點「產生新的私密金鑰」/ Generate new private key
echo.
echo 3. 會下載一個 .json 檔案
echo.
echo 4. 到 GitHub repo：
echo    Settings ^> Secrets and variables ^> Actions ^> New repository secret
echo.
echo    名稱：FIREBASE_SERVICE_ACCOUNT
echo    值：打開 .json 檔，全選複製貼上（整份 JSON）
echo.
echo 5. 完成後到 GitHub Actions 手動 Run workflow
echo.
start https://console.firebase.google.com/project/metal-tracker-gepin/settings/serviceaccounts/adminsdk
echo.
echo ----------------------------------------
echo 若仍想用 login:ci，請在本視窗執行：
echo   set NODE_OPTIONS=--use-system-ca
echo   firebase login:ci --no-localhost
echo （會顯示網址，手動複製到瀏覽器，不要用自動跳轉）
echo ----------------------------------------
pause
