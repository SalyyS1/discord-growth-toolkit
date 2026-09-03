import { db, nowIso } from './database';
import { getSetting, setSetting } from './repo-content';

/** Chỉ có một role thông báo cho home guild nên dùng settings thay vì thêm bảng config. */
const NOTIFY_ROLE_KEY = 'notify_role_id';

export interface NotifySubscriberRow {
  guild_id: string;
  user_id: string;
  username: string | null;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface NotifyCampaignRow {
  id: number;
  guild_id: string;
  name: string;
  template_id: number | null;
  audience: NotifyAudience;
  role_id: string | null;
  created_at: string;
  finished_at: string | null;
}

/** 'subscribers' = người tự bấm nút; 'role' = mọi thành viên đang có role thông báo. */
export type NotifyAudience = 'subscribers' | 'role';

/** 'skipped' = đã rời server hoặc đã nhận ở lần chạy trước. */
export type CampaignSendStatus = 'sent' | 'blocked_dm' | 'failed' | 'skipped';

export type SubscribeOutcome = 'subscribed' | 'resubscribed' | 'already';

export function getNotifyRoleId(): string | null {
  const value = getSetting(NOTIFY_ROLE_KEY);
  return value && value.length > 0 ? value : null;
}

export function setNotifyRoleId(roleId: string | null): void {
  setSetting(NOTIFY_ROLE_KEY, roleId ?? '');
}

export function getSubscriber(guildId: string, userId: string): NotifySubscriberRow | null {
  const row = db
    .prepare('SELECT * FROM notify_subscribers WHERE guild_id = ? AND user_id = ?')
    .get(guildId, userId);
  return (row as unknown as NotifySubscriberRow) ?? null;
}

/**
 * Ghi consent. Người từng huỷ mà bấm lại thì mở lại đăng ký (resubscribed) —
 * dòng cũ được cập nhật nên lịch sử vẫn là một bản ghi cho mỗi user.
 */
export function subscribeNotify(input: {
  guildId: string;
  userId: string;
  username: string | null;
}): SubscribeOutcome {
  const existing = getSubscriber(input.guildId, input.userId);
  if (existing && existing.unsubscribed_at === null) return 'already';

  db.prepare(
    `INSERT INTO notify_subscribers (guild_id, user_id, username, subscribed_at, unsubscribed_at)
     VALUES (?, ?, ?, ?, NULL)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET
       username = excluded.username,
       subscribed_at = excluded.subscribed_at,
       unsubscribed_at = NULL`,
  ).run(input.guildId, input.userId, input.username, nowIso());

  return existing ? 'resubscribed' : 'subscribed';
}

/**
 * Ghi lại việc rút đăng ký. Người nhận theo role có thể chưa có dòng nào, nên
 * phải tạo mới dòng đã-huỷ — nếu không lần gửi theo role sau vẫn DM cho họ.
 * false = trước đó đã huỷ rồi, không có gì thay đổi.
 */
export function unsubscribeNotify(guildId: string, userId: string): boolean {
  const existing = getSubscriber(guildId, userId);
  if (existing?.unsubscribed_at) return false;

  const timestamp = nowIso();
  db.prepare(
    `INSERT INTO notify_subscribers (guild_id, user_id, username, subscribed_at, unsubscribed_at)
     VALUES (?, ?, NULL, ?, ?)
     ON CONFLICT (guild_id, user_id) DO UPDATE SET unsubscribed_at = excluded.unsubscribed_at`,
  ).run(guildId, userId, existing?.subscribed_at ?? timestamp, timestamp);

  return true;
}

/** Người đã rút đăng ký — phải loại khỏi mọi đợt gửi, kể cả gửi theo role. */
export function listUnsubscribedUserIds(guildId: string): Set<string> {
  const rows = db
    .prepare(
      'SELECT user_id FROM notify_subscribers WHERE guild_id = ? AND unsubscribed_at IS NOT NULL',
    )
    .all(guildId) as unknown as { user_id: string }[];
  return new Set(rows.map((row) => row.user_id));
}

export function listActiveSubscribers(guildId: string): NotifySubscriberRow[] {
  return db
    .prepare(
      `SELECT * FROM notify_subscribers
       WHERE guild_id = ? AND unsubscribed_at IS NULL
       ORDER BY subscribed_at`,
    )
    .all(guildId) as unknown as NotifySubscriberRow[];
}

export function countActiveSubscribers(guildId: string): number {
  const row = db
    .prepare(
      'SELECT COUNT(*) AS total FROM notify_subscribers WHERE guild_id = ? AND unsubscribed_at IS NULL',
    )
    .get(guildId) as { total: number } | undefined;
  return row?.total ?? 0;
}

export function createCampaign(input: {
  guildId: string;
  name: string;
  templateId: number | null;
  audience: NotifyAudience;
  roleId: string | null;
}): NotifyCampaignRow {
  const result = db
    .prepare(
      `INSERT INTO notify_campaigns (guild_id, name, template_id, audience, role_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(input.guildId, input.name, input.templateId, input.audience, input.roleId, nowIso());
  return getCampaign(Number(result.lastInsertRowid))!;
}

export function getCampaign(id: number): NotifyCampaignRow | null {
  const row = db.prepare('SELECT * FROM notify_campaigns WHERE id = ?').get(id);
  return (row as unknown as NotifyCampaignRow) ?? null;
}

export function listCampaigns(limit = 20): NotifyCampaignRow[] {
  return db
    .prepare('SELECT * FROM notify_campaigns ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as NotifyCampaignRow[];
}

export function finishCampaign(id: number): void {
  db.prepare('UPDATE notify_campaigns SET finished_at = ? WHERE id = ?').run(nowIso(), id);
}

/** Đã gửi tới được người này trong đợt đó chưa — mốc để không gửi trùng. */
export function hasCampaignDelivery(campaignId: number, userId: string): boolean {
  const row = db
    .prepare(
      `SELECT 1 AS ok FROM notify_campaign_sends
       WHERE campaign_id = ? AND user_id = ? AND status = 'sent'`,
    )
    .get(campaignId, userId);
  return Boolean(row);
}

export function recordCampaignSend(
  campaignId: number,
  userId: string,
  status: CampaignSendStatus,
): void {
  db.prepare(
    `INSERT INTO notify_campaign_sends (campaign_id, user_id, status, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (campaign_id, user_id) DO UPDATE SET
       status = excluded.status,
       created_at = excluded.created_at`,
  ).run(campaignId, userId, status, nowIso());
}

export function campaignStatusCounts(campaignId: number): Record<string, number> {
  const rows = db
    .prepare(
      'SELECT status, COUNT(*) AS total FROM notify_campaign_sends WHERE campaign_id = ? GROUP BY status',
    )
    .all(campaignId) as unknown as { status: string; total: number }[];
  return Object.fromEntries(rows.map((row) => [row.status, row.total]));
}
