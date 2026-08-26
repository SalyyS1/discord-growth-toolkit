import { Router } from 'express';
import { ChannelType } from 'discord.js';
import { client } from '../../bot/discord-client';
import { env } from '../../config/env';
import {
  deleteInviteSource,
  getInviteSource,
  listInviteSources,
  upsertInviteSource,
} from '../../db/repo-growth';

export const inviteSourceRoutes = Router();

inviteSourceRoutes.get('/', (_request, response) => {
  const sources = listInviteSources(env.homeGuildId).map((source) => ({
    code: source.code,
    label: source.label,
    url: `https://discord.gg/${source.code}`,
    channelId: source.channel_id,
    originGuildId: source.origin_guild_id,
    uses: source.uses,
    createdAt: source.created_at,
  }));
  response.json({ sources });
});

/**
 * Tạo invite vĩnh viễn trong home guild và gắn nhãn nguồn, hoặc đăng ký một
 * code đã có sẵn (khi invite được tạo tay).
 */
inviteSourceRoutes.post('/', async (request, response) => {
  const body = request.body as {
    label?: string;
    channelId?: string;
    existingCode?: string;
    originGuildId?: string;
  };

  const label = body.label?.trim();
  if (!label) {
    response.status(400).json({ error: 'Thiếu nhãn nguồn' });
    return;
  }

  if (body.existingCode?.trim()) {
    const code = body.existingCode.trim().replace(/^.*discord\.gg\//, '');
    upsertInviteSource({
      code,
      guildId: env.homeGuildId,
      label,
      originGuildId: body.originGuildId ?? null,
    });
    response.json({ source: getInviteSource(code) });
    return;
  }

  const homeGuild = client.guilds.cache.get(env.homeGuildId);
  if (!homeGuild) {
    response.status(400).json({ error: 'Bot không ở trong home guild' });
    return;
  }

  const channel = body.channelId
    ? homeGuild.channels.cache.get(body.channelId)
    : homeGuild.channels.cache.find((item) => item.type === ChannelType.GuildText);

  if (!channel || channel.type !== ChannelType.GuildText) {
    response.status(400).json({ error: 'Cần chọn một text channel trong home guild' });
    return;
  }

  try {
    const invite = await channel.createInvite({
      maxAge: 0,
      maxUses: 0,
      unique: true,
      reason: `Growth toolkit: nguồn "${label}"`,
    });
    upsertInviteSource({
      code: invite.code,
      guildId: env.homeGuildId,
      label,
      channelId: channel.id,
      originGuildId: body.originGuildId ?? null,
      uses: invite.uses ?? 0,
    });
    response.json({ source: getInviteSource(invite.code) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response.status(500).json({ error: `Không tạo được invite: ${message}` });
  }
});

inviteSourceRoutes.delete('/:code', (request, response) => {
  const removed = deleteInviteSource(request.params.code);
  response.json({ removed });
});
