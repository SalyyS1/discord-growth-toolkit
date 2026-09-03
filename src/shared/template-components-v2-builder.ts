import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  ThumbnailBuilder,
  type MessageCreateOptions,
} from 'discord.js';
import {
  buildButtonRow,
  buildNotifyOptOutRow,
  fill,
  parseColor,
  type BuildOptions,
} from './template-build-helpers';
import {
  DISCORD_LIMITS,
  type PlaceholderContext,
  type TemplatePayload,
  type V2GalleryBlock,
  type V2SectionBlock,
  type V2SeparatorBlock,
} from './template-types';

function buildSeparator(block: V2SeparatorBlock): SeparatorBuilder {
  return new SeparatorBuilder()
    .setDivider(block.divider !== false)
    .setSpacing(block.spacing === 'large' ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small);
}

function buildGallery(
  block: V2GalleryBlock,
  context: PlaceholderContext,
): MediaGalleryBuilder | null {
  const gallery = new MediaGalleryBuilder();
  let count = 0;

  for (const item of block.items) {
    if (count >= DISCORD_LIMITS.v2GalleryItems) break;
    const url = fill(item.url, context);
    if (!url || !/^https?:\/\//.test(url)) continue;

    const galleryItem = new MediaGalleryItemBuilder().setURL(url);
    const description = fill(item.description, context);
    if (description) galleryItem.setDescription(description);
    if (item.spoiler) galleryItem.setSpoiler(true);

    gallery.addItems(galleryItem);
    count += 1;
  }

  return count > 0 ? gallery : null;
}

/**
 * Section bắt buộc phải có accessory (ảnh nhỏ hoặc nút). Thiếu accessory thì đổ
 * text ra thẳng container thay vì gửi một section Discord sẽ từ chối.
 */
function addSection(
  container: ContainerBuilder,
  block: V2SectionBlock,
  context: PlaceholderContext,
): void {
  const lines: string[] = [];
  for (const line of block.lines) {
    if (lines.length >= DISCORD_LIMITS.v2SectionLines) break;
    const filled = fill(line, context);
    if (filled) lines.push(filled);
  }
  if (lines.length === 0) return;

  const thumbnailUrl = block.accessory === 'thumbnail' ? fill(block.thumbnailUrl, context) : undefined;
  const buttonUrl = block.accessory === 'button' ? fill(block.buttonUrl, context) : undefined;
  const buttonLabel = fill(block.buttonLabel, context);
  const useThumbnail = Boolean(thumbnailUrl && /^https?:\/\//.test(thumbnailUrl));
  const useButton = Boolean(buttonUrl && /^https?:\/\//.test(buttonUrl) && buttonLabel);

  if (!useThumbnail && !useButton) {
    for (const line of lines) {
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
    }
    return;
  }

  const section = new SectionBuilder();
  for (const line of lines) {
    section.addTextDisplayComponents(new TextDisplayBuilder().setContent(line));
  }

  if (useThumbnail) {
    const thumbnail = new ThumbnailBuilder().setURL(thumbnailUrl!);
    const description = fill(block.thumbnailDescription, context);
    if (description) thumbnail.setDescription(description);
    section.setThumbnailAccessory(thumbnail);
  } else {
    section.setButtonAccessory(
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(buttonUrl!).setLabel(buttonLabel!),
    );
  }

  container.addSectionComponents(section);
}

/**
 * Dựng tin nhắn Components V2: mọi nội dung nằm trong một container, kèm flag
 * IsComponentsV2. Discord bỏ qua content/embeds khi flag này được bật.
 */
export function buildComponentsV2Payload(
  payload: TemplatePayload,
  context: PlaceholderContext,
  options: BuildOptions = {},
): MessageCreateOptions {
  const layout = payload.v2 ?? { blocks: [] };
  const container = new ContainerBuilder();

  const accent = parseColor(layout.accentColor);
  if (accent !== undefined) container.setAccentColor(accent);
  if (layout.spoiler) container.setSpoiler(true);

  const buttonRow = buildButtonRow(payload, context, options.includeOptIn === true);
  let buttonRowPlaced = false;

  for (const block of layout.blocks) {
    switch (block.kind) {
      case 'text': {
        const content = fill(block.content, context);
        if (content) container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
        break;
      }
      case 'section':
        addSection(container, block, context);
        break;
      case 'gallery': {
        const gallery = buildGallery(block, context);
        if (gallery) container.addMediaGalleryComponents(gallery);
        break;
      }
      case 'separator':
        container.addSeparatorComponents(buildSeparator(block));
        break;
      case 'buttons':
        if (buttonRow && !buttonRowPlaced) {
          container.addActionRowComponents(buttonRow);
          buttonRowPlaced = true;
        }
        break;
    }
  }

  // Template có nút nhưng layout chưa đặt block "buttons" thì vẫn phải hiện nút.
  if (buttonRow && !buttonRowPlaced) container.addActionRowComponents(buttonRow);

  const components: (ContainerBuilder | ActionRowBuilder<ButtonBuilder>)[] = [container];
  // Nút huỷ nhận để ngoài container cho khỏi lẫn vào nội dung thông báo.
  if (options.includeNotifyOptOut) components.push(buildNotifyOptOutRow());

  return { components, flags: MessageFlags.IsComponentsV2 };
}
