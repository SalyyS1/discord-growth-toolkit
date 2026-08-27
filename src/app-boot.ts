import { env } from './config/env';
import { db } from './db/database';
import { client, startBot } from './bot/discord-client';
import { registerBotEvents } from './bot/events/register-bot-events';
import { startWebServer } from './web/web-server';

/** Khởi động thật. Chỉ được import sau khi index.ts đã xác nhận env đủ. */
export async function boot(): Promise<void> {
  registerBotEvents();

  try {
    await startBot();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n  Đăng nhập Discord thất bại: ${message}`);
    console.error('  Kiểm tra DISCORD_TOKEN, và bật Server Members Intent ở Developer Portal.\n');
    process.exit(1);
  }

  const server = startWebServer();
  console.log(`[app] Mở dashboard: ${env.publicBaseUrl}`);

  const shutdown = (signal: string) => {
    console.log(`\n[app] Nhận ${signal}, đang tắt...`);
    server.close();
    void client.destroy();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('[app] Promise chưa xử lý:', reason);
  });
}
