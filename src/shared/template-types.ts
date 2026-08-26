/** announcement = đăng lên channel, panel = có nút opt-in, dm/welcome = gửi riêng. */
export type TemplateKind = 'announcement' | 'panel' | 'dm' | 'welcome';

export interface EmbedFieldSpec {
  name: string;
  value: string;
  inline?: boolean;
}

export interface EmbedSpec {
  title?: string;
  url?: string;
  description?: string;
  /** Hex dạng "#5865F2". */
  color?: string;
  authorName?: string;
  authorIconUrl?: string;
  authorUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  footerText?: string;
  footerIconUrl?: string;
  showTimestamp?: boolean;
  fields: EmbedFieldSpec[];
}

export interface LinkButtonSpec {
  label: string;
  url: string;
  /** Unicode hoặc emoji server dạng <:name:id> / <a:name:id>. */
  emoji?: string;
}

export interface OptInButtonSpec {
  label: string;
  emoji?: string;
  style: 'primary' | 'success' | 'secondary';
  /** Text ephemeral trả lại cho user sau khi bấm. */
  ackMessage?: string;
}

export interface TemplatePayload {
  content?: string;
  embeds: EmbedSpec[];
  linkButtons: LinkButtonSpec[];
  optInButton?: OptInButtonSpec | null;
}

export interface PlaceholderContext {
  userMention?: string;
  userName?: string;
  userId?: string;
  serverName?: string;
  memberCount?: number;
  inviteUrl?: string;
  sourceLabel?: string;
}

export function createEmptyEmbed(): EmbedSpec {
  return { color: '#5865F2', fields: [], showTimestamp: false };
}

export function createEmptyPayload(): TemplatePayload {
  return { content: '', embeds: [createEmptyEmbed()], linkButtons: [], optInButton: null };
}

/** Dùng cho phần trợ giúp trong dashboard. */
export const PLACEHOLDERS: { token: string; description: string }[] = [
  { token: '{user}', description: 'Mention người nhận (@tên)' },
  { token: '{user.name}', description: 'Tên người nhận, không mention' },
  { token: '{user.id}', description: 'ID người nhận' },
  { token: '{server}', description: 'Tên server đang gửi' },
  { token: '{members}', description: 'Số member của server đang gửi' },
  { token: '{invite}', description: 'Link invite gắn với nguồn đó' },
  { token: '{source}', description: 'Nhãn nguồn trong thống kê' },
];

export const DISCORD_LIMITS = {
  content: 2000,
  embedTitle: 256,
  embedDescription: 4096,
  embedFieldName: 256,
  embedFieldValue: 1024,
  embedFields: 25,
  embedFooter: 2048,
  embedAuthorName: 256,
  embedTotal: 6000,
  embeds: 10,
  buttonsPerRow: 5,
  buttonLabel: 80,
} as const;
