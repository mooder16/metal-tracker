@echo off
cd /d "c:\Users\user\Desktop\cline\metal ttacker"
git config user.email "mooder16@github.com"
git config user.name "mooder16"
git remote add origin https://github.com/mooder16/metal-tracker.git 2>nul
git branch -M main
git add .
git status
git commit -m "feat: metal futures tracker with Chart.js - add stainless steel"
echo.
echo === Pushing to GitHub ===
git push -u origin main
echo.
echo === Done! ===
pause
