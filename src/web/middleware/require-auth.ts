import type { NextFunction, Request, Response } from 'express';
import { isOwner } from '../../config/env';
import { readSession, type SessionData } from '../session';

export interface AuthenticatedRequest extends Request {
  session?: SessionData;
}

/** Dashboard là công cụ nội bộ: chỉ ID trong DASHBOARD_OWNER_IDS được vào. */
export function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
): void {
  const session = readSession(request);
  if (!session || !isOwner(session.userId)) {
    response.status(401).json({ error: 'Chưa đăng nhập hoặc không có quyền' });
    return;
  }
  request.session = session;
  next();
}
