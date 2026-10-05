import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import webpush from 'web-push';
import { Server } from 'socket.io';
import { q, pool } from './db.js';
import { sendSms } from './sms.js';
import { registerExtras, ensureExtras, isBlocked, isBanned } from './extras.js';

process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));
process.on('uncaughtException', e => console.error('[uncaughtException]', e));

const {
  PORT = 4000, JWT_SECRET, CLIENT_ORIGIN = '*', NODE_ENV,
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:admin@example.com',
  DEFAULT_CC = '254'            // country code used to complete local numbers like 0712 345 678
} = process.env;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const pushOn = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
const { TURN_URL, TURN_SECRET } = process.env;
if (pushOn) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
else console.warn('[push] VAPID keys missing - push notifications are disabled (run: npx web-push generate-vapid-keys)');

const app = express();
app.set('trust proxy', 1);   // we sit behind Caddy in production
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });

app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));  // CSP off so the CDN Tailwind + inline scripts work
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public'));   // serves the LIBRA frontend at http://localhost:4000

// ---------- helpers ----------
const sign = id => jwt.sign({ id }, JWT_SECRET, { expiresIn: '30d' });
const hash = c => crypto.createHash('sha256').update(c + JWT_SECRET).digest('hex');
const verifyToken = t => jwt.verify(t, JWT_SECRET).id;
const guard = (req, res, next) => {
  try { req.uid = verifyToken((req.headers.authorization || '').replace('Bearer ', '')); if (isBanned(req.uid)) return res.status(403).json({ error: 'This account has been suspended.' }); next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
};
const priv = uid => q('SELECT hide_online, hide_read, hide_typing FROM users WHERE id=$1', [uid]).then(r => r[0] || {});
const isMember = async (uid, chatId) => (await q('SELECT 1 FROM chat_members WHERE chat_id=$1 AND user_id=$2', [chatId, uid])).length > 0;

// Turns "0712 345 678", "712345678", "00254712345678" or "+254 712-345-678" into +254712345678
const CC = String(DEFAULT_CC).replace(/\D/g, '');
function normPhone(raw) {
  const s = String(raw || '').trim();
  let d = s.replace(/\D/g, '');
  if (!d) return null;
  if (s.startsWith('+')) { /* already international */ }
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = CC + d.slice(1);
  else if (d.length <= 9) d = CC + d;
  const out = '+' + d;
  return /^\+\d{7,15}$/.test(out) ? out : null;
}

// ---------- input validation (never trust what a client sends) ----------
const UPLOAD_RE = /^\/uploads\/[\w.-]{1,100}$/;     // only files that came from our own /api/upload
function cleanMsg(d = {}) {
  const kind = ['text', 'image', 'file', 'voice', 'video', 'sticker', 'location', 'contact'].includes(d.kind) ? d.kind : 'text';
  const media_url = UPLOAD_RE.test(d.media_url || '') ? d.media_url : null;
  const body = String(d.body || '').slice(0, 4000);
  const mm = d.media_meta && typeof d.media_meta === 'object' ? d.media_meta : {};
  const noUrlOk = kind === 'location' || kind === 'contact' || (kind === 'sticker' && mm.emoji);
  if (kind === 'text' ? !body.trim() : (!media_url && !noUrlOk)) return null;
  if (kind === 'location' && !(Math.abs(+mm.lat) <= 90 && Math.abs(+mm.lng) <= 180)) return null;
  if (kind === 'contact' && !(mm.name && mm.phone)) return null;
  const m = d.media_meta && typeof d.media_meta === 'object' ? d.media_meta : {};
  const media_meta = (kind === 'text' && !m.fwd) ? null : {
    lat: Number.isFinite(+m.lat) ? +m.lat : undefined, lng: Number.isFinite(+m.lng) ? +m.lng : undefined,
    label: String(m.label || '').slice(0, 120), phone: String(m.phone || '').slice(0, 20),
    emoji: String(m.emoji || '').slice(0, 16), fwd: m.fwd ? true : undefined,
    name: String(m.name || '').slice(0, 200),
    size: String(m.size || '').slice(0, 20),
    duration: Math.min(3600, Math.max(0, Number(m.duration) || 0)),
    waveform: (Array.isArray(m.waveform) ? m.waveform : []).slice(0, 64).map(n => Math.min(100, Math.max(0, Math.round(Number(n) || 0))))
  };
  const when = d.scheduled_at ? new Date(d.scheduled_at) : null;
  return { body, kind, media_url, media_meta, reply_to: d.reply_to || null, scheduled_at: when && !isNaN(when) ? when.toISOString() : null };
}
function cleanProfile(k, v) {
  if (k.startsWith('hide_')) return !!v;
  if (k === 'accent') return /^#[0-9a-f]{6}$/i.test(v) ? v : '#14b8a6';
  if (k === 'avatar_url') return UPLOAD_RE.test(v || '') ? v : null;
  return String(v ?? '').slice(0, k === 'about' ? 140 : 60);
}

// ---------- schema (creates the extra tables on first start) ----------
async function ensureSchema() {
  const idType = async tbl => (await q(`SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute WHERE attrelid=$1::regclass AND attname='id'`, [tbl]))[0]?.t;
  const UID = (await idType('users')) || 'uuid';
  const MID = (await idType('messages')) || 'uuid';
  await q(`CREATE TABLE IF NOT EXISTS push_subscriptions(
    endpoint text PRIMARY KEY, user_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    p256dh text NOT NULL, auth text NOT NULL, created_at timestamptz DEFAULT now())`);
  await q('CREATE INDEX IF NOT EXISTS push_subs_user ON push_subscriptions(user_id)');
  await q(`CREATE TABLE IF NOT EXISTS user_contacts(
    owner_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(owner_id, contact_id))`);
  await q(`CREATE TABLE IF NOT EXISTS hidden_messages(
    user_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id ${MID} NOT NULL REFERENCES messages(id) ON DELETE CASCADE, PRIMARY KEY(user_id, message_id))`);
}

// ---------- PWA: manifest, service worker, icons ----------
const SW_JS = `
const CACHE = 'libra-v2';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png'];
const CDN = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const SKIP = ['/api/', '/socket.io/', '/uploads/', '/sw.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const same = u.origin === self.location.origin;
  if (same && SKIP.some(p => u.pathname.startsWith(p))) return;
  if (!same && !CDN.includes(u.hostname)) return;
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('/', cp)); }
      return res;
    }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(r);
    const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (wins.some(w => w.visibilityState === 'visible' && w.focused)) return;   // app is open - in-app UI handles it
    await self.registration.showNotification(d.title || 'LIBRA', {
      body: d.body || '', icon: '/icon-192.png', badge: '/icon-96.png',
      tag: d.tag || 'libra', renotify: true, data: { chat_id: d.chat_id }
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = e.notification.data && e.notification.data.chat_id;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('focus' in w) { await w.focus(); w.postMessage({ type: 'open-chat', chat_id: id }); return; }
    }
    await self.clients.openWindow('/?chat=' + encodeURIComponent(id || ''));
  })());
});
`;

app.get('/sw.js', (_, res) => {
  res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
  res.send(SW_JS);
});

app.get('/manifest.webmanifest', (_, res) => {
  res.type('application/manifest+json').send(JSON.stringify({
    name: 'LIBRA', short_name: 'LIBRA', description: 'Balanced, private messaging',
    id: '/', start_url: '/', scope: '/', display: 'standalone', orientation: 'portrait',
    background_color: '#0d1014', theme_color: '#14b8a6',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }));
});

// App icons are drawn on the fly (teal -> indigo gradient + speech bubble with scales).
// To use your own artwork, drop icon-192.png / icon-512.png / icon-180.png / icon-96.png into /public - static files win.
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const pngChunk = (t, d) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t), d]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function makePng(n) {
  const A = [0x2d, 0xd4, 0xbf], B = [0x63, 0x66, 0xf1], SS = 2, stride = n * 4 + 1;
  const raw = Buffer.alloc(stride * n);
  const inTri = (u, v, a, b, c) => {
    const s = (p, q2, r) => (p[0] - r[0]) * (q2[1] - r[1]) - (q2[0] - r[0]) * (p[1] - r[1]);
    const p = [u, v], d1 = s(p, a, b), d2 = s(p, b, c), d3 = s(p, c, a);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const bubble = (u, v) => Math.hypot(u - .5, v - .47) < .27 || inTri(u, v, [.31, .71], [.34, .58], [.46, .67]);
  const scales = (u, v) => {
    if (u > .34 && u < .66 && v > .565 && v < .60) return true;                                  // base bar
    const d = Math.hypot(u - .5, v - .48);
    return v < .575 && d > .055 && d < .09;                                                        // dome
  };
  for (let y = 0; y < n; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < n; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const u = (x + (sx + .5) / SS) / n, v = (y + (sy + .5) / SS) / n, t = (u + v) / 2;
        let c = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
        if (bubble(u, v) && !scales(u, v)) c = [255, 255, 255];
        r += c[0]; g += c[1]; b += c[2];
      }
      const o = y * stride + 1 + x * 4, k = SS * SS;
      raw[o] = Math.round(r / k); raw[o + 1] = Math.round(g / k); raw[o + 2] = Math.round(b / k); raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(n, 0); ihdr.writeUInt32BE(n, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}
const iconCache = new Map();
app.get(/^\/icon-(\d+)\.png$/, (req, res) => {
  const n = Number(req.params[0]);
  if (![96, 144, 180, 192, 512].includes(n)) return res.sendStatus(404);
  if (!iconCache.has(n)) iconCache.set(n, makePng(n));
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=604800' }).send(iconCache.get(n));
});

app.use('/api', rateLimit({ windowMs: 60_000, limit: 600 }));   // behind a proxy/host also add: app.set('trust proxy', 1)

// ---------- auth ----------
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 20 }));

app.post('/api/auth/request-otp', async (req, res) => {
  const { phone } = req.body;
  if (!/^\+\d{7,15}$/.test(phone || '')) return res.status(400).json({ error: 'Use international format, e.g. +254712345678' });
  const [prev] = await q('SELECT expires_at FROM otp_codes WHERE phone=$1', [phone]);
  if (prev && new Date(prev.expires_at) > new Date(Date.now() + 4 * 60_000))
    return res.status(429).json({ error: 'Please wait a minute before asking for another code.' });
  const code = String(crypto.randomInt(100000, 1000000));
  await q(`INSERT INTO otp_codes(phone, code_hash, expires_at) VALUES($1,$2, now() + interval '5 minutes')
           ON CONFLICT (phone) DO UPDATE SET code_hash=$2, expires_at=excluded.expires_at, attempts=0`, [phone, hash(code)]);
  try { await sendSms(phone, `Your LIBRA code is ${code}. It expires in 5 minutes. Do not share it with anyone.`); }
  catch (e) {
    console.error('[sms]', e.message);
    await q('DELETE FROM otp_codes WHERE phone=$1', [phone]);
    // while developing, never get stuck: show the code in the terminal and carry on
    // (the failed-SMS branch above deleted the code, so store it again or verifying would say "expired")
    if (NODE_ENV !== 'production') await q(`INSERT INTO otp_codes(phone, code_hash, expires_at) VALUES($1,$2, now() + interval '5 minutes')
      ON CONFLICT (phone) DO UPDATE SET code_hash=$2, expires_at=excluded.expires_at, attempts=0`, [phone, hash(code)]);
    if (NODE_ENV !== 'production') { console.log(`[dev] SMS failed, so here is the code for ${phone}: ${code}`); return res.json({ ok: true, dev: true }); }
    const msg = String(e.message);
    if (/UserInBlacklist/i.test(msg)) return res.status(422).json({ error: 'This number has opted out of SMS from our sender. Ask your mobile network to allow messages again, or use another number.' });
    return res.status(502).json({ error: 'We could not send the SMS. Please try again shortly.' });
  }
  // the code is delivered by SMS above (see src/sms.js)
  res.json({ ok: true });
});

app.post('/api/auth/verify', async (req, res) => {
  const { phone, code, name } = req.body;
  const [otp] = await q('SELECT *, (expires_at < now()) AS expired FROM otp_codes WHERE phone=$1', [phone]);
  if (!otp) return res.status(400).json({ error: 'No code is waiting for this number. Tap "Resend code".' });
  if (otp.expired) return res.status(400).json({ error: 'That code has expired. Tap "Resend code" for a new one.' });
  if (otp.attempts >= 5) return res.status(429).json({ error: 'Too many wrong tries. Tap "Resend code" for a new one.' });
  if (otp.code_hash !== hash(String(code))) {
    await q('UPDATE otp_codes SET attempts = attempts + 1 WHERE phone=$1', [phone]);
    return res.status(400).json({ error: 'Wrong code' });
  }
  await q('DELETE FROM otp_codes WHERE phone=$1', [phone]);
  const [user] = await q(`INSERT INTO users(name, phone) VALUES($1,$2)
                          ON CONFLICT (phone) DO UPDATE SET phone=excluded.phone RETURNING *`, [name || phone, phone]);
  res.json({ token: sign(user.id), user });
});

// ---------- profile & privacy ----------
app.get('/api/me', guard, async (req, res) => res.json((await q('SELECT * FROM users WHERE id=$1', [req.uid]))[0]));
app.patch('/api/me', guard, async (req, res) => {
  const allowed = ['name', 'about', 'avatar_url', 'accent', 'hide_online', 'hide_read', 'hide_typing'];
  const keys = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!keys.length) return res.status(400).json({ error: 'Nothing to update' });
  const sets = keys.map((k, i) => `${k}=$${i + 2}`).join(',');
  const [u] = await q(`UPDATE users SET ${sets} WHERE id=$1 RETURNING *`, [req.uid, ...keys.map(k => cleanProfile(k, req.body[k]))]);
  res.json(u);
});

// ---------- contacts ----------
// People you already share a chat with + anyone you imported from your phone book.
app.get('/api/contacts', guard, async (req, res) => {
  res.json(await q(`
    SELECT u.id, u.name, u.phone, u.about FROM users u
    WHERE u.id <> $1 AND (
      u.id IN (SELECT contact_id FROM user_contacts WHERE owner_id=$1)
      OR u.id IN (SELECT o.user_id FROM chat_members m JOIN chat_members o ON o.chat_id=m.chat_id AND o.user_id<>$1 WHERE m.user_id=$1))
    ORDER BY lower(u.name)`, [req.uid]));
});

// Phone-book import: send raw numbers, get back the ones registered on LIBRA (and remember them as contacts).
app.use('/api/contacts/match', rateLimit({ windowMs: 60 * 60_000, limit: 30 }));
app.post('/api/contacts/match', guard, async (req, res) => {
  const raw = Array.isArray(req.body.phones) ? req.body.phones.slice(0, 1000) : [];
  const phones = [...new Set(raw.map(normPhone).filter(Boolean))];
  if (!phones.length) return res.json([]);
  const users = await q('SELECT id, name, phone, about FROM users WHERE phone = ANY($1) AND id <> $2', [phones, req.uid]);
  if (users.length) await q(`INSERT INTO user_contacts(owner_id, contact_id)
    SELECT $1, u.id FROM users u WHERE u.phone = ANY($2) AND u.id <> $1 ON CONFLICT DO NOTHING`, [req.uid, phones]);
  res.json(users);
});

// ---------- push notifications ----------
app.get('/api/push/key', guard, (_, res) =>
  pushOn ? res.json({ key: VAPID_PUBLIC_KEY }) : res.status(503).json({ error: 'Push is not configured on the server' }));
app.post('/api/push/subscribe', guard, async (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!/^https:\/\//.test(endpoint || '') || !keys?.p256dh || !keys?.auth) return res.status(400).json({ error: 'Bad subscription' });
  await q(`INSERT INTO push_subscriptions(endpoint, user_id, p256dh, auth) VALUES($1,$2,$3,$4)
           ON CONFLICT (endpoint) DO UPDATE SET user_id=$2, p256dh=$3, auth=$4`, [endpoint, req.uid, keys.p256dh, keys.auth]);
  res.sendStatus(204);
});
app.post('/api/push/unsubscribe', guard, async (req, res) => {
  await q('DELETE FROM push_subscriptions WHERE endpoint=$1 AND user_id=$2', [req.body?.endpoint, req.uid]);
  res.sendStatus(204);
});

async function pushToChat(chatId, m) {
  if (!pushOn) return;
  try {
    const [chat] = await q('SELECT is_group, name FROM chats WHERE id=$1', [chatId]);
    const subs = await q(`SELECT ps.endpoint, ps.p256dh, ps.auth FROM chat_members cm
      JOIN push_subscriptions ps ON ps.user_id=cm.user_id
      WHERE cm.chat_id=$1 AND cm.user_id<>$2 AND cm.muted IS NOT TRUE`, [chatId, m.sender_id]);
    if (!subs.length) return;
    const label = { image: 'Photo', voice: 'Voice message', file: 'Document', video: 'Video', sticker: 'Sticker', location: 'Location', contact: 'Contact' };
    const text = (m.kind === 'text' ? m.body : label[m.kind] || 'New message').slice(0, 140);
    const sender = m.sender_name || 'New message';
    const payload = JSON.stringify({
      title: chat?.is_group ? chat.name : sender,
      body: chat?.is_group ? `${sender}: ${text}` : text,
      chat_id: chatId, tag: `chat:${chatId}`
    });
    await Promise.all(subs.map(s =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400, urgency: 'high' })
        .catch(e => {
          if (e.statusCode === 404 || e.statusCode === 410) return q('DELETE FROM push_subscriptions WHERE endpoint=$1', [s.endpoint]);
          console.error('[push]', e.statusCode || e.message);
        })));
  } catch (e) { console.error('[push]', e.message); }
}

// ---------- chats ----------
app.get('/api/chats', guard, async (req, res) => {
  res.json(await q(`
    SELECT c.id, c.is_group, COALESCE(c.name, u.name) AS name, u.id AS peer_id, u.about AS peer_about,
           CASE WHEN u.hide_online THEN NULL ELSE u.last_seen END AS peer_last_seen,
           cm.pinned, cm.muted, cm.folder,
           (SELECT row_to_json(m) FROM (SELECT body, kind, sender_id, created_at FROM messages mm
              WHERE mm.chat_id=c.id AND mm.deleted_at IS NULL AND mm.scheduled_at IS NULL
                AND NOT EXISTS (SELECT 1 FROM hidden_messages h WHERE h.message_id=mm.id AND h.user_id=$1)
              ORDER BY mm.created_at DESC LIMIT 1) m) AS last,
           (SELECT count(*) FROM messages WHERE chat_id=c.id AND sender_id<>$1 AND deleted_at IS NULL
              AND scheduled_at IS NULL AND created_at > cm.last_read_at)::int AS unread
    FROM chats c
    JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=$1
    LEFT JOIN chat_members o ON o.chat_id=c.id AND o.user_id<>$1 AND NOT c.is_group
    LEFT JOIN users u ON u.id=o.user_id
    ORDER BY cm.pinned DESC, (SELECT max(created_at) FROM messages WHERE chat_id=c.id) DESC NULLS LAST`, [req.uid]));
});

app.post('/api/chats', guard, async (req, res) => {   // start a direct chat by phone
  const phone = normPhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'That is not a valid phone number' });
  const [peer] = await q('SELECT id FROM users WHERE phone=$1', [phone]);
  if (!peer) return res.status(404).json({ error: 'That number is not on LIBRA yet' });
  const [existing] = await q(`SELECT c.id FROM chats c
    JOIN chat_members a ON a.chat_id=c.id AND a.user_id=$1
    JOIN chat_members b ON b.chat_id=c.id AND b.user_id=$2 WHERE NOT c.is_group`, [req.uid, peer.id]);
  if (existing) return res.json(existing);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [chat] } = await client.query('INSERT INTO chats(created_by) VALUES($1) RETURNING id', [req.uid]);
    await client.query('INSERT INTO chat_members(chat_id,user_id) VALUES($1,$2),($1,$3)', [chat.id, req.uid, peer.id]);
    await client.query('COMMIT');
    io.in(`user:${peer.id}`).socketsJoin(`chat:${chat.id}`);
    io.in(`user:${req.uid}`).socketsJoin(`chat:${chat.id}`);
    io.to(`user:${peer.id}`).emit('chat:new', { chat_id: chat.id });
    res.status(201).json(chat);
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

app.patch('/api/chats/:id', guard, async (req, res) => {   // pin / mute / folder
  const { pinned, muted, folder } = req.body;
  const [r] = await q(`UPDATE chat_members SET pinned=COALESCE($3,pinned), muted=COALESCE($4,muted), folder=COALESCE($5,folder)
                       WHERE chat_id=$1 AND user_id=$2 RETURNING *`, [req.params.id, req.uid, pinned, muted, folder]);
  res.json(r);
});

app.post('/api/chats/:id/clear', guard, async (req, res) => {   // "clear chat" for me only
  if (!await isMember(req.uid, req.params.id)) return res.sendStatus(403);
  await q(`INSERT INTO hidden_messages(user_id, message_id) SELECT $2, id FROM messages WHERE chat_id=$1 ON CONFLICT DO NOTHING`, [req.params.id, req.uid]);
  await q('UPDATE chat_members SET last_read_at=now() WHERE chat_id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.sendStatus(204);
});

// ---------- groups ----------
const isAdmin = async (uid, chatId) =>
  (await q("SELECT 1 FROM chat_members WHERE chat_id=$1 AND user_id=$2 AND role='admin'", [chatId, uid])).length > 0;

app.post('/api/groups', guard, async (req, res) => {
  const name = (req.body.name || '').trim();
  const phones = [...new Set((req.body.phones || []).map(normPhone).filter(Boolean))];
  if (!name) return res.status(400).json({ error: 'Group name is required' });
  const users = phones.length ? await q('SELECT id FROM users WHERE phone = ANY($1) AND id <> $2', [phones, req.uid]) : [];
  if (!users.length) return res.status(400).json({ error: 'Add at least one member who is registered on LIBRA' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [chat] } = await client.query('INSERT INTO chats(is_group, name, created_by) VALUES(true,$1,$2) RETURNING id, name', [name, req.uid]);
    await client.query("INSERT INTO chat_members(chat_id, user_id, role) VALUES($1,$2,'admin')", [chat.id, req.uid]);
    for (const u of users) await client.query('INSERT INTO chat_members(chat_id, user_id) VALUES($1,$2)', [chat.id, u.id]);
    await client.query('COMMIT');
    [req.uid, ...users.map(u => u.id)].forEach(id => {
      io.in(`user:${id}`).socketsJoin(`chat:${chat.id}`);
      io.to(`user:${id}`).emit('chat:new', { chat_id: chat.id });
    });
    res.status(201).json({ ...chat, missing: phones.length - users.length });
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
});

app.get('/api/chats/:id/members', guard, async (req, res) => {
  if (!await isMember(req.uid, req.params.id)) return res.sendStatus(403);
  res.json(await q(`SELECT u.id, u.name, u.phone, u.about, m.role FROM chat_members m JOIN users u ON u.id=m.user_id
                    WHERE m.chat_id=$1 ORDER BY (m.role='admin') DESC, u.name`, [req.params.id]));
});

app.post('/api/chats/:id/members', guard, async (req, res) => {   // accepts { phones: [...] } or { phone }
  if (!await isAdmin(req.uid, req.params.id)) return res.sendStatus(403);
  const phones = [...new Set([].concat(req.body.phones || req.body.phone || []).map(normPhone).filter(Boolean))];
  if (!phones.length) return res.status(400).json({ error: 'No valid phone numbers' });
  const users = await q('SELECT id FROM users WHERE phone = ANY($1)', [phones]);
  if (!users.length) return res.status(404).json({ error: 'That number is not on LIBRA yet' });
  for (const u of users) {
    await q('INSERT INTO chat_members(chat_id, user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, u.id]);
    io.in(`user:${u.id}`).socketsJoin(`chat:${req.params.id}`);
    io.to(`user:${u.id}`).emit('chat:new', { chat_id: req.params.id });
  }
  io.to(`chat:${req.params.id}`).emit('group:updated', { chat_id: req.params.id });
  res.json({ added: users.length, missing: phones.length - users.length });
});

app.delete('/api/chats/:id/members/:uid', guard, async (req, res) => {
  const self = req.params.uid === req.uid;
  if (!self && !await isAdmin(req.uid, req.params.id)) return res.sendStatus(403);
  await q('DELETE FROM chat_members WHERE chat_id=$1 AND user_id=$2', [req.params.id, req.params.uid]);
  // keep at least one admin
  await q(`UPDATE chat_members SET role='admin' WHERE chat_id=$1 AND user_id=(SELECT user_id FROM chat_members WHERE chat_id=$1 LIMIT 1)
           AND NOT EXISTS (SELECT 1 FROM chat_members WHERE chat_id=$1 AND role='admin')`, [req.params.id]);
  io.to(`user:${req.params.uid}`).emit('chat:removed', { chat_id: req.params.id });
  io.in(`user:${req.params.uid}`).socketsLeave(`chat:${req.params.id}`);
  io.to(`chat:${req.params.id}`).emit('group:updated', { chat_id: req.params.id });
  res.sendStatus(204);
});

app.patch('/api/chats/:id/group', guard, async (req, res) => {
  if (!await isAdmin(req.uid, req.params.id)) return res.sendStatus(403);
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name required' });
  const [c] = await q('UPDATE chats SET name=$2 WHERE id=$1 AND is_group RETURNING id, name', [req.params.id, name]);
  io.to(`chat:${req.params.id}`).emit('group:updated', { chat_id: req.params.id });
  res.json(c);
});

// ---------- messages ----------
app.get('/api/chats/:id/messages', guard, async (req, res) => {
  if (!await isMember(req.uid, req.params.id)) return res.sendStatus(403);
  res.json(await q(`
    SELECT m.*, (SELECT name FROM users WHERE id=m.sender_id) AS sender_name,
           EXISTS(SELECT 1 FROM starred_messages s WHERE s.message_id=m.id AND s.user_id=$2) AS starred,
           (SELECT json_agg(json_build_object('user_id', r.user_id, 'emoji', r.emoji)) FROM reactions r WHERE r.message_id=m.id) AS reactions,
           (SELECT COALESCE(json_agg(ms.user_id), '[]'::json) FROM message_status ms
              WHERE ms.message_id=m.id AND ms.delivered_at IS NOT NULL) AS delivered_by,
           (SELECT COALESCE(json_agg(ms.user_id), '[]'::json) FROM message_status ms JOIN users ru ON ru.id=ms.user_id
              WHERE ms.message_id=m.id AND ms.read_at IS NOT NULL AND NOT ru.hide_read) AS read_by,
           (SELECT count(*) FROM chat_members cm WHERE cm.chat_id=m.chat_id AND cm.user_id<>m.sender_id)::int AS recipients
    FROM messages m WHERE m.chat_id=$1 AND m.deleted_at IS NULL AND m.scheduled_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM hidden_messages h WHERE h.message_id=m.id AND h.user_id=$2)
      AND ($3::timestamptz IS NULL OR m.created_at < $3)
    ORDER BY m.created_at DESC LIMIT 50`, [req.params.id, req.uid, req.query.before || null]));
});

async function decorate(m) {
  m.sender_name = (await q('SELECT name FROM users WHERE id=$1', [m.sender_id]))[0]?.name;
  m.recipients = (await q('SELECT count(*)::int AS n FROM chat_members WHERE chat_id=$1 AND user_id<>$2', [m.chat_id, m.sender_id]))[0]?.n || 0;
  m.delivered_by = []; m.read_by = [];
  return m;
}

async function saveMessage(uid, chatId, d) {
  d = cleanMsg(d);
  if (d && await isBlocked(uid, chatId)) return null;
  if (!d) return null;
  const [m] = await q(`INSERT INTO messages(chat_id, sender_id, body, kind, media_url, media_meta, reply_to, scheduled_at)
    SELECT $1,$2,$3,$4,$5,$6,$7,$8 WHERE EXISTS (SELECT 1 FROM chat_members WHERE chat_id=$1 AND user_id=$2) RETURNING *`,
    [chatId, uid, d.body || '', d.kind || 'text', d.media_url || null, d.media_meta || null, d.reply_to || null, d.scheduled_at || null]);
  if (m) await decorate(m);
  if (m && !m.scheduled_at) {
    io.to(`chat:${chatId}`).emit('message:new', m);
    pushToChat(chatId, m);        // fire and forget
  }
  return m;
}

app.post('/api/chats/:id/messages', guard, async (req, res) => {
  const m = await saveMessage(req.uid, req.params.id, req.body);
  m ? res.status(201).json(m) : res.sendStatus(403);
});
app.get('/api/scheduled', guard, async (req, res) =>
  res.json(await q('SELECT * FROM messages WHERE sender_id=$1 AND scheduled_at > now() ORDER BY scheduled_at', [req.uid])));
app.delete('/api/scheduled/:id', guard, async (req, res) => {
  await q('DELETE FROM messages WHERE id=$1 AND sender_id=$2 AND scheduled_at > now()', [req.params.id, req.uid]); res.sendStatus(204);
});

app.patch('/api/messages/:id', guard, async (req, res) => {   // edit own text message
  const [m] = await q(`UPDATE messages SET body=$3, edited_at=now() WHERE id=$1 AND sender_id=$2 AND kind='text' AND deleted_at IS NULL RETURNING *`,
    [req.params.id, req.uid, req.body.body]);
  if (!m) return res.sendStatus(404);
  io.to(`chat:${m.chat_id}`).emit('message:edited', m); res.json(m);
});
app.delete('/api/messages/:id', guard, async (req, res) => {   // delete for everyone (own messages)
  const [m] = await q('UPDATE messages SET deleted_at=now() WHERE id=$1 AND sender_id=$2 RETURNING id, chat_id', [req.params.id, req.uid]);
  if (!m) return res.sendStatus(404);
  io.to(`chat:${m.chat_id}`).emit('message:deleted', m); res.sendStatus(204);
});
app.put('/api/messages/:id/hide', guard, async (req, res) => {   // delete for me
  await q(`INSERT INTO hidden_messages(user_id, message_id)
           SELECT $1, m.id FROM messages m JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1
           WHERE m.id=$2 ON CONFLICT DO NOTHING`, [req.uid, req.params.id]);
  res.sendStatus(204);
});
app.put('/api/messages/:id/star', guard, async (req, res) => {
  await q(`INSERT INTO starred_messages SELECT $1, m.id FROM messages m
           JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1 WHERE m.id=$2 ON CONFLICT DO NOTHING`, [req.uid, req.params.id]);
  res.sendStatus(204);
});
app.delete('/api/messages/:id/star', guard, async (req, res) => {
  await q('DELETE FROM starred_messages WHERE user_id=$1 AND message_id=$2', [req.uid, req.params.id]); res.sendStatus(204);
});
app.get('/api/starred', guard, async (req, res) =>
  res.json(await q(`SELECT m.*, c.name AS chat_name, (SELECT name FROM users WHERE id=m.sender_id) AS sender_name
                    FROM starred_messages s JOIN messages m ON m.id=s.message_id
                    JOIN chats c ON c.id=m.chat_id
                    JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1
                    WHERE s.user_id=$1 AND m.deleted_at IS NULL ORDER BY m.created_at DESC`, [req.uid])));
app.put('/api/messages/:id/reaction', guard, async (req, res) => {
  const [m] = await q('SELECT chat_id FROM messages WHERE id=$1', [req.params.id]);
  if (!m || !await isMember(req.uid, m.chat_id)) return res.sendStatus(403);
  const { emoji } = req.body;
  if (!emoji) await q('DELETE FROM reactions WHERE message_id=$1 AND user_id=$2', [req.params.id, req.uid]);
  else await q(`INSERT INTO reactions VALUES($1,$2,$3) ON CONFLICT (message_id,user_id) DO UPDATE SET emoji=$3`, [req.params.id, req.uid, String(emoji).slice(0, 16)]);
  io.to(`chat:${m.chat_id}`).emit('message:reaction', { message_id: req.params.id, user_id: req.uid, emoji: emoji || null });
  res.sendStatus(204);
});

// ---------- uploads (photos, files, voice notes, status images) ----------
fs.mkdirSync('uploads', { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: 'uploads',
    filename: (_, f, cb) => cb(null, crypto.randomUUID() + path.extname(f.originalname).toLowerCase())
  }),
  limits: { fileSize: 25 * 1024 * 1024 }
});
// Only well-known media is rendered inline. Anything else (html, svg, js ...) is forced to download so
// an uploaded file can never run as a page on your origin.
const INLINE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.mp3', '.m4a', '.webm', '.ogg', '.oga', '.wav', '.mp4', '.mov', '.pdf', '.txt']);
app.use('/uploads', express.static('uploads', {
  setHeaders: (r, p) => {
    r.setHeader('X-Content-Type-Options', 'nosniff');
    if (!INLINE_EXT.has(path.extname(p).toLowerCase())) r.setHeader('Content-Disposition', 'attachment');
  }
}));
app.post('/api/upload', guard, upload.single('file'), (req, res) =>
  res.status(201).json({ url: `/uploads/${req.file.filename}`, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype }));

// ---------- status ----------
app.get('/api/statuses', guard, async (req, res) => {
  res.json(await q(`
    SELECT s.*, u.name, EXISTS(SELECT 1 FROM status_views v WHERE v.status_id=s.id AND v.viewer_id=$1) AS seen
    FROM statuses s JOIN users u ON u.id=s.user_id
    WHERE s.expires_at > now() AND (s.user_id=$1 OR s.user_id IN (
      SELECT o.user_id FROM chat_members m JOIN chat_members o ON o.chat_id=m.chat_id AND o.user_id<>$1 WHERE m.user_id=$1))
    ORDER BY s.created_at`, [req.uid]));
});
app.post('/api/statuses', guard, async (req, res) => {
  const body = String(req.body.body || '').slice(0, 700);
  const bg = /^#[0-9a-f]{3,8}$/i.test(req.body.bg || '') ? req.body.bg : '#6366f1';
  const media_url = UPLOAD_RE.test(req.body.media_url || '') ? req.body.media_url : null;
  if (!body.trim() && !media_url) return res.status(400).json({ error: 'Empty status' });
  const [st] = await q('INSERT INTO statuses(user_id, body, bg, media_url) VALUES($1,$2,$3,$4) RETURNING *', [req.uid, body, bg, media_url]);
  const rooms = await q('SELECT chat_id FROM chat_members WHERE user_id=$1', [req.uid]);
  rooms.forEach(r => io.to(`chat:${r.chat_id}`).emit('status:new', { user_id: req.uid }));
  res.status(201).json(st);
});
app.post('/api/statuses/:id/view', guard, async (req, res) => {
  await q('INSERT INTO status_views(status_id, viewer_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.uid]); res.sendStatus(204);
});

// ---------- calls log ----------
app.get('/api/calls', guard, async (req, res) =>
  res.json(await q(`SELECT c.*, cu.name AS caller_name, ce.name AS callee_name FROM calls c
    JOIN users cu ON cu.id=c.caller_id JOIN users ce ON ce.id=c.callee_id
    WHERE $1 IN (c.caller_id, c.callee_id) ORDER BY c.created_at DESC LIMIT 100`, [req.uid])));
app.post('/api/calls', guard, async (req, res) => {
  const { callee_id, video = false, outcome = 'answered', duration_s = 0 } = req.body;
  res.status(201).json((await q('INSERT INTO calls(caller_id,callee_id,video,outcome,duration_s) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [req.uid, callee_id, video, outcome, duration_s]))[0]);
});

// Short-lived TURN credentials (coturn "use-auth-secret" scheme) so calls work across different networks.
app.get('/api/turn', guard, (req, res) => {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
  if (TURN_URL && TURN_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${req.uid}`;
    const credential = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');
    iceServers.push({ urls: [`turn:${TURN_URL}:3478?transport=udp`, `turn:${TURN_URL}:3478?transport=tcp`], username, credential });
  }
  res.json({ iceServers });
});

registerExtras({ app, io, guard });

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

// ---------- realtime (Socket.io) ----------
const online = new Map();   // userId -> open socket count

io.use((socket, next) => {
  try { socket.data.uid = verifyToken(socket.handshake.auth?.token); if (isBanned(socket.data.uid)) return next(new Error('Suspended')); next(); }
  catch { next(new Error('Unauthorized')); }
});

io.on('connection', async socket => {
  const uid = socket.data.uid;
  socket.join(`user:${uid}`);
  const chats = await q('SELECT chat_id FROM chat_members WHERE user_id=$1', [uid]);
  chats.forEach(c => socket.join(`chat:${c.chat_id}`));

  online.set(uid, (online.get(uid) || 0) + 1);
  const me = await priv(uid);
  if (!me.hide_online) chats.forEach(c => socket.to(`chat:${c.chat_id}`).emit('presence', { user_id: uid, online: true }));

  try {
    // who of my contacts is online right now (respecting their privacy setting)
    const peers = await q(`SELECT DISTINCT o.user_id FROM chat_members m JOIN chat_members o ON o.chat_id=m.chat_id AND o.user_id<>$1 WHERE m.user_id=$1`, [uid]);
    const ids = peers.map(p => p.user_id).filter(id => online.has(id));
    const visible = ids.length ? await q('SELECT id FROM users WHERE id = ANY($1) AND NOT hide_online', [ids]) : [];
    socket.emit('presence:init', { online: visible.map(r => r.id) });

    // everything that arrived while I was offline is now "delivered" - tell the senders (grey double tick)
    const rows = await q(`INSERT INTO message_status(message_id, user_id, delivered_at)
      SELECT m.id, $1, now() FROM messages m JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1
      WHERE m.sender_id<>$1 AND m.deleted_at IS NULL AND m.scheduled_at IS NULL AND m.created_at > now() - interval '30 days'
        AND NOT EXISTS (SELECT 1 FROM message_status s WHERE s.message_id=m.id AND s.user_id=$1)
      ON CONFLICT (message_id,user_id) DO NOTHING
      RETURNING (SELECT chat_id FROM messages x WHERE x.id=message_status.message_id) AS chat_id`, [uid]);
    [...new Set(rows.map(r => r.chat_id))].forEach(id => socket.to(`chat:${id}`).emit('chat:delivered', { chat_id: id, user_id: uid }));
  } catch (e) { console.error('connect:', e.message); }

  let sent = [];   // at most 30 messages per 10 seconds per connection
  socket.on('message:send', async (d, ack) => {
    const now = Date.now(); sent = sent.filter(t => now - t < 10_000);
    if (sent.length >= 30) return ack?.({ ok: false, error: 'slow down' });
    sent.push(now);
    try {
      const m = await saveMessage(uid, d.chat_id, d);
      ack?.(m ? { ok: true, message: m } : { ok: false });
    } catch (e) { console.error('message:send', e.message); ack?.({ ok: false }); }
  });

  socket.on('message:delivered', async ({ message_id }) => {
    try {
      const [m] = await q(`INSERT INTO message_status(message_id, user_id, delivered_at)
        SELECT id, $2, now() FROM messages WHERE id=$1 AND EXISTS (SELECT 1 FROM chat_members WHERE chat_id=messages.chat_id AND user_id=$2)
        ON CONFLICT (message_id,user_id) DO UPDATE SET delivered_at=COALESCE(message_status.delivered_at, now()) RETURNING message_id`, [message_id, uid]);
      const [msg] = await q('SELECT chat_id FROM messages WHERE id=$1', [message_id]);
      if (m && msg) socket.to(`chat:${msg.chat_id}`).emit('message:delivered', { message_id, user_id: uid });
    } catch (e) { console.error('delivered', e.message); }
  });

  socket.on('chat:read', async ({ chat_id }) => {
    try {
      if (!await isMember(uid, chat_id)) return;
      await q('UPDATE chat_members SET last_read_at=now() WHERE chat_id=$1 AND user_id=$2', [chat_id, uid]);
      await q(`INSERT INTO message_status(message_id, user_id, delivered_at, read_at)
        SELECT id, $2, now(), now() FROM messages WHERE chat_id=$1 AND sender_id<>$2
        ON CONFLICT (message_id,user_id) DO UPDATE SET read_at=COALESCE(message_status.read_at, now())`, [chat_id, uid]);
      if (!(await priv(uid)).hide_read) socket.to(`chat:${chat_id}`).emit('chat:read', { chat_id, user_id: uid });   // blue ticks
    } catch (e) { console.error('read', e.message); }
  });

  socket.on('typing', async ({ chat_id, typing }) => {
    if (!socket.rooms.has(`chat:${chat_id}`)) return;
    if (!(await priv(uid)).hide_typing) socket.to(`chat:${chat_id}`).emit('typing', { chat_id, user_id: uid, typing: !!typing });
  });

  // WebRTC signalling relay for voice/video calls
  for (const ev of ['call:offer', 'call:answer', 'call:ice', 'call:end'])
    socket.on(ev, ({ to, ...data }) => io.to(`user:${to}`).emit(ev, { from: uid, ...data }));

  socket.on('disconnect', async () => {
    const n = (online.get(uid) || 1) - 1;
    if (n > 0) return online.set(uid, n);
    online.delete(uid);
    try {
      await q('UPDATE users SET last_seen=now() WHERE id=$1', [uid]);
      if (!(await priv(uid)).hide_online) {
        const cs = await q('SELECT chat_id FROM chat_members WHERE user_id=$1', [uid]);
        cs.forEach(c => io.to(`chat:${c.chat_id}`).emit('presence', { user_id: uid, online: false, last_seen: new Date() }));
      }
    } catch (e) { console.error('disconnect', e.message); }
  });
});

// release scheduled messages
setInterval(async () => {
  try {
    const rows = await q('UPDATE messages SET created_at=now(), scheduled_at=NULL WHERE scheduled_at <= now() RETURNING *');
    for (const m of rows) {
      await decorate(m);
      io.to(`chat:${m.chat_id}`).emit('message:new', m);
      pushToChat(m.chat_id, m);
    }
    await q('DELETE FROM statuses WHERE expires_at < now()');
  } catch (e) { console.error('scheduler:', e.message); }
}, 10_000);

ensureSchema()
  .then(() => ensureExtras()).then(() => server.listen(PORT, () => console.log(`LIBRA API running on http://localhost:${PORT}`)))
  .catch(e => { console.error('Schema setup failed:', e); process.exit(1); });