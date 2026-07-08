# AGENTS.md

## Project

P2P Arbitrage calculator and portfolio tracker for Venezuela. Backend: Django 6 + DRF + SQLite. Frontend: React 19 + TypeScript 6 + Vite 8 + pnpm.

## Quick Start

**Backend** (run from `backend/`):
```bash
cd backend
python -m venv venv       # only first time
venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # port 8000
```

**Frontend** (run from `frontend/`):
```bash
cd frontend
pnpm install
pnpm dev    # port 5173, proxies to localhost:8000/api
```

Both must run simultaneously. Frontend falls back to localStorage when backend is offline.

## Commands

| Task | Command |
|------|---------|
| Frontend dev server | `pnpm dev` (in `frontend/`) |
| Frontend build | `pnpm build` |
| Frontend lint | `pnpm lint` (uses oxlint, not eslint) |
| Run Django migrations | `python manage.py migrate` (in `backend/`) |
| Run Django tests | `python manage.py test calculator` |
| Create superuser | `python manage.py createsuperuser` |
| Build portable .exe | `build.bat` (from project root) |

No test runner or typecheck script configured for frontend (no vitest, no tsc --noEmit).

## Architecture

### Backend (`backend/`)

- Single Django app: `calculator/`
- REST API mounted at `api/` (`p2p_project/urls.py:22`)
- CORS configured for localhost:5173 and :5174
- SQLite database at `backend/db.sqlite3`

**Models** (`calculator/models.py`):
- `Calculation` — saved simulation results (read-only computed fields)
- `DailyLog` — daily P2P operation log entries (bitacora)
- `Wallet` — multi-currency wallets (USDT/USD/VES) with unique constraint on (name, platform, currency)
- `Transaction` — wallet-to-wallet movements; create atomically updates balances; editing blocked (405); delete reverses balances

**Key endpoints** (`calculator/urls.py`):
- `POST api/calculate/` — stateless P2P math
- `GET api/bcv-rate/` — scrapes BCV website for USD rate
- `POST api/reset-db/` — destructive: wipes all tables
- CRUD: `api/history/`, `api/logs/`, `api/wallets/`, `api/transactions/`

### Frontend (`frontend/`)

- Single-file app: `src/App.tsx` (~1700 lines)
- API layer: `src/api.ts` — typed fetch wrappers with localStorage fallback
- No routing library; tab-based navigation (operative, buy_prices, logbook, portfolio, taxes)
- Linter: oxlint (not eslint) — config at `.oxlintrc.json`
- Build: `tsc -b && vite build`

## Gotchas

- **Transactions are immutable after create**: `TransactionViewSet.update` returns 405. Must delete and recreate.
- **Transaction delete reverses wallet balances** — atomic with delete in a DB transaction.
- **Wallet deduplication**: serializer upserts on (name, platform, currency) match. Frontend normalizes same.
- **DailyLog accumulation**: when `accumulate: true`, matching logs on same date+type+method are merged (additive).
- **Offline mode**: every API function has a localStorage fallback. `isOnline` state toggles the badge.
- **`get_bcv_rate` uses `verify=False`** (HTTPS without cert verification) — BCV site requires this.
- **`reset_database`** endpoint is destructive and unprotected — no auth required.
- **P2P math is duplicated**: `compute_p2p_math` in `calculator/views.py:14` and `performLocalCalculations` in `frontend/src/api.ts:37`. Keep both in sync if changing formulas.
- **Portable .exe mode**: `run_server.py` is the entry point. Uses waitress to serve Django + frontend. `spa_view.py` serves the React build. PyInstaller spec bundles everything into one .exe.
- **All monetary values are floats** (Django FloatField), not Decimal. Precision issues possible.
- **No test suite** for frontend. Backend has `calculator/tests.py` (check if populated).

## Auto-Update System

The portable .exe checks for updates on startup via GitHub Releases.

**Config files:**
- `version.json` — local version (e.g. `{"version": "1.0.0"}`). Bump before each release.
- `release_config.json` — GitHub repo: `{"owner": "code-rmendoza", "repo": "P2P-Arbitraje"}`
- `update_state.json` — generated at runtime next to the .exe. Tracks daily API call count.

**Rate limiting:** Max 10 GitHub API calls per day. Counter resets at midnight. Stored in `update_state.json`.

**Update flow:**
1. On startup, check internet connectivity (socket to 1.1.1.1:53)
2. If online and checks_today < 10: query `https://api.github.com/repos/{owner}/{repo}/releases/latest`
3. Compare tag (e.g. `v1.1.0`) with local `version.json` version
4. If newer: prompt user for confirmation in console
5. If accepted: download .zip to temp, generate `updater.ps1`, launch it, exit
6. `updater.ps1` waits for process to exit, replaces files (preserves db.sqlite3), relaunches .exe

**To release a new version:**
1. Bump `version.json` (e.g. `1.0.0` → `1.1.0`)
2. Run `build.bat`
3. Compress `backend\dist\P2P_Arbitrage\` into .zip
4. Create GitHub Release with tag `v1.1.0`, upload the .zip

**Files excluded from update:**
- `db.sqlite3` (user data preserved)
- `update_state.json` (rate limit state preserved)

## Conventions

- Spanish domain terminology throughout (models, UI, comments)
- Backend: standard Django/DRF patterns, no custom auth
- Frontend: no state management library, all state in App component via useState/useEffect
- Frontend uses `lucide-react` for icons
