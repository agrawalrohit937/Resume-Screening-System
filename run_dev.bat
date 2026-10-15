@echo off
TITLE CareerShala Development Launcher
echo ============================================================
echo   CareerShala - AI ATS ^& Talent Cloud Launcher
echo ============================================================
echo.

REM 1. Verify / Copy Backend .env
IF NOT EXIST "backend\.env" (
    echo [*] Creating backend\.env from .env.example...
    copy "backend\.env.example" "backend\.env" >nul
) ELSE (
    echo [OK] backend\.env found.
)

REM 2. Verify / Copy Frontend .env
IF NOT EXIST "frontend\.env" (
    echo [*] Creating frontend\.env from .env.example...
    copy "frontend\.env.example" "frontend\.env" >nul
) ELSE (
    echo [OK] frontend\.env found.
)

echo.
echo [*] Launching Backend (FastAPI on http://127.0.0.1:8000)...
start "CareerShala Backend API" cmd /k "cd backend && python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000"

echo [*] Launching Frontend (Vite on http://localhost:5173)...
start "CareerShala Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ============================================================
echo   [OK] Services launched!
echo   - Web Application: http://localhost:5173
echo   - Interactive API Docs: http://127.0.0.1:8000/docs
echo ============================================================
pause
