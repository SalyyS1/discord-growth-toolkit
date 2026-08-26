import { DISCORD_LIMITS, type TemplatePayload } from './template-types';

export interface ValidationIssue {
  level: 'error' | 'warning';
  field: string;
  message: string;
}

function textLength(value: string | undefined): number {
  return value ? value.length : 0;
}

/**
 * Kiểm tra trước khi gửi để không ăn lỗi 400 từ Discord.
 * error = Discord sẽ từ chối, warning = gửi được nhưng nên sửa.
 */
export function validateTemplatePayload(payload: TemplatePayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (textLength(payload.content) > DISCORD_LIMITS.content) {
    issues.push({
      level: 'error',
      field: 'content',
      message: `Nội dung ${payload.content!.length}/${DISCORD_LIMITS.content} ký tự`,
    });
  }

  if (payload.embeds.length > DISCORD_LIMITS.embeds) {
    issues.push({
      level: 'error',
      field: 'embeds',
      message: `Tối đa ${DISCORD_LIMITS.embeds} embed, đang có ${payload.embeds.length}`,
    });
  }

  let totalCharacters = 0;

  payload.embeds.forEach((embed, index) => {
    const label = `embed[${index}]`;
    totalCharacters +=
      textLength(embed.title) +
      textLength(embed.description) +
      textLength(embed.footerText) +
      textLength(embed.authorName);

    if (textLength(embed.title) > DISCORD_LIMITS.embedTitle) {
      issues.push({ level: 'error', field: `${label}.title`, message: 'Tiêu đề quá 256 ký tự' });
    }
    if (textLength(embed.description) > DISCORD_LIMITS.embedDescription) {
      issues.push({
        level: 'error',
        field: `${label}.description`,
        message: `Mô tả ${embed.description!.length}/4096 ký tự`,
      });
    }
    if (textLength(embed.footerText) > DISCORD_LIMITS.embedFooter) {
      issues.push({ level: 'error', field: `${label}.footer`, message: 'Footer quá 2048 ký tự' });
    }
    if (embed.fields.length > DISCORD_LIMITS.embedFields) {
      issues.push({ level: 'error', field: `${label}.fields`, message: 'Tối đa 25 field' });
    }

    embed.fields.forEach((field, fieldIndex) => {
      totalCharacters += textLength(field.name) + textLength(field.value);
      if (!field.name.trim() || !field.value.trim()) {
        issues.push({
          level: 'error',
          field: `${label}.fields[${fieldIndex}]`,
          message: 'Field phải có cả tên và nội dung',
        });
      }
      if (textLength(field.name) > DISCORD_LIMITS.embedFieldName) {
        issues.push({
          level: 'error',
          field: `${label}.fields[${fieldIndex}].name`,
          message: 'Tên field quá 256 ký tự',
        });
      }
      if (textLength(field.value) > DISCORD_LIMITS.embedFieldValue) {
        issues.push({
          level: 'error',
          field: `${label}.fields[${fieldIndex}].value`,
          message: 'Nội dung field quá 1024 ký tự',
        });
      }
    });

    const hasContent =
      embed.title || embed.description || embed.fields.length > 0 || embed.imageUrl;
    if (!hasContent) {
      issues.push({ level: 'warning', field: label, message: 'Embed rỗng, sẽ không hiện gì' });
    }
    if (embed.color && !/^#[0-9a-fA-F]{6}$/.test(embed.color)) {
      issues.push({ level: 'error', field: `${label}.color`, message: 'Màu phải dạng #RRGGBB' });
    }
  });

  if (totalCharacters > DISCORD_LIMITS.embedTotal) {
    issues.push({
      level: 'error',
      field: 'embeds',
      message: `Tổng ký tự embed ${totalCharacters}/${DISCORD_LIMITS.embedTotal}`,
    });
  }

  const buttonCount = payload.linkButtons.length + (payload.optInButton ? 1 : 0);
  if (buttonCount > DISCORD_LIMITS.buttonsPerRow) {
    issues.push({
      level: 'error',
      field: 'buttons',
      message: `Tối đa ${DISCORD_LIMITS.buttonsPerRow} nút một hàng, đang có ${buttonCount}`,
    });
  }

  payload.linkButtons.forEach((button, index) => {
    if (!/^https?:\/\//.test(button.url)) {
      issues.push({
        level: 'error',
        field: `button[${index}].url`,
        message: 'Link button phải bắt đầu bằng http:// hoặc https://',
      });
    }
    if (!button.label.trim()) {
      issues.push({ level: 'error', field: `button[${index}].label`, message: 'Thiếu nhãn nút' });
    }
  });

  const hasAnything =
    textLength(payload.content) > 0 || payload.embeds.length > 0 || buttonCount > 0;
  if (!hasAnything) {
    issues.push({ level: 'error', field: 'payload', message: 'Tin nhắn trống' });
  }

  return issues;
}

export function hasBlockingIssue(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === 'error');
}
