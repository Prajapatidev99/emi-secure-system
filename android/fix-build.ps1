# Android Studio Build Fix Script

Write-Host "🔧 Fixing Android Studio Build Issues..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop Gradle Daemon
Write-Host "Step 1: Stopping Gradle daemon..." -ForegroundColor Yellow
Set-Location "e:\gemini-app\android"
.\gradlew.bat --stop
Write-Host "✅ Gradle daemon stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Clean build
Write-Host "Step 2: Cleaning build..." -ForegroundColor Yellow
Remove-Item -Path "app\build" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".gradle" -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "✅ Build directories cleaned" -ForegroundColor Green
Write-Host ""

# Step 3: Instructions for Android Studio
Write-Host "Step 3: Open Android Studio and follow these steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. File → Open → Select: e:\gemini-app\android" -ForegroundColor White
Write-Host "  2. Wait for Gradle sync to complete" -ForegroundColor White
Write-Host "  3. Click 'Sync Project with Gradle Files' (🔄 icon)" -ForegroundColor White
Write-Host "  4. Build → Rebuild Project" -ForegroundColor White
Write-Host "  5. Build → Build APK(s)" -ForegroundColor White
Write-Host ""
Write-Host "✅ APK will be at: app\build\outputs\apk\debug\app-debug.apk" -ForegroundColor Green
Write-Host ""

Write-Host "🎯 All code is ready! Just build in Android Studio." -ForegroundColor Cyan
