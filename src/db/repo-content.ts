import { db, nowIso } from './database';
import type { TemplateKind, TemplatePayload } from '../shared/template-types';

export interface TemplateRow {
  id: number;
  name: string;
  kind: TemplateKind;
  payload: string;
  created_at: string;
  updated_at: string;
}

export interface Template {
  id: number;
  name: string;
  kind: TemplateKind;
  payload: TemplatePayload;
  createdAt: string;
  updatedAt: string;
}

function hydrate(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    payload: JSON.parse(row.payload) as TemplatePayload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTemplates(kind?: TemplateKind): Template[] {
  const rows = kind
    ? db.prepare('SELECT * FROM templates WHERE kind = ? ORDER BY updated_at DESC').all(kind)
    : db.prepare('SELECT * FROM templates ORDER BY updated_at DESC').all();
  return (rows as unknown as TemplateRow[]).map(hydrate);
}

export function getTemplate(id: number): Template | null {
  const row = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  return row ? hydrate(row as unknown as TemplateRow) : null;
}

export function createTemplate(input: {
  name: string;
  kind: TemplateKind;
  payload: TemplatePayload;
}): Template {
  const timestamp = nowIso();
  const result = db
    .prepare(
      'INSERT INTO templates (name, kind, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(input.name, input.kind, JSON.stringify(input.payload), timestamp, timestamp);
  return getTemplate(Number(result.lastInsertRowid))!;
}

export function updateTemplate(
  id: number,
  input: { name?: string; kind?: TemplateKind; payload?: TemplatePayload },
): Template | null {
  const existing = getTemplate(id);
  if (!existing) return null;
  db.prepare('UPDATE templates SET name = ?, kind = ?, payload = ?, updated_at = ? WHERE id = ?').run(
    input.name ?? existing.name,
    input.kind ?? existing.kind,
    JSON.stringify(input.payload ?? existing.payload),
    nowIso(),
    id,
  );
  return getTemplate(id);
}

export function deleteTemplate(id: number): boolean {
  return db.prepare('DELETE FROM templates WHERE id = ?').run(id).changes > 0;
}

export interface PublishedMessageRow {
  id: number;
  guild_id: string | null;
  channel_id: string;
  message_id: string;
  template_id: number | null;
  mode: string;
  webhook_url: string | null;
  created_at: string;
}

export function recordPublishedMessage(input: {
  guildId: string | null;
  channelId: string;
  messageId: string;
  templateId: number | null;
  mode: 'bot' | 'webhook';
  webhookUrl?: string | null;
}): void {
  db.prepare(
    `INSERT INTO published_messages
       (guild_id, channel_id, message_id, template_id, mode, webhook_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.guildId,
    input.channelId,
    input.messageId,
    input.templateId,
    input.mode,
    input.webhookUrl ?? null,
    nowIso(),
  );
}

export function listPublishedMessages(limit = 50): PublishedMessageRow[] {
  return db
    .prepare('SELECT * FROM published_messages ORDER BY created_at DESC LIMIT ?')
    .all(limit) as unknown as PublishedMessageRow[];
}

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}
