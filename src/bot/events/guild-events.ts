import { Events, type Guild } from 'discord.js';
import { client } from '../discord-client';
import { env } from '../../config/env';
import { getInviteSource, listInviteSources, setInviteUses } from '../../db/repo-growth';
import { markGuildLeft, upsertGuild } from '../../db/repo-guilds';
import { forgetGuildInvites, primeGuildInvites } from '../services/invite-cache';

function storeGuild(guild: Guild): void {
  upsertGuild({
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    memberCount: guild.memberCount,
    ownerId: guild.ownerId,
  });
}

/** Đồng bộ lại số lần dùng của các invite đã khai báo, để dashboard không lệch. */
async function syncInviteUses(guild: Guild): Promise<void> {
  const known = listInviteSources(guild.id);
  if (known.length === 0) return;
  try {
    const invites = await guild.invites.fetch();
    for (const invite of invites.values()) {
      if (getInviteSource(invite.code)) setInviteUses(invite.code, invite.uses ?? 0);
    }
  } catch {
    console.warn(`[bot] Không đọc được invite của ${guild.name} — thiếu quyền Manage Guild`);
  }
}

export function registerGuildEvents(): void {
  client.once(Events.ClientReady, async () => {
    console.log(`[bot] Đăng nhập với ${client.user?.tag}`);

    for (const guild of client.guilds.cache.values()) storeGuild(guild);

    const homeGuild = client.guilds.cache.get(env.homeGuildId);
    if (!homeGuild) {
      console.warn(
        `[bot] Bot chưa ở trong HOME_GUILD_ID=${env.homeGuildId} — không quy nguồn join được`,
      );
      return;
    }

    const primed = await primeGuildInvites(homeGuild);
    if (!primed) {
      console.warn(
        `[bot] Thiếu quyền Manage Guild ở ${homeGuild.name} — cần quyền này để biết ai join bằng invite nào`,
      );
    }
    await syncInviteUses(homeGuild);
    console.log(`[bot] Theo dõi invite của ${homeGuild.name} (${homeGuild.memberCount} member)`);
  });

  client.on(Events.GuildCreate, async (guild) => {
    storeGuild(guild);
    console.log(`[bot] Được thêm vào ${guild.name}`);
    if (guild.id === env.homeGuildId) await primeGuildInvites(guild);
  });

  client.on(Events.GuildDelete, (guild) => {
    markGuildLeft(guild.id);
    forgetGuildInvites(guild.id);
    console.log(`[bot] Đã rời ${guild.name}`);
  });

  client.on(Events.GuildUpdate, (_old, guild) => storeGuild(guild));
}
