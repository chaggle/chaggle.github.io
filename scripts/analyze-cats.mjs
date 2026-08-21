import fs from 'node:fs';
import path from 'node:path';
const root = '/Users/chaggle/blog/source/_posts';
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}
const catStat = {};
const secondCats = {};
const multi = [];
for (const f of walk(root)) {
  const raw = fs.readFileSync(f, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) continue;
  const fm = m[1];
  const cm = fm.match(/^categories\s*:\s*\[([^\]]*)\]/m);
  if (!cm) continue;
  const cats = cm[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  if (cats.length === 0) continue;
  catStat[cats[0]] = (catStat[cats[0]] || 0) + 1;
  if (cats.length > 1) {
    multi.push(f);
    for (const c of cats.slice(1)) secondCats[c] = (secondCats[c] || 0) + 1;
  }
}
console.log('=== 主分类统计 ===');
console.log(Object.entries(catStat).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+': '+v).join('\n'));
console.log('=== 多分类文章数 ===', multi.length);
console.log('=== 次要分类统计 ===');
console.log(Object.entries(secondCats).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+': '+v).join('\n'));
const ghAdv = {};
for (const f of walk(root)) {
  const raw = fs.readFileSync(f, 'utf8');
  const mm = raw.matchAll(/^> \[!(\w+)\]/gm);
  for (const x of mm) ghAdv[x[1]] = (ghAdv[x[1]] || 0) + 1;
}
console.log('=== GitHub admonition (> [!X]) 用法 ===');
console.log(Object.keys(ghAdv).length ? JSON.stringify(ghAdv) : '(无)');
let inline = 0;
const samples = [];
for (const f of walk(root)) {
  const raw = fs.readFileSync(f, 'utf8');
  const m2 = raw.match(/\{% note [a-z]+ %\}([^\n]{0,60})\{% endnote %\}/);
  if (m2) {
    inline++;
    if (samples.length < 4) samples.push('INLINE in ' + f.split('/').pop() + ': ' + JSON.stringify(m2[0].slice(0, 100)));
  }
  const m = raw.match(/\{% note [a-z]+ %\}\n([\s\S]{0,100}?)\n\{% endnote %\}/);
  if (m && samples.length < 6) samples.push('BLOCK in ' + f.split('/').pop() + ':\n' + m[0].slice(0, 140));
}
console.log('=== 行内 note 数量 ===', inline);
console.log('=== note 样例 ===');
console.log(samples.join('\n---\n'));
let unbalanced = 0;
for (const f of walk(root)) {
  const raw = fs.readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '');
  const opens = (raw.match(/\{% note/g) || []).length;
  const closes = (raw.match(/\{% endnote/g) || []).length;
  if (opens !== closes) { unbalanced++; console.log('不平衡:', f, opens, closes); }
}
console.log('=== 开闭不平衡文件数 ===', unbalanced);
