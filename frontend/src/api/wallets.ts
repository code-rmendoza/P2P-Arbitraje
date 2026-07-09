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
    const normalizedWallet = { ...wallet, opening_balance: wallet.opening_balance ?? wallet.balance };
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
    const local = localStorage.getItem('p2p_wallets');

    if (serverWallets.length === 0 && local) {
      const localWallets = normalizeWallets(JSON.parse(local));
      const migratedWallets: Wallet[] = [];
      for (const wallet of localWallets) {
        const createResponse = await fetch(`${API_BASE_URL}/wallets/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: wallet.name, platform: wallet.platform, currency: wallet.currency,
            balance: wallet.balance, opening_balance: wallet.opening_balance ?? wallet.balance,
            is_active: wallet.is_active, color: wallet.color,
          }),
        });
        if (!createResponse.ok) throw new Error('Error al migrar billeteras locales al servidor');
        migratedWallets.push(await createResponse.json());
      }
      localStorage.setItem('p2p_wallets', JSON.stringify(migratedWallets));
      return migratedWallets;
    }

    return serverWallets;
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
    return await response.json();
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
        finalWallet = { ...list[idx], ...input };
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
          opening_balance: input.opening_balance ?? input.balance,
        };
        list[duplicateIdx] = finalWallet;
        localStorage.setItem('p2p_wallets', JSON.stringify(list));
        return finalWallet;
      }

      finalWallet = {
        id: Date.now(), ...input,
        opening_balance: input.opening_balance ?? input.balance,
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
