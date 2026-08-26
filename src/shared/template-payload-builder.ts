import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIMessageComponentEmoji,
  type MessageCreateOptions,
} from 'discord.js';
import type { EmbedSpec, PlaceholderContext, TemplatePayload } from './template-types';

export const OPT_IN_CUSTOM_ID = 'growth:opt-in';

const BUTTON_STYLES = {
  primary: ButtonStyle.Primary,
  success: ButtonStyle.Success,
  secondary: ButtonStyle.Secondary,
} as const;

/** Chuỗi rỗng phải thành undefined vì Discord từ chối field rỗng. */
function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
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

function fill(value: string | undefined, context: PlaceholderContext): string | undefined {
  const cleaned = clean(value);
  return cleaned ? applyPlaceholders(cleaned, context) : undefined;
}

function parseColor(hex: string | undefined): number | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  return Number.parseInt(hex.slice(1), 16);
}

function buildEmbed(spec: EmbedSpec, context: PlaceholderContext): EmbedBuilder | null {
  const embed = new EmbedBuilder();
  const title = fill(spec.title, context);
  const description = fill(spec.description, context);
  const color = parseColor(spec.color);
  const authorName = fill(spec.authorName, context);
  const footerText = fill(spec.footerText, context);

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (color !== undefined) embed.setColor(color);
  if (clean(spec.url)) embed.setURL(clean(spec.url)!);
  if (authorName) {
    embed.setAuthor({
      name: authorName,
      iconURL: clean(spec.authorIconUrl),
      url: clean(spec.authorUrl),
    });
  }
  if (clean(spec.thumbnailUrl)) embed.setThumbnail(clean(spec.thumbnailUrl)!);
  if (clean(spec.imageUrl)) embed.setImage(clean(spec.imageUrl)!);
  if (footerText) embed.setFooter({ text: footerText, iconURL: clean(spec.footerIconUrl) });
  if (spec.showTimestamp) embed.setTimestamp(new Date());

  const fields = spec.fields
    .filter((field) => clean(field.name) && clean(field.value))
    .map((field) => ({
      name: applyPlaceholders(field.name.trim(), context),
      value: applyPlaceholders(field.value.trim(), context),
      inline: field.inline === true,
    }));
  if (fields.length > 0) embed.addFields(fields);

  const data = embed.toJSON();
  const isEmpty =
    !data.title && !data.description && !data.image && !data.fields?.length && !data.author;
  return isEmpty ? null : embed;
}

export interface BuildOptions {
  /** panel mới cần nút opt-in; DM/announcement thì bỏ. */
  includeOptIn?: boolean;
}

export function buildMessagePayload(
  payload: TemplatePayload,
  context: PlaceholderContext,
  options: BuildOptions = {},
): MessageCreateOptions {
  const embeds = payload.embeds
    .map((spec) => buildEmbed(spec, context))
    .filter((embed): embed is EmbedBuilder => embed !== null);

  const row = new ActionRowBuilder<ButtonBuilder>();
  let buttonCount = 0;

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
    buttonCount += 1;
  }

  if (options.includeOptIn && payload.optInButton) {
    const spec = payload.optInButton;
    const button = new ButtonBuilder()
      .setCustomId(OPT_IN_CUSTOM_ID)
      .setStyle(BUTTON_STYLES[spec.style] ?? ButtonStyle.Primary);
    const label = fill(spec.label, context) ?? 'Nhận thông tin';
    button.setLabel(label);
    const emoji = parseComponentEmoji(spec.emoji);
    if (emoji) button.setEmoji(emoji);
    row.addComponents(button);
    buttonCount += 1;
  }

  return {
    content: fill(payload.content, context),
    embeds,
    components: buttonCount > 0 ? [row] : [],
  };
}

/** Webhook gửi qua REST thuần nên cần JSON, không nhận builder. */
export function buildRestPayload(
  payload: TemplatePayload,
  context: PlaceholderContext,
  options: BuildOptions = {},
): Record<string, unknown> {
  const built = buildMessagePayload(payload, context, options);
  return {
    content: built.content ?? undefined,
    embeds: (built.embeds ?? []).map((embed) =>
      embed instanceof EmbedBuilder ? embed.toJSON() : embed,
    ),
    components: (built.components ?? []).map((row) =>
      row instanceof ActionRowBuilder ? row.toJSON() : row,
    ),
    allowed_mentions: { parse: [] },
  };
}
