import { db, nowIso, toSqliteBool } from './database';

export interface GuildRow {
  id: string;
  name: string;
  icon: string | null;
  member_count: number;
  owner_id: string | null;
  joined_at: string;
  left_at: string | null;
}

export interface GuildConfigRow {
  guild_id: string;
  source_label: string | null;
  invite_code: string | null;
  panel_template_id: number | null;
  dm_template_id: number | null;
  welcome_template_id: number | null;
  welcome_dm_enabled: number;
  notes: string | null;
  updated_at: string | null;
}

export interface GuildConfigInput {
  sourceLabel?: string | null;
  inviteCode?: string | null;
  panelTemplateId?: number | null;
  dmTemplateId?: number | null;
  welcomeTemplateId?: number | null;
  welcomeDmEnabled?: boolean;
  notes?: string | null;
}

const upsertGuildStatement = db.prepare(`
  INSERT INTO guilds (id, name, icon, member_count, owner_id, joined_at, left_at)
  VALUES (?, ?, ?, ?, ?, ?, NULL)
  ON CONFLICT (id) DO UPDATE SET
    name = excluded.name,
    icon = excluded.icon,
    member_count = excluded.member_count,
    owner_id = excluded.owner_id,
    left_at = NULL
`);

export function upsertGuild(guild: {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string | null;
}): void {
  upsertGuildStatement.run(
    guild.id,
    guild.name,
    guild.icon,
    guild.memberCount,
    guild.ownerId,
    nowIso(),
  );
}

export function markGuildLeft(guildId: string): void {
  db.prepare('UPDATE guilds SET left_at = ? WHERE id = ?').run(nowIso(), guildId);
}

export function listGuilds(includeLeft = false): GuildRow[] {
  const sql = includeLeft
    ? 'SELECT * FROM guilds ORDER BY name COLLATE NOCASE'
    : 'SELECT * FROM guilds WHERE left_at IS NULL ORDER BY name COLLATE NOCASE';
  return db.prepare(sql).all() as unknown as GuildRow[];
}

export function getGuild(guildId: string): GuildRow | null {
  const row = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
  return (row as unknown as GuildRow) ?? null;
}

export function getGuildConfig(guildId: string): GuildConfigRow {
  const row = db.prepare('SELECT * FROM guild_config WHERE guild_id = ?').get(guildId);
  if (row) return row as unknown as GuildConfigRow;
  return {
    guild_id: guildId,
    source_label: null,
    invite_code: null,
    panel_template_id: null,
    dm_template_id: null,
    welcome_template_id: null,
    welcome_dm_enabled: 0,
    notes: null,
    updated_at: null,
  };
}

/** Ghi config theo kiểu patch: field không truyền thì giữ giá trị cũ. */
export function saveGuildConfig(guildId: string, input: GuildConfigInput): GuildConfigRow {
  const current = getGuildConfig(guildId);
  const merged = {
    sourceLabel: input.sourceLabel ?? current.source_label,
    inviteCode: input.inviteCode ?? current.invite_code,
    panelTemplateId: input.panelTemplateId ?? current.panel_template_id,
    dmTemplateId: input.dmTemplateId ?? current.dm_template_id,
    welcomeTemplateId: input.welcomeTemplateId ?? current.welcome_template_id,
    welcomeDmEnabled:
      input.welcomeDmEnabled === undefined
        ? current.welcome_dm_enabled
        : toSqliteBool(input.welcomeDmEnabled),
    notes: input.notes ?? current.notes,
  };

  db.prepare(
    `INSERT INTO guild_config (guild_id, source_label, invite_code, panel_template_id,
       dm_template_id, welcome_template_id, welcome_dm_enabled, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (guild_id) DO UPDATE SET
       source_label = excluded.source_label,
       invite_code = excluded.invite_code,
       panel_template_id = excluded.panel_template_id,
       dm_template_id = excluded.dm_template_id,
       welcome_template_id = excluded.welcome_template_id,
       welcome_dm_enabled = excluded.welcome_dm_enabled,
       notes = excluded.notes,
       updated_at = excluded.updated_at`,
  ).run(
    guildId,
    merged.sourceLabel,
    merged.inviteCode,
    merged.panelTemplateId,
    merged.dmTemplateId,
    merged.welcomeTemplateId,
    merged.welcomeDmEnabled,
    merged.notes,
    nowIso(),
  );

  return getGuildConfig(guildId);
}
