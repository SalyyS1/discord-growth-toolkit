import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

interface RequiredVar {
  key: string;
  hint: string;
  /** Kiểm tra thêm ngoài "có giá trị", trả về lỗi nếu sai định dạng. */
  validate?: (value: string) => string | null;
}

const SNOWFLAKE = /^\d{15,25}$/;

function checkIdList(value: string): string | null {
  const ids = value.split(',').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) return 'chưa có ID nào';
  const invalid = ids.filter((id) => !SNOWFLAKE.test(id));
  return invalid.length > 0 ? `ID không hợp lệ: ${invalid.join(', ')}` : null;
}

const REQUIRED: RequiredVar[] = [
  {
    key: 'DISCORD_TOKEN',
    hint: 'Developer Portal → app của bạn → Bot → Reset Token rồi copy',
  },
  {
    key: 'DISCORD_CLIENT_ID',
    hint: 'Developer Portal → OAuth2 → Client ID',
    validate: (value) => (SNOWFLAKE.test(value) ? null : 'phải là dãy số'),
  },
  {
    key: 'DISCORD_CLIENT_SECRET',
    hint: 'Developer Portal → OAuth2 → Client Secret',
  },
  {
    key: 'HOME_GUILD_ID',
    hint: 'ID server Discord của bạn (bật Developer Mode → chuột phải server → Copy Server ID)',
    validate: (value) => (SNOWFLAKE.test(value) ? null : 'phải là ID server dạng số'),
  },
  {
    key: 'DASHBOARD_OWNER_IDS',
    hint: 'Discord user ID của bạn (chuột phải avatar → Copy User ID), nhiều người thì cách nhau bằng dấu phẩy',
    validate: checkIdList,
  },
  {
    key: 'SESSION_SECRET',
    hint: 'chuỗi random dài để ký cookie, tạo bằng: openssl rand -hex 32',
    validate: (value) =>
      value.startsWith('change-me') || value.length < 16
        ? 'còn là giá trị mẫu hoặc quá ngắn (cần ≥ 16 ký tự)'
        : null,
  },
];

export function envFileExists(): boolean {
  return existsSync(resolve(process.cwd(), '.env'));
}

/**
 * Gom mọi thiếu sót của cấu hình thành một danh sách để báo một lần, thay vì
 * để người dùng chạy lại rồi lỗi tiếp từng biến.
 */
export function findEnvProblems(): string[] {
  const problems: string[] = [];

  for (const item of REQUIRED) {
    const value = process.env[item.key]?.trim();
    if (!value) {
      problems.push(`${item.key} — chưa điền · ${item.hint}`);
      continue;
    }
    const invalid = item.validate?.(value);
    if (invalid) problems.push(`${item.key} — ${invalid} · ${item.hint}`);
  }

  return problems;
}

/**
 * Sai sót không chặn khởi động nhưng gần như chắc chắn làm hỏng việc sau đó —
 * chủ yếu là lệch giữa PUBLIC_BASE_URL và cổng thật, nguyên nhân số một của lỗi
 * "Invalid OAuth2 redirect_uri" lúc đăng nhập.
 */
export function findEnvWarnings(): string[] {
  const warnings: string[] = [];
  const rawBaseUrl = process.env.PUBLIC_BASE_URL?.trim() || 'http://localhost:3000';
  const port = process.env.PORT?.trim() || '3000';
  const host = process.env.HOST?.trim() || '127.0.0.1';

  let baseUrl: URL | null = null;
  try {
    baseUrl = new URL(rawBaseUrl);
    // 'localhost:3000' vẫn parse được (URL coi 'localhost:' là scheme) nên phải
    // kiểm tra protocol, không thì thiếu http:// sẽ lọt qua.
    if (baseUrl.protocol !== 'http:' && baseUrl.protocol !== 'https:') baseUrl = null;
  } catch {
    baseUrl = null;
  }

  if (!baseUrl) {
    warnings.push(
      `PUBLIC_BASE_URL không phải URL hợp lệ (${rawBaseUrl}) — phải bắt đầu bằng http:// hoặc https://`,
    );
  }

  if (baseUrl) {
    const urlPort = baseUrl.port || (baseUrl.protocol === 'https:' ? '443' : '80');
    const isLocal = baseUrl.hostname === 'localhost' || baseUrl.hostname === '127.0.0.1';

    if (urlPort !== port) {
      warnings.push(
        `PUBLIC_BASE_URL trỏ cổng ${urlPort} nhưng PORT=${port} — Discord sẽ báo "Invalid OAuth2 redirect_uri"`,
      );
    }
    if (!isLocal && baseUrl.protocol === 'http:') {
      warnings.push(
        `PUBLIC_BASE_URL là http:// trên ${baseUrl.hostname} — session cookie không được đánh dấu Secure, hãy đặt HTTPS trước dashboard`,
      );
    }
    if (host === '0.0.0.0' && isLocal) {
      warnings.push(
        'HOST=0.0.0.0 mở dashboard ra mạng nhưng PUBLIC_BASE_URL vẫn là localhost — đăng nhập từ máy khác sẽ thất bại',
      );
    }
  }

  const dmInterval = Number(process.env.DM_INTERVAL_MS?.trim() || '2500');
  if (Number.isFinite(dmInterval) && dmInterval < 1000) {
    warnings.push(`DM_INTERVAL_MS=${dmInterval} quá nhanh — Discord dễ coi là spam, nên giữ từ 1000 trở lên`);
  }

  return warnings;
}
