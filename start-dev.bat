@echo off
echo ========================================================
echo  🚀 Starting P2P File Streamer (Backend + Frontend)
echo ========================================================
echo.

if not exist node_modules\concurrently (
    echo Installing concurrently in root directory...
    call npm install
)

call npm run dev
pause

