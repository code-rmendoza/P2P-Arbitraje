import { API_BASE_URL, authFetch, formatServerError } from './client';
import type { Wallet } from './wallets';

export interface Transaction {
  id?: number;
  date: string;
  type: 'VENTA_P2P' | 'COMPRA_P2P' | 'DEPOSITO' | 'RETIRO' | 'TRANSFERENCIA' | 'GASTO' | 'INGRESO_EXTERNO';
  wallet_from?: number | null;
  wallet_to?: number | null;
  amount_out: number;
  amount_in: number;
  rate: number;
  commission_pct: number;
  category?: string | null;
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
    const response = await authFetch(`${API_BASE_URL}/transactions/`);
    if (!response.ok) throw new Error('Error al obtener transacciones del servidor');
    const data: Transaction[] = await response.json();
    const normalized = data.map(tx => ({
      ...tx,
      amount_out: Number(tx.amount_out) || 0,
      amount_in: Number(tx.amount_in) || 0,
      rate: Number(tx.rate) || 0,
      commission_pct: Number(tx.commission_pct) || 0,
    }));
    localStorage.setItem('p2p_transactions', JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_transactions');
    const data: Transaction[] = local ? JSON.parse(local) : [];
    return data.map(tx => ({
      ...tx,
      amount_out: Number(tx.amount_out) || 0,
      amount_in: Number(tx.amount_in) || 0,
      rate: Number(tx.rate) || 0,
      commission_pct: Number(tx.commission_pct) || 0,
    }));
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
      throw new Error(formatServerError(errData, 'Error al guardar transaccion en el servidor'));
    }
    const saved: Transaction = await response.json();
    return {
      ...saved,
      amount_out: Number(saved.amount_out) || 0,
      amount_in: Number(saved.amount_in) || 0,
      rate: Number(saved.rate) || 0,
      commission_pct: Number(saved.commission_pct) || 0,
    };
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
        

      }
    }
  }
}
