import { el } from './dom-helpers.js';
import { renderMarkdown } from './discord-markdown.js';

const ACCENT_FALLBACK = '#4e5058';

function textBlockNode(content, fill) {
  // Dùng lại class dc-content để markdown (heading, quote, code, mention…) ăn đúng style.
  return el('div', { class: 'dc-content v2-text', html: renderMarkdown(fill(content) ?? '') });
}

function revealOnClick(event) {
  event.currentTarget.classList.remove('spoiler');
}

function galleryNode(block, fill) {
  const items = (block.items ?? []).filter((item) => item.url?.trim()).slice(0, 10);
  if (items.length === 0) return null;

  // Discord xếp mosaic; ở đây 1 ảnh full, 2-4 ảnh hai cột, nhiều hơn thì ba cột.
  const columns = items.length === 1 ? 1 : items.length <= 4 ? 2 : 3;

  return el(
    'div',
    { class: `v2-gallery cols-${columns}` },
    items.map((item) =>
      el(
        'div',
        {
          class: `v2-media${item.spoiler ? ' spoiler' : ''}`,
          title: item.description || undefined,
          onClick: item.spoiler ? revealOnClick : undefined,
        },
        [el('img', { src: fill(item.url), alt: item.description ?? '', loading: 'lazy' })],
      ),
    ),
  );
}

function sectionNode(block, fill, makeButton) {
  const lines = (block.lines ?? []).filter((line) => line?.trim()).slice(0, 3);
  if (lines.length === 0) return null;

  const node = el('div', { class: 'v2-section' }, [
    el('div', { class: 'v2-section-text' }, lines.map((line) => textBlockNode(line, fill))),
  ]);

  if (block.accessory === 'thumbnail' && block.thumbnailUrl?.trim()) {
    node.append(
      el('div', { class: 'v2-section-thumb' }, [
        el('img', {
          src: fill(block.thumbnailUrl),
          alt: block.thumbnailDescription ?? '',
          loading: 'lazy',
        }),
      ]),
    );
  } else if (block.accessory === 'button' && block.buttonLabel?.trim()) {
    node.append(
      el('div', { class: 'v2-section-accessory' }, [
        makeButton(fill(block.buttonLabel), '', 'link'),
      ]),
    );
  }

  return node;
}

function separatorNode(block) {
  const spacing = block.spacing === 'large' ? 'large' : 'small';
  return el('div', { class: `v2-separator ${spacing}${block.divider === false ? ' no-line' : ''}` });
}

/**
 * Render layout Components V2 thành DOM giống cách Discord hiển thị.
 * deps: { fill, makeButton, buttonsRow } — truyền vào để module này không phụ
 * thuộc ngược lại discord-message-preview.js.
 */
export function renderComponentsV2(payload, deps) {
  const { fill, makeButton, buttonsRow } = deps;
  const layout = payload.v2 ?? { blocks: [] };
  const isSpoiler = layout.spoiler === true;

  const container = el('div', {
    class: `v2-container${isSpoiler ? ' spoiler' : ''}`,
    onClick: isSpoiler ? revealOnClick : undefined,
  });
  container.style.borderLeftColor = /^#[0-9a-fA-F]{6}$/.test(layout.accentColor ?? '')
    ? layout.accentColor
    : ACCENT_FALLBACK;

  let buttonsPlaced = false;

  for (const block of layout.blocks ?? []) {
    if (block.kind === 'text') {
      if (block.content?.trim()) container.append(textBlockNode(block.content, fill));
      continue;
    }
    if (block.kind === 'section') {
      const node = sectionNode(block, fill, makeButton);
      if (node) container.append(node);
      continue;
    }
    if (block.kind === 'gallery') {
      const node = galleryNode(block, fill);
      if (node) container.append(node);
      continue;
    }
    if (block.kind === 'separator') {
      container.append(separatorNode(block));
      continue;
    }
    if (block.kind === 'buttons' && buttonsRow && !buttonsPlaced) {
      container.append(buttonsRow);
      buttonsPlaced = true;
    }
  }

  if (!buttonsPlaced && buttonsRow) container.append(buttonsRow);

  if (container.children.length === 0) {
    container.append(el('div', { class: 'v2-empty', text: 'Chưa có gì trong khung này' }));
  }

  return container;
}
