import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErroPrazo, comPrazo, criarPrazo } from './prazos.js';

const esperar = (ms, sinal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    sinal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('abortado'));
    });
  });

describe('P1 · comPrazo', () => {
  it('devolve o resultado se acabar a tempo', async () => {
    assert.equal(await comPrazo(async () => 'ok', 100), 'ok');
  });

  it('rejeita com ErroPrazo se demorar demais, e aborta o trabalho', async () => {
    let abortado = false;
    const inicio = Date.now();
    await assert.rejects(
      comPrazo(async (sinal) => {
        sinal.addEventListener('abort', () => (abortado = true));
        await esperar(2000, sinal);
      }, 50),
      ErroPrazo,
    );
    assert.ok(Date.now() - inicio < 500, 'devia ter desistido aos 50 ms');
    assert.equal(abortado, true, 'o sinal devia ter sido abortado, para o trabalho parar');
  });

  it('os erros da própria função passam tal como são', async () => {
    await assert.rejects(comPrazo(async () => { throw new TypeError('x'); }, 100), TypeError);
  });

  it('não deixa o temporizador pendurado quando acaba depressa', async () => {
    const antes = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    await comPrazo(async () => 1, 60_000);
    const depois = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    assert.equal(depois, antes, 'falta o clearTimeout');
  });
});

describe('P1 · criarPrazo', () => {
  it('conta o tempo que falta, a partir de um relógio injetado', () => {
    let t = 1000;
    const p = criarPrazo(500, () => t);
    assert.equal(p.restante(), 500);
    t = 1300;
    assert.equal(p.restante(), 200);
    assert.equal(p.expirou(), false);
    t = 1600;
    assert.equal(p.restante(), 0);
    assert.equal(p.expirou(), true);
  });

  it('um filho nunca vive mais do que o pai', () => {
    let t = 0;
    const pai = criarPrazo(1000, () => t);
    assert.equal(pai.filho(300).restante(), 300);
    t = 900;
    assert.equal(pai.filho(300).restante(), 100, 'ao pai só faltam 100 ms');
    assert.equal(pai.filho(50).restante(), 50);
  });
});
