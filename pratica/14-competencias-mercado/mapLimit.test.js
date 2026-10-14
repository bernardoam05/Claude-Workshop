import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mapLimit } from './mapLimit.js';

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Uma fn que regista quantas chamadas estão a decorrer ao mesmo tempo (e o máximo atingido).
function medidor(duracao = (i) => 10) {
  const estado = { aDecorrer: 0, maximo: 0, comecados: [] };
  const fn = async (item, indice) => {
    estado.comecados.push(indice);
    estado.aDecorrer++;
    estado.maximo = Math.max(estado.maximo, estado.aDecorrer);
    await esperar(duracao(indice));
    estado.aDecorrer--;
    return item * 10;
  };
  return { fn, estado };
}

describe('P3 · mapLimit', () => {
  it('devolve os resultados pela ordem dos itens, mesmo que acabem por outra ordem', async () => {
    const { fn } = medidor((i) => [30, 5, 15, 1][i]);
    assert.deepEqual(await mapLimit([1, 2, 3, 4], 2, fn), [10, 20, 30, 40]);
  });

  it('nunca passa do limite de chamadas em simultâneo', async () => {
    const { fn, estado } = medidor(() => 5);
    await mapLimit(Array.from({ length: 20 }, (_, i) => i), 3, fn);
    assert.equal(estado.maximo, 3);
  });

  it('assim que uma acaba, começa a seguinte (não espera pelo lote todo)', async () => {
    // O item 0 demora muito; os outros são rápidos. Com limite 2, o item 2 tem de começar logo que
    // o item 1 acaba, MUITO antes de o item 0 acabar. Em "lotes" de 2, esperava pelo item 0.
    const inicio = [];
    const fim = [];
    await mapLimit([0, 1, 2, 3], 2, async (item, i) => {
      inicio[i] = performance.now();
      await esperar(i === 0 ? 100 : 5);
      fim[i] = performance.now();
    });
    assert.ok(inicio[2] < fim[0], 'o item 2 só começou depois de o item 0 acabar: isso são lotes, não um pool');
  });

  it('lista vazia → []', async () => {
    assert.deepEqual(await mapLimit([], 3, async () => 1), []);
  });

  it('se uma falhar, rejeita com esse erro e não começa itens novos', async () => {
    const comecados = [];
    const fn = async (item) => {
      comecados.push(item);
      await esperar(5);
      if (item === 2) throw new Error('falhou o 2');
      return item;
    };
    await assert.rejects(mapLimit([1, 2, 3, 4, 5, 6, 7, 8], 2, fn), /falhou o 2/);
    await esperar(30);
    assert.ok(comecados.length < 8, `depois do erro não devia começar mais nada (começou: ${comecados})`);
  });
});
