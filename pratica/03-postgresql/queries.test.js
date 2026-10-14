import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertSchemaFeito, createTestDb, lerQuery } from './testDb.js';

// Corre cada ficheiro de queries/ sobre o schema.sql (P1) + seed.sql e compara o resultado exato:
// as colunas (nomes e tipos) e a ordem das linhas fazem parte da resposta.
describe('P2 · queries', () => {
  let db; // criada no primeiro teste e partilhada: as queries só leem, não alteram nada

  const correr = async (nome) => {
    assertSchemaFeito();
    db ??= await createTestDb('base.sql', 'schema.sql', 'seed.sql');
    const sql = lerQuery(nome);
    assert.match(sql, /select/i, `${nome} ainda não tem nenhum SELECT`);
    return (await db.query(sql)).rows;
  };

  it('P2a · 01-pendentes-mestrado.sql', async () => {
    assert.deepEqual(await correr('01-pendentes-mestrado.sql'), [
      { title: 'Escrever capítulo 1' },
      { title: 'Enviar resumo' },
      { title: 'Ler artigo A' },
      { title: 'Rever bibliografia' },
    ]);
  });

  it('P2b · 02-resumo-por-projeto.sql', async () => {
    assert.deepEqual(await correr('02-resumo-por-projeto.sql'), [
      { project: 'Casa', total: 2, done: 1 },
      { project: 'Ginásio', total: 4, done: 3 },
      { project: 'Mestrado', total: 5, done: 1 },
      { project: 'Vazio', total: 0, done: 0 },
    ]);
  });

  it('P2c · 03-atrasadas.sql', async () => {
    assert.deepEqual(await correr('03-atrasadas.sql'), [
      { title: 'Escrever capítulo 1', project: 'Mestrado', days_late: 3 },
      { title: 'Pagar a luz', project: 'Casa', days_late: 1 },
    ]);
  });

  it('P2d · 04-utilizadores-sem-projetos.sql', async () => {
    assert.deepEqual(await correr('04-utilizadores-sem-projetos.sql'), [{ email: 'carla@exemplo.pt' }]);
  });

  it('P2e · 05-ranking-concluidas.sql', async () => {
    assert.deepEqual(await correr('05-ranking-concluidas.sql'), [
      { email: 'bruno@exemplo.pt', completed: 3 },
      { email: 'ana@exemplo.pt', completed: 2 },
    ]);
  });

  it('P2f · 06-projetos-sobrecarregados.sql', async () => {
    assert.deepEqual(await correr('06-projetos-sobrecarregados.sql'), [{ project: 'Mestrado', pending: 4 }]);
  });
});
