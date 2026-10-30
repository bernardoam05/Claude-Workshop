import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { executar } from './ajuda.js';

const codigoDoErro = (r) => r.errors?.[0]?.extensions?.code;

describe('P2 · consultas', () => {
  it('eu, e as minhas tarefas com o dono (só os campos pedidos)', async () => {
    const r = await executar('{ eu { nome } tarefas(feita: false) { titulo dono { nome } } }');
    assert.equal(r.errors, undefined, JSON.stringify(r.errors));
    assert.deepEqual(r.data, {
      eu: { nome: 'Ana' },
      tarefas: [{ titulo: 'Ler o capítulo 3', dono: { nome: 'Ana' } }, { titulo: 'Comprar pão', dono: { nome: 'Ana' } }],
    });
  });

  it('primeiras limita, e tem de estar entre 1 e 100', async () => {
    const r = await executar('{ tarefas(primeiras: 2) { id } }');
    assert.deepEqual(r.data.tarefas, [{ id: '10' }, { id: '11' }]);
    for (const n of [0, 101]) {
      assert.equal(codigoDoErro(await executar(`{ tarefas(primeiras: ${n}) { id } }`)), 'BAD_USER_INPUT', `primeiras: ${n}`);
    }
  });

  it('uma tarefa de outra pessoa é null, como se não existisse', async () => {
    const r = await executar('query ($id: ID!) { tarefa(id: $id) { titulo } }', { variaveis: { id: '20' } });
    assert.equal(r.errors, undefined);
    assert.deepEqual(r.data, { tarefa: null });
    const minha = await executar('{ tarefa(id: "11") { titulo } }');
    assert.deepEqual(minha.data, { tarefa: { titulo: 'Ler o capítulo 3' } });
  });

  it('as tarefas de um utilizador, a partir dele', async () => {
    const r = await executar('{ eu { tarefas(feita: true) { titulo } } }');
    assert.deepEqual(r.data, { eu: { tarefas: [{ titulo: 'Pagar a luz' }] } });
  });

  it('sem sessão: "eu" é null, o resto é UNAUTHENTICATED', async () => {
    assert.deepEqual((await executar('{ eu { nome } }', { utilizador: null })).data, { eu: null });
    assert.equal(codigoDoErro(await executar('{ tarefas { id } }', { utilizador: null })), 'UNAUTHENTICATED');
    assert.equal(codigoDoErro(await executar('mutation { criarTarefa(titulo: "x") { id } }', { utilizador: null })), 'UNAUTHENTICATED');
  });
});

describe('P2 · mutações', () => {
  it('criarTarefa limpa e valida o título', async () => {
    const r = await executar('mutation { criarTarefa(titulo: "  Nova  ") { titulo feita dono { nome } } }');
    assert.deepEqual(r.data, { criarTarefa: { titulo: 'Nova', feita: false, dono: { nome: 'Ana' } } });
    for (const titulo of ['   ', 'x'.repeat(201)]) {
      const e = await executar('mutation ($t: String!) { criarTarefa(titulo: $t) { id } }', { variaveis: { t: titulo } });
      assert.equal(codigoDoErro(e), 'BAD_USER_INPUT');
    }
  });

  it('concluirTarefa só nas minhas', async () => {
    const r = await executar('mutation { concluirTarefa(id: "11") { feita } }');
    assert.deepEqual(r.data, { concluirTarefa: { feita: true } });
    const outra = await executar('mutation { concluirTarefa(id: "20") { feita } }');
    assert.deepEqual(outra.data, { concluirTarefa: null });
    assert.equal(outra.repo.tarefas.find((t) => t.id === '20').feita, false, 'a tarefa do Bruno não pode ter mudado');
  });
});
