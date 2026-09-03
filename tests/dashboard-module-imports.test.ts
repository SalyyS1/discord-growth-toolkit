import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * public/ không có build step nên đường dẫn import sai chỉ lộ ra khi mở browser.
 * Hai test này bắt lỗi đó ngay khi chạy npm test.
 */
function listFiles(directory: string, extension: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = resolve(directory, entry);
    if (statSync(full).isDirectory()) return listFiles(full, extension);
    return full.endsWith(extension) ? [full] : [];
  });
}

const listJsFiles = (directory: string): string[] => listFiles(directory, '.js');

test('mọi import tương đối trong dashboard trỏ tới file có thật', () => {
  const files = listJsFiles(resolve('public/js'));
  assert.ok(files.length >= 10, 'phải quét được các module dashboard');

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+'([^']+)'/g)) {
      const target = match[1]!;
      if (!target.startsWith('.')) continue;
      const resolved = resolve(dirname(file), target);
      assert.ok(existsSync(resolved), `${file}: import '${target}' không tồn tại`);
    }
  }
});

test('mỗi route trong app.js có đúng một nav item trong index.html', () => {
  const appSource = readFileSync(resolve('public/js/app.js'), 'utf8');
  const html = readFileSync(resolve('public/index.html'), 'utf8');

  const routesBlock = /const ROUTES = \{([\s\S]*?)\};/.exec(appSource)?.[1] ?? '';
  const routes = [...routesBlock.matchAll(/^\s*(\w+):/gm)].map((match) => match[1]!);
  const navRoutes = [...html.matchAll(/data-route="([^"]+)"/g)].map((match) => match[1]!);

  assert.ok(routes.length >= 4, 'phải đọc được danh sách route');
  assert.deepEqual([...routes].sort(), [...navRoutes].sort());
});

test('mọi class dùng trong dashboard đều có định nghĩa trong CSS', () => {
  const css = listFiles(resolve('public/css'), '.css')
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]!));

  const missing: string[] = [];
  for (const file of listFiles(resolve('public/js'), '.js')) {
    const source = readFileSync(file, 'utf8');
    // Chỉ xét class tĩnh; chuỗi có ${} thì phần động không kiểm được ở đây.
    for (const match of source.matchAll(/class: '([^']*)'/g)) {
      for (const name of match[1]!.split(/\s+/).filter(Boolean)) {
        if (!defined.has(name)) missing.push(`${file}: .${name}`);
      }
    }
  }

  assert.deepEqual(missing, [], `class chưa có CSS:\n${missing.join('\n')}`);
});
