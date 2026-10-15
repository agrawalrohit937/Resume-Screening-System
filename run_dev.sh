#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# CareerShala — Linux / macOS Quick Start Launcher
# ═══════════════════════════════════════════════════════════════════════════════

echo "============================================================"
echo "  CareerShala — AI ATS & Talent Cloud Launcher"
echo "============================================================"

# 1. Setup Backend .env
if [ ! -f "backend/.env" ]; then
    echo "[*] Creating backend/.env from .env.example..."
    cp backend/.env.example backend/.env
else
    echo "[OK] backend/.env found."
fi

# 2. Setup Frontend .env
if [ ! -f "frontend/.env" ]; then
    echo "[*] Creating frontend/.env from .env.example..."
    cp frontend/.env.example frontend/.env
else
    echo "[OK] frontend/.env found."
fi

echo ""
echo "[*] Starting FastAPI Backend on http://127.0.0.1:8000..."
(cd backend && uvicorn main:app --reload --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

echo "[*] Starting Vite Frontend on http://localhost:5173..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo "  [OK] Services running!"
echo "  - Web Application: http://localhost:5173"
echo "  - Interactive Swagger Docs: http://127.0.0.1:8000/docs"
echo "  Press Ctrl+C to terminate both servers."
echo "============================================================"

trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM
wait
