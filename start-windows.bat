@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
  echo Please install Python 3.10 or newer from python.org
  pause
  exit /b 1
)
if not exist .venv py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (pause & exit /b 1)
.venv\Scripts\python.exe server.py
pause
