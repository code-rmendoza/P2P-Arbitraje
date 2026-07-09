# P2P Arbitrage Calculator

Calculadora de arbitraje P2P y portafolio para Venezuela. Backend: Django 6 + DRF + SQLite. Frontend: React 19 + TypeScript + Vite.

## Quick Start

**Backend** (ejecutar desde `backend/`):
```bash
cd backend
python -m venv venv          # solo primera vez
venv\Scripts\activate         # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver     # puerto 8000
```

**Frontend** (ejecutar desde `frontend/`):
```bash
cd frontend
pnpm install
pnpm dev                       # puerto 5173, proxy a localhost:8000/api
```

Ambos deben correr simultaneamente. El frontend funciona con localStorage cuando el backend esta offline.

## Portable .exe

Para generar el ejecutable portable:
```bash
build.bat                      # desde la raiz del proyecto
```

El .exe se genera en `backend/dist/P2P_Arbitrage/`. Incluye servidor waitresse + frontend embebido.

## Estructura

```
backend/
  calculator/          # API REST (models, views, urls, tests)
  p2p_project/         # Configuracion Django (settings, urls)
  manage.py
  requirements.txt

frontend/
  src/
    api.ts             # Capa de API con fallback localStorage
    App.tsx            # Orquestador principal (~300 lineas)
    hooks/             # Logica: useAppData, useCalculator, usePortfolio, useLogbook
    components/        # UI: tabs, modals, sidebar
  package.json
  vite.config.ts

run_server.py          # Entrada para .exe portatil
P2P_Portable.spec      # Config PyInstaller
build.bat              # Script de build
version.json           # Version actual
```

## Variables de Entorno

| Variable | Descripcion | Default |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Clave secreta (auto-generada si no existe) | Auto-generada |
| `DJANGO_DEBUG` | Modo debug | `false` |

Ver `.env.example` para referencia.

## Comandos

| Tarea | Comando |
|-------|---------|
| Frontend dev server | `pnpm dev` (en `frontend/`) |
| Frontend build | `pnpm build` |
| Frontend lint | `pnpm lint` (oxlint) |
| Migraciones Django | `python manage.py migrate` (en `backend/`) |
| Tests Django | `python manage.py test calculator` |
| Crear superuser | `python manage.py createsuperuser` |
| Build .exe portable | `build.bat` (desde la raiz) |

## Auto-Update

El .exe verifica GitHub Releases al iniciar. Max 10 llamadas API/dia. Si hay una version mas nueva, muestra un boton amarillo en el header para descargar e instalar.

Para publicar una nueva version:
1. Actualizar `version.json`
2. Ejecutar `build.bat`
3. Comprimir `backend/dist/P2P_Arbitrage/` en .zip
4. Crear GitHub Release con tag `vX.Y.Z` y subir el .zip

## Tech Stack

- **Backend**: Django 6.0.3, DRF 3.16.1, SQLite, django-cors-headers
- **Frontend**: React 19, TypeScript, Vite 8, pnpm, oxlint, lucide-react
- **Portatil**: PyInstaller 6.21, waitress
