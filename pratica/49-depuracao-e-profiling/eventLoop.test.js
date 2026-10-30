import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { describe, it } from 'node:test';
import { atrasoDoEventLoop, hashSenhas } from './eventLoop.js';

const bloquear = (ms) => {
  const fim = Date.now() + ms;
  while (Date.now() < fim);
};

describe('P1 · medir o atraso do event loop', () => {
  it('apanha um bloqueio de 200 ms', async () => {
    const r = await atrasoDoEventLoop(async () => {
      await new Promise((ok) => setTimeout(ok, 20));
      bloquear(200);
      await new Promise((ok) => setTimeout(ok, 20));
    });
    assert.ok(r.maxMs >= 150, `max = ${r.maxMs}`);
  });
  it('esperar não é bloquear', async () => {
    const r = await atrasoDoEventLoop(() => new Promise((ok) => setTimeout(ok, 200)));
    assert.ok(r.maxMs < 60, `max = ${r.maxMs}`);
    assert.ok(r.p99Ms <= r.maxMs);
  });
});

describe('P1 · hashSenhas sem bloquear', () => {
  const opcoes = { sal: 'sal-de-teste', iteracoes: 60_000 };
  const senhas = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  it('dá os mesmos hashes que a versão síncrona, pela mesma ordem', async () => {
    const esperado = senhas.map((s) => pbkdf2Sync(s, opcoes.sal, opcoes.iteracoes, 32, 'sha256').toString('hex'));
    assert.deepEqual(await hashSenhas(senhas, opcoes), esperado);
  });
  it('o event loop continua livre enquanto calcula', async () => {
    let r;
    const atraso = await atrasoDoEventLoop(async () => {
      r = await hashSenhas(senhas, opcoes);
    });
    assert.equal(r.length, 8);
    assert.ok(atraso.maxMs < 60, `o event loop esteve parado ${Math.round(atraso.maxMs)} ms`);
  });
});
