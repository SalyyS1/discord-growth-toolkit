import { Events } from 'discord.js';
import { client } from '../discord-client';
import { env } from '../../config/env';
import { getTemplate } from '../../db/repo-content';
import { getGuildConfig } from '../../db/repo-guilds';
import { getInviteSource, markMemberLeft, recordJoin, setInviteUses } from '../../db/repo-growth';
import { resolveUsedInvite } from '../services/invite-cache';
import { sendTemplateDm } from '../services/dm-sender';

const UNKNOWN_SOURCE = '(không rõ)';

export function registerMemberEvents(): void {
  // Chỉ ghi nhận join ở home guild. Member của server đối tác không bị theo dõi.
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.guild.id !== env.homeGuildId) return;

    const resolved = await resolveUsedInvite(member.guild);
    const source = resolved ? getInviteSource(resolved.code) : null;

    if (resolved && source) {
      setInviteUses(resolved.code, source.uses + 1);
    }

    recordJoin({
      guildId: member.guild.id,
      userId: member.id,
      username: member.user.tag,
      avatar: member.user.avatar,
      accountCreatedAt: member.user.createdAt.toISOString(),
      inviteCode: resolved?.code ?? null,
      sourceLabel: source?.label ?? (resolved ? `invite:${resolved.code}` : UNKNOWN_SOURCE),
      inviterId: resolved?.inviterId ?? null,
      inviterTag: resolved?.inviterTag ?? null,
    });

    if (resolved?.uncertain) {
      console.warn(
        `[bot] Nhiều invite cùng tăng khi ${member.user.tag} join — nguồn ghi nhận có thể lệch`,
      );
    }

    await sendWelcomeDm(member.guild.id, member);
  });

  client.on(Events.GuildMemberRemove, (member) => {
    if (member.guild.id !== env.homeGuildId) return;
    markMemberLeft(member.guild.id, member.id);
  });
}

/** Welcome DM chỉ chạy khi bật trong config của home guild. */
async function sendWelcomeDm(
  guildId: string,
  member: { id: string; user: { tag: string } } & { guild: { name: string; memberCount: number } },
): Promise<void> {
  const config = getGuildConfig(guildId);
  if (config.welcome_dm_enabled !== 1 || !config.welcome_template_id) return;

  const template = getTemplate(config.welcome_template_id);
  if (!template) return;

  const user = await client.users.fetch(member.id).catch(() => null);
  if (!user) return;

  await sendTemplateDm({
    user,
    payload: template.payload,
    templateId: template.id,
    originGuildId: guildId,
    context: {
      userMention: `<@${member.id}>`,
      userName: user.username,
      userId: member.id,
      serverName: member.guild.name,
      memberCount: member.guild.memberCount,
      sourceLabel: config.source_label ?? undefined,
      inviteUrl: config.invite_code ? `https://discord.gg/${config.invite_code}` : undefined,
    },
  });
}
