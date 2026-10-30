import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { comAlternativa, comCobertura } from './cobertura.js';

const esperar = (ms, sinal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    sinal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('abortado'));
    });
  });

describe('P4 · comCobertura', () => {
  it('se a primeira responder depressa, não começa mais nenhuma', async () => {
    let copias = 0;
    const r = await comCobertura(async () => (copias++, 'rápida'), { atrasoMs: 50 });
    assert.equal(r, 'rápida');
    await esperar(80);
    assert.equal(copias, 1);
  });

  it('se a primeira for lenta, uma segunda cópia ganha, e a primeira é abortada', async () => {
    let n = 0;
    const abortadas = [];
    const inicio = Date.now();
    const r = await comCobertura(
      async (sinal) => {
        const eu = ++n;
        sinal.addEventListener('abort', () => abortadas.push(eu));
        await esperar(eu === 1 ? 1000 : 20, sinal); // a primeira apanhou um servidor lento
        return `cópia ${eu}`;
      },
      { atrasoMs: 30 },
    );
    assert.equal(r, 'cópia 2');
    assert.ok(Date.now() - inicio < 300, 'devia responder em ~50 ms, e não esperar pelo segundo inteiro');
    assert.deepEqual(abortadas, [1]);
  });

  it('se uma cópia falhar logo, a seguinte começa sem esperar', async () => {
    let n = 0;
    const inicio = Date.now();
    const r = await comCobertura(async () => {
      if (++n === 1) throw new Error('falhou');
      return 'segunda';
    }, { atrasoMs: 500 });
    assert.equal(r, 'segunda');
    assert.ok(Date.now() - inicio < 200);
  });

  it('se todas falharem, rejeita com o erro da última', async () => {
    let n = 0;
    await assert.rejects(comCobertura(async () => { throw new Error(`falha ${++n}`); }, { atrasoMs: 10, maxCopias: 3 }), /falha 3/);
  });
});

describe('P4 · comAlternativa', () => {
  it('usa a fonte principal e guarda em cache', async () => {
    const cache = new Map();
    assert.deepEqual(await comAlternativa(async () => 42, { cache, chave: 'k' }), { valor: 42, fonte: 'principal' });
    assert.equal(cache.get('k'), 42);
  });

  it('se a principal falhar, usa o que está em cache', async () => {
    const cache = new Map([['k', 41]]);
    assert.deepEqual(await comAlternativa(async () => { throw new Error('em baixo'); }, { cache, chave: 'k' }), { valor: 41, fonte: 'cache' });
  });

  it('sem principal nem cache, o erro propaga-se', async () => {
    const cache = new Map();
    assert.deepEqual(await comAlternativa(async () => 1, { cache, chave: 'outra' }), { valor: 1, fonte: 'principal' });
    await assert.rejects(comAlternativa(async () => { throw new Error('em baixo'); }, { cache, chave: 'k' }), /em baixo/);
  });
});
