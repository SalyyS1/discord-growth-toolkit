const NETWORK_ERROR_HINTS = [
  'handshake',
  'websocket',
  'econnreset',
  'econnrefused',
  'etimedout',
  'enotfound',
  'eai_again',
  'socket hang up',
  'network',
];

/**
 * Lỗi mạng tạm thời hay lỗi thật? Quyết định này định đoạt việc process sống
 * hay chết, nên tách riêng để test được.
 *
 * Nhận diện qua thông điệp vì ws, undici và node:net không dùng chung một mã lỗi.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const text = `${error.name} ${error.message}`.toLowerCase();
  return NETWORK_ERROR_HINTS.some((hint) => text.includes(hint));
}
