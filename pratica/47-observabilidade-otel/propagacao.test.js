import assert from 'node:assert/strict';
import { once } from 'node:events';
import { beforeEach, describe, it } from 'node:test';
import { limpar, spans } from './otel.js';
import { consultarStock, criarServicoStock, lerTraceparent } from './propagacao.js';

describe('P3 · lerTraceparent', () => {
  it('lê um cabeçalho válido', () => {
    assert.deepEqual(lerTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'), {
      versao: '00', traceId: '4bf92f3577b34da6a3ce929d0e0e4736', spanId: '00f067aa0ba902b7', amostrado: true,
    });
    assert.equal(lerTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00').amostrado, false);
    assert.equal(lerTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-03').amostrado, true, 'o bit mais baixo');
  });

  it('recusa cabeçalhos inválidos', () => {
    assert.ok(lerTraceparent('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'));
    for (const v of [
      '', 'lixo',
      '00-4BF92F3577B34DA6A3CE929D0E0E4736-00f067aa0ba902b7-01', // maiúsculas
      '00-00000000000000000000000000000000-00f067aa0ba902b7-01', // trace id a zeros
      '00-4bf92f3577b34da6a3ce929d0e0e4736-0000000000000000-01', // span id a zeros
      'ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01', // versão proibida
      '00-4bf92f3577b34da6a3ce929d0e0e473-00f067aa0ba902b7-01',  // 31 caracteres
    ]) {
      assert.equal(lerTraceparent(v), null, v);
    }
  });
});

describe('P3 · um trace entre dois serviços', () => {
  beforeEach(limpar);

  it('o serviço de stock continua o trace da loja, como filho', async () => {
    const servidor = criarServicoStock();
    servidor.listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    try {
      const resposta = await consultarStock(`http://127.0.0.1:${servidor.address().port}/stock`);
      const loja = spans().find((s) => s.nome === 'loja: consultar-stock');
      const stock = spans().find((s) => s.nome === 'stock: GET /stock');
      assert.ok(loja && stock, `faltam spans: ${spans().map((s) => s.nome)}`);
      assert.equal(stock.traceId, loja.traceId, 'o mesmo trace nos dois serviços');
      assert.equal(stock.pai, loja.spanId, 'o span do stock é filho do da loja');
      assert.equal(resposta.traceId, loja.traceId);
    } finally {
      servidor.close();
    }
  });
});
