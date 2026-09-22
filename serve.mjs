// Minimal static server for the repair work. Spare port; never touches the running hub.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8137);

createServer((req, res) => {
  const name = (req.url || '/').split('?')[0].replace(/^\//, '') || 'game.html';
  const path = join(HERE, name);
  if (!existsSync(path) || name.includes('..')) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, {
    'Content-Type': name.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  res.end(readFileSync(path));
}).listen(PORT, '127.0.0.1', () => console.log(`serving ${HERE} on http://127.0.0.1:${PORT}`));
