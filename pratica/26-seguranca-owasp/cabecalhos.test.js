import assert from 'node:assert/strict';
import { once } from 'node:events';
import { describe, it } from 'node:test';
import express from 'express';
import { cabecalhosSeguranca, cookieSessao, tokensIguais } from './cabecalhos.js';

describe('P5 · cabeçalhos de segurança', () => {
  it('todas as respostas levam os cabeçalhos, e o X-Powered-By desaparece', async () => {
    const app = express();
    app.use(cabecalhosSeguranca());
    app.get('/', (req, res) => res.send('ok'));
    app.get('/api/dados', (req, res) => res.json({ ok: true }));
    // (O 404 por omissão do Express limpa os cabeçalhos e põe os seus, ainda mais restritos:
    //  "default-src 'none'". Por isso testamos duas rotas a sério.)
    const server = app.listen(0);
    await once(server, 'listening');
    try {
      for (const caminho of ['/', '/api/dados']) {
        const r = await fetch(`http://localhost:${server.address().port}${caminho}`);
        assert.equal(r.headers.get('content-security-policy'), "default-src 'self'; frame-ancestors 'none'");
        assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(r.headers.get('strict-transport-security'), 'max-age=31536000; includeSubDomains');
        assert.equal(r.headers.get('x-powered-by'), null, 'o X-Powered-By anuncia a tecnologia a quem ataca');
      }
    } finally {
      server.close();
    }
  });
});

describe('P5 · tokensIguais', () => {
  it('compara corretamente', () => {
    assert.equal(tokensIguais('abc123', 'abc123'), true);
    assert.equal(tokensIguais('abc123', 'abc124'), false);
    assert.equal(tokensIguais('abc', 'abc123'), false);
    assert.equal(tokensIguais('', ''), true);
  });

  it('usa crypto.timingSafeEqual (o === pára no primeiro carácter diferente)', async () => {
    const codigo = (await import('node:fs')).readFileSync(new URL('./cabecalhos.js', import.meta.url), 'utf8');
    const corpo = codigo.slice(codigo.indexOf('export function tokensIguais'));
    assert.match(corpo.slice(0, corpo.indexOf('\n}')), /timingSafeEqual/);
  });
});

describe('P5 · cookieSessao', () => {
  it('a cookie de sessão leva todas as proteções', () => {
    const c = cookieSessao('abc');
    assert.ok(c.startsWith('sessao=abc;'), c);
    const atributos = c.split(';').slice(1).map((a) => a.trim()).sort();
    assert.deepEqual(atributos, ['HttpOnly', 'Max-Age=3600', 'Path=/', 'SameSite=Lax', 'Secure']);
  });
});
