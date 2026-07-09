import { useState } from 'react';
import type { Transaction } from '../api';

export function useLedger(transactions: Transaction[]) {
  const [ledgerWalletFilter, setLedgerWalletFilter] = useState<string>('');
  const [ledgerLimit, setLedgerLimit] = useState<string>('5');

  const filteredTransactions = (ledgerWalletFilter
    ? transactions.filter(tx => tx.wallet_from?.toString() === ledgerWalletFilter || tx.wallet_to?.toString() === ledgerWalletFilter)
    : transactions
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const displayedTransactions = ledgerLimit === 'all'
    ? filteredTransactions
    : filteredTransactions.slice(0, parseInt(ledgerLimit, 10));

  return {
    ledgerWalletFilter,
    setLedgerWalletFilter,
    ledgerLimit,
    setLedgerLimit,
    filteredTransactions,
    displayedTransactions,
  };
}
