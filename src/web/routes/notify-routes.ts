import { Router } from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { client } from '../../bot/discord-client';
import { env } from '../../config/env';
import { runNotifyCampaign, runningCampaign } from '../../bot/services/notify-broadcaster';
import { getTemplate } from '../../db/repo-content';
import {
  campaignStatusCounts,
  countActiveSubscribers,
  createCampaign,
  finishCampaign,
  getCampaign,
  getNotifyRoleId,
  listActiveSubscribers,
  listCampaigns,
  listUnsubscribedUserIds,
  setNotifyRoleId,
  type NotifyAudience,
  type NotifyCampaignRow,
} from '../../db/repo-notify';
import { hasBlockingIssue, validateTemplatePayload } from '../../shared/template-validation';
import type { TemplatePayload } from '../../shared/template-types';

export const notifyRoutes = Router();

function withCounts(campaign: NotifyCampaignRow) {
  return { ...campaign, counts: campaignStatusCounts(campaign.id) };
}

notifyRoutes.get('/', (_request, response) => {
  const guild = client.guilds.cache.get(env.homeGuildId);
  const me = guild?.members.me ?? null;
  const canManageRoles = Boolean(me?.permissions.has(PermissionFlagsBits.ManageRoles));

  // Role @everyone và role do app khác quản lý thì bot không gán được.
  const roles =
    guild && me
      ? [...guild.roles.cache.values()]
          .filter((role) => role.id !== guild.id && !role.managed)
          .sort((left, right) => right.position - left.position)
          .map((role) => ({
            id: role.id,
            name: role.name,
            assignable: canManageRoles && me.roles.highest.comparePositionTo(role) > 0,
          }))
      : [];

  response.json({
    homeGuildId: env.homeGuildId,
    guildOnline: Boolean(guild),
    guildName: guild?.name ?? null,
    canManageRoles,
    roleId: getNotifyRoleId(),
    roles,
    subscriberCount: countActiveSubscribers(env.homeGuildId),
    dmIntervalMs: env.dmIntervalMs,
    runningCampaignId: runningCampaign(),
    campaigns: listCampaigns(20).map(withCounts),
  });
});

notifyRoutes.put('/role', (request, response) => {
  const body = request.body as { roleId?: string | null };
  const roleId = typeof body.roleId === 'string' && body.roleId.length > 0 ? body.roleId : null;

  if (roleId) {
    const guild = client.guilds.cache.get(env.homeGuildId);
    if (!guild) {
      response.status(400).json({ error: 'Bot chưa vào được server nhà' });
      return;
    }
    if (!guild.roles.cache.has(roleId)) {
      response.status(400).json({ error: 'Role này không có trong server nhà' });
      return;
    }
  }

  setNotifyRoleId(roleId);
  response.json({ roleId });
});

notifyRoutes.get('/subscribers', (request, response) => {
  const limit = Math.min(Number(request.query.limit) || 200, 1000);
  const subscribers = listActiveSubscribers(env.homeGuildId).slice(0, limit);
  response.json({ subscribers, total: countActiveSubscribers(env.homeGuildId) });
});

interface StartCampaignBody {
  name?: string;
  templateId?: number;
  payload?: TemplatePayload;
  audience?: NotifyAudience;
}

/** Số người thật sẽ nhận nếu gửi theo role: bỏ bot và người đã bấm huỷ nhận. */
notifyRoutes.get('/role-audience', async (_request, response) => {
  const guild = client.guilds.cache.get(env.homeGuildId);
  if (!guild) {
    response.status(400).json({ error: 'Bot chưa vào được server nhà' });
    return;
  }

  const roleId = getNotifyRoleId();
  const role = roleId ? guild.roles.cache.get(roleId) : null;
  if (!role) {
    response.json({ roleId: null, roleName: null, total: 0, holders: 0, bots: 0, optedOut: 0 });
    return;
  }

  try {
    await guild.members.fetch();
  } catch (error) {
    response.status(500).json({
      error: `Không tải được danh sách member: ${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  const holders = [...role.members.values()];
  const optedOutIds = listUnsubscribedUserIds(env.homeGuildId);
  const bots = holders.filter((member) => member.user.bot).length;
  const optedOut = holders.filter((member) => !member.user.bot && optedOutIds.has(member.id)).length;

  response.json({
    roleId: role.id,
    roleName: role.name,
    holders: holders.length,
    bots,
    optedOut,
    total: holders.length - bots - optedOut,
    memberCount: guild.memberCount,
  });
});

/**
 * Chạy nền: với DM_INTERVAL_MS mặc định 2.5s thì một đợt vài trăm người mất
 * hàng chục phút, không giữ được trong một request. Tiến độ đọc qua GET.
 */
notifyRoutes.post('/campaigns', (request, response) => {
  const body = request.body as StartCampaignBody;
  const audience: NotifyAudience = body.audience === 'role' ? 'role' : 'subscribers';
  const template = body.templateId ? getTemplate(body.templateId) : null;
  const payload = body.payload ?? template?.payload;

  if (!payload) {
    response.status(400).json({ error: 'Thiếu nội dung — chọn template hoặc gửi payload' });
    return;
  }

  const issues = validateTemplatePayload(payload);
  if (hasBlockingIssue(issues)) {
    response.status(400).json({ error: 'Nội dung chưa hợp lệ', issues });
    return;
  }

  if (runningCampaign() !== null) {
    response.status(409).json({ error: `Đợt #${runningCampaign()} đang chạy` });
    return;
  }

  const roleId = audience === 'role' ? getNotifyRoleId() : null;
  if (audience === 'role') {
    const guild = client.guilds.cache.get(env.homeGuildId);
    if (!roleId) {
      response.status(400).json({ error: 'Chưa chọn role thông báo ở phần trên' });
      return;
    }
    // @everyone không phải role người dùng tự nhận, gửi cho nó là spam cả server.
    if (roleId === env.homeGuildId) {
      response.status(400).json({ error: 'Không gửi cho @everyone — chọn một role người dùng tự nhận được' });
      return;
    }
    if (guild && !guild.roles.cache.has(roleId)) {
      response.status(400).json({ error: 'Role thông báo không còn tồn tại — chọn lại' });
      return;
    }
  } else if (countActiveSubscribers(env.homeGuildId) === 0) {
    response.status(400).json({
      error: 'Chưa có ai bấm nút đăng ký — đăng panel có nút đăng ký, hoặc chuyển sang gửi theo role',
    });
    return;
  }

  const campaign = createCampaign({
    guildId: env.homeGuildId,
    name: body.name?.trim() || template?.name || 'Đợt thông báo',
    templateId: template?.id ?? body.templateId ?? null,
    audience,
    roleId,
  });

  void runNotifyCampaign({
    campaignId: campaign.id,
    guildId: env.homeGuildId,
    payload,
    templateId: campaign.template_id,
    audience,
    roleId,
  }).catch((error: unknown) => {
    console.error(`[notify] Đợt #${campaign.id} dừng giữa đường:`, error);
    // Đóng đợt lại kể cả khi lỗi xảy ra trước khi vòng gửi bắt đầu, nếu không
    // dashboard sẽ báo "đang chạy" mãi mãi.
    finishCampaign(campaign.id);
  });

  response.json({ campaign: withCounts(campaign), issues });
});

notifyRoutes.get('/campaigns/:id', (request, response) => {
  const campaign = getCampaign(Number(request.params.id));
  if (!campaign) {
    response.status(404).json({ error: 'Không thấy đợt này' });
    return;
  }
  response.json({
    campaign: withCounts(campaign),
    running: runningCampaign() === campaign.id,
    subscriberCount: countActiveSubscribers(campaign.guild_id),
  });
});
