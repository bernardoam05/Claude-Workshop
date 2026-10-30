import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { executar, repoFalso } from './ajuda.js';
import { criarCarregador } from './carregador.js';

describe('P3 · criarCarregador', () => {
  it('junta os pedidos do mesmo tique num só lote, sem repetir chaves', async () => {
    const lotes = [];
    const c = criarCarregador(async (ids) => (lotes.push(ids), ids.map((id) => `u${id}`)));
    const r = await Promise.all([c.load(1), c.load(2), c.load(1), c.load(3)]);
    assert.deepEqual(r, ['u1', 'u2', 'u1', 'u3']);
    assert.deepEqual(lotes, [[1, 2, 3]]);
  });

  it('guarda os resultados entre tiques', async () => {
    const lotes = [];
    const c = criarCarregador(async (ids) => (lotes.push(ids), ids.map((id) => id * 10)));
    assert.equal(await c.load(1), 10);
    assert.deepEqual(await Promise.all([c.load(1), c.load(2)]), [10, 20]);
    assert.deepEqual(lotes, [[1], [2]]);
  });

  it('um lote falhado faz falhar todas as promessas desse lote', async () => {
    const c = criarCarregador(async () => {
      throw new Error('BD em baixo');
    });
    const r = await Promise.allSettled([c.load(1), c.load(2)]);
    assert.deepEqual(r.map((x) => x.status), ['rejected', 'rejected']);
    assert.match(r[0].reason.message, /BD em baixo/);
  });

  it('aceita uma função de lote síncrona', async () => {
    const c = criarCarregador((ids) => ids.map((x) => x + 1));
    assert.deepEqual(await Promise.all([c.load(1), c.load(5)]), [2, 6]);
  });
});

describe('P3 · sem N+1 no GraphQL', () => {
  it('o dono de 4 tarefas de 2 pessoas pede os utilizadores UMA vez', async () => {
    const repo = repoFalso();
    // Uma tarefa da Ana e outra do Bruno, à força, numa só lista: o dono é resolvido por cada uma.
    repo.tarefasDe = async () => repo.tarefas;
    const r = await executar('{ tarefas { dono { nome } } }', { repo });
    assert.equal(r.errors, undefined, JSON.stringify(r.errors));
    assert.deepEqual(r.data.tarefas.map((t) => t.dono.nome), ['Ana', 'Ana', 'Ana', 'Bruno']);
    assert.deepEqual(repo.chamadas.utilizadoresPorIds, [['1', '2']], 'devia haver um só pedido, com os ids sem repetições');
  });
});
