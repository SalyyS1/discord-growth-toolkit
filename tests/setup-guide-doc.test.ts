import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PermissionFlagsBits } from 'discord.js';

// Guide là file tĩnh nên không có gì tự bắt lỗi khi code đổi. Các test dưới đây
// neo những con số/chuỗi mà người cài phải copy đúng vào Discord.
const guide = readFileSync(new URL('../docs/setup-guide.html', import.meta.url), 'utf8');
const envExample = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = '1';
process.env.DISCORD_CLIENT_SECRET = 'secret';
process.env.HOME_GUILD_ID = '999';
process.env.DASHBOARD_OWNER_IDS = '42';
process.env.SESSION_SECRET = 'g'.repeat(32);
process.env.PUBLIC_BASE_URL = 'http://localhost:3000';

const { oauthRedirectUri } = await import('../src/config/env');

function permissionSum(names: (keyof typeof PermissionFlagsBits)[]): string {
  return names.reduce((total, name) => total | PermissionFlagsBits[name], 0n).toString();
}

test('mọi biến trong .env.example đều được giải thích trong guide', () => {
  const keys = [...envExample.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]!);
  assert.ok(keys.length >= 11, 'đọc được danh sách biến');
  for (const key of keys) assert.ok(guide.includes(key), `guide chưa nhắc tới ${key}`);
});

test('mã quyền trong link mời khớp với quyền bot thật cần', () => {
  const home = permissionSum([
    'ManageGuild',
    'CreateInstantInvite',
    'ViewChannel',
    'SendMessages',
    'EmbedLinks',
    'ManageRoles',
  ]);
  const partner = permissionSum(['ViewChannel', 'SendMessages', 'EmbedLinks']);

  assert.ok(guide.includes(`data-permissions="${home}"`), `link server nhà phải dùng ${home}`);
  assert.ok(guide.includes(`data-permissions="${partner}"`), `link đối tác phải dùng ${partner}`);
  assert.notEqual(home, partner);
});

test('redirect URI trong guide khớp với đường dẫn callback thật', () => {
  assert.equal(oauthRedirectUri, 'http://localhost:3000/api/auth/callback');
  assert.ok(guide.includes(oauthRedirectUri), 'guide phải in đúng chuỗi cần khai ở Developer Portal');
});

test('guide chỉ dẫn intent bắt buộc và ngưỡng Node của package.json', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    engines: { node: string };
  };
  const version = packageJson.engines.node.replace(/[^\d.]/g, '').split('.').slice(0, 2).join('.');

  assert.ok(guide.includes('Server Members Intent'));
  assert.ok(guide.includes(version), `guide phải nói Node ${version}`);
});
