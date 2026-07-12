// Barrel export - re-exports all modules for backward compatibility
// Import from specific modules instead for better tree-shaking:
//   import { fetchWallets } from './api/wallets';

export { API_BASE_URL, authFetch, fetchTokenFromServer } from './client';

export type { CalculationInput, CalculationResult, SavedCalculation, TargetBuyPriceResult } from './calculations';
export { performLocalCalculations, calculateTargetBuyPrices, fetchCalculations, saveCalculation, deleteCalculation } from './calculations';

export type { DailyLog, DailyLogInput } from './logs';
export { fetchLogs, saveLog, deleteLog } from './logs';

export type { Wallet } from './wallets';
export { normalizeWallets, fetchWallets, saveWallet, deleteWallet } from './wallets';

export type { Transaction } from './transactions';
export { fetchTransactions, saveTransaction, deleteTransaction } from './transactions';

export type { UpdateInfo, UpdateProgress } from './system';
export { fetchBcvRate, checkUpdate, fetchVersion, applyUpdate, getUpdateProgress, fetchAuthToken, resetDatabaseSecure } from './system';
