import { Router } from 'express';
import { PermissionFlagsBits } from 'discord.js';
import { client } from '../../bot/discord-client';
import { env } from '../../config/env';

export const statusRoutes = Router();

/** Dữ liệu cho chỉ báo trạng thái ở sidebar: bot có online, có thấy home guild. */
statusRoutes.get('/', (_request, response) => {
  const homeGuild = client.guilds.cache.get(env.homeGuildId);
  const me = homeGuild?.members.me;

  response.json({
    online: client.isReady(),
    botTag: client.user?.tag ?? null,
    botAvatarUrl: client.user?.displayAvatarURL({ size: 64 }) ?? null,
    guildCount: client.guilds.cache.size,
    homeGuild: homeGuild
      ? {
          id: homeGuild.id,
          name: homeGuild.name,
          memberCount: homeGuild.memberCount,
          canManageInvites: Boolean(me?.permissions.has(PermissionFlagsBits.ManageGuild)),
        }
      : null,
  });
});
