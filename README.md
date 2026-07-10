# P2P Arbitrage Calculator

Calculadora de arbitraje P2P y rastreador de portafolio para Venezuela. 

**Backend**: Django 6 + DRF + SQLite (Lógica y precisión matemática basada en `Decimal`).  
**Frontend**: React 19 + TypeScript + Vite 8 + pnpm (Estructura modular con hooks especializados por SRP y estilos CSS globales limpios).

---

## Quick Start (Desarrollo)

### Backend (ejecutar desde `backend/`):
```bash
cd backend
python -m venv venv          # solo primera vez
venv\Scripts\activate         # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver     # puerto 8000
```

### Frontend (ejecutar desde `frontend/`):
```bash
cd frontend
pnpm install
pnpm dev                       # puerto 5173, proxy a localhost:8000/api
```

Ambos deben correr simultáneamente. El frontend funciona con localStorage como fallback cuando el backend está offline.

---

## Ejecución con Docker (Nube o Servidores)

Puedes levantar todo el stack optimizado y en contenedores de producción usando Docker:
```bash
docker-compose up --build -d
```
El servicio estará disponible en el puerto `8000` con volumen persistente en tu host para resguardar la base de datos `db.sqlite3`.

---

## Compilación Portable (.exe)

Para generar el ejecutable portable para Windows (servidor Waitress + frontend React embebido + base de datos SQLite embebida):
```bash
build.bat                      # desde la raíz del proyecto
```

El ejecutable se compila en `backend/dist/P2P_Arbitrage/`. Para distribuirlo, simplemente comprime dicha carpeta en un archivo `.zip`.

---

## Estructura del Código

```
backend/
  calculator/
    views/             # Módulos segregados por dominio (calculations, portfolio, logs, system)
    auth.py            # Ciberseguridad: HMAC timing protection y permisos de acceso
    utils.py           # Funciones de soporte
    pagination.py      # Paginación flexible retrocompatible
    models.py          # Definición de tablas SQLite
    tests.py           # Casos de prueba unitarios y de integración (22 tests)
  p2p_project/         # Configuración del core Django
  requirements.txt     # Dependencias de Python
  pyproject.toml       # Estándares de calidad de código (Ruff, Black)

frontend/
  src/
    api/               # Cliente HTTP seguro con fallback local y control de errores
    hooks/             # Hooks de lógica desacoplados (useAppData, useLedger, useTransactionForm, useWalletForm)
    utils/             # Helpers de cálculo unificados (currency)
    components/        # Componentes visuales libres de estilos inline (PortfolioTab, etc.)
    index.css          # Hoja de estilos global consolidada
  package.json
  vite.config.ts

run_server.py          # Entrada Waitress SPA para el ejecutable portable
P2P_Portable.spec      # Configuración del empaquetado de PyInstaller
build.bat              # Script de build para Windows
version.json           # Número de versión del software
release_config.json    # Configuración del repositorio GitHub para Auto-Update
manual_implementacion_y_release.md # Guía detallada para Juniors y Releases
```

---

## Ciberseguridad y Endurecimiento (Hardening)

*   **Autenticación HMAC**: Protección contra ataques de temporización (timing attacks) usando `hmac.compare_digest`.
*   **Inyección Segura**: El token de acceso se inyecta dinámicamente en el marcado del `index.html` al compilar o servir a través de Waitress, eliminando la necesidad de llamadas HTTP API inseguras para obtener configuraciones sensibles.
*   **Actualizador con SHA-256**: El sistema descarga y valida el hash criptográfico SHA-256 de las actualizaciones antes de instalarlas, previniendo ataques de inyección de código.
*   **Desactivación en Producción**: Los endpoints sensibles de desarrollo (como obtención de tokens en texto claro) se desactivan automáticamente si la app corre compilada (.exe) o con `DEBUG = False`.

---

## Publicación de una Nueva Versión (Releases)

Para crear e implementar un nuevo release de forma correcta:
1.  Actualizar la versión en `version.json` (ej: `2.1.0` -> `2.2.0`).
2.  Ejecutar el script `build.bat` en la consola para compilar, comprimir y firmar automáticamente ambas arquitecturas (x86 y x64).
3.  Subir los seis archivos generados en `backend/dist/` (`_x64.zip`, `_x86.zip`, `P2P_Arbitrage.zip` y sus correspondientes firmas `.sha256`) a la sección de Releases de GitHub con el tag coincidente (ej: `v2.2.0`).

Para ver los comandos de consola exactos y el manual paso a paso de este flujo, consulta el archivo [manual_implementacion_y_release.md](file:///c:/Users/Usuario/Desktop/Proyectos/P2P/manual_implementacion_y_release.md).
