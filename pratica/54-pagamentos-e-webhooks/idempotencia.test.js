import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErroIdempotencia, criarIdempotente } from './idempotencia.js';

function cobrador() {
  const cobrancas = [];
  return {
    cobrancas,
    executar: async (pedido) => {
      await new Promise((r) => setTimeout(r, 10));
      cobrancas.push(pedido);
      return { id: `ch_${cobrancas.length}`, valor: pedido.valor };
    },
  };
}

describe('P3 · chaves de idempotência', () => {
  it('a repetição devolve o mesmo resultado sem cobrar outra vez', async () => {
    const c = cobrador();
    const p = criarIdempotente(c.executar);
    const r1 = await p.processar('k1', { valor: 1230 });
    const r2 = await p.processar('k1', { valor: 1230 });
    assert.deepEqual(r1, { id: 'ch_1', valor: 1230 });
    assert.deepEqual(r2, r1);
    assert.equal(c.cobrancas.length, 1);
  });
  it('chaves diferentes são pedidos diferentes', async () => {
    const c = cobrador();
    const p = criarIdempotente(c.executar);
    await p.processar('k1', { valor: 1 });
    await p.processar('k2', { valor: 1 });
    assert.equal(c.cobrancas.length, 2);
  });
  it('pedidos em paralelo com a mesma chave executam uma vez', async () => {
    const c = cobrador();
    const p = criarIdempotente(c.executar);
    const rs = await Promise.all([1, 2, 3].map(() => p.processar('k1', { valor: 5 })));
    assert.equal(c.cobrancas.length, 1);
    assert.ok(rs.every((r) => r.id === 'ch_1'));
  });
  it('a mesma chave com outro pedido é um erro', async () => {
    const c = cobrador();
    const p = criarIdempotente(c.executar);
    await p.processar('k1', { valor: 5 });
    await assert.rejects(p.processar('k1', { valor: 500 }), ErroIdempotencia);
    assert.equal(c.cobrancas.length, 1);
  });
  it('uma falha liberta a chave para nova tentativa', async () => {
    let falhar = true;
    const p = criarIdempotente(async (pedido) => {
      if (falhar) throw new Error('rede');
      return { ok: pedido.valor };
    });
    await assert.rejects(p.processar('k1', { valor: 1 }), /rede/);
    falhar = false;
    assert.deepEqual(await p.processar('k1', { valor: 1 }), { ok: 1 });
  });
  it('uma falha síncrona do executar também é tratada', async () => {
    const p = criarIdempotente(() => {
      throw new Error('síncrono');
    });
    await assert.rejects(p.processar('k', {}), /síncrono/);
  });
});
