import { DiscordAPIError, type GuildMember } from 'discord.js';
import { client } from '../discord-client';
import { env } from '../../config/env';
import {
  getNotifyRoleId,
  subscribeNotify,
  unsubscribeNotify,
  type SubscribeOutcome,
} from '../../db/repo-notify';

const MISSING_PERMISSIONS = 50013;
const UNKNOWN_ROLE = 10011;

export interface SubscriptionChange {
  outcome: SubscribeOutcome;
  /** Role không gán/gỡ được thì vẫn giữ đăng ký, chỉ báo lại để admin đi sửa quyền. */
  roleWarning?: string;
}

function describeRoleError(error: unknown): string {
  if (error instanceof DiscordAPIError) {
    if (error.code === MISSING_PERMISSIONS) {
      return 'bot thiếu quyền Manage Roles, hoặc role thông báo đang nằm trên role của bot';
    }
    if (error.code === UNKNOWN_ROLE) {
      return 'role thông báo không còn tồn tại — chọn lại trong dashboard';
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Bản ghi trong DB là bằng chứng consent và là căn cứ duy nhất để gửi DM.
 * Role chỉ là mặt hiển thị (để ping trong channel), nên gán role lỗi cũng
 * không làm mất đăng ký của user.
 */
export async function subscribeMember(member: GuildMember): Promise<SubscriptionChange> {
  const outcome = subscribeNotify({
    guildId: member.guild.id,
    userId: member.id,
    username: member.user.tag,
  });

  const roleId = getNotifyRoleId();
  if (!roleId || member.roles.cache.has(roleId)) return { outcome };

  try {
    await member.roles.add(roleId, 'Tự bấm nút đăng ký nhận thông báo');
    return { outcome };
  } catch (error) {
    const roleWarning = describeRoleError(error);
    console.warn(`[notify] Không gán được role cho ${member.user.tag}: ${roleWarning}`);
    return { outcome, roleWarning };
  }
}

/** Gọi được từ cả DM lẫn trong server, nên tự tìm member ở home guild để gỡ role. */
export async function unsubscribeUser(userId: string): Promise<{
  wasActive: boolean;
  roleWarning?: string;
}> {
  const wasActive = unsubscribeNotify(env.homeGuildId, userId);

  const roleId = getNotifyRoleId();
  if (!roleId) return { wasActive };

  const guild = client.guilds.cache.get(env.homeGuildId);
  const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
  if (!member || !member.roles.cache.has(roleId)) return { wasActive };

  try {
    await member.roles.remove(roleId, 'Tự bấm nút huỷ nhận thông báo');
    return { wasActive };
  } catch (error) {
    const roleWarning = describeRoleError(error);
    console.warn(`[notify] Không gỡ được role của ${member.user.tag}: ${roleWarning}`);
    return { wasActive, roleWarning };
  }
}
