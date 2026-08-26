/** Helper DOM tối giản, tránh phải dựng framework cho một dashboard nội bộ. */
export function el(tag, attributes = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function field(labelText, control, hint) {
  return el('label', { class: 'field' }, [
    el('span', { text: labelText }),
    control,
    hint ? el('div', { class: 'muted', text: hint }) : null,
  ]);
}

export function textInput(value, onInput, placeholder = '', type = 'text') {
  return el('input', { type, value: value ?? '', placeholder, onInput: (event) => onInput(event.target.value) });
}

export function textArea(value, onInput, placeholder = '', tall = false) {
  return el('textarea', {
    class: tall ? 'tall' : '',
    placeholder,
    onInput: (event) => onInput(event.target.value),
  }, value ?? '');
}

export function selectInput(options, value, onChange) {
  return el(
    'select',
    { onChange: (event) => onChange(event.target.value) },
    options.map((option) =>
      el('option', { value: option.value, selected: String(option.value) === String(value ?? '') }, option.label),
    ),
  );
}

export function checkbox(labelText, checked, onChange) {
  return el('label', { class: 'check' }, [
    el('input', { type: 'checkbox', checked: checked === true, onChange: (event) => onChange(event.target.checked) }),
    labelText,
  ]);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  return date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function formatPercent(value) {
  return `${(value ?? 0).toFixed(1)}%`;
}

let toastTimer = null;

export function toast(message, kind = '') {
  document.querySelector('.toast')?.remove();
  const node = el('div', { class: `toast ${kind}`, text: message });
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), kind === 'bad' ? 8000 : 4000);
}

export function kpi(label, value, hint, tone = '') {
  return el('div', { class: `kpi ${tone}` }, [
    el('div', { class: 'label', text: label }),
    el('div', { class: 'value', text: String(value) }),
    hint ? el('div', { class: 'hint', text: hint }) : null,
  ]);
}

/** Khung card chuẩn: tiêu đề + gợi ý + hành động ở góc phải. */
export function card({ title, hint, actions, body, extraClass = '' }) {
  const children = [];
  if (title || hint || actions) {
    children.push(
      el('div', { class: 'card-header' }, [
        el('div', { class: 'titles' }, [
          title ? el('h2', { text: title }) : null,
          hint ? el('div', { class: 'hint', text: hint }) : null,
        ]),
        actions ? el('div', { class: 'actions' }, [].concat(actions)) : null,
      ]),
    );
  }
  children.push(...[].concat(body ?? []));
  return el('div', { class: `card ${extraClass}` }, children);
}

export function pageHead(title, subtitle, actions) {
  return el('div', { class: 'page-head' }, [
    el('div', {}, [
      el('h1', { text: title }),
      subtitle ? el('div', { class: 'subtitle', text: subtitle }) : null,
    ]),
    actions ? el('div', { class: 'actions' }, [].concat(actions)) : null,
  ]);
}

export function emptyState(title, message) {
  return el('div', { class: 'empty' }, [el('strong', { text: title }), message ?? '']);
}

/** Khối shimmer thay cho chữ "Đang tải…" để chuyển trang không bị giật. */
export function skeletonCard(lines = 3) {
  const bars = [el('div', { class: 'skeleton', style: 'height:18px;width:35%;margin-bottom:14px' })];
  for (let index = 0; index < lines; index += 1) {
    bars.push(
      el('div', {
        class: 'skeleton',
        style: `height:12px;width:${90 - index * 12}%;margin-bottom:9px`,
      }),
    );
  }
  return el('div', { class: 'card' }, bars);
}

export function collapsible({ summary, note, body, open = false, actions }) {
  return el('details', { class: 'block', open }, [
    el('summary', {}, [
      el('span', { text: summary }),
      note ? el('span', { class: 'summary-note', text: note }) : null,
    ]),
    el('div', { class: 'details-body' }, [
      actions ? el('div', { class: 'actions', style: 'margin:10px 0' }, [].concat(actions)) : null,
      ...[].concat(body ?? []),
    ]),
  ]);
}

/**
 * Bảng dữ liệu dùng chung. columns: [{ label, numeric }].
 * Mỗi cell là Node, chuỗi, hoặc { value, numeric, node }.
 */
export function dataTable(columns, rows, emptyMessage = 'Chưa có dữ liệu.') {
  if (rows.length === 0) return emptyState('Trống', emptyMessage);

  const headerCells = columns.map((column) =>
    el('th', { class: column.numeric ? 'num' : '', text: column.label }),
  );

  const bodyRows = rows.map((cells) =>
    el(
      'tr',
      {},
      cells.map((cell) => {
        if (cell instanceof Node) return el('td', {}, [cell]);
        if (cell && typeof cell === 'object') {
          return el('td', { class: cell.numeric ? 'num' : '' }, [
            cell.node ?? String(cell.value ?? ''),
          ]);
        }
        return el('td', {}, [String(cell ?? '')]);
      }),
    ),
  );

  return el('div', { class: 'table-scroll' }, [
    el('table', {}, [el('thead', {}, [el('tr', {}, headerCells)]), el('tbody', {}, bodyRows)]),
  ]);
}
