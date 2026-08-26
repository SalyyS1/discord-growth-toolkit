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
