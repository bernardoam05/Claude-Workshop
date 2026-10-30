import assert from 'node:assert/strict';
import { availableParallelism } from 'node:os';
import { after, describe, it } from 'node:test';
import { atrasoDoEventLoop } from './eventLoop.js';
import { criarPiscina } from './piscina.js';

const ficheiro = new URL('./trabalhador.js', import.meta.url);
const piscinas = [];
const nova = (tamanho) => {
  const p = criarPiscina({ tamanho, ficheiro });
  piscinas.push(p);
  return p;
};
after(() => Promise.all(piscinas.map((p) => p.fechar())));

describe('P4 · piscina de workers', () => {
  it('devolve os resultados certos, pela ordem dos pedidos', async () => {
    const p = nova(2);
    assert.deepEqual(await Promise.all([1, 2, 3, 4, 5].map((valor) => p.executar({ valor, ms: 5 }))), [2, 4, 6, 8, 10]);
  });
  it('nunca corre mais trabalhos do que workers', async () => {
    const p = nova(2);
    const promessas = [1, 2, 3, 4, 5, 6].map((valor) => p.executar({ valor, ms: 30 }));
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(p.ativos, 2);
    await Promise.all(promessas);
    assert.equal(p.ativos, 0);
  });
  it('o trabalho pesado não bloqueia o event loop', async () => {
    const p = nova(2);
    const atraso = await atrasoDoEventLoop(() => Promise.all([1, 2, 3, 4].map((valor) => p.executar({ valor, ms: 100 }))));
    assert.ok(atraso.maxMs < 60, `o event loop parou ${Math.round(atraso.maxMs)} ms`);
  });
  it('corre em paralelo de verdade', { skip: availableParallelism() < 4 && 'são precisos 4 núcleos' }, async () => {
    const p = nova(4);
    await p.executar({ valor: 0, ms: 1 }); // aquecer
    const t0 = Date.now();
    await Promise.all([1, 2, 3, 4].map((valor) => p.executar({ valor, ms: 200 })));
    const t = Date.now() - t0;
    assert.ok(t < 600, `4 × 200 ms demoraram ${t} ms (em série seriam 800)`);
  });
  it('um trabalho que falha rejeita, e a piscina continua a funcionar', async () => {
    const p = nova(1);
    await assert.rejects(p.executar({ valor: 7, falhar: true }), /O trabalho 7 falhou/);
    assert.equal(await p.executar({ valor: 8 }), 16);
    assert.equal(p.ativos, 0);
  });
});
