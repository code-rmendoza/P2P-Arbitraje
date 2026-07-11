import { API_BASE_URL, authFetch } from './client';

export interface Wallet {
  id?: number;
  name: string;
  platform: string;
  currency: 'USDT' | 'USD' | 'VES';
  balance: number;
  opening_balance: number;
  is_active: boolean;
  color: string;
  created_at?: string;
}

export function normalizeWallets(wallets: Wallet[]): Wallet[] {
  const byIdentity = new Map<string, Wallet>();
  wallets.forEach(wallet => {
    const balance = Number(wallet.balance) || 0;
    const opening_balance = Number(wallet.opening_balance ?? wallet.balance) || 0;
    const normalizedWallet = { ...wallet, balance, opening_balance };
    const key = [wallet.name.trim().toLowerCase(), wallet.platform.trim().toLowerCase(), wallet.currency].join('|');
    byIdentity.set(key, { ...byIdentity.get(key), ...normalizedWallet });
  });
  return Array.from(byIdentity.values());
}

export async function fetchWallets(): Promise<Wallet[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/wallets/`);
    if (!response.ok) throw new Error('Error al obtener billeteras del servidor');
    const serverWallets: Wallet[] = await response.json();
    const normalizedServer = normalizeWallets(serverWallets);
    localStorage.setItem('p2p_wallets', JSON.stringify(normalizedServer));
    return normalizedServer;
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_wallets');
    if (!local) {
      localStorage.setItem('p2p_wallets', JSON.stringify([]));
      return [];
    }
    const normalized = normalizeWallets(JSON.parse(local));
    localStorage.setItem('p2p_wallets', JSON.stringify(normalized));
    return normalized;
  }
}

export async function saveWallet(input: Omit<Wallet, 'id' | 'created_at'> & { id?: number }): Promise<Wallet> {
  try {
    const method = input.id ? 'PUT' : 'POST';
    const url = input.id ? `${API_BASE_URL}/wallets/${input.id}/` : `${API_BASE_URL}/wallets/`;
    const response = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.non_field_errors?.[0] || errData.error || 'Error al guardar billetera en el servidor';
      throw new Error(msg);
    }
    const saved: Wallet = await response.json();
    return {
      ...saved,
      balance: Number(saved.balance) || 0,
      opening_balance: Number(saved.opening_balance ?? saved.balance) || 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_wallets');
    const list: Wallet[] = local ? normalizeWallets(JSON.parse(local)) : [];
    let finalWallet: Wallet;

    if (input.id) {
      const idx = list.findIndex(w => w.id === input.id);
      if (idx !== -1) {
        finalWallet = {
          ...list[idx],
          ...input,
          balance: Number(input.balance) || 0,
          opening_balance: Number(input.opening_balance ?? input.balance) || 0,
        };
        list[idx] = finalWallet;
      } else {
        throw new Error('Billetera no encontrada');
      }
    } else {
      const duplicateIdx = list.findIndex(w =>
        w.name.trim().toLowerCase() === input.name.trim().toLowerCase() &&
        w.platform.trim().toLowerCase() === input.platform.trim().toLowerCase() &&
        w.currency === input.currency
      );

      if (duplicateIdx !== -1) {
        finalWallet = {
          ...list[duplicateIdx], ...input,
          id: list[duplicateIdx].id,
          created_at: list[duplicateIdx].created_at,
          balance: Number(input.balance) || 0,
          opening_balance: Number(input.opening_balance ?? input.balance) || 0,
        };
        list[duplicateIdx] = finalWallet;
        localStorage.setItem('p2p_wallets', JSON.stringify(list));
        return finalWallet;
      }

      finalWallet = {
        id: Date.now(), ...input,
        balance: Number(input.balance) || 0,
        opening_balance: Number(input.opening_balance ?? input.balance) || 0,
        created_at: new Date().toISOString(),
      };
      list.push(finalWallet);
    }
    localStorage.setItem('p2p_wallets', JSON.stringify(list));
    return finalWallet;
  }
}

export async function deleteWallet(id: number): Promise<void> {
  try {
    const response = await authFetch(`${API_BASE_URL}/wallets/${id}/`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error al eliminar billetera del servidor');
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_wallets');
    if (local) {
      const list: Wallet[] = JSON.parse(local);
      localStorage.setItem('p2p_wallets', JSON.stringify(list.filter(w => w.id !== id)));
    }
  }
}
