import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Disjuntor, ErroCircuitoAberto } from './disjuntor.js';

const ok = async () => 'ok';
const falha = async () => {
  throw new Error('serviço em baixo');
};

function novo(opcoes = {}) {
  const relogio = { t: 0 };
  const d = new Disjuntor({ limiarFalhas: 3, esperaMs: 1000, agora: () => relogio.t, ...opcoes });
  const mudancas = [];
  d.aoMudar((de, para) => mudancas.push(`${de}→${para}`));
  return { d, relogio, mudancas };
}

describe('P2 · disjuntor', () => {
  it('fechado: deixa passar, e um sucesso volta a pôr as falhas a 0', async () => {
    const { d } = novo();
    await assert.rejects(d.executar(falha));
    await assert.rejects(d.executar(falha));
    assert.equal(await d.executar(ok), 'ok');
    await assert.rejects(d.executar(falha));
    await assert.rejects(d.executar(falha));
    assert.equal(d.estado, 'fechado', 'as falhas não eram seguidas');
  });

  it('abre ao fim de N falhas seguidas, e depois falha logo SEM chamar o serviço', async () => {
    const { d, mudancas } = novo();
    for (let i = 0; i < 3; i++) await assert.rejects(d.executar(falha), /em baixo/);
    assert.equal(d.estado, 'aberto');
    let chamado = false;
    await assert.rejects(d.executar(async () => (chamado = true)), ErroCircuitoAberto);
    assert.equal(chamado, false);
    assert.deepEqual(mudancas, ['fechado→aberto']);
  });

  it('depois da espera, deixa passar UMA tentativa; se correr bem, fecha', async () => {
    const { d, relogio, mudancas } = novo();
    for (let i = 0; i < 3; i++) await assert.rejects(d.executar(falha));
    relogio.t = 999;
    await assert.rejects(d.executar(ok), ErroCircuitoAberto);
    relogio.t = 1000;
    assert.equal(d.estado, 'meio-aberto');
    assert.equal(await d.executar(ok), 'ok');
    assert.equal(d.estado, 'fechado');
    assert.deepEqual(mudancas, ['fechado→aberto', 'aberto→meio-aberto', 'meio-aberto→fechado']);
  });

  it('se a tentativa falhar, volta a abrir e a espera recomeça', async () => {
    const { d, relogio } = novo();
    for (let i = 0; i < 3; i++) await assert.rejects(d.executar(falha));
    relogio.t = 1000;
    await assert.rejects(d.executar(falha), /em baixo/);
    assert.equal(d.estado, 'aberto');
    relogio.t = 1500;
    await assert.rejects(d.executar(ok), ErroCircuitoAberto);
    relogio.t = 2000;
    assert.equal(await d.executar(ok), 'ok');
  });

  it('em meio-aberto, só passa uma chamada de cada vez', async () => {
    const { d, relogio } = novo();
    for (let i = 0; i < 3; i++) await assert.rejects(d.executar(falha));
    relogio.t = 1000;
    let soltar;
    const lenta = d.executar(() => new Promise((r) => (soltar = r)));
    await assert.rejects(d.executar(ok), ErroCircuitoAberto, 'a segunda chamada ao mesmo tempo não passa');
    soltar('ok');
    assert.equal(await lenta, 'ok');
    assert.equal(d.estado, 'fechado');
  });
});
