import { api } from './api-client.js';
import { el, skeletonCard, toast } from './dom-helpers.js';
import { renderAnalytics } from './views/view-analytics.js';
import { renderComposer } from './views/view-composer.js';
import { renderServers } from './views/view-servers.js';
import { renderSources } from './views/view-sources.js';

const ROUTES = {
  servers: renderServers,
  composer: renderComposer,
  analytics: renderAnalytics,
  sources: renderSources,
};

const main = document.getElementById('main');
const sidebar = document.getElementById('sidebar');

function currentRoute() {
  const hash = location.hash.replace('#', '');
  return ROUTES[hash] ? hash : 'servers';
}

function discordLogo() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'currentColor');
  svg.innerHTML =
    '<path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.4.7a14.6 14.6 0 0 1 4.3 1.4 14 14 0 0 0-12.6 0A14.6 14.6 0 0 1 11 3.7L10.6 3a19.8 19.8 0 0 0-4.9 1.4C2.6 9 1.8 13.5 2.2 18a19.9 19.9 0 0 0 6 3l.8-1.2a13 13 0 0 1-2.1-1c.2-.1.4-.3.6-.4a14.2 14.2 0 0 0 12 0l.6.4a13 13 0 0 1-2.1 1l.8 1.2a19.9 19.9 0 0 0 6-3c.5-5.3-.8-9.8-3.5-13.6ZM8.9 15.3c-1.2 0-2.1-1.1-2.1-2.4 0-1.3.9-2.4 2.1-2.4s2.2 1.1 2.2 2.4c0 1.3-1 2.4-2.2 2.4Zm6.2 0c-1.2 0-2.1-1.1-2.1-2.4 0-1.3.9-2.4 2.1-2.4s2.2 1.1 2.2 2.4c0 1.3-1 2.4-2.2 2.4Z"/>';
  return svg;
}

function showLogin(message) {
  sidebar.hidden = true;
  main.replaceChildren(
    el('div', { class: 'login-shell' }, [
      el('div', { class: 'brand-mark', text: 'G' }),
      el('h1', { text: 'Growth Toolkit' }),
      el('div', { class: 'subtitle', style: 'margin-top:8px' },
        message ?? 'Dashboard nội bộ để soạn nội dung, phát panel opt-in và đo nguồn kéo người.'),
      el('a', { class: 'btn-discord', href: '/api/auth/login' }, [
        discordLogo(),
        'Đăng nhập với Discord',
      ]),
    ]),
  );
}

async function refreshStatus() {
  const dot = document.getElementById('bot-dot');
  const label = document.getElementById('bot-status');
  try {
    const status = await api.status();
    if (!status.online) {
      dot.className = 'status-dot offline';
      label.textContent = 'bot chưa online';
      return;
    }
    dot.className = 'status-dot online';
    if (!status.homeGuild) {
      dot.className = 'status-dot offline';
      label.textContent = 'chưa ở trong server nhà';
      return;
    }
    const warning = status.homeGuild.canManageInvites ? '' : ' • thiếu quyền invite';
    label.textContent = `${status.guildCount} server${warning}`;
    label.title = `${status.botTag} • nhà: ${status.homeGuild.name} (${status.homeGuild.memberCount} member)`;
  } catch {
    dot.className = 'status-dot offline';
    label.textContent = 'không đọc được trạng thái';
  }
}

function fillSessionCard(user) {
  document.getElementById('session-user').textContent = user.username;
  const avatar = document.getElementById('session-avatar');
  if (user.avatar) {
    avatar.replaceChildren(
      el('img', { src: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=64`, alt: '' }),
    );
  } else {
    avatar.textContent = user.username.slice(0, 1).toUpperCase();
  }
}

async function route() {
  const name = currentRoute();
  for (const item of sidebar.querySelectorAll('.nav-item')) {
    item.classList.toggle('active', item.dataset.route === name);
  }

  main.replaceChildren(skeletonCard(4));
  try {
    await ROUTES[name](main);
  } catch (error) {
    if (error.status === 401) {
      showLogin('Phiên đã hết hạn, đăng nhập lại nhé.');
      return;
    }
    main.replaceChildren(
      el('div', { class: 'empty' }, [el('strong', { text: 'Không tải được trang' }), error.message]),
    );
    toast(error.message, 'bad');
  }
}

async function boot() {
  let session;
  try {
    session = await api.me();
  } catch {
    showLogin();
    return;
  }

  sidebar.hidden = false;
  fillSessionCard(session.user);

  document.getElementById('logout-button').addEventListener('click', async () => {
    await api.logout().catch(() => undefined);
    location.reload();
  });

  for (const item of sidebar.querySelectorAll('.nav-item')) {
    const go = () => {
      location.hash = item.dataset.route;
    };
    item.addEventListener('click', go);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        go();
      }
    });
  }

  window.addEventListener('hashchange', () => void route());
  await Promise.all([route(), refreshStatus()]);
  setInterval(() => void refreshStatus(), 30_000);
}

void boot();
