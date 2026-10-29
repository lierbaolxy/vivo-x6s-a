@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python 3 not found in PATH.
  pause
  exit /b 1
)
python "%~dp0uninstaller_server.py"
pause
