import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = '1';
process.env.DISCORD_CLIENT_SECRET = 'secret';
process.env.HOME_GUILD_ID = '999';
process.env.DASHBOARD_OWNER_IDS = '42';
process.env.SESSION_SECRET = 'v'.repeat(32);
process.env.DATABASE_FILE = join(mkdtempSync(join(tmpdir(), 'growth-v2-')), 'test.db');

const { buildRestPayload } = await import('../src/shared/template-payload-builder');
const { validateTemplatePayload, hasBlockingIssue } = await import('../src/shared/template-validation');
const { layoutFromClassic } = await import('../src/shared/template-v2-migration');
import type { TemplatePayload } from '../src/shared/template-types';

const COMPONENTS_V2_FLAG = 1 << 15;
const TYPE = {
  actionRow: 1,
  section: 9,
  textDisplay: 10,
  thumbnail: 11,
  mediaGallery: 12,
  separator: 14,
  container: 17,
} as const;

interface JsonComponent {
  type: number;
  content?: string;
  accent_color?: number;
  components?: JsonComponent[];
  accessory?: JsonComponent;
  items?: { media: { url: string }; description?: string; spoiler?: boolean }[];
  custom_id?: string;
  url?: string;
  spacing?: number;
}

function v2Payload(overrides: Partial<TemplatePayload> = {}): TemplatePayload {
  return {
    content: '',
    embeds: [],
    linkButtons: [],
    optInButton: null,
    useComponentsV2: true,
    v2: { accentColor: '#5865F2', blocks: [{ kind: 'text', content: 'Chào {user.name}' }] },
    ...overrides,
  };
}

function topLevel(payload: TemplatePayload, context = {}, options = {}): JsonComponent[] {
  return buildRestPayload(payload, context, options).components as JsonComponent[];
}

function containerOf(payload: TemplatePayload, context = {}, options = {}): JsonComponent {
  const [container] = topLevel(payload, context, options);
  assert.ok(container, 'payload V2 phải có container ở ngoài cùng');
  return container;
}

test('payload V2 gửi flag riêng và không kèm content/embeds', () => {
  const rest = buildRestPayload(v2Payload(), { userName: 'Sa' });

  assert.equal(rest.flags, COMPONENTS_V2_FLAG);
  assert.ok(!('content' in rest), 'content phải bị bỏ, gửi kèm là lỗi 400');
  assert.ok(!('embeds' in rest), 'embeds phải bị bỏ khi bật V2');

  const [container] = rest.components as JsonComponent[];
  assert.ok(container);
  assert.equal(container.type, TYPE.container);
  assert.equal(container.accent_color, 0x5865f2);
  assert.equal(container.components?.[0]?.type, TYPE.textDisplay);
  assert.equal(container.components?.[0]?.content, 'Chào Sa');
});

test('mỗi loại block dựng đúng component tương ứng', () => {
  const payload = v2Payload({
    v2: {
      blocks: [
        { kind: 'section', lines: ['Dòng 1', 'Dòng 2'], accessory: 'thumbnail', thumbnailUrl: 'https://x.dev/a.png', thumbnailDescription: 'ảnh' },
        { kind: 'gallery', items: [{ url: 'https://x.dev/1.png', description: 'một' }, { url: 'https://x.dev/2.png', spoiler: true }] },
        { kind: 'separator', divider: true, spacing: 'large' },
      ],
    },
  });

  const container = containerOf(payload);
  const kinds = (container.components ?? []).map((child) => child.type);
  assert.deepEqual(kinds, [TYPE.section, TYPE.mediaGallery, TYPE.separator]);

  const section = container.components![0]!;
  assert.equal(section.components?.length, 2);
  assert.equal(section.accessory?.type, TYPE.thumbnail);

  const gallery = container.components![1]!;
  assert.equal(gallery.items?.length, 2);
  assert.equal(gallery.items?.[0]?.media.url, 'https://x.dev/1.png');
  assert.equal(gallery.items?.[1]?.spoiler, true);
});

test('section thiếu phụ kiện thì đổ text ra container thay vì gửi section lỗi', () => {
  const payload = v2Payload({
    v2: { blocks: [{ kind: 'section', lines: ['a', 'b'], accessory: 'none' }] },
  });

  const container = containerOf(payload);
  const kinds = (container.components ?? []).map((child) => child.type);
  assert.deepEqual(kinds, [TYPE.textDisplay, TYPE.textDisplay]);
});

test('nút opt-in nằm trong container, nút huỷ nhận nằm ngoài', () => {
  const payload = v2Payload({
    linkButtons: [{ label: 'Vào server', url: 'https://discord.gg/x' }],
    optInButton: { label: 'Đăng ký', style: 'success', action: 'subscribe' },
    v2: { blocks: [{ kind: 'text', content: 'xin chào' }, { kind: 'buttons' }] },
  });

  const components = topLevel(payload, {}, { includeOptIn: true, includeNotifyOptOut: true });
  assert.equal(components.length, 2, 'container + hàng nút huỷ nhận');

  const row = components[0]?.components?.[1];
  assert.equal(row?.type, TYPE.actionRow);
  assert.equal(row?.components?.[0]?.url, 'https://discord.gg/x');
  assert.equal(row?.components?.[1]?.custom_id, 'growth:notify-subscribe');

  assert.equal(components[1]?.type, TYPE.actionRow);
  assert.equal(components[1]?.components?.[0]?.custom_id, 'growth:notify-unsubscribe');
});

test('layout không có block nút thì nút vẫn được gắn xuống cuối container', () => {
  const payload = v2Payload({
    linkButtons: [{ label: 'Vào server', url: 'https://discord.gg/x' }],
    v2: { blocks: [{ kind: 'text', content: 'xin chào' }] },
  });

  const container = containerOf(payload);
  const last = container.components?.at(-1);
  assert.equal(last?.type, TYPE.actionRow);
});

test('gallery cắt ở 10 ảnh và bỏ URL không phải http', () => {
  const items = Array.from({ length: 12 }, (_, index) => ({ url: `https://x.dev/${index}.png` }));
  items.push({ url: 'không-phải-url' });

  const container = containerOf(v2Payload({ v2: { blocks: [{ kind: 'gallery', items }] } }));
  assert.equal(container.components?.[0]?.items?.length, 10);
});

test('validate V2 chặn quá giới hạn và nhắc content bị bỏ', () => {
  const tooLong = validateTemplatePayload(
    v2Payload({ v2: { blocks: [{ kind: 'text', content: 'x'.repeat(4001) }] } }),
  );
  assert.ok(hasBlockingIssue(tooLong));
  assert.ok(tooLong.some((issue) => issue.message.includes('4000')));

  const tooMany = validateTemplatePayload(
    v2Payload({
      v2: { blocks: Array.from({ length: 45 }, () => ({ kind: 'text' as const, content: 'x' })) },
    }),
  );
  assert.ok(tooMany.some((issue) => issue.message.includes('40 component')));

  const droppedContent = validateTemplatePayload(v2Payload({ content: 'sẽ bị bỏ' }));
  assert.ok(droppedContent.some((issue) => issue.level === 'warning' && issue.field === 'v2'));
  assert.ok(!hasBlockingIssue(droppedContent));
});

test('validate V2 bắt lỗi section và gallery', () => {
  const issues = validateTemplatePayload(
    v2Payload({
      v2: {
        blocks: [
          { kind: 'section', lines: ['a', 'b', 'c', 'd'], accessory: 'button', buttonLabel: '', buttonUrl: '' },
          { kind: 'gallery', items: [{ url: 'ftp://x' }] },
        ],
      },
    }),
  );

  assert.ok(hasBlockingIssue(issues));
  assert.ok(issues.some((issue) => issue.field.includes('lines')));
  assert.ok(issues.some((issue) => issue.field.includes('button')));
  assert.ok(issues.some((issue) => issue.message.includes('http')));
});

test('layout V2 rỗng bị coi là lỗi', () => {
  const issues = validateTemplatePayload(v2Payload({ v2: { blocks: [] } }));
  assert.ok(hasBlockingIssue(issues));
});

test('bật V2 mà khối rỗng trong khi text cũ còn nội dung thì bị chặn gửi', () => {
  // Đúng cái bẫy: Discord bỏ content/embed, khung V2 rỗng → tin chỉ còn nút.
  const trapped = validateTemplatePayload(
    v2Payload({
      content: 'Nội dung thật của tôi',
      linkButtons: [{ label: 'Tham Gia Discord', url: 'https://discord.gg/x' }],
      v2: { blocks: [{ kind: 'text', content: '' }] },
    }),
  );

  assert.ok(hasBlockingIssue(trapped), 'phải là error, không phải warning');
  assert.ok(trapped.some((issue) => issue.message.includes('Chuyển nội dung cũ sang V2')));

  // Không có nội dung cũ để mất thì chỉ cảnh báo, vẫn cho gửi container toàn nút.
  const buttonsOnly = validateTemplatePayload(
    v2Payload({
      linkButtons: [{ label: 'Tham Gia Discord', url: 'https://discord.gg/x' }],
      v2: { blocks: [{ kind: 'text', content: '' }] },
    }),
  );
  assert.ok(!hasBlockingIssue(buttonsOnly));
  assert.ok(buttonsOnly.some((issue) => issue.message.includes('chỉ có nút')));
});

test('chuyển text + embed cũ thành khối V2 giữ được chữ và ảnh', () => {
  const classic: TemplatePayload = {
    content: 'Lời mở đầu',
    embeds: [
      {
        title: 'Sự kiện Halloween',
        description: 'Tối nay 8h',
        color: '#23a55a',
        thumbnailUrl: 'https://x.dev/thumb.png',
        imageUrl: 'https://x.dev/banner.png',
        fields: [{ name: 'Giải thưởng', value: '1000 xu' }],
      },
    ],
    linkButtons: [{ label: 'Tham Gia', url: 'https://discord.gg/x' }],
    optInButton: null,
  };

  const layout = layoutFromClassic(classic);
  assert.equal(layout.accentColor, '#23a55a');

  const kinds = layout.blocks.map((block) => block.kind);
  assert.deepEqual(kinds, ['text', 'separator', 'section', 'gallery', 'buttons']);

  const section = layout.blocks[2];
  assert.ok(section?.kind === 'section');
  assert.equal(section.thumbnailUrl, 'https://x.dev/thumb.png');
  assert.match(section.lines[0] ?? '', /Sự kiện Halloween/);
  assert.match(section.lines[0] ?? '', /Tối nay 8h/);
  assert.match(section.lines[0] ?? '', /Giải thưởng/);

  const gallery = layout.blocks[3];
  assert.ok(gallery?.kind === 'gallery');
  assert.equal(gallery.items[0]?.url, 'https://x.dev/banner.png');

  // Bản đã chuyển phải gửi được ngay, không còn lỗi nào.
  const converted = validateTemplatePayload({ ...classic, useComponentsV2: true, v2: layout });
  assert.ok(!hasBlockingIssue(converted), JSON.stringify(converted));
});
