import { PermissionFlagsBits } from 'discord.js';
import { client } from './bot/discord-client';
import { env } from './config/env';

/**
 * Tóm tắt in ra sau khi bot ready. Mục đích duy nhất: nhìn một lần là biết cài
 * đúng chưa (bot vào đúng server chưa, thiếu quyền gì, mở dashboard ở đâu) mà
 * không phải đọc lại toàn bộ log.
 */
export function startupSummaryLines(): string[] {
  const homeGuild = client.guilds.cache.get(env.homeGuildId);
  const me = homeGuild?.members.me;

  const rows: [string, string][] = [
    ['Dashboard', env.publicBaseUrl],
    ['Bot', `${client.user?.tag ?? 'chưa rõ'} · ${client.guilds.cache.size} server`],
    [
      'Server nhà',
      homeGuild
        ? `${homeGuild.name} (${homeGuild.memberCount} member)`
        : `chưa vào được — kiểm tra HOME_GUILD_ID=${env.homeGuildId}`,
    ],
    ['Đăng nhập', `${env.ownerIds.length} Discord ID trong DASHBOARD_OWNER_IDS`],
    ['Gửi DM', `mỗi ${(env.dmIntervalMs / 1000).toFixed(1)}s một tin`],
    ['Dữ liệu', env.databaseFile],
  ];

  const width = Math.max(...rows.map(([label]) => label.length));
  const lines = ['', '  ✔ Growth Toolkit đã chạy', ''];
  for (const [label, value] of rows) lines.push(`    ${label.padEnd(width)}   ${value}`);

  const missing: string[] = [];
  if (me) {
    if (!me.permissions.has(PermissionFlagsBits.ManageGuild)) {
      missing.push('Manage Server — không đọc được invite nên mất số liệu quy nguồn');
    }
    if (!me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
      missing.push('Create Invite — không tạo được invite riêng cho từng nguồn');
    }
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
      missing.push('Manage Roles — không gán được role cho người đăng ký nhận thông báo');
    }
  }

  if (missing.length > 0) {
    lines.push('', '    Bot thiếu quyền ở server nhà:');
    for (const item of missing) lines.push(`      ! ${item}`);
  }

  lines.push('');
  return lines;
}
