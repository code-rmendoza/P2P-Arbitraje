import { useState, useEffect, useRef } from 'react';
import {
  fetchCalculations,
  fetchLogs,
  fetchWallets,
  fetchTransactions,
  fetchVersion,
  checkUpdate,
  saveLog,
  deleteLog,
} from '../api';
import type { SavedCalculation, DailyLog, Wallet, Transaction, UpdateInfo } from '../api';

export function useAppData() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const syncLock = useRef(false);

  const amountToUsdt = (amount: number, currency?: string | null, tasaBcv: number = 0) => {
    if (currency === 'USDT' || currency === 'USD') return amount;
    if (currency === 'VES') return tasaBcv > 0 ? amount / tasaBcv : 0;
    return 0;
  };

  const syncAllHistoricalTransactionsToLogbook = async (
    allTxs: Transaction[],
    allLogs: DailyLog[],
    allWallets: Wallet[],
    tasaBcv: number
  ) => {
    if (syncLock.current) return;
    syncLock.current = true;

    try {
      const autoLogs = allLogs.filter(log => log.notes.includes('[Auto-Transaccion #'));
      const seenTags = new Set<string>();

      for (const log of autoLogs) {
        const match = log.notes.match(/\[Auto-Transaccion #\d+\]/);
        if (match) {
          const tag = match[0];
          if (seenTags.has(tag)) {
            if (log.id) {
              try { await deleteLog(log.id); } catch { /* ignore */ }
            }
          } else {
            seenTags.add(tag);
          }
        }
      }

      const p2pTxs = allTxs.filter(tx => tx.type === 'COMPRA_P2P' || tx.type === 'VENTA_P2P');
      const missingTxs = p2pTxs.filter(tx =>
        !allLogs.some(log => log.notes.includes(`[Auto-Transaccion #${tx.id}]`))
      );

      if (missingTxs.length === 0) return;

      for (const tx of missingTxs) {
        try {
          const txDateStr = tx.date.split('T')[0];
          const walletFrom = allWallets.find(w => w.id === tx.wallet_from);
          const walletTo = allWallets.find(w => w.id === tx.wallet_to);
          const fromCurrency = walletFrom?.currency || tx.wallet_from_currency;
          const toCurrency = walletTo?.currency || tx.wallet_to_currency;

          const vol = fromCurrency === 'USDT' || fromCurrency === 'USD'
            ? tx.amount_out
            : (toCurrency === 'USDT' || toCurrency === 'USD' ? tx.amount_in : amountToUsdt(tx.amount_out, fromCurrency, tasaBcv));

          const inUsdt = amountToUsdt(tx.amount_in, toCurrency, tasaBcv);
          const outUsdt = amountToUsdt(tx.amount_out, fromCurrency, tasaBcv);
          const prof = inUsdt - outUsdt;

          await saveLog({
            date: txDateStr,
            profit: parseFloat(prof.toFixed(4)),
            volume: parseFloat(vol.toFixed(2)),
            notes: `[Auto-Transaccion #${tx.id}] Movimiento: ${tx.type} | Ruta: ${tx.wallet_from_name || walletFrom?.name || 'Externo'} → ${tx.wallet_to_name || walletTo?.name || 'Externo'} | Tasa: ${tx.rate} | Notas: ${tx.notes || ''}`,
            imported: true,
            tipo_operativa: fromCurrency === 'VES' || toCurrency === 'VES' ? 'VES' : 'USD',
            plataforma_compra: tx.type === 'COMPRA_P2P' ? walletTo?.platform || tx.wallet_to_platform || 'P2P' : walletFrom?.platform || tx.wallet_from_platform || 'P2P',
            plataforma_venta: tx.type === 'VENTA_P2P' ? walletFrom?.platform || tx.wallet_from_platform || 'P2P' : walletTo?.platform || tx.wallet_to_platform || 'P2P',
            comision_compra: tx.type === 'COMPRA_P2P' ? tx.commission_pct : 0,
            comision_venta: tx.type === 'VENTA_P2P' ? tx.commission_pct : 0,
            metodo_compra: tx.type === 'COMPRA_P2P' ? walletFrom?.name || tx.wallet_from_name || 'P2P' : walletTo?.name || tx.wallet_to_name || 'P2P',
            metodo_venta: tx.type === 'VENTA_P2P' ? walletFrom?.name || tx.wallet_from_name || 'P2P' : walletTo?.name || tx.wallet_to_name || 'P2P',
            accumulate: false
          });
        } catch { /* ignore individual tx errors */ }
      }
    } finally {
      syncLock.current = false;
    }
  };

  const loadData = async (tasaBcv: number) => {
    try {
      const [dataCalculations, dataLogs, dataWallets, dataTransactions] = await Promise.all([
        fetchCalculations(),
        fetchLogs(),
        fetchWallets(),
        fetchTransactions(),
      ]);

      setHistory(dataCalculations);
      setLogs(dataLogs);
      setWallets(dataWallets);
      setTransactions(dataTransactions);

      await syncAllHistoricalTransactionsToLogbook(dataTransactions, dataLogs, dataWallets, tasaBcv);

      const updatedLogs = await fetchLogs();
      setLogs(updatedLogs);

      setIsOnline(true);
    } catch {
      setIsOnline(false);

      const localCalcs = localStorage.getItem('p2p_simulations');
      if (localCalcs) setHistory(JSON.parse(localCalcs));

      const localLogs = localStorage.getItem('p2p_logs');
      const parsedLogs = localLogs ? JSON.parse(localLogs) : [];
      setLogs(parsedLogs);

      const localWallets = localStorage.getItem('p2p_wallets');
      const parsedWallets = localWallets ? JSON.parse(localWallets) : [];
      setWallets(parsedWallets);

      const localTransactions = localStorage.getItem('p2p_transactions');
      const parsedTxs = localTransactions ? JSON.parse(localTransactions) : [];
      setTransactions(parsedTxs);

      await syncAllHistoricalTransactionsToLogbook(parsedTxs, parsedLogs, parsedWallets, tasaBcv);

      const finalLocalLogs = localStorage.getItem('p2p_logs');
      if (finalLocalLogs) setLogs(JSON.parse(finalLocalLogs));
    }
  };

  useEffect(() => {
    fetchVersion().then(v => { if (v) setCurrentVersion(v); }).catch(() => {});
    checkUpdate().then(info => {
      if (info?.update_available) setUpdateInfo(info);
    }).catch(() => {});
  }, []);

  return {
    isOnline,
    history,
    logs,
    setLogs,
    wallets,
    setWallets,
    transactions,
    setTransactions,
    currentVersion,
    updateInfo,
    setUpdateInfo,
    loadData,
    syncAllHistoricalTransactionsToLogbook,
    amountToUsdt,
  };
}
