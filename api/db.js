// B Dance Studio — Supabase bridge (secure; your SECRET key stays on the server).
//
// The whole app database is stored as ONE JSON row in the "app_state" table
// (column: data jsonb). The website loads/saves through this function so your
// secret key is never in the browser. Readable tables (students, payments, ...)
// are SQL views that expand this JSON automatically — see supabase_setup.sql.
//
// Vercel → Project → Settings → Environment Variables:
//   SUPABASE_URL = https://YOURPROJECT.supabase.co
//   SUPABASE_KEY = your SECRET key  (sb_secret_...  or legacy service_role)
//                  (server-side only — never the publishable/anon key)
//
// After adding/changing these, redeploy (Vercel does NOT hot-reload env vars —
// Deployments → ⋯ → Redeploy, or just push a new commit).

const URL_ENV = () => (process.env.SUPABASE_URL || '').trim();
const KEY_ENV = () => (process.env.SUPABASE_KEY || '').trim();
const ROW_ID = 'main';
const BUCKET = 'media'; // Supabase Storage bucket holding uploaded instructor videos — see supabase_setup.sql
const IG_ID = () => (process.env.IG_USER_ID || '').trim();     // studio's Instagram Business account id
const IG_TOKEN = () => (process.env.IG_TOKEN || '').trim();    // long-lived / system-user access token
const GRAPH = 'https://graph.facebook.com/v21.0';        // Facebook-Login route (needs IG_USER_ID)
const IG_GRAPH = 'https://graph.instagram.com';           // Instagram-Login route (token only)
const TIMEOUT_MS = 7000; // never hang: a stuck request becomes a clean 504 instead of an opaque platform timeout

function headers(extra) {
  const k = KEY_ENV();
  return { apikey: k, Authorization: 'Bearer ' + k, 'Content-Type': 'application/json', ...(extra || {}) };
}
function apiBase() {
  // Accept whatever the user pasted: https://xxx.supabase.co  OR  .../  OR  .../rest/v1
  let u = URL_ENV();
  try { u = new URL(u).origin; }                          // -> https://xxx.supabase.co (drops any path)
  catch (e) { u = u.replace(/\/+$/, '').replace(/\/rest\/v1$/i, ''); }
  return u;
}
async function fetchWithTimeout(url, opts = {}) {
  if (typeof fetch === 'undefined')
    throw new Error('fetch is not available in this Node runtime — set Node.js Version to 18.x or higher in Vercel → Project → Settings → General.');
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ac.signal, headers: { ...headers(opts.headers) } });
  } finally {
    clearTimeout(timer);
  }
}
async function rawFetch(url, opts = {}, ms = TIMEOUT_MS) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); }
  finally { clearTimeout(timer); }
}
// Pulls the shortcode out of any Instagram permalink shape (/reel/, /reels/, /p/, /tv/).
function igShortcode(u) {
  const m = String(u || '').match(/instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/i);
  return m ? m[1] : '';
}
function rest(pathAndQuery, opts = {}) {
  return fetchWithTimeout(apiBase() + '/rest/v1/' + pathAndQuery, opts);
}

// ── Session tokens ───────────────────────────────────────────────────
// Credentials are checked HERE, on the server, instead of in the browser. The caller gets back a
// short signed token describing who they are — never the account list.
//
// The signature uses SESSION_SECRET when set, otherwise the Supabase secret key, which is already
// server-only. That means this works with no extra Vercel configuration; setting SESSION_SECRET is
// still worth doing, because then rotating the Supabase key doesn't sign everyone out.
const crypto = require('crypto');
const SESSION_HOURS = 12;
const secretKey = () => (process.env.SESSION_SECRET || '').trim() || KEY_ENV();
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function signToken(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(crypto.createHmac('sha256', secretKey()).update(body).digest());
  return body + '.' + sig;
}
// Returns the payload when the token is genuine and unexpired, otherwise null.
function readToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const expected = b64u(crypto.createHmac('sha256', secretKey()).update(parts[0]).digest());
  // timingSafeEqual needs equal lengths, and throws otherwise — check that first
  const a = Buffer.from(parts[1]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); }
  catch (e) { return null; }
  if (!payload || typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
  return payload;
}
// ── What an unauthenticated visitor is allowed to see ────────────────
// The landing page needs the studio's own marketing content and nothing else. Everything about
// people — students, accounts, payments, attendance — is left out entirely, and even the teacher
// records are rebuilt field by field so a phone number, email or salary can't ride along.
function publicSlice(db) {
  const d = db && typeof db === 'object' ? db : {};
  const teachers = Array.isArray(d.teachers) ? d.teachers.map(t => ({
    id: t.id, name: t.name, photo: t.photo, specs: t.specs,
        quote: t.quote, instagram: t.instagram, xiaohongshu: t.xiaohongshu,
    video: t.video, status: t.status, color: t.color,
  })) : [];
  // Classes drive the "styles we teach" counts and the timetable preview — times and styles only,
  // never who is enrolled.
  const classes = Array.isArray(d.classes) ? d.classes.map(c => ({
    id: c.id, name: c.name, style: c.style, day: c.day, start: c.start, end: c.end,
    placeId: c.placeId, teacherId: c.teacherId, room: c.room, max: c.max, level: c.level,
  })) : [];
  return {
    intro: d.intro || {},        // headings, event slider, collaborated shops, video, footer
    places: Array.isArray(d.places) ? d.places : [],  // branch names/addresses — public by design
    teachers,
    classes,
  };
}
// Pulls the session token out of the Authorization header (case varies by platform).
function bearerToken(event) {
  const h = (event && event.headers) || {};
  const raw = h.authorization || h.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(raw).trim());
  return m ? m[1] : '';
}
// Constant-time string compare so a wrong password can't be narrowed down by timing.
function sameSecret(a, b) {
  const x = Buffer.from(String(a == null ? '' : a));
  const y = Buffer.from(String(b == null ? '' : b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function handleEvent(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
  const ok = (obj) => ({ statusCode: 200, headers: cors, body: JSON.stringify(obj) });
  const fail = (code, msg) => ({ statusCode: code, headers: cors, body: JSON.stringify({ error: String(msg) }) });

  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };

    // Quick self-check: /api/db?health=1 → shows config without leaking the key
    if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.health) {
      let bucket = 'unknown';
      if (URL_ENV() && KEY_ENV()) {
        try {
          const b = await fetchWithTimeout(apiBase() + '/storage/v1/bucket/' + BUCKET);
          bucket = b.ok ? 'ok' : (b.status === 404 ? 'missing — run supabase_setup.sql' : 'HTTP ' + b.status);
        } catch (e) { bucket = String((e && e.message) || e); }
      }
      return ok({ ok: true, hasUrl: !!URL_ENV(), hasKey: !!KEY_ENV(), base: apiBase() || null, bucket,
        instagram: IG_TOKEN()
          ? ('configured (' + (IG_ID() ? 'facebook-login route' : 'instagram-login route') + ')')
          : 'not configured — add IG_TOKEN' });
    }

    if (!URL_ENV() || !KEY_ENV())
      return fail(500, 'Missing SUPABASE_URL or SUPABASE_KEY — add both in Vercel → Project → Settings → Environment Variables, then redeploy.');

    if (event.httpMethod === 'GET') {
      const r = await rest('app_state?id=eq.' + ROW_ID + '&select=data');
      if (!r.ok) return { statusCode: r.status, headers: cors, body: await r.text() };
      const rows = await r.json();
      const stored = rows[0] && rows[0].data ? rows[0].data : null;
      if (!stored) return ok({ data: '' });
      // ── The read gate ───────────────────────────────────────────────
      // Signed in → the full database, as before. Not signed in → only the marketing content the
      // landing page draws. This is what stops the whole roster — names, phone numbers, payments,
      // passwords — being handed to anyone who opens the site or types this address in a browser.
      const reader = readToken(bearerToken(event));
      if (reader) return ok({ data: JSON.stringify(stored), scope: 'full' });
      // nid holds the next-id counters (students: 26, payments: 60 …). Harmless on its own, but it
      // quietly discloses how many students and payments the studio has, and a visitor drawing the
      // landing page never needs it — only a signed-in session creating records does.
      return ok({
        data: JSON.stringify({ db: publicSlice(stored.db), nid: {} }),
        scope: 'public',
      });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (body.action === 'mirror') return ok({ ok: true }); // not needed on Supabase (views handle it)

      // ── Sign in, server-side ──────────────────────────────────────
      // The password is compared here against the stored account, so the browser never needs the
      // account list to log somebody in. Replies with a signed token plus only that person's own
      // identity (role, and which teacher/student record they are).
      if (body.action === 'login') {
        const user = String(body.user || '').trim();
        const pass = String(body.pass == null ? '' : body.pass);
        const wantRole = String(body.role || '').trim(); // desktop picks a role on the sign-in screen
        if (!user || !pass) return fail(400, 'Missing username or password');
        const r = await rest('app_state?id=eq.' + ROW_ID + '&select=data');
        if (!r.ok) return { statusCode: r.status, headers: cors, body: await r.text() };
        const rows = await r.json();
        const db = (rows[0] && rows[0].data && rows[0].data.db) || {};
        const accounts = Array.isArray(db.accounts) ? db.accounts : [];
        const acc = accounts.find(a => a && String(a.user) === user
          && (!wantRole || String(a.role) === wantRole)
          && sameSecret(a.pass, pass));
        // One message for every failure: saying "no such user" would confirm which names exist.
        if (!acc) return ok({ ok: false, error: 'Invalid username or password' });
        const payload = { u: acc.user, r: acc.role, ref: acc.ref == null ? null : acc.ref,
                          placeId: acc.placeId == null ? null : acc.placeId,
                          exp: Date.now() + SESSION_HOURS * 3600 * 1000 };
        return ok({ ok: true, token: signToken(payload), account: {
          user: acc.user, role: acc.role, ref: acc.ref == null ? null : acc.ref,
          placeId: acc.placeId == null ? null : acc.placeId, name: acc.name || '',
        } });
      }
      // Confirms a token is still genuine and unexpired — used on page reload so a restored session
      // doesn't have to trust whatever the browser had saved.
      if (body.action === 'session') {
        const payload = readToken(body.token);
        return ok({ ok: !!payload, account: payload ? {
          user: payload.u, role: payload.r, ref: payload.ref, placeId: payload.placeId,
        } : null });
      }

      // Hand the browser a one-time signed URL so the file goes STRAIGHT to Supabase Storage.
      // We deliberately do NOT proxy the bytes: a Vercel serverless function request body is capped at ~4.5MB and
      // base64 inflates a file by ~33%, so any real video would fail here. Signing keeps the secret
      // key on the server while letting the upload itself bypass the function entirely.
      // Remove an uploaded file once nothing in the database points at it any more. The browser
      // checks "is this still referenced?" before calling; this end just enforces that the delete
      // stays inside BUCKET and can't be walked out of it with a crafted path.
      // Paste a reel link -> real .mp4 in Supabase. Only reaches media on the account IG_TOKEN belongs to.
      // Patches ONE student's record atomically via the update_student_fields Postgres function
      // instead of the whole-database overwrite below — so many students saving their own
      // profile at the same time can never wipe out each other's edit (see supabase_setup.sql §4).
      if (body.action === 'update-student') {
        const id = String(body.id || '').trim();
        if (!id) return fail(400, 'Missing student id');
        // A student may only patch their OWN record; staff may patch anyone. Without this, one
        // student could edit another's profile just by changing the id in the request.
        const who = readToken(bearerToken(event));
        if (!who) return fail(401, 'Sign in again — your session has expired or is missing.');
        const isStaff = ['admin', 'counter', 'teacher'].includes(String(who.r));
        if (!isStaff && String(who.ref) !== id) return fail(403, 'You can only update your own record.');
        const patch = (body.patch && typeof body.patch === 'object') ? body.patch : {};
        const r = await rest('rpc/update_student_fields', {
          method: 'POST',
          body: JSON.stringify({ p_id: id, p_patch: patch }),
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          if (r.status === 404 || /function .* does not exist/i.test(t))
            return fail(404, 'update_student_fields is not set up in Supabase yet — run section 4 of supabase_setup.sql in the SQL Editor.');
          return fail(r.status, t || ('HTTP ' + r.status));
        }
        const found = await r.json().catch(() => false);
        if (!found) return fail(404, 'That student no longer exists.');
        return ok({ ok: true });
      }

      if (body.action === 'ig-import') {
        if (!IG_TOKEN())
          return fail(400, 'Instagram import is not set up — add IG_TOKEN in Vercel \u2192 Project \u2192 Settings \u2192 Environment Variables, then redeploy.');
        const code = igShortcode(body.url);
        if (!code) return fail(400, 'That does not look like an Instagram reel link.');

        // Graph has no "look up media by shortcode" endpoint, so page the account's own media and
        // match on permalink. Newest first, so a recent reel is normally found on the first page.
        // With no IG_USER_ID we're on the Instagram-Login route, where /me is the connected account.
        const FIELDS = 'fields=id,media_type,media_url,permalink&limit=100&access_token=';
        let next = IG_ID()
          ? (GRAPH + '/' + IG_ID() + '/media?' + FIELDS + encodeURIComponent(IG_TOKEN()))
          : (IG_GRAPH + '/me/media?' + FIELDS + encodeURIComponent(IG_TOKEN()));
        let hit = null;
        for (let page = 0; page < 4 && next && !hit; page++) {
          const r = await rawFetch(next);
          const j = await r.json().catch(() => ({}));
          if (!r.ok || j.error) {
            const m = (j.error && j.error.message) || ('HTTP ' + r.status);
            return fail(502, 'Instagram rejected the request: ' + m + ' \u2014 the token has probably expired (they last 60 days). Regenerate it in the Meta App Dashboard and update IG_TOKEN in Vercel.');
          }
          hit = (j.data || []).find((it) => igShortcode(it.permalink) === code) || null;
          next = (j.paging && j.paging.next) || null;
        }
        if (!hit)
          return fail(404, 'That reel is not on the studio\u2019s Instagram account. The Graph API can only fetch media from the account the token belongs to \u2014 reels on a personal account cannot be imported.');
        if (!hit.media_url)
          return fail(422, 'Instagram returned no video file for that post (is it a photo?).');

        // Copy the bytes across while Meta's signed link is still valid.
        const dl = await rawFetch(hit.media_url, {}, 8000);
        if (!dl.ok) return fail(502, 'Could not download the video from Instagram (HTTP ' + dl.status + ')');
        const buf = Buffer.from(await dl.arrayBuffer());
        if (!buf.length) return fail(502, 'Instagram returned an empty video file');

        const path = Date.now().toString(36) + '-ig-' + code + '.mp4';
        const up = await rawFetch(apiBase() + '/storage/v1/object/' + BUCKET + '/' + path, {
          method: 'POST',
          headers: { apikey: KEY_ENV(), Authorization: 'Bearer ' + KEY_ENV(), 'Content-Type': 'video/mp4', 'x-upsert': 'true' },
          body: buf,
        }, 20000);
        if (!up.ok) {
          const t = await up.text().catch(() => '');
          if (up.status === 404) return fail(404, 'Storage bucket "' + BUCKET + '" not found — run supabase_setup.sql.');
          return fail(up.status, t || ('HTTP ' + up.status));
        }
        return ok({
          publicUrl: apiBase() + '/storage/v1/object/public/' + BUCKET + '/' + path,
          bytes: buf.length,
        });
      }

      if (body.action === 'delete-object') {
        const path = String(body.path || '').replace(/^\/+/, '');
        if (!path || path.indexOf('..') !== -1) return fail(400, 'Bad object path');
        const r = await fetchWithTimeout(apiBase() + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'DELETE' });
        // 404 = already gone, which is the state we were aiming for — not an error worth raising.
        if (!r.ok && r.status !== 404) {
          const t = await r.text().catch(() => '');
          return fail(r.status, t || ('HTTP ' + r.status));
        }
        return ok({ ok: true, deleted: path });
      }

      if (body.action === 'sign-upload') {
        const safe = String(body.name || 'file').toLowerCase()
          .replace(/[^a-z0-9.\-]+/g, '-').replace(/^-+|-+$/g, '').slice(-60) || 'file';
        const path = Date.now().toString(36) + '-' + safe;   // unique, so re-uploads never collide
        const r = await fetchWithTimeout(apiBase() + '/storage/v1/object/upload/sign/' + BUCKET + '/' + path, {
          method: 'POST',
          body: '{}',
        });
        if (!r.ok) {
          const t = await r.text().catch(() => '');
          if (r.status === 404)
            return fail(404, 'Storage bucket "' + BUCKET + '" not found — run the media bucket section of supabase_setup.sql in your Supabase SQL Editor.');
          return fail(r.status, t || ('HTTP ' + r.status));
        }
        const j = await r.json();            // { url: "/object/upload/sign/media/xxx?token=..." }
        if (!j || !j.url) return fail(502, 'Supabase did not return a signed upload URL');
        return ok({
          uploadUrl: apiBase() + '/storage/v1' + j.url,
          publicUrl: apiBase() + '/storage/v1/object/public/' + BUCKET + '/' + path,
        });
      }

      // ── Whole-database overwrite — staff only ─────────────────────
      // This request replaces the entire studio database, so it must prove who's asking. Without
      // this check anyone who knows the URL could POST an empty object and erase everything.
      // Students never come through here; they patch their own record via 'update-student' above.
      const writer = readToken(bearerToken(event));
      if (!writer) return fail(401, 'Sign in again to save — your session has expired or is missing.');
      if (!['admin', 'counter', 'teacher'].includes(String(writer.r))) return fail(403, 'This account is not allowed to save studio data.');

      const payload = typeof body.data === 'string' ? body.data : JSON.stringify(body.data || {});
      let obj; try { obj = JSON.parse(payload); } catch (e) { obj = {}; }
      // A save that carries no database at all is never legitimate — refuse rather than let a
      // malformed or truncated request blank the row.
      if (!obj || !obj.db || typeof obj.db !== 'object' || !Object.keys(obj.db).length)
        return fail(400, 'Refusing to save an empty database.');

      const r = await rest('app_state?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify([{ id: ROW_ID, data: obj, updated_at: new Date().toISOString() }]),
      });
      if (!r.ok) return { statusCode: r.status, headers: cors, body: await r.text() };
      return ok({ ok: true });
    }

    return fail(405, 'Method not allowed');
  } catch (e) {
    // AbortError = we hit the timeout above (Supabase unreachable / project paused / wrong URL)
    if (e && (e.name === 'AbortError' || String(e).includes('aborted')))
      return fail(504, 'Supabase did not respond in time — check that SUPABASE_URL is correct and the project is not paused.');
    return fail(500, e && e.message ? e.message : e);
  }
}

// ── Vercel adapter ────────────────────────────────────────────────────
// Everything above this line is unchanged from the Netlify version — handleEvent() takes a plain
// { httpMethod, headers, queryStringParameters, body } object and returns a plain
// { statusCode, headers, body } object, with no dependency on either platform's request/response
// types. This wrapper is the only Vercel-specific part: it adapts Vercel's (req, res) signature to
// that shape and writes the result back out.
module.exports = async (req, res) => {
  // Vercel already parses a JSON request body into an object when Content-Type is application/json
  // (which every caller in this app sends) — re-stringify so handleEvent can JSON.parse it exactly
  // like it did with Netlify's raw event.body string.
  let body = req.body;
  if (body && typeof body !== 'string') body = JSON.stringify(body);

  const event = {
    httpMethod: req.method,
    headers: req.headers || {},               // Node lowercases header names already
    queryStringParameters: req.query || {},
    body: body || '',
  };

  const result = await handleEvent(event);
  res.status(result.statusCode);
  for (const [k, v] of Object.entries(result.headers || {})) res.setHeader(k, v);
  res.send(result.body);
};
