import { api } from '../api-client.js';
import {
  card,
  dataTable,
  el,
  emptyState,
  formatDateTime,
  formatPercent,
  kpi,
  pageHead,
  selectInput,
  skeletonCard,
  toast,
} from '../dom-helpers.js';
import { barChart } from '../svg-chart.js';

/** Ô phần trăm có thanh nhỏ phía trước để so sánh bằng mắt nhanh hơn số. */
function percentCell(value, eligible = 1) {
  if (eligible <= 0) return { numeric: true, node: el('span', { class: 'muted', text: '—' }) };
  const tone = value >= 70 ? 'good' : value >= 40 ? 'warn' : 'bad';
  return {
    numeric: true,
    node: el('div', { class: `meter ${tone}` }, [
      el('div', { class: 'track' }, [
        el('div', { class: 'fill', style: `width:${Math.min(100, Math.max(0, value))}%` }),
      ]),
      el('span', { class: 'text', text: formatPercent(value) }),
    ]),
  };
}

export async function renderAnalytics(root) {
  let days = 30;
  const body = el('div', { class: 'stack' });

  async function load() {
    body.replaceChildren(skeletonCard(3), skeletonCard(5));

    let overview;
    let joins;
    let outreach;
    try {
      [overview, joins, outreach] = await Promise.all([
        api.overview(days),
        api.joins({ limit: 100 }),
        api.outreach(100),
      ]);
    } catch (error) {
      body.replaceChildren(emptyState('Không tải được thống kê', error.message));
      toast(error.message, 'bad');
      return;
    }

    const totals = overview.totals;

    const kpis = el('div', { class: 'grid cols-4' }, [
      kpi('Tổng join', totals.totalJoins, `${totals.stillMember} còn ở lại`),
      kpi('Join 7 ngày', totals.joins7d, `30 ngày: ${totals.joins30d}`),
      kpi('Giữ người', formatPercent(totals.retentionOverall), `${totals.leftCount} đã rời`,
        totals.retentionOverall >= 60 ? 'good' : 'warn'),
      kpi('Lượt bấm nút', totals.clicks, 'người tự xin thông tin'),
      kpi('DM gửi được', totals.dmsSent, `${totals.dmsBlocked} bị chặn DM`),
      kpi('DM tới được', formatPercent(totals.dmDeliveryRate), 'sent / (sent + blocked)',
        totals.dmDeliveryRate >= 70 ? 'good' : 'warn'),
    ]);

    const sourceRows = overview.sources.map((row) => [
      el('strong', { text: row.source }),
      { numeric: true, value: row.joins },
      { numeric: true, value: row.stillMember },
      { numeric: true, value: row.leftCount },
      percentCell(row.shareOfJoins),
      percentCell(row.retention7d, row.eligible7d),
      percentCell(row.retention30d, row.eligible30d),
    ]);

    const funnelRows = overview.funnel.map((row) => [
      el('strong', { text: row.guildName }),
      row.sourceLabel ?? el('span', { class: 'muted', text: 'chưa gán' }),
      { numeric: true, value: row.clicks },
      { numeric: true, value: row.dmsSent },
      { numeric: true, value: row.dmsBlocked },
      { numeric: true, value: row.joins },
      percentCell(row.clickToJoin, row.clicks),
    ]);

    const joinRows = joins.joins.map((row) => [
      row.username ?? row.userId,
      row.source ?? el('span', { class: 'muted', text: '—' }),
      row.inviteCode ?? '—',
      row.inviterTag ?? '—',
      formatDateTime(row.joinedAt),
      el('span', {
        class: `badge ${row.stillMember ? 'ok' : 'bad'}`,
        text: row.stillMember ? 'còn ở' : 'đã rời',
      }),
    ]);

    const statusTone = { sent: 'ok', blocked_dm: 'warn', failed: 'bad', duplicate: '' };
    const outreachRows = outreach.entries.map((row) => [
      row.username ?? row.userId,
      el('span', { class: `badge ${statusTone[row.status] ?? ''}`, text: row.status }),
      row.originGuildId ?? '—',
      formatDateTime(row.createdAt),
      row.error ? row.error.slice(0, 70) : '—',
    ]);

    const rangePicker = selectInput(
      [
        { value: '7', label: '7 ngày' },
        { value: '30', label: '30 ngày' },
        { value: '90', label: '90 ngày' },
      ],
      String(days),
      (value) => {
        days = Number(value);
        void load();
      },
    );
    rangePicker.style.width = 'auto';

    body.replaceChildren(
      kpis,
      card({
        title: 'Join theo ngày',
        hint: `${overview.daily.reduce((sum, point) => sum + point.joins, 0)} join trong ${days} ngày`,
        actions: rangePicker,
        body: barChart(overview.daily, { label: 'Join theo ngày' }),
      }),
      card({
        title: 'Theo nguồn',
        hint: 'Tỷ lệ giữ chỉ tính trên người đã join đủ 7/30 ngày, nên người mới join không làm đẹp số liệu.',
        body: dataTable(
          [
            { label: 'Nguồn' },
            { label: 'Join', numeric: true },
            { label: 'Còn ở', numeric: true },
            { label: 'Đã rời', numeric: true },
            { label: '% tổng join', numeric: true },
            { label: 'Giữ 7 ngày', numeric: true },
            { label: 'Giữ 30 ngày', numeric: true },
          ],
          sourceRows,
          'Chưa có ai join qua invite được theo dõi.',
        ),
      }),
      card({
        title: 'Phễu theo server đối tác',
        hint: 'Bấm nút → nhận DM → thật sự vào server. Cần gán nhãn nguồn cho server mới có số join.',
        body: dataTable(
          [
            { label: 'Server' },
            { label: 'Nhãn nguồn' },
            { label: 'Bấm nút', numeric: true },
            { label: 'DM gửi được', numeric: true },
            { label: 'DM bị chặn', numeric: true },
            { label: 'Join', numeric: true },
            { label: 'Bấm → join', numeric: true },
          ],
          funnelRows,
          'Chưa có server đối tác nào có dữ liệu.',
        ),
      }),
      card({
        title: 'Người join gần đây',
        hint: `${joins.joins.length} bản ghi mới nhất`,
        body: dataTable(
          [
            { label: 'Người dùng' },
            { label: 'Nguồn' },
            { label: 'Invite' },
            { label: 'Người tạo invite' },
            { label: 'Join lúc' },
            { label: 'Trạng thái' },
          ],
          joinRows,
          'Chưa có ai join từ khi bot chạy.',
        ),
      }),
      card({
        title: 'Log DM',
        hint: 'duplicate = user bấm nút lần thứ hai, bot không gửi lại.',
        body: dataTable(
          [
            { label: 'Người dùng' },
            { label: 'Kết quả' },
            { label: 'Từ server' },
            { label: 'Lúc' },
            { label: 'Lỗi' },
          ],
          outreachRows,
          'Chưa gửi DM nào.',
        ),
      }),
    );
  }

  root.replaceChildren(
    pageHead('Thống kê', 'Ai join từ nguồn nào, giữ được bao lâu, và phễu opt-in chuyển đổi ra sao.'),
    body,
  );

  await load();
}
