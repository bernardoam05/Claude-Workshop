import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { retry } from './retry.js';

// Uma fn que falha nas primeiras `falhas` chamadas e regista QUANDO foi chamada.
function instavel(falhas, resultado = 'ok') {
  const momentos = [];
  const fn = async () => {
    momentos.push(performance.now());
    if (momentos.length <= falhas) throw new Error(`falha ${momentos.length}`);
    return resultado;
  };
  return { fn, momentos };
}

describe('P4 · retry', () => {
  it('se correr bem à primeira, não espera nem repete', async () => {
    const { fn, momentos } = instavel(0, 42);
    assert.equal(await retry(fn), 42);
    assert.equal(momentos.length, 1);
  });

  it('repete até conseguir, e devolve o resultado', async () => {
    const { fn, momentos } = instavel(2);
    assert.equal(await retry(fn, { tentativas: 3, atrasoInicialMs: 5 }), 'ok');
    assert.equal(momentos.length, 3);
  });

  it('as esperas duplicam: 10 ms, depois 20, depois 40', async () => {
    const { fn, momentos } = instavel(3);
    await retry(fn, { tentativas: 4, atrasoInicialMs: 10 });
    const esperas = momentos.slice(1).map((m, i) => m - momentos[i]);
    assert.ok(esperas[0] >= 9, `1.ª espera: ${esperas[0].toFixed(1)} ms`);
    assert.ok(esperas[1] >= 19, `2.ª espera: ${esperas[1].toFixed(1)} ms`);
    assert.ok(esperas[2] >= 39, `3.ª espera: ${esperas[2].toFixed(1)} ms`);
  });

  it('esgotadas as tentativas, rejeita com o ÚLTIMO erro', async () => {
    const { fn, momentos } = instavel(10);
    await assert.rejects(retry(fn, { tentativas: 3, atrasoInicialMs: 1 }), /falha 3/);
    assert.equal(momentos.length, 3);
  });

  it('não repete erros que não valem a pena (deveRepetir → false)', async () => {
    const { fn, momentos } = instavel(10);
    await assert.rejects(
      retry(fn, { tentativas: 5, atrasoInicialMs: 1, deveRepetir: (err) => !err.message.includes('falha 1') }),
      /falha 1/,
    );
    assert.equal(momentos.length, 1);
  });
});
