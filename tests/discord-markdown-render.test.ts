import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInline, renderMarkdown } from '../public/js/discord-markdown.js';

test('markdown cơ bản dịch sang HTML như Discord', () => {
  assert.equal(renderMarkdown('**đậm**'), '<strong>đậm</strong>');
  assert.equal(renderMarkdown('~~gạch~~'), '<s>gạch</s>');
  assert.equal(renderMarkdown('__gạch chân__'), '<u>gạch chân</u>');
  assert.match(renderMarkdown('# Tiêu đề'), /^<h1>Tiêu đề<\/h1>$/);
  assert.match(renderMarkdown('### Nhỏ'), /^<h3>Nhỏ<\/h3>$/);
  assert.match(renderMarkdown('-# phụ đề'), /class="subtext"/);
  assert.match(renderMarkdown('> trích'), /<blockquote>trích<\/blockquote>/);
});

test('danh sách gạch đầu dòng gom vào một ul', () => {
  const html = renderMarkdown('- một\n- hai');
  assert.equal(html, '<ul><li>một</li><li>hai</li></ul>');
});

test('code block và inline code không bị markdown xử lý tiếp', () => {
  const html = renderMarkdown('```\n**không đậm**\n```');
  assert.match(html, /<pre><code>\*\*không đậm\*\*<\/code><\/pre>/);
  assert.match(renderMarkdown('IP: `sukimc.me`'), /<code>sukimc\.me<\/code>/);
});

test('emoji server thành ảnh CDN đúng id', () => {
  const html = renderMarkdown('Xin chào <:tanh_plusone:1497592408316055612>');
  assert.match(html, /cdn\.discordapp\.com\/emojis\/1497592408316055612\.webp/);
  assert.match(renderMarkdown('<a:vui:123>'), /123\.gif/);
});

test('emoji đứng một mình được phóng to như Discord', () => {
  assert.match(renderMarkdown('<:tanh:123>'), /class="dc-emoji jumbo"/);
  assert.doesNotMatch(renderMarkdown('hi <:tanh:123>'), /jumbo/);
});

test('link markdown và link trần đều thành thẻ a', () => {
  assert.match(renderMarkdown('[Ghé thăm](https://sukimc.me)'), /<a href="https:\/\/sukimc\.me"/);
  assert.match(renderMarkdown('vào https://discord.gg/sukimc nhé'), /<a href="https:\/\/discord\.gg\/sukimc"/);
});

test('HTML người dùng nhập bị escape, không chèn được thẻ', () => {
  const html = renderMarkdown('<img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img/);
});

test('mention và spoiler được render an toàn', () => {
  assert.match(renderMarkdown('<@1234>'), /class="mention"/);
  assert.match(renderMarkdown('||bí mật||'), /class="spoiler"/);
});

test('renderInline không tạo heading hay list', () => {
  assert.equal(renderInline('# vẫn là chữ'), '# vẫn là chữ');
  assert.match(renderInline('**đậm** <:e:1>'), /<strong>đậm<\/strong>/);
});
