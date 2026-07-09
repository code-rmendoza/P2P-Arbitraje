export interface CalculationInput {
  capital: number;
  tipo_operativa: string; // 'USD', 'VES'
  plataforma_compra: string;
  plataforma_venta: string;
  comision_compra: number; // e.g. 0.35
  comision_venta: number; // e.g. 0.35
  metodo_compra: string;
  metodo_venta: string;
  tasa_venta: number;
  tasa_compra: number;
  tasa_retorno: number;
  ciclos_dia: number;
  metodos_pago: number;
  comision?: number; // Legacy compatibility
}

export interface CalculationResult {
  monto_venta: number;
  monto_compra: number;
  ganancia_porcentaje: number;
  ganancia_ciclo: number;
  ganancia_diaria: number;
  ganancia_mensual: number;
  tasa_minima_compra: number;
}

export interface SavedCalculation extends CalculationInput, CalculationResult {
  id: number;
  label: string;
  created_at: string;
}

const API_BASE_URL = 'http://localhost:8000/api';

const TOKEN_KEY = 'p2p_auth_token';

function getStoredToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function storeToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* quota */ }
}

function clearStoredToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}

let _authToken: string | null = getStoredToken();

async function fetchTokenFromServer(): Promise<string | null> {
  try {
    const resp = await fetch(`${API_BASE_URL}/auth-token/`);
    if (resp.ok) {
      const data = await resp.json();
      const token: string = data.token;
      _authToken = token;
      storeToken(token);
      return token;
    }
  } catch { /* offline */ }
  return null;
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let headers = { ...options.headers } as Record<string, string>;
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  let resp = await fetch(url, { ...options, headers });
  // Auto-refresh token on 401
  if (resp.status === 401 && _authToken) {
    clearStoredToken();
    _authToken = null;
    await fetchTokenFromServer();
    if (_authToken) {
      headers['Authorization'] = `Bearer ${_authToken}`;
      resp = await fetch(url, { ...options, headers });
    }
  }
  return resp;
}

// Unified calculations logic (supports USD and VES)
// DUPLICATED: Also implemented in backend/calculator/views.py:compute_p2p_math
// Keep both in sync if changing formulas. This copy enables offline mode.
export function performLocalCalculations(input: CalculationInput): CalculationResult {
  const K = input.capital;
  const Cb = input.comision_compra / 100;
  const Cs = input.comision_venta / 100;
  const S = input.tasa_venta;
  const B = input.tasa_compra;
  const cycles = input.ciclos_dia;

  if (B <= 0) {
    return {
      monto_venta: 0,
      monto_compra: 0,
      ganancia_porcentaje: 0,
      ganancia_ciclo: 0,
      ganancia_diaria: 0,
      ganancia_mensual: 0,
      tasa_minima_compra: 0,
    };
  }

  const multiplier = (S / B) * (1 - Cb) * (1 - Cs);

  // USDT -> Fiat sold -> USDT bought back
  const monto_venta = K * S * (1 - Cs);
  const monto_compra = monto_venta * (1 - Cb) / B;
  const final_capital = monto_compra;

  const ganancia_ciclo = final_capital - K;
  const ganancia_porcentaje = (multiplier - 1) * 100;
  const ganancia_diaria = ganancia_ciclo * cycles;
  const ganancia_mensual = ganancia_diaria * 30;

  const tasa_minima_compra = S * (1 - Cb) * (1 - Cs);

  return {
    monto_venta,
    monto_compra,
    ganancia_porcentaje,
    ganancia_ciclo,
    ganancia_diaria,
    ganancia_mensual,
    tasa_minima_compra,
  };
}

// Target buy prices calculator (Image 1)
export interface TargetBuyPriceResult {
  percentage: string;
  label: string;
  buyPrice: number;
}

export function calculateTargetBuyPrices(sellingPrice: number, commissionPercent: number, customPercent?: number): TargetBuyPriceResult[] {
  const C = commissionPercent / 100;
  const S = sellingPrice;

  // B = S * (1 - C)^2 / (1 + P)
  const calculateB = (P: number) => S * Math.pow(1 - C, 2) / (1 + P);

  const targets = [
    { percentage: '0.0%', label: 'Breakeven', buyPrice: calculateB(0) },
    { percentage: '0.2%', label: '0.2%', buyPrice: calculateB(0.002) },
    { percentage: '0.5%', label: '0.5%', buyPrice: calculateB(0.005) },
    { percentage: '1.0%', label: '1.0%', buyPrice: calculateB(0.01) },
  ];

  if (customPercent !== undefined) {
    targets.push({
      percentage: `${customPercent}%`,
      label: `% Personalizado`,
      buyPrice: calculateB(customPercent / 100),
    });
  }

  return targets;
}

export async function fetchCalculations(): Promise<SavedCalculation[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/history/`);
    if (!response.ok) throw new Error('Error al obtener historial del servidor');
    return await response.json();
  } catch (error) {
    console.warn('Backend offline, usando almacenamiento local para historial:', error);
    const local = localStorage.getItem('p2p_simulations');
    return local ? JSON.parse(local) : [];
  }
}

export async function saveCalculation(input: CalculationInput & { label: string }): Promise<SavedCalculation> {
  const results = performLocalCalculations(input);
  const newSim: SavedCalculation = {
    id: Date.now(),
    ...input,
    ...results,
    created_at: new Date().toISOString(),
  };

  try {
    const response = await fetch(`${API_BASE_URL}/history/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSim),
    });
    if (!response.ok) throw new Error('Error al guardar simulación en el servidor');
    return await response.json();
  } catch (error) {
    console.warn('Backend offline, guardando simulación localmente:', error);
    const local = localStorage.getItem('p2p_simulations');
    const list: SavedCalculation[] = local ? JSON.parse(local) : [];
    list.unshift(newSim);
    localStorage.setItem('p2p_simulations', JSON.stringify(list));
    return newSim;
  }
}

export async function deleteCalculation(id: number): Promise<void> {
  try {
    const response = await authFetch(`${API_BASE_URL}/history/${id}/`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error al eliminar del servidor');
  } catch (error) {
    console.warn('Backend offline, eliminando simulación localmente:', error);
    const local = localStorage.getItem('p2p_simulations');
    if (local) {
      const list: SavedCalculation[] = JSON.parse(local);
      const filtered = list.filter(item => item.id !== id);
      localStorage.setItem('p2p_simulations', JSON.stringify(filtered));
    }
  }
}

// Daily P2P Logs (Logbook/Bitácora) with Multi-Currency & Platform Support
export interface DailyLog {
  id?: number;
  date: string; // YYYY-MM-DD
  profit: number; // USDT/USD profit
  volume: number; // USDT volume
  imported: boolean;
  notes: string;
  tipo_operativa: string; // 'USD', 'VES'
  plataforma_compra: string;
  plataforma_venta: string;
  comision_compra: number;
  comision_venta: number;
  metodo_compra: string;
  metodo_venta: string;
}

export interface DailyLogInput extends Omit<DailyLog, 'id'> {
  id?: number;
  accumulate?: boolean;
}

export async function fetchLogs(): Promise<DailyLog[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/logs/`);
    if (!response.ok) throw new Error('Error al obtener bitácora del servidor');
    return await response.json();
  } catch (error) {
    console.warn('Backend offline, usando almacenamiento local para bitácora:', error);
    const local = localStorage.getItem('p2p_logs');
    return local ? JSON.parse(local) : [];
  }
}

export async function saveLog(input: DailyLogInput): Promise<DailyLog> {
  try {
    const method = input.id ? 'PUT' : 'POST';
    const url = input.id ? `${API_BASE_URL}/logs/${input.id}/` : `${API_BASE_URL}/logs/`;
    
    const response = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error('Error al guardar registro en el servidor');
    return await response.json();
  } catch (error) {
    console.warn('Backend offline, guardando registro localmente:', error);
    const local = localStorage.getItem('p2p_logs');
    const list: DailyLog[] = local ? JSON.parse(local) : [];
    
    let finalLog: DailyLog;

    if (input.id) {
      // Direct update of an existing operation by ID
      const index = list.findIndex(item => item.id === input.id);
      if (index !== -1) {
        finalLog = { ...input } as DailyLog;
        list[index] = finalLog;
      } else {
        throw new Error('Registro no encontrado para actualización');
      }
    } else {
      // New operation
      if (input.accumulate) {
        // Find if an identical daily operation already exists on this date to accumulate
        const existingIndex = list.findIndex(item => 
          item.date === input.date && 
          item.tipo_operativa === input.tipo_operativa &&
          item.metodo_compra === input.metodo_compra &&
          item.metodo_venta === input.metodo_venta
        );
        
        if (existingIndex !== -1) {
          const existing = list[existingIndex];
          finalLog = {
            id: existing.id,
            date: input.date,
            profit: existing.profit + input.profit,
            volume: existing.volume + input.volume,
            imported: existing.imported || input.imported,
            notes: (existing.notes + "\n" + input.notes).trim(),
            tipo_operativa: input.tipo_operativa,
            plataforma_compra: input.plataforma_compra,
            plataforma_venta: input.plataforma_venta,
            comision_compra: input.comision_compra,
            comision_venta: input.comision_venta,
            metodo_compra: input.metodo_compra,
            metodo_venta: input.metodo_venta
          };
          list[existingIndex] = finalLog;
        } else {
          finalLog = {
            id: Date.now(),
            ...input
          };
          list.push(finalLog);
        }
      } else {
        finalLog = {
          id: Date.now(),
          ...input
        };
        list.push(finalLog);
      }
    }
    
    // Sort logs descending by date
    list.sort((a, b) => b.date.localeCompare(a.date));
    localStorage.setItem('p2p_logs', JSON.stringify(list));
    return finalLog;
  }
}

export async function deleteLog(id: number): Promise<void> {
  try {
    const response = await authFetch(`${API_BASE_URL}/logs/${id}/`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error al eliminar registro del servidor');
  } catch (error) {
    console.warn('Backend offline, eliminando registro localmente:', error);
    const local = localStorage.getItem('p2p_logs');
    if (local) {
      const list: DailyLog[] = JSON.parse(local);
      const filtered = list.filter(item => item.id !== id);
      localStorage.setItem('p2p_logs', JSON.stringify(filtered));
    }
  }
}

// Portfolio Wallets & Transactions
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
  
  // Read-only populated names
  wallet_from_name?: string | null;
  wallet_to_name?: string | null;
  wallet_from_currency?: string | null;
  wallet_to_currency?: string | null;
  wallet_from_platform?: string | null;
  wallet_to_platform?: string | null;
}

function normalizeWallets(wallets: Wallet[]): Wallet[] {
  const byIdentity = new Map<string, Wallet>();

  wallets.forEach(wallet => {
    const normalizedWallet = {
      ...wallet,
      opening_balance: wallet.opening_balance ?? wallet.balance
    };
    const key = [
      wallet.name.trim().toLowerCase(),
      wallet.platform.trim().toLowerCase(),
      wallet.currency
    ].join('|');

    byIdentity.set(key, {
      ...byIdentity.get(key),
      ...normalizedWallet
    });
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
            name: wallet.name,
            platform: wallet.platform,
            currency: wallet.currency,
            balance: wallet.balance,
            opening_balance: wallet.opening_balance ?? wallet.balance,
            is_active: wallet.is_active,
            color: wallet.color
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
    console.warn('Backend offline, usando almacenamiento local para billeteras:', error);
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
    if (!response.ok) throw new Error('Error al guardar billetera en el servidor');
    return await response.json();
  } catch (error) {
    console.warn('Backend offline, guardando billetera localmente:', error);
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
          ...list[duplicateIdx],
          ...input,
          id: list[duplicateIdx].id,
          created_at: list[duplicateIdx].created_at,
          opening_balance: input.opening_balance ?? input.balance
        };
        list[duplicateIdx] = finalWallet;
        localStorage.setItem('p2p_wallets', JSON.stringify(list));
        return finalWallet;
      }

      finalWallet = {
        id: Date.now(),
        ...input,
        opening_balance: input.opening_balance ?? input.balance,
        created_at: new Date().toISOString()
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
    console.warn('Backend offline, eliminando billetera localmente:', error);
    const local = localStorage.getItem('p2p_wallets');
    if (local) {
      const list: Wallet[] = JSON.parse(local);
      const filtered = list.filter(w => w.id !== id);
      localStorage.setItem('p2p_wallets', JSON.stringify(filtered));
    }
  }
}

export async function fetchTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/`);
    if (!response.ok) throw new Error('Error al obtener transacciones del servidor');
    return await response.json();
  } catch (error) {
    console.warn('Backend offline, usando almacenamiento local para transacciones:', error);
    const local = localStorage.getItem('p2p_transactions');
    return local ? JSON.parse(local) : [];
  }
}

export async function saveTransaction(input: Omit<Transaction, 'id' | 'created_at'>): Promise<Transaction> {
  try {
    const response = await fetch(`${API_BASE_URL}/transactions/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Error al guardar transacción en el servidor');
    }
    return await response.json();
  } catch (error: any) {
    if (error.message && !error.message.includes('offline') && !error.message.includes('fetch')) {
      // Rethrow validation errors from server like "sufficient balance"
      throw error;
    }
    
    console.warn('Backend offline, registrando transacción localmente:', error);
    const localWallets = localStorage.getItem('p2p_wallets');
    const wallets: Wallet[] = localWallets ? JSON.parse(localWallets) : [];
    
    // Validate balance offline
    if (input.wallet_from && input.amount_out > 0) {
      const walletFrom = wallets.find(w => w.id === input.wallet_from);
      if (walletFrom && walletFrom.balance < input.amount_out) {
        throw new Error(`Saldo insuficiente en '${walletFrom.name}'. Disponible: ${walletFrom.balance} ${walletFrom.currency}.`);
      }
    }

    // Process balances changes in wallets locally
    const updatedWallets = wallets.map(w => {
      let balance = w.balance;
      if (input.wallet_from === w.id) {
        balance -= input.amount_out;
      }
      if (input.wallet_to === w.id) {
        balance += input.amount_in;
      }
      return { ...w, balance };
    });
    localStorage.setItem('p2p_wallets', JSON.stringify(updatedWallets));

    // Create the transaction
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
      wallet_to_platform: toW ? toW.platform : null
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
    if (!response.ok) throw new Error('Error al eliminar transacción del servidor');
  } catch (error) {
    console.warn('Backend offline, eliminando transacción localmente:', error);
    const localTxs = localStorage.getItem('p2p_transactions');
    if (localTxs) {
      const txs: Transaction[] = JSON.parse(localTxs);
      const itemToDelete = txs.find(t => t.id === id);
      if (itemToDelete) {
        // Reverse balances locally
        const localWallets = localStorage.getItem('p2p_wallets');
        const wallets: Wallet[] = localWallets ? JSON.parse(localWallets) : [];
        
        const updatedWallets = wallets.map(w => {
          let balance = w.balance;
          if (itemToDelete.wallet_from === w.id) {
            balance += itemToDelete.amount_out;
          }
          if (itemToDelete.wallet_to === w.id) {
            balance -= itemToDelete.amount_in;
          }
          return { ...w, balance };
        });
        localStorage.setItem('p2p_wallets', JSON.stringify(updatedWallets));
        
        // Remove transaction
        const filtered = txs.filter(t => t.id !== id);
        localStorage.setItem('p2p_transactions', JSON.stringify(filtered));
      }
    }
  }
}

export async function fetchBcvRate(): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/bcv-rate/`);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al obtener la tasa del BCV');
  }
  const data = await response.json();
  return data.rate;
}

export async function resetDatabase(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/reset-db/`, { method: 'POST' });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al restablecer la base de datos');
  }
}

export interface UpdateInfo {
  update_available: boolean;
  current_version: string;
  latest_version: string;
  download_url: string | null;
  release_url?: string;
  rate_limited?: boolean;
}

export async function checkUpdate(): Promise<UpdateInfo | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/update-check/`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function applyUpdate(): Promise<{ success: boolean; message: string; new_version: string } | null> {
  try {
    const response = await authFetch(`${API_BASE_URL}/update-apply/`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export async function fetchAuthToken(): Promise<string | null> {
  return await fetchTokenFromServer();
}

export async function resetDatabaseSecure(): Promise<void> {
  const resp = await authFetch(`${API_BASE_URL}/reset-db/`, { method: 'POST' });
  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al restablecer la base de datos');
  }
}
