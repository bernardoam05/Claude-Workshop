import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agruparPor, escolher, mapearValores, semNulos } from './genericos.js';
import { esperar, type Igual } from './testesDeTipos.js';

type Tarefa = { id: number; titulo: string; feita: boolean; etiqueta: 'casa' | 'trabalho' };
const tarefas: Tarefa[] = [
  { id: 1, titulo: 'Pão', feita: true, etiqueta: 'casa' },
  { id: 2, titulo: 'Relatório', feita: false, etiqueta: 'trabalho' },
  { id: 3, titulo: 'Luz', feita: false, etiqueta: 'casa' },
];

// ---- Testes de TIPOS: se a tua assinatura estiver errada, isto não compila (e nada corre). ----
function tipos(): void {
  const g = agruparPor(tarefas, (t) => t.etiqueta);
  esperar<Igual<typeof g, Partial<Record<'casa' | 'trabalho', Tarefa[]>>>>();

  const e = escolher(tarefas[0]!, ['id', 'titulo']);
  esperar<Igual<typeof e, Pick<Tarefa, 'id' | 'titulo'>>>();
  // @ts-expect-error: "prioridade" não é uma chave de Tarefa
  escolher(tarefas[0]!, ['prioridade']);

  const s = semNulos([1, null, 2, undefined]);
  esperar<Igual<typeof s, number[]>>();

  const m = mapearValores({ a: 1, b: 2 }, (n) => String(n));
  esperar<Igual<typeof m, { a: string; b: string }>>();
}
void tipos;

describe('P1 · genéricos', () => {
  it('agruparPor', () => {
    const g = agruparPor(tarefas, (t) => t.etiqueta);
    assert.deepEqual(g.casa?.map((t) => t.id), [1, 3]);
    assert.deepEqual(g.trabalho?.map((t) => t.id), [2]);
    assert.deepEqual(agruparPor([], (x: number) => x), {});
  });

  it('escolher', () => {
    assert.deepEqual(escolher(tarefas[0]!, ['id', 'titulo']), { id: 1, titulo: 'Pão' });
  });

  it('semNulos', () => {
    assert.deepEqual(semNulos([1, null, 2, undefined, 0]), [1, 2, 0], 'o 0 não é null');
  });

  it('mapearValores', () => {
    assert.deepEqual(mapearValores({ a: 1, b: 2 }, (n) => n * 10), { a: 10, b: 20 });
  });
});
