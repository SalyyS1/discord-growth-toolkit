import express from 'express';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { env } from '../config/env';
import { requireAuth } from './middleware/require-auth';
import { analyticsRoutes } from './routes/analytics-routes';
import { authRoutes } from './routes/auth-routes';
import { guildRoutes } from './routes/guild-routes';
import { inviteSourceRoutes } from './routes/invite-source-routes';
import { notifyRoutes } from './routes/notify-routes';
import { publishRoutes } from './routes/publish-routes';
import { statusRoutes } from './routes/status-routes';
import { templateRoutes } from './routes/template-routes';

const publicDirectory = fileURLToPath(new URL('../../public', import.meta.url));

export function startWebServer(): Server {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // /api/auth mở để đăng nhập được; mọi route khác đòi session của owner.
  app.use('/api/auth', authRoutes);
  app.use('/api/status', requireAuth, statusRoutes);
  app.use('/api/guilds', requireAuth, guildRoutes);
  app.use('/api/invite-sources', requireAuth, inviteSourceRoutes);
  app.use('/api/templates', requireAuth, templateRoutes);
  app.use('/api/publish', requireAuth, publishRoutes);
  app.use('/api/notify', requireAuth, notifyRoutes);
  app.use('/api/analytics', requireAuth, analyticsRoutes);

  app.use(express.static(publicDirectory));
  app.get('/', (_request, response) => response.sendFile(`${publicDirectory}/index.html`));

  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error('[web] Lỗi không bắt được:', error);
    response.status(500).json({ error: error.message });
  });

  return app.listen(env.port, env.host, () => {
    console.log(`[web] Dashboard: http://${env.host}:${env.port}`);
  });
}
