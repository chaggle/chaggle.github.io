import fs from 'node:fs';
import path from 'node:path';

const SRC = '/Users/chaggle/blog/source';
const DST = '/Users/chaggle/blog-fuwari';
const POSTS_SRC = path.join(SRC, '_posts');
const POSTS_DST = path.join(DST, 'src/content/posts');

const NOTE_MAP = { info: 'note', warning: 'warning', success: 'tip', danger: 'caution', primary: 'note' };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

// ---- front matter 解析：行级，支持 categories 多行块式 ----
function parseFM(fmText) {
  const lines2 = fmText.split('\n');
  const fields = {}; // name -> { inline: string|null, block: string[] }
  let current = null;
  for (const ln of lines2) {
    const m = ln.match(/^([A-Za-z_][\w]*)\s*:\s*(.*)$/);
    if (m) {
      current = m[1];
      const val = m[2].trim();
      if (val === '' || val === '[') {
        fields[current] = { inline: null, block: [val] };
      } else {
        fields[current] = { inline: val, block: null };
      }
      continue;
    }
    if (current && fields[current] && fields[current].block !== null) {
      const t = ln.trim();
      if (t === '' || /^[#\-\]"']/.test(t) || t.startsWith('-') || t.endsWith(']') || t.endsWith(',')) {
        fields[current].block.push(t);
      } else {
        current = null;
      }
    }
  }
  return fields;
}

// ---- 正文 note 转换：跳过代码围栏 ----
function convertNotes(body) {
  const out = [];
  const srcLines = body.split('\n');
  let inCode = false;
  let i = 0;
  while (i < srcLines.length) {
    const ln = srcLines[i];
    if (/^```/.test(ln.trim())) {
      inCode = !inCode;
      out.push(ln);
      i++;
      continue;
    }
    if (!inCode) {
      const open = ln.match(/^\{% note (primary|success|info|warning|danger) %\}\s*$/);
      if (open) {
        out.push(':::' + (NOTE_MAP[open[1]] || 'note'));
        i++;
        continue;
      }
      const close = /^\{% endnote %\}\s*$/.test(ln);
      if (close) {
        out.push(':::','');
        i++;
        continue;
      }
      // 行内形式 {% note X %}内容{% endnote %}
      const inl = ln.match(/^\{% note (primary|success|info|warning|danger) %\}([\s\S]*?)\{% endnote %\}\s*$/);
      if (inl) {
        out.push(':::' + (NOTE_MAP[inl[1]] || 'note'));
        out.push(inl[2]);
        out.push(':::','');
        i++;
        continue;
      }
    }
    out.push(ln);
    i++;
  }
  return out.join('\n');
}

// ---- 单个文件迁移 ----
function migratePost(srcFile, stats) {
  const raw = fs.readFileSync(srcFile, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) { stats.skipped.push(srcFile); return; }
  const fm = parseFM(m[1]);
  const body = raw.slice(m[0].length);
  const title = (fm.title && fm.title.inline) ? fm.title.inline : path.basename(srcFile, '.md');
  const dateStr = (fm.date && fm.date.inline) || '';
  const updatedStr = (fm.lastMod && fm.lastMod.inline) || dateStr;
  // categories: 第一个为 category
  let category = '';
  const catField = fm.categories;
  if (catField) {
    if (catField.inline) {
      const inner = catField.inline.replace(/^\[|\]$/g, '');
      const first = inner.split(',')[0];
      category = first ? first.trim() : '';
    } else if (catField.block && catField.block.length) {
      const first = catField.block.find(t => t.startsWith('-'));
      category = first ? first.replace(/^-\s*/, '').trim() : '';
    }
  }
  const isDraft = /^draft\s*:\s*(1|true)$/m.test(m[1]);
  // 组装新 front matter
  const fmOut = [];
  fmOut.push('---');
  fmOut.push('title: ' + title);
  if (dateStr) fmOut.push('published: ' + dateStr);
  if (updatedStr) fmOut.push('updated: ' + updatedStr);
  if (isDraft) fmOut.push('draft: true');
  if (fm.tags && fm.tags.inline) fmOut.push('tags: ' + fm.tags.inline);
  if (category) fmOut.push('category: ' + category);
  fmOut.push('---');
  const newFM = fmOut.join('\n');
  const newBody = convertNotes(body);
  // 目标路径：年/月/日/文件名
  const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  let relDir = '0000/00/00';
  if (dateMatch) relDir = dateMatch[1] + '/' + dateMatch[2] + '/' + dateMatch[3];
  const fileName = path.basename(srcFile);
  const target = path.join(POSTS_DST, relDir, fileName);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target)) { stats.conflicts.push(target); return; }
  fs.writeFileSync(target, newFM + newBody);
  stats.done.push({ src: srcFile.replace(POSTS_SRC + '/', ''), dst: target.replace(POSTS_DST + '/', ''), cat: category, date: dateStr.slice(0,10) });
  return;
}

const stats = { done: [], skipped: [], conflicts: [], imgFixes: 0 };

// 0. 清空旧内容（保留 assets）
for (const e of fs.readdirSync(POSTS_DST)) {
  if (e !== 'assets') fs.rmSync(path.join(POSTS_DST, e), { recursive: true, force: true });
}

// 1. 迁移文章
for (const f of walk(POSTS_SRC)) migratePost(f, stats);

// 2. 图片：/images 与 /img 拷贝到 public
const pub = path.join(DST, 'public');
if (fs.existsSync(path.join(SRC, 'images'))) {
  fs.cpSync(path.join(SRC, 'images'), path.join(pub, 'images'), { recursive: true });
  // 无扩展名 PNG 修复
  const noExt = path.join(pub, 'images/invest/middle-invest-20260505');
  if (fs.existsSync(noExt)) {
    fs.renameSync(noExt, noExt + '.png');
    stats.imgFixes++;
  }
}
if (fs.existsSync(path.join(SRC, 'img'))) {
  fs.cpSync(path.join(SRC, 'img'), path.join(pub, 'img'), { recursive: true });
}

// 3. 修正文章里的无扩展名图片引用
for (const s of stats.done) {
  const p = path.join(POSTS_DST, s.dst);
  let content = fs.readFileSync(p, 'utf8');
  if (content.includes('middle-invest-20260505)')) {
    content = content.replace('middle-invest-20260505)', 'middle-invest-20260505.png)');
    fs.writeFileSync(p, content);
    stats.imgFixes++;
  }
}

// 4. 报告
console.log('迁移完成:', stats.done.length, '篇');
console.log('跳过:', stats.skipped.length, stats.skipped.join(', '));
console.log('路径冲突:', stats.conflicts.length, stats.conflicts.join(', '));
console.log('图片修复:', stats.imgFixes);
const catCount = {};
for (const s of stats.done) catCount[s.cat || '(无分类)'] = (catCount[s.cat || '(无分类)'] || 0) + 1;
console.log('分类分布:', JSON.stringify(catCount, null, 0));
// 抽样打印
for (const s of stats.done.slice(0, 3)) {
  console.log('--- 样例:', s.dst);
  console.log(fs.readFileSync(path.join(POSTS_DST, s.dst), 'utf8').slice(0, 400));
}
