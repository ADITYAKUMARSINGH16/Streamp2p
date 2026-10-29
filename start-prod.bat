@echo off
echo ========================================================
echo  🚀 Starting StreamP2P in High-Speed Production Mode
echo  (Pre-compiled optimized chunks, zero chunkload timeouts)
echo ========================================================
echo.

echo Building Next.js production bundle...
call npm run build

echo Starting unified server on http://localhost:3000...
call npm start
pause

