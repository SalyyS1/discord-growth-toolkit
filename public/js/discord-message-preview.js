import { el } from './dom-helpers.js';
import { renderInline, renderMarkdown } from './discord-markdown.js';

const BUTTON_STYLE_CLASS = { primary: 'primary', success: 'success', secondary: '' };

/** Thay placeholder bằng dữ liệu mẫu để preview giống tin thật. */
export function applyPlaceholders(text, context = {}) {
  if (!text) return text;
  return text
    .replaceAll('{user}', context.userMention ?? '@bạn')
    .replaceAll('{user.name}', context.userName ?? 'bạn')
    .replaceAll('{user.id}', context.userId ?? '000000000000000000')
    .replaceAll('{server}', context.serverName ?? 'Tên Server')
    .replaceAll('{members}', context.memberCount ?? '1.234')
    .replaceAll('{invite}', context.inviteUrl ?? 'https://discord.gg/xxxxxx')
    .replaceAll('{source}', context.sourceLabel ?? 'nguồn-mẫu');
}

function embedNode(spec, context) {
  const fill = (value) => applyPlaceholders(value, context);
  const embed = el('div', { class: 'dc-embed' });
  embed.style.borderLeftColor = /^#[0-9a-fA-F]{6}$/.test(spec.color ?? '') ? spec.color : '#5865f2';

  const main = el('div', { class: 'embed-main' });

  if (spec.authorName?.trim()) {
    main.append(
      el('div', { class: 'embed-author' }, [
        spec.authorIconUrl?.trim() ? el('img', { src: spec.authorIconUrl, alt: '' }) : null,
        el('span', { html: renderInline(fill(spec.authorName)) }),
      ]),
    );
  }

  if (spec.title?.trim()) {
    const title = el('div', { class: 'embed-title' });
    if (spec.url?.trim()) {
      title.append(
        el('a', { href: spec.url, target: '_blank', rel: 'noopener', html: renderInline(fill(spec.title)) }),
      );
    } else {
      title.innerHTML = renderInline(fill(spec.title));
    }
    main.append(title);
  }

  if (spec.description?.trim()) {
    main.append(el('div', { class: 'embed-description', html: renderMarkdown(fill(spec.description)) }));
  }

  const fields = (spec.fields ?? []).filter((item) => item.name?.trim() || item.value?.trim());
  if (fields.length > 0) {
    main.append(
      el(
        'div',
        { class: 'embed-fields' },
        fields.map((item) =>
          el('div', { class: `embed-field${item.inline ? ' inline' : ''}` }, [
            el('div', { class: 'field-name', html: renderInline(fill(item.name)) }),
            el('div', { class: 'field-value', html: renderMarkdown(fill(item.value)) }),
          ]),
        ),
      ),
    );
  }

  embed.append(main);

  if (spec.thumbnailUrl?.trim()) {
    embed.append(el('div', { class: 'embed-thumb' }, [el('img', { src: spec.thumbnailUrl, alt: '' })]));
  }

  if (spec.imageUrl?.trim()) {
    embed.append(el('div', { class: 'embed-image' }, [el('img', { src: spec.imageUrl, alt: '' })]));
  }

  const footerText = spec.footerText?.trim();
  if (footerText || spec.showTimestamp) {
    const parts = [];
    if (footerText) parts.push(applyPlaceholders(footerText, context));
    if (spec.showTimestamp) parts.push(new Date().toLocaleString('vi-VN'));
    embed.append(
      el('div', { class: 'embed-footer' }, [
        spec.footerIconUrl?.trim() ? el('img', { src: spec.footerIconUrl, alt: '' }) : null,
        el('span', { text: parts.join(' • ') }),
      ]),
    );
  }

  return embed;
}

function buttonNode(label, emoji, extraClass) {
  const node = el('div', { class: `dc-button ${extraClass}` });
  if (emoji?.trim()) {
    const custom = /^<(a?):([\w~]+):(\d+)>$/.exec(emoji.trim());
    if (custom) {
      node.append(
        el('img', {
          class: 'dc-emoji',
          src: `https://cdn.discordapp.com/emojis/${custom[3]}.${custom[1] === 'a' ? 'gif' : 'webp'}?size=64`,
          alt: '',
        }),
      );
    } else {
      node.append(el('span', { text: emoji.trim() }));
    }
  }
  if (label?.trim()) node.append(el('span', { text: label.trim() }));
  return node;
}

export function renderMessagePreview(payload, options = {}) {
  const context = options.context ?? {};
  const botName = options.botName ?? 'Bot của bạn';

  const body = el('div', { class: 'dc-body' }, [
    el('div', { class: 'dc-author' }, [
      el('span', { class: 'name', text: botName }),
      el('span', { class: 'app-tag', text: 'APP' }),
      el('span', { class: 'time', text: `Hôm nay lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}` }),
    ]),
  ]);

  if (payload.content?.trim()) {
    body.append(el('div', { class: 'dc-content', html: renderMarkdown(applyPlaceholders(payload.content, context)) }));
  }

  for (const spec of payload.embeds ?? []) {
    const hasContent =
      spec.title?.trim() ||
      spec.description?.trim() ||
      spec.imageUrl?.trim() ||
      (spec.fields ?? []).some((item) => item.name?.trim() && item.value?.trim());
    if (hasContent) body.append(embedNode(spec, context));
  }

  const buttons = [];
  for (const button of payload.linkButtons ?? []) {
    if (!button.label?.trim() && !button.emoji?.trim()) continue;
    buttons.push(buttonNode(applyPlaceholders(button.label, context), button.emoji, 'link'));
  }
  if (options.includeOptIn && payload.optInButton) {
    buttons.push(
      buttonNode(
        payload.optInButton.label || 'Nhận thông tin',
        payload.optInButton.emoji,
        BUTTON_STYLE_CLASS[payload.optInButton.style] ?? 'primary',
      ),
    );
  }
  if (buttons.length > 0) body.append(el('div', { class: 'dc-buttons' }, buttons));

  const avatarInitial = botName.slice(0, 1).toUpperCase();
  return el('div', { class: 'dc-preview' }, [
    el('div', { class: 'dc-message' }, [
      el('div', { class: 'dc-avatar' }, [
        options.botAvatarUrl ? el('img', { src: options.botAvatarUrl, alt: '' }) : avatarInitial,
      ]),
      body,
    ]),
  ]);
}
