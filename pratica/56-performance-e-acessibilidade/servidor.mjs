// Um servidor de ficheiros estáticos mínimo para os exercícios (sem cache, para cada teste ver a
// versão atual dos ficheiros). Uso: node servidor.mjs 5182
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const raiz = import.meta.dirname;
const tipos = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

createServer((req, res) => {
  let caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (caminho.endsWith('/')) caminho += 'index.html';
  const ficheiro = join(raiz, caminho);
  if (!ficheiro.startsWith(raiz) || !existsSync(ficheiro) || statSync(ficheiro).isDirectory()) {
    res.writeHead(404).end('Não encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': tipos[extname(ficheiro)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  createReadStream(ficheiro).pipe(res);
}).listen(Number(process.argv[2] ?? 5182), 'localhost');
