import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ate, esperar, servidorHttp } from './ajuda.js';
import { Difusor, formatarEvento } from './sse.js';

describe('P1 · formatarEvento', () => {
  it('formata id, evento e dados JSON', () => {
    assert.equal(formatarEvento({ evento: 'tarefa', dados: { id: 1 }, id: 7 }), 'id: 7\nevent: tarefa\ndata: {"id":1}\n\n');
  });
  it('só os dados, em texto, com várias linhas', () => {
    assert.equal(formatarEvento({ dados: 'linha 1\nlinha 2' }), 'data: linha 1\ndata: linha 2\n\n');
  });
});

// Lê o corpo de um pedido SSE em texto, até a condição se cumprir (ou até ao tempo limite).
async function lerAte(url, condicao, cabecalhos = {}) {
  const controlo = new AbortController();
  const r = await fetch(url, { headers: cabecalhos, signal: controlo.signal });
  let texto = '';
  const decoder = new TextDecoder();
  const prazo = setTimeout(() => controlo.abort(), 2000);
  try {
    for await (const bocado of r.body) {
      texto += decoder.decode(bocado, { stream: true });
      if (condicao(texto)) break;
    }
  } catch {}
  clearTimeout(prazo);
  controlo.abort();
  return { r, texto };
}

describe('P1 · Difusor', () => {
  it('responde com os cabeçalhos de SSE e envia os eventos publicados', async () => {
    const d = new Difusor();
    const { server, url } = await servidorHttp((req, res) => d.ligar(req, res));
    try {
      const leitura = lerAte(url, (t) => t.includes('data: segunda'));
      await ate(() => d.clientes === 1);
      d.publicar('nota', 'primeira');
      d.publicar('nota', 'segunda');
      const { r, texto } = await leitura;
      assert.equal(r.headers.get('content-type'), 'text/event-stream');
      assert.equal(r.headers.get('cache-control'), 'no-cache');
      assert.match(texto, /id: 1\nevent: nota\ndata: primeira\n\n/);
      assert.match(texto, /id: 2\nevent: nota\ndata: segunda\n\n/);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it('quem volta a ligar com Last-Event-ID recebe o que perdeu', async () => {
    const d = new Difusor();
    for (const n of [1, 2, 3, 4]) d.publicar('nota', `n${n}`);
    const { server, url } = await servidorHttp((req, res) => d.ligar(req, res));
    try {
      const { texto } = await lerAte(url, (t) => t.includes('data: n4'), { 'Last-Event-ID': '2' });
      assert.ok(!texto.includes('data: n2'));
      assert.match(texto, /id: 3\nevent: nota\ndata: n3\n\n[\s\S]*id: 4/);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it('só guarda os últimos N eventos', async () => {
    const d = new Difusor({ guardar: 2 });
    for (const n of [1, 2, 3, 4]) d.publicar('nota', `n${n}`);
    const { server, url } = await servidorHttp((req, res) => d.ligar(req, res));
    try {
      const { texto } = await lerAte(url, (t) => t.includes('data: n4'), { 'Last-Event-ID': '0' });
      assert.ok(!texto.includes('data: n2') && texto.includes('data: n3'));
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });

  it('envia um batimento e esquece os clientes que se desligam', async () => {
    const d = new Difusor({ batimentoMs: 50 });
    const { server, url } = await servidorHttp((req, res) => d.ligar(req, res));
    try {
      const { texto } = await lerAte(url, (t) => t.includes(': ping'));
      assert.match(texto, /: ping\n\n/);
      assert.ok(await ate(() => d.clientes === 0), 'o cliente desligou-se, mas o difusor ainda o conta');
      await esperar(120); // com o cliente desligado, o batimento não pode rebentar
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
