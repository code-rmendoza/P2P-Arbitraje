import { API_BASE_URL, authFetch, fetchTokenFromServer } from './client';

export async function fetchBcvRate(): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/bcv-rate/`);
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Error al obtener la tasa del BCV');
  }
  const data = await response.json();
  return data.rate;
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

export async function fetchVersion(): Promise<string | null> {
  try {
    const resp = await authFetch(`${API_BASE_URL}/version/`);
    if (resp.ok) {
      const data = await resp.json();
      return data.version || null;
    }
  } catch { /* offline */ }
  return null;
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

export interface UpdateProgress {
  status: 'idle' | 'downloading' | 'verifying' | 'extracting' | 'ready' | 'error';
  progress: number;
  error_message: string | null;
}

export async function getUpdateProgress(): Promise<UpdateProgress | null> {
  try {
    const response = await authFetch(`${API_BASE_URL}/update-progress/`);
    if (!response.ok) return null;
    return await response.json();
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
