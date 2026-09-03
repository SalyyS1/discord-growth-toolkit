async function request(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let data = {};
  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = { error: raw.slice(0, 300) };
    }
  }

  if (!response.ok) {
    const error = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request('GET', '/api/auth/me'),
  logout: () => request('POST', '/api/auth/logout'),

  status: () => request('GET', '/api/status'),

  listGuilds: () => request('GET', '/api/guilds'),
  getGuild: (guildId) => request('GET', `/api/guilds/${guildId}`),
  saveGuildConfig: (guildId, patch) => request('PATCH', `/api/guilds/${guildId}/config`, patch),
  listEmojis: () => request('GET', '/api/guilds/meta/emojis'),

  listTemplates: (kind) => request('GET', `/api/templates${kind ? `?kind=${kind}` : ''}`),
  getTemplate: (id) => request('GET', `/api/templates/${id}`),
  createTemplate: (payload) => request('POST', '/api/templates', payload),
  updateTemplate: (id, payload) => request('PUT', `/api/templates/${id}`, payload),
  deleteTemplate: (id) => request('DELETE', `/api/templates/${id}`),
  validateTemplate: (payload) => request('POST', '/api/templates/validate', { payload }),
  convertToComponentsV2: (payload) => request('POST', '/api/templates/to-components-v2', { payload }),

  listInviteSources: () => request('GET', '/api/invite-sources'),
  createInviteSource: (body) => request('POST', '/api/invite-sources', body),
  deleteInviteSource: (code) => request('DELETE', `/api/invite-sources/${code}`),

  publishToChannel: (body) => request('POST', '/api/publish/channel', body),
  publishToWebhook: (body) => request('POST', '/api/publish/webhook', body),
  editPublished: (body) => request('POST', '/api/publish/edit', body),
  sendTestDm: (body) => request('POST', '/api/publish/test-dm', body),
  publishHistory: () => request('GET', '/api/publish/history'),

  notifyOverview: () => request('GET', '/api/notify'),
  setNotifyRole: (roleId) => request('PUT', '/api/notify/role', { roleId }),
  notifySubscribers: (limit = 200) => request('GET', `/api/notify/subscribers?limit=${limit}`),
  notifyRoleAudience: () => request('GET', '/api/notify/role-audience'),
  startNotifyCampaign: (body) => request('POST', '/api/notify/campaigns', body),
  notifyCampaign: (id) => request('GET', `/api/notify/campaigns/${id}`),

  overview: (days = 30) => request('GET', `/api/analytics/overview?days=${days}`),
  joins: (options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.source) params.set('source', options.source);
    return request('GET', `/api/analytics/joins?${params.toString()}`);
  },
  outreach: (limit = 100) => request('GET', `/api/analytics/outreach?limit=${limit}`),
};
