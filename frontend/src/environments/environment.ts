let cachedGateway: string | null = null;
let cachedVem: string | null = null;

export function getGatewayBase(): string {
  if (cachedGateway !== null) return cachedGateway;
  const host = window.location.hostname;
  // En local dev → :8084 direct. En prod (tunnel/Ingress K8s) → URL relative (passe par Ingress nginx)
  cachedGateway = (host === 'localhost' || host === '127.0.0.1')
    ? 'http://localhost:8084'
    : '';
  return cachedGateway;
}

export function getVemBaseUrl(): string {
  if (cachedVem !== null) return cachedVem;
  const host = window.location.hostname;
  cachedVem = (host === 'localhost' || host === '127.0.0.1')
    ? 'http://localhost:8086'
    : '';
  return cachedVem;
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getGatewayBase().replace(/\/$/, '')}${p}`;
}

// Supabase config (consume au runtime — clés a renseigner via build env si upload de photos de groupe utilise)
// SECURITE: supabaseServiceRoleKey ne doit PAS contenir une vraie clé service_role en prod
//           — le frontend serait exposé. Utiliser anon key + RLS, ou bouger l'upload côté backend.
export const environment = {
  production: false,
  supabaseUrl: '',
  supabaseServiceRoleKey: '',
};
