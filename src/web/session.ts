import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { env } from '../config/env';

const SESSION_COOKIE = 'growth_session';
const STATE_COOKIE = 'growth_oauth_state';
const SESSION_TTL_MS = 7 * 86_400_000;
const useSecureCookie = env.publicBaseUrl.startsWith('https://');

export interface SessionData {
  userId: string;
  username: string;
  avatar: string | null;
  expiresAt: number;
}

function sign(value: string): string {
  return createHmac('sha256', env.sessionSecret).update(value).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}

function buildCookie(name: string, value: string, maxAgeSeconds: number): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (useSecureCookie) attributes.push('Secure');
  return attributes.join('; ');
}

/** Token dạng payload.signature — không cần store phía server. */
export function setSessionCookie(response: Response, data: Omit<SessionData, 'expiresAt'>): void {
  const payload: SessionData = { ...data, expiresAt: Date.now() + SESSION_TTL_MS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${encoded}.${sign(encoded)}`;
  response.append('Set-Cookie', buildCookie(SESSION_COOKIE, token, SESSION_TTL_MS / 1000));
}

export function readSession(request: Request): SessionData | null {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;

  const separator = token.lastIndexOf('.');
  if (separator === -1) return null;

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!safeEqual(signature, sign(encoded))) return null;

  try {
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionData;
    if (!data.userId || data.expiresAt < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSessionCookie(response: Response): void {
  response.append('Set-Cookie', buildCookie(SESSION_COOKIE, '', 0));
}

/** State chống CSRF cho OAuth: nonce random lưu tạm trong cookie 10 phút. */
export function issueOauthState(response: Response): string {
  const state = randomBytes(16).toString('base64url');
  response.append('Set-Cookie', buildCookie(STATE_COOKIE, state, 600));
  return state;
}

export function consumeOauthState(request: Request, response: Response, state: string): boolean {
  const expected = parseCookies(request.headers.cookie)[STATE_COOKIE];
  response.append('Set-Cookie', buildCookie(STATE_COOKIE, '', 0));
  return Boolean(expected) && Boolean(state) && safeEqual(expected!, state);
}
