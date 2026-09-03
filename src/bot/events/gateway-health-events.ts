import { Events } from 'discord.js';
import { client } from '../discord-client';

/**
 * Sức khoẻ kết nối gateway. Không có listener nào cho lỗi gateway thì một cú
 * chập mạng sẽ nổi lên thành 'error' không ai nghe và giết cả process — đã xảy
 * ra thật với "Opening handshake has timed out".
 */
export function registerGatewayHealthEvents(): void {
  client.on(Events.Error, (error) => {
    console.error(`[bot] Lỗi client: ${error.message}`);
  });

  client.on(Events.ShardError, (error, shardId) => {
    console.error(`[bot] Lỗi gateway (shard ${shardId}): ${error.message}`);
  });

  client.on(Events.ShardDisconnect, (event, shardId) => {
    console.warn(`[bot] Shard ${shardId} ngắt kết nối (code ${event.code})`);
  });

  client.on(Events.ShardReconnecting, (shardId) => {
    console.log(`[bot] Shard ${shardId} đang kết nối lại…`);
  });

  client.on(Events.ShardResume, (shardId, replayed) => {
    console.log(`[bot] Shard ${shardId} đã kết nối lại (nhận bù ${replayed} event)`);
  });
}
