import { api } from '../api-client.js';
import { card, el, field, selectInput, textInput, toast } from '../dom-helpers.js';
import { loadState, saveState } from '../local-store.js';

const TARGET_KEY = 'send-target';

/**
 * Khu vực gửi: chọn server/channel của bot, hoặc webhook, hoặc gửi thử vào DM.
 * getPayload() trả về bản đang sửa để gửi đúng thứ đang thấy trong preview.
 * Server/channel chọn lần trước được nhớ lại để khỏi phải chọn đi chọn lại.
 */
export function createSendPanel(getPayload, getTemplateId, getIncludeOptIn) {
  const saved = loadState(TARGET_KEY, {});
  const state = {
    guildId: saved.guildId ?? '',
    channelId: saved.channelId ?? '',
    webhookUrl: '',
    messageId: '',
  };
  const channelHolder = el('div', {});
  const statusLine = el('div', { class: 'muted' });

  function rememberTarget() {
    saveState(TARGET_KEY, { guildId: state.guildId, channelId: state.channelId });
  }

  const guildSelect = el('select', {
    onChange: async (event) => {
      state.guildId = event.target.value;
      state.channelId = '';
      rememberTarget();
      await loadChannels();
    },
  }, [el('option', { value: '' }, 'Đang tải…')]);

  async function loadChannels() {
    channelHolder.replaceChildren();
    if (!state.guildId) return;
    try {
      const data = await api.getGuild(state.guildId);
      const sendable = data.channels.filter((channel) => channel.canSend);
      const blocked = data.channels.length - sendable.length;
      // Channel đã nhớ có thể bị xoá hoặc mất quyền từ lần trước.
      if (state.channelId && !sendable.some((channel) => channel.id === state.channelId)) {
        state.channelId = '';
      }
      channelHolder.append(
        field(
          'Channel',
          selectInput(
            [
              { value: '', label: '— chọn channel —' },
              ...sendable.map((channel) => ({ value: channel.id, label: `#${channel.name}` })),
            ],
            state.channelId,
            (value) => {
              state.channelId = value;
              rememberTarget();
            },
          ),
          blocked > 0 ? `${blocked} channel bị ẩn vì bot không có quyền gửi.` : undefined,
        ),
      );
    } catch (error) {
      toast(`Không tải được channel: ${error.message}`, 'bad');
    }
  }

  async function loadGuilds() {
    try {
      const data = await api.listGuilds();
      guildSelect.replaceChildren(
        el('option', { value: '' }, '— chọn server —'),
        ...data.guilds.map((guild) =>
          el('option', { value: guild.id }, `${guild.name}${guild.isHome ? ' · nhà' : ''}`),
        ),
      );

      if (state.guildId && data.guilds.some((guild) => guild.id === state.guildId)) {
        guildSelect.value = state.guildId;
        await loadChannels();
      } else {
        state.guildId = '';
      }
    } catch (error) {
      toast(`Không tải được danh sách server: ${error.message}`, 'bad');
    }
  }

  async function run(action, task) {
    statusLine.textContent = `${action}…`;
    try {
      const result = await task();
      statusLine.textContent = '';
      return result;
    } catch (error) {
      statusLine.textContent = '';
      const issues = error.data?.issues;
      const detail = issues?.length
        ? `\n${issues.map((issue) => `• ${issue.field}: ${issue.message}`).join('\n')}`
        : '';
      toast(`${action} thất bại: ${error.message}${detail}`, 'bad');
      return null;
    }
  }

  const messageIdInput = textInput('', (value) => {
    state.messageId = value;
  }, 'Message ID cần sửa');

  const publishButton = el('button', {
    class: 'primary',
    text: 'Đăng lên channel',
    onClick: async () => {
      if (!state.channelId) {
        toast('Chọn channel trước đã.', 'bad');
        return;
      }
      const result = await run('Đăng tin', () =>
        api.publishToChannel({
          channelId: state.channelId,
          payload: getPayload(),
          templateId: getTemplateId(),
          includeOptIn: getIncludeOptIn(),
        }),
      );
      if (result) {
        state.messageId = result.result.messageId;
        messageIdInput.value = result.result.messageId;
        toast('Đã đăng. Message ID đã điền sẵn nếu cần sửa lại.', 'ok');
      }
    },
  });

  const testButton = el('button', {
    class: 'success',
    text: 'Gửi thử vào DM của tôi',
    onClick: async () => {
      const result = await run('Gửi thử', () =>
        api.sendTestDm({ payload: getPayload(), templateId: getTemplateId() }),
      );
      if (!result) return;
      if (result.result.status === 'sent') toast('Đã gửi vào DM của bạn.', 'ok');
      else if (result.result.status === 'blocked_dm') toast('DM của bạn đang đóng với bot.', 'bad');
      else toast(`Không gửi được: ${result.result.error ?? 'lỗi không rõ'}`, 'bad');
    },
  });

  const editButton = el('button', {
    class: 'ghost',
    text: 'Sửa tin đã đăng',
    onClick: async () => {
      if (!state.channelId || !state.messageId) {
        toast('Cần chọn channel và điền message ID.', 'bad');
        return;
      }
      const result = await run('Sửa tin', () =>
        api.editPublished({
          channelId: state.channelId,
          messageId: state.messageId,
          payload: getPayload(),
          templateId: getTemplateId(),
          includeOptIn: getIncludeOptIn(),
        }),
      );
      if (result) toast('Đã cập nhật tin nhắn.', 'ok');
    },
  });

  const webhookInput = textInput('', (value) => {
    state.webhookUrl = value;
  }, 'https://discord.com/api/webhooks/…');

  const webhookButton = el('button', {
    class: 'ghost',
    text: 'Gửi qua webhook',
    onClick: async () => {
      if (!state.webhookUrl) {
        toast('Dán webhook URL trước.', 'bad');
        return;
      }
      if (getPayload().useComponentsV2) {
        toast('Components V2 không gửi được qua webhook — dùng "Đăng lên channel".', 'bad');
        return;
      }
      const result = await run('Gửi webhook', () =>
        api.publishToWebhook({
          webhookUrl: state.webhookUrl,
          payload: getPayload(),
          templateId: getTemplateId(),
        }),
      );
      if (result) toast('Đã gửi qua webhook.', 'ok');
    },
  });

  void loadGuilds();

  return card({
    title: 'Gửi đi',
    hint: 'Webhook không gắn được nút opt-in (nút cần bot xử lý) — panel phải đăng bằng bot.',
    body: [
      field('Server', guildSelect),
      channelHolder,
      el('div', { class: 'actions', style: 'margin:12px 0 4px' }, [publishButton, testButton]),
      el('details', { class: 'inline-toggle' }, [
        el('summary', { text: 'Sửa tin đã đăng / gửi qua webhook' }),
        el('div', { style: 'margin-top:12px' }, [
          field('Message ID', messageIdInput),
          el('div', { class: 'actions' }, [editButton]),
          el('div', { style: 'height:14px' }),
          field('Webhook URL', webhookInput),
          el('div', { class: 'actions' }, [webhookButton]),
        ]),
      ]),
      statusLine,
    ],
  });
}
