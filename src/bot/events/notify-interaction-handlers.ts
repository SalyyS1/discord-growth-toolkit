import { MessageFlags, type ButtonInteraction } from 'discord.js';
import { env } from '../../config/env';
import { getPublishedMessage, getTemplate } from '../../db/repo-content';
import { subscribeMember, unsubscribeUser } from '../services/notify-subscription';
import { buildNotifyOptOutRow } from '../../shared/template-payload-builder';

const DEFAULT_SUBSCRIBE_ACK =
  'Xong! Từ giờ bot sẽ DM cho bạn khi có thông báo. Đổi ý thì bấm nút dưới đây bất cứ lúc nào.';

/** Lấy lời nhắn admin đã soạn cho nút này, dựa vào template của tin đã đăng. */
function panelAckMessage(messageId: string): string | null {
  const published = getPublishedMessage(messageId);
  const template = published?.template_id ? getTemplate(published.template_id) : null;
  return template?.payload.optInButton?.ackMessage?.trim() || null;
}

export async function handleNotifySubscribe(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Đăng ký gắn với server nhà: role và danh sách thông báo đều nằm ở đó.
  if (interaction.guildId !== env.homeGuildId) {
    await interaction.editReply('Nút này chỉ dùng được trong server nhà.');
    return;
  }

  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.editReply('Không đọc được thông tin thành viên của bạn, thử lại sau nhé.');
    return;
  }

  const change = await subscribeMember(member);
  const message =
    change.outcome === 'already'
      ? 'Bạn đã ở trong danh sách nhận thông báo rồi.'
      : panelAckMessage(interaction.message.id) ?? DEFAULT_SUBSCRIBE_ACK;

  await interaction.editReply({ content: message, components: [buildNotifyOptOutRow()] });
}

export async function handleNotifyUnsubscribe(interaction: ButtonInteraction): Promise<void> {
  // Nút này cũng nằm trong DM, nơi không có ephemeral.
  await (interaction.inGuild()
    ? interaction.deferReply({ flags: MessageFlags.Ephemeral })
    : interaction.deferReply());

  const { wasActive } = await unsubscribeUser(interaction.user.id);

  await interaction.editReply(
    wasActive
      ? 'Đã huỷ. Bot sẽ không DM thông báo cho bạn nữa.'
      : 'Bạn không có trong danh sách nhận thông báo, nên không cần huỷ gì cả.',
  );
}
