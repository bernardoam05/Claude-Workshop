import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as a from './arrays.js';

const tarefas = Object.freeze([
  { id: 1, titulo: 'Escrever capítulo', feita: false, projeto: 'Mestrado', minutos: 120, tags: ['escrita', 'tese'] },
  { id: 2, titulo: 'Ler artigo', feita: true, projeto: 'Mestrado', minutos: 45, tags: ['leitura', 'tese'] },
  { id: 3, titulo: 'Pagar a luz', feita: false, projeto: 'Casa', minutos: 10, tags: [] },
  { id: 4, titulo: 'Aspirar', feita: true, projeto: 'Casa', minutos: 30, tags: ['limpeza'] },
  { id: 5, titulo: 'Enviar resumo', feita: false, projeto: 'Mestrado', minutos: 20, tags: ['escrita'] },
]);

describe('P2 · métodos de array', () => {
  it('titulosFeitos (filter + map)', () => {
    assert.deepEqual(a.titulosFeitos(tarefas), ['Ler artigo', 'Aspirar']);
  });

  it('minutosPorFazer (filter + reduce)', () => {
    assert.equal(a.minutosPorFazer(tarefas), 150);
    assert.equal(a.minutosPorFazer([]), 0, 'o reduce precisa de um valor inicial para a lista vazia');
  });

  it('primeiraDoProjeto (find)', () => {
    assert.equal(a.primeiraDoProjeto(tarefas, 'Casa')?.id, 3);
    assert.equal(a.primeiraDoProjeto(tarefas, 'Ginásio'), undefined);
  });

  it('temTarefaLonga (some)', () => {
    assert.equal(a.temTarefaLonga(tarefas), true);
    assert.equal(a.temTarefaLonga(tarefas.filter((t) => t.id !== 1)), false);
  });

  it('todasAsTags (flatMap + Set + ordenar)', () => {
    assert.deepEqual(a.todasAsTags(tarefas), ['escrita', 'leitura', 'limpeza', 'tese']);
  });

  it('titulosPorProjeto (agrupar)', () => {
    assert.deepEqual(a.titulosPorProjeto(tarefas), {
      Mestrado: ['Escrever capítulo', 'Ler artigo', 'Enviar resumo'],
      Casa: ['Pagar a luz', 'Aspirar'],
    });
  });

  it('indexarPorId (Object.fromEntries)', () => {
    const indice = a.indexarPorId(tarefas);
    assert.equal(indice[4].titulo, 'Aspirar');
    assert.deepEqual(Object.keys(indice), ['1', '2', '3', '4', '5']);
  });

  it('porDuracao ordena sem alterar a lista original (que está congelada)', () => {
    assert.deepEqual(a.porDuracao(tarefas).map((t) => t.minutos), [120, 45, 30, 20, 10]);
  });

  it('regra do exercício: nenhum for e nenhum let em arrays.js', () => {
    const codigo = readFileSync(new URL('./arrays.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(codigo, /\bfor\s*\(/, 'usa métodos de array em vez de for');
    assert.doesNotMatch(codigo, /\blet\b/, 'sem let: cada função é uma expressão');
  });
});
