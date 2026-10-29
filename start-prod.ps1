# PowerShell Startup Script for StreamP2P Production Mode

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host " 🚀 Starting StreamP2P (Production Mode)" -ForegroundColor Cyan
Write-Host " (Zero chunk timeouts, optimized static assets)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Building Next.js production bundle..." -ForegroundColor Yellow
npm run build

Write-Host "Starting unified server on port 3000..." -ForegroundColor Green
npm start

