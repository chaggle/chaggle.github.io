
import fs from 'node:fs';
import path from 'node:path';
const postsRoot = '/Users/chaggle/blog/source/_posts';
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
const files = walk(postsRoot);
console.log('文章总数:', files.length);
const fieldCounts = {};
const multiCategory = [];
const dateFormats = new Set();
const special = { noFm: [], weirdDate: [] };
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) { special.noFm.push(f); continue; }
  const fm = m[1];
  for (const line of fm.split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z_][\w]*)\s*:/);
    if (km) fieldCounts[km[1]] = (fieldCounts[km[1]] || 0) + 1;
  }
  const cat = fm.match(/^categories\s*:\s*\[([^\]]*)\]/m);
  if (cat && cat[1].split(',').filter(s => s.trim()).length > 1) multiCategory.push(path.basename(f));
  const dm = fm.match(/^date\s*:\s*(.+)$/m);
  if (dm) dateFormats.add(dm[1].trim());
}
console.log('=== front matter 字段出现次数 ===');
console.log(Object.entries(fieldCounts).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+': '+v).join('\n'));
console.log('=== 多分类文章数 ===', multiCategory.length);
console.log(multiCategory.slice(0, 10).join('\n'));
console.log('=== date 格式样本 ===');
console.log([...dateFormats].slice(0, 10).join('\n'));
console.log('=== 无 front matter ===');
console.log(special.noFm.length ? special.noFm.join('\n') : '(无)');
