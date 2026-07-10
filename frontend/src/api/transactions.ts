import { API_BASE_URL, authFetch } from './client';
import type { Wallet } from './wallets';

export interface Transaction {
  id?: number;
  date: string;
  type: 'VENTA_P2P' | 'COMPRA_P2P' | 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA';
  wallet_from?: number | null;
  wallet_to?: number | null;
  amount_out: number;
  amount_in: number;
  rate: number;
  commission_pct: number;
  notes: string;
  created_at?: string;
  wallet_from_name?: string | null;
  wallet_to_name?: string | null;
  wallet_from_currency?: string | null;
  wallet_to_currency?: string | null;
  wallet_from_platform?: string | null;
  wallet_to_platform?: string | null;
}

export async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/`);
    if (!response.ok) throw new Error('Error al obtener transacciones del servidor');
    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_transactions');
    return local ? JSON.parse(local) : [];
  }
}

export async function saveTransaction(
  input: Omit<Transaction, 'id' | 'created_at'>,
  tasaBcv: number = 0
): Promise<Transaction> {
  try {
    const response = await authFetch(`${API_BASE_URL}/transactions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, tasa_bcv: tasaBcv }),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al guardar transaccion en el servidor');
    }
    return await response.json();
  } catch (error: any) {
    if (error.message && !error.message.includes('offline') && !error.message.includes('fetch')) {
      throw error;
    }

    const localWallets = localStorage.getItem('p2p_wallets');
    const wallets: Wallet[] = localWallets ? JSON.parse(localWallets) : [];

    if (input.wallet_from && input.amount_out > 0) {
      const walletFrom = wallets.find(w => w.id === input.wallet_from);
      if (walletFrom && walletFrom.balance < input.amount_out) {
        throw new Error(`Saldo insuficiente en '${walletFrom.name}'. Disponible: ${walletFrom.balance} ${walletFrom.currency}.`);
      }
    }

    const updatedWallets = wallets.map(w => {
      let balance = w.balance;
      if (input.wallet_from === w.id) balance -= input.amount_out;
      if (input.wallet_to === w.id) balance += input.amount_in;
      return { ...w, balance };
    });
    localStorage.setItem('p2p_wallets', JSON.stringify(updatedWallets));

    const fromW = wallets.find(w => w.id === input.wallet_from);
    const toW = wallets.find(w => w.id === input.wallet_to);

    const finalTx: Transaction = {
      id: Date.now(),
      ...input,
      created_at: new Date().toISOString(),
      wallet_from_name: fromW ? fromW.name : null,
      wallet_to_name: toW ? toW.name : null,
      wallet_from_currency: fromW ? fromW.currency : null,
      wallet_to_currency: toW ? toW.currency : null,
      wallet_from_platform: fromW ? fromW.platform : null,
      wallet_to_platform: toW ? toW.platform : null,
    };

    const localTxs = localStorage.getItem('p2p_transactions');
    const txs: Transaction[] = localTxs ? JSON.parse(localTxs) : [];
    txs.unshift(finalTx);
    localStorage.setItem('p2p_transactions', JSON.stringify(txs));

    // Handle offline DailyLog creation
    if (input.type === 'COMPRA_P2P' || input.type === 'VENTA_P2P') {
      const amountToUsdtLocal = (amount: number, currency?: string | null) => {
        if (currency === 'USDT' || currency === 'USD') return amount;
        if (currency === 'VES') return tasaBcv > 0 ? amount / tasaBcv : 0;
        return 0;
      };

      const txDateStr = finalTx.date.split('T')[0];
      const fromCurr = fromW?.currency || null;
      const toCurr = toW?.currency || null;

      const vol = fromCurr === 'USDT' || fromCurr === 'USD'
        ? input.amount_out
        : (toCurr === 'USDT' || toCurr === 'USD' ? input.amount_in : amountToUsdtLocal(input.amount_out, fromCurr));

      const inUsdt = amountToUsdtLocal(input.amount_in, toCurr);
      const outUsdt = amountToUsdtLocal(input.amount_out, fromCurr);
      const prof = inUsdt - outUsdt;

      const localLogs = localStorage.getItem('p2p_logs');
      const listLogs = localLogs ? JSON.parse(localLogs) : [];

      const newLog = {
        id: Date.now(),
        date: txDateStr,
        profit: parseFloat(prof.toFixed(4)),
        volume: parseFloat(vol.toFixed(2)),
        notes: `[Auto-Transaccion #${finalTx.id}] Movimiento: ${input.type} | Ruta: ${fromW?.name || 'Externo'} → ${toW?.name || 'Externo'} | Tasa: ${input.rate} | Notas: ${input.notes || ''}`,
        imported: true,
        tipo_operativa: fromCurr === 'VES' || toCurr === 'VES' ? 'VES' : 'USD',
        plataforma_compra: input.type === 'COMPRA_P2P' ? toW?.platform || 'P2P' : fromW?.platform || 'P2P',
        plataforma_venta: input.type === 'VENTA_P2P' ? fromW?.platform || 'P2P' : toW?.platform || 'P2P',
        comision_compra: input.type === 'COMPRA_P2P' ? input.commission_pct : 0,
        comision_venta: input.type === 'VENTA_P2P' ? input.commission_pct : 0,
        metodo_compra: input.type === 'COMPRA_P2P' ? fromW?.name || 'P2P' : toW?.name || 'P2P',
        metodo_venta: input.type === 'VENTA_P2P' ? fromW?.name || 'P2P' : toW?.name || 'P2P',
      };

      listLogs.push(newLog);
      listLogs.sort((a: any, b: any) => b.date.localeCompare(a.date));
      localStorage.setItem('p2p_logs', JSON.stringify(listLogs));
    }

    return finalTx;
  }
}

export async function deleteTransaction(id: number): Promise<void> {
  try {
    const response = await authFetch(`${API_BASE_URL}/transactions/${id}/`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error al eliminar transaccion del servidor');
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const localTxs = localStorage.getItem('p2p_transactions');
    if (localTxs) {
      const txs: Transaction[] = JSON.parse(localTxs);
      const itemToDelete = txs.find(t => t.id === id);
      if (itemToDelete) {
        const localWallets = localStorage.getItem('p2p_wallets');
        const wallets: Wallet[] = localWallets ? JSON.parse(localWallets) : [];
        const updatedWallets = wallets.map(w => {
          let balance = w.balance;
          if (itemToDelete.wallet_from === w.id) balance += itemToDelete.amount_out;
          if (itemToDelete.wallet_to === w.id) balance -= itemToDelete.amount_in;
          return { ...w, balance };
        });
        localStorage.setItem('p2p_wallets', JSON.stringify(updatedWallets));
        localStorage.setItem('p2p_transactions', JSON.stringify(txs.filter(t => t.id !== id)));
        
        // Also delete associated local DailyLog
        const localLogs = localStorage.getItem('p2p_logs');
        if (localLogs) {
          const listLogs = JSON.parse(localLogs);
          const filteredLogs = listLogs.filter((log: any) => !log.notes.includes(`[Auto-Transaccion #${id}]`));
          localStorage.setItem('p2p_logs', JSON.stringify(filteredLogs));
        }
      }
    }
  }
}
