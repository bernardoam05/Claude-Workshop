import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { esperar, servidorHttp } from './ajuda.js';
import { lerEventos } from './clienteSse.js';

// Um servidor que envia um stream SSE "difícil", partido em bocados nos sítios piores.
const BOCADOS = [
  ': olá, sou um comentário\n\n',
  'id: 10\nevent: tare',
  'fa\ndata: {"id":1}\n\n',
  'data: linha um\ndata:linha dois\n',
  '\n',
  'event: sem-dados\n\n',
  'id: 11\ndata: fim\n\n',
];

describe('P2 · lerEventos', () => {
  it('junta bocados, ignora comentários, e trata várias linhas de dados', async () => {
    let cabecalhos;
    const { server, url } = await servidorHttp(async (req, res) => {
      cabecalhos = req.headers;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      for (const b of BOCADOS) {
        res.write(b);
        await esperar(15);
      }
      res.end();
    });
    try {
      const eventos = [];
      await lerEventos(url, (e) => eventos.push(e), { ultimoId: '9' });
      assert.deepEqual(eventos, [
        { evento: 'tarefa', dados: '{"id":1}', id: '10' },
        { evento: 'message', dados: 'linha um\nlinha dois', id: '10' },
        { evento: 'message', dados: 'fim', id: '11' },
      ]);
      assert.equal(cabecalhos['last-event-id'], '9');
      assert.equal(cabecalhos.accept, 'text/event-stream');
    } finally {
      server.close();
    }
  });

  it('pode ser cancelado com um AbortSignal', async () => {
    const { server, url } = await servidorHttp((req, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: um\n\n');
    });
    try {
      const controlo = new AbortController();
      const eventos = [];
      const leitura = lerEventos(url, (e) => {
        eventos.push(e);
        controlo.abort();
      }, { signal: controlo.signal }).catch((e) => e);
      const resultado = await Promise.race([leitura, esperar(2000).then(() => 'pendurado')]);
      assert.notEqual(resultado, 'pendurado', 'o abort devia terminar a leitura');
      assert.equal(eventos.length, 1);
    } finally {
      server.closeAllConnections();
      server.close();
    }
  });
});
