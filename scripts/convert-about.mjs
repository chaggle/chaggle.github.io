import fs from 'node:fs';
import path from 'node:path';
const DST = '/Users/chaggle/blog-fuwari';

// 1. about 页转换（note -> directive）
const raw = fs.readFileSync('/Users/chaggle/blog/source/about/index.md', 'utf8');
const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim();
const MAP = { success: 'tip', info: 'note', danger: 'caution', warning: 'warning', primary: 'note' };
const converted = body
  .replace(/\{% note (primary|success|info|warning|danger) %\}/g, (m, t) => ':::' + (MAP[t] || 'note'))
  .replace(/\{% endnote %\}/g, ':::') + '\n';
fs.writeFileSync(path.join(DST, 'src/content/spec/about.md'), converted + '\n');
console.log('about.md 写入完成, 长度:', converted.length);
console.log(converted.slice(0, 200));

// 2. 删除模板演示文章
const posts = path.join(DST, 'src/content/posts');
for (const name of ['draft.md', 'expressive-code.md', 'markdown.md', 'markdown-extended.md', 'video.md', 'guide']) {
  const p = path.join(posts, name);
  if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); console.log('删除演示文章:', name); }
}

// 3. 删除模板演示头像/横幅（改用 chaggle.png）
for (const f of ['src/assets/images/demo-avatar.png', 'src/assets/images/demo-banner.png']) {
  const p = path.join(DST, f);
  if (fs.existsSync(p)) { fs.rmSync(p, { force: true }); console.log('删除演示资源:', f); }
}
console.log('检查 public/img:', fs.existsSync(path.join(DST, 'public/img/chaggle.png')));
