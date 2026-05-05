# ClubHub AI Service - Windows PowerShell launcher.
#
# What it does:
#   1. Creates a local virtualenv in .venv (if missing)
#   2. Installs dependencies (first run only, or after you delete
#      .venv\.deps-installed to force a re-install)
#   3. Copies .env.example to .env if .env is missing
#   4. Starts FastAPI on http://localhost:8000
#
# Prerequisites (install ONCE, outside this script):
#   - Python 3.10+ in PATH        -> https://www.python.org/downloads/
#   - Ollama (native Windows app) -> https://ollama.com/download
#
# Run:
#     .\run.ps1

$ErrorActionPreference = "Stop"

function Invoke-OrDie {
    param(
        [string]$Exe,
        [string[]]$Arguments,
        [string]$WhatFailed
    )
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host ("[ERROR] {0} (exit code {1})" -f $WhatFailed, $LASTEXITCODE) -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

if (-not (Test-Path .venv)) {
    Write-Host "[setup] Creating virtualenv..." -ForegroundColor Cyan
    Invoke-OrDie -Exe "python" -Arguments @("-m", "venv", ".venv") -WhatFailed "venv creation failed"
}

$venvPython = Join-Path $scriptDir ".venv\Scripts\python.exe"

if (-not (Test-Path .venv\.deps-installed)) {
    Write-Host "[setup] Installing dependencies..." -ForegroundColor Cyan
    Invoke-OrDie -Exe $venvPython -Arguments @("-m", "pip", "install", "--upgrade", "pip") -WhatFailed "pip self-upgrade failed"
    Invoke-OrDie -Exe $venvPython -Arguments @("-m", "pip", "install", "-r", "requirements.txt") -WhatFailed "dependency installation failed"
    New-Item -ItemType File -Path .venv\.deps-installed -Force | Out-Null
}

if (-not (Test-Path .env)) {
    Write-Host "[setup] Copying .env.example to .env" -ForegroundColor Cyan
    Copy-Item .env.example .env
}

Write-Host ""
Write-Host "[run] Starting FastAPI on http://localhost:8000" -ForegroundColor Green
Write-Host "      Docs:   http://localhost:8000/docs"        -ForegroundColor Green
Write-Host "      Health: http://localhost:8000/health"      -ForegroundColor Green
Write-Host ""

& $venvPython -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
