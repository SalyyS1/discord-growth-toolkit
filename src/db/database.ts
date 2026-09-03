import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env';

const databasePath = resolve(process.cwd(), env.databaseFile);
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

// WAL trả về một row nên phải dùng prepare, exec() dành cho DDL.
db.prepare('PRAGMA journal_mode = WAL').get();
db.exec('PRAGMA foreign_keys = ON');

const schemaFile = fileURLToPath(new URL('./schema.sql', import.meta.url));
db.exec(readFileSync(schemaFile, 'utf8'));

/**
 * CREATE TABLE IF NOT EXISTS không thêm cột vào bảng đã tồn tại, nên cột mới
 * phải vá tay cho DB đã tạo từ trước. Khai báo trong schema.sql là dành cho DB mới.
 */
function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[];
  if (columns.some((existing) => existing.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn('notify_campaigns', 'audience', "TEXT NOT NULL DEFAULT 'subscribers'");
ensureColumn('notify_campaigns', 'role_id', 'TEXT');

/** node:sqlite chỉ nhận null/number/bigint/string/Uint8Array — boolean phải đổi tay. */
export function toSqliteBool(value: boolean): number {
  return value ? 1 : 0;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Mốc thời gian ISO cách hiện tại `days` ngày, dùng cho query retention. */
export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
