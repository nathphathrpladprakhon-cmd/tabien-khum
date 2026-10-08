@echo off
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 (
  node server.cjs
  pause
  exit /b 0
)

where py >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js or Python 3.10+
  pause
  exit /b 1
)
if not exist .venv py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (pause & exit /b 1)
.venv\Scripts\python.exe server.py
pause
