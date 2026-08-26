import { db, isoDaysAgo } from './database';

export interface DailyJoins {
  day: string;
  joins: number;
}

export interface SourceBreakdownRow {
  source: string;
  joins: number;
  still_member: number;
  retained_7d: number;
  eligible_7d: number;
  retained_30d: number;
  eligible_30d: number;
}

export interface GuildFunnelRow {
  guild_id: string;
  guild_name: string;
  source_label: string | null;
  clicks: number;
  dms_sent: number;
  dms_blocked: number;
  joins: number;
}

export interface OverviewTotals {
  total_joins: number;
  still_member: number;
  joins_7d: number;
  joins_30d: number;
  dms_sent: number;
  dms_blocked: number;
  clicks: number;
}

/** Join theo từng ngày, gồm cả ngày 0 join để chart không bị co lại. */
export function joinsPerDay(guildId: string, days = 30): DailyJoins[] {
  const rows = db
    .prepare(
      `SELECT substr(joined_at, 1, 10) AS day, COUNT(*) AS joins
       FROM joins WHERE guild_id = ? AND joined_at >= ?
       GROUP BY day ORDER BY day`,
    )
    .all(guildId, isoDaysAgo(days)) as unknown as DailyJoins[];

  const byDay = new Map(rows.map((row) => [row.day, row.joins]));
  const series: DailyJoins[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
    series.push({ day, joins: byDay.get(day) ?? 0 });
  }
  return series;
}

/**
 * Tỷ lệ giữ người tính trên số người đã "đủ tuổi" (join trước mốc 7/30 ngày),
 * nên người vừa join hôm nay không làm loãng số liệu.
 */
export function sourceBreakdown(guildId: string): SourceBreakdownRow[] {
  const sevenDaysAgo = isoDaysAgo(7);
  const thirtyDaysAgo = isoDaysAgo(30);
  return db
    .prepare(
      `SELECT
         COALESCE(source_label, '(không rõ)') AS source,
         COUNT(*) AS joins,
         SUM(CASE WHEN left_at IS NULL THEN 1 ELSE 0 END) AS still_member,
         SUM(CASE WHEN joined_at <= ? AND left_at IS NULL THEN 1 ELSE 0 END) AS retained_7d,
         SUM(CASE WHEN joined_at <= ? THEN 1 ELSE 0 END) AS eligible_7d,
         SUM(CASE WHEN joined_at <= ? AND left_at IS NULL THEN 1 ELSE 0 END) AS retained_30d,
         SUM(CASE WHEN joined_at <= ? THEN 1 ELSE 0 END) AS eligible_30d
       FROM joins
       WHERE guild_id = ?
       GROUP BY source
       ORDER BY joins DESC`,
    )
    .all(sevenDaysAgo, sevenDaysAgo, thirtyDaysAgo, thirtyDaysAgo, guildId) as unknown as SourceBreakdownRow[];
}

/** Phễu theo từng server đối tác: bấm nút → nhận DM → thực sự join home guild. */
export function guildFunnel(homeGuildId: string): GuildFunnelRow[] {
  return db
    .prepare(
      `SELECT
         g.id AS guild_id,
         g.name AS guild_name,
         gc.source_label AS source_label,
         (SELECT COUNT(*) FROM panel_clicks pc WHERE pc.guild_id = g.id) AS clicks,
         (SELECT COUNT(*) FROM outreach_log o
            WHERE o.origin_guild_id = g.id AND o.status = 'sent') AS dms_sent,
         (SELECT COUNT(*) FROM outreach_log o
            WHERE o.origin_guild_id = g.id AND o.status = 'blocked_dm') AS dms_blocked,
         (SELECT COUNT(*) FROM joins j
            WHERE j.guild_id = ? AND j.source_label = gc.source_label) AS joins
       FROM guilds g
       LEFT JOIN guild_config gc ON gc.guild_id = g.id
       WHERE g.left_at IS NULL AND g.id != ?
       ORDER BY joins DESC, clicks DESC`,
    )
    .all(homeGuildId, homeGuildId) as unknown as GuildFunnelRow[];
}

export function overviewTotals(guildId: string): OverviewTotals {
  const row = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM joins WHERE guild_id = ?) AS total_joins,
         (SELECT COUNT(*) FROM joins WHERE guild_id = ? AND left_at IS NULL) AS still_member,
         (SELECT COUNT(*) FROM joins WHERE guild_id = ? AND joined_at >= ?) AS joins_7d,
         (SELECT COUNT(*) FROM joins WHERE guild_id = ? AND joined_at >= ?) AS joins_30d,
         (SELECT COUNT(*) FROM outreach_log WHERE status = 'sent') AS dms_sent,
         (SELECT COUNT(*) FROM outreach_log WHERE status = 'blocked_dm') AS dms_blocked,
         (SELECT COUNT(*) FROM panel_clicks) AS clicks`,
    )
    .get(guildId, guildId, guildId, isoDaysAgo(7), guildId, isoDaysAgo(30));
  return row as unknown as OverviewTotals;
}
