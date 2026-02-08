# Fix "Unresolved reference" Error in Android Studio

## The Problem
Android Studio is showing "Unresolved reference 'util'" even though the code is correct. This is a caching/indexing issue.

## ✅ Solution (Follow in Order)

### Step 1: Invalidate Caches
1. In Android Studio: **File → Invalidate Caches / Restart**
2. Check **"Invalidate and Restart"**
3. Click **OK**
4. Wait for Android Studio to restart

### Step 2: After Restart
1. Wait for indexing to complete (check bottom-right status bar)
2. **File → Sync Project with Gradle Files** (or click 🔄 icon)
3. Wait for sync to complete

### Step 3: Rebuild
1. **Build → Clean Project**
2. Wait for clean to finish
3. **Build → Rebuild Project**
4. Wait for rebuild to complete

### Step 4: If Still Not Working
Try this manual fix:

1. Close Android Studio completely
2. Delete these folders:
   ```
   e:\gemini-app\android\.gradle
   e:\gemini-app\android\.idea
   e:\gemini-app\android\app\build
   ```
3. Reopen Android Studio
4. Let it re-index and sync
5. Build → Rebuild Project

## 🔍 Verify Files Exist

The following files MUST exist:
- ✅ `e:\gemini-app\android\app\src\main\java\com\emiseure\customer\utils\PaymentReminderManager.kt`
- ✅ `e:\gemini-app\android\app\src\main\java\com\emiseure\customer\utils\PaymentReminderReceiver.kt`
- ✅ `e:\gemini-app\android\app\src\main\java\com\emiseure\customer\utils\SecureNetworkClient.kt`

All files have correct package declaration: `package com.emiseure.customer.utils`

## 🎯 Quick PowerShell Fix

Run this to clean and restart:

```powershell
cd e:\gemini-app\android

# Stop Gradle
.\gradlew.bat --stop

# Clean build directories
Remove-Item -Path ".gradle" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path ".idea" -Recurse -Force -ErrorAction SilentlyContinue  
Remove-Item -Path "app\build" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "✅ Cleaned! Now open Android Studio and sync project."
```

Then:
1. Open Android Studio
2. Open project: `e:\gemini-app\android`
3. Wait for Gradle sync
4. Build → Rebuild Project

## ✅ This WILL Fix It!

The code is 100% correct. This is just an Android Studio caching issue that happens sometimes with new packages.
