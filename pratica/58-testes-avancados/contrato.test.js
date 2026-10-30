import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exemplo, fornecedorFalso, verificarFornecedor, verificarValor } from './contrato.js';

const contrato = [
  {
    descricao: 'listar tarefas',
    pedido: { metodo: 'GET', caminho: '/api/tasks' },
    resposta: {
      estado: 200,
      corpo: {
        tarefas: { $cadaUm: { id: { $tipo: 'numero' }, titulo: { $tipo: 'texto', $exemplo: 'Rever PR' }, feita: { $tipo: 'booleano' } } },
        pagina: 1,
      },
    },
  },
  {
    descricao: 'tarefa inexistente',
    pedido: { metodo: 'GET', caminho: '/api/tasks/999' },
    resposta: { estado: 404, corpo: { erro: { $tipo: 'texto' } } },
  },
];

describe('P2 · verificarValor', () => {
  it('tipos, regex e literais', () => {
    assert.deepEqual(verificarValor('a', { $tipo: 'texto' }), []);
    assert.deepEqual(verificarValor(1, { $tipo: 'texto' }), ['$: esperava texto, veio number']);
    assert.deepEqual(verificarValor('2026-10-30', { $regex: '^\\d{4}-\\d{2}-\\d{2}$' }), []);
    assert.equal(verificarValor('30/10', { $regex: '^\\d{4}' }).length, 1);
    assert.deepEqual(verificarValor(null, null), []);
    assert.deepEqual(verificarValor(2, 1), ['$: esperava 1, veio 2']);
  });
  it('objetos: chaves em falta são erro, chaves a mais não', () => {
    assert.deepEqual(verificarValor({ a: 1, extra: true }, { a: { $tipo: 'numero' } }), []);
    assert.deepEqual(verificarValor({}, { a: { $tipo: 'numero' } }), ['$.a: em falta']);
    assert.deepEqual(verificarValor([], { a: 1 }), ['$: esperava objeto, veio array']);
  });
  it('arrays: cada elemento, com o caminho certo', () => {
    const m = { $cadaUm: { id: { $tipo: 'numero' } } };
    assert.deepEqual(verificarValor([{ id: 1 }, { id: '2' }], m), ['$[1].id: esperava numero, veio string']);
    assert.deepEqual(verificarValor([], m), ['$: esperava pelo menos 1 elementos, veio 0']);
    assert.deepEqual(verificarValor([], { ...m, $min: 0 }), []);
  });
});

describe('P2 · exemplo e fornecedorFalso', () => {
  it('gera exemplos que correspondem ao próprio matcher', () => {
    const corpo = contrato[0].resposta.corpo;
    assert.deepEqual(exemplo(corpo), { tarefas: [{ id: 1, titulo: 'Rever PR', feita: true }], pagina: 1 });
    assert.deepEqual(verificarValor(exemplo(corpo), corpo), []);
  });
  it('o consumidor testa contra o fornecedor falso', async () => {
    const api = fornecedorFalso(contrato);
    // o "frontend" a ser testado:
    const titulos = async () => (await api({ metodo: 'GET', caminho: '/api/tasks' })).corpo.tarefas.map((t) => t.titulo);
    assert.deepEqual(await titulos(), ['Rever PR']);
    assert.equal((await api({ metodo: 'GET', caminho: '/api/tasks/999' })).estado, 404);
  });
  it('pedidos fora do contrato dão 500', async () => {
    const r = await fornecedorFalso(contrato)({ metodo: 'DELETE', caminho: '/api/tasks/1' });
    assert.deepEqual(r, { estado: 500, corpo: { erro: 'Pedido fora do contrato: DELETE /api/tasks/1' } });
  });
});

describe('P2 · verificarFornecedor', () => {
  const api = (tarefas) => async ({ caminho }) =>
    caminho === '/api/tasks' ? { estado: 200, corpo: { tarefas, pagina: 1, total: tarefas.length } } : { estado: 404, corpo: { erro: 'Não encontrada' } };
  it('um fornecedor que cumpre não tem erros', async () => {
    assert.deepEqual(await verificarFornecedor(contrato, api([{ id: 1, titulo: 'a', feita: false, criadaEm: 'x' }])), []);
  });
  it('apanha uma mudança que parte o consumidor', async () => {
    const erros = await verificarFornecedor(contrato, api([{ id: 1, title: 'a', feita: false }]));
    assert.deepEqual(erros, ['listar tarefas: $.tarefas[0].titulo: em falta']);
  });
  it('apanha estados diferentes', async () => {
    const sempre200 = async () => ({ estado: 200, corpo: { tarefas: [{ id: 1, titulo: 'a', feita: true }], pagina: 1 } });
    assert.deepEqual(await verificarFornecedor(contrato, sempre200), ['tarefa inexistente: estado esperado 404, veio 200']);
  });
});
