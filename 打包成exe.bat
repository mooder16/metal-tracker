@echo off
cd /d "%~dp0"
echo 正在安裝打包工具與依賴...
call npm install
if errorlevel 1 goto :error
echo.
echo 正在打包成 exe（約需 1~3 分鐘）...
call npm run build
if errorlevel 1 goto :error
echo.
echo 完成！exe 檔案在 dist 資料夾內。
explorer dist
goto :end

:error
echo 打包失敗，請確認已安裝 Node.js。
pause

:end
