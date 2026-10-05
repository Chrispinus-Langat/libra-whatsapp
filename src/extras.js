// LIBRA extras: block / report / delete account / archive / group photo / message search / status tools / admin.
import express from 'express';
import { q } from './db.js';

const UPLOAD_RE = /^\/uploads\/[\w.-]{1,100}$/;
const REASONS = ['Spam', 'Harassment or bullying', 'Scam or fraud', 'Inappropriate content', 'Other'];
const banned = new Set();                       // suspended or deleted accounts
export const isBanned = id => banned.has(id);

async function loadBanned() {
  const rows = await q('SELECT id FROM users WHERE banned_at IS NOT NULL OR deleted_at IS NOT NULL');
  banned.clear(); rows.forEach(r => banned.add(r.id));
}

export async function ensureExtras() {
  const idOf = async t => (await q(`SELECT format_type(atttypid, atttypmod) AS t FROM pg_attribute WHERE attrelid=$1::regclass AND attname='id'`, [t]))[0]?.t || 'uuid';
  const UID = await idOf('users'), MID = await idOf('messages'), CID = await idOf('chats');
  await q('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text');
  await q('ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at timestamptz');
  await q('ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz');
  await q('ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url text');
  await q('ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false');
  await q(`CREATE TABLE IF NOT EXISTS blocks(
    blocker_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (blocker_id, blocked_id))`);
  await q(`CREATE TABLE IF NOT EXISTS reports(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_id ${UID} NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id ${CID} REFERENCES chats(id) ON DELETE SET NULL,
    message_id ${MID} REFERENCES messages(id) ON DELETE SET NULL,
    reason text NOT NULL, details text, created_at timestamptz NOT NULL DEFAULT now())`);
  // allow the new message kinds
  await q('ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_kind_check');
  await q(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='messages_kind_ok') THEN
      ALTER TABLE messages ADD CONSTRAINT messages_kind_ok
        CHECK (kind IN ('text','image','file','voice','video','sticker','location','contact'));
    END IF; END $$`);
  await loadBanned();
  setInterval(() => loadBanned().catch(() => {}), 60_000);
}

// true if either person in a direct chat has blocked the other
export async function isBlocked(uid, chatId) {
  const rows = await q(`SELECT 1 FROM chats c JOIN chat_members o ON o.chat_id=c.id AND o.user_id<>$1
    WHERE c.id=$2 AND NOT c.is_group AND EXISTS (SELECT 1 FROM blocks b
      WHERE (b.blocker_id=$1 AND b.blocked_id=o.user_id) OR (b.blocker_id=o.user_id AND b.blocked_id=$1))`, [uid, chatId]);
  return rows.length > 0;
}

export function registerExtras({ app, io, guard }) {
  const r = express.Router();
  r.use(guard);
  const adminPhones = (process.env.ADMIN_PHONES || '').split(',').map(s => s.trim()).filter(Boolean);
  const isAdmin = async uid => adminPhones.length > 0 && (await q('SELECT 1 FROM users WHERE id=$1 AND phone = ANY($2)', [uid, adminPhones])).length > 0;
  const needAdmin = async (req, res, next) => (await isAdmin(req.uid)) ? next() : res.sendStatus(403);
  const kick = id => io.in(`user:${id}`).disconnectSockets(true);

  // avatars, archived/muted flags and block state for every chat, in one request
  r.get('/meta', async (req, res) => {
    const chats = await q(`
      SELECT c.id, CASE WHEN c.is_group THEN c.avatar_url ELSE u.avatar_url END AS avatar, cm.archived, cm.muted,
        (u.id IS NOT NULL AND EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id=$1 AND b.blocked_id=u.id)) AS blocked_by_me,
        (u.id IS NOT NULL AND EXISTS (SELECT 1 FROM blocks b WHERE b.blocker_id=u.id AND b.blocked_id=$1)) AS blocked_me
      FROM chats c JOIN chat_members cm ON cm.chat_id=c.id AND cm.user_id=$1
      LEFT JOIN chat_members o ON o.chat_id=c.id AND o.user_id<>$1 AND NOT c.is_group
      LEFT JOIN users u ON u.id=o.user_id`, [req.uid]);
    const blocked = await q('SELECT u.id, u.name, u.phone FROM blocks b JOIN users u ON u.id=b.blocked_id WHERE b.blocker_id=$1 ORDER BY lower(u.name)', [req.uid]);
    const [me] = await q('SELECT avatar_url FROM users WHERE id=$1', [req.uid]);
    res.json({ chats: Object.fromEntries(chats.map(c => [c.id, c])), blocked, me, admin: await isAdmin(req.uid) });
  });

  r.put('/block/:uid', async (req, res) => {
    if (req.params.uid === req.uid) return res.status(400).json({ error: 'You cannot block yourself' });
    await q('INSERT INTO blocks(blocker_id, blocked_id) SELECT $1, id FROM users WHERE id=$2 ON CONFLICT DO NOTHING', [req.uid, req.params.uid]);
    res.sendStatus(204);
  });
  r.delete('/block/:uid', async (req, res) => {
    await q('DELETE FROM blocks WHERE blocker_id=$1 AND blocked_id=$2', [req.uid, req.params.uid]); res.sendStatus(204);
  });

  r.post('/report', async (req, res) => {
    const { user_id, chat_id = null, message_id = null, details = '' } = req.body || {};
    const reason = REASONS.includes(req.body?.reason) ? req.body.reason : 'Other';
    if (!user_id || user_id === req.uid) return res.status(400).json({ error: 'Nothing to report' });
    const [recent] = await q(`SELECT count(*)::int AS n FROM reports WHERE reporter_id=$1 AND created_at > now() - interval '1 hour'`, [req.uid]);
    if (recent.n >= 10) return res.status(429).json({ error: 'Too many reports. Please try again later.' });
    await q('INSERT INTO reports(reporter_id, reported_id, chat_id, message_id, reason, details) VALUES($1,$2,$3,$4,$5,$6)',
      [req.uid, user_id, chat_id, message_id, reason, String(details).slice(0, 500)]);
    res.sendStatus(204);
  });

  r.patch('/chat/:id', async (req, res) => {          // archive / unarchive
    await q('UPDATE chat_members SET archived=$3 WHERE chat_id=$1 AND user_id=$2', [req.params.id, req.uid, !!req.body.archived]);
    res.sendStatus(204);
  });

  r.patch('/group/:id', async (req, res) => {         // group photo
    const admin = (await q("SELECT 1 FROM chat_members WHERE chat_id=$1 AND user_id=$2 AND role='admin'", [req.params.id, req.uid])).length > 0;
    if (!admin) return res.sendStatus(403);
    const url = UPLOAD_RE.test(req.body.avatar_url || '') ? req.body.avatar_url : null;
    await q('UPDATE chats SET avatar_url=$2 WHERE id=$1 AND is_group', [req.params.id, url]);
    io.to(`chat:${req.params.id}`).emit('group:updated', { chat_id: req.params.id });
    res.sendStatus(204);
  });

  r.get('/search', async (req, res) => {              // find text messages across all my chats
    const s = String(req.query.q || '').trim().slice(0, 60);
    if (s.length < 2) return res.json([]);
    const like = '%' + s.replace(/[%_\\]/g, m => '\\' + m) + '%';
    res.json(await q(`
      SELECT m.id, m.chat_id, m.body, m.created_at, COALESCE(c.name, ou.name) AS chat_name, (SELECT name FROM users WHERE id=m.sender_id) AS sender_name
      FROM messages m JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=$1
      JOIN chats c ON c.id=m.chat_id
      LEFT JOIN chat_members o ON o.chat_id=c.id AND o.user_id<>$1 AND NOT c.is_group
      LEFT JOIN users ou ON ou.id=o.user_id
      WHERE m.kind='text' AND m.deleted_at IS NULL AND m.scheduled_at IS NULL AND m.body ILIKE $2
        AND NOT EXISTS (SELECT 1 FROM hidden_messages h WHERE h.message_id=m.id AND h.user_id=$1)
      ORDER BY m.created_at DESC LIMIT 30`, [req.uid, like]));
  });

  // who has seen my status (people who hide read receipts are not listed)
  r.get('/status/:id/viewers', async (req, res) => {
    if (!(await q('SELECT 1 FROM statuses WHERE id=$1 AND user_id=$2', [req.params.id, req.uid])).length) return res.sendStatus(404);
    res.json(await q(`SELECT u.id, u.name, v.viewed_at FROM status_views v JOIN users u ON u.id=v.viewer_id
                      WHERE v.status_id=$1 AND NOT u.hide_read ORDER BY v.viewed_at DESC`, [req.params.id]));
  });
  r.delete('/status/:id', async (req, res) => {
    await q('DELETE FROM statuses WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]); res.sendStatus(204);
  });

  // delete my account: personal data is wiped, old messages stay in other people's chats as "Deleted account"
  r.delete('/me', async (req, res) => {
    if (req.body?.confirm !== 'DELETE') return res.status(400).json({ error: 'Type DELETE to confirm' });
    const id = req.uid;
    await q(`UPDATE users SET name='Deleted account', about='', avatar_url=NULL, phone='deleted:' || id::text, deleted_at=now() WHERE id=$1`, [id]);
    await q('DELETE FROM push_subscriptions WHERE user_id=$1', [id]);
    await q('DELETE FROM statuses WHERE user_id=$1', [id]);
    await q('DELETE FROM user_contacts WHERE owner_id=$1 OR contact_id=$1', [id]);
    await q('DELETE FROM chat_members WHERE user_id=$1 AND chat_id IN (SELECT id FROM chats WHERE is_group)', [id]);
    banned.add(id); kick(id);
    res.sendStatus(204);
  });

  // ---- admin (set ADMIN_PHONES=+2547...,+2547... in .env) ----
  r.get('/admin/reports', needAdmin, async (_req, res) => {
    res.json(await q(`
      SELECT r.id, r.reason, r.details, r.created_at, rep.name AS reporter, rep.phone AS reporter_phone,
             tgt.id AS target_id, tgt.name AS target, tgt.phone AS target_phone, (tgt.banned_at IS NOT NULL) AS suspended,
             (SELECT body FROM messages WHERE id=r.message_id) AS message
      FROM reports r JOIN users rep ON rep.id=r.reporter_id JOIN users tgt ON tgt.id=r.reported_id
      ORDER BY r.created_at DESC LIMIT 200`));
  });
  r.post('/admin/suspend/:uid', needAdmin, async (req, res) => {
    await q('UPDATE users SET banned_at=now() WHERE id=$1', [req.params.uid]); banned.add(req.params.uid); kick(req.params.uid); res.sendStatus(204);
  });
  r.post('/admin/unsuspend/:uid', needAdmin, async (req, res) => {
    await q('UPDATE users SET banned_at=NULL WHERE id=$1 AND deleted_at IS NULL', [req.params.uid]); await loadBanned(); res.sendStatus(204);
  });

  app.use('/api/extras', r);
}
