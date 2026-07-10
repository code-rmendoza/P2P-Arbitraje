@echo off
chcp 65001 >nul
echo ============================================
echo   P2P Arbitrage - Build Portable (.exe) Dual
echo   (Compilación Automática x64 y x86)
echo ============================================
echo.

:: Step 0: Add Windows Defender exclusion (requires admin)
echo [0/6] Verificando exclusion de Windows Defender...
net session >nul 2>&1
if %errorlevel% equ 0 (
    powershell -Command "Add-MpExclusion -Path '%~dp0backend\dist' -ErrorAction SilentlyContinue"
    powershell -Command "Add-MpExclusion -Path '%~dp0backend\build' -ErrorAction SilentlyContinue"
    powershell -Command "Add-MpExclusion -Path '%~dp0backend\P2P_Arbitrage.exe' -ErrorAction SilentlyContinue"
    echo [OK] Exclusiones de Defender agregadas.
) else (
    echo [AVISO] Sin permisos de administrador. Si Defender bloquea el .exe,
    echo         ejecuta este script como Administrador o agrega la exclusion manualmente.
)
echo.

:: Step 1: Install Python dependencies for both architectures
echo [1/6] Instalando dependencias de Python (x64 y x86)...
cd backend
echo Instalando dependencias en Python 64-bit...
py -3-64 -m pip install -r requirements-build.txt
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias en Python 64-bit.
    pause
    exit /b 1
)
echo Instalando dependencias en Python 32-bit...
py -3-32 -m pip install -r requirements-build.txt
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias en Python 32-bit.
    pause
    exit /b 1
)
cd ..

:: Step 2: Build frontend
echo [2/6] Construyendo frontend...
cd frontend
call pnpm install
call pnpm build
if %errorlevel% neq 0 (
    echo [ERROR] Error al construir frontend.
    pause
    exit /b 1
)
cd ..

:: Step 3: Collect Django static files
echo [3/6] Recopilando archivos estaticos de Django...
cd backend
py -3-64 manage.py collectstatic --noinput
if %errorlevel% neq 0 (
    echo [ERROR] Error recopilando archivos estaticos.
    pause
    exit /b 1
)
cd ..

:: Step 4: Build x64 executable
echo [4/6] Compilando version de 64 bits (x64)...
cd backend
py -3-64 -m PyInstaller ..\P2P_Portable.spec --noconfirm --clean
if %errorlevel% neq 0 (
    echo [ERROR] Error al compilar version de 64 bits.
    pause
    exit /b 1
)
cd ..

echo Organizando carpeta de distribucion x64...
if exist "backend\dist\P2P_Arbitrage_x64" (
    rmdir /S /Q "backend\dist\P2P_Arbitrage_x64"
)
ren "backend\dist\P2P_Arbitrage" "P2P_Arbitrage_x64"
xcopy /E /I /Y "frontend\dist" "backend\dist\P2P_Arbitrage_x64\frontend_dist" >nul
copy /Y "version.json" "backend\dist\P2P_Arbitrage_x64\version.json" >nul
copy /Y "release_config.json" "backend\dist\P2P_Arbitrage_x64\release_config.json" >nul

:: Step 5: Build x86 executable
echo [5/6] Compilando version de 32 bits (x86)...
cd backend
py -3-32 -m PyInstaller ..\P2P_Portable.spec --noconfirm --clean
if %errorlevel% neq 0 (
    echo [ERROR] Error al compilar version de 32 bits.
    pause
    exit /b 1
)
cd ..

echo Organizando carpeta de distribucion x86...
if exist "backend\dist\P2P_Arbitrage_x86" (
    rmdir /S /Q "backend\dist\P2P_Arbitrage_x86"
)
ren "backend\dist\P2P_Arbitrage" "P2P_Arbitrage_x86"
xcopy /E /I /Y "frontend\dist" "backend\dist\P2P_Arbitrage_x86\frontend_dist" >nul
copy /Y "version.json" "backend\dist\P2P_Arbitrage_x86\version.json" >nul
copy /Y "release_config.json" "backend\dist\P2P_Arbitrage_x86\release_config.json" >nul

:: Step 6: Packaging & SHA-256 Signatures
echo [6/6] Empaquetando y generando firmas de seguridad (SHA-256)...
echo Comprimiendo y firmando version x64...
powershell -Command "Compress-Archive -Path 'backend\dist\P2P_Arbitrage_x64\*' -DestinationPath 'backend\dist\P2P_Arbitrage_x64.zip' -Force"
powershell -Command "$hash = (Get-FileHash -Path 'backend\dist\P2P_Arbitrage_x64.zip' -Algorithm SHA256).Hash.ToLower(); \"$hash  P2P_Arbitrage_x64.zip\" | Out-File -FilePath 'backend\dist\P2P_Arbitrage_x64.zip.sha256' -Encoding ascii"

echo Comprimiendo y firmando version x86...
powershell -Command "Compress-Archive -Path 'backend\dist\P2P_Arbitrage_x86\*' -DestinationPath 'backend\dist\P2P_Arbitrage_x86.zip' -Force"
powershell -Command "$hash = (Get-FileHash -Path 'backend\dist\P2P_Arbitrage_x86.zip' -Algorithm SHA256).Hash.ToLower(); \"$hash  P2P_Arbitrage_x86.zip\" | Out-File -FilePath 'backend\dist\P2P_Arbitrage_x86.zip.sha256' -Encoding ascii"

echo Generando archivos retrocompatibles (P2P_Arbitrage.zip como copia de x64)...
copy /Y "backend\dist\P2P_Arbitrage_x64.zip" "backend\dist\P2P_Arbitrage.zip" >nul
copy /Y "backend\dist\P2P_Arbitrage_x64.zip.sha256" "backend\dist\P2P_Arbitrage.zip.sha256" >nul

:: Add Defender exclusions for final paths
net session >nul 2>&1
if %errorlevel% equ 0 (
    powershell -Command "Add-MpExclusion -Path '%~dp0backend\dist\P2P_Arbitrage_x64\P2P_Arbitrage.exe' -ErrorAction SilentlyContinue"
    powershell -Command "Add-MpExclusion -Path '%~dp0backend\dist\P2P_Arbitrage_x86\P2P_Arbitrage.exe' -ErrorAction SilentlyContinue"
)

echo.
echo ==========================================================
echo   BUILD DUAL COMPLETADO CON ÉXITO
echo   Los siguientes archivos en backend\dist\ están listos:
echo.
echo   [x64] P2P_Arbitrage_x64.zip y .sha256
echo   [x86] P2P_Arbitrage_x86.zip y .sha256
echo   [Fallback] P2P_Arbitrage.zip y .sha256 (copia de x64)
echo ==========================================================
echo.
