import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { JanelaDeslizante } from './janelaDeslizante.js';

// Um "Redis" em memória, que regista as expirações pedidas.
function armazemFalso() {
  const dados = new Map();
  const expiracoes = new Map();
  return {
    dados,
    expiracoes,
    async incr(k) {
      dados.set(k, (dados.get(k) ?? 0) + 1);
      return dados.get(k);
    },
    async get(k) {
      return dados.has(k) ? dados.get(k) : null;
    },
    async expire(k, s) {
      expiracoes.set(k, s);
    },
  };
}

function limitador({ limite = 10, janelaMs = 60_000, inicio = 0 } = {}) {
  const relogio = { t: inicio };
  const armazem = armazemFalso();
  const lim = new JanelaDeslizante({ armazem, limite, janelaMs, agora: () => relogio.t });
  return { lim, relogio, armazem };
}

describe('P4 · janela deslizante', () => {
  it('deixa passar até ao limite e recusa o seguinte, sem o contar', async () => {
    const { lim, armazem } = limitador({ limite: 3 });
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await lim.permitir('ana'));
    assert.deepEqual(r, [
      { permitido: true, restantes: 2 },
      { permitido: true, restantes: 1 },
      { permitido: true, restantes: 0 },
      { permitido: false, restantes: 0 },
    ]);
    assert.equal(armazem.dados.get('lim:ana:0'), 3, 'o pedido recusado não deve ser contado');
  });

  it('cada cliente tem o seu contador', async () => {
    const { lim } = limitador({ limite: 1 });
    assert.equal((await lim.permitir('ana')).permitido, true);
    assert.equal((await lim.permitir('bruno')).permitido, true);
    assert.equal((await lim.permitir('ana')).permitido, false);
  });

  it('a meio do minuto seguinte, o anterior ainda pesa metade', async () => {
    const { lim, relogio } = limitador({ limite: 10 });
    for (let i = 0; i < 10; i++) await lim.permitir('ana');      // 10 no minuto 0
    relogio.t = 90_000;                                           // a meio do minuto 1
    // estimativa = 10 × 0,5 + 0 + 1 = 6
    assert.deepEqual(await lim.permitir('ana'), { permitido: true, restantes: 4 });
    for (let i = 0; i < 4; i++) assert.equal((await lim.permitir('ana')).permitido, true);
    assert.equal((await lim.permitir('ana')).permitido, false);
  });

  it('não deixa passar o dobro na fronteira entre janelas (o defeito da janela fixa)', async () => {
    const { lim, relogio } = limitador({ limite: 100 });
    relogio.t = 59_000;
    for (let i = 0; i < 100; i++) await lim.permitir('ana');
    relogio.t = 61_000; // dois segundos depois, já noutra janela
    let mais = 0;
    for (let i = 0; i < 100; i++) if ((await lim.permitir('ana')).permitido) mais++;
    assert.ok(mais < 10, `passaram mais ${mais} pedidos em 2 segundos (com a janela fixa seriam 100)`);
  });

  it('põe uma expiração de 2 janelas nas chaves', async () => {
    const { lim, armazem } = limitador({ janelaMs: 1500 });
    await lim.permitir('ana');
    assert.equal(armazem.expiracoes.get('lim:ana:0'), 3);
  });
});
