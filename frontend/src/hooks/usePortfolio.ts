import { useState } from 'react';
import type { Wallet, Transaction } from '../api';
import { useWalletForm } from './useWalletForm';
import { useTransactionForm } from './useTransactionForm';
import { useLedger } from './useLedger';

export function usePortfolio(
  wallets: Wallet[],
  transactions: Transaction[],
  loadData: () => Promise<void>,
) {
  const [portfolioDateFilter, setPortfolioDateFilter] = useState<string>('today');

  // Delegate logic to modularized sub-hooks
  const walletFormHook = useWalletForm(loadData);
  const txFormHook = useTransactionForm(wallets, loadData);
  const ledgerHook = useLedger(transactions);

  const activeWallets = wallets.filter(wallet => wallet.is_active);

  const getPortfolioDateRange = () => {
    let start: Date | null = null;
    let end: Date | null = null;

    if (portfolioDateFilter === 'today') {
      start = new Date(); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
    } else if (portfolioDateFilter === 'yesterday') {
      start = new Date(); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999);
    } else if (portfolioDateFilter === 'month') {
      start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
      end = new Date(); end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  };

  const { start: portfolioStart, end: portfolioEnd } = getPortfolioDateRange();

  const getFilteredTransactionsForRange = (start: Date | null, end: Date | null) => {
    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (start && txDate < start) return false;
      if (end && txDate > end) return false;
      return true;
    });
  };

  const filteredTransactionsForRange = getFilteredTransactionsForRange(portfolioStart, portfolioEnd);

  const getWalletBalancesForRange = (wallet: Wallet, start: Date | null, end: Date | null) => {
    let closing = wallet.balance;
    let opening = wallet.opening_balance ?? wallet.balance;

    if (end) {
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate > end) {
          if (tx.wallet_from === wallet.id) closing += tx.amount_out;
          if (tx.wallet_to === wallet.id) closing -= tx.amount_in;
        }
      });
    }

    if (start) {
      let calculatedOpening = wallet.balance;
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate > start) {
          if (tx.wallet_from === wallet.id) calculatedOpening += tx.amount_out;
          if (tx.wallet_to === wallet.id) calculatedOpening -= tx.amount_in;
        }
      });
      opening = calculatedOpening;
    } else {
      opening = wallet.opening_balance ?? wallet.balance;
    }

    return { opening, closing };
  };

  return {
    // Wallet form operations
    isWalletModalOpen: walletFormHook.isWalletModalOpen,
    setIsWalletModalOpen: walletFormHook.setIsWalletModalOpen,
    editingWallet: walletFormHook.editingWallet,
    editingWalletId: walletFormHook.editingWalletId,
    walletForm: walletFormHook.walletForm,
    setWalletForm: walletFormHook.setWalletForm,
    handleOpenWalletModal: walletFormHook.handleOpenWalletModal,
    handleSaveWallet: walletFormHook.handleSaveWallet,
    handleDeactivateWallet: walletFormHook.handleDeactivateWallet,
    handleDeleteWallet: walletFormHook.handleDeleteWallet,

    // Transaction form operations
    txWalletFrom: txFormHook.txWalletFrom,
    setTxWalletFrom: txFormHook.setTxWalletFrom,
    txWalletTo: txFormHook.txWalletTo,
    setTxWalletTo: txFormHook.setTxWalletTo,
    txAmountOut: txFormHook.txAmountOut,
    setTxAmountOut: txFormHook.setTxAmountOut,
    txRate: txFormHook.txRate,
    setTxRate: txFormHook.setTxRate,
    txCommission: txFormHook.txCommission,
    setTxCommission: txFormHook.setTxCommission,
    txManualAmountIn: txFormHook.txManualAmountIn,
    setTxManualAmountIn: txFormHook.setTxManualAmountIn,
    txNotes: txFormHook.txNotes,
    setTxNotes: txFormHook.setTxNotes,
    txDate: txFormHook.txDate,
    setTxDate: txFormHook.setTxDate,
    txTypeOverride: txFormHook.txTypeOverride,
    setTxTypeOverride: txFormHook.setTxTypeOverride,
    selectedWalletFrom: txFormHook.selectedWalletFrom,
    selectedWalletTo: txFormHook.selectedWalletTo,
    transactionType: txFormHook.transactionType,
    txAmountInDisplay: txFormHook.txAmountInDisplay,
    effectiveTxAmountIn: txFormHook.effectiveTxAmountIn,
    handleSaveTransaction: txFormHook.handleSaveTransaction,
    handleDeleteTransaction: txFormHook.handleDeleteTransaction,

    // Ledger filters and records
    ledgerWalletFilter: ledgerHook.ledgerWalletFilter,
    setLedgerWalletFilter: ledgerHook.setLedgerWalletFilter,
    ledgerLimit: ledgerHook.ledgerLimit,
    setLedgerLimit: ledgerHook.setLedgerLimit,
    displayedTransactions: ledgerHook.displayedTransactions,

    // Portfolio state and consolidation
    portfolioDateFilter,
    setPortfolioDateFilter,
    activeWallets,
    portfolioStart,
    portfolioEnd,
    filteredTransactionsForRange,
    getWalletBalancesForRange,
  };
}
