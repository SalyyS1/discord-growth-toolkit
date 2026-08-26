import { Events } from 'discord.js';
import { client } from '../discord-client';
import { env } from '../../config/env';
import { trackNewInvite, untrackInvite } from '../services/invite-cache';

/** Cache invite phải cập nhật ngay, nếu không invite mới sẽ bị coi là "không rõ nguồn". */
export function registerInviteEvents(): void {
  client.on(Events.InviteCreate, (invite) => {
    if (!invite.guild || invite.guild.id !== env.homeGuildId) return;
    trackNewInvite(
      invite.guild.id,
      invite.code,
      invite.uses ?? 0,
      invite.inviter?.id ?? null,
      invite.inviter?.tag ?? null,
    );
  });

  client.on(Events.InviteDelete, (invite) => {
    if (!invite.guild || invite.guild.id !== env.homeGuildId) return;
    untrackInvite(invite.guild.id, invite.code);
  });
}
