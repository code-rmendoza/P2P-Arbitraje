# Frontend - P2P Arbitrage Calculator

React 19 + TypeScript + Vite 8 + pnpm.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:5173 (proxies /api to localhost:8000)
```

## Build

```bash
pnpm build        # Output: dist/
pnpm lint         # oxlint (not eslint)
```

## Structure

```
src/
  api.ts              # API layer with localStorage fallback
  App.tsx             # Main orchestrator (~300 lines)
  hooks/
    useAppData.ts     # Data fetching, sync, online status
    useCalculator.ts  # Calculator state and operations
    usePortfolio.ts   # Wallets, transactions, ledger
    useLogbook.ts     # Calendar, logs, day operations
  components/
    OperativeTab.tsx      # Calculator form and results
    BuyPricesTab.tsx      # Buy price calculator
    LogbookTab.tsx        # Calendar grid
    PortfolioTab.tsx      # Wallets, transactions, ledger
    TaxesTab.tsx          # Fiscal estimation (ISLR)
    HistorySidebar.tsx    # Saved simulations sidebar
    SaveSimulationModal.tsx
    WalletModal.tsx
    CloseOperativeModal.tsx
    LogDayModal.tsx
```

## Key Decisions

- **No routing library** - tab-based navigation via state
- **No state management library** - all state in App via useState/useEffect
- **Offline-first** - every API function has a localStorage fallback
- **Linter: oxlint** - not eslint. Config at `.oxlintrc.json`
