import assert from 'node:assert/strict';
import test from 'node:test';

// check-env đọc process.env lúc gọi, không phụ thuộc config/env, nên set trực tiếp được.
const { findEnvWarnings } = await import('../src/config/check-env');

function withEnv(values: Record<string, string | undefined>, run: () => void): void {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) {
    saved.set(key, process.env[key]);
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('cấu hình mặc định không có cảnh báo nào', () => {
  withEnv(
    { PUBLIC_BASE_URL: undefined, PORT: undefined, HOST: undefined, DM_INTERVAL_MS: undefined },
    () => assert.deepEqual(findEnvWarnings(), []),
  );
});

test('lệch cổng giữa PUBLIC_BASE_URL và PORT bị bắt', () => {
  withEnv({ PUBLIC_BASE_URL: 'http://localhost:3000', PORT: '8080' }, () => {
    const warnings = findEnvWarnings();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /redirect_uri/);
  });
});

test('https không cần khai cổng vẫn được coi là khớp', () => {
  withEnv({ PUBLIC_BASE_URL: 'https://growth.example.com', PORT: '443' }, () =>
    assert.deepEqual(findEnvWarnings(), []),
  );
});

test('domain ngoài chạy http bị cảnh báo vì cookie mất cờ Secure', () => {
  withEnv({ PUBLIC_BASE_URL: 'http://growth.example.com', PORT: '80' }, () => {
    const warnings = findEnvWarnings();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /Secure/);
  });
});

test('mở HOST ra mạng nhưng base url còn localhost bị bắt', () => {
  withEnv({ PUBLIC_BASE_URL: 'http://localhost:3000', PORT: '3000', HOST: '0.0.0.0' }, () => {
    const warnings = findEnvWarnings();
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]!, /máy khác/);
  });
});

test('URL sai định dạng và nhịp DM quá nhanh đều được báo', () => {
  withEnv({ PUBLIC_BASE_URL: 'localhost:3000', DM_INTERVAL_MS: '200' }, () => {
    const warnings = findEnvWarnings();
    assert.equal(warnings.length, 2);
    assert.match(warnings[0]!, /không phải URL hợp lệ/);
    assert.match(warnings[1]!, /spam/);
  });
});
