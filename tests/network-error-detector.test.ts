import assert from 'node:assert/strict';
import test from 'node:test';

import { isNetworkError } from '../src/shared/network-error-detector';

test('lỗi mạng tạm thời được nhận diện để process không chết theo', () => {
  // Đúng lỗi đã làm sập bot: ws ném ra khi handshake gateway quá hạn.
  assert.equal(isNetworkError(new Error('Opening handshake has timed out')), true);
  assert.equal(isNetworkError(new Error('read ECONNRESET')), true);
  assert.equal(isNetworkError(new Error('getaddrinfo EAI_AGAIN gateway.discord.gg')), true);
  assert.equal(isNetworkError(new Error('socket hang up')), true);
});

test('lỗi lập trình vẫn phải làm process thoát', () => {
  assert.equal(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'id')")), false);
  assert.equal(isNetworkError(new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed')), false);
  assert.equal(isNetworkError('không phải Error'), false);
  assert.equal(isNetworkError(undefined), false);
});
