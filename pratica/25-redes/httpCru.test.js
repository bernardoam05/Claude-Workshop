import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import { describe, it } from 'node:test';
import { pedir } from './httpCru.js';

async function servidor() {
  const vistos = [];
  const s = http.createServer(async (req, res) => {
    let corpo = '';
    for await (const c of req) corpo += c;
    vistos.push({ metodo: req.method, caminho: req.url, cabecalhos: req.headers, corpo });
    if (req.url === '/fixo') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'X-Teste': 'sim' });
      return res.end('olá mundo');
    }
    if (req.url === '/aos-bocados') {
      res.writeHead(201, { 'Content-Type': 'application/json' });   // sem Content-Length: o Node usa chunked
      res.write('{"partes":');
      res.write('[1,2,');
      return setTimeout(() => res.end('3]}'), 20);
    }
    if (req.url === '/eco') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ metodo: req.method, corpo, tipo: req.headers['content-type'] }));
    }
    res.writeHead(404).end();
  });
  s.listen(0);
  await once(s, 'listening');
  return { porta: s.address().port, vistos, fechar: () => s.close() };
}

describe('P3 · pedir (HTTP/1.1 sobre TCP)', () => {
  it('um GET simples: status, cabeçalhos em minúsculas e corpo (com acentos)', async () => {
    const s = await servidor();
    try {
      const r = await pedir({ host: '127.0.0.1', porta: s.porta, caminho: '/fixo' });
      assert.equal(r.status, 200);
      assert.equal(r.cabecalhos['x-teste'], 'sim');
      assert.equal(r.cabecalhos['content-type'], 'text/plain');
      assert.equal(r.corpo, 'olá mundo');
      assert.equal(s.vistos[0].cabecalhos.host, `127.0.0.1:${s.porta}`, 'falta o cabeçalho Host (obrigatório em HTTP/1.1)');
    } finally {
      s.fechar();
    }
  });

  it('junta um corpo enviado aos bocados (Transfer-Encoding: chunked)', async () => {
    const s = await servidor();
    try {
      const r = await pedir({ host: '127.0.0.1', porta: s.porta, caminho: '/aos-bocados' });
      assert.equal(r.status, 201);
      assert.equal(r.cabecalhos['transfer-encoding'], 'chunked');
      assert.deepEqual(JSON.parse(r.corpo), { partes: [1, 2, 3] });
    } finally {
      s.fechar();
    }
  });

  it('um POST com corpo: o Content-Length conta BYTES (o "ç" e o "ã" valem 2)', async () => {
    const s = await servidor();
    try {
      const corpo = JSON.stringify({ titulo: 'Ação' });
      const r = await pedir({
        host: '127.0.0.1', porta: s.porta, caminho: '/eco', metodo: 'POST',
        cabecalhos: { 'Content-Type': 'application/json' }, corpo,
      });
      assert.equal(r.status, 200);
      assert.deepEqual(JSON.parse(r.corpo), { metodo: 'POST', corpo, tipo: 'application/json' });
    } finally {
      s.fechar();
    }
  });

  it('um 404 continua a ser uma resposta (não uma exceção)', async () => {
    const s = await servidor();
    try {
      assert.equal((await pedir({ host: '127.0.0.1', porta: s.porta, caminho: '/nada' })).status, 404);
    } finally {
      s.fechar();
    }
  });

  it('não usa o módulo http nem o fetch', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./httpCru.js', import.meta.url), 'utf8');
    assert.ok(!/from ['"]node:https?['"]|\bfetch\(/.test(codigo), 'o exercício é falar HTTP à mão, sobre o TCP');
  });
});
