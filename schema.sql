-- LIBRA database schema (PostgreSQL 14+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  phone        TEXT UNIQUE NOT NULL,
  about        TEXT NOT NULL DEFAULT 'Hey there! I am using LIBRA',
  avatar_url   TEXT,
  accent       TEXT NOT NULL DEFAULT '#14b8a6',
  -- privacy / ghost mode
  hide_online  BOOLEAN NOT NULL DEFAULT false,
  hide_read    BOOLEAN NOT NULL DEFAULT false,
  hide_typing  BOOLEAN NOT NULL DEFAULT false,
  last_seen    TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE otp_codes (
  phone       TEXT PRIMARY KEY,
  code_hash   TEXT NOT NULL,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE chats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group    BOOLEAN NOT NULL DEFAULT false,
  name        TEXT,
  created_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE chat_members (
  chat_id       UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member',
  pinned        BOOLEAN NOT NULL DEFAULT false,
  muted         BOOLEAN NOT NULL DEFAULT false,
  folder        TEXT,
  last_read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id       UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES users(id),
  body          TEXT NOT NULL DEFAULT '',
  kind          TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','file','voice')),
  media_url     TEXT,
  media_meta    JSONB,                       -- {name,size,duration,waveform}
  reply_to      UUID REFERENCES messages(id) ON DELETE SET NULL,
  edited_at     TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,                 -- NULL = sent immediately
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_chat ON messages (chat_id, created_at DESC);
CREATE INDEX idx_messages_sched ON messages (scheduled_at) WHERE scheduled_at IS NOT NULL;

CREATE TABLE message_status (
  message_id    UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  delivered_at  TIMESTAMPTZ,
  read_at       TIMESTAMPTZ,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE starred_messages (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, message_id)
);

CREATE TABLE reactions (
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE statuses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL DEFAULT '',
  bg          TEXT NOT NULL DEFAULT '#6366f1',
  media_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE TABLE status_views (
  status_id  UUID REFERENCES statuses(id) ON DELETE CASCADE,
  viewer_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

CREATE TABLE calls (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_id   UUID NOT NULL REFERENCES users(id),
  callee_id   UUID NOT NULL REFERENCES users(id),
  video       BOOLEAN NOT NULL DEFAULT false,
  outcome     TEXT NOT NULL CHECK (outcome IN ('answered','missed','declined')),
  duration_s  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);