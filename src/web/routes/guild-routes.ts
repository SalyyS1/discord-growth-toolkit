import { Router } from 'express';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { client } from '../../bot/discord-client';
import { env } from '../../config/env';
import { getGuildConfig, listGuilds, saveGuildConfig } from '../../db/repo-guilds';
import { listEmojiCatalog } from '../../bot/services/emoji-catalog';

const TEXTUAL_CHANNELS = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
]);

export const guildRoutes = Router();

guildRoutes.get('/', (_request, response) => {
  const stored = listGuilds();
  const guilds = stored.map((guild) => {
    const live = client.guilds.cache.get(guild.id);
    const config = getGuildConfig(guild.id);
    return {
      id: guild.id,
      name: live?.name ?? guild.name,
      icon: live?.icon ?? guild.icon,
      memberCount: live?.memberCount ?? guild.member_count,
      isHome: guild.id === env.homeGuildId,
      online: Boolean(live),
      sourceLabel: config.source_label,
      inviteCode: config.invite_code,
      panelTemplateId: config.panel_template_id,
      dmTemplateId: config.dm_template_id,
      configured: Boolean(config.dm_template_id && config.invite_code),
    };
  });
  response.json({ homeGuildId: env.homeGuildId, guilds });
});

guildRoutes.get('/:guildId', (request, response) => {
  const guildId = request.params.guildId;
  const live = client.guilds.cache.get(guildId);
  if (!live) {
    response.status(404).json({ error: 'Bot không ở trong server này' });
    return;
  }

  const me = live.members.me;
  const channels = live.channels.cache
    .filter((channel) => TEXTUAL_CHANNELS.has(channel.type))
    .map((channel) => {
      const permissions = me ? channel.permissionsFor(me) : null;
      return {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parent: channel.parent?.name ?? null,
        canSend: Boolean(
          permissions?.has(PermissionFlagsBits.ViewChannel) &&
            permissions?.has(PermissionFlagsBits.SendMessages),
        ),
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  response.json({
    guild: {
      id: live.id,
      name: live.name,
      icon: live.icon,
      memberCount: live.memberCount,
      isHome: live.id === env.homeGuildId,
      canManageInvites: Boolean(me?.permissions.has(PermissionFlagsBits.ManageGuild)),
    },
    config: getGuildConfig(guildId),
    channels,
  });
});

guildRoutes.patch('/:guildId/config', (request, response) => {
  const body = request.body as Record<string, unknown>;
  const toNullableNumber = (value: unknown): number | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const config = saveGuildConfig(request.params.guildId, {
    sourceLabel: typeof body.sourceLabel === 'string' ? body.sourceLabel : undefined,
    inviteCode: typeof body.inviteCode === 'string' ? body.inviteCode : undefined,
    panelTemplateId: toNullableNumber(body.panelTemplateId),
    dmTemplateId: toNullableNumber(body.dmTemplateId),
    welcomeTemplateId: toNullableNumber(body.welcomeTemplateId),
    welcomeDmEnabled:
      typeof body.welcomeDmEnabled === 'boolean' ? body.welcomeDmEnabled : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  });

  response.json({ config });
});

/** Emoji của mọi server bot đang ở, dùng cho picker trong composer. */
guildRoutes.get('/meta/emojis', (_request, response) => {
  response.json({ groups: listEmojiCatalog() });
});
