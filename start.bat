@echo off
echo ========================================
echo   404 Zoo - One Click Start
echo ========================================
echo.

:: Check if node_modules exist for backend
if not exist "404-backend\node_modules" (
    echo [1/4] Installing backend dependencies...
    cd 404-backend
    call npm install
    cd ..
) else (
    echo [1/4] Backend dependencies OK
)

:: Check if node_modules exist for frontend
if not exist "404-zoo\node_modules" (
    echo [2/4] Installing frontend dependencies...
    cd 404-zoo
    call npm install
    cd ..
) else (
    echo [2/4] Frontend dependencies OK
)

echo.
echo [3/4] Starting Backend Server (port 8080)...
start "404-Backend" cmd /k "cd 404-backend && npm start"

:: Wait for backend to start
timeout /t 2 /nobreak > nul

echo [4/4] Starting Frontend Dev Server...
start "404-Frontend" cmd /k "cd 404-zoo && npm start"

echo.
echo ========================================
echo   All services started!
echo ========================================
echo.
echo   Backend:  ws://localhost:8080
echo   Frontend: http://localhost:5173
echo.
echo   Press any key to exit this window...
echo   (Services will keep running)
echo ========================================
pause > nul
