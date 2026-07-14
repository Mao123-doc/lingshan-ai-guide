@echo off
cd /d "%~dp0"
git add -A
git commit -m "update launcher scripts"
git push origin master
echo Done
pause
