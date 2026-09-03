import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = '1';
process.env.DISCORD_CLIENT_SECRET = 'secret';
process.env.HOME_GUILD_ID = '999';
process.env.DASHBOARD_OWNER_IDS = '42';
process.env.SESSION_SECRET = 'y'.repeat(32);
process.env.DATABASE_FILE = join(mkdtempSync(join(tmpdir(), 'growth-web-')), 'test.db');
process.env.PORT = '34567';
process.env.HOST = '127.0.0.1';

const { startWebServer } = await import('../src/web/web-server');
const { escapeHtml, renderAuthErrorPage } = await import('../src/web/auth-error-page');

const server = startWebServer();
const base = 'http://127.0.0.1:34567';

after(() => {
  server.close();
  // Client discord.js được tạo khi import route nhưng không login, nên chỉ cần thoát.
  setTimeout(() => process.exit(0), 100).unref();
});

test('dashboard tĩnh được serve', async () => {
  const response = await fetch(`${base}/`);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Growth Toolkit/);
});

test('module JS của dashboard tải được', async () => {
  const response = await fetch(`${base}/js/app.js`);
  assert.equal(response.status, 200);
});

test('mọi file CSS mà index.html tham chiếu đều tồn tại', async () => {
  const html = await (await fetch(`${base}/`)).text();
  const hrefs = [...html.matchAll(/href="(\/css\/[^"]+)"/g)].map((match) => match[1]!);
  assert.ok(hrefs.length >= 3, 'index.html phải link ít nhất 3 file css');
  for (const href of hrefs) {
    const response = await fetch(`${base}${href}`);
    assert.equal(response.status, 200, `${href} phải tồn tại`);
  }
});

test('mọi API dữ liệu đều chặn khi chưa đăng nhập', async () => {
  for (const path of [
    '/api/status',
    '/api/guilds',
    '/api/templates',
    '/api/invite-sources',
    '/api/analytics/overview',
    '/api/publish/history',
    '/api/notify',
    '/api/notify/subscribers',
  ]) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 401, `${path} phải trả 401`);
  }
});

test('cookie session giả mạo bị từ chối', async () => {
  const forged = Buffer.from(JSON.stringify({ userId: '42', expiresAt: Date.now() + 60_000 })).toString(
    'base64url',
  );
  const response = await fetch(`${base}/api/guilds`, {
    headers: { cookie: `growth_session=${forged}.chu-ky-bua` },
  });
  assert.equal(response.status, 401);
});

test('/api/auth/me trả về trạng thái chưa đăng nhập', async () => {
  const response = await fetch(`${base}/api/auth/me`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { authenticated: false });
});

test('login chuyển hướng sang Discord OAuth kèm state', async () => {
  const response = await fetch(`${base}/api/auth/login`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  const location = response.headers.get('location') ?? '';
  assert.match(location, /^https:\/\/discord\.com\/oauth2\/authorize/);
  assert.match(location, /state=/);
  assert.match(response.headers.get('set-cookie') ?? '', /growth_oauth_state=/);
});

test('callback sai state trả trang HTML 400 kèm cách sửa', async () => {
  const response = await fetch(`${base}/api/auth/callback?code=x&state=khong-khop`);
  assert.equal(response.status, 400);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);

  const html = await response.text();
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /state/);
  assert.match(html, /api\/auth\/login/, 'phải có link thử lại');
});

test('trang lỗi escape mọi giá trị vì .send() trả về text/html', () => {
  assert.equal(escapeHtml('<script>a&b"c\'d'), '&lt;script&gt;a&amp;b&quot;c&#39;d');

  // Tên Discord của bất kỳ ai bấm đăng nhập đều lọt vào trang 403 này.
  const html = renderAuthErrorPage({
    status: 403,
    title: 'x',
    message: 'Tài khoản <img src=x onerror=alert(1)> bị chặn',
    steps: ['bước <b>một</b>'],
    snippet: 'DASHBOARD_OWNER_IDS=<script>',
    retryHref: '/api/auth/login',
  });
  assert.ok(!html.includes('<img src=x'), 'không được nhúng thẻ thô vào trang');
  assert.ok(!html.includes('<b>một</b>'));
  assert.match(html, /&lt;script&gt;/);
});
