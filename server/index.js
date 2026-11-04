import { handleProgressAPI } from './progress-api.js';
import { handleSocialAuth } from './social-auth.js';

export default {
  async fetch(request, env) {
    const auth = await handleSocialAuth(request, env);
    if (auth) return auth;
    const response = await handleProgressAPI(request, env);
    if (response) return response;
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (!env.ASSETS) return new Response('Game assets unavailable', { status: 503 });
    const asset = await env.ASSETS.fetch(request);
    if (asset.ok && request.method === 'GET' && ['/', '/index.html'].includes(url.pathname)) {
      const html = (await asset.text()).replace('</head>', '<meta name="slugterra-account-service" content="1"></head>');
      return new Response(html, { status: asset.status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' } });
    }
    return asset;
  },
};
