import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// env phải được set trước khi import module thật vì config đọc env lúc load.
process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = '1';
process.env.DISCORD_CLIENT_SECRET = 'secret';
process.env.HOME_GUILD_ID = '999';
process.env.DASHBOARD_OWNER_IDS = '42';
process.env.SESSION_SECRET = 'x'.repeat(32);
process.env.DATABASE_FILE = join(mkdtempSync(join(tmpdir(), 'growth-test-')), 'test.db');

const { createTemplate, getTemplate, updateTemplate } = await import('../src/db/repo-content');
const { recordJoin, listJoins, recordPanelClick, markMemberLeft, upsertInviteSource, getInviteSource } =
  await import('../src/db/repo-growth');
const { buildRestPayload } = await import('../src/shared/template-payload-builder');
const { validateTemplatePayload, hasBlockingIssue } = await import('../src/shared/template-validation');

test('template lưu rồi đọc lại giữ nguyên cấu trúc payload', () => {
  const created = createTemplate({
    name: 'Lời mời SukiMC',
    kind: 'dm',
    payload: {
      content: 'Chào {user.name}!',
      embeds: [
        {
          title: 'Lời Mời Tham Gia',
          description: 'IP: `sukimc.me`',
          color: '#5865F2',
          fields: [{ name: 'Claim', value: 'Bảo vệ đất đai', inline: true }],
        },
      ],
      linkButtons: [{ label: 'Tham Gia Discord', url: 'https://discord.gg/sukimc' }],
      optInButton: null,
    },
  });

  const loaded = getTemplate(created.id);
  assert.equal(loaded?.payload.embeds[0]?.fields[0]?.name, 'Claim');
  assert.equal(loaded?.payload.linkButtons[0]?.url, 'https://discord.gg/sukimc');

  const renamed = updateTemplate(created.id, { name: 'Đã đổi tên' });
  assert.equal(renamed?.name, 'Đã đổi tên');
  assert.equal(renamed?.payload.content, 'Chào {user.name}!');
});

test('validate chặn nội dung vượt giới hạn Discord', () => {
  const issues = validateTemplatePayload({
    content: '',
    embeds: [{ title: 'a'.repeat(300), description: 'x', color: 'đỏ', fields: [] }],
    linkButtons: [{ label: 'Sai link', url: 'ftp://abc' }],
    optInButton: null,
  });

  assert.ok(hasBlockingIssue(issues));
  assert.ok(issues.some((issue) => issue.field.includes('title')));
  assert.ok(issues.some((issue) => issue.field.includes('color')));
  assert.ok(issues.some((issue) => issue.field.includes('url')));
});

test('placeholder và emoji server được dựng đúng trong payload REST', () => {
  const rest = buildRestPayload(
    {
      content: 'Chào {user}, {server} có {members} người',
      embeds: [{ title: 'Ghé {server} nhé', description: 'Link: {invite}', color: '#23a55a', fields: [] }],
      linkButtons: [{ label: 'Vào ngay', url: '{invite}', emoji: '<:tanh_plusone:1497592408316055612>' }],
      optInButton: null,
    },
    {
      userMention: '<@42>',
      serverName: 'SukiMC',
      memberCount: 1234,
      inviteUrl: 'https://discord.gg/sukimc',
    },
  );

  assert.equal(rest.content, 'Chào <@42>, SukiMC có 1234 người');

  const embeds = rest.embeds as { title: string; description: string }[];
  assert.equal(embeds[0]?.title, 'Ghé SukiMC nhé');
  assert.equal(embeds[0]?.description, 'Link: https://discord.gg/sukimc');

  const rows = rest.components as { components: { url: string; emoji?: { id: string } }[] }[];
  assert.equal(rows[0]?.components[0]?.url, 'https://discord.gg/sukimc');
  assert.equal(rows[0]?.components[0]?.emoji?.id, '1497592408316055612');
  // Không mention ai ngoài ý muốn khi gửi qua webhook.
  assert.deepEqual(rest.allowed_mentions, { parse: [] });
});

test('nút opt-in chỉ xuất hiện khi được yêu cầu', () => {
  const payload = {
    content: 'x',
    embeds: [],
    linkButtons: [],
    optInButton: { label: 'Nhận info', style: 'primary' as const },
  };

  const withoutButton = buildRestPayload(payload, {});
  assert.deepEqual(withoutButton.components, []);

  const withButton = buildRestPayload(payload, {}, { includeOptIn: true });
  const rows = withButton.components as { components: { custom_id: string }[] }[];
  assert.equal(rows[0]?.components[0]?.custom_id, 'growth:opt-in');
});

test('consent chỉ ghi nhận một lần cho mỗi user ở mỗi server', () => {
  assert.equal(recordPanelClick('guild-a', 'user-1'), true);
  assert.equal(recordPanelClick('guild-a', 'user-1'), false);
  assert.equal(recordPanelClick('guild-b', 'user-1'), true);
});

test('quy nguồn join và trạng thái rời server được lưu lại', () => {
  upsertInviteSource({ code: 'abc123', guildId: '999', label: 'partner-stella', uses: 5 });
  assert.equal(getInviteSource('abc123')?.label, 'partner-stella');

  recordJoin({
    guildId: '999',
    userId: 'user-9',
    username: 'nguoi#0001',
    avatar: null,
    accountCreatedAt: null,
    inviteCode: 'abc123',
    sourceLabel: 'partner-stella',
    inviterId: null,
    inviterTag: null,
  });

  const fromSource = listJoins({ source: 'partner-stella' });
  assert.equal(fromSource.length, 1);
  assert.equal(fromSource[0]?.left_at, null);

  markMemberLeft('999', 'user-9');
  assert.notEqual(listJoins({ source: 'partner-stella' })[0]?.left_at, null);
});
