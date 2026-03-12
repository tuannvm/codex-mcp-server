/**
 * Simple HMAC-SHA256 token auth for the dashboard.
 * Env vars: DASHBOARD_PASSWORD, AUTH_SECRET
 */

function getEnv(key: string): string {
  // Netlify Functions expose env via process.env
  return process.env[key] || '';
}

async function getKey(): Promise<CryptoKey> {
  const secret = getEnv('AUTH_SECRET');
  if (!secret) throw new Error('AUTH_SECRET env var not set');
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Create a signed token with 7-day expiry */
export async function createToken(): Promise<string> {
  const key = await getKey();
  const payload = JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const enc = new TextEncoder();
  const payloadB64 = toBase64Url(enc.encode(payload));
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  const sigB64 = toBase64Url(sig);
  return `${payloadB64}.${sigB64}`;
}

/** Verify a Bearer token from the Authorization header */
export async function verifyAuth(req: Request): Promise<boolean> {
  const authSecret = getEnv('AUTH_SECRET');
  if (!authSecret) return true; // If no secret configured, skip auth (dev mode)

  const header = req.headers.get('Authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token || !token.includes('.')) return false;

  try {
    const [payloadB64, sigB64] = token.split('.');
    const key = await getKey();
    const enc = new TextEncoder();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(sigB64),
      enc.encode(payloadB64),
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadB64)));
    if (!payload.exp || payload.exp < Date.now()) return false;

    return true;
  } catch {
    return false;
  }
}

/** Standard 401 response */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
