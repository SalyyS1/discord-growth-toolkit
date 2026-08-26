import type { Guild } from 'discord.js';

interface CachedInvite {
  uses: number;
  inviterId: string | null;
  inviterTag: string | null;
}

export interface ResolvedInvite {
  code: string;
  inviterId: string | null;
  inviterTag: string | null;
  /** true khi phải đoán vì có nhiều invite cùng tăng hoặc dùng vanity URL. */
  uncertain: boolean;
}

/** guildId -> code -> lần dùng đã biết. */
const cache = new Map<string, Map<string, CachedInvite>>();
const vanityUses = new Map<string, number>();

async function readInvites(guild: Guild): Promise<Map<string, CachedInvite> | null> {
  try {
    const invites = await guild.invites.fetch();
    const snapshot = new Map<string, CachedInvite>();
    for (const invite of invites.values()) {
      snapshot.set(invite.code, {
        uses: invite.uses ?? 0,
        inviterId: invite.inviter?.id ?? null,
        inviterTag: invite.inviter?.tag ?? null,
      });
    }
    return snapshot;
  } catch {
    // Thiếu quyền Manage Guild — không quy nguồn được ở guild này.
    return null;
  }
}

async function readVanityUses(guild: Guild): Promise<number | null> {
  if (!guild.features.includes('VANITY_URL')) return null;
  try {
    const data = await guild.fetchVanityData();
    return data.uses ?? null;
  } catch {
    return null;
  }
}

export async function primeGuildInvites(guild: Guild): Promise<boolean> {
  const snapshot = await readInvites(guild);
  if (!snapshot) return false;
  cache.set(guild.id, snapshot);
  const vanity = await readVanityUses(guild);
  if (vanity !== null) vanityUses.set(guild.id, vanity);
  return true;
}

export function forgetGuildInvites(guildId: string): void {
  cache.delete(guildId);
  vanityUses.delete(guildId);
}

export function trackNewInvite(
  guildId: string,
  code: string,
  uses: number,
  inviterId: string | null,
  inviterTag: string | null,
): void {
  const guildCache = cache.get(guildId) ?? new Map<string, CachedInvite>();
  guildCache.set(code, { uses, inviterId, inviterTag });
  cache.set(guildId, guildCache);
}

export function untrackInvite(guildId: string, code: string): void {
  cache.get(guildId)?.delete(code);
}

/**
 * So sánh số lần dùng trước/sau khi có người join để tìm invite đã được dùng.
 * Trả về null nếu không xác định được (thiếu quyền, invite bị xoá ngay, …).
 */
export async function resolveUsedInvite(guild: Guild): Promise<ResolvedInvite | null> {
  const before = cache.get(guild.id) ?? new Map<string, CachedInvite>();
  const after = await readInvites(guild);

  if (!after) return null;

  const candidates: ResolvedInvite[] = [];
  for (const [code, current] of after) {
    const previous = before.get(code);
    const previousUses = previous?.uses ?? 0;
    if (current.uses > previousUses) {
      candidates.push({
        code,
        inviterId: current.inviterId,
        inviterTag: current.inviterTag,
        uncertain: false,
      });
    }
  }

  cache.set(guild.id, after);

  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length > 1) return { ...candidates[0]!, uncertain: true };

  // Không invite thường nào tăng: thử vanity URL.
  const vanity = await readVanityUses(guild);
  if (vanity !== null) {
    const previousVanity = vanityUses.get(guild.id) ?? 0;
    vanityUses.set(guild.id, vanity);
    if (vanity > previousVanity && guild.vanityURLCode) {
      return {
        code: guild.vanityURLCode,
        inviterId: null,
        inviterTag: null,
        uncertain: false,
      };
    }
  }

  return null;
}
