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
  /**
   * 'dm' = DM ngay nội dung gắn với server đó (panel đối tác).
   * 'subscribe' = ghi danh vào danh sách nhận thông báo của server nhà.
   * Thiếu field này thì hiểu là 'dm' để template lưu từ trước vẫn chạy như cũ.
   */
  action?: 'dm' | 'subscribe';
}

export interface TemplatePayload {
  content?: string;
  embeds: EmbedSpec[];
  linkButtons: LinkButtonSpec[];
  optInButton?: OptInButtonSpec | null;
  /**
   * Bật Components V2: Discord bỏ qua content + embeds, toàn bộ nội dung dựng
   * bằng component. Một tin đã gửi ở chế độ này không đổi lại được về embed.
   */
  useComponentsV2?: boolean;
  v2?: V2Layout;
}

/** Nội dung dạng Components V2, luôn bọc trong một container để có vạch màu. */
export interface V2Layout {
  /** Hex dạng "#5865F2" cho vạch màu bên trái container. */
  accentColor?: string;
  spoiler?: boolean;
  blocks: V2Block[];
}

export type V2Block =
  | V2TextBlock
  | V2SectionBlock
  | V2GalleryBlock
  | V2SeparatorBlock
  | V2ButtonsBlock;

export interface V2TextBlock {
  kind: 'text';
  content: string;
}

/** Section = 1-3 dòng text kèm một phụ kiện bên phải (ảnh nhỏ hoặc nút link). */
export interface V2SectionBlock {
  kind: 'section';
  lines: string[];
  accessory?: 'none' | 'thumbnail' | 'button';
  thumbnailUrl?: string;
  /** Alt text của ảnh, tối đa 1024 ký tự. */
  thumbnailDescription?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface V2GalleryItem {
  url: string;
  description?: string;
  spoiler?: boolean;
}

export interface V2GalleryBlock {
  kind: 'gallery';
  items: V2GalleryItem[];
}

export interface V2SeparatorBlock {
  kind: 'separator';
  divider?: boolean;
  spacing?: 'small' | 'large';
}

/** Chỗ đặt hàng nút; nút vẫn lấy từ linkButtons + optInButton của template. */
export interface V2ButtonsBlock {
  kind: 'buttons';
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

export function createEmptyV2Layout(): V2Layout {
  return { accentColor: '#5865F2', blocks: [{ kind: 'text', content: '' }] };
}

export function createEmptyV2Block(kind: V2Block['kind']): V2Block {
  if (kind === 'section') return { kind: 'section', lines: [''], accessory: 'none' };
  if (kind === 'gallery') return { kind: 'gallery', items: [{ url: '' }] };
  if (kind === 'separator') return { kind: 'separator', divider: true, spacing: 'small' };
  if (kind === 'buttons') return { kind: 'buttons' };
  return { kind: 'text', content: '' };
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
  /** Components V2: tính cả component lồng trong container. */
  v2Components: 40,
  v2TextTotal: 4000,
  v2GalleryItems: 10,
  v2SectionLines: 3,
  v2MediaDescription: 1024,
} as const;
