import { API_BASE_URL, authFetch } from './client';

export interface DailyLog {
  id?: number;
  date: string;
  profit: number;
  volume: number;
  imported: boolean;
  notes: string;
  tipo_operativa: string;
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
    if (!response.ok) throw new Error('Error al obtener bitacora del servidor');
    const data: DailyLog[] = await response.json();
    const normalized = data.map(log => ({
      ...log,
      profit: Number(log.profit) || 0,
      volume: Number(log.volume) || 0,
      comision_compra: Number(log.comision_compra) || 0,
      comision_venta: Number(log.comision_venta) || 0,
    }));
    localStorage.setItem('p2p_logs', JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_logs');
    const data: DailyLog[] = local ? JSON.parse(local) : [];
    return data.map(log => ({
      ...log,
      profit: Number(log.profit) || 0,
      volume: Number(log.volume) || 0,
      comision_compra: Number(log.comision_compra) || 0,
      comision_venta: Number(log.comision_venta) || 0,
    }));
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
    const saved: DailyLog = await response.json();
    return {
      ...saved,
      profit: Number(saved.profit) || 0,
      volume: Number(saved.volume) || 0,
      comision_compra: Number(saved.comision_compra) || 0,
      comision_venta: Number(saved.comision_venta) || 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_logs');
    const list: DailyLog[] = local ? JSON.parse(local) : [];
    let finalLog: DailyLog;

    if (input.id) {
      const index = list.findIndex(item => item.id === input.id);
      if (index !== -1) {
        finalLog = { ...input } as DailyLog;
        list[index] = finalLog;
      } else {
        throw new Error('Registro no encontrado para actualizacion');
      }
    } else {
      if (input.accumulate) {
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
            notes: (existing.notes + '\n' + input.notes).trim(),
            tipo_operativa: input.tipo_operativa,
            plataforma_compra: input.plataforma_compra,
            plataforma_venta: input.plataforma_venta,
            comision_compra: input.comision_compra,
            comision_venta: input.comision_venta,
            metodo_compra: input.metodo_compra,
            metodo_venta: input.metodo_venta,
          };
          list[existingIndex] = finalLog;
        } else {
          finalLog = { id: Date.now(), ...input };
          list.push(finalLog);
        }
      } else {
        finalLog = { id: Date.now(), ...input };
        list.push(finalLog);
      }
    }

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
    if (error instanceof Error && error.name !== 'TypeError') {
      throw error;
    }
    const local = localStorage.getItem('p2p_logs');
    if (local) {
      const list: DailyLog[] = JSON.parse(local);
      localStorage.setItem('p2p_logs', JSON.stringify(list.filter(item => item.id !== id)));
    }
  }
}
