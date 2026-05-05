let cachedGateway: string | null = null;
let cachedVem: string | null = null;

export function getGatewayBase(): string {
  if (cachedGateway !== null) return cachedGateway;
  const host = window.location.hostname;
  cachedGateway = (host === 'localhost' || host === '127.0.0.1')
    ? 'http://localhost:8084'
    : `http://${host}:8084`;
  return cachedGateway;
}

export function getVemBaseUrl(): string {
  if (cachedVem !== null) return cachedVem;
  const host = window.location.hostname;
  cachedVem = (host === 'localhost' || host === '127.0.0.1')
    ? 'http://localhost:8086'
    : `http://${host}:8086`;
  return cachedVem;
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getGatewayBase().replace(/\/$/, '')}${p}`;
}
