@echo off
chcp 65001 >nul
echo ============================================
echo   P2P Arbitrage - Build Portable (.exe)
echo ============================================
echo.

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python no encontrado. Instala Python 3.10+ y agrega al PATH.
    pause
    exit /b 1
)

:: Check pnpm
pnpm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] pnpm no encontrado. Instala con: npm install -g pnpm
    pause
    exit /b 1
)

:: Step 0: Add Windows Defender exclusion (requires admin)
echo [0/5] Verificando exclusion de Windows Defender...
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

:: Step 1: Install Python dependencies
echo [1/5] Instalando dependencias de Python...
cd backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Error al instalar dependencias.
    pause
    exit /b 1
)
cd ..

:: Step 2: Build frontend
echo [2/5] Construyendo frontend...
cd frontend
pnpm install
pnpm build
if %errorlevel% neq 0 (
    echo [ERROR] Error al construir frontend.
    pause
    exit /b 1
)
cd ..

:: Step 3: Collect Django static files
echo [3/5] Recopilando archivos estaticos de Django...
cd backend
python manage.py collectstatic --noinput
cd ..

:: Step 4: Build .exe with PyInstaller
echo [4/6] Generando .exe con PyInstaller...
cd backend
pyinstaller ..\P2P_Portable.spec --noconfirm --clean
cd ..

:: Step 5: Copy frontend dist to output
echo [5/6] Copiando frontend al directorio de salida...
xcopy /E /I /Y "frontend\dist" "backend\dist\P2P_Arbitrage\frontend_dist"

:: Step 6: Add final exclusion for the .exe
echo [6/6] Configurando exclusion final...
net session >nul 2>&1
if %errorlevel% equ 0 (
    powershell -Command "Add-MpExclusion -Path '%~dp0backend\dist\P2P_Arbitrage\P2P_Arbitrage.exe' -ErrorAction SilentlyContinue"
)

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   BUILD COMPLETADO
    echo   Ejecutable: backend\dist\P2P_Arbitrage\P2P_Arbitrage.exe
    echo ============================================
    echo.
    echo Para distribuir: comprime la carpeta completa
    echo   backend\dist\P2P_Arbitrage\
    echo.
) else (
    echo [ERROR] Error durante la compilacion.
)

pause
