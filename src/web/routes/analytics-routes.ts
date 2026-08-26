import { Router } from 'express';
import { env } from '../../config/env';
import {
  guildFunnel,
  joinsPerDay,
  overviewTotals,
  sourceBreakdown,
} from '../../db/analytics-queries';
import { listJoins, listOutreach } from '../../db/repo-growth';

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export const analyticsRoutes = Router();

analyticsRoutes.get('/overview', (request, response) => {
  const days = Math.min(Math.max(Number(request.query.days) || 30, 7), 180);
  const totals = overviewTotals(env.homeGuildId);

  const sources = sourceBreakdown(env.homeGuildId).map((row) => ({
    source: row.source,
    joins: row.joins,
    stillMember: row.still_member,
    leftCount: row.joins - row.still_member,
    retention7d: rate(row.retained_7d, row.eligible_7d),
    retention30d: rate(row.retained_30d, row.eligible_30d),
    eligible7d: row.eligible_7d,
    eligible30d: row.eligible_30d,
    shareOfJoins: rate(row.joins, totals.total_joins),
  }));

  const funnel = guildFunnel(env.homeGuildId).map((row) => ({
    guildId: row.guild_id,
    guildName: row.guild_name,
    sourceLabel: row.source_label,
    clicks: row.clicks,
    dmsSent: row.dms_sent,
    dmsBlocked: row.dms_blocked,
    joins: row.joins,
    clickToDm: rate(row.dms_sent, row.clicks),
    dmToJoin: rate(row.joins, row.dms_sent),
    clickToJoin: rate(row.joins, row.clicks),
  }));

  response.json({
    totals: {
      totalJoins: totals.total_joins,
      stillMember: totals.still_member,
      leftCount: totals.total_joins - totals.still_member,
      retentionOverall: rate(totals.still_member, totals.total_joins),
      joins7d: totals.joins_7d,
      joins30d: totals.joins_30d,
      dmsSent: totals.dms_sent,
      dmsBlocked: totals.dms_blocked,
      dmDeliveryRate: rate(totals.dms_sent, totals.dms_sent + totals.dms_blocked),
      clicks: totals.clicks,
    },
    daily: joinsPerDay(env.homeGuildId, days),
    sources,
    funnel,
  });
});

analyticsRoutes.get('/joins', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
  const source = typeof request.query.source === 'string' ? request.query.source : undefined;
  const joins = listJoins({ limit, source }).map((row) => ({
    userId: row.user_id,
    username: row.username,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    stillMember: row.left_at === null,
    inviteCode: row.invite_code,
    source: row.source_label,
    inviterTag: row.inviter_tag,
    accountCreatedAt: row.account_created_at,
  }));
  response.json({ joins });
});

analyticsRoutes.get('/outreach', (request, response) => {
  const limit = Math.min(Math.max(Number(request.query.limit) || 100, 1), 500);
  const entries = listOutreach(limit).map((row) => ({
    userId: row.user_id,
    username: row.username,
    originGuildId: row.origin_guild_id,
    templateId: row.template_id,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
  }));
  response.json({ entries });
});
