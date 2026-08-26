import { env } from './config/env';
import { db } from './db/database';
import { client, startBot } from './bot/discord-client';
import { registerBotEvents } from './bot/events/register-bot-events';
import { startWebServer } from './web/web-server';

async function main(): Promise<void> {
  registerBotEvents();
  await startBot();
  const server = startWebServer();

  const shutdown = (signal: string) => {
    console.log(`\n[app] Nhận ${signal}, đang tắt...`);
    server.close();
    void client.destroy();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[app] Khởi động thất bại:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[app] Promise chưa xử lý:', reason);
});

console.log(`[app] Dashboard sẽ chạy ở ${env.publicBaseUrl}`);
