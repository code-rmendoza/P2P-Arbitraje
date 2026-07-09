# AGENTS.md

## Project

P2P Arbitrage calculator and portfolio tracker for Venezuela. Backend: Django 6 + DRF + SQLite (precise Decimal arithmetic). Frontend: React 19 + TypeScript 6 + Vite 8 + pnpm (modular hooks architecture, stylesheet-driven styles).

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
- SQLite database at `backend/db.sqlite3`
- Configured Ruff and Black settings inside `backend/pyproject.toml`
- View layers modularized inside sub-package `calculator/views/` (calculations.py, portfolio.py, logs.py, system.py)

**Models** (`calculator/models.py`):
- `Calculation` — saved simulation results (read-only computed fields)
- `DailyLog` — daily P2P operation log entries (bitacora)
- `Wallet` — multi-currency wallets (USDT/USD/VES) with unique constraint on (name, platform, currency)
- `Transaction` — wallet-to-wallet movements; create atomically updates balances; editing blocked (405); delete reverses balances

**Key endpoints** (`calculator/urls.py`):
- `POST api/calculate/` — stateless P2P math using Decimal values
- `GET api/bcv-rate/` — scrapes BCV website for USD rate with a 6-hour disk caching system
- `POST api/reset-db/` — destructive: wipes all tables in a safe, transaction-bound sequence (requires Bearer token authentication)
- CRUD: `api/history/`, `api/logs/`, `api/wallets/`, `api/transactions/`

### Frontend (`frontend/`)

- Modularized state management: split `usePortfolio` logic into single-responsibility custom hooks:
  - `src/hooks/useLedger.ts` — Ledger table states, filters, limits
  - `src/hooks/useTransactionForm.ts` — Transaction form actions
  - `src/hooks/useWalletForm.ts` — Wallet creation/editing modals
  - `src/hooks/usePortfolio.ts` — acts as the orchestrator facade
- API layer: `src/api/` — split into specific modules (wallets.ts, transactions.ts, logs.ts, calculations.ts, client.ts) with active error propagation (throws true HTTP errors) and TypeError local fallback
- Layout: Components are styled using CSS classes defined in `src/index.css` (no inline style objects)
- Linter: oxlint (not eslint) — config at `.oxlintrc.json`
- Build: `tsc -b && vite build`

## Gotchas

- **Transactions are immutable after create**: `TransactionViewSet.update` returns 405. Must delete and recreate.
- **Transaction delete reverses wallet balances** — atomic with delete in a DB transaction.
- **Unique Wallet constraints**: Unique together constraint on `(name, platform, currency)`. Serializer create enforces it directly via DB validations, returning `400 Bad Request` if duplicate.
- **DailyLog accumulation**: when `accumulate: true` on log creation, backend locks the database row (`select_for_update`) and accumulates profit, volume, and comments inside an atomic transaction block.
- **Offline mode**: every API function has a localStorage fallback. `isOnline` state toggles the badge.
- **`get_bcv_rate` caching**: Caches scraped rate in `bcv_rate_cache.json` for 6 hours. If scraping fails (connection issues, SSL errors, HTML changes), it falls back to expired cached rate or a hardcoded contingency rate of `36.50`.
- **Timing attack protection**: Authentication comparison uses `hmac.compare_digest` to prevent timing side-channel attacks.
- **Secure Token injection**: `run_server.py` in production Waitress mode automatically injects `window.__P2P_TOKEN__` script block into `index.html` on delivery, removing bootstrap auth token network calls.
- **Precision**: All financial view backend calculations are done using Python's `Decimal` class, avoiding float precision errors. Redundant calculations unifications done via client-side `currency.ts amountToUsdt` and backend views.
- **No test suite** for frontend. Backend has `calculator/tests.py` containing 22 tests (covers update hash checking, timing checks, constraints, log accumulation, and BCV fallbacks).

## Auto-Update System

The portable .exe checks for updates on startup via GitHub Releases.

**Config files:**
- `version.json` — local version (e.g. `{"version": "2.1.0"}`). Bump before each release.
- `release_config.json` — GitHub repo: `{"owner": "code-rmendoza", "repo": "P2P-Arbitraje"}`
- `update_state.json` — generated at runtime next to the .exe. Tracks daily API call count.

**Integrity Verification (SHA-256):**
During updates, the system downloads both the `P2P_Arbitrage.zip` and `P2P_Arbitrage.zip.sha256` files. It computes the SHA-256 checksum of the local ZIP and compares it to the remote hash. If they mismatch or the hash signature is missing, the updater deletes the temporary files and halts.

**Update flow:**
1. On startup, check internet connectivity (socket to 1.1.1.1:53)
2. If online and checks_today < 10: query `https://api.github.com/repos/{owner}/{repo}/releases/latest`
3. Compare tag (e.g. `v2.1.0`) with local `version.json` version
4. If newer: prompt user for confirmation in console
5. If accepted: download ZIP and SHA-256 signature to temp, verify integrity hash
6. If valid: generate `updater.ps1`, launch it, exit
7. `updater.ps1` replaces files (preserves db.sqlite3 and update_state.json), relaunches .exe

**To release a new version:**
1. Bump `version.json` (e.g. `2.1.0` → `2.2.0`)
2. Run `build.bat`
3. Compress `backend\dist\P2P_Arbitrage\` into `P2P_Arbitrage.zip`
4. Calculate SHA-256 of the ZIP and save it in `P2P_Arbitrage.zip.sha256`
5. Create GitHub Release with tag `v2.2.0`, upload the ZIP and SHA-256 signature
6. Delete temporary folders (`backend/build/` and `backend/dist/`) locally

## Conventions

- Spanish domain terminology throughout (models, UI, comments)
- Backend: standard Django/DRF patterns, no custom auth
- Frontend: no state management library, all state in App component via useState/useEffect
- Frontend uses `lucide-react` for icons
