import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type APIMessageComponentEmoji,
} from 'discord.js';
import type { PlaceholderContext, TemplatePayload } from './template-types';

export const OPT_IN_CUSTOM_ID = 'growth:opt-in';
/** Nút ghi danh vào danh sách nhận thông báo của server nhà. */
export const NOTIFY_SUBSCRIBE_CUSTOM_ID = 'growth:notify-subscribe';
/** Nút rút lại đăng ký — gắn kèm mọi DM thông báo và mọi lời xác nhận. */
export const NOTIFY_UNSUBSCRIBE_CUSTOM_ID = 'growth:notify-unsubscribe';
export const NOTIFY_UNSUBSCRIBE_LABEL = 'Huỷ nhận thông báo';

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  success: ButtonStyle.Success,
  secondary: ButtonStyle.Secondary,
} as const;

export interface BuildOptions {
  /** panel mới cần nút opt-in; DM/announcement thì bỏ. */
  includeOptIn?: boolean;
  /** Thêm một hàng nút "Huỷ nhận thông báo" — dùng cho DM của đợt thông báo. */
  includeNotifyOptOut?: boolean;
}

/** Chuỗi rỗng phải thành undefined vì Discord từ chối field rỗng. */
export function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export function applyPlaceholders(text: string, context: PlaceholderContext): string {
  return text
    .replaceAll('{user}', context.userMention ?? context.userName ?? 'bạn')
    .replaceAll('{user.name}', context.userName ?? 'bạn')
    .replaceAll('{user.id}', context.userId ?? '')
    .replaceAll('{server}', context.serverName ?? '')
    .replaceAll('{members}', context.memberCount !== undefined ? String(context.memberCount) : '')
    .replaceAll('{invite}', context.inviteUrl ?? '')
    .replaceAll('{source}', context.sourceLabel ?? '');
}

export function fill(value: string | undefined, context: PlaceholderContext): string | undefined {
  const cleaned = clean(value);
  return cleaned ? applyPlaceholders(cleaned, context) : undefined;
}

export function parseColor(hex: string | undefined): number | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return Number.parseInt(hex.slice(1), 16);
}

/** Tách <:name:id>, <a:name:id> hoặc emoji unicode thành object cho component. */
export function parseComponentEmoji(raw: string | undefined): APIMessageComponentEmoji | undefined {
  const value = clean(raw);
  if (!value) return undefined;
  const custom = /^<(a?):([\w~]+):(\d+)>$/.exec(value);
  if (custom) {
    return { animated: custom[1] === 'a', name: custom[2]!, id: custom[3]! };
  }
  return { name: value };
}

/**
 * Hàng nút của template, dùng chung cho cả embed cổ điển và Components V2.
 * Trả về null khi không có nút nào hợp lệ để caller khỏi gắn hàng rỗng.
 */
export function buildButtonRow(
  payload: TemplatePayload,
  context: PlaceholderContext,
  includeOptIn: boolean,
): ActionRowBuilder<ButtonBuilder> | null {
  const row = new ActionRowBuilder<ButtonBuilder>();
  let count = 0;

  for (const spec of payload.linkButtons) {
    const url = fill(spec.url, context);
    if (!url || !/^https?:\/\//.test(url)) continue;
    const button = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url);
    const label = fill(spec.label, context);
    const emoji = parseComponentEmoji(spec.emoji);
    if (label) button.setLabel(label);
    if (emoji) button.setEmoji(emoji);
    if (!label && !emoji) continue;
    row.addComponents(button);
    count += 1;
  }

  if (includeOptIn && payload.optInButton) {
    const spec = payload.optInButton;
    const button = new ButtonBuilder()
      .setCustomId(spec.action === 'subscribe' ? NOTIFY_SUBSCRIBE_CUSTOM_ID : OPT_IN_CUSTOM_ID)
      .setStyle(BUTTON_STYLES[spec.style] ?? ButtonStyle.Primary)
      .setLabel(fill(spec.label, context) ?? 'Nhận thông tin');
    const emoji = parseComponentEmoji(spec.emoji);
    if (emoji) button.setEmoji(emoji);
    row.addComponents(button);
    count += 1;
  }

  return count > 0 ? row : null;
}

/** Hàng nút riêng để lối rút lại đăng ký luôn có chỗ, không tranh 5 slot với nút của template. */
export function buildNotifyOptOutRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(NOTIFY_UNSUBSCRIBE_CUSTOM_ID)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(NOTIFY_UNSUBSCRIBE_LABEL),
  );
}
