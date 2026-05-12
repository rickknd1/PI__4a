import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Functional HTTP interceptor — registered via `withInterceptors([...])` in
 * `app.config.ts` rather than the legacy `HTTP_INTERCEPTORS` token. The
 * functional form is the only one guaranteed to run reliably for HttpClient
 * calls made from standalone components in Angular 18+.
 *
 * Responsibilities:
 *   - Always set `withCredentials: true` so the browser ATTACHES the JWT
 *     cookie on same-origin calls (and ACCEPTS the Set-Cookie response).
 *   - On non-public URLs, also attach `Authorization: Bearer <jwt>` so the
 *     SPA still has a working session over cross-origin XHR (where a
 *     SameSite=Lax cookie would not be sent — e.g. localhost:4200 calling
 *     localhost:8084).
 */
/**
 * Hosts of third-party APIs the SPA calls directly from the browser. We
 * MUST NOT send our JWT or `withCredentials:true` to them — both would
 * trigger a CORS preflight that those public services don't whitelist
 * (Nominatim's `Access-Control-Allow-Origin: *` is incompatible with
 * credentials), and leaking our Bearer to a third-party host is also bad
 * hygiene.
 */
const EXTERNAL_HOSTS = [
  'nominatim.openstreetmap.org',
  'tile.openstreetmap.org',
];

function isExternal(url: string): boolean {
  try {
    // Absolute URL — check the host directly.
    const u = new URL(url, typeof location !== 'undefined' ? location.href : 'http://localhost');
    return EXTERNAL_HOSTS.some(h => u.host.endsWith(h));
  } catch {
    return false;
  }
}

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  // Third-party URLs: pass straight through with no token, no credentials.
  if (isExternal(req.url)) {
    return next(req);
  }

  // Read the token directly from localStorage to avoid any DI / instance
  // mismatch between AuthService and the interceptor.
  let token: string | null = null;
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem('currentUser')
      : null;
    if (raw) token = JSON.parse(raw)?.token ?? null;
  } catch {
    token = null;
  }

  const isPublic =
    req.url.includes('/api/auth/') ||
    req.url.endsWith('/users') ||
    req.url.includes('/users?');

  const headers: Record<string, string> = {};
  if (token && !isPublic) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const newReq = req.clone({
    withCredentials: true,
    setHeaders: headers
  });

  if (!isPublic) {
    // eslint-disable-next-line no-console
    console.log('[JwtInterceptor]', req.method, req.url,
      token ? `→ Bearer attached (${token.substring(0, 20)}...)`
            : '→ NO TOKEN (localStorage.currentUser.token is null)');
  }

  return next(newReq);
};
