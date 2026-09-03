import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = '1';
process.env.DISCORD_CLIENT_SECRET = 'secret';
process.env.HOME_GUILD_ID = '999';
process.env.DASHBOARD_OWNER_IDS = '42';
process.env.SESSION_SECRET = 'm'.repeat(32);

// Dựng sẵn một DB theo schema cũ (chưa có audience/role_id) rồi mới nạp
// database.ts, để kiểm tra đúng đường migration của máy đã chạy bản trước.
const databaseFile = join(mkdtempSync(join(tmpdir(), 'growth-migrate-')), 'old.db');
const legacy = new DatabaseSync(databaseFile);
legacy.exec(`
  CREATE TABLE notify_campaigns (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id     TEXT NOT NULL,
    name         TEXT NOT NULL,
    template_id  INTEGER,
    created_at   TEXT NOT NULL,
    finished_at  TEXT
  );
`);
legacy
  .prepare('INSERT INTO notify_campaigns (guild_id, name, template_id, created_at) VALUES (?, ?, ?, ?)')
  .run('999', 'đợt cũ', null, '2026-01-01T00:00:00.000Z');
legacy.close();

process.env.DATABASE_FILE = databaseFile;
const { db } = await import('../src/db/database');
const { createCampaign, getCampaign } = await import('../src/db/repo-notify');

test('cột audience và role_id được thêm vào bảng đã tồn tại', () => {
  const columns = (db.prepare('PRAGMA table_info(notify_campaigns)').all() as unknown as {
    name: string;
  }[]).map((column) => column.name);

  assert.ok(columns.includes('audience'));
  assert.ok(columns.includes('role_id'));
});

test('đợt gửi cũ nhận giá trị mặc định, không mất dữ liệu', () => {
  const row = db
    .prepare('SELECT name, audience, role_id FROM notify_campaigns WHERE name = ?')
    .get('đợt cũ') as unknown as { name: string; audience: string; role_id: string | null };

  assert.equal(row.name, 'đợt cũ');
  assert.equal(row.audience, 'subscribers');
  assert.equal(row.role_id, null);
});

test('đợt mới lưu lại nhóm nhận và role đã dùng', () => {
  const created = createCampaign({
    guildId: '999',
    name: 'gửi theo role',
    templateId: null,
    audience: 'role',
    roleId: '123456789',
  });

  const loaded = getCampaign(created.id);
  assert.equal(loaded?.audience, 'role');
  assert.equal(loaded?.role_id, '123456789');
});
