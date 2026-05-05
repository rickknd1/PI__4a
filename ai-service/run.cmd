@echo off
rem ClubHub AI Service — Windows CMD launcher.
rem
rem Usage from cmd.exe (or double-click):
rem     run.cmd
rem
rem (If you prefer PowerShell, use `.\run.ps1` instead — same result.)

setlocal
cd /d "%~dp0"

if not exist ".venv" (
    echo [setup] Creating virtualenv...
    python -m venv .venv
    if errorlevel 1 goto :err
)

set "VENV_PY=%~dp0.venv\Scripts\python.exe"

if not exist ".venv\.deps-installed" (
    echo [setup] Installing dependencies...
    "%VENV_PY%" -m pip install --upgrade pip
    if errorlevel 1 goto :err
    "%VENV_PY%" -m pip install -r requirements.txt
    if errorlevel 1 goto :err
    echo. > ".venv\.deps-installed"
)

if not exist ".env" (
    echo [setup] Copying .env.example -^> .env
    copy /y ".env.example" ".env" >nul
)

echo.
echo [run] Starting FastAPI on http://localhost:8000
echo        Docs:   http://localhost:8000/docs
echo        Health: http://localhost:8000/health
echo.
"%VENV_PY%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
goto :eof

:err
echo.
echo [ERROR] Setup failed — see messages above.
echo         Tip: delete the .venv folder and run this script again
echo              (a wheel for scikit-learn may be missing for your
echo              Python version — in that case install Python 3.12
echo              from https://www.python.org/downloads/).
exit /b 1
