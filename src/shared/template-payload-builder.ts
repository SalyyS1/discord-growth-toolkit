import {
  EmbedBuilder,
  MessageFlags,
  type MessageCreateOptions,
} from 'discord.js';
import { buildComponentsV2Payload } from './template-components-v2-builder';
import {
  applyPlaceholders,
  buildButtonRow,
  buildNotifyOptOutRow,
  clean,
  fill,
  parseColor,
  type BuildOptions,
} from './template-build-helpers';
import type { EmbedSpec, PlaceholderContext, TemplatePayload } from './template-types';

// Giữ nguyên đường import cũ cho phần còn lại của code.
export {
  applyPlaceholders,
  buildNotifyOptOutRow,
  parseComponentEmoji,
  NOTIFY_SUBSCRIBE_CUSTOM_ID,
  NOTIFY_UNSUBSCRIBE_CUSTOM_ID,
  NOTIFY_UNSUBSCRIBE_LABEL,
  OPT_IN_CUSTOM_ID,
  type BuildOptions,
} from './template-build-helpers';

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

export function buildMessagePayload(
  payload: TemplatePayload,
  context: PlaceholderContext,
  options: BuildOptions = {},
): MessageCreateOptions {
  if (payload.useComponentsV2) return buildComponentsV2Payload(payload, context, options);

  const embeds = payload.embeds
    .map((spec) => buildEmbed(spec, context))
    .filter((embed): embed is EmbedBuilder => embed !== null);

  const row = buildButtonRow(payload, context, options.includeOptIn === true);
  const rows = row ? [row] : [];
  if (options.includeNotifyOptOut) rows.push(buildNotifyOptOutRow());

  return {
    content: fill(payload.content, context),
    embeds,
    components: rows,
  };
}

function toJson(component: unknown): unknown {
  const encodable = component as { toJSON?: () => unknown };
  return typeof encodable.toJSON === 'function' ? encodable.toJSON() : component;
}

/** Webhook gửi qua REST thuần nên cần JSON, không nhận builder. */
export function buildRestPayload(
  payload: TemplatePayload,
  context: PlaceholderContext,
  options: BuildOptions = {},
): Record<string, unknown> {
  const built = buildMessagePayload(payload, context, options);
  const components = (built.components ?? []).map(toJson);

  if (payload.useComponentsV2) {
    // Components V2 thay chỗ của content/embeds, gửi kèm hai field đó là lỗi 400.
    return {
      flags: Number(MessageFlags.IsComponentsV2),
      components,
      allowed_mentions: { parse: [] },
    };
  }

  return {
    content: built.content ?? undefined,
    embeds: (built.embeds ?? []).map(toJson),
    components,
    allowed_mentions: { parse: [] },
  };
}
