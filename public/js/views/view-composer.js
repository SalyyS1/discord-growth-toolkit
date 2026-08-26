import { api } from '../api-client.js';
import {
  card,
  checkbox,
  el,
  field,
  pageHead,
  selectInput,
  textArea,
  textInput,
  toast,
} from '../dom-helpers.js';
import { renderMessagePreview } from '../discord-message-preview.js';
import { createEmojiButton } from '../emoji-picker.js';
import { buttonsEditor, embedEditor } from './composer-embed-editor.js';
import { createSendPanel } from './composer-send-panel.js';

const KINDS = [
  { value: 'announcement', label: 'Announcement — đăng lên channel' },
  { value: 'panel', label: 'Panel opt-in — có nút để user tự bấm' },
  { value: 'dm', label: 'DM — gửi sau khi user bấm nút' },
  { value: 'welcome', label: 'Welcome — DM cho người mới join server nhà' },
];

const KIND_HINT = {
  announcement: 'Tin thường: đăng lên channel bằng bot hoặc webhook.',
  panel: 'Tin có nút opt-in. Đăng ở server đối tác, ai bấm nút mới nhận DM.',
  dm: 'Nội dung bot DM cho người đã bấm nút opt-in.',
  welcome: 'Nội dung bot DM cho người mới join server nhà (phải bật trong tab Server).',
};

function emptyPayload() {
  return {
    content: '',
    embeds: [{ color: '#5865F2', fields: [], showTimestamp: false }],
    linkButtons: [],
    optInButton: null,
  };
}

function newTemplate() {
  return { id: null, name: 'Nội dung mới', kind: 'announcement', payload: emptyPayload() };
}

// Field text được focus gần nhất, để nút emoji biết chèn vào đâu.
let lastFocusedField = null;
document.addEventListener('focusin', (event) => {
  const node = event.target;
  if (node instanceof HTMLTextAreaElement || (node instanceof HTMLInputElement && node.type === 'text')) {
    lastFocusedField = node;
  }
});

export async function renderComposer(root) {
  const state = { templates: [], current: newTemplate(), issues: [] };

  try {
    state.templates = (await api.listTemplates()).templates ?? [];
  } catch (error) {
    toast(`Không tải được danh sách nội dung: ${error.message}`, 'bad');
  }

  const previewHolder = el('div', {});
  const issuesHolder = el('div', { style: 'margin-top:12px' });
  let validateTimer = null;

  const includeOptIn = () => state.current.kind === 'panel' && Boolean(state.current.payload.optInButton);

  function renderIssues() {
    if (state.issues.length === 0) {
      issuesHolder.replaceChildren(el('span', { class: 'badge ok', text: 'Hợp lệ — gửi được' }));
      return;
    }
    const errors = state.issues.filter((issue) => issue.level === 'error').length;
    issuesHolder.replaceChildren(
      el('span', {
        class: `badge ${errors > 0 ? 'bad' : 'warn'}`,
        text: errors > 0 ? `${errors} lỗi cần sửa` : `${state.issues.length} cảnh báo`,
      }),
      el(
        'ul',
        { class: 'issue-list', style: 'margin-top:8px' },
        state.issues.map((issue) =>
          el('li', { class: issue.level, text: `${issue.field}: ${issue.message}` }),
        ),
      ),
    );
  }

  function refreshPreview() {
    previewHolder.replaceChildren(
      renderMessagePreview(state.current.payload, { includeOptIn: includeOptIn() }),
    );
    clearTimeout(validateTimer);
    validateTimer = setTimeout(async () => {
      try {
        state.issues = (await api.validateTemplate(state.current.payload)).issues ?? [];
      } catch {
        state.issues = [];
      }
      renderIssues();
    }, 400);
  }

  async function saveTemplate() {
    const body = { name: state.current.name, kind: state.current.kind, payload: state.current.payload };
    try {
      const data = state.current.id
        ? await api.updateTemplate(state.current.id, body)
        : await api.createTemplate(body);
      state.current = {
        id: data.template.id,
        name: data.template.name,
        kind: data.template.kind,
        payload: data.template.payload,
      };
      state.templates = (await api.listTemplates()).templates ?? [];
      toast('Đã lưu.', 'ok');
      renderAll();
    } catch (error) {
      toast(`Lưu thất bại: ${error.message}`, 'bad');
    }
  }

  async function deleteTemplate() {
    if (!state.current.id || !confirm(`Xoá "${state.current.name}"?`)) return;
    try {
      await api.deleteTemplate(state.current.id);
      state.current = newTemplate();
      state.templates = (await api.listTemplates()).templates ?? [];
      toast('Đã xoá.', 'ok');
      renderAll();
    } catch (error) {
      toast(`Xoá thất bại: ${error.message}`, 'bad');
    }
  }

  function optInEditor() {
    const payload = state.current.payload;
    const enabled = Boolean(payload.optInButton);
    const holder = el('div', { class: 'repeat-item' }, [
      el('div', { class: 'repeat-head' }, [
        el('strong', { text: 'Nút opt-in' }),
        checkbox('Bật', enabled, (checked) => {
          payload.optInButton = checked
            ? { label: 'Nhận thông tin', emoji: '', style: 'primary', ackMessage: '' }
            : null;
          renderAll();
        }),
      ]),
      el('div', { class: 'muted' }, 'Đây là nút duy nhất khiến bot gửi DM. Không bấm thì không ai bị DM.'),
    ]);

    if (!enabled) return holder;

    const button = payload.optInButton;
    holder.append(
      el('div', { class: 'row', style: 'margin-top:12px' }, [
        field('Nhãn nút', textInput(button.label, (value) => {
          button.label = value;
          refreshPreview();
        })),
        field('Emoji', textInput(button.emoji, (value) => {
          button.emoji = value;
          refreshPreview();
        }, '<:ten:123>')),
        field('Màu nút', selectInput(
          [
            { value: 'primary', label: 'Xanh dương' },
            { value: 'success', label: 'Xanh lá' },
            { value: 'secondary', label: 'Xám' },
          ],
          button.style,
          (value) => {
            button.style = value;
            refreshPreview();
          },
        )),
      ]),
      field(
        'Lời nhắn hiện sau khi bấm (chỉ user đó thấy)',
        textInput(button.ackMessage, (value) => {
          button.ackMessage = value;
        }, 'Đã gửi cho bạn một tin nhắn riêng nhé!'),
      ),
    );
    return holder;
  }

  function renderAll() {
    const payload = state.current.payload;
    const handlers = { onChange: refreshPreview, onStructure: renderAll };

    const templateOptions = [
      { value: '', label: '+ Nội dung mới' },
      ...state.templates.map((template) => ({
        value: String(template.id),
        label: `${template.name} · ${template.kind}`,
      })),
    ];

    const metaCard = card({
      title: 'Nội dung',
      hint: KIND_HINT[state.current.kind],
      actions: [
        el('button', {
          class: 'primary',
          text: state.current.id ? 'Lưu' : 'Tạo mới',
          onClick: saveTemplate,
        }),
        state.current.id ? el('button', { class: 'danger', text: 'Xoá', onClick: deleteTemplate }) : null,
      ],
      body: [
        field(
          'Mở nội dung đã lưu',
          selectInput(templateOptions, state.current.id ?? '', (value) => {
            if (!value) state.current = newTemplate();
            else {
              const found = state.templates.find((template) => String(template.id) === value);
              if (found) {
                state.current = {
                  id: found.id,
                  name: found.name,
                  kind: found.kind,
                  payload: { ...emptyPayload(), ...found.payload },
                };
              }
            }
            renderAll();
          }),
        ),
        el('div', { class: 'row' }, [
          field('Tên', textInput(state.current.name, (value) => {
            state.current.name = value;
          })),
          field('Loại', selectInput(KINDS, state.current.kind, (value) => {
            state.current.kind = value;
            renderAll();
          })),
        ]),
      ],
    });

    const contentCard = card({
      title: 'Tin nhắn',
      hint: 'Placeholder: {user} {user.name} {server} {members} {invite} {source}',
      actions: createEmojiButton(() => lastFocusedField),
      body: [
        field(
          'Text ngoài embed',
          textArea(payload.content, (value) => {
            payload.content = value;
            refreshPreview();
          }, 'Không bắt buộc — có thể để trống và chỉ dùng embed'),
        ),
        el('h3', { style: 'margin:18px 0 8px', text: 'Embeds' }),
        ...(payload.embeds ?? []).map((spec, index) =>
          embedEditor(spec, index, {
            ...handlers,
            onRemove: () => {
              payload.embeds.splice(index, 1);
              renderAll();
            },
          }),
        ),
        el('button', {
          class: 'ghost small',
          text: '+ Thêm embed',
          onClick: () => {
            payload.embeds = payload.embeds ?? [];
            payload.embeds.push({ color: '#5865F2', fields: [], showTimestamp: false });
            renderAll();
          },
        }),
        el('h3', { style: 'margin:20px 0 8px', text: 'Nút bấm' }),
        buttonsEditor(payload, handlers),
        state.current.kind === 'panel' ? optInEditor() : null,
      ],
    });

    const previewCard = card({
      title: 'Preview',
      hint: 'Render theo đúng cách Discord hiển thị: markdown, emoji server, embed, nút.',
      body: [previewHolder, issuesHolder],
    });

    root.replaceChildren(
      pageHead(
        'Soạn nội dung',
        'Soạn, xem trước, kiểm tra giới hạn Discord, rồi mới gửi. Gửi thử vào DM của bạn để xem bản thật.',
        state.current.id ? el('span', { class: 'badge brand', text: `#${state.current.id}` }) : null,
      ),
      el('div', { class: 'split-editor' }, [
        el('div', { class: 'stack' }, [metaCard, contentCard]),
        el('div', { class: 'stack sticky-column' }, [
          previewCard,
          createSendPanel(() => state.current.payload, () => state.current.id, includeOptIn),
        ]),
      ]),
    );

    refreshPreview();
  }

  renderAll();
}
