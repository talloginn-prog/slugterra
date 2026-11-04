import { Auth, skipCSRFCheck, customFetch } from '@auth/core';
import { getToken } from '@auth/core/jwt';
import Google from '@auth/core/providers/google';
import MicrosoftEntraID from '@auth/core/providers/microsoft-entra-id';

export const SITE_ORIGIN = 'https://slugterra-cavern-expeditions.talloginn.chatgpt.site';
export const AUTH_MAX_AGE = 30 * 24 * 60 * 60;
const validTenant = value => /^(?:common|organizations|consumers|[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12})$/i.test(value || 'common');

export function configuredProviders(env) {
  const sessions = typeof env.AUTH_SECRET === 'string' && env.AUTH_SECRET.length >= 32;
  return { google: Boolean(sessions && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), microsoft: Boolean(sessions && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET && validTenant(env.MICROSOFT_TENANT_ID)) };
}

export function authConfig(env, { providerFetch } = {}) {
  const available = configuredProviders(env), providers = [];
  if (available.google) providers.push(Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, checks: ['pkce', 'state', 'nonce'], authorization: { params: { scope: 'openid email profile' } } }));
  const tenant = env.MICROSOFT_TENANT_ID || 'common';
  if (available.microsoft) providers.push(MicrosoftEntraID({
    clientId: env.MICROSOFT_CLIENT_ID, clientSecret: env.MICROSOFT_CLIENT_SECRET, issuer: `https://login.microsoftonline.com/${tenant}/v2.0`, checks: ['pkce', 'state', 'nonce'],
    authorization: { params: { scope: 'openid profile email' } },
    client: { token_endpoint_auth_method: 'client_secret_post' },
    profile: profile => ({ id: profile.sub, name: profile.name || profile.email || 'Slugslinger', email: profile.email || null, image: null }),
  }));
  if (providerFetch) for (const provider of providers) { provider[customFetch] = providerFetch; provider.options[customFetch] = providerFetch; }
  return {
    secret: env.AUTH_SECRET, basePath: '/auth', trustHost: true, providers,
    session: { strategy: 'jwt', maxAge: AUTH_MAX_AGE },
    pages: { error: '/?account=error', signIn: '/?account=signin' },
    callbacks: {
      jwt({ token, account, profile }) {
        if (account) { token.sub = `${account.provider}:${account.providerAccountId}`; token.provider = account.provider; token.name = profile?.name || token.name || 'Slugslinger'; }
        return token;
      },
      session({ session, token }) { session.user = { id: token.sub, name: token.name || 'Slugslinger', provider: token.provider }; return session; },
      redirect({ url, baseUrl }) { try { const target = new URL(url, baseUrl); return target.origin === new URL(baseUrl).origin ? target.href : baseUrl; } catch { return baseUrl; } },
    },
    logger: { error(error) { console.warn('Sign-in failed:', error.type || 'AuthenticationError'); }, warn(code) { console.warn('Sign-in warning:', code); }, debug() {} },
  };
}

export async function getSocialAccount(request, env) {
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) return null;
  const secure = new URL(request.url).protocol === 'https:';
  const token = await getToken({ req: { headers: { cookie: request.headers.get('cookie') || '' } }, secret: env.AUTH_SECRET, secureCookie: secure });
  if (!token?.sub || !['google', 'microsoft-entra-id'].includes(token.provider) || !token.sub.startsWith(`${token.provider}:`)) return null;
  return { id: token.sub, name: typeof token.name === 'string' ? token.name : 'Slugslinger', provider: token.provider };
}

const unavailable = () => new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>Sign-in unavailable</title><body style="background:#08252b;color:#d5fff3;font:18px system-ui;padding:10%"><h1>Sign-in is not available yet.</h1><p>Your journey still saves on this device.</p><a style="color:#ffc58d" href="/">Return to Slugterra</a></body></html>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
const runAuth = async (request, config) => { const response = await Auth(request, config), headers = new Headers(response.headers); headers.set('Cache-Control', 'private, no-store'); headers.set('Referrer-Policy', 'same-origin'); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); };

/** Auth.js owns PKCE/state/nonce, provider callbacks, token validation and encrypted cookies. */
export async function handleSocialAuth(request, env, options) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/auth/') && !url.pathname.startsWith('/login/')) return null;
  // Production redirects always use the published host. Loopback is only for local QA.
  if (url.origin !== SITE_ORIGIN && !['127.0.0.1', 'localhost'].includes(url.hostname)) return new Response('Unknown sign-in host', { status: 400 });
  const config = authConfig(env, options), providers = configuredProviders(env);
  const selected = { '/login/google': 'google', '/login/microsoft': 'microsoft-entra-id' }[url.pathname];
  if (selected) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    if (!(selected === 'google' ? providers.google : providers.microsoft)) return unavailable();
    // Only this internal initiation bypasses Auth.js form-CSRF checks. The resulting
    // OAuth exchange still validates state, nonce and the browser-bound PKCE verifier.
    return runAuth(new Request(`${url.origin}/auth/signin/${selected}`, { method: 'POST', headers: { cookie: request.headers.get('cookie') || '', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ callbackUrl: `${url.origin}/` }) }), { ...config, skipCSRFCheck });
  }
  if (url.pathname === '/login/signout') {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    if (request.headers.get('Origin') !== url.origin) return new Response('Invalid sign-out origin', { status: 403 });
    if (!env.AUTH_SECRET) return unavailable();
    return runAuth(new Request(`${url.origin}/auth/signout`, { method: 'POST', headers: { cookie: request.headers.get('cookie') || '', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ callbackUrl: `${url.origin}/` }) }), { ...config, skipCSRFCheck });
  }
  if (!url.pathname.startsWith('/auth/')) return new Response('Not found', { status: 404 });
  if (!env.AUTH_SECRET) return unavailable();
  return runAuth(request, config);
}
