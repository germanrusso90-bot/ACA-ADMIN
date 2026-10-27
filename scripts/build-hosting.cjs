// Builds dist/ for Firebase Hosting with only what the published app needs:
// the root index.html (the published copy) and the vendored libraries. The
// candidate in revision/, forms, tools and documentation are never published.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), dist = path.join(root, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist);
fs.copyFileSync(path.join(root, 'index.html'), path.join(dist, 'index.html'));
fs.cpSync(path.join(root, 'vendor'), path.join(dist, 'vendor'), { recursive: true });
const files = [];
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => e.isDirectory() ? walk(path.join(dir, e.name)) : files.push(path.relative(dist, path.join(dir, e.name)).replace(/\\/g, '/')));
walk(dist);
console.log('dist/ listo para publicar:', files.join(', '));
