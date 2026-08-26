import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { env } from '../config/env';

/**
 * GuildMembers là privileged intent — phải bật ở Developer Portal, nếu không
 * bot sẽ không nhận guildMemberAdd và mất toàn bộ số liệu quy nguồn.
 */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
  partials: [Partials.GuildMember, Partials.User],
});

export async function startBot(): Promise<void> {
  await client.login(env.discordToken);
}

export function botUserTag(): string {
  return client.user ? client.user.tag : 'unknown';
}
