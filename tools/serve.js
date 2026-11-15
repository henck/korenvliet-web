// A development web server for web/, with the headers that make pages
// cross-origin isolated (needed for SharedArrayBuffer).
// usage: node tools/serve.js [port] [--no-isolation]    then open http://localhost:8083/
//   --no-isolation: don't send the headers (the game then runs on the page, as on itch.io)
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const isolate = !args.includes('--no-isolation');
const port = parseInt(args.find((a) => /^[0-9]+$/.test(a)) || '8083');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.map': 'application/json', '.t3': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff',
};

http.createServer((req, res) => {
  let url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if(url.endsWith('/')) url += 'index.html';
  let base = path.join(root, 'web');
  let file = path.normalize(path.join(base, url));
  if(!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if(err) { res.writeHead(404); res.end('Not found'); return; }
    let headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    };
    if(isolate) {
      headers['Cross-Origin-Opener-Policy'] = 'same-origin';
      headers['Cross-Origin-Embedder-Policy'] = 'require-corp';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(port, () => console.log(`Serving web/ at http://localhost:${port}/`));
