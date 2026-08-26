import { checkbox, collapsible, el, field, textArea, textInput } from '../dom-helpers.js';

function colorPicker(spec, onChange) {
  const swatch = el('input', {
    type: 'color',
    value: /^#[0-9a-fA-F]{6}$/.test(spec.color ?? '') ? spec.color : '#5865f2',
    onInput: (event) => {
      spec.color = event.target.value;
      hex.value = event.target.value;
      onChange();
    },
  });
  const hex = textInput(spec.color ?? '#5865F2', (value) => {
    spec.color = value;
    if (/^#[0-9a-fA-F]{6}$/.test(value)) swatch.value = value;
    onChange();
  });
  return el('div', { class: 'row' }, [el('div', { class: 'shrink' }, [swatch]), el('div', {}, [hex])]);
}

function fieldsEditor(spec, handlers) {
  const container = el('div', {});

  (spec.fields ?? []).forEach((item, index) => {
    container.append(
      el('div', { class: 'repeat-item' }, [
        el('div', { class: 'repeat-head' }, [
          el('strong', { text: item.name?.trim() || `Field ${index + 1}` }),
          el('div', { class: 'actions' }, [
            checkbox('ngang', item.inline === true, (checked) => {
              item.inline = checked;
              handlers.onChange();
            }),
            el('button', {
              class: 'danger small',
              text: 'Xoá',
              onClick: () => {
                spec.fields.splice(index, 1);
                handlers.onStructure();
              },
            }),
          ]),
        ]),
        el('div', { class: 'row' }, [
          field('Tên field', textInput(item.name, (value) => {
            item.name = value;
            handlers.onChange();
          })),
        ]),
        field('Nội dung', textArea(item.value, (value) => {
          item.value = value;
          handlers.onChange();
        })),
      ]),
    );
  });

  container.append(
    el('button', {
      class: 'ghost small',
      text: '+ Thêm field',
      onClick: () => {
        spec.fields = spec.fields ?? [];
        spec.fields.push({ name: '', value: '', inline: false });
        handlers.onStructure();
      },
    }),
  );

  return container;
}

/** Phần trang trí ít dùng được gấp lại để form không dài ngoằng. */
function decorationEditor(spec, handlers) {
  return el('details', { class: 'inline-toggle' }, [
    el('summary', { text: 'Author, ảnh, footer' }),
    el('div', { style: 'margin-top:10px' }, [
      el('div', { class: 'row' }, [
        field('Tên author', textInput(spec.authorName, (value) => {
          spec.authorName = value;
          handlers.onChange();
        })),
        field('Icon author (URL)', textInput(spec.authorIconUrl, (value) => {
          spec.authorIconUrl = value;
          handlers.onChange();
        })),
      ]),
      el('div', { class: 'row' }, [
        field('Thumbnail (URL)', textInput(spec.thumbnailUrl, (value) => {
          spec.thumbnailUrl = value;
          handlers.onChange();
        })),
        field('Ảnh lớn (URL)', textInput(spec.imageUrl, (value) => {
          spec.imageUrl = value;
          handlers.onChange();
        })),
      ]),
      el('div', { class: 'row' }, [
        field('Footer', textInput(spec.footerText, (value) => {
          spec.footerText = value;
          handlers.onChange();
        })),
        field('Icon footer (URL)', textInput(spec.footerIconUrl, (value) => {
          spec.footerIconUrl = value;
          handlers.onChange();
        })),
      ]),
      checkbox('Hiện thời gian ở footer', spec.showTimestamp === true, (checked) => {
        spec.showTimestamp = checked;
        handlers.onChange();
      }),
    ]),
  ]);
}

export function embedEditor(spec, index, handlers) {
  return collapsible({
    summary: `Embed ${index + 1}`,
    note: spec.title?.trim() || spec.description?.trim()?.slice(0, 40) || 'chưa có nội dung',
    open: index === 0,
    actions: el('button', { class: 'danger small', text: 'Xoá embed', onClick: handlers.onRemove }),
    body: [
      field('Tiêu đề', textInput(spec.title, (value) => {
        spec.title = value;
        handlers.onChange();
      })),
      field('Link cho tiêu đề', textInput(spec.url, (value) => {
        spec.url = value;
        handlers.onChange();
      }, 'https://…')),
      field(
        'Mô tả',
        textArea(spec.description, (value) => {
          spec.description = value;
          handlers.onChange();
        }, 'Hỗ trợ **đậm**, # heading, -# phụ đề, > quote, danh sách, `code`, emoji server…', true),
      ),
      field('Màu viền', colorPicker(spec, handlers.onChange)),
      decorationEditor(spec, handlers),
      el('h3', { style: 'margin:16px 0 8px', text: 'Fields' }),
      fieldsEditor(spec, handlers),
    ],
  });
}

export function buttonsEditor(payload, handlers) {
  const container = el('div', {});

  (payload.linkButtons ?? []).forEach((button, index) => {
    container.append(
      el('div', { class: 'repeat-item' }, [
        el('div', { class: 'repeat-head' }, [
          el('strong', { text: button.label?.trim() || `Nút link ${index + 1}` }),
          el('button', {
            class: 'danger small',
            text: 'Xoá',
            onClick: () => {
              payload.linkButtons.splice(index, 1);
              handlers.onStructure();
            },
          }),
        ]),
        el('div', { class: 'row' }, [
          field('Nhãn', textInput(button.label, (value) => {
            button.label = value;
            handlers.onChange();
          })),
          field('Emoji', textInput(button.emoji, (value) => {
            button.emoji = value;
            handlers.onChange();
          }, '<:ten:123> hoặc 🎉')),
        ]),
        field('URL', textInput(button.url, (value) => {
          button.url = value;
          handlers.onChange();
        }, 'https://discord.gg/… hoặc {invite}')),
      ]),
    );
  });

  container.append(
    el('button', {
      class: 'ghost small',
      text: '+ Thêm nút link',
      onClick: () => {
        payload.linkButtons = payload.linkButtons ?? [];
        payload.linkButtons.push({ label: 'Tham Gia Discord', url: '{invite}', emoji: '' });
        handlers.onStructure();
      },
    }),
  );

  return container;
}
