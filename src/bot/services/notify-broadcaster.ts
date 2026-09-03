import type { Guild, GuildMember } from 'discord.js';
import { client } from '../discord-client';
import { getGuildConfig } from '../../db/repo-guilds';
import {
  finishCampaign,
  getSubscriber,
  hasCampaignDelivery,
  listActiveSubscribers,
  recordCampaignSend,
  unsubscribeNotify,
  type NotifyAudience,
} from '../../db/repo-notify';
import { sendTemplateDm } from './dm-sender';
import type { TemplatePayload } from '../../shared/template-types';

export interface CampaignRunSummary {
  total: number;
  sent: number;
  blocked: number;
  failed: number;
  skipped: number;
}

export interface CampaignRunInput {
  campaignId: number;
  guildId: string;
  payload: TemplatePayload;
  templateId: number | null;
  audience: NotifyAudience;
  roleId: string | null;
}

// Một đợt tại một thời điểm: hàng đợi DM đã giãn nhịp sẵn, chạy hai đợt song song
// chỉ làm tiến độ khó đọc và dễ gửi chồng nội dung cho cùng một người.
let runningCampaignId: number | null = null;

export function runningCampaign(): number | null {
  return runningCampaignId;
}

/**
 * Danh sách người nhận.
 * - 'role': ai đang giữ role thông báo thì nhận. Việc có role chính là bằng chứng
 *   đồng ý, nên role đó phải là role người dùng tự nhận được.
 * - 'subscribers': chỉ người đã tự bấm nút đăng ký trong DB.
 * Bot bị loại ở cả hai nhánh vì bot không nhận DM.
 */
export async function resolveRecipients(
  guild: Guild,
  input: Pick<CampaignRunInput, 'guildId' | 'audience' | 'roleId'>,
): Promise<GuildMember[]> {
  const members = await guild.members.fetch();

  if (input.audience === 'role') {
    const role = input.roleId ? guild.roles.cache.get(input.roleId) : null;
    if (!role) throw new Error('Role thông báo không còn tồn tại — chọn lại trong dashboard');
    return [...role.members.values()].filter((member) => !member.user.bot);
  }

  const recipients: GuildMember[] = [];
  for (const row of listActiveSubscribers(input.guildId)) {
    const member = members.get(row.user_id);
    if (!member) {
      // Rời server là hết bối cảnh đã đồng ý, gỡ khỏi danh sách luôn.
      unsubscribeNotify(input.guildId, row.user_id);
      continue;
    }
    if (!member.user.bot) recipients.push(member);
  }
  return recipients;
}

/**
 * Gửi nội dung cho nhóm người nhận đã chọn. Bỏ qua người đã nhận ở lần chạy
 * trước và người đã bấm huỷ nhận — kể cả khi họ vẫn còn role.
 */
export async function runNotifyCampaign(input: CampaignRunInput): Promise<CampaignRunSummary> {
  if (runningCampaignId !== null) {
    throw new Error(`Đợt #${runningCampaignId} đang chạy, đợi xong rồi gửi tiếp`);
  }

  const guild = client.guilds.cache.get(input.guildId);
  if (!guild) throw new Error('Bot không ở trong server này');

  const config = getGuildConfig(input.guildId);
  const inviteUrl = config.invite_code ? `https://discord.gg/${config.invite_code}` : undefined;

  runningCampaignId = input.campaignId;
  const summary: CampaignRunSummary = { total: 0, sent: 0, blocked: 0, failed: 0, skipped: 0 };

  try {
    const recipients = await resolveRecipients(guild, input);
    summary.total = recipients.length;

    for (const member of recipients) {
      // Đã nhận rồi thì giữ nguyên bản ghi 'sent', không ghi đè bằng 'skipped'.
      if (hasCampaignDelivery(input.campaignId, member.id)) {
        summary.skipped += 1;
        continue;
      }

      // Đọc lại từng người vì một đợt có thể chạy hàng chục phút, ai bấm huỷ
      // giữa đợt phải được tôn trọng ngay.
      if (getSubscriber(input.guildId, member.id)?.unsubscribed_at) {
        recordCampaignSend(input.campaignId, member.id, 'skipped');
        summary.skipped += 1;
        continue;
      }

      const result = await sendTemplateDm({
        user: member.user,
        payload: input.payload,
        templateId: input.templateId,
        originGuildId: input.guildId,
        buildOptions: { includeNotifyOptOut: true },
        context: {
          userMention: `<@${member.id}>`,
          userName: member.user.username,
          userId: member.id,
          serverName: guild.name,
          memberCount: guild.memberCount,
          sourceLabel: config.source_label ?? undefined,
          inviteUrl,
        },
      });

      recordCampaignSend(input.campaignId, member.id, result.status);
      if (result.status === 'sent') summary.sent += 1;
      else if (result.status === 'blocked_dm') summary.blocked += 1;
      else summary.failed += 1;
    }
  } finally {
    runningCampaignId = null;
    finishCampaign(input.campaignId);
  }

  console.log(
    `[notify] Đợt #${input.campaignId} (${input.audience}): gửi ${summary.sent}/${summary.total}, ` +
      `chặn DM ${summary.blocked}, lỗi ${summary.failed}, bỏ qua ${summary.skipped}`,
  );
  return summary;
}
