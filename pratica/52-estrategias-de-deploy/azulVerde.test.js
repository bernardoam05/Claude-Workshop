import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { criarAzulVerde } from './azulVerde.js';

function montar(saude = { azul: true, verde: true }) {
  const verificadas = [];
  const av = criarAzulVerde({
    azul: async (p) => `v1:${p}`,
    verde: async (p) => `v2:${p}`,
    verificarSaude: async (cor) => {
      verificadas.push(cor);
      return saude[cor];
    },
  });
  return { av, verificadas, saude };
}

describe('P3 · azul/verde', () => {
  it('começa no azul', async () => {
    const { av } = montar();
    assert.equal(av.ativo, 'azul');
    assert.equal(await av.encaminhar('a'), 'v1:a');
  });
  it('troca para o verde depois de verificar a saúde', async () => {
    const { av, verificadas } = montar();
    assert.equal(await av.trocar(), 'verde');
    assert.deepEqual(verificadas, ['verde']);
    assert.equal(await av.encaminhar('a'), 'v2:a');
  });
  it('não troca para uma instalação doente', async () => {
    const { av } = montar({ azul: true, verde: false });
    await assert.rejects(av.trocar(), Error);
    assert.equal(av.ativo, 'azul');
    assert.equal(await av.encaminhar('a'), 'v1:a');
  });
  it('reverte de imediato, sem verificar a saúde', async () => {
    const { av, verificadas, saude } = montar();
    await av.trocar();
    saude.azul = false; // mesmo que a verificação falhasse, reverter não espera por ela
    assert.equal(av.reverter(), 'azul');
    assert.deepEqual(verificadas, ['verde']);
    assert.equal(await av.encaminhar('a'), 'v1:a');
  });
  it('não reverte sem ter havido troca', () => {
    const { av } = montar();
    assert.throws(() => av.reverter(), Error);
  });
  it('pode trocar várias vezes', async () => {
    const { av } = montar();
    await av.trocar();
    assert.equal(await av.trocar(), 'azul');
    assert.equal(av.reverter(), 'verde');
  });
});
