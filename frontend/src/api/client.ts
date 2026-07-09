const isDev = import.meta.env.DEV;
export const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? 'http://localhost:8000/api' : '/api');

declare global {
  interface Window {
    __P2P_TOKEN__?: string;
  }
}

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

let _authToken: string | null = window.__P2P_TOKEN__ || getStoredToken();

export async function fetchTokenFromServer(): Promise<string | null> {
  if (window.__P2P_TOKEN__) {
    _authToken = window.__P2P_TOKEN__;
    storeToken(_authToken);
    return _authToken;
  }
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

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let headers = { ...options.headers } as Record<string, string>;
  if (_authToken) {
    headers['Authorization'] = `Bearer ${_authToken}`;
  }
  let resp = await fetch(url, { ...options, headers });
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
