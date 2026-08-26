import { db, nowIso } from './database';

export interface InviteSourceRow {
  code: string;
  guild_id: string;
  label: string;
  channel_id: string | null;
  origin_guild_id: string | null;
  created_at: string;
  uses: number;
}

export interface JoinRow {
  id: number;
  guild_id: string;
  user_id: string;
  username: string | null;
  avatar: string | null;
  account_created_at: string | null;
  joined_at: string;
  left_at: string | null;
  invite_code: string | null;
  source_label: string | null;
  inviter_id: string | null;
  inviter_tag: string | null;
}

export interface OutreachRow {
  id: number;
  user_id: string;
  username: string | null;
  origin_guild_id: string | null;
  template_id: number | null;
  status: string;
  error: string | null;
  created_at: string;
}

export type OutreachStatus = 'sent' | 'blocked_dm' | 'failed' | 'duplicate';

export function upsertInviteSource(input: {
  code: string;
  guildId: string;
  label: string;
  channelId?: string | null;
  originGuildId?: string | null;
  uses?: number;
}): void {
  db.prepare(
    `INSERT INTO invite_sources (code, guild_id, label, channel_id, origin_guild_id, created_at, uses)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (code) DO UPDATE SET
       label = excluded.label,
       channel_id = excluded.channel_id,
       origin_guild_id = excluded.origin_guild_id,
       uses = excluded.uses`,
  ).run(
    input.code,
    input.guildId,
    input.label,
    input.channelId ?? null,
    input.originGuildId ?? null,
    nowIso(),
    input.uses ?? 0,
  );
}

export function listInviteSources(guildId?: string): InviteSourceRow[] {
  const rows = guildId
    ? db.prepare('SELECT * FROM invite_sources WHERE guild_id = ? ORDER BY created_at DESC').all(guildId)
    : db.prepare('SELECT * FROM invite_sources ORDER BY created_at DESC').all();
  return rows as unknown as InviteSourceRow[];
}

export function getInviteSource(code: string): InviteSourceRow | null {
  const row = db.prepare('SELECT * FROM invite_sources WHERE code = ?').get(code);
  return (row as unknown as InviteSourceRow) ?? null;
}

export function setInviteUses(code: string, uses: number): void {
  db.prepare('UPDATE invite_sources SET uses = ? WHERE code = ?').run(uses, code);
}

export function deleteInviteSource(code: string): boolean {
  return db.prepare('DELETE FROM invite_sources WHERE code = ?').run(code).changes > 0;
}

export function recordJoin(input: {
  guildId: string;
  userId: string;
  username: string | null;
  avatar: string | null;
  accountCreatedAt: string | null;
  inviteCode: string | null;
  sourceLabel: string | null;
  inviterId: string | null;
  inviterTag: string | null;
}): void {
  db.prepare(
    `INSERT INTO joins (guild_id, user_id, username, avatar, account_created_at, joined_at,
       invite_code, source_label, inviter_id, inviter_tag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.guildId,
    input.userId,
    input.username,
    input.avatar,
    input.accountCreatedAt,
    nowIso(),
    input.inviteCode,
    input.sourceLabel,
    input.inviterId,
    input.inviterTag,
  );
}

/** Đánh dấu rời server cho bản ghi join mới nhất còn mở của user. */
export function markMemberLeft(guildId: string, userId: string): void {
  db.prepare(
    `UPDATE joins SET left_at = ?
     WHERE id = (
       SELECT id FROM joins
       WHERE guild_id = ? AND user_id = ? AND left_at IS NULL
       ORDER BY joined_at DESC LIMIT 1
     )`,
  ).run(nowIso(), guildId, userId);
}

export function listJoins(options: { limit?: number; source?: string } = {}): JoinRow[] {
  const limit = options.limit ?? 100;
  const rows = options.source
    ? db
        .prepare('SELECT * FROM joins WHERE source_label = ? ORDER BY joined_at DESC LIMIT ?')
        .all(options.source, limit)
    : db.prepare('SELECT * FROM joins ORDER BY joined_at DESC LIMIT ?').all(limit);
  return rows as unknown as JoinRow[];
}

/** true nếu đây là lần bấm đầu tiên của user ở guild đó (tức consent mới). */
export function recordPanelClick(guildId: string, userId: string): boolean {
  const result = db
    .prepare(
      'INSERT OR IGNORE INTO panel_clicks (guild_id, user_id, created_at) VALUES (?, ?, ?)',
    )
    .run(guildId, userId, nowIso());
  return result.changes > 0;
}

export function logOutreach(input: {
  userId: string;
  username: string | null;
  originGuildId: string | null;
  templateId: number | null;
  status: OutreachStatus;
  error?: string | null;
}): void {
  db.prepare(
    `INSERT INTO outreach_log (user_id, username, origin_guild_id, template_id, status, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.userId,
    input.username,
    input.originGuildId,
    input.templateId,
    input.status,
    input.error ?? null,
    nowIso(),
  );
}

export function listOutreach(limit = 100): OutreachRow[] {
  return db
    .prepare('SELECT * FROM outreach_log ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as OutreachRow[];
}
