/** Bọc localStorage: lưu lựa chọn và bản nháp để đổi tab/tải lại trang không mất thao tác. */
const PREFIX = 'growth:';

export function loadState(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    // Trình duyệt chặn storage hoặc dữ liệu hỏng: mất tiện lợi, không chặn luồng chính.
    return fallback;
  }
}

export function saveState(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Hết quota hoặc private mode — bỏ qua, đây chỉ là tiện lợi.
  }
}

export function clearState(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Không có gì phải xử lý.
  }
}
