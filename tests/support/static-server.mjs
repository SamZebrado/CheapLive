import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const androidWebRoot = path.join(repoRoot, 'android-capture/app/src/main/assets/web');
const port = Number(process.env.CHEAPLIVE_TEST_PORT);
if (!Number.isInteger(port) || port <= 0) throw new Error('CHEAPLIVE_TEST_PORT is required');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.task', 'application/octet-stream'],
  ['.wasm', 'application/wasm'],
]);

function safeJoin(root, relativePath) {
  const target = path.resolve(root, `.${relativePath}`);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

function resolveRequest(pathname) {
  const routeRoots = [
    ['/capture', path.join(androidWebRoot, 'capture'), '/index.html'],
    ['/receiver', path.join(androidWebRoot, 'receiver'), '/index.html'],
    ['/control', path.join(androidWebRoot, 'control'), '/index.html'],
    ['/black-screen', path.join(androidWebRoot, 'black-screen'), '/index.html'],
    ['/demo', path.join(androidWebRoot, 'demo'), '/demo.html'],
  ];
  for (const [prefix, root, defaultFile] of routeRoots) {
    if (pathname === prefix || pathname === `${prefix}/`) return safeJoin(root, defaultFile);
    if (pathname.startsWith(`${prefix}/`)) return safeJoin(root, pathname.slice(prefix.length));
  }
  if (pathname.startsWith('/assets/')) {
    return safeJoin(path.join(androidWebRoot, 'receiver'), pathname.slice('/assets'.length));
  }
  if (pathname.startsWith('/web/')) {
    return safeJoin(androidWebRoot, pathname.slice('/web'.length));
  }
  return safeJoin(repoRoot, pathname === '/' ? '/index.html' : pathname);
}

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
  let filePath = resolveRequest(pathname);
  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes.get(path.extname(filePath)) ?? 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CheapLive test server ready on ${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
