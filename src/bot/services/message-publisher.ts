import { ChannelType, MessageFlags, type GuildBasedChannel, type MessageEditOptions, type TextBasedChannel } from 'discord.js';
import { client } from '../discord-client';
import { recordPublishedMessage } from '../../db/repo-content';
import { buildMessagePayload, buildRestPayload } from '../../shared/template-payload-builder';
import type { PlaceholderContext, TemplatePayload } from '../../shared/template-types';

const SENDABLE_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
]);

export interface PublishResult {
  channelId: string;
  messageId: string;
  guildId: string | null;
}

async function resolveSendableChannel(channelId: string): Promise<TextBasedChannel & GuildBasedChannel> {
  const channel = await client.channels.fetch(channelId);
  if (!channel) throw new Error('Không tìm thấy channel — kiểm tra ID và quyền của bot');
  if (!SENDABLE_TYPES.has(channel.type)) {
    throw new Error('Channel này không gửi tin được (chỉ text / announcement / thread)');
  }
  return channel as TextBasedChannel & GuildBasedChannel;
}

export async function publishTemplateToChannel(input: {
  channelId: string;
  payload: TemplatePayload;
  context: PlaceholderContext;
  templateId: number | null;
  includeOptIn?: boolean;
}): Promise<PublishResult> {
  const channel = await resolveSendableChannel(input.channelId);
  const guild = 'guild' in channel ? channel.guild : null;
  const context: PlaceholderContext = {
    serverName: guild?.name,
    memberCount: guild?.memberCount,
    ...input.context,
  };

  const message = await channel.send(
    buildMessagePayload(input.payload, context, { includeOptIn: input.includeOptIn }),
  );

  recordPublishedMessage({
    guildId: guild?.id ?? null,
    channelId: channel.id,
    messageId: message.id,
    templateId: input.templateId,
    mode: 'bot',
  });

  return { channelId: channel.id, messageId: message.id, guildId: guild?.id ?? null };
}

/** Sửa lại tin bot đã đăng — dùng khi cần vá nội dung mà không muốn đăng lại. */
export async function editPublishedMessage(input: {
  channelId: string;
  messageId: string;
  payload: TemplatePayload;
  context: PlaceholderContext;
  includeOptIn?: boolean;
}): Promise<PublishResult> {
  const channel = await resolveSendableChannel(input.channelId);
  const guild = 'guild' in channel ? channel.guild : null;
  const message = await channel.messages.fetch(input.messageId);
  const context: PlaceholderContext = {
    serverName: guild?.name,
    memberCount: guild?.memberCount,
    ...input.context,
  };

  await message.edit(buildEditOptions(input.payload, context, input.includeOptIn === true));
  return { channelId: channel.id, messageId: message.id, guildId: guild?.id ?? null };
}

/** message.edit() nhận kiểu hẹp hơn send(), nên lấy đúng ba field cần dùng. */
function buildEditOptions(
  payload: TemplatePayload,
  context: PlaceholderContext,
  includeOptIn: boolean,
): MessageEditOptions {
  const built = buildMessagePayload(payload, context, { includeOptIn });

  if (payload.useComponentsV2) {
    // Đổi một tin cổ điển sang V2 phải xoá hẳn content + embeds. Chiều ngược lại
    // (V2 về embed) Discord không cho, phải đăng tin mới.
    return {
      content: null,
      embeds: [],
      components: built.components ?? [],
      flags: MessageFlags.IsComponentsV2,
    } as MessageEditOptions;
  }

  return {
    content: built.content ?? '',
    embeds: built.embeds ?? [],
    components: built.components ?? [],
  } as MessageEditOptions;
}

/**
 * Webhook mode: gửi bằng REST thuần, không cần bot ở trong server đó.
 * Lưu ý webhook không nhận button có customId nên panel opt-in phải dùng bot.
 */
export async function publishTemplateToWebhook(input: {
  webhookUrl: string;
  payload: TemplatePayload;
  context: PlaceholderContext;
  templateId: number | null;
  username?: string;
  avatarUrl?: string;
}): Promise<PublishResult> {
  if (!/^https:\/\/(canary\.|ptb\.)?discord\.com\/api\/webhooks\//.test(input.webhookUrl)) {
    throw new Error('Webhook URL không hợp lệ');
  }
  // Webhook do người tạo trong Server Settings không được phép gửi component,
  // nên Components V2 (vốn là component thuần) phải đăng bằng bot.
  if (input.payload.useComponentsV2) {
    throw new Error('Webhook không gửi được Components V2 — chọn "Đăng lên channel" bằng bot');
  }

  const body = buildRestPayload(input.payload, input.context);
  if (input.username) body.username = input.username;
  if (input.avatarUrl) body.avatar_url = input.avatarUrl;

  const response = await fetch(`${input.webhookUrl}?wait=true`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Webhook trả về ${response.status}: ${text.slice(0, 300)}`);
  }

  const sent = JSON.parse(text) as { id: string; channel_id: string; guild_id?: string };
  recordPublishedMessage({
    guildId: sent.guild_id ?? null,
    channelId: sent.channel_id,
    messageId: sent.id,
    templateId: input.templateId,
    mode: 'webhook',
    webhookUrl: input.webhookUrl,
  });

  return { channelId: sent.channel_id, messageId: sent.id, guildId: sent.guild_id ?? null };
}
