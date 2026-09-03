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
import { clearDraft, draftBanner, loadDraft, saveDraft } from './composer-draft-store.js';
import { v2Editor } from './composer-v2-editor.js';
import { createSendPanel } from './composer-send-panel.js';

const KINDS = [
  { value: 'announcement', label: 'Announcement — đăng lên channel' },
  { value: 'panel', label: 'Panel opt-in — có nút để user tự bấm' },
  { value: 'dm', label: 'DM — gửi sau khi user bấm nút' },
  { value: 'welcome', label: 'Welcome — DM cho người mới join server nhà' },
];

const KIND_HINT = {
  announcement: 'Tin thường: đăng lên channel bằng bot hoặc webhook.',
  panel: 'Tin có nút opt-in: DM ngay ở server đối tác, hoặc ghi danh nhận thông báo ở server nhà.',
  dm: 'Nội dung bot DM cho người đã bấm nút opt-in hoặc đã đăng ký nhận thông báo.',
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

function emptyV2Layout() {
  return { accentColor: '#5865F2', blocks: [{ kind: 'text', content: '' }] };
}

/** Có chữ ở text ngoài embed hoặc trong embed — thứ Discord sẽ bỏ khi bật V2. */
function classicHasText(payload) {
  if (payload.content?.trim()) return true;
  return (payload.embeds ?? []).some(
    (embed) =>
      embed.title?.trim() ||
      embed.description?.trim() ||
      (embed.fields ?? []).some((item) => item.value?.trim()),
  );
}

function v2HasContent(layout) {
  return (layout?.blocks ?? []).some((block) => {
    if (block.kind === 'text') return Boolean(block.content?.trim());
    if (block.kind === 'section') return (block.lines ?? []).some((line) => line?.trim());
    if (block.kind === 'gallery') return (block.items ?? []).some((item) => item.url?.trim());
    return false;
  });
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

// Ctrl/Cmd+S lưu nội dung đang mở. Listener gắn một lần cho cả phiên và trỏ tới
// composer hiện tại; kiểm tra hash để không lưu nhầm khi đang ở tab khác.
let activeSave = null;
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
  if (!activeSave || location.hash.replace('#', '') !== 'composer') return;
  event.preventDefault();
  void activeSave();
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
  const draftHolder = el('div', {});
  const draftStatus = el('span', { class: 'muted' });
  let validateTimer = null;
  let draftTimer = null;

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

  function scheduleDraftSave() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      saveDraft(state.current);
      draftStatus.textContent = `nháp lưu lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }, 600);
  }

  function refreshPreview() {
    previewHolder.replaceChildren(
      renderMessagePreview(state.current.payload, { includeOptIn: includeOptIn() }),
    );
    scheduleDraftSave();
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

  /** Bản nháp chỉ nhắc một lần; mở lại hoặc bỏ là xong. */
  function renderDraftBanner() {
    const draft = loadDraft();
    if (!draft) {
      draftHolder.replaceChildren();
      return;
    }
    draftHolder.replaceChildren(
      draftBanner(draft, {
        onRestore: () => {
          state.current = {
            id: draft.id ?? null,
            name: draft.name ?? 'Nội dung mới',
            kind: draft.kind ?? 'announcement',
            payload: { ...emptyPayload(), ...draft.payload },
          };
          draftHolder.replaceChildren();
          renderAll();
          toast('Đã mở lại bản nháp.', 'ok');
        },
        onDiscard: () => {
          clearDraft();
          draftHolder.replaceChildren();
          draftStatus.textContent = '';
        },
      }),
    );
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
      clearTimeout(draftTimer);
      clearDraft();
      draftStatus.textContent = 'đã lưu lên server';
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
      clearTimeout(draftTimer);
      clearDraft();
      draftStatus.textContent = '';
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
            ? { label: 'Nhận thông tin', emoji: '', style: 'primary', ackMessage: '', action: 'dm' }
            : null;
          renderAll();
        }),
      ]),
      el('div', { class: 'muted' }, 'Đây là nút duy nhất khiến bot gửi DM. Không bấm thì không ai bị DM.'),
    ]);

    if (!enabled) return holder;

    const button = payload.optInButton;
    holder.append(
      field(
        'Bấm nút thì làm gì',
        selectInput(
          [
            { value: 'dm', label: 'DM ngay nội dung gắn với server này (panel đối tác)' },
            { value: 'subscribe', label: 'Ghi danh nhận thông báo ở server nhà' },
          ],
          button.action ?? 'dm',
          (value) => {
            button.action = value;
            renderAll();
          },
        ),
        button.action === 'subscribe'
          ? 'Người bấm vào danh sách nhận thông báo, sau đó bạn gửi từng đợt ở tab "Thông báo". Panel này phải đăng ở server nhà.'
          : 'Người bấm nhận ngay template DM đã gán cho server đó trong tab "Server của bot".',
      ),
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

  /** Server dựng khối V2 từ text/embed để logic chuyển đổi chỉ có một bản. */
  async function convertClassicToV2() {
    try {
      const data = await api.convertToComponentsV2(state.current.payload);
      state.current.payload.v2 = data.v2;
    } catch (error) {
      state.current.payload.v2 = state.current.payload.v2 ?? emptyV2Layout();
      toast(`Không chuyển được nội dung cũ: ${error.message}`, 'bad');
    }
  }

  function renderAll() {
    const payload = state.current.payload;
    // Template lưu từ trước có thể bật V2 mà thiếu layout (vd sửa tay trong DB).
    if (payload.useComponentsV2 && !payload.v2) payload.v2 = emptyV2Layout();
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
      hint: payload.useComponentsV2
        ? 'Components V2: Discord bỏ qua text ngoài embed + embed. Không gửi được qua webhook, và tin đã đăng không đổi lại về embed được.'
        : 'Placeholder: {user} {user.name} {server} {members} {invite} {source}',
      actions: createEmojiButton(() => lastFocusedField),
      body: [
        el('div', { class: 'mode-switch' }, [
          checkbox('Dùng Components V2 — khung màu, section, thư viện ảnh', payload.useComponentsV2 === true, async (checked) => {
            payload.useComponentsV2 = checked;
            // Khung V2 rỗng thì mang nội dung cổ điển sang, không thì tin gửi đi mất chữ.
            if (checked && !v2HasContent(payload.v2)) await convertClassicToV2();
            renderAll();
          }),
          el('div', { class: 'muted' }, 'Placeholder dùng được ở cả hai chế độ.'),
          payload.useComponentsV2 && classicHasText(payload)
            ? el('button', {
                class: 'ghost small',
                style: 'align-self:flex-start;margin-top:4px',
                text: 'Chuyển nội dung cũ sang V2',
                onClick: async () => {
                  if (v2HasContent(payload.v2) && !confirm('Thay toàn bộ khối V2 hiện tại bằng nội dung text/embed cũ?')) return;
                  await convertClassicToV2();
                  renderAll();
                  toast('Đã chuyển text/embed cũ thành khối V2.', 'ok');
                },
              })
            : null,
        ]),
        ...(payload.useComponentsV2
          ? [v2Editor(payload, handlers)]
          : [
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
            ]),
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
        'Soạn, xem trước, kiểm tra giới hạn Discord, rồi mới gửi. Ctrl+S để lưu; bản nháp được giữ lại nếu tải lại trang.',
        el('div', { class: 'actions' }, [
          draftStatus,
          state.current.id ? el('span', { class: 'badge brand', text: `#${state.current.id}` }) : null,
        ]),
      ),
      draftHolder,
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

  activeSave = saveTemplate;
  renderAll();
  renderDraftBanner();
}
