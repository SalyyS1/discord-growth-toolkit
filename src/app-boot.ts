import { Events } from 'discord.js';
import { env } from './config/env';
import { db } from './db/database';
import { client, startBot } from './bot/discord-client';
import { registerBotEvents } from './bot/events/register-bot-events';
import { isNetworkError } from './shared/network-error-detector';
import { startupSummaryLines } from './startup-banner';
import { startWebServer } from './web/web-server';

/**
 * client.login() trả về ngay khi bắt tay xong, chưa chắc đã có cache guild, nên
 * chờ ClientReady trước khi in tóm tắt. Hết hạn chờ thì vẫn chạy tiếp: dashboard
 * dùng được và chỉ báo trạng thái ở sidebar sẽ nói bot chưa online.
 */
async function waitForReady(timeoutMs: number): Promise<boolean> {
  if (client.isReady()) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    timer.unref();
    client.once(Events.ClientReady, () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/** Khởi động thật. Chỉ được import sau khi index.ts đã xác nhận env đủ. */
export async function boot(): Promise<void> {
  registerBotEvents();

  try {
    await startBot();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n  Đăng nhập Discord thất bại: ${message}`);
    console.error('  Kiểm tra DISCORD_TOKEN, và bật Server Members Intent ở Developer Portal.');
    console.error('  Hướng dẫn từng bước: mở docs/setup-guide.html\n');

    // Đóng gọn rồi để event loop tự cạn. process.exit() ngay lúc handle của ws và
    // sqlite còn đang đóng làm libuv abort kèm "Assertion failed" trên Windows —
    // dòng đó hiện ngay dưới thông báo lỗi và làm người mới cài tưởng vỡ nặng.
    await client.destroy();
    db.close();
    process.exitCode = 1;
    return;
  }

  const server = startWebServer();

  const ready = await waitForReady(20_000);
  if (ready) for (const line of startupSummaryLines()) console.log(line);
  else console.warn(`\n  Bot chưa ready sau 20s. Dashboard vẫn mở ở ${env.publicBaseUrl}\n`);

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

  // ws có thể ném lỗi handshake ngoài tầm với của discord.js khi mạng chập chờn,
  // và một 'error' event không ai nghe sẽ giết cả process. Lỗi mạng thì để
  // discord.js tự kết nối lại; lỗi khác vẫn thoát để không chạy tiếp trong
  // trạng thái không rõ ràng.
  process.on('uncaughtException', (error) => {
    if (isNetworkError(error)) {
      console.error(`[app] Lỗi kết nối: ${error.message} — chờ discord.js kết nối lại`);
      return;
    }
    console.error('[app] Lỗi không bắt được:', error);
    process.exit(1);
  });
}
