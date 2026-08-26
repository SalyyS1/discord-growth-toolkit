import { api } from '../api-client.js';
import {
  card,
  dataTable,
  el,
  emptyState,
  field,
  formatDateTime,
  pageHead,
  selectInput,
  skeletonCard,
  textInput,
  toast,
} from '../dom-helpers.js';

export async function renderSources(root) {
  const listHolder = el('div', {});
  const form = { label: '', channelId: '', existingCode: '', originGuildId: '' };

  const guildData = await api.listGuilds().catch((error) => {
    toast(`Không tải được server: ${error.message}`, 'bad');
    return { guilds: [], homeGuildId: null };
  });

  const homeGuildId = guildData.homeGuildId;
  const partnerGuilds = (guildData.guilds ?? []).filter((guild) => !guild.isHome);

  const homeChannels = homeGuildId
    ? await api
        .getGuild(homeGuildId)
        .then((data) => data.channels.filter((channel) => channel.canSend))
        .catch(() => [])
    : [];

  async function loadList() {
    listHolder.replaceChildren(skeletonCard(4));

    let sources = [];
    try {
      sources = (await api.listInviteSources()).sources ?? [];
    } catch (error) {
      listHolder.replaceChildren(emptyState('Không tải được nguồn', error.message));
      return;
    }

    const totalUses = sources.reduce((sum, source) => sum + source.uses, 0);

    const rows = sources.map((source) => [
      el('strong', { text: source.label }),
      el('a', { href: source.url, target: '_blank', rel: 'noopener', text: source.code }),
      { numeric: true, value: source.uses },
      formatDateTime(source.createdAt),
      el('div', { class: 'actions' }, [
        el('button', {
          class: 'ghost small',
          text: 'Copy link',
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(source.url);
              toast('Đã copy link invite.', 'ok');
            } catch {
              toast(source.url);
            }
          },
        }),
        el('button', {
          class: 'danger small',
          text: 'Bỏ theo dõi',
          onClick: async () => {
            if (!confirm(`Bỏ theo dõi "${source.label}"? Invite trên Discord vẫn còn.`)) return;
            await api.deleteInviteSource(source.code).catch((error) => toast(error.message, 'bad'));
            await loadList();
          },
        }),
      ]),
    ]);

    listHolder.replaceChildren(
      card({
        title: 'Nguồn đang theo dõi',
        hint: `${sources.length} nguồn • tổng ${totalUses} lượt dùng invite`,
        body: dataTable(
          [
            { label: 'Nhãn' },
            { label: 'Code' },
            { label: 'Lượt dùng', numeric: true },
            { label: 'Tạo lúc' },
            { label: '' },
          ],
          rows,
          'Chưa có nguồn nào. Tạo một invite riêng cho mỗi kênh kéo người để đo được nguồn.',
        ),
      }),
    );
  }

  const createCard = card({
    title: 'Tạo nguồn mới',
    hint: 'Mỗi nguồn = một invite code riêng vào server nhà. Ai join bằng code nào thì được quy về nguồn đó.',
    extraClass: 'sticky-column',
    body: [
      field('Nhãn nguồn', textInput('', (value) => {
        form.label = value;
      }, 'vd: partner-stella, tiktok-video-1')),
      field(
        'Tạo invite trong channel (server nhà)',
        selectInput(
          [
            {
              value: '',
              label: homeChannels.length > 0 ? '— chọn channel —' : 'Không đọc được channel server nhà',
            },
            ...homeChannels.map((channel) => ({ value: channel.id, label: `#${channel.name}` })),
          ],
          '',
          (value) => {
            form.channelId = value;
          },
        ),
      ),
      field(
        'Gắn với server đối tác (không bắt buộc)',
        selectInput(
          [
            { value: '', label: '— không gắn —' },
            ...partnerGuilds.map((guild) => ({ value: guild.id, label: guild.name })),
          ],
          '',
          (value) => {
            form.originGuildId = value;
          },
        ),
        'Gắn để phễu "bấm nút → join" của server đó có số liệu.',
      ),
      el('details', { class: 'inline-toggle' }, [
        el('summary', { text: 'Hoặc dùng invite đã có sẵn' }),
        el('div', { style: 'margin-top:10px' }, [
          field('Code hoặc link invite', textInput('', (value) => {
            form.existingCode = value;
          }, 'discord.gg/abcxyz')),
        ]),
      ]),
      el('div', { class: 'actions', style: 'margin-top:14px' }, [
        el('button', {
          class: 'primary',
          text: 'Tạo nguồn',
          onClick: async () => {
            if (!form.label.trim()) {
              toast('Cần nhãn nguồn.', 'bad');
              return;
            }
            try {
              await api.createInviteSource({
                label: form.label.trim(),
                channelId: form.channelId || undefined,
                existingCode: form.existingCode || undefined,
                originGuildId: form.originGuildId || undefined,
              });
              toast('Đã tạo nguồn.', 'ok');
              await loadList();
            } catch (error) {
              toast(`Tạo thất bại: ${error.message}`, 'bad');
            }
          },
        }),
      ]),
    ],
  });

  root.replaceChildren(
    pageHead(
      'Nguồn & invite',
      'Bot cần quyền Manage Server ở server nhà để đọc số lượt dùng invite — không có quyền này thì mọi join đều là "không rõ".',
    ),
    el('div', { class: 'split-editor' }, [listHolder, createCard]),
  );

  await loadList();
}
