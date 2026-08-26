import { api } from './api-client.js';
import { el, toast } from './dom-helpers.js';

let cachedGroups = null;
let openPanel = null;

async function loadGroups() {
  if (cachedGroups) return cachedGroups;
  const data = await api.listEmojis();
  cachedGroups = data.groups ?? [];
  return cachedGroups;
}

export function insertAtCursor(field, text) {
  if (!field) return;
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  field.value = `${field.value.slice(0, start)}${text}${field.value.slice(end)}`;
  const caret = start + text.length;
  field.setSelectionRange(caret, caret);
  field.focus();
  field.dispatchEvent(new Event('input', { bubbles: true }));
}

function closePanel() {
  openPanel?.remove();
  openPanel = null;
}

// Đăng ký một lần cho cả trang: composer render lại nhiều lần nên không gắn
// listener bên trong createEmojiButton.
document.addEventListener('click', () => closePanel());

function buildPanel(groups, onPick) {
  const grid = el('div', {
    style:
      'display:flex;flex-wrap:wrap;gap:4px;max-height:240px;overflow-y:auto;padding:4px 0;align-content:flex-start',
  });

  const render = (term) => {
    grid.innerHTML = '';
    const needle = term.trim().toLowerCase();
    let shown = 0;
    for (const group of groups) {
      const matches = group.emojis.filter((emoji) => emoji.name.toLowerCase().includes(needle));
      if (matches.length === 0) continue;
      grid.append(el('div', { class: 'muted', style: 'width:100%;margin-top:6px', text: group.guildName }));
      for (const emoji of matches.slice(0, 200)) {
        shown += 1;
        grid.append(
          el('button', {
            class: 'ghost small',
            title: `:${emoji.name}:`,
            style: 'padding:4px;line-height:0;border-color:transparent',
            onClick: (event) => {
              event.preventDefault();
              onPick(emoji.mention);
            },
          }, [el('img', { src: emoji.url, alt: emoji.name, width: 24, height: 24 })]),
        );
      }
    }
    if (shown === 0) grid.append(el('div', { class: 'muted', text: 'Không có emoji khớp.' }));
  };

  const search = el('input', {
    type: 'text',
    placeholder: 'Tìm emoji…',
    onInput: (event) => render(event.target.value),
  });

  render('');

  return el(
    'div',
    {
      class: 'card',
      style:
        'position:absolute;z-index:40;width:340px;box-shadow:0 8px 24px rgb(0 0 0 / 45%);margin-top:4px',
      onClick: (event) => event.stopPropagation(),
    },
    [
      el('div', { class: 'repeat-head' }, [
        el('strong', { text: 'Emoji server' }),
        el('button', { class: 'ghost small', text: 'Đóng', onClick: closePanel }),
      ]),
      search,
      grid,
      el('div', { class: 'muted', style: 'margin-top:6px', text: 'Bot dùng được emoji của mọi server nó đang ở.' }),
    ],
  );
}

/** Nút mở bảng emoji, chèn dạng <:name:id> vào field đang chọn. */
export function createEmojiButton(resolveTargetField) {
  const wrapper = el('span', { style: 'position:relative;display:inline-block' });
  const button = el('button', {
    class: 'ghost small',
    type: 'button',
    text: 'Emoji server',
    onClick: async (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (openPanel) {
        closePanel();
        return;
      }
      try {
        const groups = await loadGroups();
        if (groups.length === 0) {
          toast('Bot chưa thấy emoji nào. Kiểm tra bot đã ở trong server có emoji chưa.', 'bad');
          return;
        }
        const panel = buildPanel(groups, (mention) => insertAtCursor(resolveTargetField(), mention));
        wrapper.append(panel);
        openPanel = panel;
      } catch (error) {
        toast(`Không tải được emoji: ${error.message}`, 'bad');
      }
    },
  });

  wrapper.append(button);
  return wrapper;
}
