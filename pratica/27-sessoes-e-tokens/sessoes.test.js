import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarSessoes } from './sessoes.js';

function montar() {
  let t = 1_000_000;
  const s = criarSessoes({ agora: () => t, inatividadeMs: 30 * 60_000, maximoMs: 8 * 3600_000 });
  return { s, avancarMin: (m) => (t += m * 60_000) };
}

describe('P2 · sessões no servidor', () => {
  it('ids longos, aleatórios e seguros para um cookie', () => {
    const { s } = montar();
    const ids = new Set(Array.from({ length: 200 }, () => s.criar('ana')));
    assert.equal(ids.size, 200);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{43}$/);
  });
  it('obter devolve o utilizador, e um id inventado dá null', () => {
    const { s } = montar();
    const id = s.criar('ana');
    assert.deepEqual(s.obter(id), { utilizador: 'ana', criadaEm: 1_000_000 });
    assert.equal(s.obter('inventado'), null);
  });
  it('expira por inatividade, mas cada uso renova', () => {
    const { s, avancarMin } = montar();
    const id = s.criar('ana');
    avancarMin(29);
    assert.ok(s.obter(id));
    avancarMin(29);
    assert.ok(s.obter(id), 'o uso anterior renovou');
    avancarMin(31);
    assert.equal(s.obter(id), null);
    avancarMin(-31);
    assert.equal(s.obter(id), null, 'foi apagada, não volta');
  });
  it('expira ao fim do tempo máximo, mesmo com uso', () => {
    const { s, avancarMin } = montar();
    const id = s.criar('ana');
    for (let i = 0; i < 16; i++) {
      avancarMin(29);
      assert.ok(s.obter(id), `uso ${i}`);
    }
    avancarMin(29);
    assert.equal(s.obter(id), null, '8 h depois de criada');
  });
  it('rodar o id: o antigo deixa de valer, a sessão continua', () => {
    const { s, avancarMin } = montar();
    const antigo = s.criar('ana');
    avancarMin(5);
    const novo = s.rodar(antigo);
    assert.notEqual(novo, antigo);
    assert.equal(s.obter(antigo), null);
    assert.deepEqual(s.obter(novo), { utilizador: 'ana', criadaEm: 1_000_000 });
    assert.equal(s.rodar('inventado'), null);
  });
  it('terminar e terminarTodas', () => {
    const { s } = montar();
    const a1 = s.criar('ana');
    const a2 = s.criar('ana');
    const r = s.criar('rui');
    s.terminar(a1);
    assert.equal(s.obter(a1), null);
    assert.equal(s.terminarTodas('ana'), 1);
    assert.equal(s.obter(a2), null);
    assert.ok(s.obter(r));
  });
});
