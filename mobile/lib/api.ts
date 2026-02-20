const API_URL = (typeof process !== 'undefined' && (process as any).env?.EXPO_PUBLIC_API_URL) || 'https://digitproperties.com';

export function getApiUrl(path: string, params?: Record<string, string>): string {
  const base = `${API_URL.replace(/\/$/, '')}/api/${path.replace(/^\//, '')}`;
  if (!params || Object.keys(params).length === 0) return base;
  const search = new URLSearchParams(params).toString();
  return `${base}?${search}`;
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null; params?: Record<string, string> } = {}
): Promise<Response> {
  const { token, params, ...init } = options;
  const url = getApiUrl(path, params);
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export { API_URL };
