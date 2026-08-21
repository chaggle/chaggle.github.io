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
// 1. 收集所有图片引用（markdown 语法 + html img）
const refs = new Map(); // 引用 -> 次数
const htmlImgRefs = [];
for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = mdRe.exec(raw))) {
    const url = m[2].trim();
    if (/^(https?:|data:)/.test(url)) continue;
    refs.set(url, (refs.get(url) || 0) + 1);
  }
  const htmlRe = /<img[^>]+src=["']([^"']+)["']/g;
  while ((m = htmlRe.exec(raw))) {
    const url = m[1].trim();
    if (/^(https?:|data:)/.test(url)) continue;
    htmlImgRefs.push(url);
    refs.set(url, (refs.get(url) || 0) + 1);
  }
}
console.log('=== 本地图片引用 TOP 30 ===');
console.log([...refs.entries()].sort((a,b)=>b[1]-a[1]).slice(0,30).map(([k,v])=>v+'x  '+k).join('\n'));
console.log('\n=== 引用前缀归类 ===');
const prefix = {};
for (const k of refs.keys()) {
  const p = k.match(/^([^\/]*\/)/) ? k.match(/^([^\/]*\/)/)[1] : '(无前缀)';
  prefix[p] = (prefix[p] || 0) + 1;
}
console.log(Object.entries(prefix).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+': '+v).join('\n'));
// 2. 检查这些文件实际是否存在
console.log('\n=== 引用文件存在性抽查 ===');
let found = 0, missing = 0;
const missingList = [];
for (const k of refs.keys()) {
  const clean = k.split('#')[0].split('?')[0];
  const candidates = [
    path.join(postsRoot, clean),
    path.join('/Users/chaggle/blog/source', clean),
    path.join('/Users/chaggle/blog/source/_posts', clean),
  ];
  const hit = candidates.some(c => fs.existsSync(c));
  if (hit) found++; else { missing++; if (missingList.length < 15) missingList.push(k); }
}
console.log('存在:', found, ' 缺失:', missing);
console.log(missingList.join('\n'));
