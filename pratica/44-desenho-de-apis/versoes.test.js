import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escolherVersao, paraVersao, partePedidos } from './versoes.js';

describe('P3 · escolherVersao', () => {
  it('sem nada, a atual', () => {
    assert.deepEqual(escolherVersao({}), { versao: 2, cabecalhosResposta: { 'API-Version': '2' } });
  });
  it('pelo Accept ou pelo API-Version (que tem prioridade)', () => {
    assert.equal(escolherVersao({ accept: 'application/vnd.tarefas.v2+json' }).versao, 2);
    assert.equal(escolherVersao({ 'api-version': '2', accept: 'application/vnd.tarefas.v1+json' }).versao, 2);
  });
  it('uma versão obsoleta avisa com Deprecation e Sunset', () => {
    assert.deepEqual(escolherVersao({ 'api-version': '1' }).cabecalhosResposta, {
      'API-Version': '1',
      Deprecation: 'true',
      Sunset: 'Wed, 31 Mar 2027 00:00:00 GMT',
    });
  });
  it('versões que não existem', () => {
    assert.throws(() => escolherVersao({ 'api-version': '9' }), /Versão/);
    assert.throws(() => escolherVersao({ 'api-version': 'toString' }), /Versão/);
  });
});

describe('P3 · paraVersao', () => {
  const t = { id: 1, titulo: 'Rever', estado: 'feita', etiquetas: ['api'] };
  it('a mesma tarefa em cada versão', () => {
    assert.deepEqual(paraVersao(t, 1), { id: 1, title: 'Rever', done: true });
    assert.deepEqual(paraVersao({ ...t, estado: 'em_curso' }, 1).done, false);
    assert.deepEqual(paraVersao(t, 2), t);
  });
});

describe('P3 · partePedidos', () => {
  const casos = [
    [{ tipo: 'campo-novo', onde: 'resposta' }, false],
    [{ tipo: 'campo-novo', onde: 'pedido' }, false],
    [{ tipo: 'campo-novo', onde: 'pedido', obrigatorio: true }, true],
    [{ tipo: 'campo-removido', onde: 'resposta' }, true],
    [{ tipo: 'campo-renomeado', onde: 'pedido' }, true],
    [{ tipo: 'tipo-alterado', onde: 'resposta' }, true],
    [{ tipo: 'valor-enum-novo', onde: 'resposta' }, true],
    [{ tipo: 'valor-enum-novo', onde: 'pedido' }, false],
  ];
  for (const [m, esperado] of casos) it(`${m.tipo} no ${m.onde}${m.obrigatorio ? ' (obrigatório)' : ''}: ${esperado ? 'parte' : 'não parte'}`, () => assert.equal(partePedidos(m), esperado));
  it('tipo desconhecido', () => assert.throws(() => partePedidos({ tipo: 'outro', onde: 'pedido' }), /desconhecido/));
});
