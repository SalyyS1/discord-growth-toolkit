/**
 * Trang lỗi của luồng đăng nhập. Người dùng gặp nó khi chưa có session, tức là
 * chưa chắc dashboard đã chạy đúng, nên trang phải tự đứng một mình: không CSS
 * ngoài, không JS, và phải nói luôn cách sửa thay vì chỉ báo lỗi.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Express `.send(string)` trả về content-type text/html, nên mọi giá trị lấy từ
 * Discord (tên tài khoản của bất kỳ ai bấm đăng nhập) phải được escape.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export interface AuthErrorPageInput {
  status: number;
  /** Tiêu đề ngắn, hiện ở cả <title> và trong trang. */
  title: string;
  message: string;
  /** Các bước sửa, hiện dạng danh sách có số thứ tự. */
  steps?: string[];
  /** Khối chữ đơn sắc để copy — ví dụ dòng cần dán vào .env. */
  snippet?: string;
  /** Link thử lại; để trống khi thử lại ngay không giải quyết được gì. */
  retryHref?: string;
}

const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 28px;
  background: #1e2025 radial-gradient(1100px 560px at 50% -15%, #2b2f45, transparent 70%);
  color: #d3d6dc;
  font: 15px/1.62 "Inter", "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif;
}
.card {
  width: 100%; max-width: 560px; background: #24262c; border: 1px solid #32343b;
  border-radius: 14px; padding: 26px 28px 24px; box-shadow: 0 12px 32px rgb(0 0 0 / 40%);
}
.mark {
  width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center;
  background: linear-gradient(135deg, #5865f2, #8b5cf6);
  color: #fff; font-weight: 700; font-size: 18px;
}
h1 { font-size: 20px; font-weight: 650; color: #f3f4f7; margin: 16px 0 0; letter-spacing: -0.01em; }
.status { margin-top: 4px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.06em; color: #faa81a; text-transform: uppercase; }
p { margin: 12px 0 0; }
ol { margin: 16px 0 0; padding-left: 22px; }
li { margin-top: 6px; }
code, .snippet {
  background: #15161a; border: 1px solid #32343b; border-radius: 6px;
  font-family: "Cascadia Code", Consolas, "SF Mono", monospace; color: #b7c0ff;
}
code { padding: 1px 6px; font-size: 13px; }
.snippet {
  display: block; margin-top: 14px; padding: 12px 13px; font-size: 13px;
  white-space: pre-wrap; word-break: break-all; user-select: all;
}
.actions { margin-top: 22px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
a.button {
  background: #5865f2; color: #fff; text-decoration: none; font-weight: 600; font-size: 14px;
  padding: 9px 16px; border-radius: 8px;
}
a.button:hover { background: #6b76f5; }
a.plain { color: #8d919b; font-size: 13.5px; }
.foot { margin-top: 20px; padding-top: 14px; border-top: 1px solid #32343b; font-size: 12.5px; color: #8d919b; }
`;

function listItems(steps: string[]): string {
  return `<ol>${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>`;
}

export function renderAuthErrorPage(input: AuthErrorPageInput): string {
  const title = escapeHtml(input.title);

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Growth Toolkit</title>
<style>${STYLE}</style>
</head>
<body>
<main class="card">
  <div class="mark">G</div>
  <div class="status">Lỗi ${input.status}</div>
  <h1>${title}</h1>
  <p>${escapeHtml(input.message)}</p>
  ${input.steps && input.steps.length > 0 ? listItems(input.steps) : ''}
  ${input.snippet ? `<span class="snippet">${escapeHtml(input.snippet)}</span>` : ''}
  <div class="actions">
    ${input.retryHref ? `<a class="button" href="${escapeHtml(input.retryHref)}">Thử đăng nhập lại</a>` : ''}
    <a class="plain" href="/">Về trang chủ</a>
  </div>
  <div class="foot">Hướng dẫn cài đặt đầy đủ: <code>docs/setup-guide.html</code></div>
</main>
</body>
</html>`;
}
