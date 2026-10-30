import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { executarSaga } from './saga.js';

// Os passos de uma encomenda: reservar stock, cobrar, e agendar a entrega (três serviços diferentes).
function passos({ falharEm, falharCompensacaoDe } = {}) {
  const efeitos = [];
  const passo = (nome, compensacao) => ({
    nome,
    async executar(ctx) {
      if (falharEm === nome) throw new Error(`${nome} indisponível`);
      efeitos.push(nome);
      ctx[nome] = `${nome}-id`;
    },
    async compensar(ctx) {
      if (falharCompensacaoDe === nome) throw new Error('timeout');
      efeitos.push(`${compensacao}(${ctx[nome]})`);
    },
  });
  return { efeitos, lista: [passo('reservar', 'libertar'), passo('cobrar', 'reembolsar'), passo('entregar', 'cancelarEntrega')] };
}

describe('P4 · saga com compensações', () => {
  it('tudo corre bem', async () => {
    const { efeitos, lista } = passos();
    const ctx = {};
    const r = await executarSaga(lista, ctx);
    assert.deepEqual(r, { sucesso: true, registo: ['ok: reservar', 'ok: cobrar', 'ok: entregar'] });
    assert.deepEqual(efeitos, ['reservar', 'cobrar', 'entregar']);
    assert.equal(ctx.cobrar, 'cobrar-id', 'os passos partilham o contexto');
  });

  it('se a entrega falhar, reembolsa e liberta o stock, pela ordem inversa', async () => {
    const { efeitos, lista } = passos({ falharEm: 'entregar' });
    const r = await executarSaga(lista);
    assert.equal(r.sucesso, false);
    assert.deepEqual(r.registo, ['ok: reservar', 'ok: cobrar', 'falhou: entregar: entregar indisponível', 'compensado: cobrar', 'compensado: reservar']);
    assert.deepEqual(efeitos, ['reservar', 'cobrar', 'reembolsar(cobrar-id)', 'libertar(reservar-id)']);
  });

  it('se o primeiro passo falhar, não há nada a compensar', async () => {
    const { efeitos, lista } = passos({ falharEm: 'reservar' });
    const r = await executarSaga(lista);
    assert.deepEqual(r.registo, ['falhou: reservar: reservar indisponível']);
    assert.deepEqual(efeitos, []);
  });

  it('uma compensação que falha é registada, e as outras continuam', async () => {
    const { efeitos, lista } = passos({ falharEm: 'entregar', falharCompensacaoDe: 'cobrar' });
    const r = await executarSaga(lista);
    assert.equal(r.sucesso, false);
    assert.deepEqual(r.registo.slice(3), ['compensação falhou: cobrar: timeout', 'compensado: reservar']);
    assert.deepEqual(efeitos.at(-1), 'libertar(reservar-id)');
  });
});
