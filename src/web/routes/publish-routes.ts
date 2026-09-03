import { Router } from 'express';
import { client } from '../../bot/discord-client';
import {
  editPublishedMessage,
  publishTemplateToChannel,
  publishTemplateToWebhook,
} from '../../bot/services/message-publisher';
import { sendTemplateDm } from '../../bot/services/dm-sender';
import { getTemplate, listPublishedMessages } from '../../db/repo-content';
import { hasBlockingIssue, validateTemplatePayload } from '../../shared/template-validation';
import type { PlaceholderContext, TemplatePayload } from '../../shared/template-types';
import type { AuthenticatedRequest } from '../middleware/require-auth';

interface PublishBody {
  templateId?: number;
  payload?: TemplatePayload;
  channelId?: string;
  messageId?: string;
  webhookUrl?: string;
  username?: string;
  avatarUrl?: string;
  includeOptIn?: boolean;
  context?: PlaceholderContext;
}

/** Ưu tiên payload gửi kèm (bản đang sửa trong composer), không thì lấy template đã lưu. */
function resolvePayload(body: PublishBody): { payload: TemplatePayload; templateId: number | null } | null {
  if (body.payload) return { payload: body.payload, templateId: body.templateId ?? null };
  if (body.templateId) {
    const template = getTemplate(body.templateId);
    if (template) return { payload: template.payload, templateId: template.id };
  }
  return null;
}

export const publishRoutes = Router();

publishRoutes.post('/channel', async (request, response) => {
  const body = request.body as PublishBody;
  const resolved = resolvePayload(body);

  if (!resolved) {
    response.status(400).json({ error: 'Thiếu payload hoặc templateId' });
    return;
  }
  if (!body.channelId) {
    response.status(400).json({ error: 'Thiếu channelId' });
    return;
  }

  const issues = validateTemplatePayload(resolved.payload);
  if (hasBlockingIssue(issues)) {
    response.status(400).json({ error: 'Nội dung chưa hợp lệ', issues });
    return;
  }

  try {
    const result = await publishTemplateToChannel({
      channelId: body.channelId,
      payload: resolved.payload,
      templateId: resolved.templateId,
      includeOptIn: body.includeOptIn === true,
      context: body.context ?? {},
    });
    response.json({ result, issues });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

publishRoutes.post('/edit', async (request, response) => {
  const body = request.body as PublishBody;
  const resolved = resolvePayload(body);

  if (!resolved || !body.channelId || !body.messageId) {
    response.status(400).json({ error: 'Cần channelId, messageId và nội dung' });
    return;
  }

  try {
    const result = await editPublishedMessage({
      channelId: body.channelId,
      messageId: body.messageId,
      payload: resolved.payload,
      includeOptIn: body.includeOptIn === true,
      context: body.context ?? {},
    });
    response.json({ result });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

publishRoutes.post('/webhook', async (request, response) => {
  const body = request.body as PublishBody;
  const resolved = resolvePayload(body);

  if (!resolved || !body.webhookUrl) {
    response.status(400).json({ error: 'Cần webhookUrl và nội dung' });
    return;
  }

  if (resolved.payload.useComponentsV2) {
    response.status(400).json({
      error: 'Webhook không gửi được Components V2 — dùng "Đăng lên channel" bằng bot',
    });
    return;
  }

  const issues = validateTemplatePayload(resolved.payload);
  if (hasBlockingIssue(issues)) {
    response.status(400).json({ error: 'Nội dung chưa hợp lệ', issues });
    return;
  }

  try {
    const result = await publishTemplateToWebhook({
      webhookUrl: body.webhookUrl,
      payload: resolved.payload,
      templateId: resolved.templateId,
      username: body.username,
      avatarUrl: body.avatarUrl,
      context: body.context ?? {},
    });
    response.json({ result, issues });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

/** Gửi thử vào DM của chính người đang đăng nhập — cách duy nhất để xem thật 100%. */
publishRoutes.post('/test-dm', async (request: AuthenticatedRequest, response) => {
  const body = request.body as PublishBody;
  const resolved = resolvePayload(body);
  const session = request.session;

  if (!resolved || !session) {
    response.status(400).json({ error: 'Thiếu nội dung' });
    return;
  }

  const user = await client.users.fetch(session.userId).catch(() => null);
  if (!user) {
    response.status(404).json({ error: 'Bot không thấy tài khoản của bạn' });
    return;
  }

  const result = await sendTemplateDm({
    user,
    payload: resolved.payload,
    templateId: resolved.templateId,
    originGuildId: null,
    context: {
      userMention: `<@${user.id}>`,
      userName: user.username,
      userId: user.id,
      serverName: 'Bản gửi thử',
      ...body.context,
    },
  });

  response.json({ result });
});

publishRoutes.get('/history', (_request, response) => {
  response.json({ messages: listPublishedMessages(50) });
});
