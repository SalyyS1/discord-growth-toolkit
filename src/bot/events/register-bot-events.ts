import { registerGatewayHealthEvents } from './gateway-health-events';
import { registerGuildEvents } from './guild-events';
import { registerInteractionEvents } from './interaction-events';
import { registerInviteEvents } from './invite-events';
import { registerMemberEvents } from './member-events';

export function registerBotEvents(): void {
  registerGatewayHealthEvents();
  registerGuildEvents();
  registerMemberEvents();
  registerInviteEvents();
  registerInteractionEvents();
}
