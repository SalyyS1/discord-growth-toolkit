import { registerGuildEvents } from './guild-events';
import { registerInteractionEvents } from './interaction-events';
import { registerInviteEvents } from './invite-events';
import { registerMemberEvents } from './member-events';

export function registerBotEvents(): void {
  registerGuildEvents();
  registerMemberEvents();
  registerInviteEvents();
  registerInteractionEvents();
}
