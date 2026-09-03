import { checkbox, el, field, selectInput, textArea, textInput } from '../dom-helpers.js';

/**
 * Editor cho Components V2. public/ không có build step nên các mặc định này
 * lặp lại createEmptyV2Block() bên TS — cùng lý do applyPlaceholders bị lặp
 * trong discord-message-preview.js.
 */
const NEW_BLOCK = {
  text: () => ({ kind: 'text', content: '' }),
  section: () => ({ kind: 'section', lines: [''], accessory: 'none' }),
  gallery: () => ({ kind: 'gallery', items: [{ url: '', description: '' }] }),
  separator: () => ({ kind: 'separator', divider: true, spacing: 'small' }),
  buttons: () => ({ kind: 'buttons' }),
};

const BLOCK_LABEL = {
  text: 'Text',
  section: 'Section — text + ảnh nhỏ hoặc nút',
  gallery: 'Thư viện ảnh',
  separator: 'Ngăn cách',
  buttons: 'Hàng nút',
};

const MAX_SECTION_LINES = 3;
const MAX_GALLERY_ITEMS = 10;

/** Ô URL ảnh kèm ô xem trước nhỏ, cập nhật ngay khi dán link. */
function imageInput(value, onInput, placeholder = 'https://… .png') {
  const thumb = el('div', { class: 'img-thumb' });

  const paint = (url) => {
    const trimmed = url?.trim() ?? '';
    thumb.replaceChildren(
      /^https?:\/\//.test(trimmed)
        ? el('img', { src: trimmed, alt: '', loading: 'lazy' })
        : el('span', { text: '?' }),
    );
  };

  const input = textInput(value, (next) => {
    paint(next);
    onInput(next);
  }, placeholder);

  paint(value ?? '');
  return el('div', { class: 'img-input' }, [input, thumb]);
}

function accentPicker(layout, onChange) {
  const swatch = el('input', {
    type: 'color',
    value: /^#[0-9a-fA-F]{6}$/.test(layout.accentColor ?? '') ? layout.accentColor : '#5865f2',
    onInput: (event) => {
      layout.accentColor = event.target.value;
      hex.value = event.target.value;
      onChange();
    },
  });
  const hex = textInput(layout.accentColor ?? '#5865F2', (value) => {
    layout.accentColor = value;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) swatch.value = value;
    onChange();
  });
  return el('div', { class: 'row' }, [el('div', { class: 'shrink' }, [swatch]), el('div', {}, [hex])]);
}

function textBlockEditor(block, handlers) {
  return field(
    'Nội dung',
    textArea(block.content, (value) => {
      block.content = value;
      handlers.onChange();
    }, 'Hỗ trợ **đậm**, # heading, -# phụ đề, > quote, danh sách, `code`, emoji server…', true),
  );
}

function sectionBlockEditor(block, handlers) {
  const holder = el('div', {});
  block.lines = block.lines ?? [''];

  block.lines.forEach((line, index) => {
    holder.append(
      el('div', { class: 'row' }, [
        field(`Dòng ${index + 1}`, textArea(line, (value) => {
          block.lines[index] = value;
          handlers.onChange();
        })),
        block.lines.length > 1
          ? el('div', { class: 'shrink' }, [
              el('button', {
                class: 'danger small',
                text: 'Xoá dòng',
                onClick: () => {
                  block.lines.splice(index, 1);
                  handlers.onStructure();
                },
              }),
            ])
          : null,
      ]),
    );
  });

  if (block.lines.length < MAX_SECTION_LINES) {
    holder.append(
      el('button', {
        class: 'ghost small',
        text: '+ Thêm dòng',
        onClick: () => {
          block.lines.push('');
          handlers.onStructure();
        },
      }),
    );
  }

  holder.append(
    field(
      'Phụ kiện bên phải',
      selectInput(
        [
          { value: 'none', label: 'Không có (text trải hết chiều ngang)' },
          { value: 'thumbnail', label: 'Ảnh nhỏ' },
          { value: 'button', label: 'Nút link' },
        ],
        block.accessory ?? 'none',
        (value) => {
          block.accessory = value;
          handlers.onStructure();
        },
      ),
    ),
  );

  if (block.accessory === 'thumbnail') {
    holder.append(
      field('Ảnh nhỏ (URL)', imageInput(block.thumbnailUrl, (value) => {
        block.thumbnailUrl = value;
        handlers.onChange();
      })),
      field('Alt text cho ảnh', textInput(block.thumbnailDescription, (value) => {
        block.thumbnailDescription = value;
        handlers.onChange();
      }, 'Mô tả ảnh cho người dùng screen reader')),
    );
  }

  if (block.accessory === 'button') {
    holder.append(
      el('div', { class: 'row' }, [
        field('Nhãn nút', textInput(block.buttonLabel, (value) => {
          block.buttonLabel = value;
          handlers.onChange();
        })),
        field('URL', textInput(block.buttonUrl, (value) => {
          block.buttonUrl = value;
          handlers.onChange();
        }, 'https://… hoặc {invite}')),
      ]),
      el('div', { class: 'muted' }, 'Phụ kiện chỉ nhận nút link, không nhận nút opt-in.'),
    );
  }

  return holder;
}

function galleryBlockEditor(block, handlers) {
  const holder = el('div', {});
  block.items = block.items ?? [];

  block.items.forEach((item, index) => {
    holder.append(
      el('div', { class: 'repeat-item' }, [
        el('div', { class: 'repeat-head' }, [
          el('strong', { text: `Ảnh ${index + 1}` }),
          el('div', { class: 'actions' }, [
            checkbox('spoiler', item.spoiler === true, (checked) => {
              item.spoiler = checked;
              handlers.onChange();
            }),
            el('button', {
              class: 'danger small',
              text: 'Xoá',
              onClick: () => {
                block.items.splice(index, 1);
                handlers.onStructure();
              },
            }),
          ]),
        ]),
        field('URL ảnh', imageInput(item.url, (value) => {
          item.url = value;
          handlers.onChange();
        })),
        field('Alt text', textInput(item.description, (value) => {
          item.description = value;
          handlers.onChange();
        }, 'Không bắt buộc')),
      ]),
    );
  });

  if (block.items.length < MAX_GALLERY_ITEMS) {
    holder.append(
      el('button', {
        class: 'ghost small',
        text: '+ Thêm ảnh',
        onClick: () => {
          block.items.push({ url: '', description: '' });
          handlers.onStructure();
        },
      }),
    );
  }

  return holder;
}

function separatorBlockEditor(block, handlers) {
  return el('div', {}, [
    checkbox('Có kẻ vạch', block.divider !== false, (checked) => {
      block.divider = checked;
      handlers.onChange();
    }),
    field(
      'Khoảng cách',
      selectInput(
        [
          { value: 'small', label: 'Nhỏ' },
          { value: 'large', label: 'Lớn' },
        ],
        block.spacing ?? 'small',
        (value) => {
          block.spacing = value;
          handlers.onChange();
        },
      ),
    ),
  ]);
}

function blockBody(block, handlers) {
  if (block.kind === 'text') return textBlockEditor(block, handlers);
  if (block.kind === 'section') return sectionBlockEditor(block, handlers);
  if (block.kind === 'gallery') return galleryBlockEditor(block, handlers);
  if (block.kind === 'separator') return separatorBlockEditor(block, handlers);
  return el('div', { class: 'muted' },
    'Hàng nút lấy từ mục "Nút bấm" bên dưới. Không có khối này thì nút vẫn nằm ở cuối khung.');
}

function moveBlock(blocks, from, to, handlers) {
  if (to < 0 || to >= blocks.length) return;
  const [moved] = blocks.splice(from, 1);
  blocks.splice(to, 0, moved);
  handlers.onStructure();
}

export function v2Editor(payload, handlers) {
  const layout = payload.v2;
  const holder = el('div', {});

  holder.append(
    el('div', { class: 'row' }, [
      field('Màu viền khung', accentPicker(layout, handlers.onChange)),
      el('div', {}, [
        checkbox('Che toàn bộ khung bằng spoiler', layout.spoiler === true, (checked) => {
          layout.spoiler = checked;
          handlers.onChange();
        }),
      ]),
    ]),
  );

  layout.blocks.forEach((block, index) => {
    holder.append(
      el('div', { class: 'repeat-item' }, [
        el('div', { class: 'repeat-head' }, [
          el('strong', { text: `${index + 1}. ${BLOCK_LABEL[block.kind] ?? block.kind}` }),
          el('div', { class: 'actions' }, [
            el('button', {
              class: 'ghost small',
              text: '↑',
              title: 'Lên trên',
              disabled: index === 0,
              onClick: () => moveBlock(layout.blocks, index, index - 1, handlers),
            }),
            el('button', {
              class: 'ghost small',
              text: '↓',
              title: 'Xuống dưới',
              disabled: index === layout.blocks.length - 1,
              onClick: () => moveBlock(layout.blocks, index, index + 1, handlers),
            }),
            el('button', {
              class: 'danger small',
              text: 'Xoá',
              onClick: () => {
                layout.blocks.splice(index, 1);
                handlers.onStructure();
              },
            }),
          ]),
        ]),
        blockBody(block, handlers),
      ]),
    );
  });

  holder.append(
    el('div', { class: 'actions', style: 'margin-top:10px;flex-wrap:wrap' },
      Object.keys(NEW_BLOCK).map((kind) =>
        el('button', {
          class: 'ghost small',
          text: `+ ${BLOCK_LABEL[kind].split(' —')[0]}`,
          onClick: () => {
            layout.blocks.push(NEW_BLOCK[kind]());
            handlers.onStructure();
          },
        }),
      ),
    ),
  );

  return holder;
}
