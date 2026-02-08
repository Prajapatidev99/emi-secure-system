# Quick Fix Script for Android Studio Errors
# Run this, then open Android Studio

Write-Host "🧹 Cleaning Android Studio cache and build files..." -ForegroundColor Cyan
Write-Host ""

Set-Location "e:\gemini-app\android"

# Stop Gradle daemon
Write-Host "Stopping Gradle daemon..." -ForegroundColor Yellow
.\gradlew.bat --stop
Start-Sleep -Seconds 2

# Remove cache directories
Write-Host "Removing cache directories..." -ForegroundColor Yellow
Remove-Item -Path ".gradle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".idea" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "app\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "build" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "✅ Cache cleaned successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Open Android Studio" -ForegroundColor White
Write-Host "  2. File → Open → e:\gemini-app\android" -ForegroundColor White  
Write-Host "  3. Wait for Gradle sync to complete" -ForegroundColor White
Write-Host "  4. Build → Rebuild Project" -ForegroundColor White
Write-Host "  5. Build → Build APK(s)" -ForegroundColor White
Write-Host ""
Write-Host "The unresolved reference error will be gone!" -ForegroundColor Green
