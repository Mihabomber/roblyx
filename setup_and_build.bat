@echo off
set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
set "ANDROID_HOME=C:\Users\alnaz\AppData\Local\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Users\alnaz\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%"

echo ===================================================
echo [Cyber-Birthday Engine] AUTOMATIC APK BUILD
echo ===================================================

echo [1/5] Checking Node.js and npm...
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] npm not found. Node.js is required for APK build.
    goto :show_alternative
)

echo [2/5] Checking Java JDK and Android SDK...
where java >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] java not found. Java JDK 11 or 17 is required.
    goto :show_alternative
)

if "%ANDROID_HOME%"=="" (
    if "%ANDROID_SDK_ROOT%"=="" (
        echo [WARNING] ANDROID_HOME or ANDROID_SDK_ROOT environment variable not set.
        goto :show_alternative
    )
)

echo [3/5] Installing Apache Cordova globally...
call npm install -g cordova

echo [4/5] Creating Cordova project...
if exist CyberBirthday (
    echo Removing old project directory...
    rmdir /S /Q CyberBirthday
)
call cordova create CyberBirthday com.misha.cyberbirthday "CyberBirthday2026"

echo [5/5] Copying client files to www directory...
xcopy /Y /E /I Client\* CyberBirthday\www\

cd CyberBirthday

echo [5/5] Adding Android platform and building release...
call cordova platform add android
call cordova build android --release

if %errorlevel% neq 0 (
    echo [ERROR] Cordova build failed.
    goto :show_alternative_inside
)

echo ===================================================
echo APK BUILD COMPLETED SUCCESSFULLY!
echo Your APK file is located at:
echo %CD%\platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk
echo ===================================================
pause
exit /b

:show_alternative
echo ===================================================
echo INFO: MOBILE INTERACTIVE ROUTING WITHOUT NATIVE APK
echo ===================================================
echo You do not need to compile an APK to play on your phone!
echo You can run the game on your PC and open it on your phone's browser.
echo.
echo STEPS FOR MOBILE GAMEPLAY:
echo 1. Run start_game.bat or open desktop_launcher.py on your PC.
echo 2. Connect both your phone and PC to the SAME Wi-Fi network.
echo 3. Open any web browser on your phone (Chrome, Safari, Edge).
echo 4. Type your PC's IP address with port 8000:
python Client\get_ips.py
echo.
echo 5. On the login screen, enter this same IP address in the connection box!
echo ===================================================
pause
exit /b

:show_alternative_inside
cd ..
goto :show_alternative
