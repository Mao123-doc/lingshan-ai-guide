@echo off
cd /d "%~dp0.."
echo ========================================================
echo   LingShan Trusted Q&A and Route Planner
echo ========================================================
echo.

:: ---- First run: install if needed ----
cd backend
if not exist "node_modules" (
    echo [Setup] Installing backend dependencies...
    call npm install
    if errorlevel 1 exit /b 1
)
cd ..

cd frontend
if not exist "node_modules" (
    echo [Setup] Installing frontend dependencies...
    call npm install
    if errorlevel 1 exit /b 1
)
cd ..

(
    echo [Setup] Building frontend...
    cd frontend
    call npm run build
    if errorlevel 1 exit /b 1
    cd ..
)

python -c "import chromadb; import sentence_transformers" >nul 2>&1
if errorlevel 1 (
    echo [Setup] Installing Python packages...
    python -m pip install -r backend\python\requirements.txt
    if errorlevel 1 exit /b 1
)

:: ---- Start services ----
echo.
echo Starting services...
start "Vector" /min cmd /c "cd backend && python python\vector_service.py"
echo [OK] Vector search (port 8002)
timeout /t 5 /nobreak >nul
start "LingShan" cmd /c "cd backend && npm run dev"
echo [OK] Main server (port 8010)...
timeout /t 6 /nobreak >nul

echo.
echo Opening browser...
start http://localhost:8010
echo Ready! http://localhost:8010
echo Admin: http://localhost:8010/admin/login (admin / lingshan2026)
pause
