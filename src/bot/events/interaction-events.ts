import { Events, MessageFlags, type ButtonInteraction } from 'discord.js';
import { client } from '../discord-client';
import { getTemplate } from '../../db/repo-content';
import { getGuildConfig } from '../../db/repo-guilds';
import { recordPanelClick } from '../../db/repo-growth';
import { logDuplicateDm, sendTemplateDm } from '../services/dm-sender';
import {
  NOTIFY_SUBSCRIBE_CUSTOM_ID,
  NOTIFY_UNSUBSCRIBE_CUSTOM_ID,
  OPT_IN_CUSTOM_ID,
} from '../../shared/template-payload-builder';
import { handleNotifySubscribe, handleNotifyUnsubscribe } from './notify-interaction-handlers';

const DEFAULT_ACK = 'Đã gửi cho bạn một tin nhắn riêng nhé!';

/**
 * Đây là toàn bộ đường vào của outreach: user phải tự bấm nút thì bot mới DM.
 * Không có luồng nào quét member list rồi gửi hàng loạt.
 */
export function registerInteractionEvents(): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === OPT_IN_CUSTOM_ID) {
      await handlePartnerOptIn(interaction);
      return;
    }
    if (interaction.customId === NOTIFY_SUBSCRIBE_CUSTOM_ID) {
      await handleNotifySubscribe(interaction);
      return;
    }
    if (interaction.customId === NOTIFY_UNSUBSCRIBE_CUSTOM_ID) {
      await handleNotifyUnsubscribe(interaction);
    }
  });
}

/** Panel ở server đối tác: bấm một lần là nhận ngay DM đã gán cho server đó. */
async function handlePartnerOptIn(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const guildId = interaction.guildId;
  const config = guildId ? getGuildConfig(guildId) : null;
  const inviteUrl = config?.invite_code ? `https://discord.gg/${config.invite_code}` : null;
  const template = config?.dm_template_id ? getTemplate(config.dm_template_id) : null;

  if (!template) {
    await interaction.editReply(
      inviteUrl
        ? `Đây là link tham gia: ${inviteUrl}`
        : 'Panel này chưa được cấu hình nội dung. Liên hệ admin nhé.',
    );
    return;
  }

  const isFirstClick = guildId ? recordPanelClick(guildId, interaction.user.id) : true;
  if (!isFirstClick) {
    logDuplicateDm(interaction.user, guildId, template.id);
    await interaction.editReply(
      inviteUrl
        ? `Bạn đã nhận tin nhắn này trước đó rồi. Link tham gia: ${inviteUrl}`
        : 'Bạn đã nhận tin nhắn này trước đó rồi.',
    );
    return;
  }

  const result = await sendTemplateDm({
    user: interaction.user,
    payload: template.payload,
    templateId: template.id,
    originGuildId: guildId,
    context: {
      userMention: `<@${interaction.user.id}>`,
      userName: interaction.user.username,
      userId: interaction.user.id,
      serverName: interaction.guild?.name,
      memberCount: interaction.guild?.memberCount,
      sourceLabel: config?.source_label ?? undefined,
      inviteUrl: inviteUrl ?? undefined,
    },
  });

  if (result.status === 'sent') {
    await interaction.editReply(template.payload.optInButton?.ackMessage?.trim() || DEFAULT_ACK);
    return;
  }

  if (result.status === 'blocked_dm') {
    await interaction.editReply(
      inviteUrl
        ? `DM của bạn đang đóng nên mình gửi trực tiếp ở đây: ${inviteUrl}`
        : 'DM của bạn đang đóng nên mình không gửi được. Bật "Direct Messages" trong Privacy Settings rồi thử lại nhé.',
    );
    return;
  }

  await interaction.editReply('Có lỗi khi gửi tin nhắn, bạn thử lại sau nhé.');
}
