import { DISCORD_LIMITS, type TemplatePayload } from './template-types';
import type { ValidationIssue } from './template-validation';

function isHttpUrl(value: string | undefined): boolean {
  return /^https?:\/\//.test(value?.trim() ?? '');
}

function textLength(value: string | undefined): number {
  return value?.trim().length ?? 0;
}

interface Tally {
  components: number;
  characters: number;
  /** Số khối thực sự hiện ra chữ hoặc ảnh — dùng để bắt khung rỗng. */
  visible: number;
}

/**
 * Kiểm tra layout Components V2 trước khi gửi.
 * Đếm cả component lồng trong container vì Discord tính tổng 40 cho cả tin.
 */
export function validateV2Layout(payload: TemplatePayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const layout = payload.v2;

  if (!layout || layout.blocks.length === 0) {
    issues.push({ level: 'error', field: 'v2', message: 'Chưa có khối nội dung nào' });
    return issues;
  }

  if (layout.accentColor && !/^#[0-9a-fA-F]{6}$/.test(layout.accentColor)) {
    issues.push({ level: 'error', field: 'v2.accentColor', message: 'Màu phải dạng #RRGGBB' });
  }

  // Container bọc ngoài cũng là một component.
  const tally: Tally = { components: 1, characters: 0, visible: 0 };
  const buttonCount = payload.linkButtons.length + (payload.optInButton ? 1 : 0);

  layout.blocks.forEach((block, index) => {
    const field = `v2.block[${index}]`;

    switch (block.kind) {
      case 'text':
        tally.components += 1;
        tally.characters += textLength(block.content);
        if (textLength(block.content) === 0) {
          issues.push({ level: 'warning', field, message: 'Khối text rỗng, sẽ không hiện gì' });
        } else {
          tally.visible += 1;
        }
        break;

      case 'section': {
        const lines = block.lines.filter((line) => textLength(line) > 0);
        if (block.lines.length > DISCORD_LIMITS.v2SectionLines) {
          issues.push({
            level: 'error',
            field: `${field}.lines`,
            message: `Section tối đa ${DISCORD_LIMITS.v2SectionLines} dòng, đang có ${block.lines.length}`,
          });
        }
        if (lines.length === 0) {
          issues.push({ level: 'warning', field, message: 'Section không có dòng nào, sẽ bị bỏ' });
          break;
        }

        tally.characters += lines.reduce((sum, line) => sum + textLength(line), 0);
        tally.visible += 1;
        const hasThumbnail = block.accessory === 'thumbnail' && isHttpUrl(block.thumbnailUrl);
        const hasButton =
          block.accessory === 'button' && isHttpUrl(block.buttonUrl) && textLength(block.buttonLabel) > 0;

        if (block.accessory === 'thumbnail' && !hasThumbnail) {
          issues.push({
            level: 'error',
            field: `${field}.thumbnailUrl`,
            message: 'Ảnh phụ kiện cần URL http(s)',
          });
        }
        if (block.accessory === 'button' && !hasButton) {
          issues.push({
            level: 'error',
            field: `${field}.button`,
            message: 'Nút phụ kiện cần cả nhãn và URL http(s)',
          });
        }
        if (textLength(block.thumbnailDescription) > DISCORD_LIMITS.v2MediaDescription) {
          issues.push({
            level: 'error',
            field: `${field}.thumbnailDescription`,
            message: `Alt text quá ${DISCORD_LIMITS.v2MediaDescription} ký tự`,
          });
        }

        // Không có phụ kiện thì các dòng được đổ ra container thành text display rời.
        tally.components += hasThumbnail || hasButton ? 1 + lines.length + 1 : lines.length;
        break;
      }

      case 'gallery': {
        const valid = block.items.filter((item) => isHttpUrl(item.url));
        if (valid.length === 0) {
          issues.push({ level: 'error', field, message: 'Gallery cần ít nhất một ảnh có URL http(s)' });
        } else {
          tally.visible += 1;
        }
        if (block.items.length > DISCORD_LIMITS.v2GalleryItems) {
          issues.push({
            level: 'error',
            field,
            message: `Gallery tối đa ${DISCORD_LIMITS.v2GalleryItems} ảnh, đang có ${block.items.length}`,
          });
        }
        block.items.forEach((item, itemIndex) => {
          if (textLength(item.url) > 0 && !isHttpUrl(item.url)) {
            issues.push({
              level: 'error',
              field: `${field}.item[${itemIndex}]`,
              message: 'URL ảnh phải bắt đầu bằng http:// hoặc https://',
            });
          }
          if (textLength(item.description) > DISCORD_LIMITS.v2MediaDescription) {
            issues.push({
              level: 'error',
              field: `${field}.item[${itemIndex}].description`,
              message: `Alt text quá ${DISCORD_LIMITS.v2MediaDescription} ký tự`,
            });
          }
        });
        tally.components += 1;
        break;
      }

      case 'separator':
        tally.components += 1;
        break;

      case 'buttons':
        if (buttonCount === 0) {
          issues.push({
            level: 'warning',
            field,
            message: 'Khối nút nhưng template chưa có nút nào ở mục "Nút bấm"',
          });
          break;
        }
        tally.components += 1 + buttonCount;
        break;
    }
  });

  // Nút vẫn được gắn xuống cuối container dù layout không có khối nút.
  const hasButtonBlock = layout.blocks.some((block) => block.kind === 'buttons');
  if (!hasButtonBlock && buttonCount > 0) tally.components += 1 + buttonCount;

  // Text/embed cổ điển bị Discord bỏ khi bật V2. Nếu khung V2 lại rỗng thì tin
  // gửi đi chỉ còn nút — đúng cái bẫy làm mất nội dung, nên chặn hẳn.
  const droppedClassicText =
    textLength(payload.content) > 0 ||
    payload.embeds.some(
      (embed) =>
        textLength(embed.title) > 0 ||
        textLength(embed.description) > 0 ||
        (embed.fields ?? []).some((item) => textLength(item.value) > 0),
    );

  if (tally.visible === 0 && droppedClassicText) {
    issues.push({
      level: 'error',
      field: 'v2',
      message:
        'Khung V2 chưa có nội dung, mà text/embed cũ thì Discord bỏ qua — bấm "Chuyển nội dung cũ sang V2" hoặc nhập text vào khối',
    });
  } else if (tally.visible === 0) {
    issues.push({
      level: 'warning',
      field: 'v2',
      message: 'Khung V2 không có chữ hay ảnh nào, tin gửi đi sẽ chỉ có nút',
    });
  } else if (droppedClassicText) {
    issues.push({
      level: 'warning',
      field: 'v2',
      message: 'Bật Components V2 thì Discord bỏ qua text ngoài embed và toàn bộ embed',
    });
  }

  if (tally.components > DISCORD_LIMITS.v2Components) {
    issues.push({
      level: 'error',
      field: 'v2',
      message: `Tổng ${tally.components}/${DISCORD_LIMITS.v2Components} component cho một tin`,
    });
  }
  if (tally.characters > DISCORD_LIMITS.v2TextTotal) {
    issues.push({
      level: 'error',
      field: 'v2',
      message: `Tổng ký tự ${tally.characters}/${DISCORD_LIMITS.v2TextTotal}`,
    });
  }

  return issues;
}
