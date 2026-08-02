// ── Offline shell for the B Dance studio app ──────────────────────────────────────────────────
// The whole app is one big index.html fetched fresh on every reload. That means a flaky moment on
// the counter's iPad — a dropped WiFi frame, a captive portal, a request that reaches Netlify too
// garbled to be matched to a site — locks the front desk out of the app entirely, usually showing
// Netlify's own "Site not found" page.
//
// Strategy: NETWORK FIRST, cache only as the safety net.
//   online  → always the freshest deploy, so a drag-and-drop upload shows up on the next reload
//             and there is no stale-version trap
//   trouble → the last known-good copy off the device, so a reload always lands in the app
//
// The important subtlety: Netlify's "Site not found" arrives as a perfectly successful HTTP
// response carrying a 404. fetch() does NOT throw on it. So a plain try/catch fallback would hand
// that 404 straight to the screen — exactly the bug this exists to kill. Anything that isn't a 200
// is therefore treated as a failure and falls through to the cache, and is never cached itself.

const CACHE = 'bdance-shell-v1';
const SHELL = '/index.html';
const NET_TIMEOUT = 6000; // a reload shouldn't hang on a stalled network — fall back well before that

self.addEventListener('install', e => {
  self.skipWaiting(); // a new deploy takes over on the next reload rather than waiting for every tab to close
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function handleNav(req) {
  const cache = await caches.open(CACHE);

  const net = fetch(req)
    .then(async res => {
      // Only a genuinely healthy page is worth keeping. Never cache a 404 / 5xx, or we'd persist
      // Netlify's error page as "the app" and serve it back forever.
      if (res && res.status === 200) {
        try { await cache.put(SHELL, res.clone()); } catch (e) { /* cache full / opaque — not fatal */ }
      }
      return res;
    })
    .catch(() => null); // hard network failure

  let timer;
  const slow = new Promise(r => { timer = setTimeout(() => r('timeout'), NET_TIMEOUT); });
  const first = await Promise.race([net, slow]);
  clearTimeout(timer);

  // the normal, healthy, online path
  if (first && first !== 'timeout' && first.status === 200) return first;

  // network failed, stalled, or answered with something that isn't the app — use the device copy
  const cached = await cache.match(SHELL);
  if (cached) return cached;

  // nothing cached yet (very first visit, and it went wrong) — pass the real answer through so the
  // underlying problem stays visible instead of being masked by a blank screen
  const settled = (first && first !== 'timeout') ? first : await net;
  return settled || new Response(
    'No connection, and no offline copy saved yet. Reconnect and reload once to store one.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  );
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode !== 'navigate') return; // page loads only — never touch data traffic

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase, uploads, anything third-party
  if (url.pathname.startsWith('/api/')) return; // the cloud database function must stay live

  e.respondWith(handleNav(req));
});
