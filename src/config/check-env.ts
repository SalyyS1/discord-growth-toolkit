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
