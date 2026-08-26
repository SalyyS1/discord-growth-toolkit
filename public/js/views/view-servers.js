import { api } from '../api-client.js';
import {
  card,
  checkbox,
  el,
  emptyState,
  field,
  pageHead,
  selectInput,
  skeletonCard,
  textArea,
  textInput,
  toast,
} from '../dom-helpers.js';

function guildAvatar(guild, size = '') {
  const node = el('div', { class: `avatar ${size}` });
  if (guild.icon) {
    node.append(
      el('img', { src: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.webp?size=64`, alt: '' }),
    );
  } else {
    node.textContent = guild.name.slice(0, 1).toUpperCase();
  }
  return node;
}

export async function renderServers(root) {
  const detailHolder = el('div', { class: 'sticky-column' });
  let selectedId = null;

  const [guildData, templateData, sourceData] = await Promise.all([
    api.listGuilds().catch((error) => {
      toast(`Không tải được server: ${error.message}`, 'bad');
      return { guilds: [] };
    }),
    api.listTemplates().catch(() => ({ templates: [] })),
    api.listInviteSources().catch(() => ({ sources: [] })),
  ]);

  const templates = templateData.templates ?? [];
  const inviteSources = sourceData.sources ?? [];
  const guilds = guildData.guilds ?? [];

  const templateOptions = (kind) => [
    { value: '', label: '— chưa chọn —' },
    ...templates
      .filter((template) => template.kind === kind)
      .map((template) => ({ value: String(template.id), label: template.name })),
  ];

  const inviteOptions = [
    { value: '', label: '— chưa chọn —' },
    ...inviteSources.map((source) => ({
      value: source.code,
      label: `${source.label} (${source.uses} lượt)`,
    })),
  ];

  function highlightSelection() {
    for (const node of root.querySelectorAll('[data-guild-card]')) {
      node.classList.toggle('selected', node.dataset.guildCard === selectedId);
    }
  }

  async function openDetail(guildId) {
    selectedId = guildId;
    highlightSelection();
    detailHolder.replaceChildren(skeletonCard(5));

    let data;
    try {
      data = await api.getGuild(guildId);
    } catch (error) {
      detailHolder.replaceChildren(emptyState('Không mở được server', error.message));
      return;
    }

    const config = { ...data.config };
    const patch = {};
    const bind = (key) => (value) => {
      patch[key] = value;
      config[key] = value;
    };
    const isHome = data.guild.isHome;

    const saveButton = el('button', {
      class: 'primary',
      text: 'Lưu cấu hình',
      onClick: async () => {
        try {
          await api.saveGuildConfig(guildId, patch);
          toast('Đã lưu cấu hình.', 'ok');
          await openDetail(guildId);
        } catch (error) {
          toast(`Lưu thất bại: ${error.message}`, 'bad');
        }
      },
    });

    detailHolder.replaceChildren(
      card({
        title: data.guild.name,
        hint: `${data.guild.memberCount} member • ${data.channels.length} channel gửi được`,
        actions: [
          el('span', { class: `badge ${isHome ? 'brand' : ''}`, text: isHome ? 'server nhà' : 'đối tác' }),
          el('span', {
            class: `badge ${data.guild.canManageInvites ? 'ok' : 'warn'}`,
            text: data.guild.canManageInvites ? 'đọc được invite' : 'thiếu Manage Server',
          }),
        ],
        body: [
          field('Nhãn nguồn (dùng trong thống kê)', textInput(config.source_label, bind('sourceLabel'), 'vd: partner-stella')),
          field(
            'Invite dùng cho server này',
            selectInput(inviteOptions, config.invite_code, bind('inviteCode')),
            'Mỗi nguồn một invite riêng thì mới biết ai đến từ đâu. Tạo ở tab "Nguồn & invite".',
          ),
          el('h3', { style: 'margin:18px 0 8px', text: 'Nội dung gắn với server này' }),
          field('Template panel (tin có nút, đăng ở server này)', selectInput(templateOptions('panel'), config.panel_template_id, bind('panelTemplateId'))),
          field('Template DM (gửi khi user bấm nút)', selectInput(templateOptions('dm'), config.dm_template_id, bind('dmTemplateId'))),
          isHome
            ? el('div', {}, [
                field('Template welcome DM', selectInput(templateOptions('welcome'), config.welcome_template_id, bind('welcomeTemplateId'))),
                checkbox('Gửi welcome DM cho người mới join', config.welcome_dm_enabled === 1, (checked) => {
                  patch.welcomeDmEnabled = checked;
                }),
              ])
            : null,
          field('Ghi chú', textArea(config.notes, bind('notes'), 'Chủ server là ai, thoả thuận cross-promo…')),
          el('div', { class: 'actions', style: 'margin-top:14px' }, [saveButton]),
          el('div', { class: 'muted', style: 'margin-top:14px' },
            'Đăng panel: sang tab "Soạn nội dung" → chọn template loại panel → chọn server + channel → "Đăng lên channel".'),
        ],
      }),
    );
  }

  const list = el('div', { class: 'stack' });

  if (guilds.length === 0) {
    list.append(
      emptyState('Chưa thấy server nào', 'Bot chưa online, hoặc chưa được mời vào server nào.'),
    );
  }

  for (const guild of guilds) {
    list.append(
      el('div', {
        class: 'card clickable card-row',
        dataset: { guildCard: guild.id },
        onClick: () => openDetail(guild.id),
      }, [
        guildAvatar(guild),
        el('div', { style: 'flex:1;min-width:0' }, [
          el('div', { style: 'font-weight:600;color:var(--text-strong)', text: guild.name }),
          el('div', { class: 'muted', text: `${guild.memberCount} member • nguồn: ${guild.sourceLabel ?? 'chưa đặt'}` }),
        ]),
        guild.isHome ? el('span', { class: 'badge brand', text: 'nhà' }) : null,
        el('span', {
          class: `badge ${guild.configured ? 'ok' : 'warn'}`,
          text: guild.configured ? 'đã cấu hình' : 'chưa xong',
        }),
      ]),
    );
  }

  root.replaceChildren(
    pageHead(
      'Server của bot',
      'Chọn một server để gán nội dung, invite và nhãn nguồn riêng. Bot chỉ gửi khi bạn ra lệnh.',
      el('span', { class: 'badge', text: `${guilds.length} server` }),
    ),
    el('div', { class: 'split-editor' }, [list, detailHolder]),
  );

  if (guilds.length > 0) {
    const home = guilds.find((guild) => guild.isHome) ?? guilds[0];
    await openDetail(home.id);
  } else {
    detailHolder.replaceChildren(
      emptyState('Chưa có gì để cấu hình', 'Mời bot vào server rồi tải lại trang.'),
    );
  }
}
