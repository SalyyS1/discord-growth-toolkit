import { DiscordAPIError, type User } from 'discord.js';
import { env } from '../../config/env';
import { logOutreach, type OutreachStatus } from '../../db/repo-growth';
import { buildMessagePayload } from '../../shared/template-payload-builder';
import type { PlaceholderContext, TemplatePayload } from '../../shared/template-types';

/** Discord: "Cannot send messages to this user" — DM bị đóng. */
const CANNOT_SEND_TO_USER = 50007;

export interface DmResult {
  status: OutreachStatus;
  error?: string;
}

// Nối tiếp mọi DM vào một hàng đợi và giãn nhịp: gửi dồn dập là cách nhanh nhất
// để bot bị Discord đánh dấu spam, kể cả khi user đã đồng ý nhận.
let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const scheduled = queue.then(task, task);
  queue = scheduled
    .catch(() => undefined)
    .then(() => new Promise((resolve) => setTimeout(resolve, env.dmIntervalMs)));
  return scheduled;
}

export interface SendDmInput {
  user: User;
  payload: TemplatePayload;
  context: PlaceholderContext;
  templateId: number | null;
  originGuildId: string | null;
}

/** Chỉ gọi khi đã có bản ghi consent (user tự bấm nút hoặc vừa join server nhà). */
export function sendTemplateDm(input: SendDmInput): Promise<DmResult> {
  return enqueue(async () => {
    const message = buildMessagePayload(input.payload, input.context);
    try {
      await input.user.send(message);
      logOutreach({
        userId: input.user.id,
        username: input.user.tag,
        originGuildId: input.originGuildId,
        templateId: input.templateId,
        status: 'sent',
      });
      return { status: 'sent' } satisfies DmResult;
    } catch (error) {
      const isClosedDm = error instanceof DiscordAPIError && error.code === CANNOT_SEND_TO_USER;
      const status: OutreachStatus = isClosedDm ? 'blocked_dm' : 'failed';
      const reason = error instanceof Error ? error.message : String(error);
      logOutreach({
        userId: input.user.id,
        username: input.user.tag,
        originGuildId: input.originGuildId,
        templateId: input.templateId,
        status,
        error: reason,
      });
      return { status, error: reason } satisfies DmResult;
    }
  });
}

export function logDuplicateDm(user: User, originGuildId: string | null, templateId: number | null): void {
  logOutreach({
    userId: user.id,
    username: user.tag,
    originGuildId,
    templateId,
    status: 'duplicate',
  });
}
