import { clearState, loadState, saveState } from '../local-store.js';
import { el, formatDateTime } from '../dom-helpers.js';

const KEY = 'composer-draft';

export function saveDraft(current) {
  saveState(KEY, {
    id: current.id,
    name: current.name,
    kind: current.kind,
    payload: current.payload,
    savedAt: new Date().toISOString(),
  });
}

export function loadDraft() {
  return loadState(KEY);
}

export function clearDraft() {
  clearState(KEY);
}

/**
 * Thanh nhắc bản nháp chưa lưu lên server. Không tự khôi phục vì người dùng có
 * thể đã cố ý mở một nội dung khác.
 */
export function draftBanner(draft, { onRestore, onDiscard }) {
  return el('div', { class: 'draft-banner' }, [
    el('div', {}, [
      el('strong', { text: 'Có bản nháp chưa lưu' }),
      el('div', { class: 'muted' },
        `"${draft.name || 'Nội dung mới'}" · ${draft.kind} · ${formatDateTime(draft.savedAt)}`),
    ]),
    el('div', { class: 'actions' }, [
      el('button', { class: 'primary small', text: 'Mở lại', onClick: onRestore }),
      el('button', { class: 'ghost small', text: 'Bỏ', onClick: onDiscard }),
    ]),
  ]);
}
