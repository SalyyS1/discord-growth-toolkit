import { api } from '../api-client.js';
import { loadState, saveState } from '../local-store.js';
import {
  card,
  collapsible,
  dataTable,
  el,
  emptyState,
  field,
  formatDateTime,
  kpi,
  pageHead,
  selectInput,
  textInput,
  toast,
} from '../dom-helpers.js';

const POLL_MS = 3000;
const TEMPLATE_KEY = 'notify-template';
const AUDIENCE_KEY = 'notify-audience';

const AUDIENCE_LABEL = {
  subscribers: 'người đã bấm nút đăng ký',
  role: 'thành viên có role thông báo',
};

function statusCount(counts, key) {
  return counts?.[key] ?? 0;
}

function estimateText(total, intervalMs) {
  const minutes = Math.ceil((total * intervalMs) / 60000);
  return `${total} người · mất khoảng ${minutes} phút vì mỗi tin giãn ${(intervalMs / 1000).toFixed(1)}s`;
}

function campaignProgressLine(campaign, running, total) {
  const counts = campaign.counts ?? {};
  const done =
    statusCount(counts, 'sent') +
    statusCount(counts, 'blocked_dm') +
    statusCount(counts, 'failed') +
    statusCount(counts, 'skipped');
  const breakdown =
    `gửi được ${statusCount(counts, 'sent')}, DM đóng ${statusCount(counts, 'blocked_dm')}, ` +
    `lỗi ${statusCount(counts, 'failed')}, bỏ qua ${statusCount(counts, 'skipped')}`;

  return el('div', { class: 'notice', style: 'margin-top:14px' }, [
    el('div', { style: 'font-weight:600;color:var(--text-strong)' }, `#${campaign.id} · ${campaign.name}`),
    el('div', { class: 'muted' },
      running ? `Đang gửi… ${done}/${total} — ${breakdown}` : `Xong lúc ${formatDateTime(campaign.finished_at)} — ${breakdown}`),
  ]);
}

export async function renderNotify(root) {
  const [overview, templateData] = await Promise.all([
    api.notifyOverview(),
    api.listTemplates().catch(() => ({ templates: [] })),
  ]);

  const templates = templateData.templates ?? [];
  const rememberedTemplateId = loadState(TEMPLATE_KEY, '');
  const rememberedAudience = loadState(AUDIENCE_KEY, null);
  const state = {
    roleId: overview.roleId ?? '',
    templateId: templates.some((item) => String(item.id) === String(rememberedTemplateId))
      ? String(rememberedTemplateId)
      : '',
    // Có role sẵn thì gửi theo role là mặc định hợp lý hơn.
    audience: rememberedAudience ?? (overview.roleId ? 'role' : 'subscribers'),
    campaignName: '',
    watching: overview.runningCampaignId ?? null,
  };

  // Số người có role phải hỏi Discord (cần tải member), nên nạp riêng khi cần.
  let roleAudience = null;

  const progressHolder = el('div', {});
  let pollTimer = null;

  /** View bị thay khi đổi tab, nên tự dừng poll khi node không còn trong DOM. */
  function watchCampaign(campaignId) {
    state.watching = campaignId;
    clearInterval(pollTimer);

    const tick = async () => {
      if (!document.body.contains(progressHolder)) {
        clearInterval(pollTimer);
        return;
      }
      try {
        const data = await api.notifyCampaign(campaignId);
        progressHolder.replaceChildren(
          campaignProgressLine(data.campaign, data.running, data.subscriberCount),
        );
        if (!data.running) {
          clearInterval(pollTimer);
          toast(`Đợt #${campaignId} đã gửi xong.`, 'ok');
        }
      } catch (error) {
        clearInterval(pollTimer);
        toast(`Không đọc được tiến độ: ${error.message}`, 'bad');
      }
    };

    void tick();
    pollTimer = setInterval(() => void tick(), POLL_MS);
  }

  const roleOptions = [
    { value: '', label: '— không gán role —' },
    ...overview.roles.map((role) => ({
      value: role.id,
      label: role.assignable ? role.name : `${role.name} (bot không gán được)`,
    })),
  ];

  const saveRoleButton = el('button', {
    class: 'primary',
    text: 'Lưu role',
    onClick: async () => {
      try {
        await api.setNotifyRole(state.roleId || null);
        toast('Đã lưu role thông báo.', 'ok');
      } catch (error) {
        toast(`Lưu thất bại: ${error.message}`, 'bad');
      }
    },
  });

  const templateOptions = [
    { value: '', label: '— chọn nội dung —' },
    ...templates.map((template) => ({
      value: String(template.id),
      label: `${template.name} · ${template.kind}`,
    })),
  ];

  const audienceHolder = el('div', {});

  function audienceTotal() {
    if (state.audience === 'role') return roleAudience ? roleAudience.total : null;
    return overview.subscriberCount;
  }

  const sendButton = el('button', {
    class: 'primary',
    text: 'Gửi thông báo',
    onClick: async () => {
      if (!state.templateId) {
        toast('Chọn nội dung cần gửi trước.', 'bad');
        return;
      }
      const total = audienceTotal();
      if (!total) {
        toast('Chưa có ai trong nhóm nhận.', 'bad');
        return;
      }

      const name = templates.find((item) => String(item.id) === state.templateId)?.name ?? '';
      const confirmed = confirm(
        `Gửi DM "${state.campaignName || name}" cho ${total} ${AUDIENCE_LABEL[state.audience]}?\n\n` +
          `${estimateText(total, overview.dmIntervalMs)}`,
      );
      if (!confirmed) return;

      try {
        const data = await api.startNotifyCampaign({
          templateId: Number(state.templateId),
          name: state.campaignName,
          audience: state.audience,
        });
        toast(`Đã bắt đầu đợt #${data.campaign.id}.`, 'ok');
        watchCampaign(data.campaign.id);
      } catch (error) {
        toast(`Không gửi được: ${error.message}`, 'bad');
      }
    },
  });

  async function loadRoleAudience() {
    roleAudience = null;
    renderAudience();
    try {
      roleAudience = await api.notifyRoleAudience();
    } catch (error) {
      toast(`Không đếm được người có role: ${error.message}`, 'bad');
    }
    renderAudience();
  }

  function audienceDetail() {
    if (state.audience === 'subscribers') {
      return `${overview.subscriberCount} người đã tự bấm nút đăng ký.`;
    }
    if (!overview.roleId) return 'Chưa chọn role thông báo ở phần trên.';
    if (!roleAudience) return 'Đang đếm số người có role…';

    const parts = [
      `Role "${roleAudience.roleName}": ${roleAudience.holders} người đang có role, gửi cho ${roleAudience.total}.`,
    ];
    if (roleAudience.bots > 0) parts.push(`Bỏ ${roleAudience.bots} bot.`);
    if (roleAudience.optedOut > 0) parts.push(`Bỏ ${roleAudience.optedOut} người đã bấm huỷ nhận.`);
    return parts.join(' ');
  }

  function renderAudience() {
    const total = audienceTotal();
    sendButton.textContent =
      total === null ? 'Đang đếm người nhận…' : `Gửi cho ${total} ${AUDIENCE_LABEL[state.audience]}`;
    sendButton.disabled = !total;

    audienceHolder.replaceChildren(
      field(
        'Gửi cho ai',
        selectInput(
          [
            { value: 'role', label: 'Tất cả thành viên đang có role thông báo' },
            { value: 'subscribers', label: 'Chỉ người đã bấm nút đăng ký' },
          ],
          state.audience,
          async (value) => {
            state.audience = value;
            saveState(AUDIENCE_KEY, value);
            if (value === 'role' && !roleAudience) await loadRoleAudience();
            else renderAudience();
          },
        ),
      ),
      el('div', { class: 'muted' }, audienceDetail()),
      total ? el('div', { class: 'muted' }, estimateText(total, overview.dmIntervalMs)) : null,
    );
  }

  const subscriberListHolder = el('div', { class: 'muted' }, 'Bấm "Tải danh sách" để xem.');

  const subscribersBlock = collapsible({
    summary: 'Danh sách người đã đăng ký',
    note: `${overview.subscriberCount} người`,
    body: [subscriberListHolder],
    actions: el('button', {
      class: 'ghost small',
      text: 'Tải danh sách',
      onClick: async () => {
        try {
          const data = await api.notifySubscribers();
          subscriberListHolder.className = '';
          subscriberListHolder.replaceChildren(
            dataTable(
              [{ label: 'Người dùng' }, { label: 'ID' }, { label: 'Đăng ký lúc' }],
              data.subscribers.map((row) => [
                row.username ?? '(không rõ)',
                row.user_id,
                formatDateTime(row.subscribed_at),
              ]),
              'Chưa có ai bấm nút đăng ký.',
            ),
          );
        } catch (error) {
          toast(`Không tải được: ${error.message}`, 'bad');
        }
      },
    }),
  });

  const listCard = card({
    title: 'Danh sách nhận thông báo',
    hint: 'Chỉ người tự bấm nút đăng ký mới vào danh sách này. Bot không quét member list.',
    body: [
      field(
        'Role gán cho người đăng ký',
        selectInput(roleOptions, state.roleId, (value) => {
          state.roleId = value;
        }),
        'Role này vừa để ping trong channel, vừa là nhóm nhận khi bạn chọn "gửi theo role". Chỉ dùng role mà người dùng tự nhận được (bấm nút, reaction role) — role bạn tự gán hay role mặc định thì gửi DM là spam. Bot cần quyền Manage Roles và role phải nằm dưới role của bot.',
      ),
      overview.canManageRoles
        ? null
        : el('div', { class: 'notice warn' },
            'Bot thiếu quyền Manage Roles — người bấm nút vẫn vào danh sách và vẫn nhận DM, chỉ là không được gán role.'),
      el('div', { class: 'actions', style: 'margin-top:12px' }, [saveRoleButton]),
      subscribersBlock,
      el('div', { class: 'muted', style: 'margin-top:14px' },
        'Tạo nút đăng ký: tab "Soạn nội dung" → loại panel → bật nút opt-in → chọn "Ghi danh nhận thông báo" → đăng vào channel ở server nhà.'),
    ],
  });

  const sendCard = card({
    title: 'Gửi một đợt thông báo',
    hint: 'Mỗi đợt chỉ gửi một lần cho mỗi người. Chạy lại đợt cũ chỉ thử lại người trước đó DM đóng.',
    body: [
      field('Nội dung', selectInput(templateOptions, state.templateId, (value) => {
        state.templateId = value;
        saveState(TEMPLATE_KEY, value);
      })),
      audienceHolder,
      field('Tên đợt (để tra lại trong lịch sử)', textInput('', (value) => {
        state.campaignName = value;
      }, 'vd: event-halloween-2026')),
      el('div', { class: 'actions', style: 'margin-top:12px' }, [sendButton]),
      progressHolder,
    ],
  });

  const historyCard = card({
    title: 'Lịch sử đợt gửi',
    body: [
      dataTable(
        [
          { label: 'Đợt' },
          { label: 'Nhóm nhận' },
          { label: 'Bắt đầu' },
          { label: 'Gửi được', numeric: true },
          { label: 'DM đóng', numeric: true },
          { label: 'Lỗi', numeric: true },
          { label: 'Bỏ qua', numeric: true },
          { label: 'Trạng thái' },
        ],
        overview.campaigns.map((campaign) => [
          `#${campaign.id} ${campaign.name}`,
          campaign.audience === 'role' ? 'có role' : 'đã bấm nút',
          formatDateTime(campaign.created_at),
          { value: statusCount(campaign.counts, 'sent'), numeric: true },
          { value: statusCount(campaign.counts, 'blocked_dm'), numeric: true },
          { value: statusCount(campaign.counts, 'failed'), numeric: true },
          { value: statusCount(campaign.counts, 'skipped'), numeric: true },
          campaign.finished_at ? 'xong' : 'đang chạy',
        ]),
        'Chưa gửi đợt nào.',
      ),
    ],
  });

  // KPI đứng ngoài card: .kpi đã có nền + viền riêng, lồng trong card sẽ thành card trong card.
  const kpiRow = el('div', { class: 'grid cols-3' }, [
    kpi('Đang đăng ký', overview.subscriberCount, 'người sẽ nhận DM'),
    kpi('Đợt đã gửi', overview.campaigns.length, 'xem lịch sử bên dưới'),
    kpi('Giãn nhịp mỗi DM', `${(overview.dmIntervalMs / 1000).toFixed(1)}s`, 'để không bị coi là spam'),
  ]);

  root.replaceChildren(
    pageHead(
      'Thông báo',
      `Gửi DM cho những người đã tự đăng ký nhận thông báo ở ${overview.guildName ?? 'server nhà'}.`,
      el('span', {
        class: `badge ${overview.guildOnline ? 'ok' : 'warn'}`,
        text: overview.guildOnline ? 'bot online' : 'bot chưa vào server nhà',
      }),
    ),
    overview.guildOnline
      ? el('div', { class: 'stack' }, [kpiRow, listCard, sendCard, historyCard])
      : emptyState('Bot chưa vào được server nhà', 'Kiểm tra HOME_GUILD_ID và trạng thái bot rồi tải lại trang.'),
  );

  if (state.watching) watchCampaign(state.watching);

  renderAudience();
  if (state.audience === 'role' && overview.roleId) void loadRoleAudience();
}
