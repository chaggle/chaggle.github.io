const html = require('fs').readFileSync('dist/posts/2026/08/14/agent-harness-learning-guide/index.html', 'utf8');
const i = html.indexOf('giscus');
console.log(html.slice(i - 100, i + 1300));