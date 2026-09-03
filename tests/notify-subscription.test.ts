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
process.env.SESSION_SECRET = 'z'.repeat(32);
process.env.DATABASE_FILE = join(mkdtempSync(join(tmpdir(), 'growth-notify-')), 'test.db');

const {
  campaignStatusCounts,
  countActiveSubscribers,
  createCampaign,
  getNotifyRoleId,
  getSubscriber,
  hasCampaignDelivery,
  listActiveSubscribers,
  listUnsubscribedUserIds,
  recordCampaignSend,
  setNotifyRoleId,
  subscribeNotify,
  unsubscribeNotify,
} = await import('../src/db/repo-notify');
const { buildRestPayload } = await import('../src/shared/template-payload-builder');

const GUILD = '999';

test('đăng ký, huỷ, rồi đăng ký lại đều ghi đúng trạng thái', () => {
  assert.equal(subscribeNotify({ guildId: GUILD, userId: 'u1', username: 'a#1' }), 'subscribed');
  assert.equal(subscribeNotify({ guildId: GUILD, userId: 'u1', username: 'a#1' }), 'already');

  assert.equal(unsubscribeNotify(GUILD, 'u1'), true);
  // Huỷ hai lần thì lần sau không có gì để huỷ nữa.
  assert.equal(unsubscribeNotify(GUILD, 'u1'), false);

  assert.equal(subscribeNotify({ guildId: GUILD, userId: 'u1', username: 'a#1' }), 'resubscribed');
});

test('danh sách gửi chỉ gồm người đang đăng ký', () => {
  subscribeNotify({ guildId: GUILD, userId: 'u2', username: 'b#2' });
  subscribeNotify({ guildId: GUILD, userId: 'u3', username: 'c#3' });
  unsubscribeNotify(GUILD, 'u2');

  const active = listActiveSubscribers(GUILD).map((row) => row.user_id);
  assert.ok(active.includes('u3'));
  assert.ok(!active.includes('u2'), 'người đã huỷ không được nằm trong danh sách gửi');
  assert.equal(countActiveSubscribers(GUILD), active.length);

  // Người đã huỷ vẫn còn dòng dữ liệu để biết họ từng đồng ý rồi rút lại.
  assert.equal(countActiveSubscribers('guild-khac'), 0);
});

test('chạy lại một đợt không gửi trùng nhưng vẫn thử lại người bị chặn DM', () => {
  const campaign = createCampaign({
    guildId: GUILD,
    name: 'event-test',
    templateId: null,
    audience: 'subscribers',
    roleId: null,
  });

  recordCampaignSend(campaign.id, 'u1', 'sent');
  assert.equal(hasCampaignDelivery(campaign.id, 'u1'), true);

  recordCampaignSend(campaign.id, 'u3', 'blocked_dm');
  assert.equal(hasCampaignDelivery(campaign.id, 'u3'), false, 'DM đóng thì lần sau phải thử lại');

  // Thử lại thành công thì trạng thái được cập nhật, không tạo dòng thứ hai.
  recordCampaignSend(campaign.id, 'u3', 'sent');
  assert.equal(hasCampaignDelivery(campaign.id, 'u3'), true);
  assert.deepEqual(campaignStatusCounts(campaign.id), { sent: 2 });
});

test('người nhận theo role bấm huỷ vẫn ghi được opt-out dù chưa từng bấm đăng ký', () => {
  // Gửi theo role thì người nhận không có dòng nào trong bảng; nút huỷ phải tạo
  // dòng mới, nếu không đợt gửi theo role sau vẫn DM cho họ.
  assert.equal(getSubscriber(GUILD, 'role-only'), null);
  assert.equal(unsubscribeNotify(GUILD, 'role-only'), true);
  assert.equal(unsubscribeNotify(GUILD, 'role-only'), false, 'huỷ lần hai không đổi gì');

  assert.ok(listUnsubscribedUserIds(GUILD).has('role-only'));
  assert.ok(!listActiveSubscribers(GUILD).some((row) => row.user_id === 'role-only'));
});

test('role thông báo lưu và xoá được', () => {
  assert.equal(getNotifyRoleId(), null);
  setNotifyRoleId('123456');
  assert.equal(getNotifyRoleId(), '123456');
  setNotifyRoleId(null);
  assert.equal(getNotifyRoleId(), null);
});

test('nút ghi danh và nút huỷ nhận dùng custom id riêng', () => {
  const payload = {
    content: 'x',
    embeds: [],
    linkButtons: [],
    optInButton: { label: 'Đăng ký', style: 'success' as const, action: 'subscribe' as const },
  };

  const panel = buildRestPayload(payload, {}, { includeOptIn: true });
  const panelRows = panel.components as { components: { custom_id: string }[] }[];
  assert.equal(panelRows[0]?.components[0]?.custom_id, 'growth:notify-subscribe');

  // DM của đợt thông báo: nút huỷ nằm ở hàng riêng nên không tranh chỗ với nút template.
  const dm = buildRestPayload(
    { content: 'y', embeds: [], linkButtons: [{ label: 'Vào server', url: 'https://discord.gg/x' }], optInButton: null },
    {},
    { includeNotifyOptOut: true },
  );
  const dmRows = dm.components as { components: { custom_id?: string; url?: string }[] }[];
  assert.equal(dmRows.length, 2);
  assert.equal(dmRows[0]?.components[0]?.url, 'https://discord.gg/x');
  assert.equal(dmRows[1]?.components[0]?.custom_id, 'growth:notify-unsubscribe');
});
