import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Thiếu biến môi trường ${name} — xem .env.example`);
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new Error(`${name} phải là số`);
  return parsed;
}

/** Cấu hình runtime, đọc một lần khi khởi động để lỗi thiếu env lộ ra sớm. */
export const env = {
  discordToken: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  clientSecret: required('DISCORD_CLIENT_SECRET'),
  homeGuildId: required('HOME_GUILD_ID'),
  ownerIds: required('DASHBOARD_OWNER_IDS')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0),
  sessionSecret: required('SESSION_SECRET'),
  port: numeric('PORT', 3000),
  // Mặc định chỉ nghe localhost: dashboard có quyền gửi tin nhân danh bot nên
  // không nên phơi ra internet trực tiếp. Đổi HOST=0.0.0.0 khi đã có reverse proxy.
  host: optional('HOST', '127.0.0.1'),
  publicBaseUrl: optional('PUBLIC_BASE_URL', 'http://localhost:3000').replace(/\/+$/, ''),
  dmIntervalMs: numeric('DM_INTERVAL_MS', 2500),
  databaseFile: optional('DATABASE_FILE', 'data/growth.db'),
} as const;

export const oauthRedirectUri = `${env.publicBaseUrl}/api/auth/callback`;

export function isOwner(userId: string): boolean {
  return env.ownerIds.includes(userId);
}
