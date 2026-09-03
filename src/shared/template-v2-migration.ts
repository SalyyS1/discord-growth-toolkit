import {
  createEmptyV2Layout,
  type EmbedSpec,
  type TemplatePayload,
  type V2Block,
  type V2Layout,
} from './template-types';

/**
 * Gộp một embed thành markdown. Components V2 không có embed, nên chữ trong
 * embed phải chuyển thành text display, nếu không bật V2 là mất hết nội dung.
 */
function embedToMarkdown(embed: EmbedSpec): string {
  const parts: string[] = [];

  if (embed.authorName?.trim()) parts.push(`-# ${embed.authorName.trim()}`);
  if (embed.title?.trim()) parts.push(`## ${embed.title.trim()}`);
  if (embed.description?.trim()) parts.push(embed.description.trim());

  for (const field of embed.fields ?? []) {
    if (!field.name?.trim() || !field.value?.trim()) continue;
    parts.push(`**${field.name.trim()}**\n${field.value.trim()}`);
  }

  if (embed.footerText?.trim()) parts.push(`-# ${embed.footerText.trim()}`);

  return parts.join('\n\n');
}

/**
 * Dựng layout V2 từ nội dung cổ điển đang có: text ngoài embed, từng embed
 * (title/description/fields → text, thumbnail → phụ kiện section, ảnh lớn →
 * gallery), và một khối nút ở cuối nếu template có nút.
 */
export function layoutFromClassic(payload: TemplatePayload): V2Layout {
  const blocks: V2Block[] = [];

  if (payload.content?.trim()) {
    blocks.push({ kind: 'text', content: payload.content.trim() });
  }

  for (const embed of payload.embeds) {
    const text = embedToMarkdown(embed);
    const thumbnailUrl = embed.thumbnailUrl?.trim();
    const imageUrl = embed.imageUrl?.trim();
    if (!text && !thumbnailUrl && !imageUrl) continue;

    // Vạch ngăn giữa các phần thay cho khung riêng của từng embed.
    if (blocks.length > 0) blocks.push({ kind: 'separator', divider: true, spacing: 'small' });

    if (text && thumbnailUrl) {
      blocks.push({
        kind: 'section',
        lines: [text],
        accessory: 'thumbnail',
        thumbnailUrl,
        thumbnailDescription: embed.title?.trim() || undefined,
      });
    } else if (text) {
      blocks.push({ kind: 'text', content: text });
    } else if (thumbnailUrl) {
      blocks.push({ kind: 'gallery', items: [{ url: thumbnailUrl }] });
    }

    if (imageUrl) blocks.push({ kind: 'gallery', items: [{ url: imageUrl }] });
  }

  if (payload.linkButtons.length > 0 || payload.optInButton) {
    blocks.push({ kind: 'buttons' });
  }

  if (blocks.length === 0) return createEmptyV2Layout();

  const accentColor = payload.embeds.find((embed) =>
    /^#[0-9a-fA-F]{6}$/.test(embed.color ?? ''),
  )?.color;

  return { accentColor: accentColor ?? '#5865F2', blocks };
}
