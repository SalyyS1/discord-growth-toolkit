import { client } from '../discord-client';

export interface EmojiEntry {
  id: string;
  name: string;
  animated: boolean;
  /** Dạng dán trực tiếp vào nội dung: <:name:id> */
  mention: string;
  url: string;
}

export interface EmojiGuildGroup {
  guildId: string;
  guildName: string;
  emojis: EmojiEntry[];
}

function cdnUrl(id: string, animated: boolean): string {
  return `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=64`;
}

/**
 * Emoji của mọi server bot đang ở — bot dùng được hết trong embed/content,
 * nên dashboard gom lại thành một bảng chọn.
 */
export function listEmojiCatalog(): EmojiGuildGroup[] {
  const groups: EmojiGuildGroup[] = [];

  for (const guild of client.guilds.cache.values()) {
    const emojis: EmojiEntry[] = [];
    for (const emoji of guild.emojis.cache.values()) {
      if (!emoji.name) continue;
      emojis.push({
        id: emoji.id,
        name: emoji.name,
        animated: emoji.animated ?? false,
        mention: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
        url: cdnUrl(emoji.id, emoji.animated ?? false),
      });
    }
    if (emojis.length === 0) continue;
    emojis.sort((left, right) => left.name.localeCompare(right.name));
    groups.push({ guildId: guild.id, guildName: guild.name, emojis });
  }

  groups.sort((left, right) => left.guildName.localeCompare(right.guildName));
  return groups;
}
