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
import { API_BASE_URL, authFetch } from '../api/client';

import { amountToUsdt } from '../utils/currency';

export function useAppData() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [history, setHistory] = useState<SavedCalculation[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const syncLock = useRef(false);

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
      let dataCalculations = await fetchCalculations();
      let dataLogs = await fetchLogs();
      let dataWallets = await fetchWallets();
      let dataTransactions = await fetchTransactions();

      const localWalletsStr = localStorage.getItem('p2p_wallets');
      const localTxsStr = localStorage.getItem('p2p_transactions');
      const localLogsStr = localStorage.getItem('p2p_logs');
      const localCalcsStr = localStorage.getItem('p2p_simulations');

      const localWallets: Wallet[] = localWalletsStr ? JSON.parse(localWalletsStr) : [];
      const localTxs: Transaction[] = localTxsStr ? JSON.parse(localTxsStr) : [];
      const localLogs: DailyLog[] = localLogsStr ? JSON.parse(localLogsStr) : [];
      const localCalcs: SavedCalculation[] = localCalcsStr ? JSON.parse(localCalcsStr) : [];

      if (dataWallets.length === 0 && localWallets.length > 0) {
        const idMap = new Map<number, number>();

        // Step A: Migrate Wallets
        for (const wallet of localWallets) {
          const initialBalance = localTxs.length > 0 ? (wallet.opening_balance ?? wallet.balance) : wallet.balance;
          const createResp = await authFetch(`${API_BASE_URL}/wallets/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: wallet.name,
              platform: wallet.platform,
              currency: wallet.currency,
              balance: initialBalance,
              opening_balance: wallet.opening_balance ?? wallet.balance,
              is_active: wallet.is_active,
              color: wallet.color,
            }),
          });
          if (createResp.ok) {
            const created: Wallet = await createResp.json();
            if (wallet.id && created.id) {
              idMap.set(wallet.id, created.id);
            }
          }
        }

        // Step B: Migrate Transactions (chronological order)
        const sortedTxs = [...localTxs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        for (const tx of sortedTxs) {
          const mappedFrom = tx.wallet_from ? idMap.get(tx.wallet_from) : null;
          const mappedTo = tx.wallet_to ? idMap.get(tx.wallet_to) : null;

          await authFetch(`${API_BASE_URL}/transactions/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: tx.date,
              type: tx.type,
              wallet_from: mappedFrom,
              wallet_to: mappedTo,
              amount_out: tx.amount_out,
              amount_in: tx.amount_in,
              rate: tx.rate,
              commission_pct: tx.commission_pct,
              notes: tx.notes,
            }),
          });
        }

        // Step C: Migrate custom Logs (excluding auto-created ones)
        const customLogs = localLogs.filter(log => !log.notes.includes('[Auto-Transaccion #'));
        for (const log of customLogs) {
          await authFetch(`${API_BASE_URL}/logs/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              date: log.date,
              profit: log.profit,
              volume: log.volume,
              notes: log.notes,
              imported: log.imported,
              tipo_operativa: log.tipo_operativa,
              plataforma_compra: log.plataforma_compra,
              plataforma_venta: log.plataforma_venta,
              comision_compra: log.comision_compra,
              comision_venta: log.comision_venta,
              metodo_compra: log.metodo_compra,
              metodo_venta: log.metodo_venta,
            }),
          });
        }

        // Step D: Migrate Calculations/Simulations
        for (const calc of localCalcs) {
          await authFetch(`${API_BASE_URL}/history/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              label: calc.label,
              capital: calc.capital,
              tipo_operativa: calc.tipo_operativa,
              plataforma_compra: calc.plataforma_compra,
              plataforma_venta: calc.plataforma_venta,
              comision_compra: calc.comision_compra,
              comision_venta: calc.comision_venta,
              metodo_compra: calc.metodo_compra,
              metodo_venta: calc.metodo_venta,
              tasa_venta: calc.tasa_venta,
              tasa_compra: calc.tasa_compra,
              tasa_retorno: calc.tasa_retorno,
              ciclos_dia: calc.ciclos_dia,
              metodos_pago: calc.metodos_pago,
            }),
          });
        }

        // Fetch everything again to get clean server state
        dataCalculations = await fetchCalculations();
        dataLogs = await fetchLogs();
        dataWallets = await fetchWallets();
        dataTransactions = await fetchTransactions();
      }

      setHistory(dataCalculations);
      setLogs(dataLogs);
      setWallets(dataWallets);
      setTransactions(dataTransactions);

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
