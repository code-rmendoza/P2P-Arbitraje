import { API_BASE_URL, authFetch } from './client';

export interface CalculationInput {
  capital: number;
  tipo_operativa: string;
  plataforma_compra: string;
  plataforma_venta: string;
  comision_compra: number;
  comision_venta: number;
  metodo_compra: string;
  metodo_venta: string;
  tasa_venta: number;
  tasa_compra: number;
  tasa_retorno: number;
  ciclos_dia: number;
  metodos_pago: number;
  comision?: number;
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

export interface TargetBuyPriceResult {
  percentage: string;
  label: string;
  buyPrice: number;
}

export function calculateTargetBuyPrices(sellingPrice: number, commissionPercent: number, customPercent?: number): TargetBuyPriceResult[] {
  const C = commissionPercent / 100;
  const S = sellingPrice;
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
      label: '% Personalizado',
      buyPrice: calculateB(customPercent / 100),
    });
  }

  return targets;
}

export async function fetchCalculations(): Promise<SavedCalculation[]> {
  try {
    const response = await authFetch(`${API_BASE_URL}/history/`);
    if (!response.ok) throw new Error('Error al obtener historial del servidor');
    const data: SavedCalculation[] = await response.json();
    const normalized = data.map(c => ({
      ...c,
      capital: Number(c.capital) || 0,
      comision_compra: Number(c.comision_compra) || 0,
      comision_venta: Number(c.comision_venta) || 0,
      tasa_venta: Number(c.tasa_venta) || 0,
      tasa_compra: Number(c.tasa_compra) || 0,
      tasa_retorno: Number(c.tasa_retorno) || 0,
      ciclos_dia: Number(c.ciclos_dia) || 0,
      metodos_pago: Number(c.metodos_pago) || 0,
      monto_venta: Number(c.monto_venta) || 0,
      monto_compra: Number(c.monto_compra) || 0,
      ganancia_porcentaje: Number(c.ganancia_porcentaje) || 0,
      ganancia_ciclo: Number(c.ganancia_ciclo) || 0,
      ganancia_diaria: Number(c.ganancia_diaria) || 0,
      ganancia_mensual: Number(c.ganancia_mensual) || 0,
      tasa_minima_compra: Number(c.tasa_minima_compra) || 0,
    }));
    localStorage.setItem('p2p_simulations', JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_simulations');
    const data: SavedCalculation[] = local ? JSON.parse(local) : [];
    return data.map(c => ({
      ...c,
      capital: Number(c.capital) || 0,
      comision_compra: Number(c.comision_compra) || 0,
      comision_venta: Number(c.comision_venta) || 0,
      tasa_venta: Number(c.tasa_venta) || 0,
      tasa_compra: Number(c.tasa_compra) || 0,
      tasa_retorno: Number(c.tasa_retorno) || 0,
      ciclos_dia: Number(c.ciclos_dia) || 0,
      metodos_pago: Number(c.metodos_pago) || 0,
      monto_venta: Number(c.monto_venta) || 0,
      monto_compra: Number(c.monto_compra) || 0,
      ganancia_porcentaje: Number(c.ganancia_porcentaje) || 0,
      ganancia_ciclo: Number(c.ganancia_ciclo) || 0,
      ganancia_diaria: Number(c.ganancia_diaria) || 0,
      ganancia_mensual: Number(c.ganancia_mensual) || 0,
      tasa_minima_compra: Number(c.tasa_minima_compra) || 0,
    }));
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
    const response = await authFetch(`${API_BASE_URL}/history/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSim),
    });
    if (!response.ok) throw new Error('Error al guardar simulacion en el servidor');
    const saved: SavedCalculation = await response.json();
    return {
      ...saved,
      capital: Number(saved.capital) || 0,
      comision_compra: Number(saved.comision_compra) || 0,
      comision_venta: Number(saved.comision_venta) || 0,
      tasa_venta: Number(saved.tasa_venta) || 0,
      tasa_compra: Number(saved.tasa_compra) || 0,
      tasa_retorno: Number(saved.tasa_retorno) || 0,
      ciclos_dia: Number(saved.ciclos_dia) || 0,
      metodos_pago: Number(saved.metodos_pago) || 0,
      monto_venta: Number(saved.monto_venta) || 0,
      monto_compra: Number(saved.monto_compra) || 0,
      ganancia_porcentaje: Number(saved.ganancia_porcentaje) || 0,
      ganancia_ciclo: Number(saved.ganancia_ciclo) || 0,
      ganancia_diaria: Number(saved.ganancia_diaria) || 0,
      ganancia_mensual: Number(saved.ganancia_mensual) || 0,
      tasa_minima_compra: Number(saved.tasa_minima_compra) || 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
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
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_simulations');
    if (local) {
      const list: SavedCalculation[] = JSON.parse(local);
      localStorage.setItem('p2p_simulations', JSON.stringify(list.filter(item => item.id !== id)));
    }
  }
}
