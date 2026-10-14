import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comTimeout, emParalelo, emSerie, esperar, tudoOuQuaseTudo } from './assincrono.js';

// Uma função assíncrona que demora `ms` e regista quando começou e acabou.
function tarefa(valor, ms, log) {
  return async () => {
    log?.push(`início ${valor}`);
    await new Promise((resolve) => setTimeout(resolve, ms));
    log?.push(`fim ${valor}`);
    return valor;
  };
}
const falha = (mensagem) => async () => {
  throw new Error(mensagem);
};

describe('P3 · esperar', () => {
  it('resolve depois de ms', async () => {
    const inicio = performance.now();
    assert.equal(await esperar(30), undefined);
    assert.ok(performance.now() - inicio >= 29);
  });
});

describe('P3 · emSerie e emParalelo', () => {
  it('emSerie: uma de cada vez', async () => {
    const log = [];
    assert.deepEqual(await emSerie([tarefa('a', 20, log), tarefa('b', 5, log)]), ['a', 'b']);
    assert.deepEqual(log, ['início a', 'fim a', 'início b', 'fim b']);
  });

  it('emParalelo: todas ao mesmo tempo, resultados pela ordem das funções', async () => {
    const log = [];
    assert.deepEqual(await emParalelo([tarefa('a', 20, log), tarefa('b', 5, log)]), ['a', 'b']);
    assert.deepEqual(log, ['início a', 'início b', 'fim b', 'fim a']);
  });

  it('emParalelo: se uma falhar, rejeita', async () => {
    await assert.rejects(emParalelo([tarefa('a', 5), falha('ups')]), /ups/);
  });
});

describe('P3 · tudoOuQuaseTudo', () => {
  it('separa o que correu bem do que falhou, sem rejeitar', async () => {
    assert.deepEqual(await tudoOuQuaseTudo([tarefa(1, 5), falha('A falhou'), tarefa(2, 1), falha('B falhou')]), {
      ok: [1, 2],
      falhas: ['A falhou', 'B falhou'],
    });
  });
});

describe('P3 · comTimeout', () => {
  it('a tempo: devolve o valor', async () => {
    assert.equal(await comTimeout(tarefa('rápida', 5)(), 100), 'rápida');
  });

  it('fora de tempo: rejeita com "Tempo esgotado", sem esperar pela promise', async () => {
    const inicio = performance.now();
    await assert.rejects(comTimeout(tarefa('lenta', 300)(), 20), /Tempo esgotado/);
    assert.ok(performance.now() - inicio < 200);
  });

  it('se a promise rejeitar a tempo, rejeita com o erro dela', async () => {
    await assert.rejects(comTimeout(falha('erro dela')(), 100), /erro dela/);
  });

  it('não deixa o temporizador pendurado (senão o processo do Node não terminava)', async () => {
    const antes = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    await comTimeout(Promise.resolve('já'), 60_000);
    const depois = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    assert.equal(depois, antes, 'ficou um setTimeout de 60 s à espera: falta o clearTimeout');
  });
});
