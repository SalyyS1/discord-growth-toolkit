-- Guild bot đang ở. left_at != NULL nghĩa là bot đã bị kick/rời.
CREATE TABLE IF NOT EXISTS guilds (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  icon          TEXT,
  member_count  INTEGER NOT NULL DEFAULT 0,
  owner_id      TEXT,
  joined_at     TEXT NOT NULL,
  left_at       TEXT
);

-- Cấu hình riêng cho từng guild đối tác (panel, DM, nhãn nguồn, invite dùng).
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id             TEXT PRIMARY KEY,
  source_label         TEXT,
  invite_code          TEXT,
  panel_template_id    INTEGER,
  dm_template_id       INTEGER,
  welcome_template_id  INTEGER,
  welcome_dm_enabled   INTEGER NOT NULL DEFAULT 0,
  notes                TEXT,
  updated_at           TEXT
);

-- Nội dung soạn ở dashboard. payload là JSON của TemplatePayload.
CREATE TABLE IF NOT EXISTS templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- Mỗi nguồn kéo người dùng một invite code riêng để quy công chính xác.
CREATE TABLE IF NOT EXISTS invite_sources (
  code             TEXT PRIMARY KEY,
  guild_id         TEXT NOT NULL,
  label            TEXT NOT NULL,
  channel_id       TEXT,
  origin_guild_id  TEXT,
  created_at       TEXT NOT NULL,
  uses             INTEGER NOT NULL DEFAULT 0
);

-- Một dòng cho mỗi lần user join home guild. left_at dùng để tính retention.
CREATE TABLE IF NOT EXISTS joins (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id            TEXT NOT NULL,
  user_id             TEXT NOT NULL,
  username            TEXT,
  avatar              TEXT,
  account_created_at  TEXT,
  joined_at           TEXT NOT NULL,
  left_at             TEXT,
  invite_code         TEXT,
  source_label        TEXT,
  inviter_id          TEXT,
  inviter_tag         TEXT
);
CREATE INDEX IF NOT EXISTS idx_joins_guild_time ON joins (guild_id, joined_at);
CREATE INDEX IF NOT EXISTS idx_joins_source ON joins (source_label);
CREATE INDEX IF NOT EXISTS idx_joins_user ON joins (user_id);

-- Bằng chứng consent: user tự bấm nút ở panel mới được DM.
CREATE TABLE IF NOT EXISTS panel_clicks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  UNIQUE (guild_id, user_id)
);

-- Log mọi lần gửi DM: sent | blocked_dm | failed | duplicate.
CREATE TABLE IF NOT EXISTS outreach_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          TEXT NOT NULL,
  username         TEXT,
  origin_guild_id  TEXT,
  template_id      INTEGER,
  status           TEXT NOT NULL,
  error            TEXT,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outreach_origin ON outreach_log (origin_guild_id);

-- Tin đã publish, giữ message_id để sửa lại nội dung sau này.
CREATE TABLE IF NOT EXISTS published_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT,
  channel_id  TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  template_id INTEGER,
  mode        TEXT NOT NULL,
  webhook_url TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Người tự bấm nút đăng ký nhận thông báo ở home guild. Đây là bằng chứng consent
-- cho mọi DM thông báo về sau; huỷ đăng ký thì ghi unsubscribed_at, không xoá dòng
-- để còn dấu vết ai từng đồng ý và đã rút lại lúc nào.
CREATE TABLE IF NOT EXISTS notify_subscribers (
  guild_id         TEXT NOT NULL,
  user_id          TEXT NOT NULL,
  username         TEXT,
  subscribed_at    TEXT NOT NULL,
  unsubscribed_at  TEXT,
  PRIMARY KEY (guild_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_notify_active ON notify_subscribers (guild_id, unsubscribed_at);

-- Một đợt gửi thông báo. audience = 'subscribers' (người tự bấm nút) hoặc
-- 'role' (mọi thành viên đang có role thông báo).
CREATE TABLE IF NOT EXISTS notify_campaigns (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  name         TEXT NOT NULL,
  template_id  INTEGER,
  audience     TEXT NOT NULL DEFAULT 'subscribers',
  role_id      TEXT,
  created_at   TEXT NOT NULL,
  finished_at  TEXT
);

-- Một dòng cho mỗi (đợt, người nhận): chạy lại đợt cũ không gửi trùng cho người
-- đã nhận được, nhưng vẫn thử lại người trước đó bị chặn DM.
CREATE TABLE IF NOT EXISTS notify_campaign_sends (
  campaign_id  INTEGER NOT NULL,
  user_id      TEXT NOT NULL,
  status       TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  PRIMARY KEY (campaign_id, user_id)
);
