import { useState } from 'react';
import { saveWallet, deleteWallet, saveTransaction, deleteTransaction, saveLog, deleteLog } from '../api';
import type { Wallet, Transaction, DailyLog } from '../api';

export function usePortfolio(
  wallets: Wallet[],
  transactions: Transaction[],
  logs: DailyLog[],
  loadData: () => Promise<void>,
) {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<Wallet | null>(null);
  const [editingWalletId, setEditingWalletId] = useState<number | null>(null);
  const [walletForm, setWalletForm] = useState<Omit<Wallet, 'id' | 'created_at'>>({
    name: '',
    platform: '',
    currency: 'USDT',
    balance: 0,
    opening_balance: 0,
    is_active: true,
    color: '#2563eb',
  });

  const [txWalletFrom, setTxWalletFrom] = useState<string>('');
  const [txWalletTo, setTxWalletTo] = useState<string>('');
  const [txAmountOut, setTxAmountOut] = useState<number>(0);
  const [txRate, setTxRate] = useState<number>(0);
  const [txCommission, setTxCommission] = useState<number>(0);
  const [txManualAmountIn, setTxManualAmountIn] = useState<string>('');
  const [txNotes, setTxNotes] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(() => getLocalDatetimeString());
  const [txTypeOverride, setTxTypeOverride] = useState<Transaction['type'] | 'AUTO'>('AUTO');
  const [ledgerWalletFilter, setLedgerWalletFilter] = useState<string>('');
  const [ledgerLimit, setLedgerLimit] = useState<string>('5');
  const [portfolioDateFilter, setPortfolioDateFilter] = useState<string>('today');

  const getLocalDatetimeString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const activeWallets = wallets.filter(wallet => wallet.is_active);
  const selectedWalletFrom = wallets.find(wallet => wallet.id?.toString() === txWalletFrom);
  const selectedWalletTo = wallets.find(wallet => wallet.id?.toString() === txWalletTo);

  const inferTransactionType = (): Transaction['type'] => {
    if (txTypeOverride !== 'AUTO') return txTypeOverride;
    if (selectedWalletFrom?.currency === 'USDT' && selectedWalletTo && selectedWalletTo.currency !== 'USDT') return 'VENTA_P2P';
    if (selectedWalletFrom && selectedWalletFrom.currency !== 'USDT' && selectedWalletTo?.currency === 'USDT') return 'COMPRA_P2P';
    if (!selectedWalletFrom && selectedWalletTo) return 'DEPOSITO';
    if (selectedWalletFrom && !selectedWalletTo) return 'RETIRO';
    return 'TRANSFERENCIA';
  };

  const transactionType = inferTransactionType();

  const calculateTransactionAmountIn = () => {
    if (txAmountOut <= 0) return 0;
    const commissionFactor = 1 - txCommission / 100;
    if (transactionType === 'COMPRA_P2P') return txRate > 0 ? (txAmountOut / txRate) * commissionFactor : 0;
    if (transactionType === 'VENTA_P2P') return txAmountOut * txRate * commissionFactor;
    if (transactionType === 'TRANSFERENCIA') {
      return selectedWalletFrom?.currency === selectedWalletTo?.currency
        ? txAmountOut * commissionFactor
        : txAmountOut * txRate * commissionFactor;
    }
    if (transactionType === 'DEPOSITO') return txAmountOut;
    return 0;
  };

  const txAmountIn = parseFloat(calculateTransactionAmountIn().toFixed(6));
  const txAmountInDisplay = selectedWalletTo?.currency === 'USDT'
    ? txAmountIn.toFixed(3)
    : txAmountIn.toFixed(2);
  const effectiveTxAmountIn = txManualAmountIn.trim() !== ''
    ? parseFloat(txManualAmountIn) || 0
    : txAmountIn;

  const resetWalletForm = () => {
    setEditingWallet(null);
    setEditingWalletId(null);
    setWalletForm({
      name: '',
      platform: '',
      currency: 'USDT',
      balance: 0,
      opening_balance: 0,
      is_active: true,
      color: '#2563eb',
    });
  };

  const handleOpenWalletModal = (wallet?: Wallet) => {
    if (wallet) {
      setEditingWallet(wallet);
      setEditingWalletId(wallet.id ?? null);
      setWalletForm({
        name: wallet.name,
        platform: wallet.platform,
        currency: wallet.currency,
        balance: wallet.balance,
        opening_balance: wallet.opening_balance || wallet.balance,
        is_active: wallet.is_active,
        color: wallet.color,
      });
    } else {
      resetWalletForm();
    }
    setIsWalletModalOpen(true);
  };

  const handleSaveWallet = async (notify: (msg: string) => void) => {
    if (!walletForm.name.trim() || !walletForm.platform.trim()) return;
    await saveWallet({
      id: editingWalletId ?? editingWallet?.id,
      ...walletForm,
      balance: Number(walletForm.balance) || 0,
      opening_balance: Number(walletForm.opening_balance) || 0,
    });
    setIsWalletModalOpen(false);
    resetWalletForm();
    await loadData();
    notify(editingWalletId ? 'Billetera actualizada' : 'Billetera creada');
  };

  const handleDeactivateWallet = async (wallet: Wallet, notify: (msg: string, type?: 'success' | 'info') => void) => {
    if (!wallet.id) return;
    await saveWallet({ ...wallet, is_active: false });
    await loadData();
    notify('Billetera desactivada', 'info');
  };

  const handleDeleteWallet = async (wallet: Wallet, notify: (msg: string) => void) => {
    if (!wallet.id || !confirm(`¿Eliminar la billetera "${wallet.name}"?`)) return;
    await deleteWallet(wallet.id);
    await loadData();
    notify('Billetera eliminada');
  };

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

  const amountToUsdt = (amount: number, currency?: string | null, tasaBcv: number = 0) => {
    if (currency === 'USDT' || currency === 'USD') return amount;
    if (currency === 'VES') return tasaBcv > 0 ? amount / tasaBcv : 0;
    return 0;
  };

  const handleSaveTransaction = async (tasaBcv: number, notify: (msg: string) => void) => {
    if (!selectedWalletFrom && !selectedWalletTo) {
      alert('Selecciona al menos una billetera.');
      return;
    }
    if (txWalletFrom && !selectedWalletFrom) {
      alert('La billetera origen no se pudo resolver. Refresca la pagina y vuelve a seleccionarla.');
      return;
    }
    if (txWalletTo && !selectedWalletTo) {
      alert('La billetera destino no se pudo resolver. Refresca la pagina y vuelve a seleccionarla.');
      return;
    }
    if (['VENTA_P2P', 'COMPRA_P2P', 'TRANSFERENCIA'].includes(transactionType) && (!selectedWalletFrom || !selectedWalletTo)) {
      alert('Las compras, ventas y transferencias requieren billetera origen y destino.');
      return;
    }
    if (selectedWalletFrom?.id === selectedWalletTo?.id) {
      alert('La billetera origen y destino deben ser diferentes.');
      return;
    }
    if ((selectedWalletFrom || selectedWalletTo) && txAmountOut <= 0) {
      alert('El monto a enviar debe ser mayor a cero.');
      return;
    }
    if (selectedWalletTo && effectiveTxAmountIn <= 0) {
      alert('El monto que entra debe ser mayor a cero.');
      return;
    }

    try {
      const savedTx = await saveTransaction({
        date: txDate ? new Date(txDate).toISOString() : new Date().toISOString(),
        type: transactionType,
        wallet_from: selectedWalletFrom?.id ?? null,
        wallet_to: selectedWalletTo?.id ?? null,
        amount_out: selectedWalletFrom ? txAmountOut : 0,
        amount_in: selectedWalletTo ? effectiveTxAmountIn : 0,
        rate: txRate,
        commission_pct: txCommission,
        notes: txNotes,
      });

      if (transactionType === 'COMPRA_P2P' || transactionType === 'VENTA_P2P') {
        const txDateStr = savedTx.date.split('T')[0];
        const vol = selectedWalletFrom?.currency === 'USDT' || selectedWalletFrom?.currency === 'USD'
          ? txAmountOut
          : (selectedWalletTo?.currency === 'USDT' || selectedWalletTo?.currency === 'USD' ? effectiveTxAmountIn : amountToUsdt(txAmountOut, selectedWalletFrom?.currency, tasaBcv));

        const inUsdt = amountToUsdt(effectiveTxAmountIn, selectedWalletTo?.currency, tasaBcv);
        const outUsdt = amountToUsdt(txAmountOut, selectedWalletFrom?.currency, tasaBcv);
        const prof = inUsdt - outUsdt;

        await saveLog({
          date: txDateStr,
          profit: parseFloat(prof.toFixed(4)),
          volume: parseFloat(vol.toFixed(2)),
          notes: `[Auto-Transaccion #${savedTx.id}] Movimiento: ${transactionType} | Ruta: ${selectedWalletFrom?.name || 'Externo'} -> ${selectedWalletTo?.name || 'Externo'} | Tasa: ${txRate} | Notas: ${txNotes}`,
          imported: true,
          tipo_operativa: selectedWalletFrom?.currency === 'VES' || selectedWalletTo?.currency === 'VES' ? 'VES' : 'USD',
          plataforma_compra: transactionType === 'COMPRA_P2P' ? selectedWalletTo?.platform || 'P2P' : selectedWalletFrom?.platform || 'P2P',
          plataforma_venta: transactionType === 'VENTA_P2P' ? selectedWalletFrom?.platform || 'P2P' : selectedWalletTo?.platform || 'P2P',
          comision_compra: transactionType === 'COMPRA_P2P' ? txCommission : 0,
          comision_venta: transactionType === 'VENTA_P2P' ? txCommission : 0,
          metodo_compra: transactionType === 'COMPRA_P2P' ? selectedWalletFrom?.name || 'P2P' : selectedWalletTo?.name || 'P2P',
          metodo_venta: transactionType === 'VENTA_P2P' ? selectedWalletFrom?.name || 'P2P' : selectedWalletTo?.name || 'P2P',
          accumulate: false,
        });
      }

      setTxAmountOut(0);
      setTxRate(1.0);
      setTxManualAmountIn('');
      setTxNotes('');
      setTxDate(getLocalDatetimeString());
      await loadData();
      notify('Movimiento registrado');
    } catch (error: any) {
      alert(error.message || 'No se pudo registrar el movimiento.');
    }
  };

  const handleDeleteTransaction = async (tx: Transaction, notify: (msg: string) => void) => {
    if (!tx.id || !confirm('¿Eliminar este movimiento y revertir saldos?')) return;

    const targetLog = logs.find(log => log.notes.includes(`[Auto-Transaccion #${tx.id}]`));
    if (targetLog && targetLog.id) {
      try { await deleteLog(targetLog.id); } catch { /* ignore */ }
    }

    await deleteTransaction(tx.id);
    await loadData();
    notify('Movimiento eliminado y saldos revertidos');
  };

  const filteredTransactions = (ledgerWalletFilter
    ? transactions.filter(tx => tx.wallet_from?.toString() === ledgerWalletFilter || tx.wallet_to?.toString() === ledgerWalletFilter)
    : transactions
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const displayedTransactions = ledgerLimit === 'all'
    ? filteredTransactions
    : filteredTransactions.slice(0, parseInt(ledgerLimit, 10));

  return {
    isWalletModalOpen, setIsWalletModalOpen,
    editingWallet,
    editingWalletId,
    walletForm, setWalletForm,
    txWalletFrom, setTxWalletFrom,
    txWalletTo, setTxWalletTo,
    txAmountOut, setTxAmountOut,
    txRate, setTxRate,
    txCommission, setTxCommission,
    txManualAmountIn, setTxManualAmountIn,
    txNotes, setTxNotes,
    txDate, setTxDate,
    txTypeOverride, setTxTypeOverride,
    ledgerWalletFilter, setLedgerWalletFilter,
    ledgerLimit, setLedgerLimit,
    portfolioDateFilter, setPortfolioDateFilter,
    activeWallets,
    selectedWalletFrom,
    selectedWalletTo,
    transactionType,
    txAmountInDisplay,
    effectiveTxAmountIn,
    portfolioStart,
    portfolioEnd,
    filteredTransactionsForRange,
    getWalletBalancesForRange,
    displayedTransactions,
    handleOpenWalletModal,
    handleSaveWallet,
    handleDeactivateWallet,
    handleDeleteWallet,
    handleSaveTransaction,
    handleDeleteTransaction,
  };
}
